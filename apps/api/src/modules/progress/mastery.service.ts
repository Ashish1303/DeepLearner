import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { AccessTokens } from '../auth/access-token.service.js';
import { conceptCompletionPolicy } from '../concepts/concept.model.js';
import { attemptRecord } from '../practice/practice-attempt.model.js';
import { completionAssessmentRecord } from '../practice/practice-assessment.model.js';
import type { GradingRead } from '../practice/practice-rubric.repository.js';
import {
  mongoCompletionStore,
  type CompletionStore,
} from './completion.repository.js';
import { evidenceData, evidenceId } from './section-evidence-revision.js';
import {
  evaluateMasteryPolicy,
  type MasteryPolicyResult,
} from './mastery-policy.js';

const tokenId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}(?![\s\S])/);
const profileSchema = z
  .strictObject({
    id: tokenId,
    version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    improvingMinimum: z.number().int().min(0).max(100),
    strongMinimum: z.number().int().min(0).max(100),
  })
  .refine((p) => p.improvingMinimum < p.strongMinimum);
const commandSchema = z.strictObject({
  accessToken: z.string().min(1).max(4096),
  conceptId: evidenceId,
});
export type MasteryStore = Pick<
  CompletionStore,
  'ready' | 'session' | 'scope' | 'sources'
>;
const unavailable = () =>
  new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Classification is unavailable');
const invalid = () =>
  new AppError(400, 'VALIDATION_ERROR', 'Invalid classification command');
const refused = (
  code: 'SCORE_MISSING' | 'REVOKED_ASSESSMENT' | 'STALE_ASSESSMENT',
): MasteryPolicyResult => ({ classification: 'UNCLASSIFIED', code });

/** Trusted internal dependencies, never HTTP input. Importing does not connect,
 * register a route or instantiate an automatic consumer. */
export function createMasteryService(
  tokens: Pick<AccessTokens, 'verify'>,
  config: { APP_ENV: string },
  classificationPolicy: unknown,
  store: MasteryStore = mongoCompletionStore,
  clock = () => performance.now(),
) {
  let profile: z.output<typeof profileSchema>;
  try {
    profile = profileSchema.parse(evidenceData(classificationPolicy));
  } catch {
    throw unavailable();
  }
  return {
    async classify(input: unknown): Promise<MasteryPolicyResult> {
      const started = clock();
      const remaining = () => {
        const n = Math.floor(10000 - (clock() - started));
        if (!Number.isFinite(n) || n <= 0) throw unavailable();
        return n;
      };
      if (config.APP_ENV !== 'LOCAL')
        throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
      let command: z.output<typeof commandSchema>;
      try {
        command = commandSchema.parse(evidenceData(input));
      } catch {
        throw invalid();
      }
      let session: Awaited<ReturnType<MasteryStore['session']>> | undefined;
      let result: MasteryPolicyResult | undefined;
      let failure: unknown;
      const origins = new Set<
        Awaited<ReturnType<MasteryStore['scope']>>['origin']
      >();
      try {
        const actor = await tokens.verify(command.accessToken);
        if (
          !evidenceId.safeParse(actor.sub).success ||
          actor.role !== 'STUDENT'
        )
          throw new AppError(403, 'AUTH_FORBIDDEN', 'Student access required');
        remaining();
        const reauthenticate = async () => {
          const current = await tokens.verify(command.accessToken);
          if (
            current.sub !== actor.sub ||
            current.sid !== actor.sid ||
            current.role !== 'STUDENT'
          )
            throw new AppError(
              403,
              'AUTH_FORBIDDEN',
              'Student access required',
            );
          remaining();
        };
        const load = async (read: GradingRead) => {
          remaining();
          const scope = await store.scope(
            actor.sub,
            command.conceptId,
            read,
            false,
          );
          scope.origin.assert();
          origins.add(scope.origin);
          if (
            scope.owner !== actor.sub ||
            scope.conceptId !== command.conceptId
          )
            throw unavailable();
          const policy = conceptCompletionPolicy.parse(scope.policy);
          if (policy.conceptId !== command.conceptId) throw unavailable();
          if (scope.state === 'REVOKED')
            return {
              result: refused('REVOKED_ASSESSMENT'),
              identity: JSON.stringify([scope.state, policy]),
            };
          if (scope.state === 'STALE')
            return {
              result: refused('STALE_ASSESSMENT'),
              identity: JSON.stringify([scope.state, policy]),
            };
          if (
            scope.state !== 'CURRENT' ||
            policy.state !== 'APPROVED' ||
            policy.conceptRevision !== scope.conceptRevision
          )
            throw unavailable();
          // Live origin revalidates policy/rubric approval, ancestry and generation.
          const approved = await scope.origin.current(read, false);
          if (JSON.stringify(approved) !== JSON.stringify(policy))
            throw unavailable();
          const sources = await store.sources(scope, read, false);
          scope.origin.assert();
          remaining();
          if (sources.practiceStatus === 'STALE')
            return {
              result: refused('STALE_ASSESSMENT'),
              identity: JSON.stringify([policy, 'STALE']),
            };
          if (!sources.assessment) {
            if (
              sources.attempt ||
              !['MISSING', 'UNQUALIFIED'].includes(sources.practiceStatus)
            )
              throw unavailable();
            return {
              result: refused('SCORE_MISSING'),
              identity: JSON.stringify([policy, sources.practiceStatus]),
            };
          }
          const a = attemptRecord.parse(sources.attempt);
          const r = completionAssessmentRecord.parse(sources.assessment);
          if (
            a.attemptNumber !== 1 ||
            a.type !== 'OUTPUT' ||
            a.userId.toHexString() !== actor.sub ||
            r.userId.toHexString() !== actor.sub ||
            a.conceptId.toHexString() !== command.conceptId ||
            !r.conceptId.equals(a.conceptId) ||
            a.questionId.toHexString() !== policy.questionId ||
            !r.questionId.equals(a.questionId) ||
            !r.attemptId.equals(a._id) ||
            r.attemptRequestFingerprint !== a.requestFingerprint ||
            a.questionRevision !== policy.questionRevision ||
            a.contentFingerprint !== policy.contentFingerprint ||
            a.submittedAt < policy.approvedAt! ||
            r.evaluatedAt < a.submittedAt ||
            sources.practiceStatus !==
              (r.score === 100 ? 'QUALIFIED' : 'BELOW_THRESHOLD')
          )
            throw unavailable();
          const common = {
            userId: actor.sub,
            conceptId: command.conceptId,
            questionId: policy.questionId,
            completionPolicyId: policy.policyId,
            rubricId: policy.rubricId,
            conceptRevision: scope.conceptRevision,
            questionRevision: policy.questionRevision,
            contentFingerprint: policy.contentFingerprint,
            completionPolicyFingerprint: policy.fingerprint,
            sourceEpoch: policy.sourceEpoch,
            rubricDefinitionFingerprint: policy.rubricDefinitionFingerprint,
            completionPolicyVersion: policy.version,
            rubricVersion: policy.rubricVersion,
          };
          const evaluated = evaluateMasteryPolicy({
            schemaVersion: 1,
            policy: profile,
            expected: {
              ...common,
              selectedAttemptId: a._id.toHexString(),
              selectedAssessmentId: r._id.toHexString(),
              classificationPolicyId: profile.id,
              classificationPolicyVersion: profile.version,
            },
            assessment: {
              ...common,
              questionRevision: r.questionRevision,
              contentFingerprint: r.contentFingerprint,
              completionPolicyId: r.policyId.toHexString(),
              completionPolicyVersion: r.policyVersion,
              completionPolicyFingerprint: r.policyFingerprint,
              rubricId: r.rubricId.toHexString(),
              rubricVersion: r.rubricVersion,
              rubricDefinitionFingerprint: r.rubricDefinitionFingerprint,
              sourceEpoch: r.sourceEpoch,
              attemptId: r.attemptId.toHexString(),
              assessmentId: r._id.toHexString(),
              verification: 'VERIFIED',
              lifecycle: 'CURRENT',
              type: r.type,
              purpose: r.purpose,
              graderId: r.graderId,
              graderVersion: r.graderVersion,
              attemptNumber: r.attemptNumber,
              submissionProvenance: r.submissionProvenance,
              score: r.score,
            },
          });
          if (evaluated.code !== 'NONE') throw unavailable();
          // The default sources reader proves exact immutable records with
          // completionGrading.proof; fresh majority loading repeats that proof.
          return {
            result: evaluated,
            identity: JSON.stringify([
              policy,
              {
                attemptId: a._id,
                requestFingerprint: a.requestFingerprint,
                submittedAt: a.submittedAt,
              },
              r,
            ]),
          };
        };
        await store.ready(remaining());
        session = await store.session();
        let bodies = 0;
        let snapshot: Awaited<ReturnType<typeof load>> | undefined;
        const available = remaining() - 2000;
        if (available <= 0) throw unavailable();
        await session.withTransaction(
          async () => {
            if (++bodies > 3 || remaining() <= 2000) throw unavailable();
            snapshot = undefined;
            snapshot = await load({ session: session! });
          },
          {
            timeoutMS: available,
            maxCommitTimeMS: Math.min(2000, available),
            readPreference: 'primary',
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority', j: true },
          },
        );
        if (!snapshot) throw unavailable();
        await reauthenticate();
        const proof = await load({
          session,
          majority: true,
          get timeoutMS() {
            return remaining();
          },
        });
        if (
          proof.identity !== snapshot.identity ||
          JSON.stringify(proof.result) !== JSON.stringify(snapshot.result)
        )
          throw unavailable();
        result = proof.result;
        await reauthenticate();
        for (const origin of origins) origin.assert();
        remaining();
      } catch (error) {
        failure = error;
      } finally {
        if (session)
          try {
            await session.endSession();
          } catch {
            failure ??= unavailable();
          }
      }
      if (failure) {
        if (
          failure instanceof AppError &&
          [401, 403, 404].includes(failure.statusCode)
        )
          throw new AppError(
            failure.statusCode,
            failure.code,
            failure.statusCode === 404
              ? 'Concept not found'
              : 'Current authorized Student required',
          );
        throw unavailable();
      }
      try {
        for (const origin of origins) origin.assert();
        remaining();
        if (!result) throw unavailable();
      } catch {
        throw unavailable();
      }
      return {
        classification: result.classification,
        code: result.code,
      } as MasteryPolicyResult;
    },
  };
}
export type MasteryService = ReturnType<typeof createMasteryService>;

import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AccessTokens } from '../auth/access-token.service.js';
import { hashPassword } from '../auth/password.service.js';
import { createGradingRepository } from '../practice/practice-assessment.repository.js';
import {
  gradingId,
  positiveVersion,
  rubricDefinition,
  rubricAuthority,
} from '../practice/practice-rubric.model.js';
import type { GradingRead } from '../practice/practice-rubric.repository.js';
import {
  conceptCompletionPolicy,
  conceptCompletionRules,
  completionPolicyFingerprint,
  type ConceptCompletionPolicy,
  type ConceptCompletionRules,
} from '../concepts/concept.model.js';
import {
  mongoCheckpoint,
  type CheckpointStore,
} from '../visualizations/visualization-checkpoint.repository.js';
import { checkpointDefinitionRecord } from '../visualizations/visualization-checkpoint-definition.model.js';
import {
  mongoQualification,
  evidenceUnavailable,
  evidenceConflict,
  type QualificationStore,
  type SyntheticCreation,
  type SyntheticIdentity,
} from './section-evidence.repository.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  acknowledgementChallengeRecord,
  visualChallengeRecord,
} from './section-evidence-challenge.model.js';
import {
  acknowledgementReceiptRecord,
  visualReceiptRecord,
} from './section-evidence-receipt.model.js';
import {
  ackFingerprint,
  issueFingerprint,
} from './section-evidence.service.js';
import {
  checkpointIssueFingerprint,
  checkpointResponseFingerprint,
} from '../visualizations/visualization-checkpoint.service.js';
import { checkpointBinding } from '../visualizations/visualization-checkpoint-revision.js';
import { evidenceData } from './section-evidence-revision.js';

const creation = z.strictObject({
  topicId: gradingId,
  summary: z.string().trim().min(1).max(2000),
  bodyMarkdown: z.string().min(1).max(50_000),
  example: z.string().min(1).max(10_000),
  prompt: z.string().min(1).max(10_000),
  answer: z.string().min(1).max(10_000),
  revise: z
    .strictObject({
      summary: z.string().trim().min(1).max(2000),
      keyPoints: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
    })
    .optional(),
});
const policyCommand = z.strictObject({
  conceptId: gradingId,
  rubricId: gradingId,
  rubricVersion: positiveVersion,
  checkpointDefinitionId: gradingId,
  minimumScore: z.literal(70),
  requireRevise: z.boolean().optional(),
});
const versionCommand = z.strictObject({
  conceptId: gradingId,
  version: positiveVersion,
});
const denied = () =>
  new AppError(403, 'AUTH_FORBIDDEN', 'Current authorized account required');
function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  try {
    return schema.parse(evidenceData(input));
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid completion command');
  }
}
export interface QualificationAuthority {
  assert(): void;
  current(read: GradingRead, fence: boolean): Promise<ConceptCompletionPolicy>;
  ready(timeoutMS: number): Promise<void>;
}
// Not exported: no deserialization/registration/adoption API exists. The values
// are closures over successful insert/proof operations, never caller assertions.
const runtimeOrigins = new Map<string, QualificationAuthority>();
const key = (owner: string, question: string) => `${owner}:${question}`;
export function qualificationAuthority(
  owner: string,
  question: string,
): QualificationAuthority | null {
  return runtimeOrigins.get(key(owner, question)) ?? null;
}

/** Internal synthetic fixture producer. No route or ordinary startup enables it.
 * Only server-generated identities from confirmed inserts enter this instance. */
export function createCompletionEvidenceService(
  tokens: Pick<AccessTokens, 'verify'>,
  config: { APP_ENV: string },
  store: QualificationStore = mongoQualification,
  checkpoints: Pick<
    CheckpointStore,
    'definition' | 'source' | 'admin'
  > = mongoCheckpoint,
  // Trusted fixture-code dependency only. Never part of a public command or DTO.
  credentialSource?: (identity: Readonly<SyntheticIdentity>) => Promise<string>,
) {
  const repository = createGradingRepository(store);
  const origins = new Map<
    string,
    {
      identity: SyntheticIdentity;
      assert(): void;
      sealed: boolean;
      sealedPolicy: string | null;
      dead: boolean;
    }
  >();
  let unsubscribe: (() => void) | undefined;
  const isLocal = config.APP_ENV === 'LOCAL';
  const local = () => {
    if (!isLocal) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
  };
  async function admin(token: unknown) {
    local();
    if (typeof token !== 'string' || token.length > 4096) throw denied();
    let claim;
    try {
      claim = await tokens.verify(token);
    } catch {
      throw denied();
    }
    if (claim.role !== 'ADMIN' || !gradingId.safeParse(claim.sub).success)
      throw denied();
    return claim.sub;
  }
  function origin(id: string) {
    const value = origins.get(id);
    if (!value) throw evidenceUnavailable();
    value.assert();
    return value;
  }
  async function active(
    id: string,
    read: GradingRead,
    fence: boolean,
    requireSealed = true,
  ) {
    const o = origin(id);
    if (requireSealed && !o.sealed) throw evidenceUnavailable();
    await store.actor(o.identity.userId, 'STUDENT', read);
    const rules = await store.policy(id, read);
    if (!rules || rules.activeVersion === null) throw evidenceUnavailable();
    const p = rules.versions.find((v) => v.version === rules.activeVersion);
    if (
      !p ||
      p.state !== 'APPROVED' ||
      p.sourceEpoch !== o.identity.sourceEpoch ||
      p.questionId !== o.identity.questionId ||
      p.conceptId !== id ||
      p.conceptRevision !== (await store.conceptRevision(id, read))
    )
      throw evidenceUnavailable();
    if (requireSealed && o.sealedPolicy !== p.fingerprint)
      throw evidenceUnavailable();
    if (p.authoredAt > new Date() || p.approvedAt! > new Date())
      throw evidenceUnavailable();
    await store.actor(p.authoredBy, 'ADMIN', read);
    await store.actor(p.approvedBy!, 'ADMIN', read);
    const sourceQuestion = await store.qualified(
      p.questionId,
      p.conceptId,
      read,
    );
    const definition = await store.definition(
      new Types.ObjectId(p.rubricId),
      p.rubricVersion,
      read,
    );
    const approval = await store.authority(
      new Types.ObjectId(p.rubricId),
      p.rubricVersion,
      read,
    );
    if (!sourceQuestion || !definition || !approval)
      throw evidenceUnavailable();
    rubricDefinition.parse(definition);
    rubricAuthority.parse(approval);
    if (
      sourceQuestion.data.type !== 'OUTPUT' ||
      sourceQuestion.data.id !== p.questionId ||
      sourceQuestion.data.conceptId !== p.conceptId ||
      sourceQuestion.questionRevision !== p.questionRevision ||
      sourceQuestion.contentFingerprint !== p.contentFingerprint ||
      definition.questionId.toHexString() !== p.questionId ||
      definition.conceptId.toHexString() !== p.conceptId ||
      definition.questionRevision !== p.questionRevision ||
      definition.contentFingerprint !== p.contentFingerprint ||
      definition.definitionFingerprint !== p.rubricDefinitionFingerprint ||
      approval.state !== 'APPROVED' ||
      !approval.definitionId.equals(definition._id) ||
      !approval.authorId.equals(definition.authorId) ||
      !approval.rubricId.equals(definition.rubricId) ||
      approval.version !== definition.version ||
      approval.definitionFingerprint !== definition.definitionFingerprint ||
      approval.approvedAt < definition.createdAt
    )
      throw evidenceUnavailable();
    await store.actor(definition.authorId.toHexString(), 'ADMIN', read);
    await store.actor(approval.reviewerId.toHexString(), 'ADMIN', read);
    await store.auditProof(
      definition,
      definition.authorId,
      'PRACTICE_RUBRIC_AUTHORED',
      definition.createdAt,
      read,
    );
    await store.auditProof(
      definition,
      approval.reviewerId,
      'PRACTICE_RUBRIC_APPROVED',
      approval.approvedAt,
      read,
      approval.approvalAuditId,
    );
    const d = await checkpoints.definition(
      { _id: new Types.ObjectId(p.checkpointDefinitionId) },
      read,
    );
    if (!d) throw evidenceUnavailable();
    checkpointDefinitionRecord.parse(d);
    if (
      d.state !== 'APPROVED' ||
      !d.conceptId.equals(new Types.ObjectId(id)) ||
      d.conceptRevision !== p.conceptRevision ||
      d.definitionFingerprint !== p.checkpointFingerprint ||
      d.visualizationRevision !== p.visualizationRevision
    )
      throw evidenceUnavailable();
    await checkpoints.admin(d.authoredBy, read);
    await checkpoints.admin(d.approvedBy!, read);
    const source = await checkpoints.source(
      d.conceptId,
      d.visualizationId,
      read,
    );
    if (
      source.conceptRevision !== p.conceptRevision ||
      source.visualizationRevision !== p.visualizationRevision
    )
      throw evidenceUnavailable();
    if (fence)
      await store.policyWrite(
        id,
        rules,
        { ...rules, decisionFence: rules.decisionFence + 1 },
        read,
      );
    o.assert();
    return p;
  }
  return {
    async create(token: unknown, input: unknown) {
      const author = await admin(token),
        cmd = parse(creation, input);
      const generation = store.generation();
      if (!generation.live || origins.size >= 32) throw evidenceUnavailable();
      const identity: SyntheticIdentity = {
        userId: new Types.ObjectId().toHexString(),
        conceptId: new Types.ObjectId().toHexString(),
        questionId: new Types.ObjectId().toHexString(),
        sourceEpoch: randomBytes(32).toString('hex'),
      };
      const state = {
        identity,
        sealed: false,
        sealedPolicy: null as string | null,
        dead: false,
        assert() {
          local();
          let g;
          try {
            g = store.generation();
          } catch {
            state.dead = true;
            throw evidenceUnavailable();
          }
          if (
            !g.live ||
            g.client !== generation.client ||
            g.database !== generation.database
          )
            state.dead = true;
          if (state.dead) throw evidenceUnavailable();
        },
      };
      origins.set(identity.conceptId, state);
      try {
        unsubscribe ??= store.onLoss(() => {
          for (const value of origins.values()) value.dead = true;
        });
      } catch {
        state.dead = true;
        throw evidenceUnavailable();
      }
      const authority: QualificationAuthority = Object.freeze({
        assert: () => {
          state.assert();
          if (!state.sealed) throw evidenceUnavailable();
        },
        current: (read: GradingRead, fence: boolean) =>
          active(identity.conceptId, read, fence),
        ready: (ms: number) => store.ready(ms),
        toJSON: () => {
          throw evidenceUnavailable();
        },
      });
      if (store === mongoQualification)
        runtimeOrigins.set(
          key(identity.userId, identity.questionId),
          authority,
        );
      try {
        // Default remains random/discard. A supervised fixture may supply one
        // owner-entered password internally; neither plaintext nor hash is returned.
        let password = '';
        let passwordHash: string;
        try {
          password = credentialSource
            ? await credentialSource(Object.freeze({ ...identity }))
            : randomBytes(32).toString('hex');
          if (
            typeof password !== 'string' ||
            password.length < 10 ||
            password.length > 128
          )
            throw evidenceUnavailable();
          passwordHash = await hashPassword(password);
        } catch {
          throw evidenceUnavailable();
        } finally {
          // Reference clearing is not a claim of JavaScript heap zeroization.
          password = '';
        }
        const value: SyntheticCreation = {
          ...identity,
          ...cmd,
          authorId: author,
          passwordHash,
        };
        // Verify the exact target and writable PRIMARY BEFORE any fixture writes.
        // hello is a preflight command, not a command inside a MongoDB transaction.
        state.assert();
        await store.target({ timeoutMS: 5000, majority: true });
        await repository.transact(
          async (read) => {
            state.assert();
            await store.actor(author, 'ADMIN', read);
            try {
              await store.createSynthetic(value, read);
            } catch (error) {
              if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 11000
              )
                throw evidenceConflict();
              throw error;
            }
            return identity;
          },
          async (_value, read) => {
            state.assert();
            await store.actor(author, 'ADMIN', read);
            await store.syntheticProof(value, read);
            state.assert();
          },
        );
        return Object.freeze({ ...identity }); // IDs are resource locators, never origin credentials.
      } catch (error) {
        state.dead = true;
        throw error;
      }
    },
    async author(token: unknown, input: unknown) {
      const actor = await admin(token),
        cmd = parse(policyCommand, input),
        o = origin(cmd.conceptId);
      return repository.transact(
        async (read) => {
          await store.actor(actor, 'ADMIN', read);
          const rules = await store.policy(cmd.conceptId, read);
          if ((rules?.versions.length ?? 0) >= 10) throw evidenceConflict();
          const rubric = await store.definition(
            new Types.ObjectId(cmd.rubricId),
            cmd.rubricVersion,
            read,
          );
          const checkpoint = await checkpoints.definition(
            { _id: new Types.ObjectId(cmd.checkpointDefinitionId) },
            read,
          );
          if (
            !rubric ||
            !checkpoint ||
            rubric.questionId.toHexString() !== o.identity.questionId ||
            rubric.conceptId.toHexString() !== cmd.conceptId ||
            checkpoint.conceptId.toHexString() !== cmd.conceptId
          )
            throw evidenceUnavailable();
          const revision = await store.conceptRevision(cmd.conceptId, read);
          if (cmd.requireRevise)
            await store.sectionRevision(cmd.conceptId, 'REVISE', read);
          if (checkpoint.conceptRevision !== revision)
            throw evidenceUnavailable();
          const draft = {
            policyId: new Types.ObjectId().toHexString(),
            version:
              Math.max(0, ...(rules?.versions.map((v) => v.version) ?? [])) + 1,
            conceptId: cmd.conceptId,
            conceptRevision: revision,
            sourceEpoch: o.identity.sourceEpoch,
            requiredSections: [
              'READ',
              'VISUALIZE',
              'EXAMPLE',
              'PRACTICE',
              ...(cmd.requireRevise ? ['REVISE'] : []),
            ] as ConceptCompletionPolicy['requiredSections'],
            minimumScore: 70 as const,
            questionId: o.identity.questionId,
            questionRevision: rubric.questionRevision,
            contentFingerprint: rubric.contentFingerprint,
            rubricId: cmd.rubricId,
            rubricVersion: cmd.rubricVersion,
            rubricDefinitionFingerprint: rubric.definitionFingerprint,
            checkpointDefinitionId: cmd.checkpointDefinitionId,
            checkpointFingerprint: checkpoint.definitionFingerprint,
            visualizationRevision: checkpoint.visualizationRevision,
            authoredBy: actor,
            authoredAt: new Date(),
            state: 'DRAFT' as const,
            approvedBy: null,
            approvedAt: null,
            approvedFingerprint: null,
            revokedBy: null,
            revokedAt: null,
          };
          const policy = conceptCompletionPolicy.parse({
            ...draft,
            fingerprint: completionPolicyFingerprint(draft),
          });
          await store.policyWrite(
            cmd.conceptId,
            rules,
            {
              schemaVersion: 1,
              decisionFence: (rules?.decisionFence ?? 0) + 1,
              activeVersion: rules?.activeVersion ?? null,
              versions: [...(rules?.versions ?? []), policy],
            },
            read,
          );
          return policy;
        },
        async (p, read) => {
          o.assert();
          await store.actor(actor, 'ADMIN', read);
          const rules = await store.policy(cmd.conceptId, read);
          if (
            !rules?.versions.some(
              (v) => JSON.stringify(v) === JSON.stringify(p),
            )
          )
            throw evidenceUnavailable();
        },
      );
    },
    async approve(token: unknown, input: unknown) {
      const actor = await admin(token),
        cmd = parse(versionCommand, input),
        o = origin(cmd.conceptId);
      const approvedPolicy = await repository.transact(
        async (read) => {
          o.assert();
          await store.actor(actor, 'ADMIN', read);
          const rules = await store.policy(cmd.conceptId, read),
            p = rules?.versions.find((v) => v.version === cmd.version);
          if (!rules || !p || p.state === 'REVOKED')
            throw evidenceUnavailable();
          if (p.authoredBy === actor) throw denied();
          await store.actor(p.authoredBy, 'ADMIN', read);
          if (p.state === 'APPROVED' && p.approvedBy !== actor)
            throw evidenceConflict();
          const approved = conceptCompletionPolicy.parse({
            ...p,
            state: 'APPROVED',
            approvedBy: actor,
            approvedAt: p.approvedAt ?? new Date(),
            approvedFingerprint: p.fingerprint,
          });
          const next: ConceptCompletionRules = {
            ...rules,
            decisionFence: rules.decisionFence + 1,
            activeVersion: cmd.version,
            versions: rules.versions.map((v) =>
              v.version === cmd.version ? approved : v,
            ),
          };
          await store.policyWrite(cmd.conceptId, rules, next, read);
          await active(cmd.conceptId, read, false, false);
          return approved;
        },
        async (approved, read) => {
          await store.actor(actor, 'ADMIN', read);
          const stored = await store.policy(cmd.conceptId, read);
          if (
            stored?.activeVersion !== approved.version ||
            JSON.stringify(
              stored.versions.find((v) => v.version === approved.version),
            ) !== JSON.stringify(approved)
          )
            throw evidenceUnavailable();
          await active(cmd.conceptId, read, false, false);
        },
      );
      o.assert();
      o.sealedPolicy = approvedPolicy.fingerprint;
      o.sealed = true;
      return { state: 'APPROVED' as const, version: cmd.version };
    },
    async revoke(token: unknown, input: unknown) {
      const actor = await admin(token),
        cmd = parse(versionCommand, input),
        o = origin(cmd.conceptId);
      await repository.transact(
        async (read) => {
          o.assert();
          await store.actor(actor, 'ADMIN', read);
          const rules = await store.policy(cmd.conceptId, read),
            p = rules?.versions.find((v) => v.version === cmd.version);
          if (!rules || !p) throw evidenceUnavailable();
          if (p.state === 'REVOKED') return p;
          const revoked = conceptCompletionPolicy.parse({
            ...p,
            state: 'REVOKED',
            revokedBy: actor,
            revokedAt: new Date(),
          });
          await store.policyWrite(
            cmd.conceptId,
            rules,
            conceptCompletionRules.parse({
              ...rules,
              decisionFence: rules.decisionFence + 1,
              activeVersion:
                rules.activeVersion === cmd.version
                  ? null
                  : rules.activeVersion,
              versions: rules.versions.map((v) =>
                v.version === cmd.version ? revoked : v,
              ),
            }),
            read,
          );
          return revoked;
        },
        async (_value, read) => {
          await store.actor(actor, 'ADMIN', read);
          if (
            (await store.policy(cmd.conceptId, read))?.versions.find(
              (v) => v.version === cmd.version,
            )?.state !== 'REVOKED'
          )
            throw evidenceUnavailable();
        },
      );
      return { state: 'REVOKED' as const, version: cmd.version };
    },
    async actions(token: unknown, conceptId: string) {
      local();
      if (
        typeof token !== 'string' ||
        token.length > 4096 ||
        !gradingId.safeParse(conceptId).success
      )
        throw denied();
      let claim;
      try {
        claim = await tokens.verify(token);
      } catch {
        throw denied();
      }
      const o = origin(conceptId);
      if (claim.role !== 'STUDENT' || claim.sub !== o.identity.userId)
        throw denied();
      const readActions = async (read: GradingRead) => {
        const p = await active(conceptId, read, false);
        const result: {
          section: string;
          receiptId: string;
          actionAt: string;
        }[] = [];
        for (const section of p.requiredSections.filter(
          (s) => s !== 'PRACTICE',
        )) {
          const rows = await store.actions(claim.sub, conceptId, section, read);
          for (const pair of rows) {
            if (section === 'VISUALIZE') {
              const c = visualChallengeRecord.parse(pair.challenge),
                r = visualReceiptRecord.parse(pair.receipt);
              if (
                !c.userId.equals(r.userId) ||
                r.userId.toHexString() !== claim.sub ||
                !r.conceptId.equals(c.conceptId) ||
                r.conceptId.toHexString() !== conceptId ||
                !r.challengeId.equals(c._id) ||
                !c.receiptId?.equals(r._id)
              )
                throw evidenceUnavailable();
              if (
                c.state !== 'CONSUMED' ||
                r.outcome !== 'CORRECT' ||
                c.issuedAt < p.approvedAt! ||
                c.conceptRevision !== p.conceptRevision ||
                r.conceptRevision !== p.conceptRevision ||
                c.definitionId.toHexString() !== p.checkpointDefinitionId ||
                !r.definitionId.equals(c.definitionId) ||
                r.definitionFingerprint !== p.checkpointFingerprint ||
                c.definitionFingerprint !== p.checkpointFingerprint ||
                r.visualizationRevision !== p.visualizationRevision ||
                c.visualizationRevision !== p.visualizationRevision
              )
                continue;
              const d = await checkpoints.definition(
                { _id: c.definitionId },
                read,
              );
              if (
                !d ||
                r.requestFingerprint !==
                  checkpointResponseFingerprint(c, d.expectedChoiceId) ||
                JSON.stringify(checkpointBinding(c)) !==
                  JSON.stringify(checkpointBinding(d)) ||
                JSON.stringify(checkpointBinding(r)) !==
                  JSON.stringify(checkpointBinding(d)) ||
                c.requestFingerprint !== checkpointIssueFingerprint(c) ||
                r.respondedAt.getTime() !== c.consumedAt?.getTime() ||
                r.respondedAt < c.issuedAt ||
                r.respondedAt >= c.expiresAt ||
                r.respondedAt > new Date()
              )
                throw evidenceUnavailable();
              if (!result.some((v) => v.section === section))
                result.push({
                  section,
                  receiptId: r._id.toHexString(),
                  actionAt: r.respondedAt.toISOString(),
                });
              continue;
            }
            const c = acknowledgementChallengeRecord.parse(pair.challenge),
              r = acknowledgementReceiptRecord.parse(pair.receipt);
            if (
              !c.userId.equals(r.userId) ||
              r.userId.toHexString() !== claim.sub ||
              !r.conceptId.equals(c.conceptId) ||
              r.conceptId.toHexString() !== conceptId ||
              !r.challengeId.equals(c._id) ||
              !c.receiptId?.equals(r._id)
            )
              throw evidenceUnavailable();
            if (
              c.state !== 'CONSUMED' ||
              c.section !== section ||
              r.section !== section ||
              c.issuedAt < p.approvedAt! ||
              c.conceptRevision !== p.conceptRevision ||
              r.conceptRevision !== p.conceptRevision
            )
              continue;
            if (
              c.sectionRevision !==
              (await store.sectionRevision(conceptId, section, read))
            )
              continue;
            if (
              r.sectionRevision !== c.sectionRevision ||
              r.policyId !== c.policyId ||
              r.requestFingerprint !== ackFingerprint(c) ||
              c.requestFingerprint !== issueFingerprint(c) ||
              r.acknowledgedAt.getTime() !== c.consumedAt?.getTime() ||
              r.acknowledgedAt < c.issuedAt ||
              r.acknowledgedAt >= c.expiresAt ||
              r.acknowledgedAt > new Date()
            )
              throw evidenceUnavailable();
            if (!result.some((v) => v.section === section))
              result.push({
                section,
                receiptId: r._id.toHexString(),
                actionAt: r.acknowledgedAt.toISOString(),
              });
          }
        }
        o.assert();
        return result;
      };
      return repository.transact(readActions, async (value, read) => {
        if (JSON.stringify(await readActions(read)) !== JSON.stringify(value))
          throw evidenceUnavailable();
      });
    },
    // Internal consumers get behavior, not a serializable credential or writable registry.
    authority(conceptId: string) {
      const o = origin(conceptId);
      return Object.freeze({
        assert: () => {
          o.assert();
          if (!o.sealed) throw evidenceUnavailable();
        },
        current: (read: GradingRead, fence: boolean) =>
          active(conceptId, read, fence),
        ready: (ms: number) => store.ready(ms),
        toJSON: () => {
          throw evidenceUnavailable();
        },
      });
    },
    dispose() {
      for (const value of origins.values()) value.dead = true;
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
}

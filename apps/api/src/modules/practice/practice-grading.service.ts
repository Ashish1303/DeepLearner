import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { AccessTokens } from '../auth/access-token.service.js';
import { evaluateOutputGrading } from './output-grading.js';
import {
  commandData,
  correlationId,
  definitionFingerprint,
  gradingId,
  gradingDigest,
  positiveVersion,
  rubricDefinition,
  rubricAuthority,
  rubricText,
  sha256,
  type RubricDefinition,
  type RubricAuthority,
} from './practice-rubric.model.js';
import {
  assessmentRecord,
  type AssessmentRecord,
} from './practice-assessment.model.js';
import { attemptRecord, type AttemptRecord } from './practice-attempt.model.js';
import {
  createGradingRepository,
  assessmentIdentity,
  unconfirmedAssessment,
  type GradingRepository,
} from './practice-assessment.repository.js';
import {
  gradingUnavailable,
  gradingConflict,
  gradingHidden,
  type GradingRead,
} from './practice-rubric.repository.js';

const versionCommand = z.strictObject({
  rubricId: gradingId,
  version: positiveVersion,
});
const gradeCommand = z.strictObject({
  attemptId: gradingId,
  rubricId: gradingId,
  rubricVersion: positiveVersion,
});
const draftCommand = z.strictObject({
  rubricId: gradingId.optional(),
  questionId: gradingId,
  conceptId: gradingId,
  questionRevision: gradingDigest,
  type: z.literal('OUTPUT'),
  answerForm: z.literal('TEXT'),
  comparison: z.literal('EXACT_TEXT'),
  normalization: z.literal('NONE'),
  expectedAnswer: rubricText,
});
const denied = () =>
  new AppError(403, 'AUTH_FORBIDDEN', 'Current authorized account required');
function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  try {
    return schema.parse(commandData(input));
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid diagnostic command');
  }
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const reference = (id: string) => new Types.ObjectId(id);
const definitionReceipt = (r: RubricDefinition) => ({
  id: r._id.toHexString(),
  rubricId: r.rubricId.toHexString(),
  version: r.version,
});
const authorityReceipt = (r: RubricAuthority) => ({
  rubricId: r.rubricId.toHexString(),
  version: r.version,
  state: r.state,
});
const assessmentReceipt = (r: AssessmentRecord) => ({
  id: r._id.toHexString(),
  attemptId: r.attemptId.toHexString(),
  purpose: r.purpose,
  outcome: r.outcome,
  score: r.score,
  refusalCode: r.refusalCode,
  evaluatedAt: r.evaluatedAt.toISOString(),
});

/** Only internal callers, with the existing server verifier. No route, job or
 * submission hook instantiates this factory. Diagnostic results are not evidence. */
export function createPracticeGradingService(
  tokens: Pick<AccessTokens, 'verify'>,
  config: { APP_ENV: string },
  repository: GradingRepository = createGradingRepository(),
) {
  const store = repository.store;
  async function caller(token: unknown, role: 'ADMIN' | 'STUDENT') {
    if (config.APP_ENV !== 'LOCAL')
      throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
    if (
      typeof token !== 'string' ||
      token.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      throw new AppError(
        401,
        'AUTH_ACCESS_TOKEN_INVALID',
        'Invalid access token',
      );
    try {
      const claim = await tokens.verify(token);
      if (claim.role !== role || !gradingId.safeParse(claim.sub).success)
        throw denied();
      return claim;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        401,
        'AUTH_ACCESS_TOKEN_INVALID',
        'Invalid access token',
      );
    }
  }
  async function definition(
    id: Types.ObjectId,
    version: number,
    read: GradingRead,
  ) {
    const row = await store.definition(id, version, read);
    if (!row) throw gradingHidden();
    const d = rubricDefinition.parse(row);
    if (!d.rubricId.equals(id) || d.version !== version)
      throw gradingUnavailable();
    return d;
  }
  async function current(d: RubricDefinition, read: GradingRead) {
    const content = await store.qualified(
      d.questionId.toHexString(),
      d.conceptId.toHexString(),
      read,
    );
    if (!content) throw gradingHidden();
    if (
      content.data.type !== 'OUTPUT' ||
      content.data.id !== d.questionId.toHexString() ||
      content.data.conceptId !== d.conceptId.toHexString() ||
      content.questionRevision !== d.questionRevision ||
      content.contentFingerprint !== d.contentFingerprint
    )
      throw gradingConflict();
    return content;
  }
  async function provenance(
    d: RubricDefinition,
    value: RubricAuthority,
    read: GradingRead,
    allowRevoked = false,
  ) {
    const a = rubricAuthority.parse(value);
    if (
      !a.rubricId.equals(d.rubricId) ||
      a.version !== d.version ||
      !a.definitionId.equals(d._id) ||
      a.definitionFingerprint !== d.definitionFingerprint ||
      !a.authorId.equals(d.authorId) ||
      a.approvedAt < d.createdAt
    )
      throw gradingUnavailable();
    if (!allowRevoked && a.state !== 'APPROVED') throw denied();
    if (!allowRevoked)
      await store.actor(a.reviewerId.toHexString(), 'ADMIN', read);
    await store.auditProof(
      d,
      d.authorId,
      'PRACTICE_RUBRIC_AUTHORED',
      d.createdAt,
      read,
    );
    await store.auditProof(
      d,
      a.reviewerId,
      'PRACTICE_RUBRIC_APPROVED',
      a.approvedAt,
      read,
      a.approvalAuditId,
    );
    if (a.state === 'REVOKED')
      await store.auditProof(
        d,
        a.revokedBy!,
        'PRACTICE_RUBRIC_REVOKED',
        a.revokedAt!,
        read,
        a.revocationAuditId!,
      );
    return a;
  }
  async function ownedAttempt(
    id: Types.ObjectId,
    owner: Types.ObjectId,
    read: GradingRead,
  ) {
    const value = await store.attempt(id, owner, read);
    if (!value) throw gradingHidden();
    const row = attemptRecord.parse(value);
    if (
      row.requestFingerprint !==
      sha256([
        'F036-request-v1',
        row.userId.toHexString(),
        row.questionId.toHexString(),
        row.conceptId.toHexString(),
        row.questionRevision,
        row.studentAnswer,
      ])
    )
      throw gradingUnavailable();
    if (
      !row._id.equals(id) ||
      !row.userId.equals(owner) ||
      row.type !== 'OUTPUT'
    )
      throw gradingHidden();
    return row;
  }
  function boundAttempt(a: AttemptRecord, d: RubricDefinition) {
    if (
      !a.questionId.equals(d.questionId) ||
      !a.conceptId.equals(d.conceptId) ||
      a.type !== d.type ||
      a.questionRevision !== d.questionRevision ||
      a.contentFingerprint !== d.contentFingerprint
    )
      throw gradingConflict();
  }
  function evaluate(a: AttemptRecord, d: RubricDefinition) {
    const result = evaluateOutputGrading({
      schemaVersion: 1,
      question: {
        id: d.questionId.toHexString(),
        conceptId: d.conceptId.toHexString(),
        type: d.type,
        questionRevision: d.questionRevision,
        contentFingerprint: d.contentFingerprint,
        rubricId: d.rubricId.toHexString(),
        rubricVersion: d.version,
      },
      rubric: {
        schemaVersion: 1,
        id: d.rubricId.toHexString(),
        version: d.version,
        approval: 'APPROVED',
        questionId: d.questionId.toHexString(),
        conceptId: d.conceptId.toHexString(),
        type: d.type,
        questionRevision: d.questionRevision,
        contentFingerprint: d.contentFingerprint,
        answerForm: d.answerForm,
        comparison: d.comparison,
        normalization: d.normalization,
        expectedAnswer: d.expectedAnswer,
      },
      studentAnswer: a.studentAnswer,
    });
    if (result.status === 'REFUSED') {
      if (result.code !== 'INVALID_ANSWER') throw gradingUnavailable();
      return {
        outcome: 'REFUSED' as const,
        score: null,
        refusalCode: 'INVALID_ANSWER' as const,
      };
    }
    return { outcome: result.outcome, score: result.score, refusalCode: null };
  }
  function requestFingerprint(a: AttemptRecord, d: RubricDefinition) {
    return sha256([
      'F038-assessment-v1',
      a.userId.toHexString(),
      a._id.toHexString(),
      a.requestFingerprint,
      a.questionId.toHexString(),
      a.conceptId.toHexString(),
      a.questionRevision,
      a.contentFingerprint,
      d.rubricId.toHexString(),
      d.version,
      d.definitionFingerprint,
      'OUTPUT_EXACT_TEXT',
      1,
    ]);
  }
  function verifyAssessment(
    row: AssessmentRecord,
    a: AttemptRecord,
    d: RubricDefinition,
    authority: RubricAuthority,
  ) {
    assessmentRecord.parse(row);
    boundAttempt(a, d);
    if (
      !row.userId.equals(a.userId) ||
      !row.attemptId.equals(a._id) ||
      !row.questionId.equals(a.questionId) ||
      !row.conceptId.equals(a.conceptId) ||
      row.questionRevision !== a.questionRevision ||
      row.contentFingerprint !== a.contentFingerprint ||
      row.attemptRequestFingerprint !== a.requestFingerprint ||
      !row.rubricId.equals(d.rubricId) ||
      row.rubricVersion !== d.version ||
      row.rubricDefinitionFingerprint !== d.definitionFingerprint ||
      !row.authorityId.equals(authority._id) ||
      !row.reviewerId.equals(authority.reviewerId) ||
      !row.approvalAuditId.equals(authority.approvalAuditId) ||
      row.authorizationFence > authority.decisionFence ||
      row.requestFingerprint !== requestFingerprint(a, d) ||
      !same(
        {
          outcome: row.outcome,
          score: row.score,
          refusalCode: row.refusalCode,
        },
        evaluate(a, d),
      )
    )
      throw gradingConflict();
  }
  return {
    async author(token: unknown, body: unknown, request: unknown) {
      const claim = await caller(token, 'ADMIN'),
        input = parse(draftCommand, body),
        requestId = parse(correlationId, request);
      // Server-derived logical author-command identity makes explicit retries safe.
      const id = reference(
        sha256(['F038-rubric-command-v1', claim.sub, requestId]).slice(0, 24),
      );
      const family = input.rubricId
        ? reference(input.rubricId)
        : reference(
            sha256(['F038-rubric-family-v1', claim.sub, requestId]).slice(
              0,
              24,
            ),
          );
      const time = new Date(),
        auditId = new Types.ObjectId();
      const result = await repository.transact(
        async (read) => {
          await store.actor(claim.sub, 'ADMIN', read);
          const content = await store.qualified(
            input.questionId,
            input.conceptId,
            read,
          );
          if (!content) throw gradingHidden();
          if (
            content.data.type !== 'OUTPUT' ||
            content.data.id !== input.questionId ||
            content.data.conceptId !== input.conceptId ||
            content.questionRevision !== input.questionRevision
          )
            throw gradingConflict();
          const existing = await store.definitionById(id, read);
          const last = await store.lastVersion(family, read);
          if (input.rubricId && !existing && last === 0) throw gradingHidden();
          const version = existing?.version ?? last + 1;
          const base = {
            _id: id,
            rubricId: family,
            version,
            questionId: reference(input.questionId),
            conceptId: reference(input.conceptId),
            type: input.type,
            questionRevision: input.questionRevision,
            contentFingerprint: content.contentFingerprint,
            answerForm: input.answerForm,
            comparison: input.comparison,
            normalization: input.normalization,
            expectedAnswer: input.expectedAnswer,
            authorId: reference(claim.sub),
            createdAt: existing?.createdAt ?? time,
            schemaVersion: 1 as const,
          };
          const row = rubricDefinition.parse({
            ...base,
            definitionFingerprint: definitionFingerprint({
              ...base,
              definitionFingerprint: '0'.repeat(64),
            }),
          });
          if (existing) {
            if (!same(row, rubricDefinition.parse(existing)))
              throw gradingConflict();
            return row;
          }
          await store.insertDefinition(row, read);
          await store.audit(
            {
              id: auditId,
              action: 'PRACTICE_RUBRIC_AUTHORED',
              actorId: row.authorId,
              definitionId: row._id,
              rubricVersion: row.version,
              requestId,
              createdAt: time,
            },
            read,
          );
          return row;
        },
        async (row, read) => {
          await caller(token, 'ADMIN');
          await store.actor(claim.sub, 'ADMIN', read);
          const proof = await store.definitionById(row._id, read);
          if (!proof || !same(rubricDefinition.parse(proof), row))
            throw unconfirmedAssessment();
          await current(row, read);
          await store.auditProof(
            row,
            row.authorId,
            'PRACTICE_RUBRIC_AUTHORED',
            row.createdAt,
            read,
          );
        },
      );
      return definitionReceipt(result);
    },
    async approve(token: unknown, body: unknown, request: unknown) {
      const claim = await caller(token, 'ADMIN'),
        input = parse(versionCommand, body),
        requestId = parse(correlationId, request);
      const time = new Date(),
        auditId = new Types.ObjectId(),
        authorityId = new Types.ObjectId();
      const result = await repository.transact(
        async (read) => {
          await store.actor(claim.sub, 'ADMIN', read);
          const d = await definition(
            reference(input.rubricId),
            input.version,
            read,
          );
          if (d.authorId.toHexString() === claim.sub) throw denied();
          await store.actor(d.authorId.toHexString(), 'ADMIN', read);
          await current(d, read);
          await store.auditProof(
            d,
            d.authorId,
            'PRACTICE_RUBRIC_AUTHORED',
            d.createdAt,
            read,
          );
          const existing = await store.authority(d.rubricId, d.version, read);
          if (existing) return provenance(d, existing, read);
          const row = rubricAuthority.parse({
            _id: authorityId,
            rubricId: d.rubricId,
            version: d.version,
            definitionId: d._id,
            definitionFingerprint: d.definitionFingerprint,
            authorId: d.authorId,
            reviewerId: reference(claim.sub),
            approvedAt: time,
            approvalAuditId: auditId,
            state: 'APPROVED',
            decisionFence: 0,
            revokedBy: null,
            revokedAt: null,
            revocationAuditId: null,
            schemaVersion: 1,
          });
          await store.insertAuthority(row, read);
          await store.audit(
            {
              id: auditId,
              action: 'PRACTICE_RUBRIC_APPROVED',
              actorId: row.reviewerId,
              definitionId: d._id,
              rubricVersion: d.version,
              requestId,
              createdAt: time,
            },
            read,
          );
          return row;
        },
        async (row, read) => {
          await caller(token, 'ADMIN');
          await store.actor(claim.sub, 'ADMIN', read);
          const d = await definition(row.rubricId, row.version, read),
            a = await store.authority(row.rubricId, row.version, read);
          if (!a) throw unconfirmedAssessment();
          await provenance(d, a, read);
          await current(d, read);
          // Fences may advance after approval; immutable approval identity must match.
          if (
            !a._id.equals(row._id) ||
            !a.approvalAuditId.equals(row.approvalAuditId)
          )
            throw unconfirmedAssessment();
        },
      );
      return authorityReceipt(result);
    },
    async revoke(token: unknown, body: unknown, request: unknown) {
      const claim = await caller(token, 'ADMIN'),
        input = parse(versionCommand, body),
        requestId = parse(correlationId, request);
      const time = new Date(),
        auditId = new Types.ObjectId();
      const result = await repository.transact(
        async (read) => {
          await store.actor(claim.sub, 'ADMIN', read);
          const d = await definition(
              reference(input.rubricId),
              input.version,
              read,
            ),
            a = await store.authority(d.rubricId, d.version, read);
          if (!a) throw gradingHidden();
          await provenance(d, a, read, true);
          if (a.state === 'REVOKED') return a;
          const next = await store.fence(a, read, {
            actor: reference(claim.sub),
            time,
            auditId,
          });
          await store.audit(
            {
              id: auditId,
              action: 'PRACTICE_RUBRIC_REVOKED',
              actorId: reference(claim.sub),
              definitionId: d._id,
              rubricVersion: d.version,
              requestId,
              createdAt: time,
            },
            read,
          );
          return next;
        },
        async (row, read) => {
          await caller(token, 'ADMIN');
          await store.actor(claim.sub, 'ADMIN', read);
          const d = await definition(row.rubricId, row.version, read),
            a = await store.authority(row.rubricId, row.version, read);
          if (!a || !same(a, row)) throw unconfirmedAssessment();
          await provenance(d, a, read, true);
        },
      );
      return authorityReceipt(result);
    },
    async gradeDiagnostic(token: unknown, body: unknown, request: unknown) {
      const claim = await caller(token, 'STUDENT'),
        input = parse(gradeCommand, body);
      parse(correlationId, request);
      const owner = reference(claim.sub),
        attemptId = reference(input.attemptId),
        id = new Types.ObjectId(),
        time = new Date();
      const result = await repository.transact(
        async (read) => {
          await store.actor(claim.sub, 'STUDENT', read);
          const attempt = await ownedAttempt(attemptId, owner, read),
            d = await definition(
              reference(input.rubricId),
              input.rubricVersion,
              read,
            );
          boundAttempt(attempt, d);
          await current(d, read);
          const authority = await store.authority(d.rubricId, d.version, read);
          if (!authority) throw denied();
          const a = await provenance(d, authority, read);
          const identity = assessmentIdentity({
            userId: owner,
            attemptId,
            rubricId: d.rubricId,
            rubricVersion: d.version,
            graderId: 'OUTPUT_EXACT_TEXT',
            graderVersion: 1,
          });
          const existing = await store.assessment(identity, read);
          if (existing) verifyAssessment(existing, attempt, d, a);
          const fence = await store.fence(a, read);
          if (existing) return existing;
          const row = assessmentRecord.parse({
            _id: id,
            ...identity,
            questionId: attempt.questionId,
            conceptId: attempt.conceptId,
            type: 'OUTPUT',
            questionRevision: attempt.questionRevision,
            contentFingerprint: attempt.contentFingerprint,
            attemptRequestFingerprint: attempt.requestFingerprint,
            rubricDefinitionFingerprint: d.definitionFingerprint,
            purpose: 'DIAGNOSTIC',
            ...evaluate(attempt, d),
            evaluatedAt: time,
            requestedBy: owner,
            authorityId: a._id,
            reviewerId: a.reviewerId,
            approvalAuditId: a.approvalAuditId,
            authorizationFence: fence.decisionFence,
            requestFingerprint: requestFingerprint(attempt, d),
            schemaVersion: 1,
          });
          await store.insertAssessment(row, read);
          return row;
        },
        async (row, read) => {
          await caller(token, 'STUDENT');
          await store.actor(claim.sub, 'STUDENT', read);
          const proof = await store.assessmentProof(row._id, owner, read);
          if (!proof || !same(assessmentRecord.parse(proof), row))
            throw unconfirmedAssessment();
          const a = await ownedAttempt(attemptId, owner, read),
            d = await definition(row.rubricId, row.rubricVersion, read);
          const authority = await store.authority(d.rubricId, d.version, read);
          if (!authority) throw unconfirmedAssessment();
          await provenance(d, authority, read);
          await current(d, read);
          verifyAssessment(row, a, d, authority);
        },
        async (read) => {
          await store.actor(claim.sub, 'STUDENT', read);
          await ownedAttempt(attemptId, owner, read);
        },
      );
      return assessmentReceipt(result);
    },
  };
}

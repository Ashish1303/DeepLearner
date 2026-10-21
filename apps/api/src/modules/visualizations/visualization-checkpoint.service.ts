import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { AccessTokens } from '../auth/access-token.service.js';
import { idempotencyKey } from '../practice/practice.schema.js';
import {
  evidenceCorrelation,
  evidenceData,
  evidenceHash,
  evidenceId,
  evidenceLifetime,
} from '../progress/section-evidence-revision.js';
import {
  visualChallengeRecord,
  type VisualChallenge,
} from '../progress/section-evidence-challenge.model.js';
import {
  visualReceiptRecord,
  type VisualReceipt,
} from '../progress/section-evidence-receipt.model.js';
import {
  challengeHidden,
  challengeUnavailable,
  evidenceConflict,
  evidenceUnavailable,
  evidenceUnconfirmed,
  type EvidenceRead,
} from '../progress/section-evidence.repository.js';
import {
  checkpointDefinitionRecord,
  checkpointChoices,
  checkpointText,
  type CheckpointDefinition,
} from './visualization-checkpoint-definition.model.js';
import {
  checkpointBinding,
  checkpointChoiceId,
  checkpointPolicy,
  checkpointToken,
  definitionFingerprint,
  sameCheckpointData as same,
} from './visualization-checkpoint-revision.js';
import {
  createCheckpointRepository,
  checkpointHidden,
  checkpointConflict,
  checkpointLimit,
  type CheckpointRepository,
} from './visualization-checkpoint.repository.js';
import { verifyVisualizationCheckpoint } from './checkpoint-verification.js';

const definitionCommand = z.strictObject({ definitionId: evidenceId });
const authorCommand = z.strictObject({
  conceptId: evidenceId,
  visualizationId: evidenceId,
  checkpointId: z.string().regex(checkpointToken),
  checkpointVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  prompt: checkpointText(2000),
  textAlternative: checkpointText(4000),
  choices: checkpointChoices,
  expectedChoiceId: z.string().max(64),
});
const issueCommand = definitionCommand.extend({ idempotencyKey });
const submitCommand = z.strictObject({
  challengeId: evidenceId,
  selectedChoiceId: z.string().regex(checkpointChoiceId),
  idempotencyKey,
});
const withdrawCommand = z.strictObject({ challengeId: evidenceId });
function invalid() {
  return new AppError(400, 'VALIDATION_ERROR', 'Invalid checkpoint command');
}
function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  try {
    return schema.parse(evidenceData(value));
  } catch {
    throw invalid();
  }
}
function nextFence(n: number) {
  if (!Number.isSafeInteger(n) || n < 0 || n >= Number.MAX_SAFE_INTEGER)
    throw evidenceUnavailable();
  return n + 1;
}
export const checkpointIssueFingerprint = (
  c: Pick<
    VisualChallenge,
    | 'userId'
    | 'definitionId'
    | 'definitionFingerprint'
    | 'conceptRevision'
    | 'visualizationRevision'
    | 'checkpointId'
    | 'checkpointVersion'
    | 'policyId'
    | 'policyVersion'
    | 'verifierVersion'
  >,
) =>
  evidenceHash([
    'F038-C3b-issue-request-v1',
    c.userId.toHexString(),
    c.definitionId.toHexString(),
    c.definitionFingerprint,
    c.conceptRevision,
    c.visualizationRevision,
    c.checkpointId,
    c.checkpointVersion,
    c.policyId,
    c.policyVersion,
    c.verifierVersion,
  ]);
export const checkpointResponseFingerprint = (
  c: VisualChallenge,
  choice: string,
) =>
  evidenceHash([
    'F038-C3b-response-request-v1',
    c.userId.toHexString(),
    c._id.toHexString(),
    c.definitionId.toHexString(),
    c.definitionFingerprint,
    c.conceptRevision,
    c.visualizationRevision,
    c.checkpointId,
    c.checkpointVersion,
    c.policyId,
    c.policyVersion,
    c.verifierVersion,
    choice,
  ]);
const adminDto = (d: CheckpointDefinition) => ({
  id: d._id.toHexString(),
  state: d.state,
});
const issueDto = (c: VisualChallenge, d: CheckpointDefinition) => ({
  id: c._id.toHexString(),
  conceptId: c.conceptId.toHexString(),
  visualizationId: c.visualizationId.toHexString(),
  checkpointId: c.checkpointId,
  checkpointVersion: c.checkpointVersion,
  policyId: c.policyId,
  policyVersion: c.policyVersion,
  prompt: d.prompt,
  textAlternative: d.textAlternative,
  choices: d.choices.map((v) => ({ id: v.id, label: v.label })),
  expiresAt: c.expiresAt.toISOString(),
});
const receiptDto = (r: VisualReceipt) => ({
  id: r._id.toHexString(),
  conceptId: r.conceptId.toHexString(),
  visualizationId: r.visualizationId.toHexString(),
  checkpointId: r.checkpointId,
  checkpointVersion: r.checkpointVersion,
  outcome: r.outcome,
  respondedAt: r.respondedAt.toISOString(),
  completionQualification: 'NOT_ESTABLISHED' as const,
});

/** Explicit server construction only; no route, UI, job or automatic caller.
 * Definition approval is a current server-side authorization decision, not a flag. */
export function createVisualizationCheckpointService(
  tokens: Pick<AccessTokens, 'verify'>,
  config: { APP_ENV: string },
  repository: CheckpointRepository = createCheckpointRepository(),
  now = () => new Date(),
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
      if (claim.role !== role || !evidenceId.safeParse(claim.sub).success)
        throw new AppError(
          403,
          'AUTH_FORBIDDEN',
          'Current eligible actor required',
        );
      return new Types.ObjectId(claim.sub);
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(
        401,
        'AUTH_ACCESS_TOKEN_INVALID',
        'Invalid access token',
      );
    }
  }
  function time() {
    const t = now();
    if (
      !(t instanceof Date) ||
      !Number.isFinite(t.getTime()) ||
      t.getTime() < 0
    )
      throw evidenceUnavailable();
    return new Date(t);
  }
  async function definition(id: Types.ObjectId, read: EvidenceRead) {
    const d = await store.definition({ _id: id }, read);
    if (!d || !d._id.equals(id)) throw checkpointHidden();
    checkpointDefinitionRecord.parse(d);
    const t = time();
    if (
      d.authoredAt > t ||
      (d.approvedAt && d.approvedAt > t) ||
      (d.revokedAt && d.revokedAt > t)
    )
      throw evidenceUnavailable();
    return d;
  }
  async function current(
    d: CheckpointDefinition,
    read: EvidenceRead,
    approved = true,
  ) {
    if (d.state === 'REVOKED' || (approved && d.state !== 'APPROVED'))
      throw checkpointHidden();
    await store.admin(d.authoredBy, read);
    if (d.approvedBy) await store.admin(d.approvedBy, read);
    const source = await store.source(d.conceptId, d.visualizationId, read);
    if (
      source.conceptRevision !== d.conceptRevision ||
      source.visualizationRevision !== d.visualizationRevision
    )
      throw challengeUnavailable();
  }
  async function proofDefinition(
    expected: CheckpointDefinition,
    read: EvidenceRead,
    source = true,
  ) {
    const d = await definition(expected._id, read);
    if (
      !same({ ...d, decisionFence: expected.decisionFence }, expected) ||
      d.decisionFence < expected.decisionFence
    )
      throw evidenceUnconfirmed();
    if (source) await current(d, read, false);
    return d;
  }
  function valid(
    c: VisualChallenge,
    owner: Types.ObjectId,
    allowExpired = false,
  ) {
    visualChallengeRecord.parse(c);
    if (!c.userId.equals(owner)) throw challengeHidden();
    if (c.requestFingerprint !== checkpointIssueFingerprint(c))
      throw evidenceUnavailable();
    const t = time();
    if (
      c.issuedAt > t ||
      (c.consumedAt && c.consumedAt > t) ||
      (c.revokedAt && c.revokedAt > t)
    )
      throw evidenceUnavailable();
    if (!allowExpired && (c.state === 'REVOKED' || t >= c.expiresAt))
      throw challengeUnavailable();
  }
  async function challenge(
    owner: Types.ObjectId,
    id: Types.ObjectId,
    read: EvidenceRead,
    allowExpired = false,
  ) {
    const c = await store.visualChallenge(owner, { _id: id }, read);
    if (!c || !c._id.equals(id)) throw challengeHidden();
    valid(c, owner, allowExpired);
    return c;
  }
  function bound(c: VisualChallenge, d: CheckpointDefinition) {
    if (
      !c.definitionId.equals(d._id) ||
      c.definitionFingerprint !== d.definitionFingerprint ||
      !same(checkpointBinding(c), checkpointBinding(d)) ||
      c.verifierVersion !== d.verifierVersion
    )
      throw evidenceUnconfirmed();
  }
  async function proofChallenge(
    expected: VisualChallenge,
    owner: Types.ObjectId,
    read: EvidenceRead,
    restricted = false,
  ) {
    await store.actor(owner, read);
    const c = await challenge(owner, expected._id, read, restricted);
    if (
      !same({ ...c, decisionFence: expected.decisionFence }, expected) ||
      c.decisionFence < expected.decisionFence
    )
      throw evidenceUnconfirmed();
    return c;
  }
  function linked(
    r: VisualReceipt,
    c: VisualChallenge,
    choice: string,
    outcome: 'CORRECT' | 'INCORRECT',
  ) {
    visualReceiptRecord.parse(r);
    if (
      c.state !== 'CONSUMED' ||
      !c.receiptId?.equals(r._id) ||
      !r.userId.equals(c.userId) ||
      !r.challengeId.equals(c._id) ||
      !r.definitionId.equals(c.definitionId) ||
      r.definitionFingerprint !== c.definitionFingerprint ||
      !same(checkpointBinding(r), checkpointBinding(c)) ||
      r.verifierVersion !== c.verifierVersion ||
      r.requestFingerprint !== checkpointResponseFingerprint(c, choice) ||
      !same(r.respondedAt, c.consumedAt) ||
      r.outcome !== outcome
    )
      throw evidenceUnconfirmed();
  }
  async function fenced(d: CheckpointDefinition, read: EvidenceRead) {
    const next = { ...d, decisionFence: nextFence(d.decisionFence) };
    await store.fenceDefinition(d, next, read);
    return next;
  }
  async function studentScope(
    owner: Types.ObjectId,
    id: Types.ObjectId,
    read: EvidenceRead,
    isChallenge = false,
  ) {
    await store.actor(owner, read);
    const c = isChallenge ? await challenge(owner, id, read) : null;
    const d = await definition(c ? c.definitionId : id, read);
    await current(d, read);
    if (c) bound(c, d);
    return { d, c };
  }
  return {
    async author(token: unknown, input: unknown, requestId: unknown) {
      const actor = await caller(token, 'ADMIN'),
        cmd = parse(authorCommand, input),
        correlation = parse(evidenceCorrelation, requestId);
      const conceptId = new Types.ObjectId(cmd.conceptId),
        visualizationId = new Types.ObjectId(cmd.visualizationId);
      const result = await repository.transact(
        async (read) => {
          await store.admin(actor, read);
          const source = await store.source(conceptId, visualizationId, read);
          const body = {
            _id: new Types.ObjectId(),
            schemaVersion: 1 as const,
            conceptId,
            visualizationId,
            ...source,
            ...checkpointPolicy,
            checkpointId: cmd.checkpointId,
            checkpointVersion: cmd.checkpointVersion,
            responseType: 'SINGLE_CHOICE' as const,
            choices: cmd.choices,
            expectedChoiceId: cmd.expectedChoiceId,
            prompt: cmd.prompt,
            textAlternative: cmd.textAlternative,
            authoredBy: actor,
            authoredAt: time(),
            authorRequestId: correlation,
            state: 'DRAFT' as const,
            decisionFence: 0,
            approvedBy: null,
            approvedAt: null,
            approvedFingerprint: null,
            revokedBy: null,
            revokedAt: null,
          };
          const parsed = checkpointDefinitionRecord.safeParse({
            ...body,
            definitionFingerprint: definitionFingerprint(body),
          });
          if (!parsed.success) throw invalid();
          const candidate = parsed.data;
          const existing = await store.definition(
            {
              visualizationId,
              checkpointId: cmd.checkpointId,
              checkpointVersion: cmd.checkpointVersion,
            },
            read,
          );
          if (existing) {
            if (
              !existing.authoredBy.equals(actor) ||
              existing.definitionFingerprint !== candidate.definitionFingerprint
            )
              throw checkpointConflict();
            await current(existing, read, false);
            return fenced(existing, read);
          }
          await store.insertDefinition(candidate, read);
          return candidate;
        },
        async (d, read) => {
          await store.admin(actor, read);
          await proofDefinition(d, read);
        },
        async (read) => {
          await store.admin(actor, read);
          await store.source(conceptId, visualizationId, read);
        },
      );
      return adminDto(result);
    },
    async approve(token: unknown, input: unknown, requestId: unknown) {
      const actor = await caller(token, 'ADMIN'),
        cmd = parse(definitionCommand, input);
      parse(evidenceCorrelation, requestId);
      const id = new Types.ObjectId(cmd.definitionId);
      const result = await repository.transact(
        async (read) => {
          await store.admin(actor, read);
          const d = await definition(id, read);
          await current(d, read, false);
          if (actor.equals(d.authoredBy))
            throw new AppError(
              403,
              'AUTH_FORBIDDEN',
              'Independent reviewer required',
            );
          if (d.state === 'APPROVED') {
            if (!d.approvedBy?.equals(actor)) throw checkpointConflict();
            return fenced(d, read);
          }
          const next = checkpointDefinitionRecord.parse({
            ...d,
            state: 'APPROVED',
            decisionFence: nextFence(d.decisionFence),
            approvedBy: actor,
            approvedAt: time(),
            approvedFingerprint: d.definitionFingerprint,
          });
          await store.fenceDefinition(d, next, read);
          return next;
        },
        async (d, read) => {
          await store.admin(actor, read);
          await proofDefinition(d, read);
        },
        async (read) => {
          await store.admin(actor, read);
          await current(await definition(id, read), read, false);
        },
      );
      return adminDto(result);
    },
    async revokeDefinition(token: unknown, input: unknown, requestId: unknown) {
      const actor = await caller(token, 'ADMIN'),
        cmd = parse(definitionCommand, input);
      parse(evidenceCorrelation, requestId);
      const id = new Types.ObjectId(cmd.definitionId);
      const result = await repository.transact(
        async (read) => {
          await store.admin(actor, read);
          const d = await definition(id, read);
          if (d.state === 'REVOKED') return d;
          const next = checkpointDefinitionRecord.parse({
            ...d,
            state: 'REVOKED',
            decisionFence: nextFence(d.decisionFence),
            revokedBy: actor,
            revokedAt: time(),
          });
          await store.fenceDefinition(d, next, read);
          return next;
        },
        async (d, read) => {
          await store.admin(actor, read);
          await proofDefinition(d, read, false);
        },
        (read) => store.admin(actor, read),
      );
      return adminDto(result);
    },
    async issue(token: unknown, input: unknown, requestId: unknown) {
      const owner = await caller(token, 'STUDENT'),
        cmd = parse(issueCommand, input),
        correlation = parse(evidenceCorrelation, requestId),
        id = new Types.ObjectId(cmd.definitionId);
      const issueKeyHash = evidenceHash([
        'F038-C3b-issue-key-v1',
        owner.toHexString(),
        cmd.idempotencyKey,
      ]);
      const result = await repository.transact(
        async (read) => {
          const { d } = await studentScope(owner, id, read);
          const nextD = await fenced(d, read);
          const existing = await store.visualChallenge(
            owner,
            { issueKeyHash },
            read,
          );
          if (existing) {
            if (
              existing.issueKeyHash !== issueKeyHash ||
              !existing.definitionId.equals(id)
            )
              throw evidenceConflict();
            bound(existing, d);
            valid(existing, owner);
            if (existing.state !== 'AVAILABLE') throw challengeUnavailable();
            const c = {
              ...existing,
              decisionFence: nextFence(existing.decisionFence),
            };
            await store.fenceVisual(existing, c, read);
            return { d: nextD, c };
          }
          const prior = await store.issues(owner, id, read);
          const issuedAt = time();
          for (const c of prior) {
            valid(c, owner, true);
            bound(c, d);
          }
          if (prior.length > 3) throw evidenceUnavailable();
          if (prior.length >= 3) throw checkpointLimit();
          if (
            prior.some((c) => c.state === 'AVAILABLE' && issuedAt < c.expiresAt)
          )
            throw checkpointConflict();
          const binding = {
            userId: owner,
            conceptId: d.conceptId,
            section: 'VISUALIZE',
            schemaVersion: 2,
            producerVersion: 1,
            ...checkpointPolicy,
            conceptRevision: d.conceptRevision,
            sectionRevision: d.visualizationRevision,
            definitionId: d._id,
            definitionFingerprint: d.definitionFingerprint,
            visualizationId: d.visualizationId,
            visualizationRevision: d.visualizationRevision,
            checkpointId: d.checkpointId,
            checkpointVersion: d.checkpointVersion,
          } as const;
          const c = visualChallengeRecord.parse({
            ...binding,
            _id: new Types.ObjectId(),
            issueKeyHash,
            requestFingerprint: checkpointIssueFingerprint(binding),
            issueRequestId: correlation,
            issuedAt,
            expiresAt: new Date(issuedAt.getTime() + evidenceLifetime),
            state: 'AVAILABLE',
            decisionFence: 0,
            consumedAt: null,
            receiptId: null,
            revokedAt: null,
            revokedBy: null,
          });
          await store.insertVisualChallenge(c, read);
          return { d: nextD, c };
        },
        async (v, read) => {
          await proofDefinition(v.d, read);
          const c = await proofChallenge(v.c, owner, read);
          bound(c, v.d);
        },
        (read) => studentScope(owner, id, read).then(() => undefined),
      );
      return issueDto(result.c, result.d);
    },
    async submit(token: unknown, input: unknown, requestId: unknown) {
      const owner = await caller(token, 'STUDENT'),
        cmd = parse(submitCommand, input),
        correlation = parse(evidenceCorrelation, requestId),
        id = new Types.ObjectId(cmd.challengeId);
      const keyHash = evidenceHash([
        'F038-C3b-response-key-v1',
        owner.toHexString(),
        cmd.idempotencyKey,
      ]);
      const result = await repository.transact(
        async (read) => {
          const { d, c: loaded } = await studentScope(owner, id, read, true);
          const c = loaded!;
          const previous = await store.visualReceipt(
            owner,
            { ackKeyHash: keyHash },
            read,
          );
          if (
            previous &&
            (previous.ackKeyHash !== keyHash ||
              !previous.challengeId.equals(id) ||
              previous.requestFingerprint !==
                checkpointResponseFingerprint(c, cmd.selectedChoiceId))
          )
            throw evidenceConflict();
          if (!previous && c.state !== 'AVAILABLE')
            throw challengeUnavailable();
          const binding = checkpointBinding(d);
          const comparison = verifyVisualizationCheckpoint({
            schemaVersion: 1,
            expected: binding,
            definition: {
              ...binding,
              responseType: d.responseType,
              choices: d.choices,
              expectedChoiceId: d.expectedChoiceId,
            },
            response: {
              ...checkpointBinding(c),
              responseType: 'SINGLE_CHOICE',
              selectedChoiceId: cmd.selectedChoiceId,
            },
          });
          if (comparison.status !== 'EVALUATED') throw invalid();
          const outcome = comparison.outcome;
          const nextD = await fenced(d, read);
          if (previous) {
            linked(previous, c, cmd.selectedChoiceId, outcome);
            const next = { ...c, decisionFence: nextFence(c.decisionFence) };
            await store.fenceVisual(c, next, read);
            return { d: nextD, c: next, r: previous };
          }
          const respondedAt = time();
          if (respondedAt < c.issuedAt || respondedAt >= c.expiresAt)
            throw challengeUnavailable();
          const r = visualReceiptRecord.parse({
            _id: new Types.ObjectId(),
            userId: owner,
            conceptId: c.conceptId,
            challengeId: c._id,
            section: 'VISUALIZE',
            schemaVersion: 2,
            producerVersion: 1,
            ...checkpointPolicy,
            conceptRevision: c.conceptRevision,
            sectionRevision: c.sectionRevision,
            definitionId: c.definitionId,
            definitionFingerprint: c.definitionFingerprint,
            visualizationId: c.visualizationId,
            visualizationRevision: c.visualizationRevision,
            checkpointId: c.checkpointId,
            checkpointVersion: c.checkpointVersion,
            origin: 'CHECKPOINT_SERVICE',
            purpose: 'ACTIVITY_ONLY',
            ackKeyHash: keyHash,
            requestFingerprint: checkpointResponseFingerprint(
              c,
              cmd.selectedChoiceId,
            ),
            ackRequestId: correlation,
            respondedAt,
            outcome,
          });
          const next = visualChallengeRecord.parse({
            ...c,
            state: 'CONSUMED',
            decisionFence: nextFence(c.decisionFence),
            consumedAt: respondedAt,
            receiptId: r._id,
          });
          await store.fenceVisual(c, next, read);
          await store.insertVisualReceipt(r, read);
          return { d: nextD, c: next, r };
        },
        async (v, read) => {
          await proofDefinition(v.d, read);
          const c = await proofChallenge(v.c, owner, read);
          bound(c, v.d);
          const r = await store.visualReceipt(owner, { _id: v.r._id }, read);
          if (!r || !same(r, v.r)) throw evidenceUnconfirmed();
          linked(r, c, cmd.selectedChoiceId, v.r.outcome);
          valid(c, owner);
        },
        (read) => studentScope(owner, id, read, true).then(() => undefined),
      );
      return receiptDto(result.r);
    },
    async withdraw(token: unknown, input: unknown, requestId: unknown) {
      const owner = await caller(token, 'STUDENT'),
        cmd = parse(withdrawCommand, input);
      parse(evidenceCorrelation, requestId);
      const id = new Types.ObjectId(cmd.challengeId);
      const result = await repository.transact(
        async (read) => {
          await store.actor(owner, read);
          const c = await challenge(owner, id, read, true);
          if (c.state === 'REVOKED') return c;
          const next = visualChallengeRecord.parse({
            ...c,
            state: 'REVOKED',
            decisionFence: nextFence(c.decisionFence),
            revokedAt: time(),
            revokedBy: owner,
          });
          await store.fenceVisual(c, next, read);
          return next;
        },
        async (c, read) => {
          await proofChallenge(c, owner, read, true);
        },
        (read) => store.actor(owner, read),
      );
      return {
        challengeId: result._id.toHexString(),
        state: 'REVOKED' as const,
      };
    },
  };
}

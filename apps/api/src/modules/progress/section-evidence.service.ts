import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { AccessTokens } from '../auth/access-token.service.js';
import { idempotencyKey } from '../practice/practice.schema.js';
import {
  acknowledgementChallengeRecord,
  type EvidenceChallenge,
} from './section-evidence-challenge.model.js';
import {
  acknowledgementReceiptRecord,
  type EvidenceReceipt,
} from './section-evidence-receipt.model.js';
import {
  evidenceCorrelation,
  evidenceData,
  evidenceHash,
  evidenceId,
  evidenceLifetime,
  evidencePolicy,
} from './section-evidence-revision.js';
import {
  createSectionEvidenceRepository,
  additionalAcknowledgementStore,
  evidenceUnavailable,
  evidenceUnconfirmed,
  evidenceConflict,
  challengeUnavailable,
  challengeHidden,
  type SectionEvidenceRepository,
  type EvidenceRead,
} from './section-evidence.repository.js';

const issueCommand = z.strictObject({ conceptId: evidenceId, idempotencyKey });
const ackCommand = z.strictObject({
  challengeId: evidenceId,
  acknowledged: z.literal(true),
  idempotencyKey,
});
const revokeCommand = z.strictObject({ challengeId: evidenceId });
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  try {
    return schema.parse(evidenceData(input));
  } catch {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Invalid section activity command',
    );
  }
}
export const issueFingerprint = (
  c: Pick<
    EvidenceChallenge,
    | 'userId'
    | 'conceptId'
    | 'conceptRevision'
    | 'sectionRevision'
    | 'policyId'
    | 'section'
    | 'policyVersion'
  >,
) =>
  evidenceHash([
    'F038-C2-issue-request-v1',
    c.userId.toHexString(),
    c.conceptId.toHexString(),
    c.section,
    c.conceptRevision,
    c.sectionRevision,
    c.policyId,
    c.policyVersion,
  ]);
export const ackFingerprint = (c: EvidenceChallenge) =>
  evidenceHash([
    'F038-C2-ack-request-v1',
    c.userId.toHexString(),
    c._id.toHexString(),
    c.conceptId.toHexString(),
    c.section,
    c.conceptRevision,
    c.sectionRevision,
    c.policyId,
    c.policyVersion,
    'ACKNOWLEDGED',
  ]);
const issueDto = (c: EvidenceChallenge) => ({
  id: c._id.toHexString(),
  conceptId: c.conceptId.toHexString(),
  section: c.section,
  conceptRevision: c.conceptRevision,
  sectionRevision: c.sectionRevision,
  policyId: c.policyId,
  policyVersion: c.policyVersion,
  expiresAt: c.expiresAt.toISOString(),
});
const receiptDto = (r: EvidenceReceipt) => ({
  id: r._id.toHexString(),
  conceptId: r.conceptId.toHexString(),
  section: r.section,
  acknowledgedAt: r.acknowledgedAt.toISOString(),
  completionQualification: 'NOT_ESTABLISHED' as const,
});

/** Explicit internal invocation only. No route/job/submission hook creates this service.
 * The verifier/config/adapter are trusted server dependencies, never command fields. */
export function createSectionEvidenceService(
  tokens: Pick<AccessTokens, 'verify'>,
  config: { APP_ENV: string },
  suppliedRepository?: SectionEvidenceRepository,
  now = () => new Date(),
  section: 'READ' | 'EXAMPLE' | 'REVISE' = 'READ',
) {
  const repository =
    suppliedRepository ??
    createSectionEvidenceRepository(
      section === 'READ' ? undefined : additionalAcknowledgementStore(section),
    );
  const policy =
    section === 'READ'
      ? evidencePolicy
      : {
          section,
          policyId:
            section === 'EXAMPLE'
              ? ('F038_EXAMPLE_ACK_ACTIVITY' as const)
              : ('F038_REVISE_ACK_ACTIVITY' as const),
          schemaVersion: 3 as const,
          policyVersion: 1 as const,
          producerVersion: 1 as const,
        };
  const store = repository.store;
  async function caller(token: unknown) {
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
      if (claim.role !== 'STUDENT' || !evidenceId.safeParse(claim.sub).success)
        throw new AppError(
          403,
          'AUTH_FORBIDDEN',
          'Current eligible Student required',
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
    const value = now();
    if (
      !(value instanceof Date) ||
      !Number.isFinite(value.getTime()) ||
      value.getTime() < 0
    )
      throw evidenceUnavailable();
    return new Date(value);
  }
  async function current(c: EvidenceChallenge, read: EvidenceRead) {
    const revision = await store.revision(c.conceptId, read);
    if (
      c.conceptRevision !== revision.conceptRevision ||
      c.sectionRevision !== revision.sectionRevision
    )
      throw challengeUnavailable();
  }
  function valid(
    c: EvidenceChallenge,
    owner: Types.ObjectId,
    allowExpired = false,
  ) {
    // Shared collections also contain VISUALIZE v2. READ commands cannot act on it.
    if (c.section !== section || c.schemaVersion !== policy.schemaVersion)
      throw challengeHidden();
    acknowledgementChallengeRecord.parse(c);
    if (!c.userId.equals(owner)) throw challengeHidden();
    if (c.requestFingerprint !== issueFingerprint(c))
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
    id: Types.ObjectId,
    owner: Types.ObjectId,
    read: EvidenceRead,
    allowExpired = false,
  ) {
    const row = await store.challenge(owner, { _id: id }, read);
    if (!row || !row._id.equals(id)) throw challengeHidden();
    valid(row, owner, allowExpired);
    return row;
  }
  function linked(r: EvidenceReceipt, c: EvidenceChallenge) {
    acknowledgementReceiptRecord.parse(r);
    if (
      !c.receiptId?.equals(r._id) ||
      !r.challengeId.equals(c._id) ||
      !r.userId.equals(c.userId) ||
      !r.conceptId.equals(c.conceptId) ||
      r.conceptRevision !== c.conceptRevision ||
      r.sectionRevision !== c.sectionRevision ||
      r.requestFingerprint !== ackFingerprint(c) ||
      !same(r.acknowledgedAt, c.consumedAt)
    )
      throw evidenceUnconfirmed();
  }
  const nextFence = (c: EvidenceChallenge) => {
    if (c.decisionFence >= Number.MAX_SAFE_INTEGER) throw evidenceUnavailable();
    return c.decisionFence + 1;
  };
  async function proofChallenge(
    c: EvidenceChallenge,
    owner: Types.ObjectId,
    read: EvidenceRead,
    revoke = false,
  ) {
    await store.actor(owner, read);
    const stored = await challenge(c._id, owner, read, revoke);
    if (!revoke) await current(stored, read);
    if (
      !same({ ...stored, decisionFence: c.decisionFence }, c) ||
      stored.decisionFence < c.decisionFence
    )
      throw evidenceUnconfirmed();
    return stored;
  }
  return {
    async issue(token: unknown, input: unknown, requestId: unknown) {
      const owner = await caller(token),
        cmd = parse(issueCommand, input),
        correlation = parse(evidenceCorrelation, requestId);
      const concept = new Types.ObjectId(cmd.conceptId),
        keyHash = evidenceHash([
          'F038-C2-issue-key-v1',
          owner.toHexString(),
          ...(section === 'READ' ? [] : [section]),
          cmd.idempotencyKey,
        ]);
      const result = await repository.transact(
        async (read) => {
          await store.actor(owner, read);
          const revision = await store.revision(concept, read);
          const issuedAt = time();
          const row = acknowledgementChallengeRecord.parse({
            _id: new Types.ObjectId(),
            userId: owner,
            conceptId: concept,
            ...policy,
            ...revision,
            issueKeyHash: keyHash,
            requestFingerprint: issueFingerprint({
              userId: owner,
              conceptId: concept,
              ...policy,
              ...revision,
            }),
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
          const existing = await store.challenge(
            owner,
            { issueKeyHash: keyHash },
            read,
          );
          if (existing) {
            valid(existing, owner);
            if (
              existing.issueKeyHash !== keyHash ||
              existing.requestFingerprint !== row.requestFingerprint
            )
              throw evidenceConflict();
            if (existing.state !== 'AVAILABLE') throw challengeUnavailable();
            const next = acknowledgementChallengeRecord.parse({
              ...existing,
              decisionFence: nextFence(existing),
            });
            await store.fence(existing, next, read);
            return next;
          }
          await store.insertChallenge(row, read);
          return row;
        },
        async (row, read) => {
          await proofChallenge(row, owner, read);
        },
        (read) => store.actor(owner, read),
      );
      return issueDto(result);
    },
    async acknowledge(token: unknown, input: unknown, requestId: unknown) {
      const owner = await caller(token),
        cmd = parse(ackCommand, input),
        correlation = parse(evidenceCorrelation, requestId),
        id = new Types.ObjectId(cmd.challengeId);
      const keyHash = evidenceHash([
        'F038-C2-ack-key-v1',
        owner.toHexString(),
        ...(section === 'READ' ? [] : [section]),
        cmd.idempotencyKey,
      ]);
      const result = await repository.transact(
        async (read) => {
          await store.actor(owner, read);
          const c = await challenge(id, owner, read);
          await current(c, read);
          const previous = await store.receipt(
            owner,
            { ackKeyHash: keyHash },
            read,
          );
          if (previous) {
            if (
              previous.ackKeyHash !== keyHash ||
              !previous.challengeId.equals(id) ||
              previous.requestFingerprint !== ackFingerprint(c)
            )
              throw evidenceConflict();
            if (c.state !== 'CONSUMED') throw evidenceUnconfirmed();
            linked(previous, c);
            const next = acknowledgementChallengeRecord.parse({
              ...c,
              decisionFence: nextFence(c),
            });
            await store.fence(c, next, read);
            return { challenge: next, receipt: previous };
          }
          if (c.state !== 'AVAILABLE') throw challengeUnavailable();
          const acknowledgedAt = time();
          // Recheck immediately before CAS; the snapshot must not outlive expiry.
          if (acknowledgedAt < c.issuedAt || acknowledgedAt >= c.expiresAt)
            throw challengeUnavailable();
          const r = acknowledgementReceiptRecord.parse({
            _id: new Types.ObjectId(),
            userId: owner,
            conceptId: c.conceptId,
            challengeId: c._id,
            ...policy,
            conceptRevision: c.conceptRevision,
            sectionRevision: c.sectionRevision,
            origin: 'ACKNOWLEDGEMENT_SERVICE',
            purpose: 'ACTIVITY_ONLY',
            ackKeyHash: keyHash,
            requestFingerprint: ackFingerprint(c),
            ackRequestId: correlation,
            acknowledgedAt,
          });
          const next = acknowledgementChallengeRecord.parse({
            ...c,
            state: 'CONSUMED',
            decisionFence: nextFence(c),
            consumedAt: acknowledgedAt,
            receiptId: r._id,
          });
          await store.fence(c, next, read);
          await store.insertReceipt(r, read);
          return { challenge: next, receipt: r };
        },
        async (value, read) => {
          const c = await proofChallenge(value.challenge, owner, read);
          const r = await store.receipt(
            owner,
            { _id: value.receipt._id },
            read,
          );
          if (!r || !same(r, value.receipt)) throw evidenceUnconfirmed();
          linked(r, c);
          valid(c, owner);
        },
        (read) => store.actor(owner, read),
      );
      return receiptDto(result.receipt);
    },
    async revoke(token: unknown, input: unknown, requestId: unknown) {
      const owner = await caller(token),
        cmd = parse(revokeCommand, input);
      parse(evidenceCorrelation, requestId);
      const id = new Types.ObjectId(cmd.challengeId);
      const result = await repository.transact(
        async (read) => {
          await store.actor(owner, read);
          const c = await challenge(id, owner, read, true);
          if (c.state === 'REVOKED') return c;
          const next = acknowledgementChallengeRecord.parse({
            ...c,
            state: 'REVOKED',
            decisionFence: nextFence(c),
            revokedAt: time(),
            revokedBy: owner,
          });
          await store.fence(c, next, read);
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

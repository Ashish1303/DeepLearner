import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { AppError } from '../src/common/errors/app-error.js';
import {
  sectionEvidenceRevision,
  evidenceData,
  evidenceHash,
  evidenceLifetime,
  additionalSectionRevision,
  type EvidenceSnapshot,
} from '../src/modules/progress/section-evidence-revision.js';
import {
  SectionEvidenceChallenge,
  challengeRecord,
  acknowledgementChallengeRecord,
  visualChallengeRecord,
  type EvidenceChallenge,
} from '../src/modules/progress/section-evidence-challenge.model.js';
import {
  SectionActivityReceipt,
  receiptRecord,
  acknowledgementReceiptRecord,
  visualReceiptRecord,
  type EvidenceReceipt,
} from '../src/modules/progress/section-evidence-receipt.model.js';
import {
  createSectionEvidenceRepository,
  evidenceIndexes,
  verifyEvidenceIndex,
  evidenceUnavailable,
  EvidenceWriteConflict,
  mongoEvidence,
  type EvidenceRead,
  type EvidenceStore,
} from '../src/modules/progress/section-evidence.repository.js';
import {
  createSectionEvidenceService,
  ackFingerprint,
} from '../src/modules/progress/section-evidence.service.js';

const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const owner = id(1),
  other = id(2),
  concept = id(3);
const snapshot = (): EvidenceSnapshot => ({
  id: concept.toHexString(),
  technologyId: id(4).toHexString(),
  learningPathId: id(5).toHexString(),
  moduleId: id(6).toHexString(),
  topicId: id(7).toHexString(),
  title: 'READ',
  slug: 'read',
  difficulty: 'BEGINNER',
  order: 0,
  contentFormat: 'MARKDOWN',
  schemaVersion: 1,
  read: { summary: 'Summary', bodyMarkdown: '  Body\n' },
  source: {
    label: 'Source',
    url: 'https://example.invalid/read',
    sourceType: 'OFFICIAL_OR_TRUSTED',
    isOfficial: true,
  },
  examples: [],
  revise: null,
});
const code = (value: string) => (e: unknown) =>
  e instanceof AppError &&
  e.code === value &&
  !/PRIVATE|raw-key/.test(JSON.stringify(e));
async function fixture(section: 'READ' | 'EXAMPLE' | 'REVISE' = 'READ') {
  const state = {
    challenges: new Map<string, EvidenceChallenge>(),
    receipts: new Map<string, EvidenceReceipt>(),
    actors: new Set([owner.toHexString(), other.toHexString()]),
    published: true,
    snapshot: snapshot(),
    now: Date.now(),
    readyFault: false,
    insertFault: false,
    proofFault: false,
    unknownCommit: false,
    cleanupFault: false,
    conflicts: 0,
    afterCommit: undefined as (() => void) | undefined,
    events: [] as string[],
    bodies: 0,
    sessions: 0,
    closed: 0,
    options: {} as Record<string, unknown>,
    reads: [] as EvidenceRead[],
  };
  let gate = Promise.resolve();
  const store: EvidenceStore = {
    async ready() {
      state.events.push('ready');
      if (state.readyFault) throw evidenceUnavailable();
    },
    async session() {
      state.sessions++;
      let active = false;
      return {
        inTransaction: () => active,
        async withTransaction(
          work: () => Promise<void>,
          options: Record<string, unknown>,
        ) {
          const prior = gate;
          let release = () => {};
          gate = new Promise<void>((r) => {
            release = r;
          });
          await prior;
          const backup = {
            challenges: new Map(state.challenges),
            receipts: new Map(state.receipts),
          };
          let committed = false;
          try {
            active = true;
            state.bodies++;
            state.options = options;
            await work();
            active = false;
            committed = true;
            state.events.push('commit');
            state.afterCommit?.();
            if (state.unknownCommit)
              throw { errorLabels: ['UnknownTransactionCommitResult'] };
          } catch (e) {
            if (!committed) Object.assign(state, backup);
            throw e;
          } finally {
            active = false;
            release();
          }
        },
        async endSession() {
          state.closed++;
          if (state.cleanupFault) throw new Error('cleanup');
        },
      } as unknown as ClientSession;
    },
    async actor(user, read) {
      state.reads.push(read);
      if (!state.actors.has(user.toHexString()))
        throw new AppError(403, 'AUTH_FORBIDDEN', 'Forbidden');
    },
    async revision(c) {
      if (!state.published || !c.equals(concept))
        throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Not found');
      return section === 'READ'
        ? sectionEvidenceRevision(state.snapshot)
        : additionalSectionRevision(state.snapshot, section);
    },
    async challenge(user, identity) {
      return (
        [...state.challenges.values()].find(
          (c) =>
            c.userId.equals(user) &&
            ('_id' in identity
              ? c._id.equals(identity._id)
              : c.issueKeyHash === identity.issueKeyHash),
        ) ?? null
      );
    },
    async receipt(user, identity, read) {
      if (read.majority && state.proofFault) return null;
      return (
        [...state.receipts.values()].find(
          (r) =>
            r.userId.equals(user) &&
            ('_id' in identity
              ? r._id.equals(identity._id)
              : r.ackKeyHash === identity.ackKeyHash),
        ) ?? null
      );
    },
    async insertChallenge(c) {
      state.challenges.set(
        c._id.toHexString(),
        acknowledgementChallengeRecord.parse(c),
      );
    },
    async insertReceipt(r) {
      if (state.insertFault) throw new Error('insert');
      assert.ok(
        ![...state.receipts.values()].some(
          (x) =>
            x.userId.equals(r.userId) &&
            (x.challengeId.equals(r.challengeId) ||
              x.ackKeyHash === r.ackKeyHash),
        ),
      );
      state.receipts.set(
        r._id.toHexString(),
        acknowledgementReceiptRecord.parse(r),
      );
    },
    async fence(before, after) {
      if (state.conflicts-- > 0) throw new EvidenceWriteConflict();
      assert.deepEqual(state.challenges.get(before._id.toHexString()), before);
      state.challenges.set(
        after._id.toHexString(),
        acknowledgementChallengeRecord.parse(after),
      );
    },
  };
  const tokens = createAccessTokens(
    {
      ACCESS_TOKEN_SECRET: Buffer.alloc(32, 8).toString('base64'),
      ACCESS_TOKEN_ISSUER: 'c2-test',
      ACCESS_TOKEN_AUDIENCE: 'c2-test',
    },
    () => new Date(state.now),
  );
  const tokenFor = (user = owner, role: 'STUDENT' | 'ADMIN' = 'STUDENT') =>
    tokens.sign({
      sub: user.toHexString(),
      sid: id(8).toHexString(),
      role,
      plan: 'FREE',
    });
  const token = await tokenFor();
  const repository = createSectionEvidenceRepository(store);
  const service = createSectionEvidenceService(
    tokens,
    { APP_ENV: 'LOCAL' },
    repository,
    () => new Date(state.now),
    section,
  );
  const issue = (key = randomUUID()) =>
    service.issue(
      token,
      { conceptId: concept.toHexString(), idempotencyKey: key },
      'test',
    );
  const ack = (challengeId: string, key = randomUUID(), actor = token) =>
    service.acknowledge(
      actor,
      { challengeId, acknowledged: true, idempotencyKey: key },
      'test',
    );
  return {
    state,
    store,
    tokens,
    repository,
    service,
    token,
    tokenFor,
    issue,
    ack,
  };
}

test('C2 snapshot hashes use the exact ordered v1 arrays and preserve whitespace', () => {
  const r = snapshot();
  const h = sectionEvidenceRevision(r);
  assert.equal(
    h.sectionRevision,
    evidenceHash([
      'F038-C2-read-v1',
      r.id,
      r.title,
      'MARKDOWN',
      'Summary',
      '  Body\n',
      ['Source', 'https://example.invalid/read', 'OFFICIAL_OR_TRUSTED', true],
    ]),
  );
  assert.notEqual(
    sectionEvidenceRevision({ ...r, read: { ...r.read, bodyMarkdown: 'Body' } })
      .sectionRevision,
    h.sectionRevision,
  );
  assert.deepEqual(sectionEvidenceRevision(Object.freeze(r)), h);
  assert.equal(
    sectionEvidenceRevision({ ...r, difficulty: 'INTERVIEW_READY' })
      .sectionRevision,
    h.sectionRevision,
  );
});
test('C2 Concept hash includes Example, Revise and hierarchy without changing READ hash', () => {
  for (const change of [
    { topicId: id(18).toHexString() },
    { examples: [{ title: 'Example', bodyMarkdown: 'Example' }] },
    {
      revise: {
        summary: 'Revise',
        keyPoints: [],
        memoryTrick: null,
        importantCodeMarkdown: null,
      },
    },
  ]) {
    const old = sectionEvidenceRevision(snapshot()),
      next = sectionEvidenceRevision({ ...snapshot(), ...change });
    assert.notEqual(old.conceptRevision, next.conceptRevision);
    assert.equal(old.sectionRevision, next.sectionRevision);
  }
});
test('C2 hash validation refuses malformed, private, oversized and unsupported snapshot fields', () => {
  for (const r of [
    { ...snapshot(), answer: 'PRIVATE' },
    { ...snapshot(), schemaVersion: 2 },
    { ...snapshot(), id: 'invalid' },
    { ...snapshot(), read: { summary: 'x', bodyMarkdown: 'x'.repeat(50_001) } },
    {
      ...snapshot(),
      examples: Array(11).fill({ title: 'x', bodyMarkdown: 'x' }),
    },
  ])
    assert.throws(() => sectionEvidenceRevision(r));
});
test('C2 plain data snapshot never executes accessors/proxies/coercion', () => {
  let calls = 0;
  for (const input of [
    Object.defineProperty({}, 'conceptId', {
      get() {
        calls++;
        return '';
      },
      enumerable: true,
    }),
    new Proxy(
      {},
      {
        ownKeys() {
          calls++;
          return [];
        },
      },
    ),
    {
      toJSON() {
        calls++;
        return {};
      },
    },
  ])
    assert.throws(() => evidenceData(input));
  assert.equal(calls, 0);
});
test('C2 owned issue and receipt have exact allowlisted fields, no completion evidence', async () => {
  const f = await fixture();
  const c = await f.issue();
  assert.deepEqual(
    Object.keys(c).sort(),
    [
      'id',
      'conceptId',
      'section',
      'conceptRevision',
      'sectionRevision',
      'policyId',
      'policyVersion',
      'expiresAt',
    ].sort(),
  );
  assert.equal(Date.parse(c.expiresAt) - f.state.now, evidenceLifetime);
  const r = await f.ack(c.id);
  assert.deepEqual(
    Object.keys(r).sort(),
    [
      'id',
      'conceptId',
      'section',
      'acknowledgedAt',
      'completionQualification',
    ].sort(),
  );
  assert.equal(r.completionQualification, 'NOT_ESTABLISHED');
  assert.equal(f.state.receipts.size, 1);
  assert.equal(f.state.closed, f.state.sessions);
  assert.ok(f.state.reads.some((r) => r.majority));
});
test('C2 issue replay preserves challenge identity and fixed expiry', async () => {
  const f = await fixture(),
    k = randomUUID();
  const first = await f.issue(k);
  f.state.now += 10;
  assert.deepEqual(await f.issue(k), first);
  assert.equal(f.state.challenges.size, 1);
});
test('C2 issue key cannot change content binding', async () => {
  const f = await fixture(),
    k = randomUUID();
  await f.issue(k);
  f.state.snapshot.title = 'Changed';
  await assert.rejects(f.issue(k), code('SECTION_EVIDENCE_CONFLICT'));
  assert.equal(f.state.challenges.size, 1);
});
test('C2 acknowledgement replay is same receipt without reinsertion', async () => {
  const f = await fixture(),
    c = await f.issue(),
    k = randomUUID();
  const r = await f.ack(c.id, k);
  assert.deepEqual(await f.ack(c.id, k), r);
  assert.equal(f.state.receipts.size, 1);
});
test('C2 changed acknowledgement challenge conflicts for the same key', async () => {
  const f = await fixture(),
    a = await f.issue(),
    b = await f.issue(),
    k = randomUUID();
  await f.ack(a.id, k);
  await assert.rejects(f.ack(b.id, k), code('SECTION_EVIDENCE_CONFLICT'));
});
test('C2 consumed challenge refuses a different ack key and issue replay', async () => {
  const f = await fixture(),
    k = randomUUID(),
    c = await f.issue(k);
  await f.ack(c.id);
  await assert.rejects(f.ack(c.id), code('SECTION_CHALLENGE_UNAVAILABLE'));
  await assert.rejects(f.issue(k), code('SECTION_CHALLENGE_UNAVAILABLE'));
});
test('C2 concurrent identical acknowledgements converge on one receipt', async () => {
  const f = await fixture(),
    c = await f.issue(),
    k = randomUUID();
  const rs = await Promise.all([
    f.ack(c.id, k),
    f.ack(c.id, k),
    f.ack(c.id, k),
  ]);
  assert.equal(new Set(rs.map((r) => r.id)).size, 1);
  assert.equal(f.state.receipts.size, 1);
});
test('C2 concurrent different acknowledgement keys cannot double consume', async () => {
  const f = await fixture(),
    c = await f.issue();
  const rs = await Promise.allSettled([f.ack(c.id), f.ack(c.id)]);
  assert.equal(rs.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.state.receipts.size, 1);
});
test('C2 cross-account acknowledgement and withdrawal remain hidden', async () => {
  const f = await fixture(),
    c = await f.issue(),
    token = await f.tokenFor(other);
  await assert.rejects(
    f.ack(c.id, randomUUID(), token),
    code('SECTION_CHALLENGE_NOT_FOUND'),
  );
  await assert.rejects(
    f.service.revoke(token, { challengeId: c.id }, 'test'),
    code('SECTION_CHALLENGE_NOT_FOUND'),
  );
});
for (const type of ['issue', 'ack', 'replay'] as const)
  test(`C2 exact expiry refuses ${type}`, async () => {
    const f = await fixture(),
      k = randomUUID(),
      c = await f.issue(k),
      ackKey = randomUUID();
    if (type === 'replay') await f.ack(c.id, ackKey);
    f.state.now += evidenceLifetime;
    await assert.rejects(
      type === 'issue' ? f.issue(k) : f.ack(c.id, ackKey),
      code('SECTION_CHALLENGE_UNAVAILABLE'),
    );
  });
test('C2 expiry before postcommit proof does not return a success or claim rollback', async () => {
  const f = await fixture(),
    c = await f.issue();
  f.state.afterCommit = () => {
    f.state.now += evidenceLifetime;
  };
  await assert.rejects(f.ack(c.id), code('SECTION_CHALLENGE_UNAVAILABLE'));
  assert.equal(f.state.receipts.size, 1);
});
test('C2 terminal withdrawal blocks available consumption and is idempotent', async () => {
  const f = await fixture(),
    c = await f.issue();
  const result = await f.service.revoke(f.token, { challengeId: c.id }, 'test');
  assert.deepEqual(
    await f.service.revoke(f.token, { challengeId: c.id }, 'test'),
    result,
  );
  await assert.rejects(f.ack(c.id), code('SECTION_CHALLENGE_UNAVAILABLE'));
});
test('C2 withdrawing consumed challenge preserves immutable receipt but refuses replay', async () => {
  const f = await fixture(),
    c = await f.issue(),
    k = randomUUID();
  await f.ack(c.id, k);
  const original = [...f.state.receipts.values()][0];
  await f.service.revoke(f.token, { challengeId: c.id }, 'test');
  assert.deepEqual([...f.state.receipts.values()][0], original);
  await assert.rejects(f.ack(c.id, k), code('SECTION_CHALLENGE_UNAVAILABLE'));
});
test('C2 withdrawal remains available when content is unpublished', async () => {
  const f = await fixture(),
    c = await f.issue();
  f.state.published = false;
  assert.equal(
    (await f.service.revoke(f.token, { challengeId: c.id }, 'test')).state,
    'REVOKED',
  );
});
test('C2 acknowledgement/withdrawal race leaves at most one historical receipt', async () => {
  const f = await fixture(),
    c = await f.issue();
  await Promise.allSettled([
    f.ack(c.id),
    f.service.revoke(f.token, { challengeId: c.id }, 'test'),
  ]);
  assert.equal(f.state.challenges.get(c.id)!.state, 'REVOKED');
  assert.ok(f.state.receipts.size <= 1);
  await assert.rejects(f.ack(c.id), code('SECTION_CHALLENGE_UNAVAILABLE'));
});
for (const stage of ['before', 'transaction', 'proof'] as const)
  test(`C2 current Student revalidation at ${stage}`, async () => {
    const f = await fixture(),
      c = await f.issue();
    if (stage === 'before') f.state.actors.delete(owner.toHexString());
    else if (stage === 'transaction') {
      const old = f.store.actor;
      let calls = 0;
      f.store.actor = async (...args) => {
        if (++calls === 2) f.state.actors.delete(owner.toHexString());
        return old(...args);
      };
    } else
      f.state.afterCommit = () => {
        f.state.actors.delete(owner.toHexString());
      };
    await assert.rejects(f.ack(c.id), code('AUTH_FORBIDDEN'));
  });
test('C2 LOCAL configuration cannot be overridden by client data', async () => {
  const f = await fixture();
  const s = createSectionEvidenceService(
    f.tokens,
    { APP_ENV: 'PRODUCTION' },
    f.repository,
  );
  await assert.rejects(
    s.issue(
      f.token,
      {
        conceptId: concept.toHexString(),
        APP_ENV: 'LOCAL',
        idempotencyKey: randomUUID(),
      },
      'test',
    ),
    code('ROUTE_NOT_FOUND'),
  );
  assert.equal(f.state.sessions, 0);
});
test('C2 malformed and Admin tokens cannot authorize Student operations', async () => {
  const f = await fixture();
  await assert.rejects(
    f.service.issue('invalid', {}, 'test'),
    code('AUTH_ACCESS_TOKEN_INVALID'),
  );
  const token = await f.tokenFor(owner, 'ADMIN');
  await assert.rejects(
    f.service.issue(
      token,
      { conceptId: concept.toHexString(), idempotencyKey: randomUUID() },
      'test',
    ),
    code('AUTH_FORBIDDEN'),
  );
});
test('C2 invalid and extra command fields are rejected before database work', async () => {
  const f = await fixture();
  for (const change of [
    { userId: owner.toHexString() },
    { conceptRevision: 'a'.repeat(64) },
    { idempotencyKey: 'bad' },
    { conceptId: 'bad' },
  ])
    await assert.rejects(
      f.service.issue(
        f.token,
        {
          conceptId: concept.toHexString(),
          idempotencyKey: randomUUID(),
          ...change,
        },
        'test',
      ),
      code('VALIDATION_ERROR'),
    );
  assert.equal(f.state.sessions, 0);
});
test('C2 explicit true acknowledgement is mandatory', async () => {
  const f = await fixture(),
    c = await f.issue();
  for (const v of [false, undefined, 'true'])
    await assert.rejects(
      f.service.acknowledge(
        f.token,
        { challengeId: c.id, acknowledged: v, idempotencyKey: randomUUID() },
        'test',
      ),
      code('VALIDATION_ERROR'),
    );
});
test('C2 fresh publication and snapshot changes refuse acknowledgement and replay', async () => {
  for (const replay of [false, true]) {
    const f = await fixture(),
      c = await f.issue(),
      k = randomUUID();
    if (replay) await f.ack(c.id, k);
    f.state.snapshot.read.bodyMarkdown += 'changed';
    await assert.rejects(f.ack(c.id, k), code('SECTION_CHALLENGE_UNAVAILABLE'));
    f.state.published = false;
    await assert.rejects(f.ack(c.id, k), code('CONCEPT_NOT_FOUND'));
  }
});
test('C2 unavailable indexes block issue and acknowledge without writes', async () => {
  const f = await fixture(),
    c = await f.issue();
  f.state.readyFault = true;
  await assert.rejects(f.issue(), code('DEPENDENCY_UNAVAILABLE'));
  await assert.rejects(f.ack(c.id), code('DEPENDENCY_UNAVAILABLE'));
  assert.equal(f.state.receipts.size, 0);
});
test('C2 receipt insert failure rolls back challenge consumption', async () => {
  const f = await fixture(),
    c = await f.issue();
  f.state.insertFault = true;
  await assert.rejects(f.ack(c.id), code('DEPENDENCY_UNAVAILABLE'));
  assert.equal(f.state.challenges.get(c.id)!.state, 'AVAILABLE');
  assert.equal(f.state.receipts.size, 0);
});
test('C2 lost majority proof fails closed with committed history preserved', async () => {
  const f = await fixture(),
    c = await f.issue();
  f.state.proofFault = true;
  await assert.rejects(f.ack(c.id), code('SECTION_EVIDENCE_UNCONFIRMED'));
  assert.equal(f.state.receipts.size, 1);
});
test('C2 uncertain commit does not return a receipt; explicit same request may recover', async () => {
  const f = await fixture(),
    c = await f.issue(),
    k = randomUUID();
  f.state.unknownCommit = true;
  await assert.rejects(f.ack(c.id, k), code('SECTION_EVIDENCE_UNCONFIRMED'));
  assert.equal(f.state.receipts.size, 1);
  f.state.unknownCommit = false;
  assert.equal((await f.ack(c.id, k)).id, [...f.state.receipts.keys()][0]);
});
test('C2 cleanup failure suppresses otherwise confirmed receipt', async () => {
  const f = await fixture(),
    c = await f.issue();
  f.state.cleanupFault = true;
  await assert.rejects(f.ack(c.id), code('SECTION_EVIDENCE_UNCONFIRMED'));
  assert.equal(f.state.closed, f.state.sessions);
});
test('C2 conflict retries and inherited timeout policy are bounded', async () => {
  const f = await fixture(),
    c = await f.issue();
  f.state.conflicts = 3;
  const before = f.state.bodies;
  await assert.rejects(f.ack(c.id), code('DEPENDENCY_UNAVAILABLE'));
  assert.equal(f.state.bodies - before, 3);
  assert.deepEqual(f.state.options.writeConcern, { w: 'majority', j: true });
  assert.equal(Number(f.state.options.timeoutMS) > 0, true);
  assert.equal(f.state.options.maxCommitTimeMS, 2000);
  assert.equal(
    f.state.reads
      .filter((r) => r.session?.inTransaction())
      .some((r) => r.timeoutMS !== undefined),
    false,
  );
});
test('C2 no transaction begins when cleanup/proof reserve is exhausted', async () => {
  const f = await fixture();
  let n = 0;
  const repository = createSectionEvidenceRepository(f.store, () =>
    n++ ? 9000 : 0,
  );
  await assert.rejects(
    repository.transact(
      async () => 1,
      async () => {},
      async () => {},
    ),
    code('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(f.state.bodies, 0);
  assert.equal(f.state.closed, f.state.sessions);
});
test('C2 stored key fingerprints and receipt links cannot be accepted as mere claims', async () => {
  const f = await fixture(),
    c = await f.issue(),
    k = randomUUID();
  const row = f.state.challenges.get(c.id)!;
  f.state.challenges.set(c.id, { ...row, requestFingerprint: 'a'.repeat(64) });
  await assert.rejects(f.ack(c.id, k), code('DEPENDENCY_UNAVAILABLE'));
  f.state.challenges.set(c.id, row);
  await f.ack(c.id, k);
  const r = [...f.state.receipts.values()][0]!;
  f.state.receipts.set(r._id.toHexString(), {
    ...r,
    requestFingerprint: 'a'.repeat(64),
  });
  await assert.rejects(f.ack(c.id, k), code('SECTION_EVIDENCE_CONFLICT'));
  assert.notEqual(ackFingerprint(row), 'a'.repeat(64));
});
test('C2 future or contradictory lifecycle metadata cannot authorize consumption', async () => {
  const f = await fixture(),
    c = await f.issue();
  const r = f.state.challenges.get(c.id)!;
  assert.equal(
    challengeRecord.safeParse({ ...r, expiresAt: r.issuedAt }).success,
    false,
  );
  assert.equal(
    challengeRecord.safeParse({ ...r, state: 'CONSUMED' }).success,
    false,
  );
  f.state.now--;
  await assert.rejects(f.ack(c.id), code('DEPENDENCY_UNAVAILABLE'));
});
test('C2 model schemas disable auto provisioning, reject casting and guard business edits', async () => {
  const f = await fixture(),
    c = await f.issue();
  await f.ack(c.id);
  for (const M of [SectionEvidenceChallenge, SectionActivityReceipt]) {
    assert.equal(M.schema.options.autoCreate, false);
    assert.equal(M.schema.options.autoIndex, false);
    assert.equal(M.schema.options.bufferCommands, false);
  }
  await assert.rejects(
    SectionActivityReceipt.updateOne({}, { $set: { section: 'OTHER' } }),
    /owned evidence/,
  );
  await assert.rejects(
    SectionEvidenceChallenge.updateOne({}, { $set: { section: 'OTHER' } }),
    /owned evidence/,
  );
  const r = [...f.state.receipts.values()][0]!;
  await new SectionActivityReceipt(r).validate();
  await new SectionEvidenceChallenge(f.state.challenges.get(c.id)!).validate();
  assert.equal(
    receiptRecord.safeParse({ ...r, answer: 'PRIVATE' }).success,
    false,
  );
});
test('C2 domain storage contains no raw keys/content/answers and fingerprints are account-scoped', async () => {
  const f = await fixture(),
    key = randomUUID(),
    c = await f.issue(key);
  await f.ack(c.id, key);
  const stored = JSON.stringify([
    [...f.state.challenges.values()],
    [...f.state.receipts.values()],
  ]);
  assert.ok(!stored.includes(key));
  assert.ok(!stored.includes('Body'));
  assert.ok(!stored.includes('Summary'));
  assert.notEqual(
    evidenceHash(['F038-C2-issue-key-v1', owner.toHexString(), key]),
    evidenceHash(['F038-C2-ack-key-v1', owner.toHexString(), key]),
  );
});
test('C2 exact unique index verification rejects every unsupported definition', () => {
  for (const expected of evidenceIndexes) {
    const row = { v: 2, name: expected.name, key: expected.key, unique: true };
    verifyEvidenceIndex([row], expected);
    for (const change of [
      { unique: false },
      { key: Object.fromEntries(Object.entries(expected.key).reverse()) },
      { partialFilterExpression: {} },
      { collation: { locale: 'en' } },
      { sparse: true },
      { hidden: true },
      { expireAfterSeconds: 1 },
      { v: 1 },
      { name: 'other' },
    ])
      assert.throws(
        () => verifyEvidenceIndex([{ ...row, ...change }], expected),
        code('DEPENDENCY_UNAVAILABLE'),
      );
    assert.throws(
      () => verifyEvidenceIndex([], expected),
      code('DEPENDENCY_UNAVAILABLE'),
    );
  }
});
test('C2 source boundary excludes automatic callers, answer/grading/progress/audit writers', async () => {
  for (const file of [
    'section-evidence.service.ts',
    'section-evidence.repository.ts',
    'section-evidence-challenge.model.ts',
    'section-evidence-receipt.model.ts',
    'section-evidence-revision.ts',
  ]) {
    const source = await readFile(
      new URL('../src/modules/progress/' + file, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(
      source,
      /console\.|logger\.|fetch\(|\.createIndexes\(|\.syncIndexes\(|collection\(['"](?:studentProgress|auditLogs)['"]\)/,
    );
    // Slice 1 adds read-only attempt absence proof in the separate synthetic
    // qualification adapter. Preserve the original C2 core's no-attempt boundary.
    if (source.includes('export const mongoEvidence'))
      assert.doesNotMatch(
        source.slice(
          source.indexOf('export const mongoEvidence'),
          source.indexOf('export function additionalAcknowledgementStore'),
        ),
        /collection\(['"]practiceAttempts['"]\)/,
      );
  }
});

test('C2 postcommit publication changes suppress receipts without deleting history', async () => {
  const f = await fixture(),
    c = await f.issue();
  f.state.afterCommit = () => {
    f.state.published = false;
  };
  await assert.rejects(f.ack(c.id), code('CONCEPT_NOT_FOUND'));
  assert.equal(f.state.receipts.size, 1);
});
test('C2 forged receipt ownership or cross-link never passes majority proof', async () => {
  for (const change of [
    { userId: other },
    { challengeId: id(100) },
    { conceptRevision: 'a'.repeat(64) },
  ]) {
    const f = await fixture(),
      c = await f.issue();
    f.state.afterCommit = () => {
      const r = [...f.state.receipts.values()][0]!;
      f.state.receipts.set(r._id.toHexString(), { ...r, ...change });
    };
    await assert.rejects(f.ack(c.id), code('SECTION_EVIDENCE_UNCONFIRMED'));
  }
});
test('C2 repository rejects ownership changes and fabricated revocation consumption before I/O', async () => {
  const f = await fixture(),
    c = await f.issue();
  const row = f.state.challenges.get(c.id)!;
  const read = { session: { inTransaction: () => true } as ClientSession };
  await assert.rejects(
    mongoEvidence.fence(row, { ...row, userId: other, decisionFence: 1 }, read),
    code('DEPENDENCY_UNAVAILABLE'),
  );
  await assert.rejects(
    mongoEvidence.fence(
      row,
      {
        ...row,
        state: 'REVOKED',
        consumedAt: row.issuedAt,
        receiptId: id(100),
        revokedAt: row.issuedAt,
        revokedBy: owner,
        decisionFence: 1,
      },
      read,
    ),
    code('DEPENDENCY_UNAVAILABLE'),
  );
});

test('C2 native projection validates stored optional fields before DTO normalization', async () => {
  const prior = mongoose.connection.db;
  const connection = mongoose.connection as unknown as { db: typeof prior };
  const s = snapshot();
  const { id: ignored, ...fields } = s;
  void ignored;
  const raw = {
    ...fields,
    _id: concept,
    technologyId: id(4),
    learningPathId: id(5),
    moduleId: id(6),
    topicId: id(7),
    examples: undefined,
    revise: undefined,
  };
  let row: object = raw;
  connection.db = {
    collection() {
      return {
        aggregate() {
          return {
            async toArray() {
              return [row];
            },
          };
        },
      };
    },
  } as unknown as NonNullable<typeof prior>;
  try {
    assert.deepEqual(
      await mongoEvidence.revision(concept, {}),
      sectionEvidenceRevision(s),
    );
    for (const change of [
      { examples: null },
      { revise: null },
      { revise: { summary: 'x', keyPoints: null } },
      { revise: { summary: 'x', memoryTrick: null } },
    ]) {
      row = { ...raw, ...change };
      await assert.rejects(mongoEvidence.revision(concept, {}));
    }
  } finally {
    connection.db = prior;
  }
});

test('C2 native shared-collection reads explicitly scope READ v1 and keep original indexes', async () => {
  const prior = mongoose.connection.db;
  const connection = mongoose.connection as unknown as { db: typeof prior };
  const queries: Record<string, unknown>[] = [];
  connection.db = {
    collection() {
      return {
        async findOne(filter: Record<string, unknown>) {
          queries.push(filter);
          return null;
        },
      };
    },
  } as unknown as NonNullable<typeof prior>;
  try {
    await mongoEvidence.challenge(owner, { _id: id(30) }, {});
    await mongoEvidence.receipt(owner, { ackKeyHash: 'a'.repeat(64) }, {});
    assert.equal(queries.length, 2);
    for (const q of queries) {
      assert.equal(q.section, 'READ');
      assert.equal(q.schemaVersion, 1);
      assert.deepEqual(q.userId, owner);
    }
    assert.equal(evidenceIndexes.length, 3);
    assert.ok(
      evidenceIndexes.every((i) => !i.collection.includes('Checkpoint')),
    );
  } finally {
    connection.db = prior;
  }
});

test('C2 READ service rejects a VISUALIZE branch even from a substituted shared store', async () => {
  const f = await fixture();
  const c = await f.issue();
  const original = f.store.challenge;
  f.store.challenge = async (...args) => {
    const row = await original(...args);
    return row
      ? ({
          ...row,
          section: 'VISUALIZE',
          schemaVersion: 2,
        } as unknown as EvidenceChallenge)
      : null;
  };
  await assert.rejects(f.ack(c.id), code('SECTION_CHALLENGE_NOT_FOUND'));
  assert.equal(f.state.receipts.size, 0);
});

for (const section of ['EXAMPLE', 'REVISE'] as const) {
  test(`Slice 1 ${section} acknowledgement is revision-bound activity only with exact replay and withdrawal`, async () => {
    const f = await fixture(section);
    f.state.snapshot.examples = [
      { title: 'Example', bodyMarkdown: 'Exact example' },
    ];
    f.state.snapshot.revise = {
      summary: 'Revise',
      keyPoints: ['Retain'],
      memoryTrick: null,
      importantCodeMarkdown: null,
    };
    const issued = await f.issue(),
      key = randomUUID(),
      first = await f.ack(issued.id, key),
      replay = await f.ack(issued.id, key);
    assert.equal(first.section, section);
    assert.equal(first.completionQualification, 'NOT_ESTABLISHED');
    assert.deepEqual(first, replay);
    assert.equal([...f.state.challenges.values()][0]!.schemaVersion, 3);
    await f.service.revoke(f.token, { challengeId: issued.id }, 'withdraw');
    await assert.rejects(f.ack(issued.id, key));
    assert.equal(f.state.receipts.size, 1);
  });
  test(`Slice 1 ${section} refuses missing content and changed content without consuming a challenge`, async () => {
    const f = await fixture(section);
    await assert.rejects(f.issue());
    f.state.snapshot.examples = [
      { title: 'Example', bodyMarkdown: 'Exact example' },
    ];
    f.state.snapshot.revise = {
      summary: 'Revise',
      keyPoints: ['Retain'],
      memoryTrick: null,
      importantCodeMarkdown: null,
    };
    const c = await f.issue();
    f.state.snapshot.read.summary = 'New content revision';
    await assert.rejects(f.ack(c.id));
    assert.equal(f.state.receipts.size, 0);
  });
}

test('C2 native READ inserts reject otherwise valid VISUALIZE rows before database work', async () => {
  const f = await fixture(),
    issued = await f.issue();
  await f.ack(issued.id);
  const c = f.state.challenges.get(issued.id)!,
    r = [...f.state.receipts.values()][0]!;
  const bindings = {
    section: 'VISUALIZE',
    schemaVersion: 2,
    policyId: 'F038_VISUALIZE_CHECKPOINT_ACTIVITY',
    definitionId: id(31),
    definitionFingerprint: 'd'.repeat(64),
    visualizationId: id(32),
    visualizationRevision: c.sectionRevision,
    checkpointId: 'checkpoint',
    checkpointVersion: 1,
    verifierVersion: 1,
  };
  const visualChallenge = visualChallengeRecord.parse({ ...c, ...bindings });
  const { acknowledgedAt, ...rest } = r;
  const visualReceipt = visualReceiptRecord.parse({
    ...rest,
    ...bindings,
    origin: 'CHECKPOINT_SERVICE',
    respondedAt: acknowledgedAt,
    outcome: 'CORRECT',
  });
  await assert.rejects(
    mongoEvidence.insertChallenge(
      visualChallenge as unknown as EvidenceChallenge,
      {},
    ),
    { name: 'ZodError' },
  );
  await assert.rejects(
    mongoEvidence.insertReceipt(
      visualReceipt as unknown as EvidenceReceipt,
      {},
    ),
    { name: 'ZodError' },
  );
  assert.equal(mongoose.connection.readyState, 0);
});

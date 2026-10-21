import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { AppError } from '../src/common/errors/app-error.js';
import { mongoose } from '../src/config/database.js';
import {
  checkpointDefinitionRecord,
  VisualizationCheckpointDefinition,
  type CheckpointDefinition,
} from '../src/modules/visualizations/visualization-checkpoint-definition.model.js';
import {
  createCheckpointRepository,
  mongoCheckpoint,
  checkpointIndexes,
  validateDefinitionTransition,
  validateVisualTransition,
  type CheckpointStore,
} from '../src/modules/visualizations/visualization-checkpoint.repository.js';
import { createVisualizationCheckpointService } from '../src/modules/visualizations/visualization-checkpoint.service.js';
import {
  checkpointVisualizationRevision,
  definitionFingerprint,
} from '../src/modules/visualizations/visualization-checkpoint-revision.js';
import {
  visualChallengeRecord,
  SectionEvidenceChallenge,
  type VisualChallenge,
} from '../src/modules/progress/section-evidence-challenge.model.js';
import {
  visualReceiptRecord,
  SectionActivityReceipt,
  type VisualReceipt,
} from '../src/modules/progress/section-evidence-receipt.model.js';
import {
  evidenceUnavailable,
  EvidenceWriteConflict,
  verifyEvidenceIndex,
  type EvidenceRead,
} from '../src/modules/progress/section-evidence.repository.js';
const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const owner = id(1),
  other = id(2),
  author = id(3),
  reviewer = id(4),
  concept = id(5),
  visual = id(6),
  topic = id(7),
  tech = id(8);
const code = (name: string) => (e: unknown) =>
  e instanceof AppError &&
  e.code === name &&
  !/retained|discarded|SECRET_EXPECTED/.test(JSON.stringify(e));
async function fixture() {
  const state = {
    definitions: new Map<string, CheckpointDefinition>(),
    challenges: new Map<string, VisualChallenge>(),
    receipts: new Map<string, VisualReceipt>(),
    actors: new Set([String(owner), String(other)]),
    admins: new Set([String(author), String(reviewer)]),
    now: Date.now(),
    conceptRevision: 'a'.repeat(64),
    visualizationRevision: 'b'.repeat(64),
    published: true,
    readyFault: false,
    insertFault: false,
    proofFault: false,
    unknownCommit: false,
    cleanupFault: false,
    conflicts: 0,
    bodies: 0,
    closed: 0,
    options: {} as Record<string, unknown>,
    reads: [] as EvidenceRead[],
    afterCommit: undefined as (() => void) | undefined,
  };
  let gate = Promise.resolve();
  const store: CheckpointStore = {
    ...mongoCheckpoint,
    async ready() {
      if (state.readyFault) throw evidenceUnavailable();
    },
    async session() {
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
            definitions: new Map(state.definitions),
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
      if (!state.actors.has(String(user)))
        throw new AppError(403, 'AUTH_FORBIDDEN', 'Forbidden');
    },
    async admin(user, read) {
      state.reads.push(read);
      if (!state.admins.has(String(user)))
        throw new AppError(403, 'AUTH_FORBIDDEN', 'Forbidden');
    },
    async source(c, v) {
      if (!state.published || !c.equals(concept) || !v.equals(visual))
        throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Not found');
      return {
        conceptRevision: state.conceptRevision,
        visualizationRevision: state.visualizationRevision,
      };
    },
    async definition(key) {
      return (
        [...state.definitions.values()].find((d) =>
          '_id' in key
            ? d._id.equals(key._id)
            : d.visualizationId.equals(key.visualizationId) &&
              d.checkpointId === key.checkpointId &&
              d.checkpointVersion === key.checkpointVersion,
        ) ?? null
      );
    },
    async insertDefinition(d) {
      assert.equal(
        [...state.definitions.values()].some(
          (v) =>
            v.visualizationId.equals(d.visualizationId) &&
            v.checkpointId === d.checkpointId &&
            v.checkpointVersion === d.checkpointVersion,
        ),
        false,
      );
      state.definitions.set(String(d._id), checkpointDefinitionRecord.parse(d));
    },
    async fenceDefinition(a, b) {
      if (state.conflicts-- > 0) throw new EvidenceWriteConflict();
      validateDefinitionTransition(a, b);
      assert.deepEqual(state.definitions.get(String(a._id)), a);
      state.definitions.set(String(b._id), checkpointDefinitionRecord.parse(b));
    },
    async visualChallenge(user, key) {
      return (
        [...state.challenges.values()].find(
          (c) =>
            c.userId.equals(user) &&
            ('_id' in key
              ? c._id.equals(key._id)
              : c.issueKeyHash === key.issueKeyHash),
        ) ?? null
      );
    },
    async visualReceipt(user, key, read) {
      if (read.majority && state.proofFault) return null;
      return (
        [...state.receipts.values()].find(
          (r) =>
            r.userId.equals(user) &&
            ('_id' in key
              ? r._id.equals(key._id)
              : r.ackKeyHash === key.ackKeyHash),
        ) ?? null
      );
    },
    async issues(user, d) {
      return [...state.challenges.values()]
        .filter((c) => c.userId.equals(user) && c.definitionId.equals(d))
        .slice(0, 4);
    },
    async insertVisualChallenge(c) {
      assert.equal(
        [...state.challenges.values()].some(
          (v) => v.userId.equals(c.userId) && v.issueKeyHash === c.issueKeyHash,
        ),
        false,
      );
      state.challenges.set(String(c._id), visualChallengeRecord.parse(c));
    },
    async insertVisualReceipt(r) {
      if (state.insertFault) throw new Error('insert');
      assert.equal(
        [...state.receipts.values()].some(
          (v) =>
            v.userId.equals(r.userId) &&
            (v.challengeId.equals(r.challengeId) ||
              v.ackKeyHash === r.ackKeyHash),
        ),
        false,
      );
      state.receipts.set(String(r._id), visualReceiptRecord.parse(r));
    },
    async fenceVisual(a, b) {
      if (state.conflicts-- > 0) throw new EvidenceWriteConflict();
      validateVisualTransition(a, b);
      assert.deepEqual(state.challenges.get(String(a._id)), a);
      state.challenges.set(String(b._id), visualChallengeRecord.parse(b));
    },
  };
  const tokens = createAccessTokens(
    {
      ACCESS_TOKEN_SECRET: Buffer.alloc(32, 15).toString('base64'),
      ACCESS_TOKEN_ISSUER: 'c3b-unit',
      ACCESS_TOKEN_AUDIENCE: 'c3b-unit',
    },
    () => new Date(state.now),
  );
  const tokenFor = (user: Types.ObjectId, role: 'STUDENT' | 'ADMIN') =>
    tokens.sign({ sub: String(user), sid: String(id(9)), role, plan: 'FREE' });
  const student = await tokenFor(owner, 'STUDENT'),
    second = await tokenFor(other, 'STUDENT'),
    admin = await tokenFor(author, 'ADMIN'),
    review = await tokenFor(reviewer, 'ADMIN');
  const repository = createCheckpointRepository(store);
  const service = createVisualizationCheckpointService(
    tokens,
    { APP_ENV: 'LOCAL' },
    repository,
    () => new Date(state.now),
  );
  const body = {
    conceptId: String(concept),
    visualizationId: String(visual),
    checkpointId: 'retained-environment',
    checkpointVersion: 1,
    prompt: 'Which environment remains accessible?',
    textAlternative:
      'A returned function refers to its retained lexical environment.',
    choices: [
      { id: 'retained', label: 'Retained environment' },
      { id: 'discarded', label: 'Discarded frame' },
    ],
    expectedChoiceId: 'retained',
  };
  const create = () => service.author(admin, body, 'unit');
  const approve = (definitionId: string) =>
    service.approve(review, { definitionId }, 'unit');
  const setup = async () => {
    const d = await create();
    await approve(d.id);
    return d.id;
  };
  const issue = (definitionId: string, key = randomUUID(), token = student) =>
    service.issue(token, { definitionId, idempotencyKey: key }, 'unit');
  const submit = (
    challengeId: string,
    choice = 'retained',
    key = randomUUID(),
    token = student,
  ) =>
    service.submit(
      token,
      { challengeId, selectedChoiceId: choice, idempotencyKey: key },
      'unit',
    );
  return {
    state,
    store,
    repository,
    service,
    tokens,
    tokenFor,
    student,
    second,
    admin,
    review,
    body,
    create,
    approve,
    setup,
    issue,
    submit,
  };
}

test('C3b independent Admin review precedes exact allowlisted owned activity result', async () => {
  const f = await fixture(),
    d = await f.create();
  assert.deepEqual(Object.keys(d).sort(), ['id', 'state']);
  await assert.rejects(
    f.issue(d.id),
    code('VISUALIZATION_CHECKPOINT_NOT_FOUND'),
  );
  await assert.rejects(
    f.service.approve(f.admin, { definitionId: d.id }, 'unit'),
    code('AUTH_FORBIDDEN'),
  );
  await f.approve(d.id);
  const c = await f.issue(d.id),
    r = await f.submit(c.id);
  assert.equal(r.outcome, 'CORRECT');
  assert.equal(r.completionQualification, 'NOT_ESTABLISHED');
  assert.deepEqual(Object.keys(r).sort(), [
    'checkpointId',
    'checkpointVersion',
    'completionQualification',
    'conceptId',
    'id',
    'outcome',
    'respondedAt',
    'visualizationId',
  ]);
  const row = f.state.definitions.get(d.id)!;
  assert.ok(row.authoredBy.equals(author));
  assert.ok(row.approvedBy?.equals(reviewer));
  assert.equal(row.approvedFingerprint, row.definitionFingerprint);
});
test('C3b author retry and reviewer retry retain immutable identity and provenance', async () => {
  const f = await fixture(),
    d = await f.create();
  assert.equal((await f.create()).id, d.id);
  await f.approve(d.id);
  const before = f.state.definitions.get(d.id)!;
  await f.approve(d.id);
  assert.equal((await f.create()).id, d.id);
  assert.equal(f.state.definitions.size, 1);
  assert.deepEqual(
    f.state.definitions.get(d.id)!.approvedAt,
    before.approvedAt,
  );
  await assert.rejects(
    f.service.author(f.admin, { ...f.body, prompt: 'Changed' }, 'unit'),
    code('VISUALIZATION_CHECKPOINT_CONFLICT'),
  );
});
test('C3b current Admin eligibility is revalidated, not accepted from JWT or flags', async () => {
  const f = await fixture();
  f.state.admins.delete(String(author));
  await assert.rejects(f.create(), code('AUTH_FORBIDDEN'));
  assert.equal(f.state.definitions.size, 0);
  f.state.admins.add(String(author));
  const d = await f.create();
  f.state.admins.delete(String(reviewer));
  await assert.rejects(f.approve(d.id), code('AUTH_FORBIDDEN'));
  assert.equal(f.state.definitions.get(d.id)!.state, 'DRAFT');
});
test('C3b nonlocal, forged token, Student administration and client metadata fail before writes', async () => {
  const f = await fixture();
  const remote = createVisualizationCheckpointService(
    f.tokens,
    { APP_ENV: 'PRODUCTION' },
    f.repository,
  );
  await assert.rejects(
    remote.author(f.admin, f.body, 'unit'),
    code('ROUTE_NOT_FOUND'),
  );
  await assert.rejects(
    f.service.author('bad', f.body, 'unit'),
    code('AUTH_ACCESS_TOKEN_INVALID'),
  );
  await assert.rejects(
    f.service.author(f.student, f.body, 'unit'),
    code('AUTH_FORBIDDEN'),
  );
  for (const extra of [
    { approved: true },
    { conceptRevision: 'a'.repeat(64) },
    { authoredBy: String(author) },
    { state: 'APPROVED' },
  ])
    await assert.rejects(
      f.service.author(f.admin, { ...f.body, ...extra }, 'unit'),
      code('VALIDATION_ERROR'),
    );
  assert.equal(f.state.definitions.size, 0);
});
test('C3b malformed and ambiguous definitions refuse without persistence', async () => {
  const f = await fixture();
  for (const extra of [
    { choices: [] },
    { choices: [f.body.choices[0], f.body.choices[0]] },
    { expectedChoiceId: 'unknown' },
    { prompt: ' ' },
    { textAlternative: '\ud800' },
    { checkpointVersion: 0 },
  ])
    await assert.rejects(
      f.service.author(f.admin, { ...f.body, ...extra }, 'unit'),
      code('VALIDATION_ERROR'),
    );
  assert.equal(f.state.definitions.size, 0);
});
test('C3b one active challenge and same-issue replay use persisted fenced state', async () => {
  const f = await fixture(),
    d = await f.setup(),
    key = randomUUID(),
    a = await f.issue(d, key),
    b = await f.issue(d, key);
  assert.deepEqual(a, b);
  assert.equal(f.state.challenges.size, 1);
  await assert.rejects(f.issue(d), code('VISUALIZATION_CHECKPOINT_CONFLICT'));
  assert.equal(f.state.challenges.size, 1);
});
test('C3b three fresh issues count consumed, expired and withdrawn history without replay charges', async () => {
  const f = await fixture(),
    d = await f.setup();
  const a = await f.issue(d);
  await f.submit(a.id);
  const b = await f.issue(d);
  await f.service.withdraw(f.student, { challengeId: b.id }, 'unit');
  const c = await f.issue(d);
  f.state.now += 300000;
  await assert.rejects(f.issue(d), code('VISUALIZATION_CHECKPOINT_LIMIT'));
  assert.equal(f.state.challenges.size, 3);
  await assert.rejects(f.submit(c.id), code('SECTION_CHALLENGE_UNAVAILABLE'));
});
test('C3b concurrent identical issue requests converge and different keys cannot bypass one-active', async () => {
  const f = await fixture(),
    d = await f.setup(),
    key = randomUUID();
  const result = await Promise.all([f.issue(d, key), f.issue(d, key)]);
  assert.equal(result[0].id, result[1].id);
  assert.equal(f.state.challenges.size, 1);
  await f.service.withdraw(f.student, { challengeId: result[0].id }, 'unit');
  const fresh = await Promise.allSettled([f.issue(d), f.issue(d)]);
  assert.equal(fresh.filter((v) => v.status === 'fulfilled').length, 1);
  assert.equal(f.state.challenges.size, 2);
});
test('C3b incorrect valid response consumes once with an INCORRECT receipt', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    r = await f.submit(c.id, 'discarded');
  assert.equal(r.outcome, 'INCORRECT');
  assert.equal(f.state.challenges.get(c.id)!.state, 'CONSUMED');
  assert.equal(f.state.receipts.size, 1);
  await assert.rejects(f.submit(c.id), code('SECTION_CHALLENGE_UNAVAILABLE'));
});
test('C3b invalid or unknown selected choice never consumes or advances stored fences', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d);
  const before = JSON.stringify([...f.state.definitions.values()]);
  for (const choice of ['unknown', 'Retained', ' retained', null, ['retained']])
    await assert.rejects(
      f.service.submit(
        f.student,
        {
          challengeId: c.id,
          selectedChoiceId: choice,
          idempotencyKey: randomUUID(),
        },
        'unit',
      ),
      code('VALIDATION_ERROR'),
    );
  assert.equal(f.state.challenges.get(c.id)!.state, 'AVAILABLE');
  assert.equal(f.state.receipts.size, 0);
  assert.equal(JSON.stringify([...f.state.definitions.values()]), before);
});
test('C3b exact response replay retains receipt while changed response conflicts', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    key = randomUUID(),
    r = await f.submit(c.id, 'retained', key);
  assert.deepEqual(await f.submit(c.id, 'retained', key), r);
  await assert.rejects(
    f.submit(c.id, 'discarded', key),
    code('SECTION_EVIDENCE_CONFLICT'),
  );
  assert.equal(f.state.receipts.size, 1);
});
test('C3b concurrent exact submissions converge and distinct keys cannot duplicate a receipt', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    key = randomUUID();
  const rs = await Promise.all([
    f.submit(c.id, 'retained', key),
    f.submit(c.id, 'retained', key),
  ]);
  assert.equal(rs[0].id, rs[1].id);
  assert.equal(f.state.receipts.size, 1);
  const next = await f.issue(d);
  const mixed = await Promise.allSettled([
    f.submit(next.id),
    f.submit(next.id, 'discarded'),
  ]);
  assert.equal(mixed.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.state.receipts.size, 2);
});
test('C3b account ownership derives only from token and current role', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d);
  await assert.rejects(
    f.submit(c.id, 'retained', randomUUID(), f.second),
    code('SECTION_CHALLENGE_NOT_FOUND'),
  );
  await assert.rejects(
    f.service.submit(
      f.student,
      {
        challengeId: c.id,
        selectedChoiceId: 'retained',
        idempotencyKey: randomUUID(),
        userId: String(other),
      },
      'unit',
    ),
    code('VALIDATION_ERROR'),
  );
  f.state.actors.delete(String(owner));
  await assert.rejects(f.submit(c.id), code('AUTH_FORBIDDEN'));
  assert.equal(f.state.receipts.size, 0);
});
test('C3b author and reviewer role loss suppress issuance and replay', async () => {
  for (const actor of [author, reviewer]) {
    const f = await fixture(),
      d = await f.setup(),
      c = await f.issue(d),
      key = randomUUID();
    await f.submit(c.id, 'retained', key);
    f.state.admins.delete(String(actor));
    await assert.rejects(
      f.submit(c.id, 'retained', key),
      code('AUTH_FORBIDDEN'),
    );
    await assert.rejects(f.issue(d), code('AUTH_FORBIDDEN'));
  }
});
test('C3b current publication and both revisions bind issue, response and replay', async () => {
  for (const change of [
    'published',
    'conceptRevision',
    'visualizationRevision',
  ] as const) {
    const f = await fixture(),
      d = await f.setup(),
      c = await f.issue(d);
    if (change === 'published') f.state.published = false;
    else f.state[change] = 'c'.repeat(64);
    await assert.rejects(
      f.submit(c.id),
      code(
        change === 'published'
          ? 'CONCEPT_NOT_FOUND'
          : 'SECTION_CHALLENGE_UNAVAILABLE',
      ),
    );
    assert.equal(f.state.receipts.size, 0);
    assert.equal(f.state.challenges.get(c.id)!.state, 'AVAILABLE');
  }
});
test('C3b exact expiry rejects issue replay, response and committed receipt replay', async () => {
  for (const consumed of [false, true]) {
    const f = await fixture(),
      d = await f.setup(),
      key = randomUUID(),
      c = await f.issue(d, key),
      response = randomUUID();
    if (consumed) await f.submit(c.id, 'retained', response);
    f.state.now += 300000;
    await assert.rejects(
      f.submit(c.id, 'retained', response),
      code('SECTION_CHALLENGE_UNAVAILABLE'),
    );
    await assert.rejects(
      f.issue(d, key),
      code('SECTION_CHALLENGE_UNAVAILABLE'),
    );
  }
});
test('C3b withdrawal is terminal, idempotent and retains committed receipt history', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    key = randomUUID();
  await f.submit(c.id, 'retained', key);
  const first = await f.service.withdraw(
    f.student,
    { challengeId: c.id },
    'unit',
  );
  assert.deepEqual(
    await f.service.withdraw(f.student, { challengeId: c.id }, 'unit'),
    first,
  );
  assert.equal(f.state.receipts.size, 1);
  await assert.rejects(
    f.submit(c.id, 'retained', key),
    code('SECTION_CHALLENGE_UNAVAILABLE'),
  );
});
test('C3b unavailable source does not prevent owned withdrawal or Admin restriction', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d);
  f.state.published = false;
  f.state.now += 300001;
  await f.service.withdraw(f.student, { challengeId: c.id }, 'unit');
  await f.service.revokeDefinition(f.admin, { definitionId: d }, 'unit');
  assert.equal(f.state.challenges.get(c.id)!.state, 'REVOKED');
  assert.equal(f.state.definitions.get(d)!.state, 'REVOKED');
});
test('C3b definition revocation is terminal and blocks issue, consumption and replay', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    key = randomUUID();
  await f.submit(c.id, 'retained', key);
  const result = await f.service.revokeDefinition(
    f.admin,
    { definitionId: d },
    'unit',
  );
  assert.deepEqual(
    await f.service.revokeDefinition(f.review, { definitionId: d }, 'unit'),
    result,
  );
  await assert.rejects(f.issue(d), code('VISUALIZATION_CHECKPOINT_NOT_FOUND'));
  await assert.rejects(
    f.submit(c.id, 'retained', key),
    code('VISUALIZATION_CHECKPOINT_NOT_FOUND'),
  );
  await assert.rejects(
    f.approve(d),
    code('VISUALIZATION_CHECKPOINT_NOT_FOUND'),
  );
  assert.equal(f.state.receipts.size, 1);
});
test('C3b either serialized response/revoke order fails closed after restriction', async () => {
  for (const revokeFirst of [true, false]) {
    const f = await fixture(),
      d = await f.setup(),
      c = await f.issue(d);
    const revoke = () =>
      f.service.revokeDefinition(f.admin, { definitionId: d }, 'unit');
    if (revokeFirst) {
      await revoke();
      await assert.rejects(
        f.submit(c.id),
        code('VISUALIZATION_CHECKPOINT_NOT_FOUND'),
      );
      assert.equal(f.state.receipts.size, 0);
    } else {
      await f.submit(c.id);
      await revoke();
      assert.equal(f.state.receipts.size, 1);
    }
    await assert.rejects(
      f.issue(d),
      code('VISUALIZATION_CHECKPOINT_NOT_FOUND'),
    );
  }
});
test('C3b receipt failure rolls back both fences and consumption atomically', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    before = JSON.stringify([...f.state.definitions.values()]);
  f.state.insertFault = true;
  await assert.rejects(f.submit(c.id), code('DEPENDENCY_UNAVAILABLE'));
  assert.equal(f.state.challenges.get(c.id)!.state, 'AVAILABLE');
  assert.equal(f.state.receipts.size, 0);
  assert.equal(JSON.stringify([...f.state.definitions.values()]), before);
});
test('C3b uncertainty retains possible committed history but discloses no receipt', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    key = randomUUID();
  f.state.unknownCommit = true;
  await assert.rejects(
    f.submit(c.id, 'retained', key),
    code('SECTION_EVIDENCE_UNCONFIRMED'),
  );
  assert.equal(f.state.receipts.size, 1);
  f.state.unknownCommit = false;
  assert.equal((await f.submit(c.id, 'retained', key)).outcome, 'CORRECT');
  assert.equal(f.state.receipts.size, 1);
});
test('C3b missing owned proof and cleanup failure suppress committed success', async () => {
  for (const flag of ['proofFault', 'cleanupFault'] as const) {
    const f = await fixture(),
      d = await f.setup(),
      c = await f.issue(d);
    f.state[flag] = true;
    await assert.rejects(f.submit(c.id), code('SECTION_EVIDENCE_UNCONFIRMED'));
    assert.equal(f.state.receipts.size, 1);
    assert.ok(f.state.closed > 0);
  }
});
test('C3b postcommit authorization/publication/revocation changes suppress results', async () => {
  for (const change of ['actor', 'publication', 'definition'] as const) {
    const f = await fixture(),
      d = await f.setup(),
      c = await f.issue(d);
    f.state.afterCommit = () => {
      if (change === 'actor') f.state.actors.delete(String(owner));
      else if (change === 'publication') f.state.published = false;
      else {
        const row = f.state.definitions.get(d)!;
        f.state.definitions.set(d, {
          ...row,
          state: 'REVOKED',
          revokedBy: author,
          revokedAt: new Date(f.state.now),
          decisionFence: row.decisionFence + 1,
        });
      }
    };
    await assert.rejects(f.submit(c.id));
    assert.equal(f.state.receipts.size, 1);
  }
});
test('C3b exact readiness is mandatory and transaction settings preserve majority and bounds', async () => {
  const f = await fixture(),
    d = await f.setup();
  f.state.readyFault = true;
  const bodies = f.state.bodies;
  await assert.rejects(f.issue(d), code('DEPENDENCY_UNAVAILABLE'));
  assert.equal(f.state.bodies, bodies);
  f.state.readyFault = false;
  f.state.conflicts = 2;
  await f.issue(d);
  assert.deepEqual(f.state.options.writeConcern, { w: 'majority', j: true });
  assert.ok(Number(f.state.options.timeoutMS) <= 8000);
  assert.ok(f.state.reads.some((r) => r.majority));
});
test('C3b excessive conflicts and exhausted budget start no unbounded transaction', async () => {
  const f = await fixture(),
    d = await f.setup();
  f.state.conflicts = 10;
  const before = f.state.bodies;
  await assert.rejects(f.issue(d), code('DEPENDENCY_UNAVAILABLE'));
  assert.equal(f.state.bodies - before, 3);
  assert.equal(f.state.challenges.size, 0);
  let clock = 0;
  const repo = createCheckpointRepository(f.store, () => {
    clock += 10001;
    return clock;
  });
  const s = createVisualizationCheckpointService(
    f.tokens,
    { APP_ENV: 'LOCAL' },
    repo,
  );
  await assert.rejects(
    s.issue(
      f.student,
      { definitionId: d, idempotencyKey: randomUUID() },
      'unit',
    ),
    code('DEPENDENCY_UNAVAILABLE'),
  );
});
test('C3b index verifier rejects missing, nonunique, reordered and alternate options for every definition', () => {
  for (const expected of checkpointIndexes) {
    const row = { name: expected.name, key: expected.key, v: 2, unique: true };
    verifyEvidenceIndex([row], expected);
    for (const bad of [
      null,
      { ...row, unique: false },
      { ...row, key: { other: 1 } },
      { ...row, partialFilterExpression: { active: true } },
      { ...row, collation: { locale: 'en' } },
      { ...row, hidden: true },
    ])
      assert.throws(() => verifyEvidenceIndex(bad ? [bad] : [], expected));
    if (Object.keys(expected.key).length > 1)
      assert.throws(() =>
        verifyEvidenceIndex(
          [
            {
              ...row,
              key: Object.fromEntries(Object.entries(expected.key).reverse()),
            },
          ],
          expected,
        ),
      );
  }
});
test('C3b stored definition and challenge mutators reject identity changes, approval edits and revival', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    row = f.state.definitions.get(d)!,
    challenge = f.state.challenges.get(c.id)!;
  for (const delta of [
    { prompt: 'Changed' },
    { approvedBy: author },
    { state: 'DRAFT' },
    { definitionFingerprint: 'd'.repeat(64) },
  ])
    assert.throws(() =>
      validateDefinitionTransition(row, {
        ...row,
        ...delta,
        decisionFence: row.decisionFence + 1,
      } as CheckpointDefinition),
    );
  assert.throws(() =>
    validateVisualTransition(challenge, {
      ...challenge,
      userId: other,
      decisionFence: 1,
    }),
  );
  assert.throws(() =>
    visualChallengeRecord.parse({
      ...challenge,
      sectionRevision: 'c'.repeat(64),
    }),
  );
  const model = new VisualizationCheckpointDefinition(row);
  await model.validate();
  model.isNew = false;
  await assert.rejects(model.save());
  await assert.rejects(VisualizationCheckpointDefinition.deleteMany({}));
});
test('C3b shared models validate strict VISUALIZE branches without enabling unsupported writes', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d);
  await f.submit(c.id);
  const challenge = f.state.challenges.get(c.id)!,
    receipt = [...f.state.receipts.values()][0]!;
  await new SectionEvidenceChallenge(challenge).validate();
  await new SectionActivityReceipt(receipt).validate();
  assert.throws(() =>
    visualReceiptRecord.parse({ ...receipt, expectedChoiceId: 'retained' }),
  );
  assert.throws(() =>
    visualReceiptRecord.parse({
      ...receipt,
      acknowledgedAt: receipt.respondedAt,
    }),
  );
  assert.equal(
    VisualizationCheckpointDefinition.schema.options.autoCreate,
    false,
  );
  assert.equal(
    VisualizationCheckpointDefinition.schema.options.autoIndex,
    false,
  );
});
test('C3b forged ownership, fingerprint and outcome do not pass durable replay proof', async () => {
  for (const change of ['user', 'fingerprint', 'outcome'] as const) {
    const f = await fixture(),
      d = await f.setup(),
      c = await f.issue(d),
      key = randomUUID();
    await f.submit(c.id, 'retained', key);
    const r = [...f.state.receipts.values()][0]!;
    f.state.receipts.set(String(r._id), {
      ...r,
      ...(change === 'user'
        ? { userId: other }
        : change === 'fingerprint'
          ? { requestFingerprint: 'd'.repeat(64) }
          : { outcome: 'INCORRECT' }),
    });
    await assert.rejects(f.submit(c.id, 'retained', key));
    assert.equal(f.state.receipts.size, 1);
  }
});
test('C3b snapshot validation binds actual graph references/text and never repairs stored whitespace', async () => {
  const row = {
    _id: visual,
    conceptId: concept,
    topicId: topic,
    technologyId: tech,
    type: 'ANIMATED_FLOW',
    schemaVersion: 1,
    title: 'Graph',
    textAlternative: 'Text',
    nodes: [{ id: 'a', label: 'A' }],
    edges: [],
    steps: [
      { title: 'Step', explanation: 'Text', nodeIds: ['a'], edgeIds: [] },
    ],
    status: 'PUBLISHED',
    createdBy: author,
    updatedBy: author,
  };
  const scope = { conceptId: concept, topicId: topic, technologyId: tech },
    hash = await checkpointVisualizationRevision(row, scope);
  assert.equal(hash.length, 64);
  assert.notEqual(
    await checkpointVisualizationRevision({ ...row, title: 'Other' }, scope),
    hash,
  );
  await assert.rejects(
    checkpointVisualizationRevision({ ...row, title: ' Graph' }, scope),
  );
  await assert.rejects(
    checkpointVisualizationRevision({ ...row, conceptId: other }, scope),
  );
  await assert.rejects(
    checkpointVisualizationRevision(
      { ...row, steps: [{ ...row.steps[0], nodeIds: ['unknown'] }] },
      scope,
    ),
  );
});
test('C3b accessibility paths share stable textual choices without accepting playback or timing claims', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d);
  assert.ok(c.prompt.length > 0);
  assert.ok(c.textAlternative.length > 0);
  assert.equal(c.choices.length, 2);
  for (const extra of [
    { playbackCompleted: true },
    { elapsedMs: 999999 },
    { interactionMode: 'mouse' },
    { approved: true },
    { expectedChoiceId: 'retained' },
  ])
    await assert.rejects(
      f.service.submit(
        f.student,
        {
          challengeId: c.id,
          selectedChoiceId: 'retained',
          idempotencyKey: randomUUID(),
          ...extra,
        },
        'unit',
      ),
      code('VALIDATION_ERROR'),
    );
  const r = await f.submit(c.id);
  assert.equal(r.outcome, 'CORRECT');
});
test('C3b storage/output contain no raw expected choice copies, scores or completion and source has no automatic caller', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d),
    r = await f.submit(c.id);
  for (const row of [
    c,
    r,
    ...f.state.challenges.values(),
    ...f.state.receipts.values(),
  ])
    for (const key of [
      'expectedChoiceId',
      'selectedChoiceId',
      'answer',
      'score',
      'completionStatus',
      'accessToken',
      'idempotencyKey',
    ])
      assert.equal(Object.hasOwn(row, key), false);
  for (const file of [
    'visualization-checkpoint.service.ts',
    'visualization-checkpoint.repository.ts',
  ]) {
    const source = readFileSync(
      new URL(`../src/modules/visualizations/${file}`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(
      source,
      /console\.|logger\.|createPracticeGradingService|studentProgress|practiceAttempts|evaluateCompletionPolicy|setInterval\(|fetch\(/,
    );
  }
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(
    definitionFingerprint(f.state.definitions.get(d)!),
    f.state.definitions.get(d)!.definitionFingerprint,
  );
});

test('C3b native readiness checks catalog options without opening a database connection', async () => {
  const prior = mongoose.connection.db,
    connection = mongoose.connection as unknown as { db: typeof prior };
  let fault = '';
  const requested: string[] = [];
  connection.db = {
    admin() {
      return {
        async command() {
          return {
            isWritablePrimary: true,
            setName: 'f021-test',
            logicalSessionTimeoutMinutes: 30,
          };
        },
      };
    },
    listCollections({ name }: { name: string }) {
      requested.push(name);
      return {
        async toArray() {
          return [{ name, type: 'collection', options: {} }];
        },
      };
    },
    collection(name: string) {
      return {
        async indexes() {
          const rows: Record<string, unknown>[] = [
            { name: '_id_', key: { _id: 1 }, v: 2 },
            ...checkpointIndexes
              .filter((i) => i.collection === name)
              .map((i) => ({ name: i.name, key: i.key, v: 2, unique: true })),
          ];
          if (name === 'visualizationCheckpointDefinitions') {
            if (fault === 'missing')
              return rows.filter((r) => r.name === '_id_');
            if (fault === 'nonunique') rows[1]!.unique = false;
            if (fault === 'partial')
              rows[1]!.partialFilterExpression = { active: true };
          }
          return rows;
        },
      };
    },
  } as unknown as NonNullable<typeof prior>;
  try {
    await mongoCheckpoint.ready(5000);
    assert.ok(requested.includes('visualizationCheckpointDefinitions'));
    for (fault of ['missing', 'nonunique', 'partial'])
      await assert.rejects(
        mongoCheckpoint.ready(5000),
        code('DEPENDENCY_UNAVAILABLE'),
      );
  } finally {
    connection.db = prior;
  }
  assert.equal(mongoose.connection.readyState, 0);
});

test('C3b simultaneous withdrawal or definition revocation never permits later replay', async () => {
  for (const kind of ['withdraw', 'definition'] as const) {
    const f = await fixture(),
      d = await f.setup(),
      c = await f.issue(d),
      key = randomUUID();
    const restricted =
      kind === 'withdraw'
        ? f.service.withdraw(f.student, { challengeId: c.id }, 'unit')
        : f.service.revokeDefinition(f.admin, { definitionId: d }, 'unit');
    const settled = await Promise.allSettled([
      f.submit(c.id, 'retained', key),
      restricted,
    ]);
    assert.equal(settled[1].status, 'fulfilled');
    assert.ok(f.state.receipts.size <= 1);
    await assert.rejects(f.submit(c.id, 'retained', key));
    assert.equal(
      f.state.challenges.get(c.id)!.state,
      kind === 'withdraw'
        ? 'REVOKED'
        : f.state.receipts.size
          ? 'CONSUMED'
          : 'AVAILABLE',
    );
  }
});

test('C3b account budgets are isolated and simultaneous final issues cannot exceed three', async () => {
  const f = await fixture(),
    d = await f.setup();
  for (let i = 0; i < 2; i++) {
    const c = await f.issue(d);
    await f.service.withdraw(f.student, { challengeId: c.id }, 'unit');
  }
  const settled = await Promise.allSettled([f.issue(d), f.issue(d)]);
  assert.equal(settled.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    [...f.state.challenges.values()].filter((c) => c.userId.equals(owner))
      .length,
    3,
  );
  await f.issue(d, randomUUID(), f.second);
  assert.equal(
    [...f.state.challenges.values()].filter((c) => c.userId.equals(other))
      .length,
    1,
  );
});

test('C3b every forged checkpoint/definition binding fails before receipt creation', async () => {
  for (const delta of [
    { conceptId: other },
    { visualizationId: other },
    { definitionId: other },
    { checkpointId: 'other' },
    { checkpointVersion: 2 },
    { policyVersion: 2 },
    { definitionFingerprint: 'd'.repeat(64) },
  ]) {
    const f = await fixture(),
      d = await f.setup(),
      c = await f.issue(d),
      row = f.state.challenges.get(c.id)!;
    f.state.challenges.set(c.id, { ...row, ...delta } as VisualChallenge);
    await assert.rejects(f.submit(c.id));
    assert.equal(f.state.receipts.size, 0);
  }
});

test('C3b current role transition during proof blocks success without deleting committed activity', async () => {
  const f = await fixture(),
    d = await f.setup(),
    c = await f.issue(d);
  f.state.afterCommit = () => f.state.admins.delete(String(reviewer));
  await assert.rejects(f.submit(c.id), code('AUTH_FORBIDDEN'));
  assert.equal(f.state.receipts.size, 1);
});

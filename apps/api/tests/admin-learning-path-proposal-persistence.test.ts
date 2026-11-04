import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { Types } from 'mongoose';
import type { Db, MongoClient } from 'mongodb';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import {
  createAdminLearningPathProposalService,
  type ProposalAuthority,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal.service.js';
import {
  adminLearningPathProposalRepository,
  proposalPersistenceIndexes,
  proposalUnknown,
  type ProposalRepository,
  type ProposalReader,
  type ProposalTransaction,
  type ProposalWork,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal.repository.js';
import {
  proposalData,
  validateProposalStructure,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';
import {
  curriculumBriefDigest,
  validateCurriculumBriefStructure,
} from '../src/modules/admin/learning-paths/admin-curriculum-brief.schema.js';
import { createProposalIntegrationLifetime } from './admin-learning-path-proposal-persistence.integration.js';

const actor = {
  sub: 'a'.repeat(24),
  sid: 'b'.repeat(24),
  role: 'ADMIN' as const,
  plan: 'FREE' as const,
};
const technologyId = 'c'.repeat(24);
const now = new Date('2026-11-04T00:00:00.000Z');
function input() {
  return {
    technologyId,
    operationId: '12345678-1234-4123-8123-123456789abc',
    title: 'JavaScript foundation',
    objectives: ['Understand values'],
    audience: 'New developers',
    depth: 'BEGINNER',
    runtime: null,
    technologyVersion: null,
    prerequisites: [],
  };
}
type Row = Record<string, unknown>;
const clone = <T>(value: T): T => proposalData(value) as T;
const key = (value: unknown) =>
  value instanceof Types.ObjectId ? value.toHexString() : String(value);
function failure(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, code);
    assert.ok(!error.message.includes('PRIVATE'));
    assert.equal(error.details, undefined);
    assert.equal(error.cause, undefined);
    return true;
  };
}
function fixture() {
  const state = {
    account: {
      _id: new Types.ObjectId(actor.sub),
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: now,
      __v: 0,
    } as Row | null,
    technology: {
      _id: new Types.ObjectId(technologyId),
      status: 'DRAFT',
    } as Row | null,
    briefs: new Map<string, Row>(),
    proposals: new Map<string, Row>(),
    audits: new Map<string, Row>(),
    transactions: 0,
    commits: 0,
    aborts: 0,
    fences: 0,
    reads: 0,
    verifies: 0,
    ticks: 0,
    stage: '',
    fenceLost: false,
    unknownCommit: false,
    cleanupFailed: false,
    actorLookups: [] as string[],
    order: [] as string[],
    beforeCommit: undefined as (() => void) | undefined,
    sourceRead: undefined as (() => void) | undefined,
  };
  const hit = (name: string) => {
    state.order.push(name);
    if (state.stage === name) throw new Error('PRIVATE_' + name);
  };
  type Store = {
    briefs: Map<string, Row>;
    proposals: Map<string, Row>;
    audits: Map<string, Row>;
    account: Row | null;
    technology: Row | null;
  };
  function reader(store: Store): ProposalReader {
    return {
      async actor(id) {
        hit('actor');
        state.actorLookups.push(key(id));
        return store.account && key(store.account._id) === key(id)
          ? clone(store.account)
          : null;
      },
      async technology() {
        hit('technology');
        return store.technology ? clone(store.technology) : null;
      },
      async brief(id) {
        hit('brief');
        state.sourceRead?.();
        return clone(store.briefs.get(key(id)) ?? null);
      },
      async operation(id, operationId) {
        hit('operation');
        return clone(
          [...store.briefs.values()].find(
            (row) =>
              key(row.createdBy) === key(id) && row.operationId === operationId,
          ) ?? null,
        );
      },
      async proposal(id) {
        hit('proposal');
        return clone(store.proposals.get(key(id)) ?? null);
      },
      async revision(family, revision) {
        hit('revision');
        return clone(
          [...store.proposals.values()].find(
            (row) =>
              key(row.proposalId) === key(family) && row.revision === revision,
          ) ?? null,
        );
      },
      async latest(family) {
        hit('latest');
        return clone(
          [...store.proposals.values()]
            .filter((row) => key(row.proposalId) === key(family))
            .sort((a, b) => Number(b.revision) - Number(a.revision))[0] ?? null,
        );
      },
      async audit(id) {
        hit('audit');
        return clone(store.audits.get(key(id)) ?? null);
      },
    };
  }
  const repository: ProposalRepository = {
    async read(work, operation) {
      state.reads++;
      work.check();
      const out = await operation(reader(state));
      work.check();
      return out;
    },
    async transaction(work, operation) {
      state.transactions++;
      const copy: Store = {
        account: clone(state.account),
        technology: clone(state.technology),
        briefs: new Map([...state.briefs].map(([id, row]) => [id, clone(row)])),
        proposals: new Map(
          [...state.proposals].map(([id, row]) => [id, clone(row)]),
        ),
        audits: new Map([...state.audits].map(([id, row]) => [id, clone(row)])),
      };
      let auditing = 0;
      const tx: ProposalTransaction = {
        ...reader(copy),
        async fence(id, version, verifiedAt) {
          hit('fence');
          work.mutation();
          state.fences++;
          if (
            state.fenceLost ||
            !copy.account ||
            key(copy.account._id) !== key(id) ||
            copy.account.__v !== version ||
            copy.account.role !== 'ADMIN' ||
            copy.account.status !== 'ACTIVE' ||
            !(copy.account.emailVerifiedAt instanceof Date) ||
            copy.account.emailVerifiedAt.getTime() !== verifiedAt.getTime()
          )
            return false;
          copy.account.__v = version + 1;
          return true;
        },
        async insertBrief(row) {
          hit('insertBrief');
          work.mutation();
          if (
            [...copy.briefs.values()].some(
              (value) =>
                key(value.createdBy) === key(row.createdBy) &&
                value.operationId === row.operationId,
            )
          )
            throw { code: 11000, keyPattern: { createdBy: 1, operationId: 1 } };
          copy.briefs.set(key(row._id), clone(row));
        },
        async insertProposal(row) {
          hit('insertProposal');
          work.mutation();
          if (
            [...copy.proposals.values()].some(
              (value) =>
                key(value.proposalId) === key(row.proposalId) &&
                value.revision === row.revision,
            )
          )
            throw { code: 11000, keyPattern: { proposalId: 1, revision: 1 } };
          copy.proposals.set(key(row._id), clone(row));
        },
        async insertAudit(row) {
          hit('insertAudit' + ++auditing);
          work.mutation();
          await new Audit(row).validate();
          copy.audits.set(key(row._id), clone(row));
        },
      };
      let committing = false;
      try {
        const value = await operation(tx);
        state.beforeCommit?.();
        work.check();
        await work.verify();
        work.check();
        work.commit();
        committing = true;
        state.account = copy.account;
        state.briefs = copy.briefs;
        state.proposals = copy.proposals;
        state.audits = copy.audits;
        state.commits++;
        if (state.unknownCommit || state.cleanupFailed) {
          if (state.cleanupFailed) work.uncertain();
          throw proposalUnknown();
        }
        return value;
      } catch (error) {
        if (!committing) state.aborts++;
        throw error;
      }
    },
  };
  const authority: ProposalAuthority = {
    actor: { ...actor },
    verify: async () => {
      state.verifies++;
      return { ...authority.actor! };
    },
  };
  let sequence = 1;
  const service = createAdminLearningPathProposalService(
    repository,
    () => state.ticks,
    () => new Date(now),
    () => new Types.ObjectId((sequence++).toString(16).padStart(24, '0')),
  );
  return { state, repository, service, authority };
}
async function seeded() {
  const f = fixture();
  const dto = await f.service.capture(input(), 'request', f.authority);
  const row = validateProposalStructure(f.state.proposals.get(dto.id));
  return { ...f, dto, row };
}
function revised(row: ReturnType<typeof validateProposalStructure>) {
  return {
    ...input(),
    proposalId: row.proposalId,
    predecessor: row,
    title: 'Revised brief',
    operationId: undefined,
  };
}
function revisionInput(row: ReturnType<typeof validateProposalStructure>) {
  const { operationId: _ignored, ...body } = revised(row);
  void _ignored;
  return body;
}

test('capture fences current actor and commits exactly brief/proposal/two audits', async () => {
  const f = await seeded();
  assert.equal(f.state.commits, 1);
  assert.equal(f.state.briefs.size, 1);
  assert.equal(f.state.proposals.size, 1);
  assert.equal(f.state.audits.size, 2);
  assert.equal(f.state.account?.__v, 1);
  const brief = validateCurriculumBriefStructure(
    [...f.state.briefs.values()][0],
  );
  assert.equal(f.row.proposalId, brief._id);
  assert.equal(f.row.source.digest, brief.contentDigest);
  assert.notEqual(f.row._id, brief._id);
  assert.deepEqual(
    [...f.state.audits.values()].map((row) => row.action),
    ['CURRICULUM_BRIEF_ADMITTED', 'LEARNING_PATH_PROPOSAL_REVISION_CREATED'],
  );
  assert.ok(
    f.state.order.indexOf('fence') < f.state.order.indexOf('insertBrief'),
  );
  for (const privateValue of [
    brief.contentDigest,
    brief.operationId,
    brief.createdBy,
    f.row.definitionDigest,
  ])
    assert.ok(!JSON.stringify(f.dto).includes(privateValue));
});
test('same actor/key and exact payload reconciles without another fence/write', async () => {
  const f = await seeded(),
    before = f.state.fences;
  assert.deepEqual(
    await f.service.capture(input(), 'another_request', f.authority),
    f.dto,
  );
  assert.deepEqual(
    await f.service.reconcile(
      { technologyId, operationId: input().operationId },
      f.authority,
    ),
    { state: 'COMMITTED', proposal: f.dto },
  );
  assert.equal(f.state.transactions, 1);
  assert.equal(f.state.fences, before);
  assert.equal(f.state.commits, 1);
});
for (const change of [{ title: 'Changed' }, { technologyId: 'd'.repeat(24) }])
  test(`same actor/key conflicts on ${Object.keys(change)[0]}`, async () => {
    const f = await seeded();
    await assert.rejects(
      f.service.capture({ ...input(), ...change }, 'request', f.authority),
      failure('PROPOSAL_CONFLICT'),
    );
    assert.equal(f.state.commits, 1);
  });
for (const change of [
  { role: 'STUDENT' },
  { status: 'DISABLED' },
  { status: 'SUSPENDED' },
  { status: 'PENDING_VERIFICATION' },
  { emailVerifiedAt: null },
])
  test(`current stored eligibility refuses ${Object.keys(change)[0]}-${Object.values(change)[0]}`, async () => {
    const f = fixture();
    Object.assign(f.state.account!, change);
    await assert.rejects(
      f.service.capture(input(), 'request', f.authority),
      failure('AUTH_FORBIDDEN'),
    );
    assert.equal(f.state.fences, 0);
    assert.equal(f.state.briefs.size, 0);
  });
test('deleted actor, stale User version and stored identity mismatch fail closed', async () => {
  const deleted = fixture();
  deleted.state.account = null;
  await assert.rejects(
    deleted.service.capture(input(), 'request', deleted.authority),
    failure('AUTH_FORBIDDEN'),
  );
  const lost = fixture();
  lost.state.fenceLost = true;
  await assert.rejects(
    lost.service.capture(input(), 'request', lost.authority),
    failure('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(lost.state.commits, 0);
  const malformed = fixture();
  malformed.state.account!.__v = Number.MAX_SAFE_INTEGER;
  await assert.rejects(
    malformed.service.capture(input(), 'request', malformed.authority),
    failure('DEPENDENCY_UNAVAILABLE'),
  );
});
test('missing/Admin JWT mismatch and changed verified context refuse before mutation', async () => {
  const f = fixture();
  f.authority.actor = undefined;
  await assert.rejects(
    f.service.capture(input(), 'request', f.authority),
    failure('AUTH_ACCESS_TOKEN_MISSING'),
  );
  const student = fixture();
  student.authority.actor = { ...actor, role: 'STUDENT' };
  await assert.rejects(
    student.service.capture(input(), 'request', student.authority),
    failure('AUTH_FORBIDDEN'),
  );
  for (const change of [
    { sub: 'd'.repeat(24) },
    { sid: 'd'.repeat(24) },
    { plan: 'PREMIUM' as const },
  ]) {
    const changed = fixture();
    changed.authority.verify = async () => ({ ...actor, ...change });
    await assert.rejects(
      changed.service.capture(input(), 'request', changed.authority),
      failure('AUTH_FORBIDDEN'),
    );
    assert.equal(changed.state.fences, 0);
  }
});
for (const [n, change] of [
  { actorId: actor.sub },
  { createdBy: actor.sub },
  { createdAt: now },
  { status: 'APPROVED' },
  { source: {} },
  { revision: 1 },
  { $set: {} },
  { operationId: 'not-a-key' },
  { objectives: ['x', 'x'] },
  { unknown: { stack: 'PRIVATE' } },
].entries())
  test(`capture rejects invalid/caller-owned field case ${n}`, () => {
    const f = fixture();
    assert.throws(
      () =>
        f.service.capture({ ...input(), ...change }, 'request', f.authority),
      failure('VALIDATION_ERROR'),
    );
    assert.equal(f.state.transactions, 0);
  });
for (const stage of [
  'insertBrief',
  'insertAudit1',
  'insertProposal',
  'insertAudit2',
])
  test(`mock transaction aborts entire capture at ${stage}`, async () => {
    const f = fixture();
    f.state.stage = stage;
    await assert.rejects(
      f.service.capture(input(), 'request', f.authority),
      failure('DEPENDENCY_UNAVAILABLE'),
    );
    assert.equal(f.state.aborts, 1);
    assert.equal(f.state.commits, 0);
    assert.equal(f.state.account?.__v, 0);
    assert.equal(
      f.state.briefs.size + f.state.proposals.size + f.state.audits.size,
      0,
    );
  });
test('known uniqueness conflict refuses once; no retry or partial writes', async () => {
  const f = fixture();
  f.repository.transaction = async () => {
    f.state.transactions++;
    throw {
      code: 11000,
      keyPattern: { createdBy: 1, operationId: 1 },
      message: 'PRIVATE',
    };
  };
  await assert.rejects(
    f.service.capture(input(), 'request', f.authority),
    failure('PROPOSAL_CONFLICT'),
  );
  assert.equal(f.state.transactions, 1);
  const other = fixture();
  other.repository.transaction = async () => {
    throw { code: 11000, keyPattern: { email: 1 }, message: 'PRIVATE' };
  };
  await assert.rejects(
    other.service.capture(input(), 'request', other.authority),
    failure('DEPENDENCY_UNAVAILABLE'),
  );
});
test('postcommit loss is UNKNOWN; explicit read reconciles without replay', async () => {
  const f = fixture();
  f.state.unknownCommit = true;
  await assert.rejects(
    f.service.capture(input(), 'request', f.authority),
    failure('PROPOSAL_OUTCOME_UNKNOWN'),
  );
  assert.equal(f.state.commits, 1);
  const fences = f.state.fences;
  const result = await f.service.reconcile(
    { technologyId, operationId: input().operationId },
    f.authority,
  );
  assert.equal(result.state, 'COMMITTED');
  assert.equal(f.state.commits, 1);
  assert.equal(f.state.fences, fences);
});
test('missing evidence remains UNRESOLVED; read recovery never writes', async () => {
  const f = fixture();
  assert.deepEqual(
    await f.service.reconcile(
      { technologyId, operationId: input().operationId },
      f.authority,
    ),
    { state: 'UNRESOLVED' },
  );
  assert.equal(f.state.transactions, 0);
  assert.equal(f.state.fences, 0);
});
test('cross-actor operation lookup reveals no prior actor result', async () => {
  const f = await seeded();
  const other = { ...actor, sub: 'd'.repeat(24), sid: 'e'.repeat(24) };
  f.authority.actor = other;
  f.state.account!._id = new Types.ObjectId(other.sub);
  assert.deepEqual(
    await f.service.reconcile(
      { technologyId, operationId: input().operationId },
      f.authority,
    ),
    { state: 'UNRESOLVED' },
  );
});
test('archived parent inspection works but writes refuse; deletion preserves evidence', async () => {
  const f = await seeded();
  f.state.technology!.status = 'ARCHIVED';
  assert.equal(
    (
      await f.service.reconcile(
        { technologyId, operationId: input().operationId },
        f.authority,
      )
    ).state,
    'COMMITTED',
  );
  await assert.rejects(
    f.service.capture(
      { ...input(), operationId: '12345678-1234-4123-9123-123456789abc' },
      'request',
      f.authority,
    ),
    failure('TECHNOLOGY_READ_ONLY'),
  );
  f.state.technology = null;
  await assert.rejects(
    f.service.reconcile(
      { technologyId, operationId: input().operationId },
      f.authority,
    ),
    failure('TECHNOLOGY_NOT_FOUND'),
  );
  assert.equal(f.state.briefs.size, 1);
  assert.equal(f.state.audits.size, 2);
});
test('snapshot parent archival after transaction read may coexist with private commit', async () => {
  const f = fixture();
  f.state.beforeCommit = () => {
    f.state.technology!.status = 'ARCHIVED';
  };
  await f.service.capture(input(), 'request', f.authority);
  assert.equal(f.state.commits, 1);
  assert.equal(f.state.technology?.status, 'ARCHIVED');
  // This verifies the declared mock boundary only, not real MongoDB lifecycle races.
});
for (const corrupt of [
  'sourceDigest',
  'sourceActor',
  'missingAdmissionAudit',
  'missingProposalAudit',
  'proposalContent',
])
  test(`corrupt/partial capture cannot reconcile as success: ${corrupt}`, async () => {
    const f = await seeded();
    const brief = [...f.state.briefs.values()][0]!;
    if (corrupt === 'sourceDigest') brief.contentDigest = 'f'.repeat(64);
    if (corrupt === 'sourceActor') {
      const row = validateCurriculumBriefStructure(brief);
      row.createdBy = 'd'.repeat(24);
      const { contentDigest: _digest, ...body } = row;
      void _digest;
      f.state.briefs.set(row._id, {
        ...row,
        contentDigest: curriculumBriefDigest(body),
      });
    }
    if (corrupt === 'missingAdmissionAudit')
      f.state.audits.delete(key(brief._id));
    if (corrupt === 'missingProposalAudit') f.state.audits.delete(f.dto.id);
    if (corrupt === 'proposalContent')
      f.state.proposals.get(f.dto.id)!.title = 'Tampered';
    if (corrupt === 'sourceActor') {
      // Changed indexed actor removes the row from this actor/key lookup. Absence
      // cannot distinguish corruption/nonexistence and never grants safe replay.
      assert.deepEqual(
        await f.service.reconcile(
          { technologyId, operationId: input().operationId },
          f.authority,
        ),
        { state: 'UNRESOLVED' },
      );
    } else {
      await assert.rejects(
        f.service.reconcile(
          { technologyId, operationId: input().operationId },
          f.authority,
        ),
        failure('PROPOSAL_OUTCOME_UNKNOWN'),
      );
      await assert.rejects(
        f.service.capture(input(), 'read-again', f.authority),
        failure('PROPOSAL_OUTCOME_UNKNOWN'),
      );
    }
    assert.equal(f.state.commits, 1);
  });
test('prepared later revision consumes authoritative source and immediate stored predecessor', async () => {
  const f = await seeded();
  const handle = f.service.prepareRevision(
    revisionInput(f.row),
    'revision_request',
    actor,
  );
  const dto = await f.service.persistRevision(handle, f.authority);
  assert.equal(dto.revision, 2);
  assert.equal(dto.source.id, f.row.source.id);
  assert.equal(f.state.briefs.size, 1);
  assert.equal(f.state.proposals.size, 2);
  assert.equal(f.state.audits.size, 3);
  await assert.rejects(
    f.service.persistRevision(handle, f.authority),
    failure('PROPOSAL_CONFLICT'),
  );
  assert.equal(
    (await f.service.reconcileRevision(handle, f.authority)).state,
    'COMMITTED',
  );
});
test('competing prepared commands never skip a newer stored predecessor', async () => {
  const f = await seeded();
  const a = f.service.prepareRevision(revisionInput(f.row), 'rev_a', actor),
    b = f.service.prepareRevision(revisionInput(f.row), 'rev_b', actor);
  await f.service.persistRevision(a, f.authority);
  await assert.rejects(
    f.service.persistRevision(b, f.authority),
    failure('PROPOSAL_CONFLICT'),
  );
  assert.equal(f.state.proposals.size, 2);
  assert.equal(f.state.commits, 2);
});
test('historical author deletion/demotion does not invalidate input for another current Admin', async () => {
  const f = await seeded();
  const other = { ...actor, sub: 'd'.repeat(24), sid: 'e'.repeat(24) };
  f.authority.actor = other;
  f.state.account!._id = new Types.ObjectId(other.sub);
  f.state.actorLookups = [];
  const handle = f.service.prepareRevision(
    revisionInput(f.row),
    'other_admin',
    other,
  );
  await f.service.persistRevision(handle, f.authority);
  assert.ok(f.state.actorLookups.every((id) => id === other.sub));
  assert.equal(
    validateCurriculumBriefStructure([...f.state.briefs.values()][0]).createdBy,
    actor.sub,
  );
});
test('revision source corruption, family substitution and forged handle refuse', async () => {
  const f = await seeded();
  assert.throws(
    () =>
      f.service.prepareRevision(
        { ...revisionInput(f.row), proposalId: 'd'.repeat(24) },
        'request',
        actor,
      ),
    failure('VALIDATION_ERROR'),
  );
  await assert.rejects(
    f.service.persistRevision({ id: f.dto.id }, f.authority),
    failure('PROPOSAL_CONFLICT'),
  );
  const handle = f.service.prepareRevision(
    revisionInput(f.row),
    'request',
    actor,
  );
  [...f.state.briefs.values()][0]!.contentDigest = 'f'.repeat(64);
  await assert.rejects(
    f.service.persistRevision(handle, f.authority),
    failure('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(f.state.proposals.size, 1);
});
test('uncertain revision retains original identity and permits only read reconciliation', async () => {
  const f = await seeded();
  const handle = f.service.prepareRevision(
    revisionInput(f.row),
    'revision',
    actor,
  );
  f.state.unknownCommit = true;
  await assert.rejects(
    f.service.persistRevision(handle, f.authority),
    failure('PROPOSAL_OUTCOME_UNKNOWN'),
  );
  await assert.rejects(
    f.service.persistRevision(handle, f.authority),
    failure('PROPOSAL_CONFLICT'),
  );
  assert.equal(
    (await f.service.reconcileRevision(handle, f.authority)).state,
    'COMMITTED',
  );
  assert.equal(f.state.proposals.size, 2);
});
test('clock reversal, delayed deadline callbacks and auth-read cap stop before writes', async () => {
  for (const tick of [-1, NaN, Infinity, 5000, 10000]) {
    const f = fixture();
    f.authority.verify = async () => {
      f.state.ticks = tick;
      return actor;
    };
    await assert.rejects(
      f.service.capture(input(), 'request', f.authority),
      failure('DEPENDENCY_UNAVAILABLE'),
    );
    assert.equal(f.state.fences, 0);
  }
});
test('late cancellation result cannot fence or commit', async () => {
  const f = fixture();
  const abort = new AbortController();
  f.authority.signal = abort.signal;
  let release!: () => void;
  f.authority.verify = async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return actor;
  };
  const pending = f.service.capture(input(), 'request', f.authority);
  while (!release) await Promise.resolve();
  abort.abort();
  await assert.rejects(pending, failure('DEPENDENCY_UNAVAILABLE'));
  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(f.state.fences, 0);
  assert.equal(f.state.commits, 0);
});
test('known authentication error codes cannot relay private message/details', async () => {
  const f = fixture();
  f.authority.verify = async () => {
    throw new AppError(401, 'AUTH_ACCESS_TOKEN_EXPIRED', 'PRIVATE', [
      { field: 'private', message: 'PRIVATE' },
    ]);
  };
  await assert.rejects(
    f.service.capture(input(), 'request', f.authority),
    failure('AUTH_ACCESS_TOKEN_EXPIRED'),
  );
});

test('native repository qualifies indexes, uses exact transaction options and closes session', async () => {
  const calls: {
    collection: string;
    filter?: unknown;
    options?: Record<string, unknown>;
  }[] = [];
  let started: unknown,
    committed = 0,
    ended = 0,
    aborted = 0;
  const session = {
    hasEnded: false,
    startTransaction(options: unknown) {
      started = options;
    },
    inTransaction: () => true,
    async commitTransaction(options: Record<string, unknown>) {
      assert.equal(options.timeoutMS, 2000);
      committed++;
    },
    async abortTransaction() {
      aborted++;
    },
    async endSession() {
      this.hasEnded = true;
      ended++;
    },
  };
  const db = {
    admin: () => ({
      async command() {
        return {
          isWritablePrimary: true,
          setName: 'owned',
          logicalSessionTimeoutMinutes: 30,
        };
      },
    }),
    collection(name: string) {
      return {
        listIndexes: () => ({
          async toArray() {
            return proposalPersistenceIndexes
              .filter((i) => i.collection === name)
              .map((index) => ({
                ...index,
                name:
                  'name' in index
                    ? index.name
                    : JSON.stringify(index.key) === '{"_id":1}'
                      ? '_id_'
                      : 'fixture',
              }));
          },
        }),
        async findOne(filter: unknown, options: Record<string, unknown>) {
          calls.push({ collection: name, filter, options });
          return null;
        },
        async updateOne(
          filter: unknown,
          update: unknown,
          options: Record<string, unknown>,
        ) {
          calls.push({ collection: name, filter, options });
          assert.deepEqual(update, { $inc: { __v: 1 } });
          return { matchedCount: 1, modifiedCount: 1 };
        },
        async insertOne(_row: unknown, options: Record<string, unknown>) {
          calls.push({ collection: name, options });
          return { acknowledged: true };
        },
      };
    },
  };
  const connection = mongoose.connection;
  const previousDb = Object.getOwnPropertyDescriptor(connection, 'db'),
    previousReady = Object.getOwnPropertyDescriptor(connection, 'readyState');
  Object.defineProperty(connection, 'db', {
    configurable: true,
    value: db as unknown as Db,
  });
  Object.defineProperty(connection, 'readyState', {
    configurable: true,
    value: 1,
  });
  const client = mock.method(
    connection,
    'getClient',
    () =>
      ({
        startSession: (options: unknown) => {
          assert.deepEqual(options, {
            causalConsistency: false,
            defaultTimeoutMS: 9000,
          });
          return session;
        },
      }) as unknown as MongoClient,
  );
  const work: ProposalWork = {
    signal: new AbortController().signal,
    remaining: () => 9000,
    check() {},
    async verify() {},
    mutation() {},
    commit() {},
    uncertain() {},
  };
  try {
    await adminLearningPathProposalRepository.transaction(work, async (tx) => {
      await tx.actor(new Types.ObjectId(actor.sub), 5000);
      await tx.fence(new Types.ObjectId(actor.sub), 1, now);
      await tx.insertBrief({ _id: new Types.ObjectId() });
      return 'ok';
    });
    assert.deepEqual(started, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority', j: true },
      readPreference: 'primary',
      maxCommitTimeMS: 2000,
    });
    assert.equal(committed, 1);
    assert.equal(aborted, 0);
    assert.equal(ended, 1);
    assert.ok(calls.every((call) => call.options?.session === session));
    const fence = calls.find(
      (call) => call.collection === 'users' && (call.filter as Row).__v === 1,
    )!;
    assert.deepEqual(fence.filter, {
      _id: new Types.ObjectId(actor.sub),
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: now,
      __v: 1,
    });
    assert.ok(calls.every((call) => !call.options?.readConcern));
  } finally {
    client.mock.restore();
    if (previousDb) Object.defineProperty(connection, 'db', previousDb);
    else Reflect.deleteProperty(connection, 'db');
    if (previousReady)
      Object.defineProperty(connection, 'readyState', previousReady);
    else Reflect.deleteProperty(connection, 'readyState');
  }
});

for (const mode of [
  'notPrimary',
  'wrongIndex',
  'start',
  'body',
  'finalVerify',
  'commit',
  'abort',
  'end',
  'unclosed',
  'lateCancellation',
] as const)
  test(`native repository failure/cleanup boundary: ${mode}`, async () => {
    const abort = new AbortController();
    const count = {
      sessions: 0,
      bodies: 0,
      writes: 0,
      commits: 0,
      aborts: 0,
      ends: 0,
      uncertain: 0,
      continued: 0,
    };
    let inTransaction = false;
    let release: () => void = () => {};
    let entered: () => void = () => {};
    const enter = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const session = {
      hasEnded: false,
      startTransaction() {
        if (mode === 'start') throw Error('SYNTHETIC_START');
        inTransaction = true;
      },
      inTransaction: () => inTransaction,
      async commitTransaction() {
        count.commits++;
        if (mode === 'commit') throw Error('SYNTHETIC_COMMIT');
        inTransaction = false;
      },
      async abortTransaction(options: { timeoutMS: number }) {
        count.aborts++;
        assert.equal(options.timeoutMS, 2000);
        if (mode === 'abort') throw Error('SYNTHETIC_ABORT');
        inTransaction = false;
      },
      async endSession(options: { timeoutMS: number }) {
        count.ends++;
        assert.equal(options.timeoutMS, 2000);
        if (mode === 'end') throw Error('SYNTHETIC_END');
        this.hasEnded = mode !== 'unclosed';
      },
    };
    const db = {
      admin: () => ({
        async command() {
          return {
            isWritablePrimary: mode !== 'notPrimary',
            setName: 'owned',
            logicalSessionTimeoutMinutes: 30,
          };
        },
      }),
      collection(name: string) {
        return {
          listIndexes: () => ({
            async toArray() {
              return proposalPersistenceIndexes
                .filter((index) => index.collection === name)
                .map((index) => ({
                  ...index,
                  unique:
                    mode === 'wrongIndex' && name === 'curriculumBriefRevisions'
                      ? false
                      : index.unique,
                  name:
                    'name' in index
                      ? index.name
                      : JSON.stringify(index.key) === '{"_id":1}'
                        ? '_id_'
                        : 'fixture',
                }));
            },
          }),
          async insertOne() {
            count.writes++;
            if (mode === 'lateCancellation') {
              entered();
              await new Promise<void>((resolve) => {
                release = resolve;
              });
            }
            return { acknowledged: true };
          },
        };
      },
    };
    const connection = mongoose.connection;
    const previousDb = Object.getOwnPropertyDescriptor(connection, 'db'),
      previousReady = Object.getOwnPropertyDescriptor(connection, 'readyState');
    Object.defineProperty(connection, 'db', {
      configurable: true,
      value: db as unknown as Db,
    });
    Object.defineProperty(connection, 'readyState', {
      configurable: true,
      value: 1,
    });
    const client = mock.method(
      connection,
      'getClient',
      () =>
        ({
          startSession() {
            count.sessions++;
            return session;
          },
        }) as unknown as MongoClient,
    );
    const work: ProposalWork = {
      signal: abort.signal,
      remaining: () => 9000,
      check() {
        if (abort.signal.aborted) throw Error('SYNTHETIC_CANCELLED');
      },
      async verify() {
        if (mode === 'finalVerify') throw Error('SYNTHETIC_VERIFY');
      },
      mutation() {},
      commit() {},
      uncertain() {
        count.uncertain++;
      },
    };
    try {
      const pending = adminLearningPathProposalRepository.transaction(
        work,
        async (tx) => {
          count.bodies++;
          if (mode === 'body' || mode === 'abort')
            throw Error('SYNTHETIC_BODY');
          if (mode === 'lateCancellation') {
            await tx.insertBrief({ _id: new Types.ObjectId() });
            count.continued++;
            await tx.insertProposal({ _id: new Types.ObjectId() });
          }
          return 'value';
        },
      );
      void pending.catch(() => {});
      if (mode === 'lateCancellation') {
        await Promise.race([enter, pending]);
        abort.abort();
        release();
      }
      await assert.rejects(pending, (error: unknown) => {
        if (['commit', 'abort', 'end', 'unclosed'].includes(mode))
          return failure('PROPOSAL_OUTCOME_UNKNOWN')(error);
        return error instanceof Error;
      });
      if (mode === 'notPrimary' || mode === 'wrongIndex') {
        assert.equal(count.sessions, 0);
        assert.equal(count.bodies, 0);
        assert.equal(count.writes, 0);
        assert.equal(count.ends, 0);
      } else {
        assert.equal(count.sessions, 1);
        assert.equal(count.ends, 1);
        assert.equal(
          count.commits,
          ['commit', 'end', 'unclosed'].includes(mode) ? 1 : 0,
        );
        assert.equal(
          count.aborts,
          ['body', 'finalVerify', 'abort', 'lateCancellation'].includes(mode)
            ? 1
            : 0,
        );
      }
      if (mode === 'lateCancellation') {
        assert.equal(count.writes, 1);
        assert.equal(count.continued, 0);
      }
      if (['abort', 'end', 'unclosed'].includes(mode))
        assert.equal(count.uncertain, 1);
    } finally {
      client.mock.restore();
      if (previousDb) Object.defineProperty(connection, 'db', previousDb);
      else Reflect.deleteProperty(connection, 'db');
      if (previousReady)
        Object.defineProperty(connection, 'readyState', previousReady);
      else Reflect.deleteProperty(connection, 'readyState');
    }
  });

test('prepared integration lifetime refuses delayed qualification and child completion after loss', async () => {
  const parent = new AbortController();
  let unsubscribed = 0;
  const lifetime = createProposalIntegrationLifetime(
    parent.signal,
    () => () => {
      unsubscribed++;
    },
  );
  let release!: () => void;
  let dispatched = false;
  const pending = (async () => {
    lifetime.check();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    lifetime.check();
    dispatched = true;
  })();
  parent.abort();
  release();
  await assert.rejects(pending);
  assert.equal(dispatched, false);
  lifetime.dispose();
  lifetime.dispose();
  assert.equal(unsubscribed, 1);
  const parent2 = new AbortController(),
    child = new AbortController();
  const second = createProposalIntegrationLifetime(
    parent2.signal,
    () => () => {},
  );
  let finish!: () => void;
  const late = second.runCase(
    child.signal,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  child.abort();
  finish();
  await assert.rejects(late);
  assert.equal(second.signal.aborted, true);
  second.dispose();
});

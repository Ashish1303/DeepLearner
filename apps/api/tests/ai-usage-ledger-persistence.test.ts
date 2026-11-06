import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import childProcess from 'node:child_process';
import { mongo, Types } from 'mongoose';
import type { Db, MongoClient } from 'mongodb';
import { AppError } from '../src/common/errors/app-error.js';
import * as s from '../src/modules/ai/ai-usage-ledger.schema.js';
import { ledgerRequiredIndexes } from '../src/modules/ai/ai-usage-ledger.model.js';
import {
  createAiUsageLedgerRepository,
  assertLedgerIndexes,
  validateLedgerAudit,
  LedgerFailure,
  type LedgerWork,
} from '../src/modules/ai/ai-usage-ledger.repository.js';
import {
  createAiUsageLedgerService,
  type LedgerAuthority,
  type LedgerDependencies,
} from '../src/modules/ai/ai-usage-ledger.service.js';

const epoch = Date.parse('2026-11-06T10:00:00.000Z');
const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const hex = (n: number) => s.ledgerHex(id(n));
const uuid = (n: number) =>
  `${n.toString().padStart(8, '0')}-1111-4111-8111-${n.toString().padStart(12, '0')}`;
const money = (n: number) => s.paiseFromBigInt(BigInt(n));
function clone<T>(value: T): T {
  return mongo.BSON.deserialize(mongo.BSON.serialize({ value }), {
    promoteLongs: false,
  }).value as T;
}
type Row = Record<string, unknown>;
type Data = Record<string, Row[]>;
function same(a: unknown, b: unknown): boolean {
  if (a instanceof Types.ObjectId && b instanceof Types.ObjectId)
    return a.equals(b);
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (a && b && typeof a === 'object' && typeof b === 'object')
    return s.ledgerSame(a, b);
  return a === b;
}
function harness() {
  let now = epoch,
    mono = 0,
    serial = 100;
  const actor = {
    sub: hex(1),
    sid: hex(2),
    role: 'ADMIN' as const,
    plan: 'FREE' as const,
  };
  const command = {
    operationId: uuid(1),
    technologyId: hex(3),
    source: { id: hex(4), revision: 1 as const, digest: 'a'.repeat(64) },
    instructions: 'Outline',
    inputJson: '{}',
    requestBounds: {
      instructionBytes: 7,
      inputJsonBytes: 2,
      maxOutputBytes: 1024,
      maxOutputTokens: 128,
      budgetMs: 100,
    },
  };
  const control = {
    _id: id(5),
    schemaVersion: 1,
    scope: 'SHARED_AI_TESTING',
    version: 0,
    policyVersion: uuid(3),
    policy: {
      capPaise: money(100000),
      warningPercent: 80,
      timezone: 'Asia/Kolkata',
      maxOpen: 1,
      maxActorMinute: 1,
    },
    profileVersion: uuid(4),
    pricingVersion: uuid(5),
    privacyVersion: uuid(6),
    spendingApprovalRef: uuid(7),
    dispatchEnabled: false,
    frozen: false,
    freezeReasons: [],
    activeOperationId: null,
    lastAdmissionAt: null,
    createdAt: new Date(now - 1000),
    updatedAt: new Date(now - 1),
  };
  const period = {
    _id: id(6),
    schemaVersion: 1,
    scope: 'SHARED_AI_TESTING',
    periodKey: '2026-11',
    version: 0,
    settledPaise: money(0),
    heldPaise: money(0),
    createdAt: new Date(now - 1000),
    updatedAt: new Date(now - 1),
  };
  let data: Data = {
    users: [
      {
        _id: id(1),
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(now - 10000),
        __v: 0,
      },
    ],
    aiUsageControls: [control],
    aiUsagePeriods: [period],
    aiUsageOperations: [],
    auditLogs: [],
  };
  const calls: {
    name: string;
    collection?: string;
    options?: Row;
    filter?: Row;
  }[] = [];
  const faults = {
    audit: false,
    commit: false,
    commitThenThrow: false,
    abort: false,
    end: false,
    notEnded: false,
    fence: false,
    cas: false,
    duplicate: false,
    hello: false,
    index: false,
  };
  let onCall: (name: string) => void = () => {};
  const sessions: {
    working: Data;
    inTransaction(): boolean;
    hasEnded: boolean;
    startTransaction(options: Row): void;
    commitTransaction(options: Row): Promise<void>;
    abortTransaction(options: Row): Promise<void>;
    endSession(options: Row): Promise<void>;
  }[] = [];
  const error = () =>
    Object.assign(new Error('SYNTHETIC_PRIVATE_MUST_NOT_ESCAPE'), {
      code: 11000,
    });
  const record = (
    name: string,
    collection?: string,
    options?: Row,
    filter?: Row,
  ) => {
    calls.push({
      name,
      ...(collection === undefined ? {} : { collection }),
      ...(options === undefined ? {} : { options }),
      ...(filter === undefined ? {} : { filter }),
    });
    onCall(name);
  };
  const db = {
    admin() {
      return {
        async command(_query: Row, options: Row) {
          record('hello', undefined, options);
          if (faults.hello) throw error();
          return {
            isWritablePrimary: true,
            setName: 'synthetic',
            logicalSessionTimeoutMinutes: 30,
          };
        },
      };
    },
    collection(name: string) {
      const source = (options: Row) => {
        const session = options.session as
          (typeof sessions)[number] | undefined;
        return session?.working ?? data;
      };
      const matches = (row: Row, filter: Row) =>
        Object.entries(filter).every(([key, value]) => same(row[key], value));
      return {
        listIndexes(options: Row) {
          record('indexes', name, options);
          return {
            async toArray() {
              const rows = ledgerRequiredIndexes
                .filter((x) => x.collection === name)
                .map(({ collection: ignored, ...row }) => {
                  void ignored;
                  return clone(row);
                });
              return faults.index ? rows.slice(1) : rows;
            },
          };
        },
        async findOne(filter: Row, options: Row) {
          record('find', name, options, filter);
          return clone(
            source(options)[name]!.find((row) => matches(row, filter)) ?? null,
          );
        },
        find(filter: Row, options: Row) {
          record('open', name, options, filter);
          let limit = 0;
          return {
            limit(value: number) {
              limit = value;
              return this;
            },
            async toArray() {
              assert.equal(limit, 2);
              return clone(
                source(options)
                  [name]!.filter((row) => matches(row, filter))
                  .slice(0, limit),
              );
            },
          };
        },
        async updateOne(filter: Row, update: Row, options: Row) {
          record('update', name, options, filter);
          const rows = source(options)[name]!;
          const row = rows.find((x) => matches(x, filter));
          if (
            (faults.fence && name === 'users') ||
            (faults.cas && name === 'aiUsageControls') ||
            !row
          )
            return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
          if (update.$set) Object.assign(row, clone(update.$set));
          if (update.$inc)
            for (const [key, n] of Object.entries(update.$inc))
              row[key] = Number(row[key]) + Number(n);
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
        },
        async insertOne(row: Row, options: Row) {
          record('insert', name, options);
          if (
            (faults.audit && name === 'auditLogs') ||
            (faults.duplicate && name === 'aiUsageOperations')
          )
            throw error();
          const rows = source(options)[name]!;
          if (rows.some((x) => same(x._id, row._id))) throw error();
          rows.push(clone(row));
          return { acknowledged: true, insertedId: row._id };
        },
      };
    },
  };
  const client = {
    startSession(options: Row) {
      record('startSession', undefined, options);
      let active = false;
      const session = {
        working: clone(data),
        hasEnded: false,
        startTransaction(txOptions: Row) {
          record('startTransaction', undefined, txOptions);
          active = true;
        },
        inTransaction() {
          return active;
        },
        async commitTransaction(commitOptions: Row) {
          record('commit', undefined, commitOptions);
          if (faults.commit) throw error();
          data = clone(session.working);
          active = false;
          if (faults.commitThenThrow) throw error();
        },
        async abortTransaction(abortOptions: Row) {
          record('abort', undefined, abortOptions);
          if (faults.abort) throw error();
          active = false;
        },
        async endSession(endOptions: Row) {
          record('end', undefined, endOptions);
          if (faults.end) throw error();
          session.hasEnded = !faults.notEnded;
        },
      };
      sessions.push(session);
      return session;
    },
  };
  const repository = createAiUsageLedgerRepository({
    db: db as unknown as Db,
    client: client as unknown as MongoClient,
  });
  const dependencies: LedgerDependencies = {
    repository,
    now: () => now,
    monotonic: () => mono,
    newId: () => id(serial++),
    async resolveIntent(_authority, c) {
      return {
        technologyId: c.technologyId,
        source: c.source,
        requestDigest: s.ledgerRequestDigest({
          instructions: c.instructions,
          inputJson: c.inputJson,
        }),
        requestBounds: c.requestBounds,
      };
    },
    async resolveProfile(c) {
      return {
        policyVersion: c.policyVersion,
        profileVersion: c.profileVersion,
        pricingVersion: c.pricingVersion,
        privacyVersion: c.privacyVersion,
        spendingApprovalRef: c.spendingApprovalRef,
        inputTokenLimit: 1000,
      };
    },
    async resolveQuote(i, c, time) {
      return {
        id: uuid(8),
        periodKey: '2026-11',
        environment: 'DEV',
        purpose: 'CURRICULUM_OUTLINE',
        policyVersion: c.policyVersion,
        profileVersion: c.profileVersion,
        pricingVersion: c.pricingVersion,
        privacyVersion: c.privacyVersion,
        spendingApprovalRef: c.spendingApprovalRef,
        providerAlias: 'test-provider',
        modelAlias: 'test-model',
        templateVersion: uuid(9),
        requestDigest: i.requestDigest,
        requestBounds: i.requestBounds,
        inputTokenUpperBound: 100,
        worstCasePaise: money(100),
        effectiveAtMs: time - 1000,
        expiresAtMs: time + 3600000,
        assumptionsDigest: 'b'.repeat(64),
      };
    },
    async verifyEvidence(_op, receipt) {
      return {
        id: receipt.id ?? uuid(10),
        kind: receipt.kind,
        evidenceDigest: 'c'.repeat(64),
        actualPaise: money(receipt.kind === 'DEFINITELY_UNSENT' ? 0 : 80),
        inputTokens: receipt.kind === 'DEFINITELY_UNSENT' ? null : 10,
        outputTokens: receipt.kind === 'DEFINITELY_UNSENT' ? null : 20,
      };
    },
  };
  const authority: LedgerAuthority = {
    actor,
    requestId: 'synthetic-request',
    verify: async () => actor,
  };
  return {
    command,
    actor,
    authority,
    dependencies,
    repository,
    calls,
    faults,
    sessions,
    get data() {
      return data;
    },
    get now() {
      return now;
    },
    set now(value: number) {
      now = value;
    },
    get mono() {
      return mono;
    },
    set mono(value: number) {
      mono = value;
    },
    onCall(fn: (name: string) => void) {
      onCall = fn;
    },
    service: () => createAiUsageLedgerService(dependencies),
    claim() {
      return {
        claimId: uuid(20),
        ownerId: uuid(21),
        request: {
          schemaVersion: 1,
          purpose: 'CURRICULUM_OUTLINE',
          instructions: command.instructions,
          inputJson: command.inputJson,
          maxOutputBytes: 1024,
          maxOutputTokens: 128,
        },
      };
    },
  };
}
function recorded(
  result: Awaited<
    ReturnType<ReturnType<typeof createAiUsageLedgerService>['reserve']>
  >,
) {
  assert.equal(result.kind, 'RECORDED', JSON.stringify(result));
  if (result.kind !== 'RECORDED') throw Error('expected record');
  return result.operation;
}
function refused(
  result: Awaited<
    ReturnType<ReturnType<typeof createAiUsageLedgerService>['reserve']>
  >,
  code?: string,
) {
  assert.equal(result.kind, 'REFUSED', JSON.stringify(result));
  if (result.kind === 'REFUSED') {
    if (code) assert.equal(result.code, code);
    assert.deepEqual(Object.keys(result), ['kind', 'code', 'message']);
    assert.equal(result.message, 'AI usage operation cannot proceed');
  }
  assert(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE'));
}
const op = (h: ReturnType<typeof harness>) =>
  s.validateLedgerOperation(h.data.aiUsageOperations![0]);
const versioned = (h: ReturnType<typeof harness>) => ({
  operationId: h.command.operationId,
  expectedVersion: op(h).version,
});

test('qualified reserve commits User fence, counters, operation and exact audit together, private DTO only', async () => {
  const h = harness(),
    r = recorded(await h.service().reserve(h.authority, h.command));
  assert.equal(r.state, 'RESERVED');
  assert.equal(r.reservationPaise, '100');
  assert.equal(h.data.users![0]!.__v, 1);
  assert.equal(h.data.aiUsageOperations!.length, 1);
  assert.equal(h.data.auditLogs!.length, 1);
  assert.equal(h.data.aiUsagePeriods![0]!.heldPaise?.toString(), '100');
  assert.equal(h.calls.filter((x) => x.name === 'commit').length, 1);
  assert(h.sessions.every((x) => x.hasEnded));
  for (const key of [
    'actorId',
    'quote',
    'requestDigest',
    'source',
    'claim',
    'operationDocumentId',
  ])
    assert(!Object.hasOwn(r, key));
  const tx = h.calls.find((x) => x.name === 'startTransaction')!.options!;
  assert.deepEqual(tx.readConcern, { level: 'snapshot' });
  assert.deepEqual(tx.writeConcern, { w: 'majority', j: true });
  for (const c of h.calls.filter((x) =>
    ['find', 'open', 'update', 'insert'].includes(x.name),
  )) {
    assert(c.options?.session);
    assert.equal(c.options?.promoteLongs, false);
    assert(Number(c.options?.timeoutMS) <= 10000);
  }
});
test('same actor/key intent replay uses no quote/fence/mutation and conflicting payload refuses', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  h.dependencies.resolveQuote = async () => {
    throw Error('must not requote');
  };
  const before = clone(h.data);
  const mutations = h.calls.filter((x) =>
    ['insert', 'update', 'commit'].includes(x.name),
  ).length;
  recorded(await h.service().reserve(h.authority, h.command));
  assert.deepEqual(h.data, before);
  assert.equal(
    h.calls.filter((x) => ['insert', 'update', 'commit'].includes(x.name))
      .length,
    mutations,
  );
  refused(
    await h.service().reserve(h.authority, {
      ...h.command,
      inputJson: '{ }',
      requestBounds: { ...h.command.requestBounds, inputJsonBytes: 3 },
    }),
    'OPERATION_CONFLICT',
  );
});
for (const name of ['audit', 'fence', 'cas', 'duplicate'] as const)
  test(`${name} failure rolls back the inert double but conservatively reports unconfirmed abort`, async () => {
    const h = harness(),
      before = clone(h.data);
    h.faults[name] = true;
    assert.equal(
      (await h.service().reserve(h.authority, h.command)).kind,
      'OUTCOME_UNKNOWN',
    );
    assert.deepEqual(h.data, before);
    assert(h.sessions.every((x) => x.hasEnded));
    assert.equal(h.calls.filter((x) => x.name === 'commit').length, 0);
  });
for (const name of [
  'commit',
  'commitThenThrow',
  'abort',
  'end',
  'notEnded',
] as const)
  test(`${name} ambiguity is never safe mutation replay`, async () => {
    const h = harness();
    h.faults[name] = true;
    if (name === 'abort') h.faults.audit = true;
    const r = await h.service().reserve(h.authority, h.command);
    assert.equal(r.kind, 'OUTCOME_UNKNOWN');
    assert(!JSON.stringify(r).includes('SYNTHETIC_PRIVATE'));
    assert(h.calls.filter((x) => x.name === 'commit').length <= 1);
    assert(h.calls.some((x) => x.name === 'end'));
    if (name === 'commitThenThrow') {
      h.faults[name] = false;
      recorded(
        await h
          .service()
          .readOperation(h.authority, { operationId: h.command.operationId }),
      );
      assert.equal(h.data.auditLogs!.length, 1);
    }
  });
for (const [field, value] of [
  ['role', 'STUDENT'],
  ['status', 'SUSPENDED'],
  ['status', 'DISABLED'],
  ['emailVerifiedAt', null],
  ['__v', Number.MAX_SAFE_INTEGER],
] as const)
  test(`ineligible current stored ${field} is refused without ledger changes`, async () => {
    const h = harness();
    h.data.users![0]![field] = value;
    refused(await h.service().reserve(h.authority, h.command));
    assert.equal(h.data.aiUsageOperations!.length, 0);
    assert.equal(h.calls.filter((x) => x.name === 'update').length, 0);
  });
test('current actor deletion and changed session fail before commit', async () => {
  for (const mode of ['deleted', 'session']) {
    const h = harness();
    if (mode === 'deleted') h.data.users = [];
    else h.authority.verify = async () => ({ ...h.actor, sid: hex(99) });
    refused(await h.service().reserve(h.authority, h.command), 'FORBIDDEN');
    assert.equal(h.calls.filter((x) => x.name === 'commit').length, 0);
  }
});
test('demotion observed after fence stops commit and retains unconfirmed-rollback classification', async () => {
  const h = harness(),
    before = clone(h.data);
  let changed = false;
  h.onCall((name) => {
    if (name === 'update') changed = true;
  });
  h.authority.verify = async () =>
    changed ? { ...h.actor, role: 'STUDENT' } : h.actor;
  assert.equal(
    (await h.service().reserve(h.authority, h.command)).kind,
    'OUTCOME_UNKNOWN',
  );
  assert.deepEqual(h.data, before);
});
for (const name of ['hello', 'index'] as const)
  test(`failed ${name} qualification refuses without session/write`, async () => {
    const h = harness();
    h.faults[name] = true;
    refused(await h.service().reserve(h.authority, h.command));
    assert.equal(h.sessions.length, 0);
    assert.equal(h.data.aiUsageOperations!.length, 0);
  });
test('server intent/profile/quote mismatches cannot be admitted', async () => {
  for (const dependency of [
    'resolveIntent',
    'resolveProfile',
    'resolveQuote',
  ] as const) {
    const h = harness(),
      original = h.dependencies[dependency];
    if (dependency === 'resolveIntent')
      h.dependencies.resolveIntent = async (...args) => ({
        ...((await (original as LedgerDependencies['resolveIntent'])(
          ...args,
        )) as object),
        technologyId: hex(99),
      });
    if (dependency === 'resolveProfile')
      h.dependencies.resolveProfile = async (...args) => ({
        ...((await (original as LedgerDependencies['resolveProfile'])(
          ...args,
        )) as object),
        pricingVersion: uuid(99),
      });
    if (dependency === 'resolveQuote')
      h.dependencies.resolveQuote = async (...args) => ({
        ...((await (original as LedgerDependencies['resolveQuote'])(
          ...args,
        )) as object),
        requestDigest: 'd'.repeat(64),
      });
    refused(await h.service().reserve(h.authority, h.command));
    assert.equal(h.data.aiUsageOperations!.length, 0);
  }
});
test('reservation freezes new open work; a released admission still consumes its fixed minute', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  refused(
    await h
      .service()
      .reserve(h.authority, { ...h.command, operationId: uuid(2) }),
    'CONCURRENCY_LIMIT',
  );
  recorded(await h.service().cancelUnsent(h.authority, versioned(h)));
  refused(
    await h
      .service()
      .reserve(h.authority, { ...h.command, operationId: uuid(2) }),
    'RATE_LIMIT',
  );
  h.now += 60000;
  recorded(
    await h
      .service()
      .reserve(h.authority, { ...h.command, operationId: uuid(2) }),
  );
  assert.equal(h.data.aiUsageOperations!.length, 2);
});
test('missing current period can be inserted only by qualified new admission', async () => {
  const h = harness();
  h.data.aiUsagePeriods = [];
  recorded(await h.service().reserve(h.authority, h.command));
  assert.equal(h.data.aiUsagePeriods!.length, 1);
  assert.equal(h.data.aiUsagePeriods![0]!.heldPaise?.toString(), '100');
});
test('minute rollover or quote expiry at final decision aborts without retry', async () => {
  for (const offset of [60000, 3600000]) {
    const h = harness(),
      before = clone(h.data);
    h.onCall((name) => {
      if (name === 'insert') h.now = epoch + offset;
    });
    assert.equal(
      (await h.service().reserve(h.authority, h.command)).kind,
      'OUTCOME_UNKNOWN',
    );
    assert.deepEqual(h.data, before);
    assert.equal(h.calls.filter((x) => x.name === 'commit').length, 0);
  }
});
test('stored claim and known settlement are atomic accounting states, identical evidence replays read-only', async () => {
  const h = harness();
  h.data.aiUsageControls![0]!.dispatchEnabled = true;
  recorded(await h.service().reserve(h.authority, h.command));
  const claim = h.claim();
  const claimed = recorded(
    await h.service().claimDispatch(h.authority, versioned(h), claim),
  );
  assert.equal(claimed.state, 'DISPATCH_CLAIMED');
  const cmd = {
    ...versioned(h),
    claimId: claim.claimId,
    ownerId: claim.ownerId,
  };
  const receipt = { id: uuid(30), kind: 'FINAL_COST' };
  const settled = recorded(await h.service().settle(h.authority, cmd, receipt));
  assert.equal(settled.actualPaise, '80');
  assert.equal(h.data.aiUsagePeriods![0]!.settledPaise?.toString(), '80');
  assert.equal(h.data.auditLogs!.length, 3);
  const before = clone(h.data);
  h.now += 1000; // Terminal identical-evidence recovery outlives the claim deadline.
  recorded(await h.service().settle(h.authority, cmd, receipt));
  assert.deepEqual(h.data, before);
  refused(
    await h.service().settle(h.authority, cmd, { ...receipt, id: uuid(31) }),
    'STATE_CONFLICT',
  );
});
test('dispatch is disabled by control and never implicitly enabled', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  refused(
    await h.service().claimDispatch(h.authority, versioned(h), h.claim()),
    'CONTROL_UNAVAILABLE',
  );
  assert.equal(op(h).state, 'RESERVED');
});
test('stale owner/version, over-cap exposure and late settlement refuse', async () => {
  const h = harness();
  h.data.aiUsageControls![0]!.dispatchEnabled = true;
  recorded(await h.service().reserve(h.authority, h.command));
  h.data.aiUsagePeriods![0]!.settledPaise = money(100000);
  refused(
    await h.service().claimDispatch(h.authority, versioned(h), h.claim()),
    'USAGE_FROZEN',
  );
  h.data.aiUsagePeriods![0]!.settledPaise = money(0);
  const claim = h.claim();
  recorded(await h.service().claimDispatch(h.authority, versioned(h), claim));
  const receipt = { id: uuid(30), kind: 'FINAL_COST' };
  const cmd = {
    ...versioned(h),
    claimId: claim.claimId,
    ownerId: claim.ownerId,
  };
  refused(
    await h
      .service()
      .settle(h.authority, { ...cmd, ownerId: uuid(999) }, receipt),
    'STATE_CONFLICT',
  );
  refused(
    await h
      .service()
      .settle(h.authority, { ...cmd, expectedVersion: 1 }, receipt),
    'STATE_CONFLICT',
  );
  h.now += 100;
  refused(
    await h.service().settle(h.authority, cmd, receipt),
    'STATE_CONFLICT',
  );
  assert.equal(op(h).heldPaise.toString(), '100');
});
test('unknown usage remains held; different current Admin reconciles original month after author deletion and rollover', async () => {
  const h = harness();
  h.data.aiUsageControls![0]!.dispatchEnabled = true;
  recorded(await h.service().reserve(h.authority, h.command));
  const claim = h.claim();
  recorded(await h.service().claimDispatch(h.authority, versioned(h), claim));
  h.now += 101;
  recorded(
    await h.service().markUncertain(h.authority, {
      ...versioned(h),
      claimId: claim.claimId,
      ownerId: claim.ownerId,
    }),
  );
  h.data.aiUsageControls![0]!.freezeReasons = ['OPERATOR_HOLD', 'UNCERTAIN'];
  h.data.aiUsageControls![0]!.dispatchEnabled = false;
  h.now = Date.parse('2026-12-02T00:00:00Z');
  h.data.aiUsagePeriods!.push({
    _id: id(90),
    schemaVersion: 1,
    scope: 'SHARED_AI_TESTING',
    periodKey: '2026-12',
    version: 0,
    settledPaise: money(0),
    heldPaise: money(0),
    createdAt: new Date(h.now - 1),
    updatedAt: new Date(h.now - 1),
  });
  const admin = { ...h.actor, sub: hex(80), sid: hex(81) };
  h.data.users = [
    {
      _id: id(80),
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(epoch),
      __v: 0,
    },
  ];
  const a = { ...h.authority, actor: admin, verify: async () => admin };
  h.dependencies.resolveIntent = async () => {
    throw Error('source deleted');
  };
  h.dependencies.resolveProfile = async () => {
    throw Error('profile retired');
  };
  const result = recorded(
    await h
      .service()
      .reconcile(
        a,
        { ...versioned(h), originalActorId: h.actor.sub },
        { id: uuid(40), kind: 'FINAL_COST' },
      ),
  );
  assert.equal(result.periodKey, '2026-11');
  assert.equal(result.requiresReconciliation, true);
  assert.equal(h.data.aiUsagePeriods![0]!.settledPaise?.toString(), '80');
  assert.equal(h.data.aiUsagePeriods![1]!.settledPaise?.toString(), '0');
  assert.deepEqual(h.data.aiUsageControls![0]!.freezeReasons, [
    'OPERATOR_HOLD',
  ]);
  assert.equal(h.data.auditLogs!.at(-1)!.actorId?.toString(), admin.sub);
  const beforeReplay = clone(h.data);
  h.now += 1000;
  recorded(
    await h
      .service()
      .reconcile(
        a,
        { ...versioned(h), expectedVersion: 1, originalActorId: h.actor.sub },
        { id: uuid(40), kind: 'FINAL_COST' },
      ),
  );
  assert.deepEqual(h.data, beforeReplay);
});
test('unverified/mismatched evidence never releases unknown liability', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  h.dependencies.verifyEvidence = async () => ({
    id: uuid(9),
    kind: 'DEFINITELY_UNSENT',
    evidenceDigest: 'd'.repeat(64),
    actualPaise: null,
    inputTokens: null,
    outputTokens: null,
  });
  refused(await h.service().cancelUnsent(h.authority, versioned(h)));
  assert.equal(op(h).heldPaise.toString(), '100');
});
test('read absence, broken audit/pointer/minute/counter linkage and cleanup uncertainty are UNRESOLVED', async () => {
  for (const broken of [
    'absent',
    'audit',
    'pointer',
    'minute',
    'counter',
    'end',
  ]) {
    const h = harness();
    if (broken !== 'absent')
      recorded(await h.service().reserve(h.authority, h.command));
    if (broken === 'audit') h.data.auditLogs = [];
    if (broken === 'pointer')
      h.data.aiUsageControls![0]!.activeOperationId = null;
    if (broken === 'minute')
      h.data.aiUsageOperations![0]!.admissionWindowKey = 0;
    if (broken === 'counter') h.data.aiUsagePeriods![0]!.heldPaise = money(0);
    if (broken === 'end') h.faults.end = true;
    const result = await h
      .service()
      .readOperation(h.authority, { operationId: h.command.operationId });
    assert.equal(result.kind, 'UNRESOLVED');
  }
});
test('read is actor-bound and does not mutate User, counters, audit or claims', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  const before = clone(h.data);
  recorded(
    await h
      .service()
      .readOperation(h.authority, { operationId: h.command.operationId }),
  );
  assert.deepEqual(h.data, before);
  const other = { ...h.actor, sub: hex(70) };
  h.data.users!.push({
    _id: id(70),
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerifiedAt: new Date(epoch),
    __v: 0,
  });
  assert.equal(
    (
      await h
        .service()
        .readOperation(
          { ...h.authority, actor: other, verify: async () => other },
          { operationId: h.command.operationId },
        )
    ).kind,
    'UNRESOLVED',
  );
});
test('missing resolvers refuse and hostile commands cannot disclose private data', async () => {
  const h = harness();
  refused(
    await createAiUsageLedgerService({ repository: h.repository }).reserve(
      h.authority,
      h.command,
    ),
    'CONTROL_UNAVAILABLE',
  );
  for (const extra of [
    { actorId: hex(99) },
    { usage: { settledPaise: 0 } },
    { $set: { dispatchEnabled: true } },
    { token: 'SYNTHETIC_PRIVATE' },
  ])
    refused(
      await h.service().reserve(h.authority, { ...h.command, ...extra }),
      'INVALID_INPUT',
    );
});
test('late resolver completion after cancellation cannot reach a write', async () => {
  const h = harness(),
    controller = new AbortController();
  let resume: (value: unknown) => void = () => {};
  let began: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  h.dependencies.resolveIntent = () => {
    began();
    return new Promise((resolve) => {
      resume = resolve;
    });
  };
  const result = h
    .service()
    .reserve({ ...h.authority, signal: controller.signal }, h.command);
  await started;
  controller.abort();
  const out = await result;
  refused(out);
  resume({
    technologyId: h.command.technologyId,
    source: h.command.source,
    requestDigest: s.ledgerRequestDigest({
      instructions: 'Outline',
      inputJson: '{}',
    }),
    requestBounds: h.command.requestBounds,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.data.aiUsageOperations!.length, 0);
  assert.equal(h.calls.filter((x) => x.name === 'commit').length, 0);
});
for (const field of [
  'partialFilterExpression',
  'hidden',
  'sparse',
  'expireAfterSeconds',
  'unique',
  'key',
] as const)
  test(`index qualification refuses altered ${field}`, () => {
    const rows = ledgerRequiredIndexes
      .filter((x) => x.collection === 'aiUsageOperations')
      .map(({ collection: ignored, ...row }) => {
        void ignored;
        return clone(row) as Row;
      });
    assertLedgerIndexes('aiUsageOperations', rows);
    const target = rows.find((x) => x.name === 'uq_ai_usage_open')!;
    target[field] =
      field === 'partialFilterExpression'
        ? { open: false }
        : field === 'key'
          ? { scope: -1 }
          : field === 'unique'
            ? false
            : field === 'expireAfterSeconds'
              ? 0
              : true;
    assert.throws(
      () => assertLedgerIndexes('aiUsageOperations', rows),
      LedgerFailure,
    );
  });
test('native repository preserves primary failure and both cleanup observations without raw driver causes', async () => {
  const h = harness();
  h.faults.abort = true;
  h.faults.end = true;
  const work: LedgerWork = {
    signal: new AbortController().signal,
    remaining: () => 10000,
    check() {},
    verify: async () => {},
    beforeCommit: async () => {},
    finalize() {},
    mutation() {},
    commit() {},
    uncertain() {},
  };
  await assert.rejects(
    h.repository.transaction(work, async () => {
      throw new LedgerFailure('FORBIDDEN');
    }),
    (error: unknown) => {
      assert(error instanceof LedgerFailure);
      assert.equal(error.primary, 'REFUSAL');
      assert.equal(error.primaryCode, 'FORBIDDEN');
      assert.deepEqual(error.cleanup, ['ABORT', 'END_SESSION', 'NOT_ENDED']);
      assert(!JSON.stringify(error).includes('SYNTHETIC_PRIVATE'));
      return true;
    },
  );
});
test('import/ordinary integration discovery is inert and no live provider composition exists', async () => {
  const stop = () => {
    throw Error('unexpected side effect');
  };
  const netMock = mock.method(net, 'connect', stop),
    spawnMock = mock.method(childProcess, 'spawn', stop);
  try {
    const prepared = await import('./ai-usage-ledger.integration.js');
    assert.equal(prepared.aiUsageLedgerPreparedAssertions.length, 8);
    assert.equal(new Set(prepared.aiUsageLedgerPreparedAssertions).size, 8);
    assert.equal(typeof prepared.runAiUsageLedgerIntegration, 'function');
    assert.equal(netMock.mock.callCount(), 0);
    assert.equal(spawnMock.mock.callCount(), 0);
  } finally {
    netMock.mock.restore();
    spawnMock.mock.restore();
  }
  for (const name of ['repository', 'service']) {
    const source = readFileSync(
      new URL(`../src/modules/ai/ai-usage-ledger.${name}.ts`, import.meta.url),
      'utf8',
    );
    for (const forbidden of [
      'process.env',
      'withTransaction(',
      '.connect(',
      'createAiProviderExecutor',
      'fetch(',
      'config/env',
    ])
      assert(!source.includes(forbidden), forbidden);
  }
  const declaration = ledgerRequiredIndexes.filter(
    (x) =>
      x.collection === 'auditLogs' && x.name === 'uq_ai_usage_audit_version',
  );
  assert.equal(declaration.length, 1);
  const row = harness();
  recorded(await row.service().reserve(row.authority, row.command));
  validateLedgerAudit(row.data.auditLogs![0]);
});

test('completely absent server composition refuses rather than activating implicit defaults', async () => {
  const h = harness();
  refused(
    await createAiUsageLedgerService().reserve(h.authority, h.command),
    'CONTROL_UNAVAILABLE',
  );
  assert.equal(h.calls.length, 0);
});

test('ordinary protected read uses native snapshot session, no transaction/abort/commit/fence', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  h.calls.length = 0;
  recorded(
    await h
      .service()
      .readOperation(h.authority, { operationId: h.command.operationId }),
  );
  assert.equal(
    h.calls.find((x) => x.name === 'startSession')?.options?.snapshot,
    true,
  );
  for (const action of [
    'startTransaction',
    'abort',
    'commit',
    'update',
    'insert',
  ])
    assert.equal(h.calls.filter((x) => x.name === action).length, 0);
  assert.equal(h.calls.filter((x) => x.name === 'end').length, 1);
});
test('altered nonterminal audit performer fails validation and read linkage without current-author lookup', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  h.data.auditLogs![0]!.actorId = id(99);
  assert.throws(() => validateLedgerAudit(h.data.auditLogs![0]), LedgerFailure);
  assert.equal(
    (
      await h
        .service()
        .readOperation(h.authority, { operationId: h.command.operationId })
    ).kind,
    'UNRESOLVED',
  );
});
test('index arrays reject proxies and getter/overridden traversal without invoking caller hooks', () => {
  let calls = 0;
  const getter: unknown[] = [];
  Object.defineProperty(getter, '0', {
    enumerable: true,
    get() {
      calls++;
      throw Error('private');
    },
  });
  const overridden: unknown[] = [];
  Object.defineProperty(overridden, 'filter', {
    get() {
      calls++;
      throw Error('private');
    },
  });
  const proxy = new Proxy([], {
    get() {
      calls++;
      throw Error('private');
    },
  });
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  for (const rows of [getter, overridden, proxy, revoked.proxy])
    assert.throws(
      () => assertLedgerIndexes('aiUsageControls', rows),
      LedgerFailure,
    );
  assert.equal(calls, 0);
});

test('known revoked/expired authorization is sanitized without exposing its cause', async () => {
  for (const code of [
    'AUTH_ACCESS_TOKEN_MISSING',
    'AUTH_ACCESS_TOKEN_INVALID',
    'AUTH_ACCESS_TOKEN_EXPIRED',
    'AUTH_FORBIDDEN',
  ]) {
    const h = harness();
    h.authority.verify = async () => {
      throw new AppError(
        code === 'AUTH_FORBIDDEN' ? 403 : 401,
        code,
        'SYNTHETIC_PRIVATE',
      );
    };
    refused(
      await h.service().reserve(h.authority, h.command),
      code === 'AUTH_FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHENTICATED',
    );
    assert.equal(h.data.aiUsageOperations!.length, 0);
  }
});
test('actor/key collision before writes recovers only the complete matching committed result without requoting', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  const before = clone(h.data);
  let hide = true;
  const repository = {
    ...h.repository,
    read: <T>(
      work: LedgerWork,
      read: (
        reader: import('../src/modules/ai/ai-usage-ledger.repository.js').LedgerReader,
      ) => Promise<T>,
    ) =>
      h.repository.read(work, (reader) =>
        read({
          ...reader,
          operation: async (...args) => {
            if (hide) {
              hide = false;
              return null;
            }
            return reader.operation(...args);
          },
        }),
      ),
  };
  h.dependencies.repository = repository;
  h.dependencies.resolveQuote = async () => {
    throw Error('must not requote');
  };
  recorded(await h.service().reserve(h.authority, h.command));
  assert.deepEqual(h.data, before);
});
test('receipt boundaries reject newline-suffixed aliases/request identities and native stored private tuples', async () => {
  const h = harness();
  refused(
    await h
      .service()
      .reserve({ ...h.authority, requestId: 'request\n' }, h.command),
    'INVALID_INPUT',
  );
  recorded(await h.service().reserve(h.authority, h.command));
  const audit = h.data.auditLogs![0]!;
  assert.throws(
    () => validateLedgerAudit({ ...audit, requestId: 'request\n' }),
    LedgerFailure,
  );
  assert.throws(
    () =>
      validateLedgerAudit({
        ...audit,
        metadata: {
          ...(audit.metadata as object),
          providerAlias: 'provider\n',
        },
      }),
    LedgerFailure,
  );
});

test('stored exposure constructs exact cap and warning arithmetic; excess refuses before mutation', async () => {
  for (const settled of [79900, 99900, 99901]) {
    const h = harness();
    h.data.aiUsagePeriods![0]!.settledPaise = money(settled);
    const result = await h.service().reserve(h.authority, h.command);
    if (settled === 99901) {
      refused(result, 'BUDGET_EXCEEDED');
      assert.equal(h.data.aiUsageOperations!.length, 0);
    } else {
      const row = recorded(result);
      assert.equal(row.warning80Percent, true);
      assert.equal(h.data.aiUsagePeriods![0]!.heldPaise?.toString(), '100');
    }
  }
});
test('new-month admission refuses prior open liabilities without resetting the original period', async () => {
  const h = harness();
  recorded(await h.service().reserve(h.authority, h.command));
  const before = clone(h.data);
  h.now = Date.parse('2026-12-01T00:00:00Z');
  refused(
    await h
      .service()
      .reserve(h.authority, { ...h.command, operationId: uuid(50) }),
    'USAGE_FROZEN',
  );
  assert.deepEqual(h.data, before);
  assert.equal(op(h).heldPaise.toString(), '100');
});
test('cancellation after attempted writes cannot commit or replay late effects', async () => {
  const h = harness(),
    controller = new AbortController(),
    before = clone(h.data);
  h.onCall((name) => {
    if (name === 'insert') controller.abort();
  });
  assert.equal(
    (
      await h
        .service()
        .reserve({ ...h.authority, signal: controller.signal }, h.command)
    ).kind,
    'OUTCOME_UNKNOWN',
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.data, before);
  assert.equal(h.calls.filter((x) => x.name === 'commit').length, 0);
});
test('clock regression and slow authorization use explicit monotonic bounds without real waiting', async () => {
  const h = harness();
  h.authority.verify = async () => {
    h.mono = 5000;
    return h.actor;
  };
  refused(await h.service().reserve(h.authority, h.command), 'FORBIDDEN');
  assert.equal(h.calls.filter((x) => x.name === 'update').length, 0);
  const regression = harness();
  regression.dependencies.monotonic = (() => {
    let reads = 0;
    return () => (++reads > 1 ? -1 : 0);
  })();
  refused(
    await regression
      .service()
      .reserve(regression.authority, regression.command),
  );
});

test('final authorization is last async step and minute rollover during it cannot commit', async () => {
  const h = harness(),
    before = clone(h.data);
  let verifies = 0;
  h.authority.verify = async () => {
    if (++verifies === 5) h.now += 60000;
    return h.actor;
  };
  assert.equal(
    (await h.service().reserve(h.authority, h.command)).kind,
    'OUTCOME_UNKNOWN',
  );
  assert.equal(verifies, 5);
  assert.equal(h.calls.filter((x) => x.name === 'commit').length, 0);
  assert.deepEqual(h.data, before);
});
test('final asynchronous profile revalidation cannot leave time guard stale', async () => {
  const h = harness(),
    before = clone(h.data),
    resolve = h.dependencies.resolveProfile;
  let profiles = 0;
  h.dependencies.resolveProfile = async (...args) => {
    const value = await resolve(...args);
    if (++profiles === 2) h.now += 60000;
    return value;
  };
  assert.equal(
    (await h.service().reserve(h.authority, h.command)).kind,
    'OUTCOME_UNKNOWN',
  );
  assert.equal(h.calls.filter((x) => x.name === 'commit').length, 0);
  assert.deepEqual(h.data, before);
});
test('observation deadline crossed during trusted evidence verification stops normal settlement commit', async () => {
  const h = harness();
  h.data.aiUsageControls![0]!.dispatchEnabled = true;
  recorded(await h.service().reserve(h.authority, h.command));
  const claim = h.claim();
  recorded(await h.service().claimDispatch(h.authority, versioned(h), claim));
  const verify = h.dependencies.verifyEvidence;
  h.dependencies.verifyEvidence = async (...args) => {
    const value = await verify(...args);
    h.now += 100;
    return value;
  };
  const before = clone(h.data);
  assert.equal(
    (
      await h
        .service()
        .settle(
          h.authority,
          { ...versioned(h), claimId: claim.claimId, ownerId: claim.ownerId },
          { id: uuid(30), kind: 'FINAL_COST' },
        )
    ).kind,
    'OUTCOME_UNKNOWN',
  );
  assert.deepEqual(h.data, before);
});

import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import mongoose, { mongo, Mongoose, Types } from 'mongoose';
import * as schema from '../src/modules/ai/ai-usage-ledger.schema.js';
import {
  assertLedgerLinkage,
  proposeLedgerAdmission,
  proposeLedgerTransition,
  type LedgerProposal,
} from '../src/modules/ai/ai-usage-ledger.transitions.js';
import { privateLedgerOperationDto } from '../src/modules/ai/ai-usage-ledger.dto.js';
import { aiUsageTimeAt } from '../src/modules/ai/ai-usage-control.schema.js';

const now = Date.parse('2026-11-06T10:00:00.000Z');
const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const hex = (n: number) => schema.ledgerHex(id(n));
const uuid = (n: number) =>
  `${n.toString().padStart(8, '0')}-1111-4111-8111-${n.toString().padStart(12, '0')}`;
const money = (n: bigint | number) => schema.paiseFromBigInt(BigInt(n));
function clone<T extends object>(v: T): T {
  return mongo.BSON.deserialize(mongo.BSON.serialize(v), {
    promoteLongs: false,
  }) as T;
}
function allowed(v: ReturnType<typeof proposeLedgerAdmission>): LedgerProposal {
  assert.equal(v.kind, 'PROPOSED', JSON.stringify(v));
  if (v.kind !== 'PROPOSED') throw new Error('Expected proposal');
  return v;
}
function refused(
  v: ReturnType<typeof proposeLedgerAdmission>,
  code?: schema.LedgerCode,
) {
  assert.equal(v.kind, 'REFUSED');
  if (v.kind === 'REFUSED') {
    if (code) assert.equal(v.code, code);
    assert.equal(v.message, 'AI usage operation cannot proceed');
    assert.deepEqual(Object.keys(v), ['kind', 'code', 'message']);
  }
}
function invalid(fn: () => unknown) {
  assert.throws(fn, {
    name: 'Error',
    message: 'Invalid AI usage ledger input',
  });
}

function admission() {
  const command = {
    operationId: uuid(1),
    technologyId: hex(2),
    source: { id: hex(3), revision: 1 as const, digest: 'a'.repeat(64) },
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
  const quote = {
    id: uuid(2),
    periodKey: '2026-11',
    environment: 'DEV' as const,
    purpose: 'CURRICULUM_OUTLINE' as const,
    policyVersion: uuid(3),
    profileVersion: uuid(4),
    pricingVersion: uuid(5),
    privacyVersion: uuid(6),
    spendingApprovalRef: uuid(7),
    providerAlias: 'test-provider',
    modelAlias: 'test-model',
    templateVersion: uuid(8),
    requestDigest: schema.ledgerRequestDigest({
      instructions: command.instructions,
      inputJson: command.inputJson,
    }),
    requestBounds: command.requestBounds,
    inputTokenUpperBound: 100,
    worstCasePaise: money(100),
    effectiveAtMs: now - 1000,
    expiresAtMs: now + 3600000,
    assumptionsDigest: 'b'.repeat(64),
  };
  const control: schema.LedgerControl = {
    _id: id(4),
    schemaVersion: 1,
    scope: 'SHARED_AI_TESTING',
    version: 0,
    policyVersion: quote.policyVersion,
    policy: {
      capPaise: money(100000),
      warningPercent: 80,
      timezone: 'Asia/Kolkata',
      maxOpen: 1,
      maxActorMinute: 1,
    },
    profileVersion: quote.profileVersion,
    pricingVersion: quote.pricingVersion,
    privacyVersion: quote.privacyVersion,
    spendingApprovalRef: quote.spendingApprovalRef,
    dispatchEnabled: false,
    frozen: false,
    freezeReasons: [],
    activeOperationId: null,
    lastAdmissionAt: null,
    createdAt: new Date(now - 1000),
    updatedAt: new Date(now - 1),
  };
  const period: schema.LedgerPeriod = {
    _id: id(5),
    schemaVersion: 1,
    scope: 'SHARED_AI_TESTING',
    periodKey: '2026-11',
    version: 0,
    settledPaise: money(0),
    heldPaise: money(0),
    createdAt: new Date(now - 1000),
    updatedAt: new Date(now - 1),
  };
  return {
    nowMs: now,
    authority: {
      actorId: hex(1),
      currentAdmin: true,
      sessionCurrent: true,
      mutationFenced: true,
    },
    control,
    period,
    activeOperation: null as schema.LedgerOperation | null,
    actorWindowUsed: 0,
    command,
    quote,
    operationDocumentId: id(6),
    nextAuditId: id(7),
    facts: {
      sourceEligible: true,
      profileCurrent: true,
      pricingKnown: true,
      evidenceVerified: true,
      definitelyUnsent: true,
    },
  };
}
function evidence(
  kind: 'FINAL_COST' | 'DEFINITELY_UNSENT' = 'FINAL_COST',
  actual = 80,
): schema.LedgerEvidence {
  return {
    id: uuid(11),
    kind,
    evidenceDigest: 'c'.repeat(64),
    actualPaise: money(kind === 'FINAL_COST' ? actual : 0),
    inputTokens: kind === 'FINAL_COST' ? 10 : null,
    outputTokens: kind === 'FINAL_COST' ? 20 : null,
  };
}
function context(p: LedgerProposal, action: string) {
  const op = p.next.operation,
    at = op.updatedAt.getTime() + 1;
  let command: Record<string, unknown> = {
    operationId: op.operationId,
    expectedVersion: op.version,
  };
  if (action === 'RECONCILE')
    command = { ...command, originalActorId: schema.ledgerHex(op.actorId) };
  if (action === 'SETTLE' || action === 'MARK_UNCERTAIN')
    command = {
      ...command,
      claimId: op.claim?.id ?? uuid(9),
      ownerId: op.claim?.ownerId ?? uuid(10),
    };
  return {
    nowMs: at,
    authority: admission().authority,
    control: clone(p.next.control),
    period: clone(p.next.period),
    activeOperation: op.open
      ? clone(op)
      : (null as schema.LedgerOperation | null),
    operation: clone(op),
    command,
    nextAuditId: id(100 + op.version),
    claim:
      action === 'CLAIM_DISPATCH'
        ? {
            id: uuid(9),
            ownerId: uuid(10),
            claimedAt: new Date(at),
            observeUntil: new Date(at + op.requestBounds.budgetMs),
          }
        : null,
    evidence:
      action === 'CANCEL_UNSENT' ||
      (action === 'RECONCILE' && op.state === 'RESERVED')
        ? evidence('DEFINITELY_UNSENT')
        : action === 'SETTLE' ||
            action === 'RECONCILE' ||
            action === 'REPLAY_TERMINAL'
          ? op.terminalEvidence
            ? clone(op.terminalEvidence)
            : evidence()
          : null,
    request:
      action === 'CLAIM_DISPATCH'
        ? {
            schemaVersion: 1,
            purpose: 'CURRICULUM_OUTLINE',
            instructions: 'Outline',
            inputJson: '{}',
            maxOutputBytes: 1024,
            maxOutputTokens: 128,
          }
        : null,
    facts: admission().facts,
  };
}
function state(name: (typeof schema.ledgerStates)[number]): LedgerProposal {
  let p = allowed(proposeLedgerAdmission(admission()));
  if (name === 'RESERVED') return p;
  if (name === 'RELEASED')
    return allowed(
      proposeLedgerTransition('CANCEL_UNSENT', context(p, 'CANCEL_UNSENT')),
    );
  const claim = context(p, 'CLAIM_DISPATCH');
  claim.control.dispatchEnabled = true;
  p = allowed(proposeLedgerTransition('CLAIM_DISPATCH', claim));
  if (name === 'DISPATCH_CLAIMED') return p;
  if (name === 'UNCERTAIN')
    return allowed(
      proposeLedgerTransition('MARK_UNCERTAIN', context(p, 'MARK_UNCERTAIN')),
    );
  return allowed(proposeLedgerTransition('SETTLE', context(p, 'SETTLE')));
}

test('new admission is deterministic, detached, immutable and never dispatch authority', () => {
  const input = admission(),
    before = mongo.BSON.serialize(input);
  const a = allowed(proposeLedgerAdmission(input)),
    b = allowed(proposeLedgerAdmission(input));
  assert.deepEqual(a, b);
  assert.equal(a.dispatchAuthorized, false);
  assert.equal(a.next.operation.state, 'RESERVED');
  assert.equal(schema.paiseToBigInt(a.next.period.heldPaise), 100n);
  assert.equal(a.next.operation.version, 1);
  assert.equal(schema.ledgerHex(a.next.control.activeOperationId), hex(6));
  assert.deepEqual(mongo.BSON.serialize(input), before);
  a.next.control.policy.capPaise.low = 1;
  assert.equal(schema.paiseToBigInt(input.control.policy.capPaise), 100000n);
});

for (const amount of [0n, 1n, 100000n, 9007199254740991n])
  test(`exact monetary conversion ${amount}`, () => {
    const v = schema.paiseFromBigInt(amount);
    assert.equal(schema.paiseToBigInt(v), amount);
    assert.equal(schema.paiseToDecimal(v), amount.toString());
    assert.equal(schema.paiseToG1Number(v), Number(amount));
    assert.equal(
      schema.paiseToBigInt(schema.paiseFromDecimal(amount.toString())),
      amount,
    );
  });
for (const value of [
  -1n,
  9007199254740992n,
  1,
  1.1,
  NaN,
  Infinity,
  null,
  undefined,
  '1',
  {},
  [],
])
  test(`bigint input refuses ${typeof value}/${String(value)}`, () =>
    invalid(() => schema.paiseFromBigInt(value)));
for (const value of [
  '01',
  '+1',
  '-1',
  '1.0',
  ' 1',
  '1 ',
  '',
  '9007199254740992',
  '10000000000000000',
  1,
  null,
])
  test(`decimal input refuses ${String(value)}`, () =>
    invalid(() => schema.paiseFromDecimal(value)));
test('exact upward rational rounding and arithmetic overflow/underflow', () => {
  assert.equal(schema.paiseToBigInt(schema.roundPaiseUp(1n, 3n)), 1n);
  assert.equal(schema.paiseToBigInt(schema.roundPaiseUp(6n, 3n)), 2n);
  assert.equal(schema.paiseToBigInt(schema.roundPaiseUp(7n, 3n)), 3n);
  assert.equal(schema.paiseToBigInt(schema.roundPaiseUp(0n, 3n)), 0n);
  assert.equal(
    schema.paiseToBigInt(
      schema.roundPaiseUp(
        schema.ledgerMaximumPaise * schema.ledgerMaximumPaise,
        schema.ledgerMaximumPaise,
      ),
    ),
    schema.ledgerMaximumPaise,
  );
  for (const [n, d] of [
    [-1n, 1n],
    [1n, 0n],
    [1n, -1n],
    [schema.ledgerMaximumPaise + 1n, 1n],
    [schema.ledgerMaximumPaise * schema.ledgerMaximumPaise + 1n, 1n],
  ])
    invalid(() => schema.roundPaiseUp(n, d));
  invalid(() => schema.addPaise(money(schema.ledgerMaximumPaise), money(1)));
  invalid(() => schema.subtractPaise(money(0), money(1)));
});
for (const raw of [
  1,
  1n,
  '1',
  null,
  undefined,
  {},
  mongo.Long.fromBigInt(-1n),
  mongo.Long.fromBigInt(9007199254740992n),
  new mongo.Long(1, 0, true),
])
  test('noncanonical stored money refuses without coercion', () =>
    invalid(() => schema.paiseToBigInt(raw)));

test('hostile native Long/ObjectId/Date descriptors are never invoked', () => {
  let hits = 0;
  for (const [value, key, fn] of [
    [money(1), 'low', schema.paiseToBigInt],
    [id(1), 'i0', schema.ledgerObjectId],
    [new Date(now), 'getTime', schema.ledgerDate],
  ] as const) {
    Object.defineProperty(value, key, {
      get() {
        hits++;
        throw new Error('PRIVATE_CANARY');
      },
      enumerable: true,
      configurable: true,
    });
    invalid(() => fn(value));
  }
  assert.equal(hits, 0);
  invalid(() => schema.ledgerObjectId(hex(1)));
  invalid(() => schema.ledgerObjectId(uuid(1)));
  invalid(() => schema.ledgerDate(new Date(NaN)));
});
test('hostile plain objects, proxies, symbols and inherited/missing keys refuse safely', () => {
  let hits = 0;
  const hostile = () => {
    hits++;
    throw new Error('PRIVATE_CANARY');
  };
  const proxy = new Proxy(
    {},
    { get: hostile, ownKeys: hostile, getPrototypeOf: hostile },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const value of [
    proxy,
    revoked.proxy,
    [],
    new Date(),
    Object.create({ x: 1 }),
    null,
  ])
    invalid(() => schema.validateReserveCommand(value));
  for (const key of Reflect.ownKeys(admission().command)) {
    const c: Record<PropertyKey, unknown> = { ...admission().command };
    Object.defineProperty(c, key, { get: hostile, enumerable: true });
    invalid(() => schema.validateReserveCommand(c));
    const nested: Record<PropertyKey, unknown> = { ...admission().command };
    nested[key] = proxy;
    invalid(() => schema.validateReserveCommand(nested));
  }
  const extra = { ...admission().command, [Symbol('private')]: 1 };
  invalid(() => schema.validateReserveCommand(extra));
  const coercible = { toString: hostile, valueOf: hostile };
  invalid(() =>
    schema.validateReserveCommand({
      ...admission().command,
      instructions: coercible,
    }),
  );
  assert.equal(hits, 0);
});
test('comparison rejects serialization hooks/accessors/proxies without evaluation', () => {
  let hits = 0;
  const hook = () => {
    hits++;
    throw new Error('PRIVATE_CANARY');
  };
  for (const v of [
    { toBSON: hook },
    Object.defineProperty({}, 'v', { get: hook, enumerable: true }),
    new Proxy({}, { get: hook, ownKeys: hook }),
  ])
    invalid(() => schema.ledgerSame({ v }, { v: 1 }));
  const cycle: Record<string, unknown> = {};
  cycle.v = cycle;
  invalid(() => schema.ledgerSame(cycle, {}));
  assert.equal(hits, 0);
});

for (const [key, min, max] of [
  ['instructionBytes', 1, 8192],
  ['inputJsonBytes', 2, 65536],
  ['maxOutputBytes', 2, 65536],
  ['maxOutputTokens', 1, 4096],
  ['budgetMs', 1, 10000],
] as const) {
  test(`bounds ${key} inclusive`, () => {
    for (const n of [min, max])
      assert.equal(
        schema.ledgerBounds({ ...admission().command.requestBounds, [key]: n })[
          key
        ],
        n,
      );
  });
  for (const n of [min - 1, max + 1, 1.5, NaN, Infinity])
    test(`bounds ${key} refuses ${n}`, () =>
      invalid(() =>
        schema.ledgerBounds({ ...admission().command.requestBounds, [key]: n }),
      ));
}
test('technical text byte bounds, well-formed strings and strict JSON object', () => {
  for (const s of ['', ' ', '\r', '\ud800', 'x'.repeat(8193)])
    invalid(() =>
      schema.validateReserveCommand({
        ...admission().command,
        instructions: s,
      }),
    );
  for (const s of ['[]', 'null', '0', '"x"', '{', '{} ' + ' '.repeat(65536)])
    invalid(() =>
      schema.validateReserveCommand({ ...admission().command, inputJson: s }),
    );
  const c = admission().command;
  c.instructions = 'é'.repeat(4096);
  c.requestBounds.instructionBytes = 8192;
  schema.validateReserveCommand(c);
  c.instructions += 'é';
  invalid(() => schema.validateReserveCommand(c));
  const exact = admission().command;
  exact.inputJson = '{"x":"' + 'a'.repeat(65528) + '"}';
  exact.requestBounds.inputJsonBytes = 65536;
  schema.validateReserveCommand(exact);
});
for (const [key, value] of [
  ['id', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'],
  ['id', uuid(2).replace('-4111-', '-1111-')],
  ['periodKey', '2026-13'],
  ['environment', 'PROD'],
  ['purpose', 'LESSON'],
  ['providerAlias', 'https://private'],
  ['modelAlias', 'x'.repeat(65)],
  ['inputTokenUpperBound', 0],
  ['worstCasePaise', money(0)],
  ['expiresAtMs', now - 1000],
  ['requestDigest', 'a'.repeat(63)],
] as const)
  test(`quote rejects malformed ${key}`, () =>
    invalid(() =>
      schema.validateLedgerQuote({ ...admission().quote, [key]: value }),
    ));
for (const extra of ['$set', 'actorId', 'status', 'createdAt', 'toBSON'])
  test(`quote rejects unknown ${extra}`, () =>
    invalid(() =>
      schema.validateLedgerQuote({
        ...admission().quote,
        [extra]: 'PRIVATE_CANARY',
      }),
    ));
test('quote exact ceilings and detached native amount', () => {
  const q = admission().quote;
  q.worstCasePaise = money(schema.ledgerMaximumPaise);
  q.inputTokenUpperBound = Number.MAX_SAFE_INTEGER;
  const copy = schema.validateLedgerQuote(q);
  assert.notEqual(copy.worstCasePaise, q.worstCasePaise);
  assert.equal(
    schema.validateLedgerQuote({ ...q, providerAlias: 'a'.repeat(64) })
      .providerAlias.length,
    64,
  );
});
test('explicit UTC minute and Kolkata month boundaries', () => {
  const before = Date.parse('2026-10-31T18:29:59.999Z'),
    after = before + 1;
  assert.equal(aiUsageTimeAt(before).periodKey, '2026-10');
  assert.equal(aiUsageTimeAt(after).periodKey, '2026-11');
  assert.equal(aiUsageTimeAt(59999).actorWindowKey, 0);
  assert.equal(aiUsageTimeAt(60000).actorWindowKey, 1);
  for (const n of [-1, 0.1, NaN, Infinity, 253402280200000])
    invalid(() => schema.ledgerTime(n));
  schema.ledgerTime(253402280199999);
});

test('all four fingerprints match independent fixed vectors', () => {
  const f = admission();
  const request = schema.ledgerRequestDigest({
    instructions: f.command.instructions,
    inputJson: f.command.inputJson,
  });
  const intent = schema.ledgerIntentFingerprint({
      actorId: f.authority.actorId,
      command: f.command,
    }),
    quote = schema.ledgerQuoteDigest(f.quote);
  const reservation = schema.ledgerReservationFingerprint({
    intentFingerprint: intent,
    periodKey: f.quote.periodKey,
    admissionWindowKey: aiUsageTimeAt(now).actorWindowKey,
    quoteDigest: quote,
  });
  assert.deepEqual(
    [request, intent, quote, reservation],
    [
      '3291f1606a3878b2c048b7247af1c06e5a374aa1d79b97705a50d15af8401384',
      '20a403144243a33205cf9c2a3ae46c38484f6287ed7898682ef0458d840ca56d',
      'fba4ac6ff02ccda98990af51dca6333efdeadc6e18201f3fde605b4218994341',
      '9625f06e7567de61d63644e3b4db1b7db6737f1fca16b684f959b055f5ab798f',
    ],
  );
});
test('fingerprints bind bytes, actor/key, source, quote and admission without mutation', () => {
  const f = admission(),
    b = clone(f);
  const a = schema.ledgerIntentFingerprint({
    actorId: f.authority.actorId,
    command: f.command,
  });
  const c = clone(f.command);
  c.inputJson = '{ }';
  c.requestBounds.inputJsonBytes = 3;
  assert.notEqual(
    a,
    schema.ledgerIntentFingerprint({
      actorId: f.authority.actorId,
      command: c,
    }),
  );
  assert.notEqual(
    a,
    schema.ledgerIntentFingerprint({ actorId: hex(30), command: f.command }),
  );
  for (const change of [
    { operationId: uuid(30) },
    { technologyId: hex(30) },
    { source: { ...f.command.source, digest: 'd'.repeat(64) } },
  ])
    assert.notEqual(
      a,
      schema.ledgerIntentFingerprint({
        actorId: f.authority.actorId,
        command: { ...f.command, ...change },
      }),
    );
  assert.notEqual(
    schema.ledgerQuoteDigest(f.quote),
    schema.ledgerQuoteDigest({ ...f.quote, worstCasePaise: money(101) }),
  );
  assert.deepEqual(f, b);
});

test('strict record enums, reason arrays, native pointer and timestamps', () => {
  const c = admission().control;
  for (const change of [
    { frozen: true },
    { freezeReasons: ['UNCERTAIN'] },
    { frozen: true, freezeReasons: ['UNCERTAIN', 'OPERATOR_HOLD'] },
    { frozen: true, freezeReasons: ['UNCERTAIN', 'UNCERTAIN'] },
    { activeOperationId: uuid(1) },
    { _id: hex(4) },
    { updatedAt: new Date(now - 2000) },
    { policy: { ...c.policy, capPaise: money(100001) } },
  ])
    invalid(() => schema.validateLedgerControl({ ...c, ...change }));
  const p = state('RESERVED').next.operation;
  for (const change of [
    { state: ['RESERVED'] },
    { state: 'FAILED' },
    { open: false },
    { actualPaise: money(0) },
    { heldPaise: money(0) },
    { quoteDigest: '0'.repeat(64) },
    { intentFingerprint: '0'.repeat(64) },
    { reservationFingerprint: '0'.repeat(64) },
    { source: { ...p.source, revision: 2 } },
    { admissionWindowKey: p.admissionWindowKey + 1 },
  ])
    invalid(() => schema.validateLedgerOperation({ ...p, ...change }));
});
test('claims and terminal evidence exact invariants', () => {
  const p = state('DISPATCH_CLAIMED').next.operation;
  const claim = p.claim;
  assert.ok(claim);
  invalid(() =>
    schema.validateLedgerOperation({
      ...p,
      claim: {
        ...claim,
        observeUntil: new Date(claim.observeUntil.getTime() + 1),
      },
    }),
  );
  invalid(() =>
    schema.validateLedgerEvidence({
      ...evidence('DEFINITELY_UNSENT'),
      actualPaise: money(1),
    }),
  );
  invalid(() =>
    schema.validateLedgerEvidence({
      ...evidence('DEFINITELY_UNSENT'),
      inputTokens: 0,
    }),
  );
  invalid(() =>
    schema.validateLedgerOperation({
      ...state('SETTLED').next.operation,
      terminalEvidence: null,
    }),
  );
});
test('immutable identity, quote and claim guards', () => {
  const before = state('RESERVED').next.operation,
    after = clone(before);
  after.lastAuditId = id(999);
  after.version++;
  schema.assertLedgerImmutable(before, after);
  invalid(() =>
    schema.assertLedgerImmutable(before, { ...after, _id: id(99) }),
  );
  invalid(() =>
    schema.assertLedgerImmutable(before, {
      ...after,
      quote: { ...after.quote, modelAlias: 'other' },
    }),
  );
  const claimed = state('DISPATCH_CLAIMED').next.operation;
  assert.ok(claimed.claim);
  invalid(() =>
    schema.assertLedgerImmutable(claimed, {
      ...claimed,
      claim: { ...claimed.claim, ownerId: uuid(99) },
    }),
  );
});

for (const action of [
  'READ_OPERATION',
  'CANCEL_UNSENT',
  'CLAIM_DISPATCH',
  'SETTLE',
  'MARK_UNCERTAIN',
  'RECONCILE',
  'REPLAY_TERMINAL',
])
  test(`command ${action} strict identities/unknown fields`, () => {
    const c = context(state('DISPATCH_CLAIMED'), action).command;
    const input = action === 'READ_OPERATION' ? { operationId: uuid(1) } : c;
    schema.validateLedgerCommand(action, input);
    invalid(() => schema.validateLedgerCommand(action, { ...input, $set: 1 }));
    invalid(() =>
      schema.validateLedgerCommand(action, { ...input, operationId: 'bad' }),
    );
  });
test('unknown command action refuses', () =>
  invalid(() =>
    schema.validateLedgerCommand('PUBLISH', { operationId: uuid(1) }),
  ));

for (const name of schema.ledgerStates)
  for (const action of schema.ledgerActions) {
    test(`matrix ${name} / ${action}`, () => {
      const p = state(name),
        c = context(p, action);
      if (action === 'CLAIM_DISPATCH') c.control.dispatchEnabled = true;
      const result = proposeLedgerTransition(action, c);
      const permitted: Record<string, readonly string[]> = {
        RESERVED: ['CLAIM_DISPATCH', 'CANCEL_UNSENT', 'RECONCILE'],
        DISPATCH_CLAIMED: ['SETTLE', 'MARK_UNCERTAIN'],
        UNCERTAIN: ['RECONCILE'],
        SETTLED: ['REPLAY_TERMINAL'],
        RELEASED: ['REPLAY_TERMINAL'],
      };
      if (permitted[name]?.includes(action)) {
        const next = allowed(result);
        assert.equal(next.dispatchAuthorized, false);
      } else refused(result);
    });
  }
test('absent operation allows only new admission; no invented transition', () => {
  allowed(proposeLedgerAdmission(admission()));
  for (const action of schema.ledgerActions)
    refused(
      proposeLedgerTransition(action, {
        ...context(state('RESERVED'), action),
        operation: null,
      }),
    );
});
test('current authority and mutation fencing are supplied guards, not authentic proof', () => {
  for (const key of [
    'currentAdmin',
    'sessionCurrent',
    'mutationFenced',
  ] as const) {
    const f = admission();
    f.authority[key] = false;
    refused(proposeLedgerAdmission(f), 'FORBIDDEN');
  }
  const p = state('DISPATCH_CLAIMED');
  const c = context(p, 'SETTLE');
  c.authority.actorId = hex(99);
  refused(proposeLedgerTransition('SETTLE', c), 'FORBIDDEN');
  const explicit = context(state('UNCERTAIN'), 'RECONCILE');
  explicit.authority.actorId = hex(99);
  allowed(proposeLedgerTransition('RECONCILE', explicit));
});
test('admission enforces one open, fixed minute, current period and cap/warning edges', () => {
  const open = state('RESERVED');
  const f = admission();
  f.control = clone(open.next.control);
  f.period = clone(open.next.period);
  f.activeOperation = clone(open.next.operation);
  refused(proposeLedgerAdmission(f), 'CONCURRENCY_LIMIT');
  const rate = admission();
  rate.actorWindowUsed = 1;
  refused(proposeLedgerAdmission(rate), 'RATE_LIMIT');
  for (const [settled, ok] of [
    [99900, true],
    [99901, false],
  ] as const) {
    const c = admission();
    c.period.settledPaise = money(settled);
    if (ok) allowed(proposeLedgerAdmission(c));
    else refused(proposeLedgerAdmission(c), 'BUDGET_EXCEEDED');
  }
  const frozen = admission();
  frozen.control.frozen = true;
  frozen.control.freezeReasons = ['OPERATOR_HOLD'];
  refused(proposeLedgerAdmission(frozen), 'USAGE_FROZEN');
  const expired = admission();
  expired.quote.expiresAtMs = now;
  refused(proposeLedgerAdmission(expired), 'QUOTE_EXPIRED');
  const profile = admission();
  profile.quote.profileVersion = uuid(99);
  refused(proposeLedgerAdmission(profile), 'CONTROL_UNAVAILABLE');
  const parent = admission();
  parent.facts.sourceEligible = false;
  refused(proposeLedgerAdmission(parent), 'SOURCE_UNAVAILABLE');
});
test('prior-month uncertainty may reconcile but cannot admit or dispatch', () => {
  const p = state('UNCERTAIN');
  const c = context(p, 'RECONCILE');
  c.nowMs = Date.parse('2026-12-01T00:00:00.000Z');
  c.control.freezeReasons = ['OPERATOR_HOLD', 'UNCERTAIN'];
  c.control.frozen = true;
  c.authority.actorId = hex(50);
  const result = allowed(proposeLedgerTransition('RECONCILE', c));
  assert.equal(result.next.operation.state, 'SETTLED');
  assert.equal(result.next.period.periodKey, '2026-11');
  assert.equal(schema.paiseToBigInt(result.next.period.settledPaise), 80n);
  assert.deepEqual(result.next.control.freezeReasons, ['OPERATOR_HOLD']);
  assert.equal(result.next.control.frozen, true);
  assert.equal(result.next.control.activeOperationId, null);
  const f = admission();
  f.nowMs = c.nowMs;
  f.control = clone(p.next.control);
  f.period = { ...f.period, periodKey: '2026-12' };
  f.quote = {
    ...f.quote,
    periodKey: '2026-12',
    effectiveAtMs: c.nowMs - 1,
    expiresAtMs: c.nowMs + 1000,
  };
  f.activeOperation = clone(p.next.operation);
  refused(proposeLedgerAdmission(f), 'USAGE_FROZEN');
});
test('independent freeze never prevents defined known-unsent accounting cancellation', () => {
  const c = context(state('RESERVED'), 'CANCEL_UNSENT');
  c.control.freezeReasons = ['OPERATOR_HOLD'];
  c.control.frozen = true;
  c.nowMs = Date.parse('2026-12-01T00:00:00Z');
  const p = allowed(proposeLedgerTransition('CANCEL_UNSENT', c));
  assert.equal(p.next.operation.state, 'RELEASED');
  assert.deepEqual(p.next.control.freezeReasons, ['OPERATOR_HOLD']);
  assert.equal(schema.paiseToBigInt(p.next.period.heldPaise), 0n);
});
test('unknown evidence never settles/releases; uncertainty retains full liability', () => {
  for (const name of ['RESERVED', 'UNCERTAIN'] as const) {
    const c = context(
      state(name),
      name === 'RESERVED' ? 'CANCEL_UNSENT' : 'RECONCILE',
    );
    c.facts.evidenceVerified = false;
    refused(
      proposeLedgerTransition(
        name === 'RESERVED' ? 'CANCEL_UNSENT' : 'RECONCILE',
        c,
      ),
    );
    c.evidence = null;
    refused(
      proposeLedgerTransition(
        name === 'RESERVED' ? 'CANCEL_UNSENT' : 'RECONCILE',
        c,
      ),
    );
  }
  const c = context(state('DISPATCH_CLAIMED'), 'MARK_UNCERTAIN');
  c.facts.pricingKnown = false;
  c.facts.evidenceVerified = false;
  c.nowMs += 100000;
  const p = allowed(proposeLedgerTransition('MARK_UNCERTAIN', c));
  assert.equal(schema.paiseToBigInt(p.next.operation.heldPaise), 100n);
  assert.equal(p.next.operation.actualPaise, null);
  assert.equal(p.next.control.frozen, true);
});

test('claimed known-unsent reconciliation releases only with verified proof and preserves holds', () => {
  const p = state('DISPATCH_CLAIMED'),
    c = context(p, 'RECONCILE');
  c.nowMs = p.next.operation.quote.expiresAtMs + 1;
  c.authority.actorId = hex(50);
  c.evidence = evidence('DEFINITELY_UNSENT');
  c.control.freezeReasons = ['OPERATOR_HOLD', 'PRICE_UNKNOWN'];
  c.control.frozen = true;
  c.facts.sourceEligible = false;
  c.facts.profileCurrent = false;
  c.facts.pricingKnown = false;
  const before = mongo.BSON.serialize(c),
    released = allowed(proposeLedgerTransition('RECONCILE', c));
  assert.equal(released.next.operation.state, 'RELEASED');
  assert.equal(schema.paiseToBigInt(released.next.period.heldPaise), 0n);
  assert.equal(schema.paiseToBigInt(released.next.period.settledPaise), 0n);
  assert.equal(released.next.control.activeOperationId, null);
  assert.deepEqual(released.next.control.freezeReasons, [
    'OPERATOR_HOLD',
    'PRICE_UNKNOWN',
  ]);
  assert.equal(released.dispatchAuthorized, false);
  assert.deepEqual(mongo.BSON.serialize(c), before);
  c.facts.definitelyUnsent = false;
  refused(proposeLedgerTransition('RECONCILE', c), 'STATE_CONFLICT');
  c.facts.definitelyUnsent = true;
  c.facts.evidenceVerified = false;
  refused(proposeLedgerTransition('RECONCILE', c), 'STATE_CONFLICT');
});

test('expired unavailable-source reservation may be explicitly reconciled by a different current Admin', () => {
  const p = state('RESERVED'),
    c = context(p, 'RECONCILE');
  c.authority.actorId = hex(50);
  c.nowMs = Date.parse('2026-12-01T00:00:00Z');
  c.facts.sourceEligible = false;
  c.facts.profileCurrent = false;
  const result = allowed(proposeLedgerTransition('RECONCILE', c));
  assert.equal(result.next.operation.state, 'RELEASED');
  assert.equal(schema.ledgerHex(result.next.operation.actorId), hex(1));
  assert.equal(result.next.operation.periodKey, '2026-11');
});

test('UNCERTAIN may explicitly release with verified no-dispatch proof, preserving other freezes', () => {
  const c = context(state('UNCERTAIN'), 'RECONCILE');
  c.evidence = evidence('DEFINITELY_UNSENT');
  c.control.freezeReasons = ['OPERATOR_HOLD', 'UNCERTAIN'];
  c.control.frozen = true;
  const result = allowed(proposeLedgerTransition('RECONCILE', c));
  assert.equal(result.next.operation.state, 'RELEASED');
  assert.deepEqual(result.next.control.freezeReasons, ['OPERATOR_HOLD']);
  assert.equal(result.next.operation.actualPaise?.toString(), '0');
});

test('strict record roots never evaluate hostile leaf values or property getters', () => {
  let hits = 0;
  const bad = () => {
    hits++;
    throw new Error('PRIVATE_CANARY');
  };
  const proxy = new Proxy({}, { get: bad, getPrototypeOf: bad, ownKeys: bad });
  const f = admission(),
    op = state('RESERVED').next.operation;
  const cases: Array<[Record<string, unknown>, (v: unknown) => unknown]> = [
    [f.control, schema.validateLedgerControl],
    [f.period, schema.validateLedgerPeriod],
    [f.quote, schema.validateLedgerQuote],
    [op, schema.validateLedgerOperation],
  ];
  for (const [row, validate] of cases)
    for (const key of Object.keys(row)) {
      const getter = { ...row };
      Object.defineProperty(getter, key, { get: bad, enumerable: true });
      invalid(() => validate(getter));
      invalid(() => validate({ ...row, [key]: proxy }));
    }
  assert.equal(hits, 0);
});

test('claim expiry/month, clock regression and version overflow cannot create proposals', () => {
  const p = state('RESERVED'),
    expired = context(p, 'CLAIM_DISPATCH');
  expired.control.dispatchEnabled = true;
  expired.nowMs = p.next.operation.quote.expiresAtMs;
  refused(proposeLedgerTransition('CLAIM_DISPATCH', expired), 'QUOTE_EXPIRED');
  expired.nowMs = Date.parse('2026-12-01T00:00:00Z');
  refused(proposeLedgerTransition('CLAIM_DISPATCH', expired), 'QUOTE_MISMATCH');
  const regressed = admission();
  regressed.nowMs = now - 2000;
  refused(proposeLedgerAdmission(regressed), 'CONTROL_UNAVAILABLE');
  const overflow = context(p, 'CLAIM_DISPATCH');
  overflow.control.dispatchEnabled = true;
  overflow.control.version = Number.MAX_SAFE_INTEGER;
  refused(proposeLedgerTransition('CLAIM_DISPATCH', overflow), 'INVALID_INPUT');
});
test('claim refuses over-cap exposure, disabled/frozen profile, expired quote and changed request', () => {
  const p = state('RESERVED');
  const c = context(p, 'CLAIM_DISPATCH');
  c.control.dispatchEnabled = true;
  c.period.settledPaise = money(100000);
  refused(proposeLedgerTransition('CLAIM_DISPATCH', c), 'USAGE_FROZEN');
  const disabled = context(p, 'CLAIM_DISPATCH');
  refused(
    proposeLedgerTransition('CLAIM_DISPATCH', disabled),
    'CONTROL_UNAVAILABLE',
  );
  const frozen = context(p, 'CLAIM_DISPATCH');
  frozen.control.dispatchEnabled = true;
  frozen.control.frozen = true;
  frozen.control.freezeReasons = ['OPERATOR_HOLD'];
  refused(proposeLedgerTransition('CLAIM_DISPATCH', frozen), 'USAGE_FROZEN');
  const changed = context(p, 'CLAIM_DISPATCH');
  changed.control.dispatchEnabled = true;
  assert.ok(changed.request);
  changed.request.instructions = 'Altered';
  refused(proposeLedgerTransition('CLAIM_DISPATCH', changed), 'QUOTE_MISMATCH');
});
test('late normal settlement requires explicit uncertainty/reconciliation; no replay', () => {
  const p = state('DISPATCH_CLAIMED'),
    c = context(p, 'SETTLE');
  assert.ok(p.next.operation.claim);
  c.nowMs = p.next.operation.claim.observeUntil.getTime();
  refused(proposeLedgerTransition('SETTLE', c), 'STATE_CONFLICT');
  const u = context(p, 'MARK_UNCERTAIN');
  u.nowMs = c.nowMs;
  const uncertain = allowed(proposeLedgerTransition('MARK_UNCERTAIN', u));
  const reconciled = allowed(
    proposeLedgerTransition('RECONCILE', context(uncertain, 'RECONCILE')),
  );
  assert.equal(reconciled.next.operation.state, 'SETTLED');
  assert.equal(reconciled.dispatchAuthorized, false);
});
test('overrun is recorded exactly and freezes without releasing unknown cost', () => {
  const c = context(state('DISPATCH_CLAIMED'), 'SETTLE');
  c.evidence = evidence('FINAL_COST', 100001);
  const p = allowed(proposeLedgerTransition('SETTLE', c));
  assert.equal(schema.paiseToBigInt(p.next.operation.actualPaise), 100001n);
  assert.deepEqual(p.next.control.freezeReasons, ['OVERRUN']);
  assert.equal(schema.paiseToBigInt(p.next.period.heldPaise), 0n);
});
test('pointer, actor/key, stale owner/version and contradictory uncertainty refuse', () => {
  const p = state('DISPATCH_CLAIMED');
  for (const change of [
    { expectedVersion: 1 },
    { ownerId: uuid(99) },
    { operationId: uuid(99) },
  ]) {
    const c = context(p, 'SETTLE');
    c.command = { ...c.command, ...change };
    refused(proposeLedgerTransition('SETTLE', c));
  }
  const c = context(p, 'SETTLE');
  c.control.activeOperationId = id(999);
  refused(proposeLedgerTransition('SETTLE', c));
  const u = state('UNCERTAIN');
  invalid(() =>
    assertLedgerLinkage(
      { ...u.next.control, frozen: false, freezeReasons: [] },
      u.next.operation,
      u.next.operation,
    ),
  );
  const linked = clone(p.next.operation);
  linked.actorId = id(999);
  invalid(() => assertLedgerLinkage(p.next.control, linked, p.next.operation));
});
test('terminal identical evidence replay is read-only even with old expected version', () => {
  const p = state('SETTLED'),
    c = context(p, 'REPLAY_TERMINAL');
  c.command.expectedVersion = 1;
  c.authority.mutationFenced = false;
  const out = allowed(proposeLedgerTransition('REPLAY_TERMINAL', c));
  assert.equal(out.readOnly, true);
  assert.equal(out.auditAction, null);
  assert.deepEqual(out.next, p.next);
  c.evidence = evidence('FINAL_COST', 81);
  refused(proposeLedgerTransition('REPLAY_TERMINAL', c), 'STATE_CONFLICT');
});
test('old terminal read/replay permits newer active operation without clearing it', () => {
  const closed = state('SETTLED'),
    f = admission();
  f.command.operationId = uuid(55);
  f.operationDocumentId = id(56);
  f.period = clone(closed.next.period);
  f.control = clone(closed.next.control);
  f.nowMs += 60000;
  f.actorWindowUsed = 0;
  const newer = allowed(proposeLedgerAdmission(f));
  const c = context(closed, 'REPLAY_TERMINAL');
  c.control = clone(newer.next.control);
  c.period = clone(newer.next.period);
  c.activeOperation = clone(newer.next.operation);
  c.nowMs = f.nowMs + 1;
  const replay = allowed(proposeLedgerTransition('REPLAY_TERMINAL', c));
  assert.equal(
    schema.ledgerHex(replay.next.control.activeOperationId),
    hex(56),
  );
  assert.equal(replay.readOnly, true);
  const dto = privateLedgerOperationDto(closed.next.operation, {
    actorId: hex(1),
    nowMs: f.nowMs,
    control: newer.next.control,
    currentPeriod: newer.next.period,
    activeOperation: newer.next.operation,
  });
  assert.equal(dto.state, 'SETTLED');
});
test('DTO exact allowlist, current warning, null actual and no private identities/digests', () => {
  const p = state('RESERVED'),
    period = { ...p.next.period, settledPaise: money(79900) };
  const dto = privateLedgerOperationDto(p.next.operation, {
    actorId: hex(1),
    nowMs: now,
    control: p.next.control,
    currentPeriod: period,
    activeOperation: p.next.operation,
  });
  assert.deepEqual(Object.keys(dto), [
    'operationId',
    'technologyId',
    'state',
    'version',
    'periodKey',
    'reservationPaise',
    'heldPaise',
    'actualPaise',
    'warning80Percent',
    'requiresReconciliation',
    'admittedAt',
    'updatedAt',
  ]);
  assert.equal(dto.warning80Percent, true);
  assert.equal(dto.actualPaise, null);
  assert.equal(dto.heldPaise, '100');
  const json = JSON.stringify(dto);
  for (const key of [
    'quote',
    'actorId',
    'claim',
    'requestDigest',
    'evidenceDigest',
    'source',
    'instructions',
    'inputJson',
    'token',
  ])
    assert.equal(json.includes(key), false);
  invalid(() =>
    privateLedgerOperationDto(p.next.operation, {
      actorId: hex(99),
      nowMs: now,
      control: p.next.control,
      currentPeriod: period,
      activeOperation: p.next.operation,
    }),
  );
});
test('policy evaluation uses explicit time and leaves all facts unchanged', () => {
  const c = context(state('UNCERTAIN'), 'RECONCILE'),
    before = mongo.BSON.serialize(c);
  const date = mock.method(Date, 'now', () => {
    throw new Error('ambient clock');
  });
  try {
    const a = proposeLedgerTransition('RECONCILE', c),
      b = proposeLedgerTransition('RECONCILE', c);
    assert.deepEqual(a, b);
    allowed(a);
    assert.deepEqual(mongo.BSON.serialize(c), before);
  } finally {
    date.mock.restore();
  }
});

test('DTO refuses contradictory same-period settlement and future snapshots', () => {
  const p = state('SETTLED'),
    context = {
      actorId: hex(1),
      nowMs: p.next.operation.updatedAt.getTime(),
      control: p.next.control,
      currentPeriod: p.next.period,
      activeOperation: null,
    };
  privateLedgerOperationDto(p.next.operation, context);
  invalid(() =>
    privateLedgerOperationDto(p.next.operation, {
      ...context,
      currentPeriod: { ...context.currentPeriod, settledPaise: money(79) },
    }),
  );
  invalid(() =>
    privateLedgerOperationDto(p.next.operation, { ...context, nowMs: now - 1 }),
  );
});

test('imports/models are inert and all model/DDL writer paths fail closed', async () => {
  let effects = 0;
  function forbidden() {
    effects++;
    throw new Error('PRIVATE_CANARY');
  }
  const priorModels = Object.keys(mongoose.models),
    priorState = mongoose.connection.readyState;
  mock.method(net, 'connect', forbidden);
  mock.method(net, 'createConnection', forbidden);
  mock.method(tls, 'connect', forbidden);
  mock.method(http, 'request', forbidden);
  mock.method(https, 'request', forbidden);
  mock.method(childProcess, 'spawn', forbidden);
  mock.method(childProcess, 'exec', forbidden);
  mock.method(globalThis, 'fetch', forbidden);
  mock.method(net.Socket.prototype, 'connect', forbidden);
  mock.method(net.Server.prototype, 'listen', forbidden);
  mock.method(mongoose.Connection.prototype, 'openUri', forbidden);
  mock.method(mongoose.Connection.prototype, 'createCollection', forbidden);
  syncBuiltinESMExports();
  try {
    const module = await import('../src/modules/ai/ai-usage-ledger.model.js');
    assert.equal(module.ledgerRequiredIndexes.length, 11);
    assert.deepEqual(Object.keys(mongoose.models), priorModels);
    const host = new Mongoose({ autoCreate: false, autoIndex: false })
      .connection;
    const models = module.registerAiUsageLedgerModels(host);
    assert.equal(host.readyState, 0);
    assert.equal(module.registerAiUsageLedgerModels(host), models);
    const f = state('RESERVED');
    for (const [Model, row] of [
      [models.Control, f.next.control],
      [models.Period, f.next.period],
      [models.Operation, f.next.operation],
    ] as const) {
      assert.equal(Model.schema.options.autoCreate, false);
      assert.equal(Model.schema.options.autoIndex, false);
      assert.equal(Model.schema.options.bufferCommands, false);
      assert.equal(Model.schema.options.versionKey, false);
      const doc = new Model(row);
      assert.equal(doc.validateSync(), null);
      await doc.validate();
      await assert.rejects(doc.save(), {
        message: 'Invalid AI usage ledger input',
      });
      await assert.rejects(
        Model.updateOne({}, { $set: { state: 'PRIVATE_CANARY' } }),
        { message: 'Invalid AI usage ledger input' },
      );
      await assert.rejects(Model.insertMany([row]), {
        message: 'Invalid AI usage ledger input',
      });
      await assert.rejects(Model.bulkWrite([]), {
        message: 'Invalid AI usage ledger input',
      });
      await assert.rejects(Model.createCollection(), {
        message: 'Invalid AI usage ledger input',
      });
      await assert.rejects(Model.createIndexes(), {
        message: 'Invalid AI usage ledger input',
      });
      doc.set('scope', 'PRIVATE_CANARY');
      assert.equal(
        doc.validateSync()?.message,
        'Invalid AI usage ledger input',
      );
      await assert.rejects(doc.validate(), {
        message: 'Invalid AI usage ledger input',
      });
      await assert.rejects(Model.validate(row), {
        message: 'Invalid AI usage ledger input',
      });
    }
    const raw = new host.models.AiUsageLedgerOperation!(f.next.operation);
    assert.equal(raw.validateSync()?.message, 'Invalid AI usage ledger input');
    assert.equal(mongoose.connection.readyState, priorState);
    assert.deepEqual(Object.keys(mongoose.models), priorModels);
    assert.equal(effects, 0);
  } finally {
    mock.restoreAll();
    syncBuiltinESMExports();
  }
});
test('production imports contain no startup/config/provider/writer registration', () => {
  for (const file of ['schema', 'model', 'dto', 'transitions']) {
    const source = readFileSync(
      new URL(`../src/modules/ai/ai-usage-ledger.${file}.ts`, import.meta.url),
      'utf8',
    );
    for (const forbidden of [
      'config/database',
      'config/env',
      'process.env',
      'connect(',
      'openUri(',
      'fetch(',
      'setTimeout(',
      'createCollection(',
      'executeAiProvider',
    ])
      assert.equal(source.includes(forbidden), false, `${file}: ${forbidden}`);
  }
});

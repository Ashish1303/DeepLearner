import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import mongoose, { Types } from 'mongoose';
import {
  createOutlineSessionFence,
  type OutlineFencePorts,
} from '../src/modules/ai/curriculum-outline-session-fence.js';

const actor = '111111111111111111111111',
  sid = '222222222222222222222222',
  attemptId = '333333333333333333333333';
const other = '444444444444444444444444',
  digest = 'a'.repeat(64);
const now = Date.parse('2026-11-08T00:00:00.000Z');
const oid = (s: string) => new Types.ObjectId(s);
const ack = () => ({
  acknowledged: true,
  matchedCount: 1,
  modifiedCount: 1,
  upsertedCount: 0,
  upsertedId: null,
});
const marker = () => ({
  claimVersion: 1,
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  claimedAt: new Date(now - 100),
  observeUntil: new Date(now + 1000),
  markedAt: new Date(now),
});
function harness(
  mode: 'PREPARE' | 'MARK' | 'CAPTURE' | 'CANCEL' | 'READ' = 'MARK',
) {
  const request = {
    mode,
    actorId: actor,
    originSessionId: sid,
    requestingSessionId: sid,
    attemptId,
    bindingDigest: digest,
    expectedVersion: mode === 'CAPTURE' ? 1 : 0,
    phase: mode === 'CAPTURE' ? 'INVOCATION_MARKED' : 'PREPARED',
    invocation: mode === 'CAPTURE' ? marker() : null,
  };
  const user: Record<string, unknown> = {
    _id: oid(actor),
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerifiedAt: new Date(now - 10000),
    __v: 7,
  };
  const sessionRow: Record<string, unknown> = {
    _id: oid(sid),
    userId: oid(actor),
    revokedAt: null,
    expiresAt: new Date(now + 60000),
    __v: 3,
  };
  const attempt: Record<string, unknown> = {
    _id: oid(attemptId),
    actorId: oid(actor),
    sessionId: oid(sid),
    bindingDigest: digest,
    version: request.expectedVersion,
    phase: request.phase,
    cancelledAt: null,
    invocation: request.invocation,
    completion: null,
    receipt: null,
  };
  const auth: Record<string, unknown> = {
    sub: actor,
    sid,
    role: 'ADMIN',
    plan: 'FREE',
  };
  const loss = new AbortController(),
    workLoss = new AbortController();
  const events: {
    name: string;
    filter?: Record<string, unknown>;
    update?: unknown;
    options?: unknown;
  }[] = [];
  let utc = now,
    mono = 0,
    nextTimer = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const state = {
    active: true,
    ended: false,
    remaining: 10000,
    userAck: ack() as unknown,
    sessionAck: ack() as unknown,
    hook: (async () => {}) as (name: string) => Promise<void>,
    userMissing: false,
    sessionMissing: false,
    attemptMissing: mode === 'PREPARE',
  };
  const session = {
    inTransaction: () => state.active,
    get hasEnded() {
      return state.ended;
    },
    startTransaction: () => assert.fail('independent transaction'),
    commitTransaction: () => assert.fail('independent commit'),
    abortTransaction: () => assert.fail('independent abort'),
    endSession: () => assert.fail('independent cleanup'),
  };
  function collection(
    name: string,
    row: Record<string, unknown>,
    missing: () => boolean,
  ) {
    return {
      async findOne(
        filter: Record<string, unknown>,
        options: { projection: Record<string, 1> },
      ) {
        events.push({ name: `${name}.read`, filter, options });
        await state.hook(`${name}.read`);
        if (missing()) return null;
        const projected: Record<string, unknown> = {};
        for (const key of Object.keys(options.projection)) {
          const [parent, child] = key.split('.');
          if (!parent || !Object.hasOwn(row, parent)) continue;
          if (!child) {
            Object.defineProperty(
              projected,
              parent,
              Object.getOwnPropertyDescriptor(row, parent)!,
            );
          } else {
            const value = row[parent];
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
              projected[parent] = value;
            } else {
              const target = (projected[parent] ??= {});
              const descriptor = Object.getOwnPropertyDescriptor(value, child);
              if (descriptor) Object.defineProperty(target, child, descriptor);
            }
          }
        }
        return projected;
      },
      async updateOne(
        filter: Record<string, unknown>,
        update: unknown,
        options: unknown,
      ) {
        events.push({ name: `${name}.write`, filter, update, options });
        await state.hook(`${name}.write`);
        return name === 'user' ? state.userAck : state.sessionAck;
      },
    };
  }
  const ports: OutlineFencePorts = {
    session,
    users: collection('user', user, () => state.userMissing),
    sessions: collection('session', sessionRow, () => state.sessionMissing),
    attempts: collection('attempt', attempt, () => state.attemptMissing),
    async verify() {
      events.push({ name: 'verify' });
      await state.hook('verify');
      return auth;
    },
    clock: {
      now: () => utc,
      monotonic: () => mono,
      setTimeout(callback, ms) {
        const id = ++nextTimer;
        timers.set(id, { callback, at: mono + ms });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id as number);
      },
    },
    loss: loss.signal,
    work: {
      signal: workLoss.signal,
      get remainingMs() {
        return state.remaining;
      },
      commitMs: 2000,
      abortMs: 2000,
      endSessionMs: 2000,
      check() {},
    },
  };
  return {
    request,
    user,
    sessionRow,
    attempt,
    auth,
    state,
    events,
    session,
    ports,
    loss,
    workLoss,
    timers,
    create: () => createOutlineSessionFence(request, ports),
    advance(ms: number) {
      utc += ms;
      mono += ms;
      for (const t of [...timers.values()]) if (t.at <= mono) t.callback();
    },
    setUtc(n: number) {
      utc = n;
    },
    setMono(n: number) {
      mono = n;
    },
  };
}
const names = (h: ReturnType<typeof harness>) => h.events.map((e) => e.name);
const refused = async (h: ReturnType<typeof harness>) => {
  assert.deepEqual(await h.create().fence(), { kind: 'REFUSED' });
  assert.equal(
    names(h).some((x) => x.endsWith('.write')),
    false,
  );
  assert.equal(h.timers.size, 0);
};

test('MARK constructs exact projections, transaction predicates, ordered increments and a fresh precommit check', async () => {
  const h = harness(),
    f = h.create();
  assert.deepEqual(await f.fence(), { kind: 'FENCED' });
  assert.deepEqual(names(h), [
    'verify',
    'user.read',
    'session.read',
    'attempt.read',
    'user.write',
    'session.write',
  ]);
  const u = h.events.find((e) => e.name === 'user.write')!,
    s = h.events.find((e) => e.name === 'session.write')!;
  assert.deepEqual(u.filter, {
    _id: oid(actor),
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerifiedAt: h.user.emailVerifiedAt,
    __v: 7,
  });
  assert.deepEqual(s.filter, {
    _id: oid(sid),
    userId: oid(actor),
    revokedAt: null,
    expiresAt: { $eq: h.sessionRow.expiresAt, $gt: new Date(now) },
    __v: 3,
  });
  for (const e of h.events.filter((e) => e.options)) {
    assert.equal((e.options as { session: unknown }).session, h.session);
    assert.equal(
      (e.options as { maxTimeMS: number }).maxTimeMS,
      e.name.endsWith('.read') ? 5000 : 10000,
    );
    if (e.name.endsWith('.write')) {
      assert.deepEqual(e.update, { $inc: { __v: 1 } });
      assert.equal((e.options as { upsert: boolean }).upsert, false);
    }
  }
  assert.deepEqual(
    (h.events[1]!.options as { projection: unknown }).projection,
    { _id: 1, role: 1, status: 1, emailVerifiedAt: 1, __v: 1 },
  );
  assert.deepEqual(
    (h.events[2]!.options as { projection: unknown }).projection,
    { _id: 1, userId: 1, revokedAt: 1, expiresAt: 1, __v: 1 },
  );
  assert.deepEqual(h.events[3]!.filter, {
    _id: oid(attemptId),
    actorId: oid(actor),
    sessionId: oid(sid),
    bindingDigest: digest,
    version: 0,
    phase: 'PREPARED',
    cancelledAt: null,
  });
  assert.deepEqual(await f.beforeCommit(), { kind: 'PRECOMMIT_CHECKED' });
  assert.equal(names(h).filter((n) => n === 'verify').length, 2);
  assert.equal(h.timers.size, 0);
});
test('CAPTURE requires exact invocation and null completion/receipt without writing the attempt', async () => {
  const h = harness('CAPTURE');
  assert.deepEqual(await h.create().fence(), { kind: 'FENCED' });
  assert.equal(h.events.filter((e) => e.name === 'attempt.read').length, 1);
  assert.equal(
    h.events.some((e) => e.name === 'attempt.write'),
    false,
  );
});
test('READ uses a freshly verified requesting session, retains origin binding, reads cancellation and never writes', async () => {
  const h = harness('READ');
  h.request.requestingSessionId = other;
  h.auth.sid = other;
  h.sessionRow._id = oid(other);
  h.attempt.cancelledAt = new Date(now);
  const f = h.create();
  assert.deepEqual(await f.read(), { kind: 'CHECKED' });
  assert.equal(
    names(h).some((n) => n.endsWith('.write')),
    false,
  );
  assert.deepEqual(h.events[3]!.filter, {
    _id: oid(attemptId),
    actorId: oid(actor),
    sessionId: oid(sid),
    bindingDigest: digest,
    version: 0,
    phase: 'PREPARED',
  });
  assert.deepEqual(await f.fence(), { kind: 'REFUSED' });
});
for (const mode of ['MARK', 'CAPTURE'] as const)
  test(`${mode} refuses a replacement requesting sid`, async () => {
    const h = harness(mode);
    h.request.requestingSessionId = other;
    await refused(h);
  });
for (const [key, value] of [
  ['sub', other],
  ['sid', other],
  ['role', 'STUDENT'],
  ['plan', 'OTHER'],
] as const)
  test(`credential ${key} mismatch refuses`, async () => {
    const h = harness();
    h.auth[key] = value;
    await refused(h);
  });
for (const [key, value] of [
  ['_id', oid(other)],
  ['role', 'STUDENT'],
  ['status', 'DISABLED'],
  ['status', 'SUSPENDED'],
  ['emailVerifiedAt', null],
  ['emailVerifiedAt', '2026-11-08'],
] as const)
  test(`User ${key} malformed/ineligible refuses: ${String(value)}`, async () => {
    const h = harness();
    h.user[key] = value;
    await refused(h);
  });
for (const value of [
  undefined,
  null,
  -1,
  0.5,
  '1',
  Number.MAX_SAFE_INTEGER,
  Infinity,
  NaN,
])
  for (const which of ['user', 'sessionRow'] as const)
    test(`${which} invalid version ${String(value)} refuses without initialization`, async () => {
      const h = harness();
      h[which].__v = value;
      await refused(h);
    });
test('zero versions are existing valid versions with headroom', async () => {
  const h = harness();
  h.user.__v = 0;
  h.sessionRow.__v = 0;
  assert.deepEqual(await h.create().fence(), { kind: 'FENCED' });
});
for (const [key, value] of [
  ['_id', oid(other)],
  ['userId', oid(other)],
  ['revokedAt', new Date(now)],
  ['revokedAt', undefined],
  ['expiresAt', new Date(now)],
  ['expiresAt', new Date(now - 1)],
  ['expiresAt', '2026-11-09'],
] as const)
  test(`Session ${key} mismatch/revoked/expired refuses`, async () => {
    const h = harness();
    h.sessionRow[key] = value;
    await refused(h);
  });
for (const key of ['userMissing', 'sessionMissing', 'attemptMissing'] as const)
  test(`missing ${key} refuses`, async () => {
    const h = harness();
    h.state[key] = true;
    await refused(h);
  });
for (const [key, value] of [
  ['_id', oid(other)],
  ['actorId', oid(other)],
  ['sessionId', oid(other)],
  ['bindingDigest', 'b'.repeat(64)],
  ['version', 1],
  ['phase', 'INVOCATION_MARKED'],
  ['cancelledAt', new Date(now)],
  ['invocation', marker()],
  ['completion', {}],
  ['receipt', {}],
] as const)
  test(`MARK attempt ${key} mismatch refuses`, async () => {
    const h = harness();
    h.attempt[key] = value;
    await refused(h);
  });
for (const [key, value] of [
  ['invocation', null],
  ['completion', {}],
  ['receipt', {}],
  ['cancelledAt', new Date(now)],
] as const)
  test(`CAPTURE ${key} refuses`, async () => {
    const h = harness('CAPTURE');
    h.attempt[key] = value;
    await refused(h);
  });
for (const key of [
  'id',
  'ownerId',
  'claimVersion',
  'claimedAt',
  'observeUntil',
  'markedAt',
] as const)
  test(`CAPTURE exact marker ${key} binding refuses`, async () => {
    const h = harness('CAPTURE');
    const m = marker();
    const changed: Record<string, unknown> = { ...m };
    changed[key] =
      key === 'claimVersion'
        ? 2
        : key === 'id' || key === 'ownerId'
          ? '33333333-3333-4333-8333-333333333333'
          : new Date(now + 5);
    h.attempt.invocation = changed;
    await refused(h);
  });
for (const field of [
  'acknowledged',
  'matchedCount',
  'modifiedCount',
  'upsertedCount',
  'upsertedId',
] as const)
  for (const value of [undefined, false, 0, 2, '1'].filter(
    (value) => value !== ack()[field],
  ))
    test(`strict write ack ${field}=${String(value)}`, async () => {
      const h = harness();
      const a: Record<string, unknown> = ack();
      a[field] = value;
      h.state.userAck = a;
      assert.deepEqual(await h.create().fence(), { kind: 'OUTCOME_UNKNOWN' });
      assert.equal(names(h).includes('session.write'), false);
    });
for (const value of [
  null,
  {},
  { acknowledged: true },
  { ...ack(), secret: 'synthetic-private' },
  { ...ack(), matchedCount: { valueOf: () => 1 } },
])
  test('unknown/malformed ack never succeeds or leaks content', async () => {
    const h = harness();
    h.state.sessionAck = value;
    const result = await h.create().fence();
    assert.deepEqual(result, { kind: 'OUTCOME_UNKNOWN' });
    assert.equal(JSON.stringify(result).includes('synthetic-private'), false);
  });
for (const boundary of [
  'verify',
  'user.read',
  'session.read',
  'attempt.read',
  'user.write',
  'session.write',
])
  for (const signal of ['loss', 'workLoss'] as const)
    test(`${signal} at ${boundary} stops subsequent operations`, async () => {
      const h = harness();
      h.state.hook = async (name) => {
        if (name === boundary) h[signal].abort();
      };
      const f = h.create();
      assert.deepEqual(await f.fence(), {
        kind: boundary.endsWith('.write') ? 'OUTCOME_UNKNOWN' : 'REFUSED',
      });
      const seen = names(h);
      assert.equal(seen.at(-1), boundary);
      assert.equal(h.timers.size, 0);
      assert.deepEqual(await f.fence(), {
        kind: boundary.endsWith('.write') ? 'OUTCOME_UNKNOWN' : 'REFUSED',
      });
    });
for (const boundary of [
  'user.read',
  'attempt.read',
  'user.write',
  'session.write',
])
  test(`adapter error at ${boundary} is sanitized, no retry`, async () => {
    const h = harness();
    h.state.hook = async (name) => {
      if (name === boundary) throw new Error('synthetic-private');
    };
    const result = await h.create().fence();
    assert.deepEqual(result, {
      kind: boundary.endsWith('.write') ? 'OUTCOME_UNKNOWN' : 'REFUSED',
    });
    assert.equal(names(h).filter((n) => n === boundary).length, 1);
  });
for (const point of ['loss', 'expiry', 'credential', 'transaction'] as const)
  test(`precommit ${point} refuses after fences without claiming rollback`, async () => {
    const h = harness();
    const f = h.create();
    assert.deepEqual(await f.fence(), { kind: 'FENCED' });
    if (point === 'loss') h.loss.abort();
    if (point === 'expiry') h.advance(60000);
    if (point === 'credential') h.auth.role = 'STUDENT';
    if (point === 'transaction') h.state.active = false;
    assert.deepEqual(await f.beforeCommit(), { kind: 'OUTCOME_UNKNOWN' });
    assert.equal(names(h).filter((n) => n.endsWith('.write')).length, 2);
  });
test('observed demotion retires context despite supplied restoration; unseen restoration is not falsely detected', async () => {
  const h = harness();
  const f = h.create();
  h.user.role = 'STUDENT';
  assert.deepEqual(await f.fence(), { kind: 'REFUSED' });
  h.user.role = 'ADMIN';
  assert.deepEqual(await f.fence(), { kind: 'REFUSED' });
  assert.deepEqual(await h.create().fence(), { kind: 'FENCED' });
});
for (const effect of [
  'logout',
  'logout-all',
  'reuse',
  'reset',
  'other-session-password-change',
  'TTL-delete',
] as const)
  test(`supplied ${effect} revocation/absence refuses without relying on Session version increment`, async () => {
    const h = harness();
    if (effect === 'TTL-delete') h.state.sessionMissing = true;
    else h.sessionRow.revokedAt = new Date(now);
    assert.equal(h.sessionRow.__v, 3);
    await refused(h);
  });
for (const effect of [
  'same-sid-refresh',
  'retained-current-password-change',
  'profile-conflict',
] as const)
  test(`supplied ${effect} is not permanent deauthorization`, async () => {
    const h = harness();
    h.user.__v = 8;
    if (effect === 'retained-current-password-change') h.sessionRow.__v = 4;
    assert.deepEqual(await h.create().fence(), { kind: 'FENCED' });
  });
for (const missing of ['inactive', 'ended'] as const)
  test(`${missing} caller session refuses before adapter calls`, async () => {
    const h = harness();
    if (missing === 'inactive') h.state.active = false;
    else h.state.ended = true;
    await refused(h);
    assert.deepEqual(h.events, []);
  });
test('read-only projected check cannot replace the fence or precommit requirements', async () => {
  const h = harness();
  const f = h.create();
  assert.deepEqual(await f.read(), { kind: 'CHECKED' });
  assert.deepEqual(await f.beforeCommit(), { kind: 'REFUSED' });
  assert.equal(
    names(h).some((n) => n.endsWith('.write')),
    false,
  );
});
test('request input is snapshotted without mutating it or exposing private records', async () => {
  const h = harness('CAPTURE');
  const before = JSON.stringify(h.request);
  const f = h.create();
  h.request.actorId = other;
  assert.deepEqual(await f.fence(), { kind: 'FENCED' });
  assert.equal(JSON.stringify({ ...h.request, actorId: actor }), before);
});
test('unknown/operator fields, getters and malformed native identities refuse without coercion', async () => {
  for (const change of [
    (r: Record<string, unknown>) => {
      r.$where = 'synthetic';
    },
    (r: Record<string, unknown>) => {
      Object.defineProperty(r, 'actorId', {
        enumerable: true,
        get() {
          assert.fail('getter invoked');
        },
      });
    },
    (r: Record<string, unknown>) => {
      r.actorId = oid(actor);
    },
  ]) {
    const h = harness();
    change(h.request);
    await refused(h);
  }
  const h = harness();
  h.user._id = actor;
  await refused(h);
});
test('authorization timeout is bounded at 5000ms; late verifier cannot resume work', async () => {
  const h = harness();
  let release!: () => void;
  h.state.hook = async (name) => {
    if (name === 'verify')
      await new Promise<void>((resolve) => {
        release = resolve;
      });
  };
  const pending = h.create().fence();
  await Promise.resolve();
  await Promise.resolve();
  h.advance(5000);
  assert.deepEqual(await pending, { kind: 'REFUSED' });
  release();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(names(h), ['verify']);
  assert.equal(h.timers.size, 0);
});
test('in-flight write timeout remains unknown; late ack causes no Session write or replay', async () => {
  const h = harness();
  let arrived!: () => void, release!: () => void;
  const reached = new Promise<void>((r) => {
    arrived = r;
  });
  h.state.hook = async (name) => {
    if (name === 'user.write') {
      arrived();
      await new Promise<void>((r) => {
        release = r;
      });
    }
  };
  const f = h.create(),
    pending = f.fence();
  await reached;
  h.advance(10000);
  assert.deepEqual(await pending, { kind: 'OUTCOME_UNKNOWN' });
  release();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(names(h).includes('session.write'), false);
  assert.deepEqual(await f.fence(), { kind: 'OUTCOME_UNKNOWN' });
  assert.equal(h.timers.size, 0);
});
test('fresh Session predicate uses time after User write and refuses expiry between operations', async () => {
  const h = harness();
  h.state.hook = async (name) => {
    if (name === 'user.write') h.advance(20);
  };
  assert.deepEqual(await h.create().fence(), { kind: 'FENCED' });
  assert.deepEqual(
    (
      h.events.find((e) => e.name === 'session.write')!.filter!.expiresAt as {
        $gt: Date;
      }
    ).$gt,
    new Date(now + 20),
  );
});

test('expiry after User write prevents Session write and preserves uncertainty', async () => {
  const h = harness();
  h.sessionRow.expiresAt = new Date(now + 10);
  h.state.hook = async (name) => {
    if (name === 'user.write') h.advance(10);
  };
  assert.deepEqual(await h.create().fence(), { kind: 'OUTCOME_UNKNOWN' });
  assert.equal(names(h).includes('session.write'), false);
});
test('all authorization reads share one five-second window rather than resetting per read', async () => {
  const h = harness();
  h.state.hook = async (name) => {
    if (name === 'verify' || name === 'user.read') h.advance(2500);
  };
  await refused(h);
  assert.deepEqual(names(h), ['verify', 'user.read']);
  assert.equal((h.events[1]!.options as { maxTimeMS: number }).maxTimeMS, 2500);
});
test('maximum safe increment input is accepted, overflow is never repaired', async () => {
  const h = harness();
  h.user.__v = Number.MAX_SAFE_INTEGER - 1;
  h.sessionRow.__v = Number.MAX_SAFE_INTEGER - 1;
  assert.deepEqual(await h.create().fence(), { kind: 'FENCED' });
  assert.equal(
    h.events.find((e) => e.name === 'user.write')!.filter!.__v,
    Number.MAX_SAFE_INTEGER - 1,
  );
});
test('missing session object or missing ended flag refuses before any adapter operation', async () => {
  for (const value of [undefined, null, { inTransaction: () => true }]) {
    const h = harness();
    const ports = {
      ...h.ports,
      session: value,
    } as unknown as OutlineFencePorts;
    assert.deepEqual(
      await createOutlineSessionFence(h.request, ports).fence(),
      { kind: 'REFUSED' },
    );
    assert.deepEqual(h.events, []);
  }
});
test('simultaneous operations retire the retained context and cannot cause duplicate writes', async () => {
  const h = harness();
  let arrived!: () => void, release!: () => void;
  const reached = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  h.state.hook = async (name) => {
    if (name === 'verify') {
      arrived();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
  };
  const f = h.create(),
    pending = f.fence();
  await reached;
  assert.deepEqual(await f.fence(), { kind: 'REFUSED' });
  release();
  assert.deepEqual(await pending, { kind: 'REFUSED' });
  assert.equal(
    names(h).some((n) => n.endsWith('.write')),
    false,
  );
});
test('positive read result is suppressed if loss arrives in a final async continuation', async () => {
  const h = harness('READ');
  let checks = 0;
  h.ports.work.check = () => {
    if (names(h).at(-1) === 'attempt.read' && ++checks === 4) h.loss.abort();
  };
  assert.deepEqual(await h.create().read(), { kind: 'REFUSED' });
});
test('request and projected records are not changed by the fence', async () => {
  const h = harness('CAPTURE');
  const before = JSON.stringify([h.request, h.user, h.sessionRow, h.attempt]);
  assert.deepEqual(await h.create().fence(), { kind: 'FENCED' });
  assert.equal(
    JSON.stringify([h.request, h.user, h.sessionRow, h.attempt]),
    before,
  );
});
for (const clock of [
  'backwardUtc',
  'backwardMono',
  'nan',
  'coercion',
  'remaining',
] as const)
  test(`unsafe clock/work ${clock} refuses`, async () => {
    const h = harness();
    h.state.hook = async (name) => {
      if (name === 'verify') {
        if (clock === 'backwardUtc') h.setUtc(now - 1);
        if (clock === 'backwardMono') h.setMono(-1);
        if (clock === 'nan') h.setMono(NaN);
        if (clock === 'coercion')
          h.ports.clock.now = () => '0' as unknown as number;
        if (clock === 'remaining') h.state.remaining = 10001;
      }
    };
    await refused(h);
  });
test('inert import registers no models or connections and source contains no transaction owner, native attempt writer or production composition', async () => {
  const models = mongoose.modelNames().slice(),
    state = mongoose.connection.readyState;
  await import('../src/modules/ai/curriculum-outline-session-fence.js');
  assert.deepEqual(mongoose.modelNames(), models);
  assert.equal(mongoose.connection.readyState, state);
  const source = fs.readFileSync(
    new URL(
      '../src/modules/ai/curriculum-outline-session-fence.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\.(?:connect|createConnection|startSession|startTransaction|commitTransaction|abortTransaction|endSession|insertOne|deleteOne)\s*\(/,
  );
  assert.doesNotMatch(source, /attempts\.updateOne|process\.env|Date\.now\(/);
});

function cancelHarness(
  phase: 'PREPARED' | 'INVOCATION_MARKED' | 'COMPLETION_STORED' = 'PREPARED',
) {
  const h = harness('CANCEL');
  h.request.requestingSessionId = other;
  h.auth.sid = other;
  h.sessionRow._id = oid(other);
  h.request.phase = h.attempt.phase = phase;
  h.request.expectedVersion =
    phase === 'PREPARED' ? 0 : phase === 'INVOCATION_MARKED' ? 1 : 2;
  h.attempt.version = h.request.expectedVersion;
  h.request.invocation = phase === 'PREPARED' ? null : marker();
  h.attempt.invocation = h.request.invocation;
  h.attempt.completion =
    phase === 'COMPLETION_STORED'
      ? { schemaVersion: 1, createdAt: new Date(now), checkpointDigest: digest }
      : null;
  return h;
}

test('PREPARE checks genuine absence by allocated ID alone, then fences the original session without inventing an attempt', async () => {
  const h = harness('PREPARE');
  const before = JSON.stringify([h.request, h.attempt]);
  const f = h.create();
  assert.deepEqual(await f.fence(), { kind: 'FENCED' });
  const read = h.events.find((e) => e.name === 'attempt.read')!;
  assert.deepEqual(read.filter, { _id: oid(attemptId) });
  assert.deepEqual((read.options as { projection: unknown }).projection, {
    _id: 1,
  });
  assert.deepEqual(names(h), [
    'verify',
    'user.read',
    'session.read',
    'attempt.read',
    'user.write',
    'session.write',
  ]);
  assert.deepEqual(h.events.find((e) => e.name === 'session.write')!.filter, {
    _id: oid(sid),
    userId: oid(actor),
    revokedAt: null,
    expiresAt: { $eq: h.sessionRow.expiresAt, $gt: new Date(now) },
    __v: 3,
  });
  assert.deepEqual(await f.beforeCommit(), { kind: 'PRECOMMIT_CHECKED' });
  assert.equal(JSON.stringify([h.request, h.attempt]), before);
  assert.equal(names(h).filter((n) => n === 'attempt.read').length, 1);
  for (const e of h.events.filter((e) => e.options))
    assert.equal((e.options as { session: unknown }).session, h.session);
});

for (const existing of [true, { actorId: oid(other) }, {}, undefined])
  test('PREPARE refuses any existing or ambiguous target without authorizing fences', async () => {
    const h = harness('PREPARE');
    h.ports.attempts.findOne = async (filter, options) => {
      h.events.push({ name: 'attempt.read', filter, options });
      return existing;
    };
    await refused(h);
    assert.deepEqual(h.events.at(-1)!.filter, { _id: oid(attemptId) });
  });

test('PREPARE existing row cannot be hidden by a different actor or digest', async () => {
  const h = harness('PREPARE');
  h.state.attemptMissing = false;
  h.attempt.actorId = oid(other);
  h.attempt.bindingDigest = 'b'.repeat(64);
  Object.defineProperty(h.attempt, 'completion', {
    get() {
      assert.fail('private cell selected');
    },
  });
  await refused(h);
});

for (const [key, value] of [
  ['requestingSessionId', other],
  ['expectedVersion', 1],
  ['phase', 'INVOCATION_MARKED'],
  ['invocation', marker()],
] as const)
  test(`PREPARE invalid initial ${key} refuses before reads`, async () => {
    const h = harness('PREPARE');
    (h.request as Record<string, unknown>)[key] = value;
    await refused(h);
    assert.deepEqual(h.events, []);
  });

for (const phase of [
  'PREPARED',
  'INVOCATION_MARKED',
  'COMPLETION_STORED',
] as const)
  test(`CANCEL ${phase} uses fresh requesting sid and exact metadata, preserving existing evidence`, async () => {
    const h = cancelHarness(phase);
    const before = JSON.stringify([h.request, h.attempt]);
    const f = h.create();
    assert.deepEqual(await f.fence(), { kind: 'FENCED' });
    assert.deepEqual(h.events.find((e) => e.name === 'session.read')!.filter, {
      _id: oid(other),
      userId: oid(actor),
    });
    assert.deepEqual(h.events.find((e) => e.name === 'session.write')!.filter, {
      _id: oid(other),
      userId: oid(actor),
      revokedAt: null,
      expiresAt: { $eq: h.sessionRow.expiresAt, $gt: new Date(now) },
      __v: 3,
    });
    const read = h.events.find((e) => e.name === 'attempt.read')!;
    assert.deepEqual(read.filter, {
      _id: oid(attemptId),
      actorId: oid(actor),
      sessionId: oid(sid),
      bindingDigest: digest,
      version: h.request.expectedVersion,
      phase,
      cancelledAt: null,
    });
    assert.deepEqual((read.options as { projection: unknown }).projection, {
      _id: 1,
      actorId: 1,
      sessionId: 1,
      bindingDigest: 1,
      version: 1,
      phase: 1,
      cancelledAt: 1,
      invocation: 1,
      receipt: 1,
      'completion.schemaVersion': 1,
      'completion.createdAt': 1,
      'completion.checkpointDigest': 1,
    });
    assert.deepEqual(
      names(h).filter((n) => n.endsWith('.write')),
      ['user.write', 'session.write'],
    );
    for (const e of h.events.filter((e) => e.options)) {
      assert.equal((e.options as { session: unknown }).session, h.session);
      if (e.name.endsWith('.write'))
        assert.deepEqual(e.update, { $inc: { __v: 1 } });
    }
    assert.deepEqual(await f.beforeCommit(), { kind: 'PRECOMMIT_CHECKED' });
    assert.equal(JSON.stringify([h.request, h.attempt]), before);
    assert.equal(h.timers.size, 0);
  });

test('CANCEL after completion never selects rawOutput or requires intact raw content', async () => {
  const h = cancelHarness('COMPLETION_STORED');
  assert.ok(h.attempt.completion && typeof h.attempt.completion === 'object');
  Object.defineProperty(h.attempt.completion, 'rawOutput', {
    enumerable: true,
    get() {
      assert.fail('raw payload accessed');
    },
  });
  assert.deepEqual(await h.create().fence(), { kind: 'FENCED' });
  const p = (
    h.events.find((e) => e.name === 'attempt.read')!.options as {
      projection: Record<string, 1>;
    }
  ).projection;
  assert.equal(Object.hasOwn(p, 'completion'), false);
  assert.equal(
    Object.keys(p).some((key) => key.includes('rawOutput')),
    false,
  );
});

for (const phase of ['ADMITTED', 'REFUSED', 'UNKNOWN'])
  test(`CANCEL terminal/unknown request ${phase} refuses before any operation`, async () => {
    const h = cancelHarness();
    h.request.phase = phase;
    await refused(h);
    assert.deepEqual(h.events, []);
  });

for (const phase of [
  'PREPARED',
  'INVOCATION_MARKED',
  'COMPLETION_STORED',
] as const)
  for (const value of [
    undefined,
    null,
    -1,
    0.5,
    '1',
    Number.MAX_SAFE_INTEGER,
    3,
  ])
    test(`CANCEL ${phase} invalid version ${String(value)} refuses`, async () => {
      const h = cancelHarness(phase);
      (h.request as Record<string, unknown>).expectedVersion = value;
      await refused(h);
      assert.deepEqual(h.events, []);
    });

for (const [key, value] of [
  ['_id', oid(other)],
  ['actorId', oid(other)],
  ['sessionId', oid(other)],
  ['bindingDigest', 'b'.repeat(64)],
  ['version', 1],
  ['phase', 'INVOCATION_MARKED'],
  ['cancelledAt', new Date(now)],
  ['cancelledAt', undefined],
  ['receipt', {}],
  ['receipt', undefined],
  ['completion', undefined],
  ['invocation', undefined],
  ['invocation', marker()],
  ['completion', {}],
] as const)
  test(`CANCEL malformed/mismatched ${key} refuses without writes`, async () => {
    const h = cancelHarness();
    h.attempt[key] = value;
    await refused(h);
  });

for (const phase of ['INVOCATION_MARKED', 'COMPLETION_STORED'] as const)
  for (const key of [
    'id',
    'ownerId',
    'claimVersion',
    'claimedAt',
    'observeUntil',
    'markedAt',
  ] as const)
    test(`CANCEL ${phase} exact invocation ${key} mismatch refuses`, async () => {
      const h = cancelHarness(phase);
      const changed: Record<string, unknown> = { ...marker() };
      changed[key] =
        key === 'claimVersion'
          ? 2
          : key === 'id' || key === 'ownerId'
            ? '33333333-3333-4333-8333-333333333333'
            : new Date(now + 1);
      h.attempt.invocation = changed;
      await refused(h);
    });

for (const [key, value] of [
  ['schemaVersion', 2],
  ['schemaVersion', '1'],
  ['schemaVersion', undefined],
  ['createdAt', '2026-11-08'],
  ['createdAt', null],
  ['createdAt', undefined],
  ['checkpointDigest', 'private-invalid'],
  ['checkpointDigest', undefined],
] as const)
  test(`CANCEL completion metadata ${key} invalid refuses safely`, async () => {
    const h = cancelHarness('COMPLETION_STORED');
    (h.attempt.completion as Record<string, unknown>)[key] = value;
    await refused(h);
  });

for (const value of [null, undefined, [], 'synthetic-private', 1])
  test('CANCEL COMPLETION_STORED requires a present metadata object, not raw payload validation', async () => {
    const h = cancelHarness('COMPLETION_STORED');
    h.attempt.completion = value;
    await refused(h);
  });

for (const mode of ['PREPARE', 'CANCEL'] as const) {
  const setup = () =>
    mode === 'PREPARE' ? harness(mode) : cancelHarness('COMPLETION_STORED');
  for (const which of ['user', 'sessionRow'] as const)
    for (const value of [
      undefined,
      null,
      -1,
      0.5,
      '1',
      Number.MAX_SAFE_INTEGER,
    ])
      test(`${mode} ${which} strict version ${String(value)} refuses`, async () => {
        const h = setup();
        h[which].__v = value;
        await refused(h);
      });
  for (const [key, value] of [
    ['sub', other],
    ['sid', sid],
    ['role', 'STUDENT'],
    ['plan', 'OTHER'],
  ] as const)
    test(`${mode} current credential ${key} mismatch refuses`, async () => {
      const h = setup();
      h.auth[key] = key === 'sid' && mode === 'PREPARE' ? other : value;
      await refused(h);
    });
  for (const condition of [
    'inactive',
    'ended',
    'revoked',
    'expired',
    'wrongActor',
    'wrongSession',
    'missingUser',
    'missingSession',
    'demoted',
  ] as const)
    test(`${mode} ${condition} refuses without Session revival`, async () => {
      const h = setup();
      if (condition === 'inactive') h.state.active = false;
      if (condition === 'ended') h.state.ended = true;
      if (condition === 'revoked') h.sessionRow.revokedAt = new Date(now);
      if (condition === 'expired') h.sessionRow.expiresAt = new Date(now);
      if (condition === 'wrongActor') h.sessionRow.userId = oid(other);
      if (condition === 'wrongSession') h.sessionRow._id = oid(attemptId);
      if (condition === 'missingUser') h.state.userMissing = true;
      if (condition === 'missingSession') h.state.sessionMissing = true;
      if (condition === 'demoted') h.user.role = 'STUDENT';
      await refused(h);
    });
  for (const which of ['userAck', 'sessionAck'] as const)
    for (const field of [
      'acknowledged',
      'matchedCount',
      'modifiedCount',
      'upsertedCount',
      'upsertedId',
    ] as const)
      test(`${mode} ${which} ${field} failed ACK remains unknown`, async () => {
        const h = setup();
        h.state[which] = { ...ack(), [field]: undefined };
        assert.deepEqual(await h.create().fence(), { kind: 'OUTCOME_UNKNOWN' });
        if (which === 'userAck')
          assert.equal(names(h).includes('session.write'), false);
      });
  for (const boundary of [
    'verify',
    'user.read',
    'session.read',
    'attempt.read',
    'user.write',
    'session.write',
  ])
    for (const signal of ['loss', 'workLoss', 'expiry'] as const)
      test(`${mode} ${signal} at ${boundary} stops subsequent work and late success`, async () => {
        const h = setup();
        h.state.hook = async (name) => {
          if (name === boundary) {
            if (signal === 'expiry') h.advance(10000);
            else h[signal].abort();
          }
        };
        const f = h.create();
        const expected = {
          kind: boundary.endsWith('.write') ? 'OUTCOME_UNKNOWN' : 'REFUSED',
        };
        assert.deepEqual(await f.fence(), expected);
        assert.equal(names(h).at(-1), boundary);
        assert.deepEqual(await f.fence(), expected);
        assert.equal(h.timers.size, 0);
      });
  test(`${mode} precommit reverifies requesting identity and cannot be reused`, async () => {
    const h = setup(),
      f = h.create();
    assert.deepEqual(await f.fence(), { kind: 'FENCED' });
    h.auth.sid = attemptId;
    assert.deepEqual(await f.beforeCommit(), { kind: 'OUTCOME_UNKNOWN' });
    assert.equal(names(h).filter((n) => n.endsWith('.write')).length, 2);
  });
  test(`${mode} final return suppresses loss after positive operation continuation`, async () => {
    const h = setup();
    let checks = 0;
    h.ports.work.check = () => {
      if (names(h).at(-1) === 'session.write' && ++checks === 3) h.loss.abort();
    };
    assert.deepEqual(await h.create().fence(), { kind: 'OUTCOME_UNKNOWN' });
  });
  for (const boundary of ['attempt.read', 'user.write'] as const)
    test(`${mode} delayed ${boundary} cannot resume after deadline or create an ACK`, async () => {
      const h = setup();
      let arrived!: () => void, release!: () => void;
      const reached = new Promise<void>((resolve) => {
        arrived = resolve;
      });
      h.state.hook = async (name) => {
        if (name === boundary) {
          arrived();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      };
      const f = h.create(),
        pending = f.fence();
      await reached;
      h.advance(boundary === 'attempt.read' ? 5000 : 10000);
      const expected = {
        kind: boundary === 'user.write' ? 'OUTCOME_UNKNOWN' : 'REFUSED',
      };
      assert.deepEqual(await pending, expected);
      const count = h.events.length;
      release();
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(h.events.length, count);
      assert.equal(names(h).includes('session.write'), false);
      assert.deepEqual(await f.beforeCommit(), expected);
      assert.deepEqual(await f.fence(), expected);
      assert.equal(h.timers.size, 0);
    });
  for (const point of [
    'loss',
    'expiry',
    'revocation-observed',
    'final-continuation',
  ] as const)
    test(`${mode} precommit ${point} preserves unknown after fences`, async () => {
      const h = setup(),
        f = h.create();
      assert.deepEqual(await f.fence(), { kind: 'FENCED' });
      if (point === 'loss') h.loss.abort();
      if (point === 'expiry') h.advance(60000);
      if (point === 'revocation-observed')
        h.ports.verify = async () => {
          throw new Error('synthetic-private');
        };
      if (point === 'final-continuation') {
        let checks = 0;
        h.ports.work.check = () => {
          if (names(h).at(-1) === 'verify' && ++checks === 3) h.loss.abort();
        };
      }
      assert.deepEqual(await f.beforeCommit(), { kind: 'OUTCOME_UNKNOWN' });
      assert.equal(names(h).filter((n) => n.endsWith('.write')).length, 2);
      assert.equal(h.timers.size, 0);
    });
}

test('CANCEL observed sticky cancellation cannot be cleared to reuse the retained context', async () => {
  const h = cancelHarness('COMPLETION_STORED'),
    f = h.create();
  h.attempt.cancelledAt = new Date(now);
  assert.deepEqual(await f.fence(), { kind: 'REFUSED' });
  h.attempt.cancelledAt = null;
  assert.deepEqual(await f.fence(), { kind: 'REFUSED' });
  assert.equal(
    names(h).some((name) => name.endsWith('.write')),
    false,
  );
});

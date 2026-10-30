import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { AppError } from '../src/common/errors/app-error.js';
import { mongoose } from '../src/config/database.js';
import type { AuthContext } from '../src/modules/auth/access-token.service.js';
import {
  adminAccessRepository,
  adminReadBudgetMs,
  type AdminRead,
} from '../src/modules/admin/admin-access.repository.js';
import { createAdminAccessService } from '../src/modules/admin/admin-access.service.js';
import {
  adminLimitDefaults,
  createAdminLimitStore,
  createAdminRateLimits,
} from '../src/modules/admin/admin-rate-limit.js';

const id = 'a'.repeat(24);
const actor: AuthContext = {
  sub: id,
  sid: 'b'.repeat(24),
  role: 'ADMIN',
  plan: 'FREE',
};
const eligible = () => ({
  _id: new Types.ObjectId(id),
  role: 'ADMIN',
  status: 'ACTIVE',
  emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
});
const fails = (status: number, code: string) => (error: unknown) => {
  assert(error instanceof AppError);
  assert.equal(error.statusCode, status);
  assert.equal(error.code, code);
  assert.equal(error.details, undefined);
  assert(!error.message.includes('private'));
  return true;
};

test('current verified Admin receives no account DTO and repository gets only JWT subject and bounded options', async () => {
  const row = eligible();
  const before = JSON.stringify(row);
  let read: AdminRead | undefined;
  const service = createAdminAccessService({
    async read(userId, options) {
      assert.equal(userId, id);
      assert(options.timeoutMS > 0 && options.timeoutMS <= 5000);
      assert.equal(options.signal.aborted, false);
      read = options;
      return row;
    },
  });
  assert.equal(await service.authorize(actor), undefined);
  assert.equal(JSON.stringify(row), before);
  assert.equal(read?.signal.aborted, true);
});

for (const plan of ['FREE', 'PREMIUM'] as const)
  test(`Admin eligibility is independent of ${plan} plan`, async () => {
    await createAdminAccessService({ read: async () => eligible() }).authorize({
      ...actor,
      plan,
    });
  });

test('missing actor refuses before repository access', async () => {
  let calls = 0;
  await assert.rejects(
    createAdminAccessService({
      read: async () => {
        calls++;
        return eligible();
      },
    }).authorize(undefined),
    fails(401, 'AUTH_ACCESS_TOKEN_MISSING'),
  );
  assert.equal(calls, 0);
});
test('promotion cannot grant access with an old Student JWT', async () => {
  let calls = 0;
  await assert.rejects(
    createAdminAccessService({
      read: async () => {
        calls++;
        return eligible();
      },
    }).authorize({ ...actor, role: 'STUDENT' }),
    fails(403, 'AUTH_FORBIDDEN'),
  );
  assert.equal(calls, 0);
});

for (const [name, row] of [
  ['deleted account', null],
  ['demoted account', { ...eligible(), role: 'STUDENT' }],
  ['disabled account', { ...eligible(), status: 'DISABLED' }],
  ['suspended account', { ...eligible(), status: 'SUSPENDED' }],
  ['pending verification', { ...eligible(), status: 'PENDING_VERIFICATION' }],
  ['null verification', { ...eligible(), emailVerifiedAt: null }],
  [
    'absent verification',
    { _id: new Types.ObjectId(id), role: 'ADMIN', status: 'ACTIVE' },
  ],
] as const)
  test(`${name} is generic forbidden`, async () => {
    await assert.rejects(
      createAdminAccessService({ read: async () => row }).authorize(actor),
      fails(403, 'AUTH_FORBIDDEN'),
    );
  });

for (const [name, row] of [
  ['unknown result', undefined],
  ['invalid role', { ...eligible(), role: 'SUPERADMIN' }],
  ['invalid status', { ...eligible(), status: 'UNKNOWN' }],
  [
    'invalid verification date',
    { ...eligible(), emailVerifiedAt: new Date(NaN) },
  ],
  [
    'string verification date',
    { ...eligible(), emailVerifiedAt: '2026-01-01' },
  ],
  [
    'mismatched identity',
    { ...eligible(), _id: new Types.ObjectId('c'.repeat(24)) },
  ],
  ['string identity', { ...eligible(), _id: id }],
  [
    'unexpected private fields',
    { ...eligible(), passwordHash: 'private fixture field' },
  ],
] as const)
  test(`${name} is uncertainty, never authorization`, async () => {
    await assert.rejects(
      createAdminAccessService({ read: async () => row }).authorize(actor),
      fails(503, 'DEPENDENCY_UNAVAILABLE'),
    );
  });

for (const failure of [
  new Error('private Mongo failure'),
  new AppError(403, 'AUTH_FORBIDDEN', 'private driver error'),
  new AppError(401, 'AUTH_ACCESS_TOKEN_INVALID', 'private adapter error'),
])
  test(`repository ${failure.name}/${'code' in failure ? failure.code : 'unknown'} is sanitized dependency failure`, async () => {
    await assert.rejects(
      createAdminAccessService({
        read: async () => {
          throw failure;
        },
      }).authorize(actor),
      fails(503, 'DEPENDENCY_UNAVAILABLE'),
    );
  });

for (const elapsed of [5000, 5001, Infinity, NaN, -1])
  test(`late/invalid clock result ${elapsed} cannot authorize`, async () => {
    let now = 0;
    const service = createAdminAccessService(
      {
        read: async () => {
          now = elapsed;
          return eligible();
        },
      },
      () => now,
    );
    await assert.rejects(
      service.authorize(actor),
      fails(503, 'DEPENDENCY_UNAVAILABLE'),
    );
  });

test('five-second timer is terminal even when the repository ignores abort and later resolves', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let complete: (row: unknown) => void = () => {};
  let read: AdminRead | undefined;
  let authorized = false;
  const service = createAdminAccessService({
    read: (_id, options) => {
      read = options;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  const pending = service.authorize(actor).then(() => {
    authorized = true;
  });
  const refused = assert.rejects(pending, fails(503, 'DEPENDENCY_UNAVAILABLE'));
  await Promise.resolve();
  t.mock.timers.tick(4999);
  assert.equal(read?.signal.aborted, false);
  t.mock.timers.tick(1);
  await refused;
  assert.equal(read?.signal.aborted, true);
  complete(eligible());
  await Promise.resolve();
  assert.equal(authorized, false);
});

test('caller cancellation is terminal and releases listeners even if the read later rejects', async () => {
  const signal = new AbortController();
  let reject: (reason: Error) => void = () => {};
  let options: AdminRead | undefined;
  const pending = createAdminAccessService({
    read: (_id, read) => {
      options = read;
      return new Promise((_resolve, fail) => {
        reject = fail;
      });
    },
  }).authorize(actor, signal.signal);
  const refused = assert.rejects(pending, fails(503, 'DEPENDENCY_UNAVAILABLE'));
  await Promise.resolve();
  signal.abort();
  await refused;
  assert.equal(options?.signal.aborted, true);
  reject(new Error('private late failure'));
  await Promise.resolve();
});
test('already cancelled authorization never reads', async () => {
  let calls = 0;
  await assert.rejects(
    createAdminAccessService({
      read: async () => {
        calls++;
        return eligible();
      },
    }).authorize(actor, AbortSignal.abort()),
    fails(503, 'DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(calls, 0);
});
test('each concurrent request performs an independent current-eligibility read', async () => {
  let calls = 0;
  const service = createAdminAccessService({
    read: async () => {
      const ordinal = calls++;
      await Promise.resolve();
      return ordinal % 2 ? { ...eligible(), role: 'STUDENT' } : eligible();
    },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => service.authorize(actor)),
  );
  assert.equal(calls, 12);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 6);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 6);
});

test('native repository refuses disconnected storage without buffering or connecting', async () => {
  assert.equal(mongoose.connection.readyState, 0);
  await assert.rejects(
    adminAccessRepository.read(id, {
      timeoutMS: 5000,
      signal: new AbortController().signal,
    }),
    fails(503, 'DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(mongoose.connection.readyState, 0);
});
test('native repository uses only approved projection, primary, deadline and cancellation', async (t) => {
  const connection = mongoose.connection;
  const oldDb = Object.getOwnPropertyDescriptor(connection, 'db');
  const oldState = Object.getOwnPropertyDescriptor(connection, 'readyState');
  let calls = 0;
  const signal = new AbortController().signal;
  const db = {
    collection(name: string) {
      assert.equal(name, 'users');
      return {
        async findOne(filter: unknown, options: unknown) {
          calls++;
          assert.deepEqual(filter, { _id: new Types.ObjectId(id) });
          assert.deepEqual(options, {
            projection: { _id: 1, role: 1, status: 1, emailVerifiedAt: 1 },
            readPreference: 'primary',
            timeoutMS: 4321,
            maxTimeMS: 4321,
            signal,
          });
          return eligible();
        },
      };
    },
  };
  Object.defineProperty(connection, 'readyState', {
    configurable: true,
    get: () => 1,
  });
  Object.defineProperty(connection, 'db', {
    configurable: true,
    get: () => db,
  });
  t.after(() => {
    if (oldDb) Object.defineProperty(connection, 'db', oldDb);
    else Reflect.deleteProperty(connection, 'db');
    if (oldState) Object.defineProperty(connection, 'readyState', oldState);
    else Reflect.deleteProperty(connection, 'readyState');
  });
  assert.deepEqual(
    await adminAccessRepository.read(id, { timeoutMS: 4321, signal }),
    eligible(),
  );
  assert.equal(calls, 1);
  for (const timeoutMS of [0, -1, 5001, NaN, 1.5])
    await assert.rejects(
      adminAccessRepository.read(id, { timeoutMS, signal }),
      fails(503, 'DEPENDENCY_UNAVAILABLE'),
    );
  await assert.rejects(
    adminAccessRepository.read(id, {
      timeoutMS: 4321,
      signal: AbortSignal.abort(),
    }),
    fails(503, 'DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(calls, 1);
});

test('approved limiter defaults and bounded capacity are retained', () => {
  assert.equal(adminReadBudgetMs, 5000);
  assert.deepEqual(adminLimitDefaults, {
    ip: 300,
    account: 120,
    windowMs: 900000,
    capacity: 10000,
  });
  for (const config of [
    { ...adminLimitDefaults, ip: 0 },
    { ...adminLimitDefaults, account: NaN },
    { ...adminLimitDefaults, capacity: 10001 },
    { ...adminLimitDefaults, windowMs: 900001 },
  ])
    assert.throws(
      () => createAdminRateLimits(config),
      fails(503, 'DEPENDENCY_UNAVAILABLE'),
    );
});
test('full limiter store cannot evict a live identity; expired slots are reclaimed', async () => {
  let now = 0;
  const store = createAdminLimitStore(1, 100, () => now);
  assert.equal((await store.increment('one')).totalHits, 1);
  await assert.rejects(
    async () => store.increment('two'),
    fails(503, 'DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal((await store.increment('one')).totalHits, 2);
  now = 100;
  assert.equal((await store.increment('two')).totalHits, 1);
  await store.decrement('two');
  assert.equal((await store.increment('two')).totalHits, 1);
  await store.resetKey('two');
  assert.equal((await store.increment('three')).totalHits, 1);
});

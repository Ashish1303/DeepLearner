import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { Types } from 'mongoose';
import type { Db, MongoClient } from 'mongodb';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import {
  createAdminTechnologyService,
  type TechnologyAuthority,
} from '../src/modules/admin/technologies/admin-technology.service.js';
import {
  adminTechnologyRepository,
  type AdminTechnologyRepository,
  type TechnologyTransaction,
} from '../src/modules/admin/technologies/admin-technology.repository.js';
import { adminTechnologyDto } from '../src/modules/admin/technologies/admin-technology.dto.js';
import {
  adminTechnologyQuery,
  createTechnologyInput,
  patchTechnologyInput,
  technologyId,
} from '../src/modules/admin/technologies/admin-technology.schema.js';
import { createTechnologyManagementLimits } from '../src/modules/admin/technologies/admin-technology-rate-limit.js';

const actor = {
  sub: 'a'.repeat(24),
  sid: 'b'.repeat(24),
  role: 'ADMIN' as const,
  plan: 'FREE' as const,
};
const objectId = new Types.ObjectId('c'.repeat(24));
const date = new Date('2026-10-01T00:00:00.000Z');
function row() {
  return {
    _id: objectId,
    name: 'JavaScript',
    slug: 'javascript',
    order: 0,
    description: 'A language',
    iconAssetId: null,
    status: 'DRAFT',
    __v: 0,
    createdAt: date,
    updatedAt: date,
  };
}
const fail = (code: string) => (error: unknown) => {
  assert(error instanceof AppError);
  assert.equal(error.code, code);
  assert(!error.message.includes('PRIVATE'));
  assert.equal(error.details, undefined);
  return true;
};
function fixture() {
  const state = {
    account: {
      _id: new Types.ObjectId(actor.sub),
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: date,
      __v: 0,
    } as Record<string, unknown> | null,
    technology: row() as Record<string, unknown> | null,
    audits: [] as Record<string, unknown>[],
    transactions: 0,
    commits: 0,
    cleanups: 0,
    verify: 0,
    failure: '',
    ticks: 0,
    fenceLost: false,
    patchLost: false,
    unknownCommit: false,
  };
  const hit = (stage: string) => {
    if (state.failure === stage) throw new Error('PRIVATE_' + stage);
  };
  const repository: AdminTechnologyRepository = {
    async list() {
      hit('list');
      return {
        records: state.technology ? [state.technology] : [],
        total: state.technology ? 1 : 0,
      };
    },
    async get() {
      hit('get');
      return state.technology;
    },
    async transaction(work, operation) {
      state.transactions++;
      let user = state.account ? { ...state.account } : null;
      let technology = state.technology ? { ...state.technology } : null;
      const audits: Record<string, unknown>[] = [];
      const tx: TechnologyTransaction = {
        async actor() {
          hit('actor');
          return user;
        },
        async fence(id, version, verifiedAt) {
          hit('fence');
          assert(id.equals(actor.sub));
          assert.equal(version, user?.__v);
          assert.equal(verifiedAt, date);
          if (state.fenceLost) return false;
          user = { ...user, __v: version + 1 };
          return true;
        },
        async get() {
          hit('read');
          return technology;
        },
        async insert(value) {
          hit('insert');
          technology = value;
        },
        async patch(id, revision, fields, clear) {
          hit('patch');
          assert(id.equals(objectId));
          assert.equal(revision, technology?.__v);
          if (state.patchLost) return false;
          technology = { ...technology, ...fields, __v: revision + 1 };
          if (clear) delete technology.description;
          delete technology.updatedBy;
          return true;
        },
        async audit(value) {
          hit('audit');
          await new Audit(value).validate();
          audits.push(value);
        },
      };
      try {
        const value = await operation(tx);
        work.check();
        await work.verify();
        work.check();
        hit('commit');
        state.account = user;
        state.technology = technology;
        state.audits.push(...audits);
        state.commits++;
        if (state.unknownCommit) throw new Error('PRIVATE_UNKNOWN_COMMIT');
        return value;
      } finally {
        state.cleanups++;
      }
    },
  };
  const authority: TechnologyAuthority = {
    actor,
    verify: async () => {
      state.verify++;
      return actor;
    },
  };
  return {
    state,
    repository,
    authority,
    service: createAdminTechnologyService(
      repository,
      () => state.ticks,
      () => date,
    ),
  };
}

test('create binds immutable draft/provenance, returns exact DTO and atomically fences/audits', async () => {
  const f = fixture();
  const result = await f.service.create(
    { name: ' TypeScript ', slug: 'typescript', order: 4 },
    'request',
    f.authority,
  );
  assert.equal(result.name, 'TypeScript');
  assert.equal(result.status, 'DRAFT');
  assert.equal(result.iconAssetId, null);
  assert.equal(result.revision, 0);
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      'id',
      'name',
      'slug',
      'description',
      'iconAssetId',
      'status',
      'order',
      'revision',
      'createdAt',
      'updatedAt',
    ].sort(),
  );
  assert.equal(f.state.account?.__v, 1);
  assert.equal(f.state.account?.status, 'ACTIVE');
  assert.equal(f.state.audits.length, 1);
  assert.equal(f.state.transactions, 1);
  assert.equal(f.state.commits, 1);
  assert.equal(f.state.cleanups, 1);
  assert.equal(f.state.verify, 2);
  assert.equal(String(f.state.technology?.createdBy), actor.sub);
  assert.equal(String(f.state.audits[0]?.actorId), actor.sub);
  assert.equal(f.state.audits[0]?.action, 'TECHNOLOGY_CREATED');
  assert(!JSON.stringify(f.state.audits).includes('TypeScript'));
});
test('patch preserves slug/icon/creator while incrementing revision once and clearing description', async () => {
  const f = fixture();
  const icon = new Types.ObjectId();
  f.state.technology!.iconAssetId = icon;
  const result = await f.service.patch(
    objectId.toHexString(),
    { revision: 0, name: 'JS', description: null, order: 3 },
    'request',
    f.authority,
  );
  assert.equal(result.name, 'JS');
  assert.equal(result.description, null);
  assert.equal(result.slug, 'javascript');
  assert.equal(result.iconAssetId, icon.toHexString());
  assert.equal(result.revision, 1);
  assert.equal(f.state.account?.__v, 1);
  assert.deepEqual(f.state.audits[0]?.metadata, {
    revisionBefore: 0,
    revisionAfter: 1,
    changedFields: ['description', 'name', 'order'],
  });
});
test('no-op draft PATCH is one audited revision, not a skipped precondition', async () => {
  const f = fixture();
  const out = await f.service.patch(
    objectId.toHexString(),
    { revision: 0, name: 'JavaScript' },
    'request',
    f.authority,
  );
  assert.equal(out.revision, 1);
  assert.equal(f.state.audits.length, 1);
});

test('server defaults do not masquerade as supplied optional audit fields', async () => {
  const f = fixture();
  await f.service.create({ name: 'JS', slug: 'js' }, 'request', f.authority);
  assert.equal(f.state.technology?.order, 0);
  assert.deepEqual(f.state.audits[0]?.metadata, {
    revisionBefore: null,
    revisionAfter: 0,
    changedFields: ['name', 'slug'],
  });
});
for (const stage of ['actor', 'fence', 'read', 'patch', 'audit', 'commit'])
  test(`failure at ${stage} returns sanitized uncertainty and no partial commit/replay`, async () => {
    const f = fixture();
    const before = JSON.stringify(f.state.technology);
    f.state.failure = stage;
    await assert.rejects(
      f.service.patch(
        objectId.toHexString(),
        { revision: 0, name: 'JS' },
        'request',
        f.authority,
      ),
      fail('DEPENDENCY_UNAVAILABLE'),
    );
    assert.equal(JSON.stringify(f.state.technology), before);
    assert.equal(f.state.account?.__v, 0);
    assert.equal(f.state.audits.length, 0);
    assert.equal(f.state.transactions, 1);
    assert.equal(f.state.cleanups, 1);
  });
for (const status of ['PUBLISHED', 'ARCHIVED'])
  test(`${status} is read-only even with a stale revision`, async () => {
    const f = fixture();
    f.state.technology!.status = status;
    await assert.rejects(
      f.service.patch(
        objectId.toHexString(),
        { revision: 2, name: 'JS' },
        'request',
        f.authority,
      ),
      fail('TECHNOLOGY_READ_ONLY'),
    );
    assert.equal(f.state.account?.__v, 0);
    assert.equal(f.state.commits, 0);
  });
test('revision mismatch and lost CAS refuse and roll back fence', async () => {
  for (const lost of [false, true]) {
    const f = fixture();
    f.state.patchLost = lost;
    await assert.rejects(
      f.service.patch(
        objectId.toHexString(),
        { revision: lost ? 0 : 2, name: 'JS' },
        'request',
        f.authority,
      ),
      fail('TECHNOLOGY_REVISION_CONFLICT'),
    );
    assert.equal(f.state.account?.__v, 0);
    assert.equal(f.state.commits, 0);
  }
});
test('absent Technology returns generic 404 without committing actor fence', async () => {
  const f = fixture();
  f.state.technology = null;
  await assert.rejects(
    f.service.patch(
      objectId.toHexString(),
      { revision: 0, name: 'JS' },
      'request',
      f.authority,
    ),
    fail('TECHNOLOGY_NOT_FOUND'),
  );
  assert.equal(f.state.account?.__v, 0);
});
for (const change of [
  { role: 'STUDENT' },
  { status: 'DISABLED' },
  { status: 'SUSPENDED' },
  { status: 'PENDING_VERIFICATION' },
  { emailVerifiedAt: null },
])
  test(`current stored ineligibility ${JSON.stringify(change)} refuses mutation`, async () => {
    const f = fixture();
    Object.assign(f.state.account!, change);
    await assert.rejects(
      f.service.create(
        { name: 'JS', slug: 'js', order: 0 },
        'request',
        f.authority,
      ),
      fail('AUTH_FORBIDDEN'),
    );
    assert.equal(f.state.commits, 0);
    assert.equal(f.state.audits.length, 0);
  });
test('deleted account, forged account identity and lost eligibility fence fail closed', async () => {
  for (const kind of ['deleted', 'identity', 'fence']) {
    const f = fixture();
    if (kind === 'deleted') f.state.account = null;
    if (kind === 'identity') f.state.account!._id = objectId;
    if (kind === 'fence') f.state.fenceLost = true;
    await assert.rejects(
      f.service.create(
        { name: 'JS', slug: 'js', order: 0 },
        'request',
        f.authority,
      ),
      fail(kind === 'deleted' ? 'AUTH_FORBIDDEN' : 'DEPENDENCY_UNAVAILABLE'),
    );
    assert.equal(f.state.commits, 0);
  }
});
for (const value of [undefined, -1, 0.5, Number.MAX_SAFE_INTEGER, '0'])
  test(`invalid actor version ${String(value)} cannot initialize a fence`, async () => {
    const f = fixture();
    f.state.account!.__v = value;
    await assert.rejects(
      f.service.create(
        { name: 'JS', slug: 'js', order: 0 },
        'request',
        f.authority,
      ),
      fail('DEPENDENCY_UNAVAILABLE'),
    );
    assert.equal(f.state.commits, 0);
  });
test('namespace eligibility is not a substitute for repeated signed-token proof', async () => {
  const f = fixture();
  f.authority.verify = async () => ({ ...actor, sid: objectId.toHexString() });
  await assert.rejects(
    f.service.create(
      { name: 'JS', slug: 'js', order: 0 },
      'request',
      f.authority,
    ),
    fail('AUTH_FORBIDDEN'),
  );
  assert.equal(f.state.transactions, 0);
});
test('JWT expiry before commit rolls back without retry', async () => {
  const f = fixture();
  f.authority.verify = async () => {
    if (++f.state.verify === 2)
      throw new AppError(
        401,
        'AUTH_ACCESS_TOKEN_EXPIRED',
        'Access token expired',
      );
    return actor;
  };
  await assert.rejects(
    f.service.create(
      { name: 'JS', slug: 'js', order: 0 },
      'request',
      f.authority,
    ),
    fail('AUTH_ACCESS_TOKEN_EXPIRED'),
  );
  assert.equal(f.state.commits, 0);
  assert.equal(f.state.account?.__v, 0);
});
test('unknown commit is uncertainty even when mutation may already be durable', async () => {
  const f = fixture();
  f.state.unknownCommit = true;
  await assert.rejects(
    f.service.create(
      { name: 'JS', slug: 'js', order: 0 },
      'request',
      f.authority,
    ),
    fail('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(f.state.commits, 1);
  assert.equal(f.state.transactions, 1);
  assert.equal(f.state.audits.length, 1);
});

test('even recognized dependency error codes cannot relay private messages or details', async () => {
  const f = fixture();
  f.authority.verify = async () => {
    throw new AppError(
      401,
      'AUTH_ACCESS_TOKEN_EXPIRED',
      'PRIVATE_DRIVER_DETAIL',
      [{ field: 'private', message: 'PRIVATE' }],
    );
  };
  await assert.rejects(
    f.service.create({ name: 'JS', slug: 'js' }, 'request', f.authority),
    fail('AUTH_ACCESS_TOKEN_EXPIRED'),
  );
});
test('only known slug index duplicate maps to slug conflict', async () => {
  for (const keyPattern of [{ slug: 1 }, { email: 1 }, undefined]) {
    const f = fixture();
    f.repository.transaction = async () => {
      throw { code: 11000, keyPattern, message: 'PRIVATE_KEY' };
    };
    await assert.rejects(
      f.service.create(
        { name: 'JS', slug: 'js', order: 0 },
        'request',
        f.authority,
      ),
      fail(
        keyPattern && 'slug' in keyPattern
          ? 'TECHNOLOGY_SLUG_CONFLICT'
          : 'DEPENDENCY_UNAVAILABLE',
      ),
    );
  }
});
test('late verification result cannot commit after deadline callback delay', async () => {
  const f = fixture();
  f.authority.verify = async () => {
    if (++f.state.verify === 2) f.state.ticks = 10000;
    return actor;
  };
  await assert.rejects(
    f.service.create(
      { name: 'JS', slug: 'js', order: 0 },
      'request',
      f.authority,
    ),
    fail('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(f.state.commits, 0);
});
test('clock reversal and invalid time fail closed', async () => {
  for (const tick of [-1, NaN, Infinity]) {
    const f = fixture();
    f.authority.verify = async () => {
      f.state.ticks = tick;
      return actor;
    };
    await assert.rejects(
      f.service.create(
        { name: 'JS', slug: 'js', order: 0 },
        'request',
        f.authority,
      ),
      fail('DEPENDENCY_UNAVAILABLE'),
    );
    assert.equal(f.state.commits, 0);
  }
});
test('cancellation refuses a late dependency result without continuing to fence', async () => {
  const f = fixture();
  const abort = new AbortController();
  f.authority.signal = abort.signal;
  let release!: () => void;
  let continued = false;
  f.repository.transaction = async (work) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    work.check();
    continued = true;
    throw Error('PRIVATE');
  };
  const pending = f.service.create(
    { name: 'JS', slug: 'js', order: 0 },
    'request',
    f.authority,
  );
  while (!release) await Promise.resolve();
  abort.abort();
  await assert.rejects(pending, fail('DEPENDENCY_UNAVAILABLE'));
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(continued, false);
});
test('list/detail project all allowed states, preserve reads and refuse malformed records', async () => {
  const f = fixture();
  for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
    f.state.technology!.status = status;
    const before = JSON.stringify(f.state);
    const result = await f.service.list({ page: 1, limit: 20 }, f.authority);
    assert.equal(result.items[0]?.status, status);
    assert.equal(JSON.stringify(f.state), before);
  }
  f.state.technology!.passwordHash = 'PRIVATE';
  await assert.rejects(
    f.service.get(objectId.toHexString(), f.authority),
    fail('DEPENDENCY_UNAVAILABLE'),
  );
  f.state.technology = null;
  await assert.rejects(
    f.service.get(objectId.toHexString(), f.authority),
    fail('TECHNOLOGY_NOT_FOUND'),
  );
});

for (const input of [
  { actorId: actor.sub },
  { role: 'ADMIN' },
  { status: 'PUBLISHED' },
  { iconAssetId: objectId.toHexString() },
  { createdAt: date },
  { $set: { name: 'JS' } },
  { 'name.value': 'JS' },
])
  test(`create rejects extra field ${Object.keys(input)[0]}`, () => {
    assert.equal(
      createTechnologyInput.safeParse({ name: 'JS', slug: 'js', ...input })
        .success,
      false,
    );
  });
for (const slug of [
  'JS',
  ' js',
  'js ',
  'js\n',
  'a--b',
  'a/b',
  'a_b',
  'a'.repeat(101),
])
  test(`invalid slug ${JSON.stringify(slug)} refused`, () => {
    assert.equal(
      createTechnologyInput.safeParse({ name: 'JS', slug }).success,
      false,
    );
  });
for (const input of [
  { revision: 0 },
  { revision: 0, slug: 'new' },
  { revision: -1, name: 'JS' },
  { revision: 0, status: 'DRAFT' },
  { revision: 0, name: '' },
  { revision: 0, order: 0.5 },
  { revision: 0, description: 'x'.repeat(2001) },
])
  test(`PATCH rejects ${JSON.stringify(input).slice(0, 80)}`, () => {
    assert.equal(patchTechnologyInput.safeParse(input).success, false);
  });
for (const query of [
  { page: '0' },
  { page: '01' },
  { page: ['1', '2'] },
  { limit: '101' },
  { page: '10002', limit: '1' },
  { page: '1\n' },
  { sort: 'slug' },
  { page: '9007199254740992' },
])
  test(`pagination rejects ${JSON.stringify(query)}`, () => {
    assert.equal(adminTechnologyQuery.safeParse(query).success, false);
  });
test('input defaults, Unicode/plain descriptions, normalized IDs and exact DTO bounds', () => {
  assert.deepEqual(createTechnologyInput.parse({ name: ' JS ', slug: 'js' }), {
    name: 'JS',
    slug: 'js',
    order: 0,
  });
  assert.equal(
    patchTechnologyInput.parse({ revision: 0, description: null }).description,
    null,
  );
  assert.equal(technologyId.parse('A'.repeat(24)), actor.sub);
  assert.equal(
    adminTechnologyDto({ ...row(), description: '<script>alert(1)</script>' })
      .description,
    '<script>alert(1)</script>',
  );
  for (const patch of [
    { __v: -1 },
    { __v: 0.5 },
    { iconAssetId: 'not-an-id' },
    { status: 'UNKNOWN' },
    { createdAt: new Date(NaN) },
  ])
    assert.throws(
      () => adminTechnologyDto({ ...row(), ...patch }),
      fail('DEPENDENCY_UNAVAILABLE'),
    );
});
test('invalid limiter configuration refuses without starting timers or listeners', () => {
  for (const capacity of [0, -1, 10001, NaN])
    assert.throws(
      () =>
        createTechnologyManagementLimits({
          read: 120,
          mutation: 60,
          windowMs: 60000,
          capacity,
        }),
      fail('DEPENDENCY_UNAVAILABLE'),
    );
});

test('native repository qualifies PRIMARY/indexes and passes exact transactional fence, session and bounded commit options', async () => {
  const calls: { kind: string; value: unknown }[] = [];
  let ended = false;
  const session = {
    hasEnded: false,
    startTransaction: (value: unknown) => calls.push({ kind: 'start', value }),
    inTransaction: () => !ended,
    commitTransaction: async (value: unknown) => {
      calls.push({ kind: 'commit', value });
      ended = true;
    },
    abortTransaction: async () => {
      calls.push({ kind: 'abort', value: null });
      ended = true;
    },
    endSession: async () => {
      session.hasEnded = true;
    },
  };
  const fakeDb = {
    admin: () => ({
      command: async () => ({ isWritablePrimary: true, setName: 'synthetic' }),
    }),
    collection: (collection: string) => ({
      listIndexes: () => ({
        toArray: async () =>
          collection === 'technologies'
            ? [
                { key: { slug: 1 }, unique: true },
                { key: { status: 1, order: 1 } },
              ]
            : [
                { key: { actorId: 1, createdAt: -1 } },
                { key: { resourceType: 1, resourceId: 1, createdAt: -1 } },
              ],
      }),
      updateOne: async (filter: unknown, update: unknown, options: unknown) => {
        calls.push({ kind: collection, value: { filter, update, options } });
        return { matchedCount: 1, modifiedCount: 1 };
      },
    }),
  } as unknown as Db;
  const savedDb = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
  const savedReady = Object.getOwnPropertyDescriptor(
    mongoose.connection,
    'readyState',
  );
  Object.defineProperty(mongoose.connection, 'db', {
    configurable: true,
    value: fakeDb,
  });
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value: 1,
  });
  const client = mock.method(
    mongoose.connection,
    'getClient',
    () =>
      ({
        startSession: (options: unknown) => {
          calls.push({ kind: 'session', value: options });
          return session;
        },
      }) as unknown as MongoClient,
  );
  try {
    const work = {
      signal: new AbortController().signal,
      remaining: () => 1234,
      check: () => {},
      verify: async () => {
        calls.push({ kind: 'verify', value: null });
      },
    };
    const value = await adminTechnologyRepository.transaction(
      work,
      async (tx) => {
        assert.equal(
          await tx.fence(new Types.ObjectId(actor.sub), 7, date),
          true,
        );
        return 'safe';
      },
    );
    assert.equal(value, 'safe');
    assert.equal(session.hasEnded, true);
    const fence = calls.find((c) => c.kind === 'users')!.value as {
      filter: Record<string, unknown>;
      update: unknown;
      options: Record<string, unknown>;
    };
    assert.deepEqual(fence.update, { $inc: { __v: 1 } });
    assert.equal(fence.filter.role, 'ADMIN');
    assert.equal(fence.filter.status, 'ACTIVE');
    assert.equal(fence.filter.__v, 7);
    assert.equal(fence.options.session, session);
    assert.equal(fence.options.timeoutMS, 1234);
    assert.equal(calls.filter((c) => c.kind === 'commit').length, 1);
    assert.deepEqual(calls.find((c) => c.kind === 'commit')?.value, {
      timeoutMS: 1234,
    });
    assert(
      calls.findIndex((c) => c.kind === 'verify') <
        calls.findIndex((c) => c.kind === 'commit'),
    );
    assert(!calls.some((c) => c.kind === 'abort'));
  } finally {
    client.mock.restore();
    if (savedDb) Object.defineProperty(mongoose.connection, 'db', savedDb);
    else delete (mongoose.connection as unknown as Record<string, unknown>).db;
    if (savedReady)
      Object.defineProperty(mongoose.connection, 'readyState', savedReady);
    else
      delete (mongoose.connection as unknown as Record<string, unknown>)
        .readyState;
  }
});

test('native abort rejection still attempts bounded endSession and refuses cleanup uncertainty', async () => {
  const calls: string[] = [];
  const session = {
    hasEnded: false,
    startTransaction() {},
    inTransaction: () => true,
    async abortTransaction(options: { timeoutMS: number }) {
      calls.push('abort');
      assert.equal(options.timeoutMS, 2000);
      throw new Error('PRIVATE_ABORT');
    },
    async endSession(options: { timeoutMS: number }) {
      calls.push('end');
      assert.equal(options.timeoutMS, 2000);
      session.hasEnded = true;
    },
    async commitTransaction() {
      calls.push('commit');
    },
  };
  const db = {
    admin: () => ({
      command: async () => ({ isWritablePrimary: true, setName: 'synthetic' }),
    }),
    collection: (name: string) => ({
      listIndexes: () => ({
        toArray: async () =>
          name === 'technologies'
            ? [
                { key: { slug: 1 }, unique: true },
                { key: { status: 1, order: 1 } },
              ]
            : [
                { key: { actorId: 1, createdAt: -1 } },
                { key: { resourceType: 1, resourceId: 1, createdAt: -1 } },
              ],
      }),
    }),
  } as unknown as Db;
  const oldDb = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
  const oldReady = Object.getOwnPropertyDescriptor(
    mongoose.connection,
    'readyState',
  );
  Object.defineProperty(mongoose.connection, 'db', {
    configurable: true,
    value: db,
  });
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value: 1,
  });
  const client = mock.method(
    mongoose.connection,
    'getClient',
    () => ({ startSession: () => session }) as unknown as MongoClient,
  );
  try {
    await assert.rejects(
      adminTechnologyRepository.transaction(
        {
          signal: new AbortController().signal,
          remaining: () => 1000,
          check: () => {},
          verify: async () => {},
        },
        async () => {
          throw new Error('PRIVATE_WORK');
        },
      ),
      fail('DEPENDENCY_UNAVAILABLE'),
    );
    assert.deepEqual(calls, ['abort', 'end']);
    assert.equal(session.hasEnded, true);
  } finally {
    client.mock.restore();
    if (oldDb) Object.defineProperty(mongoose.connection, 'db', oldDb);
    else delete (mongoose.connection as unknown as Record<string, unknown>).db;
    if (oldReady)
      Object.defineProperty(mongoose.connection, 'readyState', oldReady);
    else
      delete (mongoose.connection as unknown as Record<string, unknown>)
        .readyState;
  }
});

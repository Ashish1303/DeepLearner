import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import {
  adminLearningPathQuery,
  adminLearningPathDetailQuery,
  adminLearningPathId,
} from '../src/modules/admin/learning-paths/admin-learning-path.schema.js';
import {
  adminLearningPathDto,
  learningPathProjection,
} from '../src/modules/admin/learning-paths/admin-learning-path.dto.js';
import {
  createAdminLearningPathService,
  type LearningPathAuthority,
} from '../src/modules/admin/learning-paths/admin-learning-path.service.js';
import {
  adminLearningPathRepository,
  type AdminLearningPathRepository,
} from '../src/modules/admin/learning-paths/admin-learning-path.repository.js';
import { createLearningPathReadLimit } from '../src/modules/admin/learning-paths/admin-learning-path-rate-limit.js';
import { getEventListeners } from 'node:events';
import {
  createLearningPathIntegrationLifetime,
  protectLearningPathIntegration,
  learningPathIntegrationRecords,
} from './admin-learning-path.integration.js';

const tid = 'a'.repeat(24),
  id = 'c'.repeat(24);
const date = new Date('2026-11-02T00:00:00.000Z');
const actor = {
  sub: 'd'.repeat(24),
  sid: 'e'.repeat(24),
  role: 'ADMIN' as const,
  plan: 'FREE' as const,
};
const row = () => ({
  _id: new Types.ObjectId(id),
  technologyId: new Types.ObjectId(tid),
  title: 'Path',
  slug: 'path',
  status: 'DRAFT',
  order: 0,
  completionScore: 70,
  __v: 0,
  createdAt: date,
  updatedAt: date,
});
function failure(code: string) {
  return (error: unknown) => {
    assert(error instanceof AppError);
    assert.equal(error.code, code);
    assert.equal(error.details, undefined);
    assert(!error.message.includes('PRIVATE'));
    return true;
  };
}
function fixture() {
  const state = {
    parent: { _id: new Types.ObjectId(tid), status: 'DRAFT' } as unknown,
    rows: [row()] as unknown[],
    total: 1,
    ticks: 0,
    parentReads: 0,
    reads: 0,
    fail: false,
    removeAfter: false,
  };
  const repository: AdminLearningPathRepository = {
    async parent() {
      state.parentReads++;
      if (state.fail) throw new Error('PRIVATE_DATABASE_STACK');
      return state.removeAfter && state.parentReads > 1 ? null : state.parent;
    },
    async list() {
      state.reads++;
      return { records: state.rows, total: state.total };
    },
    async get() {
      state.reads++;
      return state.rows[0] ?? null;
    },
  };
  const authority: LearningPathAuthority = { actor };
  return {
    state,
    repository,
    authority,
    service: createAdminLearningPathService(repository, () => state.ticks),
    query: { technologyId: tid, page: 1, limit: 20 },
  };
}

test('query normalizes IDs and supplies only bounded defaults', () => {
  assert.deepEqual(
    adminLearningPathQuery.parse({ technologyId: tid.toUpperCase() }),
    { technologyId: tid, page: 1, limit: 20 },
  );
  assert.equal(
    adminLearningPathQuery.parse({
      technologyId: tid,
      page: '10001',
      limit: '1',
    }).page,
    10001,
  );
  assert.equal(adminLearningPathId.parse(tid.toUpperCase()), tid);
  assert.deepEqual(adminLearningPathDetailQuery.parse({ technologyId: tid }), {
    technologyId: tid,
  });
});
for (const query of [
  {},
  { technologyId: tid + '\n' },
  { technologyId: [tid] },
  { technologyId: tid, page: '0' },
  { technologyId: tid, page: '01' },
  { technologyId: tid, page: '1\n' },
  { technologyId: tid, page: '1e2' },
  { technologyId: tid, page: 1 },
  { technologyId: tid, page: ['1', '2'] },
  { technologyId: tid, page: '10002', limit: '1' },
  { technologyId: tid, page: '502', limit: '20' },
  { technologyId: tid, limit: '101' },
  { technologyId: tid, limit: '0' },
  { technologyId: tid, status: 'DRAFT' },
  { technologyId: tid, sort: 'order' },
  { technologyId: tid, 'technologyId.$ne': tid },
])
  test('strict query refuses ' + JSON.stringify(query), () =>
    assert.equal(adminLearningPathQuery.safeParse(query).success, false),
  );

test('DTO exposes only approved metadata and does not invent personal completion', () => {
  const dto = adminLearningPathDto(row());
  assert.deepEqual(
    Object.keys(dto).sort(),
    [
      'id',
      'technologyId',
      'title',
      'slug',
      'description',
      'targetLevel',
      'completionScore',
      'status',
      'order',
      'revision',
      'createdAt',
      'updatedAt',
    ].sort(),
  );
  assert.equal(dto.description, null);
  assert.equal(dto.targetLevel, null);
  assert.equal(dto.completionScore, 70);
  assert.equal(dto.createdAt, date.toISOString());
  assert(!('createdBy' in learningPathProjection));
  assert(!('password' in learningPathProjection));
  assert.equal(
    adminLearningPathDto({ ...row(), description: '<script>inert</script>' })
      .description,
    '<script>inert</script>',
  );
});
for (const patch of [
  { status: 'UNKNOWN' },
  { title: ' Path ' },
  { slug: 'Bad' },
  { completionScore: 101 },
  { order: -1 },
  { __v: 0.5 },
  { createdAt: new Date(NaN) },
  { updatedAt: new Date(date.getTime() - 1) },
  { technologyId: tid },
  { description: 'x'.repeat(2001) },
  { targetLevel: 'EXPERT' },
  { privateDetails: { message: 'PRIVATE' } },
  { createdBy: new Types.ObjectId() },
])
  test(
    'projected DTO refuses corrupt/private fields: ' +
      Object.keys(patch).join(','),
    () =>
      assert.throws(
        () => adminLearningPathDto({ ...row(), ...patch }),
        failure('DEPENDENCY_UNAVAILABLE'),
      ),
  );

for (const parentStatus of ['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  for (const childStatus of ['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    test(
      'read-only ' +
        parentStatus +
        ' parent / ' +
        childStatus +
        ' path is inspectable',
      async () => {
        const f = fixture();
        f.state.parent = { _id: new Types.ObjectId(tid), status: parentStatus };
        f.state.rows = [{ ...row(), status: childStatus }];
        const before = JSON.stringify(f.state.rows);
        const page = await f.service.list(f.query, f.authority);
        assert.equal(page.items[0]!.status, childStatus);
        assert.equal(
          (await f.service.get(id, tid, f.authority)).status,
          childStatus,
        );
        assert.equal(f.state.parentReads, 4);
        assert.equal(JSON.stringify(f.state.rows), before);
      },
    );
test('missing parents and absent/mismatched paths have generic scoped outcomes', async () => {
  const f = fixture();
  f.state.parent = null;
  await assert.rejects(
    f.service.list(f.query, f.authority),
    failure('TECHNOLOGY_NOT_FOUND'),
  );
  await assert.rejects(
    f.service.get(id, tid, f.authority),
    failure('LEARNING_PATH_NOT_FOUND'),
  );
  assert.equal(f.state.reads, 0);
  f.state.parent = { _id: new Types.ObjectId(tid), status: 'PUBLISHED' };
  f.state.rows = [];
  await assert.rejects(
    f.service.get(id, tid, f.authority),
    failure('LEARNING_PATH_NOT_FOUND'),
  );
});
test('parent loss during read refuses list/detail rather than returning orphan data', async () => {
  for (const detail of [false, true]) {
    const f = fixture();
    f.state.removeAfter = true;
    await assert.rejects(
      detail
        ? f.service.get(id, tid, f.authority)
        : f.service.list(f.query, f.authority),
      failure(detail ? 'LEARNING_PATH_NOT_FOUND' : 'TECHNOLOGY_NOT_FOUND'),
    );
  }
});
test('corrupt parent identity or status fails closed', async () => {
  for (const parent of [
    { _id: new Types.ObjectId(), status: 'DRAFT' },
    { _id: new Types.ObjectId(tid), status: 'UNKNOWN' },
    { _id: tid, status: 'DRAFT' },
    { _id: new Types.ObjectId(tid), status: 'DRAFT', password: 'PRIVATE' },
  ]) {
    const f = fixture();
    f.state.parent = parent;
    await assert.rejects(
      f.service.list(f.query, f.authority),
      failure('DEPENDENCY_UNAVAILABLE'),
    );
  }
});
test('valid empty/later pages and the maximum offset return exact metadata', async () => {
  const f = fixture();
  f.state.rows = [];
  f.state.total = 0;
  assert.deepEqual((await f.service.list(f.query, f.authority)).pagination, {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  f.state.total = 1;
  assert.equal(
    (await f.service.list({ ...f.query, page: 2 }, f.authority)).items.length,
    0,
  );
  assert.equal(
    (await f.service.list({ ...f.query, page: 10001, limit: 1 }, f.authority))
      .items.length,
    0,
  );
});
test('invalid count, parent substitution, duplicate IDs/slugs or sort order cannot be returned', async () => {
  const variants: { rows: unknown[]; total: number }[] = [
    { rows: [row()], total: -1 },
    { rows: [row()], total: 0 },
    { rows: [row()], total: 2 },
    { rows: [row()], total: Number.NaN },
    { rows: [{ ...row(), technologyId: new Types.ObjectId() }], total: 1 },
    { rows: [row(), row()], total: 2 },
    {
      rows: [
        { ...row(), order: 2 },
        { ...row(), _id: new Types.ObjectId(), slug: 'other', order: 1 },
      ],
      total: 2,
    },
    {
      rows: [row(), { ...row(), _id: new Types.ObjectId(), order: 1 }],
      total: 2,
    },
  ];
  for (const v of variants) {
    const f = fixture();
    f.state.rows = v.rows;
    f.state.total = v.total;
    await assert.rejects(
      f.service.list(f.query, f.authority),
      failure('DEPENDENCY_UNAVAILABLE'),
    );
  }
});
test('correct order then binary slug order is preserved', async () => {
  const f = fixture();
  f.state.rows = [
    { ...row(), slug: 'a' },
    { ...row(), _id: new Types.ObjectId('f'.repeat(24)), slug: 'z' },
    { ...row(), _id: new Types.ObjectId('b'.repeat(24)), slug: 'b', order: 1 },
  ];
  f.state.total = 3;
  assert.deepEqual(
    (await f.service.list(f.query, f.authority)).items.map((x) => x.slug),
    ['a', 'z', 'b'],
  );
});
test('service refuses absent/Student/malformed actor without repository dispatch', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.list(f.query, { actor: undefined }),
    failure('AUTH_ACCESS_TOKEN_MISSING'),
  );
  await assert.rejects(
    f.service.list(f.query, { actor: { ...actor, role: 'STUDENT' } }),
    failure('AUTH_FORBIDDEN'),
  );
  await assert.rejects(
    f.service.list(f.query, { actor: { ...actor, sub: 'bad' } }),
    failure('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(f.state.parentReads, 0);
});
test('dependency exceptions never expose raw messages/details', async () => {
  const f = fixture();
  f.state.fail = true;
  await assert.rejects(
    f.service.list(f.query, f.authority),
    failure('DEPENDENCY_UNAVAILABLE'),
  );
});
test('expired or nonmonotonic clocks refuse late success without waiting for timeout callbacks', async () => {
  for (const value of [10000, Infinity, -1]) {
    const f = fixture();
    f.repository.list = async () => {
      f.state.ticks = value;
      return { records: [row()], total: 1 };
    };
    await assert.rejects(
      f.service.list(f.query, f.authority),
      failure('DEPENDENCY_UNAVAILABLE'),
    );
  }
});
test('cancellation bounds a noncooperative adapter and no late result is admitted', async () => {
  const f = fixture(),
    abort = new AbortController();
  let resolve!: (value: { records: unknown[]; total: number }) => void;
  f.repository.list = () =>
    new Promise((r) => {
      resolve = r;
    });
  const pending = f.service.list(f.query, {
    ...f.authority,
    signal: abort.signal,
  });
  await new Promise((r) => setImmediate(r));
  abort.abort();
  await assert.rejects(pending, failure('DEPENDENCY_UNAVAILABLE'));
  resolve({ records: [row()], total: 1 });
  await new Promise((r) => setImmediate(r));
  assert.equal(f.state.parentReads, 1);
});
test('pre-aborted requests perform no repository reads', async () => {
  const f = fixture(),
    abort = new AbortController();
  abort.abort();
  await assert.rejects(
    f.service.list(f.query, { ...f.authority, signal: abort.signal }),
    failure('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(f.state.reads + f.state.parentReads, 0);
});
test('the actual timer bounds a stalled adapter and is cleaned up', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.repository.list = () => new Promise(() => {});
  const pending = f.service.list(f.query, f.authority);
  const rejection = assert.rejects(pending, failure('DEPENDENCY_UNAVAILABLE'));
  await Promise.resolve();
  await Promise.resolve();
  t.mock.timers.tick(10000);
  await rejection;
});
test('limiter configuration rejects invalid bounds without infrastructure changes', () => {
  for (const capacity of [0, -1, 10001, NaN])
    assert.throws(
      () =>
        createLearningPathReadLimit({ read: 120, windowMs: 60000, capacity }),
      failure('DEPENDENCY_UNAVAILABLE'),
    );
});

test('real repository emits only bounded primary reads and exact scoping/projections/facet', async () => {
  const calls: {
    collection: string;
    op: string;
    filter: unknown;
    options: Record<string, unknown>;
  }[] = [];
  const fakeDb = {
    collection: (name: string) => ({
      findOne: async (filter: unknown, options: Record<string, unknown>) => {
        calls.push({ collection: name, op: 'findOne', filter, options });
        return name === 'technologies'
          ? { _id: new Types.ObjectId(tid), status: 'ARCHIVED' }
          : row();
      },
      aggregate: (filter: unknown, options: Record<string, unknown>) => {
        calls.push({ collection: name, op: 'aggregate', filter, options });
        return {
          toArray: async () => [{ records: [row()], count: [{ total: 1 }] }],
        };
      },
    }),
  };
  const oldDb = Object.getOwnPropertyDescriptor(mongoose.connection, 'db'),
    oldReady = Object.getOwnPropertyDescriptor(
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
  try {
    const f = fixture();
    const service = createAdminLearningPathService(adminLearningPathRepository);
    await service.list(f.query, f.authority);
    await service.get(id, tid, f.authority);
    assert.equal(calls.length, 6);
    assert(
      calls.every(
        (c) =>
          c.options.readPreference === 'primary' &&
          typeof c.options.timeoutMS === 'number' &&
          c.options.timeoutMS > 0 &&
          c.options.timeoutMS <= 10000 &&
          c.options.signal instanceof AbortSignal,
      ),
    );
    const pipeline = calls.find((c) => c.op === 'aggregate')!.filter as Record<
      string,
      unknown
    >[];
    assert.deepEqual(pipeline[0], {
      $match: { technologyId: new Types.ObjectId(tid) },
    });
    const facet = pipeline[1]!.$facet as {
      records: Record<string, unknown>[];
      count: unknown[];
    };
    assert.deepEqual(facet.records[0], {
      $sort: { order: 1, slug: 1, _id: 1 },
    });
    assert.deepEqual(facet.count, [{ $count: 'total' }]);
    assert.deepEqual(facet.records.at(-1), {
      $project: learningPathProjection,
    });
    const detail = calls.find(
      (c) => c.collection === 'learningPaths' && c.op === 'findOne',
    )!;
    assert.deepEqual(detail.filter, {
      _id: new Types.ObjectId(id),
      technologyId: new Types.ObjectId(tid),
    });
    assert.deepEqual(detail.options.projection, learningPathProjection);
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 0,
    });
    await assert.rejects(
      service.list(f.query, f.authority),
      failure('DEPENDENCY_UNAVAILABLE'),
    );
    assert.equal(calls.length, 6);
  } finally {
    const connection = mongoose.connection as unknown as Record<
      string,
      unknown
    >;
    if (oldDb) Object.defineProperty(mongoose.connection, 'db', oldDb);
    else delete connection.db;
    if (oldReady)
      Object.defineProperty(mongoose.connection, 'readyState', oldReady);
    else delete connection.readyState;
  }
});

test('prepared integration import is inert and preserves its distinct nine-record manifest', () => {
  assert.deepEqual(learningPathIntegrationRecords, [
    'PARENT',
    'T01',
    'T02',
    'T03',
    'T04',
    'T05',
    'T06',
    'T07',
    'T08',
  ]);
  assert.equal(mongoose.connection.readyState, 0);
});
test('parent/subtest timeout or ownership loss refuses delayed PASS and all subsequent case work', async () => {
  for (const source of ['parent', 'child', 'ownership'] as const) {
    const parent = new AbortController(),
      child = new AbortController();
    let lose!: () => void,
      disposed = 0,
      passed = 0,
      afterAwait = 0,
      laterWork = 0;
    const lifetime = createLearningPathIntegrationLifetime(
      parent.signal,
      (callback) => {
        lose = callback;
        return () => {
          disposed++;
        };
      },
    );
    let resolve!: () => void;
    const delayed = new Promise<void>((r) => {
      resolve = r;
    });
    const pending = lifetime.runCase(child.signal, async () => {
      await delayed;
      lifetime.check(child.signal);
      afterAwait++;
      lifetime.check(child.signal);
      passed++;
    });
    const refusal = assert.rejects(pending, /LEARNING_PATH_INTEGRATION_FAILED/);
    if (source === 'parent') parent.abort();
    else if (source === 'child') child.abort();
    else lose();
    resolve();
    await refusal;
    await assert.rejects(
      lifetime.runCase(new AbortController().signal, async () => {
        laterWork++;
      }),
      /LEARNING_PATH_INTEGRATION_FAILED/,
    );
    assert.equal(passed + afterAwait + laterWork, 0);
    lifetime.dispose();
    lifetime.dispose();
    assert.equal(disposed, 1);
    assert.equal(getEventListeners(parent.signal, 'abort').length, 0);
    assert.equal(getEventListeners(child.signal, 'abort').length, 0);
  }
});
test('prepared helper cleanup occurs on malformed fixtures, setup and private driver failures', async () => {
  for (const stage of ['fixtures', 'qualification', 'snapshot']) {
    const parent = new AbortController();
    let disposed = 0;
    await assert.rejects(
      protectLearningPathIntegration(async () => {
        const lifetime = createLearningPathIntegrationLifetime(
          parent.signal,
          () => () => {
            disposed++;
          },
        );
        try {
          throw new Error('PRIVATE_' + stage, {
            cause: { password: 'SYNTHETIC_PRIVATE' },
          });
        } finally {
          lifetime.dispose();
        }
      }),
      (error: unknown) => {
        assert(error instanceof Error);
        assert.equal(error.message, 'LEARNING_PATH_INTEGRATION_FAILED');
        assert.equal(error.cause, undefined);
        assert(!String(error.stack).includes('PRIVATE_'));
        return true;
      },
    );
    assert.equal(disposed, 1);
    assert.equal(getEventListeners(parent.signal, 'abort').length, 0);
  }
});
test('loss-subscription errors are sanitized and release parent handlers', () => {
  const parent = new AbortController();
  assert.throws(
    () =>
      createLearningPathIntegrationLifetime(parent.signal, () => {
        throw Error('PRIVATE_SUBSCRIBE');
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'LEARNING_PATH_INTEGRATION_FAILED',
  );
  assert.equal(getEventListeners(parent.signal, 'abort').length, 0);
});

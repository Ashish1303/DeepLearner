import { mongoose } from '../src/config/database.js';
import { adminModuleRepository } from '../src/modules/admin/modules/admin-module.repository.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { AppError } from '../src/common/errors/app-error.js';
import { createAdminModuleService } from '../src/modules/admin/modules/admin-module.service.js';
import {
  adminModuleQuery,
  adminModuleDetailQuery,
  adminModuleListRequest,
} from '../src/modules/admin/modules/admin-module.schema.js';
import {
  adminModuleDto,
  moduleProjection,
} from '../src/modules/admin/modules/admin-module.dto.js';
import type { AdminModuleRepository } from '../src/modules/admin/modules/admin-module.repository.js';
import { createModuleReadLimit } from '../src/modules/admin/modules/admin-module-rate-limit.js';
const technologyId = 'a'.repeat(24),
  learningPathId = 'b'.repeat(24),
  id = 'c'.repeat(24);
const actor = {
  sub: 'd'.repeat(24),
  sid: 'e'.repeat(24),
  role: 'ADMIN' as const,
  plan: 'FREE' as const,
};
const row = () => ({
  _id: new Types.ObjectId(id),
  technologyId: new Types.ObjectId(technologyId),
  learningPathId: new Types.ObjectId(learningPathId),
  title: 'Module',
  slug: 'module',
  status: 'DRAFT',
  order: 0,
  __v: 0,
  createdAt: new Date('2026-11-05T00:00:00.000Z'),
  updatedAt: new Date('2026-11-05T00:00:00.000Z'),
});
const query = { technologyId, learningPathId, page: 1, limit: 20 };
const code = (expected: string) => (error: unknown) => {
  assert(error instanceof AppError);
  assert.equal(error.code, expected);
  assert(!error.message.includes('PRIVATE'));
  assert.equal(error.details, undefined);
  return true;
};
function fixture() {
  const state = {
    parent: {
      _id: new Types.ObjectId(learningPathId),
      technologyId: new Types.ObjectId(technologyId),
      status: 'ARCHIVED',
    } as unknown,
    rows: [row()] as unknown[],
    total: 1,
    reads: 0,
    parents: 0,
    ticks: 0,
    fail: false,
    disappear: false,
  };
  const repository: AdminModuleRepository = {
    async parent(tid, pid, work) {
      work.check();
      assert.equal(tid.toHexString(), technologyId);
      assert.equal(pid.toHexString(), learningPathId);
      state.parents++;
      if (state.fail) throw Error('PRIVATE_STACK');
      return state.disappear && state.parents > 1 ? null : state.parent;
    },
    async list(q, work) {
      work.check();
      assert.equal(q.learningPathId, learningPathId);
      state.reads++;
      return { records: state.rows, total: state.total };
    },
    async get(mid, tid, pid, work) {
      work.check();
      assert.equal(mid.toHexString(), id);
      assert.equal(tid.toHexString(), technologyId);
      assert.equal(pid.toHexString(), learningPathId);
      state.reads++;
      return state.rows[0] ?? null;
    },
  };
  return {
    state,
    service: createAdminModuleService(repository, () => state.ticks),
    authority: { actor },
    repository,
  };
}
test('module query requires both parents, normalizes IDs and enforces exact pagination/body bounds', () => {
  assert.deepEqual(
    adminModuleQuery.parse({
      technologyId: technologyId.toUpperCase(),
      learningPathId: learningPathId.toUpperCase(),
    }),
    query,
  );
  for (const invalid of [
    { technologyId },
    { ...query, page: '0' },
    { ...query, page: '501', limit: '21' },
    { ...query, limit: '101' },
    { ...query, extra: 'x' },
    { ...query, technologyId: { $ne: null } },
  ])
    assert(!adminModuleQuery.safeParse(invalid).success);
  assert(
    adminModuleDetailQuery.safeParse({ technologyId, learningPathId }).success,
  );
  assert(
    !adminModuleDetailQuery.safeParse({
      technologyId,
      learningPathId,
      page: '1',
    }).success,
  );
  assert(
    !adminModuleListRequest.safeParse({
      query: { technologyId, learningPathId },
      params: {},
      body: { edit: true },
    }).success,
  );
});
test('module reads allow archived ancestors and all statuses without writes; bind both parents and recheck', async () => {
  for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
    const f = fixture();
    f.state.rows = [{ ...row(), status }];
    const page = await f.service.list(query, f.authority);
    assert.equal(page.items[0]?.status, status);
    assert.equal(page.items[0]?.description, null);
    assert.equal(f.state.parents, 2);
    assert.equal(f.state.reads, 1);
    assert.equal(
      (await f.service.get(id, technologyId, learningPathId, f.authority)).id,
      id,
    );
  }
});
test('missing/invalid authority refuses before repository dispatch', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.list(query, { actor: undefined }),
    code('AUTH_ACCESS_TOKEN_MISSING'),
  );
  await assert.rejects(
    f.service.list(query, { actor: { ...actor, role: 'STUDENT' } }),
    code('AUTH_FORBIDDEN'),
  );
  assert.equal(f.state.parents, 0);
});
test('missing, mismatched and disappearing parents refuse without partial data', async () => {
  for (const parent of [
    null,
    {
      _id: new Types.ObjectId(id),
      technologyId: new Types.ObjectId(technologyId),
      status: 'DRAFT',
    },
    {
      _id: new Types.ObjectId(learningPathId),
      technologyId: new Types.ObjectId(id),
      status: 'DRAFT',
    },
  ]) {
    const f = fixture();
    f.state.parent = parent;
    await assert.rejects(
      f.service.list(query, f.authority),
      code(
        parent === null ? 'LEARNING_PATH_NOT_FOUND' : 'DEPENDENCY_UNAVAILABLE',
      ),
    );
    assert.equal(f.state.reads, 0);
  }
  const f = fixture();
  f.state.disappear = true;
  await assert.rejects(
    f.service.list(query, f.authority),
    code('LEARNING_PATH_NOT_FOUND'),
  );
});
test('DTO refuses unexpected fields, corrupt states and cross-parent records', async () => {
  assert(!('createdBy' in moduleProjection));
  assert(!('internal' in adminModuleDto(row())));
  for (const bad of [
    { ...row(), internal: 'PRIVATE' },
    { ...row(), status: 'APPROVED' },
    { ...row(), learningPathId: new Types.ObjectId(id) },
    { ...row(), updatedAt: new Date(0) },
  ]) {
    const f = fixture();
    f.state.rows = [bad];
    await assert.rejects(
      f.service.list(query, f.authority),
      code('DEPENDENCY_UNAVAILABLE'),
    );
  }
});
test('duplicate/out-of-order/count-inconsistent pages are refused', async () => {
  for (const rows of [
    [row(), row()],
    [
      { ...row(), order: 2 },
      {
        ...row(),
        _id: new Types.ObjectId('f'.repeat(24)),
        slug: 'other',
        order: 1,
      },
    ],
    [],
  ]) {
    const f = fixture();
    f.state.rows = rows;
    f.state.total = rows.length || 1;
    await assert.rejects(
      f.service.list(query, f.authority),
      code('DEPENDENCY_UNAVAILABLE'),
    );
  }
  const f = fixture();
  f.state.rows = [];
  f.state.total = 0;
  assert.deepEqual((await f.service.list(query, f.authority)).pagination, {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
});
test('deadline and cancellation refuse late results and sanitize errors', async () => {
  const f = fixture();
  f.state.fail = true;
  await assert.rejects(
    f.service.list(query, f.authority),
    code('DEPENDENCY_UNAVAILABLE'),
  );
  const abort = new AbortController();
  abort.abort();
  const g = fixture();
  await assert.rejects(
    g.service.list(query, { actor, signal: abort.signal }),
    code('DEPENDENCY_UNAVAILABLE'),
  );
  assert.equal(g.state.parents, 0);
  const h = fixture();
  const repository = {
    ...h.repository,
    async list() {
      h.state.ticks = 10001;
      return { records: [row()], total: 1 };
    },
  };
  await assert.rejects(
    createAdminModuleService(repository, () => h.state.ticks).list(
      query,
      h.authority,
    ),
    code('DEPENDENCY_UNAVAILABLE'),
  );
});
test('module rate limiter rejects unbounded capacities/windows', () => {
  assert.throws(() =>
    createModuleReadLimit({ read: 120, windowMs: 60001, capacity: 10000 }),
  );
  assert.throws(() =>
    createModuleReadLimit({ read: 120, windowMs: 60000, capacity: 10001 }),
  );
});

test('native repository issues bounded projected reads with both parent predicates and no writes', async () => {
  const connection = mongoose.connection;
  const ready = Object.getOwnPropertyDescriptor(connection, 'readyState'),
    db = Object.getOwnPropertyDescriptor(connection, 'db');
  const seen: {
    name: string;
    filter: unknown;
    options: Record<string, unknown>;
  }[] = [];
  const work = {
    signal: new AbortController().signal,
    remaining: () => 9000,
    check: () => {},
  };
  Object.defineProperty(connection, 'readyState', {
    configurable: true,
    value: 1,
  });
  Object.defineProperty(connection, 'db', {
    configurable: true,
    value: {
      collection(name: string) {
        return {
          async findOne(
            filter: Record<string, unknown>,
            options: Record<string, unknown>,
          ) {
            seen.push({ name, filter, options });
            if (name === 'technologies')
              return {
                _id: new Types.ObjectId(technologyId),
                status: 'ARCHIVED',
              };
            if (name === 'learningPaths')
              return {
                _id: new Types.ObjectId(learningPathId),
                technologyId: new Types.ObjectId(technologyId),
                status: 'ARCHIVED',
              };
            return row();
          },
          aggregate(
            pipeline: Record<string, unknown>[],
            options: Record<string, unknown>,
          ) {
            seen.push({ name, filter: pipeline, options });
            return {
              async toArray() {
                return [{ records: [row()], count: [{ total: 1 }] }];
              },
            };
          },
        };
      },
    },
  });
  try {
    await adminModuleRepository.parent(
      new Types.ObjectId(technologyId),
      new Types.ObjectId(learningPathId),
      work,
    );
    await adminModuleRepository.list(query, work);
    await adminModuleRepository.get(
      new Types.ObjectId(id),
      new Types.ObjectId(technologyId),
      new Types.ObjectId(learningPathId),
      work,
    );
    assert.deepEqual(
      seen.map((v) => v.name),
      ['technologies', 'learningPaths', 'modules', 'modules'],
    );
    assert.deepEqual(seen[1]?.filter, {
      _id: new Types.ObjectId(learningPathId),
      technologyId: new Types.ObjectId(technologyId),
    });
    const pipeline = seen[2]!.filter as Record<string, unknown>[];
    assert.deepEqual(pipeline[0], {
      $match: {
        technologyId: new Types.ObjectId(technologyId),
        learningPathId: new Types.ObjectId(learningPathId),
      },
    });
    assert.deepEqual(seen[3]?.filter, {
      _id: new Types.ObjectId(id),
      technologyId: new Types.ObjectId(technologyId),
      learningPathId: new Types.ObjectId(learningPathId),
    });
    for (const entry of seen) {
      assert.equal(entry.options.timeoutMS, 9000);
      assert.equal(entry.options.readPreference, 'primary');
      assert.equal(entry.options.signal, work.signal);
    }
    assert.equal(seen[2]?.options.maxTimeMS, 9000);
    assert.deepEqual(seen[2]?.options.collation, { locale: 'simple' });
    assert.deepEqual(seen[3]?.options.projection, moduleProjection);
  } finally {
    if (ready) Object.defineProperty(connection, 'readyState', ready);
    else Reflect.deleteProperty(connection, 'readyState');
    if (db) Object.defineProperty(connection, 'db', db);
    else Reflect.deleteProperty(connection, 'db');
  }
});

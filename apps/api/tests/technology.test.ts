import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { technologyQuery } from '../src/modules/technologies/technology.schema.js';
import { technologyDto } from '../src/modules/technologies/technology.dto.js';
import { createTechnologyService } from '../src/modules/technologies/technology.service.js';
import { technologyRepository } from '../src/modules/technologies/technology.repository.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
test('catalog pagination rejects repeated/nested/unknown and unsafe values', () => {
  assert.deepEqual(technologyQuery.parse({}), { page: 1, limit: 20 });
  assert.deepEqual(technologyQuery.parse({ page: '2', limit: '100' }), {
    page: 2,
    limit: 100,
  });
  for (const query of [
    { page: ['1', '2'] },
    { page: { value: '1' } },
    { status: 'DRAFT' },
    { page: '0' },
    { page: '1\n' },
    { page: '-1' },
    { page: '1.5' },
    { page: '1e2' },
    { limit: '101' },
    { limit: '' },
    { page: String(Number.MAX_SAFE_INTEGER), limit: '100' },
  ])
    assert.equal(technologyQuery.safeParse(query).success, false);
});
test('catalog DTO selects only public fields and normalizes missing optional values', () => {
  const raw = {
    _id: new Types.ObjectId(),
    name: 'Test',
    slug: 'test',
    order: 0,
    status: 'PUBLISHED',
    createdBy: new Types.ObjectId(),
    updatedBy: new Types.ObjectId(),
    __v: 3,
  };
  assert.deepEqual(technologyDto(raw), {
    id: String(raw._id),
    name: 'Test',
    slug: 'test',
    order: 0,
    description: null,
    iconAssetId: null,
  });
});
test('catalog service supplies standard pagination including empty pages', async () => {
  const service = createTechnologyService({
    async list(query) {
      assert.equal(query.page, 2);
      return { items: [], total: 21 };
    },
  });
  assert.deepEqual(await service.list({ page: 2, limit: 20 }), {
    items: [],
    pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
  });
  const empty = createTechnologyService({
    async list() {
      return { items: [], total: 0 };
    },
  });
  assert.equal(
    (await empty.list({ page: 1, limit: 20 })).pagination.totalPages,
    0,
  );
});
test('repository enforces published filter/projection/order/offset and sanitizes driver errors', async (t) => {
  const raw = {
    _id: new Types.ObjectId(),
    name: 'Test',
    slug: 'test',
    order: 0,
  };
  const query = Technology.find();
  t.mock.method(Technology, 'find', (filter: unknown) => {
    assert.deepEqual(filter, { status: 'PUBLISHED' });
    return query;
  });
  t.mock.method(query, 'exec', async () => [raw]);
  const count = Technology.countDocuments();
  t.mock.method(Technology, 'countDocuments', (filter: unknown) => {
    assert.deepEqual(filter, { status: 'PUBLISHED' });
    return count;
  });
  t.mock.method(count, 'exec', async () => 21);
  const result = await technologyRepository.list({ page: 2, limit: 20 });
  assert.equal(result.total, 21);
  assert.deepEqual(query.projection(), {
    _id: 1,
    name: 1,
    slug: 1,
    description: 1,
    iconAssetId: 1,
    order: 1,
  });
  assert.deepEqual(query.getOptions().sort, { order: 1, slug: 1 });
  assert.equal(query.getOptions().skip, 20);
  assert.equal(query.getOptions().limit, 20);
  t.mock.method(query, 'exec', async () => {
    throw new Error('PRIVATE_DRIVER_SENTINEL');
  });
  await assert.rejects(
    technologyRepository.list({ page: 1, limit: 20 }),
    (error: unknown) => {
      assert(error instanceof Error);
      assert(!error.message.includes('PRIVATE_DRIVER_SENTINEL'));
      return 'code' in error && error.code === 'DEPENDENCY_UNAVAILABLE';
    },
  );
});

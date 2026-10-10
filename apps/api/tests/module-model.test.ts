import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { Module, moduleSchema } from '../src/modules/modules/module.model.js';
const valid = () => ({
  technologyId: new Types.ObjectId(),
  learningPathId: new Types.ObjectId(),
  title: ' Synthetic module ',
  slug: 'synthetic-module',
});
test('module defaults and boundaries validate offline', async () => {
  const doc = new Module(valid());
  await doc.validate();
  assert.equal(doc.title, 'Synthetic module');
  assert.equal(doc.status, 'DRAFT');
  assert.equal(doc.order, 0);
  for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    await new Module({
      ...valid(),
      title: 'x'.repeat(120),
      slug: 'x'.repeat(100),
      description: 'x'.repeat(2000),
      status,
      order: Number.MAX_SAFE_INTEGER,
    }).validate();
});
test('module rejects invalid fields and unapproved schema additions', async () => {
  for (const patch of [
    { technologyId: null },
    { technologyId: 'bad' },
    { learningPathId: null },
    { learningPathId: 'bad' },
    { title: '' },
    { title: '  ' },
    { title: 'x'.repeat(121) },
    { slug: '' },
    { slug: 'Upper' },
    { slug: 'end\n' },
    { slug: '-start' },
    { slug: 'two--parts' },
    { slug: 'two_parts' },
    { slug: '\u00e9' },
    { slug: 'x'.repeat(101) },
    { description: 'x'.repeat(2001) },
    { status: 'DELETED' },
    { status: null },
    { order: -1 },
    { order: 0.5 },
    { order: Number.MAX_SAFE_INTEGER + 1 },
    { order: null },
  ])
    await assert.rejects(new Module({ ...valid(), ...patch }).validate());
  for (const key of ['createdBy', 'updatedBy', 'topics', 'completionScore'])
    assert.throws(() => new Module({ ...valid(), [key]: 'unexpected' }));
});
test('module declares parent scoped indexes without automatic provisioning', () => {
  assert.deepEqual(moduleSchema.indexes(), [
    [{ learningPathId: 1, slug: 1 }, { unique: true }],
    [{ learningPathId: 1, status: 1, order: 1 }, {}],
  ]);
  for (const key of ['autoCreate', 'autoIndex', 'bufferCommands'] as const)
    assert.equal(moduleSchema.get(key), false);
  assert.equal(moduleSchema.get('strict'), 'throw');
  assert.equal(moduleSchema.get('timestamps'), true);
  assert.equal(Module.collection.name, 'modules');
  assert.equal(moduleSchema.path('technologyId').options.ref, 'Technology');
  assert.equal(moduleSchema.path('learningPathId').options.ref, 'LearningPath');
  assert.equal(moduleSchema.path('createdBy'), undefined);
});

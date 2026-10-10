import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { Topic, topicSchema } from '../src/modules/topics/topic.model.js';
const valid = () => ({
  technologyId: new Types.ObjectId(),
  learningPathId: new Types.ObjectId(),
  moduleId: new Types.ObjectId(),
  title: ' Synthetic topic ',
  slug: 'synthetic-topic',
});
test('topic defaults and boundaries validate offline', async () => {
  const doc = new Topic(valid());
  await doc.validate();
  assert.equal(doc.title, 'Synthetic topic');
  assert.equal(doc.status, 'DRAFT');
  assert.equal(doc.order, 0);
  for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    await new Topic({
      ...valid(),
      title: 'x'.repeat(120),
      slug: 'x'.repeat(100),
      description: 'x'.repeat(2000),
      status,
      order: Number.MAX_SAFE_INTEGER,
    }).validate();
});
test('topic rejects invalid fields and unapproved schema additions', async () => {
  for (const patch of [
    { technologyId: null },
    { technologyId: 'bad' },
    { moduleId: null },
    { moduleId: 'bad' },
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
    await assert.rejects(new Topic({ ...valid(), ...patch }).validate());
  for (const key of ['createdBy', 'updatedBy', 'concepts', 'completionScore'])
    assert.throws(() => new Topic({ ...valid(), [key]: 'unexpected' }));
});
test('topic declares parent scoped indexes without automatic provisioning', () => {
  assert.deepEqual(topicSchema.indexes(), [
    [{ moduleId: 1, slug: 1 }, { unique: true }],
    [{ moduleId: 1, status: 1, order: 1 }, {}],
  ]);
  for (const key of ['autoCreate', 'autoIndex', 'bufferCommands'] as const)
    assert.equal(topicSchema.get(key), false);
  assert.equal(topicSchema.get('strict'), 'throw');
  assert.equal(topicSchema.get('timestamps'), true);
  assert.equal(Topic.collection.name, 'topics');
  assert.equal(topicSchema.path('technologyId').options.ref, 'Technology');
  assert.equal(topicSchema.path('learningPathId').options.ref, 'LearningPath');
  assert.equal(topicSchema.path('createdBy'), undefined);
});

test('topic module reference is required without adding completion fields', () => {
  assert.equal(topicSchema.path('moduleId').options.ref, 'Module');
  assert.equal(topicSchema.path('completionScore'), undefined);
});

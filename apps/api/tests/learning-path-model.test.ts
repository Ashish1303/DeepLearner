import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  LearningPath,
  learningPathSchema,
} from '../src/modules/learning-paths/learning-path.model.js';
const valid = () => ({
  technologyId: new Types.ObjectId(),
  title: ' Synthetic path ',
  slug: 'synthetic-path',
  createdBy: new Types.ObjectId(),
  updatedBy: new Types.ObjectId(),
});
test('learning path defaults and boundary values validate without database access', async () => {
  const doc = new LearningPath(valid());
  await doc.validate();
  assert.equal(doc.title, 'Synthetic path');
  assert.equal(doc.status, 'DRAFT');
  assert.equal(doc.completionScore, 70);
  assert.equal(doc.order, 0);
  assert.equal(doc.targetLevel, null);
  for (const completionScore of [0, 100])
    for (const targetLevel of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) {
      await new LearningPath({
        ...valid(),
        title: 'x'.repeat(120),
        slug: 'x'.repeat(100),
        description: 'x'.repeat(2000),
        completionScore,
        targetLevel,
        status: 'ARCHIVED',
        order: Number.MAX_SAFE_INTEGER,
      }).validate();
    }
});
test('learning path rejects invalid fields and missing provenance', async () => {
  for (const patch of [
    { technologyId: null },
    { technologyId: 'bad' },
    { title: '' },
    { title: '  ' },
    { title: 'x'.repeat(121) },
    { slug: '' },
    { slug: 'Upper' },
    { slug: 'path\n' },
    { slug: '-path' },
    { slug: 'two--parts' },
    { slug: 'é' },
    { slug: 'x'.repeat(101) },
    { description: 'x'.repeat(2001) },
    { targetLevel: 'EXPERT' },
    { status: 'DELETED' },
    { completionScore: -1 },
    { completionScore: 101 },
    { completionScore: 70.5 },
    { completionScore: null },
    { order: -1 },
    { order: 0.5 },
    { order: Number.MAX_SAFE_INTEGER + 1 },
    { order: null },
    { createdBy: null },
    { updatedBy: null },
    { updatedBy: 'invalid' },
  ])
    await assert.rejects(new LearningPath({ ...valid(), ...patch }).validate());
  assert.throws(() => new LearningPath({ ...valid(), modules: [] }));
});
test('learning path declares only canonical indexes and disables provisioning', () => {
  assert.deepEqual(learningPathSchema.indexes(), [
    [{ technologyId: 1, slug: 1 }, { unique: true }],
    [{ technologyId: 1, status: 1, order: 1 }, {}],
  ]);
  for (const key of ['autoCreate', 'autoIndex', 'bufferCommands'] as const)
    assert.equal(learningPathSchema.get(key), false);
  assert.equal(learningPathSchema.get('strict'), 'throw');
  assert.equal(learningPathSchema.get('timestamps'), true);
  assert.equal(LearningPath.collection.name, 'learningPaths');
  assert.equal(learningPathSchema.path('createdBy').options.ref, 'User');
  assert.equal(
    learningPathSchema.path('technologyId').options.ref,
    'Technology',
  );
});

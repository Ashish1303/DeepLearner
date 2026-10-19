import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  StudentProgress,
  progressRecord,
  progressIndex,
} from '../src/modules/progress/progress.model.js';
import { verifyProgressIndexes } from '../src/modules/progress/progress.repository.js';
const now = new Date('2026-10-19T00:00:00.000Z');
const record = {
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(),
  conceptId: new Types.ObjectId(),
  technologyId: new Types.ObjectId(),
  learningPathId: new Types.ObjectId(),
  moduleId: new Types.ObjectId(),
  topicId: new Types.ObjectId(),
  attemptCount: 1,
  status: 'IN_PROGRESS' as const,
  startedAt: now,
  lastActivityAt: now,
  createdAt: now,
  updatedAt: now,
  schemaVersion: 1 as const,
};
test('strict activity record has no score, mastery, completion or answer fields', () => {
  const row = new StudentProgress(record).toObject();
  assert.deepEqual(Object.keys(row).sort(), Object.keys(record).sort());
  for (const patch of [
    { attemptCount: 0 },
    { attemptCount: 1.5 },
    { attemptCount: '1' },
    { attemptCount: Number.MAX_SAFE_INTEGER + 1 },
    { status: 'COMPLETED' },
    { schemaVersion: 2 },
    { userId: 'a'.repeat(24) },
    { startedAt: new Date(NaN) },
    { startedAt: new Date(now.getTime() + 1) },
    { updatedAt: new Date(now.getTime() - 1) },
    { answer: 'PRIVATE' },
    { score: null },
    { mastery: null },
    { sections: {} },
  ])
    assert.throws(() => progressRecord.parse({ ...record, ...patch }));
  assert.equal(StudentProgress.schema.get('autoIndex'), false);
  assert.equal(StudentProgress.schema.get('autoCreate'), false);
  assert.deepEqual(StudentProgress.schema.indexes(), [
    [progressIndex.key, { name: progressIndex.name, unique: true }],
  ]);
});
test('full unique owner/Concept index must be verifiable, ordered, exact and unrestricted', () => {
  const valid = { ...progressIndex, v: 2 };
  verifyProgressIndexes([{ v: 2, name: '_id_', key: { _id: 1 } }, valid]);
  for (const patch of [
    { v: undefined },
    { v: 1 },
    { unique: false },
    { unique: undefined },
    { key: { conceptId: 1, userId: 1 } },
    { name: 'wrong' },
    { sparse: true },
    { partialFilterExpression: {} },
    { hidden: true },
    { expireAfterSeconds: 1 },
    { collation: { locale: 'en' } },
    { background: true },
  ]) {
    assert.throws(() => verifyProgressIndexes([{ ...valid, ...patch }]), {
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  }
  assert.throws(() => verifyProgressIndexes([]));
  assert.throws(() => verifyProgressIndexes([valid, valid]));
});
test('supported mutation methods refuse identity/update/delete bypasses without a connection', async () => {
  const doc = new StudentProgress(record);
  doc.isNew = false;
  await assert.rejects(doc.save(), /owned progress repository/);
  await assert.rejects(
    StudentProgress.updateOne(
      { _id: record._id },
      { $set: { userId: new Types.ObjectId() } },
    ),
    /owned progress repository/,
  );
  await assert.rejects(
    StudentProgress.deleteMany({}),
    /owned progress repository/,
  );
  assert.equal(StudentProgress.db.readyState, 0);
});

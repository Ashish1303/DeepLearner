import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  PracticeAttempt,
  attemptRecord,
  practiceAttemptSchema,
  attemptIndexes,
} from '../src/modules/practice/practice-attempt.model.js';
const record = () => ({
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(),
  questionId: new Types.ObjectId(),
  conceptId: new Types.ObjectId(),
  type: 'CODING' as const,
  questionRevision: 'a'.repeat(64),
  contentFingerprint: 'b'.repeat(64),
  attemptNumber: 1,
  studentAnswer: '\t code\n ',
  submittedAt: new Date('2026-10-18T00:00:00.000Z'),
  result: 'SUBMITTED' as const,
  score: null,
  idempotencyKeyHash: 'c'.repeat(64),
  requestFingerprint: 'd'.repeat(64),
  schemaVersion: 1 as const,
});
test('attempt model preserves ungraded private verbatim data without defaults or coercion', async () => {
  for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'] as const) {
    const value = { ...record(), type },
      model = new PracticeAttempt(value);
    await model.validate();
    assert.equal(model.studentAnswer, value.studentAnswer);
    assert.equal(model.score, null);
    assert.equal(model.result, 'SUBMITTED');
    assert.deepEqual(
      Object.keys(model.toObject()).sort(),
      Object.keys(value).sort(),
    );
  }
});
test('attempt strict record rejects missing, extra, coerced, forged and oversized values', () => {
  const value = record();
  for (const patch of [
    { score: 0 },
    { score: undefined },
    { result: 'PASS' },
    { userId: value.userId.toHexString() },
    { studentAnswer: ' \n\t' },
    { studentAnswer: '😀'.repeat(5001) },
    { attemptNumber: 0 },
    { attemptNumber: Number.MAX_SAFE_INTEGER + 1 },
    { attemptNumber: '1' },
    { submittedAt: '2026-10-18' },
    { submittedAt: new Date('invalid') },
    { contentFingerprint: 'A'.repeat(64) },
    { idempotencyKeyHash: 'x' },
    { schemaVersion: 2 },
    { answer: 'secret' },
  ])
    assert.equal(
      attemptRecord.safeParse({ ...value, ...patch }).success,
      false,
    );
  assert(
    attemptRecord.safeParse({ ...value, studentAnswer: '😀'.repeat(5000) })
      .success,
  );
  assert.throws(
    () =>
      new PracticeAttempt(
        Object.defineProperty({ ...value }, 'studentAnswer', {
          get() {
            throw Error('accessed');
          },
        }),
      ),
    /Invalid attempt input/,
  );
});
test('supported document mutation and query/bulk paths are insert-only before DB access', async () => {
  const model = new PracticeAttempt(record());
  model.isNew = false;
  await assert.rejects(model.save(), /insert-only/);
  await assert.rejects(model.deleteOne(), /insert-only/);
  for (const work of [
    () => PracticeAttempt.updateOne({}, { $set: { score: 1 } }),
    () => PracticeAttempt.updateMany({}, {}),
    () => PracticeAttempt.replaceOne({}, record()),
    () => PracticeAttempt.findOneAndUpdate({}, {}),
    () => PracticeAttempt.findOneAndReplace({}, record()),
    () => PracticeAttempt.deleteOne({}),
    () => PracticeAttempt.deleteMany({}),
    () => PracticeAttempt.findOneAndDelete({}),
    () => PracticeAttempt.bulkWrite([]),
    () => PracticeAttempt.insertMany([record()]),
  ])
    await assert.rejects(async () => {
      await work();
    }, /insert-only/);
});
test('attempt schema declares full unique identities and disables implicit collection/index creation', () => {
  assert.equal(practiceAttemptSchema.get('autoIndex'), false);
  assert.equal(practiceAttemptSchema.get('autoCreate'), false);
  assert.equal(practiceAttemptSchema.get('versionKey'), false);
  assert.deepEqual(
    practiceAttemptSchema.indexes().map(([key, options]) => ({
      key,
      name: options.name,
      unique: Boolean(options.unique),
    })),
    attemptIndexes,
  );
  for (const field of [
    'studentAnswer',
    'contentFingerprint',
    'requestFingerprint',
    'idempotencyKeyHash',
  ])
    assert.equal(practiceAttemptSchema.path(field).options.select, false);
});

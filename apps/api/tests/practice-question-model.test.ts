import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import {
  PracticeQuestion,
  practiceQuestionSchema,
} from '../src/modules/practice/practice-question.model.js';

function valid() {
  return {
    technologyId: new Types.ObjectId(),
    topicId: new Types.ObjectId(),
    conceptId: new Types.ObjectId(),
    createdBy: new Types.ObjectId(),
    updatedBy: new Types.ObjectId(),
    type: 'OUTPUT',
    difficulty: 'BEGINNER',
    prompt: ' Question ',
    answer: ' Answer ',
  };
}
async function accepts(input: unknown) {
  const doc = new PracticeQuestion(input);
  await doc.validate();
  return doc;
}
async function rejects(input: unknown) {
  await assert.rejects(
    async () => {
      await accepts(input);
    },
    (error: unknown) =>
      error instanceof Error &&
      ['ValidationError', 'CastError', 'StrictModeError'].includes(error.name),
  );
}

test('F030 defaults, trimmed authored text and absent optional fields', async () => {
  const doc = await accepts(valid());
  assert(doc._id instanceof Types.ObjectId);
  assert.equal(doc.prompt, 'Question');
  assert.equal(doc.answer, 'Answer');
  assert.equal(doc.status, 'DRAFT');
  assert.equal(doc.schemaVersion, 1);
  for (const key of ['explanation', 'starterCode', 'language'])
    assert(!Object.hasOwn(doc.toObject(), key));
  const full = await accepts({
    ...valid(),
    explanation: ' \n Explain\n  inside \n ',
    starterCode: ' \n const value = 1;\n ',
    language: 'JAVASCRIPT',
  });
  assert.equal(full.explanation, 'Explain\n  inside');
  assert.equal(full.starterCode, ' \n const value = 1;\n ');
});

test('F030 all required fields reject absence/null and no fabricated defaults', async () => {
  for (const key of [
    'technologyId',
    'topicId',
    'conceptId',
    'createdBy',
    'updatedBy',
    'type',
    'difficulty',
    'prompt',
    'answer',
  ])
    for (const value of [undefined, null])
      await rejects({ ...valid(), [key]: value });
  for (const key of ['status', 'schemaVersion', '_id'])
    await rejects({ ...valid(), [key]: null });
  await rejects(undefined);
});

test('F030 exact text boundaries, trimmed lengths, whitespace and invalid scalar types', async () => {
  for (const key of ['prompt', 'answer', 'explanation', 'starterCode']) {
    const base = { ...valid(), language: 'TYPESCRIPT' };
    for (const value of ['x', 'x'.repeat(50000)])
      await accepts({ ...base, [key]: value });
    for (const value of [
      '',
      ' \t\n ',
      'x'.repeat(50001),
      1,
      true,
      [],
      {},
      new String('x'),
    ])
      await rejects({ ...base, [key]: value });
    if (key !== 'starterCode') {
      const doc = await accepts({
        ...base,
        [key]: ' ' + 'x'.repeat(50000) + ' ',
      });
      assert.equal(String(doc.get(key)).length, 50000);
    } else await rejects({ ...base, [key]: ' ' + 'x'.repeat(50000) });
  }
});

test('F030 nullable code/language only; optional explanation null is rejected', async () => {
  const doc = await accepts({ ...valid(), starterCode: null, language: null });
  assert.equal(doc.starterCode, null);
  assert.equal(doc.language, null);
  await rejects({ ...valid(), explanation: null });
});

test('F030 question context code is allowed across all types with both supported languages', async () => {
  for (const type of ['CODING', 'OUTPUT', 'DESCRIPTIVE', 'SCENARIO']) {
    await accepts({ ...valid(), type });
    for (const language of ['JAVASCRIPT', 'TYPESCRIPT']) {
      await accepts({ ...valid(), type, language });
      await accepts({
        ...valid(),
        type,
        language,
        starterCode: ' \n<script>inert()</script>\n ',
      });
    }
    for (const language of [undefined, null])
      await rejects({
        ...valid(),
        type,
        starterCode: 'const x = 1;',
        language,
      });
  }
});

test('F030 canonical enums and version reject aliases, case normalization and coercion', async () => {
  for (const difficulty of [
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'INTERVIEW_READY',
  ])
    await accepts({ ...valid(), difficulty });
  for (const status of [
    'DRAFT',
    'AI_GENERATED',
    'IN_REVIEW',
    'CHANGES_REQUIRED',
    'APPROVED',
    'PUBLISHED',
    'ARCHIVED',
  ])
    await accepts({ ...valid(), status });
  for (const key of ['type', 'difficulty', 'status', 'language'])
    for (const value of ['', ' ', 1, false, [], {}, 'invalid'])
      await rejects({ ...valid(), [key]: value });
  for (const type of ['OUTPUT_BASED', 'SCENARIO_BASED', 'output', ' OUTPUT'])
    await rejects({ ...valid(), type });
  for (const language of ['PYTHON', 'javascript', ' JAVASCRIPT'])
    await rejects({ ...valid(), language });
  for (const schemaVersion of ['1', 0, 2, 1.5, NaN, Infinity, null, true])
    await rejects({ ...valid(), schemaVersion });
});

test('F030 strict ObjectId references and explicit primary IDs', async () => {
  for (const key of [
    '_id',
    'technologyId',
    'topicId',
    'conceptId',
    'createdBy',
    'updatedBy',
  ]) {
    const id = new Types.ObjectId();
    const doc = await accepts({
      ...valid(),
      [key]: id.toHexString().toUpperCase(),
    });
    assert.equal(String(doc.get(key)), id.toHexString());
    for (const value of [
      '',
      'a'.repeat(12),
      'a'.repeat(23),
      'a'.repeat(25),
      'g'.repeat(24),
      id.toHexString() + '\n',
      ' ' + id,
      1,
      true,
      [],
      Buffer.alloc(12),
      { toString: () => id.toHexString() },
    ])
      await rejects({ ...valid(), [key]: value });
  }
});

test('F030 rejects unknown/nested/evaluation fields and unsafe containers without invoking getters', async () => {
  for (const key of [
    'evaluation',
    'rubric',
    'source',
    'title',
    'order',
    'unknown',
    '__proto__',
    'constructor',
  ])
    await rejects({ ...valid(), [key]: {} });
  await rejects({ ...valid(), [Symbol('extra')]: 1 });
  for (const input of [
    null,
    [],
    new Date(),
    Object.assign(Object.create({ inherited: true }), valid()),
  ])
    await rejects(input);
  let calls = 0;
  const accessor = Object.defineProperty(valid(), 'prompt', {
    get() {
      calls++;
      return 'text';
    },
  });
  await rejects(accessor);
  assert.equal(calls, 0);
  await accepts(Object.assign(Object.create(null), valid()));
});

test('F030 validated document mutations enforce code/language and required answers', async () => {
  const doc = await accepts({
    ...valid(),
    starterCode: 'x',
    language: 'JAVASCRIPT',
  });
  doc.language = null;
  await assert.rejects(doc.validate(), /language/);
  doc.language = 'TYPESCRIPT';
  await doc.validate();
  doc.set('answer', undefined);
  await assert.rejects(doc.validate(), /answer/);
  assert.throws(() => doc.set('evaluation', {}), /strict/i);
});

test('F030 date inputs are genuine valid Dates; validation performs no timestamp writes', async () => {
  const now = new Date('2030-01-01T00:00:00Z');
  const doc = await accepts({ ...valid(), createdAt: now, updatedAt: now });
  assert.deepEqual(doc.createdAt, now);
  assert.deepEqual(doc.updatedAt, now);
  for (const key of ['createdAt', 'updatedAt'])
    for (const value of [null, '2030-01-01', 123, new Date(NaN), {}])
      await rejects({ ...valid(), [key]: value });
  const unsaved = await accepts(valid());
  assert.equal(unsaved.createdAt, undefined);
});

test('F030 default projection is defensive, not serialization or answer authorization', async () => {
  for (const key of ['answer', 'explanation'])
    assert.equal(practiceQuestionSchema.path(key).options.select, false);
  const doc = await accepts({ ...valid(), explanation: 'Explanation' });
  assert.equal(doc.toObject().answer, 'Answer');
  assert.equal(doc.toJSON().explanation, 'Explanation');
  assert.deepEqual(
    PracticeQuestion.find().select('+answer +explanation').projection(),
    { '+answer': 1, '+explanation': 1 },
  );
});

test('F030 exact nonunique indexes, collection identity and no automatic database work', () => {
  assert.deepEqual(
    practiceQuestionSchema.indexes().map(([key]) => key),
    [
      { conceptId: 1, status: 1, difficulty: 1 },
      { technologyId: 1, type: 1, status: 1 },
    ],
  );
  for (const [, options] of practiceQuestionSchema.indexes()) {
    assert(!options.unique);
    assert.equal(options.expireAfterSeconds, undefined);
  }
  assert.equal(PracticeQuestion.collection.name, 'practiceQuestions');
  assert.equal(practiceQuestionSchema.options.timestamps, true);
  for (const key of ['autoCreate', 'autoIndex', 'bufferCommands'] as const)
    assert.equal(practiceQuestionSchema.options[key], false);
  assert.equal(practiceQuestionSchema.options.strict, 'throw');
  assert.equal(mongoose.connection.readyState, 0);
});

test('F030 validated saves generate timestamps and reject invalid writes before mocked persistence', async (t) => {
  const inserted: Record<string, unknown>[] = [];
  t.mock.method(
    PracticeQuestion.collection,
    'insertOne',
    async (doc: Record<string, unknown>) => {
      inserted.push(doc);
      return { acknowledged: true, insertedId: doc._id };
    },
  );
  const doc = await new PracticeQuestion(valid()).save();
  assert.equal(inserted.length, 1);
  assert(doc.createdAt instanceof Date && doc.updatedAt instanceof Date);
  assert.equal(inserted[0]?.__v, 0);
  for (const patch of [
    { answer: undefined },
    { evaluation: {} },
    { starterCode: 'inert code', language: null },
    { prompt: 3 },
  ])
    await assert.rejects(async () => {
      await new PracticeQuestion({ ...valid(), ...patch }).save();
    });
  assert.equal(inserted.length, 1);
  const updates: Record<string, unknown>[] = [];
  t.mock.method(
    PracticeQuestion.collection,
    'updateOne',
    async (_filter: unknown, update: Record<string, unknown>) => {
      updates.push(update);
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    },
  );
  // Simulates a normally projected stored document. Real projection is separately gated.
  const projected = PracticeQuestion.hydrate(
    { ...valid(), _id: new Types.ObjectId(), answer: undefined },
    { answer: 0, explanation: 0 },
  );
  projected.prompt = 'Updated';
  await projected.save();
  assert.equal(updates.length, 1);
  assert(!JSON.stringify(updates).includes('answer'));
  assert(!JSON.stringify(updates).includes('explanation'));
  assert.equal(mongoose.connection.readyState, 0);
});

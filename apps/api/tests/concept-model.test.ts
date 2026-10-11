import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  Concept,
  conceptSchema,
} from '../src/modules/concepts/concept.model.js';
function valid() {
  return {
    technologyId: new Types.ObjectId(),
    learningPathId: new Types.ObjectId(),
    moduleId: new Types.ObjectId(),
    topicId: new Types.ObjectId(),
    title: ' Synthetic ',
    slug: 'synthetic',
    difficulty: 'BEGINNER',
    read: {
      summary: ' Summary ',
      bodyMarkdown: '  code\n\n<script>untrusted</script>\n',
    },
    source: {
      label: ' Source ',
      url: 'https://example.invalid/reference',
      sourceType: 'OFFICIAL_OR_TRUSTED',
      isOfficial: false,
    },
    createdBy: new Types.ObjectId(),
    updatedBy: new Types.ObjectId(),
  };
}
test('concept defaults, exact Markdown preservation, lifecycle and difficulty contracts', () => {
  const input = valid();
  const doc = new Concept(input);
  assert.equal(doc.validateSync(), undefined);
  assert.equal(doc.title, 'Synthetic');
  assert.equal(doc.read.summary, 'Summary');
  assert.equal(doc.source.label, 'Source');
  assert.equal(doc.read.bodyMarkdown, input.read.bodyMarkdown);
  assert.equal(doc.source.isOfficial, false);
  assert.equal(doc.status, 'DRAFT');
  assert.equal(doc.order, 0);
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.contentFormat, 'MARKDOWN');
  assert(!('_id' in doc.toObject().read));
  assert(!('_id' in doc.toObject().source));
  for (const status of [
    'DRAFT',
    'AI_GENERATED',
    'IN_REVIEW',
    'CHANGES_REQUIRED',
    'APPROVED',
    'PUBLISHED',
    'ARCHIVED',
  ])
    assert.equal(new Concept({ ...valid(), status }).validateSync(), undefined);
  for (const difficulty of [
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'INTERVIEW_READY',
  ])
    assert.equal(
      new Concept({ ...valid(), difficulty }).validateSync(),
      undefined,
    );
});
test('concept model rejects independent required, bound, slug and enum violations', () => {
  for (const [field, values] of Object.entries({
    technologyId: [undefined, 'bad'],
    learningPathId: [undefined, 'bad'],
    moduleId: [undefined, 'bad'],
    topicId: [undefined, 'bad'],
    createdBy: [undefined, 'bad'],
    updatedBy: [undefined, 'bad'],
    title: ['', '   ', 'x'.repeat(121)],
    slug: [
      '',
      'Upper',
      'two--parts',
      '-first',
      'last-',
      'ok\n',
      'x'.repeat(101),
    ],
    difficulty: [undefined, 'OTHER'],
    status: ['OTHER'],
    contentFormat: ['HTML'],
    schemaVersion: [0, 2, 1.5],
    order: [-1, 0.1, Number.MAX_SAFE_INTEGER + 1],
    read: [undefined],
    source: [undefined],
  })) {
    for (const value of values) {
      const error = new Concept({ ...valid(), [field]: value }).validateSync();
      assert(error?.errors[field], field);
    }
  }
  assert.equal(
    new Concept({
      ...valid(),
      title: 'x'.repeat(120),
      slug: 'x'.repeat(100),
      order: Number.MAX_SAFE_INTEGER,
    }).validateSync(),
    undefined,
  );
});
test('concept nested Read bounds and nonblank body are enforced independently', () => {
  for (const [field, values] of Object.entries({
    summary: [undefined, '', '  ', 'x'.repeat(2001)],
    bodyMarkdown: [undefined, '', ' \n\t', 'x'.repeat(50001)],
  }))
    for (const value of values) {
      const input = valid();
      const error = new Concept({
        ...input,
        read: { ...input.read, [field]: value },
      }).validateSync();
      assert(error?.errors['read.' + field], field);
    }
  assert.equal(
    new Concept({
      ...valid(),
      read: { summary: 'x'.repeat(2000), bodyMarkdown: 'x'.repeat(50000) },
    }).validateSync(),
    undefined,
  );
});
test('concept source requires explicit metadata and HTTPS without credentials', () => {
  for (const [field, values] of Object.entries({
    label: [undefined, '', '   ', 'x'.repeat(121)],
    url: [
      undefined,
      '',
      'http://example.invalid',
      '/relative',
      'https:example.invalid',
      'javascript:alert(1)',
      'https://user:pass@example.invalid',
      'https://user@example.invalid',
      'https://example.invalid/\n',
      'https://example.invalid/' + 'x'.repeat(2048),
    ],
    sourceType: [undefined, 'OTHER'],
    isOfficial: [undefined, null, 'not-boolean'],
  }))
    for (const value of values) {
      const input = valid();
      const error = new Concept({
        ...input,
        source: { ...input.source, [field]: value },
      }).validateSync();
      assert(error?.errors['source.' + field], field);
    }
  const prefix = 'https://example.invalid/';
  assert.equal(
    new Concept({
      ...valid(),
      source: {
        ...valid().source,
        label: 'x'.repeat(120),
        url: prefix + 'x'.repeat(2048 - prefix.length),
        isOfficial: true,
      },
    }).validateSync(),
    undefined,
  );
});
test('concept strict schemas exclude deferred fields and nested internal fields', () => {
  for (const field of [
    'completionRules',
    'examples',
    'revise',
    'previousPublishedSnapshot',
    'publishedAt',
    'publishedBy',
  ])
    assert.throws(() => new Concept({ ...valid(), [field]: {} }), {
      name: 'StrictModeError',
    });
  for (const field of ['read', 'source'] as const) {
    const input = valid();
    const doc = new Concept({
      ...input,
      [field]: { ...input[field], unexpected: true },
    });
    assert(doc.validateSync()?.errors[field]);
  }
});
test('concept indexes, ownership references and offline-safe model settings match the approved contract', () => {
  assert.deepEqual(conceptSchema.indexes(), [
    [{ topicId: 1, slug: 1 }, { unique: true }],
    [{ topicId: 1, status: 1, order: 1, slug: 1 }, {}],
  ]);
  assert.equal(Concept.collection.name, 'concepts');
  assert.equal(conceptSchema.options.strict, 'throw');
  assert.equal(conceptSchema.options.autoCreate, false);
  assert.equal(conceptSchema.options.autoIndex, false);
  assert.equal(conceptSchema.options.bufferCommands, false);
  assert.equal(conceptSchema.options.timestamps, true);
  assert.equal(conceptSchema.options.versionKey, '__v');
  for (const [field, ref] of Object.entries({
    technologyId: 'Technology',
    learningPathId: 'LearningPath',
    moduleId: 'Module',
    topicId: 'Topic',
    createdBy: 'User',
    updatedBy: 'User',
  }))
    assert.equal(conceptSchema.path(field).options.ref, ref);
});

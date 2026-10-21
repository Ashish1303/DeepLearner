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

test('F025 source preserves approved URL spellings, exact bounds and legacy metadata', () => {
  const prefix = 'https://example.invalid/';
  for (const url of [
    'https://example.invalid',
    'HTTPS://EXAMPLE.invalid/Guide?q=one%20two&lang=ts#part',
    'https://example.invalid:8443/a%2Fb?next=%2Fdocs#intro',
    'https://bücher.example/über',
    'https://127.0.0.1:8443/docs',
    'https://[::1]/docs',
    prefix + 'x'.repeat(2048 - prefix.length),
  ])
    for (const isOfficial of [false, true]) {
      const input = valid();
      const doc = new Concept({
        ...input,
        source: { ...input.source, url, isOfficial },
      });
      assert.equal(doc.validateSync(), undefined);
      assert.deepEqual(doc.toObject().source, {
        ...input.source,
        label: 'Source',
        url,
        isOfficial,
      });
      assert.equal(doc.examples, undefined);
      assert.equal(doc.revise, undefined);
    }
  for (const label of [' x ', ' ' + 'x'.repeat(120) + ' ']) {
    const doc = new Concept({
      ...valid(),
      source: { ...valid().source, label },
    });
    assert.equal(doc.validateSync(), undefined);
    assert.equal(doc.source.label, label.trim());
  }
});

test('F025 source rejects coercion, malformed containers and unknown fields', () => {
  for (const source of [undefined, null, '', 1, true, [], [valid().source]])
    assert(new Concept({ ...valid(), source }).validateSync()?.errors.source);
  for (const field of ['label', 'url', 'sourceType', 'isOfficial']) {
    const values: unknown[] = [undefined, null, 1, 0, {}, []];
    if (field === 'isOfficial') values.push('true', 'false', 'yes', 'no');
    else values.push(true, false, { toString: () => valid().source.label });
    for (const value of values) {
      const error = new Concept({
        ...valid(),
        source: { ...valid().source, [field]: value },
      }).validateSync();
      assert(error?.errors['source.' + field], field);
    }
  }
  for (const extra of ['_id', 'verified', 'unexpected'])
    assert(
      new Concept({
        ...valid(),
        source: { ...valid().source, [extra]: true },
      }).validateSync()?.errors.source,
    );
});

test('F025 source rejects unsafe raw URL spellings without URL repair', () => {
  const prefix = 'https://example.invalid/';
  for (const url of [
    'https://',
    'https://[bad',
    '//example.invalid',
    'https:example.invalid',
    'http://example.invalid',
    'javascript:alert(1)',
    'data:text/plain,test',
    'https://user:pass@example.invalid',
    'https://:pass@example.invalid',
    ' https://example.invalid',
    'https://example.invalid ',
    'https://example.invalid/\\path',
    'https://example.invalid/\u0000x',
    'https://example.invalid/\u001fx',
    'https://example.invalid/\u007fx',
    prefix + 'x'.repeat(2049 - prefix.length),
  ])
    assert(
      new Concept({
        ...valid(),
        source: { ...valid().source, url },
      }).validateSync()?.errors['source.url'],
    );
});

test('revise preserves legacy absence, optional absence, ordered trim and exact Markdown without IDs', () => {
  const legacy = new Concept(valid());
  assert.equal(legacy.revise, undefined);
  assert(!Object.hasOwn(legacy.toObject(), 'revise'));
  const partial = new Concept({ ...valid(), revise: { summary: ' Summary ' } });
  assert.equal(partial.validateSync(), undefined);
  assert.deepEqual(partial.toObject().revise, { summary: 'Summary' });
  const revise = {
    summary: ' Summary ',
    keyPoints: [' Second ', ' First '],
    memoryTrick: ' Remember ',
    importantCodeMarkdown: '  ~~~js\nconst x = 1;\n~~~\n',
  };
  const doc = new Concept({ ...valid(), revise });
  assert.equal(doc.validateSync(), undefined);
  assert.deepEqual(doc.toObject().revise, {
    ...revise,
    summary: 'Summary',
    keyPoints: ['Second', 'First'],
    memoryTrick: 'Remember',
  });
});

test('revise accepts independent minimum and exact maximum field/count boundaries', () => {
  for (const revise of [
    { summary: 'x' },
    { summary: 'x'.repeat(2000) },
    { summary: 'x', keyPoints: [] },
    { summary: 'x', keyPoints: ['x'] },
    { summary: 'x', keyPoints: ['x'.repeat(500)] },
    { summary: 'x', keyPoints: Array.from({ length: 10 }, () => 'x') },
    { summary: 'x', memoryTrick: 'x' },
    { summary: 'x', memoryTrick: 'x'.repeat(2000) },
    { summary: 'x', importantCodeMarkdown: 'x' },
    { summary: 'x', importantCodeMarkdown: 'x'.repeat(10000) },
  ])
    assert.equal(new Concept({ ...valid(), revise }).validateSync(), undefined);
});

test('revise rejects independent malformed, null, coerced and over-limit fields', () => {
  for (const [field, values] of Object.entries({
    summary: [undefined, null, '', ' \n', 3, true, {}, [], 'x'.repeat(2001)],
    keyPoints: [
      null,
      'point',
      {},
      3,
      [null],
      [3],
      [true],
      [{}],
      [[]],
      [''],
      [' '],
      ['x'.repeat(501)],
      Array.from({ length: 11 }, () => 'x'),
    ],
    memoryTrick: [null, '', ' \n', 3, true, {}, [], 'x'.repeat(2001)],
    importantCodeMarkdown: [
      null,
      '',
      ' \n',
      3,
      true,
      {},
      [],
      'x'.repeat(10001),
    ],
  }))
    for (const value of values) {
      const error = new Concept({
        ...valid(),
        revise: { summary: 'Summary', [field]: value },
      }).validateSync();
      assert(
        error &&
          Object.keys(error.errors).some(
            (path) =>
              path === 'revise.' + field ||
              path.startsWith('revise.' + field + '.'),
          ),
        field + ': ' + String(JSON.stringify(value)).slice(0, 40),
      );
    }
});

test('revise rejects invalid containers and unknown nested fields', () => {
  for (const revise of [null, '', 3, true, [], [{ summary: 'x' }], {}])
    assert(new Concept({ ...valid(), revise }).validateSync());
  for (const field of ['_id', 'status', 'flashcards', 'unexpected'])
    assert(
      new Concept({
        ...valid(),
        revise: { summary: 'x', [field]: 'hidden' },
      }).validateSync()?.errors.revise,
    );
});
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

test('examples stay absent for legacy records and preserve bounded ordered Markdown without IDs', () => {
  const legacy = new Concept(valid());
  assert.equal(legacy.examples, undefined);
  assert(!Object.hasOwn(legacy.toObject(), 'examples'));
  const examples = [
    { title: ' First ', bodyMarkdown: '  # Body\n' },
    { title: 'Second', bodyMarkdown: 'Code' },
  ];
  const doc = new Concept({ ...valid(), examples });
  assert.equal(doc.validateSync(), undefined);
  assert.deepEqual(doc.toObject().examples, [
    { title: 'First', bodyMarkdown: '  # Body\n' },
    examples[1],
  ]);
  for (const accepted of [
    [],
    Array.from({ length: 10 }, () => ({
      title: 'x'.repeat(120),
      bodyMarkdown: 'x'.repeat(5000),
    })),
    Array.from({ length: 5 }, () => ({
      title: 'x',
      bodyMarkdown: 'x'.repeat(10000),
    })),
  ])
    assert.equal(
      new Concept({ ...valid(), examples: accepted }).validateSync(),
      undefined,
    );
});
test('examples reject independent field bounds, casts and missing values', () => {
  for (const [field, values] of Object.entries({
    title: [undefined, null, '', ' ', 123, 'x'.repeat(121)],
    bodyMarkdown: [undefined, null, '', ' \n', 123, 'x'.repeat(10001)],
  }))
    for (const value of values) {
      const error = new Concept({
        ...valid(),
        examples: [{ title: 'Example', bodyMarkdown: 'Body', [field]: value }],
      }).validateSync();
      assert(
        error?.errors['examples.0.' + field],
        field + ': ' + String(value).slice(0, 20),
      );
    }
});
test('examples reject nonarrays, null entries, extra fields, count and aggregate overflow', () => {
  for (const examples of [
    null,
    {},
    'bad',
    { title: 'Example', bodyMarkdown: 'Body' },
    [null],
    Array.from({ length: 11 }, () => ({ title: 'x', bodyMarkdown: 'b' })),
    Array.from({ length: 6 }, () => ({
      title: 'x',
      bodyMarkdown: 'x'.repeat(9000),
    })),
  ])
    assert(
      new Concept({ ...valid(), examples }).validateSync()?.errors.examples,
    );
  for (const field of ['_id', 'status', 'order', 'unexpected']) {
    const error = new Concept({
      ...valid(),
      examples: [{ title: 'x', bodyMarkdown: 'b', [field]: 'hidden' }],
    }).validateSync();
    assert(error?.errors.examples, field);
  }
});

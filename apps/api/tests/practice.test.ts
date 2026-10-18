import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  practiceQuery,
  practiceListRequest,
} from '../src/modules/practice/practice.schema.js';
import { practiceDto } from '../src/modules/practice/practice.dto.js';
import {
  practiceRepository,
  practiceStages,
} from '../src/modules/practice/practice.repository.js';
import { createPracticeService } from '../src/modules/practice/practice.service.js';
import { Concept } from '../src/modules/concepts/concept.model.js';
import { publishedConceptStages } from '../src/modules/concepts/concept.repository.js';
import type { UserDto } from '../src/modules/users/user.dto.js';
import { AppError } from '../src/common/errors/app-error.js';
const id = 'a'.repeat(24);
const query = { conceptId: id, page: 1, limit: 10, type: 'OUTPUT' as const };
const raw = {
  _id: new Types.ObjectId(),
  conceptId: new Types.ObjectId(id),
  type: 'OUTPUT',
  difficulty: 'BEGINNER',
  prompt: 'Predict',
  answer: 'SECRET',
  explanation: 'SECRET',
  evaluation: { secret: true },
};
const user: UserDto = {
  id,
  firstName: 'Synthetic',
  lastName: 'Student',
  email: 'student@example.invalid',
  role: 'STUDENT',
  status: 'ACTIVE',
  emailVerified: true,
  plan: 'FREE',
  profile: null,
  authMethods: ['PASSWORD'],
  createdAt: new Date().toISOString(),
};
test('strict query defaults, normalization, limits, duplicate/type rejection and GET body', () => {
  assert.deepEqual(practiceQuery.parse({ conceptId: id.toUpperCase() }), query);
  assert.equal(
    practiceQuery.parse({ conceptId: id, page: '2', limit: '20' }).limit,
    20,
  );
  for (const input of [
    {},
    { conceptId: id + '\n' },
    { conceptId: [id, id] },
    { conceptId: id, x: '1' },
    { conceptId: id, page: '01' },
    { conceptId: id, page: '1e2' },
    { conceptId: id, page: 1 },
    { conceptId: id, page: '9007199254740991' },
    { conceptId: id, limit: '21' },
    { conceptId: id, page: '0' },
    { conceptId: id, limit: ['1', '2'] },
  ])
    assert.equal(practiceQuery.safeParse(input).success, false);
  assert.equal(
    practiceListRequest.safeParse({ query: { conceptId: id }, params: {} })
      .success,
    true,
  );
  for (const body of [{}, null, [], 'x'])
    assert.equal(
      practiceListRequest.safeParse({
        query: { conceptId: id },
        params: {},
        body,
      }).success,
      false,
    );
});
test('DTO reconstructs exactly seven fields and preserves inert code without secrets', () => {
  const dto = practiceDto({
    ...raw,
    starterCode: ' \n<script>teaching</script>\n ',
    language: 'JAVASCRIPT',
  });
  assert.deepEqual(
    Object.keys(dto).sort(),
    [
      'id',
      'conceptId',
      'type',
      'difficulty',
      'prompt',
      'starterCode',
      'language',
    ].sort(),
  );
  assert.equal(dto.starterCode, ' \n<script>teaching</script>\n ');
  assert.equal(JSON.stringify(dto).includes('SECRET'), false);
  assert.equal(practiceDto(raw).starterCode, null);
  assert.equal(practiceDto(raw).language, null);
});
test('malformed projected values fail closed at exact text/type boundaries', () => {
  assert.equal(
    practiceDto({ ...raw, prompt: 'x'.repeat(50000) }).prompt.length,
    50000,
  );
  for (const patch of [
    { prompt: 'x'.repeat(50001) },
    { prompt: ' ' },
    { prompt: ' trim ' },
    { prompt: 1 },
    { conceptId: id + '\n' },
    { type: 'CODING' },
    { starterCode: 'code' },
    { starterCode: false },
    { language: 'PYTHON' },
    { difficulty: 'OTHER' },
  ])
    assert.throws(() => practiceDto({ ...raw, ...patch }));
});
test('question pipeline reuses all F021 stages and filters before safe projection/count/pagination', () => {
  const stages = practiceStages({ ...query, page: 3, limit: 20 });
  const prefix = publishedConceptStages(id);
  assert.deepEqual(stages.slice(0, prefix.length), prefix);
  const lookup = stages[prefix.length] as unknown as {
    $lookup: { pipeline: unknown[] };
  };
  assert.deepEqual(lookup.$lookup.pipeline, [
    {
      $match: {
        type: 'OUTPUT',
        status: 'PUBLISHED',
        schemaVersion: 1,
        $expr: {
          $and: [
            { $eq: ['$topicId', '$$topicId'] },
            { $eq: ['$technologyId', '$$technologyId'] },
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        conceptId: 1,
        type: 1,
        difficulty: 1,
        prompt: 1,
        starterCode: 1,
        language: 1,
      },
    },
    {
      $facet: {
        items: [{ $sort: { _id: 1 } }, { $skip: 40 }, { $limit: 20 }],
        count: [{ $count: 'total' }],
      },
    },
  ]);
});
test('current eligibility and token role precede content reads, preserving account errors', async () => {
  let reads = 0;
  let current = user;
  let accountError: AppError | undefined;
  const service = createPracticeService(
    {
      async list() {
        reads++;
        return { items: [], total: 0 };
      },
    },
    {
      async get() {
        if (accountError) throw accountError;
        return current;
      },
    },
  );
  await assert.rejects(service.list({ sub: id, role: 'ADMIN' }, query), {
    code: 'AUTH_FORBIDDEN',
  });
  for (const patch of [
    { role: 'ADMIN' },
    { id: 'b'.repeat(24) },
    { status: 'DISABLED' },
    { status: 'SUSPENDED' },
    { emailVerified: false },
  ]) {
    current = { ...user, ...patch } as UserDto;
    await assert.rejects(service.list({ sub: id, role: 'STUDENT' }, query));
  }
  for (const code of ['USER_NOT_FOUND', 'DEPENDENCY_UNAVAILABLE']) {
    accountError = new AppError(503, code, 'Safe');
    await assert.rejects(service.list({ sub: id, role: 'STUDENT' }, query), {
      code,
    });
  }
  assert.equal(reads, 0);
  accountError = undefined;
  for (const plan of ['FREE', 'PREMIUM'] as const) {
    current = { ...user, plan };
    assert.equal(
      (await service.list({ sub: id, role: 'STUDENT' }, query)).pagination
        .total,
      0,
    );
  }
  assert.equal(reads, 2);
});
test('hidden parents are indistinguishable and out-of-range metadata remains accurate', async () => {
  const users = {
    async get() {
      return user;
    },
  };
  await assert.rejects(
    createPracticeService(
      {
        async list() {
          return null;
        },
      },
      users,
    ).list({ sub: id, role: 'STUDENT' }, query),
    { code: 'CONCEPT_NOT_FOUND' },
  );
  assert.deepEqual(
    (
      await createPracticeService(
        {
          async list() {
            return { items: [], total: 11 };
          },
        },
        users,
      ).list({ sub: id, role: 'STUDENT' }, { ...query, page: 3 })
    ).pagination,
    { page: 3, limit: 10, total: 11, totalPages: 2 },
  );
});
test('repository handles absent parents, legacy optional values and sanitized invalid records', async (t) => {
  const aggregate = t.mock.method(Concept, 'aggregate', () => ({
    exec: async (): Promise<unknown[]> => [
      { questions: [{ items: [raw], count: [{ total: 1 }] }] },
    ],
  }));
  assert.equal(
    (await practiceRepository.list(query))?.items[0]?.language,
    null,
  );
  aggregate.mock.mockImplementation(() => ({ exec: async () => [] }));
  assert.equal(await practiceRepository.list(query), null);
  aggregate.mock.mockImplementation(() => ({
    exec: async () => [
      {
        questions: [{ items: [{ ...raw, prompt: 42 }], count: [{ total: 1 }] }],
      },
    ],
  }));
  await assert.rejects(
    practiceRepository.list(query),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === 'DEPENDENCY_UNAVAILABLE' &&
      !error.message.includes('SECRET'),
  );
});

test('F032 canonical type defaults, strict inputs, descriptive projection and shared ancestry', () => {
  for (const type of ['OUTPUT', 'DESCRIPTIVE'] as const) {
    const q = practiceQuery.parse({ conceptId: id, type });
    assert.equal(q.type, type);
    const stages = practiceStages(q);
    const prefix = publishedConceptStages(id);
    assert.deepEqual(stages.slice(0, prefix.length), prefix);
    assert.equal(
      (
        stages[prefix.length] as unknown as {
          $lookup: { pipeline: { $match: { type: string } }[] };
        }
      ).$lookup.pipeline[0]!.$match.type,
      type,
    );
    const value = practiceDto({ ...raw, type });
    assert.equal(value.type, type);
    assert.equal(Object.keys(value).length, 7);
    assert.doesNotMatch(
      JSON.stringify(value),
      /SECRET|answer|explanation|evaluation/,
    );
  }
  for (const type of [
    '',
    'output',
    ' DESCRIPTIVE',
    'DESCRIPTIVE\n',
    'CODING',
    'SCENARIO',
    'OUTPUT_BASED',
    null,
    1,
    {},
    ['OUTPUT'],
    ['OUTPUT', 'DESCRIPTIVE'],
  ])
    assert.equal(
      practiceQuery.safeParse({ conceptId: id, type }).success,
      false,
    );
});
test('F032 repository rejects a valid DTO of the wrong requested type', async (t) => {
  t.mock.method(Concept, 'aggregate', () => ({
    exec: async () => [
      { questions: [{ items: [raw], count: [{ total: 1 }] }] },
    ],
  }));
  await assert.rejects(
    practiceRepository.list({ ...query, type: 'DESCRIPTIVE' }),
    { code: 'DEPENDENCY_UNAVAILABLE' },
  );
});

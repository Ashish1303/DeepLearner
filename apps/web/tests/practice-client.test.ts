import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPracticeClient } from '../src/lib/api/practice-client';
import { practiceEnvelope } from '../src/lib/practice/contracts';
const id = 'a'.repeat(24);
const item = {
  id,
  conceptId: id,
  type: 'OUTPUT',
  difficulty: 'BEGINNER',
  prompt: 'Predict',
  starterCode: '  const x = "<script>";\n',
  language: 'JAVASCRIPT',
};
const body = () => ({
  success: true,
  message: null,
  data: [{ ...item }],
  meta: { requestId: 'test', page: 1, limit: 10, total: 1, totalPages: 1 },
});
const unlockBody = (
  type: 'OUTPUT' | 'DESCRIPTIVE' | 'SCENARIO' | 'CODING' = 'OUTPUT',
) => ({
  success: true,
  message: null,
  data: { id, conceptId: id, type, answer: 'Official', explanation: null },
  meta: { requestId: 'test' },
});
test('F035 POST preserves student formatting, private bearer and no-store for all four types', async () => {
  for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'] as const) {
    let calls = 0;
    const answer = '\t  const value = 1;\n\n ';
    const client = createPracticeClient(
      'http://localhost/api',
      async (url, init) => {
        calls++;
        assert.equal(
          String(url),
          'http://localhost/api/practice-questions/' + id + '/unlock',
        );
        assert.equal(init?.method, 'POST');
        assert.equal(init?.cache, 'no-store');
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.redirect, 'error');
        assert.deepEqual(init?.headers, {
          'Content-Type': 'application/json',
          Authorization: 'Bearer synthetic',
        });
        assert.deepEqual(JSON.parse(String(init?.body)), {
          conceptId: id,
          studentAnswer: answer,
        });
        return Response.json(unlockBody(type));
      },
    );
    assert.deepEqual(
      await client.unlock(
        id,
        id,
        answer,
        'synthetic',
        new AbortController().signal,
        type,
      ),
      unlockBody(type).data,
    );
    assert.equal(calls, 1);
  }
});
test('F035 unlock rejects bad inputs before fetch and strict response identity/allowlist violations', async () => {
  let calls = 0;
  const client = createPracticeClient('http://localhost', async () => {
    calls++;
    return Response.json(unlockBody());
  });
  const signal = new AbortController().signal;
  for (const answer of ['', ' \t\n', 'x'.repeat(10001), '😀'.repeat(5001)])
    await assert.rejects(
      client.unlock(id, id, answer, 'test', signal, 'OUTPUT'),
      { code: 'VALIDATION_ERROR' },
    );
  await assert.rejects(
    client.unlock(id, 'invalid', 'x', 'test', signal, 'OUTPUT'),
    { code: 'VALIDATION_ERROR' },
  );
  await assert.rejects(
    client.unlock('invalid', id, 'x', 'test', signal, 'OUTPUT'),
    { code: 'VALIDATION_ERROR' },
  );
  assert.equal(calls, 0);
  const good = unlockBody();
  for (const raw of [
    { ...good, extra: true },
    { ...good, data: { ...good.data, studentAnswer: 'secret' } },
    { ...good, data: { ...good.data, id: 'b'.repeat(24) } },
    { ...good, data: { ...good.data, conceptId: 'b'.repeat(24) } },
    { ...good, data: { ...good.data, type: 'CODING' } },
    { ...good, data: { ...good.data, evaluation: {} } },
    { ...good, data: { ...good.data, answer: ' trim ' } },
    { ...good, data: { ...good.data, explanation: undefined } },
    { ...good, meta: { ...good.meta, total: 1 } },
    { ...good, data: { ...good.data, answer: 'x'.repeat(50001) } },
  ]) {
    const unsafe = createPracticeClient('http://localhost', async () =>
      Response.json(raw),
    );
    await assert.rejects(unsafe.unlock(id, id, 'x', 'test', signal, 'OUTPUT'), {
      code: 'INVALID_RESPONSE',
    });
  }
});
test('F035 unlock cancellation, deadline and safe errors do not retry or leak response messages', async () => {
  for (const before of [true, false]) {
    const cancel = new AbortController();
    let calls = 0;
    if (before) cancel.abort();
    const client = createPracticeClient('http://localhost', async () => {
      calls++;
      cancel.abort();
      return Response.json(unlockBody());
    });
    await assert.rejects(
      client.unlock(id, id, 'x', 'test', cancel.signal, 'OUTPUT'),
      { name: 'AbortError' },
    );
    assert.equal(calls, before ? 0 : 1);
  }
  const signal = new AbortController().signal;
  for (const [status, code] of [
    [401, 'AUTH_ACCESS_TOKEN_EXPIRED'],
    [403, 'AUTH_FORBIDDEN'],
    [404, 'CONCEPT_NOT_FOUND'],
    [404, 'ROUTE_NOT_FOUND'],
    [429, 'RATE_LIMIT_EXCEEDED'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
  ] as const) {
    let calls = 0;
    const client = createPracticeClient('http://localhost', async () => {
      calls++;
      return Response.json(
        {
          success: false,
          error: { code, message: 'SECRET' },
          meta: { requestId: 'test' },
        },
        { status },
      );
    });
    await assert.rejects(
      client.unlock(id, id, 'x', 'test', signal, 'OUTPUT'),
      (e) => e instanceof Error && !e.message.includes('SECRET'),
    );
    assert.equal(calls, 1);
  }
  const timeout = createPracticeClient(
    'http://localhost',
    async (_url, init) =>
      new Promise((_resolve, reject) =>
        init!.signal!.addEventListener('abort', () => reject(Error('timeout'))),
      ),
    1,
  );
  await assert.rejects(timeout.unlock(id, id, 'x', 'test', signal, 'OUTPUT'), {
    code: 'NETWORK_ERROR',
  });
});

test('F033 each requested type uses its own URL and rejects wrong-type or secret-bearing DTOs', async () => {
  const types = ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'] as const;
  for (const type of types) {
    let calls = 0;
    const signal = new AbortController().signal;
    const client = createPracticeClient(
      'http://localhost/api',
      async (input, init) => {
        calls++;
        const url = new URL(String(input));
        assert.equal(
          url.searchParams.get('type'),
          type === 'OUTPUT' ? null : type,
        );
        assert.equal(init?.body, undefined);
        assert.equal(init?.credentials, 'omit');
        return Response.json({ ...body(), data: [{ ...item, type }] });
      },
    );
    assert.equal(
      (await client.load(id, 1, 'synthetic', signal, type)).data[0]!.type,
      type,
    );
    assert.equal(calls, 1);
    for (const other of types.filter((value) => value !== type)) {
      const wrong = createPracticeClient('http://localhost/api', async () =>
        Response.json({ ...body(), data: [{ ...item, type: other }] }),
      );
      await assert.rejects(wrong.load(id, 1, 'synthetic', signal, type), {
        code: 'INVALID_RESPONSE',
      });
    }
    for (const field of ['answer', 'explanation', 'evaluation', 'createdBy']) {
      const unsafe = createPracticeClient('http://localhost/api', async () =>
        Response.json({
          ...body(),
          data: [{ ...item, type, [field]: 'SECRET' }],
        }),
      );
      await assert.rejects(unsafe.load(id, 1, 'synthetic', signal, type), {
        code: 'INVALID_RESPONSE',
      });
    }
  }
});

test('F033 canceled Scenario reads never fetch or accept a late parsed response', async () => {
  for (const before of [true, false]) {
    const abort = new AbortController();
    let calls = 0;
    if (before) abort.abort();
    const client = createPracticeClient('http://localhost/api', async () => {
      calls++;
      abort.abort();
      return Response.json({
        ...body(),
        data: [{ ...item, type: 'SCENARIO' }],
      });
    });
    await assert.rejects(
      client.load(id, 1, 'synthetic', abort.signal, 'SCENARIO'),
      { name: 'AbortError' },
    );
    assert.equal(calls, before ? 0 : 1);
  }
});

test('F034 Coding cancellation and nullable context keep the strict response contract', async () => {
  for (const before of [true, false]) {
    const abort = new AbortController();
    let calls = 0;
    if (before) abort.abort();
    const client = createPracticeClient('http://localhost/api', async () => {
      calls++;
      abort.abort();
      return Response.json({ ...body(), data: [{ ...item, type: 'CODING' }] });
    });
    await assert.rejects(
      client.load(id, 1, 'synthetic', abort.signal, 'CODING'),
      { name: 'AbortError' },
    );
    assert.equal(calls, before ? 0 : 1);
  }
  for (const language of [null, 'TYPESCRIPT'] as const) {
    const client = createPracticeClient('http://localhost/api', async () =>
      Response.json({
        ...body(),
        data: [{ ...item, type: 'CODING', starterCode: null, language }],
      }),
    );
    assert.equal(
      (
        await client.load(
          id,
          1,
          'synthetic',
          new AbortController().signal,
          'CODING',
        )
      ).data[0]!.starterCode,
      null,
    );
  }
});
test('practice GET uses fixed URL, private bearer, omitted cookies and no-store', async () => {
  let calls = 0;
  const client = createPracticeClient(
    'http://127.0.0.1:4000/api/v1',
    async (input, init) => {
      calls++;
      assert.equal(
        String(input),
        `http://127.0.0.1:4000/api/v1/practice-questions?conceptId=${id}&page=1&limit=10`,
      );
      assert.equal(init?.method, 'GET');
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.redirect, 'error');
      assert.deepEqual(init?.headers, { Authorization: 'Bearer synthetic' });
      assert.equal(init?.body, undefined);
      return Response.json(body());
    },
  );
  const result = await client.load(
    id,
    1,
    'synthetic',
    new AbortController().signal,
  );
  assert.equal(result.data[0]?.starterCode, item.starterCode);
  assert.equal(calls, 1);
});
test('client rejects secret keys, wrong identity, pagination/order and malformed contracts', async () => {
  const cases: unknown[] = [
    { ...body(), extra: 'SECRET' },
    { ...body(), data: [{ ...item, answer: 'SECRET' }] },
    { ...body(), data: [{ ...item, conceptId: 'b'.repeat(24) }] },
    { ...body(), meta: { ...body().meta, page: 2 } },
    { ...body(), meta: { ...body().meta, totalPages: 3 } },
    { ...body(), data: [item, item] },
    { ...body(), data: [{ ...item, starterCode: 1 }] },
    { ...body(), data: [{ ...item, prompt: ' ' }] },
    { ...body(), data: [{ ...item, starterCode: 'code', language: null }] },
  ];
  for (const value of cases) {
    const client = createPracticeClient('http://localhost/api', async () =>
      Response.json(value),
    );
    await assert.rejects(
      client.load(id, 1, 'synthetic', new AbortController().signal),
      { code: 'INVALID_RESPONSE' },
    );
  }
  assert.equal(
    practiceEnvelope.safeParse({
      ...body(),
      data: [],
      meta: { ...body().meta, total: 0, totalPages: 0 },
    }).success,
    true,
  );
});
test('external cancellation survives response parsing; timeout and unsafe bases fail safely', async () => {
  const abort = new AbortController();
  const client = createPracticeClient('http://localhost/api', async () => {
    abort.abort();
    return Response.json(body());
  });
  await assert.rejects(client.load(id, 1, 'secret', abort.signal), {
    name: 'AbortError',
  });
  for (const base of [
    'https://user:pass@host/api',
    'javascript:alert(1)',
    'https://host/api?x=1',
  ])
    assert.throws(() => createPracticeClient(base));
  const timeout = createPracticeClient(
    'http://localhost',
    async (_url, init) =>
      new Promise((_resolve, reject) =>
        init!.signal!.addEventListener('abort', () =>
          reject(new Error('aborted')),
        ),
      ),
    1,
  );
  await assert.rejects(
    timeout.load(id, 1, 'secret', new AbortController().signal),
    { code: 'NETWORK_ERROR' },
  );
});
test('client preserves auth and safe local error categories without server-message leakage', async () => {
  for (const [status, code] of [
    [401, 'AUTH_ACCESS_TOKEN_EXPIRED'],
    [403, 'AUTH_ACCOUNT_DISABLED'],
    [404, 'USER_NOT_FOUND'],
    [429, 'RATE_LIMIT_EXCEEDED'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
  ] as const) {
    const client = createPracticeClient('http://localhost', async () =>
      Response.json(
        {
          success: false,
          error: { code, message: 'SECRET' },
          meta: { requestId: 'test' },
        },
        { status },
      ),
    );
    await assert.rejects(
      client.load(id, 1, 'secret', new AbortController().signal),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === code &&
        !error.message.includes('SECRET'),
    );
  }
});

test('F032 descriptive request validates type and rejects mixed/wrong-type responses', async () => {
  let calls = 0;
  const client = createPracticeClient('http://localhost/api', async (url) => {
    calls++;
    assert.equal(new URL(String(url)).searchParams.get('type'), 'DESCRIPTIVE');
    return Response.json({
      ...body(),
      data: [{ ...item, type: 'DESCRIPTIVE' }],
    });
  });
  const signal = new AbortController().signal;
  assert.equal(
    (await client.load(id, 1, 'test', signal, 'DESCRIPTIVE')).data[0]!.type,
    'DESCRIPTIVE',
  );
  await assert.rejects(
    client.load(id, 1, 'test', signal, 'CODING_BASED' as 'OUTPUT'),
    { code: 'VALIDATION_ERROR' },
  );
  assert.equal(calls, 1);
  for (const requested of ['OUTPUT', 'DESCRIPTIVE'] as const) {
    const wrong = createPracticeClient('http://localhost/api', async () =>
      Response.json({
        ...body(),
        data: [
          { ...item, type: requested === 'OUTPUT' ? 'DESCRIPTIVE' : 'OUTPUT' },
        ],
      }),
    );
    await assert.rejects(wrong.load(id, 1, 'test', signal, requested), {
      code: 'INVALID_RESPONSE',
    });
  }
});

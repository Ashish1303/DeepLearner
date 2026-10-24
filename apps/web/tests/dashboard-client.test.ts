import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDashboardClient,
  DashboardError,
} from '../src/lib/api/dashboard-client';
import {
  dashboardData,
  dashboardEnvelope,
  parseDashboardPage,
} from '../src/lib/dashboard/contracts';

const id = (n: number) => n.toString(16).padStart(24, '0');
const at = '2026-10-24T00:00:00.000Z';
function item(n: number) {
  return {
    concept: {
      id: id(n),
      title: 'Concept',
      slug: 'concept',
      difficulty: 'BEGINNER',
    },
    activity: {
      conceptId: id(n),
      status: 'IN_PROGRESS',
      attemptCount: 2,
      startedAt: at,
      lastActivityAt: at,
    },
    mastery: {
      status: 'EVALUATED',
      result: { classification: 'STRONG', code: 'NONE' },
      unavailableCode: null,
    },
  };
}
const page = (items = [item(1)], nextCursor: string | null = null) => ({
  items,
  pagination: { limit: 5, nextCursor },
});
const envelope = (data: unknown = page()) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'offline-f041' },
});
const load = (raw: unknown, cursor: string | null = null) =>
  createDashboardClient('http://127.0.0.1:4000/api/v1', async () =>
    Response.json(raw),
  ).load(cursor, 'synthetic-token', new AbortController().signal);

test('GET sends only fixed page size and canonical cursor with memory-only Bearer transport', async () => {
  const calls: string[] = [];
  const client = createDashboardClient(
    'https://api.example.invalid/api/v1/',
    async (url, init) => {
      calls.push(String(url));
      assert.equal(init?.method, 'GET');
      assert.deepEqual(init.headers, {
        Authorization: 'Bearer synthetic-token',
      });
      assert.equal(init.body, undefined);
      assert.equal(init.credentials, 'omit');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.redirect, 'error');
      assert(init.signal instanceof AbortSignal);
      return Response.json(envelope(page([item(3)])));
    },
  );
  await client.load(null, 'synthetic-token', new AbortController().signal);
  await client.load(id(2), 'synthetic-token', new AbortController().signal);
  assert.deepEqual(calls, [
    'https://api.example.invalid/api/v1/dashboard?limit=5',
    'https://api.example.invalid/api/v1/dashboard?limit=5&cursor=' + id(2),
  ]);
});

test('empty and full continuation pages preserve only exact F040 fields', async () => {
  assert.deepEqual(await load(envelope(page([]))), page([]));
  const full = page([1, 2, 3, 4, 5].map(item), id(5));
  assert.deepEqual(await load(envelope(full)), full);
  assert.deepEqual(await load(envelope(page([])), id(5)), page([]));
});

for (const classification of ['WEAK', 'IMPROVING', 'STRONG']) {
  test(
    'trusted server band is preserved without calculating ' + classification,
    async () => {
      const row = item(1);
      row.mastery.result.classification = classification;
      assert.deepEqual(await load(envelope(page([row]))), page([row]));
    },
  );
}
for (const code of [
  'SCORE_MISSING',
  'STALE_ASSESSMENT',
  'REVOKED_ASSESSMENT',
]) {
  test('UNCLASSIFIED remains distinct for ' + code, async () => {
    const row = item(1);
    row.mastery.result = { classification: 'UNCLASSIFIED', code };
    assert.deepEqual(await load(envelope(page([row]))), page([row]));
  });
}
test('proven ordinary classification unavailability is not a fabricated band', async () => {
  const row = {
    ...item(1),
    mastery: {
      status: 'UNAVAILABLE',
      result: null,
      unavailableCode: 'LOCAL_QUALIFICATION_UNAVAILABLE',
    },
  };
  assert.deepEqual(await load(envelope({ ...page(), items: [row] })), {
    ...page(),
    items: [row],
  });
});

const malformed: Record<string, () => unknown> = {
  envelopePrivate: () => ({ ...envelope(), accessToken: 'PRIVATE' }),
  metaPrivate: () => ({
    ...envelope(),
    meta: { requestId: 'r', sessionId: id(1) },
  }),
  dataPrivate: () => envelope({ ...page(), userId: id(1) }),
  itemPrivate: () =>
    envelope({ ...page(), items: [{ ...item(1), answer: 'PRIVATE' }] }),
  conceptPrivate: () =>
    envelope({
      ...page(),
      items: [
        { ...item(1), concept: { ...item(1).concept, rubric: 'PRIVATE' } },
      ],
    }),
  activityPrivate: () =>
    envelope({
      ...page(),
      items: [{ ...item(1), activity: { ...item(1).activity, score: 100 } }],
    }),
  masteryPrivate: () =>
    envelope({
      ...page(),
      items: [{ ...item(1), mastery: { ...item(1).mastery, score: 100 } }],
    }),
  resultPrivate: () =>
    envelope({
      ...page(),
      items: [
        {
          ...item(1),
          mastery: {
            ...item(1).mastery,
            result: { classification: 'STRONG', code: 'NONE', score: 100 },
          },
        },
      ],
    }),
  wrongIdentity: () =>
    envelope({
      ...page(),
      items: [
        { ...item(1), activity: { ...item(1).activity, conceptId: id(2) } },
      ],
    }),
  duplicateIdentity: () => envelope(page([item(1), item(1)])),
  descending: () => envelope(page([item(2), item(1)])),
  uppercaseId: () =>
    envelope({
      ...page(),
      items: [
        { ...item(1), concept: { ...item(1).concept, id: 'A'.repeat(24) } },
      ],
    }),
  countString: () =>
    envelope({
      ...page(),
      items: [
        { ...item(1), activity: { ...item(1).activity, attemptCount: '2' } },
      ],
    }),
  zeroCount: () =>
    envelope({
      ...page(),
      items: [
        { ...item(1), activity: { ...item(1).activity, attemptCount: 0 } },
      ],
    }),
  nullTime: () =>
    envelope({
      ...page(),
      items: [
        { ...item(1), activity: { ...item(1).activity, startedAt: null } },
      ],
    }),
  reversedTime: () =>
    envelope({
      ...page(),
      items: [
        {
          ...item(1),
          activity: {
            ...item(1).activity,
            lastActivityAt: '2026-10-23T00:00:00.000Z',
          },
        },
      ],
    }),
  completed: () =>
    envelope({
      ...page(),
      items: [
        { ...item(1), activity: { ...item(1).activity, status: 'COMPLETED' } },
      ],
    }),
  shortContinuation: () => envelope(page([item(1)], id(1))),
  falseContinuation: () => envelope(page([1, 2, 3, 4, 5].map(item), id(6))),
  excessItems: () => envelope(page([1, 2, 3, 4, 5, 6].map(item))),
  otherLimit: () =>
    envelope({ ...page(), pagination: { limit: 1, nextCursor: null } }),
  classifiedRefusal: () =>
    envelope({
      ...page(),
      items: [
        {
          ...item(1),
          mastery: {
            ...item(1).mastery,
            result: { classification: 'STRONG', code: 'STALE_ASSESSMENT' },
          },
        },
      ],
    }),
  missingRefusal: () =>
    envelope({
      ...page(),
      items: [
        {
          ...item(1),
          mastery: {
            ...item(1).mastery,
            result: { classification: 'UNCLASSIFIED', code: 'NONE' },
          },
        },
      ],
    }),
  contradictoryAbsence: () =>
    envelope({
      ...page(),
      items: [
        {
          ...item(1),
          mastery: {
            status: 'UNAVAILABLE',
            result: { classification: 'WEAK', code: 'NONE' },
            unavailableCode: 'LOCAL_QUALIFICATION_UNAVAILABLE',
          },
        },
      ],
    }),
  unexpectedMessage: () => ({ ...envelope(), message: 'PRIVATE' }),
  titleWhitespace: () =>
    envelope({
      ...page(),
      items: [
        { ...item(1), concept: { ...item(1).concept, title: ' Concept' } },
      ],
    }),
  invalidSlug: () =>
    envelope({
      ...page(),
      items: [
        {
          ...item(1),
          concept: { ...item(1).concept, slug: 'javascript:private' },
        },
      ],
    }),
  missingItems: () => envelope({ pagination: { limit: 5, nextCursor: null } }),
};
for (const [name, raw] of Object.entries(malformed)) {
  test('strict response refuses ' + name, async () => {
    await assert.rejects(load(raw()), { code: 'INVALID_RESPONSE' });
  });
}

test('invalid inputs and unsafe URLs refuse before sending requests', async () => {
  let calls = 0;
  const client = createDashboardClient(
    'http://127.0.0.1:4000/api/v1',
    async () => {
      calls++;
      return Response.json(envelope());
    },
  );
  for (const cursor of ['', 'A'.repeat(24), 'bad', id(1) + '\n'])
    await assert.rejects(
      client.load(cursor, 't', new AbortController().signal),
      { code: 'VALIDATION_ERROR' },
    );
  for (const token of ['', 'x\r\ny', 'x'.repeat(4097)])
    await assert.rejects(
      client.load(null, token, new AbortController().signal),
      { code: 'VALIDATION_ERROR' },
    );
  assert.equal(calls, 0);
  for (const base of [
    'bad',
    'ftp://example.invalid',
    'https://user:password@example.invalid',
    'https://example.invalid?x=1',
    'https://example.invalid#x',
  ])
    assert.throws(() => createDashboardClient(base));
  for (const timeout of [0, -1, NaN, Infinity, 35001, 1.5])
    assert.throws(() =>
      createDashboardClient('https://example.invalid', fetch, timeout),
    );
});

test('cursor must move beyond the requested boundary, never repeat it', async () => {
  await assert.rejects(load(envelope(page([item(5)])), id(5)), {
    code: 'INVALID_RESPONSE',
  });
  await assert.rejects(load(envelope(page([item(4)])), id(5)), {
    code: 'INVALID_RESPONSE',
  });
  assert.throws(() => parseDashboardPage(page(), 'bad'));
});

for (const [status, code, kind] of [
  [401, 'AUTH_ACCESS_TOKEN_EXPIRED', 'denied'],
  [403, 'AUTH_FORBIDDEN', 'denied'],
  [404, 'ROUTE_NOT_FOUND', 'unavailable'],
  [503, 'DEPENDENCY_UNAVAILABLE', 'unavailable'],
  [429, 'RATE_LIMIT_EXCEEDED', 'rate-limited'],
  [500, 'INTERNAL_ERROR', 'error'],
] as const) {
  test(
    'sanitized HTTP ' +
      status +
      ' retains refusal without inventing empty activity',
    async () => {
      let calls = 0;
      const client = createDashboardClient(
        'https://example.invalid/api/v1',
        async () => {
          calls++;
          return Response.json(
            {
              success: false,
              error: {
                code,
                message: 'PRIVATE answer/token',
                details: { private: true },
              },
              meta: { requestId: 'r' },
            },
            { status },
          );
        },
      );
      await assert.rejects(
        client.load(null, 't', new AbortController().signal),
        (e) => {
          assert(e instanceof DashboardError);
          assert.equal(e.status, status);
          assert.equal(e.kind, kind);
          assert(!e.message.includes('PRIVATE'));
          assert(!JSON.stringify(e).includes('PRIVATE'));
          return true;
        },
      );
      assert.equal(calls, 1);
    },
  );
}

test('malformed error, redirect failure and non-200 success cannot authorize data', async () => {
  for (const status of [201, 401, 403, 404, 503]) {
    const client = createDashboardClient('https://example.invalid', async () =>
      Response.json({ private: true }, { status }),
    );
    await assert.rejects(client.load(null, 't', new AbortController().signal), {
      code: 'INVALID_RESPONSE',
    });
  }
  const client = createDashboardClient('https://example.invalid', async () => {
    throw Error('PRIVATE native failure');
  });
  await assert.rejects(client.load(null, 't', new AbortController().signal), {
    code: 'NETWORK_ERROR',
  });
});

test('pre-cancelled and body-time cancellation reject without retry or stale success', async () => {
  const signal = new AbortController();
  signal.abort();
  let calls = 0;
  const client = createDashboardClient('https://example.invalid', async () => {
    calls++;
    return Response.json(envelope());
  });
  await assert.rejects(client.load(null, 't', signal.signal), {
    name: 'AbortError',
  });
  assert.equal(calls, 0);
  const external = new AbortController();
  const response = Response.json(envelope());
  response.json = async () => {
    external.abort();
    return envelope();
  };
  const later = createDashboardClient(
    'https://example.invalid',
    async () => response,
  );
  await assert.rejects(later.load(null, 't', external.signal), {
    name: 'AbortError',
  });
});

test('in-flight external cancellation reaches transport and removes its listener', async () => {
  const signal = new AbortController();
  let additions = 0,
    removals = 0;
  const add = signal.signal.addEventListener.bind(signal.signal);
  const remove = signal.signal.removeEventListener.bind(signal.signal);
  signal.signal.addEventListener = (...args: Parameters<typeof add>) => {
    additions++;
    add(...args);
  };
  signal.signal.removeEventListener = (...args: Parameters<typeof remove>) => {
    removals++;
    remove(...args);
  };
  const client = createDashboardClient(
    'https://example.invalid',
    async (_url, init) => {
      signal.abort();
      assert(init?.signal?.aborted);
      throw new DOMException('Cancelled', 'AbortError');
    },
  );
  await assert.rejects(client.load(null, 't', signal.signal), {
    name: 'AbortError',
  });
  assert.equal(additions, 1);
  assert.equal(removals, 1);
});

test('timeout aborts once and late body success is refused even by an ignoring transport', async () => {
  let calls = 0;
  const client = createDashboardClient(
    'https://example.invalid',
    async (_url, init) => {
      calls++;
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    },
    5,
  );
  await assert.rejects(client.load(null, 't', new AbortController().signal), {
    code: 'NETWORK_ERROR',
  });
  assert.equal(calls, 1);
  const response = Response.json(envelope());
  response.json = async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
    return envelope();
  };
  await assert.rejects(
    createDashboardClient(
      'https://example.invalid',
      async () => response,
      5,
    ).load(null, 't', new AbortController().signal),
    { code: 'NETWORK_ERROR' },
  );
});

test('schema rejects invalid times/counts and accepts exact millisecond activity only', () => {
  assert(dashboardEnvelope.safeParse(envelope()).success);
  for (const count of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
    const row = item(1);
    row.activity.attemptCount = count;
    assert(!dashboardData.safeParse(page([row])).success);
  }
  for (const date of [
    '2026-10-24T00:00:00Z',
    '2026-10-24T00:00:00.000+00:00',
    'invalid',
  ]) {
    const row = item(1);
    row.activity.startedAt = date;
    assert(!dashboardData.safeParse(page([row])).success);
  }
});

test('default timeout is exactly 35 seconds and its timer is cleared after success', async (t) => {
  const delays: number[] = [];
  const handles: ReturnType<typeof setTimeout>[] = [];
  const nativeSet = setTimeout;
  const nativeClear = clearTimeout;
  t.mock.method(
    globalThis,
    'setTimeout',
    (...args: Parameters<typeof setTimeout>) => {
      delays.push(Number(args[1]));
      const handle = nativeSet(...args);
      handles.push(handle);
      return handle;
    },
  );
  let cleared = 0;
  t.mock.method(
    globalThis,
    'clearTimeout',
    (...args: Parameters<typeof clearTimeout>) => {
      if (args[0] === handles[0]) cleared++;
      return nativeClear(...args);
    },
  );
  await load(envelope());
  assert.deepEqual(delays, [35000]);
  assert.equal(cleared, 1);
});

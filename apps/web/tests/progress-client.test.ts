import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgressClient } from '../src/lib/api/progress-client';
import { progressData } from '../src/lib/progress/contracts';
const id = 'a'.repeat(24),
  base = 'http://127.0.0.1:4000/api/v1';
const data = {
  conceptId: id,
  status: 'NOT_STARTED' as const,
  attemptCount: 0,
  startedAt: null,
  lastActivityAt: null,
};
const envelope = (value: unknown = data) => ({
  success: true,
  data: value,
  message: null,
  meta: { requestId: 'test' },
});
test('progress GET sends only Concept with authenticated no-store bounded request', async () => {
  let calls = 0;
  const client = createProgressClient(base, async (url, init) => {
    calls++;
    assert.equal(url, base + '/progress?conceptId=' + id);
    assert.equal(init?.method, 'GET');
    assert.equal(init?.body, undefined);
    assert.deepEqual(init?.headers, { Authorization: 'Bearer synthetic' });
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    return Response.json(envelope());
  });
  assert.deepEqual(
    await client.load(id, 'synthetic', new AbortController().signal),
    data,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    client.load('bad', 'synthetic', new AbortController().signal),
  );
  assert.equal(calls, 1);
  for (const url of [
    'bad',
    'ftp://test.invalid',
    'https://name:password@example.invalid',
    'https://test.invalid?x=1',
  ])
    assert.throws(() => createProgressClient(url));
});
test('strict five-field progress and time/count invariants reject leakage or identity substitution', async () => {
  const at = '2026-10-19T00:00:00.000Z';
  assert(
    progressData.safeParse({
      ...data,
      status: 'IN_PROGRESS',
      attemptCount: 2,
      startedAt: at,
      lastActivityAt: at,
    }).success,
  );
  for (const value of [
    { ...data, answer: 'SECRET' },
    { ...data, attemptCount: 1 },
    { ...data, status: 'COMPLETED' },
    { ...data, status: 'IN_PROGRESS', attemptCount: 0 },
    { ...data, attemptCount: '0' },
    { ...data, userId: id },
    {
      ...data,
      status: 'IN_PROGRESS',
      attemptCount: 1,
      startedAt: at,
      lastActivityAt: '2026-10-18T00:00:00.000Z',
    },
  ])
    assert.equal(progressData.safeParse(value).success, false);
  for (const value of [
    { ...data, conceptId: 'b'.repeat(24) },
    { ...data, studentAnswer: 'SECRET' },
  ]) {
    await assert.rejects(
      createProgressClient(base, async () =>
        Response.json(envelope(value)),
      ).load(id, 't', new AbortController().signal),
      { code: 'INVALID_RESPONSE' },
    );
  }
});
test('sanitized error messages never echo raw server details or private data', async () => {
  const client = createProgressClient(base, async () =>
    Response.json(
      {
        success: false,
        data: null,
        message: null,
        meta: { requestId: 'r' },
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'PRIVATE submitted answer',
          details: null,
        },
      },
      { status: 503 },
    ),
  );
  await assert.rejects(
    client.load(id, 't', new AbortController().signal),
    (error) => {
      assert(error instanceof Error);
      assert(!error.message.includes('PRIVATE'));
      return true;
    },
  );
});
test('external cancellation before/after response suppresses successful obsolete data without resending', async () => {
  const aborted = new AbortController();
  aborted.abort();
  let calls = 0;
  const client = createProgressClient(base, async () => {
    calls++;
    return Response.json(envelope());
  });
  await assert.rejects(client.load(id, 't', aborted.signal));
  assert.equal(calls, 0);
  const signal = new AbortController();
  const late = createProgressClient(base, async () => {
    signal.abort();
    return Response.json(envelope());
  });
  await assert.rejects(late.load(id, 't', signal.signal));
});
test('timeout aborts the progress read, clears resources and never automatically retries', async () => {
  let calls = 0;
  const client = createProgressClient(
    base,
    async (_url, init) => {
      calls++;
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        );
      });
    },
    5,
  );
  await assert.rejects(client.load(id, 't', new AbortController().signal), {
    code: 'NETWORK_ERROR',
  });
  assert.equal(calls, 1);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createCompletionClient,
  CompletionError,
} from '../src/lib/api/completion-client';
import { completionView } from '../src/lib/progress/completion-contracts';
const cid = 'a'.repeat(24),
  key = '4f95c3e1-7202-45f1-8ef9-9a01205cace9';
const sections = ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'] as const;
const view = () => ({
  conceptId: cid,
  viewRevision: 'b'.repeat(64),
  requiredSections: [...sections],
  sections: sections.map((section) => ({ section, status: 'MISSING' })),
  practice: {
    questionId: null,
    type: null,
    status: 'MISSING',
    score: null,
    minimumScore: 70,
  },
  eligibility: 'INELIGIBLE',
  blockers: [{ code: 'EVIDENCE_MISSING' }],
  completion: { status: 'NOT_COMPLETED', completedAt: null },
  visualization: null,
});
const envelope = (data: unknown) => ({
  success: true,
  message: null,
  data,
  meta: { requestId: 'f038-offline' },
});
test('completion GET uses bearer only, no-store and the exact server projection', async () => {
  const client = createCompletionClient('http://localhost:4000/api/v1', (async (
    url,
    options,
  ) => {
    assert.equal(
      String(url),
      'http://localhost:4000/api/v1/progress/completion?conceptId=' + cid,
    );
    assert.equal(options?.cache, 'no-store');
    assert.equal(options?.credentials, 'omit');
    assert.equal(options?.redirect, 'error');
    assert.equal(
      new Headers(options?.headers).get('Authorization'),
      'Bearer private-test-token',
    );
    return Response.json(envelope(view()));
  }) as typeof fetch);
  assert.deepEqual(
    await client.load(cid, 'private-test-token', new AbortController().signal),
    view(),
  );
});
test('commands preserve exact UUID, body and endpoint; challenge scope is checked', async () => {
  const challenge = {
    section: 'READ',
    challenge: {
      id: 'c'.repeat(24),
      conceptId: cid,
      section: 'READ',
      conceptRevision: 'd'.repeat(64),
      sectionRevision: 'e'.repeat(64),
      policyId: 'read-v1',
      policyVersion: 1,
      expiresAt: '2026-10-20T10:00:00.000Z',
    },
  };
  let calls = 0;
  const client = createCompletionClient('http://localhost:4000/api/v1', (async (
    url,
    options,
  ) => {
    calls++;
    assert(String(url).endsWith('/' + cid + '/challenges'));
    assert.equal(options?.method, 'POST');
    assert.equal(new Headers(options?.headers).get('Idempotency-Key'), key);
    assert.equal(options?.body, '{"section":"READ"}');
    return Response.json(envelope(challenge));
  }) as typeof fetch);
  await client.send(cid, 'token', new AbortController().signal, {
    action: 'challenges',
    key,
    body: { section: 'READ' },
  });
  assert.equal(calls, 1);
  challenge.challenge.conceptId = 'f'.repeat(24);
  await assert.rejects(
    client.send(cid, 'token', new AbortController().signal, {
      action: 'challenges',
      key,
      body: { section: 'READ' },
    }),
  );
});
test('extra private fields, wrong identities and contradictory completed states fail closed', async () => {
  for (const data of [
    { ...view(), answer: 'private' },
    { ...view(), conceptId: 'f'.repeat(24) },
    {
      ...view(),
      completion: {
        status: 'COMPLETED',
        completedAt: '2026-10-20T10:00:00.000Z',
      },
    },
    {
      ...view(),
      requiredSections: ['READ', 'EXAMPLE', 'PRACTICE', 'PRACTICE'],
    },
  ]) {
    const client = createCompletionClient(
      'http://localhost:4000/api/v1',
      (async () => Response.json(envelope(data))) as typeof fetch,
    );
    await assert.rejects(
      client.load(cid, 'token', new AbortController().signal),
    );
  }
});
test('eligible DTO requires authoritative section qualification and genuine allowed score', () => {
  const valid = {
    ...view(),
    eligibility: 'ELIGIBLE',
    blockers: [],
    sections: sections.map((section) => ({ section, status: 'QUALIFIED' })),
    practice: {
      questionId: cid,
      type: 'OUTPUT',
      status: 'QUALIFIED',
      score: 100,
      minimumScore: 70,
    },
  };
  assert(completionView.safeParse(valid).success);
  assert(
    !completionView.safeParse({
      ...valid,
      practice: { ...valid.practice, score: 70 },
    }).success,
  );
  assert(
    !completionView.safeParse({
      ...valid,
      practice: { ...valid.practice, score: 0 },
    }).success,
  );
});
test('error messages and private documents never enter client errors; commit uncertainty is allowlisted', async () => {
  for (const code of [
    'COMPLETION_COMMIT_UNCONFIRMED',
    'PRIVATE_INTERNAL_FAILURE',
  ]) {
    const client = createCompletionClient(
      'http://localhost:4000/api/v1',
      (async () =>
        Response.json(
          {
            success: false,
            data: null,
            error: { code, message: 'private test content', details: null },
            meta: { requestId: 'test' },
          },
          { status: 503 },
        )) as typeof fetch,
    );
    await assert.rejects(
      client.load(cid, 'token', new AbortController().signal),
      (e: unknown) =>
        e instanceof Error &&
        !e.message.includes('private test content') &&
        (code !== 'COMPLETION_COMMIT_UNCONFIRMED' ||
          e instanceof CompletionError),
    );
  }
});
test('abort is propagated without a write retry and malformed base URLs are rejected', async () => {
  let calls = 0;
  const abort = new AbortController();
  abort.abort();
  const client = createCompletionClient(
    'http://localhost:4000/api/v1',
    (async () => {
      calls++;
      return Response.json(envelope(view()));
    }) as typeof fetch,
  );
  await assert.rejects(client.load(cid, 'token', abort.signal));
  assert.equal(calls, 0);
  for (const base of [
    'javascript:bad',
    'http://user:password@localhost',
    'http://localhost?token=x',
  ])
    assert.throws(() => createCompletionClient(base));
});
test('canonical identifiers and digests reject trailing newlines and oversized values', () => {
  for (const malformed of [cid + '\n', cid + 'a', 'A'.repeat(24)])
    assert(
      !completionView.safeParse({ ...view(), conceptId: malformed }).success,
    );
  assert(
    !completionView.safeParse({
      ...view(),
      viewRevision: 'b'.repeat(64) + '\n',
    }).success,
  );
});

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import { createCompletionService } from '../src/modules/progress/completion.service.js';
import type {
  CompletionRepository,
  CompletionScope,
} from '../src/modules/progress/completion.repository.js';
import type { CompletionView } from '../src/modules/progress/completion.schema.js';
import type { UserDto } from '../src/modules/users/user.dto.js';

Object.assign(process.env, {
  APP_ENV: 'LOCAL',
  EMAIL_PROVIDER: 'disabled',
  LOG_LEVEL: 'silent',
  GOOGLE_CLIENT_ID: '',
  MONGODB_URI: 'mongodb://127.0.0.1:27018',
  MONGODB_DB_NAME: 'unused-offline',
  ACCESS_TOKEN_SECRET: Buffer.from(
    Array.from({ length: 32 }, (_, i) => i + 1),
  ).toString('base64'),
  ACCESS_TOKEN_ISSUER: 'test',
  ACCESS_TOKEN_AUDIENCE: 'test',
  AUTH_COOKIE_SECURE: 'false',
  CORS_ORIGINS: 'http://127.0.0.1:3000',
});
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { createAccessTokens } =
  await import('../src/modules/auth/access-token.service.js');
const owner = 'a'.repeat(24),
  concept = 'b'.repeat(24),
  challenge = 'c'.repeat(24),
  revision = 'd'.repeat(64);
const emptyView: CompletionView = {
  conceptId: concept,
  viewRevision: revision,
  requiredSections: ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'],
  sections: ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'].map((section) => ({
    section,
    status: 'MISSING',
  })) as CompletionView['sections'],
  practice: {
    questionId: 'e'.repeat(24),
    type: 'OUTPUT',
    status: 'MISSING',
    score: null,
    minimumScore: 70,
  },
  eligibility: 'INELIGIBLE',
  blockers: [{ code: 'EVIDENCE_MISSING', section: 'PRACTICE' }],
  completion: { status: 'NOT_COMPLETED', completedAt: null },
  visualization: null,
};
async function fixture(post = 30, get = 120) {
  const tokens = createAccessTokens(env);
  let calls = 0,
    actions = 0,
    user = {
      id: owner,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
    } as UserDto;
  let failure: AppError | undefined,
    view = emptyView;
  const scope = {
    owner,
    conceptId: concept,
    state: 'CURRENT',
    policy: {
      requiredSections: ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'],
      fingerprint: 'f'.repeat(64),
      checkpointDefinitionId: 'e'.repeat(24),
    },
    origin: { assert() {} },
  } as CompletionScope;
  const repository = {
    async read(who: string, id: string) {
      calls++;
      assert.equal(who, owner);
      assert.equal(id, concept);
      if (failure) throw failure;
      return view;
    },
    async complete(who: string, id: string, expectedRevision: string) {
      calls++;
      assert.equal(who, owner);
      assert.equal(id, concept);
      assert.equal(expectedRevision, revision);
      if (failure) throw failure;
      return view;
    },
    async scope(who: string, id: string) {
      assert.equal(who, owner);
      if (id !== concept)
        throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
      return scope;
    },
    async challenge(who: string, id: string, cid: string) {
      assert.equal(who, owner);
      assert.equal(id, concept);
      assert.equal(cid, challenge);
      return { section: 'READ' };
    },
  } as unknown as CompletionRepository;
  const service = createCompletionService(
    tokens,
    env,
    repository,
    {
      async get() {
        return user;
      },
    },
    {
      async issue(section, _token, id) {
        actions++;
        return {
          id: challenge,
          conceptId: id,
          section,
          conceptRevision: revision,
          sectionRevision: revision,
          policyId: `F038_${section}_ACK_ACTIVITY`,
          policyVersion: 1,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        };
      },
      async respond(section) {
        actions++;
        return {
          id: 'e'.repeat(24),
          conceptId: concept,
          section,
          acknowledgedAt: new Date().toISOString(),
          completionQualification: 'NOT_ESTABLISHED',
        };
      },
    },
  );
  const args: Parameters<typeof createApp> = [];
  args[23] = {
    async get() {
      return {
        conceptId: concept,
        status: 'NOT_STARTED',
        attemptCount: 0,
        startedAt: null,
        lastActivityAt: null,
      };
    },
  };
  args[24] = { ip: 300, get, windowMs: 900000, completionPost: post };
  args[25] = service;
  const server = createApp(...args).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api/v1';
  const token = await tokens.sign({
    sub: owner,
    sid: owner,
    role: 'STUDENT',
    plan: 'FREE',
  });
  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Idempotency-Key': randomUUID(),
  };
  return {
    base,
    url: base + '/progress/completion?conceptId=' + concept,
    command: base + '/progress/completion/' + concept,
    token,
    tokens,
    headers,
    calls: () => calls,
    actions: () => actions,
    setUser: (u: UserDto) => {
      user = u;
    },
    setView: (v: CompletionView) => {
      view = v;
    },
    fail: (e: AppError) => {
      failure = e;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
test('completion GET returns only the nine safe fields with current Student ownership and no-store', async () => {
  const f = await fixture();
  try {
    const r = await fetch(f.url, { headers: f.headers });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const body = (await r.json()) as {
      data: CompletionView;
      meta: Record<string, unknown>;
    };
    assert.deepEqual(body.data, emptyView);
    assert.deepEqual(Object.keys(body.meta), ['requestId']);
    for (const k of [
      'answer',
      'studentAnswer',
      'userId',
      'rubric',
      'contentFingerprint',
      'assessmentId',
    ])
      assert.equal(Object.hasOwn(body.data, k), false);
  } finally {
    await f.close();
  }
});
test('all completion routes reject anonymous/Admin subjects; inactive/unverified students fail before repositories', async () => {
  const f = await fixture();
  try {
    const admin = await f.tokens.sign({
      sub: owner,
      sid: owner,
      role: 'ADMIN',
      plan: 'FREE',
    });
    for (const token of [undefined, 'invalid', admin]) {
      const h = { ...f.headers, Authorization: token ? 'Bearer ' + token : '' };
      for (const suffix of ['', '/complete', '/challenges', '/responses']) {
        const r = await fetch(suffix ? f.command + suffix : f.url, {
          method: suffix ? 'POST' : 'GET',
          headers: h,
          ...(suffix
            ? { body: JSON.stringify({ viewRevision: revision }) }
            : {}),
        });
        assert([401, 403].includes(r.status));
        assert.equal(r.headers.get('cache-control'), 'no-store');
      }
    }
    for (const patch of [
      { status: 'DISABLED' },
      { status: 'SUSPENDED' },
      { emailVerified: false },
      { role: 'ADMIN' },
    ]) {
      f.setUser({
        id: owner,
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerified: true,
        ...patch,
      } as UserDto);
      const r = await fetch(f.url, { headers: f.headers });
      assert.equal(r.status, 403);
    }
    assert.equal(f.calls(), 0);
    assert.equal(f.actions(), 0);
  } finally {
    await f.close();
  }
});
test('strict completion query, identifiers, command bodies and key headers reject client authority or score claims', async () => {
  const f = await fixture();
  try {
    for (const query of [
      'conceptId=' + concept + '&conceptId=' + concept,
      'conceptId=' + concept + '&approved=true',
      'conceptId[]=x',
      'conceptId=bad',
    ])
      assert.equal(
        (
          await fetch(f.base + '/progress/completion?' + query, {
            headers: f.headers,
          })
        ).status,
        400,
      );
    for (const body of [
      { viewRevision: revision, score: 100 },
      { viewRevision: revision, userId: owner },
      { viewRevision: 'invalid' },
      {},
      null,
      [],
    ]) {
      const r = await fetch(f.command + '/complete', {
        method: 'POST',
        headers: f.headers,
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 400);
    }
    for (const body of [
      { section: 'PRACTICE' },
      { section: 'READ', approved: true },
      { section: 'READ', definitionId: challenge },
    ])
      assert.equal(
        (
          await fetch(f.command + '/challenges', {
            method: 'POST',
            headers: f.headers,
            body: JSON.stringify(body),
          })
        ).status,
        400,
      );
    for (const key of ['', 'not-a-key', randomUUID() + ',' + randomUUID()])
      assert.equal(
        (
          await fetch(f.command + '/complete', {
            method: 'POST',
            headers: { ...f.headers, 'Idempotency-Key': key },
            body: JSON.stringify({ viewRevision: revision }),
          })
        ).status,
        400,
      );
    assert.equal(f.calls(), 0);
    assert.equal(f.actions(), 0);
  } finally {
    await f.close();
  }
});
test('completion no-store covers malformed and oversized JSON, CORS refusal and invalid route identifiers', async () => {
  const f = await fixture();
  try {
    for (const [body, status] of [
      ['{', 400],
      [JSON.stringify({ payload: 'x'.repeat(4200) }), 413],
    ] as const) {
      const r = await fetch(f.command + '/complete', {
        method: 'POST',
        headers: f.headers,
        body,
      });
      assert.equal(r.status, status);
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assert(!(await r.text()).includes('xxxx'));
    }
    const cors = await fetch(f.command + '/challenges', {
      method: 'POST',
      headers: { ...f.headers, Origin: 'https://unapproved.invalid' },
      body: '{}',
    });
    assert.equal(cors.status, 403);
    assert.equal(cors.headers.get('cache-control'), 'no-store');
    const invalid = await fetch(
      f.base + '/progress/completion/not-an-id/complete',
      { method: 'POST', headers: f.headers, body: '{}' },
    );
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.get('cache-control'), 'no-store');
    const health = await fetch(f.base + '/health');
    assert.equal(health.headers.get('cache-control'), 'no-store');
    const unrelated = await fetch(f.base + '/technologies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(unrelated.status, 400);
    assert.equal(unrelated.headers.get('cache-control'), null);
    assert.equal(f.calls(), 0);
  } finally {
    await f.close();
  }
});
test('completion media/encoding and streamed payload bounds preserve existing global parser behavior', async () => {
  const f = await fixture();
  try {
    const wrong = await fetch(f.command + '/complete', {
      method: 'POST',
      headers: { ...f.headers, 'Content-Type': 'text/plain' },
      body: 'plain',
    });
    assert.equal(wrong.status, 415);
    const encoded = await fetch(f.command + '/complete', {
      method: 'POST',
      headers: { ...f.headers, 'Content-Encoding': 'gzip' },
      body: 'invalid-compressed',
    });
    assert.equal(encoded.status, 415);
    assert.equal(encoded.headers.get('cache-control'), 'no-store');
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        f.command + '/complete',
        { method: 'POST', headers: f.headers },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode!));
        },
      );
      req.on('error', reject);
      req.write('{"payload":"');
      req.write('x'.repeat(5000));
      req.end('"}');
    });
    assert.equal(status, 413);
  } finally {
    await f.close();
  }
});
test('producer wrappers return activity-only receipts and never accept an arbitrary correct answer or rubric', async () => {
  const f = await fixture();
  try {
    const issued = await fetch(f.command + '/challenges', {
      method: 'POST',
      headers: f.headers,
      body: JSON.stringify({ section: 'EXAMPLE' }),
    });
    assert.equal(issued.status, 200);
    const response = await fetch(f.command + '/responses', {
      method: 'POST',
      headers: { ...f.headers, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ challengeId: challenge, acknowledged: true }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: { receipt: { completionQualification: string } };
    };
    assert.equal(body.data.receipt.completionQualification, 'NOT_ESTABLISHED');
    const bad = await fetch(f.command + '/responses', {
      method: 'POST',
      headers: f.headers,
      body: JSON.stringify({
        challengeId: challenge,
        acknowledged: true,
        expectedChoiceId: 'yes',
      }),
    });
    assert.equal(bad.status, 400);
    assert.equal(f.actions(), 2);
  } finally {
    await f.close();
  }
});
test('new commands share the thirty-subject budget, count replays and remain separate from GET limits', async () => {
  const f = await fixture(1);
  try {
    assert.equal(
      (
        await fetch(f.command + '/challenges', {
          method: 'POST',
          headers: f.headers,
          body: JSON.stringify({ section: 'READ' }),
        })
      ).status,
      200,
    );
    const replay = await fetch(f.command + '/challenges', {
      method: 'POST',
      headers: f.headers,
      body: JSON.stringify({ section: 'READ' }),
    });
    assert.equal(replay.status, 429);
    assert.equal(replay.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(f.url, { headers: f.headers })).status, 200);
  } finally {
    await f.close();
  }
});
test('completion and F037 activity GET share the existing subject rate limit without changing the activity DTO', async () => {
  const f = await fixture(30, 1);
  try {
    const activity = await fetch(f.base + '/progress?conceptId=' + concept, {
      headers: f.headers,
    });
    assert.equal(activity.status, 200);
    const data = ((await activity.json()) as { data: Record<string, unknown> })
      .data;
    assert.equal(Object.keys(data).length, 5);
    assert.equal((await fetch(f.url, { headers: f.headers })).status, 429);
  } finally {
    await f.close();
  }
});
test('error and successful DTO validation never leak internal answers or a fabricated completed state', async () => {
  const f = await fixture();
  try {
    f.fail(
      new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Completion is unavailable'),
    );
    const r = await fetch(f.command + '/complete', {
      method: 'POST',
      headers: f.headers,
      body: JSON.stringify({ viewRevision: revision }),
    });
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert(!(await r.text()).includes('rubric'));
  } finally {
    await f.close();
  }
  const g = await fixture();
  try {
    g.setView({ ...emptyView, answer: 'private' } as CompletionView);
    const r = await fetch(g.url, { headers: g.headers });
    assert.equal(r.status, 503);
    assert(!(await r.text()).includes('private'));
  } finally {
    await g.close();
  }
});
test('server environment alone gates completion routes and client flags cannot activate them', async () => {
  const original = env.APP_ENV;
  let f: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    env.APP_ENV = 'PRODUCTION';
    f = await fixture();
    const r = await fetch(f.url + '&APP_ENV=LOCAL', { headers: f.headers });
    assert.equal(r.status, 404);
    assert.equal(f.calls(), 0);
    const command = await fetch(f.command + '/complete', {
      method: 'POST',
      headers: f.headers,
      body: JSON.stringify({ viewRevision: revision, local: true }),
    });
    assert.equal(command.status, 404);
    assert.equal(f.calls(), 0);
  } finally {
    env.APP_ENV = original;
    await f?.close();
  }
});

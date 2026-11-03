import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { parse } from 'node:querystring';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../src/common/errors/app-error.js';
import { createAdminAccessService } from '../src/modules/admin/admin-access.service.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { createAdminLearningPathService } from '../src/modules/admin/learning-paths/admin-learning-path.service.js';
import { createAdminLearningPathController } from '../src/modules/admin/learning-paths/admin-learning-path.controller.js';

// Offline synthetic signing configuration. No database, HTTP listener or real account.
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
  CORS_ORIGINS: 'http://localhost:5173',
});
const { createAdminRouter } =
  await import('../src/modules/admin/admin.routes.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');
const { env } = await import('../src/config/env.js');
const tokens = createAccessTokens(env);
const actor = {
  sub: 'a'.repeat(24),
  sid: 'b'.repeat(24),
  role: 'ADMIN' as const,
  plan: 'FREE' as const,
};
const tid = 'c'.repeat(24),
  id = 'd'.repeat(24);
const dto = {
  id,
  technologyId: tid,
  title: 'Path',
  slug: 'path',
  description: null,
  targetLevel: null,
  completionScore: 70,
  status: 'ARCHIVED' as const,
  order: 0,
  revision: 0,
  createdAt: '2026-11-02T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
};
function request(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const socket = new Socket(),
    req = new IncomingMessage(socket) as Request;
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.body = body;
  req.requestId = 'f044-offline';
  Object.defineProperty(req, 'query', {
    value: parse(url.split('?')[1] ?? ''),
  });
  Object.defineProperty(req, 'ip', { value: '127.0.0.1' });
  Object.defineProperty(req, 'path', { get: () => req.url?.split('?')[0] });
  req.app = { get: () => false } as unknown as Request['app'];
  const values = new Map<string, unknown>();
  let finish!: (v: {
    status: number;
    body: unknown;
    headers: Map<string, unknown>;
  }) => void;
  const result = new Promise<{
    status: number;
    body: unknown;
    headers: Map<string, unknown>;
  }>((r) => {
    finish = r;
  });
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    destroyed: false,
    headersSent: false,
    setHeader: (key: string, value: unknown) =>
      values.set(key.toLowerCase(), value),
    getHeader: (key: string) => values.get(key.toLowerCase()),
    append: (key: string, value: unknown) =>
      values.set(key.toLowerCase(), value),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      finish({ status: this.statusCode, body: value, headers: values });
      return this;
    },
  }) as unknown as Response;
  return {
    req,
    res,
    result,
    finish,
    dispose() {
      req.destroy();
      socket.destroy();
    },
  };
}
type Options = {
  token?: string;
  account?: Record<string, unknown> | null;
  body?: unknown;
  headers?: Record<string, string>;
  fault?: string;
  featureLimit?: number;
  capacity?: number;
  delay?: Promise<void>;
  abort?: boolean;
};
function setup(options: Options = {}) {
  let calls = 0,
    accountReads = 0;
  const gate = createAdminAccessService({
    read: async (userId) => {
      accountReads++;
      if (options.fault === 'account') throw Error('PRIVATE_ACCOUNT_ERROR');
      if (options.delay) await options.delay;
      return options.account === undefined
        ? {
            _id: new Types.ObjectId(userId),
            role: 'ADMIN',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
          }
        : options.account;
    },
  });
  const service = createAdminLearningPathService();
  service.list = async (query) => {
    calls++;
    if (options.fault === 'dependency')
      throw new AppError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Learning Paths unavailable',
      );
    return {
      items: [dto],
      pagination: {
        page: query.page,
        limit: query.limit,
        total: 1,
        totalPages: 1,
      },
    };
  };
  service.get = async (path, parent) => {
    calls++;
    assert.equal(path, id);
    assert.equal(parent, tid);
    return dto;
  };
  const router = createAdminRouter(
    gate,
    undefined,
    undefined,
    undefined,
    service,
    {
      read: options.featureLimit ?? 120,
      windowMs: 60000,
      capacity: options.capacity ?? 10000,
    },
  );
  async function dispatch(
    method: string,
    url: string,
    overrides: Partial<Options> = {},
  ) {
    const o = { ...options, ...overrides };
    const r = request(method, url, o.body, {
      ...(o.token ? { authorization: 'Bearer ' + o.token } : {}),
      ...o.headers,
    });
    const timer = setTimeout(
      () =>
        r.finish({
          status: 599,
          body: 'OFFLINE_ROUTER_DID_NOT_SETTLE',
          headers: new Map(),
        }),
      1500,
    );
    try {
      router(r.req, r.res, (error?: unknown) =>
        errorHandler(
          error ?? new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found'),
          r.req,
          r.res,
          () => {},
        ),
      );
      if (o.abort) r.req.emit('aborted');
      const out = await r.result;
      return { ...out, calls, accountReads };
    } finally {
      clearTimeout(timer);
      r.dispose();
    }
  }
  return { dispatch };
}
const list = '/learning-paths?technologyId=' + tid;
function sanitized(body: unknown) {
  assert(body && typeof body === 'object');
  const value = body as Record<string, unknown>;
  assert.deepEqual(Object.keys(value).sort(), ['error', 'meta', 'success']);
  const error = value.error as Record<string, unknown>;
  assert(
    Object.keys(error).every((k) => ['code', 'message', 'details'].includes(k)),
  );
  if (error.details !== undefined) {
    assert(Array.isArray(error.details));
    assert(error.details.length <= 20);
    for (const item of error.details) {
      assert.deepEqual(Object.keys(item as object).sort(), [
        'field',
        'message',
      ]);
    }
  }
  const text = JSON.stringify(body);
  assert(!/PRIVATE|stack|password|exception/i.test(text));
}
test('protected GET requires real signed ADMIN JWT before current-account and business reads', async () => {
  for (const token of [
    undefined,
    'bad',
    await tokens.sign({ ...actor, role: 'STUDENT' }),
  ]) {
    const f = setup(token ? { token } : {}),
      out = await f.dispatch('GET', list);
    assert.equal(out.status, token && token !== 'bad' ? 403 : 401);
    assert.equal(out.calls, 0);
    sanitized(out.body);
    assert.equal(out.headers.get('cache-control'), 'no-store');
  }
});
for (const patch of [
  { role: 'STUDENT' },
  { status: 'DISABLED' },
  { status: 'SUSPENDED' },
  { emailVerifiedAt: null },
  { status: 'PENDING_VERIFICATION' },
])
  test(
    'current stored ineligibility denies before feature read: ' +
      JSON.stringify(patch),
    async () => {
      const account = {
        _id: new Types.ObjectId(actor.sub),
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        ...patch,
      };
      const out = await setup({
        token: await tokens.sign(actor),
        account,
      }).dispatch('GET', list);
      assert.equal(out.status, 403);
      assert.equal(out.calls, 0);
      assert.equal(out.accountReads, 1);
      sanitized(out.body);
    },
  );
test('deleted, corrupt and failed account reads never produce empty inventory', async () => {
  for (const [options, status] of [
    [{ account: null }, 403],
    [
      {
        account: {
          _id: new Types.ObjectId(),
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      },
      503,
    ],
    [{ fault: 'account' }, 503],
  ] as const) {
    const out = await setup({
      token: await tokens.sign(actor),
      ...options,
    }).dispatch('GET', list);
    assert.equal(out.status, status);
    assert.equal(out.calls, 0);
    sanitized(out.body);
  }
});
for (const method of ['GET', 'HEAD'])
  test(
    method +
      ' list/detail dispatch only after current eligibility with no-store',
    async () => {
      const f = setup({ token: await tokens.sign(actor) });
      for (const path of [
        list,
        '/learning-paths/' + id + '?technologyId=' + tid,
      ]) {
        const out = await f.dispatch(method, path);
        assert.equal(out.status, 200);
        assert.equal(out.headers.get('cache-control'), 'no-store');
        assert.equal((out.body as { success: boolean }).success, true);
      }
    },
  );
for (const suffix of [
  '',
  '?technologyId=bad',
  '?technologyId=' + tid + '&technologyId=' + tid,
  '?technologyId=' + tid + '&page=01',
  '?technologyId=' + tid + '&page=1%0A',
  '?technologyId=' + tid + '&limit=101',
  '?technologyId=' + tid + '&status=DRAFT',
  '?technologyId=' + tid + '&technologyId[$ne]=x',
])
  test('router rejects invalid list query ' + suffix, async () => {
    const out = await setup({ token: await tokens.sign(actor) }).dispatch(
      'GET',
      '/learning-paths' + suffix,
    );
    assert.equal(out.status, 400);
    assert.equal(out.calls, 0);
    sanitized(out.body);
  });
test('detail requires parent binding and accepts canonical normalization', async () => {
  const f = setup({ token: await tokens.sign(actor) });
  for (const path of [
    '/learning-paths/' + id,
    '/learning-paths/bad?technologyId=' + tid,
    '/learning-paths/' + id + '?technologyId=' + tid + '&page=1',
  ]) {
    const out = await f.dispatch('GET', path);
    assert.equal(out.status, 400);
    assert.equal(out.calls, 0);
  }
  const out = await f.dispatch(
    'GET',
    '/learning-paths/' +
      id.toUpperCase() +
      '?technologyId=' +
      tid.toUpperCase(),
  );
  assert.equal(out.status, 200);
});
for (const method of ['GET', 'HEAD'])
  for (const options of [
    { headers: { 'content-length': '2' } },
    { headers: { 'transfer-encoding': 'chunked' } },
    { body: { private: 'PRIVATE' } },
    { body: [] },
    { body: null },
  ])
    test(
      method + ' rejects nonempty/body-framed request before business',
      async () => {
        const out = await setup({
          token: await tokens.sign(actor),
          ...options,
        }).dispatch(method, list);
        assert.equal(out.status, 400);
        assert.equal(out.calls, 0);
        sanitized(out.body);
      },
    );
for (const method of ['POST', 'PATCH', 'PUT', 'DELETE'])
  test('unsupported ' + method + ' remains protected 404', async () => {
    const out = await setup({ token: await tokens.sign(actor) }).dispatch(
      method,
      list,
    );
    assert.equal(out.status, 404);
    assert.equal(out.calls, 0);
    assert.equal(out.headers.get('cache-control'), 'no-store');
    sanitized(out.body);
  });
test('feature limiter is shared by list/detail; store exhaustion refuses instead of evicting', async () => {
  const token = await tokens.sign(actor),
    f = setup({ token, featureLimit: 1 });
  assert.equal((await f.dispatch('GET', list)).status, 200);
  const limited = await f.dispatch(
    'GET',
    '/learning-paths/' + id + '?technologyId=' + tid,
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.calls, 1);
  sanitized(limited.body);
  const bounded = setup({ token, capacity: 1 });
  assert.equal((await bounded.dispatch('GET', list)).status, 200);
  const second = await tokens.sign({ ...actor, sub: 'f'.repeat(24) });
  // The gate fixture binds the stored projection to each actual verified subject.
  const refused = await bounded.dispatch('GET', list, { token: second });
  assert.equal(refused.status, 503);
  assert.equal(refused.calls, 1);
});
test('account read expiry cannot dispatch even with a delayed timeout callback', async () => {
  let now = 0;
  const gate = createAdminAccessService(
    {
      read: async () => {
        now = 5000;
        return {
          _id: new Types.ObjectId(actor.sub),
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        };
      },
    },
    () => now,
  );
  await assert.rejects(
    gate.authorize(actor),
    (error: unknown) =>
      error instanceof AppError && error.code === 'DEPENDENCY_UNAVAILABLE',
  );
});
test('controller disconnect suppresses late response and disposes event handlers', async () => {
  const resource = request('GET', list);
  resource.req.auth = actor;
  let resolve!: (value: {
    items: (typeof dto)[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }) => void;
  const service = createAdminLearningPathService();
  service.list = () =>
    new Promise((r) => {
      resolve = r;
    });
  const controller = createAdminLearningPathController(service);
  const pending = controller.list(resource.req, resource.res, {
    technologyId: tid,
    page: 1,
    limit: 20,
  });
  resource.res.emit('close');
  resolve({
    items: [dto],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  await pending;
  assert.equal(resource.req.listenerCount('aborted'), 0);
  assert.equal(resource.res.listenerCount('close'), 0);
  let finished = false;
  void resource.result.then(() => {
    finished = true;
  });
  await Promise.resolve();
  assert.equal(finished, false);
  resource.dispose();
});

test('controller suppresses late error sends after close/abort, but propagates genuine connected failures', async () => {
  for (const event of ['close', 'aborted', 'connected']) {
    const r = request('GET', list);
    r.req.auth = actor;
    let reject!: (error: Error) => void;
    const service = createAdminLearningPathService();
    service.list = () =>
      new Promise((_, bad) => {
        reject = bad;
      });
    const pending = createAdminLearningPathController(service).list(
      r.req,
      r.res,
      { technologyId: tid, page: 1, limit: 20 },
    );
    const expected =
      event === 'connected'
        ? assert.rejects(pending, /SYNTHETIC_FAILURE/)
        : pending;
    if (event === 'close') r.res.emit('close');
    if (event === 'aborted') r.req.emit('aborted');
    reject(new Error('SYNTHETIC_FAILURE'));
    await expected;
    let sent = false;
    void r.result.then(() => {
      sent = true;
    });
    await Promise.resolve();
    assert.equal(sent, false);
    assert.equal(r.req.listenerCount('aborted'), 0);
    assert.equal(r.res.listenerCount('close'), 0);
    r.dispose();
  }
});

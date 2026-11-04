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
import { createAdminLearningPathProposalController } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.controller.js';
import type { AdminLearningPathProposalService } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.service.js';
import type { AdminLearningPathProposalDto } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.dto.js';
import {
  createProposalLimits,
  type ProposalLimits,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal-rate-limit.js';

// Synthetic signing only. Sockets remain unconnected; no listener or database.
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
const { proposalBodyParser, proposalBodyLimit } =
  await import('../src/modules/admin/learning-paths/admin-learning-path-proposal.routes.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');
const { env } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const tokens = createAccessTokens(env);
const actor = {
  sub: 'a'.repeat(24),
  sid: 'b'.repeat(24),
  role: 'ADMIN' as const,
  plan: 'FREE' as const,
};
const technologyId = 'c'.repeat(24),
  id = 'd'.repeat(24),
  sourceId = 'e'.repeat(24);
const operationId = '12345678-1234-4123-8123-123456789abc';
const base = '/learning-path-proposals';
const detail = base + '/' + id + '?technologyId=' + technologyId;
const recovery =
  base + '/operations/' + operationId + '?technologyId=' + technologyId;
function input() {
  return {
    technologyId,
    operationId,
    title: 'Private curriculum',
    objectives: ['Understand values'],
    audience: 'New developers',
    depth: 'BEGINNER',
    runtime: null,
    technologyVersion: null,
    prerequisites: [],
  };
}
function dto(): AdminLearningPathProposalDto {
  const { operationId: _unused, ...content } = input();
  void _unused;
  return {
    ...content,
    depth: 'BEGINNER',
    id,
    proposalId: sourceId,
    revision: 1,
    schemaVersion: 1,
    source: { id: sourceId, revision: 1 },
    createdAt: '2026-11-04T00:00:00.000Z',
  };
}
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
  req.requestId = 'proposal-offline';
  Object.defineProperty(req, 'query', {
    value: parse(url.split('?')[1] ?? ''),
  });
  Object.defineProperty(req, 'ip', { value: '127.0.0.1' });
  Object.defineProperty(req, 'path', { get: () => req.url?.split('?')[0] });
  req.app = { get: () => false } as unknown as Request['app'];
  const values = new Map<string, unknown>();
  type Result = {
    status: number;
    body: unknown;
    headers: Map<string, unknown>;
  };
  let finish!: (v: Result) => void;
  const result = new Promise<Result>((resolve) => {
    finish = resolve;
  });
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    destroyed: false,
    headersSent: false,
    setHeader: (key: string, value: unknown) =>
      values.set(key.toLowerCase(), value),
    getHeader: (key: string) => values.get(key.toLowerCase()),
    removeHeader: (key: string) => values.delete(key.toLowerCase()),
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
    values,
    dispose() {
      req.destroy();
      socket.destroy();
    },
  };
}
type Options = {
  token?: string;
  account?: Record<string, unknown> | null;
  fault?: unknown;
  response?: unknown;
  unresolved?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  limits?: ProposalLimits;
  gateDelay?: Promise<void>;
  featureDelay?: Promise<void>;
};
function setup(options: Options = {}) {
  const calls: string[] = [];
  let accountReads = 0,
    verified = 0;
  const gate = createAdminAccessService({
    read: async (userId) => {
      accountReads++;
      if (options.gateDelay) await options.gateDelay;
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
  async function invoked(
    name: string,
    authority: Parameters<AdminLearningPathProposalService['reconcile']>[1],
  ) {
    calls.push(name);
    await authority.verify();
    verified++;
    if (options.featureDelay) await options.featureDelay;
    if (options.fault) throw options.fault;
  }
  const service: AdminLearningPathProposalService = {
    capture: async (body, requestId, authority) => {
      await invoked('capture', authority);
      assert.equal(requestId, 'proposal-offline');
      assert.deepEqual(body, input());
      return (options.response ?? dto()) as AdminLearningPathProposalDto;
    },
    reconcile: async (query, authority) => {
      await invoked('reconcile', authority);
      assert.deepEqual(query, { technologyId, operationId });
      return options.response !== undefined
        ? (options.response as Awaited<
            ReturnType<AdminLearningPathProposalService['reconcile']>
          >)
        : options.unresolved
          ? { state: 'UNRESOLVED' as const }
          : { state: 'COMMITTED' as const, proposal: dto() };
    },
    get: async (value, parent, authority) => {
      await invoked('get', authority);
      assert.equal(value, id);
      assert.equal(parent, technologyId);
      return (options.response ?? dto()) as AdminLearningPathProposalDto;
    },
  };
  const router = createAdminRouter(
    gate,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    service,
    options.limits,
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
          headers: r.values,
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
      return {
        ...(await r.result),
        calls: [...calls],
        accountReads,
        verified,
        route: r.req.routeLabel,
      };
    } finally {
      clearTimeout(timer);
      r.dispose();
    }
  }
  return { dispatch, calls, service };
}
function privacy(body: unknown) {
  assert(body && typeof body === 'object');
  const raw = body as Record<string, unknown>;
  assert.deepEqual(Object.keys(raw).sort(), ['error', 'meta', 'success']);
  const error = raw.error as Record<string, unknown>;
  assert(
    Object.keys(error).every((k) => ['code', 'message', 'details'].includes(k)),
  );
  assert(!JSON.stringify(raw).includes('SYNTHETIC_PRIVATE'));
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
}
test('namespace refuses anonymous, malformed token and Student before business work', async () => {
  for (const token of [
    undefined,
    'bad',
    await tokens.sign({ ...actor, role: 'STUDENT' }),
  ]) {
    const result = await setup().dispatch(
      'GET',
      detail,
      token ? { token } : {},
    );
    assert.equal(result.status, token?.includes('.') ? 403 : 401);
    assert.equal(result.calls.length, 0);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    privacy(result.body);
  }
});
for (const change of [
  null,
  { role: 'STUDENT' },
  { status: 'DISABLED' },
  { status: 'SUSPENDED' },
  { status: 'PENDING_VERIFICATION' },
  { emailVerifiedAt: null },
])
  test(
    'current-account namespace refuses ' + JSON.stringify(change),
    async () => {
      const account =
        change === null
          ? null
          : {
              _id: new Types.ObjectId(actor.sub),
              role: 'ADMIN',
              status: 'ACTIVE',
              emailVerifiedAt: new Date(),
              ...change,
            };
      const result = await setup({ account }).dispatch('POST', base, {
        token: await tokens.sign(actor),
        body: input(),
      });
      assert.equal(result.status, 403);
      assert.equal(result.calls.length, 0);
      privacy(result.body);
    },
  );
for (const [method, path, kind] of [
  ['POST', base, 'capture'],
  ['GET', detail, 'get'],
  ['GET', recovery, 'reconcile'],
] as const)
  test(`${method} ${kind} dispatches once through protected namespace with exact success/no-store`, async () => {
    const result = await setup().dispatch(method, path, {
      token: await tokens.sign(actor),
      ...(method === 'POST' ? { body: input() } : {}),
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.calls, [kind]);
    assert.equal(result.accountReads, 1);
    assert.equal(result.verified, 1);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.route, '/api/v1/admin/learning-path-proposals/*');
    assert(!JSON.stringify(result.body).includes(operationId));
    assert(!JSON.stringify(result.body).includes('Bearer'));
    assert.deepEqual(result.body, {
      success: true,
      data:
        kind === 'reconcile' ? { state: 'COMMITTED', proposal: dto() } : dto(),
      message: null,
      meta: { requestId: 'proposal-offline' },
    });
  });
test('UNRESOLVED is exact read response and does not dispatch capture', async () => {
  const result = await setup({ unresolved: true }).dispatch('GET', recovery, {
    token: await tokens.sign(actor),
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.calls, ['reconcile']);
  assert.deepEqual((result.body as { data: unknown }).data, {
    state: 'UNRESOLVED',
  });
});
for (const method of ['HEAD', 'PUT', 'PATCH', 'DELETE'])
  test(
    'undeclared ' + method + ' cannot dispatch proposal reads or mutations',
    async () => {
      for (const path of [base, detail, recovery]) {
        const result = await setup().dispatch(method, path, {
          token: await tokens.sign(actor),
        });
        assert.equal(result.status, 404);
        assert.equal(result.calls.length, 0);
        assert.equal(result.headers.get('cache-control'), 'no-store');
      }
    },
  );
for (const [method, path, body] of [
  ['GET', base + '/operations/' + operationId, undefined],
  ['GET', detail + '&technologyId=' + technologyId, undefined],
  ['GET', base + '/' + id + '?technologyId[$eq]=' + technologyId, undefined],
  ['GET', detail + '&extra=x', undefined],
  [
    'GET',
    base + '/' + id.toUpperCase() + '?technologyId=' + technologyId,
    undefined,
  ],
  ['GET', detail, { private: 'SYNTHETIC_PRIVATE' }],
  ['POST', base + '?extra=x', input()],
  ['POST', base, { ...input(), actor: 'SYNTHETIC_PRIVATE' }],
  ['POST', base, { ...input(), title: ' leading' }],
  [
    'GET',
    base +
      '/operations/' +
      operationId.toUpperCase() +
      '?technologyId=' +
      technologyId,
    undefined,
  ],
] as const)
  test('invalid request never dispatches ' + method + ' ' + path, async () => {
    const result = await setup().dispatch(method, path, {
      token: await tokens.sign(actor),
      body,
    });
    assert.equal(result.status, 400);
    assert.equal(result.calls.length, 0);
    privacy(result.body);
  });
for (const code of [
  'PROPOSAL_CONFLICT',
  'TECHNOLOGY_READ_ONLY',
  'PROPOSAL_OUTCOME_UNKNOWN',
  'DEPENDENCY_UNAVAILABLE',
  'PROPOSAL_NOT_FOUND',
] as const)
  test(
    'fixed error ' + code + ' is sanitized with no second business call',
    async () => {
      const status =
        code === 'PROPOSAL_NOT_FOUND'
          ? 404
          : code.endsWith('UNAVAILABLE') || code.endsWith('UNKNOWN')
            ? 503
            : 409;
      const fault = new AppError(status, code, 'SYNTHETIC_PRIVATE_EXCEPTION', [
        { field: 'SYNTHETIC_PRIVATE', message: 'SYNTHETIC_PRIVATE' },
      ]);
      const result = await setup({ fault }).dispatch('GET', detail, {
        token: await tokens.sign(actor),
      });
      assert.equal(result.status, status);
      assert.deepEqual(result.calls, ['get']);
      privacy(result.body);
      assert.equal(
        (result.body as { error: { details?: unknown } }).error.details,
        undefined,
      );
    },
  );
test('unexpected dependency error becomes fixed503 without leaking or retry', async () => {
  const result = await setup({
    fault: new Error('SYNTHETIC_PRIVATE_STACK'),
  }).dispatch('POST', base, { token: await tokens.sign(actor), body: input() });
  assert.equal(result.status, 503);
  assert.deepEqual(result.calls, ['capture']);
  privacy(result.body);
});
test('uncertain POST is attempted once; explicit recovery does not replay capture', async () => {
  const options: Options = {
    fault: new AppError(503, 'PROPOSAL_OUTCOME_UNKNOWN', 'SYNTHETIC_PRIVATE'),
  };
  const f = setup(options),
    token = await tokens.sign(actor);
  const uncertain = await f.dispatch('POST', base, { token, body: input() });
  assert.equal(uncertain.status, 503);
  assert.deepEqual(f.calls, ['capture']);
  privacy(uncertain.body);
  delete options.fault;
  const resolved = await f.dispatch('GET', recovery, { token });
  assert.equal(resolved.status, 200);
  assert.deepEqual(f.calls, ['capture', 'reconcile']);
  assert.deepEqual((resolved.body as { data: unknown }).data, {
    state: 'COMMITTED',
    proposal: dto(),
  });
});
for (const response of [
  { ...dto(), definitionDigest: 'SYNTHETIC_PRIVATE' },
  { ...dto(), source: { ...dto().source, digest: 'SYNTHETIC_PRIVATE' } },
  { ...dto(), technologyId: 'f'.repeat(24) },
  { ...dto(), id: 'f'.repeat(24) },
  {
    ...dto(),
    runtime: { name: 'node', version: null, message: 'SYNTHETIC_PRIVATE' },
  },
])
  test('invalid output refuses raw private/incorrect binding data', async () => {
    const result = await setup({ response }).dispatch('GET', detail, {
      token: await tokens.sign(actor),
    });
    assert.equal(result.status, 503);
    privacy(result.body);
  });
test('feature read quota is shared by detail/recovery, capture separately bounded', async () => {
  const f = setup({
      limits: { read: 1, capture: 1, windowMs: 60000, capacity: 2 },
    }),
    token = await tokens.sign(actor);
  assert.equal((await f.dispatch('GET', detail, { token })).status, 200);
  assert.equal((await f.dispatch('GET', recovery, { token })).status, 429);
  assert.equal(
    (await f.dispatch('POST', base, { token, body: input() })).status,
    200,
  );
  assert.equal(
    (await f.dispatch('POST', base, { token, body: input() })).status,
    429,
  );
  assert.equal(f.calls.length, 2);
});
test('capacity refuses another live account without evicting existing limits', async () => {
  const f = setup({
      limits: { read: 1, capture: 1, windowMs: 60000, capacity: 1 },
    }),
    token = await tokens.sign(actor);
  assert.equal((await f.dispatch('GET', detail, { token })).status, 200);
  assert.equal(
    (
      await f.dispatch('GET', detail, {
        token: await tokens.sign({ ...actor, sub: 'f'.repeat(24) }),
      })
    ).status,
    503,
  );
  assert.equal((await f.dispatch('GET', detail, { token })).status, 429);
  assert.equal(f.calls.length, 1);
});
test('outer namespace account limit still caps feature access', async () => {
  const f = setup(),
    token = await tokens.sign(actor);
  // Invalid protected requests consume the unchanged outer quota, no business work.
  for (let i = 0; i < 120; i++)
    assert.equal(
      (await f.dispatch('GET', base + '/bad', { token })).status,
      400,
    );
  const result = await f.dispatch('GET', detail, { token });
  assert.equal(result.status, 429);
  assert.equal(f.calls.length, 0);
});
test('feature configurations cannot loosen approved bounds', () => {
  for (const config of [
    { read: 121, capture: 60, windowMs: 60000, capacity: 10000 },
    { read: 120, capture: 61, windowMs: 60000, capacity: 10000 },
    { read: 120, capture: 60, windowMs: 60001, capacity: 10000 },
    { read: 120, capture: 60, windowMs: 60000, capacity: 10001 },
    { read: 0, capture: 60, windowMs: 60000, capacity: 10000 },
  ])
    assert.throws(() => createProposalLimits(config));
});
async function parseBody(
  method: string,
  payload: string,
  headers: Record<string, string>,
  url = '/api/v1/admin' + base,
) {
  const r = request(method, url, undefined, headers);
  r.res.setHeader('Cache-Control', 'no-store');
  try {
    return await new Promise<{ error: unknown; body: unknown }>((resolve) => {
      proposalBodyParser(r.req, r.res, (error?: unknown) =>
        resolve({ error, body: r.req.body }),
      );
      r.req.push(Buffer.from(payload));
      r.req.push(null);
    });
  } finally {
    r.dispose();
  }
}
test('proposal JSON parser inclusive131072-byte limit uses streamed bytes without a listener', async () => {
  const valid = JSON.stringify(input());
  const result = await parseBody('POST', valid, {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(valid)),
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.body, input());
  const prefix = '{"padding":"',
    suffix = '"}';
  const exact =
    prefix +
    'x'.repeat(proposalBodyLimit - prefix.length - suffix.length) +
    suffix;
  assert.equal(Buffer.byteLength(exact), proposalBodyLimit);
  assert.equal(
    (
      await parseBody('POST', exact, {
        'content-type': 'application/json',
        'content-length': String(proposalBodyLimit),
      })
    ).error,
    undefined,
  );
  const over = exact + ' ';
  const tooLarge = await parseBody('POST', over, {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(over)),
  });
  assert.equal((tooLarge.error as { status: number }).status, 413);
  const unicode = '{"padding":"' + 'é'.repeat(65536) + '"}';
  assert.equal(
    (
      (
        await parseBody('POST', unicode, {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(unicode)),
        })
      ).error as { status: number }
    ).status,
    413,
  );
});
test('stream parser rejects malformed JSON, media/charset/compression and GET transport body', async () => {
  assert.equal(
    (
      (
        await parseBody('POST', '{', {
          'content-type': 'application/json',
          'content-length': '1',
        })
      ).error as { status: number }
    ).status,
    400,
  );
  for (const headers of [
    { 'content-type': 'text/plain' },
    { 'content-type': 'application/json; charset=latin1' },
    { 'content-type': 'application/json', 'content-encoding': 'gzip' },
  ]) {
    const r = await parseBody('POST', 'x', headers);
    assert.equal((r.error as AppError).statusCode, 415);
  }
  for (const headers of [
    { 'content-length': '2' },
    { 'transfer-encoding': 'chunked' },
  ]) {
    const r = await parseBody('GET', '{}', headers, '/api/v1/admin' + detail);
    assert.equal((r.error as AppError).statusCode, 400);
  }
  for (const url of [
    '/api/v1/admin/technologies',
    '/api/v1/learning-paths',
    '/api/v1/admin/learning-path-proposals/extra/unknown',
  ]) {
    const result = await parseBody(
      'POST',
      'x',
      { 'content-type': 'text/plain' },
      url,
    );
    assert.equal(result.error, undefined);
    assert.equal(result.body, undefined);
  }
});
test('actual app middleware gives no-store on early JSON/media/size/GET-body errors without any listener', async () => {
  const app = createApp();
  for (const [method, path, payload, type, status] of [
    ['POST', '/api/v1/admin' + base, '{', 'application/json', 400],
    ['POST', '/api/v1/admin' + base, 'x', 'text/plain', 415],
    [
      'POST',
      '/api/v1/admin' + base,
      JSON.stringify({ padding: 'x'.repeat(131072) }),
      'application/json',
      413,
    ],
    ['GET', '/api/v1/admin' + detail, '{}', 'application/json', 400],
  ] as const) {
    const r = request(method, path, undefined, {
      'content-type': type,
      'content-length': String(Buffer.byteLength(payload)),
    });
    const timer = setTimeout(
      () =>
        r.finish({
          status: 599,
          body: 'OFFLINE_APP_DID_NOT_SETTLE',
          headers: r.values,
        }),
      2000,
    );
    try {
      app(r.req, r.res, (error) =>
        errorHandler(
          error ?? new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found'),
          r.req,
          r.res,
          () => {},
        ),
      );
      r.req.push(Buffer.from(payload));
      r.req.push(null);
      const result = await r.result;
      assert.equal(result.status, status);
      assert.equal(result.headers.get('cache-control'), 'no-store');
      privacy(result.body);
    } finally {
      clearTimeout(timer);
      r.dispose();
    }
  }
});
test('controller request-loss suppresses late output and disposes authority listeners', async () => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let invoked!: () => void;
  const entered = new Promise<void>((resolve) => {
    invoked = resolve;
  });
  const service: AdminLearningPathProposalService = {
    capture: async () => dto(),
    reconcile: async () => ({ state: 'UNRESOLVED' }),
    get: async (_id, _parent, authority) => {
      invoked();
      await delayed;
      assert(authority.signal?.aborted);
      return dto();
    },
  };
  const controller = createAdminLearningPathProposalController(service, {
    verify: async () => actor,
  });
  const r = request('GET', detail, undefined, {
    authorization: 'Bearer one.two.three',
  });
  r.req.auth = actor;
  let outputs = 0;
  r.res.json = () => {
    outputs++;
    return r.res;
  };
  try {
    const running = controller.get(r.req, r.res, id, technologyId);
    await entered;
    r.req.emit('aborted');
    release();
    await running;
    assert.equal(outputs, 0);
    assert.equal(r.req.listenerCount('aborted'), 0);
    assert.equal(r.res.listenerCount('close'), 0);
  } finally {
    release();
    r.dispose();
  }
});

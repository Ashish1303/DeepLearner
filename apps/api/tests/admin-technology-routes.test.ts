import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter, once } from 'node:events';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import type { Request, Response } from 'express';
import { AppError } from '../src/common/errors/app-error.js';
import { createAdminAccessService } from '../src/modules/admin/admin-access.service.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { Types } from 'mongoose';
import { createAdminTechnologyService } from '../src/modules/admin/technologies/admin-technology.service.js';
import { technologyAuthority } from '../src/modules/admin/technologies/admin-technology.controller.js';

// Synthetic offline signing configuration only; no listener, DB or fixture account.
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
const { technologyBodyParser } =
  await import('../src/modules/admin/technologies/admin-technology.routes.js');
const { env } = await import('../src/config/env.js');
const tokens = createAccessTokens(env);
const actor = {
  sub: 'a'.repeat(24),
  sid: 'b'.repeat(24),
  role: 'ADMIN' as const,
  plan: 'FREE' as const,
};
const id = 'c'.repeat(24);
const dto = {
  id,
  name: 'JS',
  slug: 'js',
  description: null,
  iconAssetId: null,
  status: 'DRAFT' as const,
  order: 0,
  revision: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
function request(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const socket = new Socket();
  const req = new IncomingMessage(socket) as Request;
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.body = body;
  Object.defineProperty(req, 'query', {
    value: Object.fromEntries(new URL(url, 'http://offline.test').searchParams),
  });
  req.requestId = 'offline';
  Object.defineProperty(req, 'ip', { value: '127.0.0.1' });
  Object.defineProperty(req, 'path', { get: () => req.url?.split('?')[0] });
  req.app = { get: () => false } as unknown as Request['app'];
  const emitter = new EventEmitter();
  const values = new Map<string, unknown>();
  const res = Object.assign(emitter, {
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
  let finish!: (value: {
    status: number;
    body: unknown;
    headers: Map<string, unknown>;
  }) => void;
  const result = new Promise<{
    status: number;
    body: unknown;
    headers: Map<string, unknown>;
  }>((resolve) => {
    finish = resolve;
  });
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
async function dispatch(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; eligible?: boolean } = {},
) {
  let calls = 0;
  let accountReads = 0;
  let createFields: string[] = [];
  const service = createAdminTechnologyService();
  service.list = async () => {
    calls++;
    return {
      items: [dto],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
  };
  service.get = async () => {
    calls++;
    return dto;
  };
  service.create = async (input) => {
    calls++;
    createFields = Object.keys(input).sort();
    return dto;
  };
  service.patch = async () => {
    calls++;
    return dto;
  };
  const gate = createAdminAccessService({
    read: async () => {
      accountReads++;
      return {
        _id: new Types.ObjectId(actor.sub),
        role: options.eligible === false ? 'STUDENT' : 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      };
    },
  });
  const router = createAdminRouter(gate, undefined, service);
  const r = request(method, path, options.body, {
    ...(options.token ? { authorization: 'Bearer ' + options.token } : {}),
  });
  const timeout = setTimeout(
    () =>
      r.finish({
        status: 599,
        body: 'OFFLINE_ROUTER_DID_NOT_SETTLE',
        headers: new Map(),
      }),
    1000,
  );
  try {
    router(r.req, r.res, (error?: unknown) => {
      if (error instanceof AppError)
        r.finish({
          status: error.statusCode,
          body: { code: error.code },
          headers: new Map([
            ['cache-control', r.res.getHeader('cache-control')],
          ]),
        });
      else
        r.finish({
          status: error ? 500 : 404,
          body: error ? 'UNEXPECTED_ERROR' : 'NOT_FOUND',
          headers: new Map(),
        });
    });
    return { ...(await r.result), calls, accountReads, createFields };
  } finally {
    clearTimeout(timeout);
    r.dispose();
  }
}

test('actual protected router refuses anonymous/Student/demoted callers before Technology work', async () => {
  const anonymous = await dispatch('GET', '/technologies');
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.calls, 0);
  assert.equal(anonymous.accountReads, 0);
  assert.equal(anonymous.headers.get('cache-control'), 'no-store');
  const student = await tokens.sign({ ...actor, role: 'STUDENT' });
  const denied = await dispatch('GET', '/technologies', { token: student });
  assert.equal(denied.status, 403);
  assert.equal(denied.calls, 0);
  const admin = await tokens.sign(actor);
  const demoted = await dispatch('POST', '/technologies', {
    token: admin,
    body: { name: 'JS', slug: 'js' },
    eligible: false,
  });
  assert.equal(demoted.status, 403);
  assert.equal(demoted.calls, 0);
  assert.equal(demoted.accountReads, 1);
});
for (const [method, path, body, status] of [
  ['GET', '/technologies', undefined, 200],
  ['GET', '/technologies/' + id, undefined, 200],
  ['POST', '/technologies', { name: 'JS', slug: 'js' }, 201],
  ['PATCH', '/technologies/' + id, { revision: 0, name: 'JS' }, 200],
] as const)
  test(`protected ${method} ${path} dispatches once after eligibility with no-store`, async () => {
    const out = await dispatch(method, path, {
      token: await tokens.sign(actor),
      body,
    });
    assert.equal(out.status, status);
    assert.equal(out.calls, 1);
    assert.equal(out.accountReads, 1);
    assert.equal(out.headers.get('cache-control'), 'no-store');
    assert(!JSON.stringify(out.body).includes('password'));
  });
for (const [method, path, body] of [
  ['GET', '/technologies?status=DRAFT', undefined],
  ['GET', '/technologies/not-an-id', undefined],
  ['POST', '/technologies', { name: 'JS', slug: 'js', status: 'PUBLISHED' }],
  ['PATCH', '/technologies/' + id, { revision: 0, slug: 'other' }],
] as const)
  test(`router rejects invalid ${method} ${path} without business dispatch`, async () => {
    const out = await dispatch(method, path, {
      token: await tokens.sign(actor),
      body,
    });
    assert.equal(out.status, 400);
    assert.equal(out.calls, 0);
  });
test('original unknown namespace route remains 404 behind eligibility', async () => {
  const out = await dispatch('GET', '/future', {
    token: await tokens.sign(actor),
  });
  assert.equal(out.status, 404);
  assert.equal(out.calls, 0);
});

test('HTTP create preserves supplied-field audit fidelity through schema defaulting', async () => {
  const token = await tokens.sign(actor);
  assert.deepEqual(
    (
      await dispatch('POST', '/technologies', {
        token,
        body: { name: 'JS', slug: 'js' },
      })
    ).createFields,
    ['name', 'slug'],
  );
  assert.deepEqual(
    (
      await dispatch('POST', '/technologies', {
        token,
        body: { name: 'JS', slug: 'js', order: 0 },
      })
    ).createFields,
    ['name', 'order', 'slug'],
  );
});

test('one router shares read/mutation quotas and refuses capacity without evicting live keys', async () => {
  const service = createAdminTechnologyService();
  service.list = async () => ({
    items: [dto],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  service.get = async () => dto;
  service.create = async () => dto;
  service.patch = async () => dto;
  const gate = createAdminAccessService({
    read: async (id) => ({
      _id: new Types.ObjectId(id),
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    }),
  });
  const router = createAdminRouter(gate, undefined, service, {
    read: 1,
    mutation: 1,
    windowMs: 60000,
    capacity: 1,
  });
  const token = await tokens.sign(actor);
  async function send(
    method: string,
    url: string,
    bearer = token,
    body?: unknown,
  ) {
    const r = request(method, url, body, { authorization: 'Bearer ' + bearer });
    const timer = setTimeout(
      () =>
        r.finish({
          status: 599,
          body: 'OFFLINE_ROUTER_DID_NOT_SETTLE',
          headers: new Map(),
        }),
      1000,
    );
    try {
      router(r.req, r.res, (error?: unknown) =>
        r.finish({
          status: error instanceof AppError ? error.statusCode : 500,
          body: null,
          headers: new Map(),
        }),
      );
      return (await r.result).status;
    } finally {
      clearTimeout(timer);
      r.dispose();
    }
  }
  assert.equal(await send('GET', '/technologies'), 200);
  assert.equal(await send('GET', '/technologies/' + id), 429);
  assert.equal(
    await send('POST', '/technologies', token, { name: 'JS', slug: 'js' }),
    201,
  );
  assert.equal(
    await send('PATCH', '/technologies/' + id, token, {
      revision: 0,
      name: 'JS',
    }),
    429,
  );
  assert.equal(
    await send(
      'GET',
      '/technologies',
      await tokens.sign({ ...actor, sub: 'd'.repeat(24) }),
    ),
    503,
  );
  assert.equal(await send('GET', '/technologies'), 429);
});

async function parseBody(
  method: string,
  payload: string,
  headers: Record<string, string>,
) {
  const r = request(method, '/api/v1/admin/technologies', undefined, headers);
  try {
    return await new Promise<{ error?: unknown; body: unknown }>((resolve) => {
      technologyBodyParser(r.req, r.res, (error?: unknown) =>
        resolve({ error, body: r.req.body }),
      );
      r.req.push(Buffer.from(payload));
      r.req.push(null);
    });
  } finally {
    r.dispose();
  }
}
test('real JSON stream parser enforces 4096 bytes without a loopback listener', async () => {
  const body = JSON.stringify({ name: 'JS', slug: 'js' });
  const result = await parseBody('POST', body, {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(body)),
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.body, { name: 'JS', slug: 'js' });
  const large = JSON.stringify({ description: 'x'.repeat(5000) });
  const refused = await parseBody('POST', large, {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(large)),
  });
  assert.equal((refused.error as { status: number }).status, 413);
});
test('parser refuses malformed JSON, unsupported media/compression, and GET body', async () => {
  const invalid = await parseBody('POST', '{', {
    'content-type': 'application/json',
    'content-length': '1',
  });
  assert.equal((invalid.error as { status: number }).status, 400);
  for (const headers of [
    { 'content-type': 'text/plain', 'content-length': '1' },
    {
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'content-length': '1',
    },
  ]) {
    const result = await parseBody('POST', 'x', headers);
    assert.equal((result.error as AppError).statusCode, 415);
  }
  const get = await parseBody('GET', '{}', { 'content-length': '2' });
  assert.equal((get.error as AppError).statusCode, 400);
});
test('transient proof is request-bound and listeners removed on disposal', async () => {
  const r = request('POST', '/', undefined, {
    authorization: 'Bearer one.two.three',
  });
  let selected = '';
  const resource = technologyAuthority(r.req, r.res, {
    verify: async (value) => {
      selected = value;
      return actor;
    },
  });
  await resource.authority.verify();
  assert.equal(selected, 'one.two.three');
  assert.equal(r.req.listenerCount('aborted'), 1);
  resource.dispose();
  assert.equal(r.req.listenerCount('aborted'), 0);
  assert.equal(r.res.listenerCount('close'), 0);
  assert.equal(resource.authority.signal?.aborted, true);
  r.dispose();
});

test(
  'real app HTTP enforces protected Technology endpoints, parser limits, no-store and owned listener cleanup',
  { timeout: 10000 },
  async () => {
    const { createApp } = await import('../src/app.js');
    let calls = 0;
    const service = createAdminTechnologyService();
    service.list = async () => {
      calls++;
      return {
        items: [dto],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
    };
    service.get = async () => {
      calls++;
      return dto;
    };
    service.create = async (input) => {
      calls++;
      assert.deepEqual(Object.keys(input).sort(), ['name', 'slug']);
      return dto;
    };
    service.patch = async () => {
      calls++;
      return { ...dto, revision: 1 };
    };
    const gate = createAdminAccessService({
      read: async () => ({
        _id: new Types.ObjectId(actor.sub),
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      }),
    });
    const args: Parameters<typeof createApp> = [];
    args[28] = gate;
    args[30] = service;
    const server = createApp(...args).listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      assert(address && typeof address !== 'string');
      const base = `http://127.0.0.1:${address.port}/api/v1/admin/technologies`;
      const token = await tokens.sign(actor);
      async function send(path: string, init: RequestInit = {}) {
        const response = await fetch(base + path, {
          ...init,
          signal: AbortSignal.timeout(2000),
          headers: { authorization: 'Bearer ' + token, ...init.headers },
        });
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const body: unknown = await response.json();
        return { response, body };
      }
      const list = await send('');
      assert.equal(list.response.status, 200);
      assert.equal((list.body as { data: unknown[] }).data.length, 1);
      assert.equal((await send('/' + id)).response.status, 200);
      assert.equal(
        (
          await send('', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'JS', slug: 'js' }),
          })
        ).response.status,
        201,
      );
      assert.equal(
        (
          await send('/' + id, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ revision: 0, name: 'JS' }),
          })
        ).response.status,
        200,
      );
      assert.equal(calls, 4);
      assert.equal(
        (
          await send('', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: 'JS',
              slug: 'js',
              description: 'x'.repeat(5000),
            }),
          })
        ).response.status,
        413,
      );
      assert.equal(
        (
          await send('', {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: 'x',
          })
        ).response.status,
        415,
      );
      assert.equal(
        (
          await send('', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{',
          })
        ).response.status,
        400,
      );
      assert.equal(
        (await send('', { headers: { authorization: 'Bearer bad' } })).response
          .status,
        401,
      );
      const cors = await send('', {
        headers: { Origin: 'https://unapproved.invalid' },
      });
      assert.equal(cors.response.status, 403);
      assert.equal(calls, 4);
    } finally {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
      assert.equal(server.listening, false);
    }
  },
);

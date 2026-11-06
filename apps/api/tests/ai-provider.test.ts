import assert from 'node:assert/strict';
import { test, mock, type TestContext } from 'node:test';
import { getEventListeners } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import workerThreads from 'node:worker_threads';
import { syncBuiltinESMExports } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createFakeAiProvider } from './helpers/fake-ai-provider.js';
import type {
  AiProvider,
  AiProviderErrorCode,
  AiProviderOutcome,
  AiProviderRequest,
} from '../src/modules/ai/ai-provider.contract.js';

let createExecutor: typeof import('../src/modules/ai/ai-provider.executor.js').createAiProviderExecutor;
const effects: string[] = [];
try {
  function forbidden() {
    effects.push('FORBIDDEN_EFFECT');
    throw new Error('SYNTHETIC_PRIVATE_CANARY');
  }
  mock.method(net, 'connect', forbidden);
  mock.method(net, 'createConnection', forbidden);
  mock.method(net, 'createServer', forbidden);
  mock.method(net.Socket.prototype, 'connect', forbidden);
  mock.method(net.Server.prototype, 'listen', forbidden);
  mock.method(tls, 'connect', forbidden);
  mock.method(tls, 'createServer', forbidden);
  mock.method(http, 'request', forbidden);
  mock.method(http, 'get', forbidden);
  mock.method(https, 'request', forbidden);
  mock.method(https, 'get', forbidden);
  mock.method(dgram, 'createSocket', forbidden);
  mock.method(childProcess, 'spawn', forbidden);
  mock.method(childProcess, 'spawnSync', forbidden);
  mock.method(childProcess, 'exec', forbidden);
  mock.method(childProcess, 'execSync', forbidden);
  mock.method(childProcess, 'execFile', forbidden);
  mock.method(childProcess, 'execFileSync', forbidden);
  mock.method(childProcess, 'fork', forbidden);
  mock.method(workerThreads, 'Worker', forbidden);
  mock.method(globalThis, 'fetch', forbidden);
  syncBuiltinESMExports();
  createExecutor = (await import('../src/modules/ai/ai-provider.executor.js'))
    .createAiProviderExecutor;
  assert.deepEqual(effects, []);
} finally {
  mock.restoreAll();
  syncBuiltinESMExports();
}

function request(): AiProviderRequest {
  return {
    schemaVersion: 1,
    purpose: 'CURRICULUM_OUTLINE',
    instructions: 'Produce synthetic outline JSON for a unit test.',
    inputJson: '{"synthetic":true}',
    maxOutputBytes: 65_536,
    maxOutputTokens: 4096,
  };
}
function envelope() {
  return {
    text: '{"syntheticOutline":true}',
    finishReason: 'COMPLETE',
    usage: { inputTokens: 3, outputTokens: 5 },
  };
}
function refusal(
  value: AiProviderOutcome,
  code: AiProviderErrorCode,
  invocation: 'NOT_STARTED' | 'STARTED' = 'NOT_STARTED',
) {
  assert.deepEqual(value, {
    ok: false,
    error: {
      code,
      message: 'AI provider request could not be completed',
      invocation,
    },
  });
  assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE_CANARY'));
}
function ready(value: unknown = envelope()) {
  const fake = createFakeAiProvider({ kind: 'response', value });
  return { fake, executor: createExecutor(fake.provider, { now: () => 0 }) };
}
async function invalid(input: unknown) {
  const { fake, executor } = ready();
  refusal(await executor.execute(input, { budgetMs: 100 }), 'INVALID_REQUEST');
  assert.equal(fake.calls.length, 0);
}
async function malformed(value: unknown) {
  const { fake, executor } = ready(value);
  refusal(
    await executor.execute(request(), { budgetMs: 100 }),
    'MALFORMED_RESPONSE',
    'STARTED',
  );
  assert.equal(fake.calls.length, 1);
}
function timerChecks(t: TestContext, signal: AbortSignal) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const start = t.mock.method(globalThis, 'setTimeout');
  const clear = t.mock.method(globalThis, 'clearTimeout');
  return () => {
    assert.equal(getEventListeners(signal, 'abort').length, 0);
    assert.equal(start.mock.callCount(), 1);
    assert.equal(clear.mock.callCount(), 1);
    assert.equal(
      clear.mock.calls[0]?.arguments[0],
      start.mock.calls[0]?.result,
    );
  };
}

test('production imports are inert and create no live provider registration', () => {
  assert.deepEqual(effects, []);
  const allowed = new Map([
    ['ai-provider.contract.ts', []],
    [
      'ai-provider.executor.ts',
      ['node:util', 'node:buffer', './ai-provider.contract.js'],
    ],
  ]);
  for (const [name, expected] of allowed) {
    const source = readFileSync(
      new URL('../src/modules/ai/' + name, import.meta.url),
      'utf8',
    );
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    const imports: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        assert(ts.isStringLiteral(node.moduleSpecifier));
        imports.push(node.moduleSpecifier.text);
      }
      assert(
        !(
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword
        ),
      );
      if (ts.isIdentifier(node))
        assert(
          ![
            'fetch',
            'process',
            'require',
            'setInterval',
            'localStorage',
            'console',
          ].includes(node.text),
        );
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.deepEqual(imports, expected);
  }
  const config = JSON.parse(
    readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(config.include, ['src/**/*.ts']);
});

test('success returns exact detached technical data, preserving untrusted JSON and null usage', async () => {
  const response = {
    ...envelope(),
    text: ' { "extraDomainFields": [1] } ',
    usage: { inputTokens: null, outputTokens: null },
  };
  const { executor, fake } = ready(response);
  const result = await executor.execute(request(), { budgetMs: 1 });
  assert.deepEqual(result, {
    ok: true,
    untrustedJson: response.text,
    usage: { inputTokens: null, outputTokens: null },
    elapsedMs: 0,
  });
  assert(result.ok);
  assert.notEqual(result.usage, response.usage);
  assert.equal(fake.calls.length, 1);
});
test('unchanged synthetic inputs produce deterministic results without retry or provider selection', async () => {
  const { executor, fake } = ready();
  const first = await executor.execute(request(), { budgetMs: 100 });
  const second = await executor.execute(request(), { budgetMs: 100 });
  assert.deepEqual(first, second);
  assert.equal(fake.calls.length, 2); // Two explicit calls, never an internal retry.
});
test('request is detached/frozen, and caller changes cannot alter validated dispatched facts', async () => {
  const input = request();
  const { executor, fake } = ready();
  const run = executor.execute(input, { budgetMs: 100 });
  input.maxOutputTokens = 1;
  input.instructions = 'SYNTHETIC_PRIVATE_CANARY';
  const outcome = await run;
  assert(outcome.ok);
  const call = fake.calls[0];
  assert(call);
  assert.notEqual(call.request, input);
  assert(Object.isFrozen(call.request));
  assert.equal(call.request.maxOutputTokens, 4096);
  assert(!call.request.instructions.includes('CANARY'));
  assert.throws(() => {
    (call.request as AiProviderRequest).maxOutputTokens = 1;
  }, TypeError);
});
test('null-prototype inert records are accepted', async () => {
  const input = Object.assign(Object.create(null) as object, request());
  const value = Object.assign(Object.create(null) as object, envelope(), {
    usage: Object.assign(Object.create(null) as object, envelope().usage),
  });
  const { executor } = ready(value);
  assert((await executor.execute(input, { budgetMs: 100 })).ok);
});

for (const [field, valid, invalids] of [
  ['schemaVersion', [1], [0, 2, '1', null]],
  [
    'purpose',
    ['CURRICULUM_OUTLINE'],
    ['LESSON', 'curriculum_outline', 'CURRICULUM_OUTLINE\n', null],
  ],
  [
    'instructions',
    ['a', '\tvalid\n', 'x'.repeat(8192), 'é'.repeat(4096), '😀'.repeat(2048)],
    [
      '',
      ' \n\t',
      'x'.repeat(8193),
      'é'.repeat(4096) + 'a',
      '\ud800',
      '\udc00',
      'ok\rtext',
      'ok\0text',
      'ok\u007ftext',
      new String('text'),
    ],
  ],
  [
    'inputJson',
    [
      '{}',
      '{"s":"' + 'x'.repeat(65_528) + '"}',
      '{"s":"' + 'é'.repeat(32_764) + '"}',
      '{"x":"\\ud800"}',
    ],
    [
      '',
      '{',
      'null',
      '[]',
      '1',
      '"object"',
      'true',
      '{"s":"' + 'x'.repeat(65_529) + '"}',
      '{"s":"\ud800"}',
      {},
    ],
  ],
  [
    'maxOutputBytes',
    [2, 65_536],
    [0, 1, 65_537, 2.5, NaN, Infinity, '2', null],
  ],
  ['maxOutputTokens', [1, 4096], [0, -1, 4097, 1.5, NaN, Infinity, '1', null]],
] as const) {
  for (const [i, value] of valid.entries()) {
    test(`request ${field} valid boundary ${i}`, async () => {
      const response = {
        text: '{}',
        finishReason: 'COMPLETE',
        usage: { inputTokens: 0, outputTokens: 1 },
      };
      const { executor, fake } = ready(response);
      assert(
        (
          await executor.execute(
            { ...request(), [field]: value },
            { budgetMs: 100 },
          )
        ).ok,
      );
      assert.equal(fake.calls.length, 1);
    });
  }
  for (const [i, value] of invalids.entries()) {
    test(`request ${field} invalid boundary ${i}`, () =>
      invalid({ ...request(), [field]: value }));
  }
}

for (const key of Object.keys(request())) {
  test(`missing request ${key} refuses before dispatch`, async () => {
    const row = { ...request() } as Record<string, unknown>;
    delete row[key];
    await invalid(row);
  });
}
for (const [i, key] of [
  'extra',
  '$set',
  'actor',
  'model',
  'accessToken',
  '__proto__',
  'purpose.task',
  Symbol('private'),
].entries()) {
  test(`extra request field ${i} rejects before projection`, async () => {
    const row = request();
    Object.defineProperty(row, key, {
      value: 'SYNTHETIC_PRIVATE_CANARY',
      enumerable: true,
    });
    await invalid(row);
  });
}
for (const [i, value] of [
  null,
  [],
  Object.create(request()),
  new Date(),
  1,
  'request',
  new Proxy(request(), {}),
].entries()) {
  test(`non-inert request ${i} refuses`, () => invalid(value));
}
test('revoked proxies refuse without invoking traps', async () => {
  const pair = Proxy.revocable(request(), {});
  pair.revoke();
  await invalid(pair.proxy);
  let traps = 0;
  await invalid(
    new Proxy(request(), {
      ownKeys() {
        traps++;
        throw new Error('private');
      },
    }),
  );
  assert.equal(traps, 0);
});
for (const key of Object.keys(request())) {
  test(`request getter ${key} is never invoked`, async () => {
    let reads = 0;
    const row = request();
    Object.defineProperty(row, key, {
      enumerable: true,
      get() {
        reads++;
        throw new Error('private');
      },
    });
    await invalid(row);
    assert.equal(reads, 0);
  });
}
test('nonenumerable request data refuses', async () => {
  const row = request();
  Object.defineProperty(row, 'purpose', { enumerable: false });
  await invalid(row);
});
for (const [i, budgetMs] of [
  0,
  -1,
  10_001,
  1.5,
  NaN,
  Infinity,
  '100',
  null,
  undefined,
].entries()) {
  test(`invalid execution budget ${i} never dispatches`, async () => {
    const { executor, fake } = ready();
    refusal(
      await executor.execute(request(), { budgetMs: budgetMs as number }),
      'INVALID_REQUEST',
    );
    assert.equal(fake.calls.length, 0);
  });
}
test('changing budget getter is read once and cannot widen the validated deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reads = 0;
  let time = 0;
  const fake = createFakeAiProvider({ kind: 'deferred' });
  const executor = createExecutor(fake.provider, { now: () => time });
  const result = executor.execute(request(), {
    get budgetMs() {
      return ++reads === 1 ? 100 : 100_000;
    },
  });
  await Promise.resolve();
  assert.equal(reads, 1);
  assert.equal(fake.calls.length, 1);
  time = 20_000;
  fake.resolve(envelope());
  refusal(await result, 'DEADLINE_EXCEEDED', 'STARTED');
  assert.equal(reads, 1);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0]?.signal.aborted, true);
});

test('changing budget getter cannot widen the scheduled timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reads = 0;
  const fake = createFakeAiProvider({ kind: 'deferred' });
  const result = createExecutor(fake.provider, { now: () => 0 }).execute(
    request(),
    {
      get budgetMs() {
        return ++reads === 1 ? 100 : 100_000;
      },
    },
  );
  let settled = false;
  void result.then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(reads, 1);
  assert.equal(fake.calls.length, 1);
  t.mock.timers.tick(99);
  assert.equal(fake.calls[0]?.signal.aborted, false);
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  assert.equal(fake.calls[0]?.signal.aborted, true);
  refusal(await result, 'DEADLINE_EXCEEDED', 'STARTED');
  fake.resolve(envelope());
  await Promise.resolve();
  assert.equal(reads, 1);
  assert.equal(fake.calls.length, 1);
});

test('invalid first budget getter value refuses without reading a later valid value', async () => {
  let reads = 0;
  const { executor, fake } = ready();
  refusal(
    await executor.execute(request(), {
      get budgetMs() {
        return ++reads === 1 ? 10_001 : 100;
      },
    }),
    'INVALID_REQUEST',
  );
  assert.equal(reads, 1);
  assert.equal(fake.calls.length, 0);
});

test('maximum local budget is accepted without introducing a live call', async () => {
  const { executor } = ready();
  assert((await executor.execute(request(), { budgetMs: 10_000 })).ok);
});

for (const [i, value] of [
  null,
  [],
  new Date(),
  3,
  'response',
  new Proxy(envelope(), {}),
  { ...envelope(), extra: 'private' },
  { ...envelope(), finishReason: 'complete' },
  { ...envelope(), text: [] },
  { ...envelope(), text: '\ud800' },
  { ...envelope(), text: 'x'.repeat(65_537) },
  { ...envelope(), text: '[]' },
  { ...envelope(), text: 'null' },
  { ...envelope(), text: 'true' },
  { ...envelope(), text: '{}' + 'x' },
  { ...envelope(), text: '' },
].entries()) {
  test(`malformed response ${i} is sanitized and not retried`, () =>
    malformed(value));
}
for (const [i, value] of [
  null,
  {},
  [],
  { inputTokens: 1 },
  { inputTokens: 1, outputTokens: 1, private: 'SYNTHETIC_PRIVATE_CANARY' },
  { inputTokens: -1, outputTokens: 0 },
  { inputTokens: 0, outputTokens: -1 },
  { inputTokens: Infinity, outputTokens: 0 },
  { inputTokens: 0, outputTokens: NaN },
  { inputTokens: '1', outputTokens: 0 },
  { inputTokens: 0, outputTokens: Number.MAX_SAFE_INTEGER + 1 },
].entries()) {
  test(`invalid usage ${i} rejects raw envelope before projection`, () =>
    malformed({ ...envelope(), usage: value }));
}
for (const level of ['response', 'usage'] as const) {
  test(`nested ${level} getters/private symbols refuse without reads`, async () => {
    for (const symbol of [false, true]) {
      const value = envelope();
      const target = level === 'response' ? value : value.usage;
      let reads = 0;
      Object.defineProperty(
        target,
        symbol ? Symbol('private') : Object.keys(target)[0]!,
        {
          enumerable: true,
          get() {
            reads++;
            throw new Error('SYNTHETIC_PRIVATE_CANARY');
          },
        },
      );
      await malformed(value);
      assert.equal(reads, 0);
    }
  });
}
test('response and nested usage missing keys, proxies and inherited values fail closed', async () => {
  for (const path of ['text', 'finishReason', 'usage']) {
    const value = envelope() as Record<string, unknown>;
    delete value[path];
    await malformed(value);
  }
  await malformed({ ...envelope(), usage: new Proxy(envelope().usage, {}) });
  await malformed({ ...envelope(), usage: Object.create(envelope().usage) });
});
for (const [finishReason, code] of [
  ['OUTPUT_LIMIT', 'OUTPUT_LIMIT'],
  ['REFUSED', 'REFUSED'],
] as const) {
  test(`valid ${finishReason} envelope cannot succeed or retry`, async () => {
    const { executor, fake } = ready({ ...envelope(), text: '', finishReason });
    refusal(
      await executor.execute(request(), { budgetMs: 100 }),
      code,
      'STARTED',
    );
    assert.equal(fake.calls.length, 1);
  });
}
test('output byte/token limits and exact global ceiling are enforced', async () => {
  const max = '{"s":"' + 'é'.repeat(32_764) + '"}';
  assert.equal(Buffer.byteLength(max), 65_536);
  const { executor } = ready({ ...envelope(), text: max });
  assert((await executor.execute(request(), { budgetMs: 100 })).ok);
  const small = ready();
  refusal(
    await small.executor.execute(
      { ...request(), maxOutputBytes: 2 },
      { budgetMs: 100 },
    ),
    'OUTPUT_LIMIT',
    'STARTED',
  );
  const tokens = ready({
    ...envelope(),
    usage: { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 4097 },
  });
  refusal(
    await tokens.executor.execute(request(), { budgetMs: 100 }),
    'OUTPUT_LIMIT',
    'STARTED',
  );
});
test('synchronous exceptions and asynchronous provider rejections expose no raw data', async () => {
  const secret = new Error('SYNTHETIC_PRIVATE_CANARY', {
    cause: { token: 'SYNTHETIC_PRIVATE_CANARY' },
  });
  for (const provider of [
    {
      generate() {
        throw secret;
      },
    },
    createFakeAiProvider({ kind: 'reject', reason: secret }).provider,
    {
      generate() {
        return Promise.reject({ stack: 'SYNTHETIC_PRIVATE_CANARY' });
      },
    },
  ] satisfies AiProvider[]) {
    refusal(
      await createExecutor(provider, { now: () => 0 }).execute(request(), {
        budgetMs: 100,
      }),
      'PROVIDER_FAILED',
      'STARTED',
    );
  }
});

test('pre-aborted and microtask-cancelled requests never invoke provider', async () => {
  for (const pre of [true, false]) {
    const abort = new AbortController();
    const { executor, fake } = ready();
    if (pre) abort.abort();
    const run = executor.execute(request(), {
      budgetMs: 100,
      signal: abort.signal,
    });
    if (!pre) abort.abort();
    refusal(await run, 'CANCELLED');
    assert.equal(fake.calls.length, 0);
    assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
  }
});
for (const late of ['resolve', 'reject'] as const) {
  test(`in-flight cancellation suppresses late ${late} and cleans resources`, async (t) => {
    const abort = new AbortController();
    const clean = timerChecks(t, abort.signal);
    const fake = createFakeAiProvider({ kind: 'deferred' });
    const executor = createExecutor(fake.provider, { now: () => 0 });
    const run = executor.execute(request(), {
      budgetMs: 100,
      signal: abort.signal,
    });
    await Promise.resolve();
    assert.equal(fake.calls.length, 1);
    assert.equal(getEventListeners(abort.signal, 'abort').length, 1);
    abort.abort();
    abort.abort();
    const result = await run;
    refusal(result, 'CANCELLED', 'STARTED');
    assert(fake.calls[0]?.signal.aborted);
    clean();
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', listener);
    t.after(() => process.removeListener('unhandledRejection', listener));
    if (late === 'resolve') fake.resolve(envelope());
    else fake.reject(new Error('SYNTHETIC_PRIVATE_CANARY'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
    refusal(result, 'CANCELLED', 'STARTED');
    assert.equal(fake.calls.length, 1);
  });
}
test('ignoring provider cannot keep local timeout pending or cause an unsafe replay', async (t) => {
  const abort = new AbortController();
  const clean = timerChecks(t, abort.signal);
  let time = 0;
  const fake = createFakeAiProvider({ kind: 'deferred' });
  const run = createExecutor(fake.provider, { now: () => time }).execute(
    request(),
    { budgetMs: 100, signal: abort.signal },
  );
  await Promise.resolve();
  assert.equal(fake.calls.length, 1);
  time = 100;
  t.mock.timers.tick(100);
  const result = await run;
  refusal(result, 'DEADLINE_EXCEEDED', 'STARTED');
  clean();
  assert(fake.calls[0]?.signal.aborted);
  fake.resolve(envelope());
  await Promise.resolve();
  assert.equal(fake.calls.length, 1);
});
test('late timeout rejection is observed even after local result returned', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fake = createFakeAiProvider({ kind: 'deferred' });
  const run = createExecutor(fake.provider, { now: () => 0 }).execute(
    request(),
    { budgetMs: 10 },
  );
  await Promise.resolve();
  t.mock.timers.tick(10);
  refusal(await run, 'DEADLINE_EXCEEDED', 'STARTED');
  fake.reject(new Error('SYNTHETIC_PRIVATE_CANARY'));
  await new Promise<void>((resolve) => setImmediate(resolve));
});
test('success clears the sole timer/listener before a later tick or abort', async (t) => {
  const abort = new AbortController();
  const clean = timerChecks(t, abort.signal);
  const { executor, fake } = ready();
  const result = await executor.execute(request(), {
    budgetMs: 100,
    signal: abort.signal,
  });
  assert(result.ok);
  clean();
  t.mock.timers.tick(1000);
  abort.abort();
  assert.equal(fake.calls[0]?.signal.aborted, false);
  assert(result.ok);
});
test('rejection and malformed response clear timers/listeners too', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const scenario of [
    { kind: 'reject', reason: new Error('private') },
    { kind: 'response', value: { secret: 'private' } },
  ] as const) {
    const abort = new AbortController();
    const fake = createFakeAiProvider(scenario);
    const run = createExecutor(fake.provider, { now: () => 0 });
    assert(
      !(await run.execute(request(), { budgetMs: 100, signal: abort.signal }))
        .ok,
    );
    assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
  }
});
test('already observed cancellation wins, while later cancellation cannot relabel timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const cancelFirst of [true, false]) {
    const abort = new AbortController();
    const fake = createFakeAiProvider({ kind: 'deferred' });
    const run = createExecutor(fake.provider, { now: () => 0 }).execute(
      request(),
      { budgetMs: 10, signal: abort.signal },
    );
    await Promise.resolve();
    if (cancelFirst) abort.abort();
    t.mock.timers.tick(10);
    if (!cancelFirst) abort.abort();
    refusal(
      await run,
      cancelFirst ? 'CANCELLED' : 'DEADLINE_EXCEEDED',
      'STARTED',
    );
    fake.resolve(envelope());
  }
});
test('deadline after validation but before dispatch refuses a queued call', async () => {
  let reads = 0;
  const { fake } = ready();
  const result = await createExecutor(fake.provider, {
    now: () => (++reads < 4 ? 0 : 100),
  }).execute(request(), { budgetMs: 100 });
  refusal(result, 'DEADLINE_EXCEEDED');
  assert.equal(fake.calls.length, 0);
});
test('response arriving exactly at deadline never becomes success', async () => {
  let time = 0;
  const fake = createFakeAiProvider({ kind: 'deferred' });
  const run = createExecutor(fake.provider, { now: () => time }).execute(
    request(),
    { budgetMs: 100 },
  );
  await Promise.resolve();
  time = 100;
  fake.resolve(envelope());
  refusal(await run, 'DEADLINE_EXCEEDED', 'STARTED');
});
for (const [i, current] of [NaN, Infinity, -1, 9].entries()) {
  test(`invalid/regressing clock ${i} cannot dispatch`, async () => {
    let reads = 0;
    const { fake } = ready();
    const result = await createExecutor(fake.provider, {
      now: () => (reads++ === 0 ? 10 : current),
    }).execute(request(), { budgetMs: 100 });
    refusal(result, 'PROVIDER_FAILED');
    assert.equal(fake.calls.length, 0);
  });
}
test('initial clock throw is a safe provider failure, not invalid request', async () => {
  const { fake } = ready();
  const result = await createExecutor(fake.provider, {
    now() {
      throw new Error('SYNTHETIC_PRIVATE_CANARY');
    },
  }).execute(request(), { budgetMs: 100 });
  refusal(result, 'PROVIDER_FAILED');
  assert.equal(fake.calls.length, 0);
});
test('clock regression after provider completion refuses the result', async () => {
  let time = 10;
  const fake = createFakeAiProvider({ kind: 'deferred' });
  const run = createExecutor(fake.provider, { now: () => time }).execute(
    request(),
    { budgetMs: 100 },
  );
  await Promise.resolve();
  time = 9;
  fake.resolve(envelope());
  refusal(await run, 'PROVIDER_FAILED', 'STARTED');
});
test('failed timer removal cannot turn missing cleanup into success', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const realClear = globalThis.clearTimeout;
  t.mock.method(
    globalThis,
    'clearTimeout',
    (...args: Parameters<typeof clearTimeout>) => {
      realClear(...args);
      throw new Error('SYNTHETIC_PRIVATE_CANARY');
    },
  );
  const { executor } = ready();
  refusal(
    await executor.execute(request(), { budgetMs: 100 }),
    'PROVIDER_FAILED',
    'STARTED',
  );
});

test('every C0 character and DEL follows the LF/tab-only instruction rule', async () => {
  for (const code of [...Array.from({ length: 32 }, (_, i) => i), 127]) {
    const input = {
      ...request(),
      instructions: 'a' + String.fromCharCode(code) + 'b',
    };
    const { executor, fake } = ready();
    const result = await executor.execute(input, { budgetMs: 100 });
    if (code === 9 || code === 10) {
      assert(result.ok);
      assert.equal(fake.calls.length, 1);
    } else {
      refusal(result, 'INVALID_REQUEST');
      assert.equal(fake.calls.length, 0);
    }
  }
});

test('executor observes a bare provider rejection after cancellation without fake-owned catch', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const unhandled: unknown[] = [];
  const listener = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', listener);
  t.after(() => process.removeListener('unhandledRejection', listener));
  let reject: (reason: unknown) => void = () => {};
  const bare = new Promise<unknown>((_, no) => {
    reject = no;
  });
  let calls = 0;
  const provider: AiProvider = {
    generate() {
      calls++;
      return bare;
    },
  };
  const abort = new AbortController();
  const run = createExecutor(provider, { now: () => 0 }).execute(request(), {
    budgetMs: 100,
    signal: abort.signal,
  });
  await Promise.resolve();
  assert.equal(calls, 1);
  abort.abort();
  const outcome = await run;
  refusal(outcome, 'CANCELLED', 'STARTED');
  reject(new Error('SYNTHETIC_PRIVATE_CANARY'));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(unhandled, []);
  assert.equal(calls, 1);
  assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
});

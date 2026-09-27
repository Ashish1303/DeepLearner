import assert from 'node:assert/strict';
import { test } from 'node:test';
import pino from 'pino';
import { createLifecycle } from '../src/bootstrap.js';

function fixture() {
  const calls: string[] = [];
  const logs: string[] = [];
  let timeout = () => {};
  const deps = {
    database: {
      connect: async () => {
        calls.push('connect');
      },
      disconnect: async () => {
        calls.push('disconnect');
      },
    },
    listen: async () => {
      calls.push('listen');
    },
    closeHTTP: async () => {
      calls.push('drain');
    },
    log: pino(
      { base: null },
      {
        write: (line: string) => {
          logs.push(line);
        },
      },
    ),
    exit: (code: number) => {
      calls.push(`exit:${code}`);
    },
    forceExit: (code: number) => {
      calls.push(`force:${code}`);
    },
    deadline: (callback: () => void) => {
      timeout = callback;
      return () => {
        calls.push('cancel');
      };
    },
  };
  return { deps, calls, logs, expire: () => timeout() };
}

test('connect precedes HTTP; repeated starts/stops share work and drain before disconnect', async () => {
  const f = fixture();
  const lifecycle = createLifecycle(f.deps);
  const start = lifecycle.start();
  assert.equal(start, lifecycle.start());
  await start;
  const stop = lifecycle.stop();
  assert.equal(stop, lifecycle.stop());
  await stop;
  assert.deepEqual(f.calls, [
    'connect',
    'listen',
    'drain',
    'disconnect',
    'cancel',
    'exit:0',
  ]);
});

test('initial connection and binding failures clean up and exit nonzero without raw errors', async () => {
  for (const stage of ['connect', 'listen'] as const) {
    const f = fixture();
    const fail = async () => {
      f.calls.push(stage);
      throw new Error('SECRET_SENTINEL');
    };
    if (stage === 'connect') f.deps.database.connect = fail;
    else f.deps.listen = fail;
    await createLifecycle(f.deps).start();
    assert.deepEqual(f.calls, [
      ...(stage === 'connect' ? ['connect'] : ['connect', 'listen']),
      'drain',
      'disconnect',
      'cancel',
      'exit:1',
    ]);
    assert(!f.logs.join('').includes('SECRET_SENTINEL'));
  }
});

test('signals during pending startup prevent a late listener and still disconnect', async () => {
  const f = fixture();
  let resolvePending = () => {};
  const pending = {
    promise: new Promise<void>((resolve) => {
      resolvePending = resolve;
    }),
    resolve: () => resolvePending(),
  };
  f.deps.database.connect = () => pending.promise;
  const lifecycle = createLifecycle(f.deps);
  const start = lifecycle.start();
  const stop = lifecycle.stop();
  pending.resolve();
  await Promise.all([start, stop]);
  assert.deepEqual(f.calls, ['drain', 'disconnect', 'cancel', 'exit:0']);
});

test('HTTP drain failure still disconnects; disconnect failure exits nonzero', async () => {
  for (const stage of ['drain', 'disconnect']) {
    const f = fixture();
    const fail = async () => {
      f.calls.push(stage);
      throw new Error('SECRET_SENTINEL');
    };
    if (stage === 'drain') f.deps.closeHTTP = fail;
    else f.deps.database.disconnect = fail;
    const lifecycle = createLifecycle(f.deps);
    await lifecycle.start();
    await lifecycle.stop();
    assert.deepEqual(f.calls, [
      'connect',
      'listen',
      'drain',
      'disconnect',
      'cancel',
      'exit:1',
    ]);
    assert(!f.logs.join('').includes('SECRET_SENTINEL'));
  }
});

test('shutdown deadline forces failure during pending startup without later success exit', async () => {
  const f = fixture();
  let resolvePending = () => {};
  const pending = {
    promise: new Promise<void>((resolve) => {
      resolvePending = resolve;
    }),
    resolve: () => resolvePending(),
  };
  f.deps.database.connect = () => pending.promise;
  const lifecycle = createLifecycle(f.deps);
  const start = lifecycle.start();
  const stop = lifecycle.stop();
  f.expire();
  assert.deepEqual(f.calls, ['force:1']);
  pending.resolve();
  await Promise.all([start, stop]);
  assert(!f.calls.includes('listen'));
  assert(!f.calls.includes('exit:0'));
});

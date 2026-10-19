import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgressController } from '../src/lib/progress/progress-controller';
import type { AuthController } from '../src/lib/auth/auth-controller';
import type { ProgressData } from '../src/lib/progress/contracts';
const id = 'a'.repeat(24),
  account = 'b'.repeat(24);
const empty: ProgressData = {
  conceptId: id,
  status: 'NOT_STARTED',
  attemptCount: 0,
  startedAt: null,
  lastActivityAt: null,
};
const auth = {
  async runAuthenticatedRead<T>(
    expected: string,
    signal: AbortSignal,
    operation: (token: string, signal: AbortSignal) => Promise<T>,
  ) {
    assert.equal(expected, account);
    signal.throwIfAborted();
    return operation('t', signal);
  },
} as Pick<AuthController, 'runAuthenticatedRead'>;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
test('loading, zero, in-progress and Retry state transitions remain activity-only', async () => {
  let calls = 0,
    fail = true;
  const controller = createProgressController(
    {
      async load() {
        calls++;
        if (fail) throw Error('SECRET');
        return empty;
      },
    },
    auth,
    account,
    id,
  );
  assert.equal(controller.getSnapshot().status, 'loading');
  await controller.load();
  assert.deepEqual(controller.getSnapshot(), { status: 'error', data: null });
  fail = false;
  await controller.retry();
  assert.equal(controller.getSnapshot().data?.attemptCount, 0);
  assert.equal(calls, 2);
});
test('superseded success and error cannot overwrite the newest Concept response', async () => {
  for (const fails of [false, true]) {
    const first = deferred<ProgressData>();
    let calls = 0,
      old: AbortSignal | undefined;
    const controller = createProgressController(
      {
        async load(_id, _token, signal) {
          calls++;
          if (calls === 1) {
            old = signal;
            return first.promise;
          }
          return empty;
        },
      },
      auth,
      account,
      id,
    );
    const stale = controller.load();
    await controller.retry();
    assert(old?.aborted);
    if (fails) first.reject(Error('old private error'));
    else first.resolve({ ...empty, attemptCount: 4 });
    await stale;
    assert.deepEqual(controller.getSnapshot(), {
      status: 'ready',
      data: empty,
    });
  }
});
test('account/Concept controller disposal clears data and rejects delayed responses', async () => {
  const held = deferred<ProgressData>();
  let signal: AbortSignal | undefined;
  const controller = createProgressController(
    {
      async load(_id, _token, s) {
        signal = s;
        return held.promise;
      },
    },
    auth,
    account,
    id,
  );
  const pending = controller.load();
  controller.cancel();
  assert(signal?.aborted);
  held.resolve(empty);
  await pending;
  assert.deepEqual(controller.getSnapshot(), { status: 'loading', data: null });
});
test('invalid identity or malformed success never displays a zero fallback', async () => {
  const controller = createProgressController(
    {
      async load() {
        return { ...empty, conceptId: 'c'.repeat(24) };
      },
    },
    auth,
    account,
    id,
  );
  await controller.load();
  assert.deepEqual(controller.getSnapshot(), { status: 'error', data: null });
  const invalid = createProgressController(
    {
      async load() {
        throw Error('must not load');
      },
    },
    auth,
    account,
    'bad',
  );
  await invalid.load();
  assert.equal(invalid.getSnapshot().status, 'error');
});
test('authenticated adapter identity refusal prevents any progress request', async () => {
  let calls = 0;
  const controller = createProgressController(
    {
      async load() {
        calls++;
        return empty;
      },
    },
    {
      async runAuthenticatedRead() {
        throw new DOMException('account changed', 'AbortError');
      },
    },
    account,
    id,
  );
  await controller.load();
  assert.equal(calls, 0);
  assert.equal(controller.getSnapshot().data, null);
});

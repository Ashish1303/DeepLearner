import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createBrowserCoordination,
  type Control,
  type CoordinationHost,
} from '../src/lib/auth/browser-coordination';
import { createAuthController } from '../src/lib/auth/auth-controller';
import type { ApiClient } from '../src/lib/api/client';

test('blocked channel construction surfaces compatibility state without authentication calls', async () => {
  class BlockedChannel {
    constructor() {
      throw new Error('PRIVATE_BROWSER_DETAIL');
    }
  }
  const host: CoordinationHost = {
    isSecureContext: true,
    navigator: {
      locks: {
        request: (() => {
          throw new Error('Must not acquire');
        }) as LockManager['request'],
      },
    },
    BroadcastChannel: BlockedChannel as unknown as typeof BroadcastChannel,
  };
  const coordination = createBrowserCoordination(() => host);
  let calls = 0;
  const unexpected = async (): Promise<never> => {
    calls++;
    throw new Error('Must not request');
  };
  const api: ApiClient = {
    login: unexpected,
    refresh: unexpected,
    me: unexpected,
    logout: unexpected,
    patchProfile: unexpected,
  };
  const controller = createAuthController(api, coordination);
  assert(coordination.supported());
  const disconnect = controller.connect();
  assert(!coordination.supported());
  assert.equal(controller.getSnapshot().status, 'unsupported');
  assert(!controller.getSnapshot().message.includes('PRIVATE_BROWSER_DETAIL'));
  await controller.restore();
  assert.equal(calls, 0);
  disconnect();
});

test('coordination refuses unsupported contexts before executing work', async () => {
  for (const host of [
    undefined,
    { isSecureContext: false, navigator: {} },
    { isSecureContext: true, navigator: {} },
  ]) {
    const coordinator = createBrowserCoordination(() => host);
    assert.equal(coordinator.supported(), false);
    let called = false;
    await assert.rejects(
      coordinator.run(async () => {
        called = true;
      }),
    );
    assert.equal(called, false);
  }
});

test('one named exclusive lock serializes operations; messages are fixed controls only', async () => {
  const requests: string[] = [];
  let queue = Promise.resolve();
  const sent: unknown[] = [];
  let closed = false;
  let receive: ((event: MessageEvent<unknown>) => void) | null = null;
  class Channel {
    constructor(name: string) {
      assert.equal(name, 'deeplearner-auth');
    }
    set onmessage(value: (event: MessageEvent<unknown>) => void) {
      receive = value;
    }
    postMessage(value: unknown) {
      sent.push(value);
    }
    close() {
      closed = true;
    }
  }
  const request = (
    name: string,
    options: LockOptions,
    work: () => Promise<unknown>,
  ) => {
    requests.push(name);
    assert.equal(options.mode, 'exclusive');
    assert(options.signal);
    const task = queue.then(work);
    queue = task.then(
      () => {},
      () => {},
    );
    return task;
  };
  // Browser-shaped test adapters only; no real browser channels or locks are used.
  const host: CoordinationHost = {
    isSecureContext: true,
    navigator: { locks: { request: request as LockManager['request'] } },
    BroadcastChannel: Channel as unknown as typeof BroadcastChannel,
  };
  const coordinator = createBrowserCoordination(() => host);
  const received: Control[] = [];
  const stop = coordinator.listen((value) => received.push(value));
  const order: string[] = [];
  await Promise.all([
    coordinator.run(async () => {
      order.push('refresh');
      await Promise.resolve();
      order.push('rotated');
    }),
    coordinator.run(async () => {
      order.push('logout');
    }),
  ]);
  assert.deepEqual(order, ['refresh', 'rotated', 'logout']);
  assert.deepEqual(requests, ['deeplearner-auth', 'deeplearner-auth']);
  coordinator.publish('signed-out');
  assert.deepEqual(sent, ['signed-out']);
  for (const data of [
    'signed-out',
    'identity-changed',
    'uncertain',
    'PRIVATE',
    { token: 'PRIVATE' },
    null,
  ]) {
    const callback = receive as ((event: MessageEvent<unknown>) => void) | null;
    callback?.({ data } as MessageEvent<unknown>);
  }
  assert.deepEqual(received, ['signed-out', 'identity-changed', 'uncertain']);
  stop();
  assert(closed);
  coordinator.publish('signed-out');
  assert.equal(sent.length, 1);
});

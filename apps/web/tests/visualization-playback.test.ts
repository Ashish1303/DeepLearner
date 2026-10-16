import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  actionEnabled,
  bindPlaybackEnvironment,
  createPlaybackController,
  type Scheduler,
} from '../src/lib/visualizations/playback-controller';

function data(duration?: number, count = 3) {
  return {
    type: 'ANIMATED_FLOW',
    schemaVersion: 1,
    title: 'Flow',
    textAlternative: 'Description',
    nodes: [{ id: 'a', label: 'A' }],
    edges: [],
    steps: Array.from({ length: count }, (_, i) => ({
      title: `Step ${i}`,
      explanation: 'Text',
      nodeIds: ['a'],
      edgeIds: [],
    })),
    ...(duration === undefined
      ? {}
      : { animationConfig: { stepDurationMs: duration, autoplay: false } }),
  };
}
function clock() {
  let now = 0,
    id = 0;
  const pending = new Map<number, { at: number; callback: () => void }>();
  const callbacks: (() => void)[] = [];
  const scheduler: Scheduler = {
    schedule(callback, delay) {
      callbacks.push(callback);
      pending.set(++id, { at: now + delay, callback });
      return id;
    },
    cancel(handle) {
      pending.delete(handle as number);
    },
  };
  return {
    scheduler,
    callbacks,
    pending,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at;
        pending.delete(next[0]);
        next[1].callback();
      }
      now = end;
    },
  };
}
function setup(payload: unknown = data()) {
  const time = clock();
  const controller = createPlaybackController(
    { data: payload, visualizationKey: 'graph-a', accountKey: 'account-a' },
    time.scheduler,
  );
  controller.connect();
  controller.setEnvironment(true, false);
  return { controller, time, state: controller.getSnapshot };
}

test('F028 overview and manual boundaries never wrap or schedule', () => {
  const { controller: c, time, state } = setup();
  assert.equal(state().mode, 'overview');
  assert.equal(actionEnabled(state(), 'previous'), false);
  c.dispatch('previous');
  c.dispatch('next');
  assert.equal(state().selectedStepIndex, 0);
  c.dispatch('previous');
  assert.equal(state().selectedStepIndex, null);
  c.dispatch('next');
  c.dispatch('next');
  c.dispatch('next');
  assert.equal(state().selectedStepIndex, 2);
  assert.equal(actionEnabled(state(), 'next'), false);
  c.dispatch('next');
  assert.equal(state().selectedStepIndex, 2);
  assert.equal(time.pending.size, 0);
  c.dispatch('reset');
  assert.equal(state().mode, 'overview');
});

test('F028 default interval, final dwell and explicit replay never loop', () => {
  const { controller: c, time, state } = setup();
  c.dispatch('primary');
  assert.equal(state().selectedStepIndex, 0);
  time.advance(1999);
  assert.equal(state().selectedStepIndex, 0);
  time.advance(1);
  assert.equal(state().selectedStepIndex, 1);
  time.advance(2000);
  assert.equal(state().mode, 'playing');
  assert.equal(state().selectedStepIndex, 2);
  time.advance(1999);
  assert.equal(state().mode, 'playing');
  time.advance(1);
  assert.equal(state().mode, 'completed');
  time.advance(20000);
  assert.equal(state().selectedStepIndex, 2);
  assert.equal(time.pending.size, 0);
  c.dispatch('primary');
  assert.equal(state().selectedStepIndex, 0);
  assert.equal(time.pending.size, 1);
});

test('F028 pause/resume uses a fresh full interval and invalidates queued callbacks', () => {
  const { controller: c, time, state } = setup();
  c.dispatch('primary');
  time.advance(1500);
  const stale = time.callbacks[0]!;
  c.dispatch('primary');
  assert.equal(state().mode, 'paused');
  assert.equal(time.pending.size, 0);
  c.dispatch('primary');
  stale();
  time.advance(1999);
  assert.equal(state().selectedStepIndex, 0);
  time.advance(1);
  assert.equal(state().selectedStepIndex, 1);
  assert.equal(time.pending.size, 1);
});

test('F028 manual movement during playback pauses and clears completion', () => {
  const { controller: c, time, state } = setup();
  c.dispatch('primary');
  c.dispatch('next');
  assert.equal(state().mode, 'paused');
  assert.equal(time.pending.size, 0);
  c.dispatch('primary');
  c.dispatch('previous');
  assert.equal(state().selectedStepIndex, 0);
  assert.equal(state().mode, 'paused');
  c.dispatch('next');
  c.dispatch('next');
  c.dispatch('primary');
  time.advance(2000);
  assert.equal(state().mode, 'completed');
  c.dispatch('previous');
  assert.equal(state().mode, 'paused');
});

for (const duration of [100, 10000])
  test(`F028 authored ${duration}ms and single-step completion`, () => {
    const { controller: c, time, state } = setup(data(duration, 1));
    c.dispatch('primary');
    time.advance(duration - 1);
    assert.equal(state().mode, 'playing');
    time.advance(1);
    assert.equal(state().mode, 'completed');
    c.dispatch('reset');
    assert.equal(state().selectedStepIndex, null);
  });

test('F028 malformed or empty payloads fail closed without timing fallback', () => {
  for (const payload of [
    null,
    {},
    data(99),
    data(10001),
    data(undefined, 0),
    { ...data(), animationConfig: { stepDurationMs: '1000', autoplay: false } },
    { ...data(), animationConfig: { stepDurationMs: 1000, autoplay: true } },
    { ...data(), unknown: true },
  ]) {
    const { controller: c, time, state } = setup(payload);
    for (const action of ['primary', 'next', 'previous', 'reset'] as const) {
      assert.equal(actionEnabled(state(), action), false);
      c.dispatch(action);
    }
    assert.equal(state().mode, 'unavailable');
    assert.equal(time.pending.size, 0);
  }
});

test('F028 hidden and unknown-motion environments block timing, preserve manual steps', () => {
  const { controller: c, time, state } = setup();
  c.dispatch('primary');
  time.advance(2000);
  c.setEnvironment(false, false);
  assert.equal(state().mode, 'paused');
  assert.equal(state().selectedStepIndex, 1);
  assert.equal(time.pending.size, 0);
  c.setEnvironment(true, false);
  assert.equal(state().mode, 'paused');
  c.setEnvironment(true, null);
  c.dispatch('primary');
  assert.equal(state().mode, 'paused');
  c.dispatch('next');
  assert.equal(state().selectedStepIndex, 2);
});

test('F028 reduced motion pauses, forbids replay and never resumes implicitly', () => {
  const { controller: c, time, state } = setup(data(100, 1));
  c.dispatch('primary');
  c.setEnvironment(true, true);
  assert.equal(state().mode, 'paused');
  assert.equal(time.pending.size, 0);
  c.dispatch('primary');
  assert.equal(state().mode, 'paused');
  c.setEnvironment(true, false);
  assert.equal(state().mode, 'paused');
  c.dispatch('primary');
  time.advance(100);
  c.setEnvironment(true, true);
  c.dispatch('primary');
  assert.equal(state().mode, 'completed');
});

test('F028 reset/disconnect prevent stale work and disconnected actions', () => {
  const { controller: c, time, state } = setup();
  c.dispatch('primary');
  const stale = time.callbacks[0]!;
  c.dispatch('reset');
  stale();
  assert.equal(state().mode, 'overview');
  c.dispatch('primary');
  const old = time.callbacks.at(-1)!;
  c.disconnect();
  const snapshot = state();
  old();
  c.dispatch('next');
  assert.equal(state(), snapshot);
  assert.equal(time.pending.size, 0);
});

test('F028 duplicate/late timer delivery cannot cause overlap or catch-up', () => {
  const { controller: c, time, state } = setup();
  c.dispatch('primary');
  const callback = time.callbacks[0]!;
  time.advance(2000);
  callback();
  callback();
  assert.equal(state().selectedStepIndex, 1);
  assert.equal(time.pending.size, 1);
});

test('F028 automatic intermediate ticks keep announcements quiet', () => {
  const { controller: c, time, state } = setup();
  c.dispatch('primary');
  const announcement = state().announcement;
  time.advance(4000);
  assert.equal(state().announcement, announcement);
  time.advance(2000);
  assert.equal(state().announcement, 'Playback complete.');
});

test('F028 SSR and invalid identity/heading cannot schedule timers', () => {
  for (const props of [
    { accountKey: '' },
    { visualizationKey: '  ' },
    { headingLevel: 9 },
    { headingLevel: null },
  ]) {
    const time = clock();
    const c = createPlaybackController(
      {
        data: data(),
        visualizationKey: 'a',
        accountKey: 'b',
        ...props,
      } as Parameters<typeof createPlaybackController>[0],
      time.scheduler,
    );
    c.connect();
    c.setEnvironment(true, false);
    c.dispatch('primary');
    assert.equal(c.getSnapshot().mode, 'unavailable');
    assert.equal(time.pending.size, 0);
  }
  const c = createPlaybackController({
    data: data(),
    visualizationKey: 'a',
    accountKey: 'b',
  });
  c.dispatch('primary');
  assert.equal(c.getSnapshot().mode, 'overview');
});

test('F028 environment listeners clean up and Strict Mode reattachment stays usable', () => {
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  });
  const motion = Object.assign(new EventTarget(), { matches: false });
  const { controller: c, time, state } = setup();
  const first = bindPlaybackEnvironment(c, { document: doc, motion });
  first.dispose();
  const second = bindPlaybackEnvironment(c, { document: doc, motion });
  c.dispatch('primary');
  doc.visibilityState = 'hidden';
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state().mode, 'paused');
  assert.equal(time.pending.size, 0);
  doc.visibilityState = 'visible';
  doc.dispatchEvent(new Event('visibilitychange'));
  c.dispatch('primary');
  motion.matches = true;
  motion.dispatchEvent(new Event('change'));
  assert.equal(state().mode, 'paused');
  second.dispose();
  const snapshot = state();
  motion.matches = false;
  motion.dispatchEvent(new Event('change'));
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state(), snapshot);
  assert.equal(time.pending.size, 0);
});

import { parseVisualization } from './contracts';

export type PlaybackAction = 'previous' | 'primary' | 'next' | 'reset';
export type PlaybackState = {
  selectedStepIndex: number | null;
  mode: 'overview' | 'paused' | 'playing' | 'completed' | 'unavailable';
  stepCount: number;
  canTime: boolean;
  reducedMotion: boolean;
  announcement: string;
};
export type PlaybackInput = {
  data: unknown;
  visualizationKey: string;
  accountKey: string;
  headingLevel?: 2 | 3 | 4;
};
export type Scheduler = {
  schedule: (callback: () => void, delay: number) => unknown;
  cancel: (handle: unknown) => void;
};

export function actionEnabled(state: PlaybackState, action: PlaybackAction) {
  if (state.mode === 'unavailable') return false;
  if (action === 'primary') return state.mode === 'playing' || state.canTime;
  if (action === 'next')
    return (
      state.selectedStepIndex === null ||
      state.selectedStepIndex < state.stepCount - 1
    );
  return state.selectedStepIndex !== null;
}

// One store per immutable data snapshot and opaque identity pair. No effects in construction.
export function createPlaybackController(
  input: PlaybackInput,
  scheduler: Scheduler = {
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
) {
  const identityValid = [input.visualizationKey, input.accountKey].every(
    (key) => typeof key === 'string' && key.trim().length > 0,
  );
  const data =
    identityValid &&
    [2, 3, 4].includes(
      input.headingLevel === undefined ? 3 : input.headingLevel,
    )
      ? parseVisualization(input.data)
      : null;
  const duration = data?.animationConfig?.stepDurationMs ?? 2000;
  let state: PlaybackState = {
    selectedStepIndex: null,
    mode: data ? 'overview' : 'unavailable',
    stepCount: data?.steps.length ?? 0,
    canTime: false,
    reducedMotion: false,
    announcement: '',
  };
  let connected = false;
  let generation = 0;
  let timer: unknown;
  const listeners = new Set<() => void>();
  const publish = (update: Partial<PlaybackState>) => {
    state = { ...state, ...update };
    listeners.forEach((listener) => listener());
  };
  const cancel = () => {
    generation++;
    if (timer !== undefined) scheduler.cancel(timer);
    timer = undefined;
  };
  const schedule = () => {
    cancel();
    const expectedGeneration = generation;
    const expectedStep = state.selectedStepIndex;
    timer = scheduler.schedule(() => {
      if (
        !connected ||
        generation !== expectedGeneration ||
        state.mode !== 'playing' ||
        state.selectedStepIndex !== expectedStep ||
        !state.canTime
      )
        return;
      timer = undefined;
      if (expectedStep === state.stepCount - 1) {
        cancel();
        publish({ mode: 'completed', announcement: 'Playback complete.' });
      } else {
        publish({ selectedStepIndex: (expectedStep ?? -1) + 1 });
        schedule();
      }
    }, duration);
  };
  return {
    data,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      connected = true;
    },
    disconnect() {
      connected = false;
      cancel();
      publish({
        canTime: false,
        ...(state.mode === 'playing' ? { mode: 'paused' as const } : {}),
      });
    },
    setEnvironment(visible: boolean, reducedMotion: boolean | null) {
      const canTime =
        Boolean(data) && connected && visible && reducedMotion === false;
      const interrupted = state.mode === 'playing' && !canTime;
      if (interrupted) cancel();
      publish({
        canTime,
        reducedMotion: reducedMotion === true,
        ...(interrupted
          ? {
              mode: 'paused' as const,
              announcement:
                reducedMotion === true
                  ? 'Paused for reduced motion.'
                  : 'Playback paused.',
            }
          : {}),
      });
    },
    dispatch(action: PlaybackAction) {
      if (!connected || !actionEnabled(state, action)) return;
      cancel();
      if (action === 'reset') {
        publish({
          selectedStepIndex: null,
          mode: 'overview',
          announcement: 'Overview.',
        });
      } else if (action === 'primary') {
        if (state.mode === 'playing') {
          publish({ mode: 'paused', announcement: 'Playback paused.' });
        } else {
          publish({
            mode: 'playing',
            selectedStepIndex:
              state.mode === 'completed' ? 0 : (state.selectedStepIndex ?? 0),
            announcement: 'Playback started.',
          });
          schedule();
        }
      } else {
        const index =
          action === 'next'
            ? (state.selectedStepIndex ?? -1) + 1
            : state.selectedStepIndex === 0
              ? null
              : (state.selectedStepIndex ?? 1) - 1;
        publish({
          selectedStepIndex: index,
          mode: index === null ? 'overview' : 'paused',
          announcement:
            index === null
              ? 'Overview.'
              : `Step ${index + 1} of ${state.stepCount}.`,
        });
      }
    },
  };
}

export type PlaybackController = ReturnType<typeof createPlaybackController>;

// Explicit environment adapter is also exercised with isolated event-target fixtures.
export function bindPlaybackEnvironment(
  controller: PlaybackController,
  host: {
    document: Pick<
      Document,
      'visibilityState' | 'addEventListener' | 'removeEventListener'
    >;
    motion: Pick<
      MediaQueryList,
      'matches' | 'addEventListener' | 'removeEventListener'
    > | null;
  },
) {
  const refresh = () =>
    controller.setEnvironment(
      host.document.visibilityState === 'visible',
      host.motion?.matches ?? null,
    );
  controller.connect();
  host.document.addEventListener('visibilitychange', refresh);
  host.motion?.addEventListener('change', refresh);
  refresh();
  return {
    refresh,
    dispose() {
      host.document.removeEventListener('visibilitychange', refresh);
      host.motion?.removeEventListener('change', refresh);
      controller.disconnect();
    },
  };
}

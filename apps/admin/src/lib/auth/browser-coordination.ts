export type AdminControl = 'identity-changed' | 'signed-out' | 'uncertain';
export interface AdminCoordination {
  supported(): boolean;
  run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T>;
  publish(message: AdminControl): void;
  listen(callback: (message: AdminControl) => void): () => void;
}
export class AdminCoordinationError extends Error {
  constructor() {
    super(
      'Safe browser session coordination is unavailable. Use a supported secure browser context.',
    );
    this.name = 'AdminCoordinationError';
  }
}
export interface AdminCoordinationHost {
  isSecureContext: boolean;
  navigator: { locks?: Pick<LockManager, 'request'> };
  BroadcastChannel?: typeof BroadcastChannel;
}
const allowed = (value: unknown): value is AdminControl =>
  value === 'identity-changed' ||
  value === 'signed-out' ||
  value === 'uncertain';
export function createAdminBrowserCoordination(
  host: () => AdminCoordinationHost | undefined = () =>
    typeof window === 'undefined' ? undefined : window,
): AdminCoordination {
  let channel: BroadcastChannel | undefined;
  let failed = false;
  const listeners = new Set<(message: AdminControl) => void>();
  const notify = (value: AdminControl) => {
    for (const listener of listeners) listener(value);
  };
  const fail = () => {
    failed = true;
    notify('uncertain');
  };
  const supported = () => {
    const h = host();
    return Boolean(
      !failed &&
      h?.isSecureContext &&
      h.navigator.locks?.request &&
      h.BroadcastChannel,
    );
  };
  return {
    supported,
    async run(work, external) {
      const h = host();
      if (!h || !supported() || !channel) throw new AdminCoordinationError();
      const abort = new AbortController();
      const start = performance.now();
      let admitted = false;
      const cancel = () => abort.abort();
      external?.addEventListener('abort', cancel, { once: true });
      if (external?.aborted) cancel();
      const timer = setTimeout(cancel, 20000);
      try {
        return await h.navigator.locks!.request(
          'deeplearner-auth',
          {
            mode: 'exclusive',
            signal: abort.signal,
          },
          async (lock) => {
            if (
              !lock ||
              abort.signal.aborted ||
              performance.now() - start >= 20000 ||
              !supported() ||
              !channel
            )
              throw new AdminCoordinationError();
            clearTimeout(timer);
            // Once admitted, hold the lock until work settles, including cancellation.
            admitted = true;
            return work();
          },
        );
      } catch (error) {
        if (admitted) throw error;
        throw new AdminCoordinationError();
      } finally {
        clearTimeout(timer);
        external?.removeEventListener('abort', cancel);
      }
    },
    publish(message) {
      if (!allowed(message) || !channel || !supported())
        throw new AdminCoordinationError();
      try {
        channel.postMessage(message);
      } catch {
        fail();
        throw new AdminCoordinationError();
      }
    },
    listen(callback) {
      listeners.add(callback);
      if (!supported()) {
        fail();
        return () => {
          listeners.delete(callback);
        };
      }
      if (!channel) {
        try {
          channel = new (host()!.BroadcastChannel!)('deeplearner-auth');
          channel.onmessage = (event: MessageEvent<unknown>) => {
            if (allowed(event.data)) notify(event.data);
          };
          channel.onmessageerror = fail;
        } catch {
          fail();
        }
      }
      return () => {
        listeners.delete(callback);
        if (!listeners.size && channel) {
          channel.close();
          channel = undefined;
        }
      };
    },
  };
}

export type Control = 'identity-changed' | 'signed-out' | 'uncertain';
export interface Coordination {
  supported(): boolean;
  run<T>(work: () => Promise<T>): Promise<T>;
  publish(message: Control): void;
  listen(callback: (message: Control) => void): () => void;
}
export class CoordinationError extends Error {
  constructor() {
    super(
      'Safe browser session coordination is unavailable. Use a supported browser over HTTPS or an approved local address.',
    );
  }
}
export interface CoordinationHost {
  isSecureContext: boolean;
  navigator: { locks?: Pick<LockManager, 'request'> };
  BroadcastChannel?: typeof BroadcastChannel;
}
export function createBrowserCoordination(
  host: () => CoordinationHost | undefined = () =>
    typeof window === 'undefined' ? undefined : window,
): Coordination {
  let channel: BroadcastChannel | undefined;
  let failed = false;
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
    async run(work) {
      const h = host();
      if (!h || !supported()) throw new CoordinationError();
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 20000);
      try {
        return await h.navigator.locks!.request(
          'deeplearner-auth',
          { mode: 'exclusive', signal: abort.signal },
          async () => {
            clearTimeout(timeout);
            return work();
          },
        );
      } finally {
        clearTimeout(timeout);
      }
    },
    publish(message) {
      channel?.postMessage(message);
    },
    listen(callback) {
      if (!supported()) return () => {};
      let owned: BroadcastChannel;
      try {
        owned = new (host()!.BroadcastChannel!)('deeplearner-auth');
        channel = owned;
      } catch {
        failed = true;
        callback('uncertain');
        return () => {};
      }
      owned.onmessage = (event: MessageEvent<unknown>) => {
        if (
          event.data === 'identity-changed' ||
          event.data === 'signed-out' ||
          event.data === 'uncertain'
        )
          callback(event.data);
      };
      return () => {
        owned.close();
        if (channel === owned) channel = undefined;
      };
    },
  };
}

import type { Logger } from 'pino';

interface LifecycleDependencies {
  database: { connect(): Promise<void>; disconnect(): Promise<void> };
  listen(): Promise<void>;
  closeHTTP(): Promise<void>;
  log: Pick<Logger, 'info' | 'error' | 'fatal'>;
  exit(code: number): void;
  forceExit(code: number): void;
  deadline?: (callback: () => void) => () => void;
}

export function createLifecycle(deps: LifecycleDependencies) {
  let startup: Promise<void> | undefined;
  let completion: Promise<void> | undefined;
  let shutdown: Promise<void> | undefined;
  let stopping = false;
  let failed = false;
  let timedOut = false;

  function stop(failure = false): Promise<void> {
    failed ||= failure;
    if (shutdown) return shutdown;
    stopping = true;
    deps.log.info('Shutting down API');
    const schedule =
      deps.deadline ??
      ((callback: () => void) => {
        const timer = setTimeout(callback, 10_000);
        return () => clearTimeout(timer);
      });
    const cancel = schedule(() => {
      timedOut = true;
      deps.log.error('Shutdown timed out');
      deps.forceExit(1);
    });
    shutdown = (async () => {
      await startup?.catch(() => undefined);
      try {
        await deps.closeHTTP();
      } catch {
        failed = true;
        deps.log.error('HTTP shutdown failed');
      }
      try {
        await deps.database.disconnect();
      } catch {
        failed = true;
        deps.log.error('Database shutdown failed');
      }
      cancel();
      if (!timedOut) deps.exit(failed ? 1 : 0);
    })();
    return shutdown;
  }

  function start(): Promise<void> {
    if (completion) return completion;
    if (stopping) return Promise.resolve();
    startup = (async () => {
      await deps.database.connect();
      if (!stopping) await deps.listen();
    })();
    completion = startup.catch(async () => {
      deps.log.fatal('API startup failed');
      await stop(true);
    });
    return completion;
  }

  return { start, stop };
}

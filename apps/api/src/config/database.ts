import { Mongoose, type ConnectOptions } from 'mongoose';
import type { Logger } from 'pino';

// Future models must use this instance. Importing it never opens a connection.
export const mongoose = new Mongoose();

function normalizeTLSURI(uri: string): string {
  const separator = uri.indexOf('?');
  if (separator === -1) return uri;
  // The driver forbids tlsInsecure alongside explicit verification options,
  // even when false. Remove only this redundant safe option; preserve all else.
  const query = uri
    .slice(separator + 1)
    .split('&')
    .filter((part) => {
      for (const [key, value] of new URLSearchParams(part)) {
        if (key.toLowerCase() !== 'tlsinsecure') continue;
        if (value.toLowerCase() !== 'false')
          throw new Error('Invalid TLS configuration');
        return false;
      }
      return true;
    })
    .join('&');
  return uri.slice(0, separator) + (query ? `?${query}` : '');
}

interface DatabaseDriver {
  set(
    key: 'bufferCommands' | 'autoCreate' | 'autoIndex' | 'debug',
    value: boolean,
  ): unknown;
  connect(uri: string, options: ConnectOptions): Promise<unknown>;
  disconnect(): Promise<void>;
  connection: { on(event: string, listener: () => void): unknown };
}

export function createDatabase(
  driver: DatabaseDriver,
  config: { MONGODB_URI: string; MONGODB_DB_NAME: string },
  log: Pick<Logger, 'info' | 'warn' | 'error'>,
) {
  let state: 'disconnected' | 'connecting' | 'connected' | 'error' =
    'disconnected';
  let connecting: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  let initialized = false;
  let stopped = false;

  function transition(next: typeof state) {
    if (state === next) return;
    state = next;
    const fields = { module: 'database', state };
    if (next === 'error') log.error(fields, 'Database connection error');
    else if (next === 'disconnected') log.warn(fields, 'Database disconnected');
    else log.info(fields, 'Database connection state changed');
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    for (const key of [
      'bufferCommands',
      'autoCreate',
      'autoIndex',
      'debug',
    ] as const)
      driver.set(key, false);
    driver.connection.on('connected', () => transition('connected'));
    driver.connection.on('reconnected', () => transition('connected'));
    driver.connection.on('disconnected', () => transition('disconnected'));
    driver.connection.on('error', () => transition('error'));
  }

  function connect(): Promise<void> {
    if (stopped)
      return Promise.reject(new Error('Database lifecycle is closed'));
    if (connecting) return connecting;
    initialize();
    transition('connecting');
    connecting = Promise.resolve().then(async () => {
      try {
        await driver.connect(normalizeTLSURI(config.MONGODB_URI), {
          dbName: config.MONGODB_DB_NAME,
          tls: true,
          tlsAllowInvalidCertificates: false,
          tlsAllowInvalidHostnames: false,
          serverSelectionTimeoutMS: 30_000,
          connectTimeoutMS: 10_000,
          waitQueueTimeoutMS: 10_000,
          maxPoolSize: 10,
          minPoolSize: 0,
          bufferCommands: false,
          autoCreate: false,
          autoIndex: false,
        });
        transition('connected');
      } catch {
        transition('error');
        throw new Error('Database connection failed');
      }
    });
    return connecting;
  }

  function disconnect(): Promise<void> {
    if (closing) return closing;
    stopped = true;
    closing = (async () => {
      await connecting?.catch(() => undefined);
      try {
        await driver.disconnect();
        transition('disconnected');
      } catch {
        transition('error');
        throw new Error('Database disconnect failed');
      }
    })();
    return closing;
  }

  return {
    connect,
    disconnect,
    get state() {
      return state;
    },
  };
}

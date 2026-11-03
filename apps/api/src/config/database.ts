import { Mongoose, type ConnectOptions } from 'mongoose';
import type { Logger } from 'pino';

// Future models must use this instance. Importing it never opens a connection.
export const mongoose = new Mongoose();

interface DatabaseConfig {
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
  APP_ENV?: 'LOCAL' | 'DEVELOPMENT' | 'PRODUCTION';
  MONGODB_TLS?: boolean;
}

export function databaseTLS(config: DatabaseConfig): boolean {
  const tls = config.MONGODB_TLS ?? true;
  const uri = config.MONGODB_URI;
  // Match the literal authority, not a DNS alias or a normalized IP spelling.
  // Single-host direct mode below also prevents replica-set host discovery.
  if (
    !tls &&
    (config.APP_ENV !== 'LOCAL' ||
      !/^mongodb:\/\/(?:[^@/?#\s]+@)?127\.0\.0\.1(?::[0-9]+)?(?:\/[^?#\s]*)?(?:\?[^#\s]*)?$/.test(
        uri,
      ))
  ) {
    throw new Error('Invalid database TLS policy');
  }
  for (const [key, value] of new URLSearchParams(uri.split('?')[1] ?? '')) {
    const name = key.toLowerCase();
    const option = value.toLowerCase();
    if (['tls', 'ssl'].includes(name) && option !== String(tls))
      throw new Error('Invalid database TLS policy');
    if (
      [
        'tlsinsecure',
        'tlsallowinvalidcertificates',
        'tlsallowinvalidhostnames',
        'tlsdisablecertificaterevocationcheck',
        'tlsdisableocspendpointcheck',
      ].includes(name) &&
      option !== 'false'
    )
      throw new Error('Invalid database TLS policy');
    if (
      !tls &&
      (name.startsWith('proxy') ||
        (name === 'directconnection' && option !== 'true') ||
        (name === 'loadbalanced' && option !== 'false'))
    )
      throw new Error('Invalid database TLS policy');
  }
  return tls;
}

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

// Emit only fixed operational labels; never serialize a driver error or its message.
function localConnectionDiagnostic(failure: unknown) {
  let failureClass = 'UNKNOWN';
  let failureCode: string | number = 'UNKNOWN';
  for (let depth = 0; depth < 6; depth++) {
    if (typeof failure !== 'object' || failure === null) break;
    try {
      const current = failure as {
        name?: unknown;
        code?: unknown;
        cause?: unknown;
        reason?: unknown;
        error?: unknown;
      };
      const name = depth === 0 ? current.name : undefined;
      if (
        typeof name === 'string' &&
        [
          'MongooseServerSelectionError',
          'MongoServerSelectionError',
          'MongoNetworkError',
          'MongoNetworkTimeoutError',
          'MongoServerError',
          'MongoParseError',
        ].includes(name)
      )
        failureClass = name;
      const code = current.code;
      if (
        (typeof code === 'string' &&
          [
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'EAI_AGAIN',
            'EACCES',
            'ECONNRESET',
            'ERR_TLS_CERT_ALTNAME_INVALID',
            'CERT_HAS_EXPIRED',
            'DEPTH_ZERO_SELF_SIGNED_CERT',
            'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
          ].includes(code)) ||
        code === 18 ||
        code === 13
      ) {
        failureCode = code;
        break;
      }
      // Mongoose wraps the topology as cause; its error links to the network cause.
      failure = current.cause ?? current.reason ?? current.error;
    } catch {
      // Malformed diagnostic evidence must not replace the sanitized startup error.
      break;
    }
  }
  return { failureClass, failureCode };
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
  config: DatabaseConfig,
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
        const tls = databaseTLS(config);
        await driver.connect(normalizeTLSURI(config.MONGODB_URI), {
          dbName: config.MONGODB_DB_NAME,
          tls,
          ...(!tls ? { directConnection: true } : {}),
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
      } catch (failure) {
        transition('error');
        if (config.APP_ENV === 'LOCAL')
          log.error(
            { module: 'database', ...localConnectionDiagnostic(failure) },
            'Local database connection diagnostic',
          );
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

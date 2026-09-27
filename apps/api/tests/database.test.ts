import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import pino from 'pino';
import { createDatabase, mongoose } from '../src/config/database.js';

const config = {
  MONGODB_URI: 'mongodb://SECRET_SENTINEL@localhost',
  MONGODB_DB_NAME: 'deeplearner-test',
};
function fixture() {
  const events = new EventEmitter();
  const logs: string[] = [];
  const log = pino(
    { base: null },
    {
      write: (line: string) => {
        logs.push(line);
      },
    },
  );
  let connects = 0;
  let disconnects = 0;
  const settings = new Map<string, boolean>();
  const driver = {
    connection: events,
    set: (key: string, value: boolean) => {
      settings.set(key, value);
    },
    connect: async (
      _uri: string,
      options: import('mongoose').ConnectOptions,
    ) => {
      connects++;
      assert.equal(options.dbName, config.MONGODB_DB_NAME);
      assert.equal(options.tls, true);
      assert.equal(options.tlsAllowInvalidCertificates, false);
      assert.equal(options.tlsAllowInvalidHostnames, false);
      assert.equal(options.bufferCommands, false);
      assert.equal(options.autoCreate, false);
      assert.equal(options.autoIndex, false);
      assert.equal(options.serverSelectionTimeoutMS, 30_000);
      assert.equal(options.connectTimeoutMS, 10_000);
      assert.equal(options.waitQueueTimeoutMS, 10_000);
      assert.equal(options.maxPoolSize, 10);
      assert.equal(options.minPoolSize, 0);
    },
    disconnect: async () => {
      disconnects++;
    },
  };
  return {
    driver,
    events,
    logs,
    settings,
    log,
    counts: () => [connects, disconnects],
  };
}

test('import opens no connection or models; concurrent connects and closes are shared', async () => {
  assert.equal(mongoose.connection.readyState, 0);
  assert.deepEqual(mongoose.modelNames(), []);
  const f = fixture();
  const db = createDatabase(f.driver, config, f.log);
  const first = db.connect();
  assert.equal(first, db.connect());
  await first;
  assert.equal(db.state, 'connected');
  assert.deepEqual([...f.settings.values()], [false, false, false, false]);
  const close = db.disconnect();
  assert.equal(close, db.disconnect());
  await close;
  assert.deepEqual(f.counts(), [1, 1]);
  await assert.rejects(db.connect(), /lifecycle is closed/);
});

test('runtime events update state, deduplicate logs, preserve one driver connection and listeners', async () => {
  const f = fixture();
  const db = createDatabase(f.driver, config, f.log);
  await db.connect();
  f.events.emit('disconnected');
  assert.equal(db.state, 'disconnected');
  f.events.emit('error', new Error('SECRET_SENTINEL'));
  const length = f.logs.length;
  f.events.emit('error', new Error('SECRET_SENTINEL'));
  assert.equal(f.logs.length, length);
  f.events.emit('reconnected');
  assert.equal(db.state, 'connected');
  await db.connect();
  assert.deepEqual(f.counts(), [1, 0]);
  for (const name of ['connected', 'disconnected', 'reconnected', 'error'])
    assert.equal(f.events.listenerCount(name), 1);
  await db.disconnect();
  assert(!f.logs.join('').includes('SECRET_SENTINEL'));
});

test('connection and disconnect failures expose only fixed safe errors', async () => {
  const f = fixture();
  f.driver.connect = async () => {
    throw new Error('SECRET_SENTINEL');
  };
  f.driver.disconnect = async () => {
    throw new Error('SECRET_SENTINEL');
  };
  const db = createDatabase(f.driver, config, f.log);
  await assert.rejects(db.connect(), { message: 'Database connection failed' });
  await assert.rejects(db.disconnect(), {
    message: 'Database disconnect failed',
  });
  assert(!f.logs.join('').includes('SECRET_SENTINEL'));
});

test('shutdown waits for a pending connection and closes its late completion', async () => {
  const f = fixture();
  let resolvePending = () => {};
  const pending = {
    promise: new Promise<void>((resolve) => {
      resolvePending = resolve;
    }),
    resolve: () => resolvePending(),
  };
  f.driver.connect = () => pending.promise;
  const db = createDatabase(f.driver, config, f.log);
  const start = db.connect();
  const close = db.disconnect();
  assert.deepEqual(f.counts(), [0, 0]);
  pending.resolve();
  await Promise.all([start, close]);
  assert.deepEqual(f.counts(), [0, 1]);
  assert.equal(db.state, 'disconnected');
});

test('real driver parser accepts normalized secure TLS combinations without a connection', async () => {
  for (const query of [
    '',
    'tlsInsecure=false',
    'TLSINSECURE=false&tls=true',
    'tlsInsecure=false&tlsAllowInvalidCertificates=false&tlsAllowInvalidHostnames=false',
    'tlsInsecure=false&tlsInsecure=false&retryWrites=true',
  ]) {
    const f = fixture();
    let parsed = false;
    f.driver.connect = async (uri, options) => {
      // Remove only Mongoose-specific options before using the actual driver.
      const { autoCreate, autoIndex, bufferCommands, ...driverOptions } =
        options;
      assert.equal(autoCreate, false);
      assert.equal(autoIndex, false);
      assert.equal(bufferCommands, false);
      const client = new mongoose.mongo.MongoClient(uri, driverOptions);
      assert.equal(client.options.tls, true);
      assert.equal(client.options.rejectUnauthorized, true);
      assert.equal(client.options.checkServerIdentity, undefined);
      parsed = true;
      await client.close();
    };
    const db = createDatabase(
      f.driver,
      { ...config, MONGODB_URI: `mongodb://127.0.0.1:27017/?${query}` },
      f.log,
    );
    await db.connect();
    assert(parsed);
    await db.disconnect();
  }
});

test('TLS normalization never accepts insecure or contradictory tlsInsecure values', async () => {
  for (const query of [
    'tlsInsecure=true',
    'tlsInsecure=false&tlsInsecure=true',
    'TLSINSECURE=true&tlsAllowInvalidCertificates=false',
    'tlsInsecure=invalid',
  ]) {
    const f = fixture();
    const db = createDatabase(
      f.driver,
      { ...config, MONGODB_URI: `mongodb://127.0.0.1:27017/?${query}` },
      f.log,
    );
    await assert.rejects(db.connect(), {
      message: 'Database connection failed',
    });
    assert.deepEqual(f.counts(), [0, 0]);
    await db.disconnect();
  }
});

test('real Mongoose malformed URI error is sanitized without opening a socket', async () => {
  const f = fixture();
  const db = createDatabase(
    mongoose,
    { ...config, MONGODB_URI: 'mongodb://SECRET_SENTINEL@' },
    f.log,
  );
  await assert.rejects(db.connect(), { message: 'Database connection failed' });
  await db.disconnect();
  assert(!f.logs.join('').includes('SECRET_SENTINEL'));
});

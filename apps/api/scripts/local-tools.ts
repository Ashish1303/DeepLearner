import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { EmailVerificationToken } from '../src/modules/auth/email-verification-token.model.js';
import { PasswordResetToken } from '../src/modules/auth/password-reset-token.model.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { Concept } from '../src/modules/concepts/concept.model.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import { registrationBody } from '../src/modules/auth/auth.schema.js';

export const target = Object.freeze({
  uri: 'mongodb://127.0.0.1:27018/?directConnection=true',
  database: 'deeplearner-local-demo',
  replicaSet: 'deeplearner-local',
  host: '127.0.0.1:27018',
  revision: 1,
});
export const models = [
  User,
  Session,
  Audit,
  EmailVerificationToken,
  PasswordResetToken,
  Technology,
  LearningPath,
  Module,
  Topic,
  Concept,
] as const;
export class LocalError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function requireLocal(config: Record<string, string | undefined>) {
  if (
    config.APP_ENV !== 'LOCAL' ||
    config.MONGODB_URI !== target.uri ||
    config.MONGODB_DB_NAME !== target.database
  )
    throw new LocalError('LOCAL_TARGET_REJECTED');
}
const equalPath = (a: string, b: string) =>
  path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
export function verifyInstance(
  options: Record<string, unknown>,
  pid: number,
  expectedPid: number,
  dbPath: string,
) {
  const parsed = options.parsed as
    | {
        net?: { bindIp?: string; port?: number };
        storage?: { dbPath?: string };
        replication?: { replSet?: string };
      }
    | undefined;
  if (
    !Number.isSafeInteger(expectedPid) ||
    expectedPid <= 0 ||
    pid !== expectedPid ||
    parsed?.net?.bindIp !== '127.0.0.1' ||
    parsed.net.port !== 27018 ||
    parsed.replication?.replSet !== target.replicaSet ||
    !parsed.storage?.dbPath ||
    !equalPath(parsed.storage.dbPath, dbPath)
  )
    throw new LocalError('INSTANCE_IDENTITY_MISMATCH');
}
export function verifyReplica(config: {
  _id?: string;
  members?: { host?: string }[];
}) {
  if (
    config._id !== target.replicaSet ||
    config.members?.length !== 1 ||
    config.members[0]?.host !== target.host
  )
    throw new LocalError('REPLICA_IDENTITY_MISMATCH');
}
interface AdminCommands {
  command(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}
export async function primaryReady(
  admin: AdminCommands,
  initialize: boolean,
  wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  now = Date.now,
) {
  if (initialize) {
    try {
      await admin.command({ replSetGetConfig: 1 });
    } catch (error) {
      if ((error as { code?: number }).code !== 94) throw error;
      await admin.command({
        replSetInitiate: {
          _id: target.replicaSet,
          members: [{ _id: 0, host: target.host }],
        },
      });
      return await primaryReady(admin, false, wait, now);
    }
    throw new LocalError('UNEXPECTED_INITIALIZED_REPLICA');
  }
  const deadline = now() + 30000;
  do {
    const hello = await admin.command({ hello: 1 });
    if (hello.setName !== undefined && hello.setName !== target.replicaSet)
      throw new LocalError('REPLICA_IDENTITY_MISMATCH');
    if (
      hello.isWritablePrimary === true &&
      hello.setName === target.replicaSet
    ) {
      const response = await admin.command({ replSetGetConfig: 1 });
      verifyReplica(response.config as Parameters<typeof verifyReplica>[0]);
      return;
    }
    await wait(200);
  } while (now() < deadline);
  throw new LocalError('PRIMARY_TIMEOUT');
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return JSON.stringify(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonical((value as Record<string, unknown>)[key]),
        ]),
    );
  return JSON.stringify(value);
}
export function indexesMatch(
  actual: Record<string, unknown>[],
  declared: readonly (readonly [
    Record<string, unknown>,
    Record<string, unknown>,
  ])[],
) {
  return [{ _id: 1 }, ...declared.map(([key]) => key)].every((key) =>
    actual.some(
      (index) =>
        JSON.stringify(index.key) === JSON.stringify(key) &&
        (Object.hasOwn(key, '_id') ||
          (() => {
            const options = declared.find(
              ([candidate]) =>
                JSON.stringify(candidate) === JSON.stringify(key),
            )![1];
            return [
              'unique',
              'sparse',
              'expireAfterSeconds',
              'partialFilterExpression',
              'collation',
            ].every(
              (option) =>
                canonical(
                  index[option] ??
                    (['unique', 'sparse'].includes(option) ? false : null),
                ) ===
                canonical(
                  options[option] ??
                    (['unique', 'sparse'].includes(option) ? false : null),
                ),
            );
          })()),
    ),
  );
}
export async function verifyIndexes() {
  for (const model of models) {
    const actual = await model.collection.listIndexes().toArray();
    if (!indexesMatch(actual, model.schema.indexes()))
      throw new LocalError('INDEX_PREREQUISITE_MISSING');
  }
}
export async function prepareStorage(
  initialize: boolean,
  deps: {
    primary(initialize: boolean): Promise<void>;
    collections(): Promise<unknown[]>;
    connect(): Promise<void>;
    initialize(): Promise<void>;
    indexes(): Promise<void>;
  },
) {
  await deps.primary(initialize);
  if (initialize && (await deps.collections()).length)
    throw new LocalError('DATABASE_NOT_EMPTY');
  await deps.connect();
  if (initialize) await deps.initialize();
  await deps.indexes();
}
export const demoAccounts = [
  {
    email: 'demo.student@deeplearner.test',
    firstName: 'Demo',
    lastName: 'Student',
    role: 'STUDENT',
    plan: 'PREMIUM',
    profile: {
      experienceLevel: 'BEGINNER',
      learningGoals: ['LEARN_FROM_SCRATCH'],
      preferredDifficulty: 'BEGINNER',
      dailyStudyGoalMinutes: 20,
      interestedTechnologyIds: [],
    },
  },
  {
    email: 'demo.admin@deeplearner.test',
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'ADMIN',
    plan: 'FREE',
  },
] as const;
type ExistingAccount = {
  role: string;
  plan: string;
  status: string;
  emailVerifiedAt?: Date | null;
  passwordHash?: string | null;
};
export async function insertDemoAccount(
  index: 0 | 1,
  password: string,
  deps: {
    find(email: string): Promise<ExistingAccount | null>;
    hash(password: string): Promise<string>;
    insert(record: Record<string, unknown>): Promise<void>;
  },
) {
  const account = demoAccounts[index];
  const existing = await deps.find(account.email);
  if (existing) {
    if (
      existing.role !== account.role ||
      existing.plan !== account.plan ||
      existing.status !== 'ACTIVE' ||
      !existing.emailVerifiedAt ||
      !existing.passwordHash
    )
      throw new LocalError('EXISTING_ACCOUNT_CONFLICT');
    return 'UNCHANGED';
  }
  registrationBody.shape.password.parse(password);
  const passwordHash = await deps.hash(password);
  // A single insert, never upsert/update. Unique email remains the final race guard.
  await deps.insert({
    ...account,
    status: 'ACTIVE',
    emailVerifiedAt: new Date(),
    passwordHash,
    authProviders: [],
  });
  return 'CREATED';
}

// Exactly one bounded JSON line over private stdin; no passwords in argv/environment.
export async function readPrivateInput(
  input: NodeJS.ReadableStream = process.stdin,
) {
  let bytes = 0,
    text = '';
  for await (const chunk of input) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 8192) throw new LocalError('INPUT_LIMIT');
    text += String(chunk);
    if (text.includes('\n'))
      return JSON.parse(text.slice(0, text.indexOf('\n'))) as unknown;
  }
  throw new LocalError('INPUT_REQUIRED');
}
const inputSchema = z.strictObject({
  student: z.string().min(10).max(128),
  admin: z.string().min(10).max(128),
});

async function runDatabase(
  mode: string,
  root: string,
  expectedPid: number,
  manifest?: string,
  digest?: string,
) {
  requireLocal(process.env);
  const raw = new mongoose.mongo.MongoClient(target.uri, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });
  let connected = false;
  try {
    await raw.connect();
    const admin = raw.db('admin');
    const options = await admin.command({ getCmdLineOpts: 1 });
    const status = await admin.command({ serverStatus: 1 });
    verifyInstance(
      options,
      Number(status.pid),
      expectedPid,
      path.join(root, 'mongodb'),
    );
    if (mode === 'shutdown') {
      // The owner separately verifies exit code 0 via the original native handle.
      try {
        await admin.command({ shutdown: 1, timeoutSecs: 10 });
      } catch (error) {
        if (
          !(error instanceof mongoose.mongo.MongoNetworkError) &&
          ![91, 11600].includes(Number((error as { code?: number }).code))
        )
          throw error;
      }
      return;
    }
    const db = raw.db(target.database);
    await prepareStorage(mode === 'initialize', {
      primary: (initialize) => primaryReady(admin, initialize),
      collections: () => db.listCollections({}, { nameOnly: true }).toArray(),
      connect: async () => {
        await mongoose.connect(target.uri, {
          dbName: target.database,
          autoCreate: false,
          autoIndex: false,
          bufferCommands: false,
          directConnection: true,
          serverSelectionTimeoutMS: 5000,
        });
        connected = true;
      },
      initialize: async () => {
        for (const model of models) {
          await model.createCollection();
          await model.createIndexes();
        }
      },
      indexes: verifyIndexes,
    });
    if (mode === 'accounts') {
      const passwords = inputSchema.parse(await readPrivateInput());
      try {
        for (const index of [0, 1] as const) {
          const result = await insertDemoAccount(
            index,
            index === 0 ? passwords.student : passwords.admin,
            {
              find: (email) =>
                User.findOne({ email }).select('+passwordHash').lean().exec(),
              hash: hashPassword,
              insert: async (record) => {
                await new User(record).save();
              },
            },
          );
          process.stdout.write(
            `${index === 0 ? 'STUDENT' : 'ADMIN'}_${result}\n`,
          );
        }
      } finally {
        passwords.student = '';
        passwords.admin = '';
      }
    } else if (mode === 'content') {
      const { provisionContent } = await import('./local-demo-content.js');
      await provisionContent(manifest ?? '', digest ?? '', root);
    } else if (!['initialize', 'check'].includes(mode))
      throw new LocalError('COMMAND_REJECTED');
  } finally {
    // Disconnect even after a partially failed connect.
    try {
      if (connected || mongoose.connection.readyState !== 0)
        await mongoose.disconnect();
    } finally {
      await raw.close();
    }
  }
}

async function serve(kind: string, repo: string) {
  requireLocal(process.env);
  let stop: () => Promise<void>;
  if (kind === 'api') {
    await import('../src/server.js'); // No --env-file or dotenv; existing authentication is unchanged.
    stop = async () => {
      process.emit('SIGTERM');
    };
  } else if (kind === 'web') {
    // Keep Next's ambient frontend ProcessEnv declarations outside API typechecks.
    const next = createRequire(import.meta.url)('next') as (options: {
      dev: boolean;
      dir: string;
      hostname: string;
      port: number;
    }) => {
      prepare(): Promise<void>;
      close(): Promise<void>;
      getRequestHandler(): import('node:http').RequestListener;
    };
    const app = next({
      dev: true,
      dir: path.join(repo, 'apps/web'),
      hostname: '127.0.0.1',
      port: 3000,
    });
    await app.prepare();
    const server = createServer(app.getRequestHandler());
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(3000, '127.0.0.1', resolve);
    });
    stop = async () => {
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await app.close();
      await closed;
    };
  } else if (kind === 'admin') {
    const { createServer: vite } = await import('vite');
    const server = await vite({
      root: path.join(repo, 'apps/admin'),
      server: { host: '127.0.0.1', port: 5173, strictPort: true },
    });
    await server.listen();
    stop = async () => {
      await server.close();
    };
  } else throw new LocalError('SERVICE_REJECTED');
  installShutdown(stop);
}
export function installShutdown(
  stop: () => Promise<void>,
  input = process.stdin,
  deadlineMs = 12000,
) {
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 12000)
    throw new LocalError('SHUTDOWN_DEADLINE_REJECTED');
  let stopping = false;
  const reader = createInterface({ input });
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    process.stdout.write('STOP_REQUESTED\n');
    // Remains effective after resource closure until actual process exit.
    setTimeout(() => {
      process.stderr.write('STOP_TIMEOUT\n');
      process.exit(1);
    }, deadlineMs).unref();
    void stop()
      .then(() => {
        // API SIGTERM dispatch returns before its lifecycle completes; don't claim closure here.
        process.stdout.write('STOP_HANDLER_FINISHED\n');
        reader.close();
        input.destroy();
      })
      .catch(() => {
        process.stderr.write('RESOURCE_CLOSE_FAILED\n');
        process.exitCode = 1;
        reader.close();
        input.destroy();
      });
  };
  reader.on('line', (line) => {
    if (line === 'STOP') shutdown();
  });
  reader.on('close', shutdown);
}

export async function main(args: string[]) {
  const [mode, rootArg, pidArg, extra, digest] = args;
  if (
    ![
      'initialize',
      'check',
      'shutdown',
      'accounts',
      'content',
      'service',
    ].includes(mode ?? '')
  )
    throw new LocalError('COMMAND_REJECTED');
  const expectedRoot = path.join(
    process.env.LOCALAPPDATA ?? '',
    'DeepLearner',
    'local-dev',
  );
  if (
    !process.env.LOCALAPPDATA ||
    !rootArg ||
    !equalPath(rootArg, expectedRoot) ||
    !equalPath(await realpath(rootArg), expectedRoot)
  )
    throw new LocalError('ROOT_REJECTED');
  const receipt = JSON.parse(
    await readFile(path.join(rootArg, 'ownership.json'), 'utf8'),
  ) as {
    revision?: number;
    database?: string;
    replicaSet?: string;
    repo?: string;
    state?: string;
  };
  const expectedRepo = fileURLToPath(new URL('../../../', import.meta.url));
  if (
    receipt.revision !== target.revision ||
    receipt.database !== target.database ||
    receipt.replicaSet !== target.replicaSet ||
    !receipt.repo ||
    !equalPath(receipt.repo, expectedRepo) ||
    (mode === 'initialize'
      ? receipt.state !== 'PREPARING'
      : mode !== 'shutdown' && receipt.state !== 'INITIALIZED')
  )
    throw new LocalError('RECEIPT_REJECTED');
  if (mode === 'service') await serve(pidArg ?? '', receipt.repo);
  else await runDatabase(mode!, rootArg, Number(pidArg), extra, digest);
}
// Import-safe for offline tests: no config load, DB connection or service startup.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    const code =
      error instanceof LocalError ? error.code : 'LOCAL_OPERATION_FAILED';
    process.stderr.write(code + '\n');
    process.exitCode = 1;
  });
}
export const digestBytes = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

export const localTarget = Object.freeze({
  host: '127.0.0.1',
  port: 27019,
  name: 'deeplearner-dev',
  replicaSet: 'deeplearner-dev-rs',
});

export class DevLocalError extends Error {
  constructor() {
    super('DEV_CONFIGURATION_REJECTED');
  }
}

const profileSchema = z.strictObject({
  revision: z.literal(1),
  repository: z.string().min(1).max(1024),
  ownerSid: z.string().regex(/^S-1-5-21-(?:\d+-){2}\d+-\d+$/),
  database: z.strictObject({
    host: z.literal(localTarget.host),
    port: z.literal(localTarget.port),
    name: z.literal(localTarget.name),
    replicaSet: z.literal(localTarget.replicaSet),
  }),
  prerequisites: z.strictObject({
    instance: z.literal('APPROVED_READY'),
    schema: z.literal('APPROVED_READY'),
  }),
});

export function validateProfile(
  input: unknown,
  repository: string,
  ownerSid: string,
) {
  const parsed = profileSchema.safeParse(input);
  if (
    !parsed.success ||
    path.win32.resolve(parsed.data.repository).toLowerCase() !==
      path.win32.resolve(repository).toLowerCase() ||
    parsed.data.ownerSid !== ownerSid
  )
    throw new DevLocalError();
  return parsed.data;
}

export function validateSecrets(input: unknown) {
  const parsed = z
    .strictObject({
      mongodbUri: z.string().min(1).max(4096),
      signingSecret: z.string().min(1).max(256),
    })
    .safeParse(input);
  if (!parsed.success) throw new DevLocalError();
  const { mongodbUri, signingSecret } = parsed.data;
  try {
    const uri = new URL(mongodbUri);
    const required = new Map([
      ['replicaSet', localTarget.replicaSet],
      ['directConnection', 'true'],
      ['authSource', localTarget.name],
    ]);
    const entries = [...uri.searchParams];
    if (
      !/^mongodb:\/\/[^\s/?#@]+:[^\s/?#@]+@127\.0\.0\.1:27019\//.test(
        mongodbUri,
      ) ||
      uri.protocol !== 'mongodb:' ||
      uri.host !== '127.0.0.1:27019' ||
      uri.pathname !== '/deeplearner-dev' ||
      uri.hash ||
      !uri.username ||
      !uri.password ||
      entries.length !== required.size ||
      new Set(entries.map(([key]) => key)).size !== required.size ||
      entries.some(([key, value]) => required.get(key) !== value)
    )
      throw new DevLocalError();
    const bytes = Buffer.from(signingSecret, 'base64');
    if (
      bytes.length < 32 ||
      bytes.toString('base64') !== signingSecret ||
      new Set(bytes).size < 16
    )
      throw new DevLocalError();
  } catch {
    throw new DevLocalError();
  }
  return parsed.data;
}

const expectedScripts = {
  root: {
    'build:packages':
      'npm run build --workspace=@deeplearner/shared-types && npm run build --workspace=@deeplearner/validation',
  },
  web: { dev: 'next dev --port 3000' },
  admin: { dev: 'vite --port 5173 --strictPort' },
  api: { 'dev:local': 'node --watch --import tsx src/server.ts' },
  types: {
    build: 'tsc -p tsconfig.json',
    dev: 'tsc -p tsconfig.json --watch --preserveWatchOutput',
  },
  validation: {
    build: 'tsc -p tsconfig.json',
    dev: 'tsc -p tsconfig.json --watch --preserveWatchOutput',
  },
} as const;

export function workspacePlan(input: unknown) {
  const manifests = z.record(z.string(), z.unknown()).safeParse(input);
  if (!manifests.success) throw new DevLocalError();
  for (const [name, scripts] of Object.entries(expectedScripts)) {
    const manifest = z
      .object({ scripts: z.record(z.string(), z.string()) })
      .safeParse(manifests.data[name]);
    if (!manifest.success) throw new DevLocalError();
    for (const [key, command] of Object.entries(scripts))
      if (manifest.data.scripts[key] !== command) throw new DevLocalError();
  }
  return {
    build: { label: 'build', args: ['run', 'build:packages'] },
    watchers: [
      {
        label: 'types',
        args: ['run', 'dev', '--workspace=@deeplearner/shared-types'],
      },
      {
        label: 'validation',
        args: ['run', 'dev', '--workspace=@deeplearner/validation'],
      },
    ],
    services: [
      {
        label: 'api',
        port: 4000,
        args: ['run', 'dev:local', '--workspace=@deeplearner/api'],
      },
      {
        label: 'web',
        port: 3000,
        args: [
          'run',
          'dev',
          '--workspace=@deeplearner/web',
          '--',
          '--hostname',
          '127.0.0.1',
        ],
      },
      {
        label: 'admin',
        port: 5173,
        args: [
          'run',
          'dev',
          '--workspace=@deeplearner/admin',
          '--',
          '--host',
          '127.0.0.1',
        ],
      },
    ],
  };
}

export function validateRequest(input: unknown) {
  const parsed = z
    .strictObject({
      profile: z.unknown(),
      repository: z.string().min(1).max(1024),
      ownerSid: z.string(),
      secrets: z.unknown(),
      manifests: z.unknown(),
    })
    .safeParse(input);
  if (!parsed.success) throw new DevLocalError();
  validateProfile(
    parsed.data.profile,
    parsed.data.repository,
    parsed.data.ownerSid,
  );
  validateSecrets(parsed.data.secrets);
  // Return only the fixed public command plan, never credentials/profile values.
  return workspacePlan(parsed.data.manifests);
}

export async function readRequest(input: AsyncIterable<Buffer | string>) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of input) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 16384) throw new DevLocalError();
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.concat(chunks),
    );
    return JSON.parse(text) as unknown;
  } catch {
    throw new DevLocalError();
  }
}

export function devReplicaPlan() {
  return {
    _id: localTarget.replicaSet,
    members: [{ _id: 0, host: 'localhost:27019' }],
  };
}

const mongoPolicySchema = z.strictObject({
  id: z.literal('DEV-PERSISTENT-27019'),
  status: z.enum(['PROPOSED / NOT ACTIVE', 'ACTIVE']),
  sourceVersion: z.literal(1),
  target: z.strictObject({
    host: z.literal('127.0.0.1'),
    port: z.literal(27019),
    replicaSet: z.literal('deeplearner-dev-rs'),
    database: z.literal('deeplearner-dev'),
    service: z.literal('DeepLearnerDevMongo27019'),
  }),
  operations: z.tuple([
    z.literal('PrepareStorage'),
    z.literal('InstallService'),
    z.literal('StartService'),
    z.literal('StopService'),
    z.literal('BootstrapFirstUser'),
  ]),
});
export type MongoSourcePolicy = z.infer<typeof mongoPolicySchema>;
export function getDevMongoSourcePolicy(): MongoSourcePolicy {
  return {
    id: 'DEV-PERSISTENT-27019',
    status: 'PROPOSED / NOT ACTIVE',
    sourceVersion: 1,
    target: {
      host: '127.0.0.1',
      port: 27019,
      replicaSet: 'deeplearner-dev-rs',
      database: 'deeplearner-dev',
      service: 'DeepLearnerDevMongo27019',
    },
    operations: [
      'PrepareStorage',
      'InstallService',
      'StartService',
      'StopService',
      'BootstrapFirstUser',
    ],
  };
}
// Pure comparison only: accepting synthetic facts here never authorizes I/O.
export function assertDevMongoPolicyAgreement(
  local: unknown,
  peer: unknown,
  requireActive = true,
): void {
  const a = mongoPolicySchema.safeParse(local),
    b = mongoPolicySchema.safeParse(peer);
  if (
    !a.success ||
    !b.success ||
    JSON.stringify(a.data) !== JSON.stringify(b.data)
  )
    throw new Error('DEV_MONGO_SOURCE_POLICY_MISMATCH');
  if (requireActive && a.data.status !== 'ACTIVE')
    throw new Error('DEV_PERSISTENT_POLICY_NOT_ACTIVE');
}
export function assertDevMongoExecutionPolicy(peer: unknown): void {
  assertDevMongoPolicyAgreement(getDevMongoSourcePolicy(), peer);
}

async function initializeDevReplica() {
  // A separate authenticated, connection-bound bootstrap contract is required.
  // No driver import, connection or unauthenticated initialization is provided.
  throw new Error('DEV_MONGO_LEGACY_INITIALIZATION_DISABLED');
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    if (Number(process.versions.node.split('.')[0]) !== 24)
      throw new DevLocalError();
    if (process.argv.length === 3 && process.argv[2] === 'mongo-plan')
      process.stdout.write(JSON.stringify(devReplicaPlan()) + '\n');
    else if (
      process.argv.length === 3 &&
      process.argv[2] === 'mongo-initialize'
    )
      process.stdout.write(JSON.stringify(await initializeDevReplica()) + '\n');
    else if (process.argv.length === 2)
      process.stdout.write(
        JSON.stringify(validateRequest(await readRequest(process.stdin))) +
          '\n',
      );
    else throw new DevLocalError();
  } catch (error) {
    process.stderr.write(
      process.argv[2] === 'mongo-initialize'
        ? error instanceof Error &&
          error.message === 'DEV_MONGO_LEGACY_INITIALIZATION_DISABLED'
          ? 'DEV_MONGO_LEGACY_INITIALIZATION_DISABLED\n'
          : 'DEV_MONGO_INITIALIZATION_UNKNOWN_RECONCILE\n'
        : 'DEV_CONFIGURATION_REJECTED\n',
    );
    process.exitCode = 1;
  }
}

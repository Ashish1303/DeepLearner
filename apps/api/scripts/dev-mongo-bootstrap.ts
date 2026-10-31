import {
  createHash,
  createPrivateKey,
  createPublicKey,
  X509Certificate,
} from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  checkServerIdentity,
  connect as connectTLS,
  type PeerCertificate,
} from 'node:tls';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  assertDevMongoExecutionPolicy,
  localTarget,
  readRequest,
} from './dev-local.js';

// Keep the runtime refusal unconditional while allowing TypeScript to check the
// future actuator below. This wrapper is not configurable or injectable.
function enforceExecutionPolicy(): void {
  assertDevMongoExecutionPolicy();
}

export const bootstrapTarget = Object.freeze({
  ...localTarget,
  member: 'localhost:27019',
  service: 'DeepLearnerDevMongo27019',
});
export const bootstrapRoot =
  'C:\\Users\\Shreeji\\AppData\\Local\\DeepLearner\\dev\\mongo-control\\bootstrap';
export const operatorName = 'deeplearner-local-operator';
export const applicationName = 'deeplearner-local-app';
export const applicationRole = 'deeplearner-local-app-runtime';
const groups = [
  {
    collections: [
      'learningPaths',
      'modules',
      'topics',
      'visualizations',
      'practiceQuestions',
    ],
    actions: ['find'],
  },
  { collections: ['concepts'], actions: ['find', 'update'] },
  {
    collections: [
      'users',
      'sessions',
      'technologies',
      'studentProgress',
      'practiceRubricAuthorities',
      'sectionEvidenceChallenges',
      'visualizationCheckpointDefinitions',
    ],
    actions: ['find', 'insert', 'update'],
  },
  {
    collections: [
      'auditLogs',
      'practiceAttempts',
      'practiceAssessments',
      'practiceRubricVersions',
      'sectionActivityReceipts',
      'completionRequests',
    ],
    actions: ['find', 'insert'],
  },
  {
    collections: ['emailVerificationTokens', 'passwordResetTokens'],
    actions: ['find', 'insert', 'update', 'remove'],
  },
] as const;
export function applicationPrivileges() {
  return [
    {
      resource: { db: localTarget.name, collection: '' },
      actions: ['listCollections'],
    },
    ...groups.flatMap((group) =>
      group.collections.map((collection) => ({
        resource: { db: localTarget.name, collection },
        actions: [...group.actions, 'listIndexes'],
      })),
    ),
  ];
}
export const administratorRoles = () =>
  ['userAdminAnyDatabase', 'clusterMonitor'].map((role) => ({
    role,
    db: 'admin',
  }));
const actions = [
  'initialize',
  'administrator',
  'inspect-administrator',
  'application-role',
  'inspect-application-role',
  'application-user',
  'verify-application',
  'verify-normal',
] as const;
export type BootstrapAction = (typeof actions)[number];
const password = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const fingerprint = z.string().regex(/^[A-F0-9]{64}$/);
const requestSchema = z.strictObject({
  action: z.enum(actions),
  target: z.strictObject({
    host: z.literal('127.0.0.1'),
    port: z.literal(27019),
    name: z.literal('deeplearner-dev'),
    replicaSet: z.literal('deeplearner-dev-rs'),
    member: z.literal('localhost:27019'),
    service: z.literal('DeepLearnerDevMongo27019'),
  }),
  operatorPassword: password,
  applicationPassword: password,
  certificates: z.strictObject({
    ca: fingerprint,
    server: fingerprint,
    client: fingerprint,
  }),
});
export type BootstrapRequest = z.infer<typeof requestSchema>;
export function validateBootstrapRequest(input: unknown): BootstrapRequest {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new Error('DEV_MONGO_BOOTSTRAP_REQUEST_REJECTED');
  for (const value of [
    parsed.data.operatorPassword,
    parsed.data.applicationPassword,
  ]) {
    const bytes = Buffer.from(value, 'base64url');
    if (
      bytes.length !== 32 ||
      bytes.toString('base64url') !== value ||
      new Set(bytes).size < 16
    )
      throw new Error('DEV_MONGO_PRIVATE_CREDENTIAL_REJECTED');
  }
  if (
    parsed.data.operatorPassword === parsed.data.applicationPassword ||
    new Set(Object.values(parsed.data.certificates)).size !== 3
  )
    throw new Error('DEV_MONGO_PRIVATE_CREDENTIAL_REJECTED');
  return parsed.data;
}

type Reply = Record<string, unknown>;
export interface CommandStep {
  database: string;
  command: Record<string, unknown>;
  identity: 'anonymous' | 'operator' | 'application';
  delayMs?: number;
}
const command = (
  identity: CommandStep['identity'],
  database: string,
  value: Record<string, unknown>,
): CommandStep => ({ identity, database, command: value });
const durable = { w: 'majority', j: true, wtimeout: 10000 };
function requireOK(reply: Reply) {
  if (reply.ok !== 1) throw new Error('DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE');
}
function exactRoles(actual: unknown, expected: unknown) {
  if (!Array.isArray(actual)) return false;
  const normalize = (rows: unknown[]) =>
    rows
      .map((row) => {
        if (!row || typeof row !== 'object') return '';
        const r = row as Reply;
        return `${String(r.db)}/${String(r.role)}`;
      })
      .sort();
  return (
    JSON.stringify(normalize(actual)) ===
    JSON.stringify(normalize(expected as unknown[]))
  );
}
function canonicalPrivileges(input: unknown) {
  if (!Array.isArray(input)) throw new Error('DEV_MONGO_PRIVILEGES_REJECTED');
  return input
    .map((item) => {
      const p = z
        .strictObject({
          resource: z.strictObject({ db: z.string(), collection: z.string() }),
          actions: z.array(z.string()),
        })
        .parse(item);
      return JSON.stringify({
        resource: p.resource,
        actions: [...p.actions].sort(),
      });
    })
    .sort();
}
export function assertApplicationPrivileges(actual: unknown) {
  if (
    JSON.stringify(canonicalPrivileges(actual)) !==
    JSON.stringify(canonicalPrivileges(applicationPrivileges()))
  )
    throw new Error('DEV_MONGO_PRIVILEGES_REJECTED');
}
function assertHello(reply: Reply, primary = true) {
  requireOK(reply);
  if (
    reply.setName !== localTarget.replicaSet ||
    (primary && reply.isWritablePrimary !== true) ||
    !Array.isArray(reply.hosts) ||
    JSON.stringify(reply.hosts) !== JSON.stringify([bootstrapTarget.member])
  )
    throw new Error('DEV_MONGO_PRIMARY_OR_TARGET_UNKNOWN');
}
function assertReplicaConfiguration(reply: Reply) {
  requireOK(reply);
  const config = reply.config as Reply | undefined;
  const members = config?.members as Reply[] | undefined;
  if (
    config?._id !== localTarget.replicaSet ||
    members?.length !== 1 ||
    members[0]?._id !== 0 ||
    members[0]?.host !== bootstrapTarget.member ||
    members[0]?.arbiterOnly === true ||
    members[0]?.hidden === true ||
    members[0]?.buildIndexes === false ||
    (members[0]?.priority !== undefined && members[0]?.priority !== 1) ||
    (members[0]?.secondaryDelaySecs !== undefined &&
      members[0]?.secondaryDelaySecs !== 0) ||
    (members[0]?.votes !== undefined && members[0]?.votes !== 1)
  )
    throw new Error('DEV_MONGO_REPLICA_CONFIGURATION_REJECTED');
}

// Pure protocol: yields descriptions only. No driver, filesystem or network effects.
// Tests drive this generator with synthetic replies; it cannot activate the policy.
export function* bootstrapProtocol(
  input: unknown,
): Generator<CommandStep, string, Reply> {
  const r = validateBootstrapRequest(input);
  if (r.action === 'initialize') {
    const state = yield command('anonymous', 'admin', { replSetGetStatus: 1 });
    if (state.code !== 94 || state.ok !== 0)
      throw new Error('DEV_MONGO_REINITIALIZATION_REFUSED');
    requireOK(
      yield command('anonymous', 'admin', {
        replSetInitiate: {
          _id: localTarget.replicaSet,
          members: [{ _id: 0, host: bootstrapTarget.member }],
        },
      }),
    );
    for (let attempt = 0; attempt < 60; attempt++) {
      const hello = yield {
        ...command('anonymous', 'admin', { hello: 1 }),
        delayMs: attempt ? 1000 : 0,
      };
      if (hello.ok === 1 && hello.isWritablePrimary === true) {
        assertHello(hello);
        return 'REPLICA_INITIALIZED';
      }
      if (hello.setName && hello.setName !== localTarget.replicaSet)
        throw new Error('DEV_MONGO_PRIMARY_OR_TARGET_UNKNOWN');
    }
    throw new Error('DEV_MONGO_PRIMARY_TIMEOUT_RECONCILE');
  }
  assertHello(
    yield command(
      r.action === 'administrator' ? 'anonymous' : 'operator',
      'admin',
      { hello: 1 },
    ),
  );
  if (r.action === 'administrator') {
    requireOK(
      yield command('anonymous', 'admin', {
        createUser: operatorName,
        pwd: r.operatorPassword,
        mechanisms: ['SCRAM-SHA-256'],
        roles: administratorRoles(),
        writeConcern: durable,
      }),
    );
  }
  // A protected read must fail with MongoDB authorization, not a transport failure.
  const unauthenticated = yield command('anonymous', localTarget.name, {
    find: 'users',
    filter: { _id: null },
    limit: 1,
    singleBatch: true,
  });
  if (unauthenticated.ok !== 0 || unauthenticated.code !== 13)
    throw new Error('DEV_MONGO_UNAUTHENTICATED_ACCESS_NOT_REFUSED');
  requireOK(yield command('operator', 'admin', { connectionStatus: 1 }));
  assertReplicaConfiguration(
    yield command('operator', 'admin', { replSetGetConfig: 1 }),
  );
  const users = yield command('operator', 'admin', {
    usersInfo: { user: operatorName, db: 'admin' },
    showPrivileges: false,
  });
  requireOK(users);
  const operator = (users.users as Reply[] | undefined)?.[0];
  if (
    (users.users as unknown[] | undefined)?.length !== 1 ||
    !exactRoles(operator?.roles, administratorRoles())
  )
    throw new Error('DEV_MONGO_OPERATOR_PRIVILEGES_REJECTED');
  if (r.action === 'administrator' || r.action === 'inspect-administrator')
    return 'ADMINISTRATOR_VERIFIED';
  if (r.action === 'application-role') {
    requireOK(
      yield command('operator', localTarget.name, {
        createRole: applicationRole,
        privileges: applicationPrivileges(),
        roles: [],
        writeConcern: durable,
      }),
    );
  }
  const role = yield command('operator', localTarget.name, {
    rolesInfo: { role: applicationRole, db: localTarget.name },
    showPrivileges: true,
  });
  requireOK(role);
  const roles = role.roles as Reply[] | undefined;
  if (
    roles?.length !== 1 ||
    roles[0]?.role !== applicationRole ||
    roles[0]?.db !== localTarget.name ||
    !exactRoles(roles[0]?.roles, [])
  )
    throw new Error('DEV_MONGO_PRIVILEGES_REJECTED');
  assertApplicationPrivileges(roles[0]?.privileges);
  if (roles[0]?.inheritedPrivileges)
    assertApplicationPrivileges(roles[0].inheritedPrivileges);
  if (
    r.action === 'application-role' ||
    r.action === 'inspect-application-role'
  )
    return 'APPLICATION_ROLE_VERIFIED';
  if (r.action === 'application-user') {
    requireOK(
      yield command('operator', localTarget.name, {
        createUser: applicationName,
        pwd: r.applicationPassword,
        mechanisms: ['SCRAM-SHA-256'],
        roles: [{ role: applicationRole, db: localTarget.name }],
        writeConcern: durable,
      }),
    );
  }
  const app = yield command('operator', localTarget.name, {
    usersInfo: { user: applicationName, db: localTarget.name },
    showPrivileges: true,
  });
  requireOK(app);
  const appUsers = app.users as Reply[] | undefined;
  if (
    appUsers?.length !== 1 ||
    !exactRoles(appUsers[0]?.roles, [
      { role: applicationRole, db: localTarget.name },
    ])
  )
    throw new Error('DEV_MONGO_PRIVILEGES_REJECTED');
  assertApplicationPrivileges(appUsers[0]?.inheritedPrivileges);
  const authenticated = yield command('application', localTarget.name, {
    connectionStatus: 1,
    showPrivileges: true,
  });
  requireOK(authenticated);
  const info = authenticated.authInfo as Reply | undefined;
  const identities = info?.authenticatedUsers as Reply[] | undefined;
  if (
    identities?.length !== 1 ||
    identities[0]?.user !== applicationName ||
    identities[0]?.db !== localTarget.name
  )
    throw new Error('DEV_MONGO_APPLICATION_AUTHENTICATION_REJECTED');
  assertApplicationPrivileges(info?.authenticatedUserPrivileges);
  return r.action === 'verify-normal'
    ? 'NORMAL_AUTHENTICATION_VERIFIED'
    : 'APPLICATION_VERIFIED';
}

export interface CertificateFacts {
  ca: boolean;
  issuerValid: boolean;
  keyMatches: boolean;
  current: boolean;
  localhost: boolean;
  loopback: boolean;
  serverAuth: boolean;
  clientAuth: boolean;
  fingerprint: string;
}
export function assertCertificateFacts(
  facts: CertificateFacts,
  kind: 'ca' | 'server' | 'client',
  expected: string,
) {
  if (
    facts.fingerprint !== expected ||
    !facts.current ||
    !facts.issuerValid ||
    (kind === 'ca'
      ? !facts.ca
      : facts.ca || !facts.keyMatches || !facts.clientAuth) ||
    (kind === 'server' &&
      (!facts.serverAuth || !facts.localhost || !facts.loopback))
  )
    throw new Error('DEV_MONGO_CERTIFICATE_REJECTED');
}
function certificateFiles(request: BootstrapRequest) {
  const load = (name: string) => {
    const b = readFileSync(path.win32.join(bootstrapRoot, name));
    if (b.length > 32768) throw new Error('DEV_MONGO_CERTIFICATE_REJECTED');
    return b;
  };
  const caBytes = load('ca.crt'),
    serverBytes = load('server.pem'),
    clientBytes = load('client.pem');
  const ca = new X509Certificate(caBytes);
  for (const [kind, bytes] of [
    ['ca', caBytes],
    ['server', serverBytes],
    ['client', clientBytes],
  ] as const) {
    const cert = new X509Certificate(bytes);
    const now = Date.now();
    const keyMatches =
      kind === 'ca' ||
      createPublicKey(createPrivateKey(bytes))
        .export({ type: 'spki', format: 'der' })
        .equals(cert.publicKey.export({ type: 'spki', format: 'der' }));
    assertCertificateFacts(
      {
        ca: cert.ca,
        issuerValid: cert.verify(ca.publicKey),
        keyMatches,
        current:
          Date.parse(cert.validFrom) <= now && now < Date.parse(cert.validTo),
        localhost: !!cert.checkHost('localhost'),
        loopback: !!cert.checkIP('127.0.0.1'),
        serverAuth: cert.keyUsage?.includes('1.3.6.1.5.5.7.3.1') ?? false,
        clientAuth: cert.keyUsage?.includes('1.3.6.1.5.5.7.3.2') ?? false,
        fingerprint: cert.fingerprint256.replaceAll(':', ''),
      },
      kind,
      request.certificates[kind],
    );
  }
  return caBytes;
}
export function pinnedServerCheck(
  expected: string,
  hostname: string,
  certificate: PeerCertificate,
) {
  const identity = checkServerIdentity(hostname, certificate);
  if (identity) return identity;
  if (
    !certificate.raw ||
    createHash('sha256').update(certificate.raw).digest('hex').toUpperCase() !==
      expected
  )
    return new Error('DEV_MONGO_SERVER_CERTIFICATE_REJECTED');
  return undefined;
}
async function requireClientCertificate(ca: Buffer, pin: string) {
  await new Promise<void>((resolve, reject) => {
    const socket = connectTLS({
      host: localTarget.host,
      port: localTarget.port,
      ca,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      checkServerIdentity: (host, cert) => pinnedServerCheck(pin, host, cert),
    });
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error('DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN'));
    });
    socket.once('secureConnect', () => {
      socket.destroy();
      reject(new Error('DEV_MONGO_CLIENT_CERTIFICATE_NOT_REQUIRED'));
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (
        [
          'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
          'ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE',
        ].includes(error.code ?? '')
      )
        resolve();
      else reject(new Error('DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN'));
    });
  });
}

export function bootstrapClientOptions(
  request: BootstrapRequest,
  identity: CommandStep['identity'],
) {
  const normal = request.action === 'verify-normal';
  return {
    directConnection: true,
    retryReads: false,
    retryWrites: false,
    monitorCommands: false,
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    timeoutMS: 10000,
    tls: !normal,
    ...(!normal
      ? {
          tlsCAFile: path.win32.join(bootstrapRoot, 'ca.crt'),
          tlsCertificateKeyFile: path.win32.join(bootstrapRoot, 'client.pem'),
          tlsAllowInvalidCertificates: false,
          tlsAllowInvalidHostnames: false,
          checkServerIdentity: (host: string, cert: PeerCertificate) =>
            pinnedServerCheck(request.certificates.server, host, cert),
        }
      : {}),
    ...(identity === 'anonymous'
      ? {}
      : {
          authMechanism: 'SCRAM-SHA-256' as const,
          authSource: identity === 'operator' ? 'admin' : localTarget.name,
          auth: {
            username: identity === 'operator' ? operatorName : applicationName,
            password:
              identity === 'operator'
                ? request.operatorPassword
                : request.applicationPassword,
          },
        }),
  };
}

// Every real I/O entry remains behind the existing unconditional policy guard.
// No injected adapter or CLI/profile value can activate this path.
export async function executeBootstrap(input: unknown) {
  enforceExecutionPolicy();
  const request = validateBootstrapRequest(input);
  const normal = request.action === 'verify-normal';
  const ca = normal ? undefined : certificateFiles(request);
  const { default: mongoose } = await import('mongoose');
  const clients = new Map<
    CommandStep['identity'],
    InstanceType<typeof mongoose.mongo.MongoClient>
  >();
  try {
    const getClient = async (identity: CommandStep['identity']) => {
      let client = clients.get(identity);
      if (!client) {
        client = new mongoose.mongo.MongoClient(
          'mongodb://127.0.0.1:27019/',
          bootstrapClientOptions(request, identity),
        );
        clients.set(identity, client);
        await client.connect();
      }
      return client;
    };
    if (!normal) {
      await getClient('anonymous');
      await requireClientCertificate(ca!, request.certificates.server);
    }
    const protocol = bootstrapProtocol(request);
    let step = protocol.next();
    while (!step.done) {
      const spec = step.value;
      if (spec.delayMs)
        await new Promise((resolve) => setTimeout(resolve, spec.delayMs));
      if (
        spec.identity === 'anonymous' &&
        spec.command.find &&
        clients.has('anonymous')
      ) {
        await clients.get('anonymous')!.close();
        clients.delete('anonymous');
      }
      const client = await getClient(spec.identity);
      let response: Reply;
      try {
        response = await client.db(spec.database).command(spec.command);
      } catch (error) {
        // Only two read-only expected errors become protocol replies. Mutating
        // errors/timeouts always stop as uncertain; raw server errors never escape.
        const code =
          error instanceof mongoose.mongo.MongoServerError
            ? error.code
            : undefined;
        if (
          (spec.command.replSetGetStatus && code === 94) ||
          (spec.command.find && spec.identity === 'anonymous' && code === 13)
        )
          response = { ok: 0, code };
        else throw new Error('DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE');
      }
      step = protocol.next(response);
    }
    return { status: step.value };
  } finally {
    await Promise.allSettled(
      [...clients.values()].map((client) => client.close()),
    );
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    enforceExecutionPolicy(); // Refuse before stdin, certificates or driver imports.
    if (
      process.argv.length !== 2 ||
      Number(process.versions.node.split('.')[0]) !== 24
    )
      throw new Error('DEV_MONGO_BOOTSTRAP_REQUEST_REJECTED');
    process.stdout.write(
      JSON.stringify(await executeBootstrap(await readRequest(process.stdin))) +
        '\n',
    );
  } catch (error) {
    process.stderr.write(
      error instanceof Error &&
        error.message === 'DEV_PERSISTENT_POLICY_NOT_ACTIVE'
        ? 'DEV_PERSISTENT_POLICY_NOT_ACTIVE\n'
        : 'DEV_MONGO_BOOTSTRAP_STOPPED_RECONCILE\n',
    );
    process.exitCode = 1;
  }
}

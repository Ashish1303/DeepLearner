import {
  createHash,
  createPrivateKey,
  createPublicKey,
  X509Certificate,
} from 'node:crypto';
import { readFileSync, statSync, readdirSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  checkServerIdentity,
  connect as connectTLS,
  type PeerCertificate,
} from 'node:tls';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  assertDevMongoExecutionPolicy,
  assertDevMongoPolicyAgreement,
  getDevMongoSourcePolicy,
  localTarget,
  readRequest,
  getDevManualMongoPolicy,
  assertDevManualMongoPolicyAgreement,
} from './dev-local.js';

type InvocationFacts = {
  action: string;
  target: unknown;
  ownerSid: string;
  alive: boolean;
};
// Pure facts validation is not an actuator and cannot issue accepted contexts.
export function assertBootstrapInvocation(
  facts: InvocationFacts,
  action: string,
  ownerSid: string,
): void {
  if (!facts.alive) throw new Error('DEV_MONGO_EXECUTION_CONTEXT_REQUIRED');
  if (facts.action !== action) throw new Error('DEV_MONGO_ACTION_REJECTED');
  if (JSON.stringify(facts.target) !== JSON.stringify(bootstrapTarget))
    throw new Error('DEV_MONGO_TARGET_REJECTED');
  if (
    !/^S-1-5-21-(?:\d+-){2}\d+-\d+$/.test(ownerSid) ||
    facts.ownerSid !== ownerSid
  )
    throw new Error('DEV_MONGO_OWNER_REJECTED');
}
// No setter/exported issuer: only the actual CLI block below owns this identity.
let cliContext: InvocationFacts | undefined;
let manualContext: InvocationFacts | undefined;
const diagnosticPhases = [
  'ENTRY',
  'SOURCE_BINDING',
  'CERTIFICATE_FILES',
  'DRIVER_LOAD',
  'CONNECT',
  'CERTIFICATE_PROBE',
  'PROTOCOL_READ',
  'PROTOCOL_WRITE',
] as const;
let helperPhase: (typeof diagnosticPhases)[number] = 'ENTRY';
let connectionAttempted = false;
const manualContexts = new WeakSet<object>();
const acceptedContexts = new WeakSet<object>();
function enforceExecutionPolicy(action?: string): void {
  if (!cliContext || !acceptedContexts.has(cliContext))
    throw new Error('DEV_MONGO_EXECUTION_CONTEXT_REQUIRED');
  assertBootstrapInvocation(
    cliContext,
    action ?? cliContext.action,
    osOwnerSid(),
  );
  assertDevMongoExecutionPolicy(powerShellSourcePolicy());
}
function powerShellSourcePolicy(): unknown {
  const source = readFileSync(
    new URL('../../../scripts/Setup-DeepLearnerDev.ps1', import.meta.url),
    'utf8',
  );
  return parsePowerShellSourcePolicy(source);
}
export function parsePowerShellSourcePolicy(source: string): unknown {
  if (source.length > 196608)
    throw new Error('DEV_MONGO_SOURCE_POLICY_MISMATCH');
  if ((source.match(/function Get-DevMongoSourcePolicy\b/g) ?? []).length !== 1)
    throw new Error('DEV_MONGO_SOURCE_POLICY_MISMATCH');
  const metadata = source.match(
    /function Get-DevMongoSourcePolicy \{\r?\n {4}# Literal source metadata, also read by the Node CLI; never a private profile\.\r?\n {4}return @'\r?\n([^\r\n]+)\r?\n'@ \| ConvertFrom-Json -AsHashtable\r?\n\}/,
  );
  if (!metadata) throw new Error('DEV_MONGO_SOURCE_POLICY_MISMATCH');
  return JSON.parse(metadata[1]!);
}
export function parsePowerShellManualPolicy(source: string): unknown {
  const matches = [
    ...source.matchAll(
      /function Get-DevManualMongoPolicy \{\r?\n {4}return @'\r?\n([^\r\n]+)\r?\n'@ \| ConvertFrom-Json -AsHashtable\r?\n\}/g,
    ),
  ];
  if (
    source.length > 196608 ||
    matches.length !== 1 ||
    (source.match(/function Get-DevManualMongoPolicy\b/g) ?? []).length !== 1
  )
    throw new Error('DEV_MANUAL_POLICY_MISMATCH');
  return JSON.parse(matches[0]![1]!);
}
function manualPowerShellPolicy(): unknown {
  return parsePowerShellManualPolicy(
    readFileSync(
      new URL('../../../scripts/Setup-DeepLearnerDev.ps1', import.meta.url),
      'utf8',
    ),
  );
}
function osOwnerSid(): string {
  if (process.platform !== 'win32') throw new Error('DEV_MONGO_OWNER_REJECTED');
  const output = execFileSync(
    'C:\\Windows\\System32\\whoami.exe',
    ['/user', '/fo', 'csv', '/nh'],
    {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 4096,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  const match = output
    .trim()
    .match(/^"[^"\r\n]+","(S-1-5-21-(?:\d+-){2}\d+-\d+)"$/);
  if (!match) throw new Error('DEV_MONGO_OWNER_REJECTED');
  return match[1]!;
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
  manual = false,
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
    !(
      exactRoles(
        operator?.roles,
        manual &&
          r.action !== 'administrator' &&
          r.action !== 'inspect-administrator'
          ? manualAdministratorRoles()
          : administratorRoles(),
      ) ||
      (manual &&
        r.action === 'inspect-administrator' &&
        exactRoles(operator?.roles, manualAdministratorRoles()))
    )
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
  const log = path.win32.join(
    path.win32.dirname(path.win32.dirname(bootstrapRoot)),
    'mongo-logs',
    'mongod.log',
  );
  const load = () => {
    const bytes = readFileSync(log);
    if (bytes.length > 4 * 1024 * 1024)
      throw new Error('DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN');
    return bytes;
  };
  const identity = statSync(log);
  const initial = load();
  const afterInitial = statSync(log);
  if (
    identity.ino !== afterInitial.ino ||
    identity.dev !== afterInitial.dev ||
    identity.birthtimeMs !== afterInitial.birthtimeMs ||
    initial.length < identity.size ||
    afterInitial.size < initial.length
  )
    throw new Error('DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN');
  const offset = initial.length;
  let previous = initial;
  let localPort = 0;
  let failure: unknown;
  let identityFailure = false;
  // A valid certificate-bearing MongoClient has already connected with strict
  // CA/hostname/server pin checks. TLS negotiation alone is not MongoDB acceptance.
  await new Promise<void>((resolve, reject) => {
    const socket = connectTLS({
      host: localTarget.host,
      port: localTarget.port,
      ca,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      checkServerIdentity: (host, cert) => {
        const error = pinnedServerCheck(pin, host, cert);
        if (error) identityFailure = true;
        return error;
      },
    });
    socket.once('connect', () => {
      localPort = socket.localPort ?? 0;
    });
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error('DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN'));
    });
    socket.once('secureConnect', () => {
      localPort = socket.localPort ?? localPort;
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      failure = error;
      socket.destroy();
    });
    socket.once('close', () => {
      if (socket.authorizationError) identityFailure = true;
      resolve();
    });
  });
  if (identityFailure)
    throw new Error('DEV_MONGO_SERVER_CERTIFICATE_REJECTED', {
      cause: failure,
    });
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = statSync(log);
    if (
      current.ino !== identity.ino ||
      current.dev !== identity.dev ||
      current.birthtimeMs !== identity.birthtimeMs
    )
      throw new Error('DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN');
    const bytes = load();
    const afterRead = statSync(log);
    if (
      afterRead.ino !== identity.ino ||
      afterRead.dev !== identity.dev ||
      afterRead.birthtimeMs !== identity.birthtimeMs ||
      bytes.length < current.size ||
      afterRead.size < bytes.length ||
      bytes.length < offset ||
      bytes.length - offset > 512 * 1024 ||
      !isAppendOnlyLogSnapshot(previous, bytes)
    )
      throw new Error('DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN');
    previous = bytes;
    if (
      hasFreshClientCertificateRejection(
        bytes.subarray(offset).toString('utf8'),
        localPort,
      )
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN', {
    cause: failure,
  });
}

export function isAppendOnlyLogSnapshot(
  previous: Buffer,
  current: Buffer,
): boolean {
  return (
    current.length >= previous.length &&
    current.subarray(0, previous.length).equals(previous)
  );
}

export function hasFreshClientCertificateRejection(
  newLogBytes: string,
  localPort: number,
): boolean {
  if (!Number.isInteger(localPort) || localPort < 1 || localPort > 65535)
    return false;
  const rows: Record<string, unknown>[] = [];
  for (const line of newLogBytes.split('\n')) {
    try {
      const value: unknown = JSON.parse(line);
      if (value && typeof value === 'object' && !Array.isArray(value))
        rows.push(value as Record<string, unknown>);
    } catch {
      /* Incomplete trailing JSON is not evidence. */
    }
  }
  const ids = new Set<string>();
  for (const row of rows) {
    const attr = row.attr as Record<string, unknown> | undefined;
    if (
      row.id === 22943 &&
      row.c === 'NETWORK' &&
      attr?.remote === `127.0.0.1:${localPort}` &&
      Number.isInteger(attr.connectionId) &&
      Number(attr.connectionId) > 0
    )
      ids.add(`conn${String(attr.connectionId)}`);
    if (
      row.id === 23280 &&
      row.c === 'NETWORK' &&
      row.s === 'E' &&
      ids.has(String(row.ctx)) &&
      row.msg === 'No SSL certificate provided by peer; connection rejected'
    )
      return true;
  }
  return false;
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

// Exported calls cannot issue a context. All real I/O remains behind the CLI lease.
export async function executeBootstrap(input: unknown) {
  enforceExecutionPolicy();
  const request = validateBootstrapRequest(input);
  enforceExecutionPolicy(request.action);
  return executeProtocol(request, bootstrapProtocol(request));
}
async function executeProtocol(
  request: BootstrapRequest,
  protocol: Generator<CommandStep, string, Reply>,
  inspection = false,
) {
  helperPhase = 'CERTIFICATE_FILES';
  const normal = request.action === 'verify-normal';
  const ca = normal ? undefined : certificateFiles(request);
  helperPhase = 'DRIVER_LOAD';
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
        helperPhase = 'CONNECT';
        connectionAttempted = true;
        await client.connect();
      }
      return client;
    };
    if (!normal) {
      await getClient('anonymous');
      if (!inspection) {
        helperPhase = 'CERTIFICATE_PROBE';
        await requireClientCertificate(ca!, request.certificates.server);
      }
    }
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
      helperPhase = [
        'hello',
        'replSetGetStatus',
        'replSetGetConfig',
        'find',
        'usersInfo',
        'rolesInfo',
        'connectionStatus',
      ].some((key) => key in spec.command)
        ? 'PROTOCOL_READ'
        : 'PROTOCOL_WRITE';
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
          spec.command.shutdown &&
          error instanceof mongoose.mongo.MongoNetworkError
        )
          response = { ok: 1 }; // Request only; parent must observe retained process exit and port release.
        else if (
          (spec.command.replSetGetStatus && code === 94) ||
          (spec.command.find && spec.identity === 'anonymous' && code === 13)
        )
          response = { ok: 0, code };
        else
          throw new Error('DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE', {
            cause: error,
          });
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

// Pure binding check. The CLI supplies independently observed SID/hash; this issues no context.
export function assertBootstrapOwnerManifest(
  manifestInput: unknown,
  request: BootstrapRequest,
  ownerSid: string,
  helperHash: string,
): void {
  if (
    !manifestInput ||
    typeof manifestInput !== 'object' ||
    Object.keys(manifestInput).length !== 5
  )
    throw new Error('DEV_MONGO_OWNER_REJECTED');
  const manifest = manifestInput as Record<string, unknown>;
  const plan = JSON.parse(String(manifest.target)) as Record<string, unknown>;
  if (
    manifest.revision !== 2 ||
    manifest.ownerSid !== ownerSid ||
    plan.host !== bootstrapTarget.host ||
    plan.port !== bootstrapTarget.port ||
    plan.replicaSet !== bootstrapTarget.replicaSet ||
    plan.database !== bootstrapTarget.name ||
    plan.member !== bootstrapTarget.member ||
    plan.serviceName !== bootstrapTarget.service ||
    plan.root !== path.win32.dirname(path.win32.dirname(bootstrapRoot)) ||
    plan.policy !== getDevMongoSourcePolicy().status ||
    manifest.helperHash !== helperHash ||
    JSON.stringify(Object.entries(manifest.certificates as object).sort()) !==
      JSON.stringify(Object.entries(request.certificates).sort())
  )
    throw new Error('DEV_MONGO_OWNER_REJECTED');
}

export const manualShutdownRole = 'deeplearner-local-process-shutdown';
export const legacyPreparedHelperHash =
  '9EAED47244A7347BEA0F3AFAA9770FBC070BEF39AB6FEEA5E65568A2B789D675';
export const manualShutdownPrivileges = () => [
  { resource: { cluster: true }, actions: ['shutdown'] },
];
export function manualAdministratorRoles() {
  return [...administratorRoles(), { role: manualShutdownRole, db: 'admin' }];
}
export function assertManualShutdownRole(input: unknown): void {
  const parsed = z
    .strictObject({
      role: z.literal(manualShutdownRole),
      db: z.literal('admin'),
      roles: z.tuple([]),
      privileges: z.tuple([
        z.strictObject({
          resource: z.strictObject({ cluster: z.literal(true) }),
          actions: z.tuple([z.literal('shutdown')]),
        }),
      ]),
      inheritedPrivileges: z
        .tuple([
          z.strictObject({
            resource: z.strictObject({ cluster: z.literal(true) }),
            actions: z.tuple([z.literal('shutdown')]),
          }),
        ])
        .optional(),
    })
    .safeParse(input);
  if (!parsed.success)
    throw new Error('DEV_MANUAL_SHUTDOWN_PRIVILEGES_REJECTED');
}
function assertManualRoleReply(reply: Reply): void {
  requireOK(reply);
  const rows = reply.roles as Reply[] | undefined;
  if (rows?.length !== 1)
    throw new Error('DEV_MANUAL_SHUTDOWN_PRIVILEGES_REJECTED');
  const role = rows[0]!;
  assertManualShutdownRole({
    role: role.role,
    db: role.db,
    roles: role.roles,
    privileges: role.privileges,
    ...(role.inheritedPrivileges
      ? { inheritedPrivileges: role.inheritedPrivileges }
      : {}),
  });
}
const manualActions = [
  ...actions,
  'shutdown-role',
  'inspect-shutdown-role',
  'shutdown-grant',
  'inspect-shutdown-grant',
  'shutdown-bootstrap',
  'shutdown-normal',
  'inspect-replica',
] as const;
const manualRequestSchema = z.strictObject({
  runtime: z.literal('owned-process'),
  action: z.enum(manualActions),
  request: requestSchema,
});
export type ManualBootstrapRequest = z.infer<typeof manualRequestSchema>;
export function validateManualBootstrapRequest(
  input: unknown,
): ManualBootstrapRequest {
  const value = manualRequestSchema.parse(input);
  validateBootstrapRequest(value.request);
  const transportAction =
    value.action === 'shutdown-normal'
      ? 'verify-normal'
      : value.action === 'inspect-replica' ||
          value.action.startsWith('shutdown') ||
          value.action.startsWith('inspect-shutdown')
        ? 'inspect-administrator'
        : value.action;
  if (value.request.action !== transportAction)
    throw new Error('DEV_MANUAL_TRANSPORT_REJECTED');
  return value;
}
export function* manualBootstrapProtocol(
  input: unknown,
): Generator<CommandStep, string, Reply> {
  const value = validateManualBootstrapRequest(input),
    r = value.request;
  if (value.action === 'inspect-replica')
    return yield* replicaInspectionProtocol();
  if ((actions as readonly string[]).includes(value.action)) {
    if (
      !['initialize', 'administrator', 'inspect-administrator'].includes(
        value.action,
      )
    ) {
      const response = yield command('operator', 'admin', {
        rolesInfo: { role: manualShutdownRole, db: 'admin' },
        showPrivileges: true,
      });
      assertManualRoleReply(response);
    }
    return yield* bootstrapProtocol(r, true);
  }
  assertHello(yield command('operator', 'admin', { hello: 1 }));
  assertReplicaConfiguration(
    yield command('operator', 'admin', { replSetGetConfig: 1 }),
  );
  if (value.action === 'shutdown-role') {
    const before = yield command('operator', 'admin', {
      usersInfo: { user: operatorName, db: 'admin' },
    });
    requireOK(before);
    const users = before.users as Reply[] | undefined;
    if (
      users?.length !== 1 ||
      !exactRoles(users[0]?.roles, administratorRoles())
    )
      throw new Error('DEV_MANUAL_OPERATOR_ROLES_REJECTED');
    requireOK(
      yield command('operator', 'admin', {
        createRole: manualShutdownRole,
        privileges: manualShutdownPrivileges(),
        roles: [],
        writeConcern: durable,
      }),
    );
  }
  const roles = yield command('operator', 'admin', {
    rolesInfo: { role: manualShutdownRole, db: 'admin' },
    showPrivileges: true,
  });
  assertManualRoleReply(roles);
  if (
    value.action === 'shutdown-role' ||
    value.action === 'inspect-shutdown-role'
  )
    return 'SHUTDOWN_ROLE_VERIFIED';
  if (value.action === 'shutdown-grant') {
    const before = yield command('operator', 'admin', {
      usersInfo: { user: operatorName, db: 'admin' },
    });
    requireOK(before);
    const users = before.users as Reply[] | undefined;
    if (
      users?.length !== 1 ||
      !exactRoles(users[0]?.roles, administratorRoles())
    )
      throw new Error('DEV_MANUAL_OPERATOR_ROLES_REJECTED');
    requireOK(
      yield command('operator', 'admin', {
        grantRolesToUser: operatorName,
        roles: [{ role: manualShutdownRole, db: 'admin' }],
        writeConcern: durable,
      }),
    );
  }
  const after = yield command('operator', 'admin', {
    usersInfo: { user: operatorName, db: 'admin' },
  });
  requireOK(after);
  const users = after.users as Reply[] | undefined;
  if (
    users?.length !== 1 ||
    !exactRoles(users[0]?.roles, manualAdministratorRoles())
  )
    throw new Error('DEV_MANUAL_OPERATOR_ROLES_REJECTED');
  if (
    value.action === 'shutdown-grant' ||
    value.action === 'inspect-shutdown-grant'
  )
    return 'SHUTDOWN_GRANT_VERIFIED';
  requireOK(
    yield command('operator', 'admin', {
      shutdown: 1,
      force: true,
      timeoutSecs: 10,
    }),
  );
  return 'SHUTDOWN_REQUESTED';
}
export function* replicaInspectionProtocol(): Generator<
  CommandStep,
  string,
  Reply
> {
  const status = yield command('anonymous', 'admin', { replSetGetStatus: 1 });
  if (status.ok === 0 && status.code === 94) return 'REPLICA_NOT_INITIALIZED';
  requireOK(status);
  if (status.set !== localTarget.replicaSet)
    throw new Error('DEV_MANUAL_REPLICA_INSPECTION_UNKNOWN');
  assertReplicaConfiguration(
    yield command('anonymous', 'admin', { replSetGetConfig: 1 }),
  );
  assertHello(yield command('anonymous', 'admin', { hello: 1 }));
  return 'REPLICA_INITIALIZED_PRIMARY';
}

export function safeManualDiagnostic(
  error: unknown,
  phase: string = helperPhase,
  attempted: boolean = connectionAttempted,
) {
  const gates = new Set([
    'DEV_MANUAL_ACTION_REJECTED',
    'DEV_MANUAL_CONTEXT_REJECTED',
    'DEV_MANUAL_HELPER_REJECTED',
    'DEV_MANUAL_NODE_VERSION_REJECTED',
    'DEV_MANUAL_OPERATOR_ROLES_REJECTED',
    'DEV_MANUAL_POLICY_MISMATCH',
    'DEV_MANUAL_RECOVERY_BINDING_REJECTED',
    'DEV_MANUAL_RECOVERY_V_TWO_REJECTED',
    'DEV_MANUAL_INSPECTION_ATTEMPT_REJECTED',
    'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED',
    'DEV_MANUAL_NORMAL_TRANSITION_REJECTED',
    'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED',
    'DEV_MANUAL_NORMAL_RUNTIME_REJECTED',
    'DEV_MANUAL_REPLICA_INSPECTION_UNKNOWN',
    'DEV_MANUAL_SHUTDOWN_PRIVILEGES_REJECTED',
    'DEV_MANUAL_SOURCE_BINDING_REJECTED',
    'DEV_MANUAL_TRANSPORT_REJECTED',
    'DEV_MONGO_ACTION_REJECTED',
    'DEV_MONGO_APPLICATION_AUTHENTICATION_REJECTED',
    'DEV_MONGO_BOOTSTRAP_REQUEST_REJECTED',
    'DEV_MONGO_BOOTSTRAP_STOPPED_RECONCILE',
    'DEV_MONGO_CERTIFICATE_REJECTED',
    'DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN',
    'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED',
    'DEV_MONGO_OPERATOR_PRIVILEGES_REJECTED',
    'DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE',
    'DEV_MONGO_OWNER_REJECTED',
    'DEV_MONGO_PRIMARY_OR_TARGET_UNKNOWN',
    'DEV_MONGO_PRIMARY_TIMEOUT_RECONCILE',
    'DEV_MONGO_PRIVATE_CREDENTIAL_REJECTED',
    'DEV_MONGO_PRIVILEGES_REJECTED',
    'DEV_MONGO_REINITIALIZATION_REFUSED',
    'DEV_MONGO_REPLICA_CONFIGURATION_REJECTED',
    'DEV_MONGO_SERVER_CERTIFICATE_REJECTED',
    'DEV_MONGO_SOURCE_POLICY_MISMATCH',
    'DEV_MONGO_TARGET_REJECTED',
    'DEV_MONGO_UNAUTHENTICATED_ACCESS_NOT_REFUSED',
    'DEV_PERSISTENT_POLICY_NOT_ACTIVE',
  ]);
  const codes = new Set([
    'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
    'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'ERR_OSSL_PEM_NO_START_LINE',
    'ERR_STREAM_PREMATURE_CLOSE',
    'ERR_STREAM_DESTROYED',
    'EACCES',
    'EPERM',
    'ENOENT',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'EADDRNOTAVAIL',
  ]);
  const gate =
    error instanceof Error && gates.has(error.message)
      ? error.message
      : 'DEV_MANUAL_HELPER_REJECTED';
  let code = 'NONE',
    current: unknown = error;
  for (
    let depth = 0;
    current && typeof current === 'object' && depth < 5;
    depth++
  ) {
    const value = current as { code?: unknown; cause?: unknown };
    if (
      typeof value.code === 'number' &&
      Number.isInteger(value.code) &&
      value.code >= 0 &&
      value.code < 1000000
    )
      code = `MONGO_${value.code}`;
    else if (typeof value.code === 'string' && codes.has(value.code))
      code = value.code;
    current = value.cause;
  }
  return {
    status: 'HELPER_FAILED',
    phase: (diagnosticPhases as readonly string[]).includes(phase)
      ? phase
      : 'ENTRY',
    gate,
    code,
    connectionAttempted: attempted === true,
  };
}
export function assertManualSourceBinding(
  input: unknown,
  manifest: unknown,
  request: BootstrapRequest,
  ownerSid: string,
  observed: Record<string, string>,
  manifestHash: string,
  policy: unknown = getDevManualMongoPolicy(),
): void {
  const hash = z.string().regex(/^[A-F0-9]{64}$/);
  const parsed = z
    .strictObject({
      revision: z.literal(1),
      runtime: z.literal('owned-process'),
      ownerSid: z.literal(ownerSid),
      policy: z.unknown(),
      preparedManifestHash: hash,
      preparedHelperHash: z.literal(legacyPreparedHelperHash),
      sources: z.strictObject({
        powershell: hash,
        validator: hash,
        helper: hash,
        owner: hash,
      }),
    })
    .safeParse(input);
  if (
    !parsed.success ||
    parsed.data.preparedManifestHash !== manifestHash ||
    JSON.stringify(parsed.data.sources) !== JSON.stringify(observed)
  )
    throw new Error('DEV_MANUAL_SOURCE_BINDING_REJECTED');
  assertDevManualMongoPolicyAgreement(policy, parsed.data.policy);
  assertBootstrapOwnerManifest(
    manifest,
    request,
    ownerSid,
    legacyPreparedHelperHash,
  );
}
function enforceManualContext(action: string): void {
  if (!manualContext || !manualContexts.has(manualContext))
    throw new Error('DEV_MONGO_EXECUTION_CONTEXT_REQUIRED');
  if (
    !manualContext.alive ||
    manualContext.ownerSid !== osOwnerSid() ||
    manualContext.action !== action ||
    JSON.stringify(manualContext.target) !==
      JSON.stringify(getDevManualMongoPolicy().target)
  )
    throw new Error('DEV_MANUAL_CONTEXT_REJECTED');
  assertDevManualMongoPolicyAgreement(
    getDevManualMongoPolicy(),
    manualPowerShellPolicy(),
  );
}
export const preservedManualBindingHash =
  'D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C';
export const preservedInitializationIntentHash =
  '62D908896F4A43854BA7FF83BAF0EFB4CD6320FFBF8A07063998B3BF44796B0F';
export const preservedRecoveryV1Hash =
  'ACBB9C196E340B91CC5ECE5C9C1191E9FDE55696BB302033F2AE042851A923E2';
export const preservedPreparedManifestHash =
  '4CC2E0F8744F5A8A6ECF443CB2BB51822095E4599DFA58FDA956014250711A29';
export const preservedOriginalMaterialFingerprint =
  'DB78AA3A5B952C279C29442AD5DB6E1D0F252452D7F740867C4A8F7074D55547';
export const preservedBootstrapLineage = {
  'manual-runtime.json': preservedManualBindingHash,
  'manual-initialize-intent.json': preservedInitializationIntentHash,
  'manual-recovery-v1.json': preservedRecoveryV1Hash,
  'manual-recovery-v2.json':
    '5ADCE5E996E2D98730DF2580F23DECB12016628E4EFAE3E9F8F529FD251A1BA7',
  'manual-replica-inspection-v2-intent.json':
    '99E08F7C43C906DB317886BC1741BB247C55F52EAF87B8F35DA9118335A3FC22',
  'manual-replica-inspection-v2.json':
    '3BF3B94AF5D763AB45C03122E1149B523797229EE08808A775A28AFE7DECA772',
} as const;
export const bootstrapReconciliationActions = [
  'initialize',
  'administrator',
  'inspect-administrator',
  'shutdown-role',
  'inspect-shutdown-role',
  'shutdown-grant',
  'inspect-shutdown-grant',
  'application-role',
  'inspect-application-role',
  'application-user',
  'verify-application',
  'verify-normal',
  'shutdown-bootstrap',
  'shutdown-normal',
] as const;
export function assertBootstrapReconciliation(
  input: unknown,
  facts: {
    ownerSid: string;
    sources: Record<string, string>;
    lineage: Record<string, string>;
    manifestHash: string;
  },
  manifest: unknown,
  request: BootstrapRequest,
  action: string,
  policy: unknown = getDevManualMongoPolicy(),
): void {
  const h = preservedBootstrapLineage,
    hash = z.string().regex(/^[A-F0-9]{64}$/);
  const parsed = z
    .strictObject({
      revision: z.literal(2),
      mode: z.literal('BOOTSTRAP_FROM_VERIFIED_V_TWO'),
      ownerSid: z.literal(facts.ownerSid),
      policy: z.unknown(),
      action: z.literal('BootstrapOwnedMongo'),
      sources: z.strictObject({
        powershell: hash,
        validator: hash,
        helper: hash,
        owner: hash,
      }),
      parentBindingHash: z.literal(h['manual-runtime.json']),
      initializationIntentHash: z.literal(h['manual-initialize-intent.json']),
      recoveryV1Hash: z.literal(h['manual-recovery-v1.json']),
      recoveryV2Hash: z.literal(h['manual-recovery-v2.json']),
      inspectionIntentHash: z.literal(
        h['manual-replica-inspection-v2-intent.json'],
      ),
      inspectionResultHash: z.literal(h['manual-replica-inspection-v2.json']),
      preparedManifestHash: z.literal(preservedPreparedManifestHash),
      originalMaterialFingerprint: z.literal(
        preservedOriginalMaterialFingerprint,
      ),
      maximumInitializationAttempts: z.literal(1),
    })
    .safeParse(input);
  if (
    !parsed.success ||
    !(bootstrapReconciliationActions as readonly string[]).includes(action) ||
    facts.manifestHash !== preservedPreparedManifestHash ||
    JSON.stringify(parsed.data.sources) !== JSON.stringify(facts.sources) ||
    Object.keys(facts.lineage).length !== 6 ||
    Object.entries(h).some(([name, value]) => facts.lineage[name] !== value)
  )
    throw new Error('DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED');
  validateBootstrapRequest(request);
  assertDevManualMongoPolicyAgreement(policy, parsed.data.policy);
  assertBootstrapOwnerManifest(
    manifest,
    request,
    facts.ownerSid,
    legacyPreparedHelperHash,
  );
}
export const preservedNormalTransitionLineage = {
  'manual-administrator-intent.json':
    '808910F26E372A28AD047388800845DF60CE8198F6155DFB2999171EB2957382',
  'manual-administrator.json':
    '12C6471B809DF75A072A9714FBBFE4CC9D3BAD30DBB895391872C2F314BE7D35',
  'manual-application-role-intent.json':
    'EE478222984AE9DFBCFC138EF3741008B12FF632A3739D94BA98B78B272CCA31',
  'manual-application-role.json':
    'B408ECF5BD6E183E96E8865FA6445D8A823B0A641CB040FE5EA7CC6964ACB2D8',
  'manual-application-user-intent.json':
    'BA3310D602961444CF07768829C64B23121B03DB527E4F5B26F15D16CAC707C6',
  'manual-application.json':
    '26B14DD74BC7B3734AFAD83B75A997250B2146F23C2D7F66F8CEDD727EF37AFE',
  'manual-initialize-intent.json':
    '62D908896F4A43854BA7FF83BAF0EFB4CD6320FFBF8A07063998B3BF44796B0F',
  'manual-initialize-reconciliation-v1.json':
    '12D6E72ED4261E09BE434419030E8D1434F7E4CBFED39E6B9D9AB78B10388D0B',
  'manual-recovery-v1.json':
    'ACBB9C196E340B91CC5ECE5C9C1191E9FDE55696BB302033F2AE042851A923E2',
  'manual-recovery-v2.json':
    '5ADCE5E996E2D98730DF2580F23DECB12016628E4EFAE3E9F8F529FD251A1BA7',
  'manual-replica-inspection-v2-intent.json':
    '99E08F7C43C906DB317886BC1741BB247C55F52EAF87B8F35DA9118335A3FC22',
  'manual-replica-inspection-v2.json':
    '3BF3B94AF5D763AB45C03122E1149B523797229EE08808A775A28AFE7DECA772',
  'manual-replica.json':
    '3B4FFFA77B47743E099C05F7BAF5BAEF5B29C408152CF15AA338B34B2589A34B',
  'manual-runtime.json':
    'D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C',
  'manual-shutdown-grant-intent.json':
    '8828AE847446E6CF516F6023B9B33619AA1B295639178A793871ACC357C3F784',
  'manual-shutdown-grant.json':
    '0D61CAD453A8590D319937B2919C04182E30D62F7A7D157AC6D2129D4593A1A8',
  'manual-shutdown-role-intent.json':
    '3FEB3381BDAFDB9A7E16C16F2C965E04C7A5C49B75EDC7D417285665F9178D87',
  'manual-shutdown-role.json':
    '14316AC891A0F0E4181396B92C8D3AF956C63A4C9DD4B459F5B8C5E1A6E171F2',
} as const;
export const normalTransitionActions = [
  'verify-normal',
  'shutdown-normal',
] as const;
export function assertNormalTransition(
  input: unknown,
  facts: {
    ownerSid: string;
    sources: Record<string, string>;
    lineage: Record<string, string>;
    manifestHash: string;
  },
  manifest: unknown,
  request: BootstrapRequest,
  action: string,
  policy: unknown = getDevManualMongoPolicy(),
): void {
  const hash = z.string().regex(/^[A-F0-9]{64}$/);
  const parsed = z
    .strictObject({
      revision: z.literal(1),
      purpose: z.literal('COMPLETED_BOOTSTRAP_NORMAL_TRANSITION'),
      ownerSid: z.literal(facts.ownerSid),
      policy: z.unknown(),
      sources: z.strictObject({
        powershell: hash,
        validator: hash,
        helper: hash,
        owner: hash,
      }),
      lineage: z.record(z.string(), hash),
      normalConfigurationHash: z.literal(
        '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8',
      ),
      allowedActions: z.tuple([
        z.literal('verify-normal'),
        z.literal('shutdown-normal'),
      ]),
    })
    .safeParse(input);
  if (
    !parsed.success ||
    !(normalTransitionActions as readonly string[]).includes(action) ||
    facts.manifestHash !== preservedPreparedManifestHash ||
    Object.keys(facts.sources).length !== 4 ||
    Object.entries(parsed.data.sources).some(
      ([k, v]) => facts.sources[k] !== v,
    ) ||
    Object.keys(facts.lineage).length !== 18 ||
    Object.keys(parsed.data.lineage).length !== 18 ||
    Object.entries(preservedNormalTransitionLineage).some(
      ([k, v]) => facts.lineage[k] !== v || parsed.data.lineage[k] !== v,
    )
  )
    throw new Error('DEV_MANUAL_NORMAL_TRANSITION_REJECTED');
  validateBootstrapRequest(request);
  assertDevManualMongoPolicyAgreement(policy, parsed.data.policy);
  assertBootstrapOwnerManifest(
    manifest,
    request,
    facts.ownerSid,
    legacyPreparedHelperHash,
  );
}

export const previousNormalSources = {
  powershell:
    'FCB73A12DD8641FF23FC4163BD1FB93357BC9E5910440A7EF97E88681876DE61',
  validator: '95D6BE9F15184B663C7517871839D9E345DC2E10A2B5BC24D058B00C830261AC',
  helper: '1369C3AF8B71D2D9085838C3CFDE2EC42CBA526F7A62640891E70EA2240C108D',
  owner: 'BA8F2D916D5B04794270769E06C8B5CDB64A98729D28F0169AE9966F89AF9FB9',
} as const;
export const normalAmendmentLineage = {
  ...preservedNormalTransitionLineage,
  'manual-normal-transition.json':
    '27DDABEF2F3D4A466FC5D8730920738A35E282D1E1220606121D5366BD25721B',
  'manual-complete.json':
    'E3B63BC61A7762A3D8A63ED86841310225FF30E8F66D8E4E15153F9C81DB3DAB',
} as const;
export function assertNormalSourceAmendment(
  input: unknown,
  facts: {
    ownerSid: string;
    sources: Record<string, string>;
    lineage: Record<string, string>;
    manifestHash: string;
    configurationHash: string;
    provisioningHash: string;
  },
  previousReceipt: unknown,
  manifest: unknown,
  request: BootstrapRequest,
  action: string,
): void {
  const hash = z.string().regex(/^[A-F0-9]{64}$/);
  const sourceSchema = z.strictObject({
    powershell: hash,
    validator: hash,
    helper: hash,
    owner: hash,
  });
  const parsed = z
    .strictObject({
      revision: z.literal(1),
      purpose: z.literal('DF_NORMAL_RUNTIME_SOURCE_AMENDMENT'),
      ownerSid: z.literal('S-1-5-21-3436178198-164699745-524212520-1001'),
      policy: z.unknown(),
      action: z.literal('RunOwnedMongo'),
      allowedActions: z.tuple([
        z.literal('verify-normal'),
        z.literal('shutdown-normal'),
      ]),
      maximumAttempts: z.literal(1),
      normalConfigurationHash: z.literal(
        '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8',
      ),
      originalMaterialFingerprint: z.literal(
        preservedOriginalMaterialFingerprint,
      ),
      provisioningBindingHash: z.literal(
        '618AAE9C151A416B483F6116AAD3078C4A3397E5F411E54FB8892C64CE172BDA',
      ),
      previousSources: sourceSchema,
      sources: sourceSchema.extend({ starter: hash }),
      lineage: z.record(z.string(), hash),
    })
    .safeParse(input);
  if (
    !parsed.success ||
    facts.ownerSid !== parsed.data.ownerSid ||
    !(normalTransitionActions as readonly string[]).includes(action) ||
    facts.configurationHash !== parsed.data.normalConfigurationHash ||
    facts.provisioningHash !== parsed.data.provisioningBindingHash ||
    Object.keys(facts.sources).length !== 5 ||
    Object.entries(parsed.data.sources).some(
      ([k, v]) => facts.sources[k] !== v,
    ) ||
    Object.entries(previousNormalSources).some(
      ([k, v]) =>
        parsed.data.previousSources[k as keyof typeof previousNormalSources] !==
        v,
    ) ||
    Object.keys(facts.lineage).length !== 20 ||
    Object.keys(parsed.data.lineage).length !== 20 ||
    Object.entries(normalAmendmentLineage).some(
      ([k, v]) => facts.lineage[k] !== v || parsed.data.lineage[k] !== v,
    )
  )
    throw new Error('DEV_MANUAL_NORMAL_AMENDMENT_REJECTED');
  assertDevManualMongoPolicyAgreement(
    getDevManualMongoPolicy(),
    parsed.data.policy,
  );
  // Archived authority is validated as immutable history, never refreshed to current sources.
  assertNormalTransition(
    previousReceipt,
    {
      ownerSid: facts.ownerSid,
      sources: previousNormalSources,
      lineage: preservedNormalTransitionLineage,
      manifestHash: facts.manifestHash,
    },
    manifest,
    request,
    action,
  );
}
export function assertNormalAmendmentAttempt(
  input: unknown,
  ownerSid: string,
  bindingHash: string,
): void {
  if (
    !/^[A-F0-9]{64}$/.test(bindingHash) ||
    !z
      .strictObject({
        revision: z.literal(1),
        ownerSid: z.literal(ownerSid),
        bindingHash: z.literal(bindingHash),
        action: z.literal('RunOwnedMongo'),
        state: z.literal('CONSUMED_BEFORE_STARTUP'),
        attempt: z.literal(1),
      })
      .safeParse(input).success
  )
    throw new Error('DEV_MANUAL_NORMAL_AMENDMENT_REJECTED');
}

export const normalRuntimeLineage = {
  ...normalAmendmentLineage,
  'manual-normal-source-amendment.json':
    'BAEB71F91BA09F1338096EDBE36B04A2F979469C06DE6AF603E53751764F47D8',
  'manual-normal-source-amendment-intent.json':
    '8D25D8D823B273177826C5D93BD232011B93C46202777A8BC8932031A38A2115',
} as const;
export const qualifiedNormalSources = {
  powershell:
    'ED05287AA9C3DBE5E9E3D73DEE4703C23E59FFE06686047D7EF93A810B740AF6',
  validator: '95D6BE9F15184B663C7517871839D9E345DC2E10A2B5BC24D058B00C830261AC',
  helper: '9E5CBBB306C23A56DC38B865804C27EEC149261DCFFF77775DB46A3F31B532B6',
  owner: 'A61F9FBF1EF8A9FACBB58E899FDD0E27F72965CDBE12C9A166413991C421C4B7',
  starter: '15D43A314A1C06926C39564BA6DC41896681EBABCCE76BD819D31B59E6F1DD0C',
} as const;
export function assertNormalRuntimeEntries(
  entries: { name: string; file: boolean; link: boolean }[],
): void {
  const allowed = new Set<string>([
    ...Object.keys(normalRuntimeLineage),
    'manual-normal-runtime.json',
  ]);
  const seen = new Set<string>();
  for (const e of entries) {
    if (
      e.name.toLowerCase() === 'mongod.next.cfg' ||
      (e.name.toLowerCase().startsWith('manual-') &&
        e.name.toLowerCase().endsWith('.json') &&
        (!allowed.has(e.name) ||
          !e.file ||
          e.link ||
          seen.has(e.name.toLowerCase())))
    )
      throw new Error('DEV_MANUAL_NORMAL_RUNTIME_REJECTED');
    seen.add(e.name.toLowerCase());
  }
}
export function assertNormalRuntime(
  input: unknown,
  facts: {
    ownerSid: string;
    sources: Record<string, string>;
    lineage: Record<string, string>;
    manifestHash: string;
    configurationHash: string;
    binaryHash: string;
    provisioningHash: string;
  },
  qualification: unknown,
  consumedIntent: unknown,
  previousReceipt: unknown,
  manifest: unknown,
  request: BootstrapRequest,
  action: string,
): void {
  const hash = z.string().regex(/^[A-F0-9]{64}$/);
  const sources = z.strictObject({
    powershell: hash,
    validator: hash,
    helper: hash,
    owner: hash,
    starter: hash,
  });
  const parsed = z
    .strictObject({
      revision: z.literal(1),
      purpose: z.literal('REUSABLE_NORMAL_RUNTIME'),
      ownerSid: z.literal('S-1-5-21-3436178198-164699745-524212520-1001'),
      repository: z.literal('E:\\AI\\DeepLearner'),
      policy: z.unknown(),
      action: z.literal('RunOwnedMongo'),
      lifecycle: z.literal('REUSABLE_NORMAL'),
      allowedActions: z.tuple([
        z.literal('verify-normal'),
        z.literal('shutdown-normal'),
      ]),
      sources,
      lineage: z.record(z.string(), hash),
      normalConfigurationHash: z.literal(
        '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8',
      ),
      binaryHash: z.literal(
        '89C1F5664DA621A6AD8A0B26DF880BAC8265BFA921F430520A1DB158CAF2F8FE',
      ),
      preparedManifestHash: z.literal(preservedPreparedManifestHash),
      originalMaterialFingerprint: z.literal(
        preservedOriginalMaterialFingerprint,
      ),
      provisioningBindingHash: z.literal(
        '618AAE9C151A416B483F6116AAD3078C4A3397E5F411E54FB8892C64CE172BDA',
      ),
    })
    .safeParse(input);
  if (
    !parsed.success ||
    facts.ownerSid !== parsed.data.ownerSid ||
    !(normalTransitionActions as readonly string[]).includes(action) ||
    facts.manifestHash !== parsed.data.preparedManifestHash ||
    facts.configurationHash !== parsed.data.normalConfigurationHash ||
    facts.binaryHash !== parsed.data.binaryHash ||
    facts.provisioningHash !== parsed.data.provisioningBindingHash ||
    Object.keys(facts.sources).length !== 5 ||
    Object.entries(parsed.data.sources).some(
      ([k, v]) => facts.sources[k] !== v,
    ) ||
    Object.keys(facts.lineage).length !== 22 ||
    Object.keys(parsed.data.lineage).length !== 22 ||
    Object.entries(normalRuntimeLineage).some(
      ([k, v]) => facts.lineage[k] !== v || parsed.data.lineage[k] !== v,
    )
  )
    throw new Error('DEV_MANUAL_NORMAL_RUNTIME_REJECTED');
  assertDevManualMongoPolicyAgreement(
    getDevManualMongoPolicy(),
    parsed.data.policy,
  );
  // The exhausted D/F authority is immutable history, not permission for another attempt.
  assertNormalSourceAmendment(
    qualification,
    {
      ...facts,
      sources: qualifiedNormalSources,
      lineage: normalAmendmentLineage,
    },
    previousReceipt,
    manifest,
    request,
    action,
  );
  assertNormalAmendmentAttempt(
    consumedIntent,
    facts.ownerSid,
    normalRuntimeLineage['manual-normal-source-amendment.json'],
  );
}

export function assertManualRecoveryV2Binding(
  input: unknown,
  facts: {
    ownerSid: string;
    sources: Record<string, string>;
    parentHash: string;
    intentHash: string;
    recoveryV1Hash: string;
    manifestHash: string;
  },
  manifest: unknown,
  request: BootstrapRequest,
  action: string,
  policy: unknown = getDevManualMongoPolicy(),
): void {
  const hash = z.string().regex(/^[A-F0-9]{64}$/);
  const parsed = z
    .strictObject({
      revision: z.literal(2),
      runtime: z.literal('owned-process-recovery'),
      ownerSid: z.literal(facts.ownerSid),
      policy: z.unknown(),
      parentBindingHash: z.literal(preservedManualBindingHash),
      previousRecoveryBindingHash: z.literal(preservedRecoveryV1Hash),
      initializationIntentHash: z.literal(preservedInitializationIntentHash),
      preparedManifestHash: z.literal(preservedPreparedManifestHash),
      originalMaterialFingerprint: z.literal(
        preservedOriginalMaterialFingerprint,
      ),
      sources: z.strictObject({
        powershell: hash,
        validator: hash,
        helper: hash,
        owner: hash,
      }),
      allowedAction: z.literal('InspectOwnedMongo'),
      maximumAttempts: z.literal(1),
    })
    .safeParse(input);
  if (
    !parsed.success ||
    action !== 'inspect-replica' ||
    facts.parentHash !== preservedManualBindingHash ||
    facts.intentHash !== preservedInitializationIntentHash ||
    facts.recoveryV1Hash !== preservedRecoveryV1Hash ||
    facts.manifestHash !== preservedPreparedManifestHash ||
    JSON.stringify(parsed.data.sources) !== JSON.stringify(facts.sources)
  )
    throw new Error('DEV_MANUAL_RECOVERY_V_TWO_REJECTED');
  assertDevManualMongoPolicyAgreement(policy, parsed.data.policy);
  assertBootstrapOwnerManifest(
    manifest,
    request,
    facts.ownerSid,
    legacyPreparedHelperHash,
  );
}
export function assertManualRecoveryV2Attempt(
  input: unknown,
  ownerSid: string,
  bindingHash: string,
): void {
  if (
    !/^[A-F0-9]{64}$/.test(bindingHash) ||
    !z
      .strictObject({
        revision: z.literal(2),
        ownerSid: z.literal(ownerSid),
        successorBindingHash: z.literal(bindingHash),
        action: z.literal('InspectOwnedMongo'),
        inspectedState: z.literal('UNKNOWN'),
      })
      .safeParse(input).success
  )
    throw new Error('DEV_MANUAL_INSPECTION_ATTEMPT_REJECTED');
}
export function assertManualRecoveryBinding(
  input: unknown,
  facts: {
    ownerSid: string;
    sources: Record<string, string>;
    parentHash: string;
    intentHash: string;
    manifestHash: string;
  },
  manifest: unknown,
  request: BootstrapRequest,
  policy: unknown = getDevManualMongoPolicy(),
): void {
  const hash = z.string().regex(/^[A-F0-9]{64}$/);
  const parsed = z
    .strictObject({
      revision: z.literal(1),
      runtime: z.literal('owned-process-recovery'),
      ownerSid: z.literal(facts.ownerSid),
      policy: z.unknown(),
      parentBindingHash: z.literal(preservedManualBindingHash),
      initializationIntentHash: z.literal(preservedInitializationIntentHash),
      preparedManifestHash: hash,
      sources: z.strictObject({
        powershell: hash,
        validator: hash,
        helper: hash,
        owner: hash,
      }),
    })
    .safeParse(input);
  if (
    !parsed.success ||
    facts.parentHash !== preservedManualBindingHash ||
    facts.intentHash !== preservedInitializationIntentHash ||
    parsed.data.preparedManifestHash !== facts.manifestHash ||
    JSON.stringify(parsed.data.sources) !== JSON.stringify(facts.sources)
  )
    throw new Error('DEV_MANUAL_RECOVERY_BINDING_REJECTED');
  assertDevManualMongoPolicyAgreement(policy, parsed.data.policy);
  assertBootstrapOwnerManifest(
    manifest,
    request,
    facts.ownerSid,
    legacyPreparedHelperHash,
  );
}
export async function executeManualBootstrap(input: unknown) {
  if (!manualContext || !manualContexts.has(manualContext))
    throw new Error('DEV_MONGO_EXECUTION_CONTEXT_REQUIRED');
  const request = validateManualBootstrapRequest(input);
  enforceManualContext(request.action);
  return executeProtocol(
    request.request,
    manualBootstrapProtocol(request),
    request.action === 'inspect-replica',
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    if (
      process.argv.length === 3 &&
      process.argv[2] === '--check-manual-policy'
    ) {
      process.stdout.write(JSON.stringify(getDevManualMongoPolicy()) + '\n');
    } else if (
      process.argv.length === 4 &&
      (process.argv[2] === '--manual-action' ||
        process.argv[2] === '--bootstrap-action' ||
        process.argv[2] === '--normal-action' ||
        process.argv[2] === '--normal-amendment-action' ||
        process.argv[2] === '--normal-runtime-action')
    ) {
      if (Number(process.versions.node.split('.')[0]) !== 24)
        throw new Error('DEV_MANUAL_NODE_VERSION_REJECTED');
      assertDevManualMongoPolicyAgreement(
        getDevManualMongoPolicy(),
        manualPowerShellPolicy(),
      );
      const request = validateManualBootstrapRequest(
        await readRequest(process.stdin),
      );
      if (request.action !== process.argv[3])
        throw new Error('DEV_MANUAL_ACTION_REJECTED');
      const ownerSid = osOwnerSid();
      const manifestBytes = readFileSync(
        path.win32.join(bootstrapRoot, 'bootstrap-plan.json'),
      );
      const bindingBytes = readFileSync(
        path.win32.join(
          path.win32.dirname(bootstrapRoot),
          'manual-runtime.json',
        ),
      );
      helperPhase = 'SOURCE_BINDING';
      const recoveryBytes = readFileSync(
        path.win32.join(
          path.win32.dirname(bootstrapRoot),
          'manual-recovery-v1.json',
        ),
      );
      const intentBytes = readFileSync(
        path.win32.join(
          path.win32.dirname(bootstrapRoot),
          'manual-initialize-intent.json',
        ),
      );
      if (
        manifestBytes.length > 16384 ||
        bindingBytes.length > 16384 ||
        recoveryBytes.length > 16384 ||
        intentBytes.length > 16384
      )
        throw new Error('DEV_MANUAL_SOURCE_BINDING_REJECTED');
      const hash = (bytes: Buffer) =>
        createHash('sha256').update(bytes).digest('hex').toUpperCase();
      const facts = {
        ownerSid,
        sources: {
          powershell: hash(
            readFileSync(
              new URL(
                '../../../scripts/Setup-DeepLearnerDev.ps1',
                import.meta.url,
              ),
            ),
          ),
          validator: hash(
            readFileSync(new URL('./dev-local.ts', import.meta.url)),
          ),
          helper: hash(readFileSync(fileURLToPath(import.meta.url))),
          owner: hash(
            readFileSync(
              new URL('../../../scripts/LocalProcessOwner.cs', import.meta.url),
            ),
          ),
        },
        parentHash: hash(bindingBytes),
        intentHash: hash(intentBytes),
        manifestHash: hash(manifestBytes),
      };
      if (process.argv[2] === '--normal-amendment-action') {
        const control = path.win32.dirname(bootstrapRoot);
        const allowed = new Set<string>([
          ...Object.keys(normalAmendmentLineage),
          'manual-normal-source-amendment.json',
          'manual-normal-source-amendment-intent.json',
        ]);
        for (const entry of readdirSync(control, { withFileTypes: true })) {
          if (entry.name.toLowerCase() === 'mongod.next.cfg')
            throw new Error('DEV_MANUAL_NORMAL_AMENDMENT_REJECTED');
          if (
            entry.name.toLowerCase().startsWith('manual-') &&
            entry.name.toLowerCase().endsWith('.json') &&
            (!allowed.has(entry.name) ||
              !entry.isFile() ||
              entry.isSymbolicLink())
          )
            throw new Error('DEV_MANUAL_NORMAL_AMENDMENT_REJECTED');
        }
        const read = (name: string) => {
          const target = path.win32.join(control, name);
          const info = lstatSync(target);
          if (!info.isFile() || info.isSymbolicLink() || info.size > 16384)
            throw new Error('DEV_MANUAL_NORMAL_AMENDMENT_REJECTED');
          return readFileSync(target);
        };
        const lineage: Record<string, string> = {};
        for (const name of Object.keys(normalAmendmentLineage))
          lineage[name] = hash(read(name));
        const successor = read('manual-normal-source-amendment.json');
        assertNormalSourceAmendment(
          JSON.parse(successor.toString('utf8')),
          {
            ...facts,
            sources: {
              ...facts.sources,
              starter: hash(
                readFileSync(
                  new URL(
                    '../../../scripts/Start-DeepLearnerDev.ps1',
                    import.meta.url,
                  ),
                ),
              ),
            },
            lineage,
            configurationHash: hash(read('mongod.cfg')),
            provisioningHash: hash(read('local-provisioning-sources.json')),
          },
          JSON.parse(read('manual-normal-transition.json').toString('utf8')),
          JSON.parse(manifestBytes.toString('utf8')),
          request.request,
          request.action,
        );
        assertNormalAmendmentAttempt(
          JSON.parse(
            read('manual-normal-source-amendment-intent.json').toString('utf8'),
          ),
          ownerSid,
          hash(successor),
        );
      } else if (process.argv[2] === '--normal-runtime-action') {
        const control = path.win32.dirname(bootstrapRoot);
        assertNormalRuntimeEntries(
          readdirSync(control, { withFileTypes: true }).map((e) => ({
            name: e.name,
            file: e.isFile(),
            link: e.isSymbolicLink(),
          })),
        );
        const read = (name: string) => {
          const target = path.win32.join(control, name);
          const info = lstatSync(target);
          if (!info.isFile() || info.isSymbolicLink() || info.size > 16384)
            throw new Error('DEV_MANUAL_NORMAL_RUNTIME_REJECTED');
          return readFileSync(target);
        };
        const lineage: Record<string, string> = {};
        for (const name of Object.keys(normalRuntimeLineage))
          lineage[name] = hash(read(name));
        assertNormalRuntime(
          JSON.parse(read('manual-normal-runtime.json').toString('utf8')),
          {
            ...facts,
            sources: {
              ...facts.sources,
              starter: hash(
                readFileSync(
                  new URL(
                    '../../../scripts/Start-DeepLearnerDev.ps1',
                    import.meta.url,
                  ),
                ),
              ),
            },
            lineage,
            configurationHash: hash(read('mongod.cfg')),
            provisioningHash: hash(read('local-provisioning-sources.json')),
            binaryHash: hash(
              readFileSync(
                'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe',
              ),
            ),
          },
          JSON.parse(
            read('manual-normal-source-amendment.json').toString('utf8'),
          ),
          JSON.parse(
            read('manual-normal-source-amendment-intent.json').toString('utf8'),
          ),
          JSON.parse(read('manual-normal-transition.json').toString('utf8')),
          JSON.parse(manifestBytes.toString('utf8')),
          request.request,
          request.action,
        );
      } else if (process.argv[2] === '--normal-action') {
        const lineage: Record<string, string> = {};
        for (const name of Object.keys(preservedNormalTransitionLineage)) {
          const bytes = readFileSync(
            path.win32.join(path.win32.dirname(bootstrapRoot), name),
          );
          if (bytes.length > 16384)
            throw new Error('DEV_MANUAL_NORMAL_TRANSITION_REJECTED');
          lineage[name] = hash(bytes);
        }
        const receipt = readFileSync(
          path.win32.join(
            path.win32.dirname(bootstrapRoot),
            'manual-normal-transition.json',
          ),
        );
        const configuration = readFileSync(
          path.win32.join(path.win32.dirname(bootstrapRoot), 'mongod.cfg'),
        );
        if (
          receipt.length > 16384 ||
          hash(configuration) !==
            '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8'
        )
          throw new Error('DEV_MANUAL_NORMAL_TRANSITION_REJECTED');
        assertNormalTransition(
          JSON.parse(receipt.toString('utf8')),
          { ...facts, lineage },
          JSON.parse(manifestBytes.toString('utf8')),
          request.request,
          request.action,
        );
      } else if (process.argv[2] === '--bootstrap-action') {
        // Explicit bootstrap contract, never a fallback from an inspection binding.
        const lineage: Record<string, string> = {};
        for (const name of Object.keys(preservedBootstrapLineage)) {
          const bytes = readFileSync(
            path.win32.join(path.win32.dirname(bootstrapRoot), name),
          );
          if (bytes.length > 16384)
            throw new Error('DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED');
          lineage[name] = hash(bytes);
        }
        const receipt = readFileSync(
          path.win32.join(
            path.win32.dirname(bootstrapRoot),
            'manual-initialize-reconciliation-v1.json',
          ),
        );
        if (receipt.length > 16384)
          throw new Error('DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED');
        assertBootstrapReconciliation(
          JSON.parse(receipt.toString('utf8')),
          {
            ownerSid,
            sources: facts.sources,
            lineage,
            manifestHash: facts.manifestHash,
          },
          JSON.parse(manifestBytes.toString('utf8')),
          request.request,
          request.action,
        );
        if (
          request.action === 'initialize' &&
          statSync(
            path.win32.join(
              path.win32.dirname(bootstrapRoot),
              'manual-replica.json',
            ),
            { throwIfNoEntry: false },
          )
        )
          throw new Error('DEV_MONGO_REINITIALIZATION_REFUSED');
      } else if (request.action === 'inspect-replica') {
        // Explicit action selection. Missing v2 never falls back to archived v1.
        const successorBytes = readFileSync(
          path.win32.join(
            path.win32.dirname(bootstrapRoot),
            'manual-recovery-v2.json',
          ),
        );
        const attemptBytes = readFileSync(
          path.win32.join(
            path.win32.dirname(bootstrapRoot),
            'manual-replica-inspection-v2-intent.json',
          ),
        );
        if (successorBytes.length > 16384 || attemptBytes.length > 16384)
          throw new Error('DEV_MANUAL_RECOVERY_V_TWO_REJECTED');
        assertManualRecoveryV2Binding(
          JSON.parse(successorBytes.toString('utf8')),
          { ...facts, recoveryV1Hash: hash(recoveryBytes) },
          JSON.parse(manifestBytes.toString('utf8')),
          request.request,
          request.action,
        );
        assertManualRecoveryV2Attempt(
          JSON.parse(attemptBytes.toString('utf8')),
          ownerSid,
          hash(successorBytes),
        );
      } else {
        assertManualRecoveryBinding(
          JSON.parse(recoveryBytes.toString('utf8')),
          facts,
          JSON.parse(manifestBytes.toString('utf8')),
          request.request,
        );
      }
      manualContext = {
        action: request.action,
        ownerSid,
        target: getDevManualMongoPolicy().target,
        alive: true,
      };
      manualContexts.add(manualContext);
      process.stdout.write(
        JSON.stringify(await executeManualBootstrap(request)) + '\n',
      );
    } else if (
      process.argv.length === 3 &&
      process.argv[2] === '--check-policy'
    ) {
      // Local metadata only: no stdin, filesystem, crypto, child or driver calls.
      process.stdout.write(JSON.stringify(getDevMongoSourcePolicy()) + '\n');
    } else {
      if (
        process.argv.length !== 4 ||
        process.argv[2] !== '--action' ||
        !actions.includes(process.argv[3] as BootstrapAction) ||
        Number(process.versions.node.split('.')[0]) !== 24
      )
        throw new Error('DEV_MONGO_BOOTSTRAP_REQUEST_REJECTED');
      assertDevMongoPolicyAgreement(
        getDevMongoSourcePolicy(),
        powerShellSourcePolicy(),
      );
      const ownerSid = osOwnerSid();
      const request = validateBootstrapRequest(
        await readRequest(process.stdin),
      );
      if (request.action !== process.argv[3])
        throw new Error('DEV_MONGO_ACTION_REJECTED');
      const manifestBytes = readFileSync(
        path.win32.join(bootstrapRoot, 'bootstrap-plan.json'),
      );
      if (manifestBytes.length > 16384)
        throw new Error('DEV_MONGO_OWNER_REJECTED');
      assertBootstrapOwnerManifest(
        JSON.parse(manifestBytes.toString('utf8')),
        request,
        ownerSid,
        createHash('sha256')
          .update(readFileSync(fileURLToPath(import.meta.url)))
          .digest('hex')
          .toUpperCase(),
      );
      cliContext = {
        action: request.action,
        target: bootstrapTarget,
        ownerSid,
        alive: true,
      };
      acceptedContexts.add(cliContext);
      process.stdout.write(
        JSON.stringify(await executeBootstrap(request)) + '\n',
      );
    }
  } catch (error) {
    if (
      process.argv[2] === '--manual-action' ||
      process.argv[2] === '--bootstrap-action' ||
      process.argv[2] === '--normal-action' ||
      process.argv[2] === '--normal-amendment-action' ||
      process.argv[2] === '--normal-runtime-action'
    )
      process.stdout.write(JSON.stringify(safeManualDiagnostic(error)) + '\n');
    process.stderr.write(
      error instanceof Error &&
        error.message === 'DEV_PERSISTENT_POLICY_NOT_ACTIVE'
        ? 'DEV_PERSISTENT_POLICY_NOT_ACTIVE\n'
        : 'DEV_MONGO_BOOTSTRAP_STOPPED_RECONCILE\n',
    );
    process.exitCode = 1;
  } finally {
    if (manualContext) {
      manualContext.alive = false;
      manualContexts.delete(manualContext);
      manualContext = undefined;
    }
    if (cliContext) {
      cliContext.alive = false;
      acceptedContexts.delete(cliContext);
      cliContext = undefined;
    }
  }
}

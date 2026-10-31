import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  administratorRoles,
  applicationName,
  applicationPrivileges,
  applicationRole,
  assertApplicationPrivileges,
  assertCertificateFacts,
  bootstrapProtocol,
  bootstrapClientOptions,
  bootstrapTarget,
  executeBootstrap,
  operatorName,
  pinnedServerCheck,
  validateBootstrapRequest,
  type BootstrapAction,
  type BootstrapRequest,
  type CommandStep,
} from '../scripts/dev-mongo-bootstrap.js';

// Fixed synthetic bytes, not generated host credentials. All protocol replies are
// in-memory; one driver constructor checks options without connect(). There is no
// database connection, certificate generation or host configuration effect.
const request = (action: BootstrapAction): BootstrapRequest => ({
  action,
  target: bootstrapTarget,
  operatorPassword: Buffer.from(
    Array.from({ length: 32 }, (_, i) => i),
  ).toString('base64url'),
  applicationPassword: Buffer.from(
    Array.from({ length: 32 }, (_, i) => i + 32),
  ).toString('base64url'),
  certificates: {
    ca: 'A'.repeat(64),
    server: 'B'.repeat(64),
    client: 'C'.repeat(64),
  },
});
function reply(step: CommandStep): Record<string, unknown> {
  const c = step.command;
  if (c.replSetGetStatus) return { ok: 0, code: 94 };
  if (c.hello)
    return {
      ok: 1,
      isWritablePrimary: true,
      setName: bootstrapTarget.replicaSet,
      hosts: [bootstrapTarget.member],
    };
  if (c.find) return { ok: 0, code: 13 };
  if (c.replSetGetConfig)
    return {
      ok: 1,
      config: {
        _id: bootstrapTarget.replicaSet,
        members: [
          { _id: 0, host: bootstrapTarget.member, priority: 1, votes: 1 },
        ],
      },
    };
  if (c.usersInfo)
    return {
      ok: 1,
      users: [
        step.database === 'admin'
          ? { user: operatorName, roles: administratorRoles() }
          : {
              user: applicationName,
              roles: [{ role: applicationRole, db: bootstrapTarget.name }],
              inheritedPrivileges: applicationPrivileges(),
            },
      ],
    };
  if (c.rolesInfo)
    return {
      ok: 1,
      roles: [
        {
          role: applicationRole,
          db: bootstrapTarget.name,
          roles: [],
          privileges: applicationPrivileges(),
          inheritedPrivileges: applicationPrivileges(),
        },
      ],
    };
  if (c.connectionStatus)
    return {
      ok: 1,
      authInfo: {
        authenticatedUsers: [
          { db: bootstrapTarget.name, user: applicationName },
        ],
        authenticatedUserPrivileges: applicationPrivileges(),
      },
    };
  return { ok: 1 };
}
function drive(
  action: BootstrapAction,
  override: (step: CommandStep) => Record<string, unknown> = reply,
) {
  const generator = bootstrapProtocol(request(action));
  const commands: CommandStep[] = [];
  let state = generator.next();
  while (!state.done) {
    commands.push(state.value);
    state = generator.next(override(state.value));
  }
  return { status: state.value, commands };
}
test('fixed target rejects protected ports, services, hosts, names and extra options', () => {
  for (const [key, value] of [
    ['port', 27017],
    ['port', 27018],
    ['host', 'localhost'],
    ['host', '0.0.0.0'],
    ['service', 'MongoDB'],
    ['name', 'admin'],
    ['replicaSet', 'other'],
    ['member', '127.0.0.1:27019'],
  ]) {
    assert.throws(() =>
      validateBootstrapRequest({
        ...request('initialize'),
        target: { ...bootstrapTarget, [key as string]: value },
      }),
    );
  }
  assert.throws(() =>
    validateBootstrapRequest({ ...request('initialize'), activate: true }),
  );
  assert.throws(() =>
    validateBootstrapRequest({
      ...request('initialize'),
      operatorPassword: 'weak',
    }),
  );
  assert.throws(() =>
    validateBootstrapRequest({
      ...request('initialize'),
      applicationPassword: request('initialize').operatorPassword,
    }),
  );
});
test('real entry refuses before private input, certificate files or dynamic driver import', async () => {
  await assert.rejects(
    executeBootstrap(undefined),
    /DEV_PERSISTENT_POLICY_NOT_ACTIVE/,
  );
  const child = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      new URL(
        '../scripts/dev-mongo-bootstrap.ts',
        import.meta.url,
      ).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    ],
    {
      input: JSON.stringify(request('administrator')),
      encoding: 'utf8',
      timeout: 10000,
    },
  );
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.equal(child.stderr.trim(), 'DEV_PERSISTENT_POLICY_NOT_ACTIVE');
  assert.ok(!child.stderr.includes(request('administrator').operatorPassword));
});
test('replica initialization is exact, single-shot and PRIMARY-gated', () => {
  const result = drive('initialize');
  assert.equal(result.status, 'REPLICA_INITIALIZED');
  assert.deepEqual(
    result.commands.find((s) => s.command.replSetInitiate)?.command
      .replSetInitiate,
    {
      _id: 'deeplearner-dev-rs',
      members: [{ _id: 0, host: 'localhost:27019' }],
    },
  );
  assert.equal(
    result.commands.filter((s) => s.command.replSetInitiate).length,
    1,
  );
  assert.throws(
    () =>
      drive('initialize', (s) =>
        s.command.replSetGetStatus ? { ok: 1 } : reply(s),
      ),
    /REINITIALIZATION_REFUSED/,
  );
  assert.throws(
    () =>
      drive('initialize', (s) =>
        s.command.hello
          ? { ok: 1, isWritablePrimary: false, setName: 'deeplearner-dev-rs' }
          : reply(s),
      ),
    /PRIMARY_TIMEOUT/,
  );
});
test('first administrator is created only after writable PRIMARY, then code13 and actual operator inspection', () => {
  const result = drive('administrator');
  assert.equal(result.status, 'ADMINISTRATOR_VERIFIED');
  const create = result.commands.findIndex(
    (s) => s.command.createUser === operatorName,
  );
  assert.ok(create > 0);
  assert.equal(result.commands[0]?.command.hello, 1);
  assert.deepEqual(
    result.commands[create]?.command.roles,
    administratorRoles(),
  );
  assert.deepEqual(result.commands[create]?.command.mechanisms, [
    'SCRAM-SHA-256',
  ]);
  assert.ok(result.commands.findIndex((s) => s.command.find) > create);
  assert.ok(
    result.commands.some(
      (s) => s.identity === 'operator' && s.command.replSetGetConfig,
    ),
  );
  assert.throws(
    () =>
      drive('administrator', (s) =>
        s.command.createUser ? { ok: 0, code: 64 } : reply(s),
      ),
    /UNKNOWN_RECONCILE/,
  );
  assert.throws(
    () =>
      drive('administrator', (s) =>
        s.command.hello ? { ok: 1, isWritablePrimary: false } : reply(s),
      ),
    /PRIMARY_OR_TARGET/,
  );
});
test('unauthenticated proof requires Mongo Unauthorized rather than ping, TLS failure or a different error', () => {
  for (const response of [{ ok: 1 }, { ok: 0, code: 18 }, { ok: 0, code: 6 }])
    assert.throws(
      () =>
        drive('inspect-administrator', (s) =>
          s.command.find ? response : reply(s),
        ),
      /UNAUTHENTICATED_ACCESS_NOT_REFUSED/,
    );
});
test('application role/user and normal verification use the exact effective privilege manifest', () => {
  assert.equal(drive('application-role').status, 'APPLICATION_ROLE_VERIFIED');
  assert.equal(drive('application-user').status, 'APPLICATION_VERIFIED');
  assert.equal(drive('verify-normal').status, 'NORMAL_AUTHENTICATION_VERIFIED');
  const role = drive('application-role').commands.find(
    (s) => s.command.createRole,
  );
  assert.deepEqual(role?.command.privileges, applicationPrivileges());
  const app = drive('application-user').commands.find(
    (s) => s.command.createUser,
  );
  assert.equal(app?.command.createUser, applicationName);
  assert.deepEqual(app?.command.roles, [
    { role: applicationRole, db: 'deeplearner-dev' },
  ]);
});
test('interruption inspection and normal restart never repeat mutation steps', () => {
  for (const action of [
    'inspect-administrator',
    'inspect-application-role',
    'verify-application',
    'verify-normal',
  ] as const) {
    const result = drive(action);
    assert.ok(
      result.commands.every(
        (s) =>
          !s.command.createUser &&
          !s.command.createRole &&
          !s.command.replSetInitiate,
      ),
    );
  }
  assert.throws(
    () =>
      drive('verify-application', (s) =>
        s.command.usersInfo && s.database !== 'admin'
          ? { ok: 1, users: [] }
          : reply(s),
      ),
    /PRIVILEGES_REJECTED/,
  );
});
test('role comparison rejects extra actions, inherited authority and changed replicas', () => {
  const extra = structuredClone(applicationPrivileges());
  extra[0]!.actions.push('createIndex');
  assert.throws(
    () => assertApplicationPrivileges(extra),
    /PRIVILEGES_REJECTED/,
  );
  assert.throws(
    () =>
      drive('verify-application', (s) =>
        s.command.rolesInfo
          ? {
              ok: 1,
              roles: [
                {
                  role: applicationRole,
                  db: 'deeplearner-dev',
                  roles: [{ role: 'root', db: 'admin' }],
                  privileges: applicationPrivileges(),
                },
              ],
            }
          : reply(s),
      ),
    /PRIVILEGES_REJECTED/,
  );
  assert.throws(
    () =>
      drive('verify-normal', (s) =>
        s.command.replSetGetConfig
          ? {
              ok: 1,
              config: {
                _id: 'deeplearner-dev-rs',
                members: [{ _id: 0, host: 'localhost:27019', priority: 2 }],
              },
            }
          : reply(s),
      ),
    /REPLICA_CONFIGURATION/,
  );
});
test('collection/action contract matches the current API without DDL or synthetic fixture authority', () => {
  const privileges = applicationPrivileges();
  const collections = privileges.filter((p) => p.resource.collection);
  assert.equal(collections.length, 21);
  assert.equal(new Set(collections.map((p) => p.resource.collection)).size, 21);
  for (const p of privileges) {
    assert.equal(p.resource.db, 'deeplearner-dev');
    assert.ok(
      p.actions.every((a) =>
        [
          'find',
          'insert',
          'update',
          'remove',
          'listIndexes',
          'listCollections',
        ].includes(a),
      ),
    );
  }
  // Independent fixture of the owner-reviewed API contract, not derived from
  // the production role builder. Any additional action/resource must fail here.
  const approved: Record<string, string[]> = {
    learningPaths: ['find'],
    modules: ['find'],
    topics: ['find'],
    visualizations: ['find'],
    practiceQuestions: ['find'],
    concepts: ['find', 'update'],
    users: ['find', 'insert', 'update'],
    sessions: ['find', 'insert', 'update'],
    technologies: ['find', 'insert', 'update'],
    studentProgress: ['find', 'insert', 'update'],
    practiceRubricAuthorities: ['find', 'insert', 'update'],
    sectionEvidenceChallenges: ['find', 'insert', 'update'],
    visualizationCheckpointDefinitions: ['find', 'insert', 'update'],
    auditLogs: ['find', 'insert'],
    practiceAttempts: ['find', 'insert'],
    practiceAssessments: ['find', 'insert'],
    practiceRubricVersions: ['find', 'insert'],
    sectionActivityReceipts: ['find', 'insert'],
    completionRequests: ['find', 'insert'],
    emailVerificationTokens: ['find', 'insert', 'update', 'remove'],
    passwordResetTokens: ['find', 'insert', 'update', 'remove'],
  };
  assert.deepEqual(
    collections.map((p) => p.resource.collection).sort(),
    Object.keys(approved).sort(),
  );
  for (const p of collections)
    assert.deepEqual(
      [...p.actions].sort(),
      [...approved[p.resource.collection]!, 'listIndexes'].sort(),
    );
  assert.deepEqual(
    privileges.filter((p) => !p.resource.collection),
    [
      {
        resource: { db: 'deeplearner-dev', collection: '' },
        actions: ['listCollections'],
      },
    ],
  );
  const removed = collections
    .filter((p) => p.actions.includes('remove'))
    .map((p) => p.resource.collection)
    .sort();
  assert.deepEqual(removed, ['emailVerificationTokens', 'passwordResetTokens']);
  for (const name of ['concepts', 'practiceQuestions'])
    assert.ok(
      !collections
        .find((p) => p.resource.collection === name)
        ?.actions.includes('insert'),
    );
  assert.ok(
    collections
      .find((p) => p.resource.collection === 'concepts')
      ?.actions.includes('update'),
  );
  const source = (name: string) =>
    readFileSync(new URL('../src/modules/' + name, import.meta.url), 'utf8');
  assert.match(
    source('progress/dashboard.repository.ts'),
    /\.listCollections\(/,
  );
  assert.match(
    source('admin/technologies/admin-technology.repository.ts'),
    /\.listIndexes\(/,
  );
  assert.match(
    source('auth/password-recovery.repository.ts'),
    /PasswordResetToken\.deleteMany/,
  );
  assert.match(
    source('progress/section-evidence.repository.ts'),
    /collection\('concepts'\)[\s\S]*?\.updateOne\(/,
  );
});
test('certificate contract requires private CA, validity, key match, both server SANs and internal/client EKU', () => {
  const facts = {
    ca: false,
    issuerValid: true,
    keyMatches: true,
    current: true,
    localhost: true,
    loopback: true,
    serverAuth: true,
    clientAuth: true,
    fingerprint: 'B'.repeat(64),
  };
  assertCertificateFacts(facts, 'server', 'B'.repeat(64));
  for (const field of [
    'issuerValid',
    'keyMatches',
    'current',
    'localhost',
    'loopback',
    'serverAuth',
    'clientAuth',
  ])
    assert.throws(
      () =>
        assertCertificateFacts(
          { ...facts, [field]: false },
          'server',
          'B'.repeat(64),
        ),
      /CERTIFICATE_REJECTED/,
    );
  assert.throws(
    () =>
      assertCertificateFacts({ ...facts, ca: true }, 'server', 'B'.repeat(64)),
    /CERTIFICATE_REJECTED/,
  );
  assert.throws(
    () => assertCertificateFacts(facts, 'server', 'C'.repeat(64)),
    /CERTIFICATE_REJECTED/,
  );
});
test('public protocol completion never contains credentials', () => {
  for (const action of [
    'administrator',
    'application-user',
    'verify-normal',
  ] as const) {
    const result = drive(action);
    assert.ok(!result.status.includes(request(action).operatorPassword));
    assert.ok(!result.status.includes(request(action).applicationPassword));
  }
});
test('driver option parsing preserves strict TLS and the custom server pin without connecting', async () => {
  const { default: mongoose } = await import('mongoose');
  const options = bootstrapClientOptions(request('administrator'), 'anonymous');
  const client = new mongoose.mongo.MongoClient(
    'mongodb://127.0.0.1:27019/',
    options,
  );
  try {
    assert.equal(client.options.tls, true);
    assert.equal(client.options.rejectUnauthorized, true);
    assert.equal(
      client.options.checkServerIdentity,
      options.checkServerIdentity,
    );
    assert.equal(client.options.monitorCommands, false);
    assert.equal(client.options.retryWrites, false);
    assert.equal(client.options.directConnection, true);
    const normal = bootstrapClientOptions(
      request('verify-normal'),
      'application',
    );
    assert.equal(normal.tls, false);
    assert.equal(normal.tlsCertificateKeyFile, undefined);
    assert.equal(normal.authSource, 'deeplearner-dev');
    assert.equal(normal.authMechanism, 'SCRAM-SHA-256');
  } finally {
    await client.close();
  }
});
test('server pinning checks hostname as well as the exact certificate fingerprint', () => {
  const raw = Buffer.from('synthetic-certificate-fingerprint-input');
  const peer = {
    raw,
    subject: { CN: 'localhost' },
    subjectaltname: 'DNS:localhost, IP Address:127.0.0.1',
  } as Parameters<typeof pinnedServerCheck>[2];
  const pin = createHash('sha256').update(raw).digest('hex').toUpperCase();
  assert.equal(pinnedServerCheck(pin, '127.0.0.1', peer), undefined);
  assert.ok(pinnedServerCheck('0'.repeat(64), '127.0.0.1', peer));
  assert.ok(pinnedServerCheck(pin, 'other.invalid', peer));
});

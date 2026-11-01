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
  assertBootstrapInvocation,
  assertBootstrapOwnerManifest,
  bootstrapProtocol,
  bootstrapClientOptions,
  bootstrapTarget,
  executeBootstrap,
  operatorName,
  pinnedServerCheck,
  parsePowerShellSourcePolicy,
  validateBootstrapRequest,
  manualBootstrapProtocol,
  manualShutdownRole,
  manualShutdownPrivileges,
  manualAdministratorRoles,
  assertManualShutdownRole,
  assertManualSourceBinding,
  legacyPreparedHelperHash,
  executeManualBootstrap,
  parsePowerShellManualPolicy,
  validateManualBootstrapRequest,
  replicaInspectionProtocol,
  safeManualDiagnostic,
  hasFreshClientCertificateRejection,
  assertManualRecoveryBinding,
  preservedManualBindingHash,
  preservedInitializationIntentHash,
  isAppendOnlyLogSnapshot,
  assertManualRecoveryV2Binding,
  assertManualRecoveryV2Attempt,
  preservedRecoveryV1Hash,
  preservedPreparedManifestHash,
  preservedOriginalMaterialFingerprint,
  assertBootstrapReconciliation,
  preservedBootstrapLineage,
  bootstrapReconciliationActions,
  assertNormalTransition,
  preservedNormalTransitionLineage,
  normalTransitionActions,
  previousNormalSources,
  normalAmendmentLineage,
  assertNormalSourceAmendment,
  assertNormalAmendmentAttempt,
  assertNormalRuntime,
  assertNormalRuntimeEntries,
  normalRuntimeLineage,
  qualifiedNormalSources,
  type BootstrapAction,
  type BootstrapRequest,
  type CommandStep,
} from '../scripts/dev-mongo-bootstrap.js';
import {
  assertDevMongoPolicyAgreement,
  getDevMongoSourcePolicy,
  getDevManualMongoPolicy,
  assertDevManualMongoPolicyAgreement,
} from '../scripts/dev-local.js';

test('recovery inspection reads only status/config/hello and never initializes on exact94', () => {
  const uninitialized = replicaInspectionProtocol();
  const first = uninitialized.next();
  assert.ok(!first.done);
  assert.deepEqual(first.value.command, {
    replSetGetStatus: 1,
  });
  assert.deepEqual(uninitialized.next({ ok: 0, code: 94 }), {
    done: true,
    value: 'REPLICA_NOT_INITIALIZED',
  });
  const initialized = replicaInspectionProtocol();
  const seen: CommandStep[] = [];
  let state = initialized.next();
  while (!state.done) {
    seen.push(state.value);
    state = initialized.next(
      state.value.command.replSetGetStatus
        ? { ok: 1, set: localTargetForRecovery() }
        : reply(state.value),
    );
  }
  assert.equal(state.value, 'REPLICA_INITIALIZED_PRIMARY');
  assert.deepEqual(
    seen.map((row) => Object.keys(row.command)[0]),
    ['replSetGetStatus', 'replSetGetConfig', 'hello'],
  );
  const denied = replicaInspectionProtocol();
  denied.next();
  assert.throws(() => denied.next({ ok: 0, code: 13 }));
});
function localTargetForRecovery() {
  return 'deeplearner-dev-rs';
}

test('negative certificate proof requires fresh exact local port and connection context, not secureConnect or reset', () => {
  assert.equal(
    isAppendOnlyLogSnapshot(Buffer.from('old\n'), Buffer.from('old\nnew\n')),
    true,
  );
  assert.equal(
    isAppendOnlyLogSnapshot(Buffer.from('old\n'), Buffer.from('old')),
    false,
  );
  assert.equal(
    isAppendOnlyLogSnapshot(Buffer.from('old\n'), Buffer.from('new\n')),
    false,
  );
  const accepted = {
    id: 22943,
    c: 'NETWORK',
    s: 'I',
    ctx: 'listener',
    attr: { remote: '127.0.0.1:55000', connectionId: 7 },
  };
  const rejected = {
    id: 23280,
    c: 'NETWORK',
    s: 'E',
    ctx: 'conn7',
    msg: 'No SSL certificate provided by peer; connection rejected',
  };
  const log = [accepted, rejected].map((row) => JSON.stringify(row)).join('\n');
  assert.equal(hasFreshClientCertificateRejection(log, 55000), true);
  assert.equal(hasFreshClientCertificateRejection(log, 55001), false);
  assert.equal(
    hasFreshClientCertificateRejection(
      [rejected, accepted].map((row) => JSON.stringify(row)).join('\n'),
      55000,
    ),
    false,
  );
  assert.equal(
    hasFreshClientCertificateRejection(JSON.stringify(accepted), 55000),
    false,
  );
  assert.equal(
    hasFreshClientCertificateRejection(JSON.stringify(rejected), 55000),
    false,
  );
  assert.equal(
    hasFreshClientCertificateRejection(
      [accepted, { ...rejected, ctx: 'conn8' }]
        .map((row) => JSON.stringify(row))
        .join('\n'),
      55000,
    ),
    false,
  );
  assert.equal(
    hasFreshClientCertificateRejection(
      [accepted, { ...rejected, id: 999 }]
        .map((row) => JSON.stringify(row))
        .join('\n'),
      55000,
    ),
    false,
  );
  assert.equal(
    hasFreshClientCertificateRejection('null\n[1]\n"reset"\n{', 55000),
    false,
  );
  assert.equal(hasFreshClientCertificateRejection(log, 0), false);
});

test('manual error frames retain only allowlisted phase/gate/code and redact arbitrary values', () => {
  const fake = Object.assign(new Error('synthetic-private-value'), {
    code: 'synthetic-private-value',
    cause: Object.assign(new Error('nested-private-value'), {
      code: 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
    }),
  });
  const frame = safeManualDiagnostic(fake, 'CERTIFICATE_PROBE');
  assert.deepEqual(frame, {
    status: 'HELPER_FAILED',
    phase: 'CERTIFICATE_PROBE',
    gate: 'DEV_MANUAL_HELPER_REJECTED',
    code: 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
    connectionAttempted: false,
  });
  assert.ok(!JSON.stringify(frame).includes('private-value'));
  assert.equal(
    safeManualDiagnostic(
      new Error('synthetic-private-value'),
      'synthetic-private-value',
    ).phase,
    'ENTRY',
  );
  assert.equal(
    safeManualDiagnostic(
      Object.assign(new Error('DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE'), {
        cause: { code: 94 },
      }),
      'PROTOCOL_READ',
    ).code,
    'MONGO_94',
  );
});

test('diagnostic connection metadata is explicit and does not expose arbitrary error content', () => {
  const error = Object.assign(new Error('DEV_PRIVATE_PASSWORD'), {
    code: 'ERR_PRIVATE_TOKEN',
    stack: 'mongodb://synthetic:private-password@private.invalid/',
    path: 'C:\\private\\private-certificate.pem',
  });
  const before = safeManualDiagnostic(error, 'SOURCE_BINDING', false);
  const attempted = safeManualDiagnostic(error, 'CONNECT', true);
  assert.equal(before.connectionAttempted, false);
  assert.equal(attempted.connectionAttempted, true);
  assert.equal(before.gate, 'DEV_MANUAL_HELPER_REJECTED');
  assert.equal(before.code, 'NONE');
  assert.equal(JSON.stringify(attempted).includes('private'), false);
  assert.deepEqual(Object.keys(attempted).sort(), [
    'code',
    'connectionAttempted',
    'gate',
    'phase',
    'status',
  ]);
});

test('recovery generation binds immutable parent and intent and cannot adopt changed source or owner', () => {
  const owner = 'S-1-5-21-11-22-33-1001',
    sources = {
      powershell: 'D'.repeat(64),
      validator: 'E'.repeat(64),
      helper: 'F'.repeat(64),
      owner: '1'.repeat(64),
    };
  const policy = { ...getDevManualMongoPolicy(), status: 'ACTIVE' },
    manifestHash = 'A'.repeat(64);
  const manifest = {
    revision: 2,
    ownerSid: owner,
    target: JSON.stringify({
      host: '127.0.0.1',
      port: 27019,
      replicaSet: 'deeplearner-dev-rs',
      database: 'deeplearner-dev',
      member: 'localhost:27019',
      serviceName: 'DeepLearnerDevMongo27019',
      root: 'C:\\Users\\Shreeji\\AppData\\Local\\DeepLearner\\dev',
      policy: getDevMongoSourcePolicy().status,
    }),
    helperHash: legacyPreparedHelperHash,
    certificates: request('initialize').certificates,
  };
  const facts = {
    ownerSid: owner,
    sources,
    parentHash: preservedManualBindingHash,
    intentHash: preservedInitializationIntentHash,
    manifestHash,
  };
  const generation = {
    revision: 1,
    runtime: 'owned-process-recovery',
    ownerSid: owner,
    policy,
    parentBindingHash: preservedManualBindingHash,
    initializationIntentHash: preservedInitializationIntentHash,
    preparedManifestHash: manifestHash,
    sources,
  };
  const preserved = JSON.stringify({ manifest, generation });
  assert.doesNotThrow(() =>
    assertManualRecoveryBinding(
      generation,
      facts,
      manifest,
      request('initialize'),
      policy,
    ),
  );
  for (const bad of [
    { ...generation, parentBindingHash: '0'.repeat(64) },
    { ...generation, initializationIntentHash: '0'.repeat(64) },
    { ...generation, ownerSid: 'S-1-5-21-11-22-33-1002' },
    { ...generation, sources: { ...sources, helper: '0'.repeat(64) } },
    { ...generation, overwrite: true },
  ])
    assert.throws(() =>
      assertManualRecoveryBinding(
        bad,
        facts,
        manifest,
        request('initialize'),
        policy,
      ),
    );
  assert.equal(JSON.stringify({ manifest, generation }), preserved);
});

test('recovery v2 strictly preserves lineage owner target and frozen sources with inspection-only single-attempt scope', () => {
  const owner = 'S-1-5-21-11-22-33-1001';
  const sources = {
    powershell: 'D'.repeat(64),
    validator: 'E'.repeat(64),
    helper: 'F'.repeat(64),
    owner: '1'.repeat(64),
  };
  const policy = getDevManualMongoPolicy();
  const manifest = {
    revision: 2,
    ownerSid: owner,
    target: JSON.stringify({
      host: '127.0.0.1',
      port: 27019,
      replicaSet: 'deeplearner-dev-rs',
      database: 'deeplearner-dev',
      member: 'localhost:27019',
      serviceName: 'DeepLearnerDevMongo27019',
      root: 'C:\\Users\\Shreeji\\AppData\\Local\\DeepLearner\\dev',
      policy: getDevMongoSourcePolicy().status,
    }),
    helperHash: legacyPreparedHelperHash,
    certificates: request('initialize').certificates,
  };
  const facts = {
    ownerSid: owner,
    sources,
    parentHash: preservedManualBindingHash,
    intentHash: preservedInitializationIntentHash,
    recoveryV1Hash: preservedRecoveryV1Hash,
    manifestHash: preservedPreparedManifestHash,
  };
  const binding = {
    revision: 2,
    runtime: 'owned-process-recovery',
    ownerSid: owner,
    policy,
    parentBindingHash: preservedManualBindingHash,
    previousRecoveryBindingHash: preservedRecoveryV1Hash,
    initializationIntentHash: preservedInitializationIntentHash,
    preparedManifestHash: preservedPreparedManifestHash,
    originalMaterialFingerprint: preservedOriginalMaterialFingerprint,
    sources,
    allowedAction: 'InspectOwnedMongo',
    maximumAttempts: 1,
  };
  const snapshot = JSON.stringify({ binding, facts, manifest });
  const validate = (input: unknown) =>
    assertManualRecoveryV2Binding(
      input,
      facts,
      manifest,
      request('inspect-administrator'),
      'inspect-replica',
    );
  assert.doesNotThrow(() => validate(binding));
  for (const key of [
    'parentBindingHash',
    'previousRecoveryBindingHash',
    'initializationIntentHash',
    'preparedManifestHash',
    'originalMaterialFingerprint',
    'ownerSid',
    'allowedAction',
    'maximumAttempts',
    'revision',
  ])
    assert.throws(() => validate({ ...binding, [key]: 'wrong' }));
  for (const bad of [
    undefined,
    {},
    { ...binding, sources: { ...sources, helper: '0'.repeat(64) } },
    {
      ...binding,
      policy: { ...policy, target: { ...policy.target, port: 27018 } },
    },
    { ...binding, extra: true },
  ])
    assert.throws(() => validate(bad));
  for (const key of [
    'parentHash',
    'intentHash',
    'recoveryV1Hash',
    'manifestHash',
  ])
    assert.throws(() =>
      assertManualRecoveryV2Binding(
        binding,
        { ...facts, [key]: '0'.repeat(64) },
        manifest,
        request('inspect-administrator'),
        'inspect-replica',
      ),
    );
  for (const action of [
    'initialize',
    'administrator',
    'application-user',
    'verify-normal',
  ])
    assert.throws(() =>
      assertManualRecoveryV2Binding(
        binding,
        facts,
        manifest,
        request('inspect-administrator'),
        action,
      ),
    );
  assert.throws(() =>
    assertManualRecoveryBinding(
      binding,
      facts,
      manifest,
      request('inspect-administrator'),
    ),
  );
  assert.throws(() => validate({ ...binding, revision: 1 }));
  assert.equal(JSON.stringify({ binding, facts, manifest }), snapshot);
});

test('recovery v2 requires the consumed intent to bind exact successor and owner without claiming verified state', () => {
  for (const gate of [
    'DEV_MANUAL_RECOVERY_V_TWO_REJECTED',
    'DEV_MANUAL_INSPECTION_ATTEMPT_REJECTED',
  ])
    assert.equal(
      safeManualDiagnostic(new Error(gate), 'SOURCE_BINDING', false).gate,
      gate,
    );
  const owner = 'S-1-5-21-11-22-33-1001',
    hash = 'A'.repeat(64);
  const intent = {
    revision: 2,
    ownerSid: owner,
    successorBindingHash: hash,
    action: 'InspectOwnedMongo',
    inspectedState: 'UNKNOWN',
  };
  const snapshot = JSON.stringify(intent);
  assert.doesNotThrow(() => assertManualRecoveryV2Attempt(intent, owner, hash));
  for (const bad of [
    undefined,
    {},
    { ...intent, ownerSid: 'other' },
    { ...intent, successorBindingHash: 'B'.repeat(64) },
    { ...intent, action: 'initialize' },
    { ...intent, inspectedState: 'REPLICA_INITIALIZED_PRIMARY' },
    { ...intent, extra: true },
  ])
    assert.throws(() => assertManualRecoveryV2Attempt(bad, owner, hash));
  assert.equal(JSON.stringify(intent), snapshot);
  const source = readFileSync(
    new URL('../scripts/dev-mongo-bootstrap.ts', import.meta.url),
    'utf8',
  );
  const branch = source.indexOf("if (request.action === 'inspect-replica')");
  const context = source.indexOf('manualContext = {', branch);
  assert.ok(branch > 0 && context > branch);
  const gate = source.slice(branch, context);
  assert.ok(
    gate.includes('manual-recovery-v2.json') &&
      gate.includes('manual-replica-inspection-v2-intent.json') &&
      gate.includes('assertManualRecoveryV2Binding(') &&
      gate.includes('assertManualRecoveryV2Attempt('),
  );
  assert.ok(!gate.includes('catch'));
});

function reconciliationFixture() {
  const ownerSid = 'S-1-5-21-11-22-33-1001',
    sources = {
      powershell: 'D'.repeat(64),
      validator: 'E'.repeat(64),
      helper: 'F'.repeat(64),
      owner: '1'.repeat(64),
    },
    h = preservedBootstrapLineage;
  const manifest = {
    revision: 2,
    ownerSid,
    target: JSON.stringify({
      host: '127.0.0.1',
      port: 27019,
      replicaSet: 'deeplearner-dev-rs',
      database: 'deeplearner-dev',
      member: 'localhost:27019',
      serviceName: 'DeepLearnerDevMongo27019',
      root: 'C:\\Users\\Shreeji\\AppData\\Local\\DeepLearner\\dev',
      policy: getDevMongoSourcePolicy().status,
    }),
    helperHash: legacyPreparedHelperHash,
    certificates: request('initialize').certificates,
  };
  const facts = {
    ownerSid,
    sources,
    lineage: { ...h },
    manifestHash: preservedPreparedManifestHash,
  };
  const receipt = {
    revision: 2,
    mode: 'BOOTSTRAP_FROM_VERIFIED_V_TWO',
    ownerSid,
    policy: getDevManualMongoPolicy(),
    action: 'BootstrapOwnedMongo',
    sources,
    parentBindingHash: h['manual-runtime.json'],
    initializationIntentHash: h['manual-initialize-intent.json'],
    recoveryV1Hash: h['manual-recovery-v1.json'],
    recoveryV2Hash: h['manual-recovery-v2.json'],
    inspectionIntentHash: h['manual-replica-inspection-v2-intent.json'],
    inspectionResultHash: h['manual-replica-inspection-v2.json'],
    preparedManifestHash: preservedPreparedManifestHash,
    originalMaterialFingerprint: preservedOriginalMaterialFingerprint,
    maximumInitializationAttempts: 1,
  };
  return { manifest, facts, receipt };
}

test('normal transition pins completed bootstrap without granting initialization or user authority', () => {
  const f = reconciliationFixture();
  const facts = {
    ...f.facts,
    lineage: { ...preservedNormalTransitionLineage },
  };
  const receipt = {
    revision: 1,
    purpose: 'COMPLETED_BOOTSTRAP_NORMAL_TRANSITION',
    ownerSid: facts.ownerSid,
    policy: getDevManualMongoPolicy(),
    sources: facts.sources,
    lineage: { ...facts.lineage },
    normalConfigurationHash:
      '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8',
    allowedActions: ['verify-normal', 'shutdown-normal'],
  };
  const snapshot = JSON.stringify({ facts, receipt, manifest: f.manifest });
  for (const action of normalTransitionActions)
    assert.doesNotThrow(() =>
      assertNormalTransition(
        receipt,
        facts,
        f.manifest,
        request('verify-normal'),
        action,
      ),
    );
  for (const action of bootstrapReconciliationActions.filter(
    (a) => !(normalTransitionActions as readonly string[]).includes(a),
  ))
    assert.throws(() =>
      assertNormalTransition(
        receipt,
        facts,
        f.manifest,
        request('verify-normal'),
        action,
      ),
    );
  for (const bad of [
    { ...receipt, revision: 2 },
    { ...receipt, ownerSid: 'wrong' },
    { ...receipt, purpose: 'RECOVERY' },
    { ...receipt, allowedActions: ['initialize'] },
    { ...receipt, sources: { ...receipt.sources, helper: '0'.repeat(64) } },
    {
      ...receipt,
      lineage: { ...receipt.lineage, 'manual-replica.json': '0'.repeat(64) },
    },
    { ...receipt, lineage: {} },
    { ...receipt, normalConfigurationHash: '0'.repeat(64) },
    {
      ...receipt,
      policy: {
        ...getDevManualMongoPolicy(),
        target: { ...getDevManualMongoPolicy().target, port: 27018 },
      },
    },
    { ...receipt, extra: true },
    f.receipt,
  ])
    assert.throws(() =>
      assertNormalTransition(
        bad,
        facts,
        f.manifest,
        request('verify-normal'),
        'verify-normal',
      ),
    );
  for (const bad of [
    { ...facts, lineage: {} },
    { ...facts, manifestHash: '0'.repeat(64) },
    { ...facts, sources: { ...facts.sources, owner: '0'.repeat(64) } },
  ])
    assert.throws(() =>
      assertNormalTransition(
        receipt,
        bad,
        f.manifest,
        request('verify-normal'),
        'verify-normal',
      ),
    );
  assert.equal(
    JSON.stringify({ facts, receipt, manifest: f.manifest }),
    snapshot,
  );
});
test('bootstrap reconciliation pins six immutable records and independent scoped source authority without adopting v2', () => {
  const { manifest, facts, receipt } = reconciliationFixture(),
    snapshot = JSON.stringify({ manifest, facts, receipt });
  const validate = (input: unknown) =>
    assertBootstrapReconciliation(
      input,
      facts,
      manifest,
      request('initialize'),
      'initialize',
    );
  assert.doesNotThrow(() => validate(receipt));
  for (const bad of [
    undefined,
    {},
    { ...receipt, ownerSid: 'other' },
    { ...receipt, inspectionResultHash: '0'.repeat(64) },
    { ...receipt, initializationIntentHash: '0'.repeat(64) },
    { ...receipt, sources: { ...facts.sources, helper: '0'.repeat(64) } },
    { ...receipt, policy: { ...receipt.policy, sourceVersion: 99 } },
    {
      ...receipt,
      policy: {
        ...receipt.policy,
        target: { ...receipt.policy.target, port: 27018 },
      },
    },
    { ...receipt, maximumInitializationAttempts: 2 },
    { ...receipt, action: 'InspectOwnedMongo' },
    { ...receipt, extra: true },
  ])
    assert.throws(() => validate(bad));
  for (const name of Object.keys(preservedBootstrapLineage))
    assert.throws(() =>
      assertBootstrapReconciliation(
        receipt,
        { ...facts, lineage: { ...facts.lineage, [name]: '0'.repeat(64) } },
        manifest,
        request('initialize'),
        'initialize',
      ),
    );
  assert.throws(() =>
    assertBootstrapReconciliation(
      receipt,
      { ...facts, ownerSid: 'other' },
      manifest,
      request('initialize'),
      'initialize',
    ),
  );
  for (const action of ['inspect-replica', 'BootstrapOwnedMongo', 'unreviewed'])
    assert.throws(() =>
      assertBootstrapReconciliation(
        receipt,
        facts,
        manifest,
        request('initialize'),
        action,
      ),
    );
  assert.ok(
    !bootstrapReconciliationActions.includes('inspect-replica' as never),
  );
  assert.throws(() =>
    validate({
      revision: 2,
      allowedAction: 'InspectOwnedMongo',
      maximumAttempts: 1,
    }),
  );
  assert.equal(JSON.stringify({ manifest, facts, receipt }), snapshot);
  assert.equal(
    safeManualDiagnostic(
      new Error('DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'),
      'SOURCE_BINDING',
      false,
    ).gate,
    'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED',
  );
});
test('bootstrap fresh94 gate refuses initialized denied or uncertain responses before any initialization write', () => {
  for (const response of [
    { ok: 1, set: bootstrapTarget.replicaSet },
    { ok: 0, code: 13 },
    { ok: 0, code: 91 },
    { ok: 1, code: 94 },
    {},
  ]) {
    const protocol = bootstrapProtocol(request('initialize'), true);
    const first = protocol.next();
    assert.ok(!first.done);
    assert.deepEqual(first.value.command, { replSetGetStatus: 1 });
    assert.throws(() => protocol.next(response));
  }
  const protocol = bootstrapProtocol(request('initialize'), true);
  protocol.next();
  const next = protocol.next({ ok: 0, code: 94 });
  assert.ok(!next.done);
  assert.deepEqual(next.value.command.replSetInitiate, {
    _id: 'deeplearner-dev-rs',
    members: [{ _id: 0, host: 'localhost:27019' }],
  });
});

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
test('imported actuator has no CLI context and child policy check is metadata only', async () => {
  await assert.rejects(
    executeBootstrap(undefined),
    /DEV_PERSISTENT_POLICY_NOT_ACTIVE|DEV_MONGO_EXECUTION_CONTEXT_REQUIRED/,
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
      '--check-policy',
    ],
    {
      input: JSON.stringify(request('administrator')),
      encoding: 'utf8',
      timeout: 10000,
    },
  );
  assert.equal(child.status, 0);
  assert.equal(JSON.parse(child.stdout).id, 'DEV-PERSISTENT-27019');
  assert.equal(child.stderr, '');
  assert.ok(!child.stderr.includes(request('administrator').operatorPassword));
});

test('source agreement rejects inactive, mixed, wrong-version, target and operation policies without I/O', () => {
  const inactive = {
    ...getDevMongoSourcePolicy(),
    status: 'PROPOSED / NOT ACTIVE',
  };
  assert.throws(
    () => assertDevMongoPolicyAgreement(inactive, inactive),
    /NOT_ACTIVE/,
  );
  const active = { ...inactive, status: 'ACTIVE' };
  assert.doesNotThrow(() => assertDevMongoPolicyAgreement(active, active));
  for (const peer of [
    inactive,
    { ...active, sourceVersion: 2 },
    { ...active, target: { ...active.target, port: 27017 } },
    { ...active, target: { ...active.target, port: 27018 } },
    { ...active, operations: [...active.operations, 'InitializeReplica'] },
    { ...active, permit: true },
    { ...active, id: 'other' },
  ])
    assert.throws(
      () => assertDevMongoPolicyAgreement(active, peer),
      /SOURCE_POLICY_MISMATCH/,
    );
});

test('literal PS source and Node policy agree without executing a host operation', () => {
  const source = readFileSync(
    new URL('../../../scripts/Setup-DeepLearnerDev.ps1', import.meta.url),
    'utf8',
  );
  assertDevMongoPolicyAgreement(
    getDevMongoSourcePolicy(),
    parsePowerShellSourcePolicy(source),
    false,
  );
  assert.throws(
    () =>
      parsePowerShellSourcePolicy(
        source + '\nfunction Get-DevMongoSourcePolicy {}',
      ),
    /SOURCE_POLICY_MISMATCH/,
  );
  assert.throws(
    () =>
      parsePowerShellSourcePolicy(
        source.replace("return @'", 'return "profile" #'),
      ),
    /SOURCE_POLICY_MISMATCH/,
  );
});

test('pure invocation facts reject wrong action, target, owner and revoked lifetime', () => {
  const ownerSid = 'S-1-5-21-11-22-33-1001';
  const facts = {
    action: 'administrator',
    ownerSid,
    target: bootstrapTarget,
    alive: true,
  };
  assert.doesNotThrow(() =>
    assertBootstrapInvocation(facts, 'administrator', ownerSid),
  );
  assert.throws(
    () => assertBootstrapInvocation(facts, 'initialize', ownerSid),
    /ACTION_REJECTED/,
  );
  assert.throws(
    () =>
      assertBootstrapInvocation(
        { ...facts, target: { ...bootstrapTarget, port: 27018 } },
        'administrator',
        ownerSid,
      ),
    /TARGET_REJECTED/,
  );
  assert.throws(
    () =>
      assertBootstrapInvocation(
        facts,
        'administrator',
        'S-1-5-21-11-22-33-1002',
      ),
    /OWNER_REJECTED/,
  );
  assert.throws(
    () =>
      assertBootstrapInvocation(facts, 'administrator', 'claimed-env-owner'),
    /OWNER_REJECTED/,
  );
  try {
    throw new Error('synthetic cancellation');
  } catch {
    /* no real context */
  } finally {
    facts.alive = false;
  }
  assert.throws(
    () => assertBootstrapInvocation(facts, 'administrator', ownerSid),
    /CONTEXT_REQUIRED/,
  );
});

test('cross-process manifest binds observed OS owner, exact target, helper source and certificate pins', () => {
  const owner = 'S-1-5-21-11-22-33-1001',
    helperHash = 'D'.repeat(64);
  const r = request('administrator');
  const plan = {
    host: '127.0.0.1',
    port: 27019,
    replicaSet: 'deeplearner-dev-rs',
    database: 'deeplearner-dev',
    member: 'localhost:27019',
    serviceName: 'DeepLearnerDevMongo27019',
    root: 'C:\\Users\\Shreeji\\AppData\\Local\\DeepLearner\\dev',
    policy: getDevMongoSourcePolicy().status,
  };
  const manifest = {
    revision: 2,
    ownerSid: owner,
    target: JSON.stringify(plan),
    helperHash,
    certificates: r.certificates,
  };
  assert.doesNotThrow(() =>
    assertBootstrapOwnerManifest(manifest, r, owner, helperHash),
  );
  for (const invalid of [
    { ...manifest, ownerSid: 'S-1-5-21-11-22-33-1002' },
    { ...manifest, helperHash: 'E'.repeat(64) },
    {
      ...manifest,
      certificates: { ...r.certificates, client: 'F'.repeat(64) },
    },
    ...[27017, 27018].map((port) => ({
      ...manifest,
      target: JSON.stringify({ ...plan, port }),
    })),
    { ...manifest, target: JSON.stringify({ ...plan, root: 'C:\\foreign' }) },
    {
      ...manifest,
      target: JSON.stringify({ ...plan, serviceName: 'MongoDB' }),
    },
    {
      ...manifest,
      target: JSON.stringify({
        ...plan,
        policy:
          getDevMongoSourcePolicy().status === 'ACTIVE'
            ? 'PROPOSED / NOT ACTIVE'
            : 'ACTIVE',
      }),
    },
    { ...manifest, ownerContext: true },
  ])
    assert.throws(() =>
      assertBootstrapOwnerManifest(invalid, r, owner, helperHash),
    );
});

test('public input cannot issue a context, including after a failed exported call', async () => {
  const forged = {
    ...request('administrator'),
    context: {
      action: 'administrator',
      alive: true,
      ownerSid: 'S-1-5-21-11-22-33-1001',
    },
    policy: { status: 'ACTIVE' },
  };
  assert.throws(() => validateBootstrapRequest(forged));
  for (const input of [forged, request('administrator'), undefined])
    await assert.rejects(executeBootstrap(input), /EXECUTION_CONTEXT_REQUIRED/);
  const source = readFileSync(
    new URL('../scripts/dev-mongo-bootstrap.ts', import.meta.url),
    'utf8',
  );
  const cli = source.indexOf('if (\n  process.argv[1]');
  assert.ok(cli > 0);
  assert.ok(source.indexOf('cliContext = {') > cli);
  assert.ok(source.indexOf('acceptedContexts.add(') > cli);
  assert.equal((source.match(/acceptedContexts\.add\(/g) ?? []).length, 1);
  assert.match(
    source.slice(cli),
    /finally\s*\{[\s\S]*cliContext\.alive = false;[\s\S]*acceptedContexts\.delete\(cliContext\);[\s\S]*cliContext = undefined;/,
  );
  assert.match(
    source,
    /execFileSync\(\s*'C:\\\\Windows\\\\System32\\\\whoami\.exe'/,
  );
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

test('manual metadata matches PowerShell and imported execution has no live context', async () => {
  const source = readFileSync(
    new URL('../../../scripts/Setup-DeepLearnerDev.ps1', import.meta.url),
    'utf8',
  );
  assertDevManualMongoPolicyAgreement(
    getDevManualMongoPolicy(),
    parsePowerShellManualPolicy(source),
    false,
  );
  await assert.rejects(
    executeManualBootstrap(undefined),
    /EXECUTION_CONTEXT_REQUIRED/,
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
      '--check-manual-policy',
    ],
    { encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(child.status, 0);
  assert.deepEqual(JSON.parse(child.stdout), getDevManualMongoPolicy());
  assert.equal(child.stderr, '');
});

test('manual shutdown grants exactly shutdown on cluster, never application privileges or inherited roles', () => {
  const role = {
    role: manualShutdownRole,
    db: 'admin',
    roles: [],
    privileges: manualShutdownPrivileges(),
  };
  assert.doesNotThrow(() => assertManualShutdownRole(role));
  for (const bad of [
    { ...role, db: 'deeplearner-dev' },
    { ...role, roles: administratorRoles() },
    {
      ...role,
      privileges: [
        { resource: { cluster: true }, actions: ['shutdown', 'setParameter'] },
      ],
    },
    { ...role, privileges: applicationPrivileges() },
    {
      ...role,
      inheritedPrivileges: [
        { resource: { cluster: true }, actions: ['shutdown', 'dropDatabase'] },
      ],
    },
  ])
    assert.throws(() => assertManualShutdownRole(bad));
  assert.ok(!JSON.stringify(applicationPrivileges()).includes('shutdown'));
  assert.deepEqual(
    administratorRoles().map((row) => row.role),
    ['userAdminAnyDatabase', 'clusterMonitor'],
  );
});

function manualDrive(
  action:
    | 'shutdown-role'
    | 'inspect-shutdown-role'
    | 'shutdown-grant'
    | 'inspect-shutdown-grant'
    | 'shutdown-bootstrap'
    | 'shutdown-normal',
) {
  const input = {
    runtime: 'owned-process',
    action,
    request: request(
      action === 'shutdown-normal' ? 'verify-normal' : 'inspect-administrator',
    ),
  };
  const generator = manualBootstrapProtocol(input),
    commands: CommandStep[] = [];
  let state = generator.next();
  while (!state.done) {
    const step = state.value;
    commands.push(step);
    let response = reply(step);
    if (step.command.rolesInfo)
      response = {
        ok: 1,
        roles: [
          {
            role: manualShutdownRole,
            db: 'admin',
            roles: [],
            privileges: manualShutdownPrivileges(),
            inheritedPrivileges: manualShutdownPrivileges(),
          },
        ],
      };
    if (step.command.usersInfo)
      response = {
        ok: 1,
        users: [
          {
            user: operatorName,
            roles:
              action === 'shutdown-role' ||
              (action === 'shutdown-grant' &&
                !commands.some((item) => item.command.grantRolesToUser))
                ? administratorRoles()
                : manualAdministratorRoles(),
          },
        ],
      };
    state = generator.next(response);
  }
  return { status: state.value, commands };
}

test('manual role/grant recovery is inspection-only and shutdown requires actual role inspection', () => {
  assert.equal(manualDrive('shutdown-role').status, 'SHUTDOWN_ROLE_VERIFIED');
  assert.equal(manualDrive('shutdown-grant').status, 'SHUTDOWN_GRANT_VERIFIED');
  assert.equal(
    manualDrive('shutdown-grant').commands.filter(
      (step) => step.command.grantRolesToUser,
    ).length,
    1,
  );
  for (const action of [
    'inspect-shutdown-role',
    'inspect-shutdown-grant',
  ] as const)
    assert.ok(
      manualDrive(action).commands.every(
        (step) =>
          !step.command.createRole &&
          !step.command.grantRolesToUser &&
          !step.command.createUser,
      ),
    );
  for (const action of ['shutdown-bootstrap', 'shutdown-normal'] as const) {
    const result = manualDrive(action);
    assert.equal(result.status, 'SHUTDOWN_REQUESTED');
    const last = result.commands.at(-1)!;
    assert.equal(last.database, 'admin');
    assert.deepEqual(last.command, {
      shutdown: 1,
      force: true,
      timeoutSecs: 10,
    });
    assert.ok(result.commands.some((step) => step.command.rolesInfo));
    assert.ok(result.commands.some((step) => step.command.usersInfo));
  }
  assert.throws(() =>
    validateManualBootstrapRequest({
      runtime: 'service',
      action: 'shutdown-normal',
      request: request('verify-normal'),
    }),
  );
  assert.throws(() =>
    validateManualBootstrapRequest({
      runtime: 'owned-process',
      action: 'shutdown-normal',
      request: request('inspect-administrator'),
    }),
  );
});

test('manual source binding preserves legacy manifest and rejects source, owner, target and migration drift', () => {
  const owner = 'S-1-5-21-11-22-33-1001';
  const sources = {
    powershell: 'D'.repeat(64),
    validator: 'E'.repeat(64),
    helper: 'F'.repeat(64),
    owner: '1'.repeat(64),
  };
  const policy = { ...getDevManualMongoPolicy(), status: 'ACTIVE' };
  const manifest = {
    revision: 2,
    ownerSid: owner,
    target: JSON.stringify({
      host: '127.0.0.1',
      port: 27019,
      replicaSet: 'deeplearner-dev-rs',
      database: 'deeplearner-dev',
      member: 'localhost:27019',
      serviceName: 'DeepLearnerDevMongo27019',
      root: 'C:\\Users\\Shreeji\\AppData\\Local\\DeepLearner\\dev',
      policy: getDevMongoSourcePolicy().status,
    }),
    helperHash: legacyPreparedHelperHash,
    certificates: request('initialize').certificates,
  };
  const original = JSON.stringify(manifest);
  const binding = {
    revision: 1,
    runtime: 'owned-process',
    ownerSid: owner,
    policy,
    preparedManifestHash: 'A'.repeat(64),
    preparedHelperHash: legacyPreparedHelperHash,
    sources,
  };
  assert.doesNotThrow(() =>
    assertManualSourceBinding(
      binding,
      manifest,
      request('initialize'),
      owner,
      sources,
      'A'.repeat(64),
      policy,
    ),
  );
  for (const bad of [
    { ...binding, runtime: 'service' },
    { ...binding, ownerSid: 'S-1-5-21-11-22-33-1002' },
    { ...binding, preparedManifestHash: 'B'.repeat(64) },
    { ...binding, sources: { ...sources, helper: '0'.repeat(64) } },
    { ...binding, policy: getDevMongoSourcePolicy() },
    { ...binding, approved: true },
  ])
    assert.throws(() =>
      assertManualSourceBinding(
        bad,
        manifest,
        request('initialize'),
        owner,
        sources,
        'A'.repeat(64),
        policy,
      ),
    );
  assert.equal(JSON.stringify(manifest), original);
});

test('manual normal verification rejects broadened shutdown privileges before ordinary protocol success', () => {
  const generator = manualBootstrapProtocol({
    runtime: 'owned-process',
    action: 'verify-normal',
    request: request('verify-normal'),
  });
  const first = generator.next();
  assert.ok(!first.done && first.value.command.rolesInfo);
  assert.throws(() =>
    generator.next({
      ok: 1,
      roles: [
        {
          role: manualShutdownRole,
          db: 'admin',
          roles: [],
          privileges: [
            {
              resource: { cluster: true },
              actions: ['shutdown', 'setParameter'],
            },
          ],
        },
      ],
    }),
  );
});

test('normal source successor pins immutable lineage and separate current authority without fallback', () => {
  const f = reconciliationFixture();
  const ownerSid = 'S-1-5-21-3436178198-164699745-524212520-1001';
  const manifest = { ...f.manifest, ownerSid };
  const sources = { ...f.facts.sources, starter: 'A'.repeat(64) };
  const facts = {
    ownerSid,
    sources,
    lineage: { ...normalAmendmentLineage } as Record<string, string>,
    manifestHash: preservedPreparedManifestHash,
    configurationHash:
      '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8',
    provisioningHash:
      '618AAE9C151A416B483F6116AAD3078C4A3397E5F411E54FB8892C64CE172BDA',
  };
  const previous = {
    revision: 1,
    purpose: 'COMPLETED_BOOTSTRAP_NORMAL_TRANSITION',
    ownerSid,
    policy: getDevManualMongoPolicy(),
    sources: previousNormalSources,
    lineage: { ...preservedNormalTransitionLineage },
    normalConfigurationHash: facts.configurationHash,
    allowedActions: [...normalTransitionActions],
  };
  const binding = {
    revision: 1,
    purpose: 'DF_NORMAL_RUNTIME_SOURCE_AMENDMENT',
    ownerSid,
    policy: getDevManualMongoPolicy(),
    action: 'RunOwnedMongo',
    allowedActions: [...normalTransitionActions],
    maximumAttempts: 1,
    normalConfigurationHash: facts.configurationHash,
    originalMaterialFingerprint: preservedOriginalMaterialFingerprint,
    provisioningBindingHash: facts.provisioningHash,
    previousSources: previousNormalSources,
    sources,
    lineage: { ...normalAmendmentLineage } as Record<string, string>,
  };
  const frozen = JSON.stringify({ binding, facts, previous, manifest });
  const validate = (
    input: unknown,
    current = facts,
    old: unknown = previous,
    action = 'verify-normal',
  ) =>
    assertNormalSourceAmendment(
      input,
      current,
      old,
      manifest,
      request('verify-normal'),
      action,
    );
  for (const action of normalTransitionActions)
    assert.doesNotThrow(() => validate(binding, facts, previous, action));
  for (const bad of [
    null,
    {},
    [],
    { ...binding, ownerSid: 'other' },
    { ...binding, revision: '1' },
    { ...binding, maximumAttempts: 2 },
    { ...binding, action: 'BootstrapOwnedMongo' },
    { ...binding, allowedActions: ['initialize'] },
    { ...binding, extra: true },
    { ...binding, previousSources: sources },
    { ...binding, sources: { ...sources, starter: 'B'.repeat(64) } },
    { ...binding, lineage: {} },
    {
      ...binding,
      policy: {
        ...binding.policy,
        target: { ...binding.policy.target, port: 27017 },
      },
    },
  ])
    assert.throws(() => validate(bad));
  for (const key of [
    'ownerSid',
    'configurationHash',
    'provisioningHash',
    'manifestHash',
  ])
    assert.throws(() => validate(binding, { ...facts, [key]: 'wrong' }));
  for (const key of Object.keys(sources))
    assert.throws(() =>
      validate(binding, {
        ...facts,
        sources: { ...sources, [key]: 'B'.repeat(64) },
      }),
    );
  assert.throws(() =>
    validate(binding, {
      ...facts,
      lineage: { ...facts.lineage, 'manual-complete.json': 'B'.repeat(64) },
    }),
  );
  assert.throws(() => validate(binding, facts, { ...previous, sources }));
  for (const action of [
    'initialize',
    'administrator',
    'application-user',
    'ProvisionLocal',
    'BootstrapOwnedMongo',
  ])
    assert.throws(() => validate(binding, facts, previous, action));
  assert.throws(() =>
    assertNormalTransition(
      binding,
      {
        ...facts,
        sources: f.facts.sources,
        lineage: preservedNormalTransitionLineage,
      },
      manifest,
      request('verify-normal'),
      'verify-normal',
    ),
  );
  assert.equal(JSON.stringify({ binding, facts, previous, manifest }), frozen);
});
test('normal amendment consumed intent is strict and cannot be substituted or silently recreated', () => {
  const owner = 'S-1-5-21-3436178198-164699745-524212520-1001',
    hash = 'A'.repeat(64);
  const intent = {
    revision: 1,
    ownerSid: owner,
    bindingHash: hash,
    action: 'RunOwnedMongo',
    state: 'CONSUMED_BEFORE_STARTUP',
    attempt: 1,
  };
  assert.doesNotThrow(() => assertNormalAmendmentAttempt(intent, owner, hash));
  for (const bad of [
    null,
    {},
    [],
    { ...intent, bindingHash: 'B'.repeat(64) },
    { ...intent, ownerSid: 'other' },
    { ...intent, attempt: 2 },
    { ...intent, state: 'READY' },
    { ...intent, action: 'initialize' },
    { ...intent, extra: true },
  ])
    assert.throws(() => assertNormalAmendmentAttempt(bad, owner, hash));
  const source = readFileSync(
    new URL('../scripts/dev-mongo-bootstrap.ts', import.meta.url),
    'utf8',
  );
  const start = source.indexOf(
    "if (process.argv[2] === '--normal-amendment-action')",
  );
  const end = source.indexOf(
    "} else if (process.argv[2] === '--normal-action')",
    start,
  );
  const branch = source.slice(start, end);
  assert.ok(
    start > 0 &&
      end > start &&
      branch.includes('assertNormalAmendmentAttempt(') &&
      branch.includes('assertNormalSourceAmendment(') &&
      branch.includes('lstatSync') &&
      !branch.includes('catch'),
  );
  assert.equal(
    safeManualDiagnostic(
      new Error('DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'),
      'SOURCE_BINDING',
      false,
    ).gate,
    'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED',
  );
});

test('source policy readers remain bounded for the reviewed larger offline reader', () => {
  const source = readFileSync(
    new URL('../../../scripts/Setup-DeepLearnerDev.ps1', import.meta.url),
    'utf8',
  );
  const atLimit = source.padEnd(196608, ' ');
  assert.equal(atLimit.length, 196608);
  assertDevMongoPolicyAgreement(
    getDevMongoSourcePolicy(),
    parsePowerShellSourcePolicy(atLimit),
    false,
  );
  assertDevManualMongoPolicyAgreement(
    getDevManualMongoPolicy(),
    parsePowerShellManualPolicy(atLimit),
  );
  assert.throws(
    () => parsePowerShellSourcePolicy(atLimit + ' '),
    /SOURCE_POLICY_MISMATCH/,
  );
  assert.throws(
    () => parsePowerShellManualPolicy(atLimit + ' '),
    /POLICY_MISMATCH/,
  );
  assert.throws(
    () =>
      parsePowerShellManualPolicy(
        source + '\nfunction Get-DevManualMongoPolicy {}',
      ),
    /POLICY_MISMATCH/,
  );
});

function reusableFixture() {
  const f = reconciliationFixture();
  const ownerSid = 'S-1-5-21-3436178198-164699745-524212520-1001';
  const manifest = { ...f.manifest, ownerSid };
  const sources = { ...f.facts.sources, starter: 'A'.repeat(64) };
  const facts = {
    ownerSid,
    sources,
    lineage: { ...normalRuntimeLineage } as Record<string, string>,
    manifestHash: preservedPreparedManifestHash,
    configurationHash:
      '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8',
    binaryHash:
      '89C1F5664DA621A6AD8A0B26DF880BAC8265BFA921F430520A1DB158CAF2F8FE',
    provisioningHash:
      '618AAE9C151A416B483F6116AAD3078C4A3397E5F411E54FB8892C64CE172BDA',
  };
  const previous = {
    revision: 1,
    purpose: 'COMPLETED_BOOTSTRAP_NORMAL_TRANSITION',
    ownerSid,
    policy: getDevManualMongoPolicy(),
    sources: previousNormalSources,
    lineage: { ...preservedNormalTransitionLineage },
    normalConfigurationHash: facts.configurationHash,
    allowedActions: [...normalTransitionActions],
  };
  const qualification = {
    revision: 1,
    purpose: 'DF_NORMAL_RUNTIME_SOURCE_AMENDMENT',
    ownerSid,
    policy: getDevManualMongoPolicy(),
    action: 'RunOwnedMongo',
    allowedActions: [...normalTransitionActions],
    maximumAttempts: 1,
    normalConfigurationHash: facts.configurationHash,
    originalMaterialFingerprint: preservedOriginalMaterialFingerprint,
    provisioningBindingHash: facts.provisioningHash,
    previousSources: previousNormalSources,
    sources: qualifiedNormalSources,
    lineage: { ...normalAmendmentLineage },
  };
  const intent = {
    revision: 1,
    ownerSid,
    bindingHash: normalRuntimeLineage['manual-normal-source-amendment.json'],
    action: 'RunOwnedMongo',
    state: 'CONSUMED_BEFORE_STARTUP',
    attempt: 1,
  };
  const binding = {
    revision: 1,
    purpose: 'REUSABLE_NORMAL_RUNTIME',
    ownerSid,
    repository: 'E:\\AI\\DeepLearner',
    policy: getDevManualMongoPolicy(),
    action: 'RunOwnedMongo',
    lifecycle: 'REUSABLE_NORMAL',
    allowedActions: [...normalTransitionActions],
    sources,
    lineage: { ...normalRuntimeLineage },
    normalConfigurationHash: facts.configurationHash,
    binaryHash: facts.binaryHash,
    preparedManifestHash: preservedPreparedManifestHash,
    originalMaterialFingerprint: preservedOriginalMaterialFingerprint,
    provisioningBindingHash: facts.provisioningHash,
  };
  return { binding, facts, qualification, intent, previous, manifest };
}
test('reusable Normal authority supports repeated immutable Normal validations without granting bootstrap or replay', () => {
  const f = reusableFixture();
  const frozen = JSON.stringify(f);
  for (let run = 0; run < 2; run++)
    for (const action of normalTransitionActions)
      assert.doesNotThrow(() =>
        assertNormalRuntime(
          f.binding,
          f.facts,
          f.qualification,
          f.intent,
          f.previous,
          f.manifest,
          request('verify-normal'),
          action,
        ),
      );
  for (const action of [
    'initialize',
    'administrator',
    'application-user',
    'application-role',
    'shutdown-role',
    'inspect-replica',
    'BootstrapOwnedMongo',
    'ProvisionLocal',
  ])
    assert.throws(() =>
      assertNormalRuntime(
        f.binding,
        f.facts,
        f.qualification,
        f.intent,
        f.previous,
        f.manifest,
        request('verify-normal'),
        action,
      ),
    );
  assert.equal(JSON.stringify(f), frozen);
});
test('reusable Normal owner target source binary config credentials lineage and exhausted intent fail closed', () => {
  const f = reusableFixture();
  const validate = (
    input: unknown = f.binding,
    facts = f.facts,
    q: unknown = f.qualification,
    i: unknown = f.intent,
  ) =>
    assertNormalRuntime(
      input,
      facts,
      q,
      i,
      f.previous,
      f.manifest,
      request('verify-normal'),
      'verify-normal',
    );
  for (const bad of [
    null,
    {},
    [],
    { ...f.binding, ownerSid: 'other' },
    { ...f.binding, repository: 'C:\\other' },
    { ...f.binding, lifecycle: 'ONCE' },
    { ...f.binding, maximumAttempts: 1 },
    { ...f.binding, allowedActions: ['initialize'] },
    { ...f.binding, originalMaterialFingerprint: 'A'.repeat(64) },
    { ...f.binding, revision: '1' },
    { ...f.binding, extra: true },
    {
      ...f.binding,
      policy: {
        ...f.binding.policy,
        target: { ...f.binding.policy.target, port: 27017 },
      },
    },
  ])
    assert.throws(() => validate(bad));
  for (const key of [
    'ownerSid',
    'manifestHash',
    'configurationHash',
    'binaryHash',
    'provisioningHash',
  ])
    assert.throws(() => validate(f.binding, { ...f.facts, [key]: 'wrong' }));
  for (const key of Object.keys(f.facts.sources))
    assert.throws(() =>
      validate(f.binding, {
        ...f.facts,
        sources: { ...f.facts.sources, [key]: 'B'.repeat(64) },
      }),
    );
  for (const key of Object.keys(f.facts.lineage))
    assert.throws(() =>
      validate(f.binding, {
        ...f.facts,
        lineage: { ...f.facts.lineage, [key]: 'B'.repeat(64) },
      }),
    );
  for (const bad of [
    null,
    { ...f.intent, state: 'READY' },
    { ...f.intent, attempt: 2 },
    { ...f.intent, bindingHash: 'A'.repeat(64) },
  ])
    assert.throws(() => validate(f.binding, f.facts, f.qualification, bad));
  assert.throws(() =>
    validate(f.binding, f.facts, { ...f.qualification, maximumAttempts: 2 }),
  );
  assert.throws(() =>
    validate(f.binding, f.facts, {
      ...f.qualification,
      sources: f.facts.sources,
    }),
  );
  assert.throws(() => validate(f.qualification));
});
test('reusable Normal directory metadata refuses unknown links directories case aliases and pending config', () => {
  const good = Object.keys(normalRuntimeLineage).map((name) => ({
    name,
    file: true,
    link: false,
  }));
  assert.doesNotThrow(() =>
    assertNormalRuntimeEntries([
      ...good,
      { name: 'manual-normal-runtime.json', file: true, link: false },
    ]),
  );
  for (const e of [
    { name: 'manual-new.json', file: true, link: false },
    { name: 'manual-normal-runtime.json', file: true, link: true },
    { name: 'manual-normal-runtime.json', file: false, link: false },
    { name: 'MANUAL-NORMAL-RUNTIME.JSON', file: true, link: false },
    { name: 'mongod.next.cfg', file: true, link: false },
  ])
    assert.throws(() => assertNormalRuntimeEntries([...good, e]));
  assert.throws(() => assertNormalRuntimeEntries([...good, good[0]]));
});
test('reusable CLI selector authenticates only after fixed durable lineage validation and emits secret-safe failures', () => {
  const source = readFileSync(
    new URL('../scripts/dev-mongo-bootstrap.ts', import.meta.url),
    'utf8',
  );
  const begin = source.indexOf(
    "} else if (process.argv[2] === '--normal-runtime-action')",
  );
  const end = source.indexOf(
    "} else if (process.argv[2] === '--normal-action')",
    begin,
  );
  const branch = source.slice(begin, end);
  assert.ok(
    begin > 0 &&
      end > begin &&
      branch.includes('assertNormalRuntime(') &&
      branch.includes('assertNormalRuntimeEntries(') &&
      branch.includes('lstatSync') &&
      !branch.includes('catch') &&
      !branch.includes('writeFile'),
  );
  assert.ok(end < source.indexOf('manualContexts.add(manualContext)', end));
  assert.equal(
    safeManualDiagnostic(
      new Error('DEV_MANUAL_NORMAL_RUNTIME_REJECTED'),
      'SOURCE_BINDING',
      false,
    ).gate,
    'DEV_MANUAL_NORMAL_RUNTIME_REJECTED',
  );
  assert.ok(
    !JSON.stringify(
      safeManualDiagnostic(
        new Error('password=synthetic-secret'),
        'SOURCE_BINDING',
        false,
      ),
    ).includes('synthetic-secret'),
  );
});

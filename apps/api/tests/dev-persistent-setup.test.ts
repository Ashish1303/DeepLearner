import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { Concept } from '../src/modules/concepts/concept.model.js';
import { PracticeQuestion } from '../src/modules/practice/practice-question.model.js';
import { Visualization } from '../src/modules/visualizations/visualization.model.js';
import '../src/modules/auth/session.model.js';
import '../src/modules/audit/audit.model.js';
import '../src/modules/auth/email-verification-token.model.js';
import '../src/modules/auth/password-reset-token.model.js';
import '../src/modules/practice/practice-attempt.model.js';
import '../src/modules/practice/practice-assessment.model.js';
import '../src/modules/practice/practice-rubric.model.js';
import '../src/modules/progress/progress.model.js';
import '../src/modules/progress/section-evidence-challenge.model.js';
import '../src/modules/progress/section-evidence-receipt.model.js';
import '../src/modules/progress/completion-request.model.js';
import '../src/modules/visualizations/visualization-checkpoint-definition.model.js';
import { applicationPrivileges } from '../scripts/dev-mongo-bootstrap.js';
import {
  hashPassword,
  verifyPassword,
} from '../src/modules/auth/password.service.js';
import {
  setupTarget,
  setupRole,
  setupPrivileges,
  approvedCollections,
  seedCollections,
  assertSetupRole,
  validateSetupRequest,
  assertSetupBinding,
  planAdditiveSchema,
  assertExistingDemoAccount,
  assertSetupPhaseRecord,
  assertSetupPhaseInventory,
  demoAccounts,
  demoContent,
  executeSetup,
  canonical,
  safeSetupFailure,
} from '../scripts/dev-persistent-setup.js';

const owner = 'S-1-5-21-3436178198-164699745-524212520-1001',
  bindingHash = 'A'.repeat(64);
const input = () => ({
  action: 'preflight',
  ownerSid: owner,
  target: { ...setupTarget },
  ownedProcessId: 1234,
  existingCompleted: false,
  secrets: { operator: 'B'.repeat(43), application: 'C'.repeat(43) },
});
test('setup import and exported execution cannot issue an accepted context or connect', async () => {
  assert.equal(mongoose.connection.readyState, 0);
  await assert.rejects(
    executeSetup(input()),
    /SETUP_EXECUTION_CONTEXT_REQUIRED/,
  );
  assert.equal(mongoose.connection.readyState, 0);
});
test('all 21 approved model collections and declared index inventory fit the existing bounded response', () => {
  const models = Object.values(mongoose.models);
  assert.deepEqual(
    models.map((m) => m.collection.collectionName).sort(),
    approvedCollections,
  );
  assert.deepEqual(
    applicationPrivileges()
      .flatMap((p) => (p.resource.collection ? [p.resource.collection] : []))
      .sort(),
    approvedCollections,
  );
  const inventory = models.map((m) => {
    assert.equal(m.schema.options.autoCreate, false);
    assert.equal(m.schema.options.autoIndex, false);
    const indexes = m.schema.indexes().map(([key, options]) => ({
      name: options.name ?? Object.entries(key).flat().join('_'),
      unique: options.unique === true,
    }));
    return {
      collection: m.collection.collectionName,
      indexNames: ['_id_', ...indexes.map((i) => i.name)],
      uniqueIndexNames: indexes.filter((i) => i.unique).map((i) => i.name),
    };
  });
  const frame = {
    status: 'SCHEMA_VERIFIED',
    inventory,
    transaction: 'READ_ONLY_TRANSACTION_ABORTED_VERIFIED',
  };
  assert.ok(
    Buffer.byteLength(JSON.stringify(frame)) <= 8191,
    'Schema response exceeds existing private pipe limit',
  );
  assert.ok(inventory.reduce((sum, c) => sum + c.indexNames.length, 0) > 21);
  assert.equal(mongoose.connection.readyState, 0);
});
test('setup target action owner and secret contracts refuse protected targets and ambiguous requests', () => {
  assert.doesNotThrow(() => validateSetupRequest(input()));
  for (const bad of [
    { ...input(), target: { ...setupTarget, port: 27017 } },
    { ...input(), target: { ...setupTarget, port: 27018 } },
    { ...input(), target: { ...setupTarget, host: 'localhost' } },
    { ...input(), target: { ...setupTarget, database: 'admin' } },
    { ...input(), ownerSid: 'wrong' },
    { ...input(), action: 'initialize' },
    { ...input(), action: 'schema', existingCompleted: true },
    { ...input(), ownedProcessId: 0 },
    { ...input(), secrets: { ...input().secrets, password: 'private' } },
    { ...input(), extra: true },
  ])
    assert.throws(() => validateSetupRequest(bad));
});
test('setup binding rejects source drift forged owner target authority and non-string hashes', () => {
  const facts = {
    ownerSid: owner,
    normalTransitionHash: bindingHash,
    sources: { powershell: 'B'.repeat(64), helper: 'C'.repeat(64) },
  };
  const record = {
    revision: 1,
    purpose: 'ADDITIVE_SCHEMA_SYNTHETIC_FIXTURES',
    ownerSid: owner,
    normalTransitionHash: bindingHash,
    allowedAction: 'ProvisionLocal',
    sources: { ...facts.sources },
  };
  assert.doesNotThrow(() => assertSetupBinding(record, facts));
  for (const bad of [
    { ...record, ownerSid: [owner, owner] },
    { ...record, allowedAction: 'BootstrapOwnedMongo' },
    { ...record, purpose: ['ADDITIVE_SCHEMA_SYNTHETIC_FIXTURES'] },
    { ...record, normalTransitionHash: '0'.repeat(64) },
    {
      ...record,
      sources: { ...record.sources, helper: ['C'.repeat(64), 'C'.repeat(64)] },
    },
    { ...record, sources: { ...record.sources, powershell: '0'.repeat(64) } },
    { ...record, extra: true },
  ])
    assert.throws(() => assertSetupBinding(bad, facts));
});
test('setup role is bounded to declared development collections and additive operations', () => {
  assert.equal(approvedCollections.length, 21);
  const privileges = setupPrivileges();
  assert.doesNotThrow(() =>
    assertSetupRole({
      role: setupRole,
      db: 'deeplearner-dev',
      roles: [],
      privileges,
      inheritedPrivileges: privileges,
    }),
  );
  for (const p of privileges) {
    assert.equal(p.resource.db, 'deeplearner-dev');
    assert.ok(
      p.actions.every((a) =>
        [
          'find',
          'listCollections',
          'listIndexes',
          'createCollection',
          'createIndex',
          'insert',
        ].includes(a),
      ),
    );
    if (p.actions.includes('insert'))
      assert.ok(
        (seedCollections as readonly string[]).includes(p.resource.collection),
      );
  }
  for (const action of [
    'dropDatabase',
    'dropCollection',
    'dropIndex',
    'update',
    'remove',
    'createUser',
  ]) {
    const bad = structuredClone(privileges);
    bad[1]!.actions.push(action);
    assert.throws(() =>
      assertSetupRole({
        role: setupRole,
        db: 'deeplearner-dev',
        roles: [],
        privileges: bad,
      }),
    );
  }
  assert.throws(() =>
    assertSetupRole({
      role: setupRole,
      db: 'deeplearner-dev',
      roles: [{ role: 'readWrite', db: 'deeplearner-dev' }],
      privileges,
    }),
  );
});
test('additive schema plan preserves unknown indexes and refuses all conflicts before any writes', () => {
  const declared = [
    {
      collection: 'users',
      indexes: [[{ email: 1 }, { unique: true }]] as const,
    },
    {
      collection: 'technologies',
      indexes: [[{ slug: 1 }, { unique: true }]] as const,
    },
  ];
  const actual = [
    {
      collection: 'users',
      indexes: [
        { name: '_id_', key: { _id: 1 } },
        { name: 'email_1', key: { email: 1 }, unique: true },
        { name: 'preserved_extra', key: { createdAt: 1 } },
      ],
    },
  ];
  const snapshot = canonical(actual),
    plan = planAdditiveSchema(declared, actual);
  assert.deepEqual(plan.collections, ['technologies']);
  assert.equal(plan.indexes.length, 1);
  assert.equal(plan.indexes[0]!.collection, 'technologies');
  assert.equal(canonical(actual), snapshot);
  for (const indexes of [
    [{ name: 'email_1', key: { email: 1 }, unique: false }],
    [{ name: 'email_1', key: { another: 1 }, unique: true }],
    [{ name: 'different', key: { email: 1 }, unique: true, sparse: true }],
  ])
    assert.throws(
      () => planAdditiveSchema(declared, [{ collection: 'users', indexes }]),
      /INDEX_CONFLICT/,
    );
  assert.throws(
    () =>
      planAdditiveSchema(declared, [{ collection: 'unexpected', indexes: [] }]),
    /UNEXPECTED_DATABASE_CONTENTS/,
  );
});
const phases = ['role', 'user', 'schema', 'accounts', 'content', 'verify'];
const intent = (phase: string) => ({
  revision: 1,
  phase,
  ownerSid: owner,
  sourceBindingHash: bindingHash,
});
const statuses: Record<string, string> = {
  role: 'SETUP_ROLE_VERIFIED',
  user: 'SETUP_USER_VERIFIED',
  schema: 'SCHEMA_VERIFIED',
  accounts: 'ACCOUNTS_VERIFIED',
  content: 'CONTENT_VERIFIED',
  verify: 'PERSISTENT_SETUP_VERIFIED',
};
const result = (phase: string) => ({
  ...intent(phase),
  result: { status: statuses[phase] },
});
test('phase consumption requires immutable owner/source lineage and never replays interrupted writes', () => {
  const all = () =>
    phases.map((phase) => ({
      phase,
      intent: undefined as unknown,
      result: undefined as unknown,
    }));
  const valid = all();
  valid[0]!.intent = intent('role');
  assert.equal(
    assertSetupPhaseInventory(valid, 'setup-role', false, owner, bindingHash)
      .size,
    0,
  );
  assert.throws(
    () =>
      assertSetupPhaseInventory(valid, 'preflight', false, owner, bindingHash),
    /UNCONFIRMED/,
  );
  assert.throws(() =>
    assertSetupPhaseInventory(all(), 'setup-role', false, owner, bindingHash),
  );
  for (const value of [null, false, [], 1, 'scalar']) {
    const bad = all();
    bad[4]!.intent = value;
    assert.throws(() =>
      assertSetupPhaseInventory(bad, 'preflight', false, owner, bindingHash),
    );
  }
  const partial = all();
  for (const p of partial.slice(0, 4)) {
    p.intent = intent(p.phase);
    p.result = result(p.phase);
  }
  assert.equal(
    assertSetupPhaseInventory(partial, 'preflight', false, owner, bindingHash)
      .size,
    4,
  );
  partial[4]!.intent = intent('content');
  assert.equal(
    assertSetupPhaseInventory(partial, 'content', false, owner, bindingHash)
      .size,
    4,
  );
  assert.throws(() =>
    assertSetupPhaseInventory(partial, 'accounts', false, owner, bindingHash),
  );
  partial[4]!.result = result('content');
  partial[5]!.intent = intent('verify');
  partial[5]!.result = result('verify');
  assert.equal(
    assertSetupPhaseInventory(partial, 'verify', true, owner, bindingHash).size,
    6,
  );
  assert.throws(() =>
    assertSetupPhaseInventory(partial, 'content', true, owner, bindingHash),
  );
  for (const bad of [
    { ...intent('role'), ownerSid: [owner, owner] },
    { ...intent('role'), sourceBindingHash: '0'.repeat(64) },
    { ...intent('role'), phase: 'schema' },
    { ...intent('role'), extra: true },
  ])
    assert.throws(() =>
      assertSetupPhaseRecord(bad, 'role', owner, bindingHash),
    );
  assert.throws(() =>
    assertSetupPhaseRecord(
      { ...result('role'), result: { status: 'UNKNOWN' } },
      'role',
      owner,
      bindingHash,
      true,
    ),
  );
});
test('existing accounts cannot be elevated reset or reused with a mismatched identity or password', () => {
  const expected = demoAccounts[1]!,
    record = { ...expected, status: 'ACTIVE', emailVerifiedAt: new Date() };
  assert.doesNotThrow(() => assertExistingDemoAccount(record, expected, true));
  for (const bad of [
    { ...record, role: 'STUDENT' },
    { ...record, email: 'other@deeplearner.test' },
    { ...record, _id: demoAccounts[0]!._id },
    { ...record, status: 'DISABLED' },
    { ...record, emailVerifiedAt: null },
  ])
    assert.throws(
      () => assertExistingDemoAccount(bad, expected, true),
      /ACCOUNT_CONFLICT/,
    );
  assert.throws(
    () => assertExistingDemoAccount(record, expected, false),
    /ACCOUNT_CONFLICT/,
  );
});
test('synthetic curriculum validates against genuine models without database writes or fabricated progress', async () => {
  const models = {
    Technology,
    LearningPath,
    Module,
    Topic,
    Concept,
    PracticeQuestion,
    Visualization,
  };
  const rows = demoContent();
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map((r) => String(r.data._id))).size, 10);
  for (const row of rows) {
    const Model = models[row.model as keyof typeof models];
    const doc = new Model(row.data);
    await doc.validate();
  }
  const question = rows.find((r) => r.model === 'PracticeQuestion')!
    .data as Record<string, unknown>;
  assert.equal(question.answer, '42');
  assert.equal(40 + 2, 42);
  assert.ok(
    rows.every(
      (r) =>
        !['StudentProgress', 'PracticeAttempt', 'PracticeAssessment'].includes(
          r.model,
        ),
    ),
  );
  assert.equal(mongoose.connection.readyState, 0);
});
test('development accounts use the real Argon2id contract and independent identities', async () => {
  const password = 'Synthetic-test-only-password-9M!';
  const hash = await hashPassword(password);
  assert.ok(hash.startsWith('$argon2id$'));
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password + 'wrong', hash), false);
  for (const a of demoAccounts) {
    await new User({
      ...a,
      passwordHash: hash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      plan: 'FREE',
    }).validate();
  }
  assert.notEqual(String(demoAccounts[0]!._id), String(demoAccounts[1]!._id));
  assert.equal(mongoose.connection.readyState, 0);
});
test('setup has no destructive database or replica bootstrap instructions and disables driver write retries', () => {
  const source = readFileSync(
    new URL('../scripts/dev-persistent-setup.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /dropDatabase\s*\(|dropCollection\s*\(|dropIndex\s*\(|replSetInitiate\s*:/,
  );
  assert.match(source, /retryWrites:\s*false/);
  assert.match(source, /abortTransaction\(/);
  assert.doesNotMatch(source, /withTransaction\(/);
});

test('setup diagnostics retain pending versus acknowledged writes without exposing sensitive errors', () => {
  const privateText =
    'synthetic-password mongodb://private C:\\private-key.pem';
  const before = safeSetupFailure(
    new Error(privateText),
    'SOURCE_BINDING',
    false,
    false,
    false,
    0,
  );
  assert.equal(before.classification, 'REFUSED_OR_READ_FAILED');
  assert.equal(before.gate, 'UNKNOWN');
  assert.equal(before.connectionAttempted, false);
  const pending = safeSetupFailure(
    new Error(privateText),
    'SAVE_ACCOUNT',
    true,
    true,
    true,
    1,
  );
  assert.equal(pending.classification, 'WRITE_ACKNOWLEDGEMENT_UNCERTAIN');
  assert.equal(pending.acknowledgedWrites, 1);
  assert.equal(pending.automaticRetry, false);
  const acknowledged = safeSetupFailure(
    new Error('ACCOUNT_CONFLICT'),
    'ACCOUNTS',
    true,
    true,
    false,
    2,
  );
  assert.equal(acknowledged.classification, 'PARTIAL_ACKNOWLEDGED');
  assert.equal(acknowledged.gate, 'ACCOUNT_CONFLICT');
  for (const row of [before, pending, acknowledged])
    assert.doesNotMatch(
      JSON.stringify(row),
      /synthetic-password|mongodb:\/\/private|private-key/,
    );
  assert.equal(
    safeSetupFailure(
      new Error(privateText),
      privateText,
      false,
      false,
      false,
      -1,
    ).stage,
    'UNKNOWN',
  );
});

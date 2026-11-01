import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import {
  localTarget,
  readRequest,
  validateProfile,
  validateRequest,
  validateSecrets,
  workspacePlan,
  getDevManualMongoPolicy,
  getDevMongoSourcePolicy,
  assertDevManualMongoPolicyAgreement,
} from '../scripts/dev-local.js';

test('manual policy is separate, fixed-target and fails closed for inactive or confused facts', () => {
  const actual = getDevManualMongoPolicy();
  assert.equal(actual.id, 'DEV-PERSISTENT-27019-MANUAL');
  assert.equal(actual.target.runtime, 'owned-process');
  const inactive = { ...actual, status: 'INACTIVE' };
  assert.throws(
    () => assertDevManualMongoPolicyAgreement(inactive, inactive),
    /INACTIVE/,
  );
  assert.doesNotThrow(() =>
    assertDevManualMongoPolicyAgreement(inactive, inactive, false),
  );
  const active = { ...actual, status: 'ACTIVE' };
  assert.doesNotThrow(() =>
    assertDevManualMongoPolicyAgreement(active, active),
  );
  for (const peer of [
    inactive,
    getDevMongoSourcePolicy(),
    { ...active, sourceVersion: 999 },
    { ...active, target: { ...active.target, port: 27017 } },
    { ...active, target: { ...active.target, port: 27018 } },
    { ...active, operations: [...active.operations, 'StartService'] },
    { ...active, activate: true },
  ]) {
    assert.throws(() => assertDevManualMongoPolicyAgreement(active, peer));
  }
});

// Entirely synthetic configuration. Tests never connect, start apps or provision.
const repository = 'E:\\AI\\DeepLearner';
const ownerSid = 'S-1-5-21-111-222-333-1001';
const profile = {
  revision: 1,
  repository,
  ownerSid,
  database: localTarget,
  prerequisites: { instance: 'APPROVED_READY', schema: 'APPROVED_READY' },
};
const uri =
  'mongodb://' +
  encodeURIComponent('fixture-user') +
  ':' +
  encodeURIComponent('synthetic-test-only') +
  '@127.0.0.1:27019/deeplearner-dev?replicaSet=deeplearner-dev-rs&directConnection=true&authSource=deeplearner-dev';
const secrets = {
  mongodbUri: uri,
  signingSecret: Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString(
    'base64',
  ),
};
function manifests() {
  return Object.fromEntries(
    [
      ['root', '../../../package.json'],
      ['web', '../../web/package.json'],
      ['admin', '../../admin/package.json'],
      ['api', '../package.json'],
      ['types', '../../../packages/shared-types/package.json'],
      ['validation', '../../../packages/validation/package.json'],
    ].map(([name, filename]) => [
      name!,
      JSON.parse(readFileSync(new URL(filename!, import.meta.url), 'utf8')),
    ]),
  );
}

test('exact local profile binds owner and repository without granting runtime proof', () => {
  assert.equal(validateProfile(profile, repository, ownerSid).revision, 1);
  assert.throws(() => validateProfile(profile, 'E:\\other', ownerSid));
  assert.throws(() => validateProfile(profile, repository, ownerSid + '2'));
});
test('pending, incomplete, extra-field and altered profiles refuse', () => {
  for (const changed of [
    { ...profile, revision: 2 },
    { ...profile, extraAuthority: true },
    { ...profile, prerequisites: { instance: 'PENDING', schema: 'PENDING' } },
    { ...profile, prerequisites: { instance: 'APPROVED_READY' } },
    { ...profile, database: { ...localTarget, port: 27017 } },
    { ...profile, database: { ...localTarget, port: 27018 } },
    { ...profile, database: { ...localTarget, host: 'localhost' } },
    {
      ...profile,
      database: { ...localTarget, name: 'deeplearner-local-demo' },
    },
    { ...profile, database: { ...localTarget, replicaSet: 'other' } },
  ])
    assert.throws(() => validateProfile(changed, repository, ownerSid));
});
test('scoped loopback URI and independent signing bytes validate', () => {
  assert.deepEqual(validateSecrets(secrets), secrets);
});
test('protected targets, normalization tricks and credential-free URIs refuse', () => {
  for (const altered of [
    uri.replace('27019', '27017'),
    uri.replace('27019', '27018'),
    uri.replace('127.0.0.1', 'localhost'),
    uri.replace('127.0.0.1', '2130706433'),
    uri.replace('mongodb:', 'mongodb+srv:'),
    uri.replace('/deeplearner-dev?', '/other?'),
    uri.replace('deeplearner-dev-rs', 'other'),
    uri.replace(/\/\/.*@/, '//'),
    uri.replace('127.0.0.1:27019', '127.0.0.1:27019,foreign.invalid:27019'),
    uri + '#fragment',
    uri + '&tls=false',
    uri + '&authSource=admin',
    uri.replace('directConnection=true', 'directConnection=false'),
    uri.replace('authSource=deeplearner-dev', 'authSource=admin'),
    uri.replace('authSource=deeplearner-dev', 'replicaSet=deeplearner-dev-rs'),
  ])
    assert.throws(() => validateSecrets({ ...secrets, mongodbUri: altered }));
});
test('weak, malformed and oversized signing configuration refuses without values', () => {
  for (const signingSecret of [
    '',
    'plain text',
    'A'.repeat(44),
    'x'.repeat(500),
  ])
    assert.throws(
      () => validateSecrets({ ...secrets, signingSecret }),
      /^Error: DEV_CONFIGURATION_REJECTED$/,
    );
  assert.throws(() => validateSecrets({ ...secrets, logSecrets: true }));
});
test('workspace plan retains scripts, fixed ports, loopback flags and API watch', () => {
  const plan = workspacePlan(manifests());
  assert.deepEqual(
    plan.services.map((s) => s.port),
    [4000, 3000, 5173],
  );
  assert.equal(plan.services[0]!.args[1], 'dev:local');
  assert.deepEqual(plan.services[1]!.args.slice(-2), [
    '--hostname',
    '127.0.0.1',
  ]);
  assert.deepEqual(plan.services[2]!.args.slice(-2), ['--host', '127.0.0.1']);
  assert.equal(plan.watchers.length, 2);
  assert.ok(!JSON.stringify(plan).includes('concurrently'));
});
test('drifted env-loading, bind and build commands refuse before execution', () => {
  for (const [name, key, command] of [
    [
      'api',
      'dev:local',
      'node --env-file=.env --watch --import tsx src/server.ts',
    ],
    ['web', 'dev', 'next dev --port 3001'],
    ['admin', 'dev', 'vite --host 0.0.0.0'],
    ['root', 'build:packages', 'unapproved-command'],
    ['types', 'dev', 'unapproved-watch-command'],
  ]) {
    const input = manifests();
    input[name!]!.scripts[key!] = command;
    assert.throws(() => workspacePlan(input));
  }
});
test('private validator returns public plan with no credential or owner disclosure', () => {
  const result = validateRequest({
    profile,
    repository,
    ownerSid,
    secrets,
    manifests: manifests(),
  });
  const output = JSON.stringify(result);
  for (const privateValue of [uri, secrets.signingSecret, ownerSid])
    assert.ok(!output.includes(privateValue));
  assert.throws(() => validateRequest({ profile }));
});
test('bounded strict UTF-8 input supports chunk boundaries and rejects invalid frames', async () => {
  const input = Buffer.from(JSON.stringify({ value: 'naïve' }));
  assert.deepEqual(
    await readRequest(Readable.from([...input].map((b) => Buffer.from([b])))),
    { value: 'naïve' },
  );
  for (const invalid of ['', '{}\n{}', '{', ' '.repeat(16385)])
    await assert.rejects(readRequest(Readable.from([invalid])));
  await assert.rejects(readRequest(Readable.from([Buffer.from([0xff])])));
});

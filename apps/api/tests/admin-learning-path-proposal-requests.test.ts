import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  proposalCaptureInput,
  proposalCaptureRequest,
  proposalDetailRequest,
  proposalRecoveryRequest,
  proposalResponseDto,
  proposalRecoveryResponse,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal-request.schema.js';
import { assertProposalByteLimit } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';
import { proposalApiPreparedCases } from './admin-learning-path-proposal-api.integration.js';

const technologyId = 'c'.repeat(24),
  id = 'd'.repeat(24),
  sourceId = 'e'.repeat(24);
const operationId = '12345678-1234-4123-8123-123456789abc';
function input() {
  return {
    technologyId,
    operationId,
    title: 'Private curriculum',
    objectives: ['Understand values'],
    audience: 'New developers',
    depth: 'BEGINNER',
    runtime: null,
    technologyVersion: null,
    prerequisites: [],
  };
}
function dto() {
  const { operationId: _ignored, ...content } = input();
  void _ignored;
  return {
    ...content,
    id,
    proposalId: sourceId,
    revision: 1,
    schemaVersion: 1,
    source: { id: sourceId, revision: 1 },
    createdAt: '2026-11-04T00:00:00.000Z',
  };
}

test('nine explicit capture fields reuse C1 without defaults/normalization', () => {
  assert.deepEqual(proposalCaptureInput.parse(input()), input());
  assert.equal(Object.keys(input()).length, 9);
  for (const key of Object.keys(input())) {
    const partial: Record<string, unknown> = { ...input() };
    delete partial[key];
    assert.equal(proposalCaptureInput.safeParse(partial).success, false);
  }
  assert(
    proposalCaptureRequest.safeParse({ params: {}, query: {}, body: input() })
      .success,
  );
});
for (const field of [
  'createdBy',
  'actor',
  'role',
  'status',
  'source',
  'revision',
  'definitionDigest',
  'createdAt',
  'predecessor',
  '$set',
  '__proto__',
])
  test(`strict input rejects forbidden key ${field}`, () => {
    const raw = JSON.parse(
      JSON.stringify(input()).slice(0, -1) + `,"${field}":"SYNTHETIC_PRIVATE"}`,
    ) as unknown;
    assert.equal(proposalCaptureInput.safeParse(raw).success, false);
  });
for (const value of [
  'C'.repeat(24),
  technologyId + '\n',
  '',
  null,
  1,
  [technologyId],
  { $eq: technologyId },
])
  test(`canonical parent refuses ${JSON.stringify(value)}`, () => {
    assert.equal(
      proposalCaptureInput.safeParse({ ...input(), technologyId: value })
        .success,
      false,
    );
  });
for (const value of [
  operationId.toUpperCase(),
  operationId + '\n',
  operationId.replace('-4123-', '-5123-'),
  operationId.replace('-8123-', '-7123-'),
  null,
  [],
])
  test(`canonical UUID refuses ${JSON.stringify(value)}`, () => {
    assert.equal(
      proposalCaptureInput.safeParse({ ...input(), operationId: value })
        .success,
      false,
    );
  });
test('exact text/array/null boundaries and duplicate semantics', () => {
  const maximum = {
    ...input(),
    title: 'x'.repeat(120),
    objectives: Array.from({ length: 20 }, (_, i) =>
      String(i).padEnd(240, 'x'),
    ),
    audience: 'x'.repeat(500),
    runtime: { name: 'x'.repeat(80), version: 'y'.repeat(80) },
    technologyVersion: 'z'.repeat(80),
    prerequisites: Array.from({ length: 20 }, (_, i) => ({
      description: String(i).padEnd(240, 'x'),
    })),
  };
  assert(proposalCaptureInput.safeParse(maximum).success);
  for (const change of [
    { title: '' },
    { title: 'x'.repeat(121) },
    { objectives: [] },
    { objectives: ['a', 'a'] },
    { objectives: Array.from({ length: 21 }, (_, i) => String(i)) },
    { objectives: ['x'.repeat(241)] },
    { audience: 'x'.repeat(501) },
    { depth: 'EXPERT' },
    { runtime: {} },
    { runtime: { name: 'node', version: '' } },
    { runtime: { name: 'x'.repeat(81), version: null } },
    { runtime: { name: 'node', version: null, secret: 'PRIVATE' } },
    { technologyVersion: '' },
    { prerequisites: [{ description: 'a' }, { description: 'a' }] },
    { prerequisites: [{ description: 'x'.repeat(241) }] },
    {
      prerequisites: Array.from({ length: 21 }, (_, i) => ({
        description: String(i),
      })),
    },
  ])
    assert.equal(
      proposalCaptureInput.safeParse({ ...input(), ...change }).success,
      false,
    );
  assert(
    proposalCaptureInput.safeParse({
      ...input(),
      objectives: ['a', 'A', 'é', 'e\u0301'],
    }).success,
  );
});
for (const value of [
  ' padded',
  'padded ',
  'a\nb',
  'a\u0000b',
  'a\u007fb',
  'a\u0085b',
  'a\u2028b',
  'a\u2029b',
  '\ud800',
  '\udfff',
])
  test(
    'text is single-line well-formed without silent normalization ' +
      JSON.stringify(value),
    () => {
      assert.equal(
        proposalCaptureInput.safeParse({ ...input(), title: value }).success,
        false,
      );
    },
  );
test('UTF-8 canonical byte limit is inclusive and independent of character count', () => {
  assert.doesNotThrow(() => assertProposalByteLimit('é'.repeat(32768)));
  assert.throws(() => assertProposalByteLimit('é'.repeat(32768) + 'a'));
});
test('strict query/params prevent parent omission, repetition and operators', () => {
  for (const query of [
    {},
    { technologyId: [technologyId, technologyId] },
    { technologyId, extra: 'x' },
    { technologyId: { $eq: technologyId } },
    { technologyId: technologyId.toUpperCase() },
  ]) {
    assert.equal(
      proposalDetailRequest.safeParse({ params: { id }, query }).success,
      false,
    );
    assert.equal(
      proposalRecoveryRequest.safeParse({ params: { operationId }, query })
        .success,
      false,
    );
  }
  assert(
    proposalDetailRequest.safeParse({ params: { id }, query: { technologyId } })
      .success,
  );
  assert(
    proposalRecoveryRequest.safeParse({
      params: { operationId },
      query: { technologyId },
    }).success,
  );
  for (const body of [null, [], { extra: 1 }])
    assert.equal(
      proposalDetailRequest.safeParse({
        params: { id },
        query: { technologyId },
        body,
      }).success,
      false,
    );
  assert.equal(
    proposalCaptureRequest.safeParse({
      params: {},
      query: { technologyId },
      body: input(),
    }).success,
    false,
  );
});
test('strict public DTO rejects private fields before any schema projection', () => {
  assert(proposalResponseDto.safeParse(dto()).success);
  for (const field of [
    'createdBy',
    'operationId',
    '__v',
    '_id',
    'contentDigest',
    'definitionDigest',
    'stack',
    'details',
  ])
    assert.equal(
      proposalResponseDto.safeParse({ ...dto(), [field]: 'SYNTHETIC_PRIVATE' })
        .success,
      false,
    );
  assert.equal(
    proposalResponseDto.safeParse({
      ...dto(),
      source: { id: sourceId, revision: 1, digest: 'f'.repeat(64) },
    }).success,
    false,
  );
  assert.equal(
    proposalResponseDto.safeParse({ ...dto(), createdAt: '2026-11-04' })
      .success,
    false,
  );
  assert.equal(
    proposalRecoveryResponse.safeParse({ state: 'UNRESOLVED', proposal: dto() })
      .success,
    false,
  );
  assert.equal(
    proposalRecoveryResponse.safeParse({ state: 'FAILED' }).success,
    false,
  );
  assert(
    proposalRecoveryResponse.safeParse({ state: 'COMMITTED', proposal: dto() })
      .success,
  );
  assert(proposalRecoveryResponse.safeParse({ state: 'UNRESOLVED' }).success);
});
test('prepared API assertions are a separate frozen set; importing runs nothing live', () => {
  assert.equal(proposalApiPreparedCases.length, 6);
  assert.equal(new Set(proposalApiPreparedCases).size, 6);
  assert(Object.isFrozen(proposalApiPreparedCases));
  assert(
    !proposalApiPreparedCases.includes(
      'T01' as (typeof proposalApiPreparedCases)[number],
    ),
  );
});

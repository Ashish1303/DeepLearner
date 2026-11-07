import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import childProcess from 'node:child_process';
import mongoose from 'mongoose';
import { curriculumBriefDigest } from '../src/modules/admin/learning-paths/admin-curriculum-brief.schema.js';
import { proposalDefinitionDigest } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';
import {
  ledgerIntentFingerprint,
  ledgerRequestDigest,
} from '../src/modules/ai/ai-usage-ledger.schema.js';

type Schema =
  typeof import('../src/modules/ai/curriculum-outline-candidate.schema.js');
let schema: Schema;
let propose: typeof import('../src/modules/ai/curriculum-outline-admission.policy.js').proposeOutlineAdmission;
let dto: typeof import('../src/modules/ai/curriculum-outline-candidate.dto.js').outlineCandidateDto;
const effects: string[] = [];
try {
  const forbidden = () => {
    effects.push('UNEXPECTED_EFFECT');
    throw new Error('SYNTHETIC_PRIVATE_CANARY');
  };
  mock.method(net, 'connect', forbidden);
  mock.method(net, 'createConnection', forbidden);
  mock.method(net.Socket.prototype, 'connect', forbidden);
  mock.method(net.Server.prototype, 'listen', forbidden);
  mock.method(tls, 'connect', forbidden);
  mock.method(http, 'request', forbidden);
  mock.method(https, 'request', forbidden);
  mock.method(globalThis, 'fetch', forbidden);
  for (const method of ['spawn', 'exec', 'execFile', 'fork'] as const)
    mock.method(childProcess, method, forbidden);
  mock.method(mongoose, 'connect', forbidden);
  mock.method(mongoose, 'createConnection', forbidden);
  mock.method(mongoose, 'model', forbidden);
  syncBuiltinESMExports();
  schema =
    await import('../src/modules/ai/curriculum-outline-candidate.schema.js');
  propose = (
    await import('../src/modules/ai/curriculum-outline-admission.policy.js')
  ).proposeOutlineAdmission;
  dto = (await import('../src/modules/ai/curriculum-outline-candidate.dto.js'))
    .outlineCandidateDto;
  assert.deepEqual(effects, []);
} finally {
  mock.restoreAll();
  syncBuiltinESMExports();
}

const id = (n: number) => String(n).repeat(24);
const uuid = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const hash = (v: string) =>
  createHash('sha256').update(v, 'utf8').digest('hex');

/** All fixtures are SYNTHETIC / NOT_SAVED / NOT_AI_GENERATED, never authority. */
function fixture(rich = false) {
  const content = {
    title: 'Synthetic brief',
    objectives: ['Learn synthetic policy'],
    audience: 'Synthetic audience',
    depth: 'BEGINNER' as const,
    runtime: rich ? { name: 'Node.js', version: '24' } : null,
    technologyVersion: rich ? 'ES2022' : null,
    prerequisites: rich
      ? [{ description: 'Understand synthetic variables' }]
      : [],
  };
  const briefDefinition = {
    _id: id(1),
    technologyId: id(2),
    schemaVersion: 1 as const,
    revision: 1 as const,
    ...content,
    createdBy: id(3),
    createdAt: new Date('2026-11-07T00:00:00.000Z'),
    operationId: uuid(1),
  };
  const brief = {
    ...briefDefinition,
    contentDigest: curriculumBriefDigest(briefDefinition),
  };
  const proposalDefinition = {
    _id: id(4),
    proposalId: id(1),
    technologyId: id(2),
    revision: 1,
    schemaVersion: 1 as const,
    source: { id: brief._id, revision: 1, digest: brief.contentDigest },
    ...content,
    createdAt: new Date('2026-11-07T00:00:00.000Z'),
  };
  const proposal = {
    ...proposalDefinition,
    definitionDigest: proposalDefinitionDigest(proposalDefinition),
  };
  const body = {
    title: 'Synthetic outline',
    modules: [
      {
        title: 'Module 0',
        objectives: ['Learn synthetic policy'],
        topics: [{ title: 'Topic 0', concepts: [{ title: 'Concept 0' }] }],
      },
    ],
  };
  const rawOutput = JSON.stringify(body);
  const intent = {
    schemaVersion: 1 as const,
    technologyId: id(2),
    brief: { id: brief._id, revision: 1 as const, digest: brief.contentDigest },
    proposal: {
      id: proposal._id,
      proposalId: proposal.proposalId,
      revision: 1 as const,
      digest: proposal.definitionDigest,
    },
    operationId: uuid(2),
  };
  const inputJson = JSON.stringify(content),
    instructions = 'Synthetic approved template';
  const command = {
    operationId: intent.operationId,
    technologyId: intent.technologyId,
    source: intent.brief,
    instructions,
    inputJson,
    requestBounds: {
      instructionBytes: Buffer.byteLength(instructions),
      inputJsonBytes: Buffer.byteLength(inputJson),
      maxOutputBytes: 65_536,
      maxOutputTokens: 4096,
      budgetMs: 10_000,
    },
  };
  const context = {
    actorId: id(3),
    intent,
    command,
    ledgerOperationId: id(9),
    attemptId: id(8),
    outlineRevisionId: id(6),
    outlineId: id(7),
    claimId: uuid(3),
    ownerId: uuid(4),
    templateVersion: uuid(5),
    completionDigest: '',
    createdAt: new Date('2026-11-07T00:00:01.000Z'),
    completedAt: new Date('2026-11-07T00:00:00.500Z'),
    currentAdmin: true,
    sourceAdmitted: true,
    producerVerified: true,
    attemptUnused: true,
    technologyStatus: 'DRAFT',
  };
  const completion = {
    attemptId: context.attemptId,
    ledgerOperationId: context.ledgerOperationId,
    operationId: intent.operationId,
    claimId: context.claimId,
    ownerId: context.ownerId,
    intentDigest: schema.outlineIntentDigest({
      actorId: context.actorId,
      intent,
      ledgerIntentFingerprint: ledgerIntentFingerprint({
        actorId: context.actorId,
        command,
      }),
      templateVersion: context.templateVersion,
    }),
    requestDigest: ledgerRequestDigest({ instructions, inputJson }),
    rawOutputDigest: schema.outlineRawOutputDigest(rawOutput),
    templateVersion: context.templateVersion,
    completedAt: context.completedAt,
  };
  const producer = {
    ...completion,
    completionDigest: schema.outlineCompletionDigest(
      completion,
      context.actorId,
    ),
  };
  context.completionDigest = producer.completionDigest;
  const outline = {
    schemaVersion: 1 as const,
    technologyId: brief.technologyId,
    source: intent.brief,
    ...body,
  };
  const definition = {
    _id: context.outlineRevisionId,
    outlineId: context.outlineId,
    schemaVersion: 1 as const,
    revision: 1 as const,
    origin: 'AI_GENERATED' as const,
    outline,
    proposal: intent.proposal,
    createdBy: context.actorId,
    createdAt: context.createdAt,
    producer,
    contentDigest: schema.outlineContentDigest(outline),
  };
  const candidate = {
    ...definition,
    definitionDigest: schema.outlineDefinitionDigest(definition),
  };
  return { candidate, rawOutput, brief, proposal, context };
}
type Fixture = ReturnType<typeof fixture>;
function rehash(r: Fixture) {
  const p = r.candidate.producer;
  const { completionDigest: _old, ...completion } = p;
  void _old;
  p.completionDigest = schema.outlineCompletionDigest(
    completion,
    r.candidate.createdBy,
  );
  r.candidate.contentDigest = schema.outlineContentDigest(r.candidate.outline);
  const { definitionDigest: _definition, ...definition } = r.candidate;
  void _definition;
  r.candidate.definitionDigest = schema.outlineDefinitionDigest(definition);
}
function refuse(input: unknown, code?: string) {
  const result = propose(input);
  assert.equal(result.kind, 'REFUSED');
  if (result.kind !== 'REFUSED') throw new Error('Expected refusal');
  assert.deepEqual(Object.keys(result), ['kind', 'code', 'message']);
  assert.equal(result.message, 'Curriculum outline admission is unavailable');
  assert(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_CANARY'));
  if (code) assert.equal(result.code, code);
  assert(Object.isFrozen(result));
}
function frozen(v: unknown): void {
  if (!v || typeof v !== 'object') return;
  assert(Object.isFrozen(v));
  for (const child of Object.values(v)) frozen(child);
}

test('imports are inert at observed network/process/model boundaries', () =>
  assert.deepEqual(effects, []));
test('synthetic proposal is deterministic, fresh, immutable and not admission authority', () => {
  const r = fixture(),
    before = structuredClone(r);
  const a = propose(r),
    b = propose(r);
  assert.equal(a.kind, 'ADMISSION_PROPOSED');
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
  assert.deepEqual(r, before);
  frozen(a);
  if (a.kind !== 'ADMISSION_PROPOSED') throw new Error('Expected proposal');
  assert.equal(a.candidate.createdAt, '2026-11-07T00:00:01.000Z');
  r.candidate.createdAt.setTime(0);
  r.candidate.outline.modules[0]!.title = 'Changed input';
  assert.equal(a.candidate.createdAt, '2026-11-07T00:00:01.000Z');
  assert.equal(a.candidate.outline.modules[0]!.title, 'Module 0');
  assert(!('admitted' in a) && !('dispatchAllowed' in a));
});
test('both eligible parent states work; archived/missing parents refuse', () => {
  for (const status of ['DRAFT', 'PUBLISHED']) {
    const r = fixture();
    r.context.technologyStatus = status;
    assert.equal(propose(r).kind, 'ADMISSION_PROPOSED');
  }
  for (const status of ['ARCHIVED', null]) {
    const r = fixture();
    Object.assign(r.context, { technologyStatus: status });
    refuse(r, 'TECHNOLOGY_INELIGIBLE');
  }
});
for (const [key, code] of [
  ['currentAdmin', 'AUTHORITY_UNAVAILABLE'],
  ['sourceAdmitted', 'AUTHORITY_UNAVAILABLE'],
  ['producerVerified', 'PRODUCER_UNVERIFIED'],
  ['attemptUnused', 'OPERATION_CONFLICT'],
] as const) {
  for (const value of [false, null, undefined, 'UNKNOWN'])
    test(`${key}=${String(value)} refuses`, () => {
      const r = fixture();
      Object.assign(r.context, { [key]: value });
      refuse(
        r,
        typeof value === 'boolean' || value === null ? code : 'INVALID_INPUT',
      );
    });
}
for (const key of [
  'actorId',
  'ledgerOperationId',
  'attemptId',
  'outlineRevisionId',
  'outlineId',
  'claimId',
  'ownerId',
  'templateVersion',
  'completionDigest',
  'createdAt',
  'completedAt',
] as const) {
  test(`binds independent expected ${key}`, () => {
    const r = fixture();
    const value = key.endsWith('At')
      ? new Date('2026-11-07T00:00:00.000Z')
      : key === 'completionDigest'
        ? 'a'.repeat(64)
        : ['claimId', 'ownerId', 'templateVersion'].includes(key)
          ? uuid(6)
          : id(5);
    Object.assign(r.context, { [key]: value });
    refuse(r, 'OPERATION_CONFLICT');
  });
}
for (const field of ['id', 'revision', 'digest'] as const)
  test(`binds intent brief ${field}`, () => {
    const r = fixture();
    Object.assign(r.context.intent.brief, {
      [field]:
        field === 'revision' ? 2 : field === 'digest' ? 'a'.repeat(64) : id(5),
    });
    refuse(r);
  });
for (const field of ['id', 'proposalId', 'revision', 'digest'] as const)
  test(`binds intent proposal ${field}`, () => {
    const r = fixture();
    Object.assign(r.context.intent.proposal, {
      [field]:
        field === 'revision' ? 2 : field === 'digest' ? 'a'.repeat(64) : id(5),
    });
    refuse(r);
  });
test('refuses mismatched request Technology/source/operation and old Save operation', () => {
  for (const change of [
    (r: Fixture) => {
      r.context.command.technologyId = id(5);
    },
    (r: Fixture) => {
      r.context.command.source = { ...r.context.command.source, id: id(5) };
    },
    (r: Fixture) => {
      r.context.command.operationId = uuid(6);
    },
    (r: Fixture) => {
      r.context.intent.operationId = r.brief.operationId;
      r.context.command.operationId = r.brief.operationId;
    },
  ]) {
    const r = fixture();
    change(r);
    refuse(r);
  }
});
test('refuses changed request text/bounds and non-minimized request payload', () => {
  const r = fixture();
  r.context.command.instructions = 'Different template';
  r.context.command.requestBounds.instructionBytes = Buffer.byteLength(
    r.context.command.instructions,
  );
  refuse(r, 'OPERATION_CONFLICT');
  const b = fixture();
  b.context.command.requestBounds.budgetMs = 9999;
  refuse(b, 'OPERATION_CONFLICT');
  const p = fixture();
  p.context.command.inputJson = JSON.stringify({
    ...JSON.parse(p.context.command.inputJson),
    actorId: id(3),
  });
  p.context.command.requestBounds.inputJsonBytes = Buffer.byteLength(
    p.context.command.inputJson,
  );
  refuse(p, 'SOURCE_MISMATCH');
});
test('valid but unrelated candidate/source/proposal/actor tuples cannot pass', () => {
  for (const change of [
    (r: Fixture) => {
      r.candidate.outline.technologyId = id(5);
    },
    (r: Fixture) => {
      r.candidate.outline.source = { ...r.candidate.outline.source, id: id(5) };
    },
    (r: Fixture) => {
      r.candidate.proposal = {
        ...r.candidate.proposal,
        digest: 'a'.repeat(64),
      };
    },
    (r: Fixture) => {
      r.candidate.createdBy = id(5);
    },
  ]) {
    const r = fixture();
    change(r);
    rehash(r);
    refuse(r);
  }
});
test('malformed or mismatched supplied F044 records are content-free refusals', () => {
  const b = fixture();
  b.brief.contentDigest = 'a'.repeat(64);
  refuse(b, 'INVALID_INPUT');
  const p = fixture();
  p.proposal.technologyId = id(5);
  const { definitionDigest: _old, ...definition } = p.proposal;
  void _old;
  p.proposal.definitionDigest = proposalDefinitionDigest(definition);
  refuse(p, 'SOURCE_MISMATCH');
  const successor = fixture();
  successor.proposal.revision = 2;
  const { definitionDigest: _d, ...next } = successor.proposal;
  void _d;
  successor.proposal.definitionDigest = proposalDefinitionDigest(next);
  refuse(successor, 'SOURCE_MISMATCH');
});
test('byte changes conflict despite equal content; output hashes cannot bind unrelated content', () => {
  const whitespace = fixture();
  whitespace.rawOutput += ' ';
  refuse(whitespace, 'OUTPUT_INVALID');
  const changed = fixture();
  changed.rawOutput += ' ';
  changed.candidate.producer.rawOutputDigest = schema.outlineRawOutputDigest(
    changed.rawOutput,
  );
  rehash(changed);
  refuse(changed, 'OPERATION_CONFLICT'); // First expected completion is immutable.
  const other = fixture();
  const body = JSON.parse(other.rawOutput);
  body.title = 'Other valid outline';
  other.rawOutput = JSON.stringify(body);
  other.candidate.producer.rawOutputDigest = schema.outlineRawOutputDigest(
    other.rawOutput,
  );
  rehash(other);
  other.context.completionDigest = other.candidate.producer.completionDigest;
  refuse(other, 'OUTPUT_INVALID');
});
for (const raw of [
  'null',
  '[]',
  '{',
  '{}',
  '{"title":"x","modules":[],"technologyId":"private"}',
])
  test(`strict producer protocol rejects ${raw}`, () => {
    const r = fixture();
    r.rawOutput = raw;
    r.candidate.producer.rawOutputDigest = schema.outlineRawOutputDigest(raw);
    rehash(r);
    r.context.completionDigest = r.candidate.producer.completionDigest;
    refuse(r, 'OUTPUT_INVALID');
  });
test('output is bounded by the exact request as well as O0; neither ceiling is enlarged', () => {
  const r = fixture();
  r.rawOutput += ' '.repeat(65_536 - Buffer.byteLength(r.rawOutput));
  r.candidate.producer.rawOutputDigest = schema.outlineRawOutputDigest(
    r.rawOutput,
  );
  rehash(r);
  r.context.completionDigest = r.candidate.producer.completionDigest;
  assert.equal(propose(r).kind, 'ADMISSION_PROPOSED');
  refuse({ ...r, rawOutput: r.rawOutput + ' ' });
  const b = fixture();
  b.context.command.requestBounds.maxOutputBytes =
    Buffer.byteLength(b.rawOutput) - 1;
  b.candidate.producer.intentDigest = schema.outlineIntentDigest({
    actorId: b.context.actorId,
    intent: b.context.intent,
    ledgerIntentFingerprint: ledgerIntentFingerprint({
      actorId: b.context.actorId,
      command: b.context.command,
    }),
    templateVersion: b.context.templateVersion,
  });
  rehash(b);
  b.context.completionDigest = b.candidate.producer.completionDigest;
  refuse(b, 'OUTPUT_INVALID');
});
test('unknown/operator fields at every boundary refuse, never silently omit', () => {
  for (const locate of [
    (r: Fixture) => r,
    (r: Fixture) => r.context,
    (r: Fixture) => r.candidate,
    (r: Fixture) => r.candidate.producer,
    (r: Fixture) => r.candidate.proposal,
    (r: Fixture) => r.candidate.outline,
    (r: Fixture) => r.candidate.outline.modules[0]!,
    (r: Fixture) => r.context.intent,
    (r: Fixture) => r.context.command,
  ]) {
    for (const key of ['$set', '__proto__', 'SYNTHETIC_PRIVATE_CANARY']) {
      const r = fixture();
      Object.defineProperty(locate(r), key, {
        value: 'SYNTHETIC_PRIVATE_CANARY',
        enumerable: true,
      });
      refuse(r);
    }
  }
});
test('accessors, proxies, inherited fields, symbols and cycles are refused without observation', () => {
  let reads = 0;
  for (const locate of [
    (r: Fixture) => r,
    (r: Fixture) => r.context,
    (r: Fixture) => r.candidate,
    (r: Fixture) => r.candidate.producer,
    (r: Fixture) => r.candidate.outline.modules[0]!,
  ]) {
    const r = fixture(),
      target = locate(r);
    const key = Object.keys(target)[0]!;
    Object.defineProperty(target, key, {
      get() {
        reads++;
        throw new Error('SYNTHETIC_PRIVATE_CANARY');
      },
      enumerable: true,
    });
    refuse(r);
  }
  const r = fixture();
  refuse(
    new Proxy(r, {
      ownKeys() {
        reads++;
        throw new Error('private');
      },
      get() {
        reads++;
        throw new Error('private');
      },
    }),
  );
  const nested = fixture();
  Object.assign(nested.candidate.outline, {
    modules: new Proxy([], {
      get() {
        reads++;
        throw new Error('private');
      },
    }),
  });
  refuse(nested);
  const inherited = Object.create(fixture());
  refuse(inherited);
  const symbol = fixture();
  Object.defineProperty(symbol, Symbol('private'), { value: 1 });
  refuse(symbol);
  const cycle = fixture();
  Object.assign(cycle.candidate.outline, {
    modules: [cycle.candidate.outline],
  });
  refuse(cycle);
  assert.equal(reads, 0);
});
test('wrong types, coercible identities, noncanonical timestamps and digest corruption refuse', () => {
  for (const value of [null, undefined, [], {}, true, 1, 'x'])
    refuse(value, 'INVALID_INPUT');
  for (const value of [
    id(6).toUpperCase() + 'A',
    [id(6)],
    { toString: () => id(6) },
    null,
    id(6) + '\n',
  ]) {
    const r = fixture();
    Object.assign(r.candidate, { _id: value });
    refuse(r);
  }
  for (const value of [
    new Date(NaN),
    '2026-11-07',
    '2026-11-07T00:00:01Z',
    1,
    null,
  ]) {
    const r = fixture();
    Object.assign(r.candidate, { createdAt: value });
    refuse(r);
  }
  for (const field of ['contentDigest', 'definitionDigest']) {
    const r = fixture();
    Object.assign(r.candidate, { [field]: 'a'.repeat(64) });
    refuse(r);
  }
  const completed = fixture();
  completed.candidate.producer.completedAt = new Date(
    '2026-11-07T00:00:02.000Z',
  );
  refuse(completed);
  const family = fixture();
  family.candidate.outlineId = family.candidate._id;
  refuse(family);
});
test('property order does not change canonical candidate bytes or digest validation', () => {
  const r = fixture();
  function reverse(v: unknown): unknown {
    if (!v || typeof v !== 'object' || v instanceof Date) return v;
    if (Array.isArray(v)) return v.map(reverse);
    return Object.fromEntries(
      Object.entries(v)
        .reverse()
        .map(([k, value]) => [k, reverse(value)]),
    );
  }
  assert.deepEqual(
    schema.validateOutlineCandidate(reverse(r.candidate)),
    schema.validateOutlineCandidate(r.candidate),
  );
  assert.deepEqual(
    propose({ ...r, candidate: reverse(r.candidate) }),
    propose(r),
  );
});
test('text and array order change semantic digests; raw whitespace is only raw/completion-sensitive', () => {
  const r = fixture(),
    o = structuredClone(r.candidate.outline);
  o.modules.push({ ...structuredClone(o.modules[0]!), title: 'Module 1' });
  const before = schema.outlineContentDigest(o);
  o.modules.reverse();
  assert.notEqual(schema.outlineContentDigest(o), before);
  o.title += '!';
  assert.notEqual(
    schema.outlineContentDigest(o),
    schema.outlineContentDigest(r.candidate.outline),
  );
  assert.notEqual(
    schema.outlineRawOutputDigest(r.rawOutput),
    schema.outlineRawOutputDigest(r.rawOutput + ' '),
  );
  assert.equal(
    schema.outlineContentDigest(
      JSON.parse(JSON.stringify(r.candidate.outline)),
    ),
    r.candidate.contentDigest,
  );
});
test('candidate byte helper has exact UTF-8 boundaries, independently of stronger O0 bounds', () => {
  const exact = '界'.repeat(43_690) + 'xx';
  assert.equal(Buffer.byteLength(exact), 131_072);
  schema.assertOutlineCandidateByteLimit(exact);
  assert.throws(() => schema.assertOutlineCandidateByteLimit(exact + 'x'), {
    message: 'Invalid curriculum outline candidate',
  });
  assert.throws(() => schema.assertOutlineCandidateByteLimit('\ud800'));
  const row = fixture().candidate;
  row.outline.title = 'x'.repeat(121);
  assert.throws(() => schema.validateOutlineCandidate(row));
  // A valid O0 envelope plus bounded fixed metadata cannot reach 128 KiB. This
  // helper test does not fabricate a valid candidate at that unreachable size.
});
test('private DTO is a fresh frozen allowlist with ISO timestamps, no producer/actor/operation internals', () => {
  const r = fixture(),
    result = dto(r.candidate);
  frozen(result);
  assert.deepEqual(Object.keys(result), [
    'id',
    'outlineId',
    'revision',
    'origin',
    'outline',
    'contentDigest',
    'definitionDigest',
    'createdAt',
  ]);
  for (const privateKey of [
    'createdBy',
    'producer',
    'operationId',
    'claimId',
    'ownerId',
    'proposal',
    'rawOutput',
    'requestDigest',
  ])
    assert(!(privateKey in result));
  assert.equal(result.createdAt, '2026-11-07T00:00:01.000Z');
  assert.notEqual(result.outline, r.candidate.outline);
  assert.throws(
    () => dto({ ...r.candidate, prompt: 'SYNTHETIC_PRIVATE_CANARY' }),
    { message: 'Invalid curriculum outline candidate' },
  );
});
test('hash helpers sanitize unsafe inputs and never return validation details', () => {
  for (const invoke of [
    () => schema.outlineContentDigest({ title: 'SYNTHETIC_PRIVATE_CANARY' }),
    () => schema.outlineIntentDigest({}),
    () => schema.outlineCompletionDigest({}, id(3)),
    () => schema.outlineDefinitionDigest({}),
    () => schema.validateOutlineCandidate({}),
  ])
    assert.throws(invoke, { message: 'Invalid curriculum outline candidate' });
});
test('evaluation has no hidden clock, allocation, model, network or process dependency', () => {
  const r = fixture();
  try {
    const forbidden = () => {
      throw new Error('UNEXPECTED_EFFECT');
    };
    mock.method(Date, 'now', forbidden);
    mock.method(globalThis, 'fetch', forbidden);
    mock.method(mongoose, 'model', forbidden);
    mock.method(childProcess, 'spawn', forbidden);
    assert.equal(propose(r).kind, 'ADMISSION_PROPOSED');
  } finally {
    mock.restoreAll();
  }
});

test('independent domain-separated canonical frame vectors', () => {
  // Independently specified frames, not generated by the production frame helper.
  const o = {
    schemaVersion: 1,
    technologyId: id(2),
    source: { id: id(1), revision: 1, digest: 'a'.repeat(64) },
    title: 'Synthetic outline',
    modules: [
      {
        title: 'Module 0',
        objectives: ['Learn synthetic policy'],
        topics: [{ title: 'Topic 0', concepts: [{ title: 'Concept 0' }] }],
      },
    ],
  };
  const contentFrame = JSON.stringify([
    'F054_OUTLINE_CONTENT',
    1,
    [
      1,
      id(2),
      [id(1), 1, 'a'.repeat(64)],
      'Synthetic outline',
      [['Module 0', ['Learn synthetic policy'], [['Topic 0', ['Concept 0']]]]],
    ],
  ]);
  assert.equal(schema.outlineContentDigest(o), hash(contentFrame));
  assert.equal(
    hash(contentFrame),
    'b43c7e9140f4d0d547159fcdf0ca7c13a82caf465d6bf756cc1b68b19390916d',
  );
  const completion = {
    attemptId: id(8),
    ledgerOperationId: id(9),
    operationId: uuid(2),
    claimId: uuid(3),
    ownerId: uuid(4),
    intentDigest: 'e'.repeat(64),
    requestDigest: 'd'.repeat(64),
    rawOutputDigest: 'c'.repeat(64),
    templateVersion: uuid(5),
    completedAt: new Date('2026-11-07T00:00:00.500Z'),
  };
  const completionFrame = JSON.stringify([
    'F054_OUTLINE_COMPLETION',
    1,
    id(8),
    id(9),
    id(3),
    uuid(2),
    uuid(3),
    uuid(4),
    'e'.repeat(64),
    'd'.repeat(64),
    'c'.repeat(64),
    uuid(5),
    '2026-11-07T00:00:00.500Z',
  ]);
  assert.equal(
    schema.outlineCompletionDigest(completion, id(3)),
    hash(completionFrame),
  );
  const intent = {
    schemaVersion: 1,
    technologyId: id(2),
    brief: o.source,
    proposal: {
      id: id(4),
      proposalId: id(1),
      revision: 1,
      digest: 'b'.repeat(64),
    },
    operationId: uuid(2),
  };
  assert.equal(
    hash(completionFrame),
    '2652fabf56f2b3a3db5b530da089c59e5c0cd92f7d1587cef8dedf54e6aa9ee6',
  );
  const intentFrame = JSON.stringify([
    'F054_OUTLINE_INTENT',
    1,
    id(3),
    'SHARED_AI_TESTING',
    uuid(2),
    id(2),
    [id(1), 1, 'a'.repeat(64)],
    [id(4), id(1), 1, 'b'.repeat(64)],
    'f'.repeat(64),
    uuid(5),
  ]);
  assert.equal(
    schema.outlineIntentDigest({
      actorId: id(3),
      intent,
      ledgerIntentFingerprint: 'f'.repeat(64),
      templateVersion: uuid(5),
    }),
    hash(intentFrame),
  );
  const definition = {
    _id: id(6),
    outlineId: id(7),
    schemaVersion: 1,
    revision: 1,
    origin: 'AI_GENERATED',
    outline: o,
    proposal: intent.proposal,
    createdBy: id(3),
    createdAt: new Date('2026-11-07T00:00:01.000Z'),
    producer: { ...completion, completionDigest: hash(completionFrame) },
    contentDigest: hash(contentFrame),
  };
  assert.equal(
    hash(intentFrame),
    '35ff5760095dbaa3185250a7184e3b13bcdf01733cf0598b4f7fe9ea13ae1fd6',
  );
  const definitionFrame = JSON.stringify([
    'F054_OUTLINE_REVISION',
    1,
    id(6),
    id(7),
    1,
    'AI_GENERATED',
    hash(contentFrame),
    [id(4), id(1), 1, 'b'.repeat(64)],
    id(3),
    '2026-11-07T00:00:01.000Z',
    hash(completionFrame),
  ]);
  assert.equal(
    schema.outlineDefinitionDigest(definition),
    hash(definitionFrame),
  );
  assert.equal(
    hash(definitionFrame),
    'f3a332ad915898f3fa91b54cda66c2d300eb6063e38e27a1ebc5eaa93d95cd0b',
  );
});

test('nonempty prerequisites/runtime remain content-only and bind exact source request', () => {
  const r = fixture(true);
  assert.equal(propose(r).kind, 'ADMISSION_PROPOSED');
  const request = JSON.parse(r.context.command.inputJson);
  assert.deepEqual(request.runtime, { name: 'Node.js', version: '24' });
  assert.deepEqual(request.prerequisites, [
    { description: 'Understand synthetic variables' },
  ]);
  assert.deepEqual(Object.keys(request), [
    'title',
    'objectives',
    'audience',
    'depth',
    'runtime',
    'technologyVersion',
    'prerequisites',
  ]);
  assert(!r.context.command.inputJson.includes(r.brief._id));
  assert(!r.context.command.inputJson.includes(r.context.actorId));
});

test('assembled O0 envelope accepts exactly 64 KiB and rejects one byte over', () => {
  const r = fixture();
  const body = {
    title: 'Synthetic outline',
    modules: Array.from({ length: 8 }, (_, m) => ({
      title: `Module ${m}`,
      objectives: Array.from(
        { length: 10 },
        (_, i) => String(i) + '界'.repeat(239),
      ),
      topics: Array.from({ length: 4 }, (_, t) => ({
        title: `Topic ${t}`,
        concepts: Array.from({ length: 4 }, (_, c) => ({ title: `C${c}` })),
      })),
    })),
  };
  const envelope = () => ({
    schemaVersion: 1 as const,
    technologyId: r.brief.technologyId,
    source: r.context.intent.brief,
    ...body,
  });
  let missing = 65_536 - Buffer.byteLength(JSON.stringify(envelope()));
  assert(missing > 0);
  for (const m of body.modules)
    for (const t of m.topics)
      for (const c of t.concepts) {
        const count = Math.min(missing, 119 - c.title.length);
        c.title += 'x'.repeat(count);
        missing -= count;
      }
  assert.equal(missing, 0);
  assert.equal(Buffer.byteLength(JSON.stringify(envelope())), 65_536);
  r.candidate.outline = structuredClone(envelope());
  r.rawOutput = JSON.stringify(body);
  assert(Buffer.byteLength(r.rawOutput) < 65_536);
  r.candidate.producer.rawOutputDigest = schema.outlineRawOutputDigest(
    r.rawOutput,
  );
  rehash(r);
  r.context.completionDigest = r.candidate.producer.completionDigest;
  assert.equal(propose(r).kind, 'ADMISSION_PROPOSED');
  body.modules[0]!.topics[0]!.concepts[0]!.title += 'x';
  assert.equal(Buffer.byteLength(JSON.stringify(envelope())), 65_537);
  assert.throws(() => schema.outlineContentDigest(envelope()), {
    message: 'Invalid curriculum outline candidate',
  });
  r.rawOutput = JSON.stringify(body);
  r.candidate.producer.rawOutputDigest = schema.outlineRawOutputDigest(
    r.rawOutput,
  );
  rehash(r);
  r.context.completionDigest = r.candidate.producer.completionDigest;
  refuse(r, 'OUTPUT_INVALID');
});

test('missing fields and malformed UUID/origin/version never become defaults', () => {
  for (const scope of ['root', 'candidate', 'context', 'producer'] as const) {
    const sample = fixture();
    const keys = Object.keys(
      scope === 'root'
        ? sample
        : scope === 'candidate'
          ? sample.candidate
          : scope === 'context'
            ? sample.context
            : sample.candidate.producer,
    );
    for (const key of keys) {
      const r = fixture();
      const target =
        scope === 'root'
          ? r
          : scope === 'candidate'
            ? r.candidate
            : scope === 'context'
              ? r.context
              : r.candidate.producer;
      Reflect.deleteProperty(target, key);
      refuse(r);
    }
  }
  for (const override of [
    { origin: 'MANUAL' },
    { revision: 2 },
    { schemaVersion: 2 },
    { _id: 'A'.repeat(24) },
  ]) {
    const r = fixture();
    Object.assign(r.candidate, override);
    refuse(r);
  }
  for (const bad of [
    uuid(2).toUpperCase() + 'A',
    '00000000-0000-0000-0000-000000000000',
    uuid(2) + '\n',
    [uuid(2)],
  ]) {
    const r = fixture();
    Object.assign(r.candidate.producer, { operationId: bad });
    refuse(r);
  }
});

test('native Date accessors/proxies are not invoked and canonical projection revalidates', () => {
  let observed = 0;
  const r = fixture();
  const date = new Date(r.context.createdAt.getTime());
  Object.defineProperty(date, 'toISOString', {
    get() {
      observed++;
      throw new Error('private');
    },
  });
  Object.assign(r.candidate, { createdAt: date });
  refuse(r);
  const p = fixture();
  Object.assign(p.candidate, {
    createdAt: new Proxy(new Date('2026-11-07T00:00:01.000Z'), {
      get() {
        observed++;
        throw new Error('private');
      },
    }),
  });
  refuse(p);
  assert.equal(observed, 0);
  const good = fixture();
  const canonical = schema.validateOutlineCandidate(good.candidate);
  assert.deepEqual(
    schema.validateOutlineCandidate(JSON.parse(JSON.stringify(canonical))),
    canonical,
  );
});

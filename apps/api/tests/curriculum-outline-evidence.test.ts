import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import mongoose, { Types } from 'mongoose';
import type { ClientSession, Db, MongoClient } from 'mongodb';
import {
  createOutlineAttemptRepository,
  outlineAttemptRequiredIndexes,
  type OutlineAttemptDependencies,
} from '../src/modules/ai/curriculum-outline-attempt.repository.js';
import {
  outlineAttemptBindingDigest,
  outlineCheckpointDigest,
  createCurriculumOutlineProducer,
  type OutlineWork,
} from '../src/modules/ai/curriculum-outline-producer.service.js';
import { curriculumBriefDigest } from '../src/modules/admin/learning-paths/admin-curriculum-brief.schema.js';
import { proposalDefinitionDigest } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';
import {
  outlineIntentDigest,
  outlineCompletionDigest,
  outlineRawOutputDigest,
  outlineContentDigest,
  outlineDefinitionDigest,
  validateOutlineCandidate,
} from '../src/modules/ai/curriculum-outline-candidate.schema.js';
import { validateCurriculumOutline } from '../src/modules/ai/curriculum-outline.validator.js';
import { aiUsageTimeAt } from '../src/modules/ai/ai-usage-control.schema.js';
import {
  ledgerIntentFingerprint,
  ledgerQuoteDigest,
  ledgerRequestDigest,
  ledgerReservationFingerprint,
  paiseFromDecimal,
  validateLedgerOperation,
} from '../src/modules/ai/ai-usage-ledger.schema.js';
import { ledgerAuditFor } from '../src/modules/ai/ai-usage-ledger.repository.js';

const id = (n: number) => n.toString(16).padStart(24, '0'),
  oid = (n: number) => new Types.ObjectId(id(n));
const uuid = (n: number) =>
  `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
const base = Date.parse('2026-11-08T00:00:00.000Z'),
  iso = (n: number) => new Date(base + n).toISOString();
type Row = Record<string, unknown>;
function copy<T>(v: T): T {
  if (v instanceof Types.ObjectId)
    return new Types.ObjectId(v.toHexString()) as T;
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (v && typeof v === 'object') {
    // Decimal128 is immutable in these fixtures; retain its approved native type.
    if (Object.getPrototypeOf(v) !== Object.prototype && !Array.isArray(v))
      return v;
    const result: object = Array.isArray(v) ? [] : {};
    for (const key of Reflect.ownKeys(v)) {
      if (key === 'length') continue;
      const d = Object.getOwnPropertyDescriptor(v, key)!;
      Object.defineProperty(
        result,
        key,
        'value' in d ? { ...d, value: copy(d.value) } : d,
      );
    }
    return result as T;
  }
  return v;
}
function at(row: unknown, key: string): unknown {
  let v = row;
  for (const part of key.split('.')) {
    if (!v || typeof v !== 'object') return undefined;
    const d = Object.getOwnPropertyDescriptor(v, part);
    if (!d) return undefined;
    if (!('value' in d)) return badGetter();
    v = d.value;
  }
  return v;
}
function badGetter(): never {
  throw new Error('SYNTHETIC_PRIVATE');
}
function equal(a: unknown, b: unknown): boolean {
  if (a instanceof Types.ObjectId && b instanceof Types.ObjectId)
    return a.equals(b);
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  return a === b;
}
function matches(row: Row, filter: Row): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return (value as Row[]).some((f) => matches(row, f));
    const v = at(row, key);
    if (
      value &&
      typeof value === 'object' &&
      !(value instanceof Types.ObjectId) &&
      !(value instanceof Date)
    )
      return Object.entries(value).every(([op, x]) =>
        op === '$eq'
          ? equal(v, x)
          : op === '$exists'
            ? (v !== undefined) === x
            : op === '$gt'
              ? v instanceof Date && x instanceof Date && v > x
              : op === '$nin'
                ? !(x as unknown[]).includes(v)
                : op === '$type'
                  ? v !== null && typeof v === 'object'
                  : false,
      );
    return equal(v, value);
  });
}
function projected(row: Row, projection?: Row): Row {
  if (!projection) return copy(row);
  const result: Row = {};
  for (const key of Object.keys(projection)) {
    const [parent, child] = key.split('.');
    if (!parent || !Object.hasOwn(row, parent)) continue;
    if (!child) {
      Object.defineProperty(
        result,
        parent,
        Object.getOwnPropertyDescriptor(row, parent)!,
      );
      continue;
    }
    const raw = row[parent];
    if (raw === null || typeof raw !== 'object') {
      result[parent] = raw;
      continue;
    }
    const d = Object.getOwnPropertyDescriptor(raw, child);
    if (d)
      Object.defineProperty(
        (result[parent] ??= Array.isArray(raw) ? [] : {}),
        child,
        d,
      );
  }
  return copy(result);
}

/** SYNTHETIC / NOT_SAVED / NOT_AI_GENERATED. No real authority or database. */
function fixture() {
  const content = {
    title: 'Synthetic brief',
    objectives: ['Learn synthetic policy'],
    audience: 'Synthetic audience',
    depth: 'BEGINNER' as const,
    runtime: null,
    technologyVersion: null,
    prerequisites: [],
  };
  const briefDefinition = {
    _id: id(1),
    technologyId: id(2),
    schemaVersion: 1 as const,
    revision: 1 as const,
    ...content,
    createdBy: id(30),
    createdAt: new Date(base),
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
    source: { id: id(1), revision: 1 as const, digest: brief.contentDigest },
    ...content,
    createdAt: new Date(base),
  };
  const proposal = {
    ...proposalDefinition,
    definitionDigest: proposalDefinitionDigest(proposalDefinition),
  };
  const command = {
    operationId: uuid(2),
    technologyId: id(2),
    source: proposal.source,
    instructions: 'Synthetic approved template',
    inputJson: JSON.stringify(content),
    requestBounds: {
      instructionBytes: 27,
      inputJsonBytes: Buffer.byteLength(JSON.stringify(content)),
      maxOutputBytes: 65536,
      maxOutputTokens: 4096,
      budgetMs: 10000,
    },
  };
  command.requestBounds.instructionBytes = Buffer.byteLength(
    command.instructions,
  );
  const period = aiUsageTimeAt(base),
    fingerprint = ledgerIntentFingerprint({ actorId: id(3), command }),
    requestDigest = ledgerRequestDigest({
      instructions: command.instructions,
      inputJson: command.inputJson,
    });
  const quote = {
    id: uuid(10),
    periodKey: period.periodKey,
    environment: 'DEV',
    purpose: 'CURRICULUM_OUTLINE',
    policyVersion: uuid(11),
    profileVersion: uuid(12),
    pricingVersion: uuid(13),
    privacyVersion: uuid(14),
    spendingApprovalRef: uuid(15),
    providerAlias: 'synthetic',
    modelAlias: 'synthetic',
    templateVersion: uuid(5),
    requestDigest,
    requestBounds: command.requestBounds,
    inputTokenUpperBound: 4096,
    worstCasePaise: paiseFromDecimal('1'),
    effectiveAtMs: base,
    expiresAtMs: base + 20000,
    assumptionsDigest: 'a'.repeat(64),
  };
  const intent = {
    schemaVersion: 1 as const,
    technologyId: id(2),
    brief: proposal.source,
    proposal: {
      id: id(4),
      proposalId: id(1),
      revision: 1 as const,
      digest: proposal.definitionDigest,
    },
    operationId: uuid(2),
  };
  const binding = {
    _id: id(8),
    schemaVersion: 1 as const,
    scope: 'SHARED_AI_TESTING' as const,
    actorId: id(3),
    sessionId: id(11),
    operationId: uuid(2),
    technologyId: id(2),
    brief: proposal.source,
    proposal: intent.proposal,
    ledgerOperationId: id(9),
    ledgerIntentFingerprint: fingerprint,
    intentDigest: outlineIntentDigest({
      actorId: id(3),
      intent,
      ledgerIntentFingerprint: fingerprint,
      templateVersion: uuid(5),
    }),
    requestDigest,
    templateVersion: uuid(5),
    quoteDigest: ledgerQuoteDigest(quote),
    outlineRevisionId: id(6),
    outlineId: id(7),
    terminalAuditId: id(12),
    completionAuditId: id(13),
    createdAt: iso(0),
  };
  const prepared = {
    ...binding,
    bindingDigest: outlineAttemptBindingDigest(binding),
    version: 0,
    phase: 'PREPARED',
    invocation: null,
    completion: null,
    cancelledAt: null,
    receipt: null,
  };
  const operation: Row = {
    _id: oid(9),
    schemaVersion: 1,
    scope: 'SHARED_AI_TESTING',
    actorId: oid(3),
    operationId: uuid(2),
    purpose: 'CURRICULUM_OUTLINE',
    environment: 'DEV',
    technologyId: oid(2),
    source: { ...proposal.source, id: oid(1) },
    requestDigest,
    requestBounds: command.requestBounds,
    intentFingerprint: fingerprint,
    reservationFingerprint: ledgerReservationFingerprint({
      intentFingerprint: fingerprint,
      periodKey: period.periodKey,
      admissionWindowKey: period.actorWindowKey,
      quoteDigest: binding.quoteDigest,
    }),
    quote,
    quoteDigest: binding.quoteDigest,
    periodKey: period.periodKey,
    admissionWindowKey: period.actorWindowKey,
    admittedAt: new Date(base),
    reservationPaise: paiseFromDecimal('1'),
    version: 1,
    state: 'RESERVED',
    open: true,
    heldPaise: paiseFromDecimal('1'),
    actualPaise: null,
    claim: null,
    terminalEvidence: null,
    safeCode: null,
    lastAuditId: oid(14),
    updatedAt: new Date(base),
  };
  const sourceAudit = {
    _id: oid(1),
    category: 'CONTENT_MANAGEMENT',
    action: 'CURRICULUM_BRIEF_ADMITTED',
    actorId: oid(30),
    resourceType: 'CURRICULUM_BRIEF_REVISION',
    resourceId: oid(1),
    requestId: 'synthetic-source',
    createdAt: new Date(base),
    metadata: { technologyId: oid(2), revision: 1, operationId: uuid(1) },
  };
  const revisionAudit = {
    _id: oid(4),
    category: 'CONTENT_MANAGEMENT',
    action: 'LEARNING_PATH_PROPOSAL_REVISION_CREATED',
    actorId: oid(30),
    resourceType: 'LEARNING_PATH_PROPOSAL_REVISION',
    resourceId: oid(4),
    requestId: 'synthetic-source',
    createdAt: new Date(base),
    metadata: {
      proposalId: oid(1),
      revision: 1,
      sourceId: oid(1),
      sourceRevision: 1,
    },
  };
  const rows: Record<string, Row[]> = {
    curriculumOutlineAttempts: [],
    curriculumOutlineCandidates: [],
    auditLogs: [
      sourceAudit,
      revisionAudit,
      ledgerAuditFor(
        validateLedgerOperation(operation),
        'AI_USAGE_RESERVED',
        oid(3),
        'synthetic-reserve',
        [],
      ),
    ],
    users: [
      {
        _id: oid(3),
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(base - 1000),
        __v: 0,
      },
    ],
    sessions: [
      {
        _id: oid(11),
        userId: oid(3),
        revokedAt: null,
        expiresAt: new Date(base + 60000),
        __v: 0,
      },
    ],
    technologies: [{ _id: oid(2), status: 'DRAFT' }],
    curriculumBriefRevisions: [
      { ...brief, _id: oid(1), technologyId: oid(2), createdBy: oid(30) },
    ],
    learningPathProposalRevisions: [
      {
        ...proposal,
        _id: oid(4),
        proposalId: oid(1),
        technologyId: oid(2),
        source: { ...proposal.source, id: oid(1) },
      },
    ],
    aiUsageOperations: [operation],
  };
  const calls: { name: string; filter?: Row; update?: Row; options?: Row }[] =
    [];
  const stop = new AbortController(),
    loss = new AbortController(),
    timers = new Map<number, { at: number; fn: () => void }>();
  let elapsed = 2,
    nextTimer = 0,
    nextAudit = 100;
  const state = {
    active: false,
    ended: false,
    hook: async (name: string) => {
      void name;
    },
    commitFail: false,
    abortFail: false,
    endFail: false,
    notEnded: false,
    checkFail: false,
    writeAck: undefined as unknown,
    insertAck: undefined as unknown,
    policyFail: false,
  };
  let snapshot: Record<string, Row[]> | undefined;
  async function event(
    name: string,
    filter?: Row,
    options?: Row,
    update?: Row,
  ) {
    calls.push({
      name,
      ...(filter ? { filter: copy(filter) } : {}),
      ...(options ? { options } : {}),
      ...(update ? { update: copy(update) } : {}),
    });
    await state.hook(name);
  }
  const session = {
    get hasEnded() {
      return state.ended;
    },
    inTransaction: () => state.active,
    startTransaction(options: unknown) {
      calls.push({ name: 'startTransaction', options: options as Row });
      state.active = true;
      snapshot = copy(rows);
    },
    async commitTransaction(options: Row) {
      await event('commit', undefined, options);
      if (state.commitFail) throw new Error('SYNTHETIC_PRIVATE');
      state.active = false;
    },
    async abortTransaction(options: Row) {
      await event('abort', undefined, options);
      if (state.abortFail) throw new Error('SYNTHETIC_PRIVATE');
      if (snapshot)
        for (const key of Object.keys(rows)) rows[key] = copy(snapshot[key]!);
      state.active = false;
    },
    async endSession(options: Row) {
      await event('end', undefined, options);
      if (!state.notEnded) state.ended = true;
      if (state.endFail) throw new Error('SYNTHETIC_PRIVATE');
    },
  };
  const indexes = (name: string) => [
    ...outlineAttemptRequiredIndexes
      .filter((x) => x.collection === name)
      .map((x) => copy(x)),
    ...(['users', 'sessions', 'auditLogs'].includes(name)
      ? [{ name: '_id_', key: { _id: 1 }, unique: true }]
      : []),
  ];
  const client = {
    startSession(options: Row) {
      calls.push({ name: 'startSession', options });
      state.ended = false;
      return session;
    },
  };
  const db = {
    client,
    admin: () => ({
      command: async (_cmd: Row, options: Row) => {
        await event('hello', undefined, options);
        return {
          isWritablePrimary: true,
          setName: 'synthetic',
          logicalSessionTimeoutMinutes: 30,
        };
      },
    }),
    collection(name: string) {
      return {
        listIndexes(options: Row) {
          return {
            toArray: async () => {
              await event('indexes:' + name, undefined, options);
              return indexes(name);
            },
          };
        },
        async findOne(filter: Row, options: Row) {
          await event(name + ':read', filter, options);
          const row = rows[name]?.find((r) => matches(r, filter));
          return row
            ? projected(row, options.projection as Row | undefined)
            : null;
        },
        find(filter: Row, options: Row) {
          let limit = 0;
          return {
            limit(n: number) {
              limit = n;
              return this;
            },
            async toArray() {
              await event(name + ':find', filter, options);
              return (rows[name] ?? [])
                .filter((r) => matches(r, filter))
                .slice(0, limit)
                .map((r) =>
                  projected(r, options.projection as Row | undefined),
                );
            },
          };
        },
        async insertOne(row: Row, options: Row) {
          await event(name + ':insert', row, options);
          rows[name]!.push(copy(row));
          return state.insertAck ?? { acknowledged: true, insertedId: row._id };
        },
        async updateOne(filter: Row, update: Row, options: Row) {
          await event(name + ':update', filter, options, update);
          const row = rows[name]!.find((r) => matches(r, filter));
          if (row) {
            Object.assign(row, copy(update.$set ?? {}));
            for (const [k, n] of Object.entries(update.$inc ?? {}))
              row[k] = Number(row[k]) + Number(n);
          }
          return (
            state.writeAck ?? {
              acknowledged: true,
              matchedCount: row ? 1 : 0,
              modifiedCount: row ? 1 : 0,
              upsertedCount: 0,
              upsertedId: null,
            }
          );
        },
      };
    },
  };
  const auth = { sub: id(3), sid: id(11), role: 'ADMIN', plan: 'FREE' };
  const clock = {
    now: () => base + elapsed,
    monotonic: () => elapsed,
    setTimeout(fn: () => void, ms: number) {
      const n = ++nextTimer;
      timers.set(n, { at: elapsed + ms, fn });
      return n;
    },
    clearTimeout(handle: unknown) {
      timers.delete(handle as number);
    },
  };
  const work: OutlineWork = {
    signal: stop.signal,
    get remainingMs() {
      return 10000 - elapsed;
    },
    commitMs: 2000,
    abortMs: 2000,
    endSessionMs: 2000,
    check() {
      if (state.checkFail || stop.signal.aborted || elapsed >= 10000)
        throw new Error('SYNTHETIC_PRIVATE');
    },
  };
  const deps: OutlineAttemptDependencies = {
    db: db as unknown as Db,
    client: client as unknown as MongoClient,
    clock,
    loss: loss.signal,
    async verify() {
      await event('verify');
      return auth;
    },
    async authorize(_b, _mode, ctx) {
      await event('policy:' + _mode, undefined, { session: ctx.session });
      if (state.policyFail) throw new Error('SYNTHETIC_PRIVATE');
    },
    async readCommand(_b, ctx) {
      await event('command', undefined, { session: ctx.session });
      return command;
    },
    allocateAuditId: () => oid(nextAudit++),
    requestId: 'synthetic-store',
    requestingSessionId: id(11),
  };
  const repository = createOutlineAttemptRepository(deps);
  const invocation = {
    claimVersion: 2,
    id: uuid(3),
    ownerId: uuid(4),
    claimedAt: iso(1),
    observeUntil: iso(10001),
    markedAt: iso(2),
  };
  const raw = JSON.stringify({
    title: 'Synthetic outline',
    modules: [
      {
        title: 'Synthetic module',
        objectives: ['Learn synthetic policy'],
        topics: [
          {
            title: 'Synthetic topic',
            concepts: [{ title: 'Synthetic concept' }],
          },
        ],
      },
    ],
  });
  function completion() {
    const fields = {
      attemptId: id(8),
      ledgerOperationId: id(9),
      operationId: uuid(2),
      claimId: uuid(3),
      ownerId: uuid(4),
      intentDigest: binding.intentDigest,
      requestDigest,
      rawOutputDigest: outlineRawOutputDigest(raw),
      templateVersion: uuid(5),
      completedAt: iso(2),
    };
    const producer = {
      ...fields,
      completionDigest: outlineCompletionDigest(fields, id(3)),
    };
    const partial = {
      schemaVersion: 1,
      producer,
      rawOutput: raw,
      createdAt: iso(2),
    };
    return {
      ...partial,
      checkpointDigest: outlineCheckpointDigest(binding, invocation, partial),
    };
  }
  function claim() {
    const op = rows.aiUsageOperations![0]!;
    Object.assign(op, {
      state: 'DISPATCH_CLAIMED',
      version: 2,
      claim: {
        id: uuid(3),
        ownerId: uuid(4),
        claimedAt: new Date(base + 1),
        observeUntil: new Date(base + 10001),
      },
      lastAuditId: oid(15),
      updatedAt: new Date(base + 1),
    });
    rows.auditLogs!.push(
      ledgerAuditFor(
        validateLedgerOperation(op),
        'AI_USAGE_DISPATCH_CLAIMED',
        oid(3),
        'synthetic-claim',
        [],
      ),
    );
  }
  const mark = () =>
    repository.mark({ binding, expectedVersion: 0, invocation }, work);
  const capture = () => {
    const c = completion();
    return repository.capture(
      {
        binding,
        expectedVersion: 1,
        invocation,
        completion: c,
        audit: {
          id: id(13),
          action: 'CURRICULUM_OUTLINE_COMPLETION_STORED',
          actorId: id(3),
          attemptId: id(8),
          technologyId: id(2),
          operationId: uuid(2),
          digest: c.checkpointDigest,
          createdAt: c.createdAt,
        },
      },
      work,
    );
  };
  const inspect = (mode: 'METADATA' | 'EVIDENCE' = 'EVIDENCE') =>
    repository.inspect(
      {
        actorId: id(3),
        attemptId: id(8),
        operationId: uuid(2),
        technologyId: id(2),
        bindingDigest: prepared.bindingDigest,
        mode,
      },
      work,
    );
  return {
    repository,
    rows,
    calls,
    state,
    session,
    client,
    db,
    indexes,
    auth,
    deps,
    work,
    clock,
    timers,
    stop,
    loss,
    binding,
    prepared,
    invocation,
    completion,
    command,
    brief,
    proposal,
    claim,
    mark,
    capture,
    inspect,
    advance(ms: number) {
      elapsed += ms;
      for (const [n, t] of [...timers])
        if (t.at <= elapsed) {
          timers.delete(n);
          t.fn();
        }
    },
  };
}

import {
  createOutlineEvidenceReader,
  outlineCoordinatorRead,
  OutlineEvidenceFailure,
  type OutlineEvidenceReaderPorts,
} from '../src/modules/ai/curriculum-outline-evidence.reader.js';

function readerFixture() {
  const h = fixture();
  h.state.active = true;
  const session = h.session as unknown as ClientSession;
  const ports: OutlineEvidenceReaderPorts = {
    db: h.db as unknown as Db,
    client: h.client as unknown as MongoClient,
    session,
    work: h.work,
    clock: h.clock,
    loss: h.loss.signal,
    check: () => h.work.check(),
    findOne: (collection, filter, opts) =>
      h.db.collection(collection).findOne(filter, opts as unknown as Row),
    findMany: (collection, filter, opts) =>
      h.db
        .collection(collection)
        .find(filter, opts as unknown as Row)
        .limit(opts.limit)
        .toArray(),
    readCommand: (binding, ctx) => h.deps.readCommand(binding, ctx),
  };
  const reader = createOutlineEvidenceReader(ports);
  const input = (
    mode: 'PREPARE' | 'MARK' | 'CAPTURE' | 'EVIDENCE' = 'PREPARE',
  ) => ({
    binding: h.binding,
    invocation: mode === 'PREPARE' ? null : h.invocation,
    mode,
  });
  return { ...h, ports, reader, input };
}
type ReaderFixture = ReturnType<typeof readerFixture>;
const safeFailure = (error: unknown) =>
  error instanceof OutlineEvidenceFailure &&
  error.message === 'Curriculum outline evidence is unavailable' &&
  ['SOURCE_UNAVAILABLE', 'CONTROL_UNAVAILABLE'].includes(error.code);
const noMutations = (h: ReturnType<typeof fixture>) =>
  assert.equal(
    h.calls.some(
      (c) =>
        c.name.endsWith(':insert') ||
        c.name.endsWith(':update') ||
        ['commit', 'abort', 'end', 'startSession', 'startTransaction'].includes(
          c.name,
        ),
    ),
    false,
  );

test('source admission proof is exact, private, read-only and uses one supplied active session', async () => {
  const h = readerFixture(),
    before = copy(h.rows),
    result = await h.reader.read(h.input());
  assert.equal(result.brief._id, id(1));
  assert.equal(result.proposal._id, id(4));
  assert.equal(result.brief.createdBy, id(30));
  assert.notEqual(result.brief.createdBy, h.binding.actorId);
  assert.equal(result.currentAudit.action, 'AI_USAGE_RESERVED');
  assert.equal(result.dispatchAudit, null);
  assert.equal(result.claimProof, null);
  assert.deepEqual(result.cmd, h.command);
  assert.equal(result.parent, 'DRAFT');
  assert.equal(Object.isFrozen(result), true);
  for (const flag of [
    'currentAdmin',
    'controlsCurrent',
    'sourceAdmitted',
    'admissionApproved',
    'cleanup',
    'kind',
  ])
    assert.equal(Object.hasOwn(result, flag), false);
  const reads = h.calls.filter(
    (c) => c.name.endsWith(':read') || c.name === 'command',
  );
  assert.equal(reads.length, 8);
  for (const call of reads)
    assert.equal(call.options?.session, h.session, call.name);
  assert.deepEqual(h.calls[0]?.options?.projection, { _id: 1, status: 1 });
  assert.deepEqual(h.rows, before);
  noMutations(h);
});

test('current claim proof derives the coordinator shape without adding native audit metadata', async () => {
  const h = readerFixture();
  h.claim();
  const p = await h.reader.read(h.input('MARK'));
  assert.ok(p.claimProof);
  assert.equal(p.operation.state, 'DISPATCH_CLAIMED');
  assert.deepEqual(p.claimProof.audit, {
    id: id(15),
    action: 'AI_USAGE_DISPATCH_CLAIMED',
    operationId: id(9),
    actorId: id(3),
    claimId: uuid(3),
    ownerId: uuid(4),
    claimVersion: 2,
  });
  assert.notEqual(p.claimProof.audit.operationId, h.binding.operationId);
  assert.equal(Object.hasOwn(p.dispatchAudit!.metadata, 'claimId'), false);
  assert.equal(Object.hasOwn(p.dispatchAudit!.metadata, 'ownerId'), false);
  assert.equal(Object.isFrozen(p.claimProof.audit), true);
  assert.equal(Object.isFrozen(p.claimProof), true);
  assert.deepEqual(h.calls.find((c) => c.name === 'auditLogs:find')?.filter, {
    resourceType: 'AI_USAGE_OPERATION',
    resourceId: oid(9),
    'metadata.usageVersion': 2,
  });
  assert.equal(
    h.calls.find((c) => c.name === 'auditLogs:find')?.options?.limit,
    2,
  );
  noMutations(h);
});

function uncertain(h: ReaderFixture) {
  const op = h.rows.aiUsageOperations![0]!;
  Object.assign(op, {
    state: 'UNCERTAIN',
    version: 3,
    safeCode: 'OUTCOME_UNKNOWN',
    lastAuditId: oid(16),
    updatedAt: new Date(base + 2),
  });
  h.rows.auditLogs!.push(
    ledgerAuditFor(
      validateLedgerOperation(op),
      'AI_USAGE_UNCERTAIN',
      oid(3),
      'synthetic-accounting',
      ['UNCERTAIN'],
    ),
  );
}
function settled(h: ReaderFixture) {
  const op = h.rows.aiUsageOperations![0]!,
    evidence = {
      id: uuid(20),
      kind: 'FINAL_COST',
      evidenceDigest: 'f'.repeat(64),
      actualPaise: paiseFromDecimal('1'),
      inputTokens: 10,
      outputTokens: 20,
    };
  Object.assign(op, {
    state: 'SETTLED',
    open: false,
    version: 3,
    heldPaise: paiseFromDecimal('0'),
    actualPaise: paiseFromDecimal('1'),
    terminalEvidence: evidence,
    safeCode: null,
    lastAuditId: oid(16),
    updatedAt: new Date(base + 2),
  });
  h.rows.auditLogs!.push(
    ledgerAuditFor(
      validateLedgerOperation(op),
      'AI_USAGE_SETTLED',
      oid(3),
      'synthetic-accounting',
      [],
    ),
  );
}
for (const state of ['UNCERTAIN', 'SETTLED'] as const) {
  test(`historical dispatch remains distinct from current ${state} audit and refuses current-dispatch promotion`, async () => {
    const h = readerFixture();
    h.claim();
    if (state === 'UNCERTAIN') uncertain(h);
    else settled(h);
    for (const mode of ['CAPTURE', 'EVIDENCE'] as const) {
      const proof = await h.reader.read(h.input(mode));
      assert.equal(proof.operation.state, state);
      assert.equal(proof.currentAudit._id.toHexString(), id(16));
      assert.equal(proof.dispatchAudit!._id.toHexString(), id(15));
      assert.equal(proof.claimProof!.audit.claimVersion, 2);
      assert.equal(proof.claimProof!.operation.version, 3);
    }
    await assert.rejects(h.reader.read(h.input('MARK')), safeFailure);
    noMutations(h);
    const audit = h.rows.auditLogs!.find(
      (e) => e.action === 'AI_USAGE_DISPATCH_CLAIMED',
    )!;
    (audit.metadata as Row).policyVersion = uuid(99);
    await assert.rejects(h.reader.read(h.input('EVIDENCE')), safeFailure);
  });
}

for (const [name, mutate] of Object.entries({
  actor: (h: ReaderFixture) => {
    h.rows.aiUsageOperations![0]!.actorId = oid(99);
  },
  'source-technology': (h: ReaderFixture) => {
    h.rows.curriculumBriefRevisions![0]!.technologyId = oid(99);
  },
  'source-native-author': (h: ReaderFixture) => {
    h.rows.curriculumBriefRevisions![0]!.createdBy = id(30);
  },
  'source-digest': (h: ReaderFixture) => {
    h.rows.curriculumBriefRevisions![0]!.contentDigest = 'f'.repeat(64);
  },
  'proposal-family': (h: ReaderFixture) => {
    h.rows.learningPathProposalRevisions![0]!.proposalId = oid(99);
  },
  'proposal-source': (h: ReaderFixture) => {
    (h.rows.learningPathProposalRevisions![0]!.source as Row).id = oid(99);
  },
  'source-audit-actor': (h: ReaderFixture) => {
    h.rows.auditLogs![0]!.actorId = oid(99);
  },
  'source-audit-private': (h: ReaderFixture) => {
    (h.rows.auditLogs![0]!.metadata as Row).private = 'SYNTHETIC_PRIVATE';
  },
  'proposal-audit-request': (h: ReaderFixture) => {
    h.rows.auditLogs![1]!.requestId = 'wrong-request';
  },
  'current-audit-missing': (h: ReaderFixture) => {
    h.rows.auditLogs = h.rows.auditLogs!.filter(
      (e) => !(e._id as Types.ObjectId).equals(oid(15)),
    );
  },
  'dispatch-duplicate': (h: ReaderFixture) => {
    h.rows.auditLogs!.push(
      copy(
        h.rows.auditLogs!.find(
          (e) => e.action === 'AI_USAGE_DISPATCH_CLAIMED',
        )!,
      ),
    );
  },
  'claim-owner': (h: ReaderFixture) => {
    (h.rows.aiUsageOperations![0]!.claim as Row).ownerId = uuid(99);
  },
  'claim-window': (h: ReaderFixture) => {
    (h.rows.aiUsageOperations![0]!.claim as Row).observeUntil = new Date(
      base + 9999,
    );
  },
  'request-input': (h: ReaderFixture) => {
    h.command.inputJson = 'SYNTHETIC_PRIVATE';
  },
  'request-template': (h: ReaderFixture) => {
    h.command.instructions = 'SYNTHETIC_PRIVATE';
  },
  'quote-version': (h: ReaderFixture) => {
    (h.rows.aiUsageOperations![0]!.quote as Row).profileVersion = uuid(99);
  },
})) {
  test(`source/claim reader refuses corrupted ${name} before any mutation and without private errors`, async () => {
    const h = readerFixture();
    h.claim();
    mutate(h);
    await assert.rejects(h.reader.read(h.input('MARK')), safeFailure);
    noMutations(h);
  });
}

for (const issue of [
  'inactive',
  'ended',
  'db-client',
  'session-replaced',
  'expired-work',
  'loss',
  'signal',
  'clock',
  'backwards-clock',
] as const) {
  test(`reader refuses ${issue} without opening/closing any transaction`, async () => {
    const h = readerFixture();
    if (issue === 'inactive') h.state.active = false;
    if (issue === 'ended') h.state.ended = true;
    if (issue === 'db-client') h.db.client = {} as typeof h.client;
    if (issue === 'session-replaced')
      Object.assign(h.ports, { session: {} as ClientSession });
    if (issue === 'expired-work') h.advance(10000);
    if (issue === 'loss') h.loss.abort();
    if (issue === 'signal') h.stop.abort();
    if (issue === 'clock') h.clock.now = () => NaN;
    if (issue === 'backwards-clock') {
      let count = 0;
      h.clock.now = () => base + (++count > 2 ? 1 : 2);
    }
    await assert.rejects(h.reader.read(h.input()), safeFailure);
    noMutations(h);
    if (issue !== 'backwards-clock') assert.equal(h.calls.length, 0);
  });
}

for (const issue of [
  'unknown',
  'operator',
  'getter',
  'proxy',
  'metadata',
  'cancel',
  'binding',
  'invocation',
  'missing',
] as const) {
  test(`closed reader input rejects ${issue} without invoking accessors or source calls`, async () => {
    const h = readerFixture();
    let observed = false;
    let input: unknown = h.input();
    const data = input as Row;
    if (issue === 'unknown') data.extra = 'SYNTHETIC_PRIVATE';
    if (issue === 'operator') data.$where = 'SYNTHETIC_PRIVATE';
    if (issue === 'getter')
      Object.defineProperty(data, 'binding', {
        enumerable: true,
        get() {
          observed = true;
          throw Error('SYNTHETIC_PRIVATE');
        },
      });
    if (issue === 'proxy')
      input = new Proxy(data, {
        get() {
          observed = true;
          throw Error('SYNTHETIC_PRIVATE');
        },
      });
    if (issue === 'metadata') data.mode = 'METADATA';
    if (issue === 'cancel') data.mode = 'CANCEL';
    if (issue === 'binding') data.binding = { ...h.binding, unknown: true };
    if (issue === 'invocation')
      data.invocation = { ...h.invocation, private: true };
    if (issue === 'missing') delete data.invocation;
    await assert.rejects(h.reader.read(input), safeFailure);
    assert.equal(observed, false);
    assert.equal(h.calls.length, 0);
  });
}

test('archived source stays inspectable while PREPARE/MARK refuse; missing parent never becomes empty proof', async () => {
  const h = readerFixture();
  h.rows.technologies![0]!.status = 'ARCHIVED';
  await assert.rejects(h.reader.read(h.input()), safeFailure);
  h.claim();
  await assert.rejects(h.reader.read(h.input('MARK')), safeFailure);
  assert.equal((await h.reader.read(h.input('EVIDENCE'))).parent, 'ARCHIVED');
  assert.equal((await h.reader.read(h.input('CAPTURE'))).parent, 'ARCHIVED'); // supplied storage authorizer remains mandatory in B.
  h.rows.technologies = [];
  await assert.rejects(h.reader.read(h.input('EVIDENCE')), safeFailure);
  noMutations(h);
});

for (const mode of ['PREPARE', 'MARK', 'CAPTURE'] as const)
  test(`reader rejects ${mode} with an incompatible invocation shape before reads`, async () => {
    const h = readerFixture();
    await assert.rejects(
      h.reader.read({
        ...h.input(mode),
        invocation: mode === 'PREPARE' ? h.invocation : null,
      }),
      safeFailure,
    );
    assert.equal(h.calls.length, 0);
    noMutations(h);
  });

test('reader propagates original work to command and refuses replacement during an awaited source read', async () => {
  const h = readerFixture();
  let originalWork = false;
  h.ports.readCommand = (binding, context) => {
    originalWork = context.work === h.work && context.session === h.session;
    return h.deps.readCommand(binding, context);
  };
  await h.reader.read(h.input());
  assert.equal(originalWork, true);
  h.calls.length = 0;
  const native = h.ports.findOne;
  h.ports.findOne = async (...args) => {
    const row = await native(...args);
    Object.assign(h.ports, { session: {} as ClientSession });
    return row;
  };
  await assert.rejects(h.reader.read(h.input()), safeFailure);
  assert.equal(h.calls.length, 1);
  noMutations(h);
});

test('fresh native copies preserve stored facts after returned Date/BSON values are mutated', async () => {
  const h = readerFixture();
  h.claim();
  const before = copy(h.rows),
    p = await h.reader.read(h.input('MARK'));
  p.operation.admittedAt.setTime(base + 777);
  p.operation._id.id = oid(99).id;
  p.currentAudit.createdAt.setTime(base + 777);
  p.currentAudit.actorId.id = oid(99).id;
  p.brief.createdAt.setTime(base + 777);
  assert.deepEqual(h.rows, before);
  const again = await h.reader.read(h.input('MARK'));
  assert.equal(again.operation.admittedAt.getTime(), base);
  assert.equal(again.operation._id.toHexString(), id(9));
  assert.equal(again.brief.createdAt.getTime(), base);
});

for (const signal of ['loss', 'stop'] as const) {
  test(`every source/claim await suppresses later reads on ${signal}`, async (t) => {
    const baseline = readerFixture();
    baseline.claim();
    await baseline.reader.read(baseline.input('MARK'));
    const trace = baseline.calls.map((c) => c.name);
    for (let cut = 0; cut < trace.length; cut++) {
      const h = readerFixture();
      h.claim();
      let n = -1,
        stopped = -1;
      h.state.hook = async (name) => {
        if (++n === cut) {
          assert.equal(name, trace[cut]);
          stopped = h.calls.length;
          h[signal].abort();
        }
      };
      await assert.rejects(h.reader.read(h.input('MARK')), safeFailure);
      assert.notEqual(stopped, -1);
      assert.equal(h.calls.length, stopped);
      noMutations(h);
    }
    t.diagnostic(
      `${trace.length} independent source/claim cuts for ${signal}; no original mutation ACK`,
    );
  });
}

test('late reader completion is rejected after context loss and never manufactures a mutation acknowledgement', async () => {
  const h = readerFixture();
  let release: () => void = () => {},
    reached: () => void = () => {};
  const held = new Promise<void>((resolve) => {
      release = resolve;
    }),
    entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
  h.state.hook = async (name) => {
    if (name === 'technologies:read') {
      reached();
      await held;
    }
  };
  const pending = h.reader.read(h.input());
  await entered;
  h.loss.abort();
  release();
  await assert.rejects(pending, safeFailure);
  assert.equal(h.calls.length, 1);
  noMutations(h);
});

async function exactRead(
  phase:
    | 'PREPARED'
    | 'INVOCATION_MARKED'
    | 'COMPLETION_STORED' = 'COMPLETION_STORED',
) {
  const h = fixture();
  assert.equal(
    ((await h.repository.prepare(h.prepared, h.work)) as Row).kind,
    'RECORDED',
  );
  if (phase !== 'PREPARED') {
    h.claim();
    assert.equal(((await h.mark()) as Row).kind, 'RECORDED');
  }
  if (phase === 'COMPLETION_STORED')
    assert.equal(((await h.capture()) as Row).kind, 'RECORDED');
  const observed = await h.inspect();
  h.calls.length = 0;
  const expected = {
    binding: h.binding,
    actorId: h.binding.actorId,
    requestingSessionId: id(11),
  };
  return { h, observed, expected };
}

for (const phase of [
  'PREPARED',
  'INVOCATION_MARKED',
  'COMPLETION_STORED',
] as const) {
  test(`strict bridge projects ${phase} exact read for inspection without an ACK`, async () => {
    const { h, observed, expected } = await exactRead(phase);
    const projection = outlineCoordinatorRead(observed, expected);
    assert.deepEqual(Object.keys(projection), [
      'attempt',
      'completionAudit',
      'terminalAudit',
      'candidate',
    ]);
    assert.equal(projection.attempt.phase, phase);
    assert.equal(Object.hasOwn(projection, 'kind'), false);
    assert.equal(Object.hasOwn(projection, 'cleanup'), false);
    assert.equal(Object.isFrozen(projection), true);
    assert.equal(Object.isFrozen(projection.attempt), true);
    assert.deepEqual(
      outlineCoordinatorRead(observed, {
        ...expected,
        requestingSessionId: id(99),
      }),
      projection,
    ); // shape only; caller independently verifies this fresh same-actor Session.
    noMutations(h);
  });
}

for (const change of [
  'RECORDED',
  'OUTCOME_UNKNOWN',
  'UNRESOLVED',
  'metadata',
  'cleanup',
  'unknown-root',
  'unknown-evidence',
  'missing-audit',
  'wrong-audit',
  'extra-terminal',
  'bad-producer',
  'bad-raw',
  'bad-version',
  'other-actor',
  'other-binding',
  'getter',
  'proxy',
] as const) {
  test(`read bridge refuses ${change} safely and never upgrades it to recorded success`, async () => {
    const { h, observed, expected } = await exactRead();
    let input: unknown = JSON.parse(JSON.stringify(observed));
    let who: unknown = copy(expected);
    const r = input as Row,
      e = r.evidence as Row,
      a = e.attempt as Row;
    if (['RECORDED', 'OUTCOME_UNKNOWN', 'UNRESOLVED'].includes(change))
      r.kind = change;
    if (change === 'metadata') input = await h.inspect('METADATA');
    if (change === 'cleanup') r.cleanup = 'UNKNOWN';
    if (change === 'unknown-root') r.private = 'SYNTHETIC_PRIVATE';
    if (change === 'unknown-evidence') e.private = 'SYNTHETIC_PRIVATE';
    if (change === 'missing-audit') e.completionAudit = null;
    if (change === 'wrong-audit') (e.completionAudit as Row).actorId = id(99);
    if (change === 'extra-terminal') e.terminalAudit = {};
    if (change === 'bad-producer')
      ((a.completion as Row).producer as Row).ownerId = uuid(99);
    if (change === 'bad-raw')
      (a.completion as Row).rawOutput = 'SYNTHETIC_PRIVATE';
    if (change === 'bad-version') a.version = 99;
    if (change === 'other-actor') who = { ...expected, actorId: id(99) };
    if (change === 'other-binding')
      who = {
        ...expected,
        binding: { ...expected.binding, sessionId: id(99) },
      };
    let observedGetter = false;
    if (change === 'getter')
      Object.defineProperty(r, 'evidence', {
        enumerable: true,
        get() {
          observedGetter = true;
          throw Error('SYNTHETIC_PRIVATE');
        },
      });
    if (change === 'proxy')
      input = new Proxy(r, {
        get() {
          observedGetter = true;
          throw Error('SYNTHETIC_PRIVATE');
        },
      });
    assert.throws(() => outlineCoordinatorRead(input, who), safeFailure);
    assert.equal(observedGetter, false);
  });
}

test('reader/bridge imports and factory remain inert, unregistered and without credentials, defaults or transaction ownership', async () => {
  const names = mongoose.modelNames().slice(),
    state = mongoose.connection.readyState;
  await import('../src/modules/ai/curriculum-outline-evidence.reader.js');
  assert.deepEqual(mongoose.modelNames(), names);
  assert.equal(mongoose.connection.readyState, state);
  const h = readerFixture();
  assert.equal(h.calls.length, 0);
  createOutlineEvidenceReader(h.ports);
  assert.equal(h.calls.length, 0);
  const source = fs.readFileSync(
    new URL(
      '../src/modules/ai/curriculum-outline-evidence.reader.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\.(?:connect|createCollection|createIndex|startSession|startTransaction|commitTransaction|abortTransaction|endSession|insertOne|updateOne|deleteOne|watch)\s*\(/,
  );
  assert.doesNotMatch(
    source,
    /config\/database|audit\/audit.model|process\.env|Date\.now\(/,
  );
});

test('read bridge and derived claim proof satisfy the delivered coordinator inspection parser without invocation', async () => {
  const { h, expected } = await exactRead();
  const nativeRead = readerFixture();
  nativeRead.claim();
  let calls = 0;
  const producer = createCurriculumOutlineProducer(
    {
      attempt: h.prepared,
      command: h.command,
      expectedVersion: 1,
      claimId: uuid(3),
      ownerId: uuid(4),
    },
    {
      clock: h.clock,
      loss: h.loss.signal,
      authority: {
        async check(_binding, _stage, sessionId) {
          return {
            actorId: id(3),
            sessionId,
            attemptId: id(8),
            bindingDigest: h.prepared.bindingDigest,
            currentAdmin: true,
            sourceAdmitted: true,
            controlsCurrent: false,
            technologyStatus: 'DRAFT',
            brief: h.brief,
            proposal: h.proposal,
            quote: h.rows.aiUsageOperations![0]!.quote,
          };
        },
      },
      ledger: {
        async claimDispatch() {
          calls++;
          throw Error('No mutation permitted');
        },
        async readClaim() {
          // A separate caller-supplied synthetic snapshot, not a revived
          // session already ended by the attempt repository's read.
          const proof = await nativeRead.reader.read(
            nativeRead.input('EVIDENCE'),
          );
          return proof.claimProof;
        },
      },
      attempts: {
        async mark() {
          calls++;
          throw Error('No mutation permitted');
        },
        async capture() {
          calls++;
          throw Error('No mutation permitted');
        },
        async read() {
          return outlineCoordinatorRead(await h.inspect(), expected);
        },
      },
      executor: {
        async execute() {
          calls++;
          throw Error('No provider permitted');
        },
      },
    },
  );
  assert.equal(
    (
      await producer.inspect(
        { actorId: id(3), sessionId: id(11) },
        h.stop.signal,
      )
    ).kind,
    'COMPLETION_RECORDED',
  );
  assert.equal((await producer.run(h.stop.signal)).kind, 'UNRESOLVED');
  assert.equal(calls, 0);
  nativeRead.state.active = false;
});

for (const terminal of ['ADMITTED', 'REFUSED'] as const)
  test(`strict read bridge validates synthetic ${terminal} terminal receipt, audit and candidate linkage`, async () => {
    const { h, expected } = await exactRead(
      terminal === 'ADMITTED' ? 'COMPLETION_STORED' : 'INVOCATION_MARKED',
    );
    const row = h.rows.curriculumOutlineAttempts![0]!;
    const metadata = {
      attemptId: oid(8),
      technologyId: oid(2),
      operationId: uuid(2),
      attemptVersion: terminal === 'ADMITTED' ? 3 : 2,
      bindingDigest: h.prepared.bindingDigest,
      outlineId: oid(7),
      outlineRevisionId: oid(6),
      revision: 1,
      ...(terminal === 'REFUSED' ? { safeCode: 'OUTPUT_INVALID' } : {}),
    };
    let candidate: ReturnType<typeof validateOutlineCandidate> | undefined;
    if (terminal === 'ADMITTED') {
      const c = h.completion(),
        body = JSON.parse(c.rawOutput) as Row;
      const validated = validateCurriculumOutline(
        JSON.stringify({
          schemaVersion: 1,
          technologyId: id(2),
          source: h.binding.brief,
          ...body,
        }),
        h.brief,
      );
      assert.ok(validated.ok);
      const definition = {
        _id: id(6),
        outlineId: id(7),
        schemaVersion: 1,
        revision: 1,
        origin: 'AI_GENERATED',
        outline: validated.outline,
        proposal: h.binding.proposal,
        createdBy: id(3),
        createdAt: c.createdAt,
        producer: c.producer,
        contentDigest: outlineContentDigest(validated.outline),
      };
      candidate = validateOutlineCandidate({
        ...definition,
        definitionDigest: outlineDefinitionDigest(definition),
      });
      h.rows.curriculumOutlineCandidates!.push({
        ...candidate,
        _id: oid(6),
        outlineId: oid(7),
        createdBy: oid(3),
        createdAt: new Date(candidate.createdAt),
        proposal: { ...candidate.proposal, id: oid(4), proposalId: oid(1) },
        producer: {
          ...candidate.producer,
          attemptId: oid(8),
          ledgerOperationId: oid(9),
          completedAt: new Date(candidate.producer.completedAt),
        },
      });
    }
    row.phase = terminal;
    row.version = metadata.attemptVersion;
    row.receipt =
      terminal === 'ADMITTED'
        ? {
            kind: 'COMMITTED',
            candidateId: oid(6),
            revision: 1,
            definitionDigest: candidate!.definitionDigest,
            auditId: oid(12),
          }
        : { kind: 'REFUSED', code: 'OUTPUT_INVALID', auditId: oid(12) };
    h.rows.auditLogs!.push({
      _id: oid(12),
      category: 'CONTENT_MANAGEMENT',
      action:
        terminal === 'ADMITTED'
          ? 'CURRICULUM_OUTLINE_ADMITTED'
          : 'CURRICULUM_OUTLINE_ADMISSION_REFUSED',
      actorId: oid(3),
      resourceType: 'CURRICULUM_OUTLINE_ATTEMPT',
      resourceId: oid(8),
      requestId: 'synthetic-terminal',
      createdAt: new Date(base + 2),
      metadata,
    });
    const found = (await h.inspect()) as Row;
    assert.equal(found.kind, 'OBSERVED', JSON.stringify(found));
    assert.equal((found.evidence as Row).kind, 'EXACT');
    assert.equal(
      h.calls.some(
        (c) => c.name.endsWith(':insert') || c.name.endsWith(':update'),
      ),
      false,
    );
    const reads = h.calls.length;
    const projection = outlineCoordinatorRead(found, expected);
    assert.equal(projection.attempt.phase, terminal);
    assert.equal(Object.hasOwn(projection, 'kind'), false);
    assert.equal(Object.isFrozen(projection), true);
    assert.equal(h.calls.length, reads);
    const malformed = JSON.parse(JSON.stringify(found)) as Row;
    ((malformed.evidence as Row).terminalAudit as Row).actorId = id(99);
    assert.throws(
      () => outlineCoordinatorRead(malformed, expected),
      safeFailure,
    );
    if (terminal === 'ADMITTED')
      h.rows.curriculumOutlineCandidates![0]!.definitionDigest = 'f'.repeat(64);
    else
      h.rows.curriculumOutlineCandidates!.push({
        _id: oid(6),
        'producer.attemptId': oid(8),
      });
    const unavailable = await h.inspect();
    assert.equal((unavailable as Row).kind, 'UNRESOLVED');
    assert.throws(
      () => outlineCoordinatorRead(unavailable, expected),
      safeFailure,
    );
  });

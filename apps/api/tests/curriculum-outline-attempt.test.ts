import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import mongoose, { Types } from 'mongoose';
import type { Db, MongoClient } from 'mongodb';
import {
  createOutlineAttemptRepository,
  encodeOutlineAttempt,
  decodeOutlineAttempt,
  encodeOutlineAttemptBinding,
  outlineAttemptRequiredIndexes,
  assertOutlineAttemptIndexes,
  validateOutlineAttemptAudit,
  outlineAttemptAuditActions,
  type OutlineAttemptDependencies,
} from '../src/modules/ai/curriculum-outline-attempt.repository.js';
import {
  outlineAttemptBindingDigest,
  outlineCheckpointDigest,
  parseOutlineAttempt,
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
import { outlineCoordinatorRead } from '../src/modules/ai/curriculum-outline-evidence.reader.js';

const id = (n: number) => n.toString(16).padStart(24, '0'),
  oid = (n: number) => new Types.ObjectId(id(n));
const uuid = (n: number) =>
  `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
const base = Date.parse('2026-11-08T00:00:00.000Z'),
  iso = (n: number) => new Date(base + n).toISOString();
const hash = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v), 'utf8').digest('hex');
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

test('native/canonical codec preserves exact independent binding frame and refuses coercion', () => {
  const h = fixture(),
    b = h.binding;
  assert.equal(
    h.prepared.bindingDigest,
    hash([
      'F054_OUTLINE_ATTEMPT',
      1,
      b._id,
      b.scope,
      b.actorId,
      b.sessionId,
      b.operationId,
      b.technologyId,
      [b.brief.id, 1, b.brief.digest],
      [b.proposal.id, b.proposal.proposalId, 1, b.proposal.digest],
      b.ledgerOperationId,
      b.ledgerIntentFingerprint,
      b.intentDigest,
      b.requestDigest,
      b.templateVersion,
      b.quoteDigest,
      b.outlineRevisionId,
      b.outlineId,
      b.terminalAuditId,
      b.completionAuditId,
      b.createdAt,
    ]),
  );
  assert.deepEqual(
    decodeOutlineAttempt(encodeOutlineAttempt(h.prepared)),
    parseOutlineAttempt(h.prepared),
  );
  for (const key of [
    '_id',
    'actorId',
    'sessionId',
    'technologyId',
    'ledgerOperationId',
    'outlineRevisionId',
    'outlineId',
    'terminalAuditId',
    'completionAuditId',
  ]) {
    const row: Row = encodeOutlineAttempt(h.prepared);
    row[key] = id(3);
    assert.throws(() => decodeOutlineAttempt(row));
  }
  const row: Row = encodeOutlineAttempt(h.prepared);
  row.createdAt = iso(0);
  assert.throws(() => decodeOutlineAttempt(row));
});
test('prepare, mark, capture and exact recovery construct one-session atomic effects without replay', async () => {
  const h = fixture();
  const first = (await h.repository.prepare(h.prepared, h.work)) as Row;
  assert.equal(
    first.kind,
    'RECORDED',
    JSON.stringify({ first, calls: h.calls.map((x) => x.name) }),
  );
  h.claim();
  const marked = (await h.mark()) as Row;
  assert.equal(
    marked.kind,
    'RECORDED',
    JSON.stringify({ marked, calls: h.calls.map((x) => x.name) }),
  );
  assert.equal(((await h.capture()) as Row).kind, 'RECORDED');
  const before = h.rows.auditLogs!.length;
  const recovered = (await h.inspect()) as Row;
  assert.equal(recovered.kind, 'OBSERVED');
  assert.equal((recovered.evidence as Row).kind, 'EXACT');
  assert.equal(h.rows.auditLogs!.length, before);
  const duplicate = (await h.capture()) as Row;
  assert.equal(duplicate.kind, 'OBSERVED');
  assert.equal(h.rows.auditLogs!.length, before);
  assert.equal(h.calls.filter((x) => x.name === 'commit').length, 3);
  for (const call of h.calls.filter((x) => x.options?.session))
    assert.equal(call.options!.session, h.session);
  for (const call of h.calls.filter(
    (x) => x.name === 'commit' || x.name === 'abort' || x.name === 'end',
  ))
    assert.ok(
      Number(call.options!.timeoutMS) > 0 &&
        Number(call.options!.timeoutMS) <= 2000,
    );
});

async function ready(
  phase: 'PREPARED' | 'INVOCATION_MARKED' | 'COMPLETION_STORED' = 'PREPARED',
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
  h.calls.length = 0;
  return h;
}
const mutations = (h: ReturnType<typeof fixture>) =>
  h.calls.filter(
    (c) => c.name.endsWith(':insert') || c.name.endsWith(':update'),
  );
for (const phase of [
  'PREPARED',
  'INVOCATION_MARKED',
  'COMPLETION_STORED',
] as const)
  test(`CANCEL ${phase} preserves raw evidence, permits fresh same-actor sid and recovers sticky history`, async () => {
    const h = await ready(phase),
      before = copy(h.rows.curriculumOutlineAttempts![0]!);
    h.rows.sessions!.push({
      _id: oid(90),
      userId: oid(3),
      revokedAt: null,
      expiresAt: new Date(base + 60000),
      __v: 0,
    });
    h.auth.sid = id(90);
    h.deps.requestingSessionId = id(90);
    if (phase === 'COMPLETION_STORED')
      Object.defineProperty(
        h.rows.curriculumOutlineAttempts![0]!.completion,
        'rawOutput',
        { enumerable: true, get: badGetter },
      );
    h.rows.technologies = []; // Parent loss must not force raw access or financial dispatch.
    const result = (await h.repository.cancel(
      { binding: h.binding, expectedVersion: before.version },
      h.work,
    )) as Row;
    assert.equal(result.kind, 'RECORDED', JSON.stringify(result));
    assert.equal(
      (result.metadata as Row).hasCompletion,
      phase === 'COMPLETION_STORED',
    );
    assert.equal(
      h.calls.some(
        (c) =>
          c.name === 'technologies:read' ||
          c.name === 'command' ||
          c.name === 'aiUsageOperations:read',
      ),
      false,
    );
    for (const call of h.calls.filter(
      (c) => c.name === 'curriculumOutlineAttempts:read',
    )) {
      const projection = call.options!.projection as Row;
      assert.equal(Object.hasOwn(projection, 'completion'), false);
      assert.equal(
        Object.keys(projection).some((k) => k.includes('rawOutput')),
        false,
      );
    }
    const update = h.calls.find(
      (c) => c.name === 'curriculumOutlineAttempts:update',
    )!;
    assert.deepEqual(Object.keys(update.update!.$set as object), [
      'cancelledAt',
    ]);
    assert.deepEqual(update.update!.$inc, { version: 1 });
    assert.equal(h.rows.curriculumOutlineAttempts![0]!.phase, before.phase);
    h.calls.length = 0;
    const found = (await h.inspect('METADATA')) as Row;
    assert.equal(found.kind, 'OBSERVED', JSON.stringify(found));
    assert.equal(mutations(h).length, 0);
    const duplicate = (await h.repository.cancel(
      { binding: h.binding, expectedVersion: before.version },
      h.work,
    )) as Row;
    assert.equal(duplicate.kind, 'OBSERVED');
    assert.equal(mutations(h).length, 0);
  });

test('CANCEL first defeats CAPTURE without releasing ledger liabilities or writing a failure audit', async () => {
  const h = await ready('INVOCATION_MARKED');
  const op = copy(h.rows.aiUsageOperations![0]!);
  assert.equal(
    (
      (await h.repository.cancel(
        { binding: h.binding, expectedVersion: 1 },
        h.work,
      )) as Row
    ).kind,
    'RECORDED',
  );
  h.calls.length = 0;
  const result = (await h.capture()) as Row;
  assert.equal(result.kind, 'REFUSED');
  assert.equal(result.code, 'STATE_CONFLICT');
  assert.equal(mutations(h).length, 0);
  assert.deepEqual(h.rows.aiUsageOperations![0], op);
});

test('full CAS contains every immutable binding leaf and present-null predicates, not digest alone', async () => {
  const h = await ready();
  h.claim();
  assert.equal(((await h.mark()) as Row).kind, 'RECORDED');
  const call = h.calls.find(
    (c) => c.name === 'curriculumOutlineAttempts:update',
  )!;
  const filter = call.filter!,
    native = encodeOutlineAttemptBinding(h.binding);
  for (const [key, v] of Object.entries(native)) {
    if (key === 'brief' || key === 'proposal')
      for (const [child, x] of Object.entries(v as object))
        assert.deepEqual(filter[key + '.' + child], x);
    else assert.deepEqual(filter[key], v);
  }
  for (const key of ['invocation', 'completion', 'receipt', 'cancelledAt'])
    assert.deepEqual(filter[key], { $eq: null, $exists: true });
  assert.deepEqual(call.update!.$set, {
    invocation: {
      ...h.invocation,
      claimedAt: new Date(h.invocation.claimedAt),
      observeUntil: new Date(h.invocation.observeUntil),
      markedAt: new Date(h.invocation.markedAt),
    },
    phase: 'INVOCATION_MARKED',
  });
  assert.equal(call.options!.upsert, false);
});

for (const change of [
  'binding',
  'version',
  'cancelled',
  'missing-null',
  'raw',
  'audit',
  'missing-audit',
  'duplicate-audit',
  'extra-audit',
] as const)
  test(`exact recovery refuses ${change} without repair or replay`, async () => {
    const h = await ready('COMPLETION_STORED'),
      a = h.rows.curriculumOutlineAttempts![0]!;
    if (change === 'binding') a.requestDigest = 'f'.repeat(64);
    if (change === 'version') a.version = 4;
    if (change === 'cancelled') a.cancelledAt = new Date(base);
    if (change === 'missing-null') delete a.receipt;
    if (change === 'raw') (a.completion as Row).rawOutput = '{}';
    if (change === 'audit')
      (
        h.rows.auditLogs!.find(
          (e) => e.action === 'CURRICULUM_OUTLINE_COMPLETION_STORED',
        )!.metadata as Row
      ).checkpointDigest = 'b'.repeat(64);
    if (change === 'missing-audit')
      h.rows.auditLogs = h.rows.auditLogs!.filter(
        (e) => e.action !== 'CURRICULUM_OUTLINE_COMPLETION_STORED',
      );
    if (change === 'duplicate-audit')
      h.rows.auditLogs!.push(
        copy(
          h.rows.auditLogs!.find(
            (e) => e.action === 'CURRICULUM_OUTLINE_COMPLETION_STORED',
          )!,
        ),
      );
    if (change === 'extra-audit') {
      const e = copy(
        h.rows.auditLogs!.find(
          (e) => e.action === 'CURRICULUM_OUTLINE_COMPLETION_STORED',
        )!,
      );
      (e.metadata as Row).attemptVersion = 99;
      h.rows.auditLogs!.push(e);
    }
    const result = (await h.inspect()) as Row;
    assert.equal(result.kind, 'UNRESOLVED', JSON.stringify(result));
    assert.equal(mutations(h).length, 0);
    assert.equal(h.calls.filter((c) => c.name === 'commit').length, 0);
  });

for (const field of [
  'id',
  'actorId',
  'attemptId',
  'technologyId',
  'digest',
  'createdAt',
] as const)
  test(`duplicate CAPTURE rejects altered supplied audit ${field}`, async () => {
    const h = await ready('COMPLETION_STORED'),
      c = h.completion();
    const audit: Row = {
      id: id(13),
      action: 'CURRICULUM_OUTLINE_COMPLETION_STORED',
      actorId: id(3),
      attemptId: id(8),
      technologyId: id(2),
      operationId: uuid(2),
      digest: c.checkpointDigest,
      createdAt: c.createdAt,
    };
    audit[field] =
      field === 'digest'
        ? 'b'.repeat(64)
        : field === 'createdAt'
          ? iso(3)
          : id(99);
    const result = (await h.repository.capture(
      {
        binding: h.binding,
        expectedVersion: 1,
        invocation: h.invocation,
        completion: c,
        audit,
      },
      h.work,
    )) as Row;
    assert.equal(result.kind, 'UNRESOLVED');
    assert.equal((result.primary as Row).code, 'OPERATION_CONFLICT');
    assert.equal(mutations(h).length, 0);
  });

for (const badField of [
  'lastAudit',
  'dispatch-profile',
  'dispatch-cost',
  'source-audit',
  'parent',
  'source-content',
] as const)
  test(`source/current/historical native proof refuses ${badField}`, async () => {
    const h = await ready();
    h.claim();
    if (badField === 'lastAudit')
      h.rows.auditLogs = h.rows.auditLogs!.filter(
        (e) => !(e._id as Types.ObjectId).equals(oid(15)),
      );
    if (badField === 'dispatch-profile')
      (
        h.rows.auditLogs!.find((e) => e.action === 'AI_USAGE_DISPATCH_CLAIMED')!
          .metadata as Row
      ).profileVersion = uuid(99);
    if (badField === 'dispatch-cost')
      (
        h.rows.auditLogs!.find((e) => e.action === 'AI_USAGE_DISPATCH_CLAIMED')!
          .metadata as Row
      ).reservedPaise = '2';
    if (badField === 'source-audit')
      h.rows.auditLogs!.find(
        (e) => e.action === 'CURRICULUM_BRIEF_ADMITTED',
      )!.actorId = oid(99);
    if (badField === 'parent') h.rows.technologies![0]!.status = 'ARCHIVED';
    if (badField === 'source-content')
      h.rows.curriculumBriefRevisions![0]!.title = 'Changed synthetic title';
    const result = (await h.mark()) as Row;
    assert.notEqual(result.kind, 'RECORDED');
    assert.equal(mutations(h).length, 0);
    assert.equal(h.calls.filter((c) => c.name === 'commit').length, 0);
  });

for (const boundary of [
  'users:update',
  'sessions:update',
  'curriculumOutlineAttempts:insert',
  'auditLogs:insert',
  'commit',
] as const)
  test(`failure at ${boundary} preserves primary and refuses partial success`, async () => {
    const h = fixture();
    h.state.hook = async (name) => {
      if (name === boundary) throw new Error('SYNTHETIC_PRIVATE');
    };
    const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
    assert.equal(result.kind, 'OUTCOME_UNKNOWN');
    assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE'), false);
    assert.equal(
      (result.primary as Row).stage,
      boundary === 'users:update'
        ? 'FENCE_USER'
        : boundary === 'sessions:update'
          ? 'FENCE_SESSION'
          : boundary === 'curriculumOutlineAttempts:insert'
            ? 'ATTEMPT'
            : boundary === 'auditLogs:insert'
              ? 'AUDIT'
              : 'COMMIT',
    );
    assert.ok(h.calls.some((c) => c.name === 'end'));
    assert.equal(h.state.ended, true);
    if (boundary !== 'commit') {
      assert.ok((result.cleanup as string[]).includes('ABORT_UNCONFIRMED'));
      assert.equal(h.rows.curriculumOutlineAttempts!.length, 0);
    }
  });

for (const issue of ['abort', 'end', 'not-ended', 'abort-getter'] as const)
  test(`cleanup ${issue} attempts disposal and retains original audit failure`, async () => {
    const h = fixture();
    h.state.hook = async (name) => {
      if (name === 'auditLogs:insert') {
        if (issue === 'abort-getter')
          h.session.inTransaction = () => {
            throw new Error('SYNTHETIC_PRIVATE');
          };
        throw new Error('SYNTHETIC_PRIVATE');
      }
    };
    h.state.abortFail = issue === 'abort';
    h.state.endFail = issue === 'end';
    h.state.notEnded = issue === 'not-ended';
    const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
    assert.equal(result.kind, 'OUTCOME_UNKNOWN');
    assert.equal((result.primary as Row).stage, 'AUDIT');
    assert.ok(h.calls.some((c) => c.name === 'end'));
    assert.ok(
      (result.cleanup as string[]).includes(
        issue === 'abort' || issue === 'abort-getter'
          ? 'ABORT'
          : issue === 'end'
            ? 'END_SESSION'
            : 'NOT_ENDED',
      ),
    );
  });

for (const boundary of [
  'verify',
  'users:read',
  'users:update',
  'sessions:update',
  'curriculumOutlineAttempts:insert',
  'auditLogs:insert',
  'commit',
] as const)
  test(`expiry at ${boundary} stops business effects; cleanup has positive independent bounds`, async () => {
    const h = fixture();
    let expired = false;
    h.state.hook = async (name) => {
      if (name === boundary && !expired) {
        expired = true;
        h.advance(10000);
      }
    };
    const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
    assert.notEqual(result.kind, 'RECORDED');
    const at = h.calls.findIndex((c) => c.name === boundary);
    assert.ok(at >= 0);
    assert.equal(
      h.calls
        .slice(at + 1)
        .some((c) => c.name.endsWith(':insert') || c.name.endsWith(':update')),
      false,
    );
    for (const c of h.calls.filter(
      (c) => c.name === 'abort' || c.name === 'end',
    ))
      assert.deepEqual(c.options, { timeoutMS: 2000 });
    assert.equal(h.timers.size, 0);
  });

test('late write ACK cannot become original success or resume attempt/audit writes', async () => {
  const h = fixture();
  let arrived!: () => void, release!: () => void;
  const reached = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  h.state.hook = async (name) => {
    if (name === 'users:update') {
      arrived();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
  };
  const pending = h.repository.prepare(h.prepared, h.work);
  await Promise.race([
    reached,
    pending.then(() =>
      assert.fail('prepare finished before the retained-write boundary'),
    ),
  ]);
  h.advance(10000);
  const result = (await pending) as Row;
  assert.equal(result.kind, 'OUTCOME_UNKNOWN');
  const count = h.calls.length;
  release();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(h.calls.length, count);
  assert.equal(
    h.calls.some((c) => c.name === 'curriculumOutlineAttempts:insert'),
    false,
  );
});

test('codec/projection/registration is inert and index declarations never create resources', async () => {
  const names = mongoose.modelNames().slice(),
    state = mongoose.connection.readyState;
  await import('../src/modules/ai/curriculum-outline-attempt.repository.js');
  assert.deepEqual(mongoose.modelNames(), names);
  assert.equal(mongoose.connection.readyState, state);
  const source = fs.readFileSync(
    new URL(
      '../src/modules/ai/curriculum-outline-attempt.repository.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\.(?:connect|createCollection|createIndex|createIndexes|withTransaction|watch|deleteOne|deleteMany)\s*\(/,
  );
  assert.doesNotMatch(
    source,
    /config\/database|audit\/audit.model|process\.env|Date\.now\(/,
  );
  assert.equal(outlineAttemptRequiredIndexes.length, 7);
  assert.equal(
    outlineAttemptRequiredIndexes.filter((x) => x.collection === 'auditLogs')
      .length,
    1,
  );
  const h = fixture();
  for (const collection of [
    'curriculumOutlineCandidates',
    'curriculumOutlineAttempts',
    'auditLogs',
    'users',
    'sessions',
  ])
    assertOutlineAttemptIndexes(collection, h.indexes(collection));
  for (const patch of [
    { unique: false },
    { hidden: true },
    { sparse: true },
    { expireAfterSeconds: 60 },
    { collation: { locale: 'en' } },
    { partialFilterExpression: { other: true } },
  ]) {
    const rows = h.indexes('auditLogs');
    const n = rows.findIndex(
      (r) => r.name === 'uq_outline_attempt_audit_version',
    );
    rows[n] = { ...rows[n], ...patch } as (typeof rows)[number];
    assert.throws(() => assertOutlineAttemptIndexes('auditLogs', rows));
  }
});

for (const where of [
  'claimed-before-create',
  'marked-before-claim',
  'marked-after-observe',
  'capture-before-marker',
  'cancel-before-capture',
] as const)
  test(`metadata-only cancellation rejects impossible ${where} timing without reading raw output`, async () => {
    const h = await ready('COMPLETION_STORED'),
      row = h.rows.curriculumOutlineAttempts![0]!,
      i = row.invocation as Row;
    if (where === 'claimed-before-create') i.claimedAt = new Date(base - 1);
    if (where === 'marked-before-claim') i.markedAt = new Date(base);
    if (where === 'marked-after-observe') i.markedAt = new Date(base + 20000);
    if (where === 'capture-before-marker')
      (row.completion as Row).createdAt = new Date(base);
    if (where === 'cancel-before-capture') {
      row.cancelledAt = new Date(base);
      row.version = 3;
    }
    const result = (await h.repository.cancel(
      { binding: h.binding, expectedVersion: 2 },
      h.work,
    )) as Row;
    assert.equal(result.kind, 'UNRESOLVED');
    assert.equal(mutations(h).length, 0);
  });

test('current accounting may advance while immutable dispatch proof remains separately validated', async () => {
  const h = await ready('INVOCATION_MARKED'),
    op = h.rows.aiUsageOperations![0]!;
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
  const result = (await h.capture()) as Row;
  assert.equal(result.kind, 'RECORDED', JSON.stringify(result));
  assert.equal(((await h.inspect()) as Row).kind, 'OBSERVED');
  const dispatch = h.rows.auditLogs!.find(
    (e) => e.action === 'AI_USAGE_DISPATCH_CLAIMED',
  )!;
  (dispatch.metadata as Row).policyVersion = uuid(99);
  assert.equal(((await h.inspect()) as Row).kind, 'UNRESOLVED');
});

test('historical source admission does not require the absent source author to remain current Admin', async () => {
  const h = fixture();
  assert.equal(h.brief.createdBy, id(30));
  assert.equal(
    h.rows.users!.some((r) => (r._id as Types.ObjectId).equals(oid(30))),
    false,
  );
  assert.equal(
    ((await h.repository.prepare(h.prepared, h.work)) as Row).kind,
    'RECORDED',
  );
  assert.equal(
    h.calls.some(
      (c) => c.name === 'users:read' && equal(c.filter!._id, oid(30)),
    ),
    false,
  );
});

for (const which of [
  'actor',
  'sid',
  'role',
  'revoked',
  'expired',
  'missing',
  'version',
  'inactive',
] as const)
  test(`current authorization ${which} cannot be replaced by historical source authority`, async () => {
    const h = fixture();
    if (which === 'actor') h.auth.sub = id(99);
    if (which === 'sid') h.auth.sid = id(99);
    if (which === 'role') h.auth.role = 'STUDENT';
    if (which === 'revoked') h.rows.sessions![0]!.revokedAt = new Date(base);
    if (which === 'expired') h.rows.sessions![0]!.expiresAt = new Date(base);
    if (which === 'missing') h.rows.sessions = [];
    if (which === 'version') delete h.rows.users![0]!.__v;
    if (which === 'inactive') h.rows.users![0]!.status = 'DISABLED';
    const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
    assert.notEqual(result.kind, 'RECORDED');
    assert.equal(mutations(h).length, 0);
  });

for (const key of [
  'acknowledged',
  'matchedCount',
  'modifiedCount',
  'upsertedCount',
  'upsertedId',
])
  test(`strict conditional acknowledgement ${key} cannot become known success`, async () => {
    const h = fixture();
    h.state.writeAck = {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: null,
      [key]: undefined,
    };
    const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
    assert.equal(result.kind, 'OUTCOME_UNKNOWN');
    assert.equal(
      h.calls.some((c) => c.name === 'curriculumOutlineAttempts:insert'),
      false,
    );
  });
for (const ack of [
  { acknowledged: false, insertedId: oid(8) },
  { acknowledged: true, insertedId: oid(99) },
  { acknowledged: true },
  { acknowledged: true, insertedId: oid(8), private: 'SYNTHETIC_PRIVATE' },
])
  test('exact insert identity/acknowledgement required; malformed returned fields stay private', async () => {
    const h = fixture();
    h.state.insertAck = ack;
    const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
    assert.equal(result.kind, 'OUTCOME_UNKNOWN');
    assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE'), false);
    assert.equal(
      h.calls.some((c) => c.name === 'commit'),
      false,
    );
  });

test('unknown CAS after User fence is not assumed rollback and cannot be automatically retried', async () => {
  const h = await ready();
  h.claim();
  h.state.hook = async (name) => {
    if (name === 'sessions:update')
      h.rows.curriculumOutlineAttempts![0]!.version = 9;
  };
  const result = (await h.mark()) as Row;
  assert.equal(result.kind, 'OUTCOME_UNKNOWN');
  h.state.hook = async () => {};
  h.calls.length = 0;
  const second = (await h.mark()) as Row;
  assert.notEqual(second.kind, 'RECORDED');
  assert.equal(mutations(h).length, 0);
});

test('separate cleanup allowances remain positive after failure/expiry and disposal follows abort failure', async () => {
  const h = fixture();
  h.state.hook = async (name) => {
    if (name === 'auditLogs:insert') throw new Error('SYNTHETIC_PRIVATE');
    if (name === 'abort') {
      h.advance(10000);
      throw new Error('SYNTHETIC_PRIVATE');
    }
  };
  const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
  assert.equal(result.kind, 'OUTCOME_UNKNOWN');
  assert.equal((result.primary as Row).stage, 'AUDIT');
  assert.ok((result.cleanup as string[]).includes('ABORT'));
  assert.ok(h.calls.some((c) => c.name === 'end'));
  assert.equal(h.calls.find((c) => c.name === 'end')!.options!.timeoutMS, 2000);
});

for (const phase of [
  'PREPARED',
  'INVOCATION_MARKED',
  'COMPLETION_STORED',
] as const)
  test(`duplicate prepare at ${phase} observes history without fencing or inventing an invocation ACK`, async () => {
    const h = await ready(phase);
    const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
    assert.equal(result.kind, 'OBSERVED');
    assert.equal(mutations(h).length, 0);
    assert.equal(
      h.calls.some((c) => c.name === 'commit'),
      false,
    );
  });

for (const field of [
  '_id',
  'actorId',
  'sessionId',
  'operationId',
  'technologyId',
  'ledgerOperationId',
  'templateVersion',
  'quoteDigest',
  'outlineRevisionId',
  'outlineId',
  'terminalAuditId',
  'completionAuditId',
  'createdAt',
] as const)
  test(`immutable command binding ${field} conflict refuses without upsert or replacement`, async () => {
    const h = await ready();
    h.claim();
    const binding = {
      ...h.binding,
      [field]:
        field === 'createdAt'
          ? iso(1)
          : field === 'operationId' || field === 'templateVersion'
            ? uuid(99)
            : field === 'quoteDigest'
              ? 'b'.repeat(64)
              : id(99),
    };
    const result = (await h.repository.mark(
      { binding, expectedVersion: 0, invocation: h.invocation },
      h.work,
    )) as Row;
    assert.notEqual(result.kind, 'RECORDED');
    assert.equal(mutations(h).length, 0);
  });

for (const action of outlineAttemptAuditActions)
  test(`native ${action} audit tuple rejects cross-action/private fields and identities`, () => {
    const terminal =
      action === 'CURRICULUM_OUTLINE_ADMITTED' ||
      action === 'CURRICULUM_OUTLINE_ADMISSION_REFUSED';
    const metadata: Row = {
      attemptId: oid(8),
      technologyId: oid(2),
      operationId: uuid(2),
      attemptVersion:
        action === 'CURRICULUM_OUTLINE_PREPARED'
          ? 0
          : action === 'CURRICULUM_OUTLINE_INVOCATION_MARKED'
            ? 1
            : action === 'CURRICULUM_OUTLINE_ADMITTED'
              ? 3
              : 2,
      bindingDigest: 'a'.repeat(64),
      ...(action === 'CURRICULUM_OUTLINE_COMPLETION_STORED'
        ? { checkpointDigest: 'b'.repeat(64) }
        : {}),
      ...(terminal
        ? { outlineId: oid(7), outlineRevisionId: oid(6), revision: 1 }
        : {}),
      ...(action === 'CURRICULUM_OUTLINE_ADMISSION_REFUSED'
        ? { safeCode: 'OUTPUT_INVALID' }
        : {}),
    };
    const event = {
      _id: oid(100),
      category: 'CONTENT_MANAGEMENT',
      action,
      actorId: oid(3),
      resourceType: 'CURRICULUM_OUTLINE_ATTEMPT',
      resourceId: oid(8),
      requestId: 'synthetic',
      metadata,
      createdAt: new Date(base),
    };
    validateOutlineAttemptAudit(event);
    for (const key of [
      'rawOutput',
      'prompt',
      'source',
      'sessionId',
      'claimId',
      'ownerId',
      'provider',
      'token',
    ])
      assert.throws(() =>
        validateOutlineAttemptAudit({
          ...event,
          metadata: { ...metadata, [key]: 'SYNTHETIC_PRIVATE' },
        }),
      );
    for (const key of ['_id', 'actorId', 'resourceId'])
      assert.throws(() =>
        validateOutlineAttemptAudit({ ...event, [key]: id(8) }),
      );
    assert.throws(() =>
      validateOutlineAttemptAudit({ ...event, requestId: 'x'.repeat(129) }),
    );
    assert.throws(() =>
      validateOutlineAttemptAudit({
        ...event,
        metadata: { ...metadata, attemptVersion: 99 },
      }),
    );
  });

for (const terminal of ['ADMITTED', 'REFUSED'] as const)
  test(`terminal ${terminal} exact evidence is inspectable; CANCEL remains a no-write observation`, async () => {
    const h = await ready(
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
    assert.equal(mutations(h).length, 0);
    const cancelled = (await h.repository.cancel(
      { binding: h.binding, expectedVersion: row.version },
      h.work,
    )) as Row;
    assert.equal(cancelled.kind, 'OBSERVED');
    assert.equal(mutations(h).length, 0);
    if (terminal === 'ADMITTED')
      h.rows.curriculumOutlineCandidates![0]!.definitionDigest = 'f'.repeat(64);
    else
      h.rows.curriculumOutlineCandidates!.push({
        _id: oid(6),
        'producer.attemptId': oid(8),
      });
    assert.equal(((await h.inspect()) as Row).kind, 'UNRESOLVED');
  });

for (const mutation of [
  'operator',
  'unknown',
  'getter',
  'missing-null',
  'native-source-string',
  'native-family-string',
  'bad-date',
  'overflow',
  'wrong-phase',
] as const)
  test(`strict native row refuses ${mutation} without getters or repair`, () => {
    const h = fixture(),
      row: Row = encodeOutlineAttempt(h.prepared);
    if (mutation === 'operator') row.$where = 'SYNTHETIC_PRIVATE';
    if (mutation === 'unknown') row.extra = true;
    if (mutation === 'getter')
      Object.defineProperty(row, 'actorId', {
        enumerable: true,
        get: badGetter,
      });
    if (mutation === 'missing-null') delete row.cancelledAt;
    if (mutation === 'native-source-string') (row.brief as Row).id = id(1);
    if (mutation === 'native-family-string')
      (row.proposal as Row).proposalId = id(1);
    if (mutation === 'bad-date') row.createdAt = new Date(NaN);
    if (mutation === 'overflow') row.version = Number.MAX_SAFE_INTEGER;
    if (mutation === 'wrong-phase') row.phase = 'UNKNOWN';
    assert.throws(() => decodeOutlineAttempt(row));
  });

test('raw UTF-8 ceiling remains65536 without imposing a new escaped-JSON128KiB cap', () => {
  const h = fixture(),
    c = h.completion();
  c.rawOutput = '\0'.repeat(65536);
  c.producer.rawOutputDigest = outlineRawOutputDigest(c.rawOutput);
  const { completionDigest: ignored, ...fields } = c.producer;
  void ignored;
  c.producer.completionDigest = outlineCompletionDigest(fields, id(3));
  c.checkpointDigest = outlineCheckpointDigest(h.binding, h.invocation, c);
  const row = {
    ...h.prepared,
    version: 2,
    phase: 'COMPLETION_STORED',
    invocation: h.invocation,
    completion: c,
  };
  assert.ok(Buffer.byteLength(JSON.stringify(row)) > 131072);
  assert.equal(
    (
      decodeOutlineAttempt(encodeOutlineAttempt(row)).completion as {
        rawOutput: string;
      }
    ).rawOutput,
    c.rawOutput,
  );
  c.rawOutput += 'x';
  assert.throws(() => encodeOutlineAttempt(row));
});

test('capture validates content, request and exact audit before any new fencing/write', async () => {
  const h = await ready('INVOCATION_MARKED'),
    c = h.completion();
  c.rawOutput = JSON.stringify({
    title: 'Invalid synthetic',
    modules: [],
    private: 'SYNTHETIC_PRIVATE',
  });
  const result = (await h.repository.capture(
    {
      binding: h.binding,
      expectedVersion: 1,
      invocation: h.invocation,
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
    h.work,
  )) as Row;
  assert.notEqual(result.kind, 'RECORDED');
  assert.equal(mutations(h).length, 0);
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE'), false);
});

test('loss after commit/through cleanup is never a clean originating acknowledgement', async () => {
  const h = fixture();
  h.state.hook = async (name) => {
    if (name === 'end') h.loss.abort();
  };
  const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
  assert.equal(result.kind, 'OUTCOME_UNKNOWN');
  assert.ok(h.calls.some((c) => c.name === 'commit'));
  assert.ok(h.state.ended);
});

test('failed read cleanup remains UNRESOLVED with primary null when only cleanup failed', async () => {
  const h = await ready();
  h.state.endFail = true;
  const result = (await h.inspect('METADATA')) as Row;
  assert.equal(result.kind, 'UNRESOLVED');
  assert.equal(result.primary, null);
  assert.ok((result.cleanup as string[]).includes('END_SESSION'));
  assert.equal(mutations(h).length, 0);
});

test('namespace/index absence and a mismatched client refuse before transaction/writes', async () => {
  const h = fixture();
  h.state.hook = async (name) => {
    if (name === 'indexes:curriculumOutlineAttempts')
      throw new Error('SYNTHETIC_PRIVATE');
  };
  const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
  assert.equal(result.kind, 'REFUSED');
  assert.equal(
    h.calls.some((c) => c.name === 'startSession'),
    false,
  );
  assert.equal(mutations(h).length, 0);
  const other = createOutlineAttemptRepository({
    ...h.deps,
    client: {} as MongoClient,
  });
  assert.equal(
    ((await other.prepare(h.prepared, h.work)) as Row).kind,
    'REFUSED',
  );
});

test('B delegated full evidence remains read-only and cannot convert metadata or duplicate observations to mutation ACKs', async () => {
  const h = await ready('COMPLETION_STORED');
  const exact = await h.inspect();
  const expected = {
    binding: h.binding,
    actorId: id(3),
    requestingSessionId: id(11),
  };
  const read = outlineCoordinatorRead(exact, expected);
  assert.equal(read.attempt.phase, 'COMPLETION_STORED');
  assert.equal(Object.hasOwn(read, 'kind'), false);
  assert.equal(mutations(h).length, 0);
  const metadata = await h.inspect('METADATA');
  assert.throws(() => outlineCoordinatorRead(metadata, expected));
  const duplicate = await h.capture();
  assert.equal((duplicate as Row).kind, 'OBSERVED');
  assert.deepEqual(outlineCoordinatorRead(duplicate, expected), read);
  assert.equal(mutations(h).length, 0);
  assert.equal(
    h.calls.some((c) => c.name === 'policy:EVIDENCE'),
    true,
  );
});

for (const [collection, slot] of [
  ['curriculumBriefRevisions', '_id'],
  ['curriculumBriefRevisions', 'technologyId'],
  ['curriculumBriefRevisions', 'createdBy'],
  ['curriculumBriefRevisions', 'createdAt'],
  ['learningPathProposalRevisions', '_id'],
  ['learningPathProposalRevisions', 'proposalId'],
  ['learningPathProposalRevisions', 'technologyId'],
  ['learningPathProposalRevisions', 'source.id'],
  ['learningPathProposalRevisions', 'createdAt'],
] as const) {
  test(`native source ${collection}/${slot} refuses normalized strings and coercible values`, async () => {
    for (const representation of ['string', 'coercible'] as const) {
      const h = fixture(),
        row = h.rows[collection]![0]!;
      const owner = slot === 'source.id' ? (row.source as Row) : row;
      const key = slot === 'source.id' ? 'id' : slot,
        original = owner[key];
      let coerced = false;
      owner[key] =
        representation === 'string'
          ? original instanceof Date
            ? original.toISOString()
            : (original as Types.ObjectId).toHexString()
          : {
              toString() {
                coerced = true;
                return 'SYNTHETIC_PRIVATE';
              },
              toISOString() {
                coerced = true;
                return 'SYNTHETIC_PRIVATE';
              },
            };
      const result = (await h.repository.prepare(h.prepared, h.work)) as Row;
      assert.equal(result.kind, 'UNRESOLVED');
      assert.equal(mutations(h).length, 0);
      assert.equal(coerced, false);
      assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE'), false);
    }
  });
}

// Each cut is a fresh synthetic transaction. This covers this runner's outer
// awaits, not merely the separately delivered fence helper's own checks.
for (const mode of [
  'PREPARE',
  'MARK',
  'CAPTURE',
  'CANCEL',
  'METADATA',
  'EVIDENCE',
] as const) {
  const setup = async () => {
    const h =
      mode === 'PREPARE'
        ? fixture()
        : await ready(
            mode === 'MARK'
              ? 'PREPARED'
              : mode === 'CAPTURE'
                ? 'INVOCATION_MARKED'
                : 'COMPLETION_STORED',
          );
    if (mode === 'MARK') h.claim();
    return h;
  };
  const invoke = (h: ReturnType<typeof fixture>) =>
    mode === 'PREPARE'
      ? h.repository.prepare(h.prepared, h.work)
      : mode === 'MARK'
        ? h.mark()
        : mode === 'CAPTURE'
          ? h.capture()
          : mode === 'CANCEL'
            ? h.repository.cancel(
                { binding: h.binding, expectedVersion: 2 },
                h.work,
              )
            : h.inspect(mode);
  for (const signal of ['loss', 'stop'] as const) {
    test(`${mode} suppresses results and later business effects at every observed await after ${signal}`, async (t) => {
      const baseline = await setup();
      const expected = (await invoke(baseline)) as Row;
      assert.equal(
        expected.kind,
        mode === 'METADATA' || mode === 'EVIDENCE' ? 'OBSERVED' : 'RECORDED',
      );
      const trace = baseline.calls
        .filter((c) => !['startSession', 'startTransaction'].includes(c.name))
        .map((c) => c.name);
      assert.ok(trace.includes('verify'));
      assert.ok(trace.includes('policy:' + mode));
      assert.ok(trace.includes('end'));
      if (!['METADATA', 'EVIDENCE'].includes(mode))
        assert.ok(trace.includes('commit'));
      for (let cut = 0; cut < trace.length; cut++) {
        const h = await setup();
        let position = -1,
          cutCall = -1;
        h.state.hook = async (name) => {
          position++;
          if (position === cut) {
            assert.equal(name, trace[cut]);
            cutCall = h.calls.length - 1;
            h[signal].abort();
          }
        };
        const result = (await invoke(h)) as Row;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const label = `${mode}/${signal}/${cut}:${trace[cut]}`;
        assert.notEqual(cutCall, -1, label);
        assert.ok(
          ['REFUSED', 'UNRESOLVED', 'OUTCOME_UNKNOWN'].includes(
            result.kind as string,
          ),
          label + ': ' + JSON.stringify(result),
        );
        assert.equal(
          h.calls
            .slice(cutCall + 1)
            .some(
              (c) =>
                c.name.endsWith(':insert') ||
                c.name.endsWith(':update') ||
                c.name === 'commit',
            ),
          false,
          label,
        );
        if (h.calls.some((c) => c.name === 'startSession')) {
          assert.ok(
            h.calls.some((c) => c.name === 'end'),
            label,
          );
          assert.equal(h.state.ended, true, label);
        }
        assert.equal(h.timers.size, 0, label);
        assert.equal(
          JSON.stringify(result).includes('SYNTHETIC_PRIVATE'),
          false,
          label,
        );
      }
      t.diagnostic(
        `${trace.length} fresh transaction cuts; ${mode}/${signal}; no real authority/database`,
      );
    });
  }
}

import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import childProcess from 'node:child_process';
import mongoose, { Types } from 'mongoose';
import { curriculumBriefDigest } from '../src/modules/admin/learning-paths/admin-curriculum-brief.schema.js';
import { proposalDefinitionDigest } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';
import { aiUsageTimeAt } from '../src/modules/ai/ai-usage-control.schema.js';
import {
  ledgerIntentFingerprint,
  ledgerQuoteDigest,
  ledgerRequestDigest,
  ledgerReservationFingerprint,
  paiseFromDecimal,
} from '../src/modules/ai/ai-usage-ledger.schema.js';
import {
  outlineIntentDigest,
  outlineContentDigest,
  outlineDefinitionDigest,
  outlineCompletionDigest,
} from '../src/modules/ai/curriculum-outline-candidate.schema.js';
import type { OutlineProducerPorts } from '../src/modules/ai/curriculum-outline-producer.service.js';

let create: typeof import('../src/modules/ai/curriculum-outline-producer.service.js').createCurriculumOutlineProducer;
const effects: string[] = [];
try {
  const forbidden = () => {
    effects.push('EFFECT');
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
  create = (
    await import('../src/modules/ai/curriculum-outline-producer.service.js')
  ).createCurriculumOutlineProducer;
} finally {
  mock.restoreAll();
  syncBuiltinESMExports();
}

const id = (n: number) => n.toString(16).padStart(24, '0');
const uuid = (n: number) =>
  `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
const digest = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v), 'utf8').digest('hex');
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const base = Date.parse('2026-11-08T00:00:00.000Z');
const iso = (n: number) => new Date(base + n).toISOString();
class Clock {
  elapsed = 2;
  utcOffset = 0;
  timers = new Map<object, { at: number; callback: () => void }>();
  now = () => base + this.elapsed + this.utcOffset;
  monotonic = () => this.elapsed;
  setTimeout = (callback: () => void, ms: number) => {
    const h = {};
    this.timers.set(h, { at: this.elapsed + ms, callback });
    return h;
  };
  clearTimeout = (h: unknown) => {
    this.timers.delete(h as object);
  };
  advance(ms: number) {
    this.elapsed += ms;
    for (const [h, t] of [...this.timers])
      if (t.at <= this.elapsed) {
        this.timers.delete(h);
        t.callback();
      }
  }
}

/** SYNTHETIC / NOT_SAVED / NOT_AI_GENERATED. Every port is an inert double. */
function fixture(
  options: { maxOutputBytes?: number; quoteLifetimeMs?: number } = {},
) {
  const clock = new Clock(),
    loss = new AbortController(),
    stop = new AbortController();
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
    createdBy: id(3),
    createdAt: new Date(base),
    operationId: uuid(1),
  };
  const brief = {
    ...briefDefinition,
    contentDigest: curriculumBriefDigest(briefDefinition),
  };
  const proposalDefinition = {
    _id: id(4),
    proposalId: id(5),
    technologyId: id(2),
    revision: 1,
    schemaVersion: 1 as const,
    source: { id: brief._id, revision: 1, digest: brief.contentDigest },
    ...content,
    createdAt: new Date(base),
  };
  const proposal = {
    ...proposalDefinition,
    definitionDigest: proposalDefinitionDigest(proposalDefinition),
  };
  const body = {
    title: 'Synthetic outline',
    modules: [
      {
        title: 'Synthetic Module',
        objectives: ['Learn synthetic policy'],
        topics: [
          {
            title: 'Synthetic Topic',
            concepts: [{ title: 'Synthetic Concept' }],
          },
        ],
      },
    ],
  };
  const rawOutput = JSON.stringify(body);
  const command = {
    operationId: uuid(2),
    technologyId: id(2),
    source: {
      id: brief._id,
      revision: 1 as const,
      digest: brief.contentDigest,
    },
    instructions: 'Synthetic approved template',
    inputJson: JSON.stringify(content),
    requestBounds: {
      instructionBytes: 27,
      inputJsonBytes: Buffer.byteLength(JSON.stringify(content)),
      maxOutputBytes: options.maxOutputBytes ?? 65536,
      maxOutputTokens: 4096,
      budgetMs: 10000,
    },
  };
  command.requestBounds.instructionBytes = Buffer.byteLength(
    command.instructions,
  );
  const intent = {
    schemaVersion: 1 as const,
    technologyId: id(2),
    brief: command.source,
    proposal: {
      id: proposal._id,
      proposalId: proposal.proposalId,
      revision: 1 as const,
      digest: proposal.definitionDigest,
    },
    operationId: command.operationId,
  };
  const requestDigest = ledgerRequestDigest({
    instructions: command.instructions,
    inputJson: command.inputJson,
  });
  const fingerprint = ledgerIntentFingerprint({ actorId: id(3), command });
  const time = aiUsageTimeAt(base);
  const quote = {
    id: uuid(10),
    periodKey: time.periodKey,
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
    expiresAtMs: base + (options.quoteLifetimeMs ?? 20000),
    assumptionsDigest: 'a'.repeat(64),
  };
  const quoteDigest = ledgerQuoteDigest(quote);
  const binding = {
    _id: id(8),
    schemaVersion: 1 as const,
    scope: 'SHARED_AI_TESTING' as const,
    actorId: id(3),
    sessionId: id(11),
    operationId: uuid(2),
    technologyId: id(2),
    brief: intent.brief,
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
    quoteDigest,
    outlineRevisionId: id(6),
    outlineId: id(7),
    terminalAuditId: id(12),
    completionAuditId: id(13),
    createdAt: iso(0),
  };
  // Independent exact ordered-array vector, not a call to the implementation's helper.
  const bindingHash = digest([
    'F054_OUTLINE_ATTEMPT',
    1,
    binding._id,
    binding.scope,
    binding.actorId,
    binding.sessionId,
    binding.operationId,
    binding.technologyId,
    [binding.brief.id, 1, binding.brief.digest],
    [
      binding.proposal.id,
      binding.proposal.proposalId,
      1,
      binding.proposal.digest,
    ],
    binding.ledgerOperationId,
    fingerprint,
    binding.intentDigest,
    requestDigest,
    binding.templateVersion,
    quoteDigest,
    binding.outlineRevisionId,
    binding.outlineId,
    binding.terminalAuditId,
    binding.completionAuditId,
    binding.createdAt,
  ]);
  type Input = Parameters<typeof create>[0];
  const input = {
    attempt: {
      ...binding,
      bindingDigest: bindingHash,
      version: 0,
      phase: 'PREPARED',
      invocation: null,
      completion: null,
      cancelledAt: null,
      receipt: null,
    },
    command,
    expectedVersion: 1,
    claimId: uuid(3),
    ownerId: uuid(4),
  };
  type MarkRequest = Parameters<OutlineProducerPorts['attempts']['mark']>[0];
  type CaptureRequest = Parameters<
    OutlineProducerPorts['attempts']['capture']
  >[0];
  let stored: Record<string, unknown> = copy(input.attempt),
    saved: CaptureRequest | undefined;
  let event: unknown = null,
    terminal: unknown = null,
    candidate: unknown = null;
  const calls: string[] = [];
  const proof = () => ({
    operation: {
      _id: new Types.ObjectId(id(9)),
      schemaVersion: 1,
      scope: 'SHARED_AI_TESTING',
      actorId: new Types.ObjectId(id(3)),
      operationId: uuid(2),
      purpose: 'CURRICULUM_OUTLINE',
      environment: 'DEV',
      technologyId: new Types.ObjectId(id(2)),
      source: {
        id: new Types.ObjectId(id(1)),
        revision: 1,
        digest: brief.contentDigest,
      },
      requestDigest,
      requestBounds: command.requestBounds,
      intentFingerprint: fingerprint,
      reservationFingerprint: ledgerReservationFingerprint({
        intentFingerprint: fingerprint,
        periodKey: time.periodKey,
        admissionWindowKey: time.actorWindowKey,
        quoteDigest,
      }),
      quote,
      quoteDigest,
      periodKey: time.periodKey,
      admissionWindowKey: time.actorWindowKey,
      admittedAt: new Date(base),
      reservationPaise: paiseFromDecimal('1'),
      version: 2,
      state: 'DISPATCH_CLAIMED',
      open: true,
      heldPaise: paiseFromDecimal('1'),
      actualPaise: null,
      claim: {
        id: uuid(3),
        ownerId: uuid(4),
        claimedAt: new Date(base + 1),
        observeUntil: new Date(base + 10001),
      },
      terminalEvidence: null,
      safeCode: null,
      lastAuditId: new Types.ObjectId(id(14)),
      updatedAt: new Date(base + 1),
    },
    audit: {
      id: id(14),
      action: 'AI_USAGE_DISPATCH_CLAIMED',
      operationId: id(9),
      actorId: id(3),
      claimId: uuid(3),
      ownerId: uuid(4),
      claimVersion: 2,
    },
  });
  const authority = (sessionId = id(11)) => ({
    actorId: id(3),
    sessionId,
    attemptId: id(8),
    bindingDigest: bindingHash,
    currentAdmin: true,
    sourceAdmitted: true,
    controlsCurrent: true,
    technologyStatus: 'DRAFT',
    brief,
    proposal,
    quote,
  });
  const ports: OutlineProducerPorts = {
    clock,
    loss: loss.signal,
    authority: {
      async check(_b, stage, sid, w) {
        w.check();
        calls.push(`authority:${stage}`);
        return authority(sid);
      },
    },
    ledger: {
      async claimDispatch(c, ctx, w) {
        w.check();
        calls.push('claim');
        assert.deepEqual(c, { operationId: uuid(2), expectedVersion: 1 });
        assert.deepEqual(ctx, {
          claimId: uuid(3),
          ownerId: uuid(4),
          request: {
            schemaVersion: 1,
            purpose: 'CURRICULUM_OUTLINE',
            instructions: command.instructions,
            inputJson: command.inputJson,
            maxOutputBytes: command.requestBounds.maxOutputBytes,
            maxOutputTokens: 4096,
          },
        });
        assert.ok(Object.isFrozen(c));
        return { kind: 'RECORDED', cleanup: 'COMPLETE', proof: proof() };
      },
      async readClaim(_b, w) {
        w.check();
        calls.push('claimRead');
        return proof();
      },
    },
    attempts: {
      async mark(req, w) {
        w.check();
        calls.push('mark');
        assert.equal(req.expectedVersion, 0);
        assert.deepEqual(req.binding, binding);
        assert.ok(Object.isFrozen(req.invocation));
        stored = {
          ...stored,
          phase: 'INVOCATION_MARKED',
          version: 1,
          invocation: copy(req.invocation),
        };
        return { kind: 'RECORDED', cleanup: 'COMPLETE', attempt: copy(stored) };
      },
      async capture(req, w) {
        w.check();
        calls.push('capture');
        assert.equal(req.expectedVersion, 1);
        saved = req;
        event = copy(req.audit);
        stored = {
          ...stored,
          phase: 'COMPLETION_STORED',
          version: 2,
          completion: copy(req.completion),
        };
        return {
          kind: 'RECORDED',
          cleanup: 'COMPLETE',
          attempt: copy(stored),
          audit: event,
        };
      },
      async read(_b, w) {
        w.check();
        calls.push('read');
        return {
          attempt: copy(stored),
          completionAudit: event,
          terminalAudit: terminal,
          candidate,
        };
      },
    },
    executor: {
      async execute(req, options) {
        calls.push('execute');
        assert.equal(req.purpose, 'CURRICULUM_OUTLINE');
        assert.equal(req.inputJson, command.inputJson);
        assert.ok(Object.isFrozen(req));
        assert.equal(options.budgetMs, 9999);
        assert.equal(options.signal?.aborted, false);
        clock.advance(1);
        return {
          ok: true,
          untrustedJson: rawOutput,
          usage: { inputTokens: null, outputTokens: null },
          elapsedMs: 1,
        };
      },
    },
  };
  const producer = () => create(input as Input, ports);
  const run = () => producer().run(stop.signal);
  return {
    input,
    binding,
    bindingHash,
    command,
    brief,
    proposal,
    quote,
    body,
    rawOutput,
    proof,
    authority,
    ports,
    calls,
    clock,
    loss,
    stop,
    producer,
    run,
    get stored() {
      return stored;
    },
    set stored(v) {
      stored = v;
    },
    get saved() {
      return saved;
    },
    set event(v: unknown) {
      event = v;
    },
    set terminal(v: unknown) {
      terminal = v;
    },
    set candidate(v: unknown) {
      candidate = v;
    },
    markRequest: undefined as MarkRequest | undefined,
  };
}
type Fixture = ReturnType<typeof fixture>;
function count(f: Fixture, name: string) {
  return f.calls.filter((c) => c === name).length;
}
function safe(v: unknown) {
  assert.doesNotMatch(
    JSON.stringify(v),
    /SYNTHETIC_PRIVATE_CANARY|rawOutput|Synthetic brief|ownerId|claimId|inputJson/,
  );
}
async function flush() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

test('imports are inert: no network, process, database or model registration', () =>
  assert.deepEqual(effects, []));
test('known claim then marker then single invocation then exact completion/audit; no admission or accounting', async () => {
  const f = fixture(),
    original = JSON.stringify(f.input),
    p = f.producer();
  const out = await p.run(f.stop.signal);
  assert.equal(out.kind, 'COMPLETION_RECORDED');
  safe(out);
  assert.deepEqual(f.calls, [
    'authority:CLAIM',
    'claim',
    'authority:MARK',
    'mark',
    'claimRead',
    'authority:INVOKE',
    'execute',
    'authority:CAPTURE',
    'claimRead',
    'authority:CAPTURE',
    'capture',
  ]);
  assert.equal(JSON.stringify(f.input), original);
  assert.equal(f.clock.timers.size, 0);
  assert.equal((await p.run(f.stop.signal)).kind, 'UNRESOLVED');
  assert.equal(count(f, 'execute'), 1);
  const saved = f.saved!;
  assert.equal(saved.completion.rawOutput, f.rawOutput);
  const i = saved.invocation,
    c = saved.completion;
  assert.equal(
    c.checkpointDigest,
    digest([
      'F054_OUTLINE_CHECKPOINT',
      1,
      f.bindingHash,
      [
        i.claimVersion,
        i.id,
        i.ownerId,
        i.claimedAt,
        i.observeUntil,
        i.markedAt,
      ],
      c.producer.completionDigest,
      c.createdAt,
    ]),
  );
  assert.equal(c.createdAt, iso(3));
  assert.notEqual(c.createdAt, f.binding.createdAt);
  assert.ok(Object.isFrozen(saved.completion));
  assert.equal(saved.audit.id, f.binding.completionAuditId);
  assert.deepEqual(Object.keys(saved.audit), [
    'id',
    'action',
    'actorId',
    'attemptId',
    'technologyId',
    'operationId',
    'digest',
    'createdAt',
  ]);
  assert.equal(f.stored.receipt, null);
});
test('concurrent run calls consume the original context once', async () => {
  const f = fixture(),
    p = f.producer();
  const results = await Promise.all([
    p.run(f.stop.signal),
    p.run(f.stop.signal),
  ]);
  assert.deepEqual(results.map((r) => r.kind).sort(), [
    'COMPLETION_RECORDED',
    'UNRESOLVED',
  ]);
  assert.equal(count(f, 'claim'), 1);
  assert.equal(count(f, 'mark'), 1);
  assert.equal(count(f, 'execute'), 1);
  assert.equal(count(f, 'capture'), 1);
});

for (const [name, change] of Object.entries({
  actor: (r: ReturnType<Fixture['authority']>) => {
    r.actorId = id(99);
  },
  session: (r: ReturnType<Fixture['authority']>) => {
    r.sessionId = id(99);
  },
  attempt: (r: ReturnType<Fixture['authority']>) => {
    r.attemptId = id(99);
  },
  binding: (r: ReturnType<Fixture['authority']>) => {
    r.bindingDigest = 'b'.repeat(64);
  },
  admin: (r: ReturnType<Fixture['authority']>) => {
    r.currentAdmin = false;
  },
  admission: (r: ReturnType<Fixture['authority']>) => {
    r.sourceAdmitted = false;
  },
  controls: (r: ReturnType<Fixture['authority']>) => {
    r.controlsCurrent = false;
  },
  parent: (r: ReturnType<Fixture['authority']>) => {
    r.technologyStatus = 'ARCHIVED';
  },
  brief: (r: ReturnType<Fixture['authority']>) => {
    r.brief = { ...r.brief, _id: id(99) };
  },
  proposal: (r: ReturnType<Fixture['authority']>) => {
    r.proposal = { ...r.proposal, _id: id(99) };
  },
  template: (r: ReturnType<Fixture['authority']>) => {
    r.quote = { ...r.quote, templateVersion: uuid(99) };
  },
}))
  test(`authority/source/request refusal before claim: ${name}`, async () => {
    const f = fixture();
    f.ports.authority.check = async () => {
      const r = f.authority();
      change(r);
      return r;
    };
    const r = await f.run();
    assert.equal(r.kind, 'REFUSED');
    assert.equal(count(f, 'claim'), 0);
    safe(r);
  });
for (const key of [
  'actorId',
  'sessionId',
  'requestDigest',
  'intentDigest',
  'quoteDigest',
  'technologyId',
  'templateVersion',
  'outlineRevisionId',
  'terminalAuditId',
] as const)
  test(`immutable attempt tampering refuses without side effects: ${key}`, async () => {
    const f = fixture();
    f.input.attempt[key] = '0';
    assert.equal((await f.run()).kind, 'REFUSED');
    assert.deepEqual(f.calls, []);
  });
for (const bad of [
  null,
  {},
  [],
  { attempt: { $ne: null } },
  new Proxy(
    {},
    {
      get() {
        throw new Error('SYNTHETIC_PRIVATE_CANARY');
      },
    },
  ),
])
  test(`malformed input is content-free (${bad === null ? 'null' : Array.isArray(bad) ? 'array' : 'object'})`, async () => {
    const f = fixture();
    const r = await create(bad, f.ports).run(f.stop.signal);
    assert.equal(r.kind, 'REFUSED');
    safe(r);
    assert.deepEqual(f.calls, []);
  });
test('unknown/operator/getter fields are rejected without evaluating getters', async () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.input, 'private', {
    enumerable: true,
    get() {
      reads++;
      return 'SYNTHETIC_PRIVATE_CANARY';
    },
  });
  const r = await f.run();
  assert.equal(r.kind, 'REFUSED');
  assert.equal(reads, 0);
  safe(r);
});
for (const mutate of [
  (p: ReturnType<Fixture['proof']>) => {
    p.operation.actorId = new Types.ObjectId(id(99));
  },
  (p: ReturnType<Fixture['proof']>) => {
    p.operation.claim.ownerId = uuid(99);
  },
  (p: ReturnType<Fixture['proof']>) => {
    p.operation.claim.id = uuid(99);
  },
  (p: ReturnType<Fixture['proof']>) => {
    p.audit.claimVersion = 3;
  },
  (p: ReturnType<Fixture['proof']>) => {
    p.audit.actorId = id(99);
  },
  (p: ReturnType<Fixture['proof']>) => {
    p.operation.requestDigest = 'b'.repeat(64);
  },
  (p: ReturnType<Fixture['proof']>) => {
    p.operation.quote.templateVersion = uuid(99);
  },
])
  test('mismatched full claim/audit cannot be replaced by a RECORDED flag', async () => {
    const f = fixture();
    f.ports.ledger.claimDispatch = async () => {
      const p = f.proof();
      mutate(p);
      return { kind: 'RECORDED', cleanup: 'COMPLETE', proof: p };
    };
    assert.equal((await f.run()).kind, 'OUTCOME_UNKNOWN');
    assert.equal(count(f, 'mark'), 0);
    assert.equal(count(f, 'execute'), 0);
  });
for (const [name, ack] of [
  ['unknown', { kind: 'OUTCOME_UNKNOWN' }],
  ['refused', { kind: 'REFUSED' }],
  ['private DTO', { kind: 'RECORDED', operation: {} }],
  ['missing cleanup', { kind: 'RECORDED' }],
  ['failed cleanup', { kind: 'RECORDED', cleanup: 'FAILED' }],
] as const)
  test(`claim ${name} ACK makes no marker/call and cannot retry`, async () => {
    const f = fixture();
    f.ports.ledger.claimDispatch = async () => {
      f.calls.push('claim');
      return ack;
    };
    const p = f.producer();
    assert.equal((await p.run(f.stop.signal)).kind, 'OUTCOME_UNKNOWN');
    await p.run(f.stop.signal);
    assert.equal(count(f, 'claim'), 1);
    assert.equal(count(f, 'execute'), 0);
  });
for (const kind of ['OUTCOME_UNKNOWN', 'REFUSED', 'CONFLICT'])
  test(`marker ${kind}: no execute, no replay from persisted marker`, async () => {
    const f = fixture(),
      mark = f.ports.attempts.mark;
    f.ports.attempts.mark = async (r, w) => {
      await mark(r, w);
      return { kind };
    };
    const p = f.producer();
    assert.equal((await p.run(f.stop.signal)).kind, 'OUTCOME_UNKNOWN');
    assert.equal(
      (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
        .kind,
      'UNRESOLVED',
    );
    const resumed = create({ ...f.input, attempt: f.stored }, f.ports);
    await resumed.run(f.stop.signal);
    assert.equal(count(f, 'mark'), 1);
    assert.equal(count(f, 'execute'), 0);
    assert.equal(count(f, 'capture'), 0);
  });

for (const stage of ['CLAIM', 'MARK', 'INVOKE', 'CAPTURE'] as const)
  for (const when of ['before', 'after'] as const)
    test(`sticky authority loss ${when} ${stage} await suppresses later writes`, async () => {
      const f = fixture(),
        check = f.ports.authority.check;
      f.ports.authority.check = async (b, s, sid, w) => {
        if (s === stage && when === 'before') f.loss.abort();
        const r = await check(b, s, sid, w);
        if (s === stage) f.loss.abort();
        return r;
      };
      const r = await f.run();
      safe(r);
      assert.notEqual(r.kind, 'COMPLETION_RECORDED');
      assert.equal(count(f, 'capture'), 0);
      if (stage !== 'CAPTURE') assert.equal(count(f, 'execute'), 0);
      const calls = f.calls.length;
      await f
        .producer()
        .inspect({ actorId: id(3), sessionId: id(11) }, f.loss.signal);
      assert.equal(f.calls.length, calls);
      assert.equal(f.clock.timers.size, 0);
    });
for (const port of [
  'claim',
  'mark',
  'claimRead',
  'execute',
  'capture',
] as const)
  test(`cancellation while ${port} is in flight never implies rollback or permits replay`, async () => {
    const f = fixture();
    const original =
      port === 'claim'
        ? f.ports.ledger.claimDispatch
        : port === 'mark'
          ? f.ports.attempts.mark
          : port === 'claimRead'
            ? f.ports.ledger.readClaim
            : port === 'execute'
              ? f.ports.executor.execute
              : f.ports.attempts.capture;
    const wrapper = async (...args: unknown[]) => {
      f.calls.push(`await:${port}`);
      f.stop.abort();
      return (original as (...a: unknown[]) => Promise<unknown>)(...args);
    };
    if (port === 'claim') f.ports.ledger.claimDispatch = wrapper;
    else if (port === 'mark') f.ports.attempts.mark = wrapper;
    else if (port === 'claimRead') f.ports.ledger.readClaim = wrapper;
    else if (port === 'execute') f.ports.executor.execute = wrapper;
    else f.ports.attempts.capture = wrapper;
    const p = f.producer(),
      r = await p.run(f.stop.signal);
    safe(r);
    assert.notEqual(r.kind, 'COMPLETION_RECORDED');
    await p.run(new AbortController().signal);
    assert.ok(count(f, 'execute') <= 1);
    assert.ok(count(f, 'capture') <= 1);
    assert.equal(f.clock.timers.size, 0);
  });
for (const raw of [
  '{}',
  'null',
  '[]',
  '{"title":"x","modules":[],"actorId":"SYNTHETIC_PRIVATE_CANARY"}',
  'x'.repeat(65537),
  '\ud800',
])
  test('invalid/unbounded content never reaches capture', async () => {
    const f = fixture();
    f.ports.executor.execute = async () => ({
      ok: true,
      untrustedJson: raw,
      usage: { inputTokens: null, outputTokens: null },
      elapsedMs: 1,
    });
    const r = await f.run();
    assert.equal(r.kind, 'UNRESOLVED');
    assert.equal(count(f, 'capture'), 0);
    safe(r);
  });
test('raw whitespace is retained exactly and bound separately from semantic content', async () => {
  const f = fixture();
  const raw = ` \n${f.rawOutput}\t `;
  f.ports.executor.execute = async () => ({
    ok: true,
    untrustedJson: raw,
    usage: { inputTokens: 1, outputTokens: 1 },
    elapsedMs: 0,
  });
  assert.equal((await f.run()).kind, 'COMPLETION_RECORDED');
  assert.equal(f.saved!.completion.rawOutput, raw);
  assert.equal(
    f.saved!.completion.producer.rawOutputDigest,
    createHash('sha256').update(raw, 'utf8').digest('hex'),
  );
});
test('late successful underlying return is suppressed; no fallback/retry', async () => {
  const f = fixture();
  f.ports.executor.execute = async () => {
    f.calls.push('execute');
    f.clock.advance(10000);
    return {
      ok: true,
      untrustedJson: f.rawOutput,
      usage: { inputTokens: 1, outputTokens: 1 },
      elapsedMs: 10000,
    };
  };
  assert.equal((await f.run()).kind, 'UNRESOLVED');
  assert.equal(count(f, 'execute'), 1);
  assert.equal(count(f, 'capture'), 0);
});
test('noncooperating pending executor is bounded by injected timer; late rejection is observed', async () => {
  const f = fixture();
  let reject!: (e: Error) => void;
  f.ports.executor.execute = () => {
    f.calls.push('execute');
    return new Promise((_, r) => {
      reject = r;
    });
  };
  const pending = f.run();
  await flush();
  assert.equal(count(f, 'execute'), 1);
  f.clock.advance(10000);
  assert.equal((await pending).kind, 'UNRESOLVED');
  reject(new Error('SYNTHETIC_PRIVATE_CANARY'));
  await flush();
  assert.equal(f.clock.timers.size, 0);
  assert.equal(count(f, 'capture'), 0);
});
test('capture work budget includes validation/authentication; it is not reset after awaits', async () => {
  const f = fixture(),
    check = f.ports.authority.check;
  f.ports.authority.check = async (b, s, sid, w) => {
    const r = await check(b, s, sid, w);
    if (s === 'CAPTURE') f.clock.advance(10000);
    return r;
  };
  assert.equal((await f.run()).kind, 'UNRESOLVED');
  assert.equal(count(f, 'capture'), 0);
});
test('original on-time output can capture after observation expiry inside remaining capture budget', async () => {
  const f = fixture(),
    execute = f.ports.executor.execute,
    read = f.ports.ledger.readClaim;
  f.ports.executor.execute = async (r, o) => {
    const v = await execute(r, o);
    f.clock.advance(9997);
    return v;
  };
  let reads = 0;
  f.ports.ledger.readClaim = async (b, w) => {
    const p = await read(b, w);
    if (++reads === 2) f.clock.advance(2);
    return p;
  };
  assert.equal((await f.run()).kind, 'COMPLETION_RECORDED');
  assert.equal(f.saved!.completion.producer.completedAt, iso(10000));
  assert.ok(f.clock.now() > base + 10001);
});
for (const ack of ['OUTCOME_UNKNOWN', 'REFUSED', 'CONFLICT', 'CLEANUP_UNKNOWN'])
  test(`capture ${ack} never triggers replacement`, async () => {
    const f = fixture(),
      capture = f.ports.attempts.capture;
    f.ports.attempts.capture = async (r, w) => {
      const v = await capture(r, w);
      return ack === 'CLEANUP_UNKNOWN'
        ? { ...(v as object), cleanup: 'UNKNOWN' }
        : { kind: ack };
    };
    const p = f.producer();
    assert.equal((await p.run(f.stop.signal)).kind, 'OUTCOME_UNKNOWN');
    assert.equal(
      (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
        .kind,
      'COMPLETION_RECORDED',
    );
    await p.run(f.stop.signal);
    assert.equal(count(f, 'capture'), 1);
    assert.equal(count(f, 'execute'), 1);
  });
test('same semantic output with different raw bytes is corrupt recovery, never repaired', async () => {
  const f = fixture(),
    p = f.producer();
  await p.run(f.stop.signal);
  (f.stored.completion as Record<string, unknown>).rawOutput =
    ` ${f.rawOutput}`;
  assert.equal(
    (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
      .kind,
    'UNRESOLVED',
  );
  assert.equal(count(f, 'capture'), 1);
});
test('missing completion audit, different audit, unreadable/missing rows stay unresolved', async () => {
  for (const which of ['missing', 'different', 'read', 'row']) {
    const f = fixture(),
      p = f.producer();
    await p.run(f.stop.signal);
    if (which === 'missing') f.event = null;
    if (which === 'different') f.event = { ...f.saved!.audit, id: id(99) };
    if (which === 'read')
      f.ports.attempts.read = async () => {
        throw new Error('SYNTHETIC_PRIVATE_CANARY');
      };
    if (which === 'row') f.ports.attempts.read = async () => null;
    const r = await p.inspect(
      { actorId: id(3), sessionId: id(11) },
      f.stop.signal,
    );
    assert.equal(r.kind, 'UNRESOLVED');
    safe(r);
    assert.equal(count(f, 'capture'), 1);
  }
});
test('other actor cannot recover private completion; fresh session binding is independently checked', async () => {
  const f = fixture(),
    p = f.producer();
  await p.run(f.stop.signal);
  const reads = count(f, 'read');
  assert.equal(
    (await p.inspect({ actorId: id(99), sessionId: id(11) }, f.stop.signal))
      .kind,
    'UNRESOLVED',
  );
  assert.equal(count(f, 'read'), reads);
  assert.equal(
    (await p.inspect({ actorId: id(3), sessionId: id(99) }, f.stop.signal))
      .kind,
    'COMPLETION_RECORDED',
  );
  assert.equal(count(f, 'execute'), 1);
  assert.equal(count(f, 'capture'), 1);
});
test('backward wall time or monotonic time refuses rather than repairing timestamps', async () => {
  const f = fixture(),
    check = f.ports.authority.check;
  f.ports.authority.check = async (b, s, sid, w) => {
    const r = await check(b, s, sid, w);
    f.clock.utcOffset = -100;
    return r;
  };
  assert.equal((await f.run()).kind, 'REFUSED');
  assert.equal(count(f, 'claim'), 0);
});

test('all 12 interruption matrix cuts are read-only on recovery', async (t) => {
  const names = [
    'before claim',
    'claim ACK unknown',
    'known claim before marker',
    'marker ACK unknown',
    'known marker before call',
    'awaiting provider',
    'observed return/validation',
    'authority lost before capture',
    'capture ACK unknown',
    'known capture before admission',
    'admission ACK unknown',
    'known admission/later logout',
  ];
  for (let cut = 0; cut < 12; cut++)
    await t.test(`${cut + 1}: ${names[cut]}`, async () => {
      const f = fixture(),
        p = f.producer();
      if (cut === 0)
        f.ports.authority.check = async () => {
          throw new Error('SYNTHETIC_PRIVATE_CANARY');
        };
      else if (cut === 1)
        f.ports.ledger.claimDispatch = async () => ({
          kind: 'OUTCOME_UNKNOWN',
        });
      else if (cut === 2) {
        const check = f.ports.authority.check;
        f.ports.authority.check = async (b, s, sid, w) => {
          if (s === 'MARK') throw new Error();
          return check(b, s, sid, w);
        };
      } else if (cut === 3) {
        const mark = f.ports.attempts.mark;
        f.ports.attempts.mark = async (r, w) => {
          await mark(r, w);
          return { kind: 'OUTCOME_UNKNOWN' };
        };
      } else if (cut === 4) {
        const check = f.ports.authority.check;
        f.ports.authority.check = async (b, s, sid, w) => {
          if (s === 'INVOKE') throw new Error();
          return check(b, s, sid, w);
        };
      } else if (cut === 5)
        f.ports.executor.execute = async () => {
          f.calls.push('execute');
          throw new Error();
        };
      else if (cut === 6)
        f.ports.executor.execute = async () => ({
          ok: true,
          untrustedJson: 'invalid',
          usage: { inputTokens: null, outputTokens: null },
          elapsedMs: 1,
        });
      else if (cut === 7) {
        const check = f.ports.authority.check;
        f.ports.authority.check = async (b, s, sid, w) => {
          if (s === 'CAPTURE') throw new Error();
          return check(b, s, sid, w);
        };
      } else if (cut === 8) {
        const capture = f.ports.attempts.capture;
        f.ports.attempts.capture = async (r, w) => {
          await capture(r, w);
          return { kind: 'OUTCOME_UNKNOWN' };
        };
      }
      await p.run(f.stop.signal);
      if (cut === 11) {
        const saved = f.saved!,
          outline = {
            schemaVersion: 1,
            technologyId: id(2),
            source: f.binding.brief,
            ...f.body,
          };
        const definition = {
          _id: id(6),
          outlineId: id(7),
          schemaVersion: 1,
          revision: 1,
          origin: 'AI_GENERATED',
          outline,
          proposal: f.binding.proposal,
          createdBy: id(3),
          createdAt: saved.completion.createdAt,
          producer: saved.completion.producer,
          contentDigest: outlineContentDigest(outline),
        };
        const candidate = {
          ...definition,
          definitionDigest: outlineDefinitionDigest(definition),
        };
        f.candidate = candidate;
        f.stored = {
          ...f.stored,
          phase: 'ADMITTED',
          version: 3,
          receipt: {
            kind: 'COMMITTED',
            candidateId: id(6),
            revision: 1,
            definitionDigest: candidate.definitionDigest,
            auditId: id(12),
          },
        };
        f.terminal = {
          id: id(12),
          action: 'CURRICULUM_OUTLINE_ADMITTED',
          actorId: id(3),
          attemptId: id(8),
          technologyId: id(2),
          operationId: uuid(2),
          outlineId: id(7),
          revision: 1,
          code: null,
          createdAt: iso(4),
        };
      }
      const mutations = f.calls.filter((c) =>
        ['claim', 'mark', 'execute', 'capture'].includes(c),
      );
      // Restore only synthetic read authorization. A recovered context receives no write capability.
      if (cut === 11) f.loss.abort(); // Prior admission remains inspectable after origin-session loss.
      f.ports.authority.check = async (_b, _s, sid) => f.authority(sid);
      const resumed = create({ ...f.input, attempt: f.stored }, f.ports);
      const out = await resumed.inspect(
        { actorId: id(3), sessionId: id(99) },
        f.stop.signal,
      );
      safe(out);
      assert.equal(
        out.kind,
        cut === 11
          ? 'ADMITTED'
          : cut >= 8
            ? 'COMPLETION_RECORDED'
            : 'UNRESOLVED',
      );
      assert.deepEqual(
        f.calls.filter((c) =>
          ['claim', 'mark', 'execute', 'capture'].includes(c),
        ),
        mutations,
      );
      assert.equal(f.clock.timers.size, 0);
    });
});

test('inspection retires invocation eligibility even with a PREPARED snapshot', async () => {
  const f = fixture(),
    p = f.producer();
  assert.equal(
    (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
      .kind,
    'UNRESOLVED',
  );
  assert.equal((await p.run(f.stop.signal)).kind, 'UNRESOLVED');
  assert.equal(count(f, 'claim'), 0);
  assert.equal(count(f, 'mark'), 0);
  assert.equal(count(f, 'execute'), 0);
});
test('caller edits after construction cannot retarget the retained input', async () => {
  const f = fixture(),
    p = f.producer();
  f.input.attempt.actorId = id(99);
  f.input.command.instructions = 'SYNTHETIC_PRIVATE_CANARY';
  // Mutating the input must not affect the retained request. Use independently resolved original proof.
  f.ports.ledger.claimDispatch = async () => ({
    kind: 'RECORDED',
    cleanup: 'COMPLETE',
    proof: f.proof(),
  });
  const execute = f.ports.executor.execute;
  f.ports.executor.execute = async (r, o) => {
    assert.equal(r.instructions, 'Synthetic approved template');
    // This double's original inputJson assertion remains valid.
    return execute(r, o);
  };
  const r = await p.run(f.stop.signal);
  safe(r);
  assert.equal(r.kind, 'COMPLETION_RECORDED');
});
test('final authority follows awaited claim read and refuses changed authorization', async () => {
  const f = fixture(),
    read = f.ports.ledger.readClaim,
    check = f.ports.authority.check;
  let changed = false;
  f.ports.ledger.readClaim = async (b, w) => {
    const r = await read(b, w);
    changed = true;
    return r;
  };
  f.ports.authority.check = async (b, s, sid, w) => {
    const r = (await check(b, s, sid, w)) as ReturnType<Fixture['authority']>;
    return { ...r, currentAdmin: !changed };
  };
  assert.equal((await f.run()).kind, 'OUTCOME_UNKNOWN');
  assert.equal(count(f, 'execute'), 0);
});
test('quote expiring during final claim read cannot authorize execution', async () => {
  const f = fixture({ quoteLifetimeMs: 5 }),
    read = f.ports.ledger.readClaim;
  f.ports.ledger.readClaim = async (b, w) => {
    const r = await read(b, w);
    f.clock.advance(3);
    return r;
  };
  assert.equal((await f.run()).kind, 'OUTCOME_UNKNOWN');
  assert.equal(count(f, 'execute'), 0);
});
test('fresh session may inspect committed evidence after original logout and archival', async () => {
  const f = fixture(),
    p = f.producer();
  await p.run(f.stop.signal);
  f.loss.abort();
  f.ports.authority.check = async (_b, _s, sid) => ({
    ...f.authority(sid),
    technologyStatus: 'ARCHIVED',
    controlsCurrent: false,
  });
  assert.equal(
    (
      await p.inspect(
        { actorId: id(3), sessionId: id(99) },
        new AbortController().signal,
      )
    ).kind,
    'COMPLETION_RECORDED',
  );
  assert.equal(count(f, 'execute'), 1);
  assert.equal(count(f, 'capture'), 1);
  assert.equal((await p.run(new AbortController().signal)).kind, 'UNRESOLVED');
});
test('observed loss remains sticky despite synthetic repromotion', async () => {
  const f = fixture(),
    execute = f.ports.executor.execute;
  f.ports.executor.execute = async (r, o) => {
    const value = await execute(r, o);
    f.loss.abort();
    return value;
  };
  const p = f.producer();
  assert.equal((await p.run(f.stop.signal)).kind, 'UNRESOLVED');
  f.ports.authority.check = async (_b, _s, sid) => f.authority(sid);
  await p.run(new AbortController().signal);
  assert.equal(count(f, 'capture'), 0);
  assert.equal(count(f, 'execute'), 1);
});
test('exact 64 KiB raw boundary and independent lower request bound', async () => {
  const f = fixture(),
    raw = f.rawOutput + ' '.repeat(65536 - Buffer.byteLength(f.rawOutput));
  f.ports.executor.execute = async () => ({
    ok: true,
    untrustedJson: raw,
    usage: { inputTokens: null, outputTokens: null },
    elapsedMs: 0,
  });
  assert.equal((await f.run()).kind, 'COMPLETION_RECORDED');
  assert.equal(Buffer.byteLength(f.saved!.completion.rawOutput), 65536);
  const limited = fixture({ maxOutputBytes: 100 });
  limited.ports.executor.execute = async () => ({
    ok: true,
    untrustedJson: limited.rawOutput,
    usage: { inputTokens: null, outputTokens: null },
    elapsedMs: 0,
  });
  assert.equal((await limited.run()).kind, 'UNRESOLVED');
  assert.equal(count(limited, 'capture'), 0);
});
test('technical failure and malformed success produce no capturable return', async () => {
  for (const value of [
    {
      ok: false,
      error: {
        code: 'DEADLINE_EXCEEDED',
        message: 'SYNTHETIC_PRIVATE_CANARY',
        invocation: 'STARTED',
      },
    },
    {
      ok: true,
      untrustedJson: '{}',
      usage: { inputTokens: -1, outputTokens: null },
      elapsedMs: 0,
    },
    {
      ok: true,
      untrustedJson: '{}',
      usage: { inputTokens: null, outputTokens: null },
      elapsedMs: 0,
      private: 'SYNTHETIC_PRIVATE_CANARY',
    },
  ]) {
    const f = fixture();
    f.ports.executor.execute = async () => value;
    const out = await f.run();
    assert.equal(out.kind, 'UNRESOLVED');
    safe(out);
    assert.equal(count(f, 'capture'), 0);
  }
});
for (const state of ['UNCERTAIN', 'SETTLED'] as const)
  test(`historical claim remains valid after accounting advances to ${state}`, async () => {
    const f = fixture();
    let reads = 0;
    f.ports.ledger.readClaim = async () => {
      const p = f.proof();
      if (++reads > 1) {
        p.operation = {
          ...p.operation,
          version: 3,
          state,
          updatedAt: new Date(base + 3),
          lastAuditId: new Types.ObjectId(id(99)),
        };
        if (state === 'SETTLED')
          Object.assign(p.operation, {
            open: false,
            heldPaise: paiseFromDecimal('0'),
            actualPaise: paiseFromDecimal('1'),
            terminalEvidence: {
              id: uuid(99),
              kind: 'FINAL_COST',
              evidenceDigest: 'b'.repeat(64),
              actualPaise: paiseFromDecimal('1'),
              inputTokens: 1,
              outputTokens: 1,
            },
          });
      }
      return p;
    };
    assert.equal((await f.run()).kind, 'COMPLETION_RECORDED');
    assert.equal(count(f, 'capture'), 1);
  });
for (const which of ['version', 'marker', 'cancel', 'audit', 'bytes'] as const)
  test(`mismatched capture ACK ${which} cannot claim success`, async () => {
    const f = fixture(),
      capture = f.ports.attempts.capture;
    f.ports.attempts.capture = async (r, w) => {
      const saved = (await capture(r, w)) as {
        kind: string;
        cleanup: string;
        attempt: Record<string, unknown>;
        audit: Record<string, unknown>;
      };
      if (which === 'version') saved.attempt.version = 99;
      if (which === 'marker')
        (saved.attempt.invocation as Record<string, unknown>).ownerId =
          uuid(99);
      if (which === 'cancel') saved.attempt.cancelledAt = iso(4);
      if (which === 'audit') saved.audit.id = id(99);
      if (which === 'bytes')
        (saved.attempt.completion as Record<string, unknown>).rawOutput = '{}';
      return saved;
    };
    assert.equal((await f.run()).kind, 'OUTCOME_UNKNOWN');
    assert.equal(count(f, 'capture'), 1);
  });
test('loss during completion commit preserves possible prior evidence and reports unknown', async () => {
  const f = fixture(),
    capture = f.ports.attempts.capture;
  f.ports.attempts.capture = async (r, w) => {
    const saved = await capture(r, w);
    f.loss.abort();
    return saved;
  };
  const p = f.producer();
  assert.equal((await p.run(f.stop.signal)).kind, 'OUTCOME_UNKNOWN');
  assert.ok(f.stored.completion);
  assert.equal(f.stored.phase, 'COMPLETION_STORED');
  assert.equal(
    (
      await p.inspect(
        { actorId: id(3), sessionId: id(99) },
        new AbortController().signal,
      )
    ).kind,
    'COMPLETION_RECORDED',
  );
  assert.equal(count(f, 'capture'), 1);
});
test('loss after historical claim read prevents issuing completion capture', async () => {
  const f = fixture(),
    read = f.ports.ledger.readClaim;
  let reads = 0;
  f.ports.ledger.readClaim = async (b, w) => {
    const p = await read(b, w);
    if (++reads === 2) f.loss.abort();
    return p;
  };
  assert.equal((await f.run()).kind, 'UNRESOLVED');
  assert.equal(count(f, 'capture'), 0);
});
test('missing terminal receipt/audit cannot claim admission', async () => {
  const f = fixture(),
    p = f.producer();
  await p.run(f.stop.signal);
  f.stored = {
    ...f.stored,
    phase: 'ADMITTED',
    version: 3,
    receipt: {
      kind: 'COMMITTED',
      candidateId: id(6),
      revision: 1,
      definitionDigest: 'a'.repeat(64),
      auditId: id(12),
    },
  };
  assert.equal(
    (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
      .kind,
    'UNRESOLVED',
  );
  assert.equal(count(f, 'capture'), 1);
});

test('queued dispatch checks quote expiry again without invoking the executor', async () => {
  const f = fixture({ quoteLifetimeMs: 5 }),
    original = f.clock.setTimeout;
  let scheduled = 0;
  f.clock.setTimeout = (callback, ms) => {
    const h = original(callback, ms);
    // CLAIM auth/claim, MARK auth/mark, claim read, INVOKE auth, then queued executor.
    if (++scheduled === 7) queueMicrotask(() => f.clock.advance(3));
    return h;
  };
  const r = await f.run();
  assert.equal(r.kind, 'UNRESOLVED');
  assert.equal(scheduled, 7);
  assert.equal(count(f, 'execute'), 0);
  assert.equal(count(f, 'capture'), 0);
});
test('terminal refusal is inspected only with exact allowlisted receipt/audit; never written', async () => {
  const f = fixture(),
    p = f.producer();
  await p.run(f.stop.signal);
  f.stored = {
    ...f.stored,
    phase: 'REFUSED',
    version: 3,
    receipt: { kind: 'REFUSED', code: 'OUTPUT_INVALID', auditId: id(12) },
  };
  f.terminal = {
    id: id(12),
    action: 'CURRICULUM_OUTLINE_ADMISSION_REFUSED',
    actorId: id(3),
    attemptId: id(8),
    technologyId: id(2),
    operationId: uuid(2),
    outlineId: id(7),
    revision: 1,
    code: 'OUTPUT_INVALID',
    createdAt: iso(4),
  };
  assert.equal(
    (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
      .kind,
    'REFUSED',
  );
  f.terminal = {
    id: id(12),
    action: 'CURRICULUM_OUTLINE_ADMISSION_REFUSED',
    actorId: id(3),
    attemptId: id(8),
    technologyId: id(2),
    operationId: uuid(2),
    outlineId: id(7),
    revision: 1,
    code: 'SOURCE_MISMATCH',
    createdAt: iso(4),
  };
  assert.equal(
    (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
      .kind,
    'UNRESOLVED',
  );
  assert.equal(count(f, 'capture'), 1);
  assert.equal(count(f, 'execute'), 1);
});
test('prepared cancellation may increment version but cannot resume invocation', async () => {
  const f = fixture();
  f.stored = { ...f.stored, cancelledAt: iso(1), version: 1 };
  const p = create({ ...f.input, attempt: f.stored }, f.ports);
  assert.equal((await p.run(f.stop.signal)).kind, 'UNRESOLVED');
  assert.equal(
    (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
      .kind,
    'UNRESOLVED',
  );
  assert.equal(count(f, 'claim'), 0);
  assert.equal(count(f, 'execute'), 0);
});
test('capture receives remaining work and unchanged commit/abort/endSession bounds', async () => {
  const f = fixture(),
    capture = f.ports.attempts.capture,
    check = f.ports.authority.check;
  f.ports.authority.check = async (b, s, sid, w) => {
    const r = await check(b, s, sid, w);
    if (s === 'CAPTURE') f.clock.advance(100);
    return r;
  };
  f.ports.attempts.capture = async (r, w) => {
    assert.equal(w.remainingMs, 9800);
    assert.equal(w.commitMs, 2000);
    assert.equal(w.abortMs, 2000);
    assert.equal(w.endSessionMs, 2000);
    return capture(r, w);
  };
  assert.equal((await f.run()).kind, 'COMPLETION_RECORDED');
});

test('retained context rejects substituted whitespace even if an untrusted reader rehashes it', async () => {
  const f = fixture(),
    p = f.producer();
  await p.run(f.stop.signal);
  const saved = f.saved!;
  const c = { ...saved.completion, producer: { ...saved.completion.producer } };
  c.rawOutput = ` ${c.rawOutput}`;
  c.producer.rawOutputDigest = createHash('sha256')
    .update(c.rawOutput, 'utf8')
    .digest('hex');
  const { completionDigest: old, ...fields } = c.producer;
  void old;
  c.producer.completionDigest = outlineCompletionDigest(fields, id(3));
  const i = saved.invocation;
  c.checkpointDigest = digest([
    'F054_OUTLINE_CHECKPOINT',
    1,
    f.bindingHash,
    [i.claimVersion, i.id, i.ownerId, i.claimedAt, i.observeUntil, i.markedAt],
    c.producer.completionDigest,
    c.createdAt,
  ]);
  f.stored = { ...f.stored, completion: c };
  f.event = { ...saved.audit, digest: c.checkpointDigest };
  assert.equal(
    (await p.inspect({ actorId: id(3), sessionId: id(11) }, f.stop.signal))
      .kind,
    'UNRESOLVED',
  );
  assert.equal(count(f, 'capture'), 1);
});

test('failed deadline setup cannot start the protected port operation', async () => {
  const f = fixture();
  f.clock.setTimeout = () => {
    throw new Error('SYNTHETIC_PRIVATE_CANARY');
  };
  const out = await f.run();
  assert.equal(out.kind, 'REFUSED');
  safe(out);
  assert.deepEqual(f.calls, []);
});
test('completed port work cannot be reused after its bounded scope closes', async () => {
  const f = fixture(),
    capture = f.ports.attempts.capture;
  let check: () => void = () => {};
  f.ports.attempts.capture = async (r, w) => {
    check = w.check;
    return capture(r, w);
  };
  assert.equal((await f.run()).kind, 'COMPLETION_RECORDED');
  assert.throws(check, /Curriculum outline coordination is unavailable/);
  assert.equal(f.clock.timers.size, 0);
});

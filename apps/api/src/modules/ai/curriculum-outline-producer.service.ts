import { createHash } from 'node:crypto';
import { validateCurriculumBriefStructure } from '../admin/learning-paths/admin-curriculum-brief.schema.js';
import { validateProposalStructure } from '../admin/learning-paths/admin-learning-path-proposal.schema.js';
import type {
  AiProviderExecutionOptions,
  AiProviderRequest,
} from './ai-provider.contract.js';
import { aiUsageTimeAt } from './ai-usage-control.schema.js';
import {
  ledgerBoolean,
  ledgerDigest,
  ledgerEnum,
  ledgerHex,
  ledgerId,
  ledgerInteger,
  ledgerIntentFingerprint,
  ledgerNullable,
  ledgerObject,
  ledgerQuoteDigest,
  ledgerRequestDigest,
  ledgerUuid,
  validateLedgerOperation,
  validateLedgerQuote,
  validateReserveCommand,
} from './ai-usage-ledger.schema.js';
import {
  freezeOutline,
  outlineCompletionDigest,
  outlineContentDigest,
  outlineData,
  outlineDefinitionDigest,
  outlineIntentDigest,
  outlineProposal,
  outlineRawOutputDigest,
  outlineSource,
  outlineTimestamp,
  validateOutlineCandidate,
  validateOutlineIntent,
} from './curriculum-outline-candidate.schema.js';
import {
  outlineAdmissionCodes,
  proposeOutlineAdmission,
} from './curriculum-outline-admission.policy.js';
import { validateCurriculumOutline } from './curriculum-outline.validator.js';

/** OFFLINE boundary only. No production composition/registration or native writer.
 * Ports must independently establish current authority, primary-snapshot lineage,
 * User + origin Session + cancellation fences and atomic audits/known cleanup.
 * Supplied projections and booleans cannot establish those guarantees here.
 */
export interface OutlineWork {
  readonly signal: AbortSignal;
  readonly remainingMs: number;
  readonly commitMs: 2000;
  readonly abortMs: 2000;
  readonly endSessionMs: 2000;
  check(): void;
}

// Additive pure codec exports for the unregistered native attempt store. No
// coordinator port, orchestration, ACK parser or production registration changes.
export {
  bindingFields as outlineAttemptBindingFields,
  parseBinding as parseOutlineAttemptBinding,
  bindingDigest as outlineAttemptBindingDigest,
  invocation as parseOutlineInvocation,
  completion as parseOutlineCompletion,
  receipt as parseOutlineReceipt,
  attempt as parseOutlineAttempt,
  getBinding as outlineAttemptBinding,
  checkpointDigest as outlineCheckpointDigest,
  audit as parseOutlineCompletionAudit,
};
export type { AttemptBinding, Attempt, Invocation, Completion };
export interface OutlineClock {
  now(): number;
  monotonic(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
export interface OutlineProducerPorts {
  clock: OutlineClock;
  /** Sticky observation of logout/demotion/cancellation; not proof of durable revocation. */
  loss: AbortSignal;
  authority: {
    check(
      binding: Readonly<AttemptBinding>,
      stage: 'CLAIM' | 'MARK' | 'INVOKE' | 'CAPTURE' | 'READ',
      sessionId: string,
      work: OutlineWork,
    ): Promise<unknown>;
  };
  ledger: {
    /** Adapter to existing claimDispatch. Return ACK + independent full native proof. */
    claimDispatch(
      command: Readonly<{ operationId: string; expectedVersion: number }>,
      context: Readonly<{
        claimId: string;
        ownerId: string;
        request: Readonly<AiProviderRequest>;
      }>,
      work: OutlineWork,
    ): Promise<unknown>;
    readClaim(
      binding: Readonly<AttemptBinding>,
      work: OutlineWork,
    ): Promise<unknown>;
  };
  attempts: {
    mark(
      request: Readonly<{
        binding: AttemptBinding;
        expectedVersion: number;
        invocation: Invocation;
      }>,
      work: OutlineWork,
    ): Promise<unknown>;
    capture(
      request: Readonly<{
        binding: AttemptBinding;
        expectedVersion: number;
        invocation: Invocation;
        completion: Completion;
        audit: CompletionAudit;
      }>,
      work: OutlineWork,
    ): Promise<unknown>;
    /** Exact actor/attempt/operation/Technology primary read, no-store. Never writes. */
    read(
      binding: Readonly<AttemptBinding>,
      work: OutlineWork,
    ): Promise<unknown>;
  };
  executor: {
    execute(
      request: Readonly<AiProviderRequest>,
      options: AiProviderExecutionOptions,
    ): Promise<unknown>;
  };
}
const invalid = () =>
  new Error('Curriculum outline coordination is unavailable');
const one = (v: unknown): 1 => {
  if (v !== 1) throw invalid();
  return 1;
};
const scope = (v: unknown): 'SHARED_AI_TESTING' => {
  if (v !== 'SHARED_AI_TESTING') throw invalid();
  return v;
};
const bindingFields = {
  _id: ledgerId,
  schemaVersion: one,
  scope,
  actorId: ledgerId,
  sessionId: ledgerId,
  operationId: ledgerUuid,
  technologyId: ledgerId,
  brief: outlineSource,
  proposal: outlineProposal,
  ledgerOperationId: ledgerId,
  ledgerIntentFingerprint: ledgerDigest,
  intentDigest: ledgerDigest,
  requestDigest: ledgerDigest,
  templateVersion: ledgerUuid,
  quoteDigest: ledgerDigest,
  outlineRevisionId: ledgerId,
  outlineId: ledgerId,
  terminalAuditId: ledgerId,
  completionAuditId: ledgerId,
  createdAt: outlineTimestamp,
};
type AttemptBinding = ReturnType<typeof parseBinding>;
function parseBinding(v: unknown) {
  return ledgerObject(v, bindingFields);
}
const hash = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v), 'utf8').digest('hex');
function bindingDigest(a: AttemptBinding): string {
  return hash([
    'F054_OUTLINE_ATTEMPT',
    1,
    a._id,
    a.scope,
    a.actorId,
    a.sessionId,
    a.operationId,
    a.technologyId,
    [a.brief.id, 1, a.brief.digest],
    [a.proposal.id, a.proposal.proposalId, 1, a.proposal.digest],
    a.ledgerOperationId,
    a.ledgerIntentFingerprint,
    a.intentDigest,
    a.requestDigest,
    a.templateVersion,
    a.quoteDigest,
    a.outlineRevisionId,
    a.outlineId,
    a.terminalAuditId,
    a.completionAuditId,
    a.createdAt,
  ]);
}
function invocation(v: unknown) {
  return ledgerObject(v, {
    claimVersion: (n) => ledgerInteger(n, 1),
    id: ledgerUuid,
    ownerId: ledgerUuid,
    claimedAt: outlineTimestamp,
    observeUntil: outlineTimestamp,
    markedAt: outlineTimestamp,
  });
}
type Invocation = ReturnType<typeof invocation>;
function producer(v: unknown) {
  return ledgerObject(v, {
    attemptId: ledgerId,
    ledgerOperationId: ledgerId,
    operationId: ledgerUuid,
    claimId: ledgerUuid,
    ownerId: ledgerUuid,
    intentDigest: ledgerDigest,
    requestDigest: ledgerDigest,
    rawOutputDigest: ledgerDigest,
    completionDigest: ledgerDigest,
    templateVersion: ledgerUuid,
    completedAt: outlineTimestamp,
  });
}
function completion(v: unknown) {
  return ledgerObject(v, {
    schemaVersion: one,
    producer,
    rawOutput: (r) => {
      outlineRawOutputDigest(r);
      return r as string;
    },
    createdAt: outlineTimestamp,
    checkpointDigest: ledgerDigest,
  });
}
type Completion = ReturnType<typeof completion>;
function receipt(v: unknown) {
  const r = outlineData(v) as Record<string, unknown>;
  return r.kind === 'COMMITTED'
    ? ledgerObject(r, {
        kind: (x) => ledgerEnum(x, ['COMMITTED'] as const),
        candidateId: ledgerId,
        revision: one,
        definitionDigest: ledgerDigest,
        auditId: ledgerId,
      })
    : ledgerObject(r, {
        kind: (x) => ledgerEnum(x, ['REFUSED'] as const),
        code: (x) => ledgerEnum(x, outlineAdmissionCodes),
        auditId: ledgerId,
      });
}
function attempt(v: unknown) {
  const a = ledgerObject(v, {
    ...bindingFields,
    bindingDigest: ledgerDigest,
    version: ledgerInteger,
    phase: (x) =>
      ledgerEnum(x, [
        'PREPARED',
        'INVOCATION_MARKED',
        'COMPLETION_STORED',
        'ADMITTED',
        'REFUSED',
      ] as const),
    invocation: ledgerNullable(invocation),
    completion: ledgerNullable(completion),
    cancelledAt: ledgerNullable(outlineTimestamp),
    receipt: ledgerNullable(receipt),
  });
  if (
    bindingDigest(a) !== a.bindingDigest ||
    a.outlineId === a.outlineRevisionId ||
    a.terminalAuditId === a.completionAuditId
  )
    throw invalid();
  const { phase: p, invocation: i, completion: c, receipt: r } = a;
  if (
    p === 'PREPARED'
      ? i !== null ||
        c !== null ||
        r !== null ||
        (a.cancelledAt === null ? a.version !== 0 : a.version < 1)
      : p === 'INVOCATION_MARKED'
        ? !i || c !== null || r !== null || a.version < 1
        : p === 'COMPLETION_STORED'
          ? !i || !c || r !== null || a.version < 2
          : p === 'ADMITTED'
            ? !i || !c || r?.kind !== 'COMMITTED' || a.version < 3
            : !i || r?.kind !== 'REFUSED' || a.version < 2
  )
    throw invalid();
  return freezeOutline(a);
}
type Attempt = ReturnType<typeof attempt>;
const ms = (v: string) => new Date(v).getTime();
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function getBinding(a: Attempt): AttemptBinding {
  return parseBinding(
    Object.fromEntries(
      Object.keys(bindingFields).map((k) => [k, a[k as keyof Attempt]]),
    ),
  );
}
function checkpointDigest(
  b: AttemptBinding,
  i: Invocation,
  c: Pick<Completion, 'producer' | 'createdAt'>,
) {
  return hash([
    'F054_OUTLINE_CHECKPOINT',
    1,
    bindingDigest(b),
    [i.claimVersion, i.id, i.ownerId, i.claimedAt, i.observeUntil, i.markedAt],
    c.producer.completionDigest,
    c.createdAt,
  ]);
}
function audit(v: unknown) {
  return ledgerObject(v, {
    id: ledgerId,
    action: (x) =>
      ledgerEnum(x, [
        'CURRICULUM_OUTLINE_COMPLETION_STORED',
        'CURRICULUM_OUTLINE_ADMITTED',
        'CURRICULUM_OUTLINE_ADMISSION_REFUSED',
      ] as const),
    actorId: ledgerId,
    attemptId: ledgerId,
    technologyId: ledgerId,
    operationId: ledgerUuid,
    digest: ledgerDigest,
    createdAt: outlineTimestamp,
  });
}
type CompletionAudit = ReturnType<typeof audit>;
export type OutlineProducerResult = Readonly<{
  kind:
    | 'COMPLETION_RECORDED'
    | 'ADMITTED'
    | 'REFUSED'
    | 'UNRESOLVED'
    | 'OUTCOME_UNKNOWN';
  message:
    | 'Curriculum outline coordination is unavailable'
    | 'Existing outline evidence verified';
}>;
function result(kind: OutlineProducerResult['kind']): OutlineProducerResult {
  return Object.freeze({
    kind,
    message:
      kind === 'COMPLETION_RECORDED' || kind === 'ADMITTED'
        ? 'Existing outline evidence verified'
        : 'Curriculum outline coordination is unavailable',
  });
}

/** One retained, single-use original context. Recreating it never revives a marker.
 * Every exercised port in this checkpoint is a synthetic double. Native adapters,
 * authentic claim/audit readers and Session/demotion serialization do not exist here.
 */
export function createCurriculumOutlineProducer(
  input: unknown,
  ports: OutlineProducerPorts,
) {
  // Retain a fresh inert snapshot; caller edits cannot retarget this context.
  let consumed = false;
  // Content-free local comparison only; it grants no authority and retains no raw output.
  let expectedCompletion:
    Pick<Completion, 'producer' | 'createdAt' | 'checkpointDigest'> | undefined;
  function readInput() {
    return ledgerObject(input, {
      attempt,
      command: validateReserveCommand,
      expectedVersion: (v) => ledgerInteger(v, 1),
      claimId: ledgerUuid,
      ownerId: ledgerUuid,
    });
  }
  const retained = (() => {
    try {
      return freezeOutline(readInput());
    } catch {
      return null;
    }
  })();
  function parse() {
    if (!retained) throw invalid();
    return retained;
  }
  function clock() {
    const next = {
      utc: ledgerInteger(ports.clock.now(), 0, 253402280199999),
      mono: ledgerInteger(ports.clock.monotonic()),
    };
    if (lastClock && (next.utc < lastClock.utc || next.mono < lastClock.mono))
      throw invalid();
    lastClock = next;
    return next;
  }
  let lastClock: { utc: number; mono: number } | undefined;
  async function bounded<T>(
    signal: AbortSignal,
    start: ReturnType<typeof clock>,
    limit: number,
    fn: (work: OutlineWork) => Promise<T>,
    observeLoss = true,
  ): Promise<T> {
    const controller = new AbortController();
    const check = () => {
      const t = clock();
      if (
        signal.aborted ||
        controller.signal.aborted ||
        (observeLoss && ports.loss.aborted) ||
        t.mono < start.mono ||
        t.utc < start.utc ||
        t.mono - start.mono >= limit ||
        t.utc - start.utc >= limit
      )
        throw invalid();
    };
    check();
    const remainingMs = Math.min(
      limit - (clock().mono - start.mono),
      limit - (clock().utc - start.utc),
    );
    let timer: unknown;
    let armed = false;
    let abort: () => void = () => {};
    const stopped = new Promise<never>((_, reject) => {
      abort = () => {
        controller.abort();
        reject(invalid());
      };
      signal.addEventListener('abort', abort, { once: true });
      if (observeLoss)
        ports.loss.addEventListener('abort', abort, { once: true });
      timer = ports.clock.setTimeout(abort, remainingMs);
      armed = true;
    });
    try {
      const value = await Promise.race([
        Promise.resolve().then(() => {
          if (!armed) throw invalid();
          check();
          return fn(
            Object.freeze({
              signal: controller.signal,
              remainingMs,
              commitMs: 2000 as const,
              abortMs: 2000 as const,
              endSessionMs: 2000 as const,
              check,
            }),
          );
        }),
        stopped,
      ]);
      check();
      return value;
    } finally {
      controller.abort();
      try {
        ports.clock.clearTimeout(timer);
      } finally {
        signal.removeEventListener('abort', abort);
        ports.loss.removeEventListener('abort', abort);
      }
    }
  }
  function checkBinding(
    a: AttemptBinding,
    command: ReturnType<typeof validateReserveCommand>,
  ) {
    const intent = validateOutlineIntent({
      schemaVersion: 1,
      technologyId: a.technologyId,
      brief: a.brief,
      proposal: a.proposal,
      operationId: a.operationId,
    });
    if (
      a.ledgerIntentFingerprint !==
        ledgerIntentFingerprint({ actorId: a.actorId, command }) ||
      a.requestDigest !== ledgerRequestDigest(commandProjection(command)) ||
      a.intentDigest !==
        outlineIntentDigest({
          actorId: a.actorId,
          intent,
          ledgerIntentFingerprint: a.ledgerIntentFingerprint,
          templateVersion: a.templateVersion,
        }) ||
      command.operationId !== a.operationId ||
      command.technologyId !== a.technologyId ||
      !same(command.source, a.brief)
    )
      throw invalid();
    return intent;
  }
  async function authorize(
    a: AttemptBinding,
    cmd: ReturnType<typeof validateReserveCommand>,
    stage: Parameters<OutlineProducerPorts['authority']['check']>[1],
    sessionId: string,
    signal: AbortSignal,
    start = clock(),
    limit = 5000,
  ) {
    const raw = await bounded(
      signal,
      start,
      limit,
      (w) => ports.authority.check(freezeOutline(a), stage, sessionId, w),
      stage !== 'READ',
    );
    const r = ledgerObject(raw, {
      actorId: ledgerId,
      sessionId: ledgerId,
      attemptId: ledgerId,
      bindingDigest: ledgerDigest,
      currentAdmin: ledgerBoolean,
      sourceAdmitted: ledgerBoolean,
      controlsCurrent: ledgerBoolean,
      technologyStatus: (v) =>
        ledgerEnum(v, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const),
      brief: validateCurriculumBriefStructure,
      proposal: validateProposalStructure,
      quote: validateLedgerQuote,
    });
    const b = r.brief,
      p = r.proposal,
      q = r.quote;
    if (
      !r.currentAdmin ||
      !r.sourceAdmitted ||
      (stage !== 'READ' &&
        (!r.controlsCurrent || r.technologyStatus === 'ARCHIVED')) ||
      r.actorId !== a.actorId ||
      r.sessionId !== sessionId ||
      r.attemptId !== a._id ||
      r.bindingDigest !== bindingDigest(a) ||
      b._id !== a.brief.id ||
      b.contentDigest !== a.brief.digest ||
      b.technologyId !== a.technologyId ||
      b.operationId === a.operationId ||
      p._id !== a.proposal.id ||
      p.proposalId !== a.proposal.proposalId ||
      p.revision !== 1 ||
      p.definitionDigest !== a.proposal.digest ||
      p.technologyId !== a.technologyId ||
      !same(p.source, a.brief) ||
      ledgerQuoteDigest(q) !== a.quoteDigest ||
      q.templateVersion !== a.templateVersion ||
      q.requestDigest !== a.requestDigest ||
      !same(q.requestBounds, cmd.requestBounds) ||
      cmd.inputJson !==
        JSON.stringify({
          title: b.title,
          objectives: b.objectives,
          audience: b.audience,
          depth: b.depth,
          runtime: b.runtime,
          technologyVersion: b.technologyVersion,
          prerequisites: b.prerequisites,
        })
    )
      throw invalid();
    if (stage !== 'READ' && stage !== 'CAPTURE') {
      const now = clock().utc;
      if (
        now < q.effectiveAtMs ||
        now >= q.expiresAtMs ||
        aiUsageTimeAt(now).periodKey !== q.periodKey
      )
        throw invalid();
    }
    return r;
  }
  function claimProof(
    raw: unknown,
    a: AttemptBinding,
    cmd: ReturnType<typeof validateReserveCommand>,
    claimId: string,
    ownerId: string,
    dispatch: boolean,
  ) {
    const r = ledgerObject(raw, {
      operation: validateLedgerOperation,
      audit: (v) =>
        ledgerObject(v, {
          id: ledgerId,
          action: (x) => ledgerEnum(x, ['AI_USAGE_DISPATCH_CLAIMED'] as const),
          operationId: ledgerId,
          actorId: ledgerId,
          claimId: ledgerUuid,
          ownerId: ledgerUuid,
          claimVersion: (x) => ledgerInteger(x, 1),
        }),
    });
    const o = r.operation,
      c = o.claim;
    if (
      !c ||
      ledgerHex(o._id) !== a.ledgerOperationId ||
      ledgerHex(o.actorId) !== a.actorId ||
      o.operationId !== a.operationId ||
      ledgerHex(o.technologyId) !== a.technologyId ||
      ledgerHex(o.source.id) !== a.brief.id ||
      o.source.digest !== a.brief.digest ||
      o.intentFingerprint !== a.ledgerIntentFingerprint ||
      o.requestDigest !== a.requestDigest ||
      o.quoteDigest !== a.quoteDigest ||
      !same(o.requestBounds, cmd.requestBounds) ||
      c.id !== claimId ||
      c.ownerId !== ownerId ||
      r.audit.operationId !== a.ledgerOperationId ||
      r.audit.actorId !== a.actorId ||
      r.audit.claimId !== claimId ||
      r.audit.ownerId !== ownerId ||
      o.version < r.audit.claimVersion ||
      (dispatch &&
        (o.state !== 'DISPATCH_CLAIMED' ||
          o.version !== r.audit.claimVersion ||
          ledgerHex(o.lastAuditId) !== r.audit.id))
    )
      throw invalid();
    return {
      claimVersion: r.audit.claimVersion,
      id: c.id,
      ownerId: c.ownerId,
      claimedAt: c.claimedAt.toISOString(),
      observeUntil: c.observeUntil.toISOString(),
    };
  }
  function marker(
    a: AttemptBinding,
    i: Invocation,
    cmd: ReturnType<typeof validateReserveCommand>,
  ) {
    if (
      ms(a.createdAt) > ms(i.claimedAt) ||
      ms(i.claimedAt) > ms(i.markedAt) ||
      ms(i.markedAt) >= ms(i.observeUntil) ||
      ms(i.observeUntil) - ms(i.claimedAt) !== cmd.requestBounds.budgetMs
    )
      throw invalid();
  }
  function materialize(
    a: AttemptBinding,
    i: Invocation,
    c: Completion,
    r: Awaited<ReturnType<typeof authorize>>,
    cmd: ReturnType<typeof validateReserveCommand>,
    inspection = false,
  ) {
    marker(a, i, cmd);
    const p = c.producer;
    const rawHash = outlineRawOutputDigest(c.rawOutput);
    if (
      Buffer.byteLength(c.rawOutput, 'utf8') >
        cmd.requestBounds.maxOutputBytes ||
      p.rawOutputDigest !== rawHash ||
      ms(p.completedAt) < ms(i.markedAt) ||
      ms(p.completedAt) >= ms(i.observeUntil) ||
      ms(c.createdAt) < ms(p.completedAt) ||
      checkpointDigest(a, i, c) !== c.checkpointDigest
    )
      throw invalid();
    const body = ledgerObject(outlineData(JSON.parse(c.rawOutput)), {
      title: (v) => v,
      modules: (v) => v,
    });
    const validated = validateCurriculumOutline(
      JSON.stringify({
        schemaVersion: 1,
        technologyId: a.technologyId,
        source: a.brief,
        title: body.title,
        modules: body.modules,
      }),
      r.brief,
    );
    if (!validated.ok) throw invalid();
    const definition = {
      _id: a.outlineRevisionId,
      outlineId: a.outlineId,
      schemaVersion: 1,
      revision: 1,
      origin: 'AI_GENERATED',
      outline: validated.outline,
      proposal: a.proposal,
      createdBy: a.actorId,
      createdAt: c.createdAt,
      producer: p,
      contentDigest: outlineContentDigest(validated.outline),
    };
    const candidate = validateOutlineCandidate({
      ...definition,
      definitionDigest: outlineDefinitionDigest(definition),
    });
    const proposed = proposeOutlineAdmission({
      candidate,
      rawOutput: c.rawOutput,
      brief: r.brief,
      proposal: r.proposal,
      context: {
        actorId: a.actorId,
        intent: checkBinding(a, cmd),
        command: cmd,
        ledgerOperationId: a.ledgerOperationId,
        attemptId: a._id,
        outlineRevisionId: a.outlineRevisionId,
        outlineId: a.outlineId,
        claimId: i.id,
        ownerId: i.ownerId,
        templateVersion: a.templateVersion,
        completionDigest: p.completionDigest,
        createdAt: c.createdAt,
        completedAt: p.completedAt,
        currentAdmin: true,
        sourceAdmitted: true,
        producerVerified: true,
        // Historical eligible-parent correspondence only, never current admission authority.
        attemptUnused: true,
        technologyStatus:
          inspection && r.technologyStatus === 'ARCHIVED'
            ? 'DRAFT'
            : r.technologyStatus,
      },
    });
    if (proposed.kind !== 'ADMISSION_PROPOSED') throw invalid();
    return candidate;
  }
  function verifyAudit(
    v: unknown,
    a: AttemptBinding,
    id: string,
    action: CompletionAudit['action'],
    digest: string,
  ) {
    const x = audit(v);
    if (
      x.id !== id ||
      x.action !== action ||
      x.actorId !== a.actorId ||
      x.attemptId !== a._id ||
      x.technologyId !== a.technologyId ||
      x.operationId !== a.operationId ||
      x.digest !== digest
    )
      throw invalid();
    return x;
  }
  function verifyTerminalAudit(
    v: unknown,
    a: AttemptBinding,
    code: string | null,
  ) {
    const x = ledgerObject(v, {
      id: ledgerId,
      action: (n) =>
        ledgerEnum(n, [
          'CURRICULUM_OUTLINE_ADMITTED',
          'CURRICULUM_OUTLINE_ADMISSION_REFUSED',
        ] as const),
      actorId: ledgerId,
      attemptId: ledgerId,
      technologyId: ledgerId,
      operationId: ledgerUuid,
      outlineId: ledgerId,
      revision: one,
      code: ledgerNullable((n) => ledgerEnum(n, outlineAdmissionCodes)),
      createdAt: outlineTimestamp,
    });
    if (
      x.id !== a.terminalAuditId ||
      x.actorId !== a.actorId ||
      x.attemptId !== a._id ||
      x.technologyId !== a.technologyId ||
      x.operationId !== a.operationId ||
      x.outlineId !== a.outlineId ||
      x.code !== code ||
      x.action !==
        (code === null
          ? 'CURRICULUM_OUTLINE_ADMITTED'
          : 'CURRICULUM_OUTLINE_ADMISSION_REFUSED')
    )
      throw invalid();
    return x;
  }
  function commandProjection(cmd: ReturnType<typeof validateReserveCommand>) {
    return { instructions: cmd.instructions, inputJson: cmd.inputJson };
  }
  function providerRequest(
    cmd: ReturnType<typeof validateReserveCommand>,
  ): AiProviderRequest {
    return {
      schemaVersion: 1,
      purpose: 'CURRICULUM_OUTLINE',
      ...commandProjection(cmd),
      maxOutputBytes: cmd.requestBounds.maxOutputBytes,
      maxOutputTokens: cmd.requestBounds.maxOutputTokens,
    };
  }
  return Object.freeze({
    async run(signal: AbortSignal): Promise<OutlineProducerResult> {
      if (consumed) return result('UNRESOLVED');
      consumed = true;
      let sent: 'NONE' | 'CLAIM' | 'MARK' | 'CALL' | 'CAPTURE' = 'NONE';
      try {
        const x = parse(),
          a = getBinding(x.attempt),
          cmd = x.command;
        if (x.attempt.phase !== 'PREPARED' || x.attempt.cancelledAt !== null)
          return result('UNRESOLVED');
        checkBinding(a, cmd);
        await authorize(a, cmd, 'CLAIM', a.sessionId, signal);
        sent = 'CLAIM';
        const claimed = ledgerObject(
          await bounded(signal, clock(), 10000, (w) =>
            ports.ledger.claimDispatch(
              freezeOutline({
                operationId: a.operationId,
                expectedVersion: x.expectedVersion,
              }),
              freezeOutline({
                claimId: x.claimId,
                ownerId: x.ownerId,
                request: providerRequest(cmd),
              }),
              w,
            ),
          ),
          {
            kind: (v) => ledgerEnum(v, ['RECORDED'] as const),
            cleanup: (v) => ledgerEnum(v, ['COMPLETE'] as const),
            proof: (v) => v,
          },
        );
        let claim = claimProof(
          claimed.proof,
          a,
          cmd,
          x.claimId,
          x.ownerId,
          true,
        );
        await authorize(a, cmd, 'MARK', a.sessionId, signal);
        const i = freezeOutline({
          ...claim,
          markedAt: new Date(clock().utc).toISOString(),
        });
        marker(a, i, cmd);
        sent = 'MARK';
        const marked = ledgerObject(
          await bounded(signal, clock(), 10000, (w) =>
            ports.attempts.mark(
              freezeOutline({
                binding: a,
                expectedVersion: x.attempt.version,
                invocation: i,
              }),
              w,
            ),
          ),
          {
            kind: (v) => ledgerEnum(v, ['RECORDED'] as const),
            cleanup: (v) => ledgerEnum(v, ['COMPLETE'] as const),
            attempt,
          },
        );
        if (
          !same(getBinding(marked.attempt), a) ||
          marked.attempt.version !== x.attempt.version + 1 ||
          marked.attempt.phase !== 'INVOCATION_MARKED' ||
          marked.attempt.cancelledAt !== null ||
          !same(marked.attempt.invocation, i)
        )
          throw invalid();
        claim = claimProof(
          await bounded(signal, clock(), 5000, (w) =>
            ports.ledger.readClaim(freezeOutline(a), w),
          ),
          a,
          cmd,
          x.claimId,
          x.ownerId,
          true,
        );
        if (
          !same(claim, {
            claimVersion: i.claimVersion,
            id: i.id,
            ownerId: i.ownerId,
            claimedAt: i.claimedAt,
            observeUntil: i.observeUntil,
          })
        )
          throw invalid();
        const finalAuthority = await authorize(
          a,
          cmd,
          'INVOKE',
          a.sessionId,
          signal,
        );
        const callStart = clock();
        const budget = Math.min(
          cmd.requestBounds.budgetMs,
          ms(i.observeUntil) - callStart.utc,
        );
        if (
          budget < 1 ||
          ports.loss.aborted ||
          signal.aborted ||
          callStart.utc >= finalAuthority.quote.expiresAtMs ||
          aiUsageTimeAt(callStart.utc).periodKey !==
            finalAuthority.quote.periodKey
        )
          throw invalid();
        sent = 'CALL';
        const raw = await bounded(signal, callStart, budget, (w) => {
          const dispatch = clock();
          const remaining = Math.min(
            w.remainingMs,
            ms(i.observeUntil) - dispatch.utc,
            budget - (dispatch.mono - callStart.mono),
          );
          if (
            remaining < 1 ||
            dispatch.utc >= finalAuthority.quote.expiresAtMs ||
            aiUsageTimeAt(dispatch.utc).periodKey !==
              finalAuthority.quote.periodKey
          )
            throw invalid();
          w.check();
          return ports.executor.execute(freezeOutline(providerRequest(cmd)), {
            budgetMs: remaining,
            signal: w.signal,
          });
        });
        const observed = clock(); // Includes validation and awaited capture work; never reset.
        if (observed.utc >= ms(i.observeUntil)) throw invalid();
        const out = ledgerObject(raw, {
          ok: (v) => {
            if (v !== true) throw invalid();
            return true;
          },
          untrustedJson: (v) => {
            outlineRawOutputDigest(v);
            return v as string;
          },
          usage: (v) =>
            ledgerObject(v, {
              inputTokens: ledgerNullable(ledgerInteger),
              outputTokens: ledgerNullable(ledgerInteger),
            }),
          elapsedMs: ledgerInteger,
        });
        if (
          out.elapsedMs > budget ||
          (out.usage.outputTokens !== null &&
            out.usage.outputTokens > cmd.requestBounds.maxOutputTokens)
        )
          throw invalid();
        const completedAt = new Date(observed.utc).toISOString();
        const fields = {
          attemptId: a._id,
          ledgerOperationId: a.ledgerOperationId,
          operationId: a.operationId,
          claimId: i.id,
          ownerId: i.ownerId,
          intentDigest: a.intentDigest,
          requestDigest: a.requestDigest,
          rawOutputDigest: outlineRawOutputDigest(out.untrustedJson),
          templateVersion: a.templateVersion,
          completedAt,
        };
        const p = {
          ...fields,
          completionDigest: outlineCompletionDigest(fields, a.actorId),
        };
        const partial = {
          schemaVersion: 1 as const,
          producer: p,
          rawOutput: out.untrustedJson,
          createdAt: new Date(clock().utc).toISOString(),
        };
        const c = freezeOutline(
          completion({
            ...partial,
            checkpointDigest: checkpointDigest(a, i, partial),
          }),
        );
        const resolved = await authorize(
          a,
          cmd,
          'CAPTURE',
          a.sessionId,
          signal,
          observed,
          Math.min(5000, 10000),
        );
        materialize(a, i, c, resolved, cmd);
        const historical = claimProof(
          await bounded(signal, observed, 10000, (w) =>
            ports.ledger.readClaim(freezeOutline(a), w),
          ),
          a,
          cmd,
          x.claimId,
          x.ownerId,
          false,
        );
        if (
          !same(historical, {
            claimVersion: i.claimVersion,
            id: i.id,
            ownerId: i.ownerId,
            claimedAt: i.claimedAt,
            observeUntil: i.observeUntil,
          })
        )
          throw invalid();
        await authorize(a, cmd, 'CAPTURE', a.sessionId, signal, observed, 5000);
        const event = freezeOutline({
          id: a.completionAuditId,
          action: 'CURRICULUM_OUTLINE_COMPLETION_STORED' as const,
          actorId: a.actorId,
          attemptId: a._id,
          technologyId: a.technologyId,
          operationId: a.operationId,
          digest: c.checkpointDigest,
          createdAt: c.createdAt,
        });
        // work.check must also be honored inside the port immediately before commit.
        expectedCompletion = freezeOutline({
          producer: c.producer,
          createdAt: c.createdAt,
          checkpointDigest: c.checkpointDigest,
        });
        sent = 'CAPTURE';
        const saved = ledgerObject(
          await bounded(signal, observed, 10000, (w) =>
            ports.attempts.capture(
              freezeOutline({
                binding: a,
                expectedVersion: marked.attempt.version,
                invocation: i,
                completion: c,
                audit: event,
              }),
              w,
            ),
          ),
          {
            kind: (v) => ledgerEnum(v, ['RECORDED'] as const),
            cleanup: (v) => ledgerEnum(v, ['COMPLETE'] as const),
            attempt,
            audit,
          },
        );
        if (
          !same(getBinding(saved.attempt), a) ||
          saved.attempt.phase !== 'COMPLETION_STORED' ||
          saved.attempt.version !== marked.attempt.version + 1 ||
          saved.attempt.cancelledAt !== null ||
          !same(saved.attempt.invocation, i) ||
          !same(saved.attempt.completion, c) ||
          !same(saved.audit, event)
        )
          throw invalid();
        return result('COMPLETION_RECORDED');
      } catch {
        return result(
          sent === 'CLAIM' || sent === 'MARK' || sent === 'CAPTURE'
            ? 'OUTCOME_UNKNOWN'
            : sent === 'CALL'
              ? 'UNRESOLVED'
              : 'REFUSED',
        );
      }
    },
    /** Recovery is inspection only, even for PREPARED/missing rows or unknown ACKs. */
    async inspect(
      identity: unknown,
      signal: AbortSignal,
    ): Promise<OutlineProducerResult> {
      consumed = true; // Inspection cannot later be promoted back into invocation authority.
      try {
        const x = parse(),
          a = getBinding(x.attempt),
          cmd = x.command;
        const who = ledgerObject(identity, {
          actorId: ledgerId,
          sessionId: ledgerId,
        });
        if (who.actorId !== a.actorId) throw invalid();
        checkBinding(a, cmd);
        const r = await authorize(a, cmd, 'READ', who.sessionId, signal);
        const read = ledgerObject(
          await bounded(
            signal,
            clock(),
            10000,
            (w) => ports.attempts.read(freezeOutline(a), w),
            false,
          ),
          {
            attempt,
            completionAudit: (v) => v,
            terminalAudit: (v) => v,
            candidate: (v) => v,
          },
        );
        const stored = read.attempt;
        if (!same(getBinding(stored), a)) throw invalid();
        if (!stored.invocation) return result('UNRESOLVED');
        const i = stored.invocation;
        const proof = claimProof(
          await bounded(
            signal,
            clock(),
            5000,
            (w) => ports.ledger.readClaim(freezeOutline(a), w),
            false,
          ),
          a,
          cmd,
          i.id,
          i.ownerId,
          false,
        );
        if (
          !same(proof, {
            claimVersion: i.claimVersion,
            id: i.id,
            ownerId: i.ownerId,
            claimedAt: i.claimedAt,
            observeUntil: i.observeUntil,
          })
        )
          throw invalid();
        marker(a, i, cmd);
        let candidate;
        if (stored.completion) {
          if (
            expectedCompletion &&
            !same(expectedCompletion, {
              producer: stored.completion.producer,
              createdAt: stored.completion.createdAt,
              checkpointDigest: stored.completion.checkpointDigest,
            })
          )
            throw invalid();
          candidate = materialize(a, i, stored.completion, r, cmd, true);
          verifyAudit(
            read.completionAudit,
            a,
            a.completionAuditId,
            'CURRICULUM_OUTLINE_COMPLETION_STORED',
            stored.completion.checkpointDigest,
          );
        } else if (read.completionAudit !== null) throw invalid();
        if (
          stored.phase === 'ADMITTED' &&
          stored.receipt?.kind === 'COMMITTED' &&
          candidate
        ) {
          if (
            !same(validateOutlineCandidate(read.candidate), candidate) ||
            stored.receipt.candidateId !== candidate._id ||
            stored.receipt.definitionDigest !== candidate.definitionDigest ||
            stored.receipt.auditId !== a.terminalAuditId
          )
            throw invalid();
          verifyTerminalAudit(read.terminalAudit, a, null);
          return result('ADMITTED');
        }
        if (
          stored.phase === 'REFUSED' &&
          stored.receipt?.kind === 'REFUSED' &&
          read.candidate === null
        ) {
          if (stored.receipt.auditId !== a.terminalAuditId) throw invalid();
          verifyTerminalAudit(read.terminalAudit, a, stored.receipt.code);
          return result('REFUSED');
        }
        if (read.terminalAudit !== null || read.candidate !== null)
          throw invalid();
        return result(
          stored.phase === 'COMPLETION_STORED'
            ? 'COMPLETION_RECORDED'
            : 'UNRESOLVED',
        );
      } catch {
        return result('UNRESOLVED');
      }
    },
  });
}

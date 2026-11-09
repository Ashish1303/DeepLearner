import type { ClientSession, Db, Document, MongoClient } from 'mongodb';
import { Types } from 'mongoose';
import { types } from 'node:util';
import {
  ledgerDate,
  ledgerEnum,
  ledgerHex,
  ledgerId,
  ledgerInteger,
  ledgerNullable,
  ledgerObject,
  ledgerObjectId,
  ledgerSame,
  ledgerUuid,
  validateReserveCommand,
  validateLedgerOperation,
  ledgerQuoteDigest,
  ledgerIntentFingerprint,
  ledgerRequestDigest,
  validateLedgerQuote,
} from './ai-usage-ledger.schema.js';
import {
  validateLedgerAudit,
  assertLedgerAuditLink,
} from './ai-usage-ledger.repository.js';
import {
  parseOutlineAttemptBinding,
  outlineAttemptBindingDigest,
  parseOutlineInvocation,
  parseOutlineAttempt,
  outlineAttemptBinding,
  outlineCheckpointDigest,
  parseOutlineCompletionAudit,
  type AttemptBinding,
  type Invocation,
  type OutlineWork,
  type OutlineClock,
} from './curriculum-outline-producer.service.js';
import {
  freezeOutline,
  outlineData,
  outlineRawOutputDigest,
  outlineCompletionDigest,
  outlineIntentDigest,
  outlineTimestamp,
  validateOutlineCandidate,
} from './curriculum-outline-candidate.schema.js';
import { outlineAdmissionCodes } from './curriculum-outline-admission.policy.js';
import {
  validateCurriculumBriefRecord,
  curriculumBriefProposalBinding,
} from '../admin/learning-paths/admin-curriculum-brief.schema.js';
import { validateProposalRevisionCreation } from '../admin/learning-paths/admin-learning-path-proposal.schema.js';
import { aiUsageTimeAt } from './ai-usage-control.schema.js';
import {
  curriculumOutlineSchema,
  curriculumOutlineByteLimit,
} from './curriculum-outline.schema.js';

export class OutlineEvidenceFailure extends Error {
  constructor(
    readonly code:
      'SOURCE_UNAVAILABLE' | 'CONTROL_UNAVAILABLE' = 'CONTROL_UNAVAILABLE',
  ) {
    super('Curriculum outline evidence is unavailable');
  }
}
function invalid(): never {
  throw new OutlineEvidenceFailure();
}
const one = (value: unknown): 1 => {
  if (value !== 1) invalid();
  return 1;
};
const exact =
  <T extends string>(expected: T) =>
  (value: unknown): T => {
    if (value !== expected) invalid();
    return expected;
  };
const oid = (value: string) => new Types.ObjectId(ledgerId(value));
const requestId = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}(?![\s\S])/.test(value)
  )
    invalid();
  return value;
};
function field(value: unknown, key: string): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    types.isProxy(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid();
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (d && !('value' in d)) invalid();
  return d?.value;
}
export type OutlineEvidenceMode = 'PREPARE' | 'MARK' | 'CAPTURE' | 'EVIDENCE';
type Collection =
  | 'technologies'
  | 'curriculumBriefRevisions'
  | 'learningPathProposalRevisions'
  | 'aiUsageOperations'
  | 'auditLogs';
type ReadOptions = Readonly<{ session: ClientSession; projection?: Document }>;

/** Caller-owned bounded native read callbacks, not authority flags. Every callback
 * must honor the SAME supplied work/deadline/session; B delegates its existing
 * bounded callbacks unchanged. No transaction, timeout owner or default connection
 * is created here. The native driver rejects a foreign-client Session; no private
 * driver state is inspected. Genuine auth/policy/closed-writer qualification is a
 * separate caller obligation, not established by these types or synthetic doubles. */
export interface OutlineEvidenceReaderPorts {
  readonly db: Pick<Db, 'client'>;
  readonly client: MongoClient;
  readonly session: ClientSession;
  readonly work: OutlineWork;
  readonly clock: Pick<OutlineClock, 'now'>;
  readonly loss: AbortSignal;
  check(): void;
  findOne(
    collection: Collection,
    filter: Document,
    options: ReadOptions,
  ): Promise<unknown>;
  findMany(
    collection: Collection,
    filter: Document,
    options: ReadOptions & Readonly<{ limit: number }>,
  ): Promise<unknown>;
  readCommand(
    binding: Readonly<AttemptBinding>,
    context: Readonly<{ session: ClientSession; work: OutlineWork }>,
  ): Promise<unknown>;
}

/** Inert unregistered factory. Supplied native facts establish linkage only. */
export function createOutlineEvidenceReader(ports: OutlineEvidenceReaderPorts) {
  const { db, client, session, work, loss } = ports;
  let lastUtc = -1;
  function check() {
    work.check();
    ports.check();
    if (
      ports.db !== db ||
      ports.client !== client ||
      ports.session !== session ||
      ports.work !== work ||
      db.client !== client ||
      session.hasEnded !== false ||
      session.inTransaction() !== true ||
      loss.aborted ||
      work.signal.aborted
    )
      invalid();
    const remaining = work.remainingMs;
    if (!Number.isFinite(remaining) || remaining < 1 || remaining > 10000)
      invalid();
    const utc = ledgerInteger(ports.clock.now(), 0, 253402280199999);
    if (utc < lastUtc) invalid();
    lastUtc = utc;
  }
  async function find(
    collection: Collection,
    filter: Document,
    projection?: Document,
  ) {
    check();
    const result = await ports.findOne(collection, filter, {
      session,
      ...(projection ? { projection } : {}),
    });
    check();
    return result;
  }
  async function many(collection: Collection, filter: Document, limit: number) {
    check();
    ledgerInteger(limit, 1, 2);
    const result = await ports.findMany(collection, filter, { session, limit });
    check();
    if (
      !Array.isArray(result) ||
      types.isProxy(result) ||
      result.length > limit ||
      Reflect.ownKeys(result).length !== result.length + 1
    )
      invalid();
    const rows: unknown[] = [];
    for (let i = 0; i < result.length; i++) {
      const d = Object.getOwnPropertyDescriptor(result, String(i));
      if (!d || !('value' in d)) invalid();
      rows.push(d.value);
    }
    return rows;
  }
  async function command(binding: AttemptBinding) {
    check();
    const result = await ports.readCommand(freezeOutline(binding), {
      session,
      work,
    });
    check();
    return result;
  }
  async function read(input: unknown) {
    try {
      check();
      const request = ledgerObject(input, {
        binding: parseOutlineAttemptBinding,
        invocation: ledgerNullable(parseOutlineInvocation),
        mode: (v) =>
          ledgerEnum(v, ['PREPARE', 'MARK', 'CAPTURE', 'EVIDENCE'] as const),
      });
      const b = request.binding;
      if (
        b.outlineId === b.outlineRevisionId ||
        b.terminalAuditId === b.completionAuditId ||
        (request.mode === 'PREPARE' && request.invocation !== null) ||
        ((request.mode === 'MARK' || request.mode === 'CAPTURE') &&
          request.invocation === null)
      )
        invalid();
      const result = await readSourceAndLedger(
        b,
        { invocation: request.invocation },
        request.mode,
      );
      check();
      return Object.freeze(result);
    } catch (error) {
      if (error instanceof OutlineEvidenceFailure) throw error;
      throw new OutlineEvidenceFailure();
    }
  }
  async function readSourceAndLedger(
    b: AttemptBinding,
    a: { invocation: Invocation | null } | undefined,
    m: OutlineEvidenceMode,
  ) {
    const parent = ledgerObject(
      await find(
        'technologies',
        { _id: oid(b.technologyId) },
        { _id: 1, status: 1 },
      ),
      {
        _id: ledgerObjectId,
        status: (v) =>
          ledgerEnum(v, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const),
      },
    );
    if (
      ledgerHex(parent._id) !== b.technologyId ||
      (parent.status === 'ARCHIVED' && (m === 'PREPARE' || m === 'MARK'))
    )
      throw new OutlineEvidenceFailure('SOURCE_UNAVAILABLE');
    const briefRow = await find('curriculumBriefRevisions', {
      _id: oid(b.brief.id),
    });
    // F044's pure validators also accept canonical DTO identities. A native
    // stored source must prove its original BSON slots before normalization.
    for (const key of ['_id', 'technologyId', 'createdBy'])
      ledgerObjectId(field(briefRow, key));
    ledgerDate(field(briefRow, 'createdAt'));
    const brief = validateCurriculumBriefRecord(briefRow, b.technologyId);
    const proposalRow = await find('learningPathProposalRevisions', {
      _id: oid(b.proposal.id),
    });
    for (const key of ['_id', 'proposalId', 'technologyId'])
      ledgerObjectId(field(proposalRow, key));
    ledgerObjectId(field(field(proposalRow, 'source'), 'id'));
    ledgerDate(field(proposalRow, 'createdAt'));
    const proposal = validateProposalRevisionCreation(
      proposalRow,
      curriculumBriefProposalBinding(brief, b.technologyId),
    );
    if (
      brief.contentDigest !== b.brief.digest ||
      proposal.definitionDigest !== b.proposal.digest ||
      proposal.proposalId !== b.proposal.proposalId ||
      proposal.proposalId !== brief._id ||
      proposal.createdAt.getTime() !== brief.createdAt.getTime() ||
      brief.operationId === b.operationId
    )
      throw new OutlineEvidenceFailure('SOURCE_UNAVAILABLE');
    const content = (r: typeof brief | typeof proposal) => ({
      title: r.title,
      objectives: r.objectives,
      audience: r.audience,
      depth: r.depth,
      runtime: r.runtime,
      technologyVersion: r.technologyVersion,
      prerequisites: r.prerequisites,
    });
    if (!ledgerSame(content(brief), content(proposal))) invalid();
    const sourceAudit = await find('auditLogs', { _id: oid(brief._id) }),
      revisionAudit = await find('auditLogs', { _id: oid(proposal._id) });
    const validateSourceAudit = (raw: unknown, briefEvent: boolean) =>
      ledgerObject(raw, {
        _id: ledgerObjectId,
        category: exact('CONTENT_MANAGEMENT'),
        action: exact(
          briefEvent
            ? 'CURRICULUM_BRIEF_ADMITTED'
            : 'LEARNING_PATH_PROPOSAL_REVISION_CREATED',
        ),
        actorId: ledgerObjectId,
        resourceType: exact(
          briefEvent
            ? 'CURRICULUM_BRIEF_REVISION'
            : 'LEARNING_PATH_PROPOSAL_REVISION',
        ),
        resourceId: ledgerObjectId,
        requestId,
        createdAt: ledgerDate,
        metadata: (v) =>
          briefEvent
            ? ledgerObject(v, {
                technologyId: ledgerObjectId,
                revision: one,
                operationId: ledgerUuid,
              })
            : ledgerObject(v, {
                proposalId: ledgerObjectId,
                revision: one,
                sourceId: ledgerObjectId,
                sourceRevision: one,
              }),
      });
    const sa = validateSourceAudit(sourceAudit, true),
      pa = validateSourceAudit(revisionAudit, false);
    if (
      ledgerHex(sa._id) !== brief._id ||
      ledgerHex(sa.resourceId) !== brief._id ||
      ledgerHex(sa.actorId) !== brief.createdBy ||
      sa.createdAt.getTime() !== brief.createdAt.getTime() ||
      ledgerHex(ledgerObjectId(field(sa.metadata, 'technologyId'))) !==
        b.technologyId ||
      field(sa.metadata, 'operationId') !== brief.operationId ||
      ledgerHex(pa._id) !== proposal._id ||
      ledgerHex(pa.resourceId) !== proposal._id ||
      ledgerHex(pa.actorId) !== brief.createdBy ||
      pa.createdAt.getTime() !== proposal.createdAt.getTime() ||
      pa.requestId !== sa.requestId ||
      ledgerHex(ledgerObjectId(field(pa.metadata, 'proposalId'))) !==
        brief._id ||
      ledgerHex(ledgerObjectId(field(pa.metadata, 'sourceId'))) !== brief._id
    )
      invalid();
    const op = validateLedgerOperation(
      await find('aiUsageOperations', { _id: oid(b.ledgerOperationId) }),
    );
    const currentAudit = assertLedgerAuditLink(
      op,
      await find('auditLogs', { _id: op.lastAuditId }),
    );
    const cmd = validateReserveCommand(await command(b));
    if (
      ledgerHex(op._id) !== b.ledgerOperationId ||
      ledgerHex(op.actorId) !== b.actorId ||
      op.operationId !== b.operationId ||
      ledgerHex(op.technologyId) !== b.technologyId ||
      ledgerHex(op.source.id) !== b.brief.id ||
      op.source.digest !== b.brief.digest ||
      op.intentFingerprint !== b.ledgerIntentFingerprint ||
      op.requestDigest !== b.requestDigest ||
      op.quoteDigest !== b.quoteDigest ||
      ledgerQuoteDigest(validateLedgerQuote(op.quote)) !== b.quoteDigest ||
      op.quote.templateVersion !== b.templateVersion ||
      !ledgerSame(op.requestBounds, cmd.requestBounds) ||
      cmd.operationId !== b.operationId ||
      cmd.technologyId !== b.technologyId ||
      !ledgerSame(cmd.source, b.brief) ||
      cmd.inputJson !== JSON.stringify(content(brief)) ||
      ledgerRequestDigest({
        instructions: cmd.instructions,
        inputJson: cmd.inputJson,
      }) !== b.requestDigest ||
      ledgerIntentFingerprint({ actorId: b.actorId, command: cmd }) !==
        b.ledgerIntentFingerprint
    )
      invalid();
    const intent = {
      schemaVersion: 1,
      technologyId: b.technologyId,
      brief: b.brief,
      proposal: b.proposal,
      operationId: b.operationId,
    };
    if (
      outlineIntentDigest({
        actorId: b.actorId,
        intent,
        ledgerIntentFingerprint: b.ledgerIntentFingerprint,
        templateVersion: b.templateVersion,
      }) !== b.intentDigest
    )
      invalid();
    let dispatchAudit: ReturnType<typeof validateLedgerAudit> | null = null;
    if (m === 'PREPARE') {
      if (op.state !== 'RESERVED' || op.claim !== null) invalid();
    } else if (a?.invocation) {
      const i = a.invocation,
        c = op.claim;
      if (
        !c ||
        i.id !== c.id ||
        i.ownerId !== c.ownerId ||
        i.claimedAt !== c.claimedAt.toISOString() ||
        i.observeUntil !== c.observeUntil.toISOString() ||
        new Date(b.createdAt).getTime() > c.claimedAt.getTime() ||
        c.claimedAt.getTime() > Date.parse(i.markedAt) ||
        Date.parse(i.markedAt) >= c.observeUntil.getTime() ||
        c.observeUntil.getTime() - c.claimedAt.getTime() !==
          cmd.requestBounds.budgetMs
      )
        invalid();
      const auditRows = await many(
        'auditLogs',
        {
          resourceType: 'AI_USAGE_OPERATION',
          resourceId: op._id,
          'metadata.usageVersion': i.claimVersion,
        },
        2,
      );
      if (auditRows.length !== 1) invalid();
      const audit = validateLedgerAudit(auditRows[0]);
      dispatchAudit = audit;
      if (
        audit.action !== 'AI_USAGE_DISPATCH_CLAIMED' ||
        ledgerHex(audit.actorId) !== b.actorId ||
        ledgerHex(audit.resourceId) !== b.ledgerOperationId ||
        audit.metadata.operationId !== b.operationId ||
        ledgerHex(audit.metadata.originalActorId) !== b.actorId ||
        audit.metadata.usageVersion !== i.claimVersion ||
        audit.createdAt.toISOString() !== i.claimedAt ||
        op.version < i.claimVersion
      )
        invalid();
      // Reconstruct only the contract-defined dispatch-era projection of the
      // validated current operation. This is not a write/retry or a replacement
      // for separately validating the current accounting row/audit above.
      const historical = validateLedgerOperation({
        ...op,
        state: 'DISPATCH_CLAIMED',
        version: i.claimVersion,
        open: true,
        heldPaise: op.reservationPaise,
        actualPaise: null,
        terminalEvidence: null,
        safeCode: null,
        lastAuditId: audit._id,
        updatedAt: c.claimedAt,
      });
      assertLedgerAuditLink(historical, audit);
      if (
        m === 'MARK' &&
        (op.state !== 'DISPATCH_CLAIMED' ||
          op.version !== i.claimVersion ||
          ledgerHex(op.lastAuditId) !== ledgerHex(audit._id))
      )
        invalid();
    } else if (m !== 'EVIDENCE') invalid();
    if (m === 'PREPARE' || m === 'MARK') {
      const now = ports.clock.now();
      if (
        now < op.quote.effectiveAtMs ||
        now >= op.quote.expiresAtMs ||
        aiUsageTimeAt(now).periodKey !== op.quote.periodKey
      )
        invalid();
    }
    return {
      brief,
      proposal,
      cmd,
      parent: parent.status,
      sourceAudit: sa,
      proposalAudit: pa,
      operation: op,
      currentAudit,
      dispatchAudit,
      // Canonical audit is immutable. Native operation remains a fresh validated
      // copy; Date/BSON interiors are not a transferable immutable capability.
      claimProof:
        dispatchAudit && a?.invocation && op.claim
          ? Object.freeze({
              operation: validateLedgerOperation(op),
              audit: freezeOutline({
                id: ledgerHex(dispatchAudit._id),
                action: 'AI_USAGE_DISPATCH_CLAIMED' as const,
                operationId: b.ledgerOperationId,
                actorId: b.actorId,
                claimId: op.claim.id,
                ownerId: op.claim.ownerId,
                claimVersion: a.invocation.claimVersion,
              }),
            })
          : null,
    };
  }
  // No accounting, content mutation, admission or authority flag is produced.
  return Object.freeze({ read });
}

const terminalAudit = (input: unknown) =>
  ledgerObject(input, {
    id: ledgerId,
    action: (v) =>
      ledgerEnum(v, [
        'CURRICULUM_OUTLINE_ADMITTED',
        'CURRICULUM_OUTLINE_ADMISSION_REFUSED',
      ] as const),
    actorId: ledgerId,
    attemptId: ledgerId,
    technologyId: ledgerId,
    operationId: ledgerUuid,
    outlineId: ledgerId,
    revision: one,
    code: ledgerNullable((v) => ledgerEnum(v, outlineAdmissionCodes)),
    createdAt: outlineTimestamp,
  });

/** Strict data projection of a known-clean B EVIDENCE read, never an ACK or an
 * authorization capability. The caller must first perform the actual B read in
 * a freshly authorized current-request context, enforcing source/history/privacy
 * policy. This function verifies available closed fields/bindings/hashes, not
 * authenticity of supplied facts or a claim that its caller accessed storage.
 * The coordinator independently revalidates source/claim/P1 on inspection. */
export function outlineCoordinatorRead(input: unknown, expectedInput: unknown) {
  try {
    const expected = ledgerObject(expectedInput, {
      binding: parseOutlineAttemptBinding,
      actorId: ledgerId,
      requestingSessionId: ledgerId,
    });
    const b = expected.binding;
    if (expected.actorId !== b.actorId) invalid();
    const result = ledgerObject(input, {
      kind: exact('OBSERVED'),
      cleanup: exact('COMPLETE'),
      evidence: (v) =>
        ledgerObject(v, {
          kind: exact('EXACT'),
          attempt: parseOutlineAttempt,
          completionAudit: ledgerNullable(parseOutlineCompletionAudit),
          terminalAudit: ledgerNullable(terminalAudit),
          candidate: ledgerNullable(validateOutlineCandidate),
        }),
    });
    const e = result.evidence,
      a = e.attempt,
      i = a.invocation,
      c = a.completion;
    if (
      !ledgerSame(outlineAttemptBinding(a), b) ||
      a.bindingDigest !== outlineAttemptBindingDigest(b)
    )
      invalid();
    const terminal = a.phase === 'ADMITTED' || a.phase === 'REFUSED';
    const base =
      a.phase === 'PREPARED'
        ? 0
        : a.phase === 'INVOCATION_MARKED'
          ? 1
          : a.phase === 'COMPLETION_STORED'
            ? 2
            : a.phase === 'ADMITTED'
              ? 3
              : c
                ? 3
                : 2;
    if (
      a.version !== base + (a.cancelledAt ? 1 : 0) ||
      (terminal && a.cancelledAt !== null)
    )
      invalid();
    if (
      i &&
      (Date.parse(b.createdAt) > Date.parse(i.claimedAt) ||
        Date.parse(i.claimedAt) > Date.parse(i.markedAt) ||
        Date.parse(i.markedAt) >= Date.parse(i.observeUntil) ||
        Date.parse(i.observeUntil) - Date.parse(i.claimedAt) > 10000)
    )
      invalid();
    if (
      a.cancelledAt &&
      Date.parse(a.cancelledAt) <
        Math.max(
          Date.parse(b.createdAt),
          i ? Date.parse(i.markedAt) : 0,
          c ? Date.parse(c.createdAt) : 0,
        )
    )
      invalid();
    let outline: ReturnType<typeof curriculumOutlineSchema.parse> | null = null;
    if (c) {
      if (!i) invalid();
      const p = c.producer;
      const { completionDigest, ...definition } = p;
      if (
        p.attemptId !== b._id ||
        p.ledgerOperationId !== b.ledgerOperationId ||
        p.operationId !== b.operationId ||
        p.claimId !== i.id ||
        p.ownerId !== i.ownerId ||
        p.intentDigest !== b.intentDigest ||
        p.requestDigest !== b.requestDigest ||
        p.templateVersion !== b.templateVersion ||
        outlineRawOutputDigest(c.rawOutput) !== p.rawOutputDigest ||
        outlineCompletionDigest(definition, b.actorId) !== completionDigest ||
        outlineCheckpointDigest(b, i, c) !== c.checkpointDigest ||
        Date.parse(p.completedAt) < Date.parse(i.markedAt) ||
        Date.parse(p.completedAt) >= Date.parse(i.observeUntil) ||
        Date.parse(c.createdAt) < Date.parse(p.completedAt)
      )
        invalid();
      const body = ledgerObject(outlineData(JSON.parse(c.rawOutput)), {
        title: (v) => v,
        modules: (v) => v,
      });
      const assembled = JSON.stringify({
        schemaVersion: 1,
        technologyId: b.technologyId,
        source: b.brief,
        ...body,
      });
      if (Buffer.byteLength(assembled, 'utf8') > curriculumOutlineByteLimit)
        invalid();
      outline = curriculumOutlineSchema.parse(JSON.parse(assembled));
      const ca = e.completionAudit;
      if (
        !ca ||
        ca.action !== 'CURRICULUM_OUTLINE_COMPLETION_STORED' ||
        ca.id !== b.completionAuditId ||
        ca.actorId !== b.actorId ||
        ca.attemptId !== b._id ||
        ca.technologyId !== b.technologyId ||
        ca.operationId !== b.operationId ||
        ca.digest !== c.checkpointDigest ||
        ca.createdAt !== c.createdAt
      )
        invalid();
    } else if (e.completionAudit !== null) invalid();
    if (terminal) {
      const t = e.terminalAudit,
        r = a.receipt;
      if (
        !t ||
        !r ||
        t.id !== b.terminalAuditId ||
        r.auditId !== b.terminalAuditId ||
        t.actorId !== b.actorId ||
        t.attemptId !== b._id ||
        t.technologyId !== b.technologyId ||
        t.operationId !== b.operationId ||
        t.outlineId !== b.outlineId ||
        Date.parse(t.createdAt) <
          (c
            ? Date.parse(c.createdAt)
            : i
              ? Date.parse(i.markedAt)
              : Date.parse(b.createdAt))
      )
        invalid();
      if (a.phase === 'ADMITTED') {
        const candidate = e.candidate;
        if (
          r.kind !== 'COMMITTED' ||
          t.action !== 'CURRICULUM_OUTLINE_ADMITTED' ||
          t.code !== null ||
          !candidate ||
          !c ||
          !outline ||
          candidate._id !== b.outlineRevisionId ||
          candidate.outlineId !== b.outlineId ||
          candidate.createdBy !== b.actorId ||
          candidate.createdAt !== c.createdAt ||
          !ledgerSame(candidate.proposal, b.proposal) ||
          JSON.stringify(candidate.producer) !== JSON.stringify(c.producer) ||
          JSON.stringify(candidate.outline) !== JSON.stringify(outline) ||
          r.candidateId !== candidate._id ||
          r.definitionDigest !== candidate.definitionDigest
        )
          invalid();
      } else if (
        r.kind !== 'REFUSED' ||
        t.action !== 'CURRICULUM_OUTLINE_ADMISSION_REFUSED' ||
        t.code !== r.code ||
        e.candidate !== null
      )
        invalid();
    } else if (e.terminalAudit !== null || e.candidate !== null) invalid();
    return freezeOutline({
      attempt: a,
      completionAudit: e.completionAudit,
      terminalAudit: e.terminalAudit,
      candidate: e.candidate,
    });
  } catch {
    throw new OutlineEvidenceFailure();
  }
}

import { aiUsageTimeAt } from './ai-usage-control.schema.js';
import { Types } from 'mongoose';
import { proposeAiUsageReservation } from './ai-usage-control.policy.js';
import {
  addPaise,
  assertLedgerImmutable,
  ledgerBoolean,
  ledgerEnum,
  ledgerHex,
  ledgerId,
  ledgerInteger,
  ledgerInvalid,
  ledgerNullable,
  ledgerObject,
  ledgerObjectId,
  ledgerQuoteDigest,
  ledgerRequestDigest,
  ledgerReservationFingerprint,
  ledgerIntentFingerprint,
  ledgerSame,
  ledgerTime,
  paiseFromBigInt,
  paiseToBigInt,
  paiseToG1Number,
  subtractPaise,
  validateLedgerClaim,
  validateLedgerCommand,
  validateLedgerControl,
  validateLedgerEvidence,
  validateLedgerOperation,
  validateLedgerPeriod,
  validateLedgerQuote,
  validateReserveCommand,
  type LedgerCode,
  type LedgerControl,
  type LedgerOperation,
  type LedgerPeriod,
} from './ai-usage-ledger.schema.js';

const message = 'AI usage operation cannot proceed' as const;
export const ledgerAuthorityFacts = (v: unknown) =>
  ledgerObject(v, {
    actorId: ledgerId,
    currentAdmin: ledgerBoolean,
    sessionCurrent: ledgerBoolean,
    mutationFenced: ledgerBoolean,
  });
const facts = (v: unknown) =>
  ledgerObject(v, {
    sourceEligible: ledgerBoolean,
    profileCurrent: ledgerBoolean,
    pricingKnown: ledgerBoolean,
    evidenceVerified: ledgerBoolean,
    definitelyUnsent: ledgerBoolean,
  });
type Refused = { kind: 'REFUSED'; code: LedgerCode; message: typeof message };
export type LedgerProposal = {
  kind: 'PROPOSED';
  action: string;
  readOnly: boolean;
  dispatchAuthorized: false;
  expected: {
    controlVersion: number;
    periodVersion: number;
    operationVersion: number | null;
    activeOperationId: string | null;
  };
  next: {
    control: LedgerControl;
    period: LedgerPeriod;
    operation: LedgerOperation;
  };
  auditAction:
    | 'AI_USAGE_RESERVED'
    | 'AI_USAGE_DISPATCH_CLAIMED'
    | 'AI_USAGE_UNCERTAIN'
    | 'AI_USAGE_SETTLED'
    | 'AI_USAGE_RELEASED'
    | null;
};
function refuse(code: LedgerCode): Refused {
  return { kind: 'REFUSED', code, message };
}
function increment(n: number): number {
  return ledgerInteger(n + 1, 1);
}
function copyProposal(
  action: string,
  control: LedgerControl,
  period: LedgerPeriod,
  before: LedgerOperation | null,
  nextControl: LedgerControl,
  nextPeriod: LedgerPeriod,
  nextOperation: LedgerOperation,
  auditAction: LedgerProposal['auditAction'],
  readOnly = false,
): LedgerProposal {
  return {
    kind: 'PROPOSED',
    action,
    readOnly,
    dispatchAuthorized: false,
    expected: {
      controlVersion: control.version,
      periodVersion: period.version,
      operationVersion: before?.version ?? null,
      activeOperationId:
        control.activeOperationId === null
          ? null
          : ledgerHex(control.activeOperationId),
    },
    next: {
      control: validateLedgerControl(nextControl),
      period: validateLedgerPeriod(nextPeriod),
      operation: validateLedgerOperation(nextOperation),
    },
    auditAction,
  };
}
/** Only supplied structural linkage; a future repository must establish its stored truth. */
export function assertLedgerLinkage(
  controlInput: unknown,
  activeInput: unknown,
  operationInput: unknown = null,
): void {
  const c = validateLedgerControl(controlInput);
  const active =
    activeInput === null ? null : validateLedgerOperation(activeInput);
  const op =
    operationInput === null ? null : validateLedgerOperation(operationInput);
  if ((c.activeOperationId === null) !== (active === null))
    throw ledgerInvalid();
  if (
    active &&
    (!active.open ||
      active.scope !== c.scope ||
      ledgerHex(active._id) !== ledgerHex(c.activeOperationId))
  )
    throw ledgerInvalid();
  if (active?.state === 'UNCERTAIN' && !c.freezeReasons.includes('UNCERTAIN'))
    throw ledgerInvalid();
  if (op && op.scope !== c.scope) throw ledgerInvalid();
  if (op?.open && (!active || !ledgerSame(op, active))) throw ledgerInvalid();
  if (op && !op.open && active && ledgerHex(op._id) === ledgerHex(active._id))
    throw ledgerInvalid();
}
function checkPeriod(period: LedgerPeriod, active: LedgerOperation | null) {
  const expected =
    active?.periodKey === period.periodKey
      ? paiseToBigInt(active.heldPaise)
      : 0n;
  if (paiseToBigInt(period.heldPaise) !== expected) throw ledgerInvalid();
}
function profile(c: LedgerControl, q: ReturnType<typeof validateLedgerQuote>) {
  return (
    c.policyVersion === q.policyVersion &&
    c.profileVersion === q.profileVersion &&
    c.pricingVersion === q.pricingVersion &&
    c.privacyVersion === q.privacyVersion &&
    c.spendingApprovalRef === q.spendingApprovalRef
  );
}

/** Pure new-admission proposal; absence, source, fences and quote trust are supplied, not proved. */
export function proposeLedgerAdmission(
  input: unknown,
): LedgerProposal | Refused {
  try {
    const r = ledgerObject(input, {
      nowMs: ledgerTime,
      authority: ledgerAuthorityFacts,
      control: validateLedgerControl,
      period: validateLedgerPeriod,
      activeOperation: ledgerNullable(validateLedgerOperation),
      actorWindowUsed: ledgerInteger,
      command: validateReserveCommand,
      quote: validateLedgerQuote,
      operationDocumentId: ledgerObjectId,
      nextAuditId: ledgerObjectId,
      facts,
    });
    if (
      !r.authority.currentAdmin ||
      !r.authority.sessionCurrent ||
      !r.authority.mutationFenced
    )
      return refuse('FORBIDDEN');
    assertLedgerLinkage(r.control, r.activeOperation);
    checkPeriod(r.period, r.activeOperation);
    const time = aiUsageTimeAt(r.nowMs);
    if (
      r.control.updatedAt.getTime() > r.nowMs ||
      r.period.updatedAt.getTime() > r.nowMs ||
      (r.control.lastAdmissionAt !== null &&
        r.control.lastAdmissionAt.getTime() > r.nowMs)
    )
      return refuse('CONTROL_UNAVAILABLE');
    if (!r.facts.sourceEligible) return refuse('SOURCE_UNAVAILABLE');
    if (
      !r.facts.profileCurrent ||
      !r.facts.pricingKnown ||
      !profile(r.control, r.quote)
    )
      return refuse('CONTROL_UNAVAILABLE');
    if (
      r.quote.periodKey !== time.periodKey ||
      r.period.periodKey !== time.periodKey ||
      r.quote.requestDigest !==
        ledgerRequestDigest({
          instructions: r.command.instructions,
          inputJson: r.command.inputJson,
        }) ||
      !ledgerSame(r.quote.requestBounds, r.command.requestBounds)
    )
      return refuse('QUOTE_MISMATCH');
    if (r.nowMs < r.quote.effectiveAtMs || r.nowMs >= r.quote.expiresAtMs)
      return refuse('QUOTE_EXPIRED');
    const prior =
      r.activeOperation && r.activeOperation.periodKey !== time.periodKey
        ? r.activeOperation.heldPaise
        : paiseFromBigInt(0n);
    const proposed = proposeAiUsageReservation(
      {
        schemaVersion: 1,
        budgetScope: r.control.scope,
        actorId: r.authority.actorId,
        operationId: r.command.operationId,
        purpose: 'CURRICULUM_OUTLINE',
        periodKey: time.periodKey,
        quote: {
          id: r.quote.id,
          periodKey: r.quote.periodKey,
          worstCasePaise: paiseToG1Number(r.quote.worstCasePaise),
        },
        requestBounds: r.command.requestBounds,
        usage: {
          settledPaise: paiseToG1Number(r.period.settledPaise),
          reservedPaise: paiseToG1Number(r.period.heldPaise),
          unresolvedPriorPaise: paiseToG1Number(prior),
          openOperations: r.activeOperation ? 1 : 0,
          actorWindowUsed: r.actorWindowUsed,
          frozen: r.control.frozen,
        },
      },
      r.nowMs,
    );
    if (!proposed.ok) return refuse(proposed.error.code);
    if (ledgerHex(r.operationDocumentId) === ledgerHex(r.nextAuditId))
      return refuse('INVALID_INPUT');
    const intentFingerprint = ledgerIntentFingerprint({
        actorId: r.authority.actorId,
        command: r.command,
      }),
      quoteDigest = ledgerQuoteDigest(r.quote);
    const op = validateLedgerOperation({
      _id: r.operationDocumentId,
      schemaVersion: 1,
      scope: r.control.scope,
      actorId: new Types.ObjectId(r.authority.actorId),
      operationId: r.command.operationId,
      purpose: 'CURRICULUM_OUTLINE',
      environment: 'DEV',
      technologyId: new Types.ObjectId(r.command.technologyId),
      source: {
        id: new Types.ObjectId(r.command.source.id),
        revision: 1,
        digest: r.command.source.digest,
      },
      requestDigest: r.quote.requestDigest,
      requestBounds: r.command.requestBounds,
      intentFingerprint,
      reservationFingerprint: ledgerReservationFingerprint({
        intentFingerprint,
        periodKey: time.periodKey,
        admissionWindowKey: time.actorWindowKey,
        quoteDigest,
      }),
      quote: r.quote,
      quoteDigest,
      periodKey: time.periodKey,
      admissionWindowKey: time.actorWindowKey,
      admittedAt: new Date(r.nowMs),
      reservationPaise: r.quote.worstCasePaise,
      version: 1,
      state: 'RESERVED',
      open: true,
      heldPaise: r.quote.worstCasePaise,
      actualPaise: null,
      claim: null,
      terminalEvidence: null,
      safeCode: null,
      lastAuditId: r.nextAuditId,
      updatedAt: new Date(r.nowMs),
    });
    return copyProposal(
      'RESERVE',
      r.control,
      r.period,
      null,
      {
        ...r.control,
        version: increment(r.control.version),
        activeOperationId: op._id,
        lastAdmissionAt: new Date(r.nowMs),
        updatedAt: new Date(r.nowMs),
      },
      {
        ...r.period,
        version: increment(r.period.version),
        heldPaise: addPaise(r.period.heldPaise, op.reservationPaise),
        updatedAt: new Date(r.nowMs),
      },
      op,
      'AI_USAGE_RESERVED',
    );
  } catch {
    return refuse('INVALID_INPUT');
  }
}

/** All truth/authorization/evidence flags here are explicitly supplied, never authenticated. */
export function proposeLedgerTransition(
  actionInput: unknown,
  input: unknown,
): LedgerProposal | Refused {
  try {
    const action = ledgerEnum(actionInput, [
      'CLAIM_DISPATCH',
      'CANCEL_UNSENT',
      'SETTLE',
      'MARK_UNCERTAIN',
      'RECONCILE',
      'REPLAY_TERMINAL',
    ] as const);
    const r = ledgerObject(input, {
      nowMs: ledgerTime,
      authority: ledgerAuthorityFacts,
      control: validateLedgerControl,
      period: validateLedgerPeriod,
      activeOperation: ledgerNullable(validateLedgerOperation),
      operation: validateLedgerOperation,
      command: (v) => validateLedgerCommand(action, v),
      nextAuditId: ledgerObjectId,
      claim: ledgerNullable(validateLedgerClaim),
      evidence: ledgerNullable(validateLedgerEvidence),
      request: (v) => v,
      facts,
    });
    const op = r.operation;
    if (!r.authority.currentAdmin || !r.authority.sessionCurrent)
      return refuse('FORBIDDEN');
    if (
      !('expectedVersion' in r.command) ||
      r.command.operationId !== op.operationId
    )
      return refuse('OPERATION_CONFLICT');
    if (action === 'RECONCILE') {
      if (
        !('originalActorId' in r.command) ||
        r.command.originalActorId !== ledgerHex(op.actorId)
      )
        return refuse('OPERATION_CONFLICT');
    } else if (r.authority.actorId !== ledgerHex(op.actorId))
      return refuse('FORBIDDEN');
    assertLedgerLinkage(r.control, r.activeOperation, op);
    checkPeriod(r.period, r.activeOperation);
    if (r.period.scope !== op.scope || r.period.periodKey !== op.periodKey)
      return refuse('STATE_CONFLICT');
    if (action === 'REPLAY_TERMINAL') {
      if (
        op.open ||
        !r.evidence ||
        !op.terminalEvidence ||
        !ledgerSame(r.evidence, op.terminalEvidence) ||
        r.claim !== null ||
        r.request !== null
      )
        return refuse('STATE_CONFLICT');
      if (
        op.state === 'SETTLED' &&
        paiseToBigInt(r.period.settledPaise) < paiseToBigInt(op.actualPaise)
      )
        return refuse('STATE_CONFLICT');
      return copyProposal(
        action,
        r.control,
        r.period,
        op,
        r.control,
        r.period,
        op,
        null,
        true,
      );
    }
    if (!r.authority.mutationFenced) return refuse('FORBIDDEN');
    if (
      r.command.expectedVersion !== op.version ||
      !op.open ||
      r.nowMs <
        Math.max(
          op.updatedAt.getTime(),
          r.control.updatedAt.getTime(),
          r.period.updatedAt.getTime(),
        )
    )
      return refuse('STATE_CONFLICT');
    if (
      (action === 'SETTLE' || action === 'MARK_UNCERTAIN') &&
      (!op.claim ||
        !('claimId' in r.command) ||
        !('ownerId' in r.command) ||
        r.command.claimId !== op.claim.id ||
        r.command.ownerId !== op.claim.ownerId)
    )
      return refuse('STATE_CONFLICT');
    if (
      ledgerHex(r.nextAuditId) === ledgerHex(op.lastAuditId) ||
      ledgerHex(r.nextAuditId) === ledgerHex(op._id)
    )
      return refuse('STATE_CONFLICT');
    let updated: LedgerOperation = op,
      held = r.period.heldPaise,
      settled = r.period.settledPaise;
    let pointer = r.control.activeOperationId;
    let reasons = [...r.control.freezeReasons];
    let audit: LedgerProposal['auditAction'] = null;
    if (action === 'CLAIM_DISPATCH') {
      if (op.state !== 'RESERVED' || r.evidence !== null || !r.claim)
        return refuse('STATE_CONFLICT');
      if (r.control.frozen) return refuse('USAGE_FROZEN');
      if (
        paiseToBigInt(addPaise(r.period.settledPaise, r.period.heldPaise)) >
        100000n
      )
        return refuse('USAGE_FROZEN');
      if (
        !r.control.dispatchEnabled ||
        !r.facts.profileCurrent ||
        !r.facts.pricingKnown ||
        !profile(r.control, op.quote)
      )
        return refuse('CONTROL_UNAVAILABLE');
      if (!r.facts.sourceEligible) return refuse('SOURCE_UNAVAILABLE');
      if (aiUsageTimeAt(r.nowMs).periodKey !== op.periodKey)
        return refuse('QUOTE_MISMATCH');
      if (r.nowMs < op.quote.effectiveAtMs || r.nowMs >= op.quote.expiresAtMs)
        return refuse('QUOTE_EXPIRED');
      const raw = ledgerObject(r.request, {
        schemaVersion: (v) => {
          if (v !== 1) throw ledgerInvalid();
          return 1;
        },
        purpose: (v) => {
          if (v !== 'CURRICULUM_OUTLINE') throw ledgerInvalid();
          return 'CURRICULUM_OUTLINE';
        },
        instructions: (v) => v,
        inputJson: (v) => v,
        maxOutputBytes: (v) => ledgerInteger(v, 2, 65536),
        maxOutputTokens: (v) => ledgerInteger(v, 1, 4096),
      });
      const request = validateReserveCommand({
        operationId: op.operationId,
        technologyId: ledgerHex(op.technologyId),
        source: {
          id: ledgerHex(op.source.id),
          revision: 1,
          digest: op.source.digest,
        },
        instructions: raw.instructions,
        inputJson: raw.inputJson,
        requestBounds: op.requestBounds,
      });
      if (
        raw.maxOutputBytes !== op.requestBounds.maxOutputBytes ||
        raw.maxOutputTokens !== op.requestBounds.maxOutputTokens ||
        ledgerRequestDigest({
          instructions: request.instructions,
          inputJson: request.inputJson,
        }) !== op.requestDigest ||
        r.claim.claimedAt.getTime() !== r.nowMs ||
        r.claim.observeUntil.getTime() !== r.nowMs + op.requestBounds.budgetMs
      )
        return refuse('QUOTE_MISMATCH');
      updated = { ...op, state: 'DISPATCH_CLAIMED', claim: r.claim };
      audit = 'AI_USAGE_DISPATCH_CLAIMED';
    } else if (action === 'MARK_UNCERTAIN') {
      if (
        op.state !== 'DISPATCH_CLAIMED' ||
        r.evidence !== null ||
        r.claim !== null ||
        r.request !== null
      )
        return refuse('STATE_CONFLICT');
      updated = { ...op, state: 'UNCERTAIN', safeCode: 'OUTCOME_UNKNOWN' };
      if (!reasons.includes('UNCERTAIN')) reasons.push('UNCERTAIN');
      audit = 'AI_USAGE_UNCERTAIN';
    } else {
      if (
        r.claim !== null ||
        r.request !== null ||
        !r.evidence ||
        !r.facts.evidenceVerified
      )
        return refuse('STATE_CONFLICT');
      if (
        action === 'CANCEL_UNSENT' &&
        (op.state !== 'RESERVED' || op.claim !== null)
      )
        return refuse('STATE_CONFLICT');
      if (
        action === 'SETTLE' &&
        (op.state !== 'DISPATCH_CLAIMED' || r.evidence.kind !== 'FINAL_COST')
      )
        return refuse('STATE_CONFLICT');
      if (
        action === 'SETTLE' &&
        op.claim &&
        r.nowMs >= op.claim.observeUntil.getTime()
      )
        return refuse('STATE_CONFLICT');
      if (
        action === 'RECONCILE' &&
        !(
          op.state === 'UNCERTAIN' ||
          op.state === 'RESERVED' ||
          (op.state === 'DISPATCH_CLAIMED' &&
            r.evidence.kind === 'DEFINITELY_UNSENT')
        )
      )
        return refuse('STATE_CONFLICT');
      const release = r.evidence.kind === 'DEFINITELY_UNSENT';
      if (release && (!r.facts.definitelyUnsent || action === 'SETTLE'))
        return refuse('STATE_CONFLICT');
      if (
        !release &&
        (!r.facts.pricingKnown ||
          op.state === 'RESERVED' ||
          action === 'CANCEL_UNSENT')
      )
        return refuse('STATE_CONFLICT');
      held = subtractPaise(held, op.heldPaise);
      if (!release) settled = addPaise(settled, r.evidence.actualPaise);
      if (!pointer || ledgerHex(pointer) !== ledgerHex(op._id))
        return refuse('STATE_CONFLICT');
      pointer = null;
      if (action === 'RECONCILE' && op.state === 'UNCERTAIN')
        reasons = reasons.filter((v) => v !== 'UNCERTAIN');
      if (
        !release &&
        (paiseToBigInt(r.evidence.actualPaise) >
          paiseToBigInt(op.reservationPaise) ||
          paiseToBigInt(addPaise(settled, held)) > 100000n) &&
        !reasons.includes('OVERRUN')
      )
        reasons.push('OVERRUN');
      updated = {
        ...op,
        state: release ? 'RELEASED' : 'SETTLED',
        open: false,
        heldPaise: paiseFromBigInt(0n),
        actualPaise: r.evidence.actualPaise,
        terminalEvidence: r.evidence,
        safeCode: null,
      };
      audit = release ? 'AI_USAGE_RELEASED' : 'AI_USAGE_SETTLED';
    }
    updated = {
      ...updated,
      version: increment(op.version),
      lastAuditId: r.nextAuditId,
      updatedAt: new Date(r.nowMs),
    };
    assertLedgerImmutable(op, updated);
    reasons.sort();
    return copyProposal(
      action,
      r.control,
      r.period,
      op,
      {
        ...r.control,
        version: increment(r.control.version),
        activeOperationId: pointer,
        freezeReasons: reasons,
        frozen: reasons.length > 0,
        updatedAt: new Date(r.nowMs),
      },
      {
        ...r.period,
        version: increment(r.period.version),
        heldPaise: held,
        settledPaise: settled,
        updatedAt: new Date(r.nowMs),
      },
      updated,
      audit,
    );
  } catch {
    return refuse('INVALID_INPUT');
  }
}

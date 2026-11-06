import { aiUsageTimeAt } from './ai-usage-control.schema.js';
import { assertLedgerLinkage } from './ai-usage-ledger.transitions.js';
import {
  ledgerHex,
  ledgerId,
  ledgerInvalid,
  ledgerNullable,
  ledgerObject,
  ledgerTime,
  paiseFromBigInt,
  paiseToBigInt,
  paiseToDecimal,
  validateLedgerControl,
  validateLedgerOperation,
  validateLedgerPeriod,
} from './ai-usage-ledger.schema.js';

/** Private projection only. Supplied linkage/actor facts are not authenticated or audited here. */
export function privateLedgerOperationDto(
  operationInput: unknown,
  contextInput: unknown,
) {
  try {
    const op = validateLedgerOperation(operationInput);
    const c = ledgerObject(contextInput, {
      actorId: ledgerId,
      nowMs: ledgerTime,
      control: validateLedgerControl,
      currentPeriod: validateLedgerPeriod,
      activeOperation: ledgerNullable(validateLedgerOperation),
    });
    if (
      c.actorId !== ledgerHex(op.actorId) ||
      c.currentPeriod.periodKey !== aiUsageTimeAt(c.nowMs).periodKey
    )
      throw ledgerInvalid();
    if (
      Math.max(
        op.updatedAt.getTime(),
        c.control.updatedAt.getTime(),
        c.currentPeriod.updatedAt.getTime(),
      ) > c.nowMs ||
      (op.state === 'SETTLED' &&
        op.periodKey === c.currentPeriod.periodKey &&
        paiseToBigInt(c.currentPeriod.settledPaise) <
          paiseToBigInt(op.actualPaise))
    )
      throw ledgerInvalid();
    assertLedgerLinkage(c.control, c.activeOperation, op);
    const active = c.activeOperation;
    const currentHeld =
      active?.periodKey === c.currentPeriod.periodKey
        ? paiseToBigInt(active.heldPaise)
        : 0n;
    if (
      paiseToBigInt(c.currentPeriod.heldPaise) !== currentHeld ||
      (active && active.periodKey > c.currentPeriod.periodKey)
    )
      throw ledgerInvalid();
    const prior =
      active && active.periodKey !== c.currentPeriod.periodKey
        ? paiseToBigInt(active.heldPaise)
        : 0n;
    const exposure =
      paiseToBigInt(c.currentPeriod.settledPaise) +
      paiseToBigInt(c.currentPeriod.heldPaise) +
      prior;
    paiseFromBigInt(exposure);
    return {
      operationId: op.operationId,
      technologyId: ledgerHex(op.technologyId),
      state: op.state,
      version: op.version,
      periodKey: op.periodKey,
      reservationPaise: paiseToDecimal(op.reservationPaise),
      heldPaise: paiseToDecimal(op.heldPaise),
      actualPaise:
        op.actualPaise === null ? null : paiseToDecimal(op.actualPaise),
      warning80Percent: exposure >= 80000n,
      requiresReconciliation:
        op.state === 'DISPATCH_CLAIMED' ||
        op.state === 'UNCERTAIN' ||
        c.control.frozen,
      admittedAt: op.admittedAt.toISOString(),
      updatedAt: op.updatedAt.toISOString(),
    };
  } catch {
    throw ledgerInvalid();
  }
}

import {
  aiUsageTimeAt,
  validateAiUsageInput,
} from './ai-usage-control.schema.js';

export type AiUsageRefusalCode =
  | 'INVALID_INPUT'
  | 'QUOTE_MISMATCH'
  | 'USAGE_FROZEN'
  | 'CONCURRENCY_LIMIT'
  | 'RATE_LIMIT'
  | 'BUDGET_EXCEEDED';

export type AiUsageOutcome =
  | {
      ok: false;
      error: {
        code: AiUsageRefusalCode;
        message: 'AI request cannot be admitted';
      };
    }
  | {
      ok: true;
      proposal: {
        budgetScope: 'SHARED_AI_TESTING';
        actorId: string;
        operationId: string;
        periodKey: string;
        quoteId: string;
        reservationPaise: number;
        exposureAfterPaise: number;
        warning80Percent: boolean;
      };
    };

const capPaise = 100000n;
// Smallest integer exposure at or above 80%; no floating-point calculation.
// The approved cap makes this exactly 80,000 paise.
const warningPaise = (capPaise * 80n + 99n) / 100n;
function refuse(code: AiUsageRefusalCode): AiUsageOutcome {
  return {
    ok: false,
    error: { code, message: 'AI request cannot be admitted' },
  };
}

/**
 * Pure supplied-facts proposal, NOT authenticated admission or permission to call
 * a provider. No counters/reservations are changed or released. A future durable
 * consumer must bind the supplied snapshot to this exact month/actor UTC minute,
 * verify current authority/prices, and atomically reserve/audit/idempotently claim.
 */
export function proposeAiUsageReservation(
  input: unknown,
  evaluatedAtMs: unknown,
): AiUsageOutcome {
  let row;
  let time;
  try {
    row = validateAiUsageInput(input);
    time = aiUsageTimeAt(evaluatedAtMs);
  } catch {
    return refuse('INVALID_INPUT');
  }
  if (row.periodKey !== row.quote.periodKey || row.periodKey !== time.periodKey)
    return refuse('QUOTE_MISMATCH');

  const before =
    BigInt(row.usage.settledPaise) +
    BigInt(row.usage.reservedPaise) +
    BigInt(row.usage.unresolvedPriorPaise);
  const after = before + BigInt(row.quote.worstCasePaise);
  if (
    row.usage.frozen ||
    row.usage.unresolvedPriorPaise > 0 ||
    before > capPaise
  )
    return refuse('USAGE_FROZEN');
  if (row.usage.openOperations >= 1) return refuse('CONCURRENCY_LIMIT');
  if (row.usage.actorWindowUsed >= 1) return refuse('RATE_LIMIT');
  if (after > capPaise) return refuse('BUDGET_EXCEEDED');

  return {
    ok: true,
    proposal: {
      budgetScope: row.budgetScope,
      actorId: row.actorId,
      operationId: row.operationId,
      periodKey: row.periodKey,
      quoteId: row.quote.id,
      reservationPaise: row.quote.worstCasePaise,
      exposureAfterPaise: Number(after),
      warning80Percent: after >= warningPaise,
    },
  };
}

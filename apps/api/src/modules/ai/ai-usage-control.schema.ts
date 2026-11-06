import { types } from 'node:util';
import { z } from 'zod';

const integer = (minimum: number, maximum = Number.MAX_SAFE_INTEGER) =>
  z.number().int().min(minimum).max(maximum);
const period = z
  .string()
  .regex(/^(?:19[7-9]\d|[2-9]\d{3})-(?:0[1-9]|1[0-2])(?![\s\S])/);
const uuid = z
  .string()
  .regex(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/,
  );
const admission = z.strictObject({
  schemaVersion: z.literal(1),
  budgetScope: z.literal('SHARED_AI_TESTING'),
  actorId: z.string().regex(/^[a-f0-9]{24}(?![\s\S])/),
  operationId: uuid,
  purpose: z.literal('CURRICULUM_OUTLINE'),
  periodKey: period,
  quote: z.strictObject({
    id: uuid,
    periodKey: period,
    worstCasePaise: integer(1),
  }),
  requestBounds: z.strictObject({
    instructionBytes: integer(1, 8192),
    inputJsonBytes: integer(2, 65536),
    maxOutputBytes: integer(2, 65536),
    maxOutputTokens: integer(1, 4096),
    budgetMs: integer(1, 10000),
  }),
  usage: z.strictObject({
    settledPaise: integer(0),
    reservedPaise: integer(0),
    unresolvedPriorPaise: integer(0),
    openOperations: integer(0),
    actorWindowUsed: integer(0),
    frozen: z.boolean(),
  }),
});

export type AiUsageInput = z.output<typeof admission>;

export function invalidAiUsageInput(): Error {
  return new Error('Invalid AI usage input');
}

/** Exact own inert data only: never invoke accessors, coercion or proxy traps. */
function record(
  input: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || types.isProxy(input))
    throw invalidAiUsageInput();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null)
    throw invalidAiUsageInput();
  const own = Reflect.ownKeys(input);
  if (
    own.length !== keys.length ||
    own.some((key) => typeof key !== 'string' || !keys.includes(key))
  )
    throw invalidAiUsageInput();
  return Object.fromEntries(
    keys.map((key) => {
      const property = Object.getOwnPropertyDescriptor(input, key);
      if (!property || !property.enumerable || !('value' in property))
        throw invalidAiUsageInput();
      return [key, property.value];
    }),
  );
}

function primitives(
  row: Record<string, unknown>,
  fields: Readonly<Record<string, 'string' | 'number' | 'boolean'>>,
): void {
  for (const [field, kind] of Object.entries(fields)) {
    if (typeof row[field] !== kind) throw invalidAiUsageInput();
  }
}

/** Structural validation does not establish actor, quote or usage authority. */
export function validateAiUsageInput(input: unknown): AiUsageInput {
  try {
    const root = record(input, [
      'schemaVersion',
      'budgetScope',
      'actorId',
      'operationId',
      'purpose',
      'periodKey',
      'quote',
      'requestBounds',
      'usage',
    ]);
    const quote = record(root.quote, ['id', 'periodKey', 'worstCasePaise']);
    const bounds = record(root.requestBounds, [
      'instructionBytes',
      'inputJsonBytes',
      'maxOutputBytes',
      'maxOutputTokens',
      'budgetMs',
    ]);
    const usage = record(root.usage, [
      'settledPaise',
      'reservedPaise',
      'unresolvedPriorPaise',
      'openOperations',
      'actorWindowUsed',
      'frozen',
    ]);
    // Zod issue formatting may inspect malformed objects. Scalar positions must
    // contain primitives before the schema sees any caller-controlled value.
    primitives(root, {
      schemaVersion: 'number',
      budgetScope: 'string',
      actorId: 'string',
      operationId: 'string',
      purpose: 'string',
      periodKey: 'string',
    });
    primitives(quote, {
      id: 'string',
      periodKey: 'string',
      worstCasePaise: 'number',
    });
    primitives(bounds, {
      instructionBytes: 'number',
      inputJsonBytes: 'number',
      maxOutputBytes: 'number',
      maxOutputTokens: 'number',
      budgetMs: 'number',
    });
    primitives(usage, {
      settledPaise: 'number',
      reservedPaise: 'number',
      unresolvedPriorPaise: 'number',
      openOperations: 'number',
      actorWindowUsed: 'number',
      frozen: 'boolean',
    });
    return admission.parse({ ...root, quote, requestBounds: bounds, usage });
  } catch {
    // Never return schema issues, caller content, causes or caller exceptions.
    throw invalidAiUsageInput();
  }
}

export interface AiUsageTime {
  periodKey: string;
  actorWindowKey: number;
}

/**
 * Explicit Unix milliseconds only. Asia/Kolkata is UTC+05:30 throughout this
 * supported 1970..9999 range. No clock, locale, environment or timer is read.
 * A supplied timestamp is not trusted server time or snapshot freshness proof.
 */
export function aiUsageTimeAt(epochMs: unknown): AiUsageTime {
  if (
    typeof epochMs !== 'number' ||
    !Number.isSafeInteger(epochMs) ||
    epochMs < 0 ||
    epochMs > 253402280199999
  )
    throw invalidAiUsageInput();
  return {
    periodKey: new Date(epochMs + 19800000).toISOString().slice(0, 7),
    actorWindowKey: Math.floor(epochMs / 60000),
  };
}

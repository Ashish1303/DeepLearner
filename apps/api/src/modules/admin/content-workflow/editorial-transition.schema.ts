import { types } from 'node:util';
import { z } from 'zod';

export const editorialStates = Object.freeze([
  'DRAFT',
  'AI_GENERATED',
  'IN_REVIEW',
  'CHANGES_REQUIRED',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
] as const);
export const editorialActions = Object.freeze([
  'SUBMIT_FOR_REVIEW',
  'REQUEST_CHANGES',
  'APPROVE',
] as const);

const revision = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{24}(?![\s\S])/),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  digest: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
});
const transition = z.strictObject({
  current: z.strictObject({
    state: z.enum(editorialStates),
    // A supplied claim only. P0 cannot establish authoritative AI provenance.
    origin: z.literal('AI_GENERATED'),
    revision,
  }),
  expected: revision,
  action: z.enum(editorialActions),
});
export type EditorialTransitionInput = z.output<typeof transition>;
export type EditorialState = (typeof editorialStates)[number];
export type EditorialAction = (typeof editorialActions)[number];

export function invalidEditorialTransition(): Error {
  return new Error('Invalid editorial transition');
}

/** Read only exact inert own data properties, never caller accessors/coercion. */
function dataRecord(input: unknown, keys: readonly string[]) {
  if (input === null || typeof input !== 'object' || types.isProxy(input))
    throw invalidEditorialTransition();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null)
    throw invalidEditorialTransition();
  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
  )
    throw invalidEditorialTransition();
  return Object.fromEntries(
    keys.map((key) => {
      const property = Object.getOwnPropertyDescriptor(input, key);
      if (!property || !property.enumerable || !('value' in property))
        throw invalidEditorialTransition();
      return [key, property.value];
    }),
  ) as Record<string, unknown>;
}

function revisionData(input: unknown) {
  const row = dataRecord(input, ['id', 'revision', 'digest']);
  if (
    typeof row.id !== 'string' ||
    typeof row.revision !== 'number' ||
    typeof row.digest !== 'string'
  )
    throw invalidEditorialTransition();
  return row;
}

/** Structural facts only: no stored existence, origin or account authority. */
export function validateEditorialTransition(
  input: unknown,
): EditorialTransitionInput {
  try {
    const row = dataRecord(input, ['current', 'expected', 'action']);
    const current = dataRecord(row.current, ['state', 'origin', 'revision']);
    if (
      typeof row.action !== 'string' ||
      typeof current.state !== 'string' ||
      typeof current.origin !== 'string'
    )
      throw invalidEditorialTransition();
    return transition.parse({
      current: { ...current, revision: revisionData(current.revision) },
      expected: revisionData(row.expected),
      action: row.action,
    });
  } catch {
    // Do not expose payloads, Zod issues or caller-thrown exception details.
    throw invalidEditorialTransition();
  }
}

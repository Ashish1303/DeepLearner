import { types } from 'node:util';
import { z } from 'zod';

export const visualizationCheckpointRefusalCodes = [
  'INVALID_INPUT',
  'UNSUPPORTED_VERSION',
  'INVALID_CONTEXT',
  'INVALID_DEFINITION',
  'INVALID_RESPONSE',
  'UNSUPPORTED_RESPONSE_TYPE',
  'BINDING_MISMATCH',
  'INVALID_SELECTION',
] as const;
export type VisualizationCheckpointRefusalCode =
  (typeof visualizationCheckpointRefusalCodes)[number];
export type VisualizationCheckpointResult = Readonly<
  | {
      status: 'EVALUATED';
      outcome: 'CORRECT' | 'INCORRECT';
      code: null;
      completionQualification: 'NOT_ESTABLISHED';
    }
  | {
      status: 'REFUSED';
      outcome: null;
      code: VisualizationCheckpointRefusalCode;
      completionQualification: 'NOT_ESTABLISHED';
    }
>;

const id = z
  .string()
  .length(24)
  .regex(/^[a-f0-9]{24}(?![\s\S])/);
const token = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/);
const choiceId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]{0,63}(?![\s\S])/);
const version = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const bindingShape = {
  conceptId: id,
  visualizationId: id,
  conceptRevision: token,
  visualizationRevision: token,
  checkpointId: token,
  checkpointVersion: version,
  policyId: token,
  policyVersion: version,
};
const bindingSchema = z.strictObject(bindingShape);
function validLabel(value: string): boolean {
  if (value.length < 1 || value.length > 240 || !/\S/u.test(value))
    return false;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit <= 0x1f || (unit >= 0x7f && unit <= 0x9f)) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
const definitionSchema = z.strictObject({
  ...bindingShape,
  responseType: token,
  choices: z
    .array(
      z.strictObject({ id: choiceId, label: z.string().refine(validLabel) }),
    )
    .min(2)
    .max(8),
  expectedChoiceId: choiceId,
});
const responseSchema = z.strictObject({
  ...bindingShape,
  responseType: token,
  selectedChoiceId: choiceId,
});
const rootSchema = z.strictObject({
  schemaVersion: version,
  expected: z.unknown(),
  definition: z.unknown(),
  response: z.unknown(),
});
export type VisualizationCheckpointInput = Readonly<{
  schemaVersion: 1;
  expected: Readonly<z.output<typeof bindingSchema>>;
  definition: Readonly<z.output<typeof definitionSchema>>;
  response: Readonly<z.output<typeof responseSchema>>;
}>;

// Inspect only own data descriptors, before schema validation can read properties.
// No caller hooks, proxies or coercions execute. Limits include unknown fields.
function dataSnapshot(input: unknown): unknown {
  const ancestors = new Set<object>();
  let remainingValues = 256;
  let remainingStringUnits = 16_384;
  function countString(value: string) {
    remainingStringUnits -= value.length;
    if (remainingStringUnits < 0) throw new Error();
  }
  function copy(value: unknown, depth: number): unknown {
    if (--remainingValues < 0 || depth > 5) throw new Error();
    if (typeof value === 'string') {
      countString(value);
      return value;
    }
    if (
      value === null ||
      value === undefined ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value;
    if (typeof value !== 'object' || types.isProxy(value)) throw new Error();
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (
      (array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null) ||
      ancestors.has(value)
    )
      throw new Error();
    const keys = Reflect.ownKeys(value);
    if (keys.length > 32) throw new Error();
    for (const key of keys) {
      if (typeof key !== 'string') throw new Error();
      countString(key);
    }
    const data = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
        throw new Error();
      return copy(descriptor.value, depth + 1);
    };
    ancestors.add(value);
    try {
      if (array) {
        const length: unknown = Object.getOwnPropertyDescriptor(
          value,
          'length',
        )?.value;
        if (
          typeof length !== 'number' ||
          length > 8 ||
          keys.length !== length + 1
        )
          throw new Error();
        const result: unknown[] = [];
        for (let i = 0; i < length; i++) result.push(data(String(i)));
        return result;
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const key of keys) result[key as string] = data(key as string);
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  return copy(input, 0);
}

const refused = (
  code: VisualizationCheckpointRefusalCode,
): VisualizationCheckpointResult => ({
  status: 'REFUSED',
  outcome: null,
  code,
  completionQualification: 'NOT_ESTABLISHED',
});

/** Disconnected comparison against supplied definitions only. Neither expected
 * context nor a CORRECT result proves approval, identity, freshness or ownership.
 * Never use this utility to issue authenticated evidence or completion status. */
export function verifyVisualizationCheckpoint(
  input: unknown,
): VisualizationCheckpointResult {
  let snapshot: unknown;
  try {
    snapshot = dataSnapshot(input);
  } catch {
    return refused('INVALID_INPUT');
  }
  const root = rootSchema.safeParse(snapshot);
  if (
    !root.success ||
    !Object.keys(rootSchema.shape).every((key) => Object.hasOwn(root.data, key))
  )
    return refused('INVALID_INPUT');
  if (root.data.schemaVersion !== 1) return refused('UNSUPPORTED_VERSION');
  const expected = bindingSchema.safeParse(root.data.expected);
  if (!expected.success) return refused('INVALID_CONTEXT');
  const definition = definitionSchema.safeParse(root.data.definition);
  if (!definition.success) return refused('INVALID_DEFINITION');
  const d = definition.data;
  const choiceIds = new Set(d.choices.map((choice) => choice.id));
  if (
    choiceIds.size !== d.choices.length ||
    new Set(d.choices.map((choice) => choice.label)).size !==
      d.choices.length ||
    !choiceIds.has(d.expectedChoiceId)
  )
    return refused('INVALID_DEFINITION');
  const response = responseSchema.safeParse(root.data.response);
  if (!response.success) return refused('INVALID_RESPONSE');
  const r = response.data;
  if (d.responseType !== 'SINGLE_CHOICE' || r.responseType !== 'SINGLE_CHOICE')
    return refused('UNSUPPORTED_RESPONSE_TYPE');
  for (const key of Object.keys(bindingShape) as (keyof typeof bindingShape)[])
    if (expected.data[key] !== d[key] || expected.data[key] !== r[key])
      return refused('BINDING_MISMATCH');
  if (!choiceIds.has(r.selectedChoiceId)) return refused('INVALID_SELECTION');
  return {
    status: 'EVALUATED',
    outcome:
      r.selectedChoiceId === d.expectedChoiceId ? 'CORRECT' : 'INCORRECT',
    code: null,
    completionQualification: 'NOT_ESTABLISHED',
  };
}

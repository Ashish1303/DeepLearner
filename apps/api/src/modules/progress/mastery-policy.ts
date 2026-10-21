import { types } from 'node:util';
import { z } from 'zod';

export const masteryPolicyRefusalCodes = [
  'INVALID_INPUT',
  'UNSUPPORTED_VERSION',
  'INVALID_CONTEXT',
  'INVALID_POLICY',
  'INVALID_ASSESSMENT',
  'UNTRUSTED_ASSESSMENT',
  'UNSUPPORTED_ASSESSMENT',
  'BINDING_MISMATCH',
  'REVOKED_ASSESSMENT',
  'STALE_ASSESSMENT',
  'SCORE_MISSING',
  'INVALID_SCORE',
] as const;
export type MasteryPolicyRefusalCode =
  (typeof masteryPolicyRefusalCodes)[number];
export type MasteryPolicyResult = Readonly<
  | { classification: 'WEAK' | 'IMPROVING' | 'STRONG'; code: 'NONE' }
  | { classification: 'UNCLASSIFIED'; code: MasteryPolicyRefusalCode }
>;

const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const token = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}(?![\s\S])/);
const version = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const bindingShape = {
  userId: id,
  conceptId: id,
  questionId: id,
  completionPolicyId: id,
  rubricId: id,
  conceptRevision: digest,
  questionRevision: digest,
  contentFingerprint: digest,
  completionPolicyFingerprint: digest,
  sourceEpoch: digest,
  rubricDefinitionFingerprint: digest,
  completionPolicyVersion: version,
  rubricVersion: version,
};
const expectedSchema = z
  .strictObject({
    ...bindingShape,
    selectedAttemptId: id.nullable(),
    selectedAssessmentId: id.nullable(),
    classificationPolicyId: token,
    classificationPolicyVersion: version,
  })
  .refine(
    (value) =>
      (value.selectedAttemptId === null) ===
      (value.selectedAssessmentId === null),
  );
const threshold = z.number().int().min(0).max(100);
const policySchema = z
  .strictObject({
    id: token,
    version,
    improvingMinimum: threshold,
    strongMinimum: threshold,
  })
  .refine((value) => value.improvingMinimum < value.strongMinimum);
const assessmentSchema = z.strictObject({
  ...bindingShape,
  attemptId: id,
  assessmentId: id,
  verification: z.enum(['VERIFIED', 'UNVERIFIED']),
  lifecycle: z.enum(['CURRENT', 'STALE', 'REVOKED']),
  type: z.enum(['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']),
  purpose: z.enum(['COMPLETION_INPUT', 'DIAGNOSTIC']),
  graderId: token,
  graderVersion: version,
  attemptNumber: version,
  submissionProvenance: token,
  // Numeric validation is deliberately deferred to its documented precedence.
  score: z.unknown().optional(),
});
const rootSchema = z.strictObject({
  schemaVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  expected: z.unknown(),
  policy: z.unknown(),
  assessment: z.unknown(),
});
export type MasteryPolicyInput = Readonly<{
  schemaVersion: 1;
  expected: Readonly<z.output<typeof expectedSchema>>;
  policy: Readonly<z.output<typeof policySchema>>;
  assessment: Readonly<z.output<typeof assessmentSchema>> | null;
}>;

// Snapshot own data before Zod can read it. No getters, proxy traps or coercion
// hooks execute. Bounds include unknown fields and repeated references. Byte
// accounting uses JSON-equivalent UTF-8; nonfinite numbers remain numbers in the
// snapshot, even though their accounting representation is JSON's four-byte null.
function dataSnapshot(input: unknown): unknown {
  const ancestors = new Set<object>();
  let remainingBytes = 16_384;
  let remainingProperties = 256;
  function charge(bytes: number): void {
    remainingBytes -= bytes;
    if (remainingBytes < 0) throw new Error();
  }
  function chargeString(value: string): void {
    if (value.length > remainingBytes) throw new Error();
    charge(Buffer.byteLength(JSON.stringify(value), 'utf8'));
  }
  function copy(value: unknown, depth: number): unknown {
    if (depth > 6) throw new Error();
    if (typeof value === 'string') {
      chargeString(value);
      return value;
    }
    if (value === undefined) {
      charge(4);
      return value;
    }
    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      charge(JSON.stringify(value).length);
      return value;
    }
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
    remainingProperties -= keys.length;
    if (remainingProperties < 0) throw new Error();
    if (keys.some((key) => typeof key !== 'string')) throw new Error();
    charge(2); // Container delimiters, with separators accounted below.
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
          keys.length !== length + 1 ||
          !keys.every(
            (key) =>
              key === 'length' || /^(?:0|[1-9][0-9]*)$/.test(key as string),
          )
        )
          throw new Error();
        const result: unknown[] = [];
        for (let i = 0; i < length; i++) {
          if (i > 0) charge(1);
          result.push(data(String(i)));
        }
        return result;
      }
      const result: Record<string, unknown> = Object.create(null);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as string;
        if (i > 0) charge(1);
        chargeString(key);
        charge(1);
        result[key] = data(key);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  return copy(input, 0);
}

const refused = (code: MasteryPolicyRefusalCode): MasteryPolicyResult => ({
  classification: 'UNCLASSIFIED',
  code,
});

/** Classify a supplied score only after validating its metadata consistency.
 * VERIFIED is a caller claim, not authentication or independent approval proof.
 * This disconnected utility never establishes trusted evidence or completion. */
export function evaluateMasteryPolicy(input: unknown): MasteryPolicyResult {
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
  const expected = expectedSchema.safeParse(root.data.expected);
  if (!expected.success) return refused('INVALID_CONTEXT');
  const policy = policySchema.safeParse(root.data.policy);
  if (!policy.success) return refused('INVALID_POLICY');
  const assessment = assessmentSchema
    .nullable()
    .safeParse(root.data.assessment);
  if (!assessment.success) return refused('INVALID_ASSESSMENT');
  const e = expected.data;
  const p = policy.data;
  const a = assessment.data;
  if (a?.verification === 'UNVERIFIED') return refused('UNTRUSTED_ASSESSMENT');
  if (
    a !== null &&
    (a.type !== 'OUTPUT' ||
      a.purpose !== 'COMPLETION_INPUT' ||
      a.graderId !== 'OUTPUT_EXACT_TEXT_COMPLETION' ||
      a.graderVersion !== 1 ||
      a.attemptNumber !== 1 ||
      a.submissionProvenance !== 'F036_FIRST_SUBMISSION_ATOMIC_V1')
  )
    return refused('UNSUPPORTED_ASSESSMENT');
  if (
    p.id !== e.classificationPolicyId ||
    p.version !== e.classificationPolicyVersion ||
    (a !== null &&
      (a.attemptId !== e.selectedAttemptId ||
        a.assessmentId !== e.selectedAssessmentId ||
        (Object.keys(bindingShape) as (keyof typeof bindingShape)[]).some(
          (key) => a[key] !== e[key],
        )))
  )
    return refused('BINDING_MISMATCH');
  if (a?.lifecycle === 'REVOKED') return refused('REVOKED_ASSESSMENT');
  if (a?.lifecycle === 'STALE') return refused('STALE_ASSESSMENT');
  if (a === null || a.score === undefined || a.score === null)
    return refused('SCORE_MISSING');
  if (
    typeof a.score !== 'number' ||
    !Number.isFinite(a.score) ||
    a.score < 0 ||
    a.score > 100
  )
    return refused('INVALID_SCORE');
  return {
    classification:
      a.score < p.improvingMinimum
        ? 'WEAK'
        : a.score < p.strongMinimum
          ? 'IMPROVING'
          : 'STRONG',
    code: 'NONE',
  };
}

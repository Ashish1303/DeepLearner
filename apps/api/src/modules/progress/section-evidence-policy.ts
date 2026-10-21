import { types } from 'node:util';
import { z } from 'zod';

export const sectionEvidenceRefusalCodes = [
  'INVALID_INPUT',
  'UNSUPPORTED_VERSION',
  'UNSUPPORTED_SECTION',
  'UNSUPPORTED_EVIDENCE',
  'POLICY_BINDING_MISMATCH',
  'SCOPE_BINDING_MISMATCH',
  'REVISION_MISMATCH',
  'CHECKPOINT_BINDING_INVALID',
  'INVALID_LIFECYCLE',
  'EVIDENCE_REVOKED',
  'EVIDENCE_EXPIRED',
  'REPLAY_STATE_UNAVAILABLE',
  'CHALLENGE_BINDING_MISMATCH',
  'REPLAY_DETECTED',
  'PRACTICE_NOT_QUALIFIED',
] as const;
export type SectionEvidenceRefusalCode =
  (typeof sectionEvidenceRefusalCodes)[number];
export type SectionEvidencePolicyResult = Readonly<
  {
    completionQualification: 'NOT_ESTABLISHED';
  } & (
    | {
        classification: 'ACTIVITY_CANDIDATE' | 'CHECKPOINT_CANDIDATE';
        code: null;
      }
    | { classification: 'REFUSED'; code: SectionEvidenceRefusalCode }
  )
>;
const token = z
  .string()
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/);
const id = z
  .string()
  .max(24)
  .regex(/^[a-f0-9]{24}(?![\s\S])/);
const digest = z
  .string()
  .max(64)
  .regex(/^[a-f0-9]{64}(?![\s\S])/);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const milliseconds = z.number().int().min(0).max(8_640_000_000_000_000);
const scope = {
  studentId: id,
  conceptId: id,
  section: token,
  conceptRevision: token,
  sectionRevision: token,
  policyId: token,
  policyVersion: version,
};
const checkpoint = {
  visualizationId: id,
  visualizationRevision: token,
  checkpointId: token,
  checkpointPolicyVersion: version,
};
const uniqueIds = z
  .array(token)
  .max(64)
  .refine((rows) => new Set(rows).size === rows.length);
const schema = z.strictObject({
  schemaVersion: version,
  expected: z.strictObject({
    ...scope,
    challengeId: token.nullable(),
    challengeState: z.enum(['AVAILABLE', 'CONSUMED', 'UNKNOWN']),
    checkpoint: z.strictObject(checkpoint).nullable(),
  }),
  candidate: z.strictObject({
    ...scope,
    evidenceId: token,
    kind: token,
    origin: token,
    issuedAtMs: milliseconds,
    expiresAtMs: milliseconds,
    revokedAtMs: milliseconds.nullable(),
    challengeId: token.nullable(),
    checkpoint: z
      .strictObject({
        ...checkpoint,
        validation: z.enum(['VALIDATED', 'UNVALIDATED', 'UNKNOWN']),
      })
      .nullable(),
    practiceLink: z
      .strictObject({
        attemptId: id,
        questionId: id,
        questionRevision: digest,
        assessmentId: id.nullable(),
        assessmentPurpose: z.literal('DIAGNOSTIC').nullable(),
      })
      .nullable(),
  }),
  asOfMs: milliseconds,
  maxAgeMs: milliseconds.min(1),
  observedEvidenceIds: uniqueIds,
  consumedChallengeIds: uniqueIds,
});
export type SectionEvidencePolicyInput = Readonly<z.input<typeof schema>>;

// Snapshot only bounded plain data, without invoking supplied accessors/proxies.
function metadata(input: unknown): unknown {
  let budget = 512;
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): unknown {
    if (--budget < 0 || depth > 6) throw new Error();
    if (value === null) return null;
    if (typeof value === 'string') {
      if (value.length > 128) throw new Error();
      return value;
    }
    if (typeof value === 'number') return value;
    if (typeof value !== 'object' || types.isProxy(value)) throw new Error();
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (
      (array
        ? prototype !== Array.prototype
        : ![Object.prototype, null].includes(prototype)) ||
      ancestors.has(value)
    )
      throw new Error();
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
      if (typeof length !== 'number' || length > 64) throw new Error();
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((k) => typeof k !== 'string') ||
      keys.length > (array ? 65 : 32)
    )
      throw new Error();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const data = (key: string) => {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
        throw new Error();
      return copy(descriptor.value, depth + 1);
    };
    ancestors.add(value);
    try {
      if (array) {
        const length = descriptors.length!.value as number;
        if (keys.length !== length + 1) throw new Error();
        return Array.from({ length }, (_, i) => data(String(i)));
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
const refuse = (
  code: SectionEvidenceRefusalCode,
): SectionEvidencePolicyResult => ({
  classification: 'REFUSED',
  completionQualification: 'NOT_ESTABLISHED',
  code,
});
const sections = new Set([
  'READ',
  'EXAMPLE',
  'REVISE',
  'VISUALIZE',
  'PRACTICE',
]);

/** Metadata classification only. Claims of provenance, availability and freshness
 * are NOT authenticated. No runtime caller or completion adapter is installed. */
export function validateSectionEvidencePolicy(
  input: unknown,
): SectionEvidencePolicyResult {
  let safe: unknown;
  try {
    safe = metadata(input);
  } catch {
    return refuse('INVALID_INPUT');
  }
  const parsed = schema.safeParse(safe);
  if (!parsed.success) return refuse('INVALID_INPUT');
  const {
    expected: e,
    candidate: c,
    asOfMs,
    maxAgeMs,
    observedEvidenceIds,
    consumedChallengeIds,
  } = parsed.data;
  if (parsed.data.schemaVersion !== 1) return refuse('UNSUPPORTED_VERSION');
  if (!sections.has(e.section) || !sections.has(c.section))
    return refuse('UNSUPPORTED_SECTION');
  const visual = c.section === 'VISUALIZE',
    practice = c.section === 'PRACTICE';
  const supported = visual
    ? c.kind === 'CHECKPOINT_RESPONSE' && c.origin === 'CHECKPOINT_SERVICE'
    : practice
      ? c.kind === 'PRACTICE_REFERENCE' &&
        ['ATTEMPT_SERVICE', 'ASSESSMENT_SERVICE'].includes(c.origin)
      : c.kind === 'ACKNOWLEDGEMENT' && c.origin === 'ACKNOWLEDGEMENT_SERVICE';
  if (!supported || (!practice && c.practiceLink !== null))
    return refuse('UNSUPPORTED_EVIDENCE');
  if (c.policyId !== e.policyId || c.policyVersion !== e.policyVersion)
    return refuse('POLICY_BINDING_MISMATCH');
  if (
    c.studentId !== e.studentId ||
    c.conceptId !== e.conceptId ||
    c.section !== e.section
  )
    return refuse('SCOPE_BINDING_MISMATCH');
  if (
    c.conceptRevision !== e.conceptRevision ||
    c.sectionRevision !== e.sectionRevision
  )
    return refuse('REVISION_MISMATCH');
  if (visual) {
    if (
      !e.checkpoint ||
      !c.checkpoint ||
      c.checkpoint.validation !== 'VALIDATED' ||
      e.checkpoint.visualizationId !== c.checkpoint.visualizationId ||
      e.checkpoint.visualizationRevision !==
        c.checkpoint.visualizationRevision ||
      e.checkpoint.checkpointId !== c.checkpoint.checkpointId ||
      e.checkpoint.checkpointPolicyVersion !==
        c.checkpoint.checkpointPolicyVersion
    )
      return refuse('CHECKPOINT_BINDING_INVALID');
  } else if (e.checkpoint !== null || c.checkpoint !== null)
    return refuse('CHECKPOINT_BINDING_INVALID');
  if (
    c.issuedAtMs > asOfMs ||
    c.expiresAtMs <= c.issuedAtMs ||
    c.expiresAtMs - c.issuedAtMs > maxAgeMs ||
    (c.revokedAtMs !== null &&
      (c.revokedAtMs < c.issuedAtMs || c.revokedAtMs > asOfMs))
  )
    return refuse('INVALID_LIFECYCLE');
  if (c.revokedAtMs !== null) return refuse('EVIDENCE_REVOKED');
  if (asOfMs >= c.expiresAtMs) return refuse('EVIDENCE_EXPIRED');
  const applicable =
    !practice || e.challengeId !== null || c.challengeId !== null;
  if (applicable && e.challengeState === 'UNKNOWN')
    return refuse('REPLAY_STATE_UNAVAILABLE');
  if (e.challengeId !== c.challengeId || (applicable && e.challengeId === null))
    return refuse('CHALLENGE_BINDING_MISMATCH');
  if (
    observedEvidenceIds.includes(c.evidenceId) ||
    (applicable &&
      (e.challengeState === 'CONSUMED' ||
        consumedChallengeIds.includes(c.challengeId!)))
  )
    return refuse('REPLAY_DETECTED');
  if (practice) return refuse('PRACTICE_NOT_QUALIFIED');
  return {
    classification: visual ? 'CHECKPOINT_CANDIDATE' : 'ACTIVITY_CANDIDATE',
    completionQualification: 'NOT_ESTABLISHED',
    code: null,
  };
}

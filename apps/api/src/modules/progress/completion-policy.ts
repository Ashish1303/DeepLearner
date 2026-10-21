import { types } from 'node:util';
import { z } from 'zod';

const sections = [
  'READ',
  'VISUALIZE',
  'EXAMPLE',
  'PRACTICE',
  'REVISE',
] as const;
const codes = [
  'INVALID_INPUT',
  'UNSUPPORTED_VERSION',
  'INVALID_CONFIGURATION',
  'UNSUPPORTED_CONFIGURATION',
  'EVIDENCE_MISSING',
  'EVIDENCE_UNVERIFIED',
  'EVIDENCE_INCOMPLETE',
  'EVIDENCE_CONFLICT',
  'EVIDENCE_SCOPE_MISMATCH',
  'EVIDENCE_REVISION_MISMATCH',
  'PRACTICE_UNGRADED',
  'PRACTICE_SCORE_BELOW_THRESHOLD',
] as const;
export type CompletionSection = (typeof sections)[number];
export type CompletionBlockerCode = (typeof codes)[number];
export type CompletionBlocker = Readonly<{
  code: CompletionBlockerCode;
  section?: CompletionSection;
}>;
export type EligibilityResult = Readonly<{
  eligibility: 'ELIGIBLE' | 'INELIGIBLE';
  blockers: readonly CompletionBlocker[];
}>;

const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const token = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/);
const subjectSchema = z.strictObject({
  studentId: id,
  conceptId: id,
  conceptRevision: token,
});
const policySchema = z.strictObject({
  id: token,
  revision: token,
  requiredSections: z.array(z.enum(sections)).min(1).max(5).optional(),
  minimumScore: z.number().int().min(0).max(100).optional(),
});
const binding = {
  studentId: id,
  conceptId: id,
  conceptRevision: token,
  policyId: token,
  policyRevision: token,
};
const sectionSchema = z.strictObject({
  ...binding,
  evidenceId: token,
  section: z.enum(['READ', 'VISUALIZE', 'EXAMPLE', 'REVISE']),
  verification: z.enum(['VERIFIED', 'UNVERIFIED']),
  outcome: z.enum(['COMPLETED', 'INCOMPLETE']),
});
const practiceSchema = z
  .strictObject({
    ...binding,
    evaluationId: token,
    attemptId: id,
    questionId: id,
    questionRevision: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
    type: z.enum(['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']),
    verification: z.enum(['VERIFIED', 'UNVERIFIED']),
    gradingStatus: z.enum(['GRADED', 'UNGRADED']),
    score: z.number().min(0).max(100).nullable(),
  })
  .refine((row) =>
    row.gradingStatus === 'GRADED' ? row.score !== null : row.score === null,
  );
const envelopeSchema = z.strictObject({
  schemaVersion: z.unknown().optional(),
  subject: z.unknown(),
  policy: z.unknown(),
  sectionEvidence: z.unknown().optional(),
  practiceEvidence: z.unknown().optional(),
});
export type SectionEvidence = Readonly<z.output<typeof sectionSchema>>;
export type PracticeCandidate = Readonly<z.output<typeof practiceSchema>>;
export type CompletionPolicyInput = Readonly<{
  schemaVersion: 1;
  subject: Readonly<z.output<typeof subjectSchema>>;
  policy: Readonly<{
    id: string;
    revision: string;
    requiredSections?: readonly CompletionSection[];
    minimumScore?: number;
  }>;
  sectionEvidence?: readonly SectionEvidence[];
  practiceEvidence?: PracticeCandidate;
}>;

// Inspect descriptors before Zod, so supplied accessors/proxies are not invoked.
// Only bounded, plain metadata is copied; no caller object is mutated or frozen.
function metadata(input: unknown): unknown {
  const ancestors = new Set<object>();
  let remaining = 200;
  function copy(value: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 4) throw new Error();
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      if (value.length > 128) throw new Error();
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
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
    if (keys.length > 32 || keys.some((key) => typeof key !== 'string'))
      throw new Error();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const data = (key: string) => {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
        throw new Error();
      return copy(descriptor.value, depth + 1);
    };
    ancestors.add(value);
    try {
      if (array) {
        const length: unknown = descriptors.length?.value;
        if (
          typeof length !== 'number' ||
          length > 5 ||
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

function result(blockers: readonly CompletionBlocker[]): EligibilityResult {
  const unique = new Map<string, CompletionBlocker>();
  for (const blocker of blockers)
    unique.set(blocker.code + ':' + (blocker.section ?? ''), blocker);
  const ordered = [...unique.values()].sort(
    (a, b) =>
      codes.indexOf(a.code) - codes.indexOf(b.code) ||
      sections.indexOf(a.section!) - sections.indexOf(b.section!),
  );
  return {
    eligibility: ordered.length ? 'INELIGIBLE' : 'ELIGIBLE',
    blockers: ordered,
  };
}

/** Internal candidate evaluation only. VERIFIED metadata is not authentication,
 * grading provenance or authority to persist completion. No runtime adapter exists. */
export function evaluateCompletionPolicy(input: unknown): EligibilityResult {
  let safe: unknown;
  try {
    safe = metadata(input);
  } catch {
    return result([{ code: 'INVALID_INPUT' }]);
  }
  const envelope = envelopeSchema.safeParse(safe);
  if (!envelope.success) return result([{ code: 'INVALID_INPUT' }]);
  const raw = envelope.data;
  if (raw.schemaVersion !== 1) return result([{ code: 'UNSUPPORTED_VERSION' }]);
  const subject = subjectSchema.safeParse(raw.subject);
  if (!subject.success) return result([{ code: 'INVALID_INPUT' }]);
  const policy = policySchema.safeParse(raw.policy);
  if (
    !policy.success ||
    (Object.hasOwn(raw.policy!, 'requiredSections') &&
      policy.data.requiredSections === undefined) ||
    (Object.hasOwn(raw.policy!, 'minimumScore') &&
      policy.data.minimumScore === undefined)
  )
    return result([{ code: 'INVALID_CONFIGURATION' }]);
  const required = policy.data.requiredSections ?? [
    'READ',
    'VISUALIZE',
    'EXAMPLE',
    'PRACTICE',
  ];
  if (new Set(required).size !== required.length)
    return result([{ code: 'INVALID_CONFIGURATION' }]);
  if (!required.includes('VISUALIZE') || !required.includes('PRACTICE'))
    return result([{ code: 'UNSUPPORTED_CONFIGURATION' }]);
  const threshold = policy.data.minimumScore ?? 70;
  const actor = subject.data;
  const config = policy.data;
  const evidence = z
    .array(sectionSchema)
    .max(4)
    .safeParse(
      Object.hasOwn(raw, 'sectionEvidence') ? raw.sectionEvidence : [],
    );
  if (!evidence.success) return result([{ code: 'INVALID_INPUT' }]);
  const practice = Object.hasOwn(raw, 'practiceEvidence')
    ? practiceSchema.safeParse(raw.practiceEvidence)
    : null;
  if (practice && !practice.success) return result([{ code: 'INVALID_INPUT' }]);

  const blockers: CompletionBlocker[] = [];
  function checkBinding(
    row: z.output<typeof sectionSchema> | PracticeCandidate,
    section: CompletionSection,
  ) {
    if (
      row.studentId !== actor.studentId ||
      row.conceptId !== actor.conceptId ||
      row.policyId !== config.id
    )
      blockers.push({ code: 'EVIDENCE_SCOPE_MISMATCH', section });
    if (
      row.conceptRevision !== actor.conceptRevision ||
      row.policyRevision !== config.revision
    )
      blockers.push({ code: 'EVIDENCE_REVISION_MISMATCH', section });
  }
  const bySection = new Map<CompletionSection, SectionEvidence[]>();
  const identities = new Map<string, Set<CompletionSection>>();
  for (const row of evidence.data) {
    checkBinding(row, row.section);
    const entries = bySection.get(row.section) ?? [];
    entries.push(row);
    bySection.set(row.section, entries);
    const named =
      identities.get(row.evidenceId) ?? new Set<CompletionSection>();
    named.add(row.section);
    identities.set(row.evidenceId, named);
  }
  for (const [section, entries] of bySection)
    if (entries.length > 1)
      blockers.push({ code: 'EVIDENCE_CONFLICT', section });
  for (const named of identities.values())
    if (named.size > 1)
      for (const section of named)
        blockers.push({ code: 'EVIDENCE_CONFLICT', section });
  for (const section of sections) {
    if (section === 'PRACTICE' || !required.includes(section)) continue;
    const entries = bySection.get(section);
    if (!entries?.length) blockers.push({ code: 'EVIDENCE_MISSING', section });
    for (const row of entries ?? []) {
      if (row.verification !== 'VERIFIED')
        blockers.push({ code: 'EVIDENCE_UNVERIFIED', section });
      if (row.outcome !== 'COMPLETED')
        blockers.push({ code: 'EVIDENCE_INCOMPLETE', section });
    }
  }
  if (!practice)
    blockers.push({ code: 'EVIDENCE_MISSING', section: 'PRACTICE' });
  else if (practice.success) {
    const row = practice.data;
    checkBinding(row, 'PRACTICE');
    if (row.verification !== 'VERIFIED')
      blockers.push({ code: 'EVIDENCE_UNVERIFIED', section: 'PRACTICE' });
    if (row.gradingStatus !== 'GRADED')
      blockers.push({ code: 'PRACTICE_UNGRADED', section: 'PRACTICE' });
    else if (row.verification === 'VERIFIED' && row.score! < threshold)
      blockers.push({
        code: 'PRACTICE_SCORE_BELOW_THRESHOLD',
        section: 'PRACTICE',
      });
  }
  return result(blockers);
}

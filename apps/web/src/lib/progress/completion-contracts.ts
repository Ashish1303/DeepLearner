import { z } from 'zod';
import {
  parseVisualization,
  type VisualizationData,
} from '../visualizations/contracts';

export const completionId = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const token = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/);
const choiceId = z.string().regex(/^[a-z][a-z0-9-]{0,63}(?![\s\S])/);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const date = z.iso.datetime({ precision: 3 });
export const section = z.enum([
  'READ',
  'VISUALIZE',
  'EXAMPLE',
  'PRACTICE',
  'REVISE',
]);
export type Section = z.output<typeof section>;
export type EvidenceSection = Exclude<Section, 'PRACTICE'>;
const ackSection = section.extract(['READ', 'EXAMPLE', 'REVISE']);
const evidenceStatus = z.enum([
  'MISSING',
  'QUALIFIED',
  'STALE',
  'REVOKED',
  'UNSUPPORTED',
]);
const graph = z.unknown().transform((value, ctx): VisualizationData => {
  const parsed = parseVisualization(value);
  if (!parsed) {
    ctx.addIssue({ code: 'custom', message: 'Invalid visualization' });
    return z.NEVER;
  }
  return parsed;
});
export const completionView = z
  .strictObject({
    conceptId: completionId,
    viewRevision: digest,
    requiredSections: z.array(section).min(4).max(5),
    sections: z
      .array(z.strictObject({ section, status: evidenceStatus }))
      .min(4)
      .max(5),
    practice: z.strictObject({
      questionId: completionId.nullable(),
      type: z.literal('OUTPUT').nullable(),
      status: z.enum([
        'MISSING',
        'QUALIFIED',
        'BELOW_THRESHOLD',
        'UNQUALIFIED',
        'STALE',
        'REVOKED',
        'UNSUPPORTED',
      ]),
      score: z.union([z.literal(0), z.literal(100), z.null()]),
      minimumScore: z.literal(70),
    }),
    eligibility: z.enum(['ELIGIBLE', 'INELIGIBLE']),
    blockers: z
      .array(
        z.strictObject({
          code: z.enum([
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
            'POLICY_UNAVAILABLE',
            'REQUIRED_CONTENT_UNSUPPORTED',
            'RECEIPT_UNAVAILABLE',
            'PRE_DISCLOSURE_NOT_PROVEN',
            'ASSESSMENT_UNAVAILABLE',
            'COMPLETION_STALE',
          ]),
          section: section.optional(),
        }),
      )
      .max(40),
    completion: z.strictObject({
      status: z.enum(['NOT_COMPLETED', 'COMPLETED', 'STALE', 'REVOKED']),
      completedAt: date.nullable(),
    }),
    visualization: z.strictObject({ id: completionId, graph }).nullable(),
  })
  .refine((v) => {
    const expected = [
      'READ',
      'VISUALIZE',
      'EXAMPLE',
      'PRACTICE',
      ...(v.requiredSections.includes('REVISE') ? ['REVISE'] : []),
    ];
    return (
      JSON.stringify(v.requiredSections) === JSON.stringify(expected) &&
      JSON.stringify(v.sections.map((s) => s.section)) ===
        JSON.stringify(expected) &&
      (v.eligibility !== 'ELIGIBLE' ||
        (v.blockers.length === 0 &&
          v.sections.every((s) => s.status === 'QUALIFIED') &&
          v.practice.status === 'QUALIFIED' &&
          v.practice.score === 100)) &&
      (v.completion.status !== 'COMPLETED' ||
        (v.eligibility === 'ELIGIBLE' && v.completion.completedAt !== null))
    );
  });
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => v === v.trim());
export const completionIssue = z.union([
  z
    .strictObject({
      section: ackSection,
      challenge: z.strictObject({
        id: completionId,
        conceptId: completionId,
        section: ackSection,
        conceptRevision: digest,
        sectionRevision: digest,
        policyId: token,
        policyVersion: version,
        expiresAt: date,
      }),
    })
    .refine((v) => v.section === v.challenge.section),
  z.strictObject({
    section: z.literal('VISUALIZE'),
    challenge: z.strictObject({
      id: completionId,
      conceptId: completionId,
      visualizationId: completionId,
      checkpointId: token,
      checkpointVersion: version,
      policyId: token,
      policyVersion: version,
      prompt: text(2000),
      textAlternative: text(4000),
      choices: z
        .array(z.strictObject({ id: choiceId, label: text(1000) }))
        .min(2)
        .max(10)
        .refine((v) => new Set(v.map((c) => c.id)).size === v.length),
      expiresAt: date,
    }),
  }),
]);
export const completionResponse = z.union([
  z
    .strictObject({
      section: ackSection,
      receipt: z.strictObject({
        id: completionId,
        conceptId: completionId,
        section: ackSection,
        acknowledgedAt: date,
        completionQualification: z.literal('NOT_ESTABLISHED'),
      }),
    })
    .refine((v) => v.section === v.receipt.section),
  z.strictObject({
    section: z.literal('VISUALIZE'),
    receipt: z.strictObject({
      id: completionId,
      conceptId: completionId,
      visualizationId: completionId,
      checkpointId: token,
      checkpointVersion: version,
      outcome: z.enum(['CORRECT', 'INCORRECT']),
      respondedAt: date,
      completionQualification: z.literal('NOT_ESTABLISHED'),
    }),
  }),
]);
export const responseBody = z.union([
  z.strictObject({ challengeId: completionId, acknowledged: z.literal(true) }),
  z.strictObject({ challengeId: completionId, selectedChoiceId: choiceId }),
]);
export const command = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('challenges'),
    key: z.uuidv4(),
    body: z.strictObject({ section: section.exclude(['PRACTICE']) }),
  }),
  z.strictObject({
    action: z.literal('responses'),
    key: z.uuidv4(),
    body: responseBody,
  }),
  z.strictObject({
    action: z.literal('complete'),
    key: z.uuidv4(),
    body: z.strictObject({ viewRevision: digest }),
  }),
]);
export type CompletionView = z.output<typeof completionView>;
export type CompletionIssue = z.output<typeof completionIssue>;
export type CompletionCommand = z.output<typeof command>;

import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { evidenceData } from './section-evidence-revision.js';

export const completionId = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
export const completionDigest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
export const completionSections = [
  'READ',
  'VISUALIZE',
  'EXAMPLE',
  'PRACTICE',
  'REVISE',
] as const;
export const completionSection = z.enum(completionSections);
export const completionGetRequest = z.strictObject({
  params: z.strictObject({}),
  query: z.strictObject({ conceptId: completionId }),
  body: z.undefined().optional(),
});
const params = z.strictObject({ conceptId: completionId });
export const completionIssueRequest = z.strictObject({
  params,
  query: z.strictObject({}),
  body: z.strictObject({ section: completionSection.exclude(['PRACTICE']) }),
});
export const completionResponseBody = z.union([
  z.strictObject({ challengeId: completionId, acknowledged: z.literal(true) }),
  z.strictObject({
    challengeId: completionId,
    selectedChoiceId: z.string().regex(/^[a-z][a-z0-9-]{0,63}(?![\s\S])/),
  }),
]);
export const completionResponseRequest = z.strictObject({
  params,
  query: z.strictObject({}),
  body: completionResponseBody,
});
export const completionCompleteRequest = z.strictObject({
  params,
  query: z.strictObject({}),
  body: z.strictObject({ viewRevision: completionDigest }),
});
export type CompletionResponseInput = z.output<typeof completionResponseBody>;
const graphId = z.string().regex(/^[a-z][a-z0-9-]{0,63}(?![\s\S])/);
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => v === v.trim());
const refs = (min: number, max: number) =>
  z
    .array(graphId)
    .min(min)
    .max(max)
    .refine((v) => new Set(v).size === v.length);
// Exact authored F026/F027 projection, no persistence/definition/answer fields.
export const completionGraph = z
  .strictObject({
    type: z.literal('ANIMATED_FLOW'),
    title: text(120),
    textAlternative: text(4000),
    nodes: z
      .array(
        z.strictObject({
          id: graphId,
          label: text(120),
          description: text(1000).optional(),
        }),
      )
      .min(1)
      .max(50),
    edges: z
      .array(
        z.strictObject({
          id: graphId,
          source: graphId,
          target: graphId,
          label: text(120),
        }),
      )
      .max(100),
    steps: z
      .array(
        z.strictObject({
          title: text(120),
          explanation: text(2000),
          nodeIds: refs(1, 50),
          edgeIds: refs(0, 100),
        }),
      )
      .min(1)
      .max(100),
    animationConfig: z
      .strictObject({
        stepDurationMs: z.number().int().min(100).max(10000),
        autoplay: z.literal(false),
      })
      .optional(),
    schemaVersion: z.literal(1),
  })
  .refine((g) => {
    const n = new Set(g.nodes.map((v) => v.id)),
      e = new Set(g.edges.map((v) => v.id));
    return (
      n.size === g.nodes.length &&
      e.size === g.edges.length &&
      g.edges.every((v) => n.has(v.source) && n.has(v.target)) &&
      g.steps.every(
        (v) =>
          v.nodeIds.every((id) => n.has(id)) &&
          v.edgeIds.every((id) => e.has(id)),
      ) &&
      Buffer.byteLength(JSON.stringify(g), 'utf8') <= 262144
    );
  });
export const completionBlockerCodes = [
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
] as const;
export const completionView = z
  .strictObject({
    conceptId: completionId,
    viewRevision: completionDigest,
    requiredSections: z.array(completionSection).min(4).max(5),
    sections: z
      .array(
        z.strictObject({
          section: completionSection,
          status: z.enum([
            'MISSING',
            'QUALIFIED',
            'STALE',
            'REVOKED',
            'UNSUPPORTED',
          ]),
        }),
      )
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
          code: z.enum(completionBlockerCodes),
          section: completionSection.optional(),
        }),
      )
      .max(40),
    completion: z.strictObject({
      status: z.enum(['NOT_COMPLETED', 'COMPLETED', 'STALE', 'REVOKED']),
      completedAt: z.iso.datetime({ precision: 3 }).nullable(),
    }),
    visualization: z
      .strictObject({ id: completionId, graph: completionGraph })
      .nullable(),
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
        (v.completion.completedAt !== null && v.eligibility === 'ELIGIBLE'))
    );
  });
export type CompletionView = z.output<typeof completionView>;
export type CompletionBlocker = CompletionView['blockers'][number];
const date = z.iso.datetime({ precision: 3 });
const ackSection = z.enum(['READ', 'EXAMPLE', 'REVISE']);
const policyToken = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/);
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const choice = z.strictObject({ id: graphId, label: text(1000) });
const ackIssue = z.strictObject({
  id: completionId,
  conceptId: completionId,
  section: ackSection,
  conceptRevision: completionDigest,
  sectionRevision: completionDigest,
  policyId: policyToken,
  policyVersion: positive,
  expiresAt: date,
});
const visualIssue = z.strictObject({
  id: completionId,
  conceptId: completionId,
  visualizationId: completionId,
  checkpointId: policyToken,
  checkpointVersion: positive,
  policyId: policyToken,
  policyVersion: positive,
  prompt: text(2000),
  textAlternative: text(4000),
  choices: z.array(choice).min(2).max(10),
  expiresAt: date,
});
export const completionIssueDto = z.union([
  z
    .strictObject({ section: ackSection, challenge: ackIssue })
    .refine((v) => v.section === v.challenge.section),
  z.strictObject({ section: z.literal('VISUALIZE'), challenge: visualIssue }),
]);
const ackReceipt = z.strictObject({
  id: completionId,
  conceptId: completionId,
  section: ackSection,
  acknowledgedAt: date,
  completionQualification: z.literal('NOT_ESTABLISHED'),
});
const visualReceipt = z.strictObject({
  id: completionId,
  conceptId: completionId,
  visualizationId: completionId,
  checkpointId: policyToken,
  checkpointVersion: positive,
  outcome: z.enum(['CORRECT', 'INCORRECT']),
  respondedAt: date,
  completionQualification: z.literal('NOT_ESTABLISHED'),
});
export const completionResponseDto = z.union([
  z
    .strictObject({ section: ackSection, receipt: ackReceipt })
    .refine((v) => v.section === v.receipt.section),
  z.strictObject({ section: z.literal('VISUALIZE'), receipt: visualReceipt }),
]);
export function parseCompletion<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  try {
    return schema.parse(evidenceData(input));
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid completion command');
  }
}
export const completionUnavailable = () =>
  new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Completion is unavailable');
export const completionUnconfirmed = () =>
  new AppError(
    503,
    'COMPLETION_COMMIT_UNCONFIRMED',
    'Completion could not be confirmed; retry the unchanged request',
  );
export const completionConflict = (
  code:
    | 'COMPLETION_INELIGIBLE'
    | 'COMPLETION_VIEW_CHANGED'
    | 'COMPLETION_IDEMPOTENCY_CONFLICT'
    | 'COMPLETION_RECEIPT_UNAVAILABLE',
) => new AppError(409, code, 'Completion request cannot be accepted');

import { z } from 'zod';

export const proposalId = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
export const operationId = z
  .string()
  .regex(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/,
  );
function text(max: number) {
  return z
    .string()
    .min(1)
    .max(max)
    .refine((s) => {
      if (s.length > max) return false; // Explicit UTF-16 contract; Zod counts Unicode code points.
      if (s.trim() !== s) return false;
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c <= 31 || c === 127 || c === 133 || c === 0x2028 || c === 0x2029)
          return false;
        if (c >= 0xd800 && c <= 0xdbff) {
          const next = s.charCodeAt(++i);
          if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
        } else if (c >= 0xdc00 && c <= 0xdfff) return false;
      }
      return true;
    });
}
export const contentSchema = z.strictObject({
  title: text(120),
  objectives: z
    .array(text(240))
    .min(1)
    .max(20)
    .refine((a) => new Set(a).size === a.length),
  audience: text(500),
  depth: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  runtime: z
    .strictObject({ name: text(80), version: text(80).nullable() })
    .nullable(),
  technologyVersion: text(80).nullable(),
  prerequisites: z
    .array(z.strictObject({ description: text(240) }))
    .max(20)
    .refine((a) => new Set(a.map((p) => p.description)).size === a.length),
});
export type ProposalContent = z.output<typeof contentSchema>;
const draftText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s.length <= max);
// Editable memory is bounded even before the required-field validation on Save.
export const draftSchema = z.strictObject({
  title: draftText(120),
  objectives: z.array(draftText(240)).min(1).max(20),
  audience: draftText(500),
  depth: z.enum(['', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  runtime: z
    .strictObject({ name: draftText(80), version: draftText(80).nullable() })
    .nullable(),
  technologyVersion: draftText(80).nullable(),
  prerequisites: z
    .array(z.strictObject({ description: draftText(240) }))
    .max(20),
});
export type ProposalDraft = z.output<typeof draftSchema>;
export const emptyDraft = (): ProposalDraft => ({
  title: '',
  objectives: [''],
  audience: '',
  depth: '',
  runtime: null,
  technologyVersion: null,
  prerequisites: [],
});
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const proposalDto = contentSchema
  .extend({
    id: proposalId,
    proposalId,
    technologyId: proposalId,
    revision: positive,
    schemaVersion: z.literal(1),
    source: z.strictObject({ id: proposalId, revision: positive }),
    createdAt: z.string().refine((v) => {
      const date = new Date(v);
      return Number.isFinite(date.getTime()) && date.toISOString() === v;
    }),
  })
  .refine(
    (v) =>
      v.proposalId === v.source.id &&
      v.source.revision === 1 &&
      v.id !== v.proposalId,
  );
export type Proposal = z.output<typeof proposalDto>;
export const proposalRequest = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('capture'),
    technologyId: proposalId,
    input: contentSchema,
  }),
  z.strictObject({ kind: z.literal('recover') }),
  z.strictObject({
    kind: z.literal('detail'),
    technologyId: proposalId,
    id: proposalId,
  }),
]);
export type ProposalRequest = z.output<typeof proposalRequest>;
export const captureBody = contentSchema.extend({
  technologyId: proposalId,
  operationId,
});
export type ProposalWireRequest =
  | { kind: 'capture'; input: z.output<typeof captureBody> }
  | { kind: 'recover'; technologyId: string; operationId: string }
  | { kind: 'detail'; technologyId: string; id: string };
export const recoveryDto = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('COMMITTED'), proposal: proposalDto }),
  z.strictObject({ state: z.literal('UNRESOLVED') }),
]);
export type ProposalResult = Proposal | z.output<typeof recoveryDto>;
/** Exact ordered content, independent of object key order. No digest/authority claim. */
export function sameContent(a: ProposalContent, b: ProposalContent) {
  const cells = (v: ProposalContent) => [
    v.title,
    v.objectives,
    v.audience,
    v.depth,
    v.runtime === null ? null : [v.runtime.name, v.runtime.version],
    v.technologyVersion,
    v.prerequisites.map((p) => p.description),
  ];
  return JSON.stringify(cells(a)) === JSON.stringify(cells(b));
}
export function matchesIntent(
  value: unknown,
  technologyId: string,
  content: ProposalContent,
): value is Proposal {
  const parsed = proposalDto.safeParse(value);
  return (
    parsed.success &&
    parsed.data.technologyId === technologyId &&
    parsed.data.revision === 1 &&
    sameContent(parsed.data, content)
  );
}
export const memoryNotice =
  'Private content and recovery context exist only in memory. Reload or closing this page loses them. If an earlier Save was not confirmed, do not repeat it: obtain separately approved operator reconciliation. Unload warnings are not guaranteed.';

export type ProposalIntentView =
  | { phase: 'none' }
  | { phase: 'context-lost' }
  | {
      phase: 'saving' | 'uncertain' | 'reconciling' | 'unresolved';
      technologyId: string;
      content: ProposalContent;
    };

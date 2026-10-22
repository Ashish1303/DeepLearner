import { z } from 'zod';
import { progressDtoSchema } from './progress.dto.js';
import { evidenceId } from './section-evidence-revision.js';

export const dashboardConcept = z.strictObject({
  id: evidenceId,
  title: z
    .string()
    .min(1)
    .max(120)
    .refine((s) => s === s.trim()),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/),
  difficulty: z.enum([
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'INTERVIEW_READY',
  ]),
});
export const dashboardMasteryResult = z.discriminatedUnion('classification', [
  z.strictObject({
    classification: z.enum(['WEAK', 'IMPROVING', 'STRONG']),
    code: z.literal('NONE'),
  }),
  z.strictObject({
    classification: z.literal('UNCLASSIFIED'),
    code: z.enum(['SCORE_MISSING', 'STALE_ASSESSMENT', 'REVOKED_ASSESSMENT']),
  }),
]);
export const dashboardMastery = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('EVALUATED'),
    result: dashboardMasteryResult,
    unavailableCode: z.null(),
  }),
  z.strictObject({
    status: z.literal('UNAVAILABLE'),
    result: z.null(),
    unavailableCode: z.literal('LOCAL_QUALIFICATION_UNAVAILABLE'),
  }),
]);
export const dashboardItem = z
  .strictObject({
    concept: dashboardConcept,
    activity: progressDtoSchema.refine(
      (a) => a.status === 'IN_PROGRESS' && a.attemptCount > 0,
    ),
    mastery: dashboardMastery,
  })
  .refine((i) => i.concept.id === i.activity.conceptId);
export const dashboardData = z
  .strictObject({
    items: z.array(dashboardItem).max(5),
    pagination: z.strictObject({
      limit: z.number().int().min(1).max(5),
      nextCursor: evidenceId.nullable(),
    }),
  })
  .refine(
    ({ items, pagination: p }) =>
      items.length <= p.limit &&
      items.every(
        (item, i) => i === 0 || items[i - 1]!.concept.id < item.concept.id,
      ) &&
      (p.nextCursor === null ||
        (items.length === p.limit &&
          p.nextCursor === items.at(-1)!.concept.id)),
  );
export type DashboardConcept = z.output<typeof dashboardConcept>;
export type DashboardData = z.output<typeof dashboardData>;

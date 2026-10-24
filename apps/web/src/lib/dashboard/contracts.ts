import { z } from 'zod';
import { progressData, progressId } from '../progress/contracts';

export const dashboardCursor = progressId.nullable();
export const dashboardConcept = z.strictObject({
  id: progressId,
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
const classification = z.discriminatedUnion('classification', [
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
    result: classification,
    unavailableCode: z.null(),
  }),
  z.strictObject({
    status: z.literal('UNAVAILABLE'),
    result: z.null(),
    unavailableCode: z.literal('LOCAL_QUALIFICATION_UNAVAILABLE'),
  }),
]);
const item = z
  .strictObject({
    concept: dashboardConcept,
    activity: progressData.refine(
      (a) => a.status === 'IN_PROGRESS' && a.attemptCount > 0,
    ),
    mastery: dashboardMastery,
  })
  .refine((row) => row.concept.id === row.activity.conceptId);
export const dashboardData = z
  .strictObject({
    items: z.array(item).max(5),
    pagination: z.strictObject({
      limit: z.literal(5),
      nextCursor: dashboardCursor,
    }),
  })
  .refine(
    ({ items, pagination }) =>
      items.every(
        (row, i) => i === 0 || items[i - 1]!.concept.id < row.concept.id,
      ) &&
      (pagination.nextCursor === null ||
        (items.length === 5 &&
          pagination.nextCursor === items.at(-1)!.concept.id)),
  );
export const dashboardEnvelope = z.strictObject({
  success: z.literal(true),
  data: dashboardData,
  message: z.null(),
  meta: z.strictObject({ requestId: z.string().min(1) }),
});
export type DashboardData = z.output<typeof dashboardData>;
export function parseDashboardPage(
  raw: unknown,
  cursor: string | null,
): DashboardData {
  const after = dashboardCursor.parse(cursor);
  const data = dashboardData.parse(raw);
  if (after !== null && data.items.some((row) => row.concept.id <= after))
    throw new Error('Invalid dashboard page');
  return data;
}

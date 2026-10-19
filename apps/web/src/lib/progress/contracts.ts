import { z } from 'zod';
export const progressId = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
export const progressData = z
  .strictObject({
    conceptId: progressId,
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS']),
    attemptCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    startedAt: z.iso.datetime({ precision: 3 }).nullable(),
    lastActivityAt: z.iso.datetime({ precision: 3 }).nullable(),
  })
  .refine((row) =>
    row.status === 'NOT_STARTED'
      ? row.attemptCount === 0 &&
        row.startedAt === null &&
        row.lastActivityAt === null
      : row.attemptCount > 0 &&
        row.startedAt !== null &&
        row.lastActivityAt !== null &&
        row.startedAt <= row.lastActivityAt,
  );
export const progressEnvelope = z.strictObject({
  success: z.literal(true),
  data: progressData,
  message: z.null(),
  meta: z.strictObject({ requestId: z.string().min(1) }),
});
export type ProgressData = z.output<typeof progressData>;

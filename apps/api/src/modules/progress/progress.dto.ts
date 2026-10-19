import { z } from 'zod';
export const activityStats = z
  .strictObject({
    attemptCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    startedAt: z.date().nullable(),
    lastActivityAt: z.date().nullable(),
  })
  .refine((row) =>
    row.attemptCount === 0
      ? row.startedAt === null && row.lastActivityAt === null
      : row.startedAt !== null &&
        row.lastActivityAt !== null &&
        row.startedAt <= row.lastActivityAt,
  );
export type ActivityStats = z.output<typeof activityStats>;
export const progressDtoSchema = z
  .strictObject({
    conceptId: z.string().regex(/^[a-f0-9]{24}(?![\s\S])/),
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
export type ProgressDto = z.output<typeof progressDtoSchema>;
export function progressDto(
  conceptId: string,
  input: ActivityStats,
): ProgressDto {
  const stats = activityStats.parse(input);
  return progressDtoSchema.parse({
    conceptId,
    status: stats.attemptCount ? 'IN_PROGRESS' : 'NOT_STARTED',
    attemptCount: stats.attemptCount,
    startedAt: stats.startedAt?.toISOString() ?? null,
    lastActivityAt: stats.lastActivityAt?.toISOString() ?? null,
  });
}

import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { evidenceData, evidenceId } from './section-evidence-revision.js';

export const dashboardQuery = z.strictObject({
  limit: z
    .string()
    .regex(/^[1-5](?![\s\S])/)
    .transform(Number)
    .default(5),
  cursor: evidenceId.optional(),
});
export const dashboardCommand = z.strictObject({
  accessToken: z.string().min(1).max(4096),
  query: dashboardQuery,
});
export type DashboardQuery = z.output<typeof dashboardQuery>;
export function parseDashboardCommand(input: unknown) {
  try {
    return dashboardCommand.parse(evidenceData(input));
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid dashboard request');
  }
}

import { AppError } from '../../common/errors/app-error.js';
import type { AccessTokens } from '../auth/access-token.service.js';
import {
  createMasteryService,
  type MasteryService,
} from './mastery.service.js';
import {
  dashboardData,
  dashboardMastery,
  type DashboardData,
} from './dashboard.dto.js';
import { parseDashboardCommand } from './dashboard.schema.js';
import {
  createDashboardRepository,
  dashboardUnavailable,
  type DashboardRepository,
} from './dashboard.repository.js';

/** Internal only. Importing never connects, creates origins or mounts a route. */
export function createDashboardService(
  tokens: Pick<AccessTokens, 'verify'>,
  config: { APP_ENV: string },
  repository: DashboardRepository = createDashboardRepository(),
  mastery: Pick<MasteryService, 'classify'> = createMasteryService(
    tokens,
    config,
    {
      id: 'F039_DEFAULT_MASTERY',
      version: 1,
      improvingMinimum: 60,
      strongMinimum: 80,
    },
  ),
  clock = () => performance.now(),
) {
  return {
    async read(input: unknown): Promise<DashboardData> {
      const started = clock();
      const remaining = () => {
        const n = Math.floor(30000 - (clock() - started));
        if (!Number.isFinite(n) || n <= 0) throw dashboardUnavailable();
        return n;
      };
      if (config.APP_ENV !== 'LOCAL')
        throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
      const command = parseDashboardCommand(input);
      try {
        const actor = await tokens.verify(command.accessToken);
        if (actor.role !== 'STUDENT')
          throw new AppError(403, 'AUTH_FORBIDDEN', 'Student access required');
        remaining();
        const selection = await repository.discover(
          actor.sub,
          command.query,
          remaining,
        );
        remaining();
        const rows = await repository.activity(
          actor.sub,
          selection.concepts,
          remaining,
        );
        if (
          rows.length !== selection.concepts.length ||
          rows.length > 5 ||
          rows.some((r, i) => r.concept.id !== selection.concepts[i]!.id)
        )
          throw dashboardUnavailable();
        if (rows.some((r) => r.context.origin) && remaining() < 12000)
          throw dashboardUnavailable();
        const outcomes = await Promise.allSettled(
          rows.map(async (row) => {
            remaining();
            let value;
            if (!row.context.origin)
              value = {
                status: 'UNAVAILABLE',
                result: null,
                unavailableCode: 'LOCAL_QUALIFICATION_UNAVAILABLE',
              };
            else {
              row.context.origin.assert();
              if (remaining() < 12000) throw dashboardUnavailable();
              const proofStarted = clock();
              const result = await mastery.classify({
                accessToken: command.accessToken,
                conceptId: row.concept.id,
              });
              if (clock() - proofStarted >= 10000) throw dashboardUnavailable();
              remaining();
              row.context.origin.assert();
              value = { status: 'EVALUATED', result, unavailableCode: null };
            }
            return {
              concept: row.concept,
              activity: row.activity,
              mastery: dashboardMastery.parse(value),
            };
          }),
        );
        const failed = outcomes.find((o) => o.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        remaining();
        await repository.finish(actor.sub, rows, remaining);
        const current = await tokens.verify(command.accessToken);
        if (
          current.sub !== actor.sub ||
          current.sid !== actor.sid ||
          current.role !== 'STUDENT'
        )
          throw new AppError(
            403,
            'AUTH_FORBIDDEN',
            'Current eligible account required',
          );
        for (const row of rows) row.context.origin?.assert();
        const result = dashboardData.parse({
          items: outcomes.map((o) => {
            if (o.status !== 'fulfilled') throw dashboardUnavailable();
            return o.value;
          }),
          pagination: selection.pagination,
        });
        remaining();
        return result;
      } catch (error) {
        if (error instanceof AppError && [401, 403].includes(error.statusCode))
          throw new AppError(
            error.statusCode,
            error.code,
            'Current authorized Student required',
          );
        throw dashboardUnavailable();
      }
    },
  };
}

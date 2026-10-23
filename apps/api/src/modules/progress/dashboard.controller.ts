import type { Request, Response } from 'express';
import { dashboardData } from './dashboard.dto.js';
import { dashboardUnavailable } from './dashboard.repository.js';
import type { DashboardQuery } from './dashboard.schema.js';
import type { createDashboardService } from './dashboard.service.js';
import { evidenceData } from './section-evidence-revision.js';

export type DashboardService = ReturnType<typeof createDashboardService>;
export function createDashboardController(service: DashboardService) {
  return {
    async get(req: Request, res: Response, query: DashboardQuery) {
      const value = await service.read({
        accessToken: req.headers.authorization!.slice(7),
        // The accepted internal command parses canonical query strings itself.
        query: {
          limit: String(query.limit),
          ...(query.cursor ? { cursor: query.cursor } : {}),
        },
      });
      let data;
      try {
        data = dashboardData.parse(evidenceData(value));
      } catch {
        throw dashboardUnavailable();
      }
      if (res.destroyed || res.writableEnded) return;
      res.json({
        success: true,
        data,
        message: null,
        meta: { requestId: req.requestId },
      });
    },
  };
}

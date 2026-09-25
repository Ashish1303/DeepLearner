import type { HealthStatus } from '@deeplearner/shared-types';
import type { RequestHandler } from 'express';
import { successResponse } from '../../common/http/response.js';

export const getHealth: RequestHandler = (req, res) => {
  const health: HealthStatus = { status: 'ok', service: 'deeplearner-api' };
  res.setHeader('Cache-Control', 'no-store');
  res.json(successResponse(health, req.requestId));
};

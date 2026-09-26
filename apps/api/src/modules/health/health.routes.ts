import { Router } from 'express';
import { getHealth } from './health.controller.js';
import { routeLabel } from '../../middleware/request-logger.js';

export const healthRouter = Router();
healthRouter.get('/', routeLabel('/api/v1/health'), getHealth);

import { Router } from 'express';
import { validateRequest } from '../../middleware/validate.js';
import { createTopicController } from './topic.controller.js';
import { createTopicService, type TopicService } from './topic.service.js';
import { topicRepository } from './topic.repository.js';
import { topicListRequest, topicDetailRequest } from './topic.schema.js';
import {
  createTopicRateLimit,
  topicLimitDefaults,
} from './topic-rate-limit.js';
export function createTopicRouter(
  service: TopicService = createTopicService(topicRepository),
  limits = topicLimitDefaults,
) {
  const router = Router();
  const controller = createTopicController(service);
  const limiter = createTopicRateLimit(limits);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/',
    limiter,
    validateRequest(topicListRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/topics';
      return controller.list(req, res, input.query);
    }),
  );
  router.get(
    '/:id',
    limiter,
    validateRequest(topicDetailRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/topics/:id';
      return controller.detail(req, res, input.params.id);
    }),
  );
  return router;
}

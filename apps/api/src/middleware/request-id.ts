import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, res, next) => {
  const supplied = req.get('X-Request-Id');
  req.requestId =
    supplied && /^[a-zA-Z0-9_-]{1,128}$/.test(supplied)
      ? supplied
      : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

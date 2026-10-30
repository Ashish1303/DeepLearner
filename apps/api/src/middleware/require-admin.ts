import type { RequestHandler } from 'express';
import { adminUnavailable } from '../modules/admin/admin-access.repository.js';
import type { AdminAccessService } from '../modules/admin/admin-access.service.js';

export function requireAdmin(service: AdminAccessService): RequestHandler {
  return async (req, res, next) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.once('aborted', abort);
    res.once('close', abort);
    try {
      if (req.aborted || res.destroyed) throw adminUnavailable();
      await service.authorize(req.auth, controller.signal);
      if (controller.signal.aborted || req.aborted || res.destroyed)
        throw adminUnavailable();
      next();
    } catch (error) {
      next(error);
    } finally {
      req.off('aborted', abort);
      res.off('close', abort);
    }
  };
}

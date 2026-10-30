import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { AuthContext } from '../auth/access-token.service.js';
import {
  adminAccessRepository,
  adminReadBudgetMs,
  adminUnavailable,
  type AdminAccessRepository,
} from './admin-access.repository.js';

const account = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  role: z.enum(['ADMIN', 'STUDENT']),
  status: z.enum(['ACTIVE', 'PENDING_VERIFICATION', 'DISABLED', 'SUSPENDED']),
  emailVerifiedAt: z.date().nullable().optional(),
});
const forbidden = () =>
  new AppError(403, 'AUTH_FORBIDDEN', 'Admin access required');

/** Only trusted authenticate middleware supplies actor; no client approval flag. */
export function createAdminAccessService(
  repository: AdminAccessRepository = adminAccessRepository,
  clock = () => performance.now(),
) {
  return {
    async authorize(actor: AuthContext | undefined, signal?: AbortSignal) {
      if (!actor)
        throw new AppError(
          401,
          'AUTH_ACCESS_TOKEN_MISSING',
          'Access token required',
        );
      if (actor.role !== 'ADMIN') throw forbidden();
      if (!/^[a-f0-9]{24}$/.test(actor.sub)) throw adminUnavailable();
      const started = clock();
      const controller = new AbortController();
      let terminal = false;
      let denied = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let rejectLoss: (reason: Error) => void = () => {};
      const loss = new Promise<never>((_resolve, reject) => {
        rejectLoss = reject;
      });
      const invalidate = () => {
        terminal = true;
        controller.abort();
        rejectLoss(adminUnavailable());
      };
      const remaining = () => {
        const elapsed = clock() - started;
        const ms = Math.floor(adminReadBudgetMs - elapsed);
        if (
          terminal ||
          signal?.aborted ||
          !Number.isFinite(elapsed) ||
          elapsed < 0 ||
          ms < 1
        )
          throw adminUnavailable();
        return ms;
      };
      try {
        signal?.addEventListener('abort', invalidate, { once: true });
        timer = setTimeout(invalidate, adminReadBudgetMs);
        const work = Promise.resolve().then(() =>
          repository.read(actor.sub, {
            timeoutMS: remaining(),
            signal: controller.signal,
          }),
        );
        // Loss/deadline rejects even when an adapter ignores cancellation. The
        // work promise can settle later, but can never dispatch a handler.
        const row = await Promise.race([work, loss]);
        remaining();
        if (row === null) {
          denied = true;
          throw forbidden();
        }
        const parsed = account.safeParse(row);
        if (!parsed.success || parsed.data._id.toHexString() !== actor.sub)
          throw adminUnavailable();
        if (
          parsed.data.role !== 'ADMIN' ||
          parsed.data.status !== 'ACTIVE' ||
          !parsed.data.emailVerifiedAt
        ) {
          denied = true;
          throw forbidden();
        }
        remaining();
      } catch (error) {
        if (
          denied &&
          error instanceof AppError &&
          error.code === 'AUTH_FORBIDDEN'
        )
          throw forbidden();
        throw adminUnavailable();
      } finally {
        terminal = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', invalidate);
        controller.abort();
      }
    },
  };
}
export type AdminAccessService = ReturnType<typeof createAdminAccessService>;

import { setTimeout as wait } from 'node:timers/promises';
import { AppError } from '../../common/errors/app-error.js';
import { authConfig } from '../../config/auth.js';
import type { RecoveryEmailService } from '../../common/email/email.service.js';
import type { PasswordRecoveryRepository } from './password-recovery.repository.js';
import { hashPassword, verifyPassword } from './password.service.js';
import {
  issueResetToken,
  resetDigest,
} from './password-reset-token.service.js';
import {
  passwordPolicyError,
  validateNewPassword,
} from './password-recovery.schema.js';

export function createPasswordRecoveryService(deps: {
  repository: PasswordRecoveryRepository;
  email: RecoveryEmailService;
  log: {
    warn: (
      fields: { requestId: string; event: string },
      message: string,
    ) => void;
  };
  now?: () => Date;
  hash?: typeof hashPassword;
  verify?: typeof verifyPassword;
  settle?: (started: number) => Promise<void>;
}) {
  const now = deps.now ?? (() => new Date());
  const hash = deps.hash ?? hashPassword;
  const verify = deps.verify ?? verifyPassword;
  const settle =
    deps.settle ??
    (async (started: number) => {
      await wait(
        Math.max(
          0,
          authConfig.recoveryResponseFloorMs - (performance.now() - started),
        ),
      );
    });
  async function deliver(
    operation: () => Promise<
      import('../../common/email/email.service.js').EmailStatus
    >,
    requestId: string,
  ) {
    try {
      if ((await operation()) === 'ACCEPTED') return;
    } catch {
      /* No raw provider errors. */
    }
    deps.log.warn(
      { requestId, event: 'PASSWORD_EMAIL_NOT_CONFIRMED' },
      'Password email acceptance not confirmed',
    );
  }
  return {
    async forgot(email: string, requestId: string) {
      const started = performance.now();
      try {
        const token = issueResetToken(now());
        const recipient = await deps.repository.forgot(
          email,
          { hash: token.hash, expiresAt: token.expiresAt },
          requestId,
        );
        if (recipient)
          await deliver(
            () =>
              deps.email.sendReset({
                to: recipient.email,
                firstName: recipient.firstName,
                tokenId: recipient.tokenId,
                rawToken: token.raw,
              }),
            requestId,
          );
      } finally {
        await settle(started);
      }
    },
    async reset(raw: string, newPassword: string, requestId: string) {
      validateNewPassword(newPassword);
      const digest = resetDigest(raw);
      await deps.repository.checkReset(digest, now);
      const passwordHash = await hash(newPassword);
      const recipient = await deps.repository.reset(
        digest,
        passwordHash,
        requestId,
        now,
      );
      await deliver(
        () =>
          deps.email.sendResetConfirmation({
            to: recipient.email,
            firstName: recipient.firstName,
            tokenId: recipient.tokenId,
          }),
        requestId,
      );
    },
    async change(
      userId: string,
      sessionId: string,
      currentPassword: string,
      newPassword: string,
      requestId: string,
    ) {
      validateNewPassword(newPassword);
      const oldHash = await deps.repository.current(userId, sessionId, now);
      if (!(await verify(currentPassword, oldHash)))
        throw new AppError(
          401,
          'AUTH_CURRENT_PASSWORD_INVALID',
          'Current password is invalid',
        );
      if (currentPassword === newPassword) throw passwordPolicyError();
      const newHash = await hash(newPassword);
      await deps.repository.change(
        { userId, sessionId, oldHash, newHash, requestId },
        now,
      );
    },
  };
}
export type PasswordRecoveryService = ReturnType<
  typeof createPasswordRecoveryService
>;

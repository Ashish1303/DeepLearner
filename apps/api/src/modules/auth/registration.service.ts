import { setTimeout as wait } from 'node:timers/promises';
import type {
  EmailService,
  EmailStatus,
} from '../../common/email/email.service.js';
import { authConfig } from '../../config/auth.js';
import type { RegistrationInput } from './auth.schema.js';
import type {
  RegistrationRepository,
  RegisteredAccount,
} from './registration.repository.js';
import { hashPassword } from './password.service.js';
import {
  digestToken,
  issueVerificationToken,
} from './verification-token.service.js';

export function createRegistrationService(deps: {
  repository: RegistrationRepository;
  email: EmailService;
  log: {
    warn: (
      fields: { requestId: string; event: string },
      message: string,
    ) => void;
  };
  hash?: (password: string) => Promise<string>;
  now?: () => Date;
  settleResend?: (started: number) => Promise<void>;
}) {
  const now = deps.now ?? (() => new Date());
  const hash = deps.hash ?? hashPassword;
  const settle =
    deps.settleResend ??
    (async (started: number) => {
      await wait(
        Math.max(
          0,
          authConfig.resendResponseFloorMs - (performance.now() - started),
        ),
      );
    });
  async function deliver(
    account: RegisteredAccount,
    rawToken: string,
    requestId: string,
  ): Promise<EmailStatus> {
    let status: EmailStatus = 'NOT_CONFIRMED';
    try {
      status = await deps.email.sendVerification({
        to: account.email,
        firstName: account.firstName,
        tokenId: account.tokenId,
        rawToken,
      });
    } catch {
      /* Never surface provider errors. */
    }
    if (status !== 'ACCEPTED')
      deps.log.warn(
        { requestId, event: 'VERIFICATION_EMAIL_NOT_CONFIRMED' },
        'Verification email acceptance not confirmed',
      );
    return status;
  }
  return {
    async register(input: RegistrationInput, requestId: string) {
      const { password, ...details } = input;
      const passwordHash = await hash(password);
      const token = issueVerificationToken(now());
      const account = await deps.repository.register(
        { ...details, passwordHash },
        { hash: token.hash, expiresAt: token.expiresAt },
        requestId,
      );
      const verificationEmailStatus = await deliver(
        account,
        token.raw,
        requestId,
      );
      return {
        userId: account.userId,
        email: account.email,
        status: 'PENDING_VERIFICATION' as const,
        verificationRequired: true as const,
        verificationEmailStatus,
      };
    },
    async verify(rawToken: string, requestId: string) {
      await deps.repository.verify(digestToken(rawToken), requestId, now);
      return { verified: true as const };
    },
    async resend(email: string, requestId: string) {
      const started = performance.now();
      try {
        const token = issueVerificationToken(now());
        const account = await deps.repository.resend(email, {
          hash: token.hash,
          expiresAt: token.expiresAt,
        });
        if (account) await deliver(account, token.raw, requestId);
      } finally {
        await settle(started);
      }
    },
  };
}
export type RegistrationService = ReturnType<typeof createRegistrationService>;

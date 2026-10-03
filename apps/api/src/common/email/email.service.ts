import { setTimeout as wait } from 'node:timers/promises';
import { authConfig } from '../../config/auth.js';
import { verificationEmail } from './verification-email.js';
import {
  passwordResetEmail,
  passwordResetConfirmation,
} from './password-recovery-email.js';

export type EmailStatus = 'ACCEPTED' | 'NOT_CONFIRMED';
export interface VerificationDelivery {
  to: string;
  firstName: string;
  rawToken: string;
  tokenId: string;
}
export interface EmailService {
  sendVerification(input: VerificationDelivery): Promise<EmailStatus>;
}
export interface EmailConfig {
  EMAIL_PROVIDER: 'disabled' | 'resend';
  EMAIL_FROM?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  WEB_ORIGIN: string;
}

export interface RecoveryEmailService {
  sendReset(input: VerificationDelivery): Promise<EmailStatus>;
  sendResetConfirmation(
    input: Omit<VerificationDelivery, 'rawToken'>,
  ): Promise<EmailStatus>;
}
async function send(
  config: EmailConfig,
  transport: typeof fetch,
  to: string,
  content: { subject: string; text: string; html: string },
  key: string,
): Promise<EmailStatus> {
  if (config.EMAIL_PROVIDER === 'disabled') return 'NOT_CONFIRMED';
  const body = JSON.stringify({
    from: config.EMAIL_FROM,
    to: [to],
    ...content,
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await transport('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: 'Bearer ' + config.RESEND_API_KEY,
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body,
        signal: AbortSignal.timeout(authConfig.emailTimeoutMs),
      });
      // Do not read provider response bodies, which may contain secrets.
      await response.body?.cancel();
      if (response.ok) return 'ACCEPTED';
      if (response.status !== 429 && response.status < 500)
        return 'NOT_CONFIRMED';
    } catch {
      /* Retry ambiguous failures only with the same idempotency key. */
    }
    if (attempt === 0) await wait(authConfig.emailRetryDelayMs);
  }
  return 'NOT_CONFIRMED';
}
export function createEmailService(
  config: EmailConfig,
  transport: typeof fetch = fetch,
): EmailService {
  return {
    async sendVerification(input) {
      if (config.EMAIL_PROVIDER === 'disabled') return 'NOT_CONFIRMED';
      return send(
        config,
        transport,
        input.to,
        verificationEmail(input.firstName, config.WEB_ORIGIN, input.rawToken),
        'verification/' + input.tokenId,
      );
    },
  };
}
export function createRecoveryEmailService(
  config: EmailConfig,
  transport: typeof fetch = fetch,
): RecoveryEmailService {
  return {
    async sendReset(input) {
      if (config.EMAIL_PROVIDER === 'disabled') return 'NOT_CONFIRMED';
      return send(
        config,
        transport,
        input.to,
        passwordResetEmail(input.firstName, config.WEB_ORIGIN, input.rawToken),
        'password-reset/' + input.tokenId,
      );
    },
    async sendResetConfirmation(input) {
      if (config.EMAIL_PROVIDER === 'disabled') return 'NOT_CONFIRMED';
      return send(
        config,
        transport,
        input.to,
        passwordResetConfirmation(input.firstName),
        'password-reset-confirmation/' + input.tokenId,
      );
    },
  };
}

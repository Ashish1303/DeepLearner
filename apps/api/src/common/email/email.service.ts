import { setTimeout as wait } from 'node:timers/promises';
import { authConfig } from '../../config/auth.js';
import { verificationEmail } from './verification-email.js';

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

export function createEmailService(
  config: EmailConfig,
  transport: typeof fetch = fetch,
): EmailService {
  return {
    async sendVerification(input) {
      if (config.EMAIL_PROVIDER === 'disabled') return 'NOT_CONFIRMED';
      const body = JSON.stringify({
        from: config.EMAIL_FROM,
        to: [input.to],
        ...verificationEmail(
          input.firstName,
          config.WEB_ORIGIN,
          input.rawToken,
        ),
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await transport('https://api.resend.com/emails', {
            method: 'POST',
            redirect: 'error',
            headers: {
              Authorization: `Bearer ${config.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': `verification/${input.tokenId}`,
            },
            body,
            signal: AbortSignal.timeout(authConfig.emailTimeoutMs),
          });
          // Never read provider response bodies: they can contain recipient/token data.
          await response.body?.cancel();
          if (response.ok) return 'ACCEPTED';
          if (response.status !== 429 && response.status < 500)
            return 'NOT_CONFIRMED';
        } catch {
          /* Ambiguous/transient delivery failures are safe to retry with the same key. */
        }
        if (attempt === 0) await wait(authConfig.emailRetryDelayMs);
      }
      return 'NOT_CONFIRMED';
    },
  };
}

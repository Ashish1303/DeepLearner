import { OAuth2Client, type Certificates } from 'google-auth-library';
import { decodeProtectedHeader } from 'jose';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { authConfig } from '../../config/auth.js';

const issuers = ['accounts.google.com', 'https://accounts.google.com'];
const claims = z.object({
  sub: z.string().min(1).max(255).regex(/^\S+$/),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  email_verified: z.boolean(),
  iss: z.enum(['accounts.google.com', 'https://accounts.google.com']),
  aud: z.string(),
  iat: z.number().int(),
  exp: z.number().int(),
  hd: z
    .string()
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/,
    )
    .optional(),
  given_name: z.unknown().optional(),
  family_name: z.unknown().optional(),
});
export interface GoogleIdentity {
  subject: string;
  email: string;
  authoritative: boolean;
  firstName?: string;
  lastName?: string;
}
export interface GoogleIdentityVerifier {
  verify(credential: string): Promise<GoogleIdentity>;
}
export const googleUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Google authentication is temporarily unavailable',
  );
export const invalidGoogleCredential = () =>
  new AppError(
    401,
    'AUTH_GOOGLE_CREDENTIAL_INVALID',
    'Google credential is invalid or expired',
  );

export function createGoogleIdentityVerifier(
  clientId: string | undefined,
  certificates?: () => Promise<Certificates>,
  now = () => new Date(),
): GoogleIdentityVerifier {
  const client = new OAuth2Client(clientId ? { clientId } : {});
  // Override the library's automatic retrieval retries with one bounded request.
  client.transporter.interceptors.request.add({
    async resolved(options) {
      options.retry = false;
      options.timeout = authConfig.googleTimeoutMs;
      options.signal = AbortSignal.timeout(authConfig.googleTimeoutMs);
      options.redirect = 'error';
      return options;
    },
  });
  const getCertificates =
    certificates ??
    (async () => (await client.getFederatedSignonCertsAsync()).certs);
  return {
    async verify(credential) {
      if (!clientId) throw googleUnavailable();
      try {
        const header = decodeProtectedHeader(credential);
        if (
          credential.length > 16384 ||
          header.alg !== 'RS256' ||
          typeof header.kid !== 'string' ||
          !header.kid
        )
          throw invalidGoogleCredential();
      } catch {
        throw invalidGoogleCredential();
      }
      let certs: Certificates;
      try {
        certs = await getCertificates();
      } catch {
        throw googleUnavailable();
      }
      let value: z.infer<typeof claims>;
      try {
        const ticket = await client.verifySignedJwtWithCertsAsync(
          credential,
          certs,
          clientId,
          issuers,
        );
        value = claims.parse(ticket.getPayload());
        const timestamp = Math.floor(now().getTime() / 1000);
        if (
          value.aud !== clientId ||
          value.exp <= timestamp ||
          value.iat > timestamp ||
          value.exp <= value.iat
        )
          throw invalidGoogleCredential();
      } catch {
        throw invalidGoogleCredential();
      }
      if (!value.email_verified)
        throw new AppError(
          403,
          'AUTH_GOOGLE_EMAIL_NOT_VERIFIED',
          'Google email must be verified',
        );
      return {
        subject: value.sub,
        email: value.email,
        authoritative: value.email.endsWith('@gmail.com') || Boolean(value.hd),
        ...(typeof value.given_name === 'string'
          ? { firstName: value.given_name.trim() }
          : {}),
        ...(typeof value.family_name === 'string'
          ? { lastName: value.family_name.trim() }
          : {}),
      };
    },
  };
}

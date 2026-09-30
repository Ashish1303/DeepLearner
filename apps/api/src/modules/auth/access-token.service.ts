import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';

const claims = z.object({
  sub: z.string().regex(/^[a-f0-9]{24}$/),
  sid: z.string().regex(/^[a-f0-9]{24}$/),
  role: z.enum(['STUDENT', 'ADMIN']),
  plan: z.enum(['FREE', 'PREMIUM']),
  jti: z.uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type AuthContext = Pick<
  z.infer<typeof claims>,
  'sub' | 'sid' | 'role' | 'plan'
>;
export interface TokenConfig {
  ACCESS_TOKEN_SECRET: string;
  ACCESS_TOKEN_ISSUER: string;
  ACCESS_TOKEN_AUDIENCE: string;
}
export function createAccessTokens(
  config: TokenConfig,
  now = () => new Date(),
) {
  const key = Buffer.from(config.ACCESS_TOKEN_SECRET, 'base64');
  if (key.length < 32 || key.toString('base64') !== config.ACCESS_TOKEN_SECRET)
    throw new Error('Invalid access signing configuration');
  return {
    async sign(context: AuthContext) {
      const iat = Math.floor(now().getTime() / 1000);
      const payload = claims.parse({
        ...context,
        jti: randomUUID(),
        iat,
        exp: iat + 900,
      });
      return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(config.ACCESS_TOKEN_ISSUER)
        .setAudience(config.ACCESS_TOKEN_AUDIENCE)
        .sign(key);
    },
    async verify(token: string): Promise<AuthContext> {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          issuer: config.ACCESS_TOKEN_ISSUER,
          audience: config.ACCESS_TOKEN_AUDIENCE,
          typ: 'JWT',
          currentDate: now(),
          requiredClaims: ['sub', 'sid', 'role', 'plan', 'jti', 'iat', 'exp'],
        });
        const value = claims.parse(payload);
        if (
          value.exp - value.iat !== 900 ||
          value.iat > Math.floor(now().getTime() / 1000)
        )
          throw new Error('Invalid lifetime');
        return {
          sub: value.sub,
          sid: value.sid,
          role: value.role,
          plan: value.plan,
        };
      } catch (error) {
        const expired =
          error instanceof Error &&
          'code' in error &&
          error.code === 'ERR_JWT_EXPIRED';
        throw new AppError(
          401,
          expired ? 'AUTH_ACCESS_TOKEN_EXPIRED' : 'AUTH_ACCESS_TOKEN_INVALID',
          'Access token is invalid or expired',
        );
      }
    },
  };
}
export type AccessTokens = ReturnType<typeof createAccessTokens>;

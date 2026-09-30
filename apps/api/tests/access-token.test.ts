import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT, decodeJwt } from 'jose';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';

const config = {
  ACCESS_TOKEN_SECRET: Buffer.from(
    Array.from({ length: 32 }, (_, i) => i + 1),
  ).toString('base64'),
  ACCESS_TOKEN_ISSUER: 'test-api',
  ACCESS_TOKEN_AUDIENCE: 'test-client',
};
const now = new Date('2026-09-29T10:00:00Z');
const context = {
  sub: 'a'.repeat(24),
  sid: 'b'.repeat(24),
  role: 'STUDENT' as const,
  plan: 'FREE' as const,
};
test('JWT has fixed lifetime, validated identity and no sensitive claims', async () => {
  const tokens = createAccessTokens(config, () => now);
  const token = await tokens.sign(context);
  assert.deepEqual(await tokens.verify(token), context);
  const payload = decodeJwt(token);
  assert.equal(payload.exp! - payload.iat!, 900);
  assert.deepEqual(Object.keys(payload).sort(), [
    'aud',
    'exp',
    'iat',
    'iss',
    'jti',
    'plan',
    'role',
    'sid',
    'sub',
  ]);
  await assert.rejects(
    createAccessTokens(config, () => new Date(+now + 900000)).verify(token),
    { code: 'AUTH_ACCESS_TOKEN_EXPIRED' },
  );
});
test('JWT rejects wrong algorithm, signature, claims, issuer, audience and lifetime', async () => {
  const tokens = createAccessTokens(config, () => now);
  const valid = decodeJwt(await tokens.sign(context));
  for (const patch of [
    { iss: 'other' },
    { aud: 'other' },
    { role: 'OWNER' },
    { sid: '' },
    { jti: '' },
    { sub: 'invalid' },
    { exp: valid.exp! + 1 },
    { iat: valid.iat! + 1, exp: valid.exp! + 1 },
  ]) {
    const token = await new SignJWT({ ...valid, ...patch })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(Buffer.from(config.ACCESS_TOKEN_SECRET, 'base64'));
    await assert.rejects(tokens.verify(token), {
      code: 'AUTH_ACCESS_TOKEN_INVALID',
    });
  }
  for (const key of [Buffer.alloc(32, 9), Buffer.alloc(64, 8)]) {
    const token = await new SignJWT(valid)
      .setProtectedHeader({
        alg: key.length === 64 ? 'HS512' : 'HS256',
        typ: 'JWT',
      })
      .sign(key);
    await assert.rejects(tokens.verify(token), {
      code: 'AUTH_ACCESS_TOKEN_INVALID',
    });
  }
  await assert.rejects(tokens.verify('malformed'), {
    code: 'AUTH_ACCESS_TOKEN_INVALID',
  });
  assert.throws(() =>
    createAccessTokens({ ...config, ACCESS_TOKEN_SECRET: 'short' }),
  );
});

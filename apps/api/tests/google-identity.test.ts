import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPair, exportSPKI, SignJWT } from 'jose';
import { createGoogleIdentityVerifier } from '../src/modules/auth/google-identity.service.js';

test('Google adapter verifies local RS256 fixtures, identity claims and email authority without network', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const audience = 'synthetic.apps.googleusercontent.com';
  const timestamp = Math.floor(Date.now() / 1000);
  const base = {
    sub: 'synthetic-sub',
    email: 'Test@gmail.com',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: audience,
    iat: timestamp - 10,
    exp: timestamp + 3600,
    given_name: 'Test',
    family_name: 'User',
  };
  const token = (patch: Record<string, unknown> = {}) =>
    new SignJWT({ ...base, ...patch })
      .setProtectedHeader({ alg: 'RS256', kid: 'local' })
      .sign(privateKey);
  const pem = await exportSPKI(publicKey);
  const verifier = createGoogleIdentityVerifier(audience, async () => ({
    local: pem,
  }));
  assert.deepEqual(await verifier.verify(await token()), {
    subject: base.sub,
    email: 'test@gmail.com',
    authoritative: true,
    firstName: 'Test',
    lastName: 'User',
  });
  assert.equal(
    (await verifier.verify(await token({ email: 'test@example.com' })))
      .authoritative,
    false,
  );
  assert.equal(
    (
      await verifier.verify(
        await token({ email: 'test@example.com', hd: 'example.com' }),
      )
    ).authoritative,
    true,
  );
  assert.equal(
    (await verifier.verify(await token({ email: 'test@notgmail.com' })))
      .authoritative,
    false,
  );
  assert.equal(
    (await verifier.verify(await token({ iss: 'accounts.google.com' })))
      .authoritative,
    true,
  );
  for (const patch of [
    { iss: 'https://evil.example' },
    { aud: 'wrong' },
    { exp: timestamp - 1 },
    { iat: timestamp + 30 },
    { sub: '' },
    { email: 'invalid' },
    { email_verified: 'true' },
    { hd: 'invalid/path' },
  ])
    await assert.rejects(verifier.verify(await token(patch)), {
      code: 'AUTH_GOOGLE_CREDENTIAL_INVALID',
    });
  await assert.rejects(
    verifier.verify(await token({ email_verified: false })),
    { code: 'AUTH_GOOGLE_EMAIL_NOT_VERIFIED' },
  );
  const other = await generateKeyPair('RS256');
  await assert.rejects(
    verifier.verify(
      await new SignJWT(base)
        .setProtectedHeader({ alg: 'RS256', kid: 'local' })
        .sign(other.privateKey),
    ),
    { code: 'AUTH_GOOGLE_CREDENTIAL_INVALID' },
  );
  await assert.rejects(verifier.verify('SECRET_SENTINEL'), (error) => {
    assert(error instanceof Error);
    assert(!error.message.includes('SECRET_SENTINEL'));
    return true;
  });
  await assert.rejects(
    createGoogleIdentityVerifier(undefined, async () => {
      throw new Error('must not run');
    }).verify(await token()),
    { code: 'DEPENDENCY_UNAVAILABLE' },
  );
  await assert.rejects(
    createGoogleIdentityVerifier(audience, async () => {
      throw new Error('PRIVATE_PROVIDER');
    }).verify(await token()),
    (error) => {
      assert(error instanceof Error);
      assert(!error.message.includes('PRIVATE_PROVIDER'));
      return 'code' in error && error.code === 'DEPENDENCY_UNAVAILABLE';
    },
  );
});

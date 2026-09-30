import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verify } from 'argon2';
import { User } from '../src/modules/users/user.model.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import {
  digestToken,
  issueVerificationToken,
} from '../src/modules/auth/verification-token.service.js';

test('real Argon2id hashes use approved parameters and randomized salts', async () => {
  const password = ' synthetic password with spaces ';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.match(first, /^\$argon2id\$v=19\$m=65536,p=1,t=3\$/);
  const user = new User({
    firstName: 'Synthetic',
    lastName: 'Test',
    email: 'synthetic@example.com',
    passwordHash: first,
  });
  await user.validate();
  assert.equal(user.passwordHash, first);
  assert.notEqual(first, second);
  assert.equal(await verify(first, password), true);
  assert.equal(await verify(first, password.trim()), false);
});
test('verification tokens are random, hashed and expire after fifteen minutes', () => {
  const now = new Date('2030-01-01');
  const first = issueVerificationToken(now);
  assert.match(first.raw, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(first.hash, digestToken(first.raw));
  assert.notEqual(first.raw, issueVerificationToken(now).raw);
  assert.equal(first.expiresAt.getTime() - now.getTime(), 900000);
});

test('F008 verifies installed Argon2id hashes without accepting incorrect or unsupported credentials', async () => {
  const { verifyPassword } =
    await import('../src/modules/auth/password.service.js');
  const encoded = await hashPassword('synthetic-password');
  assert.equal(await verifyPassword('synthetic-password', encoded), true);
  assert.equal(await verifyPassword('wrong-password', encoded), false);
  assert.equal(await verifyPassword('synthetic-password', 'malformed'), false);
  assert.equal(
    await verifyPassword(
      'synthetic-password',
      encoded.replace('$argon2id$', '$argon2i$'),
    ),
    false,
  );
});

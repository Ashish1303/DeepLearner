import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import { createRegistrationService } from '../src/modules/auth/registration.service.js';
import type { RegistrationRepository } from '../src/modules/auth/registration.repository.js';
import { registrationBody } from '../src/modules/auth/auth.schema.js';
import { digestToken } from '../src/modules/auth/verification-token.service.js';

const input = registrationBody.parse({
  firstName: ' Ada ',
  lastName: ' Lovelace ',
  email: ' STUDENT@EXAMPLE.COM ',
  password: 'not-a-real-password',
});
const account = {
  userId: 'user',
  tokenId: 'token',
  email: input.email,
  firstName: input.firstName,
};
function fixture() {
  const events: string[] = [];
  const repository: RegistrationRepository = {
    async register(data, token) {
      assert.equal('password' in data, false);
      assert.equal(data.passwordHash, 'synthetic-hash');
      assert.equal('raw' in token, false);
      assert.equal(token.expiresAt.getTime(), 900000);
      events.push('committed');
      return account;
    },
    async verify(hash, requestId, now) {
      assert.match(hash, /^[a-f0-9]{64}$/);
      assert.equal(requestId, 'request');
      assert.equal(now().getTime(), 0);
    },
    async resend() {
      return account;
    },
  };
  const service = createRegistrationService({
    repository,
    email: {
      async sendVerification(data) {
        events.push('email');
        assert.equal(data.to, input.email);
        assert.equal(digestToken(data.rawToken).length, 64);
        return 'ACCEPTED';
      },
    },
    log: {
      warn() {
        events.push('warning');
      },
    },
    hash: async () => 'synthetic-hash',
    now: () => new Date(0),
    settleResend: async () => {
      events.push('settled');
    },
  });
  return { service, repository, events };
}
test('registration normalizes fields, hashes and sends only after repository commit', async () => {
  const { service, events } = fixture();
  const result = await service.register(input, 'request');
  assert.equal(input.email, 'student@example.com');
  assert.equal(input.firstName, 'Ada');
  assert.deepEqual(events, ['committed', 'email']);
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      'email',
      'status',
      'userId',
      'verificationEmailStatus',
      'verificationRequired',
    ].sort(),
  );
  assert.equal(result.verificationEmailStatus, 'ACCEPTED');
});
test('duplicate/persistence failure sends nothing and preserves safe errors', async () => {
  for (const code of ['AUTH_EMAIL_ALREADY_EXISTS', 'DEPENDENCY_UNAVAILABLE']) {
    const { service, repository, events } = fixture();
    repository.register = async () => {
      throw new AppError(
        code === 'AUTH_EMAIL_ALREADY_EXISTS' ? 409 : 503,
        code,
        'Safe message',
      );
    };
    await assert.rejects(
      service.register(input, 'request'),
      (error: unknown) => error instanceof AppError && error.code === code,
    );
    assert.deepEqual(events, []);
  }
});
test('delivery failure preserves committed registration with NOT_CONFIRMED', async () => {
  let committed = false;
  const service = createRegistrationService({
    repository: {
      ...fixture().repository,
      register: async () => {
        committed = true;
        return account;
      },
    },
    email: {
      async sendVerification() {
        assert.equal(committed, true);
        throw new Error('SECRET_SENTINEL');
      },
    },
    hash: async () => 'hash',
    log: {
      warn(fields, message) {
        assert(
          !JSON.stringify({ fields, message }).includes('SECRET_SENTINEL'),
        );
      },
    },
  });
  assert.equal(
    (await service.register(input, 'request')).verificationEmailStatus,
    'NOT_CONFIRMED',
  );
});
test('verification delegates only the digest and propagates unusable-token errors', async () => {
  const { service, repository } = fixture();
  assert.deepEqual(await service.verify('a'.repeat(43), 'request'), {
    verified: true,
  });
  repository.verify = async () => {
    throw new AppError(
      400,
      'AUTH_VERIFICATION_TOKEN_INVALID_OR_EXPIRED',
      'Safe message',
    );
  };
  await assert.rejects(
    service.verify('a'.repeat(43), 'request'),
    /Safe message/,
  );
});
test('resend does not disclose account state and settles both eligible and ineligible paths', async () => {
  const { service, repository, events } = fixture();
  assert.equal(await service.resend(input.email, 'request'), undefined);
  repository.resend = async () => null;
  assert.equal(await service.resend(input.email, 'request'), undefined);
  assert.deepEqual(events, ['email', 'settled', 'settled']);
});
test('public schema rejects privilege injection, nulls, duplicates and bad password bounds', () => {
  for (const patch of [
    { role: 'ADMIN' },
    { status: 'ACTIVE' },
    { plan: 'PREMIUM' },
    { emailVerifiedAt: new Date() },
    { password: 'short' },
    { password: 'x'.repeat(129) },
    { profile: { learningGoals: [null] } },
    { profile: { interestedTechnologyIds: ['a'.repeat(24), 'A'.repeat(24)] } },
  ]) {
    assert.equal(
      registrationBody.safeParse({ ...input, ...patch }).success,
      false,
    );
  }
  assert.equal(
    registrationBody.safeParse({ ...input, profile: {} }).success,
    true,
  );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import { createLoginService } from '../src/modules/auth/login.service.js';
import {
  requireEligible,
  safeUser,
  type LoginAccount,
  type LoginRepository,
} from '../src/modules/auth/login.repository.js';
import {
  issueRefreshSecret,
  matchesRefreshHash,
  parseRefreshToken,
  refreshDigest,
} from '../src/modules/auth/refresh-token.service.js';
const now = new Date('2026-09-29T10:00:00Z');
const user: LoginAccount = {
  id: 'a'.repeat(24),
  email: 'synthetic@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'STUDENT',
  plan: 'FREE',
  status: 'ACTIVE',
  passwordHash: 'synthetic-hash',
  emailVerifiedAt: now,
  suspendedUntil: null,
};
test('eligibility never reactivates disabled or unverified accounts; suspension requires actual expired date', () => {
  for (const refresh of [false, true]) {
    assert.equal(requireEligible(user, now, refresh), false);
    assert.equal(
      requireEligible(
        { ...user, status: 'SUSPENDED', suspendedUntil: now },
        now,
        refresh,
      ),
      true,
    );
    assert.throws(
      () =>
        requireEligible(
          { ...user, status: 'DISABLED', suspendedUntil: new Date(0) },
          now,
          refresh,
        ),
      { code: 'AUTH_ACCOUNT_DISABLED' },
    );
    for (const suspendedUntil of [null, new Date(+now + 1), new Date(NaN)])
      assert.throws(
        () =>
          requireEligible(
            { ...user, status: 'SUSPENDED', suspendedUntil },
            now,
            refresh,
          ),
        { code: 'AUTH_ACCOUNT_SUSPENDED' },
      );
    for (const patch of [
      { status: 'PENDING_VERIFICATION' as const },
      { emailVerifiedAt: null },
      {
        status: 'SUSPENDED' as const,
        suspendedUntil: now,
        emailVerifiedAt: null,
      },
    ])
      assert.throws(
        () => requireEligible({ ...user, ...patch }, now, refresh),
        {
          code: refresh
            ? 'AUTH_REFRESH_TOKEN_INVALID'
            : 'AUTH_EMAIL_NOT_VERIFIED',
        },
      );
  }
});
test('opaque refresh secrets are unique, canonical and digest-only', () => {
  const first = issueRefreshSecret();
  assert.notEqual(first.secret, issueRefreshSecret().secret);
  assert.equal(first.hash, refreshDigest(first.secret));
  assert.deepEqual(parseRefreshToken(`${user.id}.${first.secret}`), {
    sessionId: user.id,
    hash: first.hash,
  });
  assert(matchesRefreshHash(first.hash, first.hash));
  assert(!matchesRefreshHash(first.hash, 'invalid'));
  for (const raw of [
    '',
    `${user.id}.short`,
    `invalid.${first.secret}`,
    `${user.id}.${first.secret}=`,
  ])
    assert.throws(() => parseRefreshToken(raw), {
      code: 'AUTH_REFRESH_TOKEN_INVALID',
    });
});
test('login service uses dummy verification, safe audit failure, fixed expiry and no raw repository secret', async () => {
  let account: LoginAccount | null = null;
  let verified = '';
  let warnings = 0;
  let writes = 0;
  const repository: LoginRepository = {
    async find() {
      return account;
    },
    async login(input, sign) {
      writes++;
      assert.equal(+input.expiresAt - +now, 30 * 86400000);
      assert.match(input.hash, /^[a-f0-9]{64}$/);
      assert(!('secret' in input));
      return {
        accessToken: await sign({
          sub: user.id,
          sid: input.sessionId,
          role: user.role,
          plan: user.plan,
        }),
        user: safeUser(user),
      };
    },
    async refresh(input) {
      assert.match(input.replacement, /^[a-f0-9]{64}$/);
      return { accessToken: 'signed', expiresAt: new Date(+now + 1000) };
    },
    async failedAudit() {
      throw new Error('PRIVATE');
    },
  };
  const service = createLoginService({
    repository,
    tokens: {
      async sign() {
        return 'signed';
      },
      async verify() {
        throw new Error('unused');
      },
    },
    now: () => now,
    dummy: async () => 'dummy-hash',
    verify: async (_password, hash) => {
      verified = hash;
      return true;
    },
    log: {
      warn(fields, message) {
        warnings++;
        assert(!JSON.stringify([fields, message]).includes('PRIVATE'));
      },
    },
  });
  const input = { email: user.email, password: 'synthetic-password' };
  await assert.rejects(service.login(input, 'request'), {
    code: 'AUTH_INVALID_CREDENTIALS',
  });
  assert.equal(verified, 'dummy-hash');
  account = { ...user, passwordHash: null };
  await assert.rejects(service.login(input, 'request'), {
    code: 'AUTH_INVALID_CREDENTIALS',
  });
  assert.equal(writes, 0);
  assert.equal(warnings, 2);
  account = user;
  const result = await service.login(input, 'request');
  assert.equal(result.expiresInSeconds, 900);
  assert(!('passwordHash' in result.user));
  const refreshed = await service.refresh(result.refreshToken, 'request');
  assert.equal(+refreshed.expiresAt, +now + 1000);
  repository.refresh = async () => {
    throw new AppError(401, 'AUTH_REFRESH_TOKEN_REUSED', 'Reuse');
  };
  await assert.rejects(service.refresh(result.refreshToken, 'request'), {
    code: 'AUTH_REFRESH_TOKEN_REUSED',
  });
});

test('wrong passwords never reach eligibility or session issuance; repository failures return no tokens', async () => {
  let writes = 0;
  let failureCode = '';
  const repository: LoginRepository = {
    async find() {
      return { ...user, status: 'DISABLED' };
    },
    async login() {
      writes++;
      throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
    },
    async refresh() {
      throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
    },
    async failedAudit(_id, reason) {
      failureCode = reason;
    },
  };
  const deps = {
    repository,
    tokens: {
      async sign() {
        throw new Error('Must not sign');
      },
      async verify() {
        throw new Error('unused');
      },
    },
    log: { warn() {} },
  };
  await assert.rejects(
    createLoginService({ ...deps, verify: async () => false }).login(
      { email: user.email, password: 'wrong-password' },
      'request',
    ),
    { code: 'AUTH_INVALID_CREDENTIALS' },
  );
  assert.equal(writes, 0);
  assert.equal(failureCode, 'INVALID_CREDENTIALS');
  await assert.rejects(
    createLoginService({ ...deps, verify: async () => true }).login(
      { email: user.email, password: 'synthetic-password' },
      'request',
    ),
    { code: 'DEPENDENCY_UNAVAILABLE' },
  );
  assert.equal(writes, 1);
});

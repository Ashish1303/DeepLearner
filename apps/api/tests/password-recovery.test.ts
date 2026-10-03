import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import { createPasswordRecoveryService } from '../src/modules/auth/password-recovery.service.js';
import type { PasswordRecoveryRepository } from '../src/modules/auth/password-recovery.repository.js';
import {
  issueResetToken,
  resetDigest,
} from '../src/modules/auth/password-reset-token.service.js';
import {
  resetPasswordRequest,
  changePasswordRequest,
} from '../src/modules/auth/password-recovery.schema.js';

const recipient = {
  email: 'synthetic@example.com',
  firstName: 'Test',
  tokenId: 'id',
};
function fixture() {
  const events: string[] = [];
  const repository: PasswordRecoveryRepository = {
    async forgot(_email, token) {
      events.push('commit');
      assert.match(token.hash, /^[a-f0-9]{64}$/);
      assert(!('raw' in token));
      return recipient;
    },
    async checkReset() {
      events.push('preflight');
    },
    async reset() {
      events.push('reset-commit');
      return recipient;
    },
    async current() {
      return 'old-hash';
    },
    async change() {
      events.push('change-commit');
    },
  };
  const deps = {
    repository,
    email: {
      async sendReset() {
        events.push('email');
        return 'NOT_CONFIRMED' as const;
      },
      async sendResetConfirmation() {
        events.push('confirmation');
        return 'NOT_CONFIRMED' as const;
      },
    },
    log: {
      warn(fields: unknown, message: string) {
        assert(!JSON.stringify({ fields, message }).includes(recipient.email));
        events.push('safe-log');
      },
    },
    async hash() {
      events.push('hash');
      return 'new-hash';
    },
    async verify(password: string) {
      return password === 'old-password';
    },
    async settle() {
      events.push('settle');
    },
  };
  return { deps, events, service: createPasswordRecoveryService(deps) };
}
test('reset secrets have 256 bits, digest-only representation, fixed thirty-minute lifetime and canonical parsing', () => {
  const now = new Date();
  const a = issueResetToken(now);
  const b = issueResetToken(now);
  assert.equal(Buffer.from(a.raw, 'base64url').length, 32);
  assert.notEqual(a.raw, b.raw);
  assert.equal(a.hash, resetDigest(a.raw));
  assert.equal(+a.expiresAt - +now, 1800000);
  for (const raw of ['', 'bad', 'a'.repeat(42), 'a'.repeat(44), '!'.repeat(43)])
    assert.throws(() => resetDigest(raw), {
      code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
    });
});
test('forgot delivers after commit; unconfirmed delivery retains successful processing and timing floor', async () => {
  const f = fixture();
  await f.service.forgot(recipient.email, 'request');
  assert.deepEqual(f.events, ['commit', 'email', 'safe-log', 'settle']);
});
test('forgot ineligible paths deliver nothing and pre-commit failures propagate instead of false success', async () => {
  const f = fixture();
  f.deps.repository.forgot = async () => null;
  await f.service.forgot(recipient.email, 'request');
  assert.deepEqual(f.events, ['settle']);
  f.deps.repository.forgot = async () => {
    throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
  };
  await assert.rejects(f.service.forgot(recipient.email, 'request'), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.deepEqual(f.events, ['settle', 'settle']);
});
test('reset commits before confirmation; malformed, unusable and persistence-failed resets send nothing', async () => {
  const f = fixture(),
    token = issueResetToken(new Date());
  await f.service.reset(token.raw, 'new-password', 'request');
  assert.deepEqual(f.events, [
    'preflight',
    'hash',
    'reset-commit',
    'confirmation',
    'safe-log',
  ]);
  f.events.length = 0;
  await assert.rejects(f.service.reset('invalid', 'new-password', 'request'), {
    code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
  });
  assert.deepEqual(f.events, []);
  f.deps.repository.reset = async () => {
    throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
  };
  await assert.rejects(f.service.reset(token.raw, 'new-password', 'request'), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.deepEqual(f.events, ['preflight', 'hash']);
});
test('provider exceptions after commits never escape or roll back successful operations', async () => {
  const f = fixture();
  f.deps.email.sendReset = async () => {
    throw new Error('SECRET_SENTINEL');
  };
  f.deps.email.sendResetConfirmation = async () => {
    throw new Error('SECRET_SENTINEL');
  };
  await f.service.forgot(recipient.email, 'request');
  await f.service.reset(
    issueResetToken(new Date()).raw,
    'new-password',
    'request',
  );
  assert.equal(f.events.filter((x) => x === 'safe-log').length, 2);
});
test('change verifies current password, rejects reuse and preserves the repository compare-and-update input', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.change(
      'user',
      'session',
      'wrong-password',
      'new-password',
      'request',
    ),
    { code: 'AUTH_CURRENT_PASSWORD_INVALID' },
  );
  await assert.rejects(
    f.service.change(
      'user',
      'session',
      'old-password',
      'old-password',
      'request',
    ),
    { code: 'AUTH_PASSWORD_POLICY_FAILED' },
  );
  assert.deepEqual(f.events, []);
  f.deps.repository.change = async (input) => {
    assert.deepEqual(input, {
      userId: 'user',
      sessionId: 'session',
      oldHash: 'old-hash',
      newHash: 'new-hash',
      requestId: 'request',
    });
  };
  await f.service.change(
    'user',
    'session',
    'old-password',
    'new-password',
    'request',
  );
  assert.deepEqual(f.events, ['hash']);
});
test('password policy and strict request shape reject bad lengths and identity injection', async () => {
  const f = fixture();
  for (const value of ['short', 'x'.repeat(129)])
    await assert.rejects(
      f.service.reset(issueResetToken(new Date()).raw, value, 'request'),
      { code: 'AUTH_PASSWORD_POLICY_FAILED' },
    );
  assert(
    !resetPasswordRequest.safeParse({
      body: { token: 'x', newPassword: 'new-password', userId: 'injected' },
      params: {},
      query: {},
    }).success,
  );
  assert(
    !changePasswordRequest.safeParse({
      body: { currentPassword: 'old-password', newPassword: null },
      params: {},
      query: {},
    }).success,
  );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { googleAuthRepository } from '../src/modules/auth/google-auth.repository.js';
import { createGoogleAuthService } from '../src/modules/auth/google-auth.service.js';
import { AppError } from '../src/common/errors/app-error.js';
import { parseRefreshToken } from '../src/modules/auth/refresh-token.service.js';

const identity = {
  subject: 'synthetic-sub',
  email: 'test@gmail.com',
  authoritative: true,
  firstName: 'New',
  lastName: 'Name',
};
test('Google service verifies identity before persistence and emits only DeepLearner session credentials', async () => {
  const now = new Date();
  const events: string[] = [];
  const service = createGoogleAuthService({
    identity: {
      async verify() {
        events.push('verify');
        return identity;
      },
    },
    repository: {
      async login(input) {
        events.push('transaction');
        assert.equal(+input.expiresAt - +now, 30 * 86400000);
        assert.match(input.hash, /^[a-f0-9]{64}$/);
        assert(!('credential' in input));
        return {
          created: true,
          accessToken: 'synthetic-access',
          user: {
            id: 'a'.repeat(24),
            email: identity.email,
            firstName: 'New',
            lastName: 'Name',
            role: 'STUDENT',
            plan: 'FREE',
            status: 'ACTIVE',
          },
        };
      },
    },
    tokens: {
      async sign() {
        return 'synthetic-access';
      },
      async verify() {
        throw new Error('unused');
      },
    },
    now: () => now,
  });
  const result = await service.login('private-provider-token', 'request');
  assert.equal(result.expiresInSeconds, 900);
  assert.match(parseRefreshToken(result.refreshToken).hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(events, ['verify', 'transaction']);
  assert(!JSON.stringify(result).includes('private-provider-token'));
});

test('offline Google repository matrix, coordination and sanitization (not database atomicity)', async (context) => {
  const now = new Date();
  const id = new Types.ObjectId();
  const sessionId = new Types.ObjectId().toHexString();
  const base = {
    _id: id,
    email: identity.email,
    firstName: 'Existing',
    lastName: 'Person',
    role: 'ADMIN',
    plan: 'PREMIUM',
    status: 'ACTIVE',
    emailVerifiedAt: now,
    suspendedUntil: null,
    authProviders: [],
  };
  let current: Record<string, unknown> | null = base;
  let subjectMatch = false;
  let failAudit = false;
  let mutations: Record<string, unknown>[] = [];
  let actions: string[] = [];
  let started = 0;
  let ended = 0;
  const transaction = {
    async withTransaction(fn: () => Promise<unknown>) {
      return fn();
    },
    async endSession() {
      ended++;
    },
  };
  context.mock.method(User.collection, 'listIndexes', () => ({
    async toArray() {
      return [
        { unique: true, key: { email: 1 } },
        {
          unique: true,
          key: {
            'authProviders.provider': 1,
            'authProviders.providerUserId': 1,
          },
          partialFilterExpression: {
            'authProviders.providerUserId': { $type: 'string' },
          },
        },
      ];
    },
  }));
  context.mock.method(Session.collection, 'listIndexes', () => ({
    async toArray() {
      return [{ unique: true, key: { refreshTokenHash: 1 } }];
    },
  }));
  context.mock.method(mongoose.connection, 'startSession', async () => {
    started++;
    return transaction;
  });
  context.mock.method(User, 'findOne', (filter: Record<string, unknown>) => ({
    select() {
      return this;
    },
    async session(value: unknown) {
      assert.equal(value, transaction);
      return 'authProviders' in filter && !subjectMatch ? null : current;
    },
  }));
  context.mock.method(
    User,
    'updateOne',
    async (
      _filter: unknown,
      update: Record<string, unknown>,
      options: { session: unknown },
    ) => {
      assert.equal(options.session, transaction);
      mutations.push(update);
      return { modifiedCount: 1 };
    },
  );
  context.mock.method(
    User,
    'create',
    async (
      values: Record<string, unknown>[],
      options: { session: unknown },
    ) => {
      assert.equal(options.session, transaction);
      mutations.push(values[0]!);
      return [{ ...values[0], _id: id }];
    },
  );
  context.mock.method(
    Session,
    'create',
    async (_values: unknown, options: { session: unknown }) => {
      assert.equal(options.session, transaction);
    },
  );
  context.mock.method(
    Audit,
    'create',
    async (values: { action: string }[], options: { session: unknown }) => {
      assert.equal(options.session, transaction);
      if (failAudit) throw new Error('PRIVATE_DRIVER');
      actions.push(values[0]!.action);
    },
  );
  const run = async (patch = {}) => {
    try {
      return await googleAuthRepository.login(
        {
          identity: { ...identity, ...patch },
          sessionId,
          hash: 'a'.repeat(64),
          expiresAt: new Date(+now + 30 * 86400000),
          requestId: 'test',
          userAgent: '',
        },
        async () => 'access',
        () => now,
      );
    } finally {
      assert.equal(
        ended,
        started,
        'Every session ends before success or failure returns',
      );
    }
  };
  const result = await run();
  assert.equal(result.created, false);
  assert.equal(result.user.firstName, 'Existing');
  assert.equal(result.user.role, 'ADMIN');
  assert.deepEqual(actions, ['AUTH_PROVIDER_LINKED', 'AUTH_GOOGLE_LOGIN']);
  const set = mutations[0]!.$set as Record<string, unknown>;
  assert.deepEqual(Object.keys(set).sort(), ['authProviders', 'lastLoginAt']);
  assert.deepEqual(mutations[0]!.$inc, { __v: 1 });
  for (const [patch, code] of [
    [{ status: 'DISABLED' }, 'AUTH_ACCOUNT_DISABLED'],
    [{ status: 'PENDING_VERIFICATION' }, 'AUTH_GOOGLE_LINKING_NOT_ALLOWED'],
    [{ emailVerifiedAt: null }, 'AUTH_GOOGLE_LINKING_NOT_ALLOWED'],
    [{ status: 'SUSPENDED', suspendedUntil: null }, 'AUTH_ACCOUNT_SUSPENDED'],
    [
      { status: 'SUSPENDED', suspendedUntil: new Date(+now + 1000) },
      'AUTH_ACCOUNT_SUSPENDED',
    ],
    [
      { authProviders: [{ provider: 'GOOGLE', providerUserId: 'other' }] },
      'AUTH_GOOGLE_LINKING_NOT_ALLOWED',
    ],
  ] as const) {
    current = { ...base, ...patch };
    mutations = [];
    actions = [];
    await assert.rejects(run(), { code });
    assert.equal(mutations.length, 0);
    assert.equal(actions.length, 0);
  }
  current = base;
  await assert.rejects(run({ authoritative: false }), {
    code: 'AUTH_GOOGLE_LINKING_NOT_ALLOWED',
  });
  current = {
    ...base,
    status: 'SUSPENDED',
    suspendedUntil: new Date(+now - 1),
  };
  mutations = [];
  await run();
  assert.equal(
    (mutations[0]!.$set as Record<string, unknown>).status,
    'ACTIVE',
  );
  subjectMatch = true;
  current = {
    ...base,
    authProviders: [{ provider: 'GOOGLE', providerUserId: identity.subject }],
  };
  mutations = [];
  actions = [];
  const linked = await run({
    authoritative: false,
    email: 'changed@example.com',
  });
  assert.equal(linked.user.email, base.email);
  assert.deepEqual(actions, ['AUTH_GOOGLE_LOGIN']);
  assert.deepEqual(Object.keys(mutations[0]!.$set as object), ['lastLoginAt']);
  subjectMatch = false;
  current = null;
  mutations = [];
  actions = [];
  assert.equal((await run()).created, true);
  assert.equal(mutations[0]!.passwordHash, null);
  assert.equal(mutations[0]!.role, 'STUDENT');
  assert.equal(mutations[0]!.plan, 'FREE');
  for (const patch of [
    { firstName: undefined },
    { lastName: '' },
    { firstName: 'x'.repeat(81) },
  ])
    await assert.rejects(run(patch), {
      code: 'AUTH_GOOGLE_PROFILE_INCOMPLETE',
    });
  current = base;
  failAudit = true;
  await assert.rejects(run(), (error) => {
    assert(error instanceof AppError);
    assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE');
    assert(!error.message.includes('PRIVATE_DRIVER'));
    return true;
  });
  assert.equal(mongoose.connection.readyState, 0);
});

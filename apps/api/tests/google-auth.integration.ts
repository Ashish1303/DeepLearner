// Separately gated writes. Never part of the offline *.test.ts suite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { createGoogleAuthService } from '../src/modules/auth/google-auth.service.js';
import { googleAuthRepository } from '../src/modules/auth/google-auth.repository.js';
import type { GoogleIdentity } from '../src/modules/auth/google-identity.service.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { createLoginService } from '../src/modules/auth/login.service.js';
import { loginRepository } from '../src/modules/auth/login.repository.js';
import { createLogoutService } from '../src/modules/auth/logout.service.js';
import { logoutRepository } from '../src/modules/auth/logout.repository.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import { parseRefreshToken } from '../src/modules/auth/refresh-token.service.js';

test(
  'F011 isolated Google identity, linking and session transactions',
  { timeout: 90000 },
  async (context) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F011_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F011_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f011-test',
    );
    assert.equal(process.env.F011_TEST_DB, 'deeplearner-f011-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F011_TEST_URI,
        MONGODB_DB_NAME: process.env.F011_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    const sessions: Awaited<
      ReturnType<typeof mongoose.connection.startSession>
    >[] = [];
    const originalStartSession = mongoose.connection.startSession;
    context.mock.method(
      mongoose.connection,
      'startSession',
      async (...args: Parameters<typeof originalStartSession>) => {
        const session = await Reflect.apply(
          originalStartSession,
          mongoose.connection,
          args,
        );
        sessions.push(session);
        return session;
      },
    );
    const assertSessionsEnded = () => {
      assert(sessions.length > 0);
      assert(
        sessions.every((session) => session.hasEnded),
        'Transaction sessions must end on success and failure',
      );
    };
    const owned: string[] = [];
    try {
      await database.connect();
      const db = mongoose.connection.db;
      assert(db);
      assert.equal(
        (await db.admin().command({ hello: 1 })).setName,
        'f011-test',
      );
      assert.equal(
        (await db.listCollections().toArray()).length,
        0,
        'Refusing nonempty database',
      );
      for (const model of [User, Session, Audit]) {
        await db.createCollection(model.collection.name);
        owned.push(model.collection.name);
        await model.createIndexes();
      }
      const now = new Date();
      const tokens = createAccessTokens(
        {
          ACCESS_TOKEN_SECRET: Buffer.from(
            Array.from({ length: 32 }, (_, i) => i + 1),
          ).toString('base64'),
          ACCESS_TOKEN_ISSUER: 'f011-test',
          ACCESS_TOKEN_AUDIENCE: 'f011-test',
        },
        () => now,
      );
      const login = createLoginService({
        repository: loginRepository,
        tokens,
        now: () => now,
        log: { warn() {} },
      });
      const logout = createLogoutService(logoutRepository);
      const google = (identity: GoogleIdentity) =>
        createGoogleAuthService({
          identity: {
            async verify() {
              return identity;
            },
          },
          repository: googleAuthRepository,
          tokens,
          now: () => now,
        });
      let sequence = 0;
      const identity = (
        patch: Partial<GoogleIdentity> = {},
      ): GoogleIdentity => ({
        subject: `synthetic-sub-${++sequence}`,
        email: `synthetic-${sequence}@gmail.com`,
        authoritative: true,
        firstName: 'Test',
        lastName: 'User',
        ...patch,
      });
      const hash = await hashPassword('synthetic-password');
      const account = (email: string, patch: Record<string, unknown> = {}) =>
        User.create({
          email,
          firstName: 'Existing',
          lastName: 'Name',
          passwordHash: hash,
          role: 'ADMIN',
          plan: 'PREMIUM',
          status: 'ACTIVE',
          emailVerifiedAt: now,
          profile: {
            learningGoals: ['MASTER_TECHNOLOGY'],
            dailyStudyGoalMinutes: 45,
          },
          ...patch,
        });
      const metadata = (id: string | Types.ObjectId) =>
        User.findById(id)
          .select('+passwordHash +authProviders -updatedAt -lastLoginAt -__v')
          .lean();

      await context.test(
        'new users get passwordless student accounts, owned sessions, audits and safe projections',
        async () => {
          const value = identity();
          const result = await google(value).login('fake', 'new');
          assert.equal(result.created, true);
          assert.equal(result.user.role, 'STUDENT');
          assert.equal(result.user.plan, 'FREE');
          const user = await User.findById(result.user.id).select(
            '+passwordHash +authProviders',
          );
          assert(user);
          assert.equal(user.passwordHash, null);
          assert.equal(user.status, 'ACTIVE');
          assert(user.emailVerifiedAt);
          assert.equal(user.profile, undefined);
          assert.equal(user.authProviders[0]?.providerUserId, value.subject);
          assert(!JSON.stringify(user).includes(value.subject));
          assert.equal(
            (await User.findById(user._id))?.authProviders,
            undefined,
          );
          const session = await Session.findById(
            parseRefreshToken(result.refreshToken).sessionId,
          ).select('+refreshTokenHash');
          assert(session);
          assert.equal(+session.expiresAt - +now, 30 * 86400000);
          assert.equal(
            session.refreshTokenHash,
            parseRefreshToken(result.refreshToken).hash,
          );
          assert.equal(
            (await Session.findById(session._id))?.refreshTokenHash,
            undefined,
          );
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_GOOGLE_LOGIN',
            }),
            1,
          );
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_PROVIDER_LINKED',
            }),
            0,
          );
          const refreshed = await login.refresh(result.refreshToken, 'refresh');
          await logout.logout(refreshed.refreshToken, 'logout');
          await assert.rejects(
            login.refresh(refreshed.refreshToken, 'revoked'),
            { code: 'AUTH_REFRESH_TOKEN_INVALID' },
          );
        },
      );
      await context.test(
        'authoritative linking preserves credentials and profile; subject wins over changed email',
        async () => {
          const value = identity();
          const existing = await account(value.email);
          const before = await metadata(existing._id);
          assert(before);
          const result = await google(value).login('fake', 'link');
          assert.equal(result.created, false);
          assert.equal(result.user.id, String(existing._id));
          const after = await metadata(existing._id);
          assert(after);
          assert.deepEqual(after, {
            ...before,
            authProviders: [
              { provider: 'GOOGLE', providerUserId: value.subject },
            ],
          });
          assert.equal(
            await Audit.countDocuments({
              actorId: existing._id,
              action: 'AUTH_PROVIDER_LINKED',
            }),
            1,
          );
          const second = await google({
            ...value,
            email: 'changed@example.com',
            authoritative: false,
            firstName: 'Other',
          }).login('fake', 'linked');
          assert.equal(second.user.id, result.user.id);
          assert.equal(second.user.email, value.email);
          assert.deepEqual(await metadata(existing._id), after);
          assert.equal(
            await Audit.countDocuments({
              actorId: existing._id,
              action: 'AUTH_PROVIDER_LINKED',
            }),
            1,
          );
        },
      );
      await context.test(
        'pending, disabled, suspension, non-authoritative and conflicting linking create no mutations',
        async () => {
          for (const [patch, code] of [
            [
              { status: 'PENDING_VERIFICATION', emailVerifiedAt: null },
              'AUTH_GOOGLE_LINKING_NOT_ALLOWED',
            ],
            [{ status: 'DISABLED' }, 'AUTH_ACCOUNT_DISABLED'],
            [
              { status: 'SUSPENDED', suspendedUntil: null },
              'AUTH_ACCOUNT_SUSPENDED',
            ],
            [
              { status: 'SUSPENDED', suspendedUntil: new Date(+now + 60000) },
              'AUTH_ACCOUNT_SUSPENDED',
            ],
            [{ emailVerifiedAt: null }, 'AUTH_GOOGLE_LINKING_NOT_ALLOWED'],
          ] as const) {
            const value = identity();
            const user = await account(value.email, patch);
            const before = await metadata(user._id);
            await assert.rejects(google(value).login('fake', 'blocked'), {
              code,
            });
            assert.deepEqual(await metadata(user._id), before);
            assert.equal(await Session.countDocuments({ userId: user._id }), 0);
            assert.equal(await Audit.countDocuments({ actorId: user._id }), 0);
          }
          const value = identity();
          const user = await account(value.email);
          const before = await metadata(user._id);
          await assert.rejects(
            google({ ...value, authoritative: false }).login(
              'fake',
              'non-authoritative',
            ),
            { code: 'AUTH_GOOGLE_LINKING_NOT_ALLOWED' },
          );
          assert.deepEqual(await metadata(user._id), before);
          await google(value).login('fake', 'link');
          await assert.rejects(
            google({ ...value, subject: 'different-subject' }).login(
              'fake',
              'conflict',
            ),
            { code: 'AUTH_GOOGLE_LINKING_NOT_ALLOWED' },
          );
        },
      );
      await context.test(
        'only eligible expired suspension reactivates; incomplete new profiles create nothing',
        async () => {
          const value = identity();
          const user = await account(value.email, {
            status: 'SUSPENDED',
            suspendedUntil: new Date(+now - 1),
          });
          await google(value).login('fake', 'expired');
          assert.equal((await User.findById(user._id))?.status, 'ACTIVE');
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_GOOGLE_LOGIN',
              'metadata.reactivatedFromExpiredSuspension': true,
            }),
            1,
          );
          const incomplete = identity({ firstName: '' });
          await assert.rejects(google(incomplete).login('fake', 'incomplete'), {
            code: 'AUTH_GOOGLE_PROFILE_INCOMPLETE',
          });
          assert.equal(
            await User.countDocuments({ email: incomplete.email }),
            0,
          );
        },
      );
      await context.test(
        'audit failure rolls back new account or existing link, session and login metadata',
        async () => {
          for (const existing of [false, true]) {
            const value = identity();
            const user = existing ? await account(value.email) : null;
            const before = user
              ? await User.findById(user._id)
                  .select('+passwordHash +authProviders')
                  .lean()
              : null;
            const mock = context.mock.method(Audit, 'create', async () => {
              throw new Error('synthetic audit failure');
            });
            try {
              await assert.rejects(google(value).login('fake', 'rollback'), {
                code: 'DEPENDENCY_UNAVAILABLE',
              });
            } finally {
              mock.mock.restore();
              assertSessionsEnded();
            }
            assert.deepEqual(
              await User.findOne({ email: value.email })
                .select('+passwordHash +authProviders')
                .lean(),
              before,
            );
            if (user)
              assert.equal(
                await Session.countDocuments({ userId: user._id }),
                0,
              );
          }
        },
      );
      await context.test(
        'concurrent creation and linking converge on one user and one provider ownership',
        async () => {
          for (const existing of [false, true]) {
            const value = identity();
            if (existing) await account(value.email);
            const service = google(value);
            const settled = await Promise.allSettled([
              service.login('fake', 'race1'),
              service.login('fake', 'race2'),
            ]);
            assertSessionsEnded();
            const results = settled.map((result) => {
              if (result.status === 'rejected') throw result.reason;
              return result.value;
            });
            assert(results[0] && results[1]);
            assert.equal(results[0].user.id, results[1].user.id);
            assert.equal(await User.countDocuments({ email: value.email }), 1);
            const user = await User.findById(results[0].user.id).select(
              '+authProviders',
            );
            assert(user);
            assert.equal(user.authProviders.length, 1);
            assert.equal(await Session.countDocuments({ userId: user._id }), 2);
            assert.equal(
              await Audit.countDocuments({
                actorId: user._id,
                action: 'AUTH_PROVIDER_LINKED',
              }),
              existing ? 1 : 0,
            );
          }
        },
      );
      await context.test(
        'declared provider/email uniqueness rejects competing ownership',
        async () => {
          const value = identity();
          await google(value).login('fake', 'owner');
          await assert.rejects(account(value.email), { code: 11000 });
          await assert.rejects(
            account('different@example.com', {
              authProviders: [
                { provider: 'GOOGLE', providerUserId: value.subject },
              ],
            }),
            { code: 11000 },
          );
        },
      );
      await context.test(
        'logout-all and Google login admit only serialized session outcomes',
        async () => {
          const value = identity();
          const first = await google(value).login('fake', 'initial');
          const [created] = await Promise.all([
            google(value).login('fake', 'concurrent'),
            logout.logoutAll(first.user.id, 'all'),
          ]);
          const original = await Session.findById(
            parseRefreshToken(first.refreshToken).sessionId,
          );
          assert(original?.revokedAt);
          const raced = await Session.findById(
            parseRefreshToken(created.refreshToken).sessionId,
          );
          assert(raced);
          if (raced.revokedAt)
            await assert.rejects(
              login.refresh(created.refreshToken, 'revoked'),
              { code: 'AUTH_REFRESH_TOKEN_INVALID' },
            );
          else await login.refresh(created.refreshToken, 'after-all');
          assert.equal(+raced.expiresAt, +now + 30 * 86400000);
          context.diagnostic(
            `Google/logout-all: concurrent session ${raced.revokedAt ? 'revoked' : 'created after logout-all'}`,
          );
        },
      );
      assertSessionsEnded();
    } finally {
      try {
        for (const name of owned.reverse())
          await mongoose.connection.db!.dropCollection(name);
      } finally {
        await database.disconnect();
      }
    }
    assert.equal(mongoose.connection.readyState, 0);
  },
);

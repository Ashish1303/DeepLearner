// Writes require separate owner approval. Excluded from the offline *.test.ts suite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase, mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { PasswordResetToken } from '../src/modules/auth/password-reset-token.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { createPasswordRecoveryService } from '../src/modules/auth/password-recovery.service.js';
import { passwordRecoveryRepository } from '../src/modules/auth/password-recovery.repository.js';
import { createLoginService } from '../src/modules/auth/login.service.js';
import { loginRepository } from '../src/modules/auth/login.repository.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import {
  hashPassword,
  verifyPassword,
} from '../src/modules/auth/password.service.js';
import { resetDigest } from '../src/modules/auth/password-reset-token.service.js';
import { parseRefreshToken } from '../src/modules/auth/refresh-token.service.js';
import { Types } from 'mongoose';

test(
  'F010 isolated recovery transactions, eligibility and concurrency',
  { timeout: 90000 },
  async (context) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F010_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F010_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f010-test',
    );
    assert.equal(process.env.F010_TEST_DB, 'deeplearner-f010-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F010_TEST_URI,
        MONGODB_DB_NAME: process.env.F010_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    const owned: string[] = [];
    try {
      await database.connect();
      const db = mongoose.connection.db;
      assert(db);
      assert.equal(
        (await db.admin().command({ hello: 1 })).setName,
        'f010-test',
      );
      assert.equal(
        (await db.listCollections().toArray()).length,
        0,
        'Refusing nonempty database',
      );
      for (const model of [User, Session, PasswordResetToken, Audit]) {
        await db.createCollection(model.collection.name);
        owned.push(model.collection.name);
        await model.createIndexes();
      }
      let clock = new Date();
      const original = 'synthetic-old-password',
        replacement = 'synthetic-new-password';
      const passwordHash = await hashPassword(original);
      let sequence = 0;
      const account = (patch: Record<string, unknown> = {}) =>
        User.create({
          email: `synthetic-${++sequence}@example.com`,
          firstName: 'Test',
          lastName: 'User',
          status: 'ACTIVE',
          emailVerifiedAt: clock,
          passwordHash,
          ...patch,
        });
      const linkedAccount = () =>
        account({
          role: 'ADMIN',
          plan: 'PREMIUM',
          authProviders: [
            {
              provider: 'GOOGLE',
              providerUserId: `synthetic-linked-${sequence + 1}`,
            },
          ],
          profile: {
            experienceLevel: 'INTERMEDIATE',
            learningGoals: ['MASTER_TECHNOLOGY'],
            interestedTechnologyIds: [new Types.ObjectId()],
            preferredDifficulty: 'ADVANCED',
            dailyStudyGoalMinutes: 45,
          },
        });
      // Compare every persisted field except the three intentional password-write changes.
      // Explicitly include provider identities; ordinary selection excludes them.
      const accountMetadata = async (userId: Types.ObjectId) => {
        const value = await User.findById(userId)
          .select('+authProviders -passwordHash -updatedAt -__v')
          .lean();
        assert(value);
        assert.equal(value.role, 'ADMIN');
        assert.equal(value.plan, 'PREMIUM');
        assert.equal(value.status, 'ACTIVE');
        assert(value.authProviders?.length);
        assert(value.emailVerifiedAt);
        assert(value.profile);
        return value;
      };
      const delivered: { to: string; raw: string }[] = [];
      let confirmations = 0;
      const service = createPasswordRecoveryService({
        repository: passwordRecoveryRepository,
        email: {
          async sendReset(input) {
            delivered.push({ to: input.to, raw: input.rawToken });
            return 'ACCEPTED';
          },
          async sendResetConfirmation() {
            confirmations++;
            return 'ACCEPTED';
          },
        },
        log: { warn() {} },
        now: () => clock,
        settle: async () => {},
      });
      const tokens = createAccessTokens(
        {
          ACCESS_TOKEN_SECRET: Buffer.from(
            Array.from({ length: 32 }, (_, i) => i + 1),
          ).toString('base64'),
          ACCESS_TOKEN_ISSUER: 'f010-test',
          ACCESS_TOKEN_AUDIENCE: 'f010-test',
        },
        () => clock,
      );
      const login = createLoginService({
        repository: loginRepository,
        tokens,
        now: () => clock,
        log: { warn() {} },
      });
      const signIn = (email: string) =>
        login.login({ email, password: original }, 'integration-login');
      const issue = async (email: string) => {
        await service.forgot(email, 'forgot');
        const item = delivered.at(-1);
        assert(item && item.to === email);
        return item.raw;
      };
      const storedHash = async (userId: Types.ObjectId) =>
        (await User.findById(userId).select('+passwordHash'))!.passwordHash!;

      await context.test(
        'reset replaces only an existing password, consumes token, revokes sessions and audits without secret projections',
        async () => {
          const user = await linkedAccount(),
            a = await signIn(user.email),
            b = await signIn(user.email),
            raw = await issue(user.email);
          const token = await PasswordResetToken.findOne({
            tokenHash: resetDigest(raw),
          }).select('+tokenHash');
          assert(token);
          assert.equal(+token.expiresAt - +clock, 1800000);
          assert.equal(
            (await PasswordResetToken.findById(token._id))?.tokenHash,
            undefined,
          );
          assert(!JSON.stringify(token).includes(token.tokenHash));
          const before = await Session.find({ userId: user._id }).select(
            '+refreshTokenHash',
          );
          const metadataBefore = await accountMetadata(user._id);
          await service.reset(raw, replacement, 'reset');
          assert.deepEqual(await accountMetadata(user._id), metadataBefore);
          assert(await verifyPassword(replacement, await storedHash(user._id)));
          assert(!(await verifyPassword(original, await storedHash(user._id))));
          assert((await PasswordResetToken.findById(token._id))?.usedAt);
          assert.equal(
            await Session.countDocuments({ userId: user._id, revokedAt: null }),
            0,
          );
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_PASSWORD_RESET',
            }),
            1,
          );
          for (const previous of before) {
            const current = await Session.findById(previous._id).select(
              '+refreshTokenHash',
            );
            assert(current?.revokedAt);
            assert.equal(+current.expiresAt, +previous.expiresAt);
            assert.equal(current.refreshTokenHash, previous.refreshTokenHash);
          }
          for (const old of [a, b])
            await assert.rejects(login.refresh(old.refreshToken, 'revoked'), {
              code: 'AUTH_REFRESH_TOKEN_INVALID',
            });
          await assert.rejects(service.reset(raw, replacement, 'replay'), {
            code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
          });
          assert.equal(confirmations, 1);
        },
      );
      await context.test(
        'same-password reset succeeds, consumes its token, revokes sessions and preserves account metadata',
        async () => {
          const user = await linkedAccount();
          const sessions = [await signIn(user.email), await signIn(user.email)];
          const raw = await issue(user.email);
          const metadataBefore = await accountMetadata(user._id);
          const before = await Session.find({ userId: user._id })
            .select('+refreshTokenHash')
            .lean();
          await service.reset(raw, original, 'same-password-reset');
          assert(await verifyPassword(original, await storedHash(user._id)));
          assert.deepEqual(await accountMetadata(user._id), metadataBefore);
          const consumed = await PasswordResetToken.findOne({
            tokenHash: resetDigest(raw),
          });
          assert(consumed?.usedAt);
          assert.equal(
            await Session.countDocuments({ userId: user._id, revokedAt: null }),
            0,
          );
          for (const previous of before) {
            const current = await Session.findById(previous._id).select(
              '+refreshTokenHash',
            );
            assert(current?.revokedAt);
            assert.equal(+current.expiresAt, +previous.expiresAt);
            assert.equal(current.refreshTokenHash, previous.refreshTokenHash);
          }
          for (const session of sessions)
            await assert.rejects(
              login.refresh(session.refreshToken, 'same-password-revoked'),
              {
                code: 'AUTH_REFRESH_TOKEN_INVALID',
              },
            );
          await assert.rejects(
            service.reset(raw, original, 'same-password-replay'),
            {
              code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
            },
          );
        },
      );
      await context.test(
        'passwordless/ineligible accounts issue no token and reset rechecks eligibility',
        async () => {
          for (const patch of [
            {
              passwordHash: null,
              authProviders: [
                { provider: 'GOOGLE', providerUserId: 'synthetic-google' },
              ],
            },
            { status: 'DISABLED' },
            { status: 'SUSPENDED', suspendedUntil: new Date(0) },
            { status: 'PENDING_VERIFICATION', emailVerifiedAt: null },
            { emailVerifiedAt: null },
          ]) {
            const user = await account(patch),
              count = delivered.length;
            await service.forgot(user.email, 'ineligible');
            assert.equal(delivered.length, count);
            assert.equal(
              await PasswordResetToken.countDocuments({ userId: user._id }),
              0,
            );
          }
          const count = delivered.length;
          await service.forgot('unknown@example.com', 'unknown');
          assert.equal(delivered.length, count);
          const user = await account(),
            raw = await issue(user.email);
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                passwordHash: null,
                authProviders: [
                  {
                    provider: 'GOOGLE',
                    providerUserId: 'synthetic-after-issuance',
                  },
                ],
              },
            },
          );
          await assert.rejects(
            service.reset(raw, replacement, 'no-first-password'),
            { code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED' },
          );
          assert.equal(await storedHash(user._id), null);
        },
      );
      await context.test(
        'replacement invalidates old token and expiry is enforced while the record exists',
        async () => {
          const user = await account(),
            old = await issue(user.email),
            fresh = await issue(user.email);
          await assert.rejects(service.reset(old, replacement, 'superseded'), {
            code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
          });
          const saved = clock;
          clock = new Date(clock.getTime() + 1800001);
          try {
            assert(
              await PasswordResetToken.exists({
                tokenHash: resetDigest(fresh),
              }),
            );
            await assert.rejects(service.reset(fresh, replacement, 'expired'), {
              code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
            });
            assert(
              await PasswordResetToken.exists({
                tokenHash: resetDigest(fresh),
                usedAt: null,
              }),
            );
            assert(await verifyPassword(original, await storedHash(user._id)));
          } finally {
            clock = saved;
          }
        },
      );
      await context.test(
        'change rejects bad/current passwords, keeps only current session and invalidates reset tokens',
        async () => {
          const user = await linkedAccount(),
            current = await signIn(user.email),
            other = await signIn(user.email),
            raw = await issue(user.email);
          const sid = parseRefreshToken(current.refreshToken).sessionId;
          const before =
            await Session.findById(sid).select('+refreshTokenHash');
          assert(before);
          await assert.rejects(
            service.change(
              String(user._id),
              sid,
              'wrong-password',
              replacement,
              'wrong',
            ),
            { code: 'AUTH_CURRENT_PASSWORD_INVALID' },
          );
          await assert.rejects(
            service.change(String(user._id), sid, original, original, 'reuse'),
            { code: 'AUTH_PASSWORD_POLICY_FAILED' },
          );
          const metadataBefore = await accountMetadata(user._id);
          await service.change(
            String(user._id),
            sid,
            original,
            replacement,
            'change',
          );
          assert.deepEqual(await accountMetadata(user._id), metadataBefore);
          assert(await verifyPassword(replacement, await storedHash(user._id)));
          const after = await Session.findById(sid).select('+refreshTokenHash');
          assert(after);
          assert.equal(after.revokedAt, null);
          assert.equal(+after.expiresAt, +before.expiresAt);
          assert.equal(after.refreshTokenHash, before.refreshTokenHash);
          await assert.rejects(login.refresh(other.refreshToken, 'other'), {
            code: 'AUTH_REFRESH_TOKEN_INVALID',
          });
          await login.refresh(current.refreshToken, 'current');
          await assert.rejects(service.reset(raw, original, 'invalidated'), {
            code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
          });
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_PASSWORD_CHANGED',
              'metadata.revokedSessions': 1,
            }),
            1,
          );
        },
      );
      await context.test(
        'audit failures roll back forgot/reset/change and send no emails',
        async () => {
          for (const operation of ['forgot', 'reset', 'change'] as const) {
            const user = await account(),
              current = await signIn(user.email),
              raw = await issue(user.email);
            const beforeTokens = await PasswordResetToken.find({
              userId: user._id,
            }).lean();
            const beforeUser = await User.findById(user._id)
              .select('+passwordHash')
              .lean();
            const emailCount = delivered.length,
              confirmationCount = confirmations;
            const mocked = context.mock.method(Audit, 'create', async () => {
              throw new Error('synthetic audit failure');
            });
            try {
              await assert.rejects(
                operation === 'forgot'
                  ? service.forgot(user.email, 'rollback')
                  : operation === 'reset'
                    ? service.reset(raw, replacement, 'rollback')
                    : service.change(
                        String(user._id),
                        parseRefreshToken(current.refreshToken).sessionId,
                        original,
                        replacement,
                        'rollback',
                      ),
                { code: 'DEPENDENCY_UNAVAILABLE' },
              );
            } finally {
              mocked.mock.restore();
            }
            assert.deepEqual(
              await User.findById(user._id).select('+passwordHash').lean(),
              beforeUser,
            );
            assert.deepEqual(
              await PasswordResetToken.find({ userId: user._id }).lean(),
              beforeTokens,
            );
            assert.equal(
              await Session.countDocuments({
                userId: user._id,
                revokedAt: null,
              }),
              1,
            );
            assert.equal(delivered.length, emailCount);
            assert.equal(confirmations, confirmationCount);
          }
        },
      );
      await context.test(
        'concurrent reset permits one consumption; concurrent forgot leaves one usable replacement',
        async () => {
          const user = await account(),
            raw = await issue(user.email);
          const results = await Promise.allSettled([
            service.reset(raw, replacement, 'race1'),
            service.reset(raw, replacement, 'race2'),
          ]);
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            1,
          );
          for (const r of results)
            if (r.status === 'rejected')
              assert.equal(
                r.reason.code,
                'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
              );
          const start = delivered.length;
          await Promise.all([
            service.forgot(user.email, 'forgot1'),
            service.forgot(user.email, 'forgot2'),
          ]);
          const outstanding = await PasswordResetToken.find({
            userId: user._id,
            usedAt: null,
          }).select('+tokenHash');
          assert.equal(outstanding.length, 1);
          assert.equal(
            delivered
              .slice(start)
              .filter(
                (item) => resetDigest(item.raw) === outstanding[0]!.tokenHash,
              ).length,
            1,
          );
        },
      );
      await context.test(
        'reset and refresh cannot leave a refreshable old session',
        async () => {
          const user = await account(),
            initial = await signIn(user.email),
            raw = await issue(user.email);
          const [reset, refresh] = await Promise.allSettled([
            service.reset(raw, replacement, 'race-reset'),
            login.refresh(initial.refreshToken, 'race-refresh'),
          ]);
          assert.equal(reset.status, 'fulfilled');
          assert.equal(
            await Session.countDocuments({ userId: user._id, revokedAt: null }),
            0,
          );
          if (refresh.status === 'fulfilled')
            await assert.rejects(
              login.refresh(refresh.value.refreshToken, 'after-reset'),
              { code: 'AUTH_REFRESH_TOKEN_INVALID' },
            );
          else assert.equal(refresh.reason.code, 'AUTH_REFRESH_TOKEN_INVALID');
          context.diagnostic(`reset/refresh: refresh ${refresh.status}`);
        },
      );
      await context.test(
        'change racing reset or forgot admits only serialized token/password outcomes',
        async () => {
          const user = await account(),
            initial = await signIn(user.email),
            raw = await issue(user.email);
          const results = await Promise.allSettled([
            service.change(
              String(user._id),
              parseRefreshToken(initial.refreshToken).sessionId,
              original,
              replacement,
              'race-change',
            ),
            service.reset(raw, 'synthetic-reset-winner', 'race-reset'),
          ]);
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            1,
          );
          for (const r of results)
            if (r.status === 'rejected')
              assert(
                [
                  'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
                  'AUTH_CURRENT_PASSWORD_INVALID',
                  'AUTH_ACCESS_TOKEN_INVALID',
                ].includes(r.reason.code),
              );
          const second = await account(),
            session = await signIn(second.email);
          const offset = delivered.length;
          await Promise.all([
            service.forgot(second.email, 'race-forgot'),
            service.change(
              String(second._id),
              parseRefreshToken(session.refreshToken).sessionId,
              original,
              replacement,
              'race-change',
            ),
          ]);
          assert(
            await verifyPassword(replacement, await storedHash(second._id)),
          );
          const count = await PasswordResetToken.countDocuments({
            userId: second._id,
            usedAt: null,
          });
          assert([0, 1].includes(count));
          assert.equal(delivered.length, offset + 1);
          context.diagnostic(`forgot/change: outstanding tokens ${count}`);
        },
      );
      await context.test(
        'reset rejects newly disabled/suspended users and change never reactivates them',
        async () => {
          for (const status of ['DISABLED', 'SUSPENDED'] as const) {
            const user = await account();
            const initial = await signIn(user.email);
            const raw = await issue(user.email);
            await User.updateOne(
              { _id: user._id },
              { $set: { status, suspendedUntil: new Date(0) } },
            );
            const before = await User.findById(user._id)
              .select('+passwordHash')
              .lean();
            await assert.rejects(
              service.reset(raw, replacement, 'inactive-reset'),
              { code: 'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED' },
            );
            await assert.rejects(
              service.change(
                String(user._id),
                parseRefreshToken(initial.refreshToken).sessionId,
                original,
                replacement,
                'inactive-change',
              ),
              {
                code:
                  status === 'DISABLED'
                    ? 'AUTH_ACCOUNT_DISABLED'
                    : 'AUTH_ACCOUNT_SUSPENDED',
              },
            );
            assert.deepEqual(
              await User.findById(user._id).select('+passwordHash').lean(),
              before,
            );
          }
        },
      );
      await context.test(
        'reset/login and change/refresh preserve password and session invariants',
        async () => {
          const user = await account();
          const raw = await issue(user.email);
          const [reset, concurrentLogin] = await Promise.allSettled([
            service.reset(raw, replacement, 'race-reset-login'),
            signIn(user.email),
          ]);
          assert.equal(reset.status, 'fulfilled');
          assert.equal(
            await Session.countDocuments({ userId: user._id, revokedAt: null }),
            0,
          );
          if (concurrentLogin.status === 'rejected')
            assert.equal(
              concurrentLogin.reason.code,
              'AUTH_INVALID_CREDENTIALS',
            );
          else
            await assert.rejects(
              login.refresh(
                concurrentLogin.value.refreshToken,
                'pre-reset-login-revoked',
              ),
              { code: 'AUTH_REFRESH_TOKEN_INVALID' },
            );
          const second = await account();
          const current = await signIn(second.email);
          const other = await signIn(second.email);
          const [changed, refreshed] = await Promise.allSettled([
            service.change(
              String(second._id),
              parseRefreshToken(current.refreshToken).sessionId,
              original,
              replacement,
              'race-change-refresh',
            ),
            login.refresh(other.refreshToken, 'race-other-refresh'),
          ]);
          assert.equal(changed.status, 'fulfilled');
          assert(
            await verifyPassword(replacement, await storedHash(second._id)),
          );
          assert.equal(
            await Session.countDocuments({
              userId: second._id,
              revokedAt: null,
            }),
            1,
          );
          if (refreshed.status === 'fulfilled')
            await assert.rejects(
              login.refresh(refreshed.value.refreshToken, 'other-revoked'),
              { code: 'AUTH_REFRESH_TOKEN_INVALID' },
            );
          else
            assert.equal(refreshed.reason.code, 'AUTH_REFRESH_TOKEN_INVALID');
          context.diagnostic(
            `reset/login: login ${concurrentLogin.status}; change/other-refresh: refresh ${refreshed.status}`,
          );
        },
      );
      await context.test(
        'declared reset digest uniqueness is enforced and invalid current sessions cannot change passwords',
        async () => {
          const user = await account(),
            initial = await signIn(user.email),
            raw = await issue(user.email);
          const token = await PasswordResetToken.findOne({
            tokenHash: resetDigest(raw),
          }).select('+tokenHash');
          assert(token);
          await assert.rejects(
            PasswordResetToken.create({
              userId: user._id,
              tokenHash: token.tokenHash,
              expiresAt: token.expiresAt,
            }),
            { code: 11000 },
          );
          const sid = parseRefreshToken(initial.refreshToken).sessionId;
          await Session.updateOne({ _id: sid }, { $set: { revokedAt: clock } });
          await assert.rejects(
            service.change(
              String(user._id),
              sid,
              original,
              replacement,
              'revoked',
            ),
            { code: 'AUTH_ACCESS_TOKEN_INVALID' },
          );
          assert(await verifyPassword(original, await storedHash(user._id)));
        },
      );
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

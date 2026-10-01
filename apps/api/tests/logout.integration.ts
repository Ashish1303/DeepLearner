// Write-bearing suite: separate owner approval required. Never part of *.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase, mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { createLogoutService } from '../src/modules/auth/logout.service.js';
import { logoutRepository } from '../src/modules/auth/logout.repository.js';
import { createLoginService } from '../src/modules/auth/login.service.js';
import { loginRepository } from '../src/modules/auth/login.repository.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import {
  issueRefreshSecret,
  parseRefreshToken,
} from '../src/modules/auth/refresh-token.service.js';

test(
  'F009 isolated transactional logout and session concurrency',
  { timeout: 90000 },
  async (context) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F009_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F009_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f009-test',
    );
    assert.equal(process.env.F009_TEST_DB, 'deeplearner-f009-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F009_TEST_URI,
        MONGODB_DB_NAME: process.env.F009_TEST_DB,
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
        'f009-test',
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
      const password = 'synthetic-f009-password';
      const passwordHash = await hashPassword(password);
      let clock = new Date();
      const tokens = createAccessTokens(
        {
          ACCESS_TOKEN_SECRET: Buffer.from(
            Array.from({ length: 32 }, (_, i) => i + 1),
          ).toString('base64'),
          ACCESS_TOKEN_ISSUER: 'f009-test',
          ACCESS_TOKEN_AUDIENCE: 'f009-test',
        },
        () => clock,
      );
      const login = createLoginService({
        repository: loginRepository,
        tokens,
        now: () => clock,
        log: { warn() {} },
      });
      const logout = createLogoutService(logoutRepository, () => clock);
      let counter = 0;
      const account = () =>
        User.create({
          email: `synthetic-${++counter}@example.com`,
          firstName: 'Test',
          lastName: 'User',
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: clock,
        });
      const signIn = (email: string) =>
        login.login({ email, password }, 'integration-login');
      const stored = (raw: string) =>
        Session.findById(parseRefreshToken(raw).sessionId).select(
          '+refreshTokenHash',
        );

      await context.test(
        'current logout is audited, preserves digest/expiry and blocks refresh without invalidating access JWT',
        async () => {
          const user = await account();
          const initial = await signIn(user.email);
          const other = await signIn(user.email);
          const before = await stored(initial.refreshToken);
          assert(before);
          await logout.logout(initial.refreshToken, 'logout');
          const after = await stored(initial.refreshToken);
          assert(after?.revokedAt);
          assert.equal(after.revocationReason, 'LOGOUT');
          assert.equal(+after.expiresAt, +before.expiresAt);
          assert.equal(after.refreshTokenHash, before.refreshTokenHash);
          assert.equal((await stored(other.refreshToken))?.revokedAt, null);
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_LOGOUT',
            }),
            1,
          );
          await logout.logout(initial.refreshToken, 'repeat');
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_LOGOUT',
            }),
            1,
          );
          await assert.rejects(
            login.refresh(initial.refreshToken, 'revoked-refresh'),
            { code: 'AUTH_REFRESH_TOKEN_INVALID' },
          );
          assert.equal(
            (await tokens.verify(initial.accessToken)).sub,
            String(user._id),
          );
          assert.equal(
            (await Session.findById(before._id))?.refreshTokenHash,
            undefined,
          );
          assert(!JSON.stringify(after).includes(before.refreshTokenHash));
        },
      );
      await context.test(
        'unknown/mismatched cookies are no-ops and refresh-first stale logout preserves rotated session',
        async () => {
          const user = await account();
          const initial = await signIn(user.email);
          const id = parseRefreshToken(initial.refreshToken).sessionId;
          await logout.logout(
            `${id}.${issueRefreshSecret().secret}`,
            'mismatch',
          );
          await logout.logout(
            `${'f'.repeat(24)}.${issueRefreshSecret().secret}`,
            'unknown',
          );
          assert.equal((await stored(initial.refreshToken))?.revokedAt, null);
          const rotated = await login.refresh(
            initial.refreshToken,
            'rotate-first',
          );
          await logout.logout(initial.refreshToken, 'stale-logout');
          assert.equal((await stored(rotated.refreshToken))?.revokedAt, null);
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_LOGOUT',
            }),
            0,
          );
          await login.refresh(rotated.refreshToken, 'replacement-works');
        },
      );
      await context.test(
        'logout-all scopes active sessions and changes only User version, including disabled/suspended users',
        async () => {
          for (const status of ['DISABLED', 'SUSPENDED'] as const) {
            const user = await account();
            const otherUser = await account();
            const first = await signIn(user.email);
            const second = await signIn(user.email);
            const other = await signIn(otherUser.email);
            // Future stored expiry keeps TTL from deleting this application-expired record.
            const excluded = await signIn(user.email);
            await Session.updateOne(
              { _id: parseRefreshToken(excluded.refreshToken).sessionId },
              { $set: { expiresAt: new Date(clock.getTime() + 86400000) } },
            );
            await User.updateOne(
              { _id: user._id },
              {
                $set: {
                  status,
                  suspendedUntil: new Date(clock.getTime() - 1000),
                },
              },
            );
            const before = await User.findById(user._id).lean();
            assert(before);
            const saved = clock;
            clock = new Date(clock.getTime() + 2 * 86400000);
            try {
              assert.equal(await logout.logoutAll(String(user._id), 'all'), 2);
              assert.equal(
                await logout.logoutAll(String(user._id), 'repeat-all'),
                0,
              );
            } finally {
              clock = saved;
            }
            const after = await User.findById(user._id).lean();
            assert(after);
            assert.equal(after.__v, before.__v + 2);
            assert.deepEqual({ ...after, __v: before.__v }, before);
            for (const initial of [first, second]) {
              const current = await stored(initial.refreshToken);
              assert(current?.revokedAt);
              assert.equal(
                current.refreshTokenHash,
                parseRefreshToken(initial.refreshToken).hash,
              );
              assert.equal(+current.expiresAt, +initial.expiresAt);
            }
            assert.equal((await stored(other.refreshToken))?.revokedAt, null);
            assert.equal(
              (await stored(excluded.refreshToken))?.revokedAt,
              null,
            );
            assert.equal(
              await Audit.countDocuments({
                actorId: user._id,
                action: 'AUTH_LOGOUT_ALL',
              }),
              2,
            );
            const audits = await Audit.find({
              actorId: user._id,
              action: 'AUTH_LOGOUT_ALL',
            });
            assert.deepEqual(
              audits.map((entry) => entry.metadata.revokedSessions).sort(),
              [0, 2],
            );
          }
        },
      );
      await context.test(
        'current and all-session revocation roll back on audit failure',
        async () => {
          for (const all of [false, true]) {
            const user = await account();
            const initial = await signIn(user.email);
            const before = await User.findById(user._id).lean();
            const mocked = context.mock.method(Audit, 'create', async () => {
              throw new Error('synthetic audit failure');
            });
            try {
              await assert.rejects(
                all
                  ? logout.logoutAll(String(user._id), 'rollback')
                  : logout.logout(initial.refreshToken, 'rollback'),
                { code: 'DEPENDENCY_UNAVAILABLE' },
              );
            } finally {
              mocked.mock.restore();
            }
            assert.equal((await stored(initial.refreshToken))?.revokedAt, null);
            assert.deepEqual(await User.findById(user._id).lean(), before);
            await login.refresh(initial.refreshToken, 'after-rollback');
          }
        },
      );
      await context.test(
        'concurrent logout and refresh admit only approved serialization outcomes',
        async () => {
          const user = await account();
          const initial = await signIn(user.email);
          const [ended, refreshed] = await Promise.allSettled([
            logout.logout(initial.refreshToken, 'race-logout'),
            login.refresh(initial.refreshToken, 'race-refresh'),
          ]);
          assert.equal(ended.status, 'fulfilled');
          const current = await stored(initial.refreshToken);
          assert(current);
          if (refreshed.status === 'fulfilled') {
            assert.equal(current.revokedAt, null);
            assert.equal(
              current.refreshTokenHash,
              parseRefreshToken(refreshed.value.refreshToken).hash,
            );
            assert.equal(
              await Audit.countDocuments({
                actorId: user._id,
                action: 'AUTH_LOGOUT',
              }),
              0,
            );
          } else {
            assert.equal(refreshed.reason.code, 'AUTH_REFRESH_TOKEN_INVALID');
            assert(current.revokedAt);
            assert.equal(
              await Audit.countDocuments({
                actorId: user._id,
                action: 'AUTH_LOGOUT',
              }),
              1,
            );
          }
          context.diagnostic(
            `current logout/refresh: refresh ${refreshed.status}`,
          );
        },
      );
      await context.test(
        'logout-all versus refresh leaves session revoked in either ordering',
        async () => {
          const user = await account();
          const initial = await signIn(user.email);
          const [ended, refreshed] = await Promise.allSettled([
            logout.logoutAll(String(user._id), 'race-all'),
            login.refresh(initial.refreshToken, 'race-all-refresh'),
          ]);
          assert.equal(ended.status, 'fulfilled');
          if (ended.status === 'fulfilled') assert.equal(ended.value, 1);
          assert((await stored(initial.refreshToken))?.revokedAt);
          if (refreshed.status === 'fulfilled')
            await assert.rejects(
              login.refresh(
                refreshed.value.refreshToken,
                'replacement-revoked',
              ),
              { code: 'AUTH_REFRESH_TOKEN_INVALID' },
            );
          else
            assert.equal(refreshed.reason.code, 'AUTH_REFRESH_TOKEN_INVALID');
          context.diagnostic(`logout-all/refresh: refresh ${refreshed.status}`);
        },
      );
      await context.test(
        'logout-all versus login serializes count and final session state',
        async () => {
          const user = await account();
          const old = await signIn(user.email);
          const [count, fresh] = await Promise.all([
            logout.logoutAll(String(user._id), 'race-all-login'),
            signIn(user.email),
          ]);
          assert((await stored(old.refreshToken))?.revokedAt);
          const current = await stored(fresh.refreshToken);
          assert(current);
          assert.equal(count, current.revokedAt ? 2 : 1);
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_LOGOUT_ALL',
              'metadata.revokedSessions': count,
            }),
            1,
          );
          context.diagnostic(`logout-all/login: revoked count ${count}`);
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

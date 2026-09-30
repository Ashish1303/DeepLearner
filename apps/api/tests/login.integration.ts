// Write-bearing integration suite. NEVER part of tests/*.test.ts.
// Requires separate owner approval of the exact disposable replica-set procedure.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase, mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { loginRepository } from '../src/modules/auth/login.repository.js';
import { createLoginService } from '../src/modules/auth/login.service.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import { parseRefreshToken } from '../src/modules/auth/refresh-token.service.js';

test(
  'F008 isolated session transactions and strict refresh concurrency',
  { timeout: 90000 },
  async (context) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F008_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F008_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f008-test',
    );
    assert.equal(process.env.F008_TEST_DB, 'deeplearner-f008-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F008_TEST_URI,
        MONGODB_DB_NAME: process.env.F008_TEST_DB,
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
        'f008-test',
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
      const password = 'synthetic-f008-password';
      const passwordHash = await hashPassword(password);
      let clock = new Date();
      const tokens = createAccessTokens(
        {
          ACCESS_TOKEN_SECRET: Buffer.from(
            Array.from({ length: 32 }, (_, i) => i + 1),
          ).toString('base64'),
          ACCESS_TOKEN_ISSUER: 'f008-test',
          ACCESS_TOKEN_AUDIENCE: 'f008-test',
        },
        () => clock,
      );
      const service = createLoginService({
        repository: loginRepository,
        tokens,
        now: () => clock,
        log: { warn() {} },
      });
      let counter = 0;
      const account = async (patch: Record<string, unknown> = {}) =>
        User.create({
          email: `synthetic-${++counter}@example.com`,
          firstName: 'Test',
          lastName: 'User',
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: clock,
          ...patch,
        });
      const user = await account();
      const login = () =>
        service.login({ email: user.email, password }, 'integration-login');
      await context.test(
        'login is audited, session digest hidden, independent devices, fixed rotation expiry',
        async () => {
          const first = await login();
          const second = await login();
          assert.notEqual(first.refreshToken, second.refreshToken);
          const parsed = parseRefreshToken(first.refreshToken);
          const stored = await Session.findById(parsed.sessionId).select(
            '+refreshTokenHash',
          );
          assert(stored);
          assert.equal(stored.refreshTokenHash, parsed.hash);
          assert.equal(+stored.expiresAt - +clock, 30 * 86400000);
          assert.equal(
            (await Session.findById(parsed.sessionId))?.refreshTokenHash,
            undefined,
          );
          assert.equal(
            (await User.findById(user._id))?.passwordHash,
            undefined,
          );
          assert(!JSON.stringify(stored).includes(parsed.hash));
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_LOGIN_SUCCESS',
            }),
            2,
          );
          clock = new Date(+clock + 60000);
          const rotated = await service.refresh(
            first.refreshToken,
            'integration-refresh',
          );
          assert.equal(+rotated.expiresAt, +first.expiresAt);
          assert.notEqual(rotated.refreshToken, first.refreshToken);
          await assert.rejects(
            service.refresh(first.refreshToken, 'integration-reuse'),
            { code: 'AUTH_REFRESH_TOKEN_REUSED' },
          );
          await assert.rejects(
            service.refresh(rotated.refreshToken, 'integration-revoked'),
            { code: 'AUTH_REFRESH_TOKEN_INVALID' },
          );
          assert.equal(
            (await Session.findById(parsed.sessionId))?.revocationReason,
            'REFRESH_TOKEN_REUSE',
          );
          assert.equal(
            await Audit.countDocuments({
              'metadata.sessionId': stored._id,
              action: 'AUTH_REFRESH_REUSE_DETECTED',
            }),
            1,
          );
          await service.refresh(
            second.refreshToken,
            'integration-other-device',
          );
        },
      );
      await context.test(
        'concurrent refresh has one success then committed reuse revocation',
        async () => {
          const initial = await login();
          const outcomes = await Promise.allSettled([
            service.refresh(initial.refreshToken, 'race-one'),
            service.refresh(initial.refreshToken, 'race-two'),
          ]);
          const success = outcomes.filter(
            (result) => result.status === 'fulfilled',
          );
          const failure = outcomes.filter(
            (result) => result.status === 'rejected',
          );
          assert.equal(success.length, 1);
          assert.equal(failure.length, 1);
          assert.equal(failure[0]!.reason.code, 'AUTH_REFRESH_TOKEN_REUSED');
          const parsed = parseRefreshToken(initial.refreshToken);
          const stored = await Session.findById(parsed.sessionId);
          assert(stored?.revokedAt);
          assert.equal(
            await Audit.countDocuments({
              'metadata.sessionId': stored._id,
              action: 'AUTH_REFRESH_SUCCESS',
            }),
            1,
          );
          assert.equal(
            await Audit.countDocuments({
              'metadata.sessionId': stored._id,
              action: 'AUTH_REFRESH_REUSE_DETECTED',
            }),
            1,
          );
          await assert.rejects(
            service.refresh(success[0]!.value.refreshToken, 'race-replacement'),
            { code: 'AUTH_REFRESH_TOKEN_INVALID' },
          );
        },
      );
      await context.test(
        'expired record remains present when application rejects it',
        async () => {
          const initial = await login();
          clock = new Date(+initial.expiresAt);
          const id = parseRefreshToken(initial.refreshToken).sessionId;
          // Clock-only expiry keeps the real MongoDB TTL monitor from deleting the fixture.
          assert(await Session.exists({ _id: id }));
          await assert.rejects(
            service.refresh(initial.refreshToken, 'expired'),
            { code: 'AUTH_REFRESH_TOKEN_EXPIRED' },
          );
          assert(await Session.exists({ _id: id }));
          clock = new Date();
        },
      );
      await context.test(
        'disabled never reactivates; only verified expired suspension does; revoked sessions remain revoked',
        async () => {
          for (const status of ['DISABLED', 'SUSPENDED'] as const) {
            const subject = await account({
              status,
              suspendedUntil: new Date(0),
            });
            if (status === 'DISABLED') {
              await assert.rejects(
                service.login({ email: subject.email, password }, 'disabled'),
                { code: 'AUTH_ACCOUNT_DISABLED' },
              );
              assert.equal(
                (await User.findById(subject._id))?.status,
                'DISABLED',
              );
            } else {
              await service.login(
                { email: subject.email, password },
                'expired-suspension',
              );
              assert.equal(
                (await User.findById(subject._id))?.status,
                'ACTIVE',
              );
              assert.equal(
                (await User.findById(subject._id))?.suspendedUntil?.getTime(),
                0,
              );
            }
          }
          const initial = await login();
          const id = parseRefreshToken(initial.refreshToken).sessionId;
          await Session.updateOne({ _id: id }, { $set: { revokedAt: clock } });
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'SUSPENDED', suspendedUntil: new Date(0) } },
          );
          await assert.rejects(
            service.refresh(initial.refreshToken, 'revoked-suspension'),
            { code: 'AUTH_REFRESH_TOKEN_INVALID' },
          );
          assert.equal((await User.findById(user._id))?.status, 'SUSPENDED');
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'ACTIVE' } },
          );
          const activeSession = await login();
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'DISABLED', suspendedUntil: new Date(0) } },
          );
          await assert.rejects(
            service.refresh(activeSession.refreshToken, 'disabled-refresh'),
            { code: 'AUTH_ACCOUNT_DISABLED' },
          );
          assert.equal((await User.findById(user._id))?.status, 'DISABLED');
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'SUSPENDED', suspendedUntil: new Date(0) } },
          );
          await service.refresh(
            activeSession.refreshToken,
            'expired-suspension-refresh',
          );
          assert.equal((await User.findById(user._id))?.status, 'ACTIVE');
          assert.equal(
            await Audit.countDocuments({
              actorId: user._id,
              action: 'AUTH_REFRESH_SUCCESS',
              'metadata.reactivatedFromExpiredSuspension': true,
            }),
            1,
          );
          const snapshot = await loginRepository.find(user.email);
          assert(snapshot);
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'DISABLED' } },
          );
          await assert.rejects(
            loginRepository.login(
              {
                account: snapshot,
                sessionId: new mongoose.Types.ObjectId().toHexString(),
                hash: 'a'.repeat(64),
                expiresAt: new Date(+clock + 10000),
                requestId: 'stale-account',
                userAgent: '',
              },
              tokens.sign,
              () => clock,
            ),
            { code: 'AUTH_ACCOUNT_DISABLED' },
          );
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'ACTIVE' } },
          );
        },
      );
      await context.test(
        'audit failure rolls back login and refresh mutations',
        async () => {
          const before = await Session.countDocuments();
          let mocked = context.mock.method(Audit, 'create', async () => {
            throw new Error('synthetic-audit-failure');
          });
          try {
            await assert.rejects(login(), { code: 'DEPENDENCY_UNAVAILABLE' });
          } finally {
            mocked.mock.restore();
          }
          assert.equal(await Session.countDocuments(), before);
          const initial = await login();
          const parsed = parseRefreshToken(initial.refreshToken);
          mocked = context.mock.method(Audit, 'create', async () => {
            throw new Error('synthetic-audit-failure');
          });
          try {
            await assert.rejects(
              service.refresh(initial.refreshToken, 'audit-rollback'),
              { code: 'DEPENDENCY_UNAVAILABLE' },
            );
          } finally {
            mocked.mock.restore();
          }
          assert.equal(
            (
              await Session.findById(parsed.sessionId).select(
                '+refreshTokenHash',
              )
            )?.refreshTokenHash,
            parsed.hash,
          );
          await service.refresh(initial.refreshToken, 'after-rollback');
        },
      );
      await context.test(
        'declared unique session hash enforced by MongoDB',
        async () => {
          const initial = await login();
          await assert.rejects(
            Session.create({
              userId: user._id,
              refreshTokenHash: parseRefreshToken(initial.refreshToken).hash,
              expiresAt: initial.expiresAt,
            }),
            { code: 11000 },
          );
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

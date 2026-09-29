// Explicit write-bearing suite: NEVER included in tests/*.test.ts.
// Execute only after separate owner approval of local replica-set provisioning,
// this database name, index creation, synthetic writes and collection cleanup.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import { createDatabase, mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { EmailVerificationToken } from '../src/modules/auth/email-verification-token.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { registrationRepository as repository } from '../src/modules/auth/registration.repository.js';
import { issueVerificationToken } from '../src/modules/auth/verification-token.service.js';

test(
  'F007 isolated replica-set transactions, uniqueness and token lifecycle',
  { timeout: 90000 },
  async (context) => {
    // Exact loopback/port/replica-set and isolated DB; no inherited Atlas URI or .env.
    assert.equal(process.env.APP_ENV, 'LOCAL', 'Explicit LOCAL required');
    assert.equal(
      process.env.F007_TEST_ALLOW_WRITES,
      'APPROVED',
      'Explicit write approval required',
    );
    assert.equal(
      process.env.F007_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f007-test',
      'Isolated local replica set required',
    );
    assert.equal(
      process.env.F007_TEST_DB,
      'deeplearner-f007-test',
      'Isolated test database required',
    );
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F007_TEST_URI,
        MONGODB_DB_NAME: process.env.F007_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    const created: string[] = [];
    let failed = false;
    let cleanupFailed = false;
    const invalidTokenError = (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 400 &&
      error.code === 'AUTH_VERIFICATION_TOKEN_INVALID_OR_EXPIRED';
    try {
      await database.connect();
      const db = mongoose.connection.db;
      assert.ok(db);
      assert.equal(
        (await db.admin().command({ hello: 1 })).setName,
        'f007-test',
      );
      assert.equal(
        (await db.listCollections().toArray()).length,
        0,
        'Test database must be empty; refusing to touch existing data',
      );
      for (const Model of [User, EmailVerificationToken, Audit]) {
        await db.createCollection(Model.collection.name);
        created.push(Model.collection.name);
        await Model.createIndexes();
      }
      const base = {
        firstName: 'Synthetic',
        lastName: 'Test',
        passwordHash:
          '$argon2id$v=19$m=65536,t=3,p=1$c3ludGhldGljc2FsdA$c3ludGhldGljaGFzaA',
      };
      const token = () => issueVerificationToken(new Date());
      const first = token();
      const duplicates = await Promise.allSettled([
        repository.register(
          { ...base, email: 'duplicate@example.com' },
          first,
          'request',
        ),
        repository.register(
          { ...base, email: 'duplicate@example.com' },
          token(),
          'request',
        ),
      ]);
      assert.equal(
        duplicates.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      const failure = duplicates.find((result) => result.status === 'rejected');
      assert(
        failure?.status === 'rejected' &&
          failure.reason instanceof AppError &&
          failure.reason.code === 'AUTH_EMAIL_ALREADY_EXISTS',
      );
      const ordinary = await User.findOne({ email: 'duplicate@example.com' });
      assert.ok(ordinary);
      assert.equal(ordinary.passwordHash, undefined);
      assert.equal(ordinary.authProviders, undefined);
      assert.equal(
        (await User.findById(ordinary._id).select('+passwordHash'))
          ?.passwordHash,
        base.passwordHash,
      );
      assert.equal(
        (await EmailVerificationToken.findOne({ userId: ordinary._id }))
          ?.tokenHash,
        undefined,
      );

      const verifyToken = token();
      const account = await repository.register(
        { ...base, email: 'verify@example.com' },
        verifyToken,
        'request',
      );
      const verified = await Promise.allSettled([
        repository.verify(verifyToken.hash, 'request', () => new Date()),
        repository.verify(verifyToken.hash, 'request', () => new Date()),
      ]);
      assert.equal(
        verified.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      assert.equal((await User.findById(account.userId))?.status, 'ACTIVE');
      assert.equal(
        await Audit.countDocuments({
          resourceId: account.userId,
          action: 'AUTH_EMAIL_VERIFIED',
        }),
        1,
      );
      await assert.rejects(
        repository.verify(verifyToken.hash, 'request', () => new Date()),
        (e: unknown) =>
          e instanceof AppError &&
          e.code === 'AUTH_VERIFICATION_TOKEN_INVALID_OR_EXPIRED',
      );

      const before = await EmailVerificationToken.countDocuments();
      await assert.rejects(
        repository.register(
          { ...base, email: 'rollback@example.com' },
          token(),
          '!invalid-request-id',
        ),
      );
      assert.equal(
        await User.countDocuments({ email: 'rollback@example.com' }),
        0,
      );
      assert.equal(await EmailVerificationToken.countDocuments(), before);

      const old = token();
      const resendAccount = await repository.register(
        { ...base, email: 'resend@example.com' },
        old,
        'request',
      );
      const replacements = [token(), token()];
      await Promise.all(
        replacements.map((value) =>
          repository.resend('resend@example.com', value),
        ),
      );
      assert.equal(
        await EmailVerificationToken.countDocuments({
          userId: resendAccount.userId,
          usedAt: null,
        }),
        1,
      );
      await assert.rejects(
        repository.verify(old.hash, 'request', () => new Date()),
        invalidTokenError,
      );
      for (const candidate of replacements) {
        if (
          !(await EmailVerificationToken.exists({ tokenHash: candidate.hash }))
        ) {
          await assert.rejects(
            repository.verify(candidate.hash, 'request', () => new Date()),
            invalidTokenError,
          );
        }
      }
      assert.equal(
        (await User.findById(resendAccount.userId))?.status,
        'PENDING_VERIFICATION',
      );

      const racing = token();
      const racingAccount = await repository.register(
        { ...base, email: 'race@example.com' },
        racing,
        'request',
      );
      const replacement = token();
      const [verificationResult, resendResult] = await Promise.allSettled([
        repository.verify(racing.hash, 'request', () => new Date()),
        repository.resend('race@example.com', replacement),
      ]);
      const state = await User.findById(racingAccount.userId);
      assert.ok(state);
      assert.equal(resendResult.status, 'fulfilled');
      assert(resendResult.status === 'fulfilled');
      if (verificationResult.status === 'fulfilled') {
        assert.equal(verificationResult.value, undefined);
        assert.equal(resendResult.value, null);
        assert.equal(state.status, 'ACTIVE');
        assert.ok(state.emailVerifiedAt instanceof Date);
        const consumed = await EmailVerificationToken.findOne({
          tokenHash: racing.hash,
        });
        assert.ok(consumed?.usedAt instanceof Date);
        assert.equal(
          await EmailVerificationToken.countDocuments({
            tokenHash: replacement.hash,
          }),
          0,
        );
        context.diagnostic(
          'RACE: verification=FULFILLED; resend=FULFILLED_NULL; order=VERIFY_FIRST',
        );
      } else {
        assert(invalidTokenError(verificationResult.reason));
        assert.equal(resendResult.value?.userId, racingAccount.userId);
        assert.equal(state.status, 'PENDING_VERIFICATION');
        assert.equal(state.emailVerifiedAt, null);
        assert.equal(
          await EmailVerificationToken.countDocuments({
            tokenHash: racing.hash,
          }),
          0,
        );
        const outstanding = await EmailVerificationToken.findOne({
          tokenHash: replacement.hash,
        });
        assert.ok(outstanding);
        assert.equal(outstanding.usedAt, null);
        assert.equal(String(outstanding._id), resendResult.value?.tokenId);
        context.diagnostic(
          'RACE: verification=AUTH_VERIFICATION_TOKEN_INVALID_OR_EXPIRED; resend=FULFILLED_REPLACEMENT; order=RESEND_FIRST',
        );
      }
      assert.equal(
        await EmailVerificationToken.countDocuments({
          userId: state._id,
          usedAt: null,
        }),
        state.status === 'ACTIVE' ? 0 : 1,
      );
      await assert.rejects(
        repository.verify(racing.hash, 'request', () => new Date()),
        invalidTokenError,
      );
      assert.equal((await User.findById(state._id))?.status, state.status);
      if (state.status === 'PENDING_VERIFICATION') {
        await repository.verify(replacement.hash, 'request', () => new Date());
      }
      await assert.rejects(
        repository.verify(replacement.hash, 'request', () => new Date()),
        invalidTokenError,
      );
      assert.equal((await User.findById(state._id))?.status, 'ACTIVE');
      assert.equal(
        await EmailVerificationToken.countDocuments({
          userId: state._id,
          usedAt: null,
        }),
        0,
      );
      assert.equal(
        await Audit.countDocuments({
          resourceId: state._id,
          action: 'AUTH_EMAIL_VERIFIED',
        }),
        1,
      );
      context.diagnostic(
        'RACE_INVARIANTS: PASS; stale/replayed tokens rejected; one activation audit',
      );

      const expired = token();
      expired.expiresAt = new Date(Date.now() - 1);
      const expiredAccount = await repository.register(
        { ...base, email: 'expired@example.com' },
        expired,
        'request',
      );
      const beforeExpiryCheck = await EmailVerificationToken.findById(
        expiredAccount.tokenId,
      );
      assert.ok(beforeExpiryCheck);
      assert.equal(beforeExpiryCheck.usedAt, null);
      assert(beforeExpiryCheck.expiresAt.getTime() < Date.now());
      await assert.rejects(
        repository.verify(expired.hash, 'request', () => new Date()),
        invalidTokenError,
      );
      // Require the same record after rejection too: TTL cleanup cannot explain it.
      const afterExpiryCheck = await EmailVerificationToken.findById(
        expiredAccount.tokenId,
      );
      assert.ok(afterExpiryCheck);
      assert.equal(afterExpiryCheck.usedAt, null);
      const pending = await User.findById(expiredAccount.userId);
      assert.equal(pending?.status, 'PENDING_VERIFICATION');
      assert.equal(pending.emailVerifiedAt, null);
      assert.equal(
        await Audit.countDocuments({
          resourceId: expiredAccount.userId,
          action: 'AUTH_EMAIL_VERIFIED',
        }),
        0,
      );
      context.diagnostic(
        'EXPIRY: record present before/after; exact error PASS; account pending/unverified; no activation audit',
      );
    } catch {
      // Node's test runner otherwise serializes raw MongoDB exceptions and documents.
      failed = true;
    } finally {
      try {
        for (const name of created.reverse())
          await mongoose.connection.db?.dropCollection(name);
      } catch {
        cleanupFailed = true;
      } finally {
        try {
          await database.disconnect();
        } catch {
          cleanupFailed = true;
        }
      }
    }
    assert.equal(cleanupFailed, false, 'F007 test cleanup failed');
    assert.equal(
      failed,
      false,
      'F007 integration failed; inspect isolated test conditions privately',
    );
  },
);

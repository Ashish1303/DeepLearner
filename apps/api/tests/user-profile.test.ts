import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  profilePatch,
  profileUpdate,
} from '../src/modules/users/user.schema.js';
import { userDto, type ProjectedUser } from '../src/modules/users/user.dto.js';
import { userRepository } from '../src/modules/users/user.repository.js';
import { User } from '../src/modules/users/user.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { mongoose } from '../src/config/database.js';

const id = new Types.ObjectId();
const base: ProjectedUser = {
  _id: id,
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  role: 'STUDENT',
  plan: 'FREE',
  status: 'ACTIVE',
  emailVerified: true,
  hasPassword: false,
  hasGoogle: true,
  createdAt: new Date('2026-10-05T00:00:00Z'),
};

test('profile validation rejects unsafe edits and merges only approved leaf fields', () => {
  for (const value of [
    {},
    { profile: {} },
    { firstName: ' ' },
    { lastName: 'x'.repeat(81) },
    { profile: null },
    { profile: { learningGoals: [null] } },
    { profile: { interestedTechnologyIds: [null] } },
    { profile: { dailyStudyGoalMinutes: 4 } },
    { profile: { dailyStudyGoalMinutes: 241 } },
    { profile: { dailyStudyGoalMinutes: 5.5 } },
    { profile: { experienceLevel: 'OTHER' } },
    { profile: { learningGoals: ['MASTER_TECHNOLOGY', 'MASTER_TECHNOLOGY'] } },
    { profile: { interestedTechnologyIds: ['A'.repeat(24), 'a'.repeat(24)] } },
    {
      profile: {
        interestedTechnologyIds: Array.from({ length: 51 }, () =>
          new Types.ObjectId().toHexString(),
        ),
      },
    },
    { 'profile.experienceLevel': 'BEGINNER' },
    { $set: { role: 'ADMIN' } },
  ])
    assert.equal(profilePatch.safeParse(value).success, false);
  for (const field of [
    'email',
    'role',
    'plan',
    'status',
    'emailVerifiedAt',
    'passwordHash',
    'authProviders',
    'createdAt',
    'updatedAt',
    '__v',
    'id',
    'suspendedUntil',
  ])
    assert.equal(
      profilePatch.safeParse({ firstName: 'Test', [field]: 'forbidden' })
        .success,
      false,
    );
  const input = profilePatch.parse({
    firstName: ' New ',
    profile: {
      learningGoals: [],
      interestedTechnologyIds: ['A'.repeat(24)],
      dailyStudyGoalMinutes: 240,
    },
  });
  assert.deepEqual(profileUpdate(input), {
    firstName: 'New',
    'profile.learningGoals': [],
    'profile.interestedTechnologyIds': ['a'.repeat(24)],
    'profile.dailyStudyGoalMinutes': 240,
  });
  assert(
    profilePatch.safeParse({ profile: { dailyStudyGoalMinutes: 5 } }).success,
  );
});

test('safe profile DTO has stable methods, optional profile and excludes persistence secrets', () => {
  for (const [hasPassword, hasGoogle, expected] of [
    [true, false, ['PASSWORD']],
    [false, true, ['GOOGLE']],
    [true, true, ['PASSWORD', 'GOOGLE']],
  ] as const) {
    const result = userDto({
      ...base,
      hasPassword,
      hasGoogle,
      ...{
        passwordHash: 'PRIVATE_HASH',
        authProviders: [{ providerUserId: 'PRIVATE_SUBJECT' }],
        __v: 42,
        suspendedUntil: new Date(),
      },
    });
    assert.deepEqual(result.authMethods, expected);
    assert.equal(result.profile, null);
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        'id',
        'firstName',
        'lastName',
        'email',
        'emailVerified',
        'role',
        'plan',
        'status',
        'authMethods',
        'profile',
        'createdAt',
      ].sort(),
    );
    assert(!JSON.stringify(result).includes('PRIVATE_'));
  }
  const result = userDto({
    ...base,
    profile: {
      learningGoals: ['MASTER_TECHNOLOGY'],
      interestedTechnologyIds: [id],
      dailyStudyGoalMinutes: 30,
    },
  });
  assert.deepEqual(result.profile?.interestedTechnologyIds, [String(id)]);
  assert.equal(result.createdAt, '2026-10-05T00:00:00.000Z');
});

test('profile repository eligibility, explicit projection, transaction writes and cleanup offline', async (context) => {
  let record: ProjectedUser | undefined = base;
  let failAudit = false;
  let failRead = false;
  let ended = 0;
  let started = 0;
  let writes = 0;
  const transaction = {
    async withTransaction(fn: () => Promise<unknown>) {
      return fn();
    },
    async endSession() {
      ended++;
    },
  };
  context.mock.method(mongoose.connection, 'startSession', async () => {
    started++;
    return transaction;
  });
  context.mock.method(
    User,
    'aggregate',
    (
      pipeline: {
        $match?: { _id: Types.ObjectId };
        $project?: Record<string, unknown>;
      }[],
    ) => {
      assert.equal(String(pipeline[0]?.$match?._id), String(id));
      const projection = pipeline[1]?.$project;
      assert(
        projection &&
          !('passwordHash' in projection) &&
          !('authProviders' in projection),
      );
      assert(projection.hasPassword && projection.hasGoogle);
      return {
        session(value: unknown) {
          assert.equal(value, transaction);
          return this;
        },
        async exec() {
          if (failRead) throw new Error('PRIVATE_DRIVER');
          return record ? [record] : [];
        },
      };
    },
  );
  context.mock.method(
    User,
    'updateOne',
    async (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options: { session: unknown; runValidators: boolean },
    ) => {
      writes++;
      assert.deepEqual(filter, {
        _id: id,
        status: 'ACTIVE',
        emailVerifiedAt: { $ne: null },
      });
      assert.deepEqual(update, {
        $set: { 'profile.learningGoals': [] },
        $inc: { __v: 1 },
      });
      assert.equal(options.session, transaction);
      assert.equal(options.runValidators, true);
      return { modifiedCount: 1 };
    },
  );
  context.mock.method(
    Audit,
    'create',
    async (
      values: Record<string, unknown>[],
      options: { session: unknown },
    ) => {
      assert.equal(options.session, transaction);
      assert.deepEqual(values[0], {
        category: 'USER_ADMIN',
        action: 'USER_PROFILE_UPDATED',
        actorId: id,
        resourceId: id,
        resourceType: 'USER',
        requestId: 'request',
        metadata: { changedFields: ['profile.learningGoals'] },
      });
      if (failAudit) throw new Error('PRIVATE_AUDIT');
    },
  );
  assert.equal((await userRepository.get(String(id))).id, String(id));
  assert.equal(started, 0);
  await userRepository.patch(
    String(id),
    { profile: { learningGoals: [] } },
    'request',
  );
  assert.equal(ended, started);
  failAudit = true;
  await assert.rejects(
    userRepository.patch(
      String(id),
      { profile: { learningGoals: [] } },
      'request',
    ),
    { code: 'DEPENDENCY_UNAVAILABLE' },
  );
  assert.equal(ended, started);
  failAudit = false;
  for (const [patch, code] of [
    [{ status: 'DISABLED' }, 'AUTH_ACCOUNT_DISABLED'],
    [{ status: 'SUSPENDED' }, 'AUTH_ACCOUNT_SUSPENDED'],
    [{ status: 'PENDING_VERIFICATION' }, 'AUTH_EMAIL_NOT_VERIFIED'],
    [{ emailVerified: false }, 'AUTH_EMAIL_NOT_VERIFIED'],
  ] as const) {
    record = { ...base, ...patch };
    const before = writes;
    await assert.rejects(userRepository.get(String(id)), { code });
    await assert.rejects(
      userRepository.patch(
        String(id),
        { profile: { learningGoals: [] } },
        'request',
      ),
      { code },
    );
    assert.equal(writes, before);
    assert.equal(ended, started);
  }
  record = undefined;
  await assert.rejects(userRepository.get(String(id)), {
    code: 'USER_NOT_FOUND',
  });
  failRead = true;
  await assert.rejects(userRepository.get(String(id)), (error) => {
    assert(error instanceof Error);
    assert(!error.message.includes('PRIVATE'));
    return 'code' in error && error.code === 'DEPENDENCY_UNAVAILABLE';
  });
  assert.equal(mongoose.connection.readyState, 0);
});

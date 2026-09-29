import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { User, userSchema } from '../src/modules/users/user.model.js';
import { mongoose } from '../src/config/database.js';

const passwordHash =
  '$argon2id$v=19$m=65536,t=3,p=1$c3ludGhldGljc2FsdA$c3ludGhldGljaGFzaA';
const identity = { provider: 'GOOGLE', providerUserId: 'synthetic-subject' };
const fields = {
  email: '  Student@Example.com ',
  firstName: ' Ada ',
  lastName: ' Lovelace ',
  passwordHash,
};

test('Argon2id accepts both supported parameter orders and rejects malformed hashes', async () => {
  for (const value of [
    passwordHash,
    passwordHash.replace('t=3,p=1', 'p=1,t=3'),
  ]) {
    const user = new User({ ...fields, passwordHash: value });
    await user.validate();
    assert.equal(user.passwordHash, value);
  }
  for (const value of [
    passwordHash.replace('argon2id', 'argon2i'),
    passwordHash.replace('v=19', 'v=16'),
    passwordHash.replace('m=65536', 'm=0'),
    passwordHash.replace('t=3', 't=0'),
    passwordHash.replace('p=1', 'p=-1'),
    passwordHash.replace('t=3,p=1', 'p=1,t=0'),
    passwordHash.replace('t=3,p=1', 't=3,t=1'),
    passwordHash.replace(',p=1', ''),
    passwordHash.replace('p=1', 'p=1,x=2'),
    passwordHash.replace('c3ludGhldGljc2FsdA', ''),
    passwordHash.replace('c3ludGhldGljaGFzaA', ''),
    `${passwordHash}!`,
  ])
    await assert.rejects(
      new User({ ...fields, passwordHash: value }).validate(),
    );
});

test('user normalization, defaults, optional profile and derived name', async () => {
  const user = new User(fields);
  await user.validate();
  assert.equal(user.email, 'student@example.com');
  assert.equal(user.get('displayName'), 'Ada Lovelace');
  assert.equal(user.role, 'STUDENT');
  assert.equal(user.plan, 'FREE');
  assert.equal(user.status, 'PENDING_VERIFICATION');
  assert.equal(user.profile, undefined);
  assert.equal(user.emailVerifiedAt, null);
  assert.equal(user.suspendedUntil, null);
  assert.ok(userSchema.path('createdAt'));
  assert.ok(userSchema.path('updatedAt'));
});

test('password-only, Google-only and linked accounts; capability required', async () => {
  await new User(fields).validate();
  await new User({
    ...fields,
    passwordHash: null,
    authProviders: [identity],
  }).validate();
  await new User({ ...fields, authProviders: [identity] }).validate();
  await assert.rejects(new User({ ...fields, passwordHash: null }).validate());
  await assert.rejects(
    new User({ ...fields, authProviders: [identity, identity] }).validate(),
  );
  await assert.rejects(() =>
    new User({
      ...fields,
      authProviders: [{ ...identity, accessToken: 'not-allowed' }],
    }).validate(),
  );
});

test('user invalid required fields, enums and password representation fail', async () => {
  for (const patch of [
    { email: 'invalid' },
    { email: '' },
    { firstName: ' ' },
    { lastName: 'x'.repeat(81) },
    { role: 'OWNER' },
    { plan: 'TRIAL' },
    { status: 'PENDING' },
    { passwordHash: 'plaintext' },
    { authProviders: [{ provider: 'OTHER', providerUserId: 'subject' }] },
    { authProviders: [{ provider: 'GOOGLE', providerUserId: ' ' }] },
    { emailVerifiedAt: 'invalid-date' },
  ])
    await assert.rejects(new User({ ...fields, ...patch }).validate());
  for (const status of [
    'PENDING_VERIFICATION',
    'ACTIVE',
    'DISABLED',
    'SUSPENDED',
  ]) {
    await new User({
      ...fields,
      status,
      role: 'ADMIN',
      plan: 'PREMIUM',
    }).validate();
  }
});

test('profile enforces goal bounds, enums and unique technologies/goals', async () => {
  const id = new Types.ObjectId();
  for (const minutes of [5, 240]) {
    await new User({
      ...fields,
      profile: {
        dailyStudyGoalMinutes: minutes,
        interestedTechnologyIds: [id],
        learningGoals: ['LEARN_FROM_SCRATCH'],
      },
    }).validate();
  }
  for (const profile of [
    { dailyStudyGoalMinutes: 4 },
    { dailyStudyGoalMinutes: 241 },
    { dailyStudyGoalMinutes: 5.5 },
    { interestedTechnologyIds: [id, id.toHexString()] },
    { interestedTechnologyIds: ['invalid'] },
    {
      interestedTechnologyIds: Array.from(
        { length: 51 },
        () => new Types.ObjectId(),
      ),
    },
    { learningGoals: ['QUICK_REVISION', 'QUICK_REVISION'] },
    { learningGoals: ['UNKNOWN'] },
    { experienceLevel: 'EXPERT' },
    { preferredDifficulty: 'EXPERT' },
  ])
    await assert.rejects(new User({ ...fields, profile }).validate());
});

test('profile technology arrays reject null and malformed elements', async () => {
  const id = new Types.ObjectId();
  for (const values of [[null], [id, null], [undefined], ['invalid'], [{}]]) {
    await assert.rejects(
      new User({
        ...fields,
        profile: { interestedTechnologyIds: values },
      }).validate(),
      /interestedTechnologyIds/,
    );
  }
});

test('profile learning goal arrays reject null and malformed elements', async () => {
  for (const values of [
    [null],
    ['QUICK_REVISION', null],
    [undefined],
    ['UNKNOWN'],
    [''],
    [{}],
  ]) {
    await assert.rejects(
      new User({ ...fields, profile: { learningGoals: values } }).validate(),
      /learningGoals/,
    );
  }
});

test('optional profiles, empty arrays and valid profile arrays remain supported', async () => {
  const user = new User(fields);
  await user.validate();
  assert.equal(user.profile, undefined);
  const emptyProfile = new User({ ...fields, profile: {} });
  await emptyProfile.validate();
  assert.ok(emptyProfile.profile);
  assert.deepEqual(Array.from(emptyProfile.profile.learningGoals), []);
  assert.deepEqual(
    Array.from(emptyProfile.profile.interestedTechnologyIds),
    [],
  );
  for (const profile of [
    { learningGoals: [], interestedTechnologyIds: [] },
    {
      learningGoals: ['LEARN_FROM_SCRATCH', 'QUICK_REVISION'],
      interestedTechnologyIds: [
        new Types.ObjectId(),
        new Types.ObjectId().toHexString(),
      ],
    },
  ])
    await new User({ ...fields, profile }).validate();
});

test('user sensitive selections and serialization exclude explicitly loaded credentials', () => {
  const user = new User({ ...fields, authProviders: [identity] });
  assert.equal(userSchema.path('passwordHash').options.select, false);
  assert.equal(userSchema.path('authProviders').options.select, false);
  for (const value of [
    user.toObject(),
    user.toJSON(),
    JSON.parse(JSON.stringify(user)),
  ]) {
    assert.equal('passwordHash' in value, false);
    assert.equal('authProviders' in value, false);
    assert.equal(value.email, 'student@example.com');
  }
});

test('projected users validate unrelated changes but fail closed on credential changes', async () => {
  const user = User.hydrate(
    {
      _id: new Types.ObjectId(),
      email: 'student@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    { passwordHash: 0, authProviders: 0 },
  );
  user.firstName = 'Grace';
  await user.validate();
  user.passwordHash = passwordHash;
  await assert.rejects(
    user.validate(),
    /Load both authentication capabilities/,
  );
});

test('user declares approved indexes on the disconnected F005 instance', () => {
  assert.equal(User.db, mongoose.connection);
  assert.equal(User.db.readyState, 0);
  assert.equal(userSchema.options.autoCreate, false);
  assert.equal(userSchema.options.autoIndex, false);
  assert.equal(userSchema.options.bufferCommands, false);
  assert.equal(User.collection.name, 'users');
  assert.deepEqual(userSchema.indexes(), [
    [{ email: 1 }, { unique: true }],
    [{ status: 1, createdAt: -1 }, {}],
    [{ plan: 1, createdAt: -1 }, {}],
    [{ role: 1, createdAt: -1 }, {}],
    [
      { 'authProviders.provider': 1, 'authProviders.providerUserId': 1 },
      {
        unique: true,
        partialFilterExpression: {
          'authProviders.providerUserId': { $type: 'string' },
        },
      },
    ],
  ]);
});

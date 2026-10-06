// Separately gated synthetic writes; excluded from the offline *.test.ts suite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase, mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import { userRepository } from '../src/modules/users/user.repository.js';

test(
  'F012 isolated self-profile projection, edits and audit transactions',
  { timeout: 90000 },
  async (context) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F012_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F012_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f012-test',
    );
    assert.equal(process.env.F012_TEST_DB, 'deeplearner-f012-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F012_TEST_URI,
        MONGODB_DB_NAME: process.env.F012_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    const diagnostic = process.env.F012_DIAGNOSTIC === 'APPROVED';
    const target =
      'leaf patches create optional profile, replace arrays and preserve unrelated data and other users';
    let check = 'PROFILE_CREATED';
    let stage = 'setup';
    const scenario = (name: string, fn: () => Promise<void>) =>
      context.test(name, { skip: diagnostic && name !== target }, async () => {
        try {
          await fn();
        } catch (error) {
          if (diagnostic) {
            const location =
              error instanceof Error
                ? error.stack?.match(
                    /user-profile\.integration\.ts:(\d+):(\d+)/,
                  )
                : undefined;
            const labels = [
              'PROFILE_CREATED',
              'LEAF_MERGE',
              'ARRAY_CLEARED',
              'USER_FIELDS_PRESERVED',
              'OTHER_USER_UNCHANGED',
              'AUDIT_METADATA',
              'RESPONSE_DTO',
            ];
            console.log(
              'F012_DIAGNOSTIC=' +
                JSON.stringify({
                  check: labels.includes(check) ? check : 'OTHER',
                  stage: ['setup', 'profile-update', 'verification'].includes(
                    stage,
                  )
                    ? stage
                    : 'OTHER',
                  line: location ? Number(location[1]) : null,
                  column: location ? Number(location[2]) : null,
                }),
            );
          }
          throw error;
        }
      });
    const owned: string[] = [];
    const sessions: Awaited<
      ReturnType<typeof mongoose.connection.startSession>
    >[] = [];
    const original = mongoose.connection.startSession;
    context.mock.method(
      mongoose.connection,
      'startSession',
      async (...args: Parameters<typeof original>) => {
        const session = await Reflect.apply(
          original,
          mongoose.connection,
          args,
        );
        sessions.push(session);
        return session;
      },
    );
    let sequence = 0;
    const create = (patch: Record<string, unknown> = {}) =>
      User.create({
        email: `synthetic-${++sequence}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        authProviders: [
          { provider: 'GOOGLE', providerUserId: `synthetic-${sequence}` },
        ],
        ...patch,
      });
    const snapshot = (id: unknown) =>
      User.findById(id).select('+passwordHash +authProviders').lean();
    const invariant = (value: Record<string, unknown>) => {
      const result = { ...value };
      for (const key of [
        'firstName',
        'lastName',
        'profile',
        '__v',
        'updatedAt',
      ])
        delete result[key];
      return result;
    };
    try {
      await database.connect();
      const db = mongoose.connection.db;
      assert(db);
      assert.equal(
        (await db.admin().command({ hello: 1 })).setName,
        'f012-test',
      );
      assert.equal(
        (await db.listCollections().toArray()).length,
        0,
        'Refusing nonempty database',
      );
      for (const model of [User, Audit]) {
        await db.createCollection(model.collection.name);
        owned.push(model.collection.name);
        await model.createIndexes();
      }
      await scenario(
        'actual projection derives methods without leaking credentials and preserves absent profile',
        async () => {
          const syntheticHash = '$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA';
          for (const [patch, methods] of [
            [{}, ['GOOGLE']],
            [{ passwordHash: syntheticHash, authProviders: [] }, ['PASSWORD']],
            [{ passwordHash: syntheticHash }, ['PASSWORD', 'GOOGLE']],
          ] as const) {
            const user = await create(patch);
            const dto = await userRepository.get(String(user._id));
            assert.deepEqual(dto.authMethods, methods);
            assert.equal(dto.profile, null);
            assert(!JSON.stringify(dto).includes(syntheticHash));
            assert(!JSON.stringify(dto).includes('providerUserId'));
            assert(!('__v' in dto));
          }
        },
      );
      await scenario(
        'leaf patches create optional profile, replace arrays and preserve unrelated data and other users',
        async () => {
          const user = await create({ role: 'ADMIN', plan: 'PREMIUM' });
          const other = await create();
          const before = await snapshot(user._id);
          const otherBefore = await snapshot(other._id);
          assert(before);
          stage = 'profile-update';
          await userRepository.patch(
            String(user._id),
            {
              profile: {
                learningGoals: ['MASTER_TECHNOLOGY'],
                dailyStudyGoalMinutes: 45,
              },
            },
            'create-profile',
          );
          const result = await userRepository.patch(
            String(user._id),
            { firstName: 'Changed', profile: { learningGoals: [] } },
            'clear-goals',
          );
          stage = 'verification';
          check = 'LEAF_MERGE';
          assert.equal(result.profile?.dailyStudyGoalMinutes, 45);
          check = 'ARRAY_CLEARED';
          assert.deepEqual(result.profile?.learningGoals, []);
          const after = await snapshot(user._id);
          check = 'USER_FIELDS_PRESERVED';
          assert(after);
          assert.deepEqual(invariant(after), invariant(before));
          check = 'OTHER_USER_UNCHANGED';
          assert.deepEqual(await snapshot(other._id), otherBefore);
          const audits = await Audit.find({ actorId: user._id }).lean();
          check = 'AUDIT_METADATA';
          assert.equal(audits.length, 2);
          const createdAudit = audits.find(
            (audit) => audit.requestId === 'create-profile',
          );
          const clearedAudit = audits.find(
            (audit) => audit.requestId === 'clear-goals',
          );
          assert(createdAudit);
          assert(clearedAudit);
          assert.deepEqual(createdAudit.metadata.changedFields, [
            'profile.dailyStudyGoalMinutes',
            'profile.learningGoals',
          ]);
          assert.deepEqual(clearedAudit.metadata.changedFields, [
            'firstName',
            'profile.learningGoals',
          ]);
          check = 'RESPONSE_DTO';
          assert(!JSON.stringify(audits).includes('Changed'));
          assert(!JSON.stringify(audits).includes(user.email));
        },
      );
      await scenario(
        'current account status and verification block reads and updates without reactivation',
        async () => {
          for (const [patch, code] of [
            [{ status: 'DISABLED' }, 'AUTH_ACCOUNT_DISABLED'],
            [
              { status: 'SUSPENDED', suspendedUntil: new Date(0) },
              'AUTH_ACCOUNT_SUSPENDED',
            ],
            [{ status: 'PENDING_VERIFICATION' }, 'AUTH_EMAIL_NOT_VERIFIED'],
            [{ emailVerifiedAt: null }, 'AUTH_EMAIL_NOT_VERIFIED'],
          ] as const) {
            const user = await create(patch);
            const before = await snapshot(user._id);
            await assert.rejects(userRepository.get(String(user._id)), {
              code,
            });
            await assert.rejects(
              userRepository.patch(
                String(user._id),
                { firstName: 'Blocked' },
                'blocked',
              ),
              { code },
            );
            assert.deepEqual(await snapshot(user._id), before);
            assert.equal(await Audit.countDocuments({ actorId: user._id }), 0);
          }
        },
      );
      await scenario(
        'audit failure rolls back profile, timestamp and version; session ends',
        async () => {
          const user = await create();
          const before = await snapshot(user._id);
          const mock = context.mock.method(Audit, 'create', async () => {
            throw new Error('synthetic failure');
          });
          try {
            await assert.rejects(
              userRepository.patch(
                String(user._id),
                { firstName: 'Rollback' },
                'rollback',
              ),
              { code: 'DEPENDENCY_UNAVAILABLE' },
            );
          } finally {
            mock.mock.restore();
          }
          assert.deepEqual(await snapshot(user._id), before);
          assert.equal(await Audit.countDocuments({ actorId: user._id }), 0);
          assert(sessions.every((session) => session.hasEnded));
        },
      );
      await scenario(
        'concurrent disjoint edits merge and same-field edits have a committed winner',
        async () => {
          const user = await create();
          const id = String(user._id);
          await Promise.all([
            userRepository.patch(
              id,
              { profile: { dailyStudyGoalMinutes: 90 } },
              'race-goal',
            ),
            userRepository.patch(
              id,
              { profile: { experienceLevel: 'ADVANCED' } },
              'race-level',
            ),
          ]);
          const merged = await userRepository.get(id);
          assert.equal(merged.profile?.dailyStudyGoalMinutes, 90);
          assert.equal(merged.profile?.experienceLevel, 'ADVANCED');
          await Promise.all([
            userRepository.patch(id, { firstName: 'First' }, 'race-first'),
            userRepository.patch(id, { firstName: 'Second' }, 'race-second'),
          ]);
          assert(
            ['First', 'Second'].includes(
              (await userRepository.get(id)).firstName,
            ),
          );
          assert.equal(await Audit.countDocuments({ actorId: user._id }), 4);
        },
      );
      assert(
        sessions.length > 0 && sessions.every((session) => session.hasEnded),
      );
      assert.deepEqual(
        (await db.listCollections().toArray()).map((x) => x.name).sort(),
        ['auditLogs', 'users'],
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

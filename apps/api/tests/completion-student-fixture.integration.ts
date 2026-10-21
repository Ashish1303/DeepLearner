// PREPARED ONLY: the separately approved owned-Job harness must import and call
// runCompletionStudentFixtureIntegration with its live verified initializer.
// No env flag, GO line or fabricated assertion adapter enables this suite.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { z } from 'zod';
import { completionView } from '../src/modules/progress/completion.schema.js';
import {
  practiceDto,
  questionRevision,
} from '../src/modules/practice/practice.dto.js';
import { mongoose } from '../src/config/database.js';
import {
  initializeCompletionStudentFixture,
  fixtureIndexes,
  parseFixtureCredentials,
  type SupervisedFixtureInitialization,
} from '../scripts/completion-student-fixture.js';
export const completionStudentFixtureIndexes = fixtureIndexes;
const access = z.object({ data: z.object({ accessToken: z.string().min(1) }) });
export function runCompletionStudentFixtureIntegration(
  initialization: SupervisedFixtureInitialization,
) {
  return test(
    'F038 Slice 3 real credentials, sessions and sealed origin in guarded disposable fixture',
    { timeout: 120000 },
    async (t) => {
      let studentPassword = '',
        accessToken = '',
        refreshCookie = '';
      let fixture:
        | Awaited<ReturnType<typeof initializeCompletionStudentFixture>>
        | undefined;
      const endpoint = 'http://127.0.0.1:4000/api/v1';
      const stage = async (name: string, body: () => Promise<void>) => {
        let failed = false;
        await t.test(name, async () => {
          try {
            await body();
          } catch (error) {
            failed = true;
            throw error;
          }
        });
        if (failed) throw new Error('COMPLETION_FIXTURE_INTEGRATION_ABORTED');
      };
      const post = (route: string, body: unknown, token = '', cookie = '') =>
        fetch(endpoint + route, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://127.0.0.1:3000',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify(body),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
      try {
        fixture = await initializeCompletionStudentFixture({
          ...initialization,
          async readCredentials() {
            const input = parseFixtureCredentials(
              await initialization.readCredentials(),
            );
            studentPassword = input.student;
            return input;
          },
        });
        const db = mongoose.connection.db!;
        await stage(
          'insert-only distinct Admins, independent approval and genuine audited setup sessions',
          async () => {
            const admins = await db
              .collection('users')
              .find(
                { role: 'ADMIN' },
                {
                  projection: {
                    _id: 1,
                    status: 1,
                    emailVerifiedAt: 1,
                    passwordHash: 1,
                  },
                  timeoutMS: 5000,
                },
              )
              .toArray();
            assert.equal(admins.length, 2);
            assert.notEqual(String(admins[0]!._id), String(admins[1]!._id));
            for (const admin of admins) {
              assert.equal(admin.status, 'ACTIVE');
              assert(admin.emailVerifiedAt);
              assert.match(admin.passwordHash, /^\$argon2id\$/);
            }
            assert.equal(
              await db.collection('sessions').countDocuments({
                userId: { $in: admins.map((v) => v._id) },
                revokedAt: null,
              }),
              0,
            );
            assert(
              (await db
                .collection('auditLogs')
                .countDocuments({ action: 'AUTH_LOGIN_SUCCESS' })) >= 2,
            );
            assert.equal(
              await db.collection('practiceAttempts').countDocuments({}),
              0,
            );
            assert.equal(
              await db.collection('practiceAssessments').countDocuments({}),
              0,
            );
          },
        );
        await stage(
          'Student uses normal password login and HttpOnly session cookie without direct JWT signing',
          async () => {
            const response = await post('/auth/login', {
              email: fixture!.studentEmail,
              password: studentPassword,
            });
            studentPassword = '';
            assert.equal(response.status, 200);
            const data = access.parse(await response.json());
            accessToken = data.data.accessToken;
            assert.equal(typeof accessToken, 'string');
            const cookie = response.headers.get('set-cookie') ?? '';
            assert.match(cookie, /HttpOnly/i);
            assert.match(cookie, /SameSite=Lax/i);
            refreshCookie = cookie.split(';')[0]!;
            const me = await fetch(endpoint + '/users/me', {
              headers: { Authorization: 'Bearer ' + accessToken },
              signal: AbortSignal.timeout(15000),
            });
            assert.equal(me.status, 200);
            assert.equal(
              z
                .object({ data: z.object({ role: z.literal('STUDENT') }) })
                .parse(await me.json()).data.role,
              'STUDENT',
            );
          },
        );
        await stage(
          'normal refresh rotates session secret while preserving the same sealed Student origin',
          async () => {
            const response = await post('/auth/refresh', {}, '', refreshCookie);
            assert.equal(response.status, 200);
            accessToken = access.parse(await response.json()).data.accessToken;
            const rotated = (response.headers.get('set-cookie') ?? '').split(
              ';',
            )[0]!;
            assert(rotated);
            assert.notEqual(rotated, refreshCookie);
            refreshCookie = rotated;
            const response2 = await fetch(
              endpoint + '/progress/completion?conceptId=' + fixture!.conceptId,
              {
                headers: { Authorization: 'Bearer ' + accessToken },
                signal: AbortSignal.timeout(15000),
              },
            );
            assert.equal(response2.status, 200);
            assert.equal(response2.headers.get('cache-control'), 'no-store');
            const data = z
              .object({ data: completionView })
              .parse(await response2.json()).data;
            assert.equal(data.eligibility, 'INELIGIBLE');
            assert.equal(data.completion.status, 'NOT_COMPLETED');
            assert.equal(data.practice.score, null);
            assert.deepEqual(
              Object.keys(data).sort(),
              [
                'blockers',
                'completion',
                'conceptId',
                'eligibility',
                'practice',
                'requiredSections',
                'sections',
                'viewRevision',
                'visualization',
              ].sort(),
            );
          },
        );
        await stage(
          'authentication, nonadoption and no premature disclosure remain authoritative',
          async () => {
            const anonymous = await fetch(
              endpoint + '/progress/completion?conceptId=' + fixture!.conceptId,
              { signal: AbortSignal.timeout(15000) },
            );
            assert.equal(anonymous.status, 401);
            const before = await db.collection('users').countDocuments({});
            await assert.rejects(
              initializeCompletionStudentFixture(initialization),
              /COMPLETION_FIXTURE_UNAVAILABLE/,
            );
            assert.equal(
              await db.collection('users').countDocuments({}),
              before,
            );
            assert.equal(
              await db.collection('practiceAttempts').countDocuments({}),
              0,
            );
          },
        );
        await stage(
          'genuine Student session onboards, submits first OUTPUT, saves section participation and completes through secure APIs',
          async () => {
            const headers = {
              Authorization: 'Bearer ' + accessToken,
              'Content-Type': 'application/json',
              Origin: 'http://127.0.0.1:3000',
            };
            const profile = await fetch(endpoint + '/users/me', {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                profile: {
                  experienceLevel: 'BEGINNER',
                  learningGoals: ['LEARN_FROM_SCRATCH'],
                  interestedTechnologyIds: [],
                  preferredDifficulty: 'BEGINNER',
                  dailyStudyGoalMinutes: 20,
                },
              }),
              signal: AbortSignal.timeout(15000),
            });
            assert.equal(profile.status, 200);
            const questions = await fetch(
              endpoint +
                '/practice-questions?conceptId=' +
                fixture!.conceptId +
                '&type=OUTPUT&page=1&limit=10',
              { headers, signal: AbortSignal.timeout(15000) },
            );
            assert.equal(questions.status, 200);
            const items = z
              .object({ data: z.array(z.record(z.string(), z.unknown())) })
              .parse(await questions.json()).data;
            assert.equal(items.length, 1);
            const item = items[0]!;
            assert(!('answer' in item));
            assert(!('explanation' in item));
            const dto = practiceDto({ ...item, _id: item.id });
            const unlock = await fetch(
              endpoint + '/practice-questions/' + dto.id + '/unlock',
              {
                method: 'POST',
                headers: { ...headers, 'Idempotency-Key': randomUUID() },
                body: JSON.stringify({
                  conceptId: fixture!.conceptId,
                  studentAnswer: '1',
                  questionRevision: questionRevision(dto),
                }),
                signal: AbortSignal.timeout(15000),
              },
            );
            assert.equal(unlock.status, 200);
            const unlocked = z
              .object({ data: z.record(z.string(), z.unknown()) })
              .parse(await unlock.json()).data;
            assert.deepEqual(Object.keys(unlocked).sort(), [
              'answer',
              'conceptId',
              'explanation',
              'id',
              'type',
            ]);
            assert.equal(
              await db.collection('practiceAttempts').countDocuments({}),
              1,
            );
            assert.equal(
              await db.collection('practiceAssessments').countDocuments({}),
              1,
            );
            const root =
              endpoint + '/progress/completion/' + fixture!.conceptId;
            const command = (action: string, body: unknown) =>
              fetch(root + '/' + action, {
                method: 'POST',
                headers: { ...headers, 'Idempotency-Key': randomUUID() },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(15000),
              });
            for (const section of ['READ', 'VISUALIZE', 'EXAMPLE']) {
              const issued = await command('challenges', { section });
              assert.equal(issued.status, 200);
              const id = z
                .object({
                  data: z.object({
                    challenge: z.object({ id: z.string().length(24) }),
                  }),
                })
                .parse(await issued.json()).data.challenge.id;
              assert.equal(
                (
                  await command(
                    'responses',
                    section === 'VISUALIZE'
                      ? { challengeId: id, selectedChoiceId: 'value' }
                      : { challengeId: id, acknowledged: true },
                  )
                ).status,
                200,
              );
            }
            const get = () =>
              fetch(
                endpoint +
                  '/progress/completion?conceptId=' +
                  fixture!.conceptId,
                { headers, signal: AbortSignal.timeout(15000) },
              );
            const eligible = z
              .object({ data: completionView })
              .parse(await (await get()).json()).data;
            assert.equal(eligible.eligibility, 'ELIGIBLE');
            assert.equal(eligible.practice.score, 100);
            const completed = await command('complete', {
              viewRevision: eligible.viewRevision,
            });
            assert.equal(completed.status, 200);
            assert.equal(
              z.object({ data: completionView }).parse(await completed.json())
                .data.completion.status,
              'COMPLETED',
            );
            assert.equal(
              z
                .object({ data: completionView })
                .parse(await (await get()).json()).data.completion.status,
              'COMPLETED',
            );
            const activity = await fetch(
              endpoint + '/progress?conceptId=' + fixture!.conceptId,
              { headers, signal: AbortSignal.timeout(15000) },
            );
            const progress = z
              .object({ data: z.record(z.string(), z.unknown()) })
              .parse(await activity.json()).data;
            assert.deepEqual(Object.keys(progress).sort(), [
              'attemptCount',
              'conceptId',
              'lastActivityAt',
              'startedAt',
              'status',
            ]);
            assert.equal(progress.attemptCount, 1);
          },
        );
        await stage(
          'logout revokes refresh session without claiming immediate access JWT invalidation',
          async () => {
            assert.equal(
              (await post('/auth/logout', {}, '', refreshCookie)).status,
              200,
            );
            assert.equal(
              (await post('/auth/refresh', {}, '', refreshCookie)).status,
              401,
            );
          },
        );
        await stage(
          'connection loss refuses origin reconstruction and cannot add a second completion',
          async () => {
            assert.equal(
              await db.collection('completionRequests').countDocuments({}),
              1,
            );
            assert.equal(
              await db.collection('studentProgress').countDocuments({}),
              1,
            );
            await mongoose.disconnect();
            const response = await fetch(
              endpoint + '/progress/completion?conceptId=' + fixture!.conceptId,
              {
                headers: {
                  Authorization: 'Bearer ' + accessToken,
                  'X-Request-Id': randomUUID(),
                },
                signal: AbortSignal.timeout(15000),
              },
            );
            assert([404, 503].includes(response.status));
          },
        );
      } finally {
        studentPassword = '';
        accessToken = '';
        refreshCookie = '';
        await Promise.all([fixture?.stop(), fixture?.stop()]);
        // External supervisor alone performs verified native MongoDB shutdown,
        // exit/Job/port/handle/storage and protected-baseline cleanup checks.
      }
    },
  );
}

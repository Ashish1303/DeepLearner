// PREPARED ONLY. Importing does not run tests, connect, provision or collect
// credentials. A separately approved dashboard supervisor must invoke this export.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../src/config/database.js';
import {
  fixtureIndexes,
  initializeCompletionStudentFixture,
  parseFixtureCredentials,
  type SupervisedFixtureInitialization,
} from '../scripts/completion-student-fixture.js';
import { dashboardData } from '../src/modules/progress/dashboard.dto.js';
import {
  practiceDto,
  questionRevision,
} from '../src/modules/practice/practice.dto.js';
import { mongoQualification } from '../src/modules/progress/section-evidence.repository.js';

export const dashboardIntegrationIndexes = fixtureIndexes;
export const dashboardIntegrationCollections = Object.freeze([
  'auditLogs',
  'technologies',
  'learningPaths',
  'modules',
  'topics',
  'concepts',
  'practiceQuestions',
  'visualizations',
]);
export const dashboardIntegrationRecords = Object.freeze([
  'PARENT',
  'T01',
  'T02',
  'T03',
  'T04',
  'T05',
  'T06',
  'T07',
  'T08',
]);
export const dashboardIntegrationTimeoutMs = 180000;
type Observer = (record: string, status: 'START' | 'PASS' | 'FAIL') => void;
const aborted = () => new Error('DASHBOARD_INTEGRATION_ABORTED');

export function runDashboardIntegration(
  initialization: SupervisedFixtureInitialization,
  observer?: Observer,
) {
  const note = (record: string, status: 'START' | 'PASS' | 'FAIL') => {
    try {
      observer?.(record, status);
    } catch {
      /* Observation is never authority. */
    }
  };
  return test(
    'F040 guarded authenticated dashboard reads',
    { timeout: dashboardIntegrationTimeoutMs },
    async (t) => {
      let fixture:
        | Awaited<ReturnType<typeof initializeCompletionStudentFixture>>
        | undefined;
      let credentials: ReturnType<typeof parseFixtureCredentials> | undefined;
      let studentToken = '',
        adminToken = '';
      let lost = false;
      let unsubscribe: (() => void) | undefined;
      let ordinal = 0;
      let failed = false;
      const endpoint = 'http://127.0.0.1:4000/api/v1';
      const stage = async (name: string, work: () => Promise<void>) => {
        const record = dashboardIntegrationRecords[++ordinal]!;
        let failed = false;
        await t.test(name, async () => {
          note(record, 'START');
          try {
            await initialization.assertOwned();
            if (lost) throw aborted();
            await work();
            note(record, 'PASS');
          } catch {
            failed = true;
            note(record, 'FAIL');
            throw aborted();
          }
        });
        if (failed) throw aborted();
      };
      const post = (route: string, body: unknown, token = '', key?: string) =>
        fetch(endpoint + route, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://127.0.0.1:3000',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(key ? { 'Idempotency-Key': key } : {}),
          },
          body: JSON.stringify(body),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
      const login = async (email: string, password: string) => {
        const response = await post('/auth/login', { email, password });
        assert.equal(response.status, 200);
        const parsed = z
          .object({
            data: z.object({ accessToken: z.string().min(1).max(4096) }),
          })
          .safeParse(await response.json());
        assert(parsed.success);
        return parsed.data.data.accessToken;
      };
      const get = (query = '', token = studentToken) =>
        fetch(endpoint + '/dashboard' + query, {
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          redirect: 'error',
          signal: AbortSignal.timeout(35000),
        });
      const page = async (query = '') => {
        const response = await get(query);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const parsed = z
          .strictObject({
            success: z.literal(true),
            data: dashboardData,
            message: z.null(),
            meta: z.strictObject({ requestId: z.string().min(1) }),
          })
          .safeParse(await response.json());
        assert(parsed.success);
        return parsed.data.data;
      };
      note('PARENT', 'START');
      try {
        fixture = await initializeCompletionStudentFixture({
          ...initialization,
          async readCredentials() {
            const value = parseFixtureCredentials(
              await initialization.readCredentials(),
            );
            credentials = { ...value };
            return value;
          },
        });
        unsubscribe = initialization.onLoss(() => {
          lost = true;
          studentToken = adminToken = '';
          if (credentials)
            credentials.author =
              credentials.reviewer =
              credentials.student =
                '';
          credentials = undefined;
        });
        const db = mongoose.connection.db!;
        const conceptId = fixture.conceptId;
        const concept = await db
          .collection('concepts')
          .findOne({ _id: new Types.ObjectId(conceptId) }, { timeoutMS: 5000 });
        assert(concept);
        const signature = async () => {
          const hash = createHash('sha256');
          for (const name of [
            'practiceAttempts',
            'practiceAssessments',
            'studentProgress',
            'completionRequests',
            'sectionEvidenceChallenges',
            'sectionActivityReceipts',
          ]) {
            const rows = await db
              .collection(name)
              .find({}, { timeoutMS: 5000 })
              .sort({ _id: 1 })
              .toArray();
            hash.update(name).update(JSON.stringify(rows));
          }
          return hash.digest('hex'); // Compare privately; never print documents or hashes.
        };
        await stage(
          'genuine Student and independent Admin login; proven empty dashboard',
          async () => {
            assert(credentials);
            const policy = concept.completionRules.versions.find(
              (p: { version: number }) =>
                p.version === concept.completionRules.activeVersion,
            );
            assert(policy);
            assert.notEqual(
              String(policy.authoredBy),
              String(policy.approvedBy),
            );
            const author = await db
              .collection('users')
              .findOne(
                { _id: policy.authoredBy },
                { projection: { email: 1 }, timeoutMS: 5000 },
              );
            assert(author);
            adminToken = await login(author.email, credentials.author);
            studentToken = await login(
              fixture!.studentEmail,
              credentials.student,
            );
            credentials.author =
              credentials.reviewer =
              credentials.student =
                '';
            credentials = undefined;
            const data = await page();
            assert.equal(data.items.length, 0);
            assert.equal(data.pagination.nextCursor, null);
          },
        );
        await stage(
          'real original qualifying submission supplies owned activity and F039 STRONG',
          async () => {
            const response = await fetch(
              endpoint +
                '/practice-questions?conceptId=' +
                conceptId +
                '&type=OUTPUT&page=1&limit=10',
              {
                headers: { Authorization: 'Bearer ' + studentToken },
                signal: AbortSignal.timeout(15000),
              },
            );
            assert.equal(response.status, 200);
            const listed = z
              .object({
                data: z.array(z.record(z.string(), z.unknown())).length(1),
              })
              .safeParse(await response.json());
            assert(listed.success);
            const dto = practiceDto({
              ...listed.data.data[0],
              _id: listed.data.data[0]!.id,
            });
            const unlocked = await post(
              '/practice-questions/' + dto.id + '/unlock',
              {
                conceptId,
                questionRevision: questionRevision(dto),
                studentAnswer: '1',
              },
              studentToken,
              randomUUID(),
            );
            assert.equal(unlocked.status, 200);
            await unlocked.arrayBuffer();
            const data = await page();
            assert.equal(data.items.length, 1);
            assert.equal(data.items[0]!.concept.id, conceptId);
            assert.deepEqual(data.items[0]!.mastery, {
              status: 'EVALUATED',
              result: { classification: 'STRONG', code: 'NONE' },
              unavailableCode: null,
            });
            const progress = await fetch(
              endpoint + '/progress?conceptId=' + conceptId,
              {
                headers: { Authorization: 'Bearer ' + studentToken },
                signal: AbortSignal.timeout(15000),
              },
            );
            assert.equal(progress.status, 200);
            const activity = z
              .object({ data: z.unknown() })
              .safeParse(await progress.json());
            assert(activity.success);
            assert(
              JSON.stringify(activity.data.data) ===
                JSON.stringify(data.items[0]!.activity),
            );
          },
        );
        await stage(
          'concurrent reads, exclusive cursor and strict DTOs do not mutate learner data',
          async () => {
            const before = await signature();
            const pages = await Promise.all([
              page('?limit=1'),
              page('?limit=1'),
              page('?limit=1&cursor=' + conceptId),
            ]);
            assert.equal(pages[0]!.items.length, 1);
            assert.equal(pages[1]!.items.length, 1);
            assert.equal(pages[2]!.items.length, 0);
            assert(before === (await signature()));
          },
        );
        await stage(
          'anonymous, Admin and caller identity override cannot read Student dashboard',
          async () => {
            for (const [query, token, status] of [
              ['', '', 401],
              ['', adminToken, 403],
              ['?studentId=' + conceptId, studentToken, 400],
            ] as const) {
              const response = await get(query, token);
              assert.equal(response.status, status);
              assert.equal(response.headers.get('cache-control'), 'no-store');
              await response.arrayBuffer();
            }
          },
        );
        await stage(
          'current inactive and unverified Student identities are refused',
          async () => {
            const user = await db
              .collection('users')
              .findOne({ email: fixture!.studentEmail }, { timeoutMS: 5000 });
            assert(user);
            try {
              for (const change of [
                { status: 'SUSPENDED' },
                { status: 'ACTIVE', emailVerifiedAt: null },
              ]) {
                await db
                  .collection('users')
                  .updateOne(
                    { _id: user._id },
                    { $set: change },
                    { timeoutMS: 5000 },
                  );
                const response = await get();
                assert.equal(response.status, 403);
                await response.arrayBuffer();
              }
            } finally {
              await db.collection('users').updateOne(
                { _id: user._id },
                {
                  $set: {
                    status: user.status,
                    emailVerifiedAt: user.emailVerifiedAt,
                  },
                },
                { timeoutMS: 5000 },
              );
            }
          },
        );
        await stage(
          'unpublished parent ancestry is omitted without revealing hidden Concept identity',
          async () => {
            const topic = await db
              .collection('topics')
              .findOne({ _id: concept.topicId }, { timeoutMS: 5000 });
            assert(topic);
            try {
              await db
                .collection('topics')
                .updateOne(
                  { _id: topic._id },
                  { $set: { status: 'DRAFT' } },
                  { timeoutMS: 5000 },
                );
              const data = await page();
              assert.equal(data.items.length, 0);
              assert.equal(data.pagination.nextCursor, null);
            } finally {
              await db
                .collection('topics')
                .updateOne(
                  { _id: topic._id },
                  { $set: { status: topic.status } },
                  { timeoutMS: 5000 },
                );
            }
          },
        );
        await stage(
          'genuine READ revision change returns UNCLASSIFIED stale rather than a retained label',
          async () => {
            const before = await mongoQualification.conceptRevision(conceptId, {
              majority: true,
              timeoutMS: 5000,
            });
            await db.collection('concepts').updateOne(
              { _id: concept._id },
              {
                $set: {
                  'read.summary': 'A changed synthetic READ revision.',
                },
              },
              { timeoutMS: 5000 },
            );
            const after = await mongoQualification.conceptRevision(conceptId, {
              majority: true,
              timeoutMS: 5000,
            });
            assert(before !== after);
            const data = await page();
            assert.equal(data.items.length, 1);
            assert.deepEqual(data.items[0]!.mastery, {
              status: 'EVALUATED',
              result: {
                classification: 'UNCLASSIFIED',
                code: 'STALE_ASSESSMENT',
              },
              unavailableCode: null,
            });
          },
        );
        await stage(
          'lost connection cannot reconstruct authority or return a cached dashboard',
          async () => {
            await mongoose.disconnect();
            const response = await get();
            assert.equal(response.status, 503);
            assert.equal(response.headers.get('cache-control'), 'no-store');
            const parsed = z
              .object({
                success: z.literal(false),
                error: z.object({ code: z.literal('DEPENDENCY_UNAVAILABLE') }),
              })
              .safeParse(await response.json());
            assert(parsed.success);
          },
        );
      } catch {
        failed = true;
      } finally {
        if (credentials)
          credentials.author = credentials.reviewer = credentials.student = '';
        credentials = undefined;
        studentToken = adminToken = '';
        // Resource-only teardown: authenticated reporting/control channel stays open.
        // The external retained-handle supervisor alone owns mongod/Job/storage cleanup.
        try {
          unsubscribe?.();
          await fixture?.stopResources();
        } catch {
          failed = true;
        }
      }
      if (failed) {
        note('PARENT', 'FAIL');
        throw aborted();
      }
      // Diagnostic only; the future authenticated ledger must use node:test's
      // terminal events, including cancellation and parent cleanup failures.
      note('PARENT', 'PASS');
    },
  );
}

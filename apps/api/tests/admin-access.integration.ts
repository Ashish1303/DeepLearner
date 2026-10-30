// PREPARED ONLY: importing never runs tests, connects, provisions or reads input.
// A separately approved retained-handle/Job supervisor must invoke this export.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../src/config/database.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { User } from '../src/modules/users/user.model.js';
import {
  fixtureIndexes,
  initializeCompletionStudentFixture,
  parseFixtureCredentials,
  type SupervisedFixtureInitialization,
} from '../scripts/completion-student-fixture.js';

// Reuse the verified initializer unchanged. Its full 19-collection/21-index
// footprint must be separately reconciled; the Admin read itself needs only users.
export const adminIntegrationIndexes = fixtureIndexes;
export const adminIntegrationCollections = Object.freeze(
  [
    ...new Set([
      ...fixtureIndexes.map((index) => index.collection),
      'auditLogs',
      'technologies',
      'learningPaths',
      'modules',
      'topics',
      'concepts',
      'practiceQuestions',
      'visualizations',
    ]),
  ].sort(),
);
export const adminIntegrationRecords = Object.freeze([
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
export const adminIntegrationTimeoutMs = 180000;
type Observer = (record: string, status: 'START' | 'PASS' | 'FAIL') => void;
const refused = () => new Error('ADMIN_INTEGRATION_ABORTED');

export const adminReadLeaseMs = 1500;
export const adminReadBatchSize = 16;
export interface AdminReadLease {
  signal: AbortSignal;
  admit(): void;
  assertCurrent(): void;
}

/** Integration-only, read-only capability; never used by application authority.
 * A fresh authenticated ownership RPC brackets each bounded batch. The existing
 * supervisor heartbeat/onLoss remains active. No completed proof is cached or
 * renewed automatically; all mutations still execute their own fresh RPCs. */
export async function withAdminReadBatch(
  supervision: Pick<SupervisedFixtureInitialization, 'assertOwned' | 'onLoss'>,
  assertGeneration: () => void,
  work: (lease: AdminReadLease) => Promise<void>,
  clock = () => performance.now(),
) {
  const controller = new AbortController();
  let active = false,
    invalid = false,
    admitted = 0,
    started = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let rejectLoss: (error: Error) => void = () => {};
  const failure = new Promise<never>((_resolve, reject) => {
    rejectLoss = reject;
  });
  const invalidate = () => {
    invalid = true;
    controller.abort();
    rejectLoss(refused());
  };
  const assertLive = () => {
    if (invalid || controller.signal.aborted) throw refused();
    try {
      assertGeneration();
    } catch {
      invalidate();
      throw refused();
    }
  };
  const assertCurrent = () => {
    assertLive();
    const elapsed = clock() - started;
    if (
      !active ||
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed >= adminReadLeaseMs
    ) {
      invalidate();
      throw refused();
    }
  };
  const lease = Object.freeze({
    signal: controller.signal,
    assertCurrent,
    admit() {
      assertCurrent();
      if (++admitted > adminReadBatchSize) {
        invalidate();
        throw refused();
      }
    },
  });
  try {
    unsubscribe = supervision.onLoss(invalidate);
    await Promise.race([
      Promise.resolve().then(() => supervision.assertOwned()),
      failure,
    ]);
    assertLive();
    started = clock();
    if (!Number.isFinite(started)) throw refused();
    active = true;
    timer = setTimeout(invalidate, adminReadLeaseMs);
    await Promise.race([Promise.resolve().then(() => work(lease)), failure]);
    assertCurrent();
    active = false;
    clearTimeout(timer);
    // No new reads can be admitted while the final fresh RPC drains. Losing
    // ownership during this check remains terminal, even after HTTP success.
    await Promise.race([
      Promise.resolve().then(() => supervision.assertOwned()),
      failure,
    ]);
    assertLive();
  } catch {
    invalid = true;
    throw refused();
  } finally {
    active = false;
    clearTimeout(timer);
    controller.abort();
    unsubscribe?.();
  }
}

export function adminTimingNow(read = () => performance.now()): number {
  try {
    const value = read();
    return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

export interface AdminTimingObserver {
  record(name: string, start: number, end: number): void;
}
/** Diagnostic only: never inspect return values, errors, arguments or credentials. */
export async function measureAdminOperation<T>(
  timing: AdminTimingObserver | undefined,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const started = adminTimingNow();
  try {
    return await work();
  } finally {
    try {
      timing?.record(name, started, adminTimingNow());
    } catch {
      /* No authority. */
    }
  }
}

export function runAdminAccessIntegration(
  initialization: SupervisedFixtureInitialization,
  observer?: Observer,
  timing?: AdminTimingObserver,
) {
  const measure = <T>(name: string, work: () => Promise<T>) =>
    measureAdminOperation(timing, name, work);
  const note = (record: string, status: 'START' | 'PASS' | 'FAIL') => {
    try {
      observer?.(record, status);
    } catch {
      /* Observations are not authority. */
    }
  };
  return test(
    'F042 guarded current Admin namespace protection',
    {
      timeout: adminIntegrationTimeoutMs,
    },
    async (t) => {
      let fixture:
        | Awaited<ReturnType<typeof initializeCompletionStudentFixture>>
        | undefined;
      let credentials: ReturnType<typeof parseFixtureCredentials> | undefined;
      let adminToken = '',
        studentToken = '',
        promotedToken = '';
      let lost = false,
        failed = false,
        ordinal = 0;
      let unsubscribe: (() => void) | undefined;
      let readLease: AdminReadLease | undefined;
      const abort = new AbortController();
      const endpoint = 'http://127.0.0.1:4000/api/v1';
      const owned = async () => {
        if (lost || abort.signal.aborted) throw refused();
        await measure('OWNERSHIP_WAIT', () => initialization.assertOwned());
        if (lost || abort.signal.aborted) throw refused();
      };
      const clear = () => {
        adminToken = studentToken = promotedToken = '';
        if (credentials)
          credentials.author = credentials.reviewer = credentials.student = '';
        credentials = undefined;
      };
      const loss = () => {
        lost = true;
        abort.abort();
        clear();
      };
      const stage = async (name: string, work: () => Promise<void>) => {
        const record = adminIntegrationRecords[++ordinal];
        if (!record) throw refused();
        let failed = false;
        await t.test(name, async () => {
          note(record, 'START');
          const started = adminTimingNow();
          try {
            await owned();
            await work();
            await owned();
            note(record, 'PASS');
          } catch {
            failed = true;
            note(record, 'FAIL');
            throw refused();
          } finally {
            try {
              timing?.record(record, started, adminTimingNow());
              if (record === 'T07')
                timing?.record('RATE_LIMIT', started, adminTimingNow());
            } catch {
              /* Observations only. */
            }
          }
        });
        if (failed) throw refused();
      };
      const request = async (
        path: string,
        token: string,
        method = 'GET',
        body?: unknown,
      ) => {
        const lease = readLease;
        if (lease) {
          if (
            method !== 'GET' ||
            path !== '/admin/never-implemented' ||
            body !== undefined
          )
            throw refused();
          lease.admit();
        } else await owned();
        const response = await measure(
          method === 'GET' ? 'HTTP_READ' : 'AUTH_HTTP',
          () =>
            fetch(endpoint + path, {
              method,
              redirect: 'error',
              signal: AbortSignal.any([
                abort.signal,
                ...(lease ? [lease.signal] : []),
                AbortSignal.timeout(10000),
              ]),
              headers: {
                ...(token ? { Authorization: 'Bearer ' + token } : {}),
                ...(body === undefined
                  ? {}
                  : {
                      'Content-Type': 'application/json',
                      Origin: 'http://127.0.0.1:3000',
                    }),
              },
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
        );
        if (lease) lease.assertCurrent();
        else await owned();
        return response;
      };
      const expect = async (token: string, status: number, code: string) => {
        const response = await request('/admin/never-implemented', token);
        assert.equal(response.status, status);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('set-cookie'), null);
        const body: unknown = await response.json();
        const parsed = z
          .strictObject({
            success: z.literal(false),
            error: z.strictObject({
              code: z.literal(code),
              message: z.string(),
            }),
            meta: z.strictObject({ requestId: z.string().min(1) }),
          })
          .safeParse(body);
        assert(parsed.success, 'SANITIZED_ENVELOPE_REQUIRED');
        assert(
          !/passwordHash|authProviders|emailVerifiedAt|stack|accessToken/.test(
            JSON.stringify(body),
          ),
        );
        readLease?.assertCurrent();
      };
      const login = async (email: string, password: string) => {
        const response = await measure('AUTH_LOGIN_WITH_GUARDS', () =>
          request('/auth/login', '', 'POST', {
            email,
            password,
          }),
        );
        assert.equal(response.status, 200);
        const parsed = z
          .object({
            data: z.object({ accessToken: z.string().min(1).max(4096) }),
          })
          .safeParse(await response.json());
        assert(parsed.success, 'LOGIN_RESPONSE_REQUIRED');
        return parsed.data.data.accessToken;
      };
      const setupStarted = adminTimingNow();
      let setupRecorded = false;
      const finishSetup = () => {
        if (setupRecorded) return;
        setupRecorded = true;
        try {
          timing?.record('SETUP', setupStarted, adminTimingNow());
        } catch {
          /* No authority. */
        }
      };
      note('PARENT', 'START');
      t.signal.addEventListener('abort', loss, { once: true });
      try {
        await owned();
        unsubscribe = initialization.onLoss(loss);
        fixture = await measure('FIXTURE_CREATE', () =>
          initializeCompletionStudentFixture({
            ...initialization,
            async readCredentials() {
              await owned();
              const value = parseFixtureCredentials(
                await initialization.readCredentials(),
              );
              credentials = { ...value };
              return value;
            },
          }),
        );
        await owned();
        const db = mongoose.connection.db!;
        const client = mongoose.connection.getClient();
        const sameGeneration = async () => {
          await owned();
          if (
            mongoose.connection.db !== db ||
            mongoose.connection.getClient() !== client ||
            mongoose.connection.readyState !== 1
          )
            throw refused();
        };
        const readBatch = async (work: () => Promise<void>) => {
          if (readLease) throw refused();
          try {
            await withAdminReadBatch(
              initialization,
              () => {
                if (
                  lost ||
                  abort.signal.aborted ||
                  mongoose.connection.db !== db ||
                  mongoose.connection.getClient() !== client ||
                  mongoose.connection.readyState !== 1
                )
                  throw refused();
              },
              async (lease) => {
                readLease = lease;
                try {
                  await work();
                } finally {
                  readLease = undefined;
                }
              },
            );
          } catch {
            loss();
            throw refused();
          }
        };
        const options = { timeoutMS: 5000, signal: abort.signal };
        const conceptId = fixture.conceptId;
        const concept = await measure('DB_READ', () =>
          db
            .collection('concepts')
            .findOne({ _id: new Types.ObjectId(conceptId) }, options),
        );
        assert(concept);
        const policy = concept.completionRules.versions.find(
          (p: { version: number }) =>
            p.version === concept.completionRules.activeVersion,
        );
        assert(policy);
        const admin = await measure('DB_READ', () =>
          db.collection('users').findOne({ _id: policy.authoredBy }, options),
        );
        const studentEmail = fixture.studentEmail;
        const student = await measure('DB_READ', () =>
          db.collection('users').findOne({ email: studentEmail }, options),
        );
        assert(admin && student);
        const mutate = async (
          id: Types.ObjectId,
          values: Record<string, unknown>,
        ) => {
          await sameGeneration();
          const result = await measure('DB_MUTATION', () =>
            db.collection('users').updateOne(
              { _id: id },
              { $set: values },
              {
                ...options,
                writeConcern: { w: 'majority', wtimeoutMS: 2000 },
              },
            ),
          );
          assert.equal(result.matchedCount, 1);
          await sameGeneration();
        };
        const signature = async () =>
          measure('DB_SNAPSHOT', async () => {
            await sameGeneration();
            const hash = createHash('sha256');
            for (const name of adminIntegrationCollections) {
              const rows = await measure('DB_READ', () =>
                db
                  .collection(name)
                  .find({}, options)
                  .sort({ _id: 1 })
                  .toArray(),
              );
              hash.update(name).update(JSON.stringify(rows));
            }
            await sameGeneration();
            return hash.digest('hex'); // Private comparison only; never emit documents or hashes.
          });
        const { env } = await import('../src/config/env.js');
        const tokens = createAccessTokens(env);
        const createAccount = async () => {
          await sameGeneration();
          const id = new Types.ObjectId();
          const record = new User({
            _id: id,
            email: `synthetic-${id}@example.invalid`,
            firstName: 'Synthetic',
            lastName: 'Admin',
            role: 'ADMIN',
            plan: 'FREE',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            authProviders: [
              { provider: 'GOOGLE', providerUserId: `synthetic-${id}` },
            ],
          });
          await record.validate();
          await sameGeneration();
          await db
            .collection(User.collection.name)
            .insertOne(record.toObject(), {
              ...options,
              writeConcern: { w: 'majority', wtimeoutMS: 2000 },
            });
          await sameGeneration();
          // A real signed test JWT; sid existence is deliberately not an F008 access requirement.
          const token = await measure('AUTH_JWT_SIGN', () =>
            tokens.sign({
              sub: id.toHexString(),
              sid: new Types.ObjectId().toHexString(),
              role: 'ADMIN',
              plan: 'FREE',
            }),
          );
          return { id, token };
        };
        finishSetup();
        await stage(
          'original authenticated Admin, Student and anonymous namespace behavior',
          async () => {
            assert(credentials && fixture);
            adminToken = await login(admin.email, credentials.author);
            studentToken = await login(
              fixture.studentEmail,
              credentials.student,
            );
            credentials.author = credentials.reviewer = '';
            await expect(adminToken, 404, 'ROUTE_NOT_FOUND');
            await expect(studentToken, 403, 'AUTH_FORBIDDEN');
            await expect('', 401, 'AUTH_ACCESS_TOKEN_MISSING');
          },
        );
        await stage(
          'primary account lookup and Admin GET are nonmutating and sanitized',
          async () => {
            const before = await signature();
            await expect(adminToken, 404, 'ROUTE_NOT_FOUND');
            assert(before === (await signature()), 'READ_MUTATED_STORAGE');
          },
        );
        await stage(
          'demotion and promotion require current role plus an Admin JWT',
          async () => {
            await mutate(admin._id, { role: 'STUDENT' });
            await expect(adminToken, 403, 'AUTH_FORBIDDEN');
            await mutate(admin._id, { role: 'ADMIN' });
            await expect(adminToken, 404, 'ROUTE_NOT_FOUND');
            await mutate(student._id, { role: 'ADMIN' });
            await expect(studentToken, 403, 'AUTH_FORBIDDEN');
            assert(credentials && fixture);
            promotedToken = await login(
              fixture.studentEmail,
              credentials.student,
            );
            await expect(promotedToken, 404, 'ROUTE_NOT_FOUND');
            await mutate(student._id, { role: 'STUDENT' });
            await expect(promotedToken, 403, 'AUTH_FORBIDDEN');
            promotedToken = '';
            credentials.student = '';
            credentials = undefined;
          },
        );
        await stage(
          'disabled suspended and unverified accounts fail without reactivation',
          async () => {
            for (const values of [
              { status: 'DISABLED' },
              { status: 'SUSPENDED', suspendedUntil: new Date(0) },
              { status: 'ACTIVE', emailVerifiedAt: null },
            ]) {
              await measure('T04_MUTATE', () => mutate(admin._id, values));
              const before = await measure('T04_SNAPSHOT', signature);
              await measure('T04_REQUEST', () =>
                expect(adminToken, 403, 'AUTH_FORBIDDEN'),
              );
              assert(
                before === (await measure('T04_SNAPSHOT', signature)),
                'DENIAL_MUTATED_STORAGE',
              );
            }
            await mutate(admin._id, {
              status: 'ACTIVE',
              emailVerifiedAt: admin.emailVerifiedAt,
              suspendedUntil: admin.suspendedUntil ?? null,
            });
          },
        );
        await stage(
          'deleted account and corrupt eligibility cannot authorize',
          async () => {
            const account = await createAccount();
            await sameGeneration();
            const deleted = await db
              .collection('users')
              .deleteOne({ _id: account.id }, options);
            assert.equal(deleted.deletedCount, 1);
            await sameGeneration();
            await expect(account.token, 403, 'AUTH_FORBIDDEN');
            await mutate(admin._id, { role: 'UNKNOWN' });
            await expect(adminToken, 503, 'DEPENDENCY_UNAVAILABLE');
            await mutate(admin._id, { role: 'ADMIN' });
          },
        );
        await stage(
          'concurrent current-account requests preserve every fixture collection',
          async () => {
            const before = await signature();
            await readBatch(async () => {
              await Promise.all(
                Array.from({ length: 6 }, () =>
                  expect(adminToken, 404, 'ROUTE_NOT_FOUND'),
                ),
              );
            });
            assert(
              before === (await signature()),
              'CONCURRENT_READ_MUTATED_STORAGE',
            );
          },
        );
        await stage(
          'default account limit refuses the 121st request without mutation',
          async () => {
            const account = await createAccount();
            const before = await signature();
            // Same 120 successful eligibility reads plus deterministic 121st
            // refusal. Each bounded batch is freshly verified, never retried.
            for (let base = 0; base < 121; base += adminReadBatchSize) {
              await readBatch(async () => {
                for (
                  let i = base;
                  i < Math.min(base + adminReadBatchSize, 121);
                  i++
                )
                  await expect(
                    account.token,
                    i < 120 ? 404 : 429,
                    i < 120 ? 'ROUTE_NOT_FOUND' : 'RATE_LIMIT_EXCEEDED',
                  );
              });
            }
            assert(
              before === (await signature()),
              'RATE_REFUSAL_MUTATED_STORAGE',
            );
          },
        );
        await stage(
          'disconnect refuses cached authorization with sanitized no-store 503',
          async () => {
            await sameGeneration();
            await measure('DB_DISCONNECT', () => mongoose.disconnect());
            await expect(adminToken, 503, 'DEPENDENCY_UNAVAILABLE');
          },
        );
        assert.equal(ordinal, 8);
        if (lost) throw refused();
      } catch {
        failed = true;
      } finally {
        finishSetup();
        clear();
        t.signal.removeEventListener('abort', loss);
        try {
          unsubscribe?.();
          await measure(
            'FIXTURE_CLEANUP',
            () => fixture?.stopResources() ?? Promise.resolve(),
          );
        } catch {
          failed = true;
        }
      }
      if (failed || lost) {
        note('PARENT', 'FAIL');
        throw refused();
      }
      // The external supervisor must authenticate terminal node:test events and
      // acknowledge the exact RESULT digest. Observer messages alone prove nothing.
      note('PARENT', 'PASS');
    },
  );
}

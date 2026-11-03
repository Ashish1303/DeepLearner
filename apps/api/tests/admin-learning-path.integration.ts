// PREPARED ONLY. Importing registers no tests and performs no connection or write.
// A separately reviewed, approved supervisor must reconcile the full source,
// target/fixture/index/record manifest and authenticated RESULT/digest ACK protocol.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { createAdminAccessService } from '../src/modules/admin/admin-access.service.js';
import { createAdminLearningPathService } from '../src/modules/admin/learning-paths/admin-learning-path.service.js';
import type { SupervisedFixtureInitialization } from '../scripts/completion-student-fixture.js';
import { requireFixtureInitialization } from '../scripts/completion-student-fixture.js';

export const learningPathIntegrationRecords = Object.freeze([
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
export const learningPathIntegrationIndexes = Object.freeze([
  { collection: 'technologies', key: { slug: 1 }, unique: true },
  { collection: 'technologies', key: { status: 1, order: 1 }, unique: false },
  {
    collection: 'learningPaths',
    key: { technologyId: 1, slug: 1 },
    unique: true,
  },
  {
    collection: 'learningPaths',
    key: { technologyId: 1, status: 1, order: 1 },
    unique: false,
  },
]);
export interface OwnedLearningPathIntegration {
  supervision: SupervisedFixtureInitialization;
  /** Must establish PRIMARY, exclusively owned target, complete canonical indexes,
   * bounded synthetic fixture inventory and authenticated result supervision. */
  qualify(): Promise<void>;
  /** Existing private channel only; never argv/environment/evidence output. */
  accessToken(
    kind:
      | 'admin'
      | 'demoted'
      | 'disabled'
      | 'suspended'
      | 'unverified'
      | 'deleted'
      | 'student',
  ): Promise<string>;
  fixtures: Readonly<{
    technologyId: string;
    archivedTechnologyId: string;
    corruptTechnologyId: string;
    emptyTechnologyId: string;
    missingTechnologyId: string;
    pathIds: readonly string[];
    archivedPathId: string;
    mismatchedPathId: string;
    missingPathId: string;
    corruptPathId: string;
    orphanPathId: string;
    expectedSlugs: readonly string[];
  }>;
  observe(record: string, status: 'START' | 'PASS' | 'FAIL'): void;
}
/** Pure test-support lifecycle, never a qualification/ownership capability. */
export function createLearningPathIntegrationLifetime(
  parent: AbortSignal,
  subscribe: (lose: () => void) => () => void,
) {
  const abort = new AbortController();
  let closed = false;
  const lose = () => abort.abort();
  parent.addEventListener('abort', lose, { once: true });
  if (parent.aborted) lose();
  let unsubscribe: () => void;
  try {
    unsubscribe = subscribe(lose);
  } catch {
    parent.removeEventListener('abort', lose);
    lose();
    throw Error('LEARNING_PATH_INTEGRATION_FAILED');
  }
  const check = (extra?: AbortSignal) => {
    if (closed || parent.aborted || abort.signal.aborted || extra?.aborted) {
      lose();
      throw Error('LEARNING_PATH_INTEGRATION_FAILED');
    }
  };
  return {
    signal: abort.signal,
    check,
    async runCase<T>(
      signal: AbortSignal,
      operation: () => Promise<T>,
    ): Promise<T> {
      signal.addEventListener('abort', lose, { once: true });
      try {
        check(signal);
        const result = await operation();
        check(signal);
        return result;
      } finally {
        signal.removeEventListener('abort', lose);
      }
    },
    dispose() {
      if (closed) return;
      closed = true;
      lose();
      parent.removeEventListener('abort', lose);
      unsubscribe();
    },
  };
}
/** Normalize setup/qualification/driver failures without retaining their cause. */
export async function protectLearningPathIntegration<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    throw Error('LEARNING_PATH_INTEGRATION_FAILED');
  }
}
/** Not a launcher, fixture writer, target selector or result authentication channel. */
export function runAdminLearningPathIntegration(
  context: OwnedLearningPathIntegration,
) {
  return test('PARENT', { timeout: 180000 }, async (t) =>
    protectLearningPathIntegration(async () => {
      requireFixtureInitialization(context.supervision);
      const lifetime = createLearningPathIntegrationLifetime(t.signal, (lose) =>
        context.supervision.onLoss(lose),
      );
      try {
        lifetime.check();
        await context.supervision.assertOwned();
        lifetime.check();
        await context.qualify();
        lifetime.check();
        const db = mongoose.connection.db;
        if (!db || mongoose.connection.readyState !== 1)
          throw Error('LEARNING_PATH_INTEGRATION_REFUSED');
        const { env } = await import('../src/config/env.js');
        const tokens = createAccessTokens(env),
          gate = createAdminAccessService(),
          service = createAdminLearningPathService();
        const fixtures = context.fixtures;
        const values = [
          fixtures.technologyId,
          fixtures.archivedTechnologyId,
          fixtures.corruptTechnologyId,
          fixtures.emptyTechnologyId,
          fixtures.missingTechnologyId,
          ...fixtures.pathIds,
          fixtures.archivedPathId,
          fixtures.mismatchedPathId,
          fixtures.missingPathId,
          fixtures.corruptPathId,
          fixtures.orphanPathId,
        ];
        if (
          fixtures.pathIds.length !== 3 ||
          fixtures.expectedSlugs.length !== 3 ||
          !values.every((x) => /^[a-f0-9]{24}(?![\s\S])/.test(x))
        )
          throw Error('LEARNING_PATH_INTEGRATION_REFUSED');
        const owned = async () => {
          lifetime.check();
          await context.supervision.assertOwned();
          lifetime.check();
        };
        const authorize = async (
          kind: Parameters<typeof context.accessToken>[0] = 'admin',
        ) => {
          await owned();
          const token = await context.accessToken(kind);
          const actor = await tokens.verify(token);
          await gate.authorize(actor, lifetime.signal);
          await owned();
          return { actor, signal: lifetime.signal };
        };
        const snapshot = async () => {
          const result: Record<string, unknown> = {};
          for (const name of ['users', 'technologies', 'learningPaths']) {
            await owned();
            // Exact qualified disposable fixture DB only, bounded private comparison.
            const rows = await db
              .collection(name)
              .find(
                {},
                {
                  readPreference: 'primary',
                  timeoutMS: 5000,
                  signal: lifetime.signal,
                },
              )
              .sort({ _id: 1 })
              .limit(101)
              .toArray();
            if (rows.length > 100)
              throw Error('LEARNING_PATH_INTEGRATION_REFUSED');
            result[name] = JSON.stringify(rows);
          }
          return result;
        };
        const scenario = async (name: string, operation: () => Promise<void>) =>
          t.test(name, { timeout: 20000 }, async (child) =>
            lifetime.runCase(child.signal, async () => {
              try {
                await owned();
                context.observe(name, 'START');
                await operation();
                await owned();
                lifetime.check(child.signal);
                context.observe(name, 'PASS');
              } catch {
                try {
                  context.observe(name, 'FAIL');
                } catch {
                  /* No private reporting exception escapes. */
                }
                throw Error('LEARNING_PATH_INTEGRATION_ASSERTION_FAILED');
              }
            }),
          );
        const before = await snapshot();
        await scenario('T01', async () => {
          const page = await service.list(
            { technologyId: fixtures.technologyId, page: 1, limit: 20 },
            await authorize(),
          );
          assert.equal(page.pagination.total, 3);
          assert.deepEqual(
            new Set(page.items.map((x) => x.status)),
            new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
          );
        });
        await scenario('T02', async () => {
          for (const id of fixtures.pathIds) {
            const dto = await service.get(
              id,
              fixtures.technologyId,
              await authorize(),
            );
            assert.equal(dto.technologyId, fixtures.technologyId);
            assert(!('createdBy' in dto));
            assert(!('__v' in dto));
          }
        });
        await scenario('T03', async () => {
          const dto = await service.get(
            fixtures.archivedPathId,
            fixtures.archivedTechnologyId,
            await authorize(),
          );
          assert.equal(dto.technologyId, fixtures.archivedTechnologyId);
          const page = await service.list(
            { technologyId: fixtures.archivedTechnologyId, page: 1, limit: 20 },
            await authorize(),
          );
          assert(page.items.some((x) => x.id === dto.id));
        });
        await scenario('T04', async () => {
          const empty = await service.list(
            { technologyId: fixtures.emptyTechnologyId, page: 1, limit: 20 },
            await authorize(),
          );
          assert.equal(empty.pagination.total, 0);
          assert.deepEqual(empty.items, []);
          const later = await service.list(
            { technologyId: fixtures.technologyId, page: 2, limit: 20 },
            await authorize(),
          );
          assert.deepEqual(later.items, []);
        });
        await scenario('T05', async () => {
          const slugs: string[] = [];
          for (let page = 1; page <= 3; page++) {
            const result = await service.list(
              { technologyId: fixtures.technologyId, page, limit: 1 },
              await authorize(),
            );
            assert.equal(result.pagination.total, 3);
            slugs.push(result.items[0]!.slug);
          }
          assert.deepEqual(slugs, fixtures.expectedSlugs);
        });
        await scenario('T06', async () => {
          for (const kind of [
            'demoted',
            'disabled',
            'suspended',
            'unverified',
            'deleted',
            'student',
          ] as const)
            await assert.rejects(
              authorize(kind),
              (error: unknown) =>
                error instanceof AppError && error.code === 'AUTH_FORBIDDEN',
            );
        });
        await scenario('T07', async () => {
          const authority = await authorize();
          for (const id of [fixtures.mismatchedPathId, fixtures.missingPathId])
            await assert.rejects(
              service.get(id, fixtures.technologyId, authority),
              (error: unknown) =>
                error instanceof AppError &&
                error.code === 'LEARNING_PATH_NOT_FOUND',
            );
          await assert.rejects(
            service.get(
              fixtures.corruptPathId,
              fixtures.corruptTechnologyId,
              authority,
            ),
            (error: unknown) =>
              error instanceof AppError &&
              error.code === 'DEPENDENCY_UNAVAILABLE',
          );
          await assert.rejects(
            service.list(
              {
                technologyId: fixtures.missingTechnologyId,
                page: 1,
                limit: 20,
              },
              authority,
            ),
            (error: unknown) =>
              error instanceof AppError &&
              error.code === 'TECHNOLOGY_NOT_FOUND',
          );
          await assert.rejects(
            service.get(
              fixtures.orphanPathId,
              fixtures.missingTechnologyId,
              authority,
            ),
            (error: unknown) =>
              error instanceof AppError &&
              error.code === 'LEARNING_PATH_NOT_FOUND',
          );
        });
        await scenario('T08', async () => {
          const after = await snapshot();
          assert.equal(
            JSON.stringify(after),
            JSON.stringify(before),
            'DOMAIN_BASELINE_CHANGED',
          );
        });
      } catch {
        throw Error('LEARNING_PATH_INTEGRATION_FAILED');
      } finally {
        lifetime.dispose();
      }
    }),
  );
}

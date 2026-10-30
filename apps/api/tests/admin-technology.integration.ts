// PREPARED ONLY. Importing does not register tests, connect, provision or execute.
// A separately approved F043 supervisor must reconcile the complete fixture/index
// manifest, authenticated RESULT/ACK protocol and this export before invocation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import type { SupervisedFixtureInitialization } from '../scripts/completion-student-fixture.js';
import { requireFixtureInitialization } from '../scripts/completion-student-fixture.js';
import {
  createAdminTechnologyService,
  type TechnologyAuthority,
} from '../src/modules/admin/technologies/admin-technology.service.js';
import {
  adminTechnologyRepository,
  type AdminTechnologyRepository,
} from '../src/modules/admin/technologies/admin-technology.repository.js';

export const technologyIntegrationRecords = Object.freeze([
  'PARENT',
  'T01',
  'T02',
  'T03',
  'T04',
  'T05',
  'T06',
  'T07',
  'T08',
  'T09',
  'T10',
  'T11',
  'T12',
  'T13',
  'T14',
]);
export const technologyIntegrationIndexes = Object.freeze([
  { collection: 'technologies', key: { slug: 1 }, unique: true },
  { collection: 'technologies', key: { status: 1, order: 1 }, unique: false },
  {
    collection: 'auditLogs',
    key: { actorId: 1, createdAt: -1 },
    unique: false,
  },
  {
    collection: 'auditLogs',
    key: { resourceType: 1, resourceId: 1, createdAt: -1 },
    unique: false,
  },
]);
export interface OwnedTechnologyIntegration {
  supervision: SupervisedFixtureInitialization;
  /** Verifies exclusive target, approved full indexes, PRIMARY and synthetic accounts. */
  qualify(): Promise<void>;
  authority(): TechnologyAuthority;
  observe(record: string, status: 'START' | 'PASS' | 'FAIL'): void;
}
/** Not a launcher or authentication channel. Only the approved supervisor calls it. */
export async function runAdminTechnologyIntegration(
  context: OwnedTechnologyIntegration,
) {
  // Register synchronously in node:test setup. Qualification remains inside the
  // real parent, so a setup refusal produces a failed parent, never fake counts.
  return test('PARENT', { timeout: 180000 }, async (t) => {
    requireFixtureInitialization(context.supervision);
    await context.supervision.assertOwned();
    await context.qualify();
    const db = mongoose.connection.db;
    if (!db || mongoose.connection.readyState !== 1)
      throw new Error('TECHNOLOGY_INTEGRATION_REFUSED');
    let lost = false;
    const loss = new AbortController();
    const stop = context.supervision.onLoss(() => {
      lost = true;
      loss.abort();
    });
    try {
      const owned = async () => {
        if (lost) throw new Error('TECHNOLOGY_INTEGRATION_REFUSED');
        await context.supervision.assertOwned();
        if (lost) throw new Error('TECHNOLOGY_INTEGRATION_REFUSED');
      };
      const authority = context.authority();
      if (!authority.actor || authority.actor.role !== 'ADMIN')
        throw new Error('TECHNOLOGY_INTEGRATION_REFUSED');
      const actorId = new Types.ObjectId(authority.actor.sub);
      const expectedActor = { ...authority.actor };
      const makeAuthority = (): TechnologyAuthority => {
        const binding = context.authority();
        if (
          !binding.actor ||
          binding.actor.sub !== expectedActor.sub ||
          binding.actor.sid !== expectedActor.sid ||
          binding.actor.role !== 'ADMIN'
        )
          throw new Error('TECHNOLOGY_INTEGRATION_REFUSED');
        return {
          ...binding,
          signal: AbortSignal.any([
            loss.signal,
            ...(binding.signal ? [binding.signal] : []),
          ]),
        };
      };
      const baseRepository = adminTechnologyRepository;
      const ownedRepository: AdminTechnologyRepository = {
        async list(query, work) {
          await owned();
          work.check();
          return baseRepository.list(query, work);
        },
        async get(id, work) {
          await owned();
          work.check();
          return baseRepository.get(id, work);
        },
        transaction(work, operation) {
          return baseRepository.transaction(
            {
              ...work,
              verify: async () => {
                await owned();
                work.check();
                await work.verify();
                await owned();
                work.check();
              },
            },
            (tx) =>
              operation({
                ...tx,
                fence: async (...args) => {
                  await owned();
                  work.check();
                  const result = await tx.fence(...args);
                  await owned();
                  work.check();
                  return result;
                },
                insert: async (...args) => {
                  await owned();
                  work.check();
                  await tx.insert(...args);
                  await owned();
                  work.check();
                },
                patch: async (...args) => {
                  await owned();
                  work.check();
                  const result = await tx.patch(...args);
                  await owned();
                  work.check();
                  return result;
                },
                audit: async (...args) => {
                  await owned();
                  work.check();
                  await tx.audit(...args);
                  await owned();
                  work.check();
                },
              }),
          );
        },
      };
      const service = createAdminTechnologyService(ownedRepository);
      const known = (code: string) => (error: unknown) =>
        error instanceof AppError && error.code === code;
      const read = () => ({
        readPreference: 'primary' as const,
        timeoutMS: 1500,
        maxTimeMS: 1500,
      });
      let technologyId = '';
      const prior = await db
        .collection('users')
        .findOne({ _id: actorId }, read());
      if (
        !prior ||
        prior.role !== 'ADMIN' ||
        prior.status !== 'ACTIVE' ||
        !(prior.emailVerifiedAt instanceof Date)
      )
        throw new Error('TECHNOLOGY_INTEGRATION_REFUSED');
      const change = async (fields: Record<string, unknown>) => {
        await owned();
        const result = await db
          .collection('users')
          .updateOne({ _id: actorId }, { $set: fields }, { timeoutMS: 1500 });
        assert.equal(result.matchedCount, 1);
        await owned();
      };
      for (const [record, work] of [
        [
          'T01',
          async () => {
            await owned();
            const result = await service.create(
              { name: 'Integration Draft', slug: 'f043-owned-draft', order: 0 },
              'f043-create',
              makeAuthority(),
            );
            technologyId = result.id;
            assert.equal(result.status, 'DRAFT');
            assert.equal(result.revision, 0);
            const actor = await db
              .collection('users')
              .findOne({ _id: actorId }, read());
            assert.equal(actor?.__v, Number(prior.__v) + 1);
            for (const key of Object.keys(prior).filter((k) => k !== '__v'))
              assert.deepEqual(actor?.[key], prior[key]);
            const audits = await db
              .collection('auditLogs')
              .find({ requestId: 'f043-create' }, read())
              .limit(2)
              .toArray();
            assert.equal(audits.length, 1);
            assert.equal(audits[0]?.resourceType, 'TECHNOLOGY');
            assert(!JSON.stringify(audits).includes('Integration Draft'));
          },
        ],
        [
          'T02',
          async () => {
            await owned();
            const updated = await service.patch(
              technologyId,
              { revision: 0, name: 'Revised', description: null, order: 2 },
              'f043-patch',
              makeAuthority(),
            );
            assert.equal(updated.revision, 1);
            await assert.rejects(
              service.patch(
                technologyId,
                { revision: 0, name: 'Stale' },
                'f043-stale',
                makeAuthority(),
              ),
              known('TECHNOLOGY_REVISION_CONFLICT'),
            );
          },
        ],
        [
          'T03',
          async () => {
            await owned();
            const before = await db
              .collection('users')
              .findOne({ _id: actorId }, read());
            await assert.rejects(
              service.create(
                { name: 'Duplicate', slug: 'f043-owned-draft', order: 0 },
                'f043-duplicate',
                makeAuthority(),
              ),
              known('TECHNOLOGY_SLUG_CONFLICT'),
            );
            const after = await db
              .collection('users')
              .findOne({ _id: actorId }, read());
            assert.deepEqual(after, before);
            assert.equal(
              await db
                .collection('auditLogs')
                .countDocuments({ requestId: 'f043-duplicate' }, read()),
              0,
            );
          },
        ],
        [
          'T04',
          async () => {
            for (const fields of [
              { role: 'STUDENT' },
              { status: 'DISABLED' },
              { status: 'SUSPENDED' },
              { emailVerifiedAt: null },
            ]) {
              await change(fields);
              await assert.rejects(
                service.create(
                  { name: 'Denied', slug: 'f043-denied', order: 0 },
                  'f043-denied',
                  makeAuthority(),
                ),
                known('AUTH_FORBIDDEN'),
              );
              await change({
                role: 'ADMIN',
                status: 'ACTIVE',
                emailVerifiedAt: prior.emailVerifiedAt,
              });
            }
          },
        ],
        [
          'T05',
          async () => {
            await owned();
            const rejecting: AdminTechnologyRepository = {
              ...ownedRepository,
              transaction: (work, operation) =>
                ownedRepository.transaction(work, (tx) =>
                  operation({
                    ...tx,
                    audit: async () => {
                      throw new Error('SYNTHETIC_AUDIT_REFUSAL');
                    },
                  }),
                ),
            };
            const failing = createAdminTechnologyService(rejecting);
            const before = await db
              .collection('users')
              .findOne({ _id: actorId }, read());
            await assert.rejects(
              failing.create(
                { name: 'Rollback', slug: 'f043-rollback', order: 0 },
                'f043-rollback',
                makeAuthority(),
              ),
              known('DEPENDENCY_UNAVAILABLE'),
            );
            assert.equal(
              await db
                .collection('technologies')
                .countDocuments({ slug: 'f043-rollback' }, read()),
              0,
            );
            assert.deepEqual(
              await db.collection('users').findOne({ _id: actorId }, read()),
              before,
            );
          },
        ],
        [
          'T06',
          async () => {
            for (const status of ['PUBLISHED', 'ARCHIVED']) {
              await owned();
              await db
                .collection('technologies')
                .updateOne(
                  { _id: new Types.ObjectId(technologyId) },
                  { $set: { status } },
                  { timeoutMS: 1500 },
                );
              const before: Record<string, unknown> | null = await db
                .collection('technologies')
                .findOne({ _id: new Types.ObjectId(technologyId) }, read());
              await assert.rejects(
                service.patch(
                  technologyId,
                  { revision: 1, name: 'Forbidden' },
                  'f043-readonly',
                  makeAuthority(),
                ),
                known('TECHNOLOGY_READ_ONLY'),
              );
              assert.deepEqual(
                await db
                  .collection('technologies')
                  .findOne({ _id: new Types.ObjectId(technologyId) }, read()),
                before,
              );
            }
            await owned();
            await db
              .collection('technologies')
              .updateOne(
                { _id: new Types.ObjectId(technologyId) },
                { $set: { status: 'DRAFT' } },
                { timeoutMS: 1500 },
              );
          },
        ],
        [
          'T07',
          async () => {
            await owned();
            const results = await Promise.allSettled([
              service.patch(
                technologyId,
                { revision: 1, name: 'First' },
                'f043-race-a',
                makeAuthority(),
              ),
              service.patch(
                technologyId,
                { revision: 1, name: 'Second' },
                'f043-race-b',
                makeAuthority(),
              ),
            ]);
            assert.equal(
              results.filter((r) => r.status === 'fulfilled').length,
              1,
            );
            assert.equal(
              (await service.get(technologyId, makeAuthority())).revision,
              2,
            );
          },
        ],
        [
          'T08',
          async () => {
            await owned();
            const before = await db
              .collection('technologies')
              .findOne({ _id: new Types.ObjectId(technologyId) }, read());
            await service.list({ page: 1, limit: 100 }, makeAuthority());
            await service.get(technologyId, makeAuthority());
            assert.deepEqual(
              await db
                .collection('technologies')
                .findOne({ _id: new Types.ObjectId(technologyId) }, read()),
              before,
            );
            assert.equal(
              await db.collection('technologies').countDocuments(
                {
                  _id: new Types.ObjectId(technologyId),
                  status: 'PUBLISHED',
                },
                read(),
              ),
              0,
            );
          },
        ],
        [
          'T09',
          async () => {
            let release!: () => void;
            let reached!: () => void;
            const ready = new Promise<void>((resolve) => {
              reached = resolve;
            });
            const gate = new Promise<void>((resolve) => {
              release = resolve;
            });
            const interleave: AdminTechnologyRepository = {
              ...ownedRepository,
              transaction: (work, operation) =>
                ownedRepository.transaction(work, (tx) =>
                  operation({
                    ...tx,
                    fence: async (...args) => {
                      reached();
                      await gate;
                      return tx.fence(...args);
                    },
                  }),
                ),
            };
            const running = createAdminTechnologyService(interleave).patch(
              technologyId,
              { revision: 2, name: 'Must refuse' },
              'f043-demote-first',
              makeAuthority(),
            );
            const observed = running.then(
              () => null,
              (error) => error,
            );
            try {
              await Promise.race([
                ready,
                observed.then(() => {
                  throw new Error('FENCE_NOT_REACHED');
                }),
              ]);
              await change({ role: 'STUDENT' });
            } finally {
              release();
            }
            assert(known('DEPENDENCY_UNAVAILABLE')(await observed));
            await change({ role: 'ADMIN' });
          },
        ],
        [
          'T10',
          async () => {
            await owned();
            const actor = await db
              .collection('users')
              .findOne({ _id: actorId }, read());
            assert(actor);
            await db
              .collection('users')
              .deleteOne({ _id: actorId }, { timeoutMS: 1500 });
            try {
              await assert.rejects(
                service.create(
                  { name: 'Deleted', slug: 'f043-deleted', order: 0 },
                  'f043-deleted',
                  makeAuthority(),
                ),
                known('AUTH_FORBIDDEN'),
              );
            } finally {
              await owned();
              await db
                .collection('users')
                .insertOne(actor, { timeoutMS: 1500 });
            }
          },
        ],
        [
          'T11',
          async () => {
            await owned();
            let reached!: () => void;
            let release!: () => void;
            const ready = new Promise<void>((resolve) => {
              reached = resolve;
            });
            const wait = new Promise<void>((resolve) => {
              release = resolve;
            });
            const holding: AdminTechnologyRepository = {
              ...ownedRepository,
              transaction: (work, operation) =>
                ownedRepository.transaction(work, (tx) =>
                  operation({
                    ...tx,
                    fence: async (...args) => {
                      const result = await tx.fence(...args);
                      reached();
                      await wait;
                      return result;
                    },
                  }),
                ),
            };
            const active = createAdminTechnologyService(holding).patch(
              technologyId,
              { revision: 2, name: 'Before demotion' },
              'f043-mutate-first',
              makeAuthority(),
            );
            const observed = active.then(
              (value) => ({ value }),
              () => ({ value: null }),
            );
            let demotion: Promise<{ error?: unknown }> | undefined;
            try {
              await Promise.race([
                ready,
                observed.then(() => {
                  throw new Error('FENCE_NOT_REACHED');
                }),
              ]);
              demotion = change({ role: 'STUDENT' }).then(
                () => ({}),
                (error) => ({ error }),
              );
            } finally {
              release();
            }
            const result = await observed;
            assert.equal(result.value?.revision, 3);
            const changed = await demotion;
            assert(changed && !Object.hasOwn(changed, 'error'));
            await assert.rejects(
              service.patch(
                technologyId,
                { revision: 3, name: 'After demotion' },
                'f043-after-demotion',
                makeAuthority(),
              ),
              known('AUTH_FORBIDDEN'),
            );
            await change({ role: 'ADMIN' });
          },
        ],
        [
          'T12',
          async () => {
            await owned();
            const account = await db
              .collection('users')
              .findOne({ _id: actorId }, read());
            assert(account);
            let reached!: () => void;
            let release!: () => void;
            const ready = new Promise<void>((resolve) => {
              reached = resolve;
            });
            const wait = new Promise<void>((resolve) => {
              release = resolve;
            });
            const interleave: AdminTechnologyRepository = {
              ...ownedRepository,
              transaction: (work, operation) =>
                ownedRepository.transaction(work, (tx) =>
                  operation({
                    ...tx,
                    fence: async (...args) => {
                      reached();
                      await wait;
                      return tx.fence(...args);
                    },
                  }),
                ),
            };
            const active = createAdminTechnologyService(interleave).patch(
              technologyId,
              { revision: 3, name: 'Deleted authority' },
              'f043-delete-first',
              makeAuthority(),
            );
            const observed = active.then(
              () => null,
              (error) => error,
            );
            try {
              await Promise.race([
                ready,
                observed.then(() => {
                  throw new Error('FENCE_NOT_REACHED');
                }),
              ]);
              await owned();
              await db
                .collection('users')
                .deleteOne({ _id: actorId }, { timeoutMS: 1500 });
            } finally {
              release();
            }
            try {
              assert(known('DEPENDENCY_UNAVAILABLE')(await observed));
            } finally {
              await owned();
              await db
                .collection('users')
                .insertOne(account, { timeoutMS: 1500 });
            }
          },
        ],
        [
          'T13',
          async () => {
            // Simulated lost delivery AFTER a real acknowledged commit. This is
            // not a forced driver UnknownTransactionCommitResult/real DB timeout.
            await owned();
            const loseDelivery: AdminTechnologyRepository = {
              ...ownedRepository,
              transaction: async (work, operation) => {
                await ownedRepository.transaction(work, operation);
                throw new Error('SYNTHETIC_LOST_DELIVERY');
              },
            };
            await assert.rejects(
              createAdminTechnologyService(loseDelivery).create(
                { name: 'Unconfirmed', slug: 'f043-unconfirmed', order: 0 },
                'f043-unconfirmed',
                makeAuthority(),
              ),
              known('DEPENDENCY_UNAVAILABLE'),
            );
            assert.equal(
              await db
                .collection('technologies')
                .countDocuments({ slug: 'f043-unconfirmed' }, read()),
              1,
            );
            assert.equal(
              await db
                .collection('auditLogs')
                .countDocuments({ requestId: 'f043-unconfirmed' }, read()),
              1,
            );
          },
        ],
        [
          'T14',
          async () => {
            await owned();
            const before = await db
              .collection('users')
              .findOne({ _id: actorId }, read());
            const abort = new AbortController();
            let cleanup: Promise<unknown> | undefined;
            const cancel: AdminTechnologyRepository = {
              ...ownedRepository,
              transaction: (work, operation) => {
                const pending = ownedRepository.transaction(work, (tx) =>
                  operation({
                    ...tx,
                    fence: async (...args) => {
                      const result = await tx.fence(...args);
                      abort.abort();
                      return result;
                    },
                  }),
                );
                cleanup = pending.then(
                  () => null,
                  (error) => error,
                );
                return pending;
              },
            };
            const binding = makeAuthority();
            await assert.rejects(
              createAdminTechnologyService(cancel).create(
                { name: 'Cancelled', slug: 'f043-cancelled', order: 0 },
                'f043-cancelled',
                {
                  ...binding,
                  signal: AbortSignal.any([abort.signal, binding.signal!]),
                },
              ),
              known('DEPENDENCY_UNAVAILABLE'),
            );
            // Wait for repository-owned abort/endSession, not merely the early
            // response-race rejection, before asserting the transaction rollback.
            assert(cleanup);
            await cleanup;
            await owned();
            assert.equal(
              await db
                .collection('technologies')
                .countDocuments({ slug: 'f043-cancelled' }, read()),
              0,
            );
            assert.deepEqual(
              await db.collection('users').findOne({ _id: actorId }, read()),
              before,
            );
          },
        ],
      ] as const) {
        context.observe(record, 'START');
        let failed = false;
        await t.test(record, async () => {
          try {
            await owned();
            await work();
            await owned();
            context.observe(record, 'PASS');
          } catch {
            failed = true;
            context.observe(record, 'FAIL');
            throw new Error('TECHNOLOGY_INTEGRATION_ASSERTION_FAILED');
          }
        });
        if (failed) break;
      }
    } finally {
      stop();
    }
  });
}

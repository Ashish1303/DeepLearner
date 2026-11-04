// PREPARED ONLY: import registers no tests and performs no connection/fixture/DDL.
// Not bound to the existing nine read-only records. A separately approved source,
// fixture/index/ownership and authenticated RESULT/ACK manifest is required first.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import type { SupervisedFixtureInitialization } from '../scripts/completion-student-fixture.js';
import { requireFixtureInitialization } from '../scripts/completion-student-fixture.js';
import {
  createAdminLearningPathProposalService,
  type ProposalAuthority,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal.service.js';
import {
  adminLearningPathProposalRepository,
  proposalUnknown,
  type ProposalRepository,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal.repository.js';
import { validateProposalStructure } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';
import { createLearningPathIntegrationLifetime as createProposalIntegrationLifetime } from './admin-learning-path.integration.js';
export { createProposalIntegrationLifetime };

export interface OwnedProposalPersistenceIntegration {
  supervision: SupervisedFixtureInitialization;
  /** Existing reviewed supervisor must prove exclusive disposable target, complete
   * indexes, synthetic actor/parent ownership, protected baselines and result channel. */
  qualify(): Promise<void>;
  runId: string;
  technologyId: string;
  /** Valid signed-context verification from the existing private channel only. */
  authority(): ProposalAuthority;
  observe(name: string, status: 'START' | 'PASS' | 'FAIL'): void;
}
export const proposalPersistencePreparedCases = Object.freeze([
  'CAPTURE_AND_ATOMIC_AUDITS',
  'ACTOR_KEY_RECONCILIATION',
  'REVISION_PREDECESSOR_CONFLICT',
  'AUDIT_FAILURE_ROLLBACK',
  'ACKNOWLEDGEMENT_LOSS_RECONCILIATION',
]);
/** Explicit invocation only, never a launcher or evidence-authentication mechanism. */
export function runAdminLearningPathProposalPersistenceIntegration(
  context: OwnedProposalPersistenceIntegration,
) {
  return test(
    'F044_PROPOSAL_PERSISTENCE_PARENT',
    { timeout: 180000 },
    async (t) => {
      requireFixtureInitialization(context.supervision);
      const lifetime = createProposalIntegrationLifetime(t.signal, (lose) =>
        context.supervision.onLoss(lose),
      );
      try {
        lifetime.check();
        if (
          !/^[a-f0-9]{32}$/.test(context.runId) ||
          !/^[a-f0-9]{24}$/.test(context.technologyId)
        )
          throw Error('PROPOSAL_INTEGRATION_REFUSED');
        await context.qualify();
        lifetime.check();
        const db = mongoose.connection.db;
        if (
          !db ||
          mongoose.connection.readyState !== 1 ||
          db.databaseName !== `f044-proposal-${context.runId}`
        )
          throw Error('PROPOSAL_INTEGRATION_REFUSED');
        const identity = context.authority().actor;
        if (!identity || identity.role !== 'ADMIN')
          throw Error('PROPOSAL_INTEGRATION_REFUSED');
        const owned = async () => {
          lifetime.check();
          await context.supervision.assertOwned();
          lifetime.check();
        };
        const authority = (): ProposalAuthority => {
          const current = context.authority();
          if (
            !current.actor ||
            current.actor.sub !== identity.sub ||
            current.actor.sid !== identity.sid
          )
            throw Error('PROPOSAL_INTEGRATION_REFUSED');
          return {
            ...current,
            signal: AbortSignal.any([
              lifetime.signal,
              ...(current.signal ? [current.signal] : []),
            ]),
          };
        };
        const base = adminLearningPathProposalRepository;
        const repository: ProposalRepository = {
          async read(work, operation) {
            await owned();
            const out = await base.read(work, operation);
            await owned();
            return out;
          },
          transaction(work, operation) {
            return base.transaction(
              {
                ...work,
                verify: async () => {
                  await owned();
                  await work.verify();
                  await owned();
                },
              },
              (tx) =>
                operation(
                  new Proxy(tx, {
                    get(target, name) {
                      const value: unknown = Reflect.get(target, name);
                      if (typeof value !== 'function') return value;
                      return async (...args: unknown[]) => {
                        await owned();
                        work.check();
                        const out: unknown = await Reflect.apply(
                          value,
                          target,
                          args,
                        );
                        work.check();
                        await owned();
                        return out;
                      };
                    },
                  }),
                ),
            );
          },
        };
        const service = createAdminLearningPathProposalService(repository);
        const input = (operationId: string) => ({
          technologyId: context.technologyId,
          operationId,
          title: 'Owned private proposal',
          objectives: ['Inspect atomic private persistence'],
          audience: 'Synthetic integration learners',
          depth: 'BEGINNER',
          runtime: null,
          technologyVersion: null,
          prerequisites: [],
        });
        const read = () => ({
          readPreference: 'primary' as const,
          readConcern: { level: 'majority' as const },
          timeoutMS: 5000,
          signal: lifetime.signal,
        });
        const firstKey = '12345678-1234-4123-8123-123456789abc';
        let first: Awaited<ReturnType<typeof service.capture>>;
        let predecessor: ReturnType<typeof validateProposalStructure>;
        const cases: readonly [string, () => Promise<void>][] = [
          [
            'CAPTURE_AND_ATOMIC_AUDITS',
            async () => {
              first = await service.capture(
                input(firstKey),
                'p-capture',
                authority(),
              );
              await owned();
              const source = await db
                .collection('curriculumBriefRevisions')
                .findOne(
                  {
                    createdBy: new Types.ObjectId(identity.sub),
                    operationId: firstKey,
                  },
                  read(),
                );
              assert.ok(source);
              assert.equal(source._id.toHexString(), first.proposalId);
              predecessor = validateProposalStructure(
                await db
                  .collection('learningPathProposalRevisions')
                  .findOne({ _id: new Types.ObjectId(first.id) }, read()),
              );
              assert.equal(predecessor.source.digest, source.contentDigest);
              const audit = await db
                .collection('auditLogs')
                .find(
                  { _id: { $in: [source._id, new Types.ObjectId(first.id)] } },
                  read(),
                )
                .limit(3)
                .toArray();
              assert.equal(audit.length, 2);
              assert.deepEqual(audit.map((row) => row.action).sort(), [
                'CURRICULUM_BRIEF_ADMITTED',
                'LEARNING_PATH_PROPOSAL_REVISION_CREATED',
              ]);
            },
          ],
          [
            'ACTOR_KEY_RECONCILIATION',
            async () => {
              await owned();
              const before = await db
                .collection('users')
                .findOne(
                  { _id: new Types.ObjectId(identity.sub) },
                  { ...read(), projection: { __v: 1 } },
                );
              assert.deepEqual(
                await service.capture(
                  input(firstKey),
                  'p-read-again',
                  authority(),
                ),
                first,
              );
              assert.equal(
                (
                  await service.reconcile(
                    {
                      technologyId: context.technologyId,
                      operationId: firstKey,
                    },
                    authority(),
                  )
                ).state,
                'COMMITTED',
              );
              await owned();
              assert.deepEqual(
                await db
                  .collection('users')
                  .findOne(
                    { _id: new Types.ObjectId(identity.sub) },
                    { ...read(), projection: { __v: 1 } },
                  ),
                before,
              );
            },
          ],
          [
            'REVISION_PREDECESSOR_CONFLICT',
            async () => {
              const { operationId: _key, ...body } = input(firstKey);
              void _key;
              const a = service.prepareRevision(
                {
                  ...body,
                  proposalId: first.proposalId,
                  predecessor,
                  title: 'Revision two',
                },
                'p-rev-a',
                identity,
              );
              const b = service.prepareRevision(
                {
                  ...body,
                  proposalId: first.proposalId,
                  predecessor,
                  title: 'Competing two',
                },
                'p-rev-b',
                identity,
              );
              assert.equal(
                (await service.persistRevision(a, authority())).revision,
                2,
              );
              await assert.rejects(service.persistRevision(b, authority()));
              await owned();
              assert.equal(
                await db
                  .collection('learningPathProposalRevisions')
                  .countDocuments(
                    { proposalId: new Types.ObjectId(first.proposalId) },
                    read(),
                  ),
                2,
              );
            },
          ],
          [
            'AUDIT_FAILURE_ROLLBACK',
            async () => {
              const key = '12345678-1234-4123-9123-123456789abc';
              await owned();
              const before = await db.collection('users').findOne(
                { _id: new Types.ObjectId(identity.sub) },
                {
                  ...read(),
                  projection: {
                    _id: 1,
                    role: 1,
                    status: 1,
                    emailVerifiedAt: 1,
                    __v: 1,
                  },
                },
              );
              const sourceId = new Types.ObjectId();
              const revisionId = new Types.ObjectId();
              let allocations = 0;
              let reachedAudits = 0;
              let stagedProposal = false;
              const refusing: ProposalRepository = {
                ...repository,
                transaction: (work, operation) =>
                  repository.transaction(work, (tx) => {
                    return operation({
                      ...tx,
                      insertProposal: async (row) => {
                        await tx.insertProposal(row);
                        stagedProposal = true;
                      },
                      insertAudit: async (row) => {
                        if (++reachedAudits === 2)
                          throw Error('SYNTHETIC_AUDIT_REFUSAL');
                        await tx.insertAudit(row);
                      },
                    });
                  }),
              };
              await assert.rejects(
                createAdminLearningPathProposalService(
                  refusing,
                  () => performance.now(),
                  () => new Date(),
                  () => {
                    if (++allocations === 1) return sourceId;
                    if (allocations === 2) return revisionId;
                    throw Error('PROPOSAL_INTEGRATION_REFUSED');
                  },
                ).capture(input(key), 'p-rollback', authority()),
                (error: unknown) =>
                  error instanceof AppError &&
                  error.code === 'DEPENDENCY_UNAVAILABLE',
              );
              await owned();
              assert.equal(
                await db.collection('curriculumBriefRevisions').countDocuments(
                  {
                    createdBy: new Types.ObjectId(identity.sub),
                    operationId: key,
                  },
                  read(),
                ),
                0,
              );
              assert.equal(allocations, 2);
              assert.equal(reachedAudits, 2);
              assert.equal(stagedProposal, true);
              await owned();
              assert.equal(
                await db
                  .collection('learningPathProposalRevisions')
                  .countDocuments(
                    { $or: [{ _id: revisionId }, { proposalId: sourceId }] },
                    read(),
                  ),
                0,
              );
              assert.equal(
                await db
                  .collection('auditLogs')
                  .countDocuments(
                    { _id: { $in: [sourceId, revisionId] } },
                    read(),
                  ),
                0,
              );
              assert.deepEqual(
                await db.collection('users').findOne(
                  { _id: new Types.ObjectId(identity.sub) },
                  {
                    ...read(),
                    projection: {
                      _id: 1,
                      role: 1,
                      status: 1,
                      emailVerifiedAt: 1,
                      __v: 1,
                    },
                  },
                ),
                before,
              );
            },
          ],
          [
            'ACKNOWLEDGEMENT_LOSS_RECONCILIATION',
            async () => {
              const key = '12345678-1234-4123-a123-123456789abc';
              const lost: ProposalRepository = {
                ...repository,
                transaction: async (work, operation) => {
                  await repository.transaction(work, operation);
                  throw proposalUnknown();
                },
              };
              await assert.rejects(
                createAdminLearningPathProposalService(lost).capture(
                  input(key),
                  'p-unknown',
                  authority(),
                ),
              );
              assert.equal(
                (
                  await service.reconcile(
                    { technologyId: context.technologyId, operationId: key },
                    authority(),
                  )
                ).state,
                'COMMITTED',
              );
              // Injected acknowledgement loss is not a real network timeout qualification.
            },
          ],
        ];
        for (const [name, operation] of cases) {
          lifetime.check();
          context.observe(name, 'START');
          let failed = false;
          await t.test(name, async (child) => {
            try {
              await owned();
              await lifetime.runCase(child.signal, operation);
              await owned();
              context.observe(name, 'PASS');
            } catch {
              failed = true;
              context.observe(name, 'FAIL');
              throw Error('PROPOSAL_INTEGRATION_ASSERTION_FAILED');
            }
          });
          if (failed) break;
        }
      } finally {
        lifetime.dispose();
      }
      // No global deletion/DDL/process operation. The qualified owner must remove
      // its entire disposable storage and prove Job/port/baseline cleanup externally.
    },
  );
}

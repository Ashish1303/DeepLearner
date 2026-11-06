// PREPARED ONLY. Import registers no tests, opens no session and performs no I/O.
// No runner/source/fixture/result manifest is authorized or frozen by this file.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Db, MongoClient } from 'mongodb';
import { Types } from 'mongoose';
import type { SupervisedFixtureInitialization } from '../scripts/completion-student-fixture.js';
import { requireFixtureInitialization } from '../scripts/completion-student-fixture.js';
import { createLearningPathIntegrationLifetime } from './admin-learning-path.integration.js';
import {
  createAiUsageLedgerService,
  type LedgerAuthority,
  type LedgerDependencies,
} from '../src/modules/ai/ai-usage-ledger.service.js';
import {
  createAiUsageLedgerRepository,
  assertLedgerIndexes,
  assertLedgerAuditLink,
  LedgerFailure,
  type LedgerRepository,
} from '../src/modules/ai/ai-usage-ledger.repository.js';
import { ledgerRequiredIndexes } from '../src/modules/ai/ai-usage-ledger.model.js';
import {
  paiseToBigInt,
  validateLedgerOperation,
  type LedgerReserveCommand,
} from '../src/modules/ai/ai-usage-ledger.schema.js';

export const aiUsageLedgerPreparedAssertions = Object.freeze([
  'G22-I01_INDEX_AND_ATOMIC_RESERVATION',
  'G22-I02_IDENTICAL_KEY_AND_CONFLICT',
  'G22-I03_CLAIM_SETTLEMENT_REPLAY',
  'G22-I04_ATOMIC_ROLLBACK',
  'G22-I05_CONCURRENT_ADMISSION',
  'G22-I06_ACK_LOSS_READ_RECOVERY',
  'G22-I07_CURRENT_ADMIN_DEMOTION_REFUSAL',
  'G22-I08_OWNED_CLEANUP_AND_BASELINE',
]);
export interface OwnedAiUsageLedgerIntegration {
  supervision: SupervisedFixtureInitialization;
  /** Existing supervisor must prove disposable ownership, physical indexes, approved
   * synthetic profile/quote/evidence/accounts, baseline and private RESULT/ACK channel. */
  qualify(): Promise<void>;
  runId: string;
  db: Db;
  client: MongoClient;
  authority(): LedgerAuthority;
  alternateAuthority(): LedgerAuthority;
  dependencies: Omit<LedgerDependencies, 'repository'>;
  /** Exact six distinct, owner-marked actor/key/source intents in the reviewed manifest. */
  commands: readonly LedgerReserveCommand[];
  claim: { claimId: string; ownerId: string; request: unknown };
  receipt: { id: string; kind: 'FINAL_COST' };
  /** Advance only the injected synthetic server clock to the next fixed minute. */
  nextMinute(): void;
  observe(record: string, status: 'START' | 'PASS' | 'FAIL'): void;
  /** Existing ownership-safe cleanup plus protected baseline verification. No global delete. */
  cleanupAndVerify(): Promise<{
    ownedRowsAbsent: boolean;
    protectedBaselineUnchanged: boolean;
  }>;
}
/** Explicit guarded entry only. No standalone CLI, connection, provisioning or supervisor. */
export function runAiUsageLedgerIntegration(
  context: OwnedAiUsageLedgerIntegration,
) {
  return test('F053_G22_PARENT', { timeout: 180000 }, async (t) => {
    requireFixtureInitialization(context.supervision);
    const lifetime = createLearningPathIntegrationLifetime(t.signal, (lose) =>
      context.supervision.onLoss(lose),
    );
    const owned = async () => {
      lifetime.check();
      await context.supervision.assertOwned();
      lifetime.check();
    };
    let initialized = false;
    const failures: unknown[] = [];
    try {
      await owned();
      assert.match(context.runId, /^[a-f0-9]{32}$/);
      await context.qualify();
      await owned();
      assert.equal(context.db.databaseName, `f053-g22-${context.runId}`);
      assert.equal(context.commands.length, 6);
      assert.equal(new Set(context.commands.map((x) => x.operationId)).size, 6);
      const actor = context.authority().actor;
      assert(actor && actor.role === 'ADMIN');
      const alternate = context.alternateAuthority().actor;
      assert(
        alternate && alternate.role === 'ADMIN' && alternate.sub !== actor.sub,
      );
      const alternateId = new Types.ObjectId(alternate.sub);
      const actorId = new Types.ObjectId(actor.sub),
        db = context.db;
      const read = () => ({
        timeoutMS: 5000,
        signal: lifetime.signal,
        readPreference: 'primary' as const,
        promoteLongs: false,
      });
      const base = createAiUsageLedgerRepository({
        db,
        client: context.client,
      });
      const repository: LedgerRepository = {
        async read(work, operation) {
          await owned();
          const value = await base.read(work, operation);
          await owned();
          return value;
        },
        async transaction(work, operation) {
          await owned();
          const value = await base.transaction(
            {
              ...work,
              verify: async () => {
                await owned();
                await work.verify();
                await owned();
              },
            },
            operation,
          );
          await owned();
          return value;
        },
      };
      const service = (repo = repository) =>
        createAiUsageLedgerService({
          ...context.dependencies,
          repository: repo,
        });
      const authority = (second = false): LedgerAuthority => {
        const expected = second ? alternate : actor;
        const current = second
          ? context.alternateAuthority()
          : context.authority();
        assert(
          current.actor?.sub === expected.sub &&
            current.actor.sid === expected.sid,
        );
        return {
          ...current,
          signal: AbortSignal.any([
            lifetime.signal,
            ...(current.signal ? [current.signal] : []),
          ]),
        };
      };
      const operation = async (command: LedgerReserveCommand) => {
        await owned();
        const row = await db.collection('aiUsageOperations').findOne(
          {
            scope: 'SHARED_AI_TESTING',
            actorId,
            operationId: command.operationId,
          },
          read(),
        );
        await owned();
        return validateLedgerOperation(row);
      };
      const snapshot = async () => {
        await owned();
        const result: Record<string, unknown> = {};
        for (const name of [
          'aiUsageControls',
          'aiUsagePeriods',
          'aiUsageOperations',
          'auditLogs',
        ]) {
          const rows = await db
            .collection(name)
            .find({}, read())
            .sort({ _id: 1 })
            .limit(101)
            .toArray();
          assert(rows.length <= 100);
          result[name] = rows;
        }
        const users = await db
          .collection('users')
          .find(
            { _id: { $in: [actorId, alternateId] } },
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
          )
          .sort({ _id: 1 })
          .limit(3)
          .toArray();
        assert.equal(users.length, 2);
        result.users = users;
        await owned();
        return result;
      };
      const run = async (index: number, assertion: () => Promise<void>) => {
        const record = aiUsageLedgerPreparedAssertions[index]!;
        let failed = false;
        context.observe(record, 'START');
        await t.test(record, async () => {
          try {
            await owned();
            await assertion();
            await owned();
            context.observe(record, 'PASS');
          } catch (error) {
            failed = true;
            context.observe(record, 'FAIL');
            throw error;
          }
        });
        if (failed) throw new Error('AI_USAGE_INTEGRATION_CASE_FAILED');
        lifetime.check();
      };
      const first = context.commands[0]!;
      initialized = true;
      await run(0, async () => {
        for (const name of new Set(
          ledgerRequiredIndexes.map((x) => x.collection),
        )) {
          assertLedgerIndexes(
            name,
            await db.collection(name).listIndexes(read()).toArray(),
          );
        }
        assert.equal(
          await db.collection('aiUsageOperations').countDocuments({}, read()),
          0,
        );
        const before = await db
          .collection('users')
          .findOne({ _id: actorId }, read());
        assert(before);
        assert.equal(
          (await service().reserve(authority(), first)).kind,
          'RECORDED',
        );
        const op = await operation(first);
        assert.equal(op.state, 'RESERVED');
        const audit = await db
          .collection('auditLogs')
          .findOne({ _id: op.lastAuditId }, read());
        assertLedgerAuditLink(op, audit);
        const period = await db
          .collection('aiUsagePeriods')
          .findOne({ scope: op.scope, periodKey: op.periodKey }, read());
        assert(period);
        assert.equal(
          paiseToBigInt(period.heldPaise),
          paiseToBigInt(op.heldPaise),
        );
        const after = await db
          .collection('users')
          .findOne({ _id: actorId }, read());
        assert.equal(after?.__v, Number(before.__v) + 1);
      });
      await run(1, async () => {
        const before = await snapshot();
        assert.equal(
          (await service().reserve(authority(), first)).kind,
          'RECORDED',
        );
        assert.deepEqual(await snapshot(), before);
        const conflict = await service().reserve(authority(), {
          ...first,
          instructions: first.instructions + ' ',
          requestBounds: {
            ...first.requestBounds,
            instructionBytes: first.requestBounds.instructionBytes + 1,
          },
        });
        assert.equal(conflict.kind, 'REFUSED');
        if (conflict.kind === 'REFUSED')
          assert.equal(conflict.code, 'OPERATION_CONFLICT');
        assert.deepEqual(await snapshot(), before);
      });
      await run(2, async () => {
        let op = await operation(first);
        assert.equal(
          (
            await service().claimDispatch(
              authority(),
              { operationId: op.operationId, expectedVersion: op.version },
              context.claim,
            )
          ).kind,
          'RECORDED',
        );
        op = await operation(first);
        assert.equal(op.state, 'DISPATCH_CLAIMED');
        const command = {
          operationId: op.operationId,
          expectedVersion: op.version,
          claimId: context.claim.claimId,
          ownerId: context.claim.ownerId,
        };
        assert.equal(
          (await service().settle(authority(), command, context.receipt)).kind,
          'RECORDED',
        );
        op = await operation(first);
        assert.equal(op.state, 'SETTLED');
        assertLedgerAuditLink(
          op,
          await db
            .collection('auditLogs')
            .findOne({ _id: op.lastAuditId }, read()),
        );
        const before = await snapshot();
        assert.equal(
          (await service().settle(authority(), command, context.receipt)).kind,
          'RECORDED',
        );
        assert.deepEqual(await snapshot(), before);
      });
      await run(4, async () => {
        context.nextMinute();
        const choices = [
          { command: context.commands[2]!, second: false },
          { command: context.commands[3]!, second: true },
        ];
        const results = await Promise.all(
          choices.map(({ command, second }) =>
            service().reserve(authority(second), command),
          ),
        );
        assert.equal(results.filter((x) => x.kind === 'RECORDED').length, 1);
        const open = await db
          .collection('aiUsageOperations')
          .find({ scope: 'SHARED_AI_TESTING', open: true }, read())
          .limit(2)
          .toArray();
        assert.equal(open.length, 1);
        const selected = validateLedgerOperation(open[0]);
        assert(
          choices.some((c) => c.command.operationId === selected.operationId),
        );
        if (results.some((result) => result.kind === 'OUTCOME_UNKNOWN'))
          throw new Error(
            'AI_USAGE_UNCERTAIN_CASE_REQUIRES_ISOLATED_QUALIFICATION',
          );
        assert.equal(
          (
            await service().cancelUnsent(
              authority(!selected.actorId.equals(actorId)),
              {
                operationId: selected.operationId,
                expectedVersion: selected.version,
              },
            )
          ).kind,
          'RECORDED',
        );
      });
      await run(5, async () => {
        context.nextMinute();
        let committed = false;
        const lost: LedgerRepository = {
          read: repository.read,
          async transaction(work, operation) {
            await repository.transaction(work, operation);
            committed = true;
            throw new LedgerFailure('OUTCOME_UNKNOWN', true, 'COMMIT');
          },
        };
        assert.equal(
          (await service(lost).reserve(authority(), context.commands[4]!)).kind,
          'OUTCOME_UNKNOWN',
        );
        assert(committed);
        const before = await snapshot();
        assert.equal(
          (
            await service().readOperation(authority(), {
              operationId: context.commands[4]!.operationId,
            })
          ).kind,
          'RECORDED',
        );
        assert.deepEqual(await snapshot(), before);
        const op = await operation(context.commands[4]!);
        assert.equal(
          (
            await service().cancelUnsent(authority(), {
              operationId: op.operationId,
              expectedVersion: op.version,
            })
          ).kind,
          'RECORDED',
        );
      });
      await run(6, async () => {
        context.nextMinute();
        await owned();
        const changed = await db
          .collection('users')
          .updateOne(
            { _id: alternateId, role: 'ADMIN', status: 'ACTIVE' },
            { $set: { role: 'STUDENT' }, $inc: { __v: 1 } },
            read(),
          );
        assert.equal(changed.modifiedCount, 1);
        await owned();
        const before = await snapshot();
        const result = await service().reserve(
          authority(true),
          context.commands[5]!,
        );
        assert.equal(result.kind, 'REFUSED');
        assert.deepEqual(await snapshot(), before);
        assert.equal(
          (await db.collection('users').findOne({ _id: alternateId }, read()))
            ?.role,
          'STUDENT',
        );
      });
      await run(3, async () => {
        context.nextMinute();
        const before = await snapshot();
        const fail: LedgerRepository = {
          read: repository.read,
          transaction: (work, operation) =>
            repository.transaction(work, (tx) =>
              operation({
                ...tx,
                async apply(...args) {
                  await tx.apply(...args);
                  throw new LedgerFailure('RETRY_LATER');
                },
              }),
            ),
        };
        assert.equal(
          (await service(fail).reserve(authority(), context.commands[1]!)).kind,
          'OUTCOME_UNKNOWN',
        );
        assert.deepEqual(await snapshot(), before);
      });
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        if (initialized) {
          lifetime.check();
          await context.supervision.assertOwned();
          const record = aiUsageLedgerPreparedAssertions[7]!;
          context.observe(record, 'START');
          try {
            const cleaned = await context.cleanupAndVerify();
            assert.equal(cleaned.ownedRowsAbsent, true);
            assert.equal(cleaned.protectedBaselineUnchanged, true);
            context.observe(record, 'PASS');
          } catch (error) {
            failures.push(error);
            context.observe(record, 'FAIL');
          }
        }
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          lifetime.dispose();
        } catch (error) {
          failures.push(error);
        }
      }
    }
    if (failures.length)
      throw new AggregateError(failures, 'AI_USAGE_INTEGRATION_FAILED');
  });
}

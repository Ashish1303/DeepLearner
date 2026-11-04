// PREPARED ONLY. Import registers no tests, connects nowhere and starts no server.
// Requires a separately approved qualified API/replica-set/source/fixture manifest.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import type { SupervisedFixtureInitialization } from '../scripts/completion-student-fixture.js';
import { requireFixtureInitialization } from '../scripts/completion-student-fixture.js';
import {
  createLearningPathIntegrationLifetime,
  protectLearningPathIntegration,
} from './admin-learning-path.integration.js';
import {
  proposalResponseDto,
  proposalRecoveryResponse,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal-request.schema.js';
import { validateCurriculumBriefRecord } from '../src/modules/admin/learning-paths/admin-curriculum-brief.schema.js';
import { validateProposalRecord } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';

export const proposalApiPreparedCases = Object.freeze([
  'API_CAPTURE_200_AND_ATOMIC_EVIDENCE',
  'API_IDENTICAL_CAPTURE_AND_KEY_CONFLICT',
  'API_ACTOR_BOUND_OPERATION_RECOVERY',
  'API_TECHNOLOGY_BOUND_PRIVATE_DETAIL',
  'API_ARCHIVED_PARENT_INSPECTION',
  'API_UNRESOLVED_AND_READ_NONMUTATION',
] as const);
type ApiCase = (typeof proposalApiPreparedCases)[number];
export interface OwnedProposalApiIntegration {
  supervision: SupervisedFixtureInitialization;
  /** Must qualify BOTH exclusively owned API and DB, exact indexes, private
   * channel, signed synthetic accounts, fixtures, protected baselines and cleanup. */
  qualify(): Promise<void>;
  runId: string;
  technologyId: string;
  otherTechnologyId: string;
  archivedTechnologyId: string;
  archivedProposalId: string;
  primaryActorId: string;
  otherActorId: string;
  /** Existing owned API client only. No arbitrary URL, token, secret or new host.
   * Implementer must suppress URL/body logging, bind identity through the existing
   * private channel and enforce cancellation/bounded HTTP. Not implemented here. */
  request(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    identity: 'primary' | 'other',
    signal: AbortSignal,
  ): Promise<{
    status: number;
    body: unknown;
    cacheControl: string | null;
  }>;
  observe(name: ApiCase, status: 'START' | 'PASS' | 'FAIL'): void;
}

/** Explicit future invocation only; not an execution adapter or RESULT/ACK proof. */
export function runAdminLearningPathProposalApiIntegration(
  context: OwnedProposalApiIntegration,
) {
  return test('F044_PROPOSAL_API_PARENT', { timeout: 180000 }, async (t) =>
    protectLearningPathIntegration(async () => {
      requireFixtureInitialization(context.supervision);
      const lifetime = createLearningPathIntegrationLifetime(t.signal, (lose) =>
        context.supervision.onLoss(lose),
      );
      try {
        lifetime.check();
        assert.match(context.runId, /^[a-f0-9]{32}$/);
        for (const value of [
          context.technologyId,
          context.otherTechnologyId,
          context.archivedTechnologyId,
          context.archivedProposalId,
          context.primaryActorId,
          context.otherActorId,
        ])
          assert.match(value, /^[a-f0-9]{24}$/);
        assert.notEqual(context.primaryActorId, context.otherActorId);
        assert.equal(
          new Set([
            context.technologyId,
            context.otherTechnologyId,
            context.archivedTechnologyId,
          ]).size,
          3,
        );
        await context.qualify();
        lifetime.check();
        const db = mongoose.connection.db;
        if (
          !db ||
          mongoose.connection.readyState !== 1 ||
          db.databaseName !== `f044-proposal-${context.runId}`
        )
          throw Error('PROPOSAL_API_INTEGRATION_REFUSED');
        const owned = async () => {
          lifetime.check();
          await context.supervision.assertOwned();
          lifetime.check();
        };
        const base = '/api/v1/admin/learning-path-proposals';
        const body = {
          technologyId: context.technologyId,
          operationId: randomUUID(),
          title: 'Owned API private curriculum',
          objectives: ['Verify owned capture'],
          audience: 'Synthetic administrators',
          depth: 'BEGINNER',
          runtime: null,
          technologyVersion: null,
          prerequisites: [],
        };
        type Dto = ReturnType<typeof proposalResponseDto.parse>;
        let saved: Dto | undefined;
        const jsonData = (raw: unknown) => {
          assert(raw && typeof raw === 'object');
          const value = raw as Record<string, unknown>;
          assert.deepEqual(Object.keys(value).sort(), [
            'data',
            'message',
            'meta',
            'success',
          ]);
          assert.equal(value.success, true);
          assert.equal(value.message, null);
          return value.data;
        };
        const read = async (
          collection: string,
          filter: Record<string, unknown>,
        ) => {
          await owned();
          const row = await db.collection(collection).findOne(filter, {
            readPreference: 'primary',
            readConcern: { level: 'majority' },
            timeoutMS: 5000,
            maxTimeMS: 5000,
            signal: lifetime.signal,
            ...(collection === 'users'
              ? {
                  projection: {
                    _id: 1,
                    role: 1,
                    status: 1,
                    emailVerifiedAt: 1,
                    __v: 1,
                  },
                }
              : {}),
          });
          await owned();
          return row;
        };
        const send = async (
          method: 'GET' | 'POST',
          path: string,
          input: unknown,
          signal: AbortSignal,
          identity: 'primary' | 'other' = 'primary',
        ) => {
          await owned();
          const result = await context.request(
            method,
            path,
            input,
            identity,
            signal,
          );
          await owned();
          assert.equal(result.cacheControl, 'no-store');
          return result;
        };
        // Bounded evidence inside the independently qualified disposable DB only.
        // Never include raw rows/fingerprints in observer output or assertions.
        const snapshot = async () => {
          const groups: unknown[] = [];
          for (const collection of [
            'users',
            'curriculumBriefRevisions',
            'learningPathProposalRevisions',
            'auditLogs',
          ]) {
            await owned();
            const users = collection === 'users';
            const rows = await db
              .collection(collection)
              .find(
                users
                  ? {
                      _id: {
                        $in: [
                          new Types.ObjectId(context.primaryActorId),
                          new Types.ObjectId(context.otherActorId),
                        ],
                      },
                    }
                  : {},
                {
                  readPreference: 'primary',
                  readConcern: { level: 'majority' },
                  timeoutMS: 5000,
                  maxTimeMS: 5000,
                  signal: lifetime.signal,
                  ...(users
                    ? {
                        projection: {
                          _id: 1,
                          role: 1,
                          status: 1,
                          emailVerifiedAt: 1,
                          __v: 1,
                        },
                      }
                    : {}),
                },
              )
              .sort({ _id: 1 })
              .limit(101)
              .toArray();
            await owned();
            assert(rows.length <= 100, 'PROPOSAL_API_SNAPSHOT_BOUND');
            if (users)
              assert.equal(rows.length, 2, 'PROPOSAL_API_ACTOR_FIXTURES');
            groups.push(rows);
          }
          return createHash('sha256')
            .update(JSON.stringify(groups), 'utf8')
            .digest('hex');
        };
        let halted = false;
        for (const name of proposalApiPreparedCases) {
          if (halted) break;
          await t.test(name, async (child) => {
            try {
              const signal = AbortSignal.any([lifetime.signal, child.signal]);
              await lifetime.runCase(signal, async () => {
                await owned();
                context.observe(name, 'START');
                try {
                  if (name === 'API_CAPTURE_200_AND_ATOMIC_EVIDENCE') {
                    const before = await read('users', {
                      _id: new Types.ObjectId(context.primaryActorId),
                    });
                    assert(before);
                    const result = await send('POST', base, body, signal);
                    assert.equal(result.status, 200);
                    saved = proposalResponseDto.parse(jsonData(result.body));
                    assert.equal(saved.revision, 1);
                    assert.equal(saved.technologyId, context.technologyId);
                    const source = validateCurriculumBriefRecord(
                      await read('curriculumBriefRevisions', {
                        _id: new Types.ObjectId(saved.source.id),
                      }),
                      context.technologyId,
                    );
                    assert.equal(source.createdBy, context.primaryActorId);
                    assert.equal(source.operationId, body.operationId);
                    const proposal = validateProposalRecord(
                      await read('learningPathProposalRevisions', {
                        _id: new Types.ObjectId(saved.id),
                      }),
                      {
                        technologyId: context.technologyId,
                        source: {
                          id: source._id,
                          revision: 1,
                          digest: source.contentDigest,
                        },
                      },
                    );
                    assert.equal(proposal.proposalId, source._id);
                    assert.equal(proposal.title, source.title);
                    const admission = await read('auditLogs', {
                      _id: new Types.ObjectId(source._id),
                    });
                    const audit = await read('auditLogs', {
                      _id: new Types.ObjectId(proposal._id),
                    });
                    assert.equal(
                      admission?.action,
                      'CURRICULUM_BRIEF_ADMITTED',
                    );
                    assert.equal(
                      audit?.action,
                      'LEARNING_PATH_PROPOSAL_REVISION_CREATED',
                    );
                    assert.equal(
                      String(admission?.actorId),
                      context.primaryActorId,
                    );
                    assert.equal(
                      String(audit?.actorId),
                      context.primaryActorId,
                    );
                    assert.equal(String(admission?.resourceId), source._id);
                    assert.equal(String(audit?.resourceId), proposal._id);
                    const after = await read('users', {
                      _id: new Types.ObjectId(context.primaryActorId),
                    });
                    assert(after);
                    assert.equal(after.__v, Number(before.__v) + 1);
                  } else {
                    if (!saved)
                      throw Error('PROPOSAL_API_PRIOR_CASE_INCOMPLETE');
                    const before = await snapshot();
                    if (name === 'API_IDENTICAL_CAPTURE_AND_KEY_CONFLICT') {
                      const result = await send('POST', base, body, signal);
                      assert.equal(result.status, 200);
                      assert.deepEqual(jsonData(result.body), saved);
                      const conflict = await send(
                        'POST',
                        base,
                        { ...body, title: 'Changed payload' },
                        signal,
                      );
                      assert.equal(conflict.status, 409);
                      const error = conflict.body as {
                        error: { code: string };
                      };
                      assert.equal(error.error.code, 'PROPOSAL_CONFLICT');
                    }
                    if (name === 'API_ACTOR_BOUND_OPERATION_RECOVERY') {
                      const path =
                        base +
                        '/operations/' +
                        body.operationId +
                        '?technologyId=' +
                        context.technologyId;
                      const result = await send('GET', path, undefined, signal);
                      assert.equal(result.status, 200);
                      assert.deepEqual(
                        proposalRecoveryResponse.parse(jsonData(result.body)),
                        { state: 'COMMITTED', proposal: saved },
                      );
                      const other = await send(
                        'GET',
                        path,
                        undefined,
                        signal,
                        'other',
                      );
                      assert.equal(other.status, 200);
                      assert.deepEqual(jsonData(other.body), {
                        state: 'UNRESOLVED',
                      });
                    }
                    if (name === 'API_TECHNOLOGY_BOUND_PRIVATE_DETAIL') {
                      const path =
                        base +
                        '/' +
                        saved.id +
                        '?technologyId=' +
                        context.technologyId;
                      const result = await send(
                        'GET',
                        path,
                        undefined,
                        signal,
                        'other',
                      );
                      assert.equal(result.status, 200);
                      assert.deepEqual(jsonData(result.body), saved);
                      const wrong = await send(
                        'GET',
                        base +
                          '/' +
                          saved.id +
                          '?technologyId=' +
                          context.otherTechnologyId,
                        undefined,
                        signal,
                      );
                      assert.equal(wrong.status, 404);
                      assert.equal(
                        (wrong.body as { error: { code: string } }).error.code,
                        'PROPOSAL_NOT_FOUND',
                      );
                    }
                    if (name === 'API_ARCHIVED_PARENT_INSPECTION') {
                      const result = await send(
                        'GET',
                        base +
                          '/' +
                          context.archivedProposalId +
                          '?technologyId=' +
                          context.archivedTechnologyId,
                        undefined,
                        signal,
                      );
                      assert.equal(result.status, 200);
                      const row = proposalResponseDto.parse(
                        jsonData(result.body),
                      );
                      assert.equal(
                        row.technologyId,
                        context.archivedTechnologyId,
                      );
                      const refused = await send(
                        'POST',
                        base,
                        {
                          ...body,
                          operationId: randomUUID(),
                          technologyId: context.archivedTechnologyId,
                        },
                        signal,
                      );
                      assert.equal(refused.status, 409);
                      assert.equal(
                        (refused.body as { error: { code: string } }).error
                          .code,
                        'TECHNOLOGY_READ_ONLY',
                      );
                    }
                    if (name === 'API_UNRESOLVED_AND_READ_NONMUTATION') {
                      const result = await send(
                        'GET',
                        base +
                          '/operations/' +
                          randomUUID() +
                          '?technologyId=' +
                          context.technologyId,
                        undefined,
                        signal,
                      );
                      assert.equal(result.status, 200);
                      assert.deepEqual(jsonData(result.body), {
                        state: 'UNRESOLVED',
                      });
                    }
                    assert(
                      (await snapshot()) === before,
                      'PROPOSAL_API_READ_OR_DUPLICATE_MUTATED',
                    );
                  }
                  await owned();
                  context.observe(name, 'PASS');
                } catch {
                  halted = true;
                  context.observe(name, 'FAIL');
                  throw Error('PROPOSAL_API_ASSERTION_FAILED');
                }
              });
            } catch {
              halted = true;
              throw Error('PROPOSAL_API_ASSERTION_FAILED');
            }
          });
        }
      } finally {
        lifetime.dispose();
      }
    }),
  );
}

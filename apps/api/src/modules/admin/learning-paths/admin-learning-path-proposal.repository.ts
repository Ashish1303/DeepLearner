import { Types } from 'mongoose';
import type { ClientSession, Document } from 'mongodb';
import { mongoose } from '../../../config/database.js';
import { AppError } from '../../../common/errors/app-error.js';
import { Audit } from '../../audit/audit.model.js';

export const proposalUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Private proposals are temporarily unavailable',
  );
export const proposalUnknown = () =>
  new AppError(
    503,
    'PROPOSAL_OUTCOME_UNKNOWN',
    'Save outcome is uncertain; use explicit read reconciliation',
  );
export interface ProposalWork {
  signal: AbortSignal;
  remaining(): number;
  check(): void;
  verify(): Promise<void>;
  mutation(): void;
  commit(): void;
  uncertain(): void;
}
export interface ProposalReader {
  actor(id: Types.ObjectId, timeoutMS: number): Promise<unknown>;
  technology(id: Types.ObjectId): Promise<unknown>;
  brief(id: Types.ObjectId): Promise<unknown>;
  operation(actor: Types.ObjectId, operationId: string): Promise<unknown>;
  proposal(id: Types.ObjectId): Promise<unknown>;
  revision(family: Types.ObjectId, revision: number): Promise<unknown>;
  latest(family: Types.ObjectId): Promise<unknown>;
  audit(id: Types.ObjectId): Promise<unknown>;
}
export interface ProposalTransaction extends ProposalReader {
  fence(
    id: Types.ObjectId,
    version: number,
    verifiedAt: Date,
  ): Promise<boolean>;
  insertBrief(row: Document): Promise<void>;
  insertProposal(row: Document): Promise<void>;
  insertAudit(row: Document): Promise<void>;
}
export interface ProposalRepository {
  read<T>(
    work: ProposalWork,
    operation: (reader: ProposalReader) => Promise<T>,
  ): Promise<T>;
  transaction<T>(
    work: ProposalWork,
    operation: (tx: ProposalTransaction) => Promise<T>,
  ): Promise<T>;
}

function database() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db)
    throw proposalUnavailable();
  return mongoose.connection.db;
}
export const proposalPersistenceIndexes = [
  { collection: 'users', key: { _id: 1 }, unique: true },
  { collection: 'technologies', key: { _id: 1 }, unique: true },
  { collection: 'curriculumBriefRevisions', key: { _id: 1 }, unique: true },
  {
    collection: 'curriculumBriefRevisions',
    key: { createdBy: 1, operationId: 1 },
    name: 'uq_curriculum_brief_actor_operation',
    unique: true,
  },
  {
    collection: 'learningPathProposalRevisions',
    key: { _id: 1 },
    unique: true,
  },
  {
    collection: 'learningPathProposalRevisions',
    key: { proposalId: 1, revision: 1 },
    name: 'uq_learning_path_proposal_revision',
    unique: true,
  },
  {
    collection: 'learningPathProposalRevisions',
    key: { technologyId: 1, createdAt: -1, _id: -1 },
    name: 'ix_learning_path_proposal_technology_created',
    unique: false,
  },
  { collection: 'auditLogs', key: { _id: 1 }, unique: true },
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
] as const;
const options = (work: ProposalWork, session?: ClientSession) => {
  work.check();
  return {
    timeoutMS: work.remaining(),
    signal: work.signal,
    readPreference: 'primary' as const,
    ...(session
      ? { session }
      : { readConcern: { level: 'majority' as const } }),
  };
};
async function qualify(work: ProposalWork) {
  const hello = await database().admin().command({ hello: 1 }, options(work));
  work.check();
  if (
    hello.isWritablePrimary !== true ||
    typeof hello.setName !== 'string' ||
    !hello.setName ||
    !Number.isSafeInteger(hello.logicalSessionTimeoutMinutes)
  )
    throw proposalUnavailable();
  for (const collection of new Set(
    proposalPersistenceIndexes.map((index) => index.collection),
  )) {
    const rows = await database()
      .collection(collection)
      .listIndexes({ timeoutMS: work.remaining(), readPreference: 'primary' })
      .toArray();
    work.check();
    for (const expected of proposalPersistenceIndexes.filter(
      (index) => index.collection === collection,
    )) {
      if (
        !rows.some(
          (row) =>
            JSON.stringify(row.key) === JSON.stringify(expected.key) &&
            (row.unique === true || row.name === '_id_') === expected.unique &&
            (!('name' in expected) || row.name === expected.name) &&
            row.sparse !== true &&
            row.partialFilterExpression === undefined &&
            row.expireAfterSeconds === undefined &&
            row.hidden !== true &&
            (row.collation === undefined || row.collation.locale === 'simple'),
        )
      )
        throw proposalUnavailable();
    }
  }
}
function reader(work: ProposalWork, session?: ClientSession): ProposalReader {
  const find = async (
    collection: string,
    filter: Document,
    extra: Document = {},
  ) => {
    const row = await database()
      .collection(collection)
      .findOne(filter, { ...options(work, session), ...extra });
    work.check();
    return row;
  };
  return {
    actor: (id, timeoutMS) =>
      find(
        'users',
        { _id: id },
        {
          projection: {
            _id: 1,
            role: 1,
            status: 1,
            emailVerifiedAt: 1,
            __v: 1,
          },
          timeoutMS: Math.min(timeoutMS, work.remaining()),
        },
      ),
    technology: (id) =>
      find('technologies', { _id: id }, { projection: { _id: 1, status: 1 } }),
    brief: (id) => find('curriculumBriefRevisions', { _id: id }),
    operation: (createdBy, operationId) =>
      find(
        'curriculumBriefRevisions',
        { createdBy, operationId },
        { hint: 'uq_curriculum_brief_actor_operation' },
      ),
    proposal: (id) => find('learningPathProposalRevisions', { _id: id }),
    revision: (proposalId, revision) =>
      find(
        'learningPathProposalRevisions',
        { proposalId, revision },
        { hint: 'uq_learning_path_proposal_revision' },
      ),
    latest: async (proposalId) => {
      const rows = await database()
        .collection('learningPathProposalRevisions')
        .find(
          { proposalId },
          {
            ...options(work, session),
            hint: 'uq_learning_path_proposal_revision',
          },
        )
        .sort({ revision: -1 })
        .limit(1)
        .toArray();
      work.check();
      if (rows.length > 1) throw proposalUnavailable();
      return rows[0] ?? null;
    },
    audit: (id) => find('auditLogs', { _id: id }),
  };
}
export const adminLearningPathProposalRepository: ProposalRepository = {
  async read(work, operation) {
    await qualify(work);
    work.check();
    const result = await operation(reader(work));
    work.check();
    return result;
  },
  async transaction<T>(
    work: ProposalWork,
    operation: (tx: ProposalTransaction) => Promise<T>,
  ) {
    await qualify(work);
    work.check();
    const db = database();
    const session = mongoose.connection.getClient().startSession({
      causalConsistency: false,
      defaultTimeoutMS: work.remaining(),
    });
    let committing = false;
    let failed = false;
    let failure: unknown;
    let value: T | undefined;
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority', j: true },
        readPreference: 'primary',
        maxCommitTimeMS: Math.min(2000, work.remaining()),
      });
      const insert = async (collection: string, row: Document) => {
        work.check();
        work.mutation();
        const result = await db
          .collection(collection)
          .insertOne(row, options(work, session));
        work.check();
        if (!result.acknowledged) throw proposalUnavailable();
      };
      const tx: ProposalTransaction = {
        ...reader(work, session),
        async fence(id, version, verifiedAt) {
          work.check();
          work.mutation();
          const result = await db.collection('users').updateOne(
            {
              _id: id,
              role: 'ADMIN',
              status: 'ACTIVE',
              emailVerifiedAt: verifiedAt,
              __v: version,
            },
            { $inc: { __v: 1 } },
            options(work, session),
          );
          work.check();
          return result.matchedCount === 1 && result.modifiedCount === 1;
        },
        insertBrief: (row) => insert('curriculumBriefRevisions', row),
        insertProposal: (row) => insert('learningPathProposalRevisions', row),
        async insertAudit(row) {
          const audit = new Audit(row);
          await audit.validate();
          work.check();
          await insert('auditLogs', audit.toObject());
        },
      };
      value = await operation(tx);
      work.check();
      await work.verify();
      work.check();
      work.commit();
      committing = true;
      await session.commitTransaction({
        timeoutMS: Math.min(2000, work.remaining()),
      });
      work.check();
    } catch (error) {
      failed = true;
      failure = committing ? proposalUnknown() : error;
    }
    let cleanupFailed = false;
    try {
      if (!committing && session.inTransaction())
        await session.abortTransaction({ timeoutMS: 2000 });
    } catch {
      cleanupFailed = true;
    } finally {
      try {
        await session.endSession({ timeoutMS: 2000 });
      } catch {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed || !session.hasEnded) {
      work.uncertain();
      throw proposalUnknown();
    }
    if (failed) throw failure;
    return value as T;
  },
};

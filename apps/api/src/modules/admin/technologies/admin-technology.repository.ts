import { Types } from 'mongoose';
import type { ClientSession, Document } from 'mongodb';
import { mongoose } from '../../../config/database.js';
import { Audit } from '../../audit/audit.model.js';
import {
  technologyProjection,
  technologyUnavailable,
} from './admin-technology.dto.js';
import type { AdminTechnologyQuery } from './admin-technology.schema.js';

export interface TechnologyWork {
  signal: AbortSignal;
  remaining(): number;
  check(): void;
  verify(): Promise<void>;
}
export interface TechnologyTransaction {
  actor(id: Types.ObjectId): Promise<unknown>;
  fence(
    id: Types.ObjectId,
    version: number,
    verifiedAt: Date,
  ): Promise<boolean>;
  get(id: Types.ObjectId): Promise<unknown>;
  insert(row: Document): Promise<void>;
  patch(
    id: Types.ObjectId,
    revision: number,
    fields: Document,
    clearDescription: boolean,
  ): Promise<boolean>;
  audit(row: Document): Promise<void>;
}
export interface AdminTechnologyRepository {
  list(
    query: AdminTechnologyQuery,
    work: TechnologyWork,
  ): Promise<{ records: unknown[]; total: number }>;
  get(id: Types.ObjectId, work: TechnologyWork): Promise<unknown>;
  transaction<T>(
    work: TechnologyWork,
    operation: (tx: TechnologyTransaction) => Promise<T>,
  ): Promise<T>;
}

function database() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db)
    throw technologyUnavailable();
  return mongoose.connection.db;
}
const options = (work: TechnologyWork, session?: ClientSession) => ({
  timeoutMS: work.remaining(),
  signal: work.signal,
  readPreference: 'primary' as const,
  ...(session ? { session } : {}),
});
async function primary(work: TechnologyWork) {
  const hello = await database().admin().command({ hello: 1 }, options(work));
  work.check();
  if (
    hello.isWritablePrimary !== true ||
    typeof hello.setName !== 'string' ||
    !hello.setName
  )
    throw technologyUnavailable();
}
async function indexes(work: TechnologyWork) {
  for (const [collection, expected] of [
    [
      'technologies',
      [{ key: { slug: 1 }, unique: true }, { key: { status: 1, order: 1 } }],
    ],
    [
      'auditLogs',
      [
        { key: { actorId: 1, createdAt: -1 } },
        { key: { resourceType: 1, resourceId: 1, createdAt: -1 } },
      ],
    ],
  ] as const) {
    const rows = await database()
      .collection(collection)
      .listIndexes({ timeoutMS: work.remaining(), readPreference: 'primary' })
      .toArray();
    work.check();
    for (const required of expected)
      if (
        !rows.some(
          (row) =>
            JSON.stringify(row.key) === JSON.stringify(required.key) &&
            (row.unique === true) === 'unique' in required &&
            row.sparse !== true &&
            row.partialFilterExpression === undefined &&
            row.expireAfterSeconds === undefined &&
            row.hidden !== true &&
            (row.collation === undefined || row.collation.locale === 'simple'),
        )
      )
        throw technologyUnavailable();
  }
}

export const adminTechnologyRepository: AdminTechnologyRepository = {
  async list(query, work) {
    await primary(work);
    const records = await database()
      .collection('technologies')
      .find({}, { ...options(work), projection: technologyProjection })
      .sort({ slug: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .toArray();
    work.check();
    const total = await database()
      .collection('technologies')
      .countDocuments({}, options(work));
    work.check();
    return { records, total };
  },
  async get(id, work) {
    await primary(work);
    const row = await database()
      .collection('technologies')
      .findOne(
        { _id: id },
        { ...options(work), projection: technologyProjection },
      );
    work.check();
    return row;
  },
  async transaction<T>(
    work: TechnologyWork,
    operation: (tx: TechnologyTransaction) => Promise<T>,
  ) {
    await primary(work);
    await indexes(work);
    work.check();
    const db = database();
    const session = mongoose.connection.getClient().startSession({
      causalConsistency: false,
      defaultTimeoutMS: work.remaining(),
    });
    let committing = false;
    let failed = false;
    let failure: unknown;
    let value: unknown;
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority', j: true },
        readPreference: 'primary',
        maxCommitTimeMS: Math.min(2000, work.remaining()),
      });
      const tx: TechnologyTransaction = {
        async actor(id) {
          const row = await db.collection('users').findOne(
            { _id: id },
            {
              ...options(work, session),
              projection: {
                _id: 1,
                role: 1,
                status: 1,
                emailVerifiedAt: 1,
                __v: 1,
              },
            },
          );
          work.check();
          return row;
        },
        async fence(id, version, verifiedAt) {
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
        async get(id) {
          const row = await db
            .collection('technologies')
            .findOne(
              { _id: id },
              { ...options(work, session), projection: technologyProjection },
            );
          work.check();
          return row;
        },
        async insert(row) {
          const result = await db
            .collection('technologies')
            .insertOne(row, options(work, session));
          work.check();
          if (!result.acknowledged) throw technologyUnavailable();
        },
        async patch(id, revision, fields, clearDescription) {
          const result = await db.collection('technologies').updateOne(
            { _id: id, status: 'DRAFT', __v: revision },
            {
              $set: fields,
              $inc: { __v: 1 },
              ...(clearDescription ? { $unset: { description: '' } } : {}),
            },
            options(work, session),
          );
          work.check();
          return result.matchedCount === 1 && result.modifiedCount === 1;
        },
        async audit(row) {
          const audit = new Audit(row);
          await audit.validate();
          work.check();
          const result = await db
            .collection('auditLogs')
            .insertOne(audit.toObject(), options(work, session));
          work.check();
          if (!result.acknowledged) throw technologyUnavailable();
        },
      };
      value = await operation(tx);
      work.check();
      await work.verify();
      work.check();
      committing = true;
      await session.commitTransaction({
        timeoutMS: Math.min(2000, work.remaining()),
      });
      work.check();
    } catch (error) {
      failed = true;
      // A commit call may have reached PRIMARY. Never compensate or replay it.
      failure = committing ? technologyUnavailable() : error;
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
    // Client release is always attempted, including after an abort failure.
    if (cleanupFailed || !session.hasEnded) throw technologyUnavailable();
    if (failed) throw failure;
    return value as T;
  },
};

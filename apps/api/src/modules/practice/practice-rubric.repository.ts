import { Types, type ClientSession } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { appendRubricAudit } from '../audit/audit.repository.js';
import {
  PracticeRubricVersion,
  PracticeRubricAuthority,
  rubricDefinition,
  rubricAuthority,
  type RubricDefinition,
  type RubricAuthority,
} from './practice-rubric.model.js';

export type GradingRead = {
  session?: ClientSession;
  timeoutMS?: number;
  majority?: boolean;
};
export function gradingWriteSession(read: GradingRead): ClientSession {
  if (!read.session?.inTransaction()) throw gradingUnavailable();
  return read.session;
}
export const gradingUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Diagnostic grading is unavailable',
  );
export const gradingConflict = () =>
  new AppError(
    409,
    'PRACTICE_ASSESSMENT_CONFLICT',
    'Diagnostic request conflicts with saved identity',
  );
export const gradingHidden = () =>
  new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
export class GradingWriteConflict extends Error {}
export function gradingDatabase() {
  if (!mongoose.connection.db) throw gradingUnavailable();
  return mongoose.connection.db;
}
export function gradingOptions(read: GradingRead) {
  return {
    ...(read.session ? { session: read.session } : {}),
    ...(read.timeoutMS === undefined ? {} : { timeoutMS: read.timeoutMS }),
    ...(read.majority
      ? {
          readConcern: { level: 'majority' as const },
          readPreference: 'primary' as const,
        }
      : {}),
  };
}
const projection = (
  model: typeof PracticeRubricVersion | typeof PracticeRubricAuthority,
) => Object.fromEntries(Object.keys(model.schema.paths).map((key) => [key, 1]));
const versions = () =>
  gradingDatabase().collection<RubricDefinition>('practiceRubricVersions');
const authorities = () =>
  gradingDatabase().collection<RubricAuthority>('practiceRubricAuthorities');
const auditRecord = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  category: z.literal('CONTENT_APPROVAL'),
  action: z.enum([
    'PRACTICE_RUBRIC_AUTHORED',
    'PRACTICE_RUBRIC_APPROVED',
    'PRACTICE_RUBRIC_REVOKED',
  ]),
  actorId: z.instanceof(Types.ObjectId),
  resourceType: z.literal('PRACTICE_RUBRIC'),
  resourceId: z.instanceof(Types.ObjectId),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{1,128}(?![\s\S])/),
  metadata: z.strictObject({
    rubricVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  }),
  createdAt: z.date(),
});
export type RubricAuditAction = z.output<typeof auditRecord>['action'];
export type RubricAuditWrite = Parameters<typeof appendRubricAudit>[0];
export interface RubricStore {
  actor(
    id: string,
    role: 'ADMIN' | 'STUDENT',
    read: GradingRead,
  ): Promise<void>;
  definition(
    id: Types.ObjectId,
    version: number,
    read: GradingRead,
  ): Promise<RubricDefinition | null>;
  definitionById(
    id: Types.ObjectId,
    read: GradingRead,
  ): Promise<RubricDefinition | null>;
  lastVersion(id: Types.ObjectId, read: GradingRead): Promise<number>;
  insertDefinition(row: RubricDefinition, read: GradingRead): Promise<void>;
  authority(
    id: Types.ObjectId,
    version: number,
    read: GradingRead,
  ): Promise<RubricAuthority | null>;
  insertAuthority(row: RubricAuthority, read: GradingRead): Promise<void>;
  fence(
    row: RubricAuthority,
    read: GradingRead,
    revoke?: { actor: Types.ObjectId; time: Date; auditId: Types.ObjectId },
  ): Promise<RubricAuthority>;
  audit(row: RubricAuditWrite, read: GradingRead): Promise<void>;
  auditProof(
    definition: RubricDefinition,
    actor: Types.ObjectId,
    action: RubricAuditAction,
    time: Date,
    read: GradingRead,
    id?: Types.ObjectId,
  ): Promise<void>;
}
export const mongoRubrics: RubricStore = {
  async actor(id, role, read) {
    const row = await gradingDatabase()
      .collection('users')
      .findOne(
        { _id: new Types.ObjectId(id) },
        {
          ...gradingOptions(read),
          projection: { _id: 1, role: 1, status: 1, emailVerifiedAt: 1 },
        },
      );
    if (
      !row ||
      row.role !== role ||
      row.status !== 'ACTIVE' ||
      !(row.emailVerifiedAt instanceof Date) ||
      !Number.isFinite(row.emailVerifiedAt.getTime())
    )
      throw new AppError(
        403,
        'AUTH_FORBIDDEN',
        'Current eligible account required',
      );
  },
  async definition(id, version, read) {
    const row = await versions().findOne(
      { rubricId: id, version },
      {
        ...gradingOptions(read),
        projection: projection(PracticeRubricVersion),
      },
    );
    return row ? rubricDefinition.parse(row) : null;
  },
  async definitionById(id, read) {
    const row = await versions().findOne(
      { _id: id },
      {
        ...gradingOptions(read),
        projection: projection(PracticeRubricVersion),
      },
    );
    return row ? rubricDefinition.parse(row) : null;
  },
  async lastVersion(id, read) {
    const row = await versions().findOne(
      { rubricId: id },
      {
        ...gradingOptions(read),
        projection: { _id: 0, version: 1 },
        sort: { version: -1 },
      },
    );
    return row
      ? z
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
          .parse(row.version)
      : 0;
  },
  async insertDefinition(row, read) {
    await new PracticeRubricVersion(row).save({
      session: gradingWriteSession(read),
    });
  },
  async authority(id, version, read) {
    const row = await authorities().findOne(
      { rubricId: id, version },
      {
        ...gradingOptions(read),
        projection: projection(PracticeRubricAuthority),
      },
    );
    return row ? rubricAuthority.parse(row) : null;
  },
  async insertAuthority(row, read) {
    await new PracticeRubricAuthority(row).save({
      session: gradingWriteSession(read),
    });
  },
  async fence(row, read, revoke) {
    gradingWriteSession(read);
    if (
      row.state !== 'APPROVED' ||
      row.decisionFence >= Number.MAX_SAFE_INTEGER
    )
      throw gradingUnavailable();
    const next = rubricAuthority.parse({
      ...row,
      decisionFence: row.decisionFence + 1,
      ...(revoke
        ? {
            state: 'REVOKED',
            revokedBy: revoke.actor,
            revokedAt: revoke.time,
            revocationAuditId: revoke.auditId,
          }
        : {}),
    });
    const result = await authorities().findOneAndUpdate(
      {
        _id: row._id,
        state: 'APPROVED',
        decisionFence: row.decisionFence,
        definitionId: row.definitionId,
        definitionFingerprint: row.definitionFingerprint,
        rubricId: row.rubricId,
        version: row.version,
      },
      {
        $inc: { decisionFence: 1 },
        ...(revoke
          ? {
              $set: {
                state: next.state,
                revokedBy: next.revokedBy,
                revokedAt: next.revokedAt,
                revocationAuditId: next.revocationAuditId,
              },
            }
          : {}),
      },
      { ...gradingOptions(read), returnDocument: 'after' },
    );
    if (!result) throw new GradingWriteConflict();
    const parsed = rubricAuthority.parse(result);
    if (JSON.stringify(parsed) !== JSON.stringify(next))
      throw gradingUnavailable();
    return parsed;
  },
  async audit(row, read) {
    if (!read.session) throw gradingUnavailable();
    await appendRubricAudit(row, read.session);
  },
  async auditProof(definition, actor, action, time, read, id) {
    const rows = await gradingDatabase()
      .collection('auditLogs')
      .find(
        {
          ...(id ? { _id: id } : {}),
          category: 'CONTENT_APPROVAL',
          action,
          actorId: actor,
          resourceType: 'PRACTICE_RUBRIC',
          resourceId: definition._id,
        },
        {
          ...gradingOptions(read),
          projection: Object.fromEntries(
            Object.keys(auditRecord.shape).map((key) => [key, 1]),
          ),
        },
      )
      .limit(2)
      .toArray();
    if (rows.length !== 1) throw gradingUnavailable();
    const row = auditRecord.parse(rows[0]);
    if (
      row.metadata.rubricVersion !== definition.version ||
      row.createdAt.getTime() !== time.getTime()
    )
      throw gradingUnavailable();
  },
};

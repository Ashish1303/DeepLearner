import { Types } from 'mongoose';
import { mongoose } from '../../../config/database.js';
import { moduleProjection, moduleUnavailable } from './admin-module.dto.js';
import type { AdminModuleQuery } from './admin-module.schema.js';

export interface ModuleRead {
  signal: AbortSignal;
  remaining(): number;
  check(): void;
}
export interface AdminModuleRepository {
  parent(
    technologyId: Types.ObjectId,
    learningPathId: Types.ObjectId,
    work: ModuleRead,
  ): Promise<unknown>;
  list(
    query: AdminModuleQuery,
    work: ModuleRead,
  ): Promise<{ records: unknown[]; total: number }>;
  get(
    id: Types.ObjectId,
    technologyId: Types.ObjectId,
    learningPathId: Types.ObjectId,
    work: ModuleRead,
  ): Promise<unknown>;
}
function database() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db)
    throw moduleUnavailable();
  return mongoose.connection.db;
}
const options = (work: ModuleRead) => ({
  timeoutMS: work.remaining(),
  signal: work.signal,
  readPreference: 'primary' as const,
});
export const adminModuleRepository: AdminModuleRepository = {
  async parent(technologyId, learningPathId, work) {
    const row = await database()
      .collection('technologies')
      .findOne(
        { _id: technologyId },
        { ...options(work), projection: { _id: 1, status: 1 } },
      );
    work.check();
    if (row === null) return null;
    if (
      typeof row.status !== 'string' ||
      !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(row.status)
    )
      throw moduleUnavailable();
    const path = await database()
      .collection('learningPaths')
      .findOne(
        { _id: learningPathId, technologyId },
        {
          ...options(work),
          projection: { _id: 1, technologyId: 1, status: 1 },
        },
      );
    work.check();
    return path;
  },
  async list(query, work) {
    const [page] = await database()
      .collection('modules')
      .aggregate<{
        records: unknown[];
        count: { total: number }[];
      }>(
        [
          {
            $match: {
              technologyId: new Types.ObjectId(query.technologyId),
              learningPathId: new Types.ObjectId(query.learningPathId),
            },
          },
          {
            $facet: {
              records: [
                { $sort: { order: 1, slug: 1, _id: 1 } },
                { $skip: (query.page - 1) * query.limit },
                { $limit: query.limit },
                { $project: moduleProjection },
              ],
              count: [{ $count: 'total' }],
            },
          },
        ],
        {
          ...options(work),
          maxTimeMS: work.remaining(),
          collation: { locale: 'simple' },
        },
      )
      .toArray();
    work.check();
    if (
      !page ||
      !Array.isArray(page.records) ||
      !Array.isArray(page.count) ||
      page.count.length > 1
    )
      throw moduleUnavailable();
    return { records: page.records, total: page.count[0]?.total ?? 0 };
  },
  async get(id, technologyId, learningPathId, work) {
    const row = await database()
      .collection('modules')
      .findOne(
        { _id: id, technologyId, learningPathId },
        { ...options(work), projection: moduleProjection },
      );
    work.check();
    return row;
  },
};

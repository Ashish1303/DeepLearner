import { Types } from 'mongoose';
import { mongoose } from '../../../config/database.js';
import {
  learningPathProjection,
  learningPathUnavailable,
} from './admin-learning-path.dto.js';
import type { AdminLearningPathQuery } from './admin-learning-path.schema.js';

export interface LearningPathRead {
  signal: AbortSignal;
  remaining(): number;
  check(): void;
}
export interface AdminLearningPathRepository {
  parent(
    technologyId: Types.ObjectId,
    work: LearningPathRead,
  ): Promise<unknown>;
  list(
    query: AdminLearningPathQuery,
    work: LearningPathRead,
  ): Promise<{ records: unknown[]; total: number }>;
  get(
    id: Types.ObjectId,
    technologyId: Types.ObjectId,
    work: LearningPathRead,
  ): Promise<unknown>;
}
function database() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db)
    throw learningPathUnavailable();
  return mongoose.connection.db;
}
const options = (work: LearningPathRead) => ({
  timeoutMS: work.remaining(),
  signal: work.signal,
  readPreference: 'primary' as const,
});
export const adminLearningPathRepository: AdminLearningPathRepository = {
  async parent(technologyId, work) {
    const row = await database()
      .collection('technologies')
      .findOne(
        { _id: technologyId },
        { ...options(work), projection: { _id: 1, status: 1 } },
      );
    work.check();
    return row;
  },
  async list(query, work) {
    const [page] = await database()
      .collection('learningPaths')
      .aggregate<{
        records: unknown[];
        count: { total: number }[];
      }>(
        [
          { $match: { technologyId: new Types.ObjectId(query.technologyId) } },
          {
            $facet: {
              records: [
                { $sort: { order: 1, slug: 1, _id: 1 } },
                { $skip: (query.page - 1) * query.limit },
                { $limit: query.limit },
                { $project: learningPathProjection },
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
      throw learningPathUnavailable();
    return { records: page.records, total: page.count[0]?.total ?? 0 };
  },
  async get(id, technologyId, work) {
    const row = await database()
      .collection('learningPaths')
      .findOne(
        { _id: id, technologyId },
        { ...options(work), projection: learningPathProjection },
      );
    work.check();
    return row;
  },
};

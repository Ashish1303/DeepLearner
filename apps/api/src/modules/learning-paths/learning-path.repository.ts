import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { Technology } from '../technologies/technology.model.js';
import { LearningPath } from './learning-path.model.js';
import {
  learningPathDto,
  type LearningPathDto,
  type ProjectedLearningPath,
} from './learning-path.dto.js';
import type { LearningPathQuery } from './learning-path.schema.js';

const projection = {
  _id: 1,
  technologyId: 1,
  title: 1,
  slug: 1,
  description: 1,
  targetLevel: 1,
  completionScore: 1,
  order: 1,
};
interface Page {
  items: ProjectedLearningPath[];
  count: { total: number }[];
}
export interface LearningPathRepository {
  list(
    query: LearningPathQuery,
  ): Promise<{ items: LearningPathDto[]; total: number } | null>;
  detail(id: string): Promise<LearningPathDto | null>;
}
function unavailable() {
  return new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Learning paths are temporarily unavailable',
  );
}
export const learningPathRepository: LearningPathRepository = {
  async list({ technologyId, page, limit }) {
    try {
      // Starting at the parent distinguishes an unavailable Technology from an empty path list.
      // Visibility and pagination/count are evaluated in the same read pipeline.
      const [parent] = await Technology.aggregate<{ paths: Page[] }>([
        {
          $match: {
            _id: new Types.ObjectId(technologyId),
            status: 'PUBLISHED',
          },
        },
        {
          $lookup: {
            from: LearningPath.collection.name,
            localField: '_id',
            foreignField: 'technologyId',
            pipeline: [
              { $match: { status: 'PUBLISHED' } },
              {
                $facet: {
                  items: [
                    { $sort: { order: 1, slug: 1 } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    { $project: projection },
                  ],
                  count: [{ $count: 'total' }],
                },
              },
            ],
            as: 'paths',
          },
        },
        { $project: { _id: 0, paths: 1 } },
      ]).exec();
      if (!parent) return null;
      const result = parent.paths[0];
      return {
        items: (result?.items ?? []).map(learningPathDto),
        total: result?.count[0]?.total ?? 0,
      };
    } catch {
      throw unavailable();
    }
  },
  async detail(id) {
    try {
      const [record] = await LearningPath.aggregate<ProjectedLearningPath>([
        { $match: { _id: new Types.ObjectId(id), status: 'PUBLISHED' } },
        {
          $lookup: {
            from: Technology.collection.name,
            localField: 'technologyId',
            foreignField: '_id',
            pipeline: [
              { $match: { status: 'PUBLISHED' } },
              { $project: { _id: 1 } },
            ],
            as: 'parent',
          },
        },
        { $match: { 'parent.0': { $exists: true } } },
        { $project: projection },
      ]).exec();
      return record ? learningPathDto(record) : null;
    } catch {
      throw unavailable();
    }
  },
};

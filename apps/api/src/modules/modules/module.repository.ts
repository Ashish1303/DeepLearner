import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { Technology } from '../technologies/technology.model.js';
import { LearningPath } from '../learning-paths/learning-path.model.js';
import { Module } from './module.model.js';
import {
  moduleDto,
  type ModuleDto,
  type ProjectedModule,
} from './module.dto.js';
import type { ModuleQuery } from './module.schema.js';

const projection = {
  _id: 1,
  technologyId: 1,
  learningPathId: 1,
  title: 1,
  slug: 1,
  description: 1,
  order: 1,
};
interface Page {
  items: ProjectedModule[];
  count: { total: number }[];
}
export interface ModuleRepository {
  list(
    query: ModuleQuery,
  ): Promise<{ items: ModuleDto[]; total: number } | null>;
  detail(id: string): Promise<ModuleDto | null>;
}
function unavailable() {
  return new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Modules are temporarily unavailable',
  );
}
// Both reads require a published Technology; missing ancestors are never visible.
function publishedTechnology() {
  return [
    {
      $lookup: {
        from: Technology.collection.name,
        localField: 'technologyId',
        foreignField: '_id',
        pipeline: [
          { $match: { status: 'PUBLISHED' } },
          { $project: { _id: 1 } },
        ],
        as: 'technology',
      },
    },
    { $match: { 'technology.0': { $exists: true } } },
  ];
}
export const moduleRepository: ModuleRepository = {
  async list({ learningPathId, page, limit }) {
    try {
      // Parent-first distinguishes an unavailable hierarchy from an empty module list.
      const [parent] = await LearningPath.aggregate<{ modules: Page[] }>([
        {
          $match: {
            _id: new Types.ObjectId(learningPathId),
            status: 'PUBLISHED',
          },
        },
        ...publishedTechnology(),
        {
          $lookup: {
            from: Module.collection.name,
            localField: '_id',
            foreignField: 'learningPathId',
            let: { technologyId: '$technologyId' },
            pipeline: [
              {
                $match: {
                  status: 'PUBLISHED',
                  $expr: { $eq: ['$technologyId', '$$technologyId'] },
                },
              },
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
            as: 'modules',
          },
        },
        { $project: { _id: 0, modules: 1 } },
      ]).exec();
      if (!parent) return null;
      const result = parent.modules[0];
      return {
        items: (result?.items ?? []).map(moduleDto),
        total: result?.count[0]?.total ?? 0,
      };
    } catch {
      throw unavailable();
    }
  },
  async detail(id) {
    try {
      const [record] = await Module.aggregate<ProjectedModule>([
        { $match: { _id: new Types.ObjectId(id), status: 'PUBLISHED' } },
        {
          $lookup: {
            from: LearningPath.collection.name,
            localField: 'learningPathId',
            foreignField: '_id',
            let: { technologyId: '$technologyId' },
            pipeline: [
              {
                $match: {
                  status: 'PUBLISHED',
                  $expr: { $eq: ['$technologyId', '$$technologyId'] },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: 'parent',
          },
        },
        { $match: { 'parent.0': { $exists: true } } },
        ...publishedTechnology(),
        { $project: projection },
      ]).exec();
      return record ? moduleDto(record) : null;
    } catch {
      throw unavailable();
    }
  },
};

import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { Technology } from '../technologies/technology.model.js';
import { LearningPath } from '../learning-paths/learning-path.model.js';
import { Module } from '../modules/module.model.js';
import { Topic } from './topic.model.js';
import { topicDto, type TopicDto, type ProjectedTopic } from './topic.dto.js';
import type { TopicQuery } from './topic.schema.js';

const projection = {
  _id: 1,
  technologyId: 1,
  learningPathId: 1,
  moduleId: 1,
  title: 1,
  slug: 1,
  description: 1,
  order: 1,
};
interface Page {
  items: ProjectedTopic[];
  count: { total: number }[];
}
export interface TopicRepository {
  list(query: TopicQuery): Promise<{ items: TopicDto[]; total: number } | null>;
  detail(id: string): Promise<TopicDto | null>;
}
function unavailable() {
  return new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Topics are temporarily unavailable',
  );
}
// Works on either a Module or a Topic after its Module relationship is verified.
function publishedAncestors() {
  return [
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
        as: 'path',
      },
    },
    { $match: { 'path.0': { $exists: true } } },
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
export const topicRepository: TopicRepository = {
  async list({ moduleId, page, limit }) {
    try {
      // Validate the parent chain first; distinguish a hidden parent from an empty list.
      const [parent] = await Module.aggregate<{ topics: Page[] }>([
        { $match: { _id: new Types.ObjectId(moduleId), status: 'PUBLISHED' } },
        ...publishedAncestors(),
        {
          $lookup: {
            from: Topic.collection.name,
            localField: '_id',
            foreignField: 'moduleId',
            let: {
              technologyId: '$technologyId',
              learningPathId: '$learningPathId',
            },
            pipeline: [
              {
                $match: {
                  status: 'PUBLISHED',
                  $expr: {
                    $and: [
                      { $eq: ['$technologyId', '$$technologyId'] },
                      { $eq: ['$learningPathId', '$$learningPathId'] },
                    ],
                  },
                },
              },
              // Visibility and consistency precede both branches: hidden rows cannot inflate totals.
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
            as: 'topics',
          },
        },
        { $project: { _id: 0, topics: 1 } },
      ]).exec();
      if (!parent) return null;
      const result = parent.topics[0];
      return {
        items: (result?.items ?? []).map(topicDto),
        total: result?.count[0]?.total ?? 0,
      };
    } catch {
      throw unavailable();
    }
  },
  async detail(id) {
    try {
      const [record] = await Topic.aggregate<ProjectedTopic>([
        { $match: { _id: new Types.ObjectId(id), status: 'PUBLISHED' } },
        {
          $lookup: {
            from: Module.collection.name,
            localField: 'moduleId',
            foreignField: '_id',
            let: {
              technologyId: '$technologyId',
              learningPathId: '$learningPathId',
            },
            pipeline: [
              {
                $match: {
                  status: 'PUBLISHED',
                  $expr: {
                    $and: [
                      { $eq: ['$technologyId', '$$technologyId'] },
                      { $eq: ['$learningPathId', '$$learningPathId'] },
                    ],
                  },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: 'parent',
          },
        },
        { $match: { 'parent.0': { $exists: true } } },
        ...publishedAncestors(),
        { $project: projection },
      ]).exec();
      return record ? topicDto(record) : null;
    } catch {
      throw unavailable();
    }
  },
};

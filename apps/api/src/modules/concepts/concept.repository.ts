import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { Technology } from '../technologies/technology.model.js';
import { LearningPath } from '../learning-paths/learning-path.model.js';
import { Module } from '../modules/module.model.js';
import { Topic } from '../topics/topic.model.js';
import { Concept } from './concept.model.js';
import {
  conceptSummaryDto,
  conceptDetailDto,
  type ConceptSummaryDto,
  type ConceptDetailDto,
  type ProjectedConceptSummary,
  type ProjectedConceptDetail,
} from './concept.dto.js';
import type { ConceptQuery } from './concept.schema.js';
const identityProjection = {
  _id: 1,
  technologyId: 1,
  learningPathId: 1,
  moduleId: 1,
  topicId: 1,
  title: 1,
  slug: 1,
  difficulty: 1,
  order: 1,
};
const summaryProjection = { ...identityProjection, 'read.summary': 1 };
const detailProjection = {
  ...identityProjection,
  contentFormat: 1,
  schemaVersion: 1,
  'read.summary': 1,
  'read.bodyMarkdown': 1,
  'source.label': 1,
  'source.url': 1,
  'source.sourceType': 1,
  'source.isOfficial': 1,
  'examples.title': 1,
  'examples.bodyMarkdown': 1,
  'revise.summary': 1,
  'revise.keyPoints': 1,
  'revise.memoryTrick': 1,
  'revise.importantCodeMarkdown': 1,
};
interface Page {
  items: ProjectedConceptSummary[];
  count: { total: number }[];
}
export interface ConceptRepository {
  list(
    query: ConceptQuery,
  ): Promise<{ items: ConceptSummaryDto[]; total: number } | null>;
  detail(id: string): Promise<ConceptDetailDto | null>;
}
function unavailable() {
  return new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Concepts are temporarily unavailable',
  );
}
// Each ancestor must be published and share every reference carried by its child.
function publishedParent(
  from: string,
  localField: string,
  fields: string[],
  as: string,
) {
  return [
    {
      $lookup: {
        from,
        localField,
        foreignField: '_id',
        let: Object.fromEntries(fields.map((field) => [field, '$' + field])),
        pipeline: [
          {
            $match: {
              status: 'PUBLISHED',
              ...(fields.length
                ? {
                    $expr: {
                      $and: fields.map((field) => ({
                        $eq: ['$' + field, '$$' + field],
                      })),
                    },
                  }
                : {}),
            },
          },
          { $project: { _id: 1 } },
        ],
        as,
      },
    },
    { $match: { [as + '.0']: { $exists: true } } },
  ];
}
function publishedAncestors() {
  return [
    ...publishedParent(
      Module.collection.name,
      'moduleId',
      ['technologyId', 'learningPathId'],
      'module',
    ),
    ...publishedParent(
      LearningPath.collection.name,
      'learningPathId',
      ['technologyId'],
      'path',
    ),
    ...publishedParent(
      Technology.collection.name,
      'technologyId',
      [],
      'technology',
    ),
  ];
}
export const conceptRepository: ConceptRepository = {
  async list({ topicId, page, limit }) {
    try {
      const [parent] = await Topic.aggregate<{ concepts: Page[] }>([
        { $match: { _id: new Types.ObjectId(topicId), status: 'PUBLISHED' } },
        ...publishedAncestors(),
        {
          $lookup: {
            from: Concept.collection.name,
            localField: '_id',
            foreignField: 'topicId',
            let: {
              technologyId: '$technologyId',
              learningPathId: '$learningPathId',
              moduleId: '$moduleId',
            },
            pipeline: [
              {
                $match: {
                  status: 'PUBLISHED',
                  $expr: {
                    $and: [
                      { $eq: ['$technologyId', '$$technologyId'] },
                      { $eq: ['$learningPathId', '$$learningPathId'] },
                      { $eq: ['$moduleId', '$$moduleId'] },
                    ],
                  },
                },
              },
              // One filtered input for results and totals, including all reference checks.
              {
                $facet: {
                  items: [
                    { $sort: { order: 1, slug: 1 } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    { $project: summaryProjection },
                  ],
                  count: [{ $count: 'total' }],
                },
              },
            ],
            as: 'concepts',
          },
        },
        { $project: { _id: 0, concepts: 1 } },
      ]).exec();
      if (!parent) return null;
      const result = parent.concepts[0];
      return {
        items: (result?.items ?? []).map(conceptSummaryDto),
        total: result?.count[0]?.total ?? 0,
      };
    } catch {
      throw unavailable();
    }
  },
  async detail(id) {
    try {
      const [record] = await Concept.aggregate<ProjectedConceptDetail>([
        { $match: { _id: new Types.ObjectId(id), status: 'PUBLISHED' } },
        ...publishedParent(
          Topic.collection.name,
          'topicId',
          ['technologyId', 'learningPathId', 'moduleId'],
          'topic',
        ),
        ...publishedAncestors(),
        { $project: detailProjection },
      ]).exec();
      return record ? conceptDetailDto(record) : null;
    } catch {
      throw unavailable();
    }
  },
};

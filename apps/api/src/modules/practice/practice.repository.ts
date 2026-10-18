import type { PipelineStage } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { Concept } from '../concepts/concept.model.js';
import { publishedConceptStages } from '../concepts/concept.repository.js';
import { PracticeQuestion } from './practice-question.model.js';
import {
  practiceDto,
  type PracticeDto,
  type ProjectedPractice,
} from './practice.dto.js';
import type { PracticeQuery } from './practice.schema.js';
export interface PracticeRepository {
  list(
    query: PracticeQuery,
  ): Promise<{ items: PracticeDto[]; total: number } | null>;
}
export function practiceStages({
  conceptId,
  type,
  page,
  limit,
}: PracticeQuery): PipelineStage[] {
  return [
    ...publishedConceptStages(conceptId),
    {
      $lookup: {
        from: PracticeQuestion.collection.name,
        localField: '_id',
        foreignField: 'conceptId',
        let: { topicId: '$topicId', technologyId: '$technologyId' },
        pipeline: [
          {
            $match: {
              type,
              status: 'PUBLISHED',
              schemaVersion: 1,
              $expr: {
                $and: [
                  { $eq: ['$topicId', '$$topicId'] },
                  { $eq: ['$technologyId', '$$technologyId'] },
                ],
              },
            },
          },
          {
            $project: {
              _id: 1,
              conceptId: 1,
              type: 1,
              difficulty: 1,
              prompt: 1,
              starterCode: 1,
              language: 1,
            },
          },
          {
            $facet: {
              items: [
                { $sort: { _id: 1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit },
              ],
              count: [{ $count: 'total' }],
            },
          },
        ],
        as: 'questions',
      },
    },
    { $project: { _id: 0, questions: 1 } },
  ];
}
export const practiceRepository: PracticeRepository = {
  async list(query) {
    try {
      const [parent] = await Concept.aggregate<{
        questions: { items: ProjectedPractice[]; count: { total: number }[] }[];
      }>(practiceStages(query)).exec();
      if (!parent) return null;
      const result = parent.questions[0];
      const total = result?.count[0]?.total ?? 0;
      if (!Number.isSafeInteger(total) || total < 0)
        throw new Error('Invalid count');
      const items = (result?.items ?? []).map(practiceDto);
      if (
        items.some(
          (item) =>
            item.conceptId !== query.conceptId || item.type !== query.type,
        )
      )
        throw new Error('Invalid parent');
      return { items, total };
    } catch {
      throw new AppError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Practice is temporarily unavailable',
      );
    }
  },
};

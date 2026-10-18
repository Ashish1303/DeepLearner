import { Types, type PipelineStage, type ClientSession } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { Concept } from '../concepts/concept.model.js';
import { publishedConceptStages } from '../concepts/concept.repository.js';
import { PracticeQuestion } from './practice-question.model.js';
import {
  practiceDto,
  qualifiedPractice,
  type QualifiedPractice,
  type PracticeDto,
  type ProjectedPractice,
} from './practice.dto.js';
import type { PracticeQuery } from './practice.schema.js';
export interface PracticeRepository {
  qualified(
    questionId: string,
    conceptId: string,
    session?: ClientSession,
    timeoutMS?: number,
    majority?: boolean,
  ): Promise<QualifiedPractice | null>;
  list(
    query: PracticeQuery,
  ): Promise<{ items: PracticeDto[]; total: number } | null>;
}
function questionMatch(
  type: PracticeQuery['type'] | { $in: PracticeQuery['type'][] },
) {
  return {
    type,
    status: 'PUBLISHED',
    schemaVersion: 1,
    $expr: {
      $and: [
        { $eq: ['$topicId', '$$topicId'] },
        { $eq: ['$technologyId', '$$technologyId'] },
      ],
    },
  };
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
            $match: questionMatch(type),
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
export function practiceUnlockStages(
  questionId: string,
  conceptId: string,
): PipelineStage[] {
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
              ...questionMatch({
                $in: ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'],
              }),
              _id: new Types.ObjectId(questionId),
            },
          },
          {
            $project: {
              _id: 1,
              conceptId: 1,
              type: 1,
              answer: 1,
              explanation: 1,
              difficulty: 1,
              prompt: 1,
              starterCode: 1,
              language: 1,
              topicId: 1,
              technologyId: 1,
              schemaVersion: 1,
            },
          },
        ],
        as: 'unlock',
      },
    },
    { $project: { _id: 0, unlock: 1, moduleId: 1, learningPathId: 1 } },
  ];
}
export const practiceRepository: PracticeRepository = {
  async qualified(questionId, conceptId, session, timeoutMS, majority = false) {
    try {
      const [parent] = await Concept.aggregate<{
        unlock: ProjectedPractice[];
        moduleId: Types.ObjectId;
        learningPathId: Types.ObjectId;
      }>(practiceUnlockStages(questionId, conceptId))
        .option({
          ...(session ? { session } : {}),
          ...(timeoutMS ? { timeoutMS } : {}),
          readPreference: 'primary',
          ...(majority ? { readConcern: { level: 'majority' } } : {}),
        })
        .exec();
      if (!parent || !parent.unlock.length) return null;
      if (parent.unlock.length !== 1) throw new Error('Invalid result');
      const answer = qualifiedPractice(parent.unlock[0]!, parent);
      if (answer.data.id !== questionId || answer.data.conceptId !== conceptId)
        throw new Error('Invalid identity');
      return answer;
    } catch {
      throw new AppError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Practice is temporarily unavailable',
      );
    }
  },
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

import type { Types } from 'mongoose';
export interface ProjectedLearningPath {
  _id: Types.ObjectId;
  technologyId: Types.ObjectId;
  title: string;
  slug: string;
  description?: string | null;
  targetLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null;
  completionScore: number;
  order: number;
}
export function learningPathDto(record: ProjectedLearningPath) {
  return {
    id: record._id.toHexString(),
    technologyId: record.technologyId.toHexString(),
    title: record.title,
    slug: record.slug,
    description: record.description ?? null,
    targetLevel: record.targetLevel ?? null,
    completionScore: record.completionScore,
    order: record.order,
  };
}
export type LearningPathDto = ReturnType<typeof learningPathDto>;

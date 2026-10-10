import type { Types } from 'mongoose';
export interface ProjectedTopic {
  _id: Types.ObjectId;
  technologyId: Types.ObjectId;
  learningPathId: Types.ObjectId;
  moduleId: Types.ObjectId;
  title: string;
  slug: string;
  description?: string | null;
  order: number;
}
export function topicDto(record: ProjectedTopic) {
  return {
    id: record._id.toHexString(),
    technologyId: record.technologyId.toHexString(),
    learningPathId: record.learningPathId.toHexString(),
    moduleId: record.moduleId.toHexString(),
    title: record.title,
    slug: record.slug,
    description: record.description ?? null,
    order: record.order,
  };
}
export type TopicDto = ReturnType<typeof topicDto>;

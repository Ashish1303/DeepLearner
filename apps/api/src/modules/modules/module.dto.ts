import type { Types } from 'mongoose';
export interface ProjectedModule {
  _id: Types.ObjectId;
  technologyId: Types.ObjectId;
  learningPathId: Types.ObjectId;
  title: string;
  slug: string;
  description?: string | null;
  order: number;
}
export function moduleDto(record: ProjectedModule) {
  return {
    id: record._id.toHexString(),
    technologyId: record.technologyId.toHexString(),
    learningPathId: record.learningPathId.toHexString(),
    title: record.title,
    slug: record.slug,
    description: record.description ?? null,
    order: record.order,
  };
}
export type ModuleDto = ReturnType<typeof moduleDto>;

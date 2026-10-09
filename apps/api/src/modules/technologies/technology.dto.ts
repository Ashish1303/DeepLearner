import type { Types } from 'mongoose';
export interface ProjectedTechnology {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string | null;
  iconAssetId?: Types.ObjectId | null;
  order: number;
}
export function technologyDto(record: ProjectedTechnology) {
  return {
    id: record._id.toHexString(),
    name: record.name,
    slug: record.slug,
    description: record.description ?? null,
    iconAssetId: record.iconAssetId?.toHexString() ?? null,
    order: record.order,
  };
}
export type TechnologyDto = ReturnType<typeof technologyDto>;

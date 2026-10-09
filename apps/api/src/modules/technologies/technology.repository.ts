import { AppError } from '../../common/errors/app-error.js';
import { Technology } from './technology.model.js';
import {
  technologyDto,
  type ProjectedTechnology,
  type TechnologyDto,
} from './technology.dto.js';
import type { TechnologyQuery } from './technology.schema.js';
export interface TechnologyRepository {
  list(
    query: TechnologyQuery,
  ): Promise<{ items: TechnologyDto[]; total: number }>;
}
export const technologyRepository: TechnologyRepository = {
  async list({ page, limit }) {
    try {
      const filter = { status: 'PUBLISHED' as const };
      const [records, total] = await Promise.all([
        Technology.find(filter)
          .select({
            _id: 1,
            name: 1,
            slug: 1,
            description: 1,
            iconAssetId: 1,
            order: 1,
          })
          .sort({ order: 1, slug: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean<ProjectedTechnology[]>()
          .exec(),
        Technology.countDocuments(filter).exec(),
      ]);
      return { items: records.map(technologyDto), total };
    } catch {
      throw new AppError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Technology catalog is temporarily unavailable',
      );
    }
  },
};

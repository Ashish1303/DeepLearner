import { Types } from 'mongoose';
import { AppError } from '../../../common/errors/app-error.js';
import type { AuthContext } from '../../auth/access-token.service.js';
import {
  adminModuleDto,
  moduleUnavailable,
  validateModuleParent,
  type AdminModuleDto,
} from './admin-module.dto.js';
import {
  adminModuleRepository,
  type AdminModuleRepository,
  type ModuleRead,
} from './admin-module.repository.js';
import {
  adminModuleId,
  adminModuleQuery,
  type AdminModuleQuery,
} from './admin-module.schema.js';

export const moduleReadBudgetMs = 10000;
export interface ModuleAuthority {
  actor: AuthContext | undefined;
  signal?: AbortSignal;
}
const missing = (detail: boolean) =>
  new AppError(
    404,
    detail ? 'MODULE_NOT_FOUND' : 'LEARNING_PATH_NOT_FOUND',
    'Module or Technology is unavailable',
  );
const safeErrors: Record<string, readonly [number, string]> = {
  VALIDATION_ERROR: [400, 'Invalid Module request'],
  LEARNING_PATH_NOT_FOUND: [404, 'Learning Path is unavailable'],
  MODULE_NOT_FOUND: [404, 'Module is unavailable'],
};
function invalid() {
  return new AppError(400, 'VALIDATION_ERROR', 'Invalid Module request');
}
function compare(a: AdminModuleDto, b: AdminModuleDto) {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  if (a.slug !== b.slug) return a.slug < b.slug ? -1 : 1;
  return a.id < b.id ? -1 : a.id === b.id ? 0 : 1;
}
export function createAdminModuleService(
  repository: AdminModuleRepository = adminModuleRepository,
  clock = () => performance.now(),
) {
  async function run<T>(
    authority: ModuleAuthority,
    operation: (work: ModuleRead) => Promise<T>,
  ): Promise<T> {
    if (!authority.actor)
      throw new AppError(
        401,
        'AUTH_ACCESS_TOKEN_MISSING',
        'Access token required',
      );
    if (authority.actor.role !== 'ADMIN')
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Admin access required');
    if (
      ![authority.actor.sub, authority.actor.sid].every((id) =>
        /^[a-f0-9]{24}(?![\s\S])/.test(id),
      )
    )
      throw moduleUnavailable();
    const start = clock();
    const abort = new AbortController();
    let closed = false;
    let rejectLoss: (reason: Error) => void = () => {};
    const loss = new Promise<never>((_, reject) => {
      rejectLoss = reject;
    });
    const lose = () => {
      closed = true;
      abort.abort();
      rejectLoss(moduleUnavailable());
    };
    const work: ModuleRead = {
      signal: abort.signal,
      remaining() {
        const elapsed = clock() - start,
          remaining = Math.floor(moduleReadBudgetMs - elapsed);
        if (
          closed ||
          authority.signal?.aborted ||
          !Number.isFinite(elapsed) ||
          elapsed < 0 ||
          remaining < 1
        )
          throw moduleUnavailable();
        return remaining;
      },
      check() {
        work.remaining();
      },
    };
    authority.signal?.addEventListener('abort', lose, { once: true });
    const timer = setTimeout(lose, moduleReadBudgetMs);
    try {
      work.check();
      const pending = Promise.resolve().then(() => {
        work.check();
        return operation(work);
      });
      const value = await Promise.race([pending, loss]);
      work.check();
      return value;
    } catch (error) {
      if (error instanceof AppError && Object.hasOwn(safeErrors, error.code)) {
        const [status, message] = safeErrors[error.code]!;
        throw new AppError(status, error.code, message);
      }
      throw moduleUnavailable();
    } finally {
      closed = true;
      abort.abort();
      clearTimeout(timer);
      authority.signal?.removeEventListener('abort', lose);
    }
  }
  async function parent(
    technologyId: string,
    learningPathId: string,
    work: ModuleRead,
    detail: boolean,
  ) {
    work.check();
    const value = await repository.parent(
      new Types.ObjectId(technologyId),
      new Types.ObjectId(learningPathId),
      work,
    );
    work.check();
    if (value === null) throw missing(detail);
    validateModuleParent(value, technologyId, learningPathId);
  }
  return {
    list(query: AdminModuleQuery, authority: ModuleAuthority) {
      const parsed = adminModuleQuery.safeParse({
        ...query,
        page: String(query.page),
        limit: String(query.limit),
      });
      if (!parsed.success) throw invalid();
      const input = parsed.data;
      return run(authority, async (work) => {
        await parent(input.technologyId, input.learningPathId, work, false);
        const page = await repository.list(input, work);
        work.check();
        if (
          !Array.isArray(page.records) ||
          !Number.isSafeInteger(page.total) ||
          page.total < 0 ||
          page.records.length > input.limit
        )
          throw moduleUnavailable();
        const items = page.records.map(adminModuleDto),
          offset = (input.page - 1) * input.limit;
        if (
          items.some(
            (row, i) =>
              row.technologyId !== input.technologyId ||
              row.learningPathId !== input.learningPathId ||
              (i > 0 && compare(items[i - 1]!, row) >= 0),
          ) ||
          new Set(items.map((row) => row.id)).size !== items.length ||
          new Set(items.map((row) => row.slug)).size !== items.length ||
          items.length !==
            Math.min(input.limit, Math.max(0, page.total - offset))
        )
          throw moduleUnavailable();
        await parent(input.technologyId, input.learningPathId, work, false);
        return {
          items,
          pagination: {
            page: input.page,
            limit: input.limit,
            total: page.total,
            totalPages: Math.ceil(page.total / input.limit),
          },
        };
      });
    },
    get(
      id: string,
      technologyId: string,
      learningPathId: string,
      authority: ModuleAuthority,
    ) {
      const key = adminModuleId.safeParse(id),
        owner = adminModuleId.safeParse(technologyId),
        path = adminModuleId.safeParse(learningPathId);
      if (!key.success || !owner.success || !path.success) throw invalid();
      return run(authority, async (work) => {
        await parent(owner.data, path.data, work, true);
        const value = await repository.get(
          new Types.ObjectId(key.data),
          new Types.ObjectId(owner.data),
          new Types.ObjectId(path.data),
          work,
        );
        work.check();
        if (value === null) throw missing(true);
        const row = adminModuleDto(value);
        if (
          row.id !== key.data ||
          row.technologyId !== owner.data ||
          row.learningPathId !== path.data
        )
          throw moduleUnavailable();
        await parent(owner.data, path.data, work, true);
        return row;
      });
    },
  };
}
export type AdminModuleService = ReturnType<typeof createAdminModuleService>;

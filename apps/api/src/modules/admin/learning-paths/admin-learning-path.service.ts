import { Types } from 'mongoose';
import { AppError } from '../../../common/errors/app-error.js';
import type { AuthContext } from '../../auth/access-token.service.js';
import {
  adminLearningPathDto,
  learningPathUnavailable,
  validateLearningPathParent,
  type AdminLearningPathDto,
} from './admin-learning-path.dto.js';
import {
  adminLearningPathRepository,
  type AdminLearningPathRepository,
  type LearningPathRead,
} from './admin-learning-path.repository.js';
import {
  adminLearningPathId,
  adminLearningPathQuery,
  type AdminLearningPathQuery,
} from './admin-learning-path.schema.js';

export const learningPathReadBudgetMs = 10000;
export interface LearningPathAuthority {
  actor: AuthContext | undefined;
  signal?: AbortSignal;
}
const missing = (detail: boolean) =>
  new AppError(
    404,
    detail ? 'LEARNING_PATH_NOT_FOUND' : 'TECHNOLOGY_NOT_FOUND',
    'Learning Path or Technology is unavailable',
  );
const safeErrors: Record<string, readonly [number, string]> = {
  VALIDATION_ERROR: [400, 'Invalid Learning Path request'],
  TECHNOLOGY_NOT_FOUND: [404, 'Technology is unavailable'],
  LEARNING_PATH_NOT_FOUND: [404, 'Learning Path is unavailable'],
};
function invalid() {
  return new AppError(400, 'VALIDATION_ERROR', 'Invalid Learning Path request');
}
function compare(a: AdminLearningPathDto, b: AdminLearningPathDto) {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  if (a.slug !== b.slug) return a.slug < b.slug ? -1 : 1;
  return a.id < b.id ? -1 : a.id === b.id ? 0 : 1;
}
export function createAdminLearningPathService(
  repository: AdminLearningPathRepository = adminLearningPathRepository,
  clock = () => performance.now(),
) {
  async function run<T>(
    authority: LearningPathAuthority,
    operation: (work: LearningPathRead) => Promise<T>,
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
      throw learningPathUnavailable();
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
      rejectLoss(learningPathUnavailable());
    };
    const work: LearningPathRead = {
      signal: abort.signal,
      remaining() {
        const elapsed = clock() - start,
          remaining = Math.floor(learningPathReadBudgetMs - elapsed);
        if (
          closed ||
          authority.signal?.aborted ||
          !Number.isFinite(elapsed) ||
          elapsed < 0 ||
          remaining < 1
        )
          throw learningPathUnavailable();
        return remaining;
      },
      check() {
        work.remaining();
      },
    };
    authority.signal?.addEventListener('abort', lose, { once: true });
    const timer = setTimeout(lose, learningPathReadBudgetMs);
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
      throw learningPathUnavailable();
    } finally {
      closed = true;
      abort.abort();
      clearTimeout(timer);
      authority.signal?.removeEventListener('abort', lose);
    }
  }
  async function parent(
    technologyId: string,
    work: LearningPathRead,
    detail: boolean,
  ) {
    work.check();
    const value = await repository.parent(
      new Types.ObjectId(technologyId),
      work,
    );
    work.check();
    if (value === null) throw missing(detail);
    validateLearningPathParent(value, technologyId);
  }
  return {
    list(query: AdminLearningPathQuery, authority: LearningPathAuthority) {
      const parsed = adminLearningPathQuery.safeParse({
        ...query,
        page: String(query.page),
        limit: String(query.limit),
      });
      if (!parsed.success) throw invalid();
      const input = parsed.data;
      return run(authority, async (work) => {
        await parent(input.technologyId, work, false);
        const page = await repository.list(input, work);
        work.check();
        if (
          !Array.isArray(page.records) ||
          !Number.isSafeInteger(page.total) ||
          page.total < 0 ||
          page.records.length > input.limit
        )
          throw learningPathUnavailable();
        const items = page.records.map(adminLearningPathDto),
          offset = (input.page - 1) * input.limit;
        if (
          items.some(
            (row, i) =>
              row.technologyId !== input.technologyId ||
              (i > 0 && compare(items[i - 1]!, row) >= 0),
          ) ||
          new Set(items.map((row) => row.id)).size !== items.length ||
          new Set(items.map((row) => row.slug)).size !== items.length ||
          items.length !==
            Math.min(input.limit, Math.max(0, page.total - offset))
        )
          throw learningPathUnavailable();
        await parent(input.technologyId, work, false);
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
    get(id: string, technologyId: string, authority: LearningPathAuthority) {
      const key = adminLearningPathId.safeParse(id),
        owner = adminLearningPathId.safeParse(technologyId);
      if (!key.success || !owner.success) throw invalid();
      return run(authority, async (work) => {
        await parent(owner.data, work, true);
        const value = await repository.get(
          new Types.ObjectId(key.data),
          new Types.ObjectId(owner.data),
          work,
        );
        work.check();
        if (value === null) throw missing(true);
        const row = adminLearningPathDto(value);
        if (row.id !== key.data || row.technologyId !== owner.data)
          throw learningPathUnavailable();
        await parent(owner.data, work, true);
        return row;
      });
    },
  };
}
export type AdminLearningPathService = ReturnType<
  typeof createAdminLearningPathService
>;

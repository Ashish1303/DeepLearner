import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../../common/errors/app-error.js';
import type { AuthContext } from '../../auth/access-token.service.js';
import {
  adminTechnologyDto,
  technologyUnavailable,
} from './admin-technology.dto.js';
import {
  adminTechnologyRepository,
  type AdminTechnologyRepository,
  type TechnologyWork,
} from './admin-technology.repository.js';
import {
  adminTechnologyQuery,
  createTechnologyInput,
  patchTechnologyInput,
  technologyId,
  type AdminTechnologyQuery,
  type CreateTechnologyInput,
  type PatchTechnologyInput,
} from './admin-technology.schema.js';

export const technologyBudgetMs = 10000;
export interface TechnologyAuthority {
  actor: AuthContext | undefined;
  verify: () => Promise<AuthContext>;
  signal?: AbortSignal;
}
const conflict = (code: string) =>
  new AppError(409, code, 'Technology change conflicts with current state');
const forbidden = () =>
  new AppError(403, 'AUTH_FORBIDDEN', 'Admin access required');
const notFound = () =>
  new AppError(404, 'TECHNOLOGY_NOT_FOUND', 'Technology is unavailable');
const publicFailures: Record<string, readonly [number, string]> = {
  AUTH_ACCESS_TOKEN_MISSING: [401, 'Access token required'],
  AUTH_ACCESS_TOKEN_INVALID: [401, 'Access token is invalid or expired'],
  AUTH_ACCESS_TOKEN_EXPIRED: [401, 'Access token is invalid or expired'],
  AUTH_FORBIDDEN: [403, 'Admin access required'],
  VALIDATION_ERROR: [400, 'Invalid technology request'],
  TECHNOLOGY_NOT_FOUND: [404, 'Technology is unavailable'],
  TECHNOLOGY_REVISION_CONFLICT: [
    409,
    'Technology change conflicts with current state',
  ],
  TECHNOLOGY_READ_ONLY: [409, 'Technology change conflicts with current state'],
};
const account = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  role: z.enum(['ADMIN', 'STUDENT']),
  status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED', 'PENDING_VERIFICATION']),
  emailVerifiedAt: z.date().nullable().optional(),
  __v: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid technology request');
  return result.data;
}
function slugCollision(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const row = error as { code?: unknown; keyPattern?: unknown };
  return row.code === 11000 && JSON.stringify(row.keyPattern) === '{"slug":1}';
}

export function createAdminTechnologyService(
  repository: AdminTechnologyRepository = adminTechnologyRepository,
  clock = () => performance.now(),
  utc = () => new Date(),
) {
  async function run<T>(
    authority: TechnologyAuthority,
    operation: (work: TechnologyWork, actor: AuthContext) => Promise<T>,
  ): Promise<T> {
    const actor = authority.actor;
    if (!actor)
      throw new AppError(
        401,
        'AUTH_ACCESS_TOKEN_MISSING',
        'Access token required',
      );
    if (actor.role !== 'ADMIN') throw forbidden();
    if (![actor.sub, actor.sid].every((id) => /^[a-f0-9]{24}$/.test(id)))
      throw technologyUnavailable();
    const started = clock();
    const abort = new AbortController();
    let closed = false;
    let rejectLoss: (error: Error) => void = () => {};
    const loss = new Promise<never>((_, reject) => {
      rejectLoss = reject;
    });
    const lose = () => {
      closed = true;
      abort.abort();
      rejectLoss(technologyUnavailable());
    };
    const work: TechnologyWork = {
      signal: abort.signal,
      remaining() {
        const elapsed = clock() - started;
        const remaining = Math.floor(technologyBudgetMs - elapsed);
        if (
          closed ||
          authority.signal?.aborted ||
          !Number.isFinite(elapsed) ||
          elapsed < 0 ||
          remaining < 1
        )
          throw technologyUnavailable();
        return remaining;
      },
      check() {
        work.remaining();
      },
      async verify() {
        work.check();
        const current = await authority.verify();
        work.check();
        if (
          current.sub !== actor.sub ||
          current.sid !== actor.sid ||
          current.role !== 'ADMIN' ||
          current.plan !== actor.plan
        )
          throw forbidden();
      },
    };
    authority.signal?.addEventListener('abort', lose, { once: true });
    const timer = setTimeout(lose, technologyBudgetMs);
    try {
      work.check();
      const pending = Promise.resolve().then(() => operation(work, actor));
      const value = await Promise.race([pending, loss]);
      work.check();
      return value;
    } catch (error) {
      if (
        error instanceof AppError &&
        Object.hasOwn(publicFailures, error.code)
      ) {
        const safe = publicFailures[error.code]!;
        throw new AppError(safe[0], error.code, safe[1]);
      }
      if (slugCollision(error)) throw conflict('TECHNOLOGY_SLUG_CONFLICT');
      throw technologyUnavailable();
    } finally {
      closed = true;
      abort.abort();
      clearTimeout(timer);
      authority.signal?.removeEventListener('abort', lose);
    }
  }
  return {
    list(query: AdminTechnologyQuery, authority: TechnologyAuthority) {
      const input = parse(adminTechnologyQuery, {
        page: String(query.page),
        limit: String(query.limit),
      });
      return run(authority, async (work) => {
        const value = await repository.list(input, work);
        work.check();
        if (
          !Number.isSafeInteger(value.total) ||
          value.total < 0 ||
          value.records.length > input.limit
        )
          throw technologyUnavailable();
        return {
          items: value.records.map(adminTechnologyDto),
          pagination: {
            ...input,
            total: value.total,
            totalPages: Math.ceil(value.total / input.limit),
          },
        };
      });
    },
    get(id: string, authority: TechnologyAuthority) {
      const key = new Types.ObjectId(parse(technologyId, id));
      return run(authority, async (work) => {
        const value = await repository.get(key, work);
        if (value === null) throw notFound();
        const dto = adminTechnologyDto(value);
        if (dto.id !== key.toHexString()) throw technologyUnavailable();
        return dto;
      });
    },
    create(
      input: CreateTechnologyInput,
      requestId: string,
      authority: TechnologyAuthority,
    ) {
      return mutate(
        parse(createTechnologyInput, input),
        undefined,
        requestId,
        authority,
        Object.keys(input).sort(),
      );
    },
    patch(
      id: string,
      input: PatchTechnologyInput,
      requestId: string,
      authority: TechnologyAuthority,
    ) {
      return mutate(
        parse(patchTechnologyInput, input),
        new Types.ObjectId(parse(technologyId, id)),
        requestId,
        authority,
      );
    },
  };

  function mutate(
    input: CreateTechnologyInput | PatchTechnologyInput,
    id: Types.ObjectId | undefined,
    requestId: string,
    authority: TechnologyAuthority,
    suppliedFields?: string[],
  ) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestId))
      throw technologyUnavailable();
    return run(authority, async (work, actor) => {
      await work.verify();
      return repository.transaction(work, async (tx) => {
        work.check();
        const actorId = new Types.ObjectId(actor.sub);
        const raw = await tx.actor(actorId);
        work.check();
        if (raw === null) throw forbidden();
        const parsed = account.safeParse(raw);
        if (!parsed.success || !parsed.data._id.equals(actorId))
          throw technologyUnavailable();
        const current = parsed.data;
        if (
          current.role !== 'ADMIN' ||
          current.status !== 'ACTIVE' ||
          !current.emailVerifiedAt
        )
          throw forbidden();
        if (!(await tx.fence(actorId, current.__v, current.emailVerifiedAt)))
          throw technologyUnavailable();
        work.check();
        const now = utc();
        if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
          throw technologyUnavailable();
        let row: Record<string, unknown>;
        let before: number | null = null;
        const fields = (suppliedFields ?? Object.keys(input))
          .filter((key) => key !== 'revision')
          .sort();
        if (!id) {
          const create = input as CreateTechnologyInput;
          row = {
            _id: new Types.ObjectId(),
            name: create.name,
            slug: create.slug,
            ...(create.description === null || create.description === undefined
              ? {}
              : { description: create.description }),
            order: create.order,
            status: 'DRAFT',
            iconAssetId: null,
            __v: 0,
            createdAt: now,
            updatedAt: now,
          };
          const dto = adminTechnologyDto(row);
          await tx.insert({ ...row, createdBy: actorId, updatedBy: actorId });
          work.check();
          await tx.audit({
            category: 'CONTENT_MANAGEMENT',
            action: 'TECHNOLOGY_CREATED',
            actorId,
            resourceType: 'TECHNOLOGY',
            resourceId: row._id,
            requestId,
            createdAt: now,
            metadata: {
              revisionBefore: null,
              revisionAfter: 0,
              changedFields: fields,
            },
          });
          work.check();
          return dto;
        }
        const value = await tx.get(id);
        work.check();
        if (value === null) throw notFound();
        const existing = adminTechnologyDto(value);
        if (existing.id !== id.toHexString()) throw technologyUnavailable();
        if (existing.status !== 'DRAFT') throw conflict('TECHNOLOGY_READ_ONLY');
        const patch = input as PatchTechnologyInput;
        if (existing.revision !== patch.revision)
          throw conflict('TECHNOLOGY_REVISION_CONFLICT');
        before = existing.revision;
        const set: Record<string, unknown> = {
          updatedBy: actorId,
          updatedAt: now,
        };
        for (const key of ['name', 'description', 'order'] as const)
          if (Object.hasOwn(patch, key) && patch[key] !== null)
            set[key] = patch[key];
        if (
          !(await tx.patch(id, patch.revision, set, patch.description === null))
        )
          throw conflict('TECHNOLOGY_REVISION_CONFLICT');
        work.check();
        row = {
          ...(value as Record<string, unknown>),
          ...set,
          __v: before + 1,
        };
        delete row.updatedBy;
        if (patch.description === null) delete row.description;
        const dto = adminTechnologyDto(row);
        await tx.audit({
          category: 'CONTENT_MANAGEMENT',
          action: 'TECHNOLOGY_UPDATED',
          actorId,
          resourceType: 'TECHNOLOGY',
          resourceId: id,
          requestId,
          createdAt: now,
          metadata: {
            revisionBefore: before,
            revisionAfter: before + 1,
            changedFields: fields,
          },
        });
        work.check();
        return dto;
      });
    });
  }
}
export type AdminTechnologyService = ReturnType<
  typeof createAdminTechnologyService
>;

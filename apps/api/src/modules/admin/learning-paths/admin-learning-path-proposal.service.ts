import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../../common/errors/app-error.js';
import type { AuthContext } from '../../auth/access-token.service.js';
import {
  curriculumBriefDigest,
  curriculumBriefProposalBinding,
  validateCurriculumBriefRecord,
  validateCurriculumBriefStructure,
  type CurriculumBriefRecord,
} from './admin-curriculum-brief.schema.js';
import {
  proposalContent,
  proposalData,
  proposalDefinitionDigest,
  validateProposalRecord,
  validateProposalStructure,
  validateProposalRevisionCreation,
  type ProposalRecord,
} from './admin-learning-path-proposal.schema.js';
import { adminLearningPathProposalDto } from './admin-learning-path-proposal.dto.js';
import {
  adminLearningPathProposalRepository,
  proposalUnavailable,
  proposalUnknown,
  type ProposalRepository,
  type ProposalReader,
  type ProposalTransaction,
  type ProposalWork,
} from './admin-learning-path-proposal.repository.js';

const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const ref = z.union([
  id,
  z.instanceof(Types.ObjectId).transform((value) => value.toHexString()),
]);
const operationId = z
  .string()
  .regex(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/,
  );
const requestIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}(?![\s\S])/);
const content = z.strictObject(proposalContent);
const captureInput = content.extend({ technologyId: id, operationId });
const recoveryInput = z.strictObject({ technologyId: id, operationId });
const revisionInput = content.extend({
  technologyId: id,
  proposalId: id,
  predecessor: z.unknown(),
});
const actorSchema = z.strictObject({
  sub: id,
  sid: id,
  role: z.literal('ADMIN'),
  plan: z.enum(['FREE', 'PREMIUM']),
});
const accountSchema = z.strictObject({
  _id: ref,
  role: z.enum(['ADMIN', 'STUDENT']),
  status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED', 'PENDING_VERIFICATION']),
  emailVerifiedAt: z.date().nullable().optional(),
  __v: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER - 1),
});
const technologySchema = z.strictObject({
  _id: ref,
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
});
const auditCommon = {
  _id: ref,
  category: z.literal('CONTENT_MANAGEMENT'),
  actorId: ref,
  resourceId: ref,
  requestId: requestIdSchema,
  createdAt: z.date(),
};
const briefAuditSchema = z.strictObject({
  ...auditCommon,
  action: z.literal('CURRICULUM_BRIEF_ADMITTED'),
  resourceType: z.literal('CURRICULUM_BRIEF_REVISION'),
  metadata: z.strictObject({
    technologyId: ref,
    revision: z.literal(1),
    operationId,
  }),
});
const revisionAuditSchema = z.strictObject({
  ...auditCommon,
  action: z.literal('LEARNING_PATH_PROPOSAL_REVISION_CREATED'),
  resourceType: z.literal('LEARNING_PATH_PROPOSAL_REVISION'),
  metadata: z.strictObject({
    proposalId: ref,
    revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    sourceId: ref,
    sourceRevision: z.literal(1),
  }),
});
const conflict = () =>
  new AppError(
    409,
    'PROPOSAL_CONFLICT',
    'Private proposal conflicts with current state',
  );
const forbidden = () =>
  new AppError(403, 'AUTH_FORBIDDEN', 'Admin access required');
const invalid = () =>
  new AppError(400, 'VALIDATION_ERROR', 'Invalid private proposal request');
const missing = () =>
  new AppError(404, 'TECHNOLOGY_NOT_FOUND', 'Technology is unavailable');
const readOnly = () =>
  new AppError(409, 'TECHNOLOGY_READ_ONLY', 'Technology is read-only');
const safeErrors: Record<string, readonly [number, string]> = {
  AUTH_ACCESS_TOKEN_MISSING: [401, 'Access token required'],
  AUTH_ACCESS_TOKEN_INVALID: [401, 'Access token is invalid or expired'],
  AUTH_ACCESS_TOKEN_EXPIRED: [401, 'Access token is invalid or expired'],
  AUTH_FORBIDDEN: [403, 'Admin access required'],
  VALIDATION_ERROR: [400, 'Invalid private proposal request'],
  TECHNOLOGY_NOT_FOUND: [404, 'Technology is unavailable'],
  PROPOSAL_NOT_FOUND: [404, 'Private proposal is unavailable'],
  TECHNOLOGY_READ_ONLY: [409, 'Technology is read-only'],
  PROPOSAL_CONFLICT: [409, 'Private proposal conflicts with current state'],
};
export interface ProposalAuthority {
  actor: AuthContext | undefined;
  verify(): Promise<AuthContext>;
  signal?: AbortSignal;
}
export type PreparedProposalRevision = Readonly<{ id: string }>;
type Prepared = {
  row: ProposalRecord;
  predecessor: ProposalRecord;
  actor: AuthContext;
  requestId: string;
  attempted: boolean;
};
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  try {
    return schema.parse(proposalData(raw));
  } catch {
    throw invalid();
  }
}
function stored<T>(schema: z.ZodType<T>, raw: unknown): T {
  try {
    return schema.parse(proposalData(raw));
  } catch {
    throw proposalUnavailable();
  }
}
function fields(row: z.output<typeof content>) {
  return {
    title: row.title,
    objectives: [...row.objectives],
    audience: row.audience,
    depth: row.depth,
    runtime: row.runtime === null ? null : { ...row.runtime },
    technologyVersion: row.technologyVersion,
    prerequisites: row.prerequisites.map((item) => ({ ...item })),
  };
}
function exact(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function newAudit(row: ProposalRecord, actor: string, requestId: string) {
  return {
    _id: new Types.ObjectId(row._id),
    category: 'CONTENT_MANAGEMENT',
    action: 'LEARNING_PATH_PROPOSAL_REVISION_CREATED',
    actorId: new Types.ObjectId(actor),
    resourceType: 'LEARNING_PATH_PROPOSAL_REVISION',
    resourceId: new Types.ObjectId(row._id),
    requestId,
    createdAt: row.createdAt,
    metadata: {
      proposalId: new Types.ObjectId(row.proposalId),
      revision: row.revision,
      sourceId: new Types.ObjectId(row.source.id),
      sourceRevision: 1,
    },
  };
}
function nativeBrief(row: CurriculumBriefRecord) {
  return {
    ...row,
    _id: new Types.ObjectId(row._id),
    technologyId: new Types.ObjectId(row.technologyId),
    createdBy: new Types.ObjectId(row.createdBy),
  };
}
function nativeProposal(row: ProposalRecord) {
  return {
    ...row,
    _id: new Types.ObjectId(row._id),
    proposalId: new Types.ObjectId(row.proposalId),
    technologyId: new Types.ObjectId(row.technologyId),
    source: { ...row.source, id: new Types.ObjectId(row.source.id) },
  };
}
function collision(raw: unknown) {
  if (!raw || typeof raw !== 'object') return false;
  const error = raw as { code?: unknown; keyPattern?: unknown };
  return (
    error.code === 11000 &&
    [
      '{"createdBy":1,"operationId":1}',
      '{"proposalId":1,"revision":1}',
      '{"_id":1}',
    ].includes(JSON.stringify(error.keyPattern))
  );
}
async function recover<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) throw error;
    throw proposalUnknown();
  }
}

/** Inert service: invoked by the protected API/internal consumers; no connect/DDL. */
export function createAdminLearningPathProposalService(
  repository: ProposalRepository = adminLearningPathProposalRepository,
  clock = () => performance.now(),
  utc = () => new Date(),
  allocate = () => new Types.ObjectId(),
) {
  const prepared = new WeakMap<object, Prepared>();
  async function run<T>(
    authority: ProposalAuthority,
    operation: (work: ProposalWork, actor: AuthContext) => Promise<T>,
  ): Promise<T> {
    if (!authority.actor)
      throw new AppError(
        401,
        'AUTH_ACCESS_TOKEN_MISSING',
        'Access token required',
      );
    if (authority.actor.role !== 'ADMIN') throw forbidden();
    const actor = parse(actorSchema, authority.actor);
    const start = clock();
    const abort = new AbortController();
    let closed = false,
      mutated = false,
      committed = false,
      uncertain = false;
    let rejectLoss: (error: Error) => void = () => {};
    const loss = new Promise<never>((_, reject) => {
      rejectLoss = reject;
    });
    const lose = () => {
      closed = true;
      abort.abort();
      rejectLoss(
        mutated || committed ? proposalUnknown() : proposalUnavailable(),
      );
    };
    const work: ProposalWork = {
      signal: abort.signal,
      remaining() {
        const elapsed = clock() - start,
          left = Math.floor(10000 - elapsed);
        if (
          closed ||
          authority.signal?.aborted ||
          !Number.isFinite(elapsed) ||
          elapsed < 0 ||
          left < 1
        )
          throw committed || uncertain
            ? proposalUnknown()
            : proposalUnavailable();
        return left;
      },
      check() {
        work.remaining();
      },
      async verify() {
        work.check();
        const began = clock();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const expired = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => {
                lose();
                reject(proposalUnavailable());
              },
              Math.min(5000, work.remaining()),
            );
          });
          const current = await Promise.race([
            Promise.resolve().then(() => authority.verify()),
            expired,
          ]);
          work.check();
          const elapsed = clock() - began;
          if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 5000)
            throw proposalUnavailable();
          if (!exact(parse(actorSchema, current), actor)) throw forbidden();
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      },
      mutation() {
        work.check();
        mutated = true;
      },
      commit() {
        work.check();
        committed = true;
      },
      uncertain() {
        uncertain = true;
      },
    };
    authority.signal?.addEventListener('abort', lose, { once: true });
    const timer = setTimeout(lose, 10000);
    try {
      work.check();
      const result = await Promise.race([
        Promise.resolve().then(() => operation(work, actor)),
        loss,
      ]);
      work.check();
      return result;
    } catch (error) {
      if (
        committed ||
        uncertain ||
        (closed && mutated) ||
        (error instanceof AppError && error.code === 'PROPOSAL_OUTCOME_UNKNOWN')
      )
        throw proposalUnknown();
      if (error instanceof AppError && Object.hasOwn(safeErrors, error.code)) {
        const safe = safeErrors[error.code]!;
        throw new AppError(safe[0], error.code, safe[1]);
      }
      if (collision(error)) throw conflict();
      throw proposalUnavailable();
    } finally {
      closed = true;
      abort.abort();
      clearTimeout(timer);
      authority.signal?.removeEventListener('abort', lose);
    }
  }
  async function authorize(
    reader: ProposalReader,
    work: ProposalWork,
    actor: AuthContext,
  ) {
    const began = clock();
    await work.verify();
    const left = Math.min(5000 - (clock() - began), work.remaining());
    if (!Number.isFinite(left) || left < 1) throw proposalUnavailable();
    const raw = await reader.actor(new Types.ObjectId(actor.sub), left);
    work.check();
    const elapsed = clock() - began;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 5000)
      throw proposalUnavailable();
    if (raw === null) throw forbidden();
    const current = stored(accountSchema, raw);
    if (current._id !== actor.sub) throw proposalUnavailable();
    if (
      current.role !== 'ADMIN' ||
      current.status !== 'ACTIVE' ||
      !current.emailVerifiedAt
    )
      throw forbidden();
    return current;
  }
  async function parent(
    reader: ProposalReader,
    work: ProposalWork,
    technologyId: string,
    writing: boolean,
  ) {
    const raw = await reader.technology(new Types.ObjectId(technologyId));
    work.check();
    if (raw === null) throw missing();
    const row = stored(technologySchema, raw);
    if (row._id !== technologyId) throw proposalUnavailable();
    if (writing && row.status === 'ARCHIVED') throw readOnly();
  }
  async function admitted(
    reader: ProposalReader,
    work: ProposalWork,
    raw: unknown,
    technologyId: string,
  ) {
    let row: CurriculumBriefRecord;
    try {
      row = validateCurriculumBriefRecord(raw, technologyId);
    } catch {
      throw proposalUnavailable();
    }
    const audit = stored(
      briefAuditSchema,
      await reader.audit(new Types.ObjectId(row._id)),
    );
    work.check();
    if (
      audit._id !== row._id ||
      audit.resourceId !== row._id ||
      audit.actorId !== row.createdBy ||
      audit.createdAt.getTime() !== row.createdAt.getTime() ||
      audit.metadata.technologyId !== row.technologyId ||
      audit.metadata.operationId !== row.operationId
    )
      throw proposalUnavailable();
    return { row, audit };
  }
  async function revisionAudit(
    reader: ProposalReader,
    work: ProposalWork,
    row: ProposalRecord,
  ) {
    const audit = stored(
      revisionAuditSchema,
      await reader.audit(new Types.ObjectId(row._id)),
    );
    work.check();
    if (
      audit._id !== row._id ||
      audit.resourceId !== row._id ||
      audit.createdAt.getTime() !== row.createdAt.getTime() ||
      audit.metadata.proposalId !== row.proposalId ||
      audit.metadata.revision !== row.revision ||
      audit.metadata.sourceId !== row.source.id ||
      audit.metadata.sourceRevision !== row.source.revision
    )
      throw proposalUnavailable();
    return audit;
  }
  async function captured(
    reader: ProposalReader,
    work: ProposalWork,
    raw: unknown,
    technologyId: string,
    actor: string,
    key: string,
    supplied?: z.output<typeof content>,
  ) {
    let original: CurriculumBriefRecord;
    try {
      original = validateCurriculumBriefStructure(raw);
    } catch {
      throw proposalUnknown();
    }
    if (original.technologyId !== technologyId) throw conflict();
    const source = await admitted(reader, work, raw, technologyId);
    if (source.row.createdBy !== actor || source.row.operationId !== key)
      throw proposalUnavailable();
    if (supplied && !exact(fields(source.row), fields(supplied)))
      throw conflict();
    await parent(reader, work, technologyId, false);
    const binding = curriculumBriefProposalBinding(source.row, technologyId);
    let row: ProposalRecord;
    try {
      row = validateProposalRevisionCreation(
        await reader.revision(new Types.ObjectId(source.row._id), 1),
        binding,
      );
    } catch {
      throw proposalUnavailable();
    }
    work.check();
    if (
      row.proposalId !== source.row._id ||
      row._id === source.row._id ||
      row.createdAt.getTime() !== source.row.createdAt.getTime() ||
      !exact(fields(row), fields(source.row))
    )
      throw proposalUnavailable();
    const audit = await revisionAudit(reader, work, row);
    if (
      audit.actorId !== source.row.createdBy ||
      audit.requestId !== source.audit.requestId
    )
      throw proposalUnavailable();
    return adminLearningPathProposalDto(row, binding);
  }
  async function fence(
    tx: ProposalTransaction,
    work: ProposalWork,
    actor: AuthContext,
  ) {
    const current = await authorize(tx, work, actor);
    work.check();
    if (
      !(await tx.fence(
        new Types.ObjectId(actor.sub),
        current.__v,
        current.emailVerifiedAt!,
      ))
    )
      throw proposalUnavailable();
    work.check();
  }
  function time() {
    const date = utc();
    if (!(date instanceof Date) || !Number.isFinite(date.getTime()))
      throw proposalUnavailable();
    return new Date(date.getTime());
  }
  return {
    get(
      rawId: unknown,
      rawTechnologyId: unknown,
      authority: ProposalAuthority,
    ) {
      const input = parse(z.strictObject({ id, technologyId: id }), {
        id: rawId,
        technologyId: rawTechnologyId,
      });
      return run(authority, (work, actor) =>
        repository.read(work, async (reader) => {
          await authorize(reader, work, actor);
          await parent(reader, work, input.technologyId, false);
          const raw = await reader.proposal(new Types.ObjectId(input.id));
          work.check();
          const unavailable = () =>
            new AppError(
              404,
              'PROPOSAL_NOT_FOUND',
              'Private proposal is unavailable',
            );
          if (raw === null) throw unavailable();
          let row: ProposalRecord;
          try {
            row = validateProposalStructure(raw);
          } catch {
            throw proposalUnavailable();
          }
          if (row._id !== input.id) throw proposalUnavailable();
          if (row.technologyId !== input.technologyId) throw unavailable();
          const source = await admitted(
            reader,
            work,
            await reader.brief(new Types.ObjectId(row.source.id)),
            input.technologyId,
          );
          const binding = curriculumBriefProposalBinding(
            source.row,
            input.technologyId,
          );
          try {
            row = validateProposalRecord(raw, binding);
          } catch {
            throw proposalUnavailable();
          }
          if (row.proposalId !== source.row._id || row._id === source.row._id)
            throw proposalUnavailable();
          const audit = await revisionAudit(reader, work, row);
          if (row.revision === 1) {
            try {
              validateProposalRevisionCreation(raw, binding);
            } catch {
              throw proposalUnavailable();
            }
            if (
              row.createdAt.getTime() !== source.row.createdAt.getTime() ||
              !exact(fields(row), fields(source.row)) ||
              audit.actorId !== source.row.createdBy ||
              audit.requestId !== source.audit.requestId
            )
              throw proposalUnavailable();
          }
          work.check();
          return adminLearningPathProposalDto(row, binding);
        }),
      );
    },
    capture(raw: unknown, requestId: string, authority: ProposalAuthority) {
      const input = parse(captureInput, raw);
      parse(requestIdSchema, requestId);
      return run(authority, async (work, actor) => {
        const previous = await repository.read(work, async (reader) => {
          await authorize(reader, work, actor);
          const found = await reader.operation(
            new Types.ObjectId(actor.sub),
            input.operationId,
          );
          work.check();
          if (found === null) return null;
          return recover(() =>
            captured(
              reader,
              work,
              found,
              input.technologyId,
              actor.sub,
              input.operationId,
              input,
            ),
          );
        });
        if (previous !== null) return previous;
        work.check();
        const briefId = allocate().toHexString(),
          revisionId = allocate().toHexString(),
          now = time();
        if (briefId === revisionId) throw proposalUnavailable();
        const definition = {
          _id: briefId,
          technologyId: input.technologyId,
          schemaVersion: 1 as const,
          revision: 1 as const,
          ...fields(input),
          createdBy: actor.sub,
          createdAt: now,
          operationId: input.operationId,
        };
        const brief = validateCurriculumBriefRecord(
          { ...definition, contentDigest: curriculumBriefDigest(definition) },
          input.technologyId,
        );
        const binding = curriculumBriefProposalBinding(
          brief,
          input.technologyId,
        );
        const draft = {
          _id: revisionId,
          proposalId: briefId,
          technologyId: input.technologyId,
          schemaVersion: 1,
          revision: 1,
          source: binding.source,
          ...fields(input),
          createdAt: now,
        };
        const row = validateProposalRevisionCreation(
          { ...draft, definitionDigest: proposalDefinitionDigest(draft) },
          binding,
        );
        return repository.transaction(work, async (tx) => {
          // Recheck actor/key inside the transaction BEFORE any User fence/write.
          await authorize(tx, work, actor);
          const concurrent = await tx.operation(
            new Types.ObjectId(actor.sub),
            input.operationId,
          );
          work.check();
          if (concurrent !== null)
            return recover(() =>
              captured(
                tx,
                work,
                concurrent,
                input.technologyId,
                actor.sub,
                input.operationId,
                input,
              ),
            );
          await parent(tx, work, input.technologyId, true);
          if ((await tx.latest(new Types.ObjectId(briefId))) !== null)
            throw conflict();
          work.check();
          await fence(tx, work, actor);
          await tx.insertBrief(nativeBrief(brief));
          work.check();
          await tx.insertAudit({
            _id: new Types.ObjectId(briefId),
            category: 'CONTENT_MANAGEMENT',
            action: 'CURRICULUM_BRIEF_ADMITTED',
            actorId: new Types.ObjectId(actor.sub),
            resourceType: 'CURRICULUM_BRIEF_REVISION',
            resourceId: new Types.ObjectId(briefId),
            requestId,
            createdAt: now,
            metadata: {
              technologyId: new Types.ObjectId(input.technologyId),
              revision: 1,
              operationId: input.operationId,
            },
          });
          work.check();
          await tx.insertProposal(nativeProposal(row));
          work.check();
          await tx.insertAudit(newAudit(row, actor.sub, requestId));
          work.check();
          return adminLearningPathProposalDto(row, binding);
        });
      });
    },
    reconcile(raw: unknown, authority: ProposalAuthority) {
      const input = parse(recoveryInput, raw);
      return recover(() =>
        run(authority, (work, actor) =>
          repository.read(work, async (reader) => {
            await authorize(reader, work, actor);
            await parent(reader, work, input.technologyId, false);
            const found = await reader.operation(
              new Types.ObjectId(actor.sub),
              input.operationId,
            );
            work.check();
            if (found === null) return { state: 'UNRESOLVED' as const };
            return {
              state: 'COMMITTED' as const,
              proposal: await captured(
                reader,
                work,
                found,
                input.technologyId,
                actor.sub,
                input.operationId,
              ),
            };
          }),
        ),
      );
    },
    /** Server-only preparation is structural; persist re-resolves all authority. */
    prepareRevision(
      raw: unknown,
      requestId: string,
      rawActor: AuthContext,
    ): PreparedProposalRevision {
      const input = parse(revisionInput, raw),
        actor = parse(actorSchema, rawActor);
      parse(requestIdSchema, requestId);
      let predecessor: ProposalRecord;
      try {
        predecessor = validateProposalStructure(input.predecessor);
      } catch {
        throw invalid();
      }
      if (
        predecessor.technologyId !== input.technologyId ||
        predecessor.proposalId !== input.proposalId ||
        predecessor.source.id !== input.proposalId ||
        predecessor.source.revision !== 1 ||
        predecessor.revision === Number.MAX_SAFE_INTEGER
      )
        throw invalid();
      const definition = {
        _id: allocate().toHexString(),
        proposalId: input.proposalId,
        technologyId: input.technologyId,
        schemaVersion: 1,
        revision: predecessor.revision + 1,
        source: { ...predecessor.source },
        ...fields(input),
        createdAt: time(),
      };
      const binding = {
        technologyId: input.technologyId,
        source: { ...predecessor.source },
      };
      let row: ProposalRecord;
      try {
        row = validateProposalRevisionCreation(
          {
            ...definition,
            definitionDigest: proposalDefinitionDigest(definition),
          },
          binding,
          predecessor,
        );
      } catch {
        throw invalid();
      }
      const handle = Object.freeze({ id: row._id });
      prepared.set(handle, {
        row,
        predecessor,
        actor,
        requestId,
        attempted: false,
      });
      return handle;
    },
    persistRevision(
      handle: PreparedProposalRevision,
      authority: ProposalAuthority,
    ) {
      return run(authority, async (work, actor) => {
        const command = prepared.get(handle);
        if (!command || command.attempted || !exact(command.actor, actor))
          throw conflict();
        command.attempted = true;
        return repository.transaction(work, async (tx) => {
          await authorize(tx, work, actor);
          await parent(tx, work, command.row.technologyId, true);
          const source = await admitted(
            tx,
            work,
            await tx.brief(new Types.ObjectId(command.row.source.id)),
            command.row.technologyId,
          );
          const binding = curriculumBriefProposalBinding(
            source.row,
            command.row.technologyId,
          );
          let predecessor: ProposalRecord;
          try {
            predecessor = validateProposalRecord(
              await tx.latest(new Types.ObjectId(command.row.proposalId)),
              binding,
            );
          } catch {
            throw proposalUnavailable();
          }
          if (!exact(predecessor, command.predecessor)) throw conflict();
          await revisionAudit(tx, work, predecessor);
          const row = validateProposalRevisionCreation(
            command.row,
            binding,
            predecessor,
          );
          await fence(tx, work, actor);
          await tx.insertProposal(nativeProposal(row));
          work.check();
          await tx.insertAudit(newAudit(row, actor.sub, command.requestId));
          work.check();
          return adminLearningPathProposalDto(row, binding);
        });
      });
    },
    reconcileRevision(
      handle: PreparedProposalRevision,
      authority: ProposalAuthority,
    ) {
      return recover(() =>
        run(authority, (work, actor) =>
          repository.read(work, async (reader) => {
            const command = prepared.get(handle);
            if (!command || !exact(command.actor, actor)) throw conflict();
            await authorize(reader, work, actor);
            await parent(reader, work, command.row.technologyId, false);
            const source = await admitted(
              reader,
              work,
              await reader.brief(new Types.ObjectId(command.row.source.id)),
              command.row.technologyId,
            );
            const binding = curriculumBriefProposalBinding(
              source.row,
              command.row.technologyId,
            );
            const raw = await reader.proposal(
              new Types.ObjectId(command.row._id),
            );
            work.check();
            if (raw === null) {
              if (
                (await reader.audit(new Types.ObjectId(command.row._id))) !==
                null
              )
                throw proposalUnknown();
              if (
                (await reader.revision(
                  new Types.ObjectId(command.row.proposalId),
                  command.row.revision,
                )) !== null
              )
                throw conflict();
              return { state: 'UNRESOLVED' as const };
            }
            const row = validateProposalRecord(raw, binding);
            if (!exact(row, command.row)) throw conflict();
            const audit = await revisionAudit(reader, work, row);
            if (
              audit.actorId !== actor.sub ||
              audit.requestId !== command.requestId
            )
              throw conflict();
            return {
              state: 'COMMITTED' as const,
              proposal: adminLearningPathProposalDto(row, binding),
            };
          }),
        ),
      );
    },
  };
}

/** HTTP exposes only these three operations, never prepared-revision handles. */
export type AdminLearningPathProposalService = Pick<
  ReturnType<typeof createAdminLearningPathProposalService>,
  'capture' | 'reconcile' | 'get'
>;

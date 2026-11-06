import type { ClientSession, Db, Document, MongoClient } from 'mongodb';
import { types } from 'node:util';
import { Types } from 'mongoose';
import { ledgerRequiredIndexes } from './ai-usage-ledger.model.js';
import {
  ledgerCodes,
  ledgerDate,
  ledgerEnum,
  ledgerFreezeReasons,
  ledgerHex,
  ledgerInteger,
  ledgerNullable,
  ledgerObject,
  ledgerObjectId,
  ledgerPeriodKey,
  ledgerSame,
  ledgerUuid,
  paiseFromDecimal,
  paiseToBigInt,
  validateLedgerControl,
  validateLedgerOperation,
  validateLedgerPeriod,
  type LedgerCode,
  type LedgerOperation,
} from './ai-usage-ledger.schema.js';
import type { LedgerProposal } from './ai-usage-ledger.transitions.js';

export class LedgerFailure extends Error {
  constructor(
    readonly code: LedgerCode = 'CONTROL_UNAVAILABLE',
    readonly uncertain = false,
    readonly primary: 'REFUSAL' | 'DRIVER' | 'COMMIT' | 'READ' = 'REFUSAL',
    readonly cleanup: readonly (
      'ABORT' | 'ABORT_UNCONFIRMED' | 'END_SESSION' | 'NOT_ENDED'
    )[] = [],
    readonly primaryCode: LedgerCode = code,
  ) {
    super('AI usage operation cannot proceed');
  }
}
export interface LedgerWork {
  signal: AbortSignal;
  remaining(): number;
  check(): void;
  verify(): Promise<void>;
  beforeCommit(): Promise<void>;
  finalize(): void;
  mutation(): void;
  commit(): void;
  uncertain(): void;
}
export interface LedgerReader {
  actor(id: Types.ObjectId, timeoutMS: number): Promise<unknown>;
  control(): Promise<unknown>;
  period(key: string): Promise<unknown>;
  operation(actor: Types.ObjectId, operationId: string): Promise<unknown>;
  open(): Promise<unknown[]>;
  minute(actor: Types.ObjectId, window: number): Promise<unknown>;
  audit(id: Types.ObjectId): Promise<unknown>;
}
export interface LedgerTransaction extends LedgerReader {
  fence(
    id: Types.ObjectId,
    version: number,
    verifiedAt: Date,
  ): Promise<boolean>;
  apply(
    proposal: LedgerProposal,
    insertPeriod: boolean,
    audit: unknown,
  ): Promise<void>;
}
export interface LedgerRepository {
  read<T>(
    work: LedgerWork,
    operation: (reader: LedgerReader) => Promise<T>,
  ): Promise<T>;
  transaction<T>(
    work: LedgerWork,
    operation: (tx: LedgerTransaction) => Promise<T>,
  ): Promise<T>;
}
const actions = [
  'AI_USAGE_RESERVED',
  'AI_USAGE_DISPATCH_CLAIMED',
  'AI_USAGE_UNCERTAIN',
  'AI_USAGE_SETTLED',
  'AI_USAGE_RELEASED',
] as const;
const sameLiteral =
  <T extends string>(expected: T) =>
  (value: unknown): T => {
    if (value !== expected) throw new LedgerFailure();
    return expected;
  };
const count = ledgerNullable((v: unknown) => ledgerInteger(v));
const amount = (v: unknown) => {
  const value = paiseFromDecimal(v);
  return value.toString();
};
const alias = (v: unknown) => {
  if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}(?![\s\S])/.test(v))
    throw new LedgerFailure();
  return v;
};
export function validateLedgerAudit(input: unknown) {
  try {
    const row = ledgerObject(input, {
      _id: ledgerObjectId,
      category: sameLiteral('CONTENT_MANAGEMENT'),
      action: (v) => ledgerEnum(v, actions),
      actorId: ledgerObjectId,
      resourceType: sameLiteral('AI_USAGE_OPERATION'),
      resourceId: ledgerObjectId,
      requestId: (v) => {
        if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}(?![\s\S])/.test(v))
          throw new LedgerFailure();
        return v;
      },
      createdAt: ledgerDate,
      metadata: (v) =>
        ledgerObject(v, {
          operationId: ledgerUuid,
          originalActorId: ledgerObjectId,
          usageVersion: (x) => ledgerInteger(x, 1),
          purpose: sameLiteral('CURRICULUM_OUTLINE'),
          environment: sameLiteral('DEV'),
          periodKey: ledgerPeriodKey,
          policyVersion: ledgerUuid,
          profileVersion: ledgerUuid,
          pricingVersion: ledgerUuid,
          providerAlias: alias,
          modelAlias: alias,
          reservedPaise: amount,
          heldPaise: amount,
          actualPaise: ledgerNullable(amount),
          inputTokens: count,
          outputTokens: count,
          safeCode: ledgerNullable((x) => ledgerEnum(x, ledgerCodes)),
          evidenceId: ledgerNullable(ledgerUuid),
          freezeReasons: (x) => {
            if (!Array.isArray(x) || types.isProxy(x) || x.length > 5)
              throw new LedgerFailure();
            const fields = Object.fromEntries(
              Array.from({ length: x.length }, (_, i) => [
                String(i),
                (v: unknown) => ledgerEnum(v, ledgerFreezeReasons),
              ]),
            );
            const raw: Record<string, unknown> = {};
            if (Reflect.ownKeys(x).length !== x.length + 1)
              throw new LedgerFailure();
            for (let i = 0; i < x.length; i++) {
              const d = Object.getOwnPropertyDescriptor(x, String(i));
              if (!d || !('value' in d)) throw new LedgerFailure();
              raw[String(i)] = d.value;
            }
            const values = Object.values(ledgerObject(raw, fields));
            if (
              new Set(values).size !== values.length ||
              values.join(',') !== [...values].sort().join(',')
            )
              throw new LedgerFailure();
            return values;
          },
        }),
    });
    const m = row.metadata,
      reserved = paiseToBigInt(paiseFromDecimal(m.reservedPaise));
    const terminal =
      row.action === 'AI_USAGE_SETTLED' || row.action === 'AI_USAGE_RELEASED';
    if (!terminal && ledgerHex(row.actorId) !== ledgerHex(m.originalActorId))
      throw new LedgerFailure();
    if (ledgerHex(row._id) === ledgerHex(row.resourceId) || reserved === 0n)
      throw new LedgerFailure();
    if (
      terminal
        ? m.heldPaise !== '0' ||
          m.actualPaise === null ||
          m.evidenceId === null ||
          m.safeCode !== null
        : m.heldPaise !== m.reservedPaise ||
          m.actualPaise !== null ||
          m.evidenceId !== null ||
          m.inputTokens !== null ||
          m.outputTokens !== null
    )
      throw new LedgerFailure();
    if (
      row.action === 'AI_USAGE_RESERVED'
        ? m.usageVersion !== 1 || m.safeCode !== null
        : m.usageVersion < 2
    )
      throw new LedgerFailure();
    if (
      row.action === 'AI_USAGE_UNCERTAIN'
        ? m.safeCode !== 'OUTCOME_UNKNOWN' ||
          !m.freezeReasons.includes('UNCERTAIN')
        : m.safeCode !== null
    )
      throw new LedgerFailure();
    if (
      row.action === 'AI_USAGE_RELEASED' &&
      (m.actualPaise !== '0' ||
        m.inputTokens !== null ||
        m.outputTokens !== null)
    )
      throw new LedgerFailure();
    return row;
  } catch {
    throw new LedgerFailure();
  }
}
export type LedgerAudit = ReturnType<typeof validateLedgerAudit>;
export function ledgerAuditFor(
  op: LedgerOperation,
  action: (typeof actions)[number],
  actorId: Types.ObjectId,
  requestId: string,
  freezeReasons: readonly string[],
): LedgerAudit {
  return validateLedgerAudit({
    _id: op.lastAuditId,
    category: 'CONTENT_MANAGEMENT',
    action,
    actorId,
    resourceType: 'AI_USAGE_OPERATION',
    resourceId: op._id,
    requestId,
    createdAt: op.updatedAt,
    metadata: {
      operationId: op.operationId,
      originalActorId: op.actorId,
      usageVersion: op.version,
      purpose: op.purpose,
      environment: op.environment,
      periodKey: op.periodKey,
      policyVersion: op.quote.policyVersion,
      profileVersion: op.quote.profileVersion,
      pricingVersion: op.quote.pricingVersion,
      providerAlias: op.quote.providerAlias,
      modelAlias: op.quote.modelAlias,
      reservedPaise: op.reservationPaise.toString(),
      heldPaise: op.heldPaise.toString(),
      actualPaise: op.actualPaise?.toString() ?? null,
      inputTokens: op.terminalEvidence?.inputTokens ?? null,
      outputTokens: op.terminalEvidence?.outputTokens ?? null,
      safeCode: op.safeCode,
      evidenceId: op.terminalEvidence?.id ?? null,
      freezeReasons: [...freezeReasons],
    },
  });
}
export function assertLedgerAuditLink(
  op: LedgerOperation,
  input: unknown,
): LedgerAudit {
  const row = validateLedgerAudit(input);
  const action = {
    RESERVED: 'AI_USAGE_RESERVED',
    DISPATCH_CLAIMED: 'AI_USAGE_DISPATCH_CLAIMED',
    UNCERTAIN: 'AI_USAGE_UNCERTAIN',
    SETTLED: 'AI_USAGE_SETTLED',
    RELEASED: 'AI_USAGE_RELEASED',
  }[op.state] as (typeof actions)[number];
  const expected = ledgerAuditFor(
    op,
    action,
    row.actorId,
    row.requestId,
    row.metadata.freezeReasons,
  );
  if (!ledgerSame(row, expected)) throw new LedgerFailure();
  return row;
}
function field(input: unknown, key: string): unknown {
  if (!input || typeof input !== 'object' || types.isProxy(input))
    throw new LedgerFailure();
  const p = Object.getPrototypeOf(input);
  if (p !== Object.prototype && p !== null) throw new LedgerFailure();
  const d = Object.getOwnPropertyDescriptor(input, key);
  if (d && !('value' in d)) throw new LedgerFailure();
  return d?.value;
}
export function assertLedgerIndexes(
  collection: string,
  rows: readonly unknown[],
): void {
  if (
    types.isProxy(rows) ||
    !Array.isArray(rows) ||
    Object.getPrototypeOf(rows) !== Array.prototype ||
    rows.length > 100 ||
    Reflect.ownKeys(rows).length !== rows.length + 1
  )
    throw new LedgerFailure();
  const inertRows: unknown[] = [];
  for (let i = 0; i < rows.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(rows, String(i));
    if (!descriptor || !('value' in descriptor)) throw new LedgerFailure();
    inertRows.push(descriptor.value);
  }
  for (const expected of ledgerRequiredIndexes.filter(
    (x) => x.collection === collection,
  )) {
    const matching = inertRows.filter(
      (row) => field(row, 'name') === expected.name,
    );
    if (matching.length !== 1) throw new LedgerFailure();
    const row = matching[0];
    const key = field(row, 'key');
    const shape = Object.fromEntries(
      Object.entries(expected.key).map(([k, v]) => [
        k,
        (x: unknown) => {
          if (x !== v) throw new LedgerFailure();
          return x;
        },
      ]),
    );
    ledgerObject(key, shape);
    if (
      Object.keys(key as object).join(',') !==
      Object.keys(expected.key).join(',')
    )
      throw new LedgerFailure();
    if (
      field(row, 'unique') !== true &&
      !(expected.name === '_id_' && field(row, 'unique') === undefined)
    )
      throw new LedgerFailure();
    for (const option of ['sparse', 'hidden'])
      if (field(row, option) !== undefined && field(row, option) !== false)
        throw new LedgerFailure();
    if (field(row, 'expireAfterSeconds') !== undefined)
      throw new LedgerFailure();
    const partial =
      'partialFilterExpression' in expected
        ? expected.partialFilterExpression
        : undefined;
    const actualPartial = field(row, 'partialFilterExpression');
    if (
      partial === undefined
        ? actualPartial !== undefined
        : actualPartial === null ||
          typeof actualPartial !== 'object' ||
          !ledgerSame(actualPartial, partial)
    )
      throw new LedgerFailure();
    const collation = field(row, 'collation');
    if (
      collation !== undefined &&
      (collation === null ||
        typeof collation !== 'object' ||
        !ledgerSame(collation, { locale: 'simple' }))
    )
      throw new LedgerFailure();
  }
}

/** Explicit injected native driver only. Import/factory performs no I/O or registration. */
export function createAiUsageLedgerRepository(dependencies: {
  db: Db;
  client: MongoClient;
}): LedgerRepository {
  const { db, client } = dependencies;
  const options = (work: LedgerWork, session?: ClientSession) => ({
    signal: work.signal,
    timeoutMS: work.remaining(),
    promoteLongs: false,
    readPreference: 'primary' as const,
    ...(session ? { session } : {}),
  });
  async function qualify(work: LedgerWork) {
    work.check();
    const hello = await db.admin().command({ hello: 1 }, options(work));
    work.check();
    if (
      field(hello, 'isWritablePrimary') !== true ||
      typeof field(hello, 'setName') !== 'string' ||
      !field(hello, 'setName') ||
      field(hello, 'logicalSessionTimeoutMinutes') === undefined
    )
      throw new LedgerFailure();
    for (const collection of new Set(
      ledgerRequiredIndexes.map((x) => x.collection),
    )) {
      const rows = await db
        .collection(collection)
        .listIndexes(options(work))
        .toArray();
      work.check();
      assertLedgerIndexes(collection, rows);
    }
  }
  function reader(work: LedgerWork, session: ClientSession): LedgerReader {
    const find = async (
      collection: string,
      filter: Document,
      extra: Document = {},
    ) => {
      work.check();
      const row = await db
        .collection(collection)
        .findOne(filter, { ...options(work, session), ...extra });
      work.check();
      return row;
    };
    return {
      actor: (id, timeoutMS) =>
        find(
          'users',
          { _id: id },
          {
            projection: {
              _id: 1,
              role: 1,
              status: 1,
              emailVerifiedAt: 1,
              __v: 1,
            },
            timeoutMS: Math.min(timeoutMS, work.remaining()),
          },
        ),
      control: () =>
        find(
          'aiUsageControls',
          { scope: 'SHARED_AI_TESTING' },
          { hint: 'uq_ai_usage_scope' },
        ),
      period: (periodKey) =>
        find(
          'aiUsagePeriods',
          { scope: 'SHARED_AI_TESTING', periodKey },
          { hint: 'uq_ai_usage_period' },
        ),
      operation: (actorId, operationId) =>
        find(
          'aiUsageOperations',
          { scope: 'SHARED_AI_TESTING', actorId, operationId },
          { hint: 'uq_ai_usage_actor_operation' },
        ),
      minute: (actorId, admissionWindowKey) =>
        find(
          'aiUsageOperations',
          { scope: 'SHARED_AI_TESTING', actorId, admissionWindowKey },
          { hint: 'uq_ai_usage_actor_minute' },
        ),
      async open() {
        work.check();
        const rows = await db
          .collection('aiUsageOperations')
          .find(
            { scope: 'SHARED_AI_TESTING', open: true },
            { ...options(work, session), hint: 'uq_ai_usage_open' },
          )
          .limit(2)
          .toArray();
        work.check();
        return rows;
      },
      audit: (id) => find('auditLogs', { _id: id }),
    };
  }
  async function run<T>(
    work: LedgerWork,
    writing: boolean,
    operation: (tx: LedgerTransaction) => Promise<T>,
  ): Promise<T> {
    let session: ClientSession | undefined,
      value: T | undefined,
      failure: LedgerFailure | undefined;
    let committing = false,
      writeAttempted = false;
    const cleanup: (
      'ABORT' | 'ABORT_UNCONFIRMED' | 'END_SESSION' | 'NOT_ENDED'
    )[] = [];
    try {
      await qualify(work);
      work.check();
      session = client.startSession({
        causalConsistency: false,
        defaultTimeoutMS: work.remaining(),
        ...(!writing ? { snapshot: true } : {}),
      });
      if (writing)
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          readPreference: 'primary',
          writeConcern: { w: 'majority', j: true },
          maxCommitTimeMS: Math.min(2000, work.remaining()),
        });
      const currentSession = session;
      const writeOptions = () => {
        if (!writing) throw new LedgerFailure();
        work.check();
        work.mutation();
        writeAttempted = true;
        return options(work, currentSession);
      };
      const tx: LedgerTransaction = {
        ...reader(work, currentSession),
        async fence(id, version, verifiedAt) {
          const result = await db.collection('users').updateOne(
            {
              _id: id,
              role: 'ADMIN',
              status: 'ACTIVE',
              emailVerifiedAt: verifiedAt,
              __v: version,
            },
            { $inc: { __v: 1 } },
            writeOptions(),
          );
          work.check();
          return (
            result.acknowledged &&
            result.matchedCount === 1 &&
            result.modifiedCount === 1
          );
        },
        async apply(proposal, insertPeriod, auditInput) {
          if (
            proposal.kind !== 'PROPOSED' ||
            proposal.readOnly ||
            proposal.dispatchAuthorized !== false
          )
            throw new LedgerFailure();
          const c = validateLedgerControl(proposal.next.control),
            p = validateLedgerPeriod(proposal.next.period),
            op = validateLedgerOperation(proposal.next.operation);
          const audit = assertLedgerAuditLink(op, auditInput);
          if (
            proposal.auditAction !== audit.action ||
            !ledgerSame(audit.metadata.freezeReasons, c.freezeReasons)
          )
            throw new LedgerFailure();
          const update = async (
            collection: string,
            filter: Document,
            row: Document,
          ) => {
            const { _id: ignored, ...fields } = row;
            void ignored;
            const result = await db
              .collection(collection)
              .updateOne(filter, { $set: fields }, writeOptions());
            work.check();
            if (
              !result.acknowledged ||
              result.matchedCount !== 1 ||
              result.modifiedCount !== 1
            )
              throw new LedgerFailure('RETRY_LATER');
          };
          await update(
            'aiUsageControls',
            {
              _id: c._id,
              scope: c.scope,
              version: proposal.expected.controlVersion,
              activeOperationId:
                proposal.expected.activeOperationId === null
                  ? null
                  : new Types.ObjectId(proposal.expected.activeOperationId),
            },
            c,
          );
          if (insertPeriod) {
            if (
              proposal.action !== 'RESERVE' ||
              proposal.expected.periodVersion !== 0
            )
              throw new LedgerFailure();
            const result = await db
              .collection('aiUsagePeriods')
              .insertOne(p, writeOptions());
            work.check();
            if (!result.acknowledged) throw new LedgerFailure();
          } else
            await update(
              'aiUsagePeriods',
              {
                _id: p._id,
                scope: p.scope,
                periodKey: p.periodKey,
                version: proposal.expected.periodVersion,
              },
              p,
            );
          if (proposal.expected.operationVersion === null) {
            if (proposal.action !== 'RESERVE') throw new LedgerFailure();
            const result = await db
              .collection('aiUsageOperations')
              .insertOne(op, writeOptions());
            work.check();
            if (!result.acknowledged) throw new LedgerFailure();
          } else
            await update(
              'aiUsageOperations',
              {
                _id: op._id,
                scope: op.scope,
                actorId: op.actorId,
                operationId: op.operationId,
                version: proposal.expected.operationVersion,
                open: true,
              },
              op,
            );
          const inserted = await db
            .collection('auditLogs')
            .insertOne(audit, writeOptions());
          work.check();
          if (!inserted.acknowledged) throw new LedgerFailure();
        },
      };
      value = await operation(tx);
      work.check();
      if (writing && writeAttempted) await work.beforeCommit();
      await work.verify();
      work.check();
      if (writing && writeAttempted) {
        work.finalize();
        work.commit();
        committing = true;
        await session.commitTransaction({
          timeoutMS: Math.min(2000, work.remaining()),
        });
        work.check();
      }
    } catch (error) {
      failure = committing
        ? new LedgerFailure('OUTCOME_UNKNOWN', true, 'COMMIT')
        : error instanceof LedgerFailure
          ? error
          : new LedgerFailure(
              fieldSafeCode(error) === 11000
                ? 'RETRY_LATER'
                : 'CONTROL_UNAVAILABLE',
              false,
              writing ? 'DRIVER' : 'READ',
            );
    } finally {
      if (session) {
        try {
          if (!committing && session.inTransaction()) {
            await session.abortTransaction({
              timeoutMS: 2000,
            });
            // Driver resolution/local state alone is not a positive abort ACK.
            if (writeAttempted) cleanup.push('ABORT_UNCONFIRMED');
          }
        } catch {
          cleanup.push('ABORT');
        } finally {
          try {
            await session.endSession({ timeoutMS: 2000 });
          } catch {
            cleanup.push('END_SESSION');
          }
          if (!session.hasEnded) cleanup.push('NOT_ENDED');
        }
      }
    }
    if (cleanup.length) {
      work.uncertain();
      throw new LedgerFailure(
        'OUTCOME_UNKNOWN',
        writing,
        failure?.primary ?? (writing ? 'DRIVER' : 'READ'),
        cleanup,
        failure?.primaryCode ?? 'CONTROL_UNAVAILABLE',
      );
    }
    if (failure) throw failure;
    return value as T;
  }
  return {
    read: (work, operation) => run(work, false, operation),
    transaction: (work, operation) => run(work, true, operation),
  };
}
function fieldSafeCode(input: unknown): unknown {
  if (!input || typeof input !== 'object' || types.isProxy(input))
    return undefined;
  const d = Object.getOwnPropertyDescriptor(input, 'code');
  return d && 'value' in d ? d.value : undefined;
}

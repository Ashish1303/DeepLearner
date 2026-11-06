import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import type { AuthContext } from '../auth/access-token.service.js';
import { aiUsageTimeAt } from './ai-usage-control.schema.js';
import { privateLedgerOperationDto } from './ai-usage-ledger.dto.js';
import {
  ledgerBounds,
  ledgerDate,
  ledgerDigest,
  ledgerEnum,
  ledgerHex,
  ledgerId,
  ledgerInteger,
  ledgerIntentFingerprint,
  ledgerRequestDigest,
  ledgerNullable,
  ledgerObject,
  ledgerObjectId,
  ledgerSame,
  ledgerTime,
  ledgerUuid,
  paiseFromBigInt,
  paiseToBigInt,
  validateLedgerCommand,
  validateLedgerControl,
  validateLedgerEvidence,
  validateLedgerOperation,
  validateLedgerPeriod,
  validateLedgerQuote,
  validateReserveCommand,
  type LedgerCode,
  type LedgerControl,
  type LedgerOperation,
  type LedgerReserveCommand,
} from './ai-usage-ledger.schema.js';
import {
  assertLedgerLinkage,
  proposeLedgerAdmission,
  proposeLedgerTransition,
  type LedgerProposal,
} from './ai-usage-ledger.transitions.js';
import {
  assertLedgerAuditLink,
  ledgerAuditFor,
  LedgerFailure,
  type LedgerReader,
  type LedgerRepository,
  type LedgerTransaction,
  type LedgerWork,
} from './ai-usage-ledger.repository.js';

export interface LedgerAuthority {
  actor: AuthContext | undefined;
  requestId: string;
  verify(): Promise<AuthContext>;
  signal?: AbortSignal;
}
const auth = (value: unknown) =>
  ledgerObject(value, {
    sub: ledgerId,
    sid: ledgerId,
    role: (v) => ledgerEnum(v, ['ADMIN', 'STUDENT'] as const),
    plan: (v) => ledgerEnum(v, ['FREE', 'PREMIUM'] as const),
  });
const profile = (value: unknown) =>
  ledgerObject(value, {
    policyVersion: ledgerUuid,
    profileVersion: ledgerUuid,
    pricingVersion: ledgerUuid,
    privacyVersion: ledgerUuid,
    spendingApprovalRef: ledgerUuid,
    inputTokenLimit: (v) => ledgerInteger(v, 1),
  });
const intent = (value: unknown) =>
  ledgerObject(value, {
    technologyId: ledgerId,
    source: (v) =>
      ledgerObject(v, {
        id: ledgerId,
        revision: (x) => {
          if (x !== 1) throw new LedgerFailure();
          return 1 as const;
        },
        digest: ledgerDigest,
      }),
    requestDigest: ledgerDigest,
    requestBounds: ledgerBounds,
  });
export type LedgerProfile = ReturnType<typeof profile>;
export type LedgerIntent = ReturnType<typeof intent>;
export type LedgerReceipt = {
  id: string | null;
  kind: 'FINAL_COST' | 'DEFINITELY_UNSENT';
};
export interface LedgerDependencies {
  repository: LedgerRepository;
  now(): number;
  monotonic(): number;
  newId(): Types.ObjectId;
  resolveIntent(
    authority: Readonly<AuthContext>,
    command: LedgerReserveCommand,
    tx: LedgerReader,
    work: LedgerWork,
  ): Promise<unknown>;
  resolveProfile(control: LedgerControl, work: LedgerWork): Promise<unknown>;
  resolveQuote(
    intent: LedgerIntent,
    control: LedgerControl,
    now: number,
    work: LedgerWork,
  ): Promise<unknown>;
  verifyEvidence(
    operation: LedgerOperation,
    receipt: LedgerReceipt,
    work: LedgerWork,
  ): Promise<unknown>;
}
type Recorded = {
  kind: 'RECORDED';
  operation: ReturnType<typeof privateLedgerOperationDto>;
};
type Refused = {
  kind: 'REFUSED';
  code: LedgerCode;
  message: 'AI usage operation cannot proceed';
};
type UnknownOutcome = {
  kind: 'OUTCOME_UNKNOWN';
  code: 'OUTCOME_UNKNOWN';
  message: 'Outcome is uncertain; reconcile without replay';
  operationId: string;
};
type Unresolved = { kind: 'UNRESOLVED'; operationId: string };
export type LedgerOutcome = Recorded | Refused | UnknownOutcome | Unresolved;
const refuse = (code: LedgerCode): Refused => ({
  kind: 'REFUSED',
  code,
  message: 'AI usage operation cannot proceed',
});
const unresolved = (operationId: string): Unresolved => ({
  kind: 'UNRESOLVED',
  operationId,
});
const unknown = (operationId: string): UnknownOutcome => ({
  kind: 'OUTCOME_UNKNOWN',
  code: 'OUTCOME_UNKNOWN',
  message: 'Outcome is uncertain; reconcile without replay',
  operationId,
});
const flags = {
  sourceEligible: false,
  profileCurrent: false,
  pricingKnown: false,
  evidenceVerified: false,
  definitelyUnsent: false,
};
const stored = <T>(validate: (input: unknown) => T, input: unknown): T => {
  try {
    return validate(input);
  } catch {
    throw new LedgerFailure();
  }
};

/** Internal composition only. No defaults, startup registration or adapter dispatch. */
export function createAiUsageLedgerService(
  dependencies?: Partial<LedgerDependencies>,
) {
  async function run(
    authority: LedgerAuthority,
    operationId: string,
    reading: boolean,
    operation: (work: LedgerWork, actor: AuthContext) => Promise<LedgerOutcome>,
  ): Promise<LedgerOutcome> {
    let actor: AuthContext;
    try {
      if (!authority?.actor) return refuse('UNAUTHENTICATED');
      actor = auth(authority.actor);
      if (actor.role !== 'ADMIN') return refuse('FORBIDDEN');
      if (
        typeof authority.verify !== 'function' ||
        typeof authority.requestId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}(?![\s\S])/.test(authority.requestId)
      )
        return refuse('INVALID_INPUT');
    } catch {
      return refuse('INVALID_INPUT');
    }
    const required = [
      'now',
      'monotonic',
      'newId',
      'resolveIntent',
      'resolveProfile',
      'resolveQuote',
      'verifyEvidence',
    ] as const;
    if (
      !dependencies?.repository ||
      required.some((key) => typeof dependencies?.[key] !== 'function')
    )
      return refuse('CONTROL_UNAVAILABLE');
    const d = dependencies as LedgerDependencies;
    let closed = false,
      mutated = false,
      committing = false,
      uncertain = false;
    let initial: number, last: number;
    try {
      initial = d.monotonic();
      last = initial;
      if (!Number.isFinite(initial)) throw new LedgerFailure();
    } catch {
      return refuse('CONTROL_UNAVAILABLE');
    }
    const abort = new AbortController();
    let lose: (e: LedgerFailure) => void = () => {};
    const loss = new Promise<never>((_, reject) => {
      lose = reject;
    });
    const close = () => {
      closed = true;
      abort.abort();
      lose(
        new LedgerFailure(
          'CONTROL_UNAVAILABLE',
          !reading && (mutated || committing),
        ),
      );
    };
    const work: LedgerWork = {
      signal: abort.signal,
      remaining() {
        const current = d.monotonic(),
          left = Math.floor(10000 - (current - initial));
        if (
          closed ||
          authority.signal?.aborted ||
          !Number.isFinite(current) ||
          current < last ||
          left < 1
        )
          throw new LedgerFailure(
            'CONTROL_UNAVAILABLE',
            !reading && (mutated || committing),
          );
        last = current;
        return left;
      },
      check() {
        work.remaining();
      },
      async verify() {
        work.check();
        const began = d.monotonic();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const current = await Promise.race([
            Promise.resolve().then(() => authority.verify()),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => {
                  close();
                  reject(new LedgerFailure('FORBIDDEN'));
                },
                Math.min(5000, work.remaining()),
              );
            }),
          ]);
          work.check();
          if (
            d.monotonic() - began >= 5000 ||
            !ledgerSame(auth(current), actor)
          )
            throw new LedgerFailure('FORBIDDEN');
        } catch (error) {
          if (error instanceof LedgerFailure) throw error;
          if (
            error instanceof AppError &&
            [
              'AUTH_ACCESS_TOKEN_MISSING',
              'AUTH_ACCESS_TOKEN_INVALID',
              'AUTH_ACCESS_TOKEN_EXPIRED',
            ].includes(error.code)
          )
            throw new LedgerFailure('UNAUTHENTICATED');
          if (error instanceof AppError && error.code === 'AUTH_FORBIDDEN')
            throw new LedgerFailure('FORBIDDEN');
          throw new LedgerFailure();
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      },
      async beforeCommit() {
        work.check();
      },
      finalize() {
        work.check();
      },
      mutation() {
        work.check();
        mutated = true;
      },
      commit() {
        work.check();
        committing = true;
      },
      uncertain() {
        uncertain = true;
      },
    };
    const timer = setTimeout(close, 10000);
    authority.signal?.addEventListener('abort', close, { once: true });
    try {
      work.check();
      const result = await Promise.race([
        Promise.resolve().then(() => operation(work, actor)),
        loss,
      ]);
      work.check();
      return result;
    } catch (error) {
      if (reading) {
        if (
          error instanceof LedgerFailure &&
          ['FORBIDDEN', 'UNAUTHENTICATED'].includes(error.code)
        )
          return refuse(error.code);
        return unresolved(operationId);
      }
      if (
        committing ||
        uncertain ||
        (error instanceof LedgerFailure && error.uncertain)
      )
        return unknown(operationId);
      return refuse(
        error instanceof LedgerFailure ? error.code : 'CONTROL_UNAVAILABLE',
      );
    } finally {
      closed = true;
      abort.abort();
      clearTimeout(timer);
      authority.signal?.removeEventListener('abort', close);
    }
  }
  const deps = () => dependencies as LedgerDependencies;
  async function authorize(
    reader: LedgerReader,
    work: LedgerWork,
    actor: AuthContext,
  ) {
    const began = deps().monotonic();
    await work.verify();
    const left = Math.min(
      5000 - (deps().monotonic() - began),
      work.remaining(),
    );
    if (left < 1) throw new LedgerFailure('FORBIDDEN');
    const raw = await reader.actor(new Types.ObjectId(actor.sub), left);
    work.check();
    if (raw === null) throw new LedgerFailure('FORBIDDEN');
    const user = stored(
      (v) =>
        ledgerObject(v, {
          _id: ledgerObjectId,
          role: (x) => ledgerEnum(x, ['ADMIN', 'STUDENT'] as const),
          status: (x) =>
            ledgerEnum(x, [
              'ACTIVE',
              'DISABLED',
              'SUSPENDED',
              'PENDING_VERIFICATION',
            ] as const),
          emailVerifiedAt: ledgerNullable(ledgerDate),
          __v: (x) => ledgerInteger(x, 0, Number.MAX_SAFE_INTEGER - 1),
        }),
      raw,
    );
    if (
      deps().monotonic() - began >= 5000 ||
      ledgerHex(user._id) !== actor.sub ||
      user.role !== 'ADMIN' ||
      user.status !== 'ACTIVE' ||
      user.emailVerifiedAt === null
    )
      throw new LedgerFailure('FORBIDDEN');
    return user;
  }
  async function snapshot(
    reader: LedgerReader,
    work: LedgerWork,
    op: LedgerOperation | null,
  ) {
    const control = stored(validateLedgerControl, await reader.control());
    const opens = await reader.open();
    work.check();
    if (opens.length > 1) throw new LedgerFailure();
    const active = opens.length
      ? stored(validateLedgerOperation, opens[0])
      : null;
    assertLedgerLinkage(control, active, op);
    if (active) {
      const p = stored(
        validateLedgerPeriod,
        await reader.period(active.periodKey),
      );
      if (
        p.periodKey !== active.periodKey ||
        !ledgerSame(p.heldPaise, active.heldPaise) ||
        p.updatedAt.getTime() < active.updatedAt.getTime()
      )
        throw new LedgerFailure();
      assertLedgerAuditLink(active, await reader.audit(active.lastAuditId));
    }
    const now = ledgerTime(deps().now());
    if (now < control.updatedAt.getTime()) throw new LedgerFailure();
    const currentRaw = await reader.period(aiUsageTimeAt(now).periodKey);
    const current =
      currentRaw === null ? null : stored(validateLedgerPeriod, currentRaw);
    if (
      current &&
      (current.periodKey !== aiUsageTimeAt(now).periodKey ||
        paiseToBigInt(current.heldPaise) !==
          (active?.periodKey === current.periodKey
            ? paiseToBigInt(active.heldPaise)
            : 0n))
    )
      throw new LedgerFailure();
    if (op) {
      const p = stored(validateLedgerPeriod, await reader.period(op.periodKey));
      if (
        p.periodKey !== op.periodKey ||
        p.updatedAt.getTime() < op.updatedAt.getTime() ||
        (op.actualPaise !== null &&
          paiseToBigInt(p.settledPaise) < paiseToBigInt(op.actualPaise))
      )
        throw new LedgerFailure();
      assertLedgerAuditLink(op, await reader.audit(op.lastAuditId));
      const marker = stored(
        validateLedgerOperation,
        await reader.minute(op.actorId, op.admissionWindowKey),
      );
      if (!ledgerSame(marker, op)) throw new LedgerFailure();
    }
    return { control, active, current, now };
  }
  async function recorded(
    reader: LedgerReader,
    work: LedgerWork,
    actor: AuthContext,
    originalActor: string,
    key: string,
  ): Promise<Recorded | null> {
    await authorize(reader, work, actor);
    const raw = await reader.operation(new Types.ObjectId(originalActor), key);
    work.check();
    if (raw === null) return null;
    const op = stored(validateLedgerOperation, raw);
    if (ledgerHex(op.actorId) !== originalActor || op.operationId !== key)
      throw new LedgerFailure();
    const s = await snapshot(reader, work, op);
    if (!s.current) throw new LedgerFailure();
    return {
      kind: 'RECORDED',
      operation: privateLedgerOperationDto(op, {
        actorId: originalActor,
        nowMs: s.now,
        control: s.control,
        currentPeriod: s.current,
        activeOperation: s.active,
      }),
    };
  }
  async function currentProfile(control: LedgerControl, work: LedgerWork) {
    const resolved = stored(
      profile,
      await deps().resolveProfile(control, work),
    );
    work.check();
    for (const key of [
      'policyVersion',
      'profileVersion',
      'pricingVersion',
      'privacyVersion',
      'spendingApprovalRef',
    ] as const)
      if (resolved[key] !== control[key])
        throw new LedgerFailure('CONTROL_UNAVAILABLE');
    return resolved;
  }
  async function resolveIntent(
    actor: AuthContext,
    command: LedgerReserveCommand,
    reader: LedgerReader,
    work: LedgerWork,
  ) {
    const value = stored(
      intent,
      await deps().resolveIntent(actor, command, reader, work),
    );
    work.check();
    const expected = intent({
      technologyId: command.technologyId,
      source: command.source,
      requestBounds: command.requestBounds,
      requestDigest: ledgerRequestDigest({
        instructions: command.instructions,
        inputJson: command.inputJson,
      }),
    });
    if (!ledgerSame(value, expected))
      throw new LedgerFailure('SOURCE_UNAVAILABLE');
    return value;
  }
  async function fence(
    tx: LedgerTransaction,
    work: LedgerWork,
    actor: AuthContext,
  ) {
    const user = await authorize(tx, work, actor);
    if (
      !user.emailVerifiedAt ||
      !(await tx.fence(user._id, user.__v, user.emailVerifiedAt))
    )
      throw new LedgerFailure('FORBIDDEN');
    work.check();
  }
  function requireProposal(
    value: ReturnType<typeof proposeLedgerAdmission>,
  ): LedgerProposal {
    if (value.kind === 'REFUSED') throw new LedgerFailure(value.code);
    return value;
  }
  async function apply(
    tx: LedgerTransaction,
    work: LedgerWork,
    actor: AuthContext,
    authority: LedgerAuthority,
    p: LedgerProposal,
    insertPeriod: boolean,
  ) {
    if (!p.auditAction || p.readOnly) throw new LedgerFailure();
    await fence(tx, work, actor);
    await tx.apply(
      p,
      insertPeriod,
      ledgerAuditFor(
        p.next.operation,
        p.auditAction,
        new Types.ObjectId(actor.sub),
        authority.requestId,
        p.next.control.freezeReasons,
      ),
    );
    work.check();
  }
  async function readAfter(
    work: LedgerWork,
    actor: AuthContext,
    originalActor: string,
    key: string,
  ): Promise<LedgerOutcome> {
    try {
      return (
        (await deps().repository.read(work, (reader) =>
          recorded(reader, work, actor, originalActor, key),
        )) ?? unknown(key)
      );
    } catch {
      return unknown(key);
    }
  }
  async function reserve(
    authority: LedgerAuthority,
    input: unknown,
  ): Promise<LedgerOutcome> {
    let command: LedgerReserveCommand;
    try {
      command = validateReserveCommand(input);
    } catch {
      return refuse('INVALID_INPUT');
    }
    return run(authority, command.operationId, false, async (work, actor) => {
      const prior = await deps().repository.read(work, async (reader) => {
        const result = await recorded(
          reader,
          work,
          actor,
          actor.sub,
          command.operationId,
        );
        if (result) {
          const op = stored(
            validateLedgerOperation,
            await reader.operation(
              new Types.ObjectId(actor.sub),
              command.operationId,
            ),
          );
          if (
            op.intentFingerprint !==
            ledgerIntentFingerprint({ actorId: actor.sub, command })
          )
            throw new LedgerFailure('OPERATION_CONFLICT');
        }
        return result;
      });
      if (prior) return prior;
      try {
        await deps().repository.transaction(work, async (tx) => {
          await authorize(tx, work, actor);
          if (
            (await tx.operation(
              new Types.ObjectId(actor.sub),
              command.operationId,
            )) !== null
          )
            throw new LedgerFailure('RETRY_LATER');
          const s = await snapshot(tx, work, null);
          const resolved = await resolveIntent(actor, command, tx, work);
          const trustedProfile = await currentProfile(s.control, work);
          const quote = stored(
            validateLedgerQuote,
            await deps().resolveQuote(resolved, s.control, s.now, work),
          );
          work.check();
          if (quote.inputTokenUpperBound > trustedProfile.inputTokenLimit)
            throw new LedgerFailure('QUOTE_MISMATCH');
          let period = s.current;
          if (period === null) {
            if (s.active || s.control.activeOperationId !== null)
              throw new LedgerFailure('USAGE_FROZEN');
            period = validateLedgerPeriod({
              _id: ledgerObjectId(deps().newId()),
              schemaVersion: 1,
              scope: s.control.scope,
              periodKey: aiUsageTimeAt(s.now).periodKey,
              version: 0,
              settledPaise: paiseFromBigInt(0n),
              heldPaise: paiseFromBigInt(0n),
              createdAt: new Date(s.now),
              updatedAt: new Date(s.now),
            });
          }
          const marker = await tx.minute(
            new Types.ObjectId(actor.sub),
            aiUsageTimeAt(s.now).actorWindowKey,
          );
          work.check();
          if (marker !== null) {
            const old = stored(validateLedgerOperation, marker);
            if (
              ledgerHex(old.actorId) !== actor.sub ||
              old.admissionWindowKey !== aiUsageTimeAt(s.now).actorWindowKey
            )
              throw new LedgerFailure();
          }
          const p = requireProposal(
            proposeLedgerAdmission({
              nowMs: s.now,
              authority: {
                actorId: actor.sub,
                currentAdmin: true,
                sessionCurrent: true,
                mutationFenced: true,
              },
              control: s.control,
              period,
              activeOperation: s.active,
              actorWindowUsed: marker === null ? 0 : 1,
              command,
              quote,
              operationDocumentId: ledgerObjectId(deps().newId()),
              nextAuditId: ledgerObjectId(deps().newId()),
              facts: {
                ...flags,
                sourceEligible: true,
                profileCurrent: true,
                pricingKnown: true,
              },
            }),
          );
          work.beforeCommit = async () => {
            if (
              !ledgerSame(
                await currentProfile(p.next.control, work),
                trustedProfile,
              )
            )
              throw new LedgerFailure('CONTROL_UNAVAILABLE');
          };
          work.finalize = () => {
            const now = ledgerTime(deps().now());
            if (
              now < s.now ||
              !ledgerSame(aiUsageTimeAt(now), aiUsageTimeAt(s.now))
            )
              throw new LedgerFailure('RETRY_LATER');
            if (now < quote.effectiveAtMs || now >= quote.expiresAtMs)
              throw new LedgerFailure('QUOTE_EXPIRED');
          };
          await apply(tx, work, actor, authority, p, s.current === null);
        });
      } catch (error) {
        if (
          error instanceof LedgerFailure &&
          error.code === 'RETRY_LATER' &&
          !error.uncertain
        ) {
          const found = await deps().repository.read(work, async (reader) => {
            const result = await recorded(
              reader,
              work,
              actor,
              actor.sub,
              command.operationId,
            );
            if (result) {
              const op = stored(
                validateLedgerOperation,
                await reader.operation(
                  new Types.ObjectId(actor.sub),
                  command.operationId,
                ),
              );
              if (
                op.intentFingerprint !==
                ledgerIntentFingerprint({ actorId: actor.sub, command })
              )
                throw new LedgerFailure('OPERATION_CONFLICT');
            }
            return result;
          });
          if (found) return found;
        }
        throw error;
      }
      return readAfter(work, actor, actor.sub, command.operationId);
    });
  }
  async function readOperation(
    authority: LedgerAuthority,
    input: unknown,
  ): Promise<LedgerOutcome> {
    let command;
    try {
      command = ledgerObject(input, { operationId: ledgerUuid });
    } catch {
      return refuse('INVALID_INPUT');
    }
    return run(
      authority,
      command.operationId,
      true,
      async (work, actor) =>
        (await deps().repository.read(work, (reader) =>
          recorded(reader, work, actor, actor.sub, command.operationId),
        )) ?? unresolved(command.operationId),
    );
  }
  async function transition(
    action:
      | 'CLAIM_DISPATCH'
      | 'CANCEL_UNSENT'
      | 'SETTLE'
      | 'MARK_UNCERTAIN'
      | 'RECONCILE',
    authority: LedgerAuthority,
    input: unknown,
    context: unknown = null,
  ): Promise<LedgerOutcome> {
    let command: ReturnType<typeof validateLedgerCommand>;
    try {
      command = validateLedgerCommand(action, input);
    } catch {
      return refuse('INVALID_INPUT');
    }
    return run(authority, command.operationId, false, async (work, actor) => {
      const originalActor =
        action === 'RECONCILE' && 'originalActorId' in command
          ? ledgerId(command.originalActorId)
          : actor.sub;
      await deps().repository.transaction(work, async (tx) => {
        await authorize(tx, work, actor);
        const op = stored(
          validateLedgerOperation,
          await tx.operation(
            new Types.ObjectId(originalActor),
            command.operationId,
          ),
        );
        if (
          op.operationId !== command.operationId ||
          ledgerHex(op.actorId) !== originalActor
        )
          throw new LedgerFailure('OPERATION_CONFLICT');
        const s = await snapshot(tx, work, op);
        const period = stored(
          validateLedgerPeriod,
          await tx.period(op.periodKey),
        );
        work.finalize = () => {
          const now = ledgerTime(deps().now());
          if (
            now < s.now ||
            (action === 'SETTLE' &&
              op.open &&
              op.state === 'DISPATCH_CLAIMED' &&
              op.claim &&
              now >= op.claim.observeUntil.getTime())
          )
            throw new LedgerFailure('STATE_CONFLICT');
        };
        let evidence: ReturnType<typeof validateLedgerEvidence> | null = null,
          claim = null,
          request: unknown = null;
        const facts = { ...flags };
        if (action === 'CLAIM_DISPATCH') {
          const ctx = ledgerObject(context, {
            claimId: ledgerUuid,
            ownerId: ledgerUuid,
            request: (v) => v,
          });
          request = ctx.request;
          claim = {
            id: ctx.claimId,
            ownerId: ctx.ownerId,
            claimedAt: new Date(s.now),
            observeUntil: new Date(s.now + op.requestBounds.budgetMs),
          };
          const rawRequest = ledgerObject(request, {
            schemaVersion: (v) => {
              if (v !== 1) throw new LedgerFailure();
              return 1;
            },
            purpose: (v) => {
              if (v !== 'CURRICULUM_OUTLINE') throw new LedgerFailure();
              return v;
            },
            instructions: (v) => v,
            inputJson: (v) => v,
            maxOutputBytes: (v) => ledgerInteger(v, 2, 65536),
            maxOutputTokens: (v) => ledgerInteger(v, 1, 4096),
          });
          const bound = validateReserveCommand({
            operationId: op.operationId,
            technologyId: ledgerHex(op.technologyId),
            source: {
              id: ledgerHex(op.source.id),
              revision: 1,
              digest: op.source.digest,
            },
            instructions: rawRequest.instructions,
            inputJson: rawRequest.inputJson,
            requestBounds: op.requestBounds,
          });
          await resolveIntent(actor, bound, tx, work);
          const p = await currentProfile(s.control, work);
          if (op.quote.inputTokenUpperBound > p.inputTokenLimit)
            throw new LedgerFailure('QUOTE_MISMATCH');
          facts.sourceEligible = true;
          facts.profileCurrent = true;
          facts.pricingKnown = true;
          work.beforeCommit = async () => {
            if (!ledgerSame(await currentProfile(s.control, work), p))
              throw new LedgerFailure();
          };
          work.finalize = () => {
            const now = ledgerTime(deps().now());
            if (
              now < s.now ||
              now >= op.quote.expiresAtMs ||
              now >= claim!.observeUntil.getTime() ||
              aiUsageTimeAt(now).periodKey !== op.periodKey
            )
              throw new LedgerFailure('QUOTE_EXPIRED');
          };
        } else if (action !== 'MARK_UNCERTAIN') {
          const receipt =
            action === 'CANCEL_UNSENT'
              ? { id: null, kind: 'DEFINITELY_UNSENT' as const }
              : ledgerObject(context, {
                  id: ledgerUuid,
                  kind: (v) =>
                    ledgerEnum(v, ['FINAL_COST', 'DEFINITELY_UNSENT'] as const),
                });
          evidence = stored(
            validateLedgerEvidence,
            await deps().verifyEvidence(op, receipt, work),
          );
          work.check();
          if (
            evidence.kind !== receipt.kind ||
            (receipt.id !== null && evidence.id !== receipt.id)
          )
            throw new LedgerFailure('STATE_CONFLICT');
          facts.evidenceVerified = true;
          facts.definitelyUnsent = evidence.kind === 'DEFINITELY_UNSENT';
          facts.pricingKnown = true;
        }
        if (!op.open) {
          // authorize() qualified the actual current performer. Explicit internal
          // reconciliation may inspect another historical actor; never fabricate
          // current authorization for that deleted/demoted original actor.
          if (
            !evidence ||
            !op.terminalEvidence ||
            !ledgerSame(evidence, op.terminalEvidence)
          )
            throw new LedgerFailure('STATE_CONFLICT');
          return;
        }
        const p = requireProposal(
          proposeLedgerTransition(action, {
            nowMs: s.now,
            authority: {
              actorId: actor.sub,
              currentAdmin: true,
              sessionCurrent: true,
              mutationFenced: true,
            },
            control: s.control,
            period,
            activeOperation: s.active,
            operation: op,
            command,
            nextAuditId: ledgerObjectId(deps().newId()),
            claim,
            evidence,
            request,
            facts,
          }),
        );
        await apply(tx, work, actor, authority, p, false);
      });
      return readAfter(work, actor, originalActor, command.operationId);
    });
  }
  return {
    reserve,
    readOperation,
    claimDispatch: (a: LedgerAuthority, c: unknown, context: unknown) =>
      transition('CLAIM_DISPATCH', a, c, context),
    cancelUnsent: (a: LedgerAuthority, c: unknown) =>
      transition('CANCEL_UNSENT', a, c),
    settle: (a: LedgerAuthority, c: unknown, e: unknown) =>
      transition('SETTLE', a, c, e),
    markUncertain: (a: LedgerAuthority, c: unknown) =>
      transition('MARK_UNCERTAIN', a, c),
    reconcile: (a: LedgerAuthority, c: unknown, e: unknown) =>
      transition('RECONCILE', a, c, e),
  };
}

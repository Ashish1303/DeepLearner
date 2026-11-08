import { Types, type ClientSession } from 'mongoose';
import {
  ledgerDate,
  ledgerDigest,
  ledgerEnum,
  ledgerHex,
  ledgerId,
  ledgerInteger,
  ledgerNullable,
  ledgerObject,
  ledgerObjectId,
  ledgerUuid,
} from './ai-usage-ledger.schema.js';
import type {
  OutlineClock,
  OutlineWork,
} from './curriculum-outline-producer.service.js';

/** Unregistered OFFLINE boundary. Adapters and credentials are supplied, not
 * authenticated by this helper. The caller owns the active native transaction,
 * full immutable source/binding validation, attempt CAS/audit, commit and cleanup.
 * No result below is a transferable permission or a durable completion receipt.
 */
type Session = Pick<ClientSession, 'inTransaction' | 'hasEnded'>;
type Options = Readonly<{ session: Session; maxTimeMS: number }>;
type ReadOptions = Options & { projection: Record<string, 1> };
export interface OutlineFenceCollection {
  findOne(
    filter: Record<string, unknown>,
    options: ReadOptions,
  ): Promise<unknown>;
  updateOne(
    filter: Record<string, unknown>,
    update: { $inc: { __v: 1 } },
    options: Options & { upsert: false },
  ): Promise<unknown>;
}
export interface OutlineFencePorts {
  readonly session: Session;
  readonly users: OutlineFenceCollection;
  readonly sessions: OutlineFenceCollection;
  readonly attempts: Pick<OutlineFenceCollection, 'findOne'>;
  /** Must independently reverify the original server-held credential each time.
   * A synthetic AuthContext or posted sid cannot establish genuine authority. */
  verify(): Promise<unknown>;
  readonly clock: OutlineClock;
  readonly loss: AbortSignal;
  readonly work: OutlineWork;
}
export type OutlineFenceOutcome = Readonly<{
  kind:
    'CHECKED' | 'FENCED' | 'PRECOMMIT_CHECKED' | 'REFUSED' | 'OUTCOME_UNKNOWN';
}>;
const outcome = (kind: OutlineFenceOutcome['kind']): OutlineFenceOutcome =>
  Object.freeze({ kind });
const invalid = () =>
  new Error('Curriculum outline session fence is unavailable');
const version = (v: unknown) =>
  ledgerInteger(v, 0, Number.MAX_SAFE_INTEGER - 1);
const nil = (v: unknown): null => {
  if (v !== null) throw invalid();
  return null;
};
function invocation(v: unknown) {
  return ledgerObject(v, {
    claimVersion: (x) => ledgerInteger(x, 1),
    id: ledgerUuid,
    ownerId: ledgerUuid,
    claimedAt: ledgerDate,
    observeUntil: ledgerDate,
    markedAt: ledgerDate,
  });
}
const invocationKey = (v: ReturnType<typeof invocation>) =>
  JSON.stringify([
    v.claimVersion,
    v.id,
    v.ownerId,
    ...[v.claimedAt, v.observeUntil, v.markedAt].map((d) => d.toISOString()),
  ]);
function request(v: unknown) {
  const r = ledgerObject(v, {
    mode: (x) => ledgerEnum(x, ['MARK', 'CAPTURE', 'READ'] as const),
    actorId: ledgerId,
    originSessionId: ledgerId,
    requestingSessionId: ledgerId,
    attemptId: ledgerId,
    bindingDigest: ledgerDigest,
    expectedVersion: version,
    phase: (x) =>
      ledgerEnum(x, [
        'PREPARED',
        'INVOCATION_MARKED',
        'COMPLETION_STORED',
        'ADMITTED',
        'REFUSED',
      ] as const),
    invocation: ledgerNullable(invocation),
  });
  if (r.mode !== 'READ' && r.requestingSessionId !== r.originSessionId)
    throw invalid();
  if (
    r.mode === 'MARK' &&
    (r.phase !== 'PREPARED' || r.expectedVersion !== 0 || r.invocation !== null)
  )
    throw invalid();
  if (
    r.mode === 'CAPTURE' &&
    (r.phase !== 'INVOCATION_MARKED' ||
      r.expectedVersion < 1 ||
      r.invocation === null)
  )
    throw invalid();
  return r;
}

/** One retained context, one fence, one precommit check; no retry or fallback.
 * READ can use a separately verified current sid of the same actor. It cannot
 * revive first capture under another origin sid. Native attempt writes are absent.
 */
export function createOutlineSessionFence(
  input: unknown,
  ports: OutlineFencePorts,
) {
  let r: ReturnType<typeof request> | undefined;
  try {
    r = request(input);
  } catch {
    /* All public failures are content-free. */
  }
  let retired = false,
    busy = false,
    checked = false,
    fenced = false,
    precommitted = false,
    sent = false;
  let expiresAt = 0;
  let started: number | undefined;
  let authorizationUntil: number | undefined;
  let lastUtc = -1,
    lastMono = -1;
  const session = ports.session;
  function check() {
    if (
      !r ||
      retired ||
      ports.loss.aborted ||
      ports.work.signal.aborted ||
      !session ||
      session.hasEnded !== false ||
      session.inTransaction() !== true
    )
      throw invalid();
    ports.work.check();
    const utc = ledgerDate(
      new Date(ledgerInteger(ports.clock.now(), 0, 253402280199999)),
    ).getTime();
    const mono = ports.clock.monotonic();
    if (!Number.isFinite(mono) || mono < 0 || mono < lastMono || utc < lastUtc)
      throw invalid();
    started ??= mono;
    lastMono = mono;
    lastUtc = utc;
    const remaining = ports.work.remainingMs;
    if (
      !Number.isFinite(remaining) ||
      remaining <= 0 ||
      remaining > 10000 ||
      mono - started >= 10000 ||
      (authorizationUntil !== undefined && mono >= authorizationUntil) ||
      (expiresAt !== 0 && utc >= expiresAt)
    )
      throw invalid();
    if (ports.loss.aborted || ports.work.signal.aborted) throw invalid();
    return { utc, remaining: Math.min(remaining, 10000 - (mono - started)) };
  }
  async function step<T>(
    operation: (maxTimeMS: number) => Promise<T>,
    authorization = false,
  ): Promise<T> {
    const state = check();
    const budget = Math.min(
      state.remaining,
      authorization ? 5000 : 10000,
      authorizationUntil === undefined ? 10000 : authorizationUntil - lastMono,
    );
    let timer: unknown;
    let fail: (() => void) | undefined;
    const stopped = new Promise<never>((_resolve, reject) => {
      fail = () => {
        retired = true;
        reject(invalid());
      };
      ports.loss.addEventListener('abort', fail, { once: true });
      ports.work.signal.addEventListener('abort', fail, { once: true });
      timer = ports.clock.setTimeout(fail, budget);
    });
    try {
      const value = await Promise.race([
        Promise.resolve().then(() => {
          check();
          return operation(Math.max(1, Math.floor(budget)));
        }),
        stopped,
      ]);
      check();
      return value;
    } finally {
      if (fail) {
        ports.loss.removeEventListener('abort', fail);
        ports.work.signal.removeEventListener('abort', fail);
      }
      ports.clock.clearTimeout(timer);
    }
  }
  async function credential() {
    const auth = ledgerObject(await step(() => ports.verify(), true), {
      sub: ledgerId,
      sid: ledgerId,
      role: (x) => ledgerEnum(x, ['ADMIN'] as const),
      plan: (x) => ledgerEnum(x, ['FREE', 'PREMIUM'] as const),
    });
    if (auth.sub !== r!.actorId || auth.sid !== r!.requestingSessionId)
      throw invalid();
  }
  async function load() {
    check();
    authorizationUntil = lastMono + 5000;
    try {
      const records = await loadRecords();
      check();
      return records;
    } finally {
      authorizationUntil = undefined;
    }
  }
  async function loadRecords() {
    await credential();
    const user = ledgerObject(
      await step((maxTimeMS) =>
        ports.users.findOne(
          { _id: ledgerObjectIdFrom(r!.actorId) },
          {
            session,
            maxTimeMS,
            projection: {
              _id: 1,
              role: 1,
              status: 1,
              emailVerifiedAt: 1,
              __v: 1,
            },
          },
        ),
      ),
      {
        _id: ledgerObjectId,
        role: (x) => ledgerEnum(x, ['ADMIN'] as const),
        status: (x) => ledgerEnum(x, ['ACTIVE'] as const),
        emailVerifiedAt: ledgerDate,
        __v: version,
      },
    );
    if (ledgerHex(user._id) !== r!.actorId) throw invalid();
    const current = ledgerObject(
      await step((maxTimeMS) =>
        ports.sessions.findOne(
          {
            _id: ledgerObjectIdFrom(r!.requestingSessionId),
            userId: ledgerObjectIdFrom(r!.actorId),
          },
          {
            session,
            maxTimeMS,
            projection: {
              _id: 1,
              userId: 1,
              revokedAt: 1,
              expiresAt: 1,
              __v: 1,
            },
          },
        ),
      ),
      {
        _id: ledgerObjectId,
        userId: ledgerObjectId,
        revokedAt: nil,
        expiresAt: ledgerDate,
        __v: version,
      },
    );
    if (
      ledgerHex(current._id) !== r!.requestingSessionId ||
      ledgerHex(current.userId) !== r!.actorId
    )
      throw invalid();
    expiresAt = current.expiresAt.getTime();
    check();
    const projection: Record<string, 1> = {
      _id: 1,
      actorId: 1,
      sessionId: 1,
      bindingDigest: 1,
      version: 1,
      phase: 1,
      cancelledAt: 1,
    };
    if (r!.mode !== 'READ')
      Object.assign(projection, { invocation: 1, completion: 1, receipt: 1 });
    const row = await step((maxTimeMS) =>
      ports.attempts.findOne(
        {
          _id: ledgerObjectIdFrom(r!.attemptId),
          actorId: ledgerObjectIdFrom(r!.actorId),
          sessionId: ledgerObjectIdFrom(r!.originSessionId),
          bindingDigest: r!.bindingDigest,
          version: r!.expectedVersion,
          phase: r!.phase,
          ...(r!.mode === 'READ' ? {} : { cancelledAt: null }),
        },
        { session, maxTimeMS, projection },
      ),
    );
    const fields = {
      _id: ledgerObjectId,
      actorId: ledgerObjectId,
      sessionId: ledgerObjectId,
      bindingDigest: ledgerDigest,
      version,
      phase: (x: unknown) =>
        ledgerEnum(x, [
          'PREPARED',
          'INVOCATION_MARKED',
          'COMPLETION_STORED',
          'ADMITTED',
          'REFUSED',
        ] as const),
      cancelledAt: r!.mode === 'READ' ? ledgerNullable(ledgerDate) : nil,
    };
    const a =
      r!.mode === 'READ'
        ? ledgerObject(row, fields)
        : ledgerObject(row, {
            ...fields,
            invocation: r!.mode === 'MARK' ? nil : invocation,
            completion: nil,
            receipt: nil,
          });
    if (
      ledgerHex(a._id) !== r!.attemptId ||
      ledgerHex(a.actorId) !== r!.actorId ||
      ledgerHex(a.sessionId) !== r!.originSessionId ||
      a.bindingDigest !== r!.bindingDigest ||
      a.version !== r!.expectedVersion ||
      a.phase !== r!.phase
    )
      throw invalid();
    if (
      r!.mode === 'CAPTURE' &&
      (!('invocation' in a) ||
        invocationKey(invocation(a.invocation)) !==
          invocationKey(r!.invocation!))
    )
      throw invalid();
    check();
    return { user, current };
  }
  function ack(value: unknown) {
    const a = ledgerObject(value, {
      acknowledged: (x) => {
        if (x !== true) throw invalid();
        return true;
      },
      matchedCount: (x) => {
        if (x !== 1) throw invalid();
        return 1;
      },
      modifiedCount: (x) => {
        if (x !== 1) throw invalid();
        return 1;
      },
      upsertedCount: (x) => {
        if (x !== 0) throw invalid();
        return 0;
      },
      upsertedId: nil,
    });
    return a;
  }
  async function run(
    operation: () => Promise<OutlineFenceOutcome>,
  ): Promise<OutlineFenceOutcome> {
    if (busy) {
      retired = true;
      return outcome(sent ? 'OUTCOME_UNKNOWN' : 'REFUSED');
    }
    busy = true;
    try {
      check();
      const result = await operation();
      check();
      return result;
    } catch {
      retired = true;
      return outcome(sent ? 'OUTCOME_UNKNOWN' : 'REFUSED');
    } finally {
      busy = false;
    }
  }
  return Object.freeze({
    read: () =>
      run(async () => {
        if (checked || fenced || precommitted) throw invalid();
        await load();
        checked = true;
        return outcome('CHECKED');
      }),
    fence: () =>
      run(async () => {
        if (r!.mode === 'READ' || fenced || precommitted) throw invalid();
        const { user, current } = await load();
        ack(
          await step((maxTimeMS) => {
            sent = true;
            return ports.users.updateOne(
              {
                _id: user._id,
                role: 'ADMIN',
                status: 'ACTIVE',
                emailVerifiedAt: user.emailVerifiedAt,
                __v: user.__v,
              },
              { $inc: { __v: 1 } },
              { session, maxTimeMS, upsert: false },
            );
          }),
        );
        ack(
          await step((maxTimeMS) => {
            const { utc } = check();
            sent = true;
            return ports.sessions.updateOne(
              {
                _id: current._id,
                userId: user._id,
                revokedAt: null,
                expiresAt: { $eq: current.expiresAt, $gt: new Date(utc) },
                __v: current.__v,
              },
              { $inc: { __v: 1 } },
              { session, maxTimeMS, upsert: false },
            );
          }),
        );
        check();
        fenced = true;
        return outcome('FENCED');
      }),
    beforeCommit: () =>
      run(async () => {
        if (!fenced || precommitted || r!.mode === 'READ') throw invalid();
        await credential();
        check();
        precommitted = true;
        return outcome('PRECOMMIT_CHECKED');
      }),
  });
}

// Native IDs are constructed only after strict canonical string validation.
// Reuse the installed native representation without importing a registered model.
function ledgerObjectIdFrom(value: string) {
  return new Types.ObjectId(ledgerId(value));
}

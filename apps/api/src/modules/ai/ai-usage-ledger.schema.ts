import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { mongo, Types } from 'mongoose';
import { aiUsageTimeAt } from './ai-usage-control.schema.js';

export const ledgerMaximumPaise = 9007199254740991n;
export const ledgerStates = [
  'RESERVED',
  'DISPATCH_CLAIMED',
  'UNCERTAIN',
  'SETTLED',
  'RELEASED',
] as const;
export const ledgerFreezeReasons = [
  'ACCOUNTING_INVALID',
  'OPERATOR_HOLD',
  'OVERRUN',
  'PRICE_UNKNOWN',
  'UNCERTAIN',
] as const;
export const ledgerCodes = [
  'INVALID_INPUT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'SOURCE_UNAVAILABLE',
  'CONTROL_UNAVAILABLE',
  'QUOTE_MISMATCH',
  'QUOTE_EXPIRED',
  'USAGE_FROZEN',
  'CONCURRENCY_LIMIT',
  'RATE_LIMIT',
  'BUDGET_EXCEEDED',
  'OPERATION_CONFLICT',
  'STATE_CONFLICT',
  'RETRY_LATER',
  'OUTCOME_UNKNOWN',
] as const;
export type LedgerCode = (typeof ledgerCodes)[number];
export function ledgerInvalid(): Error {
  return new Error('Invalid AI usage ledger input');
}
function fail(): never {
  throw ledgerInvalid();
}

/** Exact own data only. No caller getters, proxy traps, coercion or issue formatting. */
export function ledgerObject<
  T extends Record<string, (input: unknown) => unknown>,
>(input: unknown, fields: T): { [K in keyof T]: ReturnType<T[K]> } {
  if (!input || typeof input !== 'object' || types.isProxy(input)) fail();
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) fail();
  const keys = Object.keys(fields),
    own = Reflect.ownKeys(input);
  if (
    own.length !== keys.length ||
    own.some((k) => typeof k !== 'string' || !keys.includes(k))
  )
    fail();
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d || !d.enumerable || !('value' in d)) fail();
    result[key] = fields[key]!(d.value);
  }
  return result as { [K in keyof T]: ReturnType<T[K]> };
}
export function ledgerInteger(
  input: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < min ||
    input > max
  )
    fail();
  return input;
}
export function ledgerBoolean(input: unknown): boolean {
  if (typeof input !== 'boolean') fail();
  return input;
}
function literal<T extends string | number>(value: T) {
  return (input: unknown): T => {
    if (input !== value) fail();
    return value;
  };
}
export function ledgerEnum<const T extends readonly string[]>(
  input: unknown,
  choices: T,
): T[number] {
  if (typeof input !== 'string' || !choices.includes(input)) fail();
  return input as T[number];
}
function pattern(input: unknown, regex: RegExp, max: number): string {
  if (typeof input !== 'string' || input.length > max || !regex.test(input))
    fail();
  return input;
}
export const ledgerId = (v: unknown) =>
  pattern(v, /^[a-f0-9]{24}(?![\s\S])/, 24);
export const ledgerUuid = (v: unknown) =>
  pattern(
    v,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/,
    36,
  );
export const ledgerDigest = (v: unknown) =>
  pattern(v, /^[a-f0-9]{64}(?![\s\S])/, 64);
export const ledgerPeriodKey = (v: unknown) =>
  pattern(v, /^(?:19[7-9]\d|[2-9]\d{3})-(?:0[1-9]|1[0-2])(?![\s\S])/, 7);
const alias = (v: unknown) =>
  pattern(v, /^[a-z0-9][a-z0-9._-]{0,63}(?![\s\S])/, 64);
export const ledgerNullable =
  <T>(check: (v: unknown) => T) =>
  (v: unknown): T | null =>
    v === null ? null : check(v);
export function ledgerTime(input: unknown): number {
  const n = ledgerInteger(input, 0, 253402280199999);
  aiUsageTimeAt(n);
  return n;
}
export function ledgerDate(input: unknown): Date {
  if (
    !input ||
    typeof input !== 'object' ||
    types.isProxy(input) ||
    Object.getPrototypeOf(input) !== Date.prototype ||
    Reflect.ownKeys(input).length !== 0
  )
    fail();
  return new Date(ledgerTime(Date.prototype.getTime.call(input)));
}

/** Current installed BSON's four unsigned 24-bit ObjectId words; fail closed on another representation. */
export function ledgerObjectId(input: unknown): Types.ObjectId {
  if (
    !input ||
    typeof input !== 'object' ||
    types.isProxy(input) ||
    Object.getPrototypeOf(input) !== Types.ObjectId.prototype
  )
    fail();
  const keys = ['i0', 'i1', 'i2', 'i3'];
  if (
    Reflect.ownKeys(input).length !== 4 ||
    Reflect.ownKeys(input).some(
      (k) => typeof k !== 'string' || !keys.includes(k),
    )
  )
    fail();
  let hex = '';
  for (const k of keys) {
    const d = Object.getOwnPropertyDescriptor(input, k);
    if (!d || !d.enumerable || !('value' in d)) fail();
    hex += ledgerInteger(d.value, 0, 0xffffff).toString(16).padStart(6, '0');
  }
  return new Types.ObjectId(hex);
}
export function ledgerHex(input: unknown): string {
  return Types.ObjectId.prototype.toHexString.call(ledgerObjectId(input));
}
export function paiseToBigInt(input: unknown): bigint {
  if (
    !input ||
    typeof input !== 'object' ||
    types.isProxy(input) ||
    Object.getPrototypeOf(input) !== mongo.Long.prototype
  )
    fail();
  const keys = ['low', 'high', 'unsigned'];
  if (
    Reflect.ownKeys(input).length !== 3 ||
    Reflect.ownKeys(input).some(
      (k) => typeof k !== 'string' || !keys.includes(k),
    )
  )
    fail();
  const values: Record<string, unknown> = {};
  for (const k of keys) {
    const d = Object.getOwnPropertyDescriptor(input, k);
    if (!d || !d.enumerable || !('value' in d)) fail();
    values[k] = d.value;
  }
  if (values.unsigned !== false) fail();
  const low = ledgerInteger(values.low, -2147483648, 2147483647),
    high = ledgerInteger(values.high, -2147483648, 2147483647);
  const n = (BigInt(high) << 32n) + BigInt(low >>> 0);
  if (n < 0n || n > ledgerMaximumPaise) fail();
  return n;
}
export function paiseFromBigInt(input: unknown): mongo.Long {
  if (typeof input !== 'bigint' || input < 0n || input > ledgerMaximumPaise)
    fail();
  return mongo.Long.fromBigInt(input);
}
export function paiseFromDecimal(input: unknown): mongo.Long {
  const s = pattern(input, /^(?:0|[1-9]\d{0,15})(?![\s\S])/, 16);
  return paiseFromBigInt(BigInt(s));
}
export function paiseToDecimal(input: unknown): string {
  return paiseToBigInt(input).toString();
}
export function paiseToG1Number(input: unknown): number {
  return Number(paiseToBigInt(input));
}
export function addPaise(a: unknown, b: unknown): mongo.Long {
  return paiseFromBigInt(paiseToBigInt(a) + paiseToBigInt(b));
}
export function subtractPaise(a: unknown, b: unknown): mongo.Long {
  return paiseFromBigInt(paiseToBigInt(a) - paiseToBigInt(b));
}
export function roundPaiseUp(n: unknown, d: unknown): mongo.Long {
  if (
    typeof n !== 'bigint' ||
    typeof d !== 'bigint' ||
    n < 0n ||
    n > ledgerMaximumPaise * ledgerMaximumPaise ||
    d < 1n ||
    d > ledgerMaximumPaise
  )
    fail();
  return paiseFromBigInt((n + d - 1n) / d);
}
const money = (v: unknown) => paiseFromBigInt(paiseToBigInt(v));
const positiveMoney = (v: unknown) => {
  const m = money(v);
  if (paiseToBigInt(m) === 0n) fail();
  return m;
};
function fixedMoney(n: bigint) {
  return (v: unknown) => {
    const m = money(v);
    if (paiseToBigInt(m) !== n) fail();
    return m;
  };
}
const positive = (v: unknown) => ledgerInteger(v, 1);
const scope = literal('SHARED_AI_TESTING'),
  purpose = literal('CURRICULUM_OUTLINE'),
  environment = literal('DEV');
export function ledgerBounds(input: unknown) {
  return ledgerObject(input, {
    instructionBytes: (v) => ledgerInteger(v, 1, 8192),
    inputJsonBytes: (v) => ledgerInteger(v, 2, 65536),
    maxOutputBytes: (v) => ledgerInteger(v, 2, 65536),
    maxOutputTokens: (v) => ledgerInteger(v, 1, 4096),
    budgetMs: (v) => ledgerInteger(v, 1, 10000),
  });
}
export function ledgerReasons(
  input: unknown,
): Array<(typeof ledgerFreezeReasons)[number]> {
  if (
    !Array.isArray(input) ||
    types.isProxy(input) ||
    Object.getPrototypeOf(input) !== Array.prototype
  )
    fail();
  const ld = Object.getOwnPropertyDescriptor(input, 'length');
  const length = ledgerInteger(ld?.value, 0, 5);
  if (Reflect.ownKeys(input).length !== length + 1) fail();
  const out: Array<(typeof ledgerFreezeReasons)[number]> = [];
  for (let i = 0; i < length; i++) {
    const d = Object.getOwnPropertyDescriptor(input, String(i));
    if (!d || !d.enumerable || !('value' in d)) fail();
    out.push(ledgerEnum(d.value, ledgerFreezeReasons));
  }
  if (
    new Set(out).size !== length ||
    out.join(',') !== [...out].sort().join(',')
  )
    fail();
  return out;
}
export function ledgerText(input: unknown, min: number, max: number): string {
  if (typeof input !== 'string' || input.length > max) fail();
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = input.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail();
    } else if (c >= 0xdc00 && c <= 0xdfff) fail();
  }
  const bytes = Buffer.byteLength(input, 'utf8');
  if (bytes < min || bytes > max) fail();
  return input;
}
function instructions(input: unknown): string {
  const s = ledgerText(input, 1, 8192);
  if (!s.trim()) fail();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c < 32 && c !== 9 && c !== 10) || c === 127) fail();
  }
  return s;
}
function inputJson(input: unknown): string {
  const s = ledgerText(input, 2, 65536),
    parsed: unknown = JSON.parse(s);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    fail();
  return s;
}
function requestText(input: unknown) {
  return ledgerObject(input, { instructions, inputJson });
}
function hash(frame: readonly unknown[]): string {
  return createHash('sha256')
    .update(JSON.stringify(frame), 'utf8')
    .digest('hex');
}
function bounded<T extends object>(row: T): T {
  if (mongo.BSON.calculateObjectSize(row) > 65536) fail();
  return row;
}
export function ledgerSame(a: object, b: object): boolean {
  let nodes = 0;
  function inert(v: unknown, depth: number): unknown {
    if (++nodes > 1000 || depth > 12) fail();
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number')
      return ledgerInteger(v, -Number.MAX_SAFE_INTEGER);
    if (typeof v === 'string') return ledgerText(v, 0, 65536);
    if (!v || typeof v !== 'object' || types.isProxy(v)) fail();
    const proto = Object.getPrototypeOf(v);
    if (proto === mongo.Long.prototype) return money(v);
    if (proto === Types.ObjectId.prototype) return ledgerObjectId(v);
    if (proto === Date.prototype) return ledgerDate(v);
    if (Array.isArray(v)) {
      if (proto !== Array.prototype) fail();
      const length = ledgerInteger(
        Object.getOwnPropertyDescriptor(v, 'length')?.value,
        0,
        64,
      );
      if (Reflect.ownKeys(v).length !== length + 1) fail();
      return Array.from({ length }, (_, i) => {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !d.enumerable || !('value' in d)) fail();
        return inert(d.value, depth + 1);
      });
    }
    if (proto !== Object.prototype && proto !== null) fail();
    const keys = Reflect.ownKeys(v);
    if (keys.length > 64) fail();
    const out: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (
        typeof key !== 'string' ||
        key === 'toBSON' ||
        key === '__proto__' ||
        key === 'constructor' ||
        key.startsWith('$') ||
        key.includes('.')
      )
        fail();
      const d = Object.getOwnPropertyDescriptor(v, key);
      if (!d || !d.enumerable || !('value' in d)) fail();
      out[key] = inert(d.value, depth + 1);
    }
    return out;
  }
  try {
    const left = inert(a, 0),
      right = inert(b, 0);
    if (
      mongo.BSON.calculateObjectSize({ v: left }) > 65536 ||
      mongo.BSON.calculateObjectSize({ v: right }) > 65536
    )
      fail();
    return Buffer.from(mongo.BSON.serialize({ v: left })).equals(
      Buffer.from(mongo.BSON.serialize({ v: right })),
    );
  } catch {
    throw ledgerInvalid();
  }
}

function quote(input: unknown) {
  const q = ledgerObject(input, {
    id: ledgerUuid,
    periodKey: ledgerPeriodKey,
    environment,
    purpose,
    policyVersion: ledgerUuid,
    profileVersion: ledgerUuid,
    pricingVersion: ledgerUuid,
    privacyVersion: ledgerUuid,
    spendingApprovalRef: ledgerUuid,
    providerAlias: alias,
    modelAlias: alias,
    templateVersion: ledgerUuid,
    requestDigest: ledgerDigest,
    requestBounds: ledgerBounds,
    inputTokenUpperBound: positive,
    worstCasePaise: positiveMoney,
    effectiveAtMs: ledgerTime,
    expiresAtMs: ledgerTime,
    assumptionsDigest: ledgerDigest,
  });
  if (q.effectiveAtMs >= q.expiresAtMs) fail();
  return bounded(q);
}
export type LedgerQuote = ReturnType<typeof quote>;
export function validateLedgerQuote(input: unknown): LedgerQuote {
  try {
    return quote(input);
  } catch {
    throw ledgerInvalid();
  }
}
export function ledgerRequestDigest(input: unknown): string {
  try {
    const r = requestText(input);
    return hash(['AI_REQUEST', 1, r.instructions, r.inputJson]);
  } catch {
    throw ledgerInvalid();
  }
}
export function ledgerQuoteDigest(input: unknown): string {
  try {
    const q = quote(input),
      b = q.requestBounds;
    return hash([
      'AI_QUOTE',
      1,
      q.id,
      q.periodKey,
      q.environment,
      q.purpose,
      q.policyVersion,
      q.profileVersion,
      q.pricingVersion,
      q.privacyVersion,
      q.spendingApprovalRef,
      q.providerAlias,
      q.modelAlias,
      q.templateVersion,
      q.requestDigest,
      b.instructionBytes,
      b.inputJsonBytes,
      b.maxOutputBytes,
      b.maxOutputTokens,
      b.budgetMs,
      q.inputTokenUpperBound,
      paiseToDecimal(q.worstCasePaise),
      q.effectiveAtMs,
      q.expiresAtMs,
      q.assumptionsDigest,
    ]);
  } catch {
    throw ledgerInvalid();
  }
}
const source = (v: unknown) =>
  ledgerObject(v, { id: ledgerId, revision: literal(1), digest: ledgerDigest });
export function validateReserveCommand(input: unknown) {
  try {
    const r = ledgerObject(input, {
      operationId: ledgerUuid,
      technologyId: ledgerId,
      source,
      instructions,
      inputJson,
      requestBounds: ledgerBounds,
    });
    if (
      Buffer.byteLength(r.instructions, 'utf8') !==
        r.requestBounds.instructionBytes ||
      Buffer.byteLength(r.inputJson, 'utf8') !== r.requestBounds.inputJsonBytes
    )
      fail();
    return r;
  } catch {
    throw ledgerInvalid();
  }
}
export type LedgerReserveCommand = ReturnType<typeof validateReserveCommand>;
export const ledgerActions = [
  'RESERVE',
  'CLAIM_DISPATCH',
  'CANCEL_UNSENT',
  'SETTLE',
  'MARK_UNCERTAIN',
  'RECONCILE',
  'REPLAY_TERMINAL',
] as const;
export type LedgerAction = (typeof ledgerActions)[number];
export function validateLedgerCommand(action: unknown, input: unknown) {
  try {
    if (action === 'RESERVE') return validateReserveCommand(input);
    if (action === 'READ_OPERATION')
      return ledgerObject(input, { operationId: ledgerUuid });
    if (action === 'RECONCILE')
      return ledgerObject(input, {
        originalActorId: ledgerId,
        operationId: ledgerUuid,
        expectedVersion: positive,
      });
    if (action === 'SETTLE' || action === 'MARK_UNCERTAIN')
      return ledgerObject(input, {
        operationId: ledgerUuid,
        expectedVersion: positive,
        claimId: ledgerUuid,
        ownerId: ledgerUuid,
      });
    if (
      action === 'CLAIM_DISPATCH' ||
      action === 'CANCEL_UNSENT' ||
      action === 'REPLAY_TERMINAL'
    )
      return ledgerObject(input, {
        operationId: ledgerUuid,
        expectedVersion: positive,
      });
    fail();
  } catch {
    throw ledgerInvalid();
  }
}
function intentFrame(
  actorId: string,
  operationId: string,
  technologyId: string,
  s: { id: string; revision: number; digest: string },
  requestDigest: string,
  b: ReturnType<typeof ledgerBounds>,
) {
  return hash([
    'AI_INTENT',
    1,
    'SHARED_AI_TESTING',
    actorId,
    operationId,
    'CURRICULUM_OUTLINE',
    technologyId,
    s.id,
    s.revision,
    s.digest,
    requestDigest,
    b.instructionBytes,
    b.inputJsonBytes,
    b.maxOutputBytes,
    b.maxOutputTokens,
    b.budgetMs,
  ]);
}
export function ledgerIntentFingerprint(input: unknown): string {
  try {
    const r = ledgerObject(input, {
      actorId: ledgerId,
      command: validateReserveCommand,
    });
    return intentFrame(
      r.actorId,
      r.command.operationId,
      r.command.technologyId,
      r.command.source,
      ledgerRequestDigest({
        instructions: r.command.instructions,
        inputJson: r.command.inputJson,
      }),
      r.command.requestBounds,
    );
  } catch {
    throw ledgerInvalid();
  }
}
export function ledgerReservationFingerprint(input: unknown): string {
  try {
    const r = ledgerObject(input, {
      intentFingerprint: ledgerDigest,
      periodKey: ledgerPeriodKey,
      admissionWindowKey: (v) =>
        ledgerInteger(v, 0, Math.floor(253402280199999 / 60000)),
      quoteDigest: ledgerDigest,
    });
    return hash([
      'AI_RESERVATION',
      1,
      r.intentFingerprint,
      r.periodKey,
      r.admissionWindowKey,
      r.quoteDigest,
    ]);
  } catch {
    throw ledgerInvalid();
  }
}

function control(input: unknown) {
  const r = ledgerObject(input, {
    _id: ledgerObjectId,
    schemaVersion: literal(1),
    scope,
    version: ledgerInteger,
    policyVersion: ledgerUuid,
    policy: (v) =>
      ledgerObject(v, {
        capPaise: fixedMoney(100000n),
        warningPercent: literal(80),
        timezone: literal('Asia/Kolkata'),
        maxOpen: literal(1),
        maxActorMinute: literal(1),
      }),
    profileVersion: ledgerNullable(ledgerUuid),
    pricingVersion: ledgerNullable(ledgerUuid),
    privacyVersion: ledgerNullable(ledgerUuid),
    spendingApprovalRef: ledgerNullable(ledgerUuid),
    dispatchEnabled: ledgerBoolean,
    frozen: ledgerBoolean,
    freezeReasons: ledgerReasons,
    activeOperationId: ledgerNullable(ledgerObjectId),
    lastAdmissionAt: ledgerNullable(ledgerDate),
    createdAt: ledgerDate,
    updatedAt: ledgerDate,
  });
  if (
    r.frozen !== r.freezeReasons.length > 0 ||
    r.createdAt.getTime() > r.updatedAt.getTime() ||
    (r.lastAdmissionAt !== null &&
      r.lastAdmissionAt.getTime() > r.updatedAt.getTime())
  )
    fail();
  if (
    r.dispatchEnabled &&
    [
      r.profileVersion,
      r.pricingVersion,
      r.privacyVersion,
      r.spendingApprovalRef,
    ].some((v) => v === null)
  )
    fail();
  return bounded(r);
}
function period(input: unknown) {
  const r = ledgerObject(input, {
    _id: ledgerObjectId,
    schemaVersion: literal(1),
    scope,
    periodKey: ledgerPeriodKey,
    version: ledgerInteger,
    settledPaise: money,
    heldPaise: money,
    createdAt: ledgerDate,
    updatedAt: ledgerDate,
  });
  addPaise(r.settledPaise, r.heldPaise);
  if (r.createdAt.getTime() > r.updatedAt.getTime()) fail();
  return bounded(r);
}
function claim(input: unknown) {
  const r = ledgerObject(input, {
    id: ledgerUuid,
    ownerId: ledgerUuid,
    claimedAt: ledgerDate,
    observeUntil: ledgerDate,
  });
  if (
    r.observeUntil.getTime() <= r.claimedAt.getTime() ||
    r.observeUntil.getTime() - r.claimedAt.getTime() > 10000
  )
    fail();
  return r;
}
function evidence(input: unknown) {
  const r = ledgerObject(input, {
    id: ledgerUuid,
    kind: (v) => ledgerEnum(v, ['FINAL_COST', 'DEFINITELY_UNSENT'] as const),
    evidenceDigest: ledgerDigest,
    actualPaise: money,
    inputTokens: ledgerNullable(ledgerInteger),
    outputTokens: ledgerNullable(ledgerInteger),
  });
  if (
    r.kind === 'DEFINITELY_UNSENT' &&
    (paiseToBigInt(r.actualPaise) !== 0n ||
      r.inputTokens !== null ||
      r.outputTokens !== null)
  )
    fail();
  return r;
}
export type LedgerClaim = ReturnType<typeof claim>;
export type LedgerEvidence = ReturnType<typeof evidence>;
export function validateLedgerClaim(input: unknown): LedgerClaim {
  try {
    return claim(input);
  } catch {
    throw ledgerInvalid();
  }
}
export function validateLedgerEvidence(input: unknown): LedgerEvidence {
  try {
    return evidence(input);
  } catch {
    throw ledgerInvalid();
  }
}
function operation(input: unknown) {
  const r = ledgerObject(input, {
    _id: ledgerObjectId,
    schemaVersion: literal(1),
    scope,
    actorId: ledgerObjectId,
    operationId: ledgerUuid,
    purpose,
    environment,
    technologyId: ledgerObjectId,
    source: (v) =>
      ledgerObject(v, {
        id: ledgerObjectId,
        revision: literal(1),
        digest: ledgerDigest,
      }),
    requestDigest: ledgerDigest,
    requestBounds: ledgerBounds,
    intentFingerprint: ledgerDigest,
    reservationFingerprint: ledgerDigest,
    quote,
    quoteDigest: ledgerDigest,
    periodKey: ledgerPeriodKey,
    admissionWindowKey: (v) =>
      ledgerInteger(v, 0, Math.floor(253402280199999 / 60000)),
    admittedAt: ledgerDate,
    reservationPaise: positiveMoney,
    version: positive,
    state: (v) => ledgerEnum(v, ledgerStates),
    open: ledgerBoolean,
    heldPaise: money,
    actualPaise: ledgerNullable(money),
    claim: ledgerNullable(claim),
    terminalEvidence: ledgerNullable(evidence),
    safeCode: ledgerNullable((v) => ledgerEnum(v, ledgerCodes)),
    lastAuditId: ledgerObjectId,
    updatedAt: ledgerDate,
  });
  const t = aiUsageTimeAt(r.admittedAt.getTime());
  if (
    r.periodKey !== t.periodKey ||
    r.admissionWindowKey !== t.actorWindowKey ||
    r.periodKey !== r.quote.periodKey ||
    r.requestDigest !== r.quote.requestDigest ||
    !ledgerSame(r.requestBounds, r.quote.requestBounds) ||
    r.quoteDigest !== ledgerQuoteDigest(r.quote) ||
    paiseToBigInt(r.reservationPaise) !==
      paiseToBigInt(r.quote.worstCasePaise) ||
    r.admittedAt.getTime() < r.quote.effectiveAtMs ||
    r.admittedAt.getTime() >= r.quote.expiresAtMs ||
    r.updatedAt.getTime() < r.admittedAt.getTime()
  )
    fail();
  const expected = intentFrame(
    ledgerHex(r.actorId),
    r.operationId,
    ledgerHex(r.technologyId),
    {
      id: ledgerHex(r.source.id),
      revision: r.source.revision,
      digest: r.source.digest,
    },
    r.requestDigest,
    r.requestBounds,
  );
  if (
    r.intentFingerprint !== expected ||
    r.reservationFingerprint !==
      ledgerReservationFingerprint({
        intentFingerprint: expected,
        periodKey: r.periodKey,
        admissionWindowKey: r.admissionWindowKey,
        quoteDigest: r.quoteDigest,
      })
  )
    fail();
  const isOpen =
    r.state === 'RESERVED' ||
    r.state === 'DISPATCH_CLAIMED' ||
    r.state === 'UNCERTAIN';
  if (r.open !== isOpen) fail();
  if (
    isOpen &&
    (paiseToBigInt(r.heldPaise) !== paiseToBigInt(r.reservationPaise) ||
      r.actualPaise !== null ||
      r.terminalEvidence !== null)
  )
    fail();
  if (r.state === 'RESERVED' && r.claim !== null) fail();
  if (
    (r.state === 'DISPATCH_CLAIMED' ||
      r.state === 'UNCERTAIN' ||
      r.state === 'SETTLED') &&
    r.claim === null
  )
    fail();
  if (
    r.claim &&
    (r.claim.claimedAt.getTime() < r.admittedAt.getTime() ||
      r.claim.claimedAt.getTime() > r.updatedAt.getTime() ||
      r.claim.claimedAt.getTime() >= r.quote.expiresAtMs ||
      aiUsageTimeAt(r.claim.claimedAt.getTime()).periodKey !== r.periodKey ||
      r.claim.observeUntil.getTime() - r.claim.claimedAt.getTime() !==
        r.requestBounds.budgetMs)
  )
    fail();
  if (
    !isOpen &&
    (paiseToBigInt(r.heldPaise) !== 0n ||
      r.actualPaise === null ||
      r.terminalEvidence === null ||
      paiseToBigInt(r.actualPaise) !==
        paiseToBigInt(r.terminalEvidence.actualPaise))
  )
    fail();
  if (r.state === 'SETTLED' && r.terminalEvidence?.kind !== 'FINAL_COST')
    fail();
  if (
    r.state === 'RELEASED' &&
    r.terminalEvidence?.kind !== 'DEFINITELY_UNSENT'
  )
    fail();
  return bounded(r);
}
export type LedgerControl = ReturnType<typeof control>;
export type LedgerPeriod = ReturnType<typeof period>;
export type LedgerOperation = ReturnType<typeof operation>;
export function validateLedgerControl(input: unknown): LedgerControl {
  try {
    return control(input);
  } catch {
    throw ledgerInvalid();
  }
}
export function validateLedgerPeriod(input: unknown): LedgerPeriod {
  try {
    return period(input);
  } catch {
    throw ledgerInvalid();
  }
}
export function validateLedgerOperation(input: unknown): LedgerOperation {
  try {
    return operation(input);
  } catch {
    throw ledgerInvalid();
  }
}
export const ledgerImmutableOperationFields = [
  '_id',
  'schemaVersion',
  'scope',
  'actorId',
  'operationId',
  'purpose',
  'environment',
  'technologyId',
  'source',
  'requestDigest',
  'requestBounds',
  'intentFingerprint',
  'reservationFingerprint',
  'quote',
  'quoteDigest',
  'periodKey',
  'admissionWindowKey',
  'admittedAt',
  'reservationPaise',
] as const;
/** Local structural guard only; no stored predecessor/concurrency/authority proof. */
export function assertLedgerImmutable(before: unknown, after: unknown): void {
  try {
    const a = operation(before),
      b = operation(after);
    for (const key of ledgerImmutableOperationFields)
      if (!ledgerSame({ v: a[key] }, { v: b[key] })) fail();
    if (a.claim !== null && !ledgerSame({ v: a.claim }, { v: b.claim })) fail();
    if (
      a.terminalEvidence !== null &&
      !ledgerSame({ v: a.terminalEvidence }, { v: b.terminalEvidence })
    )
      fail();
  } catch {
    throw ledgerInvalid();
  }
}

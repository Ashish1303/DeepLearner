import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { curriculumOutlineSchema } from './curriculum-outline.schema.js';
import {
  ledgerDigest,
  ledgerId,
  ledgerObject,
  ledgerUuid,
} from './ai-usage-ledger.schema.js';

export const outlineCandidateByteLimit = 131_072;
export const outlineInvalid = () =>
  new Error('Invalid curriculum outline candidate');
const one = (v: unknown): 1 => {
  if (v !== 1) throw outlineInvalid();
  return 1;
};
const origin = (v: unknown): 'AI_GENERATED' => {
  if (v !== 'AI_GENERATED') throw outlineInvalid();
  return v;
};

/** Copy own inert data before schema traversal. No proxy traps/getters/toJSON. */
export function outlineData(input: unknown): unknown {
  let remaining = 8192;
  const ancestors = new Set<object>();
  function copy(v: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 16) throw outlineInvalid();
    if (v === null || typeof v === 'boolean' || typeof v === 'number') return v;
    if (typeof v === 'string') {
      if (v.length > outlineCandidateByteLimit) throw outlineInvalid();
      return v;
    }
    if (!v || typeof v !== 'object' || types.isProxy(v) || ancestors.has(v))
      throw outlineInvalid();
    const array = Array.isArray(v),
      proto = Object.getPrototypeOf(v);
    if (
      array
        ? proto !== Array.prototype
        : proto !== Object.prototype && proto !== null
    )
      throw outlineInvalid();
    const keys = Reflect.ownKeys(v);
    if (keys.some((k) => typeof k !== 'string') || keys.length > 129)
      throw outlineInvalid();
    ancestors.add(v);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(v, 'length');
        if (
          !length ||
          !('value' in length) ||
          !Number.isInteger(length.value) ||
          length.value < 0 ||
          length.value > 128 ||
          keys.length !== length.value + 1
        )
          throw outlineInvalid();
        const result: unknown[] = [];
        for (let i = 0; i < length.value; i++) {
          const d = Object.getOwnPropertyDescriptor(v, String(i));
          if (!d || !d.enumerable || !('value' in d)) throw outlineInvalid();
          result.push(copy(d.value, depth + 1));
        }
        return result;
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const key of keys) {
        if (typeof key !== 'string') throw outlineInvalid();
        const d = Object.getOwnPropertyDescriptor(v, key);
        if (!d || !d.enumerable || !('value' in d)) throw outlineInvalid();
        result[key] = copy(d.value, depth + 1);
      }
      return result;
    } finally {
      ancestors.delete(v);
    }
  }
  try {
    return copy(input, 0);
  } catch {
    throw outlineInvalid();
  }
}

/** Native Date input or its exact canonical JSON representation; no date coercion. */
export function outlineTimestamp(input: unknown): string {
  try {
    if (typeof input === 'string') {
      if (input.length !== 24 && input.length !== 27) throw outlineInvalid();
      const date = new Date(input);
      if (!Number.isFinite(date.getTime()) || date.toISOString() !== input)
        throw outlineInvalid();
      return input;
    }
    if (
      !input ||
      typeof input !== 'object' ||
      types.isProxy(input) ||
      Object.getPrototypeOf(input) !== Date.prototype ||
      Reflect.ownKeys(input).length
    )
      throw outlineInvalid();
    return new Date(Date.prototype.getTime.call(input)).toISOString();
  } catch {
    throw outlineInvalid();
  }
}

/** Internal helper for fresh validated projections, never an untrusted boundary. */
export type ImmutableOutline<T> = T extends readonly (infer Item)[]
  ? readonly ImmutableOutline<Item>[]
  : T extends object
    ? { readonly [K in keyof T]: ImmutableOutline<T[K]> }
    : T;
export function freezeOutline<T>(v: T): ImmutableOutline<T> {
  if (v && typeof v === 'object') {
    for (const child of Object.values(v)) freezeOutline(child);
    Object.freeze(v);
  }
  return v as ImmutableOutline<T>;
}
const hash = (frame: unknown): string =>
  createHash('sha256').update(JSON.stringify(frame), 'utf8').digest('hex');
function wellFormed(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
export function outlineRawOutputDigest(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !wellFormed(input) ||
    Buffer.byteLength(input, 'utf8') > 65_536
  )
    throw outlineInvalid();
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function parseOutline(input: unknown) {
  const row = curriculumOutlineSchema.parse(outlineData(input));
  if (Buffer.byteLength(JSON.stringify(row), 'utf8') > 65_536)
    throw outlineInvalid();
  return row;
}
export function outlineContentDigest(input: unknown): string {
  try {
    const o = parseOutline(input);
    return hash([
      'F054_OUTLINE_CONTENT',
      1,
      [
        o.schemaVersion,
        o.technologyId,
        [o.source.id, o.source.revision, o.source.digest],
        o.title,
        o.modules.map((m) => [
          m.title,
          m.objectives,
          m.topics.map((t) => [t.title, t.concepts.map((c) => c.title)]),
        ]),
      ],
    ]);
  } catch {
    throw outlineInvalid();
  }
}

export const outlineSource = (v: unknown) =>
  ledgerObject(v, {
    id: ledgerId,
    revision: one,
    digest: ledgerDigest,
  });
export const outlineProposal = (v: unknown) =>
  ledgerObject(v, {
    id: ledgerId,
    proposalId: ledgerId,
    revision: one,
    digest: ledgerDigest,
  });
export function validateOutlineIntent(input: unknown) {
  try {
    return ledgerObject(input, {
      schemaVersion: one,
      technologyId: ledgerId,
      brief: outlineSource,
      proposal: outlineProposal,
      operationId: ledgerUuid,
    });
  } catch {
    throw outlineInvalid();
  }
}
export function outlineIntentDigest(input: unknown): string {
  try {
    const r = ledgerObject(input, {
      actorId: ledgerId,
      intent: validateOutlineIntent,
      ledgerIntentFingerprint: ledgerDigest,
      templateVersion: ledgerUuid,
    });
    const i = r.intent;
    return hash([
      'F054_OUTLINE_INTENT',
      1,
      r.actorId,
      'SHARED_AI_TESTING',
      i.operationId,
      i.technologyId,
      [i.brief.id, 1, i.brief.digest],
      [i.proposal.id, i.proposal.proposalId, 1, i.proposal.digest],
      r.ledgerIntentFingerprint,
      r.templateVersion,
    ]);
  } catch {
    throw outlineInvalid();
  }
}

const completionFields = {
  attemptId: ledgerId,
  ledgerOperationId: ledgerId,
  operationId: ledgerUuid,
  claimId: ledgerUuid,
  ownerId: ledgerUuid,
  intentDigest: ledgerDigest,
  requestDigest: ledgerDigest,
  rawOutputDigest: ledgerDigest,
  templateVersion: ledgerUuid,
  completedAt: outlineTimestamp,
};
export function outlineCompletionDigest(
  input: unknown,
  actor: unknown,
): string {
  try {
    const p = ledgerObject(input, completionFields),
      actorId = ledgerId(actor);
    return hash([
      'F054_OUTLINE_COMPLETION',
      1,
      p.attemptId,
      p.ledgerOperationId,
      actorId,
      p.operationId,
      p.claimId,
      p.ownerId,
      p.intentDigest,
      p.requestDigest,
      p.rawOutputDigest,
      p.templateVersion,
      p.completedAt,
    ]);
  } catch {
    throw outlineInvalid();
  }
}
function producer(input: unknown) {
  // Declaration order is the approved canonical JSON order, not hash-frame order.
  return ledgerObject(input, {
    attemptId: ledgerId,
    ledgerOperationId: ledgerId,
    operationId: ledgerUuid,
    claimId: ledgerUuid,
    ownerId: ledgerUuid,
    intentDigest: ledgerDigest,
    requestDigest: ledgerDigest,
    rawOutputDigest: ledgerDigest,
    completionDigest: ledgerDigest,
    templateVersion: ledgerUuid,
    completedAt: outlineTimestamp,
  });
}
const definitionFields = {
  _id: ledgerId,
  outlineId: ledgerId,
  schemaVersion: one,
  revision: one,
  origin,
  outline: parseOutline,
  proposal: outlineProposal,
  createdBy: ledgerId,
  createdAt: outlineTimestamp,
  producer,
  contentDigest: ledgerDigest,
};
type Definition = ReturnType<typeof parseDefinition>;
function parseDefinition(input: unknown) {
  const row = ledgerObject(input, definitionFields);
  checkDefinition(row);
  return row;
}
function checkDefinition(row: {
  _id: string;
  outlineId: string;
  createdAt: string;
  createdBy: string;
  producer: ReturnType<typeof producer>;
  outline: unknown;
  contentDigest: string;
}) {
  const { completionDigest, ...completion } = row.producer;
  if (
    row._id === row.outlineId ||
    new Date(row.producer.completedAt).getTime() >
      new Date(row.createdAt).getTime() ||
    row.contentDigest !== outlineContentDigest(row.outline) ||
    completionDigest !== outlineCompletionDigest(completion, row.createdBy)
  )
    throw outlineInvalid();
}
function definitionHash(row: Definition): string {
  return hash([
    'F054_OUTLINE_REVISION',
    1,
    row._id,
    row.outlineId,
    1,
    'AI_GENERATED',
    row.contentDigest,
    [row.proposal.id, row.proposal.proposalId, 1, row.proposal.digest],
    row.createdBy,
    row.createdAt,
    row.producer.completionDigest,
  ]);
}
export function outlineDefinitionDigest(input: unknown): string {
  try {
    return definitionHash(parseDefinition(input));
  } catch {
    throw outlineInvalid();
  }
}
/** Byte-bound helper only, not proof that a string represents a valid candidate. */
export function assertOutlineCandidateByteLimit(input: unknown): void {
  if (
    typeof input !== 'string' ||
    !wellFormed(input) ||
    Buffer.byteLength(input, 'utf8') > outlineCandidateByteLimit
  )
    throw outlineInvalid();
}
/** Canonical JSON projection; immutable ISO timestamps avoid mutable Date internals. */
export function validateOutlineCandidate(input: unknown) {
  try {
    const row = ledgerObject(input, {
      ...definitionFields,
      definitionDigest: ledgerDigest,
    });
    checkDefinition(row);
    if (row.definitionDigest !== definitionHash(row)) throw outlineInvalid();
    assertOutlineCandidateByteLimit(JSON.stringify(row));
    return freezeOutline(row);
  } catch {
    throw outlineInvalid();
  }
}
export type OutlineCandidate = ReturnType<typeof validateOutlineCandidate>;

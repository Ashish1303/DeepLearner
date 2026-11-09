import type { ClientSession, Db, Document, MongoClient } from 'mongodb';
import { Types } from 'mongoose';
import { types } from 'node:util';
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
  ledgerSame,
} from './ai-usage-ledger.schema.js';
import {
  outlineAttemptBindingFields,
  parseOutlineAttemptBinding,
  outlineAttemptBindingDigest,
  parseOutlineInvocation,
  parseOutlineCompletion,
  parseOutlineReceipt,
  parseOutlineAttempt,
  outlineAttemptBinding,
  outlineCheckpointDigest,
  parseOutlineCompletionAudit,
  type AttemptBinding,
  type Attempt,
  type Invocation,
  type Completion,
  type OutlineWork,
  type OutlineClock,
} from './curriculum-outline-producer.service.js';
import {
  createOutlineEvidenceReader,
  OutlineEvidenceFailure,
} from './curriculum-outline-evidence.reader.js';
import { createOutlineSessionFence } from './curriculum-outline-session-fence.js';
import {
  freezeOutline,
  outlineData,
  outlineRawOutputDigest,
  outlineContentDigest,
  outlineDefinitionDigest,
  validateOutlineCandidate,
} from './curriculum-outline-candidate.schema.js';
import {
  outlineAdmissionCodes,
  proposeOutlineAdmission,
} from './curriculum-outline-admission.policy.js';
import { validateCurriculumOutline } from './curriculum-outline.validator.js';

const message = 'Curriculum outline store is unavailable';
type Code =
  | 'INVALID_INPUT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'SOURCE_UNAVAILABLE'
  | 'CONTROL_UNAVAILABLE'
  | 'OPERATION_CONFLICT'
  | 'STATE_CONFLICT';
type Stage =
  | 'AUTHORIZE'
  | 'READ'
  | 'FENCE_USER'
  | 'FENCE_SESSION'
  | 'ATTEMPT'
  | 'AUDIT'
  | 'COMMIT';
type Cleanup = 'ABORT' | 'ABORT_UNCONFIRMED' | 'END_SESSION' | 'NOT_ENDED';
type Mode = 'PREPARE' | 'MARK' | 'CAPTURE' | 'CANCEL' | 'METADATA' | 'EVIDENCE';
class Failure extends Error {
  constructor(readonly code: Code = 'CONTROL_UNAVAILABLE') {
    super(message);
  }
}
function bad(): never {
  throw new Failure();
}
const one = (v: unknown): 1 => {
  if (v !== 1) bad();
  return 1;
};
const nil = (v: unknown): null => {
  if (v !== null) bad();
  return null;
};
const exact =
  <T extends string>(value: T) =>
  (v: unknown): T => {
    if (v !== value) bad();
    return value;
  };
const version = (v: unknown) =>
  ledgerInteger(v, 0, Number.MAX_SAFE_INTEGER - 1);
const oid = (v: string) => new Types.ObjectId(ledgerId(v));
const requestId = (v: unknown): string => {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}(?![\s\S])/.test(v))
    bad();
  return v;
};
const invocationFields = {
  claimVersion: (v: unknown) => ledgerInteger(v, 1),
  id: ledgerUuid,
  ownerId: ledgerUuid,
  claimedAt: ledgerDate,
  observeUntil: ledgerDate,
  markedAt: ledgerDate,
};
const checkpointFields = {
  schemaVersion: one,
  createdAt: ledgerDate,
  checkpointDigest: ledgerDigest,
};
const producerFields = {
  attemptId: ledgerObjectId,
  ledgerOperationId: ledgerObjectId,
  operationId: ledgerUuid,
  claimId: ledgerUuid,
  ownerId: ledgerUuid,
  intentDigest: ledgerDigest,
  requestDigest: ledgerDigest,
  rawOutputDigest: ledgerDigest,
  completionDigest: ledgerDigest,
  templateVersion: ledgerUuid,
  completedAt: ledgerDate,
};
const nativeBindingFields = {
  ...outlineAttemptBindingFields,
  _id: ledgerObjectId,
  actorId: ledgerObjectId,
  sessionId: ledgerObjectId,
  technologyId: ledgerObjectId,
  ledgerOperationId: ledgerObjectId,
  outlineRevisionId: ledgerObjectId,
  outlineId: ledgerObjectId,
  terminalAuditId: ledgerObjectId,
  completionAuditId: ledgerObjectId,
  brief: (v: unknown) =>
    ledgerObject(v, {
      id: ledgerObjectId,
      revision: one,
      digest: ledgerDigest,
    }),
  proposal: (v: unknown) =>
    ledgerObject(v, {
      id: ledgerObjectId,
      proposalId: ledgerObjectId,
      revision: one,
      digest: ledgerDigest,
    }),
  createdAt: ledgerDate,
};
const bindingKeys = Object.keys(
  outlineAttemptBindingFields,
) as (keyof AttemptBinding)[];
function nativeBinding(v: unknown) {
  return ledgerObject(v, nativeBindingFields);
}
function canonicalBinding(v: ReturnType<typeof nativeBinding>): AttemptBinding {
  const b: Record<string, unknown> = { ...v };
  for (const key of [
    '_id',
    'actorId',
    'sessionId',
    'technologyId',
    'ledgerOperationId',
    'outlineRevisionId',
    'outlineId',
    'terminalAuditId',
    'completionAuditId',
  ] as const)
    b[key] = ledgerHex(ledgerObjectId(v[key]));
  b.brief = { ...v.brief, id: ledgerHex(v.brief.id) };
  b.proposal = {
    ...v.proposal,
    id: ledgerHex(v.proposal.id),
    proposalId: ledgerHex(v.proposal.proposalId),
  };
  b.createdAt = v.createdAt.toISOString();
  return parseOutlineAttemptBinding(b);
}
export function encodeOutlineAttemptBinding(input: unknown) {
  const b = parseOutlineAttemptBinding(input),
    row: Record<string, unknown> = { ...b };
  for (const key of [
    '_id',
    'actorId',
    'sessionId',
    'technologyId',
    'ledgerOperationId',
    'outlineRevisionId',
    'outlineId',
    'terminalAuditId',
    'completionAuditId',
  ] as const)
    row[key] = oid(b[key]);
  row.brief = { ...b.brief, id: oid(b.brief.id) };
  row.proposal = {
    ...b.proposal,
    id: oid(b.proposal.id),
    proposalId: oid(b.proposal.proposalId),
  };
  row.createdAt = new Date(b.createdAt);
  return nativeBinding(row);
}
function nativeInvocation(v: unknown) {
  return ledgerObject(v, invocationFields);
}
function canonicalInvocation(
  v: ReturnType<typeof nativeInvocation>,
): Invocation {
  return parseOutlineInvocation({
    ...v,
    claimedAt: v.claimedAt.toISOString(),
    observeUntil: v.observeUntil.toISOString(),
    markedAt: v.markedAt.toISOString(),
  });
}
function encodeInvocation(v: Invocation) {
  return nativeInvocation({
    ...v,
    claimedAt: new Date(v.claimedAt),
    observeUntil: new Date(v.observeUntil),
    markedAt: new Date(v.markedAt),
  });
}
function nativeCompletion(v: unknown) {
  return ledgerObject(v, {
    ...checkpointFields,
    producer: (x) => ledgerObject(x, producerFields),
    rawOutput: (x) => {
      outlineRawOutputDigest(x);
      return x as string;
    },
  });
}
function canonicalCompletion(
  v: ReturnType<typeof nativeCompletion>,
): Completion {
  const p = v.producer;
  return parseOutlineCompletion({
    ...v,
    createdAt: v.createdAt.toISOString(),
    producer: {
      ...p,
      attemptId: ledgerHex(p.attemptId),
      ledgerOperationId: ledgerHex(p.ledgerOperationId),
      completedAt: p.completedAt.toISOString(),
    },
  });
}
function encodeCompletion(v: Completion) {
  return nativeCompletion({
    ...v,
    createdAt: new Date(v.createdAt),
    producer: {
      ...v.producer,
      attemptId: oid(v.producer.attemptId),
      ledgerOperationId: oid(v.producer.ledgerOperationId),
      completedAt: new Date(v.producer.completedAt),
    },
  });
}
function nativeReceipt(v: unknown) {
  // Inspect kind without invoking a getter or accepting extra fields.
  const d = field(v, 'kind');
  return d === 'COMMITTED'
    ? ledgerObject(v, {
        kind: exact('COMMITTED'),
        candidateId: ledgerObjectId,
        revision: one,
        definitionDigest: ledgerDigest,
        auditId: ledgerObjectId,
      })
    : ledgerObject(v, {
        kind: exact('REFUSED'),
        code: (x) => ledgerEnum(x, outlineAdmissionCodes),
        auditId: ledgerObjectId,
      });
}
function canonicalReceipt(v: ReturnType<typeof nativeReceipt>) {
  return parseOutlineReceipt({
    ...v,
    auditId: ledgerHex(v.auditId),
    ...('candidateId' in v ? { candidateId: ledgerHex(v.candidateId) } : {}),
  });
}
function stateFields(metadata: boolean) {
  return {
    ...nativeBindingFields,
    bindingDigest: ledgerDigest,
    version,
    phase: (v: unknown) =>
      ledgerEnum(v, [
        'PREPARED',
        'INVOCATION_MARKED',
        'COMPLETION_STORED',
        'ADMITTED',
        'REFUSED',
      ] as const),
    invocation: ledgerNullable(nativeInvocation),
    completion: ledgerNullable(
      metadata
        ? (v: unknown) => ledgerObject(v, checkpointFields)
        : nativeCompletion,
    ),
    cancelledAt: ledgerNullable(ledgerDate),
    receipt: ledgerNullable(nativeReceipt),
  };
}
function decode(input: unknown, metadata: boolean) {
  const n = ledgerObject(input, stateFields(metadata));
  const b = canonicalBinding(
    nativeBinding(Object.fromEntries(bindingKeys.map((k) => [k, n[k]]))),
  );
  if (
    outlineAttemptBindingDigest(b) !== n.bindingDigest ||
    b.outlineId === b.outlineRevisionId ||
    b.terminalAuditId === b.completionAuditId
  )
    bad();
  const i = n.invocation && canonicalInvocation(n.invocation);
  const c =
    n.completion === null
      ? null
      : metadata
        ? {
            ...ledgerObject(n.completion, checkpointFields),
            createdAt: ledgerDate(
              field(n.completion, 'createdAt'),
            ).toISOString(),
          }
        : canonicalCompletion(nativeCompletion(n.completion));
  const a = {
    ...b,
    bindingDigest: n.bindingDigest,
    version: n.version,
    phase: n.phase,
    invocation: i,
    completion: c,
    cancelledAt: n.cancelledAt?.toISOString() ?? null,
    receipt: n.receipt && canonicalReceipt(n.receipt),
  };
  if (
    i &&
    (Date.parse(b.createdAt) > Date.parse(i.claimedAt) ||
      Date.parse(i.claimedAt) > Date.parse(i.markedAt) ||
      Date.parse(i.markedAt) >= Date.parse(i.observeUntil) ||
      Date.parse(i.observeUntil) - Date.parse(i.claimedAt) > 10000)
  )
    bad();
  if (c && (!i || Date.parse(c.createdAt) < Date.parse(i.markedAt))) bad();
  if (
    a.cancelledAt &&
    Date.parse(a.cancelledAt) <
      Math.max(
        Date.parse(b.createdAt),
        i ? Date.parse(i.markedAt) : 0,
        c ? Date.parse(c.createdAt) : 0,
      )
  )
    bad();
  const terminal = a.phase === 'ADMITTED' || a.phase === 'REFUSED';
  const base =
    a.phase === 'PREPARED'
      ? 0
      : a.phase === 'INVOCATION_MARKED'
        ? 1
        : a.phase === 'COMPLETION_STORED'
          ? 2
          : a.phase === 'ADMITTED'
            ? 3
            : a.completion
              ? 3
              : 2;
  if (
    a.version !== base + (a.cancelledAt ? 1 : 0) ||
    (terminal && a.cancelledAt !== null)
  )
    bad();
  if (
    a.phase === 'PREPARED'
      ? i !== null || c !== null || a.receipt !== null
      : a.phase === 'INVOCATION_MARKED'
        ? !i || c !== null || a.receipt !== null
        : a.phase === 'COMPLETION_STORED'
          ? !i || !c || a.receipt !== null
          : a.phase === 'ADMITTED'
            ? !i || !c || a.receipt?.kind !== 'COMMITTED'
            : !i || a.receipt?.kind !== 'REFUSED'
  )
    bad();
  return {
    native: n,
    canonical: metadata ? freezeOutline(a) : parseOutlineAttempt(a),
    binding: b,
  };
}
export function decodeOutlineAttempt(input: unknown) {
  return decode(input, false).canonical;
}
export function encodeOutlineAttempt(input: unknown) {
  const a = parseOutlineAttempt(input),
    b = encodeOutlineAttemptBinding(outlineAttemptBinding(a));
  const row = {
    ...b,
    bindingDigest: a.bindingDigest,
    version: a.version,
    phase: a.phase,
    invocation: a.invocation ? encodeInvocation(a.invocation) : null,
    completion: a.completion ? encodeCompletion(a.completion) : null,
    cancelledAt: a.cancelledAt ? new Date(a.cancelledAt) : null,
    receipt: a.receipt
      ? {
          ...a.receipt,
          auditId: oid(a.receipt.auditId),
          ...('candidateId' in a.receipt
            ? { candidateId: oid(a.receipt.candidateId) }
            : {}),
        }
      : null,
  };
  decode(row, false);
  return row;
}
function field(v: unknown, key: string): unknown {
  if (
    !v ||
    typeof v !== 'object' ||
    types.isProxy(v) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(v))
  )
    bad();
  const d = Object.getOwnPropertyDescriptor(v, key);
  if (d && !('value' in d)) bad();
  return d?.value;
}

export const outlineAttemptAuditActions = [
  'CURRICULUM_OUTLINE_PREPARED',
  'CURRICULUM_OUTLINE_INVOCATION_MARKED',
  'CURRICULUM_OUTLINE_COMPLETION_STORED',
  'CURRICULUM_OUTLINE_CANCELLED',
  'CURRICULUM_OUTLINE_ADMITTED',
  'CURRICULUM_OUTLINE_ADMISSION_REFUSED',
] as const;
export function validateOutlineAttemptAudit(input: unknown) {
  const action = ledgerEnum(field(input, 'action'), outlineAttemptAuditActions);
  const common = {
    attemptId: ledgerObjectId,
    technologyId: ledgerObjectId,
    operationId: ledgerUuid,
    attemptVersion: version,
    bindingDigest: ledgerDigest,
  };
  const extra =
    action === 'CURRICULUM_OUTLINE_COMPLETION_STORED'
      ? { checkpointDigest: ledgerDigest }
      : action === 'CURRICULUM_OUTLINE_ADMITTED'
        ? {
            outlineId: ledgerObjectId,
            outlineRevisionId: ledgerObjectId,
            revision: one,
          }
        : action === 'CURRICULUM_OUTLINE_ADMISSION_REFUSED'
          ? {
              outlineId: ledgerObjectId,
              outlineRevisionId: ledgerObjectId,
              revision: one,
              safeCode: (x: unknown) => ledgerEnum(x, outlineAdmissionCodes),
            }
          : {};
  const a = ledgerObject(input, {
    _id: ledgerObjectId,
    category: exact('CONTENT_MANAGEMENT'),
    action: exact(action),
    actorId: ledgerObjectId,
    resourceType: exact('CURRICULUM_OUTLINE_ATTEMPT'),
    resourceId: ledgerObjectId,
    requestId,
    metadata: (v) => ledgerObject(v, { ...common, ...extra }),
    createdAt: ledgerDate,
  });
  if (ledgerHex(a.resourceId) !== ledgerHex(a.metadata.attemptId)) bad();
  const v = a.metadata.attemptVersion;
  if (
    action === 'CURRICULUM_OUTLINE_PREPARED'
      ? v !== 0
      : action === 'CURRICULUM_OUTLINE_INVOCATION_MARKED'
        ? v !== 1
        : action === 'CURRICULUM_OUTLINE_COMPLETION_STORED'
          ? v !== 2
          : action === 'CURRICULUM_OUTLINE_ADMITTED'
            ? v !== 3
            : action === 'CURRICULUM_OUTLINE_ADMISSION_REFUSED'
              ? v !== 2 && v !== 3
              : v < 1 || v > 3
  )
    bad();
  if (
    'outlineId' in a.metadata &&
    ledgerHex(ledgerObjectId(a.metadata.outlineId)) ===
      ledgerHex(ledgerObjectId(a.metadata.outlineRevisionId))
  )
    bad();
  return a;
}
export const outlineAttemptRequiredIndexes = [
  {
    collection: 'curriculumOutlineCandidates',
    name: '_id_',
    key: { _id: 1 },
    unique: true,
  },
  {
    collection: 'curriculumOutlineCandidates',
    name: 'uq_outline_family_revision',
    key: { outlineId: 1, revision: 1 },
    unique: true,
  },
  {
    collection: 'curriculumOutlineCandidates',
    name: 'uq_outline_attempt',
    key: { 'producer.attemptId': 1 },
    unique: true,
  },
  {
    collection: 'curriculumOutlineAttempts',
    name: '_id_',
    key: { _id: 1 },
    unique: true,
  },
  {
    collection: 'curriculumOutlineAttempts',
    name: 'uq_outline_actor_operation',
    key: { scope: 1, actorId: 1, operationId: 1 },
    unique: true,
  },
  {
    collection: 'curriculumOutlineAttempts',
    name: 'uq_outline_ledger_operation',
    key: { ledgerOperationId: 1 },
    unique: true,
  },
  {
    collection: 'auditLogs',
    name: 'uq_outline_attempt_audit_version',
    key: { resourceType: 1, resourceId: 1, 'metadata.attemptVersion': 1 },
    unique: true,
    partialFilterExpression: { resourceType: 'CURRICULUM_OUTLINE_ATTEMPT' },
  },
] as const;
export function assertOutlineAttemptIndexes(collection: string, rows: unknown) {
  if (
    !Array.isArray(rows) ||
    types.isProxy(rows) ||
    Object.getPrototypeOf(rows) !== Array.prototype ||
    rows.length > 100 ||
    Reflect.ownKeys(rows).length !== rows.length + 1
  )
    bad();
  const list: unknown[] = [];
  for (let i = 0; i < rows.length; i++) {
    const d = Object.getOwnPropertyDescriptor(rows, String(i));
    if (!d || !('value' in d)) bad();
    list.push(d.value);
  }
  const expected = [
    ...outlineAttemptRequiredIndexes.filter((x) => x.collection === collection),
    ...(['users', 'sessions', 'auditLogs'].includes(collection)
      ? [{ name: '_id_', key: { _id: 1 }, unique: true }]
      : []),
  ];
  for (const e of expected) {
    const matches = list.filter((r) => field(r, 'name') === e.name);
    if (matches.length !== 1) bad();
    const row = matches[0],
      key = field(row, 'key');
    ledgerObject(
      key,
      Object.fromEntries(
        Object.entries(e.key).map(([k, v]) => [
          k,
          (x: unknown) => {
            if (x !== v) bad();
            return x;
          },
        ]),
      ),
    );
    if (Object.keys(key as object).join(',') !== Object.keys(e.key).join(','))
      bad();
    if (
      field(row, 'unique') !== true &&
      !(e.name === '_id_' && field(row, 'unique') === undefined)
    )
      bad();
    for (const k of ['hidden', 'sparse'])
      if (field(row, k) !== undefined && field(row, k) !== false) bad();
    if (field(row, 'expireAfterSeconds') !== undefined) bad();
    const partial =
      'partialFilterExpression' in e ? e.partialFilterExpression : undefined;
    const actualPartial = field(row, 'partialFilterExpression');
    if (
      partial === undefined
        ? actualPartial !== undefined
        : !actualPartial ||
          typeof actualPartial !== 'object' ||
          !ledgerSame(actualPartial, partial)
    )
      bad();
    const collation = field(row, 'collation');
    if (
      collation !== undefined &&
      (!collation ||
        typeof collation !== 'object' ||
        !ledgerSame(collation, { locale: 'simple' }))
    )
      bad();
  }
}

/** Explicit server-owned closures; implementations must share the supplied
 * snapshot/session and independently establish policy, source, privacy, original
 * observer/known claim ACK and closed-writer/physical prerequisites. Test doubles
 * do not make these facts authentic. No production composition is provided. */
export interface OutlineAttemptDependencies {
  db: Db;
  client: MongoClient;
  clock: OutlineClock;
  loss: AbortSignal;
  verify(): Promise<unknown>;
  authorize(
    binding: Readonly<AttemptBinding>,
    mode: Mode,
    context: Readonly<{ session: ClientSession; work: OutlineWork }>,
  ): Promise<void>;
  /** Independently resolve the exact minimized request and approved template in
   * this same snapshot. It is not posted provider instructions or stored raw prompt. */
  readCommand(
    binding: Readonly<AttemptBinding>,
    context: Readonly<{ session: ClientSession; work: OutlineWork }>,
  ): Promise<unknown>;
  allocateAuditId(): Types.ObjectId;
  requestId: string;
  requestingSessionId: string;
}

type Decoded = ReturnType<typeof decode>;
function metadata(a: Decoded['canonical']) {
  return freezeOutline({
    attemptId: a._id,
    technologyId: a.technologyId,
    operationId: a.operationId,
    phase: a.phase,
    version: a.version,
    cancelledAt: a.cancelledAt,
    hasCompletion: a.completion !== null,
    hasReceipt: a.receipt !== null,
  });
}
function leafBinding(b: AttemptBinding): Document {
  const n = encodeOutlineAttemptBinding(b),
    result: Document = {};
  for (const key of bindingKeys) {
    if (key === 'brief' || key === 'proposal')
      for (const [child, value] of Object.entries(n[key]))
        result[key + '.' + child] = value;
    else result[key] = n[key];
  }
  result.bindingDigest = outlineAttemptBindingDigest(b);
  return result;
}
function nullCell(filter: Document, key: string) {
  filter[key] = { $eq: null, $exists: true };
}
function statePredicate(row: Decoded): Document {
  const a = row.canonical,
    n = row.native;
  const f: Document = {
    ...leafBinding(row.binding),
    version: a.version,
    phase: a.phase,
  };
  nullCell(f, 'cancelledAt');
  nullCell(f, 'receipt');
  if (n.invocation === null) nullCell(f, 'invocation');
  else
    for (const [k, v] of Object.entries(n.invocation)) f['invocation.' + k] = v;
  if (n.completion === null) nullCell(f, 'completion');
  else {
    f.completion = { $type: 'object' };
    for (const key of ['schemaVersion', 'createdAt', 'checkpointDigest'])
      f['completion.' + key] = field(n.completion, key);
  }
  return f;
}
function candidateFromNative(input: unknown) {
  const r = ledgerObject(input, {
    _id: ledgerObjectId,
    outlineId: ledgerObjectId,
    schemaVersion: one,
    revision: one,
    origin: exact('AI_GENERATED'),
    outline: (v) => outlineData(v),
    proposal: (v) =>
      ledgerObject(v, {
        id: ledgerObjectId,
        proposalId: ledgerObjectId,
        revision: one,
        digest: ledgerDigest,
      }),
    createdBy: ledgerObjectId,
    createdAt: ledgerDate,
    producer: (v) => ledgerObject(v, producerFields),
    contentDigest: ledgerDigest,
    definitionDigest: ledgerDigest,
  });
  return validateOutlineCandidate({
    ...r,
    _id: ledgerHex(r._id),
    outlineId: ledgerHex(r.outlineId),
    createdBy: ledgerHex(r.createdBy),
    createdAt: r.createdAt.toISOString(),
    proposal: {
      ...r.proposal,
      id: ledgerHex(r.proposal.id),
      proposalId: ledgerHex(r.proposal.proposalId),
    },
    producer: {
      ...r.producer,
      attemptId: ledgerHex(r.producer.attemptId),
      ledgerOperationId: ledgerHex(r.producer.ledgerOperationId),
      completedAt: r.producer.completedAt.toISOString(),
    },
  });
}

/** Import/factory is inert. Only explicitly invoked methods construct native
 * operations on the injected client; this module never imports a registered model.
 * Production composition and actual database execution are NOT authorized here. */
export function createOutlineAttemptRepository(
  deps: OutlineAttemptDependencies,
) {
  const { db, client } = deps;
  const consumed = new Set<string>(); // Retained intent cannot resume a sent uncertain mutation.
  async function run(
    mode: Mode,
    input: unknown,
    work: OutlineWork,
  ): Promise<unknown> {
    let session: ClientSession | undefined,
      writeSent = false,
      committing = false,
      committed = false,
      readOnly = false;
    let stage: Stage = 'AUTHORIZE',
      failure: { stage: Stage; code: Code } | null = null;
    const cleanup: Cleanup[] = [];
    let value: unknown;
    const cleanupCode = (c: Cleanup) => {
      if (!cleanup.includes(c)) cleanup.push(c);
    };
    let startMono: number | undefined,
      lastMono = -1,
      lastUtc = -1,
      authUntil: number | undefined;
    function remaining() {
      work.check();
      const mono = deps.clock.monotonic(),
        utc = ledgerInteger(deps.clock.now(), 0, 253402280199999);
      if (
        !Number.isFinite(mono) ||
        mono < 0 ||
        mono < lastMono ||
        utc < lastUtc ||
        deps.loss.aborted ||
        work.signal.aborted
      )
        bad();
      startMono ??= mono;
      lastMono = mono;
      lastUtc = utc;
      const n = Math.min(
        work.remainingMs,
        10000 - (mono - startMono),
        authUntil === undefined ? 10000 : authUntil - mono,
      );
      if (!Number.isFinite(n) || n < 1 || work.remainingMs > 10000) bad();
      return Math.min(10000, Math.floor(n));
    }
    function options(max = 10000) {
      return {
        ...(session ? { session } : {}),
        timeoutMS: Math.min(max, remaining()),
        signal: work.signal,
        promoteLongs: false,
        readPreference: 'primary' as const,
      };
    }
    async function bounded<T>(
      operation: () => Promise<T>,
      limit = remaining(),
      clean = false,
    ): Promise<T> {
      if (
        !Number.isFinite(limit) ||
        limit < 1 ||
        limit > (clean ? 2000 : 10000)
      )
        bad();
      let timer: unknown, abort: (() => void) | undefined;
      const stop = new Promise<never>((_resolve, reject) => {
        abort = () => reject(new Failure());
        if (!clean) {
          deps.loss.addEventListener('abort', abort, { once: true });
          work.signal.addEventListener('abort', abort, { once: true });
        }
        timer = deps.clock.setTimeout(abort, limit);
      });
      try {
        const result = await Promise.race([
          Promise.resolve().then(() => {
            if (!clean) remaining();
            return operation();
          }),
          stop,
        ]);
        if (!clean) remaining();
        return result;
      } finally {
        if (abort) {
          deps.loss.removeEventListener('abort', abort);
          work.signal.removeEventListener('abort', abort);
        }
        deps.clock.clearTimeout(timer);
      }
    }
    const find = async (
      collection: string,
      filter: Document,
      projection?: Document,
    ) => {
      const row = await bounded(() =>
        db.collection(collection).findOne(filter, {
          ...options(),
          ...(projection ? { projection } : {}),
        }),
      );
      return row;
    };
    const many = async (
      collection: string,
      filter: Document,
      limit: number,
      projection?: Document,
    ) => {
      const rows = await bounded(() =>
        db
          .collection(collection)
          .find(filter, { ...options(), ...(projection ? { projection } : {}) })
          .limit(limit)
          .toArray(),
      );
      if (!Array.isArray(rows) || types.isProxy(rows) || rows.length > limit)
        bad();
      return rows;
    };
    async function credential(actorId: string) {
      const who = ledgerObject(
        await bounded(() => deps.verify(), Math.min(5000, remaining())),
        {
          sub: ledgerId,
          sid: ledgerId,
          role: exact('ADMIN'),
          plan: (v) => ledgerEnum(v, ['FREE', 'PREMIUM'] as const),
        },
      );
      if (who.sub !== actorId || who.sid !== deps.requestingSessionId)
        throw new Failure('FORBIDDEN');
      return who;
    }
    async function policy(b: AttemptBinding, m: Mode) {
      await credential(b.actorId);
      await bounded(
        () => deps.authorize(freezeOutline(b), m, { session: session!, work }),
        Math.min(5000, remaining()),
      );
    }
    const fenceCollection = (collection: string) => ({
      findOne: async (
        filter: Record<string, unknown>,
        opts: { maxTimeMS: number; projection: Record<string, 1> },
      ) => find(collection, filter, opts.projection),
      updateOne: async (
        filter: Record<string, unknown>,
        update: { $inc: { __v: 1 } },
        opts: { maxTimeMS: number },
      ) => {
        stage = collection === 'users' ? 'FENCE_USER' : 'FENCE_SESSION';
        writeSent = true;
        return bounded(() =>
          db.collection(collection).updateOne(filter, update, {
            ...options(opts.maxTimeMS),
            upsert: false,
          }),
        );
      },
    });
    function makeFence(
      row: Decoded | undefined,
      b: AttemptBinding,
      m: 'PREPARE' | 'MARK' | 'CAPTURE' | 'CANCEL' | 'READ',
    ) {
      const a = row?.canonical;
      return createOutlineSessionFence(
        {
          mode: m,
          actorId: b.actorId,
          originSessionId: b.sessionId,
          requestingSessionId: deps.requestingSessionId,
          attemptId: b._id,
          bindingDigest: outlineAttemptBindingDigest(b),
          expectedVersion: a?.version ?? 0,
          phase: a?.phase ?? 'PREPARED',
          invocation: a?.invocation ? encodeInvocation(a.invocation) : null,
        },
        {
          session: session!,
          users: fenceCollection('users'),
          sessions: fenceCollection('sessions'),
          attempts: fenceCollection('curriculumOutlineAttempts'),
          verify: deps.verify,
          clock: deps.clock,
          loss: deps.loss,
          work,
        },
      );
    }
    const completionProjection = {
      ...Object.fromEntries(bindingKeys.map((k) => [k, 1])),
      bindingDigest: 1,
      version: 1,
      phase: 1,
      cancelledAt: 1,
      invocation: 1,
      receipt: 1,
      'completion.schemaVersion': 1,
      'completion.createdAt': 1,
      'completion.checkpointDigest': 1,
    };
    function insertAck(v: unknown, id: Types.ObjectId) {
      const a = ledgerObject(v, {
        acknowledged: (x) => {
          if (x !== true) bad();
          return true;
        },
        insertedId: ledgerObjectId,
      });
      if (ledgerHex(a.insertedId) !== ledgerHex(id)) bad();
    }
    async function history(row: Decoded, full: boolean) {
      const a = row.canonical,
        b = row.binding,
        events: ReturnType<typeof validateOutlineAttemptAudit>[] = [];
      for (let v = 0; v <= a.version; v++) {
        const rows = await many(
          'auditLogs',
          {
            resourceType: 'CURRICULUM_OUTLINE_ATTEMPT',
            resourceId: oid(a._id),
            'metadata.attemptVersion': v,
          },
          2,
        );
        if (rows.length !== 1) bad();
        const e = validateOutlineAttemptAudit(rows[0]),
          m = e.metadata;
        const terminal = a.phase === 'ADMITTED' || a.phase === 'REFUSED';
        const action =
          v === 0
            ? 'CURRICULUM_OUTLINE_PREPARED'
            : v === a.version && a.cancelledAt
              ? 'CURRICULUM_OUTLINE_CANCELLED'
              : v === 1
                ? 'CURRICULUM_OUTLINE_INVOCATION_MARKED'
                : v === a.version && terminal
                  ? a.phase === 'ADMITTED'
                    ? 'CURRICULUM_OUTLINE_ADMITTED'
                    : 'CURRICULUM_OUTLINE_ADMISSION_REFUSED'
                  : 'CURRICULUM_OUTLINE_COMPLETION_STORED';
        if (
          e.action !== action ||
          ledgerHex(e.actorId) !== a.actorId ||
          ledgerHex(m.technologyId) !== a.technologyId ||
          m.operationId !== a.operationId ||
          m.bindingDigest !== a.bindingDigest ||
          m.attemptVersion !== v
        )
          bad();
        const time =
          v === 0
            ? a.createdAt
            : action === 'CURRICULUM_OUTLINE_INVOCATION_MARKED'
              ? a.invocation?.markedAt
              : action === 'CURRICULUM_OUTLINE_CANCELLED'
                ? a.cancelledAt
                : action === 'CURRICULUM_OUTLINE_COMPLETION_STORED'
                  ? a.completion?.createdAt
                  : undefined;
        if (time && e.createdAt.toISOString() !== time) bad();
        if (
          events.length &&
          e.createdAt.getTime() < events.at(-1)!.createdAt.getTime()
        )
          bad();
        if (
          action === 'CURRICULUM_OUTLINE_COMPLETION_STORED' &&
          (ledgerHex(e._id) !== b.completionAuditId ||
            field(m, 'checkpointDigest') !== a.completion?.checkpointDigest)
        )
          bad();
        if (
          action === 'CURRICULUM_OUTLINE_ADMITTED' ||
          action === 'CURRICULUM_OUTLINE_ADMISSION_REFUSED'
        ) {
          if (
            ledgerHex(e._id) !== b.terminalAuditId ||
            a.receipt?.auditId !== b.terminalAuditId ||
            ledgerHex(ledgerObjectId(field(m, 'outlineId'))) !== b.outlineId ||
            ledgerHex(ledgerObjectId(field(m, 'outlineRevisionId'))) !==
              b.outlineRevisionId
          )
            bad();
          if (
            a.receipt?.kind === 'REFUSED' &&
            field(m, 'safeCode') !== a.receipt.code
          )
            bad();
        }
        events.push(e);
      }
      if (
        (
          await many(
            'auditLogs',
            {
              resourceType: 'CURRICULUM_OUTLINE_ATTEMPT',
              resourceId: oid(a._id),
              'metadata.attemptVersion': {
                $nin: events.map((e) => e.metadata.attemptVersion),
              },
            },
            1,
          )
        ).length
      )
        bad();
      const candidateRows = await many(
        'curriculumOutlineCandidates',
        {
          $or: [
            { _id: oid(b.outlineRevisionId) },
            { 'producer.attemptId': oid(b._id) },
          ],
        },
        2,
        full ? undefined : { _id: 1 },
      );
      if (
        a.phase === 'ADMITTED'
          ? candidateRows.length !== 1
          : candidateRows.length !== 0
      )
        bad();
      const ce = events.find(
        (e) => e.action === 'CURRICULUM_OUTLINE_COMPLETION_STORED',
      );
      const te = events.find(
        (e) =>
          e.action === 'CURRICULUM_OUTLINE_ADMITTED' ||
          e.action === 'CURRICULUM_OUTLINE_ADMISSION_REFUSED',
      );
      const completionAudit = ce
        ? parseOutlineCompletionAudit({
            id: ledgerHex(ce._id),
            action: ce.action,
            actorId: ledgerHex(ce.actorId),
            attemptId: b._id,
            technologyId: b.technologyId,
            operationId: b.operationId,
            digest: field(ce.metadata, 'checkpointDigest'),
            createdAt: ce.createdAt.toISOString(),
          })
        : null;
      const terminalAudit = te
        ? {
            id: ledgerHex(te._id),
            action: te.action,
            actorId: ledgerHex(te.actorId),
            attemptId: b._id,
            technologyId: b.technologyId,
            operationId: b.operationId,
            outlineId: b.outlineId,
            revision: 1,
            code: field(te.metadata, 'safeCode') ?? null,
            createdAt: te.createdAt.toISOString(),
          }
        : null;
      const candidate =
        full && candidateRows[0] ? candidateFromNative(candidateRows[0]) : null;
      return { completionAudit, terminalAudit, candidate };
    }
    try {
      remaining();
      requestId(deps.requestId);
      ledgerId(deps.requestingSessionId);
      if (db.client !== client) bad();
      const initial =
        mode === 'PREPARE'
          ? parseOutlineAttempt(input)
          : mode === 'METADATA' || mode === 'EVIDENCE'
            ? null
            : ledgerObject(input, {
                binding: parseOutlineAttemptBinding,
                expectedVersion: version,
                ...(mode === 'MARK' || mode === 'CAPTURE'
                  ? { invocation: parseOutlineInvocation }
                  : {}),
                ...(mode === 'CAPTURE'
                  ? {
                      completion: parseOutlineCompletion,
                      audit: parseOutlineCompletionAudit,
                    }
                  : {}),
              });
      const identity =
        mode === 'METADATA' || mode === 'EVIDENCE'
          ? ledgerObject(input, {
              actorId: ledgerId,
              attemptId: ledgerId,
              operationId: ledgerUuid,
              technologyId: ledgerId,
              bindingDigest: ledgerDigest,
              mode: exact(mode === 'METADATA' ? 'METADATA' : 'EVIDENCE'),
            })
          : null;
      let b =
        mode === 'PREPARE'
          ? outlineAttemptBinding(initial as Attempt)
          : initial && 'binding' in initial
            ? initial.binding
            : undefined;
      const actor = b?.actorId ?? identity!.actorId;
      authUntil = deps.clock.monotonic() + 5000;
      await credential(actor);
      // Qualified native transaction and namespace/index checks precede all writes.
      const hello = await bounded(() =>
        db
          .admin()
          .command(
            { hello: 1 },
            { timeoutMS: remaining(), signal: work.signal },
          ),
      );
      if (
        field(hello, 'isWritablePrimary') !== true ||
        typeof field(hello, 'setName') !== 'string' ||
        !field(hello, 'setName') ||
        !Number.isFinite(field(hello, 'logicalSessionTimeoutMinutes'))
      )
        bad();
      for (const collection of [
        'curriculumOutlineCandidates',
        'curriculumOutlineAttempts',
        'auditLogs',
        'users',
        'sessions',
      ]) {
        const indexes = await bounded(() =>
          db
            .collection(collection)
            .listIndexes({ timeoutMS: remaining() })
            .toArray(),
        );
        assertOutlineAttemptIndexes(collection, indexes);
      }
      session = client.startSession({
        causalConsistency: false,
        defaultTimeoutMS: remaining(),
      });
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        readPreference: 'primary',
        writeConcern: { w: 'majority', j: true },
        maxCommitTimeMS: Math.min(2000, remaining()),
      });
      stage = 'READ';
      let raw = await find(
        'curriculumOutlineAttempts',
        b
          ? { _id: oid(b._id) }
          : {
              _id: oid(identity!.attemptId),
              actorId: oid(identity!.actorId),
              operationId: identity!.operationId,
              technologyId: oid(identity!.technologyId),
              bindingDigest: identity!.bindingDigest,
            },
        completionProjection,
      );
      let row = raw === null ? undefined : decode(raw, true);
      if (b && mode === 'PREPARE') {
        for (const filter of [
          {
            scope: b.scope,
            actorId: oid(b.actorId),
            operationId: b.operationId,
          },
          { ledgerOperationId: oid(b.ledgerOperationId) },
        ]) {
          const other = await find(
            'curriculumOutlineAttempts',
            filter,
            completionProjection,
          );
          if (other !== null) {
            const decoded = decode(other, true);
            if (!ledgerSame(decoded.binding, b))
              throw new Failure('OPERATION_CONFLICT');
            row ??= decoded;
          }
        }
      }
      if (row) {
        if (b && !ledgerSame(row.binding, b))
          throw new Failure('OPERATION_CONFLICT');
        b ??= row.binding;
      }
      if (!b || (!row && mode !== 'PREPARE')) bad();
      const readFence = makeFence(
        row,
        b,
        mode === 'PREPARE' && !row ? 'PREPARE' : 'READ',
      );
      if ((await readFence.read()).kind !== 'CHECKED')
        throw new Failure('FORBIDDEN');
      await policy(b, mode);
      authUntil = undefined;
      const full = mode === 'MARK' || mode === 'CAPTURE' || mode === 'EVIDENCE';
      if (row && full) {
        await policy(b, 'EVIDENCE');
        raw = await find('curriculumOutlineAttempts', { _id: oid(b._id) });
        row = decode(raw, false);
        if (!ledgerSame(row.binding, b)) bad();
      }
      const observed = async () => {
        readOnly = true;
        if (!row) bad();
        const proof = await history(row, full);
        if (
          mode === 'CAPTURE' &&
          (!proof.completionAudit ||
            !ledgerSame(
              parseOutlineCompletionAudit(field(initial, 'audit')),
              proof.completionAudit,
            ))
        )
          throw new Failure('OPERATION_CONFLICT');
        if (full) {
          const source = await verifySource(b!, row.canonical, 'EVIDENCE');
          const candidate = row.canonical.completion
            ? validateCompletion(b!, row.canonical, source!)
            : null;
          if (
            row.canonical.phase === 'ADMITTED' &&
            (!candidate ||
              !proof.candidate ||
              JSON.stringify(candidate) !== JSON.stringify(proof.candidate) ||
              row.canonical.receipt?.kind !== 'COMMITTED' ||
              row.canonical.receipt.candidateId !== candidate._id ||
              row.canonical.receipt.definitionDigest !==
                candidate.definitionDigest)
          )
            bad();
        }
        return {
          kind: 'OBSERVED',
          cleanup: 'COMPLETE',
          evidence: full
            ? { kind: 'EXACT', attempt: row.canonical, ...proof }
            : { kind: 'METADATA_ONLY', metadata: metadata(row.canonical) },
        };
      };
      if (mode === 'METADATA' || mode === 'EVIDENCE') value = await observed();
      else if (
        row &&
        (mode === 'PREPARE' ||
          (mode === 'CANCEL' &&
            (row.canonical.cancelledAt !== null ||
              row.canonical.phase === 'ADMITTED' ||
              row.canonical.phase === 'REFUSED')))
      )
        value = await observed();
      else {
        const a = row?.canonical;
        if (mode === 'MARK' && a?.invocation) {
          if (
            !ledgerSame(
              a.invocation,
              parseOutlineInvocation(field(initial, 'invocation')),
            )
          )
            throw new Failure('OPERATION_CONFLICT');
          value = await observed();
        } else if (mode === 'CAPTURE' && a?.completion) {
          if (
            !a.invocation ||
            !ledgerSame(
              a.invocation,
              parseOutlineInvocation(field(initial, 'invocation')),
            ) ||
            JSON.stringify(a.completion) !==
              JSON.stringify(
                parseOutlineCompletion(field(initial, 'completion')),
              )
          )
            throw new Failure('OPERATION_CONFLICT');
          value = await observed();
        } else {
          const expected =
            mode === 'PREPARE' ? 0 : field(initial, 'expectedVersion');
          if (row && row.canonical.version !== expected)
            throw new Failure('STATE_CONFLICT');
          if (mode === 'PREPARE' && (initial as Attempt).version !== 0)
            throw new Failure('INVALID_INPUT');
          if (
            mode === 'PREPARE' &&
            ((initial as Attempt).phase !== 'PREPARED' ||
              (initial as Attempt).invocation !== null ||
              (initial as Attempt).completion !== null ||
              (initial as Attempt).receipt !== null ||
              (initial as Attempt).cancelledAt !== null)
          )
            throw new Failure('INVALID_INPUT');
          if (
            (mode === 'MARK' &&
              (!a || a.phase !== 'PREPARED' || a.cancelledAt !== null)) ||
            (mode === 'CAPTURE' &&
              (!a ||
                a.phase !== 'INVOCATION_MARKED' ||
                a.cancelledAt !== null ||
                !a.invocation ||
                !ledgerSame(
                  a.invocation,
                  parseOutlineInvocation(field(initial, 'invocation')),
                )))
          )
            throw new Failure('STATE_CONFLICT');
          const intentKey = b._id + ':' + mode;
          if (consumed.has(intentKey)) bad();
          if (row) await history(row, full);
          // Full authority/source/claim checks occur before any fencing/write.
          const proof = await verifySource(
            b,
            mode === 'MARK'
              ? {
                  ...row!.canonical,
                  invocation: parseOutlineInvocation(
                    field(initial, 'invocation'),
                  ),
                }
              : row?.canonical,
            mode,
          );
          const next =
            mode === 'PREPARE'
              ? (initial as Attempt)
              : {
                  ...a!,
                  version: a!.version + 1,
                  ...(mode === 'MARK'
                    ? {
                        phase: 'INVOCATION_MARKED',
                        invocation: field(initial, 'invocation'),
                      }
                    : mode === 'CAPTURE'
                      ? {
                          phase: 'COMPLETION_STORED',
                          completion: field(initial, 'completion'),
                        }
                      : {
                          cancelledAt: new Date(
                            ledgerInteger(deps.clock.now(), 0, 253402280199999),
                          ).toISOString(),
                        }),
                };
          const decodedNext =
            mode === 'CANCEL'
              ? decode(
                  {
                    ...row!.native,
                    version: row!.canonical.version + 1,
                    cancelledAt: new Date(
                      (next as { cancelledAt: string }).cancelledAt,
                    ),
                  },
                  true,
                )
              : decode(encodeOutlineAttempt(next), false);
          const nextCanonical = decodedNext.canonical;
          if (mode === 'CAPTURE') validateCompletion(b, nextCanonical, proof!);
          const action =
            mode === 'PREPARE'
              ? 'CURRICULUM_OUTLINE_PREPARED'
              : mode === 'MARK'
                ? 'CURRICULUM_OUTLINE_INVOCATION_MARKED'
                : mode === 'CAPTURE'
                  ? 'CURRICULUM_OUTLINE_COMPLETION_STORED'
                  : 'CURRICULUM_OUTLINE_CANCELLED';
          const auditId =
            mode === 'CAPTURE'
              ? oid(b.completionAuditId)
              : ledgerObjectId(deps.allocateAuditId());
          const eventTime =
            mode === 'PREPARE'
              ? b.createdAt
              : mode === 'MARK'
                ? nextCanonical.invocation!.markedAt
                : mode === 'CAPTURE'
                  ? nextCanonical.completion!.createdAt
                  : nextCanonical.cancelledAt!;
          const audit = validateOutlineAttemptAudit({
            _id: auditId,
            category: 'CONTENT_MANAGEMENT',
            action,
            actorId: oid(b.actorId),
            resourceType: 'CURRICULUM_OUTLINE_ATTEMPT',
            resourceId: oid(b._id),
            requestId: deps.requestId,
            createdAt: new Date(eventTime),
            metadata: {
              attemptId: oid(b._id),
              technologyId: oid(b.technologyId),
              operationId: b.operationId,
              attemptVersion: nextCanonical.version,
              bindingDigest: outlineAttemptBindingDigest(b),
              ...(mode === 'CAPTURE'
                ? {
                    checkpointDigest:
                      nextCanonical.completion!.checkpointDigest,
                  }
                : {}),
            },
          });
          if (mode === 'CAPTURE') {
            const supplied = parseOutlineCompletionAudit(
              field(initial, 'audit'),
            );
            if (!ledgerSame(supplied, completionAuditProjection(audit, b)))
              throw new Failure('OPERATION_CONFLICT');
          }
          const f = makeFence(row, b, mode);
          consumed.add(intentKey);
          const fenced = await f.fence();
          if (fenced.kind !== 'FENCED') throw new Failure('FORBIDDEN');
          stage = 'ATTEMPT';
          writeSent = true;
          if (mode === 'PREPARE')
            insertAck(
              await bounded(() =>
                db
                  .collection('curriculumOutlineAttempts')
                  .insertOne(encodeOutlineAttempt(nextCanonical), options()),
              ),
              oid(b._id),
            );
          else {
            const set =
              mode === 'MARK'
                ? {
                    invocation: encodeInvocation(nextCanonical.invocation!),
                    phase: 'INVOCATION_MARKED',
                  }
                : mode === 'CAPTURE'
                  ? {
                      completion: encodeCompletion(
                        parseOutlineCompletion(nextCanonical.completion),
                      ),
                      phase: 'COMPLETION_STORED',
                    }
                  : { cancelledAt: new Date(nextCanonical.cancelledAt!) };
            const result = ledgerObject(
              await bounded(() =>
                db
                  .collection('curriculumOutlineAttempts')
                  .updateOne(
                    statePredicate(row!),
                    { $set: set, $inc: { version: 1 } },
                    { ...options(), upsert: false },
                  ),
              ),
              {
                acknowledged: (v) => {
                  if (v !== true) bad();
                  return true;
                },
                matchedCount: one,
                modifiedCount: one,
                upsertedCount: (v) => ledgerInteger(v, 0, 0),
                upsertedId: nil,
              },
            );
            void result;
          }
          stage = 'AUDIT';
          insertAck(
            await bounded(() =>
              db.collection('auditLogs').insertOne(audit, options()),
            ),
            auditId,
          );
          await policy(b, mode);
          if ((await f.beforeCommit()).kind !== 'PRECOMMIT_CHECKED') bad();
          remaining();
          stage = 'COMMIT';
          committing = true;
          await bounded(
            () =>
              session!.commitTransaction({
                timeoutMS: Math.min(2000, remaining()),
              }),
            Math.min(2000, remaining()),
          );
          committed = true;
          value =
            mode === 'CANCEL'
              ? {
                  kind: 'RECORDED',
                  cleanup: 'COMPLETE',
                  metadata: metadata(nextCanonical),
                }
              : mode === 'CAPTURE'
                ? {
                    kind: 'RECORDED',
                    cleanup: 'COMPLETE',
                    attempt: nextCanonical,
                    audit: completionAuditProjection(audit, b),
                  }
                : {
                    kind: 'RECORDED',
                    cleanup: 'COMPLETE',
                    attempt: nextCanonical,
                  };
        }
      }
      if (readOnly) {
        await credential(b.actorId);
        await policy(b, mode);
        remaining();
      }
    } catch (error) {
      failure = {
        stage,
        code:
          error instanceof Failure
            ? error.code
            : stage === 'AUTHORIZE'
              ? 'INVALID_INPUT'
              : 'CONTROL_UNAVAILABLE',
      };
    } finally {
      if (session) {
        try {
          if (!committing && session.inTransaction()) {
            await bounded(
              () => session!.abortTransaction({ timeoutMS: 2000 }),
              2000,
              true,
            );
            if (writeSent) cleanupCode('ABORT_UNCONFIRMED');
          }
        } catch {
          cleanupCode('ABORT');
        } finally {
          try {
            await bounded(
              () => session!.endSession({ timeoutMS: 2000 }),
              2000,
              true,
            );
          } catch {
            cleanupCode('END_SESSION');
          }
          try {
            if (session.hasEnded !== true) cleanupCode('NOT_ENDED');
          } catch {
            cleanupCode('NOT_ENDED');
          }
        }
      }
    }
    try {
      remaining();
    } catch {
      failure ??= { stage, code: 'CONTROL_UNAVAILABLE' };
    }
    if (failure || cleanup.length) {
      if (
        writeSent ||
        committing ||
        committed ||
        readOnly ||
        mode === 'METADATA' ||
        mode === 'EVIDENCE' ||
        (stage === 'READ' && failure?.code === 'CONTROL_UNAVAILABLE')
      )
        return freezeOutline({
          kind: writeSent || committing ? 'OUTCOME_UNKNOWN' : 'UNRESOLVED',
          message,
          primary: failure,
          cleanup,
        });
      return freezeOutline({
        kind: 'REFUSED',
        code: failure?.code ?? 'CONTROL_UNAVAILABLE',
        message,
      });
    }
    return freezeOutline(value);

    async function verifySource(
      b: AttemptBinding,
      a: Decoded['canonical'] | undefined,
      m: Mode,
    ) {
      if (m === 'CANCEL' || m === 'METADATA') return undefined;
      return readSourceAndLedger(b, a, m);
    }
    async function readSourceAndLedger(
      b: AttemptBinding,
      a: Decoded['canonical'] | undefined,
      m: Mode,
    ) {
      if (m === 'CANCEL' || m === 'METADATA') bad();
      const activeSession = session!;
      const assertContext = (supplied: ClientSession) => {
        remaining();
        if (supplied !== activeSession || session !== activeSession) bad();
      };
      try {
        return await createOutlineEvidenceReader({
          db,
          client,
          session: activeSession,
          work,
          clock: deps.clock,
          loss: deps.loss,
          check: () => {
            assertContext(activeSession);
          },
          findOne: (collection, filter, opts) => {
            assertContext(opts.session);
            return find(collection, filter, opts.projection);
          },
          findMany: (collection, filter, opts) => {
            assertContext(opts.session);
            return many(collection, filter, opts.limit, opts.projection);
          },
          readCommand: (binding, ctx) => {
            assertContext(ctx.session);
            if (ctx.work !== work) bad();
            return bounded(() => readCommand(binding, ctx));
          },
        }).read({ binding: b, invocation: a?.invocation ?? null, mode: m });
      } catch (error) {
        if (error instanceof OutlineEvidenceFailure)
          throw new Failure(error.code);
        throw error;
      }
    }
    function validateCompletion(
      b: AttemptBinding,
      a: Decoded['canonical'],
      proof: Awaited<ReturnType<typeof readSourceAndLedger>>,
    ) {
      const c = parseOutlineCompletion(a.completion),
        i = a.invocation;
      if (!i) bad();
      if (
        outlineCheckpointDigest(b, i, c) !== c.checkpointDigest ||
        Buffer.byteLength(c.rawOutput, 'utf8') >
          proof.cmd.requestBounds.maxOutputBytes ||
        Date.parse(c.producer.completedAt) < Date.parse(i.markedAt) ||
        Date.parse(c.producer.completedAt) >= Date.parse(i.observeUntil) ||
        Date.parse(c.createdAt) < Date.parse(c.producer.completedAt)
      )
        bad();
      const body = ledgerObject(outlineData(JSON.parse(c.rawOutput)), {
        title: (v) => v,
        modules: (v) => v,
      });
      const validated = validateCurriculumOutline(
        JSON.stringify({
          schemaVersion: 1,
          technologyId: b.technologyId,
          source: b.brief,
          ...body,
        }),
        proof.brief,
      );
      if (!validated.ok) bad();
      const definition = {
        _id: b.outlineRevisionId,
        outlineId: b.outlineId,
        schemaVersion: 1,
        revision: 1,
        origin: 'AI_GENERATED',
        outline: validated.outline,
        proposal: b.proposal,
        createdBy: b.actorId,
        createdAt: c.createdAt,
        producer: c.producer,
        contentDigest: outlineContentDigest(validated.outline),
      };
      const candidate = validateOutlineCandidate({
        ...definition,
        definitionDigest: outlineDefinitionDigest(definition),
      });
      const proposed = proposeOutlineAdmission({
        candidate,
        rawOutput: c.rawOutput,
        brief: proof.brief,
        proposal: proof.proposal,
        context: {
          actorId: b.actorId,
          intent: {
            schemaVersion: 1,
            technologyId: b.technologyId,
            brief: b.brief,
            proposal: b.proposal,
            operationId: b.operationId,
          },
          command: proof.cmd,
          ledgerOperationId: b.ledgerOperationId,
          attemptId: b._id,
          outlineRevisionId: b.outlineRevisionId,
          outlineId: b.outlineId,
          claimId: i.id,
          ownerId: i.ownerId,
          templateVersion: b.templateVersion,
          completionDigest: c.producer.completionDigest,
          createdAt: c.createdAt,
          completedAt: c.producer.completedAt,
          currentAdmin: true,
          sourceAdmitted: true,
          producerVerified: true,
          attemptUnused: true,
          technologyStatus:
            proof.parent === 'ARCHIVED' ? 'DRAFT' : proof.parent,
        },
      });
      if (proposed.kind !== 'ADMISSION_PROPOSED') bad();
      return candidate;
    }
  }
  // Explicit host request/template reader. No environment/default configuration.
  const readCommand = deps.readCommand;
  function completionAuditProjection(
    a: ReturnType<typeof validateOutlineAttemptAudit>,
    b: AttemptBinding,
  ) {
    return parseOutlineCompletionAudit({
      id: ledgerHex(a._id),
      action: a.action,
      actorId: ledgerHex(a.actorId),
      attemptId: b._id,
      technologyId: b.technologyId,
      operationId: b.operationId,
      digest: field(a.metadata, 'checkpointDigest'),
      createdAt: a.createdAt.toISOString(),
    });
  }
  return Object.freeze({
    prepare: (input: unknown, work: OutlineWork) => run('PREPARE', input, work),
    mark: (input: unknown, work: OutlineWork) => run('MARK', input, work),
    capture: (input: unknown, work: OutlineWork) => run('CAPTURE', input, work),
    cancel: (input: unknown, work: OutlineWork) => run('CANCEL', input, work),
    inspect: (input: unknown, work: OutlineWork) => {
      let m: Mode;
      try {
        m = ledgerEnum(field(input, 'mode'), ['METADATA', 'EVIDENCE'] as const);
      } catch {
        return Promise.resolve({
          kind: 'REFUSED',
          code: 'INVALID_INPUT',
          message,
        });
      }
      return run(m, input, work);
    },
  });
}

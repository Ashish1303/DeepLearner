import {
  Document,
  Error as MongooseError,
  Mongoose,
  Schema,
  type Connection,
  type Model,
} from 'mongoose';
import {
  ledgerInvalid,
  ledgerSame,
  validateLedgerControl,
  validateLedgerOperation,
  validateLedgerPeriod,
} from './ai-usage-ledger.schema.js';

/** Declarations only; no DDL, connection, registry or startup initialization on import. */
export const ledgerRequiredIndexes = [
  {
    collection: 'aiUsageControls',
    name: '_id_',
    key: { _id: 1 },
    unique: true,
  },
  {
    collection: 'aiUsageControls',
    name: 'uq_ai_usage_scope',
    key: { scope: 1 },
    unique: true,
  },
  { collection: 'aiUsagePeriods', name: '_id_', key: { _id: 1 }, unique: true },
  {
    collection: 'aiUsagePeriods',
    name: 'uq_ai_usage_period',
    key: { scope: 1, periodKey: 1 },
    unique: true,
  },
  {
    collection: 'aiUsageOperations',
    name: '_id_',
    key: { _id: 1 },
    unique: true,
  },
  {
    collection: 'aiUsageOperations',
    name: 'uq_ai_usage_actor_operation',
    key: { scope: 1, actorId: 1, operationId: 1 },
    unique: true,
  },
  {
    collection: 'aiUsageOperations',
    name: 'uq_ai_usage_open',
    key: { scope: 1 },
    unique: true,
    partialFilterExpression: { open: true },
  },
  {
    collection: 'aiUsageOperations',
    name: 'uq_ai_usage_actor_minute',
    key: { scope: 1, actorId: 1, admissionWindowKey: 1 },
    unique: true,
  },
  { collection: 'users', name: '_id_', key: { _id: 1 }, unique: true },
  { collection: 'auditLogs', name: '_id_', key: { _id: 1 }, unique: true },
  {
    collection: 'auditLogs',
    name: 'uq_ai_usage_audit_version',
    key: { resourceType: 1, resourceId: 1, 'metadata.usageVersion': 1 },
    unique: true,
    partialFilterExpression: { resourceType: 'AI_USAGE_OPERATION' },
  },
] as const;

type Row = Record<string, unknown>;
const validators = {
  Control: validateLedgerControl,
  Period: validateLedgerPeriod,
  Operation: validateLedgerOperation,
};
const collections = {
  Control: 'aiUsageControls',
  Period: 'aiUsagePeriods',
  Operation: 'aiUsageOperations',
} as const;
const fields = {
  Control: [
    '_id',
    'schemaVersion',
    'scope',
    'version',
    'policyVersion',
    'policy',
    'profileVersion',
    'pricingVersion',
    'privacyVersion',
    'spendingApprovalRef',
    'dispatchEnabled',
    'frozen',
    'freezeReasons',
    'activeOperationId',
    'lastAdmissionAt',
    'createdAt',
    'updatedAt',
  ],
  Period: [
    '_id',
    'schemaVersion',
    'scope',
    'periodKey',
    'version',
    'settledPaise',
    'heldPaise',
    'createdAt',
    'updatedAt',
  ],
  Operation: [
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
    'version',
    'state',
    'open',
    'heldPaise',
    'actualPaise',
    'claim',
    'terminalEvidence',
    'safeCode',
    'lastAuditId',
    'updatedAt',
  ],
};
function denied(): never {
  throw ledgerInvalid();
}
function safeValidationError() {
  const e = new MongooseError.ValidationError();
  e.message = ledgerInvalid().message;
  return e;
}

function compile(connection: Connection, kind: keyof typeof validators) {
  const validate = validators[kind],
    collection = collections[kind],
    name = 'AiUsageLedger' + kind;
  const snapshot = new WeakMap<object, Row>();
  const paths = Object.fromEntries(
    fields[kind].map((field) => [
      field,
      {
        type: Schema.Types.Mixed,
        default: undefined,
        cast: false,
        immutable: true,
        ...(field === '_id' ? { auto: false } : {}),
      },
    ]),
  );
  const schema = new Schema<Row>(paths, {
    collection,
    strict: 'throw',
    versionKey: false,
    timestamps: false,
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
    id: false,
  });
  for (const i of ledgerRequiredIndexes) {
    if (i.collection !== collection || i.name === '_id_') continue;
    schema.index(i.key, {
      name: i.name,
      unique: true,
      collation: { locale: 'simple' },
      ...('partialFilterExpression' in i
        ? { partialFilterExpression: i.partialFilterExpression }
        : {}),
    });
  }
  function check(doc: object) {
    const raw: unknown = Document.prototype.toObject.call(doc, {
      getters: false,
      virtuals: false,
      transform: false,
      flattenObjectIds: false,
    });
    const row: Row = validate(raw),
      initial = snapshot.get(doc);
    if (!initial || !ledgerSame(initial, row)) denied();
    return row;
  }
  schema.pre('validate', function () {
    check(this);
  });
  schema.pre('save', denied);
  for (const op of [
    'updateOne',
    'updateMany',
    'replaceOne',
    'findOneAndUpdate',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ] as const)
    schema.pre(op, denied);
  schema.pre('deleteOne', { document: true, query: false }, denied);
  schema.pre('insertMany', denied);
  schema.pre('bulkWrite', denied);
  const base = connection.model<Row>(name, schema);
  base.validate = async () => denied();
  base.prototype.validate = async function (...args: unknown[]) {
    try {
      check(this);
      await Reflect.apply(Document.prototype.validate, this, args);
    } catch {
      throw ledgerInvalid();
    }
  };
  base.prototype.validateSync = function (...args: unknown[]) {
    try {
      check(this);
      return Reflect.apply(Document.prototype.validateSync, this, args)
        ? safeValidationError()
        : null;
    } catch {
      return safeValidationError();
    }
  };
  // No model API is a writer/DDL route, even if a caller later connects its host.
  for (const op of [
    'createCollection',
    'createIndexes',
    'ensureIndexes',
    'syncIndexes',
  ] as const)
    base[op] = async () => denied();
  class LedgerDocument extends base {
    constructor(input: unknown) {
      const row: Row = validate(input);
      super(row);
      snapshot.set(this, validate(row));
    }
  }
  return LedgerDocument;
}
const registrations = new WeakMap<Connection, ReturnType<typeof build>>();
function build(connection: Connection) {
  return {
    Control: compile(connection, 'Control'),
    Period: compile(connection, 'Period'),
    Operation: compile(connection, 'Operation'),
  };
}
/** Explicit inert factory. No use of the application's configured/live connection. */
export function registerAiUsageLedgerModels(connection?: Connection) {
  const host =
    connection ??
    new Mongoose({ autoCreate: false, autoIndex: false }).connection;
  if (host.readyState !== 0 || host.getClient() !== undefined) denied();
  const existing = registrations.get(host);
  if (existing) {
    if (
      host.models.AiUsageLedgerControl !==
        Object.getPrototypeOf(existing.Control) ||
      host.models.AiUsageLedgerPeriod !==
        Object.getPrototypeOf(existing.Period) ||
      host.models.AiUsageLedgerOperation !==
        Object.getPrototypeOf(existing.Operation)
    )
      denied();
    return existing;
  }
  if (
    [
      'AiUsageLedgerControl',
      'AiUsageLedgerPeriod',
      'AiUsageLedgerOperation',
    ].some((n) => host.models[n])
  )
    denied();
  const models = build(host);
  registrations.set(host, models);
  return models;
}
export type AiUsageLedgerModel = Model<Row>;

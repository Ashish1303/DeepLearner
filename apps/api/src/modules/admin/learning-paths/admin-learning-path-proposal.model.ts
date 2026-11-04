import {
  Document,
  Error as MongooseError,
  Schema,
  Types,
  type Model,
} from 'mongoose';
import { mongoose } from '../../../config/database.js';
import {
  proposalInvalid,
  validateProposalRecord,
  type ProposalRecord,
} from './admin-learning-path-proposal.schema.js';

type StoredProposal = Omit<
  ProposalRecord,
  '_id' | 'proposalId' | 'technologyId' | 'source'
> & {
  _id: Types.ObjectId;
  proposalId: Types.ObjectId;
  technologyId: Types.ObjectId;
  source: { id: Types.ObjectId; revision: number; digest: string };
};
export const proposalModelName = 'AdminLearningPathProposalRevision';
export const proposalIndexes = [
  {
    key: { proposalId: 1, revision: 1 },
    options: {
      name: 'uq_learning_path_proposal_revision',
      unique: true,
      collation: { locale: 'simple' },
    },
  },
  {
    key: { technologyId: 1, createdAt: -1, _id: -1 },
    options: {
      name: 'ix_learning_path_proposal_technology_created',
      unique: false,
      collation: { locale: 'simple' },
    },
  },
] as const;
const ref = {
  type: Schema.Types.ObjectId,
  cast: false,
  immutable: true,
  required: true,
  auto: false,
} as const;
const string = {
  type: String,
  cast: false,
  immutable: true,
  required: true,
} as const;
const number = {
  type: Number,
  cast: false,
  immutable: true,
  required: true,
} as const;
const nested = { _id: false, id: false, strict: 'throw' as const };
const sourceSchema = new Schema(
  { id: ref, revision: number, digest: string },
  nested,
);
const runtimeSchema = new Schema(
  { name: string, version: { ...string, required: false } },
  nested,
);
const prerequisiteSchema = new Schema({ description: string }, nested);
export const adminLearningPathProposalSchema = new Schema<StoredProposal>(
  {
    _id: ref,
    proposalId: ref,
    technologyId: ref,
    revision: number,
    schemaVersion: number,
    source: {
      type: sourceSchema,
      required: true,
      immutable: true,
      default: undefined,
    },
    title: string,
    objectives: { type: [{ ...string }], immutable: true, default: undefined },
    audience: string,
    depth: string,
    runtime: { type: runtimeSchema, immutable: true, default: undefined },
    technologyVersion: { ...string, required: false },
    prerequisites: {
      type: [prerequisiteSchema],
      immutable: true,
      default: undefined,
    },
    definitionDigest: string,
    createdAt: { type: Date, cast: false, immutable: true, required: true },
  },
  {
    collection: 'learningPathProposalRevisions',
    strict: 'throw',
    versionKey: false,
    timestamps: false,
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
for (const index of proposalIndexes)
  adminLearningPathProposalSchema.index(index.key, index.options);
const bindings = new WeakMap<object, unknown>();
function checkDocument(doc: object) {
  const raw: unknown = Document.prototype.toObject.call(doc, {
    getters: false,
    virtuals: false,
    transform: false,
    depopulate: false,
  });
  return validateProposalRecord(raw, bindings.get(doc));
}
adminLearningPathProposalSchema.pre('validate', function () {
  checkDocument(this);
});
function denied(): never {
  throw proposalInvalid();
}
adminLearningPathProposalSchema.pre('save', function refuseExistingRevision() {
  if (!this.isNew) denied();
});
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
  adminLearningPathProposalSchema.pre(op, denied);
adminLearningPathProposalSchema.pre(
  'deleteOne',
  { document: true, query: false },
  denied,
);
adminLearningPathProposalSchema.pre('bulkWrite', denied);
adminLearningPathProposalSchema.pre('insertMany', denied);

function validationError() {
  const error = new MongooseError.ValidationError();
  error.message = proposalInvalid().message;
  return error;
}
function buildModel(base: Model<StoredProposal>) {
  // Mongoose static/Standard-Schema validation skips document hooks and accepts
  // partial paths. C1 has no binding-aware static API: refuse it entirely.
  base.validate = async function () {
    throw proposalInvalid();
  };
  // The registry's compiled Base must fail closed too: validateSync skips hooks.
  base.prototype.validate = async function (...args: unknown[]): Promise<void> {
    try {
      checkDocument(this);
      await Reflect.apply(Document.prototype.validate, this, args);
    } catch {
      throw proposalInvalid();
    }
  };
  base.prototype.validateSync = function (
    ...args: unknown[]
  ): MongooseError.ValidationError | null {
    try {
      checkDocument(this);
      return Reflect.apply(Document.prototype.validateSync, this, args)
        ? validationError()
        : null;
    } catch {
      return validationError();
    }
  };
  class Proposal extends base {
    constructor(input: unknown, expected: unknown) {
      const row = validateProposalRecord(input, expected);
      super({
        ...row,
        _id: new Types.ObjectId(row._id),
        proposalId: new Types.ObjectId(row.proposalId),
        technologyId: new Types.ObjectId(row.technologyId),
        source: { ...row.source, id: new Types.ObjectId(row.source.id) },
      });
      bindings.set(this, {
        technologyId: row.technologyId,
        source: { ...row.source },
      });
    }
  }
  return { base, model: Proposal };
}
let registered: ReturnType<typeof buildModel> | undefined;

/** No registration/I/O on import; this factory only permits a disconnected host. */
export function registerAdminLearningPathProposalModel() {
  if (mongoose.connection.readyState !== 0) throw proposalInvalid();
  const existing = mongoose.models[proposalModelName];
  if (existing) {
    if (
      registered &&
      existing === registered.base &&
      existing.schema === adminLearningPathProposalSchema
    )
      return registered.model;
    throw proposalInvalid();
  }
  const base = mongoose.model<StoredProposal>(
    proposalModelName,
    adminLearningPathProposalSchema,
  );
  registered = buildModel(base);
  return registered.model;
}

// Structural helper intentionally grants no predecessor/source-storage authority.
export type { StoredProposal };

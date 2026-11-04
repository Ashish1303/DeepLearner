import {
  Document,
  Error as MongooseError,
  Schema,
  Types,
  type Model,
} from 'mongoose';
import { mongoose } from '../../../config/database.js';
import {
  briefInvalid,
  validateCurriculumBriefRecord,
  type CurriculumBriefRecord,
} from './admin-curriculum-brief.schema.js';

type StoredBrief = Omit<
  CurriculumBriefRecord,
  '_id' | 'technologyId' | 'createdBy'
> & {
  _id: Types.ObjectId;
  technologyId: Types.ObjectId;
  createdBy: Types.ObjectId;
};
export const curriculumBriefModelName = 'AdminCurriculumBriefRevision';
export const curriculumBriefIndexes = [
  {
    key: { createdBy: 1, operationId: 1 },
    options: {
      name: 'uq_curriculum_brief_actor_operation',
      unique: true,
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
const runtimeSchema = new Schema(
  { name: string, version: { ...string, required: false } },
  nested,
);
const prerequisiteSchema = new Schema({ description: string }, nested);
export const adminCurriculumBriefSchema = new Schema<StoredBrief>(
  {
    _id: ref,
    technologyId: ref,
    schemaVersion: number,
    revision: number,
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
    createdBy: ref,
    createdAt: { type: Date, cast: false, immutable: true, required: true },
    operationId: string,
    contentDigest: string,
  },
  {
    collection: 'curriculumBriefRevisions',
    strict: 'throw',
    versionKey: false,
    timestamps: false,
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
for (const index of curriculumBriefIndexes)
  adminCurriculumBriefSchema.index(index.key, index.options);
const technologies = new WeakMap<object, string>();
function checkDocument(doc: object) {
  const raw: unknown = Document.prototype.toObject.call(doc, {
    getters: false,
    virtuals: false,
    transform: false,
    depopulate: false,
  });
  return validateCurriculumBriefRecord(raw, technologies.get(doc));
}
adminCurriculumBriefSchema.pre('validate', function () {
  checkDocument(this);
});
function denied(): never {
  throw briefInvalid();
}
adminCurriculumBriefSchema.pre('save', function refuseBriefPersistence() {
  // S is structural only; even save({ validateBeforeSave: false }) must refuse.
  // A separately approved P repository will use validated native-driver inserts.
  denied();
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
  adminCurriculumBriefSchema.pre(op, denied);
adminCurriculumBriefSchema.pre(
  'deleteOne',
  { document: true, query: false },
  denied,
);
adminCurriculumBriefSchema.pre('bulkWrite', denied);
adminCurriculumBriefSchema.pre('insertMany', denied);

function validationError() {
  const error = new MongooseError.ValidationError();
  error.message = briefInvalid().message;
  return error;
}
function buildModel(base: Model<StoredBrief>) {
  // Static/Standard-Schema validators accept partial paths and bypass this context.
  base.validate = async function () {
    throw briefInvalid();
  };
  base.prototype.validate = async function (...args: unknown[]): Promise<void> {
    try {
      checkDocument(this);
      await Reflect.apply(Document.prototype.validate, this, args);
    } catch {
      throw briefInvalid();
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
  class Brief extends base {
    constructor(input: unknown, expectedTechnologyId: unknown) {
      const row = validateCurriculumBriefRecord(input, expectedTechnologyId);
      super({
        ...row,
        _id: new Types.ObjectId(row._id),
        technologyId: new Types.ObjectId(row.technologyId),
        createdBy: new Types.ObjectId(row.createdBy),
      });
      technologies.set(this, row.technologyId);
    }
  }
  return { base, model: Brief };
}
let registered: ReturnType<typeof buildModel> | undefined;

/** Explicit disconnected compilation only. Import does not register or connect. */
export function registerAdminCurriculumBriefModel() {
  if (mongoose.connection.readyState !== 0) throw briefInvalid();
  const existing = mongoose.models[curriculumBriefModelName];
  if (existing) {
    if (
      registered &&
      existing === registered.base &&
      existing.schema === adminCurriculumBriefSchema
    )
      return registered.model;
    throw briefInvalid();
  }
  const base = mongoose.model<StoredBrief>(
    curriculumBriefModelName,
    adminCurriculumBriefSchema,
  );
  registered = buildModel(base);
  return registered.model;
}

// A storage shape does not establish authenticated admission or persisted authority.
export type { StoredBrief };

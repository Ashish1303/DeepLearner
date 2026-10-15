import { Schema, Types, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

const idPattern = /^[a-z][a-z0-9-]{0,63}(?![\s\S])/;
const nodeKeys = ['id', 'label', 'description'];
const edgeKeys = ['id', 'source', 'target', 'label'];
const stepKeys = ['title', 'explanation', 'nodeIds', 'edgeIds'];
const configKeys = ['stepDurationMs', 'autoplay'];
const authoredKeys = [
  'type',
  'title',
  'textAlternative',
  'nodes',
  'edges',
  'steps',
  'animationConfig',
  'schemaVersion',
] as const;
const rootKeys = [
  ...authoredKeys,
  '_id',
  'conceptId',
  'technologyId',
  'topicId',
  'status',
  'createdBy',
  'updatedBy',
  'createdAt',
  'updatedAt',
  '__v',
];

// Inspect containers before Mongoose can discard keys or coerce values.
function objectInput(value: unknown, keys: readonly string[], path: string) {
  if (value === undefined) return value;
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new mongoose.Error.CastError('Object', value, path);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (
      typeof key !== 'string' ||
      !keys.includes(key) ||
      !('value' in descriptor)
    )
      throw new mongoose.Error.StrictModeError(path + '.' + String(key));
  }
  return value;
}
function arrayInput(value: unknown, path: string, keys?: readonly string[]) {
  if (value === undefined) return value;
  if (!Array.isArray(value))
    throw new mongoose.Error.CastError('Array', value, path);
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !('value' in descriptor) || descriptor.value == null)
      throw new mongoose.Error.CastError('Array', value, path);
    if (keys) objectInput(descriptor.value, keys, path + '.' + i);
    else if (typeof descriptor.value !== 'string')
      throw new mongoose.Error.CastError('String', descriptor.value, path);
  }
  for (const key of Reflect.ownKeys(value))
    if (
      key !== 'length' &&
      (typeof key !== 'string' ||
        !/^(0|[1-9][0-9]*)$/.test(key) ||
        Number(key) >= value.length)
    )
      throw new mongoose.Error.StrictModeError(path + '.' + String(key));
  return value;
}
function text(max: number, required = true) {
  return {
    type: String,
    cast: false,
    required,
    trim: true,
    minlength: 1,
    maxlength: max,
    validate: (value: unknown) =>
      value === undefined ||
      (typeof value === 'string' && value.trim().length > 0),
  };
}
function localId() {
  return { type: String, cast: false, required: true, match: idPattern };
}
function reference(ref: string) {
  return {
    type: Schema.Types.ObjectId,
    ref,
    required: true,
    cast: (value: unknown) => {
      if (value instanceof Types.ObjectId) return value;
      if (typeof value === 'string' && /^[a-fA-F0-9]{24}(?![\s\S])/.test(value))
        return new Types.ObjectId(value);
      throw new mongoose.Error.CastError('ObjectId', value, ref);
    },
  };
}
const nested = { _id: false, strict: 'throw' as const };
const nodeSchema = new Schema(
  { id: localId(), label: text(120), description: text(1000, false) },
  nested,
);
const edgeSchema = new Schema(
  { id: localId(), source: localId(), target: localId(), label: text(120) },
  nested,
);
function references(path: string, min: number, max: number) {
  return {
    type: [localId()],
    required: true,
    default: undefined,
    set: (value: unknown) => arrayInput(value, path),
    validate: (value: unknown) =>
      Array.isArray(value) &&
      value.length >= min &&
      value.length <= max &&
      new Set(value).size === value.length,
  };
}
const stepSchema = new Schema(
  {
    title: text(120),
    explanation: text(2000),
    nodeIds: references('nodeIds', 1, 50),
    edgeIds: references('edgeIds', 0, 100),
  },
  nested,
);
const animationSchema = new Schema(
  {
    stepDurationMs: {
      type: Number,
      cast: false,
      required: true,
      min: 100,
      max: 10000,
      validate: Number.isSafeInteger,
    },
    autoplay: {
      type: Boolean,
      cast: false,
      required: true,
      validate: (value: unknown) => value === false,
    },
  },
  nested,
);

export const visualizationSchema = new Schema(
  {
    conceptId: reference('Concept'),
    technologyId: reference('Technology'),
    topicId: reference('Topic'),
    type: {
      type: String,
      cast: false,
      required: true,
      enum: ['ANIMATED_FLOW'],
    },
    title: text(120),
    textAlternative: text(4000),
    nodes: {
      type: [nodeSchema],
      required: true,
      default: undefined,
      set: (value: unknown) => arrayInput(value, 'nodes', nodeKeys),
      validate: (value: unknown) =>
        Array.isArray(value) && value.length >= 1 && value.length <= 50,
    },
    edges: {
      type: [edgeSchema],
      required: true,
      default: undefined,
      set: (value: unknown) => arrayInput(value, 'edges', edgeKeys),
      validate: (value: unknown) => Array.isArray(value) && value.length <= 100,
    },
    steps: {
      type: [stepSchema],
      required: true,
      default: undefined,
      set: (value: unknown) => arrayInput(value, 'steps', stepKeys),
      validate: (value: unknown) =>
        Array.isArray(value) && value.length >= 1 && value.length <= 100,
    },
    animationConfig: {
      type: animationSchema,
      default: undefined,
      set: (value: unknown) =>
        objectInput(value, configKeys, 'animationConfig'),
    },
    status: {
      type: String,
      cast: false,
      required: true,
      default: 'DRAFT',
      enum: [
        'DRAFT',
        'AI_GENERATED',
        'IN_REVIEW',
        'CHANGES_REQUIRED',
        'APPROVED',
        'PUBLISHED',
        'ARCHIVED',
      ],
    },
    schemaVersion: {
      type: Number,
      cast: false,
      required: true,
      default: 1,
      enum: [1],
    },
    createdBy: reference('User'),
    updatedBy: reference('User'),
  },
  {
    collection: 'visualizations',
    timestamps: true,
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);

// Whole-document checks run on async validate()/save(), including mutations of
// existing subdocuments. Query updates/raw collection writes are not this boundary.
visualizationSchema.pre('validate', function () {
  const nodes = this.nodes ?? [];
  const edges = this.edges ?? [];
  const steps = this.steps ?? [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  if (nodeIds.size !== nodes.length)
    this.invalidate('nodes', 'Duplicate node IDs');
  if (edgeIds.size !== edges.length)
    this.invalidate('edges', 'Duplicate edge IDs');
  if (
    edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))
  )
    this.invalidate('edges', 'Unknown node reference');
  if (
    steps.some(
      (step) =>
        step.nodeIds?.some((id) => !nodeIds.has(id)) ||
        step.edgeIds?.some((id) => !edgeIds.has(id)),
    )
  )
    this.invalidate('steps', 'Unknown step reference');
  const plain = this.toObject({
    virtuals: false,
    getters: false,
    transform: false,
  });
  const authored = Object.fromEntries(
    authoredKeys.map((key) => [key, plain[key]]),
  );
  if (Buffer.byteLength(JSON.stringify(authored), 'utf8') > 262144)
    this.invalidate('textAlternative', 'Authored payload exceeds 256 KiB');
});
visualizationSchema.index({ conceptId: 1, status: 1 });
visualizationSchema.index({ conceptId: 1, type: 1 });
export type VisualizationRecord = InferSchemaType<typeof visualizationSchema>;
const VisualizationModel = mongoose.model('Visualization', visualizationSchema);

// Reject root keys Mongoose intentionally ignores rather than silently accepting
// them. Normal Mongoose construction, validation and persistence remain inherited.
export class Visualization extends VisualizationModel {
  constructor(...args: ConstructorParameters<typeof VisualizationModel>) {
    objectInput(args[0], rootKeys, 'visualization');
    super(
      args[0] as Partial<VisualizationRecord> | undefined,
      args[1],
      args[2],
    );
  }
}

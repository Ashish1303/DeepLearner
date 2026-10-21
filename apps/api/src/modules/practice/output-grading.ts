import { types } from 'node:util';
import { z } from 'zod';

export const outputGradingRefusalCodes = [
  'INVALID_INPUT',
  'UNSUPPORTED_VERSION',
  'INVALID_RUBRIC',
  'UNSUPPORTED_RUBRIC',
  'RUBRIC_NOT_APPROVED',
  'BINDING_MISMATCH',
  'INVALID_ANSWER',
] as const;
export type OutputGradingRefusalCode =
  (typeof outputGradingRefusalCodes)[number];
export type OutputGradingResult =
  | Readonly<{ status: 'GRADED'; outcome: 'CORRECT'; score: 100 }>
  | Readonly<{ status: 'GRADED'; outcome: 'INCORRECT'; score: 0 }>
  | Readonly<{ status: 'REFUSED'; code: OutputGradingRefusalCode }>;

const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const token = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const questionSchema = z.strictObject({
  id,
  conceptId: id,
  type: token,
  questionRevision: digest,
  contentFingerprint: digest,
  rubricId: token,
  rubricVersion: version,
});
function validText(value: string): boolean {
  if (value.length < 1 || value.length > 10_000 || !/\S/u.test(value))
    return false;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
const answer = z.string().refine(validText);
const rubricSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: token,
  version,
  approval: z.enum(['DRAFT', 'APPROVED', 'REVOKED']),
  questionId: id,
  conceptId: id,
  type: token,
  questionRevision: digest,
  contentFingerprint: digest,
  answerForm: token,
  comparison: token,
  normalization: token,
  expectedAnswer: answer,
});
const rootSchema = z.strictObject({
  schemaVersion: z.unknown(),
  question: z.unknown(),
  rubric: z.unknown(),
  studentAnswer: z.unknown(),
});
export type OutputGradingInput = Readonly<{
  schemaVersion: 1;
  question: Readonly<z.output<typeof questionSchema>>;
  rubric: Readonly<z.output<typeof rubricSchema>>;
  studentAnswer: string;
}>;

// Copy data descriptors only. Safe arrays can be inspected to classify a refusal;
// no array is accepted by the input schemas. Proxies/getters never execute.
function dataSnapshot(input: unknown): unknown {
  const ancestors = new Set<object>();
  let remaining = 200;
  function copy(value: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 4) throw new Error();
    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value;
    if (typeof value !== 'object' || types.isProxy(value)) throw new Error();
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (
      (array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null) ||
      ancestors.has(value)
    )
      throw new Error();
    const keys = Reflect.ownKeys(value);
    if (keys.length > 32 || keys.some((key) => typeof key !== 'string'))
      throw new Error();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const data = (key: string) => {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
        throw new Error();
      return copy(descriptor.value, depth + 1);
    };
    ancestors.add(value);
    try {
      if (array) {
        const length: unknown = descriptors.length?.value;
        if (typeof length !== 'number' || keys.length !== length + 1)
          throw new Error();
        const result: unknown[] = [];
        for (let i = 0; i < length; i++) result.push(data(String(i)));
        return result;
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const key of keys) result[key as string] = data(key as string);
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  return copy(input, 0);
}
const refused = (code: OutputGradingRefusalCode): OutputGradingResult => ({
  status: 'REFUSED',
  code,
});

/** Disconnected internal comparison only. APPROVED and the expected context are
 * caller assertions, not authenticated provenance. Never use this as an HTTP
 * authorization boundary or as verified/persisted completion evidence. */
export function evaluateOutputGrading(input: unknown): OutputGradingResult {
  let snapshot: unknown;
  try {
    snapshot = dataSnapshot(input);
  } catch {
    return refused('INVALID_INPUT');
  }
  const root = rootSchema.safeParse(snapshot);
  if (
    !root.success ||
    !Object.keys(rootSchema.shape).every((key) => Object.hasOwn(root.data, key))
  )
    return refused('INVALID_INPUT');
  const question = questionSchema.safeParse(root.data.question);
  if (!question.success) return refused('INVALID_INPUT');
  if (root.data.schemaVersion !== 1) return refused('UNSUPPORTED_VERSION');
  const rawRubric = root.data.rubric;
  if (!rawRubric || typeof rawRubric !== 'object' || Array.isArray(rawRubric))
    return refused('INVALID_RUBRIC');
  if (
    Object.hasOwn(rawRubric, 'schemaVersion') &&
    (rawRubric as Record<string, unknown>).schemaVersion !== 1
  )
    return refused('UNSUPPORTED_VERSION');
  const rubric = rubricSchema.safeParse(rawRubric);
  if (!rubric.success) return refused('INVALID_RUBRIC');
  const q = question.data,
    r = rubric.data;
  if (
    q.type !== 'OUTPUT' ||
    r.type !== 'OUTPUT' ||
    r.answerForm !== 'TEXT' ||
    r.comparison !== 'EXACT_TEXT' ||
    r.normalization !== 'NONE'
  )
    return refused('UNSUPPORTED_RUBRIC');
  if (r.approval !== 'APPROVED') return refused('RUBRIC_NOT_APPROVED');
  if (
    r.questionId !== q.id ||
    r.conceptId !== q.conceptId ||
    r.questionRevision !== q.questionRevision ||
    r.contentFingerprint !== q.contentFingerprint ||
    r.id !== q.rubricId ||
    r.version !== q.rubricVersion
  )
    return refused('BINDING_MISMATCH');
  const submitted = answer.safeParse(root.data.studentAnswer);
  if (!submitted.success) return refused('INVALID_ANSWER');
  return submitted.data === r.expectedAnswer
    ? { status: 'GRADED', outcome: 'CORRECT', score: 100 }
    : { status: 'GRADED', outcome: 'INCORRECT', score: 0 };
}

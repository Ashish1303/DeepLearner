import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { z } from 'zod';

export const evidenceId = z
  .string()
  .max(24)
  .regex(/^[a-f0-9]{24}(?![\s\S])/);
export const evidenceDigest = z
  .string()
  .max(64)
  .regex(/^[a-f0-9]{64}(?![\s\S])/);
export const evidenceCorrelation = z
  .string()
  .max(128)
  .regex(/^[A-Za-z0-9_-]{1,128}(?![\s\S])/);
export const evidencePolicy = {
  section: 'READ',
  policyId: 'F038_READ_ACK_ACTIVITY',
  policyVersion: 1,
  producerVersion: 1,
  schemaVersion: 1,
} as const;
export const evidenceLifetime = 300_000;
export function additionalSectionRevision(
  input: unknown,
  section: 'EXAMPLE' | 'REVISE',
) {
  const value = snapshotSchema.parse(evidenceData(input));
  const content =
    section === 'EXAMPLE'
      ? value.examples.map((e) => [e.title, e.bodyMarkdown])
      : value.revise;
  if (!content || (Array.isArray(content) && content.length === 0))
    throw new Error('Section unavailable');
  return {
    conceptRevision: sectionEvidenceRevision(value).conceptRevision,
    sectionRevision: evidenceHash([
      'F038-section-ack-v3',
      value.id,
      section,
      content,
    ]),
  };
}
export const evidenceHash = (value: unknown[]) =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

// Bounded snapshots do not execute accessors, proxies, toJSON or coercion hooks.
export function evidenceData(input: unknown): unknown {
  let budget = 512;
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): unknown {
    if (--budget < 0 || depth > 7) throw new Error('Invalid metadata');
    if (
      value === null ||
      value === undefined ||
      typeof value === 'boolean' ||
      typeof value === 'number'
    )
      return value;
    if (typeof value === 'string') {
      if (value.length > 50_000) throw new Error('Invalid metadata');
      return value;
    }
    if (
      typeof value !== 'object' ||
      types.isProxy(value) ||
      ancestors.has(value)
    )
      throw new Error('Invalid metadata');
    const array = Array.isArray(value);
    if (
      array
        ? Object.getPrototypeOf(value) !== Array.prototype
        : ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      throw new Error('Invalid metadata');
    const keys = Reflect.ownKeys(value);
    if (keys.length > 33 || keys.some((k) => typeof k !== 'string'))
      throw new Error('Invalid metadata');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    ancestors.add(value);
    try {
      const result: Record<string, unknown> | unknown[] = array
        ? []
        : Object.create(null);
      for (const key of keys as string[]) {
        if (array && key === 'length') continue;
        const d = descriptors[key]!;
        if (
          !d.enumerable ||
          !('value' in d) ||
          (array && !/^(0|[1-9][0-9]*)$/.test(key))
        )
          throw new Error('Invalid metadata');
        Object.defineProperty(result, key, {
          value: copy(d.value, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      if (array && (result as unknown[]).length !== descriptors.length!.value)
        throw new Error('Invalid metadata');
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  return copy(input, 0);
}
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => /\S/u.test(v));
const snapshotSchema = z.strictObject({
  id: evidenceId,
  technologyId: evidenceId,
  learningPathId: evidenceId,
  moduleId: evidenceId,
  topicId: evidenceId,
  title: text(120),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/),
  difficulty: z.enum([
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'INTERVIEW_READY',
  ]),
  order: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  contentFormat: z.literal('MARKDOWN'),
  schemaVersion: z.literal(1),
  read: z.strictObject({ summary: text(2000), bodyMarkdown: text(50_000) }),
  source: z.strictObject({
    label: text(120),
    url: text(2048).refine((v) => {
      try {
        const u = new URL(v);
        return (
          /^https:\/\//i.test(v) &&
          !/[\s\\]/.test(v) &&
          ![...v].some(
            (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
          ) &&
          !!u.hostname &&
          !u.username &&
          !u.password
        );
      } catch {
        return false;
      }
    }),
    sourceType: z.literal('OFFICIAL_OR_TRUSTED'),
    isOfficial: z.boolean(),
  }),
  examples: z
    .array(z.strictObject({ title: text(120), bodyMarkdown: text(10_000) }))
    .max(10)
    .refine(
      (rows) => rows.reduce((n, r) => n + r.bodyMarkdown.length, 0) <= 50_000,
    ),
  revise: z
    .strictObject({
      summary: text(2000),
      keyPoints: z.array(text(500)).max(10),
      memoryTrick: text(2000).nullable(),
      importantCodeMarkdown: text(10_000).nullable(),
    })
    .nullable(),
});
export type EvidenceSnapshot = z.output<typeof snapshotSchema>;
export function sectionEvidenceRevision(input: unknown) {
  const r = snapshotSchema.parse(evidenceData(input));
  const source = [
    r.source.label,
    r.source.url,
    r.source.sourceType,
    r.source.isOfficial,
  ];
  return {
    conceptRevision: evidenceHash([
      'F038-C2-concept-v1',
      r.id,
      r.technologyId,
      r.learningPathId,
      r.moduleId,
      r.topicId,
      r.title,
      r.slug,
      r.difficulty,
      r.order,
      r.contentFormat,
      r.schemaVersion,
      r.read.summary,
      r.read.bodyMarkdown,
      source,
      r.examples.map((e) => [e.title, e.bodyMarkdown]),
      r.revise
        ? [
            r.revise.summary,
            r.revise.keyPoints,
            r.revise.memoryTrick,
            r.revise.importantCodeMarkdown,
          ]
        : null,
    ]),
    sectionRevision: evidenceHash([
      'F038-C2-read-v1',
      r.id,
      r.title,
      r.contentFormat,
      r.read.summary,
      r.read.bodyMarkdown,
      source,
    ]),
  };
}

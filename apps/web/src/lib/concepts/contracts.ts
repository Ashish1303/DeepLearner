import { z } from 'zod';
import {
  idSchema,
  pageNumber,
  type Crumb,
  type Topic,
} from '../learning-paths/contracts';

const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value.trim() === value && value.length > 0);
export function safeHttpsUrl(value: string): string | undefined {
  if (
    !/^https:\/\//i.test(value) ||
    /[\s\\]/.test(value) ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
const identity = {
  id: idSchema,
  technologyId: idSchema,
  learningPathId: idSchema,
  moduleId: idSchema,
  topicId: idSchema,
  title: text(120),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/),
  difficulty: z.enum([
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'INTERVIEW_READY',
  ]),
  order: z.number().int().nonnegative(),
};
export const summarySchema = z.object({ ...identity, summary: text(2000) });
export const conceptSchema = z.object({
  ...identity,
  contentFormat: z.literal('MARKDOWN'),
  schemaVersion: z.literal(1),
  read: z.object({
    summary: text(2000),
    bodyMarkdown: z
      .string()
      .min(1)
      .max(50000)
      .refine((value) => value.trim().length > 0),
  }),
  source: z.object({
    label: text(120),
    url: z
      .url()
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && !url.username && !url.password;
        } catch {
          return false;
        }
      }),
    sourceType: z.literal('OFFICIAL_OR_TRUSTED'),
    isOfficial: z.boolean(),
  }),
});
export const conceptListEnvelope = z
  .object({
    success: z.literal(true),
    message: z.string().nullable(),
    data: z
      .array(summarySchema)
      .max(20)
      .refine(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
      ),
    meta: z
      .object({
        requestId: z
          .string()
          .min(1)
          .refine((value) => value.trim().length > 0),
        page: pageNumber,
        limit: z.literal(20),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .refine((meta) => meta.totalPages === Math.ceil(meta.total / 20)),
  })
  .refine(
    (result) =>
      result.data.length ===
      Math.min(
        20,
        Math.max(0, result.meta.total - (result.meta.page - 1) * 20),
      ),
  );
export type Concept = z.infer<typeof conceptSchema>;
export type ConceptSummary = z.infer<typeof summarySchema>;
export type ConceptResource = 'topic' | 'concept';
export interface ConceptData {
  topic: Topic;
  crumbs: Crumb[];
  concept: Concept | null;
  items: ConceptSummary[];
  totalPages: number;
}
export function conceptRoute(id: string) {
  return '/concepts/' + idSchema.parse(id);
}
export const difficultyLabels: Record<Concept['difficulty'], string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  INTERVIEW_READY: 'Interview ready',
};

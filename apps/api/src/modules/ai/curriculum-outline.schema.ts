import { z } from 'zod';
import { proposalContent } from '../admin/learning-paths/admin-learning-path-proposal.schema.js';

/** One untrusted outline, not a catalogue record or authenticated AI artifact. */
export const curriculumOutlineByteLimit = 65_536;
const title = proposalContent.title;
const concept = z.strictObject({ title }).readonly();
const concepts = z
  .array(concept)
  .min(1)
  .max(12)
  .refine(
    (items) => new Set(items.map((item) => item.title)).size === items.length,
  )
  .readonly();
const topic = z.strictObject({ title, concepts }).readonly();
const topics = z
  .array(topic)
  .min(1)
  .max(8)
  .refine(
    (items) => new Set(items.map((item) => item.title)).size === items.length,
  )
  .readonly();
const module = z
  .strictObject({
    title,
    objectives: proposalContent.objectives.max(10).readonly(),
    topics,
  })
  .readonly();

export const curriculumOutlineSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    technologyId: z.string().regex(/^[a-f0-9]{24}(?![\s\S])/),
    source: z
      .strictObject({
        id: z.string().regex(/^[a-f0-9]{24}(?![\s\S])/),
        revision: z.literal(1),
        digest: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
      })
      .readonly(),
    title,
    modules: z
      .array(module)
      .min(1)
      .max(8)
      .refine(
        (items) =>
          new Set(items.map((item) => item.title)).size === items.length,
      )
      .readonly(),
  })
  .refine((outline) => {
    let topicCount = 0;
    let conceptCount = 0;
    for (const item of outline.modules) {
      topicCount += item.topics.length;
      for (const child of item.topics) conceptCount += child.concepts.length;
    }
    return topicCount <= 32 && conceptCount <= 128;
  })
  .readonly();

export type CurriculumOutline = z.output<typeof curriculumOutlineSchema>;

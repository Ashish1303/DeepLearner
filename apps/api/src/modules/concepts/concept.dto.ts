import type { Types } from 'mongoose';
import type { ConceptRecord } from './concept.model.js';
export interface ProjectedConceptSummary {
  _id: Types.ObjectId;
  technologyId: Types.ObjectId;
  learningPathId: Types.ObjectId;
  moduleId: Types.ObjectId;
  topicId: Types.ObjectId;
  title: string;
  slug: string;
  difficulty: ConceptRecord['difficulty'];
  order: number;
  read: { summary: string };
}
export interface ProjectedConceptDetail extends ProjectedConceptSummary {
  revise?: {
    summary: string;
    keyPoints?: string[];
    memoryTrick?: string;
    importantCodeMarkdown?: string;
  };
  examples?: { title: string; bodyMarkdown: string }[];
  contentFormat: ConceptRecord['contentFormat'];
  schemaVersion: number;
  read: { summary: string; bodyMarkdown: string };
  source: {
    label: string;
    url: string;
    sourceType: ConceptRecord['source']['sourceType'];
    isOfficial: boolean;
  };
}
function identity(record: ProjectedConceptSummary) {
  return {
    id: record._id.toHexString(),
    technologyId: record.technologyId.toHexString(),
    learningPathId: record.learningPathId.toHexString(),
    moduleId: record.moduleId.toHexString(),
    topicId: record.topicId.toHexString(),
    title: record.title,
    slug: record.slug,
    difficulty: record.difficulty,
    order: record.order,
  };
}
export function conceptSummaryDto(record: ProjectedConceptSummary) {
  return { ...identity(record), summary: record.read.summary };
}
export function conceptDetailDto(record: ProjectedConceptDetail) {
  return {
    ...identity(record),
    revise: record.revise
      ? {
          summary: record.revise.summary,
          keyPoints: [...(record.revise.keyPoints ?? [])],
          memoryTrick: record.revise.memoryTrick ?? null,
          importantCodeMarkdown: record.revise.importantCodeMarkdown ?? null,
        }
      : null,
    examples: (record.examples ?? []).map((example) => ({
      title: example.title,
      bodyMarkdown: example.bodyMarkdown,
    })),
    contentFormat: record.contentFormat,
    schemaVersion: record.schemaVersion,
    read: {
      summary: record.read.summary,
      bodyMarkdown: record.read.bodyMarkdown,
    },
    source: {
      label: record.source.label,
      url: record.source.url,
      sourceType: record.source.sourceType,
      isOfficial: record.source.isOfficial,
    },
  };
}
export type ConceptSummaryDto = ReturnType<typeof conceptSummaryDto>;
export type ConceptDetailDto = ReturnType<typeof conceptDetailDto>;

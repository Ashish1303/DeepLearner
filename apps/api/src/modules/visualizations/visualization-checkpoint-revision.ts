import { Types } from 'mongoose';
import { evidenceHash } from '../progress/section-evidence-revision.js';
import { Visualization } from './visualization.model.js';
import type { CheckpointDefinition } from './visualization-checkpoint-definition.model.js';

export const checkpointPolicy = {
  policyId: 'F038_VISUALIZE_CHECKPOINT_ACTIVITY',
  policyVersion: 1,
  verifierVersion: 1,
} as const;
export const checkpointToken = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/;
export const checkpointChoiceId = /^[a-z][a-z0-9-]{0,63}(?![\s\S])/;
export const sameCheckpointData = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function checkpointBinding(
  d: Pick<
    CheckpointDefinition,
    | 'conceptId'
    | 'visualizationId'
    | 'conceptRevision'
    | 'visualizationRevision'
    | 'checkpointId'
    | 'checkpointVersion'
    | 'policyId'
    | 'policyVersion'
  >,
) {
  return {
    conceptId: d.conceptId.toHexString(),
    visualizationId: d.visualizationId.toHexString(),
    conceptRevision: d.conceptRevision,
    visualizationRevision: d.visualizationRevision,
    checkpointId: d.checkpointId,
    checkpointVersion: d.checkpointVersion,
    policyId: d.policyId,
    policyVersion: d.policyVersion,
  };
}
export const definitionFingerprint = (
  d: Pick<
    CheckpointDefinition,
    | 'conceptId'
    | 'visualizationId'
    | 'conceptRevision'
    | 'visualizationRevision'
    | 'checkpointId'
    | 'checkpointVersion'
    | 'policyId'
    | 'policyVersion'
    | 'verifierVersion'
    | 'responseType'
    | 'prompt'
    | 'textAlternative'
    | 'choices'
    | 'expectedChoiceId'
  >,
) =>
  evidenceHash([
    'F038-C3b-definition-v1',
    d.conceptId.toHexString(),
    d.visualizationId.toHexString(),
    d.conceptRevision,
    d.visualizationRevision,
    d.checkpointId,
    d.checkpointVersion,
    d.policyId,
    d.policyVersion,
    d.verifierVersion,
    d.responseType,
    d.prompt,
    d.textAlternative,
    d.choices.map((c) => [c.id, c.label]),
    d.expectedChoiceId,
  ]);

// Stored database projection only. F026 validation precedes hashing; text must
// already be canonical, rather than silently repaired by Mongoose's trim setters.
export async function checkpointVisualizationRevision(
  row: Record<string, unknown>,
  scope: {
    conceptId: Types.ObjectId;
    topicId: Types.ObjectId;
    technologyId: Types.ObjectId;
  },
) {
  for (const key of [
    '_id',
    'conceptId',
    'topicId',
    'technologyId',
    'createdBy',
    'updatedBy',
  ])
    if (!(row[key] instanceof Types.ObjectId))
      throw new Error('Invalid visualization');
  if (
    row.status !== 'PUBLISHED' ||
    !sameCheckpointData(row.conceptId, scope.conceptId) ||
    !sameCheckpointData(row.topicId, scope.topicId) ||
    !sameCheckpointData(row.technologyId, scope.technologyId)
  )
    throw new Error('Unavailable visualization');
  const model = new Visualization(row);
  await model.validate();
  const v = model.toObject({
    getters: false,
    virtuals: false,
    transform: false,
  });
  const project = (r: Record<string, unknown>) => [
    'F038-C3b-visual-v1',
    String(r._id),
    String(r.conceptId),
    String(r.technologyId),
    String(r.topicId),
    r.schemaVersion,
    r.type,
    r.title,
    r.textAlternative,
    (r.nodes as { id: string; label: string; description?: string }[]).map(
      (n) => [n.id, n.label, n.description ?? null],
    ),
    (
      r.edges as { id: string; source: string; target: string; label: string }[]
    ).map((e) => [e.id, e.source, e.target, e.label]),
    (
      r.steps as {
        title: string;
        explanation: string;
        nodeIds: string[];
        edgeIds: string[];
      }[]
    ).map((s) => [s.title, s.explanation, s.nodeIds, s.edgeIds]),
    r.animationConfig == null
      ? null
      : [
          (r.animationConfig as { stepDurationMs: number }).stepDurationMs,
          false,
        ],
  ];
  if (!sameCheckpointData(project(row), project(v)))
    throw new Error('Noncanonical visualization');
  return evidenceHash(project(v));
}

import { validateCurriculumBriefStructure } from '../admin/learning-paths/admin-curriculum-brief.schema.js';
import { validateProposalStructure } from '../admin/learning-paths/admin-learning-path-proposal.schema.js';
import { validateCurriculumOutline } from './curriculum-outline.validator.js';
import {
  ledgerBoolean,
  ledgerDigest,
  ledgerEnum,
  ledgerId,
  ledgerIntentFingerprint,
  ledgerNullable,
  ledgerObject,
  ledgerRequestDigest,
  ledgerUuid,
  validateReserveCommand,
} from './ai-usage-ledger.schema.js';
import {
  freezeOutline,
  outlineData,
  outlineIntentDigest,
  outlineRawOutputDigest,
  outlineTimestamp,
  validateOutlineCandidate,
  validateOutlineIntent,
  type OutlineCandidate,
} from './curriculum-outline-candidate.schema.js';

export const outlineAdmissionCodes = [
  'INVALID_INPUT',
  'SOURCE_MISMATCH',
  'AUTHORITY_UNAVAILABLE',
  'TECHNOLOGY_INELIGIBLE',
  'PRODUCER_UNVERIFIED',
  'OPERATION_CONFLICT',
  'OUTPUT_INVALID',
] as const;
type Code = (typeof outlineAdmissionCodes)[number];
export type OutlineAdmission =
  | Readonly<{ kind: 'ADMISSION_PROPOSED'; candidate: OutlineCandidate }>
  | Readonly<{
      kind: 'REFUSED';
      code: Code;
      message: 'Curriculum outline admission is unavailable';
    }>;
function refuse(code: Code): OutlineAdmission {
  return Object.freeze({
    kind: 'REFUSED',
    code,
    message: 'Curriculum outline admission is unavailable',
  });
}
const fact = ledgerNullable(ledgerBoolean);
function context(input: unknown) {
  return ledgerObject(input, {
    actorId: ledgerId,
    intent: validateOutlineIntent,
    command: validateReserveCommand,
    ledgerOperationId: ledgerId,
    attemptId: ledgerId,
    outlineRevisionId: ledgerId,
    outlineId: ledgerId,
    claimId: ledgerUuid,
    ownerId: ledgerUuid,
    templateVersion: ledgerUuid,
    completionDigest: ledgerDigest,
    createdAt: outlineTimestamp,
    completedAt: outlineTimestamp,
    currentAdmin: fact,
    sourceAdmitted: fact,
    producerVerified: fact,
    attemptUnused: fact,
    technologyStatus: ledgerNullable((v) =>
      ledgerEnum(v, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const),
    ),
  });
}

/** Supplied facts are not authenticated here. A proposal permits no dispatch/write. */
export function proposeOutlineAdmission(input: unknown): OutlineAdmission {
  try {
    const r = ledgerObject(input, {
      candidate: (v: unknown) => v,
      rawOutput: (v: unknown) => {
        outlineRawOutputDigest(v);
        return v as string;
      },
      brief: validateCurriculumBriefStructure,
      proposal: validateProposalStructure,
      context,
    });
    const { brief, proposal, context: c } = r,
      i = c.intent,
      cmd = c.command;
    if (c.currentAdmin !== true || c.sourceAdmitted !== true)
      return refuse('AUTHORITY_UNAVAILABLE');
    if (c.technologyStatus !== 'DRAFT' && c.technologyStatus !== 'PUBLISHED')
      return refuse('TECHNOLOGY_INELIGIBLE');
    if (c.producerVerified !== true) return refuse('PRODUCER_UNVERIFIED');
    if (c.attemptUnused !== true) return refuse('OPERATION_CONFLICT');
    if (
      proposal.revision !== 1 ||
      proposal.technologyId !== brief.technologyId ||
      proposal.source.id !== brief._id ||
      proposal.source.revision !== 1 ||
      proposal.source.digest !== brief.contentDigest ||
      i.technologyId !== brief.technologyId ||
      i.brief.id !== brief._id ||
      i.brief.digest !== brief.contentDigest ||
      i.proposal.id !== proposal._id ||
      i.proposal.proposalId !== proposal.proposalId ||
      i.proposal.digest !== proposal.definitionDigest ||
      cmd.technologyId !== brief.technologyId ||
      cmd.source.id !== brief._id ||
      cmd.source.revision !== 1 ||
      cmd.source.digest !== brief.contentDigest
    )
      return refuse('SOURCE_MISMATCH');
    if (
      i.operationId !== cmd.operationId ||
      i.operationId === brief.operationId
    )
      return refuse('OPERATION_CONFLICT');
    // Exact minimized content-only request projection; no source/actor/operation identifiers.
    const expectedInput = JSON.stringify({
      title: brief.title,
      objectives: brief.objectives,
      audience: brief.audience,
      depth: brief.depth,
      runtime: brief.runtime,
      technologyVersion: brief.technologyVersion,
      prerequisites: brief.prerequisites,
    });
    if (cmd.inputJson !== expectedInput) return refuse('SOURCE_MISMATCH');
    const candidate = validateOutlineCandidate(r.candidate),
      p = candidate.producer;
    if (
      candidate.outline.technologyId !== brief.technologyId ||
      candidate.outline.source.id !== brief._id ||
      candidate.outline.source.revision !== 1 ||
      candidate.outline.source.digest !== brief.contentDigest ||
      JSON.stringify(candidate.proposal) !== JSON.stringify(i.proposal)
    )
      return refuse('SOURCE_MISMATCH');
    if (
      candidate.createdBy !== c.actorId ||
      candidate._id !== c.outlineRevisionId ||
      candidate.outlineId !== c.outlineId ||
      candidate.createdAt !== c.createdAt ||
      p.attemptId !== c.attemptId ||
      p.ledgerOperationId !== c.ledgerOperationId ||
      p.operationId !== i.operationId ||
      p.claimId !== c.claimId ||
      p.ownerId !== c.ownerId ||
      p.templateVersion !== c.templateVersion ||
      p.completedAt !== c.completedAt ||
      p.requestDigest !==
        ledgerRequestDigest({
          instructions: cmd.instructions,
          inputJson: cmd.inputJson,
        }) ||
      p.intentDigest !==
        outlineIntentDigest({
          actorId: c.actorId,
          intent: i,
          ledgerIntentFingerprint: ledgerIntentFingerprint({
            actorId: c.actorId,
            command: cmd,
          }),
          templateVersion: c.templateVersion,
        }) ||
      p.completionDigest !== c.completionDigest
    )
      return refuse('OPERATION_CONFLICT');
    if (
      p.rawOutputDigest !== outlineRawOutputDigest(r.rawOutput) ||
      Buffer.byteLength(r.rawOutput, 'utf8') > cmd.requestBounds.maxOutputBytes
    )
      return refuse('OUTPUT_INVALID');
    let output;
    try {
      const body = ledgerObject(outlineData(JSON.parse(r.rawOutput)), {
        title: (v: unknown) => v,
        modules: (v: unknown) => v,
      });
      output = validateCurriculumOutline(
        JSON.stringify({
          schemaVersion: 1,
          technologyId: brief.technologyId,
          source: { id: brief._id, revision: 1, digest: brief.contentDigest },
          title: body.title,
          modules: body.modules,
        }),
        brief,
      );
    } catch {
      return refuse('OUTPUT_INVALID');
    }
    if (
      !output.ok ||
      JSON.stringify(output.outline) !== JSON.stringify(candidate.outline)
    )
      return refuse('OUTPUT_INVALID');
    return freezeOutline({ kind: 'ADMISSION_PROPOSED' as const, candidate });
  } catch {
    return refuse('INVALID_INPUT');
  }
}

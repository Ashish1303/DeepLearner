import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import {
  qualificationAuthority,
  type QualificationAuthority,
} from '../progress/completion-evidence.service.js';
import {
  mongoRubrics,
  gradingUnavailable,
  type RubricStore,
  type GradingRead,
} from './practice-rubric.repository.js';
import { rubricAuthority, rubricDefinition } from './practice-rubric.model.js';
import {
  completionAssessmentRecord,
  type CompletionAssessmentRecord,
} from './practice-assessment.model.js';
import { completionAssessments } from './practice-assessment.repository.js';
import { evaluateOutputGrading } from './output-grading.js';
import type { AttemptRecord } from './practice-attempt.model.js';
import { sha256 } from './practice.dto.js';

export type CompletionAssessmentStore = typeof completionAssessments;
/** Runs inside F036's session. No nested transaction, response DTO or completion writer. */
export function createCompletionGrading(
  origins = qualificationAuthority,
  rubrics: RubricStore = mongoRubrics,
  assessments: CompletionAssessmentStore = completionAssessments,
) {
  async function scope(a: AttemptRecord, read: GradingRead, fence: boolean) {
    const authority = origins(
      a.userId.toHexString(),
      a.questionId.toHexString(),
    );
    if (!authority) return null;
    authority.assert();
    const policy = await authority.current(read, fence);
    if (
      a.type !== 'OUTPUT' ||
      a.conceptId.toHexString() !== policy.conceptId ||
      a.questionId.toHexString() !== policy.questionId ||
      a.questionRevision !== policy.questionRevision ||
      a.contentFingerprint !== policy.contentFingerprint
    )
      throw gradingUnavailable();
    const d = await rubrics.definition(
      new Types.ObjectId(policy.rubricId),
      policy.rubricVersion,
      read,
    );
    const value = await rubrics.authority(
      new Types.ObjectId(policy.rubricId),
      policy.rubricVersion,
      read,
    );
    if (!d || !value) throw gradingUnavailable();
    rubricDefinition.parse(d);
    const auth = rubricAuthority.parse(value);
    if (
      auth.state !== 'APPROVED' ||
      !auth.definitionId.equals(d._id) ||
      !auth.authorId.equals(d.authorId) ||
      auth.definitionFingerprint !== d.definitionFingerprint ||
      auth.version !== d.version ||
      !auth.rubricId.equals(d.rubricId) ||
      auth.approvedAt < d.createdAt ||
      d.definitionFingerprint !== policy.rubricDefinitionFingerprint ||
      d.questionId.toHexString() !== policy.questionId ||
      d.conceptId.toHexString() !== policy.conceptId ||
      d.questionRevision !== policy.questionRevision ||
      d.contentFingerprint !== policy.contentFingerprint
    )
      throw gradingUnavailable();
    await rubrics.actor(a.userId.toHexString(), 'STUDENT', read);
    await rubrics.actor(d.authorId.toHexString(), 'ADMIN', read);
    await rubrics.actor(auth.reviewerId.toHexString(), 'ADMIN', read);
    await rubrics.auditProof(
      d,
      d.authorId,
      'PRACTICE_RUBRIC_AUTHORED',
      d.createdAt,
      read,
    );
    await rubrics.auditProof(
      d,
      auth.reviewerId,
      'PRACTICE_RUBRIC_APPROVED',
      auth.approvedAt,
      read,
      auth.approvalAuditId,
    );
    const fenced = fence ? await rubrics.fence(auth, read) : auth;
    authority.assert();
    return { policy, definition: d, authority: fenced, origin: authority };
  }
  const identity = (a: AttemptRecord) =>
    sha256(
      JSON.stringify([
        'F038-completion-assessment-v1',
        a.userId.toHexString(),
        a._id.toHexString(),
        a.requestFingerprint,
      ]),
    );
  return {
    async before(owner: string, question: string, ms: number) {
      const origin = origins(owner, question);
      if (origin) await origin.ready(ms);
    },
    async record(a: AttemptRecord, replay: boolean, read: GradingRead) {
      if (a.attemptNumber !== 1) return; // Ordinary later submissions never replace the first grade.
      const origin = origins(
        a.userId.toHexString(),
        a.questionId.toHexString(),
      );
      if (!origin) {
        // A lost registry can never reconstruct origin or silently recover a
        // previously qualifying unlock without its required authority/proof.
        if (a.attemptNumber === 1 && (await assessments.find(a, read)))
          throw gradingUnavailable();
        return;
      }
      origin.assert();
      const bound = await scope(a, read, true);
      if (!bound) throw gradingUnavailable();
      if (replay) {
        const original = await assessments.find(a, read);
        if (!original) throw gradingUnavailable();
        return original;
      }
      const { definition: d, policy: p, authority } = bound;
      const result = evaluateOutputGrading({
        schemaVersion: 1,
        question: {
          id: a.questionId.toHexString(),
          conceptId: a.conceptId.toHexString(),
          type: a.type,
          questionRevision: a.questionRevision,
          contentFingerprint: a.contentFingerprint,
          rubricId: d.rubricId.toHexString(),
          rubricVersion: d.version,
        },
        rubric: {
          schemaVersion: 1,
          id: d.rubricId.toHexString(),
          version: d.version,
          approval: 'APPROVED',
          questionId: d.questionId.toHexString(),
          conceptId: d.conceptId.toHexString(),
          type: d.type,
          questionRevision: d.questionRevision,
          contentFingerprint: d.contentFingerprint,
          answerForm: d.answerForm,
          comparison: d.comparison,
          normalization: d.normalization,
          expectedAnswer: d.expectedAnswer,
        },
        studentAnswer: a.studentAnswer,
      });
      if (result.status !== 'GRADED')
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid qualifying submission',
        );
      const row = completionAssessmentRecord.parse({
        _id: new Types.ObjectId(),
        userId: a.userId,
        attemptId: a._id,
        questionId: a.questionId,
        conceptId: a.conceptId,
        type: 'OUTPUT',
        questionRevision: a.questionRevision,
        contentFingerprint: a.contentFingerprint,
        attemptRequestFingerprint: a.requestFingerprint,
        rubricId: d.rubricId,
        rubricVersion: d.version,
        rubricDefinitionFingerprint: d.definitionFingerprint,
        graderId: 'OUTPUT_EXACT_TEXT_COMPLETION',
        graderVersion: 1,
        purpose: 'COMPLETION_INPUT',
        outcome: result.outcome,
        score: result.score,
        refusalCode: null,
        evaluatedAt: new Date(),
        requestedBy: a.userId,
        authorityId: authority._id,
        reviewerId: authority.reviewerId,
        approvalAuditId: authority.approvalAuditId,
        authorizationFence: authority.decisionFence,
        requestFingerprint: identity(a),
        schemaVersion: 2,
        policyId: new Types.ObjectId(p.policyId),
        policyVersion: p.version,
        policyFingerprint: p.fingerprint,
        sourceEpoch: p.sourceEpoch,
        submissionProvenance: 'F036_FIRST_SUBMISSION_ATOMIC_V1',
        attemptNumber: 1,
      });
      await assessments.insert(row, read);
      origin.assert();
      return row;
    },
    async proof(
      a: AttemptRecord,
      read: GradingRead,
      expected?: CompletionAssessmentRecord,
    ) {
      if (a.attemptNumber !== 1) return;
      const row = await assessments.find(a, read);
      const origin = origins(
        a.userId.toHexString(),
        a.questionId.toHexString(),
      );
      if (!row && !origin) return;
      if (!row || !origin) throw gradingUnavailable();
      if (expected && JSON.stringify(row) !== JSON.stringify(expected))
        throw gradingUnavailable();
      const bound = await scope(a, read, false);
      if (!bound) throw gradingUnavailable();
      const p = bound.policy,
        d = bound.definition,
        auth = bound.authority;
      if (
        !row.userId.equals(a.userId) ||
        !row.attemptId.equals(a._id) ||
        !row.questionId.equals(a.questionId) ||
        !row.conceptId.equals(a.conceptId) ||
        row.requestFingerprint !== identity(a) ||
        row.attemptRequestFingerprint !== a.requestFingerprint ||
        row.questionRevision !== a.questionRevision ||
        row.contentFingerprint !== a.contentFingerprint ||
        row.policyId.toHexString() !== p.policyId ||
        row.policyVersion !== p.version ||
        row.policyFingerprint !== p.fingerprint ||
        row.sourceEpoch !== p.sourceEpoch ||
        !row.rubricId.equals(d.rubricId) ||
        row.rubricVersion !== d.version ||
        row.rubricDefinitionFingerprint !== d.definitionFingerprint ||
        !row.authorityId.equals(auth._id) ||
        !row.reviewerId.equals(auth.reviewerId) ||
        !row.approvalAuditId.equals(auth.approvalAuditId) ||
        row.authorizationFence > auth.decisionFence
      )
        throw gradingUnavailable();
      origin.assert();
    },
  };
}
export type CompletionGrading = ReturnType<typeof createCompletionGrading>;
export const completionGrading = createCompletionGrading();
export type { QualificationAuthority };

import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { mongoose } from '../../config/database.js';
import type { ConceptCompletionPolicy } from '../concepts/concept.model.js';
import { publishedConceptStages } from '../concepts/concept.repository.js';
import {
  mongoRubrics,
  gradingOptions,
  gradingWriteSession,
  GradingWriteConflict,
  type GradingRead,
} from '../practice/practice-rubric.repository.js';
import { gradingIndexes } from '../practice/practice-assessment.repository.js';
import {
  attemptRecord,
  attemptIndexes,
  type AttemptRecord,
} from '../practice/practice-attempt.model.js';
import {
  completionAssessmentRecord,
  type CompletionAssessmentRecord,
} from '../practice/practice-assessment.model.js';
import { completionGrading } from '../practice/completion-grading.service.js';
import {
  practiceAttemptCoordination,
  type PracticeAttemptCoordination,
} from '../practice/practice-attempt.repository.js';
import { sha256 } from '../practice/practice.dto.js';
import {
  checkpointIndexes,
  mongoCheckpoint,
} from '../visualizations/visualization-checkpoint.repository.js';
import {
  checkpointDefinitionRecord,
  type CheckpointDefinition,
} from '../visualizations/visualization-checkpoint-definition.model.js';
import { checkpointBinding } from '../visualizations/visualization-checkpoint-revision.js';
import {
  checkpointIssueFingerprint,
  checkpointResponseFingerprint,
} from '../visualizations/visualization-checkpoint.service.js';
import {
  acknowledgementChallengeRecord,
  visualChallengeRecord,
} from './section-evidence-challenge.model.js';
import {
  acknowledgementReceiptRecord,
  visualReceiptRecord,
} from './section-evidence-receipt.model.js';
import {
  issueFingerprint,
  ackFingerprint,
} from './section-evidence.service.js';
import {
  mongoQualification,
  mongoEvidence,
  additionalAcknowledgementStore,
  verifyEvidenceIndex,
  EvidenceWriteConflict,
} from './section-evidence.repository.js';
import {
  qualificationAuthority,
  type QualificationAuthority,
} from './completion-evidence.service.js';
import {
  evaluateCompletionPolicy,
  type CompletionPolicyInput,
} from './completion-policy.js';
import {
  progressRepository,
  ProgressWriteConflict,
  attemptStatsStages,
  type ProgressHierarchy,
  type ProgressBaseline,
} from './progress.repository.js';
import { activityStats } from './progress.dto.js';
import {
  progressIndex,
  progressRecord,
  progressV2Record,
  emptyCompletionFields,
  type ProgressRecord,
  type ProgressV2Record,
  type CompletionClaim,
} from './progress.model.js';
import {
  completionRequestIndex,
  completionRequestRecord,
  CompletionRequestReceipt,
  type CompletionRequest,
} from './completion-request.model.js';
import {
  completionGraph,
  completionView,
  completionUnavailable,
  completionUnconfirmed,
  completionConflict,
  type CompletionView,
  type CompletionBlocker,
} from './completion.schema.js';

type Read = GradingRead;
type Section = ConceptCompletionPolicy['requiredSections'][number];
type Action = {
  section: Exclude<Section, 'PRACTICE'>;
  status: 'QUALIFIED' | 'MISSING' | 'STALE' | 'REVOKED';
  receiptId?: string;
};
export type CompletionScope = {
  owner: string;
  conceptId: string;
  conceptRevision: string;
  policy: ConceptCompletionPolicy | null;
  state: 'CURRENT' | 'STALE' | 'REVOKED' | 'MISSING';
  origin: QualificationAuthority;
  checkpoint: CheckpointDefinition | null;
  visualization: CompletionView['visualization'];
};
export type CompletionSources = {
  actions: Action[];
  attempt: AttemptRecord | null;
  assessment: CompletionAssessmentRecord | null;
  practiceStatus: CompletionView['practice']['status'];
};
export type CompletionSnapshot = {
  scope: CompletionScope;
  sources: CompletionSources;
  progress: ProgressBaseline;
  claimSources?: CompletionSources;
};
export const completionIndexes = [
  ...attemptIndexes.map((i) => ({ ...i, collection: 'practiceAttempts' })),
  { ...progressIndex, collection: 'studentProgress' },
  ...gradingIndexes,
  ...checkpointIndexes,
  completionRequestIndex,
] as const;
export function verifyCompletionIndex(
  rows: Record<string, unknown>[],
  expected: (typeof completionIndexes)[number],
) {
  const matches = rows.filter((r) => r.name === expected.name),
    r = matches[0];
  if (
    matches.length !== 1 ||
    !r ||
    r.v !== 2 ||
    !same(r.key, expected.key) ||
    (r.unique === true) !== expected.unique ||
    (r.unique !== undefined && typeof r.unique !== 'boolean') ||
    Object.keys(r).some((k) => !['v', 'key', 'name', 'unique'].includes(k))
  )
    throw completionUnavailable();
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const db = () => {
  if (!mongoose.connection.db) throw completionUnavailable();
  return mongoose.connection.db;
};
const increment = (n: number) => {
  if (!Number.isSafeInteger(n) || n < 0 || n >= Number.MAX_SAFE_INTEGER)
    throw completionUnavailable();
  return n + 1;
};
const claimOf = (p: ProgressRecord | null) =>
  p?.schemaVersion === 2 ? p.completion : null;
const boundClaim = (
  c: CompletionClaim,
  s: CompletionScope,
  evidence: CompletionSources,
) => {
  const p = s.policy;
  return (
    !!p &&
    s.state === 'CURRENT' &&
    c.policyId.toHexString() === p.policyId &&
    c.policyVersion === p.version &&
    c.policyFingerprint === p.fingerprint &&
    c.conceptRevision === s.conceptRevision &&
    c.sourceEpoch === p.sourceEpoch &&
    same(c.requiredSections, p.requiredSections) &&
    evidence.assessment?._id.equals(c.assessmentId) &&
    evidence.attempt?._id.equals(c.attemptId) &&
    evidence.assessment.score === 100 &&
    evidence.actions.length === c.sectionReceipts.length &&
    evidence.actions.every(
      (a) =>
        a.status === 'QUALIFIED' &&
        c.sectionReceipts.some(
          (r) =>
            r.section === a.section &&
            r.receiptId.toHexString() === a.receiptId,
        ),
    )
  );
};
export function buildCompletionView(
  snapshot: CompletionSnapshot,
): CompletionView {
  const { scope: s, sources: e, progress } = snapshot,
    p = s.policy;
  const required =
    p?.requiredSections ??
    (['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'] as const);
  const blockers: CompletionBlocker[] = [];
  const verified = s.state === 'CURRENT' && p !== null;
  if (!verified)
    blockers.push({
      code: s.state === 'MISSING' ? 'POLICY_UNAVAILABLE' : 'COMPLETION_STALE',
    });
  const input: CompletionPolicyInput = {
    schemaVersion: 1,
    subject: {
      studentId: s.owner,
      conceptId: s.conceptId,
      conceptRevision: s.conceptRevision,
    },
    policy: {
      id: p?.policyId ?? 'POLICY_UNAVAILABLE',
      revision: String(p?.version ?? 1),
      requiredSections: required,
      minimumScore: 70,
    },
    sectionEvidence: verified
      ? e.actions
          .filter((a) => a.status === 'QUALIFIED' && a.receiptId)
          .map((a) => ({
            studentId: s.owner,
            conceptId: s.conceptId,
            conceptRevision: s.conceptRevision,
            policyId: p!.policyId,
            policyRevision: String(p!.version),
            evidenceId: a.receiptId!,
            section: a.section,
            verification: 'VERIFIED',
            outcome: 'COMPLETED',
          }))
      : [],
    ...(verified && e.assessment && e.attempt
      ? {
          practiceEvidence: {
            studentId: s.owner,
            conceptId: s.conceptId,
            conceptRevision: s.conceptRevision,
            policyId: p!.policyId,
            policyRevision: String(p!.version),
            evaluationId: e.assessment._id.toHexString(),
            attemptId: e.attempt._id.toHexString(),
            questionId: e.attempt.questionId.toHexString(),
            questionRevision: e.attempt.questionRevision,
            type: 'OUTPUT',
            verification: 'VERIFIED',
            gradingStatus: 'GRADED',
            score: e.assessment.score,
          } as const,
        }
      : {}),
  };
  const eligibility = evaluateCompletionPolicy(input);
  blockers.push(...eligibility.blockers);
  for (const a of e.actions)
    if (a.status === 'STALE' || a.status === 'REVOKED')
      blockers.push({ code: 'RECEIPT_UNAVAILABLE', section: a.section });
  if (e.practiceStatus === 'UNQUALIFIED')
    blockers.push({ code: 'PRE_DISCLOSURE_NOT_PROVEN', section: 'PRACTICE' });
  const claim = claimOf(progress.summary),
    old = snapshot.claimSources ?? e;
  const status: CompletionView['completion']['status'] = !claim
    ? 'NOT_COMPLETED'
    : boundClaim(claim, s, old)
      ? 'COMPLETED'
      : s.state === 'REVOKED' || old.actions.some((a) => a.status === 'REVOKED')
        ? 'REVOKED'
        : 'STALE';
  if (status === 'STALE' || status === 'REVOKED')
    blockers.push({ code: 'COMPLETION_STALE' });
  const unique = [
    ...new Map(
      blockers.map((b) => [b.code + ':' + (b.section ?? ''), b]),
    ).values(),
  ];
  const rank = (b: CompletionBlocker) =>
    [
      'POLICY_UNAVAILABLE',
      'INVALID_INPUT',
      'INVALID_CONFIGURATION',
      'UNSUPPORTED_VERSION',
      'UNSUPPORTED_CONFIGURATION',
      'EVIDENCE_SCOPE_MISMATCH',
      'EVIDENCE_REVISION_MISMATCH',
      'COMPLETION_STALE',
      'RECEIPT_UNAVAILABLE',
      'ASSESSMENT_UNAVAILABLE',
      'EVIDENCE_MISSING',
      'REQUIRED_CONTENT_UNSUPPORTED',
      'EVIDENCE_CONFLICT',
      'EVIDENCE_UNVERIFIED',
      'EVIDENCE_INCOMPLETE',
      'PRE_DISCLOSURE_NOT_PROVEN',
      'PRACTICE_UNGRADED',
      'PRACTICE_SCORE_BELOW_THRESHOLD',
    ].indexOf(b.code);
  unique.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE', 'REVISE'].indexOf(
        a.section ?? '',
      ) -
        ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE', 'REVISE'].indexOf(
          b.section ?? '',
        ),
  );
  // Eligibility is independent of an old stale claim: fresh sources can enable a new explicit action.
  const eligible =
    verified &&
    eligibility.eligibility === 'ELIGIBLE' &&
    !e.actions.some((a) => a.status !== 'QUALIFIED') &&
    e.practiceStatus === 'QUALIFIED';
  const visibleBlockers = eligible
    ? unique.filter((b) => b.code !== 'COMPLETION_STALE')
    : unique;
  return completionView.parse({
    conceptId: s.conceptId,
    viewRevision: sha256(
      JSON.stringify([
        'F038-public-completion-view-v1',
        s.conceptId,
        s.conceptRevision,
        p?.policyId ?? null,
        p?.version ?? null,
        required,
        70,
        s.visualization,
      ]),
    ),
    requiredSections: required,
    sections: required.map((section) => ({
      section,
      status: !verified
        ? s.state === 'REVOKED'
          ? 'REVOKED'
          : s.state === 'STALE'
            ? 'STALE'
            : 'UNSUPPORTED'
        : section === 'PRACTICE'
          ? e.practiceStatus === 'QUALIFIED'
            ? 'QUALIFIED'
            : e.practiceStatus === 'STALE'
              ? 'STALE'
              : e.practiceStatus === 'REVOKED'
                ? 'REVOKED'
                : 'MISSING'
          : (e.actions.find((a) => a.section === section)?.status ?? 'MISSING'),
    })),
    practice: {
      questionId: p?.questionId ?? null,
      type: p ? 'OUTPUT' : null,
      status: verified
        ? e.practiceStatus
        : s.state === 'REVOKED'
          ? 'REVOKED'
          : s.state === 'STALE'
            ? 'STALE'
            : 'UNSUPPORTED',
      score: verified && e.attempt ? (e.assessment?.score ?? null) : null,
      minimumScore: 70,
    },
    eligibility: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    blockers: visibleBlockers,
    completion: {
      status,
      completedAt:
        progress.summary?.schemaVersion === 2
          ? (progress.summary.completedAt?.toISOString() ?? null)
          : null,
    },
    visualization: s.visualization,
  });
}

export interface CompletionStore {
  ready(ms: number): Promise<void>;
  session(): Promise<ClientSession>;
  scope(
    owner: string,
    concept: string,
    read: Read,
    fence: boolean,
  ): Promise<CompletionScope>;
  sources(
    scope: CompletionScope,
    read: Read,
    fence: boolean,
    claim?: CompletionClaim,
  ): Promise<CompletionSources>;
  progress(
    owner: string,
    concept: string,
    read: Read,
  ): Promise<ProgressBaseline>;
  summary(
    owner: string,
    concept: string,
    read: Read,
  ): Promise<ProgressRecord | null>;
  request(
    owner: string,
    key: string,
    read: Read,
  ): Promise<CompletionRequest | null>;
  requestById(
    owner: string,
    id: Types.ObjectId,
    read: Read,
  ): Promise<CompletionRequest | null>;
  save(
    before: ProgressRecord | null,
    after: ProgressV2Record,
    receipt: CompletionRequest,
    read: Read,
  ): Promise<void>;
  challenge(
    owner: string,
    concept: string,
    id: string,
    read: Read,
  ): Promise<{ section: Exclude<Section, 'PRACTICE'>; definitionId?: string }>;
}
export const mongoCompletionStore: CompletionStore = {
  async ready(ms) {
    const started = performance.now();
    const remaining = () => {
      const n = Math.floor(ms - (performance.now() - started));
      if (n <= 0) throw completionUnavailable();
      return n;
    };
    await mongoQualification.ready(remaining());
    await progressRepository.ready(remaining());
    verifyEvidenceIndex(
      await db()
        .collection(completionRequestIndex.collection)
        .indexes({ timeoutMS: remaining() }),
      completionRequestIndex,
    );
    for (const index of completionIndexes)
      verifyCompletionIndex(
        await db()
          .collection(index.collection)
          .indexes({ timeoutMS: remaining() }),
        index,
      );
  },
  session: () => mongoose.connection.startSession({ causalConsistency: true }),
  async scope(owner, concept, read, fence) {
    await mongoQualification.actor(owner, 'STUDENT', read);
    const conceptRevision = await mongoQualification.conceptRevision(
      concept,
      read,
    );
    const rules = await mongoQualification.policy(concept, read);
    const p =
      rules?.versions.find((v) => v.version === rules.activeVersion) ??
      rules?.versions.at(-1) ??
      null;
    const locators = p
      ? [{ _id: new Types.ObjectId(p.questionId) }]
      : await db()
          .collection('practiceQuestions')
          .find(
            { conceptId: new Types.ObjectId(concept), status: 'PUBLISHED' },
            { ...gradingOptions(read), projection: { _id: 1 } },
          )
          .limit(2)
          .toArray();
    if (locators.length !== 1)
      throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
    const origin = qualificationAuthority(
      owner,
      locators[0]!._id.toHexString(),
    );
    if (!origin)
      throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
    origin.assert();
    let state: CompletionScope['state'] = !p
      ? 'MISSING'
      : p.state === 'REVOKED'
        ? 'REVOKED'
        : p.state !== 'APPROVED' || rules?.activeVersion !== p.version
          ? 'MISSING'
          : p.conceptRevision !== conceptRevision
            ? 'STALE'
            : 'CURRENT';
    let checkpoint: CheckpointDefinition | null = null,
      visualization: CompletionView['visualization'] = null;
    if (p) {
      checkpoint = await mongoCheckpoint.definition(
        { _id: new Types.ObjectId(p.checkpointDefinitionId) },
        read,
      );
      if (!checkpoint) throw completionUnavailable();
      if (checkpoint.conceptId.toHexString() !== concept)
        throw completionUnavailable();
      const current = await mongoCheckpoint.source(
        checkpoint.conceptId,
        checkpoint.visualizationId,
        read,
      );
      const row = await db().collection('visualizations').findOne(
        {
          _id: checkpoint.visualizationId,
          conceptId: checkpoint.conceptId,
          status: 'PUBLISHED',
        },
        gradingOptions(read),
      );
      if (!row) throw completionUnavailable();
      const graph = completionGraph.parse(
        Object.fromEntries(
          [
            'type',
            'title',
            'textAlternative',
            'nodes',
            'edges',
            'steps',
            'animationConfig',
            'schemaVersion',
          ]
            .filter((k) => row[k] !== undefined)
            .map((k) => [k, row[k]]),
        ),
      );
      visualization = { id: checkpoint.visualizationId.toHexString(), graph };
      if (checkpoint.state === 'REVOKED') state = 'REVOKED';
      else if (
        state === 'CURRENT' &&
        (current.conceptRevision !== p.conceptRevision ||
          current.visualizationRevision !== p.visualizationRevision ||
          checkpoint.definitionFingerprint !== p.checkpointFingerprint)
      )
        state = 'STALE';
      const rubric = await mongoRubrics.authority(
        new Types.ObjectId(p.rubricId),
        p.rubricVersion,
        read,
      );
      if (rubric?.state === 'REVOKED') state = 'REVOKED';
      const question = await mongoQualification.qualified(
        p.questionId,
        concept,
        read,
      );
      if (!question)
        throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
      if (
        state === 'CURRENT' &&
        (question.questionRevision !== p.questionRevision ||
          question.contentFingerprint !== p.contentFingerprint)
      )
        state = 'STALE';
      if (state === 'CURRENT') {
        const approved = await origin.current(read, fence);
        if (!same(approved, p)) throw completionUnavailable();
        if (fence) {
          if (!rubric) throw completionUnavailable();
          await mongoRubrics.fence(rubric, read);
          await mongoCheckpoint.fenceDefinition(
            checkpoint,
            checkpointDefinitionRecord.parse({
              ...checkpoint,
              decisionFence: increment(checkpoint.decisionFence),
            }),
            read,
          );
        }
      }
    }
    origin.assert();
    return {
      owner,
      conceptId: concept,
      conceptRevision,
      policy: p,
      state,
      origin,
      checkpoint,
      visualization,
    };
  },
  async sources(s, read, fence, claim) {
    const p = s.policy;
    const out: CompletionSources = {
      actions: [],
      attempt: null,
      assessment: null,
      practiceStatus: 'MISSING',
    };
    if (!p || s.state !== 'CURRENT') return out;
    const fences: {
      section: Exclude<Section, 'PRACTICE'>;
      challenge: Record<string, unknown>;
    }[] = [];
    for (const section of p.requiredSections.filter(
      (v): v is Exclude<Section, 'PRACTICE'> => v !== 'PRACTICE',
    )) {
      const candidates: {
        id: string;
        at: number;
        challenge: Record<string, unknown>;
      }[] = [];
      let unavailable: Action['status'] = 'MISSING';
      for (const pair of await mongoQualification.actions(
        s.owner,
        s.conceptId,
        section,
        read,
      )) {
        const visual = section === 'VISUALIZE';
        const c = visual
          ? visualChallengeRecord.parse(pair.challenge)
          : acknowledgementChallengeRecord.parse(pair.challenge);
        const r = visual
          ? visualReceiptRecord.parse(pair.receipt)
          : acknowledgementReceiptRecord.parse(pair.receipt);
        if (
          !c.userId.equals(new Types.ObjectId(s.owner)) ||
          !r.userId.equals(c.userId) ||
          !c.conceptId.equals(new Types.ObjectId(s.conceptId)) ||
          !r.conceptId.equals(c.conceptId) ||
          !r.challengeId.equals(c._id) ||
          !c.receiptId?.equals(r._id) ||
          c.section !== section ||
          r.section !== section
        )
          throw completionUnavailable();
        const wanted = claim?.sectionReceipts
          .find((a) => a.section === section)
          ?.receiptId.toHexString();
        if (claim && r._id.toHexString() !== wanted) continue;
        if (c.state === 'REVOKED') {
          unavailable = 'REVOKED';
          continue;
        }
        if (
          c.state !== 'CONSUMED' ||
          c.issuedAt < p.approvedAt! ||
          c.conceptRevision !== p.conceptRevision ||
          r.conceptRevision !== p.conceptRevision
        ) {
          unavailable = 'STALE';
          continue;
        }
        let at: Date;
        if (visual) {
          const vc = visualChallengeRecord.parse(c),
            vr = visualReceiptRecord.parse(r),
            d = s.checkpoint!;
          if (!vr.definitionId.equals(vc.definitionId))
            throw completionUnavailable();
          if (vr.outcome !== 'CORRECT') continue;
          if (
            vc.definitionId.toHexString() !== p.checkpointDefinitionId ||
            vc.definitionFingerprint !== p.checkpointFingerprint ||
            vr.definitionFingerprint !== p.checkpointFingerprint ||
            vc.visualizationRevision !== p.visualizationRevision ||
            vr.visualizationRevision !== p.visualizationRevision
          ) {
            unavailable = 'STALE';
            continue;
          }
          if (
            !same(checkpointBinding(vc), checkpointBinding(d)) ||
            !same(checkpointBinding(vr), checkpointBinding(d)) ||
            vc.requestFingerprint !== checkpointIssueFingerprint(vc) ||
            vr.requestFingerprint !==
              checkpointResponseFingerprint(vc, d.expectedChoiceId)
          )
            throw completionUnavailable();
          at = vr.respondedAt;
        } else {
          const ac = acknowledgementChallengeRecord.parse(c),
            ar = acknowledgementReceiptRecord.parse(r);
          if (
            ac.section !== section ||
            ac.sectionRevision !==
              (await mongoQualification.sectionRevision(
                s.conceptId,
                section as 'READ' | 'EXAMPLE' | 'REVISE',
                read,
              ))
          ) {
            unavailable = 'STALE';
            continue;
          }
          if (
            ar.sectionRevision !== ac.sectionRevision ||
            ar.policyId !== ac.policyId ||
            ac.requestFingerprint !== issueFingerprint(ac) ||
            ar.requestFingerprint !== ackFingerprint(ac)
          )
            throw completionUnavailable();
          at = ar.acknowledgedAt;
        }
        if (
          at.getTime() !== c.consumedAt?.getTime() ||
          at < c.issuedAt ||
          at >= c.expiresAt ||
          at > new Date()
        )
          throw completionUnavailable();
        candidates.push({
          id: r._id.toHexString(),
          at: at.getTime(),
          challenge: c,
        });
      }
      candidates.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
      const selected = candidates[0];
      if (selected && fence)
        fences.push({ section, challenge: selected.challenge });
      out.actions.push({
        section,
        status: selected ? 'QUALIFIED' : unavailable,
        ...(selected ? { receiptId: selected.id } : {}),
      });
    }
    fences.sort((a, b) =>
      String(a.challenge._id).localeCompare(String(b.challenge._id)),
    );
    for (const { section, challenge } of fences) {
      if (section === 'VISUALIZE') {
        const c = visualChallengeRecord.parse(challenge);
        await mongoCheckpoint.fenceVisual(
          c,
          visualChallengeRecord.parse({
            ...c,
            decisionFence: increment(c.decisionFence),
          }),
          read,
        );
      } else {
        const c = acknowledgementChallengeRecord.parse(challenge);
        await (
          section === 'READ'
            ? mongoEvidence
            : additionalAcknowledgementStore(section)
        ).fence(
          c,
          acknowledgementChallengeRecord.parse({
            ...c,
            decisionFence: increment(c.decisionFence),
          }),
          read,
        );
      }
    }
    const attempts = await db()
      .collection('practiceAttempts')
      .find(
        {
          userId: new Types.ObjectId(s.owner),
          conceptId: new Types.ObjectId(s.conceptId),
          questionId: new Types.ObjectId(p.questionId),
          attemptNumber: 1,
        },
        gradingOptions(read),
      )
      .limit(2)
      .toArray();
    if (attempts.length > 1) throw completionUnavailable();
    if (!attempts.length) return out;
    const a = attemptRecord.parse(attempts[0]);
    const assessments = await db()
      .collection('practiceAssessments')
      .find(
        {
          userId: a.userId,
          attemptId: a._id,
          conceptId: a.conceptId,
          purpose: 'COMPLETION_INPUT',
          schemaVersion: 2,
          graderId: 'OUTPUT_EXACT_TEXT_COMPLETION',
          graderVersion: 1,
        },
        gradingOptions(read),
      )
      .limit(2)
      .toArray();
    if (assessments.length > 1) throw completionUnavailable();
    if (!assessments.length) {
      out.practiceStatus = 'UNQUALIFIED';
      return out;
    }
    const r = completionAssessmentRecord.parse(assessments[0]);
    if (
      a.requestFingerprint !==
        sha256(
          JSON.stringify([
            'F036-request-v1',
            s.owner,
            p.questionId,
            s.conceptId,
            a.questionRevision,
            a.studentAnswer,
          ]),
        ) ||
      a.submittedAt < p.approvedAt! ||
      r.evaluatedAt < a.submittedAt
    )
      throw completionUnavailable();
    if (
      a.questionRevision !== p.questionRevision ||
      a.contentFingerprint !== p.contentFingerprint ||
      r.policyId.toHexString() !== p.policyId ||
      r.policyVersion !== p.version ||
      r.policyFingerprint !== p.fingerprint ||
      r.sourceEpoch !== p.sourceEpoch ||
      (claim &&
        (!r._id.equals(claim.assessmentId) || !a._id.equals(claim.attemptId)))
    ) {
      out.practiceStatus = 'STALE';
      return out;
    }
    await completionGrading.proof(a, read, r);
    s.origin.assert();
    out.attempt = a;
    out.assessment = r;
    out.practiceStatus =
      r.score >= p.minimumScore ? 'QUALIFIED' : 'BELOW_THRESHOLD';
    return out;
  },
  async progress(owner, concept, read) {
    const userId = new Types.ObjectId(owner),
      conceptId = new Types.ObjectId(concept);
    if (!read.majority)
      return progressRepository.prepare(userId, conceptId, read.session!);
    // Outside withTransaction there is no inherited CSOT deadline. Every proof
    // command must explicitly use the current remaining timeout/majority concern.
    const rows = await db()
      .collection('concepts')
      .aggregate(
        [
          ...publishedConceptStages(concept),
          {
            $project: {
              _id: 0,
              conceptId: '$_id',
              technologyId: 1,
              learningPathId: 1,
              moduleId: 1,
              topicId: 1,
            },
          },
        ],
        gradingOptions(read),
      )
      .toArray();
    if (rows.length !== 1)
      throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
    const raw = rows[0]!;
    if (
      Object.keys(raw).length !== 5 ||
      ![
        'conceptId',
        'technologyId',
        'learningPathId',
        'moduleId',
        'topicId',
      ].every((k) => raw[k] instanceof Types.ObjectId) ||
      !raw.conceptId.equals(conceptId)
    )
      throw completionUnavailable();
    const hierarchy = raw as unknown as ProgressHierarchy;
    const [row] = await db()
      .collection('practiceAttempts')
      .aggregate(attemptStatsStages(userId, conceptId), gradingOptions(read))
      .toArray();
    if (row && row.invalid !== 0) throw completionUnavailable();
    const stats = activityStats.parse(
      row
        ? {
            attemptCount: row.attemptCount,
            startedAt: row.startedAt,
            lastActivityAt: row.lastActivityAt,
          }
        : { attemptCount: 0, startedAt: null, lastActivityAt: null },
    );
    const summary = await this.summary(owner, concept, read);
    if (
      summary &&
      (!summary.userId.equals(userId) ||
        Object.entries(hierarchy).some(
          ([k, v]) => !v.equals(summary[k as keyof ProgressHierarchy]),
        ) ||
        summary.attemptCount !== stats.attemptCount ||
        summary.startedAt.getTime() !== stats.startedAt?.getTime() ||
        summary.lastActivityAt.getTime() !== stats.lastActivityAt?.getTime())
    )
      throw completionUnavailable();
    return { userId, hierarchy, stats, summary, session: read.session! };
  },
  async summary(owner, concept, read) {
    const rows = await db()
      .collection('studentProgress')
      .find(
        {
          userId: new Types.ObjectId(owner),
          conceptId: new Types.ObjectId(concept),
        },
        gradingOptions(read),
      )
      .limit(2)
      .toArray();
    if (rows.length > 1) throw completionUnavailable();
    return rows[0] ? progressRecord.parse(rows[0]) : null;
  },
  async request(owner, key, read) {
    const r = await db()
      .collection('completionRequests')
      .findOne(
        { userId: new Types.ObjectId(owner), requestKeyHash: key },
        gradingOptions(read),
      );
    return r ? completionRequestRecord.parse(r) : null;
  },
  async requestById(owner, id, read) {
    const r = await db()
      .collection('completionRequests')
      .findOne(
        { userId: new Types.ObjectId(owner), _id: id },
        gradingOptions(read),
      );
    return r ? completionRequestRecord.parse(r) : null;
  },
  async save(before, after, receipt, read) {
    const session = gradingWriteSession(read);
    progressV2Record.parse(after);
    if (!same(before, after)) {
      if (before) {
        const result = await db()
          .collection('studentProgress')
          .replaceOne({ ...before }, after, { session });
        if (result.matchedCount !== 1) throw new GradingWriteConflict();
      } else
        await db().collection('studentProgress').insertOne(after, { session });
    }
    await new CompletionRequestReceipt(receipt).save({ session });
  },
  async challenge(owner, concept, id, read) {
    const row = await db()
      .collection('sectionEvidenceChallenges')
      .findOne(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(owner),
          conceptId: new Types.ObjectId(concept),
        },
        gradingOptions(read),
      );
    if (!row)
      throw new AppError(
        404,
        'SECTION_CHALLENGE_NOT_FOUND',
        'Challenge not found',
      );
    if (row.section === 'VISUALIZE') {
      const c = visualChallengeRecord.parse(row);
      return {
        section: 'VISUALIZE',
        definitionId: c.definitionId.toHexString(),
      };
    }
    const c = acknowledgementChallengeRecord.parse(row);
    return { section: c.section };
  },
};

function uncertain(e: unknown, depth = 0): boolean {
  if (!e || typeof e !== 'object' || depth > 3) return false;
  return (
    ('errorLabels' in e &&
      Array.isArray(e.errorLabels) &&
      e.errorLabels.includes('UnknownTransactionCommitResult')) ||
    ('cause' in e && uncertain(e.cause, depth + 1))
  );
}
function retryable(e: unknown) {
  return (
    e instanceof GradingWriteConflict ||
    e instanceof EvidenceWriteConflict ||
    e instanceof ProgressWriteConflict ||
    (!!e &&
      typeof e === 'object' &&
      'code' in e &&
      e.code === 11000 &&
      'keyPattern' in e &&
      [progressIndex, completionRequestIndex].some((i) =>
        same(i.key, e.keyPattern),
      ))
  );
}
function coordinationError(e: unknown) {
  if (e instanceof AppError) {
    if (e.code === 'PRACTICE_IDEMPOTENCY_CONFLICT')
      return completionConflict('COMPLETION_IDEMPOTENCY_CONFLICT');
    if (e.code === 'PRACTICE_COMMIT_UNCONFIRMED')
      return completionUnconfirmed();
    return e;
  }
  return completionUnavailable();
}
export function createCompletionRepository(
  store: CompletionStore = mongoCompletionStore,
  clock = () => performance.now(),
  coordination: PracticeAttemptCoordination | null = store ===
  mongoCompletionStore
    ? practiceAttemptCoordination
    : null,
) {
  async function snapshot(
    owner: string,
    concept: string,
    read: Read,
    fence = false,
  ): Promise<CompletionSnapshot> {
    const scope = await store.scope(owner, concept, read, fence);
    const sources = await store.sources(scope, read, fence);
    const progress = await store.progress(owner, concept, read);
    const claim = claimOf(progress.summary);
    if (claim) {
      const original = await store.requestById(
        owner,
        claim.requestReceiptId,
        read,
      );
      if (
        !original ||
        !original.userId.equals(new Types.ObjectId(owner)) ||
        original.conceptId.toHexString() !== concept ||
        !original.summaryId.equals(progress.summary!._id) ||
        original.decisionVersion !== claim.decisionVersion ||
        !original.policyId.equals(claim.policyId) ||
        original.policyVersion !== claim.policyVersion ||
        original.conceptRevision !== claim.conceptRevision ||
        original.requestFingerprint !==
          sha256(
            JSON.stringify([
              'F038-complete-request-v1',
              owner,
              concept,
              original.viewRevision,
            ]),
          ) ||
        (progress.summary?.schemaVersion === 2 &&
          original.committedAt.getTime() !==
            progress.summary.completedAt?.getTime())
      )
        throw completionUnavailable();
    }
    const claimSources = claim
      ? await store.sources(scope, read, false, claim)
      : undefined;
    scope.origin.assert();
    return {
      scope,
      sources,
      progress,
      ...(claimSources ? { claimSources } : {}),
    };
  }
  async function transaction<T>(
    work: (read: Read, remaining: () => number) => Promise<T>,
    prove: (value: T, read: Read) => Promise<void>,
    started = clock(),
  ): Promise<T> {
    const remaining = () => {
      const n = Math.floor(10000 - (clock() - started));
      if (n <= 0) throw completionUnavailable();
      return n;
    };
    let session: ClientSession | undefined,
      value: T | undefined,
      bodies = 0,
      committed = false,
      failure: unknown;
    try {
      await store.ready(remaining());
      session = await store.session();
      while (!committed && bodies < 3) {
        const available = remaining() - 2000;
        if (available <= 0) throw completionUnavailable();
        try {
          await session.withTransaction(
            async () => {
              if (++bodies > 3 || remaining() <= 2000)
                throw completionUnavailable();
              value = undefined;
              value = await work({ session: session! }, remaining);
            },
            {
              timeoutMS: available,
              maxCommitTimeMS: Math.min(2000, available),
              readPreference: 'primary',
              readConcern: { level: 'snapshot' },
              writeConcern: { w: 'majority', j: true },
            },
          );
          committed = true;
        } catch (e) {
          if (uncertain(e)) throw completionUnconfirmed();
          if (retryable(e) && bodies < 3) continue;
          throw e;
        }
      }
      if (!committed || value === undefined) throw completionUnconfirmed();
      const read: Read = {
        session,
        majority: true,
        get timeoutMS() {
          return remaining();
        },
      };
      await prove(value, read);
      remaining();
    } catch (e) {
      failure =
        e instanceof AppError
          ? e
          : committed
            ? completionUnconfirmed()
            : completionUnavailable();
    } finally {
      if (session)
        try {
          await session.endSession();
        } catch {
          failure ??= completionUnconfirmed();
        }
    }
    if (failure) throw failure;
    remaining();
    if (value === undefined) throw completionUnconfirmed();
    return value;
  }
  return {
    store,
    async read(owner: string, concept: string) {
      return transaction(
        async (read) =>
          buildCompletionView(await snapshot(owner, concept, read)),
        async (view, read) => {
          // Read-only fresh majority verification; no policy/challenge fence writes.
          const current = await snapshot(owner, concept, read);
          if (!same(buildCompletionView(current), view))
            throw completionConflict('COMPLETION_VIEW_CHANGED');
        },
      );
    },
    async scope(owner: string, concept: string) {
      return transaction(
        (read) => store.scope(owner, concept, read, false),
        async (s, read) => {
          s.origin.assert();
          const current = await store.scope(owner, concept, read, false);
          if (
            s.state !== 'CURRENT' ||
            current.state !== 'CURRENT' ||
            !same(s.policy, current.policy)
          )
            throw completionConflict('COMPLETION_INELIGIBLE');
        },
      );
    },
    async challenge(owner: string, concept: string, id: string) {
      return transaction(
        (read) => store.challenge(owner, concept, id, read),
        async (v, read) => {
          if (!same(v, await store.challenge(owner, concept, id, read)))
            throw completionUnavailable();
        },
      );
    },
    async complete(
      owner: string,
      concept: string,
      viewRevision: string,
      key: string,
    ) {
      const started = clock(),
        remaining = () => {
          const n = Math.floor(10000 - (clock() - started));
          if (n <= 0) throw completionUnavailable();
          return n;
        };
      const keyHash = sha256('F038-completion-key-v1:' + key),
        fingerprint = sha256(
          JSON.stringify([
            'F038-complete-request-v1',
            owner,
            concept,
            viewRevision,
          ]),
        );
      let permit: Awaited<ReturnType<PracticeAttemptCoordination['enter']>> =
          null,
        success = false;
      let provenView: CompletionView | undefined;
      let resultView: CompletionView | undefined, failure: AppError | undefined;
      try {
        permit =
          (await coordination?.enter(owner, keyHash, fingerprint, remaining)) ??
          null;
        const result = await transaction(
          async (read) => {
            permit?.assert();
            const existing = await store.request(owner, keyHash, read);
            if (
              existing &&
              (existing.requestFingerprint !== fingerprint ||
                existing.conceptId.toHexString() !== concept ||
                !existing.userId.equals(new Types.ObjectId(owner)) ||
                existing.requestKeyHash !== keyHash ||
                existing.viewRevision !== viewRevision)
            )
              throw completionConflict('COMPLETION_IDEMPOTENCY_CONFLICT');
            if (!existing && permit?.replayOnly) throw completionUnconfirmed();
            const state = await snapshot(owner, concept, read, true),
              view = buildCompletionView(state),
              p = state.scope.policy;
            if (view.viewRevision !== viewRevision)
              throw completionConflict('COMPLETION_VIEW_CHANGED');
            if (existing && view.completion.status !== 'COMPLETED')
              throw completionConflict('COMPLETION_RECEIPT_UNAVAILABLE');
            if (
              view.eligibility !== 'ELIGIBLE' ||
              !p ||
              !state.sources.attempt ||
              !state.sources.assessment
            )
              throw completionConflict('COMPLETION_INELIGIBLE');
            const old = state.progress.summary,
              claim = claimOf(old);
            if (existing) {
              if (
                !old ||
                !claim ||
                view.completion.status !== 'COMPLETED' ||
                !existing.summaryId.equals(old._id) ||
                existing.decisionVersion !== claim.decisionVersion ||
                !existing.policyId.equals(claim.policyId) ||
                existing.policyVersion !== claim.policyVersion ||
                existing.conceptRevision !== claim.conceptRevision
              )
                throw completionConflict('COMPLETION_RECEIPT_UNAVAILABLE');
              return {
                receipt: existing,
                summary: progressV2Record.parse(old),
                scope: state.scope,
              };
            }
            const id = new Types.ObjectId(),
              now = new Date(
                Math.max(Date.now(), old?.updatedAt.getTime() ?? 0),
              );
            let summary: ProgressV2Record;
            if (
              view.completion.status === 'COMPLETED' &&
              old?.schemaVersion === 2
            )
              summary = old;
            else {
              const grade = state.sources.assessment;
              const completion: CompletionClaim = {
                policyId: new Types.ObjectId(p.policyId),
                policyVersion: p.version,
                policyFingerprint: p.fingerprint,
                conceptRevision: p.conceptRevision,
                sourceEpoch: p.sourceEpoch,
                decisionVersion: increment(claim?.decisionVersion ?? 0),
                requiredSections: p.requiredSections,
                sectionReceipts: state.sources.actions.map((a) => ({
                  section: a.section,
                  receiptId: new Types.ObjectId(a.receiptId!),
                })),
                assessmentId: grade._id,
                attemptId: state.sources.attempt._id,
                minimumScore: 70,
                selectedScore: 100,
                requestReceiptId: id,
              };
              summary = progressV2Record.parse({
                ...(old ?? {
                  ...state.progress.hierarchy,
                  _id: new Types.ObjectId(),
                  userId: new Types.ObjectId(owner),
                  ...state.progress.stats,
                  createdAt: now,
                }),
                ...emptyCompletionFields(),
                schemaVersion: 2,
                status: 'COMPLETED',
                updatedAt: now,
                completedAt: now,
                completion,
                firstScore:
                  old?.schemaVersion === 2 ? old.firstScore : grade.score,
                latestScore:
                  old?.schemaVersion === 2 ? old.latestScore : grade.score,
                bestScore: 100,
                sections: {
                  readCompleted: true,
                  visualizeCompleted: true,
                  exampleCompleted: true,
                  practiceCompleted: true,
                  reviseCompleted: p.requiredSections.includes('REVISE'),
                },
              });
            }
            const receipt = completionRequestRecord.parse({
              _id: id,
              userId: new Types.ObjectId(owner),
              conceptId: new Types.ObjectId(concept),
              policyId: new Types.ObjectId(p.policyId),
              policyVersion: p.version,
              conceptRevision: p.conceptRevision,
              viewRevision,
              requestKeyHash: keyHash,
              requestFingerprint: fingerprint,
              summaryId: summary._id,
              decisionVersion: summary.completion!.decisionVersion,
              committedAt: now,
              schemaVersion: 1,
            });
            await store.save(old, summary, receipt, read);
            return { receipt, summary, scope: state.scope };
          },
          async (value, read) => {
            permit?.assert();
            value.scope.origin.assert();
            const receipt = await store.request(owner, keyHash, read),
              summary = await store.summary(owner, concept, read);
            if (
              !same(receipt, value.receipt) ||
              !summary ||
              summary.schemaVersion !== 2 ||
              !summary._id.equals(value.summary._id) ||
              !same(summary.completion, value.summary.completion) ||
              summary.completedAt?.getTime() !==
                value.summary.completedAt?.getTime()
            )
              throw completionUnconfirmed();
            const original = await store.requestById(
              owner,
              summary.completion!.requestReceiptId,
              read,
            );
            if (
              !original ||
              !original.userId.equals(new Types.ObjectId(owner)) ||
              !original.summaryId.equals(summary._id) ||
              original.decisionVersion !==
                summary.completion!.decisionVersion ||
              original.conceptId.toHexString() !== concept ||
              !original.policyId.equals(summary.completion!.policyId) ||
              original.policyVersion !== summary.completion!.policyVersion ||
              original.conceptRevision !== summary.completion!.conceptRevision
            )
              throw completionUnconfirmed();
            const current = await snapshot(owner, concept, read);
            const view = buildCompletionView(current);
            if (
              view.completion.status !== 'COMPLETED' ||
              view.viewRevision !== viewRevision ||
              !same(claimOf(current.progress.summary), summary.completion)
            )
              throw completionUnconfirmed();
            provenView = view;
            value.scope.origin.assert();
            permit?.assert();
          },
          started,
        );
        // Built in this request's majority proof, without resetting its deadline.
        if (!provenView) throw completionUnconfirmed();
        remaining();
        result.scope.origin.assert();
        permit?.assert();
        success = true;
        resultView = provenView;
      } catch (e) {
        failure = coordinationError(e);
      } finally {
        if (permit) {
          try {
            try {
              permit.assert();
            } finally {
              permit.finish(success && !failure);
            }
          } catch (e) {
            failure ??= coordinationError(e);
          }
        }
      }
      if (failure) throw failure;
      if (!resultView) throw completionUnconfirmed();
      return resultView;
    },
  };
}
export type CompletionRepository = ReturnType<
  typeof createCompletionRepository
>;
export const completionRepository = createCompletionRepository();

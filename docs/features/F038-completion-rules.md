# F038 - Completion Rules

**Status:** IN_PROGRESS
**Plan date:** 2026-10-19 (Asia/Calcutta)
**Current gate:** OWNER-APPROVED STAGE C1 IMPLEMENTATION/OFFLINE VERIFICATION (Section 18)
**Formal roadmap dependency:** F037 APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY.
**Authorized boundary:** Stage A: six Section 4 paths; B1: four Section 9.7 paths; B2: fourteen Section 13.1 paths; C1: four Section 17.8 paths. Partial foundations only.

Historical Stage A authorization: the owner explicitly approved implementation and offline verification,
including mandatory VISUALIZE/PRACTICE and the exact six-file boundary. Source
reconciliation PASS; no additional minimum section is mandated by the inspected
sources. The owner decision supersedes the planning-only gate restrictions below.
Preserve F001-F037 APPROVED_COMPLETE and F039 NOT_STARTED. The historical Stage A
exclusions below describe that gate; later B1/B2 approvals are recorded in Sections
10 and 13. No completion evidence producer, completion persistence/API/UI,
database/browser/synthetic execution, Git write or full F038 acceptance is
authorized by the current offline gate. Keep F038 IN_PROGRESS.

## 1. Sources and existing contracts

Consulted AGENTS.md, DEVELOPMENT_ROADMAP.md Phase I/current pointer, PRD sections
14-15, 21-26 and MVP workflow, SYSTEM_ARCHITECTURE.md modular-monolith/progress
boundaries, API_DESIGN.md current Concept/Practice/progress contracts and
DATABASE_DESIGN.md Concept rules, studentProgress, attempt algorithm, completion
rules and later approved refinements. Consulted completed F021 and F030-F037
documents and the corresponding Concept, Learning Path, attempt and progress
models. These references describe approved contracts, not new execution evidence.

F037 was delivered at 707d2d014233e53db8b688a29dcdd89d33501080. The preceding
read-only assessment observed that local HEAD and a clean worktree. The roadmap
names F038 Completion Rules, depends on F037 and specifies default passing score
70%; it does not specify a grading engine, evidence producer or completion API.

| Source | Requirement and reconciliation |
| --- | --- |
| PRD section 14 | Topic completion requires required learning sections, required visualization, required practice and configured minimum score, default 70%. Admin topic/path overrides are described. The owner now explicitly selects Concept-level policy; this does not implement Topic aggregation. |
| Database Design section 12 | Concept completion combines configured sections and minimum practice score. Mastery thresholds are separate. The owner confirms independence from F039. |
| Database Design Concept example | requiredSections READ, VISUALIZE, EXAMPLE, PRACTICE and minimumScore 70 match the owner's initial defaults. This example is not evidence that all future configurations may omit mandatory PRD conditions. |
| Database Design studentProgress example | reviseCompleted false coexists with COMPLETED. Revise therefore is not universally required; the owner permits it as a configurable requirement. The example does not authorize manufacturing section evidence. |
| F021 approved refinement | Entire completionRules storage/API field was deferred. There is no implemented Concept policy record or Concept-completion revision contract to reuse automatically. This foundation must not add those model/API fields. |
| Learning Path model/F017 contract | completionScore is an integer 0-100, default 70, and future threshold metadata only. It does not grade attempts. Priority among Concept, Topic and path configurations is not resolved here. |
| F030-F034 | Four canonical types and private solutions exist. No approved grading/rubric/execution capability supplies passing evidence. Existing GET question DTOs remain answer-free. |
| F035-F036 | F036 supersedes transient unlock with durable immutable SUBMITTED/score:null attempts before answer disclosure. Those rows cannot prove a passing result and must not be rewritten to invent a grade. |
| F037 | Saved activity counts and first/latest timestamps are not completion. Its strict stored summary, exact five-field GET, readiness, transactional update and browser exception remain unchanged. Historical summaries cannot be promoted, backfilled or migrated by the evaluator. |

No authoritative source inspected specifies first/latest/best score selection for
completion, a reliable section-evidence mechanism, manual versus automatic
completion initiation, or revision invalidation/revocation. Recording first,
latest and best scores is not itself a selection policy. The design reference's
Mark Completed/XP controls are not an authorization or evidence contract. There
is no UI work in this stage, so no new design direction is proposed.

## 2. Scope and explicit non-goals

Stage A is a pure, synchronous, deterministic internal policy evaluator and its
focused tests, plus documentation of that boundary. It answers whether supplied,
validated evidence metadata satisfies a supplied policy snapshot. It does not
prove that learning occurred, authenticate a caller, produce verification, select
a grading strategy or establish a durable completion entitlement.

It must not import Mongoose, database/repository/service/router objects, browser
code or F039 mastery. No I/O, database access, network, timers, environment reads,
clock/random input, logging, global mutable state or mutation of caller inputs.
Use TypeScript and the existing Zod dependency if helpful; no package addition.
Its location under progress does not authorize wiring it into F037 requests.

Exclude grading or code execution; storing rules/evidence/completions; updating
attempts or studentProgress; score/mastery calculation or XP; migrations/backfill;
HTTP endpoints or public DTO changes; Admin authoring; frontend controls; browser
storage; transactions/index provisioning; production release and F039 work.

ELIGIBLE is not COMPLETED. No result sets a status, unlocks an answer, authorizes
an account, creates an attempt or changes F037. In particular, selecting a tab,
loading content, reaching a scroll position, playing an animation, saving a draft
or merely saving an ungraded attempt must not synthesize passing evidence.

## 3. Proposed internal contract for owner implementation approval

The following exact shapes are proposals within the six-file boundary. They are
not an implemented API, database schema or permanent grading contract.

### 3.1 Input and identity

Proposed entry point: evaluateCompletionPolicy(input: unknown): EligibilityResult.
Validate unknown input at the boundary; accept only strict plain metadata records
and bounded arrays. Reject extra keys, unexpected nesting, coercion, accessors or
unsupported object instances rather than executing supplied code/property getters.
Do not accept raw F036/Mongoose records, answers or arbitrary provider payloads.

| Input part | Proposed fields and rules |
| --- | --- |
| schemaVersion | Literal 1; unsupported/missing versions cannot yield ELIGIBLE. |
| subject | studentId and conceptId: canonical lowercase 24-hex strings; conceptRevision: required bounded opaque revision token. They identify the candidate scope, not authentication proof. |
| policy | id and revision: required bounded opaque tokens; requiredSections and minimumScore optional only to request the documented defaults. Unknown policy keys are invalid. |
| sectionEvidence | Optional array, maximum four entries, for READ, VISUALIZE, EXAMPLE and REVISE. Absence means no evidence. No implicit completed values. |
| practiceEvidence | Optional single candidate graded-evaluation metadata record. Absence cannot satisfy the unconditional passing prerequisite. No array or built-in score selection. |

Propose opaque identity/revision tokens of 1-128 ASCII characters matching
[A-Za-z0-9][A-Za-z0-9._:-]{0,127}; no trimming or normalization. They carry exact
caller-supplied snapshot identity, not time ordering, cryptographic verification,
content hashing or proof of freshness. schemaVersion is the supported evaluator
contract version; policy revision is a different concept. Do not reuse F036's
questionRevision as a Concept revision or invent a current Concept hash algorithm.
Actual policy/revision generation and publication binding require future approval.

Every evidence record must bind exactly the same studentId, conceptId,
conceptRevision, policyId and policyRevision as the supplied subject/policy.
Missing, contradictory or mismatched bindings mean INELIGIBLE. Never transfer
evidence across accounts, Concepts, policies or revisions. No provenance recovery
or permissive historical fallback is performed by this module.

### 3.2 Required sections and configuration

Canonical section vocabulary, fixed output order:
READ, VISUALIZE, EXAMPLE, PRACTICE, REVISE.

If requiredSections is omitted, resolve to READ, VISUALIZE, EXAMPLE, PRACTICE.
REVISE is included only by explicit configuration. A supplied configuration must
be an array of unique canonical values, length 1-5. Reject null, empty arrays,
duplicates, unknown/case-folded section names, coercion and unsupported versions.
Do not repair invalid explicit configuration by falling back to defaults.

**C1 - RESOLVED by explicit owner implementation approval:** VISUALIZE and PRACTICE
are mandatory minimum required sections. Configurations omitting either fail
closed as UNSUPPORTED_CONFIGURATION/INELIGIBLE. Defaults remain READ, VISUALIZE,
EXAMPLE and PRACTICE; REVISE is required only when explicitly configured. This
preserves PRD section 14 and reconciles the Database Design example. No additional
mandatory minimum section is established by those sources beyond configured
requirements. No invalid configuration falls back to a weaker default.

Passing graded practice remains a separate mandatory condition even when section
configuration is supplied. A section checkbox or an omitted section cannot bypass
the passing requirement. Missing visualization content/evidence does not become
completed automatically, and cannot be waived by a page visit.

### 3.3 Section evidence and the trust boundary

Each non-Practice section record contains only:
evidenceId; section; studentId; conceptId; conceptRevision; policyId;
policyRevision; verification (VERIFIED or UNVERIFIED); outcome (COMPLETED or
INCOMPLETE). Evidence IDs use the same bounded token format. All fields are
required, with strict enum validation. Reject duplicate section records or reused
evidence IDs across sections rather than merging conflicting assertions.

Only VERIFIED + COMPLETED with exact bindings can satisfy its named required
section. INCOMPLETE/unverified/missing required evidence blocks eligibility. A
valid completed optional section does not create another requirement; contradictory,
unsupported or malformed supplied evidence fails closed even if its section is
not required. A PRACTICE entry in this array is unsupported: passing practice must
come through the graded candidate below, not an independently asserted completion
flag. Do not silently mark one learning mode complete based on another.

VERIFIED is a description of a future internal producer's completed checks, not
a self-authenticating boolean or browser credential. A pure evaluator cannot
prove authenticity or perform current Student/publication/ownership checks.
Future integration MUST obtain evidence through owner-approved server-side
verifiers, authenticate the actual subject and recheck current published ancestry
and exact references at the appropriate read/commit boundary. Never map an HTTP
body's VERIFIED field directly to trusted evidence. Stage A has no such adapter,
route or evidence-producing capability; its positive fixtures are synthetic only.

Whether Read/Example/Revise use explicit acknowledgements, and what constitutes a
verified visualization completion, are future product/security decisions. This
plan does not claim that an acknowledgement proves understanding or approve
tracking arbitrary browsing/playback telemetry.

### 3.4 Thresholds and practice passing evidence

Omitted minimumScore resolves to 70. Propose integer thresholds 0-100 inclusive,
matching the existing Learning Path model. A supplied valid threshold wins over
the default, including explicitly configured 0 or 100. Invalid/null/string/NaN/
infinite/fractional/out-of-range configuration fails closed; never substitute 70
for an invalid explicit value. No minimumScore=0 shortcut removes grading or
required sections. This numeric precision proposal needs implementation approval.

The evaluator accepts at most one candidate evaluation, supplied by a future
approved selection/verifier layer. Proposed metadata fields: evaluationId,
attemptId, questionId, questionRevision, type, studentId, conceptId,
conceptRevision, policyId, policyRevision, verification, gradingStatus and score.
Use canonical ObjectId strings for attemptId/questionId; 64 lowercase hexadecimal
characters for the existing public questionRevision; one of the four canonical
Practice types; the same scope/revision bindings; and bounded evaluationId token.
No studentAnswer, official answer, explanation, solution fingerprint or rubric.

Passing requires verification=VERIFIED, gradingStatus=GRADED, valid exact bindings,
and a finite numeric score in [0,100] satisfying score >= resolved minimumScore.
Propose allowing finite fractional evaluation scores without rounding, rescaling
or string coercion; do not manufacture an evaluation by comparing answer text.
The threshold remains integer under the proposed existing-model-compatible rule.
Other statuses, missing/null/invalid score, inconsistent metadata or absent
evaluation are INELIGIBLE. Ungraded F036 attempts never qualify, regardless of
count, receipt, type, submitted text or answer already being unlocked.

This evaluates the supplied candidate; it deliberately does not choose first,
latest, best, any-of-many, per-question aggregation or question coverage. A future
caller may not turn this into real Concept completion until the owner approves
selection/coverage and evidence-authenticity rules. Selecting one candidate in a
test does not approve a production score-selection policy. Existing F036 records
must remain immutable; any future grading assessment lifecycle needs separate
architecture, storage and privacy approval. Do not overwrite null scores in place.

### 3.5 Result, deterministic blockers and validation failures

Propose an exact result with two fields:

- eligibility: ELIGIBLE or INELIGIBLE.
- blockers: array of strict entries containing a fixed code and, where relevant,
  a canonical section only. No free-form error message or copied input value.

Proposed fixed codes: INVALID_INPUT, UNSUPPORTED_VERSION, INVALID_CONFIGURATION,
UNSUPPORTED_CONFIGURATION, EVIDENCE_MISSING, EVIDENCE_UNVERIFIED,
EVIDENCE_INCOMPLETE, EVIDENCE_CONFLICT, EVIDENCE_SCOPE_MISMATCH,
EVIDENCE_REVISION_MISMATCH, PRACTICE_UNGRADED, PRACTICE_SCORE_BELOW_THRESHOLD.
An invalid practice metadata shape/score is INVALID_INPUT, not a failing grade.
Use EVIDENCE_MISSING/PRACTICE for absent evaluation and PRACTICE_UNGRADED when an
explicit ungraded status is recognizable without accepting it as valid proof.

Malformed envelope/configuration/version returns a structural blocker without
evaluating evidence or throwing raw validator/driver errors. Validate supplied
evidence for contradictions before computing eligibility. Deduplicate blocker
code/section pairs; sort by fixed code priority (the order above), then canonical
section order. Valid evidence-array order must not affect the result. ELIGIBLE
requires no blockers; any blocker requires INELIGIBLE. A valid below-threshold
candidate is ineligible, not an internal error and not a mastery classification.

Result construction must not return answers, evidence/attempt IDs, scores, account
IDs, arbitrary metadata or raw error contents. Do not log inputs/results. The
result is neither a public API DTO nor a reusable authorization token. Callers
retain their input identity separately; stale results must never bypass future
fresh validation. Fresh output objects must not mutate/freeze caller-owned values.

Same validated input produces the same logical result without a database, clock,
network, environment or module initialization side effect. No persistence means
no transaction, idempotency key, index or concurrent-write scheme is needed for
Stage A. Repeated calls cannot increment counts or establish completion state.

## 4. Exact proposed six-file foundation inventory

The owner approved implementation/offline verification of exactly these six paths.
The existing plan is modified, two source/test files are created and three other
documents are modified. Relative to committed F037, the plan is also a new file
from the preceding planning gate. Existing
Concept/attempt/progress models, routes, UI, fixtures/configuration and shared
packages are intentionally outside the boundary.

| # | Operation | Exact path | Purpose |
| --- | --- | --- | --- |
| 1 | MODIFY existing plan | docs/features/F038-completion-rules.md | Owner decisions, stage-specific evidence and outstanding F038 obligations. |
| 2 | CREATE | apps/api/src/modules/progress/completion-policy.ts | Strict metadata types/validation, defaults, pure eligibility evaluation and fixed blockers; no runtime adapter. |
| 3 | CREATE | apps/api/tests/completion-policy.test.ts | Deterministic synthetic policy fixtures, boundary/negative/purity tests only. |
| 4 | MODIFY | docs/DEVELOPMENT_ROADMAP.md | Record the approved foundation stage and evidence without claiming full F038 completion or starting F039. |
| 5 | MODIFY | docs/API_DESIGN.md | Document that this is internal policy only, adds no HTTP/public contract, and preserves Practice/progress secrecy and deferred completion endpoints. |
| 6 | MODIFY | docs/DATABASE_DESIGN.md | Reconcile policy terminology/defaults and Concept-level scope while retaining current persisted schemas and identifying future grading/evidence/completion storage gaps. |

No new dependency, configuration, environment variable, index or service. Existing
API TypeScript test include patterns cover the proposed module/test. Prettier
ignores docs under the existing configuration; manually preserve UTF-8/LF, exact
scope/history and new-line whitespace in documentation without changing formatter
configuration. If implementation needs a seventh path or a runtime adapter, STOP
for approval rather than expanding the foundation silently.

## 5. Delivery stages and future approvals

| Stage | Deliverable and dependency | Acceptance boundary |
| --- | --- | --- |
| A - Policy foundation | After explicit approval, implement only Section 4, settle C1 and the proposed input/boundary rules, then offline verification and formal diff review. | A deterministic function can pass synthetic contracts. No genuine evidence source, completed Concept or end-to-end F038 acceptance is established. |
| B - Grading/evidence prerequisites | Define verified evidence for each supported learning mode; trusted assessment provenance, four-type grading strategy, eligible question coverage, score selection and policy/content revision semantics. | Needs owner-reviewed product/security/architecture decisions, sequencing and additional exact file inventory. No existing feature is silently designated as a grading dependency. No F039 implementation is required or authorized. |
| C - Persistence/student workflow | Only after B, design completion initiation, fresh eligibility, policy resolution, publication/ownership/revision binding, durable state, concurrency/idempotency and revocation. Then approve its models/indexes/API/UI scope. | Six files are insufficient. Canonical studentProgress completion fields versus a separate completion record/versioned compatibility strategy require explicit decision; do not change F037 by assumption. |
| D - Final F038 acceptance | Verify the approved actual completion lifecycle and required integration/UI/security contracts, including historical data/privacy and release limitations. | Requires explicit final review and owner completion approval. A successful Stage A alone must not set whole F038 READY_FOR_REVIEW or APPROVED_COMPLETE. |

For Stage C, any future completion action should derive account identity from
authenticated current STUDENT, verify complete published ancestry/references,
re-evaluate authoritative evidence and policy before a durable change, and avoid
partial state under concurrent attempts or policy edits. Exact transaction and
idempotency semantics depend on the future storage decision; none are introduced
here. No completion result should weaken F036's persistence-before-disclosure or
F037's exact index readiness/activity-only contract.

Historical F037 rows remain unchanged and do not supply section or passing proof.
No completion default, migration, index creation or repair is inferred. Evidence
retention/erasure, account deletion, assessment privacy and backup handling need
separate decisions before any new personal data is persisted or deployed.

Future UI needs accessible eligibility/blocker feedback and the approved manual
or automatic workflow, with loading/error/Retry/focus/navigation/race behavior
verified independently. No disabled/working Mark Completed control, automatic
percentage, completion mutation or future API is built by Stage A.

## 6. Planned verification and review - NOT_RUN

No checks below are executed in this planning gate. Positive evidence objects in
unit tests are synthetic fixtures for the internal contract, not production
verification, authentication or grading. Use no real account data/credentials.

Focused deterministic policy tests should cover:

1. Default READ/VISUALIZE/EXAMPLE/PRACTICE and threshold 70; optional explicit
   REVISE; valid explicit configuration and no implicit completion of omitted modes.
2. Configured thresholds overriding defaults, including 0/100; scores 0/70/100
   and just below/at/above threshold; finite fractions under the proposed rule;
   invalid null/string/boolean/NaN/infinity/out-of-range/fractional thresholds.
3. Each required missing, incomplete or unverified section; unknown/duplicate/
   empty configurations and C1 omissions; no page-view/playback/draft shortcuts.
4. Missing/ungraded/null-score/malformed evaluation, low graded score, all four
   question types, valid passing candidate and no independent PRACTICE checkbox.
5. Cross-account/Concept, Concept/policy revision mismatches, conflicting duplicate
   section/evidence IDs and invalid optional evidence; no merge or stale fallback.
6. Unknown keys/versions/sections, malformed IDs/tokens, unsupported containers/
   accessors and arrays beyond bounds; stable allowlisted blockers without raw data.
7. Same input repeatedly, evidence-order permutation, deterministic blocker order
   and deduplication; caller input remains unchanged, including deeply frozen input.
8. No imports/calls to persistence, grading, network, clock, environment, browser,
   logging or F039; output has no answers, submitted text, scores, IDs or status
   mutation. Read/submit contracts remain untouched.

After future implementation approval, run the focused policy file and relevant
existing API regressions for Concept models/publication, Practice attempts,
progress, DTO secrecy and app/auth/error compatibility. Retain frontend regression
coverage required by AGENTS.md; do not invent mounted UI evidence for pure tests.
Run build, lint, TypeScript and formatting, plus documentation UTF-8/LF/history
and exact six-file checks. Use existing tools; no dependencies or infrastructure.

Perform a separate formal implementation-diff review for correctness,
maintainability, fail-closed validation, ownership/revision binding, answer privacy,
purity/determinism, existing-contract compatibility and scope. Report actual
CRITICAL/HIGH/MEDIUM/LOW findings with file/line references, not invented defects.
Unresolved Critical/High stops review; other findings need owner disposition.

No MongoDB integration is applicable to this I/O-free stage. Do not start MongoDB
or manufacture an integration PASS. Stages B/C require newly approved test scopes
and, for persisted behavior, separately guarded disposable MongoDB verification.

Browser additions for Stage A: zero. Preserve 141 existing expected browser
scenarios as NOT_RUN; no discovery, Playwright or primary-host execution. No F037
exception transfers to F038. Later UI changes require newly counted scenarios and
separate safe-execution or named-feature exception approval under AGENTS.md.
Preserve F022 EPERM/PID-reuse/Windows teardown, F024 worker/browser cleanup,
F029 scrolling and screen-reader/background-throttling/shutdown limitations.
Do not reopen the stopped temporary prototype or browser infrastructure work.

## 7. Owner decisions and next approval gate

Confirmed owner decisions: Concept-level policy, configurable required sections,
initial READ/VISUALIZE/EXAMPLE/PRACTICE defaults, non-universal REVISE, verified
evidence rather than visits, valid graded passing practice, default 70 overridden
only by valid explicit thresholds, no ungraded/count shortcut, fail-closed missing/
contradictory evidence and independence from mastery.

The owner approved Stage A within this exact six-file plan, including the internal
shapes, bounds, numeric rules, blockers and validation behavior. C1 is resolved:
VISUALIZE and PRACTICE are mandatory minimums, with graded passing always required.
Source reconciliation PASS; no source requirement was silently waived.

Leave score selection/coverage, trusted section and grading producers, threshold
resolution among editorial scopes, manual/automatic initiation, Concept revision
generation/invalidation, revocation, persistent storage and student workflow
unresolved for later explicit architecture/scope approval. A pure candidate policy
test cannot settle those real-world decisions. No new feature number, deployment
or F039 scope is assumed to solve the sequencing gap.

Historical planning-gate outcome: this plan was created only; F038 remained NOT_STARTED. Existing
files/statuses and F001-F037 approvals are preserved. No implementation, test,
service, database/browser/synthetic execution, dependency/infrastructure change,
Git write or paid/cloud operation has occurred. Next gate is explicit owner
approval of Stage A policy-foundation implementation and offline verification,
including C1 disposition. STOP; do not implement automatically.

## 8. Stage A implementation and offline evidence - 2026-10-19

Foundation implementation/offline result: PASS. F038 remains IN_PROGRESS, partial
Stage A only. This section supersedes the retained planning-gate restrictions and
next-gate wording above. The owner explicitly resolved C1 and authorized exactly
Section 4's six paths. PRD section 14, Database Design's Concept/default example
and F021/F030-F037 refinements reconcile: VISUALIZE/PRACTICE are mandatory;
READ/EXAMPLE are defaults; REVISE is optional unless required; graded passing is
always needed. No inspected source mandates another minimum section irrespective
of configuration. No architecture or file-scope expansion was required.

### Implemented internal contract and limitations

- completion-policy.ts exports the pure synchronous evaluator and metadata/result
  types. Runtime imports are existing Zod and node:util's native proxy detector;
  no dependency was added. No app/service/router imports or invokes the evaluator.
- Private fixed vocabularies, strict schemas and a bounded descriptor-based copy
  accept only plain metadata; reject accessors/proxies without invoking supplied
  traps/getters, symbols, sparse/extended arrays, cycles, unsupported containers,
  excessive depth/nodes/keys and overlong strings. No input mutation or freezing.
  Guards are input-size limits, not an absolute CPU/memory or hostile-runtime
  security boundary. No database, clock, environment, network, logging or grading.
- Defaults apply only to omitted configuration fields. Explicit undefined, null,
  duplicate/unknown sections or invalid thresholds do not fall back. Minimum
  integer threshold is 0-100; finite graded candidate scores may be fractional.
  No rounding, best/latest selection or score generation. Even threshold 0 cannot
  waive verified graded practice or VISUALIZE/other configured requirements.
- All supplied evidence must have valid metadata and matching owner/Concept/policy/
  revision bindings. Duplicate sections or cross-section evidence-ID rebinding
  block eligibility deterministically. Optional non-required REVISE may be absent,
  INCOMPLETE or UNVERIFIED without becoming a requirement; it provides no proof.
  Malformed, conflicting or stale optional metadata still fails closed. Required
  sections must be VERIFIED/COMPLETED; PRACTICE can only use the graded candidate,
  never an independent checkbox or F037 activity count.
- Recognizable UNGRADED/null candidate metadata produces PRACTICE_UNGRADED; raw
  F036 submissions fail strict input validation. GRADED/null or UNGRADED/numeric
  contradictions fail INVALID_INPUT. Missing practice yields EVIDENCE_MISSING.
  Exact code/section pairs are deduplicated and sorted by fixed code/section order.
  Output is exactly eligibility/blockers, with no input values, answers, scores,
  identifiers, completion-state mutation or private validator details.
- VERIFIED is not self-authenticating. Positive tests supply synthetic trusted
  metadata only. Authentic evidence/grading/selection, current Student/publication
  validation, revision generation and durable state are NOT_IMPLEMENTED. The
  result alone is not a completed Concept, access credential or deployment gate.

### Actual offline evidence

Logs: .cache/f038-offline-20261019/ (local excluded artifacts, not delivery scope).

| Check | Actual result |
| --- | --- |
| Focused completion policy | 22/22 PASS on final implementation |
| Existing relevant API regressions | 117/117 PASS |
| Total distinct API tests across these invocations | 139 with passing evidence; no combined-run claim |
| Relevant existing frontend regressions | 68/68 PASS |
| API production build | PASS |
| API source/test TypeScript | PASS |
| Repository lint | PASS, zero warnings |
| Formatting of both new TypeScript files | PASS |

API regression files cover auth/token/current-user behavior, Concept/publication,
app/error/no-store/logging compatibility, Practice questions/attempt persistence,
progress and User validation. Frontend files cover Concept rendering, progress
client/controller/rendering and Practice client/controller/rendering. No existing
test/assertion was changed. This gate does not claim a fresh full-web regression
or workspace frontend build; those unchanged historical results remain historical.

Initial focused evidence: 21 PASS / 1 FAIL. The missing schemaVersion property was
classified INVALID_INPUT by envelope validation instead of the planned
UNSUPPORTED_VERSION. Corrected the envelope's version-presence handling; final
22/22 PASS preserves the same rejection assertions and still fails closed.
Initial TypeScript identified captured parse-result narrowing and ES2023-only
array helpers under ES2022; narrowed parsed data before closure and replaced the
test helpers with slice/reverse. Initial lint identified four unused omission-
fixture bindings; replaced them with an explicit property-omission fixture helper.
Final type/lint checks pass. No timeout/retry/configuration or assertion weakening.
No earlier failed check is represented as an uninterrupted clean run.

### Separate source-diff/security review

Performed a separate review of the final module/test and documentation changes,
with attention to positive eligibility paths, structural early returns, mandatory
section/threshold precedence, exact identity/revision comparisons, duplicate and
conflicting evidence, output allowlisting, purity/determinism, caller mutation,
existing-contract compatibility and the future verification trust boundary.

Actual unresolved findings: CRITICAL 0; HIGH 0; MEDIUM 0; LOW 0.
No actual finding remains to assign file/line references to. This is source/offline
assurance of Stage A only, not proof of real evidence authenticity, grading,
persistence, complete F038 acceptance or browser behavior. The evaluator is not
connected to a route and cannot bypass existing Student/answer-secrecy gates.

Exactly six approved paths changed. The source/test were created; four documents
were updated, including the already-created, still-uncommitted plan. Existing
models/indexes, runtime API/frontend/auth/configuration/shared files and prior
feature documents remain unchanged. API/Database documentation append an internal
policy refinement only. Roadmap changes are confined to F038 and the current
feature pointer. Preserve UTF-8/LF and historical text/Markdown hard breaks.
No secrets, database data, generated outputs or local evidence artifacts belong
in the approved six-path inventory. No Git staging, commit or push occurred.

### Remaining gates and status

No MongoDB integration is applicable: this foundation performs no database I/O.
No browser additions: zero. Existing complete expected browser coverage remains
141 NOT_RUN. No browser/manual smoke PASS or exception is claimed or inherited.
No primary-host Playwright or process-safety investigation was performed.
Retain all F022/F024/F029 and Windows accessibility/background/shutdown limitations.

Stages B/C/D remain outstanding: verified section/grading producers and score
selection/coverage; threshold-source precedence; Concept/policy revision generation;
manual/automatic initiation; persistence/API/student UI; invalidation/revocation;
privacy/retention/erasure and full end-to-end acceptance. No default completion,
scored overwrite of F036, promotion of F037 history, mastery or F039 work is added.

Next gate: owner review of Stage A offline evidence and separate approval for any
further detailed design or correction. Do not mark full F038 READY_FOR_REVIEW or
APPROVED_COMPLETE from this result. F001-F037 remain APPROVED_COMPLETE; F039 remains
NOT_STARTED. F038 remains IN_PROGRESS. STOP after this offline verification gate.

## 9. Stage B1 - Pure OUTPUT Grading Foundation (PLANNING ONLY)

**Planning authorization:** Owner approved detailed planning on 2026-10-19,
limited to adding this section in this feature document. No B1 implementation,
test execution, status change, API/model/UI work or other file edit is authorized.
The Stage A evidence and six-path historical boundary above remain unchanged.
This section proposes a distinct four-path future B1 increment; it does not
expand Stage A or authorize work in those paths now. F038 remains IN_PROGRESS.

### 9.1 Contract reconciliation and smallest increment

PRD sections 14-15 and 23-24 require passing practice, preserved attempts and
submission before answer disclosure; they do not define a universal text grader.
F030's answer is authored Markdown, trimmed and bounded to 50,000 code units;
its evaluation object is explicitly deferred. It is not a deterministic rubric.
F031-F034 support free-text drafts across four types, not automatic evaluation.
F036 persists immutable SUBMITTED/null-score attempts before LOCAL-only disclosure;
F037 counts activity without section, grade, completion or mastery semantics.
The canonical F038 Stage A appendices explicitly leave authentic evidence and
grading integration for later approval. B1 must preserve all of those contracts.

Recommend a pure synchronous evaluator, proposed name evaluateOutputGrading,
accepting one explicitly opted-in OUTPUT rubric and one submitted text value.
It produces an internal comparison result or a fixed refusal. An arbitrary
official answer must never become a rubric by inference, fallback or implicit
comparison. Existing questions and stored attempts are not automatically opted in.
No HTTP adapter, persisted rubric, assessment record or Stage A adapter is built.

The following B1-P1 through B1-P6 choices are recommendations requiring explicit
owner disposition and implementation approval. Planning approval is not approval
of the proposed score convention, schema, rubric lifecycle or future integration.

### 9.2 Owner decisions and conservative defaults

| Decision | Options requiring disposition | Recommended B1 default |
| --- | --- | --- |
| B1-P1 - Authoring/approval | Implicit reuse of solution text; explicit authored rubric with review; future automated authoring plus human review. | Explicit, separately reviewed deterministic rubric only. Require APPROVED metadata and immutable rubric id/version bindings. Do not reuse F030 answer automatically. No authoring/publishing interface or approval storage in B1. |
| B1-P2 - Answer forms/normalization | Exact text; explicitly normalized line sequences; numeric/structured output with separately specified semantics. | Only TEXT + EXACT_TEXT + explicitly supplied NONE normalization. Preserve all accepted UTF-16 code units; no default strategy, trimming, newline conversion, case folding, Unicode normalization, numeric coercion or parsing. Other forms require later approval. |
| B1-P3 - Outcome/score | Binary exact-match score; partial-credit rubric; comparison result without a numeric score. | Propose CORRECT/100 or INCORRECT/0 only after valid explicit rubric comparison. No partial credit, percentages inferred from text similarity or fabricated score for refused input. Owner must approve this binary score convention. |
| B1-P4 - Binding | Only question id; public revision; full current public/private context plus approved rubric version. | Exact question/Concept ids, F036 questionRevision and private contentFingerprint, plus rubric id/version, must agree with a separately supplied expected context. Version changes or any content-binding mismatch refuse. No digest-generation or provenance-verification adapter in B1. |
| B1-P5 - Refusal | Throw/raw diagnostics; treat unsupported inputs as incorrect; structured fixed refusal. | Stable single-code REFUSED result, never a zero grade for invalid/unapproved/unsupported input. Strict validation and fixed precedence; no sensitive error echo or permissive fallback. |
| B1-P6 - Integration/privacy | Immediately grade existing submissions; disconnected internal primitive; future approved authenticated assessment workflow. | Disconnected primitive only. No answer disclosure, automatic stored-attempt grading, completion evidence creation or persistence. Future authentication, provenance, disclosure timing, retention and erasure need separate designs/approval. |

For P1, recommend future Admin-authored DRAFT -> explicit review -> APPROVED;
an approved definition is frozen, edits require a new version and revocation
prevents future use. Review must confirm a single unambiguous expected literal,
normalization choice and exact question/solution binding. Who may author/approve,
whether independent reviewers are required, approval audit and concurrent
revocation handling require owner decisions before that lifecycle is built.
B1 only recognizes supplied lifecycle metadata; it implements no transitions.

APPROVED is internal metadata describing the future trusted producer's decision,
not proof of Admin authorization, a signature or a client-granted entitlement.
An object forged with APPROVED can satisfy structural checks; the pure evaluator
cannot authenticate it. A future server-side adapter must load the approved rubric
and expected context from authoritative sources. Never forward browser-provided
rubric, approval, expected answer, score or fingerprint as trusted input.

### 9.3 Proposed strict internal input/rubric schema

Entry point: evaluateOutputGrading(input: unknown): OutputGradingResult.
This is a proposed TypeScript-domain contract, not a public request or stored model.
Every object is strict; unknown keys, arrays, coercion, class instances, symbols,
accessors and proxies must refuse without invoking supplied getters or callbacks.
Inspect/copy bounded plain data as in Stage A; do not freeze or mutate the caller.
Propose maximum nesting depth 4, 200 visited values and 32 own keys per object.
No arrays or arbitrary extra nesting are part of the supported shape.

The root has exactly schemaVersion, question, rubric and studentAnswer.
schemaVersion is the envelope version, literal 1. All fields below are required.

| question (expected internal context) | Proposed validation |
| --- | --- |
| id, conceptId | Canonical lowercase 24-hex strings; no trimming, case folding or lookup. |
| type | OUTPUT only. Other canonical question types are unsupported by B1. |
| questionRevision | Canonical lowercase 64-hex F036 public question revision. |
| contentFingerprint | Canonical lowercase 64-hex F036 private solution/reference binding, supplied by a future authoritative adapter. Not an answer snapshot or proof of authenticity. |
| rubricId | Bounded opaque token, 1-128 ASCII characters, same token pattern as Stage A. |
| rubricVersion | Positive safe integer selected by a future trusted policy/authoring layer. No highest/latest-version discovery. |

| rubric | Proposed validation |
| --- | --- |
| schemaVersion | Literal 1; distinct from the authored rubric version. |
| id, version | Same bounded token/positive-safe-integer rules as expected rubricId/rubricVersion. |
| approval | Recognized metadata enum DRAFT, APPROVED or REVOKED; only APPROVED permits grading. Unknown approval values are malformed. No timestamps, actor fields or unsigned approval claims are treated as authentication. |
| questionId, conceptId, type | Same canonical identity rules; type must be OUTPUT and all bindings must equal question. |
| questionRevision, contentFingerprint | Same canonical digest rules and exact equality to expected context. Private fingerprint is never returned or logged. |
| answerForm | Explicit TEXT only. |
| comparison | Explicit EXACT_TEXT only: one literal expected text, no expressions or executable callbacks. |
| normalization | Explicit NONE only. Omission is invalid; no implied normalization. |
| expectedAnswer | One well-formed Unicode string, nonblank, length 1-10,000 UTF-16 code units, retained verbatim. No list of alternatives or implicit extraction from Markdown/code fences. |

studentAnswer is likewise a well-formed Unicode, nonblank string of 1-10,000
UTF-16 code units, verbatim. A nonblank check only rejects input; it must never
replace the compared value with trimmed text. Empty/whitespace-only outputs and
unpaired surrogates are outside this proposed B1 subset and refuse rather than
receive an incorrect grade. Their future representation needs explicit approval.
This restriction does not change F036 submission validation or erase existing data.
Use deterministic ECMAScript whitespace rules for the nonblank check, not locale.

The expected-answer bound deliberately matches the student-submission maximum;
it does not shrink F030's stored answer field. Longer authored explanations,
multiple possible outputs or nonliteral Markdown answers are not gradeable by
this B1 rule without a separately authored supported rubric. Never truncate them.

### 9.4 Explicit comparison, outcomes and threshold boundary

Only after every structural, approval, strategy and binding check passes, compare
studentAnswer to rubric.expectedAnswer for exact UTF-16 code-unit equality.
NONE is the identity normalization: spaces, tabs, indentation, casing, CR/LF/CRLF,
leading/trailing whitespace and trailing newlines are all significant. Composed
and decomposed Unicode text differs. Astral characters count as two code units.
No regex execution, JavaScript evaluation, JSON/numeric parsing, locale comparison,
HTML/Markdown rendering, Unicode normalization or tolerance matching is permitted.

Proposed exact discriminated output union:

- Successful comparison: { status: GRADED, outcome: CORRECT, score: 100 } or
  { status: GRADED, outcome: INCORRECT, score: 0 }.
- Refusal: { status: REFUSED, code: one fixed allowlisted code }.

No output contains submitted/expected answers, explanations, fingerprints,
question/account/rubric identities, matched fragments, input lengths, validator
messages, stack traces or arbitrary metadata. The caller must retain its exact
validated context for future association; result alone is not an evidence token.
GRADED here describes this internal deterministic comparison only. It does not
claim persisted assessment, authenticated ownership, verified provenance or
authorization to construct Stage A VERIFIED practice evidence.

B1 does not decide passing, select first/latest/best attempts or aggregate scores.
Stage A separately applies its valid configured threshold, otherwise 70, only to
verified evidence from a future approved adapter. Under the proposed binary rule,
100 meets default 70 and 0 does not; explicitly configured 0 still follows Stage A
and does not remove graded-evidence/required-section prerequisites. Do not return
PASS/FAIL or a completion decision from B1, and do not override threshold policy.

### 9.5 Stable refusal contract and deterministic precedence

Propose exactly these refusal codes in the following validation order. Stop at
the first applicable refusal; do not collect field values or exception details.

| Order | Refusal code | Meaning |
| --- | --- | --- |
| 1 | INVALID_INPUT | Unsafe object structure/bounds, malformed strict root/expected context or missing root fields. Data inspection must not execute supplied code. |
| 2 | UNSUPPORTED_VERSION | Present envelope schemaVersion is not 1; or, after a safe rubric object is established, present rubric schemaVersion is not 1. Missing rubric version fields belong to INVALID_RUBRIC. |
| 3 | INVALID_RUBRIC | Missing/malformed required rubric fields, invalid ids/digests/version numbers, unknown keys, invalid approval enum, arrays/alternative expected answers, blank/oversized/ill-formed expected text. |
| 4 | UNSUPPORTED_RUBRIC | Well-shaped text declarations specify a question type other than OUTPUT, an unsupported answerForm/comparison/normalization, or a context type outside OUTPUT. No default/fallback strategy. |
| 5 | RUBRIC_NOT_APPROVED | Valid recognized DRAFT or REVOKED approval metadata. Only the explicit APPROVED value reaches comparison. |
| 6 | BINDING_MISMATCH | Well-formed question/Concept ids, public revision, private fingerprint or rubric id/version disagree across question and rubric. All comparisons are exact, with no timestamp tolerance. |
| 7 | INVALID_ANSWER | studentAnswer is not a valid nonblank, well-formed text value within the bound. No score is produced. |

Validation must distinguish a recognized unsupported strategy string from a
missing/wrongly typed declaration. Such strings are bounded opaque tokens before
allowlist checks, not arbitrary instructions. If a root studentAnswer scalar is
malformed, defer its semantic classification to INVALID_ANSWER after the safe
root inspection; unsafe objects/accessors still refuse immediately as INVALID_INPUT.
Root version checks precede rubric parsing. Rubric version checks precede other
rubric field validation only after safely establishing its plain-object shape.
Version precedence cannot be used to traverse an unsafe nested object. Multiple
simultaneous defects must yield the same documented first refusal on every call.
No valid mismatch is silently reclassified as an incorrect answer.

### 9.6 Purity, security and future trust boundary

Use existing TypeScript/Zod capabilities only if useful; no dependency addition.
No database/repository/service/router imports, account/session access, clock,
randomness, environment reads, network/filesystem I/O, timers, logging, shared
mutable state, code execution, external AI or module-initialization side effects.
Do not silently swallow an unsupported grading operation or expose raw errors.
Fresh result objects and unchanged inputs must be independently verifiable.

Do not query or grade F036 rows, change their score/result, mutate F037 summaries,
select assessment candidates, create evidence/assessments/completion records,
invoke Stage A, reveal answers, add a route or implement F039. No automatic
transaction/idempotency/index behavior is needed for a disconnected pure function.
Do not claim constant-time comparison, authentic grading provenance or a sandbox.

Before any future integration, separately approve current STUDENT authorization,
five-level published ancestry/reference checks, immutable attempt ownership,
current public/private/rubric revision validation and conflict/replay behavior.
Validate the expected literal against the reviewed rubric without deriving it
from generic official Markdown. F036 fingerprints cannot recover an old solution;
historical mismatches must not be graded using today's solution by assumption.

Disclosure timing is unresolved: F036 already reveals answers after saving an
ungraded attempt. A later correct response can copy the revealed answer. Approve
whether and how grading occurs before disclosure, which submissions qualify,
question coverage and first/latest/best policy before claiming passing evidence.
Do not silently delay or weaken existing F036 disclosure or infer comprehension.

Future assessment storage must preserve immutable attempts and canonical
studentProgress; an append-only assessment is a proposal requiring explicit
architecture/privacy approval, not a chosen database model. Retention, erasure,
backups, access/audit rules, rubric approval provenance and policy/Concept revision
generation remain deferred. No new API or persisted schema wording is required
for disconnected B1. If integration requires either, propose exact canonical
document amendments and obtain separate scope/architecture approval first.

### 9.7 Exact proposed four-path B1 implementation inventory

| Operation | Exact path | Proposed purpose |
| --- | --- | --- |
| CREATE | apps/api/src/modules/practice/output-grading.ts | Pure internal evaluator, strict proposed types/schema, exact opt-in comparison and refusal/result allowlists. |
| CREATE | apps/api/tests/output-grading.test.ts | Focused deterministic, boundary, refusal, binding, privacy and purity fixtures; no runtime integration. |
| MODIFY | docs/features/F038-completion-rules.md | Record owner P1-P6 dispositions, B1 scope and actual later implementation/offline evidence separately from Stage A. |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md | Record partial B1 progress/evidence only; keep F038 IN_PROGRESS and F039 NOT_STARTED. |

This is a proposal for a later implementation approval, not authorization now.
For this planning gate, only this document is modified. API_DESIGN.md and
DATABASE_DESIGN.md remain unchanged canonical references. No app/model/config,
fixture, shared-package, UI, endpoint or other feature changes are included.
If a fifth path or a different contract is necessary, STOP for owner approval.
The earlier read-only six-file suggestion is superseded for future B1 by the
owner's explicit four-path inventory; the historical Stage A six paths are not
retroactively changed. No existing architectural decision is replaced here.

### 9.8 Future verification and formal review plan (NOT_EXECUTED)

After separate implementation approval, plan focused fixtures for:

1. Explicit APPROVED, fully bound TEXT/EXACT_TEXT/NONE rubric: exact match 100,
   valid differing literal 0, and absence of any inferred official-answer fallback.
2. Whitespace/tab/indentation/case/newline differences, CR/LF/CRLF, trailing newline,
   composed/decomposed Unicode, valid astral text, and significant leading zeroes.
3. Length 1/10,000 versus 10,001 UTF-16 units; blank/empty text; invalid Unicode,
   nonstrings, null and numeric/coercible values for each relevant answer field.
4. Missing/unknown fields, malformed/ambiguous rubrics, unsupported type/strategy,
   alternatives, regex/code/provider payloads and unapproved/revoked rubrics.
5. Envelope/rubric schema versions; rubric id/version mismatches; question/Concept,
   public revision and private fingerprint mismatches; stable multi-defect precedence.
6. Strict refusal output with no score, sensitive values or validator/error details;
   graded output exact allowlist and no pass/completion or VERIFIED assertion.
7. Repeated-call determinism, frozen inputs, caller identity unchanged, fresh result
   objects, accessors/proxies not invoked, malformed nested/cyclic/bounded input,
   and no I/O, logging, persistence, clock/randomness or module side effects.
8. No caller outside focused tests, no automatic stored-attempt grading, unchanged
   F036 disclosure/attempt and F037 summary behavior, no Stage A wiring or F039 work.

Run focused grading tests and relevant existing Practice/attempt/progress/policy
API regressions after approval; report distinct counts without inventing results.
Run API build/TypeScript, repository lint, targeted source formatting, UTF-8/LF,
whitespace and exact four-path B1 scope/security checks. Review the implementation
diff separately for correctness, privacy, trust assumptions, refusal behavior,
binding, determinism and compatibility. Report actual CRITICAL/HIGH/MEDIUM/LOW
findings with file/line references; unresolved findings require owner disposition.

No MongoDB integration is applicable to disconnected B1; no browser/UI or synthetic
process execution is needed. Proposed browser additions: zero. Existing 141
expected scenarios remain NOT_RUN with F022/F024/F029 and Windows limitations
preserved. No previous exception transfers and no new browser PASS is claimed.
Later database/runtime/UI work needs independently approved guarded verification.

### 9.9 Outstanding decisions and next approval gate

Planning result: READY FOR OWNER DECISION, not implementation or functionality PASS.
Owner must approve or revise B1-P1-P6, including exact literal-only normalization,
the binary score convention, all binding/version fields, refusal precedence and
the four-path scope before B1 implementation/offline verification may begin.
Authoring/storage/authenticity, section producers, disclosure timing, grading
provenance/persistence, coverage/selection, revision/threshold-source resolution,
privacy and Stage C studentProgress completion workflow remain later dependencies.
Genuine grading/evidence must precede enabled completion persistence, even if its
future storage design is discussed earlier. Topic aggregation and mastery are
not delivered. Keep F001-F037 APPROVED_COMPLETE, F038 IN_PROGRESS, F039 NOT_STARTED.
STOP after this documentation-only planning gate; no tests or services were run.

## 10. Stage B1 implementation and offline evidence - 2026-10-19

**Owner authorization:** B1-P1 through B1-P6 and the exact four Section 9.7 paths
are explicitly approved for implementation/offline verification. This supersedes
Section 9's historical planning-only gate for B1, not its security boundaries or
the outstanding runtime/evidence/persistence decisions. Reconciliation PASS.
The six-path Stage A history, results and canonical-document clarifications are
preserved. B1 changes exactly four paths: two creations and two document edits.
Cumulative uncommitted F038 scope is eight unique paths, because the two new B1
source/test files extend the six existing Stage A paths. F038 stays IN_PROGRESS;
no whole-feature completion or release is approved.

### Implemented internal contract

- output-grading.ts exports evaluateOutputGrading and strict input/result/refusal
  types. Only explicit TEXT/EXACT_TEXT/NONE rubrics with APPROVED metadata reach
  comparison. Missing expected context or opt-in declarations refuses. No rubric
  is derived from F030 answer Markdown or saved attempts.
- Strict plain-data snapshots reject proxies, accessors, unknown/symbol/hidden
  fields, class instances, cycles and excess depth/key/node counts without calling
  supplied code. Safe array inspection only allows deterministic refusal
  classification; no array is accepted as a valid field.
- Text values must be nonblank, well-formed Unicode and 1-10,000 UTF-16 code units.
  Nonblank validation never transforms comparison data. Whitespace, indentation,
  CR/LF/CRLF, casing, trailing newline and Unicode composition remain significant.
  No trimming, normalization, coercion, parsing or code execution.
- Question/Concept identity, public questionRevision, private contentFingerprint
  and rubric id/version must match the separately supplied expected context
  before comparison. Unsupported question types never grade.
- A valid exact match returns only GRADED/CORRECT/100; a valid different literal
  returns only GRADED/INCORRECT/0. Refusal returns only REFUSED plus one of the
  seven fixed Section 9.5 codes in the specified validation precedence. No answer,
  fingerprint, copied identifier, diagnostic details or score on refusal.
- APPROVED and matching expected context are caller assertions, not authenticated
  provenance. Synthetic matching metadata can grade; this does not prove Admin
  review, account ownership, durable assessment or genuine verified evidence.
  The result is not a Stage A VERIFIED candidate or completion entitlement.
- Only node:util and the existing zod dependency are imported. No runtime caller
  imports this evaluator. No accounts/sessions, database/network/filesystem access,
  clocks/randomness, logging, HTTP adapters, live grading, historical mutation,
  assessment/evidence storage, Stage A wiring, F037 updates or F039 functionality.

### Actual B1 offline verification

| Check | Actual result |
| --- | --- |
| Focused OUTPUT grading | 23/23 PASS |
| Existing relevant API regressions | 96/96 PASS across nine files |
| Distinct tests across these two successful invocations | 119 PASS; not a combined invocation |
| API production build | PASS |
| API source/test TypeScript | PASS |
| Repository lint | PASS, zero warnings |
| Prettier check of both B1 TypeScript files | PASS |

The nine regression files cover practice-question/attempt models, attempt
transactions/idempotency/index refusal, Practice service/HTTP authorization,
validation/secrecy/no-store/rate limits, progress model/service/HTTP read-only
and transaction contracts, and existing completion-policy tests. No old assertion,
model, router, config or client changed. These 96 include the 22 existing policy
tests; they are not a fresh claim of Stage A's wider 117-test API or 68-test
frontend invocations. Historical results remain unchanged; no new frontend run
is necessary or claimed for this disconnected module.

The first focused launch in the sandbox stopped in tsx bootstrap with
ERR_SYSTEM_ERROR: uv_os_get_passwd returned ENOMEM, before any test loaded.
The supported ordinary-user execution context then ran focused tests and offline
regressions successfully. No environment/dependency modification, assertion
weakening, browser/synthetic-process test, MongoDB connection or service deployment
was used. HTTP regressions use existing temporary loopback test listeners.
No failed grading assertion or implementation correction was required.

### Separate formal source-diff/security review

A separate review pass inspected the complete new module/test sources and scoped
documentation against P1-P6: exact comparison/UTF-16 bounds, Unicode validity,
identity/version binding, strict opt-in/strategies, refusal precedence/DTO secrecy,
accessors/proxies/bounded inspection, input preservation/fresh outputs, dependency
and runtime boundaries, and F036/F037/Stage A compatibility. Approval metadata
is not represented as authenticated authorization. No execution, sensitive logging,
cache or persistence path was added.

Actual unresolved findings: CRITICAL 0; HIGH 0; MEDIUM 0; LOW 0. There are no actual
findings requiring affected-line references. This is an internal primitive review,
not proof of real approval provenance or end-to-end grading.

### Scope, deferred dependencies and owner gate

Only the four approved B1 paths changed during this gate. Stage A source/tests and
canonical PRD/API/Database documents are unchanged. UTF-8/LF and whitespace checks
PASS; SHA-256 inventory comparison confirms 442 files outside B1 remain unchanged.
git diff --check PASS; both new TypeScript files pass Prettier. No dependencies,
configuration, Git staging/commit/push, database or browser execution were added.

Trusted rubric authoring/review/adapters, disclosure timing, qualifying attempts,
persisted assessment provenance, coverage/selection, section-evidence producers,
revision/threshold-source rules, privacy/erasure, completion persistence/API/UI
and initiation/invalidation/revocation remain unimplemented and need separate
scope/approval. studentProgress stays canonical; F036 attempts stay immutable
SUBMITTED/null-score records; F037 stays activity-only. No historical promotion.

B1 browser additions: zero. Preserve all 141 existing scenarios as NOT_RUN and
F022/F024/F029/Windows limitations; no browser PASS or inherited exception.
No MongoDB/browser integration applies to this disconnected primitive. Future
runtime/persistence work requires separately approved guarded verification.

Next gate: owner review of B1 implementation/offline evidence and separate approval
for further Stage B design or correction. Do not set full F038 READY_FOR_REVIEW or
APPROVED_COMPLETE. Preserve F001-F037 APPROVED_COMPLETE, F038 IN_PROGRESS and F039
NOT_STARTED. STOP after offline verification; do not continue automatically.

## 11. Stage B2 - Trusted Rubric Authorization and Assessment Evidence (PLANNING ONLY)

**Owner gate:** Detailed planning only, approved 2026-10-19. Only this section is
added to this document. No B2 schema, index, canonical-document amendment, source,
test execution or status change is approved. Stage A/B1 results remain historical
verified evidence; B2 behavior below is proposed and NOT_IMPLEMENTED/NOT_VERIFIED.
F038 remains IN_PROGRESS. The provisional 11-file inventory needs an explicit
audit-scope decision described in Section 11.8 before implementation approval.

### 11.1 Source reconciliation and bounded B2 increment

PRD sections 14-15 and 23-24 require passing practice, preserved attempts and
submission before disclosure. They do not establish rubric authorization or
which already-revealed submissions may count toward completion. Database Design
defers F030 evaluation, requires immutable F036 attempts, keeps F037 activity-only
and names studentProgress as canonical completion summary. API Design retains
LOCAL-only durable unlock and answer-free GET. Stage A consumes trusted metadata
but does not establish authenticity; B1 only compares supplied rubric metadata.

Recommend an internal LOCAL-only OUTPUT service with authenticated draft/review/
revoke operations and explicitly requested diagnostic grading of an owned durable
attempt. No route, Admin UI/CLI, worker, schedule, automatic submission hook,
historical grading job or deployment wiring is included. Direct service tests may
exercise it after implementation approval; database tests need a separate gate.
No existing F036/F037 schema, endpoint, transaction or public DTO changes.

Recommend separate immutable rubric definitions, narrowly mutable authorization
state and append-only assessments. They are proposed new canonical collections,
not already-approved schema and not an alternative completion store. Independent
review cannot be silently waived if only one eligible Admin exists: fail closed;
do not create real accounts. Only synthetic integration fixtures may supply roles.

### 11.2 Numbered owner decisions (recommendations, not schema approval)

| Decision | Recommendation requiring explicit disposition |
| --- | --- |
| B2-P1 - Canonical schemas | Approve the three proposed collections and strict fields below; keep attempts unchanged and studentProgress canonical. New rubric/assessment storage is a canonical extension requiring a separate decision. |
| B2-P2 - Approval authority | Current eligible ADMIN authors; a different current eligible ADMIN reviews/approves. No self-approval. Record server-derived identities, immutable definition binding and transactional append-only audit events. No new role or service credential. |
| B2-P3 - Revocation consistency | Approval authority and grading/replay decisions share an optimistic write fence. Revocation is terminal per version; future edits/reapproval require a new reviewed version. Serialize at MongoDB commit; do not claim instantaneous account/content revocation. |
| B2-P4 - Assessment identity | One immutable assessment per owned attempt, explicit rubric/version and grader implementation/version. Derive identity/fingerprint on the server; unique indexes and bounded transaction retries resolve identical requests, with changed identity/payload conflict. |
| B2-P5 - Internal authorization | Reuse signed access-token verification and fresh account eligibility. ADMIN for rubric operations; STUDENT for diagnostic grading of that same account's attempt. No blanket Admin cross-account grading authority. All operations fail outside existing APP_ENV=LOCAL. |
| B2-P6 - Diagnostic disclosure | All B2 records carry purpose=DIAGNOSTIC. They neither qualify for completion nor create Stage A VERIFIED evidence. Existing F036 disclosure ordering stays unchanged; no grading operation returns correct answers. |
| B2-P7 - Retention/erasure | Authorize disposable synthetic tests only until retention, coordinated erasure, backups and audit preservation are separately approved. No persistent demo writes, production use, TTL, migration, export/delete API or indefinite-retention promise. |
| B2-P8 - Indexes/transactions | Exact declared unique-index readiness, no automatic provisioning. Primary snapshot transactions, majority+journal commit, owned majority proof, bounded retries and fail-closed uncertainty. Index creation only in separately approved verified disposable integration. |

### 11.3 Identifying internal callers and establishing rubric trust

Proposed service factory receives the existing AccessTokens verifier and existing
validated environment configuration through trusted server composition. Every
operation verifies an existing access JWT rather than accepting a caller-supplied
AuthContext, ADMIN boolean, studentId or approval claim. Reuse current issuer,
audience, HS256, expiry and claim validation; never log tokens. Tests may inject
verifiers as existing services do, but no request can select test dependencies.
No new token type, signing key, environment variable or Windows permission.

Load current account role/status/email verification and match the verified subject.
Reject disabled/suspended/unverified/missing accounts and role changes. Do not
claim that sid alone proves a currently live session: preserve the existing access-
token contract. Rubric operations require ADMIN; grading requires STUDENT and an
attempt whose userId equals the authenticated subject. No rubric-definition or
score input exists on the grading method. An internal invocation supplies only
attemptId, explicit rubricId/version and a bounded request correlation id.

Authoring is a different Admin-only method: it accepts strict, reviewed-source
draft data, derives authorId/time/version identity server-side and writes an
immutable draft definition. Editing creates a new version; no approved definition
is overwritten. Approval loads that definition and fresh published question with
complete five-level ancestry/reference consistency; an independent reviewer must
explicitly validate the expected literal, strategy and private solution binding.
Do not extract an expected literal automatically from Markdown official answers.

Only a successful authorized approval transaction can create the authority row.
It records reviewer identity/time, definition digest and audit receipt. APPROVED
on an untrusted DTO, missing audit provenance or a raw model reference is not
authorization. No arbitrary browser rubric is accepted, including one with a
matching id/digest. Grade loads the authoritative approved definition and authority
by explicit version and verifies them before constructing B1 input internally.

Check the requesting actor at entry, within the bounded transaction and after
commit/proof before returning. At grading, also require the approving reviewer
to remain an eligible ADMIN. Authorship is checked at creation/approval; later
author demotion does not itself erase provenance. This reviewer-continuity policy
is deliberately conservative and needs P2 approval. Minimal eligibility queries
may live in the new repository with explicit noncredential projections and bounded
session reads; no existing user/auth module change is proposed. No promise of
linearizable account disablement beyond observed validation boundaries is made.

### 11.4 Proposed records, exact binding and indexes

All new schemas: schemaVersion=1, strict unknown-field rejection, genuine ObjectId
references and UTC Dates, canonical lowercase 64-hex digests, no coercion or mixed
metadata, autoCreate/autoIndex/buffering disabled. Use explicit private projections.
These are proposed storage contracts only; no collection/index is created now.

**practiceRubricVersions - immutable authored definitions**

- _id; rubricId (stable server-owned ObjectId); version (positive safe integer);
  questionId; conceptId; type=OUTPUT; questionRevision; contentFingerprint;
  answerForm=TEXT; comparison=EXACT_TEXT; normalization=NONE; expectedAnswer;
  definitionFingerprint; authorId; createdAt; schemaVersion.
- expectedAnswer has B1's verbatim nonblank well-formed Unicode/10,000-unit bound.
  All bodies are insert-only, including drafts; a draft without authority cannot
  grade. Existing practiceQuestions.evaluation remains unsupported/unmodified.
- definitionFingerprint is server SHA-256 over a version-tagged, ordered encoding
  of rubric identity/version, author, question/Concept/public/private bindings,
  type/strategy and verbatim expectedAnswer. It is private comparison data, not a
  signature, anonymization or permission. Approval binds this exact definition.
  Proposed exact UTF-8 JSON array: ["F038-rubric-v1", rubricId, version,
  questionId, conceptId, "OUTPUT", questionRevision, contentFingerprint, "TEXT",
  "EXACT_TEXT", "NONE", expectedAnswer, authorId]. IDs are canonical lowercase
  hex strings; version is the validated integer; text is verbatim without Unicode
  normalization. Server lifecycle timestamps are outside this definition digest.
- Unique uq_practice_rubric_version: {rubricId:1,version:1}; default _id index.
  Explicit versions only: no latest/best/implicit active-rubric selection rule.

**practiceRubricAuthorities - approval/revocation gate and concurrency fence**

- _id; rubricId; version; definitionId; definitionFingerprint; authorId;
  reviewerId; approvedAt; approvalAuditId; state=APPROVED|REVOKED;
  decisionFence (nonnegative safe integer); revokedBy/null; revokedAt/null;
  revocationAuditId/null; schemaVersion.
- No authority row before independent approval. Definition/author/reviewer/approval
  bindings become immutable at insertion. Only owned repository operations may
  advance the fence or set terminal revocation fields. No edit/delete/restore.
- Unique uq_practice_rubric_authority: {rubricId:1,version:1}; default _id index.
  Cross-record references/digests and audit receipts must be verified by service/
  repository logic; Mongoose ref declarations do not enforce foreign keys.

**practiceAssessments - append-only diagnostic evaluation**

- _id; userId; attemptId; questionId; conceptId; type=OUTPUT; questionRevision;
  contentFingerprint; attemptRequestFingerprint; rubricId; rubricVersion;
  rubricDefinitionFingerprint; graderId=OUTPUT_EXACT_TEXT; graderVersion=1;
  purpose=DIAGNOSTIC; outcome; score; refusalCode; evaluatedAt; requestedBy;
  authorityId; reviewerId; approvalAuditId; authorizationFence; requestFingerprint;
  schemaVersion.
- userId/requestedBy come from the verified Student and owned attempt, not payload.
  Attempt identity/references/type/revisions/fingerprints must exactly match the
  majority-confirmed F036 record and current published content. No student answer,
  expected answer, explanation, token, raw idempotency key or solution snapshot.
- Outcome union: CORRECT/100/null refusalCode; INCORRECT/0/null refusalCode; or
  REFUSED/null/INVALID_ANSWER when a valid owned F036 text is outside B1's supported
  text subset (for example an unpaired surrogate). Refusal never becomes score 0.
  Authorization/revocation/stale-binding failures create no assessment. Unexpected
  B1 structural/rubric refusal is sanitized dependency failure, not a stored grade.
- graderId/version are server constants, not caller selections. Any change in
  grading semantics requires explicit version review; no dynamic code execution.
- Unique uq_practice_assessment_identity:
  {userId:1,attemptId:1,rubricId:1,rubricVersion:1,graderId:1,graderVersion:1}.
  Default _id only otherwise; defer history/analytics indexes without consumers.
- requestFingerprint binds owner, immutable attempt/request identity, selected
  reviewed definition and grader version. No repeat answer copy/hash is needed.
  Proposed exact UTF-8 JSON array: ["F038-assessment-v1", userId, attemptId,
  attemptRequestFingerprint, questionId, conceptId, questionRevision,
  contentFingerprint, rubricId, rubricVersion, rubricDefinitionFingerprint,
  graderId, graderVersion]. Correlation ids, wall-clock values and fences are not
  request identity; changing them cannot force a second logical assessment.
  evaluatedAt is server-owned and retained on replay; no assessment mutation or
  erasure API. Digests remain private and potentially identifying.

### 11.5 Transactions, idempotency and revocation races

Before grading, verify the attempt through primary majority reads and strict F036
record validation; no draft/receipt/client claim substitutes for durable storage.
Then use a bounded primary snapshot transaction, reloading that owned attempt,
current content, reviewed version, authority, provenance and eligibility. Reuse
the existing qualified-question ancestry pipeline without changing it.

Every authorized grade or replay must conditionally increment decisionFence on
the same APPROVED authority row using the observed fence/version/definition.
Revocation conditionally updates that same row and inserts its immutable audit
event in one transaction. A read-only snapshot of approval is insufficient:
without the shared write, revocation can commit while stale grading still commits.
Fence overflow, inconsistent authority or failed comparison refuses without grade.

The shared write establishes commit ordering: revocation that commits first makes
grading abort/retry and refuse; grading that commits first may leave a historical
diagnostic assessment, but later revocation prevents fresh use/replay. Never claim
retroactive deletion. Fresh postcommit checks may suppress a result even when its
diagnostic row already committed. The fence is not a completion counter.

Check the unique assessment identity in the same transaction. An exact existing
fingerprint replays its immutable id/outcome/time only after fresh authorization,
bindings and fence authorization; it neither inserts nor changes an assessment.
Different fingerprint under that identity is conflict, never overwrite/upsert.
Concurrent identical calls converge via the unique index and known-conflict retry.
Replay may advance the authority fence; F036 attempts/F037 progress stay unchanged.

For a new result, run B1 on authoritative values and insert the assessment in the
same transaction as the fence update. Approval/revocation state and required audit
events likewise commit atomically. Failed audit/fence/assessment writes roll back;
no success is inferred from a port, write invocation or unacknowledged operation.

Recommend the existing F036-style total 10-second budget with at most three body
executions and a two-second proof reserve, one coherent transaction timeout,
snapshot reads and majority+journal writes. Do not add conflicting operation-level
timeoutMS overrides inside the transaction. Bound all external readiness/proof
reads and cleanup; never retry an unknown commit automatically as a new grade.

After acknowledged commit, obtain exact owned majority proof, verify record and
authorization provenance, then recheck current actor/reviewer, authority and
publication/revision eligibility. An uncertain commit/proof returns no assessment
result and no answer; a separate explicit same-identity call may resolve it.
Missing/incorrect/unverifiable declared indexes/topology fail closed; no startup
provisioning or bypass. No transaction can make account/content revocation globally
instantaneous across arbitrary external edits; document observed boundaries.

### 11.6 Diagnostic timing, results and privacy

Grade only through explicit internal calls after durable F036 submission, never
inside or automatically after its existing unlock handler. Preserve F036 majority
attempt/progress commit before answer disclosure and its LOCAL-only restriction.
B2 failures cannot turn a saved attempt into transient unlock or block/reorder the
existing route. Other types remain ungraded and all original scores stay null.

Every assessment stays DIAGNOSTIC. No Stage A adapter, VERIFIED completion metadata,
section completion, pass entitlement, F037 score/count mutation or F039 signal.
F036 can already reveal the solution, so a later correct literal may be copied.
Disclosure exposure/coverage/score-selection policy must be approved before any
assessment becomes completion evidence; do not retroactively promote B2 history.
Grading alone never establishes Concept or Topic completion or mastery.

Proposed internal result allowlist: id, attemptId, purpose=DIAGNOSTIC, outcome,
nullable score, nullable refusalCode and canonical evaluatedAt. It is not an HTTP
DTO or authentication token. No answer/explanation/rubric/fingerprint is returned.
Use existing sanitized auth/validation/hidden-resource errors; propose internal
PRACTICE_ASSESSMENT_CONFLICT (409) and PRACTICE_ASSESSMENT_UNCONFIRMED (503) only
with separate canonical approval. Readiness/storage faults use DEPENDENCY_UNAVAILABLE.
Do not log raw driver/validation errors, tokens, answers, rubric definitions or
private hashes. Audit events contain only approved actor/resource/version/action/
correlation metadata, never text values or private definition fingerprints.

Revisions or terminal revocation make old assessments unusable for fresh results;
preserve their historical records and validate current authority on consumption.
No generic score-only reader may bypass these checks. F036 fingerprints cannot
reconstruct old solutions; never grade a mismatched old attempt against today's
rubric. No user-selectable account identity or cross-account lookup information.

P7 remains a blocker for persistent operation: determine retention for rubric
solutions, diagnostic scores, audit provenance and abandoned drafts; coordinated
account/attempt/assessment erasure; backup treatment; access/export/deletion and
legal holds. Do not promise indefinite retention, silently add TTL or manufacture
an erasure exception to append-only application guards. Initial verification must
use disposable synthetic data only, never demo/Atlas/production databases.

### 11.7 Exact proposed canonical additions - NOT APPLIED

No PRD amendment is required: B2 remains diagnostic and does not claim PRD Topic
completion. The following additions are proposed verbatim for a separate owner
decision; no canonical document is edited during this planning gate.

Proposed API_DESIGN.md addition:

> F038 Stage B2 proposes an internal LOCAL-only, explicitly invoked diagnostic
> grading service. No new HTTP endpoint, Admin UI, client rubric input, submission
> hook or public grading DTO is added. Existing access-token validation and fresh
> account checks authorize independent Admin rubric review and Student-owned
> attempt grading. Server-loaded approval provenance, exact content/rubric binding
> and serialized revocation are mandatory; approval flags alone do not authorize.
> F036 unlock/receipt/secrecy/no-store contracts and F037 activity-only GET remain
> unchanged. Diagnostic grading never returns correct answers or establishes
> completion eligibility. Uncertain assessment commit/proof returns no result.
> New internal errors are PRACTICE_ASSESSMENT_CONFLICT (409) and
> PRACTICE_ASSESSMENT_UNCONFIRMED (503), with sanitized fixed messages. Existing
> generic validation/auth/hidden-resource/dependency conventions remain in force.
> No production release or persistent database provisioning is authorized.

Proposed DATABASE_DESIGN.md addition:

> F038 Stage B2 proposes practiceRubricVersions (immutable OUTPUT definitions),
> practiceRubricAuthorities (review provenance, terminal revocation and shared
> decision fence) and practiceAssessments (append-only DIAGNOSTIC results), with
> exact proposed fields/indexes in F038 Section 11.4 subject to owner approval.
> They extend the canonical schema; they are not implemented by Stage A/B1.
> studentProgress remains the canonical completion summary and F037 remains
> activity-only. F036 practiceAttempts remain immutable SUBMITTED/null-score
> records; diagnostic grading neither changes them nor stores answer copies.
> Independent current-Admin review and approval/revocation audit records are
> transactional; grading/replay and revocation serialize through the same
> authority write fence. Unique assessment identity and majority-confirmed
> transaction/proof are required. Missing indexes or uncertain durability fail
> closed. No automatic provisioning, migration, history promotion, completion
> persistence, grading-driven disclosure or F039 behavior is authorized. Retention,
> coordinated erasure/backups and any persistent use require separate approval.

Proposed security-audit extension, requiring both canonical and scope approval:
category CONTENT_APPROVAL; resourceType PRACTICE_RUBRIC; actions
PRACTICE_RUBRIC_AUTHORED, PRACTICE_RUBRIC_APPROVED and PRACTICE_RUBRIC_REVOKED.
Use the existing append-only auditLogs collection with strict event-specific
metadata {rubricVersion}; actorId derives from authenticated current Admin,
resourceId identifies the immutable definition, and requestId/time are validated
server correlation data. Insert authority/audit changes atomically and retain
event ids as provenance. Preserve all existing AUTH/USER_ADMIN schemas and events.
No raw answers, fingerprints or generic arbitrary metadata in audit records.

This addresses Database Design's append-only Admin/security trail and approval/
audit transaction requirements. Merely replacing that trail with a mutable
authority flag would be a canonical departure, not an acceptable implicit shortcut.

### 11.8 Provisional inventory and identified missing scope

| Operation | Exact proposed path | Responsibility |
| --- | --- | --- |
| CREATE | apps/api/src/modules/practice/practice-rubric.model.ts | Proposed immutable-version and authority schemas/indexes, strict mutation boundaries. |
| CREATE | apps/api/src/modules/practice/practice-rubric.repository.ts | Authorized review/revocation persistence, provenance/readiness and shared fence operations. |
| CREATE | apps/api/src/modules/practice/practice-assessment.model.ts | Proposed private append-only diagnostic record and identity index. |
| CREATE | apps/api/src/modules/practice/practice-assessment.repository.ts | Bounded transactional owned attempt/readiness/assessment/proof operations. |
| CREATE | apps/api/src/modules/practice/practice-grading.service.ts | Existing JWT/current-role validation, internal Admin lifecycle, Student ownership and B1 orchestration; no route. |
| CREATE | apps/api/tests/practice-grading.test.ts | Focused model/repository/service/auth/audit/race/DTO unit fixtures with mocks. |
| CREATE | apps/api/tests/practice-grading.integration.ts | Prepared disposable persistence/index/concurrency/rollback verification; execution separately gated. |
| MODIFY | docs/features/F038-completion-rules.md | Owner decisions, implementation boundary and eventual actual evidence. |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md | Partial B2 evidence/status only, not whole-feature completion. |
| MODIFY | docs/API_DESIGN.md | Separately approved exact internal-boundary/error/audit additions, not an endpoint. |
| MODIFY | docs/DATABASE_DESIGN.md | Separately approved new collections/indexes/provenance/diagnostic/privacy contract. |

**Two additional existing paths are necessary for the recommended audit design:**

- apps/api/src/modules/audit/audit.model.ts: currently only AUTH/USER_ADMIN actions
  and USER resources are supported. Add the proposed narrowly discriminated rubric
  event category/actions/resource/metadata without weakening old event validation.
- apps/api/src/modules/audit/audit.repository.ts: add a typed transactional rubric
  audit writer; do not bypass the model with raw arbitrary audit inserts.

Recommend an explicitly approved 13-path implementation boundary: the provisional
11 plus these two. This plan does not approve that expansion. If the owner retains
11, audit-compliant implementation remains BLOCKED; do not omit audit writes or
reinterpret approval metadata as an audit trail. No extra audit index is proposed;
existing _id permits exact receipt proof. Focused/new and relevant existing audit
tests must cover compatibility; any necessary old-test edit needs scope approval.

No new dependency, infrastructure, environment variable, role, endpoint, UI, shared
package or existing auth/User/Practice/F037 model modification is proposed. Reuse
the existing MongoDB connection, token verifier, minimal User projections, F021
qualified ancestry and B1 grader. Additional files or changed auth/session/routing
contracts discovered during implementation require STOP and owner approval.

### 11.9 Verification plan - NOT_EXECUTED

After implementation approval, plan focused unit/model/repository/service cases:

1. Invalid/expired/forged tokens, fabricated AuthContext/approval flags, disabled/
   suspended/unverified/wrong-role actors, independent reviewer mismatch and missing
   second Admin fail closed. No self-approval or arbitrary cross-account grading.
2. Strict immutable version fields, reviewed definition/digest binding, unknown
   properties, unsupported types/strategies, tampered/missing provenance and audit
   rollback. No accidental extraction of a generic Markdown solution.
3. Actual authority fence races in both commit orders: grade before revoke and
   revoke before grade; replay after revocation; fence overflow and reviewer disable
   observed before/after commit. No claim of impossible instantaneous revocation.
4. Owned majority F036 attempt identity, rejected drafts/fake receipts, full
   published ancestry, question/Concept/public/private/rubric mismatches and stale
   revisions. Rejected submissions/authorization failures produce no assessment.
5. Correct/incorrect diagnostic outcomes, supported INVALID_ANSWER/null-score
   refusal, exact DTOs, no answer copies/logs and no grading-driven disclosure.
6. Same-identity replay retains record/time, changed fingerprint conflicts,
   concurrent identical/different requests, unique-index refusal, bounded conflict
   retries, summary/attempt nonmutation and no Stage A/F039 evidence promotion.
7. Majority commit and owned proof, missing/incorrect proof, unknown commit,
   rollback of audit/fence/assessment writes, cleanup/session failures and explicit
   same-identity resolution without new-attempt or automatic-grade retries.
8. Existing auth/audit/Practice/attempt/progress/policy regressions; API build,
   TypeScript, lint, formatting, UTF-8/LF, scope/security and formal source-diff
   review with actual CRITICAL/HIGH/MEDIUM/LOW file/line findings.

Prepare, but do not execute until separately authorized, disposable MongoDB
integration for the proposed schemas, exact indexes, majority/readiness/proof,
independent approvals/audit, revoke/grade concurrency, idempotency and rollback.
Reuse F035-F037 native-handle/Job ownership, microsecond timestamp normalization,
fresh storage, 127.0.0.1:27018, f021-test and deeplearner-f021-test safeguards;
require writable PRIMARY and empty target before fixtures/index provisioning.
Protect 27017/demo/development baselines and verify graceful cleanup, empty Job,
released port/handles and owned-storage disposal. Never provision persistent indexes.

B2 adds zero browser cases. All 141 existing cases remain NOT_RUN; historical
F022/F024/F029/Windows limitations and nontransferable exceptions remain intact.
No browser/infrastructure troubleshooting, manual-smoke PASS or new exception.

### 11.10 Planning outcome and next owner gate

PLAN READY FOR OWNER DECISION; implementation readiness remains conditional on
B2-P1-P8, the exact proposed canonical amendments, the audit event contract and
the recommended 13-path scope. No schema/index/implementation is approved by this
section. P7 must be resolved before any persistent/live operation; a bounded
synthetic disposable integration can be separately authorized first.

The smallest next gate is owner disposition of this B2 plan and canonical/scope
decisions, followed only then by a distinct implementation/offline approval.
Database execution requires another explicit guarded approval. Stage C completion,
section-evidence producers, qualifying score/coverage/disclosure rules, policy/
Concept revision lifecycle and privacy/release readiness remain later dependencies.
Keep F001-F037 APPROVED_COMPLETE, F038 IN_PROGRESS, F039 NOT_STARTED. Nothing in
this plan authorizes paid/cloud tools, new infrastructure, deployment or Git writes.
STOP after documentation-only verification and owner report.

## 12. B2 architecture reconciliation - OWNER PLANNING GATE ONLY

**Authorization:** The owner conditionally approved B2 directions and the proposed
13 paths for architectural planning only. This gate appends findings here; no
schema, canonical edit, implementation, status change or execution is authorized.
Section 11 remains historical proposed design. The mapping below controls how
the new owner labels relate to its different original numbering.

**Outcome:** P1-P8 substantive reconciliation PASS; implementation scope BLOCKED
by one confirmed compatibility-test path outside the 13-path proposal. No
substantive conflict with the owner directions was found. Do not implement or
silently expand the list. The scope discrepancy is recorded in Section 12.5.

### 12.1 Exact owner-direction mapping and reconciliation

| Current owner direction | Exact original plan mapping | Reconciliation |
| --- | --- | --- |
| P1 - Immutable rubric definitions/bindings | Original B2-P1; Sections 11.3-11.4 | PASS: insert-only version bodies bind question/Concept, public questionRevision, private contentFingerprint, strategy and explicit rubric id/version. No implicit evaluation object or official-answer extraction. |
| P2 - Independent current-Admin review/provenance | Original B2-P2; Sections 11.3, 11.7 | PASS: verified/current author and different verified/current Admin reviewer; server-recorded actor identity and transactional audit receipt. No self-approval exception is inferred. |
| P3 - Terminal revocation/shared transactional fence | Original B2-P3; Sections 11.4-11.5 | PASS: APPROVED -> REVOKED only; approval identity is immutable. Grade/replay and revoke conditionally write the same authority fence. New review/version is needed after revocation. |
| P4 - Separate append-only diagnostic assessments | Original B2-P1/P4; Sections 11.4, 11.6 | PASS: linked owned majority-confirmed F036 attempt; purpose=DIAGNOSTIC; no historical attempt mutation or F037 update. |
| P5 - Identity/idempotency/concurrency/durable proof | Original B2-P4/P8; Section 11.5 | PASS: exact unique assessment identity, deterministic request fingerprint, bounded known-conflict retries, majority+journal commit and owned majority proof; uncertainty returns no result. |
| P6 - Verified internal callers, no client authorization | Original B2-P5; Section 11.3 | PASS: existing JWT verification plus current eligible account; LOCAL-only internal methods, Admin rubric lifecycle and Student self-owned diagnostic grading. No request-supplied role, approval, rubric body or score trusted. |
| P7 - No disclosure/progress/completion/mastery | Original B2-P6; Section 11.6 | PASS: existing F036 ordering unchanged; no answer output, Stage A VERIFIED adapter, completion, score-summary mutation or F039 functionality. |
| P8 - Disposable data/indexes/privacy prerequisites | Original B2-P7/P8; Sections 11.4-11.6, 11.9 | PASS: explicit indexes and readiness, no persistent provisioning; separately approved disposable verification only. Retention/erasure/backups remain unresolved release/live-use gates. |

The label differences are not competing requirements. Original P7 concerned
privacy, while current owner P7 concerns diagnostic boundaries; both obligations
remain. Neither renumbering nor conditional planning approval authorizes a schema
or relaxes any original fail-closed boundary. Reviewer eligibility at grading
remains the conservative Section 11.3 recommendation, not a guarantee of globally
instantaneous account revocation; disposition belongs in implementation approval.

### 12.2 Audit architecture and existing-mechanism compatibility

Use existing auditLogs, not a parallel unrestricted logger or a replacement
approval flag. Proposed typed writer name: appendRubricAudit. Its input is a closed
union of the following events plus actor/definition/version/correlation identity;
it never accepts arbitrary category, resource type, metadata or document bodies.

| Event | actorId | resourceType / resourceId | Required subject relationship |
| --- | --- | --- | --- |
| PRACTICE_RUBRIC_AUTHORED | Authenticated current Admin author | PRACTICE_RUBRIC / immutable practiceRubricVersions._id | actor equals the definition authorId; draft version and audit insert commit together. |
| PRACTICE_RUBRIC_APPROVED | Authenticated independent current Admin reviewer | PRACTICE_RUBRIC / same immutable definition id | actor differs from authorId and equals authority.reviewerId; authority and approval receipt commit together. |
| PRACTICE_RUBRIC_REVOKED | Authenticated current Admin revoker | PRACTICE_RUBRIC / same immutable definition id | actor equals authority.revokedBy; terminal state/fence change and revocation receipt commit together. |

Common event fields: category=CONTENT_APPROVAL, action, actorId, resourceType,
resourceId, requestId, metadata exactly {rubricVersion}, and server-created UTC
createdAt. Both identity references are required genuine ObjectIds for these
events. resourceId is the definition's _id, not its stable rubricId or an Admin/
Student id. The target author is obtained through that immutable definition;
there is no new subjectId field or unrelated account identity in audit metadata.
Any currently authorized Admin may revoke; revocation never approves a version.

This fits the canonical actor/resource audit model, but requires deliberate
discrimination in audit.model.ts. The current model validates actorId==resourceId
for known User events, requires USER resources, and applies Auth-specific source
metadata rules. Keep those old invariants exactly for AUTH/USER_ADMIN. A new
rubric-only branch must validate its own exact category/action/resource/metadata
combination; simply disabling the equality/source checks globally is prohibited.
Keep User resource references for old events; make the new reference explicitly
point to the rubric-version model without treating Mongoose refs as authorization.
No free-form reason, answer, token, expected literal or private hash is added.

The repository writer requires the caller's active ClientSession/transaction; no
optional session, fire-and-forget call or fallback to an independent audit insert.
The service obtains identities from verified/current actors and authoritative
records. The writer constructs only the fixed allowlisted fields, returns its
server-generated audit id, and cannot be invoked through a public route. Existing
Auth/User writer signatures and their transaction behavior remain unchanged.

ApprovalAuditId/revocationAuditId must resolve to the exact category/action,
actor, definition resource, rubricVersion and server timestamp/correlation record
expected for that operation. Verify the authored event through a bounded resource-
index read as needed; no new schema field/index is necessary solely for that read.
Missing, duplicate, mismatched or unverifiable provenance fails closed. No whole
audit document or unrelated actor history is returned to a grader or Student.

Authorized reads are confined to internal provenance checks with explicit
projections and expected resource/event predicates. No public/Admin audit-browsing
API, unrestricted audit repository read method or new audit-reader permission.
Privileged database administration remains outside the application trust boundary.

Current immutable:true fields alone do not make auditLogs database WORM. Proposed
implementation should reject supported model update/replace/delete/bulk mutation
paths and non-new saves, while preserving all existing valid append operations.
This is enforcement of the canonical application append-only rule, not Windows/
MongoDB permission changes or protection against privileged raw database writes.
Keep existing indexes and automatic creation disabled; test both old and new event
validation and mutation boundaries before claiming enforcement is implemented.

If required audit persistence/validation fails, abort the entire draft/approval/
revocation transaction: no success, independent audit fallback, new authority or
partial revocation. A grading transaction cannot commit without valid approval
provenance and its shared fence write. Uncertain commit/audit/majority proof returns
a sanitized failure and no new authorization or grading result; an explicit same-
identity resolution may later observe the committed state. No automatic new event
or duplicate assessment is created to conceal uncertainty. Exact logical replays
retain their original event ids/times and must not append duplicate audit events.

### 12.3 Canonical amendment inventory (PROPOSED, NOT APPLIED)

The proposals below supplement the exact wording in Section 11.7. All remain
subject to separate canonical-edit/implementation approval. Preserve historical
contracts rather than rewriting their old evidence. Full approved field/index
tables must live in the canonical Database Design when adopted, not solely in a
feature-plan backreference. No canonical file is modified by this reconciliation.

| Exact document/section | Existing contract | Proposed amendment and reason | Impact / current owner direction |
| --- | --- | --- | --- |
| PRD sections 14-15, 23-24 | Passing practice; preserved attempts; submission precedes disclosure. | No amendment. Diagnostic assessment is not Concept/Topic completion or a change to answer unlock. | Preserve; P4/P7. |
| API_DESIGN.md new F038 Stage B2 internal diagnostic boundary after Stage A | No Stage A HTTP/adapter; F036 LOCAL durable unlock and F037 five-field activity GET. | Append Section 11.7's internal-only boundary, verified caller/ownership rules, no client rubric input, diagnostic result/error contract and no route/disclosure changes. | Additive internal contract; P1-P7. No public endpoint or public DTO break. |
| API_DESIGN.md section 25 Audit Events | Auth/User auditLogs categories AUTH and USER_ADMIN with sanitized metadata. | Append CONTENT_APPROVAL with the three rubric events, actor/definition references, exact rubricVersion metadata, required transactional persistence and internal read boundaries. Keep every existing event/constraint. | Additive event vocabulary; P2/P3/P6. Internal export-list test adjustment identified below. |
| DATABASE_DESIGN.md section 4 Collection Catalog | practiceAttempts, studentProgress, contentApprovals and auditLogs exist in the design; new B2 collections do not. | Add practiceRubricVersions, practiceRubricAuthorities and practiceAssessments catalog entries; declare their ownership/private diagnostic roles. | New additive architecture requiring explicit adoption; P1/P3/P4. No alternative canonical completion store. |
| DATABASE_DESIGN.md section 6 Major Collection Schemas / new F038 B2 refinement | F030 evaluation deferred; F036 exact immutable SUBMITTED/null-score records; F037 exact activity-only schema. | Add the three full Section 11.4 schema tables and cross-record provenance/binding rules, without accepting evaluation in practiceQuestions or altering attempts/progress. | Additive storage; P1/P2/P4/P6/P7. No old-row migration. |
| DATABASE_DESIGN.md section 7 Supporting Collections: auditLogs, and section 8 auditLogs indexes | Append-only actor/action/resource/correlation/metadata/timestamp; existing actor/resource-time indexes. | Append exact rubric-event discriminants and application mutation guards. Existing Auth/User semantics and indexes stay unchanged; no generic logging surface. | Additive typed audit support; P2/P3/P6. |
| DATABASE_DESIGN.md section 8 Index Strategy / new B2 subsection | No new B2 indexes; automatic provisioning is disabled by existing refinements. | Declare the three exact unique definitions from Section 11.4, readiness checks and separately approved disposable creation only. No new audit index. | Additive schema prerequisite; P5/P8. No persistent provisioning authority. |
| DATABASE_DESIGN.md section 10 Transactions and Consistency Boundaries / F038 B2 refinement | Attempt/progress and content approval/audit atomicity are separate existing workflows. | Add approval/revocation audit atomicity, shared authority fence plus assessment transaction, bounded retry and owned majority-proof/uncertainty semantics. | Additive internal workflow; P2-P5. Existing F036/F037 transaction bodies unchanged. |
| DATABASE_DESIGN.md section 12 Completion and Mastery Rules | studentProgress is canonical completion summary; mastery is separate. | No rule change. Restate in B2 refinement that diagnostic assessments cannot establish eligibility or mutate summaries. | Preserve; P4/P7. No F039 behavior. |
| DATABASE_DESIGN.md sections 15-16 and 18 Security/Privacy, Retention, Backup/Recovery / F038 B2 refinement | Private-data retention/erasure/release remain separately gated. | State new rubric solutions/assessment provenance are private; no answer copies in assessments or logs; no live/persistent use until retention, coordinated erasure and backups receive disposition. | Additive restrictions, not a retention-duration policy; P6-P8. |

Audit-specific exact proposed canonical paragraph (not applied):

> F038 B2 proposes CONTENT_APPROVAL events PRACTICE_RUBRIC_AUTHORED,
> PRACTICE_RUBRIC_APPROVED and PRACTICE_RUBRIC_REVOKED in existing auditLogs.
> actorId is the verified current Admin; resourceType is PRACTICE_RUBRIC and
> resourceId is the immutable rubric-definition id. Metadata is exactly
> {rubricVersion}. Independent review, actor/resource binding, active transaction
> participation and provenance validation are mandatory. Required audit failure
> rolls back the associated operation; uncertain proof confers no authorization.
> Old AUTH/USER_ADMIN event fields, metadata and subject-equality constraints remain
> unchanged. No sensitive text/hash logging, unrestricted writer, audit-read API,
> database WORM claim or automatic index provisioning is introduced.

No new User role/account/session model, access-token scheme, new dependency,
environment variable, persistent index, external infrastructure or UI is needed.
Approval actor and Student grading owner use existing roles. Explicit new storage/
event semantics are architecture additions requiring approval, not implemented
clarifications or permission to weaken current authorization.

### 12.4 Security and verification readiness - DESIGN ONLY

The design can be tested independently using the proposed internal service and
existing B1 evaluator. It is not currently verified at runtime. Retain Section
11.9's unit and separately authorized disposable integration plan and add explicit
audit cases: actor != resource for rubric events but actor==subject for old User
events; exact metadata discrimination; missing audit/provenance and rollback;
transaction/session mandatory; repeat operations do not duplicate events; refusal
of supported audit mutation paths without touching real data.

Exercise both revocation/grade commit orders and stale snapshots; use real shared
document writes in disposable integration, not only mock flag changes. A revocation
that commits first prevents grading/replay; a grade that commits first may leave
a historical diagnostic record but cannot bypass subsequent current-authority
checks. Account disable/content edits remain bounded current checks, not a promise
of instantaneous global revocation. Same-identity replay, concurrent uniqueness,
majority proof, unknown commit, audit/fence/assessment rollback and cleanup are
mandatory. Failed authorization/index readiness never yields a grade or answer.

Reuse the F035-F037 owned native handle/Job/microsecond identity procedure only
after separate execution approval: fresh synthetic storage, 127.0.0.1:27018,
f021-test, deeplearner-f021-test, verified PRIMARY/empty target/exact indexes,
protected 27017/demo/development baselines and verified graceful cleanup. No
persistent provisioning, migrations or account creation outside disposable fixtures.
Review actual implementation diffs by Critical/High/Medium/Low severity after
approval; this document does not claim a new source review or passing test result.

No new browser cases: zero. Preserve 141 NOT_RUN, all prior exceptions and
F022/F024/F029/Windows limitations. No browser or infrastructure investigation.

### 12.5 Exact proposed count and confirmed scope discrepancy

Section 11.8's proposed 13 paths are confirmed as seven CREATE and six MODIFY:

| Operation | Exact path |
| --- | --- |
| CREATE | apps/api/src/modules/practice/practice-rubric.model.ts |
| CREATE | apps/api/src/modules/practice/practice-rubric.repository.ts |
| CREATE | apps/api/src/modules/practice/practice-assessment.model.ts |
| CREATE | apps/api/src/modules/practice/practice-assessment.repository.ts |
| CREATE | apps/api/src/modules/practice/practice-grading.service.ts |
| CREATE | apps/api/tests/practice-grading.test.ts |
| CREATE | apps/api/tests/practice-grading.integration.ts |
| MODIFY | docs/features/F038-completion-rules.md |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md |
| MODIFY | docs/API_DESIGN.md |
| MODIFY | docs/DATABASE_DESIGN.md |
| MODIFY | apps/api/src/modules/audit/audit.model.ts |
| MODIFY | apps/api/src/modules/audit/audit.repository.ts |

**Confirmed additional required path, NOT APPROVED:**
apps/api/tests/auth-audit.test.ts, lines 27-34, asserts Object.keys(repository)
equals the exact six existing writer exports. Adding the proposed typed
appendRubricAudit export will fail that assertion even if all old behavior is
preserved. It is an actual source-level scope gap, not a speculative test failure;
no test was executed. Section 11.8 explicitly required approval for old-test edits.

Recommend separate owner approval to add only appendRubricAudit to that expected
export allowlist, retaining every old action/category/metadata/index/subject
assertion. New behavior tests stay in the planned practice-grading.test.ts. Do
not delete/loosen the export check, hide an ESM export, repurpose an old Auth
writer or use a generic logger merely to fit the 13-path boundary.

That would make a proposed 14-path inventory: seven CREATE, seven MODIFY. This
reconciliation does not change Section 11.8 or authorize that expansion. If the
owner retains 13 paths with the proposed new writer, offline compatibility cannot
pass; implementation remains BLOCKED. No other required extra path, npm dependency,
service, role, configuration or infrastructure change was identified in this review.
Any newly discovered requirement must still stop for explicit scope approval.

### 12.6 Remaining operational decisions and next owner gate

Retention duration, coordinated account/attempt/assessment erasure, rubric-private
content/audit preservation, backups and production release remain unresolved.
Before any live/persistent operation, obtain owner disposition; do not silently
choose TTL, permanent retention, unrestricted reading or automatic erasure. Initial
verification can be separately approved with disposable synthetic data only.
Completion coverage, exposure/disclosure policy, genuine section evidence,
policy/Concept revisions and any completion workflow remain future F038 work.

Next gate: owner disposition of the confirmed auth-audit.test.ts discrepancy
(recommended 14 paths), exact canonical amendments and audit-enforcement details,
then a separate explicit B2 implementation/offline approval. Conditional planning
approval is not permission to modify canonical docs or code. Database execution
requires another guarded approval. Preserve F001-F037 APPROVED_COMPLETE, F038
IN_PROGRESS and F039 NOT_STARTED. STOP after this documentation-only reconciliation.

## 13. Stage B2 owner approval, implementation and offline evidence

### 13.1 Inventory and decision reconciliation - PASS

The owner explicitly approved reconciled B2-P1-P8, the additive canonical
amendments and the additional auth-audit.test.ts expectation. This supersedes the
historical Section 12.5 scope blocker; it does not erase that review. Audit model
and repository already existed and are MODIFY paths, not two additional creates.
The owner's nine creation candidates therefore reconcile unambiguously to seven
CREATE and seven MODIFY paths using the Section 12 inventory:

| Operation | Exact approved path |
| --- | --- |
| CREATE | apps/api/src/modules/practice/practice-rubric.model.ts |
| CREATE | apps/api/src/modules/practice/practice-rubric.repository.ts |
| CREATE | apps/api/src/modules/practice/practice-assessment.model.ts |
| CREATE | apps/api/src/modules/practice/practice-assessment.repository.ts |
| CREATE | apps/api/src/modules/practice/practice-grading.service.ts |
| CREATE | apps/api/tests/practice-grading.test.ts |
| CREATE | apps/api/tests/practice-grading.integration.ts |
| MODIFY | docs/features/F038-completion-rules.md |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md |
| MODIFY | docs/API_DESIGN.md |
| MODIFY | docs/DATABASE_DESIGN.md |
| MODIFY | apps/api/src/modules/audit/audit.model.ts |
| MODIFY | apps/api/src/modules/audit/audit.repository.ts |
| MODIFY | apps/api/tests/auth-audit.test.ts |

B2 changes fourteen paths. Cumulative uncommitted F038 work contains eighteen
unique paths because the prior eight-path Stage A/B1 work is preserved. Neither
count authorizes unrelated edits. No dependency, environment, configuration,
route, shared-package or infrastructure change was required.

| Decision | Implemented boundary |
| --- | --- |
| P1 | Strict immutable OUTPUT TEXT/EXACT_TEXT/NONE definitions; version and exact question/Concept/public-revision/private-fingerprint/definition binding. Structural validation does not grant approval or run the grader. |
| P2 | Existing signed access tokens plus current ACTIVE/verified Admin records; independent author/reviewer; server-created approval identity, timestamp and exact audit provenance. No boolean/caller authorization claim or client rubric accepted. |
| P3 | Terminal authority revocation; grading and replay both write the same conditional decisionFence as revocation inside the transaction. |
| P4 | Separate append-only DIAGNOSTIC assessments; majority-read owned immutable F036 attempts with recomputed request fingerprint; no attempt or studentProgress writer. |
| P5 | Exact unique definitions, authority and six-part assessment indexes; index/transaction readiness refusal; bounded body retries; majority/journal commit followed by owned primary-majority proof and renewed authorization/binding checks. |
| P6 | Disconnected internal service factory; server APP_ENV LOCAL guard and verified existing tokens/current identities. No route, UI, scheduler, generic audit reader or live submission integration. |
| P7 | Result is diagnostic only and cannot produce Stage A verified evidence, reveal solutions, mutate progress/completion or implement F039. |
| P8 | Prepared synthetic disposable integration only; no database execution/provisioning. Retention, coordinated erasure, audit preservation and backups remain owner-gated release prerequisites. |

### 13.2 Implemented service, audit and consistency boundaries

Internal author/approve/revoke/gradeDiagnostic commands have strict allowlisted
input shapes. Identity comes from the existing token verifier and a current
server-side User read, never from command bodies. Authored expected text is bounded
to 10,000 UTF-16 code units, nonblank and well-formed, preserving exact whitespace.
Only after approval provenance and current bindings pass does grading call B1.
Valid results are 100/0; an invalid saved student string may produce a diagnostic
REFUSED with null score, not invented passing evidence.

Author command identity is server-derived from the actor and bounded correlation
id using SHA-256 domain separation (F038-rubric-command-v1); a new rubric family
uses F038-rubric-family-v1. Existing families receive the next immutable version.
An identical logical retry retains the original definition/event; changed content
under that command identity conflicts. Approval/revocation replay retains original
provenance. Assessment identity is the approved account/attempt/rubric/version/
grader/version compound key; changing correlation ids cannot create duplicates.

All three fixed CONTENT_APPROVAL events use the existing auditLogs collection,
exact actor/immutable-definition references and metadata {rubricVersion}. The new
writer requires an active transaction. Required audit failure aborts the associated
operation. Existing six writer exports, signatures, bodies and Auth/User event
constraints are preserved. The only auth-audit.test.ts change adds appendRubricAudit
to the exact export expectation; all six prior tests and assertions remain.
Supported model mutation paths are rejected for immutable definitions, assessments
and audits. The private authority CAS is the sole intended fence/revocation writer.
These application guards are not database WORM or protection from privileged raw
database administration.

Transactions inherit one coherent driver timeoutMS policy with snapshot reads,
majority/journal writes, a ten-second operation budget, at most three body entries
and a two-second proof reserve. Driver operations are bounded; no absolute kernel
or session-cleanup deadline is claimed. Unknown commit labels, absent owned proof,
stale approval/content or cleanup failures suppress the result. A later explicit
same-identity command can resolve already committed state without duplicating it.
No error payload/log contains expected or student text. Internal receipts expose
only the documented definition/authority fields or seven-field diagnostic result.

### 13.3 Offline verification - PASS; live verification NOT_RUN

Executed focused practice-grading.test.ts: **23 PASS / 0 FAIL**. Cases cover strict
commands, independent/current roles, forged claims, LOCAL-only use, author retries,
provenance/audit rollback, terminal revocation, both serialized fence orders,
bounded conflicts/deadline exhaustion, concurrent replay, uncertain-commit and
proof/session-cleanup faults, index refusal, ownership/revision/private bindings,
result secrecy, deterministic scoring/refusal and supported mutation boundaries.
Concurrency, rollback and driver-fault outcomes here use controlled stores; they
are not live MongoDB verification.

Relevant existing API regressions: **159 PASS / 0 FAIL**, across 25 files: access
tokens/authenticate, auth audit/registration/routes, login/logout/recovery/Google
auth/profile services and routes, Practice question/attempt models/repository/
service/routes, progress model/service/routes, Stage A policy and B1 grader.
There are **182 distinct passing tests** including the 23 new tests; overlapping
earlier focused/audit runs are not additional distinct coverage.

API build, source/test TypeScript (including the prepared integration file),
repository lint and approved TypeScript formatting PASS. Initial offline static
checks identified TypeScript generic/optional-session and fixture-literal typing
issues and a cleanup-finally lint error; these were corrected within the allowlist
before passing verification. The integration cleanup now preserves the original
failure, independently attempts owned collection/connection release and reports
all failures after finally rather than masking them. The sandbox's tsx user-lookup
limitation required the already supported ordinary-user test execution context;
no privilege, permission, dependency or application configuration change occurred.

Separate final source/security review: **0 unresolved CRITICAL/HIGH/MEDIUM/LOW**.
Two LOW implementation issues were corrected before the final focused/static
passes: over-limit draft validation could continue its Unicode scan (now an early
bounded guard in practice-rubric.model.ts:27), and model validation unnecessarily
constructed a synthetic approved B1 input (now structural-only rubricText and
definition validation in practice-rubric.model.ts:22 and :98). Actual grading
still occurs only after verified authorization in practice-grading.service.ts.
No Critical, High or Medium finding was identified. No product/browser behavior
is inferred from this source review.

Exact scope, strict UTF-8/LF and whitespace/security checks apply to all fourteen
B2 paths; hashes of all pre-existing files outside this boundary remain unchanged.
No secrets, generated data, browser artifacts, temporary diagnostic package or
new environment value is included. Canonical changes are additive internal B2
schemas/indexes/audit/transaction contracts; PRD and existing public routes/DTOs,
F036 immutable/null-score attempts and F037 activity-only semantics are unchanged.

### 13.4 Prepared integration and remaining owner gates

practice-grading.integration.ts prepares **ten child scenarios plus one parent**;
all **NOT_RUN**. It first requires a separately authorized external owned-process
launcher, fresh storage, verified protected baselines, retained handle/Job/
microsecond identity checks and the exact loopback f021-test disposable target.
The test then independently checks PRIMARY, replica membership, database identity
and emptiness before creating only its owned fixtures/approved indexes. No runner
or MongoDB process was launched during this offline gate.

Prepared live coverage includes approval/audit atomicity, missing/incorrect index
refusal, current reviewer checks, owned grading, concurrent idempotency, content
and audit invalidation, controlled audit/proof failures, real shared-document
grade/revoke fencing, and unchanged attempt/progress records. The controlled
postcommit proof failure is not a claim of a live unknown-driver-commit test.
External supervision must verify process/Job/port/handle/storage cleanup and
protected baselines after collection/connection cleanup. Database operations,
index provisioning or execution require another explicit owner approval.

Browser additions: **zero**; existing **141 NOT_RUN** and all F022/F024/F029,
Windows teardown and historical feature-exception limitations remain unchanged.
No earlier browser exception transfers to F038. This offline stage supplies no
completion-qualifying evidence and does not finish F038. Trusted section evidence,
grading-to-completion policy/selection, privacy/erasure/backups, completion
persistence in canonical studentProgress and student workflow remain deferred.
F038 stays **IN_PROGRESS**; F001-F037 remain APPROVED_COMPLETE; F039 remains
NOT_STARTED. Next gate: owner review of this B2 offline evidence, followed only
if separately authorized by a guarded disposable MongoDB verification gate.

## 14. B2 guarded integration authorization preflight - BLOCKED

The owner authorized one guarded disposable MongoDB execution after the Section
13 offline results, with index provisioning limited to the approved B2 rubric,
assessment and audit definitions plus previously approved attempt indexes. Source
inspection found an additional required collection index not named by that gate:

- practice-grading.integration.ts:107 calls StudentProgress.createIndexes().
- progress.model.ts:27-31 defines uq_student_progress_owner_concept, UNIQUE
  {userId:1,conceptId:1}, on studentProgress. This is a progress index, not an
  index on practiceAttempts or one of the three B2 collections.
- practice-attempt.repository.ts:136 calls progressRepository.ready() before
  durable fixture submission; progress.repository.ts:46-61 verifies the exact
  progress index and fails closed without it. The prepared suite therefore cannot
  omit that provisioning while preserving its assertions and F037 readiness rules.

Under the current gate's exact index-provisioning restriction, do not silently
broaden the list or infer that the historical F037 execution approval transfers
to this new run. Do not remove the existing readiness requirement or change the
test. Minimal next approval: explicitly authorize this one existing unique
studentProgress index only in the verified empty disposable
127.0.0.1:27018 / f021-test / deeplearner-f021-test target, alongside the already
listed indexes, then authorize one guarded invocation after fresh full preflight.
No application, model, assertion, canonical-document or dependency change is
required to resolve this authorization gap.

Actual outcome: **BLOCKED before process startup/database access**. Integration:
**0 PASS / 0 FAIL / 11 NOT_RUN**, comprising ten child scenarios and one parent.
Zero integration invocations or retries; zero index operations. No new MongoDB,
Node test/helper process, fixture, storage or connection was created. Ordinary-
user read-only inspection located the historical F037 ownership/cleanup evidence;
the fresh runtime native-handle/Job/PRIMARY/empty-target checks were NOT_RUN, not
inferred PASS. No current protected-baseline comparison was completed or claimed.
No process/database cleanup was needed, forced termination performed or exit code
observed for a test process. Persistent databases and development services were
not connected to, modified or targeted.

The precise blocker is index authorization, not a demonstrated application,
transaction, assessment, audit or process-ownership defect. Retain all Section
13 offline evidence; live B2 authorization/concurrency/durability/secrecy findings
remain NOT_RUN. No source/test correction or automatic rerun was made. Only this
feature evidence document changed in the gate. F038 stays IN_PROGRESS; F001-F037
remain APPROVED_COMPLETE; F039 stays NOT_STARTED. Existing **141 browser scenarios
remain NOT_RUN**. STOP pending the specific disposable-index/execution approval.

## 15. B2 corrected index allowlist and guarded integration - PASS

The owner explicitly added uq_student_progress_owner_concept, UNIQUE
{userId:1,conceptId:1}, on studentProgress to this execution's disposable index
allowlist and authorized one fresh guarded integration invocation. This resolves
Section 14's authorization blocker without changing the test, model, readiness
rules or historical blocked-preflight evidence. Only this F038 document is updated
in the repository for this verification gate. F038 remains IN_PROGRESS; no full
feature or production acceptance is implied.

Evidence directory:
.cache/f038-b2-integration-2026-10-19-17-04-01-4aae94/

### 15.1 Isolation and process identity - PASS

- Ordinary unelevated REDGOLDMARK42\Shreeji, PowerShell 7.6.7, enabled-admin false.
  An initial terminal launch failed before running the runner; the existing actual
  PowerShell 7 executable successfully ran the same guarded in-memory procedure
  through the supported ordinary-user execution context. No permission or Windows
  security setting changed and no extra MongoDB startup/integration invocation
  resulted from that launcher failure.
- Unchanged LocalProcessOwner.cs SHA-256
  8B8911A51A766DF3057570E2F926E1EFCDDD29A8271C41F0351DE036A32B8FB4.
  Fresh retained Job with KILL_ON_JOB_CLOSE/no breakaway; every child atomically
  entered the exact Job at creation. No PID-only process adoption/termination.
- Native retained and independent inspection handles identified MongoDB PID 20708,
  matching exact native FILETIME 134368832492638500. Native/CIM raw UTC creation
  values were both 2026-10-19T11:34:09.2638500Z. Integer normalization
  (UTC ticks / 10L) * 10L produced 639280064492638500 for both; no tolerance or
  asymmetric rounding. Raw observations remain in mongo-identity.json.
- Individually recorded PASS: PID/retained-handle identity; common-microsecond
  creation identity; exact executable path/name; parent identity/creation/path;
  GetOwner account; exact native Job membership through both handles; live state.
  Rechecked MongoDB before connection, suite and shutdown. Node helpers waited on
  their private stdin until the same identity checks passed before database/test
  code continued. Inspection handles were independently closed.
- Port 27018 initially free. Fresh GUID-owned non-reparse storage was empty before
  startup; owner.json records its exact root/storage/account/target boundaries.
  The observed listener was solely owned 127.0.0.1:27018. Initializer independently
  checked bind address, port, exact storage and replica-set arguments before
  initiating f021-test. It waited within a bounded readiness window for writable
  PRIMARY, then verified the sole 127.0.0.1:27018 member, allowed database names
  and empty deeplearner-f021-test before fixture/provisioning operations.
- No .env, NODE_OPTIONS, application credentials, Atlas or persistent URI was
  inherited. Child environments explicitly selected the approved loopback target.
  Protected MongoDB PID 5144 on 127.0.0.1:27017 was not connected to or targeted.
  Its PID/parent/creation/listener and both existing development Node identities
  were captured before/after, together with persistent demo-storage metadata.

### 15.2 Exact disposable index provisioning - PASS

Before database access, the initializer compared actual model-declared definitions
against the fixed approved collection/key/name/unique/options list. The exact F037
definition also passed existing verifyProgressIndexes. Server createIndexes oplog
evidence independently confirms the following ten secondary definitions only in
deeplearner-f021-test (index-definitions.json and index-operations.json):

| Collection | Approved secondary indexes provisioned |
| --- | --- |
| practiceAttempts | uq_practice_attempt_sequence UNIQUE {userId:1,questionId:1,attemptNumber:1}; uq_practice_attempt_idempotency UNIQUE {userId:1,idempotencyKeyHash:1}; ix_practice_attempt_owner_concept_time {userId:1,conceptId:1,submittedAt:-1}; ix_practice_attempt_concept_time {conceptId:1,submittedAt:-1}. |
| studentProgress | uq_student_progress_owner_concept UNIQUE {userId:1,conceptId:1}. |
| auditLogs | actorId_1_createdAt_-1 {actorId:1,createdAt:-1}; resourceType_1_resourceId_1_createdAt_-1 {resourceType:1,resourceId:1,createdAt:-1}. No new audit index. |
| practiceRubricVersions | uq_practice_rubric_version UNIQUE {rubricId:1,version:1}. |
| practiceRubricAuthorities | uq_practice_rubric_authority UNIQUE {rubricId:1,version:1}. |
| practiceAssessments | uq_practice_assessment_identity UNIQUE {userId:1,attemptId:1,rubricId:1,rubricVersion:1,graderId:1,graderVersion:1}. |

All observed definitions used v=2 with exact ordered keys and no unexpected partial
filter, collation or alternate options. Normal collection _id indexes remain
MongoDB defaults. The planned negative control dropped the disposable assessment
index, recreated its exact key/name nonunique to verify refusal, then restored
UNIQUE; those two additional createIndexes operations are separately identified
in the evidence, not new approved production definitions. No persistent index,
backfill or migration occurred; MongoDB's internal config/local bookkeeping is
confined to the same fresh disposable storage.

### 15.3 One integration invocation - 11 PASS / 0 FAIL

Invoked the existing practice-grading.integration.ts once using Node/tsx, after
verified ownership and a private stdin startup barrier. Zero invocation retries,
assertion changes or application fixes. The prepared suite reported **11 PASS /
0 FAIL / 0 NOT_RUN**, including its parent and these ten child scenarios:

1. Independent actual Admin review, self-approval refusal and transactional
   authored/approved audit provenance.
2. Live missing and incorrectly nonunique assessment-index refusal without results,
   followed by restoration of the exact unique definition.
3. Current reviewer DISABLED status refusal using the actual stored account.
4. Owned majority-confirmed F036 attempt grading with a diagnostic result, no
   returned answer/expectedAnswer and byte-equivalent attempt/progress records.
5. Concurrent same-identity replay returns the same receipt/evaluation time and
   leaves exactly one assessment.
6. Fresh unpublished-question refusal and changed private solution binding conflict.
7. Missing required approval audit fails closed.
8. Injected required audit failure rolls back an actual draft transaction.
9. Injected postcommit proof loss suppresses the result; explicit same-identity
   resolution retains one assessment.
10. Actual shared-authority-document grading/replay versus revocation race leaves
    terminal revocation, one diagnostic record/event and rejects subsequent replay;
    F036 attempts and F037 summaries remain unchanged.

Node-reported test duration: 2.15 seconds. Entire runner preflight/startup/suite/
cleanup/baseline-verification duration: **31.84 seconds**. The existing bounded
application transaction retry/concurrency logic remained unchanged. Positive
assessment transactions executed with snapshot reads, majority/journal commit and
owned majority proof before returning the diagnostic receipt. No grading-driven
correct-answer disclosure or Stage A completion evidence was introduced.

Evidence limits: live concurrent calls were replays of an existing assessment;
this is not a new live first-insert contention stress test. The race exercised
actual shared-document fencing but does not prove both commit orders occurred
in this single execution; both ordered cases retain offline evidence. The proof
fault was a controlled missing-proof injection, not real network/failover or
UnknownTransactionCommitResult injection. Changed solution binding was live;
the broader malformed-input, changed author-command payload, cross-owner identity,
model immutability, all index variants and rollback/failure combinations retain
their Section 13 offline evidence rather than being upgraded to live coverage.
Diagnostic results remain distinct from completion eligibility/mastery. No
historical attempt grading job, submission hook, endpoint or progress mutation
was installed or exercised.

### 15.4 Cleanup, preservation and next gate - PASS

The suite independently attempted owned collection cleanup and disconnected;
the shutdown helper verified zero remaining target collections and exact bind/
port/storage/replica identity before requesting graceful shutdown. Initialization,
integration, shutdown-helper and MongoDB retained-handle exit codes were all **0**.
Graceful shutdown PASS; **forced termination false; cleanup errors empty**.
Final owned Job active count **0**, port **27018 released**, all retained/inspection
handles closed, and only the receipt-verified GUID temporary root/storage removed
after resolved absolute-boundary and recursive non-reparse checks.

Protected MongoDB/development-process identities and listener were unchanged.
Persistent demo-storage metadata (111 entries) was unchanged. All **453 source
integrity pins** matched before this evidence-document update; no source, fixture,
test, canonical document, configuration or prototype file changed. Raw logs and
sanitized identity/index/job/baseline/result evidence remain under the evidence
directory. No offline suite was rerun; no browser, Git write, new dependency,
infrastructure, production operation or F039 work occurred.

No defect was observed in the executed suite. Retain the Section 14 blocked
preflight and Section 13's 23 focused / 159 regression / 182 distinct offline PASS
without combining live parent/child counts into those historical distinct totals.
B2 is ready for **separately approved review**, subject to the stated coverage
limits. F038 stays **IN_PROGRESS**, F001-F037 APPROVED_COMPLETE and F039
NOT_STARTED. Privacy/retention/erasure/backups and actual completion integration
remain deferred owner decisions. All **141 browser scenarios remain NOT_RUN**;
B2 adds zero and inherits no browser exception. STOP after this single guarded run.

## 16. Stage B2 final security, transaction and architecture review

**STAGE B2 FINAL REVIEW PASS — PARTIAL F038 FOUNDATION**

Owner-authorized final source/evidence review only. The complete Section 13.1
fourteen-path B2 change set was reviewed: seven new rubric/assessment/service/test
files and seven existing documentation/audit/test files. Existing Stage A/B1 work
is preserved, not counted as extra B2 scope. No tests, services, MongoDB, browser
or synthetic processes were executed during this review. Only this final-review
section is appended; roadmap, canonical documents, product, tests and configuration
are unchanged. F038 remains IN_PROGRESS, not READY_FOR_REVIEW or APPROVED_COMPLETE.

### 16.1 Findings and reviewed enforcement

Actual findings: **CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0**. No unresolved source,
security, transaction or canonical-architecture finding was identified in this
review. Section 13's earlier two corrected Low issues remain historical findings,
not new findings or unperformed verification. The references below identify
reviewed safeguards, not defect locations.

| Area | Source reviewed | Conclusion |
| --- | --- | --- |
| Caller/independent reviewer | practice-grading.service.ts:98, :429; practice-rubric.repository.ts:120 | Existing signed JWT verification and server LOCAL guard; current ACTIVE/verified role checks; independent author/reviewer; no client-selected authorization or self-approval. Preserve existing access-token/session semantics, not a new sid-based live-session guarantee. |
| Trusted immutable definition | practice-rubric.model.ts:22, :79, :123, :259; practice-grading.service.ts:125, :137, :329 | Strict bounded text and exact definition digest; server-loaded version; current publication/public revision/private solution bindings; new immutable version for edits. Reviewed authority records cannot be synthesized from approval flags. |
| Required audit provenance | audit.model.ts:146, :320; audit.repository.ts:19; practice-rubric.repository.ts:255 | Three fixed CONTENT_APPROVAL events, exact actor/definition/version metadata, active transaction required, mandatory provenance reads. Old six writer signatures/bodies and Auth/User constraints remain. Supported application mutations are rejected; no database WORM or privileged-write protection claim. |
| Terminal revocation/fencing | practice-rubric.repository.ts:201; practice-grading.service.ts:506, :584 | Conditional state/version/definition/fence write participates in the same transaction for grade, replay and revocation. Terminal REVOKED cannot be approved/restored through these methods. No snapshot-only authorization or whole-history deletion. |
| Attempt ownership/binding | practice-grading.service.ts:199, :227, :554 | Authenticated Student owns the majority-read durable F036 attempt; strict immutable SUBMITTED/null-score shape and recomputed request fingerprint. Question/Concept/type/public revision/private fingerprint must match the authoritative rubric and current published ancestry. |
| Assessment identity/secrecy | practice-assessment.model.ts:12, :50, :103; practice-grading.service.ts:276, :293, :588 | Exact unique account/attempt/rubric/version/grader/version identity, deterministic request fingerprint and preserved replay id/time. Strict diagnostic outcome union, no answer copies or completion-qualified fields; supported update/delete/bulk paths fail. |
| Durability/uncertainty | practice-assessment.repository.ts:186; practice-grading.service.ts:612 | One coherent bounded transaction timeout, snapshot reads, majority/journal commit, bounded body/conflict retries, primary-majority owned proof and renewed actor/reviewer/content/provenance checks. Unknown outcomes, invalid proof or session cleanup failure return no result. Explicit same-identity resolution repeats checks. |
| Prerequisites/privacy | practice-assessment.repository.ts:32, :94; practice-grading.service.ts:80, :237 | Exact three new unique indexes and transaction-capable PRIMARY required; no automatic provisioning. B1 receives authoritative values only after authorization. Fixed result/error allowlists, no sensitive logging, no grading-driven disclosure, no F036/F037 writer, completion adapter or F039 import. |

Current account/content authorization is observed at the documented bounded
boundaries; the review does not promise instantaneous revocation across arbitrary
external changes. Application model guards are not a database permission boundary.
Cleanup has failure propagation, not an absolute guarantee against kernel/network
stalls. These are retained design limits rather than newly relaxed safeguards.

Both new test files and the one-line auth-audit.test.ts export expectation were
reviewed. The original six audit exports/assertions remain intact. The integration
file retains exact disposable-target gates, synthetic fixtures, explicit index
provisioning, controlled negative states and independent collection/connection
cleanup attempts. No test assertion, timeout, retry policy or infrastructure was
changed during final review.

### 16.2 Canonical source-of-truth consistency - PASS

Compared the canonical diff with the prior F037 contracts, the retained Stage A
clarifications, PRD sections 14-15 and the explicit B2 Section 12 owner decisions.
Stage A additions in the cumulative diff are pre-existing approved work, not B2
scope expansion. The B2 amendments are approved additive architecture:

- API_DESIGN.md section 25 (:1312) adds the typed rubric audit vocabulary without
  changing authentication/User events. The B2 boundary (:1969) describes internal
  LOCAL-only operations, the seven-field diagnostic receipt and sanitized errors;
  it does not define a public grading endpoint, public DTO, UI or submission hook.
- DATABASE_DESIGN.md section 4 adds the three approved private collections; section
  7 (:425) extends typed audit semantics; section 8 (:606) declares exact new unique
  indexes; section 10 (:637) adds audit/fence/assessment transaction boundaries.
  The B2 refinement (:1044) supplies the exact schema/digest/provenance fields,
  diagnostic limitations and privacy prerequisites. No schema alternative replaces
  canonical studentProgress; F036 immutable null-score attempts and F037's
  activity-only schema/readiness/public contract remain unchanged.
- PRD completion requirements are not satisfied merely by these diagnostic scores.
  Existing submission-before-disclosure remains F036's separately enforced
  contract, not a new B2 side effect. No new grading route or runtime caller is
  registered in application source. No WORM, completion eligibility, mastery,
  persistent provisioning or production-readiness assertion is introduced.

No contradiction requiring a canonical correction was identified. Canonical
statements that provisioning/live verification require separate approval retain
that restriction; Section 15 records the one subsequently approved disposable run.
The roadmap's B2 offline paragraph remains historical offline evidence, not a
substitute for this document's later integration record. It was not edited here.

### 16.3 Retained verification and acceptance limits

Retained, not rerun: **23 focused PASS; 159 relevant API regression PASS; 182
distinct offline PASS; MongoDB 11/11 PASS including parent; ten approved disposable
secondary index definitions; build/TypeScript/lint/formatting/security PASS**.
Section 14's blocked index-allowlist preflight is preserved alongside the explicit
progress-index approval and Section 15 successful execution. Graceful cleanup,
all four child exit codes 0, empty Job, released port/handles, removed disposable
storage and unchanged protected baselines remain verified evidence.

Controlled postcommit proof-loss injection is **not real MongoDB failover testing**.
Unknown commit labels retain offline simulated evidence; no live lost-commit,
replica failover or network-partition test is claimed. Live concurrency covered
same-identity replay, not first-assessment insertion stress; the real shared-row
revoke race does not demonstrate both ordered outcomes in one execution. Earlier
offline ordered cases, broader identity/payload/index variants and mutation guards
remain distinctly offline. These coverage limits are retained for later integration
and release decisions, not hidden by the partial-stage PASS.

B2 adds **zero browser scenarios**. All **141 expected browser scenarios remain
NOT_RUN**, with F022/F024/F029 and primary-host Windows teardown limitations intact.
No browser PASS, transferred exception or production acceptance is granted.

### 16.4 Outstanding F038 work and next owner gate

This review accepts only the implemented local B2 foundation against its approved
boundary. It neither completes F038 nor authorizes another implementation stage.
Outstanding owner-approved design/delivery prerequisites remain:

- Trusted, revision-bound Read/Visualize/Example/Practice and optional Revise
  evidence producers; page visits/activity counts are insufficient.
- Completion-qualifying assessment/exposure policies, including treatment of
  answers already revealed by F036; no automatic promotion of diagnostic history.
- Score-selection, coverage, threshold-source and policy/revision rules; no
  first/latest/best selection is inferred from B2's binary grading.
- Completion persistence in canonical studentProgress, transactional lifecycle,
  manual-versus-automatic initiation, student API/UI and accessibility workflow.
- Revision invalidation and completion revocation; rubric authority revocation
  alone does not implement the Concept-completion lifecycle.
- Retention, coordinated erasure, account/attempt/assessment/audit preservation,
  backups, persistent index/topology provisioning, browser regression and separate
  release-readiness approval before production use.

Next gate: owner review/disposition of this partial B2 result and separately
approved bounded design for the next F038 increment. No automatic implementation,
Git delivery, persistent operation or F039 work follows. Preserve F001-F037
APPROVED_COMPLETE, F038 **IN_PROGRESS** and F039 NOT_STARTED. STOP after review.

## 17. Stage C1 - Pure Section Evidence Policy (DETAILED PLANNING ONLY)

**Owner gate:** C1 detailed planning only. Only this section is appended to the
feature document. Proposed decisions/contracts below require explicit disposition
before implementation; they are not new canonical APIs, persisted fields or
completion standards. Stage A/B1/B2 evidence and Section 14's blocked preflight
remain unchanged. F038 stays IN_PROGRESS; F001-F037 APPROVED_COMPLETE and F039
NOT_STARTED. No implementation, test, service or database/browser execution occurs.

### 17.1 Source reconciliation and smallest increment

PRD sections 14, 21-25 require learning sections and passing practice, but do not
define trustworthy acknowledgements, checkpoints, evidence expiry or score
selection. The canonical Concept/studentProgress architecture and Stage A's
VISUALIZE/PRACTICE minimum/default 70% remain authoritative. No prior contract
makes viewing, scrolling, local timer completion or activity counts proof of
learning. No conflict requiring a canonical amendment was identified for a pure
disconnected metadata validator.

Existing Read/Example/Revise tabs render approved content and accessible empty/
error states. F028/F029 playback is client-local, with the real lesson in a gated
fixture; server retrieval, Concept attachment and trusted checkpoint producers
are still missing. Current Concept DTOs do not establish an evidence revision
catalog. F036 durable attempts are ungraded; F037 summaries are activity-only.
B1 remains opt-in and disconnected from submissions; B2 alone invokes it through
approved internal diagnostic commands. B2 assessments never qualify for completion.

Recommend one pure synchronous validateSectionEvidencePolicy function and tests.
It checks a single candidate against an explicit supplied expected snapshot and
classifies metadata only. No adapter calls Stage A, B1, B2 or an existing request.
No evidence service, challenge store, grade selection, persistence, API or UI.
This foundation cannot independently establish that any input is authentic.

### 17.2 Proposed bounded input contract

Use schemaVersion=1 and an exact plain-object envelope with these required fields:

| Field | Proposed metadata contract |
| --- | --- |
| schemaVersion | Safe positive integer; only 1 supported. Missing/noninteger is invalid; other well-formed versions refuse. |
| expected | Expected studentId, conceptId, section, conceptRevision, sectionRevision, policyId, policyVersion; expected challengeId/challengeState; checkpoint binding or null. Supplied by a future trusted integration, never taken from a request as authority. |
| candidate | Same seven scope/policy fields; evidenceId, kind, origin; issuedAtMs, expiresAtMs, revokedAtMs; challengeId; checkpoint metadata or null; practiceLink or null. No booleans claiming approval, ownership, publication or VERIFIED. |
| asOfMs | Explicit evaluation instant in UTC Unix epoch milliseconds. No Date.now or clock read inside C1. |
| maxAgeMs | Explicit positive policy validity bound in milliseconds. Required, with no fallback/permanent-validity default. Its product value must later be owner-approved. |
| observedEvidenceIds | Bounded unique list of identifiers already observed in the supplied snapshot; explicit [] allowed, not proof of global absence. |
| consumedChallengeIds | Bounded unique list of consumed challenge identifiers in the supplied snapshot; explicit [] allowed, not proof that a challenge is available. |

Common bindings: studentId/conceptId are canonical lowercase 24-hex ObjectId
strings; section is a bounded token recognized against READ, VISUALIZE, EXAMPLE,
REVISE and PRACTICE. conceptRevision/sectionRevision/policyId/evidenceId/challengeId
are opaque, case-sensitive ASCII tokens, 1-128 characters, using Stage A's token
alphabet (letters/digits initially; then letters/digits/dot/underscore/colon/hyphen).
Reject trailing newlines and whitespace; never trim, lowercase, coerce or normalize
inputs. policyVersion is a positive safe integer and must exactly match expected.
An existing content hash may serve as a token; C1 does not generate/recompute it.
No automatic mapping to Stage A policyRevision or F036 questionRevision is assumed.

Every object has a strict key allowlist and explicit nulls for inapplicable fields.
Omitted required fields, explicit undefined, unknown/symbol/hidden keys, functions,
accessors, proxies, class instances, cycles and malformed arrays refuse without
invoking supplied code. Snapshot bounds: depth <=6, <=32 keys per object, <=512
visited values, each replay list <=64 entries; duplicate identifiers in either
list are invalid input, not silently deduplicated. Precheck lengths before scanning
strings. No unbounded reason, response, Markdown, answer, token or content body.
Structural checks precede token allowlist/binding checks for stable refusal order.

Timestamp fields are finite safe integers in [0, 8,640,000,000,000,000]; revokedAtMs
may be null. maxAgeMs is 1 through that upper bound. These are representational
limits, not a chosen product retention/expiry period. Policy configuration and
timestamps are assertions until a trusted service derives and verifies them.

### 17.3 Section-specific candidate rules (proposed)

| Section | Candidate kind / origin vocabulary | Proposed C1 disposition |
| --- | --- | --- |
| READ | ACKNOWLEDGEMENT / ACKNOWLEDGEMENT_SERVICE | If all metadata checks pass, ACTIVITY_CANDIDATE only. A future authenticated explicit acknowledgement records an action, not comprehension. VIEW, scroll depth and elapsed time alone refuse. |
| EXAMPLE | ACKNOWLEDGEMENT / ACKNOWLEDGEMENT_SERVICE | Same boundary; section acknowledgement does not prove understanding or coverage of every example. Coverage remains a future owner decision. |
| REVISE | ACKNOWLEDGEMENT / ACKNOWLEDGEMENT_SERVICE | Same metadata rules. Optional unless the separately supplied approved completion policy requires it. C1 never adds it to Stage A's required sections. |
| VISUALIZE | CHECKPOINT_RESPONSE / CHECKPOINT_SERVICE | CHECKPOINT_CANDIDATE only after matching declared checkpoint metadata with declared VALIDATED result. This does not actually validate a response. LOCAL_PLAYBACK_COMPLETE/client-origin metadata always refuses. |
| PRACTICE | PRACTICE_REFERENCE / ATTEMPT_SERVICE or ASSESSMENT_SERVICE | Always PRACTICE_NOT_QUALIFIED in C1 v1. No presently implemented assessment purpose qualifies for completion. An ungraded attempt, B2 DIAGNOSTIC record or claimed eligible flag cannot pass. Future qualification needs separate policy/schema approval. |

Origin strings name proposed future producer roles, not existing services,
credentials or proof. A forged server-origin string can satisfy syntax; it never
earns authentication or completion authority. No generic producer/approval flag
or arbitrary origin is accepted as a shortcut.

For VISUALIZE, expected checkpoint binding is exactly visualizationId (24-hex),
visualizationRevision (bounded revision token), checkpointId (bounded token) and
checkpointPolicyVersion (positive safe integer). Candidate checkpoint has those
same four fields plus validation=VALIDATED|UNVALIDATED|UNKNOWN. Missing/null,
unvalidated, mismatched or contradictory bindings refuse. ACKNOWLEDGEMENT and
PRACTICE_REFERENCE must have checkpoint=null and expected checkpoint=null.
C1 evaluates one checkpoint candidate; it neither accumulates a required set nor
declares a visualization complete. Manual keyboard/screen-reader/reduced-motion
alternatives must validate the same future learning checkpoints without forcing
autoplay, animation, scroll measurements or speed/dwell assumptions.

practiceLink is null or a strict reference-only object: attemptId, questionId,
questionRevision (F036 lowercase 64-hex), assessmentId (24-hex or null), and
assessmentPurpose (DIAGNOSTIC or null). It is allowed only for PRACTICE_REFERENCE.
Missing assessment or a DIAGNOSTIC link remains unqualified. There is deliberately
no proposed new completion-assessment purpose, score, best/latest rule or durable
proof flag here. Unknown purpose values refuse; none becomes an approved canonical
assessment schema by appearing in this plan.

### 17.4 Time, revision and replay metadata semantics

All scope and policy bindings compare exactly. Different accounts/Concepts/
sections, policy ids/versions, Concept revisions or section revisions refuse.
Expected revisions mean the content currently published according to a future
trusted resolver; C1 cannot verify publication/ancestry or freshness itself.
Changing required content or checkpoint policy must be treated as a mismatch
until the future version/invalidation rules are approved. No migration or silent
reuse of an older acknowledgement follows from a matching Concept id.

Require issuedAtMs <= asOfMs, expiresAtMs > issuedAtMs and
expiresAtMs-issuedAtMs <= maxAgeMs. No clock-skew tolerance or expiry extension.
asOfMs >= expiresAtMs is expired, including equality. Non-null revokedAtMs must
fall between issuedAtMs and asOfMs; otherwise lifecycle metadata is contradictory.
A consistent non-null revocation always refuses. C1 neither schedules nor performs
revocation, chooses a TTL, reads a clock nor changes existing completion state.

For ACKNOWLEDGEMENT/CHECKPOINT_RESPONSE, expected.challengeId and candidate.challengeId
are required non-null matching tokens. expected.challengeState is AVAILABLE,
CONSUMED or UNKNOWN; UNKNOWN refuses. A matching id in consumedChallengeIds,
CONSUMED state or evidenceId in observedEvidenceIds refuses replay. No absence in
these bounded lists proves global uniqueness. Challenge metadata is scoped through
the expected account/Concept/section/revision/policy snapshot, which a future
service must establish from the actual authoritative challenge record.

PRACTICE_REFERENCE may use null challengeId/expected.challengeId and UNKNOWN state;
it still always refuses practice qualification. If a non-null challenge is supplied,
the same binding/replay checks apply. Unknown challenge availability only receives
the earlier replay-state refusal when a challenge is applicable. Thus practice
does not invent a challenge requirement for existing saved attempts.

C1 does not issue or consume a challenge, insert an idempotency key or remember
prior calls. Repeating identical input must yield identical output. A future
transactional service must atomically verify/consume a one-use challenge and create
its receipt, with unique scoped identities and same-request idempotency. Legitimate
idempotent retrieval of an already-created receipt is a separate service path,
not a fresh C1 acceptance or a reason to weaken replay refusal.

### 17.5 Exact proposed output and refusal precedence

Return exactly classification, completionQualification and code. Every result has
completionQualification=NOT_ESTABLISHED. Valid acknowledgement metadata yields
classification=ACTIVITY_CANDIDATE; valid checkpoint metadata yields
classification=CHECKPOINT_CANDIDATE; both have code=null. Rejection yields
classification=REFUSED and one allowlisted code. No evidence certificate, signature,
Stage A VERIFIED/outcome=COMPLETED/ELIGIBLE, pass entitlement, stored receipt,
identifier, input echo, score or sensitive validator/error detail is returned.
Even a valid candidate result cannot be fed directly into Stage A.

Return the first applicable refusal below, not a variable-order collection:

| Order | Allowlisted code | Exact class of refusal |
| --- | --- | --- |
| 1 | INVALID_INPUT | Unsafe snapshot, missing/extra/malformed fields, invalid ids/tokens/scalar representations, invalid/duplicate/oversized replay arrays or resource bounds. |
| 2 | UNSUPPORTED_VERSION | Well-formed envelope schemaVersion other than 1. |
| 3 | UNSUPPORTED_SECTION | Well-formed section token outside the five-section allowlist in candidate or expected. |
| 4 | UNSUPPORTED_EVIDENCE | Unsupported kind/origin or section-kind-origin combination, visits/client playback, or a non-null practiceLink for another kind. |
| 5 | POLICY_BINDING_MISMATCH | Candidate policy id/version differs from expected. |
| 6 | SCOPE_BINDING_MISMATCH | Account, Concept or section differs from expected. |
| 7 | REVISION_MISMATCH | Concept or section revision differs from expected. |
| 8 | CHECKPOINT_BINDING_INVALID | Missing/inapplicable/conflicting checkpoint, mismatched exact checkpoint fields or validation other than VALIDATED. |
| 9 | INVALID_LIFECYCLE | Future issuance, nonpositive validity interval, validity beyond explicit maxAgeMs, or contradictory revocation time. |
| 10 | EVIDENCE_REVOKED | Consistent non-null revokedAtMs. |
| 11 | EVIDENCE_EXPIRED | asOfMs >= expiresAtMs. |
| 12 | REPLAY_STATE_UNAVAILABLE | Applicable expected challenge state UNKNOWN. |
| 13 | CHALLENGE_BINDING_MISMATCH | Required challenge missing or candidate id differs from expected. |
| 14 | REPLAY_DETECTED | Applicable challenge CONSUMED/listed consumed, or evidence id already observed. |
| 15 | PRACTICE_NOT_QUALIFIED | Structurally valid PRACTICE_REFERENCE after preceding checks; no approved completion-qualifying assessment policy. |

Null checkpoint metadata is structurally representable; whether it is required
is checked at order 8, not mislabeled malformed input. Missing required envelope
fields are order 1. Likewise a bounded unknown section/kind/origin remains
representable until its dedicated allowlist check. Invalid policyVersion/time
scalar types are order 1; well-formed unequal policy versions are order 5. A
revoked-and-expired candidate returns EVIDENCE_REVOKED; an unknown required
challenge state precedes a missing challenge binding. Tests must lock these cases.
No grading or default passing-threshold calculation occurs; 70% remains Stage A's
default, and C1 cannot satisfy that requirement or F039 mastery.

### 17.6 Future trusted services and authorization boundaries

Before any genuine evidence can exist, separately approved server integration must:

1. Reuse existing JWT authentication plus fresh STUDENT eligibility; derive the
   account identity from authentication. Do not trust expected/candidate bodies,
   origin labels, account ids or booleans supplied by a client.
2. Resolve published Concept and complete ancestry/reference consistency, exact
   section/visualization content and reviewed checkpoint definitions. Establish
   current Concept/section/policy versions from an approved version catalog; no
   such catalog or Concept-visualization attachment is created by C1.
3. Establish actual explicit acknowledgement provenance or validate real
   checkpoint responses on the server through approved accessible equivalents.
   Client completion callbacks, timers and hidden flags are insufficient. Raw
   student responses/solutions are not C1 metadata.
4. Load real challenge ownership, full binding, availability and expiry; enforce
   concurrency-safe one-use consumption and unique evidence/idempotency identities
   transactionally. Read actual revocation/current-state and an authoritative
   clock. C1's supplied lists and time cannot do this job.
5. For Practice, separately verify owned majority-confirmed F036 attempts and
   eligible assessment provenance under an approved exposure/coverage/selection
   policy. Never mutate F036 attempts, promote B2 history or infer a pass from
   F037 counts. B1 is not wired to submissions by this stage.
6. Adopt explicit privacy/retention/erasure/audit rules and any API/model/index
   amendments before persistence. A future completion adapter must independently
   establish trusted evidence and canonical studentProgress lifecycle; it cannot
   rename a C1 candidate as VERIFIED. No alternate canonical completion store.

These are proposed responsibilities, not implemented service files or permission
to add endpoints, credentials, storage, logs, dependencies or infrastructure.
Acknowledgements prove a claimed action once authenticated, not understanding;
checkpoint validation is only as meaningful as separately reviewed learning tasks.

### 17.7 Numbered owner decisions for implementation approval

| Decision | Conservative C1 recommendation | Deferred authorization |
| --- | --- | --- |
| C1-P1 - Acknowledgement eligibility | READ/EXAMPLE/optional REVISE may classify as ACTIVITY_CANDIDATE only, never completion proof. Visits alone refuse. | Whether explicit acknowledgement is sufficient for any required-section completion; required Example coverage. |
| C1-P2 - Visualization checkpoints | Only matched declared VALIDATED checkpoint metadata may classify as CHECKPOINT_CANDIDATE, still untrusted. No local playback qualification. | Authored checkpoint tasks/required coverage, server response validation and equivalent accessible interaction design. |
| C1-P3 - Revision/policy identity | Exact Concept/section tokens and policy id/positive version; all mismatches fail closed. Do not generate hashes or map to Stage A automatically. | Authoritative revision generation, version catalog/Concept attachment, content-change invalidation and Stage A mapping. |
| C1-P4 - Expiry/revocation | Explicit asOfMs/maxAgeMs and finite expiry required; expired/revoked/contradictory metadata refuses without tolerance. No product TTL chosen. | Actual validity durations, trusted time, revocation authority, propagation and treatment of already-completed Concepts. |
| C1-P5 - Replay/one-use boundary | Required matching available challenge for acknowledgement/checkpoint candidates plus bounded unique observed/consumed metadata. No consumption or cross-call memory. | Real challenge lifecycle, authoritative lookup, transaction/index design and idempotent receipt retrieval. |
| C1-P6 - Practice linkage | Reference-only input, always PRACTICE_NOT_QUALIFIED in v1; null/ungraded/B2 DIAGNOSTIC never completion evidence. | Completion-qualifying assessment provenance, disclosure exposure, eligible attempts and independently approved grading integration. |
| C1-P7 - Future completion qualification | Exact three-field candidate/refusal output; NOT_ESTABLISHED always; no Stage A adapter, scoring, selection, completion or mastery. | Section qualification, score/coverage/selection, final evidence adapter and studentProgress persistence/UI. |
| C1-P8 - Privacy/retention | Bounded metadata only; no logging, answer/content copies, storage, identifiers in output or external calls. | Evidence-data minimization at persistence, access, retention, coordinated erasure, audit/backups and release prerequisites. |

Approval of C1-P1-P8 would approve the pure validator contract only. It would not
approve anything in the deferred column or permanently decide how completion is
earned. In particular, proposed future provenance labels are not trusted credentials.

### 17.8 Exact proposed implementation inventory

| Operation after separate approval | Exact path |
| --- | --- |
| CREATE | apps/api/src/modules/progress/section-evidence-policy.ts |
| CREATE | apps/api/tests/section-evidence-policy.test.ts |
| MODIFY | docs/features/F038-completion-rules.md |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md |

Total four paths: two CREATE and two MODIFY. Only this feature document changes
during planning. Future source stays under progress as a disconnected internal
utility; no shared abstraction/package or modification to Stage A/B1/B2 sources.
Use native TypeScript and existing Zod/node:util only as needed; no dependency.
Roadmap/document edits during future implementation record partial-stage scope
and actual verification, not full F038 completion. API_DESIGN.md/DATABASE_DESIGN.md
remain unchanged; any necessary canonical amendment or fifth path must stop for
explicit approval. No model/index/controller/route/configuration/UI file is implied.

### 17.9 Planned verification and separate source review - NOT_RUN

After explicit implementation approval, focus deterministic cases on:

- Valid READ/EXAMPLE/REVISE acknowledgements and VISUALIZE checkpoint metadata;
  exact classification/code/NOT_ESTABLISHED output; optional Revise not silently
  required; valid-looking Practice and DIAGNOSTIC/ungraded links always refuse.
- Invalid ids/revisions/versions, unknown/extra keys, unknown section/type/origin,
  client view/playback, coercible values, Unicode/newline tokens, object/array/
  length/depth limits, proxies/accessors/cycles without invocation or mutation.
- Cross-account/Concept/section/policy/revision mismatch; absent, stale, conflicting
  or unvalidated checkpoints; no inferred complete checkpoint coverage.
- Explicit time/maxAge boundaries, exact expiry equality, future issue/revocation,
  revoked+expired precedence, invalid duration, missing policy bound and no clock
  reads/default TTL. No real expiry or revocation side effect.
- Unknown/missing/consumed/mismatched challenge metadata; observed evidence reuse,
  duplicate/oversized replay lists, deterministic same-input repeats and no claim
  that empty lists establish global uniqueness or consume a one-use challenge.
- Multi-defect precedence for every neighboring stage; stable allowlisted single
  refusal, no sensitive echoes, no numeric grades and no VERIFIED/ELIGIBLE output.
- Frozen-input/repeatability tests and source review for no I/O, randomness,
  environment/clock access, logging, mutation or adapter imports. No candidate can
  substitute structurally for Stage A SectionEvidence. Preserve existing pure
  policy, opt-in B1 grading, B2 diagnostic and F036/F037 contracts.

Run focused tests and relevant existing Stage A/B1/B2/Practice/progress API
regressions; report distinct actual counts without projecting results. Run API
build, source/test TypeScript, repository lint, targeted source formatting,
UTF-8/LF, whitespace and exact-scope/security checks. No frontend rerun is implied
for a disconnected API-only utility unless its approved scope later changes.
Perform a separate formal CRITICAL/HIGH/MEDIUM/LOW diff review with actual file/
line findings; unresolved findings require owner disposition. Do not describe
planning source inspection as a new passing implementation review.

C1 needs no MongoDB integration, browser execution, services or synthetic process
tests. A later persistence/evidence-producer stage needs separately approved
disposable database and browser verification. C1 browser additions **zero**;
preserve all existing **141 NOT_RUN**, F022/F024/F029/Windows limitations and
nontransferable feature exceptions. No new browser exception or production claim.

### 17.10 Planning outcome and next gate

**PLAN READY FOR OWNER DECISION**, not implementation or genuine-evidence PASS.
Owner must approve/revise C1-P1-P8, the exact proposed input/output/refusal rules
and four-path inventory before implementation/offline verification. Any future
completion standard, trusted producer or canonical architecture change requires
its own explicit approval. F038 remains **IN_PROGRESS**, partial foundations only;
F001-F037 remain APPROVED_COMPLETE and F039 NOT_STARTED. No tests or services ran,
no code/status/canonical/roadmap changes occurred, and no Git writes were made.
STOP after this documentation-only plan; do not begin C1 implementation.

## 18. Stage C1 implementation and offline verification

### 18.1 Owner directions and P1-P8 reconciliation - PASS

The owner approved C1-P1-P8 subject to the latest directions and the exact four
Section 17.8 paths. Each direction reconciles without material conflict:

| Decision | Implemented boundary |
| --- | --- |
| P1 | READ/EXAMPLE/REVISE acknowledgements classify as ACTIVITY_CANDIDATE only. No comprehension, completion or required-Revise assertion. |
| P2 | VISUALIZE compares all expected/candidate checkpoint fields and requires declared VALIDATED metadata. Matching client claims remain untrusted CHECKPOINT_CANDIDATE metadata, not genuine verification; local playback does not qualify. |
| P3 | Strict exact account/Concept/section, Concept/section revision and policy id/version bindings; no normalization or implicit mapping to Stage A. |
| P4 | Explicit time/maxAge inputs, bounded finite integers, exact interval/expiry/revocation rules and stable refusal precedence. No clock, tolerance, default TTL or state change. |
| P5 | Supplied challenge state/id and unique bounded replay lists are validated only as metadata. No authoritative lookup, detection guarantee, one-use consumption or cross-call memory. |
| P6 | PRACTICE_REFERENCE always refuses qualification after preceding validation. F036 ungraded attempts, F037 counts and B2 DIAGNOSTIC assessments remain insufficient. |
| P7 | Every result contains exactly classification, completionQualification and code; completionQualification is always NOT_ESTABLISHED. No VERIFIED/certificate or Stage A adapter. |
| P8 | Disconnected pure utility; no authentication, persistence, network/filesystem access, logging, API/UI, grading, progress mutation or completion issuance. |

Only these four paths change during C1: CREATE
apps/api/src/modules/progress/section-evidence-policy.ts and
apps/api/tests/section-evidence-policy.test.ts; MODIFY this feature document and
docs/DEVELOPMENT_ROADMAP.md. Two creations/two modifications. Cumulative F038
work contains twenty unique paths, preserving the prior eighteen Stage A/B1/B2
paths; this does not expand C1's four-path boundary. No dependency/configuration,
PRD/API/Database document, prior evaluator, attempt/progress/audit source or test
was changed. F038 remains IN_PROGRESS, not full feature acceptance.

### 18.2 Implemented candidate-only contract

validateSectionEvidencePolicy implements the exact Section 17 fields, enums,
limits and fifteen-code precedence. Safe plain-data snapshots reject proxy/
accessor/class/cyclic/hidden/symbol/undefined input before Zod without invoking
supplied code. Record objects allow at most 32 named keys; dense replay arrays
use the separately approved 64-entry limit and their required length descriptor.
Depth six, 512 visited values and token/scalar bounds remain enforced. No identity,
revision, response, answer, score or input validation detail is echoed in results.

Known origin/VALIDATED/challenge labels are structural claims. A fabricated but
matching metadata snapshot can classify as a candidate; this grants no trust.
Both successful and refused result objects are fresh and contain exactly the
approved three fields. C1 does not authenticate the expected snapshot, establish
publication, validate a real response or prove that a challenge remains unused.
Repeated identical snapshots remain deterministic, not atomically consumed.
Checkpoint coverage and genuine eligibility are not inferred from one candidate.

Existing Stage A, B1, B2, F036 and F037 sources/behavior remain unchanged. No
runtime caller, route, hook, database model/index or Stage A adapter imports C1.
No live section evidence is produced. The default 70% Practice threshold and
independence from F039 mastery are preserved without score calculations here.

### 18.3 Actual offline verification - PASS

| Check | Actual result |
| --- | --- |
| Focused section-evidence policy | 32 PASS / 0 FAIL |
| Relevant existing API regressions | 148 PASS / 0 FAIL across twelve files |
| Distinct tests across those two successful invocations | 180 PASS; not a combined invocation or double-count of the initial focused run |
| API production build | PASS |
| API source/test TypeScript | PASS |
| Repository lint | PASS, zero warnings |
| Prettier for both new TypeScript files | PASS |
| Exact scope, UTF-8/LF and whitespace | PASS |

The twelve regression files are auth-audit, completion-policy, output-grading,
practice-question-model, practice-attempt-model, practice-attempt-repository,
practice-grading, practice-routes, practice, progress-model, progress-routes and
progress. They retain prior auth/answer secrecy, majority transactions/idempotency,
diagnostic/audit, activity-only and policy boundaries. No MongoDB integration,
browser, persistent service or frontend suite was executed. Existing offline HTTP
route fixtures remain part of API tests; no application deployment/startup occurs.
Tests used the supported ordinary-user context; no permissions or dependency changed.

Initial focused execution: **31 PASS / 1 FAIL**. The combined-defect fixture first
introduced a future issuance and then advanced asOfMs for the later expiry defect,
which removed the earlier contradiction. The evaluator correctly returned
EVIDENCE_EXPIRED. The fixture now uses a nonpositive validity interval that remains
invalid when the later case changes time. This preserves the approved precedence
assertion rather than changing product behavior or weakening it. The subsequent
32/32 focused run passed with no evaluator correction; retain this initial history.

Focused coverage includes the four acknowledgement/checkpoint sections and Practice
refusal; exact DTO shape; untrusted server-claim boundaries; cross-scope/revision/
policy mismatches; malformed/oversized/unsafe metadata; checkpoint requirements;
time boundaries including exact expiry, maximum representable time and maxAge;
unknown/missing/consumed/mismatched challenges and duplicate replay snapshots;
all fifteen refusals with every ordered pair of simultaneous defects; frozen
input/repeatability; Stage A incompatibility and source dependency/side-effect
review. No test implies real authorization, replay protection or evidence storage.

### 18.4 Separate formal source-diff review

**CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0 unresolved findings.** No finding requiring
a defect file/line reference was identified. The review separately checked the
new source/test and documentation diff against Section 17: strict bounded plain
metadata, enum/field allowlists, exact comparisons, deterministic order, no unsafe
accessor/proxy invocation, interval/revocation/replay edge cases, fixed output,
no trusted-certificate interpretation, no imports of existing runtime adapters and
no unapproved scope changes. The test-fixture failure above is retained as check
history, not a claim that genuine server verification was executed.

No API, schema, authentication, answer-disclosure or canonical architecture change
was necessary. Static dependency review finds only node:util and existing Zod in
the evaluator. The formal review is a separate source-review pass, not a new
database/browser test or proof of the future producers' authenticity.

### 18.5 Remaining Stage C work and next gate

The future services enumerated in Section 17.6 remain unimplemented: current
authenticated Student/publication/ownership verification; authoritative Concept/
section/policy revision catalog and visualization attachment; explicit action
provenance and real accessible checkpoint validation; transactional challenges,
receipts/idempotency and authoritative time/revocation; qualifying Practice
assessment/exposure/coverage/score-selection policy; privacy/retention/coordinated
erasure/backups; and the canonical studentProgress completion lifecycle/API/UI.
No C1 candidate may be renamed VERIFIED or promoted to completion without that
separately approved integration. B2 history remains DIAGNOSTIC.

C1 adds **zero browser scenarios**. Existing **141 NOT_RUN** and all historical
F022/F024/F029/Windows limitations/nontransferable exceptions remain unchanged.
No MongoDB gate is applicable to this pure disconnected utility. F001-F037 remain
APPROVED_COMPLETE, F038 **IN_PROGRESS** and F039 NOT_STARTED. No Git staging,
commit/push, new infrastructure, paid/cloud operation or deployment occurred.
Next gate: separate owner review of C1 offline evidence and approval of any next
bounded design/integration increment. STOP after offline verification; no full
F038 READY_FOR_REVIEW/APPROVED_COMPLETE or automatic next-stage work is authorized.

## 19. Stage C2 detailed plan - trusted READ acknowledgement producer

**PLANNING ONLY; implementation and canonical amendments await separate owner
approval.** The owner accepted C1 final review with zero unresolved findings and
authorized this appended plan only. Sections 1-18 and their evidence are retained.
F038 remains IN_PROGRESS; F001-F037 remain APPROVED_COMPLETE for local development.
This section proposes an eleven-file increment, not completion of F038.

### 19.1 Purpose, source reconciliation and exclusions

Produce a server-owned record of one explicit, authenticated READ acknowledgement.
It proves an action under the authorization/content observations described below;
it does not prove reading, comprehension, attention or completion eligibility.
PRD section 14's Visualize/Practice requirements and configured completion policy
are unchanged. Canonical studentProgress remains the completion-summary target;
the proposed receipts are private activity records, not an alternative completion
store. No F037 activity count or status changes. No F036 attempt mutation or
answer-disclosure change. B1 remains disconnected and B2 remains DIAGNOSTIC.

Initial scope is LOCAL-only, explicitly invoked internal service methods for READ.
No public route, controller, scheduled worker, frontend integration, assessment,
grading, score selection, Stage A adapter, VERIFIED evidence, completion record,
mastery or F039 work. EXAMPLE/REVISE acknowledgement producers, VISUALIZE challenge
tasks/accessibility alternatives and qualifying PRACTICE evidence remain deferred.
An eventual student-facing producer needs separately approved routing, accessible
interaction, abuse controls and browser coverage; this plan does not deliver it.

### 19.2 Trusted caller and bounded internal commands

Proposed factory takes the existing server-owned AccessTokens verifier, validated
APP_ENV configuration and repository adapter. All entry points reject non-LOCAL
environments. A caller's STUDENT flag, AuthContext, userId, hash, policy claim or
approval boolean is never authority. Verify the existing access token and query
the current user: ACTIVE, verified and currently STUDENT, with canonical identity
derived only from authentication. Preserve existing token/session semantics; a
token sid is not proof of a newly introduced live-session check.

Proposed internal commands, with access token passed separately from command data:

- `issue({ conceptId, idempotencyKey }, requestId)`.
- `acknowledge({ challengeId, acknowledged: true, idempotencyKey }, requestId)`.
- Optional, explicitly proposed in C2-P3: `revoke({ challengeId }, requestId)` for
  the currently eligible owning Student's withdrawal, with no cross-account Admin
  power. This is not approved functionality merely because it is planned here.

Strict plain-data allowlists reject extra keys, accessors/proxies, coercion and
unsupported section/action values. IDs are lowercase 24-hex ObjectId strings;
idempotency keys use the existing canonical UUID-v4 contract (36 ASCII characters);
requestId is a nonsensitive ASCII correlation token of 1-128 characters. Accept no
answer, content body, rubric, account override, lifetime, revision or policy input.
Hashes are lowercase 64-hex SHA-256 digests; versions are positive safe integers.
Server UTC times are valid bounded integer milliseconds, stored as BSON Dates.
Bindings and lifecycle constraints are validated on reads as well as writes.

Issue and acknowledge, including replay/proof, revalidate current Student,
published Concept, Technology/LearningPath/Module/Topic ancestry, denormalized
reference consistency, server policy and content snapshot. Existing challenge
ownership, expiry and revocation are checked where applicable. A first issue has
no preexisting challenge: validate the new server-issued interval instead.
Withdrawal must authenticate ownership but may remain available when content is
unpublished; it can only restrict availability, never authorize acknowledgement.

Proposed allowlisted success DTOs:

- Issue: exactly `id, conceptId, section, conceptRevision, sectionRevision,
  policyId, policyVersion, expiresAt`.
- Acknowledgement: exactly `id, conceptId, section, acknowledgedAt,
  completionQualification`; the last field is always `NOT_ESTABLISHED`.
- Optional withdrawal: exactly `challengeId, state`, with `state=REVOKED`.

Dates in DTOs are UTC ISO strings. Never return account IDs, key hashes, request
fingerprints, provenance internals, answers or authorization certificates. A
challenge ID is an opaque record reference, not a bearer credential.

### 19.3 Proposed hash authority and existing repository capabilities

There is no authoritative monotonic Concept/READ revision catalog in the current
schema. updatedAt alone is not that catalog. Recommendation C2-P1 is a versioned,
server-computed content-snapshot digest for this LOCAL activity-only increment.
Do not describe it as irreversible editorial history or accept a client digest.

Use existing `publishedConceptStages` from concept.repository.ts for full
published ancestry/reference checks. Its exported stages can run inside the new
repository's explicitly session-bound, bounded aggregate. Existing
`conceptRepository.detail` and `userRepository.get` do not expose the transaction/
majority options needed here; add narrowly projected reads inside the new adapter,
not changes to those existing repositories. Reuse conceptDetailDto's approved
normalization after strict projection validation; exclude lifecycle/Admin/private
data. Read current eligible user fields within the same transaction and again for
proof. No Auth model, role policy or existing repository change is proposed.

Exact v1 serialization proposal: SHA-256 of UTF-8 JSON.stringify of the following
ordered arrays. ObjectIds are canonical lowercase strings. No trimming, Unicode
normalization, case folding or newline rewriting of authored strings. Preserve
array order. Normalize absent optional values only as conceptDetailDto does:
examples/keyPoints to empty arrays, missing revise and its optional strings to null.
Reject unsupported content/schema versions and malformed stored values.

```text
source = [label, url, sourceType, isOfficial]
examples = [[title, bodyMarkdown], ...]
revise = null | [summary, keyPoints, memoryTrickOrNull, importantCodeMarkdownOrNull]
conceptRevision = sha256(JSON([
  "F038-C2-concept-v1", id, technologyId, learningPathId, moduleId, topicId,
  title, slug, difficulty, order, contentFormat, schemaVersion,
  read.summary, read.bodyMarkdown, source, examples, revise
]))
sectionRevision = sha256(JSON([
  "F038-C2-read-v1", id, title, contentFormat,
  read.summary, read.bodyMarkdown, source
]))
```

This is an explicit proposed algorithm for section-evidence-revision.ts, not a new
stored Concept field. Both digests bind every challenge/receipt; changing Example
or Revise conservatively changes conceptRevision even if READ is unchanged.
An ancestor must be currently published, but these hashes do not bind its title.
Policy is a server-owned constant `F038_READ_ACK_ACTIVITY`, version 1; producer
version 1 identifies this serialization/lifecycle implementation. Policy changes
require explicit code/version review, never request-provided configuration.

Limitations requiring owner acceptance: identical bytes restored later can yield
the same digest (ABA); unpublish/republish without a content change does not leave
an irreversible invalidation marker. Fresh checks refuse while unpublished or
mismatched, but do not reconstruct intervening history. Transaction snapshots and
post-commit reads also do not serialize all future account/editorial changes with
issuance. Do not promise immediate global revocation or a publication-write fence.
If monotonic history or linearization with publishing is required, this scope is
insufficient: Concept revision/publication writers and their tests need a separately
approved architecture/inventory expansion. Do not silently use timestamps instead.

### 19.4 Proposed private schemas and lifecycle

Two NEW collections require canonical owner approval before implementation. Models
must use explicit collection names, strict typed schemas, no Mixed payloads, no
automatic casting of identity inputs, autoCreate/autoIndex disabled and no buffering
that hides unavailable prerequisites. No TTL index, migration or persistent setup.

**sectionEvidenceChallenges** (one challenge per account-scoped issue identity):

| Fields | Constraint and mutability |
| --- | --- |
| `_id, userId, conceptId` | ObjectIds; generated challenge ID and authenticated owner; immutable. |
| `schemaVersion, producerVersion` | Exactly 1; immutable. |
| `section, policyId, policyVersion` | READ, F038_READ_ACK_ACTIVITY, 1; immutable. |
| `conceptRevision, sectionRevision` | Exact server-computed 64-hex digests; immutable. |
| `issueKeyHash, requestFingerprint` | Domain-separated SHA-256 digests; immutable. |
| `issueRequestId, issuedAt, expiresAt` | Nonsensitive correlation and server UTC timestamps; immutable; proposed exact 300,000 ms interval. |
| `state, decisionFence` | AVAILABLE / CONSUMED / REVOKED and nonnegative safe integer fence; private compare-and-set transitions only. |
| `consumedAt, receiptId` | Both null initially; set together once on consumption; never changed or cleared. |
| `revokedAt, revokedBy` | Both null initially; set once on terminal withdrawal; revokedBy must equal userId in proposed owner-only v1. |

AVAILABLE requires both consumption and revocation pairs null. CONSUMED requires
receiptId plus `issuedAt <= consumedAt < expiresAt`, with no revocation pair.
REVOKED requires a valid server revocation pair; it preserves any prior consumption
pair. Reject inconsistent pairs, impossible/future timestamps, fence overflow or
unknown states. Expiration is derived from server time, never a background job.

Proposed transitions: AVAILABLE -> CONSUMED atomically with receipt insertion;
AVAILABLE -> REVOKED; and CONSUMED -> REVOKED to withdraw a historical action's
current availability without rewriting its receipt. REVOKED is terminal. No reset,
extension, owner transfer, receipt replacement or AVAILABLE resurrection. Receipt
replay and consumption update the same decisionFence used by withdrawal; issue
replay also fences the currently AVAILABLE state. This serializes competing
challenge decisions, not unrelated editorial writes.

**sectionActivityReceipts** (append-only authenticated action history):

| Fields | Constraint |
| --- | --- |
| `_id, userId, conceptId, challengeId` | Canonical ObjectIds; exact owned challenge links. |
| `schemaVersion, producerVersion` | Exactly 1. |
| `section, policyId, policyVersion` | READ and the exact server policy/version. |
| `conceptRevision, sectionRevision` | Copied only from the verified challenge/current server snapshot. |
| `origin, purpose` | ACKNOWLEDGEMENT_SERVICE and ACTIVITY_ONLY. |
| `ackKeyHash, requestFingerprint, ackRequestId` | Hashed request identity and bounded nonsensitive correlation. |
| `acknowledgedAt` | Same server instant as challenge consumedAt. |

All receipt fields are immutable through supported application operations. No
automatic updatedAt, free-form metadata, raw content, answers, access tokens,
scores, assessment IDs, VERIFIED marker or studentProgress link. Receipt insertion
and challenge consumption must cross-reference the same preallocated receipt ID,
owner, Concept, bindings and timestamp. Validate both rows during proof. Model/
repository guards and transaction discipline are not database-level WORM or a
defense against privileged direct MongoDB writes.

### 19.5 Exact indexes and readiness

Proposed secondary index allowlist; normal `_id_` indexes are also required:

| Collection | Exact name | Ordered key | Options |
| --- | --- | --- | --- |
| sectionEvidenceChallenges | uq_section_evidence_issue_key | `{ userId: 1, issueKeyHash: 1 }` | unique: true |
| sectionActivityReceipts | uq_section_activity_challenge | `{ userId: 1, challengeId: 1 }` | unique: true |
| sectionActivityReceipts | uq_section_activity_ack_key | `{ userId: 1, ackKeyHash: 1 }` | unique: true |

Require simple binary collation (no alternate collation), non-sparse, non-hidden,
no partial filter, TTL or wildcard options, exact names/order/directions/uniqueness
and completed usable index definitions. Verify collection collation as well;
reject unexpected effective collation/options. Do not accept a matching name alone.
Readiness checks apply to issue, acknowledge, replay and withdrawal. Missing,
incorrect, unready or unverifiable definitions return sanitized
DEPENDENCY_UNAVAILABLE; no historical fallback, index creation or auto-repair.

No fourth secondary index is needed for the proposed access paths: challenge CAS
uses `_id` plus owner and the receipt relation is verified via its `_id` and the
unique owner/challenge index. The same challenge's immutable owner and transactional
CAS prevent receipts under another account; uniqueness is not the authorization
check. Do not introduce a global challenge index or retention index implicitly.
High-volume erasure/query optimization remains a future operational decision.

Initial standalone C2 integration should use only these three new secondary
indexes and default `_id_` indexes. It can seed user/published ancestry fixtures
directly without invoking F036 submission, F037 summaries or B2 grading. Therefore
no implicit attempt/progress/rubric/audit prerequisite provisioning is proposed.
If prepared implementation actually needs another index, stop for exact allowlist
approval; do not repeat the historical B2 prerequisite gap by guessing.

### 19.6 Request identity, replay and refusal semantics

Digest helper is the same bounded UTF-8 ordered-array SHA-256 algorithm above:

```text
issueKeyHash = sha256(JSON(["F038-C2-issue-key-v1", userId, rawIssueKey]))
ackKeyHash = sha256(JSON(["F038-C2-ack-key-v1", userId, rawAckKey]))
issueFingerprint = sha256(JSON([
  "F038-C2-issue-request-v1", userId, conceptId, "READ",
  conceptRevision, sectionRevision, policyId, policyVersion
]))
ackFingerprint = sha256(JSON([
  "F038-C2-ack-request-v1", userId, challengeId, conceptId, "READ",
  conceptRevision, sectionRevision, policyId, policyVersion, "ACKNOWLEDGED"
]))
```

Correlation IDs, timestamps and mutable fences are not request payload identity.
Raw keys exist only while validating/hashing the call; never persist or log them.
Server-loaded challenge bindings determine acknowledge identity, never client
claims. A key alone is neither ownership proof nor permission to return a receipt.

| Situation | Proposed result |
| --- | --- |
| Same issue key, identical current binding | Return original AVAILABLE, owned, unexpired challenge after fenced replay and durability/current checks; do not extend time. |
| Same issue key, different Concept/content/policy binding | Conflict; do not overwrite or reinterpret the original issue. |
| Reissue with consumed/expired/revoked original | Refuse; a new issue key is required for a new challenge. |
| Same ack key and identical owned challenge/fingerprint | Return the same exact receipt only after fresh authorization, binding, lifecycle, fenced replay and majority proof. |
| Same ack key, different challenge/request | Conflict without a second receipt. |
| Different ack key for a consumed challenge | Refuse; never call this same-request replay. |
| Concurrent identical acknowledgements | Unique keys plus challenge CAS converge on one receipt; bounded conflict resolution verifies exact stored identity. |
| Concurrent different acknowledgements | At most one consumption/receipt succeeds; loser gets sanitized conflict. |
| Another account uses a key/challenge/receipt | No disclosure; owner comes from authentication; generic not-found for unowned references. |
| Changed publication/revision/policy or terminal withdrawal | Refuse, including historical receipt replay; never relabel history current. |
| Unknown commit or lost proof | No success; explicit same-identity resolution must independently prove durability and current authorization. |

Recommended strict C2-P5 replay window: both new acknowledgement AND successful
receipt replay require server now < original expiresAt; equality is expired.
The immutable receipt can remain after expiry but is not returned as a fresh
acknowledgement success. This intentionally limits recovery after a committed
response is lost. An owned historical-receipt query or replay beyond challenge
expiry is a separate option requiring explicit approval, not an implicit fallback.
Never infer rollback from a refused replay: a committed historical row may exist.

Use existing AppError/envelope conventions without exposing database internals.
Proposed internal codes: VALIDATION_ERROR (400); existing token failures (401);
AUTH_FORBIDDEN (403); CONCEPT_NOT_FOUND / SECTION_CHALLENGE_NOT_FOUND (404);
SECTION_EVIDENCE_CONFLICT / SECTION_CHALLENGE_UNAVAILABLE (409); and sanitized
DEPENDENCY_UNAVAILABLE / SECTION_EVIDENCE_UNCONFIRMED (503). Codes and their
addition to the internal contract require C2-P8 approval. Check order: validated
LOCAL configuration, bounded command/token validation, current account, database/
index readiness, published scope, owned record, exact payload/bindings, lifecycle,
CAS/transaction and proof. No error includes contents, keys, stored fingerprints
or whether another account owns a guessed identifier.

### 19.7 Transactions, consistency fences and durability proof

Reuse the corrected F036/B2 transaction design, not a new shared framework:
primary reads, snapshot transaction, majority+journaled write concern, inherited
transaction timeout policy with no incompatible per-operation timeout override.
Proposed total service budget 10 seconds, including 2 seconds reserved for proof;
at most three transaction-body executions for explicitly retryable conflicts;
maxCommitTimeMS 2,000 inside the remaining budget. Respect the existing driver
transaction API and fail closed if prerequisites/bounds cannot be established.
No integration invocation retry is implied. Connection/session cleanup must run
in finally; a cleanup error suppresses success and is retained without secrets.

Issue transaction: revalidate account and published scope; calculate bindings;
resolve owned issue identity or insert one preallocated challenge. Existing issue
replay conditionally increments its fence only while AVAILABLE/unexpired and
identically bound. Majority primary proof must find the exact committed owned
challenge before returning the issue DTO.

Acknowledge transaction: revalidate account/scope; read owned ack identity and
challenge. On a new request, require AVAILABLE, exact bindings, finite valid
interval and no revocation; preallocate one receipt ID/time. CAS on challenge
identity/owner/state/fence/expiry/bindings changes it to CONSUMED and sets the
receipt pair. Insert the exact receipt in the SAME transaction. If either write
fails, neither may commit. A replay conditionally fences the same CONSUMED
challenge/receipt identity without inserting or changing a receipt. The proposed
withdrawal shares that CAS fence, sets terminal revocation once, and preserves
any historical receipt. Duplicate-key or write conflicts get only bounded,
identity-checked resolution; no generic successful upsert or ignore-error branch.

After commit, perform a bounded primary majority read proving exact receipt and
challenge ownership, fingerprints, cross-links and transaction result. Repeat
current eligibility/publication/hash/policy checks and the live replay window.
No proof, unavailable state, intervening revocation, unsupported transaction or
uncertain acknowledgment means no successful receipt DTO. A verified transaction
commit and owned durable proof are both required; an idempotency lookup alone is
insufficient. Proof failure can coexist with a committed row: report uncertainty,
do not assert rollback or erase it. Explicit same-request recovery may succeed
only while all original constraints, including expiry, still hold.

The fence makes concurrent acknowledgement/replay/withdrawal decisions serialize
on a challenge. It does not freeze account/publication writers or prove that
content was displayed. Post-proof changes are possible, as with existing access
checks; stronger editorial/account fencing is a separate architectural decision.
Use trusted server UTC consistently; detect contradictory/future lifecycle data.
No arbitrary clock tolerance, client clock or TTL cleanup authorizes an action.
Windows/kernel stalls and server-clock integrity are operational limitations,
not absolute timing guarantees from this service.

C1 can validate a server-constructed pre-consumption metadata snapshot, mapping
authenticated userId to its studentId field and using ACKNOWLEDGEMENT_SERVICE
claims only as structure. Its ACTIVITY_CANDIDATE result is not authentication,
durability or replay proof. Real authorization, CAS and commit proof above supply
the acknowledgement record. Replays use the dedicated durable-receipt path, not
a fabricated AVAILABLE snapshot that bypasses C1's consumed-state refusal.
Do not change C1 or convert any C1/C2 result to Stage A VERIFIED.

### 19.8 Privacy, audit, retention and operational boundary

Minimize to IDs, digest bindings, timestamps and bounded server provenance above.
No raw answers, correct answers, source content copies, tokens, raw idempotency
keys, client IPs or user agents. Do not log command bodies, receipt documents or
private digests; sanitized error category/stage and nonsensitive correlation only.
No arbitrary per-account read/list capability or public data access is introduced.

Recommendation C2-P6: domain receipt plus immutable issuance provenance and fenced
challenge lifecycle is sufficient for this initial disposable activity producer.
Existing auth audit and B2 CONTENT_APPROVAL rubric audit remain unchanged. Neither
appendRubricAudit nor a boolean server-origin claim authorizes section evidence.
There is no existing typed section-acknowledgement audit event. If separate
auditLogs issuance/consumption/withdrawal events are required, explicitly add
audit.model.ts, audit.repository.ts and tests/auth-audit.test.ts to scope (11 ->
14 paths) and define minimal event schemas, authorization, transactional atomicity
and fail-closed audit failure. Do not misuse rubric events or add generic logging.

Initial verification uses synthetic disposable data only, erased by the separately
approved owned-database cleanup. No persistent operational use is approved. Before
that use, select a finite retention period (options: 7 or 30 days after expiry),
purpose/access policy and deletion authorization. No indefinite default or silent
TTL. Coordinate receipt and challenge deletion, account erasure, backup expiry and
restores. Retained key tombstones, if wanted, are a new privacy/schema decision;
after erasure, idempotency guarantees cannot extend indefinitely. Append-only
means no business edits, not exemption from approved privacy erasure. No erasure
worker, retention index, backup policy or persistent migration is implemented by
this increment. Ownership/hash metadata is still private account-linked data.

### 19.9 Exact proposed implementation inventory

| Operation | Exact path | Responsibility |
| --- | --- | --- |
| CREATE | apps/api/src/modules/progress/section-evidence-revision.ts | Strict server snapshot serialization and versioned digests. |
| CREATE | apps/api/src/modules/progress/section-evidence-challenge.model.ts | Challenge schema, bounds and immutable/lifecycle guards. |
| CREATE | apps/api/src/modules/progress/section-evidence-receipt.model.ts | Append-only activity receipt schema and allowlists. |
| CREATE | apps/api/src/modules/progress/section-evidence.repository.ts | Session-aware user/publication reads, exact indexes, CAS, transactions and majority proof. |
| CREATE | apps/api/src/modules/progress/section-evidence.service.ts | LOCAL-only trusted entry points, current authorization, commands, lifecycle, DTOs and sanitized errors. |
| CREATE | apps/api/tests/section-evidence.test.ts | Focused deterministic/service/adapter contract and security tests. |
| CREATE | apps/api/tests/section-evidence.integration.ts | Prepared disposable replica-set integration, not executed with implementation approval alone. |
| MODIFY | docs/features/F038-completion-rules.md | Plan, owner decisions and actual staged evidence. |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md | Partial C2 foundation/status/evidence, without completing F038. |
| MODIFY | docs/API_DESIGN.md | Explicit approved additive internal-only contract, no HTTP route. |
| MODIFY | docs/DATABASE_DESIGN.md | Explicit approved private collections/indexes/lifecycle and limitations. |

Exactly **seven creations and four modifications = eleven paths** for future
implementation. This planning gate changes only this feature document. No new
dependency, environment variable, controller, router, app.ts edit, Auth edit,
existing Concept edit or studentProgress change is needed for the recommended
bounded design. Transaction-aware reads belong inside the new adapter. Mandatory
auditLogs events need the three extra paths above. Monotonic editorial revisions
or cross-writer linearization need a separate inventory assessment; they are not
solved inside these eleven files. Stop before implementation if selected owner
options require additional files or contradict the canonical contract.

### 19.10 Proposed canonical amendments - not applied in this gate

| Canonical location | Existing contract preserved | Additive wording proposed for owner approval |
| --- | --- | --- |
| API_DESIGN.md, new refinement after F038 Stage B2 | Existing public Auth/Concept/Practice/progress routes, GET secrecy and diagnostic grading unchanged. | "F038 C2 proposes a LOCAL-only internal READ acknowledgement service. Owned challenge issue, explicit acknowledgement and approved withdrawal return allowlisted private activity DTOs only after current authorization, publication/binding validation and durable proof. No public endpoint, comprehension claim, VERIFIED evidence or completion qualification is introduced." Add the approved command/DTO/error tables from 19.2/19.6. |
| DATABASE_DESIGN.md, new refinement after F038 Stage B2 | studentProgress canonical; F036 attempts immutable; F037 activity-only; B2 diagnostic schemas unchanged. | "F038 C2 adds private sectionEvidenceChallenges and append-only sectionActivityReceipts for authenticated READ activity, with the exact schemas and three unique indexes in F038 19.4-19.5. Consumption and receipt insertion are atomic and majority-proven. Snapshot hashes are not monotonic editorial history. These rows cannot establish completion eligibility." Add the approved lifecycle, retention/erasure and WORM limitations. |

These are NEW proposed internal/data contracts, not clarifications that existing
schemas already implement. Approval must cover exact definitions/options and
selected decisions before additive canonical edits. No PRD change is proposed:
READ action history cannot replace PRD completion conditions. No breaking public
API change or alternate canonical completion schema is proposed. If review finds
an incompatible source requirement, stop rather than silently amend it.

### 19.11 Numbered C2 owner decisions

All recommendations below remain proposals; planning approval is not approval to
create schemas, indexes or execute service methods.

| Decision | Conservative recommendation | Alternative / approval boundary |
| --- | --- | --- |
| C2-P1 - Hash/version authority | Approve exact server snapshot algorithm/version in 19.3 for LOCAL activity only, accepting ABA and observation-time publication limits. | Monotonic publication history or cross-writer fences require architecture and file-scope expansion before implementation. |
| C2-P2 - Lifetime | Fixed five-minute (300,000 ms) server interval, no sliding refresh; exact expiry refuses. | Another explicit bounded duration requires test/policy-version reconciliation; no client override. |
| C2-P3 - Revocation | Owner-only internal withdrawal; terminal shared fence; CONSUMED history remains immutable but cannot replay after revocation. Content/policy mismatch also refuses without rewriting history. | If withdrawal is excluded, explicitly defer it and document absent manual revocation; Admin-wide/content-wide revocation needs a separate authority design. |
| C2-P4 - Receipt DTO | Exact five fields in 19.2; NOT_ESTABLISHED always. Issue/withdrawal have their separate fixed allowlists. | Any historical receipt query or richer provenance exposure is separate scope. |
| C2-P5 - Idempotency | Account+operation-scoped hashed UUID keys; exact bound fingerprints; no key reuse and strict original challenge expiry even for replay. | Durable historical replay beyond expiry needs explicit policy; neither mode proves comprehension. |
| C2-P6 - Audit | Domain receipt/issuance provenance only for initial disposable producer; preserve existing audit mechanism. | Mandatory auditLogs events expand scope by three exact audit/test files and require atomic audit semantics. |
| C2-P7 - Privacy/retention | Disposable synthetic use only initially; no persistent use until finite retention, coordinated erasure/backups/access are approved. | Choose 7/30-day retention or another bounded policy before persistent use; deletion/tombstone/worker changes need their own inventory. |
| C2-P8 - Canonical changes | Approve additive internal API and two private collection refinements in 19.10, exact eleven-file inventory and activity-only boundary. | No public API/UI, completion schema or trusted-certificate expansion without a new approval. |

### 19.12 Verification plan and subsequent gates

Future implementation/offline gate: focused tests for exact serialization/absence
rules/whitespace/content changes, current role/status/token and LOCAL refusal,
five-level ancestry and reference consistency, command/DTO allowlists, key hashing,
issue/ack binding conflicts, expiry equality/future/invalid times, ownership,
terminal revocation and replay fencing, conditional-write invariants, bounded
retry/cleanup failures, malformed stored rows, missing/incorrect/unverifiable index
definitions, proof loss and no successful result on uncertainty. Include no content
logging, no F036/F037 writes, no B2 grading and no Stage A VERIFIED mapping.
Use mocks only for offline transaction outcomes and label that evidence as such.
Relevant regressions cover Auth/Concept public reads, F036 persistence/disclosure,
F037 progress, Stage A, B1/B2 and C1 boundaries; no entire-suite reruns by default.
Run API build, TypeScript, lint, formatting, UTF-8/LF, diff/exact-scope/security
checks and a separate Critical/High/Medium/Low source-diff review with actual
file/line references for findings. No unresolved finding is silently accepted.

Separate guarded MongoDB approval is required after offline success: ordinary
unelevated owned native-handle/Job containment; common-microsecond UTC creation
identity; exact executable/parent/owner/live state; fresh disposable storage,
127.0.0.1:27018, f021-test replica set, deeplearner-f021-test only; PRIMARY before
empty-target verification; exact three-index allowlist and controlled readiness
states. Run prepared suite once with zero invocation retries. Live cases must
prove issue/consume/replay/withdrawal races, one receipt per challenge, rollback
on receipt insertion failure, majority ownership proof, isolation and nonmutation.
Controlled proof-loss injection is not real replica-set failover testing. Preserve
protected MongoDB/demo/development baselines; graceful owned shutdown, verified
Job empty, released port/handles and disposable-only cleanup, with forced/UNKNOWN
outcomes reported honestly. No persistent index provisioning is authorized.

C2 introduces **zero browser cases**; existing **141 NOT_RUN** and historical
Windows/F022/F024/F029 limitations remain unchanged. No browser exception transfers.
This internal stage needs no browser execution, but that is not browser PASS.

Plan is READY FOR OWNER DECISIONS, not implementation or schema approval. Next
gate: explicit acceptance/revision of C2-P1-P8, exact additive canonical wording
and eleven-path implementation scope (or separately reviewed expansion for a
selected alternative), followed only by authorized offline implementation.
Integration, C2 final review and any persistent/user-facing use remain separate
gates. Trusted section qualification, visualization validation, eligible graded
Practice evidence, completion workflow/revocation and release privacy obligations
remain outstanding. Keep full F038 IN_PROGRESS; STOP after this plan.

## 20. Stage C2 implementation and offline verification

### 20.1 Owner reconciliation and exact scope

**P1-P8 reconciliation PASS; OFFLINE IMPLEMENTATION PASS, partial F038 only.**
The owner approved the attached C2 implementation gate and exact eleven paths in
19.9. Their implementation directions number some decisions differently from the
planning table; this mapping preserves the actual contracts rather than treating
equal numbers as different policy authorizations:

| Owner implementation direction | Reconciled planning contract and implementation |
| --- | --- |
| P1 | 19.3 / C2-P1: server snapshot hashes and exact ordered serialization; no client hashes or monotonic-history claim. |
| P2 | C2-P2: fixed five-minute server UTC interval; equality is expired; no TTL dependency. |
| P3 | C2-P3: atomic one-use consumption; terminal owning-Student withdrawal, including consumed challenges without receipt edits; shared CAS fence. |
| P4 | C2-P5 / 19.6: exact same-key request replay requires current Student, bindings and owned durable proof; changed request conflicts. Original expiry still limits replay. |
| P5 | 19.5 / 19.7: exactly three unique secondary indexes, strict readiness, majority+journaled commit/proof, bounded retries and uncertainty refusal. |
| P6 | C2-P4: exact minimal five-field activity receipt and fixed NOT_ESTABLISHED; no VERIFIED or completion certificate. |
| P7 | C2-P6 / C2-P7: narrow domain provenance, central audit deferred, no WORM claim; initial disposable synthetic use only and persistent retention/erasure still unresolved. |
| P8 | C2-P8 / 19.10: additive internal API/database amendments only; existing canonical/public contracts and studentProgress preserved. |

No material conflict or additional path/dependency was required. The seven
creations are section-evidence-revision.ts, section-evidence-challenge.model.ts,
section-evidence-receipt.model.ts, section-evidence.repository.ts and
section-evidence.service.ts under apps/api/src/modules/progress, plus
apps/api/tests/section-evidence.test.ts and section-evidence.integration.ts.
Four modifications: this document, docs/DEVELOPMENT_ROADMAP.md,
docs/API_DESIGN.md and docs/DATABASE_DESIGN.md. Full exact paths remain in 19.9.
Stage C2 changes exactly eleven paths; prior F038 work is preserved, for twenty-seven
cumulative unique F038 paths. No Auth, audit, existing Concept, attempt, progress,
route, configuration, frontend or dependency file changed in this gate.

### 20.2 Implemented boundary and canonical consistency

createSectionEvidenceService is explicitly constructed with trusted existing token
verification/server configuration. No live caller, hook or public route imports it.
Current ACTIVE verified STUDENT and published five-level ancestry/reference checks
precede issuance/consumption; current account/content checks repeat at majority
proof. The new repository executes session-aware publishedConceptStages reads and
strictly validates projected stored structure before approved public DTO absence
normalization and the bounded versioned digest. Existing repositories are unchanged.

Challenge and receipt constructors strictly validate allowlisted fields, with no
implicit provisioning/buffering/casting and supported business mutation guards.
The only raw lifecycle write is an owned transactional exact-before-image CAS,
preserving immutable bindings and consumption history. Receipt creation is in the
same transaction; every successful receipt is majority-proven against the exact
owned challenge and immutable request. Replay cannot insert a second receipt or
extend expiry. Withdrawal is current-owner-only and terminal; it preserves history
and shares the fence with consumption/replay. No global account/editorial fencing
or instantaneous revocation is claimed.

The repository uses the corrected inherited transaction timeout policy: ten-second
budget, two-second proof reserve, at most three body executions, primary snapshot
reads, majority+journaled commit and bounded primary-majority proof. No conflicting
operation timeout override inside withTransaction. Uncertain commit, missing proof,
stale bindings, revoked/expired state, index or cleanup failure yields no success.
A committed historical receipt may remain after a refused/lost response; no false
rollback assertion. Receipt DTO is exactly id, conceptId, section, acknowledgedAt,
completionQualification=NOT_ESTABLISHED. No answers or sensitive record logging.

Canonical amendments implement only 19.10's approved additive internal commands,
DTO/errors, private schemas, exact three indexes, lifecycle and limitations.
studentProgress remains canonical; F036 durable attempts/disclosure and F037
activity-only reporting remain unchanged. No public grading/acknowledgement API,
completion qualification/persistence, production readiness, central audit expansion
or database WORM is documented. Retain PRD section 14's Topic-level requirements;
this READ action does not satisfy them or replace Stage A trusted evidence.

### 20.3 Offline verification evidence

| Check | Result and limit |
| --- | --- |
| Focused C2 suite | **46 PASS / 0 FAIL**, distinct top-level tests, apps/api/tests/section-evidence.test.ts. Earlier 42- and 45-test passing runs are subsets, not additional distinct coverage. |
| Relevant API regressions | **197 PASS / 0 FAIL**, fifteen existing files: auth-audit; completion-policy; concept-model/concept/concept-routes; output-grading; practice-attempt-model/practice-attempt-repository; practice-grading; practice/practice-routes; progress-model/progress/progress-routes; section-evidence-policy. |
| Total distinct offline tests | **243 PASS** across the focused and regression invocations. No integration file was executed. |
| API build | PASS, tsc -p apps/api/tsconfig.json. |
| API source/test/integration TypeScript | PASS, tsc -p apps/api/tsconfig.test.json, compile-only integration preparation. |
| Repository lint | PASS, eslint . --max-warnings=0. |
| Formatting | PASS, Prettier check on all seven new TypeScript files; docs remain ignored by existing formatter configuration. |
| UTF-8/LF, scope and whitespace | PASS; no BOM/CR, exact eleven gate paths, prior documentation prefix/history and all other repository source hashes preserved; git diff --check PASS. |

The initial sandbox test-loader invocation failed before tests with Windows
uv_os_get_passwd ENOMEM. Ordinary-user supported execution then passed; no security
policy, permission or dependency changed. Initial static checks found test-only
typing issues and two lint issues (control-regex syntax and throw from finally);
these were corrected within scope. The prepared runner now preserves execution
and cleanup errors without throwing from finally. Existing regression Mongoose
validateSync deprecation warnings were informational, not new C2 failures.

Focused coverage includes exact snapshot arrays/whitespace/bounds, account-scoped
key hashes, explicit acknowledgement/LOCAL gating/current authorization, ownership,
fresh bindings, expiry and replay, withdrawal and concurrent request outcomes,
rollback, unknown commit/majority-proof loss/cleanup refusal, bounded transaction
configuration, exact schemas/index definitions, source dependency/nonmutation
boundaries and strict stored optional fields. Mock transactions/adapters exercise
design and refusal paths only; these PASS results do not establish live MongoDB
atomicity, index enforcement, topology behavior or real failover.

### 20.4 Separate formal source/security review

Performed a separate source-diff review pass after implementation against all
eleven approved paths and source-of-truth amendments. **CRITICAL 0 / HIGH 0 /
MEDIUM 0 / LOW 0 unresolved findings.** One LOW validation finding was identified
and corrected within the approved strict-validation scope:

- In section-evidence.repository.ts, revision loading previously normalized optional
  Concept fields through conceptDetailDto before checking their stored structure.
  Explicit malformed nulls could be mistaken for legacy absence. Strict
  storedConcept validation now precedes normalization (lines 153 and 272); the
  focused adapter test at section-evidence.test.ts:849 refuses malformed examples,
  revise/keyPoints/memoryTrick while preserving genuine legacy absence. Resolved;
  no canonical contract or additional file change was necessary.

Review also checked native CAS state transitions/immutable consumption, exact
ownership proof, fingerprints, current role/publication/revisions, expiry at replay,
commit uncertainty, narrow native read projections, sensitive-data minimization,
index options/collation, transaction timeouts and canonical/implementation agreement.
No unresolved security finding or unapproved scope expansion remains. Review is
source-level and separate from verification execution, not a substitute for the
pending database integration or proof against privileged raw database writes.

### 20.5 Prepared integration, remaining limits and next gate

section-evidence.integration.ts is prepared, compile-checked and **NOT_RUN**:
twelve child cases plus the parent (thirteen Node test records if all execute).
It refuses nonexact LOCAL/loopback/replica-set/database configuration and requires
external retained-handle/Job/ordinary-user/storage/protected-baseline preflight
before entry. It verifies PRIMARY and empty target before creating eight explicitly
owned fixture/evidence collections; only three exact C2 secondary indexes are
provisioned. No attempt/progress/rubric/audit indexes or persistent setup.
Cases cover current authorization, all publication levels/references, issue/receipt
replay, content change, concurrent same/different keys, terminal withdrawal, expiry,
receipt-write rollback, controlled majority-proof loss, missing/nonunique indexes
and minimization/nonmutation. Controlled proof loss is not replica-set failover.
Owned collection cleanup and disconnect retain errors; the separately approved
launcher must own graceful MongoDB shutdown, Job emptiness, native handles/port/
storage cleanup and protected baseline verification. None occurred in this gate.

Snapshot ABA/publication-history limitations and strict replay expiry remain.
No persistent data use is approved before retention/access/coordinated erasure and
backup decisions. Future acknowledgement/checkpoint qualification, visualization
verification, eligible graded Practice/coverage/selection, completion lifecycle/
student workflow and release requirements remain unresolved. Stage A, B1, B2 and
C1 retain their prior implementation/evidence boundaries.

C2 adds **zero browser scenarios**; all **141 expected browser scenarios remain
NOT_RUN**. No earlier browser exception transfers and no production claim is made.
F001-F037 remain APPROVED_COMPLETE for local development, F038 **IN_PROGRESS**,
F039 NOT_STARTED. No Git staging/commit/push or MongoDB/browser/synthetic execution.
Next owner gate: review this offline evidence and separately approve one guarded
disposable C2 MongoDB integration with the exact three-index allowlist and existing
ownership safeguards. STOP here; no automatic integration or full F038 completion.

## 21. Stage C2 guarded MongoDB attempt - BLOCKED before integration

The owner authorized one guarded disposable C2 integration gate, preserving the
exact prepared suite and three-index allowlist. One fresh MongoDB startup and one
initializer ran; **zero integration-suite invocations** occurred. No implementation,
test assertions, canonical documentation, roadmap, dependencies or configuration
changed. This section is evidence only; F038 remains **IN_PROGRESS**.

Evidence directory:
.cache/f038-c2-integration-2026-10-19-14-22-08-6961d7/

### 21.1 Preflight observations and exact stopping condition

- Ordinary unelevated REDGOLDMARK42\Shreeji, PowerShell 7.6.7; enabled-admin false.
  Supported ordinary-user execution was used because the sandbox account cannot
  read the private development-storage ACL. No permission or security-policy change.
- Unchanged LocalProcessOwner.cs SHA-256
  8B8911A51A766DF3057570E2F926E1EFCDDD29A8271C41F0351DE036A32B8FB4.
  Fresh empty Job with atomic child assignment, KILL_ON_JOB_CLOSE and no breakaway.
  Port 27018 was initially free; fresh GUID-owned non-reparse disposable storage
  was empty and owned by the approved user.
- MongoDB PID 16332 and initializer Node PID 18148 individually passed retained
  native PID/handle, independent native inspection, executable, current parent,
  GetOwner, exact Job and live-state checks before database access. MongoDB was
  rechecked before connection and before forced cleanup. No PID-only termination.
- MongoDB native creation UTC was 2026-10-19T14:22:11.3163537Z; CIM was
  2026-10-19T14:22:11.3163530Z. Exact retained/inspection FILETIME matched
  134368933313163537. Common integer normalization `(ticks / 10L) * 10L` yielded
  639280165313163530 for both; original raw values remain in identity evidence.
  No tolerance interval or asymmetric rounding was introduced.
- The owned listener was exclusively 127.0.0.1:27018. Child environments were
  explicit allowlists, without .env, inherited NODE_OPTIONS, application secrets
  or persistent/Atlas connection settings. Private stdin barriers prevented the
  Node initializer's database code from proceeding before ownership validation.
- The initializer verified exact executable arguments/storage/loopback target,
  initialized f021-test, observed writable PRIMARY, then checked permitted database
  names and empty deeplearner-f021-test. It emitted:
  `{"Primary":"PASS","EmptyTarget":"PASS","IndexDefinitions":"PASS","IndexCount":3}`.
- Nevertheless the initializer process did not exit within its **35-second child
  deadline**. The runner stopped with **INITIALIZATION_DEADLINE**, before loading
  section-evidence.integration.ts. The runner did not accept its readiness output
  as successful completed initialization. result.json therefore retains Primary
  and IndexDefinitions as NOT_RUN stage results, distinct from the child's observed
  readiness/definition output. The underlying reason for process nonexit is
  **NOT_ESTABLISHED**; do not infer a database/application defect or silently alter
  the runner to force it to pass.

### 21.2 Index and integration outcome

The initializer compared the model-declared definitions and options against the
fixed canonical list before database access:

| Collection | Name | Exact ordered key | Constraint |
| --- | --- | --- | --- |
| sectionEvidenceChallenges | uq_section_evidence_issue_key | {userId:1,issueKeyHash:1} | UNIQUE |
| sectionActivityReceipts | uq_section_activity_challenge | {userId:1,challengeId:1} | UNIQUE |
| sectionActivityReceipts | uq_section_activity_ack_key | {userId:1,ackKeyHash:1} | UNIQUE |

**Definition comparison PASS; C2 index provisioning NOT_RUN (zero created).**
The initializer performs no C2 provisioning; that code belongs to the uninvoked
suite. No prerequisite indexes were required or added. No C2 index log matches
were observed. Internal replica-set bookkeeping is confined to the fresh owned
disposable storage; no persistent local, Atlas or production target was accessed.

**Integration: 0 PASS / 0 FAIL / 13 prepared records NOT_RUN**, comprising twelve
child cases plus the parent. These are NOT_RUN coverage counts, not emitted test
results: no integration stdout or invocation exists. Authorization/publication,
snapshot binding, expiry, withdrawal, replay/concurrency, receipt atomicity/
durability, index refusal and secrecy/nonmutation remain live **NOT_VERIFIED**.
The retained **46 focused + 197 regression = 243 distinct offline PASS** and their
source/security evidence remain unchanged; no passing offline suites were rerun.
No real failover or uncertain-commit test occurred in this blocked gate.

### 21.3 Cleanup, initial uncertainty and follow-up resolution

The runner did not attempt a database-client shutdown after the initializer failed
its exit gate. Graceful shutdown is **NOT_RUN**, never PASS. It used the verified
owned Job's ForceStop once, then observed **Job ActiveCount=0** and disposed owned
handles. Runner duration including its initial cleanup/baseline checks was
**45.54 seconds**. MongoDB and initializer exit codes are **UNKNOWN**: they were
not observed before handle release; no inferred code is substituted.

Initial result.json honestly preserves the cleanup uncertainty: the immediately
sampled listener table still contained 127.0.0.1:27018/PID 16332 after Job-empty
observation. Storage deletion was therefore refused with
STORAGE_RELEASE_BOUNDARY_UNKNOWN. It also retains
GRACEFUL_CLIENT_UNAVAILABLE_BEFORE_VERIFIED_PRIMARY; the runner's accepted
initialization stage, not the child's readiness message, controls that branch.

Read-only follow-up subsequently confirmed port 27018 released and recorded
MongoDB/initializer PIDs absent. Continuing the already authorized cleanup, the
ordinary user verified exact resolved GUID root, matching owner marker/account,
known root entries and no reparse/outside paths before deleting only that run's
disposable storage. **Storage removal PASS**; follow-up evidence is
follow-up-cleanup.json, observed 2026-10-19T14:24:06.3182237Z. The original result
was not overwritten. No additional process termination, MongoDB connection,
initializer correction or integration rerun occurred during follow-up.

Protected MongoDB PID 5144 on 127.0.0.1:27017 and both baseline development Node
identities retained their PID/parent/creation bindings; their historical baseline
also matched before startup. Persistent demo-storage path/length/write-time
metadata was byte-identical before/after. Protected databases were not queried;
these observations establish process/listener/storage-metadata preservation, not
a new query of their logical contents. All **462 source-file hashes** remained
unchanged before this evidence-only append. Diagnostic artifacts remain only in
the ignored evidence directory; the temporary Playwright prototype was untouched.

### 21.4 Status and next owner gate

Overall **BLOCKED**, with owned forced cleanup completed and initial uncertainties
preserved. No C2 application or integration assertion defect was established.
The initializer's nonexit requires separately approved, bounded lifecycle diagnosis
and a justified temporary in-memory runner correction before a fresh integration
attempt may be authorized. Do not retry or change test expectations automatically.

F001-F037 remain APPROVED_COMPLETE for local development; F038 **IN_PROGRESS**;
F039 NOT_STARTED. All **141 browser scenarios remain NOT_RUN**, C2 adds zero,
and no prior browser exception transfers. No Git staging/commit/push, browser,
production deployment, persistent index provisioning or future-feature work.
STOP after this blocked gate and its ownership-safe cleanup; C2 final acceptance
and full F038 completion are not claimed.

## 22. Stage C2 initializer diagnosis and conditional guarded integration - PASS

The owner authorized diagnostic-first lifecycle investigation, the smallest
justified temporary runner/initializer correction and one conditional fresh
integration invocation. Section 21's blocked startup, forced cleanup, UNKNOWN
exit codes and follow-up storage removal remain unchanged. No application,
integration-test, model, helper, canonical architecture or roadmap file changed.
Only this F038 evidence document is updated in the repository.

Diagnostic evidence:
.cache/f038-c2-initializer-diagnostic-2026-10-19-15-14-19-f753a2/

Fresh guarded-run evidence:
.cache/f038-c2-integration-corrected-2026-10-19-15-15-42-8caea7/

### 22.1 Exact lifecycle cause - CONFIRMED

Retained initializer source completes server-argument verification, replica-set
initialization, writable PRIMARY and empty-target verification, then closes its
owned MongoClient in finally. The prior MongoDB log independently shows PRIMARY
at 14:22:13.695Z and both initializer connections ending at 14:22:13.768Z, with
connectionCount=0. The earlier readiness output was therefore not evidence that
the parent's retained-handle exit wait had completed.

The parent's StartNode uses the correct retained Child.Wait/WaitForSingleObject
process handle, not a PID lookup or Job-wide wait. Its 35-second limit starts
after identity checks and sending GO, covering remaining initializer module work,
startup/PRIMARY verification, connection cleanup and natural event-loop exit.
It does not measure only PRIMARY readiness and was not increased.

The actual defect was the private one-shot stdin barrier: the parent retained its
write end while waiting for child exit; the child paused stdin after GO but did
not destroy its still-referenced read end. One bounded, database-free diagnostic
used the same module imports and verified native-handle/Job ownership. It observed:

- BEFORE_STDIN_CLOSE: exactly one active resource, PipeWrap, and one referenced
  Socket identified as process.stdin; stdin was paused, undestroyed and referenced.
- Both the application-owned and default Mongoose instances had readyState=0.
  No database connection or MongoDB startup occurred. No timer or other persistent
  resource was observed in that snapshot.
- Closing only this process's stdin produced zero active resources/handles and
  NATURAL_BEFORE_EXIT. The process exited naturally with **code 0**, no forced exit
  or termination. Diagnostic Job empty, handles released, protected process/demo
  metadata/source baselines unchanged. Diagnostic duration **4.82 seconds**.

Sanitized evidence contains only resource categories, stdin flags, connection-state
numbers and process-identity metadata; no credentials, URIs, private answers,
tokens or database documents. Internal handle enumeration is diagnostic-only,
not an application authorization or production instrumentation contract.

### 22.2 Narrow temporary correction and fresh safety preflight

The in-memory Node barrier now performs:

```text
pause stdin -> validate exact GO -> destroy this one-shot stdin -> run helper work
```

It previously omitted the destroy step. No process.exit, timeout increase, ignored
error, additional invocation retry or ownership relaxation was introduced. The
same barrier is used by initializer, integration wrapper and shutdown helper;
none needs further input after GO. Existing MongoClient.close/finally remains.
Initializer instrumentation additionally records CLIENT_CLOSE_BEGIN/DONE and
sanitized resource/state categories. The corrected actual initializer logged close
completion and disconnected Mongoose, then exited **0** within the unchanged
35-second bound. Two closing TCP resource categories were visible immediately
after close completion; natural process exit, rather than a claim of instantaneous
zero handles at that snapshot, establishes completion of its lifecycle.

Before fresh MongoDB startup, ordinary unelevated REDGOLDMARK42\Shreeji was
reverified. The previous storage root and recorded MongoDB/initializer/diagnostic
PIDs were absent. Port 27018 was free. Fresh GUID-owned, empty, non-reparse storage
and an empty native Job were established; LocalProcessOwner.cs hash remained
8B8911A51A766DF3057570E2F926E1EFCDDD29A8271C41F0351DE036A32B8FB4.
No helper/source/security policy changed.

Fresh MongoDB PID 22860 individually passed retained and independent native
handle identity, executable, parent, GetOwner, exact Job membership and live-state
checks before connection/suite/shutdown. Native raw UTC creation was
2026-10-19T15:15:44.5630299Z, CIM 2026-10-19T15:15:44.5630290Z; exact native
retained/inspection FILETIME matched 134368965445630299. Common integer microsecond
normalization yielded 639280197445630290 for both UTC tick values, with no tolerance
or asymmetric rounding. Node initializer, suite and shutdown helpers passed the
same checks before private startup barriers were released. Every launched child
entered the exact owned Job atomically.

The initializer verified 127.0.0.1:27018, exact fresh storage, f021-test and its sole
loopback member; observed writable PRIMARY before enumerating allowed database
names and empty deeplearner-f021-test. Initializer exit **0** was required and
observed before suite invocation. Explicit environments excluded .env, inherited
NODE_OPTIONS, application credentials and persistent/Atlas targets. Protected
MongoDB on 27017 was never connected to or targeted.

### 22.3 Exact disposable index provisioning - PASS

The suite provisioned the same three canonical secondary definitions, plus normal
collection _id defaults, only in the verified empty disposable target:

| Collection | Name | Exact ordered key | Constraint |
| --- | --- | --- | --- |
| sectionEvidenceChallenges | uq_section_evidence_issue_key | {userId:1,issueKeyHash:1} | UNIQUE |
| sectionActivityReceipts | uq_section_activity_challenge | {userId:1,challengeId:1} | UNIQUE |
| sectionActivityReceipts | uq_section_activity_ack_key | {userId:1,ackKeyHash:1} | UNIQUE |

Exact declared model options and readiness checks passed: v2, simple binary
collation, correct names/order/uniqueness and no unsupported index options. No
F036/F037/B2 prerequisite index was needed or provisioned. No persistent index,
backfill or migration occurred. Only synthetic user/hierarchy/evidence fixtures
were created in eight explicitly owned collections.

index-operations.json captures the three initial createIndexes oplog commands.
The prepared negative control subsequently dropped the disposable issue-key
index, recreated the same name/key NONUNIQUE to verify refusal, then restored
UNIQUE. Those controlled states are not additional approved production definitions.
They use index-build commands not included in that narrow createIndexes oplog
projection; sanitized index-build-observations.json and mongod.log retain their
server-side build metadata, including repeated build-stage log observations.
Do not treat the three-entry projection as a complete count of all index-build
operations or the repeated log observations as separate new definitions.

### 22.4 Single prepared suite invocation - 13 PASS / 0 FAIL

Invoked the unchanged section-evidence.integration.ts **once**, zero invocation
retries. Node reported **13 PASS / 0 FAIL / 0 NOT_RUN**, including the parent and
these twelve child cases:

1. Current STUDENT and LOCAL-only authorization, including invalid token/Admin
   claim and current stored role/status/verification refusal.
2. Five published levels and denormalized reference-consistency refusal.
3. Original issue identity/expiry, exact five-field NOT_ESTABLISHED receipt,
   owned replay, cross-account refusal, consumed-challenge refusal and changed
   acknowledgement challenge with the same key conflict.
4. Fresh READ snapshot changes invalidate acknowledgement.
5. Concurrent identical first acknowledgements converge to one receipt.
6. Concurrent distinct acknowledgement keys consume once with one receipt.
7. Terminal withdrawal before/after consumption preserves immutable history and
   blocks subsequent acknowledgement/replay.
8. Expiry uses server time at the exact five-minute boundary, without TTL cleanup.
9. Controlled receipt-insertion failure rolls back actual challenge consumption.
10. Controlled majority-proof loss suppresses a successful result while committed
    history remains; explicit same-request recovery retains one receipt.
11. Live missing and nonunique issue-key index states refuse writes, then restore
    the original unique definition.
12. No sensitive fields duplicated into new records and no attempt/progress/
    assessment/audit records created.

Node suite duration **1.633 seconds**. Full fresh runner preflight/startup/suite/
graceful cleanup/baseline verification duration **12.71 seconds**. Retain the
existing **46 focused + 197 regression = 243 distinct offline PASS**; these passing
offline suites were not rerun. No test expectations or application behavior changed
to obtain the integration result.

Successful receipt operations exercised the existing snapshot transaction,
majority+journaled commit and exact owned primary-majority proof. Failures returned
no activity result. Receipts remained ACTIVITY_ONLY/NOT_ESTABLISHED; no answers,
Stage A VERIFIED evidence, F036/F037 mutation, completion state or mastery was
introduced. F036/F037 collections were absent in this standalone fixture setup;
their record-mutation compatibility continues to rely also on retained source/
offline regression evidence, not a new live test with populated historical records.

Evidence limits: proof loss was controlled missing-proof injection, not real
MongoDB failover/network/UnknownTransactionCommitResult injection. Server time was
advanced in the test's injected clock to the expiry boundary, not a five-minute
wall-clock wait. Terminal withdrawal paths were live, but no simultaneous
acknowledgement-versus-withdrawal race or guarantee of every serialization order
was exercised. Broader malformed inputs, all index-option variants, issue-key
changed bindings, cleanup failures and lifecycle contradictions retain their
offline coverage. No comprehension/completion qualification is established.

### 22.5 Graceful cleanup and protected baselines - PASS

- Application/test connections closed and all eight owned fixture collections
  removed; independent shutdown inspection observed zero remaining test collections.
- Initializer **0**, integration **0**, shutdown helper **0**, MongoDB **0**, each
  observed through retained owned handles. MongoDB shutdown was graceful; **no
  forced termination** and no UNKNOWN exit code in this fresh attempt.
- Owned Job ActiveCount=0, handles released, port 27018 released and positively
  identified GUID storage removed. No PID-only operation or unrelated termination.
- Protected MongoDB PID 5144/listener 27017 and both development Node identities
  retained exact baseline PID/parent/creation observations. Persistent demo-storage
  metadata was byte-identical before/after. Protected logical contents were not
  queried; preservation evidence is process/listener/storage metadata and exclusion
  from all target connections.
- All **462 source-file hashes** remained unchanged before this evidence-only
  append. Diagnostic artifacts remain in ignored .cache evidence directories; the
  temporary Playwright prototype was not modified or executed.

**Conditional integration gate PASS; ready for separate C2 final source/security/
architecture review.** This is not C2 final acceptance or full F038 completion.
Snapshot ABA/publication-history limitations, bounded replay expiry, persistent
privacy/retention/erasure/backups, trusted completion qualification and future
visualization/Practice/completion workflows remain unresolved as documented.
F001-F037 remain APPROVED_COMPLETE for local development; F038 **IN_PROGRESS**;
F039 NOT_STARTED. All **141 browser scenarios remain NOT_RUN**, C2 adds zero, and
no browser exception or production approval is implied. No Git staging/commit/
push, persistent provisioning, new infrastructure/dependencies or F039 work.
STOP after this single conditional attempt and its evidence update.

## 23. Stage C2 final security, transaction and architecture review

**STAGE C2 FINAL REVIEW PASS — PARTIAL F038 FOUNDATION**

The owner authorized this final source/security/architecture review against
Sections 19-22, with conditional acceptance documentation only in this feature
file. F038 remains **IN_PROGRESS**. This is not full F038 acceptance, Git delivery,
production approval or authorization to implement a subsequent stage.

### 23.1 Reviewed scope and source identity

Reviewed the complete C2 addition against the exact eleven paths in Section 19.9:
seven created TypeScript source/test files and four modified documentation files.
Review covered the revision helper, challenge and receipt models, repository,
service, focused tests, integration suite, feature plan/evidence, roadmap and both
canonical architecture amendments. There are no additional C2 paths or deletions.
The seven source/test files match the successful guarded integration's retained
source hashes. Only this document's authorized evidence has changed since that
run; earlier Stage A/B1/B2/C1 source and evidence remain unchanged.

**Final findings: CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0 unresolved.** No new
source/security defect requiring a file/line finding was identified. The prior
LOW optional-field normalization finding remains resolved by strict storedConcept
validation before DTO normalization, as documented in Section 20.4; do not erase
that history or represent it as a new unresolved finding.

### 23.2 Final source and transaction findings

| Reviewed contract | Source conclusion and evidence boundary |
| --- | --- |
| Internal and LOCAL-only | createSectionEvidenceService checks trusted server APP_ENV before every operation. It uses the existing access-token verifier; no public route, UI, job, automatic submission hook or client-configured authority is registered. |
| Current STUDENT ownership | Verified token identity determines the owner. Current ACTIVE, verified STUDENT is rechecked before transaction work, inside work and at proof. No request account override or key-only authorization; existing Auth/session semantics are not extended into a new live-session claim. |
| Published scope and trusted revisions | Reuses publishedConceptStages for Concept/Topic/Module/LearningPath/Technology publication and full denormalized references. Strict projected structure precedes approved DTO absence normalization and server-computed ordered SHA-256 snapshots. No client hash/policy claim is accepted. |
| Expiry and withdrawal | Server UTC fixes issuedAt/expiresAt to exactly five minutes. Exact expiry, contradictory/future metadata, stale content/policy and terminal revocation refuse. Current owner may withdraw unavailable/unpublished content to restrict the challenge, as approved; withdrawal cannot authorize acknowledgement. |
| Atomic one-use consumption | Exact owned before-image CAS and shared decisionFence serialize consumption/replay/withdrawal. Receipt insertion and CONSUMED transition occur in one snapshot transaction; failures roll back together. Immutable ownership/bindings and consumed receipt/time cannot be reset. |
| Append-only action history | Strict typed receipt schema and supported document/query/bulk mutation guards protect application business operations. Terminal withdrawal retains historical receipt data. Privileged raw database access is outside this boundary; no WORM claim. |
| Idempotency and concurrency | Account/operation-separated key hashes and bound request fingerprints distinguish exact replay from changed requests. Same receipt is returned only after fresh scope/lifecycle checks and owned durable proof; another key cannot consume again. Shared CAS, unique keys and bounded conflict handling prevent duplicate successful consumption. |
| Index readiness | Every operation verifies transaction-capable writable PRIMARY/session prerequisites, exact required names/key order/v2/uniqueness/options and simple collation. Missing, incorrect or unverifiable readiness fails closed; no collection/index provisioning or historical bypass in service/repository. |
| Majority durability and proof | Corrected inherited driver transaction timeout policy, primary snapshot reads and majority+journaled commit precede bounded primary-majority proof of exact challenge/receipt identity, ownership, bindings, fingerprint and cross-links. Callback reentry/conflicts are bounded; no invocation retry is introduced. |
| Uncertainty and cleanup | Unknown commit, absent/inconsistent proof, stale/revoked/expired state or cleanup error cannot return a successful receipt. Session cleanup is attempted in finally. The installed driver's completed-transaction endSession path releases client-side session resources without a new server endSessions request; the review does not claim hard guarantees against kernel/event-loop suspension. |
| Data minimization and secrecy | Allowlisted commands/DTOs, bounded correlation and hashed keys; no raw answers, expected answers, source content copies, access tokens or raw idempotency keys stored in receipts or logged. Errors are sanitized. No correct-answer loading/disclosure path is called. |
| Existing feature isolation | No F036 attempt, F037 studentProgress, B2 assessment/audit writer or F039 module is invoked or modified. Returned completionQualification remains NOT_ESTABLISHED; no Stage A VERIFIED adapter, comprehension proof, grading, completion state or mastery is produced. |

This was source review and retained-evidence inspection only. No tests, services,
MongoDB connections, process diagnostics or browser execution were performed in
this review gate. No application, test, configuration or dependency correction
was necessary or authorized.

### 23.3 Canonical architecture consistency - PASS

Compared API_DESIGN.md and DATABASE_DESIGN.md C2 refinements with their pre-C2
approved contracts, PRD section 14, System Architecture, Sections 19.10/20.1 and
completed F030-F037 contracts. SHA-256 prefix comparison confirms that both
documents retain their complete pre-C2 text byte-for-byte; C2 amendments are
additions only. No canonical document is edited in this review.

The additions describe a LOCAL-only internal READ activity producer and private
challenge/receipt collections, not public READ-evidence endpoints or a new Auth
strategy. Existing Practice retrieval/unlock/disclosure and public progress DTOs
remain unchanged. studentProgress stays canonical for future completion summaries.
Authenticated acknowledgement demonstrates an action only, not comprehension,
verified section completion or PRD Topic-level completion. Snapshot hashes do not
establish monotonic revision/publication history, prevent identical restored
content from matching, or fence every editorial/account writer. Append-only
application guards are not database WORM. No production readiness is implied.
No source-of-truth contradiction or unapproved architectural change was found.

### 23.4 Retained verification and operational history

| Retained evidence | Result and qualification |
| --- | --- |
| C2 focused tests | 46 PASS. |
| Relevant regressions | 197 PASS; 243 distinct offline tests including focused coverage. |
| Build/static/security | API build, source/test TypeScript, repository lint, targeted formatting, UTF-8/LF, scope/whitespace and security checks PASS, retained from implementation. Not rerun here. |
| Guarded MongoDB suite | 13/13 PASS, including twelve children and parent; one invocation, no suite retry. |
| Index definitions/readiness | Three unique secondary definitions verified; live missing/nonunique issue-key index refusal and restoration PASS, no prerequisite or persistent provisioning. Other option variants retain offline coverage. |
| Cleanup | MongoDB, initializer, suite and shutdown helper each exited 0; graceful shutdown, empty Job, released port/handles, removed owned storage and unchanged protected baseline observations. |
| Initializer history | Section 21 blocked before suite/provisioning, forced owned-Job cleanup and UNKNOWN exits retained. Section 22 confirms referenced paused stdin, bounded database-free diagnosis and minimal stdin destruction after exact GO, without increasing the 35-second deadline or forcing process exit. |

Section 22's limitations remain: controlled missing-proof injection is not real
MongoDB failover/network/unknown-commit testing; expiry used a controlled server
clock, not a wall-clock five-minute wait. Concurrent first acknowledgements were
live, but simultaneous acknowledgement-versus-withdrawal and all serialization
orders were not demonstrated in that single suite. Broader role-transition/
malformed-input/index-option/cleanup combinations retain offline evidence. The
standalone disposable suite had no populated F036/F037 historical records; no
stronger live mutation-compatibility claim is added. Protected database logical
contents were not queried; preservation is based on exclusion, process/listener
identity and persistent demo-storage metadata. These are disclosed limits, not
new PASS claims.

### 23.5 Remaining F038 work and approval boundary

C2 acceptance is limited to authenticated READ **ACTIVITY_ONLY** receipts. It does
not promote C1 metadata, ungraded F036 attempts, F037 activity counts or B2
DIAGNOSTIC assessments into completion evidence. Still outstanding:

- Other trusted section-evidence producers and approved acknowledgement coverage
  for EXAMPLE/optional REVISE; no inferred comprehension from visits or clicks.
- Server-authored, server-verified VISUALIZE checkpoints, response validation,
  accessible alternatives and required checkpoint coverage.
- Completion-qualifying Practice assessment provenance/grading integration; no
  invented score or automatic qualification of diagnostic/ungraded history.
- Approved score selection, qualifying attempts, coverage and threshold-source
  policy; default 70% and approved Stage A minimum sections remain unchanged.
- Canonical studentProgress completion persistence, initiation/idempotency rules
  and accessible student completion workflow/UI.
- Authoritative revision/history, invalidation, revocation and reconciliation
  semantics beyond C2 snapshot/current-observation and terminal challenge rules.
- Privacy/access, finite retention, coordinated erasure/backups, persistent index
  provisioning and separately approved release/readiness prerequisites.

C2 introduces **zero browser cases**. All **141 expected browser scenarios remain
NOT_RUN**, with historical Windows/F022/F024/F029 limitations preserved. No previous
feature's browser exception transfers. Future UI/browser acceptance and production
release remain separately owner-gated; no primary-host Playwright execution is
authorized by this review.

F001-F037 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT. F038 remains
**IN_PROGRESS**, partial foundations only; F039 remains NOT_STARTED. Next gate:
owner review of this C2 stage acceptance and explicit authorization of the next
bounded F038 design increment. No next-stage plan/implementation, Git delivery,
full-feature READY_FOR_REVIEW/APPROVED_COMPLETE or production activity follows
automatically. STOP after this review and feature-document evidence append.

## 24. Stage C3a planning - pure visualization checkpoint verification

**PLAN READY - PROPOSED CONTRACT; IMPLEMENTATION NOT AUTHORIZED.** The owner
authorized detailed planning in this feature document only. F038 remains
IN_PROGRESS; F001-F037 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT and F039
remains NOT_STARTED. Sections 1-23 and all historical evidence remain unchanged.
This section does not supersede the earlier stage boundaries or claim that a
trusted VISUALIZE producer, student interface or completion workflow exists.

### 24.1 Source reconciliation and smallest increment

Sources: AGENTS.md; PRD sections 14, 16, 74 and 96; SYSTEM_ARCHITECTURE.md's
server-authoritative modular-monolith boundary; API_DESIGN.md's F026 persistence,
Stage A and C2 refinements; DATABASE_DESIGN.md's visualization, studentProgress
and C2 contracts; completed F026-F029 plans; and F038 Sections 17-23.

- PRD section 14's required visualization/Practice and configured passing-score
  conditions are not satisfied by comparing one checkpoint response. Concept
  candidate eligibility, Topic aggregation and mastery remain separate.
- F026 validates authored graph data and references inside a document; it does
  not implement Admin authorization, review/publication operations or a trusted
  checkpoint catalog. Its strict authored schema has no checkpoint fields.
- F027/F028 render graphs, explanations and client-only playback controls. Their
  selected steps, timers and completed presentation state are not server evidence.
  Graph steps have no stable checkpoint identity; an array position is insufficient.
- F029's reviewed closure fixture is not a canonical published Concept-bound
  server definition. It cannot become authoritative merely by being imported.
- C1 validates supplied checkpoint metadata, not response correctness. C3a adds
  actual deterministic single-choice comparison, without authenticating metadata.
- C2 is a LOCAL-only internal READ producer. Its READ-specific models, policy,
  snapshot algorithms and receipt DTO cannot be relabelled VISUALIZE unchanged.

Recommend a disconnected pure verifier before an internal server-owned producer,
and that producer before full Student Visualize integration. Only the first
increment is proposed here. It requires no API/database amendment or dependency.
No source conflict or additional required path was identified for this boundary.

### 24.2 Proposed function, schemas and resource bounds

Proposed export in the future visualization module:
verifyVisualizationCheckpoint(input: unknown): VisualizationCheckpointResult.
Accept unknown at runtime and validate before comparison. The following is an
internal verification projection, not a persisted authoring schema or public DTO.

Exact root keys, all required:

| Field | Proposed value |
| --- | --- |
| schemaVersion | Positive safe integer; only literal 1 supported. |
| expected | Exact binding object below; supplied independently by the caller's future trusted resolver, never copied from student input as authority. |
| definition | Exact binding object plus responseType, choices and expectedChoiceId. No approval flag or authorization claim. |
| response | Exact binding object plus responseType and selectedChoiceId. No expected choice, choices array, approval flag or extra fields. |

The same eight binding keys are required in expected, definition and response:

| Exact key | Validation and meaning |
| --- | --- |
| conceptId | Canonical lowercase 24-hex Concept ObjectId string. |
| visualizationId | Canonical lowercase 24-hex visualization ObjectId string. |
| conceptRevision | Case-sensitive ASCII revision token, 1-128 characters. |
| visualizationRevision | Same bounded revision-token syntax; distinct from schemaVersion or an unbound playback step. |
| checkpointId | Same bounded token syntax; stable authored identity, not an array index. |
| checkpointVersion | Integer 1 through Number.MAX_SAFE_INTEGER. |
| policyId | Same bounded token syntax; evidence-policy identity, not a credential. |
| policyVersion | Integer 1 through Number.MAX_SAFE_INTEGER. |

Token syntax is an ASCII letter or digit followed by zero through 127 ASCII
letters/digits/dots/underscores/colons/hyphens. Match the complete string, including
rejecting trailing newlines. No trimming, case folding, Unicode normalization,
numeric/string coercion or fallback revisions. These opaque tokens align with C1;
the verifier neither generates hashes nor establishes authoritative freshness,
monotonic publication history, approved versions or immutable catalog identity.

Definition-specific fields:

| Exact key | Proposed value |
| --- | --- |
| responseType | Bounded token; the only supported value is SINGLE_CHOICE. |
| choices | Dense array of 2-8 strict objects, each containing exactly id and label. |
| choices[].id | Lowercase ASCII letter followed by zero through 63 lowercase ASCII letters/digits/hyphens. Stable within this exact checkpoint definition; full-string match. |
| choices[].label | Nonblank, well-formed Unicode text, 1-240 UTF-16 code units; no C0/C1 control characters. Preserve text exactly; treat it as inert data. |
| expectedChoiceId | Same choice-id syntax, matching exactly one declared choice id. Server-private in any future integration. |

Choice ids must be unique. Exactly equal labels are also refused to avoid an
identically labelled choice set; do not silently deduplicate or normalize labels.
Semantic ambiguity, adequate distractors and educational meaning still require
human authoring/review: different strings are not proof of an unambiguous task.
Definitions with a missing/out-of-set expected choice or contradictory choice
metadata are invalid, not an incorrect student response.

Response-specific fields are responseType (same token/support rules) and
selectedChoiceId (same choice-id syntax). A singular required string represents
exactly one selection. Arrays, multiple selections, free text, missing/null/blank
selections, ordinal selection and coerced numbers are never accepted. A validly
formed id outside the authored choice set is refused, not scored incorrect.

All nested objects use exact own-key allowlists; no optional/unknown fields or
explicit undefined. Accept ordinary or null-prototype plain data objects only.
Bound safe inspection to depth <=5, <=32 own keys per object and <=256 visited
values, with <=16,384 aggregate UTF-16 string code units. Apply individual string
length limits before scanning. Arrays must be dense, <=8 entries and have only
ordinary indexed data properties plus length. Reject proxies, accessors, symbol/
nonenumerable keys, custom prototypes, cycles, executable values and malformed
Unicode without invoking supplied getters, conversion methods or callbacks.
These are deterministic structural limits, not promises of hard execution deadlines
against engine/kernel suspension. Reuse native inspection/existing validation
dependencies locally within the proposed file; no shared-helper refactor.

### 24.3 Comparison, exact output and deterministic refusal precedence

After validation, require exact equality of every binding field across expected,
definition and response. A well-formed unsupported responseType refuses even if
both sides claim it; two matching claims never enable a new format. Validate
choice membership before strict selectedChoiceId === expectedChoiceId comparison.
Do not compare generic answer strings, infer a correct choice from graph state,
count playback duration or generate a numeric score.

Return exactly these four fields on every path:

| Field | Evaluated response | Refusal |
| --- | --- | --- |
| status | EVALUATED | REFUSED |
| outcome | CORRECT or INCORRECT | null |
| code | null | One allowlisted code below. |
| completionQualification | NOT_ESTABLISHED | NOT_ESTABLISHED |

CORRECT and INCORRECT are equally valid comparison outcomes. INCORRECT is not a
parser failure and carries no score. Refusals never carry an outcome or numeric
score. No output contains identities, labels, expected/selected choice, definitions,
revision values, submitted payloads, detailed validation paths or exception text.
In particular, do not use VERIFIED, a receipt or a completion certificate as an
output status. No result can be passed to Stage A as trusted evidence automatically.

First applicable refusal wins, in exactly this order:

| Priority | Allowlisted code | Condition |
| --- | --- | --- |
| 1 | INVALID_INPUT | Unsafe/uninspectable data or global resource bounds; malformed root, missing/extra root keys, or malformed schemaVersion. |
| 2 | UNSUPPORTED_VERSION | Otherwise well-formed positive safe root schemaVersion other than 1. |
| 3 | INVALID_CONTEXT | Missing/malformed expected binding object or any of its exact required fields. |
| 4 | INVALID_DEFINITION | Missing/malformed definition fields, choice structure/labels/ids, duplicate choices or expected choice outside its set. |
| 5 | INVALID_RESPONSE | Missing/malformed response fields, responseType token or singular selectedChoiceId syntax; extra response fields also refuse. |
| 6 | UNSUPPORTED_RESPONSE_TYPE | Structurally valid definition or response declares a type other than SINGLE_CHOICE. |
| 7 | BINDING_MISMATCH | Any well-formed scope/revision/checkpoint/policy binding differs across the three objects. |
| 8 | INVALID_SELECTION | Otherwise valid selectedChoiceId is not among the declared choice ids. |

Global safe-data inspection precedes all schema checks, so a proxy/accessor/cycle
anywhere receives INVALID_INPUT. Later stages use fixed validation stages rather
than schema-library issue order or object insertion order. Structural validation
of both definition and response precedes format/binding checks. Multiple failing
bindings yield the same single BINDING_MISMATCH without identifying which secret
value was expected. An out-of-set selection on stale bindings receives that earlier
mismatch. Matching full input is repeatable; no clock, random generator or cache.

### 24.4 Trust, accessibility and preserved feature boundaries

C3a compares a response against supplied data only. Even a CORRECT result proves
neither that the supplied expected choice is authoritative nor that a real student
performed an interaction. An untrusted caller can forge definition AND expected
context; schema validity cannot prevent this. A future server service must load
reviewed immutable definitions independently, keep expected choices private, and
construct bindings from authoritative records rather than a request body. Adding
approved=true, a claimed server origin or a caller role is not authorization and
is outside the strict input schema.

No authentication/account/session input is accepted by C3a. The future producer
must derive current STUDENT ownership from existing Auth, verify published Concept
and full ancestry/references, validate visualization attachment/publication and
current approved checkpoint versions, and bind challenges to the authenticated
account. C3a cannot authorize or check any of those facts. No DB query, network or
filesystem access, logger, service registration, answer-disclosure callback,
challenge issue/consumption, receipt, replay memory or persistence is introduced.

Future task authoring must include a meaningful textual prompt and visualization
description, with clear choice labels. These display materials are outside this
minimal verification projection; validating labels does not prove accessibility.
Use equivalent native single-choice interactions for pointer, keyboard and screen
reader users, with visible focus, labels and status feedback. Reduced-motion users
must be able to read the same graph/step explanation and answer the same task
without playing animation, dragging, identifying colors/pixels or racing a timer.
Equivalent paths use the same choice ids and verification rule; no weaker alternate
passing standard. C3a implements no UI and cannot claim mounted accessibility PASS.

No F026 authored schema, F027 renderer, F028 playback, F029 fixture, Stage A/C1
evaluator, B1 OUTPUT grader, B2 DIAGNOSTIC assessment, F036 immutable attempt or
F037 activity summary is modified or called. C3a is not Practice grading, passing
evidence, checkpoint coverage aggregation, comprehension proof, completion or F039
mastery. Default 70% applies to the separate completion Practice requirement; it
does not turn a binary visualization comparison into a percentage or eligible score.

### 24.5 Numbered owner decisions and future architectural gates

All recommendations below require explicit C3a implementation approval. Deferred
columns are proposals only and are not authorized by approving the pure utility.

| Decision | Conservative C3a recommendation | Later owner decision / canonical impact |
| --- | --- | --- |
| C3a-P1 - Definition schema | Approve the bounded verification projection in 24.2, including independent expected bindings, explicit choices and private expectedChoiceId. | Persisted authored prompts/descriptions, immutable definition catalog/version provenance and public/private projection separation need an explicit F026/schema extension in DATABASE_DESIGN.md; no persisted field is added here. |
| C3a-P2 - Approval authority | C3a cannot approve definitions or treat metadata as trust. | Recommend current authorized Admin author plus independent current authorized reviewer and server-recorded provenance; reuse B2 principles, not rubric-specific authorization. Exact role/lifecycle/fencing and authoritative catalog require approval and canonical internal API/database amendments before implementation. |
| C3a-P3 - Comparison semantics | SINGLE_CHOICE only, 2-8 unique stable choices; exact id comparison; CORRECT/INCORRECT without scores. Accessible equivalents use identical rules. | Review meaningful tasks/coverage and authoring accessibility separately; no inference from playback or activity. Other formats require a new version and approval. |
| C3a-P4 - Definition/version binding | Require exact Concept, visualization, revisions, checkpoint id/version and policy id/version in all three projections. | Trusted revision/fingerprint derivation, current attachment/publication, immutable version catalog and invalidation are future service contracts; opaque equality cannot prove those properties or prevent ABA. No automatic C1/Stage A adapter. |
| C3a-P5 - Refusals/errors | Approve exact four-field output and fixed code precedence in 24.3. No sensitive echo, exception detail or logging. | Mapping internal failures to sanitized HTTP errors, no-store and bounded rate limits belongs to a separately approved public producer/API, not this utility. |
| C3a-P6 - Challenge/retry | No challenges, retries, idempotency or response storage in C3a. | Recommend each well-formed accepted response consume one owned challenge atomically, including incorrect responses; malformed input does not consume. Exact replay returns the owned durable outcome, changed requests conflict, and explicit new attempts need bounded issuance. Outcome/receipt schema, feedback and C2 reuse/fences need separate approval. |
| C3a-P7 - Expiry/revocation | No timestamps, expiry or revocation state in this pure comparison; never infer current validity. | Recommend evaluating C2's five-minute server lifetime and terminal withdrawal as an initial producer option, not an adopted VISUALIZE policy. Define publication/version revocation, receipt replay after withdrawal and race serialization before any producer. Canonical C2 READ schemas cannot simply be widened implicitly. |
| C3a-P8 - Privacy/retention | No persistence, account identifiers, logging, raw response output or expected-answer exposure. | Minimal owned receipt provenance/definition identity/verifier version and outcome only if approved; avoid copying content/private expected choices. Retention, erasure, backup, access, audit and replay-after-erasure policy remain release prerequisites. |

No PRD, API_DESIGN.md or DATABASE_DESIGN.md change is necessary for C3a. Future
producer work requires separately approved additive internal service contracts and
visualization/checkpoint lifecycle definitions, plus explicit VISUALIZE challenge/
receipt variants if reusing C2 collections. Whether any additional collection or
index is justified must be assessed in that later exact inventory, not assumed.
studentProgress remains canonical; no alternative completion store is proposed.
Public routes, Concept/Visualize integration and their request/display DTOs are
another gate. None of these future amendments is applied or claimed implemented.

### 24.6 Exact proposed implementation inventory

| Operation after separate approval | Exact path | Purpose |
| --- | --- | --- |
| CREATE | apps/api/src/modules/visualizations/checkpoint-verification.ts | Pure bounded single-choice verifier and exported allowlisted result/refusal types. |
| CREATE | apps/api/tests/visualization-checkpoint.test.ts | Focused deterministic schema, comparison, boundary and trust-isolation tests. |
| MODIFY | docs/features/F038-completion-rules.md | Record approved decisions, partial implementation and actual verification evidence. |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md | Record partial C3a foundation and actual checks, keeping full F038 IN_PROGRESS. |

Total **four paths: two CREATE and two MODIFY**. This planning gate changes only
the feature document. Future implementation must not create a catalog, model,
index, route, challenge service, UI, shared package, config or dependency. Stop for
approval if any fifth path or canonical architectural amendment becomes necessary.

### 24.7 Planned verification and separate formal review - NOT_RUN

After explicit implementation approval, run focused deterministic cases for:

- Valid CORRECT and INCORRECT selections, including first/last choice and two/eight
  choice boundaries. All results have exactly the four documented keys, no scores,
  expected answer or identifiers, and NOT_ESTABLISHED qualification.
- Missing/null/invalid/out-of-set ids, empty/multiple selections, selected arrays,
  numeric coercion attempts, unsupported response formats and extra expected-choice
  or approval fields in response. Do not normalize input to turn refusal into success.
- Duplicate ids/equal labels, missing/out-of-set expected choices, malformed choice
  objects, holes/extra array properties and invalid Unicode/control characters.
- Every Concept/visualization/revision/checkpoint/version/policy mismatch; absent or
  malformed expected context, case/whitespace distinctions and exact token limits.
- Bounds at and beyond 8 choices, 64-character choice ids, 128-character tokens,
  240-code-unit labels, positive safe versions and global depth/key/value/string
  limits. Reject accessors/proxies/custom prototypes/cycles without running them.
- Every refusal code, paired simultaneous failures and object key reordering to
  prove deterministic precedence. Invalid structural payloads never yield incorrect
  outcomes; valid incorrect selections never yield a numeric grade.
- Exact output allowlisting, no sensitive echo in refusal/exception paths, no
  caller mutation, repeatability on deeply frozen input and no timer/randomness/
  storage/network/logging imports or execution. Definition validity never claims
  authorization, ownership, publication, authenticated evidence or completion.

Relevant regression plan: existing visualization model, C1 section-evidence policy,
Stage A completion policy, B1 OUTPUT grading and existing B2/C2 focused offline
suites, using repository-approved test commands. Retain earlier test counts as
historical evidence rather than adding overlapping runs as new distinct tests.
Run API build, source/test TypeScript, applicable lint and targeted formatting,
UTF-8/LF, exact four-path change comparison and git diff --check. This list is a
future verification plan, not evidence that any checks/tests were executed now.

Perform a separate formal implementation-diff review, reporting actual CRITICAL /
HIGH / MEDIUM / LOW findings with file/line references. Prioritize trust overclaims,
expected-choice leakage, malformed input, deterministic refusal ordering, hidden
side effects and unapproved modifications to existing visualization/Practice/
completion boundaries. Stop on unresolved Critical/High findings; report remaining
findings for owner disposition rather than silently expanding scope.

C3a needs **no MongoDB integration**: no data access, schema or indexes. Later
producer authorization/publication, challenge consumption/replay races, index
readiness, majority durability, uncertainty and cleanup require their own focused
tests and separately approved disposable MongoDB execution. No persistent index
provisioning, migration or existing integration rerun is authorized here.

Browser additions for C3a: **zero**. Existing **141 expected browser scenarios
remain NOT_RUN**, with historical Windows/F022/F024/F029 limitations preserved.
Future student UI must separately enumerate and approve its additional browser
cases. No prior exception transfers and no primary-host Playwright execution,
browser PASS or production readiness is implied.

### 24.8 Planning outcome and next approval gate

**C3a PLAN READY, pending explicit C3a-P1-P8 and four-path implementation approval.**
Only this planning section was appended; no source, test, roadmap or canonical
document was changed and no test/service/database/browser execution occurred.
All proposed implementation/verification remains NOT_RUN. No assessment, evidence,
receipt, score or completion record was created.

Next owner gate: accept or revise C3a-P1-P8, the exact schemas/result/refusal order
and four-file scope, then explicitly approve pure implementation/offline checks.
Future server authority/catalog, challenges, evidence persistence, UI, completion
qualification and privacy/release prerequisites remain separately owner-gated.
Keep F038 IN_PROGRESS, partial foundations only; do not mark full F038
READY_FOR_REVIEW or APPROVED_COMPLETE and do not start F039. STOP after planning.

## 25. Stage C3a implementation and offline verification

The owner approved C3a-P1-P8 and the exact four Section 24.6 paths for pure
implementation/offline verification. This supersedes Section 24's planning-only
authorization, not its trust boundaries or historical evidence. F038 stays
IN_PROGRESS, partial foundations only; no full-feature acceptance or producer
integration is authorized.

### 25.1 Owner-decision reconciliation - PASS

| Decision | Reconciled implementation boundary |
| --- | --- |
| P1 | Strict bounded single-choice definitions, unique ids and exact labels, explicit expected choice and exact binding projections. Structural ambiguity refuses; educational/semantic ambiguity still requires future trusted author/reviewer approval, as Section 24 states. |
| P2 | Definition validity and supplied expected context do not prove authority. Approval flags are unknown fields and refuse. |
| P3 | Strict choice-id equality only, after all validation. No trimming, coercion or normalization. |
| P4 | All eight Concept/visualization/revision/checkpoint/policy bindings compare exactly across expected, definition and response. |
| P5 | Exact four-field result and eight refusal codes in Section 24.3, with fixed stage precedence and no sensitive echo. |
| P6 | No challenge/replay/retry state, issuance, consumption or authoritative replay detection. |
| P7 | Section 24.2 has no lifecycle input fields and P7 in 24.5 explicitly defers timestamps/expiry/revocation. Therefore supplied lifecycle metadata is refused as extra fields, never ignored or accepted as freshness proof. No lifecycle extension or trusted time is introduced. |
| P8 | No storage, logging, I/O, producer/API/UI integration, answer disclosure, progress or completion mutation. |

No material contract conflict or additional file/dependency is required. The
owner's lifecycle test requirement is covered through strict rejection of
unsupported lifecycle metadata, not an invented expiry schema or new policy.

### 25.2 Implemented scope

Exactly four stage paths: create checkpoint-verification.ts and
visualization-checkpoint.test.ts at the full paths in Section 24.6; modify this
document and DEVELOPMENT_ROADMAP.md only. Earlier stages and canonical architecture
remain unchanged. verifyVisualizationCheckpoint is disconnected from application
routes/services and returns EVALUATED/CORRECT or EVALUATED/INCORRECT, or REFUSED
with a stable code; completionQualification is always NOT_ESTABLISHED. No scores,
receipts, expected answers or trusted-evidence certificates are returned.

The implementation uses existing Zod and native node:util safe proxy inspection.
Data-descriptor inspection enforces bounds before staged schemas, including
unknown fields. Aggregate string limits include own-key names as well as values.
Invalid data never reaches correctness comparison. Definition provenance, current
authorization/publication, genuine interaction and revision freshness remain
future server responsibilities; no approval boolean or matching metadata substitutes.

Verification and formal-review evidence will be recorded below only after the
approved offline checks. No MongoDB/browser execution is required or authorized.
C3a adds zero browser cases; all 141 expected scenarios remain NOT_RUN. F001-F037
remain APPROVED_COMPLETE for local development, F039 NOT_STARTED.

### 25.3 Offline verification evidence - PASS

| Check | Actual result and scope |
| --- | --- |
| New focused suite | **35 PASS / 0 FAIL**, visualization-checkpoint.test.ts. Correct/incorrect responses, strict schemas and limits, all eight bindings, lifecycle-extra rejection, every refusal stage, hostile objects, exact outputs and purity/trust boundaries. |
| Relevant API regressions | **158 PASS / 0 FAIL** in six existing offline suites: visualization-model (12), completion-policy (22), output-grading (23), section-evidence-policy (32), practice-grading (23) and section-evidence (46). Model/service tests remain disconnected/mocked; no live database was used. |
| Distinct offline total | **193 PASS / 0 FAIL**: 35 new plus 158 existing; internal assertion loops and historical passing runs are not added as distinct tests. |
| API build | node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json exited 0. |
| Source/test TypeScript | node node_modules/typescript/bin/tsc -p apps/api/tsconfig.test.json exited 0. |
| Repository lint | node node_modules/eslint/bin/eslint.js . --max-warnings=0 exited 0. |
| Source/test formatting | Existing Prettier check passed for the two new TypeScript files. Documentation is excluded by the existing .prettierignore; UTF-8/LF and whitespace were checked directly rather than claiming Markdown Prettier coverage. |
| Scope/security | Exact four-path change comparison against this gate's source-hash baseline; previous stage implementations, canonical documents, dependencies/configuration and unrelated source unchanged. No existing runtime source imports the verifier. |
| Encoding/whitespace | Strict UTF-8 decoding and LF checks for all four paths; no trailing whitespace in new source/test or appended documentation; git diff --check PASS. Historical roadmap text is retained. |

Focused command: node --import tsx --test tests/visualization-checkpoint.test.ts,
from apps/api. The initial sandbox invocation failed before loading tests because
tsx's Windows os.userInfo lookup returned uv_os_get_passwd/ENOMEM. This was a
runner/environment failure, not a failing verifier assertion. The supported
ordinary-user execution passed all 35 cases without changing source, environment
configuration or assertions. The six regression suites were then run together
once in that supported context and passed all 158 tests. No database/browser/
synthetic-process probe or existing guarded integration suite was executed.

### 25.4 Separate formal source/security review - PASS

Performed a separate review pass over both complete new files, this section and
the exact roadmap insertion, against Section 24 and the owner directions. Actual
findings: **CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0 unresolved**. No code correction
or additional architecture/file scope was needed after the passing focused suite.

Reviewed boundaries:

- Strict complete-string identifiers, positive safe versions, bounded Unicode
  labels, exact choice uniqueness/membership and no implicit normalization.
- Proxy/accessor-safe data snapshot, structural bounds and staged schemas before
  comparison; root-presence checks and fixed refusal ordering do not depend on
  object insertion order or validator issue ordering.
- All eight expected/definition/response bindings are compared before selection
  correctness. Unknown choices refuse, and valid wrong choices remain INCORRECT
  without a score or a completion decision.
- Exact four-field outputs on every path with no expected-choice/body/identity
  echo or validation exception. NOT_ESTABLISHED is unconditional; claimed approval,
  authenticated identity and lifecycle fields cannot bypass the strict schema.
- Pure imports are limited to existing Zod and native node:util inspection. No
  clock/randomness, I/O, logger, persistence, route registration, trusted producer,
  challenge operation, B1/B2 grading, F036/F037 writer or Stage A evidence adapter.
- A forged definition can produce a matching comparison but never approval or
  genuine activity evidence. Semantic task quality and accessible equivalent
  interaction still need future authoring/review and mounted verification.

### 25.5 Remaining dependencies and next owner gate

**C3a implementation/offline verification PASS - PARTIAL F038 FOUNDATION.** This
does not close F038, authenticate evidence or implement a visualization producer.
Trusted definition authoring/approval, immutable version authority, current
authorization/publication and attachment validation, account-owned challenges,
expiry/revocation/replay, majority-proven interaction receipts and privacy/retention
remain separately gated. Accessible student integration, required checkpoint
coverage, completion-qualifying Practice provenance and canonical studentProgress
completion workflow remain outstanding. No changes to canonical architecture were
required or applied by C3a.

C3a adds **zero browser scenarios**; all **141 expected browser scenarios remain
NOT_RUN**, with historical limitations and nontransferable exceptions preserved.
No MongoDB integration is necessary for this disconnected utility. No production
readiness, Git delivery, persistent index provisioning or F039 work is implied.

Next gate: separate owner acceptance/source review of C3a, then explicit approval
of the next bounded producer design if desired. F001-F037 remain APPROVED_COMPLETE
for LOCAL DEVELOPMENT; F038 remains **IN_PROGRESS**, partial foundations only;
F039 remains NOT_STARTED. STOP after offline verification and this evidence update.

## 26. Stage C3b detailed planning - trusted visualization checkpoint producer

**PLAN READY - PROPOSED CONTRACT, NOT IMPLEMENTED.** The owner accepted C3a as a
verified partial foundation and approved detailed C3b planning based on exactly
fifteen paths. This gate modifies only this feature document. Sections 1-25,
historical reviews/test results and canonical architecture remain unchanged.
F038 stays IN_PROGRESS; F001-F037 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT,
and F039 remains NOT_STARTED. Recommendations C3b-P1-P8 below require explicit
implementation approval; the planning authorization does not adopt them as code.

### 26.1 Reconciliation, reuse and explicit limits

Consulted AGENTS.md; PRD sections 14, 16, 74 and 96; System Architecture's
server-authoritative modular monolith; API_DESIGN.md F026 and C2 refinements;
DATABASE_DESIGN.md visualization, studentProgress and C2 contracts; F026-F029;
and F038 C1, C2 and C3a sources/contracts. Reusable foundations:

- Existing token verification plus fresh ACTIVE, email-verified STUDENT checks;
  account ownership never comes from commands. Reuse publishedConceptStages for
  all five published levels and denormalized reference consistency.
- C2's snapshot validation, exact unique-index verification, owned challenge CAS,
  bounded transaction policy, majority proof and terminal withdrawal patterns.
  Its READ policy constants, snapshot interpretation and DTOs remain READ-specific.
- Unchanged C3a verifies SINGLE_CHOICE comparison after exact eight-field binding.
  It does not authorize a definition or validate challenge state. C3b must supply
  server-derived expected context and definition, and interpret REFUSED fail-closed.
- F026's canonical visualization model and bounded graph/reference validator,
  F027's text alternatives and F028's manual/reduced-motion paths inform trusted
  definition review. F029 remains a gated fixture, not a production content catalog.

Missing today: authorized visualization publication workflow, monotonic editorial
revision history, trusted checkpoint definitions, VISUALIZE challenge/receipt
variants and Student Concept Visualize integration. C3b does not repair all of
these: recommend an **internal LOCAL-only producer, initially disposable synthetic
use only**, with server-recorded checkpoint review of a specific source snapshot.
No public route, UI, background worker, database migration or persistent demo
provisioning is part of this increment.

Snapshot matching proves equality with observed current content, not uninterrupted
publication, absence of edit/restore ABA, or a global race-free authorization
history. An APPROVED checkpoint cannot authorize a visualization whose current
status/references/ancestry fail validation. Conversely, a raw PUBLISHED label or
matching content digest cannot authorize a checkpoint without server-recorded
independent review. Stronger editorial/role-change fencing requires later scope.

### 26.2 Definition authority, immutable versions and server revisions

Propose one new private collection, visualizationCheckpointDefinitions. A separate
catalog is justified by immutable checkpoint-version identity, private expected
choices and review/revocation serialization. Embedding these in F026 would require
editing its strict authored model and inventing an editorial API outside the
fifteen-path scope. Do not create separate challenge/receipt collections.

The catalog document has an immutable authored envelope and narrowly mutable
authority state. All supported writes must use its repository; ordinary update,
delete and bulk mutation paths are guarded. This is application-level protection,
not database WORM or protection from privileged raw database access.

| Exact field group | Proposed contract |
| --- | --- |
| _id, schemaVersion | Server ObjectId; literal 1. |
| conceptId, visualizationId | Genuine stored ObjectIds; canonical lowercase 24-hex strings only at command/DTO boundaries. |
| conceptRevision, visualizationRevision | Server-computed lowercase 64-hex snapshot digests. Never client-authored revision values or updatedAt used as a revision. |
| checkpointId, checkpointVersion | C3a token and positive safe integer. Explicit authored version, not array position; no automatic latest/best selection. |
| policyId, policyVersion, verifierVersion | Server constants F038_VISUALIZE_CHECKPOINT_ACTIVITY, 1 and 1. Client commands cannot override them. |
| responseType, choices, expectedChoiceId | SINGLE_CHOICE and the exact C3a 2-8 choice/id/label rules. Expected choice is private, stored once in this definition only. |
| prompt, textAlternative | Required inert well-formed Unicode, nonblank, respectively 1-2000 and 1-4000 UTF-16 code units. Preserve authored text; no fetching, HTML execution or Markdown code execution. |
| definitionFingerprint | Server SHA-256 of the exact ordered immutable verification/display projection specified below. |
| authoredBy, authoredAt, authorRequestId | Server-verified Admin ObjectId, server UTC Date and nonsensitive correlation token. Immutable; no account supplied in the body. |
| state, decisionFence | DRAFT / APPROVED / REVOKED and nonnegative safe integer. State transitions and every successful issue/submit/replay share a definition CAS fence. |
| approvedBy, approvedAt, approvedFingerprint | Initially null; set once by an independent currently eligible Admin, bound to the exact stored fingerprint. Immutable after approval. |
| revokedBy, revokedAt | Initially null; terminal server-recorded Admin restriction, retaining original approval and authored history. |

Definition validation bounds: exact own-key schemas, no casting or executable
metadata; use C3a's string/id/choice bounds. Aggregate definition/display projection
must fit 32 KiB UTF-8 before insertion. Reject duplicate/equal-labelled or malformed
choices; editorial ambiguity and accessible task adequacy require actual review.
No caller-provided approval state, timestamps, reviewer or private revision claim
is accepted as provenance. Safe data inspection precedes validation.

Proposed lifecycle: author creates immutable DRAFT; independent approval permits
DRAFT -> APPROVED; a current eligible Admin may restrict DRAFT/APPROVED -> REVOKED.
REVOKED is terminal. No edit-in-place, reapproval, ownership transfer or deletion
through business operations. Changed content/choices/policy requires a distinct
checkpointVersion. An exact same-author/same-version/same-body author retry returns
the original definition only after fresh validation; another body/author conflicts.
Approval replay by the same reviewer preserves original provenance; a different
reviewer cannot overwrite it. Repeated revocation retains the first revoker/time.

Recommend current ACTIVE, email-verified ADMIN author and reviewer eligibility,
with different account ids. Recheck actual database role/status, not only JWT role,
at author/approve and proof; issue/submit/replay revalidate the recorded author and
reviewer eligibility as well as the Student. No public Admin endpoint is added.
Narrow domain provenance in this record is the initial audit boundary; no central
auditLogs event vocabulary change is implied. Required central audit would need
separate exact audit model/repository/test scope approval before implementation.

Current APPROVED means this exact nonrevoked version with matching observed
snapshots, not automatically the numerically highest version. Multiple explicitly
reviewed versions may coexist; no supersession/coverage rule is silently invented.
Issuance names a definition id; its authorization is resolved server-side, not
trusted because a caller selected that id. Public availability remains deferred.

Exact snapshot proposal in visualization-checkpoint-revision.ts:

- Reuse the existing C2 Concept snapshot algorithm/version, including all validated
  hierarchy/content fields, for conceptRevision. Never change C2's algorithm.
- Compute visualizationRevision = sha256(JSON of the ordered array:
  [F038-C3b-visual-v1, visualizationId, conceptId, technologyId, topicId,
  schemaVersion, type, title, textAlternative, ordered nodes as [id,label,
  description-or-null], ordered edges as [id,source,target,label], ordered steps as
  [title,explanation,nodeIds,edgeIds], animationConfig as [stepDurationMs,false]
  or null]). Validate the stored F026 structure and exact Concept/Topic/Technology
  references before hashing. Require current visualization status PUBLISHED and
  full published Concept ancestry. Status/provenance are checked separately from
  content hashing; no fields are silently discarded or normalized before checking.
- Compute definitionFingerprint = sha256(JSON of the ordered array:
  [F038-C3b-definition-v1, conceptId, visualizationId, conceptRevision,
  visualizationRevision, checkpointId, checkpointVersion, policyId, policyVersion,
  verifierVersion, responseType, prompt, textAlternative, choices as [id,label]
  in authored order, expectedChoiceId]). Hex ObjectIds and exact text are used.
- On approve/issue/submit/replay/proof, recompute current snapshots and compare the
  exact bound definition/fingerprint. There is no implicit migration to new content.
  A mismatch refuses the operation, not a saved completion state. Explicit catalog
  revocation cannot be undone by restored content; undetected source edit/restore
  ABA remains possible without an authoritative editorial-history integration.

### 26.3 Internal commands, DTOs and errors (proposed, no public API)

Trusted server construction supplies existing AccessTokens verification, validated
APP_ENV and repository/time dependencies. Every entry refuses outside LOCAL.
Token and requestId are separate arguments, never fields that claim authority.
All commands are strict bounded plain data; existing canonical ObjectId/UUID-v4
idempotency-key and nonsensitive correlation validation is reused.

| Internal method | Exact command body and authorized caller |
| --- | --- |
| author | {conceptId,visualizationId,checkpointId,checkpointVersion,prompt,textAlternative,choices,expectedChoiceId}; current Admin, server computes bindings/constants. This is the only authored private expected-choice input, never a Student command. |
| approve | {definitionId}; current independent Admin, server records reviewer/fingerprint/time. |
| revokeDefinition | {definitionId}; current Admin; terminal restriction may proceed when source content is no longer published. |
| issue | {definitionId,idempotencyKey}; current Student; server resolves all Concept/visualization/checkpoint/policy bindings. |
| submit | {challengeId,selectedChoiceId,idempotencyKey}; current owning Student; expected choice, definitions, outcomes, account ids and revisions are prohibited. |
| withdraw | {challengeId}; current owning Student; terminal restriction without requiring source to remain published. |

submit with the same key is also the replay operation; no unowned receipt lookup
or separate caller-authorized replay method. Runtime identity comes only from
existing verified tokens and current database eligibility. Revoke/withdraw can
only restrict, never authorize a new receipt. No producer automatically runs.

Proposed exact output allowlists:

- Definition administration: {id,state}; no private choices, expected answer,
  fingerprint, author/reviewer ids or full definition returned by these commands.
- Issue: {id,conceptId,visualizationId,checkpointId,checkpointVersion,policyId,
  policyVersion,prompt,textAlternative,choices,expiresAt}; choices expose only
  id/label. Server snapshot/private expected values never appear.
- Submit/replay receipt: {id,conceptId,visualizationId,checkpointId,
  checkpointVersion,outcome,respondedAt,completionQualification}; outcome is
  CORRECT|INCORRECT and qualification is always NOT_ESTABLISHED.
- Owner withdrawal: {challengeId,state}, state=REVOKED. Dates are UTC ISO strings.

CORRECT necessarily confirms the student's selected choice; an INCORRECT result
also gives information, especially for two choices. Do not claim expected-choice
secrecy against inference from required feedback. The privacy contract prohibits
direct expected-choice/body disclosure, copies and logs; bounded issuance limits
probing. Accepting feedback semantics is an explicit C3b-P3 decision below.

Reuse sanitized auth, VALIDATION_ERROR, CONCEPT_NOT_FOUND and existing C2 hidden
challenge/conflict/unavailable/unconfirmed errors. Propose hidden
VISUALIZATION_CHECKPOINT_NOT_FOUND (404, including unavailable definitions),
VISUALIZATION_CHECKPOINT_CONFLICT (409) for administration/active-issue conflicts,
and VISUALIZATION_CHECKPOINT_LIMIT (429) for the approved issuance cap. Readiness
failure remains DEPENDENCY_UNAVAILABLE (503); uncertainty returns no receipt.
No errors echo choices, selected/expected answers, bodies or raw driver messages.
There is no HTTP route, middleware/cache change or public rate-limit claim here;
future public exposure needs approved no-store/parser/error and abuse controls.

### 26.4 Strict VISUALIZE variants and READ compatibility

Reuse sectionEvidenceChallenges and sectionActivityReceipts with versioned,
discriminated schemas. Keep exact READ schemaVersion=1, policy literals, exports,
DTOs, snapshot algorithms, fingerprints, expiry rules and supported business
behavior. No automatic migration or backfill. Proposed VISUALIZE schemaVersion=2,
producerVersion=1, policyId=F038_VISUALIZE_CHECKPOINT_ACTIVITY, policyVersion=1.
Each branch has its own exact allowed fields; merely widening section to a string
or accepting arbitrary policy metadata is forbidden.

VISUALIZE challenge = existing lifecycle/key/correlation fields plus immutable
definitionId, definitionFingerprint, visualizationId, visualizationRevision,
checkpointId, checkpointVersion and verifierVersion. conceptRevision remains the
current server Concept digest; sectionRevision equals visualizationRevision, not
the READ digest. This duplication must be exact, never contradictory. No expected
choice, prompt, label or response body is copied into a challenge.

VISUALIZE receipt = immutable existing owner/Concept/challenge/key/fingerprint
fields plus the same definition/visualization/checkpoint/verifier bindings;
section=VISUALIZE, origin=CHECKPOINT_SERVICE, purpose=ACTIVITY_ONLY. Replace the
READ-only acknowledgedAt with respondedAt for this branch and require outcome
CORRECT|INCORRECT. Preserve existing storage ackKeyHash/ackRequestId names for the
shared unique index, with C3b response-specific hash domains; this is not a READ
acknowledgement. No selected choice or expected choice is stored in the receipt.

Keep application append-only guards on both receipt branches; only challenge and
definition authority fields may change through validated CAS repository methods.
No broad generic CRUD, extra raw logging, privileges or database WORM guarantee.

C2 repository reads/proofs/CAS must add explicit READ/schemaVersion scope and use
the original READ parser. C3b queries use explicit VISUALIZE/schemaVersion=2 scope
and its own parser. Looking up another branch must act unavailable/hidden, not
perform cross-producer revocation or return a validation stack trace. Update model
projections/constructors to support both stored branches without inserting VISUALIZE
defaults into READ rows. Do not create circular dependencies between shared models,
the definition catalog and services; shared schemas cannot import producer services.

The existing C2 transaction runner/actor/Concept helpers may be reused through
the new repository's adapter. Its ready check additionally verifies the catalog
for C3b only. READ readiness must still require only its original three indexes,
even if no checkpoint catalog exists. No generic Auth refactor or changed role
policy is needed. The existing C2 offline test file preserves all 46 cases while
adding branch isolation, unchanged old index requirements and DTO regressions.
Any unexpected assertion/export dependency outside these paths must stop for
scope approval rather than weakening existing tests.

### 26.5 Challenge, response and replay lifecycle

Require issuedAt=server UTC and expiresAt=issuedAt+300,000 ms, with no sliding
refresh; equality with expiry refuses. Challenge id is a server ObjectId; an id
or key alone grants no ownership. All issue/submit/replay operations recheck
current Student, author/reviewer, current source scope and approved definition
before work, inside the transaction and during majority proof.

| Condition | Proposed transition and result |
| --- | --- |
| First valid issue within budget | Under definition fence, insert one AVAILABLE challenge; majority proof precedes issue DTO. |
| Exact same-key issue retry | Return original owned AVAILABLE/unexpired challenge after fresh checks; no new challenge or budget charge. Consumed/revoked/expired original refuses rather than refreshing. |
| Another key while an owned challenge remains AVAILABLE and unexpired for this definition | Conflict; do not implicitly withdraw or create parallel opportunities. |
| Valid selected choice, C3a CORRECT | Same transaction fences definition/challenge, inserts immutable CORRECT receipt and sets challenge CONSUMED with matching receiptId/consumedAt. Proof precedes receipt. |
| Valid selected choice, C3a INCORRECT | Exactly the same consumption/receipt rules, with INCORRECT outcome; no extra guesses through this challenge. |
| Malformed command, out-of-set selection or C3a REFUSED | No challenge consumption or receipt. Malformed Student input is sanitized validation failure; malformed trusted definition/readiness is dependency failure, never an incorrect outcome. Any attempted fence update rolls back with failure. |
| Exact same-key/same-response replay | Shared fences and fresh authorization/snapshot/lifecycle checks; return only the original owned majority-proven receipt. No duplicate insertion or new count. Original five-minute expiry still applies. |
| Same key with changed challenge/choice/bindings, or another key on a consumed challenge | Conflict; never evaluate a second answer or reuse a receipt under a new identity. |
| Owner withdrawal | AVAILABLE or CONSUMED -> REVOKED under challenge fence; keep historical receipt unchanged, disallow future replay. Same terminal withdrawal remains idempotent. |
| Definition revocation | Shared definition fence serializes with issue/submit/replay; terminal catalog REVOKED refuses all future authorization, without rewriting receipts or scanning/updating every challenge. |
| Expired, changed source, missing approval, revoked or unavailable identity | Fail closed with no new receipt or unverified success. No attempt/progress/completion mutation. |
| Uncertain commit, absent proof, cleanup error or conflicting stored identity | No success/receipt disclosure. Preserve possible committed history; explicit same-request retry may recover only after full owned proof and validity checks. |

Withdrawal of an expired/unpublished but owned challenge is allowed as a
restriction. Definition revocation may similarly restrict unavailable content.
Neither path may bypass current actor authorization or change immutable bindings.
Historical receipt data remains append-only; there is no claim that past activity
did not happen or that an already returned result can be recalled.

### 26.6 Bounded issuance, fingerprints and consistency fences

Recommend at most **three distinct successful challenge issues per account per
immutable definition id**, and at most one unexpired AVAILABLE challenge for
that pair at once. Expired/withdrawn/consumed issues still count. A new reviewed
definition version has its own explicit budget; version creation is Admin-only.
This is a disposable C3b abuse bound, not a restriction on PRD unlimited Practice
attempts. Reject at the cap with the dedicated sanitized 429. No reset, timer
worker, new environment variable or automatic retry is implemented.

Advance the shared definition decisionFence BEFORE testing the pair's active
challenge/count and inserting under a snapshot transaction. Every C3b issuer
must take this same fence, so concurrent issues cannot pass independent phantom
counts. Count owned VISUALIZE rows for definitionId with a limit of four; an
unexpected over-cap stored count fails closed. Use the existing userId-leading
index plus bounded query timeout, not a new count collection. Active selection
uses the same scope/clock. No unbounded fetch or scan result is materialized;
query timeout remains required even with a small result limit.

Definition fencing serializes issue/submit/replay/revocation for that version;
challenge CAS serializes owner withdrawal/consumption/replay. Acquire definition
then challenge fences when both are required; withdrawal takes only its challenge
fence. Use exact before-image/immutable-binding checks and safe integer overflow
refusal. No cross-definition total order or global editorial/account fence is
claimed. Catalog contention and user-prefix scan cost are disclosed scale limits;
a future volume requirement may need a separately approved index/counter design.

Raw UUID-v4 keys are never stored. Reuse sha256(JSON(array)) with distinct domains:

- issueKeyHash = hash([F038-C3b-issue-key-v1,userId,rawIssueKey]); storage unique
  account+issueKeyHash preserves the existing index. READ hashes remain unchanged.
- ackKeyHash = hash([F038-C3b-response-key-v1,userId,rawResponseKey]).
- Issue request fingerprint = hash([F038-C3b-issue-request-v1,userId,
  definitionId,definitionFingerprint,conceptRevision,visualizationRevision,
  checkpointId,checkpointVersion,policyId,policyVersion,verifierVersion]).
- Response request fingerprint = hash([F038-C3b-response-request-v1,userId,
  challengeId,definitionId,definitionFingerprint,conceptRevision,
  visualizationRevision,checkpointId,checkpointVersion,policyId,policyVersion,
  verifierVersion,selectedChoiceId]). Exact bound fingerprints distinguish replay
  from changed requests without copying choice bodies into receipts.

Fingerprinting is correlation/integrity, not encryption or anonymization. Choice
ids have low entropy and must not be advertised as unrecoverable from private
fingerprints. Restrict record access and do not log payloads or these private
fields. Deleting issuance history could reset the cap or remove replay identity;
therefore persistent retention/erasure requires a separately approved coordinated
policy before any real student use, not an implicit cleanup/TTL implementation.

### 26.7 Exact indexes, transactions and owned proof

Proposed complete secondary-index allowlist for standalone disposable C3b:

| Collection | Exact index name | Ordered key | Constraint |
| --- | --- | --- | --- |
| visualizationCheckpointDefinitions | uq_visual_checkpoint_version | {visualizationId:1,checkpointId:1,checkpointVersion:1} | UNIQUE |
| sectionEvidenceChallenges | uq_section_evidence_issue_key | {userId:1,issueKeyHash:1} | UNIQUE, unchanged C2 definition |
| sectionActivityReceipts | uq_section_activity_challenge | {userId:1,challengeId:1} | UNIQUE, unchanged C2 definition |
| sectionActivityReceipts | uq_section_activity_ack_key | {userId:1,ackKeyHash:1} | UNIQUE, unchanged C2 definition |

Also require standard _id_ indexes. Exact names/key order/v2/unique=true and binary
simple collection/index collation must be verified; reject partial/sparse/hidden/
TTL/wildcard/alternate options. No automatic index/collection creation, buffering,
startup sync, persistent provisioning or backfill. Missing/incorrect/unverifiable
readiness returns sanitized 503 before writes. C2 READ does not acquire the new
catalog requirement. No F036/F037/B2 index is needed merely because those features
exist; if the prepared suite actually needs another index, stop for approval.

Reuse the approved ten-second monotonic total transaction/proof/cleanup budget,
two-second proof/cleanup reserve and at most three transaction body entries. No
invocation retry, transaction operation-level timeout conflict, unlimited driver
callback reentry or timeout extension. Use primary snapshot reads and
majority+journaled commit. Check remaining budget before work, proof and return.

After commit, primary-majority reads must prove exact definition state/provenance/
fingerprint, challenge owner/scope/cross-link/lifecycle, receipt id/owner/bindings/
outcome/request fingerprint and expected consumedAt/respondedAt agreement. Current
Student/reviewer/author and publication snapshots are checked again. A bare commit
return, matching PID-like id, input outcome or existence of any receipt is not
proof. Issue/admin/withdrawal results likewise require their exact owned/current
durable state before return. Definition/challenge fence advancement must not be
treated as evidence of different immutable content.

On uncertainty or proof failure, suppress results without asserting rollback of
an already committed record. Rollback tests must separately cover failures before
commit; controlled proof-loss tests are not real failover/network-partition proof.
Close owned sessions deterministically; cleanup failure suppresses success.
Deadlines do not promise protection against kernel/event-loop suspension.

### 26.8 Accessibility, privacy and completion separation

Server-issued prompt, textual visualization description and choices must support
the same SINGLE_CHOICE task by pointer, native keyboard selection and screen
reader labels. Reduced-motion users need no playback, timed click, drag/drop,
pixel/color recognition or elapsed-time measurement. Future native fieldsets/
radio controls, focus and status feedback must preserve the same ids, validation
and attempt rules across equivalent paths. Definition review checks meaningful
content/alternatives; pure syntax cannot certify accessibility or comprehension.
Internal DTO contract tests are not browser/assistive-technology acceptance.

Checkpoint correctness is verified interaction only. Every receipt DTO returns
NOT_ESTABLISHED; no C1 metadata promotion, Stage A VERIFIED adapter, coverage
aggregation or completion certificate. No scores/threshold comparison, B1/B2
Practice integration, F036 mutation, F037 activity/summary write, alternate
studentProgress store or F039 mastery. Default Practice threshold 70% is unchanged.

Initially use disposable synthetic actors/content only. Catalog private expected
choices are retained once because verification requires them; challenge/receipt
rows contain ids/digests/provenance/outcome, never copies of Practice answers,
visualization content, selected responses, credentials, tokens or raw keys. No
sensitive logging; errors and DTOs use strict allowlists. Do not call approval
provenance database WORM or fingerprints anonymization.

Persistent use remains blocked pending finite retention, authorized read access,
account/definition/challenge/receipt erasure coordination, audit requirements,
backup/restore and replay/budget-after-erasure decisions. No purge/TTL worker,
Admin read UI or indefinitely guaranteed replay is included. Deployment also
needs trusted editorial history, release review and separately approved browser
verification where applicable.

### 26.9 Proposed canonical amendments - not applied

| Exact document/section | Existing contract preserved | Proposed additive wording and necessity |
| --- | --- | --- |
| API_DESIGN.md: new F038 Stage C3b refinement after Stage C2 | Auth, Concept/Practice/progress routes/DTOs, C2 READ commands and errors unchanged; F026 adds no public visualization API. | "F038 C3b is a LOCAL-only internal visualization checkpoint producer. Independently reviewed, server-loaded snapshot-bound definitions authorize owned five-minute challenges. Both valid correct and incorrect responses consume once and create majority-proven ACTIVITY_ONLY receipts. Exact replay revalidates current scope; no trusted completion evidence or public endpoint is introduced." Add the exact command/DTO/error/issuance tables in 26.3-26.6 and snapshot/history limits. Needed to approve new internal authority and feedback contracts. |
| DATABASE_DESIGN.md: new F038 C3b catalog refinement after C2 | Existing visualizations authored schema stays unchanged; studentProgress canonical; F036 immutable and B2 DIAGNOSTIC boundaries intact. | "Add private visualizationCheckpointDefinitions with immutable authored bindings, independent server-recorded approval and terminal fenced revocation as specified in F038 26.2. Define uq_visual_checkpoint_version exactly as 26.7. No generic approval flag, WORM or monotonic publication-history guarantee." Needed for new reviewed definition persistence and exact unique identity. |
| DATABASE_DESIGN.md: additive C3b extension to C2 storage contract | READ schemaVersion=1, original three indexes/lifecycles and standalone readiness remain valid. | "Add strict VISUALIZE schemaVersion=2 challenge/receipt variants with definition/revision/checkpoint/verifier bindings and ACTIVITY_ONLY CORRECT/INCORRECT outcomes, preserving original READ behavior. Reuse existing unique indexes and add no expected-choice copies. Catalog and challenge fences serialize revocation/consumption/replay; majority-proven ownership precedes DTOs." Include the exact fields/lifecycle, budget/retention limits and index checks in 26.4-26.8. Needed for versioned union storage without weakening READ secrecy or readiness. |

These are proposed additive amendments requiring explicit owner approval, not
permission to edit the canonical files in this gate. No PRD/System Architecture
change or alternate completion schema is needed for the bounded activity producer.
Full publication history/global role-revocation guarantees, central audit or public
UI/API would require additional approved contracts and paths. Do not imply them.

### 26.10 Exact future implementation inventory and dependency check

All six creation paths are currently absent; all nine modification paths exist.
The fifteen entries are unique. No extra dependency, environment variable, helper,
shared package, application registration or infrastructure was found necessary for
the proposed internal increment. Reconcile exact schemas/types during implementation;
if an actual extra path is needed, stop rather than adjusting scope silently.

| Operation | Exact path | Proposed responsibility |
| --- | --- | --- |
| CREATE | apps/api/src/modules/visualizations/visualization-checkpoint-definition.model.ts | Immutable private definition, approval/revocation state, mutation guards and exact catalog index. |
| CREATE | apps/api/src/modules/visualizations/visualization-checkpoint-revision.ts | Bounded source/definition snapshots, C3b constants/fingerprints; unchanged C3a and C2 algorithms. |
| CREATE | apps/api/src/modules/visualizations/visualization-checkpoint.repository.ts | Trusted source/catalog retrieval, actor checks, scoped VISUALIZE writes, fences, readiness, bounded transactions and majority proof. |
| CREATE | apps/api/src/modules/visualizations/visualization-checkpoint.service.ts | LOCAL-only internal Admin/Student commands, C3a invocation, lifecycle, budgets and DTO allowlists. |
| CREATE | apps/api/tests/visualization-checkpoint-producer.test.ts | Offline models/service/security, accessibility-contract, concurrency and failure controls. |
| CREATE | apps/api/tests/visualization-checkpoint-producer.integration.ts | Prepared disposable fixtures, exact four-index provisioning and live transaction/compatibility checks, not executed during implementation/offline gate. |
| MODIFY | apps/api/src/modules/progress/section-evidence-challenge.model.ts | Strict versioned VISUALIZE challenge branch, preserving existing READ shape and guards. |
| MODIFY | apps/api/src/modules/progress/section-evidence-receipt.model.ts | Strict VISUALIZE receipt/provenance branch; unchanged READ shape/indexes and append-only rules. |
| MODIFY | apps/api/src/modules/progress/section-evidence.repository.ts | Preserve READ-specific queries/parsers/proof/readiness and safely reusable transaction adapter; prevent cross-branch actions. |
| MODIFY | apps/api/src/modules/progress/section-evidence.service.ts | Explicit READ-only service boundary/DTO compatibility after shared-model extension; no new public caller. |
| MODIFY | apps/api/tests/section-evidence.test.ts | Preserve all existing C2 assertions; add mixed-branch isolation and old-readiness regressions. |
| MODIFY | docs/features/F038-completion-rules.md | Owner reconciliation, actual stage evidence and limitations without full F038 completion. |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md | Partial C3b scope/evidence and unchanged IN_PROGRESS state. |
| MODIFY | docs/API_DESIGN.md | Only approved additive internal command/DTO/error/authority refinement in 26.9. |
| MODIFY | docs/DATABASE_DESIGN.md | Only approved catalog, union schema/index/transaction/privacy refinements in 26.9. |

Total **15 paths: six CREATE, nine MODIFY**. C3a, Stage A/B1/B2/C1, visualization
model/renderer/playback, Auth, audit writers, F036/F037 sources and browser tests
are outside this inventory and must not be changed. Existing packages suffice.

### 26.11 Numbered owner options and conservative recommendations

| Decision | Recommended initial C3b option | Alternative requiring further decision/scope |
| --- | --- | --- |
| C3b-P1 - Definition authority | Current eligible Admin author and independent current eligible Admin reviewer; immutable version/private expected choice, exact approvedFingerprint and server domain provenance. No self-approval or metadata authority. | Self-approval, automated approval, public Admin APIs or mandatory central audit need explicit rationale/contracts and exact additional files. |
| C3b-P2 - Snapshot/publication | Current published ancestry plus matching server Concept/visualization snapshots, explicit nonrevoked definition version and recorded review; LOCAL disposable use only. Accept disclosed ABA/global writer limits. | Authoritative monotonic editorial publication/history and one-current-version supersession require separate architecture; do not promise them from content hashes. |
| C3b-P3 - Issuance/retries | Five minutes, one active challenge per account/definition and three total fresh issues per pair; exact replay is not a fresh issue. Accept explicit correctness feedback and its inference limits. | Another numerical cap/window, refresh/reset, response feedback or account-wide public abuse policy must be approved before implementation. No effect on unlimited Practice attempts. |
| C3b-P4 - Definition revocation | Terminal current-Admin restriction, shared definition fence for issue/submit/replay; owner challenge withdrawal via its fence. No history rewrite or restore. | Automatic cross-version supersession, bulk revocation on every editorial change or global role-revocation fencing requires wider writer integration. |
| C3b-P5 - Receipt validity/replay | Append-only activity outcome, exact owned replay with fresh checks and original expiry. Revocation/source mismatch suppresses future return; historical activity is retained. | Long-lived receipt retrieval, replay after expiry, retrospective invalidation/completion effects or a public history UI is outside C3b. |
| C3b-P6 - Indexes/transactions | Exact four secondary indexes and two fences, no provisioning at runtime; inherited bounded majority/proof policy. C2 READ retains its original readiness. | Additional query/counter/TTL indexes or infrastructure must be justified and separately approved; no persistent provisioning follows from code approval. |
| C3b-P7 - Privacy/retention | Disposable synthetic use only; private definition once, minimized receipts and no logs. Domain provenance only; no anonymization/WORM claim. | Finite persistent retention, coordinated erasure/backups, access/audit and replay/budget-after-erasure policy remain release prerequisites, not silently adopted defaults. |
| C3b-P8 - Canonical amendments/scope | Approve only 26.9's additive internal authority/catalog/strict union contracts and exact fifteen paths before implementation. | Any public route/UI, completion certificate, catalog embedding in F026, new dependency or sixteenth path requires separate approval. |

### 26.12 Verification strategy - planned, NOT_RUN

After explicit implementation approval, focused offline verification must cover:

- Independent author/reviewer roles, current account state at every stage, no
  client approval/revision/owner override, exact admin retry provenance and
  terminal revocation. Malformed/corrupt private definitions never invoke a
  correctness path or disclose internals.
- All server snapshot fields/reference checks, published visualization plus five
  ancestry levels, changed snapshots, exact policy/version/fingerprint bindings,
  explicit version pinning and documented ABA limitations without false history claims.
- Correct and incorrect consume exactly once; malformed/out-of-set/unsupported
  responses never consume or insert. Exact replay/changed-payload conflict;
  one-active/three-total issue bounds and simultaneous issue/consume/replay/withdraw/
  definition-revoke serialization in both legal commit orders.
- Rollback of consumption/fences if receipt insert fails; bounded retries/body
  counts, proof reserve, unknown commit, missing majority proof, corrupt ownership/
  links/outcome/fingerprint and session cleanup failure suppress all results.
- Exact four index definitions/readiness variants and no auto provisioning;
  shared READ/VISUALIZE parsing, queries, keys and mutators cannot cross branches.
  Original C2 three-index readiness/DTOs remain unchanged and all prior C2 tests pass.
- No expected choices/content/raw keys/credentials in issue/receipt/error/log
  payloads; exact DTOs and NOT_ESTABLISHED always. Fingerprints are not represented
  as anonymity. No F036/F037/B2 mutation or completion/mastery writer is called.
- Pointer/keyboard/screen-reader/reduced-motion contract equivalence: same stable
  choices and verifier, meaningful text, no playback/timing input accepted.
  Internal tests cannot demonstrate mounted accessibility or human comprehension.

Run focused new tests, unchanged C3a plus relevant F026, Auth, C2 and prior F038
offline regressions; API build, source/test TypeScript, lint, targeted formatting,
UTF-8/LF, exact-scope/security and git diff --check. Perform a separate formal
CRITICAL/HIGH/MEDIUM/LOW implementation-diff review with actual file/line findings.
Stop on unresolved findings for owner disposition, not scope expansion.

Prepare a single standalone disposable MongoDB suite, but execute only after a
separate owner gate: verified ordinary-user owned Job/native-handle/microsecond UTC
identity, fresh storage, 127.0.0.1:27018 / f021-test / deeplearner-f021-test,
writable PRIMARY and empty target, protected baselines and exact index allowlist.
Provision only the four definitions in 26.7 within that target. Test live unique
identity, issue caps, correct/incorrect consumption, concurrent retries, both
revocation fences, rollback, owned majority proof, index refusal and mixed READ
compatibility with unchanged original C2 index definitions. Controlled proof-loss
injection is not real MongoDB failover testing. Close connections and gracefully
clean owned storage/processes, preserving forced/UNKNOWN outcomes if any. No
persistent index creation or mutation of protected MongoDB/demo data is authorized.

C3b introduces **zero browser scenarios**. All **141 expected browser scenarios
remain NOT_RUN**, including historical Windows/F022/F024/F029 limitations and
nontransferable exceptions. Student integration must later enumerate its own
browser cases and receive ownership-safe execution approval; no browser PASS or
production readiness follows from internal contract tests.

### 26.13 Planning outcome and next gate

**C3b PLAN READY, subject to owner acceptance of C3b-P1-P8 and canonical wording.**
Only this detailed-planning section is appended in this gate; no source, tests,
roadmap or canonical files change and no services/tests/database/browser run.
All proposed C3b implementation and verification is NOT_RUN. No new dependency,
infrastructure or additional required file is identified for the recommended
bounded internal producer. Stronger publication guarantees, central audit and
persistent operations are explicitly outside it and need separate scope decisions.

Next gate: approve or revise C3b-P1-P8, exact schemas/lifecycle/indexes/budgets,
fifteen-path scope and additive canonical amendments, then explicitly authorize
implementation/offline verification. Disposable MongoDB execution, stage final
review and any student-facing/persistent deployment remain separate approvals.
Keep F038 IN_PROGRESS, partial foundation only, and F039 NOT_STARTED. STOP after
documentation-only planning; do not implement or start the next stage automatically.

## 27. Stage C3b implementation and offline verification

The owner accepted C3a and explicitly approved C3b-P1-P8, all fifteen Section 26.10
paths and only the additive canonical amendments in 26.9. Section 26's planning
restrictions are historical; current authorization is internal LOCAL-only source,
prepared tests and offline verification, not database/browser execution, persistent
provisioning, Git delivery, production or full F038 completion.

### 27.1 Owner reconciliation and exact scope - PASS

| Decision | Implemented boundary |
| --- | --- |
| P1 | Immutable authored checkpoint envelopes, current verified Admin author/reviewer, no self-approval, server-recorded fingerprint/time provenance and terminal revocation. No claim that an approval flag authenticates a definition. |
| P2 | Server Concept/visualization snapshots and exact checkpoint/policy/version/definition bindings, checked before/inside transactions and at proof; published ancestry/reference rules reused. ABA/global writer limits remain explicit. |
| P3 | Persisted one-active/three-fresh account/definition issue budget behind definition CAS fence; consumed/expired/withdrawn history counts and exact issue replay does not charge. |
| P4 | Terminal catalog revocation shares definition fence with issue/consume/replay; owner withdrawal shares challenge fence. No restore or history rewrite. |
| P5 | CORRECT and INCORRECT consume atomically with an ACTIVITY_ONLY receipt. Invalid responses roll back/refuse without consumption; exact owned replay revalidates fresh scope, changed requests conflict, expiry/withdrawal refuse. |
| P6 | Four exact secondary indexes, no runtime provisioning, inherited bounded transaction policy, majority+journaled commit and exact owned proof; uncertainty/cleanup failures suppress results. |
| P7 | Minimal receipt DTO, private expected choice only in catalog, no logging or extra answer fields, NOT_ESTABLISHED always, no F036/F037/completion/mastery mutation. |
| P8 | Only approved additive internal API/catalog/strict-union refinements; existing canonical and READ contracts retained. No public route or UI. |

Exactly six creations and nine modifications, all fifteen paths in 26.10. The new
integration file is prepared only and excluded from offline *.test.ts invocation.
No dependency, environment variable, shared package, additional helper or other
source path is added. Earlier stages and F026-F029 sources remain unchanged.

The initial TypeScript pass identified implementation typing issues: Zod's
safeExtend cannot widen READ literals to VISUALIZE and Mongoose document classes
cannot extend union document types directly. Resolved within the approved shared
model files by retaining the unchanged READ lifecycle refinement, applying it to
both strict branch schemas and using a single storage-document TypeScript shape
with mandatory runtime union validation. No assertion or authorization was weakened.

Verification, formal-review results and prepared-integration limitations follow
only after actual checks. F038 remains IN_PROGRESS, partial foundations only.

### 27.2 Actual offline verification - PASS

| Check | Actual result and evidence boundary |
| --- | --- |
| New C3b suite | **38 PASS / 0 FAIL** in visualization-checkpoint-producer.test.ts. Earlier 33-case run is a subset, not additional distinct tests. |
| C2 READ suite | **49 PASS / 0 FAIL**: all 46 original cases retained and three new branch-isolation/readiness/write-boundary cases. Earlier 48-case run is a subset. |
| Additional API regressions | **180 PASS / 0 FAIL** across visualization-model, unchanged C3a, completion-policy, output-grading, section-evidence-policy, practice-grading, authenticate, auth-audit, practice-attempt-model, practice-attempt-repository, progress-model and progress suites. |
| Distinct total | **267 PASS / 0 FAIL**: 38 C3b + 49 READ + 180 additional regressions. Equivalently 41 new cases and 226 existing regression cases. Assertion loops, historical runs and repeated correction verification are not extra distinct coverage. |
| API build | TypeScript API production build exited 0. |
| Source/test TypeScript | API tsconfig.test.json check exited 0, including the prepared integration file. |
| Repository lint | eslint . --max-warnings=0 exited 0. |
| Formatting | Prettier passed on all eleven stage TypeScript source/test files. Existing docs exclusion remains; Markdown encoding/inserted whitespace checked directly. |
| Scope/security | Exactly fifteen changed stage paths (six new, nine existing) against this gate's hash baseline. Earlier-stage implementations outside scope, Auth/audit/F036/F037, F026-F029, configuration/dependencies and unrelated files unchanged. No automatic production caller/route/UI added. |
| Documentation integrity | API_DESIGN.md and DATABASE_DESIGN.md retain their entire pre-C3b bytes as a prefix; only the approved additive internal/catalog/union refinements in 26.9 were appended. This plan's prior content and roadmap historical content are retained. |
| UTF-8/LF and whitespace | Strict decoding/LF checks for all fifteen paths, no new trailing whitespace, git diff --check PASS. No Git staging/commit/push. |

Focused commands from apps/api used the supported ordinary-user context:
node --import tsx --test tests/visualization-checkpoint-producer.test.ts
tests/section-evidence.test.ts. Additional regression invocation explicitly named
the twelve offline files above; no *.integration.ts file was executed. No tests
failed at runtime. The first TypeScript-only pass failed on the implementation
typing issues documented in 27.1; their resolution and final static PASS are
retained rather than misreported as an uninterrupted first-pass result.

### 27.3 Separate formal source/security/architecture review

Reviewed all fifteen stage changes against Section 26 and owner P1-P8, separately
from the implementation pass. Actual findings and disposition:

| Severity | Finding and affected source | Resolution |
| --- | --- | --- |
| LOW, resolved | section-evidence.repository.ts:290 and :295 initially relied on READ TypeScript parameter types while the shared model constructor now accepts both runtime branches. A substituted internal VISUALIZE row could reach the READ insert adapter. | Added explicit challengeRecord/receiptRecord parsing before construction, mirrored explicit VISUALIZE insert parsing in visualization-checkpoint.repository.ts:389/:394, and added the third C2 compatibility test. Final 87-case C3b/READ run PASS. No application route or external exploit path existed. |
| LOW, resolved | visualization-checkpoint-producer.integration.ts:619 initially captured the controlled expiry clock before creating/reviewing its definition. Real setup time could make authoredAt later than that frozen clock and incorrectly block the prepared expiry test. | Capture the clock after definition setup. Static/source checks cover the reordered fixture; integration runtime remains NOT_RUN. No timeout/assertion/production behavior was weakened. |

**Final unresolved findings: CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0.** Both
corrections were within already-approved source/test paths and contracts. No
unapproved file, dependency, architecture change or authorization expansion was
needed. No Critical/High finding was discovered or silently corrected.

Reviewed conclusions:

- Catalog author/reviewer current role/status checks, independent identities,
  immutable authored envelope and approved fingerprint precede trust. Definition
  state/revocation changes are constrained by validated exact before-image CAS;
  no client flags or Student bodies authorize definitions.
- Current published ancestry/references, canonical F026 source validation and
  server-computed exact revisions are checked before/inside work and at proof.
  No silent trimming/repair of stored graph text or invented editorial history.
- Definition fence precedes persisted issue-count/active queries. Same-version
  concurrent issuers cannot bypass one-active/three-total limits; exact replay
  adds no row. Expired/withdrawn/consumed history counts; no deletion/reset worker.
- Definition and challenge fences serialize restriction/consumption/replay.
  Correct and incorrect responses each consume once; malformed/out-of-set responses
  roll back/refuse without advancing stored fences or inserting receipts.
- Exact request fingerprints and owned cross-links distinguish replay from changed
  requests. Fresh authorization/bindings, original expiry and terminal revocation
  still apply to replay; no alternate proof-free result path.
- Four exact index checks, bounded transaction body entries/time policy,
  majority+journaled commit and owned primary-majority proof remain mandatory.
  Proof/cleanup/uncertainty errors suppress results without erasing possible history.
- READ parsers, queries, writes, DTOs, three-index readiness and original tests
  remain explicit. Shared union schemas never make arbitrary sections/policies
  valid or introduce VISUALIZE defaults into READ rows.
- No expected-choice copies, selected-choice body, scores, raw keys or tokens in
  receipts/DTOs/errors/logs. Outcome feedback and low-entropy fingerprint inference
  limits are documented; no anonymity, WORM or secret-feedback claim.
- Accessibility equivalence is an internal textual-choice contract only. No
  playback/timing/control modality can qualify a response or create a stronger
  completion claim. Receipt qualification is always NOT_ESTABLISHED.
- Canonical amendments are only the explicitly approved additive LOCAL/internal
  commands, catalog and strict VISUALIZE storage/index/transaction/privacy contracts.
  Existing public API/Auth/Practice/READ/studentProgress architecture is preserved.
  No F036/F037 mutation, B2 promotion, Stage A VERIFIED adapter or F039 integration.

### 27.4 Prepared MongoDB coverage and remaining limits - NOT_RUN

visualization-checkpoint-producer.integration.ts is prepared and type/syntax
checked only: **15 child scenarios plus parent, all NOT_RUN**. No database process,
connection, collection or index was created in this gate. Expected standalone
allowlist remains four secondary indexes (one catalog and original three C2),
plus standard _id_; no persistent provisioning or prerequisite index is inferred.

Prepared coverage includes independent Admin review, current Student/LOCAL/owner
checks, correct/incorrect/invalid consumption, issue/replay/conflict, concurrent
issue/response, persisted limits, withdrawal/catalog restriction, publication/
revision mismatch, rollback, controlled majority-proof loss, missing catalog-index
refusal with preserved READ readiness, exact expiry, restriction races and unchanged
synthetic Practice/progress sentinels. Nonunique/option readiness controls have
offline native-adapter coverage only; do not call them live PASS. The single
integration invocation awaits a separate ownership-safe disposable MongoDB approval.

The live suite's controlled missing-proof injection is not real failover, network
partition or uncertain-commit testing. Its controlled expiry clock is not a real
five-minute wall wait. Offline concurrency uses serialized transactional mocks;
production MongoDB contention/commit behavior remains NOT_VERIFIED until the
guarded suite runs. A prepared test is not passing runtime evidence, including
the corrected expiry fixture. Initializer/process supervision/cleanup remain the
previously approved external owned-Job/native-handle procedure, never PID cleanup.

Source snapshot equality does not establish monotonic publication/history, prevent
undetected ABA or fence every editorial/account writer. Initial operational scope
is disposable synthetic only. Persistent access/retention/erasure/backup and
review operations, public API/UI, checkpoint coverage and completion qualification
require later decisions. No central audit vocabulary/collection change is made.

C3b adds **zero browser scenarios**. All **141 expected browser scenarios remain
NOT_RUN**, with all historical Windows/F022/F024/F029 limits and nontransferable
exceptions preserved. No browser, mounted accessibility or production readiness
claim is made.

**C3b IMPLEMENTATION/OFFLINE VERIFICATION PASS - PARTIAL F038 FOUNDATION.** Next
gate: explicit approval for one guarded disposable MongoDB integration, exact
four-index allowlist and existing ownership/cleanup safeguards. C3b stage final
acceptance, persistent use, public integration and full F038 acceptance are
separate gates. F001-F037 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT;
F038 remains **IN_PROGRESS**, F039 NOT_STARTED. STOP after offline verification.

## 28. Stage C3b guarded MongoDB verification - 2026-10-20

### 28.1 Preserved blocked attempt and authorized initializer correction

The previous guarded attempt was BLOCKED before index provisioning: the temporary
initializer called listDatabases() on a MongoDB Db object, producing
TypeError: admin.listDatabases is not a function. Replica initialization reached
PRIMARY, but the exclusive/empty-target check did not complete. There were zero
integration invocations and no indexes provisioned. Initializer exit was 1;
shutdown helper and MongoDB exited 0. Cleanup was graceful, without forced Job
termination; protected baselines were unchanged. Retained evidence:
.cache/f038-c3b-integration-2026-10-20-04-40-57-036791.

Under separate owner approval, changed only the temporary in-memory initializer
call from admin.listDatabases({nameOnly:true}) to
admin.admin().listDatabases({nameOnly:true}). The installed MongoDB driver exposes
Db.admin() and Admin.listDatabases(); the supported Admin interface preserves
database enumeration and all original exclusivity checks. All other runner
characters, deadlines, process checks and integration assertions were unchanged.
PowerShell parsing passed. No repository helper, implementation or test changed.

### 28.2 Fresh isolation and exact index provisioning - PASS

The supported ordinary-user context was REDGOLDMARK42\Shreeji, PowerShell 7.6.7,
with Administrator membership disabled. Before startup, port 27018 was free;
prior disposable C3b processes and storage were absent. A fresh private owned Job
and marked disposable storage were created for this invocation only.

Retained native-handle and independent-handle identity, executable, parent,
GetOwner, exact Job membership and live-state checks all passed for MongoDB and
each owned Node helper, including checks before connections and shutdown.
MongoDB PID 11732 native UTC creation was 2026-10-20T04:59:26.9036657Z; CIM was
2026-10-20T04:59:26.9036650Z. Both truncate UTC ticks identically to the common
one-microsecond value 639280691669036650. Raw native FILETIME and raw timestamps
remain in identity evidence; retained/independent native FILETIME equality was
exact. No arbitrary tolerance or PID-only ownership was used.

Initializer independently verified the exact fresh dbPath, loopback
127.0.0.1:27018, replica f021-test, sole replica member, writable PRIMARY, allowed
system-only database enumeration and empty deeplearner-f021-test target. It
closed its connection and exited 0 before integration began. The suite repeated
target/PRIMARY/emptiness checks before fixtures.

Provisioned and readiness-verified only these four approved secondary indexes,
plus standard _id_ indexes, in the exclusively owned disposable database:

| Collection | Exact index name | Ordered key | Constraint |
| --- | --- | --- | --- |
| visualizationCheckpointDefinitions | uq_visual_checkpoint_version | {visualizationId:1,checkpointId:1,checkpointVersion:1} | UNIQUE |
| sectionEvidenceChallenges | uq_section_evidence_issue_key | {userId:1,issueKeyHash:1} | UNIQUE |
| sectionActivityReceipts | uq_section_activity_challenge | {userId:1,challengeId:1} | UNIQUE |
| sectionActivityReceipts | uq_section_activity_ack_key | {userId:1,ackKeyHash:1} | UNIQUE |

Readiness checks enforce exact names, ordered keys, v2, unique=true, simple
binary collection semantics and absence of alternate index options. No F036,
F037, B2, persistent database or additional index provisioning was required.

### 28.3 Single prepared integration invocation - 16 PASS / 0 FAIL

Executed visualization-checkpoint-producer.integration.ts exactly once, with
zero invocation retries: 15 child scenarios and their parent, **16 PASS / 0 FAIL**,
zero cancelled/skipped/todo. Suite duration was 13,927.5578 ms; the entire guarded
runner, including preflight and cleanup, took 36.89 seconds. Application-level
bounded transaction conflict handling remains unchanged.

Live disposable verification covered independent Admin review and immutable
author identity; LOCAL/current Student/account checks; correct and incorrect
one-use consumption with exact DTOs; invalid response non-consumption; exact
issue/response replay and changed-payload conflicts; concurrent issuance and
consumption without duplicates; persisted one-active/three-issue limits;
withdrawal and terminal definition revocation; publication/revision mismatch;
receipt-insert rollback of fences/consumption; owned majority-proof requirements;
missing catalog-index refusal while READ retains original three-index readiness;
controlled expiry; withdrawal/restriction races; minimized private response data;
and unchanged synthetic Practice/progress sentinels.

The controlled missing-majority-proof injection suppressed the result while a
committed receipt remained. This is not real MongoDB failover, network partition
or uncertain-commit testing. Expiry uses a controlled clock, not a real five-minute
wait. Incorrect/nonunique/alternate-option index refusal remains offline verified
only; the live suite's refusal control removes/restores the approved catalog
index. Do not upgrade these limitations to live PASS.

### 28.4 Graceful cleanup and preserved boundaries - PASS

All four owned child processes exited 0: initializer 23380, integration 29468,
shutdown helper 25652 and MongoDB 11732. Connections closed; verified graceful
shutdown completed. No forced termination or UNKNOWN exit code occurred. Exact
Job emptiness, retained-handle disposal, port 27018 release and removal of only
the marked disposable storage all passed; cleanup errors were empty.

Protected MongoDB PID 5144/127.0.0.1:27017 and development Node process identities
22060/25772, their parent/creation identities and monitored listener baselines
were unchanged. Persistent demo-storage filesystem metadata was unchanged; this
is not a logical database-content audit. Protected databases were not queried or
modified. All nonignored source hashes matched before/after execution, before
this authorized evidence-only append.

Retained evidence: .cache/f038-c3b-integration-2026-10-20-04-59-20-eef5e7,
including result.json, individual identity/exit records, index definitions,
initializer/integration/shutdown output, MongoDB log and baseline/source pins.
Ignored diagnostic evidence is separate from repository delivery.

No expected-choice disclosure, Stage A VERIFIED evidence, completion
qualification, F036/F037 mutation or F039 integration was introduced. Snapshot
hashes still do not establish monotonic editorial history or eliminate ABA;
persistent retention/erasure/backup, broader writer fencing, public integration,
trusted completion qualification and release requirements remain outstanding.

C3b adds zero browser scenarios. All **141 expected browser scenarios remain
NOT_RUN**; no browser exception, accessibility PASS or production readiness is
implied. No previously passing offline suite was repeated in this gate.

**C3b GUARDED INTEGRATION PASS - PARTIAL F038 FOUNDATION.** Next approval gate:
separate C3b final source/security/transaction/architecture review. F001-F037
remain APPROVED_COMPLETE for LOCAL DEVELOPMENT; F038 remains **IN_PROGRESS**;
F039 remains NOT_STARTED. STOP after this single guarded integration gate.

## 29. Stage C3b final security, transaction and architecture review

Owner authorized a separate final review on 2026-10-20, followed by read-only
completion-gap analysis only if this review passes. No implementation, test rerun,
database/browser execution, Git delivery or full-feature acceptance is authorized.

**STAGE C3b FINAL REVIEW PASS — PARTIAL F038 FOUNDATION**

### 29.1 Exact reviewed scope and findings

Reviewed all fifteen paths in 26.10: six stage creations and nine modifications,
including the shared READ/VISUALIZE models/adapters, both test files, READ
compatibility tests and all four documentation paths. All fourteen paths other
than this evolving evidence document match the retained post-implementation
SHA-256 baseline. Reviewed current complete source for the new files and shared
storage refinements; earlier F038 additions are not miscounted as new C3b work.

Final actual findings: **CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0 unresolved**.
No additional correction or owner disposition is required for the approved
LOCAL-only, internal, disposable-synthetic C3b boundary. The two previously
resolved Low findings in 27.3 and blocked initializer history in 28.1 remain
preserved; this review does not rewrite those results.

Reviewed source conclusions, with reference locations at review time:

- visualization-checkpoint.service.ts:223-347 and :420-489 revalidate current
  approved source and independent eligible Admin provenance, refuse self-review,
  and enforce terminal definition restriction. Approval flags are not authority.
- visualization-checkpoint.repository.ts:255-334 and the inherited READ ancestry
  adapter require current eligible accounts, full published ancestry/references,
  canonical F026 visualization validation and server-computed snapshots.
- visualization-checkpoint.service.ts:490-579 serializes issue/replay under the
  definition fence, counts persisted consumed/expired/withdrawn history and
  enforces one active/three total fresh issues per owner/definition. Exact replay
  does not add an issue. Owner/policy/checkpoint/revision bindings are explicit.
- visualization-checkpoint.service.ts:580-688 evaluates only a trusted loaded
  definition, refuses invalid responses before writes, and atomically fences
  consumption with receipt insertion for both correct and incorrect responses.
  Linked owned receipt proof checks outcome, request fingerprint and all bindings.
- visualization-checkpoint.repository.ts:145-221, :343-421 and
  section-evidence.repository.ts:385-464 retain exact-before-image CAS fences,
  bounded transaction work, majority+journaled commit, primary-majority proof,
  uncertainty refusal and cleanup-error suppression. Withdrawal/revocation/replay
  use the appropriate shared fence; no result bypasses durability proof.
- Shared strict union parsers, READ-only native queries/inserts and the READ
  service's explicit branch guard preserve original READ DTOs, fingerprints and
  three-index readiness. C3b adds only the exact catalog index requirement.
- Explicit output projections omit expected/selected choices, raw keys, tokens,
  private snapshots and scores. No sensitive logging, F036 attempt mutation,
  F037 progress mutation, Stage A VERIFIED adapter or F039 caller is introduced.
  Outcome feedback still permits the already disclosed correctness inference.

### 29.2 Canonical architecture consistency and evidence limits

API_DESIGN.md:2047 onward and DATABASE_DESIGN.md:1225 onward contain only the
approved additive amendments in 26.9. SHA-256 comparison of each entire preceding
byte prefix matches the retained pre-C3b baseline. Existing Auth, public API,
Practice, studentProgress and READ contracts are preserved. Internal checkpoint
commands are not public routes. Receipts are ACTIVITY_ONLY with
completionQualification=NOT_ESTABLISHED, not comprehension or completion proof.
Application append-only guards are not database WORM; source equality hashes are
not monotonic publication history or universal editorial/account writer fences.

Retained evidence: 267 distinct offline PASS; build/static/security PASS;
16/16 MongoDB records PASS including the parent; four exact unique secondary
indexes verified; rollback, concurrent issuance/consumption, replay, revocation,
READ compatibility and owned durable receipt proof PASS. All four child exits
were 0, cleanup was graceful, protected baselines unchanged and no forced cleanup
was needed. Full evidence paths and original blocked run remain in Section 28.

Live missing-index refusal is verified. Nonunique/alternate-option refusal is
offline verified only. Controlled missing-majority-proof injection is not real
MongoDB failover, partition or uncertain network-commit verification; controlled
expiry is not a real five-minute wall-clock wait. These limitations remain open.

### 29.3 Partial acceptance and remaining obligations

C3b is accepted only as a partial internal LOCAL-development foundation. Trusted
section qualification, Example/optional Revise producers, completion-qualifying
Practice assessment provenance and score/coverage selection, student-facing
integration, canonical studentProgress completion persistence, revision
invalidation/revocation, privacy/retention/erasure and release requirements remain
undelivered. Existing READ acknowledgements and visualization interaction receipts
must not be silently promoted into completion evidence; B2 stays DIAGNOSTIC.

C3b adds zero browser cases. All **141 expected browser scenarios remain NOT_RUN**;
no inherited exception, browser/accessibility PASS or production readiness follows.
Only this feature document changes in this review gate. F001-F037 remain
APPROVED_COMPLETE for LOCAL DEVELOPMENT, F038 remains **IN_PROGRESS**, and F039
remains NOT_STARTED. The consolidated gap assessment is read-only; its delivery
scope and product/architecture decisions need separate owner planning approval.
STOP after review and analysis; no implementation or Git delivery.

## 30. Consolidated end-to-end Concept completion delivery plan

### 30.1 Planning authorization, sources and delivery boundary

The owner's 2026-10-20 consolidated approval authorizes ONLY this appended plan.
It does not approve implementation, the revised inventory, canonical amendments,
new personal-data storage, index provisioning, services or execution. Section 29's
C3b acceptance and every earlier result remain intact. F038 stays IN_PROGRESS;
F001-F037 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT, F039 NOT_STARTED.

Inspected AGENTS, PRD sections 14-15, System Architecture, API/Database Design,
F021/F030-F038 contracts and the actual Concept/Practice/progress/evidence/grading
adapters. Reused the Concept-learning Stitch screenshot and structural HTML:
section navigation, persistent explanation and an explicit footer action are useful
references. Its XP, percentages, notes and animated telemetry are not approval to
implement those capabilities. F029 is a gated fixture, not a published Student
Visualize integration; the new workflow must retrieve real approved scoped graph
data rather than treating that fixture as student evidence.

This is one bounded proposal with THREE slices, not another sequence of pure
foundations. The smallest supportable operational target is a fresh, guarded,
synthetic disposable LOCAL dataset with explicitly enrolled Concepts. It is not
permission to enable completion against the persistent demo or general student
data. Broader persistent enrollment, assessment types and Topic completion remain
distinct decisions; this bounded subset cannot be called general PRD completion.

| Canonical source | Actual contract | Proposed reconciliation / owner approval needed |
| --- | --- | --- |
| PRD 14 | Topic completion needs required sections, visualization, practice and configured score; default 70; Admin Topic/path overrides. | Deliver Concept completion only as an explicitly approved subset. Topic aggregation remains unimplemented, not silently satisfied. Add Concept override priority without deleting Topic/path override semantics. |
| PRD 15 | Unlimited practice; preserve first/latest/best scores and all attempts. | Unlimited ordinary F036 submissions remain. Only a demonstrably first pre-disclosure submission may supply the initial qualifying grade. First/latest/best QUALIFYING scores are distinguished from ungraded practice counts; never fabricate grades for ordinary retries. |
| Database Design 12 / studentProgress | Canonical Concept summary, sections/score/completion lifecycle separate from mastery. | Version the existing summary in place; do not introduce an alternate canonical completion-state collection. A separate minimal request receipt below is solely durable idempotency history. |
| F021 / F037 | completionRules deferred; strict activity-only schema and exact five-field GET. | Explicit additive schema approval is necessary. Keep GET /progress and authoritative count/time reconciliation unchanged even for new summary versions. |
| F036 | Immutable SUBMITTED/null-score attempt, atomic activity update, majority proof BEFORE answers; original receipt/GET DTOs. | Preserve all guarantees and record shape. Add first-submission assessment insertion to the SAME transaction only for enrolled fresh scope; this requires the previously omitted attempt-repository path. |
| A / C1 | Metadata evaluator is not an authenticity verifier; C1 never establishes qualification. | A trusted adapter must derive policy inputs from proven server records. Never accept VERIFIED or approval flags from HTTP or reinterpret C1 output as a certificate. |
| B1 / B2 | Explicit exact-text OUTPUT grader; reviewed authority; B2 records DIAGNOSTIC only. | Reuse algorithms/provenance/fences with a new explicitly approved assessment branch. No old diagnostic result is relabelled or retroactively promoted. |
| C2 / C3b | Authenticated ACTIVITY_ONLY receipts, no completion qualification; five-minute response challenges. | Require explicit policy acceptance of acknowledgements / correct checkpoint interaction as sufficient actions. Preserve receipt contracts and distinguish genuine interaction from comprehension. |

### 30.2 Numbered product and architecture decisions awaiting approval

The latest owner message asks for recommendations, not silent adoption. The
following D1-D10 are proposed final decisions; implementation stays blocked until
the owner accepts them and the revised scope/canonical wording.

| Decision | Conservative bounded recommendation | Consequence / excluded alternative |
| --- | --- | --- |
| D1 - Unit and sections | Concept level; initial workflow requires READ, VISUALIZE, EXAMPLE and PRACTICE. REVISE is additionally required only when configured. | Stage A's existing mandatory Visualize/Practice minimum is not weakened; the initial trusted resolver accepts the stronger four-section minimum. Missing Example/visual content blocks, not an implicit waiver. Topic completion and mastery remain separate. |
| D2 - Threshold | Valid explicit approved Concept minimumScore, then explicit Topic completionScore, then existing Learning Path completionScore, then 70. Integer 0-100; reject malformed explicit values rather than falling through. | Concept priority is additive beyond PRD's described Topic/path overrides and needs explicit canonical approval. Even threshold 0 never bypasses genuine grading or section coverage. |
| D3 - Section qualification | A policy may accept explicit current READ/EXAMPLE/required-REVISE acknowledgements as completion actions, not comprehension proof. VISUALIZE needs a CORRECT receipt from the exact independently reviewed required checkpoint. | All records remain ACTIVITY_ONLY/NOT_ESTABLISHED under their producer DTOs. Only the new policy-bound server adapter establishes that a proven action meets an approved requirement. Without this product decision, completion is unavailable. |
| D4 - Coverage and score | Exactly one explicitly pinned required OUTPUT question/rubric and one visualization/checkpoint definition per initial policy. Use the first eligible pre-disclosure assessment, score 100 or 0, without rounding or best/latest retry selection. | No random easiest question, average of missing grades or diagnostic promotion. Multiple required questions, other required question types and unknown configurations are unsupported/ineligible until separately designed. A one-question binary score reaches default 70 only at 100. |
| D5 - Anti-copying | Enroll only fresh supervised synthetic scope; record a new qualifying assessment atomically with the account's first-ever F036 submission for that question, before any answer return. | No historical grading/backfill. Later submissions, new keys, public-content edits, new rubric versions or policy reactivation cannot reset first-ever eligibility. After a first failure, ordinary practice stays unlimited but cannot repair completion through reveal-assisted retries. Blind retries/new unseen tasks need a separate product/contract choice, not an implementation shortcut. |
| D6 - Validity | Consumed receipt remains usable after its response challenge expires, only while current source/policy bindings and nonrevoked linked state remain valid. No fixed receipt TTL initially. | This is a new qualification reader, not a relaxation of C2/C3b replay expiry. Withdrawals and terminal policy/rubric/definition revocation invalidate effective qualification. Hash equality does not prove publication history or eliminate ABA. |
| D7 - Completion action | Explicit Mark Concept completed action, no automatic completion from a tab/view/count/grade. GET is read-only. | Only current authoritative eligibility plus a committed owned summary can yield COMPLETED; no mastery/XP/percentage or Topic claim. |
| D8 - Persistence/idempotency | studentProgress v2 completion claim plus append-only completionRequests receipts, one unique account/request-key identity. Preserve old summary and assessment branches. | The extra request model is necessary to remember old keys across later revisions; keeping only the latest key in a mutable summary would silently forget idempotency history. |
| D9 - Invalidation | Fresh reads project stale/revoked claims as ineffective; GET does not repair data. New explicit completion may replace the latest summary claim only after full revalidation; old request receipts remain immutable. | No background migration/backfill, no claim that a mutable summary is an immutable completion ledger, no automatic restoration following terminal revocation. |
| D10 - Operation/privacy | LOCAL, fresh supervised synthetic disposable scope only, no new dependencies or persistent provisioning. Current eligible independent Admins author/review policy enrollment through internal server commands. | Metadata alone cannot authorize enrollment. Real-account/persistent reuse, historic disclosure certification, finite retention/erasure/backups and production release remain unavailable until separately approved. |

If first-attempt-only grading is unacceptable as a student experience, STOP for
product disposition. The alternative is a new no-disclosure submission/retry
workflow with a shared exposure ledger covering every answer-returning path; it
requires a different API/UI/persistence inventory. Do not implement that alternate
workflow under this inventory or silently allow best scores after reveal.

### 30.3 Trusted qualification and pre-disclosure proof

Effective Slice 1 owner replacement: Section 31 supersedes runtime supervisor/storage attestation with server-established synthetic origin. The original proposal below is retained as history.

#### Authenticated section actions

A server-only completion-evidence adapter loads the actual account from verified
authentication, current published Concept plus all four ancestors and exact
references, the active approved completion policy, and owned durable records.
Client IDs choose a resource only; they never identify the owner or supply scores,
rubrics, completion flags, revisions claimed as authoritative, or evidence IDs.
Each producer wrapper also verifies that an owned challenge belongs to the exact
URL Concept and active policy scope before invoking its section command; another
Concept's challenge is hidden even for the same owner. Idempotency namespaces are
explicit: issue and response commands are scoped by operation/section/owner as in
their producer hash domains, while completion keys are account-wide through the
new unique request index. Reuse with changed payload inside a namespace conflicts.

For READ, require an owned C2 consumed challenge/receipt cross-link, exact server
Concept/section snapshots, allowed READ producer/policy versions, successful
acknowledgement before challenge expiry, current nonwithdrawn state and fresh
publication/authorization. An old receipt is not qualified just because it exists.
No scroll, page visit, dwell time or local checkbox substitutes for the action.

EXAMPLE uses an explicit authenticated acknowledgement of the whole nonempty
current Example section, including all displayed entries. REVISE uses the same
boundary only when required and current Revise content is nonempty. Add explicit
strict schemaVersion=3 section variants for EXAMPLE and REVISE, with distinct
producer policy IDs F038_EXAMPLE_ACK_ACTIVITY / F038_REVISE_ACK_ACTIVITY,
policyVersion=1, producerVersion=1. Preserve READ v1 and VISUALIZE v2 exact parsers.
The new section digest hashes the ordered safe section projection with a distinct
domain, Concept ID and section; retain C2's existing Concept/READ digest algorithms.
All issue/ack/withdraw/replay/index/majority rules remain those of C2, with
section-scoped parsing and server-produced five-minute challenges. No section
producer claims comprehension, persists raw content, or writes studentProgress.

VISUALIZE requires the exact policy-pinned reviewed definition/version, current
server visualization/Concept snapshots, eligible author/reviewer, a consumed owned
challenge and matching CORRECT receipt. INCORRECT receipts record activity but do
not qualify. Invalid responses never consume. Existing one-active/three-issue
budget, terminal definition restriction and withdrawal fences remain unchanged.
No playback/timing prerequisite, inferred success, quota reset or easier
checkpoint substitution. Accessible textual choices and graph description must be
returned by the server; C3a compares the server-loaded expected choice only.

After these checks, and only under approved D3, the adapter constructs fresh
Stage A metadata with VERIFIED/COMPLETED meaning "this authoritative current
action satisfies this policy", not "the student understood the material".
It binds the current completion-policy ID/version explicitly, separately verifies
the producer policy/version, and never changes stored ACTIVITY_ONLY receipts or
their public NOT_ESTABLISHED result. Neither C1 nor C3a independently signs evidence.
Require section challenge issuance at or after activation of the reviewed
completion policy in the same trusted fresh run. Pre-activation activity is not
retroactively promoted. For READ/EXAMPLE/REVISE, inspect at most 32 owned candidate
receipts per section plus one overflow sentinel within a bounded query; excess or
malformed contradictory data refuses rather than truncates into a positive result.
Select the earliest currently valid receipt by action timestamp then _id. Repeated
valid acknowledgements do not duplicate a section. Withdrawal invalidates that
specific source; it does not silently revoke another separately valid receipt.
An existing completion bound to a withdrawn source becomes ineffective even if
another receipt now makes a NEW explicit completion eligible. No automatic restore.
These bounded discovery queries use existing owner-leading indexes and operation
deadlines in the small disposable scope; scalable query indexes are not inferred.

#### Qualifying OUTPUT assessment, not post-reveal regrading

The 48-path proposal's separate /assess command is withdrawn. Grading on demand
after F036 has already returned an answer cannot prove pre-disclosure input.

Proposed F036 integration for an enrolled first submission:

1. Use the existing authenticated STUDENT path and validated frozen body/key.
   In the existing bounded transaction, load current published question/ancestry,
   public revision and private solution/reference fingerprint, owned attempt
   sequence, approved active policy and exact reviewed rubric/version.
2. Require the trusted fresh disposable scope and enrollment activation preceding
   submission, exact required OUTPUT question, TEXT/EXACT_TEXT/NONE rubric and
   first-ever account/question sequence (last=0, new attemptNumber=1).
   Previously existing attempts or unknown legacy exposure provenance cannot
   establish a qualifying record. Empty/malformed rubric input never creates a
   numeric score. Preserve all original four-type normal submission behavior.
3. Take the policy and rubric authority consistency fences, revalidate current
   independent eligible Admin review/audit provenance and policy intent to use
   that exact rubric for completion. A B2 diagnostic approval alone is insufficient.
   Use B1 on the actual immutable candidate answer, never a second client answer.
4. Insert the unchanged F036 attempt, the normal F037 activity summary update and
   the new append-only qualifying assessment in ONE snapshot transaction.
   Verify the stored attempt image/ownership/bindings within the session. Grading
   may be computed before commit; it does not become durable evidence until all
   these writes majority+journal commit and exact owned proof succeeds.
   Insert the assessment before the progress update so new genuine score summaries
   are recorded in the same transaction. Invalid B1 text for an enrolled required
   first submission yields validation refusal and rollback before disclosure;
   it is not saved as a made-up grade or consumed first chance. Ordinary nonenrolled
   F036 validation remains unchanged.
5. Reuse the original ten-second budget/two-second proof reserve and maximum
   three body entries. No nested withTransaction, extra operation timeout inside
   a CSOT transaction, unbounded retry or compensation rewrite of attempts.
6. Before F036 returns any answer, prove the original owned committed attempt AND
   the associated qualifying assessment, current policy/rubric/source bindings
   and original receipt invariants. Missing proof/uncertainty yields sanitized
   503 and no answer. Exact same-key replay returns the same existing outcome
   only after proof; it never manufactures a missing assessment after the fact.
7. First score 0 is a genuine failed assessment, not a refusal. Later ordinary
   submissions still persist/count/unlock under F036, but create no qualifying
   assessment. Same-key/different-answer conflicts; same-key/exact-body replay
   cannot replace the first answer. No revision/version/reset makes a later
   copied answer the first attempt.

The current code's universal first-attempt number establishes ordering only under
F036. It cannot prove that a historic F035 transient answer was never seen.
Therefore the initial trusted setup must establish a fresh empty disposable target,
new synthetic actors/questions, current F036-only answer-returning code, and
enrollment before activity. The future supervised setup constructs a server-only
scope bound to the actual connection and run epoch before fixtures; HTTP/config
booleans and a persisted claimed epoch are not proof. Normal app construction
without that verified scope must not enable these completion operations. No new
environment flag is proposed. If this scope cannot be proven, fail closed rather
than enabling persistent-demo users or retroactively classifying historical rows.

This proves ordering of answers returned to that account by this application in
the controlled scope. It does not detect another account, Admin assistance,
external copies or prior human knowledge; no general anti-cheating claim is made.

### 30.4 Proposed persistence schemas and exact readiness

Effective Slice 1: Section 31 implements only the reviewed 70% Concept envelope, qualifying assessment branch and memory-only logical origin. Topic/Path authority, completion summaries and request persistence remain deferred.

These are PROPOSED canonical amendments, not implemented models or data.

**Concept completionRules:** a strict bounded versioned envelope, schemaVersion=1,
decisionFence nonnegative safe integer, activeVersion nullable, and at most ten
authored policy versions. Each has policyId (1-128 ASCII token), positive safe
version, exact Concept revision, source epoch, requiredSections, optional integer
minimumScore, one required question/rubric binding and one visualization/definition
binding. IDs are canonical ObjectIds; snapshots/fingerprints lowercase 64-hex.
Required references include question public revision/private fingerprint,
rubricId/version/definition fingerprint and visualization/definition snapshot and
version. Record authoredBy/At and independent approvedBy/At/fingerprint from
current server authorization, plus terminal revokedBy/At. Active definitions
cannot be edited; new versions append under whole-envelope CAS, max ten without
automatic eviction. Concept's existing _id enforces envelope uniqueness; no new
policy collection or policy index. Content digest excludes completionRules to
avoid recursive hashing; policy digest separately covers its complete ordered
authored projection, version and referenced bindings, excluding lifecycle fences.

Internal proposed author/approve/revoke commands live in the completion service,
not public HTTP: author takes Concept plus strict authored configuration,
approve/revoke take Concept and exact policy version. Authentication token and
nonsensitive correlation are separate server inputs. Current eligible Admin
author/reviewer separation, exact fingerprint approval and terminal restriction
are mandatory. Current active policy controls selection; no client picks versions.
Historical versions remain bounded and immutable; replacing an approved version
or reaching the bound must fail, not silently delete history.

**Topic:** optional completionScore integer 0-100 with no implicit Topic default,
so an explicit Topic override is distinguishable from absence. Existing Learning
Path completionScore remains unchanged. Preserve public Topic/Concept DTOs; the
completion repository reads private policy/threshold projections separately.

**practiceAssessments:** retain original assessmentRecord, purpose=DIAGNOSTIC,
graderId=OUTPUT_EXACT_TEXT and its callers as an explicit unchanged branch.
Add a separate strict qualifying schemaVersion=2 branch with
purpose=COMPLETION_INPUT and graderId=OUTPUT_EXACT_TEXT_COMPLETION,
graderVersion=1. The different grader namespace identifies the qualifying pipeline,
not a different text-comparison algorithm, and prevents collision with diagnostic
identity without changing the existing six-key unique index.
Keep all existing owner/attempt/question/Concept/revision/private fingerprint,
rubric/version/reviewer/approval-audit/fence/request bindings. Add current
completion-policy ID/version/fingerprint, trusted source epoch and
submissionProvenance=F036_FIRST_SUBMISSION_ATOMIC_V1. Only CORRECT/100 or
INCORRECT/0, refusalCode=null, attemptNumber=1 qualify; invalid inputs create no
qualifying record. Store no new copy of student/expected answers or solution text.
Use explicit branch-specific constructors, repository queries, insertion and
proof methods; B2 diagnostic queries cannot consume these rows. No mutation of
F036 schemaVersion=1 SUBMITTED/null-score attempts.

**studentProgress:** preserve strict v1 records and introduce explicit strict v2.
Its exact root allowlist is _id,userId,conceptId,technologyId,learningPathId,
moduleId,topicId,attemptCount,status,startedAt,lastActivityAt,createdAt,updatedAt,
schemaVersion,sections,firstScore,latestScore,bestScore,completedAt,completion.
Keep the canonical sections/score/completedAt fields at the root, not in an
alternative schema. Existing owner/hierarchy/activity fields keep their original
types and invariants. sections is exactly readCompleted,visualizeCompleted,
exampleCompleted,practiceCompleted,reviseCompleted booleans. Scores are null or
genuine 0/100 values; completedAt is null or a server UTC date. No mastery field.

completion is null or a strict claim with exactly policyId,policyVersion,
policyFingerprint,conceptRevision,sourceEpoch,decisionVersion,requiredSections,
sectionReceipts,assessmentId,attemptId,minimumScore,selectedScore,requestReceiptId.
sectionReceipts is at most four strict {section,receiptId} pairs for non-Practice
sections, unique by section. Other fields use the ID/digest/token/score/version
types above. selectedScore is the current policy's qualifying assessment score;
the root scores are historical summaries, not eligibility inputs.

Keep scores null until a genuine qualifying grade. In the first-submission
transaction, insert that assessment before recording progress, so the same atomic
update can maintain the root first/latest/best qualifying scores even on a failed
grade. Earliest qualifying score never changes; deterministic evaluatedAt/_id
ordering resolves latest, and best uses genuine qualifying grades only. Historical
grades remain historical after source/reviewer revocation and cannot establish
current eligibility. Never substitute a DIAGNOSTIC or reveal-assisted retry score.
The initial single question yields equal first/latest/best; different future
approved unseen questions can update latest/best without overwriting first.
Bound this historical query to the ten policy versions plus one corruption
sentinel; duplicate/out-of-scope or excessive records fail closed, not truncate.
No arbitrary all-question average or first-score reset is authorized.

A first qualifying submission may create v2 with status IN_PROGRESS,
completion/completedAt null and section flags false; a grade alone never marks a
section or Concept complete. Explicit successful completion sets flags matching
the verified required actions, completedAt and the bound claim atomically.
Root status can then be IN_PROGRESS or COMPLETED; COMPLETED describes the stored
claim's bound revision. A completion read MUST recompute effective validity.
F037 still returns its original activity-derived NOT_STARTED/IN_PROGRESS DTO,
never blindly maps the stored root status to its public activity status.

F036/F037 writers must parse both versions, continue exact count/min/max checks,
and preserve the completion subdocument/version while updating only activity.
They cannot overwrite v2 with v1 or reset completion based on another ungraded
attempt. GET never converts or repairs v1. The first successful explicit complete
transaction upgrades one owned summary under CAS. No backfill/migration.
Replacing the latest claim for a new policy/revision requires fresh eligibility
and an explicit action; retain previous immutable request receipts. The summary
is not a complete immutable completion-decision history.

**completionRequests:** necessary NEW append-only private request receipt, not a
second canonical completion-state store. Exact fields:
_id,userId,conceptId,policyId,policyVersion,conceptRevision,viewRevision,
requestKeyHash,requestFingerprint,summaryId,decisionVersion,committedAt,
schemaVersion=1. Strict ObjectIds/tokens/digests/safe integers/UTC dates; no raw
keys, content, answer, score or token copies. Exact request fingerprint binds
owner, Concept, frozen viewRevision and command domain. No update/delete/reset
HTTP. New unique index uq_completion_request_owner_key, ordered
{userId:1,requestKeyHash:1}, UNIQUE. Missing readiness refuses before writes.
Keeping only the latest request key on studentProgress is rejected because a
later revision would erase conflict/replay history.

The complete proposed disposable secondary-index allowlist is thirteen, plus
standard _id_ indexes. Verify exact collection/name/ordered key/v2/uniqueness and
approved options before any separately approved provisioning:

| Collection | Exact name | Ordered key | Unique |
| --- | --- | --- | --- |
| practiceAttempts | uq_practice_attempt_sequence | {userId:1,questionId:1,attemptNumber:1} | true |
| practiceAttempts | uq_practice_attempt_idempotency | {userId:1,idempotencyKeyHash:1} | true |
| practiceAttempts | ix_practice_attempt_owner_concept_time | {userId:1,conceptId:1,submittedAt:-1} | false |
| practiceAttempts | ix_practice_attempt_concept_time | {conceptId:1,submittedAt:-1} | false |
| studentProgress | uq_student_progress_owner_concept | {userId:1,conceptId:1} | true |
| practiceRubricVersions | uq_practice_rubric_version | {rubricId:1,version:1} | true |
| practiceRubricAuthorities | uq_practice_rubric_authority | {rubricId:1,version:1} | true |
| practiceAssessments | uq_practice_assessment_identity | {userId:1,attemptId:1,rubricId:1,rubricVersion:1,graderId:1,graderVersion:1} | true |
| visualizationCheckpointDefinitions | uq_visual_checkpoint_version | {visualizationId:1,checkpointId:1,checkpointVersion:1} | true |
| sectionEvidenceChallenges | uq_section_evidence_issue_key | {userId:1,issueKeyHash:1} | true |
| sectionActivityReceipts | uq_section_activity_challenge | {userId:1,challengeId:1} | true |
| sectionActivityReceipts | uq_section_activity_ack_key | {userId:1,ackKeyHash:1} | true |
| completionRequests | uq_completion_request_owner_key | {userId:1,requestKeyHash:1} | true |

Simple binary collection semantics, no partial/sparse/hidden/TTL/wildcard/alternate
options; nonunique definitions accept the driver's absent unique option as false.
No audit secondary index is needed for exact approval-audit _id proof; no generic
auth/catalog index provisioning is inferred. Actual unexpected prerequisites
require STOP, not auto-addition. Ordinary legacy F036/F037 still use their original
readiness sets; completion and enrolled qualifying submissions require the complete
relevant set, including all thirteen for the final completion transaction.
autoCreate/autoIndex/buffering remain disabled. No persistent provisioning follows
from schema approval.

### 30.5 Transactions, invalidation and durable completion

Completion repository owns its transaction; qualification hooks join the existing
F036 transaction rather than start another. Use the inherited bounded 10-second
total / 2-second proof-cleanup reserve / at most three body-entry policy,
snapshot PRIMARY reads and majority+journal write concern. Do not repeat the
historical operation-level timeoutMS conflict. Session cleanup failure suppresses
success; uncertain commit never authorizes an answer or a completed response.

For explicit completion, server-select current owned receipts and qualifying
assessment, verify all source/threshold/policy bindings, and run unchanged Stage A.
Require every initial section and genuine passing candidate; null/ungraded/missing/
unsupported/contradictory/stale evidence is ineligible. Obtain current policy CAS,
rubric authority, visualization definition and source-challenge fences for the
selected evidence. New operations take policy first, then authority/definition/
challenge identities in stable order, then the summary; existing revocation paths
must conflict on the same underlying fences. Never update append-only receipts or
assessment records merely to claim a fence. Privileged raw writes/global editorial
ABA remain outside this LOCAL boundary and must not be represented as protected.

In the SAME transaction update/create the single canonical summary and insert the
new request receipt. A same-current-snapshot completion with a new key may record
a new request receipt but does not change completedAt, scores or counts.
After commit, primary-majority prove the exact owned summary decision version,
request receipt, source cross-links and current authorization/validity. Concurrent
equivalent requests converge to one effective completion; same key creates one
request row. Changed frozen body/key use returns conflict. Do not disclose on
missing proof or infer rollback from a thrown postcommit error.

Same-key/exact-body replay revalidates current bindings and original owned receipt.
If its decision has been superseded, revoked or made stale, return a stale/unavailable
conflict; never resurrect that completion or create a new request from the old key.
The client must refresh and use a new key/body for a new decision.

GET returns a consistent read-only effective view. Changed content, policy,
private solution, rubric/definition authority or receipt withdrawal invalidates
the old claim immediately at the validation point: response STALE/REVOKED, not
COMPLETED. No GET writes or automatic "repair". Terminal authority restriction
cannot be undone by matching content. A legitimate new policy version may create
a new completion claim only if fresh eligible evidence actually exists; the
first-submission rule prevents regrading a revealed answer on policy/version reset.
No global instantaneous revocation or monotonic publication guarantee is implied.

### 30.6 Proposed exact HTTP, DTO and error contracts

All new paths use existing envelopes, verified authentication/current ACTIVE,
email-verified STUDENT and account ownership from the server. Require LOCAL and
the verified disposable scope; otherwise ROUTE_NOT_FOUND. This is new additive
HTTP exposure of narrowly wrapped producers, not permission to expose internal
Admin commands, rubric bodies, arbitrary receipts or raw database documents.

| Method / path | Strict input | Successful allowlist |
| --- | --- | --- |
| GET /api/v1/progress/completion | Only scalar conceptId query, empty params, no body. | Exactly the nine data fields below; read-only. |
| POST /api/v1/progress/completion/:conceptId/challenges | Empty query; UUID-v4 Idempotency-Key header; body {section} for READ/EXAMPLE/required REVISE or VISUALIZE. Policy selects definition; no client definition/owner/revision/score. | {section,challenge}; READ/ack variants use existing READ issue fields with exact server section/policy; VISUALIZE uses C3b's exact issue DTO. |
| POST /api/v1/progress/completion/:conceptId/responses | Empty query; UUID-v4 key; strict body {challengeId,acknowledged:true} for ack or {challengeId,selectedChoiceId} for VISUALIZE. | {section,receipt}; existing branch's exact minimal receipt DTO, completionQualification always NOT_ESTABLISHED. |
| POST /api/v1/progress/completion/:conceptId/complete | Empty query; UUID-v4 key; body exactly {viewRevision}. | Same nine-field current completion DTO only after durable proof, with completion.status=COMPLETED. |

No /assess endpoint, new submission endpoint, public Admin rubric/policy route or
attempt-history API. Existing F036 POST body/five-field data/receipt metadata and
Practice GET's exact seven fields stay unchanged.

Nine-field completion data DTO:

- conceptId: canonical lowercase 24-hex ID.
- viewRevision: lowercase 64-hex public safe view/config digest, not a credential.
- requiredSections: canonical ordered four sections plus REVISE only if required.
- sections: exactly one {section,status} per required section; status one of
  MISSING, QUALIFIED, STALE, REVOKED, UNSUPPORTED.
- practice: exactly {questionId,type,status,score,minimumScore}. Missing questionId/
  type/score are null, type otherwise OUTPUT. status is MISSING, QUALIFIED,
  BELOW_THRESHOLD, UNQUALIFIED, STALE, REVOKED or UNSUPPORTED. Numeric score only
  from the current owned proven qualifying assessment; no guessed score 0.
- eligibility: ELIGIBLE or INELIGIBLE, derived from server proofs and Stage A.
- blockers: allowlisted {code,section?} only; never raw supplied text or evidence.
- completion: exactly {status,completedAt}, status NOT_COMPLETED, COMPLETED, STALE
  or REVOKED; canonical UTC milliseconds or null. Historical completedAt may remain
  with a stale/revoked claim but is never a current completion assertion.
- visualization: null or exactly {id,graph}; graph is the existing bounded safe
  F026/F027 authored renderer projection, no expected choice, review/private fields.

Do not return account IDs, private fingerprints, rubric expected values, raw keys,
student answers, internal assessment records or approval metadata. viewRevision
hashes only public safe source projection, public policy ID/version/required
configuration and resolved threshold; private solution hashes must not be exposed
through it. Private binding changes are independently checked on the server.
Choose metadata before evaluation consistently; a stale view or evidence is not
silently reinterpreted as the frozen command the student submitted.

Use existing 400 VALIDATION_ERROR, 401 authentication, 403 AUTH_FORBIDDEN,
404 CONCEPT_NOT_FOUND/ROUTE_NOT_FOUND, 413 PAYLOAD_TOO_LARGE,
415 UNSUPPORTED_MEDIA_TYPE, 429 RATE_LIMIT_EXCEEDED, and sanitized
503 DEPENDENCY_UNAVAILABLE. Preserve C2/C3b command errors. Add only:
409 COMPLETION_INELIGIBLE, COMPLETION_VIEW_CHANGED, COMPLETION_IDEMPOTENCY_CONFLICT,
COMPLETION_RECEIPT_UNAVAILABLE; 503 COMPLETION_COMMIT_UNCONFIRMED. Error messages
are fixed, no answers/bodies/keys/documents/driver details. Complete-ineligible
errors contain no new blocker/details structure: the existing shared error details
shape is field/message validation entries, not completion codes. Fetch safe
blockers through GET; do not change shared types or global error middleware.
GET without configured valid policy returns the
nine-field INELIGIBLE view with unsupported/missing blockers, not successful
completion. Corrupt/unverifiable stored policy or indexes returns 503.

Keep Stage A codes intact. The adapter may additionally report only
POLICY_UNAVAILABLE, REQUIRED_CONTENT_UNSUPPORTED, RECEIPT_UNAVAILABLE,
PRE_DISCLOSURE_NOT_PROVEN, ASSESSMENT_UNAVAILABLE and COMPLETION_STALE, with an
optional canonical section. Stable precedence is structural/authority unavailable,
scope/revision mismatch, evidence unavailable, missing/unsupported, unqualified/
ungraded, then below threshold; stable canonical section order breaks ties.
No dynamic messages, raw identities or score guesses in blockers.

Strict IDs and bounded bodies: no extra fields, query arrays, coercion, duplicate
key headers, unknown sections or unbounded nested JSON. New commands bounded to
4 KiB raw JSON, existing 256 KiB global parser limit unchanged; enforce the
smaller raw bound before parsing for exact completion paths. Early no-store
middleware must match only these exact GET/POST paths before CORS/JSON, including
malformed/oversized/auth/parser/CORS errors; unrelated routes unchanged.
Keep current F037 300/IP and 120/subject GET per 15 minutes; new completion GET
shares those limits, new completion POSTs share a dedicated 30/current-subject
per 15 minutes with the existing IP guard. Replays also count. Existing F036
limits stay unchanged. Preserve ProgressLimits' existing required fields/call
sites; any completion-specific test override is optional with an internal default,
not a new required setting or environment variable. No sensitive request/response body logging, private URL
query logging or new permissive CORS/security middleware.

### 30.7 Minimal Student workflow and compatibility

Reuse ConceptBrowser, its Read/Example/Revise content, ConceptMarkdown, independent
ConceptProgress panel and existing visualization renderer/player. Add a Concept
completion panel with required section statuses, a clear policy-bound first-answer
warning, qualifying Practice status/score/threshold, safe blockers and a Practice
link to the required question. Server-issued acknowledgement/checkpoint actions
live in this panel; show the actual bounded graph and meaningful text alternative.
Do not mistake F029's test lesson selector for published data.

Initial sequence: load current scoped view; explicitly acknowledge Read and all
Example content; complete the server checkpoint without playback/timing demands;
submit the required first OUTPUT answer through existing Practice; return/refresh
completion; explicitly mark complete when eligible. Optional required Revise uses
its own acknowledgement. Pure page views never satisfy a requirement.
Show "Acknowledgement recorded; this is not proof of understanding" and label
checkpoint success as verified interaction. Explain before Practice that an
answer is revealed after saving, and later reveal-assisted retries cannot qualify.

Required compatibility correction: PracticeBrowser currently promises "does not
grade it" and "has not been graded" universally. These would become false for
enrolled first submissions. Proposed neutral wording: "Submit Answer saves your
answer before revealing the solution. Completion qualification is shown on the
Concept page." Saved feedback: "Answer revealed. This attempt has been saved."
No claim of grading, completion or score merely from a normal unlock receipt.
Preserve every other security/submission assertion in both existing browser files
and rendering tests; no retries/timeouts/infrastructure changes.

Completion controller is scoped to account, Concept and public viewRevision.
Abort superseded reads/commands on identity/revision changes; check generation and
exact request identity before accepting any response. Pending POST cancellation
does not imply rollback. Freeze key/body for explicit same-request Retry after
network uncertainty; new view/action requires a new key. Never automatically
resubmit, cross accounts, retain commands after logout or save keys/evidence to
browser storage. Persistent server outcomes survive navigation; GET rediscovers
them. Preserve all four-type drafts/capacity/length/clear-confirmation behavior.

Use native labelled buttons/radios, fieldset/legend for checkpoint choices,
live status and alert feedback, visible focus and deterministic focus restoration.
No mouse-only, animation/timing or precise playback requirement. Support keyboard,
screen reader, reduced motion and responsive reflow without horizontal overflow.
Explicit idle/loading/error/empty/unsupported/pending/completed/stale/retry states.
No XP, mastery, scores for other question types, completion percentage or automatic
Topic completion. Concept header/layout follows the existing design direction;
this is not a redesign or authorization to add new UI dependencies.

### 30.8 Expanded literal inventory and dependency reconciliation

Filesystem inspection found all original twenty creation paths absent and all
twenty-eight modification paths present. No duplicate literal paths. The proposed
48 paths remain required for the described bounded integration; no credible
reduction was found. Optional future Admin/editor UI, blind-retry/exposure-ledger
architecture and Topic aggregation are excluded, not silently included.

Six dependencies were missing from the 48-path proposal:
one new request-receipt model, the F036 transaction repository, Practice copy,
its rendering assertion and TWO existing browser files asserting the old copy.
The additional browser match was found by source search; changing just one would
leave an incompatible contract. These are scope proposals, NOT approved writes.

**Revised proposed inventory: 54 unique paths, 21 CREATE / 33 MODIFY.**
Original IDs 1-48 below are the fully expanded prior proposal; 49-54 require NEW
scope approval. "Slice" lists exact path membership; repeated documentation
participation does not count as extra unique files.

| ID | Operation | Literal path | Slice | Need / approval boundary |
| --- | --- | --- | --- | --- |
| 1 | CREATE | apps/api/src/modules/progress/completion.service.ts | 2 | Required baseline path |
| 2 | CREATE | apps/api/src/modules/progress/completion.repository.ts | 2 | Required baseline path |
| 3 | CREATE | apps/api/src/modules/progress/completion.controller.ts | 2 | Required baseline path |
| 4 | CREATE | apps/api/src/modules/progress/completion.schema.ts | 2 | Required baseline path |
| 5 | CREATE | apps/api/src/modules/progress/completion-evidence.service.ts | 1 | Required baseline path |
| 6 | CREATE | apps/api/src/modules/practice/completion-grading.service.ts | 1 | Required baseline path |
| 7 | CREATE | apps/api/tests/completion.test.ts | 2 | Required baseline path |
| 8 | CREATE | apps/api/tests/completion-routes.test.ts | 2 | Required baseline path |
| 9 | CREATE | apps/api/tests/completion-grading.test.ts | 1 | Required baseline path |
| 10 | CREATE | apps/api/tests/completion-evidence.test.ts | 1 | Required baseline path |
| 11 | CREATE | apps/api/tests/completion.integration.ts | 2 | Required baseline path |
| 12 | CREATE | apps/web/src/lib/api/completion-client.ts | 3 | Required baseline path |
| 13 | CREATE | apps/web/src/lib/progress/completion-controller.ts | 3 | Required baseline path |
| 14 | CREATE | apps/web/src/lib/progress/completion-contracts.ts | 3 | Required baseline path |
| 15 | CREATE | apps/web/src/components/concepts/concept-completion.tsx | 3 | Required baseline path |
| 16 | CREATE | apps/web/src/components/concepts/concept-completion.module.css | 3 | Required baseline path |
| 17 | CREATE | apps/web/tests/completion-client.test.ts | 3 | Required baseline path |
| 18 | CREATE | apps/web/tests/completion-controller.test.ts | 3 | Required baseline path |
| 19 | CREATE | apps/web/tests/completion-rendering.test.ts | 3 | Required baseline path |
| 20 | CREATE | tests/browser/concept-completion.spec.ts | 3 | Required baseline path |
| 21 | MODIFY | docs/API_DESIGN.md | 1, 2, 3 | Required baseline path |
| 22 | MODIFY | docs/DATABASE_DESIGN.md | 1, 2, 3 | Required baseline path |
| 23 | MODIFY | docs/DEVELOPMENT_ROADMAP.md | 1, 2, 3 | Required baseline path |
| 24 | MODIFY | docs/features/F038-completion-rules.md | 1, 2, 3 | Required baseline path |
| 25 | MODIFY | apps/api/src/app.ts | 2 | Required baseline path |
| 26 | MODIFY | apps/api/src/modules/concepts/concept.model.ts | 1 | Required baseline path |
| 27 | MODIFY | apps/api/src/modules/topics/topic.model.ts | 1 | Required baseline path |
| 28 | MODIFY | apps/api/src/modules/progress/progress.model.ts | 1, 2 | Required baseline path |
| 29 | MODIFY | apps/api/src/modules/progress/progress.repository.ts | 1, 2 | Required baseline path |
| 30 | MODIFY | apps/api/src/modules/progress/progress.routes.ts | 2 | Required baseline path |
| 31 | MODIFY | apps/api/src/modules/progress/progress-rate-limit.ts | 2 | Required baseline path |
| 32 | MODIFY | apps/api/src/modules/progress/section-evidence.repository.ts | 1 | Required baseline path |
| 33 | MODIFY | apps/api/src/modules/progress/section-evidence.service.ts | 1 | Required baseline path |
| 34 | MODIFY | apps/api/src/modules/progress/section-evidence-revision.ts | 1 | Required baseline path |
| 35 | MODIFY | apps/api/src/modules/progress/section-evidence-challenge.model.ts | 1 | Required baseline path |
| 36 | MODIFY | apps/api/src/modules/progress/section-evidence-receipt.model.ts | 1 | Required baseline path |
| 37 | MODIFY | apps/api/src/modules/practice/practice-assessment.model.ts | 1 | Required baseline path |
| 38 | MODIFY | apps/api/src/modules/practice/practice-assessment.repository.ts | 1 | Required baseline path |
| 39 | MODIFY | apps/api/tests/concept-model.test.ts | 1 | Required baseline path |
| 40 | MODIFY | apps/api/tests/topic-model.test.ts | 1 | Required baseline path |
| 41 | MODIFY | apps/api/tests/progress-model.test.ts | 1, 2 | Required baseline path |
| 42 | MODIFY | apps/api/tests/progress.test.ts | 1, 2 | Required baseline path |
| 43 | MODIFY | apps/api/tests/progress-routes.test.ts | 2 | Required baseline path |
| 44 | MODIFY | apps/api/tests/practice-attempt-repository.test.ts | 1 | Required baseline path |
| 45 | MODIFY | apps/api/tests/practice-grading.test.ts | 1 | Required baseline path |
| 46 | MODIFY | apps/api/tests/section-evidence.test.ts | 1 | Required baseline path |
| 47 | MODIFY | apps/web/src/components/concepts/concept-browser.tsx | 3 | Required baseline path |
| 48 | MODIFY | playwright.f024.config.ts | 3 | Required baseline path |
| 49 | CREATE | apps/api/src/modules/progress/completion-request.model.ts | 2 | new dependency: durable request identity; NEW approval required |
| 50 | MODIFY | apps/api/src/modules/practice/practice-attempt.repository.ts | 1 | new dependency: pre-disclosure transaction hook; NEW approval required |
| 51 | MODIFY | apps/web/src/components/practice/practice-browser.tsx | 1 | new dependency: truthful qualification copy; NEW approval required |
| 52 | MODIFY | apps/web/tests/practice-rendering.test.ts | 1 | new dependency: copy regression; NEW approval required |
| 53 | MODIFY | tests/browser/practice-attempts.spec.ts | 1 | new dependency: retained copy assertion; NEW approval required |
| 54 | MODIFY | tests/browser/practice-answer-unlock.spec.ts | 1 | new dependency: retained copy assertion; NEW approval required |

At this planning gate ONLY path 24 changes, by append. No other path is authorized
now. Standard internal packages suffice; no new npm dependencies, infrastructure,
environment variables or alternate canonical summary collection.

Missing runtime dependencies are explicit: trusted fresh-scope construction,
current independently reviewed completion policy/rubric/checkpoint enrollment,
approved first-attempt-only product behavior and later server startup/data
provisioning authorization. No existing production Admin publishing UI or immutable
publication-history writer can be assumed. If implementation discovers another
file, schema, middleware behavior or global writer change, STOP before editing it.

### 30.9 Exact proposed canonical amendments - not applied

The following additive wording/schemas need separate explicit owner approval.
Do not replace existing historical sections or modify PRD under this inventory.

| Document / existing section | Proposed additive amendment | Effect / reason |
| --- | --- | --- |
| API_DESIGN: after C3b refinement | "F038 consolidated completion is an additive LOCAL, verified-disposable-scope Student workflow. Only the four routes, strict inputs and nine-field completion view in F038 30.6 are introduced. GET /progress and Practice GET/unlock DTOs remain unchanged. Qualification requires current server-proven section actions and a new first-pre-disclosure qualifying assessment; neither activity nor DIAGNOSTIC results qualify implicitly." Append 30.6's exact DTO/error/no-store/rate-limit tables. | New HTTP contract requiring approval; not implemented by listing the file. |
| API_DESIGN: F036 refinement | "For an enrolled fresh first submission only, unchanged immutable attempt, activity update and distinct completion-input assessment commit atomically. Both owned proofs precede answers. Ordinary retries remain unlimited and nonqualifying; same-key replay never generates a missing grade. Current body/response/secrecy and LOCAL restrictions remain." | Explicit additive behavior change to submission internals; original persistence-before-disclosure cannot be weakened. |
| DATABASE_DESIGN: concepts / F021 completionRules deferral | "Add only the bounded reviewed completionRules envelope in F038 30.4. It identifies one required OUTPUT question/rubric and one checkpoint, stronger initial section requirements, explicit Concept threshold override and current source/policy bindings. No arbitrary evaluation JSON or public authoring endpoint." | Resolves an explicit deferral; active policy/version/fence and approval lifecycle are new architecture. |
| DATABASE_DESIGN: topics / completion thresholds | "Optional validated Topic completionScore participates in Concept > Topic > Learning Path > 70 precedence. Invalid explicit configuration fails closed." | New Concept override priority, preserves PRD Topic/path override intent; separate approval needed. |
| DATABASE_DESIGN: practiceAssessments / B2 | "Keep DIAGNOSTIC v1 unchanged. A strict COMPLETION_INPUT v2/OUTPUT_EXACT_TEXT_COMPLETION branch is created only by the enrolled F036 first-submission transaction, with policy/source epoch/provenance and existing owned rubric/audit bindings. Existing six-key unique index unchanged; no historical attempt or diagnostic mutation." | New qualifying provenance/schema/consumer, not a relabel of diagnostic scores. |
| DATABASE_DESIGN: studentProgress / F037 / section 12 | "Versioned v2 stores the latest bound completion claim and qualifying-score/section summary, while v1 and the activity-only GET/count/time contract remain valid. Effective completion is freshly validated, never inferred from a stale root status. F036 activity updates preserve completion fields. Topic aggregation/mastery remain unimplemented." | New summary lifecycle and writer compatibility; canonical target remains studentProgress. |
| DATABASE_DESIGN: private request history / indexes | "Add append-only completionRequests exactly as F038 30.4 for durable account-key idempotency, not a second completion-state source. Declare only uq_completion_request_owner_key unique {userId:1,requestKeyHash:1}. No provisioning at runtime or on persistent data." | One genuinely necessary auxiliary collection/index, new 49th path requiring explicit scope/architecture approval. |
| DATABASE_DESIGN: C2/C3b | "Preserve READ v1 and VISUALIZE v2 activity contracts. Add explicit EXAMPLE/REVISE acknowledgement variants. Only an approved completion adapter may count current owned actions; this does not assert comprehension, change producer NOT_ESTABLISHED outputs or turn hashes into publication history." | New qualification consumer plus section variants, not a silent promotion of receipts. |
| Roadmap / F038 only | Record approved bounded subset, slice evidence and unresolved general/Topic/release requirements; retain IN_PROGRESS until actual full acceptance decision. | No historical status/evidence rewrite or automatic F039 start. |

PRD 14's Topic wording is NOT reconciled merely by implementing Concepts. The owner
must explicitly accept the Concept-only local delivery as a bounded refinement
with Topic aggregation outstanding, or approve a further Topic design/scope before
calling full F038 complete. Likewise a one-OUTPUT-question policy does not satisfy
a requirement for all four practice types. Unsupported required content stays
ineligible. Do not edit PRD or claim general PRD compliance under this proposal.

### 30.10 Three deliverable slices, exact scope and stop conditions

Effective owner-approved Slice 1 inventory is 32 paths (five creations/up to 27 modifications), including apps/api/tests/completion-qualification.integration.ts. See Section 31 for the complete literal allowlist and Option B replacement; the original 31-path listing is retained below as history.

The numeric scope lists below refer one-to-one to the literal paths in 30.8.
No path can be inferred from a folder wildcard. All three need implementation
approval; their completion is not a separate automatic release.

**Slice 1 - Qualification and grading integration (31 paths).**
IDs 5,6,9,10,21,22,23,24,26,27,28,29,32,33,34,35,36,37,38,39,40,41,42,44,45,46,50,51,52,53,54.

Deliver reviewed bounded enrollment/threshold policy and EXAMPLE/required-REVISE
actions, a trusted adapter for current READ/correct VISUALIZE receipts, explicit
qualifying assessment branch and F036 first-submission atomic hook, plus truthful
Practice compatibility wording and v1/v2 genuine-score summary compatibility.
Depends on D1-D6/D10, canonical amendments and
verified fresh-scope construction; A/B1/B2/C2/C3b implementations remain reusable.
Do not enable general/persistent completion callers yet.

Acceptance: first attempt/assessment/activity commit together; 0 and 100 genuine
grades only; all later attempts nonqualifying and unlimited; no historical grade,
no answer before both required durable proofs, exact same-key replay; current
authority/binding checks and unchanged ordinary Practice GET/receipt semantics.
Acknowledgements/checkpoints mean the explicitly approved actions only.
Focused offline verification: completion-grading/evidence, attempt-repository,
Concept/Topic models, diagnostic grading, READ/VISUALIZE compatibility and copy
assertions; relevant existing four-type secrecy/authorization regressions.
STOP on unproven fresh scope, first-submission provenance, unexpected schema/file,
missing approved rubric authority or any unresolved formal review finding.

**Slice 2 - Atomic completion persistence and API (20 paths).**
IDs 1,2,3,4,7,8,11,21,22,23,24,25,28,29,30,31,41,42,43,49.

Deliver v2 canonical summary, durable request receipt, exact index readiness,
fresh effective read/explicit completion transaction, constrained producer HTTP
wrappers and exact early-error no-store/limits. Depends on Slice 1, D7-D9 and
canonical schema/endpoint/index approval. It does not enable indexes or databases.

Acceptance: eligible current complete coverage plus passing genuine score can
commit one owned completion; stale/invalid/unproven evidence cannot. Same-key
replay/conflict across revisions, concurrent requests, rollback, revocation fences,
postcommit proof/cleanup uncertainty and v1/v2 count reconciliation fail safely.
F037 read-only five-field GET remains byte-contract compatible.
Focused offline tests: completion service/routes, progress model/repository/routes,
early parser/CORS/no-store, key reuse, mixed-version and authority fault controls.
Prepare the single completion integration suite; no MongoDB execution follows
without separate ownership-safe disposable/index approval.
STOP on unbounded transaction, missing index verification, partial commits,
read mutation, branch confusion or additional middleware/global error changes.

**Slice 3 - Accessible Student UI and end-to-end integration (15 paths).**
IDs 12,13,14,15,16,17,18,19,20,21,22,23,24,47,48.

Deliver scoped completion client/controller/contracts/panel and published graph
projection integration with the existing Concept screen and Practice link.
Depends on working approved Slice 1/2 contracts and reviewed source data, not
fixture playback events or invented client evidence.

Acceptance: the valid synthetic enrolled Student path records all required
actions, qualifies the genuine first answer, explicitly saves completion and
recovers the durable state after navigation/reload. Missing/incorrect/unqualified/
stale cases never show current COMPLETED. Keyboard, screen-reader, reduced-motion,
responsive layouts, account/Concept cancellation and explicit same-key Retry are
covered. Preserve existing drafts and the independent F037 activity panel.
Focused frontend client/controller/rendering regressions and browser-spec static
compilation; prepare exactly the twelve cases below. Add only the spec match in
playwright.f024.config.ts; do not change execution policy, retries or timeouts.
STOP on unsupported accessibility path, leaked private fields, race/state
isolation defect, surprise product scope or an assumption that browser tests ran.

These three slices are the complete proposed implementation sequence; there is
no automatic C4/D1/etc. Partial slice PASS cannot mark F038 READY_FOR_REVIEW or
APPROVED_COMPLETE. If full general completion is required now, the disclosed
coverage/Topic/history prerequisites exceed this bounded scope; request an
explicit revised product/architecture decision instead of a weaker completion rule.

### 30.11 Verification gates and browser inventory - planned, NOT_RUN

No tests, builds, services, MongoDB or browser execution occurred in this planning
gate. All verification below awaits separately approved implementation/offline
work. No previous passing counts are repeated or reclassified.

Run focused tests for strict policy/threshold shapes and override precedence,
first-ever versus replay/retry pre-disclosure provenance, no grade for historical
or unsupported inputs, independent current reviewers, section qualification versus
comprehension, branch-specific mixed-record parsing, expiry versus receipt validity,
withdraw/revoke races, rollback, key history and v1/v2 activity reconciliation.
Include fault controls for missing/nonunique/wrong-option indexes, absent proof,
UnknownTransactionCommitResult, session cleanup failure and bounded retries.
Prove unchanged GET seven-field secrecy, unlock five-field data/receipt, F036
first durability and exact F037 five-field read-only contract across all four types.

Run relevant API/frontend regressions, API/web build and TypeScript, lint,
formatting, UTF-8/LF, exact authorized scope and diff checks. Perform a separate
CRITICAL/HIGH/MEDIUM/LOW implementation-diff review with real file/line findings;
unresolved findings stop for owner disposition. Do not change assertions to obtain
PASS, count repeated subsets as distinct coverage or broaden file scope.

Separately approved disposable integration must use fresh owned Job/native process
handles, raw/native exact identity plus UTC common-microsecond CIM comparison,
unelevated execution, exact owned 127.0.0.1:27018/f021-test/deeplearner-f021-test,
PRIMARY/empty target, protected baselines and the complete thirteen-index allowlist.
Fixture setup establishes fresh scope and reviewed policy before any answers.
Test actual atomic attempt/assessment/activity and completion/request transactions,
replay/races/revocation, majority proofs, index refusal, GET nonmutation and all
old/new branch compatibility once under approved limits. Graceful owned cleanup,
observable exit codes, Job/port/handles/storage/baseline evidence are mandatory.
Controlled proof-loss injections remain distinct from real failover; do not
silently authorize failover, persistent provisioning or application/browser startup.

Proposed new spec contains exactly twelve separately named mounted scenarios,
without parameter expansion counted as additional cases:

| # | Proposed new browser scenario |
| --- | --- |
| 1 | Default Read/Example/Visualize/first OUTPUT path, explicit completion, durable reload and unchanged activity panel. |
| 2 | Page views/local playback/unchecked acknowledgement never qualify; missing required Visualize/Practice remains blocked. |
| 3 | First incorrect grade below default threshold; copied answer retry cannot change qualification; valid configured threshold behavior. |
| 4 | Required Example coverage and policy-required Revise versus optional Revise; missing content blocks. |
| 5 | STUDENT-only access, account switch/logout isolation and hidden/unpublished ancestry. |
| 6 | Concept/view revision navigation cancels obsolete reads and suppresses stale command responses. |
| 7 | Network interruption after commit, explicit frozen-key Retry, same completion receipt and no duplicate mutation. |
| 8 | Valid incorrect versus invalid checkpoint consumption, quota/revocation/withdrawal and no expected-answer exposure. |
| 9 | Content/rubric/policy changes make old completion stale/revoked without GET repair or silent restoration. |
| 10 | Keyboard/screen-reader-equivalent choices, announcements and focus with reduced motion/no required playback. |
| 11 | Desktop/tablet/mobile reflow, long text, loading/empty/error/unsupported/Retry states. |
| 12 | All four ordinary Practice types, draft retention/Clear all and activity/answer secrecy remain compatible; unsupported required types cannot complete. |

Existing **141 browser scenarios remain NOT_RUN**. Planned additions **12**;
expected prepared total **153 NOT_RUN**, subject to static reconciliation after
implementation. The two existing copy-only spec changes add zero cases and
preserve all other security assertions. Do not count these planned cases as
implemented. Primary-host Playwright remains prohibited; ownership-safe execution
or an explicit named-feature exception requires a separate owner gate. No earlier
exception transfers. Manual inspection is supplemental only.

### 30.12 Planning result and next approval gate

**CONSOLIDATED PLAN READY FOR OWNER DECISION; IMPLEMENTATION BLOCKED pending
D1-D10, the revised 54-path inventory and exact canonical amendments.**

The prior 48-file list is not a sufficient implementation authorization for the
anti-reveal and durable key-history requirements. No reduction is recommended;
six additional paths are justified in 30.8. Listing an API/database/model path does
not authorize its proposed contract changes. All fifty-four paths were statically
checked: twenty-one absent creations, thirty-three existing modifications, no
duplicates. Scope approval must explicitly include the six additions before edits.

Next owner gate: approve/revise the first-attempt-only experience, fresh synthetic
scope, acknowledgement/checkpoint qualification, one-question coverage, threshold
precedence, long-lived receipt qualification, manual completion, v2/idempotency
storage and Concept-only acceptance boundary; approve exact 54 paths/canonical
wording, then authorize the three bounded implementation/offline slices. Any
alternative blind-retry or broader Topic/multitype completion contract needs a
revised exact scope first. Integration, browser exception, final full-feature
review, completion and Git delivery remain separate owner approvals.

Privacy/release prerequisites are not completion evidence. Before real-person or
persistent use, resolve enrollment/disclosure history, privacy lawful handling,
finite retention, erasure of linked attempts/assessments/receipts/key history,
backups, access/audit obligations, quota behavior after erasure, editorial and role
revocation/ABA guarantees and authorized index provisioning. Before deployment,
require independent browser-regression/release readiness; no production claim,
mastery, XP or F039 work follows from this plan.

Only this feature document is appended; roadmap/canonical/source/test files and
all feature statuses are unchanged. No implementation, test/runtime, database,
browser, Git write, dependency or infrastructure change is performed. STOP for
owner review.

Planning-only static document verification: all 54 literal paths reconciled,
21 creation paths absent / 33 modification paths present, no duplicates; slice
membership 31 / 20 / 15 with shared documentation/summary paths counted once in
the unique total. Twelve proposed new browser records reconcile to 153 planned
NOT_RUN, not runtime evidence. UTF-8/LF, new whitespace and git diff --check PASS.
The pre-planning document bytes and all other nonignored source hashes are
preserved. No planned API, grading, evidence or completion behavior was executed
or verified at runtime in this gate.


## 31. Owner-approved Slice 1 Option B implementation and offline verification

### 31.1 Effective authorization and reconciliation

The owner selected Server-Established Synthetic Identity Provenance and explicitly
authorized Slice 1 implementation/offline verification within 32 literal paths.
This supersedes only the runtime supervisor-attestation prerequisite in the
historical Section 30 proposal. Native process/storage ownership is NOT an
application qualification credential. External disposable integration safety,
ordinary-user Job/native-handle identity and cleanup requirements are unchanged.

D1/D3-D6/D10 are reconciled for the bounded LOCAL subset. D2's canonical order
remains Concept > Topic > Learning Path > default 70, but only an independently
reviewed explicit 70% Concept policy is implemented. Missing, invalid, revoked or
unverifiable Concept authority fails closed; Topic/Path inheritance remains
inactive. D7-D9 completion persistence/API/UI remain Slice 2/3 work. No score
summary or completion field is added to F037.

### 31.2 Exact authorized inventory

Five creations and up to twenty-seven existing-file modifications. Files are
not changed merely to fill the allowlist. The new qualification integration file
is the separately authorized addition to the earlier 31-path Slice 1 boundary;
the full 54-path proposal remains a planning baseline for the other slices.

| # | Operation | Literal path |
| --- | --- | --- |
| 1 | CREATE | apps/api/src/modules/progress/completion-evidence.service.ts |
| 2 | CREATE | apps/api/src/modules/practice/completion-grading.service.ts |
| 3 | CREATE | apps/api/tests/completion-grading.test.ts |
| 4 | CREATE | apps/api/tests/completion-evidence.test.ts |
| 5 | MODIFY | docs/API_DESIGN.md |
| 6 | MODIFY | docs/DATABASE_DESIGN.md |
| 7 | MODIFY | docs/DEVELOPMENT_ROADMAP.md |
| 8 | MODIFY | docs/features/F038-completion-rules.md |
| 9 | MODIFY | apps/api/src/modules/concepts/concept.model.ts |
| 10 | MODIFY | apps/api/src/modules/topics/topic.model.ts |
| 11 | MODIFY | apps/api/src/modules/progress/progress.model.ts |
| 12 | MODIFY | apps/api/src/modules/progress/progress.repository.ts |
| 13 | MODIFY | apps/api/src/modules/progress/section-evidence.repository.ts |
| 14 | MODIFY | apps/api/src/modules/progress/section-evidence.service.ts |
| 15 | MODIFY | apps/api/src/modules/progress/section-evidence-revision.ts |
| 16 | MODIFY | apps/api/src/modules/progress/section-evidence-challenge.model.ts |
| 17 | MODIFY | apps/api/src/modules/progress/section-evidence-receipt.model.ts |
| 18 | MODIFY | apps/api/src/modules/practice/practice-assessment.model.ts |
| 19 | MODIFY | apps/api/src/modules/practice/practice-assessment.repository.ts |
| 20 | MODIFY | apps/api/tests/concept-model.test.ts |
| 21 | MODIFY | apps/api/tests/topic-model.test.ts |
| 22 | MODIFY | apps/api/tests/progress-model.test.ts |
| 23 | MODIFY | apps/api/tests/progress.test.ts |
| 24 | MODIFY | apps/api/tests/practice-attempt-repository.test.ts |
| 25 | MODIFY | apps/api/tests/practice-grading.test.ts |
| 26 | MODIFY | apps/api/tests/section-evidence.test.ts |
| 27 | MODIFY | apps/api/src/modules/practice/practice-attempt.repository.ts |
| 28 | MODIFY | apps/web/src/components/practice/practice-browser.tsx |
| 29 | MODIFY | apps/web/tests/practice-rendering.test.ts |
| 30 | MODIFY | tests/browser/practice-attempts.spec.ts |
| 31 | MODIFY | tests/browser/practice-answer-unlock.spec.ts |
| 32 | CREATE | apps/api/tests/completion-qualification.integration.ts |

### 31.3 Implementation and trust boundary

completion-evidence.service.ts provides internal LOCAL-only synthetic creation,
Concept-policy author/independent approval/terminal revocation, sealed origin
authority and a bounded read-only section-action reader. It is not automatically
instantiated by ordinary startup and has no public registration/authoring route.

The creator generates fresh account/Concept/question identities and sourceEpoch;
validates/saves insert-only synthetic records; and proves majority-confirmed owned
creation before returning resource locators. Duplicate IDs conflict rather than
adopting records. There is no import/restore/register-origin command. Credentials
are server-generated, hashed through existing Auth code and never returned/logged.
Interactive synthetic login provisioning remains a later student-workflow concern.

Origin authority is private, nonserializable behavior, bound to the exact actual
database/client generation, owner/question/Concept and sealed approved policy
fingerprint (which pins rubric, revisions and checkpoint). Returned IDs/epochs
are not credentials. Connection replacement, reconnect, error/pool uncertainty or
disposal permanently invalidates the old authority; stored metadata cannot
reconstruct it. New identity creation is not historical enrolment.

The creator verifies LOCAL and the exact 127.0.0.1:27018 / f021-test /
deeplearner-f021-test target and writable PRIMARY before any synthetic write.
The source-generation check is repeated across creation/commit proof. This is
application target enforcement, not proof of native ownership or fresh disk.
MongoDB integration continues to require external ownership, PRIMARY/empty-target
preflight and protected-baseline safeguards before fixtures/index provisioning.

Concept policies use bounded immutable reviewed versions, BSON reference storage,
server approval provenance and compare-and-write authorization fences. Current
Admin eligibility, independent reviewer, published ancestry, private/public
bindings and reviewed rubric audit provenance are revalidated. Revocation is
terminal; no approval flag, numeric threshold or author ID supplies authority.

completion-grading.service.ts runs inside the existing F036 transaction. The first
eligible OUTPUT answer receives genuine B1 exact-text 100/0 grading, and a distinct
append-only COMPLETION_INPUT v2 record commits with the unchanged immutable
SUBMITTED/null-score attempt and existing F037 activity update. Existing B2
DIAGNOSTIC records, unique identity and callers remain separate.

Exact request replay recovers only the original records; changed bodies conflict.
No prior committed attempt may become a new qualifying first attempt. Lost
responses conservatively count as possible exposure; later normal Practice is
unlimited but cannot replace the original grade. Lost registry authority cannot
recover the first qualifying unlock from persisted metadata alone. Both exact
owned committed records and fresh authority/source checks precede disclosure.
No historical grade, client freshness assertion, transient fallback or external
copy-detection claim is introduced.

The Section 30.3/30.10 EXAMPLE/conditional-REVISE acknowledgement branches use
schemaVersion=3, separate policy namespaces and current section digests. READ v1
and VISUALIZE v2 parsers remain separate. Issue/consume/replay/withdrawal, unique
readiness, five-minute expiry and majority proof reuse C2's bounded contract.
Producer receipts remain ACTIVITY_ONLY/NOT_ESTABLISHED. The internal reader
checks all bounded candidates, ownership, cross-links, policy activation,
current revisions and correct authorized Visualize response provenance; its
output is only section/receiptId/actionAt, not Stage A VERIFIED evidence or a
completion certificate. Slice 2 must atomically revalidate/fence evidence when
writing canonical completion.

Only Practice compatibility wording changes on the frontend: saving precedes
revelation; the receipt does not assert that every saved attempt is ungraded.
The two existing browser specifications receive copy-only assertion changes.
No new browser scenario or student completion UI is implemented.

### 31.4 Verification record and review gates

Implementation/offline verification is complete in this gate. Actual counts and
the separate source-review outcome are recorded below. Passing subsets/repeated
runs must not inflate distinct counts.

Preserve diagnostic history: restricted-account tsx startup failed in
uv_os_get_passwd before test bodies; the existing supported ordinary-user method
ran the offline checks. Early focused corrections addressed duplicate-creation
conflict handling and a mock authority-fence proof. Two additional section tests
initially selected READ because their fixture argument was misplaced; corrected
without weakening the intended assertions. Initial lint reported two unused
imports, removed within scope. These are not live MongoDB results.

Automatic approval review initially rejected the section branch extension.
Reconciliation showed explicit Section 30.3/30.10 authorization, after which the
same scoped extension was accepted. A proposed target-check relocation was
rejected as post-write verification; the implemented safe alternative explicitly
checks the target/PRIMARY BEFORE transact and fixture creation. No rejection was
bypassed and no safety prerequisite was removed.

The prepared completion-qualification.integration.ts is excluded from *.test.ts.
Its explicit index inventory reuses only existing approved attempt/progress,
rubric/assessment and section/checkpoint definitions. It includes concurrency,
rollback, exact replay, wrong-first-answer retention, index refusal and controlled
proof-loss coverage. Proof loss is not real MongoDB failover testing. Integration
has NOT_RUN; index provisioning, all process safety checks and one execution need
separate owner approval. No live durability/concurrency result is claimed.

Existing 141 browser scenarios remain NOT_RUN. Twelve proposed Slice 3 cases are
unimplemented, not mounted or executed. No browser exception transfers. There
is no production readiness, persistent provisioning, migration or F039 work.

F038 remains IN_PROGRESS. Slice 2 must deliver completion persistence/API and
fresh transactional evidence fencing; Slice 3 must deliver accessible student
workflow, credential/test setup and its browser cases. Privacy/retention/erasure,
release prerequisites and full F038 acceptance remain outstanding.

### 31.5 Final offline results and separate source review

**SLICE 1 IMPLEMENTATION AND OFFLINE VERIFICATION PASS - PARTIAL F038.**
This is not full F038 acceptance, live database verification or production approval.

| Check | Actual result |
| --- | --- |
| New focused completion-evidence and completion-grading suites | 39 PASS / 0 FAIL. |
| Relevant API regression run | 366 PASS / 0 FAIL across 24 files; includes four new EXAMPLE/REVISE compatibility cases. |
| Distinct API tests obtained | 405 PASS / 0 FAIL (39 + 366); repeated correction runs and internal assertions are not additional tests. |
| Frontend regression run | 229 PASS / 0 FAIL, including existing Practice and activity/auth/content compatibility. |
| Build | Workspace build PASS; current API rebuilt after API-only review fixes, PASS. No deployment. |
| TypeScript | Workspace checks PASS; current API source/tests, including prepared integration, rechecked PASS. |
| Lint and formatting | PASS; docs excluded by existing Prettier policy and checked separately for UTF-8/LF, history and whitespace. |
| Browser specification compilation | PASS, TypeScript only; no Playwright import execution, browser or server launch. |
| Scope | 24 files changed in this gate: five creations, nineteen modifications; all inside the 32-path allowlist. Eight reserved paths unchanged. |
| Documentation preservation | Original API/Database bytes preserved as exact prefixes; original roadmap and feature history reconstruct to their pre-gate SHA-256 after removing only authorized new notes. UTF-8/LF PASS. |
| Whitespace/security | git diff --check PASS; source review found no sensitive logging, new secret, automatic provisioning or unapproved path. |
| MongoDB | NOT_RUN. Prepared suite has thirteen child cases plus parent, fourteen records total; twelve existing index definitions (ten unique/two nonunique) require separate provisioning/execution approval. |
| Browser | Existing 141 NOT_RUN; twelve Slice 3 proposals remain unimplemented. No inherited exception. |

The separate source/diff review covered origin creation/sealing, native reference
storage, policy/rubric authority, immutable version transitions, publication and
private fingerprint bindings, transaction/retry/rollback behavior, exact durable
proof before disclosure, read-only action provenance and existing frontend/DTO
compatibility. It also checked the four additive canonical refinements against
PRD 14/F036/F037; no public route, alternate completion schema, activation of
Topic/Path authority, diagnostic promotion or completion mutation was introduced.

Actual review findings:

| Severity / ID | Finding and resolution | Verification |
| --- | --- | --- |
| MEDIUM S1-R1 - RESOLVED | Postcommit assessment proof originally compared bindings but did not compare the complete original transaction result. completion-grading.service.ts:217 now compares the exact record retained by F036's transaction, including outcome/score/identity/time. | Focused postcommit-proof corruption case PASS; no answer returned on mismatched proof. |
| MEDIUM S1-R2 - RESOLVED | Section selection originally stopped after the earliest valid candidate, leaving later malformed bounded candidates unexamined. completion-evidence.service.ts:644 and :688 now scan every bounded candidate while selecting only the earliest valid action per section. | Focused malformed-later-action case PASS. |
| LOW S1-R3 - RESOLVED | Optional Revise creation initially used an object-only command copier, which refused valid key-point arrays. completion-evidence.service.ts:84 now uses the existing bounded evidenceData copier, while strict schemas still reject identity/provenance claims. | Focused bounded Revise creation/refusal case PASS. |
| CRITICAL / HIGH | No Critical or High finding identified. | Separate final source review. |

Final unresolved findings: **CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0**.
Current role/publication checks are bounded current-at-verification checks, not
globally instantaneous revocation or monotonic publication history. Application
guards do not provide database WORM. No external copying detection is claimed.

Integration remains prepared-only. Controlled owned-proof loss is distinguished
from real MongoDB failover; no live atomicity/concurrency/durability result has
been obtained for Slice 1 in this gate. Separate owner approval must confirm the
exact twelve-index allowlist and guarded disposable execution before any database
connection. No passing offline suite should be repeated without a new reason.

F038 stays **IN_PROGRESS**. F001-F037 and F039 status/history are unchanged.
Next owner gate: review this bounded Slice 1 evidence and approve one guarded
disposable MongoDB qualification verification. Slice 2/3 implementation, browser
exception/execution, full F038 review/completion and Git delivery remain separate
approvals. STOP after offline verification.

### 31.6 Owner-authorized guarded MongoDB gate - BLOCKED before integration

On 2026-10-20, the owner authorized one guarded Slice 1 disposable integration
execution. One fresh startup occurred; **zero integration invocations** occurred.
The fourteen prepared records remain **14 NOT_RUN / 0 PASS / 0 FAIL**. No fixtures
or indexes were created. No application, test, configuration or runner correction
was made after the failure, and no automatic rerun occurred.

Ordinary REDGOLDMARK42\Shreeji execution with Administrator membership disabled,
fresh marked disposable storage, initially free port 27018 and an exact private
Job passed. MongoDB and both Node helpers passed retained/independent native
handle identity, executable, parent, owner/SID, exact Job and live-state checks.
MongoDB PID 15220 native creation was 2026-10-20T08:57:59.6266764Z; CIM creation
was 2026-10-20T08:57:59.6266760Z. Both truncate UTC ticks to the common microsecond
value 639280834796266760; original native FILETIME 134369602796266764 and all raw
observations are retained. No PID-only ownership or arbitrary tolerance was used.

The complete static allowlist matched the previously approved F036/F037/B2/C2/C3b
definitions, with ten unique and two nonunique indexes:

| Collection | Exact name | Ordered key | Unique |
| --- | --- | --- | --- |
| practiceAttempts | uq_practice_attempt_sequence | {userId:1,questionId:1,attemptNumber:1} | true |
| practiceAttempts | uq_practice_attempt_idempotency | {userId:1,idempotencyKeyHash:1} | true |
| practiceAttempts | ix_practice_attempt_owner_concept_time | {userId:1,conceptId:1,submittedAt:-1} | false |
| practiceAttempts | ix_practice_attempt_concept_time | {conceptId:1,submittedAt:-1} | false |
| studentProgress | uq_student_progress_owner_concept | {userId:1,conceptId:1} | true |
| practiceRubricVersions | uq_practice_rubric_version | {rubricId:1,version:1} | true |
| practiceRubricAuthorities | uq_practice_rubric_authority | {rubricId:1,version:1} | true |
| practiceAssessments | uq_practice_assessment_identity | {userId:1,attemptId:1,rubricId:1,rubricVersion:1,graderId:1,graderVersion:1} | true |
| visualizationCheckpointDefinitions | uq_visual_checkpoint_version | {visualizationId:1,checkpointId:1,checkpointVersion:1} | true |
| sectionEvidenceChallenges | uq_section_evidence_issue_key | {userId:1,issueKeyHash:1} | true |
| sectionActivityReceipts | uq_section_activity_challenge | {userId:1,challengeId:1} | true |
| sectionActivityReceipts | uq_section_activity_ack_key | {userId:1,ackKeyHash:1} | true |

Expected options remain v2 and simple binary comparison, with no partial filter,
sparse, collation, TTL, hidden or alternate options. Standard _id_ indexes are
separate. **Provisioning and live readiness: NOT_RUN; zero of twelve created.**

The temporary initializer exited 1 with sanitized AssertionError/ERR_ASSERTION
before replSetInitiate. Its target assertion read parsed.replication.replSetName;
the retained MongoDB command-line options instead contain replication.replSet
equal to f021-test. The shutdown helper used the same incorrect property and
refused shutdown with SHUTDOWN_TARGET_UNVERIFIED, exiting 1. Writable PRIMARY and
empty-database verification were therefore NOT_RUN; overall isolation preflight
is BLOCKED. This is a temporary runner target-field defect, not an established
application, transaction or integration-test defect. No Slice 1 live policy,
origin, first-submission, idempotency, durability or secrecy PASS is claimed.

Cleanup required **forced termination through the exact owned Job**, not graceful
shutdown. Initializer PID 1596 and shutdown helper PID 25024 exited 1; MongoDB's
exit code was not observed before handle disposal and remains **UNKNOWN**.
Job emptiness, port 27018 release, retained-handle closure and removal of only the
positively identified marked disposable storage passed. No PID-based termination
was used. Protected MongoDB/development process identities, monitored listeners
and persistent demo-storage filesystem metadata matched their before baselines.
Protected databases were not queried or modified; filesystem metadata comparison
is not a logical database-content audit. All source hashes matched before this
authorized evidence-only append.

Retained ignored evidence: .cache/f038-slice1-integration-2026-10-20-08-57-55-754349,
including sanitized initializer/shutdown output, original identity observations,
the twelve-index definitions, process/storage/source baselines and result.json.

F038 remains **IN_PROGRESS**. Existing offline evidence is unchanged. All 141
browser scenarios remain NOT_RUN; twelve proposed Slice 3 cases remain
unimplemented. Next owner gate: separately approve the minimal temporary
initializer/shutdown target-field correction and any bounded exit-observation
correction, followed by one fresh guarded attempt. No correction, further
execution, Slice 2/3 implementation, Git delivery or production approval is
implied by this blocked gate.

### 31.7 Authorized two-field helper correction and single fresh attempt

On 2026-10-20, the owner approved correcting only the temporary initializer and
shutdown checks from replication.replSetName to replication.replSet, preserving
the expected f021-test value. Retained MongoDB startup options confirm that exact
field. Exactly those two references changed in the in-memory runner; no ownership
check, target boundary, deadline, retry rule, test assertion or repository
implementation changed. Static runner parsing passed.

**Helper correction PASS; isolation preflight PASS; integration BLOCKED at file
loading.** One fresh guarded integration invocation occurred, with zero retries.
The Node runner reported one file-load failure and zero passing records:
ERR_INPUT_TYPE_NOT_ALLOWED while loading tests/completion-qualification.integration.ts.
Its helper starts Node with --input-type=module for an in-memory script, then uses
node:test run() with a file and isolation=none. The module resolver refused that
file-loading context before any prepared suite body or application assertion ran.
The raw wrapper result remains Integration=FAIL / INTEGRATION_EXIT_NONZERO; this
is a runner/loading failure, not a failed product assertion. The fourteen prepared
integration records remain **14 NOT_RUN / 0 PASS / 0 FAIL**. No automatic loader
correction or additional execution was performed.

Ordinary unelevated REDGOLDMARK42\Shreeji execution, no leftover disposable
process/storage, initially free port 27018, fresh marked storage and an exact
private owned Job passed. MongoDB and all three Node helpers passed retained and
independent native-handle identity, exact executable, parent, owner/SID, Job and
live-state checks before their operations. MongoDB PID 18728 native and CIM UTC
creation were both 2026-10-20T09:12:27.7164340Z. Native/independent FILETIME equality
was exact at 134369611477164340; both UTC values truncate to microsecond ticks
639280843477164340. Raw and normalized observations remain retained.

The corrected initializer verified the exact fresh dbPath, 127.0.0.1:27018,
replica f021-test and database deeplearner-f021-test. It initialized the single
replica member, established writable PRIMARY within the unchanged deadline,
then enumerated only allowed system databases and verified the target had no
collections. Its owned client closed and initializer exited 0 before invocation.

All twelve approved index definitions in Section 31.6 were rechecked unchanged
against their canonical source declarations: four F036 attempt, one F037 progress,
three B2 grading and four C2/C3b checkpoint/receipt definitions. Ordered keys,
names, ten unique/two nonunique constraints and required v2/simple/no-alternate
options remain unchanged. **Provisioning: zero of twelve; live readiness NOT_RUN.**
The suite provisions them only after its own empty-target checks, which file
loading never reached. No synthetic fixtures or application collections were
created. No live policy, origin, connection-generation, first-submission,
assessment, atomicity, replay, rollback, uncertainty or answer-secrecy result is
claimed for this attempt. Previously passing offline evidence is unchanged.

Cleanup was **graceful, without forced termination or UNKNOWN exit codes**:
initializer PID 14304 exited 0; integration helper PID 7404 exited 1; shutdown
helper PID 25512 exited 0; MongoDB PID 18728 exited 0. The corrected shutdown
helper revalidated the owned server and closed its client. Job emptiness, port
27018 release, retained-handle closure and removal of only the marked owned
disposable storage passed; cleanup errors were empty. Protected MongoDB PID 5144,
development-process identities, monitored listeners and persistent demo-storage
filesystem metadata were unchanged. Protected databases were not queried or
modified; metadata comparison is not a logical database-content audit. All 480
source hashes matched before this evidence-only append.

Retained ignored evidence: .cache/f038-slice1-integration-2026-10-20-09-12-24-3e72e6,
including sanitized file-load error/summary, initializer/shutdown output,
identities, exit records, index allowlist, source and protected baselines, and
result.json. Section 31.6's blocked startup and forced-cleanup history remain
unchanged.

F038 remains **IN_PROGRESS**, not ready for Slice 1 final acceptance. F001-F037
statuses are unchanged. All **141 existing browser scenarios remain NOT_RUN**;
twelve proposed Slice 3 scenarios remain unimplemented. Next owner gate:
separately authorize the minimal temporary file-loading correction and one fresh
guarded attempt. No further correction, offline rerun, Slice 2/3 work, Git
delivery, persistent provisioning or production readiness is authorized here.

### 31.8 Authorized launcher correction and single executed integration - FAIL

On 2026-10-20, the owner authorized diagnosis of ERR_INPUT_TYPE_NOT_ALLOWED,
the smallest temporary launcher correction and one fresh guarded execution.
Installed Node v24.15.0's resolver source confirms that --input-type is invalid
when resolving a file entry point. The prior launcher combined that option with
node:test run({files:[...],isolation:'none'}), producing the retained refusal.
Only the integration helper's argument construction changed: omit
--input-type=module for that helper while retaining --import tsx, its in-memory
script, the exact test file, isolation=none and existing deadlines. Node's
installed eval implementation supports module syntax detection. Initializer and
shutdown arguments remain unchanged, including their approved replica-field fix.
No application, test, package, module configuration, dependency or assertion was
changed. Static launcher parsing passed; no offline suite was repeated.

Isolation preflight **PASS**: ordinary unelevated REDGOLDMARK42\Shreeji, no leftover
disposable processes/storage, initially free port 27018, fresh marked storage,
private owned Job and retained/independent native-handle identity all passed.
Executable, parent, owner/SID, exact Job membership and live-state checks passed
for MongoDB and all three Node helpers. MongoDB PID 6772 native creation was
2026-10-20T09:20:47.4038321Z; CIM creation was 2026-10-20T09:20:47.4038320Z.
Exact retained/independent native FILETIME was 134369616474038321. Both UTC values
truncate identically to microsecond ticks 639280848474038320, with raw values
retained and no arbitrary tolerance. Initializer verified the fresh owned dbPath,
127.0.0.1:27018, replica f021-test, sole member, writable PRIMARY and empty
deeplearner-f021-test target, then closed its client and exited 0.

**Index provisioning PASS: exactly twelve approved target definitions.** The
suite created the Section 31.6 allowlist and completed its pre-scenario metadata
checks for exact names, ordered keys, uniqueness and absence of alternate options.
Retained MongoDB createIndexes oplog records additionally confirm v2 for all
twelve, ten unique/two nonunique, with no additional application secondary indexes.
Default _id_ indexes remain separate. MongoDB also
automatically created four replica-system indexes inside its disposable config
database; these are not application or protected persistent-database provisioning.
The wrapper's raw Indexes=NOT_RUN is incomplete bookkeeping because it updates
that field only after the entire suite succeeds. The retained live index records
and completed suite index assertions establish the actual provisioning result;
the raw runner result is preserved unchanged.

Executed the prepared suite **once**, with zero invocation retries:
**1 PASS / 13 FAIL**, including the parent (one passing child, twelve failing
children and the failing parent). Zero skipped/cancelled/todo; suite duration
8,640.5507 ms. The passing child verified server-created fresh origin and refusal
of an unsealed first submission without partial attempt records.

All twelve failing children stopped in their shared prepare() call at
completion-qualification.integration.ts:251 with sanitized AppError code
PRACTICE_ASSESSMENT_CONFLICT. The retained source frame is
practice-grading.service.ts:393, the immutable existing-rubric comparison in
author(). The parent failed with subtestsFailed. A complete underlying cause or
permitted correction has not been established by this gate; no fixtures,
assertions, implementation or launcher were modified after the failures.

| Failing child scenario | Observed failure stage |
| --- | --- |
| Independent policy approval and atomic first attempt/assessment/activity | Rubric preparation conflict |
| Same-request concurrent replay and changed payload | Rubric preparation conflict |
| Failed first score and later reveal-assisted submission | Rubric preparation conflict |
| READ/EXAMPLE activity-only adapter and no completion | Rubric preparation conflict |
| Terminal policy revocation | Rubric preparation conflict |
| Progress-failure rollback | Rubric preparation conflict |
| Controlled majority-proof loss and exact retry | Rubric preparation conflict |
| Missing qualifying index | Rubric preparation conflict |
| Current STUDENT eligibility | Rubric preparation conflict |
| Unpublished source and changed private solution | Rubric preparation conflict |
| Prior ungraded disclosure and historical refusal | Rubric preparation conflict |
| DIAGNOSTIC coexistence during qualifying replay | Rubric preparation conflict |

Those downstream acceptance assertions were not reached. Do not claim live PASS
for independent 70% policy approval, first qualifying grade, atomic assessment/
activity persistence, idempotency/concurrency, rollback, uncertain-commit proof,
historical/reveal-assisted refusal or F036/F037 compatibility from this run.
No successful qualifying answer-disclosure path was exercised. Controlled proof
loss did not execute and no real failover testing occurred. Previously passing
offline evidence is unchanged; it does not override these integration failures.

Cleanup **PASS, graceful**: initializer PID 23104 exited 0; integration helper
PID 21548 exited 1; shutdown helper PID 13872 exited 0; MongoDB PID 6772 exited 0.
Suite finally cleanup closed its database connection and removed its owned
collections. The corrected shutdown helper closed its client; no forced cleanup,
UNKNOWN exit or cleanup error occurred. Job emptiness, port release, retained
handle closure and removal of only marked disposable storage passed. Protected
MongoDB/development identities, monitored listeners and persistent demo-storage
filesystem metadata were unchanged. Protected databases were not queried or
modified; metadata equality is not a logical content audit. All 480 source hashes
matched before this authorized documentation append.

Retained ignored evidence: .cache/f038-slice1-integration-2026-10-20-09-20-44-f68dc9,
including sanitized individual test events/summary and failure frames, original
identity observations, exit records, observed-index-provisioning.json, canonical
index allowlist, source/protected baselines and unchanged raw result.json.
Prior blocked startup, forced cleanup and file-loader failure history remain.

F038 remains **IN_PROGRESS** and Slice 1 final acceptance is blocked. Next owner
gate: authorize a bounded investigation of the rubric preparation conflict and
any separately justified correction/rerun. No automatic correction or additional
integration invocation occurred. F001-F037 are preserved; Slice 2/3, completion
and F039 remain outside this gate. All **141 browser scenarios remain NOT_RUN**;
twelve proposed Slice 3 cases remain unimplemented. No Git delivery, persistent
index provisioning or production readiness is implied.

### 31.9 Authorized fixture identity correction and guarded rerun - 12 PASS / 2 FAIL

On 2026-10-20, the owner approved one correction confined to
apps/api/tests/completion-qualification.integration.ts, focused verification and
one fresh guarded integration invocation. The confirmed earlier conflict was
fixture misuse of the approved author-command contract: one Admin and a reused
constant correlation identity described different immutable rubric bindings.
The application correctly refused changed content under that identity.

The fixture now captures randomUUID() once at each independent prepare() boundary
and passes that constant to rubric authoring. A fixture-local Set asserts that
preparations do not reuse author-command identities. The captured UUID remains
stable for retries of that exact command. Existing authors/reviewers, bindings,
fixtures and all original assertions remain unchanged. All fourteen records are
preserved. No service, repository, model, index, package or launcher changed.

Focused verification **PASS** before startup:

- Existing practice-grading.test.ts module: **23 PASS / 0 FAIL**, including
  same-command/same-payload replay, changed-payload conflict, independent/current
  Admin review, immutable versions and publication/revision binding. These are
  focused reruns, not additional distinct tests added to the retained 405 API
  result; the complete offline regression suite was not rerun.
- API test-project TypeScript noEmit, corrected-file ESLint and Prettier checks,
  UTF-8/LF, preserved assertion/record inventory and exact fixture diff: PASS.
- Separate focused source/security review: **CRITICAL 0 / HIGH 0 / MEDIUM 0 /
  LOW 0** unresolved correction findings. The UUID is nonsensitive command
  identity, not authorization; approval, conflict, durability and secrecy guards
  remain unchanged. Later integration failure below is unresolved and is not
  overridden by this limited correction review.

Isolation preflight **PASS**: ordinary unelevated REDGOLDMARK42\Shreeji, no leftover
disposable processes/storage, free port 27018, fresh marked storage and exact
private owned Job. MongoDB and all three helpers passed retained/independent
native-handle identity, executable, parent, owner/SID, exact Job and live-state
checks. MongoDB PID 24552 native UTC creation was
2026-10-20T10:08:12.5311243Z; CIM was 2026-10-20T10:08:12.5311240Z. Exact native
FILETIME was 134369644925311243; both UTC timestamps truncate to common
microsecond ticks 639280876925311240. Original observations remain retained.
Initializer verified exact owned storage, 127.0.0.1:27018, f021-test, sole replica
member, writable PRIMARY and empty deeplearner-f021-test before fixtures.

Provisioning **PASS** for exactly the twelve approved definitions in Section
31.6, ten unique/two nonunique. Ordered keys, names, constraints, v2 and absence
of alternate options were verified against source declarations, pre-scenario
suite metadata checks and retained createIndexes records. Standard _id_ and
MongoDB's automatic disposable replica-system indexes remain separate. No new
application definition or protected/persistent database provisioning occurred.
The missing-assessment-index child also passed its controlled refusal/restore
assertions. Raw wrapper Indexes=NOT_RUN is preserved: that bookkeeping field is
set only after whole-suite success, and does not reflect the completed live
provisioning. observed-index-provisioning.json records the actual verified state.

The prepared integration suite ran **once**, zero invocation retries:
**12 PASS / 2 FAIL**, including the parent (twelve passing children, one failing
child and the failing parent). Zero cancelled/skipped/todo. Suite duration:
16,661.1189 ms. All preparations passed the new uniqueness guard and the previous
rubric preparation conflicts did not recur.

The failing child was "same-request concurrent replay converges; changed payload
conflicts". Promise.all of two identical submissions rejected with sanitized
AppError code **DEPENDENCY_UNAVAILABLE**. Retained frames identify
practice-attempt.repository.ts:287, the combined transaction callback-count/time
budget guard, through submit(), Practice unlock() and
completion-qualification.integration.ts:358. The guard checks either more than
three body entries or at most 2,000 ms remaining; this evidence does not establish
which condition triggered or the underlying contention/retry cause. The parent
failed with subtestsFailed. Concurrent convergence, its subsequent one-record
assertions and changed-payload assertions in that child were not reached and
must not be reported PASS. No correction, relaxed budget or additional run was
attempted after failure.

Passing child evidence covers fresh server-created origin and unsealed refusal;
independent 70% policy approval and atomic first attempt/qualifying assessment/
activity before disclosure; failed-first grading with no later replacement;
READ/EXAMPLE activity-only behavior; terminal policy revocation; summary-failure
rollback; controlled majority-proof loss suppressing disclosure with exact retry
recovery; missing-index refusal; current STUDENT eligibility; unpublished/private
revision refusal; exclusion after controlled prior ungraded disclosure; and
unchanged DIAGNOSTIC coexistence. Do not generalize these results to successful
concurrent replay, real database failover, live connection-generation loss,
production security or end-to-end Concept completion. Controlled proof loss is
not real failover or network-partition verification.

Cleanup **PASS, graceful**: initializer PID 28144 exited 0; integration helper
PID 19268 exited 1; shutdown helper PID 15092 exited 0; MongoDB PID 24552 exited 0.
Owned connections and collections were closed/removed, Job empty, port released,
retained handles closed and only marked disposable storage removed. No forced
termination, UNKNOWN exit or cleanup error occurred. Protected MongoDB and
development-process identities, listeners and persistent demo-storage filesystem
metadata matched their baselines. Protected databases were not queried or
modified; filesystem metadata is not a logical database-content audit. All 480
source hashes matched the pre-run snapshot before this evidence append.

Retained ignored evidence:
.cache/f038-slice1-integration-2026-10-20-10-08-08-316830, including individual
sanitized results/frames, original identities, exit codes, observed index records,
source/protected baselines and unchanged raw result.json. Focused checks and
pre-correction fixture/source pins are retained in
.cache/f038-slice1-fixture-correction-2026-10-20-1792490786691.
Earlier blocked starts, loader failures and 1 PASS / 13 FAIL history are preserved.

F038 stays **IN_PROGRESS**; Slice 1 final review remains blocked by the concurrent
replay failure. Next owner gate: bounded diagnosis of that failure and separately
approved correction/verification if justified. No automatic rerun or further
implementation occurred. F001-F037 remain preserved. All **141 existing browser
scenarios remain NOT_RUN**; twelve proposed Slice 3 cases remain unimplemented.
Slice 2/3, F039, Git delivery and production deployment remain unauthorized.

### 31.10 Authorized concurrency instrumentation and one diagnostic execution

On 2026-10-20, the owner approved diagnostic instrumentation confined to
completion-qualification.integration.ts, focused checks and one guarded run.
The scenario now injects per-request observation wrappers through the existing
AttemptStore, clock, CompletionGrading and Practice service parameters. Real
methods receive the original arguments/session and their results/errors pass
through unchanged. Only these owned test-session instances are observed; no
application method, global prototype, retry policy or transaction option changes.

Stable labels concurrent-A/concurrent-B identify the two identical requests.
Bounded in-memory traces capture actual transaction starts, callback entries,
the original repository clock reads, sanitized errors, commit acknowledgements,
owned proof outcomes and answer-field return flags. Both promises are observed
independently and awaited in finally after the original Promise.all, before
sanitized evidence is written with exclusive creation into ignored .cache.
No extra database commands, artificial delays or request retries are introduced.
Maximum 256 events/request and four allowlisted error labels/event; neither trace
overflowed. Answers, rubric contents, credentials, tokens, raw idempotency keys,
private fingerprints and error messages/stacks are not serialized into the trace.
HTTP status is explicitly NOT_APPLICABLE_INTERNAL_SERVICE; AppError's declared
status and internal result status are recorded separately. This is not a mounted
HTTP/browser observation. Observation overhead can affect scheduling; there is
no claim of a timing-neutral or universally reproducible interleaving.

Focused verification **PASS**: API test-project TypeScript, file ESLint/Prettier,
UTF-8/LF and exact source scope. AST comparison retained all **55 original assert
calls** verbatim in normalized AST form and the same thirteen named children plus
parent. Removing only the diagnostic block and standard-library writeFile import
reconstructs the pre-gate fixture exactly. Separate focused source/security review
has **0 unresolved CRITICAL/HIGH/MEDIUM/LOW instrumentation findings**. No full
offline regression or additional unit suite was rerun in this diagnostic gate.

Isolation **PASS**: ordinary unelevated execution, no leftovers, initially free
27018, fresh marked storage, exact owned Job, retained/independent native handles,
executable, parent, owner/SID, live state and common-microsecond UTC comparison.
MongoDB PID 12364 native creation was 2026-10-20T10:51:56.9995897Z; CIM was
2026-10-20T10:51:56.9995890Z. Exact native FILETIME 134369671169995897 and common
UTC microsecond ticks 639280903169995890 are retained with raw observations.
Initializer verified owned dbPath, 127.0.0.1:27018, f021-test, sole replica member,
writable PRIMARY and empty deeplearner-f021-test before fixtures.

Exactly the twelve previously approved index definitions were provisioned and
verified: names, collections, ordered keys, ten unique/two nonunique constraints,
v2 and no alternate options. No additional application definitions or persistent
provisioning occurred; automatic replica-system/default _id_ indexes are separate.
Retained index observations establish live provisioning despite the unchanged
wrapper's Indexes=NOT_RUN bookkeeping on whole-suite failure.

The suite ran **once**, zero invocation retries: **12 PASS / 2 FAIL**, including
parent; twelve passing children, concurrent-replay child failed, parent failed
with subtestsFailed. Zero skipped/cancelled/todo. Duration **19,820.2192 ms**.
All original assertions remained; the concurrency acceptance criteria are still
unsatisfied. Passing coverage from Section 31.9 also passed in this invocation.

#### Request-correlated diagnostic findings

| Observation | concurrent-A | concurrent-B |
| --- | --- | --- |
| Repository withTransaction calls | 1 | 1 |
| Driver transaction starts / callback entries | 1 / 1 | 4 / 4 |
| Bodies allowed to perform submission work | 1 | 3; fourth entry refused immediately |
| Commit acknowledgements | 1, configured majority+journal | 0; no commit call reached |
| Exact owned attempt proof | VERIFIED | NOT_REACHED |
| Qualifying assessment proof | VERIFIED | NOT_REACHED |
| Internal result | FULFILLED | REJECTED; declared status 503 |
| Answer field returned to internal caller | true, after commit and both proofs | false |
| Trace overflow | 0 | 0 |

Request B's first three bodies failed at attempt insertion with
MongoServerError **112**, label **TransientTransactionError**. Its native driver
re-entered the callback within the same withTransaction call. Body entry times
were approximately 38.671, 88.651, 136.158 and 176.383 ms after its repository
clock origin. First-three exact guard clock reads were 38.684, 88.662 and
136.177 ms; all were far above the two-second remaining-time reserve. Their
insertion errors occurred around 77.466, 123.660 and 165.808 ms.

On the fourth entry, the counter branch at
practice-attempt.repository.ts:287 (++bodies > 3) refused further work with
DEPENDENCY_UNAVAILABLE. The elapsed time at the immediately preceding callback
observation was **176.383 ms**, with **9,823 ms** remaining. The remaining() clock
branch was not evaluated because the count condition short-circuited. The request
rejected around 177.096 ms. Thus the diagnostic reproduction confirms callback-
budget exhaustion under transient insertion contention, not elapsed timeout,
verification-reserve exhaustion, a nested transaction or an observed accounting
defect. The fourth driver transaction started but executed no submission work.
The approved three-work-body guard behaved fail closed as designed.

Request A's majority+journal commit acknowledged at approximately **201.151 ms**
relative to its own repository clock origin. Exact owned attempt and assessment
proofs then passed; its result returned an answer field around **313.470 ms**.
These are per-request relative clocks, not a cross-request absolute timeline.
A's verified commit/proofs establish its durable owned records; B's transactions
did not reach commit or proof and returned no answer. No duplicate-count query
or convergence success is inferred: Promise.all rejected on B, so the original
equality/count/changed-payload assertions after it were not reached. The finally
observer still captured A's independent fulfillment. The prior uninstrumented
run's exact counters remain historically unobserved, rather than retroactively
relabelled with these values. Controlled proof-loss checks are not real failover.

Classification: **confirmed expected fail-closed contention, with an unresolved
same-key convergence acceptance gap**. No guard removal, budget increase,
relaxed assertion or retry change is justified by the evidence. A proposed next
correction, requiring separate owner approval/design reconciliation, is bounded
LOCAL same-account/idempotency-key coordination before starting competing
transactions. Waiting must consume the existing request deadline; each request
must still perform fresh authorization/binding checks and exact durable proof.
Do not cache/share returned answers or manufacture a missing assessment. Such
process-local coordination cannot promise cross-process production serialization.
Proposed implementation/review paths are
apps/api/src/modules/practice/practice-attempt.repository.ts and
apps/api/tests/practice-attempt-repository.test.ts, plus this existing integration
fixture and feature document. None of those application corrections were implemented.

Cleanup **PASS, graceful**: initializer PID 29236 exited 0; integration helper
PID 20992 exited 1; shutdown helper PID 14264 exited 0; MongoDB PID 12364 exited 0.
Connections closed; Job empty, port free, handles closed and marked owned storage
removed. No forced cleanup, UNKNOWN exit or cleanup error occurred. Protected
MongoDB/development identities, monitored listeners and persistent demo-storage
filesystem metadata were unchanged. Protected databases were not queried or
modified; filesystem equality is not a logical database-content audit. All 480
source hashes matched pre-run pins before this evidence-only append.

Retained ignored evidence:
.cache/f038-slice1-integration-2026-10-20-10-51-48-3b5e7c;
.cache/f038-slice1-concurrency-observation-5544ebd9-6d48-4562-ab6a-0788e4330e7d.json;
and focused scope/AST review in
.cache/f038-slice1-concurrency-diagnostic-2026-10-20-1792493236482.
Historical blocked and failed runs remain unchanged. F038 remains **IN_PROGRESS**;
Slice 1 is not finalized. Next gate: owner disposition of the confirmed bounded
contention and separately approved convergence-correction design/implementation.
No automatic correction/rerun, Slice 2/3, F039, Git or deployment work occurred.
All **141 existing browser scenarios remain NOT_RUN**; twelve proposed Slice 3
cases remain unimplemented. F001-F037 status/history is preserved.

### 31.11 Owner-approved bounded LOCAL same-key gate - offline verification PASS

On 2026-10-20, the owner approved Option A implementation, focused offline checks
and separate diff review within exactly four existing paths. This approval does
not authorize MongoDB execution, full Slice 1 acceptance or Slice 2/3 work.

Modified only:

1. apps/api/src/modules/practice/practice-attempt.repository.ts
2. apps/api/tests/practice-attempt-repository.test.ts
3. apps/api/tests/completion-qualification.integration.ts
4. docs/features/F038-completion-rules.md

No source paths were created/deleted; no canonical API/database, dependency,
configuration, index or collection changed. Existing source and feature history
are preserved outside these authorized edits.

#### Implemented scheduling and trust contract

The default process-wide coordinator is enabled only by an immutable server-side
APP_ENV snapshot matching the existing validated LOCAL default. It consumes the
actual MongoDB client/Db identities and established connection/client loss hooks
from mongoQualification. No request flag, caller-supplied generation or browser
claim enables the production coordinator. Internal factory/scheduler injection is
used only for deterministic offline tests; the production singleton is shared
across repository instances, including the integration observer's wrapped store.

Each live generation domain owns account + hashed Idempotency-Key entries bound
to the existing canonical request fingerprint. Different payload reuse conflicts
with PRACTICE_IDEMPOTENCY_CONFLICT. Other accounts/keys/generations have isolated
queues. Gate metadata stores only digests, generation references and void permits/
waiter bookkeeping; no raw key, submitted answer, answer DTO or response promise
is cached. Every admitted operation runs its own repository workflow.

Limits are **100 active keys total**, including invalidated leaders still running,
and **ten queued followers per key**. Capacity exhaustion returns sanitized 503
DEPENDENCY_UNAVAILABLE. Admission and FIFO handoff occur synchronously within
the process. Followers remain serialized through their replay transactions and
proof/cleanup paths, avoiding new competition on replay authorization fences.

The caller's original monotonic ten-second budget starts before readiness and
gate admission; it is never reset. Waiting ends at the original two-second
verification reserve. Per-follower timers detach expired waiters without
cancelling the leader; promotion rechecks the remaining reserve. There is no new
AbortSignal propagation, arbitrary delay or retry/backoff rule. The original
three-work-body guard, CSOT transaction options, majority+journal commit and
verification reserve are unchanged.

Only successful repository completion, including its session cleanup, advances
the next waiter. Leader failure, uncertain commit, cleanup failure or generation
loss fails queued followers closed, without automatic takeover. A follower is
explicitly replay-only: if the original owned row is absent, it returns
PRACTICE_COMMIT_UNCONFIRMED instead of creating a replacement first submission.
Generation loss permanently invalidates old permits/waiters; a new domain cannot
revive them. Actual MongoDB client/Db identity is rechecked on admission, callback entry,
post-proof and final cleanup/return. Active old generations retain their capacity
until completion. Timers/listeners/entry references are removed on settlement.
Process termination naturally discards this memory; there is no persistent lease.

The gate grants scheduling only, never authorization. Followers repeat readiness
and origin checks after waiting, then use existing current publication/ancestry,
revision/private solution, STUDENT/actor, Concept policy and rubric validation.
They independently obtain the original durable attempt, fresh qualifying replay
authority and exact owned majority attempt/assessment proofs. Existing Practice
service eligibility checks before/after submission remain unchanged. A leader's
promise/permit contains no answer and never substitutes for those checks. Missing,
revoked, mismatched or unverifiable state remains fail closed; no assessment is
promoted/regraded and F037 activity is not incremented by replay.

This is LOCAL in-process coordination only, with no cross-process safety or
distributed convergence claim. Database uniqueness, immutable F036 rows and
majority ownership proof remain authoritative. Queue timers and native transaction
deadlines do not establish a hard bound against kernel/driver/event-loop stalls.

#### Focused and regression results

| Check | Actual result |
| --- | --- |
| Repository suite, including new coordination cases | **31 PASS / 0 FAIL**: twelve existing repository cases and nineteen new named cases; parameter loops are not additional distinct tests. |
| Relevant qualification and Practice service regressions | **35 PASS / 0 FAIL** across completion-grading.test.ts and practice.test.ts. |
| Distinct records verified in this gate | **66 PASS / 0 FAIL**; the earlier 29-pass development run is not added again. Existing aggregate evidence is retained, not represented as a full-suite rerun. |
| API build | PASS, source TypeScript compilation only; no service/deployment. |
| API source/test TypeScript | PASS, noEmit including prepared integration. |
| ESLint and Prettier | PASS for the three changed TypeScript files. Initial format warnings were corrected only within authorized paths. |
| Contract preservation | Exact transaction options, ten-second expression and three-body/reserve guard preserved. All 55 existing integration assertions and fourteen named records are unchanged. |
| Scope/history/encoding | Four approved paths only; UTF-8/LF, no new source paths and unchanged canonical architecture/status files. git diff --check PASS. |
| MongoDB integration | **NOT_RUN for this correction**. Fourteen prepared records and the same twelve existing index definitions require a separately approved guarded rerun. |
| Browser | **141 existing scenarios NOT_RUN**. Twelve proposed Slice 3 cases remain unimplemented. No inherited browser exception or mounted acceptance. |

Deterministic injected-clock/timer coverage verifies FIFO handoff, changed-payload
conflict, account/key isolation, generation separation/loss, both capacity limits,
reserve refusal, timeout detachment, budget retention after waiting, leader
failure/uncertainty/cleanup refusal and absence of follower takeover. Repository
tests verify independent owned proof, fresh publication/revision/solution checks,
current qualification authority and assessment-proof refusal, missing-original
refusal, no cached response and no duplicate activity. The prepared diagnostic
fixture now passes the production shared coordinator into both observed request
repositories; all original assertions remain intact. No MongoDB process/client
connection, browser or service was executed in this offline gate; the existing
driver-construction test explicitly stops before any database operation.

#### Separate formal implementation-diff review

Review covered FIFO admission/handoff, bounded metadata, timers, failure cleanup,
generation invalidation, default production wiring, replay-only behavior, fresh
authorization/proof, sensitive logging and backward compatibility with F036/F037.

| Severity / ID | Actual finding and disposition |
| --- | --- |
| MEDIUM S1-G1 - RESOLVED | Initial gate activation required explicit APP_ENV=LOCAL and missed config/env.ts:107's existing LOCAL default when unset. practice-attempt.repository.ts:307 now uses the same immutable server default; the new offline runtime-context test passes without opening a database connection. No environment/configuration contract changed. |
| CRITICAL / HIGH | No finding identified. |
| LOW | No finding identified. |

Final unresolved instrumentation/coordination source findings:
**CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0**. This is an offline source conclusion,
not a live concurrency acceptance result. The historical 12 PASS / 2 FAIL MongoDB
run and its confirmed callback-budget cause remain unchanged; they are not
retroactively upgraded. The corrected gate's real MongoDB commit/fence/replay
behavior has not yet been executed. Controlled proof-loss evidence is still
distinct from real failover verification.

Ignored evidence: .cache/f038-slice1-coordination-offline-2026-10-20-1792495997859,
including pre-gate source pins, exact four-file snapshots, initial/final focused
logs, relevant regression output and contract/source review metadata.

F038 remains **IN_PROGRESS**. F001-F037 and F039 roadmap/status history are
unchanged. Next owner gate: review this offline evidence and authorize one guarded
disposable MongoDB rerun of the unchanged fourteen records with the same twelve
approved indexes. No integration execution, Slice 1 finalization, Slice 2/3,
completion state, F039, Git delivery or production deployment is authorized here.

### 31.12 Owner-approved same-key coordination guarded MongoDB rerun - PASS

The owner separately authorized one guarded disposable execution following Section
31.11's offline correction. The existing fourteen prepared records were invoked
once, with zero suite-invocation retries. No application, test, configuration,
transaction-budget, index-definition or assertion changes were made in this gate.
Only this feature document receives repository evidence changes.

#### Isolation and exact disposable indexes

Preflight **PASS** in ordinary unelevated Windows execution. The fresh MongoDB
process entered the exact test-owned Job at creation. Retained and independent
native-handle PID/time identity, stable native creation time, exact executable,
parent, owner/SID, Job membership and live-state observations all passed before
database access and again at the relevant helper handoffs. Port 27018 was initially
free; no previous disposable process/storage was found. Fresh marked storage was
empty before startup. Protected process, port and persistent demo-storage metadata
baselines were captured before startup.

Raw MongoDB native creation time was 2026-10-20T12:12:56.7189781Z; CIM reported
2026-10-20T12:12:56.7189780Z. Both UTC values were independently truncated to the
documented common microsecond precision (ticks minus ticks modulo 10), producing
639280951767189780 ticks. Raw values remain retained; native-handle timestamps
also matched exactly without normalization. Every helper's corresponding checks
passed. No arbitrary tolerance or PID-only ownership was used.

Initializer exit **0** preceded suite execution. Server command-line/storage
identity, single-member f021-test replica configuration, writable PRIMARY and
empty exclusive deeplearner-f021-test target at 127.0.0.1:27018 were verified.
Database enumeration contained only the expected system databases before fixtures.

**Twelve approved index definitions PASS**, exactly Section 31.6's ten unique and
two nonunique definitions. Collections, names, ordered keys, uniqueness, v2 and
absence of alternate options matched the approved allowlist. The suite checked
live index definitions after provisioning; sanitized retained MongoDB index-build
records independently matched all twelve definitions with no unexpected target
secondary index. The missing-assessment-index control and restoration used only
that same approved definition. Standard _id_ and MongoDB's internal replica/system
indexes are separate. No persistent database/index provisioning occurred.

#### Single execution and request-correlated concurrency result

**14 PASS / 0 FAIL**, comprising thirteen children and the parent; zero skipped,
cancelled or todo records. Suite-reported duration was 16,577 ms. Historical
blocked/failed runs, including the prior 12 PASS / 2 FAIL contention result, remain
unchanged and are not retroactively reclassified.

| Concurrent request | Actual sanitized observation |
| --- | --- |
| A, leader | One transaction call, one callback body, one majority/journal commit acknowledgement. Attempt and qualifying-assessment ownership proofs VERIFIED. Result FULFILLED, with answer only after both proofs; result returned at approximately 177 ms. |
| B, follower | Waited for A, then repeated qualification readiness and executed its own replay transaction: one call, one callback, one majority/journal commit acknowledgement. Both ownership proofs independently VERIFIED. Result FULFILLED at approximately 329 ms, identical to A's committed result. No competing attempt insertion or progress-after operation occurred in its trace. |

B entered its transaction at approximately 188 ms with 9,812 ms remaining and a
7,812 ms transaction timeout, preserving the original deadline and 2,000 ms proof
reserve. A entered with 9,979 ms remaining and a 7,979 ms transaction timeout.
Both consumed one of the maximum three callback bodies; neither encountered the
previous insertion conflict or callback-budget refusal. These are internal-service
results, not HTTP status measurements. All diagnostic events were retained with
no event drops, submitted answers, expected answers, raw keys or private hashes.

The unchanged concurrency assertions verified equal results, changed-payload
refusal, exactly one immutable owned attempt and exactly one COMPLETION_INPUT
assessment. The atomic first-submission case separately verified the F037 activity
update; replay's trace performed no progress-after update. Concurrent per-account
progress counts were not added as a new live assertion in this gate. Larger FIFO
queues, caps, wait detachment and leader-failure propagation retain their Section
31.11 offline evidence; this live scenario exercised two identical requests only.

All other prepared cases passed: independent policy approval; sealed synthetic
origin and first-submission authority; atomic attempt/assessment/activity writes
before disclosure; incorrect-first-answer preservation and reveal-assisted retry
exclusion; READ/EXAMPLE activity-only compatibility; terminal policy revocation;
summary-failure rollback; controlled majority-proof loss and exact retry recovery;
missing-index refusal; current STUDENT eligibility; publication/private-solution
binding refusal; prior ungraded disclosure exclusion; and unchanged DIAGNOSTIC
grading. No completion or mastery mutation was introduced.

#### Cleanup, retained evidence and limits

Cleanup **PASS**: initializer, integration helper, shutdown helper and MongoDB all
exited **0**. Graceful shutdown was verified; no forced owned-Job termination was
used, no exit code was UNKNOWN and no cleanup error was reported. Job empty, port
27018 released, retained handles closed and marked disposable storage removed all
passed. Protected MongoDB/development process identities, monitored ports and demo
storage metadata remained unchanged. All monitored repository source hashes were
unchanged before this documentation append; no tests or implementation were edited.

Retained ignored evidence:
.cache/f038-slice1-integration-2026-10-20-12-12-53-e40544, including context,
raw/normalized identity checks, baselines, exact index definitions and observed
provisioning, sanitized suite output, exit codes and result.json. Independent
request trace: .cache/f038-slice1-concurrency-observation-d4460b6b-0451-4f8e-b880-2508490fa929.json.

Controlled proof-loss injection is not real MongoDB failover testing. The gate is
LOCAL and process-wide only; no cross-process convergence or production readiness
is established. No new defect was observed in this run. Privacy/retention/erasure,
release requirements and the unfinished Slice 2/3 dependencies remain outstanding.
All **141 existing browser scenarios remain NOT_RUN**; twelve proposed Slice 3
cases remain unimplemented. No browser exception is implied.

F038 remains **IN_PROGRESS**. F001-F037 completion history and F039 status remain
unchanged. Next owner gate: one bounded Slice 1 final security/transaction/source
review. This passing integration does not finalize Slice 1 or authorize Slice 2/3,
F039 implementation, Git delivery or production deployment.

### 31.13 Owner-approved bounded Slice 1 final source/security review

**SLICE 1 FINAL REVIEW PASS — PARTIAL F038**

The owner authorized this separate final review after the passing Section 31.12
guarded execution. Review covered the actual Slice 1 implementation, fixture UUID
correction, sanitized concurrency instrumentation and bounded FIFO correction.
No test, service, MongoDB, browser or synthetic execution was performed during
this review. No application, test, configuration or canonical document was edited.

#### Reviewed scope and source conclusions

All actual changes fall within Section 31.2's thirty-two approved literal paths.
The cumulative implementation now touches **25 paths: five creations and twenty
modifications**; the coordination correction added the previously reserved
practice-attempt-repository.test.ts path to the initial 24-path implementation.
Seven reserved paths remain unchanged. Earlier scope counts remain historical.
Source hashes show no implementation drift since the passing guarded execution.

| Review area | Final source conclusion |
| --- | --- |
| Concept policy | Strict reviewed envelope enforces explicit 70%, required Read/Visualize/Example/Practice and conditional Revise. Current Admin author and independent current Admin reviewer, immutable server approval provenance, exact fingerprint and terminal revocation are checked. Whole-envelope transactional CAS fences qualification/replay against policy changes. |
| Synthetic origin | Server generates fresh identities and performs insert-only creation with majority-owned proof. Unsealed or failed creation cannot authorize qualification. Private behavior binds the actual database/client generation and sealed policy; lifecycle uncertainty/disposal permanently invalidates old authority. No import/adoption, metadata reconstruction or client freshness claim establishes origin. |
| Current authorization/bindings | Existing Practice service checks current eligible STUDENT before and after submission. Qualification additionally rechecks owner, full published ancestry, Concept/question/public revision/private solution, rubric approval/audit and policy/checkpoint bindings inside the transaction and during proof. Current checks do not create globally instantaneous account/content revocation guarantees. |
| First submission | Only the original eligible OUTPUT attemptNumber=1 can create COMPLETION_INPUT. Historical/unknown-origin replay cannot acquire a missing grade. Incorrect first results remain 0; later reveal-assisted submissions cannot replace them. Lost responses conservatively remain possible exposure. B2 DIAGNOSTIC records are not promoted. |
| Coordination | One process-wide LOCAL gate uses actual client/database generation, account and hashed key, bound to the canonical request fingerprint. FIFO replay-only followers repeat authority/source checks and both durable proofs. No leader result or answer is cached. Limits remain 100 active keys and ten queued followers; waiting consumes the original ten seconds, preserving three callback bodies and two-second reserve. Failure/uncertainty refuses queued followers; no takeover or generation revival. |
| Atomic durability/disclosure | Immutable F036 SUBMITTED/null-score attempt, distinct qualifying assessment and unchanged F037 activity update share the existing majority+journal transaction. Exact committed attempt and assessment records, owned request identity and fresh authority are proved before returning the solution. Missing proof, rollback, uncertain commit or failed cleanup suppresses disclosure. |
| Compatibility and boundaries | Existing GET answer secrecy, five-field answer data, receipt metadata, LOCAL route guard, rate limits and no-store behavior remain intact. Replay does not increment activity. Section receipts remain ACTIVITY_ONLY/NOT_ESTABLISHED; no Stage A VERIFIED adapter, completion-state writer, scoring-summary update, mastery mutation or new public endpoint is introduced. Frontend/spec changes are approved saved-attempt wording only. |
| Fixtures/privacy | Distinct author commands use distinct UUIDs without weakening replay/conflict semantics. Original integration assertions remain preserved. Diagnostic fields are bounded and sanitized. Qualifying assessments duplicate neither student answers nor expected answers; private hashes are not anonymization. Application append-only guards are not database WORM. |

Separate final findings: **CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0 unresolved**.
No new finding was identified, so there is no new affected-file/line defect to
report. The resolved findings and exact references in Sections 31.5 and 31.11
remain retained; no correction was made during this final review.

#### Canonical consistency and retained evidence

API_DESIGN.md's Slice 1 refinement and DATABASE_DESIGN.md's reviewed-policy,
qualifying-assessment and origin refinements match the approved Option B
replacement. They are additive and preserve existing Auth, Practice and canonical
studentProgress contracts. Concept > Topic > Learning Path > default 70 remains
the documented precedence; unsupported Topic/Path authority is not activated and
absent/invalid Concept authority cannot silently fall back. Logical synthetic
origin is explicitly distinguished from physical storage/process attestation.
External disposable test ownership remains mandatory. No production qualification
or completed Topic aggregation is claimed; PRD Section 14's remaining requirements
are deferred, not waived. No canonical amendment is required by this review.

Retained evidence, without rerunning or adding overlapping counts: API offline
405 distinct PASS; frontend 229 PASS; coordination correction 31 focused and
35 relevant regressions PASS; build/TypeScript/lint/format/security checks PASS;
one guarded integration **14/14 PASS**, including identical concurrent replay;
twelve approved disposable index definitions verified; all four supervised
process exits **0**, graceful cleanup and protected-baseline verification PASS.
Historical initialization, loader, author-command and contention failures and
their approved corrections remain unchanged. Source inspection and this acceptance
do not upgrade any offline-only condition to live verification.

#### Remaining work and next gate

Multi-process convergence and real MongoDB failover remain **unverified**.
Controlled proof-loss injection is not failover testing. Larger FIFO queues,
capacity/deadline controls and queued failure cases retain their focused offline
evidence; the live concurrency scenario involved two identical requests.

All **141 existing browser scenarios remain NOT_RUN**. Twelve proposed Slice 3
browser cases remain unimplemented, not mounted or executed. No previous browser
exception transfers and no browser PASS or production readiness is claimed.

Slice 2 completion persistence/API, transactional evidence qualification/fencing
and Slice 3 accessible Student workflow remain outstanding. Production privacy,
retention/erasure/backups, enrollment/migration, index operations and release
checks require separate approval. External copying and privileged server/database
tampering are outside the bounded application disclosure-ordering guarantee.

F038 remains **IN_PROGRESS**, not READY_FOR_REVIEW or APPROVED_COMPLETE.
F001-F037 approval history and F039 NOT_STARTED remain unchanged. Slice 1 is
accepted only as a partial LOCAL foundation. Ready for **Slice 2 implementation
planning**, subject to the next explicit owner approval and exact scope/contract
reconciliation; no Slice 2/3 implementation or Git delivery is authorized here.

## 32. Slice 2 bounded implementation plan - planning only

**PLAN READY FOR OWNER REVIEW; IMPLEMENTATION NOT AUTHORIZED.** This gate changes
only this document by append. F038 remains IN_PROGRESS. Section 31.13's Slice 1
acceptance, historical failures/corrections and all prior verification remain
intact. This plan specializes Sections 30.4-30.6/30.10 under the accepted Option B
replacement; it does not revive the superseded runtime supervisor capability.

### 32.1 Scope, existing prerequisites and exact inventory

The Section 30.8 baseline assigns Slice 2 exactly IDs
1,2,3,4,7,8,11,21,22,23,24,25,28,29,30,31,41,42,43,49:
**20 paths, eight creations and twelve modifications**. Static inspection confirms
all eight creations are absent and all twelve modifications exist; every literal
path below belongs to the original 54-path baseline. Slice 1's separately approved
qualification integration addition does not expand this Slice 2 boundary.

| Operation | Literal path | Responsibility |
| --- | --- | --- |
| CREATE | apps/api/src/modules/progress/completion.service.ts | Current Student/synthetic scope, policy-bound eligibility and producer orchestration. |
| CREATE | apps/api/src/modules/progress/completion.repository.ts | Transactional evidence verification/fences, effective reads, completion and owned proof. |
| CREATE | apps/api/src/modules/progress/completion.controller.ts | Existing HTTP envelopes and sanitized service adaptation only. |
| CREATE | apps/api/src/modules/progress/completion.schema.ts | Strict commands, allowlisted DTOs/blockers and safe graph projection validation. |
| CREATE | apps/api/tests/completion.test.ts | Focused eligibility, persistence, authority and failure controls. |
| CREATE | apps/api/tests/completion-routes.test.ts | New route, early-error, validation, secrecy and rate-limit contracts. |
| CREATE | apps/api/tests/completion.integration.ts | Prepared separately gated disposable transaction/concurrency suite. |
| CREATE | apps/api/src/modules/progress/completion-request.model.ts | Strict append-only private request receipt and declared index. |
| MODIFY | docs/API_DESIGN.md | Owner-approved additive Slice 2 HTTP/DTO/error/security contract, after implementation approval. |
| MODIFY | docs/DATABASE_DESIGN.md | Owner-approved v2 summary/request/index and compatibility amendments. |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md | Actual partial Slice 2 evidence only; F038 stays IN_PROGRESS. |
| MODIFY | docs/features/F038-completion-rules.md | Plan, reconciliation, implementation and later gated evidence. |
| MODIFY | apps/api/src/app.ts | Exact-path early no-store/scoped body bound and optional completion-service injection. |
| MODIFY | apps/api/src/modules/progress/progress.model.ts | Preserve strict v1; add strict v2 and branch validation. |
| MODIFY | apps/api/src/modules/progress/progress.repository.ts | Mixed-version activity preservation and genuine qualifying-score summary support. |
| MODIFY | apps/api/src/modules/progress/progress.routes.ts | LOCAL-only scoped Student routes; preserve existing activity GET. |
| MODIFY | apps/api/src/modules/progress/progress-rate-limit.ts | Shared GET limits and dedicated bounded completion-command limit. |
| MODIFY | apps/api/tests/progress-model.test.ts | v1/v2 strict schema and immutable identity compatibility. |
| MODIFY | apps/api/tests/progress.test.ts | Count/time reconciliation, score provenance and completion preservation. |
| MODIFY | apps/api/tests/progress-routes.test.ts | Unchanged five-field activity contract/headers/limits across both versions. |

Reuse accepted Slice 1's sealed qualificationAuthority, current policy checks,
COMPLETION_INPUT records and immutable F036 attempts. READ and VISUALIZE producers
exist. EXAMPLE and optional REVISE also exist now: explicit section=EXAMPLE/REVISE
in createSectionEvidenceService, additionalAcknowledgementStore, strict v3 records
and section digests. They remain activity producers, not comprehension proof.
No missing Example/Revise producer is assumed or invented.

No additional path is currently required. Keep the trusted adapter in the new
completion service/repository; reuse existing low-level parsers, authority/fence
methods and current publication queries without editing accepted Slice 1 files.
Do not call the standalone actions() transaction from inside a completion
transaction: selected evidence must be verified in the caller's own session.
No completion DTO/helper file, public Admin authoring route, new enrollment store,
configuration variable, dependency or infrastructure is proposed. STOP for scope
approval if implementation reveals a missing adapter or unavoidable extra path.

### 32.2 Trusted eligibility and invalidation

1. Authenticate through existing JWT middleware and revalidate current ACTIVE,
   email-verified STUDENT; owner comes only from verified authentication. Require
   server LOCAL, published Concept/full ancestry and exact references. Resolve
   server-owned question/policy locators, then the exact owner/question runtime
   origin; locators or persisted sourceEpoch are never origin authority.
2. Require the sealed, live generation-bound Option B authority and its exact
   independently approved current 70% Concept policy/rubric/checkpoint bindings.
   Concept > Topic > Learning Path > 70 remains canonical, but unsupported
   inheritance/default qualification is inactive. No existing/imported identity,
   enrollment assertion, caller threshold or historical exposure qualifies.
3. Discover at most 32 owned candidate receipts per required non-Practice section
   plus one overflow sentinel; reject excessive/malformed/contradictory records.
   Check current producer/policy versions, exact owner/Concept/snapshot bindings,
   consumed challenge/receipt cross-links and issuance at/after policy approval.
   Acknowledgement must precede original five-minute expiry; the consumed receipt
   may remain usable afterward under approved D6 while source/authority stays
   current and the linked challenge is not withdrawn. Choose earliest valid
   action timestamp then _id, inspecting all bounded candidates. Require correct,
   independently reviewed VISUALIZE interaction, never playback completion.
4. Load the one current owned COMPLETION_INPUT v2 assessment and original F036
   first attempt. Verify exact immutable submission/request, current rubric/audit,
   private solution/public revision, sealed policy/sourceEpoch and atomic
   first-submission provenance. Use the existing exact assessment/attempt proof
   contracts. Never select DIAGNOSTIC, ungraded, historical/unknown-origin or later
   reveal-assisted attempts. Genuine score is 0 or 100; at threshold 70 only 100
   passes. No grading, best/latest retry selection or new assessment is performed.
5. Only after trusted checks construct ephemeral Stage A inputs: subject IDs and
   current Concept digest; policy id/version (canonical decimal version string),
   explicit required sections/70; verified action references and graded Practice
   candidate. Run evaluateCompletionPolicy unchanged. Adapter VERIFIED/COMPLETED
   means the approved action meets this policy, not comprehension; never rewrite
   producer ACTIVITY_ONLY/NOT_ESTABLISHED records or return a certificate.

GET builds a consistent read-only effective view, without origin creation,
migration, backfill, repair or fence writes. Missing eligible actions/grade produce
INELIGIBLE. A missing supported policy may produce the Section 30.6 safe
INELIGIBLE view only after independent live synthetic-scope verification; it never
activates fallback. Unknown/nonowned resource scope is hidden; lost/unverifiable
origin, corrupt policy or unavailable indexes fail closed. A stale/revoked stored
claim is reported STALE/REVOKED rather than trusting root COMPLETED. Terminal
policy/rubric/definition/withdrawal restrictions invalidate their bound claim;
another valid receipt cannot silently substitute into it. New eligible sources
require a new explicit completion request. Content hashes prove current equality,
not publication history or detection of edit/restore ABA; no new global guarantee
is claimed. Generation loss cannot restore authority from persisted records.

### 32.3 Canonical persistence, scores and transaction protocol

Preserve studentProgress v1 exactly. Add the strict v2 root allowlist from 30.4:
_id,userId,conceptId,technologyId,learningPathId,moduleId,topicId,attemptCount,
status,startedAt,lastActivityAt,createdAt,updatedAt,schemaVersion,sections,
firstScore,latestScore,bestScore,completedAt,completion. Identity fields remain
immutable BSON ObjectIds; times remain ordered server dates/counts remain exact.
sections has exactly five booleans: readCompleted,visualizeCompleted,
exampleCompleted,practiceCompleted,reviseCompleted. Scores are null or genuine
0/100; completedAt is null or a server date; status is IN_PROGRESS or COMPLETED.

completion is null or exactly policyId,policyVersion,policyFingerprint,
conceptRevision,sourceEpoch,decisionVersion,requiredSections,sectionReceipts,
assessmentId,attemptId,minimumScore,selectedScore,requestReceiptId. Use canonical
BSON references, lowercase 64-hex digests, positive safe versions, exact 70
threshold and genuine score. sectionReceipts has at most four unique
{section,receiptId} non-Practice pairs. A completed claim requires complete current
coverage and passing provenance; section flags reflect the explicit bound claim,
not page visits. No mastery/completion-percentage field or alternate summary.

progress.repository.ts must accept both versions while retaining F037 exact
attempt count/min/max reconciliation. New qualifying F036 transactions already
insert their assessment before progressAfter; use that existing hook to create
v2 with genuine score summaries atomically, still IN_PROGRESS with false flags
and null completion/completedAt. Do not edit the attempt repository or reset its
FIFO/budgets. Ordinary ungraded writes preserve v1 or all existing v2 completion
fields; they never invent grades, downgrade v2 or erase a claim. Existing v1
Slice 1 qualifying data may be upgraded only by explicit current-proven completion,
not GET/backfill. Summary first/latest/best uses genuine owned qualifying history
only, bounded by ten policy versions plus one overflow/corruption sentinel,
evaluatedAt/_id ordering; it is not an eligibility shortcut. Preserve first score,
including 0. F037's five-field GET remains activity-derived even when stored v2
status is COMPLETED. Corruption or inconsistent history refuses, not repairs.

Add append-only completionRequests exactly as 30.4:
_id,userId,conceptId,policyId,policyVersion,conceptRevision,viewRevision,
requestKeyHash,requestFingerprint,summaryId,decisionVersion,committedAt,
schemaVersion=1. No raw key, answer, rubric, content or score copy. Its only new
secondary index is uq_completion_request_owner_key, ordered
{userId:1,requestKeyHash:1}, unique=true, v=2, simple binary semantics, no
partial/sparse/hidden/TTL/collation/alternate options. Completion operations require
the exact thirteen-index allowlist in 30.4 (the twelve verified prerequisites plus
this index); missing/incorrect/unverifiable readiness returns sanitized 503 before
writes. Original ordinary F036/F037 readiness sets remain intact. No autoCreate,
autoIndex, runtime/persistent provisioning or migration.

POST complete owns one snapshot/PRIMARY transaction with majority+journal commit,
the inherited ten-second budget, three callback bodies and two-second proof
reserve. No nested transaction, operation-timeout override or unlimited retry.
Resolve/fence current policy first, then rubric authority, visualization definition
and selected challenges in stable identity order, then summary CAS. Recheck all
evidence in this session and run Stage A; write the versioned canonical claim and
request receipt atomically. Existing producer/revocation writers share those
underlying CAS fences; immutable attempts/assessments/receipts are not rewritten.
Preserve unrelated activity fields, counts and times during completion CAS.

Keys are account-wide hashes; fingerprint binds command domain, authenticated
owner, Concept and frozen public viewRevision. Same-key/same-body replay returns
only its original owned majority-proven effective decision; changed body conflicts.
Different keys cannot duplicate/overwrite an equivalent current claim: a new
receipt may refer to its existing decisionVersion, without resetting completedAt,
scores/counts or the claim's original requestReceiptId. Superseded/stale/revoked
decision replay conflicts, never resurrects; a new decision needs a new key and
fresh eligibility. Different accounts never share identity.

After commit primary-majority prove the exact owned request receipt, current
summary completion decision/version and original claim-receipt cross-link, owned
attempt/assessment, chosen source links and fresh authorization/authority. Current
activity changes are not permission to substitute a different completion claim.
Unknown commit, missing/mismatched proof, lifecycle loss, deadline or cleanup
failure suppresses success; never imply rollback solely from a thrown response.
Do not reuse Slice 1 queue completion or any cached response as durable proof.

### 32.4 Exact proposed HTTP and safe output

Implement only Section 30.6's four routes, registered server-side in LOCAL under
the existing progress router. Normal app construction does not create synthetic
identities, seal origins or bypass trusted setup.

| Method/path | Strict input | Successful data |
| --- | --- | --- |
| GET /api/v1/progress/completion | Scalar conceptId query only; no body/extra fields. | Exact nine-field completion view below. |
| POST /api/v1/progress/completion/:conceptId/challenges | Empty query; one canonical UUID-v4 Idempotency-Key; body {section}. | {section,challenge}, exact existing producer issue DTO. |
| POST /api/v1/progress/completion/:conceptId/responses | Empty query/key as above; body {challengeId,acknowledged:true} OR {challengeId,selectedChoiceId}. | {section,receipt}, existing activity DTO; NOT_ESTABLISHED. |
| POST /api/v1/progress/completion/:conceptId/complete | Empty query/key as above; body exactly {viewRevision}. | Nine-field view with current COMPLETED only after owned durable proof. |

The server selects the required definition; it verifies URL Concept, current
policy, owner and section before invoking READ/EXAMPLE/required-REVISE or C3b
commands. Reject cross-Concept challenges, optional/unconfigured actions and
client-provided definition, owner, expected choice, rubric, score or evidence
claims. Preserve correct/incorrect consumption, invalid non-consumption,
five-minute expiry, one-active/three-issue limits and exact replay semantics.
No public withdraw/Admin/assessment/attempt-history route is added by inference.

Nine data fields, with exact nested enums/allowlists already specified in 30.6:
conceptId,viewRevision,requiredSections,sections,practice,eligibility,blockers,
completion,visualization. practice is exactly questionId,type,status,score,
minimumScore; completion is exactly status,completedAt; visualization is null or
{id,graph} with a bounded safe authored renderer projection. Build graph data in
the new repository/schema from current approved records, never from a fixture or
private expected-choice projection. Missing score is null, never guessed 0.
viewRevision hashes public safe source/configuration only, never private solution
fingerprints. No account IDs, submitted/correct answers, rubric values, private
fingerprints, approval provenance, raw keys or internal records reach the DTO.

Preserve existing envelopes/errors. Add only fixed-message 409
COMPLETION_INELIGIBLE, COMPLETION_VIEW_CHANGED, COMPLETION_IDEMPOTENCY_CONFLICT,
COMPLETION_RECEIPT_UNAVAILABLE and 503 COMPLETION_COMMIT_UNCONFIRMED. Preserve
existing C2/C3b and dependency/auth/validation errors. Blockers are Stage A's
allowlisted codes plus exactly Section 30.6's six adapter codes and canonical
section, ordered by its documented precedence. No new error-details shape: GET
supplies safe blockers; POST errors expose no source documents or driver details.

app.ts must add exact method/path no-store matching before CORS/JSON, including
invalid-ID, malformed/oversized, authentication and CORS errors. Scoped completion
POST parsing enforces 4 KiB uncompressed JSON before the existing 256 KiB global
parser; reject unsupported encodings/media types through existing sanitized
errors and enforce streamed/chunked bounds, not Content-Length alone. No broad
prefix, permissive CORS or global parser/error behavior change. Empty GET bodies
and strict query/duplicate-header/extra-field rejection remain mandatory.
Share existing 300/IP and 120/subject GET per 15 minutes with F037; completion
POSTs share dedicated 30/subject per 15 minutes plus existing IP guard. Replays
count. Existing required ProgressLimits fields and call sites stay compatible;
any test override is optional/defaulted, with no environment addition. Fixed
route labels and existing safe logging never log keys, tokens, bodies or answers.

### 32.5 Proposed canonical amendments requiring implementation approval

Do not edit canonical documents in this planning gate. Approval must explicitly
cover these additive refinements, with schemas/tables above and 30.4/30.6 included:

- API_DESIGN.md, append after its Slice 1 refinement: "F038 Slice 2 adds only the
  four LOCAL authenticated Student completion routes specified in F038 Section
  32.4. Authority is server-established, generation-bound synthetic origin under
  accepted Option B, not physical storage attestation. Current policy-bound owned
  actions and the original qualifying assessment precede explicit durable Concept
  completion. Exact DTOs, validation, no-store and rate limits are as Section 32.4;
  F037 activity GET and F036 submission/answer contracts remain unchanged."
- DATABASE_DESIGN.md, append to studentProgress/F037 and the Slice 1 refinements:
  "Preserve strict v1 and add exactly the canonical v2 root/claim fields and
  score-provenance rules in F038 Section 32.3. F036 activity writers preserve v2
  decisions; F037 GET remains activity-only. Effective completion is revalidated;
  stale/revoked claims never assert current completion and GET never repairs them."
- DATABASE_DESIGN.md, private receipts/indexes: "Add only append-only
  completionRequests and uq_completion_request_owner_key as Section 32.3 for
  durable account-key request history, not alternate completion state. Summary and
  request writes share majority-confirmed transactions and owned proof. No index
  provisioning, backfill, TTL, retention worker or persistent-use approval."
- DATABASE_DESIGN.md, section-evidence compatibility: "Existing EXAMPLE/conditional
  REVISE v3 acknowledgement branches retain distinct producer namespaces/digests
  and ACTIVITY_ONLY receipts. Slice 2's trusted adapter qualifies current owned
  actions only for the approved policy; it never rewrites producer claims or
  infers comprehension. READ v1 and VISUALIZE v2 remain unchanged."

No PRD edit, Topic/Path authority activation, mastery, new policy model, new public
grading endpoint or change to immutable Practice attempts is proposed. PRD 14
Topic aggregation remains outside this explicitly approved Concept subset.

### 32.6 Verification, blockers and next approval gate

Implementation/offline acceptance must cover exact v1/v2/request schemas, all
four required sections and conditional Revise, genuine 100/0 versus threshold 70,
missing/malformed/overflow/stale/revoked evidence, origin/generation loss, independent
current authority and unchanged Stage A semantics. Include GET nonmutation,
post-expiry consumed-receipt validity, withdrawal/revocation fences, exact replay,
cross-account/Concept isolation, changed frozen view, concurrent same/different
keys, atomic rollback, superseded decision, proof loss/uncertain commit/cleanup,
limits and preserved first/count/time/score invariants. Assert no answer/rubric
leakage, activity-count or DIAGNOSTIC promotion, new score generation or mastery.

Focused suites use completion.test.ts/completion-routes.test.ts and the three
approved progress test files. Run relevant F036/F037, Slice 1 qualification/FIFO,
Auth, section/checkpoint and Practice regressions; API build, source/test
TypeScript, lint, formatting, UTF-8/LF, exact-scope/security and diff checks.
Test exact early parser/CORS/no-store and unrelated-route compatibility without
changing shared middleware. Perform separate CRITICAL/HIGH/MEDIUM/LOW diff review
with actual affected-file/line findings; unresolved findings stop for disposition.

Prepare completion.integration.ts with explicit full thirteen-index allowlist and
synthetic fixtures. Execution/provisioning requires separate owner approval after
offline PASS, with existing unelevated retained-native-handle/exact-Job,
microsecond UTC, PRIMARY/empty disposable target and protected-baseline procedures.
Prove real transaction/concurrency/rollback/read-only behavior once; controlled
proof loss remains distinct from real failover. No database access is authorized
by this plan. No test/build/service/browser execution occurred during planning.

No essential evidence producer is missing in the accepted bounded subset. The
transactional adapter, v2 writer compatibility, request history and four HTTP
wrappers are the work of this slice, not already implemented functionality.
Trusted synthetic setup and current approvals are runtime prerequisites; ordinary
startup/persistent demo data cannot substitute. Student credential provisioning,
accessible UI and twelve proposed browser cases remain Slice 3 dependencies.
Privacy/retention/erasure/backups, real-person enrollment/migration, persistent
index operations, multi-process/failover and production release remain pending.

All **141 existing browser scenarios remain NOT_RUN**. Slice 2 adds no mounted
browser cases; the twelve proposed Slice 3 cases remain unimplemented. No exception
transfers. This plan does not approve Slice 3, production deployment or F039.

Next owner gate: approve/revise this exact 20-path Slice 2 implementation boundary,
the exact additive canonical amendments, v2/request/index and effective-invalidity
contracts, then explicitly authorize implementation and offline verification only.
No extra path is presently needed; STOP for approval if that changes. F038 stays
**IN_PROGRESS**; F001-F037 approval history and F039 NOT_STARTED are preserved.

## 33. Slice 2 implementation and offline verification - partial F038

### 33.1 Owner authorization and reconciliation PASS

The attached Slice 2 implementation approval explicitly authorizes Section 32's
twenty paths and additive canonical amendments. Required READ, VISUALIZE,
EXAMPLE and conditional REVISE producers exist; no producer, grading authority,
enrollment assertion or historical qualification was fabricated. Current sealed
Option B origin, independently reviewed 70% Concept policy, full published
ancestry and original owned qualifying assessment remain mandatory. Stage A and
all accepted Slice 1 implementation files outside this twenty-path boundary are
unchanged. Topic/Path inheritance remains inactive; no lower-policy fallback.

**SLICE 2 IMPLEMENTATION AND OFFLINE VERIFICATION PASS - PARTIAL F038.**
This is not live MongoDB verification, Slice 2 final acceptance, full F038
completion, browser verification or production readiness.

### 33.2 Implemented scope and behavior

Exactly Section 32.1's **20 paths changed: eight creations/twelve modifications**;
no additional source/configuration/dependency path. The eight planned creations
now exist, including the prepared-only completion.integration.ts. No path was
edited just to fill the inventory. The progress route regression adds a genuine
composition check that completion routing leaves the activity service/envelope
independent. No Slice 3 or F039 implementation is included.

Implemented strict v1/v2 studentProgress branches and append-only private
completionRequests, declared unique owner/key index and exact thirteen-index
readiness. There is no automatic index/collection provisioning. Canonical API and
Database changes are additive Section 32.5 refinements; existing document bytes
are retained as exact prefixes. PRD, System Architecture and existing Auth,
Practice answer/receipt and F037 five-field activity contracts remain intact.
The roadmap records actual partial evidence while keeping F038 IN_PROGRESS.

The new LOCAL Student APIs validate current authorization, live synthetic scope,
approved policy and exact source bindings. GET and explicit completion derive
eligibility from real section records and the original COMPLETION_INPUT attempt/
assessment, invoking unchanged Stage A with transient trusted metadata. Producer
receipts remain ACTIVITY_ONLY/NOT_ESTABLISHED. No DIAGNOSTIC promotion, grading,
answer disclosure, comprehension claim or mastery is added by completion APIs.

Completion commits the canonical bound decision and private request atomically,
with policy/rubric/definition/selected-challenge fences, bounded snapshot-majority
transactions and independent current owned proofs. Original request proof is
required even on reads; an orphaned root COMPLETED flag is insufficient. An
equivalent current decision can append another key receipt without resetting
completedAt/counts/scores or replacing its original request reference. Changed
requests conflict; superseded/revoked/stale decisions cannot be recovered from an
old key. Same-key completion uses the existing LOCAL process gate under a distinct
hash domain only as contention control, with completion-specific sanitized errors,
the original deadline and independent follower proofs. No cached result is an
authorization credential; no new coordination mechanism/index is introduced.

F036's existing assessment-before-progress hook now lets the approved progress
writer maintain genuine v2 scores in the same transaction. Ordinary ungraded
activity preserves completion fields and first score; GET does not migrate,
backfill or repair. F037 continues to report activity-derived NOT_STARTED or
IN_PROGRESS, even when a v2 stored decision is COMPLETED. Effective completion is
revalidated separately and stale/revoked sources cannot assert current completion.

Exact matching early no-store and the new 4 KiB uncompressed streamed JSON bound
precede applicable parser errors; existing global parsing/CORS/security behavior
and unrelated paths are preserved. New routes reject non-STUDENT claims before
body validation, then services revalidate current eligible accounts. Public DTOs
are strictly allowlisted, graph data contains no private checkpoint fields, and
errors/logging contain no answers, raw keys, rubric bodies or driver documents.

### 33.3 Actual offline checks and retained initial failures

| Check | Actual result |
| --- | --- |
| Focused completion/model/progress/API suites | **57 PASS / 0 FAIL** across completion.test.ts, completion-routes.test.ts, progress-model.test.ts, progress.test.ts and progress-routes.test.ts. |
| Relevant existing API regressions | **378 PASS / 0 FAIL** across eighteen disjoint files, including F036/F037 compatibility consumers, Slice 1 qualification/FIFO, Practice/Auth, section/checkpoint/grading and Concept models. |
| Distinct selected tests in this gate | **435 PASS / 0 FAIL**. Repeated development/review subsets are not added again; this is not a full-workspace suite count. Earlier Slice 1 405/229/31+35 evidence is retained, not summed into this number or claimed rerun frontend coverage. |
| API build / source and test TypeScript | PASS; includes static checking of the prepared integration file. |
| ESLint / Prettier | PASS for the sixteen approved TypeScript paths. |
| Browser specification static compilation | PASS using ESNext/Bundler resolution for existing specs/config; no Playwright import execution or browser launch. |
| Canonical/history/scope/encoding | Exact twenty-path scope, unchanged nonallowlisted source, canonical prefix/history preservation, UTF-8/LF and new whitespace/diff checks PASS. |
| MongoDB | **NOT_RUN**. Ten prepared records (nine children plus parent); thirteen declared index definitions, no provisioning or database connection in this gate. |
| Browser | **141 existing scenarios NOT_RUN**; twelve proposed Slice 3 cases remain unimplemented/unmounted. No inherited exception. |

Initial focused verification returned **45 PASS / 2 FAIL**. One new test exposed
Admin requests reaching request-body validation before role rejection; scoped
Student middleware now rejects them first without changing current-account
service checks. The other test incorrectly expected health to have no cache
header; existing health already explicitly uses no-store. Its expectation was
corrected and an unrelated malformed API request separately verifies no new
cache-header spillover. Existing tests/security assertions were not weakened.
The next focused run passed 52, then 55 after additional native/compatibility
checks, and the final post-review run passed 57; these are overlapping runs.

Early TypeScript corrections stayed within scope: use the existing fenceVisual
method, a strict branch-validated Mongoose storage type, and exact optional-property
handling. Initial lint flagged throwing from finally and two unused test values;
cleanup now collects failure before returning and never overrides failure with
success. Initial browser static invocation used NodeNext resolution, incompatible
with the existing extensionless Playwright config import; transient ESNext/Bundler
compiler arguments passed without any configuration/spec edit. These are retained
offline diagnostic limitations/corrections, not MongoDB or browser outcomes.

Focused tests include same-key coordination/error mapping and independent proof;
orphaned/wrong-owner/superseded request refusal; exact index option enforcement;
GET nonmutation; conditional Revise and passing/zero/missing-grade cases;
rollback/uncertain commit/cleanup refusal; actor/account isolation; early parser,
CORS, streamed size, no-store and shared rate limits. Direct native-validator
tests use disconnected in-memory adapters: consumed READ evidence remains usable
after response expiry while current, withdrawal/forged ownership refuses, the
33rd receipt is an overflow refusal, and postcommit proof commands preserve the
remaining timeout/primary-majority options. These are not live database tests.

### 33.4 Separate formal source/security diff review

Review covered all twenty approved paths against the pre-gate snapshots and
accepted contracts: current authority and origin, complete publication/binding,
Stage A authenticity boundary, raw source cross-links, historical score integrity,
transaction/rollback/retry/deadline behavior, primary-majority proofs, idempotency,
read-only effective invalidation, strict output/parser/cache/rate behavior,
F036/F037 compatibility, canonical additions and exact scope.

| Severity / ID | Actual finding and disposition |
| --- | --- |
| MEDIUM S2-R1 - RESOLVED | completion.repository.ts:659 originally omitted the direct receipt.definitionId versus challenge.definitionId comparison in VISUALIZE verification. It now refuses contradictory metadata before correctness/qualification. completion.test.ts's native Visualize-definition-ID case passes with valid evidence and refuses a forged receipt reference even when the other bindings/hash match. |
| MEDIUM S2-R2 - RESOLVED | completion.repository.ts:833 originally reused the F037 activity helper during postcommit proof, where no inherited transaction CSOT deadline remained. The proof branch now explicitly supplies dynamic remaining timeout, primary preference and majority read concern to each hierarchy/stat/summary command. The native postcommit-proof test verifies all three commands and no deadline reset. Existing F036/F037 helpers/budgets were not changed. |
| CRITICAL / HIGH / LOW | No finding identified in the final scoped review. |

Final unresolved findings: **CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 0**.
All corrections stayed within the approved paths and preserve the ten-second,
three-body and two-second reserve contract. No application proof relies on a queue
handoff, root status, client threshold/approval flag, raw Mongoose selection or an
ungraded/DIAGNOSTIC row as completion authority. No production data protection,
database WORM, instantaneous global revocation or publication-history guarantee
is implied. Controlled proof-loss tests are not real MongoDB failover evidence.

### 33.5 Integration readiness, remaining limitations and next gate

completion.integration.ts is excluded from offline *.test.ts execution. It
prepares synthetic fixtures through the real trusted creator, independent policy/
rubric/checkpoint approval and original F036 submission. It declares exactly the
twelve prior prerequisite definitions plus uq_completion_request_owner_key.
Cases cover incomplete evidence/GET nonmutation, explicit durable completion and
owned replay, concurrent identical keys, failed grade/required Revise, withdrawal,
terminal revocation, atomic request failure/controlled proof loss, index refusal
and account isolation/secrecy. The planned missing/nonunique-index controls alter
only the disposable request-index state and require explicit authorization in
the separate guarded integration gate; no such state was provisioned here.

Before any execution require fresh owned Job/native retained-handle identity,
ordinary unelevated context, common-microsecond UTC checks, port 27018 free,
127.0.0.1:27018/f021-test/deeplearner-f021-test writable PRIMARY/empty exclusive
target, exact full index allowlist and protected-baseline/graceful-cleanup checks.
No live transaction, concurrency, index or durable completion claim follows from
this offline PASS. Multi-process convergence and real failover remain unverified.

Ignored local evidence: .cache/f038-slice2-offline-2026-10-20-12-57-40, with
twenty-path allowlist, pre-gate source/document snapshots, sanitized initial/final
focused logs and regression output. No connection credentials, expected answers,
submitted answers or session tokens are included in those sanitized logs.

Slice 3 Student credential/test setup, accessible completion UI/controller and its
twelve new browser scenarios remain outstanding. Existing **141 browser scenarios
remain NOT_RUN**. Persistent enrollment/migration, privacy/retention/linked erasure
and backups, persistent index operations and browser/release readiness require
separate approval. No dependencies, infrastructure, Git delivery, production or
F039 implementation was introduced. F001-F037 APPROVED_COMPLETE history remains
unchanged. **F038 remains IN_PROGRESS**; neither full-feature READY_FOR_REVIEW nor
APPROVED_COMPLETE is asserted.

Next owner gate: review these offline changes and authorize one ownership-safe
disposable Slice 2 MongoDB integration with the exact thirteen-index allowlist
and explicit refusal-control states. Do not automatically run it, finalize Slice
2, begin Slice 3, commit or push.

### 33.6 Guarded integration authorization preflight BLOCKED before startup

The owner authorized one guarded Slice 2 execution, conditional on all index
definitions matching the thirteen approved canonical definitions exactly, with
STOP required for ambiguous, unexpected or unapproved definitions. Static source
inspection found an unresolved refusal-control authorization boundary before any
MongoDB process, database connection, provisioning or test invocation.

The normal completionIndexes declaration retains Section 31.6's twelve unchanged
prerequisites and adds only completionRequests/uq_completion_request_owner_key:
ordered {userId:1,requestKeyHash:1}, UNIQUE, v2/simple binary semantics, with no
partial filter, sparse, hidden, TTL, explicit collation or alternate options.
The canonical definition and strict readiness verifier match Sections 32.3/32.5
and Database Design's Slice 2 amendment. Normal thirteen-index provisioning is
not the discrepancy; no canonical index change is proposed.

completion.integration.ts:496-525 also deliberately drops this request index,
tests its absence, recreates the same name/key with unique:false, expects a
sanitized DEPENDENCY_UNAVAILABLE refusal, then restores unique:true in finally.
That nonunique fault state differs from the exclusively approved canonical
definition. Section 33.5 explicitly requires separate authorization for the
missing/nonunique control states; the current gate does not explicitly grant
that exception to its exact-definition-only restriction. The ten-record suite
cannot run unchanged without reaching this state. No test was skipped, modified
or executed, and no index-readiness rule was weakened.

Actual result: **authorization preflight BLOCKED; isolation preflight NOT_RUN;
index provisioning NOT_RUN; integration NOT_RUN (zero invocations, zero executed
records, no PASS/FAIL count)**. No owned Job, child process, database connection
or disposable storage was created, so shutdown, exit-code, handle, port-release
and storage-disposal checks are not applicable. Protected baselines were not
live-reverified; this gate performed no process/database operations against them.
The sole repository change is this appended evidence; prior implementation,
verification results and historical failures remain unchanged.

Next owner gate: explicitly authorize temporary removal and nonunique recreation
of only completionRequests/uq_completion_request_owner_key inside the verified
disposable target for the existing refusal control, followed by restoration of
its exact canonical UNIQUE definition and one guarded execution. No application,
test, canonical-contract or additional-file correction is requested. F038 remains
**IN_PROGRESS**, pending live integration and separate Slice 2 final review.
F001-F037 approval history remains intact; **141 browser scenarios NOT_RUN** and
the twelve proposed Slice 3 cases remain unimplemented. No production readiness,
Slice 3 or F039 work is implied.

### 33.7 Owner-approved index controls and single guarded integration PASS

The owner explicitly authorized the existing disposable missing/nonunique request
index control and exact UNIQUE restoration. This resolves Section 33.6's gate;
that historical BLOCKED preflight remains unchanged and involved zero startups or
test invocations. This gate invoked completion.integration.ts exactly once, with
all original fixtures/assertions unchanged and no suite-invocation retry. No
application, test, configuration, dependency or canonical-document edit occurred.

**SLICE 2 GUARDED MONGODB INTEGRATION PASS: 10/10 records, 0 FAIL, 0 skipped,
0 cancelled (nine children and the parent).** Actual Node test duration was
38,751.9725 ms. This is live disposable service/repository verification, not a
browser run, HTTP wire test, full-feature acceptance or production approval.

#### Isolation, authority and exact index allowlist

The established temporary in-memory runner targeted Slice 2's prepared file and
thirteen-index manifest. A runner-only abort signal stops remaining records if
the negative-control child fails; it was not triggered. No test expectation,
transaction budget, retry policy or ownership safeguard was changed.

Ordinary REDGOLDMARK42\Shreeji execution was verified with Administrator disabled.
Port 27018 was initially free; no prior disposable process/storage remained.
Fresh exclusive storage and an empty exact owned Job preceded one MongoDB
startup. Eight retained/independent native-handle and CIM observations all PASS:
PID, exact native creation identity, executable, parent, owner/SID, exact Job and
live state. Raw timestamps are retained. Both UTC values were truncated by
ticks-(ticks%10) to the same one-microsecond precision; no tolerance was added.
MongoDB's raw native/CIM creation values were both
2026-10-20T14:40:35.5102120Z. A child example retained native
2026-10-20T14:40:38.9544548Z and CIM 2026-10-20T14:40:38.9544540Z,
with equal normalized UTC ticks 639281040389544540.

Before fixture/index writes, the initializer verified exact loopback bind/port
127.0.0.1:27018, replica set f021-test, one member, expected owned dbPath,
writable PRIMARY, only system databases and an empty deeplearner-f021-test target.
Its owned client closed and initializer exited 0 before the one suite invocation.
The suite independently repeated server/replica/empty-target validation.

Exactly Section 31.6's twelve unchanged prerequisite definitions plus the
following thirteenth definition were provisioned before any child scenario:

| Collection | Exact name | Ordered key | Unique |
| --- | --- | --- | --- |
| completionRequests | uq_completion_request_owner_key | {userId:1,requestKeyHash:1} | true |

All thirteen actual definitions matched the approved ordered keys/names and
uniqueness: eleven unique and two nonunique activity-query indexes. v2/simple
binary semantics, no explicit collation, partial filter, sparse, hidden, TTL or
alternate options were verified by the suite. Retained MongoDB createIndexes
observations independently match these thirteen exact application definitions.
Standard _id_ and MongoDB-owned system indexes are separate from this application
allowlist; no persistent target was connected or provisioned.

The negative control dropped only completionRequests/uq_completion_request_owner_key,
observed sanitized 503 DEPENDENCY_UNAVAILABLE on GET while missing, restored
UNIQUE, then dropped it and created the same ordered key/name as nonunique.
GET again refused with DEPENDENCY_UNAVAILABLE. Finally it removed that fault
index and restored the exact UNIQUE definition. Retained index-build/drop
observations confirm the sequence and unchanged v2/key/name/options, including
the final unique:true build. The subsequent cross-account/secrecy child passed
a legitimate completion GET, independently exercising production's exact
all-thirteen-index readiness after restoration. No restoration failure occurred.

#### Actual live scenario results and evidence limits

| Prepared child scenario | Actual result |
| --- | --- |
| Missing required evidence; nonmutating GET | PASS: INELIGIBLE, completion refused, summary unchanged and zero completionRequests. |
| Current Read/Visualize/Example and original qualifying Practice | PASS: ELIGIBLE then explicit COMPLETED, studentProgress schemaVersion 2, one request, attemptCount 1, genuine firstScore 100, exact replay and changed-view/key conflict. F037 still returns five fields and IN_PROGRESS. |
| Concurrent identical completion requests | PASS: equal committed results, one durable request and activity count 1. |
| Zero qualifying score and required Revise | PASS: score 0 cannot complete; policy-required Revise remains ineligible until its actual acknowledgement. |
| Withdrawn bound Read receipt | PASS: effective REVOKED with no GET repair/write to the stored summary. |
| Terminal Concept-policy revocation | PASS: effective REVOKED and old-key replay refused. |
| Request-write failure and controlled proof loss | PASS: transactional summary rollback, suppressed success on missing owned proof, then exact original-key recovery through real verified proof. |
| Missing/nonunique request-index controls | PASS: sanitized dependency refusal and canonical UNIQUE restoration/readiness as above. |
| Cross-account access and safe view | PASS: foreign source access rejected and tested private answer/rubric/identity fields absent. |

Real services exercised current eligible STUDENT ownership, approved synthetic
origin, published ancestry, reviewed 70% Concept policy, trusted section producers,
original qualifying assessment, unchanged Stage A and majority-confirmed owned
completion/request proofs. No new score, assessment promotion, expected-answer
disclosure, mastery or automatic completion was introduced. The existing F036
attempt and F037 activity contracts remained in use without rewriting attempts.

Controlled proof-loss injection is not real MongoDB failover. Multi-process
convergence remains unverified. Deliberate content-revision-change invalidation,
negative role/LOCAL controls, HTTP parser/CORS/no-store/rate-limit behavior and
the complete DTO allowlists retain their offline evidence; this service-level
suite does not upgrade them to separate live HTTP/browser checks. No passing
offline suite was rerun in this gate.

#### Cleanup, protected baselines and next gate

All four supervised process exits were observable and **0**: MongoDB PID 15632,
initializer PID 27500, integration PID 13880 and shutdown helper PID 7984.
Connections closed; the target-verified shutdown helper sent graceful shutdown.
Forced termination: **false**; cleanup errors: **none**. Exact Job empty, port
27018 released, retained handles closed and verified owned storage removed: PASS.
Protected MongoDB/development process identities, selected listening ports and
persistent demo-storage path/size/timestamp metadata matched their pre-run
baselines. Protected database contents were not queried. All pinned repository
sources were unchanged during execution; only this evidence is appended afterward.

Retained ignored evidence:
.cache/f038-slice2-integration-2026-10-20-14-40-31-c1d326, including context,
raw/normalized identity observations, protected baselines, exact index manifest,
sanitized per-record outcomes, MongoDB index observations, exit and cleanup
records. Historical failed/blocked runs and 57 focused + 378 regression offline
PASS evidence remain intact and are not added to this ten-record live count.

**F038 remains IN_PROGRESS.** Slice 2 is ready for a separately authorized final
source/security/architecture review; it is not self-accepted or full F038
READY_FOR_REVIEW. Slice 3 Student UI/credential setup and twelve proposed browser
cases remain unimplemented. Existing **141 browser scenarios remain NOT_RUN**.
Privacy/retention/linked erasure/backups, persistent enrollment/migration/index
operations, real failover, multi-process and browser/release prerequisites remain
pending. F001-F037 approval history is preserved; no F039 work or Git delivery.

### 33.8 Slice 2 final source, security and architecture review PASS

**SLICE 2 FINAL REVIEW PASS — PARTIAL F038**

This owner-authorized, bounded final review inspected all actual Slice 2 changes
against the retained pre-implementation snapshots, Sections 30/32/33, accepted
Option B and canonical PRD/API/Database/System Architecture contracts. It included
the eight new files, all twelve modified files, native source validators, routes,
models, test assertions and additive documentation. No test, service, MongoDB,
browser or synthetic execution was performed in this review. Prior acceptance
evidence was inspected, not rerun or upgraded.

| Severity | Final unresolved findings |
| --- | --- |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

No new actionable finding was identified. Section 33.4's two historical Medium
findings remain resolved: direct Visualize receipt/challenge definition identity
at completion.repository.ts:659 and explicit remaining-time/primary-majority
postcommit activity proof at completion.repository.ts:833. Their retained focused
regressions remain evidence; no correction was made in this final-review gate.

Review confirmed current eligible STUDENT identity derives from authenticated
context, with fresh account and full publication/ancestry validation. The LOCAL
route/service restrictions, live generation-bound synthetic origin, independently
reviewed current 70% Concept policy and authorized rubric/checkpoint bindings
remain mandatory. Topic/Path/default qualification is not activated. Server-owned
origin is not physical process/storage attestation or protection against external
copying, prior knowledge or privileged tampering.

READ, VISUALIZE, EXAMPLE and conditional REVISE are checked through current owned
producer records, consumed-challenge cross-links, exact revisions/policies and
bounded discovery. Practice uses the original owned COMPLETION_INPUT assessment
and immutable first F036 attempt, with genuine score, request, rubric and origin
proofs. No activity-count, ungraded, historical, reveal-assisted or DIAGNOSTIC
promotion substitutes. The unchanged Stage A evaluator receives trusted transient
inputs only after these checks; producer ACTIVITY_ONLY/NOT_ESTABLISHED claims are
not rewritten or represented as comprehension certificates.

Atomic canonical studentProgress v2 and append-only completionRequests share the
approved snapshot/majority+journal transaction and policy/rubric/definition/action
fences. Account/key fingerprint conflicts, equivalent-decision/new-key handling,
concurrent same-key coordination, three-body/ten-second/two-second-reserve bounds,
rollback and cleanup failure remain fail closed. Each replay requires current
authorization, original request/decision cross-links and fresh exact owned
majority proofs; a stored COMPLETED flag or queue handoff cannot authorize success.
Bound-source withdrawal, terminal revocation and revision mismatches prevent a
claim from asserting current completion; GET does not repair or mutate history.

Exact thirteen-index readiness, strict nine-field/nested DTOs, scoped JSON bounds,
no-store including early errors, shared/dedicated rate limits and sanitized errors
remain enforced. No private answer, rubric, raw key, account record or private
fingerprint reaches the new responses/logging. The F037 five-field activity GET
remains activity-derived; ordinary F036 activity preserves v2 decisions and genuine
score provenance. No attempt rewrite, new grading, mastery or F039 mutation exists.

Canonical amendments are approved and additive: API_DESIGN.md:2160 adds only the
four LOCAL completion routes and safe contracts; DATABASE_DESIGN.md:1396 adds
canonical v2/request history and compatibility rules. Both prior document byte
prefixes are preserved. Existing Auth, Practice and Progress contracts remain
intact; studentProgress remains canonical, no public Admin/grading endpoint is
introduced, and no production or active Topic/Path inheritance claim is made.

Exact source audit reconfirmed **20 paths: eight creations/twelve modifications**,
with no out-of-inventory creation/modification/deletion. All implementation hashes
match the retained post-verification manifest; only this feature document contains
later approved integration/review evidence. This gate appends only this document;
the roadmap, canonical documents, product/test/configuration files and statuses
are unchanged. Historical implementation, blocked-index preflight and subsequent
successful live verification remain intact.

Retained evidence: **57 focused PASS + 378 relevant API regression PASS** (435
distinct selected offline tests); build, source/test TypeScript, lint, formatting,
security and browser-spec static compilation PASS. The single guarded MongoDB run
was **10/10 PASS**, with thirteen canonical indexes, missing/nonunique refusal and
exact UNIQUE restoration/readiness verified. All four supervised exits were 0;
graceful cleanup and protected-baseline checks passed without forced termination.
Section 33.7 retains exact evidence locations and the distinction between live
service tests and offline HTTP/security checks. Controlled proof-loss injection
does not establish real MongoDB failover; multi-process convergence is unverified.

**F038 remains IN_PROGRESS.** Full-feature READY_FOR_REVIEW or APPROVED_COMPLETE
is not asserted. Slice 2 is accepted only as a partial LOCAL foundation and is
ready for separately approved **Slice 3 implementation planning**. Student
credentials/UI integration and the twelve proposed Slice 3 browser cases remain
unimplemented. Existing **141 browser scenarios remain NOT_RUN**; no exception
transfers and no browser PASS is claimed. Production enrollment/migration,
privacy/retention/linked erasure/backups, persistent provisioning, real failover,
multi-process and browser/release verification remain pending. F001-F037
APPROVED_COMPLETE history is preserved; no Slice 3 or F039 implementation, Git
delivery, infrastructure or deployment work is authorized by this review.

## 34. Slice 3 bounded implementation plan - credential prerequisite BLOCKED

### 34.1 Planning boundary and exact baseline inventory

This owner-authorized gate appends only this plan. Slice 1/2 final reviews remain
PASS - PARTIAL F038; F038 remains IN_PROGRESS. No implementation, execution or
status change is authorized here. Section 30.10 assigns Slice 3 exactly these
15 literal baseline paths (IDs 12-24,47,48): nine creations/six modification slots.

| Operation | Literal path | Planned responsibility |
| --- | --- | --- |
| CREATE | apps/web/src/lib/api/completion-client.ts | Four existing completion calls, safe DTO/error validation and bounded cancellation. |
| CREATE | apps/web/src/lib/progress/completion-controller.ts | Account/Concept/view-scoped read and explicit-command lifecycle. |
| CREATE | apps/web/src/lib/progress/completion-contracts.ts | Exact public schemas/envelopes/blockers; no private grading fields. |
| CREATE | apps/web/src/components/concepts/concept-completion.tsx | Accessible completion panel and existing-player integration. |
| CREATE | apps/web/src/components/concepts/concept-completion.module.css | Existing Concept visual conventions and responsive/focus states. |
| CREATE | apps/web/tests/completion-client.test.ts | Strict transport, DTO, cancellation and safe-error cases. |
| CREATE | apps/web/tests/completion-controller.test.ts | Command identity, uncertainty, account/navigation races and server-state authority. |
| CREATE | apps/web/tests/completion-rendering.test.ts | Semantic controls and all public states using existing rendering tools. |
| CREATE | tests/browser/concept-completion.spec.ts | Twelve separately named, prepared-only mounted UI scenarios. |
| MODIFY | docs/API_DESIGN.md | Reserved canonical slot; existing HTTP contracts need no UI-only change. Any credential/setup amendment requires separate approval. |
| MODIFY | docs/DATABASE_DESIGN.md | Reserved canonical slot; no new UI model/index. Any credential/setup amendment requires separate approval. |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md | Actual partial Slice 3 evidence/status limitations after separately approved implementation. |
| MODIFY | docs/features/F038-completion-rules.md | Implementation evidence, review history and actual NOT_RUN counts. |
| MODIFY | apps/web/src/components/concepts/concept-browser.tsx | Mount the keyed panel on a loaded Concept without replacing tabs/activity. |
| MODIFY | playwright.f024.config.ts | Add only concept-completion.spec.ts to testMatch; no execution, timeout/retry/server changes. |

Static inspection: all nine proposed creations are absent and all six existing
modification slots exist. Every literal path belongs to Section 30.8's 54-path
planning baseline. Do not edit canonical documents just to fill a count: UI-only
implementation needs thirteen paths if those two reserved slots remain unused.
The owner must approve the final necessary subset and any prerequisite expansion;
15 is an allowlist boundary, not a required changed-file count. No new hook, shared
package, Auth-controller, Practice component or renderer change is assumed.

### 34.2 Confirmed session and trusted-startup blocker

The existing login/password verification, durable Session/hashed refresh-secret
flow, refresh cookie, /me and AuthProvider/AuthBoundary can establish real Student
sessions. Reuse them without token injection, fixture login routes or weakened
authentication. AuthBoundary also enforces existing onboarding; a synthetic
Student must use the approved onboarding workflow rather than bypass its redirect.

However, completion-evidence.service.ts:332-369 generates and hashes a random
password, deliberately discards it and returns only synthetic resource IDs.
section-evidence.repository.ts:580-592 stores the corresponding ACTIVE verified
STUDENT with synthetic-<userId>@example.invalid. The password is unavailable for
normal login. Slice 1/2 integrations directly signed test JWTs; they did not create
a browser login/refresh session. Existing browser specs intercept Auth responses;
those are UI fixtures, not proof of genuine session provisioning.

Ordinary API startup connects/listens without creating/sealing a synthetic origin.
The trusted origin registry is process/connection-generation bound. A separate
seed process, existing demo account, imported Student, copied IDs or known password
alone cannot establish authority in the serving API process. Demo-account tools
must not adopt these identities, reset their passwords or touch protected data.
No existing approved setup presently solves both normal credentials and a live
serving-process origin. Therefore end-to-end Slice 3 implementation readiness is
**BLOCKED**, not merely awaiting browser execution. No credentials were invented,
returned, reset, persisted, logged or used during this analysis.

Recommended resolution, requiring separate owner approval: a disposable-only
internal fixture host creates synthetic identities through the existing trusted
creator, records independent Admin approvals through existing services and keeps
their origin alive in the same process/connection as createApp. A narrowly scoped
trusted, one-time in-memory credential delivery would occur only after owned
creation proof; the Student then uses normal login/refresh/onboarding. Keep the
public creator input/result and normal startup unchanged. No public setup endpoint,
client freshness flag, JWT-secret sharing, direct browser token injection, new
enrollment persistence or stored plaintext credential is proposed. Exact private
delivery, authorized fixture invocation and disposal rules still need owner
approval; do not assume that an environment flag authenticates setup authority.

Proposed prerequisite inventory for that option, NOT authorized by this plan:

| Operation | Literal path | Need / approval boundary |
| --- | --- | --- |
| MODIFY | apps/api/src/modules/progress/completion-evidence.service.ts | Trusted post-proof credential handoff; existing Slice 1/54-path file, outside Slice 3. |
| MODIFY | apps/api/tests/completion-evidence.test.ts | Default non-disclosure, handoff/lifecycle failure and unchanged creator contract; existing Slice 1/54-path file, outside Slice 3. |
| CREATE | apps/api/scripts/completion-student-fixture.ts | Explicit disposable same-process setup/host and ordinary Auth provisioning; outside the 54-path baseline. |
| CREATE | apps/api/tests/completion-student-fixture.test.ts | Bounded setup, target/refusal, no credential logging and cleanup contracts; outside baseline. |
| CREATE | apps/api/tests/completion-student-fixture.integration.ts | Prepared guarded normal login/refresh/onboarding-to-completion verification; outside baseline. |

These five paths are a scope proposal, not a resolved implementation boundary.
If accepted alongside all fifteen baseline slots the proposed cap is twenty
paths, twelve creations/eight modifications; omitting unnecessary canonical edits
reduces actual changes. No edit to bootstrap, Auth/session models, configuration or
LocalProcessOwner.cs is assumed: the fixture host would reuse existing factories
and external verified ownership supervision. STOP if that cannot be established.
Canonical additions for private setup/credential handling and any required Auth
index provisioning need separate exact-contract approval. Preserve all thirteen
completion indexes; never infer permission for additional indexes or persistent
setup. This is a bounded prerequisite within Slice 3, not an automatic fourth
delivery stage. If the owner declines it, offline UI work can be proposed
separately but cannot fulfill the end-to-end acceptance below.

### 34.3 UI and API design using existing authority

Mount ConceptCompletion only for a loaded Concept, keyed by authenticated account
and Concept, alongside unchanged ConceptProgress. Reuse ConceptMarkdown, examples,
Revise content, Auth hooks and VisualizationPlayer/Renderer; no new hook is needed.
The Stitch concept-learning screenshot and code.html were inspected as hierarchy,
card/action, spacing and typography references. Preserve the current implemented
Concept CSS/focus/reflow conventions; do not copy CDN/scripts or introduce the
reference's XP, percentages, mastery, notes or unrelated tabs/features.

Load GET /progress/completion?conceptId=... through the existing authenticated
operation wrapper. Validate exactly the nine public fields and nested allowlists
from Sections 30.6/32.4. A normal published Concept can remain outside Option B:
404/unavailable must show a neutral unavailable message with no completion claim,
not fabricated INELIGIBLE data or a client-selected policy. Separate loading,
unauthenticated/denied, dependency error, incomplete, eligible, saving, uncertain,
completed, stale and revoked states. Only current server COMPLETED is completion;
clear current-completion assertions on identity loss or unconfirmed refresh.

List Read, Visualize, Example and Practice requirements, adding Revise only when
the server requires it. Explicit acknowledgements call the existing challenge and
response APIs; page views and playback never produce evidence. Show the public
authored graph/text alternative and a fieldset/legend with exactly one selected
checkpoint choice. The server selects the checkpoint; expose no expected choice,
rubric or private fingerprint. Incorrect/invalid/quota/expired outcomes follow
existing producer rules; never auto-issue another challenge or reset retry state.
Label acknowledgement as activity, not understanding; a correct checkpoint is
verified interaction, not comprehension or a standalone completion certificate.

Show server qualifying Practice score/null and threshold 70, without private
grading details. Explain the first-answer/pre-disclosure rule before linking to
the existing /concepts/:id/practice screen, whose default is OUTPUT. The bounded
synthetic setup has one required OUTPUT question; no unsupported question-selector
query or new Practice behavior is assumed. Later copied/reveal-assisted answers
cannot replace the qualifying first answer. Refresh eligibility explicitly after
return; do not infer it from the saved/unlock receipt or F037 count.

Enable the native explicit completion button only on current server ELIGIBLE.
POST {viewRevision} and one UUID-v4 Idempotency-Key, then validate the server view;
no optimistic COMPLETED flag. Durable completion is rediscovered through GET after
navigation/reload. A stale/revoked claim is clearly noncurrent, even if the server
returns a historical completedAt. No automatic completion, Topic aggregation,
score generation, diagnostic promotion or F039 behavior.

### 34.4 Cancellation, retries, privacy and accessibility

The client uses the existing base-URL, bearer, no-store, omit-cookie data-call,
redirect:error, timeout and external AbortSignal conventions. Reuse the existing
Auth runAuthenticatedRead wrapper for explicit operations as Practice already
does; it does not automatically resend writes. A local CompletionError subclass
can allowlist completion conflict/uncertainty reasons without editing the shared
API/Auth client. Surface fixed safe messages, never raw server details.

Maintain controller generation plus exact account/Concept/view/command identity.
Abort superseded work and suppress late responses on navigation, logout, account
or view replacement. For a possibly committed POST retain its original key/body
in memory for explicit Retry only; detach/cancellation is not rollback. A new
request/view gets a new key; logout/disposal clears pending commands and chosen
answers. No automatic resend, cross-account reuse, local/session storage or cached
answer-based authority. GET recovery must not silently repeat a command.

Use labelled native buttons/radios, fieldset/legend, associated requirement text,
polite status announcements and alerts, visible focus and predictable focus after
errors/refresh/completion. Pointer, keyboard and screen-reader paths are equivalent;
text and checkpoint response remain usable with reduced motion and without
playing an animation. Preserve existing keyboard tabs and four-type Practice
draft/Clear-all behavior. Use wrapping min-width:0 layouts for desktop/tablet/mobile,
long labels and error text; no timing-only task or horizontal-overflow dependency.

### 34.5 Verification and twelve proposed browser cases

After implementation approval, focused client/controller/rendering tests must
cover strict schemas, correct request identity, unavailable normal Concepts,
required/conditional evidence, 0/100 versus 70, all UI states, safe errors, frozen
Retry, late responses, account/revision isolation, rendering semantics, inert
content and no private-answer exposure. Reuse existing tools; no new dependency.
Run relevant Auth, Concept, visualization, four-type Practice and F037 frontend
regressions plus justified API compatibility/security checks. Run web/API affected
builds, TypeScript, lint, formatting, browser-spec static compilation, exact-scope,
UTF-8/LF and diff checks. Perform separate Critical/High/Medium/Low source review;
unresolved findings stop acceptance. Do not rerun Slice 1/2 MongoDB suites merely
because UI changes. If credential/setup changes are approved, prepare their new
focused guarded login/session integration; execute only after separate ownership,
disposable/index and invocation approval.

The twelve planned browser scenarios remain one named test each, with no counted
parameter expansion. Reconcile Section 30.11 against the accepted Option B subset:

1. Required actions, original OUTPUT, explicit completion and reload/activity compatibility.
2. Views/playback/unchecked acknowledgement and missing Visualize/Practice never qualify.
3. First score 0 versus approved 70; copied retry cannot qualify; unsupported overrides refuse.
4. Required Example and conditional/optional Revise coverage and missing-content states.
5. Student/denied/unpublished behavior and account-switch/logout isolation.
6. Concept/view navigation cancellation and stale-response suppression.
7. Interrupted completion, explicit identical-key Retry and no duplicate UI outcome.
8. Correct/incorrect/invalid checkpoint behavior, limits/expiry/revocation and expected-choice secrecy.
9. Server stale/revoked views cannot silently restore current completion or trigger GET repair.
10. Keyboard/accessible names/status/focus with reduced motion and no playback requirement.
11. Desktop/tablet/mobile, long text, loading/unavailable/error/Retry reflow.
12. Four-type Practice/draft/Clear-all/activity/secrecy compatibility; unsupported required types blocked.

Route-intercepted browser tests establish UI contract behavior only, not actual
MongoDB durability, real authorization or genuine session provisioning. Any real
end-to-end claim additionally needs the approved fixture/session producer and
separately authorized execution. Browser automation remains prohibited on the
primary Windows host; no previous exception transfers. **141 existing scenarios
remain NOT_RUN; twelve additions are unimplemented/unmounted. Expected total
after implementation/static reconciliation: 153 NOT_RUN**, not a current mounted
count and not permission to execute Playwright.

### 34.6 Acceptance and next owner approval gate

Acceptance requires an ordinary authenticated synthetic Student session in the
same live Option B serving generation; actual current required evidence and
original passing assessment; explicit majority-proven completion recovered through
GET after navigation; unavailable/denied/stale/revoked isolation; accessible safe
interaction; unchanged F036/F037/four-type Practice behavior; offline checks and
formal review, plus separately approved new setup integration where applicable.
Browser evidence/exception is a later named owner gate and cannot be self-granted.

**Plan documented; implementation readiness BLOCKED on credential and same-process
setup authority/scope.** Next approval must decide the private credential delivery
and disposable fixture-host boundary, approve/revise the five proposed prerequisite
paths and any exact canonical amendment/index needs, then approve a final necessary
Slice 3 inventory and implementation/offline verification. Do not start repair,
UI implementation, tests, services or further stages from this planning approval.
F001-F037 APPROVED_COMPLETE and F038 IN_PROGRESS remain unchanged; production
enrollment/migration/privacy/erasure/release prerequisites and F039 remain excluded.

## 35. Slice 3 bootstrap and F006 canonical contract reconciliation

### 35.1 Owner decision, authority and scope of this gate

The owner approved the LOCAL disposable bootstrap design and eighteen-path scope
for CONTRACT RECONCILIATION ONLY. Only this feature document changes now. No
implementation, account/session creation, provisioning, test/service/database or
browser execution is authorized. Section 34's historical blockers/proposals remain
intact; this section records their explicit disposition rather than rewriting them.

Bootstrap authority is the owner's explicit approval of one verified disposable
fixture initialization, exercised only by the trusted internal fixture entrypoint
under the existing ordinary-user ownership supervisor. Require retained native
handles, exact process/executable/parent/owner/Job identity, common-microsecond UTC
checks, fresh storage, writable PRIMARY and an empty exclusive
127.0.0.1:27018 / f021-test / deeplearner-f021-test target. LOCAL, an environment
switch, caller role, persisted marker or stdin GO message alone is not authority.
Private stdin supplies confidential input; it is not supervisor authentication or
a transferable attestation. Keep this within the accepted trusted fixture-code
boundary; do not resurrect the rejected supervisor-capability design or claim
physical storage attestation from application origin. Unknown ownership stops.

The fixture initializer may create exactly two new synthetic Admin identities,
with server-generated IDs/emails and fixed ADMIN role, using validated User
inserts and existing Argon2id hashing. Account activation/email-verification are
owner-authorized disposable fixture facts, not a bypass for public registration.
Duplicate/existing IDs or emails refuse; no upsert, role promotion, demo-user
adoption or persistent writes. Normal registration remains STUDENT/FREE and its
existing verification flow. No public bootstrap/role/grading endpoint is added.

The owner enters separate temporary author, reviewer and Student passwords through
the existing masked-console/private-owned-stdin pattern, with existing password
bounds. No password in argv, environment examples, files, logs, receipts, source,
clipboard or fixture API output. The creator's optional internal credential source
must be configured only by trusted fixture code, never its public command body;
the default generator/discard behavior and ID-only result remain unchanged. Hash
before insert, minimize plaintext lifetime and clear references after use; do not
claim guaranteed JavaScript heap zeroization. Creation failure is terminal for the
run, not permission to adopt possibly created accounts.

Authenticate author and reviewer separately through existing normal login/session
issuance, using separate private credential/session state. Verify their current
eligible Admin accounts, distinct sub/session identities and server-issued tokens;
no direct fixture tokens.sign call. Retain the existing login audits, refresh-token
hashing and cookie protections. Invoke existing internal author/reviewer services
with these genuine credentials; they recheck roles/status, deny self-approval and
record rubric/checkpoint/policy provenance through their existing transactions.
Distinct authenticated identities prove account separation, not organizational or
human independence beyond this approved synthetic fixture boundary.

The same process and canonical shared Mongoose connection then creates the new
Student/Concept/question, authors/reviews exact bindings and seals Option B origin.
It retains the creator until shutdown. The Student uses normal browser login,
HttpOnly refresh cookie and onboarding; completion calls use bearer authentication
and current account checks. A session alone cannot create/reconstruct origin.
Connection-generation loss, reconnect, pool/topology uncertainty, restart or dispose
permanently invalidates the run's qualification. Existing logout clears client
state/revokes refresh access under current Auth semantics; no immediate access-JWT
revocation guarantee is added. A new login after lifecycle loss cannot revive
qualification. F036 first-submission/atomic grading/disclosure and F037 activity
contracts remain unchanged.

Owned HTTP ports and existing loopback/CORS/cookie configuration must be available
without changing protected development processes. Never steal a running port or
silently change configuration. Close HTTP/connections, invalidate origin, gracefully
stop the owned MongoDB and verify Job/ports/handles/storage/baselines with existing
procedures. Only a later separately approved gate may execute this setup.

### 35.2 Exact source-of-truth differences and disposition

F006 is APPROVED_COMPLETE and explicitly records owner-approved model alignment.
Current user.model.ts/session.model.ts and their retained declaration tests match
it. API_DESIGN.md's Auth status table, registration contract and Section 24 model
summary already use firstName/lastName, four statuses, profile and lifecycle
metadata; public registration still creates STUDENT only. PRD Auth roles and
Google/password options do not require a different model. The older Database
Design baseline has the following exact text; these lines are NOT edited here:

```text
Section 6, users:
| `passwordHash` | `string | null` | Conditional | Argon2id hash for credential users; null for Google-only accounts. |
| `displayName` | `string` | Yes | Student/Admin display name. |
| `role` | `STUDENT | ADMIN` | Yes | Authorization role. |
| `plan` | `FREE | PREMIUM` | Yes | Commercial plan marker; development defaults may grant all entitlements. |
| `status` | `ACTIVE | DISABLED` | Yes | Account operational state. |
| `authProviders` | `array<object>` | Yes | Linked providers such as {provider, providerUserId}. |
| `onboarding` | `object` | No | Technologies, level, goal, preferred difficulty, daily target. |
Section 8, users:
| `{ email: 1 }` | unique | Login lookup and email uniqueness. |
| `{ role: 1, status: 1 }` | standard | Admin user management. |
| `{ "authProviders.providerUserId": 1 }` | sparse / verify | Fast Google identity lookup; application also prevents duplicate linkage. |
```

| Area | Approved F006/current contract | Classification / minimum proposed correction |
| --- | --- | --- |
| displayName | F006: "firstName/lastName (derive display name)"; model stores required trimmed firstName/lastName, max 80 each; displayName is a virtual. | Contradictory historical storage recommendation. Clarify derived-only displayName; document actual stored names. No model migration/change. |
| status | F006: "PENDING_VERIFICATION/ACTIVE/DISABLED/SUSPENDED"; default PENDING_VERIFICATION. | Contradictory historical two-state list. Document all four; existing Auth semantics already match. |
| onboarding | F006: "One optional embedded profile contains onboarding preferences; it remains absent before onboarding." | Historical field-name contradiction. Document profile, with its actual fields/bounds; no separate onboarding object or completion flag. |
| Lifecycle fields absent from Section 6 | F006 retains suspension/login metadata; model/API have suspendedUntil, suspensionReason and lastLoginAt. Session model/API also have revocationReason, absent from the older Session table. | Additive documentation omissions; add optional fields only, not new persistence. |
| role | STUDENT/ADMIN enum agrees. Model defaults STUDENT; normal registration explicitly uses STUDENT. | No enum conflict. KEEP; separately describe the owner-authorized two-Admin fixture exception, not a public role-selection feature. |
| plan | FREE/PREMIUM agrees; F006/model default FREE. | Clarify the stored default without inventing entitlement enforcement or local bypass. |
| passwordHash | Optional Argon2id capability; password-only, Google-only and linked accounts; at least one capability; sensitive selection/serialization protection. | Compatible but incomplete baseline. Clarify existing capability rules; retain approved F007 hash-format correction, no password/token storage change. |
| authProviders | F006: "Google identities live in authProviders" and "a partial compound unique index declares cross-user identity uniqueness." Model permits GOOGLE/providerUserId pairs, defaults empty for password-only accounts and rejects duplicate pairs. | Baseline is underspecified, not authority for arbitrary providers or mandatory nonempty arrays. Clarify allowlist/default/privacy; no provider expansion. |
| User listing indexes | F006 expressly approves status/plan/role plus creation-time listing indexes; current model/tests declare the three exact ordered keys below. | Historical index contradiction. Supersede the role/status recommendation; do not create both sets or drop persistent indexes here. |
| Provider index | F006/model/tests require compound provider + providerUserId, UNIQUE, exact string partial filter. | Contradicts the old single-field sparse recommendation. Supersede it explicitly; do not add sparse or a second provider index. |
| Session fields/indexes | Existing Section 6 hash-only/expiry/revocation intent and all three Section 8 ordered keys agree with F006. | KEEP. Add revocationReason/bounds and explicit names/options; TTL remains asynchronous, never authorization. Optional ipHash remains private, not a required fingerprint. |

No conflict requires a new role, authentication method, session model, API endpoint,
database collection or npm dependency. The canonical correction below needs owner
approval before DATABASE_DESIGN.md changes; feature approval is not silently used
to rewrite a canonical baseline.

### 35.3 Exact eight-index static reconciliation

Current installed Mongoose 9.10.2 declarations specify collection names users and
sessions but DO NOT explicitly set names on these schema.index calls. Mongoose's
getIndexes/model.createIndexes path preserves declared ordered keys/options and
passes them to the installed MongoDB driver 7.6.0. Its
src/operations/indexes.ts:263-266 uses userIndex.name, otherwise
Array.from(key).flat().join('_'), preserving Map/Object.entries order. The names
below are therefore source-verified driver-derived expectations, not invented
explicit model names or live index observations. No model was imported/executed
and no schema/index declaration was changed during this review.

| Collection | Exact derived name | Ordered keys | Unique | Exact extra options | Existing approval/declaration source |
| --- | --- | --- | --- | --- | --- |
| users | email_1 | {email:1} | true | none | F006 Approved Decisions; user.model.ts:161; user-model.test.ts exact declaration. |
| users | status_1_createdAt_-1 | {status:1,createdAt:-1} | false | none | F006 listing-index decision; user.model.ts:162; retained exact declaration test. |
| users | plan_1_createdAt_-1 | {plan:1,createdAt:-1} | false | none | F006 listing-index decision; user.model.ts:163; retained exact declaration test. |
| users | role_1_createdAt_-1 | {role:1,createdAt:-1} | false | none | F006 listing-index decision; user.model.ts:164; retained exact declaration test. |
| users | authProviders.provider_1_authProviders.providerUserId_1 | {"authProviders.provider":1,"authProviders.providerUserId":1} | true | partialFilterExpression:{"authProviders.providerUserId":{$type:"string"}} | F006 provider-identity decision; user.model.ts:165-173; retained exact declaration test. |
| sessions | refreshTokenHash_1 | {refreshTokenHash:1} | true | none | F006 session/token-uniqueness decision; session.model.ts:46; session-model.test.ts exact declaration. |
| sessions | userId_1_revokedAt_1 | {userId:1,revokedAt:1} | false | none | F006 session-revocation lookup; session.model.ts:47; retained exact declaration test. |
| sessions | expiresAt_1 | {expiresAt:1} | false | expireAfterSeconds:0 | F006 expiry decision; session.model.ts:48; retained exact declaration test. |

No explicit schema/index collation is declared. Proposed disposable verification
requires fresh collection defaults with no collation option, hence simple binary
comparison; never infer this from an existing collection. Expected actual index
version is v2. unique is true only on the three declared unique indexes; absence
or false represents nonunique. No sparse, hidden, alternate collation, TTL on other
keys or additional partial filter is permitted. Standard _id_ indexes are separate.
Session expiry/revocation remains service-enforced independently of asynchronous
TTL deletion. Retained tests were inspected, NOT rerun; live readiness is NOT_RUN.

The proposed disposable setup allowlist is the thirteen unchanged F038 completion
definitions plus these eight existing F006 declarations: 21 secondary definitions,
not 21 new index designs. A later provisioning approval must explicitly cover the
full list, collections/options and initialization order. Create/verify collections
and indexes only after the owned empty-target gate, before bootstrap or login
transactions; no runtime autoCreate/autoIndex, syncIndexes, migration, backfill or
persistent operation. Email/reset token flows are not used by these explicitly
verified synthetic accounts. Additional indexes are not inferred from model lists;
STOP if another prerequisite is actually required.

### 35.4 Exact proposed canonical wording - NOT APPLIED

Recommend one additive DATABASE_DESIGN.md appendix, preserving every existing
byte/history entry. It must explicitly supersede only the differing older Auth
recommendations rather than silently leaving two active contracts. Proposed text:

```text
## F006 canonical Auth alignment (Sections 6 and 8)

The earlier User/Session baseline tables in Sections 6 and 8 are historical where
they differ from this owner-approved F006 alignment. This clarification documents
existing implemented contracts; it introduces no schema/API/index behavior,
migration, persistent provisioning or new authentication/authorization mechanism.

users stores normalized lowercase unique email; required trimmed firstName and
lastName (1-80 characters each); and derived-only displayName, not a separate
required stored displayName. role is STUDENT or ADMIN, default STUDENT; public
registration remains STUDENT only. plan is FREE or PREMIUM, default FREE;
entitlement behavior is unchanged. status is PENDING_VERIFICATION, ACTIVE,
DISABLED or SUSPENDED, default PENDING_VERIFICATION.

passwordHash is optional/null Argon2id for password-capable accounts. authProviders
contains GOOGLE/providerUserId identities, defaults empty for password-only
accounts, and rejects duplicate pairs. At least one password/provider capability
is required. Never store provider access/refresh tokens. Password hashes/provider
identities are private; explicit safe projections remain necessary for raw reads.
emailVerifiedAt and suspendedUntil are nullable dates; suspensionReason is optional
trimmed text up to 500 characters; lastLoginAt is a nullable date. Existing
createdAt/updatedAt timestamps remain. No plan/role/status bypass is inferred.

The optional onboarding object is profile, not a separate onboarding field.
profile contains existing optional experienceLevel, learningGoals,
interestedTechnologyIds, preferredDifficulty and dailyStudyGoalMinutes. Use the
approved enum allowlists; reject duplicate goals/technology IDs; at most 50
technology IDs; dailyStudyGoalMinutes is an integer 5-240. profile remains absent
until supplied; this adds no onboarding-completion or learning-completion flag.

sessions retains required userId, private SHA-256 refreshTokenHash, expiresAt,
createdAt and lastUsedAt; nullable revokedAt; optional revocationReason (trimmed,
at most 500 characters), optional deviceInfo (userAgent up to 512, deviceLabel up
to 200) and optional private SHA-256 ipHash. Store no raw refresh token. Existing
expiry, rotation/reuse and revocation services remain authoritative; TTL deletion
is asynchronous. Hashes/IP metadata remain excluded from ordinary serialization.

The exact users index set is:
- email_1: {email:1}, UNIQUE.
- status_1_createdAt_-1: {status:1,createdAt:-1}, nonunique.
- plan_1_createdAt_-1: {plan:1,createdAt:-1}, nonunique.
- role_1_createdAt_-1: {role:1,createdAt:-1}, nonunique.
- authProviders.provider_1_authProviders.providerUserId_1:
  {"authProviders.provider":1,"authProviders.providerUserId":1}, UNIQUE,
  partialFilterExpression:{"authProviders.providerUserId":{$type:"string"}}.
This supersedes the old {role:1,status:1} listing and single-field sparse provider
recommendations; it does not authorize creating both sets or dropping any index.

The exact sessions index set is:
- refreshTokenHash_1: {refreshTokenHash:1}, UNIQUE.
- userId_1_revokedAt_1: {userId:1,revokedAt:1}, nonunique.
- expiresAt_1: {expiresAt:1}, nonunique, expireAfterSeconds:0.

These names are the installed driver's default names derived from the existing
ordered model declarations, not newly named model indexes. For the fresh disposable
fixture require v2 indexes and no explicit collection/index collation (simple
binary comparison); no sparse/hidden/alternate options beyond the exact partial
filter and TTL above. Existing persistent collections are not certified by this
description and require separately approved inspection/migration decisions.
Automatic indexing/collection creation remains disabled. Declaration approval
is not provisioning approval. No F038 completion or F039 mastery rule changes.
```

The appendix corrects historical field/index inconsistencies and adds omitted
F006 metadata only. API_DESIGN.md already expresses the corresponding Auth/User
contracts and needs no change. Its Section 24 recommended Session index snippet
is a subset, not authority to remove the unique refresh-hash declaration in F006
and Database Section 8. No canonical document is changed in this gate.

### 35.5 Reconciled complete eighteen-path proposal

Eleven CREATE and seven MODIFY paths, with no wildcard or optional extra test:

| Operation | Exact literal path |
| --- | --- |
| CREATE | apps/web/src/lib/api/completion-client.ts |
| CREATE | apps/web/src/lib/progress/completion-controller.ts |
| CREATE | apps/web/src/lib/progress/completion-contracts.ts |
| CREATE | apps/web/src/components/concepts/concept-completion.tsx |
| CREATE | apps/web/src/components/concepts/concept-completion.module.css |
| CREATE | apps/web/tests/completion-client.test.ts |
| CREATE | apps/web/tests/completion-controller.test.ts |
| CREATE | apps/web/tests/completion-rendering.test.ts |
| CREATE | tests/browser/concept-completion.spec.ts |
| CREATE | apps/api/scripts/completion-student-fixture.ts |
| CREATE | apps/api/tests/completion-student-fixture.integration.ts |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md |
| MODIFY | docs/features/F038-completion-rules.md |
| MODIFY | apps/web/src/components/concepts/concept-browser.tsx |
| MODIFY | playwright.f024.config.ts |
| MODIFY | apps/api/src/modules/progress/completion-evidence.service.ts |
| MODIFY | apps/api/tests/completion-evidence.test.ts |
| MODIFY | docs/DATABASE_DESIGN.md |

All eleven creations remain absent; all seven modification targets exist. The
four required setup paths contain the two-Admin bootstrap, private credential
source, same-process serving and focused/prepared integration coverage. Fold
fixture unit tests into completion-evidence.test.ts; do not create the optional
completion-student-fixture.test.ts. No Auth model/repository, bootstrap.ts,
LocalProcessOwner.cs, shared client, dependency or configuration file is added.
If safely implementing the accepted boundary requires one, STOP for approval.

### 35.6 Readiness and next approval gate

**Bootstrap contract reconciliation PASS; F006/model/index static reconciliation
PASS, with explicit historical canonical differences and proposed corrections.**
Two genuine Admin sessions and a genuine Student browser session are feasible
using existing Auth services plus the approved internal fixture design. This is
design/source evidence, not a claim that sessions, private-channel delivery,
ownership, live indexes or bootstrap behavior have been executed or verified.

The four completion APIs, Concept panel/Practice integration, stable in-memory
command identity, accessible response paths and account/navigation cancellation
remain as Section 34. No client authority, first-answer workaround, completion
shortcut, diagnostic promotion or public Admin setup is introduced. Focused tests
must cover normal login/refresh/logout, duplicate/bootstrap refusal, current
reviewer separation, secret-free input/output, ownership/origin generation loss,
uncertainty, old-token behavior and UI isolation. Preserve all previous passing
evidence; do not rerun completed Slice 1/2 integration without a justified gate.

No new dependency or unresolved model/API design conflict was identified. Next
owner gate is explicit approval of the exact Section 35.4 canonical appendix and
the eighteen-path implementation/offline-verification contract, including the
private bootstrap/credential boundary. Implementation is NOT authorized by this
reconciliation. Separate guarded startup, 21-index provisioning/integration and
browser approvals remain required. Runtime safety prerequisites must all PASS;
FAIL/UNKNOWN or another required file/definition stops before writes.

Only this document is appended. F001-F037 APPROVED_COMPLETE and F038 IN_PROGRESS
are unchanged. Existing **141 browser scenarios remain NOT_RUN**; twelve Slice 3
cases remain unimplemented/proposed (153 expected NOT_RUN after static preparation).
No production enrollment/migration/privacy/erasure/release or F039 work is implied.

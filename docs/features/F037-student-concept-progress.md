# F037 - Student Concept Progress

**Status:** APPROVED_COMPLETE
**Plan date:** 2026-10-19 (Asia/Calcutta)
**Current gate:** OWNER-APPROVED LOCAL COMPLETION AND SCOPED GIT DELIVERY
**Formal dependency:** F036 APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY.
**Authorization:** The owner explicitly approved F037 completion for LOCAL
DEVELOPMENT ONLY following FINAL REVIEW PASS WITH F037 BROWSER EXCEPTION, and one
scoped 33-file commit/safe push to origin/dev after Git preflight. Review/evidence
boundaries remain in Sections 11-12; completion authorization is in Section 13.
No test/service execution, persistent provisioning or production release is approved.

F001-F037 remain APPROVED_COMPLETE for local development. F038 completion rules and
F039 mastery are not authorized. The planning history below is retained; this
authorization supersedes its planning-only restrictions and pending decisions.
Historical browser exceptions do not transfer to F037.

## 1. Sources, verified closure and current architecture

Consulted AGENTS.md, DEVELOPMENT_ROADMAP.md Phase I/current pointer, PRD sections
14-15, 23-24 and 94-95, SYSTEM_ARCHITECTURE.md modular-monolith/progress boundaries,
DATABASE_DESIGN.md studentProgress/index/transaction/algorithm/retention sections,
API_DESIGN.md response/error/auth and F030-F036 contracts, completed F021 and
F030-F036 feature documents, current API/web modules and tests, and existing
Playwright configurations/specification sources.

The preceding read-only gate verified dev local HEAD, origin/dev tracking and
fresh remote dev HEAD equal 71281cd9b8bdab5d50e044578803186ff60dc26b; working tree
clean; F001-F036 APPROVED_COMPLETE. Owner repeated that delivered F036 identity.
This planning gate does not automatically finish, amend or otherwise write Git.
The roadmap pointer still names completed F036; leave it unchanged until a later
explicit implementation approval authorizes starting F037.

The roadmap's exact name is Student Concept Progress; dependency F036. It supplies
no detailed algorithm. The canonical database design expects one progress summary
per user/Concept, atomically maintained with attempts, but also includes scored
completion/mastery fields. F036 deliberately records SUBMITTED/null-score immutable
attempts; F038 and F039 own the later rules. F021 deferred completionRules.
Consequently activity is not proof of learning completion or a low score.

Existing reusable boundaries:
- F036 LOCAL-only POST /api/v1/practice-questions/:questionId/unlock: strict input,
  current Student eligibility, complete published references, account-scoped key,
  revision/private fingerprint, bounded snapshot transaction, majority+journal
  commit, owned majority proof, fresh disclosure eligibility and exact DTOs.
- F021 publishedConceptStages supplies Concept, Topic, Module, Learning Path and
  Technology publication and every carried reference check. Reuse this helper,
  not a separate publication policy.
- Existing authenticate, current-account reads, request IDs/envelopes, selected-
  field logging, safe errors, rate-limit conventions and database connection policy.
- AuthController.runAuthenticatedRead verifies identity before/after the supplied
  operation without replaying POSTs. Reuse it without an auth-controller change.
- ConceptBrowser already keys account/resource/Concept identity and preserves Read,
  Example, Revise, source links and Practice navigation. Existing hooks/controllers
  supply cancellation and generation patterns.
- No implemented progress model/router/client exists. No new package, environment
  variable, queue, scheduler, shared package or deployment mechanism is needed.

UI reference inspected: docs/designs/student/concept-learning/stitch/screen.png
and code.html (header hierarchy, metadata spacing, native controls and responsive
structure). Its 65% progress, module health, XP and Mark Completed controls are
future reference visuals, not F037 requirements. Do not copy scripts/CDNs, invent
percentages or redesign the existing screen.

## 2. Approved activity scope and explicit exclusions

Student workflow:
1. Open a valid published Concept; view an independent saved-practice activity panel.
2. With no owned persisted attempts, show No saved attempts and NOT_STARTED.
3. Use the existing Practice page and submit through F036's durable workflow.
4. Return to the Concept page; a fresh read shows the saved count and first/latest
   attempt timestamps, with IN_PROGRESS.
5. A pending or failed activity read never removes usable Concept content. Retry
   performs only another GET; it never submits an answer or repairs storage.

A page visit, mode change, draft, cancelled request or unconfirmed client response
must not itself increment activity. Counts cover saved attempts across all four
canonical types and questions in the requested Concept, not completed questions.
Two legitimate attempts on one question count twice; same-key replay counts once.

Exclude COMPLETED, percentages, section acknowledgements/completion, mastery,
score calculation, pass/fail, XP, badges, gamification, dashboard/path analytics,
Admin/history/export/delete interfaces, grading, execution, F038/F039, background
tracking and migrations. Preserve F036 answer prerequisites and all GET secrecy.

## 3. Proposed exact model, index and privacy contract - P1/P4/P7

### 3.1 Minimal activity-only schema recommendation

Collection: studentProgress. Strict schemaVersion 1; reject coercion, unknown fields,
unsupported schema versions, invalid IDs/dates/counts and client-authored identities.

| Field | Proposed storage requirement |
| --- | --- |
| _id | Server-created ObjectId; immutable |
| userId | Authenticated Student ObjectId; immutable |
| conceptId | Canonical qualified Concept ObjectId; immutable |
| technologyId | Server-derived published ancestry ObjectId; immutable in F037 |
| learningPathId | Server-derived published ancestry ObjectId; immutable in F037 |
| moduleId | Server-derived published ancestry ObjectId; immutable in F037 |
| topicId | Server-derived published ancestry ObjectId; immutable in F037 |
| attemptCount | Positive safe integer for a stored summary |
| status | Literal IN_PROGRESS for a stored positive-count summary |
| startedAt | Minimum submittedAt of included persisted attempts; valid Date |
| lastActivityAt | Maximum submittedAt; valid Date, not before startedAt |
| createdAt | Server time when this projection row is first established; immutable |
| updatedAt | Server-owned projection-write time; no change on GET/replay |
| schemaVersion | Literal 1 |

Return NOT_STARTED/count 0/null activity dates virtually when no attempts exist.
Do not create zero-count rows merely because someone opened a page. createdAt is
projection creation time, which can be later than historical startedAt; do not
incorrectly require it to precede the first attempt. Count/date overflow or malformed
metadata refuses the result rather than truncating, rounding or fabricating zero.

Recommend omitting sections, firstScore, latestScore, bestScore, mastery and
completedAt entirely from this activity-only stored version and public DTO.
This explicitly refines/defer the canonical design's required sections/mastery
and broader status enum; it is NOT silently approved by this plan. The prior
analysis discussed null/unclassified placeholders: omission is the smallest
recommended exact representation because neither false completion flags nor WEAK
can be inferred from ungraded attempts. Owner must approve P1 or choose a concrete
null-placeholder alternative before implementation. Existing attempt score=null
is unchanged. Future scored/completion versions need their own reviewed schema.

Allow only validated insert or exact owned single-summary updates of count/status/
activity/update time in the progress repository. Do not expose arbitrary PATCH,
identity edits, resets, delete, bulk mutation or an Admin bypass. Supported identity
immutability is not a claim of database WORM against privileged administration.

### 3.2 Index and provisioning

Declare only:
    name: uq_student_progress_owner_concept
    key: { userId: 1, conceptId: 1 }
    unique: true

Verify exact ordered key/name/unique properties before writes; reject sparse,
partial, hidden, TTL or conflicting collation definitions. Keep automatic collection
and index creation disabled. Preserve all four F036 attempt indexes unchanged.
Defer the canonical path/status and Concept/mastery analytics indexes until an
approved consumer needs them; P4 must approve that deliberate scope decision.

No application startup, request or model import may provision indexes or alter
topology. A later separately approved disposable gate may create this one progress
index plus the existing four attempt indexes only in a verified owned test database.
Persistent local/demo, Atlas or production provisioning remains unapproved.
Owner clarification supersedes the earlier read-fallback proposal: BOTH GET and
submission writes must verify the full exact unique index before progress access.
Missing, stale, incorrect or unverifiable indexes return sanitized 503
DEPENDENCY_UNAVAILABLE. Historical fallback never bypasses readiness. A verified
index with no summary permits bounded read-only derivation; no index or collection
is created automatically. Detect duplicate matching summaries with a limit-two
read rather than selecting an arbitrary row. Writes use the same strict readiness.

### 3.3 Privacy/retention

Store no submitted/correct answer, explanation, key/hash/fingerprint, email, token,
IP, evaluator metadata or visualization telemetry in studentProgress. The source
answers remain only in F036's private attempt records. Internal hierarchy/user IDs
are not public DTO fields. Never log rows, request credentials or answer contents.

Recommend the existing LOCAL P5 approach: no promised retention duration, TTL,
automatic purge, reset, erase or export API. Clear drafts/cancellation never removes
saved attempts or summaries. Future owner-approved erasure must consider both
collections, uniqueness/idempotency and backups atomically; do not implement it
here or infer indefinite production retention. Review retention, erasure, backups,
security and release readiness before sharing/deployment.

## 4. Transactions, historical reconciliation and consistency - P2/P3

### 4.1 Authoritative activity statistics

Immutable persisted practiceAttempts are authoritative; studentProgress is their
owned activity projection. Scope every statistics operation by authenticated userId
and exact conceptId across OUTPUT, DESCRIPTIVE, SCENARIO and CODING.

Count all qualifying historical owned persisted attempts, including ones whose
questions were subsequently unpublished/archived; publication changes do not erase
a student's saved activity. The requested Concept/current ancestry must still
qualify for API visibility. Never read another account's rows, join answer content,
or filter history only to currently published questions and silently lower counts.

Aggregate metadata on the server: count, minimum submittedAt, maximum submittedAt
and invalid-metadata detection. Do not fetch unbounded answer documents into Node
or impose an arbitrary first-N cap that undercounts unlimited attempts. Validate
required owner/Concept/type/date/schemaVersion/result=SUBMITTED/score=null metadata;
unsupported future scored/versioned rows or malformed relevant metadata yield
sanitized unavailability, not a partial or reset summary. Use existing owned
Concept/time attempt index where appropriate; bound every operation. No benchmarks
or new speculative indexes are authorized by planning.

### 4.2 Consistent GET and summary cases

Recommend a bounded read-only snapshot transaction on PRIMARY, using the existing
replica/session policy, to observe publication, metadata statistics and at most two
owned summaries consistently. It makes no application insert/update/upsert/delete,
collection creation or index operation. Proposed read budget 5,000ms; transaction
operations inherit its timeout rather than override timeoutMS. End sessions in
finally and refuse success on unresolved cleanup failure. Recheck current account
eligibility before returning. Read-only snapshot requirements/unavailability are
part of P3, not a new standalone fallback.

| Same snapshot observation | Proposed result |
| --- | --- |
| No summary and no attempts | 200 NOT_STARTED, count 0, startedAt/lastActivityAt null |
| No summary and valid historical attempts | 200 derived IN_PROGRESS/count/min/max; no write/backfill |
| One valid summary matching source count/min/max and current hierarchy | 200 exact five-field DTO |
| Stored count/times disagree with source, including an apparently ahead summary | 503 DEPENDENCY_UNAVAILABLE; no repair or fabricated value |
| Duplicate, malformed, unsupported or conflicting owner/reference summary | 503 DEPENDENCY_UNAVAILABLE; no overwrite/selection of an arbitrary winner |
| Concept or any published ancestor/reference does not qualify | Existing generic 404 CONCEPT_NOT_FOUND; no private summary |
| Snapshot/metadata/dependency/cleanup unavailable | Sanitized 503; no success/partial DTO |

A missing summary is a supported legacy/missing-projection case, not evidence of
an absent attempt. A present stale/conflicting summary is an integrity condition,
not permission to overwrite historical data. Recommend requiring separate owner
repair approval for such cases. State the observed read point; do not promise the
response includes commits arriving after that snapshot or instant account revocation.

### 4.3 New submission and atomic projection write

Retain the existing F036 endpoint/body/headers/success DTO and receipt unchanged.
Within the SAME snapshot transaction/session:
1. Preserve current content, owned idempotency, public revision and private solution
   fingerprint checks. Use publishedConceptStages to obtain the canonical hierarchy
   in the progress repository; do not expand the public question DTO or create a
   competing publication policy.
2. For an exact existing key, keep F036 replay validation/proof; do not insert an
   attempt, increment a summary, touch updatedAt or silently backfill. Missing
   historical summaries remain readable through GET fallback.
3. For a genuinely new attempt, read source metadata and any existing owned summary
   BEFORE insertion; reject a present stale/malformed/conflicting projection.
   A missing summary is permitted once write/index prerequisites are verified.
4. Allocate sequence/insert immutable attempt as F036 already does, using the same
   explicit session. Recompute authoritative metadata INCLUDING the inserted row.
5. Insert the missing strict summary with all historical count/min/max, or update
   the exact previously validated owned summary. Preserve immutable identity,
   creation time and current consistent hierarchy. No client patch, blind increment
   from zero, arbitrary upsert defaults or answer copying.
6. Await successful summary write and majority+journal transaction commit. A summary
   validation/write/index error aborts the attempt too; no best-effort side write.
7. Preserve F036's exact owned majority attempt proof, fresh content/fingerprint/
   publication/account validation and session cleanup before answer disclosure.

Commit atomicity establishes that the new attempt and summary were committed
together. Existing majority attempt proof still verifies the exact durable owned
attempt; do not claim that proof alone detects later privileged projection edits.
GET independently checks current summary/source consistency. Uncertain commits
remain answer-free; a later explicit same-key request reauthorizes and proves the
durable attempt. No transient or progress-only fallback reveals answers.

For an absent legacy summary, aggregate prior attempts rather than initializing
attemptCount to one. For an existing valid summary, recomputation must equal the
prior authoritative count plus one and min/max of all saved metadata. Failed or
rolled-back submissions contribute nothing; unpublished-history counts are retained.

### 4.4 Concurrency, readiness and timeout preservation

Retain F036's 10,000ms persistence budget, 2,000ms verification reserve, at most
three transaction-body executions total, bounded commit, PRIMARY snapshot reads,
majority+journal writes and fail-closed uncertain outcomes. Include progress
readiness/statistics/write cost in the same budget; never increase timeout or
reset the shared clock just to accommodate summary work. Inside withTransaction,
do not specify operation timeoutMS; outside it, readiness/proof reads remain
explicitly bounded. Preserve the confirmed F036 timeout correction.

Same-key requests converge on one attempt, so they cannot increment twice.
Different keys/questions for one user/Concept contend on that single summary;
snapshot write conflicts require retry from fresh metadata, within existing bounds.
Concurrent first-summary creation uses the exact unique owner/Concept index.
Extend known duplicate handling only for the recognized summary-creation stage and
exact approved key/index/namespace evidence, not arbitrary E11000 errors. Preserve
native transaction labels internally so the driver can recognize retryable errors;
sanitize only at the public boundary and never log private native errors.

Unknown index errors, malformed metadata, exhausted conflicts, unsupported sessions/
transactions or unavailable indexes refuse writes/disclosure. Do not return a
success merely because a count read looks plausible. Do not retry an uncertain
commit as a fresh insertion in that request or rotate the logical idempotency key.

No historical reparent/migration policy is invented. A stored summary's hierarchy
conflicting with the current qualified Concept fails closed and needs separate
owner disposition; it must not be reassigned to another account/Concept silently.

## 5. Exact proposed file inventory and inspection

**33 unique paths: 23 creations and 10 modifications.** Classification is relative
to delivered F036. This gate creates the plan only; 22 other creations and all ten
modifications remain unimplemented. All 23 creation paths were absent before this
gate; all ten modification paths exist. No inventory/dependency conflict was found.
The existing snapshot/atomic repository and internal publication helper can support
the proposal within these paths; no shared auth/Concept publication helper change
is proposed. If implementation reveals another necessary path, STOP for approval.

| # | Operation | Exact path | Responsibility |
| --- | --- | --- | --- |
| 1 | Create (this gate only) | docs/features/F037-student-concept-progress.md | Planning, decisions, exact scope and later evidence only |
| 2 | Create | apps/api/src/modules/progress/progress.model.ts | Strict activity-only studentProgress model and declared unique index |
| 3 | Create | apps/api/src/modules/progress/progress.repository.ts | Owned snapshot reads, historical statistics, consistency checks and transactional summary writes |
| 4 | Create | apps/api/src/modules/progress/progress.schema.ts | Strict Concept query and GET-body validation |
| 5 | Create | apps/api/src/modules/progress/progress.dto.ts | Explicit five-field public DTO and strict activity invariants |
| 6 | Create | apps/api/src/modules/progress/progress.service.ts | Fresh Student eligibility, publication orchestration and public error sanitization |
| 7 | Create | apps/api/src/modules/progress/progress.controller.ts | Existing success envelope only |
| 8 | Create | apps/api/src/modules/progress/progress.routes.ts | Authenticated progress GET with validation and limits |
| 9 | Create | apps/api/src/modules/progress/progress-rate-limit.ts | Bounded IP/Student limits using existing conventions |
| 10 | Create | apps/api/tests/progress-model.test.ts | Model validation, immutable identities, timestamps and index declarations |
| 11 | Create | apps/api/tests/progress.test.ts | DTO/service/repository, historical reconciliation and transaction-negative controls |
| 12 | Create | apps/api/tests/progress-routes.test.ts | HTTP authentication/ownership/query/body/no-store/rate/error contracts |
| 13 | Create | apps/api/tests/progress.integration.ts | Separately gated real snapshot reads, summary integrity and rollback verification |
| 14 | Create | apps/web/src/lib/progress/contracts.ts | Strict five-field response and activity status/time/count contracts |
| 15 | Create | apps/web/src/lib/api/progress-client.ts | Authenticated cancellable no-store progress retrieval |
| 16 | Create | apps/web/src/lib/progress/progress-controller.ts | Account/Concept request identity, state transitions and stale-result rejection |
| 17 | Create | apps/web/src/hooks/use-concept-progress.ts | Existing auth adapter and controller lifecycle for a single Concept |
| 18 | Create | apps/web/src/components/concepts/concept-progress.tsx | Accessible saved-practice activity panel only |
| 19 | Create | apps/web/src/components/concepts/concept-progress.module.css | Responsive panel styling using existing design tokens |
| 20 | Create | apps/web/tests/progress-client.test.ts | Client request/response/error/cancellation tests |
| 21 | Create | apps/web/tests/progress-controller.test.ts | Identity isolation and controller state/race tests |
| 22 | Create | apps/web/tests/progress-rendering.test.ts | Semantic activity/empty/error/Retry rendering and exclusions |
| 23 | Create | tests/browser/concept-progress.spec.ts | Eight prepared mock-backed mounted declarations, never executed in this gate |
| 24 | Modify after approval | docs/DEVELOPMENT_ROADMAP.md | F037 status and evidence only after implementation approval; preserve all history |
| 25 | Modify after approval | docs/API_DESIGN.md | Approved additive progress GET contract and unchanged Practice API |
| 26 | Modify after approval | docs/DATABASE_DESIGN.md | Explicit activity-only schema refinement, summary consistency and index boundaries |
| 27 | Modify after approval | apps/api/src/app.ts | Narrow progress router/dependency mounting and exact progress-path early no-store |
| 28 | Modify after approval | apps/api/src/modules/practice/practice-attempt.repository.ts | Same-transaction summary persistence/readiness and bounded known-summary conflict handling |
| 29 | Modify after approval | apps/api/tests/practice-attempt-repository.test.ts | Extend existing fixtures for summary rollback, replay, bounds and durable disclosure |
| 30 | Modify after approval | apps/api/tests/practice.integration.ts | Preserve F031-F036 assertions; add atomic summary checks and replace obsolete no-progress assertion |
| 31 | Modify after approval | apps/web/src/components/concepts/concept-browser.tsx | Mount the activity panel only for a ready Concept, preserving modes and navigation |
| 32 | Modify after approval | apps/web/tests/concept-rendering.test.ts | Assert approved activity panel while retaining completion/XP and rendering/security restrictions |
| 33 | Modify after approval | playwright.f024.config.ts | Add only concept-progress.spec.ts to testMatch; preserve infrastructure and execution settings |

Specific existing-contract touchpoints:
- app.ts: append narrow progress service/limit injection/router mounting using
  current createApp conventions. Set no-store for the exact progress GET before
  applicable CORS/parser errors, preserving the existing unlock matcher and
  middleware order. No broad prefix handler or unrelated endpoint change.
- practice-attempt.repository.ts: integrate readiness and summary mutation into
  its existing store/session boundary; no separate transaction, new endpoint,
  raw application DB access from the service or circular module dependency.
  Progress repository may depend on existing Concept/attempt models; it must not
  import the attempt repository back.
- practice-attempt-repository.test.ts: extend fixtures for atomic summary ordering,
  failure/rollback and exact expected sessions. Preserve strict identity, proof,
  timeout, uncertainty and conflict assertions; no truthiness replacement.
- practice.integration.ts: its F036 no-studentProgress assertion becomes a positive
  exact owned summary/count check. Preserve all secret-exclusion, auth, immutable
  attempt, pagination, unpublished/refusal and existing type assertions. Do not
  delete unrelated test coverage to accommodate the new collection.
- concept-rendering.test.ts: allow only the new named activity panel in a real
  Concept detail; retain forbidden Mark complete/Start learning/XP controls, safe
  Markdown/source assertions and the approved actual-ID Practice anchor.
- playwright.f024.config.ts: add only the new spec name; do not change workers,
  retries, timeouts, process fixtures or known isolation behavior.

## 6. Exact proposed API and errors - P5

GET /api/v1/progress?conceptId=<24-hex-id>. One Concept per request; no pagination.
Require signed authenticated current eligible STUDENT, active account and verified
email. Accept no client-supplied owner selector: userId/accountId are forbidden extra keys,
not alternate ownership. No Admin or public progress endpoint.

Strict query exactly one scalar conceptId; reject missing/blank/duplicate/array/
object/unknown keys, invalid 24-hex syntax, dotted/operator keys and coercion.
Normalize accepted hexadecimal case to canonical lowercase in response. Reject
GET bodies, including non-JSON and chunked bodies, using existing conventions.
No new environment flag: authenticated GET follows Student API conventions;
existing unlock POST remains server-registered LOCAL-only. No deployment is granted.

Success is 200 and the existing envelope, with exactly five data fields:
    {
      "success": true,
      "data": {
        "conceptId": "<canonical id>",
        "status": "NOT_STARTED",
        "attemptCount": 0,
        "startedAt": null,
        "lastActivityAt": null
      },
      "message": null,
      "meta": { "requestId": "<existing nonempty request id>" }
    }

For IN_PROGRESS, attemptCount is a positive safe integer and both timestamps are
canonical UTC ISO strings with millisecond precision, startedAt <= lastActivityAt.
NOT_STARTED requires exactly count 0 and both null. No additional response meta,
persisted row ID, user/hierarchy IDs, scores, mastery, sections, completedAt,
submitted text, answer, explanation, receipt, key, fingerprint or provenance.

Use explicit DTO allowlisting independent of projection or Mongoose select. Strict
frontend parsing rejects extra fields and incompatible count/status/time identity.
No summary row required for the empty/fallback response, and neither response writes.

| Status/code | Proposed behavior |
| --- | --- |
| 400 VALIDATION_ERROR | Strict query, canonical ID or unsupported GET body |
| 401 existing AUTH_ACCESS_TOKEN_* | Missing, invalid or expired signed token |
| 403 existing AUTH_FORBIDDEN/account-state codes | Admin/non-Student, disabled/suspended/unverified account |
| 404 USER_NOT_FOUND | Existing current-user absence convention |
| 404 CONCEPT_NOT_FOUND | Missing/hidden/inconsistent Concept ancestry, generic safe message |
| 429 RATE_LIMIT_EXCEEDED | Bounded shared-IP/Student read limits |
| 503 DEPENDENCY_UNAVAILABLE | Invalid/conflicting projection, metadata/readiness/snapshot/cleanup failure |

Preserve existing 403 ORIGIN_NOT_ALLOWED, malformed/oversized parser and standard
not-found/media behavior where applicable; do not force failures into success.
No raw driver errors, stored values or answer content in public errors or logs.
All matching progress GET responses/errors are no-store, including applicable
early CORS/parser errors via the approved app.ts touchpoint. Preserve exact unlock
no-store and unrelated route/header behavior. Client also uses cache:no-store,
credentials:omit and redirect:error.

The planned early matcher is GET plus /^\/api\/v1\/progress\/?$/i on req.path,
matching Express's existing case-insensitive optional-trailing-slash route behavior.
Query strings do not broaden path matching. Do not match /progress-anything,
/progress/another-segment or other methods. Keep CORS/security/parser handling and
its existing payload limit unchanged; no invalid request becomes successful.

Recommend current Practice read defaults: 300/IP and 120/Student per 15 minutes,
using existing key obscuring/IP conventions and safe 429 envelope. A read-only
Retry consumes rate budget; no automatic request storm. Progress service performs
fresh eligibility before the snapshot read and after it before constructing success.

## 7. Student UI, identity, cancellation and design - P6

Mount ConceptProgress only on a ready actual Concept detail, below its summary
and beside/before the existing Practice link. Do not display it on Topic overview,
invalid/missing Concept or anonymous/non-Student states. Preserve one h1, breadcrumb,
existing mode tabs, source, Practice URL, scrolling and controls.

Use a small named section (Saved practice activity), existing spacing/tokens and
native controls. No fake progress bar, percentage, dashboard card, XP, score or
Mark complete. Suggested text:
- Loading saved practice activity.
- No saved attempts for this Concept.
- In progress. N saved practice attempts.
- First saved attempt / Latest saved attempt, using semantic time elements and
  deterministic UTC display/ISO dateTime.
- Practice activity does not mark this Concept complete.
- Activity is temporarily unavailable. Retry.

Loading/error/Retry remains independent of Concept loading. Never substitute zero
for an unavailable response or clear unrelated Practice drafts. Role=status/polite
announcements should be concise; an application error is scoped to this named
region. Preserve visible focus, readable contrast, keyboard-native Retry and no
automatic focus stealing when background state resolves. No source/HTML execution.

Use an account/Concept-keyed instance with the existing auth adapter, AbortController
and request generation. Check account/Concept/request identity after authentication,
network and parsing; stale success AND stale errors must be ignored. Unmount,
logout/account change and Concept change abort/dispose the old controller. No
browser persistence, URL state, polling, cross-tab shared cache or speculative
cross-account reuse. Existing server auth/publication checks remain authoritative.

Refetch on a fresh Concept mount/return from Practice and on explicit Retry.
The panel is an as-of-read activity view; do not claim live multi-tab synchronization.
No Practice-controller/widget change is needed in this scope.

## 8. Acceptance, offline checks, integration and browser preparation

### 8.1 Acceptance criteria

1. Current eligible Student can read only their published Concept's exact five-field
   activity DTO; ownership cannot be supplied or overridden by client input.
2. Empty state is virtual NOT_STARTED/count 0/null times with no application writes.
3. Missing-summary historical attempts yield exact count/min/max read-only fallback.
4. Valid present summary matches source metadata/current hierarchy in one snapshot;
   stale/conflicting/duplicate/invalid data fails safely without repair.
5. New saved attempts and summary changes commit atomically; failure rolls back
   both. Initial creation incorporates every valid historical attempt.
6. Same-key replay does not insert/count/update again; different keys and concurrent
   questions converge on one correct user/Concept summary within bounded retries.
7. F036 majority persistence/owned proof, content/revision/private fingerprint and
   fresh eligibility still precede five-field answer/receipt disclosure.
8. Missing write index/topology/transaction prerequisites or uncertain commits fail
   closed; no provisioning, transient fallback, grading, execution or completion.
9. UI shows the five proposed states accessibly, rejects obsolete responses and
   preserves existing Concept navigation, Practice drafts and identity boundaries.
10. Exact 33-file scope, no dependencies, retained F001-F036 approvals and future
    F038/F039 boundaries; no browser PASS is fabricated.

### 8.2 Focused offline and relevant regressions

Prepare model validation/strictness/immutable identity and exact index tests;
metadata/min/max/safe-integer and DTO tests; all GET auth/query/body/error/no-store/
rate/publication cases; stale/missing/duplicate/hierarchy conflicts; historical
baseline accuracy; replay/new-key/concurrent creation/conflict bounds; rollback,
uncertain commit and cleanup fail-closed behavior. Preserve native error labels
internally and sanitized public errors. No answer-bearing fixtures may escape
through progress DTO, logs or errors.

Frontend: exact five-field parsing, credentials/cache/request identity, cancellation,
late success/error/account switch, empty/loading/unavailable/Retry, semantic time/
live status, responsive containment, keyboard/focus and isolation. Existing Concept
safe rendering/source/mode navigation and F030-F036 Practice regressions remain
required. Do not weaken existing assertions, raise timeouts or add retries.

At an implementation gate, run only necessary focused and relevant regression
sets, then required build/lint/TypeScript/formatting/browser-spec static compilation,
UTF-8/LF, full source-diff/security and exact-scope checks. Record initial failures
and actual distinct counts without adding overlapping reruns. No test is run in
this planning gate.

Perform a separate final implementation-diff review for correctness, maintainability,
authorization/ownership, answer leakage, logging/cache, transaction/race/cleanup,
validation/data integrity, backward compatibility and unapproved scope. Report
actual CRITICAL/HIGH/MEDIUM/LOW findings with file/line references; do not invent
findings or substitute test PASS for source review. Unresolved Critical/High stops
acceptance; remaining Medium/Low requires owner disposition.

### 8.3 Separately approved disposable MongoDB gate

Only after later offline approval, request one guarded disposable integration run,
zero retries, using the successfully verified F035/F036 procedure:
ordinary unelevated user; retained native handles; exact native creation identity
and documented UTC common-microsecond CIM comparison; executable/parent/owner/exact
Job/live-state checks; fresh owned storage; protected Mongo/demo/development baselines.
Use only 127.0.0.1:27018, replica f021-test, database deeplearner-f021-test.
Verify owned identity/listener BEFORE connection; initialize replica, await writable
PRIMARY, then verify fresh empty exclusive target before fixtures/index provisioning.

Future test-only provisioning must be explicitly authorized: four existing attempt
indexes plus the one approved summary unique index, in that disposable target only.
Verify actual indexes and uniqueness. Never provision/reconfigure persistent port
27017/demo/Atlas/production. If any ownership/isolation subcheck is UNKNOWN/FAIL,
stop before database modifications. Do not infer process ownership from PID alone.

Real cases: historical fallback with byte-for-byte no-write snapshots; first new
attempt including legacy history; unchanged replay timestamps/count; distinct/
same-key concurrency and cross-question contention; summary-write rollback;
missing/malformed index refusal; stale/conflicting projection refusal; exact
owned five-field GET; preserved private attempts, F036 receipts/secret-free GET/
LOCAL-only unlock and no scoring/progress completion. Unit negative controls do
not prove real failover; any uncertainty fault injection needs its own reviewed
authorization and honest evidence boundaries.

Close all connections, graceful shutdown first, verified owned-Job fallback only,
observed exit codes or UNKNOWN, Job empty, port released, handles/storage removed
and protected baseline identities/demo metadata unchanged. Preserve failures and
forced cleanup separately. No automatic correction/rerun after a failing gate.

### 8.4 Browser source/config reconciliation - prepare, never execute

Inspected current testMatch sources: playwright.f022.config.ts selects concept-read
(F022/F025); playwright.f023.config.ts selects concept-example; playwright.f024.config.ts
selects revise/visualization/practice groups through practice-attempts; foundation
playwright.config.ts selects chrome-smoke, one worker and zero retries. Add only
concept-progress.spec.ts to the f024 testMatch list in a later implementation gate.

| Group | Retained expected distinct scenarios for future verification |
| --- | --- |
| F022/F025 | 27 |
| F023 | 16 |
| F024 | 19 |
| F028 | 13 |
| F029 | 7 |
| F031 | 14 |
| F032 | 7 |
| F033 | 7 |
| F034 | 7 |
| F035 | 7 |
| F036 | 8 |
| Smoke | 1 |
| Existing subtotal | 133 NOT_RUN |
| Proposed F037 | 8 NOT_RUN |
| Proposed complete total | 141 NOT_RUN, INCLUDING eight F037 |

These are retained/source-config expected counts, not fresh Playwright discovery.
No --list, test import, mounted/manual browser or Playwright execution occurred.
Historical prior-feature passes/failures/recoveries remain unchanged; do not describe
the current expected 133 as having run for F037. Once safely approved, actual
discovery must reconcile exact unique identities/counts before any execution.

Eight proposed distinct new declarations, each once with no automatic reruns:
1. concept activity is scoped to the real Concept route and preserves navigation;
2. no-attempt state has no completion/score/XP and sends GET only;
3. returning after a saved attempt refreshes count/times; exact retry does not
   fabricate another activity event (mocks exercise mounted display, not durability);
4. loading, safe error and explicit Retry never fabricate zero or submit;
5. obsolete success/error is rejected after Concept navigation;
6. logout/account replacement clears the old activity and rejects delayed results;
7. keyboard, live status and semantic times preserve focus/native controls;
8. desktop/tablet/mobile containment (1280/768/390 within one declaration) preserves
   existing Concept/Practice rendering without unauthorized controls.

Primary-host Playwright remains prohibited until separately approved ownership-safe
execution. Do not reopen the stopped custom prototype. Preserve F022 EPERM/
inconclusive probing and Windows taskkill PID-reuse risk, F024 shared-worker/browser
lifecycle conflict, F029 intermittent ArrowDown and independent recovery, segmented
historical evidence and screen-reader/background-throttling/Windows shutdown gaps.

A future safe gate retains F024 isolation from F028/F029, existing assertions/
timeouts, zero retries, 25-minute combined browser and five-minute initial diagnosis
budgets. Runtime mocked browser evidence cannot prove MongoDB atomicity. No F036
or other feature exception transfers. Any F037-specific LOCAL-only exception must
be separately explicitly approved and document exact NOT_RUN coverage, obtained
evidence, accepted risks and required future verification. Production needs a
separate browser-regression/release-readiness decision.

## 9. Explicit owner decisions before implementation

The attachment approved detailed planning and the activity boundary only. It did
not settle every schema, reconciliation or provisioning detail below.

| Decision | Recommended exact default requiring approval |
| --- | --- |
| P1 - Schema refinement | Approve Section 3's strict activity-only fields and virtual zero state; defer sections/score/mastery/completedAt fields rather than false completion or artificial WEAK. Explicitly reconcile canonical required fields in DATABASE_DESIGN.md later. |
| P2 - Historical/integrity policy | Read-only derivation only when summary is absent; present stale/duplicate/conflicting data returns safe 503 and requires separate repair approval. New transaction creates a missing summary from all historical metadata; no backfill/GET/replay writes. |
| P3 - Atomicity/read consistency | Same F036 transaction for attempt+summary; metadata recomputation and narrow known-summary conflicts within existing bounds; bounded 5s read-only snapshot GET and fresh eligibility; no instantaneous revocation or live-failover claim. |
| P4 - Index/provisioning | Owner clarification: verify the full exact unique summary index for BOTH GET and writes, otherwise sanitized 503. Historical fallback cannot bypass readiness. Defer two analytics indexes; no automatic or persistent provisioning. Disposable provisioning needs separate approval. |
| P5 - API/security | Approve exact progress GET, five-field DTO, strict validation/errors, no-store including early matching errors, 300/IP and 120/Student per 15 minutes. Preserve F036 POST LOCAL-only; no new environment flags or deployment authorization. |
| P6 - UI | Concept-detail panel at proposed position, five states and saved-activity-only copy; independent cancellation/error/Retry; no live polling or modification of Practice drafts/controllers. |
| P7 - Privacy | No answer copies; private local summary retention without promised duration/TTL/delete API; future owner-reviewed erasure/backups and deployment readiness. |
| P8 - Scope/verification | Exact 33 paths, no dependencies, formal review and staged offline/disposable/browser approvals; 133 existing plus eight proposed = 141 expected NOT_RUN. No automatic exception transfer or infrastructure restart. |

No additional path/dependency conflict was identified during source inspection.
If any approved alternative requires more files, auth/publication changes, model/
API changes outside these decisions or configuration beyond one testMatch entry,
STOP for owner scope approval before editing it. Do not silently implement a larger
architecture to avoid a planning decision.

Next gate: owner resolves/approves P1-P8 and explicitly authorizes implementation
within the exact 33-file boundary plus offline verification. Only then start F037,
update its status/roadmap pointer to IN_PROGRESS and prepare the approved tests.
Database execution, any browser exception/safe execution, final review/completion
and Git delivery remain separate owner gates.

This planning gate creates only this UTF-8/LF document. All existing files and
statuses remain unchanged; no implementation, tests, services, database/browser/
synthetic execution, dependency/infrastructure change, Git write, deployment or
F038/F039 work is performed. STOP for owner review.

## 10. Owner reconciliation and implementation evidence - 2026-10-19

This section supersedes the retained planning-only gate statements above. The
owner approved implementation within Section 5's exact 33 paths and explicitly
resolved the P4 conflict. P1-P8 reconciliation PASS:

- P1: strict activity-only summary; no fabricated completion/mastery/score fields.
- P2: derive only absent summaries read-only; conflicting present rows fail closed.
- P3: same-session attempt/summary transaction; bounded snapshot GET, no GET repair.
- P4: BOTH GET and writes verify the full exact unique owner/Concept index before
  access. Missing/stale/nonunique/incorrect/unverifiable definitions yield sanitized
  503 DEPENDENCY_UNAVAILABLE. Historical fallback cannot bypass this check.
- P5: current STUDENT, published five-level references, exact five-field DTO, strict
  GET inputs, early no-store and bounded IP/Student limits. F036 POST stays LOCAL.
- P6: independent Concept saved-activity panel with cancellation, Retry and no
  completion controls or changes to Practice drafts.
- P7: no answer copies or logging; private LOCAL retention/erasure limitations.
- P8: exactly 33 paths, no dependencies, separate database/browser approval gates.

Implementation includes 23 planned creations (including this plan) and ten
modifications. API_DESIGN.md and DATABASE_DESIGN.md retain historical contracts
and append the explicitly approved F037 refinements. The roadmap status/pointer
is IN_PROGRESS. F001-F036 remain APPROVED_COMPLETE; F038/F039 remain NOT_STARTED.
No implementation beyond Section 5 was needed; no dependency was added.

### Offline evidence and corrected check failures

Evidence logs are under .cache/f037-offline-20261019/ (excluded local artifacts).
Actual distinct passing evidence, not a combined single-invocation claim:

| Check | Result |
| --- | --- |
| Focused API: progress model/repository/service/routes and affected attempt repository | 27 distinct PASS |
| Remaining relevant API regressions: auth, Concept, app/security/logging, Practice/models/User | 90 PASS |
| API total across segmented invocations | 117 distinct PASS |
| Focused frontend: progress client/controller/rendering and Concept compatibility | 20 distinct PASS |
| Remaining frontend regressions | 209 PASS |
| Frontend total across segmented invocations | 229 distinct PASS |
| Workspace production build | PASS |
| Workspace lint | PASS |
| Workspace TypeScript/type generation | PASS |
| All browser specification/configuration TypeScript compilation | PASS; no Playwright execution |
| Formatting | PASS after the one affected browser file was formatted/rechecked |

The first focused API run was 26 PASS / 1 FAIL: a newly added error-envelope test
incorrectly expected data:null. The existing approved error convention omits data.
Only that assertion was corrected to require omission plus the exact error-envelope
keys; its focused rerun passed. No application error behavior was weakened.
Initial TypeScript checks identified a string/ObjectId pipeline argument and
unknown test-response/fixture types; these were corrected within approved files.
The sandbox could not write the existing web incremental cache; the supported
ordinary-user offline check subsequently passed without permission/config changes.
The initial formatting check identified only the new browser specification;
formatting and the focused recheck passed. These initial failures are retained,
not represented as an uninterrupted clean combined run.

Focused coverage verifies missing/nonunique/wrong/unverifiable GET index refusal
before a snapshot or fallback; missing write readiness prevents an attempt/answer;
summary failure rolls back the mocked transaction; valid readiness permits the
read-only historical response and new-attempt summary update. Replay preserves
count and timestamps. Tests cover exact session identity, concurrent same/new
keys, safe DTOs, strict inputs, current eligibility, safe errors/no-store/rates,
controller disposal, stale success/error suppression and identity-bound client
contracts. Existing F030-F036 Practice and Concept assertions remain retained.

### Separate final source/security review for this offline gate

Reviewed final source changes and new modules separately after implementation,
including model/index definitions, native aggregation/projection, publication
reuse, exact ownership/session checks, transaction/retry/error paths, app route
matching, rate limits, DTOs, client/auth/controller lifecycle, UI markup/styles,
fixtures, prepared integration and browser configuration diff.

CRITICAL: 0 unresolved findings. HIGH: 0. MEDIUM: 0. LOW: 0.
No actual severity finding remains to attach a file/line reference to. No sensitive
answer or logging path was added. No broad mutation/admin/provisioning endpoint,
F038 completion or F039 mastery code was introduced. F036's majority+journal
commit, owned proof, revision/private fingerprint and fresh disclosure checks are
preserved; the progress update precedes commit in that same transaction. Native
raw administration remains outside application immutability guarantees.

This is a source/offline conclusion, not proof of live MongoDB isolation,
transaction conflict/retry behavior, real index metadata compatibility, topology
failure handling or browser accessibility/layout. Exact-scope/UTF-8/LF and diff
checks preserve historical documentation, including existing Markdown hard breaks.
No persistent index or database operation has been performed.

### Prepared runtime gates - NOT_RUN

The disposable entry point is apps/api/tests/progress.integration.ts, reusing the
expanded practice.integration.ts fixture. A future separately approved ownership-
safe runner must prove fresh storage, exact process/Job identity, loopback
127.0.0.1:27018, f021-test, PRIMARY and empty deeplearner-f021-test before fixtures.
Only then may it create the four existing attempt indexes plus the one approved
progress index. Execute the entry point once, not both files. The prepared suite
adds historical GET/no-write checks, atomic summary creation/updates, rollback on
summary failure, replay stability, corrupt-summary and missing-index refusal,
HTTP five-field secrecy/no-store/current eligibility, and retains prior assertions.
Real execution and cleanup remain NOT_RUN and need separate owner approval.

Eight explicit test declarations are prepared in concept-progress.spec.ts and
included in the existing production-built F024 configuration without changing
retries, timeouts or process fixtures. Static count only, not Playwright discovery
or execution. F037 eight NOT_RUN plus 133 existing = 141 expected NOT_RUN.
Retain F022 EPERM/PID-reuse and unsafe Windows teardown, F024 shared-worker cleanup
conflict, F029 intermittent keyboard scrolling, screen-reader/background-throttling
and shutdown gaps. Primary-host Playwright remains prohibited; no infrastructure
investigation was restarted and no historical browser exception transfers.

No browser/manual smoke verification, MongoDB integration, production readiness,
feature completion or browser exception is claimed. F037 remains IN_PROGRESS.
Next gate: separately approved guarded disposable MongoDB integration, then a
separate owner-approved final review/browser decision; no automatic continuation.

## 11. Guarded disposable MongoDB integration - 2026-10-19

Owner explicitly authorized one integration execution, including the four approved
F036 attempt indexes and the F037 unique owner/Concept index only in the verified
disposable target. This supersedes the MongoDB NOT_RUN state in Section 10 for
this gate only. F037 remains IN_PROGRESS; final review and any browser decision
are separate. No source/test/assertion/configuration/helper change was made.

### Isolation, identity and sequencing - PASS

Evidence directory:
.cache/f037-integration-2026-10-19-13-10-20-bb49f7/

- Ordinary unelevated REDGOLDMARK42\Shreeji; PowerShell 7.6.7; enabled-admin false.
- Unchanged scripts/LocalProcessOwner.cs SHA-256
  8B8911A51A766DF3057570E2F926E1EFCDDD29A8271C41F0351DE036A32B8FB4.
  Owner.Start atomically placed every child in a fresh retained test Job with no
  breakaway. Native original/independent inspection handles identify the same
  process creation; no PID-only adoption or termination was used.
- All seven independently recorded identity checks PASS: PID/native retained-handle
  equality, documented common-microsecond UTC creation equality, exact executable
  path/name, parent creation/executable identity, GetOwner account, native exact
  Job membership and live state. Missing/conflicting observations would block.
- Native raw creation: 2026-10-19T07:40:53.5738653Z. CIM UTC raw:
  2026-10-19T07:40:53.5738650Z. Difference three 100-nanosecond ticks. Both are
  normalized by integer (UTC ticks / 10L) * 10L to 639279924535738650; exact native
  FILETIME equality is retained separately. No rounding/tolerance interval.
- Fresh GUID-owned, non-reparse temporary storage was empty before MongoDB startup;
  an exact ownership receipt defined the only removable root/storage boundaries.
  Required ports were free. Only test-owned 127.0.0.1:27018 was used; server
  bind/port/storage/replSet and its sole replica member were checked independently.
- Initialize f021-test first, then await writable PRIMARY within the bounded
  startup window, then enumerate database names and confirm empty
  deeplearner-f021-test before fixtures or provisioning. Port readiness alone
  was not considered PRIMARY readiness. No Atlas/demo/production URI was selectable.
- Protected MongoDB PID 5144 retained its recorded parent 1304, exact creation
  2026-10-17T04:47:47.7735300Z and 127.0.0.1:27017 listener identity. Its unavailable
  executable/owner remain UNKNOWN, never inferred as test ownership. It was not
  added to the test Job or connected to. Persistent demo storage metadata and four
  existing MongoDB/development-process identities were captured before/after.

### Disposable provisioning and one prepared execution - PASS

Initializer verified the model-declared definitions against the exact approved
list before allowing the suite to provision. MongoDB's createIndexes evidence
confirms only the four approved practiceAttempts secondary indexes and
uq_student_progress_owner_concept UNIQUE {userId:1,conceptId:1} on studentProgress,
all in deeplearner-f021-test; see initialization.stdout.log and index-evidence.json.
Normal per-collection _id indexes remain MongoDB defaults. No persistent index,
migration or backfill operation was performed. Controlled missing-index drop/
restore operations were confined to these test-owned collections.

Exact single invocation, from E:\AI\DeepLearner with the verified runner's explicit
test-only environment (no .env inheritance or preload):

    node --import tsx apps/api/tests/progress.integration.ts

Result: 11 PASS / 0 FAIL / 0 NOT_RUN, INCLUDING the parent (ten child tests).
One startup and one integration invocation; no test rerun/retry. Existing bounded
application transaction/concurrency handling was retained. Test duration about
30.01 seconds; entire preflight/startup/test/cleanup procedure 131.45 seconds.

Passing child coverage:
1. Safe ordered OUTPUT pagination, hidden content exclusion and immutable reads.
2. DESCRIPTIVE pagination/projection and publication compatibility.
3. SCENARIO pagination/code/secrecy and immutable reads.
4. CODING pagination/inert nullable context/exact DTO and immutable reads.
5. Qualified answer access remains private; GET is answer-free/nonmutating.
6. F036 durable commits, identical-key convergence, new-key concurrency, owned
   sequences, private solution/revision binding and a single correct summary.
7. F037 historical owned-attempt fallback with no GET writes, summary-save failure
   rollback with no partial attempt, successful historical-inclusive summary,
   unchanged replay, corrupt-summary and missing-index refusal for GET/writes.
8. Complete ancestor status/absence and denormalized-reference refusal.
9. Malformed eligible data returns sanitized unavailability.
10. Signed STUDENT HTTP/current eligibility, exact five-field progress DTO,
    no-store, no answer/owner/score leakage, unchanged summaries on GET and
    retained four-type Practice behavior and secret-free question GET.

All prepared assertions passed. Majority+journal commit and owned post-commit proof
remain prerequisites for answer disclosure; summary persistence is in the same
transaction before commit. No completion percentages, scoring, mastery, XP,
F038/F039 mutation or transient unlock fallback was introduced.

Evidence boundary: missing-index and corrupt-summary negatives ran live. Incorrect/
nonunique/unverifiable index definitions were verified by the retained focused
offline controls, not additional live cases in this prepared suite. Do not claim
live malformed-index, real failover, uncertain-commit fault injection or exhaustive
cross-question/cross-account stress that was not executed. The successful prepared
suite is not a claim that every failure mode has live fault-injection evidence.

### Cleanup and protected baselines - PASS

Test database connections and ephemeral HTTP server closed in the suite's finally
paths; shutdown independently observed zero remaining target collections. Retained
native creation identity and exact Job membership were rechecked before the
owned-only shutdown helper validated bind/port/storage/replica and requested
MongoDB's graceful shutdown.

Initialization/test/shutdown-helper/MongoDB observed exit codes: 0 / 0 / 0 / 0.
Graceful shutdown PASS; forced termination false; cleanup errors empty. Final
owned Job active count 0; port 27018 released; all retained/inspection handles
closed; only the receipt-verified GUID temporary storage root was removed after
absolute-boundary and non-reparse checks. No unrelated process was terminated.
Protected MongoDB identity/listener, persistent demo storage metadata and all four
captured development-process identities remained unchanged. result.json, job.json,
shutdown.stdout.log and before/after metadata contain the evidence. All 34 source
pins (33 approved paths plus unchanged helper) matched before evidence documentation.

No defect was observed in the executed suite; no correction or automatic rerun
was performed. Retain offline 117 distinct API and 229 distinct frontend PASS and
prior static/security evidence. No browser, Playwright, synthetic, Git write,
dependency/infrastructure, production or next-feature operation occurred.

F037 mounted browser scenarios: eight NOT_RUN. Full expected browser regression:
141 NOT_RUN including those eight. No historical exception transfers and no
browser PASS, feature completion or production readiness is claimed. F001-F036
remain APPROVED_COMPLETE; F038/F039 remain NOT_STARTED. F037 remains IN_PROGRESS
and is ready for separately authorized final review with the above evidence
limitations and a separate explicit browser decision.

## 12. Final source/security review and F037-only browser exception - 2026-10-19

Result: FINAL REVIEW PASS WITH F037 BROWSER EXCEPTION.
Status: READY_FOR_REVIEW for LOCAL DEVELOPMENT ONLY; not APPROVED_COMPLETE.
The owner explicitly authorized this named, one-time exception conditional on
successful final review. AGENTS.md permits it without weakening mandatory API,
authorization/security or applicable database verification. No prior exception
is inherited, and this decision does not transfer to F038 or another feature.

### Retained evidence and exact scope

Retain 117 distinct API PASS, 229 distinct frontend PASS, build/lint/TypeScript/
formatting/browser-spec static/security PASS, and 11/11 real disposable integration
PASS INCLUDING the parent. Preserve the segmented offline evidence and initial
corrected check failures in Section 10 rather than claiming an uninterrupted
combined run. Section 11 retains the full isolation/identity/index/PRIMARY/empty-
target and graceful-cleanup record: all observed exits 0, no forced termination,
Job empty, port released, storage/handles removed and protected baselines unchanged.

Missing-index refusal for GET and writes: LIVE VERIFIED.
Incorrect/nonunique/unverifiable-index refusal: OFFLINE VERIFIED ONLY.
No new live index-negative, failover or uncertain-commit fault-injection claim.

Read-only Git/source inventory inspection confirms exactly Section 5's 33 approved
paths: 23 creations and ten modifications, no unrelated or staged files and no
new dependency. This final-review gate changes only this document and the roadmap.
The earlier implementation, tests/configuration, protected storage and temporary
teardown prototype remain unchanged. No completed test was rerun.

### Final source/security review

Reinspected all new progress modules/contracts/client/controller/hook/UI, the app
mount/header diff, F036 attempt repository changes, related fixtures/tests and
prepared browser/configuration changes against the approved P1-P8 contracts.
Also checked the unchanged shared authentication/publication/Practice boundaries
on which those changes rely. The following are source conclusions supported by
the retained evidence, not a claim of fresh runtime verification:

- progress.service.ts checks signed/current eligible STUDENT identity before and
  after repository read; owner comes only from req.auth.sub. Strict conceptId-only
  input has no user selector or Admin bypass. The unchanged publishedConceptStages
  verifies the Concept, Topic, Module, Learning Path and Technology with every
  carried reference. Internal hierarchy data never becomes response metadata.
- progress.dto.ts explicitly returns only conceptId,status,attemptCount,startedAt,
  lastActivityAt. Strict server/client schemas reject extra/inconsistent fields.
  No submitted text, correct answer, explanation, solution fingerprint or private
  attempt/owner metadata is selected into progress output or logged by new code.
- progress.repository.ts:46/140/311 verifies the exact unique index before GET,
  snapshot or historical fallback. F036 readiness calls the same verification
  before writes or replay. Missing/stale/wrong/nonunique/unverifiable readiness
  and conflicting summary metadata yield sanitized 503 DEPENDENCY_UNAVAILABLE.
  There is no automatic provisioning, index bypass, backfill or GET/replay repair.
- Historical aggregate statistics match only the authenticated user and Concept,
  validate durable-attempt metadata and derive count/min/max in the same bounded
  snapshot as published ancestry and at most one summary. Present summary identity,
  hierarchy/count and earliest/latest dates must match. An absent summary may be
  returned virtually only after readiness. GET performs no application writes.
- practice-attempt.repository.ts:303/333/340 inserts the immutable attempt and
  records progress in the same transaction/session before majority+journal commit.
  Summary failure aborts both. The progress repository verifies exact session and
  count/min/max delta and restricts updates to validated summary activity fields.
  Unique owner/Concept identity and known exact conflict handling preserve the
  existing at-most-three transaction-body executions and overall timeout budget.
- Replay checks the same account-scoped key/request/content identity and avoids
  progress writes, including when the summary is absent. Successful disclosure
  still requires the existing majority owned attempt proof at :361, fresh content/
  revision/private-solution binding and current Student eligibility. Unknown commit,
  invalid proof, cleanup failure or storage failure does not expose an answer;
  no transient F035 fallback was reintroduced. LOCAL-only unlock is preserved.
- app.ts uses exact GET progress path matching before CORS/parser for no-store;
  router/client also prevent caching. Strict query/GET-body validation and bounded
  300/IP + 120/Student per 15-minute limits retain safe error conventions. Existing
  unrelated paths, unlock headers, security middleware and rate rules are retained.
- The account/Concept-keyed panel unmounts obsolete controllers. Authenticated-read
  identity checks, AbortControllers and generation checks suppress stale success
  and error results. Disposal clears data; errors never fabricate zero activity.
  Retry issues GET only. Markup uses a named region/status, native button, semantic
  times, visible-focus and wrapping CSS; real-browser accessibility is unverified.
- No automatic completion, mastery, scoring, XP, analytics, grading, code execution
  or F038/F039 behavior was added. Existing Concept modes/links and Practice drafts,
  receipt, public-question secrecy and four-type contracts remain intact.

Actual unresolved findings by severity: CRITICAL 0; HIGH 0; MEDIUM 0; LOW 0.
No finding exists to assign an affected file/line reference to. Review checkpoints
above identify relevant source locations without presenting them as defects.

### Explicit LOCAL-only browser exception and remaining risks

Eight new F037 mounted browser scenarios: 8 NOT_RUN.
Complete expected regression: 141 NOT_RUN, INCLUDING those eight (133 prior + 8).
These are prepared/static expected counts; no browser PASS, fresh discovery,
manual browser smoke check or complete regression acceptance is claimed.

The owner expressly accepts for LOCAL DEVELOPMENT ONLY the unverified activity-
panel rendering/layout; keyboard and screen-reader accessibility; loading, empty,
error and Retry interactions; account/Concept navigation and cancellation races;
stale-response isolation; responsive/mobile behavior; and compatibility with
existing Concept and Practice interfaces. Offline rendering/controller checks do
not establish those mounted-browser behaviors. Manual inspection is supplemental
only. Primary-host Playwright remains prohibited without separate ownership-safe
execution approval; no infrastructure investigation or prototype work was resumed.

Retain F022 EPERM and inconclusive PID-reuse/Windows teardown safety risk, F024
cross-suite worker/browser cleanup conflict, F029 intermittent ArrowDown scrolling
and its historical independent recovery, plus exhaustive screen-reader/background-
throttling and Windows shutdown gaps. Do not retroactively change historical
results. Future browser verification requires separately approved safe execution,
actual discovery and the complete segmented 141-case plan with F024 isolation,
zero retries and existing timeout/assertion/budget protections.

### Privacy, deployment and owner gate

Summaries contain private account/activity metadata without answer copies. LOCAL
retention has no promised duration, automatic TTL/purge, public history/export or
erasure/reset API. Clear drafts never deletes saved attempts or summaries. Future
account erasure must reconcile attempts, summaries, idempotency and backups under
an explicitly reviewed policy. Supported immutable identity/attempt guards are
not database WORM against privileged administration.

Persistent indexes/topology were not provisioned or accepted by this disposable
run. Production requires separately approved infrastructure/index readiness,
privacy/retention/erasure/backups, ownership-safe browser regression and release-
readiness decisions. No LOCAL browser exception satisfies that release gate.
Publication qualifies at snapshot/final-read points, not instantaneous publisher
revocation; no exhaustive live failover or kernel/deadline guarantee is claimed.

Only the F037 document and roadmap are updated with UTF-8/LF and history retained.
F001-F036 remain APPROVED_COMPLETE; F038/F039 remain NOT_STARTED. F037 is now
READY_FOR_REVIEW, awaiting explicit owner completion approval. Commit/push require
separate authorization. No implementation, test, database/browser/synthetic,
Git write, dependency/infrastructure, paid/cloud or production operation occurred
in this review gate. STOP for owner review.

## 13. Owner completion approval - LOCAL DEVELOPMENT ONLY

On 2026-10-19 the owner explicitly approved F037 as APPROVED_COMPLETE for LOCAL
DEVELOPMENT ONLY following FINAL REVIEW PASS WITH F037 BROWSER EXCEPTION. This is
owner acceptance, not self-approval or production release authorization. The owner
authorized exactly one scoped commit of Section 5's 33 paths and a safe non-force
push to origin/dev after branch/origin/remote/scope/encoding/diff/staged review.
The delivery report must confirm the actual commit, push and HEAD identities;
this section records authorization, not an unobserved delivery result.

Preserve API 117 distinct PASS; frontend 229 distinct PASS; MongoDB 11/11 PASS
including the parent; build/lint/TypeScript/formatting/security PASS; final review
with zero unresolved Critical/High/Medium/Low findings. Preserve exact test-owned
isolation, approved disposable index provisioning and successful graceful cleanup
with all observed exits 0, Job empty, released port, removed storage/handles and
unchanged protected baselines. Missing-index refusal is LIVE VERIFIED;
incorrect/nonunique/unverifiable-index refusal is OFFLINE VERIFIED ONLY.

The explicit one-time F037 LOCAL browser exception remains: eight F037 mounted
scenarios NOT_RUN; complete expected browser regression 141 NOT_RUN INCLUDING
those eight. No browser PASS or complete regression acceptance is claimed. The
Section 12 accepted UI/accessibility/Retry/navigation/cancellation/stale-response/
responsive/compatibility risks, required future safe verification and non-transfer
rule remain. Primary-host Playwright remains prohibited; retain F022/F024/F029
and Windows testing limitations. No browser exception transfers to F038.

The contract remains activity-only, with authenticated owned five-field read-only
progress, strict GET/write index readiness and atomic attempt/summary persistence.
F036 majority-confirmed ownership/revision-bound persistence still precedes answer
disclosure. No automatic completion, mastery, grading, scoring, XP or analytics.
No persistent indexes, migration or backfill are provisioned by this delivery.
Privacy/retention/erasure/backups, persistent index/topology prerequisites and
separately approved browser-regression/release readiness remain deployment gates.
Clear drafts does not erase attempts/summaries; no production readiness is implied.

Only this document and the roadmap status are finalized during delivery; no tests
or services are rerun. F001-F036 remain APPROVED_COMPLETE; F038/F039 remain
NOT_STARTED. F038 requires separate owner planning approval. No automatic next-
feature, deployment, dependency or infrastructure work is authorized. STOP after
the scoped commit/push and verification report.

# F031 - Output-Based Questions

**Status:** APPROVED_COMPLETE
**Plan date:** 2026-10-17
**Dependency:** F030 APPROVED_COMPLETE; reuse F021/F022 catalog and rendering,
F012/F013 authentication/profile and Student shell conventions.
**Authorization:** Owner approved the complete 32-file inventory and all plan refinements
for implementation and offline verification on 2026-10-17. Browser and live database
execution remain separately gated. Owner separately authorized local-development
completion and feature-only Git delivery on 2026-10-17.
F001-F030 approvals remain unchanged; F032 is not authorized.

## 1. Authority, objective and approval boundary

Sources inspected: AGENTS.md; DEVELOPMENT_ROADMAP.md F031/F035/F036; PRD
sections 23, 24 and 95; SYSTEM_ARCHITECTURE.md layering and representative
practice routes; DATABASE_DESIGN.md practiceQuestions, ancestry and attempt
contracts; API_DESIGN.md envelopes, authentication/account errors and F030
boundary; F021 and F030 feature contracts. Also inspected the Student Concept
Stitch screen.png and code.html, current Concept/Auth implementations, existing
model tests, browser fixtures and production-built Playwright configuration.

The roadmap calls F031 the first question type end-to-end. The owner's explicit
refinement means authenticated database-to-Student **question display and local
drafting**, not the complete PRD submission/unlock/score workflow. PRD requirements
are retained and deferred to separately approved F035/F036 and later features.
The design reference's radio choices/quiz submission are illustrative: approved
F031 uses free text and no submission. Do not add options or evaluation fields.

Owner-approved:
- Authenticated STUDENT-only GET of published OUTPUT questions.
- Consistent published ancestry, strict request validation and allowlisted DTOs.
- Dedicated /concepts/[conceptId]/practice page, restricted Markdown and inert code.
- Accessible, memory-only account/Concept/question-scoped drafts.
- No real submission, answer reveal, grading or progress persistence.

**Implementation authorized:** all four scope additions and refinements below
were explicitly approved on 2026-10-17. Historical proposal wording is retained
as design rationale and is superseded by this approval. The starting
27-file inventory is not silently expanded. The approved inventory is 32 files
(22 creates including this document, 10 modifications). No new dependencies.

## 2. Existing architecture and required reuse

F030 supplies practiceQuestions with strict OUTPUT/CODING/DESCRIPTIVE/SCENARIO,
canonical difficulty/status, optional nullable starterCode/language, required
answer, optional explanation, schemaVersion 1, provenance and timestamps. Keep
the model, indexes, data and autoCreate/autoIndex settings unchanged.

Use Route -> middleware -> Controller -> Service -> Repository -> Database.
Append optional injection seams to createApp without changing existing positional
arguments. Controllers translate validated inputs and envelopes; services enforce
Student/account access; repositories own MongoDB reads and DTO projection.

Reuse authenticate(createAccessTokens(env)), userRepository.get/user service
eligibility behavior, AppError, validateRequest, request IDs, CORS, Helmet and
existing limiter patterns. No new auth middleware or shared package is needed.
Existing auth JWT verification is stateless; do not add a session-store lookup,
token refresh implementation, cookie authentication or plan entitlement policy.

F021's publication helpers are private inside concept.repository.ts. Proposed
minimal reuse: extract/export a fresh-array publishedConceptStages(id) from the
existing detail query's Concept match, Topic join and publishedAncestors stages.
The existing detail query uses that same factory, preserving its pipeline and DTO
byte-for-byte in behavior. Practice composes the factory into its Concept-rooted
aggregation. This needs separate approval for concept.repository.ts and its
existing pipeline tests. Do not generalize all catalog modules or move helpers.

Alternative considered: call conceptRepository.detail then query questions.
This avoids the two-file touchpoint but retrieves unrelated Read content and
separates hierarchy checks from question/count reads. Copying F021 predicates
would create a policy duplication. Recommend the small shared pipeline export;
it does not promise transaction snapshot isolation during concurrent publication.

AuthProvider exposes AuthController/State, but the access token is deliberately
private in auth-controller.ts. Existing Concept clients use credentials: omit
with no bearer token. They cannot be copied unchanged for this protected route.
Section 5 proposes one controlled authenticated-read operation, not a public
token getter, new token store or parallel authentication system.

## 3. Proposed exact HTTP contract

All details in this section that were not explicitly owner-specified are
**PROPOSED for approval before implementation**.

### Request and ordering

GET /api/v1/practice-questions?conceptId=<24-hex>&page=1&limit=10

- conceptId required: one exact 24-hex string, case-insensitive input normalized
  to lowercase; no whitespace, trailing newline, arrays or object coercion.
- page optional, default 1: decimal positive safe integer, no signs, fractions,
  exponents, padding or duplicate values. Use the existing catalog integer grammar.
- limit optional, default 10, maximum 20; same grammar. Lower than catalog's
  100 ceiling because each question may contain two 50,000-character fields.
- Reject unknown/repeated query keys, nonempty params and unexpected GET bodies.
  No client-selected type/status/projection/sort/user identifier.
- Validate safe-integer skip=(page-1)*limit.
- Sort by _id ASC, an existing unique tie-breaker; no authored order/index added.
  Stable for a fixed dataset, not snapshot pagination across concurrent changes.
- No question-detail, submission, answer or authoring endpoint.

### Authentication and limits

Order: existing global security/CORS/request handling -> no-store header ->
feature IP limiter -> authenticate bearer JWT -> per-subject limiter ->
strict request validation -> service authorization -> published question read.

Require JWT role STUDENT and current user role STUDENT, ACTIVE and emailVerified.
Reuse userRepository.get to enforce current eligibility without returning its
profile DTO to the browser. Reject ADMIN even with a valid token; no Admin preview.
Use token sub only, never a query-supplied identity. FREE and PREMIUM Students
both qualify in this increment; quotas/paywalls require a separate contract.
No application credentials or user secrets appear in logs or error details.

Proposed limits reuse user endpoint defaults: 300/IP/15 minutes before auth,
120/subject/15 minutes after auth. Use IPv6-aware IP normalization, per-process
HMAC-obscured keys, standard draft-8 headers, existing 429 errors and no new store.
Single-process limiter limitations remain documented. CORS is unchanged and
practice GET uses no cookies. Absence of Origin is not authentication.

### Success response

Use the existing F004/F021 list envelope, not a new data.items wrapper:

```json
{
  "success": true,
  "data": [
    {
      "id": "111111111111111111111111",
      "conceptId": "222222222222222222222222",
      "type": "OUTPUT",
      "difficulty": "BEGINNER",
      "prompt": "Predict the output.",
      "starterCode": "console.log(1);",
      "language": "JAVASCRIPT"
    }
  ],
  "message": null,
  "meta": {
    "requestId": "existing request identifier",
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

Exactly seven item fields above; id/conceptId lowercase ObjectId strings.
Difficulty is BEGINNER/INTERMEDIATE/ADVANCED/INTERVIEW_READY. Prompt is F030's
trimmed nonblank Markdown, 1-50,000 UTF-16 code units. starterCode is the unchanged,
nonblank 1-50,000-character string or null; language is JAVASCRIPT/TYPESCRIPT/null.
Normalize absent optional code/language to null in the DTO only. A code string
requires a supported language; language without code remains valid. No stored
record updates or invented defaults.

No answer, explanation, evaluation, status, author IDs, timestamps, __v,
schemaVersion, joined documents, source or other unapproved field in the DTO.
Database reads accept the F030 supported schemaVersion 1; unsupported/missing
versions are unavailable rather than silently upgraded. No new metadata beyond
the envelope above. Do not return a Concept DTO merely to display a page title.

Visible Concept with no eligible questions: 200, data=[], total=0, totalPages=0.
Out-of-range pages: 200 empty data with requested page/limit and accurate totals.
Frontend offers Back to first page when a formerly valid page becomes empty.
Never compute totals from unfiltered or unpublished questions.

### Errors

Preserve the standard error envelope, requestId and sanitized messages/details:

| Condition | Status/code |
| --- | --- |
| Invalid query/params/body | 400 VALIDATION_ERROR |
| Missing/invalid/expired access token | Existing 401 AUTH_ACCESS_TOKEN_MISSING/INVALID/EXPIRED |
| Missing current user | Existing 404 USER_NOT_FOUND |
| Disabled/suspended/unverified user | Existing 403 AUTH_ACCOUNT_DISABLED/SUSPENDED/EMAIL_NOT_VERIFIED |
| Token or current user is not STUDENT | Existing 403 AUTH_FORBIDDEN |
| Concept missing, unpublished or ancestry inconsistent | 404 CONCEPT_NOT_FOUND |
| Origin rejected | Existing 403 ORIGIN_NOT_ALLOWED |
| Rate exhausted | 429 RATE_LIMIT_EXCEEDED |
| Database failure or malformed projected eligible content | 503 DEPENDENCY_UNAVAILABLE |

Do not disclose which ancestor is hidden, question answers, raw validation input,
database exceptions or stack traces. A hidden/mismatched question is excluded;
a hidden/mismatched parent makes the Concept unavailable. Authentication and
account rejection must occur before protected content queries. No response
silently falls back to public catalog data.

## 4. Publication and answer-secrecy implementation design

Use Concept.aggregate with the shared F021 publishedConceptStages(conceptId).
Require Concept -> Topic -> Module -> LearningPath -> Technology all PUBLISHED.
Preserve each existing F021 denormalized-reference equality check, including
Concept/Topic moduleId and learningPathId. Merely matching Concept/Topic/Technology
would weaken F021; those five levels remain mandatory.

Within that qualified Concept, join practiceQuestions by conceptId; require
type=OUTPUT, status=PUBLISHED, schemaVersion=1, and question.topicId and
question.technologyId equal the qualified Concept's references. No new question
moduleId or learningPathId is introduced. Missing/mismatched parents and questions
must not contribute to totals. No foreign-key guarantee is attributed to Mongoose
refs; these are read-time service/repository checks.

Apply explicit safe projection inside the question lookup, then one filtered
facet for sorted/paged items and count. Final parent projection removes every
unneeded Concept/join field. The JS DTO reconstructs each allowed property;
never spread raw records. Validate projected values before returning them.
Do not fetch hidden answers to grade, compare, log or sanitize them.

Mongoose select:false does not apply to aggregation and is insufficient even for
normal queries. Tests must seed sentinel answers/explanations/evaluation and prove
their absence from HTTP JSON, metadata, error bodies and client state. No answer
lock flag, correctness hint or hidden HTML answer is introduced. Current access
does not authorize publishing; F047-F051 workflows remain separately scoped.

There are no writes, new indexes, migrations, parent repairs, publication changes,
data seeding or demo-content modifications. Existing question collections may
be empty; the real UI must truthfully show that empty state.

## 5. Proposed authenticated client and isolation contract

Two additional files require owner approval:
apps/web/src/lib/auth/auth-controller.ts and apps/web/tests/auth-controller.test.ts.

Propose an internal trusted-code method:

```ts
runAuthenticatedRead<T>(
  expectedAccountId: string,
  signal: AbortSignal,
  operation: (accessToken: string, signal: AbortSignal) => Promise<T>
): Promise<T>
```

The method accepts no arbitrary browser URL. The fixed-endpoint practice client
owns request construction. The callback receives the token only for the pending
trusted read; it must not retain, log, publish or persist it. AuthState/context
snapshots never contain tokens. No token getter or duplicate refresh state machine.

Before executing: require authenticated, verified ACTIVE STUDENT, matching account,
non-pending auth state, a private token, and an un-aborted signal. Capture the
auth generation and identity; check both again after resolution/rejection. Logout,
identity-change notifications, session restoration and invalidation must make old
results/errors ineligible to update auth or practice state. Reject obsolete work
using a recognizable cancellation result without exposing secrets.

Proposed expiry behavior: no automatic refresh/replay of the practice GET. A
current-generation 401 or eligible-account failure uses existing auth failure
handling, clears protected practice state and returns to normal sign-in/account
recovery. Network/503/429 errors remain local retryable practice errors; they must
not destroy an otherwise valid session. Explicit Retry issues one new read.
Do not change existing login, profile save, refresh coordination or logout behavior.

Practice client: configured API base only, fixed GET path, Authorization bearer,
credentials: omit, cache: no-store, redirect: error, AbortSignal plus existing
15-second request deadline convention. Never put tokens/drafts in URL/query,
broadcast channels or browser storage. Strictly validate response envelope/items,
requested Concept, page/limit, safe totals, totalPages, item bounds and unique IDs;
reject malformed DTOs including unexpected secret fields rather than rendering
partial data. Respect external cancellation through parsing and completion.

Reuse existing controller generation + AbortController architecture. New request
cancels obsolete request; stale success and stale error cannot replace current data.
Hook/controller instances are keyed by authenticated account and Concept. During
auth pending/non-authenticated states immediately stop displaying protected content
and discard the instance; do not rely only on a later effect to hide it.

### Drafts: proposed bounded behavior

- Key each nonempty draft by accountId + conceptId + questionId, inside this page
  instance. No module-global singleton, local/session storage, cookies or writes.
- Preserve edits across pagination and explicit Retry within the same mounted
  account/Concept. Refresh, leaving/unmounting the page, logout, auth invalidation
  or account/Concept change clears them, including switching away and back.
- Each textarea preserves its whitespace and accepts at most **10,000 UTF-16 code
  units**. This is a presentation draft limit, not the future submission contract.
- Proposed cap: **100 nonempty drafts** per page instance (at most 1,000,000 text
  code units). Remove empty entries. At capacity, preserve all existing drafts
  and reject a new nonempty draft with an accessible message offering Clear all
  drafts; never silently evict another question's draft. Per-question Clear draft
  and page-level Clear all drafts are local-only buttons.
- Returned question disappearance must not display its draft under another ID.
  If the same question's prompt/code/language changes on reload, clear its old
  draft and announce the content update. No correctness comparison occurs.
- A local draft is never an attempt. Display: "Draft only. Nothing is submitted
  or saved. Answers and explanations are not available in this increment."
  No Submit, grading, unlock, score, completion or progress controls.

These retention/size rules are proposed owner decisions, not existing F030 data
requirements. Their tests must verify the cap, no silent loss and identity races.

## 6. Student route, presentation and accessibility

Route: /concepts/[conceptId]/practice, inside the existing Student layout's
AuthBoundary and StudentShell. Route params follow the existing async Next.js
page convention. Client-side protected requests start only after eligible auth.
No server-side token forwarding, fixture flag, new test route or auth bypass.

Add a normal "Practice output questions" link to the existing Concept page header,
using its validated Concept ID. Preserve Read/Example/Revise tab order, keyboard
tests and fetching behavior. No fourth mode tab or existing tab assertion edits.
A dedicated practice page provides Back to Concept; no extra catalog read is
needed solely for its generic h1 "Output practice".

Reuse the inspected Concept-learning design's question-card/code hierarchy,
existing CSS Module design tokens/patterns and Student shell. The owner-approved
free-text textarea replaces illustrative Stitch radios. Do not copy CDN code,
inline execution, fabricated progress, XP, paid badges, grading or authored options.

Render each prompt with unchanged ConceptMarkdown at headingBase=3 below an h2
"Question N"; N is the current page offset plus item position, not persisted order.
Render starterCode as escaped React text inside focusable pre/code preserving
whitespace; show supported language as text. Reuse restricted Markdown link/image/
HTML behavior, including HTTPS-only links, noreferrer/noopener, no remote image
loads or executable content. Scoped CSS contains both Markdown/code overflow.

Each textarea has a persistent visible label, deterministic useId-based label
association, instructions and length/limit feedback. No placeholder-only labels.
Native Previous/Next/Retry/Clear buttons; page links or buttons have accessible
names and valid disabled states. No positive tabIndex or global arrow interception.
Visible focus, logical tab order, 44px minimum button targets, responsive wrapping,
and keyboard-scrollable code. Errors use concise role=alert; loading/page changes
use polite status announcements without announcing every keystroke.

Loading clears prior result content while preserving same-instance drafts.
Empty state explains unavailable published OUTPUT questions, without implying
unpublished records exist. Error shows safe message and explicit Retry where useful.
Initial ready/error content and explicit pagination/retry focus use existing
focusRevision patterns; never steal focus while typing or because of an unrelated
auth refresh. Verify 1280x900, 768x900 and 390x900: no document overflow, contained
long code, readable text, zoom/wrapping and contrast. Do not claim exhaustive
assistive-technology coverage from automated assertions.

## 7. Acceptance and staged verification

### Offline implementation gate (separate approval)

- Pure request boundaries: exact identifiers, duplicates/unknown fields, pagination
  defaults/bounds/overflow, unsupported client filtering/sorting and GET body.
- JWT and current-account authorization: missing/invalid/expired token, ADMIN,
  stale token/current-role disagreement, inactive/unverified/deleted user, both
  plans, and no content repository invocation on rejection.
- DTO allowlist, absent/null code normalization, malformed projected data,
  sanitized error and rate-limit/no-store/header behavior. Use injected services/
  clocks and loopback ephemeral HTTP test servers, never a live MongoDB.
- Reused F021 pipeline parity and each ancestry comparison; item/count filtering,
  stable order, empty/out-of-range pages, hidden records and unsupported versions.
- Auth bridge: no token in snapshots; expected-owner guards; logout and
  STUDENT-to-STUDENT switches; stale errors cannot sign out the replacement
  account; expired token follows declared handling without duplicate refresh.
- Client/controller: cancellation, parsing races, duplicate/secret DTO keys,
  wrong Concept/page, pagination, Retry, draft limits/retention/invalidation.
- Rendering: inert teaching code, HTML/XSS-like text, restricted links/images,
  headings/labels, empty/loading/error states, keyboard semantics and focus hooks.
- Relevant existing F030 model, Concept service/routes, User/auth and web
  auth/coordinator/Concept regressions; build, lint, TypeScript, formatting,
  dependency/security and scope checks. Reuse passing evidence; no blind reruns.

### Disposable MongoDB gate (separate approval)

Necessary because F031 adds real joined retrieval/projection behavior despite
having no schema changes. Reuse the approved disposable loopback procedure:
verified test-owned fresh storage/process, PRIMARY before emptiness inspection,
fixed test database and no ambient/persistent fallback. Never use demo storage,
Atlas or port 27017. No new runner/infrastructure.

Synthetic fixtures cover User eligibility, every hierarchy level, mismatched
denormalized references, all statuses/types, answer/explanation sentinels, pagination
and counts; use valid F030 saves. Any deliberately malformed raw fixture is confined
to the disposable test and documented as an invalid stored record, not a supported
writer. Test actual HTTP authorization/projection with test-only signed access
tokens; no application credentials. Confirm no changed collection/index definitions,
no read mutations and no unauthorized data returned. Cleanup only owned fixtures,
connections, database process/storage; retain process/port/cleanup evidence.

### Mounted browser gate (separate approval)

Use existing production-built playwright.f024.config.ts with only practice-output
spec discovery added. Match current route-response synchronization and original
budgets. Mock normal /auth/refresh and /users/me on the real Student route (unlike
the standalone visualization fixture); exercise Authorization headers for practice
GETs without logging token values. Do not inject AuthContext or bypass the route.

Cases: Concept link navigation; valid published questions/empty/error/Retry;
pagination and local draft return; desktop/tablet/mobile; keyboard labels/focus/
code overflow; restricted Markdown; no answer leakage; no draft write requests;
401/403; ADMIN; account/Concept/logout cancellation and stale responses; malformed
DTOs; unexpected external requests. No practice POST or real question provisioning.
Detailed scenario count is determined when specs are implemented, not invented
passing evidence in this plan.

Run F031 separately from F024, F028 and F029 as needed; never let F024 afterAll
close a browser reused by another spec. Before final acceptance discover the
existing 83-scenario baseline plus new F031 cases and execute bounded segmented
regression. Zero automatic retries; combined browser budget 25 minutes; initial
failure diagnosis at most 5 minutes. Stop safely on failure/budget exhaustion,
retain .cache evidence and request approval for corrections. No configuration
consolidation, longer timeouts, fixed sleeps or assertion weakening.

Use ownership/PID+creation-time/Job evidence; terminate only test-owned processes.
Verify jobs empty and ports released; report Windows forced teardown separately.
Retain F024 worker-browser conflict, historical F029 ArrowDown intermittent failure
with inconclusive root cause and independent recovery, segmented-only evidence,
screen-reader/background-throttling and graceful Windows shutdown gaps. No clean
single-invocation regression or production-readiness claim.

## 8. Exact approved implementation inventory and scope decision

Every path below was checked for existence. Create entries are absent before this
planning document; Modify entries exist. No starting-scope file is unnecessary:
the dedicated hook/controller follow existing cancellation architecture; CSS and
tests cover the new surface; API_DESIGN records the new endpoint; app.ts mounts it.
DATABASE_DESIGN and the F030 model need no changes.

Rows 1-27 expand the original inventory. Rows 28-31 were explicitly approved
for authentication-read and publication-pipeline reuse. Row 32 was separately
approved to reconcile the existing Concept rendering regression with the new
Practice link. The former blanket prohibition of Practice text is replaced by
exact Concept-ID routing, accessible native-link semantics and preserved
completion/XP restrictions. Existing rendering/security assertions remain intact.
No other path may change without approval.

| # | Operation | Exact path | Responsibility |
| --- | --- | --- | --- |
| 1 | Create | `docs/features/F031-output-based-questions.md` | Plan, gates, contracts and later evidence |
| 2 | Modify | `docs/DEVELOPMENT_ROADMAP.md` | F031 status/evidence only after implementation approval |
| 3 | Modify | `docs/API_DESIGN.md` | Endpoint, DTO, access and error contracts |
| 4 | Modify | `apps/api/src/app.ts` | Mount protected router; append injection seams |
| 5 | Create | `apps/api/src/modules/practice/practice.schema.ts` | Strict request schemas |
| 6 | Create | `apps/api/src/modules/practice/practice.dto.ts` | Explicit safe item projection |
| 7 | Create | `apps/api/src/modules/practice/practice.repository.ts` | Published joined question retrieval and counts |
| 8 | Create | `apps/api/src/modules/practice/practice.service.ts` | Current Student authorization and list orchestration |
| 9 | Create | `apps/api/src/modules/practice/practice.controller.ts` | Envelope and request translation |
| 10 | Create | `apps/api/src/modules/practice/practice.routes.ts` | Authenticated GET route and middleware ordering |
| 11 | Create | `apps/api/src/modules/practice/practice-rate-limit.ts` | Existing IP/subject limiter pattern |
| 12 | Create | `apps/api/tests/practice.test.ts` | Service/DTO/request/repository unit coverage |
| 13 | Create | `apps/api/tests/practice-routes.test.ts` | Authenticated HTTP/error/rate tests |
| 14 | Create | `apps/api/tests/practice.integration.ts` | Guarded disposable retrieval/projection integration |
| 15 | Modify | `apps/web/src/components/concepts/concept-browser.tsx` | Add normal dedicated-page link; preserve tabs |
| 16 | Create | `apps/web/src/app/(student)/concepts/[conceptId]/practice/page.tsx` | Student Practice route wrapper |
| 17 | Create | `apps/web/src/lib/api/practice-client.ts` | Fixed bearer GET, DTO parsing and cancellation |
| 18 | Create | `apps/web/src/lib/practice/contracts.ts` | Strict frontend DTO/state contracts |
| 19 | Create | `apps/web/src/lib/practice/practice-controller.ts` | Request generations, pagination and local drafts |
| 20 | Create | `apps/web/src/hooks/use-practice.ts` | Bind auth identity/controller lifecycle |
| 21 | Create | `apps/web/src/components/practice/practice-browser.tsx` | Accessible question/draft/pagination states |
| 22 | Create | `apps/web/src/components/practice/practice-browser.module.css` | Scoped responsive and code/focus styles |
| 23 | Create | `apps/web/tests/practice-client.test.ts` | Client response/security/cancellation tests |
| 24 | Create | `apps/web/tests/practice-controller.test.ts` | Draft/request/account isolation tests |
| 25 | Create | `apps/web/tests/practice-rendering.test.ts` | Markdown/code/accessibility rendering tests |
| 26 | Create | `tests/browser/practice-output.spec.ts` | Mounted mocked-API Student acceptance |
| 27 | Modify | `playwright.f024.config.ts` | Add spec testMatch only; preserve production server |
| 28 | Modify (scope addition) | `apps/web/src/lib/auth/auth-controller.ts` | Guarded authenticated read; no public token getter |
| 29 | Modify (scope addition) | `apps/web/tests/auth-controller.test.ts` | Auth-generation and read-operation regression tests |
| 30 | Modify (scope addition) | `apps/api/src/modules/concepts/concept.repository.ts` | Export/reuse existing published Concept pipeline |
| 31 | Modify (scope addition) | `apps/api/tests/concept.test.ts` | Existing pipeline parity and shared-builder regression tests |
| 32 | Modify (scope addition) | `apps/web/tests/concept-rendering.test.ts` | Approved Practice-link compatibility; preserve rendering/security and completion/XP restrictions |

The two auth additions enable protected GETs without duplicating auth/token storage.
The two Concept additions reuse canonical publication checks without copying them.
They preserve existing feature behavior and require relevant regression coverage.
No shared package, model, schema index, dependency, environment setting, root
Playwright configuration, fixture route or existing browser spec change is proposed.

## 9. Approved owner decisions (historical proposal record)

All decisions below were approved before implementation. The boundary was later
expanded by one compatibility-test file to exactly 32, as recorded above.

1. Approve the recommended **31-file boundary**, including four narrowly scoped
   additions, or request a revised design. Original 27-file scope cannot deliver
   the proposed reusable auth/publication approach unchanged.
2. Approve proposed exact list DTO/error behavior, _id ASC ordering, pagination
   10/default and 20/max, existing 300/IP + 120/subject rate budgets, and supported
   version filtering. These are explicit refinements, not claims of prior approval.
3. Approve the guarded auth read bridge and no automatic practice-GET refresh/
   replay; normal sign-in recovery remains available. Approve current account
   eligibility checks and FREE/PREMIUM parity without new entitlement policy.
4. Approve draft limits/retention/cap behavior and the truthful no-submission UI.

No conflict with the owner's explicit boundary remains; the previous public-read,
radio-choice and full submission interpretations are superseded. Admin authoring/
preview/publishing, answer authorization/unlocking, attempts, grading, progress,
other question types, code execution, AI, source fetching, migrations and demo-data
updates remain excluded.

**Historical gates at plan approval:** complete offline implementation verification with F031 IN_PROGRESS.
Live disposable MongoDB and mounted browser execution each require separate owner
approval; final review/status transition and Git delivery remain later gates.

## 10. Offline implementation verification (2026-10-17)

F031 remains **IN_PROGRESS**. The owner-approved scope is exactly 32 files:
22 feature additions (including this plan) and 10 modifications. The only expansion
beyond the prior 31-file inventory is the Concept rendering compatibility test.
No dependency, F030 schema, index, fixture guard or application environment changes.

- Relevant offline API/auth/account/Concept/practice regressions: **75/75 PASS**.
  Includes GET-body rejection for non-JSON and chunked bodies before content reads,
  query validation, JWT/current-Student eligibility, rates, publication pipeline
  parity, safe projections and existing errors. All storage is mocked; loopback
  ephemeral HTTP test servers close in finally blocks. No live MongoDB execution.
- Full offline web regressions: **181/181 PASS**. The obsolete blanket Practice-text
  prohibition is replaced by exact Concept-ID link assertions, accessible name,
  native tab/Enter semantics without overriding handlers, and no Topic-page link.
  Existing escaped rendering, safe source links and completion/XP restrictions
  remain asserted. Actual mounted keyboard/focus behavior is still NOT_VERIFIED.
- Workspace TypeScript: **PASS**, including prepared MongoDB test compilation.
  Separate in-memory TypeScript check of the prepared Playwright spec/config: PASS.
- Repository lint and formatting checks: **PASS**. Docs remain excluded by the
  existing Prettier policy; documentation and roadmap LF are checked separately.
- Production build: **PASS** for shared packages, Student web, Admin and API.
  The new Practice route builds successfully; no application server was started.

Security review confirms authenticated STUDENT-only OUTPUT reads, the complete
F021 five-level publication/reference predicates, an early database allowlist plus
explicit seven-field DTO reconstruction, no answer/explanation/evaluation exposure,
restricted Markdown and escaped inert code, account/Concept keyed components,
request cancellation/generation guards and memory-only bounded drafts. Mongoose
select is not treated as authorization. No submission, grading or persistence.

The earlier 180/181 web result was caused by the now-authorized compatibility
assertion and is superseded by the 181/181 passing run. Initial setup/type errors
were corrected within scope; no test timeout, assertion strength or retry policy
was relaxed. Existing Mongoose validateSync deprecation warnings are retained.

Prepared mounted coverage has 14 cases by static source enumeration (not a runner
discovery or execution result). Disposable MongoDB and browser verification remain
separately authorized gates. No mounted responsiveness, focus, screen-reader or live
publication/projection result is claimed here. Preserve the F024 worker-browser
conflict, unresolved recovered F029 scrolling event, segmented-regression policy,
background-throttling and Windows shutdown limitations. F032 stays NOT_STARTED.

## 11. Owner-authorized MongoDB verification (2026-10-17)

**Integration PASS: 5/5 including the parent test (four substantive checks).**
The single authorized rerun used `node --import tsx --test
apps/api/tests/practice.integration.ts`, with zero retries, failures, skips or
cancellations. Node test duration was 4.40 seconds; the complete disposable
startup/test/cleanup procedure took 9.83 seconds.

The first execution failed during User fixture creation because no authentication
capability was supplied. Its evidence remains at
`.cache/f031-integration-2026-10-17-11-12-15/`. The separately approved correction
adds only a synthetic GOOGLE provider identity to that fixture, following existing
User tests. No real credentials, external authentication, validation bypass or
assertion changes were introduced. File formatting, lint and API TypeScript checks
passed; previously passing API/web suites were not repeated.

- **Isolation preflight PASS:** fresh current-user-owned temporary storage,
  `127.0.0.1:27018`, replica set `f021-test`, database `deeplearner-f021-test`.
  Process executable, parent, creation-time identity, native Job membership and
  loopback listener ownership were verified before connecting. Server options/PID
  confirmed the owned path. PRIMARY readiness preceded database inspection; no
  non-system database or target collection existed before fixtures. Explicit
  child-environment allowlisting prevented inherited database/credential fallback.
- Live repository checks passed for published OUTPUT/version filtering, all five
  ancestor publication checks, inconsistent references, stable _id ordering,
  pagination, inert code preservation, null normalization and unchanged stored
  questions after reads. Malformed eligible data produced sanitized unavailability.
- Live HTTP checks passed for authenticated Student retrieval, unauthenticated
  rejection, current non-Student/suspended/unverified rejection, sensitive-content
  exclusion and nonmutating reads. The shared DTO explicitly reconstructs exactly
  seven fields. Exact-key, strict identifier/query, maximum-limit, rate-limit and
  GET-body assertions retain the prior 75/75 offline evidence; these were not
  independently repeated as new live cases. No broader live coverage is claimed.
- Declared Practice indexes remain unchanged and automatic index creation remains
  disabled; the disposable collection had only its automatic _id index.
- **Cleanup PASS:** all seven test-owned collections were removed by the test,
  connections closed and independent readback found no remaining target collections.
  Owned MongoDB PID 6496 exited gracefully with code 0; shutdown helper exit 0,
  Job active count 0, port released, no forced termination. Only verified disposable
  storage was removed. Persistent demo-storage file-size/write-time metadata and
  baseline MongoDB PID/creation-time identity matched before/after. No Atlas,
  port 27017, demo database/account/content or persistent storage access occurred.

Retained rerun evidence:
`.cache/f031-integration-2026-10-17-11-15-16/` (owner/process records,
initialization/integration/shutdown logs, mongod log and result.json).
No application defect was found in the exercised paths. F031 remains
**IN_PROGRESS**, ready for separately authorized mounted browser verification.
Existing browser/accessibility and release limitations remain; no browser, Git,
dependency or F032 work was performed in this gate.


## 12. Final review with owner-approved regression exception (2026-10-17)

**FINAL REVIEW PASS WITH ONE-TIME REGRESSION EXCEPTION.**
**Current status: APPROVED_COMPLETE (owner-approved local-development acceptance).**
This does not authorize production or claim full browser regression PASS.

The owner explicitly approved this one-time exception after reviewing the retained
F031 evidence and Windows teardown risk. AGENTS.md requires owner control,
verification and an honest report; it contains no express prohibition on this
owner-approved exception. The normal full-regression and smoke requirements are
qualified only for this F031 acceptance gate. They are not silently satisfied or
generally waived. No substantive F031 defect was identified. The owner subsequently
approved completion and feature-only Git delivery for local development.

### Acceptance and scope review

- Exactly **32 approved files: 22 new and 10 modified** (Section 8). Filesystem
  enumeration and retained pre-implementation hashes found no additional source
  changes. The feature plan already existed at that hash checkpoint; it remains
  classified as a new F031 file. No Git commands were used.
- Existing security middleware protects the GET endpoint. JWT and current-user
  STUDENT/ACTIVE/email-verified checks precede retrieval. IP/subject limits retain
  300/120 requests per 15 minutes and existing sanitized error contracts.
- Strict query/identifier validation, safe pagination arithmetic, _id ASC ordering,
  and JSON/non-JSON/chunked GET-body rejection match the approved contract.
- Reused F021 stages check published Concept, Topic, Module, LearningPath and
  Technology and consistent ancestry. Questions additionally require OUTPUT,
  PUBLISHED, schemaVersion 1 and consistent Concept/Topic/Technology references.
- Aggregation projection and independent DTO construction expose exactly id,
  conceptId, type, difficulty, prompt, starterCode and language. Answer,
  explanation, evaluation and provenance remain excluded independently of select.
- Drafts remain memory-only, scoped by account/Concept/question, capped at 100
  drafts and 10,000 characters each. Identity-keyed mounts, cancellation, request
  generations and guarded authenticated reads suppress stale responses. Changed
  authored content clears affected drafts; no persistence or submission exists.
- Restricted Markdown, inert escaped code, native Concept links, labelled inputs,
  focus handling, responsive containment, loading/empty/error/Retry and pagination
  are supported by the reviewed implementation and F031 mounted tests.
- Retain API **75/75**, web **181/181**, MongoDB **5/5 including parent**, and
  build/lint/TypeScript/formatting/security evidence. MongoDB coverage and cleanup
  retain Section 11's limits. No tests were repeated during this final review.

### Exact browser disclosure

| Group | PASS | FAIL | NOT_RUN |
| --- | ---: | ---: | ---: |
| F031 | 14 | 0 | 0 |
| F022/F025 | 26 | 1 | 0 |
| F023 | 0 | 0 | 16 |
| F024 | 0 | 0 | 19 |
| F028 | 0 | 0 | 13 |
| F029 | 0 | 0 | 7 |
| Smoke | 0 | 0 | 1 |
| **97 distinct scenarios** | **40** | **1** | **56** |

F031 reconciles six initial passes, one independently recovered alert-locator case
and seven later passes. Retain the original locator failure; both affected alert
locators were scoped to the existing Output questions region without weakening
application assertions.

F022's final scenario completed its functional assertions, but afterAll raised
EPERM at concept-read.spec.ts:516 during process.kill(pid, 0). Its suite did not
complete successfully. The exact historical failing PID/cause remains INCONCLUSIVE.
It is not relabelled PASS. This is incomplete segmented regression, not 97/97 PASS
or an uninterrupted clean combined run.

Retained evidence:
- .cache/playwright/results/f031-final-2026-10-17-11-18-10/f031/report.json
- .cache/playwright/results/f031-recovery-2026-10-17-11-24-09/
  (recovery, remaining, f022-f025 and reconciled-evidence.json).
- .cache/f031-integration-2026-10-17-11-15-16/.

Browser cleanup reported empty owned jobs, released ports, unchanged baseline
MongoDB identity and no launcher-forced Job cleanup. Playwright used its existing
forced Windows taskkill path. These observations do not prove historical unrelated
process continuity or eliminate PID-reuse risk. The owner separately confirmed
PowerShell 7.6.7 compile-only PASS for the temporary diagnostic helper/collector
and public types/methods; compilation does not establish runtime teardown safety.
Primary-host diagnostic execution remains BLOCKED. The temporary package and
manifest were not changed during this review.

### Shared-component risks and retained limitations

The shared auth read bridge and extracted Concept publication stages have focused
offline coverage, F031 mounted coverage and live publication checks. Wider browser
compatibility remains incomplete: the 56 NOT_RUN cases include Example/Revise,
visualization controls/lesson and smoke behavior. Cross-feature authentication,
session, navigation or rendering regressions could remain undetected. This risk
is accepted only for the owner's one-time local-development exception. Prior
feature passes are not represented as a current full-regression pass.

Preserve F024's cross-suite worker-browser lifecycle conflict; historical F029
ArrowDown intermittent failure, inconclusive cause and independent recovery;
segmented-only evidence; exhaustive screen-reader and actual background-throttling
gaps; Windows graceful-shutdown limitations and taskkill PID-reuse risk. No
production-readiness or safe primary-host diagnostic execution claim is made.
Submissions, unlocking, scoring, attempts/progress persistence, Admin authoring,
publishing, other question types and code execution remain deferred.

### Separate follow-ups and next gate

1. Review/correct F022 Windows teardown and PID identity handling under separate
   approval. Preserve creation-time/handle/Job ownership checks; EPERM is neither
   permission to terminate nor proof of absence. Establish safe execution or
   separately approved containment before further diagnostic/browser execution.
2. Resolve F024's shared worker-browser cleanup conflict through separately
   approved maintenance before claiming compatible combined execution.
3. Complete the 56 NOT_RUN scenarios after safe execution is established and
   bounded verification is separately approved. Preserve the failed F022 result
   and this incomplete-regression disclosure even after later recovery.
4. Investigate F029 keyboard scrolling from retained evidence if it recurs; its
   independent pass does not establish a permanent correction.

These follow-ups are not F031 implementation changes or assigned dependencies
without supporting evidence. No follow-up execution is authorized by this review.
F001-F030 remain APPROVED_COMPLETE; F032 remains NOT_STARTED.
Owner completion and feature-only Git delivery are explicitly authorized.
Further remediation and F032 planning require separate approval; no deployment.

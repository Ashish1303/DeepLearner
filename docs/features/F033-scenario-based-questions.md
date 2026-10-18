# F033 - Scenario-Based Questions

**Status:** APPROVED_COMPLETE
**Plan date:** 2026-10-18
**Planning result (historical):** PLAN READY; implementation was separately approved below.

**Current acceptance (2026-10-18):** APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY,
following FINAL REVIEW PASS WITH F033 BROWSER EXCEPTION and explicit owner
completion approval. See Sections 10-11. Browser verification remains NOT_RUN;
production deployment and complete browser-regression acceptance are not approved.

**Implementation approval (2026-10-18):** Owner authorized the exact Section 5
17-file scope and offline verification. At that gate implementation became IN_PROGRESS;
MongoDB/browser execution remained separately gated and no browser exception was granted.

**Historical planning authorization:** The owner authorized creation of this document only, using the exact 17-file
boundary below. No implementation, roadmap/status edit, test, service, database,
browser, infrastructure or Git operation is authorized by this planning gate.
F001-F032 remain APPROVED_COMPLETE; F034 remains NOT_STARTED and out of scope.
No F033 browser exception had been granted at the planning gate.

## 1. Authority, objective and dependencies

Sources: AGENTS.md; DEVELOPMENT_ROADMAP.md; PRD sections 23-24;
SYSTEM_ARCHITECTURE.md module/layer boundaries; DATABASE_DESIGN.md practiceQuestions
and its approved F030 refinement; API_DESIGN.md F031/F032 retrieval; completed
F021, F030, F031 and F032 feature contracts; current Practice code and tests.
The Concept-learning Stitch screen.png and code.html were inspected as design
references during read-only planning. Existing Practice components/CSS are the
implementation reference; generated scripts, CDN assets, quiz controls and XP
illustrations do not expand this feature.

The roadmap names F033 **Scenario-Based Questions** and gives no detailed
requirements or explicit dependency list. The owner has now approved this boundary:
extend the existing Student Practice experience with canonical SCENARIO retrieval
and local free-text drafts alongside OUTPUT and DESCRIPTIVE.

Implementation prerequisites are F030's existing question model, F031's authenticated
Practice API/page and guarded authenticated read, F032's type selection/draft
lifecycle, and F021's reused complete publication/ancestry pipeline. These are
engineering dependencies derived from existing contracts, not additional roadmap
requirements. No new page, endpoint, model, persisted field or dependency is needed.

The Student can read eligible questions and edit local drafts. This does not
complete PRD's attempt -> answer unlock -> explanation flow. Admin authoring,
publication actions, submissions, scoring and progress remain deferred.

## 2. API, validation and response contract

Reuse `GET /api/v1/practice-questions?conceptId=<24-hex>&type=SCENARIO&page=1&limit=10`.

### Request and compatibility

- Optional single-valued type accepts exactly OUTPUT, DESCRIPTIVE or SCENARIO.
  Missing type continues to default to OUTPUT. Explicit OUTPUT and DESCRIPTIVE
  retain existing behavior. CODING remains unsupported in retrieval; no aliases
  such as SCENARIO_BASED or OUTPUT_BASED are introduced.
- Reject empty, padded, lowercase, null-like, array/object, nested, duplicate,
  coerced and unsupported type values. Never silently substitute another type.
- Preserve strict required 24-hex conceptId, lowercase normalization, unknown-key
  rejection, empty route params, and existing GET-body rejection, including
  non-JSON and chunked bodies. No new filters, sorting or query metadata.
- Page is a positive decimal safe integer, default 1. Limit defaults to 10,
  maximum 20. Preserve safe-integer offset checks and `_id ASC` ordering.
  Pagination is stable for a fixed dataset, not a concurrent-publication snapshot.
- Preserve the existing response envelope, errors, middleware and modular-monolith
  flow. Routes, controller, service, rate limiters and repository stay unchanged.

### Authentication, publication and reference consistency

Require bearer authentication and both token/current-user STUDENT eligibility,
ACTIVE account and verified email through F031. ADMIN is not an alternative preview
role. FREE/PREMIUM parity, no-store, CORS and request-ID conventions are unchanged.
Retain shared 300/IP and 120/subject limits per 15 minutes; switching types must
not create separate limiter buckets, bypass limits or add hidden retries.

Reuse unchanged `publishedConceptStages`: Concept -> Topic -> Module ->
LearningPath -> Technology must all be PUBLISHED, with every F021 denormalized
reference comparison intact. The existing repository already takes the requested
type, filters eligible questions before the items/count facet and validates
returned Concept/type identity. Its implementation needs no F033 edit.

Questions must match the requested canonical type, PUBLISHED, schemaVersion 1,
the requested Concept, and its consistent Topic/Technology references. Hidden,
wrong-type or inconsistent questions are excluded from both items and totals.
Missing/hidden/inconsistent parents are unavailable through existing generic
errors. Do not fetch answers or repair stored content during reads.

Model identifier validation alone is not reference/publication authorization.
No publishing permission, lifecycle mutation, Admin authority check, record repair,
migration, index change or automatic collection/index creation is added.

### Seven-field DTO and errors

Preserve the exact success shape:

`{success:true,data:[...],message:null,meta:{requestId,page,limit,total,totalPages}}`

| Field | Exact retained contract |
| --- | --- |
| id | Lowercase 24-hex question ObjectId string |
| conceptId | Requested Concept's lowercase 24-hex ObjectId string |
| type | OUTPUT / DESCRIPTIVE / SCENARIO; equals requested type |
| difficulty | BEGINNER / INTERMEDIATE / ADVANCED / INTERVIEW_READY |
| prompt | Trimmed nonblank restricted Markdown input; 1-50,000 UTF-16 code units |
| starterCode | Nonblank inert question-context text, 1-50,000 code units with formatting preserved, or null |
| language | JAVASCRIPT / TYPESCRIPT / null; non-null supported language required when code is non-null |

Language without code remains valid. Absent code/language normalize to null only
in the DTO. SCENARIO code is question context, never a stored executable solution.
Reuse explicit database projection and DTO reconstruction, independently of
Mongoose select. Exclude answer, explanation, evaluation, provenance, lifecycle,
timestamps, schemaVersion, __v, joins and every unapproved field. No new response
metadata or answer-access authorization is introduced.

Preserve 200 empty/out-of-range lists with accurate type-filtered totals;
400 VALIDATION_ERROR; existing 401 token and 403 account/role errors;
404 USER_NOT_FOUND or CONCEPT_NOT_FOUND; 429 RATE_LIMIT_EXCEEDED; sanitized
503 DEPENDENCY_UNAVAILABLE for database/malformed eligible data failures.
No new error code or hidden-content disclosure. Eligible malformed DTOs fail
closed instead of falling back to another type or rendering partial data.

## 3. Student UI and request lifecycle

Reuse `/concepts/[conceptId]/practice`, the existing page wrapper, Student shell,
AuthBoundary, Concept Practice link, hook and account/Concept-keyed controller.
Initial selection remains OUTPUT. Do not persist selected type in URL, browser
storage or cookies; do not add deep links or remount the controller by type.

Add Scenario to the existing native Question type button group. Keep Output and
Descriptive accessible names/copy compatible. Each button uses type=button,
aria-pressed and existing visible focus; retain visible selected-type text.
Use normal Tab/Enter/Space behavior, not custom tab/radio keyboard semantics.
All controls remain mounted and type switching remains available during loading.

Scenario copy: Scenario practice; Scenario questions; Your scenario answer for
Question N. Retain the draft-only/no-submission disclaimer, labelled textarea,
character count, concise status, loading/empty/error/Retry states and application
alert scoped to its question region. Scenario is free text, not multiple choice.

On a different valid type, synchronously abort superseded work and invalidate its
generation; set type/page 1, remove old visible items/errors/notices, invalidate
pending clear confirmation and issue one read for the new type. Same-type selection
is a no-op; Retry remains explicit. Previous/Next and Retry use the current type.
The existing list has no separate active-question index: resetting means the new
page-1 list, not adding a selection model or carrying focused question state.

Preserve focus on the activated type button when replacement results arrive; do
not auto-focus the textarea or increment heading-focus revision for type changes.
Retain initial-load, explicit pagination and Retry heading-focus behavior. No
focus stealing while typing, positive tabIndex or global arrow interception.

Preserve abort and generation checks, including OUTPUT -> SCENARIO -> OUTPUT,
delayed success and delayed errors. Obsolete results must not change visible data,
draft stores or replacement-account auth state. Reuse runAuthenticatedRead and
its token/account-generation checks unchanged; no duplicate refresh mechanism.

Extend existing defaulted client type argument and strict frontend type schema.
Keep OUTPUT's no-type URL compatible; send explicit type=DESCRIPTIVE or
type=SCENARIO for the corresponding read. Do not retain the current two-way
DESCRIPTIVE-only URL branch for SCENARIO. Validate requested type before fetching
and response Concept/type/page/limit, safe totals, ordered unique IDs and exact
envelope/DTO shape. Preserve credentials omit, no-store, redirect error, 15-second
request deadline and safe error categories. No token or draft enters a URL/log.

## 4. Three-type drafts, clearing and presentation safety

Add SCENARIO to the existing private per-type draft/fingerprint stores. Logical
identity remains account + Concept + type + question ID; expose only the active
type's drafts to the view. Identical IDs in separate types must not share text.

- Retain drafts across type changes, pagination and explicit Retry during the
  same mounted eligible account/Concept lifetime. Do not call destructive cancel()
  merely to switch type.
- Preserve 100 nonempty drafts TOTAL across all three stores per page instance,
  not 100 per type. Maximum 10,000 UTF-16 code units per draft, preserving whitespace.
  Empty strings remove entries. Current behavior does not silently evict: reject
  a new 101st entry with an accessible notice; edits to existing entries remain
  possible. No TTL, LRU or new eviction policy is introduced.
- Per-question clearing affects only the active type/question. Clear all drafts
  first opens the existing labelled inline confirmation. Explain that it covers
  Output, Descriptive and Scenario for this account/Concept only. Confirm clear
  all drafts clears all three draft/fingerprint stores; Keep drafts preserves them.
  Both actions restore focus to Clear all drafts.
- Retain instance-local non-null confirmation sequence checks. Edits, replacement
  requests, type changes, cancellation and identity disposal invalidate pending
  confirmation. Null/stale tickets cannot delete drafts or cross account/Concept
  lifetimes. Opening confirmation alone never deletes work.
- Logout, ineligible/pending authentication, account/Concept change, navigation
  away, reload or unmount discards all three stores and aborts/invalidates work.
  Returning to a former identity must not recover discarded memory. A disposed
  controller callback cannot clear another controller's scope.
- Preserve prompt/code/language fingerprint invalidation and accessible notice
  when a returned question's authored context changed. An absent question's draft
  cannot be attached to a different question. A stale typed edit cannot affect
  the currently selected type.

No draft persistence, storage APIs, cookies, broadcasts, server writes, answer
comparison or logging. This is local editing, not an attempt or progress record.

Reuse ConceptMarkdown with headingBase 3, existing safe link rules, blocked raw
HTML/images and escaped React text for code/drafts. Never eval/execute starterCode,
inject HTML or fetch authored URLs. Preserve optional code/language rules.
Reuse existing CSS wrapping controls, textarea/card styling, 44px button targets,
visible outlines and focusable contained code overflow. No CSS/design redesign.

Future mounted acceptance should check 1280x900, 768x900 and 390x900, readable labels,
wrapping, document containment and genuine code overflow. Require keyboard scrolling
only where scrollWidth/clientWidth or scrollHeight/clientHeight establishes actual
overflow; otherwise verify containment and readability. Do not bypass required
mobile overflow if present. Offline focus wiring is not mounted accessibility or
exhaustive screen-reader evidence.

## 5. Exact implementation inventory and architecture review

This gate creates ONLY this plan. The approved boundary for a separately approved
implementation is 17 unique paths: two planned creations including this document
and fifteen existing-file modifications. At implementation time this plan already
exists; no extra file is implied by the create classification.

| # | Operation | Exact path | Responsibility |
| --- | --- | --- | --- |
| 1 | Create (planning gate only now) | docs/features/F033-scenario-based-questions.md | Contract, scope, acceptance and future evidence |
| 2 | Create (implementation gate) | tests/browser/practice-scenario.spec.ts | Prepared mounted Scenario/three-type coverage |
| 3 | Modify | docs/DEVELOPMENT_ROADMAP.md | Future approved F033 status/evidence only |
| 4 | Modify | docs/API_DESIGN.md | Add SCENARIO retrieval while retaining prior contracts |
| 5 | Modify | apps/api/src/modules/practice/practice.schema.ts | Three exact query types; default OUTPUT |
| 6 | Modify | apps/api/src/modules/practice/practice.dto.ts | SCENARIO accepted within the same seven-field construction |
| 7 | Modify | apps/api/tests/practice.test.ts | Query, DTO, unchanged pipeline/service and compatibility tests |
| 8 | Modify | apps/api/tests/practice-routes.test.ts | Three-type HTTP/auth/rate/body/error/default tests |
| 9 | Modify | apps/api/tests/practice.integration.ts | Disposable real Scenario reads, ancestry, pagination and secrecy |
| 10 | Modify | apps/web/src/lib/practice/contracts.ts | Three canonical frontend types; unchanged strict envelope |
| 11 | Modify | apps/web/src/lib/api/practice-client.ts | Correct requested-type URL and response identity validation |
| 12 | Modify | apps/web/src/lib/practice/practice-controller.ts | Third draft store, shared bounds and clearing/status wording |
| 13 | Modify | apps/web/src/components/practice/practice-browser.tsx | Scenario button, labels and three-type confirmation copy |
| 14 | Modify | apps/web/tests/practice-client.test.ts | URL/default/type/response/cancellation cases |
| 15 | Modify | apps/web/tests/practice-controller.test.ts | Three-type retention, races, capacity, confirmation and isolation |
| 16 | Modify | apps/web/tests/practice-rendering.test.ts | Names, pressed state, focus wiring, states and safe rendering |
| 17 | Modify | playwright.f024.config.ts | Add only practice-scenario.spec.ts discovery |

Repository, routes, service/controller, shared auth, publication helper and rate
limiters already support validated query pass-through and remain unchanged.
The model already stores SCENARIO; DATABASE_DESIGN.md needs no amendment. The
existing hook handles stable account/Concept lifetime independently of type;
the page wrapper, Concept link, CSS and old browser specs need no planned edit.
No shared package, environment variable, dependency or new infrastructure.

Existing tests that assert SCENARIO is unsupported must be updated within the
approved API test files: accept SCENARIO under the new contract and retain negative
coverage using unsupported CODING/SCENARIO_BASED and malformed values. In integration,
the existing Scenario fixture becomes a positive requested-type fixture while
remaining excluded from OUTPUT/DESCRIPTIVE results. This is a contract extension,
not removal of validation. Keep all unrelated assertions intact.

No missing path or architectural conflict was identified. If implementation needs
another file, an old browser-spec correction, CSS adjustment or shared-auth/
publication change, stop for explicit scope approval before editing it. Do not
manufacture edits to files that already satisfy the requirements.

## 6. Acceptance and verification gates

### A. Offline implementation gate - separate approval

1. Missing type and explicit OUTPUT remain compatible; DESCRIPTIVE and SCENARIO
   select only the requested type. Invalid/duplicate/nested/unknown inputs and
   GET bodies retain strict rejection and existing safe errors.
2. Require STUDENT/current eligible account before content reads. Preserve
   authentication failures, shared rate limits, no-store and standard envelopes.
3. Prove unchanged five-level pipeline reuse, reference predicates, PUBLISHED/
   schemaVersion filtering, type-specific counts/pagination and `_id ASC` order.
4. Explicitly verify all seven DTO keys and forbidden-field exclusion with
   secret-bearing raw fixtures. Malformed/wrong-type projected data fails closed.
5. Client tests cover all three URLs, unchanged OUTPUT default, malformed/mixed/
   wrong-type/Concept responses, aborts and no implicit request retries.
6. Controller tests cover OUTPUT/DESCRIPTIVE/SCENARIO round trips, identical IDs
   across types, page reset, same-type no-op, stale success/error, pagination and
   Retry retention, fingerprints, per-question clear and account/Concept disposal.
7. Exercise 100 combined drafts and rejection of the 101st, 10,000-unit boundary,
   no silent eviction, confirmed all-three clearing, canceled/stale/null tickets,
   stale typed edits and old-identity callbacks. No persistence or answer writes.
8. Rendering tests cover all names/states, native pressed buttons, focus wiring,
   Scenario textarea, confirmation wording/actions, restricted Markdown and inert
   code. Preserve OUTPUT/DESCRIPTIVE behavior and forbidden submit/unlock/score/XP
   controls. Source assertions are not mounted browser acceptance.

Use existing Node test infrastructure. Run relevant API/web regressions, including
shared auth/Concept behavior, then build, lint, TypeScript, formatting and security/
scope review. Browser spec/config static checks may compile without executing
Playwright. Reuse unaffected evidence appropriately; no redundant repeated suites
without a changed requirement or failure. No dependency installation.

### B. Disposable MongoDB integration - separate execution approval

Extend the existing practice.integration.ts; do not create another harness.
Use synthetic mixed OUTPUT/DESCRIPTIVE/SCENARIO fixtures plus excluded CODING,
unpublished/version-invalid and reference-inconsistent records. Verify requested
type/default HTTP behavior, actual filtering/counts/pagination/order, each published
ancestor/reference requirement, exactly seven DTO fields, no answer/explanation/
evaluation/provenance, eligibility rejection and non-mutating retrieval.

Before connecting, require fresh owned disposable storage, exact loopback
127.0.0.1:27018, replica f021-test, database deeplearner-f021-test, writable PRIMARY
and an empty verified test target. Guard startup with the unchanged ownership
helper/procedures; protect existing port 27017 MongoDB and deeplearner-local-demo,
all persistent accounts/content, Atlas and production. No application credentials,
shared settings or persistent fallback. Unknown identity/isolation means stop.

Run once, zero retries; preserve evidence. Close all test connections, remove only
verified test-owned data/storage, stop only owned processes, verify Job emptiness,
port release and unchanged protected baseline/demo metadata. No broad PID cleanup.
Failure requires safe cleanup and separate correction approval, not automatic rerun.

### C. Prepared browser coverage - execution remains prohibited

Prepare practice-scenario.spec.ts using existing production-built configurations,
synthetic mocked HTTP and current fixture-isolation conventions. Do not create a
route, new configuration or browser harness. Preserve server-only visualization
fixture isolation; no real database/account connection is part of browser mocks.

Proposed seven independently named scenarios (runtime/discovery NOT_VERIFIED):

| Planned cases | Mounted acceptance |
| --- | --- |
| 1-3: 1280, 768 and 390 widths | Default OUTPUT, Scenario selection, pressed state, keyboard/focus, safe Markdown/code, textarea, wrapping and genuine overflow |
| 4: three-type round trip | Page reset, retained separate drafts and confirmed/canceled all-type clearing |
| 5: Scenario states/security | Loading, empty, error/Retry, wrong-type/secret-bearing payload rejection, no executable markup or unauthorized requests |
| 6: superseded work | Delayed Scenario success/error cannot replace the selected type or its drafts |
| 7: identity lifetime | Account/Concept replacement/logout clears all stores and invalidates confirmation; no persistence or writes |

The draft capacity/bounds and detailed race matrix remain focused-test requirements;
seven browser cases are not a claim of exhaustive accessibility or concurrency.
Do not change assertions/timeouts, use fixed sleeps or add retries to obtain PASS.

**Do not run Playwright on the primary host.** Ownership-safe execution requires
separate approval; do not restart infrastructure investigation, modify/delete/run
the temporary prototype, use cloud/paid services or introduce virtualization.

If execution becomes approved, discover actual counts first and retain all existing
104 expected cases plus the proposed seven: expected 111, not a discovered count
or passing result. Keep F024 separate from F028/F029 and other affected shared-worker
groups. Use bounded segmented regression, zero retries, 25-minute combined browser
budget and five-minute initial diagnosis. Preserve assertions/timeouts and stop on
failure or unsafe cleanup; verify ownership, empty Jobs and released ports.
Never label segmented results a clean single-invocation regression PASS.

If browser safety remains blocked, propose a NEW F033-specific local-development
exception for owner review after mandatory offline/database evidence. Record exact
prepared/discovered NOT_RUN coverage, actual evidence, responsive/focus/accessibility,
real-browser account/draft race and shared-component risks, future verification,
explicit owner acceptance and non-transferability. No exception is granted here.
Manual browser inspection is supplemental only and separately authorized, not a
replacement for automation. Security/API/applicable database tests cannot be waived.
Production requires a separate browser-regression and release-readiness decision.

## 7. Historical evidence, exclusions and approval handoff

Preserve F031's historical regression: 40 PASS / 1 FAIL / 56 NOT_RUN of 97;
its 14 distinct F031 cases have passing evidence including the recovered locator
failure. F022 functional assertions passed but afterAll EPERM failed the suite;
its exact cause remains inconclusive. Do not convert this into full regression PASS.

Preserve F032's 7 mounted NOT_RUN and expected complete 104 NOT_RUN INCLUDING those
seven. F032's API 63 distinct PASS, web 189 distinct PASS, MongoDB 6/6 PASS and
static/security evidence belong to F032, not new F033 verification. F032's explicit
local-only exception does not transfer. The earlier 56 unexecuted compatibility
cases remain outstanding within later expected regression coverage; do not add
them again as separate cases when computing totals.

Retain F022 Windows taskkill PID-reuse/ownership risks; F024 worker-browser lifecycle
conflict; F029 intermittent ArrowDown failure with independent recovery and unknown
root cause; and screen-reader/background-throttling/Windows graceful-shutdown gaps.
The closed custom prototype's Gate 1 and Gate 2 synthetic 10/10 PASS each do not
verify Playwright: positive /T unsupported, fallbacks unverified, native/internal
bypasses uncontrolled. No further prototype work is part of F033.

Excluded: F034/CODING retrieval/UI, new authored questions or demo content, Admin
authoring/preview/publishing, submissions/attempts, unlocking/answer disclosure,
explanations, grading/scoring, evaluation, progress/XP, code execution, persistent
drafts, model/index changes, new routes/endpoints, dependencies, infrastructure,
deployment and automatic inheritance of any prior exception.

No unresolved product-contract or inventory conflict is identified. The owner has
approved the three-type behavior, shared draft limits and scoped confirmation for
planning. Next gate: explicit implementation approval for these 17 paths and offline
verification only. MongoDB execution, browser execution or a feature-specific browser
exception, final review, completion and Git delivery remain separate owner gates.

At the planning gate F033 stayed NOT_STARTED. Only this plan was created; no roadmap/status or product/
test/configuration file was changed and no checks involving test/runtime execution
were performed. F001-F032 approvals and all historical evidence remain unchanged.

## 8. Implementation and offline verification (2026-10-18)

**Implementation/offline result: PASS. Current status: IN_PROGRESS.**

The owner approved the exact Section 5 boundary and offline verification. This gate
modified 16 existing files (including the previously created plan) and created
tests/browser/practice-scenario.spec.ts: exactly 17 approved paths. No deletion,
new dependency, model/index, shared-auth, publication-helper, route, hook or CSS
change was needed. Source inventory/hashes, not Git operations, verify the scope.
Generated build outputs and verification logs are excluded from source scope.

### Implemented behavior and security review

- API query and DTO enums now accept SCENARIO alongside OUTPUT/DESCRIPTIVE;
  omission still defaults to OUTPUT. The unchanged repository's requested-type
  filter/count and Concept/type identity checks serve all three types. Authentication,
  STUDENT/current-account eligibility, shared rate limits, five-level ancestry,
  consistent references, pagination, GET-body rejection and safe errors are reused.
- The explicit seven-field projection/construction remains id, conceptId, type,
  difficulty, prompt, starterCode and language. No answer, explanation, evaluation,
  provenance or internal metadata is exposed. select is not treated as authorization.
- Client URLs now send the requested DESCRIPTIVE or SCENARIO value while retaining
  the old no-type OUTPUT URL. Strict response identity and secret-key rejection,
  abort/deadline and authenticated-read guards are preserved.
- The view adds a native Scenario button with pressed state, Scenario labels and
  free-text textarea. Existing focus wiring suppresses heading focus on either
  added type selection. Restricted Markdown, escaped inert code, wrapping and
  existing focus/touch-target CSS are reused unchanged.
- A third private draft/fingerprint store shares the existing 100-entry cap and
  10,000-unit bound. Type changes retain drafts; confirmed clearing covers all
  three stores in the current account/Concept lifetime. Existing stale-ticket,
  stale typed-edit, request generation/abort, disposal and fingerprint guards remain.
  No silent eviction, browser storage, server persistence, code execution or new
  submission/unlock/scoring control was introduced.

### Actual offline results

| Check | Result |
| --- | --- |
| Focused API practice schema/repository/service and HTTP files | 16/16 PASS (10 + 6) |
| Relevant API regressions: practice-question model, Concept service/pipeline/routes, authenticate, access-token, user-profile and user-model | 44/44 PASS |
| API total for this gate | 60 distinct tests with passing evidence; not a full API-suite claim |
| Focused web practice client/controller/rendering | 28/28 PASS (7 + 14 + 7) |
| Remaining web test files, excluding the three focused files | 168/168 PASS |
| Web total for this gate | 196 distinct tests with passing evidence, without repeating the focused suites |
| Root build | PASS: shared packages, web, admin and API |
| Root lint and format check | PASS; final changed browser/test files also pass targeted lint/format checks |
| TypeScript | PASS across workspaces, with the API-only correction/recheck described below |
| Prepared browser spec/config | Compile-only PASS; no Playwright discovery or execution |
| Scope/security and UTF-8/LF | PASS; exact 17 paths; prior roadmap content preserved |

Existing offline tools ran in the supported ordinary, unelevated Windows account
REDGOLDMARK42\Shreeji, Node 24.15.0/npm 11.12.1. API HTTP tests used short-lived
mocked loopback fixtures, not a persistent API server or database connection.
No full passing suite was rerun. Initial workspace typechecking found a test-only
mock return-shape inference error: the valid fixture's createdBy was inferred as
required in the wrong-type replacement fixture. An explicit Promise<unknown[]>
return annotation, matching the existing mock convention, fixed it without runtime
or assertion changes. API typechecking then passed; all other workspace checks
had passed in the initial invocation. Final browser-only stale-success/error
coverage was formatted, linted and compiled again after that spec edit.

Evidence is retained under `.cache/f033-offline-2026-10-18-1792317489095/`:
api-focused.log, api-regressions.log, web-focused.log, web-regressions.log,
build.log, lint-format-browser-static.log, typecheck.log (including the historical
test-only error) and final-targeted-static.log. These are local evidence artifacts,
not implementation files or proof of browser/database execution.

### Prepared but unexecuted gates and remaining limitations

The existing disposable integration file now includes ordered Scenario fixtures,
nullable inert TypeScript context, excluded hidden/version/reference-invalid data,
seven-field secrecy, pagination/immutable-read assertions and three-type ancestry/
eligibility checks. The old unsupported-SCENARIO assertion now rejects unsupported
CODING; malformed/alias rejection remains covered offline. This file compiled but
was NOT_RUN. It is ready only for separately approved guarded MongoDB verification
with Section 6B's fresh storage, exact loopback/replica/database and owned cleanup.

Seven mounted cases are prepared: 1280/768/390 layout/keyboard/security, three-type
draft/confirmed-clear round trip, states/Retry/wrong-type/secret rejection,
superseded success/error, and account/Concept/logout isolation. Source review counts
three viewport expansions plus four named cases; this is NOT runtime discovery.
All seven remain NOT_RUN. Expected complete regression is 111 NOT_RUN, including
these seven and the previous 104, pending future discovery and approved execution.

Responsive layout, real keyboard/focus/accessibility, real-browser account/draft
race behavior and shared authentication/Concept-publication compatibility remain
NOT_VERIFIED by this gate. Unit focus wiring and source/CSS review are not browser
or exhaustive screen-reader acceptance. No substantive implementation defect is
currently identified; live persistence/publication behavior remains unverified for
F033 until its integration gate passes.

No F033 browser exception has been requested or granted by this implementation.
F032's 7/104 NOT_RUN, F031's historical 40 PASS / 1 FAIL / 56 NOT_RUN, and all
F022/F024/F029, screen-reader/background-throttling and Windows teardown limitations
remain retained. The primary-host browser prohibition and closed prototype decision
remain unchanged. No browser, synthetic, MongoDB, Git or F034 operation occurred.
F033 remains IN_PROGRESS; next approval is the guarded disposable MongoDB gate.

## 9. Owner-authorized disposable MongoDB verification (2026-10-18)

**Isolation preflight PASS. Integration assertions PASS: 7/7 including the parent
test (six substantive checks), zero retries, failures, skips or cancellations.
Cleanup PASS after the separate completion check described below.**
F033 remains IN_PROGRESS; this does not grant a browser exception or final approval.

The single prepared execution was `node --import tsx --test
apps/api/tests/practice.integration.ts`, using the unchanged
scripts/LocalProcessOwner.cs helper and existing PowerShell 7 standard-input
procedure in the ordinary, unelevated REDGOLDMARK42\Shreeji context. No .env,
application credentials, persistent fallback or browser process was used. Child
environments were allowlisted with the exact disposable URI/database.

Evidence: `.cache/f033-integration-2026-10-18-15-47-22-486f49/`, including
owner/process receipts, initialization/integration/shutdown logs, protected-process
and demo metadata, original result.json and cleanup-completion.json. Node test
duration was 4.54 seconds (parent 3.54 seconds); initial startup/test/shutdown
procedure took 17.30 seconds. Cleanup completion was recorded separately; the
initial wrapper is not represented as an uninterrupted successful execution.

### Isolation and actual behavior

- Fresh current-user-owned GUID-named TEMP storage was verified empty and
  non-reparse before startup. MongoDB and every Node helper/test child entered the
  fresh native Job atomically through the unchanged ownership helper. The retained
  MongoDB process handle, creation-time identity,
  parent, executable, ordinary-user owner and exact Job membership were verified;
  protected PID 5144 was explicitly checked as outside the Job.
- Port 27018 was initially free; the started listener was only 127.0.0.1 and
  belonged to the verified test process. Before the first connection, process/
  listener identity was rechecked. Initialization then independently checked
  server PID, exact owned dbPath, binding/port and f021-test replica configuration.
  The new replica reached writable PRIMARY before fixture execution. No non-system
  database existed and deeplearner-f021-test had no collections before fixtures.
  Every connection targeted only this owned loopback server, never port 27017,
  deeplearner-local-demo, Atlas, production or another persistent database.
- Missing-type OUTPUT, explicit OUTPUT and DESCRIPTIVE compatibility passed.
  SCENARIO returned only eligible published/schemaVersion-1 Scenario records,
  including preserved inert TypeScript context. Mixed-type, unpublished, unsupported
  version and inconsistent question-reference fixtures were excluded from the
  relevant result/count. Unsupported CODING HTTP retrieval was rejected.
- All three types failed closed for hidden ancestors and inconsistent denormalized
  references across the five-level F021 chain. Stable ordered pagination, accurate
  type-specific totals, empty later pages and reference consistency passed.
- Signed eligible STUDENT HTTP access passed; unauthenticated access and current
  non-STUDENT/suspended/unverified eligibility rejection passed. Exact seven-field
  OUTPUT/SCENARIO DTO keys and DESCRIPTIVE's retained safe shape passed; answer,
  explanation, evaluation sentinels, provenance and internal metadata were excluded.
  Before/after snapshots proved retrieval did not mutate stored questions.
- Existing offline evidence retains broader malformed/duplicate type and query
  inputs, maximum pagination bounds, rate limits and GET-body validation. The
  prepared integration does not repeat every offline assertion. No code was
  executed from authored starterCode and no new product requirement was added.

### Cleanup, initial wrapper error and completion evidence

The integration closed its HTTP/database connections and dropped its seven owned
collections. Independent cleanup readback found zero test collections. Guarded
database shutdown, shutdown helper and mongod all exited 0. The retained-handle
exit observations and native Job active count 0 were recorded before disposal;
owned child handles and the Job were released without a reported disposal error.
No forced termination was used.

The initial wrapper nevertheless exited nonzero: a cleanup-only PowerShell query
used `Where-Object LocalPort -eq27018`, parsed as an unknown parameter. This left
PortFree UNKNOWN and correctly prevented storage removal. Its original result.json
retains CleanupError and OwnedStorageRemoved=false; no historical result was erased.

Only the already-authorized cleanup was completed, without a test rerun, server
restart, database connection or source/harness-file change. A correctly formed
read-only port query verified port 27018 released. Successful retained Mongo exit
and empty-Job evidence, the fresh-storage ownership receipt, exact GUID path under
TEMP, current-user ACL owner, single mongodb child and non-reparse descendants
were checked before removing only that owned disposable directory. Removal was
confirmed. cleanup-completion.json records the initial issue and final cleanup
PASS; it does not replace the original wrapper result or claim another test run.

Protected MongoDB PID 5144, parent 1304, creation UTC
2026-10-17T04:47:47.7735300Z and 127.0.0.1:27017 listener ownership matched before
and after, including the completion check. Its executable/owner remain UNKNOWN,
not inferred. It was never connected to, adopted, restarted or terminated. Recorded
development-process identities also matched. Persistent demo-storage relative paths,
sizes and write-time metadata were unchanged; existing accounts/content were not
queried or independently recounted. No shared database/collection/storage was dropped.

No application or test defect was observed. The only issue was the verification
wrapper's cleanup query, with final cleanup independently completed and disclosed.
No application/test/configuration changes, offline reruns, Git, browser or synthetic
execution, dependency/infrastructure changes or F034 work occurred. F033 remains IN_PROGRESS
and is ready for conditional final review using retained evidence. Seven mounted
F033 cases and the expected complete 111-case regression remain NOT_RUN; primary-host
Playwright remains prohibited and any F033-specific exception requires separate
explicit owner approval. All prior feature results and limitations remain unchanged.

## 10. Owner-approved local browser exception and final review (2026-10-18)

**FINAL REVIEW PASS WITH F033 BROWSER EXCEPTION. Review-stage status: READY_FOR_REVIEW.**

The owner explicitly approved a ONE-TIME F033-specific browser-verification
exception for LOCAL DEVELOPMENT ONLY. AGENTS.md permits this feature-specific
deferral for documented infrastructure safety concerns while keeping focused
unit/API/frontend, build/lint/TypeScript/formatting, security/scope and applicable
disposable database checks mandatory. Those requirements are satisfied by the
retained evidence below. No mandatory security, authorization, API or database
requirement is waived and no policy override is needed.

This decision supersedes earlier F033 complete-browser acceptance prerequisites
only for this local-development review. Sections 1-9 preserve the earlier plans,
NOT_STARTED/IN_PROGRESS and no-exception statements as historical gate records;
they do not negate this later owner decision. No historical test result is changed.
F031/F032 exceptions are not the authority for this exception. It does not transfer
to F034 or any future feature, and cannot authorize production deployment.

### Final acceptance matrix

| Approved criterion | Review finding and evidence |
| --- | --- |
| Three canonical types/default compatibility | Exact OUTPUT/DESCRIPTIVE/SCENARIO query/DTO types; omitted OUTPUT preserved; client sends the requested non-default type; retained focused API/web and live HTTP/repository checks PASS |
| STUDENT authorization/publication | Existing JWT/current eligible STUDENT checks and shared rate limits retained; unchanged F021 five-level PUBLISHED ancestry and question reference predicates; offline and live checks PASS |
| Seven-field DTO secrecy | Explicit projection plus construction exposes only id, conceptId, type, difficulty, prompt, starterCode, language; sentinel and strict-client tests reject answer/explanation/evaluation/provenance/internal leakage |
| Request/pagination/errors | Strict identifiers/query/GET-body handling, default page 1/limit 10/max 20, safe offset, type-filtered counts, stable _id order and existing sanitized errors retained |
| Three-type draft lifecycle | Account/Concept-keyed controller with private type/question stores; memory-only retention across switching/pages/Retry, shared 100-draft cap and 10,000-unit bound; no silent eviction/persistence; retained tests PASS |
| Confirmed clearing and isolation | Explicit current-scope confirmation clears all three stores; canceled/null/stale tickets and stale typed edits rejected; identity disposal and content-fingerprint behavior covered offline |
| Cancellation/stale results | Existing AbortController/generation guards and authenticated-read identity checks preserved; stale success/error and cross-type/identity tests PASS; real-browser races remain unverified |
| Safe presentation/accessibility | Restricted Markdown and escaped inert code/drafts reused; native pressed buttons, labelled textarea, focus wiring, truthful states and existing responsive/focus CSS reviewed; mounted behavior deferred explicitly |
| Approved scope | Filesystem/hash review matches exactly all 17 Section 5 paths; no additional product/test/configuration/dependency/model/index/auth/publication-helper changes; only this document and roadmap change in this review gate |
| Retained mandatory evidence | API 60 distinct PASS (16 focused + 44 regressions); web 196 distinct PASS (28 focused + 168 remaining); MongoDB 7/7 PASS including parent; build/lint/TypeScript/formatting/browser-spec compile-only/security/scope checks PASS |
| Database safety and cleanup | Section 9 isolation and immutable reads verified; original wrapper cleanup-query error retained, authorized separate cleanup completion PASS without rerun/restart, empty Job/free port/owned storage removal and protected baseline preservation |

No substantive F033 application/database acceptance defect was identified in this
review. API and web totals are reconciled distinct tests, not a new full-suite run.
MongoDB 7/7 includes six substantive checks plus the parent. Its initial wrapper
was nonzero despite passing assertions and graceful shutdown; result.json retains
that failure, while cleanup-completion.json separately establishes final cleanup.
Neither original evidence file was modified in this gate. The test-only initial
TypeScript inference error and targeted static correction also remain documented.

### Exact browser deferral and explicitly accepted risks

| Browser group | Expected cases | Current F033 regression gate |
| --- | ---: | --- |
| F022/F025 | 27 | NOT_RUN |
| F023 | 16 | NOT_RUN |
| F024 | 19 | NOT_RUN |
| F028 | 13 | NOT_RUN |
| F029 | 7 | NOT_RUN |
| F031 | 14 | NOT_RUN |
| F032 | 7 | NOT_RUN |
| F033 | 7 | NOT_RUN |
| Smoke | 1 | NOT_RUN |
| Total | 111 | NOT_RUN |

The seven F033 mounted scenarios are INCLUDED in the expected complete 111,
not additional cases. Counts are the prepared/retained expected inventory, not
runtime discovery. There is no mounted F033 browser PASS, complete regression
acceptance or clean combined/segmented regression PASS for this gate. F032's
historical 7/104 NOT_RUN and F031's 40 PASS / 1 FAIL / 56 NOT_RUN remain unchanged;
their outstanding compatibility coverage remains outstanding within these totals.

The owner explicitly accepts these unverified risks for LOCAL DEVELOPMENT ONLY:

- Responsive layout, readable wrapping and mobile behavior in a mounted browser.
- Native keyboard interaction, focus retention/restoration and accessibility in
  a real browser; offline focus wiring is not exhaustive screen-reader evidence.
- Three-type draft retention and account/Concept/question isolation during real
  navigation, logout and identity replacement.
- Request cancellation and stale-success/error races under actual browser timing.
- Compatibility with shared authentication/session handling and Concept publication.

Source review, offline tests and disposable MongoDB evidence reduce uncertainty
but do not establish those browser properties. The browser's background throttling
and exhaustive assistive-technology compatibility remain unverified. Manual browser
inspection was not performed here; it is supplemental only and cannot replace
automation or convert NOT_RUN into PASS.

Retain F022's historical EPERM/inconclusive process probing and Windows taskkill
PID-reuse safety risk, F024's shared-worker browser lifecycle conflict, F029's
intermittent ArrowDown failure with independent recovery/inconclusive cause, and
Windows graceful-shutdown gaps. Playwright remains blocked on the primary host
pending separately approved ownership-safe execution. The custom prototype is
not a verified solution: positive /T unsupported, browser/worker/server fallbacks
unverified and native/internal bypasses uncontrolled. Its Gate 1/2 synthetic PASS
evidence remains historical; the temporary package is not modified, executed or
deleted and its investigation is not reopened.

### Required future verification and owner handoff

Before production deployment, require a separately approved ownership-safe browser
regression and release-readiness review. Future execution must discover actual
counts and cover seven mounted F033 scenarios plus the complete expected 111-case
regression and outstanding shared-component compatibility. Retain F024 invocation
isolation, original assertions/timeouts, zero retries, a 25-minute browser budget,
five-minute initial diagnosis and ownership-safe cleanup. No such execution is
authorized by this review; failures require their own correction approval.

No test reruns, application/browser/synthetic/database execution, Git operations,
new infrastructure, deployment or F034 work occurred in this documentation gate.
UTF-8/LF, prior roadmap content, F001-F032 APPROVED_COMPLETE and F034 NOT_STARTED
are preserved. Submissions, answer unlocking, scoring, progress persistence and
Admin authoring remain excluded. At the review-stage handoff, F033 was
READY_FOR_REVIEW; completion and commit/push required separate explicit owner
approval, recorded below. This final review grants no production or future-feature exception.

## 11. Owner-approved local completion and Git delivery (2026-10-18)

The owner explicitly approved F033 as APPROVED_COMPLETE for LOCAL DEVELOPMENT
ONLY, retaining the one-time feature-specific browser exception and all Section 10
risks. The feature-only commit and safe push to origin/dev are authorized for
exactly the 17 Section 5 paths with message
`feat(practice): complete F033 scenario-based questions`.

Retained evidence is unchanged: API 60 distinct tests PASS; web 196 distinct tests
PASS; MongoDB integration 7/7 PASS including parent; build, lint, TypeScript,
formatting, browser-spec compile-only and security/scope checks PASS. The initial
MongoDB cleanup-wrapper error and successful separate authorized cleanup remain
recorded in Section 9 and their original evidence files; no clean initial-wrapper
PASS or additional test execution is claimed.

F033 mounted browser scenarios remain 7 NOT_RUN. Expected complete regression
remains 111 NOT_RUN INCLUDING those seven. No browser PASS, production readiness
or deployment is authorized. Real-browser responsive/mobile, keyboard/accessibility,
draft/account navigation isolation, cancellation and shared-component compatibility
risks remain accepted only for local development. Retain F022/F024/F029, background
throttling and Windows teardown limitations and the primary-host Playwright block.

AGENTS.md's policy and historical feature results remain unchanged. This exception
does not transfer to another feature. F001-F032 remain APPROVED_COMPLETE; F034 stays
NOT_STARTED and unauthorized. Future ownership-safe browser/release verification
and any F034 planning or implementation require separate owner approval. No tests,
database/browser/synthetic execution or product changes accompany this delivery.

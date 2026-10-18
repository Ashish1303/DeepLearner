# F034 - Coding Questions

**Status:** APPROVED_COMPLETE
**Plan date:** 2026-10-18
**Planning result (historical):** PLAN READY; implementation was separately approved.

**Current final review (2026-10-18): FINAL REVIEW PASS WITH F034 BROWSER EXCEPTION.**
APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY following explicit owner completion
approval; see Sections 12-13. Seven mounted scenarios and expected full 118-case
browser regression remain NOT_RUN. Production deployment is not approved.

**Implementation approval (2026-10-18):** Owner authorized exactly the Section 5
16-file inventory, implementation/offline checks and formal code review. Database
and browser execution remain prohibited at this gate. No browser exception granted.

**Subsequent MongoDB verification (2026-10-18):** Owner separately approved the
initialization/cleanup correction and one fresh guarded execution. Integration
8/8 PASS including the parent; cleanup PASS without force. See Section 11. The
prior blocked attempt and its cleanup limitations in Section 10 remain unchanged.
At that MongoDB gate F034 remained IN_PROGRESS and no browser exception had yet
been approved; the subsequent decision is recorded separately in Section 12.

At the historical planning gate the owner authorized this document only, within the 16-file
implementation boundary in Section 5. No roadmap/status change, implementation,
test, service, database, browser, infrastructure or Git operation is authorized.
F001-F033 remain APPROVED_COMPLETE with their historical acceptance limitations;
F035 remains NOT_STARTED and outside scope. At that planning gate no F034 browser
exception had been granted.

## 1. Authority, objective and dependencies

Sources: AGENTS.md; DEVELOPMENT_ROADMAP.md; PRD practice sections 23-24 and Coding
Playground section 29; SYSTEM_ARCHITECTURE.md; DATABASE_DESIGN.md and its F030
refinement; API_DESIGN.md; approved F021/F030/F031/F032/F033 feature contracts;
existing Practice code, tests and Concept-learning Stitch references under
docs/designs/student/concept-learning/stitch (screen.png and code.html).
Reuse the current Practice presentation rather than importing generated markup,
scripts, CDN dependencies or illustrative quiz/XP controls.

The roadmap identifies F034 as **Coding Questions**, with no detailed boundary or
explicit dependency list. The owner-approved increment adds canonical CODING
retrieval, a Coding selector and local code drafts to the existing Student
Practice experience. It does not implement the PRD's complete Playground or
attempt -> answer unlock -> explanation flow.

Engineering prerequisites are F030's existing four-type question model, F021's
complete published-ancestry pipeline, F031's authenticated Practice API/page and
guarded auth reads, and F032/F033's typed draft and selection lifecycle. These
dependencies reuse completed contracts; they do not add roadmap requirements.

SYSTEM_ARCHITECTURE.md specifies Monaco for the separate student Playground.
This increment is a native textarea draft experience, not that Playground, and
does not replace its architecture. No editor dependency, execution environment,
sandbox, grading, API route or database model is introduced.

## 2. API, publication and response contract

Reuse `GET /api/v1/practice-questions?conceptId=<24-hex>&type=CODING&page=1&limit=10`.

### Query validation and compatibility

- Accept exactly OUTPUT, DESCRIPTIVE, SCENARIO and CODING as optional type values.
  An omitted type continues to default to OUTPUT. Preserve explicit OUTPUT,
  DESCRIPTIVE and SCENARIO behavior. Do not introduce aliases or case coercion.
- Reject unsupported, empty, padded, lowercase, duplicate, nested, array/object
  and coerced query values. Require the existing exact 24-hex Concept identifier
  and lowercase normalization. Retain unknown-key, route-param and GET-body
  rejection, including existing non-JSON/chunked-body protections.
- Preserve positive decimal safe-integer page default 1, limit default 10 and
  maximum 20, safe offset validation, and `_id ASC` sorting. Ordering is stable
  for a fixed dataset; it does not promise a concurrent-publication snapshot.
- Preserve existing middleware and Route -> Controller -> Service -> Repository
  flow. No new query fields, endpoint, metadata, error code or retry is added.

### Authentication, publication and data boundaries

Require bearer authentication and existing current-account/token STUDENT checks,
ACTIVE status and verified email. ADMIN does not gain preview access through
this endpoint. Preserve FREE/PREMIUM parity, no-store, request IDs and existing
security/CORS conventions. Preserve shared 300/IP and 120/subject limits per
15 minutes; changing question type must not create another rate-limit bucket.

Reuse unchanged F021 `publishedConceptStages`: Concept -> Topic -> Module ->
LearningPath -> Technology must all be PUBLISHED, with all existing denormalized
reference comparisons. Each returned/countable question must match the requested
type, PUBLISHED status, schemaVersion 1, requested Concept and consistent Topic
and Technology references. Apply these predicates before pagination and totals.
Hidden/inconsistent parents retain generic unavailability; hidden, wrong-type
or inconsistent questions are excluded from both items and counts.

The repository already receives the validated type and verifies projected
Concept/type identity. No repository, service, route, auth, publication-helper
or rate-limiter implementation change is necessary. Preserve all reference
checks; model identifier validation alone is not publication authorization.
Reads do not publish, repair, mutate or evaluate stored data.

### Exactly seven safe fields

Preserve the success envelope:

```text
{ success: true, data: [...], message: null,
  meta: { requestId, page, limit, total, totalPages } }
```

Each item has exactly `id`, `conceptId`, `type`, `difficulty`, `prompt`,
`starterCode`, `language`. Add CODING only to the approved type validators.
Retain explicit database projection AND DTO field-by-field construction; never
spread a model/document or rely on Mongoose select as authorization. Exclude
answer, explanation, evaluation, provenance, status, timestamps, schema/internal
fields and any unapproved metadata. Reject malformed eligible projections through
the existing sanitized dependency error rather than returning unsafe data.

Reuse canonical difficulty and JAVASCRIPT/TYPESCRIPT values. Prompt/code bounds
remain 50,000 UTF-16 code units under F030's approved contract. Absent code or
language becomes null only in the DTO; non-null starterCode requires language.
Language without code remains valid. CODING does not require a snippet or add a
language default. Stored starterCode is inert question context, never a solution
or executable instruction. Preserve its formatting and the existing null rules.

Preserve 200 empty/out-of-range pages with accurate totals; 400 VALIDATION_ERROR;
existing 401 token and 403 account/role errors; 404 USER_NOT_FOUND or generic
CONCEPT_NOT_FOUND as applicable; 429 RATE_LIMIT_EXCEEDED; sanitized
503 DEPENDENCY_UNAVAILABLE. Do not disclose hidden ancestry or internal errors.

## 3. Student UI, safe code display and request lifecycle

Reuse `/concepts/[conceptId]/practice`, its existing auth boundary, Concept link,
hook, PracticeBrowser/PracticeView, Markdown utility and CSS. Add Coding as the
fourth native button in the existing Question type group. OUTPUT remains the
initial selection. Use visible selected wording and `aria-pressed`; do not add
tab-widget semantics, a new route or URL/storage persistence for selection.

On an actual type change: invalidate the old request generation, abort superseded
work, reset page to 1, remove obsolete displayed questions/errors, select the
corresponding draft store and load the new type. Selecting the active type remains
a no-op. Ignore stale success AND error responses, including late authenticated
reads. Keep focus on the selected button through asynchronous loading; do not
automatically focus a textarea or heading on a type switch. Preserve existing
pagination/Retry heading-focus behavior and same-page draft retention.

The client already serializes a validated non-OUTPUT type dynamically. Reuse it
unchanged and extend the shared contract plus client tests. Preserve response
Concept/type/page/limit identity validation, strict envelope/DTO parsing, ordered
unique IDs, safe totals, AbortSignal propagation, 15-second request deadline,
credentials omission, no-store and redirect rejection. No implicit retry or
additional refresh request is introduced.

For each Coding question:

- Render the prompt through existing restricted ConceptMarkdown (headingBase 3).
  Retain safe links, blocked raw HTML/images and existing no authored-fetch rules.
- If starterCode exists, show the unchanged read-only, focusable code region and
  escaped React text. Preserve indentation/newlines and the JS/TS label. No HTML
  injection, evaluation, compilation, syntax execution or external fetching.
- Provide a labelled native textarea, with the proposed accessible name
  `Your code draft for Question N`, existing draft-only instructions and length
  description. A new question's textarea is empty. Never copy starterCode into
  the draft, including after loading, Retry, switching, clearing or remounting.
- Preserve draft whitespace and indentation without trimming or formatting.
  Preserve newlines using normal textarea handling; browser-native line-ending
  normalization is not a byte-for-byte file editor guarantee. Do not intercept
  Tab to insert indentation or trap keyboard focus. No reset-to-starter action.
- Preserve per-question clear, confirmed Clear all, pagination and loading,
  empty, retry and error states. No Run, Submit, answer unlock, scoring, attempts,
  completion, XP or progress controls.

Reuse current wrapping controls, visible focus outlines, semantic structure,
44px targets, contained code overflow and resizable textarea CSS. Future mounted
acceptance must inspect 1280x900, 768x900 and 390x900, readable labels, contrast,
keyboard navigation and document containment. Require keyboard scrolling only
where measured scrollWidth/clientWidth or scrollHeight/clientHeight establishes
real overflow; otherwise verify readability/containment. Static focus wiring
does not prove mounted accessibility or exhaustive screen-reader compatibility.
If another CSS, hook, page or shared-auth file is required, stop for scope approval.

## 4. Four-type draft and confirmation contract

Add CODING to the existing private per-type draft/fingerprint stores. Logical
identity remains account + Concept + type + question ID. Expose only the active
type's drafts; identical IDs across types must never share text.

- Retain drafts across four-type round trips, pagination and Retry within the
  same eligible account/Concept page lifetime. Switching type must not invoke
  destructive controller cancellation or remount the controller by type.
- Maximum 100 nonempty drafts TOTAL across all four stores per page instance;
  maximum 10,000 UTF-16 code units per draft. Preserve whitespace-only draft
  strings as authored text. Empty strings remove an entry. Do not trim drafts.
- Preserve existing capacity behavior: no silent eviction. Reject a new 101st
  entry with an accessible notice, allow edits to existing entries, and free
  capacity through explicit clearing. No TTL/LRU or automatic replacement policy.
- Per-question clear affects only the active type/question. Clear all first
  opens the existing labelled inline confirmation, naming all four types and
  the current account/Concept scope. Confirm clears all four draft/fingerprint
  stores in this controller only; Keep drafts preserves them. Restore focus to
  Clear all drafts after either action. Opening confirmation does not delete.
- Retain non-null instance-local confirmation tickets. Edits, replacement loads,
  type changes, cancellation and identity disposal invalidate pending tickets.
  Reject stale/null confirmation actions and stale edits from a prior type.
  A callback on an old controller cannot clear a new account/Concept controller.
- Logout, pending/ineligible auth, account/Concept change, navigation away,
  reload or unmount aborts/invalidates requests and discards all four stores.
  Returning to a former account must not restore disposed drafts.
- Preserve prompt/code/language fingerprints: changed authored context invalidates
  only the affected question draft with an accessible notice. No absent question
  draft may be attached to a different question.

No localStorage, sessionStorage, cookies, MongoDB, broadcast persistence, draft
requests/logging or answer comparison. These drafts are not submissions or records
of completion. Existing account-keyed components, hook disposal and guarded
authenticated reads remain unchanged and require compatibility review.

## 5. Exact implementation inventory and architecture review

This gate creates ONLY this plan. The proposed implementation boundary is exactly
16 unique paths: two planned creations including this document, and fourteen
existing-file modifications. At implementation time the plan already exists;
updating it is not an additional path. Do not manufacture unnecessary edits.

| # | Operation | Exact path | Responsibility |
| --- | --- | --- | --- |
| 1 | Create (planning gate only now) | docs/features/F034-coding-questions.md | Approved contract, scope, acceptance, review and evidence |
| 2 | Create (implementation gate) | tests/browser/practice-coding.spec.ts | Seven prepared Coding/four-type mounted scenarios |
| 3 | Modify | docs/DEVELOPMENT_ROADMAP.md | Future authorized F034 status/evidence only |
| 4 | Modify | docs/API_DESIGN.md | Add CODING while preserving earlier retrieval contracts |
| 5 | Modify | apps/api/src/modules/practice/practice.schema.ts | Four query types, unchanged OUTPUT default |
| 6 | Modify | apps/api/src/modules/practice/practice.dto.ts | Accept CODING within the same seven-field construction |
| 7 | Modify | apps/api/tests/practice.test.ts | Query, DTO, pipeline/service reuse and compatibility |
| 8 | Modify | apps/api/tests/practice-routes.test.ts | Four-type HTTP, auth, rate, body and error contracts |
| 9 | Modify | apps/api/tests/practice.integration.ts | Prepared disposable Coding persistence/read verification |
| 10 | Modify | apps/web/src/lib/practice/contracts.ts | Four canonical types; unchanged strict response fields |
| 11 | Modify | apps/web/src/lib/practice/practice-controller.ts | Fourth draft store, shared limits and confirmation wording |
| 12 | Modify | apps/web/src/components/practice/practice-browser.tsx | Coding button, empty code textarea and four-type wording |
| 13 | Modify | apps/web/tests/practice-client.test.ts | CODING URL, identity, parsing and cancellation coverage |
| 14 | Modify | apps/web/tests/practice-controller.test.ts | Four-type drafts, races, limits, clearing and disposal |
| 15 | Modify | apps/web/tests/practice-rendering.test.ts | Accessible selectors, empty draft, inert code and states |
| 16 | Modify | playwright.f024.config.ts | Add only practice-coding.spec.ts discovery |

Architecture inspection found no necessary additional path. The API client is
already type-generic. Repository, controllers/services/routes, shared auth,
publication helper and rate limiters remain unchanged. F030 already stores CODING;
no model/index/DATABASE_DESIGN.md edit, migration, collection creation, auto-index
change or new field is needed. Page wrapper, hook, CSS, Markdown utility, old
browser specs, dependencies and environment configuration remain unchanged.

Within the approved tests, replace obsolete assertions that CODING is unsupported
with positive coverage and retain rejection coverage using genuinely unsupported
aliases/malformed values (for example CODING_BASED). Existing Coding integration
fixtures may become positive requested-type fixtures while remaining excluded
from OUTPUT/DESCRIPTIVE/SCENARIO responses. Preserve all unrelated security tests.
If another path or architectural change becomes necessary, stop for owner approval.

## 6. Acceptance and verification gates

### A. Offline implementation - separate approval

1. Test default OUTPUT and explicit four-type query/DTO behavior; reject malformed,
   duplicate, nested and unsupported queries and all existing disallowed GET bodies.
2. Preserve STUDENT eligibility, authentication/account failures, shared limits,
   no-store and existing error/envelope contracts; no public or Admin preview route.
3. Verify complete five-level publication pipeline reuse, reference consistency,
   requested-type/PUBLISHED/schemaVersion filtering, correct totals and stable
   pagination. Assert exact seven keys and secret-bearing fixture exclusion.
4. Client tests cover all four request URLs, OUTPUT omission compatibility,
   wrong/mixed type or Concept, malformed DTO/envelope, pagination and aborts.
   Reuse the unchanged client; test extension must not introduce a hidden retry.
5. Controller tests cover four-type round trips, same IDs in different types,
   page-1 reset, same-type no-op, stale success/error, Retry/pagination retention,
   changed fingerprints, stale typed edits and account/Concept disposal.
6. Verify initially empty Coding drafts even with non-null starterCode; exact
   whitespace/newline retention; 10,000-unit boundary; shared 100-draft capacity,
   rejection of 101st without eviction, editing existing entries and slot release.
7. Verify per-question clear, confirmed all-four clear, cancel, stale/null tickets,
   old-identity callbacks, invalidation on edits/type/load and no persistence.
8. Rendering tests verify four native names/pressed states, code-draft labelling,
   unchanged focus wiring, empty textarea, nullable context, Markdown/escaping,
   confirmation text, loading/empty/error/Retry and forbidden execution/progress
   controls. Preserve F031-F033 rendering and security assertions.

Run focused API/web tests and relevant API/frontend regressions with distinct
test counts and commands recorded; build, lint, TypeScript, formatting, browser-
spec static compilation and exact scope/security checks. Review scripts before
invoking them so offline commands cannot start MongoDB or browsers. Prepare
integration/browser sources but execute neither in this gate. Passing results
must not be inferred from historical F033 evidence or counted twice.

### B. Disposable MongoDB integration - separate approval

Use the existing isolated procedure only after owner approval: fresh owned storage,
127.0.0.1:27018, replica set f021-test, database deeplearner-f021-test, writable
PRIMARY and empty disposable target. Verify ownership/isolation before fixtures;
protect port 27017, persistent demo data, accounts, development, Atlas and production.

Run the prepared integration file once, zero retries. Cover all four types/default,
published Coding filtering, five-level parent visibility/reference inconsistencies,
STUDENT authorization, invalid types, stable pagination, exact DTO/no secret leakage,
and unchanged stored data after reads. Reuse approved contracts rather than new
product requirements. Close connections; remove/stop only verified owned data/
processes; confirm Job emptiness, port release and protected identities/storage
unchanged. Report cleanup separately; failure requires separate correction approval.

### C. Mounted browser preparation and future acceptance

Prepare seven proposed scenarios without running Playwright/Chrome:

1. Desktop Coding selection, type-specific published fixtures, exact safe response
   fields, read-only starterCode and initially empty code draft; no Run/Submit.
2. Four-type keyboard selection, pressed state and retained selector focus;
   pagination reset, draft round trips and unchanged OUTPUT/DESCRIPTIVE/SCENARIO.
3. Account/Concept/type/question isolation during navigation, cancellation and
   delayed/stale responses; no persistence or recovered disposed-account draft.
4. Coding whitespace/indentation/newlines, shared capacity/length limits and
   per-question clear; starterCode never becomes a draft automatically.
5. Confirm/cancel scope-limited all-four clearing, stale confirmation rejection
   and appropriate focus restoration.
6. Tablet 768x900 and mobile 390x900 containment, readable labels, keyboard/focus,
   genuine code overflow and accessible text; no assumed vertical scroll requirement.
7. Loading, empty, error/Retry, pagination, restricted Markdown/inert malicious
   code text, authorized/unauthorized mocks and existing request isolation.

Use existing production-built configuration, synthetic fixtures/mocks and preserved
server-only fixture isolation. No actual authored code or real database connection.
Static compilation does not establish mounted behavior. Planned F034 mounted
coverage is **7 NOT_RUN**. Expected full coverage is **118 NOT_RUN**, including
these seven, based on F033's expected 111 plus seven; this is a planning count,
not discovered or executed evidence. Preserve the historical outstanding 56
within the full regression rather than adding them again.

Future discovery/execution requires separately approved ownership-safe local
execution. Use zero retries, 25-minute combined browser budget and five-minute
initial diagnosis, unchanged assertions/timeouts and segmented isolation of F024
from conflicting suites. Never call segmented execution a clean combined run.
Stop on failures with safe cleanup; no automatic fixes/reruns. Do not restart
the infrastructure investigation or modify the temporary prototype.

## 7. Mandatory formal final code-review gate

**Current review status: PASS - separate offline source/diff review completed
2026-10-18 and final review completed under Section 12's explicit exception;
mounted browser verification remains NOT_RUN.** After implementation
and required verification, perform a separate review of the actual complete diff
and relevant reused boundaries. Tests/static checks support review; passing them
does not constitute completed code review. Explicitly cover:

- Correctness, maintainability, duplication and reuse of existing contracts.
- Authentication/current-account authorization, rate limits and complete five-level
  publication/reference checks, including unchanged shared modules relied upon.
- Exact DTO allowlisting, answer/metadata leakage and safe error handling.
- Cancellation, generation/identity races, stale responses/edits/confirmations.
- Draft scoping, total capacity, length/whitespace, retained memory and disposal.
- XSS, restricted Markdown, inert code, no execution and no secret/draft logging.
- Accessible names/state, native keyboard/focus behavior and limitations of
  unmounted checks; desktop/tablet/mobile verification gaps remain explicit.
- F031-F033 default/type/auth/publication compatibility and exact 16-path diff
  scope, configuration restraint, encoding and absence of generated/secret files.

Report findings grouped **Critical, High, Medium, Low**, with affected exact
file/line references, triggering condition, impact, recommended correction and
verification evidence. Explicitly state no findings for a level only after review;
do not fabricate findings or future line numbers in this plan. Track each finding's
resolution/re-review or explicit owner decision; do not self-waive blockers or
modify an unapproved file. Unresolved substantive defects block final acceptance.
Record the final review verdict separately from test results and browser status.

## 8. Historical limitations, exclusions and approval sequence

Preserve F031's historical 40 PASS / 1 FAIL / 56 NOT_RUN regression and recovered
locator failure; F022's afterAll EPERM/identity-safe teardown blocker; F024's
shared-worker browser lifecycle conflict; F029's unresolved intermittent ArrowDown
failure and independent recovery. F032 mounted 7/full 104 and F033 mounted 7/full
111 remain NOT_RUN historical records, not new F034 results. Preserve F033's
initial MongoDB cleanup-wrapper error and successful separately authorized cleanup;
neither is an F034 execution result or evidence of a database/application defect.

The closed custom prototype's Gate 1 and Gate 2 synthetic 10/10 results do not
prove Playwright safety. Positive /T termination is unsupported, browser/worker/
server fallbacks unverified and native/internal bypasses uncontrolled. Primary-
host Playwright remains prohibited without separate ownership-safe approval.
Retain screen-reader, real background-throttling and Windows shutdown gaps.

AGENTS.md permits local browser deferral only through explicit named-feature owner
approval recording exact NOT_RUN coverage, obtained evidence, accepted UI/account/
compatibility risks and required future verification. F031-F033 exceptions do not
transfer. No F034 exception is requested as implicitly approved by this plan.
Manual inspection is supplemental only; security/API/database checks cannot be
waived. Production requires a separately approved full browser-regression and
release-readiness review, never a local exception or merely passing static checks.

Excluded: new endpoints/models/indexes, Admin authoring/publishing, real submissions,
attempts, F035 answer unlocking, explanations/solutions, scoring/progress/XP,
execution/evaluation/compilation, Monaco/Playground, persisted drafts, schema/
language changes, AI, dependencies, infrastructure and production deployment.

No unresolved product-contract or file-inventory conflict was identified in
planning. Next gate: owner review and explicit approval of this exact 16-file
implementation/offline plan. Subsequent MongoDB execution, browser execution or
F034-specific exception, final review/status transition and completion/Git delivery
remain separate owner decisions. Keep F034 NOT_STARTED at this gate; change to
IN_PROGRESS only when implementation is separately approved and begins.

## 9. Implementation, offline evidence and formal code review (2026-10-18)

**Implementation/offline result: PASS. Status: IN_PROGRESS.** The owner separately
approved implementation and offline verification within Section 5. This gate
modified fifteen existing files (including this previously created plan) and
created tests/browser/practice-coding.spec.ts: exactly sixteen approved paths.
No dependency, model/index, route, repository, shared-auth/publication helper,
hook, CSS or environment change was necessary. Generated outputs/logs are not
source scope. F001-F033 approval history and F035 NOT_STARTED remain unchanged.

### Implemented contracts

Query/DTO/frontend validators accept all four canonical types; missing type is
still OUTPUT. The unchanged type-generic client, repository, service, auth checks,
five-level publication pipeline, shared limiters and error contracts are reused.
DTO projection plus explicit construction retain exactly seven fields; answer,
explanation, evaluation and internal metadata are excluded. No stored code is run.

Coding selection uses the existing native buttons and pressed state. Read-only
starterCode stays separate from an initially empty native code-draft textarea.
The fourth memory-only store uses existing generation/abort, stale typed-edit,
fingerprint, disposal, confirmation and account/Concept lifetime safeguards.
Whitespace is preserved; 100 nonempty drafts TOTAL and 10,000 UTF-16 code units
per draft remain enforced without silent eviction. Confirmed Clear all covers
all four stores only in the current account/Concept controller. Type changes
retain drafts, reset page 1 and preserve selector focus wiring.

### Actual offline verification

Evidence directory: `.cache/f034-offline-2026-10-18-16-29-03/`.

| Check | Result |
| --- | --- |
| Focused API practice schema/repository/service and HTTP | 17/17 PASS (11 + 6) |
| Relevant API regressions: practice model, Concept pipeline/service/routes, authenticate, access-token, user-profile and user-model | 44/44 PASS |
| API total for this gate | 61 distinct tests with passing evidence; not a full API-suite claim |
| Focused web practice client/controller/rendering | 33 distinct PASS (8 + 17 + 8) |
| Remaining web files, excluding those three focused files | 168/168 PASS |
| Web total | 201 distinct tests with passing evidence; repeat verification not added to totals |
| Root build | PASS: shared packages, web, admin and API |
| Lint | Root run found one new test-regex spacing violation; exact-string equivalent correction and targeted recheck PASS; no other root findings |
| Formatting | Root format:check PASS |
| TypeScript | Root workspace typecheck PASS, including prepared integration sources |
| Browser spec/config | Strict compile-only PASS; no Playwright loading/discovery/execution |
| Scope/security/encoding | PASS: exact sixteen paths, UTF-8/LF and diff whitespace; unrelated roadmap history preserved |

Initial sandbox tsx initialization failed before assertions with
`uv_os_get_passwd ENOMEM`. Supported normal-user execution then ran the authorized
offline checks without permission/configuration changes. The first web command
used repository-root JSX configuration: 27 passed and six rendering assertions
errored with `React is not defined`. Running the rendering file from its existing
web workspace fixed the invocation and passed 8/8 without a product change. Two
overlapping passes are not counted twice. Lint subsequently rejected a literal
two-space regex in the new formatting assertion; an equivalent exact-string
assertion resolved it and that one test was reverified 1/1. Original logs remain;
none of these startup/invocation/static failures is hidden as a clean first run.

### Separate formal code review

Completed a post-implementation inspection of the actual diff, new browser source,
prepared integration source and unchanged shared boundaries. The verdict is
**CODE REVIEW PASS for offline implementation**, not browser/database acceptance.
It was not inferred from tests. Severity findings:

- CRITICAL: none identified.
- HIGH: none identified.
- MEDIUM: none identified.
- LOW: none identified.

Reviewed references include practice.schema.ts:13 and practice.dto.ts:13/31
(strict enum/default and seven-field reconstruction); unchanged
practice.repository.ts:24/46/74, concept.repository.ts:122 and
practice.service.ts:10 (publication, projection and authorization);
auth-controller.ts:267 (guarded authenticated read); practice-controller.ts:50,
59, 121, 147 and 195 (four stores, cancellation, type switching, bounds and scoped
confirmation); practice-browser.tsx:97/183 (native pressed controls and empty
controlled draft). Exact paths are in Section 5 or the existing referenced modules.
The review also inspected restricted Markdown/React escaping, hook disposal,
unchanged client response identity validation, test integrity, configuration-only
discovery addition and absence of persistence/execution code. No actual finding
requiring a corrective file/line recommendation remains. Detailed review and
scope evidence are retained alongside the logs.

### Prepared but unexecuted gates and remaining risks

The integration source now adds a Coding-specific subtest plus all-four ancestry,
HTTP authorization and compatibility coverage. Prepared structure is one parent
and seven subtests, **NOT_RUN**. A fresh owner-approved disposable MongoDB gate is
required; historical F033 database results are not F034 persistence verification.

The new browser source prepares seven scenarios: three 1280/768/390 viewport cases
and four cases for type/draft/confirmed clearing, states/Retry/security, obsolete
success/error, and identity/Concept disposal. Cases include initially empty drafts,
inert context, whitespace/length, focus and four-type retention; the combined
100-draft boundary is additionally covered by offline controller tests. Source
inspection/compilation is not runtime discovery. All seven remain **NOT_RUN**;
expected full regression **118 NOT_RUN**, including them. No browser exception
has been approved for F034 and no primary-host browser execution occurred.

Mounted responsiveness, actual keyboard/focus/screen-reader behavior, account-switch
and cancellation races, shared-auth/Concept compatibility and historical browser
limitations remain unverified beyond offline evidence. Preserve Section 8 and
all historical results. No final local-development acceptance or production
readiness is claimed. Next approval: guarded disposable MongoDB verification;
browser execution/feature-specific exception and final acceptance remain separate.

## 10. Owner-authorized MongoDB gate blocked during initialization (2026-10-18)

**Isolation preflight: BLOCKED. Integration: NOT_RUN, zero test invocations.**
The prepared eight checks (one parent and seven subtests) have no F034 database
passing evidence from this gate. F034 remains IN_PROGRESS. No application/test
source changed, no assertion failed, and no database/application defect was
established. Retained offline results are unchanged. No automatic fix or rerun.

Evidence: `.cache/f034-integration-2026-10-18-16-45-36-63862f/`. Preserve original
result.json, initialization/shutdown stderr, ownership/process receipts, protected
baselines and separate cleanup-completion.json; the latter does not replace the
original failure/cleanup errors.

### Verified boundaries and exact blocker

Ordinary unelevated REDGOLDMARK42\Shreeji, PowerShell 7.6.7 and existing Node 24/
MongoDB 8.2 were verified. Port 27018 was initially free. Fresh GUID-named TEMP
storage was empty, non-reparse and current-user owned. The unchanged
scripts/LocalProcessOwner.cs created a fresh native Job; MongoDB entered it
atomically with a retained process handle. PID 21164, creation ticks
639279189402002570, executable, parent and ordinary-user owner were recorded and
rechecked with exact Job membership. Its listener was only 127.0.0.1:27018.
The protected MongoDB PID 5144 was outside that Job and never targeted/connected.

Before database access the owned listener/process identity was reverified. The
initializer connected only to the verified disposable loopback process and checked
server PID, exact fresh dbPath, bind/port and configured f021-test replica name.
It then incorrectly attempted listDatabases before replSetInitiate. MongoDB
rejected that operation with code 13436, NotPrimaryOrSecondary: "node is not in
primary or recovering state". Initialization exited 1 before replica initiation,
writable PRIMARY/empty-target verification or test startup. Therefore the full
isolation gate did not pass. No F034 fixtures or question reads were executed.
The intended database was deeplearner-f021-test; no persistent fallback, .env or
application-development credentials were used.

### Cleanup outcome and limitations

The shutdown helper also attempted collection enumeration while the replica was
uninitialized and exited 1 with the same error before graceful shutdown. Cleanup
then terminated the verified owned Job only; no PID-based or unrelated-process
termination occurred. Job active count became 0 and port 27018 was released.
The wrapper did not observe the retained MongoDB process handle as signaled before
disposal, so MongoExit remains UNKNOWN; this was recorded as a cleanup error, not
silently accepted as a graceful exit. Native child/Job handles were released.
Initial storage removal correctly remained blocked by incomplete exit evidence.

The already-authorized filesystem-only cleanup was subsequently completed without
restarting a server, reconnecting to MongoDB or running tests. Prior exact-Job
membership/empty-Job evidence, current absence of the original creation-time
identity, free port 27018, ownership receipt, current-user ACL owner, exact GUID
boundary, sole mongodb child and non-reparse descendants were checked before
removing only that disposable storage. Removal was confirmed. Original wrapper
errors and the UNKNOWN retained exit code remain retained; forced owned-Job
termination is explicitly distinguished from graceful shutdown PASS.

Protected PID 5144, parent 1304, creation UTC 2026-10-17T04:47:47.7735300Z and
127.0.0.1:27017 ownership matched before/after, including cleanup completion.
Executable/owner stay UNKNOWN for that unrelated process. Recorded development
identities and persistent demo-storage paths, sizes and write times were unchanged.
No demo accounts/content were queried or modified and no shared data was dropped.
The failed startup/cleanup wrapper took 14.07 seconds; separate completion evidence
is timestamped 2026-10-18T11:17:03.5894959Z. No owned process/storage remains.

### Next approval required

Integration and local-development final review remain blocked. Request separate
approval to correct only the in-memory initialization/cleanup ordering: establish
the verified fresh replica's writable PRIMARY before database enumeration; allow
safe graceful shutdown even when initialization has not reached PRIMARY; and
complete a bounded retained-handle exit observation before disposal. Review these
changes, then separately authorize one fresh guarded integration execution. Do not
change application/test assertions or claim CODING/previous-type compatibility,
publication, authorization, DTO secrecy or read-only persistence verified here.
Seven mounted and expected 118 full-regression browser cases remain NOT_RUN;
no prior browser exception transfers and no production readiness is implied.

## 11. Authorized initialization correction and single guarded execution (2026-10-18)

**Initialization/isolation PASS. Integration 8/8 PASS, including the parent
and seven substantive subtests. Cleanup PASS, graceful, no forced termination.**
F034 remains IN_PROGRESS pending separately approved final review. No browser
exception or production acceptance is granted. Section 10's BLOCKED/zero-test
attempt, forced cleanup and UNKNOWN retained exit remain historical evidence;
this successful fresh attempt does not replace or rewrite that record.

Only the temporary in-memory runner initialization/cleanup sequence was corrected.
Application code, integration assertions/fixtures, models, repository scripts,
configuration and connection-security policy were unchanged. PowerShell parsing
and source-order inspection passed before runtime. No offline regression was rerun.
The same prepared command ran once, zero retries:
`node --import tsx --test apps/api/tests/practice.integration.ts`.

Evidence directory: `.cache/f034-integration-recovery-2026-10-18-16-51-59-3d2005/`.
Retain original logs, source pins, context, ownership/process/listener receipts,
protected-process and demo metadata, and result.json. Integration duration was
3.604 seconds (parent 2.675 seconds); startup/preflight/test/cleanup took 14.95
seconds. TestAttempts is exactly 1, all eight checks passed, with no failures,
skips, cancellations or remaining cleanup errors.

### Corrected initialization and verified isolation

- Ordinary unelevated REDGOLDMARK42\Shreeji, PowerShell 7.6.7 and existing Node 24/
  MongoDB 8.2 were verified. Port 27018 was free. Fresh GUID-named TEMP storage
  was empty, non-reparse and current-user owned; no persistent storage was reused.
- The unchanged LocalProcessOwner.cs helper atomically started MongoDB in a fresh
  native Job with no breakaway. PID 2624, parent 22044, creation ticks
  639279193228338790, executable, ordinary-user owner and exact Job membership
  were recorded. A retained native handle remained authoritative for exit checks.
  Protected PID 5144 was outside the Job. The sole test listener was owned by
  this verified process at 127.0.0.1:27018; identity was rechecked before connection
  and before the integration invocation.
- Before replica initialization, only process/configuration identity commands
  checked the exact server PID, owned dbPath, loopback port and f021-test name.
  The runner then initiated the single-member f021-test replica with member
  127.0.0.1:27018 and waited within a 20-second window for writable PRIMARY.
  Port availability was not treated as replica readiness.
- Only after PRIMARY readiness did it enumerate databases, exclude all non-system
  databases and verify deeplearner-f021-test had no collections. The exact database
  name, PRIMARY status and single-member configuration were independently rechecked
  by the unchanged integration test before creating its owned fixtures.
- All child environments were allowlisted. Connections used only the exact owned
  loopback test URI/database, with no .env, real credentials or persistent fallback.
  Port 27017, deeplearner-local-demo, Atlas and production were never connected to.

### Actual integration findings

Default OUTPUT and explicit OUTPUT, DESCRIPTIVE and SCENARIO retrieval remained
compatible. CODING returned only eligible published/schemaVersion-1 Coding
questions. Ordered pagination, type-specific totals, empty later pages, preserved
nullable inert TypeScript context and consistent question references passed.
Unpublished, wrong-type, unsupported-version and inconsistent-reference fixtures
were excluded from the relevant results/counts.

All four types failed closed for hidden ancestors and inconsistent denormalized
references across Concept, Topic, Module, LearningPath and Technology. Signed
STUDENT HTTP retrieval succeeded; unauthenticated and current Admin/suspended/
unverified account access was rejected. Exactly seven allowlisted DTO fields were
returned; answer/explanation/evaluation sentinels, provenance and internal metadata
were absent. Malformed eligible data produced sanitized unavailability. Stored
question snapshots before/after reads were identical. No authored code was executed.
Broader malformed query/body, token-role and rate-limit matrices remain supported
by retained offline tests; this gate does not claim to repeat every such assertion.

### Cleanup and protected baselines

The integration closed its HTTP/database connections and dropped its seven
verified owned collections. Independent cleanup readback found zero collections.
The corrected shutdown helper gates collection enumeration on PRIMARY and still
attempts shutdown if initialization has not reached PRIMARY, preserving UNKNOWN
for unavailable readback rather than bypassing shutdown. In this execution PRIMARY
was available and empty-target readback was verified.

Graceful shutdown helper and mongod both exited 0. The runner used a bounded
retained-handle wait before recording exit/disposal. Exact Job active count 0,
port 27018 release, owned handle/Job release and removal of only the verified
GUID-named disposable storage were confirmed. Forced=false; no cleanup error,
orphan, PID-only termination or unrelated-process action was reported.

Protected MongoDB PID 5144, parent 1304, creation UTC
2026-10-17T04:47:47.7735300Z and 127.0.0.1:27017 ownership were unchanged. Its
executable/owner remain UNKNOWN, not inferred; it was never adopted or targeted.
All recorded development-process identities and demo-storage relative paths, sizes
and write times matched before/after. Demo accounts/content were not queried or
modified and no shared database/collection/storage was dropped.

No application/test defect was identified. Database verification is complete and
ready for separate local-development final-review approval. Seven F034 mounted
browser scenarios and expected full 118 regression cases remain NOT_RUN; browser
execution remains prohibited, no historical exception transfers, and a named F034
exception or ownership-safe browser approval would require a separate owner gate.
Preserve historical F022/F024/F029 and screen-reader/background-throttling/Windows
shutdown gaps. F001-F033 remain APPROVED_COMPLETE; F035 remains NOT_STARTED.

## 12. Owner-approved local browser exception and final review (2026-10-18)

**FINAL REVIEW PASS WITH F034 BROWSER EXCEPTION. Status: READY_FOR_REVIEW.**
The owner explicitly approved a ONE-TIME, F034-specific browser-verification
exception for LOCAL DEVELOPMENT ONLY and this conditional final review. AGENTS.md
permits a named-feature exception for documented infrastructure safety concerns;
its mandatory unit/API/frontend/static/security/applicable-database requirements
remain intact. The exception was not inherited from F031, F032 or F033 and does
not transfer to F035 or any future feature. Owner completion approval is still
required before APPROVED_COMPLETE; no production deployment is authorized.

### Exact browser disclosure and owner-accepted risks

- F034 mounted browser scenarios: **7 NOT_RUN**.
- Expected complete browser regression: **118 NOT_RUN, including those seven**.
  This expected count is based on prepared sources, not a new runtime discovery.
  No browser PASS, full-regression acceptance or production readiness is claimed.
- Primary-host Playwright remains prohibited because Windows process-termination
  safety is unresolved. No browser, synthetic, test or database execution occurred
  during this review and the closed prototype was not modified or reopened.
- The owner explicitly accepts, for local development only, unverified Coding
  layout/responsiveness; real-browser keyboard/focus/accessibility; whitespace,
  tabs, indentation and newlines in a real textarea; account/Concept/type/question
  draft isolation during navigation; cancellation and stale-response races; and
  shared-authentication/Concept-publication compatibility. Offline coverage and
  real MongoDB checks reduce risk but do not prove these mounted behaviors.

### Retained evidence and scope reconciliation

Retain API **61 distinct PASS**, web **201 distinct PASS**, MongoDB **8/8 PASS**
including the parent, build/TypeScript/format/security/browser-spec compile-only
PASS, and the documented lint correction/recheck. Counts are not multiplied by
earlier verification repeats. Sections 9-11 preserve all actual invocation,
startup and cleanup history and original evidence directories.

The initial MongoDB attempt remains BLOCKED with zero tests, pre-initialization
enumeration error 13436, forced owned-Job cleanup and UNKNOWN retained exit code.
The separately authorized fresh execution passed after correcting only the
in-memory runner; graceful shutdown, empty Job, released port, removed disposable
storage and protected baselines passed without force. These are separate outcomes.

Compared the current source inventory with the retained pre-implementation hashes
and exact Section 5 allowlist: **16 unique approved paths, no deletions or unrelated
source changes**. Current product/test/configuration hashes also match those used
for the passed offline/integration verification; only feature evidence changed
after that verification. The review used the retained implementation diff and
current source inspection, not Git operations. This gate changes only this feature
document and DEVELOPMENT_ROADMAP.md. Existing policy, F001-F033 approvals, F035
NOT_STARTED, roadmap history and UTF-8/LF are preserved.

### Separate formal final code-review findings

The implementation delta and reused boundaries were inspected against Sections
2-7, independently of test verdicts. Actual severity findings:

- **CRITICAL:** none identified.
- **HIGH:** none identified.
- **MEDIUM:** none identified.
- **LOW:** none identified.

No actual finding requires an affected-file/line correction recommendation; no
finding was invented to populate a category. Reviewed source references and
acceptance conclusions are recorded below, distinct from findings:

| Acceptance contract | Review evidence and conclusion |
| --- | --- |
| CODING and previous types/default OUTPUT | practice.schema.ts:13, frontend contracts.ts:2 and unchanged practice-client.ts; exact four-type validation, OUTPUT default and response type/Concept identity preserved; retained unit/HTTP/integration compatibility evidence PASS |
| STUDENT authorization and publication | practice.service.ts:10, practice.repository.ts:24 and concept.repository.ts:122; token/current-account eligibility, all five published levels and reference comparisons remain unchanged; offline/MongoDB evidence PASS |
| DTO and answer secrecy | practice.repository.ts:46 and practice.dto.ts:31; projection plus exact seven-field reconstruction exclude answers, explanations and internal metadata; unsafe records fail closed |
| StarterCode and empty student code field | practice-browser.tsx:153/179/183; escaped read-only context and empty native textarea remain separate; no starter prefill, evaluation, execution, submission or new editor dependency |
| Whitespace and four-type isolation | practice-controller.ts:50/147 and practice-browser.tsx:183; no trimming, per-type store plus account/Concept-keyed lifetime; source/component tests retain whitespace/newlines; mounted behavior remains excepted |
| Shared draft limits and cleanup | contracts.ts DRAFT_CAPACITY/DRAFT_LENGTH and practice-controller.ts:147/195; 100 combined entries, 10,000 UTF-16 code units, no silent eviction; confirmed current-instance all-four clear and stale-ticket guards preserved |
| Cancellation, focus and identity races | practice-controller.ts:59/121, auth-controller.ts:267, use-practice.ts and practice-browser.tsx:97; abort/generation/identity checks, disposal, page reset and native selector focus wiring preserved; real-browser races remain unverified |
| Maintainability, XSS and backward compatibility | Existing generic client/repository/Markdown/CSS/hook reused; no new auth/publication implementation, persistence, code execution, unsafe HTML or runtime abstraction; F031-F033 assertions preserved and extended |
| Exact scope | Section 5 inventory and source-hash comparison match all sixteen paths; configuration delta only adds the new spec's discovery entry; no dependency/model/index/environment changes |

References above identify reviewed code, not defects. Unchanged referenced modules
are existing approved dependencies; no edits to those modules are implied.

### Future verification, remaining limitations and handoff

Before browser acceptance, require separately approved ownership-safe execution
and actual discovery/execution of the seven F034 and full expected 118 scenarios,
including outstanding historical compatibility cases. Preserve zero retries,
25-minute combined execution/five-minute initial diagnosis budgets, existing
assertions/timeouts and necessary F024 segmentation. Do not restart infrastructure
work or run browsers under this exception. Manual inspection is supplemental only.
Before production deployment require a separately approved full browser-regression
and release-readiness review; this local exception does not satisfy either gate.

Retain F031's historical 40 PASS / 1 FAIL / 56 NOT_RUN, F022 EPERM/taskkill PID
identity safety blocker, F024 worker-browser conflict, F029 recovered but unresolved
intermittent scrolling, and screen-reader/background-throttling/Windows shutdown
gaps. No historical NOT_RUN or failure is relabelled PASS. Submissions, unlocking,
scoring, attempts/progress, Admin authoring and Playground execution remain deferred.

No substantive F034 acceptance blocker remains under the approved local-development
criteria and named exception. Next gate: owner completion approval, followed only
by separately authorized scoped Git delivery. Do not self-approve completion,
commit/push, deploy or begin F035.

## 13. Explicit owner completion and scoped Git delivery approval (2026-10-18)

The owner explicitly approved F034 **APPROVED_COMPLETE for LOCAL DEVELOPMENT
ONLY**, retaining FINAL REVIEW PASS WITH F034 BROWSER EXCEPTION, and authorized
the exact Section 5 sixteen-file commit and safe push to origin/dev. This approval
supersedes the earlier pending-completion gate; no product/test change or rerun is
authorized. F001-F033 remain APPROVED_COMPLETE; F035 remains NOT_STARTED and is
not authorized for implementation.

Preserve API 61 distinct PASS, web 201 distinct PASS, MongoDB 8/8 PASS, recorded
build/lint/TypeScript/format/security checks and no code-review findings at any
severity. The initial blocked MongoDB initialization/forced owned cleanup and
subsequent successful fresh integration/graceful cleanup remain separate outcomes.

Browser verification remains **7 F034 mounted scenarios NOT_RUN** and **118
expected full-regression scenarios NOT_RUN, including those seven**. The explicit
one-time F034 exception accepts the documented local UI, real-textarea, accessibility,
navigation/draft isolation, cancellation and shared-component compatibility risks;
it does not transfer to another feature or claim browser PASS/production readiness.
Retain F022/F024/F029 and Windows teardown, screen-reader/background-throttling
limitations. Ownership-safe browser verification and a separately approved full
browser-regression/release-readiness review remain required before production.

Authorized commit message: `feat(practice): complete F034 coding questions`.
Delivery must stop on an unexpected path, divergence or safety discrepancy;
stage only the sixteen approved paths, inspect the staged diff, push without
force/rebase/merge, and verify local/tracking/remote HEAD equality and a clean
working tree. No production deployment or automatic F035 work is authorized.

# F035 - Answer Unlock Flow

**Status:** APPROVED_COMPLETE
**Plan date:** 2026-10-18
**Original planning result:** PLAN READY. Historical proposal language below is
retained; subsequent owner approvals authorize the reconciled implementation.
**Current implementation result:** OFFLINE IMPLEMENTATION PASS (Section 11).
**Current final review:** FINAL REVIEW PASS WITH F035 BROWSER EXCEPTION (Section 14).
MongoDB integration is 9/9 PASS (Section 13). The owner explicitly accepts the
one-time F035 browser deferral for LOCAL DEVELOPMENT ONLY: seven mounted scenarios
and expected complete regression 125, including those seven, remain NOT_RUN.
Owner completion approval is recorded in Section 15 for LOCAL DEVELOPMENT ONLY.
No production approval or browser PASS is claimed; the exception does not transfer
to another feature.

**Subsequent owner approval (2026-10-18):** P1-P8 reconciled PASS. Owner authorized
the exact Section 5 twenty-three-file implementation/offline scope. P1's canonical
URL parameter is questionId as specified in the reviewed route; P2-P8 retain the
plan's exact bounds, fields, 30/subject unlock limit, single bounded reveal,
LOCAL-only guard, temporary nonpersistent semantics and published ancestry policy.
No conflict or architectural expansion was identified. F035 is IN_PROGRESS;
MongoDB/browser execution and any named browser exception remain separately gated.
The proposal language below records the historical planning gate; the approved
reconciliation is recorded in Section 9. F001-F034 approvals remain unchanged.

**Expanded scope approved:** the owner authorized exactly 27 paths, adding the
three compatibility specifications in Section 5. Their obsolete Submit prohibition
now recognizes the approved question-scoped action while retaining execution,
scoring/grading and unapproved reveal-shortcut prohibitions.

**Historical implementation approval:** the Section 10 blocker is resolved by authorizing app.ts
as the 27th path. Exact-route POST no-store middleware precedes CORS/JSON parsing;
no broad Practice-prefix policy is added. Implementation/offline verification may
resume. F035 remains IN_PROGRESS; MongoDB/browser execution is not authorized.

The owner provisionally approved planning a request-scoped, nonpersistent
LOCAL-DEVELOPMENT contract refinement and creation of this document ONLY. No
other file/status change, test, service, browser, database, Git, dependency or
infrastructure operation is authorized. F001-F034 retain APPROVED_COMPLETE and
their historical limitations. F036 remains NOT_STARTED and outside this gate.

## 1. Authority, objective and sequencing deviation

Consulted AGENTS.md, DEVELOPMENT_ROADMAP.md, PRD sections 23-24/95,
SYSTEM_ARCHITECTURE.md, DATABASE_DESIGN.md practiceQuestions/practiceAttempts and
practice algorithm, API_DESIGN.md, approved F030-F034 contracts, existing Practice
modules/tests and the Concept-learning Stitch screen.png/code.html references.
The existing native Practice page is the UI reference; generated quiz/XP controls,
CDN dependencies, Playground execution and future design illustrations add no scope.

The roadmap names **F035 - Answer Unlock Flow**, depends on **F031**, and leaves
it NOT_STARTED. It does not define an unlock endpoint or qualifying submission.
F030 supplies the model, F031 supplies eligibility/publication/retrieval/UI, and
F032-F034 supply four-type selection and bounded memory-only drafts. Those are
existing reuse prerequisites, not new roadmap dependency/status changes.

There is an explicit sequencing conflict:

- PRD requires student submission before official answer/explanation disclosure.
- Database Design's full algorithm records an immutable practiceAttempt, updates
  progress transactionally where applicable, then returns unlocked content.
- F036 owns persistent attempts; F037 and later features own progress/completion.

**PROPOSED local refinement:** validate a nonempty submitted answer and current
question eligibility in one authenticated POST, then return the official answer
and optional explanation in that response. This is submit-to-reveal, not recorded
attempt authorization. It creates NO practiceAttempt, attempt ID, history, score,
progress, completion, durable entitlement or transaction. A later request must
repeat validation; a client assertion that it submitted previously is not proof.

No absolute AGENTS.md prohibition on an explicitly owner-approved refinement was
found. Its approval/scope/security/test rules still apply. The owner has approved
planning only: implementing this deviation requires explicit final contract
approval and future additive API/Database Design documentation within Section 5.
Do not silently rewrite the original PRD/database requirement as satisfied.
If this local refinement is rejected, stop F035 and request owner-approved
resequencing of F036 before F035; do not start F036 automatically.

### Future replacement by F036

F036 must separately specify validated immutable persistence, identity/question
binding, integrity, duplicate/idempotency behavior and failure semantics. It can
extend/replace this endpoint behind the same explicit authorization boundary, but
must return answers only after the required owned attempt commits successfully.
Do not fall back to transient reveal if persistence fails. No F035 request or UI
memory may be retroactively treated as a saved attempt or reconstructed into
attempt history. Future scoring/progress contracts are not invented here.

Already disclosed answers cannot be recalled from a student's observation/copy.
Clearing UI memory is isolation hygiene, not DRM or proof of a durable unlock.

## 2. Proposed POST request and security contract

All new endpoint details in this section are **PROPOSED for owner approval**,
using existing conventions where identified. The existing GET remains unchanged.

### Path clarification and local-only boundary (P1/P6)

The approval text renders `POST /api/v1/practice-questions//unlock` without a
question-ID segment, while requiring question-ID validation. Proposed resolution,
consistent with the earlier inventory proposal:

`POST /api/v1/practice-questions/:questionId/unlock`

Owner must confirm this exact path before implementation. Do not implement a
double-slash alias, infer a question from Concept/type, or accept an unspecified
question-ID body field. No new top-level router/app.ts mounting is necessary.

Propose registering this temporary POST only when the EXISTING server-only
APP_ENV equals LOCAL. Other environments retain existing 404 ROUTE_NOT_FOUND.
Do not add environment variables, NEXT_PUBLIC exposure, settings or global policy
changes. GET keeps its existing behavior in every environment. The local client
may receive a safe unavailable error elsewhere; no capability-discovery endpoint
or production-ready submit UI contract is introduced. This proposed guard is
additional defense, not approval to deploy a server configured LOCAL publicly.

### Input and qualifying submission (P2)

```text
Content-Type: application/json
Authorization: Bearer <existing access token>

{
  "conceptId": "<24 hexadecimal characters>",
  "studentAnswer": "<nonblank string, preserved verbatim>"
}
```

- Params: strict object containing only questionId. Require exact 24-hex strings
  for questionId and conceptId, normalize identifier case as F031 does, reject
  trailing whitespace/newlines, nulls, coercion, arrays and nested identifiers.
- Body: strict flat object with exactly conceptId and studentAnswer. Reject
  unknown keys (including answer, explanation, score, userId, attemptId, type,
  evaluation or claimed unlock flags), missing values, nulls, arrays, objects,
  numbers, booleans and non-JSON/malformed bodies. Query must be empty/strict.
- Propose studentAnswer length 1-10,000 UTF-16 code units, matching current draft
  limits. Reject values whose trim() is empty, but DO NOT trim, format, normalize
  indentation/newlines, parse or execute an accepted value. Browser textarea
  newline normalization is not a byte-for-byte file-editor guarantee.
- All four canonical types use the same string contract. No answer-object union,
  code evaluation, correctness check, semantic-effort threshold or grading.
  A nonblank nonsense answer can qualify; this limitation needs explicit owner
  acceptance. It is not meaningful-attempt verification or anti-cheating protection.
- Reuse express.json's existing 256kb limit/decoding semantics, safe validation
  details and error handler; no new raw-body parser or global middleware change.
  Require application/json. Duplicate query keys are rejected; do not promise
  duplicate JSON-property detection that the current parser does not provide.
  If that is required, stop for a separately approved parser/scope decision.
- Never include studentAnswer in a URL, telemetry, audit record, log or response.
  It is used only transiently to qualify this request, then discarded server-side.

### Authentication, publication and reference consistency

Reuse bearer middleware, current-account STUDENT/ACTIVE/verified eligibility,
FREE/PREMIUM parity, CORS/origin checks and request IDs. Cookies are omitted by
the client and are not an alternative authorization source. ADMIN is denied;
there is no Admin answer preview, authoring or publishing action.

Business logic remains Route -> Middleware -> Controller -> Service -> Repository.
The service verifies eligibility before question content reads. Reuse its existing
check via a private local helper if needed, without changing the auth strategy or
GET behavior. Recheck the full F021 Concept -> Topic -> Module -> LearningPath ->
Technology PUBLISHED chain and every existing denormalized reference comparison.
Question ID must belong to the supplied Concept, match consistent Topic/Technology,
be PUBLISHED, schemaVersion 1 and one of OUTPUT/DESCRIPTIVE/SCENARIO/CODING.

Freshly run these checks on EVERY POST; never trust prior GET results, browser
drafts, role claims in a body or a cached local reveal. Use a distinct repository
unlock projection, reusing publishedConceptStages. The GET list pipeline remains
exactly seven answer-free fields and must not gain a reveal flag/includeAnswer
switch. No attempt lookup, question write, collection/index creation or migration.

Approved F031-F034 reads use lifecycle publication/ancestry, not an independent
author-role/approval-audit verifier. F030's broader future Admin-provenance wording
does not establish a new implemented read-side policy. Proposed F035 preserves
the completed publication contract; it must NOT claim to validate Admin authorship
or publishing authorization. Owner should confirm this boundary (P8); stronger
approval provenance would require a separately specified policy/scope review.

### Limits, errors, caching and logging (P3/P4)

Preserve GET 120/subject per 15 minutes and existing shared 300/IP budget. Propose
an additional POST unlock budget of **30/subject per 15 minutes**, shared across
all questions/types. Reuse HMAC-obscured keys and standard rate-limit headers;
both routes share the existing IP limiter instance. Keep any new unlock limit
optional in the test-injected PracticeLimits contract, defaulting to the approved
value, so app.ts and existing callers do not need edits. Exact value needs approval.

Proposed HTTP behavior, using existing codes/envelopes:

| Outcome | Status/code and safe behavior |
| --- | --- |
| Valid local submit-to-reveal | 200 with the exact response in Section 3; no write/attempt-created claim |
| Invalid IDs/query/body/nonblank/length | 400 VALIDATION_ERROR, existing sanitized field details without submitted values |
| Missing/invalid/expired token | Existing 401 auth errors; no question answer access |
| Ineligible/non-STUDENT/current-account failure | Existing 403 account/role errors or USER_NOT_FOUND as already defined |
| Missing, hidden or mismatched Concept/question/ancestry | Proposed uniform 404 CONCEPT_NOT_FOUND using existing generic unavailability; no existence oracle |
| Oversized decoded JSON | Existing 413 PAYLOAD_TOO_LARGE |
| Unsupported media type/encoding | 415 UNSUPPORTED_MEDIA_TYPE using existing error envelope |
| Subject/IP budget exhausted | 429 RATE_LIMIT_EXCEEDED, no answer/error payload leakage |
| Storage failure or invalid eligible answer projection | Sanitized 503 DEPENDENCY_UNAVAILABLE; never return a partially valid answer |
| Unregistered path/method or non-LOCAL POST | Existing 404 ROUTE_NOT_FOUND |

No new shared error enum/client.ts modification is proposed. The Practice client
preserves existing safe mappings and REQUEST_FAILED fallback for unrecognized
codes/statuses; owner must approve the generic missing-content error choice.

Apply no-store to POST success AND errors via the existing router policy; client
cache:no-store, credentials:omit and redirect:error remain mandatory. Fixed route
template logging must never include actual IDs/URLs, body, studentAnswer, official
answer, explanation, token or raw errors. Existing request/error loggers select
safe operational fields; verify call sites instead of relying on redaction (which
is defense in depth). No new analytics, audit/event persistence or answer logging.

## 3. Proposed explicit response and answer-secrecy boundary (P3)

```text
{
  "success": true,
  "data": {
    "id": "<question ID>",
    "conceptId": "<Concept ID>",
    "type": "OUTPUT | DESCRIPTIVE | SCENARIO | CODING",
    "answer": "<official authored answer>",
    "explanation": "<authored explanation or null>"
  },
  "message": null,
  "meta": { "requestId": "<existing request ID>" }
}
```

Exactly five data fields and only requestId metadata are proposed. No student
answer echo, attempt/result/score/saved flag, provenance, status, evaluation,
timestamps, user identity, version, prompt, related content or arbitrary metadata.
The UI retains its submitted snapshot locally, not as a server-authenticated receipt.

Repository lookup may internally project IDs/type/answer/explanation only after
the eligible-parent pipeline and question predicates; construct a dedicated DTO
field by field rather than spreading a model. Validate canonical trimmed nonblank
answer and optional explanation with F030's 1-50,000 code-unit bounds. Normalize
only an absent explanation to response null; unsupported stored values, including
explicit model-invalid null, fail closed rather than disclosing a partial result.
No schema/model/index/defensive select change. Mongoose select is NOT authorization;
explicit aggregation can read hidden fields only within this qualified operation.

Frontend parses a strict separate unlock envelope and checks returned question,
Concept and type against the captured request identity. A GET containing answer
keys remains invalid even after a successful unlock. Errors never include any
official/student answer; body-schema failures never echo rejected data.

### Question changes and durable-proof limitations (P7)

The proposed response reflects eligible content at the POST database read. This
is not a content-version-locked snapshot, and publication may change after that
read. Reusing current publication checks does not create a transaction spanning
rendering, submission and future content edits. Existing frontend context
fingerprints invalidate known changes, not unseen server edits. Owner must accept
this temporary limitation or approve a version-binding contract/scope change.
No new persisted source/version field, signed ticket, client-trusted receipt,
global unlocked flag or idempotency store is silently added.

## 4. Four-type UI, memory and request lifecycle (P5)

Reuse the existing Practice page for all four types and existing drafts. Each
eligible displayed question gains a native **Submit Answer** button with its
question heading as accessible context. No standalone Reveal/Show answer action
or GET link may disclose official content. Pending submissions have accessible
status and duplicate-click protection; failures retain the draft and offer an
explicit retry submission, never an automatic resend/retry or auth-refresh loop.

Show this exact text only after a validated successful POST:

> Answer revealed. This attempt has not been saved or graded.

Display Your Answer from the captured submitted draft, Official Answer and optional
Explanation as read-only labelled sections. Use the existing restricted Markdown
renderer for authored answer/explanation (h3 section headings, headingBase 4 inside
them), escaped text for the student/code snapshot and existing contained code
styles. No raw HTML, script, evaluation, fetching authored resources, execution or
grading. Missing explanation has truthful absent-state text rather than invented
content. No score, attempt number, history, XP, completion or unlock-persistence claim.

### Bounded proposed reveal state

Keep at most ONE active unlock request/reveal result per mounted account/Concept
controller. It is bound to account + Concept + type + question ID + captured
student draft + current authored-context fingerprint. This bounds official text
to two 50,000-unit fields plus one 10,000-unit student snapshot, not an unbounded
map or 100 cached solutions. Question labels remain available to assistive tools.

- Starting another question's submission aborts the previous request, invalidates
  its generation and clears the prior revealed result. No stale success OR error
  can replace the active question's state. Same-question duplicate submit while
  pending is a no-op; retry is an explicit new validated POST.
- Accept submission only for a ready, currently displayed eligible question and
  active type, using its actual nonblank draft. Never substitute starterCode or
  generate an answer to satisfy the gate. CODING drafts remain initially empty.
- Editing the relevant draft, starting page/load/Retry/type navigation, known
  context-fingerprint replacement or successful relevant draft clearing aborts
  and clears reveal state. Opening/canceling Clear all alone does not delete work;
  only the current confirmed action clears that scope's drafts and reveal state.
- Account/Concept replacement, logout, pending/ineligible auth, unmount or disposal
  clears submitted/revealed snapshots and aborts requests. Old controller callbacks
  cannot affect a new identity. Type/question changes cannot display another
  identity's official content. Previously visited drafts are still retained under
  existing rules, but reveal results are NOT retained across navigation.
- Preserve 100 drafts TOTAL across four stores, 10,000 units each, no silent
  eviction, whitespace/newline handling, stale typed-edit/confirmation checks and
  existing account-reset lifecycle. No localStorage/sessionStorage/cookie/MongoDB
  persistence, BroadcastChannel payload, telemetry or browser URL carries answers.

Use the existing guarded runAuthenticatedRead callback for this data-only POST:
it performs no durable mutation and retains pre/post account/generation/signal
checks. Do not change shared auth code or add retry semantics. Add an independent
unlock AbortController/generation so a late POST cannot override GET/draft state;
reuse the current client deadline convention (15 seconds) and external cancellation.

Keep type-selection focus, page-1 reset and pagination heading-focus behavior.
Submit/retry uses native keyboard controls and visible focus. Announce pending,
success and safe errors within the question; keep focus on the initiating button
rather than automatically jumping into official content. Use existing aria-describedby
connections/live statuses and labelled answer sections. Keep long Markdown/code
contained with focusable overflow and no Tab trap. Static semantics are not proof
of mounted accessibility or exhaustive screen-reader compatibility.

## 5. Proposed exact implementation inventory and path inspection

The initial planning baseline contained 23 paths. The owner subsequently approved
**27 unique paths: two planned creations (including this plan) and 25 modifications**.
The plan already exists at implementation time; updating it adds no extra path.
The three added specifications correct known compatibility expectations only;
they do not authorize browser execution, fixture changes or infrastructure changes.

| # | Operation | Exact path | Responsibility |
| --- | --- | --- | --- |
| 1 | Create (planning gate only now) | docs/features/F035-answer-unlock-flow.md | Proposed contract, deviation, inventory, acceptance and future evidence |
| 2 | Modify | docs/DEVELOPMENT_ROADMAP.md | Future approved F035 status/evidence; preserve F036 boundary |
| 3 | Modify | docs/API_DESIGN.md | Add approved local-only POST and preserve GET contract |
| 4 | Modify | docs/DATABASE_DESIGN.md | Additive temporary sequencing refinement; preserve final immutable-attempt algorithm |
| 5 | Modify | apps/api/src/modules/practice/practice.schema.ts | Strict unlock params/query/body without altering GET |
| 6 | Modify | apps/api/src/modules/practice/practice.dto.ts | Distinct explicit answer-bearing DTO after authorization |
| 7 | Modify | apps/api/src/modules/practice/practice.repository.ts | Eligible single-question answer lookup using existing ancestry stages |
| 8 | Modify | apps/api/src/modules/practice/practice.service.ts | Qualify submission and reuse current eligibility; no attempt writes |
| 9 | Modify | apps/api/src/modules/practice/practice.controller.ts | Existing envelope/request-ID response, no business logic |
| 10 | Modify | apps/api/src/modules/practice/practice.routes.ts | Local-only POST middleware, media validation, fixed route label |
| 11 | Modify | apps/api/src/modules/practice/practice-rate-limit.ts | Proposed unlock budget with existing IP/HMAC conventions |
| 12 | Modify | apps/api/tests/practice.test.ts | Validation, qualified lookup/projection, service and GET compatibility |
| 13 | Modify | apps/api/tests/practice-routes.test.ts | HTTP auth, request/media/body, rate, secrecy/no-store/logging tests |
| 14 | Modify | apps/api/tests/practice.integration.ts | Prepared disposable qualified answer reads and immutable data snapshots |
| 15 | Modify | apps/web/src/lib/practice/contracts.ts | Separate strict unlock envelope; existing GET/draft contracts intact |
| 16 | Modify | apps/web/src/lib/api/practice-client.ts | Abortable authenticated JSON POST and strict response identity checks |
| 17 | Modify | apps/web/src/lib/practice/practice-controller.ts | Single bounded reveal state, independent cancellation and identity cleanup |
| 18 | Modify | apps/web/src/components/practice/practice-browser.tsx | Submit/status/read-only result/disclaimer within existing page |
| 19 | Modify | apps/web/tests/practice-client.test.ts | POST request, errors, response allowlist, identity and cancellation |
| 20 | Modify | apps/web/tests/practice-controller.test.ts | Four-type submit/reveal isolation, races, clearing and bounded state |
| 21 | Modify | apps/web/tests/practice-rendering.test.ts | Submission/result semantics, safe Markdown/inert text and compatibility |
| 22 | Create (prepared, NOT_RUN) | tests/browser/practice-answer-unlock.spec.ts | Prepared mounted acceptance only, not executed |
| 23 | Modify | playwright.f024.config.ts | New spec discovery entry only; existing timeouts/retries unchanged |
| 24 | Modify | tests/browser/practice-descriptive.spec.ts | Recognize question-scoped Submit Answer; preserve unrelated security assertions |
| 25 | Modify | tests/browser/practice-scenario.spec.ts | Recognize question-scoped Submit Answer; preserve unrelated security assertions |
| 26 | Modify | tests/browser/practice-coding.spec.ts | Recognize question-scoped Submit Answer; retain inert-code and no-execution assertions |
| 27 | Modify | apps/api/src/app.ts | Exact unlock POST no-store before CORS/JSON errors; preserve unrelated routes |

Inspection confirms the existing practice router is already mounted, shared logs
use safe selected fields, the auth read guard supports a supplied cancellable
operation, the hook owns account/Concept lifecycle, and existing CSS/Markdown
support these native elements. Only the approved Practice test fixtures reference
the interfaces needing new methods. No shared auth/client error module,
hook, CSS, model, shared package, logger, dependency or environment edit is planned.
Do not extract components merely for abstraction or create a second auth/publication
policy. Preserve GET list signatures/tests and optional injected rate-limit settings.

If an extra file is needed (including global logging/parser changes, auth-controller
changes, CSS or new shared error codes), STOP before editing it. Present exact
scope adjustment, alternatives and risks for owner approval. Do not manufacture
edits to files that already satisfy an approved requirement.

## 6. Acceptance, verification and formal code-review gates

### Offline implementation and regressions - separate approval

Plan focused tests plus relevant API/frontend regressions, with distinct counts
and no unnecessary repeated passes. Run build, lint, TypeScript, formatting,
browser-spec compile-only, exact scope/security review and the independent final
diff review below. Inspect scripts first: no browser or database startup in the
offline gate. No new dependencies or permanent test infrastructure.

Required focused coverage:

1. Exact path, LOCAL-only availability, strict IDs/empty query/JSON body, length
   boundaries, nonblank qualification and preserved student whitespace. Reject
   nested/unknown/null/coerced/unsupported bodies, malformed JSON/media/size cases.
2. Unauthenticated/invalid/expired token and token/current-account non-STUDENT,
   disabled/suspended/unverified/missing-user rejection before answer access.
3. All four types, complete published ancestors and reference comparisons;
   hidden/missing/question-Concept mismatch and invalid version fail closed.
4. GET's exact seven answer-free fields unchanged, including after unlock;
   POST exact five fields, optional explanation normalization, wrong identity/
   malformed projection rejection, no secrets in error/validation/log output.
5. No-store for success/errors; shared IP and separate unlock subject rate
   behavior across types/questions; default GET limits/envelopes unchanged.
6. Client method/URL/body/headers, cookies omitted, no-store, redirect rejection,
   strict safe response, timeout/external abort and no automatic retry/refresh.
7. Four-type controller submissions, duplicate suppression, bounded one-result
   state, edited drafts, cross-question/account/Concept/type isolation, stale
   success/error, pagination/navigation, disposal and unchanged draft limits.
8. Clear-all confirmation/cancel/stale tickets, no unintended clearing of other
   identities, safe answer/explanation Markdown, inert code, truthful disclaimer,
   loading/success/error feedback and native keyboard/focus wiring.
9. Explicitly prove no model creation/save/update/attempt/progress/event write
   path, execution call, student-answer log or durable/reusable unlock token.

### Disposable MongoDB integration - separate execution approval

Extend the existing prepared integration source within the inventory, but do NOT
execute it during implementation/offline preparation. Under separate approval use
fresh owned disposable storage and exact 127.0.0.1:27018, replica f021-test,
database deeplearner-f021-test. Verify original process handle/creation identity,
executable/owner/Job and listener before connection. Initialize the fresh replica,
wait bounded writable PRIMARY, then enumerate/verify empty target before fixtures.
Protect existing MongoDB 27017, demo accounts/content/storage, Atlas and production.

Run once, zero retries. Verify four-type qualified unlock, post-publication changes
before requests, ancestry/reference consistency, current STUDENT authorization,
allowlisting, GET secrecy and no mutations. Use byte/value snapshots of owned
question data; confirm no practiceAttempts/studentProgress collections or records
are created. No answer scoring or authored-code execution. Close connections,
remove only owned fixtures, graceful shutdown first, retained-handle exit/empty
Job/free port/storage checks and protected baseline comparison. Record forced or
incomplete cleanup separately; no PID-only cleanup or automatic corrections/reruns.

### Prepared browser coverage - execution prohibited

Propose seven cases, subject to owner approval and future actual discovery:

1. Desktop all-four submit-to-reveal, hidden pre-submit content, empty Coding
   draft and exact successful disclaimer; no saved/graded claim.
2. Tablet/mobile containment, long inert code/Markdown and native keyboard/focus
   feedback; test scrolling only for measured real overflow.
3. Empty/whitespace/overlong submissions, safe request/response contracts,
   unauthenticated/non-STUDENT errors, no-store and no forbidden external requests.
4. Account/Concept/type/question navigation isolation and memory disposal.
5. Edited drafts, held success/errors, superseded submissions and cancellation.
6. Clear-all confirm/cancel/stale actions and existing four-type draft retention.
7. Loading/error/explicit retry, unavailable content, malicious authored text,
   untouched GET secrecy and absence of submission persistence/scoring controls.

Prepare mock-only browser spec and static compilation; do NOT load/run Playwright,
Chrome, services or a real database. Proposed F035 mounted coverage is **7 NOT_RUN**;
expected aggregate is **125 NOT_RUN** if seven are added to the outstanding 118.
These are planning counts, not discovered/executed results, and include historical
outstanding cases rather than adding the prior 56 a second time.

Owner-approved ownership-safe execution is separately required. Preserve zero
retries, 25-minute combined browser/five-minute initial diagnosis budgets, existing
assertions/timeouts and F024 segmentation. A F035-specific local exception, if
needed, must separately record exact NOT_RUN, real evidence, owner-accepted risks
and required future verification. No F034/other exception transfers. Manual checks
are supplemental. Production requires a separately approved full browser-regression
and release-readiness gate plus resolution of the temporary persistence deviation.

### Mandatory independent final implementation-diff review

**Current review status: COMPLETE for final local-development review (Section 14),
with the offline review and resolved finding retained in Section 11.**
The following was the originally approved review procedure. After implementation
and appropriate verification, inspect the actual complete diff and unchanged
reused boundaries independently of test outcomes. Cover correctness, maintainability,
duplication, authorization, publication, sensitive data/log/error leakage, validation/
integrity, memory/races/cancellation, XSS/execution, accessibility, GET/F031-F034
compatibility and exact file scope. Passing tests do not complete this review.

Report actual **Critical / High / Medium / Low** findings with exact affected
file/line, trigger, impact, recommended correction and verification evidence. Say
none for a category only after review; do not invent findings or future line
numbers. Track resolution/re-review or explicit owner decision. Unresolved
substantive defects block acceptance; do not self-waive findings or expand scope.

## 7. Owner decisions before implementation

| Decision | Exact PROPOSED resolution requiring approval |
| --- | --- |
| P1 - Route ambiguity | Confirm POST /api/v1/practice-questions/:questionId/unlock; do not implement the incomplete //unlock spelling |
| P2 - Submission qualification | All four types; nonblank string of 1-10,000 UTF-16 units, preserve accepted whitespace; no semantic/correctness proof, score or saved attempt |
| P3 - DTO/errors | Exact five-field id/conceptId/type/answer/explanation response, absent explanation -> null; generic existing 404 CONCEPT_NOT_FOUND and other existing envelopes/codes as Section 2 |
| P4 - Limits | 30 unlocks/subject/15 minutes, shared 300/IP with GET; GET 120 unchanged; optional injected unlock limit with approved default |
| P5 - UI lifetime | One pending/revealed question at a time; navigation/edit/identity clears reveals, not retained drafts; exact disclaimer and explicit retry; no storage |
| P6 - Local enforcement | Existing server-only APP_ENV=LOCAL registers temporary POST; outside LOCAL returns normal route-not-found; no new public flags/capability endpoint |
| P7 - Temporary semantics/F036 | Explicitly accept request-scoped nonpersistent disclosure and current-at-read rather than version-locked content; approve additive Database/API refinement and require future persistence before durable/production acceptance |
| P8 - Publication boundary | Reuse approved F021/F031 PUBLISHED ancestry/reference policy; no new Admin-authorship/approval-audit validation or Admin preview; stronger policy requires specification/scope review |

The baseline 23 paths appear sufficient for these proposals. Owner must approve
the resolved contracts AND exact inventory before implementation; any adjustment
must be separately presented. If persistence or version-bound proof is essential
now, retain BLOCKED implementation and request explicit resequencing/scope approval
rather than weakening answer secrecy or implementing F036 under F035.

## 8. Preserved evidence, exclusions and next gate

F034's API 61 distinct PASS, web 201 distinct PASS, MongoDB 8/8 PASS, static/security
and no-findings review are historical F034 evidence, not F035 tests. Preserve its
initial blocked initialization/forced cleanup and successful later graceful run.
Its seven mounted and expected full 118 NOT_RUN remain outstanding; its named
local exception does not transfer. Keep F031's historical 40 PASS / 1 FAIL /
56 NOT_RUN, F022 EPERM/taskkill PID identity risk, F024 worker-browser lifecycle
conflict, F029 unresolved intermittent scrolling/independent recovery, and screen-
reader/background-throttling/Windows shutdown gaps. Do not restart the closed
Playwright prototype or introduce hosted/cloud/paid/VM tooling.

Excluded: immutable attempts/history, F036 implementation, progress/completion/XP,
grading/scoring/evaluation, execution/Playground/Monaco, Admin authoring/publishing,
new models/indexes/migrations, answer caches/storage, global auth/log/parser changes,
new dependencies/infrastructure, PRD's unmodeled Key Points/Related Concept fields,
production deployment and claims of completed PRD practice acceptance.

This gate creates only this UTF-8/LF feature plan, leaving F035 NOT_STARTED and
the roadmap unchanged. Next gate is owner review/approval of P1-P8 and exact scope
for implementation/offline verification only. MongoDB execution, browser execution
or named exception, final acceptance, completion and Git delivery remain separately
approved gates. STOP before implementation.

## 9. P1-P8 reconciliation and implementation scope blocker (2026-10-18)

**P1-P8 reconciliation PASS. Implementation BLOCKED, partial and unverified.**
The owner approved the reviewed proposals and conditional implementation. P1's
canonical parameter is :questionId in the plan's exact POST route; P2-P8 reconcile
without a contract conflict. Retain nonblank <=10,000 UTF-16 units without trimming
accepted formatting; five allowlisted response fields; strict body/query/size and
30/subject unlock budget; isolated bounded reveal; server-side LOCAL guard;
temporary nonpersistent semantics requiring F036 policy before deployment; and
fresh question/five-level publication/reference checks. No shared-auth, model or
architectural expansion was required for those decisions.

Partial work within the approved inventory adds the API validation/DTO/qualified
repository/service/controller/LOCAL-only route/rate support and the frontend
contracts/client/controller/native reveal presentation, plus status documentation.
Source inventory reports **13 existing approved files modified, no new file or
deletion** at the stop point. The new browser spec, remaining documentation/test
fixtures, formatting, focused/regression/static checks and formal final review
are not complete. No tests, database, browser, services or Git operations ran.
No implementation PASS, security-verification PASS or MongoDB readiness is claimed.

### Confirmed out-of-scope compatibility touchpoints

The approved Submit Answer action necessarily matches older absence assertions:

| Exact existing file | Line | Existing expectation conflicting with F035 |
| --- | --- | --- |
| tests/browser/practice-descriptive.spec.ts | 239 | getByRole(button, name /Submit\|Unlock\|Score/i) must have count 0 |
| tests/browser/practice-scenario.spec.ts | 255 | getByRole(button, name /Submit\|Unlock\|Score/i) must have count 0 |
| tests/browser/practice-coding.spec.ts | 267 | getByRole(button, name /^(Run\|Submit\|Unlock\|Score)/i) must have count 0 |

These are source-established contradictions, not executed browser failures. They
would reject the approved new control even if every F035-specific test passed.
The OUTPUT browser specification was inspected and has no matching prohibition.
Do not evade these checks with misleading button names, hidden controls, removal
of old suites/configuration entries or a browser exception masking known failures.

AGENTS.md requires stopping before changes to another feature or unapproved
paths. Therefore none of the three existing specifications was changed and
implementation/verification stopped at this discovery. Critical/High/Medium/Low
final code review remains NOT_PERFORMED, not a no-findings verdict.

### Exact requested scope adjustment

Request owner approval to expand the implementation boundary from **23 to 26
unique paths**, adding only the three exact browser-spec paths above as
modifications (two planned creations and 24 modifications overall).

Limit each correction to replacing the obsolete blanket Submit prohibition with
positive assertions for the approved accessible question-scoped Submit Answer
controls and their empty-draft disabled state where applicable. Preserve existing
prohibitions on unimplemented unlock shortcuts, scoring, and code execution where
present, plus all rendering/keyboard/request-isolation assertions. No timeout,
retry, fixture, configuration, auth or product-behavior workaround is proposed.
No additional scenarios or count change is needed for these assertion updates.

Alternatives considered: leaving known-failing compatibility assertions is not a
valid completed regression plan; suppressing controls in older tests or dropping
coverage weakens acceptance; changing the approved UI to avoid a locator would
violate the feature. Recommend the three focused test-contract corrections under
explicit approval, then resume remaining authorized implementation/offline checks.
Browser execution remains prohibited and expected total 125 remains NOT_RUN.

Next gate: owner approval of these exact three added paths/corrections and resumption
within that expanded scope. F035 stays IN_PROGRESS; F001-F034 approvals and F036
NOT_STARTED are unchanged. No out-of-scope changes, dependencies or infrastructure.

## 10. Expanded-scope resumption and pre-router no-store blocker (2026-10-18)

Owner approved the exact 26-file inventory, including the three existing browser
compatibility specifications. Those specifications now positively check the
accessible, enabled Submit Answer for Question 1 control within its article.
Existing execution, scoring/grading, unapproved reveal shortcuts, authored-text
safety, navigation, keyboard and request-isolation assertions remain in place.
No browser cases were executed and no timeout, retry or fixture was changed.

During resumed source review, a further contract/scope conflict was established:
apps/api/src/app.ts installs CORS and express.json before mounting the Practice
router. A disallowed Origin, malformed JSON, oversized JSON or unsupported parser
encoding can therefore fail before the router's no-store middleware runs. The
global error handler does not add Cache-Control. The approved Section 2 policy
requires no-store on POST errors as well as success; the current router-only
implementation cannot guarantee it for these early failures. These errors do not
contain official answers, but absence of sensitive content does not satisfy the
approved cache-header contract.

Minimal proposed correction: authorize apps/api/src/app.ts as the 27th path and
install a Practice-prefix no-store header middleware before CORS/body parsing.
Keep all authentication, parser limits, routes, error envelopes and logging
unchanged. Extend the already-approved practice-routes.test.ts with early-error
cache-header/secrecy checks. No shared global error-handler change is needed.
Alternatives: weakening the error contract is unapproved; moving/duplicating the
body parser or patching Express internals is a larger, unnecessary change.

Implementation STOPPED before editing app.ts. A filesystem SHA-256 comparison
against the pre-implementation source inventory identifies 16 changed approved
paths, no additions or deletions at this point. Implementation is partial and
unverified. API/frontend tests, build/lint/typecheck/format/browser-spec static
checks and formal severity review have NOT_RUN/NOT_PERFORMED in this resumed gate.
No completed implementation/security PASS or MongoDB readiness is claimed.

P1-P8 reconciliation remains PASS. F035 stays IN_PROGRESS; F001-F034 approvals
and F036 NOT_STARTED remain unchanged. Seven mounted F035 and expected 125 full
browser scenarios remain NOT_RUN; MongoDB is separately gated. No browser,
database, Git, dependency or infrastructure operation occurred. Next gate:
explicit owner approval for this single app.ts scope addition and resumption.
## 11. Approved 27-file implementation and offline evidence (2026-10-18)

**P1-P8 reconciliation PASS. OFFLINE IMPLEMENTATION PASS. Status IN_PROGRESS.**
The owner resolved the historical Section 9/10 scope blockers. The final authorized
inventory is exactly the 27 Section 5 paths (two planned creations and 25
modifications). No dependency, model, index, environment, shared-authentication or
unapproved file change. F001-F034 approvals and F036 NOT_STARTED are preserved.
The owner specifically required exact-route matching rather than the broader
prefix initially proposed in Section 10; that revision is implemented.

### Implemented contracts

- POST /api/v1/practice-questions/:questionId/unlock exists only for server-side
  APP_ENV=LOCAL. Headers, body/query flags cannot enable it elsewhere. Fixed route
  labels and safe selected-field logging exclude submitted and official answers.
- The early app middleware matches POST plus exactly the single-question unlock
  route, with Express-compatible case/optional trailing slash semantics. It sets
  no-store before CORS/JSON parsing, including invalid-ID paths, without changing
  authentication, CORS, parser limits, errors, unrelated methods or API routes.
  The existing router no-store policy remains. Early parser/CORS failures return
  their existing 400/403/413/415 errors and never become successful unlocks.
- Strict IDs/empty query/exact JSON body, nonblank 1-10,000 UTF-16-unit submitted
  answer, preserved accepted whitespace, current eligible STUDENT and all four
  types. Each request freshly reuses full F021 published ancestry and consistent
  question references. Shared IP limit and separate 30/subject unlock budget.
- Distinct qualified aggregation plus explicit five-field id/conceptId/type/answer/
  explanation DTO. Absent explanation becomes null; malformed authored values fail
  closed. Existing seven-field GET is unchanged and answer-free before/after POST.
  No attempts, persistence, execution, grading, scoring or durable unlock claim.
- One bounded memory-only reveal, account/Concept/type/question binding, independent
  cancellation/generation and context/snapshot checks. Draft edits, navigation,
  disposal and valid confirmed clearing invalidate revelation; unrelated drafts,
  capacity/length rules and stale-confirmation protection remain intact.
- One stable native Submit/Retry action retains its DOM identity through pending,
  error and success. Pending uses aria-disabled plus controller duplicate protection;
  blank drafts use native disabled. No automatic focus jump to official content.
  Restricted Markdown, escaped submitted code, accessible feedback and the exact
  unsaved/ungraded disclaimer are present. Real browser behavior is NOT_VERIFIED.

### Executed offline evidence

Evidence directory: .cache/f035-offline-20261018 (local generated logs only).
No browser or database integration test was run. Offline HTTP tests use disposable
loopback test listeners with injected repositories; they do not connect to MongoDB.

| Check | Result / evidence |
| --- | --- |
| Focused API | 27 distinct PASS: practice.test.ts 15 and practice-routes.test.ts 12 |
| Relevant API regression | 44 PASS: Practice model, Concept, authentication/access-token and User contracts |
| Shared HTTP/logging regression | 15 PASS: foundation, logging, auth-routes and login-routes |
| Total API evidence | 86 distinct tests with passing evidence; not a claim that every API test was run |
| Focused frontend | 42 distinct PASS: client 11, controller 21, rendering 10 |
| Remaining frontend regression | 168/168 PASS; excludes those three focused files |
| Total frontend evidence | 210 distinct tests with passing evidence |
| Root build | PASS; final affected web rebuild also PASS after focus correction |
| Root TypeScript | PASS, including prepared MongoDB integration source |
| Root lint / formatting | PASS; final affected files rechecked after focus correction |
| Browser-spec TypeScript | PASS for the new spec, three compatibility specs and existing configuration |
| Scope / encoding / whitespace | Exactly 27 approved paths, UTF-8/LF; read-only git diff --check PASS |

Initial focused failures remain in api-focused.log/web-focused.log and the first
correction logs. They established that the installed Zod maximum counts Unicode
code points, not the approved UTF-16 units; explicit string.length bounds now
apply server/client-side. The astral-character boundary tests pass. One overly
broad new rendering expectation matched instructional prose and was corrected to
check actual solution content. The prepared integration source also received an
explicit unknown-response type refinement for compilation. No integration was
executed. Final passing evidence is retained without counting reruns twice:
api-unit-final.log, api-focused.log (12 route passes), api-regression.log,
api-shared-regression.log, client-final.log, web-focused.log (21 controller passes),
rendering-final.log and web-regression.log. Build/static evidence uses build-final,
web-build-final, typecheck, lint-final, format-final and affected-* logs.

### Separate formal implementation-diff review

Reviewed the final product diff independently of test outcomes: app route matching,
route/middleware/controller/service/repository/DTO flow; unchanged F021 publication,
shared auth eligibility/lifecycle and restricted Markdown boundaries; request/log/
cache/error secrecy; four-type cancellation, drafts and reveal identity; test and
prepared integration/browser changes; configuration scope and documentation.

| Severity | Actual findings and disposition |
| --- | --- |
| CRITICAL | None found |
| HIGH | None found |
| MEDIUM | None found |
| LOW | One resolved focus finding: the separate error-only Retry button was removed at request start, so it could lose focus. Replaced it with the stable primary Submit/Retry control at apps/web/src/components/practice/practice-browser.tsx:211. Native pending focus is preserved structurally with aria-disabled; duplicate requests remain blocked in the controller. Rendering tests pass; mounted focus behavior remains NOT_VERIFIED. |

No unresolved code-review finding or further scope expansion was identified.
This is an offline implementation review, not final feature acceptance or a
production-readiness claim. Passing synthetic mocks cannot establish real MongoDB
aggregation behavior or mounted accessibility/navigation/races.

### Remaining gates and preserved limitations

Prepared apps/api/tests/practice.integration.ts extends four-type qualified answer
reads, per-request publication/reference revalidation, real STUDENT POST behavior,
GET secrecy, unchanged question snapshots and absence of attempt persistence.
It is compilation-checked only. Next gate: separate explicit owner approval for
one guarded disposable MongoDB integration execution using the already documented
owned 27018/f021-test/deeplearner-f021-test isolation/PRIMARY/cleanup procedure.

Prepared exactly seven test declarations in practice-answer-unlock.spec.ts; actual
Playwright discovery/execution is NOT_RUN. F035 mounted coverage remains 7 NOT_RUN;
expected complete regression remains 125 NOT_RUN including those seven. Existing
compatibility specs recognize the approved question-scoped Submit Answer control
and retain execution/grading/unapproved reveal and unrelated security assertions.
No retries, timeouts, fixture guard or browser cleanup infrastructure changed.
No F035 browser exception is approved or inherited. Preserve F022 PID/EPERM and
Windows taskkill risk, F024 lifecycle conflict, F029 intermittent scroll history,
responsive/focus/screen-reader/background-throttling and Windows shutdown gaps.
Do not reopen the stopped prototype or execute primary-host Playwright.

The local transient sequencing deviation remains explicit: no immutable attempt
exists. Nonblank input is not effort/correctness proof; current-at-read content is
not version-locked; observed answers cannot be recalled. F036 must establish durable
owned attempts/final unlock policy before deployment, with no transient fallback
on persistence failure. No F036 implementation, production approval, Git staging,
commit or push occurred. Only the specifically requested read-only diff review and
whitespace check were used. STOP after this gate; keep F035 IN_PROGRESS.

## 12. Authorized MongoDB gate BLOCKED before connection (2026-10-18)

Owner authorized one guarded disposable integration execution. The prepared suite
was NOT_RUN: zero integration invocations, zero assertions executed; all nine
prepared tests (eight children plus parent) remain NOT_RUN. No application or test
defect was established. Offline evidence remains unchanged. F035 is IN_PROGRESS.

Evidence: .cache/f035-integration-2026-10-18-18-17-48-273348.

### Preflight and exact stop

Normal unelevated REDGOLDMARK42\Shreeji / PowerShell 7.6.7 verified. Existing
LocalProcessOwner.cs, Node and MongoDB executable pins matched, as did all 27
approved offline source hashes. Port 27018 was free. Fresh empty GUID-owned local
storage was created, with an ownership receipt naming only 127.0.0.1:27018,
f021-test and deeplearner-f021-test. The unchanged helper atomically started the
disposable mongod in a fresh retained Job with no breakaway.

Before any driver connection, the composite child-identity preflight raised
TEST_PROCESS_OWNERSHIP_UNVERIFIED. That check includes retained-handle/native and
CIM creation-time equality, executable, process-owner, live-child and exact Job
membership checks. Individual observed values were not written before the verdict;
the exact failing subcondition is therefore UNKNOWN. Replica initialization,
writable PRIMARY/empty-target database inspection and fixtures/tests never ran.
Do not relabel this as a database/application failure or claim isolation PASS.

Bounded read-only diagnosis observed a six-tick difference between native StartTime
and CIM CreationDate for the same inspection-shell process: 639279245630472816
versus 639279245630472810. Path visibility and GetOwner succeeded for that shell.
This demonstrates a cross-API precision difference and makes the runner's strict
cross-source timestamp equality a plausible cause; it does not recover the original
MongoDB child's unrecorded observations. Keep original cause INCONCLUSIVE.
The diagnosis did not launch another MongoDB, connect to a database or rerun tests.

### Cleanup outcome, separately from assertions

The graceful-shutdown precondition could not verify a listener and recorded
SHUTDOWN_LISTENER_IDENTITY_UNVERIFIED. No shutdown connection was made. Cleanup
used only the retained owned Job; forced cleanup is explicitly recorded and is
NOT graceful shutdown. Final Job active count 0, port 27018 free, owned storage
removed after absolute-path/receipt/non-reparse checks, and handles released.
Retained MongoDB exit code was not observed and remains UNKNOWN (null in result).
Total procedure duration: 31.66 seconds. No PID-only or unrelated-process cleanup.

Protected MongoDB PID 5144 / parent 1304 / creation UTC
2026-10-17T04:47:47.7735300Z and 127.0.0.1:27017 ownership remained unchanged.
Its protected executable/owner remain UNKNOWN; it was never adopted, queried or
terminated. Persistent demo-storage metadata and baseline development identities
matched before/after. The temporary safety prototype was untouched. No product,
test/configuration, dependency, Git or browser operation occurred in this gate.

### Verification boundary and next approval

Publication/authorization, four-type qualified disclosure, exact five-field DTO,
GET secrecy, nonmutating reads and absent attempts remain NOT_VERIFIED against
MongoDB for F035. LOCAL-only gating, strict validation, no-store, safe errors and
rate limits retain their passing offline evidence; no additional database-backed
claim is made. Seven mounted and expected 125 browser scenarios remain NOT_RUN;
no exception is approved or inherited.

Propose a narrowly scoped in-memory runner correction: record each identity
observation before its verdict, and explicitly reconcile documented CIM timestamp
precision with the retained native creation identity. Preserve retained handles,
exact Job membership, executable/owner checks and fail-closed handling; never use a
broad tolerance or PID equality as ownership. Review the correction before one
separately owner-authorized fresh attempt. No correction or rerun is performed
here. Final-review readiness remains BLOCKED pending integration verification.

## 13. Approved timestamp correction and guarded MongoDB PASS (2026-10-18)

**MongoDB integration 9/9 PASS (eight children plus parent), one invocation,
zero retries. F035 remains IN_PROGRESS pending separately approved final review.**
Owner authorized only the temporary in-memory runner correction and one fresh
owned integration execution. Application, assertions, fixtures, models, repository
helper and configuration were not changed; no offline/browser tests were repeated.

Evidence: .cache/f035-integration-corrected-2026-10-18-18-38-34-c8508e.
Preserve Section 12's blocked attempt and its UNKNOWN original subcondition,
forced cleanup and unobserved exit code. A separately authorized diagnostic at
.cache/f035-ownership-diagnostic-2026-10-18-18-29-52-85aa4b started one owned MongoDB,
made no client connection and ran no integration tests. That diagnostic recorded
six identity checks PASS and exactly CREATION_TIME_EXACT_RAW_EQUALITY FAIL: PID
4328, both native handles 2026-10-18T13:00:04.6719414Z versus CIM
2026-10-18T13:00:04.6719410Z (four ticks). Its forced owned-Job cleanup passed,
MongoDB exit 1 observed, baselines unchanged, duration 26.34s. This confirmed the
representation mismatch in that diagnostic without inventing missing raw values
for the original blocked attempt.

### Exact approved precision correction and identity evidence

For the native/CIM comparison only, convert both creation values to UTC ticks,
then use integer (ticks / 10L) * 10L identically on both sources. One microsecond
is ten 100-nanosecond ticks. This is a common precision, not rounding to nearest,
floating-point conversion, asymmetric rounding or an arbitrary tolerance window.
The raw source DateTime representations, kinds, UTC ticks, native FILETIME,
normalized values and per-check verdicts are retained before the combined verdict.

Current owned PID 17964:

| Observation | Exact retained value |
| --- | --- |
| Native original-handle and inspection-handle UTC | 2026-10-18T13:08:45.0316122Z |
| Native raw local DateTime | 2026-10-18T18:38:45.0316122+05:30 |
| Native UTC ticks | 639279257250316122 |
| Original native FILETIME | 134368025250316122 |
| CIM raw local DateTime | 2026-10-18T18:38:45.0316120+05:30 |
| CIM UTC ticks | 639279257250316120 |
| Both normalized UTC ticks | 639279257250316120 (2026-10-18T13:08:45.0316120Z) |

Exact native-to-native handle creation identity remains compared at full
100-nanosecond precision, together with PID/retained handles, pinned executable,
parent identity, owner, exact fresh Job membership and original-handle live state.
All seven independent checks PASS, zero FAIL/UNKNOWN; combined ownership PASS.
Missing/conflicting identity evidence still blocks before database access.
PowerShell parsing and the in-memory read-only native/integer helper compilation
passed before execution. LocalProcessOwner.cs remained unchanged.

### Fresh isolation and execution

Ordinary unelevated REDGOLDMARK42\Shreeji / PowerShell 7.6.7 verified; existing
helper/Node/MongoDB pins and all 27 approved source hashes matched before launch.
Fresh empty GUID-owned temporary storage, non-reparse boundaries, an ownership
receipt and a fresh atomic no-breakaway Job were established. Port 27018 was free;
the eventual 127.0.0.1:27018 listener matched the owned retained MongoDB identity.
Only that process received the f021-test/dbpath arguments.

No inherited NODE_OPTIONS, application .env credentials, Atlas/SRV hosts or demo
DB selection enters the explicit child environment. The bootstrap uses only
literal loopback/direct connection, verifies exact bind/port/owned storage/replica,
initializes the single-member f021-test replica, waits bounded writable PRIMARY,
then enumerates databases and verifies deeplearner-f021-test has no collections.
Initialization recorded PRIMARY=true, empty=true, zero other application DBs and
127.0.0.1:27018 as the sole configured replica member. No pre-PRIMARY enumeration.

Exactly one prepared invocation:

    node --import tsx --test --test-concurrency=1 apps/api/tests/practice.integration.ts

Result: 9 PASS / 0 FAIL / 0 CANCELLED / 0 SKIPPED. Suite duration 20.914s;
parent/fixture test duration 10.185s. Complete procedure including safety/cleanup
45.17s. No automatic retry, assertion change or code correction was made.

### Actual verification and retained offline boundaries

Real MongoDB checks passed for all four canonical types and existing ordered
pagination/GET compatibility; qualified five-field answer/explanation projection;
GET answer secrecy; fresh unpublished question rejection; all five ancestors'
publication and denormalized reference consistency; mismatched question references;
sanitized malformed eligible data; signed Student HTTP retrieval/unlock, missing
authentication rejection and current-account non-STUDENT/suspended/unverified
rejection; no-store on successful unlock; unchanged stored-question snapshots and
no practiceAttempts collection introduced. No authored code, grading or scoring
operation exists in the executed path. The temporary submit-to-reveal semantics
do not create an immutable attempt or satisfy F036 persistence obligations.

LOCAL-only unavailability outside LOCAL, strict IDs/nonblank/10,000-unit body
validation, parser/CORS/error no-store, safe error details/logging and dedicated
rate-limit negatives retain the earlier 86-test offline evidence. The prepared
MongoDB suite did not separately inject every one of those HTTP negatives or run
outside LOCAL. Do not misrepresent retained offline checks as new database-backed
assertions. The live suite supplements that evidence without repeating it.

### Cleanup and protected baselines

Test connections/server closed in the prepared suite's finally paths. Only the
verified test-owned collections were dropped; shutdown independently confirmed
zero target collections remaining and exact owned storage/bind/port/replica before
requesting graceful shutdown. Initializer/test/shutdown-helper/MongoDB exits:
0/0/0/0. Graceful shutdown PASS; forced termination false; cleanup errors empty.
Retained native identity was rechecked before shutdown. Job active count 0,
port 27018 released, retained handles released, and only receipt-verified GUID
storage was removed after absolute-boundary/non-reparse checks.

Protected MongoDB PID 5144 / creation UTC 2026-10-17T04:47:47.7735300Z and
127.0.0.1:27017 ownership remained unchanged. Its inaccessible executable/owner
remain UNKNOWN; it was never queried, adopted or terminated. Persistent
local-demo storage metadata and all baseline development identities were unchanged.
All 27 source pins and the helper were unchanged through execution/cleanup.
This evidence update is the only repository change in the current gate; roadmap
and all F001-F034 statuses remain untouched. No Git operations occurred.

No application/test/database-contract defect was identified. Offline API 86 and
frontend 210 distinct PASS plus prior static/security review remain retained.
F035 is ready for a separately owner-approved local-development final-review gate,
not automatically READY_FOR_REVIEW or APPROVED_COMPLETE. Seven mounted F035 and
expected full 125 browser scenarios remain NOT_RUN; primary-host browser execution
is still prohibited and no prior exception transfers. A named F035 browser
exception or separately approved ownership-safe execution is required for that
acceptance decision. Preserve F022/F024/F029 and Windows/accessibility gaps,
local-only transient disclosure, and F036 durable-attempt requirements before
any separately approved production-release decision. No F036 work was performed.

## 14. Final security review and F035 browser exception (2026-10-18)

**FINAL REVIEW PASS WITH F035 BROWSER EXCEPTION. Status: READY_FOR_REVIEW.**
The owner explicitly authorized a ONE-TIME, F035-specific browser-verification
exception for LOCAL DEVELOPMENT ONLY and this conditional final security review.
This section records the current decision; earlier planning, blocked-gate and
pending-approval statements in Sections 1-13 remain historical evidence. The
exception is not inherited from another feature, does not transfer to future
features, and does not approve completion, Internet deployment or production use.
No security, API, database or offline check is waived.

### Evidence, scope and review method

Retained API evidence: **86 distinct tests PASS**; frontend: **210 distinct tests
PASS**; disposable MongoDB integration: **9/9 PASS**, including the parent.
Build, lint, TypeScript, formatting, browser-spec static compilation and scope/
security/encoding checks retain their passing evidence. These are reconciled
distinct passing results, not a claim of one uninterrupted combined test run.
Section 11 preserves initial offline failures, their corrections and the resolved
Low focus finding. Sections 12-13 preserve the blocked MongoDB attempt, separate
ownership diagnostic, authorized common-precision timestamp correction, forced
cleanup history/UNKNOWN observations, and the successful fresh execution with
graceful shutdown, no forced termination and unchanged protected baselines.

Final review reinspected the retained implementation changes and current source,
including unchanged authentication, publication, error/logging, hook and Markdown
boundaries. No Git operation or test, database, browser or synthetic execution
was performed in this gate. Source SHA-256 comparison against the retained
preimplementation inventory confirms **exactly the Section 5 approved 27 paths**,
with no deleted or unrelated paths. All 26 pins other than this feature document
match both the final offline source hashes and the successful integration source
pins; this document differs only through the subsequent authorized evidence gates.
Only this feature document and the roadmap are updated for the current review.

### Final security and acceptance assessment

References below identify reviewed code, not findings. Current review found no
unresolved Critical, High, Medium or Low issue within the approved local contract.

| Boundary | Assessment and reviewed source |
| --- | --- |
| LOCAL-only canonical route | PASS: server configuration conditionally registers POST /api/v1/practice-questions/:questionId/unlock only for APP_ENV=LOCAL; client flags cannot enable it. Non-LOCAL registration is absent. practice.routes.ts:38-58 and retained route tests. This is the approved local-environment restriction, not approval to expose a LOCAL-configured server to the Internet. |
| STUDENT authentication and eligibility | PASS: existing signed bearer authentication precedes unlock; the service checks both token role and freshly loaded account identity, STUDENT role, ACTIVE status and verification before answer lookup. practice.routes.ts:42-44; practice.service.ts:13-41. |
| Validation and repeated requests | PASS: strict normalized ObjectIds, empty query and exact JSON body; nonblank answer and explicit 10,000 UTF-16-unit bound without trimming accepted formatting. Existing 256kb parser bounds the payload. Shared 300/IP and dedicated 30/subject per 15 minutes apply; every accepted repeat reauthorizes/revalidates and creates no durable receipt. practice.schema.ts:29-43; app.ts:103; practice-rate-limit.ts:5-9,37-41. |
| Fresh publication and references | PASS: each lookup freshly reuses F021's published Concept, Topic, Module, Learning Path and Technology chain and carried-reference comparisons, then PUBLISHED/schemaVersion-1 question/type and Concept/Topic/Technology consistency. practice.repository.ts:23-36,84-118; concept.repository.ts:62-132. Missing, hidden or inconsistent content cannot return an answer. |
| Answer secrecy and exact DTOs | PASS: GET still projects and reconstructs exactly seven answer-free fields. Qualified POST explicitly reconstructs exactly id, conceptId, type, answer and explanation, independently of Mongoose select; malformed eligible data fails closed with sanitized errors. practice.repository.ts:38-82,122-139; practice.dto.ts:28-39,42-68. |
| Cache, error and logging secrecy | PASS: exact single-segment unlock POST matching sets no-store before CORS/JSON parsing, including applicable early failures; router policy remains. Unrelated route behavior is preserved. app.ts:73-103; practice.routes.ts:33-36. Existing validation/error handlers return safe static errors and selected-field logging excludes submitted answers, correct answers and raw bodies. middleware/validate.ts:36-79; error-handler.ts:17-62; request-logger.ts:13-27. Retained tests cover early CORS/parser errors, logs and errors, not merely successful responses. |
| Four types and frontend secrecy | PASS: OUTPUT default and OUTPUT/DESCRIPTIVE/SCENARIO/CODING retrieval remain compatible. Unlock response parsing is strict and checks question/Concept/type identity. POST uses no-store, bearer auth, omitted cookies and redirect rejection, with no automatic resubmission. practice-client.ts:28-86,128-163; contracts.ts:58-81. |
| Memory isolation, cancellation and races | PASS at source/offline level: a single bounded reveal is scoped to the mounted account/Concept and question/type, plus submitted snapshot/content fingerprint. Independent cancellation/generation checks suppress obsolete success and error; draft edits, navigation, confirmed scope clearing and disposal invalidate reveal. No reveal is written to browser/server persistence. practice-controller.ts:141-227,229-337; practice-browser.tsx:14-31,137-140; use-practice.ts:9-27; auth-controller.ts:267-307. Real-browser races remain NOT_VERIFIED. |
| Safe display and excluded behavior | PASS at source/offline level: restricted Markdown for official text, escaped submitted text and inert starterCode; stable native Submit/Retry and accessible feedback with the exact unsaved/ungraded disclaimer. practice-browser.tsx:158-263; concept-markdown.tsx:25-87. No code execution, grading, scoring, immutable attempt, progress write or reusable unlock token is added. Shared draft capacity/length and confirmed scope-limited clearing remain intact. Mounted layout/focus/rendering remain NOT_VERIFIED. |

| Severity | Final review findings |
| --- | --- |
| CRITICAL | None found |
| HIGH | None found |
| MEDIUM | None found |
| LOW | None unresolved; the earlier stable Submit/Retry focus correction at practice-browser.tsx:211 remains recorded in Section 11, not a new finding. |

### Exact owner-approved browser exception and accepted risks

- **F035 mounted browser acceptance: 7 NOT_RUN.** Seven prepared declarations are
  static-checked only; runtime discovery/execution and mounted smoke are NOT_RUN.
- **Expected complete browser regression: 125 NOT_RUN, INCLUDING the seven F035
  cases.** Do not add those seven again or report a browser/full-regression PASS.
- Primary-host Playwright remains prohibited because ownership-safe Windows
  termination has not been established. The stopped temporary safety prototype
  is not a verified Playwright solution and is not modified, executed or deleted.
- The owner explicitly accepts, for LOCAL development only, unverified real-browser
  Submit/Retry interactions, correct-answer/explanation rendering, keyboard/focus
  accessibility, cancellation and identity-change races, cross-account/question
  reveal isolation, responsiveness and compatibility with earlier Practice,
  shared authentication and Concept-publication behavior. Offline safeguards
  reduce these risks but do not prove mounted behavior.
- Preserve F022 historical EPERM/inconclusive process probing and taskkill/PID-reuse
  risk, F024 cross-suite worker/browser lifecycle conflict, F029 intermittent
  ArrowDown failure and independent recovery, incomplete earlier regression
  evidence, and screen-reader/background-throttling/Windows shutdown gaps. No
  historical failure or NOT_RUN result is rewritten. Manual checks are supplemental
  only; no new manual browser verification is claimed.

Future browser verification requires separate ownership-safe execution approval,
actual discovery/count reconciliation, the seven mounted cases and all expected
125 distinct regression scenarios, segmented around the existing F024 conflict.
Preserve existing assertions/timeouts, zero retries, the 25-minute browser budget
and five-minute initial failure diagnosis; do not automatically rerun failures.
No Playwright infrastructure investigation is restarted by this review.

### F036 and completion/release boundaries

F035 is a **temporary nonpersistent submit-to-reveal workflow**. Accepting a
nonblank answer is request-scoped qualification, not an immutable recorded attempt
or proof of correctness/effort. Submitted/revealed answers have no persistence;
already observed answers cannot be recalled and content is not version-locked.
**F036 must implement durable, owned immutable attempts and enforce the approved
final answer-unlock prerequisite before Internet deployment.** Failed persistence
must never fall back to transient disclosure; F035 requests cannot retroactively
be treated as saved attempts. The PRD and final database algorithm remain binding.

All approved local-development acceptance criteria pass with the explicit named
browser exception under AGENTS.md. F035 is READY_FOR_REVIEW, not APPROVED_COMPLETE.
Next gate: separate owner completion approval and, if requested, scoped Git
delivery. Production needs a separately approved browser-regression and release-
readiness decision plus the F036 prerequisite; this exception satisfies neither.
F001-F034 remain APPROVED_COMPLETE; F036 remains NOT_STARTED. STOP after review.

## 15. Owner completion approval and scoped Git delivery (2026-10-18)

The owner explicitly approves F035 as **APPROVED_COMPLETE for LOCAL DEVELOPMENT
ONLY**, following FINAL REVIEW PASS WITH F035 BROWSER EXCEPTION. The owner also
authorizes the exact Section 5 twenty-seven-file commit and safe push to origin/dev
with message: feat(practice): complete F035 answer unlock flow. Git delivery must
pass branch/origin, fresh remote-divergence, exact staged inventory, complete staged
diff, encoding, whitespace and sensitive-artifact checks; no force push or rebase.
This records authorization, not an unverified claim that delivery has occurred.

All prior evidence and limitations remain: API 86 distinct PASS, frontend 210
distinct PASS, MongoDB 9/9 PASS, build/lint/TypeScript/formatting/security PASS,
and no unresolved Critical/High/Medium/Low review finding. The earlier MongoDB
ownership blockers, separate diagnostic, approved timestamp precision correction
and successful fresh guarded integration with graceful cleanup remain in
Sections 12-13. No tests or browser/database operations are repeated for delivery.

**F035 mounted scenarios: 7 NOT_RUN. Expected complete regression: 125 NOT_RUN,
including those seven.** The named, one-time local browser exception and all
accepted real-browser rendering, accessibility, identity/race and compatibility
risks remain unchanged. There is no browser PASS, complete regression acceptance
or production readiness. Preserve F022/F024/F029 and Windows testing limitations;
primary-host Playwright remains prohibited without separate ownership-safe approval.

The unlock endpoint remains server-enforced LOCAL-only. This temporary
nonpersistent submit-to-reveal creates no immutable practice attempt, grading,
score, code execution or progress persistence. **F036 must establish durable
immutable owned attempts and the final answer-unlock prerequisite before
deployment**, without transient disclosure on persistence failure. Separate
browser-regression and production release-readiness approval remain required.
F001-F034 remain APPROVED_COMPLETE; F036 remains NOT_STARTED. No F036 implementation
or deployment is authorized. Stop after the approved scoped Git delivery.

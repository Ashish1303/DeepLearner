# F032 - Descriptive Questions

**Status:** APPROVED_COMPLETE
**Plan date:** 2026-10-18

**Current acceptance (2026-10-18):** APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY, following FINAL REVIEW PASS WITH F032 BROWSER EXCEPTION and explicit owner completion approval. See Sections 10-11. Browser cases remain NOT_RUN; no production approval.
**Implementation authorization (2026-10-18):** Owner approved the exact 19-file scope and offline verification, with explicit confirmation before clearing all drafts. Database/browser gates remain separate.

**Historical planning authorization:** Owner approved this document only, the proposed
19-file implementation boundary, and retention of drafts across question-type
switches. Implementation, database execution and browser execution require
separate approvals. F001-F031 remain APPROVED_COMPLETE; no F033 work is authorized.

## 1. Authority and smallest useful increment

Sources reviewed: AGENTS.md; DEVELOPMENT_ROADMAP.md; PRD sections 23/24;
SYSTEM_ARCHITECTURE.md layering; DATABASE_DESIGN.md practiceQuestions and F030
refinement; API_DESIGN.md F031 retrieval; completed F021, F030 and F031 contracts;
the existing practice schema, DTO, repository, service/controller, client,
controller/hook, rendering tests and browser configuration. The Concept-learning
Stitch screen.png and code.html were inspected as design references.

The roadmap names F032 **Descriptive Questions**, without additional detailed
requirements or explicit dependencies. This plan's prerequisites are F030's
canonical question model and F031's authenticated Practice experience, including
F021's shared publication pipeline and existing Student authentication/shell.

Extend that experience to display published DESCRIPTIVE questions and accept
local free-text drafts alongside OUTPUT. This is not the full PRD answer flow:
submission, unlocking and official-answer comparison remain deferred. No separate
Practice API, page, model, renderer or authentication implementation is needed.
Admin authoring and publishing are outside this increment.

Owner-approved behavior below supersedes the earlier planning suggestion to
discard drafts on a type change. Details originally marked **PROPOSED** were accepted by the implementation
approval, except that Clear all additionally requires confirmation. They are not
claims about earlier feature contracts.

## 2. HTTP contract

`GET /api/v1/practice-questions?conceptId=<24-hex>&type=DESCRIPTIVE&page=1&limit=10`

### Request validation and compatibility

- Add only optional `type`, accepting exactly `OUTPUT` or `DESCRIPTIVE`.
  Missing type defaults to OUTPUT. Explicit empty, null-like strings, lowercase,
  whitespace, arrays, duplicate keys, objects, CODING and SCENARIO are invalid.
  No coercion, aliases, mixed-type request or inferred fallback.
- Preserve required exact 24-hex conceptId and lowercase normalization, strict
  unknown-key rejection, empty params and GET-body rejection.
- Preserve positive decimal page default 1, limit default 10/max 20, safe-integer
  bounds and safe skip calculation. Preserve `_id ASC` sorting.
- Existing no-type requests retain their OUTPUT semantics and seven-field shape.
  Existing routes, controller/service layering, security middleware and rate
  limiters are reused unchanged. No versioned endpoint replacement.

### Authorization, publication and database reads

Require both token and current-user STUDENT eligibility, ACTIVE status and
verified email through F031. ADMIN is not a preview role. Preserve FREE/PREMIUM
parity, bearer authentication, no-store, CORS and existing error handling.
Retain 300/IP and 120/subject requests per 15 minutes; changing types must not
create independent limiter buckets or additional automatic requests.

Reuse `publishedConceptStages` without editing it. All five levels must be
PUBLISHED: Concept -> Topic -> Module -> LearningPath -> Technology. Preserve
all F021 denormalized-reference checks. Within the eligible Concept aggregation,
filter questions by requested canonical type, PUBLISHED, schemaVersion 1 and
matching Concept/Topic/Technology references before counting/pagination.

Use the same aggregation projection and explicit DTO construction. Check that
projected items match the requested Concept and type; reject malformed eligible
content through the existing sanitized dependency error. Hidden/mismatched
questions are excluded; hidden/inconsistent ancestry makes the parent unavailable.
No unfiltered count, fallback OUTPUT result or answer fetch is permitted.

No model/index changes, migrations, auto-index creation, record repair or demo
updates. F030 already supports DESCRIPTIVE, optional inert code for every type,
nullable code/language and the canonical difficulty/lifecycle rules. References
remain identifier metadata in the model; the read pipeline enforces publication
visibility, not authoring permission or Admin provenance.

### Response and errors

Preserve `{success:true,data:[...],message:null,meta:{requestId,page,limit,total,totalPages}}`.
Each item contains exactly:

| Field | Contract |
| --- | --- |
| id | Lowercase ObjectId string |
| conceptId | Requested Concept's lowercase ObjectId string |
| type | OUTPUT or DESCRIPTIVE, equal to requested type |
| difficulty | BEGINNER / INTERMEDIATE / ADVANCED / INTERVIEW_READY |
| prompt | Trimmed nonblank Markdown, 1-50,000 UTF-16 code units |
| starterCode | Nonblank inert text, 1-50,000 code units with whitespace preserved, or null |
| language | JAVASCRIPT / TYPESCRIPT / null; supported language required with code |

Absent code/language normalize to null only in the DTO. Language without code
remains valid. No answer, explanation, evaluation, provenance, status, timestamps,
version fields, joined records or new metadata. Mongoose select is not authorization.

Preserve existing empty/out-of-range 200 responses and type-filtered totals.
Errors remain 400 VALIDATION_ERROR, existing token 401s and account/role 403s,
404 USER_NOT_FOUND or CONCEPT_NOT_FOUND, 429 RATE_LIMIT_EXCEEDED and sanitized
503 DEPENDENCY_UNAVAILABLE. No new error code or ancestry disclosure. The client
retains its existing safe error mapping rather than requiring shared error changes.

## 3. Frontend and draft lifecycle

Keep `/concepts/[conceptId]/practice`, its page wrapper, AuthBoundary and Student
shell. Retain the existing Concept link to OUTPUT as the default landing view.
Descriptive access is through controls on that same Practice page; no additional
Concept read, route parameter, URL state, deep link or separate page is proposed.

### Controller design

**PROPOSED:** one controller per eligible account/Concept, with current type in
its snapshot and a `selectType(type)` operation. Initial type is OUTPUT. Keep the
controller mounted across type changes; do not key/remount it by type or call
the destructive `cancel()` operation merely to switch types.

On a different valid type: synchronously abort superseded work, invalidate its
generation, clear visible old results/error/notice, set type and page 1, and start
exactly one requested-type read. Same-type selection is a no-op (Retry remains
explicit). Capture Concept/type/page and generation before awaiting; stale success
and stale error must not update either visible results or retained drafts. A fast
OUTPUT -> DESCRIPTIVE -> OUTPUT sequence cannot revive the first OUTPUT response.

The current UI lists all page questions; it has no separate active-question
selection. Resetting means displaying page 1's new list, with no carried focused
question or added selection model. Previous/Next/Retry operate on current type.
Do not show the former type's cards while the replacement is loading.

Keep `runAuthenticatedRead` and the existing token-generation guards unchanged.
The fixed-endpoint client validates requested type before fetching and verifies
every response item's type as well as Concept/page/limit, ordering and totals.
**PROPOSED:** append a defaulted OUTPUT type argument to the existing client
method to preserve old call sites; keep the no-type OUTPUT URL compatible and
send `type=DESCRIPTIVE` explicitly for descriptive reads. Both explicit OUTPUT
and omitted type remain covered by API tests. No token/draft query parameters.
Retain credentials omit, redirect error, no-store and the existing request deadline.

### Retention, capacity and isolation

- Logical key: authenticated account + Concept + canonical type + question ID.
  Account/Concept ownership remains instance-local. **PROPOSED:** use private
  per-type draft/fingerprint stores, exposing only the active type's ID-keyed
  drafts to the view. This preserves existing view patterns without a global store.
- Preserve drafts across type switching, pagination and explicit Retry while
  that account/Concept page remains mounted. Identical question IDs in different
  type namespaces must never share a draft.
- Preserve the existing **100 nonempty drafts total per page instance**, combined
  across both types, not 100 per type. Each draft remains at most **10,000 UTF-16
  code units**, whitespace preserved. Remove empty entries; reject a new entry at
  capacity with an accessible notice, without silently evicting retained drafts.
- Per-question Clear affects only its current type/question. **PROPOSED:** existing
  Clear all drafts clears both type stores and fingerprints, with explanatory text
  stating that it covers both types. This keeps the existing page-wide meaning.
  Owner implementation approval additionally requires inline confirmation: the
  first action opens a labelled confirmation group; Confirm clear all drafts
  deletes, Keep drafts cancels. Both restore focus to Clear all drafts. A pending
  confirmation has an instance-local sequence identity and is invalidated by
  edits, replacement requests, type changes and disposal; null/stale confirmation
  cannot authorize deletion. No deletion occurs merely on opening the prompt.
- Reload, unmount/navigation away, logout, pending/ineligible authentication,
  account change or Concept change discards both stores and invalidates requests.
  Returning to a former identity must not restore its discarded memory.
- Preserve content-fingerprint invalidation: when a returned question's prompt,
  code or language changes, clear that type/question draft and announce it.
  An absent question's retained draft is never attached to a different item.
- No storage APIs, cookies, server writes, broadcasts, submission, grading or
  correctness comparison. Draft text never enters a request or log.

## 4. Presentation and accessibility

**PROPOSED:** a labelled Question type group of native `type="button"` controls,
Output and Descriptive, using `aria-pressed` and visible current-type text.
Use ordinary Tab/Enter/Space operation, not custom tabs/radio arrow semantics.
Controls remain mounted and operable during loading so switching can cancel work.
Preserve focus on the activated type control when the new list completes; do not
reuse initial/pagination heading-focus increments for a type switch. Retain F031
heading focus on initial load, explicit pagination and Retry. No focus stealing
while drafting, global arrow handlers or positive tabIndex.

Preserve OUTPUT's existing heading, region, textarea and loading labels for F031
compatibility. DESCRIPTIVE uses Descriptive practice, Descriptive questions and
Your descriptive answer for Question N. Use concise polite loading/page status,
scoped application alerts, type-specific empty messages and the existing draft-only
disclaimer. Never imply that hidden questions exist or that drafts are submitted.

Reuse ConceptMarkdown with headingBase 3, escaped React code and draft text,
safe links, blocked HTML/images and contained focusable code regions. Preserve
nullable code/language rules, full formatting and explicit non-execution wording.
Reuse existing CSS Module button targets, focus outlines, card/textarea styles and
wrapping `.controls` container for the selector. No CSS or design-system changes
are currently needed. Stitch's illustrative radio quiz, scoring and XP do not
override the approved free-text draft scope.

Verify 1280x900, 768x900 and 390x900: readable labels, visible focus, 44px button
targets, wrapping controls, no document overflow and keyboard access to genuinely
overflowing code. Do not demand scrolling when content fits. Automated accessible
names/status assertions do not establish exhaustive real-screen-reader support.

## 5. Exact implementation inventory and touchpoint review

The planning gate created only this document. The approved implementation scope
is two creates and seventeen modifications (19 paths), with no new dependencies.

| # | Operation | Exact path | Intended responsibility |
| --- | --- | --- | --- |
| 1 | Create (this gate) | docs/features/F032-descriptive-questions.md | Contract, scope, acceptance and evidence |
| 2 | Create | tests/browser/practice-descriptive.spec.ts | Mounted descriptive/type-switch acceptance |
| 3 | Modify | docs/DEVELOPMENT_ROADMAP.md | Future approved status/evidence updates |
| 4 | Modify | docs/API_DESIGN.md | Document optional type and unchanged security/envelope |
| 5 | Modify | apps/api/src/modules/practice/practice.schema.ts | Strict type query/default |
| 6 | Modify | apps/api/src/modules/practice/practice.dto.ts | Two allowed response types; explicit seven-field construction |
| 7 | Modify | apps/api/src/modules/practice/practice.repository.ts | Requested-type filter/count and result identity checks |
| 8 | Modify | apps/api/tests/practice.test.ts | Query, pipeline, DTO and service compatibility |
| 9 | Modify | apps/api/tests/practice-routes.test.ts | HTTP/auth/rate-limit/body/default compatibility |
| 10 | Modify | apps/api/tests/practice.integration.ts | Disposable real publication/projection reads |
| 11 | Modify | apps/web/src/lib/practice/contracts.ts | Strict two-type DTO/envelope contract |
| 12 | Modify | apps/web/src/lib/api/practice-client.ts | Typed request and response identity |
| 13 | Modify | apps/web/src/lib/practice/practice-controller.ts | Type state, cancellation and retained isolated drafts |
| 14 | Modify | apps/web/src/hooks/use-practice.ts | Preserve account/Concept lifetime; document type-switch versus disposal semantics |
| 15 | Modify | apps/web/src/components/practice/practice-browser.tsx | Selector, type-aware copy, textarea and focus behavior |
| 16 | Modify | apps/web/tests/practice-client.test.ts | Request/default/malformed/wrong-type/cancellation checks |
| 17 | Modify | apps/web/tests/practice-controller.test.ts | Type races, retention, shared capacity and identity resets |
| 18 | Modify | apps/web/tests/practice-rendering.test.ts | Both modes, states, accessibility and inert rendering |
| 19 | Modify | playwright.f024.config.ts | Add only new spec discovery; retain server/timeouts/security |

The service/controller/routes already pass the validated query through and need
no change. Auth and shared Concept publication helpers are reused unchanged.
The model, DATABASE_DESIGN, page wrapper, Concept link, CSS and existing OUTPUT
browser spec need no edit. The hook already owns a stable controller; its proposed
touchpoint is lifecycle clarity, not another state machine or type-keyed remount.
Do not manufacture a functional hook change solely to consume the inventory.

No missing required path is presently identified. If compatibility requires an
existing browser assertion change, CSS adjustment, shared-auth/publication change
or any other file, stop and request scope approval before editing it. Existing
tests must not be weakened to accommodate this plan.

## 6. Acceptance and verification gates

### Focused offline implementation gate (separate approval)

1. Missing/explicit OUTPUT compatibility; valid DESCRIPTIVE; rejection of unknown,
   repeated, padded, coerced, empty and unsupported type inputs; unchanged GET-body,
   identifier and pagination validation.
2. STUDENT/current-account authorization, rate limits and existing error envelopes
   for both types. No public fallback or Admin preview.
3. Requested type and PUBLISHED/schemaVersion filtering, all five ancestors and
   consistent references, stable pagination/type-filtered totals; malformed DTO
   handling and exactly seven fields with no secrets even if raw records contain them.
4. Strict client Concept/type/page/envelope validation, safe authenticated requests,
   abort handling, no hidden automatic retry or extra catalog/answer requests.
5. OUTPUT/DESCRIPTIVE round trips retain distinct drafts, reset page 1, tolerate
   delayed successes/errors and same-type no-ops, preserve pagination/Retry drafts,
   reject a 101st draft across types and preserve 10,000-unit bounds. Exercise
   per-question/all clearing, fingerprints and identical IDs in different types.
6. Logout, pending auth, account/Concept change and disposal clear both stores;
   old callbacks cannot alter drafts or current state. No persistent storage/writes.
7. Both modes' rendering, labels, pressed state, scoped alerts, empty/loading/error
   states, Markdown attacks, inert code and forbidden submission/unlock/XP controls.

Reuse existing Node test infrastructure and relevant API/web regressions, including
shared auth and Concept publication compatibility tests. Run build, lint, typecheck,
formatting and scope/security review. No new testing utilities/dependencies or
repeated passing suites absent a concrete changed requirement.

### Disposable MongoDB gate (separate approval)

Extend the existing practice integration file, not a new harness. Verify mixed
OUTPUT/DESCRIPTIVE fixtures, unpublished/other-type exclusions, each ancestry
failure, reference inconsistency, requested-type pagination/counts, safe HTTP
projection and no mutation from reads. Preserve authentication/query/body checks.
Use fresh owned loopback storage and the existing test replica/database procedure;
confirm writable PRIMARY before database emptiness checks and fixture creation.
Never target Atlas, port 27017, deeplearner-local-demo or persistent data. Run once,
close connections, remove only owned disposable resources and verify port cleanup.

### Browser safety prerequisite and acceptance gate (separate approval)

**Do not execute Playwright on the primary Windows host until an ownership-safe
execution or containment procedure is separately approved.** Built-in Windows
taskkill PID reuse is not proven safe merely by wrapping a launcher in a Job.
This feature does not repair teardown or authorize a VM/install/infrastructure
change. Owner must choose separately reviewed teardown remediation or an approved
disposable containment environment before execution. Unknown ownership is a stop.

Reuse production-built configurations and mocked loopback APIs; preserve fixture
isolation, test timeouts and assertions. New descriptive scenarios should cover
1280/768/390 widths, default OUTPUT and type switching, draft round trips across
pagination, shared cap, stale responses/errors, account/Concept/logout isolation,
strict wrong-type/secret-bearing DTO rejection, safe Markdown/code, states, native
keyboard/focus and absence of writes. Discover actual counts before execution;
do not invent a passing count during planning.

Final acceptance requires complete bounded **segmented** regression with the new
suite and all existing 97 scenarios, including the 56 left NOT_RUN under F031.
Keep F024 in a separate invocation from affected worker-sharing suites; independent
spec invocations are preferred. Reuse existing successful evidence for unchanged
offline requirements, but F031's incomplete browser exception does not satisfy
F032's complete compatibility gate. No claim of a clean combined-run PASS.

Zero automatic retries; maximum combined browser execution 25 minutes and initial
failure diagnosis five minutes. Preserve evidence under .cache; stop on failure,
unsafe cleanup or exhausted budget, reporting PASS/FAIL/NOT_RUN. No automatic
fix/rerun. Track identities/ownership before any termination, verify owned jobs
empty and ports released, and report forced Windows shutdown separately. Do not
touch protected baseline processes or infer ownership from PID equality alone.

## 7. Historical evidence, exclusions and approval decisions

F031 is APPROVED_COMPLETE for local-development acceptance with a one-time
exception: API 75/75, web 181/181, MongoDB 5/5 and F031 14/14 distinct browser
scenarios with passing evidence. Its full regression remains **40 PASS / 1 FAIL /
56 NOT_RUN**, not PASS. The recovered F031 locator failure and F022 afterAll EPERM
failure remain historical evidence; F022 functional assertions passed but its
suite failed. Do not infer that incomplete shared-auth/publication compatibility
has been verified merely because those implementations are reused.

Retain F022 ownership/PID-reuse and historical inconclusive EPERM risks, F024
shared-worker browser closure, F029 intermittent ArrowDown failure with independent
recovery and inconclusive cause, Windows graceful-shutdown limitations, and
screen-reader/background-throttling gaps. F029 recurrence requires bounded evidence
and separate correction approval, not assumption of a harmless flake.

Excluded: F033/F034 types in retrieval/UI, new authored content, Admin workflows,
answer or explanation disclosure, submissions, unlocking, attempts, scoring,
progress, evaluation, execution, persistence, new endpoints, schema/index changes,
dependencies, deployment and infrastructure remediation.

**Plan readiness:** Owner approved implementation; F032 is IN_PROGRESS.
No architectural or scope conflict is currently identified. The owner approved the detailed
controller/UI choices and local-only type selection. Clear all now requires an inline confirmation scoped to the current account/Concept. Cancel, request replacement, type switch and identity disposal invalidate pending confirmation. Browser safety method,
MongoDB execution and browser execution remain distinct future approval gates.
No F031 exception is inherited or granted here. Implementation is limited to Section 5; no live verification is authorized.

## 8. Implementation and offline evidence (2026-10-18)

**Implementation/offline result: PASS. Status remains IN_PROGRESS.**

- Exactly the 19 approved paths changed, verified by pre/post filesystem hashes
  without Git operations. No deleted files or unrelated source changes. The
  inventory's plan existed before implementation; this gate modified 18 existing
  files and created the one new descriptive browser specification.
- Focused API practice tests: **15/15 PASS** (schema/repository/service 9, HTTP 6).
  Relevant API model/Concept/auth/account regressions bring the total to **63
  distinct passing tests**. An edited route test initially referenced an undefined
  variable; corrected within scope and its six-test file reran successfully.
- Full web run: **187/187 PASS**. Two subsequent focused tests added confirmation
  bypass/stale-edit and focus-wiring checks; the final controller/rendering run
  passed **16/16**, giving **189 distinct tests with passing evidence**. Final
  focused practice coverage is **21/21** (client 5, controller 10, rendering 6).
  This is reconciled offline evidence, not a claim of a new single 189-test run.
- Root build PASS (shared packages, web, admin, API); final web source rebuilt
  successfully after confirmation hardening. Lint PASS. Workspace typechecks
  PASS after a test-only pipeline cast correction; API/web final typechecks PASS.
  Browser spec/config TypeScript compile PASS without Playwright execution.
  Repository Prettier format check PASS; documents are excluded by existing
  formatter configuration and are reviewed separately for UTF-8/LF and scope.
- Sandbox tsx initialization failed before tests due to Windows user lookup
  (uv_os_get_passwd). Authorized offline tests used the supported ordinary,
  non-administrator user context. One targeted web invocation from repository
  root selected the wrong JSX configuration; rerunning from apps/web passed.
  No test/application assertion was weakened for these execution corrections.
- Seven new mounted browser scenarios prepared (three viewports plus four
  behavior/security/isolation cases). Existing integration extended with
  descriptive persistence/query, pagination, DTO secrecy and both-type ancestry
  coverage. Neither browser nor MongoDB verification was executed.
- Security review: two exact query types; unchanged auth/limiters/publication
  helpers/model/indexes; explicit seven-field projection; client type/Concept
  identity validation; memory-only two-type stores with one shared cap; guarded
  confirmation, cancellation and stale-result suppression; unchanged restricted
  Markdown, escaped code and server-only visualization fixture guard.

No known implementation defect remains from offline verification. Real mounted
focus, responsive interaction and live MongoDB behavior remain separately gated;
unit focus wiring is not browser or assistive-technology acceptance. Primary-host
Playwright remains blocked pending ownership-safe execution/containment approval.
F031's 40 PASS / 1 FAIL / 56 NOT_RUN and all Section 7 limitations remain retained;
no browser-regression exception is granted to F032. No Git operations, persistent application
startup, live database operations, browser execution or F033 work occurred.
Offline HTTP tests used their existing short-lived mocked loopback servers.

## 9. Owner-authorized disposable MongoDB verification (2026-10-18)

**Isolation preflight PASS. Integration PASS: 6/6 including the parent test
(five substantive checks), zero retries, failures, skips or cancellations.**
F032 remains IN_PROGRESS; browser execution and final acceptance remain gated.

The single execution used `node --import tsx --test
apps/api/tests/practice.integration.ts` with the existing unchanged
`scripts/LocalProcessOwner.cs` helper and the approved PowerShell 7 standard-input
procedure. Node test duration: 3.59 seconds; complete startup/test/cleanup: 9.69
seconds. Evidence: `.cache/f032-integration-2026-10-18-10-04-36/` (initialization,
integration, shutdown and MongoDB logs; process/storage ownership; before/after
protected-process and demo metadata; result.json).

- Fresh current-user-owned temporary storage was empty before startup. The owned
  mongod.exe PID 13072, parent PID 20472, creation-time ticks 639278948770230130,
  executable path, ordinary user owner and native Job membership were verified.
  Port 27018 was initially free; its eventual listener belonged to that process
  and bound only 127.0.0.1. No protected process was adopted into the Job.
- Independent target checks verified server PID, exact disposable dbPath,
  loopback binding/port and replica configuration. Replica `f021-test` reached
  writable PRIMARY before listDatabases/listCollections. No non-system database
  existed and `deeplearner-f021-test` contained no collections before fixtures.
  Child environments were allowlisted with explicit test URI/database; no .env,
  application development credentials or inherited database fallback was used.
- Live checks passed for default OUTPUT HTTP retrieval, explicit OUTPUT repository
  behavior, DESCRIPTIVE HTTP/repository filtering, type-specific stable pagination,
  published/version filtering, both types' five-level ancestry/reference checks,
  seven-field descriptive DTOs, sensitive-field exclusion and immutable reads.
  Invalid SCENARIO HTTP requests were rejected; malformed eligible content retained
  sanitized dependency errors. Student HTTP retrieval and existing unauthenticated,
  non-Student, suspended and unverified rejection checks passed.
- Coverage precision: explicit `type=OUTPUT` HTTP, broader invalid-type cases,
  maximum pagination limits, exact OUTPUT DTO keys, rate limits and GET-body cases
  retain the approved offline evidence; the prepared integration does not repeat
  every offline assertion. No extra tests or product requirements were added.
- Cleanup PASS: the integration closed its HTTP/database connections and removed
  its seven owned collections; independent cleanup readback found zero remaining
  test collections. Guarded MongoDB shutdown and mongod both exited 0, with no
  forced termination. Owned Job active count 0; port 27018 released. Only this
  run's verified disposable storage was removed; diagnostic evidence was retained.
- Protected MongoDB PID 5144, parent 1304, creation UTC
  2026-10-17T04:47:47.7735300Z and 127.0.0.1:27017 listener ownership matched before
  and after. Its executable path/owner remain UNKNOWN, not inferred. It was never
  connected to, assigned to the test Job, terminated or modified. Persistent
  demo-storage relative paths, sizes and write-time metadata matched exactly;
  accounts/content were not queried or independently recounted.

No integration defect was observed. No application/test/configuration changes,
Git operations, offline reruns or browser execution occurred in this gate.
Ready for a separately approved browser gate only after ownership-safe execution
or containment is approved. F031's exception and Section 7's historical limitations
remain unchanged; this database PASS does not establish browser compatibility.

## 10. Owner-approved local-development exception and final review (2026-10-18)

**FINAL REVIEW PASS WITH F032 BROWSER EXCEPTION. Review-stage status: READY_FOR_REVIEW.**

The owner explicitly approved the new local-development testing policy and this
one-time F032-specific browser-verification exception. It supersedes the earlier
complete-browser prerequisite ONLY for local-development acceptance. Sections 6-9
retain historical requirements, results and limitations; their earlier IN_PROGRESS
or not-yet-authorized statements describe those gates, not this later decision.
No earlier failure, NOT_RUN case or accepted prior-feature result is rewritten.

### Scope and retained evidence

The exact Section 5 implementation inventory remains 19 files; a read-only review
of working-tree paths matched that allowlist. AGENTS.md is an additional, separately
owner-approved project-policy document, not a product implementation expansion.
Only AGENTS.md, this document and DEVELOPMENT_ROADMAP.md change in this gate.
No product, test, configuration, dependency, temporary-package or database change.

| Criterion | Local-development finding |
| --- | --- |
| OUTPUT/DESCRIPTIVE and default compatibility | Strict two-type query/default OUTPUT, unchanged pagination/order/errors; source review and 63 distinct API passing tests |
| Authorization/publication | Existing authenticated eligible STUDENT service and rate limits; unchanged five-level F021 publication/ancestry pipeline; 6/6 disposable MongoDB checks including parent |
| Seven-field secrecy | Explicit projection plus DTO allowlist: id, conceptId, type, difficulty, prompt, starterCode, language; answer/explanation/evaluation/provenance excluded |
| Draft isolation/limits | Account/Concept-keyed controller lifetime, separate type/question stores, 100 drafts total and 10,000 units each; memory-only; retained frontend tests |
| Clear-all confirmation | Explicit confirmation identity, invalidated by edits/requests/type/identity changes; current account/Concept across both types only |
| Request safety | Abort and generation checks suppress stale success/error; authenticated-read guards reused; client validates Concept/type/page response identity |
| Presentation/security | Restricted Markdown reused; inert escaped code and drafts; native type buttons with pressed state and focus wiring; mounted behavior NOT_VERIFIED |
| Offline verification | API 63 distinct PASS, web 189 distinct PASS; focused API 15/15, focused web 21/21; reconciled evidence, not new full-suite runs |
| Database/static/scope | MongoDB 6/6 PASS and isolated cleanup; build/lint/TypeScript/formatting/security/scope PASS retained; 19-file boundary unchanged |
| Browser exception | Seven F032 and expected complete 104 scenarios NOT_RUN; owner accepts the risks below for local development only |

These findings use the approved retained evidence and read-only source review.
No tests, application startup, manual browser inspection, synthetic validation
or database run was performed in this documentation/final-review gate.
No substantive F032 defect was identified; this does not prove mounted behavior.

### Exact browser deferral for this F032 acceptance gate

| Browser group | Expected cases | Current F032 regression gate |
| --- | ---: | --- |
| F022/F025 | 27 | NOT_RUN |
| F023 | 16 | NOT_RUN |
| F024 | 19 | NOT_RUN |
| F028 | 13 | NOT_RUN |
| F029 | 7 | NOT_RUN |
| F031 | 14 | NOT_RUN |
| F032 | 7 | NOT_RUN |
| Smoke | 1 | NOT_RUN |
| Total | 104 | NOT_RUN |

The seven F032 mounted scenarios are INCLUDED in 104, not seven additional cases.
Counts retain the approved expected inventory; no discovery ran in this gate.
F032's new coverage is three viewports (1280/768/390), type/draft round trips and
confirmed clearing, loading/empty/error/Retry/wrong-type handling, obsolete-response
suppression, and account/Concept identity replacement. None has mounted PASS.
The table concerns the current F032 regression gate; it does not erase earlier
F031's 40 PASS / 1 FAIL / 56 NOT_RUN or other historical successful executions.
Previously outstanding compatibility cases remain outstanding.

### Explicitly accepted risks and non-transferability

The owner accepts for LOCAL development only: unverified responsive layout;
keyboard operation, focus and accessibility in a real browser; real-browser
account-switch and draft-isolation races; and incomplete shared authentication
and Concept-publication compatibility. Unit/controller/HTTP/MongoDB evidence
reduces uncertainty but does not establish these browser properties.
Exhaustive screen-reader compatibility and actual background throttling remain
unverified. Retain F022 historical EPERM/inconclusive ownership and Windows
taskkill PID-reuse risk, F024 worker-browser lifecycle conflict, F029 intermittent
ArrowDown failure with independent recovery/inconclusive cause, and Windows
graceful-shutdown limitations.

Manual browser inspection is supplemental only; it cannot replace automated
coverage or turn NOT_RUN into PASS. No local or production security, API,
authorization or database assertion is waived. This exception is expressly for
F032 alone. F031's one-time exception is not its authority; neither exception nor
the general policy applies automatically to F033 or any future feature.

### Closed infrastructure investigation and future verification

Stop expanding the custom prototype. Retain Gate 1 synthetic 10/10 PASS and
Gate 2 synthetic 10/10 PASS, together with historical failed attempts and cleanup
evidence. These are process-safety negative controls, not Playwright acceptance.
The current approach is not feasible as a verified safe Playwright execution
solution: positive /T tree termination unsupported; browser/worker/server fallback
coverage unverified; native/internal bypasses uncontrolled.
Actual primary-host Playwright is prohibited until separate ownership-safe approval.
The temporary package/evidence are preserved; this gate neither modifies nor
executes nor deletes them. No new infrastructure or further investigation is begun.

Future verification requires an explicitly approved ownership-safe execution
procedure, seven mounted F032 cases and the complete expected 104-scenario bounded
segmented regression, including the outstanding F031 compatibility coverage.
Preserve F024 invocation isolation, zero retries, existing assertions/timeouts,
25-minute browser budget and five-minute initial diagnosis limit. F029 recurrence
requires retained evidence and separate correction approval. Any future execution
is a new owner gate, not authorization from this policy/exception.

Before production deployment, a separately approved browser-regression and
release-readiness review is mandatory. This local exception cannot approve
deployment or imply full end-to-end, accessibility or compatibility acceptance.
Submissions, scoring, answer unlocking, progress persistence, Admin authoring,
code execution, new dependencies and infrastructure remain excluded.

F001-F031 remain APPROVED_COMPLETE. F033 remains NOT_STARTED and unauthorized.
The review-stage READY_FOR_REVIEW handoff required separate owner approval for
completion and Git delivery; that approval is recorded below.

## 11. Owner-approved completion and Git delivery (2026-10-18)

The owner explicitly approved F032 as APPROVED_COMPLETE for LOCAL DEVELOPMENT
ONLY, retaining the feature-specific browser exception and all Section 10 risks.
The scoped commit and safe push to origin/dev are authorized for the 19 Section 5
feature files plus the separately approved AGENTS.md policy file: 20 unique files.

Retained evidence is unchanged: API 63 distinct PASS, web 189 distinct PASS,
disposable MongoDB integration 6/6 PASS, and build, lint, TypeScript, formatting,
security and scope checks PASS. No checks were rerun for this delivery gate.
F032 mounted acceptance remains 7 NOT_RUN; the expected complete browser
regression remains 104 NOT_RUN, including those seven. No browser PASS, complete
compatibility acceptance or production deployment is authorized.

All historical results, the closed prototype investigation and primary-host
Playwright prohibition remain unchanged. Future browser execution and release
readiness require separate approval; this exception does not transfer to another
feature. F001-F031 remain APPROVED_COMPLETE. F033 remains NOT_STARTED and
unauthorized; no F033 implementation is part of this delivery.

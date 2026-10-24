# F041 - Student Dashboard Real Data

**Status:** APPROVED_COMPLETE — LOCAL DEVELOPMENT ONLY
**Dependency:** F040, APPROVED_COMPLETE locally.
**Owner approval:** 2026-10-24; approved frontend-only plan, exact 13-path feature
inventory and two slices; later explicit Slice 2 implementation/offline approval
is recorded in Section 7.
**Slice 1:** ACCEPTED_LOCAL - explicit owner acceptance, 2026-10-24; offline PASS.
**Slice 2:** ACCEPTED_LOCAL - offline only; explicit owner acceptance, 2026-10-24;
exact eight-path scope, 20 browser scenarios prepared and NOT_RUN.
**Browser exception:** Explicit owner approval, 2026-10-24; F041 only, LOCAL
DEVELOPMENT ONLY. Verification deferred, not passed; see Section 9.
**Git:** Separate scoped local checkpoints authorized for both slices; no push.
Preserve F040 checkpoint
`24fdc61e4fd09a69b8e7e2e8447b696fa9b0c27c`.

## 1. Sources, scope and exclusions

Inspected AGENTS.md, roadmap F041, PRD Student Dashboard/Weak Topic Detection,
SYSTEM_ARCHITECTURE layering, API_DESIGN's accepted F040 refinement,
DATABASE_DESIGN's F037/F039/F040 refinements, accepted F013/F037/F039/F040 plans
and existing Auth, Progress, Concept and Student-shell code. The prior read-only
planning inspected the dashboard Stitch screenshot and code.html. Preserve the
existing teal branding/card hierarchy; do not import its scripts/CDNs or invent
its unsupported metrics. No UI is implemented in Slice 1.

The approved increment will display Saved Concept practice from the existing
LOCAL-only GET /api/v1/dashboard. Each entry may show title, difficulty, existing
Concept route, positive saved-attempt count, first/latest attempt timestamps and
the server-returned classification/evidence state. Activity is not completion;
IMPROVING is a score band, not evidence of improvement over time. No client grading,
percentages, completion claims, streaks, XP, recommendations, bookmarks, recency,
active-path/resume selection, persistence, tracking, backend changes or F042.

## 2. Exact client and controller contract

createDashboardClient(base,fetcher?,timeoutMs=35000).load(cursor,token,signal)
sends only GET /dashboard?limit=5 and an optional canonical cursor, with Bearer
authorization, credentials:omit, cache:no-store, redirect:error and cancellation.
No account, score, policy, approval flag or request body is sent. Base URLs must
be HTTP(S) without credentials/query/fragment. Test timeouts may be shorter but
cannot exceed 35 seconds. A live monotonic check also refuses late success after
fetch/body parsing even if a test transport ignores AbortSignal. Timers/listeners
are disposed. No retry, refresh, polling or automatic cursor traversal.

Strict success envelope: exactly success:true, data, message:null and
meta:{requestId}. data contains exactly items (0..5) and
pagination:{limit:5,nextCursor:canonical ID|null}. IDs are exactly 24 lowercase
hex characters. Concepts allow only id/title/slug/difficulty, preserving F040's
length/trim/enum rules. Activity reuses the strict F037 five-field schema, requiring
IN_PROGRESS, positive safe count, nonnull ordered UTC-millisecond dates and the
same Concept identity. Items are strictly ascending, unique and after the
requested cursor. Nonnull continuation must equal the last item of a full page;
no guessed totals or repeated/backward cursor claims are accepted. Completeness
and exhaustion remain server proofs; the client cannot detect omitted records.

Mastery is exactly one of:
- EVALUATED, result:{classification,code}, unavailableCode:null. WEAK/IMPROVING/
  STRONG require NONE. UNCLASSIFIED permits only SCORE_MISSING, STALE_ASSESSMENT
  or REVOKED_ASSESSMENT.
- UNAVAILABLE, result:null,
  unavailableCode:LOCAL_QUALIFICATION_UNAVAILABLE.

No numeric score, private answer/rubric, account/session ID or additional field is
accepted. The frontend validates shape, not source authenticity. Server ownership,
published ancestry, original assessment proof and current policy remain authority.
Ordinary login cannot create synthetic qualification. Normal production startup
does not mount F040; 404/503 are unavailable, never empty or WEAK. Actual current
grading is binary 0/100; intermediate IMPROVING display fixtures are offline only.

DashboardError extends the existing ApiError for unchanged AuthController 401/
account-refusal handling. Public error messages/categories are fixed; raw server
messages/details and native errors are never propagated. 401/403 deny, 404/503
are unavailable, 429 rate-limited, malformed success/network/other failures error.
CORS exposes no Retry-After to the cross-origin client; no exact countdown is
invented. All retry is explicit. There is no new token refresh or replay strategy.

createDashboardController(client,auth,accountId) binds a trusted local account;
auth supplies existing runAuthenticatedRead/getSnapshot/subscribe. State is
idle/loading/ready/denied/unavailable/rate-limited/error with data|null, current
cursor|null and a fixed message. Empty is ready with items:[], never an error
fallback. Public load/first/refresh start at the first page; next uses only proven
continuation; retry repeats the last explicit target. Replace pages; hold at most
five entries and no cumulative cursor history. Duplicate in-flight targets share
one request; a different explicit target aborts/supersedes the old generation.

Auth eligibility is checked before and after requests. Observe auth changes while
active; account switch, pending auth, logout, lost eligibility or uncertainty
abort work and erase data/cursors. No automatic reload when eligibility returns.
cancel unsubscribes, aborts, clears data and invalidates late replies; an explicit
later load may subscribe again for the existing React lifecycle pattern. Tokens
and responses remain memory-only; no storage, logging or broadcast of private data.

## 3. Exact approved inventory and slice gates

Slice 1 CREATE:
1. apps/web/src/lib/dashboard/contracts.ts
2. apps/web/src/lib/api/dashboard-client.ts
3. apps/web/src/lib/dashboard/dashboard-controller.ts
4. apps/web/tests/dashboard-client.test.ts
5. apps/web/tests/dashboard-controller.test.ts
6. docs/features/F041-student-dashboard-real-data.md

Slice 1 MODIFY:
7. docs/DEVELOPMENT_ROADMAP.md

Slice 2 CREATE (authorized 2026-10-24):
8. apps/web/src/hooks/use-dashboard.ts
9. apps/web/src/components/student/dashboard-activity.tsx
10. apps/web/src/components/student/dashboard-activity.module.css
11. apps/web/tests/dashboard-rendering.test.ts
12. tests/browser/dashboard.spec.ts (prepare only; execution separately gated)

Slice 2 MODIFY:
13. apps/web/src/components/student/dashboard-foundation.tsx
Also update this shared feature plan and roadmap. Total unique inventory:
13 paths, 11 creations and two modifications. No package/configuration/API/model
or shared-package edits. Existing /dashboard route and shell remain unchanged.

Each slice ends with focused tests, applicable regressions, static checks and
separate Critical/High/Medium/Low review; then STOP for owner acceptance. A local
Git checkpoint requires separate explicit approval after each accepted slice.
Do not accumulate Slice 2 work before Slice 1 acceptance and checkpoint decision.

## 4. Verification and release policy

Slice 1 tests: exact envelope/DTO, malformed/private fields, activity identity,
all permitted classification states, canonical ordering/cursor progression,
35-second cap, abort/late bodies, Auth 401 semantics, refusal states, deduplication,
supersession, account invalidation, retry and first-page reset. Regress existing
Auth/API-client/redirect/coordination, Progress, Completion, Concept and Student
shell/navigation. Build web, TypeScript source/tests, targeted ESLint/Prettier,
UTF-8/LF, secrets, exact scope and diff checks. Offline mocks are not live Auth,
browser or database proof. Record actual results below without retry inflation.

No MongoDB execution in this gate. F040's authenticated 9/9 remains historical
backend acceptance only; RESULT/host ACK PASS and parent delivery observations
UNKNOWN remain unchanged. No new schema/index is required. Any fresh live API-
backed acceptance needs separately approved ownership-safe disposable execution.

Existing 153 browser scenarios remain NOT_RUN. Slice 2 will prepare 20 additional
F041 scenarios: authorized load; anonymous redirect; Admin/ineligible refusal;
empty state; classification/absence display matrix; malformed response refusal;
network/503/manual retry; rate limiting; non-LOCAL unavailable; next/first pages;
double-click deduplication; stale generation; logout/cross-tab invalidation;
account switch; navigation/Concept link; desktop; tablet; mobile/long content;
keyboard/focus; accessible announcements. These are 20 proposed scenario
definitions, not executed tests. Expected combined coverage becomes 173 when
prepared; all remain NOT_RUN until separately authorized safe execution. Existing
configs do not select F041; no config/launcher work or inherited browser exception
is authorized. No further Windows console/Playwright infrastructure investigation.

Real failover, multi-process behavior, persistent migrations/provisioning,
production enrollment, privacy/retention/erasure/backups, operational/security
release review and full real-browser acceptance remain separate gates.
Production readiness NOT_VERIFIED. F001-F040 remain APPROVED_COMPLETE locally.

## 5. Slice 1 implementation and verification evidence

Implementation started 2026-10-24. Owner estimate 30-60 minutes; initial agent
estimate 25-45 minutes. Actual approximately 17 minutes, no overrun. Exact
seven-path scope; no dependencies.

### 5.1 Executed offline evidence

- Final focused tests: **78 distinct PASS**, no failure/cancellation/skip. This is
  51 client/schema tests plus 27 controller tests. The initial 74/74 also passed;
  three focused guards were added during pre-final-review hardening, so repeated
  execution is not added to the distinct count. New guards cover exact default
  35-second timer/disposal and fail-closed auth snapshot/subscription observation.
  Final review added one further failure-path account-recheck/cursor-erasure
  guard: the affected controller suite passed 27/27; unchanged client suite
  retains 51/51. The earlier combined 77/77 and repeats are preserved, not added
  again to the distinct count.
- Relevant existing regressions: **106 distinct PASS** across api-client,
  auth-controller, auth-redirect, browser-coordination, progress-client,
  progress-controller, progress-rendering, completion-client,
  completion-controller, completion-rendering, concept-client,
  concept-controller, concept-markdown, concept-rendering, student-navigation
  and student-shell. Final selected distinct total: **184 PASS** (78 + 106).
- Preserve the initial regression attempt: 106 executed, 98 PASS / 8 FAIL,
  all eight with ReferenceError: React is not defined in unchanged Concept
  Markdown callbacks. The command ran from repository root, selecting the wrong
  JSX compilation context. Only the affected two files were rerun from the web
  package's normal working directory: 16/16 PASS, including the eight failures
  and eight previously passing cases. No Concept/Auth/other feature file or
  assertion was modified, no React global injected, and repeats are not counted
  twice. This is an invocation-context correction, not an application fix.
- Web Next production build PASS, including its TypeScript and prerendering.
  Preserve the first sandbox build failure: existing Geist/JetBrains Mono
  Google Fonts fetches could not connect. The same build outside the sandbox
  succeeded, with no font/source/configuration/dependency change. This build
  result is not a production-readiness or mounted-browser acceptance claim.
- Web TypeScript source/tests (`tsc --noEmit --incremental false`) PASS on final
  source. Targeted ESLint (zero warnings) and Prettier on all five new TypeScript
  files PASS. Documentation uses the repository's existing docs formatting
  exclusion; its UTF-8/LF, whitespace and historical-scope checks are separate.
  No passing dependency suite was rerun after the controller-only hardening.

### 5.2 Separate final source/security review

After verification, a distinct review phase inspected all new production modules
and tests, current AuthController integration, F040 schemas/error contracts,
generation/cursor transitions, disposal and the complete seven-path diff.
**Critical 0 / High 0 / Medium 0 / Low 0 unresolved findings.** This is a separate
review phase, not a claim of a second human/agent reviewer. Pre-final-review
hardening made auth observation exceptions deny/erase data and has focused
regression coverage; no authentication source or strategy was changed.
Final review also corrected failure-path cursor retention when account
ineligibility is discovered without an auth notification; data and cursor now
both clear. Focused coverage PASS; no unresolved finding remains. The source,
tests, build and static checks were reverified after this production change.

Checked: exact success allowlists and identity/order/date consistency; fixed
five-entry page replacement; bounded native fetch/body cancellation with late
success refusal; account eligibility before/after reads; synchronous invalidation
on observed account/logout/pending/uncertain states; stale success/error rejection;
single-flight duplicates; explicit retries only; unchanged real Auth 401 and
cross-tab control behavior; sanitized errors and memory-only responses/tokens.
No response authenticity, publication proof, durable mutation or classification
authority is inferred from a frontend schema or synthetic test adapter.

### 5.3 Final status, scope and outstanding gates

Slice 1 **READY_FOR_REVIEW**, F041 **IN_PROGRESS**, Slice 2 **NOT_STARTED**.
No panel, hook, page, CSS, browser spec or backend change was implemented.
The six created files and sole roadmap modification are exactly Section 3's
seven Slice 1 paths. UTF-8 without BOM/LF, added-line whitespace, targeted secret-
pattern/static secrecy review, exact scope and empty-index/checkpoint checks PASS.
Existing Markdown hard-break whitespace in roadmap history is preserved;
git diff --check PASS. F040 commit remains unchanged, F001-F040 approved locally and
F042 NOT_STARTED. No staging, commit, push, database or browser execution.

Owner Slice 1 acceptance and a separately approved local Git checkpoint are the
next gates. Slice 2's UI/accessibility/mounted browser preparation requires
separate approval. The existing 153 browser scenarios remain NOT_RUN; the 20
new scenarios remain planned, not prepared/executed. No browser exception is
granted or transferred. Fresh live F041 API/database/browser behavior is
NOT_VERIFIED; historical F040 evidence is not a new F041 run. LOCAL-only service,
synthetic authority, real failover, multi-process and production privacy/security/
release limitations remain. Production readiness NOT_VERIFIED.

## 6. Owner Slice 1 acceptance and local checkpoint - 2026-10-24

The owner explicitly accepted Slice 1 for **LOCAL DEVELOPMENT ONLY**, conditional
on final Git integrity/scope checks, and authorized exactly one local commit:
`feat(dashboard): implement F041 validated data client and controller`.
This supersedes the pending-acceptance gate in Section 5.3; its historical
verification, failed attempts/corrections and limitations remain unchanged.

Retain 78 focused + 106 relevant regressions = **184 distinct PASS**; web build,
source/test TypeScript, targeted lint/formatting, UTF-8/LF/scope/diff checks PASS;
zero unresolved Critical/High/Medium/Low findings. Existing authentication
contracts and all five accepted TypeScript files are unchanged in this Git gate.
No passing suites are rerun for acceptance documentation.

Slice 1 is **ACCEPTED_LOCAL**; F041 remains **IN_PROGRESS** and Slice 2
**NOT_STARTED**. The checkpoint includes exactly Section 3's seven Slice 1 paths;
no UI, browser spec, backend, temporary evidence, generated artifact, dependency
or F042 file. Preserve F040 commit
`24fdc61e4fd09a69b8e7e2e8447b696fa9b0c27c` without history rewriting.
F001-F040 remain approved locally. Existing 153 browser scenarios NOT_RUN;
20 F041 cases remain planned for Slice 2. Production readiness NOT_VERIFIED.

The authorization permits no remote push, feature completion or Slice 2 work.
After the local checkpoint and clean-index/working-tree verification, STOP for
separate owner approval of Slice 2. Any later remote delivery is separately gated.

## 7. Owner-approved Slice 2 implementation - 2026-10-24

Owner approved exactly the five Slice 2 creations and three modifications in
Section 3. Preconditions PASS: dev, clean working tree/index, unchanged accepted
Slice 1 checkpoint `7c03570441ff5d0fb47aa28858b302d13cbe9dc0`. No Slice 1,
Auth, API, database, configuration, dependency or shared-package changes.
Slice 2 IN_PROGRESS; verification and review pending. Agent estimate 30-50 minutes;
owner estimate 40-75 minutes. Browser execution and all Git writes prohibited.

### 7.1 Implemented presentation and lifecycle

The Saved Concept practice panel mounts only for an authenticated, nonpending,
ACTIVE, verified STUDENT. Its inner component is keyed to the current account;
the hook reuses the accepted authenticated controller and cancels/disposes it on
unmount. Auth invalidation, account change and request supersession retain the
accepted abort/generation/data-erasure behavior. No Auth, API, Slice 1, route,
configuration or dependency changes; no response persistence or logging.

Five entries per page show escaped titles, existing ID-based Concept links
(prefetch disabled), difficulty, saved-attempt counts, semantic UTC timestamps
and server-returned classification. Missing, stale, revoked and ordinary
unavailable evidence have separate labels. No scoring, completion inference,
improvement-over-time claim, totals, XP, streaks or recommendation is introduced.
Refresh and Back to first reset the page; Next uses the validated continuation.
Pages replace rather than accumulate. Loading hides earlier entries; errors are
fixed safe notices with manual Retry, never empty/zero-score fallbacks. No polling,
automatic retry or pagination, token refresh/replay or Retry-After countdown.

The card hierarchy and teal styles adapt the inspected Stitch reference using
existing tokens. Account details, preferences, navigation and branding remain.
Native controls, a labelled region, polite status/alert semantics, text badges,
responsive wrapping and explicit-success heading focus are implemented. These
are source/offline facts; real keyboard, screen-reader, focus and layout behavior
remain NOT_VERIFIED until approved browser execution.

### 7.2 Executed offline verification

- New UI/rendering/hook tests: **27 distinct PASS**, zero failed/cancelled/skipped.
  Coverage includes eligibility/account keys, every classification/absence state,
  strict malformed/private projection refusal, fixed API/rate-limit notices,
  escaped titles/safe links, timestamps, five-entry page controls, native action
  wiring and focus-effect decisions, effect-only initial reads, unmount abort and
  late-response refusal, auth-state erasure, configuration refusal and lifecycle
  cleanup/setup replay. React static rendering and controlled hook/effect adapters
  are offline tests, not a mounted browser, live Auth or actual assistive technology.
- Relevant regressions: **184 distinct PASS** from the web package working
  directory: accepted dashboard-client (51) and dashboard-controller (27), plus
  the 106 existing Auth/API/redirect/coordination, Progress, Completion, Concept
  and Student-shell/navigation tests listed in Section 5.1. Selected distinct
  total this gate: **211 PASS** (27 + 184). Repeated new-suite execution after the
  test-only lint correction is not added to the distinct count.
- Web build PASS, including route prerendering and Next TypeScript checks.
  Preserve the initial sandbox failure: EPERM while creating generated
  `.next/server/app/_not-found.segments/_not-found` storage. The identical build
  outside the sandbox passed; no source/configuration/font workaround was used.
- Web source/test TypeScript with `--noEmit --incremental false` PASS. The new
  browser spec separately passed TypeScript static compilation without importing
  a browser runner or executing/listing browser cases.
- Targeted ESLint, zero warnings, PASS on the five affected TS/TSX files. Preserve
  the initial lint failure: the new offline hook harness used the reserved local
  name `module` (`@next/next/no-assign-module-variable`); renamed to `hookModule`
  inside the authorized test path. Focused tests and lint then PASS.
- Prettier PASS on all six affected TS/TSX/CSS files. Docs retain the existing
  formatting exclusion. UTF-8 without BOM/LF, final newline, exact eight-path
  scope, added-line whitespace, git diff --check and empty-index checks PASS.
  Targeted sensitive-pattern/sink checks and source inspection found no secret,
  response logging, browser persistence or unsafe HTML sink. Static foreground/
  background text contrast calculations pass 4.5:1 for the four badges, teal
  controls and muted metadata (minimum 5.47:1); this is not browser/visual QA.

### 7.3 Separate source/security review

A distinct final review phase inspected the hook, panel, CSS, complete foundation
diff, offline test harness, 20 prepared browser cases, documentation and accepted
Auth/controller/schema integration. **Critical 0 / High 0 / Medium 0 / Low 0
unresolved findings.** This is a separate review phase by the implementing agent,
not a claim of a second agent/human reviewer or browser acceptance.

Verified source boundaries: account-keyed eligibility and cancellation, original
401 behavior, no refresh/replay change, strict DTO revalidation before rendering,
canonical links and escaped strings, fixed failure messages, no answer/rubric/
numeric-score access, no database/mutation or persistent cache, bounded page
replacement, manual actions, stable hook disposal and preserved account/profile
markup. No server publication, assessment authenticity or production capability
is inferred from client validation or synthetic fixtures. Browser preparation
also checks blocked background requests and sanitizes fixture diagnostics; a
tablet scenario scrolls its control into view before asserting viewport presence.

### 7.4 Browser preparation and remaining gates

Exactly **20** individually named `F041-B01` through `F041-B20` cases are prepared
in tests/browser/dashboard.spec.ts, matching Section 4's approved manifest.
All **20 NOT_RUN**; existing **153 NOT_RUN** remain unchanged; combined backlog
**173 NOT_RUN**. No browser launch, Playwright execution/listing, configuration or
infrastructure change. No browser exception is granted or transferred. These are
synthetic HTTP fixtures and cannot prove live authentication, published ancestry
or F039 qualification. Navigation coverage prepares route/unmount checks, not full
earlier Concept/Practice compatibility acceptance.

No fresh MongoDB/API integration in this frontend gate. Historical F040 evidence
and its limitations remain intact. Real-browser responsive layout, keyboard/focus,
screen readers, navigation/account races and network interruptions remain
unverified. Intermediate IMPROVING presentation uses offline synthetic data only;
normal startup does not supply F040's LOCAL synthetic authority. Real failover,
multi-process, production privacy/retention/erasure/backups, migrations and
operational/security/release gates remain outstanding. Production readiness
NOT_VERIFIED.

### 7.5 Final Slice 2 status

Slice 2 **READY_FOR_REVIEW (offline only)**; F041 **IN_PROGRESS**; Slice 1
**ACCEPTED_LOCAL** at unchanged `7c03570441ff5d0fb47aa28858b302d13cbe9dc0`.
Exactly the five creations and three modifications in Section 3; no deviations,
dependencies or unrelated changes. F001-F040 remain approved locally; F042
NOT_STARTED. Git index empty, eight expected paths uncommitted; no staging,
commit, push, database or browser execution. Actual approximately 18 minutes
against the initial 30-50 minute estimate; no overrun.

STOP for owner Slice 2 review/acceptance and separately approved local checkpoint.
Feature completion remains a separate owner gate, including the named F041
browser-verification decision required by AGENTS.md; no implicit exception.

## 8. Owner Slice 2 acceptance and local checkpoint - 2026-10-24

The owner explicitly accepted Slice 2 for **LOCAL DEVELOPMENT ONLY, offline
only**, conditional on final Git scope/integrity verification, and authorized
exactly one eight-path local commit:
`feat(dashboard): integrate F041 student activity panel`.
This supersedes the pending Slice 2 acceptance/checkpoint gate in Section 7.5;
all earlier implementation evidence, failures, corrections and limitations remain.

Retain **27 focused + 184 regressions = 211 distinct PASS**, web build, TypeScript,
targeted lint/format, UTF-8/LF, scope/secrecy/diff checks PASS and zero unresolved
Critical/High/Medium/Low findings. No passing test suite is rerun in this Git gate.
No implementation, dependency or authentication change accompanies acceptance;
only this feature plan and the roadmap reconcile the approved status.

Preflight PASS: dev at unchanged Slice 1 checkpoint
`7c03570441ff5d0fb47aa28858b302d13cbe9dc0`, exactly the five Slice 2 creations and
three modifications in Section 3, empty index, no merge/rebase/cherry-pick or
concurrent Git-operation markers. Fresh read-only remote inspection confirms
origin/dev remains `24fdc61e4fd09a69b8e7e2e8447b696fa9b0c27c`; no push is authorized.
No unrelated, sensitive, generated or disposable artifact is included.

Both slices are **ACCEPTED_LOCAL**, Slice 2 **offline only**; F041 **IN_PROGRESS**.
F001-F040 remain approved locally; F042 NOT_STARTED. Existing 153 and new 20
browser scenarios remain **173 NOT_RUN**. No browser accessibility/responsiveness,
fresh live F041 API acceptance, feature completion or production readiness is
implied. Historical F040 integration/ACK evidence and UNKNOWN delivery fields
remain unchanged; all production limitations in Sections 4 and 7.4 remain.

After the scoped local checkpoint, STOP. F041 final review, named browser-
verification decision, explicit owner feature-completion approval and any remote
delivery remain separate gates. Production readiness NOT_VERIFIED.

## 9. Owner-approved F041 LOCAL-only browser exception - 2026-10-24

The owner explicitly approves the named-feature browser-verification exception
for **F041 - Student Dashboard Real Data only**, under AGENTS.md's exception
provision, exclusively for **LOCAL DEVELOPMENT acceptance**. The owner accepts
that F041 browser tests and live frontend-to-API integration have not executed.
This is a **verification deferral**, not a test pass, security waiver, production
approval or independent authorization of final F041 completion. It does not
transfer to F042 or any other feature and does not inherit earlier exceptions.

This later owner decision resolves the previously unapproved browser-deferral
gate recorded in Sections 4-8; all historical evidence, failed attempts,
corrections, earlier gate outcomes and uncertainty remain unchanged. The bounded
read-only feasibility review found no established approved isolated runtime;
existing configurations do not select F041. Primary-host Playwright remains
prohibited, and the custom teardown prototype is not a verified execution
solution. Historical ownership/PID-reuse, EPERM and browser/worker/server cleanup
concerns are not waived or repaired by this exception. No primary-host Playwright
execution, new runtime, configuration change or infrastructure work is authorized.

### 9.1 Exact deferred coverage and accepted consequences

- **20 F041 browser scenarios remain NOT_RUN**: F041-B01 through F041-B20 in
  tests/browser/dashboard.spec.ts, exactly the manifest in Sections 4 and 7.4.
- Existing **153 browser scenarios remain NOT_RUN**. Combined backlog remains
  **173 NOT_RUN**. None is relabelled PASS, SKIPPED or VERIFIED.
- No real-browser layout, responsiveness, keyboard/focus, screen-reader or
  accessibility acceptance has been obtained. Source semantics, static contrast
  and offline rendering evidence do not establish mounted-browser behavior.
- Real-browser authentication/account-change races, stale responses,
  cancellation, pagination/navigation, retries/network interruption and earlier
  Concept/Practice compatibility remain unverified. The owner accepts these
  outstanding functionality and compatibility risks for LOCAL DEVELOPMENT only.
- The prepared browser suite uses mocked HTTP/authentication responses. Even a
  future passing mocked run would not prove genuine backend authentication,
  publication/assessment authority or live frontend-to-API integration.
- **Live F041 frontend-to-API integration remains NOT_VERIFIED**. F040's nine
  authenticated backend integration records, RESULT validation/host digest ACK,
  isolation and cleanup are prerequisite backend evidence only. Parent delivery-
  observation fields remain UNKNOWN. No new F041 end-to-end PASS is inferred.

Retain **211 distinct offline PASS** (27 focused + 184 regressions), build,
TypeScript, lint, formatting, encoding/scope/secrecy/diff evidence and the separate
source/security review with zero unresolved Critical/High/Medium/Low findings.
No suite is rerun for this documentation gate. Authentication/authorization,
security, API and applicable database verification requirements are unchanged;
no authority, assertion, deadline or safety check is weakened.

### 9.2 Required future qualification and production gates

Future browser execution requires separate explicit owner approval of the runtime,
exact configuration/file scope and ownership-safe lifecycle/cleanup procedure.
Prefer a qualified disposable isolated environment; primary-host execution is
not authorized by this exception. Verify source/tool identities, disposable
profiles, synthetic data, permitted network access, bounded execution, sanitized
per-case evidence and complete owned-resource cleanup/protected baselines. Execute
the exact approved manifest without automatic retries; retain actual failures,
UNKNOWN evidence and NOT_RUN cases. Full browser regression and release-readiness
review remain separate requirements before production.

Live F041 frontend-to-API qualification needs a separately approved genuine-Auth,
LOCAL backend/disposable-fixture and frontend execution plan with original F040
ownership, publication, qualification, deadline, privacy and cleanup safeguards.
Mocked browser fixtures and the fixed F040 nine-record runner are not a substitute
for that approved end-to-end lifecycle. Do not use production/persistent data or
client-controlled qualification authority. LOCAL synthetic-origin qualification
remains restricted; ordinary login is not general production enrollment.

Real failover, multi-process behavior, persistent provisioning/migrations,
privacy/retention/erasure/backups, operational security, full browser acceptance
and production release requirements remain outstanding. **Production readiness
NOT_VERIFIED**; no deployment approval is granted.

### 9.3 Status and next gate

F041 remains **IN_PROGRESS**; Slice 1 **ACCEPTED_LOCAL** and Slice 2
**ACCEPTED_LOCAL - offline only**. F001-F040 remain **APPROVED_COMPLETE for LOCAL
DEVELOPMENT ONLY**; F042 **NOT_STARTED**. Accepted Slice 1 checkpoint
`7c03570441ff5d0fb47aa28858b302d13cbe9dc0` and Slice 2 checkpoint
`a2a76655ef2e01b148baba9c1689c1301c61d74a` remain unchanged. Preflight: dev,
exactly two local commits ahead of origin/dev, clean working tree and empty index.

Only this feature document and docs/DEVELOPMENT_ROADMAP.md change in this gate.
No source/test/configuration edits, browser/live API/MongoDB execution, staging,
commit, push or history rewriting. STOP for **separate final F041 owner acceptance**;
the exception alone does not set APPROVED_COMPLETE or authorize Git delivery.

## 10. Final owner LOCAL-development acceptance - 2026-10-24

The owner explicitly approves **F041 - Student Dashboard Real Data as
APPROVED_COMPLETE — LOCAL DEVELOPMENT ONLY**, based on the two accepted slices,
retained offline verification, final source/security review and the explicitly
documented F041-only browser exception dated 2026-10-24. This separate final
approval satisfies the pending owner-acceptance gate in Section 9.3. It does not
change earlier results or turn the exception itself into completion authority.
All historical IN_PROGRESS/READY_FOR_REVIEW gates, failures, corrections and
limitations remain preserved as history.

Slice 1 remains **ACCEPTED_LOCAL**; Slice 2 **ACCEPTED_LOCAL - offline only**.
Retain **211 distinct offline tests PASS** (27 focused + 184 regressions), web
build, TypeScript, targeted lint and formatting PASS, and zero unresolved
Critical/High/Medium/Low source/security findings. No passing suite is rerun and
no new runtime-verification result is claimed in this documentation gate.

Mandatory limitations remain:

- **20 F041 browser scenarios NOT_RUN**, **153 pre-existing browser scenarios
  NOT_RUN**, combined **173 NOT_RUN**. None is relabelled PASS or VERIFIED.
- Real-browser accessibility, responsiveness, focus and interaction behavior
  remain **NOT_VERIFIED**, including authentication/account races, navigation,
  cancellation, retry/network and earlier Concept/Practice compatibility risks.
- **Live F041 frontend-to-API integration NOT_VERIFIED**. F040's authenticated
  backend integration **9/9 PASS** is prerequisite evidence only and does not
  establish live F041 integration. F040's parent delivery-observation uncertainty
  remains documented and unchanged; host digest ACK evidence is not expanded.
- The Section 9 exception applies exclusively to F041 LOCAL DEVELOPMENT
  acceptance. It authorizes neither primary-host Playwright nor a transfer to
  F042, any other feature or production. Future browser/live integration
  qualification still requires the separately approved safeguards in Section 9.2.
- Production failover, multi-process behavior, privacy/security, retention,
  erasure/backups, migrations/provisioning, operational verification and full
  browser/release gates remain outstanding. **Production readiness NOT_VERIFIED**.

Preconditions PASS: dev, HEAD/Slice 2
`a2a76655ef2e01b148baba9c1689c1301c61d74a`, unchanged Slice 1
`7c03570441ff5d0fb47aa28858b302d13cbe9dc0`, exactly two local commits ahead of
origin/dev, only the two approved documentation files modified and empty index.
Both slices were ACCEPTED_LOCAL and F041 IN_PROGRESS before this reconciliation.
F001-F040 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY; F042 NOT_STARTED.

Only this feature document and docs/DEVELOPMENT_ROADMAP.md are reconciled. No
implementation, test, API, authentication, dependency or configuration change;
no browser, MongoDB or live API execution. This owner approval authorizes **no
staging, commit, push, amend, rebase or history rewrite**. Both accepted checkpoints
remain unchanged locally, and documentation stays uncommitted. STOP for separate
explicit owner approval of scoped Git delivery. Do not begin F042.

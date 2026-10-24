# F041 - Student Dashboard Real Data

**Status:** IN_PROGRESS - LOCAL DEVELOPMENT ONLY
**Dependency:** F040, APPROVED_COMPLETE locally.
**Owner approval:** 2026-10-24; approved frontend-only plan, exact 13-path feature
inventory and two slices; implementation/offline verification of Slice 1 only.
**Slice 1:** ACCEPTED_LOCAL - explicit owner acceptance, 2026-10-24; offline PASS.
**Slice 2:** NOT_STARTED; requires separate owner approval.
**Git:** One scoped Slice 1 local checkpoint authorized on 2026-10-24; no push.
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

Slice 2 CREATE, NOT_STARTED:
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

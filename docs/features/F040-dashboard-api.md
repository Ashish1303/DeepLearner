# F040 - Dashboard API

**Status:** IN_PROGRESS - LOCAL DEVELOPMENT ONLY
**Dependencies:** F037/F039, APPROVED_COMPLETE locally.
**Authorization:** Owner-approved detailed contract and eight-path Slice 1
implementation/offline verification, 2026-10-22; subsequent owner Slice 1 local
acceptance and single local checkpoint approval are recorded in Section 8.
**Slice 1:** ACCEPTED_LOCAL - explicit owner acceptance; offline verification PASS.
**Slice 2:** NOT_STARTED; requires separate approval.

## 1. Objective and exclusions

Sources inspected: AGENTS.md; PRD Sections 12/26; SYSTEM_ARCHITECTURE layering;
roadmap F040/F041; API_DESIGN F037/F039; DATABASE_DESIGN's approved progress/
completion/mastery refinements; F037/F039 plans and existing Auth/publication code.
Implement only an internal reader of owned saved Concept practice activity and
current F039 classification. This is a bounded PRD subset, not the full dashboard.
Exclude F041/UI, Admin impersonation, active-path selection, recency/resume or
Topic recommendations, path percentages, study time, bookmarks/notifications,
XP/streak/badges, scoring, completion changes, stored mastery, repair/backfill,
migrations, provisioning, dependencies and production enrollment.

## 2. Future Slice 2 HTTP contract - approved design, not mounted

GET /api/v1/dashboard, LOCAL only, existing Bearer access token. Query is exactly
limit (scalar canonical decimal string 1..5, default 5) and optional cursor
(exactly 24 lowercase hexadecimal characters). No unknown/duplicate/array/object,
blank/noncanonical values, GET body, client account/assessment/score/policy/sort
or freshness claims. HEAD must not accidentally execute GET; other data methods
and environments retain unmatched-route behavior. Existing CORS/preflight,
cookies, token/session semantics and private logging rules are unchanged.

Ascending Concept ObjectId keyset order, exclusive cursor. Cursor is a position,
not authority or an existence claim. Enumerate authenticated-owner studentProgress
summaries only; historical attempts without summaries are not discovered. Examine
at most 100 candidates plus one presence lookahead and locate limit+1 visible
Concepts. Return at most limit. Visible lookahead means nextCursor is the last
returned ID; null requires established exhaustion. Omit unpublished/inconsistent
ancestry without revealing hidden identities. Inability to prove completeness
within scan/time bounds returns 503, not a guessed empty page or continuation.
No totals/page counts, recency order or persistent snapshot between pages.

Success is 200 using {success:true,data,message:null,meta:{requestId}}. data is
exactly {items,pagination:{limit,nextCursor}}. Future HTTP validation uses existing
bounded allowlisted details; the internal command uses 400 Invalid dashboard
request. Other future errors retain existing missing/invalid/expired-token 401,
AUTH_FORBIDDEN/ORIGIN_NOT_ALLOWED 403, ROUTE_NOT_FOUND 404, parser 413/415,
RATE_LIMIT_EXCEEDED 429 and unexpected INTERNAL_ERROR 500. All dependency/unknown
proof failures use 503 DEPENDENCY_UNAVAILABLE, Dashboard is temporarily unavailable.
No partial 206, per-item driver errors or stack traces. Matching success/early
CORS/parser/auth/validation/errors require Cache-Control:no-store.

Future rate limits: 100/IP/15 minutes before authentication, then 20/current
Student/15 minutes; existing IPv6 grouping and process-random HMAC keys, draft-8
headers/Retry-After on 429. Limiter failure refuses with 503. Single-process only;
no distributed store, environment variable or shared middleware change.

## 3. Internal reader and exact DTO

createDashboardService(tokens,{APP_ENV},repository?,mastery?,clock?).read accepts
exactly {accessToken,query}; query contains raw scalar fields above ({} for defaults).
Dependencies are trusted internal composition/test adapters, never HTTP authority.
Identity derives from the existing verifier. Require current ACTIVE/email-verified
STUDENT before/after reads; reverify unchanged token sub/sid/role before success.
No service import/constructor connects, provisions, creates origins or mounts routes.

data has items (0..limit) and pagination (integer limit 1..5; nextCursor canonical
ID or null). Each item has only:
- concept: id (canonical ID), title (trimmed text 1..120), slug (existing lowercase
  format 1..100), difficulty BEGINNER/INTERMEDIATE/ADVANCED/INTERVIEW_READY.
- activity: conceptId (same ID), status IN_PROGRESS, positive safe attemptCount,
  nonnull startedAt/lastActivityAt in canonical UTC milliseconds, ordered. Retain
  the five F037 names/meanings: durable owned attempts across four Practice types,
  not section receipts, visits, client flags or F038 completion status.
- mastery: status EVALUATED/UNAVAILABLE, result, unavailableCode. EVALUATED requires
  result exactly {classification,code} and unavailableCode=null. WEAK/IMPROVING/
  STRONG require NONE; UNCLASSIFIED allows only SCORE_MISSING/STALE_ASSESSMENT/
  REVOKED_ASSESSMENT from F039. UNAVAILABLE requires result=null and
  unavailableCode=LOCAL_QUALIFICATION_UNAVAILABLE.

Reject extra fields, contradictory codes, invalid/null dates and inconsistent
pagination. No numeric score, account/session ID, private binding/approval/rubric,
answer, completion state or fabricated metric is public. Empty means no visible
summaries in this query, not no historical attempts. Current genuine grades are
0/100; intermediate IMPROVING behavior is verified offline only.

## 4. Authority and failure boundaries

Only ordinary v1 activity with no configured completion policy and established
absence of qualifying assessment evidence may be UNAVAILABLE. Up to 32 diagnostic
records may be structurally validated without promotion. Malformed/unbounded
evidence, a qualifying record, v2 claim without policy, configured policy without
origin, dead origin, unavailable indexes/DB or uncertain proof refuses with 503.
An ambiguous F039 404 never establishes ordinary absence. This conservative
absence check intentionally refuses unusual/unverifiable datasets.

Policy locators/qualificationAuthority are not approval. Only existing F039
classify({accessToken,conceptId}) may produce evaluated results. Its constructor
receives F039_DEFAULT_MASTERY version 1, thresholds 60/80. Preserve exact original
attempt/assessment selection, independent policy/rubric approval, revision and
publication binding, majority-owned proof and stale/revoked refusal. No pure
caller trust flags, best/latest selection, score fabrication, DIAGNOSTIC promotion
or origin reconstruction. Login alone is not origin; normal startup does not enroll
demo/imported users. Existing valid access JWTs retain normal post-logout expiry.

Reuse publishedConceptStages, progressRepository.ready/prepare and progressDto.
The new activity transaction supplies the same explicit session to F037 reads;
installed MongoDB driver CSOT covers those reads. Do not override operation
timeouts within that timed transaction. Discovery/final primary-majority reads
use live timeout allowances. Final checks compare publication metadata, exact
summary/policy/absence identity and origin identity; concurrent changes refuse.
Point-in-time proofs are not atomic cross-Concept or cross-process revocation.

## 5. Budgets and disposal

One monotonic 30-second service budget, never reset. Discovery: five seconds,
100 candidates plus presence lookahead. Activity: five-second read-only snapshot
phase including one-second disposal reserve. Dashboard callback reentry refuses
before repeating work; no automatic dashboard retry. Existing F039 bounded
callbacks, ten-second invocation budget and two-second verification reserve remain
unchanged. Admit at most five concurrent enrichments only with ten seconds plus
two-second final reserve remaining; settle every admitted outcome, including
failures. Final checks: at most five seconds and live overall remaining time.
Bound session end explicitly; failed/late disposal refuses. Check deadline after
final projection/authorization before success. No detached work, cached results,
unsupported cancellation propagation or Promise.race-based success.

## 6. Exact inventory and acceptance boundaries

Slice 1 CREATE:
1. apps/api/src/modules/progress/dashboard.schema.ts
2. apps/api/src/modules/progress/dashboard.dto.ts
3. apps/api/src/modules/progress/dashboard.repository.ts
4. apps/api/src/modules/progress/dashboard.service.ts
5. apps/api/tests/dashboard.test.ts
6. docs/features/F040-dashboard-api.md

Slice 1 MODIFY:
7. docs/DATABASE_DESIGN.md
8. docs/DEVELOPMENT_ROADMAP.md

Future Slice 2 CREATE:
9. apps/api/src/modules/progress/dashboard.controller.ts
10. apps/api/src/modules/progress/dashboard.routes.ts
11. apps/api/src/modules/progress/dashboard-rate-limit.ts
12. apps/api/tests/dashboard-routes.test.ts
13. apps/api/tests/dashboard.integration.ts

Future Slice 2 MODIFY:
14. apps/api/src/app.ts
15. docs/API_DESIGN.md
Also update the shared feature plan/roadmap. Total proposed unique inventory:
15 paths, 11 creations/four modifications. No additional path is authorized now.

Slice 1 acceptance: focused ownership/account/publication, pagination/scan/empty,
summary consistency, F039 outcomes, absence-versus-uncertainty, concurrency,
deadlines/disposal, exact DTO/secrecy and nonmutation tests; relevant F037/F039/
Auth/Completion regressions; API build/source-test TypeScript, targeted lint/format,
UTF-8/LF, scope/diff checks and separate Critical/High/Medium/Low review. Slice 2
adds HTTP/rate/no-store/security tests and separately approved disposable integration.
Existing F039 launcher has a fixed F039 manifest, not a generic dashboard runner;
separately reconcile its replacement/adapter before a future guarded execution.
Each accepted slice requires separately approved Git checkpoint; no Git now.

## 7. Verification evidence and remaining gates

2026-10-22 Slice 1 offline verification:

Execution estimate: 35-55 minutes; actual approximately 22 minutes. No overrun.

- Final focused dashboard suite: **51/51 PASS**. Relevant regressions: **209 PASS**
  across mastery, mastery-policy, access-token, completion-grading,
  completion-evidence, completion, practice-attempt-repository, progress,
  progress-routes and practice-grading. **260 distinct selected tests** across
  the final focused suite and unchanged dependency regressions; repeats are not
  added to that count. The earlier combined run was 257/257 (48 focused plus
  209 regressions); final review added three focused guards and reran the focused
  suite after its in-scope corrections. Dependency sources/tests stayed unchanged.
- API build and source/test TypeScript PASS on final source. Targeted ESLint
  (zero warnings), Prettier, UTF-8 without BOM/LF, exact eight-path scope,
  secret-pattern/source review and diff whitespace checks PASS. Database Design
  additions preserve the complete earlier document prefix; all earlier feature
  history/status sections and F041 NOT_STARTED remain unchanged. Git index empty.
- The first sandbox tsx invocation stopped before assertions with ERR_SYSTEM_ERROR,
  uv_os_get_passwd/ENOMEM (wrapper file failure, zero assertions executed). The
  authorized ordinary-user execution outside that sandbox passed. Initial npm/npx
  PowerShell wrappers were blocked by existing execution policy; installed Node
  CLI tools were used without policy/configuration changes. Initial focused 43/43
  passed; two unused test parameter lint errors were corrected in this same test
  file. Historical attempts are retained here, not relabeled as passing runs.

### Separate source/security review - PASS after in-scope resolution

Reviewed all eight paths, native read filters/index requirements and installed
driver/Mongoose session behavior separately from test execution. Resolved items:

- MEDIUM: live admission allowance must be rechecked for each enrichment after
  origin validation; a child result at/after ten seconds cannot be accepted merely
  because the outer 30-second budget remains. Resolved in dashboard.service.ts
  at the per-item origin/admission/elapsed-proof guards (lines 82-89), with guards
  for late results, origin-check time and concurrent admission.
- MEDIUM: account eligibility must be checked again after the final source reads,
  not only before them. Resolved in dashboard.repository.ts at the final actor
  check (line 426); focused disablement-during-final-reads test PASS.
- LOW: avoid a possible Mongoose connection-buffer wait before the transaction's
  client-side timeout begins. dashboard.repository.ts now checks connected state
  and creates the same native ClientSession synchronously from the retained
  configured client (lines 176-185). Disconnected native-session refusal PASS
  without database access. This changes no shared helper or connection policy.

Final unresolved findings: Critical **0**, High **0**, Medium **0**, Low **0**.
No new dependency, model/index/route/configuration, public authority, grading or
persistence change. Final DTO excludes internal bindings, tokens and answers;
all admitted enrichments settle, uncertain outcomes remain refusal, and ordinary
absence cannot be inferred from an ambiguous classifier error. No automatic
dashboard callback replay or mutation was introduced.

Historical offline-gate outcome: Slice 1 was READY_FOR_REVIEW; F040 stayed
IN_PROGRESS. The next gate at that time was owner Slice 1
acceptance and separately approved local Git checkpoint. Slice 2 remains
NOT_STARTED; no controller, app composition, API canonical amendment or guarded
integration adapter/execution is authorized by this offline result.

No MongoDB/browser execution; offline adapters are not live authority evidence.
Existing 153 browser scenarios NOT_RUN; zero new F040 cases; no exception transfers.
Production readiness NOT_VERIFIED. Real failover, multi-process behavior,
enrollment, persistent provisioning/migrations, privacy/retention/erasure/backups,
operational security and full browser/release acceptance remain separately gated.

## 8. Owner Slice 1 acceptance and scoped local checkpoint - 2026-10-22

The owner explicitly accepted Slice 1 for LOCAL DEVELOPMENT ONLY, conditional on
clean Git/scope preflight, and authorized one local commit with exactly the eight
Slice 1 paths in Section 6. Preflight PASS: dev branch; approved origin
https://github.com/Ashish1303/DeepLearner.git; local HEAD and local tracking dev
both 5f1b043fbb93eb3b56b491f164f25b6cfff37612; zero ahead/behind; empty index;
exact six creations/two modifications; no unexpected nonignored files, secrets
or generated/disposable data; UTF-8/LF and diff whitespace checks PASS. No remote
contact was made or fresh server-HEAD verification claimed. Ignored .cache
launchers/diagnostics remain excluded. Only sample hooks were present.

ACCEPTED_LOCAL is a slice-specific owner-acceptance annotation, not a new feature
completion status. F040 remains IN_PROGRESS; Slice 2 remains NOT_STARTED; F001-F039
remain APPROVED_COMPLETE for local development. The earlier READY_FOR_REVIEW and
no-Git notes record the implementation gate and are superseded only for this
explicitly approved local checkpoint. Retain 51 focused/209 regression/260 distinct
PASS and the zero-unresolved review; no passing tests were rerun in this gate.

Authorized commit message: feat(progress): add F040 dashboard internal reader.
Preserve both F039 commits without amendment or history rewriting. The checkpoint
identity is recorded by Git and the delivery report; no self-referential commit
hash or follow-up documentation commit is required. Inspect the exact staged
inventory, complete staged diff and cached whitespace checks before committing.
No push, Slice 2 implementation, public endpoint, feature completion, MongoDB/
browser execution, index/migration, dependency/infrastructure or F041 approval.
All 153 browser scenarios remain NOT_RUN; production readiness NOT_VERIFIED.
The next gate is separate owner approval for Slice 2; remote delivery and full
feature acceptance remain independently gated.

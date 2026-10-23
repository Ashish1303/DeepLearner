# F040 - Dashboard API

**Status:** APPROVED_COMPLETE - LOCAL DEVELOPMENT ONLY
**Dependencies:** F037/F039, APPROVED_COMPLETE locally.
**Authorization:** Owner-approved detailed contract and eight-path Slice 1
implementation/offline verification, 2026-10-22; subsequent owner Slice 1 local
acceptance and single local checkpoint approval are recorded in Section 8.
Later Slice 2 and standing verification approvals are recorded in Section 9.
**Slice 1:** ACCEPTED_LOCAL - explicit owner acceptance; offline verification PASS.
**Slice 2:** Owner accepted for LOCAL DEVELOPMENT ONLY; offline and authenticated
disposable integration PASS.
**Current gate:** Explicit owner final completion approval, 2026-10-23; see
Section 13. Git staging, commit and push remain unauthorized. Production
readiness remains NOT_VERIFIED.
Historical direct-console and managed foreground refusals remain in Sections 10-11.

## 1. Objective and exclusions

Sources inspected: AGENTS.md; PRD Sections 12/26; SYSTEM_ARCHITECTURE layering;
roadmap F040/F041; API_DESIGN F037/F039; DATABASE_DESIGN's approved progress/
completion/mastery refinements; F037/F039 plans and existing Auth/publication code.
Deliver an internal reader and LOCAL authenticated GET for owned saved Concept
practice activity and current F039 classification. This is a bounded PRD subset,
not the full dashboard.
Exclude F041/UI, Admin impersonation, active-path selection, recency/resume or
Topic recommendations, path percentages, study time, bookmarks/notifications,
XP/streak/badges, scoring, completion changes, stored mastery, repair/backfill,
migrations, provisioning, dependencies and production enrollment.

## 2. Slice 2 HTTP contract - implemented; verification evidence in Section 12

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

Route rate limits: 100/IP/15 minutes before authentication, then 20/current
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

Slice 2 CREATE:
9. apps/api/src/modules/progress/dashboard.controller.ts
10. apps/api/src/modules/progress/dashboard.routes.ts
11. apps/api/src/modules/progress/dashboard-rate-limit.ts
12. apps/api/tests/dashboard-routes.test.ts
13. apps/api/tests/dashboard.integration.ts

Slice 2 MODIFY:
14. apps/api/src/app.ts
15. docs/API_DESIGN.md
Also update the shared feature plan/roadmap. Total proposed unique inventory:
15 paths, 11 creations/four modifications. Other feature paths remain excluded.

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

## 9. Slice 2 verification and standing-approval review - 2026-10-23

The owner subsequently approved the Slice 2 implementation, temporary guarded
adapter, bounded managed-launch corrections and continued verification through
final review. These later approvals supersede the earlier NOT_STARTED and
future-approval statements as current gates; the historical decisions/results
above remain intact. Slice 1 checkpoint
`1971903e79ebd0e6dbc2494a34515e882ab9ef1c` is unchanged. F040 remains IN_PROGRESS;
Slice 1 is ACCEPTED_LOCAL and Slice 2 is READY_FOR_REVIEW **offline only**.
No feature acceptance, staging, commit or push is authorized by this evidence.

### 9.1 Implementation inventory and current offline evidence

The seven remaining implementation/API-document paths are Section 6 paths 9-15:
three HTTP modules, the route test, the prepared integration suite, app composition
and the additive API Design amendment. This gate additionally updates this feature
plan and the F040 roadmap section, giving nine outstanding repository paths.
No Slice 1 source, Auth, F037/F039 implementation, fixture, dependency, index,
native helper or temporary launcher is changed in this review gate.

- Selected offline execution: **301/301 PASS**, zero failures, cancellations or
  skips: **92 Dashboard tests** (51 internal-reader and 41 HTTP/limiter/preparation)
  plus **209 relevant API regressions**. The selected files cover mastery,
  mastery-policy, access-token, completion-grading, completion-evidence,
  completion, practice-attempt-repository, progress, progress-routes and
  practice-grading. Repeats are not added to the distinct count.
- The first sandbox execution encountered loopback `EACCES` connection refusals
  in Dashboard and existing Progress HTTP fixtures. The same selected suite
  passed outside that sandbox under the ordinary user. The failed execution is
  retained as an environment limitation, not relabeled as application PASS.
- API build, source/test TypeScript and targeted ESLint (zero warnings) PASS.
  Targeted source/test Prettier, strict UTF-8 without BOM/LF and whitespace/scope
  checks PASS. Documentation is excluded by the existing Prettier configuration;
  its encoding, whitespace and targeted historical-scope checks PASS separately.
  Node parsing and PowerShell AST parsing of the unchanged F040 adapter files
  PASS without executing their guarded entrypoints or private-input code.
  The integration source is compiled and its inert manifest import is tested;
  **its exported integration function is not executed**.
- HTTP tests verify authentication/refusal, server-derived self-only identity,
  current-account refusal through trusted offline adapters, canonical pagination,
  strict DTOs, all permitted classification outputs, no-store success and early
  errors, body/method refusal, rate-limit isolation/capacity/expiry and sanitized
  errors. These are offline HTTP/unit proofs, not genuine database/login evidence.

### 9.2 Retained guarded failures and managed-controller corrections

Preserve the original evidence directories, including:

- `.cache/f040-slice2-run-3b7db23df7964325b20fa15908367c6c`: private-entry
  refusal with insufficient detail; no MongoDB integration.
- `.cache/f040-slice2-run-3c606af0f2ae46fab4639fe3ebac0623`: earlier readiness
  refusal before private entry; exact operation was initially UNKNOWN.
- `.cache/f040-slice2-run-794db75748b74471ab418163a42dea60/result.json`:
  last completed FIXTURE_PROCESS_CHECK; entered SOURCE_PIN_ENUMERATION and
  refused COMMAND_UNAVAILABLE. Fixture-host and suite invocations are both zero;
  counts are **0 PASS / 0 FAIL / 9 NOT_RUN**, not authenticated suite acceptance.
  Storage/port absence is recorded. No initialized protected baseline, owned Job,
  retained MongoDB handles, RESULT or ACK was established. False/unset later-phase
  fields must not be interpreted as completed protected-baseline verification.

Subsequent approved diagnostics preserved one-attempt markers and corrected only
in-memory management: exact child-only competing-ripgrep PATH filtering, verified
registered PowerShell selection instead of a removed version-specific path,
early typed process/console identity capture, and literal one-placeholder
controller insertion. The OS error 206 construction defect was duplicated script
content caused by JavaScript replacement-string expansion; literal insertion and
full serialized command/environment size guards replaced that construction.
Retained transport checks are 12 construction, 28 controller-probe, 11 dispatch
and nine preservation checks PASS. The measured managed command had only 38
characters of headroom below its 32,000-character guard; a future request must
recompute its complete size and refuse overflow rather than reuse that measurement.
These prior diagnostics are retained evidence, not newly rerun integration.

For historical diagnostic PID 13684 the owner accepted recorded exit 1, handle
disposal, no runner/Job/MongoDB child and no currently observed matching resources.
Historical window disposal remains UNKNOWN; do not retrospectively call it PASS.
The current gate creates no managed console or diagnostic child and does not
change that historical outcome.

### 9.3 Independent source/security review and live-integration blocker

A separate source/diff review after test execution inspected the HTTP boundary,
limiter, app composition, complete reader/repository and prepared integration,
plus reused Auth, F037 publication/activity and F039 proof contracts. Unresolved
findings: Critical **0**, High **0**, Medium **0**, Low **0**. No application
correction was needed. This is a separate review phase, not a claim of review by
a second human or independent agent. Canonical changes remain additive.

Observed controls: LOCAL-only mount; authenticated Student identity; current
ACTIVE/verified account and full published ancestry revalidation; exact DTO
allowlisting; no caller score/identity authority; bounded scans, phases and
limiter storage; final deadline/authorization refusal; no cached classification,
answer/private-rubric disclosure, mastery persistence or GET repair/mutation.
Snapshot/majority and nonmutation behavior still require the guarded live gate.

The unchanged `Read-F040SupervisedCredentials` requires three human-entered
hidden console values within its existing five-minute allowance. Secure unattended
entry is unavailable. Per the owner's standing stop condition, this execution
path stops **before a prompt or runner invocation**. No credentials are collected
or substituted, no MongoDB/fixture is started and no invocation allowance is used.
Current live integration is **0 PASS / 0 FAIL / 9 NOT_RUN**; authenticated terminal
counters and matching digest ACK are **NOT_RUN**, never inferred from offline PASS.
New owned-Job/storage cleanup and protected-baseline comparison are not applicable
to an integration that did not start; no fresh live-baseline PASS is claimed.

The prepared gate must still verify 19 disposable collections (11 represented by
the index manifest plus eight explicit fixture collections), 21 canonical indexes,
exact retained native handle/Job/CIM identity, PRIMARY before enumeration and an
empty exclusive target. Preserve the nine-record PARENT/T01-T08 manifest,
180-second suite/205-second supervisor limits, original RPC/ACK/heartbeat and
cleanup deadlines, fatal-loss latch and authenticated RESULT digest ACK. No test
assertion, timeout, private-input or source-pin condition is relaxed.

Next live gate requires owner availability for foreground activation and the
existing masked entries, plus fresh process/readiness/isolation checks; do not
automatically run or retry. After authenticated 9/9 PASS and verified cleanup,
complete the bounded final acceptance review. Owner completion and scoped Git
delivery remain separate decisions. All **153 browser scenarios remain NOT_RUN**;
zero added by F040. Real failover, multi-process behavior, production enrollment,
persistent provisioning/migrations, privacy/retention/erasure/backups, operational
security and full browser/release acceptance remain unverified release gates.
Production readiness is **NOT_VERIFIED**.

## 10. Owner-present managed verification - foreground gate blocked

On 2026-10-23 the owner approved final integration preparation, one conditional
guarded invocation, minimal human activation/hidden entry, final review and
evidence documentation. No Git writes were approved. This is a later gate than
Section 9's unattended-input stop, not a rewrite of that historical outcome.

### 10.1 Confirmed preparation and refusal

- Existing dev HEAD remains Slice 1 checkpoint
  `1971903e79ebd0e6dbc2494a34515e882ab9ef1c`. Exactly nine expected pending
  repository paths and an empty index were confirmed before preparation.
- Literal controller composition and duplicate-content guards PASS. The full
  serialized request measured 31,962 characters against the existing 32,000 guard;
  no EncodedCommand or wrapper file was introduced. The controller executed, so
  this attempt did not reproduce OS error 206.
- Registered, signed Microsoft PowerShell x64 was selected at runtime, package
  7.6.8.0/file 7.6.8.500, executable SHA-256
  `B90C0F48CA4B13C9426A7863F3D469BAF310CA517721DD0B55551B80EC9FEE2A`.
  Fresh child PID **20008**, retained native UTC ticks **639283413398129319**,
  console HWND **264448**, reported window owner PID **20008**. Retained-handle,
  native/CIM microsecond identity, exact parent, current owner, unelevated context,
  console attachment, nonredirected streams, marker absence, visible window,
  signed host and interactive-desktop checks PASS.
- Approved ripgrep hash and single resolution, child-only PATH filtering,
  essential tool identity, **529 source pins** and clear disposable process,
  port and storage preflight PASS. Parent PATH was unchanged.
- Controller events were exactly CONSOLE, SETUP_START, PREPARED. The owner
  acknowledged activation through chat. Nevertheless, the controller's native
  foreground check remained **false** during its bounded activation wait.
  It stopped at that precondition; acknowledgement or visibility was not promoted
  to verified focus. No focus injection, keystroke simulation or bypass occurred.

Confirmed blocker: the captured HWND was not established as foreground by the
controller. Why the reported human activation did not satisfy that exact check
remains **INCONCLUSIVE**; this evidence does not establish a Windows focus-policy,
host-window mapping or application defect. The generic sanitized exception
category was NATIVE_CAUSE_UNKNOWN with no native error code; it is not evidence
that Process.Start failed, since native process identity/preparation succeeded.

### 10.2 No integration invocation; verified diagnostic disposal

Runner invocations **0**; private entry **NOT_REACHED**; MongoDB and fixture host
**NOT_RUN**. No new guarded-run directory/result.json was created. Counters remain
**0 PASS / 0 FAIL / 9 NOT_RUN** as nonexecution evidence; authenticated RESULT,
digest ACK, PRIMARY, empty target and 19-collection/21-index provisioning were
**NOT_RUN**. No credential was requested through chat or entered by automation.

The managed child exited **1**; controller/tool exited **0** after returning its
blocked summary, which is not integration success. No forced cleanup occurred.
The management pipe, child/host observation handles and parent observation handle
were disposed; child exit and captured-window disposal were observed. A final
read-only inspection confirmed PID 20008 absent, target ports 27018/4000 free,
no matching disposable MongoDB or fixture host and no disposable storage.
No integration Job or database resource was created. Protected database/demo
baseline capture/comparison was **NOT_REACHED**, not retrospectively PASS.
The historical PID 13684 window-disposal UNKNOWN remains unchanged.

### 10.3 Review, evidence and next gate

No application, fixture, temporary adapter, test assertion, timeout or security
rule was changed. A separate source/security review of current composition,
HTTP boundary, limiter, service finalization and prepared lifecycle found no new
source finding; retained unresolved Critical/High/Medium/Low findings are **0**.
The managed focus prerequisite is an outstanding execution blocker, not evidence
of an application security defect. Final live acceptance is blocked.

The **301/301 offline PASS** (92 Dashboard + 209 regressions), build, TypeScript,
lint, formatting and earlier scope/security evidence are retained; passing suites
were not rerun in this gate. This gate changes only this feature plan and the
F040 roadmap notes, followed by encoding, whitespace and exact-scope checks.
Historical failures, including the earlier sandbox loopback refusal, remain.

No retry or alternate execution was attempted. Before any further invocation,
the smallest next decision is bounded reconciliation of the captured console HWND
against the actual foreground window/console host, using nonsecret observation
and preserving exact ownership and focus refusal. Do not assume that requesting
activation again fixes the mapping; any changed focus method or additional
managed attempt must be explicitly justified and owner-authorized. No new console,
input prompt, runner or integration is started by documenting this recommendation.

F040 remains **IN_PROGRESS**, Slice 1 **ACCEPTED_LOCAL**, Slice 2
**READY_FOR_REVIEW - offline only**; not READY_FOR_FINAL_ACCEPTANCE. F001-F039
remain approved locally and F041 remains NOT_STARTED. All **153 browser scenarios
remain NOT_RUN**; production readiness **NOT_VERIFIED**. No staging, commit,
push or history operation occurred. Stop after this blocked verification report.

## 11. Direct-console preparation and owner-reported refusal - 2026-10-23

The owner ended further managed Windows Terminal active-pane investigations and
approved the existing directly operated, interactive PowerShell workflow. The
subsequent final-verification gate permits one guarded invocation only after
readiness, masked entry and isolation checks; no staging, commit or push.

Read-only preparation PASS: dev; unchanged Slice 1 checkpoint; exactly the nine
expected pending paths; empty index; signed registered PowerShell 7.6.8 and its
approved executable hash; approved ripgrep hash; 516 repository paths plus 13
temporary pins, with configuration-independent enumeration agreement. Target
ports were free, and no matching disposable storage, MongoDB, fixture host or
concurrent guarded controller was observed. The direct command was parsed and
checked for one exact `Invoke-F040GuardedRun -ApprovedGuardedExecution` call,
no wrapper function or marker reset, and process-local PATH restoration in
`finally`. It was not executed through a redirected Codex subprocess.

After clarification, the owner reported opening PowerShell and supplied this
final nonsecret line from the single pasted command:

`F040 STOP at CONSOLE. No retry; report this stage only.`

The CONSOLE stage precedes executable setup and dot-sourcing/invoking the runner.
It covers repository entry, PowerShell 7, consumed PID/marker absence, all three
nonredirected streams and unelevated execution. **Which operation or condition
refused is UNKNOWN.** Do not infer elevation, wrong PowerShell version, session
reuse, credential error or an application defect from this aggregate stage.
The earlier initial "Finished" acknowledgement did not establish execution;
subsequent owner clarification and the explicit STOP line establish this outcome.

Final read-only observation: no new guarded-run directory or result.json. The
newest retained runner evidence is still
`.cache/f040-slice2-run-794db75748b74471ab418163a42dea60/result.json` from October 22;
its COMMAND_UNAVAILABLE category is historical and is not this refusal's cause.
Runner/fixture/suite invocation is not established for this gate; integration
remains **0 PASS / 0 FAIL / 9 NOT_RUN**, with no authenticated RESULT/digest ACK.
Private entry, PRIMARY/empty-target verification and 19-collection/21-index
provisioning were NOT_REACHED/NOT_RUN.

Ports 27018/4000 remained free; matching disposable MongoDB/fixture processes and
storage remained absent. No new owned Job or handles were established by the
runner, no process was terminated and no forced cleanup occurred. Protected
database/demo/environment baseline capture and comparison were NOT_REACHED;
resource absence is not a substitute for those live acceptance checks. The
command's finalizer restores its original process PATH; this source property is
not a separately observed owner-environment baseline result.

No application, test, launcher, assertion, source-pin rule, deadline or input
requirement changed. Retain 301/301 offline PASS and the separate source/security
review's zero unresolved Critical/High/Medium/Low findings. No new application
defect or test inconsistency was established, so passing suites were not rerun.
The final integration-dependent acceptance review remains blocked. This gate
updates only this feature plan and F040 roadmap evidence, preserving all failures.

STOP without retry. Next action: a bounded read-only observation identifying the
failed direct-console prerequisite; do not relax it or reset a marker. Resolve
that specific prerequisite before any separately justified/authorized invocation.
F040 remains IN_PROGRESS; Slice 1 ACCEPTED_LOCAL; Slice 2 READY_FOR_REVIEW -
offline only. F001-F039 remain approved locally, F041 NOT_STARTED, all 153 browser
scenarios NOT_RUN and production readiness NOT_VERIFIED. Git index stays empty;
no staging, commit, push or history rewrite occurred.

## 12. Single guarded integration and final acceptance review - 2026-10-23

### 12.1 Resolved console prerequisite; one new owner-approved invocation

Later read-only checks in the refused console established PowerShell7 FAIL;
the other reported console prerequisites passed without evaluation errors.
This resolves Section 11's initially UNKNOWN console prerequisite without
rewriting that earlier evidence. No marker was cleared or safeguard relaxed.
The owner subsequently opened the registered Microsoft PowerShell application.
Verified console PID 6128, creation 2026-10-23T09:38:04.0462096Z, PowerShell 7.6.8,
registered executable/signature/hash, retained-handle/CIM identity, unelevated
context, nonredirected streams, absent global/script markers and repository
access passed. The separate explicit approval authorized one invocation in this
existing console, not another managed-window investigation or retry.

The approved ripgrep executable retained SHA-256
`14231169855EC5205CF5A1B6F1DB358FF4AED4247C86B69CE8AAE647C77F6680`.
Process-local resolution and all 529 source pins passed before execution.
Private entry occurred exclusively through the existing hidden local prompts;
no private values were retrieved, logged or supplied through chat or automation.
Readiness evidence is VALID, last completed PRIVATE_INPUT_ENTRY, with no refusal.
The unused FailureCategory default UNVERIFIABLE is not a failed check when
RefusalStage and FailurePosition are NONE.

### 12.2 Authenticated integration evidence

Evidence directory:
`.cache/f040-slice2-run-8ce1152dc6354332a557c42c7e374247`.
Its sanitized `result.json` records one fixture-host invocation and one suite
invocation, Integration PASS, CountsStatus VERIFIED and **9 PASS / 0 FAIL /
0 NOT_RUN**. No invocation retry occurred.

| Record | Verified boundary | Result |
| --- | --- | --- |
| PARENT | Full suite and fixture resource cleanup | PASS |
| T01 | Genuine Student/independent Admin login and empty dashboard | PASS |
| T02 | Original qualifying submission, owned F037 activity and F039 STRONG | PASS |
| T03 | Concurrent GETs, exclusive cursor, strict DTO and learner-data nonmutation | PASS |
| T04 | Anonymous/Admin/client identity override refusal and no-store | PASS |
| T05 | Current inactive/unverified Student refusal | PASS |
| T06 | Unpublished ancestry omission without hidden Concept disclosure | PASS |
| T07 | Genuine read.summary revision change and stale UNCLASSIFIED result | PASS |
| T08 | Lost database connection returns sanitized 503, never cached authority | PASS |

Preflight PASS includes ordinary unelevated execution, exact retained native
process handle/Job/CIM ownership with UTC microsecond comparison, free ports,
exclusive disposable target, writable PRIMARY before enumeration and empty
target verification. Approved target remains 127.0.0.1:27018, replica set
f021-test, database deeplearner-f021-test. Only the approved definitions were
provisioned: 21 canonical indexes across 11 indexed collections plus eight
explicit empty fixture collections, **19 collections total**. The result's
Collections=8_VERIFIED refers to the eight explicit additions; Indexes=21_VERIFIED
and the approved index manifest account for the other 11. No persistent
provisioning, new definition or production database write occurred.

### 12.3 RESULT/ACK and terminal lifecycle

The supervisor authenticated the exact nine-record manifest/counters and
recorded TerminalAck.ResultValidated=true. The owned host recorded RESULT_SEND
PASS and then RESULT_RECEIPT_ACK PASS. Its unchanged validator requires the
matching nonce/generation/digest, exact ACK fields, AWAITING_ACK phase and live
deadlines before acknowledging; local write completion is insufficient.
The parent's send-observation AuthenticatedDelivery fields remain **UNKNOWN**,
with HostReceiptSource=OWNED_HOST_DIAGNOSTIC_ONLY. Preserve that distinction:
host receipt is corroborated by the owned-host diagnostic, verified ACK control
flow and normal finalization, not by claiming a parent-side delivery receipt.

Last ownership RPC 23 passed exact host/resource identity and Job checks; the
host recorded its validated OWNED PASS reply and no pending RPCs at disposal.
After matching ACK and exit-status finalization, the host deliberately disposed
the channel. Later AUTHORITY_INVALIDATED/INPUT_CLOSED/INPUT_AFTER_RESULT FAIL
diagnostic labels correspond to SUPERVISOR_LOSS reason DISPOSED, pending=[],
callbacksInvoked=0 and callbackErrors=0. They are preserved, not suppressed;
this is intentional terminal invalidation, not premature fatal loss. The fatal
listener remains active until successful terminal finalization. Earlier or
genuine ownership/channel loss still irreversibly refuses success.

The 180-second suite cap, 205-second supervisor envelope, existing five-second
RPC/ACK, two-second heartbeat, transaction reserves and cleanup deadlines were
unchanged. This successful run is not forced-deadline or failover verification.

### 12.4 Cleanup, duration and retained verification

All observable exits were 0: supervised-fixture, initialization,
collection-preparation, shutdown and mongod. Forced=false, CleanupErrors=[],
JobEmpty=true, HandlesClosed=true, StorageRemoved=true and PortReleased=true.
ProtectedUnchanged, ParentEnvironmentUnchanged and SourcesUnchanged are true.
Protected-before/after and source-pin-before/after files match byte-for-byte;
all 529 retained source pins also matched current files before this documentation
update. Final independent read-only observation confirmed ports 27018/4000 free,
no matching disposable MongoDB/fixture processes and no disposable storage.
The owner's ordinary console was not terminated.

Runner interval: 2026-10-23T09:46:50.2142671Z through
2026-10-23T09:48:04.0534060Z, **73.839 seconds**, including private entry,
preflight, integration and cleanup. Review estimate 15-35 minutes; the full
preparation/evidence/review duration is reported separately to the owner.

Retain **301/301 offline PASS** (92 Dashboard + 209 relevant regressions), API
build, source/test TypeScript, targeted lint/formatting and prior security/static
evidence. No passing test/build suite was unnecessarily rerun in this gate.
Historical blocked runs, test attempts, corrections and their UNKNOWN fields
remain intact. Only approved F040 documentation changes after this run; encoding,
whitespace, exact scope, checkpoint and empty-index checks follow the update.

### 12.5 Independent final source/security/architecture review

A separate final review phase inspected the complete Slice 2 diff, accepted
reader/DTO/schema, F037/F039 authority and read dependencies, integration
assertions and authenticated supervisor lifecycle. **Critical 0 / High 0 /
Medium 0 / Low 0 unresolved findings.** No application/test/launcher correction
was required. This is a source review, not an additional test execution or a
claim of a separate human reviewer.

Verified contracts: server-derived self-only ACTIVE/verified STUDENT; current
published ancestry; original owned F038 assessment with policy/rubric/revision
and majority proof; strict query/DTO allowlists; bounded pagination/read and
deadline refusal; sanitized errors; no-store including early HTTP errors;
bounded IP/Student rate limiting; no numeric score/private answer/rubric leakage;
and no dashboard progress/completion/mastery mutation. Existing Auth, F036/F037/
F038/F039 behavior and Slice 1 checkpoint remain unchanged. API amendments are
additive; database design and existing index definitions are unchanged in Slice 2.

**READY_FOR_FINAL_ACCEPTANCE**, for LOCAL DEVELOPMENT ONLY. F040 remains
**IN_PROGRESS**; Slice 1 ACCEPTED_LOCAL; Slice 2 READY_FOR_REVIEW with verified
offline/integration evidence. F001-F039 remain approved locally; F041 NOT_STARTED.
Next gate is explicit owner final acceptance and separate scoped Git delivery.
No staging, commit, push, remote operation or history rewrite occurred.

Limitations: intermediate IMPROVING scores remain offline-only; this live suite
does not exercise every classification/refusal, rate-limit saturation or deadline
branch. No mastery persistence or F041 UI; LOCAL synthetic-origin qualification
is not general production enrollment. Real failover, multi-process convergence,
persistent provisioning/migrations, privacy/retention/erasure/backups, operational
security and full browser/release acceptance remain separately gated. All
**153 browser scenarios remain NOT_RUN**, zero added by F040; no exception
transfers automatically. Production readiness remains **NOT_VERIFIED**.

## 13. Owner final local-development acceptance - 2026-10-23

The owner explicitly approved **F040 - Dashboard API as APPROVED_COMPLETE for
LOCAL DEVELOPMENT ONLY**, authorizing status/documentation reconciliation only.
This supersedes the pending-acceptance status at the end of Section 12; all
historical failures, blocked gates, corrections and limitations remain intact.
Slice 1 remains ACCEPTED_LOCAL at checkpoint
`1971903e79ebd0e6dbc2494a34515e882ab9ef1c`; Slice 2 is accepted within its exact
approved API scope. No contract, application, test, launcher or dependency change
is part of this status gate.

Retained acceptance evidence: **301 offline tests PASS**; authenticated MongoDB
**9 PASS / 0 FAIL / 0 NOT_RUN** from the single run identified in Section 12;
RESULT validation and matching host digest ACK PASS. Parent delivery-observation
fields remain **UNKNOWN** and are not promoted to receipt evidence. The approved
19 disposable collections and 21 canonical indexes, isolation, graceful cleanup
and unchanged protected baselines are retained as verified. Final review has
**zero unresolved Critical/High/Medium/Low findings**. Passing suites were not
rerun for this documentation-only reconciliation.

All **153 browser scenarios remain NOT_RUN**; F040 adds zero. Intermediate
IMPROVING scores remain offline-only. LOCAL synthetic-origin qualification does
not establish general production enrollment. No mastery persistence or F041 UI.
Real failover, multi-process behavior, persistent index/migration provisioning,
privacy/retention/erasure/backups, operational/release security and full browser
acceptance remain separately gated. Production readiness is **NOT_VERIFIED**.
No previous browser exception transfers automatically; local acceptance is not
production release approval.

Only this feature plan and the F040 roadmap status are updated in this gate.
F001-F039 remain APPROVED_COMPLETE locally; F041 remains NOT_STARTED and is not
authorized. Exactly nine approved F040 paths remain pending, the Git index is
empty and the Slice 1 checkpoint is unchanged. UTF-8/LF and diff/scope checks
follow this update. No staging, commit, push, amend, rebase or history rewrite;
all existing changes remain uncommitted. Any Git delivery needs separate explicit
owner approval. Stop after status verification; do not begin F041.

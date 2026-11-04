# F044 browser backlog execution — 4 November 2026

## Scope and isolation

Owner authorization covers ownership-safe browser execution, necessary runner,
test and confirmed application corrections, and a QA-branch PR into `dev`.

- Starting fetched `origin/dev`: `d0a2e5a81023f613aa37a796c2df815446853178`.
- Worktree: `E:\AI\DeepLearner-qa-f044-browser-backlog`.
- Branch: `qa/f044-browser-backlog`.
- Original checkout: `E:\AI\DeepLearner`; its uncommitted C2 documentation was
  preserved. No stash, reset, clean, source copy, or development-resource action
  was used there.
- During QA, parallel development advanced `origin/dev` to
  `594a9bc9b6c150ef7cd6faa7d82ef3c62c3aa5bc`. Those API/C2/documentation changes
  have no overlapping QA paths and were excluded from this branch.

F044 remains **IN_PROGRESS**. F042/F043 acceptance remains **BLOCKED**. The nine
guarded F044 database integration records retain their existing **NOT_RUN**
status. Production readiness remains **NOT_VERIFIED**.

## Execution qualification

The original primary-host blocker was unqualified process-tree teardown. The
guarded command reuses `LocalProcessOwner.cs`; its native implementation is
unchanged. Windows atomically places each new process in its retained Job.
Retained and independent handles establish process identity, creation time,
image and Job membership. Existing or unknown listeners are refused.

The browser/server Job and each Playwright CLI/worker Job have separate
lifetimes. A file completes only after its CLI exits and its entire worker Job
is empty. Assertion failures retain their exit code and can allow independent
files to continue after verified cleanup. Lifecycle failures stop execution;
forced containment is limited to the owned Job and is recorded as failure.
Final success additionally requires browser exit 0, empty browser/server Job,
closed handles, released ports and released temporary power requests.

Playwright 1.64.0's installed `killProcessTree` Windows fallback invokes
`taskkill /T /F`. A reproducible, exact-version/exact-hash QA-local dependency
patch makes that function refuse with `QA_OWNED_JOB_CLEANUP_REQUIRED`. The actual
installed exported function is exercised as a negative control inside an owned
Job. There is no positive PID-tree kill implementation. Dependency versions and
the lockfile are unchanged; the original checkout's dependencies are untouched.

Every suite connects to the newly owned Chrome through a short-lived source-pin
lease. Full native listener identity checks continue during execution; the
two-second proof limit is unchanged. Windows IP Helper's read-only
`GetExtendedTcpTable` replaces slow CIM listener polling. A live comparison
matched all four QA listener rows (native 19 ms, CIM 5,258 ms).

Closure consumes an exact nonce/PID/creation-time intent and blocks new leases.
During its existing ten-second close window, retained exit state and native Job
membership avoid image-metadata queries that can fail while Chrome exits.
Foreign listeners, unknown live membership, nonzero exits and missing cleanup
proof remain failures.

### Network boundary

Actual QA listeners are Student `127.0.0.1:3101`, Admin `127.0.0.1:5181`,
deny proxy/canary `127.0.0.1:4101`, and CDP `127.0.0.1:9281`.

The logical mocked API URL is `http://127.0.0.1:4000`, preserving the existing
Admin client's production allowlist. The runner starts no API on that port.
Chrome's fixed proxy removes implicit loopback bypass and permits direct
connections only to the two QA application origins. The canary never forwards
requests. Qualification requires the exact logical API probe to return through
server address `127.0.0.1:4101`. Unexpected API traffic, altered probes or direct
probe traffic fail the counters. All application API responses are synthetic;
UI HTML and assets come from the actual built Next/Vite applications.

Fresh headless profiles and contexts contain synthetic test data only. No
private development credentials, owner Chrome sessions, screenshots, video or
traces are used. There are no MongoDB connections, provisioning or fixture
writes. VS Code development listeners and persistent data are not adopted.

### Host availability

An exploratory run encountered Kernel-Power Modern Standby entry at
`11:33:40.377 UTC` and exit at `11:42:04.789 UTC`. The affected Revise case began
at `11:33:48.256 UTC` and recorded 497,577 ms despite a 45-second limit. That
interrupted run is retained as failure; its incomplete results are not PASS.

The guarded runner now requires AC power and holds temporary process-owned
system/execution power requests during the bounded invocation. All acquired
scope waits check AC availability. Cleanup clears and closes the request even
if process disposal throws. This changes no power plan, display setting, ACL or
permission. Explicit user sleep still takes precedence. Existing per-case and
action deadlines are preserved. Backlog files run in bounded 600-second
invocations with zero retries; those bounds were not raised after failures.

The earlier 246,146 ms F038 interruption also aligns with Modern Standby entry
at `10:25:42.705 UTC` and exit at `10:29:53.777 UTC`. Sanitized event timestamps
are retained in `.cache/browser-backlog/modern-standby-events.json`.
See Microsoft's [PowerSetRequest contract](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-powersetrequest)
for the AC/Modern Standby and explicit-user-sleep limits.

## Corrections

- **Application defect:** `App` unmounted `AdminAccess` while authorized, losing
  the component's focus history. Parent-owned history now returns keyboard focus
  to the sign-in heading after settled, visible access loss. Authentication,
  authorization, token handling and backend behavior are unchanged.
- **Missing fixture:** three Technology cases did not request the nonautomatic
  fixture. Making it automatic installs strict synthetic routes for every case;
  unexpected-request teardown assertions remain active.
- **Readiness race:** Technology fault injection now waits for the initial exact
  inventory response to finish and Refresh to become enabled.
- **Stale fixtures:** older Concept suites now model the later progress,
  completion and exact Dashboard `limit=5` reads separately from public catalog
  credential assertions. Neutral responses grant no completion or earned data.
  Wrong roles, invalid sessions, wrong requests, cookies and writes are refused.
- **Stale assertions:** keyboard tests traverse all current controls, fieldset
  tests verify its disabled attribute and all three native controls, and status
  selectors distinguish the notification rail from inventory status. Empty
  drafts expose disabled Submit controls with no revealed answers or writes.
- **Cleanup ownership:** CDP disconnect assertions remain in the worker; actual
  process exit is established by the native guardian rather than PID-only
  existence polls after disconnecting an externally owned browser.
- A checked visualization-step lookup resolves strict browser-test typing
  without casts or relaxed compiler settings.
- **Native scroll synchronization:** the first complete run recorded one tablet
  failure after the test issued a different-axis key following only first-pixel
  movement. The test now awaits real native `scrollend` between keys, retains all
  movement/focus/overflow assertions, and records bounded numeric diagnostics.
  No scroll position is set programmatically. The original failure remains
  `FLAKY_HISTORY: 1`; its exact Chrome-internal cause was not established. The
  affected seven-case suite passed with the correction. Chrome documents
  [scrollend as animation and gesture completion](https://developer.chrome.com/blog/scrollend-a-new-javascript-event).

## Discovery and final execution

Discovery identifies **225 unique cases and 225 project-expanded cases** across
18 files: 172 Student, 52 Admin and one sterile browser qualification case.
The 224 application cases use mocked HTTP. These are real browser executions,
separate from live development/API evidence and guarded database integration.

**Final result: PASS — 225/225**, with 0 FAIL, 0 BLOCKED, 0 SKIPPED, 0 retries and
0 flaky results in this final run. The earlier tablet failure remains one
`FLAKY_HISTORY` observation; the exact Chrome-internal cause is unproved.

Final run: `.cache/browser-backlog/a8a64d3363dc4020b1738de3d53ef2c9/`.
Started `12:51:51.507 UTC`; completed `13:02:30.971 UTC` on 4 November 2026:
**639.5 seconds (10 minutes 39.5 seconds)**. The full task also included initial
qualification, corrections, exploratory failures and documented host standby.

| Project / file                     |   Cases |    PASS |
| ---------------------------------- | ------: | ------: |
| Admin: admin-access                |      20 |      20 |
| Admin: admin-learning-paths (F044) |      12 |      12 |
| Admin: admin-technologies          |      20 |      20 |
| Student: concept-completion        |      12 |      12 |
| Student: concept-example           |      16 |      16 |
| Student: concept-progress          |       8 |       8 |
| Student: concept-read              |      27 |      27 |
| Student: concept-revise            |      19 |      19 |
| Student: dashboard                 |      20 |      20 |
| Student: practice-answer-unlock    |       7 |       7 |
| Student: practice-attempts         |       8 |       8 |
| Student: practice-coding           |       7 |       7 |
| Student: practice-descriptive      |       7 |       7 |
| Student: practice-output           |      14 |      14 |
| Student: practice-scenario         |       7 |       7 |
| Student: visualization-controls    |      13 |      13 |
| Student: visualization-lesson      |       7 |       7 |
| Qualification: chrome-smoke        |       1 |       1 |
| **Total**                          | **225** | **225** |

Projects are disjoint: **172 Student + 52 Admin + 1 qualification**. An additional
prerequisite execution of the qualification case is excluded from the backlog
totals: 226 executions, 225 unique cases and 225 project-expanded backlog cases.

Post-run verification matched every discovered ID to exactly one final result,
verified all **251 frozen source pins**, and checked all **19** per-file Job
receipts: CLI exit 0, normal cleanup, empty Job and closed handles. The outer
receipt reports `failure: null`, normal cleanup, no forced containment, released
ports, closed handles and released power requests. Network counters report
`apiFallthrough: 0`, `directProbes: 0`, `proxyProbes: 2`; 1,454 other proxy
requests were denied without forwarding. Native positive retained/independent
identity checks and the unowned-parent negative control passed.

At 1280/768/390 px, final visualization metrics retain native key events,
`scrollend` completion and focus. The corrected focused run recorded all three
scroll completions and final scroll position 609 at each width.

Local evidence (generated, ignored, excluded from the commit):

- `.cache/browser-backlog/final-results.json`: counts, per-file results and cleanup.
- `.cache/browser-backlog/final-case-evidence.json`: all 225 case IDs, prior
  blockers/fixture requirements and exact final outcomes.
- Final run subdirectories: result JSON and append-only case journals per file.
- Final run `native-qualification.json`, `network.json`, `closeout.json` and
  `*-job.json`: native identity, deny-network and lifecycle proof.
- `student-visualization-lesson.spec/scroll-metrics-*.json`: numeric diagnostics.

Exploratory failed/interrupted runs remain locally retained, including
`9ad8a33ddc3e40fbac214e758aa2a706` (224 PASS / 1 FAIL with normal cleanup),
`d8e3e9cba70d49e48fdb96fda5c4a3ab` (standby interruption), and earlier runner /
fixture qualification failures. They are not combined with the final run to
inflate totals or relabeled as passing runs.

The ignored `.cache/browser-backlog/final-inventory.json` records every case ID,
project, location, original NOT_RUN blocker and fixture type. Discovery's
`--list` status is not an execution result. Historical NOT_RUN statements in
dated feature checkpoints remain historical; this execution record supersedes
them only for cases actually executed here.

## Verification commands

Commands executed from the QA worktree, using the original unelevated owner:

```powershell
npm.cmd ci --ignore-scripts --offline --no-audit --no-fund
node scripts/browser-backlog/patch-playwright.mjs --apply
node --test scripts/browser-backlog/lease.test.mjs scripts/browser-backlog/patch-playwright.test.mjs scripts/browser-backlog/network-policy.test.mjs
node --import tsx --test tests/browser/background-progress.test.ts
pwsh -NoLogo -NoProfile -File scripts/browser-backlog/close-intent.tests.ps1
pwsh -NoLogo -NoProfile -File scripts/browser-backlog/file-job.tests.ps1
pwsh -NoLogo -NoProfile -File scripts/browser-backlog/tcp-snapshot.tests.ps1
pwsh -NoLogo -NoProfile -File scripts/browser-backlog/execution-availability.tests.ps1
node --import tsx --test apps/admin/tests/admin-rendering.test.ts apps/admin/tests/technology-rendering.test.ts apps/admin/tests/learning-path-rendering.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.browser.json --pretty false
node node_modules/typescript/bin/tsc -p apps/admin/tsconfig.app.json --noEmit --pretty false
node node_modules/typescript/bin/tsc -p apps/admin/tsconfig.node.json --noEmit --pretty false
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false --pretty false
node node_modules/typescript/bin/tsc -p .cache/browser-backlog/admin-rendering-types.json --pretty false
pwsh -NoLogo -NoProfile -File scripts/Test-BrowserBacklog.ps1
```

The ignored narrow Admin test configuration extends the real
`apps/admin/tsconfig.app.json`, adds Node/Vite ambient types, and includes only
`admin-rendering.test.ts` plus the existing Vite declaration. Strictness is
inherited. It emits no code. The guarded runner builds the actual shared types,
validation package, Next application and Vite application before execution.
Targeted ESLint, Prettier, PowerShell parsing, C# compilation, UTF-8/LF,
whitespace, scope and sensitive-output checks accompany delivery.

Independent read-only review covered the actual source and each security
correction. A Low exit-code evidence omission was resolved. No unresolved
Critical/High/Medium/Low findings remain; review does not substitute for executed
tests.

The reviewer independently reconciled all raw final case IDs/results, 251 source
hashes and native lifecycle receipts. The primary agent performs the final Git
index/diff scope checks because Git inspection was unavailable in the reviewer's
tool context.

Focused offline results: 86 runner/fixture/parser controls and 79 Admin rendering
cases, including the added focus regression, passed. The runner controls include actual-body
failure tests for ownership, stale/reused identities, shutdown boundaries,
constructor/launch/wait/cleanup failures, AC loss and unconditional power release.
The native power acquire/clear probe separately returned `Released: true` and
`ReleaseError: 0`. These controls are separate from the 225 browser cases.

## Delivery limits

The supported command is `npm run test:browser:backlog` on the authorized QA
branch/Windows owner. Direct legacy Playwright commands gain no primary-host
exception. Fresh dependency installation restores the original Playwright bytes
and requires the explicit reviewed patch application before this runner admits
execution. Version or source drift fails closed.

Only intentional source, tests and this curated evidence belong in the commit.
Generated logs, case journals, JSON manifests, browser profiles, build output,
dependency bytes and raw synthetic failure artifacts remain ignored locally.
No live API/MongoDB authentication, transactions or durability are established
by mocked browser results. Parallel backend/C2 changes and guarded integration
remain separate review/qualification work. No feature acceptance or production
deployment is authorized by this QA delivery.


## PR #1 review corrections against current dev — 2026-11-04

The owner authorized a normal QA-branch merge of committed `origin/dev`, focused
corrections for the two review findings, relevant offline checks, the existing
ownership-qualified mocked runner, and QA-branch/PR delivery. No merge into dev.
The fetched reviewed inputs were unchanged: dev
`56458ab5c213928273196f3c76aff2d36a7f5408` and QA
`8010e7a41bb79f5b8580e26529ce9465cdd6ee1a`. Normal merge
`89896ecaa832d6f3efe956813a4724d2b6878899` was conflict-free. Primary dev and its
running resources were preserved. Earlier evidence above is historical, not
qualification for this merged candidate.

The runner/config now select the explicit inventory in
`scripts/browser-backlog/inventory.json`: 225 stable project/file/full-title-path
identities across 18 files, captured from the reviewed PR discovery. Source hashes,
owned-fixture imports, Admin origin 5181 and Student origin 3101 are checked.
Unexpected files, changed spec/fixture sources, duplicate/substituted/missing case
identities and unqualified fixture imports fail closed. Runtime admission checks
each identity before its test body. U's separate 16 cases remain explicitly
excluded and NOT_RUN; no U fixture conversion or U ownership qualification occurs.

Discovery uses documented reporter lifecycle events, never argv guessing.
`--list` has no test-execution events and emits no execution-result receipt.
Actual execution requires phase-bound output destinations before owned CDP
attachment. Reporter failures are latched and explicitly return failed because
Playwright swallows thrown reporter exceptions. Sanitized result rows include
stable identities; execution receipts remain creation-only.

Current offline checks: 37 Node protocol/inventory tests PASS; four reporter tests
PASS; 32 inert PowerShell controls PASS; browser TypeScript, Admin production
build/source TypeScript, targeted lint and ordinary discovery PASS. Discovery
selects exactly 225 cases/18 files, not U. Existing nonblocking dynamic-env import
warning remains. An initial negative test mistakenly selected its unchanged
project; that synthetic fixture was corrected. Initial reporter return typing and
three lint errors were corrected; affected checks were rerun successfully.

The current candidate's actual owned-browser results and cleanup are still pending
at this correction checkpoint. Historical 225 PASS does not substitute for them.
No deadline, branch/owner/Job/lease gate, network boundary or native supervisor was
weakened. No application-source change is part of these corrections. F044 remains
IN_PROGRESS; F042/F043 acceptance BLOCKED; original nine integration records,
five P assertions and six API assertions remain NOT_RUN; production NOT_VERIFIED.

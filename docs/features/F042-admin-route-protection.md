# F042 — Admin Route Protection

## Status and owner authorization

Feature: **IN_PROGRESS**. Formal dependency: F008. Owner approved the feature
contract and initial Slice 1 backend scope on 2026-10-24. Current Slice 1:
**READY_FOR_REVIEW — offline only**, acceptance **BLOCKED**. Slice 2A:
**IMPLEMENTED — external HTTP verification pending**, not accepted. Slice 2B:
**READY_FOR_REVIEW — offline only** under the named 2026-10-29 development continuation. The latest
Slice 2B outcome below governs current secondary fields; earlier authorization,
planning, failures and verification records remain historical evidence.
Starting checkpoint: `04efeebce3f81b6b5e4e31f2da11112ed13317d9`, branch dev.
F001–F041 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY. F043 remains
NOT_STARTED. No staging, commit, push or feature completion is authorized here.

References: [PRD](../PRD.md), [architecture](../SYSTEM_ARCHITECTURE.md),
[API](../API_DESIGN.md), [database](../DATABASE_DESIGN.md),
[roadmap](../DEVELOPMENT_ROADMAP.md), [F008](F008-login-access-refresh-tokens.md),
[F012](F012-current-user-student-profile.md).

## Approved Slice 1 contract

1. Protect `/api/v1/admin` and every descendant/method using existing Bearer
   authentication, not a parallel authentication implementation. Existing CORS
   preflight handling and global request/body/security checks remain in place.
2. Require both JWT ADMIN and current stored ADMIN, ACTIVE, verified eligibility
   on every protected dispatch. Account identity comes exclusively from verified
   JWT sub. No caller-supplied account, role or approval flag is authority.
3. Student/old Student JWTs cannot gain access after promotion. Demoted Admins,
   deleted accounts, disabled/suspended/unverified users receive generic
   `403 AUTH_FORBIDDEN`. No reactivation or role elevation occurs.
4. Read only `_id`, role, status and emailVerifiedAt through the established User
   collection. Use the primary, a five-second wall-clock authorization-read cap,
   driver timeout/cancellation and a final deadline check. A late read cannot
   dispatch a handler. Unknown/corrupt data, disconnect, cancellation, timeout or
   dependency failure returns sanitized `503 DEPENDENCY_UNAVAILABLE`.
5. Preserve existing missing/invalid/expired JWT `401` responses. IP limit defaults
   to 300/15 minutes before account reads; authenticated-account limit defaults to
   120/15 minutes, also before account reads. Limits are injectable, process-local,
   use HMAC-obscured keys and IPv6 /56 grouping, and do not enable proxy trust.
   Each store admits at most 10,000 live keys; exhaustion fails closed with 503,
   without evicting live counters. Rate refusal is `429 RATE_LIMIT_EXCEEDED`.
6. All protected responses, including CORS/parser/auth/rate/404 failures, use
   `Cache-Control: no-store`. Existing response envelopes/request IDs are retained;
   no raw paths, IDs, credentials or database errors are added to logs.
7. No Admin business endpoint is created. An eligible Admin reaching an unknown
   route receives existing `404 ROUTE_NOT_FOUND`. Successful dispatch is exercised
   only with test-local downstream handlers. Future business routers must be
   attached below the protected namespace boundary.
8. Authorization is read-only: no schema/index/migration, account/session/progress
   write, Admin provisioning, public registration or authentication change.
9. Existing stateless JWT behavior remains: session revocation does not immediately
   invalidate an otherwise valid access JWT. Current account eligibility is checked
   at the authorization read, not held under a lock through future business work;
   future mutations must enforce their own transactional authority requirements.

## Exact approved Slice 1 inventory — twelve paths

Create:

```text
apps/api/src/middleware/require-admin.ts
apps/api/src/modules/admin/admin-access.repository.ts
apps/api/src/modules/admin/admin-access.service.ts
apps/api/src/modules/admin/admin-rate-limit.ts
apps/api/src/modules/admin/admin.routes.ts
apps/api/tests/admin-access.test.ts
apps/api/tests/admin-routes.test.ts
apps/api/tests/admin-access.integration.ts
docs/features/F042-admin-route-protection.md
```

Modify:

```text
apps/api/src/app.ts
docs/API_DESIGN.md
docs/DEVELOPMENT_ROADMAP.md
```

No dependencies, environment variables, configuration, existing User repository,
schema/index/model or frontend files may change. If an extra path is required,
STOP for owner approval. The User model and existing authenticate middleware are
reused unchanged; general Admin authorization does not depend on Practice models.

## Feature-wide plan and checkpoints

- Slice 1: backend guard, narrow repository/service, bounded rate limiting,
  focused HTTP/unit tests and guarded integration source. Offline verification
  precedes owner review. Database execution and local Git checkpoint each require
  separate explicit approval. Offline readiness is not full feature acceptance.
- Slice 2: proposed Admin-local sign-in, restoration/logout and protected scaffold
  using existing auth and `/users/me` contracts, memory-only access identity and
  strict validation. No business management UI, Google enrollment flow or new
  authentication strategy. Exact implementation inventory must be reconfirmed
  before Slice 2 approval; no Slice 2 implementation is authorized here.
- Each verified slice has its own separately approved local checkpoint. Final
  acceptance and remote delivery are separate owner gates. Never begin F043.

## Verification and pending integration

Focused non-database verification, relevant Auth/User/API regressions, API build,
TypeScript, lint, formatting, UTF-8/LF, scope/diff/secrets checks and an independent
Critical/High/Medium/Low review are required. Results will be appended after checks.
MongoDB integration source is prepared only; execution is **NOT_RUN** and requires
separate guarded-launcher/fixture/index reconciliation and owner authorization.
No persistent collection/index provisioning is approved.

### Offline evidence — 2026-10-24

- Focused checks: **72 PASS**, consisting of 36 service/repository/limiter tests
  and 36 HTTP tests. Relevant Auth/User/API regressions: **156 PASS** across 26
  existing test files. **228 distinct tests PASS**, with zero final failures,
  cancellations or skipped records. Repeated runs are not added to this total.
- The combined run passed 227 tests before the final IPv6 grouping test was added;
  the final 36 HTTP tests were rerun successfully. Existing 36 unit results and
  156 regression results remain applicable; application source did not change.
- API build and TypeScript checks (including the prepared integration file) PASS.
  Targeted API lint and source formatting PASS. The new plan is formatted;
  canonical documents retain their existing formatting with additive changes.
- Actual five-second HTTP expiry, mocked deadline/late settlement, client abort,
  role/status changes, identity binding, bounded storage, IPv6 /56 quotas,
  forwarded-IP refusal, namespace/HEAD coverage, CORS/parser no-store and safe
  errors are covered offline. HTTP repositories use trusted in-process mocks;
  they do not constitute real database evidence.
- Separate source/security review: **Critical 0, High 0, Medium 0, Low 0 unresolved**.
  Review covered authentication/current eligibility, deadlines/cancellation,
  limiter identity/capacity, error/log privacy, unchanged contracts, nonmutation,
  integration lifecycle and scope. No external reviewer or production audit is
  implied by this separate review pass.

### Historical failures and corrections

- The first focused run passed 36 unit checks; its 33 HTTP checks encountered
  sandbox loopback `EACCES`. No application defect was established. The approved
  offline rerun outside the sandbox passed all 69 then-existing focused checks.
- Initial TypeScript verification reported read-only connection-property mock
  assignments and unknown response JSON typing. Tests were corrected using
  scoped/restored property descriptors and runtime response schemas. TypeScript
  subsequently passed; no production contract or assertion was weakened.
- Two deadline/cancellation HTTP cases and the final IPv6 quota case were added,
  producing the final 72 focused cases above. The real expiry test refused after
  approximately five seconds and never reached the downstream handler.

### Prepared integration: NOT_RUN

`runAdminAccessIntegration(initialization, observer?)` is the sole prepared export;
importing its module never invokes a suite or opens a connection. It reuses
`initializeCompletionStudentFixture` unchanged and requires its live retained-handle
ownership/onLoss/private-channel contract. The external supervisor, not observer
messages, must authenticate terminal node:test records and acknowledge the exact
RESULT digest. No F042 launcher adaptation or execution is approved in this gate.

The manifest is exactly PARENT plus T01–T08:

| Record | Prepared verification                                                     |
| ------ | ------------------------------------------------------------------------- |
| PARENT | Guarded initialization, all children and resource-only cleanup            |
| T01    | Genuine Admin/Student login, anonymous denial and eligible downstream 404 |
| T02    | Nonmutating, sanitized current Admin GET                                  |
| T03    | Demotion, promotion and fresh-Admin-JWT requirement                       |
| T04    | Disabled, suspended and unverified refusal without reactivation           |
| T05    | Deleted account and corrupt eligibility refusal                           |
| T06    | Concurrent reads preserve every fixture collection                        |
| T07    | Default account quota refuses request 121 without mutation                |
| T08    | Disconnect refuses cached authorization with sanitized no-store 503       |

All **9 records NOT_RUN**. The prepared parent cap is 180 seconds; any future
supervisor envelope, authenticated reporting/ACK, operation/ownership/heartbeat
deadlines and cleanup compatibility must be independently reconciled before
approval. The reused initializer requires its existing **19 collections and 21
canonical explicit indexes**, plus inherent `_id` indexes. F042 adds no index.
Synthetic setup/status/role/deletion writes are confined to the verified disposable
fixture; Admin authorization performs no writes. Whole-fixture signatures are
compared privately and never logged. Resource-only teardown preserves the
supervisor input channel for terminal reporting; genuine loss remains fatal.

The exact twelve-path, UTF-8/LF, whitespace, secrecy, history-preservation and empty
index checks **PASS**. Branch dev and starting HEAD are unchanged; all twelve paths
remain uncommitted. No staging, commit, push, MongoDB or browser execution occurred.
Next gate:
owner Slice 1 offline review and separate guarded-integration reconciliation and
execution approval. No local Git checkpoint is authorized yet.

## Limitations and future gates

- Backend-only foundation; the Admin frontend remains the prior scaffold.
- Existing browser backlog: **173 NOT_RUN**. Slice 1 adds no browser scenarios.
  Prior named-feature exceptions do not transfer to F042. Primary-host Playwright
  remains prohibited; any F042 browser execution or exception is separately gated.
- Planned Slice 2 must address same-origin Web Locks/BroadcastChannel limitations:
  Student/Admin origins cannot coordinate each other's refresh cookie rotations.
  Existing strict reuse detection can revoke competing sessions; no grace period,
  cross-origin coordination or cookie/session strategy change is approved.
- Real browser/Admin frontend-to-API behavior, distributed rate limiting, real
  failover/multi-process behavior and production privacy/security/release gates
  remain unverified. **Production readiness: NOT_VERIFIED**.

## Current blocker preservation — owner authorization, 2026-10-24

This later record preserves the earlier implementation, reconciliation and
diagnostic history; it does not retroactively change any result above. The owner
authorizes only these documentation updates and read-only Slice 2 planning.

- F042: **IN_PROGRESS**. Slice 1: **READY_FOR_REVIEW — offline only**.
  Slice 1 acceptance and its local Git checkpoint: **BLOCKED** until mandatory
  database verification is satisfied. Slice 2, including 2A and 2B below:
  **NOT_STARTED**, with no implementation approval. F043: **NOT_STARTED**.
- Retained application evidence: **228 distinct offline tests PASS** (72 focused
  plus 156 relevant regressions), API build, TypeScript, targeted lint and format
  PASS. The later focused rerun does not add distinct tests to this total.
- Retained adapter evidence: **201 checks PASS**, comprising 122 Node
  protocol/lifecycle checks and 79 PowerShell harness checks. Timing simulations,
  mocked ownership and parser checks are offline evidence only.
- Retained source/security review: **Critical 0, High 0, Medium 0, Low 0
  unresolved**. This does not establish an independent external audit or real
  database acceptance. The secure-input capability blocker remains unresolved.
- Exact PARENT + T01–T08 integration suite remains prepared. Actual integration:
  **0 PASS / 0 FAIL / 9 NOT_RUN**. No authenticated F042 RESULT or matching digest
  ACK has been obtained. Forced real MongoDB timeout: **NOT_VERIFIED**.
- The adapter's ownership/isolation behavior is verified offline only for F042;
  no guarded F042 database execution has verified it. Separate non-database
  process diagnostics establish only the observations described below.

### Confirmed execution-capability blocker

**SECURE_INPUT_CAPABILITY_UNAVAILABLE_OR_UNVERIFIED**

Codex can launch and verify the approved PowerShell 7 executable, but no supported
mechanism has established a secure binding between human keyboard input, the
intended interactive console pane and the retained PowerShell process. Process
identity, nonredirected streams, console attachment or visibility alone do not
establish active input-pane ownership. Unattended guarded execution is unavailable
under the current security contract. No secret substitution, automated input,
foreground-check bypass or new credential transport is approved.

The historical Windows PowerShell 5.1 context and UTC/local-time comparison defect
were diagnosed separately; neither is an application failure. The corrected
read-only UTC comparison did not alter the runner. The later managed readiness
diagnostic launched PowerShell 7.6.8, verified process ownership and creation-time
identity, and observed absent attempt markers and nonredirected streams. Secure
input remained UNKNOWN; runner invocations were zero and no private entry,
MongoDB, fixture or RESULT/ACK processing occurred. Its observed process exited
0, its retained handle closed and its captured console HWND disappeared. This is
diagnostic cleanup evidence, not guarded integration acceptance or proof of a
displayed terminal host's active pane. Sanitized evidence remains at:

```text
.cache/f042-managed-console-59914da0ed5c42db8dc8257a1381f61e.json
.cache/f042-managed-console-59914da0ed5c42db8dc8257a1381f61e.json.result.json
```

The twelve pending Slice 1 paths and five ignored adapter files are preserved.
There is no retry, marker reset or manual terminal procedure required now. Do not
repeat PowerShell, HWND, foreground-focus or secure-input investigations unless
a genuinely new supported capability becomes available and is separately
approved. Preserve retained native handles, exact Job/CIM ownership, UTC
microsecond identity, one-attempt protection and ownership-safe cleanup.

Repository source-file integrity verification precedes disposable MongoDB
startup. Writable PRIMARY and ownership must be verified before database
enumeration, empty-target verification, approved provisioning and assertions.
Any future approved invocation retains the 19-collection/21-explicit-index
allowlist, fresh mutation-boundary checks, read-only batches of at most 16
requests within 1.5 seconds, five-second RPC/ACK limits, two-second heartbeat,
180-second suite cap, 205-second supervision cap and irreversible fatal-loss
refusal. No deadline or assertion is weakened. Acceptance still requires exact
authenticated counters, matching digest ACK, successful observed exits, empty
Job, closed handles, released ports, removed storage and unchanged protected
baselines. UNKNOWN observations must remain UNKNOWN.

## Future Slice 2 plan — read-only proposal, not implementation approval

Both checkpoints below remain NOT_STARTED. Planning can proceed independently;
implementation cannot begin under this gate. First resolve Slice 1 integration,
obtain owner acceptance and create its separately approved local checkpoint.
Each later Slice 2 checkpoint then requires its own exact-scope implementation
approval, verification, owner acceptance and separate local Git approval.

### Slice 2A — Admin Authentication Foundation

Build a narrow Admin-local client/controller using existing React, TypeScript,
Zod and browser APIs. Reuse the accepted Auth/User API contracts and the Student
client's proven coordination/generation patterns, without importing across apps,
extracting shared packages or changing the Student implementation.

- Use only POST `/api/v1/auth/login`, POST `/api/v1/auth/refresh`, POST
  `/api/v1/auth/logout` and GET `/api/v1/users/me`. Cookie requests use the existing
  credentialed Origin/CORS policy; GET uses a memory-held Bearer access token.
  Preserve existing F008 login/refresh eligibility behavior, cookie attributes,
  rotation, strict reuse detection and F009 logout semantics.
- Validate the actual canonical envelopes and DTOs; allow only approved fields
  into state. Reject malformed or contradictory identity/eligibility data and
  unexpected private credential fields. Never expose raw server messages,
  response documents, tokens or exception details in UI/logs.
- Show the protected scaffold only after a successful current-user response
  establishes ADMIN, ACTIVE and verified eligibility. `/users/me` is a UI
  bootstrap check, not proof of an Admin dispatch or a live session lookup.
  Backend Slice 1 remains the authority for JWT ADMIN plus current stored
  eligibility on every protected operation. Do not treat any 404 as proof of
  authorization; no success probe or new endpoint is proposed.
- Keep tokens and projected identity in memory only. Form passwords are transient,
  are cleared after submission settles and never enter controller snapshots,
  browser storage, URLs, diagnostics or cross-tab messages. The existing HttpOnly
  refresh cookie remains server managed; the frontend never reads it.
- Recommended restoration policy, subject to owner approval: explicit restore
  action, at most one refresh request per action, no background rotation and no
  automatic retry after an ambiguous result. Preserve the established 15-second
  client request timeout; expiry/401 requires a new explicit session action.
- Serialize login, restore and logout using same-origin Web Locks and
  BroadcastChannel, with the established 20-second lock-acquisition cap. Missing
  coordination support fails closed. Broadcast invalidation signals only, never
  tokens, credentials or personal data.
- Bind each operation to a generation and account identity. Invalidate stale
  responses on account change, logout or disposal; cancellation must not be
  interpreted as proof that a cookie mutation did not happen. Drain an admitted
  session operation before another cookie-mutating action; ambiguous outcomes
  clear local authority and require explicit recovery rather than refresh replay.
- Hide privileged UI immediately on logout or eligibility uncertainty. A failed
  logout must not restore a previous privileged snapshot or claim the server
  cookie/session was cleared. An explicit retry uses existing idempotent logout.
  Non-Admin detection clears local authority without automatically signing a
  Student out of the shared API cookie session.
- Revalidate current-user eligibility on an explicit check and after returning
  from a backgrounded application; hide protected content while checking.
  Frontend state cannot guarantee instantaneous remote demotion detection or
  cross-origin logout notification. Backend checks remain mandatory, and F008's
  existing access-token validity after session revocation is unchanged.

Proposed 2A inventory — six creates and two documentation modifications:

```text
CREATE apps/admin/src/lib/auth/contracts.ts
CREATE apps/admin/src/lib/auth/admin-client.ts
CREATE apps/admin/src/lib/auth/admin-controller.ts
CREATE apps/admin/src/lib/auth/browser-coordination.ts
CREATE apps/admin/tests/admin-client.test.ts
CREATE apps/admin/tests/admin-controller.test.ts
MODIFY docs/features/F042-admin-route-protection.md
MODIFY docs/DEVELOPMENT_ROADMAP.md
```

### Slice 2B — Protected Admin Application

Wire the verified controller to the existing React/Vite application through a
small hook and authentication boundary. Preserve the existing shell's skip link,
landmarks and branding. Inspect the Admin dashboard and public login Stitch
screenshots/HTML as references; rebuild only the approved access/scaffold states.
Do not copy generated scripts/CDNs, sample identities, unsupported metrics,
production-status claims or future business controls.

Provide Admin email/password sign-in, explicit restoration, loading/checking,
access denied, expired session, dependency unavailable, unsupported coordination,
uncertainty and current-device logout states. Use fixed safe messages for
401/403/404/429/503, invalid responses, timeout and network errors. Do not retry
credential/refresh requests automatically. Add labelled fields, appropriate
autocomplete, disabled duplicate submissions, live status/error announcements,
keyboard/focus behavior and responsive layout without overflow. No public Admin
registration, enrollment, account provisioning, Google UI, management forms,
analytics, content editing or F043 functionality is included.

Proposed 2B inventory — four creates and five modifications:

```text
CREATE apps/admin/src/hooks/use-admin-auth.ts
CREATE apps/admin/src/components/auth/admin-access.tsx
CREATE apps/admin/tests/admin-rendering.test.ts
CREATE tests/browser/admin-access.spec.ts
MODIFY apps/admin/src/app/app.tsx
MODIFY apps/admin/src/components/layout/admin-shell.tsx
MODIFY apps/admin/src/styles/globals.css
MODIFY docs/features/F042-admin-route-protection.md
MODIFY docs/DEVELOPMENT_ROADMAP.md
```

These are **15 unique proposed Slice 2 paths**; the two documentation paths recur
at both checkpoints. None is newly approved for implementation. No API contract,
model/index, configuration, environment-variable, package or dependency change is
proposed. Existing VITE_API_BASE_URL is reused only with the approved API hostname
and allowlisted Admin origin. Any required configuration or scope expansion must
stop for separate owner approval.

### Cross-origin session decision — owner approval required

Student and Admin applications have different origins but use the API host's
refresh cookie. Same-origin Web Locks/BroadcastChannel do not coordinate those
origins. Concurrent rotations can trigger existing strict reuse detection and
invalidate the shared session; login/logout can also change the cookie used by
the other app. Different tabs or windows alone do not isolate this cookie.

1. **Recommended smallest LOCAL approach:** operate Student and Admin in separate
   browser profiles with independent cookie jars. This changes no authentication
   architecture. Same-origin coordination remains required within each profile.
   Profile/test-environment setup is separately approved; none is performed now.
2. **Same-profile use:** retain fail-closed behavior and explicitly accept possible
   session interruption. Manual restore reduces background rotation but cannot
   prevent another origin from racing or replacing the cookie. A warning or
   user instruction is not technical cross-origin serialization.
3. **Deferred architectural alternative:** separate refresh-session/cookie scope
   or a reviewed cross-origin coordinator. This requires its own threat model,
   API/cookie/CSRF design, inventory and owner approval. No implementation,
   replay grace period or reduced reuse detection is proposed here.

The owner must approve the LOCAL profile policy, explicit restoration/recovery
behavior, minimal access/scaffold design and exact checkpoint inventories before
implementation. These recommendations are not a security exception or a claim
that cross-origin session races have been solved.

### Future verification and acceptance gates

- **2A focused tests:** actual response shapes and private-field refusal; allowed
  API origins and credential modes; Admin/Student/disabled/suspended/unverified/
  deleted eligibility; no-store requests; 401/403/404/429/503 handling; timeout,
  malformed and network uncertainty; memory-only state; same-origin single flight;
  missing lock/channel support; stale/late responses; account switching;
  refresh/login/logout ordering; logout failure and secret-safe messages.
- **2B focused tests:** sign-in and each boundary state, safe identity projection,
  no protected-content rendering before eligibility, denied Student state,
  expired session, uncertainty, logout, semantic labels/landmarks and live
  announcements. Static rendering assertions do not verify actual focus,
  accessibility or responsiveness in a browser.
- Run relevant existing Auth/User/Admin API and Student auth-client/controller
  regressions to prove unchanged behavior, then Admin build, TypeScript including
  tests, targeted lint/format, UTF-8/LF, scope, secrecy and diff checks. Use existing
  tooling; no new test dependency or configuration is assumed. Perform a separate
  Critical/High/Medium/Low security/privacy review at each checkpoint and resolve
  findings before owner acceptance. No passing suite is rerun in this gate.
- Prepare a bounded **20-scenario browser proposal** covering initial restoration,
  eligible sign-in, Student denial, disabled/suspended/unverified denial, expired
  identity, dependency failure, malformed/private data, rate refusal, network
  uncertainty, manual recovery, logout, logout failure, stale responses,
  same-origin tab invalidation, keyboard/focus/announcements and desktop/tablet/
  mobile overflow. Final scenario IDs/assertions must be fixed with 2B approval.
  No scenarios are created or executed now; the actual backlog remains **173
  NOT_RUN**, not 193. Only later preparation of the 20 cases adds that coverage.
- Browser execution requires separate ownership-safe environment/configuration,
  authentication/data isolation, resource limits, privacy and cleanup approval.
  The current default Playwright configuration selects only the smoke file;
  preparing an Admin spec does not make it executable by the default command.
  No primary-host Playwright approval or F041 browser exception transfers.
- Live Admin frontend-to-API verification is a separate approval gate using
  synthetic, exclusively owned disposable data and protected-baseline checks.
  Mocked UI tests cannot satisfy it. Its exact integration inventory must be
  reconciled without assuming F042 Slice 1 or historical F040 results prove it.
- Slice 1's real MongoDB gate, future browser/live qualification, final F042 owner
  acceptance and each local Git checkpoint remain separate. Real failover,
  multi-process behavior and production privacy/security/release gates remain
  outstanding. **Production readiness: NOT_VERIFIED**.

This documentation gate makes no application, fixture, test, adapter or canonical
API change. No runner, credentials, MongoDB, browser, Git staging/commit/push or
F043 work is authorized. The next safe decision is owner review of this blocker
record and proposed Slice 2 contracts; no implementation or checkpoint can bypass
the outstanding mandatory Slice 1 verification gate.

## Owner design decisions and next-gate preparation — 2026-10-24

The owner approves decisions A–D below for **LOCAL DEVELOPMENT planning only**.
This later decision record supersedes the earlier pending-decision wording only
for those design choices; all earlier proposals, failures, evidence and
limitations remain historical. It does not approve application implementation,
browser-profile setup, configuration changes, database execution, acceptance or
Git delivery. Both future checkpoints remain **NOT_STARTED**.

### Approved decisions A–D

**A — Separate Student/Admin browser profiles.** Plan LOCAL operation in separate
profiles with independent cookie jars to reduce shared-cookie refresh conflicts.
Different windows or tabs in one profile do not provide that separation.
Same-profile cross-origin coordination remains unresolved. Same-origin locks and
channels remain necessary within each app/profile, and strict refresh-token reuse
detection is unchanged. No production cookie/session architecture is approved.

**B — Existing APIs and current eligibility.** Reuse the existing email/password,
refresh, current-device logout and `/users/me` APIs. Require valid current
authentication and current verified ACTIVE ADMIN eligibility before mounting any
privileged UI. Keep access tokens and projected identity in memory only; no
localStorage/sessionStorage credential persistence. An Admin-route 404 is never
authorization proof. `/users/me` is a current-user bootstrap check; the backend
Admin guard remains authoritative for JWT ADMIN and current stored eligibility.

**C — Fail-closed recovery.** Missing/expired sessions, refresh failure, account
ineligibility or change, network uncertainty, dependency failures and unsupported
coordination must remove privileged UI immediately. Reject stale responses and
require deliberate sign-in whenever safe restoration cannot be established.
Never replay an uncertain refresh, restore a stale privileged snapshot after a
failed logout or claim that local state clearing proves server logout. Preserve
the existing restoration proposal: explicit user action, serialized requests,
no background rotation and no automatic retry after ambiguity. No strict-reuse
bypass or new authentication mechanism is approved.

**D — Minimum Admin interface.** Plan email/password sign-in, loading and safe
error states, access denial, a protected welcome scaffold, current-device logout,
accessible announcements/keyboard controls and responsive layout. Use access
states within the existing Admin application entry; no new routing library or
public authentication endpoint is required. Exclude Admin creation, user/content
management, analytics, fabricated dashboard metrics and F043 functionality.

### Validated exact future inventory — fifteen unique paths

Read-only inspection confirms all ten CREATE targets are absent and all five
MODIFY targets exist. No file-name collision or additional path is required for
the proposed boundaries. This is inventory validation, not implementation
authorization. "Contracts" below means frontend validation of existing response
DTOs, not a change to `docs/API_DESIGN.md` or a new API contract.

| Action | Exact repository-relative path | Purpose | Checkpoint |
| --- | --- | --- | --- |
| CREATE | `apps/admin/src/lib/auth/contracts.ts` | Validate existing Auth/User response envelopes and project safe Admin state. | 2A |
| CREATE | `apps/admin/src/lib/auth/admin-client.ts` | Bounded, no-store requests to existing login/refresh/logout/me APIs with sanitized errors. | 2A |
| CREATE | `apps/admin/src/lib/auth/admin-controller.ts` | Memory-only session state, current eligibility, recovery, generation/account binding and logout. | 2A |
| CREATE | `apps/admin/src/lib/auth/browser-coordination.ts` | Same-origin serialization and secret-free invalidation; refuse unsupported coordination. | 2A |
| CREATE | `apps/admin/tests/admin-client.test.ts` | Mocked request, DTO, credential-mode, deadline and safe-error checks. | 2A |
| CREATE | `apps/admin/tests/admin-controller.test.ts` | Eligibility, restoration, coordination, cancellation, account-change and logout races. | 2A |
| CREATE | `apps/admin/src/hooks/use-admin-auth.ts` | Connect the controller to React with subscription and lifecycle cleanup. | 2B |
| CREATE | `apps/admin/src/components/auth/admin-access.tsx` | Sign-in, pending, denied, expired, unavailable and uncertain access states. | 2B |
| CREATE | `apps/admin/tests/admin-rendering.test.ts` | Rendered boundary states, safe text, labels, landmarks and announcements. | 2B |
| CREATE | `tests/browser/admin-access.spec.ts` | Prepare bounded browser scenarios; no execution authorization. | 2B |
| MODIFY | `apps/admin/src/app/app.tsx` | Mount the authentication boundary before the protected welcome scaffold. | 2B |
| MODIFY | `apps/admin/src/components/layout/admin-shell.tsx` | Add eligible identity and current-device logout while preserving existing landmarks. | 2B |
| MODIFY | `apps/admin/src/styles/globals.css` | Access-state styling, focus treatment and responsive layout. | 2B |
| MODIFY | `docs/features/F042-admin-route-protection.md` | Record the approved scope, verified evidence, limitations and owner gates. | 2A and 2B |
| MODIFY | `docs/DEVELOPMENT_ROADMAP.md` | Reflect only the separately authorized checkpoint status and evidence. | 2A and 2B |

Checkpoint 2A has six CREATE targets and two documentation MODIFY targets:
**eight paths**. Checkpoint 2B has four CREATE targets and five MODIFY targets:
**nine paths**. The documentation pair overlaps, giving **15 unique paths**.
Those two documentation files already belong to the twelve pending Slice 1
paths; all other proposed Slice 2 work remains absent or unchanged.

Existing-file boundaries and constraints:

- The existing Admin entry, shell and styles are the intended MODIFY targets,
  not replacement files. Preserve their current landmarks/branding and keep the
  non-sensitive welcome content behind the future boundary.
- The existing Student Auth/User client/controller supplies reviewed patterns;
  no cross-app import, shared-package extraction or Student code modification is
  included. Existing React/Zod/tooling is sufficient; no package change is planned.
- Reuse existing `VITE_API_BASE_URL` and approved origins without modifying env,
  Vite, API CORS or authentication configuration. Any required configuration
  change or sixteenth path requires separate scope approval before work.
- Admin TypeScript currently includes `src`, not the future test directory.
  Future checks must explicitly compile the tests using existing tooling; this
  plan does not silently add a tsconfig or change test scripts.
- The default Playwright configuration selects only the smoke spec. The future
  Admin file is preparation only. Browser execution must have a separately
  reconciled isolated runner/configuration and approval; a new config is not part
  of this inventory. Static rendering cannot establish real browser accessibility,
  focus or responsive behavior, and mocked browser tests cannot establish live
  Admin frontend-to-API integration.

### Required sequencing — no implied approval between gates

1. Resolve the mandatory Slice 1 blocker through a separately approved, supported
   secure-input mechanism. Do not restart terminal investigations without a
   genuinely new supported capability or request manual PowerShell procedures now.
2. Obtain separate guarded-execution approval, complete the authenticated exact
   nine-record MongoDB suite and satisfy RESULT/digest ACK, ownership, fixture,
   cleanup and unchanged-baseline requirements. Preserve UNKNOWN observations.
3. Obtain separate Slice 1 owner acceptance. Offline PASS alone is insufficient.
4. Obtain separate authorization for the Slice 1 local Git checkpoint; do not
   stage or create it under this documentation gate.
5. Obtain separate exact-scope authorization for Slice 2A implementation.
6. Verify 2A, resolve Critical/High/Medium/Low findings and obtain owner acceptance.
   Any 2A local checkpoint requires its own explicit Git authorization.
7. Obtain separate exact-scope authorization for Slice 2B implementation.
8. Verify 2B and resolve its browser/live-integration gates through separate
   approvals and actual evidence or an explicitly permitted named-feature browser
   decision. Do not infer an exception. Mandatory security/API/database tests
   cannot be waived through a browser exception. Any 2B local checkpoint remains
   separately approved.
9. Obtain final F042 owner acceptance and separate scoped Git-delivery approval.
   Never infer push permission or start F043 automatically.

Any future execution preflight must reconcile a fresh source-pin inventory that
includes these owner-approved documentation updates. Do not reset attempt markers
or overwrite historical pin evidence to obtain a match.

### Preserved verification state and next safe gate

The confirmed blocker remains
**SECURE_INPUT_CAPABILITY_UNAVAILABLE_OR_UNVERIFIED**. Retain **228 distinct
offline tests PASS**, **201 adapter/protocol checks PASS**, and zero unresolved
Critical/High/Medium/Low source/security findings as historical evidence only.
MongoDB integration remains **0 PASS / 0 FAIL / 9 NOT_RUN**, with no authenticated
F042 RESULT/ACK. Forced real MongoDB timeout remains **NOT_VERIFIED**. Slice 1
acceptance and its local Git checkpoint remain **BLOCKED**.

F001–F041 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY. F042 remains
**IN_PROGRESS**, Slice 1 **READY_FOR_REVIEW — offline only**, Slice 2A/2B
**NOT_STARTED**, F043 **NOT_STARTED**, all **173 browser scenarios NOT_RUN** and
production readiness **NOT_VERIFIED**. The proposed twenty browser cases are not
prepared or executed coverage; no F041 exception transfers.

Only the feature plan and roadmap change in this gate. No passing suite is rerun;
no application, fixture, adapter, API/configuration, dependency or Git change is
authorized. The next safe execution gate is a separate proposal supported by a
genuinely new verified secure-input capability, followed by its explicit owner
approval. Until then, preserve the blocker and implementation evidence without
attempting a runner, new credential transport or further focus experiments.

## Owner-approved workflow amendment and F042 sequencing exception — 2026-10-29

The owner explicitly approves the additive AGENTS.md development-versus-verification
rule and the F042-only sequencing exception in this section. This gate authorizes
documentation changes only in AGENTS.md, this plan and the roadmap. It does not
authorize frontend implementation, tests, services, integration, credentials,
permission changes or Git writes.

This later record supersedes only earlier statements requiring Slice 1 integration,
acceptance and its original acceptance checkpoint before separately authorized
Slice 2 offline implementation. Earlier owner approvals, failures, observations
and limitations remain historical; this section is the current sequencing and
verification record. It neither reclassifies an unsuccessful run as PASS nor
attributes its timeout to the environment without evidence.

### Exact named-feature sequencing permission

F042 Slice 2A may be implemented offline before Slice 1's mandatory MongoDB
integration and acceptance, but **only after separate owner authorization for
Slice 2A implementation**. Slice 2B may proceed only after Slice 2A offline
verification, independent review with resolved findings, owner review of that
offline evidence and separate owner authorization for Slice 2B implementation.

The exception changes development order only. It is not a database/security or
browser-verification exception and does not transfer to another feature. It does
not authorize marking Slice 1 ACCEPTED_LOCAL or F042 APPROVED_COMPLETE. Final
feature acceptance still requires mandatory database verification and separate
explicit owner acceptance.

| Evidence field | Current value |
| --- | --- |
| Official feature status | **IN_PROGRESS** |
| Slice 1 implementation | **READY_FOR_REVIEW — offline only** |
| Slice 1 acceptance | **BLOCKED** |
| Slice 1 original acceptance checkpoint | **BLOCKED** |
| Slice 2A implementation | **NOT_STARTED** |
| Slice 2B implementation | **NOT_STARTED** |
| Offline API verification | **PASS — 228 retained tests; no rerun here** |
| Historical authenticated MongoDB counters | **UNKNOWN — nine-record suite incomplete** |
| Execution readiness | **BLOCKED_ENVIRONMENT — not qualified** |
| New local development commit / remote delivery | **Not authorized** |
| Production readiness | **NOT_VERIFIED** |

These are secondary evidence fields, not new official feature-status values.
F001–F041 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY. F043 remains
NOT_STARTED. One-feature-at-a-time ownership remains in force.

### Stable dependency contracts and implementation boundaries

The approved 15-path Slice 2 inventory above is unchanged: six CREATE targets plus
two documentation MODIFY targets for 2A; four CREATE targets plus five MODIFY
targets for 2B. The shared documentation pair gives 15 unique paths. All ten
CREATE targets remain absent and all five MODIFY targets exist at this gate.
Only this plan and the roadmap overlap the existing twelve pending Slice 1 paths.
AGENTS.md is the only additional pending path introduced by this amendment.

- **2A:** strict existing Auth/User envelopes and safe projections, existing API
  client operations, memory-only session controller, current verified ACTIVE Admin
  eligibility, same-origin coordination, fail-closed recovery, cancellation,
  account/generation binding and focused race/regression tests.
- **2B:** email/password sign-in, explicit restoration, protected welcome scaffold,
  current-device logout, accessible responsive loading/denied/expired/unavailable
  states, lifecycle/rendering tests and browser-scenario preparation only.

Reuse POST login/refresh/logout and GET users/me as specified above. The current-user
DTO is a UI bootstrap contract; an Admin-route 404 is never authorization proof.
The backend must still enforce JWT ADMIN plus current stored eligibility. No new
endpoint, schema, index, dependency, environment/configuration change, Student code
change or business-management feature is approved.

Preserve existing 15-second client request and 20-second coordination-acquisition
bounds, memory-only tokens, transient passwords, no-store requests, secret-free
invalidation messages and refusal of unsupported coordination. Keep explicit
restoration, no background rotation or ambiguous refresh replay, and fail-closed
logout/account-switch recovery. Separate Student/Admin browser profiles remain
the LOCAL guidance; same-profile cross-origin refresh-cookie races are unresolved.
Strict refresh reuse detection and backend authorization remain unchanged.

Before each separately approved implementation gate, reconfirm dependency-contract
stability and applicable offline evidence. A backend/API contract change, relevant
regression failure or security defect that invalidates dependent work requires
reassessment and owner review. Unresolved Critical or High findings prohibit use
of the development exception. Each offline checkpoint requires resolved review
findings, focused/relevant regression evidence, build, TypeScript including tests,
lint/format and scope/secrecy checks. Static rendering is not real-browser proof.

### Reconciled historical execution evidence

- Retain the earlier **228 distinct offline API tests PASS**, build/static evidence
  and recorded source/security reviews. Retain the historical **201 adapter checks
  PASS** (122 protocol/lifecycle and 79 PowerShell checks) as their original gate's
  evidence. Later generated-credential, RPC-expiry, absolute-ripgrep and timing
  reviews/checks remain separate historical evidence; no new execution, combined
  distinct-test total or fresh implementation-security review is claimed here.
- The separately approved generated 256-bit synthetic fixture credentials replaced
  the human-input requirement for disposable accounts only. Therefore earlier
  SECURE_INPUT_CAPABILITY_UNAVAILABLE_OR_UNVERIFIED descriptions remain historical,
  not a requirement to restart keyboard/focus investigations. Authentication,
  authenticated private delivery, confidentiality and one-shot consumption are
  not weakened. This documentation gate generates no credentials.
- Retained run `.cache/f042-slice1-run-e9aa736ce6fc47dca0c541900da41443/result.json`
  records one fixture-host invocation and SuiteInvocations **UNKNOWN**. The suite
  exhausted its 180-second budget. The whole recorded setup/run/cleanup interval
  was 225.702 seconds; that total is not the suite or supervisor budget. Diagnostic
  T01–T03 PASS observations do not establish authenticated acceptance. T04 and the
  parent were interrupted; the exact PARENT + T01–T08 manifest is incomplete.
- The retained result reports Integration **FAIL_OR_UNVERIFIABLE**, CountsStatus
  **UNKNOWN** and null PASS/FAIL/NOT_RUN counters. RESULT validation is false and a
  matching digest ACK is not established. Do not replace these unknown counters
  with 0/0/9 or infer authenticated results from observer messages or exit codes.
- Historical owned cleanup: MongoDB, collection-preparation, initialization and
  shutdown exits 0; fixture-host exit 1; Forced false; no cleanup errors; Job empty,
  handles closed, storage removed and port released. Sources and parent environment
  were unchanged. ProtectedUnchanged is **false**: three additional Node processes
  appeared. Their executable paths alone do not establish owner/ancestor/Job
  attribution. Preserve that failed comparison; do not silently exclude processes.
  These observations do not qualify the current environment or prove live failover.
- Current Windows execution remains unqualified. The separately approved read-only
  CIM query failed with `CimException`: access to a CIM resource was unavailable.
  Native denial code and correlated caller identity were not retained. Existing
  daily sandbox diagnostics record MXC selection without query-level attribution;
  the WMI operational-log file was unreadable. The exact sandbox-versus-Windows
  cause remains UNKNOWN. No new diagnosis or permission change occurs here.
- The proposed bounded ownership-performance probe has not run: no child/sample
  latency measurements establish a dominant bottleneck. The guarded run supplies
  timing observations, not a conclusive component breakdown. No deadline increase,
  cached authorization, removal of fresh ownership checks or automatic retry is
  permitted. Forced real MongoDB timeout remains **NOT_VERIFIED**.

### Durable verification ledger

Every row below records feature, requirement, actual status, blocker, evidence,
acceptance impact, next executable action and required owner approval. BLOCKED
describes execution availability; FAIL describes a failed check; UNKNOWN describes
unestablished evidence. None is interchangeable with PASS.

Evidence references:

- **E1:** this plan's Offline evidence — 2026-10-24 and Historical failures and
  corrections; retained 228-test report and original adapter-review records.
- **E2:** `.cache/f042-slice1-run-e9aa736ce6fc47dca0c541900da41443/result.json`.
- **E3:** that run's sanitized `fixture.stderr.log`, `protected-before.json` and
  `protected-after.json`; observations are not authenticated result authority.
- **E4:** owner-approved environment/CIM diagnostic outcomes in the retained
  2026-10-28/29 conversation and existing `sandbox.2026-10-29.log`; no fresh query.
- **E5:** this plan's Future verification and acceptance gates and approved design
  decisions A–D; F041's final LOCAL exception remains exclusive to F041.

| Feature | Verification requirement | Actual status | Blocker | Evidence | Acceptance impact | Next executable action | Required owner approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F042 | Offline API behavior | PASS, historical 228 tests | No new test gate executed | E1 | Supports offline dependency review; not database proof | Run applicable regressions when separately approved changes require them | Exact implementation/test scope |
| F042 | Adapter/protocol verification | Historical reviewed PASS; 201-check gate retained separately | Later reviews are not real execution | E1 and retained later adapter-review records | Does not satisfy integration | Reconfirm reviewed source identity before qualified execution | Infrastructure corrections or execution, separately scoped |
| F042 | Windows ownership-execution readiness | BLOCKED_ENVIRONMENT | CIM access failed; cause/identity attribution UNKNOWN | E4 | Blocks ownership probe and guarded database execution | Qualify a supported unelevated context without bypassing checks | Separate bounded qualification; none in this gate |
| F042 | Exact nine-record database suite | UNKNOWN, incomplete; historical run FAIL_OR_UNVERIFIABLE | Timeout plus unqualified execution context; bottleneck unresolved | E2, E3 | Mandatory before Slice 1/final acceptance | After qualification and justified performance correction, prepare one fresh guarded invocation | New explicit single-invocation authorization; no automatic retry |
| F042 | Authenticated RESULT and digest ACK | RESULT not validated; matching ACK not established | Terminal manifest incomplete | E2 | Mandatory acceptance blocker | Validate exact counters/manifest and matching digest ACK in a qualified run | Same separately approved guarded invocation |
| F042 | Owned cleanup and disposal | PASS for historical owned resources only | No fresh environment/resource qualification | E2 | Historical cleanup is not current readiness or integration PASS | Verify exits, empty Job, handles, ports and storage for each new authorized attempt | Qualified execution with existing cleanup scope |
| F042 | Protected baselines | FAIL in historical comparison; process attribution UNKNOWN | Three additional Node processes | E2, E3 | Mandatory acceptance blocker | Establish fresh protected baselines and preserve comparison/attribution; never auto-exclude additions | Separate qualified preflight/execution |
| F042 / historical backlog | Browser verification | 173 existing scenarios NOT_RUN; 20 F042 cases proposed only | No approved browser execution environment | E5 and prior feature records | No real accessibility/focus/responsive/race verification | Prepare F042 cases only under 2B approval; later qualify execution or seek a permitted named-feature decision | Separate 2B preparation and browser-execution/exception approvals; no inherited F041 exception |
| F042 | Live Admin frontend-to-API integration | NOT_VERIFIED | Frontend not implemented; qualified live setup absent | E5 | Mocked tests do not satisfy live qualification | Reconcile real integration after authorized 2A/2B work | Separate live-integration approval |
| F042 | Forced real MongoDB timeout behavior | NOT_VERIFIED | No approved forced real-timeout execution | E1, E5 | Retained limitation; not covered by mock timeout PASS | Propose a bounded fault test only when separately requested | Separate fault-injection approval |
| F042 | Production readiness | NOT_VERIFIED | Browser/live, failover, multi-process, privacy/security and release gates outstanding | E5 and retained feature limitations | No production qualification/deployment | Complete separately approved release-readiness work | Separate production/release approval; none here |

Existing **173 browser scenarios remain NOT_RUN**. The proposed twenty F042 cases
have not been created or executed; do not add them to the current backlog total.
No F041 exception transfers and no new browser exception is granted here.

### Development checkpoints and next approval

A local offline development commit may be proposed under the new AGENTS.md rule,
but requires separate owner approval, exact path/content preflight, resolved review
findings and explicit incomplete-verification labelling. It does not establish
Slice 1 acceptance, unblock its original acceptance checkpoint, authorize a remote
push or grant feature completion. No staging, commit, push or history rewrite is
authorized by this documentation gate.

The unchanged starting Git checkpoint is
`04efeebce3f81b6b5e4e31f2da11112ed13317d9` on dev. The original twelve-path pending
inventory plus AGENTS.md makes **13 distinct pending paths** after this amendment;
this includes existing untracked F042 source/tests/plan, not thirteen previously
tracked files. Later approval must reconcile the actual complete inventory and
shared-document diffs rather than assuming a clean twelve-path checkpoint.

The next development gate is **separate exact-scope Slice 2A implementation
authorization**, followed by its offline verification and independent review.
Slice 2B remains separately gated as stated above. In parallel, mandatory Slice 1
verification remains open and cannot be bypassed for acceptance. No further
Windows/CIM/sandbox/terminal or runner investigation is authorized here. Final
F042 acceptance, every Git checkpoint and remote delivery remain separate owner
decisions; do not begin F043.

## Slice 2A implementation authorization — 2026-10-29

Owner explicitly authorized the eight-path Admin Authentication Foundation scope,
offline tests and independent security review under the sequencing amendment.
Slice 2A is **IN_PROGRESS**. F042 remains **IN_PROGRESS**, Slice 1 remains
**READY_FOR_REVIEW — offline only** with acceptance/original checkpoint **BLOCKED**,
and Slice 2B remains **NOT_STARTED**. This gate authorizes no Git writes, database
or browser execution, Slice 2B implementation or F043 work. Historical evidence
and the UNKNOWN authenticated integration counters remain unchanged.

## Slice 2A implementation and offline outcome — 2026-10-29

This is the latest Slice 2A record. It supersedes earlier NOT_STARTED/planning-only
statements only for the eight paths explicitly authorized by the owner. Earlier
approvals, failures, source-pin and sequencing records remain historical.

### Current gate outcome

- F042: **IN_PROGRESS**.
- Slice 1: **READY_FOR_REVIEW — offline only**; acceptance and its original
  acceptance checkpoint remain **BLOCKED**.
- Slice 2A: **IN_PROGRESS**. Implementation is complete, but relevant HTTP
  regression qualification is **BLOCKED**; READY_FOR_REVIEW is not claimed.
- Slice 2B and F043: **NOT_STARTED**.
- No Slice 2A acceptance, local checkpoint, remote delivery or feature completion
  is authorized or implied.

### Exact implemented inventory — eight paths

Created:

```text
apps/admin/src/lib/auth/contracts.ts
apps/admin/src/lib/auth/admin-client.ts
apps/admin/src/lib/auth/admin-controller.ts
apps/admin/src/lib/auth/browser-coordination.ts
apps/admin/tests/admin-client.test.ts
apps/admin/tests/admin-controller.test.ts
```

Modified only this plan and `docs/DEVELOPMENT_ROADMAP.md`. The thirteen pending
paths at entry are preserved; six new files produce **19 distinct pending paths**.
AGENTS.md, Slice 1 source/tests, API contracts, Student code, all five ignored
adapters, dependencies and configuration remain unchanged in this gate. Existing
ignored Admin build outputs are tooling artifacts, not delivery paths.

### Implemented foundation

- The Admin-local client uses only existing login, refresh, current-device logout
  and current-user endpoints. It validates the actual strict F004 envelopes and
  separate login-with-user versus access-only refresh DTOs. Unknown/private fields,
  malformed identity, contradictory known error/status pairs, redirects, unexpected
  destinations and non-JSON/oversized bodies are refused with fixed safe errors.
- Base URLs are restricted to the documented HTTPS API host or approved loopback
  API host/port 4000 and the exact /api/v1 path. Credentialed requests are limited
  to login/refresh/logout; current-user GET uses Bearer authentication and omits
  cookies. Requests use no-store, redirect refusal, a maximum 15-second monotonic
  deadline, cancellation and a 65,536-byte response bound. No raw server error,
  private response, credential or exception detail enters public state or logs.
- A login result alone cannot grant eligibility. The controller requires a fresh
  validated /users/me result establishing verified ACTIVE ADMIN, binds login and
  subsequent checks to the expected account, and projects only id, names, email,
  role, status and emailVerified. Tokens and identity are memory-only; credentials
  never enter snapshots, browser storage or coordination messages. Immutable
  snapshots prevent caller mutation. JavaScript strings cannot be reliably
  zeroized; form references are released after the operation settles.
- Restoration is an explicit controller action; connecting does not refresh.
  Each action makes at most one refresh call, with no silent 401 rotation or
  automatic replay. Ambiguous mutation outcomes remove authority and prohibit
  restoration replay until explicit sign-in or current-device logout recovery.
- Same-origin exclusive Web Locks serialize session actions, with a 20-second
  acquisition bound. BroadcastChannel carries only fixed invalidation controls.
  Unsupported contexts, denied channel construction, delivery failure, stale
  admission and unconfirmed coordination fail closed. This does not solve
  Student/Admin cross-origin shared-cookie races; separate browser profiles
  remain LOCAL guidance, not production isolation.
- Generations, cancellation, expiry and account binding refuse stale results.
  Admitted cookie mutations retain their lock until the bounded request settles;
  local invalidation does not release the lock early. Logout hides authority
  immediately, drains any admitted operation and never restores a previous
  privileged snapshot after failure or claims an unconfirmed server logout.
  Non-Admin detection does not automatically log a Student out.
- Explicit revalidation hides cached eligibility before checking current data.
  Backgrounding hides authority; backgrounding during an outstanding request
  invalidates that request. Subscriber-visible expiry remains active across
  suspend/revalidate generations. These methods are not wired to the application
  until separately authorized Slice 2B; no UI or privileged API endpoint is added.
  Backend Admin middleware remains authoritative.

### Verification actually performed

- **113 focused tests PASS**, zero failures/cancellations/skips. Browser
  coordination is tested with inert browser-shaped mocks; no browser is launched.
  Tests cover canonical DTOs and private-field refusal, approved API destinations,
  credential modes, safe HTTP errors, body/deadline bounds, cancelled/ignored-abort
  requests, eligibility, explicit restoration, duplicate actions, drain/logout
  ordering, account races, subscriber-visible expiry, unsupported coordination
  and same-origin stale-action refusal.
- The relevant existing regression command attempted 17 Auth/User/Admin and
  Student-auth test files: **79 PASS / 44 FAIL**, exit 1. Forty-three failed cases
  directly reported loopback connect EACCES; one HTTP client-cancellation case
  timed out after 15 seconds. That timeout is an observed failure, not proof of
  its cause. No application regression is established by those transport errors,
  but none of the 44 failed records is relabelled PASS or NOT_RUN. No denied call
  was retried and no permission/environment investigation was performed.
- **192 passing records** (113 focused plus 79 regressions) and **44 failed
  regression records** were observed across 236 distinct attempted tests. This
  gate does not claim a fully passing regression suite. Retained historical
  Slice 1 evidence remains separate and is not added to these counts.
- Admin build (TypeScript project build plus Vite), explicit strict TypeScript
  compilation including both tests, targeted ESLint and source/test Prettier
  checks **PASS**. The build compiles the foundation; it does not establish that
  the modules are mounted in the application or that live authentication works.
- UTF-8/LF, exact scope, historical evidence, secrecy and Git whitespace/index
  checks are recorded after final documentation verification below.
- A fresh-context independent agent reviewed all four modules, both tests,
  approved F042 requirements and actual backend contracts read-only. Final
  unresolved findings: **Critical 0 / High 0 / Medium 0 / Low 0**. Source review is
  not real browser, database integration or production verification.

### Historical corrections in this gate

Initial explicit TypeScript compilation rejected generic Zod envelope access
(TS2339). A narrow assertion on the already strictly validated data member
corrected the type inference; final tests-inclusive compilation passed. No
runtime schema or assertion was weakened.

An early expiry callback was coupled to the operation generation. Independent
review identified the Medium consequence for background suspend/revalidate:
generation changes could make the timer a no-op until another snapshot/action.
The final callback checks the current token expiry independently, while clearing
obsolete timers when authority changes. The focused subscriber-notification test
covers expiry across suspend/revalidate; the finding is resolved. In-flight
background eligibility is also invalidated rather than allowed to restore
privileged state. Admitted API errors retain their safe categories rather than
being incorrectly reported as lock failures.

### Verification ledger update and next owner gate

| Requirement | Actual state | Evidence / acceptance effect | Next action |
| --- | --- | --- | --- |
| Slice 2A implementation | Complete, official slice IN_PROGRESS | Six new files; no UI wiring or backend changes | Owner review of implementation and incomplete verification |
| Focused offline behavior | PASS — 113 tests | Mocked fetch/browser capabilities only | Retain evidence; rerun only for relevant corrections |
| Relevant regressions | 79 PASS / 44 FAIL | 43 EACCES observations plus one HTTP cancellation timeout; complete gate not passed | Separately authorize the failed HTTP regressions in a qualified supported context; diagnose any genuine failure before acceptance |
| Build / tests-inclusive types / lint / format | PASS | Existing tools only | Retain evidence |
| Independent source/security review | 0 unresolved C/H/M/L | Does not convert failed execution into PASS | Reassess only after relevant corrections |
| Slice 1 real MongoDB / authenticated RESULT-ACK | UNKNOWN, incomplete | Historical nine-record suite remains mandatory | Separate qualified execution and acceptance gates remain open |
| Browser / live Admin integration / production | 173 NOT_RUN / NOT_VERIFIED / NOT_VERIFIED | No browser cases added or executed; no live frontend-to-API proof | Separate Slice 2B, browser/live and release approvals |

Keep Slice 2A **IN_PROGRESS** until the required regression gate is satisfied and
the owner reviews its offline outcome. Do not grant acceptance or invent a
verification exception. Separate owner approval remains necessary for any local
development Git checkpoint and for Slice 2B implementation. This gate performs no
MongoDB, browser, guarded runner, credential-fixture, Windows/CIM/terminal
investigation or Git writes. Slice 1's historical UNKNOWN counters, protected
baseline discrepancy, unverified forced real timeout, all 173 NOT_RUN browser
scenarios and production NOT_VERIFIED limitations are preserved. Do not begin F043.

### Final documentation/repository verification

Exact eight-path gate scope, UTF-8/LF, original historical-content preservation,
source secrecy review and git diff --check PASS. The roadmap contains existing
unchanged trailing whitespace outside the new records; no new trailing whitespace
was introduced. All original non-documentation source and the five adapter
baselines remain unchanged. Branch dev and HEAD
`04efeebce3f81b6b5e4e31f2da11112ed13317d9` are unchanged; there are 19 pending
paths and the index is empty. No staging, commit, push, MongoDB or browser
execution occurred. Slice 2A remains IN_PROGRESS pending the failed regression
gate; this record does not grant acceptance or a verification exception.

## Slice 2B named development continuation — owner approval 2026-10-29

The owner explicitly authorizes F042 Slice 2B Admin UI and Protected Scaffold
within its existing nine-path inventory, offline tests, safe non-network
regressions and independent review. Under the AGENTS.md blocked-verification
rule, the owner reviewed Slice 2A evidence as the development dependency basis
and permits this named continuation despite incomplete Slice 1 MongoDB and
Slice 2A external HTTP verification. This supersedes only the development-order
prerequisite; it is not a passing test, security/database/browser exception,
Slice 2A acceptance, final F042 acceptance or Git approval.

Current fields: F042 IN_PROGRESS; Slice 1 READY_FOR_REVIEW — offline only,
acceptance/original checkpoint BLOCKED; Slice 2A IMPLEMENTED — external HTTP
verification pending, not accepted; Slice 2B IN_PROGRESS; F043 NOT_STARTED.
Retain 113 focused PASS, 7 inert cancellation checks PASS, 79 earlier regression
PASS, 43 historical EACCES failures and one historical inconclusive timeout.
The qualified eight-file HTTP rerun is NOT_RUN following denied loopback connect
qualification; the diagnostic listener/request cleanup passed. No such calls
are retried under this approval. Historical records remain unchanged.

Reassess and stop for an invalidating contract change or application/security
defect; preserve exact scope, mandatory acceptance gates, independent review
and separate local checkpoint/remote delivery approvals. No production release,
HTTP/MongoDB/browser execution, new dependencies, configuration or F043 work is
authorized. Same-profile Student/Admin refresh-cookie races remain unresolved;
separate profiles are LOCAL guidance only. Existing 173 browser scenarios remain
NOT_RUN; newly prepared F042 cases will be counted separately, never as PASS.


## Slice 2B implementation and offline review — 2026-10-29

This is the owner-authorized development-only Admin UI/Protected Scaffold gate,
not Slice 1 or 2A acceptance, final F042 acceptance, a browser exception or Git
delivery. The named continuation above is the only sequencing authorization.
No F041 browser exception transfers to F042. Backend Admin middleware remains
authoritative; this frontend protects presentation, not server authorization.

### Exact nine-path implementation inventory

Created:

- apps/admin/src/hooks/use-admin-auth.ts
- apps/admin/src/components/auth/admin-access.tsx
- apps/admin/tests/admin-rendering.test.ts
- tests/browser/admin-access.spec.ts

Modified:

- apps/admin/src/app/app.tsx
- apps/admin/src/components/layout/admin-shell.tsx
- apps/admin/src/styles/globals.css
- docs/features/F042-admin-route-protection.md
- docs/DEVELOPMENT_ROADMAP.md

The 19 pre-existing pending paths are retained. Four creations and three newly
modified existing Admin files result in 26 pending paths; the two documents
already belonged to the prior pending inventory. No dependency, configuration,
application API, Slice 1/2A source, cancellation-regression test, AGENTS.md or
ignored integration-adapter change is part of this gate. Ignored build outputs
are tooling artifacts, not delivery files. No staging, commit or push occurs.

### Implemented behavior and safety boundaries

- Existing green DeepLearner branding, shell, skip link, main landmark and footer
  are preserved. The sign-in card uses labelled native email/password fields,
  username/current-password autocomplete, native validation and bounded inputs.
  Existing Stitch login/dashboard screenshots and HTML informed layout only;
  unsupported analytics, sample metrics, management controls and external/CDN
  scripts were not copied. No F043 functionality or Admin creation is added.
- Sign-in, explicit restoration, current-device logout, explicit read-only access
  revalidation, cancellation and supported manual recovery use the unchanged
  Slice 2A controller/client/contracts/coordination. Mounting remains passive:
  no automatic restoration, refresh rotation, 401 replay or return-URL redirect.
- The App hides both welcome content and shell identity/actions until current
  /users/me establishes a strict minimal verified ACTIVE ADMIN projection.
  Pending, stale, malformed/private, Student, disabled, suspended, unverified,
  expired, revoked or otherwise invalidated identity never grants presentation
  access. No Admin-route 404 is authorization evidence. React escapes text.
- Passwords are read from the native form only for the explicit action, removed
  from the field immediately and cleared on settlement/unmount. They never enter
  React state, storage, URLs, control messages or logs. Tokens remain private to
  the existing memory-only controller. JavaScript string zeroization is not
  claimed. Fixed messages discard raw errors/private fields and no arbitrary
  server URL is used for navigation.
- Visibility/pagehide hides authority; focus/visible return revalidates existing
  authority with a GET, never an automatic refresh. Unmount cancels/invalidates
  reads and disconnects listeners; StrictMode cleanup/setup can reconnect.
  Obsolete responses cannot repopulate privileged display. Host registration or
  cleanup failure removes authority and fails closed.
- Read-only failure and cookie-mutation uncertainty remain distinct. A 503 on
  read-only revalidation may offer manual restoration; a 503 or malformed result
  after an admitted restoration is uncertain, keeps restoration disabled and
  offers explicit sign-in/sign-out recovery instead. No automatic replay occurs.
- Same-origin Web Locks/control-only BroadcastChannel protections are unchanged.
  Same-profile Student/Admin cross-origin shared-cookie races are unresolved;
  separate browser profiles are LOCAL guidance, not production isolation.
- Native controls, live status/error announcements, heading focus after explicit
  actions/access loss, visible focus styles, 44px controls, wrapping and mobile
  CSS are implemented. Offline source/inert checks do not establish real-browser
  keyboard, focus, accessibility, responsive layout or authentication races.

### Verification actually performed

- **42 new focused offline rendering/lifecycle tests PASS**, zero failures,
  cancellations or skips. Tests use React static rendering, inert hooks/forms/
  host events and the real controller with synthetic in-process API doubles.
  They cover state gating, strict projections, escaped text, fixed errors,
  labels/announcements, action wiring, duplicate suppression, password clearing,
  account changes, expiry/error presentation, cancellation/late reads,
  backgrounding, unmount, StrictMode reconnection and host failure refusal.
  No socket, HTTP service, browser or database is started by these tests.
- **192 permitted regression tests PASS**: 113 unchanged Slice 2A client/controller
  cases plus 79 non-network Auth/User/Admin/Student-auth cases. The combined run
  passed 228 records before six focused cases were added; the final focused run
  passed all 42. Thus this gate has **234 distinct offline tests PASS**, with no
  duplicate counting. The prior 228-test Slice 1 record is separate historical
  evidence and is not added to this gate's totals.
- The regression command covers admin-client, admin-controller, api-client,
  auth-controller, browser-coordination, auth-redirect, access-token, login,
  logout, user-profile and admin-access test files. The eight blocked HTTP test
  files and MongoDB integration files are excluded. Existing 113 focused PASS,
  seven inert cancellation checks PASS and 79 earlier regression PASS remain
  retained; historical **43 EACCES failures + one inconclusive cancellation
  timeout** are not relabelled. The qualified eight-file HTTP rerun is NOT_RUN.
- Admin TypeScript/Vite build and explicit strict TypeScript compilation of the
  new rendering test and prepared browser specification PASS. Targeted ESLint
  and formatting, UTF-8/LF, scope/diff, historical-evidence and secrecy checks
  require the final recorded verification below. No runtime browser evidence is
  inferred from compilation or the generated bundle.
- Initial independent review found a Low test-quality mismatch in three prepared
  browser cases: they expected unavailable/retry after an admitted restoration
  could produce uncertainty. The cases were corrected to match unchanged
  controller behavior, and real-controller offline cases were added. A lint
  warning about dereferencing a changing form ref during cleanup was corrected
  by capturing the committed form for its eligibility-scoped effect. The final
  reviewer outcome and final static/scope results are recorded below. Initial
  verification passed 36 focused cases; the expanded final set contains 42.

### Prepared browser inventory — 20 NOT_RUN

The new specification contains exactly these F042 cases. It is prepared only;
Playwright is not executed, including discovery/listing. No configuration is
changed. The current default smoke selection does not run this specification;
future qualification must explicitly select it in a separately approved safe
environment, with the existing Admin origin localhost:5173 configured for API
localhost:4000/api/v1. All API endpoints are mocked with canonical envelopes,
synthetic identities and inert fixture strings; unexpected network destinations
are refused. Held responses/peer pages are cleaned up and traces, screenshots,
video and service workers are disabled for this specification.

| ID | Prepared coverage | Actual result |
| --- | --- | --- |
| F042-B01 | Passive mount, explicit restoration, no browser-storage state | NOT_RUN |
| F042-B02 | Login, held current eligibility and cleared password | NOT_RUN |
| F042-B03 | Student denial | NOT_RUN |
| F042-B04 | Disabled account denial | NOT_RUN |
| F042-B05 | Suspended account denial | NOT_RUN |
| F042-B06 | Unverified account denial | NOT_RUN |
| F042-B07 | Expiry without silent refresh | NOT_RUN |
| F042-B08 | Read-only dependency failure and missing account | NOT_RUN |
| F042-B09 | Malformed/private response and uncertainty refusal | NOT_RUN |
| F042-B10 | Rate limit and manual recovery | NOT_RUN |
| F042-B11 | Ambiguous refresh, no replay | NOT_RUN |
| F042-B12 | Explicit recovery and newly checked eligibility | NOT_RUN |
| F042-B13 | Current-device logout | NOT_RUN |
| F042-B14 | Failed logout and explicit retry | NOT_RUN |
| F042-B15 | Account invalidation and stale-response refusal | NOT_RUN |
| F042-B16 | Same-origin peer-tab invalidation | NOT_RUN |
| F042-B17 | Navigation safety, ignored return parameter and reload | NOT_RUN |
| F042-B18 | Keyboard actions and access-loss focus | NOT_RUN |
| F042-B19 | Desktop/tablet/mobile wrapping and control bounds | NOT_RUN |
| F042-B20 | Labels and loading/success/error announcements | NOT_RUN |

Existing **173 NOT_RUN** plus **20 new F042 NOT_RUN** produces a combined browser
backlog of **193 NOT_RUN**. These mocks would not prove live JWT, stored-role
changes, database authorization or frontend-to-API qualification even if executed.
Live Admin integration remains NOT_VERIFIED and requires separate authorization.

### Current verification ledger and remaining gates

This update supersedes only the current secondary fields in earlier ledger rows;
all original requirements, outcomes, failures and evidence above remain retained.

| Requirement | Current actual state | Acceptance effect / next gate |
| --- | --- | --- |
| Slice 1 real MongoDB authorization / RESULT-ACK | Authenticated counts UNKNOWN; nine-record suite incomplete | Acceptance and original checkpoint BLOCKED; separately qualified execution required |
| Protected baseline discrepancy / forced real timeout | Historical discrepancy retained; forced timeout NOT_VERIFIED | Ownership/baseline/cleanup and bounded real qualification remain mandatory |
| Slice 2A foundation | IMPLEMENTED — external HTTP verification pending; not accepted | Qualified eight-file rerun NOT_RUN; preserve 43 historical EACCES failures and one timeout |
| Slice 2B UI | READY_FOR_REVIEW — offline only | Owner review is separate from acceptance; no browser/live proof |
| Browser verification | Existing 173 plus new 20 = 193 NOT_RUN | Separate approved safe environment/execution; no inherited exception |
| Live Admin frontend-to-API integration | NOT_VERIFIED; UI now implemented, live setup unqualified | Mocked checks do not satisfy live acceptance |
| F042 final acceptance / Git delivery | Not authorized by this gate | Mandatory verification, owner acceptance and separate Git approvals |
| Production readiness | NOT_VERIFIED | Failover, multi-process, privacy/security, browser/live and release gates outstanding |

F042 remains IN_PROGRESS, Slice 1 acceptance BLOCKED, Slice 2A not accepted and
F043 NOT_STARTED. No HTTP, MongoDB, browser, credential-fixture, Windows sandbox/
CIM/PowerShell/ripgrep/loopback investigation or Git write is performed here.


### Final offline verification and independent review

All final checks PASS: Admin build (tsc -b plus Vite), strict TypeScript including
the new rendering/browser files, targeted ESLint with zero warnings, seven-file
source/test/style Prettier checks, UTF-8/LF without BOM, exact nine-path task scope,
git diff --check, sensitive-data review and original historical-body preservation.
Existing canonical-document formatting outside the new records is preserved.
All 548 pre-existing source/adapter baseline hashes were compared: only the five
authorized MODIFY paths differ; no baseline file is missing. The four authorized
CREATE files are present. Slice 1, the corrected cancellation test, all six Slice
2A source/test files, AGENTS.md and the five ignored adapter artifacts are unchanged.

A separate fresh-context agent independently inspected the actual hook, access
view, App, shell, CSS, offline test, prepared browser spec and final documents,
including unchanged Slice 2A dependencies. It made no edits and did not execute
tests. Final Critical / High / Medium / Low unresolved findings: **0 / 0 / 0 / 0**.
The one Low prepared-test finding described above was corrected and re-reviewed.
Source-level evidence includes strict projection gating, escaped text, fixed safe
messages, transient form input, no browser storage/logging/redirects, generation/
abort invalidation and passive/reversible lifecycle wiring. This review does not
prove real browser behavior or live database/network qualification.

Slice 2B is now **READY_FOR_REVIEW — offline only**. This does not accept Slice 2A
or Slice 2B, waive mandatory HTTP/MongoDB/browser/live gates, authorize a Git
checkpoint or advance F042 beyond IN_PROGRESS. Slice 1 acceptance remains BLOCKED;
Slice 2A IMPLEMENTED — external HTTP verification pending; F043 NOT_STARTED.
Branch dev and HEAD 04efeebce3f81b6b5e4e31f2da11112ed13317d9 remain unchanged,
26 pending paths and an empty index. No staging, commit, push, HTTP/MongoDB/browser
execution or infrastructure investigation occurred. The next gate is owner review
of Slice 2B's offline evidence and a separate decision on qualified mandatory
verification or an explicitly scoped development checkpoint under AGENTS.md.

### Named F043 development-only sequencing decision — 2026-10-30

The owner explicitly approved the F043-only exception now enacted in AGENTS.md.
This later decision supersedes only earlier statements preventing separately
approved F043 development before F042 closes; it does not change any historical
outcome, feature status, acceptance requirement or F042 verification ledger row.
F042 remains **IN_PROGRESS**, with Slice 1 acceptance and final acceptance
**BLOCKED**. Slice 2A is IMPLEMENTED — external HTTP verification pending, not
accepted; Slice 2B is READY_FOR_REVIEW — offline only. Its delivered development
checkpoints are not evidence of verified Admin authorization or final acceptance.

F043 remains **NOT_STARTED** until separate Slice 1 implementation approval. It
must reuse this feature's Admin security boundary while treating mandatory real
verification as incomplete. Its own real integration, authenticated RESULT/digest
ACK, ownership/isolation/deadline/cleanup checks and the F042 prerequisite
verification gate remain acceptance requirements. The finalized F043 contract is
in [F043 Admin Technology Management](F043-admin-technology-management.md).

Preserve F042's historical timeout, incomplete nine-record MongoDB manifest,
UNKNOWN authenticated counters, incomplete RESULT/ACK, protected-baseline
discrepancy, unverified forced real timeout, historical HTTP failures and pending
qualified regression rerun. No verification exception is granted. Existing **193
browser scenarios remain NOT_RUN**; live Admin integration and production
readiness remain NOT_VERIFIED. No browser exception transfers. No F044/other
feature work or automatic Slice 2 implementation is permitted by this decision.
Every commit and every push requires separate explicit owner approval. No F042
acceptance, source, test, adapter or security control changes in this task.

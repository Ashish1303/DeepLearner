# F044 — Admin Learning Path Management

## Status, authority and source precedence

Latest scoped extension: **P READY_FOR_REVIEW — offline only; uncommitted**.
The dated P authorization/evidence below records internal admission/persistence
implementation and independent review. C1/S and historical read-only A/B remain
READY_FOR_REVIEW — offline only; earlier contracts/evidence remain intact. Live
authority/transactions, proposal API/UI and acceptance remain separately gated.

Feature: **IN_PROGRESS**. Read-only contract approved 2026-11-02 as PARTIAL
F044 progress. Backend Checkpoint A: **READY_FOR_REVIEW — offline only**, with the
full API/test TypeScript limitation recorded below. Frontend Checkpoint B: **READY_FOR_REVIEW — offline only**, implementation and focused offline
verification separately authorized on 2026-11-03. Named read-only sequencing exception: **ENACTED** in
AGENTS.md by the separate owner decision. Acceptance: **BLOCKED**.

Historical preparation was documentation-only at dev /
47a049d496d8f83b995a28b1dc56455ea5bb0d77. The owner subsequently approved the
read-only API/UI contracts and inventories, required detail-parent binding,
archived-parent inspection, enactment of the limited sequencing exception and
backend implementation/offline checks. Initial pending scope was this document
only; index empty. The backend checkpoint ended with its approved 15-path inventory plus AGENTS.md for
sequencing enactment. The later Checkpoint B authorization/evidence below records
the current combined scope. Live verification,
Git staging/commit/push and final acceptance remain separately gated.

Sources: [AGENTS.md](../../AGENTS.md), [roadmap](../DEVELOPMENT_ROADMAP.md),
[PRD](../PRD.md), [architecture](../SYSTEM_ARCHITECTURE.md),
[API design](../API_DESIGN.md), [database design](../DATABASE_DESIGN.md),
[F017](F017-learning-path-backend.md), [F042](F042-admin-route-protection.md),
[F043](F043-admin-technology-management.md), and
[Stitch reference boundaries](../design/stitch/SCREEN_MAP.md).

The original roadmap ticket states only the title and NOT_STARTED, without formal
dependencies or acceptance criteria. The 2026-10-31 approved design reconciliation
assigns F044 Learning Path proposal structures/review, including bounded objectives,
audience/version and prerequisites. That direction is not implementation approval
or a physical schema. This draft defines the first slice without rewriting history.

Preserve F001–F041 APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY; F042/F043
IN_PROGRESS, acceptance BLOCKED; F043's 15 real MongoDB records NOT_RUN;
historical HTTP/MongoDB failures, UNKNOWN authenticated results and incomplete
RESULT/digest ACK; all 213 existing browser scenarios NOT_RUN; production readiness
NOT_VERIFIED. Latest targeted QA retains 132 focused offline tests PASS after
initial tsx/uv_os_get_passwd ENOMEM startup failures. Live stale-revision and
Student learning checks remain BLOCKED pending owner observations, with no
confirmed application defect. Those results are not F044 verification evidence.

## Full-feature direction versus the first read-only slice

Full F044 is the Technology-scoped Learning Path management/proposal-inspection
foundation for the eventual Studio. Future proposal structures must support
reviewable objectives, audience/depth/runtime/version and prerequisites with
explicit revision/source boundaries. These fields do not exist in the current
LearningPath schema. Their models, bounds, APIs, review UI and acceptance criteria
require a later separately approved extension. No placeholder metadata or inferred
objectives may be manufactured from existing titles.

The first proposed slice covers existing-data inspection only:

1. Select an existing Technology through a bounded authenticated selector.
2. Inspect its paginated Learning Paths and one selected detail.
3. Show actual DRAFT/PUBLISHED/ARCHIVED state and existing metadata read-only.
4. Handle unavailable records, account/session changes and cancelled/late reads.
5. Preserve existing Technology Management and public Student behavior.

This useful management foundation does not complete full F044 or substitute manual
authoring for AI. Acceptance of this slice cannot mark F044 APPROVED_COMPLETE.
The owner must later decide whether to retain the broader proposal direction or
explicitly reallocate feature scope; no reallocation is enacted here.

The wider journey stays Technology/brief -> AI outline -> Admin review and
exact-revision approval. F044 supplies management/proposal structures. F054's
reconciled intent owns bounded outline generation, with F052 provider and F053
security/budget prerequisites. F049/F050 own future editorial-state/review-decision
workflow; F051 owns publication. Their exact contracts and execution order need
separate approval. No provider/model, job, paid call or F052–F054 implementation
belongs to this slice.

## Dependencies and sequencing eligibility

- Reuse F017 LearningPath storage/constraints/indexes, F015/F043 Technology identity
  and protected list/detail, and F042 Admin account/session authority. Preserve
  F004/F005/F008 conventions. These are inspected implementation dependencies;
  the original F044 ticket did not declare them as formal fields.
- F042 mandatory HTTP/MongoDB verification and F043 real MongoDB/concurrency/
  cleanup qualification remain incomplete. Reusing source is not accepted
  prerequisite security evidence.
- Live stale-revision behavior matters before relying on F043 mutations; this
  slice adds none. Switching workspaces must preserve existing mutation uncertainty.
  A shared-boundary security defect suspends dependent work.
- Student visualization/completion QA is not a functional dependency of read-only
  Admin Path inspection. It remains outstanding. The 213-scenario backlog grants
  neither an F044 PASS nor a transferable browser exception.
- The default one-feature rule and historical F043-only exception remain intact.
  The separate 2026-11-02 named exception permits only this F044 read-only slice;
  backend A is authorized, frontend B/live verification/Git delivery are not.

## Approved read-only HTTP contract

Mount inside the existing createAdminRouter after namespace rate limits,
Bearer authentication and current-account requireAdmin. No parallel unguarded
mount. Reuse route -> controller -> service -> repository and injected test
dependencies. Public F017 endpoints and models remain unchanged.

| Method/path                          | Exact query                                 | Success             |
| ------------------------------------ | ------------------------------------------- | ------------------- |
| GET /api/v1/admin/learning-paths     | Required technologyId; optional page, limit | 200 list envelope   |
| GET /api/v1/admin/learning-paths/:id | Required technologyId only                  | 200 object envelope |

Required technologyId on detail is an owner-approved refinement of the earlier planning
sketch: the server binds the Path lookup to the selected parent. This does not
alter public F017 detail.

IDs must be exactly 24 hex characters, uppercase accepted and normalized to
lowercase at HTTP validation; frontend descriptors use canonical lowercase.
Reject whitespace, trailing newlines, malformed values and coercion. Reject
unknown/repeated/array/nested/dotted/operator query parameters. No search, status,
sort, private expansion or descendant query is supported.

page defaults to 1; limit to 20. Canonical positive decimal integer strings only:
no sign, zero, leading zero, fraction, exponent or whitespace. limit 1–100;
page 1–10001; (page - 1) * limit must be a safe integer <=10000. Beyond-bound
requests are 400; valid later pages are 200 empty. Order is order ASC, slug ASC,
_id ASC with simple binary collation. Duplicate observed parent-scoped slugs are
corrupt data, not an override of the unique index.

GET/framework-implied HEAD have no body: reject nonzero Content-Length,
Transfer-Encoding or decoded nonempty body before feature database work. Preserve
global parser/CORS/error ordering and bounds. HEAD has the same authorization/
headers without a body, not a new frontend capability. OPTIONS preserves existing
CORS. No mutation handlers; unsupported methods retain protected ROUTE_NOT_FOUND.

### Parent and Path visibility

| Authorized request condition                            | List                                                     | Detail                      |
| ------------------------------------------------------- | -------------------------------------------------------- | --------------------------- |
| Valid DRAFT/PUBLISHED/ARCHIVED parent                   | All three valid Path statuses for that parent            | Only matching Path/parent   |
| ARCHIVED parent                                         | Same read-only inspection with archived-parent UI notice | Same access/notice          |
| Missing/deleted parent                                  | 404 TECHNOLOGY_NOT_FOUND                                 | 404 LEARNING_PATH_NOT_FOUND |
| Missing/deleted Path, orphan, or Path of another parent | Excluded from selected-parent items/count                | 404 LEARNING_PATH_NOT_FOUND |
| Existing parent with zero paths or valid later page     | 200 empty list/correct metadata                          | Not applicable              |
| Observed malformed parent/Path identity, status or DTO  | 503 DEPENDENCY_UNAVAILABLE                               | 503 DEPENDENCY_UNAVAILABLE  |

Admin inspection is not PUBLISHED-only. Public F017/F020 published ancestry rules
remain unchanged. Unknown eligibility is never an empty inventory. No mismatch
reveals another parent's record or failed eligibility attribute. Counts and items
use identical selected-parent predicates.

Use bounded parent read/validation and one matched child aggregation with an
items/count facet. Detail matches both _id and technologyId. Recheck parent
existence/validity before returning; disappearance follows the 404 rules above.
This is not an instantaneous lifecycle lock, transaction snapshot or cross-request
page consistency guarantee. No read transaction, write fence, repair or adoption.

### Exact DTO and envelopes

List and detail share this explicit Learning Path DTO, with no descendants:

| Field                | Constraint                                                    |
| -------------------- | ------------------------------------------------------------- |
| id, technologyId     | Lowercase 24-hex strings                                      |
| title                | Trimmed nonblank 1–120-character string                       |
| slug                 | 1–100 lowercase ASCII kebab-case characters                   |
| description          | Plain string <=2000 characters, or null when absent           |
| targetLevel          | BEGINNER / INTERMEDIATE / ADVANCED, or null when absent       |
| completionScore      | Integer 0–100; configured threshold, never earned progress    |
| status               | DRAFT / PUBLISHED / ARCHIVED                                  |
| order                | Nonnegative safe integer                                      |
| revision             | Nonnegative safe integer projected from existing __v          |
| createdAt, updatedAt | Canonical UTC ISO millisecond strings; updatedAt >= createdAt |

Do not manufacture model defaults for malformed required persisted data. Exclude
_id/__v names, createdBy/updatedBy, accounts/credentials/sessions, raw MongoDB
fields, proposal/objective/prerequisite metadata, descendants, approval and
completion/mastery claims.

List envelope:

```text
{ success: true, data: LearningPathDTO[], message: null,
  meta: { requestId, page, limit, total, totalPages } }
```

Detail envelope:

```text
{ success: true, data: LearningPathDTO, message: null, meta: { requestId } }
```

requestId: nonempty string <=128 characters. Counts: nonnegative safe integers;
totalPages = ceil(total/limit), zero for empty data. At most limit items; unique
IDs/slugs, correct parent/order, requested page/limit, and consistent item/count
bounds. Frontend strict validation rejects unknown/private fields BEFORE any
projection can strip them, malformed timestamps, wrong identities and impossible
pagination. List and detail responses contain only their declared keys.

Errors retain the existing success:false, error:{code,message,details?},
meta:{requestId} envelope. Only validation errors may have the existing sanitized
schema-declared field/message array, at most 20 entries; never arbitrary details
objects. Render fixed client-safe messages, never raw server message/details.
Reject unknown/private nested fields before projection; do not print them.

| Status/code                                        | Meaning                                      |
| -------------------------------------------------- | -------------------------------------------- |
| 400 VALIDATION_ERROR                               | Invalid ID/query/body/bounds                 |
| 401 existing AUTH_ACCESS_TOKEN_*                   | Missing/invalid/expired JWT                  |
| 403 AUTH_FORBIDDEN / ORIGIN_NOT_ALLOWED            | Ineligible account/existing Origin refusal   |
| 404 TECHNOLOGY_NOT_FOUND / LEARNING_PATH_NOT_FOUND | Generic outcomes above                       |
| 404 ROUTE_NOT_FOUND                                | Protected unsupported method/path            |
| 413 PAYLOAD_TOO_LARGE / 415 UNSUPPORTED_MEDIA_TYPE | Existing applicable parser refusal           |
| 429 RATE_LIMIT_EXCEEDED                            | Namespace or feature budget                  |
| 503 DEPENDENCY_UNAVAILABLE                         | DB/data/identity/deadline uncertainty        |
| 500 INTERNAL_ERROR                                 | Existing sanitized unexpected-fault fallback |

All responses retain no-store, request IDs, security headers, CORS/absent-Origin
rules and template-only sanitized logs. No caching validators, cookie-auth
expansion, proxy trust, env key or new credential.

## Authorization, deadlines, cancellation and nonmutation

Require JWT ADMIN and current stored verified ACTIVE ADMIN on every request,
with identity solely from JWT sub. Refuse demoted/deleted/disabled/suspended/
unverified users. Preserve F042's five-second authorization-read cap, driver
cancellation and final deadline checks. UI eligibility/Technology DTOs are not
backend authority.

Preserve namespace 300/IP/15-minute and 120/account/15-minute admission. Proposed
feature read limit: 120/minute/Admin shared across both endpoints, HMAC-obscured
bounded process-local keys, 10000-live-key cap, no live counter eviction, store
exhaustion fail-closed. Both budgets apply. No multi-process enforcement claim.

Business-read cap: 10 seconds after admission. Primary DB reads receive remaining
timeouts and cancellation. Monotonic/final checks refuse expired work even with
delayed callbacks. Client request cap: 15 seconds including coordination queue,
headers and bounded body decoding, matching the current Admin pattern. Decode at
most 2 MiB UTF-8. Explicit Retry/Refresh only; no automatic retry loop or delay.

Client disconnect aborts owned work and suppresses late response sends. Dispose
timers/listeners in all paths. Current-account authorization is an admission-time
read, not a lock through serialization. Preserve stateless access-JWT/session-
revocation limits; no instant in-flight revocation claim. GETs add no User-version
fence or audit write to simulate stronger authority.

Frontend identity binds account, auth generation/session, selected Technology,
page and selected Path. Account/session loss/change, logout, workspace disconnect
or selection replacement aborts superseded reads and clears private state.
Late successes AND errors cannot enter another account/selection. Recheck after
transport/decoding and before state admission. Tokens never enter React state,
storage, URLs, logs or callbacks.

Add only a fixed read-only requestLearningPath capability to the existing Admin
controller with list/detail descriptors, no arbitrary URL/method/fetch callback.
Preserve coordination/expiry/logout. Learning Path reads must not clear F043's
Technology uncertainty flags or replay its mutations. Workspace switches during
an unconfirmed Technology operation retain existing reconciliation semantics.
Test that exact cross-workspace boundary.

Endpoint work only reads users/technologies/learningPaths. No domain, account
version, session, progress, audit, collection, index or fixture writes, lazy creation
or default repair. Existing operational request logs/in-memory rate counters are
allowed, not domain mutations. Existing login/refresh effects remain attributable
to auth, not F044 GETs.

## Navigation, states, accessibility and responsive behavior

Reuse AdminAccess/useAdminAuth, AdminShell, account/session coordination and F043
restricted Technology list/detail. Keep Technology Management the default eligible
workspace with its current initial request.

Add an in-memory switch in App at existing Admin /: native Technology Management
and Learning Paths buttons in a labelled group, aria-pressed for current selection.
No router, deep links, history promise or package. Deliberate workspace switches
focus destination heading; background reads do not steal focus. Preserve logout.

Learning Paths starts with a labelled paginated Technology chooser, F043 page 1/
limit 20 and slug ordering. No fetch-all dropdown or background prefetch. Changing
chooser page clears parent/child selection. Selecting a validated actual parent
loads child page 1/limit 20, only after genuine Admin session readiness.
Show parent name/status as last-loaded metadata, archived status explicitly.
Refresh reloads parent detail then child data; separate reads are not a snapshot.
Parent disappearance clears children and returns to selection.

Table: title, status, target level (Not specified for null), order, updated date.
Detail: exact existing DTO metadata, slug, revision, plain description and semantic
timestamps. Label completionScore “Configured completion threshold,” never
personal progress. No edit/approve/generate/delete controls or fake metrics.

States: no selection, parent loading/empty/error, Path loading/empty/later page,
ready/detail, removed/unavailable detail, expired/denied access, rate limit,
dependency/network/timeout/invalid response and cancellation. Clear stale content
on identity changes. Retry keeps only the validated current read descriptor.
401/403 use existing auth invalidation; no local authorization fallback.
An empty later page permits Previous; a missing parent returns to the chooser.

Use current approved Stitch tokens/local CSS, no CDN/scripts/fonts or redesign.
Semantic headings, table caption, native labelled buttons, loading/error live
regions, visible focus, keyboard-operable labelled table scroll region, no focus
trap/page overflow. Stack detail below table on small screens; wrap long titles/
slugs. Verify 1440/768/390/320px, keyboard, zoom and contrast. No new motion.
SSR/CSS evidence never implies real-browser accessibility/responsiveness PASS.

## Approved inventory and separately gated checkpoints

These inspected paths follow F043's existing architecture. CREATE means absent at
planning; MODIFY means existing, including this document after preparation.
Checkpoint A source implementation was separately authorized on 2026-11-02;
Checkpoint B source implementation and every Git delivery remain separately gated.
Any additional path requires owner approval before editing. AGENTS.md enactment
was also explicitly authorized; it does not expand application implementation.

### Checkpoint A — backend read-only API: 10 CREATE + 5 MODIFY

CREATE:

```text
apps/api/src/modules/admin/learning-paths/admin-learning-path-rate-limit.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path.controller.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path.dto.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path.repository.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path.routes.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path.schema.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path.service.ts
apps/api/tests/admin-learning-path.test.ts
apps/api/tests/admin-learning-path-routes.test.ts
apps/api/tests/admin-learning-path.integration.ts
```

MODIFY:

```text
apps/api/src/app.ts
apps/api/src/modules/admin/admin.routes.ts
docs/API_DESIGN.md
docs/DEVELOPMENT_ROADMAP.md
docs/features/F044-admin-learning-path-management.md
```

App/router changes: injection and guarded mount only, no global parser/auth reorder.
DTO/query stay local. API_DESIGN transfer follows owner contract approval.
No LearningPath/User/Technology/Audit model, public API, DB-design, configuration
or integration-adapter change.

### Checkpoint B — frontend inspection workspace: 10 CREATE + 6 MODIFY

CREATE:

```text
apps/admin/src/lib/learning-paths/contracts.ts
apps/admin/src/lib/learning-paths/learning-path-client.ts
apps/admin/src/lib/learning-paths/learning-path-controller.ts
apps/admin/src/hooks/use-learning-paths.ts
apps/admin/src/components/learning-paths/learning-path-manager.tsx
apps/admin/src/components/learning-paths/learning-path-manager.module.css
apps/admin/tests/learning-path-client.test.ts
apps/admin/tests/learning-path-controller.test.ts
apps/admin/tests/learning-path-rendering.test.ts
tests/browser/admin-learning-paths.spec.ts
```

MODIFY:

```text
apps/admin/src/lib/auth/admin-controller.ts
apps/admin/tests/admin-controller.test.ts
apps/admin/src/app/app.tsx
apps/admin/tests/admin-rendering.test.ts
docs/DEVELOPMENT_ROADMAP.md
docs/features/F044-admin-learning-path-management.md
```

Admin controller extends fixed read capability under existing token custody.
App test loader/assertions support the new import/navigation. Keep default F043
requests/browser allowlists valid. If an additional browser-spec modification is
necessary, STOP for that exact approval, not a silent F042/F043 test expansion.
No Shell/global CSS/Student/auth contract-client/package/dependency changes.

A/B contain 31 entries, 29 distinct paths because feature document/roadmap recur.
AGENTS.md is outside both implementation checkpoints. Enacting a sequencing
amendment needs its own exact documentation approval. No commit message or Git
delivery is approved here. Future checkpoints must label incomplete verification.

## Verification plan and measurable gates

### Offline after separate implementation approval

Backend tests: JWT/current-account refusal, protected mount/no-store/error order;
ID/query/body/offset limits; all parent/Path statuses; archived/absent/mismatched/
orphan/corrupt targets; identical item/count predicates; ordering/empty/later pages;
strict DTO privacy; primary/dependency failure; delayed deadline callbacks;
cancellation/late reads; limiter capacity/isolation; GET/HEAD nonmutation and
unsupported methods. Check RAW decoded JSON for nested private data before schema
projection, preserving the earlier test-privacy correction.

Frontend tests: fixed-origin/method descriptors, no-cookie Bearer transport,
2 MiB decoding bound/strict DTOs, parent/page/ID matching, safe errors, every state,
readiness/account/session/parent races, cancellation, no auto-retry, queue deadlines
and no persistent tokens. Rendering: default workspace/navigation, archived/empty
states, escaped text, semantics, responsive containment and threshold labelling.
Regress returning to F043 after an unconfirmed mutation without clearing its
reconciliation flag/replaying a write. Preserve the authentication readiness fix.

Run affected Admin/API and F017/F043 regressions, builds, TypeScript, lint,
formatting, UTF-8/LF, diff/scope/privacy checks. No blind rerun of unrelated blocked
suites. Record actual FAIL/NOT_RUN/startup errors. After implementation require
fresh independent Critical/High/Medium/Low review; resolve all findings before
checkpoint eligibility. This drafting task claims no independent source review.

### Separately authorized live verification and database prerequisites

This preparation performs no DB connection/schema/index check, listener probe,
service startup or provisioning. Runtime availability is NOT_VERIFIED by this
contract. Reuse qualified infrastructure, but do not invent adapter architecture,
reuse a prior manifest unchanged or expand scope without approval.

Require a specifically authorized exclusively owned disposable replica-set target,
verified executable/process/native handle/Job identity, owner/UTC creation time,
protected-resource separation, bounded startup/read/cleanup and authenticated
evidence. Never implicitly use protected 27017, legacy 27018 or persistent app
data as a disposable target. Writable PRIMARY qualification precedes application
enumeration/fixtures under the approved execution contract. Initial qualification
connection/startup needs separate exact execution authority.

Minimal domain footprint: existing users, technologies, learningPaths, synthetic
ownership-marked fixtures. Existing indexes: normal _id, Technology unique slug
and status/order, LearningPath unique technologyId/slug and technologyId/status/
order, plus canonical User indexes needed by the chosen auth fixture.
Freeze the exact full collection/index/fixture/source manifest before execution
approval; do not inherit F043 counts. No new schema/index is proposed. Existing
indexes do not imply a fully covered all-status sort; qualify bounded read
performance without adding an unapproved index. Missing prerequisites block,
never auto-create/provision or change privileges.

Prepared integration must prove real stored eligibility, all statuses, parent
mismatch/orphan privacy, actual sorting/pagination, corrupt/missing data refusal
and nonmutation. Fixture setup/teardown is a separately approved owned write
scope, never endpoint behavior. Compare records, account versions and protected
baselines before/after GETs; remove only marked owned resources. No global reset.
Require exact case manifest, per-case PASS/FAIL/NOT_RUN, authenticated RESULT and
matching digest ACK, owned exits/empty Job/closed handles/released resources and
unchanged baselines. No automatic retry/guessed-PID cleanup; UNKNOWN stays UNKNOWN.

Live frontend/API checks need the reviewed read contract, specifically authorized
existing local/test environment/data/roles and owner-entered Chrome credentials.
No bootstrap/reseed or Admin writes to manufacture state. Smoke: login/default
Technology workspace; switch/select parent; all statuses/detail; archived parent;
missing parent/Path; empty/later pages; Refresh/Retry; rapid parent replacement;
logout/account switch while loading; keyboard/focus and four widths. Capture only
sanitized statuses/visible observations, no tokens/cookies/raw internal records.

Plan 12 future browser cases: B01 navigation/default workspace; B02 parent paging;
B03 child sort/paging; B04 detail parent binding; B05 all Path statuses; B06 archived
parent; B07 missing/mismatched target; B08 empty/later page; B09 explicit retry/
errors; B10 account/logout stale response; B11 keyboard/focus; B12 four-width
containment. These are PLANNED, NOT PREPARED OR EXECUTED, not additions to the
prepared backlog. Existing 213 remain NOT_RUN. Mocked browser tests prove UI,
not live DB or frontend/API integration. Primary-host Playwright still requires
separately qualified/approved execution; no inherited browser exception.

### Read-only slice acceptance checklist, not full F044 completion

- Exact endpoints, parent/status/error behavior, DTOs and bounds implemented.
- Public F017/F020 and existing F043/auth behavior unchanged.
- Actual focused/regression assertions, builds/static/scope/privacy checks pass;
  zero unresolved independent review findings.
- Account/selection cancellation and nonmutation proven at the appropriate layers.
- Separate real DB manifest complete with authenticated RESULT/ACK, safe cleanup
  and unchanged protected baselines; no partial or UNKNOWN becomes PASS.
- Real authorized UI/API smoke and applicable browser/accessibility checks execute,
  or an explicit named browser-only deferral records exact unverified gaps.
- F042/F043 mandatory prerequisites remain a final acceptance gate; offline reuse
  and manual smoke cannot close them.
- Owner slice acceptance, local checkpoint and remote delivery are separate gates.
  This checklist cannot mark full F044 complete.

## Named F044 read-only sequencing exception — ENACTED 2026-11-02

> The owner separately approved this limited exception on 2026-11-02; it is
> enacted in AGENTS.md. Backend Checkpoint A implementation/offline verification
> is authorized. Frontend implementation, live execution and Git are not.
>
> The owner may separately approve only F044 Technology selection and read-only
> Learning Path inventory/detail backend/frontend checkpoints while F042/F043
> remain IN_PROGRESS, acceptance BLOCKED. No authoring, generation, approval,
> publishing, deletion, schema expansion, F052–F054 work, other F044 slice or
> F045/later feature is authorized. The default one-feature rule remains effective
> outside this exact scope.
>
> Before implementation the owner must approve/enact this exception, exact HTTP/
> DTO/parent/navigation contract and checkpoint inventory; separately approve the
> selected source slice; verify baseline/scope and applicable retained offline
> evidence; and establish no unresolved application security defect invalidates
> the dependency. Critical/High findings block continuation. Documentation alone
> causes no automatic status transition or acceptance.
>
> Reuse F042 Admin and F043 selection/session architecture as unverified
> prerequisites, never accepted security evidence. Preserve their historical
> failures/UNKNOWNs, incomplete RESULT/ACK and cleanup/baseline limitations. Live
> stale-revision and Student learning observations remain unresolved; infer no
> defect or PASS. A shared-boundary defect requires owner reassessment.
> Technology mutation uncertainty must remain intact.
>
> After implementation require applicable offline checks and fresh independent
> review, all findings resolved before checkpoint eligibility. Live HTTP/DB/
> browser verification needs separate qualified environment, isolated target/data/
> source manifest, ownership, secret safety, deadlines, authenticated RESULT/ACK
> and cleanup approval. No runtime operation or permission change is granted.
>
> Final acceptance requires mandatory F042/F043 prerequisite verification and
> this slice's own applicable real verification plus explicit owner approval.
> Existing browser exceptions do not transfer. Every commit/push needs separate
> approval. Production stays NOT_VERIFIED; preserve the 213 NOT_RUN backlog until
> specific qualified scenarios actually execute.

## Owner decisions, estimate and next gate

Owner decisions 1–5 below were resolved by the 2026-11-02 authorization for
read-only contract/enactment/backend A only; frontend B and decision 6 remain
separately gated. Original decision inventory is retained:

1. Approve read-only scope as partial F044 progress while retaining the broader
   proposal direction and withholding full feature completion.
2. Approve required technologyId on detail, archived-parent Admin inspection,
   exact DTO/paging/errors/limits and no-schema-expansion boundary.
3. Approve in-memory navigation/default Technology workspace and exact A/B
   inventories, no new router/shared package/dependency.
4. Approve/enact the limited sequencing text in separately inventoried documents.
   This task changes no active AGENTS.md or roadmap sequencing rule.
5. Separately approve A implementation/offline checks; B follows stable reviewed
   backend contracts and its own explicit approval.
6. Later reconcile exact disposable fixtures/indexes/result/source manifest and
   particular live execution. No qualified new environment is asserted here.

Implementation estimate after approval: 4–7 engineering hours for A/B, offline
checks and review; separately scheduled real DB/UI/browser work adds uncertainty.
Environment qualification, available test data and review findings cannot justify
open-ended infrastructure expansion or weaker deadlines.

Documentation estimate: 15–25 minutes; actual elapsed/check outcomes appear in the
task report. Implementation/check outcomes will be appended truthfully below. F044 remains
IN_PROGRESS, acceptance BLOCKED; no runtime PASS is implied. STOP after backend A
offline review; do not start frontend B or Git delivery.

## Backend Checkpoint A implementation and offline review — 2026-11-02

The owner approved contract choices, partial progress, the bounded sequencing
exception and backend implementation. Complete contract/model/architecture review
found no material conflict before dependent source changes. AGENTS.md enacted only
the named read-only exception; the roadmap pointer now records F044 backend A,
with F042/F043 still open verification features. Their histories remain intact.
The owner confirmed development watchers stopped before source copies, preventing
an unintended hot-reload restart during this offline-only task.

Implemented the approved protected GET inventory/detail with required technologyId,
all three Path/parent statuses including archived-parent inspection, exact DTO,
canonical query bounds/order, parent rechecks, no-store, bounded primary reads,
shared feature limits and terminal cancellation/deadline handling. No model,
schema/index, public API, authentication policy, frontend or dependency changed.
There are exactly 16 pending paths: all 15 backend inventory paths plus AGENTS.md
for the separately authorized exception. No Git staging/commit/push occurred.

### Checks actually executed

- Final focused service/repository/router/lifecycle tests: **94 PASS / 0 FAIL**,
  no skipped/cancelled cases. Initial 89 PASS preceded review regressions; reruns
  are not added to distinct counts.
- Existing F042 eligibility, F043 Technology/audit and F017 model/public-read
  regressions: **120 PASS / 0 FAIL** across five files.
- Existing F043 in-process router/parser regressions: **15 PASS / 0 FAIL**. The
  one real-app HTTP listener case was explicitly excluded with test-skip-pattern,
  because server startup/live HTTP was outside this authorization. It did not run
  and is not claimed PASS. The 213 browser backlog is unchanged.
- **229 distinct executed offline tests PASS**, not real DB/browser evidence.
- API production build (existing TypeScript compiler) and production no-emit
  check: PASS. Focused TypeScript covering all API production source and the three
  new F044 test files: PASS, no diagnostic.
- Full existing API/test typecheck: **FAIL**, two TS2322 diagnostics at unchanged
  apps/api/tests/dev-mongo-bootstrap.test.ts:2103. An in-memory unmodified-HEAD
  comparison reproduced those exact two diagnostics without F044 files/imports.
  This pre-existing out-of-scope test typing issue was not edited or hidden by
  the passing focused check. No whole-workspace TypeScript PASS is claimed.
- A first local helper attempt could not resolve Node types/read the baseline in
  its default sandbox context. The corrected focused-config path and supported
  command-specific context produced the results above; no configuration or
  permission-policy change was made.
- Targeted lint initially found one unused integration-test import, then PASS
  after its removal. Formatting of all affected TS and this feature document,
  UTF-8/LF, whitespace/scope/privacy checks pass. Canonical document history and
  surrounding formatting were preserved instead of mass reformatting.

### Independent review and corrections

A separate fresh-context reviewer read actual production, test-support and policy/
documentation diffs without implementing them or executing tests. Initial findings:
Critical 0 / High 0 / Medium 1 / Low 3. All four were corrected and independently
rereviewed: **zero unresolved Critical/High/Medium/Low findings**.

The Medium issue allowed timed-out prepared integration callbacks to emit a later
observed PASS. Parent/subtest signals now trigger terminal loss, are checked around
ownership and immediately before PASS, and prevent later case work. Low fixes:
suppress late error sends on disconnect while propagating connected failures;
dispose ownership-loss handlers across malformed/setup paths; sanitize all parent
setup/qualification/snapshot/disposal failures without retaining private causes.
New inert regressions prove these paths, listener cleanup and delayed loss refusal.
Pure test-support lifecycle helpers grant no ownership or qualification authority.
The separate self-review and independently executed source review are distinct;
the independent reviewer did not run live verification.

### Prepared integration and remaining gates

The new integration file is import-inert, guarded by existing supervised-fixture
capability checks and contains **PARENT + T01–T08: all 9 NOT_RUN**, no authenticated
counters or RESULT/ACK. It covers real list/status/parent/detail/order/pagination,
stored eligibility refusal and domain nonmutation only when separately qualified.
There is no new adapter or execution authorization; its complete fixture/index/
source/result reconciliation and runtime ownership/cleanup still need approval.
Real DB performance, forced real timeout, HTTP transport, live frontend/API and
browser behavior remain NOT_VERIFIED. Operational observed PASS is never treated
as an authenticated integration result.

Backend A is READY_FOR_REVIEW — offline only. Its F044 source contract is stable
for a separate frontend B implementation decision; retain the baseline whole-test
TypeScript blocker explicitly and do not silently fix it outside scope. Frontend
B remains NOT_STARTED. F044 stays IN_PROGRESS with acceptance BLOCKED; F042/F043
acceptance BLOCKED, manual observations unresolved, 213 browser scenarios NOT_RUN
and production readiness NOT_VERIFIED. No live service/DB/browser/AI/Git operation
was performed. STOP for owner review and separate next-slice authorization.

## Frontend Checkpoint B authorization - 2026-11-03

Owner separately authorized exactly the 16 frontend inventory paths for read-only
implementation and focused offline verification. Earlier frontend prohibitions
above are historical gates, superseded only by this named authorization. Backend
Checkpoint A reviewed hashes were revalidated before editing and are preserved.
No live execution, feature acceptance or Git delivery is authorized.

## Frontend Checkpoint B implementation and offline review — 2026-11-03

Owner approval separately authorized the exact 16-path B inventory. Preflight
confirmed dev/47a049d496d8f83b995a28b1dc56455ea5bb0d77, empty index, exactly
16 prior pending paths and every reviewed Checkpoint A hash matching the retained
report. The two shared documentation files now carry B evidence; all 14 nonshared
Checkpoint A paths remain byte-for-byte unchanged. A/B's 29 distinct inventory
paths plus the previously authorized AGENTS.md amendment give 30 pending paths.
No additional source, package, configuration or API contract change was needed.

Implemented native in-memory workspace buttons at existing Admin /; Technology
Management remains the default with its original initial request. Explicit switches
focus the destination heading. Learning Paths loads only one bounded Technology
chooser page, then parent-bound Path list/detail reads. It shows all actual statuses,
archived-parent notice, last-loaded parent metadata, explicit loading/empty/later
page/error/retry states and exact read-only DTO metadata. Completion threshold is
labelled as configuration, never personal progress. There are no authoring, editing,
AI generation, editorial approval, publication or deletion controls. Existing
Stitch tokens, wrapping/local scroll, native buttons, table/time semantics and
focus styles are reused; no Shell/global CSS/Student changes.

A fixed GET-only requestLearningPath capability stays inside the existing Admin
controller's private token custody. Strict raw envelopes/DTOs reject unknown and
nested private fields before projection; parent, record, page/order/count and
canonical IDs/timestamps are verified. Requests use approved origins, Bearer with
no cookies, no-store, redirect refusal, a 2 MiB decode cap and a 15-second budget
including queue/decode/final checks. Account/session/selection/page/workspace loss
cancels or suppresses both old successes and errors. Explicit Retry/Refresh only;
no automatic replay. F043's uncertain mutation flag survives the new workspace;
reads never reconcile it. No authentication-policy or backend change.

### Checks actually executed for B

- Initial nine-file offline run: 377 cases, 376 PASS / 1 FAIL. The new detail-loading
  render assertion exposed a missing aria-busy marker; workspace busy semantics
  were corrected. Failure is retained, not relabelled as environmental.
- After corrections/additional navigation, hook and actual-coordinator queue tests,
  final five changed-file run: **233 PASS / 0 FAIL / 0 skipped / 0 cancelled**.
  The four unchanged relevant Admin/Technology regression files passed **150**
  cases in the initial run. Thus **383 distinct offline cases PASS** in this task;
  reruns are not added again. All transports were mocked, rendering was inert SSR
  or event doubles, and no server listener or browser was started.
- Admin production build/typecheck: PASS. Targeted lint and formatting: PASS.
  Separate in-memory strict TypeScript covering all Admin source/test files plus
  the prepared F044 browser spec: PASS. Its first run found four test-only typing
  diagnostics (two request-union inference, one fixture email, one component-call
  type); all were corrected inside the approved tests and the check reran clean.
- Vite reports its nonfatal ineffective dynamic-import warning for env.ts, which
  is also statically imported. No chunking/security behavior is claimed changed.
- Known full API/test TypeScript FAIL remains the two unchanged baseline TS2322
  at dev-mongo-bootstrap.test.ts:2103 established during A. API sources/tests and
  their checkpoint hashes were unchanged; that unrelated suite was not rerun or
  repaired. No whole-repository TypeScript PASS is claimed.
- UTF-8/LF, reviewed hashes, exact scope, diff whitespace, raw privacy/source and
  sensitive-pattern checks pass. Existing canonical Markdown hard-break spaces
  and historical evidence remain intact. No new dependency or Git write.

### Independent source review versus runtime evidence

Self-review and a separate fresh-context read-only reviewer examined actual
contracts/client/controller/hook/UI/tests/policy. Independent review initially
found Critical 0 / High 0 / Medium 1 / Low 3, all in prepared browser-test safety/
quality: mock fixture was not automatic in every case; status test could accept
old detail; logout case released data before invalidation; chooser case did not
actually page. Rereview identified one additional Low: viewport assertions could
run before inventory/detail loaded. All five are corrected in the existing spec:
automatic strict network interception; actual status/request assertions; bounded
held-response ordering; real chooser next/previous and child clearing; loaded
table/detail assertions at each width. Final independent source rereview confirmed
zero unresolved Critical/High/Medium/Low findings and independently verified all
14 nonshared Checkpoint A hashes unchanged. The reviewer did not execute tests or
live verification. A suggested coordinator race was retracted
after checking Promise.race ordering; four regressions using the actual coordinator
confirm queued cancellation/deadline refusal without losing current eligibility.
No production change was made for that unconfirmed hypothesis.

### Browser preparation and bounded future live plan

The earlier 12-case planning paragraph is historical. F044-B01–B12 are now
PREPARED, all **12 NOT_RUN**, in admin-learning-paths.spec.ts. The inherited **213
NOT_RUN** remain unchanged; combined prepared backlog is **225 NOT_RUN**. Browser
specs use isolated synthetic mocks only and prove neither live API nor MongoDB
behavior. No Chrome, Playwright, screen-reader, real focus/viewport/contrast or
live frontend-to-API PASS is claimed. Static/SSR checks are limited evidence.

For a separately approved bounded live phase, first freeze exact reviewed sources
and the target/data/role/result manifest, qualify the approved isolated environment
and ownership/cleanup controls, and confirm F042/F043 prerequisite gates. Run the
nine prepared real F044 records once with authenticated RESULT/digest ACK and
nonmutation/protected-baseline/cleanup proof. No existing index or fixture is
assumed present; no provisioning, reseeding or protected-target adoption is implicit.

Separately authorize UI/API smoke in the existing approved local environment with
owner-entered credentials: default workspace, parent selection and paging, all
statuses/detail, archived/missing parent, explicit Refresh/Retry, rapid parent
replacement and logout/account switching. Allow 20–30 minutes, stop on unsafe
ownership or unexplained data changes. Qualified browser B01–B12 then checks
loaded inventory/detail at 1440/768/390/320px and keyboard/focus. Mock suite and
live API smoke require distinct evidence and no inherited browser exception.
Real screen-reader/accessibility evaluation remains a separate unverified check.

F044 stays IN_PROGRESS, partial scope only, acceptance BLOCKED. Backend A stays
READY_FOR_REVIEW — offline only; frontend B is READY_FOR_REVIEW — offline only,
not accepted and no live UI completion claimed. F042/F043 acceptance BLOCKED,
manual observations unresolved, nine F044 real records NOT_RUN and production
readiness NOT_VERIFIED. Git staging/commit/push and every live execution still
require separate owner approval. STOP after offline review.

## Test-support reconciliation — 2026-11-03

Owner authorization covers support preparation and offline checks only. No guarded
invocation, MongoDB connection, fixture/index creation, application/listener startup,
browser launch, credential generation or Git delivery occurred. The original
30-path A/B scope and checkpoint fingerprints were verified first. All reviewed
production/frontend files remain byte-identical. The prepared integration entry
point changes only fixture binding and adds an orphan-parent assertion. The two
shared documentation files retain their full historical evidence.

### Exact support changes

- .cache/f043-slice1-supervised-host.mjs: fixed optional F044 profile in the existing
  supervisor, exact PARENT/T01–T08 registration, F044_RESULT_V1 digest and ACK binding.
- .cache/f043-slice1-supervised-launcher.ps1: same native owner/private channel,
  feature-specific parser/counts/source/index profile; F043 remains the default.
- .cache/f043-slice1-guarded-runner.ps1: fixed F044 invocation/evidence/storage and
  attempt identity; selected source/index manifest; forced containment cannot exit
  successfully. Exact TEMP/reparse-point/exclusive-root cleanup checks remain.
- .cache/f044-slice1-adapter.ps1: thin gated entry to that existing supervisor;
  no new supervisor, credential transport, automatic retry or runtime permission.
- .cache/f044-slice1-fixture.mjs: import-inert, exclusively disposable synthetic
  fixture preparation and exact target/index qualification for future execution.
- .cache/f044-slice1-index-manifest.json: exact 27 explicit canonical definitions.
- .cache/f044-slice1-source-pins.json: frozen current repository/support bytes.
- .cache/f044-slice1-execution-manifest.json: HEAD, runtime pins, identities,
  deadlines, artifacts, commands, prerequisites and prepared-only limitations.
- .cache/f044-slice1-protocol.test.mjs: inert registration/protocol/fixture/manifest
  regressions, including real in-memory supervisor stream ACK validation.
- .cache/f044-slice1-launcher.tests.ps1: pure parser/frames/approval-refusal checks.
- apps/api/tests/admin-learning-path.integration.ts: isolated corrupt parent and
  owned orphan fixture; existing assertions and 100-record snapshots preserved.
- tests/browser/admin-learning-paths.spec.ts: only fixed application/API origins
  aligned to 127.0.0.1; all 12 prepared cases retained.
- playwright.f044.config.ts: explicit F044 selection, no webServer, one worker,
  zero retries, bounded suite; unrelated/default smoke selection unchanged.
- docs/features/F044-admin-learning-path-management.md and
  docs/DEVELOPMENT_ROADMAP.md: this preparation evidence and runtime blockers.

Thus 15 support/documentation paths were touched in this task, 10 ignored .cache
paths and five tracked/untracked repository paths. Only playwright.f044.config.ts
adds to the prior 30-path repository inventory: **31 pending paths**, index empty.
No F043 fixture/index/frozen manifest/test/evidence file was rewritten. Shared
adapter content necessarily changed; old F043 frozen pins must refuse that drift.
F043 historical results are not F044 evidence and its old runtime pins are not
silently refreshed.

### Frozen preparation and fixture/index reconciliation

The exact approved absolute ripgrep executable passed SHA-256 verification and
--no-config/exit-status source enumeration. Frozen scope is **618 repository files + 29 supplemental pins = 647 content pins**.
AGENTS.md remains an explicit pin because the inherited ignore rule excludes it
from ripgrep enumeration. The source manifest excludes itself, uses separately
approved SHA-256 at invocation, and is held read-locked by the existing runner.
Obtain its final fingerprint independently with Get-FileHash; no self-referential
digest is written into pinned documents.

The execution record binds dev baseline
47a049d496d8f83b995a28b1dc56455ea5bb0d77, current pending/support bytes through the
source manifest, inherited F043 source-history hashes, Node/MongoDB/ripgrep pins,
fixture IDs, 19 collections and 27 explicit indexes (46 including 19 _id indexes).
The added Learning Path indexes are technologyId_1_slug_1, unique, and
technologyId_1_status_1_order_1, nonunique, matching the existing model exactly.
No physical index/database existence or correctness is claimed from declarations.

T03 uses a clean archived Technology with one valid Path. T07 uses a separate
DRAFT Technology holding the deliberately corrupt Path; corrupt inventory is
never tolerated by T03. An owned orphan references a missing parent and must return
LEARNING_PATH_NOT_FOUND. Provisioned future fixtures: seven synthetic users (six
after the owned deleted-account case), four Technologies and six Paths, all under
the unchanged 100-record per-collection snapshot bound. Ownership-marked fixtures
exist only in fresh exclusive disposable storage; no shared-record cleanup/adoption.

Existing guarantees remain: five-second RPC/ACK, two-second heartbeat, monotonic
and absolute expiry, 180-second suite, 205-second supervision, exact process/Job
checks, fresh mutation-boundary ownership, private credentials, complete nine-record
RESULT ledger/digest ACK and no automatic retries. Forced containment is failure
evidence, never graceful cleanup or passing acceptance.

### Checks actually executed and retained failures

- F044 inert Node protocol/manifest suite: **30 PASS / 0 FAIL**. It runs actual
  integration registration/assertion bodies with injected inert modules, not a real
  database. Actual node:test child-process registration remains a runtime prerequisite.
- F043 relevant existing protocol compatibility: **106 PASS / 0 FAIL**; the existing
  child-CLI registration case was explicitly excluded before execution because no
  runtime child launch is authorized. No unrelated passing suite was rerun.
- Pure F044 PowerShell checks: **17 PASS**, including shared PS parsing, no-approval
  refusal, unchanged F043 golden digest, cross-runtime F044 digest and rejection of
  wrong feature, count/order/identity/private fields/nonce/generation/counters.
- Focused no-emit TypeScript for API production plus changed integration entry point,
  and separately the prepared browser spec/config: PASS. Targeted tracked-file lint:
  PASS. Ignored Node support lint uses Node globals only in the invocation; its
  initial unused destructured options diagnostic was corrected in the test helper.
- Playwright --list discovered exactly **12 F044 cases in one file**. Discovery is
  not execution: all 12 remain NOT_RUN; combined backlog **225 NOT_RUN**.
- Initial new protocol run: 25 PASS / 2 FAIL (test output-stream autoDestroy behavior
  and comment matching in the config assertion). After correction, a new path test
  initially failed because it expected different guard wording (27 PASS / 1 FAIL).
  The test now checks the actual existing TEMP-containment guards. The first pure PS
  digest check refused a fixture vector with a different diagnostic record; the
  explicit PARENT vector was corrected, retaining strict parser/digest validation.
  These offline test-support failures remain historical, not relabelled as PASS.
- Existing A/B offline test/build results remain historical and were not rerun.
  The two unrelated full API/test TS2322 errors at dev-mongo-bootstrap.test.ts:2103
  remain unresolved baseline failures; no whole-repository TypeScript PASS claimed.

Self-review covered exact scope, nonmutation, private-field rejection and fixture/
cleanup boundaries. A separate fresh-context reviewer found one Medium: startup
and cleanup exact basename checks still used F043 while creation used F044. Both
now use the same fixed profile, with inert regression coverage. Final fresh-context
independent rereview confirmed **Critical 0 / High 0 / Medium 0 / Low 0 unresolved**.
The reviewer independently checked all 647 content hashes with no missing,
mismatched or duplicate paths. This is source/security preparation review only,
not runtime qualification or integration acceptance. Documentation-only wording
reconciliation is refrozen afterward; no passing suites are rerun unnecessarily.

Final scope/UTF-8/LF/formatting/diff/privacy/history checks PASS. All 26 prior
checkpoint paths outside the four existing support/documentation changes remain
byte-identical, and all five immutable inherited F043 history files match their
retained hashes. The first local integrity-report helper removed the leading status
space and falsely refused PENDING_SCOPE; its read-only parser was corrected and
the exact 31-path inventory passed. No repository change was made for that helper
failure. Ignored Node support lint passed after the test-only unused binding fix.

### Runtime readiness and separate future actions

**Runtime execution remains BLOCKED.** Read-only filesystem inspection established
that the previously approved Microsoft PowerShell 7.6.8 WindowsApps executable is
absent. Its execution-manifest SHA is deliberately null. The thin adapter refuses
APPROVED_POWERSHELL_PIN_UNAVAILABLE before process/database effects; no substitute
shell, PATH fallback or credential workaround is approved. Pure offline checks do
not qualify their executing shell as the approved guarded runtime.

Node/MongoDB pins are retained prepared pins, not fresh executable/process evidence.
Native retained-handle resolved-path/read-lock ripgrep checks remain mandatory at
runtime and were not exercised here. Protected MongoDB process identity and actual
current baseline remain UNKNOWN. Existing baseline code observes all unrelated
Node/mongod processes, selected ports and legacy protected storage. It is not proof
of current persistent 27019 storage protection: explicitly qualify that coverage
before future execution, preserving all discrepancies. Do not infer protection
from a port, URI or PID. No Windows/CIM/port inquiry was performed in this task.

Next approval must resolve the available approved PowerShell identity/pin and
protected-baseline applicability, reconcile/refreeze affected support bytes, then
authorize one guarded invocation with the exact resulting manifest fingerprint.
Require unelevated least-privileged process-owner/CIM/retained-handle/Job/port/file
queries, available exclusive 27018/4000 and no leftover/concurrent disposable run.
No permission change, provisioning or runtime approval is implied by this document.

Prepared guarded command, **not executable approval**:

```powershell
. .\.cache\f044-slice1-adapter.ps1
Invoke-F044GuardedRun -ApprovedGuardedExecution -ApprovedSyntheticFixtureCredentials -ApprovedManifestSha256 '<OWNER_APPROVED_FROZEN_SHA256>'
```

After static qualification, the existing runner alone may start its owned 27018
replica. A bounded connection to only that owned process may establish identity/
PRIMARY; database enumeration, 27-index provisioning and fixture writes require
successful runtime qualification and separate explicit owner authorization.
Expected sanitized artifacts are under .cache/f044-slice1-run-<runId>/ as enumerated
in the execution manifest: result/context/source-before-after/executable/index/
storage/mongo/protected/shutdown/timing evidence. No credentials/private channel
material belongs in any artifact. Require authenticated 9 PASS/0 FAIL/0 NOT_RUN,
matching ACK, successful owned exits, empty Job, closed handles, removed exact owned
storage, released disposable ports and unchanged protected/source/environment
baselines. Missing/ambiguous proof is UNKNOWN; no retry or marker reset.

Separate future owner smoke command: npm run dev:local in the existing approved
interactive environment, only after its normal prerequisites and startup approval.
Admin origin http://127.0.0.1:5173; API origin http://127.0.0.1:4000. Owner enters
private credentials only in the browser. Smoke is supplemental live UI/API evidence
and must not run concurrently with disposable integration requiring port 4000 free.

Separate future browser command:

```text
node node_modules/@playwright/test/cli.js test --config=playwright.f044.config.ts --workers=1 --retries=0
```

It selects F044-B01–B12 with synthetic strict mocked-network interception, not real
API-backed assertions. No automatic webServer; qualified approved application and
browser ownership/cleanup are separate prerequisites. Primary-host browser
restrictions and no inherited exception remain. No trace/video/raw credential
capture. Default chrome-smoke selection and unrelated suites are unchanged.

F044 remains IN_PROGRESS; A/B READY_FOR_REVIEW — offline only; acceptance BLOCKED.
F042/F043 acceptance BLOCKED, manual gaps unresolved, **nine real integration
records NOT_RUN**, **225 browser cases NOT_RUN**, production NOT_VERIFIED. STOP
after support preparation; no Git staging, commit or push.

## Runtime prerequisite discovery — 2026-11-03

Owner authorization: read-only local runtime/unelevated ownership discovery and
necessary support/documentation changes only. Starting state verified dev at
47a049d496d8f83b995a28b1dc56455ea5bb0d77, exact31 pending paths, empty index,
all prior reviewed fingerprints and historical D69E3ABF773F47F0669924E1A1C7DDB5023EF42DF68AA742A6E5F57BA21BEFD5
content manifest matching before changes. No runtime installation/substitution,
guarded invocation, test-child/Job creation, application/listener/database startup,
database access, adoption, termination or Git delivery occurred.

### Confirmed runtime discovery and ownership capabilities

The approved 7.6.8 WindowsApps path is absent. Supported registry package discovery
shows Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe only; no7.6.8 executable was
found in the approved path, registered package locations or standard installed/user
PowerShell directories. This is not an exhaustive search of every drive/portable
directory. WindowsApps root enumeration was denied and was not repeated. An app
execution-alias signature read returned IOException/HRESULT0x80070780; no executable
identity was inferred from that alias. Known registered executable metadata was
read directly using the supported unelevated command-specific inspection context.

Actual inspection PowerShell: version **7.6.9**, file version **7.6.9.500**,
C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe\pwsh.exe;
SHA256 **2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233**;
Valid signature, Microsoft Corporation. This is a discovered candidate, not an
approved guarded-runtime replacement. The active PowerShell pin remains null and
the existing refusal is retained. No7.6.9 guarded invocation is authorized.

The approved read-only inspection context ran as the original Windows user,
unelevated. Its observed PID17920, native UTC creation
2026-11-03T04:03:41.2507444Z, independently queried CIM creation
2026-11-03T04:03:41.2507440Z, identical image path, successful CIM GetOwner return0,
and retained current-process handle support query capability. The four-tick
timestamp difference is0.4microseconds, within the existing microsecond comparison
precision; no freshness/ownership acceptance rule changed. Query-only IsProcessInJob
succeeded for the current process (in a Job). Exact owned Job membership, child
creation/supervision and cleanup remain NOT_TESTED; no Job or child was created.

Listener/service metadata query PASS: only127.0.0.1:27017/PID5128 was listening on
the six selected ports. No listener observed on27018/27019/3000/4000/5173 and no
known disposable TEMP directories. MongoDB service is Running, PID5128, configured
NT AUTHORITY\NetworkService/Auto. CIM reported process creation
2026-10-23T06:29:46.6216110Z but no executable path; GetOwner returned2. A separate
supported native OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION) observation was
denied with Windows error5; its invalid handle was closed. No retry/elevation or
ownership adoption. **Complete protected process identity remains UNKNOWN**:
service account configuration and listener/PID correlation do not prove actual
process owner/image identity. The source now refuses such missing facts.

File-only readback verified the retained Node24.15.0, MongoDB8.2.7 and ripgrep SHA256
pins unchanged. Ripgrep has no readable file-version resource; no new version claim
is inferred. No binary was started for version probing. Retained runtime image/read
locks and disposable process ownership remain NOT_VERIFIED. Environment digest
capability was confirmed for79 process variables without exporting values.

### Confirmed protected-resource coverage correction

The existing F043 default collector observed selected ports and legacy database
storage only. Its behavior is preserved. For F044 only, the same existing baseline
entry now selects a bounded collector covering:

- Protected27017 data: C:\Program Files\MongoDB\Server\8.2\data,115 metadata entries
  observed, root owned by SYSTEM, no observed reparse points.
- Legacy development root: C:\Users\Shreeji\AppData\Local\DeepLearner\local-dev,
  467 metadata entries observed, including111 under mongodb; this includes existing
  development profile/control/log metadata without reading private contents.
- Persistent development root: C:\Users\Shreeji\AppData\Local\DeepLearner\dev,
  426 metadata entries observed, including162 under mongodb. User-owned root,
  no observed reparse points; includes existing data/control/config/log metadata.
- Ports27017/27018/27019/3000/4000/5173, current unrelated Node/mongod identities,
  and MongoDB/DeepLearnerDevMongo27019 service metadata. Nothing is excluded merely
  because it belongs to Codex or another development workflow.
- Exact protected service configuration hash for
  C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg:
  97D98D25A7E5BC706F4ECE13BB4B3C3F59F9663410F48048CAC3B4F78C5FC9CA.
- Existing before/after source pins and process-environment digest remain mandatory.

Future F044 collection requires nonmissing current process path, UTC creation,
owner SID/query success and executable hash. It binds the protected Running MongoDB
service/NetworkService configuration to its actual verified S-1-5-20 process owner
and exact loopback27017 listener. Unknown or inconsistent facts fail closed with
sanitized fixed codes. The present context cannot meet those identity requirements.

Coverage is bounded at256 selected processes and10000 entries per protected root.
Metadata and root ACLs produce aggregate SHA256 digests; private filenames, raw ACLs,
database contents, credentials and environment values are not retained. Metadata/ACL
equivalence does **not** establish database-file byte equivalence or consistency.
No credential file content was read for baseline qualification. Storage entries
and service/listener facts are observations at inspection, not durable runtime proof.
Fresh before/after equality and all existing ownership/cleanup evidence remain
required; performance of the expanded runtime collector is unmeasured.

No new supervisor or process authority was added. F043 default collector body is
preserved; F044 feature is threaded through initial/prestart/terminal/closing
baseline comparisons. Five-second RPC/ACK, two-second heartbeat,180/205-second
caps, one-attempt enforcement, RESULT/digest ACK and cleanup remain unchanged.
Forced containment remains failure evidence. Unknown protected identity refuses
before protected baseline acceptance or disposable target startup.

### Changes, affected offline verification and freeze status

Exactly six existing paths changed in this task:

1. .cache/f043-slice1-supervised-launcher.ps1 — F044-only bounded coverage/refusal.
2. .cache/f043-slice1-guarded-runner.ps1 — pass the fixed feature at baseline calls.
3. .cache/f044-slice1-launcher.tests.ps1 — pure synthetic coverage/identity/binding/
   digest/privacy/refusal regressions.
4. .cache/f044-slice1-execution-manifest.json — observed candidate/runtime facts,
   precise baseline coverage and unresolved prerequisite/freeze status.
5. docs/features/F044-admin-learning-path-management.md — this evidence.
6. docs/DEVELOPMENT_ROADMAP.md — current blocker summary.

Initial affected pure PowerShell checks: **33 PASS / 0 FAIL**; after independent
review and linkage regressions,39 PASS; after the final case-classification
correction, **40 PASS / 0 FAIL**, including parsers, unchanged
F043 golden manifest/digest, F044 digest/invalid-frame rejection, exact coverage,
current identity refusal, protected listener/service/process correlation and
aggregate evidence privacy. New OS-query paths are mocked in offline tests. The
initial generated support/test text failed parsing because literal regex dollar
text was interpreted by a local text-replacement helper; callback replacement
preserved literal content and the affected checks passed. No code ran from that
failed parse and no production/security condition was weakened to resolve it.

No TypeScript/application file changed, so unrelated passing suites and known
baseline TS2322 errors were not rerun or repaired. Prior offline/API/frontend/
browser discovery results remain historical. An independent read-only reviewer initially found one Medium linkage gap: a
separately hashed fixed config/root did not prove the running process used it.
The correction requires exact protected executable path/SHA, matching opaque
current process and service invocation digests, the pinned config whose parsed
dbPath is the protected data root, plus owner/service/listener identity. The observed
service registration binds those declared paths; its opaque command digest is
2B3CF93A834E82DF6AE12BB952BCB86855931E106D9D18FC96FFBAE7616E8B7C.
Raw service/process arguments never enter evidence. Actual protected process command
line remains UNKNOWN; no protected query was repeated. Any additional unowned
mongod or27018/27019listener refuses rather than accepting uncovered storage.

Synthetic tests reject changed executable/hash/process command/service command and
unqualified extra targets. The fixed config SHA binds the observed storage path,
not just a filename. Current process owner/image/command access remains blocked.
Collector latency, especially terminal baseline work before the five-second ACK,
is unmeasured;40 pure checks do not prove performance or runtime feasibility.
No deadline is increased. Independent rereview also found one Low case-sensitive
extra-Mongo classification gap. Count/command classification now consistently uses
case-insensitive matching, and an uppercase MONGOD.EXE synthetic refusal passes.
Both findings were independently rereviewed as resolved: **Critical0 / High0 /
Medium0 / Low0 unresolved**. Reviewer performed source inspection only, no tests
or OS/runtime queries. A prior independent-review attempt was unavailable due to
model capacity; a separate existing backend reviewer performed the actual review.

Final scope/format/UTF-8/LF/diff/privacy/history checks PASS. The F043 default
collector body and all shared source outside the intended F044 additions/Feature
forwarding are unchanged. Current source pins intentionally have exactly six stale
content hashes; no refreeze and no current valid guarded fingerprint. No new
TypeScript or application source changed; no unrelated checks were rerun.

**No refreeze. No valid current execution manifest fingerprint.** The source-pin
file bytes still hash to historical
D69E3ABF773F47F0669924E1A1C7DDB5023EF42DF68AA742A6E5F57BA21BEFD5,
but its source content is stale after these six changes. It must refuse current
sources. The prior guarded command is historical and must not be invoked. Owner
instruction prohibits refreezing until the runtime identity and protected-process
inspection prerequisites are resolved. A later freeze is prepared content evidence,
never a declaration of runtime qualification.

Concrete next authorization: approve the exact discovered Microsoft PowerShell
7.6.9 path/hash as a guarded-runtime substitution **for support-pin reconciliation
and offline checks only**, or instead separately approve installation of7.6.8.
No installation/substitution was performed. Protected MongoDB identity denial is
an additional unresolved gate; do not repeat denied queries, elevate, weaken that
gate or claim a complete unelevated execution environment from this inspection.

F044 remains IN_PROGRESS, acceptance BLOCKED; F042/F043 acceptance BLOCKED;
manual observations unresolved; nine integration records NOT_RUN;225 browser
cases NOT_RUN; production NOT_VERIFIED. No database, application or browser ran,
and no staging, commit, push or history operation occurred. STOP after reporting.

## Owner-approved PowerShell 7.6.9 support pin — 2026-11-03

The owner explicitly approved the exact discovered Microsoft PowerShell7.6.9
runtime for F044 support-pin reconciliation and offline verification only. This
supersedes the prior no-refreeze instruction for content preparation; it does not
approve integration, Job/test-child creation or execution-readiness qualification.
Preflight again matched dev /47a049d496d8f83b995a28b1dc56455ea5bb0d77,31pending
repository paths, empty index and all prior reviewed content. No application or
shared F043 source changed in this task. Historical sections above remain evidence
of their earlier states, including the absent/null7.6.8 pin and stale D69 manifest.

Exact owner-approved support runtime:

- Path: C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe\pwsh.exe.
- Full PowerShell version7.6.9; file version7.6.9.500; Microsoft Corporation
  Authenticode signature Valid.
- SHA256:2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233.

Path, version, hash and signature were reverified before use. Offline commands used
that explicit shell path, with no executable fallback. Actual current-process
file-only identity validation also passed inside the offline checks. The active
pin is F044-only; old7.6.8 metadata is retained as history. F043's runtime policy,
manifests and all shared supervisor/launcher/runner sources are byte-identical to
their reviewed pre-task state. No new supervisor, timeout or private transport.

Exactly six F044 support/documentation paths change:

1. .cache/f044-slice1-execution-manifest.json — exact approved support pin/scope,
   pin history and remaining execution blockers.
2. .cache/f044-slice1-launcher.tests.ps1 — exact pin/current-process validation and
   rejection of wrong version/path/hash/signature, no guarded entry.
3. .cache/f044-slice1-protocol.test.mjs — current pin and explicit BLOCKED runtime
   assertions; all feature-specific RESULT/digest ACK rejection remains strict.
4. .cache/f044-slice1-source-pins.json — reconciled current source/support content.
5. docs/features/F044-admin-learning-path-management.md — this evidence.
6. docs/DEVELOPMENT_ROADMAP.md — current support-pin/freeze status.

### Checks actually executed for pin reconciliation

- **46 PowerShell checks PASS**, including the actual approved inspection-shell
  identity, synthetic version/path/hash/signature refusals, unchanged F043 golden
  digest/manifest, F044 parser and existing baseline/privacy refusals. The real
  identity check reads only the current process/file/signature; other new negative
  tests use local synthetic manifest facts. No native owner/Job construction.
- **18 selected Node protocol/compatibility checks PASS**: F043/F044 ledgers,
  strict result rejection, correct/wrong digest/generation/nonce and cross-feature
  ACK behavior, plus current execution-manifest assertions. Tests use in-memory
  streams, not a real RESULT/private channel. Node ran with --test-isolation=none;
  no test-file worker, registry child, listener or supervised child was launched.
- Targeted lint of the changed protocol test PASS. No TypeScript/application source
  changed, so unrelated suites/builds and the two existing TS2322 baseline errors
  were not rerun or repaired. Prior40/33 checks and historical failures stay above.
- Source enumeration/current-content validation uses the approved absolute ripgrep
  and unchanged --no-config/exit-status checks. All four executable file pins are
  checked against current bytes; retained runtime handles/read locks and process/Job
  ownership are not implied by file hashing.

The current content freeze reconciles the six previously stale hashes plus the
additional affected support-test/documentation pins. Expected scope remains618
repository files plus29 supplemental =647 content pins. The manifest excludes
itself; its external SHA256 must be independently read and supplied in any later
separately approved invocation. No fingerprint is inserted into its own pinned
documents. **Content-validity is not execution readiness.** Runtime status remains
BLOCKED in the execution record, even when every content hash matches.

### Protected identity: exact missing facts and supported alternatives

Retained inspection evidence is unchanged and denied queries were not retried:
CIM GetOwner returned2 with no executable path; native query-limited OpenProcess
returned Windows error5. The current protected process's actual owner SID, native
image/creation correlation and live command-line digest cannot be established.
Those facts are required to bind the Running MongoDB service/listener to the exact
approved executable/configuration and protected storage before baseline acceptance.
Configured NetworkService, a PID/port match, fixed config bytes or an old receipt
does not supply those missing live facts.

Existing supported SCM/registry/config reads can establish configured account,
registered executable/configuration, service PID and declared dbPath. They are
non-invasive and were already obtained, but are partial evidence only. Existing
retained-handle and CIM readers still require access to the actual process. No
existing complete supported alternative is established under the current
no-elevation/no-ACL-change/no-new-supervisor constraints. No new relay, observer,
credential transport or weaker identity policy is introduced.

Minimum capability required: an already-authorized Windows operator/execution
context able to obtain PROCESS_QUERY_LIMITED_INFORMATION(0x1000) for the protected
process and the current Win32_Process owner-SID/image/command-line facts used by
the existing collector, repeatedly at fresh baseline boundaries. This describes
the query capability needed, not proof of which ACL/sandbox/security product caused
the denial. No Administrator requirement or blanket Full-access remedy is inferred.
An operator-exported snapshot can document the issue but cannot replace future
fresh in-context checks or grant ownership authority. If no existing supported
context supplies these facts within the restrictions, execution remains BLOCKED.

### Remaining gates and consolidated next request

- Protected owner/image/live-command/config/storage linkage: qualify a supported
  query-only context once; do not repeat the same denied query/context, elevate,
  stop/adopt services or change permissions in this task.
- Exact owned-Job supervision: requires separate explicit approval of a bounded
  inert ownership preflight using the existing mechanism. No child/Job was created.
- Expanded collector latency and five-second ACK feasibility: requires separately
  approved bounded measurement in the qualified context; in-memory ACK tests prove
  protocol behavior only. Five-second RPC/ACK, two-second heartbeat and180/205-second
  suite/supervision caps are unchanged. No automatic retries or unsafe cleanup.
- Real database/fixtures/PRIMARY/indexes and all integration outcomes: remain
  NOT_VERIFIED/NOT_RUN pending a later separately approved guarded invocation.

Consolidated next authorization request: operator-assisted qualification of an
existing suitably permissioned unelevated query-only context for protected identity;
only after that passes and an exact bounded plan is reviewed, authorize the existing
inert Job/collector/ACK performance preflight. This requests no MongoDB integration,
installation, elevation, ACL change, startup or new supervisor. If the necessary
context is unavailable, report BLOCKED instead of creating an exception.

Final focused result: **46 PowerShell checks and19 distinct Node checks PASS**
(18selected protocol/compatibility plus1current-content manifest check; repeated
hash checks are not added again). UTF-8/LF, targeted JS/JSON/Markdown formatting,
existing PS parser/style, scope, history, privacy and git diff --check PASS.
Independent read-only source review confirmed **Critical0 / High0 / Medium0 /
Low0 unresolved**, preserved F043 sources/policy and no weakened RESULT/ACK rules.
The reviewer independently matched647/647content pins with no missing, mismatched
or duplicate paths. All four executable file pins match; this is not retained
process/Job/read-lock qualification. Final review wording is refrozen afterward
and the successor content/hash rechecked. No self-referential SHA is inserted.
Earlier D69 and intermediate preparation fingerprints are historical; only the
externally reported final matching manifest is current. Execution remains BLOCKED. All historical limitations remain: F044 IN_PROGRESS; F042/F043
acceptance BLOCKED; nine F044 integration records and225 browser cases NOT_RUN;
manual observations unresolved; production NOT_VERIFIED. No installation, elevated
operation, application/database/browser execution, provisioning, credential change,
guarded invocation or Git write occurred. STOP after support reconciliation.

## C1 private proposal foundation contract — 2026-11-04

### Authority, current evidence and exclusions

The owner authorizes this documentation and C1-only sequencing extension.
**C1 implementation: NOT_STARTED — separate authorization required.** F044
remains IN_PROGRESS; A/B remain READY_FOR_REVIEW — offline only; acceptance
remains BLOCKED. The C1 extension in AGENTS.md supersedes earlier prohibitions
only for the four future implementation paths below and their offline checks.
No existing read endpoint, DTO, LearningPath model or Student behavior changes.

The full API/test TypeScript blocker is resolved: the separately approved
test-only narrowing was delivered in d8bbfd873ae05bf32da0645202a91cea01f269af.
The executed full API/test no-emit command, targeted lint and formatting passed;
those checks are retained evidence, not rerun here. Earlier TS2322 failures above
remain historical. The owner reports observed fresh login, restoration, Learning
Paths access and logout PASS; no additional login/browser run occurred here.
Other unexercised live cases remain unresolved. Nine F044 real integration
records and 225 prepared browser cases remain NOT_RUN; F042/F043 acceptance
BLOCKED; production readiness NOT_VERIFIED. Guarded pins remain stale after later
delivery/document changes; no refreeze or execution qualification is implied.

C1 defines an AI-ready private proposal revision, separate from published content.
It adds no endpoint, repository/write service, Admin UI, application import,
provider/job, approval state, publication pointer, migration or live persistence.
F054 retains generation; F049/F050 retain editorial decisions; F051 retains
publication. A proposal is not an approved outline or a public LearningPath.
There is no manual authoring workflow, hierarchy/module payload, job/budget state,
reviewer/decision, source URL retrieval or future workflow placeholder in C1.

### Exact identities and field contract

Future collection: `learningPathProposalRevisions`; model name:
`AdminLearningPathProposalRevision`. A proposal family has one server-owned
`proposalId` permanently bound to one `technologyId`. Each immutable revision has
its own `_id`. Neither identifier is a public LearningPath id. C1 does not create
any of these records in a database or allocate ids from a request.

Every key below is required, including nullable values and empty prerequisite
arrays. There are no optional/unknown keys or implicit content defaults. Canonical
input/DTO ids are exactly 24 lowercase hexadecimal characters; digests exactly
64 lowercase hexadecimal characters, with strict end-of-input matching. No
coercion, case normalization or whitespace repair. Persisted ids are actual
Mongoose ObjectIds; adapters explicitly validate before converting.

All text lengths count UTF-16 code units, as existing JavaScript/Zod conventions.
Text is well-formed Unicode, nonblank, already outer-trimmed and single-line;
reject C0 controls and DEL, lone surrogates, nonstrings and implicit coercion.
Do not rewrite Unicode, case or internal spacing. Text is inert plain text, never
HTML, Markdown execution, a runtime command or a source-verification assertion.

| Stored field                        | Exact requirement and meaning                                                                                                        | Bound rationale                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`, `proposalId`, `technologyId` | Required ObjectIds; record, immutable family and selected Technology identities respectively.                                        | Reuses existing 24-hex/ObjectId convention; no arbitrary identifier namespace.                                                                                                            |
| `schemaVersion`                     | Literal integer 1.                                                                                                                   | Fixes interpretation of this single contract; no migration selector.                                                                                                                      |
| `revision`                          | Positive safe integer, 1 through Number.MAX_SAFE_INTEGER.                                                                            | Reuses immutable F038 version convention; reject overflow instead of wrapping.                                                                                                            |
| `source`                            | Exact object `{ id, revision, digest }`: ObjectId source-family id, positive safe-integer source revision, canonical SHA-256 digest. | Binds one exact immutable input artifact without embedding a provider, job, URL or raw payload.                                                                                           |
| `title`                             | Required string, 1–120.                                                                                                              | Existing LearningPath title limit, without changing that model.                                                                                                                           |
| `objectives`                        | Required ordered array of 1–20 distinct strings, each 1–240.                                                                         | At least one reviewable outcome; 20 bounds a single Path brief; 240 keeps each outcome concise.                                                                                           |
| `audience`                          | Required string, 1–500, describing intended learners and assumed background.                                                         | One short brief rather than personas, account data or an unbounded prompt.                                                                                                                |
| `depth`                             | BEGINNER / INTERMEDIATE / ADVANCED.                                                                                                  | Reuses existing targetLevel vocabulary; means intended learning depth, not hierarchy depth or an earned level.                                                                            |
| `runtime`                           | Required null or exact `{ name, version }`; name 1–80, version null or 1–80.                                                         | Names the intended software environment, e.g. browser or Node.js; 80 accommodates a readable label/version without command flags/configuration. Null means not specified, never inferred. |
| `technologyVersion`                 | Required null or string 1–80.                                                                                                        | Technology/language/specification target, distinct from runtime version, proposal revision and schemaVersion. Allows non-SemVer targets without inventing a version resolver.             |
| `prerequisites`                     | Required ordered array of 0–20 exact `{ description }` objects; description 1–240, distinct by exact text.                           | Empty means none declared, not verified absence; same concise/array bounds as objectives. No cross-Path graph, ids, proficiency scores or completion claims.                              |
| `definitionDigest`                  | Required canonical SHA-256 digest, recomputed from the exact ordered definition below.                                               | Existing domain-separated immutable-definition pattern; integrity, never a signature or authority.                                                                                        |
| `createdAt`                         | Required finite UTC Date, canonical ISO millisecond round-trip.                                                                      | Existing UTC timestamp convention; server-owned lifecycle metadata, no automatic clock/default or mutable updatedAt.                                                                      |

`runtime.version` must be present even when null. No runtime/type enum restricts
future Technologies to JavaScript, and C1 never probes or launches the named
runtime. `technologyVersion` is an opaque declared target, not a SemVer range,
installed-version assertion or authorization to fetch/install it. No duration
field is introduced: PRD Section 13 and the approved Studio brief use runtime as
the software execution environment, not study time.

The validated canonical record represented with lowercase string ids and ISO
createdAt must serialize to at most 65,536 UTF-8 bytes including digests. This
64 KiB aggregate cap bounds validation/digest work and future transfer even for
multibyte text; it does not authorize a request body/parser-limit change. Check
raw unknown/private keys before projection. Accept only inert own-data records
and bounded arrays; reject accessors, proxies, cycles, symbols and unexpected
object prototypes without invoking supplied conversion methods. This is a
structural library boundary, not a new authentication or transport mechanism.

### Source binding, revision creation and immutability

`source` identifies the exact immutable upstream curriculum brief/input artifact
from which a proposal revision derives. It is not a citation, provider/job id,
approval receipt, source URL or factual-verification result. Its digest is SHA-256
of that artifact's exact immutable bytes; C1 stores neither those bytes nor a new
source-artifact model. No producer or source repository is implemented in C1.

Pure full-record validation requires a separately supplied expected binding
`{ technologyId, source: { id, revision, digest } }`, with canonical string ids.
All four binding values must exactly match the candidate. The caller supplying
matching values gains no authority: future persistence must obtain them from
authorized, verified records rather than request claims. C1 proves equality and
shape only, not source existence, hash-to-artifact correspondence, Technology
existence/status, current Admin eligibility or database consistency. All such live
checks remain future writer/integration prerequisites, not mocked PASS claims.

Keep record validation and revision-creation validation distinct. The record
validator checks shape, digest and the expected binding for any positive revision;
DTO inspection uses that validator without loading a predecessor. The separate
pure creation validator additionally applies the predecessor rules below. Neither
function reads a model or resolves missing context from a database. This avoids
turning a later revision's read projection into a history scan.

Revision 1 requires no predecessor. A later revision requires the complete
validated predecessor in the pure creation-validation context; family and
Technology must match, revision must equal predecessor.revision + 1, and createdAt
must not precede it. A maximum-safe-integer predecessor refuses a successor.
Source id stays the same within a proposal family. Source revision cannot go
backwards; the same source revision must retain exactly the same source digest.
A higher source revision may supply a new digest only when it exactly matches
the separately supplied expected binding. A different source-family/Technology
requires a new proposal family, never rebinding an existing one.

An existing revision never changes, including metadata, source, text, ordering,
digests or createdAt. Correction creates a new record/revision; same source may
support a new proposal revision. C1 exposes no clone-to-save, latest selection,
revision allocator, writer or unsafe replay. Concurrent revision allocation,
source/Technology rechecks, current-Admin transaction fencing and atomic audit
require a separately approved future writer contract. An intended unique index
is not concurrency/authorization evidence without real provisioning/verification.

Compute definitionDigest as lowercase SHA-256 of UTF-8 JSON.stringify of this
ordered array, with canonical lowercase id strings and no text normalization:

```text
["F044-proposal-v1", id, proposalId, technologyId, revision,
 source.id, source.revision, source.digest, title, objectives, audience, depth,
 runtime === null ? null : [runtime.name, runtime.version], technologyVersion,
 prerequisites.map(item => item.description)]
```

Here `id` is `_id.toHexString()`. schemaVersion is fixed by the domain tag.
createdAt is validated lifecycle metadata outside the content digest, following
the existing F038 definition convention. Array order is semantic; reordering
objectives/prerequisites changes the digest. Exact duplicate strings are rejected
without language-dependent case folding. Validation recomputes the digest; a
matching digest alone does not replace expected binding or predecessor checks.

### Private DTO and model behavior

The private inspection DTO has exactly these keys:

```text
id, proposalId, technologyId, revision, schemaVersion, title, objectives,
audience, depth, runtime, technologyVersion, prerequisites, source, createdAt
```

Ids are lowercase strings; createdAt is canonical UTC ISO milliseconds. Nested
runtime/prerequisites retain their allowlists above; DTO source is exactly
`{ id, revision }`. Never include source.digest, definitionDigest, raw source
bytes, `_id`, `__v`, database internals, account/actor fields, credentials, tokens,
cookies, provider payloads, internal messages/stacks or editorial/job metadata.
This is a private library DTO, not a new HTTP/public export. Future delivery must
remain protected by current-account Admin checks. No proposal content/digests or
rejected raw values enter logs or validation-error messages.

Validate a raw full record and the expected binding before projection can strip
anything; reject unexpected nested fields. DTO output also receives strict
allowlist validation, independent copied arrays/objects and no source-record
references. A corrupt record fails with a fixed content-free error, never a
partial/default-filled DTO. Only the documented private digest fields are omitted
from an otherwise valid full record; unknown data is not silently discarded.

The model uses the existing disconnected `mongoose` instance exported by
config/database.ts. Export an explicit registration function and schema; imports
must not register the model, connect, read env/private config, create timers,
spawn processes or perform I/O. Calling registration on that disconnected instance
only compiles `AdminLearningPathProposalRevision`; repeated calls reuse its exact
schema/model, and a conflicting preexisting registration refuses. Do not import
the module into app.ts, routers or startup/model registries during C1.

Options: collection learningPathProposalRevisions, strict:'throw', versionKey:false,
timestamps:false, autoCreate:false, autoIndex:false, bufferCommands:false. Required
explicit ids/createdAt, cast:false, immutable:true for all persisted paths;
nested objects use _id:false and strict rejection with no extra defaults. Full
document validation must enforce the same text, aggregate and digest invariants
as the pure schema; expected binding/predecessor validation remains an explicit
creation boundary and is not fabricated by Mongoose middleware. No unvalidated
partial document counts as a valid revision.

Disable implicit ObjectId generation and implicit empty-array defaults. Validate
required key presence separately from nullable-value validity: explicit null for
runtime, runtime.version or technologyVersion is valid, but a missing key is not.
Do not apply a Mongoose required-value rule that rejects those permitted nulls.
Raw input validation must precede model construction/defaults/casting; otherwise
model projection could conceal a missing or unexpected field.

Follow existing immutable-definition guards: refuse supported updates,
replacements/deletions and saves of existing revisions, including bulk update/
replacement/deletion paths. C1 executes no insert/save/query/DDL path, including
insertMany/bulkWrite. No repository or raw-collection API is introduced. Guards
and immutable paths are application protections, not database WORM: privileged
raw access is outside their guarantee. Future persistence needs its own owned
writer/authorization/audit/retention contract and real integration qualification.

### Intended indexes — declarations only

Model metadata and database documentation must declare exactly:

| Name                                           | Ordered keys                                  | Properties and reason                                                                            |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `_id_`                                         | `{ _id: 1 }`                                  | MongoDB implicit unique identity, not a third explicit declaration.                              |
| `uq_learning_path_proposal_revision`           | `{ proposalId: 1, revision: 1 }`              | Unique, simple binary collation; one record per family/revision.                                 |
| `ix_learning_path_proposal_technology_created` | `{ technologyId: 1, createdAt: -1, _id: -1 }` | Nonunique, simple binary collation; future bounded Technology inventory with deterministic ties. |

No sparse/partial/TTL/text/vector index, collection creation or explicit
syncIndexes/init/createIndexes/ensureIndexes call. Disconnected Mongoose model
compilation may build in-memory collection wrappers/internal initialization
metadata; that is not permission for a driver call or physical collection/index
creation. These two explicit indexes and one implicit
index are prospective, not additions to the existing 19-collection/27-explicit-
index guarded manifest. Provisioning, validators/roles, persistent retention and
live index verification need separate approval. No current database/index count
or protected resource is changed by declaring the model.

### Exact future implementation inventory and offline acceptance

Four CREATE paths only; no existing application/model/test/document file is part
of the future source implementation inventory:

```text
apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.schema.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.dto.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.model.ts
apps/api/tests/admin-learning-path-proposal.test.ts
```

schema.ts owns strict canonical field/binding/predecessor validation and digest
calculation; dto.ts owns full-record validation plus explicit private projection;
model.ts owns inert schema/explicit registration and immutable guards; the single
test file owns deterministic synthetic offline cases. No barrel/startup/route,
public model, shared package, repository, dependency or extra helper change.

After separate implementation approval require measurable evidence for:

1. Valid first/successor records and nullable targets; every required field,
   enum, numeric/string/array/byte boundary and one-over/under failure; malformed
   Unicode, noncanonical ids/digests, duplicate text, unknown nested/private fields,
   coercion/accessor/proxy/cycle rejection without leaked fixture values.
2. Wrong Technology/source id/revision/digest refusal; missing/incorrect predecessor,
   family rebinding, source rollback/same-revision changed digest, revision gap,
   overflow and earlier timestamp refusal. Source availability/authority is not
   asserted from synthetic context.
3. Independently specified digest vector and changes to every bound field/order;
   createdAt exclusion is intentional while its own validity is checked. DTO exact
   top-level/nested keys, no private digests, immutable input/deep-copy output and
   strict refusal before projection. Errors are content-free with synthetic canaries.
4. Disconnected import/registration, exact schema options/index definitions,
   repeat registration and conflicting-model refusal; in-memory document
   validation and immutable guard behavior with inert doubles only. Spies must
   refuse any database connection/query/write/DDL, env/private-file access,
   process/listener/startup or timer effect. No DB, HTTP or browser execution.
5. Existing test tooling, focused test-file execution, full API/test no-emit
   TypeScript, targeted lint/format, UTF-8/LF, git diff --check, scope/privacy review.
   Do not silently add child/runtime suites or repair unrelated failures.
   Fresh independent Critical/High/Medium/Low review after implementation, with
   all findings resolved before development-checkpoint eligibility.

C1 offline completion means READY_FOR_REVIEW — offline only, never accepted
persistence, a working review UI or full F044 completion. No new C1 real integration
or browser cases are invented/executed by this contract; nine existing integration
records and 225 browser cases remain NOT_RUN. Future live writer/API/UI scope must
define its own additional assertions and exact approval boundary.

### Next approval and estimate

No unresolved field/bound decision blocks the four-file offline foundation.
Separate explicit implementation authorization and a fresh exact-baseline/index/
scope preflight are required. Estimated C1 source implementation, focused tests,
static checks and independent review: 3–5 engineering hours; findings can change
that estimate. Unknown protected MongoDB identity, stale execution pins, real
source/Technology existence and concurrency/audit/persistence qualifications block
future live work/acceptance, not this disconnected C1 definition. No execution
architecture, timeout, ownership or security-policy relaxation is authorized.

## C1 implementation and independent offline review — 2026-11-04

The owner separately authorized exactly the four C1 CREATE paths and focused
offline verification/review. Preflight matched dev at
d8bbfd873ae05bf32da0645202a91cea01f269af, exactly the four reviewed documentation
changes and an empty index. Those four document contents were fingerprinted;
AGENTS.md and DATABASE_DESIGN.md remain byte-identical. Only this feature record
and the roadmap receive implementation evidence/status notes under the owner's
explicit documentation allowance. No existing application source changed.

Implemented strict inert-data/schema validation, exact Technology/source binding,
separate record and revision-creation validators, all declared field/array/UTF-8
limits, domain-separated ordered digest and private deep-copied DTO allowlists.
Input proxies/accessors/coercion/unknown nested fields fail before projection.
Model imports do not register; explicit disconnected registration returns a
raw-input-validating constructor. Both returned and raw-registry model validation
paths fail closed, including validateSync. Automatic ids/array defaults, collection
creation/indexing/buffering and timestamps/versionKey are disabled as contracted.
All declared fields are immutable; supported update/replace/delete/save-existing,
bulkWrite and insertMany guards are verified through inert hook execution only.
No write/query method, database connection or physical index check executed.

### Executed checks and historical failures

- Initial default-context test startup failed in tsx with uv_os_get_passwd ENOMEM
  before case registration. The same focused offline file was then executed through
  the supported command-specific host context, with test-isolation=none and no
  bootstrap/integration/HTTP suite selected. No sandbox policy or Windows permission
  was changed.
- First actual run:124 tests,121 PASS/3 FAIL. Two failures exposed an incorrect
  older BSON buffer-layout assumption; the installed BSON instead stores four own
  24-bit words. Source inspection and inert descriptor validation now support that
  exact representation without supplied getters/conversion methods. The third
  failure came from invoking Mongoose's built-in save hooks on a tiny double; the
  test now selects the named immutable-save guard without dispatching a save.
- Initial targeted lint found one control-character regex rule violation and two
  unused test symbols. All were corrected within the four authorized files.
- Final focused command:
  `node --import tsx --test --test-isolation=none --test-reporter=dot apps/api/tests/admin-learning-path-proposal.test.ts`
  executed **127 PASS / 0 FAIL**, no skipped/cancelled cases. Distinct counts are
  not added across reruns. Tests use synthetic data/in-memory models and inert
  hook doubles, plus refusal spies for driver operations, network/listeners,
  child processes, timers, application environment and private-file access.
- Full API/test TypeScript PASS:
  `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false`.
  No new or baseline diagnostics; the previously corrected TS2322 errors stay
  resolved. API production build/typecheck PASS with the existing tsconfig.json;
  only normal ignored dist outputs were emitted, no deployment/runtime startup.
- Four-file targeted ESLint and Prettier PASS; strict UTF-8/LF, byte-level BOM,
  whitespace, exact-scope/privacy review and git diff --check PASS. An initial
  read-only encoding helper falsely reported a BOM because culture-sensitive
  StartsWith treats that character as ignorable; direct byte checking confirmed
  no BOM and no source encoding correction was needed.
- Existing Mongoose validateSync deprecation warnings were retained, not suppressed;
  the current Mongoose9 synchronous path is deliberately tested. No unrelated
  passing suite, login QA, live API/database or browser suite was rerun.

### Fresh independent review and guarantees

A separate reviewer context inspected all four implementation/test files and the
contract without editing them. Initial findings:Critical0/High0/Medium1/Low1.
The Medium finding was a raw-registry Base.validateSync bypass of middleware;
wrappers on the compiled Base validation methods now refuse unbound/corrupt rows,
with explicit async/sync regressions. The Low finding was acceptance of Unicode
NEL/U+2028/U+2029 inside single-line text. All shared text fields now reject those
separators, with otherwise-valid digest fixtures for each field. Inertness spies
were expanded during review. Final closeout identified a second Medium:
Mongoose static Model.validate and its Standard Schema adapter bypass document
hooks and permit partial validation. That unsupported static entry now always
refuses with the fixed error on both the compiled Base and returned subclass;
explicit full/partial/path-skipping and adapter regressions pass. Supported
callers use binding-aware pure validation or the validated constructor instead.
A test-only TS2769 overload error in the new options-union assertion was corrected
to explicit typed calls without removing assertions; the affected focused tests,
full typecheck and lint were rerun. Cumulative findings: **Medium2/Low1, all
resolved**. Final independent source rereview confirmed
**Critical0/High0/Medium0/Low0 unresolved**. The reviewer did not run tests; the
executed results above are the implementation agent's separate evidence.

C1 is **READY_FOR_REVIEW — offline only**. The original contract's NOT_STARTED
statements record its earlier documentation-only gate; this later authorization
and evidence supersede that implementation state only. F044 remains IN_PROGRESS,
partial progress, acceptance BLOCKED. Structural equality, digest validity,
predecessor rules on supplied data and in-memory guards do not prove stored
Technology/source existence, source-byte correspondence, authorization, persisted
history/concurrency, uniqueness/physical indexes, transactional fencing/audit,
retention or database WORM. The installed BSON representation is deliberately
dependency-specific and fails closed on shape drift; upgrades need focused review.

Exactly eight repository paths are pending: four new C1 files and the four existing
documentation paths, with only the two evidence-document updates described above.
Index empty; no staging/commit/push. Nine F044 integration records and225 browser
cases remain NOT_RUN; F042/F043 acceptance BLOCKED; production NOT_VERIFIED.
Guarded execution pins remain stale; no manifest refreeze or live execution.
Next gate is owner review and, if desired, separately authorized development
checkpoint delivery. A future proposal persistence/API checkpoint needs its own
exact writer/auth/source/concurrency/audit contract and bounded sequencing approval;
no automatic C2/F045, F054 generation, F049/F050 decision or F051 publication work.

## C2 persistence/source-authority proposal — 2026-11-04

**PROPOSED — PENDING APPROVAL. Implementation: BLOCKED on source-authority
definition; NOT_STARTED. No sequencing exception is enacted.**

C1 was delivered separately in d0a2e5a81023f613aa37a796c2df815446853178,
normal fast-forward push with local/tracking/fresh remote HEAD equality and a
clean tree/index before this proposal was appended. That commit contains only
the eight approved C1 paths. This C2 section is uncommitted documentation for
owner review, not part of C1 delivery or authority to persist.

### Inspected dependencies: what exists and what does not

- C1 implements local shape/digest/binding validation and an inert private model.
  Its source is explicitly an immutable upstream curriculum brief/input artifact,
  not an AI result, citation or approval. No source-artifact model, repository,
  admission record, producer or current-consumption authority exists in C1.
- Source/model filename and content inspection under apps/api/src/modules found
  no curriculum-brief/source-family authority implementation. Existing Concept
  source metadata belongs to Concept citation/validation; it is not the C1 source
  family/revision or authoritative brief bytes. Documentation of aiGenerations is
  a future data design, not an implemented producer or authority record.
- Existing F038 rubric/Concept-policy authorities bind specific grading/completion
  resources and independent decisions. They cannot authorize curriculum sources
  or be relabelled as proposal provenance.
- F043's admin-technology.service.ts/repository.ts provide an inspected pattern:
  signed-context revalidation, transaction-local verified ACTIVE ADMIN lookup,
  conditional User __v write fence, snapshot transaction, majority+journaled commit,
  same-session append-only audit and bounded unknown-commit handling. F042/F043
  mandatory real verification remains incomplete; reusable source is not accepted
  transaction/security evidence. These are patterns, not a generic exported C2
  transaction engine; do not refactor shared infrastructure merely for C2.
- audit.model.ts currently permits Technology/Auth/User/rubric events only. There
  is no proposal-persistence audit branch or curriculum-source admission event.
  Existing event labels and metadata cannot be reused to manufacture that evidence.
- The approved architecture assigns briefs to private authoring and F044 to Path
  proposal structures. It does not allocate an exact implemented brief-authority
  contract. Assigning that input foundation to a bounded F044 extension is a
  proposed owner decision, not existing authority or a newly invented feature ID.

Consequently a complete executable C2 writer cannot yet be contracted against
actual authority. A caller-supplied tuple, matching hash, mock source row, Technology
title or privileged session is not a substitute. The conditions below specify the
smallest consumer-side persistence proposal, **not a fabricated source foundation**.

### Required source authority and Technology relationship

Before C2 implementation, separately approve an authoritative private curriculum-
brief/source contract and its exact implementation inventory. At minimum it must
establish these logical facts; this is not a new physical schema declaration:

1. A server-owned immutable source-family id and revision resolve to actual stored
   canonical artifact bytes and their exact SHA-256, bound to one Technology.
2. The authenticated admission operation, actor attribution, integrity checks and
   atomic admission audit are defined. Admission means trusted capture of the input
   brief, **not editorial approval, factual verification or permission to generate**.
3. Canonical payload/encoding, bounds, identity allocation, unique revisions,
   private projection, retention and admission/revision concurrency are explicit.
   An opaque digest alone cannot establish hash-to-artifact correspondence.
4. Eligibility/withdrawal/deletion semantics are explicit. If source eligibility
   can change, consuming its authority must conflict transactionally with that
   change, or the approved policy must explicitly make admission irreversible.
   A snapshot read alone is not a revocation/deletion fence. Do not add a mutable
   field to an immutable source revision or invent a no-op fence to conceal this.
5. Parent lifecycle races have a declared policy. The candidate C2 rule permits
   new private proposals under DRAFT/PUBLISHED Technologies and refuses ARCHIVED/
   absent parents; existing archived-parent read inspection stays unchanged.
   This new write policy is pending owner approval. Whether eligibility is an
   admission-time snapshot or needs a lifecycle fence must be resolved explicitly;
   C2 may not silently increment Technology __v and change F043 revision semantics.

The source contract must supply an actual transaction-compatible consume/check
operation with those guarantees before C2 selects any implementation dependency.
No ready-made capability or proof object is assumed to exist today. C2 loads the
authoritative record/bytes itself through that approved dependency in the same
transaction and derives C1's expected binding server-side; request/producer claims
cannot fill it. Recompute the actual source digest and match source identity,
revision and Technology before validating the proposal.

F054 owns generation. If the owner instead intends source to identify a generated
outline/job result, that conflicts with C1's approved **input-artifact** meaning and
depends on F052/F053/F054 contracts. Stop for explicit reallocation/amendment;
do not absorb provider calls, jobs, budgets or AI output admission into C2.
F049/F050 retain editorial decisions; F051 retains publication. No APPROVED,
AI_GENERATED, review/publication authority or later-feature sequencing is created.

### Conditional internal persistence boundary

After the source dependency and implementation/sequencing approvals exist, C2
would persist **one new immutable C1 revision plus its audit**, with no endpoint,
UI, update/delete, generation or Student/public-model change. It is an internal
bounded service; no arbitrary collection writer, caller-supplied actor or raw
transaction callback is exposed.

Use the existing connected Mongoose client's explicit session and inspected F043
transaction pattern. C1 registration remains disconnected-only and import-inert;
do not relax it to attach a live writer or use refused Model.validate/static paths.
An approved repository may insert only the fully validated new record using the
same native-driver session, as F043 already does. Model guards do not replace
repository authorization and are not database WORM.

Inside one transaction, before any new insert:

1. Revalidate the original signed ADMIN context. Read actor by JWT sub, require
   stored ADMIN/ACTIVE/valid verified Date and a safe incrementable __v. Perform
   the existing conditional User-version increment matching all observed fields;
   require exactly one match/change. Change no profile, role, credential, session
   or timestamp field. Fence failure/deletion/demotion refuses the operation;
   ordinary version contention is not proof of demotion. Recheck deadline/context
   at the existing admission/commit boundaries.
2. Read/qualify the exact Technology and consume the real source authority using
   the separately approved lifecycle/concurrency contract above.
3. Read the actual greatest stored revision for this proposalId using the unique
   family/revision index in reverse order, bounded to one row. Validate the stored
   predecessor's shape/digest/source-family/Technology and the proposed exact
   predecessor identity/revision/digest. First revision requires no stored family;
   later revision must be immediate +1 without overflow. Never compute a new
   revision from a caller's unverified snapshot or silently select a newer target.
4. Run C1 record and creation validators with authoritative binding/predecessor.
   Require immutable family/Technology/source-family identity and permitted source
   revision progression. Insert a new _id; never modify the predecessor.
5. Insert the validated matching audit in the same transaction; any actor fence,
   source, index, validation, insert or audit failure aborts all precommit writes.
   Unique proposalId/revision contention refuses; no retry or revision skipping.

Use primary/snapshot reads, majority+journaled commit, remaining-time driver
timeouts/cancellation and one 10-second monotonic business budget following F043;
commit is one application call capped at min(2000ms, remaining). Preserve the
existing five-second request-authorization cap, final deadline checks and bounded
session release. No transaction-body callback replay, automatic retry, longer
deadline or claim that driver commit retry repeats the business operation.

### Atomic audit, idempotency and uncertainty — candidate decisions

Proposed new audit branch: category CONTENT_MANAGEMENT, action
LEARNING_PATH_PROPOSAL_REVISION_CREATED, resourceType LEARNING_PATH_PROPOSAL_REVISION,
resourceId equal to the new proposal revision _id. Actor is the fenced current
Admin; requestId follows the existing 1–128 correlation convention; createdAt is
the fixed server operation time. Metadata is exactly proposalId, revision,
sourceId and sourceRevision. No source/definition digest, body, token, account
snapshot or raw error. Preserve every existing audit tuple/metadata invariant and
append-only guard; the future branch requires explicit approval/tests, not a
relabelled Technology/Auth/approval event.

To avoid inventing a receipt subsystem, the candidate internal operation identity
is the server-owned proposed revision _id, fixed with all candidate bytes/time
before transaction submission. Its audit _id is the same id in the separate
auditLogs collection, providing one implicit unique identity there. A trusted
future caller must retain the exact prepared command; no user/client identity
allocation or new idempotency endpoint is implied.

An explicit read reconciliation may return an existing result only after fresh
current-account eligibility and source/privacy checks, and only when both the
stored revision and exact audit exist, match the complete immutable command
(including createdAt, not merely definitionDigest) and the original actor.
Reconciliation/replay reads create no audit or User-version write. A different
payload/actor/source or a different id occupying the requested family/revision
is a conflict; one missing side is corruption/uncertainty, never success or repair.
No new index/receipt collection is proposed beyond C1's documented indexes and
existing audit indexes. Audit _id collisions fail closed, never overwrite.

Once commit has been attempted, lost acknowledgement, cancellation, timeout or
cleanup uncertainty reports UNKNOWN via fixed private service outcome/sanitized
failure. Do not compensate, claim rollback, allocate another id or replay writes.
Subsequent separately admitted read reconciliation uses primary/majority evidence;
absence observed once is not permission to resubmit. The future API must define
its own safe external error/operation-handle mapping; no HTTP contract is enacted.

Successful result remains the exact C1 private DTO allowlist, projected only after
full validation; digests, source bytes, actors and audit internals stay private.
Logs retain fixed classification/correlation only. No raw Mongo errors, duplicate
key values, command data, token/session state or arbitrary exception causes escape.

### Conditional consumer inventory and verification prerequisites

The exact **candidate consumer-side** inventory is listed below. It is not a
complete implementation-ready inventory because the source-authority dependency
and its own source files/contract are absent; approve those separately first.
No unimplemented source-authority file/interface is presented as available.

CREATE:

```text
apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.repository.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.service.ts
apps/api/tests/admin-learning-path-proposal-persistence.test.ts
apps/api/tests/admin-learning-path-proposal-persistence.integration.ts
```

MODIFY:

```text
apps/api/src/modules/audit/audit.model.ts
docs/features/F044-admin-learning-path-management.md
docs/DATABASE_DESIGN.md
docs/DEVELOPMENT_ROADMAP.md
```

No C1 model/schema/DTO relaxation, router/startup/public model, UI, setup/bootstrap,
generic transaction framework, new supervisor or dependency belongs in that list.
AGENTS.md requires a separately approved C2 sequencing amendment before source
implementation; this document does not supply or enact it. Any resulting inventory
change must return for explicit approval, not be inferred from this proposal.

Offline acceptance would require injected inert transaction tests for actual-
record binding/predecessor selection, Admin/source fence refusal, revision races,
unique-key classification, audit rollback, exact idempotent reconciliation,
partial/corrupt outcomes, delayed cancellation/deadlines, unknown commit handling,
session release and raw DTO/error privacy, plus full TypeScript/build/lint/format/
scope checks and fresh independent security review. Mocks do not establish the
source dependency, real transactions, concurrency or physical indexes.

Before any live persistence require the approved authoritative source contract,
canonical bytes/digest/admission/consume implementation, complete collection/index/
privilege/retention and owned fixture manifest, exact source pins, qualified
exclusive disposable replica set and separate execution/provisioning approval.
Real tests must demonstrate concurrent demotion/deletion/source invalidation,
same-family competing revisions, atomic proposal/audit rollback and committed
reconciliation with authenticated RESULT/ACK, process/Job ownership, deadlines,
protected baselines and owned cleanup. Do not reuse the existing nine read-only
records as C2 evidence or invent an executed case count. No persistent development
or production writes are authorized by this plan.

### One next decision and bounded alternative

**C2 persistence implementation is BLOCKED, not ready for approval.** The precise
missing prerequisite is an implemented, owner-approved immutable curriculum-brief
source/admission/consume authority matching C1's input-artifact semantics. A pure
tuple validator, citation metadata or the existing Admin transaction pattern does
not provide it. The current C1-only sequencing extension also excludes C2 writes.

Recommended next authorization: **documentation-only definition of a bounded
F044 curriculum-brief source-authority prerequisite**, covering the minimum logical
facts and parent/source lifecycle policies above, exact model/producer/fence/audit
inventory and offline/live gates. Amend this same feature contract and database
design for review; leave AGENTS.md and the active sequencing rule unchanged until
the owner approves an exact extension. No generation, editorial/publication
workflow or infrastructure expansion is needed for that design decision.

Estimate:45–90 minutes for that bounded source-authority contract; C2 consumer
implementation/tests/review provisionally 1–2 engineering days only after the
dependency exists and is separately approved. Real integration qualification is
additional and cannot currently be estimated as executable. Do not start another
model-only or infrastructure project automatically to conceal the dependency.

F044 remains IN_PROGRESS; C1 READY_FOR_REVIEW — offline only; F042/F043 acceptance
BLOCKED. Nine integration records and225 browser cases remain NOT_RUN; production
readiness NOT_VERIFIED. This preparation ran no tests, DB calls, provisioning,
runtime/browser/AI operation or C2 implementation, changed no acceptance status,
and leaves only this proposed documentation uncommitted after C1 delivery.

## Minimal Admin-authored curriculum-brief authority — 2026-11-04

**PROPOSED — PENDING OWNER APPROVAL. Documentation only; implementation
NOT_STARTED. No active sequencing extension, persistence, endpoint, UI, DDL or
runtime permission is enacted.** This section supplies the missing source design
for the preceding C2 draft; that draft and all historical evidence remain intact.
Where its conditional choices differ, the specific choices below are the proposed
replacement, not a claim that the earlier draft was approved.

### Required guarantees versus proposed choices

Already approved C1 requirements are immutable Technology/source-family binding,
actual source revision/digest correspondence, strict bounded content and private
DTOs. The existing security contracts require current-account Admin eligibility,
mutation-time User-version fencing, atomic writes/audit, bounded failure handling
and mandatory real verification. C1's caller-supplied expected tuple proves only
local equality. Neither the tuple, its model nor Concept citation metadata supplies
an admitted source record or proof that anyone authorized captured its content.
F043 supplies transaction patterns, not a curriculum-source authority.

The **new design recommendations**, requiring owner approval, are: one immutable
Admin-authored brief revision per source family initially; atomic brief/first-
proposal capture; permanent admission as historical input; snapshot parent
eligibility; an actor-bound operation key for uncertain-save reconciliation; and
the future API/UI below. These are not inherited acceptance requirements. AI
sources, generic ingestion, provider adapters and a source-review state machine
are unnecessary. Choosing this minimal foundation is optional; continuing to
defer persistence remains safe. Once chosen, its integrity/privacy rules are
mandatory. A digest detects inconsistent bytes; it is not a signature, factual
verification or authority independent of authenticated admission/audit.

### One immutable source record

Proposed private collection `curriculumBriefRevisions`, model
`AdminCurriculumBriefRevision`. All keys below are required, explicitly allocated
and immutable. No defaults, timestamps plugin, `__v`, updatedAt, status, provider,
approval, revocation or generation fields are added.

| Field                                                                                       | Exact meaning and constraint                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                                                                                       | Server-generated ObjectId; also the source-family identity. Wire form, when allowed, is canonical lowercase 24-hex.                                                                                 |
| `technologyId`                                                                              | Server-verified existing Technology; immutable canonical ObjectId. Never inferred from a title, slug or browser state.                                                                              |
| `schemaVersion`, `revision`                                                                 | Both literal `1`. This first foundation admits exactly one revision per family. A changed brief is a new family; no brief-update/revise endpoint or successor machinery.                            |
| `title`, `objectives`, `audience`, `depth`, `runtime`, `technologyVersion`, `prerequisites` | Exactly C1's exported content definitions, nullability, ordering, duplicate and Unicode rules; reuse them, do not fork their bounds.                                                                |
| `createdBy`                                                                                 | Server-derived fenced Admin ObjectId, retained as attribution after account deletion; no copied email, name, role or session.                                                                       |
| `createdAt`                                                                                 | Explicit finite server UTC Date, fixed with candidate IDs before the transaction attempt.                                                                                                           |
| `operationId`                                                                               | Canonical lowercase RFC 4122 UUIDv4, 36 characters, cryptographically generated once by the restricted client for one explicit Save intent; correlation only, never authorization or a resource ID. |
| `contentDigest`                                                                             | Lowercase 64-hex SHA-256 of the exact canonical source bytes below; computed server-side.                                                                                                           |

There is no duplicated raw-byte/blob field or separate title/summary metadata.
Canonical bytes are reconstructed from this complete stored record. Reusing C1
means title 1–120 UTF-16 units; 1–20 distinct objectives each 1–240; audience
1–500; depth BEGINNER/INTERMEDIATE/ADVANCED; runtime null or exact name 1–80 and
version null/1–80; technologyVersion null/1–80; 0–20 distinct prerequisite objects
with description 1–240. Text must already be trimmed, well-formed single-line
Unicode; reject controls and unknown/operator fields, never silently normalize
case, whitespace or Unicode. These existing bounds need no new product limits.

Source digest is SHA-256 over UTF-8 `JSON.stringify` of this ordered array:

```text
["F044-admin-brief-v1", id, technologyId, 1, 1,
 title, objectives, audience, depth,
 runtime === null ? null : [runtime.name, runtime.version],
 technologyVersion, prerequisites.map(p => p.description),
 createdBy, createdAt.toISOString(), operationId]
```

All IDs in that array are lowercase strings. Do not hash BSON, object-key order,
locale sorting, pretty JSON or the digest itself. Bound both canonical-array JSON
and the complete canonical record JSON (ObjectIds as hex, Date as ISO) to 65,536
UTF-8 bytes, reusing C1's aggregate ceiling to bound hashing/copying. Byte counts
are not character counts. Server allocation can cause a boundary refusal; do not
truncate content to fit. Fixed digest vectors include nulls, array order, Unicode,
actor/time/operation changes and metadata inclusion. New domain separation avoids
confusing a source digest with C1's proposal-definition digest.

C1 binding is exactly `source:{id:brief._id,revision:1,digest:contentDigest}` and
the same `technologyId`. Source and proposal family have different semantic roles;
their IDs intentionally coincide only under the initial allocation policy below.
Neither is a Technology ID or AI job ID. One initial brief can support later
immutable revisions of its bound
proposal family under the existing C1 rules. This first workflow creates only
proposal revision 1; editing/revising proposals or replacing their source is not a
UI/API capability in this plan. C2's stored-predecessor checks still apply to its
internal revision consumer; they cannot authorize a new public workflow.

Registration follows C1: explicit compilation only against the existing
disconnected Mongoose instance, import-inert, strict throw, no implicit IDs/arrays,
autoCreate/autoIndex/buffering/timestamps disabled. Guard instance, static, raw
registered-model and bulk/update/delete validation paths consistently with C1;
no claim of database WORM. Live inserts use only the approved native-driver
transaction repository after full validation; registration is not a writer.

Intended indexes, documentation only:

- `_id_`: implicit unique identity; because revision is literal 1 and family is
  `_id`, no redundant family/revision index.
- `uq_curriculum_brief_actor_operation`: ordered `{createdBy:1,operationId:1}`,
  unique, simple collation; one admitted Save intent per actor and a bounded exact
  reconciliation lookup. No TTL, partial, sparse or hidden option.

No browse/search index or brief inventory is needed initially. Together with C1's
two explicit proposal indexes, this adds **two private collections and three
explicit indexes plus their two implicit `_id_` indexes**, not yet provisioned.
The historical 19-collection/27-explicit-index guarded fixture inventory remains
historical and unchanged; future persistence needs a separately approved manifest
including both collections, these exact indexes and existing audit dependencies.

### Admission, consumption and lifecycle

Only a valid ADMIN access context whose current stored User is verified, ACTIVE
and ADMIN may admit a brief. Reverify the signed context and transactionally fence
the observed User `__v`, role/status and verification fields using F043's actual
conditional increment pattern. Caller actor, source digest/revision, dates,
proposal IDs, role, approval/status and Mongo operators are rejected. Normal
version contention refuses rather than silently retrying. Client-side eligibility
and F042's request guard alone cannot authorize the mutation.

The proposed initial admission is irreversible **as captured input**, not
irrevocable permission for its author to act. There is no mutable source
eligibility flag, withdrawal/delete endpoint or TTL. Later demotion, suspension,
unverification or deletion of the author blocks that account's future operations,
but does not erase or invalidate a previously atomically admitted brief. Every
consumer/reconciliation/read independently checks its own current Admin access;
author attribution is never a credential. Retain the source for as long as any
proposal references it and retain its admission audit. No cascade on User or
Technology deletion. Legal erasure/retention exceptions need a separately approved
maintenance policy; this plan authorizes no deletion, including unreferenced
records. Do not store secrets or personal data in brief content.

For new brief/proposal writes the proposed parent rule is existing Technology in
DRAFT or PUBLISHED at the transaction snapshot. Missing, invalid or ARCHIVED
parents refuse. This deliberately means **snapshot admission eligibility**, not
commit-time exclusion of concurrent archival/deletion. An archive/delete committed
after that snapshot can coexist with the private draft commit; it grants no
publication authority. Future writes use a fresh snapshot and refuse a now-
ineligible parent. Do not modify Technology `__v`, add a lock field or claim a
parent lifecycle fence. If the owner requires archival/deletion to prevent every
overlapping commit, STOP for a separate coordinated Technology lifecycle design;
the minimal inventory here cannot provide that stronger guarantee.

Consumption resolves the actual exact source row in the same transaction, fully
validates/recomputes its canonical digest and requires exact Technology/family/
revision match plus a matching committed admission audit. The row's creator/time/
operation must match that audit; missing/corrupt/one-sided evidence fails closed.
Admission has no revocable state to race; no no-op source fence is invented.
During first capture the source and audit are transaction-local inserts; a proposal
cannot commit without them. Archived-parent read-only Learning Path inspection
remains unchanged. New private proposal detail/reconciliation requires an existing
parent; archived parents may be inspected, missing parents return sanitized 404
while retained rows/audits remain intact.

### One Save transaction, audit and uncertainty boundary

Usable flow: **select Technology → enter brief → Save private proposal → inspect
saved private proposal**. The user explicitly saves once. The server copies the
validated C1 content into the initial proposal while retaining the immutable brief
as the authoritative input snapshot. This content duplication is intentional:
source evidence must survive later proposal revision changes. No AI call, editorial
decision, LearningPath write or publishing action occurs.

Reuse F043's primary/snapshot transaction, majority+journaled commit, explicit
session, current-Admin fence and deadlines. Within one transaction insert exactly:

1. One brief and `CURRICULUM_BRIEF_ADMITTED` audit.
2. One C1 revision-1 proposal and `LEARNING_PATH_PROPOSAL_REVISION_CREATED` audit.

Allocate two distinct IDs once server-side: brief `_id` and proposal revision
`_id`. Set initial `proposalId=brief._id`; this explicit family-allocation policy
provides indexed recovery without adding a redundant link field. C1 permits this
identity equality but does not enforce the policy. Use each resource ID as its
audit `_id` in the separate audit collection. Keep
the complete prepared candidate fixed across this one transaction attempt. No
standalone brief-admit endpoint, orphan staging collection or receipt subsystem.
Any precommit failure aborts the whole pair and User-version change. Retain C2's
actual stored-predecessor/unique-revision checks for internal later revisions.

Both new audit branches use CONTENT_MANAGEMENT, fixed server actor/requestId/
createdAt and exact resource linkage. Brief event resourceType
CURRICULUM_BRIEF_REVISION has resourceId=brief ID and metadata exactly
`{technologyId,revision:1,operationId}`. Proposal event retains C2's exact metadata
`{proposalId,revision,sourceId,sourceRevision}` and resource type
LEARNING_PATH_PROPOSAL_REVISION. Validate every old audit branch unchanged.
No body/digest/token/account snapshot/raw exception is logged or audited.
Audit admission proves authenticated capture only; never label it APPROVED,
AI_GENERATED, scientifically verified or permission to generate/publish.

Retain the 5-second request-authorization cap, 10-second total business budget,
one application commit call capped at min(2000ms, remaining), cancellation/final
deadline checks and bounded session cleanup. No transaction-body replay or automatic
retry. Integration supervision remains 180/205 seconds, RPC/ACK 5 seconds and
heartbeat 2 seconds; this design does not implement or qualify those controls.

The operation key is the minimal **external** addition to C2's internal candidate-
ID proposal. The unique actor/key index identifies a prior capture without a new
receipt collection. A duplicate key is never success by itself: after fresh access
checks, explicitly reconcile the full brief, its exact audit, the corresponding
unique revision-1 proposal and its exact audit. Resolve it by exact
`{proposalId:brief._id,revision:1}` through C1's unique index: **the brief ID is
used as initial `proposalId`**.
This is a proposed allocation policy, not C1 structural validation; the proposal
revision `_id` remains distinct. Later revisions keep that family binding. No
unindexed scan or arbitrary limit establishes uniqueness.

Require matching complete canonical content/Technology, original actor/key and
both resource/audit pairs, not merely a hash. Different content or parent under
the same actor/key is 409 conflict. Corrupt or one-sided rows are UNKNOWN, not
repairable success. Another Admin cannot claim that actor's operation key. A
UUID is correlation, not authentication; private GET authorization is still needed.
After commit is attempted, timeout/disconnect/cleanup ambiguity is UNKNOWN; never
claim rollback, compensate, replay writes or allocate a replacement intent.
Explicit reconciliation uses primary/majority reads and creates no audit/fence
write. Absent evidence is UNRESOLVED, never proof that re-saving is safe.

Check for a committed actor/key before beginning any new mutation/fence; that
read path must never increment the User version. A racing unique-key refusal
aborts its entire transaction, then permits only explicit read reconciliation,
not another write attempt. A new key cannot reuse an existing source/proposal
family. These rules avoid both duplicate saves and retries disguised as recovery.

### Proposed usable API/UI boundary (later approval)

These routes are proposals, not existing endpoints or implementation permission:

- `POST /api/v1/admin/learning-path-proposals`: strict JSON exactly
  `{technologyId,operationId,...C1 content fields}`; no query parameters. Successful
  new save returns 201 with the existing success envelope and exact C1 private DTO.
  A previously committed identical operation may return 200 only after complete
  read reconciliation, with no new writes. No automatic POST replay.
- `GET /api/v1/admin/learning-path-proposals/:id?technologyId=...`: exact canonical
  proposal-revision ID and required parent binding; full validation then C1 DTO.
- `GET /api/v1/admin/learning-path-proposals/operations/:operationId?technologyId=...`:
  actor-bound explicit read recovery, registered before the ID route. Success data
  is exactly `{state:'COMMITTED',proposal:<C1 DTO>}` or `{state:'UNRESOLVED'}`.
  Never use a public operation registry or return another actor's existence.

No source browse/revise endpoint, PATCH, DELETE, public route or LearningPath
schema change. Reuse current protected namespace, envelopes/no-store/errors.
Strict identity/query/body schemas reject extras; GET bodies refuse. Proposed
route-local JSON ceiling 131,072 bytes, identity encoding/no inflation, before the
existing generic parser: enough for the 65,536-byte canonical record plus JSON
escaping/envelope without weakening the canonical bound. Oversized encodings
refuse, not truncate. Use the existing namespace IP/account gates plus a separate
bounded per-account proposal bucket matching Technology defaults (120 reads and
60 saves per 60 seconds; capacity 10,000; fail closed), avoiding hidden global
policy changes. Offline tests must verify parser/order and bounded operation lookup.

Sanitized 400/401/403/404/409/413/415/429 remain distinct. Dependency/deadline failures
use fixed 503; postcommit ambiguity uses fixed PROPOSAL_OUTCOME_UNKNOWN, no raw
database/message details. Response codes alone never prove absence of a mutation.
All DTOs validate raw stored data before projection. Briefs have no additional UI
DTO: initial saved content is exposed through C1's 14-key private proposal DTO;
digests, actors, operation keys, audit fields and raw source never enter it.

Keep Technology Management the default. Under Learning Paths offer an explicit
Create private proposal action only for eligible DRAFT/PUBLISHED selection; archived
inspection stays read-only. Accessible bounded fields use C1 definitions, clear
labels/null handling, field errors, disabled pending Save and a clear “private
proposal — not approved or published” result. Render text safely. Reuse Stitch,
keyboard/focus/responsive patterns and current Technology selector; no fake
Generate/Approve/Publish buttons. Tokens remain in F042's controller. Add only fixed
proposal save/detail/reconcile descriptors, never arbitrary URL/token callbacks.
Bind operation key, form and results to account/session generation and Technology;
cancel/suppress late responses on logout/switch. Key/content stay in memory only,
not browser storage/logs. Uncertain Save blocks another mutation and offers only
explicit read recovery. Loss of in-memory recovery context requires operator
reconciliation before repeating the intent, not an automatic new key. That is an
explicit limitation of avoiding durable client/receipt infrastructure.

### Dependency order, exact proposed inventories and gates

The lists below are exact proposed application/test inventories, not permission
to implement them. Shared evidence changes for each checkpoint are limited to
this feature document, DATABASE_DESIGN.md and DEVELOPMENT_ROADMAP.md. Enacting a
sequencing extension would additionally change AGENTS.md only after approval.
No new dependency, generic supervisor, provider framework or model relaxation.

**S — source structure (3 CREATE paths):**

```text
apps/api/src/modules/admin/learning-paths/admin-curriculum-brief.schema.ts
apps/api/src/modules/admin/learning-paths/admin-curriculum-brief.model.ts
apps/api/tests/admin-curriculum-brief.test.ts
```

Offline acceptance: exact fields/bounds including literal revision 1; C1 schema
reuse; deterministic source digest vectors/UTF-8 ceiling; operator/privacy rejection;
immutable inert registration including C1's known validation-bypass regressions.
This checkpoint alone **does not establish authenticated source authority**.

**P — source admission and C2 internal persistence (4 CREATE + 2 MODIFY):**

```text
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.repository.ts
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.service.ts
CREATE apps/api/tests/admin-learning-path-proposal-persistence.test.ts
CREATE apps/api/tests/admin-learning-path-proposal-persistence.integration.ts
MODIFY apps/api/src/modules/audit/audit.model.ts
MODIFY apps/api/tests/auth-audit.test.ts
```

One feature-local repository owns the atomic capture/consume path; no separate
brief writer/fence subsystem. This completes the previously conditional C2
inventory with an explicit existing audit-regression path. Offline acceptance:
inert transaction mocks prove call ordering, current-Admin/version refusal,
authoritative source/audit recomputation, snapshot-parent policy, predecessor
validation, unique-key/conflict classification, full pair/audit atomic intent,
idempotency identity/content binding, no retry, delayed timeouts/unknown commit,
session release and raw privacy. All historical audit tests retain their meaning.

**A — bounded Admin API (7 CREATE + 3 MODIFY):**

```text
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal-request.schema.ts
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal-rate-limit.ts
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.controller.ts
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.routes.ts
CREATE apps/api/tests/admin-learning-path-proposal-routes.test.ts
CREATE apps/api/tests/admin-learning-path-proposal-requests.test.ts
CREATE apps/api/tests/admin-learning-path-proposal-api.integration.ts
MODIFY apps/api/src/modules/admin/admin.routes.ts
MODIFY apps/api/src/app.ts
MODIFY docs/API_DESIGN.md
```

Offline acceptance: fixed three-route contracts, request/parser/rate-limit ordering,
no-store, actor-derived calls, strict parent binding, exact DTO/error envelopes and
no unauthorized body fields. Record the exact API contract in API_DESIGN.md only
as part of that separately approved checkpoint; use fixed route labels so operation
keys do not enter request-path logs. Prepare live route tests; do not start listeners or
label offline HTTP mocks as live evidence. Public F017 routes remain unchanged.

**U — usable Admin flow (10 CREATE + 6 MODIFY):**

```text
CREATE apps/admin/src/lib/learning-path-proposals/contracts.ts
CREATE apps/admin/src/lib/learning-path-proposals/proposal-client.ts
CREATE apps/admin/src/lib/learning-path-proposals/proposal-controller.ts
CREATE apps/admin/src/hooks/use-learning-path-proposal.ts
CREATE apps/admin/src/components/learning-paths/learning-path-proposal-form.tsx
CREATE apps/admin/src/components/learning-paths/learning-path-proposal-form.module.css
CREATE apps/admin/tests/learning-path-proposal-client.test.ts
CREATE apps/admin/tests/learning-path-proposal-controller.test.ts
CREATE apps/admin/tests/learning-path-proposal-rendering.test.ts
CREATE tests/browser/admin-learning-path-proposals.spec.ts
MODIFY apps/admin/src/lib/auth/admin-controller.ts
MODIFY apps/admin/tests/admin-controller.test.ts
MODIFY apps/admin/src/components/learning-paths/learning-path-manager.tsx
MODIFY apps/admin/tests/learning-path-rendering.test.ts
MODIFY apps/admin/src/app/app.tsx
MODIFY apps/admin/tests/admin-rendering.test.ts
```

Offline acceptance: valid/invalid form bounds, parent selection, fixed authenticated
descriptors, no token exposure, account/session/Technology races, cancellation,
double-submit refusal, explicit recovery/no mutation replay, safe text rendering,
keyboard semantics and all existing default-workspace/read-only regressions.
Prepare individually named browser cases without claiming execution. No unplanned
edits to existing client/controller GET behavior are implied by this inventory.

S precedes P; P precedes A; A's stable reviewed contract precedes U. Each source
checkpoint requires focused offline tests, relevant full TypeScript/build, lint,
format/encoding/scope/privacy checks and fresh independent review with findings
resolved. Offline development eligibility is separate from live readiness.
Each implementation approval and each Git commit/push remain separate decisions.

Real guarantees require separately authorized isolated replica-set execution:
physical collections/indexes/privileges; actual User demotion/deletion contention;
same-operation and revision races; no partial source/proposal/audit commit;
rollback; unknown commit/reconciliation; declared snapshot-parent concurrency;
and owned cleanup/protected baselines/authenticated RESULT/ACK. Reuse the existing
reviewed mechanism only after an approved persistence fixture/case/source manifest
exists; the existing nine read-only records cannot prove these new writes. No new
case count or runtime readiness is claimed. Usable acceptance additionally needs
real save/read/recovery API evidence and separately authorized browser checks for
login/selection/form/result/logout, responsive/focus behavior and stale-data refusal.

### Proposed bounded sequencing extension — not enacted

> **PROPOSED — PENDING OWNER APPROVAL: F044 Admin-authored brief/proposal extension.**
> After separate approval of this exact contract, permit only the S/P/A/U
> inventories above, each under separate implementation authorization, while
> mandatory F042/F043 verification remains outstanding. Before each checkpoint
> require stable reviewed dependencies, explicit field/transaction/parent policies,
> no unresolved blocking security finding and an exact approved inventory.
> Permit offline implementation/preparation only; no live persistence, provisioning,
> source-authority claims from mocks or browser execution without separate approval
> and the existing qualified ownership/isolation/cleanup gates. Existing protected
> baselines, authenticated RESULT/ACK, deadlines and acceptance requirements remain.
> F044 remains partial IN_PROGRESS; F042/F043 acceptance remains BLOCKED. Generation
> stays F054, editorial decisions F049/F050, publication F051. No other slice/feature
> progression, schema migration, generic ingestion or production authority follows.
> Every commit and push requires separate explicit approval. This text has no effect
> until the owner approves enactment through the prescribed documentation process.

AGENTS.md is unchanged in this preparation. Its enacted read-only/C1 extensions
still exclude these writers/endpoints/UI; this proposal cannot authorize them.

### Effort, decisions and retained limitations

The former **1–2 engineering days** was conditional C2 consumer implementation,
tests and review **after source authority existed**. It did not include this new
foundation, a usable API/UI, provisioning or live qualification. Revised separate
estimates, assuming stable contracts and available offline tooling:

| Work                                  | Estimate and boundary                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source structure/admission foundation | S: 0.5–1 day; P's source admission/audit portion: 0.5–1 day. Total 1–2 days, not authority after S alone.                                                  |
| Proposal persistence                  | Remaining P consumer/predecessor/reconciliation tests and review: 1–2 days, excluding the admission portion counted above.                                 |
| Usable Admin API/UI                   | A: 0.5–1 day; U: 1–2 days. Total 1.5–3 days.                                                                                                               |
| Combined offline delivery             | 3.5–7 engineering days; security-review findings or contract changes can increase it. No parallelism or live execution assumed.                            |
| Real database/browser qualification   | Additional; blocked on separately approved target/manifest/ownership and runtime access. No reliable elapsed estimate while those gates remain unresolved. |

Smallest next decision: approve or revise this source/parent/idempotency policy
and proposed inventories, then separately authorize enacting only its named
sequencing extension and implementing **S** with offline review. P/A/U remain
separately gated. If faster usable delivery is preferred, S and P may be proposed
as one coherent backend authorization later; they are not authorized here.

Historical C1's 127 focused PASS and resolved independent findings are retained,
not rerun. No source implementation/test/runtime/database/AI operation occurs in
this documentation task. F044 IN_PROGRESS; C1 and read-only checkpoints
READY_FOR_REVIEW — offline only; F042/F043 acceptance BLOCKED; nine integration
records and 225 browser cases NOT_RUN; production readiness NOT_VERIFIED.

## Source-structure S authorization and policy decisions — 2026-11-04

This later owner decision supersedes only the pending-policy/implementation gate
for the three-path source-structure **S** checkpoint. The earlier C2/source drafts
remain intact as history. The owner approved immutable initial brief revisions,
historical admission surviving author demotion/deletion, actor-bound operation keys
and explicit uncertain-save reconciliation, and atomic brief/proposal/two-audit
Save as the intended future boundary. The owner authorized S implementation and
offline verification only. Persistence P, API A and UI U remain NOT_STARTED and
separately gated; the broad proposed extension above is **not enacted**.

AGENTS.md enacts only the named S extension, exactly the schema/model/test CREATE
inventory. No additional brief DTO is specified or exposed: C1's private proposal
DTO remains the boundary; a pure validated brief-to-source binding is internal
structural data, not an authenticated capability. Existing C1 files remain unchanged.

Technology policy limitation is explicit: a future transaction admitting a private
brief/proposal may commit if its DRAFT/PUBLISHED parent is archived or deleted
after the transaction snapshot. There is no parent lifecycle fence or Technology
version write. This grants no publication authority and performs no cascade.
Stored source/proposal/audit evidence remains retained. With an archived parent,
protected private inspection remains allowed but new writes refuse; with a deleted
or unavailable parent, private detail/reconciliation returns sanitized 404 while
retaining evidence. Every subsequent operation rechecks current account authority
and applicable parent rules. Author demotion/deletion preserves a historical input,
never permission for future actions. None of these database behaviors is proved
by S's structural tests or implemented in S.

Preflight matched dev at d0a2e5a81023f613aa37a796c2df815446853178, exactly three
reviewed modified documents and empty index. Drafts/historical evidence are
preserved. F044 IN_PROGRESS; C1/A/B READY_FOR_REVIEW — offline only; F042/F043
acceptance BLOCKED; nine integration records and 225 browser cases NOT_RUN;
production NOT_VERIFIED. No live execution or Git delivery is authorized.

## Source-structure S implementation and independent offline review — 2026-11-04

**S READY_FOR_REVIEW — offline only.** This later evidence supersedes S's earlier
NOT_STARTED wording, not the unapproved P/A/U checkpoints. The enacted AGENTS.md
extension remains limited to S. Original C1/C2/source proposals and historical
tests/failures remain intact; only current summary pointers are reconciled.

### Exact implemented scope

CREATE only:

```text
apps/api/src/modules/admin/learning-paths/admin-curriculum-brief.schema.ts
apps/api/src/modules/admin/learning-paths/admin-curriculum-brief.model.ts
apps/api/tests/admin-curriculum-brief.test.ts
```

Reuse C1's exported content schemas, byte ceiling and inert-data snapshot rather
than duplicate field definitions. Implement literal schema/revision 1, required
canonical identities/date/UUIDv4 operation key, exact source digest over all
specified fields, separate expected Technology validation and internal C1 binding.
No extra brief DTO is exposed; pure tests connect the binding to C1's unchanged
proposal validation/private DTO and check excluded brief metadata. Input/body
validation and binding equality do not authenticate an actor or admit a source.

The model is import-inert, explicitly registered only while disconnected, with
autoCreate/autoIndex/buffering/timestamps/versionKey disabled and exact prospective
index metadata. Construction validates raw content before casting; raw-registry
async/sync/static/Standard-Schema validation fails closed without valid context.
Immutable guards refuse supported updates/replacements/deletes/bulk operations.
All Mongoose saves, including new documents with validation disabled, now refuse;
the future P repository remains a separately approved native-driver insert boundary.
No model is imported into application startup or connected to MongoDB by this work.

### Checks actually executed

- Initial default-context focused test launch failed in tsx before registering any
  case: uv_os_get_passwd ENOMEM. The supported command-specific host context then
  ran only the authorized synthetic file, with test isolation disabled and no
  database/bootstrap/browser or child-runtime suite. No Windows elevation/policy
  change or environment troubleshooting was performed.
- Initial actual focused run: **105 PASS / 0 FAIL**. Independent-review corrections
  added six fixed digest vectors; final command
  `node --import tsx --test --test-isolation=none --test-reporter=spec apps/api/tests/admin-curriculum-brief.test.ts`
  executed **111 PASS / 0 FAIL / 0 skipped / 0 cancelled**. Counts are not summed
  across reruns. The byte-limit helper tests its exact UTF-8 boundary; tighter
  content bounds mean no fabricated full-record 65,536-byte acceptance claim.
- Full API/test TypeScript PASS, including after the corrected tests/model:
  `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false`.
  No new or baseline diagnostics; the earlier corrected TS2322 errors remain resolved.
- API production build/typecheck PASS, including after the save-guard correction:
  `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --incremental false --pretty false`.
  Only normal ignored dist outputs; no application startup or deployment.
- Three-file targeted ESLint with max-warnings=0 PASS. Scoped source/document
  Prettier, strict UTF-8/LF/no-BOM, git diff --check, exact scope, historical content
  preservation and sensitive-data review PASS. No unrelated passing suite or login
  QA rerun. Mongoose validateSync deprecation warnings remain visible, not suppressed.
- Tests use synthetic identities/content, disconnected models and inert hook doubles.
  Refusal spies cover connections/collection operations, network/listeners, child
  processes/timers and application-private environment/config access. No save/query
  or DDL dispatch is used to test immutable hooks.

### Independent findings and resolution

A fresh independent reviewer context inspected the actual three files, C1 reuse
and source/S contracts without editing or executing tests/live operations.
Initial findings: Critical 0 / High 0 / Medium 1 / Low 1.

- Medium: a new/raw-registry document could skip validation with
  save({validateBeforeSave:false}) because the pre-save hook only refused existing
  documents. S now refuses every Mongoose save; inert new/existing hook doubles
  confirm refusal without dispatch. No C1 or future native-driver policy was changed.
- Low: null/Unicode/order/admission-metadata variants used a mirrored JavaScript
  digest oracle, with only one fixed baseline hash. Six independently derived
  Python compact-UTF-8-JSON/hashlib constants now cover those variants individually.

Independent closeout reread the actual corrections and reported **Critical 0 /
High 0 / Medium 0 / Low 0 unresolved**. Executed test/build evidence above belongs
to the implementation agent; no independent test rerun is claimed. Separate
self-review checks scope, documentation consistency and retained limitations.

### Guarantees and next boundary

Established: local shape/bounds/digest integrity, inert-data handling, Technology
equality on supplied context, private C1 projection compatibility and disconnected
in-memory validation/guard behavior. An admissible-looking synthetic record is not
an admitted source. Not established: stored existence/Technology eligibility,
current-account authorization, operation uniqueness, transaction/concurrency,
source/audit correspondence, atomicity, real indexes, retention or database WORM.
The documented snapshot archive/delete race is a future policy, not a passing test.

Smallest coherent next checkpoint is **P — source admission and internal C2 proposal
persistence** under separate exact-inventory/sequencing authorization. It would
connect S/C1 through the current-Admin transaction fence and atomic brief/proposal/
two-audit boundary, plus explicit read reconciliation and prepared integration
assertions. P still adds no API/UI or permission for live writes. A/U follow only
after their own approvals. Generation F054, editorial F049/F050 and publication
F051 remain unchanged.

Git scope after S: seven pending paths (three new source/test files plus AGENTS.md
and the three already modified documents), index empty; HEAD unchanged at
d0a2e5a81023f613aa37a796c2df815446853178. No staging/commit/push. Guarded execution
pins remain historical/stale; no refreeze or runtime qualification occurred.
F044 IN_PROGRESS; C1/A/B/S READY_FOR_REVIEW — offline only; F042/F043 acceptance
BLOCKED; nine integration records and 225 browser cases NOT_RUN; production
readiness NOT_VERIFIED. No acceptance or other-feature status advances.

## P internal persistence authorization — 2026-11-04

S was delivered in f95e1bf025958527df2d75c73716d0ef1e406d24, normal fast-forward
push with local/tracking/fresh remote equality and clean tree/index. The owner
separately authorized P only, including the six-path application/test inventory,
offline verification and independent review. AGENTS.md enacts only P's bounded
offline extension. Earlier P NOT_STARTED/proposed-policy wording is historical.
P implementation is IN_PROGRESS; it must remain uncommitted for review.

P implements the approved internal capture/reconciliation and revision-consumer
contract. Initial capture derives actor/IDs/time server-side. Later revision commands
are prepared internally with fixed server identity/time, complete expected
predecessor and original actor binding, then validated against actual stored source
and greatest predecessor in the transaction. Prepared data is not source authority
or authorization. Explicit reconciliation never writes/fences or retries a mutation.
No endpoint/UI, additional collection/index, generic transport or supervisor.

Snapshot DRAFT/PUBLISHED eligibility is not a concurrent archive/delete fence.
An overlapping post-snapshot archival/deletion may coexist with private commit;
no cascade/publication follows. Archived-parent protected inspection remains allowed,
new writes refuse; missing-parent reads refuse while historical evidence remains.
Historical admission survives author demotion/deletion; every consumer requires
current account authorization. Existing C1/S model and DTO contracts stay unchanged.

All live guarantees remain unverified. Nine read-only integration records and225
browser cases remain NOT_RUN; F044 IN_PROGRESS; F042/F043 acceptance BLOCKED;
production NOT_VERIFIED. P/API/UI/live execution and Git delivery are distinct gates.

## P implementation and independent offline review — 2026-11-04

**P READY_FOR_REVIEW — offline only; uncommitted.** The owner's exact-scope P
authorization supersedes earlier P NOT_STARTED/pending-sequencing wording only.
S remains separately delivered in f95e1bf025958527df2d75c73716d0ef1e406d24, whose
parent is d0a2e5a81023f613aa37a796c2df815446853178. Exactly seven reviewed S paths
were committed with offline limitations and pushed normally after a fresh fetch.
Final local/tracking/freshly queried origin/dev all matched the S SHA, with clean
tree/index before P began. No additional commit or push occurred during P.

### Exact P implementation and scope

CREATE:

```text
apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.repository.ts
apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.service.ts
apps/api/tests/admin-learning-path-proposal-persistence.test.ts
apps/api/tests/admin-learning-path-proposal-persistence.integration.ts
```

MODIFY application/test paths only:

```text
apps/api/src/modules/audit/audit.model.ts
apps/api/tests/auth-audit.test.ts
```

AGENTS.md enacts the P-only offline extension. This document, DATABASE_DESIGN.md
and the roadmap record authorization/evidence/current pointers. No existing C1/S
source, router, application startup, public LearningPath storage/API, dependency,
runtime configuration, fixture/index setup or other feature source changed.

The unmounted internal service implements capture, actor-bound operation recovery,
server-prepared later-revision persistence and explicit prepared-revision recovery.
It reuses C1/S validation, content/digest definitions and private DTOs. Initial
capture derives actor/IDs/time on the server; strict input rejects caller-owned
fields. The source ID also identifies the initial proposal family; its revision ID
is distinct. One intended transaction writes brief, proposal and both exact audits
after current signed-context/stored verified ACTIVE ADMIN checks and the conditional
User-version fence. Duplicate actor/key checks precede any fence/write, including
inside the transaction. Recovery never fences, audits or replays a write.

Source consumption re-resolves the immutable brief and matching admission audit;
current author eligibility is not substituted for historical admission. Consumers
independently require current authorization. Later revisions require the actual
greatest stored predecessor, complete expected-record equality including date,
source/Technology binding and a matching prior audit. No silent latest selection,
revision skipping or rebinding. Prepared revision handles retain fixed server
candidate identity/time and original context in a service-local WeakMap; each
permits one write attempt, then read recovery only. They are process/context-local,
not a durable receipt or client authorization token; process loss requires explicit
reconciliation/operator handling, not reconstruction/replay of an uncertain command.

Repository calls use the existing connected Mongoose client's native driver only
when explicitly invoked; imports do not connect. Primary/session/index metadata
checks refuse missing prerequisites without DDL. Transactions use snapshot/primary,
majority+journaled commit, one application commit call and existing bounded session
cleanup. The service retains the 10-second business budget, 5-second authorization
phase, commit min(2000ms, remaining), monotonic rechecks, cancellation and sanitized
uncertainty. No callback/body retry. Guarded 180/205-second, RPC/ACK 5-second and
heartbeat 2-second controls are unchanged and not qualified by these source checks.

All new audit branches validate exact resource/actor/time/metadata and reject new
metadata on legacy events. No bodies, private digests, tokens or raw database errors
are returned/logged. Success projects C1's exact private DTO after raw validation.
Known partial/corrupt recovery evidence is PROPOSAL_OUTCOME_UNKNOWN. A missing
actor/key lookup is only UNRESOLVED; it proves neither absence of a prior attempt
nor safe retry. Postcommit loss/cleanup uncertainty never compensates or replays.

Technology eligibility remains the owner's explicit snapshot policy, not a parent
version fence. Concurrent post-snapshot archival/deletion may coexist with private
commit; no publication/cascade follows. Future writes refuse archived/absent
parents. Archived-parent protected inspection is allowed; missing-parent recovery
refuses while retaining source/proposal/audit evidence. Real races are unverified.

### Executed offline checks and retained failures

- Focused command:
  `node --import tsx --test --test-isolation=none --test-reporter=spec apps/api/tests/admin-learning-path-proposal-persistence.test.ts apps/api/tests/auth-audit.test.ts`.
  Executed through the supported command-specific host route, synthetic/in-memory
  only, no child-runtime/bootstrap/database/browser suite. First actual result:
  **53 PASS / 1 FAIL**. The failed test incorrectly expected a linked-row rejection
  after changing the indexed actor, which instead removes the row from this actor/
  key lookup. The corrected assertion requires UNRESOLVED, never success/safe retry.
  Final expanded result: **65 PASS / 0 FAIL / 0 skipped / 0 cancelled**, not summed
  across runs. Tests cover current authorization/fence refusal, strict input/source
  binding, key conflicts, staged rollback intent, competing predecessor commands,
  historical authors, cancellation/deadlines and explicit uncertain recovery.
- Native-driver/session doubles additionally cover primary/index refusal before
  session creation, transaction-start/body/final-verification failure, commit loss,
  abort failure with endSession still attempted, endSession throw/hasEnded=false,
  and delayed callback after cancellation without a second write or commit.
  These are mocked boundaries, not actual resources or cleanup proof.
- Initial full API/test TypeScript found one new TS2339: inferred embedded metadata
  was a plain type without toObject. Using the root document's explicit plain
  metadata view corrected it without a cast/compiler relaxation. Full command
  `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false`
  then PASS, including after the final prepared-assertion-only edit. Historical
  baseline TS2322 errors remain resolved; no unrelated source was changed.
- API production build/typecheck PASS:
  `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --incremental false --pretty false`.
  Only normal ignored dist outputs, no runtime startup/deployment. Six-file ESLint
  with max-warnings=0 PASS; final prepared file lint PASS after its last edit.
  Scoped Prettier, UTF-8/LF/no-BOM, whitespace, exact-scope/privacy and diff checks
  PASS. No unrelated passing suite or desktop/login QA repeated.

### Fresh independent review and resolutions

A fresh reviewer context inspected all six actual files, dependent contracts and
existing transaction/audit patterns, with no tests, edits or live execution.
Four Medium findings were reported, no Critical/High/Low:

1. Linked partial/corrupt recovery returned generic dependency failure. Recovery
   now maps integrity/dependency uncertainty to PROPOSAL_OUTCOME_UNKNOWN while
   preserving fixed authorization/parent/conflict refusals; focused regressions
   check the exact code and prohibit false success.
2. The prepared parent's timeout did not abort a delayed qualifier/ownership
   callback. It now reuses the existing read-only integration lifetime helper,
   installs parent loss before qualification, checks around awaits, carries child
   cancellation and disposes in finally. A pure delayed-callback test passes.
3. The prepared rollback assertion checked only source absence. It now fixes
   source/revision IDs, proves the second-audit refusal was reached after staging
   the proposal, and checks complete source/proposal/two-audit absence plus unchanged
   User authority/version. The final assertion strengthening was source-reviewed,
   typechecked and linted, **not executed against a database**.
4. Native session failure/cleanup paths lacked direct doubles. The ten additional
   refusal/cleanup/cancellation cases described above were added and passed.

Final independent closeout reread corrections and reported **Critical 0 / High 0 /
Medium 0 / Low 0 unresolved**. Test execution is the implementation agent's
evidence, not an independent test rerun. Self-review separately checked final
scope, privacy, historical documents and limitations.

### Live gaps and next approval

Five additional named P persistence cases are PREPARED ONLY: capture/two audits,
actor-key reconciliation, predecessor conflict, audit rollback and injected
acknowledgement-loss reconciliation. Importing their file registers/runs nothing.
They are not bound to the existing nine read-only record IDs or authenticated
execution manifest. Existing lifetime/process ownership is reused; no supervisor,
target, fixture, index or credential was created. A future qualification must supply
the full approved isolated target/source/fixture/index/record/privilege manifest,
actual concurrent demotion/deletion and competing-transaction assertions, authentic
RESULT/ACK, protected-baseline proof and ownership-safe cleanup. The prepared
injected ACK-loss case does not qualify a real network/forced MongoDB timeout.

Offline evidence establishes call ordering, validation and refusal behavior through
doubles. Actual stored authority, physical uniqueness/indexes, transaction/audit
atomicity, concurrency, latency/deadline feasibility and process/storage cleanup
remain NOT_VERIFIED. Existing guarded pins are stale; no refreeze/qualification.

Smallest next application checkpoint is separately approved proposal **API A**,
before UI U: protected capture, actor-bound operation recovery and bound private
detail. A's previously proposed inventory needs explicit owner reconciliation:
plain by-ID detail inspection is not exposed by P, so add MODIFY of this service
and its persistence test file for that current-Admin/source-audited read, alongside
the already proposed A paths. This is a future inventory proposal only, not API
implementation/enactment. Do not misuse process-local revision handles as an HTTP
detail capability. U follows only its own scoped approval and stable API contract.

P leaves ten pending paths: four new files, two audit/test modifications and four
sequencing/evidence documents. Index empty; HEAD remains the delivered S SHA.
P is uncommitted, no further push. F044 IN_PROGRESS; C1/A/B/S/P READY_FOR_REVIEW —
offline only (A/B here are historical read-only checkpoints, not proposed API A);
F042/F043 acceptance BLOCKED; nine integration records and 225 browser cases
NOT_RUN; production NOT_VERIFIED. No feature acceptance or later-feature progress.

# F043 — Admin Technology Management

## Status, authority and evidence boundary

Feature: **IN_PROGRESS**. Slice 1: **READY_FOR_REVIEW — offline only**;
acceptance **BLOCKED** pending mandatory real integration. Backend implementation
was authorized on 2026-10-30. Slice 2 is **READY_FOR_REVIEW — offline only** under
the separate 2026-10-30 frontend authorization; its offline outcome is recorded below.
The earlier backend authorization covered exactly the 18 backend paths and
canonical contract transfer. Frontend authority is now separately granted;
live MongoDB/browser execution and Git delivery are not authorized by this pass.
The following planning/finalization records are historical where superseded.
Planning and documentation-only contract-finalization
authorization: **2026-10-30**. The owner approved the named F043-only sequencing
amendment and authorized finalizing this draft-only implementation contract.
The sequencing amendment is enacted in AGENTS.md; backend/frontend implementation,
execution, Git delivery and feature acceptance remain separately gated. This
contract specifies the design for separate Slice 1 implementation approval; it is
not permission to execute its User-version fence or other writes. Starting checkpoint: branch `dev`,
`34c9f7cebf9e5fc3a955aefbe2f6a59f9e044df0`.

F001–F041 retain APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY. F042 remains
**IN_PROGRESS**; Slice 1 READY_FOR_REVIEW — offline only, acceptance **BLOCKED**;
Slice 2A IMPLEMENTED — external HTTP verification pending, not accepted; Slice 2B
READY_FOR_REVIEW — offline only. Its frontend/backend development commits are
`571872683dd682c09f08fed3ed304b22cd344c66` and
`34c9f7cebf9e5fc3a955aefbe2f6a59f9e044df0`. Remote delivery of these checkpoints
is not verified Admin authorization or F042 acceptance. F044 remains NOT_STARTED.

Sources: [AGENTS.md](../../AGENTS.md), [roadmap](../DEVELOPMENT_ROADMAP.md),
[PRD](../PRD.md) sections 44, 48, 51 and 52,
[architecture](../SYSTEM_ARCHITECTURE.md), [API](../API_DESIGN.md),
[database](../DATABASE_DESIGN.md), [F015](F015-technology-catalog-backend.md),
[F042](F042-admin-route-protection.md), and the Admin Content Management
`screen.png`/`code.html` under `docs/designs/admin/content-management/stitch/`.
The design is a broader concept-management reference, not a Technology editor
specification. Reuse its visual hierarchy/tokens without copying invented data,
production indicators, unrelated controls, CDN assets or inline scripts.

## Enacted F043-only sequencing exception — 2026-10-30

The default one-feature rule remains unchanged outside the named exception now
enacted in AGENTS.md and cross-recorded in F042/the roadmap. The earlier general
blocked-verification amendment alone permitted only slices of the current feature;
the new owner decision explicitly permits separately approved F043 development
slices while F042 remains IN_PROGRESS with acceptance BLOCKED. F042 remains the
open verification feature. F043 remains NOT_STARTED pending separate Slice 1
approval, and must reuse the F042 Admin boundary without calling it verified.

The following preserved planning wording describes the exception's security
intent; the enacted AGENTS.md section controls its exact effective wording:

> **Named F043 development-only sequencing exception.** The owner may separately
> authorize an explicitly inventoried F043 Admin Technology Management slice while
> F042 remains IN_PROGRESS with mandatory verification incomplete. This exception
> changes only implementation sequencing for F043. Before each slice, require a
> stable dependent contract, retained applicable prerequisite offline evidence,
> and no unresolved Critical/High finding invalidating the dependent work. After
> each slice require applicable offline checks and independent review, with all
> unresolved findings corrected before checkpoint eligibility. Any newly
> discovered security defect in F042 that invalidates the dependent work suspends
> this exception. F042 remains
> IN_PROGRESS with final acceptance BLOCKED; its historical HTTP/MongoDB failures,
> UNKNOWN results and deferred checks retain their actual outcomes. F043 remains
> NOT_STARTED until separate exact-scope implementation approval. Neither feature
> may receive final acceptance before its mandatory authentication/authorization,
> database, ownership/isolation, RESULT/ACK, deadline, cleanup and applicable
> regression gates pass. F043 acceptance also requires the F042 prerequisite
> verification gate. Git checkpoints and remote delivery each require separate
> owner approval. Existing browser exceptions do not transfer. This exception
> authorizes no F044/later work, production readiness or deployment. The default
> one-feature workflow continues to apply outside this named exception.

The owner has now approved these documentation changes. AGENTS.md and the F042
feature record are the two additional policy/coordination paths outside the
31-path implementation inventory; both are changed only for this named exception.
Every commit and push still requires separate owner approval. F043 acceptance
requires its own real integration and F042's prerequisite verification. No default
permission for F044/other features, browser exception, production qualification,
automatic Slice 2 progression or acceptance is created.

## Dependencies and finalized draft-only product boundary

The original F043 roadmap entry contains only a name/status, with no formal
dependency list or detailed acceptance criteria. This finalized contract depends
on F015 Technology persistence/public catalog, F042 Admin namespace
and session authority, and their existing F004/F005/F008 foundations. F016 is a
regression consumer of the public contract, not a new implementation dependency.
F044 and later authoring/publication features are excluded.

Include authenticated paginated inventory, detail, create DRAFT, and revision-
controlled edits of DRAFT name, description and display order. Slug is globally
unique and immutable after creation. PUBLISHED/ARCHIVED records and existing icon
references are read-only. New iconAssetId is server-set null. Draft mutations and
their audit events commit atomically.

Exclude publish/unpublish, archive/delete, asset upload/reference changes, bulk
actions, imports, AI, descendant management, automatic seeds, public API changes,
new dependencies/environment variables/configuration and production provisioning.
This deliberately delivers draft preparation; it does not provide a publishing
path, consistent with the owner's approved-in-principle scope.

## Finalized HTTP contract — canonical documents remain unchanged

Mount all four routes **inside** the existing `createAdminRouter` after its
authenticate, namespace rate limits and `requireAdmin` boundary. Do not create a
parallel unguarded mount. The app's proposed change supplies testable business-
service dependencies without altering middleware order or public routes.

| Method/path                            | Request                                   | Success             |
| -------------------------------------- | ----------------------------------------- | ------------------- |
| GET `/api/v1/admin/technologies`       | page/limit only                           | 200 list envelope   |
| GET `/api/v1/admin/technologies/:id`   | 24-hex ObjectId; no query                 | 200 object envelope |
| POST `/api/v1/admin/technologies`      | name, slug; optional description/order    | 201 object envelope |
| PATCH `/api/v1/admin/technologies/:id` | revision plus at least one editable field | 200 object envelope |

Use existing success/error envelopes and request IDs. GET has no request body.
Reject nonempty GET bodies, unknown/repeated/nested query parameters, malformed
IDs, unknown/dotted/operator JSON keys and caller-supplied status/provenance/icon/
timestamp fields. Require JSON for POST/PATCH, no compressed body, at most 4096
UTF-8 bytes using a feature-local streamed parser before the existing larger
parser. Do not change parser behavior for other routes. Unsupported media/encoding
is 415; oversized payload is 413. Do not echo supplied keys/values in errors.
POST/PATCH accept no query parameters. JWT errors and inherited admission checks
retain their existing order; business validation never bypasses eligibility.

### Input and pagination

- name: trimmed nonblank string, 1–80 characters.
- slug: 1–100 lowercase ASCII kebab-case characters, no leading/trailing whitespace
  or normalization that silently changes the submitted identifier; create only.
- description: plain string, at most 2000 characters; omission on create means
  absent/null in DTO; omission on PATCH preserves it; explicit null clears it.
  Empty string is valid. It is never HTML or Markdown execution input.
- order: JSON number, nonnegative safe integer; default 0 on create. Reject
  coercion, NaN, infinity, fractions and unsafe integers.
- revision: PATCH-only JSON nonnegative safe integer below MAX_SAFE_INTEGER.
  Required even for a no-op edit. No revision parameter on create.
- id: exactly 24 hexadecimal characters, normalize to lowercase after validation.
- page: default 1; limit: default 20, maximum 100. Both positive decimal integer
  strings with safe offset arithmetic. Reject offsets above 10,000. No search,
  filters or arbitrary sort in this minimal contract.

Inventory includes DRAFT/PUBLISHED/ARCHIVED, ordered by globally unique slug ASC.
Use the existing unique slug index. Separate bounded list/count reads may drift
under concurrent changes; no cross-request snapshot guarantee. Meta contains
requestId/page/limit/total/totalPages, with totalPages 0 for an empty collection.
Out-of-range valid pages return 200 with an empty array. Unknown/corrupt persisted
status or DTO data fails closed with 503 rather than rendering partial authority.

### Exact response DTO

Return exactly `id`, `name`, `slug`, `description`, `iconAssetId`, `status`,
`order`, `revision`, `createdAt`, `updatedAt`. Description/iconAssetId are nullable;
status is DRAFT/PUBLISHED/ARCHIVED; revision projects validated internal `__v`;
timestamps are valid UTC ISO strings. No actor IDs, email, private account data,
raw `_id`, `__v`, password/hash, session, token, arbitrary MongoDB fields or nested
learning content. Apply explicit server projection and strict frontend envelope/
DTO validation. Existing F015 public DTO remains exactly unchanged.

### Errors, headers and rate limits

| Status/code                      | Meaning                                             |
| -------------------------------- | --------------------------------------------------- |
| 400 VALIDATION_ERROR             | Invalid schema, revision, ID or bounds              |
| 401 existing AUTH_ACCESS_TOKEN_* | Missing/invalid/expired access JWT                  |
| 403 AUTH_FORBIDDEN               | JWT or current stored account is not eligible       |
| 403 ORIGIN_NOT_ALLOWED           | Existing origin policy refusal                      |
| 404 TECHNOLOGY_NOT_FOUND         | Eligible caller, well-formed ID, absent Technology  |
| 409 TECHNOLOGY_SLUG_CONFLICT     | Create collides with the unique slug reservation    |
| 409 TECHNOLOGY_REVISION_CONFLICT | Current revision differs from PATCH precondition    |
| 409 TECHNOLOGY_READ_ONLY         | Target is PUBLISHED or ARCHIVED                     |
| 413 PAYLOAD_TOO_LARGE            | Streamed request bound exceeded                     |
| 415 UNSUPPORTED_MEDIA_TYPE       | Unsupported JSON media/encoding                     |
| 429 RATE_LIMIT_EXCEEDED          | Namespace or feature quota exceeded                 |
| 503 DEPENDENCY_UNAVAILABLE       | Database/authority/deadline/transaction uncertainty |

Unexpected faults retain the existing sanitized 500 INTERNAL_ERROR envelope;
never expose the underlying exception as one of these safe errors.

All responses, including parser/CORS/auth/404/409/limit failures, are no-store.
Keep existing CORS, proxy trust, request-ID conventions and sanitized error/log
behavior. Do not disclose which Admin eligibility attribute failed. Never map
arbitrary duplicate-key errors to slug conflicts; verify the affected key/index.
After eligibility, check read-only status before revision to provide deterministic
409 handling. An absent target returns 404; corrupt persisted data returns 503.

Retain F042's 300/IP/15-minute and 120/account/15-minute admission limits. Add
feature-local 120 reads/minute/Admin and 60 mutations/minute/Admin, shared across
the two methods in each class, before business DB work. Both namespace and feature
limits apply; the stricter effective quota wins. Reuse HMAC-obscured bounded
single-process store design, IPv6 policy, 10,000-live-key cap and fail-closed store
exhaustion (503). Do not evict live counters or claim multi-process enforcement.

## Mutation-time authority, transaction and uncertainty

JWT verification and the F042 gate are necessary but do not grant perpetual
mutation authority. The finalized design requires this explicit transaction protocol:

1. After the normal gate, begin one owned session/transaction on a qualified
   writable PRIMARY. Use snapshot read concern and majority+journaled commit.
   Validate actor identity exclusively from verified JWT sub/ADMIN role; verify
   token expiry again before admitting mutation work. No role or actor from input.
2. Inside the transaction, read only the actor's `_id`, role, status,
   emailVerifiedAt and `__v`. Require current ADMIN, ACTIVE, valid verified Date,
   matching ID and a nonnegative safe version with room to increment. Missing or
   known ineligible account gives generic 403; corrupt evidence gives 503.
3. **Real write fence:** conditionally increment that exact User document's
   existing `__v` by one, matching ID, ADMIN, ACTIVE, the observed verification
   timestamp and version. Require exactly one match/modification. This is a real
   transactional write, not a read-only permission cache or a no-op `$set`.
   It changes no credential, role, status, profile, token, session or business
   timestamp. Use explicit repository-owned native operations to avoid unintended
   Mongoose timestamp updates; validate all fields/version bounds first.
4. Insert a new DRAFT Technology with revision 0, null icon and server-derived
   createdBy/updatedBy, or update an existing DRAFT using ID/status/revision CAS.
   Existing creator/slug/icon/status/createdAt are immutable. PATCH sets updatedBy
   and server updatedAt, increments revision exactly once. A valid no-op PATCH
   still records one acknowledged revision/audit operation.
5. Append the corresponding validated audit in the same transaction. Fence,
   Technology and audit must all commit or all roll back. A failed revision,
   slug, audit, eligibility or read-only check aborts the fence as well.
6. Recheck JWT expiry and the remaining monotonic budget before the commit call;
   an expired token cannot newly admit commit. Commit once at application level;
   return a validated DTO only after confirmed commit. Always await session
   cleanup. Do not claim rollback if commit outcome is unknown, or try a
   compensating write on uncertainty. Expiry after commit admission does not
   retroactively roll back an already committed transaction.

Concurrent demotion, suspension, deletion or eligibility changes write the same
User document and therefore must conflict with the fence. If that change commits
first, stale mutation authority must fail/abort. If the authorized mutation commits
first, a later demotion does not retroactively invalidate it. A snapshot read
alone cannot prove this ordering. Unrelated same-account version writes may also
cause safe refusal. No permanent lock or promise of immediate JWT revocation is
introduced. Test both transaction orderings with real MongoDB before acceptance.

The fence increments only `users.__v`; it must not bump `users.updatedAt` or touch
profile/session/security fields. A successful mutation increments the actor
version once; abort leaves it unchanged. Its authorization purpose is recorded
by the same atomic Technology audit with actor identity, not a fabricated
USER_PROFILE_UPDATED/AUTH event. Do not add a second independent User audit or
claim the fence changed account eligibility. Contention with another same-Admin
mutation or profile/version write may abort either transaction; return sanitized
503 without an automatic replay, even if retry might otherwise succeed. A failed
Technology revision CAS remains 409 and rolls back the fence. Do not classify an
unexplained write conflict as confirmed demotion or confirmed revision mismatch.

Synthetic integration assertions must account for exactly these authorized actor
version increments and audits; all other User fields and every protected/nonfixture
account remain unchanged. This does not broaden the protected MongoDB baseline or
allow filtering unrelated process/database discrepancies into a PASS.

Implementation constraint confirmed from source: existing `AuthContext` omits JWT
expiry. Do not infer expiry from it or decode an unsigned payload. The proposed
feature route/controller must provide a private, request-bound verification
closure that reuses the existing `AccessTokens.verify` on the original Bearer
token at mutation/commit admission, comparing sub/sid/role/plan to the originally
authenticated context. Keep that reference transient, release it with the request,
and never pass it into persistence, audit or output. This requires no change to
authenticate middleware, access-token service or shared request types. Any design
that cannot meet those constraints within the inventoried files needs new approval.

This deliberately specifies a **F043-only User version write** as part of the
finalized design. F042's authorization remains read-only. Actual execution of this
side effect requires separate Slice 1 implementation/execution approval; this
documentation decision executes no mutation. No User schema/index change or new
fence collection is included. If existing `__v` semantics, older data or driver behavior cannot support
this safely, STOP and propose exact extra paths/alternatives; do not weaken the
fence, silently initialize corrupt versions or introduce a new model.

### Budgets, retries and idempotency

- Preserve the F042 five-second eligibility budget unchanged. After dispatch,
  Technology work has one additional 10-second monotonic budget, including
  transaction setup/work/commit; it is not renewed per operation. List/count share
  their budget. Reject late results. Apply driver timeout/abort and final elapsed
  checks, and refuse unsupported deadline enforcement.
- Each commit call uses maxCommitTimeMS at most 2000 and no more than remaining
  budget. Abort/session cleanup is awaited and separately observed; inability to
  confirm cleanup or commit is UNKNOWN, never success.
- No application callback/transaction retry (`withTransaction` automatic callback
  replay is unsuitable), no retry of write conflicts, no automatic frontend
  mutation replay, and no new logical transaction on lost acknowledgement.
  The chosen driver's internal same-transaction commit retry behavior must be
  identified during implementation source review and proven bounded by the same
  budget before checkpoint eligibility. Only protocol-level retries of the same
  commit/transaction identity are permissible; they cannot create a new logical
  transaction or re-execute domain work. Unproven/unbounded driver behavior blocks
  the write path and checkpoint, rather than permitting a fallback or deadline
  increase. Guarded suites still have zero automatic retries and unchanged
  approved supervision limits.
- No durable idempotency-key service, replay cache or new collection is included.
  Double-submit is prevented locally while pending. Repeated create after a known
  success gets slug conflict; repeated PATCH with the old revision gets revision
  conflict. These are not a general exactly-once delivery guarantee.
- On network loss, timeout or unknown commit, display an unconfirmed outcome and
  require an explicit read/reconciliation before further submission. Do not claim
  the mutation failed or blindly replay it. An inventory/detail read may assist
  reconciliation; it is not authenticated delivery proof for a lost response.

## Audit, indexes and public invariants

Use a narrow additive audit category `CONTENT_MANAGEMENT`, resourceType
`TECHNOLOGY`, actions `TECHNOLOGY_CREATED` and `TECHNOLOGY_UPDATED`. Bind the
resource reference to Technology. Each event contains actorId/resourceId,
server-created UTC time, sanitized requestId and exact action-specific metadata:
revisionBefore (null on create), revisionAfter, and sorted unique changedFields
from `name`, `slug`, `description`, `order`. Update cannot contain slug. Create
lists supplied editable fields plus the required name/slug. No field values,
tokens, passwords, arbitrary details or private payloads enter audit metadata.
Create requires revisionAfter 0; update requires safe revisionAfter equal to
revisionBefore + 1. Validate the exact category/action/resource/metadata tuple,
not merely independent enum membership.

Extend only the audit schema/validation in the proposed inventory. Preserve all
AUTH, USER_ADMIN and CONTENT_APPROVAL shapes, requiredness, references, metadata
allowlists and append-only guards. The Technology repository writes the new
validated audit using the same session; do not repurpose a rubric/user event or
silently broaden existing categories. Audit write/validation failure aborts all
mutation effects. No new audit repository file is currently required.

Reuse `technologies` and `auditLogs`; the actor fence uses existing `users`.
Technology schema stays unchanged: unique `{slug:1}` (including archived slug
reservation), `{status:1,order:1}`, strict model, autoCreate/autoIndex/buffering
disabled. Reuse existing audit actor/time and resource/time indexes. No new
collection/index, migration or provisioning-on-import. Verify exact key/options
on the disposable target before operations; do not assume F042's 19-collection /
21-index fixture inventory includes Technology's indexes. A separately approved
F043 integration reconciliation must declare the actual full footprint.

Creation always stores DRAFT. PATCH matches DRAFT at the mutation boundary and
never changes publication state, public slug or ancestor records. New drafts
remain absent from F015 and descendant public catalogs. Existing PUBLISHED and
ARCHIVED records must remain byte/semantic-equivalent outside read access. F015
published-only predicate, ordering, DTO, pagination, rate limits and no-store
contract remain unchanged. No real JavaScript initial-data provisioning occurs.

## Frontend authority and UI contract

Reuse F042's session controller, memory-only token, identity/generation checks,
same-origin coordination, logout/restoration rules and unsupported-context refusal.
There is currently no business-request method. Add one restricted capability
on the existing controller, not a token getter or replacement session controller:

- Admit only the four Technology methods/paths and validated IDs/query/body.
  No arbitrary URL, headers, role or request callback supplied by UI code.
- Select token/account/generation privately within the controller. Validate
  eligibility/expiry before dispatch and generation/identity again on completion.
  Authorization remains server-enforced; frontend eligibility is not DB authority.
- Technology client uses existing approved API origin policy, credentials omit,
  Bearer authorization, redirect refusal, cache no-store, bounded body parsing and
  a maximum 15-second monotonic operation timeout including coordination queue
  waiting and network work; do not renew it on admission. This feature-local bound
  does not alter existing session coordination limits. No refresh-on-business-
  failure or automatic request replay. Tokens never enter snapshots, logs or
  persistence.
- Cap each decoded response input at 1 MiB of streamed UTF-8 bytes before JSON
  parsing, including when Content-Length is missing or misleading; cancel excess
  input. Validate total/count/revision values as nonnegative safe integers and
  pagination consistency. Do not trust a response solely because its HTTP status
  is 2xx. The 100-item maximum and 2000-character descriptions fit this bound.
- Account/generation changes, logout, hide/suspend, expiry and unmount cancel
  owned requests and clear inventory/detail/form state. Late responses cannot
  restore it. Coordinate admitted work with existing same-origin lifecycle; do
  not release its protection early during logout/cancellation. A pending mutation
  may have committed despite cancellation; retain only a nonsensitive uncertainty
  indication, never stale account data or an automatic replay.
- Handle 401/403 by existing session invalidation; 404 as unavailable target;
  409 with explicit reload/compare-and-reapply flow; 429 without an automatic
  retry; 503/network/timeout as read error or unconfirmed mutation as appropriate.
  Strictly validate envelopes, DTOs, pagination and revisions; sanitize raw errors
  before rendering. Unknown/private fields cannot be concealed by schema stripping.

UI: authenticated Technology inventory, pagination, detail, labeled create form,
DRAFT-only editor, clear read-only status and revision/conflict messages. Use
escaped text and semantic timestamps, no raw HTML. Do not fetch arbitrary icon
URLs or show invented counts, publish controls or a production-live claim. Keep
existing Admin sign-in/logout intact. No new router dependency or cross-app shared
state. Require desktop/tablet/mobile, keyboard/focus, labels, contrast, live-status
announcements, errors/empty/loading and no unwanted horizontal scrolling.

No token, response, form or private identity in localStorage/sessionStorage,
IndexedDB, service-worker cache, URL/query, browser coordination messages or logs.
The F042 same-profile Student/Admin **cross-origin refresh-cookie race remains
unresolved**. Same-origin locks/BroadcastChannel do not solve it. Separate browser
profiles remain local guidance only, not proof of cross-origin serialization.
This feature changes no cookie, authentication/session architecture or CORS policy;
unsupported session state fails closed. A different architecture requires separate
approval and inventory, not expansion during implementation.

## Exact implementation inventory — 31 unique paths, Slice 1 only authorized

Checked against the original planning baseline on 2026-10-30: 21 CREATE paths were
absent and all 10 MODIFY paths existed. No dependencies, configuration, package/lock files,
Technology/User model changes, shared-package changes or ignored adapters are
included. The audit model extension is the explicit exception to otherwise reused
persistence models. Extra paths require owner approval before editing.

### Slice 1 — backend, 11 CREATE + 7 MODIFY = 18 paths

CREATE:

```text
docs/features/F043-admin-technology-management.md
apps/api/src/modules/admin/technologies/admin-technology.schema.ts
apps/api/src/modules/admin/technologies/admin-technology.dto.ts
apps/api/src/modules/admin/technologies/admin-technology.repository.ts
apps/api/src/modules/admin/technologies/admin-technology.service.ts
apps/api/src/modules/admin/technologies/admin-technology.controller.ts
apps/api/src/modules/admin/technologies/admin-technology.routes.ts
apps/api/src/modules/admin/technologies/admin-technology-rate-limit.ts
apps/api/tests/admin-technology.test.ts
apps/api/tests/admin-technology-routes.test.ts
apps/api/tests/admin-technology.integration.ts
```

MODIFY:

```text
apps/api/src/modules/admin/admin.routes.ts
apps/api/src/app.ts
apps/api/src/modules/audit/audit.model.ts
apps/api/tests/auth-audit.test.ts
docs/API_DESIGN.md
docs/DATABASE_DESIGN.md
docs/DEVELOPMENT_ROADMAP.md
```

The feature document is created by this planning task; at implementation start
it will therefore be an existing MODIFY, not a second creation. The original
21/10 classification describes the planning baseline and does not change the
31 unique-file boundary. Canonical API/database wording must be separately
approved before those files change. Audit insertion/fence logic stays within
the feature repository; existing audit repository and User model remain untouched.

### Slice 2 — frontend, 10 CREATE + 3 MODIFY = 13 additional paths

CREATE:

```text
apps/admin/src/lib/technologies/contracts.ts
apps/admin/src/lib/technologies/technology-client.ts
apps/admin/src/lib/technologies/technology-controller.ts
apps/admin/src/hooks/use-technologies.ts
apps/admin/src/components/technologies/technology-manager.tsx
apps/admin/src/components/technologies/technology-manager.module.css
apps/admin/tests/technology-client.test.ts
apps/admin/tests/technology-controller.test.ts
apps/admin/tests/technology-rendering.test.ts
tests/browser/admin-technologies.spec.ts
```

MODIFY:

```text
apps/admin/src/lib/auth/admin-controller.ts
apps/admin/tests/admin-controller.test.ts
apps/admin/src/app/app.tsx
```

The feature document and roadmap are reused for Slice 2 evidence/checkpoint
reporting, so Slice 2's eventual exact checkpoint inventory has these 13 paths
plus those two shared documents (15), not 13 if documentation changes. They are
already included in the 31 unique paths. No existing auth client, hook, coordination
module, shell, global style or config change is currently proposed; discovering
one is necessary triggers scope approval rather than silent expansion.

## Verification, reviews and separate checkpoints

### Slice 1 gates

Focused offline cases must cover all four request contracts and bounds, raw
response privacy, exact DTO, pagination/empty pages, all Admin refusals, timeout/
cancellation/late completion, namespace placement, no-store, rate-store exhaustion,
immutable fields/read-only states, known slug collisions, revision CAS, actor
fence failure, audit atomicity, transaction abort/unknown commit and no retry.
Use deterministic mocks without claiming DB enforcement. Relevant regressions:
F042 Admin access/routes, Auth/User HTTP contracts, audit model events, F015
Technology model/service/routes and descendant public visibility contracts.

Require API build/test-inclusive TypeScript, targeted zero-warning lint,
formatting, UTF-8/LF, diff/scope/secrets checks and fresh independent
Critical/High/Medium/Low source/security/test-quality review. Resolve findings
before checkpoint eligibility. Environment-blocked suites retain actual historical
FAIL/UNKNOWN and new NOT_RUN status; they are not passing regressions.

Prepared real DB integration must cover eligible Admin creation/edit, stored-role/
status/verification/deletion refusal, concurrent demotion versus fence in both
orders, competing updates, unique slug collision, audit rollback, aborted/uncertain
commit, no mutation of public/archived records and protected baseline/cleanup.
Plan the exact authenticated manifest and fixture/index footprint separately;
do not invent a nine-record F043 result or reuse F042/F015 historical PASS.
Replica-set/transaction/index qualification, retained handles, exact owned Job,
PRIMARY before DB enumeration, exclusive empty target, fresh mutation-boundary
ownership, authenticated RESULT/digest ACK, unchanged approved deadlines and safe
cleanup remain mandatory. No runner/adapter edits or execution are approved here.

After offline gates and independent review, owner may separately approve one
local development checkpoint, proposed message:
`feat(admin): checkpoint F043 technology backend with pending integration`.
It is not acceptance. No automatic Git write or remote delivery.

### Slice 2 gates

Requires a separately authorized slice, stable reviewed backend contract and
ratified sequencing exception if F042 remains open. Do not start automatically.
Test strict client envelopes/private fields, restricted method/path capability,
account-bound state, expiry/logout/cross-tab cancellation, stale responses,
uncertain mutation/no replay, conflict reload, form validation, read-only states,
safe text, pagination and accessible source/rendering behavior. Regress F042's
client/controller/rendering/lifecycle contracts. Require Admin build/TypeScript,
lint/format/scope/privacy checks and separate fresh independent severity review.

After those gates, separately approve one local development checkpoint, proposed
message: `feat(admin): checkpoint F043 technology editor with pending verification`.
No automatic acceptance, push or next-feature transition.

### Proposed browser and live acceptance — all unexecuted

Propose 20 future F043 browser scenarios: (1) anonymous refusal, (2) Student
refusal, (3) loading/empty/error inventory, (4) pagination, (5) safe detail and
escaped hostile text, (6) valid draft creation, (7) invalid create fields,
(8) duplicate slug, (9) valid draft edit, (10) stale revision conflict,
(11) published read-only, (12) archived/icon read-only, (13) no double submission,
(14) uncertain mutation/reconciliation, (15) logout/expiry clears data,
(16) account switch/late response refusal, (17) keyboard/focus/error announcement,
(18) desktop layout, (19) tablet/mobile layout without overflow, (20) rate/
dependency errors without secret leakage. Each scenario's deterministic assertions
must be specified before browser execution; the list is not prepared test evidence.

The existing **193 browser scenarios remain NOT_RUN**. F043's proposed 20 are not
yet files/prepared cases and are not added to that prepared backlog. No inherited
exception or primary-host Playwright permission. Qualify ownership-safe browser
execution separately; root Playwright currently targets only chrome-smoke, so the
execution/configuration inventory must be approved rather than silently changed.
Mocked API browser scenarios do not prove live frontend-to-API integration.

Live F043 frontend-to-API integration is **NOT_VERIFIED**; real database transaction
verification is required before final acceptance. Also complete F042's mandatory
HTTP/MongoDB prerequisites, authenticated results/ACK and baseline reconciliation.
Any named browser exception would require its own explicit owner decision and
cannot waive security/API/database verification. Failover, multi-process limiting,
cross-origin refresh safety, privacy/security and release qualification remain
production gates. **Production readiness: NOT_VERIFIED**.

## Preserved backlog and current owner gates

F042's ledger remains authoritative: mandatory nine-record suite incomplete,
historical authenticated counters UNKNOWN, RESULT/digest ACK incomplete, 180-second
timeout and protected-process baseline discrepancy retained; forced real MongoDB
timeout NOT_VERIFIED. HTTP historical failures and pending qualified rerun remain
unresolved. No result is relabelled by this plan. No services, credentials, browser
or new integration were run/generated during planning.

The owner has approved the F043-only sequencing exception and documentation-only
finalization of this design, with draft-only scope approved in principle. This
record finalizes HTTP/DTO/bounds, audit, User-version fence/concurrency, revision,
bounded retry/uncertainty and frontend requirements for implementation review.
These decisions do not execute code or advance acceptance. Remaining gates:

1. Separate exact-scope Slice 1 implementation approval, explicitly including the
   documented User `__v` side effect, additive audit model and canonical API/database
   wording transfer. Those canonical files remain unchanged in this task.
2. During implementation, qualify actual driver commit/timeout behavior, strict
   fence/version assumptions and rollback semantics. Unsupported behavior is a
   blocking finding; no fallback, new model/file or relaxed check is implied.
3. Separate Slice 2 implementation approval after stable reviewed backend
   contracts, including the restricted request capability while preserving F042's
   session architecture. Extra files/architectural changes require owner approval.
4. Separately approved qualified integration/browser execution, each local Git
   checkpoint, each push and final feature acceptance when their gates are met.

Recommended next gate: owner authorization of Slice 1's exact 18-file scope and
this finalized contract. Implementation is eligible for that separate decision,
not already authorized. Do not begin backend implementation here. F043 stays NOT_STARTED;
F042 remains IN_PROGRESS with final acceptance BLOCKED; F044 remains NOT_STARTED.

## Historical planning-only verification record — 2026-10-30

Exactly two repository paths were changed: this new proposal and an additive F043
roadmap record. The 31-path inventory was checked against the starting Git tree
(21 originally absent / 10 existing). Strict UTF-8 without BOM, LF/final newline,
documentation scope, empty index and diff/whitespace checks passed. The roadmap
change contains additions only. AGENTS.md, the F042 feature record and canonical
API/database files retain their pre-task hashes; existing evidence is preserved.
Scope/sensitive-data inspection found no introduced credentials or secret material.
No implementation/test/service/integration/browser run, credential generation,
Git staging/commit/push or policy change occurred. These are documentation checks,
not runtime, independent code-review or feature-acceptance evidence.

## Contract-finalization record — 2026-10-30

The later owner decision authorizes exactly AGENTS.md, the F042 feature record,
this document and the roadmap. It enacts the named sequencing exception but no
implementation or acceptance. Earlier planning evidence above remains historical;
its statement that policy files were unchanged applies to that earlier task only.
F042 retains IN_PROGRESS/acceptance BLOCKED; F043 remains NOT_STARTED. The current
roadmap keeps F042 as the open verification feature and names F043's development
eligibility subject to separate Slice 1 approval, without automatically switching
the active implementation pointer. Existing 193 browser cases remain NOT_RUN;
proposed F043 browser coverage does not change that count. Production readiness
remains NOT_VERIFIED. No tests/services/database/browser or Git delivery is
authorized by this record.

Documentation verification: exact four-file scope, strict UTF-8 without BOM,
LF/final newline, formatting of the finalized contract/new sections, diff checks
and sensitive-data review PASS. Earlier roadmap/F042 text was preserved exactly;
default AGENTS.md instructions are unchanged outside the additive named exception
and final-newline normalization. Git index remains empty and starting HEAD is
unchanged. No implementation, tests, services or Git delivery occurred.

A separate fresh-context reviewer, `f043_contract_independent_review`, inspected
the actual four documents read-only. Unresolved Critical / High / Medium / Low:
**0 / 0 / 0 / 0**. Source-level document evidence includes conditional real User
version fencing, explicit contention ordering, atomic Technology/audit effects,
bounded same-transaction commit behavior, no domain replay, UNKNOWN handling,
account/generation invalidation and unchanged mandatory acceptance gates. This
is an independent documentation/security review, not runtime qualification.
Actual driver timing/commit behavior, User-version assumptions and real concurrent
transaction outcomes must still be verified during the separately approved
implementation/integration gates. The design is eligible for separate Slice 1
implementation approval; no Slice 1 work starts under this documentation decision.

## Slice 1 implementation and verification outcome — 2026-10-30

This later implementation authorization supersedes earlier documentation-only /
NOT_STARTED statements for Slice 1 only. F043 is IN_PROGRESS; Slice 1 is
READY_FOR_REVIEW — offline only, acceptance BLOCKED pending real integration;
Slice 2 remains NOT_STARTED. The owner-authorized 18 backend paths are implemented,
including the API/database contract transfer. AGENTS.md and the F042 record retain
their previously approved amendment unchanged. There are 20 total pending paths
relative to HEAD: these 18 plus those two inherited policy documents. No frontend,
User/Technology model, dependency, config, ignored adapter or Git-delivery change.

The protected list/detail/POST/PATCH routes enforce the finalized schema/DTO,
revision/read-only rules, no-store, limits and signed-token/current-Admin checks.
The repository qualifies writable replica-set PRIMARY and required indexes,
uses one explicit transaction, performs the real conditional User __v fence,
and commits Technology/audit effects atomically without a business callback replay.
Same-transaction commit is bounded; unconfirmed commit returns sanitized 503.
Bounded endSession is always attempted even when explicit abort fails. Source and
mock cleanup checks do not establish real server rollback or protected baselines.

### Executed verification (distinct records; reruns not added)

- Focused Technology service/schema/native-adapter + audit checks: 75 PASS
  across `admin-technology.test.ts` (68) and `auth-audit.test.ts` (7, including
  retained legacy audit regressions). New route/parser/controller checks:
  **16 PASS**, including one real app loopback HTTP test using fake services.
  **91 focused/audit records PASS** in total; no MongoDB was used.
- Selected authorization/token/User/Technology/hierarchy offline regressions:
  **102 PASS** across eleven existing files. Rubric/approval/completion audit-
  dependent regressions: **41 PASS** across two existing files.
- Nine existing relevant HTTP regression files: **79 PASS** in one sequential
  run, using test-owned loopback listeners and fake services. This includes
  `admin-routes`, `authenticate`, login limiter/routes, logout routes, refresh
  cookie, profile limiter/routes and Technology routes. The cancellation test
  specifically PASS. No EACCES, unexpected unhandled rejection or lingering
  server handle occurred in that run; process exit was 0 without force-exit.
- **313 distinct passing test records**, not a claim that every API suite was run.
  Production/test-inclusive API compilation, targeted zero-warning lint,
  formatting, strict UTF-8/LF, diff/scope and sensitive-data checks are recorded
  with this offline review; no browser or real database qualification follows.

Initial failures are retained: route-file bootstrap loaded env before synthetic
test configuration (1 file failure); its first in-memory fixture lacked the
existing limiter's append-header interface (10 route failures). Both test defects
were corrected and the final route run is 16/16 PASS. Initial TypeScript findings
were unsupported cursor signal options and two test-only type annotations; these
were corrected without weakening checks. Targeted lint found a throw in finally;
cleanup was restructured to preserve safe failure precedence without a rule waiver.
These are historical failures/corrections, not erased or counted as extra PASS.

### Independent review and resolved findings

Fresh-context reviewer `f043_slice1_security_review` inspected the actual source,
audit changes, tests and prepared integration without edits or execution. Final
unresolved Critical / High / Medium / Low: **0 / 0 / 0 / 0**. One Medium finding
(abort failure could skip endSession) and four Low findings (supplied/defaulted
audit fields, shared quota/capacity coverage, concurrent-test rejection handling,
early loss-subscription disposal) were corrected and re-reviewed. The actual
repository abort-rejection regression and all quota/audit-fidelity cases PASS.
The reviewer separately confirmed the result/failure/cleanup restructuring.

Installed MongoDB 7.6.0 `src/sessions.ts` source inspection confirms commit uses
the passed timeoutMS and shares one TimeoutContext with same-transaction retries;
the application makes one commit call and never replays the domain callback.
This local source-level qualification is not a forced real network/commit timeout
test. Driver real unknown-commit/timeout and concurrent transaction outcomes remain
NOT_VERIFIED. Client endSession flags are not proof of server storage/process cleanup.

### Prepared integration and open acceptance gates

`admin-technology.integration.ts` exports registration only; importing does not
connect, provision, generate credentials or register tests. Prepared manifest:
PARENT + T01–T14, **all NOT_RUN**, no authenticated counters or RESULT/digest ACK.
Assertions cover real draft/fence/audit behavior, revisions, duplicates, stored
eligibility, atomic audit rollback, read-only states, concurrent edits, read
nonmutation, both demotion orderings, deletion before mutation/fence, a simulated
lost-delivery outcome after a real commit, and cancellation rollback. The simulated
delivery case does not establish a real driver unknown-commit or forced DB timeout.
Ownership loss is irreversible and combined into every authority signal; fresh
ownership checks bracket mutation boundaries and commit admission. The cancellation
case awaits repository cleanup before asserting rollback. No scenario has executed.

An approved F043 adapter/full fixture-index reconciliation is still required.
Do not reuse F042's old source pins or historical PASS after the F043 source changes;
fresh independently reviewed pins/manifests and a qualified execution context are
separate gates. Existing ignored F042 adapters were not changed. Never run this
export as an unguarded standalone suite. Owned Job/process/storage/port cleanup,
protected baselines, deadlines and authenticated RESULT/digest ACK must be proven
by the separately approved guarded invocation, not this source preparation.

New passing HTTP regressions do not retroactively erase F042's 43 historical
EACCES failures, inconclusive timeout or older tsx startup failure, and do not
advance its acceptance or silently close its verification ledger. F042 remains
IN_PROGRESS with acceptance BLOCKED; mandatory MongoDB verification is incomplete,
historical authenticated counters UNKNOWN and RESULT/ACK incomplete. Its recorded
HTTP backlog requires separate owner reconciliation of the new regression evidence.
Live Admin frontend-to-API integration, real F043 MongoDB transactions and production
readiness remain NOT_VERIFIED. Existing 193 browser cases remain NOT_RUN; F043's
proposed browser cases are still not prepared/executed. No F044 work.

Next owner gate: review this backend offline evidence; separately authorize any
integration adapter/source-pin/fixture reconciliation and guarded execution. Slice 2
implementation, each development commit, each push and final acceptance retain
their own explicit approvals. No staging, commit or push occurred.

## Dedicated adapter preparation and completion — 2026-10-30

This later owner approval authorizes adapter preparation and offline verification
only. It supersedes the earlier statement that no F043 adapter exists, without
authorizing a guarded invocation. F043 remains IN_PROGRESS; backend Slice 1 is
READY_FOR_REVIEW — offline only, acceptance BLOCKED. F042 remains IN_PROGRESS with
acceptance BLOCKED. Slice 2 and F044 remain NOT_STARTED.

The dedicated ignored support inventory is:

```text
.cache/f043-slice1-guarded-runner.ps1
.cache/f043-slice1-supervised-launcher.ps1
.cache/f043-slice1-supervised-host.mjs
.cache/f043-slice1-fixture.mjs
.cache/f043-slice1-launcher.tests.ps1
.cache/f043-slice1-protocol.test.mjs
.cache/f043-slice1-index-manifest.json
.cache/f043-slice1-source-pins.json
```

Existing F042/F040/F039/F038 adapters remain unchanged. No production code,
dependency, authentication contract or frontend change is part of preparation.
The existing integration-test registration correction synchronously registers
PARENT before qualification; qualification and the unchanged assertions run
inside that actual parent. Its formatting is reconciled in the completion pass.

### Exact fixture, manifest and frozen-source boundary

The authenticated manifest is exactly PARENT plus T01–T14, all **NOT_RUN** for
real MongoDB integration. Record IDs match actual node:test terminal event names.
Diagnostic START/PASS messages cannot populate the authoritative ledger. The
existing authenticated private channel, nonce/generation/challenge binding,
monotonic and absolute expiry, one-shot private delivery, strict RESULT parser
and matching digest ACK remain mandatory. F042's nine-record manifest cannot
be accepted as F043 evidence. Parent delivery observations remain distinct from
validated RESULT, ACK write completion and the host's actual matching-ACK check.

The footprint is **19 collections and 25 explicit canonical indexes**, excluding
the automatic _id indexes: the existing 21 fixture definitions plus Technology
unique slug and status/order, and audit actor/time and resource/time indexes.
There are 13 indexed collections plus six empty complementary collections.
The fixture uses three freshly generated synthetic account credentials only
after separate generated-credential execution approval; no human credential or
credential transport replacement is introduced. Accounts have unique run-marked
example.invalid emails and initialized User __v. Real existing login/session/
audit and signed JWT verification establish the synthetic Admin authority.
There is no fixture HTTP listener or database-drop cleanup. Plaintext references
are cleared where supported; complete managed-memory zeroization is not claimed.

The frozen allowlist contains **557 repository paths plus 23 supplemental paths
(580 content pins)**. Enumeration uses the approved absolute, SHA-checked,
retained-file-handle-verified ripgrep under a read lock with --no-config, checked
exit status and exact normalized inventory/count/hash validation. AGENTS.md is
explicitly supplemental because the existing ignore rule omits it from rg output.
The source-pin manifest cannot hash itself: its own independently approved SHA
is a separate execution precondition; the runner additionally holds its read lock
for the complete invocation and compares its hash before/after in source evidence.
Do not regenerate the manifest during execution to accept an unexpected change.
Any later approved source/support/document change invalidates the relevant pins
and requires explicit reconciliation/review before a guarded invocation.

### Offline evidence and historical corrections

The initial interrupted preparation reported 120 PASS / 2 FAIL before correcting
a missing lifecycle helper and a nested node:test registry check. A subsequent
completion run found a duplicate lifecycle helper (file startup failure), then a
formatting-sensitive source assertion. Those test-only defects were corrected;
the registry probe now uses a bounded synthetic Node child with no database or
HTTP and no integration-export execution. Targeted lint initially found unused
test imports/destructured fields and missing Node-global declarations; these were
resolved without disabling rules or changing repository configuration. The first
pin-generation command rejected its incorrectly filtered supplemental count;
the corrected construction extracts the runner's exact 22 supplemental literals
and explicitly adds AGENTS.md. No rejected construction authorized execution.
Historical failures are not removed or relabelled as integration PASS.

Final offline protocol checks: **107 PASS / 0 FAIL**. Pure PowerShell
parser/frame/approval-refusal/digest/source checks: **33 PASS / 0 FAIL**.
These counts include synthetic protocol and mocked target qualification only;
they are not the 15 real database records and are not added to the earlier
313 implementation test records as new real integration evidence.
Test-inclusive API TypeScript, targeted zero-warning lint, support/test formatting,
UTF-8/LF, source-pin, scope, diff and sensitive-data checks accompany completion.

Fresh-context independent reviewer `f043_completion_review` inspected the actual
support files, integration correction and source-pin rules read-only. Unresolved
Critical / High / Medium / Low: **0 / 0 / 0 / 0**. One Low stale diagnostic
(eight complementary collections instead of six) was corrected to the actual
collection-plan count and covered by an offline source assertion. The review
confirmed synchronous registration, exact record mapping, fixture cleanup-finally
boundaries, inherited native/CIM/Job ownership, protected-baseline comparisons,
private delivery/expiry and RESULT/digest ACK rules. Source review is not runtime
qualification or acceptance. Final manifest content must match actual files.

### Separate execution prerequisites — all runtime facts NOT_VERIFIED

No MongoDB connection, database/fixture/index write, protected port 27017 access,
HTTP/browser integration or Windows process/CIM investigation occurred during
this completion pass. No credential generation or guarded invocation occurred.
Real connectivity, writable PRIMARY, exact server/storage/process identity,
exclusive empty target, actual 19/25 provisioning, User-version fences, concurrent
demotion/deletion, unique slugs/revisions, atomic audit/rollback and cleanup remain
**NOT_VERIFIED**. Authenticated real RESULT/ACK and counters are unavailable;
PARENT + T01–T14 remain **15 NOT_RUN**.

Before a separately approved one-attempt invocation require current approved
executable and adapter/manifest SHA identities; a fresh unelevated, permission-
qualified execution process with absent attempt marker; retained handles and
exact Job/CIM/owner/UTC creation identity; protected MongoDB process/executable/
owner/service/storage baselines independently established (never only a port or
PID); free disposable ports and no concurrent/leftover resources. Verify source
pins before owned MongoDB startup; verify writable PRIMARY and exact target
before any database enumeration or fixture operation. The sole target remains
127.0.0.1:27018, replica f021-test, database deeplearner-f021-test in newly owned
disposable storage. Never substitute protected/shared data.

The original five-second RPC/ACK, two-second heartbeat, 180-second suite and
205-second supervisor caps remain unchanged. Runtime feasibility is unmeasured;
there is no promise of completing within those caps. Preserve fatal-loss refusal,
fresh ownership at mutation boundaries, no automatic retry, graceful verified
shutdown, exact owned-Job fallback, empty Job/closed handles, released ports,
removed owned storage and unchanged protected/source/environment baselines.
Any FAIL/UNKNOWN stops execution and retains actual sanitized evidence. The T13
simulated lost-delivery case does not prove a forced real unknown-commit/timeout.

Preparation is eligible for a separate controlled-execution approval subject to
fresh complete preflight; it does not declare runtime readiness or acceptance.
F043 final acceptance also requires the outstanding F042 prerequisite gate.
All **193 inherited browser scenarios remain NOT_RUN**; live frontend-to-API and
production readiness remain **NOT_VERIFIED**. No Git staging, commit or push.

## Slice 2 frontend implementation and offline verification — 2026-10-30

The owner separately authorized frontend implementation at backend checkpoint
`bb2c3838e2f7a40502cd7d25a25dee94c926da9e`, under the enacted F043-only exception.
Slice 2 transitioned from NOT_STARTED to IN_PROGRESS. No F042 acceptance, backend
production change, new dependency, live HTTP/MongoDB/browser execution or Git
delivery is included. The original 13 frontend paths plus the two evidence
documents were reconciled before editing. The owner additionally approved
`apps/admin/tests/admin-rendering.test.ts` and
`tests/browser/admin-access.spec.ts`, including its strictly bounded synthetic
initial-inventory read fixture, to retain the existing authentication regressions.
The complete change boundary is therefore **17 paths**, not a silent scope expansion.

### Exact frontend change inventory

CREATE:

```text
apps/admin/src/lib/technologies/contracts.ts
apps/admin/src/lib/technologies/technology-client.ts
apps/admin/src/lib/technologies/technology-controller.ts
apps/admin/src/hooks/use-technologies.ts
apps/admin/src/components/technologies/technology-manager.tsx
apps/admin/src/components/technologies/technology-manager.module.css
apps/admin/tests/technology-client.test.ts
apps/admin/tests/technology-controller.test.ts
apps/admin/tests/technology-rendering.test.ts
tests/browser/admin-technologies.spec.ts
```

MODIFY:

```text
apps/admin/src/lib/auth/admin-controller.ts
apps/admin/tests/admin-controller.test.ts
apps/admin/src/app/app.tsx
apps/admin/tests/admin-rendering.test.ts
tests/browser/admin-access.spec.ts
docs/features/F043-admin-technology-management.md
docs/DEVELOPMENT_ROADMAP.md
```

### Implemented behavior and security boundary

The eligible Admin workspace now presents the protected Technology inventory,
bounded slug-ordered pagination, detail, DRAFT creation and DRAFT-only editing of
name/description/order. Existing slugs are immutable. PUBLISHED/ARCHIVED records
have a read-only detail view; icon references are never turned into arbitrary URL
fetches. Actual API counts, loading/empty/error/save states, explicit refresh,
revision-conflict recovery and uncertain-outcome reconciliation replace the
scaffold. There are no publish/archive/delete/upload/bulk controls or fake metrics.
Existing sign-in, explicit restore, current-access revalidation and shell logout
remain available. The approved Stitch hierarchy is adapted to existing Admin
colors and layout, without copying unrelated navigation or adding dependencies.

The existing Admin controller exposes four strict Technology descriptors, not a
token getter or caller-provided transport. It privately binds token, account,
generation and eligibility to dispatch and completion. Requests use only the
existing approved API origin, omit cookies, use Bearer authorization, no-store
and redirect refusal. The whole operation has a nonrenewing 15-second monotonic
budget including coordination queue time. Existing cookie-operation coordination
and admitted-work draining are preserved; no background refresh or mutation replay
is added. The known F042 cross-origin refresh-cookie race remains unverified.

Strict nested envelopes/DTOs reject private or unknown fields, contradictory
pagination, wrong IDs/revisions and invalid status/timestamps. Response input is
limited to 1 MiB of actual streamed UTF-8 bytes, using fixed bounded storage even
for adversarial tiny/empty chunks. Serialized mutation bodies are limited to
4,096 UTF-8 bytes before dispatch, with form feedback for multibyte descriptions.
Canonical 413/415 refusals are sanitized. HTTP 401/403 removes authority even if
its body is malformed; raw server errors are never rendered or logged.

Inventory, detail and forms are account-bound and memory-only. Suspend, expiry,
logout, account changes and unmount cancel/refuse late responses and clear data.
A long-lived, nonsensitive boolean retains mutation uncertainty across eligible
view remounts. Such a remount does not automatically load or clear that warning;
an explicit successful inventory/detail reconciliation is required before another
submission. This is not durable idempotency or proof of a lost commit outcome.
Full page/process termination cannot preserve an in-memory warning; operators
must reconcile any unconfirmed change rather than resubmit blindly.

Source includes labelled fields, field-level validation, escaped text, semantic
timestamps, status announcements, disabled duplicate submissions, intentional
editor/inventory focus handling, contained table scrolling and responsive CSS.
Offline server rendering and focus doubles do not prove browser accessibility,
focus order, contrast, layout or responsiveness.

### Executed offline evidence and historical corrections

The six focused/relevant Admin files executed with the existing Node/tsx tooling:

```text
apps/admin/tests/technology-client.test.ts
apps/admin/tests/technology-controller.test.ts
apps/admin/tests/technology-rendering.test.ts
apps/admin/tests/admin-client.test.ts
apps/admin/tests/admin-controller.test.ts
apps/admin/tests/admin-rendering.test.ts
```

**254 distinct tests PASS / 0 FAIL / 0 cancelled / 0 skipped**. This includes
fixed request contracts, raw/private response refusal, actual stream caps,
monotonic delayed-timeout checks, account/generation cancellation, 401/403
invalidation, coordination queue deadlines, logout draining, duplicate prevention,
conflict/uncertainty recovery, a real controller-to-controller remount scenario,
inert React server rendering, focus intent and hook cleanup. All transports and
browser hosts in these offline checks are synthetic; no network listener,
database, credential generation or browser was used. After the final fixed-memory
reader/focus-test refinement, the affected two suites were rerun: **62/62 PASS**,
a subset of the same 254 records, not additional distinct tests.

The first combined run retained **243 PASS / 2 FAIL**: obsolete scaffold wording
and a case-sensitive readonly attribute assertion. They were corrected within
approved test scope. A subsequent request-size correction introduced temporary
request/response variable shadowing, causing client test failures; the binding
was corrected and the later complete runs passed. These failures are historical,
not real integration evidence. The previous backend **313 PASS**, adapter
**107 protocol PASS / 33 PowerShell PASS** are retained, not rerun here and not
converted to frontend/live database acceptance.

Admin production build, source-and-test-inclusive TypeScript and targeted
zero-warning lint pass with existing tooling. Formatting, UTF-8/LF, exact scope,
diff and sensitive-data checks accompany the final review. The build reports a
nonfatal ineffective-dynamic-import notice: the validated environment module is
also statically imported by the existing application, so its lazy use in the
controller does not create a separate bundle chunk. It is not a runtime failure
or an environment/configuration change.

Fresh-context independent reviewer `f043_frontend_review` inspected the actual
source read-only. Two Medium findings (uncertainty lost on remount and malformed
401/403 retaining authority) and three Low findings (UTF-8 request bound,
newline slug feedback and editor focus restoration) were corrected and covered
by focused offline checks. Critical/High findings: zero. Final consistency review
reports **0 / 0 / 0 / 0 unresolved Critical / High / Medium / Low findings**. The
reviewer also inspected final tests, prepared browser specifications and
documentation, without independently executing them. Source review does not
establish browser or live backend behavior. Slice 2 is **READY_FOR_REVIEW — offline
only**; it is not owner-accepted.

### Prepared browser scenarios — all NOT_RUN

`tests/browser/admin-technologies.spec.ts` contains exactly F043-B01–B20:

| IDs     | Prepared coverage                                                                     |
| ------- | ------------------------------------------------------------------------------------- |
| B01–B04 | Authenticated inventory, empty state, pagination, DRAFT detail/revision               |
| B05–B07 | Create, revision-controlled edit, field validation                                    |
| B08–B11 | Published/archived read-only, conflict, uncertain write/no replay                     |
| B12–B16 | 401/403 invalidation, 404, 429/503, private response refusal                          |
| B17–B20 | Stale/account-change refusal, logout/storage, keyboard focus, responsive/escaped text |

These require separately qualified isolated browser infrastructure and an already
available approved Admin runtime. API routes are intercepted with synthetic
fixtures, unexpected external network is refused, service workers are blocked,
and trace/video/screenshots are off. Mocked browser execution would still not
prove live frontend-to-API integration. The prepared F042 spec preserves its
authentication/lifecycle/logout assertions while recognizing the new workspace
and one narrow, Bearer/no-cookie initial empty-inventory mock.

All **193 inherited browser scenarios remain NOT_RUN**. The **20 newly prepared
F043 scenarios remain NOT_RUN**: combined prepared backlog **213 NOT_RUN**. No
browser exception is granted or inherited. Real-browser layout, accessibility,
focus, interaction and responsiveness remain NOT_VERIFIED. Live F043
frontend-to-API integration remains NOT_VERIFIED.

### Open acceptance gates

F042 remains IN_PROGRESS, acceptance BLOCKED, with historical HTTP/MongoDB
failures, UNKNOWN authenticated counters, incomplete RESULT/digest ACK and
protected-baseline discrepancy retained. F043 Slice 1 remains READY_FOR_REVIEW —
offline only; all real PARENT + T01–T14 records remain **15 NOT_RUN**. The latest
protected MongoDB process executable/owner identity remains **UNKNOWN**; no
database connection or guarded invocation is authorized by this frontend pass.
Real transactions, concurrency, protected baselines and process/Job cleanup are
not established by these frontend tests. Forced real timeout/unknown commit
behavior remains NOT_VERIFIED. Source changes invalidate prior relevant frozen
integration pins; reconcile/review them before any separately approved execution.

F043 remains IN_PROGRESS and final acceptance BLOCKED. Production readiness is
NOT_VERIFIED; F044 remains NOT_STARTED. Local development checkpoint, push,
qualified browser/live integration and feature acceptance require their separate
owner gates. No Git staging, commit, push, history rewrite or automatic progression.

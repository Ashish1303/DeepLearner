# F045 — Admin Module Management

## Admin completion reconciliation and G1 review — 2026-11-06

**Full-feature status: IN_PROGRESS. Acceptance: INCOMPLETE; no final owner acceptance.**
Checkpoint readiness/delivery is separate from the official feature status.

| Evidence field                                 | Current verified record                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Intended user outcome / implemented capability | Under Learning Path detail, explicit Load Modules opens bounded both-parent inventory/detail with read-only DRAFT/PUBLISHED/ARCHIVED metadata. No Module creation/editing/review API or UI exists.                                                                                                                                   |
| Checkpoint and delivery                        | Read-only inspection delivered/offline-reviewed; READY_FOR_REVIEW for its outstanding live/slice acceptance, not complete Module management. 1f687bd5f6c83252ed32a0dcf9411bbd3cb9ef2b plus strict stored-status correction74537e5667e593d7f03c807e488212915edc021c; PR #2 merged to dev as ecdcf04c2500ffe027848c72c5e5b249940f5ef4. |
| Remaining product work / verification debt     | AI-origin candidate/admission/parent mapping, immutable revisions, review/edit integration and release membership; live inspection/API/database/loaded-layout qualification. Manual-origin M1 remains NOT SELECTED, not an approval request.                                                                                         |
| Real dependencies                              | F018/F042/F044 inspection; actual AI-origin generation/admission (F054), editorial F049/F050, publication F051.                                                                                                                                                                                                                      |
| Exact next action                              | Contract AI-origin outline-to-Module mapping within the proposed pilot after authoritative generation/domain boundaries; no manual M1 or F046 substitution.                                                                                                                                                                          |

This is a read-only source/history/evidence reconciliation, not new live QA or
feature acceptance. Delivery references below are established by local Git objects,
ancestor checks and retained delivery receipts; network access was prohibited, so
current GitHub/remote state and CI were not freshly queried. Zero/pending checks
are not CI PASS. Retain every dated earlier proposal/result as historical evidence.

Current review/documentation branch: `product/f053-control-contract`, base/HEAD
`ef2ec242a3f7d64b1f7b6f9c1f6fd7273457fcba`, isolated
`f053-contract-20261106T055602Z/worktree`. No new implementation was started.
See the [current roadmap review and completion plan](../DEVELOPMENT_ROADMAP.md#admin-completion-reconciliation-and-g1-review--2026-11-06)
for the combined pending inventory, evidence, milestone and owner decisions. The
earlier “current”/uncommitted/proposed wording below is an as-of record wherever
superseded by this section. No full feature is APPROVED_COMPLETE by this update.

## Authority and bounded scope

2026-11-05 Product Development Reset: owner authorizes this one useful offline
product slice and the named sequencing exception in AGENTS.md. Feature IN_PROGRESS,
partial development only. Acceptance remains incomplete. F044 is not renamed or
expanded. The roadmap's full F045 direction remains Module proposals/review and
later release membership. Those behaviors are excluded from this first slice.

Central requirements: ../PRD.md sections 107–108; ../DEVELOPMENT_ROADMAP.md F045
and approved ID reconciliation; ../DATABASE_DESIGN.md F018 Module refinements;
../API_DESIGN.md; ../design/stitch/SCREEN_MAP.md and shared/DESIGN.md. Existing
F018/F042/F044 contracts remain controlling outside this explicit additive scope.

User outcome: Admin keeps Technology Management as default, opens Learning Paths,
selects an existing Technology and Path, then reads paginated Modules and selected
Module metadata, including DRAFT/PUBLISHED/ARCHIVED. Reuse existing Stitch surfaces,
responsive choice cards, pager, focus rules and escaped text. No new browser route,
mutation control, status transition, provider output, fabricated counts or progress.

## API and security contract

- GET /api/v1/admin/modules?technologyId=<24hex>&learningPathId=<24hex>&page=1&limit=20
- GET /api/v1/admin/modules/:id?technologyId=<24hex>&learningPathId=<24hex>
- Both parent IDs mandatory; strict query/body rejection. Canonical lower-case IDs;
  page positive decimal, limit 1–100 (default20), page default1, offset <=10,000.
- Existing authenticated F042 namespace: valid ADMIN JWT AND current stored
  verified ACTIVE ADMIN eligibility before business dispatch; five-second eligibility
  read. Existing global IP/account limits plus Module account read limit120/minute,
  store capacity10,000, fail closed. No authorization policy changes.
- Ten-second Module read budget and cancellation, inherited fifteen-second restricted
  client budget. Read-only native-driver calls, primary preference, operation timeout,
  maxTimeMS for aggregation; no automatic index/collection creation or schema changes.
- Parent Technology must exist with valid stored status; Path must exist, belong to
  that Technology and have valid stored status. Archived ancestors allow protected
  inspection. Missing/mismatched parent: generic404 LEARNING_PATH_NOT_FOUND for list,
  MODULE_NOT_FOUND for detail; invalid/corrupt storage: sanitized503. No partial data.
- Module query matches BOTH parent IDs; order order ASC, slug ASC, _id ASC with
  simple collation. One facet produces records/count. Recheck ancestors before
  returning; these checks are point-in-time reads, not snapshot transactions or a
  guarantee against every concurrent change. Missing child:404 MODULE_NOT_FOUND.
- Explicit DTO: id, technologyId, learningPathId, title(1–120 trimmed), slug(1–100
  kebab-case), description(null or <=2,000), status, order(nonnegative safe integer),
  revision(nonnegative __v), createdAt, updatedAt(canonical ISO, chronological).
  Projection excludes all other fields; raw projected objects and client envelopes
  are strict. Reject duplicate IDs/slugs, bad ordering/counts and parent mismatches.
- Standard success/error envelopes; list pagination meta; no-store namespace response.
  400 validation,401 authentication,403 ineligibility,404 unavailable,429 limits,
  503 dependency failure. No raw database errors or private error text in UI.
- Only fixed GET request descriptors cross the restricted Admin controller. Tokens
  remain inside it; no UI/browser storage, new cookie behavior, arbitrary URLs or
  mutation replay. Existing logout/expiry/generation invalidation cancels reads.

## UI and offline acceptance

Module pane mounts only beneath selected Path detail; its explicit Load Modules
button starts the first read, so opening existing Path detail adds no hidden request.
The pane is keyed by account+Technology+
Path. Unmount, authority loss and newer reads abort/invalidate late work. List,
detail, explicit Refresh/Retry, empty/error/denied/loading and bounded Previous/Next
states are required. Modules cannot select arbitrary IDs outside loaded inventory.
Parent switching clears the pane. Active proposal Save/recovery disables its controls;
no change to proposal uncertainty, draft navigation guards or Technology default.

Focus-visible, native buttons, region labels, aria-busy/status, escaped text and
responsive existing CSS are source/rendering requirements. Loaded 1440/768/390/320
layouts, actual keyboard behavior and screen readers require separate Desktop QA;
offline markup/build is not a visual or browser PASS.

Meaningful offline checks: signed-JWT/current-account route refusal; both-parent
validation and archived access; DTO/privacy/order/count consistency; deadlines and
cancellation; client fixed-origin GET/bounded response checks; logout/late response
isolation; rendering/status/disabled/pagination controls. Full API/test TypeScript,
production API/Admin builds, targeted lint/format/encoding/diff and source review.
No real MongoDB/HTTP listener/browser startup. Later live read smoke needs separately
authorized existing data/readiness, qualified runtime ownership and preserved protected
baselines; existing database prerequisites cannot be inferred from this code.

## Exact checkpoint inventory

CREATE:

- apps/api/src/modules/admin/modules/admin-module.schema.ts
- apps/api/src/modules/admin/modules/admin-module.dto.ts
- apps/api/src/modules/admin/modules/admin-module.repository.ts
- apps/api/src/modules/admin/modules/admin-module.service.ts
- apps/api/src/modules/admin/modules/admin-module.controller.ts
- apps/api/src/modules/admin/modules/admin-module-rate-limit.ts
- apps/api/src/modules/admin/modules/admin-module.routes.ts
- apps/api/tests/admin-module.test.ts
- apps/api/tests/admin-module-routes.test.ts
- apps/admin/src/lib/modules/contracts.ts
- apps/admin/src/lib/modules/module-client.ts
- apps/admin/src/lib/modules/module-controller.ts
- apps/admin/src/components/modules/module-inspector.tsx
- apps/admin/tests/module.test.ts
- apps/admin/tests/module-rendering.test.ts
- docs/features/F045-admin-module-management.md

MODIFY:

- apps/api/src/modules/admin/admin.routes.ts
- apps/admin/src/lib/auth/admin-controller.ts
- apps/admin/src/components/learning-paths/learning-path-manager.tsx
- apps/admin/tests/admin-controller.test.ts
- apps/admin/tests/learning-path-rendering.test.ts
- AGENTS.md
- docs/PRD.md
- docs/API_DESIGN.md
- docs/DEVELOPMENT_ROADMAP.md

25 paths, no dependencies/lockfile, existing models/public APIs, supervisor,
guarded pin manifests, U16 QA files or primary checkout changes. Isolated branch
product/admin-module-inspection starts at committed dev7683811c2c66a90d0a83c6aec1d1025460710b3e.
Normal startup validates the repository identity against its private profile;
guarded browser leases bind their own repo/source hashes. This branch is not adopted
by a running runtime. No binding edits/refreeze or private configuration inspection.

## Preserved limitations

F042/F043 acceptance BLOCKED; F044 IN_PROGRESS; original nine / P five / API six
integration groups and U01–U16 NOT_RUN. U16 BLOCKED, historical forced containment
and UNKNOWN final Job-empty/retained-exit proof unchanged. Combined 213 unaffected
+12 corrected mocked results cover225 identities, not a fresh suite run or real
API/database acceptance. Production NOT_VERIFIED. No feature acceptance, commit,
push, runtime startup, live database operation, generation/editorial/publication or
later feature work is authorized by this checkpoint.


## Offline checkpoint evidence — 2026-11-05

**READY_FOR_REVIEW — offline only.** Estimate35–60 minutes; actual duration is
recorded in the final handoff. Implementation is uncommitted on the isolated product
branch at7683811c2c66a90d0a83c6aec1d1025460710b3e. No runtime resources adopted,
started or stopped, no guarded manifests changed, and no live/paid calls performed.

Executed checks:

- Initial focused six-file Node/tsx run: **163/163 PASS**, zero skipped/cancelled.
  Files: API admin-module.test.ts/admin-module-routes.test.ts and Admin module.test.ts,
  module-rendering.test.ts, admin-controller.test.ts, learning-path-rendering.test.ts.
- After adding native-repository and inert-mount assertions and correcting a test
  query fixture, reran only API admin-module.test.ts/admin-module-routes.test.ts and
  Admin module-rendering.test.ts: **49/49 PASS**, zero skipped/cancelled. Combined
  applicable evidence covers **166 distinct offline tests**, not a fresh166-test run.
- Self-review then found a Medium StrictMode reconnect defect: ordinary disconnect
  incorrectly left the Module pane denied. Ordinary disconnect now clears to idle;
  real authority loss remains denied. Added a reconnect regression and reran only
  Admin module.test.ts: **8/8 PASS**, zero skipped/cancelled. This adds one distinct
  case to the initial163 plus two added cases covered by the49-case rerun.
- Shared packages build, full API/test TypeScript with noEmit/incremental false,
  production API build, final Admin build/typecheck, and focused Admin source/test
  TypeScript: **PASS**. The initial full check found one new TS2345 in the cancellation
  fixture (missing learningPathId); corrected and full check rerun PASS. No unrelated
  baseline repair. Vite retains its existing ineffective dynamic env-import warning.
- Targeted ESLint max-warnings=0, source Prettier and diff whitespace checks: **PASS**.
  Documentation is excluded by the existing Prettier policy; appended sections are
  reviewed for consistent headings/tables/scope and UTF-8/LF, not described as a
  whole-document formatter PASS. Existing historical documentation is preserved.
- Fresh independent agent source/security review: **0 unresolved Critical/High/
  Medium/Low findings**. It identified the same test-fixture typo, then confirmed
  closure in current source. Independent follow-up also confirmed the self-review
  Medium reconnect correction; no findings remain unresolved. It ran read-only
  diff --check, not tests/runtime/DB/
  browser checks. Self-review is separate from that independent source-only review.
- Privacy/scope/encoding checks require exactly the25 contract paths, no credentials,
  generated artifacts, lockfile/model/public API/supervisor changes. Primary dev clean
  at the sameSHA; all12 pending U16 files must retain their pre-task byte fingerprints.

Representative commands (from this isolated worktree):

```text
node --import tsx --test apps/api/tests/admin-module.test.ts apps/api/tests/admin-module-routes.test.ts apps/admin/tests/module.test.ts apps/admin/tests/module-rendering.test.ts apps/admin/tests/admin-controller.test.ts apps/admin/tests/learning-path-rendering.test.ts
node --import tsx --test apps/api/tests/admin-module.test.ts apps/api/tests/admin-module-routes.test.ts apps/admin/tests/module-rendering.test.ts
node node_modules/typescript/bin/tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false
npm run build:packages
npm run build --workspace=@deeplearner/api
npm run build --workspace=@deeplearner/admin
git diff --check
```

No new browser cases executed or generated; loaded responsive/keyboard/real API
behavior is **NOT_VERIFIED**. No live Module data or index guarantees are established.
Existing 225-identity combined mocked evidence remains historical to its reviewed
sources, not a claim that this candidate passed browser regression. Explicit first
Load preserves old detail opening behavior but does not qualify new Module UI.

Next recommended task: **DEVELOPMENT / HIGH / VS Code** — finalize the smallest
bounded AI Studio outline pilot contract and its explicit F049/F052/F053 prerequisite
order, using the existing brief/Save boundary instead of building more generic
infrastructure. Expected eventual user outcome: select Technology, enter a brief,
request a bounded reviewable outline with real generation clearly distinguished
from private saved inputs. That is a new recommendation, not authorization to
implement/call a provider or bypass formal dependencies. Separately owner-review
this checkpoint, then scope Desktop read-only Module QA on qualified delivered
sources. Do not copy this worktree into a running checkout or invalidate its binding.


## Remaining F045 reconciliation and checkpoint M1 proposal — 2026-11-05

> **HISTORICAL PROPOSAL — NOT SELECTED by the owner on 2026-11-05.**
> Module creation remains AI-led. Manual-origin M1 and its sequencing extension
> were not approved; no implementation authority exists. The original proposal
> below is retained as historical evidence, not an outstanding approval request.


**Contract preparation only. M1 PROPOSED — PENDING OWNER APPROVAL; NOT_STARTED.**
The owner authorized one remaining F045 slice only if its product semantics are
established, otherwise an implementation-ready contract and the exact missing
decision. That condition is not permission to invent a manual authoring source.
The existing read-only development exception remains the only active F045 scope;
AGENTS.md is unchanged. F045 remains IN_PROGRESS, acceptance incomplete.

### Current delivery and remaining product work

Fresh inspection found a clean product/admin-module-inspection worktree at
1f687bd5f6c83252ed32a0dcf9411bbd3cb9ef2b, empty index. GitHub PR #2 is open/draft,
targets dev7683811c2c66a90d0a83c6aec1d1025460710b3e, and has that exact product
head; remote branch refs agree. The preceding evidence's “uncommitted” and F054
next-task wording is historical, not the current delivery state or recommendation.

| Area                    | Delivered or available                                                                                                                                                                                        | Missing, and whether it blocks M1                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module inspection       | Parent-bound protected inventory/detail, archived inspection and read-only Admin pane; offline-reviewed checkpoint in draft PR #2.                                                                            | Live read/UI/database qualification and acceptance remain open; these do not prevent independent inert structure development.                                                      |
| Module proposals        | No Module proposal schema, admitted producer, writer, API or UI. Existing F018 Module is catalogue storage, not private authoring.                                                                            | The permitted initial candidate origin is an unresolved product decision. Do not implement catalogue CRUD as a substitute.                                                         |
| Parent identity         | Existing catalogue Technology/LearningPath and both-parent inspection contracts. F044 private Learning Path proposals have separate identities.                                                               | No proposal-to-catalogue mapping exists. Proposed M1 targets existing catalogue parents only; it cannot create a Path or use an F044 proposal ID as a Path ID.                     |
| Reusable implementation | F018 title/slug/description/order conventions; C1 inert-data validation, canonical digests, strict DTOs and disconnected model patterns; F042/F043 current-account/transaction patterns for later operations. | Stored parent/actor checks, persistence/audit and concurrency must be contracted and implemented before any capture writer; structural validation supplies none of them.           |
| Editorial and release   | PRD exact-revision policy; F049/F050 review ownership and F051 module-release ownership.                                                                                                                      | Decision records, review queue and release membership are unimplemented; excluded from M1, required before claiming those capabilities.                                            |
| AI origin               | PRD13/44/105/107 require brief → AI outline → review. F044's separately approved manual brief contains no Modules.                                                                                            | No approved Module-generating source/output producer exists. F054 is not implemented by this proposal, nor required to develop an explicitly approved manual structural exception. |

### One blocking owner decision

**May F045 initially accept explicitly Admin-authored private Module candidates,
bound to an existing catalogue Technology and LearningPath, before AI generation
exists, under the exact M1 definition below?** This would be a new, bounded product
exception, not an inference from the F044 Admin-authored Learning Path brief.

Recommended A: approve that narrow initial origin and M1 offline implementation.
It allows dependency-first F045 development using existing parent/content patterns,
without a generic source/admission/provider framework. It does not authorize live
capture, manual lessons/Topics/interview answers, editorial approval or publication.
Alternative B: retain AI-only Module candidates. Then candidate creation waits for
an approved bounded output/producer contract in F054 and its actual dependencies;
do not invent an ingestion framework or implement F054 in F045 to hide the gap.
No choice is enacted here. Harness/U16 failures are verification debt, not the
reason this product-origin decision is needed. No new application defect is inferred.

### Proposed first checkpoint: M1 private initial Module-candidate definition

M1 is the smallest offline implementation prerequisite for later usable capture,
not a new authoring screen or a claim of usable Save. Define only an initial
immutable candidate, strict parent-bound structural validation/private DTO and
explicit disconnected model registration. No new generic authority abstraction,
source collection, provider enum, lifecycle state or proposal-family framework.
The intended later user journey is existing Technology → existing Learning Path
→ enter one Module candidate → explicit private Save → inspect/reconcile that
candidate. Capture API/UI and their failure/transaction policy need separate exact
contracts and implementation approval after M1. No save button is added by M1.

All following choices are **new design recommendations pending approval**, not
requirements retroactively attributed to F018/F044. Existing catalogue/public
schemas and DTOs remain unchanged.

| Required field                   | Exact M1 constraint and reason                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_id`                            | Canonical lowercase24-hex string or actual ObjectId at the inert model boundary; sole private candidate identity, not catalogue Module/Path identity. Explicitly supplied; no automatic allocation.                                                                                                                                              |
| `technologyId`, `learningPathId` | Same identity format, fixed catalogue-parent references. Exact expected `{technologyId, learningPathId}` binding required by record validation/DTO/model construction. Local equality only; no claim the records exist or belong together.                                                                                                       |
| `schemaVersion`, `revision`      | Both literal integer1. One initial immutable candidate only; no successor/family/predecessor API or update behavior. A future revision contract is not inferred.                                                                                                                                                                                 |
| `origin`                         | Literal ADMIN_AUTHORED. Identifies declared input origin; never proof of authenticated capture, AI generation, source verification or editorial approval.                                                                                                                                                                                        |
| `title`                          | Required1–120 UTF-16 units; reuse C1 proposalContent.title exactly, including well-formed Unicode, already-trimmed/nonblank single-line rules. Existing Module title bound.                                                                                                                                                                      |
| `slug`                           | Required1–100 lowercase ASCII kebab-case, exact end-of-input match, no coercion/repair. Reuse F018 convention. A proposed slug is not reserved; existing catalogue uniqueness is unchanged.                                                                                                                                                      |
| `description`                    | Required null or plain string1–2000 UTF-16 units, already outer-trimmed/nonblank and well-formed Unicode. LF and tab may occur internally; reject other C0/DEL, NEL and Unicode line/paragraph separator controls. Null means no description; no implicit empty-string/default conversion. Bounded Module summary, not executable HTML/Markdown. |
| `order`                          | Required nonnegative safe integer, no coercion/default. Reuses F018 display order; not a release position or publication command.                                                                                                                                                                                                                |
| `objectives`                     | Required ordered1–20 exact-distinct strings; reuse C1 proposalContent.objectives unchanged, each1–240. Makes the private candidate reviewable without duplicating audience/runtime/version metadata. These new Module objectives do not expand catalogue storage.                                                                                |
| `createdBy`                      | Required canonical actor ObjectId identity, explicit inert input for M1. Future writer must derive it from current fenced Admin authority; client assertion/schema success cannot authenticate the author. Excluded from private response DTO.                                                                                                   |
| `createdAt`                      | Required finite Date with canonical millisecond ISO round-trip. No automatic clock/default; future writer supplies server UTC. A Date/DTO string is not an admission receipt.                                                                                                                                                                    |
| `definitionDigest`               | Required64 lowercase-hex SHA-256; recompute against the exact definition below. Integrity only, not signature, authorization or approval.                                                                                                                                                                                                        |

Reject all unknown/operator/dotted fields before projection, accessors/proxies,
unsupported object prototypes, cycles, sparse/extra-property arrays and malformed
ObjectIds/Dates. Reuse C1's inert proposalData helper without changing that shared
implementation. Text is plain data; future UI must render escaped text. Validation
errors expose only the fixed message `Invalid Module proposal`, not raw values,
Zod issues, internal exceptions or payload/digest snippets.

Canonical digest bytes are UTF-8 JSON.stringify of this ordered array, with all IDs
as lowercase strings and createdAt as canonical ISO milliseconds:

```text
['F045-module-proposal-v1', _id, technologyId, learningPathId,
 1, 1, 'ADMIN_AUTHORED', title, slug, description, order,
 objectives, createdBy, createdAt]
```

No locale/Unicode normalization, trimming, sorting of objectives or object-key
enumeration determines the digest. Object property insertion order is irrelevant;
declared objective order and any defined content/identity/timestamp change matter.
The normalized complete record including digest must serialize to at most16,384
UTF-8 bytes. This proposed16KiB cap bounds one Module summary and is independently
effective for multibyte text within individual field bounds; it is not a parser or
server transport change. Test exactly the cap and one byte beyond using valid
Unicode field combinations, plus explicit independent digest vectors.

Private DTO allowlist: `id` (from `_id`), `technologyId`, `learningPathId`,
`schemaVersion`, `revision`, `origin`, `title`, `slug`, `description`, `order`,
`objectives`, `createdAt` (ISO). Validate the complete raw record, digest and expected
both-parent binding first; then omit only `createdBy` and `definitionDigest`.
Reject extra sensitive fields even when projection could hide them. Exclude source/
admission/audit IDs, actor metadata, roles, access/session material, internal errors,
AI/provider data and editorial/job/release state. DTO success proves no stored
existence, account authority or eligibility; it is not an API capability.

### Proposed model, inventory and offline acceptance

Proposed collection `moduleProposalRevisions`, model `AdminModuleProposalRevision`.
No automatic import/registration by the application. Explicit registration permits
only the existing disconnected Mongoose host (readyState0); recognize only the
identical previously registered model/schema, refuse collisions or connected hosts.
Disable autoCreate, autoIndex, bufferCommands, timestamps and versionKey. Explicit
fields only, strict throw, no casting/defaults; all fields immutable. Reuse C1's
sanitized full-record async/sync validation and supported save/update/replace/
delete/insertMany/bulkWrite refusal patterns; do not refactor C1 or add shared APIs.
Model guards are application defenses, not database permissions; native-driver or
raw-collection bypass protection is not established offline. No writer calls them.

Only MongoDB's normal `_id` uniqueness is intended initially. Declare no additional
index, TTL, catalogue slug reservation or family uniqueness without an actual writer/
query contract. No collection/index creation, init, syncIndexes or migration runs.

Exact future M1 CREATE inventory (no other application source):

```text
apps/api/src/modules/admin/modules/admin-module-proposal.schema.ts
apps/api/src/modules/admin/modules/admin-module-proposal.dto.ts
apps/api/src/modules/admin/modules/admin-module-proposal.model.ts
apps/api/tests/admin-module-proposal.test.ts
```

On separate approval, MODIFY only AGENTS.md to enact the proposed exception and
these four existing documents for enactment/evidence: this contract, PRD.md,
DATABASE_DESIGN.md, DEVELOPMENT_ROADMAP.md. Future M1 combined scope is nine paths;
current preparation changes only those four documents, not AGENTS.md or source.

Measurable future acceptance:

1. Valid inert fixtures pass; exact field/array/UTF-8 boundaries and missing, extra,
   operator, malformed/control/Unicode/unsafe-integer inputs are independently checked.
2. Both expected-parent mismatches and malformed binding objects fail; literal origin,
   schema/revision rules prevent AI/approved/source-authority claims or successors.
3. Independent digest vectors cover key insertion order, objective order, null/text,
   multibyte values, IDs/actor/date changes and raw-record integrity before projection.
4. Strict DTO privacy rejects raw nested/extra secrets; errors contain no fixture
   content. Tests use synthetic identities only and do not log negative payloads.
5. Import/registration produces no connection, listener, collection/index creation or
   application registration. Inert spies prove refusal of connected hosts/collisions,
   mutation APIs and altered documents; all resources/doubles restored after tests.
6. Focused Node tests, full API/test noEmit TypeScript, production API build/typecheck,
   targeted lint/format/UTF-8/LF/diff/privacy/scope and fresh independent source review
   pass. No browser/Admin build is needed for an API-only inert definition. No live
   database/bootstrap/runtime suite is invoked or claimed from mocks.

Estimate after approval:60–90 minutes for M1 implementation/offline review; stop at
90 minutes if incomplete. Later capture transactions/operation recovery/API/UI are
not included or estimated as executable here. Their contract must define current-
account fencing, actual parent validation/eligibility, atomic immutable candidate/
audit writes, actor-bound idempotency, uncertain-save reconciliation, retention and
parent lifecycle races before implementation. Existing patterns are reusable, not
accepted proof or permission to reuse F044 records as a Module source.

### Proposed sequencing extension — NOT ENACTED

> PROPOSED — PENDING OWNER APPROVAL. After the owner explicitly approves the
> Admin-authored private Module origin, catalogue-parent choice and M1 contract,
> separately authorize only the four CREATE paths above and five sequencing/evidence
> documents. Permit disconnected structure/digest/model/DTO work and inert tests
> while F042/F043/F044 verification and U16 remain blocked. Preserve primary dev,
> PR #3, U16 and parked support candidates; do not modify running-runtime bindings.
> No endpoint, UI, persistence writer, database connection/provisioning, source
> admission, operational capture, approval, publication, AI/provider, additional
> feature/slice or Git delivery follows. All current-account authorization, actual
> schema/index/transaction prerequisites, ownership, baselines, deadlines, RESULT/
> ACK, cleanup and mandatory acceptance gates remain unchanged. A shared security
> defect invalidating the dependency suspends work. Fresh independent source review
> and meaningful offline verification are required; neither establishes live proof.
> Each later implementation/live operation/commit/push needs separate approval.

### Current preparation outcome and parked verification lane

No new user-visible capability or implementation is claimed by this contract.
The one unresolved product-origin decision above blocks dependent authoring work;
it is distinct from deferred live verification. The approved manual origin, if any,
must be explicit and must not be presented as generated or editorially approved.
F049/F050 own editorial decisions, F051 publication/release membership, F054 AI.
The proposed F042_F043_OWNED_DISPOSABLE_V1 amendment is not enacted. F042/F043
integration remediation, support candidates and U16 remain parked; no diagnostics,
pin reconciliation, candidate installation or harness repair is part of this task.
F042/F043 acceptance BLOCKED; F044 IN_PROGRESS; F045 acceptance incomplete;
all unexecuted integration/browser groups and historical UNKNOWN evidence preserved;
production readiness NOT_VERIFIED. No claim that PR #2 or M1 completes management.


## Owner decision: AI-led Module creation — 2026-11-05

The owner selected **AI-led Module creation**. Independent manual-origin Module
authoring is not approved. The preceding M1 design, four-file implementation
inventory, manual collection/origin and proposed sequencing extension were
**PROPOSED BUT NOT APPROVED / NOT SELECTED**. They remain historical, not current
requirements or a request to reconsider the resolved origin decision. No M1 files
exist, no M1 implementation authority exists, and no M1 exception is enacted.

F044's separately approved Admin-authored curriculum brief and private Save/recovery
remain unchanged. A brief is input to a future AI outline; it is not an AI-created
Module or editorial approval. F045 read-only Module inspection in draft PR #2 is a
partial deliverable, not complete Module management or accepted persistence.

Admins may review/edit AI-origin proposals only through separately defined
editorial workflows. No edit endpoint, UI, arbitrary manual-origin import or
catalogue writer is authorized by that product direction. Changed content needs a
new exact revision/digest and cannot inherit approval; preserving AI-origin lineage
does not prove quality, source support or publication eligibility. F049/F050 own
review decisions/workflows; F051 alone owns publication/release operations. Review,
editing or even later approval does not itself publish anything.

Remaining F045 product work is AI-origin Module candidate structure/inspection and
integration with exact-revision review/editing, then separately defined release
membership. It needs an actual bounded outline/output/admission contract, including
Module/Path identity mapping and preserved generation provenance. Existing F044
proposal IDs are not catalogue LearningPath IDs. No new AI-origin model, source
authority, successor chain or admission guarantee is invented here.

The next recommended enabling checkpoint is **F049 Content Status Workflow — P0
offline revision-bound transition policy**, detailed in the roadmap's AI-led
dependency reconciliation. This is a proposal to address the business dependency,
not automatic next-feature progression or F049 implementation approval. F047's
formal prerequisite remains unmet; only an explicitly approved P0 development
exception could permit that isolated policy ahead of full F047. Do not mark F045,
F047 or F049 complete to obtain generation permission. F052/F053 and F054 remain
separate, with no selected paid provider/model and no live calls.

Primary dev, PR #3, U16's12 pending files and the parked F042/F043 support candidates
remain untouched. No F042_F043_OWNED_DISPOSABLE_V1 enactment, diagnostics, pin work,
runtime change or Git delivery. F042/F043 acceptance BLOCKED; F044 IN_PROGRESS;
F045 acceptance incomplete; all unexecuted groups and historical UNKNOWN evidence
preserved; production readiness NOT_VERIFIED.

## Current product/delivery reconciliation — 2026-11-05

Read-only Module inspection remains the only implemented F045 checkpoint, in draft
PR #2 to dev at 1f687bd5f6c83252ed32a0dcf9411bbd3cb9ef2b. AI-led creation is the
selected requirement; manual M1 and its exception remain NOT SELECTED. The older
recommended-P0 wording above is historical: F049 P0 is now independently reviewed
offline policy only, delivered on a separate dependent branch; it supplies neither
F045 AI-origin candidates nor actual approval. PR #2's branch/content is unchanged.
See the [current roadmap](../DEVELOPMENT_ROADMAP.md#f044f054-current-product-and-delivery-ledger--2026-11-05) for dependency/delivery boundaries.
F045 remains IN_PROGRESS, partial, with incomplete live verification/acceptance.

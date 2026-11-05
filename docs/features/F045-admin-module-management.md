# F045 — Admin Module Management

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

# F017 — Learning Path Backend

## Status / Authorization

`APPROVED_COMPLETE`. Owner approved completion on 2026-10-10 within the approved backend-only scope after implementation, separately approved isolated integration and final read-only review. Depends on completed F015; preserve F005–F016 behavior and all verification limitations below. Further database execution requires separate approval.

Sources: [roadmap](../DEVELOPMENT_ROADMAP.md), [PRD](../PRD.md), [architecture](../SYSTEM_ARCHITECTURE.md), [database design](../DATABASE_DESIGN.md), [API design](../API_DESIGN.md). Canonical fields/indexes and the representative detail route are retained; the following endpoint details and bounds are owner-approved refinements.

## Approved Scope / Model

Learning Path persistence and public read-only list/detail APIs only. Collection: `learningPaths`, using the API-owned Mongoose instance.

| Field | Constraint |
| --- | --- |
| `_id`, `technologyId` | ObjectId; required Technology parent reference |
| `title` | Required, trimmed, nonblank, 1–120 characters |
| `slug` | Required lowercase ASCII kebab-case, 1–100; reject malformed values |
| `description` | Optional, maximum 2000 characters |
| `targetLevel` | Optional BEGINNER / INTERMEDIATE / ADVANCED; default null |
| `completionScore` | Integer 0–100, default 70; future minimum completion threshold only |
| `status` | DRAFT / PUBLISHED / ARCHIVED; default DRAFT |
| `order` | Nonnegative safe integer, default 0 |
| `createdBy`, `updatedBy` | Required Admin provenance references to User |
| `createdAt`, `updatedAt`, `__v` | Mongoose timestamps and internal version |

Strict schema; autoCreate, autoIndex and bufferCommands disabled. Indexes: unique `{ technologyId: 1, slug: 1 }`, standard `{ technologyId: 1, status: 1, order: 1 }`, normal `_id`. Archived records retain slug uniqueness; no unique title/global slug or TTL index.

## API / Security

- `GET /api/v1/learning-paths?technologyId=<id>&page=1&limit=20`: required parent filter, page default 1, limit default 20/max 100; positive decimal integers and safe offset arithmetic. Fixed order ASC, slug ASC.
- `GET /api/v1/learning-paths/:id`: metadata only. Strict 24-hex ObjectId validation. Reject unknown/repeated/nested query parameters; detail accepts no query parameters.
- Public access requires no authentication. Cookies may be present; neither endpoint uses them for authorization or mutates authentication/session state. Existing CORS, absent-Origin support and credential restrictions remain unchanged.
- Shared feature-local 120/IP/15-minute budget across both endpoints; existing obscured IPv6-aware keys and single-process store. No new environment variables.
- F004 envelopes/request IDs; `Cache-Control: no-store`. List meta: page, limit, total, totalPages (0 when empty). Published parent with no paths or an empty later page returns 200.
- Missing/unpublished parent: generic `404 TECHNOLOGY_NOT_FOUND`. Missing/unpublished detail or unavailable parent: generic `404 LEARNING_PATH_NOT_FOUND`. Existing sanitized 400 VALIDATION_ERROR, 403 ORIGIN_NOT_ALLOWED, 429 RATE_LIMIT_EXCEEDED and 503 DEPENDENCY_UNAVAILABLE conventions.

Explicit DTO only: id, technologyId, title, slug, description, targetLevel, completionScore, order. Absent optional description/targetLevel become null. Exclude status, provenance, timestamps, __v and unexpected fields.

## Integrity / Architecture

Both path and parent must be PUBLISHED. Repository aggregation joins the parent and applies both visibility predicates; counts use the same predicates. Orphans are hidden. Convert validated IDs explicitly for aggregation. No snapshot guarantee across requests or instantaneous withdrawal of in-flight responses during future publication changes.

References do not enforce foreign keys, parent existence or Admin role. Future write workflows must validate those separately; no authoring/provisioning workflow is included. Actual uniqueness requires a created database index. No read-side writes, transactions or audit events. Reuse route → validation/controller → service → repository, safe errors/logging and DTO patterns without changing F015 behavior.

## Approved File Scope

Create:

```text
docs/features/F017-learning-path-backend.md
apps/api/src/modules/learning-paths/learning-path.model.ts
apps/api/src/modules/learning-paths/learning-path.schema.ts
apps/api/src/modules/learning-paths/learning-path.dto.ts
apps/api/src/modules/learning-paths/learning-path.repository.ts
apps/api/src/modules/learning-paths/learning-path.service.ts
apps/api/src/modules/learning-paths/learning-path.controller.ts
apps/api/src/modules/learning-paths/learning-path-rate-limit.ts
apps/api/src/modules/learning-paths/learning-path.routes.ts
apps/api/tests/learning-path-model.test.ts
apps/api/tests/learning-path.test.ts
apps/api/tests/learning-path-routes.test.ts
apps/api/tests/learning-path.integration.ts
```

Modify: `apps/api/src/app.ts` (router and optional injected service/limits), `docs/API_DESIGN.md`, `docs/DATABASE_DESIGN.md`, `docs/DEVELOPMENT_ROADMAP.md`. No dependencies or configuration changes.

## Acceptance / Verification Plan

Offline: model bounds/defaults/index declarations; strict validation; visibility/orphan filtering; safe DTOs; ordering/pagination/empty pages; generic errors; public access with/without cookies; unchanged auth state/CORS; shared rate limiting; no-store/request IDs; sanitized failures; non-mutating reads. Run full API/web regressions, root build/lint/typecheck/formatting and scope/secrets review.

Separately gated integration: existing MongoDB 8.2, non-admin host, free port 27018, owned loopback `f017-test`, empty `deeplearner-f017-test`, only technologies/learningPaths and declared indexes. Synthetic fixtures/reference IDs only, no real Admin or initial content. Explicit child-process write opt-in; only `tests/learning-path.integration.ts`; 90-second suite/120-second external deadline. Verify real compound uniqueness, archived retention, cross-parent reuse, concurrent duplicates, visibility/projections/pagination and unchanged records. Capture exits, disconnect, owned shutdown, port release and temporary cleanup.

Retained offline evidence: focused tests 11/11, complete API regressions 137/137, web regressions 54/54 PASS. Root build/lint/typecheck/formatting and diff/scope/secrets review PASS. Documentation was manually reviewed (root Prettier excludes docs). Initial test import/fixture typing errors were corrected within approved test files before final passing checks. No dependencies or scope deviations.

Owner-approved isolated MongoDB integration: 4/4 PASS (three scenarios plus parent). Actual indexes, parent-scoped uniqueness including archived retention/cross-parent reuse, concurrent duplicate rejection, published parent/path visibility, orphan exclusion, safe DTOs, ordering/pagination and non-mutating reads PASS. Runtime 4.23 seconds; initialization/test/shutdown-helper/MongoDB/wrapper exits 0/0/0/0/0. Mongoose disconnect, graceful shutdown, port release and temporary-directory cleanup PASS; no forced termination or repository changes during the successful run.

Resolved harness-only issue: the initial run stopped before tests because its target assertion read `parsed.replication.replSetName` instead of `replSet`. A separately approved diagnostic confirmed the mismatch; a PowerShell spacing typo (`-eq27018`) also interrupted cleanup reporting. Owner-approved harness corrections used `replSet` and `-eq 27018`; the unchanged integration suite then passed. No application defect was found.

Final read-only review: no actionable P0/P1/P2/P3 findings. Remaining NOT_VERIFIED: HTTP endpoints against live MongoDB; invalid HTTP inputs and dependency failures against live MongoDB; shared rate limiting against live MongoDB; normal Atlas startup. Offline HTTP evidence does not establish those live combinations.

## Deferred / Excluded

No production records, seeds, Admin identities, authoring/publication/deletion APIs, completion calculations, prerequisites, Modules/Topics/Concepts, AI, frontend/admin UI, media or profile/onboarding integration. No actual .env, DNS/TLS changes. F018 remains NOT_STARTED and requires separate owner approval.

# F015 — Technology Catalog Backend

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion on 2026-10-09 within the approved backend-only scope after implementation, isolated integration and final code review. Depends on completed F005. Sources: [roadmap](../DEVELOPMENT_ROADMAP.md), [database design](../DATABASE_DESIGN.md), [API](../API_DESIGN.md), [architecture](../SYSTEM_ARCHITECTURE.md). Preserve F006/F012 profile syntax-only references and F014 onboarding.

## Scope / Approved Decisions

Technology model and public GET /api/v1/technologies only. Required trimmed name (1–80), lowercase ASCII kebab-case slug (1–100), optional description (maximum 2000), nullable iconAssetId, DRAFT/PUBLISHED/ARCHIVED status (default DRAFT), nonnegative integer order (default 0), required createdBy/updatedBy Admin references and timestamps. Internal __v is excluded from DTO. Unique slug and status/order indexes; no name uniqueness or TTL. autoCreate/autoIndex remain disabled.

Published-only list, page=1 and limit=20 by default, limit maximum 100. Fixed order ascending then slug ascending. Reject unknown/repeated/nested query parameters. Safe DTO contains id/name/slug/description/iconAssetId/order only. Standard pagination envelope, no-store, public access without JWT/cookies, existing CORS and 120/IP/15-minute local limiter. No credentialed CORS expansion, filters, search, detail or mutation endpoint.

JavaScript initial definition only: name JavaScript, slug javascript, omitted description, null icon, PUBLISHED, order 0. Not provisioned. Legitimate Admin provenance, target database and real writes require separate approval. No seed runner, invented Admin IDs or automatic creation.

## Affected Files

Create:

```text
docs/features/F015-technology-catalog-backend.md
apps/api/src/modules/technologies/technology.model.ts
apps/api/src/modules/technologies/technology.schema.ts
apps/api/src/modules/technologies/technology.dto.ts
apps/api/src/modules/technologies/technology.repository.ts
apps/api/src/modules/technologies/technology.service.ts
apps/api/src/modules/technologies/technology.controller.ts
apps/api/src/modules/technologies/technology-rate-limit.ts
apps/api/src/modules/technologies/technology.routes.ts
apps/api/src/modules/technologies/technology.initial-data.ts
apps/api/tests/technology-model.test.ts
apps/api/tests/technology.test.ts
apps/api/tests/technology-routes.test.ts
apps/api/tests/technology.integration.ts
```

Modify:

```text
apps/api/src/app.ts
docs/API_DESIGN.md
docs/DEVELOPMENT_ROADMAP.md
```

## Acceptance Criteria

- Canonical strict model and index declarations; no automatic database provisioning.
- Published-only projected DTO, deterministic ordering, bounded valid pagination and empty results.
- F004 error/request-ID envelopes, sanitized dependency errors, existing CORS, no-store and rate limiting.
- JavaScript definition only; no frontend, profile, auth, content, asset or dependency changes.
- Offline model/service/HTTP tests and existing API/web regressions; build/lint/typecheck/formatting and scope/secrets review.
- Separately gated isolated MongoDB tests before claiming enforced uniqueness or live projections.

## Verification / Limitations

Offline verification (2026-10-08): focused F015 tests 10/10 PASS; complete API suite 126/126 PASS (including existing API regressions); web suite 38/38 PASS. Root build, lint, typecheck and formatting PASS. Focused HTTP tests use fake services and loopback ephemeral listeners, not a database. Initial TypeScript literal/response-typing errors were corrected within the approved files; final checks passed. Diff/scope and secrets review PASS: exactly 17 approved files, no dependencies/environment changes, no secrets found, nothing staged. Documentation reviewed separately because root Prettier ignores docs/. No scope deviations. Real JavaScript initial-data provisioning and normal Atlas startup remain NOT_VERIFIED. JavaScript remains definition-only; no seed runner or automatic provisioning exists. List/count reads are not a snapshot transaction; concurrent publication can cause normal pagination drift. Rate limiting is single-process.

## Deferred Scope

F016 UI, admin CRUD/publication, learning paths/content, profile reference validation, onboarding picker, asset handling, AI and production seeding. No new dependencies or environment variables.

## Completed Owner-Approved Isolated Verification

Executed once in non-admin host PowerShell against the owned loopback replica set f015-test and initially empty deeplearner-f015-test, using only the existing MongoDB 8.2 executable. Only technologies and its declared indexes were created; fixtures/reference IDs were synthetic. No real Admin provenance was used, and the real JavaScript initial record was not provisioned. Child-process-only configuration; no Atlas/provider calls, persistent settings changes or production patches. The 90-second suite and 120-second external deadlines were not reached.

Isolated MongoDB integration: 2/2 scenarios PASS; parent also PASS (3/3 reported tests). Actual Technology index creation and database-enforced unique slug PASS; archived-slug uniqueness PASS; concurrent duplicate inserts PASS, with one insert rejected by code 11000. PUBLISHED-only visibility and DRAFT/ARCHIVED exclusion PASS. Deterministic order ASC, slug ASC, pagination and empty later page PASS. Safe projections/DTOs exclude Admin provenance and internal fields PASS; reads do not mutate records PASS.

Child/wrapper/MongoDB exits 0/0/0. Clean Mongoose disconnect, owned MongoDB shutdown, port release and temporary-directory cleanup PASS. Repository files were unchanged by the run. Final read-only code review found no actionable P0, P1, P2 or P3 findings. F015 completion is owner-approved on 2026-10-09; F016 remains NOT_STARTED.

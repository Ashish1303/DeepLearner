# F018 — Module Backend

**Status:** APPROVED_COMPLETE
**Owner approval:** 2026-10-10, within the approved scope.
**Dependency:** F017 APPROVED_COMPLETE
**Authorization:** Owner approved backend implementation, one isolated MongoDB integration run and completion on 2026-10-10. Further database execution requires separate approval.

## Approved scope

Module persistence and public read-only GET /api/v1/modules and
GET /api/v1/modules/:id. No frontend, authoring, Admin CRUD, seeds, Topics/F019,
progress, media, AI, dependencies or environment changes. No Admin provenance
fields. Preserve F005–F017 behavior.

## Model and contracts

Collection modules: required technologyId and learningPathId ObjectId references,
title trimmed/nonblank 1–120, strict lowercase ASCII kebab-case slug 1–100,
optional description max 2000, status DRAFT/PUBLISHED/ARCHIVED default DRAFT,
nonnegative safe integer order default 0, timestamps and internal __v.

Unique learningPathId/slug (including archived records), learningPathId/status/order
index and normal _id. No TTL/global slug/title uniqueness. Strict schema and
disabled automatic collection/index creation and buffering.

List requires learningPathId; page defaults 1, limit 20/max 100. Reject unknown,
repeated/nested query and unsafe offsets. Detail uses ObjectId and rejects query.
All three hierarchy levels must be published; Module technologyId must match its
Learning Path. Filter before the common items/count facet. Order order ASC, slug ASC.
Visible empty parent/later pages return 200. List unavailable hierarchy returns
generic LEARNING_PATH_NOT_FOUND; detail returns MODULE_NOT_FOUND. Database failure
is sanitized DEPENDENCY_UNAVAILABLE; existing validation/envelopes/request IDs apply.

Explicit DTO: id, technologyId, learningPathId, title, slug, description (null when
absent), order. Public endpoints need no authentication; incoming cookies may be
present but are unused. Existing CORS, no credential expansion, no-store and shared
120/IP/15-minute IPv6-aware single-process budget. No auth changes or audit writes.
No read transactions or cross-request snapshot claims. Future writers must validate
parents and derive denormalized Technology; model references are not foreign keys.

## Approved files

Create:

- docs/features/F018-module-backend.md
- apps/api/src/modules/modules/module.model.ts
- apps/api/src/modules/modules/module.schema.ts
- apps/api/src/modules/modules/module.dto.ts
- apps/api/src/modules/modules/module.repository.ts
- apps/api/src/modules/modules/module.service.ts
- apps/api/src/modules/modules/module.controller.ts
- apps/api/src/modules/modules/module-rate-limit.ts
- apps/api/src/modules/modules/module.routes.ts
- apps/api/tests/module-model.test.ts
- apps/api/tests/module.test.ts
- apps/api/tests/module-routes.test.ts
- apps/api/tests/module.integration.ts

Modify:

- apps/api/src/app.ts
- docs/API_DESIGN.md
- docs/DATABASE_DESIGN.md
- docs/DEVELOPMENT_ROADMAP.md

## Acceptance and verification

Offline: fields/defaults/bounds/index declarations, strict validation, visibility
pipeline construction, common count filters, safe DTOs, pagination, HTTP envelopes,
public auth boundaries, CORS, shared limiter and sanitized failures; API/web
regressions and root build/lint/typecheck/formatting plus scope/secrets review.
Offline mocks do not establish database execution or uniqueness.

Verification results:

- Focused F018 offline tests: 12/12 PASS.
- Complete API offline regression suite: 149/149 PASS.
- Web offline regression suite: 54/54 PASS.
- Root build, lint, typecheck and formatting: PASS.
- Diff/scope/secrets review: PASS; exactly the approved 17 files changed.
- Owner-approved isolated MongoDB integration: 4/4 PASS (three scenarios plus parent).
- Actual indexes, parent-scoped/archive uniqueness and concurrent duplicate rejection: PASS.
- Published Technology/Learning Path/Module visibility and hierarchy consistency: PASS.
- Orphan/mismatched-reference exclusion, safe DTOs, ordering and pagination: PASS.
- Public HTTP reads, invalid input, generic 404s, CORS, credential independence and shared rate limiting: PASS.
- Read operations do not mutate records: PASS.
- Integration runtime: 8.31 seconds; wrapper runtime: 14.22 seconds.
- Initialization/test/shutdown-helper/MongoDB/wrapper exits: 0/0/0/0/0.
- Mongoose disconnect, graceful shutdown, port release and temporary cleanup: PASS.
- No forced termination or deadline reached; repository unchanged during integration.
- Synthetic fixtures only; no real content provisioning or external provider calls.
- Final read-only review, including focused P3 re-review: no actionable P0-P3 findings.
- No dependencies/environment changes, staging, commits or pushes.

Initial typecheck identified widened string types in synthetic integration fixture
statuses; explicit enum literal types corrected the test code. Documentation
line endings were preserved during diff review. No scope deviations remain.

## Resolved P3 test finding

The original shared negative-query inputs included an unrelated invalid technologyId,
so rejection alone did not establish the intended validation rule. The test-only
correction removed that field, independently asserted exact issue paths/codes for
ObjectId, page, limit and overflow cases, and separately tested unknown technologyId
and status keys. Detail-query rejection now checks its specific issue. Positive
tests and production behavior remain unchanged. Focused read-only review confirmed
the P3 fully resolved; focused tests passed 12/12 and full API regressions 149/149.

## Retained isolated integration procedure

Non-admin host PowerShell; existing MongoDB 8.2 executable only. Require port 27018
unused; uniquely owned TEMP directory; loopback replica set f018-test; exact URI
mongodb://127.0.0.1:27018/?replicaSet=f018-test and database deeplearner-f018-test.
Require empty database before creating only technologies, learningPaths, modules
and their declared indexes. Synthetic fixtures/provenance references only; no real
Admin or content provisioning. Process-only APP_ENV=LOCAL, F018_TEST_ALLOW_WRITES=APPROVED,
F018_TEST_URI and F018_TEST_DB. Run only node --import tsx --test tests/module.integration.ts
from apps/api. 90-second suite, 120-second wrapper deadline; no retries/patching.
Verify server startup options replication.replSet and loopback binding, primary
readiness and database identity. No Atlas, provider or actual .env access.

Verify indexes, scoped uniqueness/archive/concurrent duplicates, ancestor publication,
orphans and mismatched IDs, safe DTOs, ordering/pagination, HTTP reads/validation/CORS/
rate limiting and non-mutating reads. Disconnect, graceful shutdown then separately
report any forced cleanup; stop only owned process, confirm port released, remove
only verified owned directory. Capture child/wrapper/MongoDB exits and runtime.
The single owner-approved run completed successfully as recorded above. Any further integration execution requires separate approval.

## Limitations

- Live database dependency-failure injection: NOT_VERIFIED. Sanitization has offline coverage.
- Normal Atlas startup: NOT_VERIFIED.

No real Module data was provisioned. No frontend or browser verification applies.
F018 is APPROVED_COMPLETE following owner approval dated 2026-10-10 within its approved scope. The verification limitations above remain unchanged.

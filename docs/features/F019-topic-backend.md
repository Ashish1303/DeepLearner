# F019 - Topic Backend

**Status:** APPROVED_COMPLETE
**Owner approval:** 2026-10-10, within the approved scope.
**Dependency:** F018 APPROVED_COMPLETE
**Authorization:** Owner approved this implementation plan and its 17-file scope. Implementation, offline checks and the separately authorized isolated MongoDB run are complete. Owner approved completion on 2026-10-10 within the approved scope. Further database execution requires separate approval.

## Sources and scope

Sources: [roadmap](../DEVELOPMENT_ROADMAP.md), [PRD](../PRD.md),
[architecture](../SYSTEM_ARCHITECTURE.md), [database design](../DATABASE_DESIGN.md),
[API design](../API_DESIGN.md), and approved F015-F018 feature records.

Backend-only Topic persistence plus public read-only list/detail APIs. Reuse the
API-owned Mongoose instance and Express/Zod/F004 conventions. Preserve F005-F018,
including authentication, profile, onboarding and existing catalog behavior.

Canonical Topic fields, hierarchy and indexes come from Database Design. Bounds,
defaults and endpoint details below are owner-approved refinements. The PRD's
Topic completion thresholds are deferred: no completionScore or completion logic
is added. ObjectId detail lookup follows F017/F018; frontend slug routing is deferred.
Historical next-feature statements in older feature records do not override the
current roadmap. No unrelated documentation cleanup is included.

## Model

Collection: topics.

| Field                 | Approved constraint                                           |
| --------------------- | ------------------------------------------------------------- |
| _id                   | MongoDB ObjectId                                              |
| technologyId          | Required ObjectId reference to Technology                     |
| learningPathId        | Required ObjectId reference to LearningPath                   |
| moduleId              | Required ObjectId reference to Module                         |
| title                 | Required, trimmed, nonblank, 1-120 characters                 |
| slug                  | Required, strict lowercase ASCII kebab-case, 1-100 characters |
| description           | Optional, maximum 2000 characters                             |
| status                | DRAFT / PUBLISHED / ARCHIVED; default DRAFT                   |
| order                 | Nonnegative safe integer; required, default 0                 |
| createdAt / updatedAt | Mongoose timestamps                                           |
| __v                   | Internal version; excluded from DTO                           |

Strict schema; automatic collection creation, automatic index creation and command
buffering disabled. No Admin provenance or additional content/progress/media fields.

Indexes:

- Unique { moduleId: 1, slug: 1 }.
- Standard { moduleId: 1, status: 1, order: 1 }.
- Normal _id index.

Archived records retain their slug reservation. Cross-module slug reuse is allowed.
No global slug/title uniqueness or TTL. Actual enforcement requires a database
index; model declarations alone are not proof. Concurrent duplicate inserts must
be rejected by the unique index in separately approved integration testing.

## Hierarchy and visibility

Technology -> Learning Path -> Module -> Topic.

Both list and detail require all four records to exist and be PUBLISHED, and:

1. Topic.moduleId equals the joined Module._id.
2. Topic.learningPathId equals Module.learningPathId.
3. Topic.technologyId equals Module.technologyId.
4. Module.learningPathId equals the joined LearningPath._id.
5. Module.technologyId equals LearningPath.technologyId.
6. The shared technologyId equals the joined Technology._id.

Exclude orphaned and inconsistent records even when all referenced records are
otherwise published. List begins with the requested Module and validates its
ancestors before reading Topics. Apply identical hierarchy/visibility predicates
to list items and total counts, before the common items/count facet. Detail uses
equivalent checks. Convert validated IDs explicitly for aggregation.

References are not database foreign keys. Future authoring must validate the Module
and derive ancestor IDs; F019 supplies no write/repair/publication workflow.
No read transactions, audit writes, cross-request snapshot guarantee or promise
of instantaneous withdrawal of responses already in flight.

## API contracts

- GET /api/v1/topics?moduleId=<id>&page=1&limit=20
- GET /api/v1/topics/:id

List: required exact 24-hex moduleId; positive decimal integer page default 1;
limit default 20, maximum 100; safe pagination offset arithmetic. Reject unknown,
repeated and nested query parameters, including technologyId/learningPathId/status.
No search, custom sorting or other filters. Fixed order ASC, slug ASC.
A visible parent with no Topics, or an empty later page, returns 200 with an empty
data array and accurate page/limit/total/totalPages metadata (totalPages 0 when empty).

Detail: exact 24-hex ObjectId; no query parameters. Metadata only.

Explicit safe DTO:

- id
- technologyId
- learningPathId
- moduleId
- title
- slug
- description (null when absent)
- order

Exclude status, timestamps, __v, internal joins and nested learning content.
Use F004 success/error envelopes and request IDs.

| Condition                                             | Error                                |
| ----------------------------------------------------- | ------------------------------------ |
| Invalid request                                       | 400 VALIDATION_ERROR                 |
| List Module or its hierarchy unavailable/inconsistent | 404 MODULE_NOT_FOUND                 |
| Detail missing, hidden, orphaned or inconsistent      | 404 TOPIC_NOT_FOUND                  |
| Disallowed Origin                                     | 403 ORIGIN_NOT_ALLOWED               |
| Rate budget exhausted                                 | 429 RATE_LIMIT_EXCEEDED              |
| Database dependency failure                           | Sanitized 503 DEPENDENCY_UNAVAILABLE |

Generic 404s must not disclose which ancestor is missing/unpublished.
Raw driver errors, stacks and sensitive values must not appear in responses/logs.

## Architecture and HTTP security

Route -> validation/rate limiter -> controller -> service -> repository -> MongoDB.

Public access requires no JWT/cookie. Incoming credentials may exist but are
unused; no authentication/session state changes or cookie mutations. Existing CORS
and absent-Origin behavior remain unchanged; no credentialed-CORS expansion.
Cache-Control: no-store.

Both endpoints share a feature-local 120/IP/15-minute budget using existing
obscured IPv6-aware keys and single-process storage. No dependencies or environment
variables. app.ts changes only mount the router and add optional service/limit
injection for tests. No refactoring or semantic changes to completed modules.

## Exact approved file scope

Create:

- docs/features/F019-topic-backend.md
- apps/api/src/modules/topics/topic.model.ts
- apps/api/src/modules/topics/topic.schema.ts
- apps/api/src/modules/topics/topic.dto.ts
- apps/api/src/modules/topics/topic.repository.ts
- apps/api/src/modules/topics/topic.service.ts
- apps/api/src/modules/topics/topic.controller.ts
- apps/api/src/modules/topics/topic-rate-limit.ts
- apps/api/src/modules/topics/topic.routes.ts
- apps/api/tests/topic-model.test.ts
- apps/api/tests/topic.test.ts
- apps/api/tests/topic-routes.test.ts
- apps/api/tests/topic.integration.ts

Modify:

- apps/api/src/app.ts
- docs/API_DESIGN.md
- docs/DATABASE_DESIGN.md
- docs/DEVELOPMENT_ROADMAP.md

Current authorization permits implementation and offline verification within this file list.
Any scope/file/dependency expansion requires separate owner approval.

## Acceptance criteria

- Approved strict model, bounds/defaults and declared indexes; no automatic provisioning.
- Four-level publication and all denormalized-reference consistency checks for both APIs.
- Identical list/count predicates; deterministic pagination and truthful empty pages.
- Safe explicit DTOs and generic 404s; sanitized dependency errors.
- Strict query/ID validation with negative tests independently asserting exact issue
  paths/codes and unknown-key names; no unrelated invalid field masking a test.
- Public credential independence, preserved CORS/authentication, no-store and shared limiter.
- No read mutations, transactions, audit side effects or completed-feature regressions.
- Authorized offline checks pass; database claims require separately approved integration.
- Evidence and remaining limitations recorded accurately; completion remains owner-controlled.

## Offline verification gate

After implementation authorization:

1. Model tests: valid/invalid bounds, defaults, statuses, strict fields, references,
   index declarations and disabled provisioning.
2. Validation tests: missing/malformed/trailing-newline IDs, page/limit boundaries,
   repeated/nested/unknown parameters, overflow, positive cases and exact issue assertions.
3. Repository/service tests: every ancestor/mismatch predicate, common count filters,
   projections, pagination, empty pages, generic errors and sanitized failures.
4. HTTP tests with injected services: envelopes/request IDs, list/detail, CORS,
   credentials ignored, no cookie changes, no-store, shared limiter and unsupported writes.
5. Full API/web regressions; root build/lint/typecheck/formatting; diff/scope/secrets review.

Offline mocks do not prove real aggregation behavior or database-enforced uniqueness.
No F019 tests were executed during planning. Authorized offline implementation evidence follows.

## Separately approved MongoDB integration gate

Do not execute without explicit owner approval of the isolated procedure:

- Non-admin host PowerShell; confirm port 27018 unused or stop.
- Existing C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe only.
- Uniquely owned temporary directory, loopback-only 127.0.0.1:27018, replica set f019-test.
- Verify process ownership, binding, replication.replSet, primary readiness and exact target.
- Require empty deeplearner-f019-test before application fixture writes.
- Create only technologies, learningPaths, modules, topics and their declared indexes.
- Synthetic fixtures/reference IDs only; no real Admin, content provisioning or external calls.
- Run only node --import tsx --test tests/topic.integration.ts from apps/api.
- Child-process-only APP_ENV=LOCAL, F019_TEST_ALLOW_WRITES=APPROVED,
  F019_TEST_URI=mongodb://127.0.0.1:27018/?replicaSet=f019-test,
  F019_TEST_DB=deeplearner-f019-test.
- 90-second suite / 120-second wrapper deadline; no automatic retry or patch.
- Disconnect; attempt graceful shutdown; separately report forced cleanup if needed.
  Stop only owned processes, confirm port release and remove only verified owned artifacts.
- Record runtime, initialization/test/shutdown-helper/MongoDB/wrapper exits and repository status.

Verify actual indexes, scoped/archive uniqueness, cross-parent reuse and concurrent
duplicate rejection; publication at each level; absent/mismatched ancestors including
all-published inconsistent chains; identical counts and visible items; safe DTOs;
ordering/pagination/empty pages; non-mutating reads; public HTTP validation, generic
404s, CORS, credential independence and shared rate limiting.

Live dependency-failure injection remains NOT_VERIFIED unless explicitly exercised.
Normal Atlas startup remains NOT_VERIFIED under F005. No Atlas/configuration repair
is part of F019; offline and disposable-local testing remain independent of it.

## Sequence, risks and deferred work

Implementation authorization -> model/contracts -> hierarchy repository/service ->
controller/router/app mount -> offline tests and checks -> integration proposal ->
separate integration approval -> verification/review -> owner-controlled status gates.

Risks: denormalized IDs can be inconsistent (exclude, do not repair); four-level joins
were verified in the isolated integration run; rate limiting remains single-process; no
cross-request snapshot guarantee. No production Topic records are invented.

Deferred: Topic completion thresholds/calculation, progress, Concepts/F021, content,
student UI/F020, Admin management/F046, authoring/publication/deletion, seeds, AI,
media, search and unrelated features.

No design blocker remains within the approved scope. F019 is APPROVED_COMPLETE following owner approval dated 2026-10-10. Further database verification remains separately gated.

## Implementation and final verification evidence - 2026-10-10

F019 is APPROVED_COMPLETE following owner approval dated 2026-10-10. The approved model, public list/detail routes, explicit DTOs,
four-level hierarchy checks, shared list/count visibility, strict validation and
shared rate limiter are implemented. app.ts only adds the router and optional
test injection parameters. API/Database Design now record the approved contracts.

- Focused F019 offline: 15/15 PASS.
- Complete API regressions: 164/164 PASS.
- Web regressions: 54/54 PASS.
- Root build, lint, typecheck and format:check: PASS.
- Diff/scope/secrets review: PASS; exactly the approved 17 files; no dependencies,
  environment changes, completed-model changes, secrets or unrelated work.
- Initial fixture typing and negative-test expectation issues were corrected
  within the approved test files before the final passing runs.
- Isolated MongoDB integration: 4/4 PASS (three scenarios plus parent test).
- Declared indexes, database-enforced parent-scoped uniqueness, archived slug
  retention, cross-parent reuse and concurrent duplicate rejection: PASS.
- Published four-level hierarchy visibility, reference consistency, orphan and
  mismatch exclusion, identical list/count filtering: PASS.
- Safe DTO projections, deterministic ordering, pagination and non-mutating reads: PASS.
- Public list/detail HTTP, validation, generic 404s, CORS, shared rate limiting and
  credential independence/authentication boundaries: PASS where covered.
- Integration suite runtime: 2.25 seconds; wrapper runtime: 6.09 seconds.
- Initialization/test/shutdown-helper/MongoDB/wrapper exits: 0/0/0/0/0.
- Mongoose disconnect, graceful shutdown, port release and temporary-directory
  cleanup: PASS. No forced termination; repository unchanged by integration.
- Final read-only review and focused P3 re-review: no actionable P0-P3 findings.

### Resolved P3 test correction

The detail-ID test appended literal `'\\n'` instead of newline escape
`'\n'`. The test-only correction now independently exercises an actual trailing
newline and preserves the exact `['params', 'id']` / `invalid_format` assertion.
Focused verification and read-only re-review: PASS. No production behavior changed.

### Remaining limitations and safeguards

- Live database dependency-failure injection: NOT_VERIFIED.
- Normal Atlas startup: NOT_VERIFIED.

The integration run used only the separately approved disposable localhost target
and synthetic fixtures. No real content provisioning, Atlas/external-provider
calls or persistent configuration changes occurred. No scope deviations.
No staging, commits or pushes. F020 remains NOT_STARTED and requires separate owner
authorization. F019 is APPROVED_COMPLETE within its approved scope.

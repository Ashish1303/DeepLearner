# F021 - Concept Read Model + API

**Status:** APPROVED_COMPLETE
**Dependency:** F019 APPROVED_COMPLETE; reuse F015-F019 catalog conventions.
**Authorization:** Owner approved implementation and offline verification within the 17-file scope.
One isolated MongoDB integration run was separately authorized and completed.
Further database execution requires separate approval.
F020 remains APPROVED_COMPLETE; its production-release verification blockers are separate.

## Sources and scope

Sources: [roadmap](../DEVELOPMENT_ROADMAP.md), [PRD](../PRD.md),
[System Architecture](../SYSTEM_ARCHITECTURE.md), [API Design](../API_DESIGN.md),
[Database Design](../DATABASE_DESIGN.md) and [F019](F019-topic-backend.md).

Backend-only Concept persistence and public read-only list/detail APIs. A Concept
belongs to a Topic under Module, Learning Path and Technology. Provide bounded
Read content and canonical source metadata without introducing a renderer,
authoring workflow, publication operation or student progress state.

Canonical requirements include the hierarchy, topic-scoped slug identity,
difficulty/lifecycle enums, Markdown format, schema version and Admin provenance.
The endpoint details, numeric/text bounds, DTO split, single-value sourceType
constraint and HTTPS policy below are owner-approved F021 refinements, not claims
that the earlier design documents already defined those exact contracts.

## Model contract

Collection: concepts. Reuse the API-owned Mongoose instance. Strict schemas,
including nested Read/source objects; no subdocument IDs. Disable automatic
collection/index creation and command buffering. Mongoose timestamps and internal
__v remain enabled. No real records, seed runner or automatic provisioning.

| Field | Contract |
| --- | --- |
| _id | MongoDB ObjectId |
| technologyId | Required ObjectId reference to Technology |
| learningPathId | Required ObjectId reference to LearningPath |
| moduleId | Required ObjectId reference to Module |
| topicId | Required ObjectId reference to Topic |
| title | Required, trimmed, nonblank, 1-120 characters |
| slug | Required, strict lowercase ASCII kebab-case, 1-100 characters |
| difficulty | Required BEGINNER / INTERMEDIATE / ADVANCED / INTERVIEW_READY; no invented default |
| contentFormat | Required MARKDOWN; default MARKDOWN |
| read.summary | Required, trimmed, nonblank, 1-2000 characters |
| read.bodyMarkdown | Required, nonblank, 1-50000 characters; preserve meaningful Markdown whitespace |
| source.label | Required, trimmed, nonblank, 1-120 characters |
| source.url | Required absolute HTTPS URL, 1-2048 characters, no embedded username/password |
| source.sourceType | Required OFFICIAL_OR_TRUSTED only |
| source.isOfficial | Required Boolean; no inferred value or default |
| status | Required canonical content lifecycle; default DRAFT |
| order | Required nonnegative safe integer; default 0 |
| schemaVersion | Required integer 1 for this contract; default 1 |
| createdBy / updatedBy | Required ObjectId references to User representing Admin provenance |
| createdAt / updatedAt | Mongoose timestamps |
| __v | Internal version; never public |

Canonical status values: DRAFT, AI_GENERATED, IN_REVIEW, CHANGES_REQUIRED, APPROVED,
PUBLISHED, ARCHIVED. Declaring states does not implement transitions or approval.
Only PUBLISHED is publicly visible. Read summary/body support the PRD's definition,
why it matters, how it works, important points and common mistakes without imposing
additional unapproved structured section fields.

ObjectId references are not database foreign keys. Provenance references do not
create or promote Admin accounts, and schema validation alone cannot prove role
ownership. A future authorized authoring workflow must verify Admin provenance,
validate parent existence and derive ancestor references. F021 contains no writer.
Source is one required object, satisfying the minimum one-source data contract;
source presentation, editorial trust verification and administration are deferred.

## Indexes and integrity

Declare only:

- Unique { topicId: 1, slug: 1 }.
- Listing { topicId: 1, status: 1, order: 1, slug: 1 }.
- Normal _id index.

Archived Concepts retain slug reservations. Cross-Topic slug reuse is allowed.
No global slug/title uniqueness or TTL. Actual unique-index enforcement and
concurrent duplicate rejection require separately approved MongoDB verification;
model declarations are not database proof. Do not build indexes at normal startup.

Technology -> Learning Path -> Module -> Topic -> Concept must all exist and be
PUBLISHED. For each Concept:

1. concept.topicId matches Topic._id.
2. concept.moduleId, learningPathId and technologyId match the Topic references.
3. Topic.moduleId matches Module._id; Topic.learningPathId and technologyId match Module.
4. Module.learningPathId matches LearningPath._id; Module.technologyId matches LearningPath.
5. The common technologyId matches Technology._id.

Exclude orphaned and inconsistent chains, even if individual records are published.
Validate the requested Topic and its complete ancestry before list retrieval.
Apply identical visibility/reference predicates before the list/count facet.
Detail lookup enforces equivalent five-level rules. Use explicit ObjectId conversion
in aggregation and narrow projections. No read transaction, audit write, mutation,
repair, cross-request snapshot guarantee or recall of already delivered responses.

## Public API contract

- GET /api/v1/concepts?topicId=ID&page=1&limit=20
- GET /api/v1/concepts/:id

List requires an exact 24-hex topicId. Page defaults to 1; limit defaults to 20,
maximum 100. Follow F019 positive decimal integer parsing and safe offset arithmetic.
Reject unknown, repeated and nested query parameters, including ancestor IDs,
status, difficulty, search and custom sorting. Detail accepts an exact ObjectId
and no query parameters. Reject trailing-newline IDs and integer overflow.

Fixed ordering: order ASC, slug ASC. A visible Topic with no Concepts returns 200
and an empty array. Empty later pages also return 200, with accurate
page/limit/total/totalPages; totalPages is 0 when total is 0. Never include full Read
bodies in list results. Use F004 success/error envelopes and request IDs.

Explicit summary DTO:

- id, technologyId, learningPathId, moduleId, topicId
- title, slug, difficulty, summary (from read.summary), order

Explicit detail DTO:

- id, technologyId, learningPathId, moduleId, topicId
- title, slug, difficulty, order, contentFormat, schemaVersion
- read: { summary, bodyMarkdown }
- source: { label, url, sourceType, isOfficial }

Detail does not duplicate summary at the top level. Neither DTO exposes status,
Admin provenance, timestamps, __v, internal joins or deferred fields. Construct
nested DTOs explicitly rather than spreading database objects.

| Condition | Response |
| --- | --- |
| Invalid input | 400 VALIDATION_ERROR with existing safe validation issues |
| List Topic/ancestry missing, hidden or inconsistent | 404 TOPIC_NOT_FOUND |
| Detail Concept/ancestry missing, hidden or inconsistent | 404 CONCEPT_NOT_FOUND |
| Disallowed Origin | Existing 403 ORIGIN_NOT_ALLOWED |
| Shared feature rate budget exhausted | 429 RATE_LIMIT_EXCEEDED |
| Database dependency failure | Sanitized 503 DEPENDENCY_UNAVAILABLE |

404 responses are generic: never disclose which ancestor is missing or unpublished.
Do not expose raw exceptions, driver messages, stacks or content in error logs.

## Security and architecture

Reuse Route -> validation/rate limiter -> controller -> service -> repository.
Follow existing injection seams for offline tests without refactoring completed
features. Mount only the Concept router in app.ts.

Public endpoints require no JWT/cookie. Incoming credentials may exist but are
unused: no authentication/session mutation or cookie writes. Preserve existing
CORS, absent-Origin behavior and LOCAL safeguards; no credentialed-CORS expansion.
Set Cache-Control: no-store. Share one feature-local 120/IP/15-minute limiter
between list/detail using existing obscured IPv6-aware keys and single-process
storage. No new dependency, environment variable or persistent configuration.

### Markdown and source responsibilities

Store and return Read bodies as untrusted Markdown data, not trusted HTML.
F021 neither renders HTML nor claims sanitization. Length/type validation and
HTTPS validation are not a sanitizer or proof of source trust. Do not fetch,
preview or otherwise contact source URLs; this API introduces no outbound URL fetch.

F022 must implement safe rendering before displaying content: disable raw HTML or
apply an explicitly approved robust sanitizer; restrict rendered link/image URL
schemes, avoid automatic external resource loads, escape code, and never pass
untrusted content directly to an HTML injection sink. Source links need safe URL
handling and appropriate external-link protections. These requirements need their
own implementation/tests; a successful F021 API test does not prove XSS-safe UI.

## Approved deviations and deferred functionality

- Defer the entire completionRules field, metadata and calculations, despite its
  required designation in Database Design. Do not invent requiredSections or a
  minimum-score default. Reconcile the canonical schema in future approved work;
  implementation documentation updates must identify this scoped deviation.
- Defer examples, revise, previousPublishedSnapshot, publishedAt/publishedBy and
  all authoring/approval/publishing operations. Lifecycle enum support is data only.
- Replace the earlier listing index with the approved order/slug-aligned index.
  Defer unused technology/status/difficulty and updatedAt Admin-queue indexes.
- OFFICIAL_OR_TRUSTED is the only approved sourceType for F021; earlier documents
  illustrated it but did not define an exhaustive enum or these exact bounds.
- The earlier database recommendation for sanitized Markdown is explicitly refined
  for F021 to untrusted data storage; mandatory safe rendering is assigned to F022.
- Defer F022 UI, F023 Example, F024 Revise, F025 source presentation/workflows,
  Visualize, Practice, completion/progress, AI, media, Admin CRUD and real content.

F020 remains unchanged, including its accepted NOT_VERIFIED browser gaps,
disposable web shutdown failure and mandatory pre-production automated acceptance.
F021 work must not silently clear those separate production-release blockers.

## Exact implementation scope: 17 files

Create (13):

- docs/features/F021-concept-read-model-api.md
- apps/api/src/modules/concepts/concept.model.ts
- apps/api/src/modules/concepts/concept.schema.ts
- apps/api/src/modules/concepts/concept.dto.ts
- apps/api/src/modules/concepts/concept.repository.ts
- apps/api/src/modules/concepts/concept.service.ts
- apps/api/src/modules/concepts/concept.controller.ts
- apps/api/src/modules/concepts/concept-rate-limit.ts
- apps/api/src/modules/concepts/concept.routes.ts
- apps/api/tests/concept-model.test.ts
- apps/api/tests/concept.test.ts
- apps/api/tests/concept-routes.test.ts
- apps/api/tests/concept.integration.ts

Modify (4):

- apps/api/src/app.ts
- docs/API_DESIGN.md
- docs/DATABASE_DESIGN.md
- docs/DEVELOPMENT_ROADMAP.md

Implementation and offline verification are authorized within these 17 files.
Any expansion requires owner approval.

## Acceptance criteria and testing

- Strict fields/defaults/enums/bounds, required source/provenance and schema version;
  documented Markdown trust boundary and deferred completionRules.
- Declared approved indexes; scoped/archive uniqueness and cross-parent reuse.
- Full published five-level visibility, every reference-consistency check, orphan
  exclusion and identical list/count filters.
- Summary/detail separation, explicit safe nested DTOs and hidden-field exclusion.
- Stable ordering, empty-page semantics, strict IDs/query validation and generic 404s.
- No credential dependency, auth side effect, outbound source fetch, read mutation,
  automatic collection/index creation, provisioning or excluded functionality.
- Existing errors, CORS, rate limiting, no-store and sanitized dependency failures.
- Preserve F005-F020 behavior and all existing release limitations.

Offline tests: model validation/defaults/index declarations without connections;
independent exact issue-path/code assertions for each invalid HTTP input; service,
DTO and repository aggregation coverage with mocks; publication/reference negative
cases at every level; list/count/order/pagination; source URL and nested-field
bounds; credential independence, unchanged cookies/auth state, CORS, no-store,
shared limiter and safe dependency errors. Do not interpret these as live DB proof.
Run focused tests, full API/web regressions, root build/lint/typecheck/formatting
and diff/scope/secrets review after implementation authorization.

Separately approved integration only: existing MongoDB 8.2 on unused loopback port
27018, owned temporary directory, replica set f021-test, empty database
deeplearner-f021-test. Verify process ownership,
loopback binding, replica identity and PRIMARY readiness before emptiness checks
and any writes. Child-only APP_ENV=LOCAL, F021_TEST_ALLOW_WRITES=APPROVED,
F021_TEST_URI=mongodb://127.0.0.1:27018/?replicaSet=f021-test and
F021_TEST_DB=deeplearner-f021-test. No Atlas or existing databases.

Create only technologies, learningPaths, modules, topics and concepts with declared
indexes; use synthetic hierarchy/content and Admin-reference IDs, never real Admin
accounts. Execute only tests/concept.integration.ts, bounded to 90 seconds with a
120-second external deadline. Verify real indexes, scoped/archive/concurrent
uniqueness, cross-parent reuse, full hierarchy exclusion, projections, ordering,
identical totals, non-mutating reads and HTTP behavior where covered. Disconnect,
attempt graceful owned MongoDB shutdown, report forced fallback separately, verify
port release and remove only approved owned temporary artifacts. Stop on failure;
no automatic patch/retry. Report actual runtime, exits and limitations.

Reuse established test/cleanup patterns; no new framework or temporary supervisor
system. No Concept browser UI exists in F021, so browser acceptance belongs to
F022 using the approved Chrome/Playwright foundation under separate authorization.
Do not rerun the foundation smoke test or F020 acceptance as part of planning.

## Implementation and final verification record

Implemented the approved strict Concept schema/index declarations, source metadata,
untrusted Markdown storage, five-level published and consistent hierarchy reads,
summary/detail projections, public routes, pagination and shared rate limiter.
Existing API injection seams are extended without changing prior route contracts.
Four planned test files are present. No dependencies or scope deviations were added.

- Focused offline F021: 17/17 PASS.
- Full API offline regressions: 181/181 PASS on the final run.
- Web offline regressions: 75/75 PASS (current checked-out suite).
- Root build, lint, typecheck and formatting: PASS.
- Diff/scope/secrets review: PASS; exactly the 17 approved files.
- Isolated MongoDB integration: 4/4 PASS (three scenarios plus parent).
- Actual indexes, scoped/archive uniqueness, cross-parent reuse and concurrent
  duplicate rejection: PASS.
- Five-level published hierarchy, orphan/inconsistent-reference exclusion,
  identical list/count filters, ordering, pagination and safe DTOs: PASS.
- Database-backed list/detail HTTP, validation, generic 404s, CORS, shared rate
  limiting, credential independence and non-mutating public reads: PASS.
- Cleanup: PASS; Mongoose disconnect, graceful MongoDB shutdown, port release
  and owned temporary-directory removal confirmed. No forced termination.
- Verification wrapper runtime: 20.18 seconds.
- Initialization/test/shutdown/MongoDB/wrapper exits: 0/0/0/0/0.
- All 17 approved files remained unchanged during integration verification.
- Live database dependency-failure injection and normal Atlas startup: NOT_VERIFIED.

Offline HTTP tests use injected services and temporary loopback listeners only;
no MongoDB connection or database write occurred during offline verification.
The separately approved integration used only the verified disposable localhost
f021-test replica set and empty deeplearner-f021-test database with synthetic
fixtures. No regular development database, Atlas or browser testing was involved.
Model declarations/mocked aggregate checks do not establish real database behavior.
The first full API run reported a failed existing module-routes.test.ts worker.
That worker passed 2/2 in isolation, and the complete API rerun passed 181/181
without source changes. The initial worker-failure cause is unconfirmed; it is not
claimed as a corrected application defect.

Existing Mongoose validateSync deprecation warnings remain nonblocking; no dependency
or completed-feature changes were made to suppress them.

## Final review and owner gate

Final read-only review found no actionable application defect, security issue,
API-contract mismatch or unauthorized change. The P3 stale integration-evidence
finding is resolved by this documentation update; retained offline results and
both genuine NOT_VERIFIED limitations remain unchanged.

The owner approved F021 as APPROVED_COMPLETE for development closure. No further tests or database execution are authorized by this
status transition. F020 and its release blockers remain unchanged; F022 remains
NOT_STARTED.

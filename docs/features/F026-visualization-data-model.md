# F026 - Visualization Data Model

**Status:** APPROVED_COMPLETE
**Dependency:** F021 APPROVED_COMPLETE.
**Authorization:** Owner approved implementation and focused offline verification
within seven files. The owner clarified that an absent animationConfig stays
absent; when present, autoplay is required and must be explicitly false.
ObjectId inputs may be genuine ObjectIds or valid 24-hex strings only.
F001-F025 remain APPROVED_COMPLETE. Separately approved MongoDB and browser
verification passed; final review and the conditional READY_FOR_REVIEW transition
are complete. Owner approved development closure and scoped Git delivery on
2026-10-15; F027 remains excluded.

## Sources and approved architecture

- [Roadmap](../DEVELOPMENT_ROADMAP.md): F026 is the data model; F027 owns the
  renderer, F028 controls, and F029 the first real visual lesson.
- [PRD](../PRD.md), sections 16-19, 74 and 96: structured visual learning,
  accessible text, reduced-motion alternatives and later rendering/editorial work.
- [System Architecture](../SYSTEM_ARCHITECTURE.md), section 14 and ADR-008:
  validated data interpreted by trusted application components, never arbitrary
  generated React/JavaScript execution.
- [Database Design](../DATABASE_DESIGN.md): separate visualizations collection,
  Concept ownership, denormalized references, audit/version fields and two indexes.
- [API Design](../API_DESIGN.md): visualization endpoints remain unspecified and
  deferred; existing Concept APIs and response contracts are unchanged.
- Approved F021-F025 feature documents and existing Concept model/tests supply
  strict validation, lifecycle, provenance, isolation and regression patterns.

Owner-approved decisions:

1. Use the canonical separate `visualizations` collection; do not embed this data
   in Concepts or add a Concept visualization field.
2. Only `ANIMATED_FLOW` is supported in v1. Other canonical visualization types
   remain deferred, not silently mapped to this type.
3. `animationConfig` is the stored field. The PRD example's `execution-flow` and
   `animations` are illustrative, not aliases or additional persisted contracts.
4. Require structured nodes, edges, steps and accessible text alternatives.
5. Use schemaVersion 1, existing content lifecycle conventions and both documented
   indexes. Preserve disabled automatic collection/index creation.
6. Reject unknown fields, coercion, executable payloads and unsafe structures.
7. Mongoose references do not independently prove parent existence, consistent
   ancestry, publication eligibility or Admin identity.

## Approved v1 schema contract

The owner approved the nested shapes, limits and cross-field rules below, with
the explicit ObjectId and autoplay clarifications above. These feature-specific
constraints refine previously underspecified canonical requirements. No open-ended
Mixed, arbitrary metadata or renderer properties are accepted.
All lengths below use JavaScript UTF-16 string length unless explicitly bytes.

### Root document

| Field | Mongoose/storage type | Required/default | Approved rules |
| --- | --- | --- | --- |
| _id | ObjectId | Generated | Standard document identity |
| conceptId | ObjectId, ref Concept | Required | ObjectId or exact 24-hex string; reject other coercion |
| technologyId | ObjectId, ref Technology | Required | Same strict identity rule |
| topicId | ObjectId, ref Topic | Required | Same strict identity rule |
| type | String | Required, no default | Exactly ANIMATED_FLOW |
| title | String | Required | Trimmed plain text, 1-120 |
| textAlternative | String | Required | Trimmed plain text, 1-4,000; explains the overall flow without motion |
| nodes | Array of node subdocuments | Required, no default | 1-50 nodes, stable array order |
| edges | Array of edge subdocuments | Required, no default | 0-100 edges; an explicit empty array permits a single-node explanation |
| steps | Array of step subdocuments | Required, no default | 1-100 ordered authored states |
| animationConfig | Strict subdocument | Optional, no default | When present, both fields below are required; null/empty object invalid |
| status | String | Required, default DRAFT | Existing seven-value Concept lifecycle enum |
| schemaVersion | Number | Required, default 1 | Actual integer 1 only; strings/null/other versions invalid |
| createdBy | ObjectId, ref User | Required | ObjectId or exact 24-hex string; claimed provenance, not proof of role |
| updatedBy | ObjectId, ref User | Required | Same rule |
| createdAt / updatedAt | Date | Mongoose timestamps | Generated/maintained by persistence; no authoring interface |
| __v | Number | Mongoose version key | Internal persistence field, not an authored schema version |

No root slug, ordering field, source field, assetIds, arbitrary code, URL, layout
coordinates or renderer name is added. Multiple visualizations per Concept are
permitted. Existing Concept source metadata remains untouched.

### Node, edge and step subdocuments

| Structure | Complete approved fields |
| --- | --- |
| Node | id: required String; label: required trimmed plain text 1-120; description: optional trimmed plain text 1-1,000 |
| Edge | id: required String; source: required node ID String; target: required node ID String; label: required trimmed plain text 1-120 |
| Step | title: required trimmed plain text 1-120; explanation: required trimmed plain text 1-2,000; nodeIds: required Array of 1-50 node ID Strings; edgeIds: required Array of 0-100 edge ID Strings |

Node/edge IDs and references must fully match `[a-z][a-z0-9-]{0,63}`: 1-64 ASCII
characters, beginning with a lowercase letter. Do not trim, normalize or generate
these IDs. Node IDs are unique within nodes; edge IDs are unique within edges.
Their namespaces are separate, so a node and edge may share an ID without ambiguity.
Neither is a MongoDB ObjectId. Subdocuments have `_id: false`; steps have no IDs
because their array positions define authored sequence.

Every edge source/target must resolve to a node in the same document. Every step
nodeIds/edgeIds entry must resolve to the corresponding local array. Reject
duplicates within either step reference array. Reject missing arrays, nulls,
sparse entries and wrong element types; do not cast a scalar into an array.
Preserve author order instead of sorting or repairing inputs.

Cycles and self-loops are permitted for execution-flow use cases. Distinct edges
may share endpoints. Do not impose DAG, reachability, endpoint-pair uniqueness or
"every node must appear in a step" restrictions absent a product requirement.
Highlighting an edge does not require both endpoints in that step's nodeIds;
edge endpoints still must exist in the document. Steps describe authored states,
not instructions to execute or a guarantee of programming-language correctness.

### Animation configuration and accessibility

Approved optional animationConfig shape:

- `stepDurationMs`: required actual finite safe integer, 100-10,000 inclusive.
- `autoplay`: required actual Boolean, restricted to false in v1.

Reject null, unknown keys, numeric strings, NaN, Infinity, fractions and true
autoplay. Absence stays absent in storage; do not invent an API normalization or
renderer fallback here. No speed curve, callback, CSS string, loop engine or
script expression is accepted. These are inert future playback defaults; F026
does not implement timers, animation or controls.

textAlternative plus each step explanation must provide a readable narrative
independent of motion or color. Labels provide names for future graph elements.
The model guarantees nonblank bounded text, not editorial quality or actual
screen-reader behavior. F027/F028 must render text safely, support reduced motion,
keyboard operation, visible focus, contrast and accessible controls. User motion
preferences must not be overridden by authored configuration.

### Aggregate size and tradeoffs

Approved maximum: 256 KiB (262,144 bytes) of UTF-8 JSON for the normalized authored
projection `{ type, title, textAlternative, nodes, edges, steps, animationConfig,
schemaVersion }`, omitting absent optional properties. Exclude database IDs,
provenance, status, timestamps and __v from this calculation. Use native
JSON serialization/Buffer.byteLength on the validated plain projection; fail
validation, never truncate. No additional dependency is required.

The node/edge/step limits target concise beginner lessons and bound reference
validation and future rendering work. The aggregate ceiling prevents every field
simultaneously reaching its individual maximum; Unicode and JSON escaping may
reach it sooner. The ID alphabet makes references predictable but excludes
localized IDs (labels remain Unicode). Required edge labels and step explanations
add authoring effort for accessible meaning. Duration limits and disabled autoplay
favor conservative playback; advanced lessons may require a separately approved
schema-version expansion. None of these limits is a MongoDB platform requirement.

## Validation, lifecycle and security responsibilities

Reuse the existing application-owned Mongoose instance and module structure.
Approved model options: collection visualizations, timestamps true, strict throw,
autoCreate false, autoIndex false and bufferCommands false. Nested schemas are
strict with no generated IDs. Scalar/array/container guards must reject coercion,
not merely validate the already-cast result. Optional description/config values
may be omitted; present null, blank or malformed values fail. Validate exact
boundary values and whole-document references on normal validated save paths.

ObjectId references accept genuine ObjectIds or exact 24-hex strings only;
valid strings are explicitly converted to ObjectIds. Reject padded, malformed,
numeric, array, Buffer and object substitutes. No lookup is implied by conversion.
Standard generated root identity/timestamp/version behavior is retained.

Lifecycle enum: DRAFT, AI_GENERATED, IN_REVIEW, CHANGES_REQUIRED, APPROVED,
PUBLISHED, ARCHIVED. Omitted status defaults to DRAFT; invalid or coerced values
fail. This feature stores valid states only. It implements **no transition API,
authorization state machine, review approval, publication or archiving operation**.
Future services must enforce transitions and audit authorization; an enum does
not prevent an authorized database caller from changing one valid status to another.

Only schemaVersion 1 is accepted through this model. Unsupported versions must
fail validated writes, not be converted or downgraded. Future readers/renderers
must fail safely for unsupported versions. __v is not renderer compatibility.
No migration, backfill or rewrite of existing Concepts is included.

Reject executable structures through explicit typed shapes: no functions,
callbacks, expression objects, event handlers, arbitrary props, raw HTML/SVG/MDX
payload fields, assets, URLs or external loaders. Data is never evaluated,
compiled, fetched or used as an object prototype/DOM selector by this feature.
Unknown/prototype-related keys are rejected at every nested boundary.

Plain text remains untrusted data: a literal code-like or markup-like string is
not executable merely because it is stored. Approved text policy is escaped text
rendering by future consumers, not brittle keyword filtering or claimed HTML
sanitization. Do not interpret text as HTML, Markdown, CSS, a URL or JavaScript.
Future renderers must map opaque IDs to trusted components rather than merge
untrusted objects into renderer configuration. The owner approved this explicit
distinction between inert text and prohibited executable payload structures.

## Reference guarantees and indexes

Model validation guarantees local graph references, bounded data, correct value
types and presence of Concept/Topic/Technology/User ObjectIds. It does not open
connections or make lookups during offline validation.

Future write/read services must verify Concept existence; topicId/technologyId
agreement with that Concept and its complete ancestry; referenced user existence,
Admin authority and authenticated audit identity; allowed lifecycle transitions;
and publication/visibility before exposure. No foreign-key or Admin-role guarantee
is implied by `ref`. Cross-document race handling belongs to those future services.
Direct collection writes and unvalidated updates can bypass Mongoose validation.
This is not a MongoDB collection validator or authorization boundary.

Declare exactly the two approved nonunique indexes:

- `{ conceptId: 1, status: 1 }`
- `{ conceptId: 1, type: 1 }`

MongoDB also supplies its standard unique `_id` index. Do not add a unique Concept,
Concept/type, title, node ID, slug or TTL index. Graph-ID uniqueness is local model
validation, not global uniqueness. Multiple records for the same Concept/type are
valid. Normal application startup must not create the collection or indexes.

## Exact approved implementation inventory: seven files

This boundary is approved for implementation and offline verification.

| File | Action and responsibility |
| --- | --- |
| docs/features/F026-visualization-data-model.md | New in planning; finalize approved contract, later authorized status/evidence |
| docs/DEVELOPMENT_ROADMAP.md | Modify only after implementation/status authorization |
| docs/DATABASE_DESIGN.md | Document approved v1 payload refinement, bounds and deferred types/assets |
| docs/API_DESIGN.md | Document that F026 adds no endpoint or Concept DTO change; future exposure remains gated |
| apps/api/src/modules/visualizations/visualization.model.ts | New strict model, nested validation and two declared indexes |
| apps/api/tests/visualization-model.test.ts | New focused offline validation/security/index tests |
| apps/api/tests/visualization.integration.ts | New gated persistence/index suite reusing existing disposable testing patterns |

Four new files including this plan, three modified existing documents. All model
helpers remain local to the model file; do not add shared packages, scripts or
test infrastructure. No existing application/test files need modification. If
safe implementation or test integration requires another file, stop for approval.

## Acceptance and efficient verification plan

### Offline implementation gate

After approval, run focused Node tests using the existing tsx/Mongoose patterns:

1. Valid minimal/full records; defaults, audit timestamps/options, schema version,
   absent optional fields, preserved order and no nested IDs.
2. Exact minima/maxima and one-past limits for every text, array, ID and duration;
   nulls, sparse arrays, nonfinite numbers, wrong types, coercion and unknown keys.
3. Duplicate node/edge IDs, dangling edge endpoints, dangling/duplicate step refs;
   valid cycles, self-loops, parallel edges and independent ID namespaces.
4. Valid 256-KiB boundary and oversized rejection, including multibyte/escaped text;
   no silent truncation or URL/HTML/code interpretation.
5. Approved enum/version behavior; invalid status/type/version rejection; valid
   optional config and malformed present config rejection.
6. Exact index declarations, no unique Concept restriction/TTL, no import-time DB
   connection/index creation, no changes to Concept schemas or DTOs.

Run relevant existing Concept API regressions; reuse web evidence where unchanged.
Run required build, lint, typecheck, formatting and dependency/scope/security checks.
Do not repeat passing suites without changed code or a concrete discrepancy.

### Separately approved isolated MongoDB gate

Use the existing disposable procedure and guarded integration-test conventions,
with only synthetic fixtures and no new infrastructure. Confirm the exact harness
target before execution. The retained target is 127.0.0.1:27018, f021-test replica,
deeplearner-f021-test database, with a new uniquely owned temporary data directory.
Port conflict or any identity/storage mismatch must stop execution.

Initialize the replica once; wait for hello.isWritablePrimary within existing
deadlines; only then verify database emptiness before fixture writes. Never use
Atlas, port 27017, an environment fallback or persistent demo storage. Tests must
also assert the exact target and disable silent configuration fallback.

Verify save/readback, defaults, ordering, optional absence, valid maximum payload,
rejection without persisted invalid records, timestamps/version behavior and exact
real indexes. Verify duplicate Concept/type records are allowed while duplicate
root _id is rejected. Synthetic hierarchy fixtures establish known relationships;
do not misreport them as automatic foreign-key or Admin validation. Confirm no
changes to Concept records/indexes and no unrelated collection mutations.

Close connections, clean only run-owned collections/storage, gracefully stop the
owned instance and verify process/port release. Retain sanitized failure evidence
under .cache; no automatic retry, repair or persistent-data access.

### Separately approved browser regression gate

F026 adds no UI or browser specifications. Before final approval, run one bounded
full regression using the existing configurations sequentially. The separately
approved readiness correction below changes only their server command. Current
retained discovery: F022 27 (including F025), F023 16, F024 19 and root smoke 1;
reconfirm discovery at execution rather than assuming counts cannot change.
No new Playwright configuration, renderer tests or browser infrastructure.

Approved execution cap: 25 minutes combined and at most five minutes of initial
failure analysis, zero retries, unchanged timeouts/assertions, all independent
results collected where supported. Stop safely on budget/isolation failure and
report remaining scenarios NOT_RUN. Retain detailed evidence under .cache; report
forced Windows server teardown separately. Passing these regressions preserves
existing UI evidence; it does not verify a visualization renderer or accessibility
features that F026 does not implement.

## Exclusions, limitations and next approval

Exclude endpoints/DTO exposure, student UI, renderer registry/engine, playback,
Admin authoring/approval/publishing, AI generation, code execution, assets, source
fetching, progress/completion, migrations, demo updates and new dependencies.
Do not claim PRD section 96 is complete: selection, preview, viewing, controls and
reduced-motion UI belong to later authorized work.

Preserve prior release limitations: F020 browser deferrals, mocked-browser versus
live-backend integration, unproven internal generation-check execution following
cancellation, live dependency-failure injection, normal Atlas startup, graceful
Windows Next.js shutdown, local Admin login/full Stop-Start evidence where still
unverified, and unresolved cold development-route latency. F025 editorial source
approval/publishing enforcement remains deferred to F047-F051. No deployment is
authorized by this plan or future development closure.

**Contract decisions:** Resolved by owner implementation approval and explicit
autoplay clarification. No implicit autoplay default or true value is accepted.

**Current gate:** Owner approved F026 APPROVED_COMPLETE and scoped Git delivery
on 2026-10-15. Production deployment and F027 implementation are not authorized.

**Planning evidence:** Read-only contract/code inspection and creation of this
document only. No implementation, tests, services, database/browser operations,
dependency installation, Git operations or existing-file/status changes occurred.
This describes the earlier planning gate; implementation evidence follows.

## Implementation and offline evidence - 2026-10-15

Implementation is complete within exactly the seven approved files. F026 remains
IN_PROGRESS. No dependency, endpoint, Concept field/index, UI, renderer, demo
record, migration, publishing or authentication change was introduced.

The model uses strict nested schemas, source-local guards against input coercion,
exact graph IDs/references and bounded authored UTF-8 JSON. ObjectId references
accept genuine ObjectIds or exact 24-hex strings, with explicit conversion only
for valid strings. Optional animationConfig remains absent; present config must
include duration and explicit false autoplay. Code-like teaching text remains inert.
Cycles, self-loops, parallel edges and unused nodes are accepted as approved.

A local model constructor guard rejects unknown/accessor/prototype-related root
inputs before Mongoose can discard them. Nested container guards reject unsafe
structures before casting. Whole-document graph and byte-size checks run in
async validation middleware, including validated saves of modified documents.
Use async validate()/save(); validateSync() does not execute that middleware and
is not a complete F026 validation check. Query updates, bulk/raw writes and future
API service policies are not established by this model. No lookups or connections
occur during offline validation; referenced identity/ancestry remains a service duty.

| Verification | Result |
| --- | --- |
| Focused visualization tests | 12/12 PASS |
| Relevant existing Concept model/service/DTO/routes regressions | 29/29 PASS |
| Combined offline execution | 41/41 PASS; 0 failures/skips |
| Root build, lint, workspace TypeScript and format:check | PASS |
| Scope/dependency/security review | PASS; exactly seven approved files |
| Isolated visualization MongoDB suite | Initially NOT_RUN; subsequently 5/5 PASS including parent, see final evidence |
| Full Playwright regression | Initially NOT_RUN; subsequently 63/63 PASS, see final evidence |

Focused evidence covers defaults, explicit/absent autoplay, exact text/ID/array
bounds, ObjectId input types, graph integrity after mutation, unknown fields and
coercion, valid graphs, and exactly 262144 bytes versus one byte over with Unicode
and escaped text. Mocked collection saves confirm timestamps and that invalid
create/save inputs never reach persistence. No live database was involved.

The new integration specification contains four child scenarios plus the parent:
optional/full persistence and audit updates; invalid input/mutation rejection;
maximum-byte persistence and oversized rejection; real nonunique indexes,
duplicate root-ID enforcement and non-mutating reads/unchanged Concept fixtures.
It reuses the existing F021_TEST_* guarded target and synthetic hierarchy models.
It must not run until a separate owner-approved fresh-storage/PRIMARY/emptiness
preflight. Declaration and mock evidence do not substitute for real persistence.

Commands executed using existing tools:

```text
# apps/api (offline)
node --import tsx --test tests/visualization-model.test.ts tests/concept-model.test.ts tests/concept.test.ts tests/concept-routes.test.ts
# repository root
npm run build
npm run lint
npm run typecheck
npm run format:check
```

Initial TypeScript fixture/constructor typing issues were resolved within the
approved files; final workspace checks passed. Existing Concept validateSync
deprecation warnings are non-failing and were not changed. Static-check logs are
retained under .cache/f026-offline-2026-10-15/. No watchers, browser tests, live
MongoDB, persistent application startup or Git staging/commit/push were performed.

No unresolved contract decision remains. Next gates are owner source review and
separately authorized isolated MongoDB/full existing Playwright verification.
No automatic READY_FOR_REVIEW transition is authorized by offline completion.

## Final verification and acceptance review - 2026-10-15

**Final review: PASS. Status: APPROVED_COMPLETE by explicit owner approval.** The approved seven-file F026
implementation matches ANIMATED_FLOW-only schemaVersion 1, strict nested types,
50/100/100 graph limits, exact local references, required accessible inert text,
262144-byte authored payload limit, optional complete animationConfig with explicit
false autoplay, lifecycle/audit conventions and both nonunique indexes. No Concept
API, index, endpoint, dependency, migration, demo record or authorization change
was introduced. Offline evidence remains 12/12 focused plus 29/29 regressions,
with build/lint/typecheck/format/security PASS; no offline or MongoDB reruns.

Isolated MongoDB: four child scenarios plus parent **5/5 PASS**, runner 1.482s,
procedure 6.81s. Fresh owned temporary storage; loopback 127.0.0.1:27018, replica
f021-test, database deeplearner-f021-test; PRIMARY confirmed before emptiness and
fixtures. Persistence, absence/full config, audit/order, invalid saves, graph
mutation, exact payload boundary, real indexes, duplicate-ID rejection and
non-mutating reads/unchanged Concept fixtures passed. Initialization/test/shutdown/
MongoDB exits were all 0. Owned collections/storage removed, graceful shutdown,
port release, source hashes and persistent demo-storage metadata preserved.

The initial browser run was 61 PASS/2 FAIL: cold Concept navigation exceeded the
10-second load budget; F024 afterAll counted one historical PID after Chrome closed.
Later targeted attempts retained navigation/monitoring failures. Those failures
and their evidence are preserved, not relabelled as passes. Historical unrelated-
process continuity remains UNVERIFIED, explicitly accepted by the owner; neither
PID reuse nor unauthorized termination was established for that historical event.

### Separately approved test-environment correction

Only playwright.f022.config.ts, playwright.f023.config.ts and
playwright.f024.config.ts change outside F026: each webServer command now invokes
the existing web build followed by the existing start script, bound to 127.0.0.1.
The existing explicit NEXT_PUBLIC_API_BASE_URL is supplied during build and start,
so mocked requests target 127.0.0.1:4000; the previous generic build used localhost.
This removes development request-time compilation without route prewarming, fixed
sleeps, new files/dependencies, assertions changes or timeout increases. Existing
120-second startup and 10-second navigation budgets, isolated contexts, test
discovery, reporters, retries and root smoke configuration remain unchanged.
Production prefetch/navigation behavior is exercised by the unchanged assertions.
These three maintenance changes are separate from the seven-file feature scope.

Targeted F022 navigation/source and F024 onboarding/afterAll checks: **2/2 PASS**.
Full sequential regressions: **F022/F025 27/27, F023 16/16, F024 19/19, smoke 1/1;
63/63 PASS**, zero failures/skips/flaky tests and zero retries, all runner exits 0.
Full stage including builds/startup/cleanup: **314.577s (5m 15s)**; targets plus full
stage: 390.4s. Existing navigation/RSC, three modes, source links, keyboard/focus,
responsive overflow, Markdown security, Retry, authentication boundaries and
account/cancellation isolation assertions passed. Configuration formatting/lint
and load/discovery checks passed; each production web build passed.

Prospective sanitized PID/creation-time, parent, executable and Job Object
membership evidence is retained. Every owned job emptied, ownedAlive=0 and ports
3000/4000/5173/27018 were released; no owner fallback ForceStop was used. Chrome
closed gracefully. Playwright Windows Next.js process-tree teardown remains
forced, not graceful shutdown evidence. One unrelated baseline exit during F022
is an unexplained observation under the owner-approved policy; no test-caused
unauthorized termination was established. Source hashes were unchanged during
execution; checkpoint comparison showed only the three approved configuration
changes before this two-document update.

Evidence:

- .cache/f026-offline-2026-10-15/: retained offline/static results.
- .cache/f026-integration-2026-10-15T09-32-23-367Z/: database preflight, tests and cleanup.
- .cache/playwright/results/f026-full-2026-10-15T09-34-10-187Z/: original failures.
- .cache/playwright/results/f026-recovery-2026-10-15T12-57-21-070Z/: targeted navigation PASS and monitoring limitation.
- .cache/playwright/results/f026-final-2026-10-15T13-08-00-610Z/: targeted cold-navigation failure.
- .cache/playwright/results/f026-production-2026-10-15T13-21-11-516Z/: final discovery, targeted/full JSON reports, logs, identities, preservation and cleanup.

Limitations remain: model reference fields do not verify parent existence/ancestry
or Admin authority; async validate()/validated save are required for whole-document
checks, not validateSync/query/raw writes. Accessibility metadata is not a renderer
or editorial quality guarantee. Mocked browser tests do not establish live backend
integration or canceled-response internal generation-check execution. Earlier
release/tooling limitations, graceful Windows shutdown and development-route
latency remain open; using production builds does not repair the development
runtime. No production deployment, completion approval, Git delivery or F027 work
is authorized by READY_FOR_REVIEW.

## Owner development closure - 2026-10-15

Owner explicitly approved F026 APPROVED_COMPLETE and two separate scoped commits:
the three reviewed Playwright readiness configurations, then the seven F026 files.
All verification evidence and release/tooling limitations above remain accepted
and unchanged. The unrelated baseline-process exit remains unexplained; closure
does not establish its cause or historical process continuity. F001-F025 approvals
are preserved, F027 remains NOT_STARTED, and no production deployment is authorized.

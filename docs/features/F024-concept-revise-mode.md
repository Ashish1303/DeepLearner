# F024 - Concept Revise Mode

**Status:** APPROVED_COMPLETE
**Roadmap dependency:** F021 APPROVED_COMPLETE.
**Reuse:** F022 Concept Read UI, F023 Concept Example Mode and the existing student shell.
**Authorization:** Implementation, offline verification, separately approved Chrome/MongoDB
verification and final acceptance review are complete within the 22-file boundary
(4 new, 18 modified). The owner explicitly approved development closure as
APPROVED_COMPLETE and the F024-only commit/push to origin/dev on 2026-10-13.
F001-F023 approvals remain unchanged; F025 is not authorized.

## Sources and approved reconciliation

- [PRD](../PRD.md), section 25: simple revision using a short summary, key points,
  optional flashcards, memory trick and important code; personalized revision later.
- [Database Design](../DATABASE_DESIGN.md), concepts and illustrative Concept:
  optional bounded embedded revise content; the example names summary and memoryTrick.
- [API Design](../API_DESIGN.md), F021/F023 public Concept read contracts.
- [System Architecture](../SYSTEM_ARCHITECTURE.md), modular API boundaries and the
  existing Next.js/TypeScript student application.
- [Development Roadmap](../DEVELOPMENT_ROADMAP.md), F024 Concept Revise Mode.
- Approved [F021](F021-concept-read-model-api.md),
  [F022](F022-concept-read-ui.md) and [F023](F023-concept-example-mode.md) plans.
- Stitch reference: docs/designs/student/concept-learning/stitch/screen.png and
  code.html, especially panel-revise. The screenshot primarily shows Visualize;
  the HTML provides summary, recall-card and quick-reference layout references.

The earlier documents do not define complete revision field names, bounds or a
Revise DTO. The owner approved the explicit F024 refinements below. F021's revise
deferral is resolved only for this read-only content extension. All other deferred
fields and workflows remain deferred, including the entire completionRules field.

Interactive flashcards and PDF export are explicitly deferred by owner decision,
despite their appearance in PRD/Stitch references. This does not delete or silently
rewrite the PRD. Adapt the content hierarchy to existing teal CSS Modules; do not
copy CDN dependencies, inline scripts, simulated progress or click-only flip cards.

The approved scope expansion resolves the existing F023 test's two-tab assumption.
Its ArrowRight/ArrowLeft and Home/End assertions must accommodate three tabs while
preserving Example behavior and the existing security/isolation assertions.
There are no remaining contract decisions requiring resolution. Implementation and
offline verification are approved. Further discoveries outside this boundary require owner approval.

## Model and validation contract

Add optional embedded revise to the existing Concept model. Keep its persistence
default undefined: legacy documents must remain without the field until explicitly
authored through a future approved workflow. No migration, backfill or automatic save.

| Field | Approved contract |
| --- | --- |
| revise.summary | Required when revise exists; trimmed plain string, 1-2,000 characters |
| revise.keyPoints | Optional ordered array, maximum 10 items; each a trimmed plain string, 1-500 characters |
| revise.memoryTrick | Optional trimmed plain string, 1-2,000 characters |
| revise.importantCodeMarkdown | Optional string, 1-10,000 characters; preserve whitespace and reject blank content |

Use existing JavaScript/Mongoose string-length conventions. Validate plain-text
lengths after trimming; do not truncate or coerce numbers/objects into strings.
An omitted optional field is valid. An empty keyPoints array is valid. Explicit
null, invalid types, blank present text, null array entries, nonarray keyPoints,
unknown fields and an empty revise object are invalid persistence input. Prevent
Mongoose's single-value array coercion locally, as with F023 examples; do not alter
global casting behavior. Summary-only revision is valid.

Use a strict embedded object without an _id. Preserve key-point ordering. No new
IDs, lifecycle, source/provenance fields, collection, index, schemaVersion or
aggregate-length rule. Existing Concept provenance, status and publication apply
to its revision content. All existing Read/Example bounds and defaults remain.

Plain text is escaped during rendering, not interpreted as HTML or Markdown.
importantCodeMarkdown is untrusted authored Markdown, not sanitized storage or
executable code. Do not require a new language enum or structured code schema.

## API and backward compatibility

Extend only GET /api/v1/concepts/:id through its existing repository projection
and explicit detail DTO mapping. No new endpoint, controller or service workflow.
The additional response field is:

```ts
revise: null | {
  summary: string;
  keyPoints: string[];
  memoryTrick: string | null;
  importantCodeMarkdown: string | null;
}
```

Legacy absence returns revise: null. For a present valid object, map missing
keyPoints to [], and missing memoryTrick/importantCodeMarkdown to null, without
materializing those defaults in storage. Return only these four nested fields;
exclude internal IDs, author metadata and unknown properties.

The frontend accepts a missing revise field from a pre-F024 server as null and
accepts the explicit normalized DTO. Mirror field bounds with strict nested
validation; malformed present content must produce the existing safe response
error, not silently become unavailable content. Absent optional nested fields may
normalize to the same DTO defaults. Null summary/keyPoints or invalid non-null
optional strings remain invalid.

Keep GET /api/v1/concepts unchanged: no revise in summary DTOs or projections.
Preserve identity/ancestry, Read, examples, source, contentFormat and schemaVersion
in detail responses. Retain five-level PUBLISHED visibility, consistent ancestor
references, identical list/count predicates, topic-scoped slug uniqueness and
all existing indexes. Preserve envelopes, strict IDs/queries, generic 404s,
sanitized dependency errors, CORS, no-store and the shared rate limiter.

Public reads remain credential-independent and non-mutating. Catalog requests
use credentials: omit, no Authorization header, existing cancellation/deadlines
and no authentication refresh/logout side effects. Do not fetch source URLs.

## Student UI, accessibility and security

Keep /concepts/[conceptId], Topic discovery, breadcrumbs, source reference and
back links unchanged. Extend the loaded Concept tab order to Read -> Example ->
Revise. Read is default on initial load, reload and account/resource changes.
Tab switching uses the already validated Concept response, without another API
request, document reload, stored preference, progress update or completion state.

ConceptRevise is the only new feature component. Render an h2 Revise heading,
summary, semantic key-point list, and optional Memory trick/Important code
sections. Omit absent optional sections. When revise is null, show a truthful
message such as "No revision content is available for this Concept yet."
Do not derive revision content from Read/Example or fabricate flashcards.

Use the existing loading, error, unavailable and explicit Retry states. Preserve
authenticated eligible STUDENT browsing, incomplete-onboarding access and the
existing dashboard restriction, ADMIN/invalid/blocked boundaries and keyed
account/resource ownership. Keep cancellation and generation guards unchanged.

Generalize the existing two-tab keyboard logic to three tabs:

- ArrowRight/ArrowLeft advance or wrap through Read, Example and Revise.
- Home selects Read; End selects Revise. Enter/Space and pointer activation work.
- Maintain labelled tablist, stable tab/panel IDs, aria-selected, aria-controls,
  aria-labelledby and one roving tabIndex=0. Only the active panel is exposed.
- Keep focus on the activated tab. Tab exits the tablist to active content;
  hidden panels must not remain focusable. Preserve initial-load/Retry focus.
- Preserve visible keyboard focus, contrast, logical reading order and reduced
  motion. Keep one page h1, panel h2 and optional section h3 headings.

Reuse ConceptMarkdown unchanged for importantCodeMarkdown, with headingBase=4
below its h3 section. Retain its allowlist, raw-HTML suppression, safe absolute
HTTPS links without credentials, safe external-link attributes, text-only unsafe
links/images and escaped non-executable code. No MDX, media fetching or plugins.
Keyboard-focusable code regions scroll internally; do not hide page overflow.
Retain the F023 minmax(0, 1fr) grid correction. Verify readable, unclipped content
and no document-level horizontal overflow at 1280/768/390 by 900 pixels.

## Exact implementation boundary: 22 files

Create four files (including this approved plan):

1. docs/features/F024-concept-revise-mode.md
2. apps/web/src/components/concepts/concept-revise.tsx
3. tests/browser/concept-revise.spec.ts
4. playwright.f024.config.ts

Modify eighteen approved files:

5. docs/DEVELOPMENT_ROADMAP.md
6. docs/API_DESIGN.md
7. docs/DATABASE_DESIGN.md
8. apps/api/src/modules/concepts/concept.model.ts
9. apps/api/src/modules/concepts/concept.dto.ts
10. apps/api/src/modules/concepts/concept.repository.ts
11. apps/api/tests/concept-model.test.ts
12. apps/api/tests/concept.test.ts
13. apps/api/tests/concept-routes.test.ts
14. apps/api/tests/concept.integration.ts
15. apps/web/src/lib/concepts/contracts.ts
16. apps/web/src/components/concepts/concept-browser.tsx
17. apps/web/src/components/concepts/concept-browser.module.css
18. apps/web/tests/concept-client.test.ts
19. apps/web/tests/concept-controller.test.ts
20. apps/web/tests/concept-rendering.test.ts
21. apps/web/tests/concept-markdown.test.ts
22. tests/browser/concept-example.spec.ts

The F023 browser-spec change is authorized for three-tab compatibility and the
subsequently approved bounded navigation synchronization in four transition scenarios.
Update its keyboard wraparound/Home/End and active-panel expectations, deliberately
selecting Example before Example-specific assertions. Verify inactive tabs, not
just one former two-tab counterpart. Preserve all Example rendering, navigation,
security, no-extra-fetch and account/request-isolation coverage. Do not skip or
weaken assertions to obtain a passing suite. F023 stays APPROVED_COMPLETE.

No package/lockfile, authentication, shared package, new route, existing renderer,
old feature document, startup helper or persistent configuration change is planned.
scripts/Stop-DeepLearner.ps1 and scripts/tests/LocalStartup.Tests.ps1 remain separate,
untouched local changes. Any additional file or contract change requires approval.

## Verification and acceptance gates

### Implementation and offline gate: approved

The implementation gate required IN_PROGRESS in this document and the roadmap,
including its current-feature pointer. Implement only the 22-file scope. Run focused tests,
relevant complete API/web regressions, build, lint, typecheck and formatting;
review scope, dependencies and secrets. Do not reuse old counts as new executions.

Required offline coverage:

- Legacy storage absence, summary-only and full objects, explicit defaults in DTOs,
  strict unknown-field rejection and no nested IDs.
- Independent minimum/maximum/over-limit cases for every string and keyPoints
  count; empty arrays, missing summary, nulls, whitespace and coercion rejection.
- Trimming versus preserved Markdown whitespace, ordered items, safe nested DTOs,
  unchanged lists/projections, hierarchy predicates and indexes.
- Strict frontend normalization and malformed-response rejection, existing
  credential-free request options, error/Retry behavior and cancellation.
- Escaped plain text, restricted Markdown/links/images/headings, empty and partial
  UI states, tab wiring and delayed-result suppression after account/resource
  transitions or unmount. Static rendering is not mounted accessibility evidence.
- Prepare and statically check the F024 Playwright spec/config and narrowly revised
  F023 spec without executing Chrome during the offline gate.

### Automated Chrome gate: separate execution approval required

Reuse installed Chrome and the existing Playwright foundation: isolated contexts,
mocked API/auth responses, one worker, zero retries and bounded timeouts. The new
feature config follows existing patterns; no new supervisor, browser framework,
font workaround or test environment. Refuse occupied ports and reuseExistingServer.
Only a test-owned loopback Next.js server is allowed; no real API/MongoDB here.

Acceptance must verify three-tab order/default/reset behavior, all keyboard controls
and visible focus, panel relationships, no extra requests, complete/partial/legacy
revision, loading/error/malformed/Retry states, safe Markdown/plain text, code
scrolling, responsive sizes, credential-free headers, unchanged auth counters during
catalog faults and same-document account/resource isolation with identified requests.
Run relevant F023 browser regressions under the same separately approved gate.

Reuse exact response/request waiters registered before triggers. For Topic-to-Concept
RSC navigation match expected origin/path, GET and _rsc, require HTTP 200 within the
existing 10-second navigation budget, then retain the five-second UI assertion.
Keep faults active until delivered and the student-main error state is verified;
scope Retry there. No sleeps, arbitrary timeout increases, silent retries or skipped
assertions. Use genuine keyboard input for focus-visible checks.

Retain sanitized failure traces/screenshots and timings. Close only test-owned
contexts/processes, verify exits and port release, and distinguish Windows forced
Next.js teardown from graceful shutdown. Stop on failure without automatic fixes.
Canceled-response release does not establish internal generation-branch execution.

### Isolated MongoDB gate: separate execution approval required

Extend the existing Concept integration test and reuse its explicit F021_TEST_*
write opt-in/target checks and disposable procedure; no new integration framework.
The current guarded target is 127.0.0.1:27018, replica set f021-test, database
deeplearner-f021-test. Approval must confirm a free port and fresh owned temporary
storage, never persistent deeplearner-local-demo storage or an existing instance.
Never access port 27017, Atlas, existing accounts or the published demo records.

Before fixtures, independently verify executable/process ownership, loopback
listener, dbPath, exact replica identity, single approved host, writable PRIMARY
and an empty database. Use explicit child-only configuration without .env fallback.
Replica initialization precedes PRIMARY/collection checks. Retain the existing
90-second suite and 120-second external bounds and supported PowerShell 7 standard
input invocation. No oversized encoded command or automatic write retry.

Verify actual absent/partial/full persistence, trimmed and ordered values, preserved
Markdown, independent invalid-value rejection, normalized legacy/detail HTTP data,
unchanged lists/indexes/uniqueness/publication/reference restrictions and non-mutating
public reads. Report exactly which boundaries have database evidence versus offline
evidence. Disconnect, remove only run-owned collections/resources, gracefully stop
only owned MongoDB, verify exit/port release and preserve evidence on failure.
Report forced cleanup separately; preserve all persistent demo storage.

### Final review and completion gate

Reconcile actual offline, browser and integration counts, scope, cleanup and
limitations. Report defects without automatic repairs. READY_FOR_REVIEW requires
the approved workflow and satisfied or explicitly resolved gates; APPROVED_COMPLETE
requires explicit owner approval. Commit/push and subsequent features are separate
authorizations. No production deployment is implied.

## Exclusions, risks and retained limitations

Exclude interactive flashcards, PDF export, AI, personalized/spaced revision,
progress/completion, enrollment, Practice/Visualize, executable code, Admin authoring,
source editorial workflows, new endpoints/dependencies and demo-content updates.
Existing demo Concepts will truthfully show unavailable revision until separately
approved authoring/provisioning; do not synthesize it from existing material.

Preserve F020-F023 production-release limitations: accepted F020 browser gaps and
shutdown failure; mocked browser APIs do not establish browser-to-live-backend
integration; canceled responses do not prove internal generation-check execution;
graceful Windows Next.js shutdown, live dependency-failure injection and normal
Atlas startup remain unverified. Earlier intermittent development-route latency
remains unexplained despite successful bounded synchronized navigation. The local
web STOP_TIMEOUT and separate Stop-helper work are not part of F024. Tooling login
and persistence limitations remain tracked in LOCAL_DEVELOPMENT.md.

## Implementation and offline evidence - 2026-10-13

Implemented within the exact 22-file scope (4 new, including this plan; 18 modified).
Revise persistence rejects malformed present values and unknown fields without
coercion; legacy storage remains absent. The explicit detail projection normalizes
optional DTO values, while list projections, indexes, visibility and authorization
remain unchanged. Read/Example/Revise tabs reuse the existing keyed request owner,
restricted Markdown renderer and CSS grid sizing. No new dependencies were added.

Verified in this implementation gate:

- Focused API: 26/26 PASS (model, DTO/repository/service, mocked HTTP routes).
- Focused web: 33/33 PASS (client contracts, controller cancellation, static
  component/handler wiring and Markdown security).
- Full offline API regression: 212/212 PASS; web regression: 109/109 PASS;
  321/321 combined, zero failures/skips. The existing environment-validation
  subprocess tests account for most of the API suite's 243-second runtime.
- Root production build: PASS (shared packages, Next.js, Admin, API).
- Repository lint and formatting: PASS. Workspace typechecks: PASS after correcting
  the negative integration fixture's typing; the fixture uses the model constructor
  before save so intentionally invalid inputs remain testable without weakening types.
- F024 configuration/spec and the F023 compatibility spec: TypeScript static check PASS.
- Scope/dependency/secrets review: PASS. The two separate Stop-helper files match
  their preflight SHA-256 fingerprints; all earlier feature approvals are preserved.

The initial focused API run exposed a test diagnostic for undefined values and an
incorrectly duplicated nested validation-error path. Both were corrected within
scope; the final focused/full suites above passed. No verification failures remain
in the executed offline checks. Existing Mongoose validateSync deprecation warnings
remain an upstream/test-pattern limitation, not a database execution result.

## Executed browser, database and final-review evidence - 2026-10-13

Chrome acceptance: **F024 19/19 PASS; F023 compatibility 16/16 PASS**, each in one
complete final execution with one worker, zero retries and unchanged timeout budgets.
The owner-approved CLI override collected all independent scenarios. Retained runner
logs report 1.7 minutes for F024 and 1.9 minutes for F023.

Verified browser behavior includes Read default/reset, three-tab keyboard navigation,
roving/visible focus, labelled panels, 1280/768/390 responsive layouts, no page-level
horizontal overflow, internally scrollable code, safe plain text/Markdown/links,
full/partial/legacy revision, loading/error/malformed/Retry states, no extra tab-switch
fetch, credential-free catalog headers, unchanged auth counters during faults and
same-document resource/account cancellation and stale-content exclusion.
F023 Example behavior and all four transition scenarios passed.

Earlier F024 execution was NOT_RUN because PowerShell treated debug stderr as a
terminating error. The separately approved execution correction used PowerShell 7
and native stdout/stderr capture, judging results by actual runner exit codes.
Earlier F023 compatibility was 12/16 PASS with four navigation/readiness failures.
The owner-approved test-only correction registered exact GET/RSC response waits
before affected navigation, retained the 10-second navigation and five-second UI
budgets, and handled cached client navigation through route readiness. No application
fix or weakened security/cancellation assertion was introduced. Earlier evidence is
retained; these final complete runs supersede the incomplete acceptance results.

Browser/process cleanup and file preservation: **PASS**. Chrome closed gracefully
with exit 0. Playwright forcibly terminated its owned Windows Next.js process trees;
this is not proof of graceful web shutdown. Owned processes exited and ports
3000/4000/5173/27018 were free. Only the separately approved F023 specification changed
during the correction gate; all 24 feature/helper checkpoint hashes were unchanged
during execution. No personal browser profile or persistent local application was used.

Isolated MongoDB integration: **4/4 PASS** (three scenarios plus parent), zero
failures/skips; suite **2.574 seconds**, procedure **6.4 seconds**. Initialization,
test, shutdown helper, MongoDB and wrapper exits: **0/0/0/0/0**.
The reused PowerShell 7 standard-input procedure verified owned executable/process,
loopback listener, fresh disposable dbPath, single-member replica f021-test,
writable PRIMARY and empty deeplearner-f021-test at 127.0.0.1:27018 before fixtures.

Real database coverage includes absent/partial/full Revise persistence, trimming,
ordered key points, authored Markdown whitespace, maximum-size field persistence,
malformed/unknown/coerced/over-limit rejection, legacy null and nested []/null
normalization, safe detail HTTP projection, unchanged list responses, publication
and reference exclusions, indexes/concurrent uniqueness, error/CORS/rate-limit
contracts and non-mutating public reads. The complete validation matrix also retains
the offline coverage above; Mongoose validation is not a MongoDB collection validator.

Database cleanup/isolation and preservation: **PASS**. Connections closed, owned
collections were independently confirmed removed, MongoDB exited gracefully, port
27018 was released and only the new owned temporary directory was removed. No forced
termination. All 22 F024 files and both separate Stop-helper files were unchanged.
Persistent demo storage was not connected to or changed; file metadata matched
before/after. Unrelated MongoDB PID 5228 was not targeted. No persistent records,
accounts, migrations or indexes were changed.

Retained local evidence (ignored artifacts, not part of the feature commit):

- .cache/playwright/results/f024-f023-followup-2026-10-13T13-54-20-957Z/:
  acceptance-summary.json, static-results.json, both runner logs/exit results and
  cleanup/preservation records.
- .cache/f024-integration-2026-10-13T14-19-37-107Z/:
  result.json, initialization/integration/shutdown logs, owner identity and MongoDB log.

Final acceptance review: **PASS**. The exact 22-file scope matches the approved
plan and retained executed checkpoint; no actionable application/security defect,
API mismatch or unauthorized dependency, endpoint, index or migration was found.
Only this feature document and Development Roadmap were updated in the final review;
the other 20 feature files and both Stop-helper changes were preserved. Tests were
not rerun. F001-F023 remain APPROVED_COMPLETE; F025 remains NOT_STARTED.

F024 is **APPROVED_COMPLETE** following explicit owner approval for development
closure. Production deployment is not authorized.
Browser-to-live-backend integration, internal generation-check execution for canceled
responses, graceful Windows Next.js shutdown, live database dependency-failure
injection and normal Atlas startup remain NOT_VERIFIED. Existing F020-F023 release
deferrals, local STOP_TIMEOUT, tooling login/persistence limitations and unexplained
intermittent development-route latency remain retained. Playwright configuration
consolidation is a recommendation only and requires separate approval.
Playwright configuration cleanup and F025 planning require separate owner approval.

# F023 - Concept Example Mode

**Status:** APPROVED_COMPLETE
**Owner completion approval:** 2026-10-13; development closure only.
**Roadmap dependency:** F021 APPROVED_COMPLETE.
**Reuse:** F022 Concept Read UI and the existing F013-F020 student shell/catalog.
**Authorization:** Owner approved the contracts and 22-file planning boundary.
Implementation and offline verification are owner-authorized within the 22 files.
Browser execution and real MongoDB integration require separate approvals.
F001-F022 approvals remain unchanged.

## Sources and contract reconciliation

- [PRD](../PRD.md), section 22: basic examples, real-world analogies, code examples
  and practical use cases, progressing from simple toward real-world application.
- [Database Design](../DATABASE_DESIGN.md), concepts and illustrative Concept:
  optional bounded embedded examples with title and bodyMarkdown.
- [API Design](../API_DESIGN.md), F021 Concept public reads.
- [System Architecture](../SYSTEM_ARCHITECTURE.md): existing modular API and Next.js
  student client; code execution is a separate security boundary.
- [Development Roadmap](../DEVELOPMENT_ROADMAP.md): F023 Concept Example Mode;
  F024 Revise and later features remain deferred.
- Approved [F021](F021-concept-read-model-api.md),
  [F022](F022-concept-read-ui.md) and [F020](F020-learning-path-student-ui.md) records.
- Stitch references: docs/designs/student/concept-learning/stitch/screen.png and
  code.html, including the Example & Analogy panel.

F021 deliberately deferred examples; its implemented model and detail DTO currently
omit them. This owner-approved F023 extension resolves that deferral for examples
only. The exact bounds below are approved F023 refinements, not previously defined
canonical bounds. Update API/Database Design during separately approved implementation;
do not rewrite the historical F021/F022 feature documents.

The screenshot primarily presents Visualize. Its HTML contains analogy/code panels
and a mode strip. Reuse that hierarchy with existing teal CSS Modules, not the
export's CDN dependencies, inline scripts, hardcoded lesson or simulated runtime.
There is no unresolved conflict requiring an additional architectural decision.

## Model and persistence contract

Add optional examples to the existing Concept schema:

| Field                        | Contract                                                      |
| ---------------------------- | ------------------------------------------------------------- |
| examples                     | Optional ordered array; zero to 10 entries                    |
| examples[].title             | Required string; trimmed; 1-120 characters after trimming     |
| examples[].bodyMarkdown      | Required string; 1-10,000 characters; nonblank after trimming |
| Combined bodyMarkdown length | At most 50,000 characters across the array                    |

Use existing JavaScript/Mongoose string-length conventions consistently in model,
DTO validation and tests. Preserve Markdown whitespace; use trimming only to reject
blank bodies. Each entry contains only title and bodyMarkdown. Reuse strict embedded
schema validation with no subdocument IDs. Reject malformed entries, unknown stored
entry fields, non-array values and explicit null; omission and an empty array are valid.
Do not silently truncate entries or bodies to meet bounds.

Preserve author-supplied array order. No example slug, category/type enum, order field,
language field, separate source, lifecycle, collection, index or endpoint is added.
PRD example types belong in authored titles and Markdown: fenced code, explanatory
prose, analogy and use cases, not additional structured fields.

Keep the field genuinely optional in persistence, without materializing an empty
array on previously absent records during model construction. This preserves
existing local insert-only content comparison behavior. No migration, backfill,
automatic save, publishing, authoring or database operation is part of implementation.
Existing Concept lifecycle, schemaVersion 1, provenance and indexes remain unchanged.

Existing local demo Concepts have no examples and must remain unchanged. They will
show the empty state. Adding Example content to them or changing the local manifest
requires separate owner approval and is outside this 22-file scope.

## API and backward compatibility

Extend only GET /api/v1/concepts/:id through the existing detail projection and DTO:

    examples: [{ title: string, bodyMarkdown: string }]

For persisted Concepts without examples, return examples: []. Map the two allowed
fields explicitly; never expose nested/internal IDs or persistence metadata.
The response retains its current envelope and all existing identity, ancestry,
title, slug, difficulty, order, contentFormat, schemaVersion, read and source fields.

The public list endpoint and summary DTO remain unchanged; examples must not enter
list projections or pagination payloads. No new filter or pagination for examples
is needed because the detail collection is bounded to ten.

Preserve:

- Published Technology -> Learning Path -> Module -> Topic -> Concept visibility
  and all denormalized-reference consistency checks.
- Generic existing 404s, strict ObjectId/query validation, sanitized dependency
  failures and the existing response/request-ID conventions.
- Current CORS/origin policy, no-store behavior and shared 120/IP/15-minute limit.
- Credential-independent public APIs with no auth refresh/logout, cookie setting
  or session mutations caused by catalog reads.

Frontend validation mirrors the new bounds and ordering. A missing examples field
may normalize to [] for compatibility with a pre-F023 detail response; malformed
present data must fail safely, not be silently converted into an empty state.
The updated backend always supplies the array. Preserve all F022 validation of
the surrounding detail envelope and ancestor relationships.

No API route/controller/service changes or new client are necessary: the existing
repository detail flow and frontend Concept client consume the extended DTO.

## Student experience and architecture

Keep /concepts/[conceptId] and existing Topic discovery, breadcrumbs, title,
difficulty, summary, source reference and back link. Do not add a route or expand
the login next allowlist.

Add Read and Example tabs on the loaded Concept detail screen:

- Read is initially selected. A reload/fresh visit starts in Read; selection is
  memory-only, not a persisted preference or query-string contract.
- Both modes use the same already validated detail response. Switching tabs must
  not refetch, reload the document, create progress or trigger authentication.
- Read retains existing presentation. Example renders an ordered list of semantic
  articles, using each authored title and restricted Markdown body.
- Empty examples show: "No examples are available for this Concept yet."
  The Example tab stays usable; never fabricate an example from Read content.
- Loading, error, unavailable Concept and explicit Retry remain owned by the
  existing controller. Malformed example data uses the safe unexpected-response
  error; it is not treated as a successful empty response.
- Preserve existing anonymous/invalid-session, verified ACTIVE STUDENT, ADMIN and
  blocked-account handling. Eligible incomplete students retain browsing access;
  F014 dashboard/onboarding restrictions remain unchanged.
- Keep the existing account/resource/ID component key, cancellation and generation
  guards. Account or Concept transitions reset tab selection and discard previous
  content. Tab state stays inside that existing keyed owner.

Use one feature component, ConceptExamples, for the meaningful Example panel.
Reuse ConceptBrowser, its CSS Module, the existing DTO/client/controller/hook and
ConceptMarkdown. No new state framework, abstraction layer or dependency.

## Accessibility, Markdown and responsive behavior

Use a labelled tablist, real buttons with role=tab, aria-selected, roving tabIndex,
and stable matching aria-controls/tabpanel/aria-labelledby relationships.
Only the active panel is exposed and focusable. Left/Right arrows cycle through
the two tabs; Home/End select the first/last; Enter/Space and pointer activation
work. Automatic activation is appropriate because both panels are already loaded.
Tab moves out of the tablist normally. Keep focus on the activated tab rather than
unexpectedly moving it into content. Preserve existing initial-load/Retry focus
behavior and meaningful loading/error announcements.

Keep exactly one page h1. Panel headings are h2; example titles are h3; Markdown
headings normalize below their example title starting at h4 and cap at h6.
Allow ConceptMarkdown a narrow heading-base option, retaining its existing h3
default for Read and preserving logical nesting for skipped authored levels.

All Markdown is untrusted data, not sanitized storage or executable code:

- Reuse pinned react-markdown and the explicit supported-element allowlist.
- Ignore raw HTML; never use HTML injection, MDX, eval or executable previews.
- Permit only safe absolute HTTPS links without embedded credentials.
- Preserve safe external-link attributes and new-tab announcements.
- Render unsafe links and images as safe text; no remote media loading.
- Render fenced code as text, without running it or adding syntax plugins.
- Preserve keyboard-focusable code regions and contained horizontal code scrolling.

Use the existing teal system, visible focus and contrast. Cards and mode controls
must fit mobile, tablet and desktop without page-level horizontal overflow.
Keep a logical reading order, readable line lengths and existing reduced-motion
behavior. Do not introduce mandatory animation or a rigid two-column split that
depends on a new example category.

## Exact implementation boundary: 22 files

Create four files (the first is this planning document):

1. docs/features/F023-concept-example-mode.md
2. apps/web/src/components/concepts/concept-examples.tsx
3. tests/browser/concept-example.spec.ts
4. playwright.f023.config.ts

Modify eighteen files only after implementation authorization:

5. docs/DEVELOPMENT_ROADMAP.md
6. docs/DATABASE_DESIGN.md
7. docs/API_DESIGN.md
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
18. apps/web/src/components/concepts/concept-markdown.tsx
19. apps/web/tests/concept-client.test.ts
20. apps/web/tests/concept-controller.test.ts
21. apps/web/tests/concept-rendering.test.ts
22. apps/web/tests/concept-markdown.test.ts

No package/lockfile, local tooling, authentication, F020-F022 feature-document or
existing F022 browser-specification changes are authorized by this boundary.
If additional files are required, stop and request approval.

## Offline acceptance and implementation gate

After separate implementation approval, transition F023 to IN_PROGRESS and:

- Test absent/empty examples, title trimming, blank bodies, exact boundary values,
  ten versus eleven entries, aggregate length, unknown fields and no nested IDs.
  Assert each invalid case independently against its intended validation rule.
- Verify safe ordered detail projection, legacy [], unchanged summary/list DTO,
  hidden fields, hierarchy filtering, generic errors and unchanged index definitions.
- Test frontend DTO bounds, missing-field compatibility, malformed present data,
  credential-free request options and manual Retry without auth side effects.
- Test Read preservation, Example ordering/empty markup and tab relationships.
  Static rendering is not evidence of mounted effects or keyboard behavior.
- Test Markdown injection, unsafe/obfuscated links, image suppression, escaped code
  and heading normalization at both Read and Example heading bases.
- Retain controller cancellation/account-resource isolation coverage, including
  deferred successes/failures that reach generation guards in controlled unit tests.
- Run focused tests, API/web regressions and root build, lint, typecheck, formatting,
  scope/dependency/secrets review. Do not reuse old counts as new execution evidence.
- Prepare and statically check the approved Playwright specification/configuration
  without executing browsers or database integration during the offline gate.

Report results and stop for owner review; do not self-promote to READY_FOR_REVIEW.

## Separately approved automated browser gate

Reuse installed Chrome and the existing Playwright foundation. The feature config
uses isolated contexts, one worker, zero retries and bounded timeouts. Test-owned
Next.js plus mocked API/auth responses only; no real MongoDB or API in this gate.

Verify actual mounted behavior:

- Read default, Example activation, no extra Concept request on repeated switching,
  direct link/reload default and preserved navigation/breadcrumbs/source display.
- All tab keyboard controls, roving focus, active-panel visibility, one h1 and
  correct heading nesting; desktop/tablet/mobile and code overflow.
- Empty and legacy examples; loading, malformed data, unavailable/error and Retry.
- Restricted Markdown without script execution, unsafe navigation or image fetches.
- Existing student/admin/account boundaries and same-document resource/account
  transitions with no stale Example content or errors.
- Catalog requests carry no Authorization/Cookie headers, including with a synthetic
  API cookie present. Inspect full headers without logging their values.
- Settled auth counters remain unchanged across catalog failures and explicit Retry.
  Register exact request/response waiters before fault triggers; scope error/Retry
  assertions to student-main and preserve the fault until the intended UI error.

No manual browser operation is required for planned acceptance. Mocked APIs prove
frontend behavior only. Use synthetic test data, never real demo passwords or
personal browser profiles. Intercept external navigation without visiting sources.

Refuse occupied test ports and never adopt or stop the owner's running local app.
An owner-controlled idle test window is required before browser execution.
Close only test-owned Chrome contexts/server processes and verify exits/port release.
Report Windows forced teardown separately from graceful shutdown. No new supervisor,
Job Object framework, font workaround or disposable environment is authorized.
On failures, retain sanitized evidence and stop without automatic fixes or reruns.

## Separately approved MongoDB integration gate

Extend the existing Concept integration test, without running it during planning
or offline implementation. Use its established explicit write opt-in and disposable
loopback replica-set procedure, with the target confirmed in the execution approval.

Before writes, verify port ownership, executable/binding, replica identity, PRIMARY,
exact disposable database and emptiness. Never use the persistent local demo
database, port 27017, Atlas or a historical test environment.

With approved synthetic fixtures, verify actual optional-field storage, absence
compatibility, ordered detail HTTP responses, unchanged list projection, schema
bounds, existing uniqueness/indexes, published ancestry and non-mutating reads.
Prove parent/reference exclusions and safe DTO behavior with real MongoDB.
No general content publishing or real demo-record changes are included.

Use bounded execution, one authorized run, no automatic repair/retry. Disconnect
clients, gracefully shut down only owned MongoDB, report any forced containment,
verify ports released and preserve evidence. This gate and browser execution are
independent approvals.

## Exclusions, evidence limits and owner gates

Defer executable playgrounds/output, Visualize, Practice, Revise/F024, progress,
completion rules, enrollment, AI, Admin authoring, per-example sources, F025 editorial
workflows, publishing operations, media and real Example-content provisioning.

Preserve separately documented limitations:

- F020 owner-accepted browser gaps and disposable web graceful-shutdown failure
  remain production-release blockers until their own acceptance gates are met.
- F021 live database dependency-failure injection and normal Atlas startup remain
  NOT_VERIFIED unless separately exercised and approved.
- F022 mocked browser APIs do not establish live browser/backend integration;
  canceled responses do not prove internal generation-check branch execution;
  graceful Windows web-server shutdown remains NOT_VERIFIED.
- Public local API success and demo provisioning do not establish authenticated
  browser behavior or close those historical gaps. Tooling login and full
  application Stop/Start/shutdown limitations remain in LOCAL_DEVELOPMENT.md.

## Implementation and offline verification

Owner-authorized implementation is complete within the approved 22 files.
F023 is APPROVED_COMPLETE following final review and explicit owner approval on
2026-10-13. The owner authorized the exact F023-only commit and push to origin/dev.

- Focused API model/repository/route tests: **21/21 PASS**.
- Focused web client/controller/rendering/Markdown tests: **29/29 PASS**.
- Complete offline API regressions: **207/207 PASS**.
- Complete web regressions: **105/105 PASS**.
- Root build, lint, typecheck and formatting: **PASS**.
- Final Playwright specification/configuration static TypeScript and lint: **PASS**.
- Diff whitespace, exact scope, unchanged dependency manifests/lockfile,
  unchanged index declarations and targeted secrets/security review: **PASS**.

Verification includes optional storage (no default array on legacy documents),
all example limits and field types, rejected nonarrays/null/unknown fields,
explicit ordered detail projection, unchanged list projection/hierarchy/indexes,
credential-free client options, safe Markdown at Read/Example heading bases,
static tab relationships and controller late-result/cancellation suppression.
The first focused API pass exposed Mongoose single-object array coercion and a
parent-validator masking a missing-body assertion. A field-local array setter
and independent nested validation corrected both within the approved model file;
all final focused and regression counts above passed after those corrections.
No global Mongoose casting behavior was changed.

## Completed browser and database verification

Separately authorized Chrome acceptance: **16/16 PASS, 0 FAIL, 0 NOT_RUN** in one
complete run, one worker and zero retries; runtime **203.6 seconds**. The owner
approved the runner-only max-failures=0 override; configuration and timeouts stayed
unchanged. Mounted assertions covered Read defaults, navigation/reload resets,
no extra requests on tab switches, keyboard/roving focus, responsive code overflow,
safe Markdown, empty/legacy states, loading/error/Retry, credential-free catalog
headers, unchanged auth counters during failures and account/resource isolation.
No unexpected external browser requests were observed.

Resolved review findings:

- Intrinsic grid overflow: the approved minmax(0, 1fr) column keeps content within
  the page while retaining internal code scrolling and visible focus. Retained
  focused verification passed both Read and Example at 1280/768/390 by 900 pixels,
  including actual keyboard focus and long code scrolling.
- Navigation synchronization: the first scenario registers the exact Concept
  GET/RSC response waiter before clicking, requires HTTP 200 within the existing
  10-second budget, then retains the five-second Read assertion. Focused execution
  and the complete suite passed. In the complete run the first RSC took 2.64s,
  Read was confirmed 3.27s after clicking, and the slowest recorded RSC was 2.74s.
  The underlying cause of the earlier intermittent 7.6s development response
  remains unconfirmed; no application correction or timeout increase was made.
- The premature roadmap completion status was corrected before acceptance; final
  subsequent final review and explicit owner completion approval are now recorded
  consistently.

Browser/process cleanup and file preservation: **PASS**. Chrome closure and
observed process exits passed. Playwright forcibly terminated its owned Next.js
process tree on Windows; ports were released. This is not graceful-server-exit
evidence. The separate Stop-helper modifications were preserved.

Separately authorized MongoDB integration: **4/4 PASS** (three scenarios plus
parent), suite **4.99 seconds**, procedure **14.15 seconds**. PowerShell 7 standard
input avoided the earlier command-length failure, which had started no database.
The existing F021_TEST_* guards were retained: 127.0.0.1:27018, replica set
f021-test, database deeplearner-f021-test, fresh owned disposable storage. Process
and listener ownership, exact instance configuration, writable PRIMARY and an
empty database were verified before fixtures. No persistent demo database,
port 27017, Atlas or real accounts were accessed.

Real database evidence covers persisted ordered examples and Markdown, legacy
field absence/detail [], invalid-example rejection, unchanged summary projection,
five-level publication/reference exclusions, indexes and concurrent uniqueness,
generic errors, HTTP detail/list behavior, CORS/shared rate limiting and
non-mutating public reads. Exact title trimming and individual boundary-value
matrices are covered by retained offline tests, not every case by integration.
Owned collections were independently confirmed removed, connections closed,
MongoDB stopped gracefully and its owned temporary directory was removed.
Initialization/test/shutdown/MongoDB/wrapper exits: **0/0/0/0/0**; no forced
database termination. Port release, source preservation and unchanged persistent
demo storage file metadata: **PASS**.

Retained local evidence (ignored artifacts, not part of the commit):

- `.cache/playwright/results/f023-complete-acceptance-2026-10-13T11-22-09-694Z/`:
  results.json, traces and runner/server logs.
- `.cache/playwright/results/f023-focused-keyboard-verification-2026-10-13T10-22-35-019Z/measurements.json`:
  focused layout, code scrolling and keyboard evidence.
- `.cache/f023-integration-2026-10-13T11-32-36-267Z/`:
  result.json, initialization/integration/shutdown logs and MongoDB log.

## Final review and retained limitations

Final source/contract/security/scope review: **PASS**, no actionable acceptance
defects. Retained API/web regressions total **312/312 PASS** (207 + 105).
Optional bounds, legacy compatibility, detail-only exposure, unchanged indexes
and publication predicates, restricted Markdown, accessible tabs and request
isolation match the approved contracts. No dependencies, endpoints, migrations or
demo-content changes were introduced. No suites were rerun for final review.

- API-mocked browser acceptance and real database-backed HTTP integration are
  separate evidence; a browser connected to the real backend remains NOT_VERIFIED.
- Canceled transport responses do not prove internal generation-check execution.
  Controlled offline controller tests cover late-result suppression separately.
- Graceful Windows Next.js shutdown remains NOT_VERIFIED. The earlier local
  Student web STOP_TIMEOUT/exit 1 remains a separate tooling issue.
- Live database dependency-failure injection and normal Atlas startup remain
  NOT_VERIFIED. Existing F020-F022 release limitations remain unchanged.
- This review does not authorize production deployment or Example provisioning
  into the existing demo records.

Owner-approved closure includes F023-only staging/commit/push. Exclude
scripts/Stop-DeepLearner.ps1 and scripts/tests/LocalStartup.Tests.ps1 from that
scope. F024 remains NOT_STARTED; its planning or implementation requires separate
owner approval. Production deployment is not authorized.

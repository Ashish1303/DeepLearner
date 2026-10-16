# F029 - First Real Visual Lesson

**Status:** APPROVED_COMPLETE
**Dependency:** F028 APPROVED_COMPLETE; reuse approved F026/F027 contracts.
**Authorization:** Owner approved the exact seven-file implementation and offline
verification. The reviewed graph/text and fixture proposals below are approved.
Owner separately authorized final browser/security verification and subsequently
approved feature completion and the seven-file Git delivery on 2026-10-16.
Preserve F001-F028 APPROVED_COMPLETE and do not start F030.

## Purpose, sources and delivery boundary

Create one reviewed authored lesson, **How JavaScript Closures Remember Variables**,
and demonstrate it with the existing ANIMATED_FLOW v1 renderer and player inside
the gated browser fixture. F029 establishes educational content and mounted
playback acceptance, not production student access.

Sources of truth reviewed:

- DEVELOPMENT_ROADMAP.md: F029 follows controls; Closure is an approved recommended
  first concept. The owner selected Closure rather than Event Loop.
- PRD sections 17-19, 74-75 and 96: controls, trusted structured content, readable
  alternatives and responsive visual learning. Section 96 remains incomplete.
- SYSTEM_ARCHITECTURE.md section 14: structured data interpreted by trusted
  renderers, never arbitrary executable lesson code.
- DATABASE_DESIGN.md and API_DESIGN.md: separate visualization persistence;
  visualization retrieval/editorial APIs remain unspecified and deferred.
- F026: strict authored graph contract; F027: validated render projection and
  deterministic SVG; F028: playback, identity isolation and runtime fixture guard.
- Previously reviewed Concept-learning Stitch screen/code: persistent explanation,
  graph and controls. No new layout engine, animated objects, runtime zones or
  Speed controls are implied by that reference.

PRD section 96's Concept attachment, student access, Admin selection/preview and
editorial approval/publishing are **outstanding dependencies for separately approved
features**. No student or Admin production interface is added here. The fixture's
lesson-selection button is a testing control, not an Admin authoring workflow.

## Approved original code and educational narrative

Display the following original owner-approved example verbatim, apart from line
ending normalization. It is inert lesson text, never evaluated or imported as an
executable implementation of makeCounter:

```js
function makeCounter() {
  let count = 0;
  return function increment() {
    count += 1;
    return count;
  };
}

const counter = makeCounter();
const first = counter();  // 1
const second = counter(); // 2
```

Educational reference, reviewed during planning:
[MDN JavaScript Guide: Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures).
The reference supports a function retaining access to its lexical environment,
including after an outer call returns. The lesson text below is original; no
external page is copied, loaded or embedded. Keep this reference in this document.
Do not add a source URL, source object or other persisted field to visualization data.

Exact proposed six step titles and explanations implementing the approved narrative:

1. **Call makeCounter**
   Calling makeCounter starts an outer function call with a new lexical environment.
   This diagram follows that one call and the function it will return. The count
   binding belongs to this environment; its initializer is the next stage. No
   counter result has been produced yet.
2. **Initialize the count binding**
   The statement let count = 0 initializes the count binding to 0. This is one
   mutable binding, not a separate copy for each later counter call. The outer
   function is still running at this stage.
3. **Create and return increment**
   Evaluating the function expression creates increment with access to the
   surrounding lexical environment. The return statement returns that function
   without calling it, and counter receives the function reference. The makeCounter
   call now ends and its active call-stack frame is removed. The returned function
   still has access to count, which is 0; the closure does not keep the outer call
   actively running.
4. **First counter() call: return 1**
   Calling counter invokes the returned increment function. It reads the existing
   count binding, changes count from 0 to 1, and returns 1. The constant first
   receives 1. This increment call finishes, while the same count binding remains
   accessible through the returned function.
5. **Second counter() call: return 2**
   Calling counter again invokes the same returned function. It reads count as 1,
   changes count from 1 to 2, and returns 2. The constant second receives 2; first
   remains 1. This call does not run makeCounter again or reinitialize count to 0.
6. **The same binding remains accessible**
   The makeCounter call has already returned. The function held by counter still
   has access to its surrounding lexical environment and the same count binding,
   now 2. A closure does not copy count into a new variable on each call and does
   not preserve an entire active call stack. The two results are first = 1 and
   second = 2. This lesson ends without making a third call.

The step 3 visual must highlight both function creation/return and retained
environment access. It must not imply that merely calling makeCounter increments
count, that return calls increment, or that a closure is first created only after
the outer return. Engine memory layout, garbage collection, environment-record
subtypes and all captured bindings are outside this conceptual diagram.

## Proposed authored graph and exact step references

The following graph is the concrete implementation proposal for owner review.
It uses six nodes, seven edges and six ordered steps. All IDs are stable authored
identifiers, not database IDs. Array order is the order shown in these tables.

Root fields:

- type: `ANIMATED_FLOW`; schemaVersion: `1`.
- title: `How JavaScript Closures Remember Variables`.
- textAlternative: `One call to makeCounter creates a lexical environment and
  initializes one count binding to 0. It creates and returns increment, which
  retains access to that environment after the outer call ends. The first counter
  call updates count to 1 and returns 1; the second updates the same binding to 2
  and returns 2. Highlighted nodes and labelled connections identify each authored
  stage. All nodes are a conceptual overview, not simultaneous active stack frames.`
- Omit animationConfig. F028 supplies its existing 2000ms presentation fallback;
  no autoplay, storage default or timing-contract change. Manual Pause/Next remains
  available for reading; reduced motion disables timed playback.

| Node ID | Label | Description |
| --- | --- | --- |
| make-counter | makeCounter call | The outer call creates the environment, initializes count, creates increment and returns that function. It is finished after stage 3. |
| lexical-environment | Lexical environment | The surrounding lexical environment remains accessible to increment after the outer call returns. This is not an active call-stack frame. |
| count-binding | count: same binding | One binding: initialized to 0, updated to 1 on the first counter call and to 2 on the second. These are successive values, not three variables. |
| increment-function | increment / counter | The returned function is created during makeCounter. counter references it; calling counter invokes increment with access to count. |
| first-result | First result: 1 | Stage 4 returns 1 and assigns it to first. This labelled result is part of the overview; it has not occurred in earlier stages. |
| second-result | Second result: 2 | Stage 5 returns 2 and assigns it to second. first remains 1. This labelled result has not occurred in earlier stages. |

| Edge ID | Source | Target | Label |
| --- | --- | --- | --- |
| creates-environment | make-counter | lexical-environment | Creates environment |
| contains-count | lexical-environment | count-binding | Contains count binding |
| creates-returns | make-counter | increment-function | Creates and returns function |
| retains-access | increment-function | lexical-environment | Retains lexical access |
| updates-count | increment-function | count-binding | Reads and updates same binding |
| returns-first | increment-function | first-result | First call returns 1 |
| returns-second | increment-function | second-result | Second call returns 2 |

Use the six titles/explanations above unchanged as the ordered steps. Their exact
nodeIds and edgeIds arrays are:

| Index | nodeIds | edgeIds |
| --- | --- | --- |
| 0 | make-counter, lexical-environment | creates-environment |
| 1 | lexical-environment, count-binding | contains-count |
| 2 | make-counter, increment-function, lexical-environment | creates-returns, retains-access |
| 3 | increment-function, lexical-environment, count-binding, first-result | retains-access, updates-count, returns-first |
| 4 | increment-function, lexical-environment, count-binding, second-result | retains-access, updates-count, returns-second |
| 5 | increment-function, lexical-environment, count-binding | retains-access, contains-count |

### Visual semantics and layout limits

Preserve F027's static deterministic layout. The graph does not mutate node labels,
create runtime frames, hide future nodes or move objects between zones. Visual
progression means different selected node/edge sets, non-colour indicators and
the selected authored explanation. The differing result highlights in stages 4/5
must make the 1-then-2 progression apparent. Explain the overview convention near
the code/diagram so future result nodes cannot be mistaken for already computed
values. All step explanations remain available as accessible text.

With the current layout formula, six nodes/seven edges produce a 1264 by 1072 SVG
inside the existing bounded, keyboard-scrollable region (maximum height 480px).
These are derived layout dimensions, not persisted fields. Do not require the
whole graph to fit at once or shrink text until unreadable. Retain full labels and
descriptions outside abbreviated SVG labels. Verify horizontal and vertical access,
especially later result nodes, at 1280x900, 768x900 and 390x900. Determine scrolling
requirements from actual scrollWidth/clientWidth and scrollHeight/clientHeight;
mobile horizontal overflow must be exercised. No page-level overflow or hidden
content workaround. A genuine readability/scrolling defect requires owner review,
not a renderer or CSS change outside scope.

## Contract and implementation responsibilities

Proposed exports in javascript-closure.ts:

- `javascriptClosureLesson`: the authored VisualizationData projection above.
- `javascriptClosureCode`: the exact original code as a plain string for display.

The separate string is local presentation content, not a new graph field, persisted
schema or API contract. Pass only the graph projection to the existing player.
Display code using escaped React text in a labelled, contained pre/code block in
the existing fixture file; no Markdown extension, executable playground or new CSS
file. Preserve whitespace and allow keyboard access to overflowing code.

Reuse parseVisualization at the existing runtime boundary. Require actual strings,
arrays and enum/number types; reject unknown fields, coercion and malformed data.
Preserve F026 limits: 50 nodes, 100 edges/steps, IDs 64 characters, titles/labels
120, overall alternative 4000, node description 1000, step explanation 2000 and
262144 UTF-8 bytes for the authored projection. Node/edge IDs must be unique within
their namespaces, all endpoints/references valid and no duplicate references per
step. Six steps remain in exact order. Do not invent output/state/source fields,
ObjectIds, status, audit metadata or persisted animation defaults.

This is F026-compatible authored data, not a complete saved Mongoose document.
No database record is created, approved, published or attached to a Concept.
Frontend validation and content tests do not verify Admin identity or publication.
No backend responsibility, endpoint, index, migration or database test is introduced.

## Fixture integration and security

Retain `/test/visualizations`, the existing request-time server-only
DEEPLEARNER_BROWSER_FIXTURE=1 guard, dynamic rendering, default OFF, loopback binding
and production-build isolation. page.tsx is outside the seven-file change scope.
No NEXT_PUBLIC flag, query/header override, auth bypass or real user data.

Add one labelled `Load closure lesson` button to the existing fixture-client.tsx.
Keep the original synthetic graph as the initial case and preserve every F028
button, label, case and assertion. Loading the lesson sets the reviewed immutable
data and a distinct opaque synthetic visualization key; it begins in overview via
the unchanged player. Do not reset to overview by bypassing the controller.
Retain the synthetic account key and existing identity/reset controls. Only show
the lesson code/overview note when the authored lesson is selected; existing
synthetic tests must not acquire lesson-specific content accidentally.

The fixture remains a gated test/review surface, not a student lesson route or
Admin preview product. AuthProvider does not imply an AuthBoundary refresh:
readiness must use the route, lesson title, mounted SVG and controls. Reject
unexpected auth/API/external requests. No source fetching, remote media, eval,
Function construction, dynamic execution, HTML injection or arbitrary SVG inputs.
Do not execute the makeCounter string even in tests to manufacture expected results.

## Exact seven-file implementation inventory

| Path | Proposed action |
| --- | --- |
| docs/features/F029-first-real-visual-lesson.md | Create plan now; approved status/evidence updates later |
| docs/DEVELOPMENT_ROADMAP.md | Later modify F029-only status/evidence |
| apps/web/src/lib/visualizations/lessons/javascript-closure.ts | Create authored graph and inert example string |
| apps/web/tests/visualization-lesson.test.ts | Create focused content/contract/render/playback tests |
| apps/web/src/app/(test)/test/visualizations/fixture-client.tsx | Modify to select/display this lesson while preserving synthetic cases |
| tests/browser/visualization-lesson.spec.ts | Create mounted lesson acceptance |
| playwright.f024.config.ts | Modify testMatch only to include the new specification |

Four new files including this plan; three modified existing files. No model,
renderer, controller, source API, fixture server guard, dependency or other browser
specification changes. Keep existing config timeouts, flag forwarding, server
ownership, production build/start command and all loopback settings unchanged.

## Acceptance and efficient verification plan

Implementation/offline gate, separately authorized:

1. Validate the exact lesson with the existing parser. Assert strict projection,
   six/seven/six counts, exact IDs/endpoints, all six ordered reference sets and
   current limits. Include malformed cloned inputs without modifying the export.
2. Assert original code text, step titles/order, creation-before-return explanation,
   one shared count binding and exact first=1/second=2 narrative. Do not rely on
   absence of words such as "copy" because accurate negative explanations use them.
   These assertions protect the reviewed content; they are not a language interpreter
   or independent proof of educational correctness. Owner editorial review remains
   required for any later narrative or graph alteration.
3. Render through F027 and exercise F028 using existing test patterns: overview,
   all six selections, distinct result highlights, full labels/explanations,
   timing completion/replay, reset and safe replacement. No new timer/test package.
4. Confirm plain-text escaping, no authored execution/network dependency and
   compatibility with reduced motion and existing accessible controls. Reuse
   relevant passing regressions; run necessary build/lint/typecheck/format/scope
   checks without redundant full-suite reruns during routine development.

Mounted gate, separately authorized:

- Select the lesson through its real fixture button. Verify heading/SVG readiness,
  overview/no autoplay and every ordered stage, including function creation/return,
  count transitions and first/second result highlights. Do not wait for auth refresh.
- Verify Previous/Next, Play/Pause/Reset/Replay, final dwell/completion, focus
  retention and reset on data/identity replacement. Use existing clock controls
  for exact boundaries rather than fixed sleeps or longer assertions; distinguish
  mocked timing from any bounded real-time observation.
- Exercise 1280/768/390px: readable full text, contained graph/code scrolling,
  no document overflow, keyboard navigation, visible focus and touch targets.
- Reduced motion allows manual traversal and disables timed playback. Preserve
  static rendering and non-colour selection indicators; do not claim exhaustive
  assistive-technology compatibility from DOM assertions alone.
- Assert no unexpected auth, catalog, source or external requests and no page
  exceptions or executable markup. Preserve same-build flag-off HTML 404 and
  absence of lesson payload in valid disabled RSC responses; acknowledge Next.js
  may carry a not-found digest in an HTTP 200 RSC transport. Reuse applicable
  retained isolation evidence, and separately authorize any required live recheck.

Before final approval, discover and run all applicable browser scenarios once,
including the existing 76 distinct baseline scenarios and the new lesson scenarios.
Use existing production-built configurations and **segmented invocations**: F024,
F028 and F029 specifications run independently so F024's afterAll cannot close a
worker-scoped browser reused by later files. F022/F025, F023 and smoke retain their
existing configurations. Report SEGMENTED REGRESSION PASS only when every required
distinct scenario passes; never label it a clean combined-run PASS.

Zero retries, maximum browser execution 25 minutes and initial diagnosis 5 minutes.
No timeout increases, fixed sleeps, weakened assertions, automatic fixes or reruns.
Retain evidence under .cache. Verify ownership before termination using PID plus
creation time and Job membership where available; close only owned processes,
verify empty jobs/ports and report forced Windows teardown separately.
No MongoDB integration applies to this non-persistent, fixture-only feature.

## Exclusions, retained limitations and next gate

No visualization API, production Concept tab/attachment, Admin authoring/type
selection/preview, publishing workflow, persistence, demo-data updates, AI,
JavaScript execution, animated geometry, Speed control, progress or dependencies.
F026-F028 contracts and all earlier approvals remain unchanged. Future persisted
delivery requires separately approved references/provenance, visibility, source
policy, authorization, lifecycle and endpoint contracts; this plan grants none.

Retain F024's worker-browser lifecycle conflict, lack of a clean combined browser
run, exhaustive screen-reader and real background-throttling gaps, graceful Windows
application-shutdown limitations and unproven historical baseline-process causality.
No production deployment or end-to-end student visualization acceptance is implied.

No contract conflict was identified. Owner approved the concrete node/edge labels,
exact step text, highlight mapping, omitted animationConfig/fallback, code export
and fixture selection details above with the seven-file implementation boundary.

## Implementation and offline verification - 2026-10-16

- Implemented the approved 6-node, 7-edge, 6-stage authored lesson. Exact graph,
  explanations, original code and ordered highlights match this reviewed document.
  count changes from 0 to 1 to 2 in the narrative; the displayed results are 1 then
  2. No lesson JavaScript is executed, fetched or treated as persistence metadata.
- Existing parseVisualization, renderer and player are unchanged. The fixture
  starts with the original synthetic graph; the explicit lesson selector supplies
  a distinct synthetic visualization key and shows inert code only for that lesson.
  Existing synthetic controls and browser specifications remain unchanged.
- Focused lesson tests: **9/9 PASS**; existing web regressions including these
  tests: **165/165 PASS**. Real static React rendering verifies all six exact
  highlight sets, full text and escaping. The controller check covers fallback
  intervals, final completion, explicit replay, reset/stale-callback cancellation
  and reduced-motion manual stepping. No mounted browser claims from these tests.
- Workspace build, lint, TypeScript and formatting: **PASS**. Prepared browser
  specification/configuration strict TypeScript: **PASS**. Initial test-file regex
  lint and strict indexing errors were corrected; final focused 9/9 and static
  checks passed afterward. The earlier sandbox tsx user-information failure was
  resolved by running the same authorized offline checks outside that restriction.
- Seven browser scenarios prepared: three responsive six-stage/keyboard cases,
  timed playback, reduced motion, identity/synthetic replacement and inert/no-network
  behavior. **NOT_RUN**. Existing 76-scenario baseline plus seven yields a proposed
  83 distinct scenarios, subject to runner discovery at the separately approved gate.
  No assertion timeout, retry, server settings or F024/F028 specification changed.
- Request-time server guard remains unchanged outside scope. Static guard and
  fixture checks PASS; production build still marks /test/visualizations dynamic.
  Runtime isolation with the new lesson payload and mounted F029 behavior remain
  NOT_VERIFIED. Retained F028 isolation evidence is not a new F029 HTTP/RSC run.
- Source hashes confirm exactly the seven approved files changed, with no removals
  or dependency changes. No unsafe execution/fetch/HTML injection or credential
  patterns found in the lesson and fixture; authored text remains inert. Roadmap
  and feature document retain UTF-8 without BOM and LF endings.

Detailed offline logs: `.cache/f029-offline-2026-10-16T06-46-17-917Z/`.
No browser, database, persistent application service or Git operation was performed.
No unresolved offline defect remains. Educational assertions protect approved text;
they do not constitute an independent JavaScript interpreter or editorial approval
of future changes. Preserve the segmented-regression and accessibility limitations
above. F001-F028 remain APPROVED_COMPLETE; F030 remains NOT_STARTED.

The pending browser/isolation statements above record the offline-stage checkpoint;
the authorized final verification below supersedes those pending results.

## Final verification and acceptance review - 2026-10-16

- **Same-build fixture isolation PASS.** Build `LH1g3rL5G5P16SrG3kZJY`
  and its retained file hashes were unchanged across absent/enabled/absent flag
  checks. Disabled HTML returned HTTP 404 without fixture or lesson content.
  Valid disabled RSC responses returned HTTP 200 transport with the explicit
  `NEXT_HTTP_ERROR_FALLBACK;404` digest and no fixture reference or lesson content.
  Enabled HTML/RSC returned HTTP 200 with the synthetic fixture available. No
  redirects were used as evidence. The server-only request-time guard is unchanged;
  no client flag, sensitive data or external fetching was introduced.
- **83/83 SEGMENTED REGRESSION PASS:** F022/F025 27/27, F023 16/16, F024
  19/19, F028 13/13, F029 7/7 and smoke 1/1. Six separate invocations; zero
  retries, failures, flaky results, skips or unrun scenarios. Every runner exited
  0. Total browser-stage wall time, including builds and cleanup: **367.33 seconds**.
  F024, F028 and F029 ran independently; this is not a clean combined-run PASS.
- Mounted Chrome verifies the approved six nodes, seven edges, six ordered stages
  and exact highlights. The narrative distinguishes function creation, outer
  return and continued access to the same binding, with results 1 then 2. Original
  code remains inert. Play/Pause, Previous/Next, Reset/Replay, final dwell,
  identity replacement and reduced-motion manual stepping passed. Exact playback
  intervals used Playwright's clock; real background throttling is not established.
- At 1280/768/390px, keyboard focus, full text alternatives, contained horizontal
  and vertical graph scrolling, mobile touch targets and absence of document
  overflow passed. Unexpected auth/API/external requests and page exceptions were
  absent. Existing synthetic fixture scenarios also passed. Automated assertions
  do not establish exhaustive screen-reader compatibility.
- **Cleanup PASS.** Owned runner identities and descendants were tracked with
  PID/creation time and Job membership. All owned jobs were empty and required
  ports released after each invocation. Isolation servers exited through SIGTERM
  (143), without forced cleanup. Playwright's existing Windows server teardown
  uses forced process-tree termination; no additional outer Job termination was
  required. No unauthorized termination was established. Historical unrelated
  baseline-process causality and graceful application shutdown remain unresolved.
- **Final review PASS.** Hash comparison confirms exactly the approved seven-file
  feature boundary and no source/configuration changes during verification. F026
  validation, F027 renderer and F028 player/guard remain unchanged. Reused focused
  9/9, web 165/165 and passing static evidence; no offline or MongoDB reruns.
  No new dependencies, APIs, persisted fields, executable lesson content or scope
  expansion. PRD section 96's student Concept integration and Admin
  preview/approval/publishing remain outstanding separately approved work.

Evidence: `.cache/playwright/results/f029-final-2026-10-16T06-56-29-082Z/`
contains discovery, same-build HTML/RSC checks, process identities, per-suite JSON
reports/logs and `browser-summary.json`. No Git or database operations performed.

**Owner completion approval - 2026-10-16:** F029 is APPROVED_COMPLETE. The owner
authorized its seven-file commit and push, retaining all verification evidence,
exclusions and limitations above. F001-F028 approvals are preserved and F030
remains NOT_STARTED. F030 planning requires separate owner approval; no production
deployment or deferred student/Admin integration is authorized.

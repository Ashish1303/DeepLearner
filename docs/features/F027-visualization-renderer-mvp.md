# F027 - Visualization Renderer MVP

**Status:** APPROVED_COMPLETE
**Dependency:** F026 APPROVED_COMPLETE.
**Authorization:** Owner approved implementation, offline verification and one full
existing Playwright regression with conditional final review/status transition.
Default heading level is 3, overriding the initial proposal of 2. Additional browser
execution remains separately gated; no mounted integration surface is authorized.
F001-F026 approvals remain unchanged; F028 is outside this feature.

## Sources and scope boundaries

- [Roadmap](../DEVELOPMENT_ROADMAP.md): F027 Visualization Renderer MVP; F028 owns
  controls and F029 the first real visual lesson.
- [PRD](../PRD.md), sections 16-19 and 96: structured visual learning, accessible
  explanations, Admin preview and later playback. This renderer-only increment
  does not fulfill all of section 96.
- [Architecture](../SYSTEM_ARCHITECTURE.md), section 14 and ADR-008: structured
  data interpreted by trusted renderers, never generated executable UI.
- [Database Design](../DATABASE_DESIGN.md) and
  [F026](F026-visualization-data-model.md): ANIMATED_FLOW/schemaVersion 1, exact
  authored graph shapes, limits and validation boundaries.
- [API Design](../API_DESIGN.md): no visualization retrieval/authoring API exists.
  F027 adds none and defines no persisted or public API fields.
- Existing Concept components, CSS Modules, Zod contracts and static React
  rendering tests provide reusable conventions without modifying those files.
- Reviewed student Concept-learning Stitch screenshot and code.html: framed
  diagram, step explanation banner, restrained emphasis and readable content.
  Its simulation controls, runtime zones, progress and playground are references
  for later work, not requirements to copy into F027. Do not copy CDN scripts,
  generated event handlers or invented runtime-specific structures.

Approved architecture: native React + SVG; externally selected step; deterministic
graph placement; nodes, labelled edges, highlights and persistent explanations;
cycles/self-loops/parallel edges; non-colour indicators; contained overflow;
static reduced-motion presentation; inert authored text; no fetching or dependencies.

**Decision convention:** Renderer choices below were approved by the owner for implementation.
They do not amend the F026 database contract.

## Approved public component contract

**APPROVED:** One public boundary, VisualizationRenderer, with these props:

```ts
type VisualizationRendererProps = {
  data: unknown;
  selectedStepIndex?: number | null;
  headingLevel?: 2 | 3 | 4;
};
```

- data is validated on entry, even if its caller has a TypeScript type. The
  successful parser returns a fresh, canonical, typed authored payload.
- selectedStepIndex is a zero-based actual finite integer within steps. Explicit
  0 means the first step. Omitted/undefined/null means an overview with no selected
  step or highlights; never silently select step zero or clamp a bad index.
- Negative, fractional, nonfinite, out-of-range or coerced selection is invalid.
  Changing data revalidates the selection against the new payload. No retained
  selection, timers, automatic progression, callback or fetch exists.
- headingLevel defaults to 3; explicitly invalid values fail safely. The title
  uses that level, sections use its successor, and step titles use ordinary text
  inside the ordered explanation list. Never generate an h1 or skipped levels.
- No arbitrary attributes, style/HTML/SVG props, renderer names, event handlers,
  URL inputs or authored DOM IDs are accepted through data. No generic prop spread.
- The internal AnimatedFlow component receives only validated data, validated
  selection and computed geometry. It is not an alternative unvalidated entry.

**APPROVED input projection:** Accept exactly F026's authored rendering projection:
type, schemaVersion, title, textAlternative, nodes, edges, steps and optional
animationConfig. This is a component input, not a new API DTO. A future integration
must explicitly project a stored document to it. Root _id, ObjectIds, status,
provenance, timestamps and __v are not renderer input; reject unexpected keys
rather than silently passing database documents through. The renderer cannot
establish publication eligibility, ancestry or Admin authority.

## Runtime validation and F026 alignment

Use existing Zod plus small local guards in contracts.ts; no Mongoose/backend
imports into the web bundle and no shared-package changes.

| Authored field | Required behavior inherited from F026 |
| --- | --- |
| type | Actual string ANIMATED_FLOW only |
| schemaVersion | Actual integer 1 only |
| title | Actual string, trimmed nonblank, 1-120 UTF-16 code units |
| textAlternative | Actual string, trimmed nonblank, 1-4000 |
| nodes | Explicit dense array, 1-50 entries |
| node | id; label trimmed 1-120; optional description trimmed 1-1000 |
| edges | Explicit dense array, 0-100 entries |
| edge | id, source, target; label trimmed 1-120 |
| steps | Explicit dense ordered array, 1-100 entries |
| step | title trimmed 1-120; explanation trimmed 1-2000; nodeIds 1-50; edgeIds 0-100 |
| animationConfig | Absent stays absent; if present, only required stepDurationMs and autoplay |
| stepDurationMs | Actual safe integer 100-10000 inclusive |
| autoplay | Actual Boolean false, explicitly supplied; never defaulted |

IDs and references fully match `[a-z][a-z0-9-]{0,63}` without trimming. Node IDs and
edge IDs are independently unique; the two namespaces may overlap. Every endpoint
and step reference must resolve locally. Reject repeated references within a step.
Do not infer nodes, remove bad edges, reorder content or repair references. Cycles,
self-loops, parallel edges and unused nodes remain valid. A highlighted edge does
not imply its endpoints are highlighted unless the selected step also names them.

**APPROVED normalization:** Trim the same text fields as F026 into a fresh object,
without mutating caller data. Require explicit schemaVersion 1 at this frontend
boundary; F026's persistence default does not justify guessing an input version.
Optional description/config may be absent or undefined as in F026's JavaScript
validation path, but not null, blank or malformed. No type coercion or additional
renderer defaults inside the data are permitted.

Before transforming/serializing input, reject non-plain containers, accessors,
symbol/unknown/prototype-related keys, functions, sparse arrays and wrong primitive
types. Check array counts and field lengths before mapping or copying large data.
Use descriptor inspection so ordinary accessor inputs are not evaluated. This is
a serialized-data boundary, not a sandbox for hostile JavaScript Proxy objects;
unexpected validation exceptions must still produce the safe invalid state.

Enforce F026's 262144-byte UTF-8 JSON limit on the normalized authored projection,
in canonical field order, omitting undefined optional properties. Use native
TextEncoder and JSON serialization of validated fresh data, never raw inputs with
custom toJSON. Boundary tests must match F026 for Unicode, escapes and one byte over.
Unknown versions/types fail safely; do not downgrade or interpret them as v1.

## Selection, empty and invalid states

**APPROVED:** null/undefined data displays "No visualization available." No SVG or
fabricated sample is rendered. An empty object or graph with no nodes/steps is
invalid, not an approved empty graph: F026 requires at least one of each. Zero
edges is valid. Missing/invalid references, bad selection, unsupported type/version
or malformed data display "Visualization unavailable." Render no partial diagram
or authored fragment from rejected input, expose no stack/raw validation error and
do not fetch or log the payload. There is no loading/Retry workflow without a client.

Valid data always displays the title, complete textAlternative, complete node and
edge descriptions, and ordered step titles/explanations. Overview states that no
step is selected. Selection adds "Step X of Y", marks the corresponding explanation
and highlights exactly its nodeIds/edgeIds. Returning to null clears highlights.
Updates are immediate and static; there are no interpolated transitions or implied
code execution. animationConfig is validated but does not schedule motion.

## Deterministic layout proposal

**APPROVED MVP geometry:** Use a pure function in layout.ts with no DOM measurement,
force simulation, random seed, viewport-dependent reordering or external layout
library. Keep authored array order and independent of selected step.

1. Lay nodes vertically: margin 32 units, node width 256, height 128, vertical gap
   48. Node i begins at x=32, y=32+176*i. This conservative layout supports arbitrary
   graph connectivity without pretending that array order is an execution engine.
2. Allocate one right-side routing lane per edge in authored order: x=352+128*j.
   Different edge IDs always get separate lanes, including parallel/reverse edges.
3. Route ordinary directed edges from the source's right centre to their lane,
   vertically to the target centre, and back to the target boundary. Use trusted
   SVG paths/arrow markers; draw edges behind node cards. Self-loops use two distinct
   right-side anchors at centre y-24 and y+24 and their own lane. Cycles require no
   special traversal or rejection. Crossings are allowed and are not graph nodes.
4. Put each edge's label badge beside its lane at the vertical midpoint; self-loop
   labels use the loop midpoint. Number nodes/edges by their authored index for
   association with the complete text alternative. Keep direction arrowheads clear.
5. View-box height is 64 + 128*N + 48*(N-1), at most 8816. Width is 320 with no
   edges, otherwise 496 + 128*(E-1), at most 13168. Include stroke/marker/label
   padding within these bounds; do not persist any coordinates or labels.

**APPROVED label overflow:** Node badges show an ordinal plus up to two visual
lines of 12 Unicode code points from the authored label; edge badges show an ordinal
plus up to 10 code points. Add an ellipsis when shortened. Use fixed trusted text
styles and node-local clip paths to contain unusually wide glyphs, never interpolate
author input into SVG geometry. Full labels remain persistently readable in the
HTML node/edge list, with overflow-wrap:anywhere; hover/tooltips are not the only
way to obtain them. Full node descriptions are in that list, not squeezed into SVG.
Use React-escaped text for every label and explanation.

These are approved presentation limits, not new data-validation limits. Dense
100-edge graphs can require substantial internal scrolling and have crossing
connectors. The complete labelled HTML representation is the dependable reading
alternative. This MVP does not claim optimal graph layout or overlap-free routing.
The owner approved this simplicity/readability tradeoff and visual abbreviation;
a different layout must not be silently substituted.

## Accessibility, responsiveness and security

**APPROVED:** A labelled section contains a keyboard-focusable diagram scroll
region, an SVG with role=img and unique title/description associations, and ordinary
semantic HTML explanations. SVG descriptions use the visualization title and
textAlternative; complete structured node/edge/step information remains outside
the SVG so it does not depend on per-node screen-reader SVG support.

Use React useId with trusted suffixes/ordinals for markers, clips and ARIA IDs;
never use authored IDs directly as DOM IDs, CSS selectors or fragment URLs.
Multiple renderer instances must not collide, including server-rendered output.
Use visual outline/weight plus a visible "Selected" indicator, not colour alone.
Mark the selected ordered step with aria-current=step. Do not move keyboard focus
on data/selection changes; no automatic live announcement of the whole diagram.

The scroll region has tabIndex=0, an accessible name and a visible focus ring.
Native keyboard scrolling is allowed; do not intercept arrow keys or create a
keyboard trap. Nodes/edges are not buttons and do not enter the tab order. No
playback, selection controls or disabled imitation controls are shown.

At 1280, 768 and 390px, the component stays within its parent using min-width:0,
max-width:100% and contained overflow:auto. Proposed diagram viewport max-height
480px; retain native readable SVG units rather than shrinking a large graph into
illegible text. All full-text alternatives wrap in normal document flow. Preserve
visible focus; do not hide document overflow to conceal layout defects.

Render no animation under any motion preference, including reduced motion. No
timers, autoplay, panning/zoom engine, SMIL, CSS animation or smooth-scrolling side
effects. Ordinary text targets 4.5:1 contrast and meaningful graphical/focus
indicators 3:1 using existing design tokens; mounted visual verification remains
separately gated, not established by checking CSS declarations alone.

Whitelist trusted React/SVG elements/attributes. No dangerouslySetInnerHTML,
foreignObject, authored SVG/HTML, Markdown interpretation, dynamic code, script,
image, external href, event attributes or fetched resources. Harmless teaching
strings resembling JavaScript/HTML remain inert escaped text, not rejected through
keyword filters. Only trusted local marker/clip references may use url(#...).

Validation and layout work is bounded by 50 nodes, 100 edges, 100 steps and at most
15000 total step references, with the payload cap additionally constraining input.
Use sets/maps for references and O(N+E+total references) processing, finite geometry
and bounded DOM output. Do not rely solely on memoization for correctness or mutate
cached input. Assume caller-provided immutable snapshots; no hidden mutable store.

## Exact ten-file implementation boundary

| File | Planned action |
| --- | --- |
| docs/features/F027-visualization-renderer-mvp.md | New plan; later approved evidence/status |
| docs/DEVELOPMENT_ROADMAP.md | Later F027-only status/evidence update |
| apps/web/src/lib/visualizations/contracts.ts | New runtime schema, types and safe parsing |
| apps/web/src/lib/visualizations/layout.ts | New pure deterministic geometry |
| apps/web/src/components/visualizations/visualization-renderer.tsx | New validated public boundary and safe states |
| apps/web/src/components/visualizations/animated-flow.tsx | New internal SVG/text presentation |
| apps/web/src/components/visualizations/visualization.module.css | New scoped styling and contained scrolling |
| apps/web/tests/visualization-contracts.test.ts | New focused contract/security tests |
| apps/web/tests/visualization-layout.test.ts | New deterministic geometry tests |
| apps/web/tests/visualization-rendering.test.ts | New static rendering/accessibility tests |

Nine new files including this plan, one modified roadmap. The owner's escaped
animated-flow\.tsx notation is interpreted as animated-flow.tsx, matching the
previously proposed inventory; no extra directory or file is intended. No Concept,
API/model, shared-package, browser-spec, configuration or dependency files change.

## Verification and acceptance gates

Implementation and focused offline verification are now authorized.
During implementation, run focused tests using existing Node/tsx/Zod and static
React rendering conventions; no new loader or browser harness files.

1. Validate minimal/full F026-compatible projections, exact scalar/array/ID bounds,
   normalization without mutation, explicit false autoplay/absent config, explicit
   schemaVersion, UTF-8 size limits, unknown/type-coerced/accessor inputs and local
   graph-reference integrity. Exercise rejected persisted-document metadata at the
   renderer boundary so its projection requirement is visible.
2. Verify deterministic coordinates/path endpoints, finite bounded geometry,
   authored ordering, zero edges, cycles, self-loops, parallel/reverse edges, maximum
   graph sizes and selection-independent layout. Check arrow direction and label
   allocation by geometry, not brittle full SVG snapshot strings.
3. Render overview and valid selected steps; check exact highlights, complete
   escaped descriptions, invalid/missing safe states, Unicode/long labels, logical
   headings, ARIA references, instance-unique IDs, non-colour indicators, focusable
   scroll container and absence of interactive/executable/external markup. Static
   handler/markup checks do not prove mounted focus, scrolling or screen-reader UX.
4. Run relevant existing web regressions, build/lint/typecheck/format and exact
   scope/dependency/security review. Reuse unchanged API/F026 evidence; no MongoDB
   integration is applicable to this frontend-only component scope.
5. Separately authorize one bounded full existing Playwright regression before
   final approval: currently F022/F025 27, F023 16, F024 19 and smoke 1 (63 total),
   rediscover counts. Reuse existing production-build/start configurations and
   loopback mocks, zero retries, unchanged assertions/timeouts, at most 25 minutes
   browser execution and five minutes initial diagnosis. Retain evidence in .cache;
   no automatic fixes/reruns. Verify owned-process cleanup and report forced Windows
   Next.js teardown separately.

**Mounted renderer limitation:** None of those 63 existing scenarios mounts this
new renderer. They verify existing functionality only. This scope has no approved
student/Admin route, preview or mounted fixture surface; do not invent one or claim
end-to-end renderer, actual responsive geometry, keyboard scrolling, contrast or
assistive-technology acceptance. Those observations remain NOT_VERIFIED until the
owner approves a mounted integration surface and its focused acceptance scope.
No renderer browser specification is included in these ten files.

Feature acceptance for this renderer-only gate means the approved component and
strict data boundary exist, bounded static/layout tests pass, existing functionality
is preserved, no API/database/dependency scope expands, and all unmounted checks
are explicitly recorded. Owner must explicitly accept that limited gate or approve
additional mounted verification before any completion claim.

## Exclusions, retained limitations and next approval

No visualization API/client, Concept-page/tab integration, Admin selection/preview,
publishing/visibility service, playback controls, AI, real authored lessons, progress,
assets, migrations, demo changes, database connections or dependency additions.
F028 controls and F029 content remain separate. Renderer labels/geometry are purely
derived presentation; the F026 stored fields, indexes and validation do not change.

Preserve existing limitations: mocked browsers versus live backend integration;
unproven internal generation-check execution after cancellation; reference existence,
ancestry and Admin authority not established by Mongoose refs; async validated-save
boundaries versus raw/query writes; graceful Windows Next.js shutdown; development
cold-route latency; prior F020 release deferrals, live dependency failure/Atlas and
local Admin login/persistence evidence where still unverified. Historical process
continuity and unexplained unrelated baseline exits remain unverified observations,
not proof of test-caused termination or proof of historical safety. No deployment.

**Owner decisions:** Approved renderer projection, explicit version, external selection,
safe invalid state, heading default 3, deterministic lane layout and complete text
alternatives. No implementation contract issues remain.

**Next gate:** Separately approved F028 planning. F027 development closure and
feature-only Git delivery are explicitly owner-authorized; no production deployment.
Mounted F027 geometry, focus and assistive-technology observations remain
NOT_VERIFIED without an approved surface.

## Implementation and offline evidence - 2026-10-15

Implemented the approved ten-file scope with headingLevel default 3. Native SVG
uses bounded authored-order geometry, directed edge lanes and full HTML text
alternatives. Strict frontend validation preserves the F026 authored contract,
including explicit false autoplay, graph integrity and the 262144-byte boundary.
No persistence/API contracts, dependencies, routes or existing components changed.

- Focused F027: **23/23 PASS** (11 contract, 5 layout, 7 static rendering tests).
- Complete existing web runner: **135/135 PASS**, including those 23 F027 tests
  and 112 existing regression tests. Final focused run after TypeScript fixture
  annotation corrections: **23/23 PASS**; no production behavior changed afterward.
- Full workspace build, lint, TypeScript and repository formatting: **PASS**.
  Documentation is excluded by the existing formatter policy and was reviewed directly.
- Scope: baseline SHA-256 comparison confirmed only the two approved documents
  changed and eight approved source/test files were created; no Git commands used.
- Security/static accessibility: escaped teaching text, no executable/external
  markup, validated local marker references, instance-unique ARIA IDs, exact
  selection, heading hierarchy, non-colour indicators and declared colour contrast
  checks PASS. Bounded layout and Unicode abbreviation tests PASS.
- First sandboxed test invocation failed before tests due to Windows user-info
  access. The authorized offline runner succeeded outside that sandbox. An initial
  security-test regex incorrectly matched escaped text; it was corrected to check
  actual markup attributes. Strict fixture indexing was corrected for TypeScript.
- During the offline stage, no MongoDB, Playwright, service startup, demo route or
  Git operation was executed. Full browser regression was then separately gated.
  Mounted F027
  responsive geometry, scrolling, focus and assistive-technology behavior remain
  NOT_VERIFIED; static markup/CSS checks do not establish end-to-end acceptance.

The offline stage retained IN_PROGRESS. F001-F026 approvals and all retained
release/tooling limitations remain unchanged. F028 remains NOT_STARTED and unauthorized.

## Final regression and renderer-only acceptance review - 2026-10-15

Owner-authorized full browser regression: **63/63 PASS**, zero retries, zero
failures/skips/not-run scenarios and all four runner exit codes 0:

- F022/F025: **27/27 PASS**.
- F023: **16/16 PASS**.
- F024: **19/19 PASS**.
- Root smoke: **1/1 PASS**.

Total browser-stage wall time including production builds, process monitoring and
cleanup: **317.595 seconds (5m 18s)**, within the 25-minute budget. No assertion,
timeout, browser specification or configuration changed. No offline or MongoDB
tests were repeated. The initial shell invocation could not compile the existing
ownership helper under Windows PowerShell 5 and launched no tests/services; explicit
PowerShell 7 standard-input invocation then ran each suite exactly once.

Evidence: `.cache/playwright/results/f027-final-2026-10-15-16-00-26-UTC/` contains
discovery, JSON reports, runner/server logs, PID/creation-time/parent/executable
observations, per-suite cleanup records and summary.json. Existing native Job
Objects owned the runner and its descendants from creation. All four jobs emptied;
zero owned processes remained and ports 3000/4000/5173/27018 were free after each
suite. No additional owner ForceStop was required. Playwright's existing Windows
web-server termination uses forced process-tree cleanup; graceful Next.js shutdown
is not established. No unrelated-process termination or ownership incident was
observed. Historical unrelated-process continuity remains unverified.

**Final review: PASS within the approved renderer-only acceptance boundary.**
The exact ten-file scope, strict F026 authored projection and byte/graph bounds,
ANIMATED_FLOW v1, external selection/overview, invalid states, deterministic cycles,
self-loops/parallel edges, full explanations, labelled SVG, non-colour indicators,
static reduced-motion and escaped inert content were reviewed against the plan
and retained 23/23 focused and 135/135 web evidence. Repository source hashes were
unchanged throughout browser execution. No API, database, dependency or scope
expansion was found; only this feature document and roadmap receive review updates.

The 63 browser scenarios verify existing functionality and **do not mount F027**.
Mounted responsive layout, keyboard scrolling, focus and assistive-technology
behavior remain **NOT_VERIFIED**. No end-to-end visualization acceptance is claimed.
No MongoDB operation, persistent development startup, Git operation or deployment
occurred. All prior release/tooling limitations remain retained.

F027 is **APPROVED_COMPLETE** by explicit owner approval. All verification evidence
and mounted-renderer limitations above remain unchanged. F028 remains NOT_STARTED.

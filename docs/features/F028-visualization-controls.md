# F028 - Visualization Controls

**Status:** APPROVED_COMPLETE
**Dependencies:** F027 Visualization Renderer MVP and its F026 authored-data contract,
both APPROVED_COMPLETE.
**Authorization:** Owner approved the exact twelve-file implementation and offline
verification. Browser execution and Git delivery require separate owner approval.
F001-F027 approvals are preserved. F029 is not authorized.

## Sources, reuse and boundaries

- DEVELOPMENT_ROADMAP.md assigns controls to F028 and the first real visual lesson
  to F029. Neither a visualization read API nor Concept-page integration exists.
- PRD sections 17, 74 and 96 and SYSTEM_ARCHITECTURE.md section 14 require appropriate
  playback, accessible alternatives and trusted rendering of structured data.
- DATABASE_DESIGN.md, API_DESIGN.md and the approved F026 plan define unchanged
  ANIMATED_FLOW/schemaVersion 1 data, strict graph validation and optional timing.
- F027 supplies parseVisualization, VisualizationRenderer, deterministic SVG,
  overview/selection semantics, inert text and complete HTML alternatives.
- Reuse existing React controller/subscription and CSS Module conventions, Node/tsx
  tests and production-built Next.js/Chrome Playwright configurations.
- The reviewed Concept-learning Stitch screenshot/code.html provides a compact
  previous/play/next/replay control strip and persistent step narrative. Rebuild
  semantic controls; do not copy CDN scripts, simulation logic or generated HTML.

No F026/F027 implementation or persisted/API contract changes. F028 advances
authored steps; it does not execute JavaScript, animate graph geometry, verify
lesson correctness or introduce account authorization. Speed is explicitly deferred
despite its conditional PRD/design inclusion. Full PRD section 96 remains incomplete.

## Component architecture and approved public props

The following approved API details are presentation props, not persisted fields:

```ts
type VisualizationPlayerProps = {
  data: unknown;
  visualizationKey: string;
  accountKey: string;
  headingLevel?: 2 | 3 | 4; // default 3, unchanged F027 semantics
};
```

Keys are required nonblank opaque identity strings supplied by the future caller;
they are not credentials, DOM IDs, database lookups or proof of authorization. Do
not log or render them. Distinguish the key pair without concatenation collisions.
Changes to either key reset the player before old selection/content can be shown.
Treat a replacement immutable data snapshot as a new playback session even when
keys match; do not depend on callers mutating objects in place.

VisualizationPlayer validates with F027, owns a controller instance per identity/data
snapshot, subscribes using existing React patterns, handles visibility/motion
subscriptions and composes VisualizationControls with the unchanged renderer.
Pass only validated data, selectedStepIndex and headingLevel to F027. No fetching.
The controller owns transitions/timers; controls only present state and dispatch
actions. Keep these responsibilities in the three approved source files, with no
new hook, shared package, global store or renderer changes.

Missing data uses F027's missing state; malformed payloads use its unavailable
state. All playback buttons are disabled for invalid data/identity/heading inputs.
Empty nodes or steps remain invalid under F026; zero edges remains valid. Do not
repair unknown references, coerce types or manufacture steps.

## Approved state machine

State comprises selectedStepIndex (null or an in-range zero-based index), mode
(overview, paused, playing, completed or unavailable), timing eligibility and a
generation token. Initial/server-rendered state is overview with no timer.
Playback eligibility requires valid data, a mounted visible document and a known
non-reduced-motion preference. Never start implicitly after hydration or updates.

| Action/event | Result |
| --- | --- |
| Play from overview | Select 0 immediately; start its interval |
| Next from overview | Select 0, paused; no timer |
| Play from paused | Preserve selection and resume timing |
| Pause | Cancel/invalidate timer; preserve selection |
| Previous at step 0 | Pause and return to overview |
| Previous above 0 | Pause and decrement by one |
| Next before last | Pause and increment by one |
| Reset | Cancel/invalidate timer; return to overview |
| Timer before last | Advance one step; schedule one interval for that step |
| Timer on last | After that entire interval, complete and retain the last step |
| Replay | Explicitly select 0 and restart timing; never loop automatically |
| Document hidden | Pause without changing selection; becoming visible does not resume |
| Reduced motion enabled | Pause; retain selection; disable timed Play/Replay |
| Reduced motion disabled | Permit explicit Play; do not resume automatically |
| Identity/data replacement | Invalidate old callbacks; new session starts in overview |
| Unmount/dispose | Cancel timer and subscriptions; no subsequent updates |

Approved boundary details: Previous is disabled in overview; Next is
disabled at the last step. Neither wraps. Reset is disabled when already in overview.
At completion the primary action is labelled Replay; before completion it is
Play/Pause on the same semantic button. Manual navigation clears completion.
Paused-at-last Play times the last step and completes; it does not silently replay.
A one-step visualization follows the same rules and completes after one interval.
Handlers reject disabled or ineligible actions even if called programmatically.

### Timing, defaults and cleanup

Use valid animationConfig.stepDurationMs (100-10000ms) from the parsed F026 input.
When configuration is absent, use 2000ms solely as a presentation fallback. A
present malformed configuration invalidates the payload: it must not be rescued by
the fallback. Preserve F026's required explicit autoplay=false whenever config
exists. Explicit user Play is supported; automatic startup remains prohibited.

Approved precise pause semantics: resume with a fresh full interval for the retained
step; do not track fractional remaining duration. Use one cancellable one-shot
timer, not setInterval. Each timer captures controller/session generation and
expected step; cancellation increments generation even if the scheduler cannot
prevent a queued callback from running. Repeated Play cannot create overlapping
timers. A delayed callback advances at most one step, with no catch-up burst.

Inject the scheduler into the controller for deterministic offline tests; production
uses existing browser timers. Dispose old controller instances and invalidate their
callbacks. React Strict Mode setup/cleanup/setup must not leave an unusable store,
duplicate visibility/motion listeners or leaked timers. Event handlers read current
visibility/motion eligibility before starting; unknown browser preference fails
closed for timing while manual stepping remains available. No timer during SSR.

## Accessibility and responsive behavior

- Previous, Play/Pause/Replay, Next and Reset are labelled native type=button controls
  in a named group. Use native Tab/Shift+Tab and Enter/Space behavior; no global arrow
  or space interception that conflicts with F027's keyboard-scrollable diagram.
- Keep focus on the activated control through ordinary state updates. Do not replace
  the primary button node when its label changes or move focus into each new step.
  Test boundary-disabled controls and identity reset explicitly.
- Provide visible focus, text/non-colour state indicators and minimum 44px touch
  targets. Wrap controls at narrow widths; no document-level horizontal overflow.
- Keep all F027 explanations/text alternatives available. A visible step/count and
  playback status may update every tick, but automatic ticks do not announce the
  entire diagram or narrative. A separate concise polite, atomic status announces
  user actions, automatic completion and motion/visibility pauses only.
- Reduced motion disables timed playback, explains why and preserves Previous/Next/
  Reset plus static F027 rendering. No CSS/SVG interpolation, flashing, smooth pan,
  forced scroll, execution engine or removal of authored text.
- Verify 1280x900, 768x900 and 390x900, text wrapping, contained diagram scrolling,
  readable full labels, contrast and visible keyboard focus with real mounted React.

## Conditionally approved synthetic fixture and isolation

**Route:** `/test/visualizations`.
**Flag:** `DEEPLEARNER_BROWSER_FIXTURE`, enabled only by the exact string `1`.
Absent, empty, `0`, `true` and every other value mean OFF. No NEXT_PUBLIC alias,
next.config env export, local env-file write or production configuration change.

`apps/web/src/app/(test)/test/visualizations/page.tsx` is a server page. It exports
`dynamic = 'force-dynamic'` to prohibit static route caching, reads the server-only
environment value inside each request and calls Next.js notFound() immediately
unless enabled. Do not capture the flag at module initialization, replace it at
build time, put the check inside a client effect or permit query/cookie/header
overrides. Check before rendering the client fixture, fetching or awaiting any
operation. Add no loading/Suspense wrapper that deliberately streams a successful
response before the guard. The required outcome is an actual HTTP 404, not a
200 page displaying "not found", login redirect or client-side hiding.

The same page supplies only deterministic synthetic graphs. fixture-client.tsx
mounts the real player and provides fixed synthetic identity/data replacement,
invalid-data and unmount cases for acceptance. No database IDs, account sessions,
source fetching, author-supplied HTML, real content or authentication overrides.
Fixture code is not a secret; isolation concerns route execution, not confidentiality
of synthetic JavaScript bundles. Do not expose or pass the flag to client props.

The fixture sits outside the student route group and does not modify authentication
or role guards. The existing root AuthProvider still exists, but the standalone
fixture has no AuthBoundary and does not initiate session refresh. Browser readiness
uses the fixture heading, mounted SVG and enabled controls; unexpected auth, API or
external requests are recorded and rejected. Do not fabricate login success or refresh.
Synthetic accountKey changes prove player isolation, not end-to-end authenticated
account transitions. Normal student/Admin routes remain unchanged and regression-tested.

### Existing Playwright configuration

Modify only playwright.f024.config.ts to discover the existing concept-revise suite
and visualization-controls.spec.ts. Preserve its production build/start command,
127.0.0.1:3000 binding, mocked API 127.0.0.1:4000, no server reuse, one worker, zero
retries, timeouts, reporter and artifact policy. Do not change root/F022/F023 configs.
Forward the fixture flag to the server only for an explicitly enabled process-only
verification invocation; never default it to 1. No new configuration or helper file.

An enabled fixture browser run requires the flag explicitly set to 1 for that test
process; the specification fails clearly if it is not enabled rather than skipping
acceptance. Discovery itself must not launch services. Existing F024 scenarios
remain selectable and unchanged. Do not merge or duplicate their assertions.

**Mandatory production-runtime isolation check, separately execution-approved:**
after the enabled production-build browser run has stopped, use the existing owned
process procedure to start that same build with the flag removed from the child
environment (not merely assigned an empty value). Request the fixture directly over
loopback without redirect following and require HTTP 404 with no fixture content.
Also request its RSC navigation form to ensure no synthetic payload is served while
disabled. No rebuild may occur between enabled and disabled observations: this
demonstrates runtime enforcement rather than a build-time-only guard. Check startup
readiness before probing, then close only owned processes and verify port release.
Use existing Node/PowerShell/ownership capabilities in memory, without a new script,
test route, server wrapper or dependency. Keep this check within the browser-stage
time budget and record its actual responses separately from browser scenario counts.

Verify the flag guard is the first synchronous route decision and production HTTP
status is genuinely 404. Next.js streamed not-found behavior must not be assumed
safe. If 404/isolation cannot be established within these two fixture files and the
existing configuration, STOP for approval; do not add middleware, change layouts,
weaken the 404 expectation or expand production infrastructure.

## Exact twelve-file implementation scope

| File | Action |
| --- | --- |
| docs/features/F028-visualization-controls.md | Create this plan; later approved status/evidence |
| docs/DEVELOPMENT_ROADMAP.md | Modify F028-only status/evidence when implementation approved |
| apps/web/src/lib/visualizations/playback-controller.ts | Create state machine and bounded scheduler ownership |
| apps/web/src/components/visualizations/visualization-player.tsx | Create validated lifecycle composition |
| apps/web/src/components/visualizations/visualization-controls.tsx | Create semantic controls/status |
| apps/web/src/components/visualizations/visualization-controls.module.css | Create responsive focus/control styling |
| apps/web/tests/visualization-playback.test.ts | Create fake-scheduler transition/cleanup tests |
| apps/web/tests/visualization-controls.test.ts | Create component, guard and accessibility tests |
| apps/web/src/app/(test)/test/visualizations/page.tsx | Create server-gated synthetic fixture route |
| apps/web/src/app/(test)/test/visualizations/fixture-client.tsx | Create synthetic mounted acceptance cases |
| tests/browser/visualization-controls.spec.ts | Create focused mounted acceptance |
| playwright.f024.config.ts | Modify discovery and explicit test-only flag forwarding |

Ten new files including this plan; two modified existing files. No F026/F027 files,
API/database design files, application entry points, dependency manifests, global
styles, environment files, shared packages or additional test infrastructure change.

## Verification and acceptance criteria

### Offline implementation gate

Use existing Node/tsx and React static-test conventions plus a deterministic fake
scheduler within the approved test file. No dependency installation. Cover:

1. Overview, Next/Play entry, Pause/resume, Previous-to-overview, Reset, completion,
   explicit Replay, first/last boundaries and a one-step graph.
2. Authored 100/10000ms boundaries, absent-config 2000ms fallback and malformed
   config rejection. No coercion, default mutation or F026/F027 schema changes.
3. Exact advance timing, final-step dwell, repeated Play, pause/resume full interval,
   no loops/catch-up, reset/unmount cleanup and deliberately delivered stale callbacks.
4. Hidden-tab pause and no automatic resume; motion preference changes and initially
   unknown preferences; visibility/motion listeners cleaned on unmount.
5. Account/visualization key and immutable-data replacement, including same-length
   graphs and key pairs susceptible to naive concatenation collisions. Old callbacks
   cannot advance or populate the replacement session.
6. Semantic native buttons with guarded aria-disabled states (retaining focus at
   boundaries), status announcement policy, plain-text
   safety, no external resources, complete explanations and no additional API calls.
7. Server-only flag absent/exact/invalid values, no client export, dynamic route guard
   wiring, and synthetic-only fixture content. Static checks do not prove HTTP 404.
8. Relevant existing web regressions, build/lint/typecheck/format, scope/dependency/
   secrets review. Preserve prior passing evidence; no MongoDB run is applicable.

### Separately approved mounted and full-browser gate

Reuse installed Chrome and existing production Next.js infrastructure. Discover
actual scenario counts before execution; retain all 63 existing baseline scenarios
(F022/F025 27, F023 16, F024 19, smoke 1) plus the new F028 scenarios. Do not change
existing browser specs. One bounded full regression before final approval, zero
automatic retries, maximum combined execution/isolation-check budget 25 minutes,
maximum initial failure diagnosis five minutes. No sleeps, timeout increases,
assertion weakening or automatic fixes/reruns. Retain sanitized reports/traces in .cache.

Mounted acceptance must observe the actual player and unchanged renderer:

- Overview and manual/timed selection; highlights match steps and full explanations
  remain visible; last dwell, completion and explicit Replay work without loops.
- Pause/Reset/unmount and synthetic identity changes prevent late advancement.
- Tab/Shift+Tab, Enter/Space, focus retention/outlines and scroll-region keyboard
  operation; no keyboard trap or stolen diagram arrow keys.
- All three viewports: document scrollWidth <= clientWidth, wrapped accessible
  controls, bounded internal SVG overflow, readable full-text alternatives and
  cyclic/self-loop/parallel-edge rendering.
- Reduced-motion emulation blocks timed playback while manual steps work; changing
  preference/visibility pauses safely. Clearly distinguish simulated visibility
  events from observations of actual browser background throttling.
- Inert teaching text, no injected markup, no unexpected external requests and
  no added catalog/auth activity from playback. The standalone fixture must not
  require or simulate an auth bootstrap request.
- Same-production-build runtime flag removal yields real HTTP 404 as described above.

Use controlled timer tests for deterministic boundaries and mounted bounded waits
for browser behavior; do not claim real-time precision from mocked clocks. Browser
DOM/keyboard evidence can close specific F027 mounted-renderer limitations without
editing its approved feature document. Screen-reader usability beyond the observed
semantic checks remains NOT_VERIFIED unless independently exercised and approved.

Apply the existing ownership policy: record PID plus creation time and Job Object
membership where available; never terminate unrelated processes. Check owned jobs
empty and loopback ports released after enabled/disabled sessions. Distinguish
Playwright's forced Windows server teardown from graceful application shutdown.
Unexplained historical baseline-process exits remain observations, not proven causes.

## Exclusions, limitations and approval gate

No Speed, animation engine, visualization API, Concept-page integration, Admin
preview/authoring, AI, real lessons, source fetching, progress, persistent playback,
demo-data edits, migrations, database operations or new dependencies. The fixture
is not a student feature, authentication bypass or end-to-end lesson acceptance.
No production deployment is authorized. Existing release/tooling limitations remain.

No F026/F027 contract conflict was found. The authored-timing fallback applies only
to absent valid configuration; malformed values remain rejected. Implementation
approval confirmed the player identity props, full-interval resume,
button boundary behavior and exact fixture flag/runtime verification mechanism.
The separately authorized runtime-isolation and segmented mounted acceptance gates
passed as recorded below. No scope expansion or production deployment is authorized.

Owner approved F028 development closure and feature-only Git delivery on 2026-10-16.
F028 is APPROVED_COMPLETE; F029 remains NOT_STARTED and excluded.

## Implementation and offline evidence — 2026-10-15

- Exact twelve-file scope implemented; no dependencies, API/F026/F027 changes,
  database operations, services, browser execution or Git operations.
- Focused playback/controls tests: **21/21 PASS**. Fake scheduling covers full
  interval resume, final dwell, stale callbacks, reset/disconnect, visibility,
  reduced motion and Strict Mode reattachment. Component harness covers distinct
  opaque identity pairs, immutable snapshots, logout and safe unavailable states.
- Existing web suite including the new tests: **156/156 PASS**. Final malformed
  heading-value hardening was rechecked with all 21 focused tests afterward.
- Full workspace build, lint, typecheck and formatting: **PASS**. Final affected
  web build (including TypeScript), lint and formatting rechecks: **PASS**.
  Prepared Playwright specification/configuration strict TypeScript check: **PASS**.
- Request-time guard unit checks cover absent/invalid/exact flag values and flag
  removal without reloading the module. Production build classifies the fixture as
  dynamic; generated client assets contain no fixture flag. These are offline
  observations, not proof of an actual HTTP 404 or cache behavior.
- Thirteen mounted F028 scenarios prepared, **NOT_RUN**, using the existing F024
  configuration alongside its unchanged nineteen scenarios. Existing 63-scenario
  baseline is retained; planned combined count is 76, to be confirmed by discovery
  at the separately approved browser gate. No retries/timeouts/assertions changed.
- Native buttons use guarded `aria-disabled` rather than the focus-removing
  disabled attribute. Boundary/completion updates retain the same DOM button;
  offline semantics/handlers pass, actual mounted focus remains NOT_VERIFIED.
- Scope hashes confirm only the twelve authorized files changed; original root,
  F022/F023 configurations and all existing browser specifications remain intact.
  Roadmap/feature documentation retains UTF-8 without BOM and LF endings.

**Remaining gate:** owner approval for mounted Chrome acceptance, same-build
enabled/disabled route HTTP/RSC isolation, and the bounded full regression. Actual
responsive geometry, keyboard scrolling/focus, real background-tab behavior,
assistive-technology usability and graceful Windows server shutdown are not proven
by offline tests. Synthetic identities are not authenticated student integration.
No unresolved offline defect is identified. F028 remains IN_PROGRESS.

## Final acceptance evidence - 2026-10-16

This section supersedes the pending browser/runtime gates in the historical offline
record above. Final acceptance review: **PASS**; owner approved F028 as
**APPROVED_COMPLETE** on 2026-10-16. The approved twelve-file scope is preserved, including the
owner-approved readiness and measured-overflow corrections in the existing browser
specification. No application, fixture, dependency or configuration correction was
needed during recovery. F001-F027 approvals and F029 NOT_STARTED are unchanged.

- Retained offline evidence: focused 21/21, web 156/156, build/lint/typecheck/format
  PASS. Corrected browser specification formatting, ESLint and strict TypeScript PASS.
- Independent F028 execution: **13/13 PASS**, zero retries, no skipped scenarios.
  Independent smoke: **1/1 PASS**. Actual runner exit codes both 0. Current bounded
  execution including startup/cleanup: **80.780 seconds**.
- Retained F022/F025 27/27, F023 16/16 and F024 19/19 plus these 14 checks establish
  **76/76 distinct scenarios: SEGMENTED REGRESSION PASS**. This is not a clean
  combined-run PASS: F024's afterAll closes its worker-scoped browser, conflicting
  with F028 when that worker is reused. The conflict remains unresolved; independent
  invocations are the owner-approved verification arrangement.
- Mounted real F027 SVG, keyboard focus/controls, playback/replay/completion,
  cancellation, synthetic identity replacement, reduced motion and inert content
  PASS. At 1280px the diagram fits and its SVG is fully contained horizontally;
  actual overflow at 768/390px supports keyboard scrolling. The 390px assertion
  explicitly requires overflow. No page-level overflow or unexpected auth/API/
  external request was observed by the assertions.
- Retained same-production-build isolation PASS, build ID
  `qZuKfTO5Xz9AyJqP7hL4J`: flag absent HTML 404, flag 1 fixture accessible, flag
  removed again HTML 404 without rebuilding. Disabled RSC returns the Next.js
  not-found digest (`NEXT_HTTP_ERROR_FALLBACK;404`) with HTTP 200 transport and no
  fixture payload; this is not claimed to be an RSC HTTP 404. Enabled RSC contains
  only the synthetic fixture. No client flag exposure or persistent data access.
- PID/creation-time and owned Job Object evidence retained. Both current jobs empty,
  ports 3000/4000/5173/27018 released; no extra outer-job force stop. Playwright's
  Windows server teardown uses forced process-tree termination. Graceful Windows
  application shutdown and historical unrelated-process continuity remain unproven.
- Review confirms unchanged F026/F027 contracts, full-interval resume, one cancellable
  generation-guarded timer, identity/reset/unmount protection, strict invalid-data
  handling, accessible controls and request-time fixture guard. No new endpoints,
  dependencies, database operations or student visualization integration.

Evidence under `.cache/playwright/results/`:

- `f028-scroll-correction-2026-10-16T05-28-31-589Z/`: current F028/smoke reports,
  logs and process-ownership/cleanup evidence.
- `f028-focused-recovery-2026-10-16T04-47-35-824Z/`: retained 62 passing browser
  scenarios, combined-worker conflict and disabled-again isolation evidence.
- `f028-recovery-2026-10-16T04-26-39-185Z/`: retained initial disabled/enabled
  same-build isolation evidence.

Remaining limitations: exhaustive real-screen-reader compatibility and actual
background-tab throttling are NOT_VERIFIED (visibility was simulated); synthetic
identity checks do not establish authenticated student integration. Speed, real
lessons, Concept integration, read APIs and Admin functionality remain excluded.
Owner subsequently authorized development completion and feature-only Git delivery.
No production deployment is authorized; all recorded limitations remain applicable.

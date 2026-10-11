# F020 - Learning Path Student UI

**Status:** APPROVED_COMPLETE
**Dependencies:** F017, F018 and F019 APPROVED_COMPLETE; reuse F013-F016 student UI.
**Authorization:** Owner approved the plan, all six design decisions and the exact
23-file scope below. Implementation and offline verification are now authorized.
Live verification requires separate explicit approval.

## Sources and approved scope

Sources: [roadmap](../DEVELOPMENT_ROADMAP.md), [PRD](../PRD.md),
[architecture](../SYSTEM_ARCHITECTURE.md), [API design](../API_DESIGN.md),
[database design](../DATABASE_DESIGN.md), and completed F013-F019 feature records.

Frontend-only, read-only Technology -> Learning Path -> Module -> Topic browsing.
The roadmap supplies the feature name and dependencies; the owner-approved plan
defines the routes and page-level requirements below. Topic browsing ends at a
metadata-only overview with truthful content-unavailable messaging. Navigation
does not enroll a student, save a selection or create progress/completion state.

Preserve completed F005-F019 behavior. No backend, model, index, dependency,
environment or API-contract changes. No content provisioning, seed runner, Concepts,
Practice, Admin CRUD, authoring, AI, media resolution, search/filtering, favorites,
profile preferences, enrollment or F021+ implementation.

## Routes and workflow

All routes live inside the existing authenticated student route group:

| Route | Approved content |
| --- | --- |
| /explore-technologies/[technologyId]/learning-paths | Paginated Learning Paths for a Technology |
| /learning-paths/[learningPathId] | Path summary and paginated Modules |
| /modules/[moduleId] | Module summary and paginated Topics |
| /topics/[topicId] | Topic metadata and content-unavailable notice |

Explore Technology cards gain a real "View learning paths" link. Use validated
ObjectIds in routes, never slugs or arbitrary API-provided URLs. "My Learning"
remains deferred. No Start learning, completion or learning-mode controls.

Eligible incomplete STUDENT users may browse every new route. F014 continues to
redirect incomplete students from /dashboard to /onboarding; browsing neither
updates nor completes onboarding. Keep the login next allowlist unchanged.

There is no Technology detail API. Use generic "Learning paths" context and an
"Explore technologies" ancestor link; do not invent a Technology name, trust a
query-supplied label or scan the whole paginated catalog to recover a name.
Path/Module/Topic titles in breadcrumbs come from validated detail DTOs. Fetch
needed ancestors and verify their relationships before presenting the hierarchy.
Direct links and reloads must work without prior navigation state.

## Existing API contracts and DTOs

Use the existing API base URL and only these public read endpoints:

| Operation | Endpoint |
| --- | --- |
| List paths | GET /api/v1/learning-paths?technologyId=ID&page=N&limit=20 |
| Path detail | GET /api/v1/learning-paths/:id |
| List Modules | GET /api/v1/modules?learningPathId=ID&page=N&limit=20 |
| Module detail | GET /api/v1/modules/:id |
| List Topics | GET /api/v1/topics?moduleId=ID&page=N&limit=20 |
| Topic detail | GET /api/v1/topics/:id |

Learning Path DTO: id, technologyId, title, slug, nullable description, nullable
targetLevel (BEGINNER/INTERMEDIATE/ADVANCED), completionScore and order.
Module DTO: id, technologyId, learningPathId, title, slug, nullable description, order.
Topic DTO: id, technologyId, learningPathId, moduleId, title, slug, nullable description, order.

Validate existing bounds: 24-hex ObjectIds, title 1-120, strict lowercase ASCII
kebab-case slug 1-100, description max 2000, nonnegative safe integer order and
integer completionScore 0-100. completionScore is a future minimum threshold,
not progress; validate it without displaying completion/progress UI.

Validate the full F004 success/error envelopes and pagination metadata, fixed
limit 20, requested page, safe numeric bounds, totalPages consistency, duplicate
item IDs and requested/detail/parent IDs. Validate all returned ancestor references
against each other. Only approved DTO fields enter rendered state; never render
status, Admin provenance, internal fields or fabricated child counts.

Backend publication and reference-consistency checks remain authoritative. Lists
and details expose only published, consistent hierarchies. A visible parent with
no children is a successful empty state. List unavailable-parent errors are
TECHNOLOGY_NOT_FOUND, LEARNING_PATH_NOT_FOUND or MODULE_NOT_FOUND respectively;
detail errors are LEARNING_PATH_NOT_FOUND, MODULE_NOT_FOUND or TOPIC_NOT_FOUND.
Present generic unavailable UI without inferring whether records are hidden or absent.

## Client architecture and security

Reuse Next.js, React, Zod, CSS Modules, the student shell/AuthBoundary and F016's
feature-specific client/controller/hook approach. Do not modify the auth controller
or existing auth ApiClient. Thin route pages pass validated resource context to
the learning browser. Avoid per-card child-count requests and unbounded fetching.

- Private UI waits for existing session restoration and authoritative /users/me.
- Preserve verified ACTIVE STUDENT access, ADMIN student-area handling and blocked
  account states. Never reactivate an account or trust decoded JWT profile claims.
- Catalog fetches use credentials: omit, no Authorization header, cache: no-store
  and redirect rejection. Do not manually set Origin or change CORS policy.
- Use fixed endpoint builders, cancellation and a bounded timeout following F016.
- Abort superseded/unmounted requests. Generation guards reject delivered-late
  responses even if transport cancellation is ignored.
- Clear results on route/resource or authenticated-user changes. Scope controller
  state to the current identity; old responses cannot populate the new account.
- No token/profile broadcasts, sensitive logging, browser persistence, polling,
  automatic retries or cross-account cache. Catalog responses never mutate auth.
- Render API text as text, not HTML. No external images or provider requests.

Existing backend shared 120/IP/15-minute list/detail budgets remain unchanged.
Do not introduce a frontend limiter, dependency or environment variable.

## UX, pagination and errors

Reuse the existing teal system and CSS Modules. Adapt breadcrumb/content/card
hierarchy from docs/designs/student/dashboard/stitch and
docs/designs/student/concept-learning/stitch. These are structural references;
there is no dedicated F020 screen. Do not copy CDN assets/scripts or fictional
metrics, sample records, locked lessons, XP, progress or concept-mode tabs.

Use responsive Path cards and ordered Module/Topic lists. Show neutral description
fallbacks and optional target level only when present. Preserve server order
(order ASC, slug ASC); never sort client-side. Explore is the active navigation
section, with accurate aria-current and resource-appropriate header titles.

Fixed limit 20, Previous/Next only, memory-only current page. Fresh visits start at
page 1. Disable pagination while loading. Empty later pages announce a truthful
no-results state and offer explicit return to page 1; never display an invalid
Page N of M range or automatically correct/refetch the page in a loop.

| Outcome | UI behavior |
| --- | --- |
| Invalid route ID / 400 | Safe invalid-request state with recovery navigation |
| 404 | Generic unavailable state and parent/Explore navigation |
| 403 | Origin/access error; no logout |
| 429 | Manual retry guidance; no invented countdown |
| 503 | Temporarily unavailable with explicit Retry |
| Network / timeout | Safe connection error with explicit Retry |
| Malformed success | Safe unexpected-response error |
| Unexpected 401 | Catalog request failure only; no auth refresh |
| Cancellation | No user-facing error |

One h1, semantic lists/articles, labelled breadcrumbs/pagination, real navigation
links and action buttons. Announce loading/error/page states. Focus the results
heading after explicit pagination only. Preserve visible focus, keyboard operation,
reduced-motion behavior and existing mobile dialog/logout feedback. Wrap long
titles/breadcrumbs and prevent horizontal overflow on desktop, tablet and mobile.

## Exact approved files

Create (16):

- docs/features/F020-learning-path-student-ui.md
- apps/web/src/app/(student)/explore-technologies/[technologyId]/learning-paths/page.tsx
- apps/web/src/app/(student)/learning-paths/[learningPathId]/page.tsx
- apps/web/src/app/(student)/modules/[moduleId]/page.tsx
- apps/web/src/app/(student)/topics/[topicId]/page.tsx
- apps/web/src/lib/learning-paths/contracts.ts
- apps/web/src/lib/learning-paths/routes.ts
- apps/web/src/lib/learning-paths/learning-browser-controller.ts
- apps/web/src/lib/api/learning-path-client.ts
- apps/web/src/hooks/use-learning-browser.ts
- apps/web/src/components/learning-paths/learning-browser.tsx
- apps/web/src/components/learning-paths/learning-browser.module.css
- apps/web/tests/learning-path-client.test.ts
- apps/web/tests/learning-browser.test.ts
- apps/web/tests/learning-browser-rendering.test.ts
- apps/web/tests/learning-navigation.test.ts

Modify (7):

- docs/DEVELOPMENT_ROADMAP.md
- apps/web/src/components/technologies/technology-catalog.tsx
- apps/web/src/components/technologies/technology-catalog.module.css
- apps/web/src/components/student/student-navigation.tsx
- apps/web/src/components/student/student-header.tsx
- apps/web/tests/technology-catalog-rendering.test.ts
- apps/web/tests/student-navigation.test.ts

Completed-feature changes are limited to Explore links/copy/styling, navigation
and header recognition, and corresponding tests. No auth/onboarding/backend
implementation changes. Any additional file or scope requires owner approval.

## Acceptance criteria and implementation sequence

Approved implementation sequence:

1. Set F020 IN_PROGRESS; implement validated contracts and fixed route builders.
2. Implement credential-free client, controller and hook with cancellation and
   identity/resource isolation.
3. Implement the four read-only pages, breadcrumbs and responsive states.
4. Extend only approved Explore navigation/header surfaces and tests.
5. Verify complete navigation, accurate API-backed content, truthful empty/error
   states, explicit retry/pagination and metadata-only Topic behavior.
6. Verify authentication/onboarding preservation, no auth side effects or catalog
   credentials, no stale/cross-account state and no excluded functionality.
7. Run offline checks and scope/secrets review; report actual evidence and stop
   before separately gated live verification.

Offline implementation is complete within the approved scope. Remaining live interaction acceptance is deferred by explicit owner approval for
review readiness only; offline tests do not establish browser verification.

## Offline implementation evidence

- Focused F020 tests: 15/15 PASS.
- Complete web offline suite: 70/70 PASS.
- Complete API offline regressions: 164/164 PASS; no integration suite executed.
- Root build, lint, typecheck and formatting: PASS.
- Diff/scope/secrets/security review: PASS; exactly the approved 23 files.
- No backend, dependencies, models, environment or auth/onboarding changes.
- Credential-free fetch options, strict envelopes/IDs/ancestor checks, server
  ordering, empty-page recovery and safe errors verified offline.
- Delivered-late success/failure and cancelled old-identity response rejection
  verified with controlled offline promises; not a live browser race claim.
- Rendering/navigation tests cover metadata-only Topic UI, account ownership keys,
  withheld ADMIN/unauthenticated content, fallback states and Explore active state.
- Initial lint rejected two local variables named module under the existing
  Next.js rule. Renamed to moduleRecord within the approved client/test files;
  subsequent lint and tests passed. No scope expansion was required.
- During the offline phase, no services, browser automation, database integration, real provisioning,
  staging, commits or pushes performed. Offline HTTP regressions use their
  existing test-only listeners and mocked persistence.

## Owner-accepted review readiness and release blockers

The owner approved F020 as APPROVED_COMPLETE for development closure on 2026-10-11,
following completed implementation, retained passing offline evidence, final code
review and explicit acceptance of the verification deferrals below. This approval
does not establish full browser verification or authorize production release.
The approved implementation and tests are preserved; all release blockers remain.

Retained offline evidence remains 15/15 focused, 70/70 web and 164/164 API PASS,
with root build/lint/typecheck/formatting and diff/scope/secrets/security checks PASS.
No completed tests were rerun for this documentation transition.

Six owner-operated browser checks PASS: login, dashboard, Explore,
Path -> Module -> Topic navigation, breadcrumbs/back links and the Topic
content-unavailable message. These are owner observations, not automated evidence.

Latest isolated run: final preservation PASS (finish exit 0); API, MongoDB and
shutdown-helper exits 0/0/0; process containment, empty Job Objects and port release
PASS. No stage-owned processes remained; all stages and evidence were preserved.
Disposable Next.js graceful shutdown FAILED: resources closed, but the shutdown
failure deadline expired and web exited 1. Wrapper exit 1 and supervisor FAIL
correctly retain that failure. No Job Object forced termination was needed.
Supervisor runtime was 1108.442 seconds. This is a disposable test-infrastructure
shutdown failure, not evidence of an F020 application defect; it is not a graceful
shutdown PASS. No application defect was confirmed by retained evidence.

Owner-accepted NOT_VERIFIED checks and risks:

- F020 session restoration, invalid-session, ADMIN/blocked-account and incomplete
  STUDENT/onboarding boundaries: incorrect access or redirects remain unexcluded.
- Actual catalog Authorization/Cookie-header absence and absence of unexpected
  auth refresh/logout during failures: credential transmission or session disruption
  remains unexcluded despite offline client coverage.
- Mounted pagination/focus, Retry, empty-page recovery and direct-link/reload behavior.
- Desktop/tablet/mobile layout, keyboard/focus operation, overflow and preserved
  mobile logout-failure interaction.
- Mounted resource/account transitions, unmount cancellation and delivered-late
  success/failure races: stale or cross-account content remains unexcluded in-browser.
- Hosted cookie behavior and normal Atlas startup remain NOT_VERIFIED.

Before production release, require a reusable automated browser acceptance suite
covering the outstanding mandatory checks above, using isolated browser contexts,
existing synthetic fixtures, bounded execution and failure-only evidence artifacts.
Playwright setup, dependencies and execution require separate owner approval.
Keep unprovable variants explicitly NOT_VERIFIED: a fault-hook result alone does
not prove outgoing Cookie-header absence or controller generation-check execution.
The test-infrastructure shutdown failure must remain separately documented; future
verification must report actual preservation and cleanup outcomes accurately.
No production release, additional infrastructure or F021 work is authorized.

## Verification gates

Offline, after implementation authorization: focused DTO/envelope/pagination and
hierarchy validation tests; client credentials/redirect/timeout/error tests;
controller cancellation and delivered-late/old-identity response tests; rendering,
links, breadcrumbs, active navigation, fallback and pagination tests. Preserve
onboarding return-gate, ADMIN and mobile shell behavior through regressions.
Run full web/API regressions, root build/lint/typecheck/formatting and diff/scope/
secrets review. Static rendering does not establish live focus or responsive behavior.

Live verification requires separate explicit approval of the exact procedure.
Proposed environment: working browser preflight before services; free ports
27018/3000/4000; existing MongoDB 8.2 executable; owned loopback replica set
f020-test and empty deeplearner-f020-test. Verify process ownership, binding,
replica-set identity and primary readiness before synthetic writes.

Only existing required collections/indexes: users, sessions, auditLogs,
technologies, learningPaths, modules and topics. Synthetic fixtures and provenance
reference IDs only; no real Admin, production content or JavaScript provisioning.
Use process-only matching localhost configuration, never actual .env changes,
Atlas or external providers. Temporary harnesses remain ephemeral.

Proposed interactive maximum is 45 minutes from startup, stopping earlier when
done or on failure. Verify direct navigation, auth/role/onboarding boundaries,
published/empty/paginated hierarchy, malformed/unavailable/error states, no catalog
credentials or auth side effects, cancellation/account changes, keyboard/focus,
responsive overflow and preserved mobile logout feedback. Do not automatically
patch or retry failures. Capture runtime and process exits; disconnect clients,
attempt graceful shutdown, separately report forced owned-process cleanup if
needed, confirm port release and remove only verified owned temporary artifacts.
Compare repository state before/after. No live execution is authorized by this plan.

## Risks, decisions and deferred work

All six owner decisions are approved: hierarchy including Topic overview, four
routes, incomplete-student browsing, generic Technology context, Stitch adaptation
and exact file scope with separately gated live verification. No unresolved design
blocker remains; offline implementation is authorized, with live verification separately gated.

Publication can change between requests; do not claim a cross-request snapshot.
Ancestor reads consume existing rate-limit budgets; avoid unnecessary prefetches.
Empty real catalogs are valid because no real content is provisioned by this feature.
Normal Atlas startup remains NOT_VERIFIED. Browser behavior remains NOT_VERIFIED
until separately exercised; inherited limitations are not silently cleared.

Deferred: named Technology detail contract, Concepts/F021-F022, Practice, enrollment,
progress/completion, favorites, preference editing, Admin CRUD, content authoring,
images/S3, search/filtering, AI and real content provisioning.

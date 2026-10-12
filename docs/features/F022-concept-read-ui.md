# F022 - Concept Read UI

**Status:** APPROVED_COMPLETE
**Dependency:** F021 APPROVED_COMPLETE; reuse the F013-F020 student experience.
**Authorization:** Owner approved the final architecture, dependency and 21-file
implementation boundary. Implementation, the pinned dependency and offline verification
are authorized. Separately approved browser acceptance is complete; the owner has
approved development closure as APPROVED_COMPLETE. Further browser
execution remains separately gated.
F020/F021 remain APPROVED_COMPLETE; their verification limitations remain intact.

## Sources and approved boundaries

- [PRD](../PRD.md): Read Mode and Source Links.
- [System Architecture](../SYSTEM_ARCHITECTURE.md): Next.js student client and API boundaries.
- [API Design](../API_DESIGN.md) and [Database Design](../DATABASE_DESIGN.md): approved F021 refinements.
- [Development Roadmap](../DEVELOPMENT_ROADMAP.md): F022 depends on F021.
- [F020](F020-learning-path-student-ui.md): student hierarchy browsing and release limitations.
- [F021](F021-concept-read-model-api.md): public Concept contracts and untrusted Markdown policy.
- Stitch: `docs/designs/student/concept-learning/stitch/screen.png` and `code.html`.

Frontend-only Concept discovery and Read presentation. The owner explicitly allows
narrow extensions to the existing Topic route and navigation recognition. Preserve
other F020 behavior, authentication, onboarding, backend contracts and documents.
Display F021's existing single source reference; F025 editorial validation and
administration remain deferred. This does not complete F025.

The Stitch screenshot primarily shows Visualize; its HTML also contains a Read
panel. Adapt breadcrumbs, title hierarchy, restrained reading width, spacing and
section typography using the existing teal system and CSS Modules. Do not copy
sample content, scripts, CDN dependencies, unavailable modes or progress widgets.
The PRD's suggested Read sections are content guidance, not new structured API
fields: render supplied Markdown without fabricating missing sections.

## Routes, architecture and navigation

| Route | Responsibility |
| --- | --- |
| `/topics/[topicId]` | Existing Topic and ancestor context plus paginated Concept summaries |
| `/concepts/[conceptId]` | Concept title, difficulty, summary, Read body and source reference |

Both routes stay in the existing `(student)` group and auth boundary. Private UI
appears only after authoritative current-user loading. Preserve anonymous/invalid
session routing, the login next allowlist, ADMIN student-area handling and existing
verified ACTIVE account safeguards. Eligible incomplete students may browse; the
F014 dashboard/onboarding redirects remain unchanged.

Use a feature-specific Concept client, controller, hook and browser component.
Reuse existing Zod/catalog schemas, abort/generation patterns, shell and navigation
helpers without refactoring the existing authentication or learning-browser
controllers. The separate Markdown component owns the rendering security policy.

Validate route IDs before catalog requests. Use existing public Topic, Module and
Learning Path detail APIs to establish real breadcrumb context. Check returned IDs
and all ancestor relationships against the requested Topic or Concept before
adopting results. Preserve generic Technology context where no Technology name is
available; do not invent names or add a Technology detail endpoint. Recognize the
Concept route as part of Explore navigation and use an appropriate Read header.

Cards contain title, difficulty and plain-text summary, linking by validated
Concept ObjectId. Detail supplies a back-to-Topic link and real ancestor links.
Do not eagerly fetch every list item's Read body. No enrollment or learning action.

## Exact F021 API and DTO contracts

- `GET /api/v1/concepts?topicId=ID&page=N&limit=20`
- `GET /api/v1/concepts/:id` with no query parameters.

IDs are exact 24-hex ObjectIds, normalized consistently with existing clients;
trailing whitespace/newlines are invalid. List pagination uses positive decimal
integers and safe offset arithmetic. F021 defaults page to 1 and limit to 20,
allows at most 100, and rejects unknown/repeated/nested parameters. F022 always
requests limit 20; it adds no filtering, searching or custom sorting. Preserve
server `order ASC, slug ASC` ordering.

Only published Concepts under published, consistent Technology -> Learning Path
-> Module -> Topic ancestry are public. The backend remains authoritative for
publication; no lifecycle or hidden fields are needed in the UI.

| DTO | Exact fields |
| --- | --- |
| Summary | `id`, `technologyId`, `learningPathId`, `moduleId`, `topicId`, `title`, `slug`, `difficulty`, `summary`, `order` |
| Detail | `id`, `technologyId`, `learningPathId`, `moduleId`, `topicId`, `title`, `slug`, `difficulty`, `order`, `contentFormat`, `schemaVersion`, `read`, `source` |
| Detail `read` | `summary`, `bodyMarkdown` |
| Detail `source` | `label`, `url`, `sourceType`, `isOfficial` |

Detail has no top-level summary. Validate the F021 bounds: title trimmed/nonblank
1-120; strict lowercase ASCII kebab-case slug 1-100; difficulty BEGINNER,
INTERMEDIATE, ADVANCED or INTERVIEW_READY; summary trimmed/nonblank 1-2000;
bodyMarkdown nonblank 1-50000 preserving meaningful whitespace; nonnegative safe
integer order; contentFormat exactly MARKDOWN; schemaVersion exactly 1.

Source label is trimmed/nonblank 1-120. Source URL is absolute HTTPS, 1-2048,
without embedded username/password. sourceType is exactly OFFICIAL_OR_TRUSTED;
isOfficial is a required Boolean, never inferred. These are approved F021
constraints, not invented broader canonical enums. Display the supplied reference
at the bottom; do not infer editorial trust, fetch the URL or generate previews.

Validate the full success envelope: `success: true`, nullable string `message`,
`data`, and `meta.requestId` as a nonblank string. List metadata also contains
`page`, `limit`, `total`, `totalPages`. Require the requested page, limit 20,
nonnegative integer totals, consistent `ceil(total / 20)` page count and expected
item count, unique IDs and matching ancestor IDs. Empty results use totalPages 0;
an empty later page may legitimately have page greater than totalPages. Pick only
approved DTO fields for UI state; never render unknown/internal fields.

Validate the existing error envelope (`success: false`, error code/message and
optional details, plus requestId). Present fixed safe client messages rather than
raw server diagnostics.

| Condition | UI behavior |
| --- | --- |
| 400 VALIDATION_ERROR | Safe invalid-request state; navigation recovery and page-1 action where relevant |
| 404 TOPIC_NOT_FOUND / CONCEPT_NOT_FOUND | Generic unavailable content; back navigation, no hidden-state disclosure |
| 403 ORIGIN_NOT_ALLOWED | Access/origin error; do not log out |
| 429 RATE_LIMIT_EXCEEDED | Manual retry guidance; no invented countdown |
| 503 DEPENDENCY_UNAVAILABLE | Temporary-unavailable state and Retry |
| Network/timeout | Connection error and Retry |
| Malformed success/error or unsupported schema | Safe unexpected-response state; no partial unsafe rendering |
| Unexpected 401 or other failure | Safe request failure only; no authentication refresh/logout |

Reuse the configured API base URL. Catalog GETs send no Authorization header,
use `credentials: "omit"`, `cache: "no-store"`, reject redirects and do not set
Origin manually. Preserve F021's no-store, CORS and shared 120/IP/15-minute rate
limit behavior. No backend changes are needed.

## Request lifecycle and UI states

- Loading clears previous content and announces progress without private-content flash.
- Empty first page truthfully reports no published Concepts.
- Empty later page announces no results, never an invalid Page N of M, and offers
  explicit return to page 1. Do not automatically redirect or loop requests.
- Previous/Next only, fixed limit 20, disabled while loading or at a boundary.
  Page state stays in memory; a fresh visit/reload starts at page 1.
- Retry is explicit; no automatic retries, polling, persistence or cross-account cache.
- Apply bounded request timeouts and abort superseded/unmounted requests. User
  cancellation is not shown as a failure; timeout remains a recoverable error.
- Reject stale successes and failures with request-generation guards. Key/reset
  state by authenticated account and resource so old content disappears immediately
  on logout/account/resource transition. Catalog responses never mutate auth state.
- Missing or malformed Read data is unavailable/error content, not fabricated prose.

## Restricted Markdown rendering

Installed approved exact web runtime dependency
`react-markdown@10.1.0` and necessary lockfile dependencies. The earlier tools contained
no Markdown renderer. Use the maintained parser instead of a handwritten parser;
review dependency/lockfile changes and retain normal security-update review.
No additional plugin or dependency is approved.

- Treat Markdown as untrusted data. Never claim server sanitization.
- Enable `skipHtml`; do not use raw-HTML plugins, MDX, dangerouslySetInnerHTML,
  executable code, inline scripts/styles, SVG, iframes or embedded media.
- Explicitly allow headings, paragraphs, ordered/unordered lists, list items,
  emphasis/strong, blockquotes, line/thematic breaks, inline code, code blocks and
  controlled links. No GFM/table/task-list plugins or syntax-highlighting library.
- Maintain one page h1. Map Markdown headings below it with logical relative
  hierarchy; do not let authored headings replace the page title.
- Permit only parsed absolute HTTPS links without credentials. Reject unsafe,
  relative and protocol-relative URLs; invalid links become text, never clickable
  empty hrefs. Apply the same policy to source links.
- External links disclose a new tab and use `rel="noopener noreferrer"`.
- Render Markdown images as safe textual alternatives without creating image or
  other resource requests. Do not resolve assets or fetch remote content.
- Render code as escaped text, never execute it. Long code scrolls inside its
  container with keyboard access rather than overflowing the page.

## Accessibility and responsive acceptance

Use semantic articles/lists, breadcrumb and pagination nav labels, actual links
for navigation and buttons for actions. Preserve existing mobile dialog/logout
behavior and focus management. Announce loading, errors and page changes without
excessive duplicate announcements. Focus results after explicit page navigation;
provide predictable heading focus for Concept navigation without focus theft on
unrelated updates. Keep visible focus, readable contrast and reduced-motion rules.

Automated acceptance covers desktop, tablet and mobile widths; keyboard activation
and traversal; actual mounted refs/effects; accessible names/heading structure;
long titles/links/code and absence of page-level horizontal overflow. Preserve the
existing shell rather than implementing a second navigation system.

## Exact implementation boundary: 21 files

Create 15 files (this plan counts as one):

1. `docs/features/F022-concept-read-ui.md`
2. `apps/web/src/app/(student)/concepts/[conceptId]/page.tsx`
3. `apps/web/src/components/concepts/concept-browser.tsx`
4. `apps/web/src/components/concepts/concept-browser.module.css`
5. `apps/web/src/components/concepts/concept-markdown.tsx`
6. `apps/web/src/hooks/use-concept-browser.ts`
7. `apps/web/src/lib/api/concept-client.ts`
8. `apps/web/src/lib/concepts/contracts.ts`
9. `apps/web/src/lib/concepts/concept-controller.ts`
10. `apps/web/tests/concept-client.test.ts`
11. `apps/web/tests/concept-controller.test.ts`
12. `apps/web/tests/concept-rendering.test.ts`
13. `apps/web/tests/concept-markdown.test.ts`
14. `tests/browser/concept-read.spec.ts`
15. `playwright.f022.config.ts`

Modify 6 files after implementation authorization:

1. `docs/DEVELOPMENT_ROADMAP.md`
2. `apps/web/package.json`
3. `package-lock.json`
4. `apps/web/src/app/(student)/topics/[topicId]/page.tsx`
5. `apps/web/src/lib/learning-paths/routes.ts`
6. `apps/web/tests/learning-navigation.test.ts`

No other files, dependencies, environment/configuration changes or refactoring are
authorized. Stop for owner approval if an additional change becomes necessary.

## Verification plan and gates

### Offline implementation verification

Use existing Node tests, React rendering and TypeScript tooling. Cover:

- Valid list/detail DTOs, independently malformed fields/envelopes/request IDs,
  pagination arithmetic, duplicate IDs, route validation and ancestor mismatches.
- Request options, bounded timeout/cancellation, safe errors and manual retry.
- Controlled deferred success/failure responses reaching controller generation
  guards after cancellation, resource changes and account disposal.
- Honest loading/error/empty/pagination markup, navigation and source presentation.
- Markdown injection, obfuscated/unsafe links, image suppression, escaped code,
  heading hierarchy and boundary-length content.

Static/stubbed rendering does not prove mounted focus or browser interaction.
Run focused F022 tests, full web/API regressions, root build/lint/typecheck and
formatting, followed by diff/scope/secrets review. Record actual results; do not
carry previous feature PASS counts forward as F022 evidence.

### Separately authorized automated browser acceptance

Extend the approved Chrome Playwright foundation with `playwright.f022.config.ts`;
keep the existing smoke configuration independent. Use installed Chrome, headless
isolated contexts, one worker, zero retries and bounded test/startup/suite timeouts.
Use standard Playwright webServer management for the local Next.js process with
reuseExistingServer false. Mock approved API/auth responses using Playwright route
controls and synthetic data; no real API/MongoDB, custom supervisor, additional
browser framework or manual operation is required.

Verify in real mounted pages:

- Topic -> Concept, breadcrumbs/back navigation, direct links and reload.
- Previous/Next, Retry and empty-page recovery, including actual focus effects/refs.
- Anonymous/invalid-session, ADMIN, blocked-account and incomplete-STUDENT UI
  boundaries; dashboard onboarding and login next behavior stay unchanged.
- Loading, unavailable, malformed response, 400/403/429/503/network/timeout states.
- Restricted Markdown, link protections, no script execution or image fetches.
- Desktop/tablet/mobile layout, keyboard and focus, mobile shell preservation.
- Resource/account transitions, unmount cancellation and absence of old content
  after controlled successes/failures; distinguish network cancellation evidence
  from proof that a delivered-late response reached a controller generation guard.
- Credential-free catalog requests using full request headers, including cookies,
  with a synthetic API cookie present. Do not rely on header APIs that omit cookies.
  Record absence of Authorization/Cookie without logging token/cookie values.
- Auth refresh/logout counters do not change because of catalog failures.

Keep browser requests limited to the local test app and mocked API; intercept any
external source navigation rather than visiting it. No personal profile, production
services, real content or credentials. Retain only necessary safe failure artifacts
in existing ignored output locations. Use existing npm tooling to select the F022
configuration; no root-script or infrastructure expansion is required.

### Browser process cleanup

The run must refuse an occupied application target, never attach to an existing
server, and track only test-owned processes. Close contexts and Chrome on both
success and failure; let Playwright tear down its owned web server, then verify
process exit and port release. Report missing cleanup evidence or failures and
stop without automatic retries or unrelated process termination.

Windows does not support Playwright's configurable SIGTERM/SIGINT graceful webServer
shutdown. Do not describe forced teardown as graceful or claim the historical
F020 graceful-shutdown failure is resolved. No new Job Object/supervisor workaround
is approved. If standard tooling cannot safely contain/clean the test, stop for a
separate owner decision. Build/font availability is a prerequisite; do not add
font downloads, disposable adaptations or configuration workarounds without approval.

## Evidence limits, deferred work and next approval

Implementation, offline verification and separately approved Chrome acceptance are
complete within the approved scope. Chrome + Playwright: 24/24 PASS across retained
runs, not a single full-suite rerun. Browser/server process cleanup and preservation
of all 21 F022 files: PASS.

Mocked Chrome acceptance proves mounted frontend behavior against synthetic F021
contracts; it does not prove live backend/database integration, hosted CORS,
refresh-cookie lifecycle, source trust or every delivered-late network race.
Canceled responses do not prove internal generation-check execution. Offline
generation-guard tests and browser cancellation evidence remain separate.
Graceful Windows web-server shutdown remains NOT_VERIFIED; process exit and port
release do not establish graceful shutdown.
Automated checks do not establish exhaustive assistive-technology
compatibility. No manual testing is required by this plan.

Preserve F020's accepted browser gaps and disposable web graceful-shutdown failure
as separate production-release blockers. Preserve F021's NOT_VERIFIED live database
dependency-failure injection and normal Atlas startup. F022 tests do not silently
clear those limitations or authorize production release.

Defer Example/F023, Visualize, Revise, Practice, progress/completion/enrollment,
AI, authoring/Admin CRUD, source editorial workflows/F025, images/media, GFM
extensions, content provisioning and all backend/model/API changes. No fabricated
Concepts or sources are production content.

## Implementation and offline verification evidence

- Implemented Topic Concept pagination and the Concept Read route with validated
  ancestry, safe source display, restricted Markdown and existing account guards.
- Added client/controller/hook boundaries, cancellation and generation guards;
  authenticated account/resource keys discard previous content. No auth mutations.
- Installed only react-markdown 10.1.0 as a direct web dependency. The lockfile adds
  79 required package entries with npm registry URLs/integrity metadata, promotes
  shared dependencies to runtime as needed, and changes no existing package version.
- Focused F022 offline tests: 22/22 PASS, including Markdown security cases.
- Full web regressions: 98/98 PASS (includes the new navigation regression).
- Full API offline regressions: 181/181 PASS; no MongoDB integration executed.
- Root build/lint/typecheck/formatting: PASS. The build includes the Concept route.
- Playwright config/specification standalone TypeScript and lint checks: PASS.
  These checks did not execute the Playwright suite or launch a browser/web server.
- Diff/scope/secrets review: PASS; exactly the 21 approved files. No backend,
  F020/F021 feature-document, environment, database or future-feature changes.
- Initial new-test array-access typing and two new-code lint issues were corrected
  within scope. Relevant checks subsequently passed; no unresolved offline failure.
- Browser acceptance and cleanup evidence are recorded below. Existing F020/F021
  acceptance limitations remain separate. No staging or commits.

No implementation contract deviations or additional dependencies were required.
Static rendering tests cover markup/handler wiring only. The separately authorized
browser runs provide mounted interaction evidence without upgrading those static
tests to browser proof.

## Automated browser acceptance and resolved review findings

- Chrome + Playwright: 24/24 PASS across retained, separately authorized runs.
  Coverage includes navigation/direct links/reload, pagination and mounted focus,
  empty-page recovery, explicit Retry, HTTP/network/timeout/malformed-response
  states, restricted Markdown, responsive/keyboard operation and account guards.
- Catalog requests contained no Authorization or Cookie headers with a synthetic
  API cookie present. Authentication refresh/logout counters stayed unchanged
  during exercised catalog failures and Retry.
- Same-document resource cancellation and STUDENT-to-STUDENT isolation: PASS for
  delayed success and failure cases. Exact request objects identify the single
  active target and canceled predecessors; document markers exclude reloads.
  Released canceled responses did not replace current content or introduce errors.
  This does not prove delivery to the internal generation-check branch.
- Browser/server process cleanup: PASS. Test-owned Chrome/Next.js processes exited
  and ports 3000/4000 were released. Graceful Windows web-server shutdown remains
  NOT_VERIFIED; no historical F020 shutdown failure is cleared.
- F022 file preservation: PASS; all 21 files remained unchanged during verification.
- Resolved Markdown heading hierarchy: authored headings normalize below the Read
  h2, including documents beginning with deeper headings, without another h1.
  Focused heading coverage and retained browser checks PASS.
- Resolved HTTP fault synchronization and scoped assertions: exact request/response
  observers precede fault triggers; faults remain armed through the actual error
  state; error and Retry assertions target #student-main. Explicit recovery checks
  expected requests and unchanged authentication counters.
- Resolved transition-test setup: initial catalog readiness precedes holds; exact
  URL/method/resource/account context and individual request lifecycle tracking
  distinguish canceled predecessors from the active target. The four corrected
  transition scenarios PASS without weakening counts or using document reloads.
- Final application review: no actionable application defect, security issue,
  API-contract mismatch or unauthorized change. The P3 stale-verification-document
  finding is reconciled here and in the roadmap using retained evidence.

Owner approved F022 as APPROVED_COMPLETE for development closure.
No additional tests or services were run for documentation reconciliation. Further
execution requires separate owner authorization. The owner authorized the scoped
F022 commit and push to origin/dev.
F020/F021 remain APPROVED_COMPLETE, F023 remains NOT_STARTED, and production release
is not authorized. Mocked API acceptance and the limitations above remain explicit.

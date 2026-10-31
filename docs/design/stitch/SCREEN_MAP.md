# DeepLearner — Stitch screen map and phased UI proposal

Design organization/planning only, 2026-10-31. Inspected baseline: branch `dev`,
HEAD `996d643ed4d6403d653b8e8c71c8663de690b052`, empty index, no tracked changes.
The only pre-existing untracked files were the twelve source design files below.
The owner explicitly confirmed their extracted directory as the approved source.
No original ZIP was available, so this task performs no archive extraction and
makes no claim about the archive's original entries or extraction process.

## Imported inventory and preservation

Source root: `docs/design-imports/stitch_deeplearner_platform_design_system/`.
Destination root: `docs/design/stitch/`. Each mapped directory contains the original
`code.html` and `screen.png`, copied byte for byte; source files remain untouched.
The only additional authored files are this document and `shared/DESIGN.md`.
No existing `docs/designs/` reference, application file or project document changes.

| Stitch source directory           | Organized destination           | PNG size    | Classification                                                                                  |
| --------------------------------- | ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `deeplearner_brand_logo_option_a` | `shared/logo-option-a/`         | 400 × 1105  | C — proposed shared brand asset; export defect, selection pending                               |
| `deeplearner_brand_logo_option_b` | `shared/logo-option-b/`         | 400 × 1105  | C — proposed shared brand asset; export defect, selection pending                               |
| `admin_ai_command_center`         | `admin/ai-command-center/`      | 972 × 1600  | C — new planned Studio, not the current Admin root screen                                       |
| `lesson_review_studio`            | `admin/lesson-review-studio/`   | 1200 × 1600 | C — new planned review workflow                                                                 |
| `ai_revision_comparison`          | `admin/ai-revision-comparison/` | 1459 × 1600 | C — new planned immutable-revision comparison                                                   |
| `student_learning_dashboard`      | `student/learning-dashboard/`   | 910 × 1600  | B for existing activity integration; A for account/shell restyling; C for unsupported additions |

Classification A means existing functional UI suitable for a separately approved
restyle. B means existing UI with pending integration/acceptance verification; it
does not reverse historical accepted evidence. C means new planned UI or asset
requiring separate implementation approval. The full Student screenshot is not an
implemented A screen: it mixes existing foundations with substantial C features.

SHA-256 evidence at import, identical for source and organized copy:

| Destination-relative file                 | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `shared/logo-option-a/code.html`          | `785ace6ce4cfe995356f0327a7e0caa284bd1e7080540f61db176aad24063ac6` |
| `shared/logo-option-a/screen.png`         | `0a7549869b0a0d02e30dcdff05f9115c65d618892204ff07845b257d0b6db2b1` |
| `shared/logo-option-b/code.html`          | `1e85a1ea23da42be875953e85c59d4ab8b1ea8fcbf6b2866e323b273c3cd87f4` |
| `shared/logo-option-b/screen.png`         | `0a7549869b0a0d02e30dcdff05f9115c65d618892204ff07845b257d0b6db2b1` |
| `admin/ai-command-center/code.html`       | `35a36a3d81176d7bfa86f3e90b925130d45ddc9a59921e5c800441f1407e9c90` |
| `admin/ai-command-center/screen.png`      | `8de9709c776a1dffbe6a381b4d8380bbb54eddded547d5319097dce2826eae6e` |
| `admin/lesson-review-studio/code.html`    | `7bd8b97d960b387709d8122ff9e56e525731bad73b7a8d670bfe4d9a150bcd19` |
| `admin/lesson-review-studio/screen.png`   | `b947ee8f9de307e6ad529d10873f3cd1eeaceb7681a55cf3b7a2ae3dcdb26d6a` |
| `admin/ai-revision-comparison/code.html`  | `8f5fc473f06ac2b17dd5fa9f0a42558a0453bccaf89989afd3bc981aa0ff7824` |
| `admin/ai-revision-comparison/screen.png` | `a74d1d23b49eaf8c85c16f9dfb2f78e47d7b2f7cd8dc829875de88b69fc56533` |
| `student/learning-dashboard/code.html`    | `abb8291a8a1335af754231c938c9ceedde1dabf981b27e30c23db603baed039a` |
| `student/learning-dashboard/screen.png`   | `149397e08b2c77319cc4facfcc18c852c3530190c04c3f3af6eb97bfe76f3fee` |

The import inspection found no unexpected file types, links/reparse points or
secret-pattern matches. Expected inline demo scripts and external font/CDN/image
references exist in the preserved HTML; they were inspected as text, not executed,
fetched or integrated. See [DESIGN.md](shared/DESIGN.md) for the logo defects,
script restrictions and measured contrast corrections. This is a design-only
reference set, never a public/static route or an application dependency.

## Current UI architecture and preserved contracts

Admin is React/Vite. `apps/admin/src/app/app.tsx` selects `AdminAccess` or
`TechnologyManager` inside `AdminShell` from the existing eligibility state.
There is no Admin router and no existing `/studio`, `/review` or `/technologies`
browser route. Both access and F043 inventory appear at the Admin origin root.
`apps/admin/src/styles/globals.css` styles shell/access; TechnologyManager has a
nearby CSS module. Current inventory/detail, DRAFT creation and revision-controlled
DRAFT editing exist. PUBLISHED/ARCHIVED records remain read-only; no publishing
button or AI technology creation is established by the screenshots.

Student is Next App Router. Existing components are grouped under `student/`,
`technologies/`, `learning-paths/`, `concepts/`, `practice/`, `visualizations/`,
`ui/` and other implemented features. StudentShell has desktop sidebar and native
mobile dialog; StudentNavigation exposes Dashboard and Explore Technologies and
plain future-feature labels. Root layout loads existing Geist/JetBrains Mono and
AuthProvider. The UI uses existing globals, CSS modules and a local SVG Icon.

Only `packages/shared-types/` and `packages/validation/` exist; `packages/ui/` does
not. No empty component directories or shared package are created by this proposal.
All prospective paths below are repository-relative and must be reconfirmed before
separate slice approval. No package/lockfile/configuration/backend inventory is
silently included. Any newly needed path, dependency, routing or contract change
returns for approval under AGENTS.md.

F042/F043 remain IN_PROGRESS, acceptance BLOCKED; F043 MongoDB scenarios remain
15 NOT_RUN and combined browser backlog 213 NOT_RUN. Live integration/production
remain NOT_VERIFIED; F044 remains NOT_STARTED. The current roadmap pointer and all
historical results are unchanged. These visual slices are planning labels, not new
feature IDs or a sequencing exception for accepted or future features.

## Screen-to-route and dependency map

### Shared logo options A and B — C

- Sources: `shared/logo-option-a/` and `shared/logo-option-b/`. Target both apps;
  current branding lives in AdminShell and StudentNavigation, with other public
  Student branding outside this task's proposed initial scope.
- Existing route/component: Admin origin `/` →
  `apps/admin/src/components/layout/admin-shell.tsx`; authenticated Student layout →
  `apps/web/src/components/student/student-navigation.tsx`. No logo component exists
  for these new assets and no option has been chosen.
- Visual change: A orbital mixed-case mark or B hexagonal uppercase mark. The PNGs
  are duplicate mostly transparent black-pixel captures; the different designs are
  base64 SVG text in `code.html`. Selection and a verified usable asset are pending.
- Backend/data/auth: no new backend data. Branding must not alter current home
  link, session display, role checks or logout behavior. Never use a portal logo as
  an authentication/role switch.
- Accessibility/responsive: accessible product name; decorative duplicate mark
  hidden from assistive technology; contrast on light/dark surfaces; preserve text
  fallback and safe header wrapping at 320px/zoom. Logo replacement is excluded
  from Slice 1a and needs a separately inventoried asset decision.

### AI Command Center — C

- Source: `admin/ai-command-center/`. Target Admin. No existing route or screen;
  existing AdminShell and F043 root are reuse anchors, not this dashboard.
- Proposed visual content: hero/action card, real job/budget summaries, curriculum
  list, queue/review rail and provenance. Proposed component:
  `apps/admin/src/components/dashboard/studio-overview.tsx` (does not exist).
- New functionality: outline creation, generation jobs, review queue, source policy,
  audit views and publishing navigation. Those controls cannot replace Technology
  Management, expose fake counts or appear enabled without approved integration.
- Backend dependencies: future F044–F057 authoring/review/publishing/provider/job
  contracts, authenticated summaries and bounded queue/budget capabilities. Model
  names, 6 curricula, 22 reviews, PIDs and conflicting ₹340/₹342 figures are samples.
  No permanent provider/model choice follows from export labels.
- Auth/data: preserve current verified ACTIVE Admin boundary, mutation-time checks,
  existing session coordination and safe errors. Jobs need actual statuses,
  timestamps, revisions and settled/reserved/uncertain/available costs; no frontend
  API keys or invented readiness percentages. Exact endpoints/DTOs remain unapproved.
- Accessibility/responsive: labelled action links, real status text/live regions,
  accessible progress values and corrected contrast. Four tiles collapse to two
  then one; rails stack; all evidence remains reachable on mobile. Admin mobile
  navigation and any routing need separate approval before this screen mounts.

### Lesson Review Studio — C

- Source: `admin/lesson-review-studio/`. Target Admin. No existing route/component;
  proposed `apps/admin/src/components/review/lesson-review-studio.tsx`.
- Visual change: track/hierarchy rail, broad content panel, source/validation rail
  and explicit review controls; future five-mode presentation. Existing Student
  ConceptBrowser is a guarded Student consumer, not an Admin preview API/component.
- Backend dependencies: F047 private immutable revisions, F048 safe preview,
  F049 editorial workflow, F050 review queue and approved validation/source evidence.
  F051 module publication remains distinct. More renderer support and policy/rubric
  review cannot be inferred from "98/100", "100% passed" or hallucination labels.
- Auth/data: current Admin authority, exact revision/digest, hierarchy, mode payloads,
  source/version evidence and conflict responses. Corrections are AI instructions;
  no routine manual lesson editor. Preview must not write Student activity, attempts
  or completion, impersonate a Student or bypass guards.
- Accessibility/responsive: labelled tabs, keyboard navigation, text quality results,
  source links and announcement/focus on review errors. Wide 3/6/3 columns stack
  without hiding evidence; prompts and approval stay usable with a mobile keyboard.
  Buttons require actual server results; changing a label is not approval.

### AI Revision Comparison — C

- Source: `admin/ai-revision-comparison/`. Target Admin. No existing route/component;
  proposed `apps/admin/src/components/review/ai-revision-comparison.tsx`.
- Visual change: immutable chronology, correction directive, original/proposed panes,
  accessible change markers and review footer. Scroll sync is optional presentation,
  not revision locking. Fixed 720px inner scrolling needs keyboard/reflow review.
- Backend dependencies: immutable revision retrieval, semantic/text comparison,
  exact review preconditions and audit evidence under F047–F051. Difference-format
  and content-sanitization contracts need approval; no new diff library is presumed.
- Auth/data: verified ACTIVE Admin, exact baseline/proposal IDs/digests, correction
  request and actual evidence. No caller-set authority, blind replay or silent
  baseline restore. Reject preserves published content. Approve and Publish remain
  separate operations; the export's "Approve & Promote" shortcut is not adopted.
- Accessibility/responsive: labelled sections and added/removed text, not color alone;
  `aria-pressed` sync control, no focus trapping and safe reading order. On narrow
  screens show original then proposal, with all decisions and errors unobscured.

### Student Learning Dashboard — composite A/B/C

- Source: `student/learning-dashboard/`. Target Student `/dashboard` →
  `apps/web/src/app/(student)/dashboard/page.tsx` → `DashboardFoundation` →
  `DashboardActivity`. Shell uses StudentShell/Header/Navigation. Existing account,
  preferences, refresh, saved attempts/classification, retry and pagination stay.
- A: restyle genuine account/preferences/shell and existing navigation. B: F041
  saved Concept practice has pending integration/acceptance verification; classify
  its actual UI/data independently from export graphics. A new visual slice never
  upgrades that feature's evidence or assumes persistent qualification is available.
- C: course-resume recommendation, streaks, course/mastery percentages, concept map,
  full five-mode dashboard, spaced repetition, retention chart, badges, certification,
  AI Tutor, Mock Practice and Interview Bank are not supplied by the current
  dashboard contract. Interview browsing needs F058/F059; F060 personal states and
  other additions require their own approved scope. Timed mocks/AI interview grading
  are outside the current narrowed Interview MVP. Do not create those controls in
  Slice 3 or add a Student-to-Admin role switch.
- Backend/data/auth: existing auth/current-user/profile data and existing dashboard
  API (`GET /api/v1/dashboard?limit=5`, cursor-based) only. Technology catalog is a
  separate existing flow; Slice 3 may retain a link to `/explore-technologies`, not
  invent a merged API or add catalog fetching. Preserve UNAVAILABLE/UNCLASSIFIED,
  real saved attempts, safe pagination and eligible Student checks. General persistent
  completion/mastery is not enabled by a screenshot or fixture.
- Visual change: reference palette, title hierarchy, spacious cards and dark optional
  code treatment only where genuine content already exists. Preserve account/profile
  information; do not replace it with static "Alex", seven-day streak or sample JS.
- Accessibility/responsive: retain landmarks, labelled refresh/retry/pagination,
  existing focus and announcements. Single-column cards on mobile, wrapping identity
  details, no horizontal page overflow; keyboard/native drawer unchanged. Full
  screenshot fidelity would require separately approved C functionality.

## Necessary component organization

| Application/area                  | Recommendation grounded in current structure                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin shell/access/technologies   | Reuse `layout/admin-shell.tsx`, `auth/admin-access.tsx`, `technologies/technology-manager.tsx` and its CSS module. No new folder for their restyle.                                               |
| Admin dashboard                   | Add `components/dashboard/studio-overview.tsx` only when the overview feature is authorized; keep it separate from existing F043.                                                                 |
| Admin curriculum/generation       | Future outline and queue belong in `components/curriculum/` and `components/generation/` once their contracts exist. Do not create empty folders now.                                             |
| Admin review/publishing/interview | Feature-specific components under `components/review/`, `components/publishing/`, `components/interview/`; no generic editor or catch-all dashboard abstraction.                                  |
| Student dashboard                 | Keep existing `components/student/` grouping. A new `components/dashboard/` move is unnecessary.                                                                                                  |
| Student learning/practice         | Keep `learning-paths/`, `concepts/`, `visualizations/`, `practice/`; no redundant `learning/` hierarchy or controller relocation.                                                                 |
| Student interview                 | Future `components/interview/` only after bank contracts/feature approval. Prepared answers are separate from Practice unlock/submission.                                                         |
| Shared UI                         | Reuse existing Student `components/ui/Icon` and patterns. `packages/ui/` is absent; defer a new shared package and cross-app renderer extraction until demonstrated reuse plus explicit approval. |

Small repeated status or review panels may later justify extraction within their
feature. A shared package would additionally require an exact package/build/exports/
styling/testing inventory; none is authorized or included in the slices below.

## Phased implementation proposal — no implementation now

Every slice requires explicit exact-scope owner approval and permitted feature
sequencing first. Every listed path is prospective, including existing MODIFY paths.
The later feature UI inventories are candidate front-end inventories only, not
approved route/API contracts or complete backend implementations. Reconfirm against
the repository when reached; newly required files must be proposed separately.
No production/configuration/auth controller, database or dependency change is included.

### Slice 1 — tokens and existing shells

MODIFY only:

- `apps/admin/src/styles/globals.css`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/student/student-shell.module.css`

CREATE: none. Define matching `--studio-*` vocabulary locally in both apps, apply
it to current shells, and keep Student consumption scoped to its shell. Do not
globally retint public login/signup/landing pages through existing shared tokens.
No shell JSX, navigation, feature controls, font loading, logo or package changes.

Acceptance: charcoal header/pale surface/purple focus demonstrated using existing
layout and controls; account/logout/skip links stay legible; no route/handler/data
changes, no public-page visual regression, no overflow at proposed viewport sizes.
Manual Chrome: real Admin login/logout and Student sidebar/dialog/navigation, focus,
zoom and responsive inspection with sanitized console/network evidence. Retain
existing relevant render/shell/browser regression suites without rewriting them to
match CSS. Formal checks and browser execution remain separately gated.

**Smallest independently demonstrable subset: Slice 1a.** MODIFY only
`apps/admin/src/styles/globals.css`; CREATE none. Add local design tokens and style
only existing Admin shell canvas/header/brand text/session/footer/skip-link surfaces,
spacing and focus. Retain existing font, header-only structure, form/Technology
layout, text, handlers, auth and feature behavior. No Student changes or logo choice.
Demonstrate the root in signed-out and genuinely eligible Admin states, keyboard
skip/focus and 1440/768/390/320px wrapping. If genuine local demonstration remains
blocked, report BLOCKED and obtain a named exception before claiming UI completion.
Remaining Slice 1 paths are a later separately approved subset, not automatic work.

### Slice 2 — existing Admin access and F043 styling

MODIFY only:

- `apps/admin/src/styles/globals.css`
- `apps/admin/src/components/auth/admin-access.tsx`
- `apps/admin/src/components/technologies/technology-manager.tsx`
- `apps/admin/src/components/technologies/technology-manager.module.css`
- `apps/admin/tests/admin-rendering.test.ts`
- `apps/admin/tests/technology-rendering.test.ts`
- `tests/browser/admin-access.spec.ts`
- `tests/browser/admin-technologies.spec.ts`

CREATE: none. JSX changes limited to approved presentation/semantic markup around
existing behavior. No new dashboard/sidebar/route and no auth/controller/client/API
changes. F043's manual DRAFT form remains until its replacement is separately built
and accepted; published/archived read-only behavior stays intact.

Acceptance/manual Chrome: genuine access/restore/denied/expired/unavailable states,
password-field privacy, list/filter/page/detail, validation, DRAFT create/edit,
revision conflicts, busy/uncertain outcomes, PUBLISHED/ARCHIVED read-only, logout and
keyboard/error focus. Use approved fixtures and unique test drafts, no seed/reset
shortcuts. Compare API requests/permissions before/after. Preserve F042/F043 blocked
acceptance and real database/browser requirements. Any styling test edits must
verify meaningful semantics/behavior; do not weaken assertions for a visual match.

### Slice 3 — existing Student dashboard styling

MODIFY only:

- `apps/web/src/components/student/dashboard-foundation.tsx`
- `apps/web/src/components/student/dashboard-activity.tsx`
- `apps/web/src/components/student/dashboard-activity.module.css`
- `apps/web/src/components/student/student-shell.module.css`
- `apps/web/tests/dashboard-rendering.test.ts`
- `tests/browser/dashboard.spec.ts`

CREATE: none. Existing route, hooks, controllers, request contracts and all account/
profile sections remain. Export-only charts, streaks, modes, catalog fetches, Admin
switch, interview navigation and false statistics are excluded.

Acceptance/manual Chrome: actual authenticated Student account/preferences and saved
practice; populated/empty/unavailable/unclassified/error/rate-limited/pagination
states; refresh/retry; session restoration/account switching/logout, accessible
status/focus and responsive cards. Retain genuine labels/counts and no progress
writes. No full-screen fidelity claim for excluded C content.

### Slice 4 — existing learning and practice styling

MODIFY only:

- `apps/web/src/components/technologies/technology-catalog.module.css`
- `apps/web/src/components/learning-paths/learning-browser.module.css`
- `apps/web/src/components/concepts/concept-browser.module.css`
- `apps/web/src/components/concepts/concept-progress.module.css`
- `apps/web/src/components/concepts/concept-completion.module.css`
- `apps/web/src/components/practice/practice-browser.module.css`
- `apps/web/src/components/visualizations/visualization.module.css`
- `apps/web/src/components/visualizations/visualization-controls.module.css`

CREATE: none. Split this inventory into separately approved screen-sized subsets
before execution. No JSX/controllers/API/type changes or additional content modes;
existing automated suites remain applicable without changes merely to mirror CSS.

Routes: `/explore-technologies`, `/explore-technologies/[technologyId]/learning-paths`,
`/learning-paths/[learningPathId]`, `/modules/[moduleId]`, `/topics/[topicId]`,
`/concepts/[conceptId]`, `/concepts/[conceptId]/practice`. The existing gated
`/test/visualizations` fixture is not general published visualization delivery.
Acceptance/manual Chrome: real published ancestry/visibility, breadcrumbs, safe
sources, Read/Example/Revise tab keyboard behavior, four existing Practice types,
submission-before-reveal, drafts and persisted attempts, pagination/errors, progress
and unavailable completion states. Preserve grading/mastery meaning and reduced
motion/focus. Test owned disposable attempts only under approved runtime authority;
never fabricate progress or imply coding Run/Test exists.

### Slice 5 — AI Content Studio, after architecture and feature authorization

Candidate CREATE inventory:

- `apps/admin/src/components/dashboard/studio-overview.tsx`
- `apps/admin/src/components/dashboard/studio-overview.module.css`
- `apps/admin/src/components/curriculum/curriculum-outline.tsx`
- `apps/admin/src/components/curriculum/curriculum-outline.module.css`
- `apps/admin/src/components/generation/generation-queue.tsx`
- `apps/admin/src/components/generation/generation-queue.module.css`
- `apps/admin/src/components/review/lesson-review-studio.tsx`
- `apps/admin/src/components/review/lesson-review-studio.module.css`
- `apps/admin/src/components/review/ai-revision-comparison.tsx`
- `apps/admin/src/components/review/ai-revision-comparison.module.css`
- `apps/admin/src/components/publishing/publishing-center.tsx`
- `apps/admin/src/components/publishing/publishing-center.module.css`
- `apps/admin/tests/studio-rendering.test.ts`
- `tests/browser/admin-studio.spec.ts`

Candidate MODIFY: `apps/admin/src/app/app.tsx`,
`apps/admin/src/components/layout/admin-shell.tsx`,
`apps/admin/src/styles/globals.css`. No router or API adapter inventory is implicitly
approved: exact route/client/DTO/test source paths must be added in a separate
contract proposal before mounting integrated screens. This is deliberately not a
claim that these front-end files alone can implement Studio. Split by existing
roadmap feature/dependency into explicit smaller plans; no all-at-once delivery.

Acceptance/manual Chrome after prerequisites: bounded brief/outline approval,
generation jobs with real stages and shared budget, source verification, supported
mode review, AI correction, immutable comparison/conflict, safe Student preview,
separate approval and module publication with audit/unknown reconciliation. Exercise
failure/cancel/expired authority as well as happy paths. No fake model/quality metrics,
automatic publishing, direct routine editor or unreviewed generated content.
Backend implementation, model/queue/budget provisioning and paid calls are outside
this UI inventory and require independent exact-scope approvals.

### Slice 6 — Interview Preparation, after feature authorization

Candidate CREATE inventory:

- `apps/web/src/app/(student)/interview/page.tsx`
- `apps/web/src/app/(student)/interview/[questionId]/page.tsx`
- `apps/web/src/components/interview/interview-bank.tsx`
- `apps/web/src/components/interview/interview-bank.module.css`
- `apps/web/src/components/interview/interview-question.tsx`
- `apps/web/src/components/interview/interview-question.module.css`
- `apps/admin/src/components/interview/interview-bank.tsx`
- `apps/admin/src/components/interview/interview-bank.module.css`
- `apps/admin/src/components/interview/interview-review.tsx`
- `apps/admin/src/components/interview/interview-review.module.css`
- `apps/web/tests/interview-rendering.test.ts`
- `apps/admin/tests/interview-rendering.test.ts`
- `tests/browser/interview-bank.spec.ts`

Candidate MODIFY: `apps/web/src/components/student/student-navigation.tsx`,
`apps/web/tests/student-navigation.test.ts`, `apps/admin/src/app/app.tsx`,
`apps/admin/src/components/layout/admin-shell.tsx`. These new Student route names are
proposals, not existing routes or approved route contracts. Student bank and Admin
review/publication are separate F058/F059/F061 deliveries with separately approved
API adapters/contracts/backend inventories before implementation. No supplied export
actually depicts the bank/detail screen; the dashboard callout alone is insufficient
for pixel-level acceptance. Approve those detailed designs first.

Acceptance/manual Chrome: actual technology-owned published questions, type/
difficulty/search filters, pagination, prepared-answer reveal and eligible related
learning links; Admin individual review and one/selected/all-eligible frozen
publication with conflict/partial/unknown outcomes. Non-coding answers require no
submission or AI grading and never create Practice attempts or mastery evidence.
Coding Run/Test/editor execution remains excluded until isolated-runner design and
explicit scope approval. No timed mock sessions, frontend-trusted grades or F060
personal-state additions. Verify responsive filtering/reveal, keyboard focus,
loading/empty/error and unauthorized access with genuine roles.

## Runtime and verification gates for every future slice

`npm run dev:local` and `npm run dev:setup` are proposed, not implemented. No service,
app, browser or database was started by this task. Real integrated UI verification
is NOT_RUN / NOT_VERIFIED. The persistent local profile needs separately approved
A-F tooling, MongoDB instance, schema/index policy activation, real accounts and
reviewed fixture/runtime execution from `docs/LOCAL_DEVELOPMENT.md`.
`DEV-PERSISTENT-27019` remains PROPOSED / NOT ACTIVE. Protect 27017/27018 and existing
data, credentials, receipts and disposable qualification. This design import grants
no permission to provision the new profile or fix application behavior.

For each authorized slice: implementation → focused/offline and regression checks →
genuine local demonstration → manual Chrome interaction → approved fixes → fresh
security/regression review → owner checkpoint → separately approved commit/push.
Use separate Chrome profiles and normal JWT/refresh-cookie authentication for genuine
Student/Admin roles. Capture feature/HEAD/date, actual URL/role, viewport, actions,
applicable API/database outcomes, sanitized diagnostics and PASS/FAIL/BLOCKED.
Never include passwords, tokens, private content or unsanitized network exports.

Manual checks cover desktop/tablet/mobile, keyboard/focus, zoom/reflow/contrast,
reduced motion and loading/error/empty/conflict states. Use approved normal UI
interactions, not hidden mutation routes or synthetic completion data. Every slice
retains mandatory build/lint/TypeScript/formatting, relevant automated frontend/API/
security regressions and disposable database integration where applicable. Manual
evidence is supplemental; it cannot replace automated browser acceptance. Primary-host
Playwright remains prohibited until separately approved ownership-safe execution;
no historical named exception transfers to these slices.

If the local demonstration is blocked, record the exact limitation and required
future verification and seek an explicit named exception before UI completion.
Static screenshots/HTML inspection or a mock preview are design evidence only.
Do not mark feature acceptance, live integration or production readiness PASS from
these artifacts. Owner approval is still required for completion and release.

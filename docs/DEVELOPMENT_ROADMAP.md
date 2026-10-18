# DeepLearner Development Roadmap & Feature Gate

**Document:** DeepLearner Development Roadmap  
**Purpose:** Execution checklist and approval gate for Codex-driven development  
**Status:** Active  
**Owner:** Project Owner  
**Rule:** Codex must implement only one approved feature at a time.

---

# 1. Mandatory Rules for Codex

Codex must treat this file as the implementation-control document for DeepLearner.

## Core Rules

1. Work on **one feature only** at a time.
2. Do not start a feature unless its status is `APPROVED_TO_BUILD`.
3. Before implementation, read:
   - `docs/PRD.md`
   - `docs/SYSTEM_ARCHITECTURE.md`
   - `docs/DATABASE_DESIGN.md`
   - `docs/API_DESIGN.md`
   - this roadmap file
4. Respect the current feature boundary.
5. Do not build future features just because they are mentioned in the PRD.
6. After implementation:
   - run required checks
   - summarize changes
   - update this file to `READY_FOR_REVIEW`
   - STOP
7. Codex must never mark a feature `APPROVED_COMPLETE` by itself.
8. Only the project owner can approve completion.
9. After owner approval, Codex may update the feature to `APPROVED_COMPLETE`.
10. Only then may the next feature move to `APPROVED_TO_BUILD`.
11. If blocked, mark the feature `BLOCKED`, explain the blocker, and STOP.
12. Do not silently change architecture.
13. If implementation conflicts with architecture or documents, ask before changing anything.
14. Keep changes small, testable, and reviewable.
15. Do not combine unrelated features in one implementation.

---

# 2. Status Legend

Use only these statuses:

- `NOT_STARTED`
- `IN_DISCUSSION`
- `APPROVED_TO_BUILD`
- `IN_PROGRESS`
- `BLOCKED`
- `READY_FOR_REVIEW`
- `APPROVED_COMPLETE`

---

# 3. Feature Gate Workflow

```text
NOT_STARTED
    ↓
IN_DISCUSSION
    ↓
APPROVED_TO_BUILD
    ↓
IN_PROGRESS
    ↓
READY_FOR_REVIEW
    ↓
APPROVED_COMPLETE
```

If blocked:

```text
IN_PROGRESS
    ↓
BLOCKED
    ↓
IN_DISCUSSION / APPROVED_TO_BUILD
```

Codex must STOP at `READY_FOR_REVIEW`.

---

# 4. Current Project State

| ID | Feature | Status |
|---|---|---|
| F000 | Repository + Monorepo Scaffold | APPROVED_COMPLETE |

### F000 Scope Completed

- npm workspaces
- Next.js student/public app
- React + Vite admin app
- Node.js + Express API
- shared packages
- TypeScript configuration
- lint/format configuration
- environment examples
- health API
- README
- root scripts
- build/lint/typecheck verification

---

# 5. Completed Feature Record

## F001 — Public Landing Page

**Feature Record:** [F001 landing page](features/F001-landing-page.md)

**Status:** `APPROVED_COMPLETE`

**Goal:** Build the approved DeepLearner public landing page and establish reusable UI foundations.

**Dependencies:** F000

### Scope
- header/navigation
- hero
- visual learning demo section
- learning method section
- technology preview
- code visualizer preview
- progress/weak-topic preview
- interview prep preview
- final CTA
- footer
- responsive desktop/tablet/mobile
- reusable design tokens/components

### Out of Scope
- authentication logic
- database integration
- API integration
- student dashboard
- real progress
- real visualization engine
- AI integration

### Acceptance Criteria
- [x] matches approved Stitch design direction
- [x] responsive
- [x] accessible structure
- [x] consistent typography and spacing
- [x] no unnecessary dependencies
- [x] static mock content only
- [x] no backend calls
- [x] reusable UI foundations created where justified
- [x] lint passes
- [x] typecheck passes
- [x] build passes

### Required Verification
- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [ ] responsive manual review (partial; see limitations below)
- [x] route smoke test

**Owner Approval Required:** Yes  
**Owner Approval:** Explicitly approved by the owner on 2026-09-25, conditional on the requested teal update; that update is applied.

**Completion Notes:** Implemented the approved F001 core sections using Next.js server components, CSS Modules, Geist/JetBrains Mono, semantic static previews, and a client-side mobile navigation disclosure. No dependencies or backend integration added. Action and accent tokens and landing badge/previous indigo rules now use #18abaf as requested. F002 remains NOT_STARTED.

### F001 Files Changed

- `apps/web/src/app/(public)/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/layout/public-shell.tsx`
- `apps/web/src/components/layout/public-header.tsx`
- `apps/web/src/components/layout/public-footer.tsx`
- `apps/web/src/components/layout/mobile-navigation.tsx`
- `apps/web/src/components/layout/public-layout.module.css`
- `apps/web/src/components/landing/code-visualizer-section.tsx`
- `apps/web/src/components/landing/event-loop-preview.tsx`
- `apps/web/src/components/landing/final-cta-section.tsx`
- `apps/web/src/components/landing/hero-section.tsx`
- `apps/web/src/components/landing/interview-preview-section.tsx`
- `apps/web/src/components/landing/landing-content.ts`
- `apps/web/src/components/landing/landing.module.css`
- `apps/web/src/components/landing/learning-method-section.tsx`
- `apps/web/src/components/landing/progress-preview-section.tsx`
- `apps/web/src/components/landing/technologies-section.tsx`
- `apps/web/src/components/landing/visual-learning-section.tsx`
- `apps/web/src/components/ui/button-link.tsx`
- `apps/web/src/components/ui/icon.tsx`
- `apps/web/src/components/ui/ui.module.css`
- `docs/DEVELOPMENT_ROADMAP.md`

### F001 Verification Results

- Pass: monorepo build, lint, typecheck, changed-source Prettier check, and git diff whitespace review.
- Pass: production route smoke test (HTTP 200, single H1, valid anchors, compiled teal tokens) and missing-route HTTP 404.
- No automated test suite exists; no testing dependency was introduced.
- Prior visual review covered all desktop sections and an initial 375px mobile view. Full tablet/mobile keyboard review was interrupted when the owner stopped Computer Use and has not been claimed as complete. Owner subsequently approved F001.

### F001 Known Limitations

- Requested #18abaf has insufficient contrast for normal text on white/light surfaces and white text on teal; contrast compliance is not claimed.
- Accounts, demo controls, and interview actions remain unavailable previews; statistics are illustrative.
- Missing favicon; original usable logo asset remains unavailable.
- Fonts are fetched at build time through next/font/google, then served locally.
- Repository-wide formatting previously flagged the pre-existing AGENTS.md; that file was not modified.

**Commit/PR Reference:** Commit titled `feat(web): implement approved F001 landing page` on `dev`.


---

# 6. Development Roadmap

## Phase A — Product UI Foundation

### F001 — Public Landing Page
Status: `APPROVED_COMPLETE`

### F002 — Login Page UI
**Goal:** Implement approved login design only.  
**Dependencies:** F001  
**Status:** `APPROVED_COMPLETE`

**Approved Scope:** `/login`, split-panel Stitch design, local email/password validation, password visibility, Google UI notice, unavailable signup/reset actions, static product preview, responsive styling and accessibility. No authentication, API calls, persistence, or new dependencies. Use existing fonts and teal tokens with dark button text and darker teal links/focus. Omit the state-demo toolbar and remember-device checkbox.

**Completion Notes:** Implemented the approved F002 UI only. The `/login` route uses a server-rendered split-panel page and static product preview, with a client form for email/password validation, password visibility, and explicit mock login/Google notices. Existing fonts, color tokens, button base styles, and icons are reused without changing F001. No new dependencies, backend calls, authentication, or persistence. Signup/reset controls remain unavailable and clearly labeled. No F003 implementation.

**Exact Files Changed:**

- Created `apps/web/src/app/(public)/login/page.tsx`.
- Created `apps/web/src/components/login/login-form.tsx`.
- Created `apps/web/src/components/login/login-product-preview.tsx`.
- Created `apps/web/src/components/login/login.module.css`.
- Modified `docs/DEVELOPMENT_ROADMAP.md` (F002 scope, status, results, and current-feature pointer; F001 completion preserved).

**Verification Results:**

- PASS: `npm.cmd run build` (all workspaces), `npm.cmd run lint`, and `npm.cmd run typecheck`.
- PASS: Prettier check of all four F002 source files.
- PASS: isolated installed-Chrome smoke checks against the production build: empty email/password errors, invalid email, first-error focus, show/hide password, mock login notice, Google notice, and no redirect.
- PASS: keyboard skip-link activation/focus and visible focus indicator; labeled controls and associated inline errors reviewed.
- PASS: no POST/API requests, local/session storage, cookies, or JavaScript runtime exceptions during the interaction checks.
- PASS: `/login` and `/` return 200; an unknown route returns 404.
- PASS: overflow measurements and screenshot review at 1440, 1024, 768, 375, and 320 CSS pixels. Desktop split and tablet/mobile stacking match the approved responsive plan. Reduced-motion preference checked.
- PASS: source/diff scope review; F001, API, admin, shared packages, configuration, and dependencies unchanged. Markdown hard-break spaces preserved.

**Known Limitations:** UI-only by design; no account access, Google OAuth, password reset, signup, or live learning data. Browser checks used desktop Chrome emulation, not physical mobile devices or a full cross-browser/screen-reader audit. Existing repository-wide AGENTS.md formatting and missing favicon are outside F002. Browser test scripts/screenshots were temporary verification artifacts, not a new committed test framework. The pre-existing `.gitignore` change was preserved.

**Login-navigation follow-up:** Added a secondary desktop Log in link before Start Learning Free and a mobile-menu equivalent, both targeting `/login`. Existing CTA and signup behavior are unchanged. Modified `apps/web/src/components/layout/public-header.tsx`, `mobile-navigation.tsx`, and `public-layout.module.css`. Created [F001 feature record](features/F001-landing-page.md) and [F002 feature record](features/F002-login-page.md), separating historical delivery from this follow-up.

**Follow-up Verification:** Build, lint, typecheck, and changed-file formatting passed. Chrome checks at 1440, 1101, 1100, 768, 375, and 320 CSS pixels passed for login discovery, keyboard activation, menu opening/Escape/focus return, Home navigation, no duplicate visible login entries, preserved CTA fill, and no page-wide overflow. Desktop/mobile screenshots reviewed. `/` and `/login` return 200; unknown route returns 404. Source diff reviewed; no login form, backend, dependency, or F003 changes.

**Owner Review:** Approved after the login-navigation follow-up. The owner requested committing and pushing the completed F002 changes. F003 remains NOT_STARTED pending its own plan and approval.

### F003 — Signup + Email Verification UI
**Goal:** Build account creation and verification screens.  
**Dependencies:** F002  
**Status:** `APPROVED_COMPLETE`

**Approved Scope:** `/signup`, local registration-field validation, password visibility, an explicitly simulated email-verification view, static product preview, and signup navigation from landing/login. No account creation, email sending, token handling, persistence, or new dependencies.

**Completion Notes:** Implemented the approved signup form and same-route verification preview. Names/email/password receive local validation, first-error focus, and associated errors. Valid submission clears the password; verification and resend explicitly state that no account or email exists. Back preserves names/email in memory and focuses email; reload resets the form. Google remains a mock notice. Responsive static learning preview follows Stitch with existing fonts and teal styling. Landing header/hero/final CTA/mobile menu and login now link to `/signup`. No F004 implementation.

**Exact Files Changed:**

- Created `apps/web/src/app/(public)/signup/page.tsx`.
- Created `apps/web/src/components/signup/signup-form.tsx`.
- Created `apps/web/src/components/signup/verification-preview.tsx`.
- Created `apps/web/src/components/signup/signup-product-preview.tsx`.
- Created `apps/web/src/components/signup/signup.module.css`.
- Created `docs/features/F003-signup-email-verification.md`.
- Modified `apps/web/src/components/layout/public-header.tsx`.
- Modified `apps/web/src/components/layout/mobile-navigation.tsx`.
- Modified `apps/web/src/components/landing/hero-section.tsx`.
- Modified `apps/web/src/components/landing/final-cta-section.tsx`.
- Modified `apps/web/src/components/login/login-form.tsx`.
- Modified `docs/features/F001-landing-page.md`.
- Modified `docs/features/F002-login-page.md`.
- Modified `docs/DEVELOPMENT_ROADMAP.md`.

**Verification Results:**

- PASS: `npm.cmd run build`, `npm.cmd run lint`, and `npm.cmd run typecheck` across the monorepo; changed source and feature-document Prettier checks.
- PASS: production-build Chrome signup checks covering empty/invalid fields, trimmed-name boundaries (1/80 accepted, 81 rejected), password boundaries (10/128 accepted, 9/129 rejected), visibility, first-error focus, verification focus, resend, back/password clearing, reload reset, and Google mock feedback.
- PASS: keyboard skip link, visible focus, Enter submission, input labels, associated errors, and reduced-motion preference.
- PASS: signup and verification overflow checks at 1440, 1024, 768, 375, and 320 CSS pixels; desktop/tablet/mobile screenshot review.
- PASS: desktop/mobile landing-to-signup, login-to-signup, signup-to-login, and Home navigation. `/`, `/login`, and `/signup` return 200; unknown route returns 404.
- PASS: no POST/API requests, app storage, cookies, credential query strings, or JavaScript runtime exceptions observed during signup checks.
- PASS: source/diff scope review; backend, admin, shared packages, configuration, dependency manifests, and lockfile unchanged.

**Known Limitations:** UI-only; no registration, email delivery, OAuth, verification tokens, legal agreement, or real learning data. Chrome emulation is not a complete cross-browser, physical-device, or screen-reader audit. No existing test runner is configured; temporary browser scripts were used without adding a test framework. Existing missing favicon and unrelated repository formatting remain outside scope. Full implementation/verification details: [F003 feature record](features/F003-signup-email-verification.md). The owner approved F003 completion and requested committing and pushing the changes. F004 remains NOT_STARTED.

---

## Phase B — Common Backend Foundation

### F004 — Backend Common Foundation
**Goal:** Finalize common backend behavior before auth.  
**Scope:** error model, standardized response envelope, request IDs, structured logging, validation pattern, versioned routing, CORS, security headers, request limits, sanitized errors.  
**Dependencies:** F000  
**Status:** `APPROVED_COMPLETE`

**Owner Approval:** Explicitly approved on 2026-09-26 after verification, including the separately approved environment-validation fix. Commit reference: `feat(api): complete F004 backend common foundation` on `dev`. F005 remains NOT_STARTED and requires its own plan and approval.

**Approved Plan:** [F004 Backend Common Foundation](features/F004-backend-common-foundation.md). Preserve the modular monolith and health route; complete common responses/errors, safe logging, validation, CORS/security, and focused tests. Owner approved API_DESIGN.md envelopes, ROUTE_NOT_FOUND, disabled CORS credentials for this phase, and dependency-free API test configuration. No F005, authentication, or database implementation.

**Completion Notes:** Extended the existing error/response foundation with safe details, controlled parser errors, route labels, Pino redaction, typed Zod request validation, and focused Node tests. Health remains process liveness only. During verification, malformed CORS origins exposed an existing URL parsing exception that could print rejected input. Work paused; the owner separately approved a URL.canParse guard in env.ts. No new dependencies, shared-package changes, frontend integration, authentication, or database work.

**Exact Files Changed:**

- Created `apps/api/src/middleware/validate.ts`.
- Created `apps/api/tests/foundation.test.ts`.
- Created `apps/api/tests/logging.test.ts`.
- Created `apps/api/tests/env.test.ts`.
- Created `apps/api/tsconfig.test.json`.
- Created `docs/features/F004-backend-common-foundation.md`.
- Modified `apps/api/src/app.ts`.
- Modified `apps/api/src/common/errors/app-error.ts`.
- Modified `apps/api/src/common/http/response.ts`.
- Modified `apps/api/src/common/logging/logger.ts`.
- Modified `apps/api/src/config/env.ts` (separately approved fix).
- Modified `apps/api/src/middleware/error-handler.ts`.
- Modified `apps/api/src/middleware/not-found.ts`.
- Modified `apps/api/src/middleware/request-logger.ts`.
- Modified `apps/api/src/modules/health/health.routes.ts`.
- Modified `apps/api/src/types/express.d.ts`.
- Modified `apps/api/package.json`.
- Modified `docs/DEVELOPMENT_ROADMAP.md`.

**Verification Results:** PASS: monorepo build, lint, typecheck, all 15 API tests, changed API/feature-document formatting, and final diff/whitespace review. Built-app smoke checks passed for health 200, standardized unknown-route 404, malformed-JSON 400, origin rejection 403, matching request IDs, logs, CORS, and Helmet headers. Tests additionally cover validation transforms/defaults, safe details, sync/async unexpected failures, duplicate/invalid IDs, JSON limits/encoding, preflight, sensitive-value exclusion, and environment validation. Initial sandbox failures for tsx OS-user lookup and existing Google Fonts network access were resolved by permissioned reruns without configuration changes.

**Known Limitations:** No auth/database/rate limiter or deployment hardening. Log callers must select safe data; configured redaction is not arbitrary-depth/free-text sanitization. Finish-event logs exclude prematurely disconnected requests. Validation detail paths can fall back to a parent for opaque/dynamic schemas. CORS credentials remain disabled by design. Full details and acceptance checklist are in the feature record. F004 is owner-approved; F005 remains NOT_STARTED.

---

## Phase C — Authentication + Users

### F005 — MongoDB Connection Foundation
**Goal:** Connect API safely to MongoDB Atlas.  
**Dependencies:** F004  
**Status:** `APPROVED_COMPLETE`

**Approved Plan:** [F005 MongoDB Connection Foundation](features/F005-mongodb-connection-foundation.md). Owner approved closure on 2026-09-28, including the explicit LOCAL/single-127.0.0.1 TLS exception; verified TLS remains mandatory elsewhere. No models, authentication, frontend integration, or new endpoints.

**Verification:** PASS: 31/31 tests, build, lint, typecheck, formatting, local connect/ping/disconnect, connect-before-HTTP, health/404, graceful/repeated shutdown handlers and scope/secrets review. Windows handlers tested in-process; external OS signal delivery NOT_VERIFIED. Controlled Atlas verification PASS on 2026-09-29: connection, strict TLS, authentication, ping and disconnect, using process-only DNS/TLS overrides. Persistent DNS/configuration issues remain unresolved; normal Atlas startup without overrides, database uniqueness/TTL execution and application read/write privileges remain NOT_VERIFIED. See the [F005 verification record](features/F005-mongodb-connection-foundation.md).

### F006 — User + Session Models
**Goal:** Implement users, sessions, verification tokens, reset tokens, indexes and TTL indexes.  
**Dependencies:** F005  
**Status:** `APPROVED_COMPLETE`

**Plan:** [F006 approved scope and verification](features/F006-user-session-models.md). Persistence models and offline tests only; no database provisioning.

**Verification:** Owner approved completion on 2026-09-28, including the resolved P2 profile-array validation issue. PASS: 10/10 User tests, 53/53 complete API tests, build, lint, typecheck, formatting and scope/secrets review. Database-enforced uniqueness: NOT_VERIFIED; actual query projections: NOT_VERIFIED; TTL execution: NOT_VERIFIED; Atlas TLS/connectivity: DEFERRED — NOT_VERIFIED.

### F007 — Email Registration + Verification
**Dependencies:** F006  
**Status:** `APPROVED_COMPLETE`

**Plan:** [Approved F007 backend scope](features/F007-email-registration-verification.md). Offline implementation/checks authorized; database integration writes and real email require separate approval.

**Verification:** 2026-09-29: PASS 70/70 offline API tests; isolated database integration exit 0; expired-record-present rejection; observed verification-first race; rollback, uniqueness, replay prevention and sensitive projections; build/lint/typecheck/formatting, scope/secrets review and complete temporary-instance cleanup. Approved F006 Argon2id compatibility correction included. Owner approved backend-only completion on 2026-09-29; dedicated code review found no actionable P0/P1/P2/P3 defects. Resend-first ordering not observed; actual TTL deletion, real Resend delivery and normal Atlas startup without overrides NOT_VERIFIED. Browser integration is outside F007. See the feature record for test boundaries and three non-blocking future coverage opportunities (not completed tests); no Atlas writes or real emails.

### F008 — Login + Access/Refresh Tokens
**Dependencies:** F007  
**Status:** `APPROVED_COMPLETE`

**Plan:** [Approved backend-only F008 plan](features/F008-login-access-refresh-tokens.md). Owner approved backend-only completion on 2026-09-30 after accepting final implementation, verification and code-review evidence.

**Verification:** Initial 2026-09-29 offline API 83/83 PASS; final 2026-09-30 offline API 84/84 PASS after the regression-tested P2 malformed CORS configuration correction; build/lint/typecheck/formatting, dependency and security/secrets checks PASS. 2026-09-30 isolated MongoDB integration 7/7 PASS, exit 0: transactional login/audits, fixed 30-day expiry, rotation/reuse, concurrent one-success/reuse-rejection/session-revocation, disabled protection/expired suspension, login/refresh rollback, projections, hash uniqueness and expired-record-present rejection. Disposable cleanup and port release PASS; suite 8.5s, overall 13.1s. TTL deletion, real browser cookies and normal Atlas startup without overrides remain NOT_VERIFIED; rate limiting is single-process. Final code review: no actionable P0-P3 findings. Malformed URL-parser exceptions/stacks are prevented; Node may still emit the standard stack for the sanitized configuration Error. See feature record for evidence boundaries.

### F009 — Logout + Session Management
**Dependencies:** F008  
**Status:** `APPROVED_COMPLETE`

**Plan:** [Approved F009 backend scope and evidence](features/F009-logout-session-management.md). Owner approved backend-only completion on 2026-10-01 after reviewing implementation, verification evidence, integration results, documentation and final code review, preserving the recorded limitations.

**Verification:** 89/89 offline API tests and build/lint/typecheck/formatting/scope-secrets review PASS. 2026-10-01 isolated MongoDB integration 8/8 PASS, explicit child SUITE_EXIT=0: logout revocation/audits, idempotency, logout-all counts/isolation, rollback, projections, disabled/suspended state preservation, version-only User coordination, approved races, revoked-refresh rejection and expiry/digest preservation. Cleanup/shutdown/port release PASS. Final review: no actionable P0–P3 findings. Outer wrapper exit 1 resulted only from an empty runner ExitCode property—a reporting limitation, not application failure. TTL deletion, deployed browser cookies and normal Atlas startup without overrides remain NOT_VERIFIED; approved refresh-first stale logout preserves the rotated session and existing access JWTs retain normal expiry. See feature record for observed race orderings; no Atlas operations or real emails.

### F010 — Forgot / Reset / Change Password
**Dependencies:** F008  
**Status:** `APPROVED_COMPLETE`

**Plan:** [Approved F010 backend plan and detailed evidence](features/F010-forgot-reset-change-password.md). Owner approved completion on 2026-10-03 within the agreed backend-only scope.

**Verification:** Offline API 103/103 PASS; host-context isolated MongoDB integration 13/13 PASS, child/wrapper exits 0. Same-password reset and successful reset/change account-metadata preservation PASS. Build/lint/typecheck/formatting, security/scope review and owned-instance cleanup PASS. Final code review: no actionable P0-P3 findings. Earlier integration: 12/12 PASS; subsequent sandbox startup failed with ERR_SYSTEM_ERROR/ENOMEM/uv_os_get_passwd before tests. Minimal probes reproduced this inside the sandbox and passed in non-administrator host PowerShell, followed by the successful 13/13 run; an execution-context limitation, not an application defect. Historical font-download build issue and detailed test evidence remain in the feature record.

**Limitations:** TTL deletion, real email delivery, deployed browser recovery, normal Atlas startup without overrides and unobserved race orderings remain NOT_VERIFIED. No perfect timing/failure-path enumeration indistinguishability; single-process rate limiting. No Atlas operations or real emails.

### F011 — Google Authentication + Account Linking
**Dependencies:** F008  
**Status:** `APPROVED_COMPLETE`

**Plan:** [Approved F011 backend plan and verification](features/F011-google-authentication-account-linking.md). Implementation approved 2026-10-03; owner approved backend-only completion on 2026-10-05.

**Verification:** Offline API 110/110 PASS; isolated MongoDB 8/8 scenarios PASS, child/wrapper exits 0/0. Concurrent creation/linking, audit rollback, explicit session cleanup, build/lint/typecheck/formatting and disposable-resource cleanup PASS. Final code review: no actionable P0-P3 findings. Resolved StrictModeError on __v during Mongoose transaction rollback using F011-only explicit startSession()/withTransaction()/awaited endSession() in finally; strict schemas, coordination, writes, audits and duplicate-key re-resolution preserved. Actual TTL deletion, real Google/browser behavior and normal Atlas startup without overrides remain NOT_VERIFIED. Historical evidence and dependency/security review are retained in the feature document.

### F012 — `/users/me` + Student Profile
**Dependencies:** F008  
**Status:** `APPROVED_COMPLETE`

**Plan:** [F012 self-profile backend implementation and evidence](features/F012-current-user-student-profile.md). Owner approved completion within the backend-only scope on 2026-10-06.

**Verification:** Offline API 116/116 PASS; isolated MongoDB 5/5 scenarios PASS, child/wrapper exits 0/0. Projections/authMethods, profile updates, field preservation, isolation, account safeguards, audit persistence/rollback, concurrency and session/instance cleanup PASS. Build/lint/typecheck/formatting PASS; final code review found no actionable P0-P3 findings. Audit-ordering test corrected using fixed requestIds; no production change. Normal Atlas startup/browser integration NOT_VERIFIED; technology existence checks deferred. Full evidence and runner-reporting clarification are in the feature document.

---

## Phase D — Student Application Shell

### F013 — Authenticated Student Shell
**Dependencies:** F008  
**Status:** `APPROVED_COMPLETE`

**Plan:** [F013 approved backend-contract integration and student shell](features/F013-authenticated-student-shell.md). Owner approved offline implementation on 2026-10-06; live browser/session verification separately gated.

**Offline verification (2026-10-07):** Web 21/21 (including focused mobile rendering 2/2) and API 116/116 PASS; root build/lint/typecheck/formatting, scope/diff and secrets/token-storage review PASS. Mobile dialog logout-feedback P2 resolved with retry/controller semantics preserved and rendering coverage added; final code review found no actionable P0–P3 findings. Owner approved completion within the approved scope on 2026-10-07, with browser/live-session checks deferred as NOT_VERIFIED due unavailable tooling before service startup, not an application defect. See feature document for exact limitations.

### F014 — Student Onboarding
**Dependencies:** F012, F013  
**Status:** `APPROVED_COMPLETE`

**Plan:** [F014 approved frontend onboarding](features/F014-student-onboarding.md). Frontend-only implementation; isolated live verification separately approved.

**Offline verification (2026-10-07; rerun 2026-10-08):** Focused onboarding 7/7, web 38/38 and API 116/116 PASS; root build/lint/typecheck/formatting and scope/secrets review PASS. Core live onboarding, exactly one four-field PATCH, account/password preservation and audit persistence PASS; API/web/MongoDB exits 0/0/0, wrapper 0 and cleanup PASS. Harness-only optional-array TypeError resolved; final review found no actionable P0-P3 findings. Owner approved completion on 2026-10-08 within the approved scope; remaining NOT_VERIFIED scenarios are listed in the feature document.

---

## Phase E — Technology & Learning Hierarchy

### F015 — Technology Catalog Backend

**Initial Data:** JavaScript definition only; not provisioned

**Dependencies:** F005

**Status:** `APPROVED_COMPLETE`

**Plan:** [F015 Technology Catalog Backend](features/F015-technology-catalog-backend.md).

**Verification:** Offline F015 10/10, API 126/126, web 38/38 PASS; root build/lint/typecheck/formatting and scope/secrets review PASS. Owner-approved isolated MongoDB integration 2/2 scenarios plus parent PASS; actual indexes/uniqueness, visibility/order/pagination, safe DTOs and non-mutating reads PASS. Child/wrapper/MongoDB exits 0/0/0; disconnect/shutdown/port/temp cleanup PASS. Final code review: no actionable P0-P3 findings. Owner approved completion as APPROVED_COMPLETE on 2026-10-09. Real JavaScript provisioning and normal Atlas startup remain NOT_VERIFIED; definition-only, no real Admin provenance, seed runner or automatic provisioning.

### F016 — Explore Technologies UI
**Dependencies:** F015, F013  
**Status:** `APPROVED_COMPLETE`

**Plan:** [F016 approved Explore UI](features/F016-explore-technologies-ui.md). Owner approved completion on 2026-10-10. Focused tests 15/15, web 54/54, API 126/126; build/lint/typecheck/formatting and scope/secrets review PASS. Approved live checks and resolved empty-page P3 PASS; final review found no actionable P0-P3 findings. Final run 182.1s, exits 0/0/0/0/0, cleanup PASS. Delivered-late race variants, hosted cookies and normal Atlas startup remain NOT_VERIFIED; detailed evidence/limits in the feature document.

### F017 — Learning Path Backend
**Dependencies:** F015  
**Status:** `APPROVED_COMPLETE`

**Plan:** [F017 approved Learning Path Backend plan](features/F017-learning-path-backend.md). Owner approved completion on 2026-10-10 after implementation, separately approved isolated integration and final review. Public read-only list/detail APIs and persistence only; no provisioning, authoring, completion calculations or frontend work. All recorded verification limitations remain preserved.

**Verification:** F017 offline 11/11, API 137/137, web 54/54 PASS; root build/lint/typecheck/formatting and diff/scope/secrets review PASS. Isolated MongoDB 4/4 PASS (three scenarios plus parent): indexes, parent-scoped uniqueness/concurrent duplicate rejection, published visibility, safe DTOs, ordering/pagination and non-mutating reads. Runtime 4.23s; initialization/test/shutdown-helper/MongoDB/wrapper exits 0/0/0/0/0; disconnect/graceful shutdown/port/temp cleanup PASS. Harness-only replSetName → replSet assertion and PowerShell spacing corrected; no application defect. Final review: no actionable P0–P3 findings. HTTP endpoints, invalid HTTP inputs/dependency failures and shared rate limiting against live MongoDB remain NOT_VERIFIED; normal Atlas startup also NOT_VERIFIED. See feature record for retained evidence and boundaries.

### F018 — Module Backend
**Dependencies:** F017  
**Status:** `APPROVED_COMPLETE`

**Plan:** [F018 approved Module Backend plan](features/F018-module-backend.md). Model and public read-only APIs only; owner-approved isolated verification completed; further execution separately gated.

**Verification:** F018 focused offline 12/12, complete API 149/149 and web 54/54 PASS; root build/lint/typecheck/formatting and diff/scope/secrets review PASS. Isolated MongoDB 4/4 PASS (three scenarios plus parent): indexes, parent-scoped/archive uniqueness and concurrent duplicate rejection, published three-level visibility and hierarchy consistency, safe DTOs, ordering/pagination, non-mutating reads and public HTTP validation/404/CORS/credential independence/shared rate limiting. Integration runtime 8.31s; wrapper 14.22s; initialization/test/shutdown-helper/MongoDB/wrapper exits 0/0/0/0/0. Disconnect/graceful shutdown/port release/temp cleanup PASS; no forced termination; repository unchanged by verification. P3 test-only correction removed unrelated invalid input, asserted exact validation paths/codes and separately tested unknown fields; focused re-review confirms resolution. Final review: no actionable P0-P3 findings. Live database dependency-failure injection and normal Atlas startup remain NOT_VERIFIED. Owner approved completion on 2026-10-10 within the approved scope.

### F019 — Topic Backend
**Dependencies:** F018  
**Status:** `APPROVED_COMPLETE`

**Plan:** [F019 approved Topic Backend plan](features/F019-topic-backend.md). Owner approved the backend-only model and public list/detail contracts, four-level hierarchy consistency and exact 17-file scope. Implementation and authorized verification are complete; owner approved completion on 2026-10-10 within the approved scope. Further MongoDB execution requires separate approval.

**Final verification:** Focused F019 15/15, full API 164/164 and web 54/54 PASS; root build/lint/typecheck/formatting and diff/scope/secrets review PASS. Isolated MongoDB integration 4/4 PASS (three scenarios plus parent): actual indexes, scoped/archive uniqueness, cross-parent reuse, concurrent duplicates, published four-level visibility, reference consistency/orphan exclusion, identical list/count filters, safe DTOs, ordering/pagination, non-mutating reads and live HTTP validation/404/CORS/shared rate limiting/credential independence where covered. Suite 2.25s; wrapper 6.09s; initialization/test/shutdown-helper/MongoDB/wrapper exits 0/0/0/0/0. Disconnect/graceful shutdown/port release/temp cleanup PASS; no forced termination or repository changes during integration. P3 detail-ID test corrected from literal `'\\n'` to newline escape `'\n'`, preserving exact `['params', 'id']` / `invalid_format` assertion; focused verification and read-only re-review PASS. Final review: no actionable P0-P3 findings. Live database dependency-failure injection and normal Atlas startup remain NOT_VERIFIED. F019 is APPROVED_COMPLETE following owner approval dated 2026-10-10.

### F020 — Learning Path Student UI
**Dependencies:** F017, F018, F019  
**Status:** `APPROVED_COMPLETE`

**Approved Plan:** [F020 Learning Path Student UI](features/F020-learning-path-student-ui.md). Owner approved frontend-only, read-only Technology to Learning Path to Module to Topic browsing, all four student routes, metadata-only Topic overview, generic Technology context, preserved auth/onboarding behavior and the exact 23-file scope. Implementation and offline verification are owner-authorized within the exact plan. Live verification requires separate explicit approval. F020 is APPROVED_COMPLETE for development closure following final owner approval dated 2026-10-11, with accepted verification deferrals and production-release blockers retained.

**Offline verification:** Focused F020 15/15, web 70/70 and API 164/164 PASS; root build/lint/typecheck/formatting and diff/scope/secrets review PASS. Four routes, credential-free catalog client, hierarchy validation, cancellation/account isolation, safe UI states and navigation are implemented within the approved 23-file scope. No backend/dependency/environment changes. Six owner-operated browser checks PASS: login, dashboard, Explore, Path -> Module -> Topic navigation, breadcrumbs/back links and Topic unavailable messaging. Latest final preservation, process containment and port release PASS; API/MongoDB/shutdown-helper exits 0/0/0. Disposable Next.js graceful shutdown FAILED (web exit 1 after its failure deadline); wrapper exit 1, supervisor FAIL, no Job Object forced termination. Evidence and stages preserved. This is a test-infrastructure failure, not a confirmed application defect.

**Accepted deferrals and release blockers:** Remaining session/role/onboarding boundaries, actual credential-free catalog requests and auth side effects, mounted pagination/focus/retry/direct-link/reload, responsive/keyboard/mobile interaction and cancellation/account-transition races remain NOT_VERIFIED. Hosted cookie behavior and normal Atlas startup remain NOT_VERIFIED. Owner accepts these limitations for development closure only: F020 is APPROVED_COMPLETE, but not fully browser-verified and not authorized for production release. An automated browser acceptance suite covering outstanding mandatory checks is required before release; unprovable variants remain explicit. Playwright setup requires separate approval. See the feature record for exact risks and retained evidence.

---

## Phase F — Concept Learning

### F021 — Concept Read Model + API
**Dependencies:** F019  
**Status:** `APPROVED_COMPLETE`

**Approved implementation:** [F021 Concept Read Model + API](features/F021-concept-read-model-api.md). Backend-only public list/detail reads, strict five-level published ancestry, topic-scoped uniqueness, safe summary/detail DTOs and untrusted Markdown/source metadata. Implementation and offline verification are authorized within the exact 17-file scope. One separately approved isolated MongoDB integration run is complete; further database execution requires separate approval. F022 and F020 browser acceptance remain outside this work.

**Offline verification:** Focused F021 17/17, final API regressions 181/181 and web regressions 75/75 PASS; root build/lint/typecheck/formatting and diff/scope/secrets review PASS. An initial existing module-route test-worker failure did not reproduce in isolation or the full rerun; see the feature record. No browser tests, new dependencies, staging or commits were performed.

**Isolated MongoDB verification:** 4/4 PASS (three scenarios plus parent). Actual indexes, scoped/archive uniqueness, cross-parent reuse, concurrent duplicate rejection, five-level published hierarchy/reference consistency, identical list/count filtering, safe DTOs, ordering/pagination, non-mutating reads and database-backed HTTP checks PASS. Cleanup PASS: disconnect, graceful shutdown, port release and owned temporary-directory removal; no forced termination. Wrapper runtime 20.18 seconds; initialization/test/shutdown/MongoDB/wrapper exits 0/0/0/0/0. All 17 approved files remained unchanged during verification.

**Final review and limitations:** No actionable application defect, security issue, API-contract mismatch or unauthorized change. P3 stale integration documentation is corrected. Live database dependency-failure injection and normal Atlas startup remain NOT_VERIFIED. Owner approved F021 as APPROVED_COMPLETE for development closure. F020 remains APPROVED_COMPLETE and F022 remains NOT_STARTED.

### F022 — Concept Read UI
**Dependencies:** F021  
**Status:** `APPROVED_COMPLETE`

**Approved plan:** [F022 Concept Read UI](features/F022-concept-read-ui.md). Owner authorized the 21-file frontend implementation, offline verification and separately gated browser runs. Owner approved development closure as APPROVED_COMPLETE and the scoped F022 commit/push to origin/dev; further execution requires separate approval. F020/F021 release limitations are preserved.

**Offline evidence:** F022 focused 22/22, web 98/98 and API 181/181 PASS. Root build/lint/typecheck/formatting and diff/scope/secrets review PASS. Topic Concept discovery, Read content, restricted Markdown/source links, strict DTO/ancestry validation and cancellation/account isolation are implemented. Approved react-markdown 10.1.0 is pinned. Playwright acceptance specifications and configuration pass static checks.

**Browser evidence and resolved review:** Chrome + Playwright 24/24 PASS across retained runs, not a single full-suite rerun. Browser/server process cleanup and all 21 F022 files' preservation PASS; test-owned processes exited and ports 3000/4000 were released. Markdown heading hierarchy, HTTP fault synchronization/scoped assertions, and same-document cancellation/STUDENT-to-STUDENT isolation test setup findings are resolved. Final application review found no actionable application defect, security issue, API mismatch or unauthorized change. Stale verification documentation is reconciled; F022 is APPROVED_COMPLETE following final owner approval for development closure.

**Retained limitations:** API-mocked browser tests do not establish real backend integration. Canceled responses do not prove internal generation-check execution. Graceful Windows web-server shutdown remains NOT_VERIFIED despite successful process cleanup. F020/F021 limitations remain unchanged; no production release is authorized. F023 was NOT_STARTED at F022 closure.

### F023 — Concept Example Mode
**Dependencies:** F021  
**Status:** `APPROVED_COMPLETE`

**Approved plan:** [F023 Concept Example Mode](features/F023-concept-example-mode.md). Implementation, separately approved browser/database verification and final review are complete. Owner approved development closure and the F023-only commit/push on 2026-10-13.

**Verification:** Focused API 21/21 and web 29/29 PASS; complete API 207/207 and web 105/105 PASS (312/312 combined). Root build/lint/typecheck/formatting, browser-spec static checks and scope/dependency/secrets review PASS. Chrome acceptance 16/16 PASS in one complete run, zero retries, 203.6s; owner-approved CLI failure-limit override only. Responsive grid overflow and first-scenario RSC synchronization findings are resolved with original timeout budgets preserved. Isolated MongoDB integration 4/4 PASS, suite 4.99s/procedure 14.15s, initialization/test/shutdown/MongoDB/wrapper exits 0/0/0/0/0; database isolation, graceful cleanup, port release and preservation PASS. Exact 22-file scope; no dependency changes or demo-record writes. Final review on 2026-10-13 found no actionable acceptance defects. F023 is APPROVED_COMPLETE following explicit owner approval.

**Retained limitations:** Mocked browser tests and real database-backed HTTP tests do not establish browser-to-live-backend integration. Canceled responses do not prove internal generation-check execution. Browser/process cleanup passed with forced Windows Next.js teardown; graceful web shutdown remains NOT_VERIFIED. Earlier intermittent development-route latency remains unexplained, although no final navigation exceeded its budget. Live database dependency-failure injection and normal Atlas startup remain NOT_VERIFIED. Existing F020-F022 release limitations and the separate local web STOP_TIMEOUT issue remain open. The two pre-existing Stop-helper changes remain outside F023. No production deployment is authorized; evidence locations and exact coverage are recorded in the feature document.

### F024 — Concept Revise Mode
**Dependencies:** F021  
**Status:** `APPROVED_COMPLETE`

**Approved plan:** [F024 Concept Revise Mode](features/F024-concept-revise-mode.md). Implementation, offline verification, separately approved browser/database verification and final review completed within 22 files (4 new, 18 modified). Optional strict Revise model/detail DTO and accessible Read/Example/Revise UI are implemented; list contracts, indexes, hierarchy, authentication and existing demo data remain unchanged. No dependencies added.

**Offline evidence:** Focused API 26/26 and web 33/33 PASS; full API 212/212 and web 109/109 PASS (321/321 combined). Build, lint, workspace typechecks, formatting, browser-spec static checks and scope/security review PASS. Retained passing offline results were reused without reruns at final review.

**Browser/database evidence:** F024 Chrome 19/19 and F023 compatibility 16/16 PASS in complete sequential runs, zero retries. The owner-approved F023 transition synchronization correction preserves the existing 10-second navigation/five-second UI budgets and security/cancellation assertions. Mounted keyboard/focus, responsive layouts, contained scrolling, Markdown/plain-text security, credential-free requests, Retry and account/resource isolation PASS. Chrome exited gracefully; owned Windows Next.js teardown was forced. Isolated MongoDB integration 4/4 PASS (three scenarios plus parent), suite 2.574s/procedure 6.4s, initialization/test/shutdown/MongoDB/wrapper exits 0/0/0/0/0. Fresh owned f021-test storage, PRIMARY/emptiness, database-backed Revise/detail/list/hierarchy/index behavior, non-mutating reads, graceful database cleanup and port release verified. File and persistent demo-storage preservation PASS.

**Final review and limitations:** PASS; exact 22-file scope, no actionable acceptance defects or unauthorized dependencies/endpoints/migrations. F024 is APPROVED_COMPLETE following explicit owner approval for development closure and the F024-only commit/push on 2026-10-13; production deployment is not authorized. Browser-to-live-backend integration, canceled-response internal generation-check execution, graceful Windows web shutdown, live dependency-failure injection and normal Atlas startup remain NOT_VERIFIED. F020-F023 release limitations, intermittent development-route latency and the separate Stop-helper/local STOP_TIMEOUT issue remain preserved. Playwright configuration consolidation is not implemented. See the feature document for evidence paths; configuration cleanup and F025 planning require separate owner approval.

### F025 — Source Link Requirement
**Dependencies:** F021  
**Status:** `APPROVED_COMPLETE`

**Approved scope:** [F025 source requirement](features/F025-source-link-requirement.md),
11 files; source-local validation/coercion hardening and existing safe footer reuse.
No API shape/index changes, source fetching or trust certification. PRD section 37
Admin approval/publishing integration is explicitly deferred to F047-F051.
Implementation, separately authorized browser/database verification and final
review passed. Existing release/tooling limitations remain.

**Offline verification:** Implementation complete within the approved eleven files.
Concept API plus mocked local-tooling checks 51/51 PASS; Concept web checks 36/36
PASS, including six new F025 tests. Build/lint/workspace typecheck/format and
browser-spec static checks PASS; retained results reused without reruns.

**Browser/database verification:** Targeted F025 Chrome 3/3 PASS. Full sequential
regressions: F022 27/27 (including three F025), F023 16/16, F024 19/19 and root
smoke 1/1; total 63/63 PASS, zero retries/failures/skips, all runner exits 0.
Combined startup/execution/cleanup-check wall time: 507.743s (8m 28s).
Mounted accessibility, responsiveness, safe links/Markdown, request security,
authentication boundaries, cancellation and account isolation passed.
Isolated MongoDB 4/4 PASS; corrected procedure confirmed PRIMARY before emptiness
checks and fixtures. Initialization/test/shutdown/MongoDB/wrapper exits all 0;
owned collection cleanup, graceful MongoDB exit, port release and disposable
storage removal PASS. Persistent demo storage and unrelated MongoDB preserved.

**Final review:** PASS; exact approved eleven-file scope, no actionable acceptance
defects or unauthorized dependencies/endpoints/indexes/migrations. Chrome exited
gracefully; Windows Next.js teardown was forced. Process/port cleanup and file
preservation PASS. Source trust/reachability and Admin publishing enforcement are
not established; F047-F051 retain the editorial gate. Mocked browser/live-backend,
canceled-response generation checks, graceful Windows web shutdown and prior
release/tooling limitations remain as documented in the feature plan, which lists
retained evidence paths. F025 is APPROVED_COMPLETE following explicit owner
approval on 2026-10-14, with feature-only commit/push authorized. All verification
evidence and release limitations remain retained; production deployment is not
authorized.

---

## Phase G — Visualization MVP

### F026 — Visualization Data Model
**Dependencies:** F021  
**Status:** `APPROVED_COMPLETE`

**Scope:** [Approved F026 contract](features/F026-visualization-data-model.md),
exactly seven files. Separate ANIMATED_FLOW/schemaVersion 1 visualization model,
strict bounded graph/step data and accessible inert text; both canonical
nonunique indexes retained. Optional animationConfig never receives an implicit
default; present autoplay must be explicit false. ObjectIds or exact 24-hex
reference strings only. No endpoint, renderer, dependency, migration or demo update.

**Offline verification:** Focused visualization 12/12 and existing Concept API
regressions 29/29 PASS (41/41 combined); build/lint/workspace typecheck/format and
scope/security checks PASS. Isolated MongoDB four scenarios plus parent 5/5 PASS;
graceful database cleanup, owned storage removal and isolation verified. Targeted
Chrome 2/2 and full F022/F025 27/27, F023 16/16, F024 19/19, smoke 1/1 PASS
(63/63, zero retries; 314.577s full stage). Final acceptance review PASS. Async validate()/validated save enforce whole-document
graph/size rules; validateSync, query/raw writes, referenced identity and future
authorization/publishing are not equivalent guarantees. All earlier feature
approvals and release/tooling limitations remain preserved. F026 APPROVED_COMPLETE
following explicit owner approval on 2026-10-15 for development closure and two
scoped commits/Git delivery. Production deployment and F027 are not authorized.

**Separate readiness maintenance:** Only the three existing feature Playwright
configurations now build/start Next.js with the explicit loopback API environment;
no assertions, timeouts, dependencies or root smoke configuration changed. These
are outside the seven-file F026 scope. Owned jobs emptied and ports released;
Chrome closed gracefully, Windows Next.js teardown was forced. Historical process
continuity remains UNVERIFIED; a new unrelated baseline exit is an observation,
not evidence of test-caused termination. Earlier failed runs remain retained. See
the feature document for exact evidence and validation/reference limitations.

### F027 — Visualization Renderer MVP
**Recommended First Type:** Animated execution flow  
**Dependencies:** F026  
**Status:** `APPROVED_COMPLETE`

**Scope:** [Approved renderer-only plan](features/F027-visualization-renderer-mvp.md).
Native React/SVG, strict F026-compatible authored projection, external selection,
bounded deterministic layout and accessible persistent text; no API or route integration.
**Offline verification (2026-10-15):** F027 23/23 and web 135/135 PASS;
workspace build/lint/typecheck/format PASS. Exactly ten approved files.
**Final regression/review (2026-10-15):** Playwright 63/63 PASS, zero retries:
F022/F025 27, F023 16, F024 19, smoke 1. All runner exits 0; browser stage
317.595 seconds including builds/cleanup. Owned jobs empty, no owned processes
remaining, required ports released. Existing Windows forced server teardown is
distinct from functional PASS; graceful Next.js shutdown remains unverified.
Exact ten-file renderer-only acceptance review PASS; source preservation PASS.
Evidence: `.cache/playwright/results/f027-final-2026-10-15-16-00-26-UTC/`.
Existing suites do not mount F027; no end-to-end visualization acceptance claim.
Mounted renderer geometry, focus/scrolling and assistive-technology acceptance
remain NOT_VERIFIED. No MongoDB integration applies. Prior release/tooling
limitations and F001-F026 approvals are preserved; F028 is not authorized.
Owner approved F027 development closure and feature-only Git delivery; no deployment.

### F028 — Visualization Controls
**Dependencies:** F027  
**Status:** `APPROVED_COMPLETE`

Final acceptance review PASS within the approved twelve-file playback/fixture scope.
Retained focused 21/21 and web 156/156 PASS; build/lint/typecheck/format/scope PASS.
Independent F028 13/13 and smoke 1/1 PASS, zero retries; retained F022/F025 27,
F023 16 and F024 19 reconcile to **76/76 SEGMENTED REGRESSION PASS**.
Current verification/cleanup took 80.780 seconds. Same-build disabled/enabled/disabled
fixture isolation PASS: disabled HTML 404, disabled RSC not-found payload without
fixture content. Mounted keyboard/focus, playback, responsive overflow and reduced
motion PASS; owned jobs empty and ports released. F024's worker-browser cleanup
conflict remains unresolved, so this is not a clean combined-run PASS.
Exhaustive screen-reader behavior, real background throttling, graceful Windows
application shutdown and end-to-end student integration remain NOT_VERIFIED.
See the F028 feature document for evidence and retained release limitations.
Owner approved F028 development closure and feature-only Git delivery on 2026-10-16;
all recorded limitations remain applicable. F029 is not authorized.

### F029 — First Real Visual Lesson
**Recommended Concept:** JavaScript Event Loop or Closure  
**Dependencies:** F028  
**Status:** `APPROVED_COMPLETE`

Owner approved the seven-file JavaScript Closure lesson implementation and offline
verification in [F029](features/F029-first-real-visual-lesson.md). Reuse F026-F028
unchanged in the gated fixture; no production student/Admin integration or persistence.
Offline implementation PASS: exact approved 6 nodes/7 edges/6 steps; focused 9/9
and web regressions 165/165 PASS. Build, lint, typecheck, formatting and seven-file
scope/security checks PASS. Owner-authorized final verification on 2026-10-16:
same-build absent/enabled/absent HTML/RSC fixture isolation PASS; 83/83 SEGMENTED
REGRESSION PASS (27 F022/F025, 16 F023, 19 F024, 13 F028, 7 F029, 1 smoke), zero
retries, 367.33 seconds. Mounted closure highlights/playback, keyboard focus,
reduced motion and 1280/768/390px containment PASS. Owned jobs empty and ports
released; Playwright Windows server teardown remains forced. Final review PASS.
Retain F024's worker-browser conflict, lack of clean combined-run evidence,
screen-reader/background-throttling gaps and existing release limitations.
Student Concept integration and Admin publishing remain deferred. Evidence and
cleanup details are recorded in the feature document. Owner approved completion
and the seven-file Git delivery on 2026-10-16, preserving all limitations.
No database operations or production deployment authorized. F030 is not authorized.

---

## Phase H — Practice

### F030 — Practice Question Base Model
**Dependencies:** F021  
**Status:** `APPROVED_COMPLETE`

Owner approved the seven-file backend model scope in
[F030](features/F030-practice-question-base-model.md), including canonical question
types, all-type inert question-context code, strict validation and defensive answer
projection. No API/UI, evaluation, submissions or publishing implementation.
Implementation/offline verification PASS (2026-10-16): focused model tests 13/13,
relevant Concept/Visualization API regressions 41/41, workspace build/lint/typecheck/
format checks PASS. Exact seven-file scope preserved. Guarded integration coverage
passed 5/5 including its parent test; isolated persistence/projection/index checks
and disposable cleanup PASS. No answer-unlock or publishing authorization is implemented.
Final acceptance review PASS (2026-10-16). Browser evidence: 83/83 DISTINCT
SCENARIOS WITH PASSING EVIDENCE - SEGMENTED REGRESSION WITH ONE RECOVERED
INTERMITTENT FAILURE (77 retained + 1 independent recovery + 5 newly passing).
The historical F029 ArrowDown failure remains unresolved, root cause INCONCLUSIVE;
no permanent fix or clean single-invocation PASS is claimed. F024 worker-browser,
screen-reader/background-throttling and Windows shutdown limitations remain.
See F030 for retained evidence and deferred reference/answer-authorization/API work.
Owner completion and seven-file Git delivery approved (2026-10-16). All limitations
remain retained. F031 remains NOT_STARTED; its planning requires separate approval.

### F031 — Output-Based Questions
**Goal:** Implement one question type end-to-end first.  
**Dependencies:** F030  
**Status:** `APPROVED_COMPLETE`

Owner approved the [F031 plan](features/F031-output-based-questions.md), its refined
contracts and the 32-file implementation scope (22 new, 10 modified). The added
Concept rendering test replaces an obsolete Practice-text prohibition while
preserving security and completion/XP restrictions. Offline API regressions:
75/75 PASS; web regressions: 181/181 PASS; build, lint, TypeScript and formatting PASS.
Live disposable MongoDB: 5/5 PASS including parent; F031 mounted browser: 14/14
distinct scenarios with passing evidence, including an independently recovered
locator failure. **FINAL REVIEW PASS WITH ONE-TIME REGRESSION EXCEPTION**
(owner-approved 2026-10-17, local-development acceptance only).

Actual browser regression: **40 PASS / 1 FAIL / 56 NOT_RUN, total 97**.
F022 functional assertions passed, but afterAll signal-0 probing raised EPERM;
the suite failed and the historical cause remains inconclusive. This is incomplete
segmented evidence, never 97/97 PASS or a clean combined-run PASS. The 56 NOT_RUN
cases leave shared-authentication and Concept-publication browser compatibility
risk despite focused offline/live coverage. The exception does not authorize
production or waive process safety. Primary-host diagnostics remain blocked.

Separate owner-gated follow-ups: safe F022 Windows teardown/PID identity handling,
F024 worker-browser cleanup conflict, completion of the 56 NOT_RUN cases, and F029
intermittent ArrowDown investigation if it recurs. Retain screen-reader/background-
throttling gaps, Windows graceful-shutdown/taskkill PID-reuse risk and historical
failure/recovery evidence. See F031 Section 12 for the full matrix and exception
boundaries. Owner approved F031 completion and feature-only Git delivery for
local-development acceptance. Further remediation and F032 planning remain gated.
No submissions, answer unlocking, scoring, persistence or F032 implementation.

### F032 — Descriptive Questions
Status: `APPROVED_COMPLETE`

**FINAL REVIEW PASS WITH F032 BROWSER EXCEPTION** (owner approval 2026-10-18),
for local development only; not production approval or full browser acceptance.
Owner completion approval (2026-10-18) is for LOCAL DEVELOPMENT ONLY and authorizes
the scoped 20-file Git delivery, including the separately approved AGENTS.md policy.
The approved [F032 plan](features/F032-descriptive-questions.md) retains its
19-file implementation boundary. AGENTS.md is a separately approved policy change.
Retained evidence: focused API 15/15, 63 distinct API PASS; focused web 21/21,
189 distinct web PASS (reconciled evidence); disposable MongoDB 6/6 PASS including
parent; build, lint, TypeScript, formatting, security and cleanup PASS.

F032 mounted acceptance: **7 NOT_RUN**. Expected complete F032 browser regression:
**104 NOT_RUN**, including those seven and the existing 97; no new discovery/run.
Responsive behavior, keyboard/focus/accessibility, real-browser account-switch/
draft-isolation races and shared authentication/Concept-publication compatibility
remain unverified and explicitly owner-accepted for local development only.
This new F032-specific exception does not inherit F031's exception and does not
transfer to F033 or any other feature. Manual browser inspection was not performed
in this gate and cannot replace automated evidence. No browser PASS is claimed.

Infrastructure investigation is closed. Retain Gate 1 synthetic 10/10 and Gate 2
synthetic 10/10 PASS; the prototype is not a verified Playwright execution solution.
Positive /T cleanup remains unsupported, browser/worker/server fallbacks unverified,
and native/internal bypasses uncontrolled. Primary-host Playwright remains
prohibited pending separate ownership-safe approval. The temporary package and
all evidence are preserved without modification, execution or deletion.

Retain historical F022 EPERM/ownership and taskkill PID-reuse risks, F024 shared-worker
cleanup conflict, F029 intermittent scrolling/recovery, and screen-reader,
background-throttling and Windows shutdown gaps. F031's historical 40 PASS /
1 FAIL / 56 NOT_RUN is unchanged; the outstanding cases still need future coverage.
Future ownership-safe mounted/segmented regression and release-readiness review
require separate approvals. Owner completion approval retains the browser exception.
See F032 Sections 10-11 for the evidence matrix, scope review and completion approval.

### F033 — Scenario-Based Questions
Status: `APPROVED_COMPLETE`

Owner approved implementation and offline verification (2026-10-18) within the
exact 17-file [F033 plan](features/F033-scenario-based-questions.md). Extend the
existing authenticated Practice flow with SCENARIO while preserving default
OUTPUT, DESCRIPTIVE compatibility, publication/DTO secrecy and three-type
memory-only drafts. Final review: **FINAL REVIEW PASS WITH F033 BROWSER EXCEPTION**
following explicit owner approval (2026-10-18) for LOCAL DEVELOPMENT ONLY.
Owner subsequently approved completion and the exact 17-file feature-only commit
and safe push to origin/dev (2026-10-18), retaining this local-only exception.
The one-time F033-specific exception is permitted by AGENTS.md; it is not inherited
from F032 and does not transfer to F034 or future features. No production approval,
infrastructure investigation or F034 work is authorized.

Offline implementation PASS: focused API 16/16 and relevant API regressions 44/44
(60 distinct); focused web 28/28 and remaining web regressions 168/168 (196 distinct).
Build, lint, TypeScript, formatting, browser-spec compile-only and scope/security
checks PASS. A test-only mock return annotation resolved an initial API typecheck
error; runtime assertions were unchanged, and only affected static checks reran.
Exact 17-file scope; no new dependencies, model/index or shared-auth/publication
changes. Owner-authorized disposable MongoDB integration: 7/7 PASS including parent,
with publication/ancestry, three-type compatibility, DTO secrecy and immutable reads.
Its initial wrapper exited nonzero after a cleanup port-query typo; the historical
error remains recorded. Authorized separate cleanup completed without test/server
reruns: graceful Mongo exit, owned Job empty, port released, owned storage removed
and protected MongoDB/development identities/demo metadata unchanged. No forced kill.

F033 mounted acceptance: **7 NOT_RUN**. Seven cases are prepared; runtime behavior
remains NOT_VERIFIED. The owner explicitly accepts local-development risks for
responsive/mobile layout, real keyboard/focus/accessibility, three-type draft
retention/account isolation during navigation, cancellation/stale-response races
and shared authentication/Concept-publication compatibility. No browser PASS or
complete regression acceptance is claimed. No security/API/database check is waived.
Expected complete regression: 111 NOT_RUN including the previous 104; no discovery
or browser execution. This total INCLUDES the seven F033 cases. Historical F031
40 PASS / 1 FAIL / 56 NOT_RUN and F032's 7/104 NOT_RUN remain unchanged.
Existing F022 EPERM/taskkill PID-reuse, F024 worker lifecycle, F029 intermittent
scrolling/recovery, screen-reader/background-throttling and Windows shutdown gaps
persist. Primary-host Playwright remains prohibited pending separate ownership-safe
approval; the closed prototype and its evidence are untouched. Manual checks are
supplemental only. Future browser regression and production release-readiness need
separate approval. F033 completion is owner-approved for local development only;
the scoped Git delivery is authorized. No browser PASS or production readiness.
See F033 Sections 8-11 for retained evidence, cleanup history and exception boundaries.

### F034 — Coding Questions
Status: `APPROVED_COMPLETE`

Owner approved the exact 16-file F034 implementation/offline scope (2026-10-18).
Extend existing Practice retrieval and memory-only drafts to CODING, preserving
OUTPUT default and all F031-F033 security/publication contracts. No execution,
submissions, model/index changes or new dependencies. MongoDB integration was
separately authorized and passed; browser execution remains prohibited. Seven F034
mounted cases and expected full 118 remain NOT_RUN. No prior exception transfers.
See [F034 plan](features/F034-coding-questions.md).

Offline implementation PASS: focused API 17/17 plus relevant regressions 44/44
(61 distinct); focused web 33 distinct plus remaining regressions 168/168
(201 distinct). Build, TypeScript, formatting, browser-spec compile-only and
scope/security checks PASS. Root lint found one new test-regex spacing issue;
equivalent assertion correction and targeted lint/reverification PASS. Separate
formal code review: no Critical/High/Medium/Low findings. Exact sixteen-path scope
preserved. MongoDB integration subsequently passed 8/8 including the parent,
with graceful cleanup, no force, empty Job, free port and removed disposable
storage; protected MongoDB/development identities and demo metadata unchanged.
Preserve the initial blocked MongoDB enumeration attempt, forced owned-Job cleanup
and UNKNOWN retained exit, separately from the successful authorized fresh run.

FINAL REVIEW PASS WITH F034 BROWSER EXCEPTION (2026-10-18): owner explicitly accepts
one-time F034 LOCAL DEVELOPMENT ONLY browser deferral under AGENTS.md. Seven mounted
scenarios and expected full regression 118, including those seven, remain NOT_RUN;
no browser PASS, full-regression acceptance or production readiness. Unverified
Coding layout/responsiveness, real textarea whitespace, keyboard/focus/accessibility,
navigation/draft isolation, cancellation/stale races and shared authentication/
Concept-publication compatibility are owner-accepted local risks. Exception does
not transfer to another feature. Separate final code review found no Critical,
High, Medium or Low defects. Retain initial sandbox/JSX/lint history, F022 EPERM/
PID/taskkill safety, F024 worker-browser conflict, F029 intermittent scrolling and
screen-reader/background-throttling/Windows shutdown gaps. Primary-host Playwright
remains prohibited; do not reopen the closed prototype. Future ownership-safe
browser verification and preproduction browser-regression/release-readiness review
require separate approval. Manual checks are supplemental. See F034 Sections 9-12.
Owner explicitly approved APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY and scoped
sixteen-file commit/safe push to origin/dev (2026-10-18). The named browser exception
and all historical evidence remain unchanged; no browser PASS or production
readiness is claimed. See F034 Section 13. F035 remains NOT_STARTED and its
implementation is not authorized.

### F035 — Answer Unlock Flow
**Dependencies:** F031  
**Status:** `NOT_STARTED`

---

## Phase I — Progress & Attempts

### F036 — Practice Attempts Persistence
**Dependencies:** F031  
**Status:** `NOT_STARTED`

### F037 — Student Concept Progress
**Dependencies:** F036  
**Status:** `NOT_STARTED`

### F038 — Completion Rules
**Default Passing Score:** 70%  
**Dependencies:** F037  
**Status:** `NOT_STARTED`

### F039 — Weak / Improving / Strong Classification
**Dependencies:** F037  
**Status:** `NOT_STARTED`

---

## Phase J — Student Dashboard

### F040 — Dashboard API
**Dependencies:** F037, F039  
**Status:** `NOT_STARTED`

### F041 — Student Dashboard Real Data
**Dependencies:** F040  
**Status:** `NOT_STARTED`

---

## Phase K — Admin Content Management

### F042 — Admin Route Protection
**Dependencies:** F008  
**Status:** `NOT_STARTED`

### F043 — Admin Technology Management
Status: `NOT_STARTED`

### F044 — Admin Learning Path Management
Status: `NOT_STARTED`

### F045 — Admin Module Management
Status: `NOT_STARTED`

### F046 — Admin Topic Management
Status: `NOT_STARTED`

### F047 — Admin Concept Management
Status: `NOT_STARTED`

### F048 — Admin Concept Editor
**Dependencies:** F047  
**Status:** `NOT_STARTED`

---

## Phase L — Content Approval Workflow

### F049 — Content Status Workflow
**States:** DRAFT, AI_GENERATED, IN_REVIEW, CHANGES_REQUIRED, APPROVED, PUBLISHED, ARCHIVED  
**Dependencies:** F047  
**Status:** `NOT_STARTED`

### F050 — Approval Queue
Status: `NOT_STARTED`

### F051 — Publish / Archive Flow
Status: `NOT_STARTED`

---

## Phase M — AI Draft Generation

### F052 — AI Provider Abstraction
**Dependencies:** F049  
**Status:** `NOT_STARTED`

### F053 — AI Security & Usage Controls
**Dependencies:** F052  
**Status:** `NOT_STARTED`

### F054 — AI Concept Draft Generation
Status: `NOT_STARTED`

### F055 — AI Visualization Suggestion
Status: `NOT_STARTED`

### F056 — AI Practice Question Generation
Status: `NOT_STARTED`

### F057 — AI Revision / Flashcard Generation
Status: `NOT_STARTED`

---

## Phase N — Interview Preparation

### F058 — Interview Question Model + API
Status: `NOT_STARTED`

### F059 — Interview Student UI
Status: `NOT_STARTED`

### F060 — Know / Need Revision / Important State
Status: `NOT_STARTED`

### F061 — Admin Interview Management
Status: `NOT_STARTED`

---

## Phase O — Student Productivity

### F062 — Bookmarks
Status: `NOT_STARTED`

### F063 — Notes
Status: `NOT_STARTED`

### F064 — Highlights
Status: `NOT_STARTED`

---

## Phase P — Gamification

### F065 — XP
Status: `NOT_STARTED`

### F066 — Learning Streak
Status: `NOT_STARTED`

### F067 — Badges
Status: `NOT_STARTED`

---

## Phase Q — Notifications

### F068 — In-App Notifications
Status: `NOT_STARTED`

### F069 — Auth Emails
Status: `NOT_STARTED`

---

## Phase R — Analytics & Content Quality

### F070 — Analytics Event Tracking
Status: `NOT_STARTED`

### F071 — Aggregate Admin Analytics
Status: `NOT_STARTED`

### F072 — Content Performance Analytics
Status: `NOT_STARTED`

### F073 — Content Quality Alerts
Status: `NOT_STARTED`

### F074 — Report Incorrect Content
Status: `NOT_STARTED`

---

## Phase S — Media / S3

### F075 — S3 Media Service
**Scope:** images, SVG, GIF, presigned uploads, private bucket  
**Status:** `NOT_STARTED`

### F076 — Media Metadata
Status: `NOT_STARTED`

---

## Phase T — Search

### F077 — Basic Search
**Scope:** technology, topic, concept, interview question  
**Status:** `NOT_STARTED`

---

## Phase U — Premium / Entitlements

### F078 — Entitlement Service
Status: `NOT_STARTED`

### F079 — Free/Premium Feature Rules
**Note:** All features enabled during development via configuration.  
**Status:** `NOT_STARTED`

---

## Phase V — Hardening

### F080 — Security Review
Status: `NOT_STARTED`

### F081 — Accessibility Review
Status: `NOT_STARTED`

### F082 — Performance Review
Status: `NOT_STARTED`

### F083 — Error/Failure UX Review
Status: `NOT_STARTED`

---

## Phase W — Testing

### F084 — Backend Unit Tests
Status: `NOT_STARTED`

### F085 — API Integration Tests
Status: `NOT_STARTED`

### F086 — Web Component/Feature Tests
Status: `NOT_STARTED`

### F087 — Admin Tests
Status: `NOT_STARTED`

### F088 — End-to-End Critical User Journey
**Journey:** Register → Login → Learn → Practice → Progress  
**Status:** `NOT_STARTED`

---

## Phase X — Deployment

### F089 — Development Deployment
Status: `NOT_STARTED`

### F090 — Production Environment Setup
Status: `NOT_STARTED`

### F091 — Logging / Monitoring
Status: `NOT_STARTED`

### F092 — Backup / Recovery Strategy
Status: `NOT_STARTED`

---

# 7. Future / Post-MVP Backlog

- PWA
- offline learning
- push notifications
- payment integration
- subscription billing
- Student AI Tutor
- AI topic search
- on-demand AI lesson generation
- teacher accounts
- institution accounts
- mobile apps
- leaderboard
- certificates
- advanced visual editor
- Node.js remote execution
- advanced analytics infrastructure
- CDN / CloudFront optimization

---

# 8. Per-Feature Checklist Template

```markdown
## FXXX — Feature Name

Status: `IN_DISCUSSION`

### Goal
What this feature must achieve.

### Scope
- item
- item

### Out of Scope
- item
- item

### Dependencies
- FXXX

### Acceptance Criteria
- [ ] criterion
- [ ] criterion

### Verification
- [ ] build
- [ ] lint
- [ ] typecheck
- [ ] tests
- [ ] manual smoke test

### Files / Modules Affected
- TBD

### Risks / Notes
- TBD

### Completion Summary
- Pending

### Commit / PR
- Pending

### Owner Approval
- Pending
```

---

# 9. Prompt — Start a Feature

```text
Read:
- docs/PRD.md
- docs/SYSTEM_ARCHITECTURE.md
- docs/DATABASE_DESIGN.md
- docs/API_DESIGN.md
- docs/DEVELOPMENT_ROADMAP.md

We are starting feature <FEATURE_ID> — <FEATURE_NAME>.

First:
1. Read the feature scope, dependencies, acceptance criteria, and out-of-scope items from DEVELOPMENT_ROADMAP.md.
2. Inspect the current repository.
3. Explain your implementation plan.
4. List files you expect to create or modify.
5. Identify any ambiguity or conflict.

DO NOT implement anything yet.

Stop and ask for my approval before making changes.
```

---

# 10. Prompt — Approve Feature Implementation

```text
I approve the implementation plan for <FEATURE_ID>.

Update DEVELOPMENT_ROADMAP.md:
- set <FEATURE_ID> status to IN_PROGRESS

Then implement ONLY this feature.

Do not implement future features.

After implementation:
1. run required verification
2. update the feature status to READY_FOR_REVIEW
3. add completion notes
4. add changed files
5. add verification results
6. report any warnings
7. STOP

Do not mark the feature APPROVED_COMPLETE.
```

---

# 11. Prompt — Review a Completed Feature

```text
Review feature <FEATURE_ID> against its acceptance criteria in DEVELOPMENT_ROADMAP.md.

Do not modify code yet.

Check:
- scope
- out-of-scope compliance
- architecture consistency
- build
- lint
- typecheck
- tests
- security implications
- unnecessary dependencies
- maintainability

Give me:
1. PASS/FAIL for every acceptance criterion
2. issues found
3. recommended fixes
4. whether it is ready for owner approval

Do not mark it APPROVED_COMPLETE.
```

---

# 12. Prompt — Mark Feature Approved Complete

```text
Feature <FEATURE_ID> is approved by me.

Update docs/DEVELOPMENT_ROADMAP.md:

1. Change <FEATURE_ID> status from READY_FOR_REVIEW to APPROVED_COMPLETE.
2. Add the final completion summary.
3. Add commit/PR reference if available.
4. Add approval date.
5. Do not start the next feature.
6. Show me which feature is next according to dependencies and roadmap.
7. Set no next feature to APPROVED_TO_BUILD until I explicitly approve it.
```

---

# 13. Prompt — Approve the Next Feature

```text
I approve <FEATURE_ID> — <FEATURE_NAME> as the next feature.

Update DEVELOPMENT_ROADMAP.md:
- set <FEATURE_ID> to APPROVED_TO_BUILD
- set Current Feature to <FEATURE_ID>

Do not implement yet.

First provide the implementation plan and ask me for approval.
```

---

# 14. Prompt — Mark Feature Blocked

```text
Feature <FEATURE_ID> is blocked.

Update DEVELOPMENT_ROADMAP.md:
- status = BLOCKED
- add blocker description
- add what is needed to unblock
- add affected dependencies

Do not work around the blocker by changing architecture or expanding scope.

Stop after updating the roadmap and report the blocker.
```

---

# 15. Current Feature Pointer

**Current Feature:** F034 - Coding Questions
**Current Status:** `APPROVED_COMPLETE`
**Next Feature:** F035 - Answer Unlock Flow (not authorized)

**Rule:** F005-F009 are APPROVED_COMPLETE. F009 owner completion approval is dated 2026-10-01 and preserves its backend-only scope and documented limitations. F010 is APPROVED_COMPLETE following owner approval dated 2026-10-03; approved scope, verification evidence and limitations remain unchanged. F011 is APPROVED_COMPLETE following owner approval dated 2026-10-05; F012 is APPROVED_COMPLETE following owner approval dated 2026-10-06 within its backend-only scope; F013 is APPROVED_COMPLETE following owner approval dated 2026-10-07 with the live-verification deferral preserved; F014 is APPROVED_COMPLETE following owner approval dated 2026-10-08 within its frontend-only scope, with verification limitations preserved; F015 is APPROVED_COMPLETE following owner completion approval dated 2026-10-09; isolated integration passed, while real JavaScript provisioning and normal Atlas startup remain NOT_VERIFIED. F016 is APPROVED_COMPLETE following owner completion approval dated 2026-10-10; approved frontend-only scope and documented verification limitations remain preserved. F017 is APPROVED_COMPLETE following owner completion approval dated 2026-10-10 within its approved backend-only scope; verification limitations remain preserved, further database execution remains separately gated, and F018 is APPROVED_COMPLETE following owner completion approval dated 2026-10-10, after implementation, isolated verification and resolved P3 re-review; verification limitations remain preserved and further database execution remains separately gated. F019 is APPROVED_COMPLETE following owner approval dated 2026-10-10 after offline/integration verification and resolved P3 re-review; approved scope and limitations are preserved, further database execution is separately gated. F020 is APPROVED_COMPLETE for development closure following final owner approval dated 2026-10-11. Accepted live-verification deferrals and the disposable web graceful-shutdown failure remain documented. Production release is not authorized; automated browser acceptance is required before release, with Playwright setup separately gated.
---

# 16. Definition of Done for Every Feature

## Local-development testing policy (owner-approved 2026-10-18)

Apply AGENTS.md's local-development verification policy to this checklist.
Focused unit tests, relevant API/frontend regressions, build/lint/TypeScript/
formatting, security/scope review and applicable disposable MongoDB integration
remain mandatory. Only browser-dependent verification may be deferred for a
documented infrastructure safety concern with explicit feature-specific owner
approval. Record exact NOT_RUN coverage, obtained evidence, accepted risks,
future verification and non-transferability; never tick unexecuted checks as PASS.
Manual browser inspection is supplemental. No earlier result is rewritten.
Production requires a separate approved browser-regression/release-readiness gate.

F032 alone has the explicitly approved exception below; neither the general
policy nor F031's previous exception grants any future feature a deferral.


A feature is ready for owner approval only when:

- [ ] scope is fully implemented
- [ ] out-of-scope work was not added
- [ ] build passes
- [ ] lint passes
- [ ] typecheck passes
- [ ] required tests pass
- [ ] manual smoke test is complete
- [ ] no critical warnings remain
- [ ] documentation is updated where needed
- [ ] `DEVELOPMENT_ROADMAP.md` is updated
- [ ] Codex reports exact files changed
- [ ] Codex stops at `READY_FOR_REVIEW`

Only the project owner can move it to `APPROVED_COMPLETE`.

---

# 17. Development Philosophy

```text
Discuss
   ↓
Approve Plan
   ↓
Build One Feature
   ↓
Verify
   ↓
Review
   ↓
Owner Approval
   ↓
Mark Complete
   ↓
Choose Next Feature
```

Prefer vertical slices:

```text
One small capability
UI + API + DB + Validation + Tests
DONE
↓
Next capability
```

Do not build the advanced version of a feature before the simple version works end-to-end.

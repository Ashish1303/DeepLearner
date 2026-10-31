# DeepLearner Development Roadmap & Feature Gate

**Document:** DeepLearner Development Roadmap  
**Purpose:** Execution checklist and approval gate for Codex-driven development  
**Status:** Active  
**Owner:** Project Owner  
**Rule:** Codex must implement only one approved feature at a time.

**2026-10-31 documentation-only direction approval:** Section 18 reconciles the
AI Content Studio, separate Interview Preparation and persistent LOCAL prerequisite.
Existing feature IDs, statuses, current pointer and historical evidence are retained.
No tooling/feature implementation, provisioning, runtime execution or Git delivery
is authorized by this update. F044 remains NOT_STARTED and not authorized.

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
**Status:** `APPROVED_COMPLETE`

Owner approved P1-P8 reconciliation and the expanded 27-file implementation/offline
scope (2026-10-18). Canonical LOCAL-only POST /practice-questions/:questionId/unlock
qualifies a nonblank submitted answer before a five-field response. This temporary
local submit-to-reveal creates no immutable attempt, score or progress; F036 must
establish durable attempt policy before deployment. GET remains seven-field and
answer-free. See [F035 plan](features/F035-answer-unlock-flow.md).
Owner approved the narrow app.ts exact-route POST no-store touchpoint before
CORS/JSON parsing; no broad prefix matching. Offline implementation PASS: 86 distinct
API tests (27 focused + 44 relevant + 15 shared HTTP/logging), 210 distinct web
tests (42 focused + 168 regression), build/lint/typecheck/format/browser-spec static
and exact-scope/security/UTF-8/LF/whitespace checks PASS. Separate formal review:
no Critical/High/Medium findings; one Low Retry-focus finding corrected and
rechecked, none unresolved. The initial UTF-16 boundary/rendering-check failures
and corrected passing evidence are retained.

Separately authorized disposable MongoDB integration: **9/9 PASS**, one invocation,
zero retries. Fresh owned 27018/f021-test/deeplearner-f021-test PRIMARY and empty
target verified; full ancestry/reference checks, four-type qualified disclosure,
STUDENT authorization, exact five-field DTO, GET secrecy and nonmutating reads
passed. LOCAL-only/strict-input/rate/error no-store negatives retain offline
evidence rather than being claimed as repeated database assertions. Graceful
shutdown PASS, no force, Job empty, port released, handles/storage released and
protected MongoDB/development identities/demo metadata unchanged. Preserve the
initial ownership-blocked attempt, inconclusive original subcheck and forced
cleanup/UNKNOWN exit; separate diagnostic confirmed the native/CIM precision
mismatch. Authorized common-microsecond UTC comparison preserved raw values and
exact native-handle identity; all other ownership safeguards remained intact.

**FINAL REVIEW PASS WITH F035 BROWSER EXCEPTION (2026-10-18).** Final security
review found no unresolved Critical/High/Medium/Low finding. Exactly 27 approved
paths; all non-feature-document source hashes match retained passing evidence.
Owner explicitly accepts this ONE-TIME, F035-only exception for LOCAL DEVELOPMENT
ONLY under AGENTS.md: **7 mounted NOT_RUN; expected full regression 125 NOT_RUN,
INCLUDING those seven**. No runtime discovery, browser PASS, complete regression
acceptance or production readiness is claimed. Unverified Submit/Retry behavior,
answer/explanation rendering, responsiveness, real keyboard/focus/accessibility,
identity/cancellation races, account/question reveal isolation and earlier Practice/
shared-authentication/Concept-publication compatibility remain accepted local risks.
No security/API/database test is waived; no prior or future feature inherits this
exception. Historical F022 EPERM/taskkill PID-reuse, F024 worker lifecycle, F029
intermittent scrolling/recovery and screen-reader/background-throttling/Windows
shutdown gaps remain. Primary-host Playwright stays prohibited pending separate
ownership-safe approval; the stopped prototype is untouched. Manual checks are
supplemental only. Required future verification: approved safe execution, actual
discovery, all 125 expected scenarios with F024 segmentation, zero retries and
existing budgets, then separately approved browser-regression/release readiness.

F035 is temporary nonpersistent submit-to-reveal and does NOT create immutable
practice attempts. F036 must implement durable owned attempts and the final
answer-unlock prerequisite before Internet deployment, with no transient fallback
on persistence failure. Owner explicitly approved F035 APPROVED_COMPLETE for LOCAL
DEVELOPMENT ONLY and the exact twenty-seven-file commit/safe push to origin/dev
(2026-10-18). The feature-specific browser exception and all prior evidence remain
unchanged; no browser PASS, production readiness or deployment is authorized.
F001-F034 remain APPROVED_COMPLETE and F036 NOT_STARTED. See F035 Sections 11-15.

---

## Phase I — Progress & Attempts

### F036 — Practice Attempts Persistence
**Dependencies:** F031  
**Status:** `APPROVED_COMPLETE`

Owner approved the exact 27-path F036 implementation/offline scope and P1-P5
(2026-10-18). Replace LOCAL-only transient disclosure with immutable SUBMITTED,
null-score attempts, account-scoped idempotency, revision binding and confirmed
commit/ownership before answers. No grading, execution or F037 progress. Index
creation is permitted only in separately approved disposable integration tests;
missing prerequisites fail closed. Browser expected 133 NOT_RUN including eight
new F036 cases and the existing 125; no earlier exception transfers. MongoDB and
browser execution remain separately gated. See [F036 plan](features/F036-practice-attempts-persistence.md).

Offline implementation PASS: 44 focused API/model/repository/HTTP tests plus 54
relevant regressions (98 distinct passing evidence); focused web 48 plus remaining
168 regressions (216 distinct passing evidence). Build, TypeScript, lint and
browser-spec compilation passed; final formatting/scope evidence is retained in
the feature document. Separate source review found no Critical/High/Medium issue;
two Low findings were corrected (explicit refusal refresh/focus and a prepared
OPTIONS mock). No unresolved finding. Strict owned commit proof, GET secrecy,
five-field answers/four-field receipt, LOCAL/no-store/rate behavior and bounded
idempotency/reveal isolation are verified at source/offline level. No grading,
execution, progress, dependencies or additional paths.

Guarded MongoDB initially produced 7 PASS / 3 FAIL (including the parent) because
operation timeoutMS conflicted with timed withTransaction. Preserve that failure.
The separately authorized correction uses the transaction deadline inside its
callback and bounded post-commit reads; 13 distinct focused cases passed. The one
fresh guarded rerun passed 10/10 including parent, with owned disposable indexes,
real durable/idempotent/concurrent submissions and graceful cleanup; protected
baselines unchanged. Persistent index provisioning remains unauthorized and missing
runtime prerequisites fail closed. Retained API 98/frontend 216 and static/security
evidence remains; no full-suite rerun is implied by focused verification.

FINAL REVIEW PASS WITH F036 BROWSER EXCEPTION (2026-10-18), LOCAL DEVELOPMENT ONLY.
Final source/security review: no unresolved Critical/High/Medium/Low findings;
exact approved 27-file scope retained. Owner explicitly accepts the one-time F036
deferral: eight new mounted cases NOT_RUN; complete expected 133 NOT_RUN includes
those eight and the earlier 125. No browser PASS, production readiness or future
exception is implied. Primary-host Playwright remains prohibited. Unverified risks
include submit/retry, saved receipts, keyboard/focus, responsive behavior, post-
commit network interruption, stale responses, account/Concept/question/revision
isolation and F031-F035 compatibility. Preserve F022/F024/F029, Windows taskkill/
shutdown, screen-reader/background-throttling and all historical verification gaps.
Private attempt retention/erasure/backups, persistent prerequisites and separately
approved browser-regression/release readiness remain deployment gates. See F036
Sections 11-14. Owner explicitly approved completion on 2026-10-18 for LOCAL
DEVELOPMENT ONLY and authorized scoped 27-file Git delivery after preflight.
F001-F035 APPROVED_COMPLETE; F037 NOT_STARTED. No browser PASS, production deployment,
future exception or next-feature work is authorized by this approval.

### F037 — Student Concept Progress
**Dependencies:** F036  
**Status:** `APPROVED_COMPLETE`

Owner approved the exact 33-path activity-only implementation/offline scope and
clarified strict unique-index readiness for BOTH progress GET and submission writes.
Missing/incorrect/unverifiable indexes fail closed; no automatic provisioning.
Attempt and activity summary changes are atomic; no completion, mastery, score,
XP or F038/F039 work. F036 disclosure/durability rules remain unchanged. Browser
expected 141 NOT_RUN includes 133 existing plus eight prepared F037 cases; no prior
exception transfers. Further database/browser execution remains separately gated.
Offline evidence: 117 distinct API and 229 distinct frontend tests have passing
evidence; build, lint, workspace TypeScript, formatting and browser-spec static
compilation pass. The separate source/security review reports no unresolved
Critical/High/Medium/Low findings. Separately authorized disposable integration
passed 11/11 including the parent, with owned index provisioning, graceful cleanup,
empty Job, released port and unchanged protected baselines. Missing-index refusal
was verified live; incorrect/nonunique/unverifiable-index refusal has offline
evidence only. No persistent provisioning or migration was performed.

FINAL REVIEW PASS WITH F037 BROWSER EXCEPTION on 2026-10-19. The owner explicitly
accepts the named F037 risks for LOCAL DEVELOPMENT ONLY: activity layout/rendering,
keyboard/screen-reader accessibility, loading/empty/error/Retry, account/Concept
navigation/cancellation/stale responses, responsive behavior and compatibility
with existing Concept/Practice interfaces. Eight F037 mounted scenarios NOT_RUN;
complete expected regression 141 NOT_RUN INCLUDING those eight. No browser PASS,
production readiness or completion approval is claimed. Primary-host Playwright
remains prohibited. Retain F022 EPERM/PID-reuse/Windows teardown, F024 shared-worker
cleanup, F029 scrolling, screen-reader/background-throttling and shutdown gaps.
The exception does not transfer to F038 or any other feature. Persistent indexes/
topology, privacy/retention/erasure/backups and separately approved safe browser
regression/release readiness remain deployment gates.

Owner completion approval dated 2026-10-19 marks F037 APPROVED_COMPLETE for LOCAL
DEVELOPMENT ONLY and authorizes one scoped 33-file commit and safe origin/dev push
after Git preflight. Retain API 117 distinct PASS, frontend 229 distinct PASS,
MongoDB 11/11 PASS, all static/security checks and zero unresolved review findings.
Retain the live missing-index versus offline-only incorrect-index distinction and
graceful-cleanup evidence. The eight/141 browser NOT_RUN disclosures and F037-only
exception remain unchanged. No production readiness, new execution, persistent
provisioning or F038/F039 work is authorized; F038 remains NOT_STARTED.

### F038 — Completion Rules
**Default Passing Score:** 70%  
**Dependencies:** F037  
**Status:** `APPROVED_COMPLETE`

Owner approved the exact six-file POLICY FOUNDATION ONLY on 2026-10-19.
Concept-level pure eligibility evaluation requires verified section metadata and
a valid graded candidate; VISUALIZE/PRACTICE are mandatory, default sections add
READ/EXAMPLE, and REVISE is optional unless configured. No activity count or
ungraded F036 attempt implies completion. No persistence, API/UI, grading,
evidence-production, completion action or F039 work is included. This partial
foundation cannot complete F038. Browser additions zero; existing 141 NOT_RUN
and all historical local-only exceptions/limitations remain unchanged.

Stage A offline evidence: pure-policy focused tests 22/22 PASS; relevant API
regressions 117/117 PASS and frontend regressions 68/68 PASS. API build, API
TypeScript, repository lint and source formatting PASS. Exact six-file scope and
separate source/security review report zero unresolved Critical/High/Medium/Low
findings. The initial focused run had 21 PASS / 1 FAIL for missing-version blocker
classification; its implementation correction and passing verification are
retained in the F038 document. This is a partial foundation, not full F038
acceptance. Trusted evidence/grading/selection, persistence, completion API/UI,
initiation/invalidation/revocation and final acceptance require separate approval.

Stage B1: owner approved P1-P6 and the exact four-path pure OUTPUT grading
increment. Explicit APPROVED TEXT/EXACT_TEXT/NONE rubric metadata and exact
question/Concept/public-revision/private-fingerprint/rubric id/version binding
are required before comparison. Valid literal matches score 100, valid differences
score 0; invalid/unsupported inputs return fixed refusals without scores. No
runtime imports, authentic approval verification, persisted assessment, Stage A
evidence adapter, attempt mutation, completion API/UI or F039 work is included.
studentProgress remains canonical and F037 remains activity-only.

B1 evidence: focused 23/23 PASS; nine relevant existing API regression files
96/96 PASS, including the 22 existing policy tests. API build/TypeScript, root
lint and source formatting PASS; separate source/security review has zero
unresolved Critical/High/Medium/Low findings. The initial sandbox test launch
failed before loading tests in tsx's Windows user lookup; the supported ordinary-
user run passed without code/environment changes. See F038 Section 10. B1 changes
four paths; cumulative F038 scope is eight unique paths, preserving Stage A.
No MongoDB or browser execution. Browser additions zero; all 141 remain NOT_RUN.
F038 remains IN_PROGRESS, partial foundations only. Trusted evidence/grading
integration and the actual completion lifecycle still require separate approval.

Stage B2: owner approved reconciled P1-P8, additive canonical diagnostic storage/
audit contracts and fourteen paths (seven CREATE, seven MODIFY, including the
single auth-audit.test.ts export-expectation addition). Internal LOCAL-only commands
verify current independent Admin approval and owned immutable F036 attempts;
terminal revocation shares the transactional fence with grading/replay. Separate
append-only DIAGNOSTIC records never reveal answers, mutate attempts/progress or
qualify for completion. Required audit persistence is atomic. Existing public
routes, six audit writer behaviors, F036 disclosure and F037 activity remain intact.

B2 offline evidence: new focused 23/23 PASS; relevant existing API regressions
159/159 PASS (182 distinct including the focused cases). API build, source/test
TypeScript, repository lint and source formatting PASS. Separate final review:
zero unresolved Critical/High/Medium/Low findings; two Low validation/boundary
issues were corrected within scope before final checks (F038 Section 13).
B2 changes fourteen paths; cumulative F038 scope is eighteen unique paths while
preserving Stage A/B1. Prepared MongoDB integration has ten child scenarios plus
one parent, all NOT_RUN; mock transaction/index/concurrency evidence is not live
database evidence. No indexes or persistent storage were provisioned. Future
execution requires separate guarded disposable-database approval. Browser
additions zero; existing 141 NOT_RUN remain unchanged. F038 stays IN_PROGRESS;
completion evidence, lifecycle, privacy/erasure/backups and final acceptance remain
separately owner-gated. No production release or F039 work is authorized.

Stage C1: owner approved P1-P8 and exactly four paths (two pure policy source/test
creations and two documentation modifications). validateSectionEvidencePolicy
checks only bounded claimed account/Concept/section/revision/policy, checkpoint,
time and replay metadata. Acknowledgements classify as ACTIVITY_CANDIDATE;
matched declared checkpoint metadata as CHECKPOINT_CANDIDATE. Every result has
completionQualification=NOT_ESTABLISHED; Practice always remains unqualified.
No authentication, genuine evidence, challenge consumption, persistence, API/UI,
grading, Stage A adapter, progress/completion mutation or F039 work is added.

C1 evidence: focused 32/32 PASS; twelve relevant API regression files 148/148
PASS (180 distinct across those invocations). API build/source-test TypeScript,
repository lint, targeted formatting, UTF-8/LF and scope/whitespace checks PASS.
Separate formal source review: zero unresolved Critical/High/Medium/Low findings.
Initial focused 31 PASS / 1 FAIL was a combined-defect fixture that removed its
own earlier lifecycle contradiction; its correction and passing result remain
in F038 Section 18. C1 changes four paths; cumulative F038 scope is twenty unique
paths, preserving prior stages and B2's Sections 14-16 evidence/limitations.
No MongoDB or browser execution; zero new browser scenarios, existing 141 NOT_RUN.
F038 remains IN_PROGRESS, partial foundations only. Trusted producers, current
revision/authorization, replay transactions, qualifying Practice policy and the
completion lifecycle/privacy/release decisions still require separate approval.

Stage C2: owner approved the exact eleven-file scope and reconciled Section 19
decisions for a LOCAL-only internal READ acknowledgement producer. New private
challenges and append-only ACTIVITY_ONLY receipts use current Student/publication
checks, server snapshot hashes, fixed five-minute expiry, shared withdrawal/replay
fence, three exact unique indexes and majority-confirmed owned proof. There is no
route, UI, automatic invocation, comprehension/VERIFIED/completion qualification,
F036/F037/audit mutation or F039 work. Additive canonical refinements preserve
studentProgress. Offline verification evidence is recorded in F038 Section 20;
MongoDB integration and persistent operational use require separate approval.
C2 adds zero browser cases; existing 141 NOT_RUN remain unchanged. F038 stays
IN_PROGRESS, partial foundations only; F039 remains NOT_STARTED.

Stage C3a: owner approved the exact four-path pure visualization checkpoint
verification foundation. Strict authored SINGLE_CHOICE data and exact Concept/
visualization/revision/checkpoint/policy bindings precede exact choice-id comparison.
CORRECT/INCORRECT are response-comparison outcomes only, not scores or trusted
evidence; completionQualification always remains NOT_ESTABLISHED. Unsupported
lifecycle metadata refuses under the strict schema; freshness/expiry/revocation
are future trusted-producer responsibilities. No routes, UI, storage, challenge
operations, F036/F037 mutation, grading integration or completion state is added.
Implementation/offline evidence is recorded in F038 Section 25. No dependency or
canonical architecture amendment. Browser additions zero; existing 141 remain
NOT_RUN. F038 stays IN_PROGRESS, partial foundations only; F039 NOT_STARTED.

Stage C3a evidence: 35 focused PASS plus 158 relevant API regression PASS (193
distinct). API build, source/test TypeScript, repository lint, source formatting,
UTF-8/LF, exact four-file scope and whitespace checks PASS. Separate formal
source/security review reports zero unresolved Critical/High/Medium/Low findings.
The initial sandbox launch failed before loading tests in tsx's Windows user
lookup; the supported ordinary-user run passed without source/environment changes.
See F038 Section 25. No MongoDB/browser execution; all 141 browser cases remain
NOT_RUN. Trusted producer integration and full F038 acceptance require later gates.

Stage C3b: owner approved P1-P8, fifteen paths and additive internal API/database
refinements for a LOCAL-only trusted visualization checkpoint activity producer.
Independently reviewed immutable definitions bind current server snapshots;
one-active/three-fresh persisted issuance limits, two revocation/consumption fences,
strict VISUALIZE shared-storage variants and owned majority proof preserve C2 READ.
Correct and incorrect responses both consume; invalid responses do not. This is
activity-only, not comprehension, Stage A VERIFIED evidence, completion or mastery.
Snapshot ABA/publication-history and persistent privacy/release limits remain.
Actual offline verification is recorded in F038 Section 27; prepared MongoDB
integration requires separate approval. C3b adds zero browser cases; all 141 remain
NOT_RUN. F038 remains IN_PROGRESS, partial foundations only; F039 NOT_STARTED.

Stage C3b offline evidence: 38 focused C3b PASS, 49 READ PASS (46 existing plus
three new compatibility controls) and 180 additional API regression PASS; 267
distinct tests, with subset/repeated runs not added. API build, source/test
TypeScript, lint, source formatting, UTF-8/LF, fifteen-path scope and whitespace
checks PASS. Separate formal review: two Low findings resolved within scope,
zero unresolved Critical/High/Medium/Low. Approved additive canonical text preserves
prior document bytes/contracts. Prepared MongoDB suite has fifteen children plus
parent, all NOT_RUN; live verification and owned cleanup require a separate gate.
See F038 Section 27 for initial typing corrections, findings and evidence limits.
No database/browser execution; all 141 browser cases remain NOT_RUN.

Owner-approved F038 Slice 1 Option B implements only LOCAL synthetic origin,
reviewed explicit 70% Concept policy and atomic first-submission OUTPUT
qualification. The unchanged F036 attempt, distinct qualifying assessment and
existing F037 activity update share one majority transaction; historical or
reveal-assisted attempts cannot qualify. READ/VISUALIZE compatibility and
activity-only section contracts remain separate from completion. Native runtime
supervisor attestation is replaced by server-owned creation provenance; disposable
MongoDB ownership/isolation safeguards remain mandatory. See F038 Section 31 for
the exact 32-path boundary and actual verification evidence. Slice 1 offline:
39 focused plus 366 relevant API tests (405 distinct) and 229 frontend tests PASS;
build/static checks PASS; zero unresolved source/security findings. Actual changes
24 files (five new/nineteen modified). Integration is
prepared only; no MongoDB or browser execution is authorized in this gate.
Slice 2 persistence/API and Slice 3 student workflow remain unimplemented.
Existing 141 browser cases remain NOT_RUN; twelve proposed cases are unimplemented.
F038 remains IN_PROGRESS; no production readiness or F039 implementation.

Owner-approved Slice 2 adds LOCAL synthetic-scope completion APIs, canonical
studentProgress v2 and append-only request receipts, preserving F036 durability
and F037's five-field activity GET. Offline verification: 57 focused plus 378
relevant API regression tests PASS (435 distinct in this gate); API build,
source/test TypeScript, lint, formatting and browser-spec static compilation PASS.
Two Medium source-review findings were resolved; no unresolved findings remain.
Exactly twenty approved paths changed (eight creations/twelve modifications).
Slice 1's accepted 14/14 guarded integration and historical failures remain in
the feature document. Slice 2's ten prepared MongoDB records are NOT_RUN; its
thirteen index definitions are declared, not provisioned. Separate disposable
integration approval is required. Existing 141 browser cases remain NOT_RUN;
twelve proposed Slice 3 cases and Student UI remain unimplemented. See F038
Sections 32-33. F038 stays IN_PROGRESS; no production release or F039 is authorized.

Owner-approved Slice 3 now implements the accessible Concept completion panel and
internal disposable two-Admin/Student credential setup within nineteen paths
(eleven creations/eight modifications), including the explicitly added Concept
rendering test-loader update. Selected offline verification: 366 API and 211 web
tests PASS (577 distinct); API/web builds PASS. Native fixture/session MongoDB
execution and all browser execution remain separately gated. Section 36 records
actual scope, evidence and limitations; older Slice 1/2 gate statements above are
historical. The eight-index F006 compatibility appendix preserves canonical Auth
and User/Session behavior; no live or persistent provisioning occurred. Twelve
Slice 3 browser specifications are prepared, NOT_RUN; existing 141 remain NOT_RUN
(153 expected total). F038 remains IN_PROGRESS; no production or F039 approval.

**Current acceptance gate — 2026-10-21:** FINAL REVIEW PASS WITH F038 BROWSER
EXCEPTION. The owner explicitly approved a one-time F038-specific exception for
LOCAL DEVELOPMENT ONLY after consolidated review found zero unresolved
Critical/High/Medium/Low issues. F038 is READY_FOR_REVIEW, not APPROVED_COMPLETE;
earlier stage statuses, failed/blocked runs and gate notes above remain historical.
Retained results: Slice 1 post-correction MongoDB 14/14, Slice 2 10/10, Slice 3
8/8, backend checkpoint 628 API + 10 Practice rendering, Slice 3 offline 577 and
deadline correction 73 PASS; build/static/security checks PASS. No reruns occur.

Exactly **153 browser scenarios remain NOT_RUN (141 existing + 12 F038 Slice 3)**.
The owner accepts unverified real-browser completion, keyboard/focus/screen-reader,
responsive layout, browser login/session, navigation/account-change races,
cancellation/stale responses, retry/network interruptions and earlier Concept/
Practice UI compatibility for LOCAL development only. Primary-host browser
automation remains prohibited. Prior F031-F037 exceptions do not transfer; this
F038 exception cannot transfer to F039 or another feature. Browser UI/smoke checks
remain NOT_VERIFIED, with no browser PASS or production-readiness claim.

Option B remains synthetic-only, generation-bound and independently approved;
it is not general production qualification or Topic/mastery functionality. Real
MongoDB failover, multi-process convergence, persistent indexes/migrations,
production enrollment, privacy/retention/erasure/backups, operational/release
security and full real-browser acceptance/regressions remain separate release
gates. Future browser execution needs separate ownership-safe approval. See F038
Section 46 for accepted risks, evidence and non-transferable exception terms.
Backend checkpoint 638ef017cd32ef43304f1094e6be3a55850aebbd stays local and unchanged.
Next: separate owner APPROVED_COMPLETE decision and explicit Git delivery approval;
neither Git writes nor F039 work is authorized by this status update.

**Owner completion approval — 2026-10-21:** F038 is APPROVED_COMPLETE for
**LOCAL DEVELOPMENT ONLY**. The owner explicitly approved completion and scoped
delivery to origin/dev, preserving backend checkpoint
638ef017cd32ef43304f1094e6be3a55850aebbd and one separately reviewed final
23-path commit (11 creations / 12 modifications). Section 47 of the feature plan
records the delivery boundary; earlier status/gate notes above remain historical.
No history rewriting, force push, production deployment or automatic F039 work.

Retained evidence and limitations are unchanged: MongoDB Slice 1 post-correction
14/14, Slice 2 10/10 and Slice 3 8/8 PASS; zero unresolved consolidated review
findings. The approved F038-specific LOCAL browser exception retains **153 NOT_RUN
(141 existing + twelve Slice 3)**, no browser PASS and no transfer to F039 or any
other feature. All accepted unverified UI/session/accessibility/navigation/race/
cancellation/retry/compatibility risks and primary-host browser prohibition remain.
Synthetic-origin qualification is not a general production capability. Real
failover, multi-process convergence, persistent index/migration provisioning,
production enrollment, privacy/retention/erasure/backups, operational/release
security and full real-browser acceptance/regressions remain separately gated.
F001-F037 stay APPROVED_COMPLETE; F039 stays NOT_STARTED pending separate approval.

### F039 — Weak / Improving / Strong Classification
**Dependencies:** F037  
**Status:** `APPROVED_COMPLETE` — LOCAL DEVELOPMENT ONLY

**Owner-approved Slice 1 — 2026-10-21:** Pure Concept-level classification and
offline verification only, within the four paths in the F039 feature plan.
No authenticated adapter, public API/UI, mastery persistence or F040 work.
F001-F038 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT; the existing 153
browser scenarios remain NOT_RUN. No browser exception transfers to F039.

**Slice 1 offline verification — 2026-10-21:** 30 focused + 159 relevant API
regressions = 189 distinct PASS. API build, source/test TypeScript, targeted lint/
formatting, UTF-8/LF, scope and diff checks PASS. Separate formal source review:
Critical/High/Medium/Low zero unresolved findings. See the F039 feature plan
Section 9 for evidence and the pre-assertion sandbox-runtime failure. Pure
metadata consistency establishes no authentication or genuine assessment proof.
Slice 2 and canonical persistence clarification remain separately gated. No Git
delivery is authorized; await separate owner approval for a Slice 1 local checkpoint.

**Slice 2 owner DTO reconciliation and offline verification — 2026-10-21:**
Authenticated internal LOCAL-only original-assessment classification now returns
exactly {classification,code}; Concept identity remains in trusted inputs and
ownership/revision checks. The approved seven paths add the read-only adapter,
focused tests and prepared guarded integration, plus additive internal-service/
nonpersistence canonical clarifications. No public endpoint/UI, scoring, mastery
write or completion mutation. Slice 1 checkpoint
d0d1a1a30e84510a0cfd04a80f5fc3ef962f29eb and its source/tests are unchanged.
27 focused + 176 relevant regressions = 203 distinct selected PASS. API build,
source/test TypeScript, targeted lint/formatting, UTF-8/LF, scope and diff checks
PASS. Three in-scope review items resolved; Critical/High/Medium/Low zero unresolved.
See the F039 plan Sections 10-11 for the original DTO blocker and actual evidence.
Nine-record, 21-existing-index MongoDB suite is PREPARED/NOT_RUN; execution and
the temporary invocation adapter need separate owner approval. No MongoDB/browser,
Git delivery or F040 work occurred. F039 stays IN_PROGRESS; F001-F038 remain
APPROVED_COMPLETE locally. All 153 browser scenarios remain NOT_RUN, zero added.

**Owner completion and scoped Git approval — 2026-10-22:** F039 is
APPROVED_COMPLETE for **LOCAL DEVELOPMENT ONLY**, following Slice 1 189 selected
PASS, Slice 2 203 selected PASS, authenticated disposable MongoDB 9/9 PASS,
protocol 82/harness 18 PASS and final review with zero unresolved findings.
Section 14 of the F039 feature plan records the exact eight-path final Slice 2
inventory, including the separately approved resource-only fixture correction.
Preserve Slice 1 commit d0d1a1a30e84510a0cfd04a80f5fc3ef962f29eb; one scoped Slice 2
commit and a safe non-force push of both F039 commits to origin/dev are authorized
only after Git preflight. Historical gate notes and failed runs remain preserved.

Intermediate IMPROVING grades remain offline-only; no mastery persistence, public
endpoint or Student UI is delivered. Real failover and multi-process behavior
remain unverified. All **153 browser scenarios are NOT_RUN**, zero added by F039;
no browser PASS or transferred exception is claimed. Production enrollment,
privacy/retention/erasure/backups, persistent index/migration provisioning,
security, full browser acceptance and release verification remain separate gates.
LOCAL synthetic qualification is not general production authority or production
readiness. F001-F038 remain APPROVED_COMPLETE locally; F040 stays NOT_STARTED
and requires separate owner approval. No tests or database/browser execution is
authorized by this delivery gate.

---

## Phase J — Student Dashboard

### F040 — Dashboard API
**Dependencies:** F037, F039  
**Status:** `APPROVED_COMPLETE` - LOCAL DEVELOPMENT ONLY

**Historical owner-approved Slice 1 — 2026-10-22:** Internal LOCAL-only saved Concept
activity/classification reader and offline verification within the exact eight
paths in features/F040-dashboard-api.md. Offline implementation is ready for
owner review, not accepted. Slice 2 is NOT_STARTED and separately gated. No mounted
endpoint, UI/F041, mutations, new indexes/migrations, MongoDB/browser execution
or Git delivery. F001-F039 remain APPROVED_COMPLETE locally. Existing 153 browser
scenarios remain NOT_RUN; zero added. Production readiness NOT_VERIFIED.

**Historical Slice 1 offline verification — 2026-10-22:** Internal reader implemented;
51 focused + 209 relevant regressions PASS (260 distinct selected tests, no repeat
inflation). API build, source/test TypeScript, targeted lint/formatting, UTF-8/LF,
scope/security and diff checks PASS. Separate source review resolved the live
enrichment-budget, final current-account and pre-transaction connection-buffer
items within scope; Critical/High/Medium/Low zero unresolved findings. Slice 1 is
READY_FOR_REVIEW, not owner-accepted; F040 remains IN_PROGRESS. See the feature
plan for historical pre-assertion harness/static failures and exact evidence.
No MongoDB/browser execution or Git writes. Owner acceptance/checkpoint and all
Slice 2 implementation/integration remain separate gates. F001-F039 statuses,
F041 NOT_STARTED and all 153 browser scenarios NOT_RUN are preserved.

**Historical standing F040 gate — 2026-10-23:** Slice 1 ACCEPTED_LOCAL at unchanged checkpoint
1971903e79ebd0e6dbc2494a34515e882ab9ef1c; Slice 2 READY_FOR_REVIEW **offline only**.
The owner approved bounded F040 troubleshooting, verification and review, with
an absolute prohibition on staging, commit or push until separate authorization.
Current selected offline tests: 92 Dashboard + 209 relevant regressions = 301/301
PASS. API build, source/test TypeScript and targeted lint PASS. Separate source/
security review: Critical/High/Medium/Low zero unresolved findings. The earlier
sandbox loopback EACCES failures and historical guarded/managed-launch failures
are preserved in the feature plan, not converted into passing live evidence.

The unchanged private-input contract requires human participation; no prompt,
runner, fixture or MongoDB was invoked in the earlier unattended standing-approval gate. Integration
remains 0 PASS / 0 FAIL / 9 NOT_RUN; authenticated RESULT/digest ACK and fresh live
protected-baseline verification remain NOT_RUN. Owner availability for the masked
prompts is required before proceeding through fresh readiness/isolation checks.
Preserve 19 disposable collections/21 canonical indexes, all ownership/deadline/
cleanup guarantees, F001-F039 APPROVED_COMPLETE locally and F041 NOT_STARTED.
F040 remains IN_PROGRESS, all 153 browser scenarios NOT_RUN, production readiness
NOT_VERIFIED. Final acceptance and Git delivery remain separately owner-gated.

**Later owner-present managed gate — 2026-10-23:** Fresh retained-handle-owned
PowerShell PID 20008 passed native/CIM/owner/console, executable, child-only PATH,
529-source-pin and resource preflight. The owner acknowledged window activation,
but the captured HWND was not verified foreground during the bounded wait.
Stopped before runner/private input: 0 invocations, 0 PASS / 0 FAIL / 9 NOT_RUN;
RESULT/ACK and database baseline capture/provisioning NOT_RUN. Child exit 1,
handles/pipe/window disposed, no forced cleanup; final read-only process/port/
storage absence PASS. No application defect or exact focus-loss cause established.
No retry, test rerun or source/launcher change. Retain 301/301 offline PASS and
zero unresolved source/security findings; live acceptance remains blocked pending
bounded HWND/foreground-host reconciliation. See feature-plan Section 10.

**Later direct-console gate — 2026-10-23:** Further managed active-pane work was
ended by owner decision. Read-only source/Git, executable-hash, 529-pin inventory
and resource preparation PASS. The owner reported `F040 STOP at CONSOLE` from
the direct pasted command, before runner invocation; the particular console
prerequisite remains UNKNOWN. No new runner evidence, masked entry or integration
was established. Final port/process/storage absence PASS; live protected baseline,
provisioning and authenticated RESULT/ACK NOT_RUN. Retain 0 PASS / 0 FAIL / 9
NOT_RUN, 301/301 prior offline PASS and zero unresolved source/security findings.
No retry, source/launcher correction, test rerun or Git write. See feature-plan
Section 11. F040 stays IN_PROGRESS; Slice 2 READY_FOR_REVIEW offline only.

**Historical F040 gate — verified integration and final review, 2026-10-23:** The
owner's verified PowerShell 7.6.8 console (PID 6128) performed one explicitly
approved invocation after revalidation and hidden local input. Retained run
`f040-slice2-run-8ce1152dc6354332a557c42c7e374247` reports authenticated exact
PARENT/T01-T08 **9 PASS / 0 FAIL / 0 NOT_RUN**, CountsStatus VERIFIED. Approved
19 collections/21 canonical indexes, disposable isolation and ownership PASS.
Supervisor validated RESULT; owned host verified the matching digest ACK before
normal disposal. Parent send-delivery observation fields remain UNKNOWN; they
are not relabeled as authenticated receipt. See feature-plan Section 12 for
corroborating host receipt and intentional post-finalization DISPOSED diagnostics.

All observed child exits 0; no forced cleanup/errors; Job empty, handles closed,
port released, storage removed, protected/parent-environment/source baselines
unchanged. Final read-only resource-absence verification PASS. Runner elapsed
73.839 seconds. Retain 301/301 offline PASS and build/TypeScript/lint/format checks;
no unnecessary passing-suite rerun. Final source/security/architecture review:
Critical 0 / High 0 / Medium 0 / Low 0 unresolved. Historical failures and
UNKNOWN observations remain preserved. Only F040 documentation changed in this
acceptance-evidence gate; index empty, unchanged Slice 1 checkpoint, no Git writes.

Readiness annotation **READY_FOR_FINAL_ACCEPTANCE**, LOCAL DEVELOPMENT ONLY;
F040 remains **IN_PROGRESS**, Slice 1 ACCEPTED_LOCAL, Slice 2 READY_FOR_REVIEW
with offline and integration evidence. Owner final acceptance and scoped Git
delivery remain separate gates. Intermediate IMPROVING scores remain offline-only;
no stored mastery or F041 UI. Real failover, multi-process behavior, persistent
provisioning/migrations, production privacy/security/operations and full browser
acceptance remain unverified. All 153 browser scenarios NOT_RUN, zero added;
production readiness NOT_VERIFIED. F001-F039 remain APPROVED_COMPLETE locally
and F041 NOT_STARTED. Do not start F041 or stage/commit/push.

**Current F040 gate — explicit owner final approval, 2026-10-23:** F040 is
**APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY**. The owner authorized only final
status/documentation reconciliation, with no staging, commit or push. Slice 1
checkpoint 1971903e79ebd0e6dbc2494a34515e882ab9ef1c remains unchanged; Slice 2 is
accepted within the exact approved API scope. See feature-plan Section 13.

Retain 301 offline PASS; authenticated integration 9 PASS / 0 FAIL / 0 NOT_RUN;
RESULT validation and matching host digest ACK PASS; parent delivery-observation
fields UNKNOWN; 19 collections/21 indexes; isolation/graceful cleanup and unchanged
protected baselines PASS; final review zero unresolved Critical/High/Medium/Low
findings. Preserve historical failures/corrections; no passing-suite rerun.
All 153 browser scenarios remain NOT_RUN, zero added. Intermediate IMPROVING
remains offline-only; no stored mastery or F041 UI. Real failover, multi-process,
persistent provisioning/migrations, production enrollment, privacy/security/
operations and full browser/release acceptance remain separate gates. Production
readiness NOT_VERIFIED; no transferred browser exception or production approval.

Only the feature plan and this F040 status are reconciled. Exactly nine approved
F040 paths remain uncommitted, index empty, no Git writes. F001-F039 remain
APPROVED_COMPLETE locally; F041 NOT_STARTED. Separate owner approval is required
for Git delivery or any F041 work. Stop after final status verification.

### F041 — Student Dashboard Real Data
**Dependencies:** F040  
**Status:** `APPROVED_COMPLETE` — LOCAL DEVELOPMENT ONLY

**Owner-approved plan and Slice 1 — 2026-10-24:** Frontend-only Saved Concept
practice consumer of accepted F040 GET data. Exact 13-path/two-slice plan in
features/F041-student-dashboard-real-data.md; only the seven Slice 1 paths are
authorized now. Slice 1 ACCEPTED_LOCAL; Slice 2 NOT_STARTED and separately gated.
Strict client/envelope/DTO, account binding, canonical five-entry keyset pages,
cancellation/generation guards, bounded requests and manual retry only. No UI,
backend/Auth/API/model/configuration/dependency changes in Slice 1. No fabricated
metrics, grading, completion or mastery persistence. Final focused tests 78 PASS,
106 distinct relevant regressions PASS (184 distinct selected); web build/source-
test TypeScript/targeted lint/formatting PASS. Separate source/security review:
Critical/High/Medium/Low zero unresolved findings. Preserve initial root-context
JSX failures and sandbox Google Fonts build refusal, with verified execution-
context corrections and no unrelated source change; see feature-plan Section 5.
F001-F040 remain APPROVED_COMPLETE locally; F042 NOT_STARTED.
Preserve 153 existing browser scenarios NOT_RUN; 20 additional cases planned for
Slice 2, not prepared/executed yet. No MongoDB/browser or Git writes authorized.
Production readiness NOT_VERIFIED. F041 stays IN_PROGRESS. Stop after verification;
owner acceptance and each local Git checkpoint require separate approval.

**Slice 1 owner acceptance/local checkpoint — 2026-10-24:** Owner explicitly
accepted Slice 1 for LOCAL DEVELOPMENT ONLY and authorized one seven-path local
commit after clean scope/integrity checks. Retain 78 focused + 106 regressions =
184 distinct PASS and all build/static/security evidence and historical failures.
No implementation or authentication change; only acceptance documentation is
reconciled in this gate. F040 checkpoint remains unchanged. F041 IN_PROGRESS,
Slice 1 ACCEPTED_LOCAL, Slice 2 NOT_STARTED; F001-F040 approved locally and F042
untouched. Existing 153 browser scenarios NOT_RUN; production readiness
NOT_VERIFIED. No remote push or Slice 2 approval. See feature-plan Section 6.

**Later Slice 2 implementation approval — 2026-10-24:** Owner authorizes the exact
eight-path frontend UI/hook/rendering-test/browser-preparation scope in the F041
plan, preserving accepted Slice 1 checkpoint
7c03570441ff5d0fb47aa28858b302d13cbe9dc0. Slice 2 IN_PROGRESS; F041 IN_PROGRESS.
Account/profile/navigation/branding preserved; F040 remains authoritative.
No backend/Auth/configuration/dependency changes or Git writes. Prepare 20 browser
scenarios but do not execute; 153 historical scenarios remain NOT_RUN.
Verification/review pending. F001-F040 approved locally; F042 NOT_STARTED;
production readiness NOT_VERIFIED.

**Later Slice 2 offline verification — 2026-10-24:** Saved Concept practice panel
and account-keyed hook implemented within the approved eight paths; account,
preferences, navigation and Auth/Slice 1 contracts preserved. New UI/lifecycle
tests 27 PASS plus 184 relevant regressions PASS = 211 distinct PASS. Web build,
source/test and prepared-browser-spec TypeScript, targeted lint/format, UTF-8/LF,
scope/secrecy/diff checks PASS; separate source/security review has zero unresolved
Critical/High/Medium/Low findings. Initial sandbox generated-directory EPERM and
new test-local reserved-name lint failure are preserved with corrections in
feature-plan Section 7. No application workaround or unapproved scope change.
Twenty F041 browser cases prepared, NOT_RUN; prior 153 NOT_RUN unchanged, combined
173 NOT_RUN. No browser exception, fresh MongoDB/API execution or Git writes.
Slice 2 READY_FOR_REVIEW (offline only); F041 IN_PROGRESS; Slice 1 ACCEPTED_LOCAL
at unchanged 7c03570441ff5d0fb47aa28858b302d13cbe9dc0. Owner acceptance/local
checkpoint and named browser-verification decision remain separate gates.
F001-F040 remain approved locally; F042 NOT_STARTED; production NOT_VERIFIED.

**Slice 2 owner acceptance/local checkpoint — 2026-10-24:** Owner explicitly
accepts Slice 2 for LOCAL DEVELOPMENT ONLY, offline only, subject to clean Git
scope/integrity checks, and authorizes one eight-path local commit. Both slices
ACCEPTED_LOCAL; F041 IN_PROGRESS. Preserve unchanged Slice 1 checkpoint
7c03570441ff5d0fb47aa28858b302d13cbe9dc0 and 27 focused + 184 regressions = 211
distinct PASS, all build/static/security evidence and historical corrections.
No passing-suite rerun, implementation/Auth/dependency change, browser or live
API/MongoDB execution in this gate. Existing 153 plus 20 new browser scenarios
remain 173 NOT_RUN. No exception or browser accessibility/responsiveness PASS
is implied. F040 evidence/limitations and F001-F040 local approvals preserved;
F042 NOT_STARTED. No push authorized; fresh origin/dev remains the F040 commit
24fdc61e4fd09a69b8e7e2e8447b696fa9b0c27c. Final F041 review/browser decision,
owner completion approval and remote delivery remain separate gates.
Production readiness NOT_VERIFIED. See feature-plan Section 8.

**F041-specific browser exception — explicit owner approval, 2026-10-24:** Owner
approves verification deferral for F041 only, exclusively for LOCAL DEVELOPMENT
acceptance under AGENTS.md. This is not a test pass, security waiver, production
approval or final feature-completion approval. It does not transfer to F042 or any
other feature. The earlier unapproved-deferral gate is superseded only by this
named decision; historical evidence, failures/corrections and results remain.

Twenty F041 browser scenarios remain NOT_RUN; existing 153 remain NOT_RUN;
combined **173 NOT_RUN**, never PASS/SKIPPED/VERIFIED. Real-browser layout,
accessibility, keyboard/focus, responsiveness, authentication/account races,
cancellation, navigation/retry/network and Concept/Practice compatibility remain
unverified and explicitly owner-accepted as LOCAL-only risks. Mocked browser
tests would not establish live frontend-to-API integration even if executed later.
Live F041 frontend-to-API integration remains **NOT_VERIFIED**. F040's nine
authenticated backend records/host ACK and cleanup are prerequisite evidence only;
parent delivery observations remain UNKNOWN. Retain 211 offline PASS and all
build/static/security evidence; no passing suites rerun.

Primary-host Playwright remains prohibited; no browser execution or infrastructure
change is authorized. Future qualification requires separate owner approval of an
ownership-safe isolated runtime/configuration, bounded execution, synthetic data,
network/privacy protections, sanitized evidence and complete cleanup/protected
baselines. Genuine live frontend/API qualification needs its own approved Auth
and disposable-backend lifecycle; mocks do not replace it. Failover, multi-process,
privacy/retention/erasure/backups, migrations/provisioning, operational security,
full browser regression and production-release gates remain outstanding.

F041 **IN_PROGRESS**; both slices **ACCEPTED_LOCAL**, Slice 2 **offline only**.
F001-F040 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY; F042 NOT_STARTED.
Production readiness **NOT_VERIFIED**. Only the feature plan and roadmap change;
no staging, commit, push or browser/live API/MongoDB execution. Separate final
F041 owner acceptance is the next gate; this exception does not authorize
completion or delivery. See Section 9 of
features/F041-student-dashboard-real-data.md.

**Final F041 owner acceptance — 2026-10-24:** Owner explicitly approves F041 as
**APPROVED_COMPLETE — LOCAL DEVELOPMENT ONLY**, based on both accepted slices,
211 distinct offline tests PASS, web build/TypeScript/lint/format PASS, final
source/security review with zero unresolved Critical/High/Medium/Low findings,
and the named F041-only LOCAL browser exception dated 2026-10-24. Slice 1 remains
ACCEPTED_LOCAL; Slice 2 ACCEPTED_LOCAL - offline only. This supersedes only the
pending final-acceptance status; historical failures, corrections and earlier
gates remain unchanged. See feature-plan Section 10.

Twenty F041 plus 153 pre-existing browser scenarios remain **173 NOT_RUN**.
Real-browser accessibility, responsiveness, focus and interaction/authentication
races remain NOT_VERIFIED. Live F041 frontend-to-API integration **NOT_VERIFIED**;
F040's authenticated backend 9/9 PASS is prerequisite evidence only, not live
F041 integration, and its parent delivery-observation uncertainty is unchanged.
The exception does not transfer to F042 or production and grants no primary-host
Playwright execution. Failover, multi-process, privacy/security, operational and
full browser/release gates remain outstanding; production readiness NOT_VERIFIED.

Preconditions PASS: dev at unchanged Slice 2
a2a76655ef2e01b148baba9c1689c1301c61d74a, preserving Slice 1
7c03570441ff5d0fb47aa28858b302d13cbe9dc0; exactly two local commits ahead of
origin/dev, only the two approved documentation paths pending and empty index.
F001-F040 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY; F042 NOT_STARTED.
Only final documentation/status reconciliation is authorized; no test reruns or
browser/MongoDB/live API execution. No staging, commit, push or history rewriting.
Keep changes uncommitted and STOP for separate scoped Git-delivery approval.

---

## Phase K — Admin Content Management

### F042 — Admin Route Protection
**Dependencies:** F008  
**Status:** `IN_PROGRESS`

Owner approved the F042 contract and Slice 1 backend implementation only on
2026-10-24, starting from `04efeebce3f81b6b5e4e31f2da11112ed13317d9`.
Slice 1 READY_FOR_REVIEW — offline only; Slice 2 NOT_STARTED and unapproved for implementation.
Exact scope: twelve paths, no Admin business endpoint/frontend/dependencies or
authentication/schema/index changes. Current ADMIN eligibility, five-second
read cap, no-store, IP/account limits and fail-closed errors are required.
Offline evidence: 72 focused plus 156 relevant Auth/User/API regression tests PASS
(228 distinct); API build, TypeScript, targeted lint/format and separate source/
security review PASS, zero unresolved Critical/High/Medium/Low findings. Historical
sandbox and test-typing failures are retained in the feature plan. Nine guarded
MongoDB records are prepared but NOT_RUN; launcher/fixture reconciliation and
execution require separate owner approval. MongoDB/browser execution and Git writes
are not authorized. Existing 173 browser scenarios remain NOT_RUN; no exception
transfers to F042. F001–F041 retain LOCAL DEVELOPMENT approval; production
readiness NOT_VERIFIED. See [F042 plan](features/F042-admin-route-protection.md).

**F042 blocker preservation and read-only Slice 2 plan — owner authorization,
2026-10-24:** F042 remains IN_PROGRESS. Slice 1 remains READY_FOR_REVIEW — offline
only; its acceptance and local Git checkpoint are **BLOCKED** until mandatory
MongoDB verification is satisfied. Slice 2A/2B remain NOT_STARTED and unapproved
for implementation. F001–F041 remain APPROVED_COMPLETE for LOCAL DEVELOPMENT ONLY;
F043 remains NOT_STARTED.

Retain 228 distinct offline tests PASS (72 focused + 156 regressions), build/static
evidence and zero unresolved Critical/High/Medium/Low source/security findings.
Retain 201 separate adapter checks PASS (122 protocol/lifecycle + 79 PowerShell
harness), including synthetic timing evidence only. All nine prepared MongoDB
records remain **0 PASS / 0 FAIL / 9 NOT_RUN**; no authenticated F042 RESULT/digest
ACK exists. Forced real MongoDB timeout remains NOT_VERIFIED. F042 ownership and
isolation infrastructure is verified offline only; non-database process
diagnostics are not guarded database acceptance. Earlier gate descriptions,
failures and corrections remain historical evidence.

Confirmed blocker: **SECURE_INPUT_CAPABILITY_UNAVAILABLE_OR_UNVERIFIED**. Codex
can launch/verify PowerShell 7 but has not established supported secure binding
between human keyboard input, the intended active console pane and its retained
shell process. Unattended execution is unavailable under the current contract;
no bypass, retry, marker reset or manual terminal procedure is required now.
Stop repeated PowerShell/HWND/focus investigations unless a genuinely new supported
capability becomes available and is separately approved. Preserve the twelve
pending Slice 1 paths, five ignored adapters, source pins and all ownership,
one-attempt, deadline, authenticated RESULT/ACK and cleanup requirements.

Future 2A plans an Admin-local strict Auth/User client, memory-only identity,
explicit restoration, same-origin coordination, stale-response refusal and
fail-closed logout/errors. Future 2B plans an accessible responsive login/boundary
and protected scaffold without business-management features or fabricated Stitch
metrics. Exact proposed inventories (15 unique Slice 2 paths across two separately
gated checkpoints) and verification criteria are in the F042 plan. No new API,
database/index, dependency, shared-package or configuration change is approved.
The UI must never treat an Admin 404 as authorization proof.

Recommend separately approved independent browser profiles for Student/Admin
LOCAL use. Different origins cannot serialize the API refresh cookie through
same-origin locks/channels; strict reuse detection remains unchanged and
same-profile races may invalidate the shared session. Cookie/session architecture
changes require separate approval. Profile policy, explicit restoration/recovery,
minimal UI and exact implementation inventories remain owner decisions.

Only this roadmap and the F042 plan change now. No implementation, suites,
credentials, runner, MongoDB/browser or Git writes. The 20 future browser cases
are a proposal, not prepared/executed coverage; existing **173 NOT_RUN** remains.
No F041 exception transfers. Browser execution and live Admin frontend-to-API
qualification each require separate approval; mocked UI tests prove neither.
Keep production readiness NOT_VERIFIED. Planning does not unlock implementation,
Slice 1 acceptance, its Git checkpoint or final feature completion.

**F042 owner design decisions and next-gate preparation — 2026-10-24:** The owner
approves LOCAL DEVELOPMENT planning for separate Student/Admin browser profiles,
existing Auth/User APIs with current verified ACTIVE Admin eligibility, memory-only
identity, fail-closed recovery and the minimum accessible responsive sign-in/
protected welcome/logout interface. These choices supersede only the earlier
pending design decisions. Same-profile cross-origin refresh coordination remains
unresolved; strict reuse detection is unchanged and production session architecture
is not approved. No implementation or browser-profile setup is authorized.

The F042 plan now validates every proposed path, action, purpose and checkpoint:
2A has six CREATE paths plus the two documentation MODIFY paths; 2B has four
CREATE and five MODIFY paths. The shared documentation pair gives **15 unique
Slice 2 paths**. Ten CREATE targets are absent and five MODIFY targets exist;
there are no file collisions or scope additions. Existing TypeScript-test and
Playwright selection limitations are explicit; no hidden configuration change,
shared-package extraction, dependency or new authentication endpoint is approved.

Required order remains: supported secure-input resolution and separate guarded
execution approval; authenticated nine-record Slice 1 integration with complete
cleanup/baselines; separate Slice 1 acceptance; separately authorized local Git
checkpoint; separate 2A implementation/verification/acceptance; separate 2B
implementation/verification and browser/live gates; final F042 owner acceptance
and separate Git delivery. Each later local checkpoint also requires explicit
Git approval. No automatic advancement, retry or manual PowerShell procedure.

**SECURE_INPUT_CAPABILITY_UNAVAILABLE_OR_UNVERIFIED** persists. Preserve 228
offline PASS, 201 adapter/protocol PASS and zero unresolved implementation/security
findings without claiming new runs. MongoDB remains **0 PASS / 0 FAIL / 9 NOT_RUN**;
no authenticated F042 RESULT/ACK, forced real timeout NOT_VERIFIED. Slice 1 remains
READY_FOR_REVIEW — offline only, acceptance/checkpoint BLOCKED; Slice 2A/2B
NOT_STARTED; F042 IN_PROGRESS; F001–F041 approved locally and F043 NOT_STARTED.
All **173 browser scenarios NOT_RUN**, production readiness NOT_VERIFIED. The
twenty future browser cases remain proposed only. Preserve all historical evidence
and reconcile future source pins with these documentation updates. Only the plan
and roadmap change now; no suites, credentials, runner, MongoDB/browser, source/
adapter/configuration changes or Git staging/commit/push are authorized. The next
safe execution proposal requires a genuinely new supported secure-input capability
and separate owner approval; do not repeat terminal-focus investigations.

**Owner-approved workflow amendment and F042-only sequencing exception —
2026-10-29:** Implementation, verification, owner acceptance, local development
checkpoints, remote delivery and production readiness are separate gates under
the additive AGENTS.md rule. Earlier F042 records remain historical. Only the
requirement to finish Slice 1 integration/acceptance/original checkpoint before
starting separately authorized Slice 2 offline development is superseded.

Slice 2A may be implemented offline before Slice 1 MongoDB acceptance **only after
separate owner implementation authorization**. Slice 2B requires Slice 2A offline
verification, independent review with resolved findings, owner review and separate
implementation authorization. Preserve the exact 15-path inventory, existing
Auth/User contracts, separate Student/Admin profile guidance and unresolved
cross-origin refresh-cookie limitation. No frontend implementation is authorized
by this documentation gate.

Current status: F042 **IN_PROGRESS**; Slice 1 **READY_FOR_REVIEW — offline only**;
Slice 1 acceptance and original acceptance checkpoint **BLOCKED**; Slice 2A and
2B **NOT_STARTED**; F043 **NOT_STARTED**. F001–F041 remain APPROVED_COMPLETE for
LOCAL DEVELOPMENT ONLY; their histories and feature-specific exceptions are
unchanged.

Retain 228 offline API tests PASS and historical reviewed adapter/protocol
evidence. The later guarded attempt timed out: authenticated counters **UNKNOWN**,
nine-record MongoDB verification incomplete, RESULT/digest ACK incomplete and
protected-process baseline comparison failed. Owned-resource cleanup passed in
that historical attempt; it is not current environment qualification. Windows
execution remains unqualified and the performance bottleneck is not conclusively
isolated. Earlier secure-human-input limitations are historical following the
separately approved synthetic-credential design; no new credentials are generated.

The [F042 verification ledger](features/F042-admin-route-protection.md#durable-verification-ledger)
records requirements, actual status, blocker, evidence, acceptance impact, next
action and owner approvals. Real database-backed Admin authorization, exact
RESULT/digest ACK, ownership/isolation/deadline/cleanup and protected-baseline
requirements remain mandatory before final acceptance. No mock or environment
failure is integration PASS. Preserve **173 browser scenarios NOT_RUN**, no
inherited F041 exception, live Admin frontend-to-API and forced real MongoDB
timeout **NOT_VERIFIED**, and production readiness **NOT_VERIFIED**. Any offline
development commit, final acceptance and remote delivery require separate owner
authorization. No staging, commit, push or execution is authorized here. The next
development gate is separate exact-scope Slice 2A implementation approval.

**F042 Slice 2A implementation authorization — 2026-10-29:** The owner approved
the eight-path Admin Authentication Foundation scope for implementation, offline
verification and independent review. Slice 2A is **IN_PROGRESS**; F042 remains
IN_PROGRESS, Slice 1 READY_FOR_REVIEW — offline only with acceptance/original
checkpoint BLOCKED, and Slice 2B NOT_STARTED. No Git, MongoDB, browser or F043
work is authorized. Historical evidence and all mandatory acceptance gates remain.

**F042 Slice 2A offline outcome — 2026-10-29:** Admin Authentication Foundation
implementation is complete within the six CREATE/two-document scope. Slice 2A
remains **IN_PROGRESS** because regression qualification is **BLOCKED**; it is not
READY_FOR_REVIEW or accepted. Retain **113 focused PASS** and regression **79 PASS /
44 FAIL**, exit 1, separately: 43 cases reported loopback EACCES and one HTTP
cancellation case timed out. No retry, permission investigation or passing-result
substitution occurred. Admin build, strict TypeScript including tests, targeted
lint and formatting PASS. Independent review: **0 unresolved Critical/High/
Medium/Low**; the generation-coupled expiry issue is corrected and covered by a
subscriber-notification regression.

The client/controller validates existing Auth/User contracts, projects only
currently verified ACTIVE Admin identity, keeps authority in memory, serializes
same-origin session actions and refuses stale/ambiguous results. No UI wiring,
backend/API change, dependency or configuration change occurred. Source review
does not prove live integration. Same-profile cross-origin refresh races remain
unresolved. The plan records exact scope, failures, verification ledger and
historical corrections.

F042 remains IN_PROGRESS, Slice 1 READY_FOR_REVIEW — offline only with acceptance/
original checkpoint BLOCKED, and Slice 2B/F043 NOT_STARTED. Mandatory nine-record
MongoDB evidence remains incomplete with authenticated counters UNKNOWN; no
RESULT/ACK acceptance is inferred. Preserve **173 browser scenarios NOT_RUN**,
live Admin frontend-to-API and production **NOT_VERIFIED**, all prior evidence and
separate acceptance/Git approvals. The next gate is owner review and separately
qualified execution of the failed HTTP regressions, not automatic Slice 2B work.

**F042 Slice 2B named development continuation — owner approval 2026-10-29:**
The owner approves the existing nine-path Admin UI/Protected Scaffold scope,
offline checks and independent review despite blocked Slice 1 MongoDB and
Slice 2A external HTTP verification. Slice 2A evidence is the development
dependency basis, not full acceptance; this changes development order only.
F042 remains IN_PROGRESS, Slice 1 READY_FOR_REVIEW — offline only with acceptance
BLOCKED, Slice 2A IMPLEMENTED — external HTTP verification pending, and Slice 2B
IN_PROGRESS. F043 remains NOT_STARTED. All historical failures, the qualified
HTTP rerun NOT_RUN, mandatory verification/final acceptance and separate Git
approvals remain. Existing 173 browser scenarios NOT_RUN; any newly prepared
F042 cases are counted separately. No HTTP, MongoDB or browser execution,
permission investigation or Git writes are authorized here.

**F042 Slice 2B implementation/offline outcome — 2026-10-29:** The nine-path
Admin UI/Protected Scaffold is implemented under the named development-only
continuation above. Email/password sign-in, explicit restoration, current-device
logout, safe denial/expiry/error/recovery states, current verified ACTIVE Admin
presentation gating and cancellation/account invalidation reuse unchanged Slice
2A contracts. Existing branding, semantic form/landmarks, focus styles, live
announcements and responsive CSS remain source-level implementations, not real
browser evidence. Backend authorization remains authoritative; no F043 controls,
fake metrics, storage tokens, automatic refresh replay or new dependencies.

Final focused run: **42 offline rendering/lifecycle PASS**. Permitted regressions:
**192 PASS** (113 Slice 2A plus 79 non-network Auth/User/Admin/Student cases), giving
**234 distinct offline PASS** for this gate. Initial 36-case focused verification
expanded by six uncertainty/lifecycle cases; count each case once. Admin build and
strict TypeScript including prepared spec PASS. Final static/scope/review results
are recorded in the feature plan. One Low prepared-scenario expectation mismatch
was corrected; no application contract was weakened. Historical 43 EACCES failures,
one inconclusive HTTP cancellation timeout, seven inert cancellation PASS and
qualified eight-file HTTP rerun NOT_RUN are retained. No blocked HTTP rerun occurs.

Exactly **20 F042 browser cases are now prepared, all NOT_RUN**. Existing 173 remain
NOT_RUN; combined backlog **193 NOT_RUN**. Browser layout/accessibility/focus/races
and live Admin frontend-to-API remain NOT_VERIFIED. Mocked cases cannot prove real
JWT/database authorization. No primary-host browser execution or inherited F041
exception is approved. The nine-record MongoDB suite is still incomplete with
authenticated counters UNKNOWN; historical RESULT/ACK, baseline discrepancy and
forced real-timeout limitations remain. Production readiness NOT_VERIFIED.

Current F042 IN_PROGRESS; Slice 1 READY_FOR_REVIEW — offline only, acceptance/
original checkpoint BLOCKED; Slice 2A IMPLEMENTED — external HTTP verification
pending, not accepted; Slice 2B READY_FOR_REVIEW — offline only; F043
NOT_STARTED. The initial 19 pending paths become 26 (four new plus three newly
modified existing Admin files; both documents were already pending). Branch/head
and index must remain unchanged/empty. Owner review, mandatory external verification,
acceptance and any scoped local checkpoint/remote delivery require separate gates.
No staging, commit, push, service/browser execution or permission investigation.

**Final Slice 2B offline review — 2026-10-29:** Admin build, strict TypeScript,
zero-warning targeted lint, seven-file source/test/style formatting, UTF-8/LF,
exact nine-path task scope, diff/secrecy and historical-preservation checks PASS.
Independent fresh-context source/security/test review: Critical 0 / High 0 / Medium 0 /
Low 0 unresolved; one prepared-test Low finding corrected and re-reviewed. Actual
42 focused and 192 regression records give 234 distinct offline PASS; no browser,
HTTP or MongoDB suite was run. New 20 plus existing 173 = 193 browser NOT_RUN.
Current Slice 2B READY_FOR_REVIEW — offline only, F042 IN_PROGRESS; Slice 1
acceptance BLOCKED and Slice 2A external HTTP verification pending. No acceptance,
Git checkpoint/delivery or F043 implementation is authorized. Final repository:
dev at 04efeebce3f81b6b5e4e31f2da11112ed13317d9, 26 pending paths, empty index,
unchanged Slice 1/2A/adapter sources, no staging/commit/push. Mandatory database,
RESULT/ACK, protected-baseline, browser/live and production gates remain open.

### F043 — Admin Technology Management
Status: `IN_PROGRESS`

**Detailed contract and sequencing proposal — owner planning approval,
2026-10-30:** The owner authorized documentation-only preparation and the draft-only
product direction in principle, not implementation. See the
[F043 detailed proposal](features/F043-admin-technology-management.md).
Proposed dependencies: F015 Technology persistence/public contract and F042 Admin
authorization/session foundations; the original entry had no formal dependencies.
Scope: authenticated inventory/detail, create DRAFT, revision-controlled DRAFT
name/description/order edits, immutable unique slug, read-only existing icons and
PUBLISHED/ARCHIVED records, atomic audit. No publication/archive/delete/uploads,
bulk/import/AI/descendant work or F044 functionality.

The current AGENTS.md amendment allows slices of the current active feature only;
it does not unlock F043 while F042 remains open. The plan contains exact proposed
F043-only sequencing wording, **not an effective policy change**. Separate owner
approval is required before editing AGENTS.md and adding a matching F042 record.
The current feature pointer remains F042; F043 stays NOT_STARTED until separately
authorized implementation. F042 remains IN_PROGRESS, final acceptance BLOCKED;
its pushed development checkpoints do not prove Admin authorization or acceptance.
F044 remains NOT_STARTED. No non-overridable security requirement is waived.

Reconciled implementation boundary: **31 unique paths**, originally 21 CREATE /
10 MODIFY, split into backend (18) and frontend (13 additional, plus two shared
evidence documents). The plan file is created during planning, so it will be an
existing file at implementation start. Additional sequencing-policy paths are
separate, not silently included. Canonical API/database wording and all code
remain unchanged pending exact owner approval. Proposed mutation security uses a
real transactional fence on the current Admin User version, DRAFT revision CAS and
an additive Technology audit event committed atomically; the User-version side
effect, concurrency semantics, deadlines/retries and audit extension require
explicit ratification. No snapshot-read-only authority shortcut is accepted.

Each slice requires focused offline checks, relevant regressions, build/TypeScript/
lint/format/scope/privacy checks, independent severity review and separately approved
development Git checkpoint. Real isolated transaction/index/concurrent-eligibility
verification and authenticated RESULT/ACK remain final-acceptance gates, together
with F042's mandatory verification. No new adapter, configuration or execution is
authorized. The same-profile Student/Admin cross-origin refresh-cookie risk remains
unresolved; no session-architecture change is proposed.

Existing **193 browser scenarios remain NOT_RUN**. Twenty F043 browser scenarios
are proposed only, not prepared/executed or added to the existing prepared count.
No browser exception transfers. Live F043 frontend-to-API integration remains
NOT_VERIFIED; production readiness NOT_VERIFIED. Preserve all F042 historical
HTTP failures, incomplete nine-record MongoDB verification, UNKNOWN authenticated
counters, incomplete RESULT/ACK, baseline discrepancy and forced-timeout limitation.
Next gate: contract and exact sequencing-document approval, then separate Slice 1
implementation authorization. This planning record authorizes no Git writes,
feature acceptance or automatic next-feature progression.

**F043-only sequencing enacted and contract finalized — owner decision,
2026-10-30:** This later record supersedes the preceding proposal's pending-policy
statements only; the planning record remains historical. The named exception is
now effective in AGENTS.md and cross-recorded in F042. Separately approved F043
development slices may proceed while F042 remains IN_PROGRESS with acceptance
BLOCKED. The default one-feature-at-a-time workflow remains in force outside
this exception. F043 must use the F042 Admin boundary without treating it as
verified. F043 remains NOT_STARTED; separate Slice 1 implementation approval is
still required. F044/other features receive no inherited exception.

The [finalized F043 contract](features/F043-admin-technology-management.md) specifies
protected inventory/detail, DRAFT create/edit, immutable slug, revision CAS,
read-only PUBLISHED/ARCHIVED/icon references, atomic Technology/audit writes, and
transactional current-Admin eligibility with a real User `__v` write fence. It
documents the actor-version side effect, conflict/rollback/audit implications,
no unsafe mutation replay, bounded same-transaction commit behavior and uncertain
outcome recovery. F015 public behavior and existing authentication/session
architecture remain unchanged. The 31-path implementation boundary and two
separately reviewed/checkpointed slices are retained; no code is authorized here.

F043 acceptance requires its own real integration and completion of F042's
prerequisite verification, not development checkpoint evidence. Preserve all
HTTP/MongoDB failures, UNKNOWN authenticated results, incomplete RESULT/ACK,
baseline and timeout limitations. Every commit and push needs separate owner
approval. Existing 193 browser scenarios remain NOT_RUN; live F043 integration
and production readiness remain NOT_VERIFIED. No tests or services executed.
Next gate: separate exact-scope F043 Slice 1 implementation authorization.

**Slice 1 backend implementation authorization — 2026-10-30:** The owner has now
separately authorized the exact 18-path backend inventory, offline tests/static
verification and independent security review under the enacted exception. F043
transitions through owner approval to IN_PROGRESS; Slice 2 remains NOT_STARTED.
Only the documented backend routes, transaction/fence/audit implementation,
prepared integration assertions and API/database contract transfer are authorized.
No frontend, live database/browser execution, Git writes or acceptance. Earlier
planning/authorization records retain their historical meaning. F042 remains
IN_PROGRESS with acceptance BLOCKED and all HTTP/MongoDB gates open. Existing
193 browser scenarios remain NOT_RUN; production readiness NOT_VERIFIED.

**F043 Slice 1 backend offline outcome — 2026-10-30:** F043 remains IN_PROGRESS;
Slice 1 **READY_FOR_REVIEW — offline only**, acceptance BLOCKED pending real
integration. Slice 2 NOT_STARTED. The exact 18-path backend implementation mounts
protected Technology inventory/detail/create/PATCH, enforces DRAFT/revision/read-
only rules, current signed-token/stored Admin eligibility, real transactional User
version fencing and atomic append-only audit. Public F015 behavior is unchanged.

Executed distinct evidence: 91 focused/audit tests (including 16 route/parser
checks and one real app HTTP test with fake services), 102 selected offline
regressions, 41 audit-dependent grading regressions and 79 existing relevant
loopback HTTP regressions PASS: **313 distinct records**. The cancellation case
specifically PASS. New HTTP evidence does not overwrite F042's historical failures
or close its acceptance/verification ledger automatically. Initial env/test-fixture/
TypeScript/lint failures and corrections are retained in the feature record.
Independent source/security review: zero unresolved Critical/High/Medium/Low;
one Medium and four Low findings corrected/re-reviewed. Compilation, targeted
lint/format, UTF-8/LF, exact scope, diff and secrecy checks accompany offline review.

Prepared F043 PARENT + T01–T14 integration assertions are all NOT_RUN, with no
authenticated RESULT/ACK. The adapter/complete fixture-index inventory, fresh
source pins, real transaction/concurrency/timeout behavior, protected baselines
and owned process/Job cleanup require separate qualification/approval. F042 remains
IN_PROGRESS with acceptance BLOCKED and mandatory verification incomplete. Existing
193 browser scenarios remain NOT_RUN; live frontend-to-API/production readiness
NOT_VERIFIED. No frontend, F044, Git staging/commit/push or live MongoDB/browser run.
Next gate: owner review of offline Slice 1 evidence and separate real-integration
preparation/execution approval; no automatic Slice 2 or Git progression.

**Slice 2 frontend authorization and offline implementation — 2026-10-30:**
The owner separately authorized the 13-path frontend inventory and the two
evidence documents under the enacted F043-only exception, starting at pushed
backend checkpoint `bb2c3838e2f7a40502cd7d25a25dee94c926da9e`. The additional
Admin rendering-test and existing F042 browser-spec paths, including a bounded
synthetic initial-inventory read mock, received separate explicit owner approval.
The exact frontend pass is **17 paths**. Slice 2 transitioned to IN_PROGRESS and
is now **READY_FOR_REVIEW — offline only**, not owner-accepted.

Implemented protected Technology inventory/detail and bounded pagination;
DRAFT creation/editing, immutable slug, revision-aware conflict recovery and
read-only PUBLISHED/ARCHIVED views. The existing Admin lifecycle supplies only
four strict request descriptors with a private token, account/generation checks,
same-origin coordination, nonrenewing 15-second queue/network budget, cookie
omission, no-store and redirect refusal. Response input has a fixed-memory
1 MiB streamed byte cap; mutation JSON is bounded to 4,096 UTF-8 bytes. UI includes
labelled validation, loading/empty/error/save states, explicit refresh/current-
access checks, escaped text and semantic timestamps, focus intent and responsive
CSS. Account/lifecycle changes clear data and refuse late responses; only a
nonsensitive uncertainty flag survives remounts until explicit read reconciliation.
No uncertain mutation is automatically replayed. Public F015/backend behavior and
the existing authentication architecture remain unchanged.

Executed offline evidence: **254 distinct PASS / 0 FAIL / 0 cancelled / 0 skipped**
across new Technology client/controller/rendering checks and existing relevant
Admin client/controller/rendering regressions. A final affected-subset rerun was
**62/62 PASS**, included in the same 254. Source-and-test-inclusive TypeScript,
Admin build and targeted zero-warning lint pass; formatting, UTF-8/LF, scope,
diff and sensitive-data checks accompany final review. A nonfatal Vite dynamic-
import chunking notice is retained in the feature record. Preserve the initial
243 PASS / 2 rendering FAIL and temporary client variable-shadowing failures;
later corrections do not erase them. Retain earlier **313 backend PASS** and
**107 protocol / 33 PowerShell PASS** as historical evidence, not rerun or real
frontend/database acceptance.

Independent read-only source reviewer `f043_frontend_review` identified two
Medium and three Low issues; remount uncertainty, malformed 401/403 refusal,
UTF-8 body bounds, newline slug validation and focus restoration were corrected
with focused checks. No Critical/High finding was identified. Final independent
source/test/document consistency review reports **0 / 0 / 0 / 0 unresolved
Critical / High / Medium / Low findings**. Tests were executed by the implementation
agent, not independently rerun by the source reviewer. Browser/live behavior
remains unverified. Slice 2 is **READY_FOR_REVIEW — offline only**; final F043
acceptance remains BLOCKED.

Exactly **20 F043 browser scenarios are prepared, all NOT_RUN**. The inherited
**193 remain NOT_RUN**: combined prepared browser backlog **213 NOT_RUN**.
No browser execution or exception is authorized/transferred. Mocked browser
fixtures would not prove live F043 frontend-to-API integration. Browser layout,
accessibility, focus, responsiveness and interactions remain NOT_VERIFIED.

F042 remains IN_PROGRESS, acceptance BLOCKED; its HTTP/MongoDB failures, UNKNOWN
authenticated counters, incomplete RESULT/digest ACK and protected-baseline
discrepancy remain preserved. F043 Slice 1 remains READY_FOR_REVIEW — offline
only, with all **15 real PARENT + T01–T14 NOT_RUN**, protected MongoDB process
executable/owner identity UNKNOWN and acceptance BLOCKED. Real concurrency,
transactions, forced timeout/unknown commit, live Admin frontend-to-API
integration and runtime cleanup remain NOT_VERIFIED. Reconcile/review invalidated
integration pins before separate execution approval. F043 stays IN_PROGRESS;
production readiness NOT_VERIFIED; F044 NOT_STARTED. No Git staging/commit/push.
See the [exact change/evidence record](features/F043-admin-technology-management.md).

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

**Current Feature:** F043 - Admin Technology Management (Slice 2 frontend implementation)
**Current Status:** `IN_PROGRESS`
**Next Feature:** F044 - Admin Learning Path Management (not authorized)

**Open verification feature:** F042 remains IN_PROGRESS, acceptance BLOCKED,
HTTP/MongoDB verification incomplete. The owner-approved F043-only exception
permits this named implementation sequence without accepting F042. Slice 2 was
separately authorized on 2026-10-30; F044 receives no sequencing exception. The following named
decision paragraph is the historical documentation-only gate preceding Slice 1.

**Named sequencing decision, 2026-10-30:** F042 remains the open verification
feature, IN_PROGRESS with acceptance BLOCKED. Under the F043-only AGENTS.md
exception, F043 development is eligible for separate exact-scope Slice 1 approval;
F043 remains NOT_STARTED and no implementation is yet authorized. This secondary
field qualifies the earlier next-feature restriction without marking F042 complete
or switching the implementation pointer automatically. No F044 exception exists.

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


The following checklist governs final feature acceptance. A separately authorized
offline implementation review or local development checkpoint under AGENTS.md's
blocked-verification rule does not satisfy unchecked verification requirements or
grant final acceptance. Named sequencing permission does not waive security,
database or browser gates and does not authorize another feature or remote push.

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

---

# 18. Owner-approved design reconciliation — 2026-10-31

## Authority and unchanged feature ledger

The owner explicitly approved documentation updates in PRD.md, LOCAL_DEVELOPMENT.md,
SYSTEM_ARCHITECTURE.md, DATABASE_DESIGN.md, API_DESIGN.md, this roadmap and AGENTS.md
at dev / expected HEAD 45bce961c4da05c8d6302e0e0124dcebacc99a6e. Only those seven
existing files may change in this pass. No new document, package/script/test/fixture,
application implementation, database connection/write, service/ACL operation, paid
AI call, staging/commit/push or history change is approved.

| Record               | Preserved current state                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| F042                 | IN_PROGRESS; acceptance BLOCKED                                          |
| F043                 | IN_PROGRESS; acceptance BLOCKED; offline slice evidence remains distinct |
| F043 MongoDB         | PARENT + T01-T14: 15 NOT_RUN                                             |
| Browser scenarios    | 193 inherited + 20 F043 = 213 NOT_RUN                                    |
| Live integration     | NOT_VERIFIED                                                             |
| Production readiness | NOT_VERIFIED                                                             |
| F044                 | NOT_STARTED; implementation not authorized                               |

Preserve original HTTP/MongoDB failures, UNKNOWN authenticated/ownership results,
incomplete authenticated RESULT/digest ACK and protected-baseline discrepancies.
Documentation, local demonstrations or developer checkpoints do not close those
gates. Section 15's current feature pointer is unchanged. The named F043 exception
does not transfer; no new sequencing exception is created by this reconciliation.

## Product direction mapped to existing IDs — prospective scope only

AI creates curriculum/content; Admin selects the brief, reviews, requests AI
corrections, approves/rejects exact revisions, previews and publishes. Routine
manual lesson/question editing is no longer the intended new workflow. Existing
F043 Technology controls remain until an implemented replacement is accepted.

| Existing ID | Reconciled future intent; existing NOT_STARTED status retained                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F044        | Learning Path proposal structures/review; bounded objectives, audience/version and prerequisites.                                                                                                                   |
| F045        | Module proposals/review and later module-release membership.                                                                                                                                                        |
| F046        | Topic proposals/review, coverage and duplicate findings.                                                                                                                                                            |
| F047        | Private Concept/mode revisions, source evidence and controlled authoring services.                                                                                                                                  |
| F048        | Replace the planned routine manual Concept Editor with Lesson Review Studio and safe Student Preview; sharing/rendering paths need exact approval.                                                                  |
| F049        | Preserve seven editorial states; bind review to exact revisions/digests, separately from job state. Existing dependency F047 remains.                                                                               |
| F050        | Review queue for outlines/lessons with approve/reject/targeted AI revision.                                                                                                                                         |
| F051        | Module-level publication, immutable release manifests, stable IDs/history, atomic audit and unknown-commit reconciliation. Separate interview per-item publication uses these approved invariants when implemented. |
| F052        | Provider abstraction compatible with OpenAI/future providers, no permanently chosen model. Existing dependency F049 remains.                                                                                        |
| F053        | Job bounds, resumability/cancellation, source/privacy controls, concurrent reservations/settlements, shared INR 1,000 cap, 80% warning and hard stop. Existing dependency F052 remains.                             |
| F054        | Proposed bounded curriculum outline generation and Read/Example drafting after exact outline approval. Additional scope requires separate implementation approval.                                                  |
| F055        | Generate suitable structured visualization proposals/specifications only for reviewed supported renderers.                                                                                                          |
| F056        | Generate validated Practice drafts compatible with existing four types; MCQs require separate approved work.                                                                                                        |
| F057        | Generate reviewed revision summaries/flashcards/memory material.                                                                                                                                                    |
| F058        | Technology-owned InterviewQuestion bank, immutable revisions, optional multi-Concept links and separate list/detail/reveal contracts.                                                                               |
| F059        | Simple Student interview browse/filter/search/page/reveal/learning links; Coding Run/Test remains gated by isolated-runner qualification.                                                                           |
| F060        | Personal Know/Need Revision/Important state remains a separate backlog item; deferral from the narrowed Interview MVP needs explicit prioritization approval.                                                       |
| F061        | AI interview drafts/grouping, individual review/corrections and one/selected/all-eligible reviewed-question publication.                                                                                            |

The table changes design intent, not feature approval or executed dependencies.
Before any feature starts, finalize its acceptance criteria, exact file/dependency
inventory, approved contract changes and verification gates. Do not rename/renumber
IDs, advance the pointer or silently rewrite completed feature contracts.

Additional renderer support, interactive MCQs, persistent/general completion origin
and the isolated JavaScript runner lack approved sufficient scope. The owner must
allocate IDs or approve explicit scope extensions before implementation. No number
is invented here; F029/F034 do not establish general visualization delivery/execution.

Requested capability milestones remain: A contracts; B bounded AI planner; C outline
review; D five-mode generation; E quality/preview; F module publication/versioning;
G interview generation; H individual review/multi-publish; I Student bank; J isolated
JavaScript runner; K JavaScript pilot/full qualification. These labels are not
feature IDs or literal authority to bypass dependencies. A proposed future order
may put F049/F052/F053 before paid F054 work and F058/F061 before F059 rollout;
the owner must approve any changed execution order separately. Existing feature
sequencing remains controlling until that decision and prerequisite acceptance.

## Persistent LOCAL prerequisite — named tooling plan, not implementation

The approved target is Student 127.0.0.1:3000, Admin 127.0.0.1:5173, API
127.0.0.1:4000/api/v1, and separate persistent MongoDB 8.2.7 on 127.0.0.1:27019 /
deeplearner-dev-rs / deeplearner-dev, with private storage and scoped credentials.
Do not alter protected 27017 or legacy local-demo/test 27018/data/credentials/receipts.
Availability, service ownership and runtime compatibility remain unverified.

Proposed npm run dev:setup/dev:local are NOT IMPLEMENTED. Daily startup targets
foreground apps/hot reload, no short timeout, no provisioning, and owned-app-only
Ctrl+C cleanup; MongoDB remains separately managed/persistent. Reuse existing
workspace/process helpers rather than the disposable qualification runner.

LOCAL_DEVELOPMENT.md contains exact prospective CREATE/MODIFY paths for A profile/
startup, B separately approved instance/service, C safe index reconciliation,
D genuine Student/Admin auth, E minimal JavaScript fixture and F manual/restart
demonstration. These local A-F stages are distinct from the Studio milestone labels.
Each needs separate source-scope/implementation approval, applicable execution
approval, offline/security checks and owner review. They do not approve F044 or
waive F042/F043 verification. No application bug fix is silently included in tooling.

DEV-PERSISTENT-27019 is PROPOSED / NOT ACTIVE. Its exact wording is in the dated
DATABASE_DESIGN.md amendment and AGENTS.md cross-reference. Existing persistent-index
restrictions remain effective until explicit activation plus approved source/profile/
collection/index/fixture inventory and particular execution. No destructive schema
repair, reset, index removal, blanket upsert or generalization to another DB is allowed.

Initial fixture: one published JavaScript Technology, Path and Module, representative
Read/Example/Revise Concepts and one OUTPUT question. Normal Student interaction
creates actual activity; no attempts/progress/mastery are fabricated. General
visualization delivery, coding execution and persistent completion/mastery remain
separate application prerequisites. Expand to four Modules/eight Topics only after
the first demo succeeds and a new fixture revision is separately approved.

## Future manual UI checkpoint and acceptance separation

Require implementation -> offline tests -> genuine local demonstration -> manual
Chrome UI testing -> approved fixes -> security/regression review -> owner checkpoint
review -> separately approved Git commit -> separately approved push. Record actual
route/role/authentication, interactions, applicable API/database effects, desktop/
mobile viewport checks, errors/validation, sanitized diagnostics, PASS/FAIL/BLOCKED
and owner review. Mocks cannot satisfy live integration. A blocked demonstration
needs an explicit named exception; do not silently mark UI complete or relabel old
results. These new workflow expectations are prospective, not retroactive evidence.

Manual QA does not replace focused/regression/build/lint/TypeScript/format checks,
independent security review or mandatory real database/HTTP/automated browser
acceptance. Disposable tests retain process/Job ownership, fixture isolation,
protected baselines, authenticated RESULT/digest ACK, deadlines and cleanup.
Primary-host Playwright remains prohibited pending separately approved qualification;
browser exceptions do not transfer. Local acceptance is not production release
approval. F080-F088 consolidation never postpones required per-feature checks.

# 19. Local Development Slice A checkpoint — 2026-10-31

Secondary tooling evidence only; no feature ID, pointer or historical result changes.
The owner approved implementation of root `npm run dev` at dev /
41d78aae50715f6ad3b1deac1587cc215918aa9f using the documented Slice A paths, then
explicitly added `apps/api/package.json` for a dotenv-free API dev:local script.
The earlier proposed root dev:local/dev:setup commands remain unimplemented.

Source scope is ten paths: root/API package.json; LOCAL_DEVELOPMENT.md,
SYSTEM_ARCHITECTURE.md and this roadmap; new Start-DeepLearnerDev.ps1,
dev-local.example.json, API scripts/dev-local.ts, API tests/dev-local.test.ts and
scripts/tests/DevLocal.Tests.ps1. No dependencies, application/authentication logic,
environment files or persistent configuration change. The twelve original untracked
Stitch exports remain preserved and excluded from source delivery.

Implementation adds fail-closed private profile/script/credential validation,
sanitized child environments, existing workspace builds/watchers, loopback bindings,
exclusive lock, occupied-port refusal, native Job ownership checks and bounded
reload recovery. Ctrl+C cleanup is explicitly forced owned-Job containment, not
qualified graceful shutdown. It never starts/stops MongoDB or provisions anything.

Operational qualification is BLOCKED: the private profile and separate instance/
schema setup are pending. Observed npm run dev exits 1 at DEV_PROFILE_MISSING before
apps, database connections or run artifacts. This negative check does not prove
positive startup, hot reload, real listener ownership, Ctrl+C, authentication or UI
integration. Genuine accounts/JavaScript content remain later separate prerequisites.
Offline evidence/review is recorded in LOCAL_DEVELOPMENT.md; no local commit or push
is authorized by implementation approval. Do not start Slice B automatically.

Keep F042/F043 IN_PROGRESS with acceptance BLOCKED, F043 MongoDB 15 NOT_RUN, browser
213 NOT_RUN, live integration/production NOT_VERIFIED and F044 NOT_STARTED.
DEV-PERSISTENT-27019 remains PROPOSED / NOT ACTIVE. Existing FAIL/UNKNOWN evidence,
ownership/isolation/cleanup, browser restrictions and mandatory acceptance gates
remain unchanged. This tooling checkpoint establishes no production readiness.

# 20. Slice B persistent MongoDB preparation — 2026-10-31

Secondary tooling evidence, not a new feature ID/status or sequencing exception.
Owner-approved preparation at dev / 23636ad13209d11b84da49484eddf60788a30fd6 covers
the new Setup-DeepLearnerDev.ps1, root dev:setup Plan command, existing Node helper/
PowerShell tests and current LOCAL/DATABASE/roadmap sections. The pending narrow
Stitch-source .gitignore entry is preserved; the twelve originals remain unchanged.
No architecture, application/authentication, dependency, lint configuration or
private profile change is included.

The prior separately approved normal-token qualification found no 27019 listener,
an absent proposed private directory and a current-user-owned existing parent.
That snapshot is not a reservation, operational qualification or service adoption.
The owner approved advertised replica member localhost:27019 while keeping network
binding/client URI 127.0.0.1:27019. The fixed plan excludes protected 27017/27018.

Implemented: non-mutating default Plan and configuration templates; exact target/
binary/service/private path checks; inactive-policy guards; exclusive creation and
private ACL descriptors; separate guarded preparation/install/start/stop candidates;
registration/live identity checks and lifecycle lock; exact replica plan. Actual
start/initialization retain an independent authenticated-bootstrap prerequisite.
No unauthenticated initialization actuator is provided or claimed complete.

Offline evidence/final review is recorded in LOCAL_DEVELOPMENT.md. It is not a real
MongoDB, service, ACL, transaction, restart-persistence or application startup PASS.
No service/config/storage/key/user/database was provisioned; no Admin access was
requested. Service installation, account logon rights, private ACL/source inventory,
policy activation and particular execution each need explicit future approval.
Authenticated connection-bound bootstrap must be separately contracted before
start/initialization can be enabled. Do not start Slice C automatically.

Preparation is **READY_FOR_OFFLINE_CHECKPOINT** for separate owner review only;
**not ready for blanket provisioning approval**. The final source review has zero
unresolved Critical/High/Medium/Low findings; 22 inert and 9 startup-validation tests,
API TypeScript, source lint, section formatting and integrity checks PASS. The known
root lint cache limitation remains separate. Persistent MongoDB is NOT_PROVISIONED;
application startup/shutdown remains NOT_VERIFIED. Preserve
DEV-PERSISTENT-27019 PROPOSED / NOT ACTIVE; F042/F043 IN_PROGRESS with acceptance
BLOCKED; F043 MongoDB 15 NOT_RUN, browser 213 NOT_RUN, live integration/production
NOT_VERIFIED and F044 NOT_STARTED. No Git commit/push or production permission is
granted by this preparation.

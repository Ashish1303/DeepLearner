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

# 5. Current Feature

## F001 — Public Landing Page

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
**Status:** `NOT_STARTED`

### F003 — Signup + Email Verification UI
**Goal:** Build account creation and verification screens.  
**Dependencies:** F002  
**Status:** `NOT_STARTED`

---

## Phase B — Common Backend Foundation

### F004 — Backend Common Foundation
**Goal:** Finalize common backend behavior before auth.  
**Scope:** error model, standardized response envelope, request IDs, structured logging, validation pattern, versioned routing, CORS, security headers, request limits, sanitized errors.  
**Dependencies:** F000  
**Status:** `NOT_STARTED`

---

## Phase C — Authentication + Users

### F005 — MongoDB Connection Foundation
**Goal:** Connect API safely to MongoDB Atlas.  
**Dependencies:** F004  
**Status:** `NOT_STARTED`

### F006 — User + Session Models
**Goal:** Implement users, sessions, verification tokens, reset tokens, indexes and TTL indexes.  
**Dependencies:** F005  
**Status:** `NOT_STARTED`

### F007 — Email Registration + Verification
**Dependencies:** F006  
**Status:** `NOT_STARTED`

### F008 — Login + Access/Refresh Tokens
**Dependencies:** F007  
**Status:** `NOT_STARTED`

### F009 — Logout + Session Management
**Dependencies:** F008  
**Status:** `NOT_STARTED`

### F010 — Forgot / Reset / Change Password
**Dependencies:** F008  
**Status:** `NOT_STARTED`

### F011 — Google Authentication + Account Linking
**Dependencies:** F008  
**Status:** `NOT_STARTED`

### F012 — `/users/me` + Student Profile
**Dependencies:** F008  
**Status:** `NOT_STARTED`

---

## Phase D — Student Application Shell

### F013 — Authenticated Student Shell
**Dependencies:** F008  
**Status:** `NOT_STARTED`

### F014 — Student Onboarding
**Dependencies:** F012, F013  
**Status:** `NOT_STARTED`

---

## Phase E — Technology & Learning Hierarchy

### F015 — Technology Catalog Backend
**Initial Data:** JavaScript only  
**Dependencies:** F005  
**Status:** `NOT_STARTED`

### F016 — Explore Technologies UI
**Dependencies:** F015, F013  
**Status:** `NOT_STARTED`

### F017 — Learning Path Backend
**Dependencies:** F015  
**Status:** `NOT_STARTED`

### F018 — Module Backend
**Dependencies:** F017  
**Status:** `NOT_STARTED`

### F019 — Topic Backend
**Dependencies:** F018  
**Status:** `NOT_STARTED`

### F020 — Learning Path Student UI
**Dependencies:** F017, F018, F019  
**Status:** `NOT_STARTED`

---

## Phase F — Concept Learning

### F021 — Concept Read Model + API
**Dependencies:** F019  
**Status:** `NOT_STARTED`

### F022 — Concept Read UI
**Dependencies:** F021  
**Status:** `NOT_STARTED`

### F023 — Concept Example Mode
**Dependencies:** F021  
**Status:** `NOT_STARTED`

### F024 — Concept Revise Mode
**Dependencies:** F021  
**Status:** `NOT_STARTED`

### F025 — Source Link Requirement
**Dependencies:** F021  
**Status:** `NOT_STARTED`

---

## Phase G — Visualization MVP

### F026 — Visualization Data Model
**Dependencies:** F021  
**Status:** `NOT_STARTED`

### F027 — Visualization Renderer MVP
**Recommended First Type:** Animated execution flow  
**Dependencies:** F026  
**Status:** `NOT_STARTED`

### F028 — Visualization Controls
**Dependencies:** F027  
**Status:** `NOT_STARTED`

### F029 — First Real Visual Lesson
**Recommended Concept:** JavaScript Event Loop or Closure  
**Dependencies:** F028  
**Status:** `NOT_STARTED`

---

## Phase H — Practice

### F030 — Practice Question Base Model
**Dependencies:** F021  
**Status:** `NOT_STARTED`

### F031 — Output-Based Questions
**Goal:** Implement one question type end-to-end first.  
**Dependencies:** F030  
**Status:** `NOT_STARTED`

### F032 — Descriptive Questions
Status: `NOT_STARTED`

### F033 — Scenario-Based Questions
Status: `NOT_STARTED`

### F034 — Coding Questions
Status: `NOT_STARTED`

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

**Current Feature:** `F001 — Public Landing Page`  
**Current Status:** `APPROVED_COMPLETE`  
**Next Feature:** `F002 — Login Page UI`

**Rule:** F002 cannot begin until F001 is `APPROVED_COMPLETE`, unless the project owner explicitly changes the sequence.

---

# 16. Definition of Done for Every Feature

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

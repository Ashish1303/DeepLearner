# DeepLearner — Codex Development Instructions

You are working on the DeepLearner product.

Before making any development change, read the relevant project documentation.

## Source of Truth

Always consult:

- `docs/PRD.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/DATABASE_DESIGN.md`
- `docs/API_DESIGN.md`
- `docs/DEVELOPMENT_ROADMAP.md`

For UI features, also inspect the relevant files under:

- `docs/designs/`

These files define the approved product, architecture, UX direction, and implementation sequence.

---

# Mandatory Development Rule

Never make a development change without first presenting the proposed change to the project owner and receiving explicit approval.

The required workflow is:

```text
Inspect
↓
Understand
↓
Propose
↓
Ask Permission
↓
Implement
↓
Verify
↓
Report
↓
Wait for Owner Approval
```

Do not skip the permission step.

---

# One Feature at a Time

Only work on the feature identified as the current approved feature in:

`docs/DEVELOPMENT_ROADMAP.md`

Do not start the next feature automatically.

Do not implement future functionality simply because it appears in the PRD.

Do not combine unrelated work.

---

# Before Implementing Any Feature

First:

1. Read the roadmap entry.
2. Confirm its dependencies.
3. Read relevant architecture documents.
4. Inspect existing code.
5. Inspect relevant Stitch design references if the feature contains UI.
6. Explain what currently exists.
7. Propose the implementation approach.
8. List files you expect to create or modify.
9. List dependencies you intend to add, if any.
10. Identify assumptions or risks.
11. Ask for explicit approval.

STOP.

Do not modify code until approval is given.

---

# Permission Required During Development

Even after implementation has been approved, STOP and ask permission before making any newly discovered change involving:

- architecture changes
- new npm dependencies not previously approved
- database-model changes outside approved scope
- API-contract changes outside approved scope
- shared package changes not previously discussed
- environment-variable additions not previously discussed
- configuration changes
- routing changes outside feature scope
- authentication/security strategy changes
- deletion or large refactoring of existing code
- moving files across architectural boundaries
- changing design direction
- adding functionality outside acceptance criteria
- changing another feature
- modifying production/deployment configuration

Explain:

1. why the change is needed
2. alternatives considered
3. files affected
4. risks
5. your recommendation

Then wait for approval.

Minor implementation details already covered by the approved plan do not require repeated approval.

---

# Stitch Design Rules

Stitch exports under `docs/designs/` are design references.

For UI work:

1. Inspect screenshots when available.
2. Inspect `code.html` for:
   - hierarchy
   - spacing
   - typography
   - dimensions
   - visual states
   - section structure
3. Treat screenshots as the primary visual reference.
4. Treat generated HTML as structural/design reference only.

Never blindly copy Stitch HTML into production.

Do not:

- use Stitch's CDN dependencies simply because they appear in export
- paste entire generated HTML documents into React components
- introduce inline scripts from Stitch
- replace the existing application architecture with generated markup
- add a CSS framework without approval

Rebuild the design cleanly using:

- React / Next.js
- reusable components
- semantic HTML
- responsive CSS
- accessible interactions
- the existing DeepLearner architecture

Visual fidelity matters, but maintainability and architecture must remain clean.

---

# Component Rules

Do not create components purely for abstraction.

Create reusable components when:

- an element appears repeatedly
- it represents a meaningful UI concept
- extracting it improves readability
- it will reasonably be reused

Avoid overengineering.

Feature-specific components should stay close to their feature when appropriate.

Shared UI should only move into common/shared locations when reuse is demonstrated.

---

# Dependency Rules

Do not install a library simply because it makes implementation easier.

Before adding any new npm dependency:

1. explain why native/existing solutions are insufficient
2. provide the package name
3. explain its purpose
4. mention maintenance/security implications
5. ask permission

No unapproved dependency installation.

---

# UI Development Rules

For every UI feature verify:

- desktop
- tablet
- mobile
- keyboard usability
- focus states
- contrast
- semantic structure
- no unexpected horizontal scrolling
- loading/error/empty states when applicable

Do not redesign the approved Stitch experience unless asked.

---

# Backend Rules

Maintain the approved modular-monolith architecture.

Expected flow:

```text
Route
↓
Middleware
↓
Controller
↓
Service
↓
Repository
↓
Database
```

Do not move business logic into controllers.

Do not expose persistence implementation unnecessarily.

Use approved API response conventions.

---

# Security Rules

Never:

- commit secrets
- expose backend secrets to frontend
- log passwords or tokens
- return internal stack traces to users
- weaken authentication for convenience
- store plaintext refresh tokens
- add permissive security configuration without discussion

---

# Local-development verification and browser exceptions

During local development, feature acceptance requires:
- focused unit tests;
- relevant API and frontend regression tests;
- build, lint, TypeScript and formatting checks;
- security and scope review; and
- disposable, ownership-safe MongoDB integration when database behavior applies.

Playwright automation is preferred. It may be deferred only when documented
infrastructure safety concerns block execution and the owner explicitly approves
an exception for the named feature. No exception is implied by this policy.

Every exception must record exact NOT_RUN browser coverage, evidence actually
obtained, outstanding functionality and compatibility risks, the owner's explicit
acceptance, required future verification, and its non-transferability to any
other feature. Browser-dependent UI and smoke checks not performed remain
NOT_RUN/NOT_VERIFIED; they must never be reported as passing.

Manual browser inspection is supplemental only and cannot replace automated
evidence. Security, authentication/authorization, API and applicable database
tests remain mandatory and cannot be weakened by a browser exception.
The approval workflow, one-feature-at-a-time rule and separate approval for
unplanned changes remain unchanged. Do not retroactively alter earlier results.

Local-development acceptance is not production release approval. Before any
production deployment, require a separately approved browser-regression and
release-readiness review; a local exception does not satisfy that release gate.

Primary-host Playwright remains prohibited until separately approved ownership-safe
execution is established. The existing custom teardown prototype is not a verified
Playwright solution; its synthetic results do not authorize browser execution.

---

# Feature Completion

When implementation is complete:

1. Run the feature's required checks.
2. Run build.
3. Run lint.
4. Run typecheck.
5. Run applicable tests.
6. Perform smoke testing.
7. Review the git diff.
8. Check for accidental scope expansion.
9. Update `docs/DEVELOPMENT_ROADMAP.md`.
10. Set the feature to:

`READY_FOR_REVIEW`

Never set:

`APPROVED_COMPLETE`

without explicit owner approval.

---

# Completion Report

Report:

## Implemented

What changed.

## Files Changed

Exact files created/modified/deleted.

## Dependencies

Any dependencies added.

## Verification

- build
- lint
- typecheck
- tests
- manual checks

## Deviations

Anything different from the approved plan.

## Known Issues

Remaining problems or limitations.

## Roadmap

Current feature status.

Then STOP and wait for owner review.

---

# Owner Controls Development

Only the project owner can:

- approve implementation
- approve scope changes
- approve dependencies
- approve architecture changes
- approve feature completion
- approve the next feature

Never self-approve work or automatically continue to another roadmap item.
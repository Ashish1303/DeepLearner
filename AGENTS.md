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

## Development progress while external verification is blocked

Implementation, offline verification, integration/browser verification, owner
acceptance, local development Git checkpoints, remote delivery and production
readiness are separate gates. Keep existing official feature statuses; record
these distinctions as secondary evidence fields, not replacement statuses.

The owner may explicitly authorize named slices of the current active feature to
proceed before a blocked verification gate is completed when:

- The execution-environment blocker is evidenced and the dependent interface
  contract is sufficiently stable.
- Relevant offline tests, build, TypeScript, lint, formatting and scope checks pass.
- No known unresolved application security defect invalidates the dependent work.
  Unresolved Critical or High findings block this exception.
- The authorization records exact scope, dependencies, deferred verification,
  risks and conditions requiring reassessment.
- Mandatory verification and final acceptance remain outstanding.

A failed or inconclusive run retains its actual outcome independently of any
environment blocker. Mocks, environment failures and development checkpoints do
not prove real database behavior. NOT_RUN and UNKNOWN never become PASS merely
because development is permitted to continue.

After offline verification and security review, the owner may separately approve
an explicitly scoped local development commit labelled with incomplete
verification. Unresolved review findings must be resolved before that checkpoint.
It does not establish slice or feature acceptance, authorize a push, or unlock
another feature. Remote Git delivery requires its own explicit owner approval.

Final feature acceptance still requires all mandatory verification and explicit
owner approval. Authentication/authorization, real database verification, process
ownership, fixture isolation, cleanup, secret/privacy protection, authenticated
RESULT/ACK and existing deadlines are not weakened by this sequencing rule.
Existing named-feature browser-exception rules remain unchanged and do not
transfer between features. This rule authorizes no deployment, production
readiness, security bypass or automatic next-feature progression.

## Named F043 development-only sequencing exception

Owner-approved on 2026-10-30, exclusively for F043 Admin Technology Management.
The owner may separately authorize an explicitly inventoried F043 development
slice while F042 remains IN_PROGRESS with mandatory verification incomplete.
This exception changes only the normal next-feature implementation sequencing
rule for F043; the default one-feature-at-a-time policy applies everywhere else.
F042 remains the open verification feature. F043 remains NOT_STARTED until
separate exact-scope Slice 1 implementation approval; no implementation is
authorized by this documentation amendment. Do not start Slice 2 automatically.

F043 must reuse the F042 Admin security boundary without treating it as verified.
Before each slice require a stable dependent contract, retained applicable
prerequisite offline evidence, and no unresolved Critical/High finding invalidating
the dependent work. After each slice require applicable offline checks and a fresh
independent review, with all findings resolved before checkpoint eligibility.
A newly discovered F042 security defect that invalidates dependent work suspends
this exception pending owner review.

F042 remains IN_PROGRESS with acceptance BLOCKED. Preserve its historical HTTP
and MongoDB failures, incomplete suite, UNKNOWN authenticated results, incomplete
RESULT/digest ACK and protected-baseline discrepancy. Development checkpoints,
including remotely delivered checkpoints, establish neither acceptance nor
production readiness. F043 acceptance requires its own mandatory real database
integration and completion of the F042 prerequisite verification gate, plus all
applicable authentication/authorization, regression, process/Job ownership,
isolation, deadlines, authenticated RESULT/ACK and cleanup requirements. Nothing
here waives an existing security or acceptance gate.

Every Git commit and every push requires separate explicit owner approval.
No browser exception transfers; existing browser restrictions remain unchanged.
This exception authorizes no F044/other-feature progression, production readiness
or deployment. Scope, deferred evidence, risks and slice boundaries are recorded
in docs/features/F043-admin-technology-management.md and the F042/roadmap records.

---

## Documentation-approved persistent LOCAL workflow — 2026-10-31

The owner approved documentation of the Admin AI Content Studio, separate Interview
Preparation and permanent LOCAL development design, plus a prospective tooling plan.
This is documentation authority only. It authorizes no application/tooling code,
MongoDB installation/configuration/connection/write, service/ACL operation, paid AI
call, Git staging/commit/push, feature acceptance or F044 progression.

The approved design target is Student 127.0.0.1:3000, Admin 127.0.0.1:5173, API
127.0.0.1:4000/api/v1, and a distinct MongoDB 8.2.7 instance on 127.0.0.1:27019,
replica set deeplearner-dev-rs, database deeplearner-dev, private persistent storage
and scoped credentials. Availability/safety is not verified. Protect existing
27017, local-demo/test 27018, all other databases/data/credentials/receipts and
production. Do not reinterpret stored ownership receipts as current runtime proof.

**DEV-PERSISTENT-27019 is a PROPOSED / NOT ACTIVE provisioning policy.** Its exact
wording and prospective inventory are in docs/DATABASE_DESIGN.md, under the dated
2026-10-31 amendment. Existing F036/later persistent-index restrictions remain in
force. Separate explicit policy activation, approved setup source/profile/index/
fixture inventory and particular execution approval are required before any writes.
Service installation/initialization and permission changes need their own approval.
Never generalize this proposal to another database or qualification feature.

Once separately implemented and authorized, proposed npm run dev:local is foreground
application startup only: hot reload, stable ports, no short demo expiry, no account/
index/seed provisioning, no unidentified listener adoption/termination, and cleanup
of only owned application children. MongoDB is managed separately and retains data.
Proposed npm run dev:setup handles only explicitly approved initial/reconciliation
work. Neither command currently exists. Reuse repository helpers/workspace scripts;
do not make the disposable integration runner the ordinary development launcher.

For future UI changes, require implementation -> offline tests -> genuine local
demonstration -> manual Chrome UI testing -> approved fixes -> security/regression
review -> owner checkpoint review -> separately approved Git commit and push.
Record exact accessible route, actual authentication/role, interactions, applicable
API/database behavior, desktop/mobile viewport checks, validation/error states,
sanitized console/network evidence and PASS/FAIL/BLOCKED with owner review. Mocks
do not prove live integration. If demonstration is blocked, report the exact blocker
and obtain an explicit named exception before claiming UI completion. This is an
additional future workflow gate, not a retroactive alteration of earlier records.

Manual QA supplements rather than replaces automated authentication/security,
database/HTTP/browser acceptance. Preserve disposable ownership/isolation, protected
baselines, authenticated RESULT/digest ACK, deadlines and cleanup requirements.
Primary-host Playwright remains prohibited until separately qualified/approved;
no existing browser exception transfers. F042/F043 remain IN_PROGRESS, acceptance
BLOCKED; F043 MongoDB 15 NOT_RUN, browser 213 NOT_RUN, live integration/production
NOT_VERIFIED, F044 NOT_STARTED. Historical FAIL/UNKNOWN results remain unchanged.

The prospective A-F inventories in docs/LOCAL_DEVELOPMENT.md require separate
exact-scope implementation approvals, runtime approvals and review. This amendment
does not approve any implementation slice or create a new sequencing exception.

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

## First-user bootstrap offline implementation — 2026-10-31

Owner-approved nine-path implementation only. DEV-PERSISTENT-27019 remains
PROPOSED / NOT ACTIVE; the PowerShell and existing Node execution guards remain
unconditional refusals. No profile value, CLI flag or stage receipt activates them.
No certificate/credential generation, service/ACL change, MongoDB connection or
bootstrap execution is authorized by this amendment.

The prepared flow uses BootstrapFirstUser for the exact dedicated 27019 service,
certificate-required TLS during the MongoDB localhost exception, and a single
stopped-service transition to the existing LOCAL/SCRAM transport with localhost
bypass disabled. Normal StartService must verify the complete normal configuration,
SCM/executable/listener ownership and fresh authenticated state; it never bootstraps.
The Node helper is an internal private protocol, not a separately approved CLI.

Future policy activation requires a separate reviewed source inventory covering
both execution guards (including apps/api/scripts/dev-local.ts, unchanged here),
all service/storage/profile/certificate/credential inventories and particular
execution. A standalone Node-guard activation is not sufficient approval.

The proposed narrow metadata exception in DATABASE_DESIGN.md permits only the
listed replica/user/role commands and their MongoDB-managed system effects, after
separate activation/execution approval. It grants no direct system-collection
writes, application schema/seed permission or implicit recovery authority.
Exact application insert grants inherently allow implicit creation of those
approved collection names in MongoDB; never claim an absolute database-enforced
insert-existing-only restriction. Startup readiness and autoCreate/autoIndex=false
remain required; no runtime/API guard or broader privilege is introduced here.

Keep F042/F043 acceptance BLOCKED, F043 MongoDB 15 NOT_RUN, browser 213 NOT_RUN,
F044 NOT_STARTED and production NOT_VERIFIED. Historical failures remain intact.

## Inactive activation-source implementation — 2026-11-01

Owner-approved ten-file offline implementation only. DEV-PERSISTENT-27019 remains
**PROPOSED / NOT ACTIVE**, source-policy version 1. The historical unconditional
refusal record above describes the earlier checkpoint. Current effect guards
require matching PowerShell/Node source definitions and a private per-invocation
CLI context; inactive source still refuses. No profile, receipt, environment,
request body or CLI flag activates this policy or issues a context.

The only prospective operations are PrepareStorage, InstallService, StartService,
StopService and BootstrapFirstUser, for the exact dedicated 127.0.0.1:27019 target.
Legacy InitializeReplica and mongo-initialize are permanently unavailable.
Source activation, each particular runtime operation, Git commit and push remain
separate explicit owner gates. This amendment activates none of them.

Dot-sourcing/imports and exported effect calls cannot issue an accepted context.
CLI contexts bind fixed target, exact action and independently derived Windows
owner SID, contain no credentials and are revoked in finally. The internal Node
helper checks the private owner-bound manifest/source hash/certificate pins; this
does not prove its PS parent Job or live SCM ownership. Only the approved PS flow
is an authorized future execution route; its fresh service/image/listener/path/ACL
checks around each helper remain mandatory. Same-owner source/private-material
control and SYSTEM/Administrator trust boundaries are unchanged.

Offline tests must stay inert even with synthetic ACTIVE facts: no accepted live
CLI context, real provisioning, crypto material, service or database actuator is
allowed. Positive orchestration uses local host-operation mocks; policy/lease/
protocol checks use memory. Child CLI tests use only Plan/policy-check metadata
or permanently disabled legacy initialization. Test isolation must be reviewed
before changing gates; ambiguity stops work.

MongoDB remains NOT_PROVISIONED, application startup/shutdown NOT_VERIFIED,
F042/F043 acceptance BLOCKED, F043 MongoDB 15 NOT_RUN, browser 213 NOT_RUN,
F044 NOT_STARTED and production NOT_VERIFIED. No runtime qualification is implied.

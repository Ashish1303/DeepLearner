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

## Named F044 read-only development sequencing exception — 2026-11-02

The owner approved only Technology selection and protected read-only Learning Path
inventory/detail under F044. This exception supersedes earlier F044 sequencing
prohibitions only for that exact slice; the default one-feature-at-a-time rule and
the historical F043-only exception remain unchanged outside this scope.
The owner approved the F044 API/DTO/parent/navigation contract and checkpoint
inventories and separately authorized backend Checkpoint A implementation and
focused offline checks. Frontend Checkpoint B still needs separate implementation
approval. F044 is partial development progress, never full feature completion.

Require a stable reviewed dependency contract, expected Git baseline/scope and
applicable retained offline evidence before implementation. An unresolved shared
security defect invalidating the dependency suspends work; Critical/High findings
block continuation. Reuse F042 Admin and F043 selection/session boundaries without
treating them as verified. Preserve Technology mutation uncertainty and all
historical failures, UNKNOWN results, incomplete RESULT/ACK and cleanup/baseline
limitations. Outstanding manual stale-revision and Student learning checks remain
unresolved; neither a defect nor PASS is inferred.

After implementation require focused offline/static/scope/privacy checks and a
fresh independent review, all findings resolved before checkpoint eligibility.
Live HTTP/database/browser verification remains separately authorized and requires
a qualified isolated environment, exact source/fixture/index/result manifest,
ownership/Job checks, secret safety, deadlines, authenticated RESULT/digest ACK
and cleanup/protected-baseline proof. This exception grants no runtime execution,
permission change or transfer of an existing browser exception.

F042/F043 remain IN_PROGRESS, acceptance BLOCKED. Final acceptance requires their
mandatory prerequisite verification plus F044's own applicable real verification
and explicit owner approval. Preserve all 213 browser scenarios NOT_RUN and
production readiness NOT_VERIFIED. Every commit and push requires separate owner
approval. No authoring, generation, editorial approval, publication, deletion,
schema expansion, F052–F054 implementation, other F044 slice or F045/later work
is authorized. See docs/features/F044-admin-learning-path-management.md for exact
scope, deferred evidence and the two checkpoint inventories.

## Named F044 C1 proposal-foundation sequencing extension — 2026-11-04

The owner approved documentation of C1 and this narrow extension, not source
implementation. After separate exact-scope implementation authorization, only
the four CREATE paths in the F044 contract's C1 inventory may implement its private
proposal model, structural/binding validation, DTO projection and offline tests.
This supersedes the 2026-11-02 prohibition on another F044 slice/schema definition
only for that inventoried, offline C1 foundation. The original A/B contracts and
default one-feature-at-a-time rule otherwise remain unchanged.

C1 is NOT_STARTED until separately authorized. No application import/registration,
API/UI, repository/writer, database connection or persistence, provisioning/index
creation, migration, account change, AI/provider call, editorial decision,
publication, additional F044 slice or F045/later work is permitted. Model
registration and document validation may be exercised only on the existing
disconnected Mongoose instance with synthetic in-memory data. No new dependency.

Before implementation require the reviewed C1 field/binding/index contract,
exact Git baseline/inventory, stable F017/F042/F043 dependencies, retained relevant
offline evidence and no unresolved shared security defect invalidating that work;
Critical/High findings block continuation. After implementation require C1's
focused offline/static/scope/privacy checks and fresh independent review, with all
findings resolved before checkpoint eligibility. A passing digest or model check
grants no authentication, source trust, approval or database authority.

F044 stays IN_PROGRESS, partial development only; F042/F043 acceptance stays
BLOCKED. All mandatory authentication/authorization, real integration, isolation,
process/Job ownership, protected baselines, deadlines, authenticated RESULT/ACK,
cleanup and owner-acceptance gates remain unchanged. Nine F044 integration
records and 225 prepared browser cases remain NOT_RUN; production readiness stays
NOT_VERIFIED. Existing observed login/restoration/Path-access/logout PASS evidence
does not satisfy those gates and need not be repeated for C1. Every commit and
push still requires separate explicit owner approval. See the dated C1 contract
in docs/features/F044-admin-learning-path-management.md; no implementation is
authorized by this amendment alone.


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

## Owner-approved source-policy activation — 2026-11-01

DEV-PERSISTENT-27019 is now **ACTIVE at the source-policy level only**, version 1,
following the owner's nine-file offline amendment approval. Both source statuses
changed only after the four corrected fixtures and activation-safe checks passed.
Earlier inactive-policy records above remain historical evidence, unchanged.

The exact source allowlist remains PrepareStorage, InstallService, StartService,
StopService and BootstrapFirstUser for 127.0.0.1:27019 / deeplearner-dev-rs /
deeplearner-dev / DeepLearnerDevMongo27019. Activation is not permission to invoke
any of them. Each effectful operation requires separate explicit owner approval,
exact inventory and current host qualification; service installation/elevation
requires its own approval under the original Windows owner. Protected 27017/27018
resources, production and unrelated storage/services remain excluded.

No application accounts, collection/index provisioning, fixtures, application
profile activation or application startup is authorized. No credential/certificate
generation, MongoDB connection, service/ACL change or database operation was
performed by this amendment. CLI context/owner/source-agreement guards, exact
service DACL, TLS/keyfile/DPAPI, privileges and recovery contracts are unchanged.
The internal Node context does not prove its PS parent or live service ownership;
the PS ownership checks around every helper remain mandatory. Legacy initialization
remains disabled. Source deactivation does not stop a running service and also
blocks guarded lifecycle actions; obtain any required owned-service shutdown
approval separately. Never reset/delete/recreate persistent data to recover.

MongoDB remains NOT_PROVISIONED; app startup/shutdown NOT_VERIFIED; F042/F043
acceptance BLOCKED; F043 MongoDB 15 NOT_RUN; browser 213 NOT_RUN; F044 NOT_STARTED;
production NOT_VERIFIED. Git staging/commit/push remain separately approved gates.
## Manual persistent MongoDB — offline amendment, 2026-11-01

The owner approved the twelve-path manual-runtime implementation and fresh
independent review. DEV-PERSISTENT-27019-MANUAL starts INACTIVE, version 1;
the existing ACTIVE service policy and legacy service operations are unchanged.
ManualPlan and --check-manual-policy are metadata only. Imported calls cannot
issue a live context, including with synthetic ACTIVE policy facts.

Manual source activation and all effectful execution remain distinct gates.
The latest bounded B–F mission permits continuing only after reviewed source,
focused tests and current host qualification pass. No implementation checkpoint
alone proves runtime success or authorizes Git staging/commit/push.

Reuse LocalProcessOwner.cs without modification. Retain the exact Child handles,
creation/image/Job evidence and listener PID; never adopt a PID or stored receipt.
Normal shutdown requires the authenticated shutdown request, retained zero exit,
empty Job and released target socket. Forced Job containment is failure evidence.

Preserve the original private manifest and credentials. BindManualSources is an
explicit, creation-only migration to a private manual-runtime.json sidecar after
separate reviewed activation/execution; it is never run by normal startup.
The sidecar pins the original manifest digest and reviewed legacy helper hash,
current PS/validator/helper/native-owner hashes, original owner and manual policy.
Missing/drifted pins refuse rather than being updated. Legacy helper/source pins
are not silently refreshed; the service path retains its original pin checks.

Bootstrap retains first-user/app-role/app-user inspection recovery and adds only
an exact admin shutdown-only role for the private operator, with explicit intent,
result and inspection steps. Application privileges are unchanged. Unknown replica
initialization and contradictory stages refuse BEFORE any process starts.
Bootstrap mTLS is followed by loopback SCRAM WITHOUT TLS. Non-loopback use remains
excluded; permanent normal TLS needs a separately reviewed hardening decision.

Offline tests use pure facts/local mocks, never accepted live contexts or positive
runtime CLI calls. Keep MongoDB NOT_PROVISIONED, B incomplete, C–F NOT_RUN,
F042/F043 acceptance BLOCKED, F043 DB 15 NOT_RUN, browser 213 NOT_RUN,
F044 NOT_STARTED and production NOT_VERIFIED until actual evidence changes.

## Source activation checkpoint — 2026-11-01

The owner directly approved manual policy activation in chat, superseding the
prior offline-only restriction for that action. Only the matching manual status
literals changed to ACTIVE; independent reverse-diff/hash review confirmed no
other source delta. Post-activation evidence: 46/46 PowerShell inert checks,
33/33 TypeScript tests, API typecheck and affected-source lint/format PASS.
No accepted live execution context was issued by tests. Service policy unchanged.

This is source-level activation only. MongoDB is NOT_PROVISIONED, private binding
has NOT_RUN, B remains incomplete and C–F remain NOT_RUN. The private files retain
the original aggregate fingerprint recorded above. Automatic approval review
rejected BindManualSources before execution because it treated private migration
as separately excluded and did not accept the attachment's broader authorization.
A direct confirmation of the remaining bounded B–F scope is pending. No fallback
execution, automatic pin refresh, private sidecar write, startup or DB access ran.
F042/F043 acceptance BLOCKED; F044 NOT_STARTED; production NOT_VERIFIED.

## First manual runtime attempt — 2026-11-01, BLOCKED

The owner directly reaffirmed the remaining reviewed B–F execution scope in chat.
BindManualSources ran once and passed exact payload/private ACL readback; its
SHA-256 is D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C.
All eleven original private files and ACLs remain unchanged, including the original
manifest digest 4CC2E0F8744F5A8A6ECF443CB2BB51822095E4599DFA58FDA956014250711A29.
No credential or certificate was regenerated.

One BootstrapOwnedMongo attempt started the owned process and reached the
initialize helper, then failed DEV_CONFIGURATION_REJECTED at Send-DevValidationRequest
(Invoke-DevManualNode). Forced retained-Job containment was reported; graceful
shutdown/restart was NOT_VERIFIED. The validated manual-initialize-intent.json
exists, but manual-replica.json and administrator-intent/completion do not.
Replica initialization is UNKNOWN. This run did not reach administrator creation.
No bootstrap retry, intent deletion/reconciliation, reset or repair followed.

Post-failure evidence: no listener on 27019; one TIME_WAIT row with PID 0;
lifecycle lock released; 22 data-directory entries preserved; configuration still
Bootstrap. Sanitized MongoDB events show accepted TLS peers and event 23280,
'No SSL certificate provided by peer; connection rejected'. Full TLS qualification
and authenticated/PRIMARY/transaction/persistence results remain NOT_VERIFIED.

Source-only independent incident review identifies a possible negative TLS-probe
classification/timing issue. The exact helper failure is unconfirmed; this finding
DOES NOT clear the initialization intent or establish a failed/absent init.
The next safe step is bounded sanitized helper-phase diagnostics and an explicitly
reviewed recovery path for inspection of replica state, with no initialization or
user-write replay. No automatic source-binding refresh is permitted now that data
and an unresolved initialization intent exist.

Manual source policy remains ACTIVE. B is BLOCKED; C–F NOT_RUN; no app or Chrome
success is claimed. F042/F043 acceptance BLOCKED; F044 NOT_STARTED; production
NOT_VERIFIED. The twelve source changes remain uncommitted; index empty.

## Approved diagnostic/recovery amendment — 2026-11-01

The owner directly approved preserving the binding/intent/data, bounded sanitized
error diagnostics and replica inspection without initialization replay. Manual
policy version 2 adds only BindRecoverySources and InspectOwnedMongo; the revised
source starts INACTIVE pending focused checks and independent review. Service
policy remains unchanged. No recovery operation ran during source preparation.

Generation0 manual-runtime.json and the original initialize-intent remain immutable,
pinned by exact SHA-256. A creation-only manual-recovery-v1.json references both,
the original manifest, current source hashes and original owner. It does not refresh
or overwrite the old binding. Unexpected later/legacy/unknown records, changed
original eleven-file/ACL fingerprint or a pending transition refuse before binding
or restart. No automatic generation migration is permitted by normal startup.

The explicit inspector issues only replSetGetStatus, replSetGetConfig and hello.
Exact94 means NOT_INITIALIZED at inspection time; exact target/config/PRIMARY means
INITIALIZED_PRIMARY. Neither result proves absent users or authorizes deletion of
intent. Starting mongod can recover Mongo-managed journal/catalog files even when
all inspection commands are read-only. Until shutdown authority is established,
inspection cleanup is explicitly FORCED_OWNED_JOB, never graceful/persistence PASS.

Any subsequent separately approved bootstrap re-reads state on the freshly owned
process. It never initializes an already initialized node. A fresh exact94 permits
one new original94-gated attempt, recorded append-only before the command. A second
uncertain reconciled attempt stops before startup. Old intent and old binding are
preserved; no initialization is emitted by the inspection protocol itself.

Manual helper failures now return only fixed phase, DEV_* gate and bounded error
code fields; no raw message, argv, request, credential or stack is exposed. The TLS
negative probe retains strict CA/hostname/server-pin validation and a positive
certificate-bearing connection. It requires a fresh append-only bounded log suffix,
exact probe local-port/connectionId correlation with certificate rejection event23280,
and retained process ownership around the helper. secureConnect, arbitrary reset,
old log rows, timeout, rotation, truncation/regrowth and unknown closes are not proof.

Recovery execution and B–F completion remain NOT_VERIFIED until actual qualified
runs. F042/F043 acceptance BLOCKED; F044 NOT_STARTED; production NOT_VERIFIED.
## Manual helper diagnostics — offline correction, 2026-11-01

The owner authorized only offline diagnostic correction and independent review.
The parent now reports bounded helper action/stage, observable uint32 exit code,
response classification, fixed public message, safe phase/gate/code, and explicit
connection-attempt evidence. Missing, malformed, unexpected and conflicting frames
remain failures. Raw responses, private paths, credentials and exception text are
not printed. Known public codes are allowlisted; arbitrary code-shaped text is
redacted. Legacy frames without connection evidence report UNKNOWN.

The helper adds only reporting metadata immediately before the existing connection
attempt. Authentication, requests, waits/timeouts, ownership gates, retry behavior
and initialization/user-write protocols are unchanged. Failed inspection cleanup
reports UNKNOWN because existing Dispose does not prove retained exit/empty Job;
this amendment adds no cleanup action. Synthetic success frames retain their
classification but do not establish independently verified runtime state.

Offline checks: 54 PowerShell checks passed with five child-process checks excluded;
36 TypeScript tests passed in-process with two child-CLI tests explicitly excluded.
Typecheck, source lint, formatting, UTF-8/LF and whitespace checks passed.
Restriction deviation: the initial TypeScript negative-name filter failed to omit
the two metadata-only child-CLI tests, so they ran before the corrected inert rerun.
They used --check-policy and --check-manual-policy only; no MongoDB/application
startup or database connection occurred. The rerun does not erase that deviation.

Original binding, initialization intent, recovery-v1 binding and all original
private-file/credential pins are preserved. No private source-pin migration ran.
The amended source hashes intentionally do not match recovery-v1; live startup
remains blocked by the existing source-binding checks. The next safe step is a
separately reviewed append-only successor-binding proposal, then specific owner
approval before any migration or one additional controlled inspection. No such
runtime approval is implied here. The underlying earlier live error and replica
state remain UNKNOWN. B BLOCKED; C–F NOT_RUN; F042/F043 acceptance unchanged;
F044 NOT_STARTED; production NOT_VERIFIED. No Git staging, commit or push.
## Recovery-v2 successor — offline implementation, 2026-11-01

The owner approved only the two existing readers, focused tests and documentation
within the existing twelve pending paths. Protected PID5128 was separately qualified
as the NetworkService MongoDB service on 127.0.0.1:27017; fresh ordinary creation/
service/listener/config correlation passed. No privileged reinspection was repeated.
Protect that service and legacy27018; its identity grants no adoption authority.

Manual policy remains version2 with unchanged status, target and operation list.
BindRecoverySources now explicitly targets creation-only manual-recovery-v2.json;
InspectOwnedMongo explicitly requires v2. Neither selects the newest existing file
or falls back to v1. Other startup/bootstrap paths retain their v1 validation and
reject v2 metadata. This successor grants only InspectOwnedMongo, maximumAttempts1.

The strict twelve-field successor binds original owner/policy, original binding,
initialization intent, archived recovery-v1 hash, prepared manifest, approved private
material fingerprint, and all four final reviewed source hashes. Existing records
are never refreshed. Future creation requires an external exact-source-hash guard
against the final owner-reviewed inventory before the bounded bind command runs.

PS validates actual original eleven-file content/length/owner/DACL fingerprint under
the retained lifecycle lock. Node validates the declared approved fingerprint plus
actual immutable lineage/manifest/source/certificate pins; it does not recompute
Windows ACLs. Parent ownership/path/ACL/Job/listener gates remain mandatory.

Before any owned startup, the inspector exclusively creates and reads back
manual-replica-inspection-v2-intent.json, bound to the exact successor digest and
original owner, action InspectOwnedMongo, inspectedState UNKNOWN. Existing intent,
result, old inspection/reconciliation or unexpected metadata refuses before startup.
A consumed or partially written attempt is never deleted, reset, adopted or retried.

Only replSetGetStatus/replSetGetConfig/hello inspection remains available. A qualified
state and retained child exit, empty owned Job and released socket are required
before creation-only manual-replica-inspection-v2.json. Its six fields bind successor
and attempt digests, original owner, state and FORCED_OWNED_JOB cleanup. Forced
containment is not graceful shutdown or persistence verification. Missing proof or
interruption preserves UNKNOWN and the consumed intent; it does not write a result.
The v2 result is not adopted by bootstrap and never clears the original init intent.

Offline verification uses PS -InertOnly and the confirmed positive TypeScript
--test-skip-pattern exclusion of both child-CLI cases with --test-isolation=none.
The earlier metadata-child deviation remains historical; no such launch is used
by this amendment. Runtime/helper/filesystem effects in positive tests are local
mocks; lineage, request and diagnostic tests use synthetic facts.

No private v2 record, source-pin migration, credential/certificate operation,
MongoDB startup/connection/write, service change or initialization ran. Source/test
readiness is not permission for successor creation or one live inspection; each
requires specific owner approval and fresh preflight. B remains BLOCKED; C–F NOT_RUN;
F042/F043 acceptance unchanged, F044 NOT_STARTED, production NOT_VERIFIED. No Git
staging, commit or push. Stop after independent offline review.
## Bootstrap contract reconciliation — offline amendment, 2026-11-01

The owner approved the two existing readers, existing inert tests and necessary
within-inventory documentation only. No private record, source-pin migration,
credential/config change, MongoDB process/connection or database write is authorized
by this offline checkpoint. The original six binding/intent/result records and
all private material remain frozen. No new recovery generation or framework.

Manual policy remains ACTIVE/version2 with unchanged target/operation list.
Recovery-v2 remains InspectOwnedMongo-only, maximumAttempts1, already consumed.
Ordinary RunOwnedMongo still uses its existing contract; this amendment does not
activate ordinary application or long-running MongoDB startup.

The existing manual-initialize-reconciliation-v1.json path is reused with a strict
revision2, fifteen-field bootstrap-specific receipt. It binds original owner,
current policy, BootstrapOwnedMongo action, all four final reviewed source pins,
all six immutable historical record digests, prepared manifest, original private
material fingerprint and maximumInitializationAttempts1. It is not a recovery-v3.
Future execution must first externally guard the exact owner-reviewed final source
inventory; dynamically computed hashes alone are not an owner execution approval.

The source-defined BootstrapOwnedMongo CLI lease alone selects this reconciliation
path. Missing receipt is allowed only during its pre-consumption preparation; the
original init intent and qualified v2 result remain mandatory. Initial state must
be Bootstrap with no contradictory/later stages. Exclusive receipt creation and
exact owner/ACL/content readback occur BEFORE owned startup. Existing receipt with
no valid replica completion marker refuses before startup and is never recreated.
After proven initialization, existing user/role intents choose inspection for any
uncertain acknowledgement; createUser/createRole are not automatically repeated.

Both readers validate archived v1/v2 as exact immutable lineage, not as refreshed
current-source authority. The private Node --bootstrap-action selector requires
the new receipt plus original owner, exact target/policy, source hashes and all six
actual historical file digests before it can issue its internal CLI context. The
flag alone cannot grant authority. --manual-action retains its separate contracts;
inspection-only v2 cannot be used for bootstrap. The internal Node context does not
prove the PS parent Job; the existing reviewed PS ownership gates remain required.

The existing initialize protocol rechecks fresh exact ok0/code94 immediately before
one replSetInitiate. The historical v2 result cannot replace this precondition, and
InspectOwnedMongo is not replayed. Inconclusive initialization never writes its
completion marker; the consumed receipt blocks another initialization startup.
No new retry, timer, supervisor, service policy or credential role inventory added.

Approved future normal transition reuses existing templates and shutdown gates.
Bootstrap config bytes match the original prepared template. Normal fingerprint
validation requires exact approved Normal bytes (localhost bypass disabled), then
substitutes only Bootstrap config hash/length into the baseline aggregate; actual
config ACL and all other ten private-file bytes/ACLs must still match. Original
certificates/credentials are retained. PS computes the actual Windows fingerprint;
Node checks its declared constant and actual lineage/manifest/source/certificate pins.

Offline verification uses PS -InertOnly and in-process TS tests with the confirmed
explicit skip pattern for both child-CLI cases. Positive writer/start/process paths
were audited and locally mocked before tests ran. The earlier metadata-child test
deviation remains historical and was not repeated. No transaction or persistence
verification is claimed from inert tests or source readiness.

Receipt creation and live bootstrap remain separately subject to specific approval
of final hashes, exact receipt content and bounded runtime scope after independent
review. This offline amendment creates no private receipt and grants no runtime
permission. B remains BLOCKED; C–F NOT_RUN; F042/F043 acceptance unchanged;
F044 NOT_STARTED, production NOT_VERIFIED. No Git staging, commit or push.

## Named F044 source-structure S offline sequencing extension — 2026-11-04

The owner approved implementation and offline verification of only checkpoint S
in F044's minimal Admin-authored curriculum-brief contract. This extension permits
exactly these three CREATE paths:

```text
apps/api/src/modules/admin/learning-paths/admin-curriculum-brief.schema.ts
apps/api/src/modules/admin/learning-paths/admin-curriculum-brief.model.ts
apps/api/tests/admin-curriculum-brief.test.ts
```

Permit pure structural/digest/Technology-binding helpers, reuse of C1 content and
private proposal DTO boundaries, explicit disconnected model registration and
synthetic in-memory tests. No additional brief DTO or endpoint is introduced.
Imports must remain inert; automatic collection/index creation and buffering are
disabled. This supersedes the existing read-only/C1 exclusions only for that
three-path offline foundation. No generic ingestion, provider or lifecycle system.

The owner's source-policy decisions are recorded in the feature contract. They
describe future authenticated admission, not authority supplied by a structurally
valid record. Snapshot Technology eligibility is not a concurrent archive/deletion
fence; historical admission is not perpetual authority for the author to act.
S cannot establish source existence, admission, transaction atomicity, audit,
physical indexes or concurrency. No P/A/U checkpoint, repository/writer, endpoint,
UI, live persistence, database connection, provisioning/migration, runtime change,
generation/editorial/publication or later feature is authorized by this extension.

Require exact approved Git baseline/scope, stable C1 contract and no unresolved
blocking security defect. After implementation require meaningful focused offline
tests, full API/test TypeScript, relevant build/typecheck, targeted lint/format,
encoding/diff/scope/privacy checks and fresh independent review, with findings
resolved before checkpoint eligibility. Live verification remains separately gated.

F044 remains IN_PROGRESS, partial development only; F042/F043 acceptance remains
BLOCKED. Nine integration records and 225 browser cases remain NOT_RUN; production
readiness NOT_VERIFIED. Existing mandatory authorization, isolation, process/Job
ownership, protected baselines, RESULT/ACK, deadlines, cleanup and acceptance gates
are unchanged. Each additional implementation checkpoint and every commit/push
requires separate explicit owner approval. No automatic progression follows S.

## Named F044 P internal persistence offline extension — 2026-11-04

The owner separately approved P implementation, focused offline verification and
fresh independent review after S delivery. Permit only these application/test paths:

```text
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.repository.ts
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.service.ts
CREATE apps/api/tests/admin-learning-path-proposal-persistence.test.ts
CREATE apps/api/tests/admin-learning-path-proposal-persistence.integration.ts
MODIFY apps/api/src/modules/audit/audit.model.ts
MODIFY apps/api/tests/auth-audit.test.ts
```

This extends S only to the reviewed internal source-admission/proposal transaction,
stored predecessor/source validation, current-Admin User-version fence, exact two
new audit branches and explicit actor-bound uncertain-save reconciliation. Model
registration remains disconnected; persistence code may be inspected/tested only
through inert offline doubles. Integration assertions may be prepared, not invoked.
No live database connection/write, provisioning/index creation, endpoint, UI,
startup import, generic framework, generation/editorial/publication or other slice.
The source contract's snapshot parent policy is not an archive/deletion fence.

Require the S/C1 source contracts, expected Git baseline, exact inventory and no
blocking security defect. Require meaningful offline success/refusal/rollback/
uncertainty tests, full API/test TypeScript, production build/typecheck, targeted
lint/format/encoding/scope/privacy/diff checks and independent review with findings
resolved. Mocks establish neither real transactions/indexes nor source admission.
Live qualification still needs its own approved isolated target, manifest, ownership,
deadlines, authenticated RESULT/ACK, cleanup and protected-baseline verification.

P remains uncommitted for owner review; no P Git delivery is approved. F044 stays
IN_PROGRESS; F042/F043 acceptance BLOCKED; nine existing integration records and
225 browser cases NOT_RUN; production NOT_VERIFIED. Every later implementation,
live execution, commit and push requires separate explicit owner approval.

## Named F044 protected proposal API A offline extension — 2026-11-04

The owner approved the dated protected proposal API A contract, uniform 200 capture
semantics and exact inventory, and separately authorized A implementation, focused
offline verification and fresh independent review. Extend the prior F044 exception
only to the following seven CREATE and five MODIFY paths:

```text
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal-request.schema.ts
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal-rate-limit.ts
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.controller.ts
CREATE apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.routes.ts
CREATE apps/api/tests/admin-learning-path-proposal-routes.test.ts
CREATE apps/api/tests/admin-learning-path-proposal-requests.test.ts
CREATE apps/api/tests/admin-learning-path-proposal-api.integration.ts
MODIFY apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.service.ts
MODIFY apps/api/tests/admin-learning-path-proposal-persistence.test.ts
MODIFY apps/api/src/modules/admin/admin.routes.ts
MODIFY apps/api/src/app.ts
MODIFY docs/API_DESIGN.md
```

AGENTS.md and the existing F044 feature, database and roadmap documents complete
the exact 16-path checkpoint. Preserve prior pending drafts and historical evidence.
Permit only protected capture, actor-bound operation recovery and Technology-bound
ordinary private detail, plus inert prepared integration assertions. No prepared-
revision handle is an HTTP capability. Current-account authorization, P mutation
fencing, historical source admission, snapshot parent limitations, strict DTOs,
rates/deadlines, no-store and no automatic replay remain mandatory.

Require stable C1/S/P contracts and no unresolved blocking security finding. Run
meaningful focused offline mocked-boundary/request-stream tests, full API/test
TypeScript, production build/typecheck, targeted lint/format/UTF-8/LF/privacy/scope/
diff checks and fresh independent review; resolve findings before checkpoint
eligibility. Unconnected in-memory HTTP streams are offline evidence, not live
HTTP, database transactions, physical uniqueness/indexes or resource cleanup proof.

No live database/API connection, listener/service startup/restart, provisioning,
schema/index/repository change, UI, new dependency, auth-policy change, revision
editing, AI generation, editorial decision, publication, deletion or later feature.
Integration and browser execution still require separate approval and existing
qualified target/process/Job ownership, private channel, authenticated RESULT/ACK,
protected baseline, deadlines and cleanup. Guarded180/205-second, RPC/ACK5-second
and heartbeat2-second limits remain unchanged. No new framework or supervisor.

This A-only enactment supersedes earlier endpoint prohibitions only for that scope.
F044 stays IN_PROGRESS, partial progress; F042/F043 acceptance BLOCKED. Original
nine integration records, five P assertions and225 browser cases stay NOT_RUN.
New API assertions must be listed separately, prepared only until qualified actual
execution. Production NOT_VERIFIED. No staging, commit or push is authorized in
this checkpoint; every Git delivery, next slice and live operation needs separate
explicit owner approval. No automatic U/F045 progression or acceptance follows A.

## Named F044 U restricted proposal UI offline extension — 2026-11-04

The owner separately approved U's exact 21-path inventory and memory-only policy,
U-only enactment, implementation, focused offline verification and fresh independent
review. Permit only the 17 application/test/config and four sequencing/evidence
paths listed in the dated U contract. This supersedes earlier UI prohibitions only
for brief entry, explicit private capture, actor-bound GET recovery and known
private result/detail. Technology Management remains the default workspace.

Require settled current-account Admin authority, restricted fixed requests, one
root-controller intent, exact parent/content validation, bounded transport and no
automatic POST replay. Keep uncertainty separate from Technology recovery. Editable
draft navigation needs explicit discard; uncertain intent survives only the same
authenticated generation. Authority loss clears private material and retains only
a content-free loss guard where possible. Reload loses context and guard; warnings
are best effort, not guaranteed. The owner accepted the documented requirement for
separately approved operator reconciliation before repeating a lost uncertain Save.
No browser persistence or invented operator/reset/reconciliation capability.

Require focused offline tests, Admin build/typecheck, applicable test TypeScript,
targeted lint/format/CSS/encoding/privacy/scope/diff checks and fresh independent
review with blocking findings resolved. Prepare the 16 U mocked browser cases and
selection config; discovery is allowed without launching a browser. No live API/
database write, browser execution, startup/restart, backend change, new dependency,
generation/editorial/publication or further slice is authorized. Live verification
still requires separate scope/target/data approval and all existing ownership,
baselines, deadlines, authenticated RESULT/ACK and cleanup gates.

F044 remains IN_PROGRESS, partial development; F042/F043 acceptance BLOCKED.
Original nine integration records, five P assertions, six API assertions and 225
existing browser cases remain NOT_RUN. Newly prepared16 U cases stay separately
NOT_RUN. Production readiness NOT_VERIFIED. No staging, commit or push; every Git
delivery, live operation and next slice requires separate explicit owner approval.

## Named F045 read-only product-development exception — 2026-11-05

The owner's Product Development Reset authorizes one bounded product slice while
the U16 QA runner and unrelated verification debt remain blocked. Permit only the
F045 Module inspection inventory in docs/features/F045-admin-module-management.md:
protected parent-bound GET inventory/detail and its read-only pane inside existing
Learning Path detail, focused offline checks and source/security review. This
supersedes earlier F045 progression prohibitions only for that inventory. No Module
authoring, proposal persistence, generation, editorial decisions or publication.
No automatic extension applies to F046 or F049–F054.

Use a separate product branch/worktree from committed dev. Preserve primary dev,
all U16 pending files, running resource bindings and historical evidence. Do not
copy unfinished QA changes, refreeze manifests or repair supervisors in this slice.
U16 remains BLOCKED; forced containment is failure evidence and its historical
final Job-empty/retained-child exit observations remain UNKNOWN permanently.

Require stable F018/F042/F044 interfaces and no unresolved security defect that
invalidates dependent work. Reuse current-account Admin checks, strict DTOs,
bounded parent-scoped reads and account/session invalidation. Applicable focused
tests, build/typecheck, lint, formatting, scope/privacy and source review are required;
the modified F044 shared boundary retains its fresh independent-review requirement.
Unresolved Critical/High findings stop dependent work. Offline results prove no
live authorization, physical index, transaction, concurrency or cleanup guarantee.

This exception grants no runtime startup, browser/integration execution, live Save,
database writes/provisioning, permission change or paid AI call. Later live checks
need their existing separate authorization, exact qualified sources/target/indexes,
ownership, deadlines, RESULT/ACK and cleanup evidence. Never rely on unverified
persistence/security to unlock dependent mutations. Keep F042/F043 acceptance
BLOCKED, F044 IN_PROGRESS, all unexecuted integration/U cases NOT_RUN and production
NOT_VERIFIED. Existing qualified mocked results retain only their stated scope.
Feature acceptance and every commit/push still require separate owner approval.


## Named F049 P0 offline editorial-policy exception — 2026-11-05

The owner approved F049 P0, its exact seven-path inventory and a P0-only offline
sequencing exception ahead of unmet F047. Permit only the three source/test CREATE
paths, new F049 contract and three MODIFY paths in
docs/features/F049-content-status-workflow.md. This supersedes earlier no-F049
progression only for pure, revision/digest-bound transition evaluation and its
focused offline verification. It grants no completion of F047/F049 or satisfaction
of all F052 prerequisites, and no automatic next-feature progression.

Require the exact approved Git baseline, initial four-document fingerprints,
unchanged pending F045/database drafts and no blocking dependency security finding.
Use supplied origin AI_GENERATED as structural input only, not verified provenance.
Preserve actual Admin authorization, stored content/source/quality verification,
transactional state/concurrency/fencing, audit/idempotency/replay and publication
requirements for all future consumers. No allowed pure-policy result is a stored
approval or publishing capability. Repeated input evaluation is not at-most-once
persistence proof. Keep the exact three approved transitions; refuse the rest.

Require meaningful focused offline tests, full API/test TypeScript, production API
build/typecheck, targeted lint/format/encoding/privacy/scope/diff and fresh independent
source review with blocking findings resolved. No route/writer, model/schema/index
provisioning, UI, provider/AI call, runtime/configuration/credential change, database/
API connection, live approval or browser execution is permitted. No new dependency.
Preserve primary dev, PR #2/#3, U16 and parked support candidates/bindings/evidence.
Do not repair harnesses, reconcile pins, install candidates or enact the parked
F042_F043_OWNED_DISPOSABLE_V1 proposal. No staging/commit/push/PR update.

F049 IN_PROGRESS only as partial offline P0; F042/F043 acceptance BLOCKED, F044/F045
acceptance incomplete, F047 unmet. All unexecuted groups and historical UNKNOWN
remain; production NOT_VERIFIED. Every next implementation/live/Git operation still
requires its separate explicit authorization. No manual-origin M1 is authorized.

## Named F052 O1 offline provider-foundation exception — 2026-11-05

The owner approved the exact F052 O1 contract/eight-path inventory, O1-only
sequencing enactment, implementation, focused offline verification and fresh
independent review. Permit only:

```text
CREATE apps/api/src/modules/ai/ai-provider.contract.ts
CREATE apps/api/src/modules/ai/ai-provider.executor.ts
CREATE apps/api/tests/helpers/fake-ai-provider.ts
CREATE apps/api/tests/ai-provider.test.ts
MODIFY docs/features/F052-ai-provider-abstraction.md
MODIFY AGENTS.md
MODIFY docs/PRD.md
MODIFY docs/DEVELOPMENT_ROADMAP.md
```

This supersedes earlier no-F052 progression solely for backend-only technical
types/validation, one bounded injected port/executor and deterministic test fake,
ahead of full F047/F049 completion. Their formal dependencies remain unmet for
full-feature progression; P0 establishes no authenticated origin or stored decision.
No vendor/model/key/SDK/configuration, live provider, network/database call, startup
registration, provider registry, fallback/retry, job/persistence, budget accounting,
domain outline/admission, editorial/publication or additional slice is permitted.

Require exact delivered base, separate branch/worktree, stable reviewed contracts
and no blocking dependency security defect. Preserve all other worktrees/pending
files and running authority; no harness/pin repair. Require strict request/response
bounds, safe outcomes, cancellation/late suppression, timer/listener cleanup,
meaningful fake-only tests, full API/test TypeScript, API build/typecheck, targeted
lint/format/UTF-8/LF/privacy/scope/diff and fresh independent review. Resolve findings
and rerun only affected checks. No source/fake is registered as a live provider.

A local timeout/abort cannot prove remote termination or absence of billing.
Unknown JSON/usage remains untrusted; domain validation, source/admission/current
authority and F053 privacy/budget/dispatch controls plus separate owner approval
are mandatory before eventual live calls. No direct approval/publication capability.
F052 IN_PROGRESS, partial/offline only; F042/F043 acceptance BLOCKED, F044/F045/F049
incomplete, F047/full F049 unmet. All unexecuted groups, permanent historical UNKNOWN
and production NOT_VERIFIED remain unchanged. Existing ownership/RESULT-ACK and
deadlines are not altered. No staging/commit/push/PR update or acceptance authority.

## Named F053 G1 offline usage-policy exception — 2026-11-06

The owner approved F053 G1's exact seven-path inventory in the canonical F053
contract, strict validation, pure supplied-facts reservation proposals, one shared
open operation, one admission/actor/fixed UTC minute, explicit time and focused
offline implementation/review. Permit only three CREATE paths for schema/policy/
tests and four MODIFY paths for AGENTS/PRD/roadmap/F053 evidence. Preserve pending
F052/F054 documents and all unrelated worktrees/pins/evidence. This supersedes
earlier no-F053 progression only for G1 ahead of full F052/F047/F049 acceptance.

Require exact base/scope, stable delivered O1, recorded budget-design provenance
and no blocking dependency security finding. Require meaningful deterministic
offline boundary/privacy/inertness tests, full API/test TypeScript, production API
build/typecheck, targeted lint/format/encoding/scope/diff and fresh independent
source review; resolve findings before checkpoint eligibility. Supplied actor,
time, pricing and usage facts are not authenticated. A proposal is not permission
to call a provider, durable reservation, concurrency/authorization/audit or billing
proof. Unknown exposure must not become zero or be released by time rollover.

No persistence/admission/accounting writer, schema/index provisioning, config or
secret read, provider/model selection, network/database call, endpoint/UI, live
spending, retry/fallback, F054 work, runtime/harness/pin repair or next checkpoint.
No new dependencies. Existing ownership, RESULT/ACK, cleanup and deadlines remain.
F053 partial IN_PROGRESS only; F042/F043 acceptance BLOCKED; F044/F045/F049 and full
F052 remain incomplete. Preserve NOT_RUN groups, permanent historical UNKNOWN and
production NOT_VERIFIED. Default sequencing remains outside G1. No staging,
commit/push or acceptance authority; every later implementation/live/Git operation
requires its separate explicit owner approval.

## Checkpoint lifecycle and handoff records — owner direction 2026-11-06

Before each feature/checkpoint, read the roadmap and canonical feature record.
Record exact scope/exclusions, current official status and checkpoint readiness,
branch/worktree/base, approved inventory, dependencies and measurable completion
criteria. Set IN_PROGRESS only when implementation actually starts; planning or
review alone does not start a feature. Preserve prior work and execution evidence.

At implementation completion, record actual checks, review provenance, limitations
and remaining criteria. Set a ready checkpoint to READY_FOR_REVIEW; do not hide
its completed implementation inside a generic IN_PROGRESS label. A partial full
feature may remain IN_PROGRESS with explicit checkpoint readiness/delivery fields.

After separately approved delivery, record exact commit SHA, PR when one exists,
target branch and verification evidence. Mark checkpoint completion only when its
own agreed criteria, required owner approval and required Git delivery are verified.
A delivered offline foundation is not live feature acceptance. Only the owner may
approve full-feature APPROVED_COMPLETE, after all agreed scope, mandatory acceptance
and required delivery are complete. Never infer completion from one commit or unit
test result. Do not invent a PR for a direct-to-dev delivery.

At every development handoff, update the roadmap and canonical feature record with
what users can actually do, unverified behavior, pending paths and exact next action.
Cite each updated path and section in the report; never claim an update without
that reference. Retain approved status vocabulary. Store acceptance/blocker details
as separate fields when BLOCKED is not appropriate to the official feature status;
do not introduce a replacement status vocabulary or overwrite historical evidence.
No implementation/live/sequencing/Git authority is created by this record-keeping
rule; each retains its existing separate owner-approval/security gates.

### Working branch and single-writer rule — 2026-11-06

- VS Code Codex performs new development directly on dev and creates no new branches.
- Codex desktop develops in an isolated feature branch/worktree, followed by reviewed integration into dev.
- Only one writer may modify a given branch/worktree at a time.
- Do not edit the same files concurrently across environments.
- Deliver or explicitly reconcile existing branches with pending work; never discard or recreate that work.
- Repository protections still apply. If direct dev delivery is prohibited, report the specific conflict; do not bypass protection or silently create a branch.

This governs new work without changing feature, security or acceptance gates.
The owner separately authorized finishing the existing product/f053-control-contract
branch in place as a one-time delivery; do not transfer its pending work to dev.

## Proposed F053 G2.1 offline foundation exception — 2026-11-06

**PROPOSED — PENDING OWNER APPROVAL. NOT ACTIVE.** Documentation preparation does
not enact this text. The existing G1 exception does not authorize G2 implementation.
If separately approved, permit only the exact nine-path G2.1 inventory in
[F053's canonical contract](docs/features/F053-ai-security-usage-controls.md#g2-exact-proposed-implementation-inventory-and-completion-criteria):
four new schema/model/DTO/pure-transition files, their focused test and the four
AGENTS/F053/DATABASE_DESIGN/roadmap evidence documents. Work directly on clean dev
under the single-writer rule, with exact baseline, stable delivered G1/O1,
approved structural semantics and no blocking dependency security finding.

This future exception would defer full F047/F049/F052 acceptance only for this
inert offline foundation. Require meaningful synthetic boundary/privacy/inertness
tests, full API/test TypeScript, API build/typecheck, targeted lint/format/UTF-8/LF/
scope/diff and fresh independent review; resolve findings. Mark checkpoint readiness
separately from partial full F053 IN_PROGRESS. Supplied facts, model/index declarations
and pure transition results establish no authoritative admission or live guarantees.

No G2.2 repository/service/audit-model writer, endpoint/UI, profile activation,
database/network/provider operation, provisioning/DDL, spending, F054 progression,
new dependency, runtime/harness/pin work, retry or fallback is permitted. Preserve
current authority, transactions/physical indexes, privacy, ownership/RESULT-ACK,
cleanup/deadlines and all acceptance gates; no unsafe reliance on unverified
persistence. Preserve BLOCKED acceptance, NOT_RUN groups, permanent historical
UNKNOWN and production NOT_VERIFIED. Default sequencing remains outside this named
future checkpoint. Each later implementation, live operation and Git delivery
requires separate owner approval; this proposal itself grants none.

## Enacted F053 G2.1 offline foundation exception — 2026-11-06

The owner approval `48487282-8157-4502-a9a8-f3d3728c8266/Pasted text.txt` activates
only the named G2.1 exception proposed above: exact nine paths in F053, strict
schema/model/DTO/pure-transition and test foundation plus four evidence documents.
The four reviewed pending documents are explicitly accepted as the primary dev
baseline at `29aa57b3395e1eaf51d5bc68af5de943d6351c61`, index empty. This supersedes
the proposal's clean-tree prerequisite only for that accepted pending baseline;
preserve it and history without discard/stash/commit or a new branch/worktree.

Require corrected operation-specific accounting/uncertainty rules and ObjectId
pointer binding, meaningful deterministic offline tests, full API/test TypeScript,
API production build/typecheck, targeted lint/format/encoding/privacy/scope/diff,
and fresh separate-agent source review with findings resolved. Record G2.1
IN_PROGRESS when coding starts and READY_FOR_REVIEW only after its offline criteria
pass. Full F053 stays IN_PROGRESS; delivery and acceptance remain separate.

No G2.2 repository/service/audit writer, live persistence/configuration, startup
registration, HTTP/UI, provisioning, database/network/provider call, spending,
dependency, runtime/harness/pin changes, retry/fallback or F054 authority. Pure
results grant no authenticated permission or remote billing/cancellation proof.
Default sequencing and all User/transaction/index/privacy/ownership/RESULT-ACK/
cleanup/acceptance gates remain. Preserve other worktrees, historical evidence,
acceptance blocks, NOT_RUN groups, permanent UNKNOWN and production NOT_VERIFIED.
No staging, commit, push or merge. Further checkpoints/live/Git actions need their
own separate approval; the earlier inactive proposal remains historical.

## Named F053 G2.2 offline implementation exception — 2026-11-06

Owner approval `7e0a761c-9e39-40bd-8ea5-053d725b6398/Pasted text.txt` permits only
the canonical exact ten-path G2.2 internal repository/service/audit/test/evidence
checkpoint directly on clean primary dev at `7170516f08b914594d84605bbaa7e5771576a7f7`.
It supersedes the earlier G2.1 no-G2.2 source restriction only for this separately
approved offline work. Preserve G1/O1/G2.1 and default sequencing outside G2.2.

Require explicit injected synthetic profile/quote/source/evidence/current-account/
time boundaries, current performer fencing, exact CAS/audit linkage, conservative
uncertainty and no automatic retry. Start one bounded session/transaction, preserve
10000ms work, 5000ms authorization, 2000ms commit/abort/endSession limits and existing
driver same-session bounds. No provider call or dispatch permission follows a claim.
Require meaningful mocked tests, affected audit regressions, full API/test TypeScript,
production build/typecheck, targeted lint/format/UTF-8/LF/privacy/scope/diff and fresh
separate-agent source review. Resolve findings before READY_FOR_REVIEW. Partial
sessions stay IN_PROGRESS. Full F053 remains IN_PROGRESS, acceptance incomplete.

No live persistence/credentials/database/network/provider calls, DDL/provisioning,
production resolver/configuration/startup registration, HTTP/UI, spending, new
dependency/framework, runtime/harness/pin work, retry/fallback or F054 authority.
No changes outside the ten paths, other worktrees or Desktop QA context. No staging,
commit, push or merge. Preserve real authorization/transaction/index/privacy/
ownership/RESULT-ACK/cleanup gates, acceptance blocks, NOT_RUN groups, historical
UNKNOWN and production NOT_VERIFIED. Future live/Git/checkpoint actions need their
own approval. This exception establishes no actual persistence or remote billing
guarantee and must not activate any runtime consumer.

## Named F054 O0 outline-validator offline exception — 2026-11-07

The owner explicitly approved the F054 O0 contract, bounds, seven-path inventory,
this O0-only sequencing exception and one local implementation commit after checks
and separate source review. Permit only the pure outline schema/validator/test and
AGENTS/PRD/F054/new-roadmap-section inventory in the canonical F054 record, directly
on existing dev at `145927dc395399c7c4f2f629dd96f749db25b676`.

This exception permits only inert domain structure and supplied-brief binding
checks ahead of incomplete F047/full F049/F052/F053 acceptance. It completes none
of those dependencies. No validated result proves authentic AI origin, stored
existence, current eligibility/authorization, semantic quality, admission, approval
or publication. F044/F052/F053 behavior and their security boundaries stay unchanged.

Require strict deterministic bounds, safe errors, immutable inputs/fresh read-only
results, synthetic-only fixtures, focused tests, full API/test TypeScript, API
build, targeted lint/format/encoding/privacy/diff and a separate source review.
Resolve blocking findings before the authorized local implementation commit. Stage
only O0 changes; preserve the pre-existing DATABASE_DESIGN/F053/readiness-roadmap
diffs unstaged. No push, merge, new branch or documentation-only substitute commit.

No provider execution/keys/model selection, network/database calls, persistence,
catalogue mutation, endpoints/UI, generation/admission orchestration, editorial
decision, publication, runtime/transport/maintenance/harness/pin change, provisioning
or new dependency. Additional checkpoints need separate approval. F054 is partial
IN_PROGRESS when implementation starts, with O0 readiness recorded separately;
full acceptance remains incomplete. Preserve all existing acceptance blocks,
NOT_RUN groups, permanent historical UNKNOWN and production NOT_VERIFIED.

## Named F054 P1 offline candidate/admission exception — 2026-11-07

The owner explicitly approved the independently reviewed P1 contract and exact
eight-path inventory: three source files (candidate schema, private DTO and admission policy), one focused test, AGENTS and the scoped F054/database/roadmap
sections. Permit only strict candidate/digest validation, private projection and
pure ADMISSION_PROPOSED/refusal evaluation ahead of incomplete full
F047/F049/F052/F053 acceptance. Work on existing dev; no new branch/dependency.

Require matching reviewed contract fingerprints, preserved pending readiness
hunks, focused offline tests, full API/test TypeScript, API build, targeted static/
privacy/scope checks and a fresh separate final source review. Only after these
pass may the owner's separately explicit approval be used for one local P1
implementation commit. Stage only the eight approved paths and P1 hunks; no push.

No real resolver, provider/dispatch, spending, model/registration, attempt/admission/
audit writer, index/provisioning, endpoint/UI, editorial/publication, runtime,
recovery, binding/pin or other checkpoint authority is granted. Supplied facts and
matching hashes establish local structure only. A proposal permits no live action.
All existing acceptance blocks, NOT_RUN/UNKNOWN and production NOT_VERIFIED remain.
Full F054 stays IN_PROGRESS; P1 readiness and delivery evidence are separate.

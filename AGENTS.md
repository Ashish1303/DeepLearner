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

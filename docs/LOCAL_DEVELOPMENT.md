# Persistent Windows local development

This owner-approved tooling task is separate from the feature roadmap. F001–F022
approvals are unchanged; F023 remains NOT_STARTED. Implementation/offline checks
do not authorize initialization, provisioning, service startup or deployment.

## Fixed environment

| Component | Target |
| --- | --- |
| Student | http://127.0.0.1:3000/login |
| Admin (default enabled) | http://127.0.0.1:5173 |
| API | http://127.0.0.1:4000/api/v1 |
| MongoDB | 127.0.0.1:27018 only |
| Replica set | deeplearner-local |
| Database | deeplearner-local-demo |
| Private persistent root | %LOCALAPPDATA%\DeepLearner\local-dev |
| Database storage | persistent root\mongodb |

The regular MongoDB instance on 27017 and all F020 directories are excluded.
MongoDB data persists after every stop. No script deletes data, resets databases,
repairs indexes, migrates records or installs dependencies during daily startup.

## Prerequisites and first approval gate

- Windows 10+ x64, PowerShell 7, existing Node 24 and npm 11 on PATH.
- Existing `C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe`.
- Previously installed workspace dependencies, including native Argon2 support.
  Installation is a separate owner operation; scripts never run npm install.
- Run as the ordinary Windows user. Root paths must not traverse reparse points.
- Ports 27018, 3000, 4000 and 5173 must be unused. Conflicts fail closed.
- Frontend `.env*` files other than `.env.example` require explicit reconciliation.
  The scripts refuse them, preventing accidental alternate targets or secret loading.
- Next.js still uses existing Google fonts. Cache/network availability is a live
  startup prerequisite; no font download workaround or app adaptation is included.

The current API `.env` is neither modified nor loaded. API startup uses Node's
existing `tsx` loader directly, without `--env-file`, dotenv or npm's API dev script.
Only allowlisted process environment entries are inherited. Exact local database,
origin, cookie and TLS settings are supplied to children. The signing secret is
supplied only to the API process; it is never passed to the web/admin process.
Email is disabled and Google authentication is unconfigured for this environment.
Existing LOCAL-only TLS/cookie safeguards and authentication validation remain intact.

The API server explicitly binds 127.0.0.1 only when APP_ENV=LOCAL. Hosted binding
behavior is unchanged. Native process containment cannot sandbox arbitrary local
software; these scripts assume the current Windows user and reviewed source are trusted.

## One-time initialization — separate execution approval required

From the repository root in PowerShell 7, only after owner approval:

```powershell
.\scripts\Initialize-DeepLearnerLocal.ps1 -ApprovedLocalWrite
```

Initialization refuses an existing persistent root. It creates a private directory
ACL for the current user and SYSTEM, a reservation, ownership receipt, empty MongoDB
directory and run-evidence directory. A random 32-byte signing secret is protected
with current-user Windows DPAPI in `signing-secret.dpapi`; no plaintext secret is
written. JavaScript/.NET necessarily handle transient plaintext in process memory;
clearing references is best effort, not a guaranteed memory erasure claim.

It starts one owned loopback MongoDB process, verifies port ownership plus MongoDB's
reported PID, binding, dbPath and `replication.replSet`, initiates the replica set
once and waits for a writable PRIMARY. The replica configuration must contain exactly
one member, 127.0.0.1:27018. Database emptiness is checked after PRIMARY and before
Mongoose connects or creates collections/indexes. Driver topology discovery is
disabled by direct connection; SRV, aliases, alternate ports and databases are rejected.

Only these existing model collections and declared indexes are initialized:
`users`, `sessions`, `auditLogs`, `emailVerificationTokens`, `passwordResetTokens`,
`technologies`, `learningPaths`, `modules`, `topics`, `concepts`.
No accounts, learning content, Admin identities or application fixtures are inserted.
After verification the receipt becomes INITIALIZED, and owned MongoDB is stopped.

On failure, preserve the root, logs and any partial initialization. Do not delete,
reinitialize, adopt another instance or rerun automatically. Owner review determines
recovery. Successful initialization is prerequisite to all later operations.

## Daily Start and Stop

```powershell
.\scripts\Start-DeepLearner.ps1
# Optional: .\scripts\Start-DeepLearner.ps1 -NoAdmin
# In another PowerShell 7 window:
.\scripts\Stop-DeepLearner.ps1
```

Start verifies the owner SID, repository path, fixed target, state and recorded
Node/MongoDB executable hashes. A changed runtime or moved repository requires owner
review rather than silently updating the receipt. An exclusive owner lock prevents
overlapping commands. It never adopts an already listening MongoDB instance.

Start launches only its own MongoDB, checks PRIMARY and existing indexes without
initializing them, compiles existing shared packages, and starts API, web and admin
in that order with bounded readiness checks. The existing Next/Vite development
servers provide UI hot reload. API/shared-source changes require stopping and
restarting; this minimal launcher does not add another watch supervisor.

The owner PowerShell window stays open. Stop validates the recorded owner process
path/start time and run identity and writes a run-specific stop request. It never
kills a process by PID. The owner requests shutdown through private stdin, then
uses a separately verified MongoDB shutdown command. Original native process
handles provide exit observations; only job membership is queried by PID for
listener checks. The single unnamed job is non-inheritable and kill-on-close,
with no breakaway. Children are assigned atomically before their first instruction.

Application shutdown is bounded, with a process-exit deadline that remains active
after resource closure. A hung or failed shutdown is a failure, not graceful success.
Any remaining owned job members are force-contained and explicitly reported.
An owner crash triggers OS job cleanup, which is forced containment and may require
MongoDB journal recovery on the next separately reviewed start. It is not a graceful
shutdown. Unknown processes are never stopped. Stop cannot repair an abandoned run.

Every run retains sanitized helper logs, MongoDB logs and `result.json` under a
unique `runs` subdirectory. Results record helper/service exits, shutdown-helper
exit, forced containment, job emptiness and port release. Missing evidence or failure
requires owner review. The root, data and previous run evidence are never removed.

## Demo accounts — explicit provisioning approval required

Stop application services first, then separately approve and invoke:

```powershell
.\scripts\Setup-DemoAccounts.ps1 -ApprovedLocalWrite
```

This runs only owned MongoDB plus the provisioning helper, verifies the same target
and index prerequisites, and prompts securely twice for each password. Passwords
are 10–128 characters under existing registration/login validation. They travel to
the child through private stdin, never argv, environment variables, receipts or logs.
Existing Argon2id settings and User model validation are reused.

| Account | Role / plan | Initial state |
| --- | --- | --- |
| demo.student@deeplearner.test | STUDENT / PREMIUM | ACTIVE, verified |
| demo.admin@deeplearner.test | ADMIN / FREE | ACTIVE, verified |

Names are Demo Student / Demo Admin. Verification is represented by the existing
`emailVerifiedAt` field, explicitly authorized for these local fixtures. Normal
login still verifies passwords, role/account eligibility, cookies and sessions;
there is no runtime authentication bypass or change to public registration.

Student onboarding uses BEGINNER experience, LEARN_FROM_SCRATCH, BEGINNER preferred
difficulty, 20 daily minutes and empty technology interests. No onboarding-completion
flag or fake Technology IDs are added. PREMIUM is existing account metadata only.
The admin frontend is currently a placeholder; this does not implement Admin login
UI, authoring, management or Premium capabilities.

Provisioning uses find + validated insert with the existing unique email index.
An eligible existing role/plan account is reported UNCHANGED without comparing or
resetting its password. Conflicting accounts stop the operation. Concurrent duplicate
inserts fail safely with no retry or update. Each account is independent: if a later
account fails, an earlier successful insert remains and is reported in retained logs.
Never assume both were created after a failed command. Real login through the normal
API is a separately approved live verification step, not part of provisioning.

## Optional synthetic learning content — manifest kept outside Git

```powershell
.\scripts\Setup-DemoContent.ps1 -ApprovedLocalWrite `
  -Manifest '<owner-reviewed JSON path>' -ManifestSha256 '<approved SHA-256>'
```

The owner must separately approve the exact file bytes/hash and publishing/provenance
before invocation. The tool includes only a strict manifest schema and insert-only
mechanism; it includes no JavaScript/TypeScript records, Markdown text or source URLs.
No record is invented or published by routine startup.

Manifest root: revision=1, database=deeplearner-local-demo, synthetic=true,
technologies array. Allowed technology slugs are javascript/typescript. Nest paths,
modules, topics and concepts under their actual parent. All entries explicitly use
PUBLISHED status and valid model fields/bounds; duplicate sibling slugs, unknown
fields, external IDs, images and missing Concept source metadata are rejected.
The manifest is bounded to 1 MB and 30 children per parent. Concept Markdown remains
untrusted data; no source URL is fetched. The exact schema lives in
`apps/api/scripts/local-demo-content.ts`; content values require separate review.

Provenance comes from the existing verified ACTIVE Demo Admin found inside the
transaction. Parent IDs are generated by MongoDB/Mongoose and reused from actual
inserted or exact-matching records, never fabricated reference IDs. Existing identical
records are reused; any conflicting content/provenance stops without rewriting it.
The whole operation uses one transaction attempt with explicit abort and awaited
session cleanup. A commit error may be ambiguous: inspect before any owner-approved
retry. No publication API or general Admin authoring workflow is added.

## Verification and remaining gates

Retained offline evidence: focused TypeScript tests **22/22 PASS** (including
the original 13 tests) and PowerShell/native-process checks **17/17 PASS**.
Coverage includes fixed-target rejection, PRIMARY-before-storage ordering,
index prerequisites, Argon2id/User validation, insert-only account behavior,
full content conflict preflight, exact created/reused counts, independent
hierarchy readback, ambiguous-commit reconciliation and no provisioning replay.
PowerShell checks cover parsing, C# compilation, DPAPI, ownership, private stdin,
descendant containment and shutdown failure paths using harmless processes.
API build and relevant typecheck/lint/format/scope/security checks passed.
Completed tests were not rerun for the tooling commit.

Retained, separately owner-approved local execution evidence:

- Persistent replica-set initialization and required collection/index checks: PASS.
- Premium Demo Student and Demo Admin provisioning: PASS. Normal authentication
  is not bypassed; account creation is distinct from login verification.
- Approved content provisioning: PASS, with 2 Technologies, 2 Learning Paths,
  4 Modules, 4 Topics and 20 Concepts created; zero reused. Independent readback
  verified all 32 identities, published ancestry, ObjectId references, slugs,
  ordering, Concept Markdown/source metadata and eligible Demo Admin provenance.
  The single attempt took 22.35 seconds; check/content/shutdown/MongoDB/wrapper
  exits were all zero. MongoDB shutdown was graceful, the job emptied and ports
  were released without forced containment.
- Local MongoDB/API/Student/Admin startup and HTTP readiness: PASS.
- Real public local API verification: PASS, using 34 credential-free requests
  covering both Technologies, the complete hierarchy and all 20 Concept Read
  bodies and source references against the approved manifest.
- All 12 tooling files and the approved manifest were preserved during execution.

The private manifest is stored at
`%LOCALAPPDATA%\DeepLearner\local-dev\manifests\beginner-content-v1.json`,
with approved SHA-256
`35C6AF696E99852DD747876755FCB6EE7410D924D99B351F1AEE236DA4D67E6F`.
Demo accounts, content records, MongoDB files, signing secrets and run evidence
remain outside Git. The repository contains provisioning mechanisms and harmless
offline fixtures, not the provisioned database or account passwords.

Outstanding limitations and gates:

- Demo Student and Demo Admin normal login: **NOT_VERIFIED**. Secure password entry
  was unavailable through the tool session. Authenticated dashboard access and
  returned role/plan behavior were not established by public API requests.
- Full application Stop/Start persistence and graceful application shutdown:
  **NOT_VERIFIED**. Graceful MongoDB-only provisioning cleanup and harmless
  shutdown tests do not establish actual Next.js/API/Admin shutdown.
- The Admin application is the existing placeholder, not a completed Admin
  authentication or management UI.
- Public API verification does not close outstanding F020 browser acceptance or
  F022 real browser/backend integration and Windows shutdown limitations.
- Any new provisioning, restart/shutdown verification or automated login mechanism
  requires its applicable owner approval; never request passwords in chat.
- Local tooling approval does not authorize production deployment. Feature
  approvals remain unchanged; F023 implementation requires separate approval.

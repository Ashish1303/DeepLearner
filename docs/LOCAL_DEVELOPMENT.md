# Local Development Slice A — implementation checkpoint, 2026-10-31

## Current startup command and scope

The owner approved Slice A startup tooling at `dev` /
`41d78aae50715f6ad3b1deac1587cc215918aa9f`, plus a specific extension to modify
`apps/api/package.json` for an environment-file-free workspace script. This dated
record supersedes the earlier design record's statements about the root startup
command only. Historical documents/results below remain unchanged.

```powershell
npm run dev
npm run dev:local
```

Both supported root commands invoke `scripts/Start-DeepLearnerDev.ps1` in PowerShell 7.
The owner clarified the command-alignment approval to add `dev:local` as an alias.
Its script is `npm run dev --`: it delegates to the unchanged `dev` command and
forwards arguments without a second launcher implementation. Existing launcher
behavior, configuration validation, ownership and cleanup are unchanged.
It implements guarded startup, not environment setup. Student targets
`127.0.0.1:3000`, Admin `127.0.0.1:5173`, API `127.0.0.1:4000`. The launcher uses
existing shared-package build/watch scripts and frontend development scripts;
Next receives `--hostname 127.0.0.1`, Vite receives `--host 127.0.0.1` with its
existing strict port. The new API workspace `dev:local` retains Node watch/tsx/server
startup and omits the `.env` loader; the existing API `dev` script is unchanged.
The root `dev:local` alias is distinct from the API workspace's `dev:local` script.
Root `dev:setup` remains unimplemented. Earlier dated documents stating that the
root alias did not exist describe the preceding checkpoint; they are not an alias
prohibition or permission to activate the persistent environment.

**Operational qualification: BLOCKED.** The private persistent profile and approved
MongoDB setup are pending. Both root commands were checked and retain exit 1 with
`DEV_PROFILE_MISSING`, before building packages, creating run artifacts, opening a
database connection, inspecting ports or starting applications. This is a successful
fail-closed negative check, not a successful API/application startup demonstration.
No browser or database integration result is upgraded by it.

## Private prerequisite contract — no provisioning authority

The launcher reads the current Windows user's known LocalApplicationData folder,
then `DeepLearner/dev/profile.json`; it does not create that profile or choose a
replacement root from a redirected environment variable. It requires separately
provisioned current-user DPAPI files named `mongodb-uri.dpapi` and
`signing-secret.dpapi` beside the profile. It neither reads nor writes API `.env`.
No plaintext credential belongs in a repository template, argv, chat or run log.

`scripts/dev-local.example.json` is a non-operational contract example with PENDING
prerequisites, not an automatically installed profile. Future approved setup must
provide revision 1, the exact repository/current Windows SID, fixed
127.0.0.1:27019 / deeplearner-dev / deeplearner-dev-rs target and separately reviewed
instance/schema prerequisites. The validator rejects unknown fields and wrong
owner/repository/target. APPROVED_READY metadata is an offline prerequisite assertion,
not policy activation, live MongoDB ownership/topology/index proof or execution
permission. Only later B/C approvals can establish the real prerequisites.

The private URI requires credentials, that literal host/port/database, and exactly
`replicaSet=deeplearner-dev-rs`, `directConnection=true`,
`authSource=deeplearner-dev`; extra/duplicate options, aliases, SRV and protected
targets refuse. Signing bytes must satisfy the existing API's strong base64
requirements. Validation uses a bounded private stdin pipe and returns only a
fixed public command plan. It imports no application/database models and never
connects. Errors expose fixed codes, not supplied values.

After valid configuration, only the API child environment receives MongoDB/signing
credentials. Frontends, builders and package watchers get an explicit sanitized
environment, public API origins and no inherited NODE_OPTIONS or backend secrets.
Frontend/root real `.env*` files and workspace `.npmrc` conflicts refuse; `.env.example`
is permitted. Child npm lifecycle hooks and ambient user/global npm configuration
are disabled/isolated; the existing Windows command shell is explicitly selected.
No dependency, lockfile, authentication implementation or persistent configuration
change is included.

MongoDB installation/service/account/ACLs, schema/index inventory and activation,
genuine Student/Admin accounts and the minimal JavaScript fixture are still pending
their separate B-E approvals. `DEV-PERSISTENT-27019` remains **PROPOSED / NOT ACTIVE**.
Do not edit metadata to bypass those decisions. Preserve protected 27017/27018,
existing data/credentials/receipts and disposable qualification. Ordinary startup
never starts/stops MongoDB, provisions indexes/accounts, seeds data or repairs state.

## Foreground lifetime, ownership and known limitations

When prerequisites are eventually provided and execution authorized, retain an
exclusive startup lock until cleanup. Runs/logs are under the existing private
`DeepLearner/dev/runs/<unique-id>` directory; these are transient operational artifacts,
not setup/configuration writes. The native existing Windows Job helper creates
application/build/watcher children atomically inside the retained Job. No process is
adopted by name, PID receipt, free port or HTTP response. Build has a 120-second
deadline; initial listener startup has a 120-second deadline. The apps otherwise
run indefinitely until Ctrl+C, a child failure or failed ownership checks.

Port preflight refuses occupied ports. Scoped post-spawn TCP queries must confirm
literal loopback listeners whose PIDs belong to this Job; query/permission failure
refuses. A foreign/wildcard listener fails immediately, including a startup race.
Normal watch reloads may temporarily remove an owned listener: each service has a
60-second recovery deadline after initial startup. A missing listener does not
silently switch ports. Listener presence is not authenticated UI readiness, real
database qualification or feature acceptance. Unknown services are never stopped.

This first Windows implementation requires an interactive terminal and intercepts
Ctrl+C for bounded owned-Job cleanup. Existing workspace watchers have no isolated
graceful stop channel exposed to this launcher. Cleanup therefore explicitly reports
**FORCED_CONTAINMENT**, not graceful shutdown, and verifies the Job becomes empty.
This is a documented Slice A limitation against the earlier graceful-shutdown design
target; no unsafe console-wide signal or guessed-PID termination is substituted.
MongoDB remains outside the Job. Real Ctrl+C, watcher descendants, reload/recovery,
listener races and end-to-end app shutdown are not yet qualified.

`npm run dev -- -Check` and `npm run dev:local -- -Check` perform the same
configuration validation only, with no app/build/
database startup. For a valid profile it uses the same exclusive lock and transient
validator logs; it is not a pure filesystem-only command. Cleanup failure still
returns failure in Check mode. Neither Check nor a profile receipt proves live
database ownership, schema readiness, account eligibility or safe product behavior.

## Slice A evidence and acceptance boundary

Exact source inventory: MODIFY `package.json`, `apps/api/package.json`, this file,
`docs/SYSTEM_ARCHITECTURE.md`, `docs/DEVELOPMENT_ROADMAP.md`; CREATE
`scripts/Start-DeepLearnerDev.ps1`, `scripts/dev-local.example.json`,
`apps/api/scripts/dev-local.ts`, `apps/api/tests/dev-local.test.ts`,
`scripts/tests/DevLocal.Tests.ps1`. No other tracked source changes are authorized.
The twelve untracked original Stitch exports remain untouched and unstaged.

| Check                                                                               | Actual outcome                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup helper, lifecycle, database-configuration and environment regressions       | 32/32 PASS: `dev-local.test.ts`, `bootstrap.test.ts`, `database.test.ts`, `env.test.ts`; no real DB connections                                                                                     |
| PowerShell unit/inert checks                                                        | 13/13 PASS, including parser, Windows dotenv casing, query denial/no-match, listener race/recovery, exclusive lock, bounded private transport, cleanup-failure propagation and native Job isolation |
| Full root build                                                                     | First attempt FAIL fetching existing Google Fonts; separately approved network-enabled retry PASS. Existing Vite ineffective-dynamic-import warning remains                                         |
| Full workspace TypeScript                                                           | PASS; separate API TypeScript also PASS                                                                                                                                                             |
| Broad `npm run lint`                                                                | FAIL: 563 errors in 24 pre-existing `.cache` artifacts; zero new-source findings. This failure is retained, not relabelled PASS                                                                     |
| Source lint with explicit `.cache/**` exclusion                                     | PASS, zero errors/warnings; no lint configuration or cached artifact was changed                                                                                                                    |
| Changed JSON/TypeScript formatting, new Markdown sections, PowerShell syntax        | PASS; original historical document bytes retained                                                                                                                                                   |
| Exact scope, sensitive-data scan, UTF-8/LF and diff checks                          | PASS; ten approved source paths only, empty index, original Stitch hashes retained                                                                                                                  |
| Root `npm run dev`                                                                  | BLOCKED at missing private profile; exit 1; no app/DB startup                                                                                                                                       |
| Real app/browser/DB startup, hot reload, Ctrl+C, authentication and persistent data | NOT_RUN / NOT_VERIFIED                                                                                                                                                                              |

The native test starts only harmless Node processes: an owned parent/descendant and
a separate test-retained process. Owned Job termination and preservation of the
other process passed. The private transport test validates a synthetic in-memory
profile only. These are not real watcher, listener, database or UI qualification.
The cleanup-failure test deliberately simulates a failed query and asserts a failing
result; its synthetic NOT_VERIFIED message is expected negative-test evidence.

Independent implementation/security review findings about reload recovery, cleanup
failure propagation, private pipe deadlines and Windows dotenv casing were corrected
within scope. Final review has no unresolved Critical/High/Medium/Low findings.

**Slice A status: BLOCKED for operational acceptance.** The offline implementation
is reviewable, but prerequisites, real runtime qualification and the recorded broad
lint failure remain outstanding. No mandatory gate is waived. No Git checkpoint/
delivery, next slice or production approval follows automatically.

### Command-alignment offline review — 2026-10-31

This correction changes only root `package.json` and this current record. The
launcher, API workspace script, validator, tests, architecture/roadmap records and
other pending Slice A files retain their preceding checkpoint bytes. Historical
evidence in the table above remains that checkpoint's evidence; current command
alignment results are recorded below after verification. No root/API command
ambiguity grants a new service, setup, database or feature capability.

The smallest proposed lint follow-up is to add only `.cache/**` to the existing
`globalIgnores` array in root `eslint.config.mjs`. That would exclude repository-root
generated artifacts while leaving application, test, script and package source
rules intact. It is a recommendation requiring separate owner approval; no lint
configuration, lint script, rule or cached file is changed here. Preserve the
recorded broad lint failure separately from source lint using an explicit temporary
exclusion. An offline checkpoint does not establish operational/feature acceptance.

Current alignment verification:

- Startup TypeScript tests: 9/9 PASS. PowerShell unit/inert tests: 13/13 PASS.
- API TypeScript: PASS. Source lint excluding `.cache/**`: PASS, zero findings.
  A fresh broad ESLint diagnostic retains exactly 563 errors in 24 existing cache
  files; every finding is under `.cache`. The broad lint failure is not waived.
- `npm run dev`, `npm run dev:local` and `npm run dev:local -- -Check` each exit 1
  with DEV_PROFILE_MISSING before app/database startup. The nested npm output
  confirms `-Check` reaches the unchanged PowerShell launcher. No private profile
  was created, and no operational readiness is inferred from these negative checks.
- Formatting, whitespace, exact scope, sensitive-data and baseline-hash checks
  PASS. Only root package.json and this document differ from the beginning of
  the alignment review; all other pending Slice A source bytes and the twelve
  original Stitch files are unchanged. Earlier full build/workspace TypeScript
  results remain historical evidence; the alias-only correction does not rerun or
  relabel them as fresh checks.
- Independent review: zero unresolved Critical/High/Medium/Low findings.

**READY_FOR_OFFLINE_CHECKPOINT: YES — secondary review readiness only.** The source
and offline evidence are ready for owner review of an explicitly scoped development
checkpoint with incomplete verification recorded. This is not a replacement feature
status, full lint PASS, operational acceptance, policy exception, commit approval or
production readiness. Preserve operational BLOCKED, the broad cache-lint failure
and all mandatory deferred verification. Every commit/push still requires separate
explicit owner approval; no next slice is unlocked.

F042/F043 remain IN_PROGRESS, acceptance BLOCKED; F043 MongoDB 15 NOT_RUN, browser
213 NOT_RUN, live integration/production NOT_VERIFIED, F044 NOT_STARTED. General
persistent completion/mastery, account/fixture creation and product/UI changes remain
outside Slice A. Later runtime verification must use the approved process/isolation,
authentication and manual/automated acceptance gates; no browser exception is granted.

---

# Earlier persistent LOCAL design record — retained

# Persistent LOCAL development — design approved 2026-10-31

## Current authority and history boundary

The owner approved documentation only: the permanent LOCAL design and prospective
A-F implementation plan below. No tooling/application implementation, dependency
installation, MongoDB connection/write, service/ACL change, account creation, seed,
browser execution, paid AI call or Git staging/commit/push is authorized by it.

The original local-demo document is preserved verbatim after the historical-record
boundary below. Its earlier F023 pointer, placeholder-Admin statements, execution
approvals and PASS/NOT_VERIFIED results describe that period/profile, not the current
feature state or permission to operate the new profile. Existing contracts remain
binding. The proposed commands in this current guide are NOT IMPLEMENTED.

Preserve F042/F043 IN_PROGRESS with acceptance BLOCKED, F043 MongoDB 15 NOT_RUN,
browser 213 NOT_RUN, live integration/production NOT_VERIFIED and F044 NOT_STARTED.
Do not relabel historical HTTP/MongoDB FAIL, UNKNOWN ownership/results, incomplete
authenticated RESULT/digest ACK or protected-baseline discrepancies.

## Approved permanent design target — execution unapproved

| Component                 | Target                                                                     |
| ------------------------- | -------------------------------------------------------------------------- |
| Student                   | http://127.0.0.1:3000/login                                                |
| Admin                     | http://127.0.0.1:5173                                                      |
| API                       | http://127.0.0.1:4000/api/v1                                               |
| MongoDB software          | Reuse installed 8.2.7 binary                                               |
| Distinct MongoDB instance | 127.0.0.1:27019; loopback only                                             |
| Replica set               | deeplearner-dev-rs; one member                                             |
| Database                  | deeplearner-dev                                                            |
| Private root              | Normal Windows-user LOCALAPPDATA/DeepLearner/dev                           |
| Persistent data           | Private root/mongodb; distinct from all earlier storage                    |
| Credentials               | Separate scoped database credentials and stable private API signing secret |

The instance is a design target, not an installed/running/qualified service. Port
27019 availability is UNKNOWN. Service identity, private paths/ACLs, startup policy,
replica initialization, authentication and database access need separate approval.
Prefer a separately managed native MongoDB service; decide automatic/manual startup
in the instance-provisioning contract. Application startup remains manual. No app
background-service manager or new npm dependency is proposed.

Protect the existing 27017 service/data and 27018 local-demo/test profiles, data,
credentials and receipts. Do not convert the protected service to a replica set,
adopt its listeners, migrate its data or retarget legacy tooling. A different DB
name does not give a standalone server transactional capability. Verify the approved
new replica set/PRIMARY/session support before authorized setup or app startup.

## Reconciled assessment evidence — read-only, not runtime verification

Assessment at branch dev / HEAD 45bce961c4da05c8d6302e0e0124dcebacc99a6e found a
clean tree/index, installed MongoDB 8.2.7, and an INITIALIZED legacy receipt under
the normal user's DeepLearner/local-dev root. Stored repository/user identity and
recorded Node 24.15.0/MongoDB hashes matched. A second Node 24 installation was also
available; resolve one explicit executable, not an ambiguous PATH enumeration.

The legacy approved manifest matched its recorded hash and described 2 Technologies,
2 Paths, 4 Modules, 4 Topics and 20 Concepts. This was file inspection, not current
database readback. The latest retained legacy run reported success=false,
shutdownMode=FAILED, API exit 3221226505, shutdown helper 0, jobEmpty=true and
portsReleased=true. Preserve this failure independently of earlier successes;
neither its cause nor current runtime health was established.

The agent environment redirected LOCALAPPDATA; the normal Windows-user receipt
was present outside that redirected root. Do not initialize a replacement root
merely because a sandbox cannot see the normal profile. Service/listener queries
were restricted; no current ownership, availability or topology was inferred.
Do not repeat broad CIM/process-owner investigations or bypass permissions.

The existing service config at 27017 had no active replica-set entry; its runtime
topology was not queried. Existing 27018 is a recorded replica profile but overlaps
disposable fixture port assumptions and has a guarded lifecycle. Reuse installed
software for the new isolated profile rather than silently adopting either target.

## Proposed commands and daily behavior

The following interfaces are PROPOSED until separately implemented and verified:

```powershell
Set-Location -LiteralPath 'E:\AI\DeepLearner'
npm run dev:setup
npm run dev:local
```

Proposed dev:setup defaults to showing a file-based setup plan, not connecting or
writing. Particular write/install flags must be defined and approved with the setup
implementation; possession of a flag is not owner authorization. Separate instance
installation from DB/schema/account/fixture execution and confirm exact source and
manifest hashes before the applicable approval. Do not run these commands today.

Once authorized, dev:local should validate the fixed profile and existing schema,
build existing shared packages, start package watchers/API/Next/Vite in the
foreground and wait for bounded readiness. Reuse existing build/watch scripts and
process helpers. Next/Vite hot reload and Node/tsx API watch behavior must be qualified
on Windows. Keep services running until developer interruption or an actual failure;
startup/shutdown deadlines are not an arbitrary 15-minute demo expiry.

Ordinary startup creates no accounts, collections, indexes, seed content or services.
Do not load the ordinary unreconciled API .env for this controlled profile. Provide
allowlisted per-child environments: API/check helpers alone receive DB/signing
credentials; frontends/watchers receive only appropriate public configuration.
Refuse conflicting frontend .env files rather than mixing targets silently.

Use 127.0.0.1 consistently for browser origins/API, existing exact CORS and explicit
LOCAL TLS/cookie configuration. Preserve host/peer/role/session checks and do not
relax production security. The health endpoint proves liveness only; readiness
also needs the intended target, indexes and owned app startup. HTTP 200 alone does
not establish process ownership, successful login or feature acceptance.

Use an exclusive local run lock and retained owned application handles. A second
known active supervisor refuses; otherwise occupied ports are unidentified and
must refuse without adoption, port substitution or termination. Prefer strict
binding/readiness from the spawned children over privileged process enumeration.
If this cannot be established, report the blocker instead of guessing ownership.

The installed concurrently dependency is reusable tooling, but its Windows default
tree-kill path forcibly terminates PID trees. It is not graceful/ownership evidence.
Reuse the existing native Job/retained-child primitives for the app cleanup boundary;
do not import the disposable runner's CIM, fixture lifecycle or RESULT/ACK apparatus.
Ctrl+C requests supported normal shutdown, then bounds cleanup of owned app children
only. Qualify watcher descendants and interruption behavior; forced cleanup must
remain explicitly labelled. Never kill by process name or adopt an unknown PID.
MongoDB is outside that app Job and continues running, preserving its data. Unknown
mutation outcomes require read reconciliation, not automatic replay after restart.

## Genuine development accounts and credentials

Propose one verified ACTIVE STUDENT (demo.student@deeplearner.test) and one verified
ACTIVE ADMIN (demo.admin@deeplearner.test). Reuse existing account metadata/Argon2id
validation where compatible, secure interactive password confirmation/private stdin
and insert-only account behavior. No plaintext passwords in argv, environment,
logs, fixtures or Git; no public Admin registration, Student promotion or auth bypass.
An eligible existing account is unchanged; role/status/password conflicts require
review, never silent reset. One successful insert may remain if a later account
fails; report stage/partial outcomes honestly rather than replay automatically.

Store account passwords in the developer's password manager. Keep stable profile
signing/DB secrets private, preferably current-user DPAPI, outside Git; never request
passwords in chat or copy credentials from protected databases. Use ordinary login,
JWT, refresh rotation, restoration and logout APIs. Preserve existing rate limits.

Use separate regular Chrome profiles for Student and Admin: different ports/tabs
share the API refresh-cookie host, while frontend locks/channels are origin-scoped.
Do not solve the collision by changing cookie names, role checks or session strategy.
A second Admin is a separate fixture only for independently reviewed policy/rubric
work; ordinary F043 draft testing requires no second Admin.

## Minimal fixture and non-destructive reconciliation

Initial owner-reviewed fixture: one PUBLISHED JavaScript Technology, one JavaScript
Fundamentals Path, one Variables and Data Types Module, one or more representative
Concepts with Read/Example/Revise and one OUTPUT question. Use valid current model
fields, actual parent IDs, bounded original content and relevant clickable sources.
No generated/fake attempts, activity, scores, assessments, completion or mastery.
Real practice activity comes from normal authenticated Student interaction.

Bootstrap is a separately authorized local CLI operation, not a public HTTP endpoint
or dependency on the unfinished AI Studio. Validate exact manifest bytes/hash and
eligible Admin provenance, preflight all references/conflicts, and atomically insert
content with its proposed developer bootstrap receipt. Reuse exact matches and
stable fixture-key-to-ID mappings; refuse ambiguous/different content. Do not inject
fixture fields into production models, overwrite published records, reset passwords,
or modify prior attempts/progress. DDL/account stages are not one globally atomic
transaction: preserve partial state and reconcile UNKNOWN commits before any retry.

Only after a successful first demonstration and separate fixture approval expand
to four Modules/eight Topics, preserving existing IDs and exact matching content:

| Module                   | Proposed Topics                             |
| ------------------------ | ------------------------------------------- |
| Variables and Data Types | Variable declarations; values and coercion  |
| Functions and Scope      | Functions/scope; closures                   |
| Arrays and Objects       | Array methods; object properties/references |
| Asynchronous JavaScript  | Promises; tasks/microtasks/event loop       |

Any later CODING fixture uses the implemented submission/prepared-answer contracts,
not an assumed Run/Test engine. Additional Technology DRAFT/ARCHIVED seed records
need separate manifest approval; do not add them implicitly to the minimal fixture.

The existing ten-model initializer and Read-only manifest cannot establish current
Practice/dashboard readiness or full five-mode content. Freeze the exact prospective
collection/index inventory from DATABASE_DESIGN.md before setup approval. Empty
readiness collections do not create grading/qualification authority. No syncIndexes,
dropDatabase, destructive reconciliation, index removal/rebuild or blanket upsert.

DEV-PERSISTENT-27019 remains PROPOSED / NOT ACTIVE, with exact wording in the dated
DATABASE_DESIGN.md amendment. Existing F036/later persistent provisioning restrictions
continue until explicit activation, source/profile/inventory approval and execution
approval. Ordinary startup may verify only. This does not transfer to another DB.

## Honest current application limits

Read/Example/Revise, current Practice retrieval/submission and saved ungraded activity
are implementation foundations, not proof of this new runtime. General visualization
delivery, coding execution and persistent completion/mastery are not enabled by
seeding. ANIMATED_FLOW v1 exists, but F029's gated fixture is not general Student
delivery. F038 origins are memory-only, synthetic and restricted to its own target;
never adopt persistent users/content or persist fake receipts to bypass that boundary.
Dashboard unavailability/LOCAL_QUALIFICATION_UNAVAILABLE must remain honest.

F043 already implements protected Technology inventory/detail, DRAFT creation and
revision-controlled editing, with PUBLISHED/ARCHIVED read-only. After separately
approved setup/runtime, manually create/edit a unique draft through the real Admin
UI and confirm published Student content is unaffected. This is manual evidence,
not F043 acceptance. Any discovered app defect needs its own applicable scope approval.

## Prospective staged implementation inventory — no files created now

All paths below are repository-relative and prospective only. The current task may
modify only AGENTS.md and the six approved existing docs. No package/script/test/
fixture is created or changed by documentation approval. Each A-F stage requires
separate exact-scope implementation/execution approval; a stage is not a new feature ID.

| Stage                                 | Exact prospective CREATE/MODIFY paths and gate                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — profile/startup                   | MODIFY package.json, docs/LOCAL_DEVELOPMENT.md, docs/SYSTEM_ARCHITECTURE.md, docs/DEVELOPMENT_ROADMAP.md. CREATE scripts/Start-DeepLearnerDev.ps1, scripts/dev-local.example.json, apps/api/scripts/dev-local.ts, apps/api/tests/dev-local.test.ts, scripts/tests/DevLocal.Tests.ps1. Profile/read-only preflight and owned foreground startup; no DB/service provisioning. Runtime waits for separately approved B-E prerequisites. |
| B — distinct MongoDB instance/service | CREATE scripts/Setup-DeepLearnerDev.ps1; MODIFY package.json, scripts/dev-local.example.json, apps/api/scripts/dev-local.ts, scripts/tests/DevLocal.Tests.ps1, docs/LOCAL_DEVELOPMENT.md, docs/SYSTEM_ARCHITECTURE.md. Separate approval for service account/startup policy, private ACLs/config/storage/key material, installation, replica initialization and connections; no protected-service changes.                           |
| C — collection/index reconciliation   | MODIFY scripts/Setup-DeepLearnerDev.ps1, apps/api/scripts/dev-local.ts, apps/api/tests/dev-local.test.ts, docs/DATABASE_DESIGN.md, docs/API_DESIGN.md, AGENTS.md, docs/LOCAL_DEVELOPMENT.md. CREATE apps/api/tests/dev-local.integration.ts (import-safe; no automatic invocation). Activate the named policy separately and approve the exact index manifest before persistent execution. No destructive operations.                |
| D — genuine accounts/auth             | MODIFY scripts/Setup-DeepLearnerDev.ps1, apps/api/scripts/dev-local.ts, apps/api/tests/dev-local.test.ts, apps/api/tests/dev-local.integration.ts, docs/LOCAL_DEVELOPMENT.md. Secure account bootstrap/unchanged reuse; real normal API/Chrome authentication needs separate runtime approval. No auth strategy/API/UI change.                                                                                                       |
| E — minimal JavaScript fixture        | CREATE apps/api/scripts/fixtures/javascript-dev-v1.json. MODIFY apps/api/scripts/dev-local.ts, apps/api/tests/dev-local.test.ts, apps/api/tests/dev-local.integration.ts, docs/LOCAL_DEVELOPMENT.md, docs/DATABASE_DESIGN.md. Exact reviewed bytes/hash and bootstrap provenance; no activity fabrication. Four-module expansion is a later approved fixture revision.                                                               |
| F — first Chrome/restart demo         | MODIFY docs/LOCAL_DEVELOPMENT.md and docs/DEVELOPMENT_ROADMAP.md for exact evidence only. Separately authorized startup/login/interaction/stop/restart verifies persistence; defects or extra source paths require new approval. No automatic feature-status/Git change.                                                                                                                                                             |

Aggregate prospective new files are the three scripts/template, apps/api/scripts/
dev-local.ts, its fixture JSON, two API test files and one PowerShell test file.
Existing workspace scripts, Argon2id/model validation, safe account/content helpers
and scripts/LocalProcessOwner.cs are reuse candidates, not authorization to alter
their legacy target contracts. No external dependency, lockfile, ordinary .env,
Student/Admin source or production configuration change is included. Reconfirm
actual file dependencies before each slice; additional paths require approval.

Private future runtime artifacts are confined to the separately approved new
Windows-user DeepLearner/dev root (profile, service config, secrets, data, logs and
receipts). They are not repository files or currently authorized writes. Never
delete or move legacy roots/receipts to implement the new profile.

## Manual Chrome demonstration and verification gates

Future UI workflow: implementation -> offline tests -> accessible local demonstration
-> manual Chrome interaction -> approved fixes -> security/regression review
-> owner checkpoint review -> separately approved Git commit -> separately approved
push. Manual QA is an additional future gate; old records are not retroactively changed.

Record feature/HEAD/date, exact route, Chrome profile and genuine authenticated role,
actual interactions/navigation/validation/error states, relevant API/database effects,
desktop and mobile viewport dimensions, sanitized console/network observations,
PASS/FAIL/BLOCKED, remaining risks and owner review. Screenshots are supplemental;
never include passwords, tokens, private headers, raw HARs or Student answers.
Emulation is not physical-device compatibility. Mock previews are not live integration.

First demo should prove both role logins, published JavaScript Read/Example/Revise,
one real saved Practice submission, F043 DRAFT create/edit, unchanged published
Student content, app-only stop, restart with the same identities/data, and existing
session-restoration behavior where applicable. No fake completion/mastery score is
allowed. Blocked demonstration requires an explicit named owner exception before
claiming UI complete; it never silently converts UNKNOWN/NOT_RUN into PASS.

Applicable focused/regression tests, build, lint, TypeScript, formatting, privacy/
scope review and independent security review remain required. Destructive/isolation-
sensitive tests use separately authorized disposable targets, never persistent
developer data. Preserve formal real DB/HTTP/browser, process/Job ownership,
fixture isolation, protected baselines, authenticated RESULT/digest ACK, deadlines
and cleanup gates. Existing test runners do not become day-to-day dependencies.
Primary-host Playwright remains prohibited until separately qualified/approved;
manual Chrome does not waive that restriction or transfer a browser exception.

The next smallest useful implementation proposal is the A-E bounded mechanism with
one Concept/OUTPUT fixture, followed by separately approved F execution. Contract/
source approvals, policy activation, instance provisioning, schema/accounts/content,
runtime demo, feature acceptance, commits and pushes are distinct gates. Nothing
here implements the proposed commands, starts F044 or establishes production readiness.

---

# Historical local-demo record — retained verbatim

The following original document concerns the earlier 27018/deeplearner-local-demo
profile only. Its commands require their own applicable approvals and are not the
proposed dev:setup/dev:local interfaces. Historical statuses/results are preserved;
the current authority, feature ledger and prospective plan are defined above.

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

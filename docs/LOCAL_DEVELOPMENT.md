# MongoDB activation-source implementation — offline, 2026-11-01

Owner-approved ten-path implementation at dev/7b16bdcddd0f40f0b854398a8e25708423115a7c.
**DEV-PERSISTENT-27019 remains PROPOSED / NOT ACTIVE.** This section supersedes only
current tooling descriptions; all historical records below remain unchanged.
No provisioning, activation, credential/certificate generation, service/ACL action,
MongoDB connection, application startup or Git write is authorized or performed.

## Source policy and per-invocation authorization

PowerShell and Node define policy version 1 with the same ID, inactive status,
127.0.0.1:27019, replica set deeplearner-dev-rs, database deeplearner-dev, service
DeepLearnerDevMongo27019 and exact prospective operations: PrepareStorage,
InstallService, StartService, StopService and BootstrapFirstUser. Mismatched
status/version/target/operations refuse. No input flag, profile, receipt, environment
or request activates policy. Plan and --check-policy remain metadata only.

Only the actual CLI entry blocks can issue accepted contexts after source agreement
and OS owner checks. Contexts bind action, target and Windows SID, contain no
credentials, and are revoked in finally. Imports, dot-sourcing and exported effect
calls cannot issue contexts; caller-supplied objects fail. The Node helper compares
its independently observed OS SID with the existing private manifest and validates
fixed target/helper hash/certificate pins. It receives a fixed step argument that
must match strict private stdin. No private context is transported in that frame.

The Node context proves neither its PS parent Job nor live service ownership.
Only the existing PS setup flow is an authorized future provisioning route; it
must retain fresh service/executable/listener/path/ACL proof around each helper.
The Windows owner and SYSTEM/Administrator trust boundary is unchanged.

Preparation alone writes initial private material. Installation alone writes the
service registration receipt. Start/stop may write only their lifecycle lock;
bootstrap alone writes phase receipts and next normal configuration. Existing
exact DACL/readback, mTLS/DPAPI/keyfile, least-privilege manifest, preserved-data
recovery and protected 27017/27018 exclusions remain intact. Legacy InitializeReplica
and mongo-initialize are permanently disabled. Ordinary npm run dev never bootstraps.

## Offline evidence and remaining execution gates

Final focused evidence:

| Check                              | Result                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PowerShell parse/inert regressions | 38/38 PASS: 33 retained and 5 new grouped activation/context/artifact checks                                                                                                  |
| Bootstrap/startup TypeScript       | 27/27 PASS: 18 bootstrap and 9 retained startup/private-validator tests                                                                                                       |
| API TypeScript                     | PASS with tsconfig.test.json                                                                                                                                                  |
| Source lint                        | 469 files, 0 errors / 0 warnings; command-only .cache/** exclusion, no lint configuration change                                                                              |
| Formatting/integrity               | Three TypeScript files and five new Markdown sections Prettier PASS; ten paths UTF-8/no BOM/LF/final newline; historical documentation bytes preserved; git diff --check PASS |
| Scope/privacy                      | Exactly ten authorized modified paths; empty index; no conflicts, detected secrets or new dependencies; all twelve ignored Stitch hashes unchanged                            |
| Metadata modes                     | Actual default PS CLI Plan and Node --check-policy remain inactive, non-mutating metadata; actual PS/Node policy parity PASS                                                  |
| Independent security review        | Critical 0 / High 0 / Medium 0 / Low 0 unresolved on frozen source/tests and all ten approved paths                                                                           |
| Runtime qualification              | NOT_RUN / NOT_VERIFIED; no accepted effect CLI context issued during tests                                                                                                    |

Secondary tooling status: **READY_FOR_OFFLINE_CHECKPOINT**, for separate owner
review only. No Git checkpoint or activation is authorized. Full-root lint was not
rerun; its last historical result was 563 errors / 0 warnings in 24 .cache files.
The source-lint result above excludes that generated cache only for this check.

Pure synthetic ACTIVE facts do not alter source or issue accepted contexts.
Positive orchestration/install tests mock filesystem, crypto, services and database
boundaries; protocol/lease/policy checks use memory. Child execution is limited to
metadata, permanently disabled legacy initialization and retained harmless startup
validator/owned-child containment tests. No effect CLI is positively executed.
Lease-facts cleanup and source-level finally placement are offline evidence, not
real cancellation, owner, service or database qualification.

Required next gates remain: separate exact source/policy activation approval;
approved owner/private-storage/service/ACL/binary inventory and host prerequisites;
particular normal-user PrepareStorage execution; separate elevated dedicated-service
installation; owner-controlled authenticated bootstrap and explicit transport
transition; genuine normal-user lifecycle and persistence/transaction verification.
No automatic reset, adoption, retry or data deletion is authorized. Partial or
ambiguous state requires preserved-data owner review. Schema/index provisioning,
product accounts/fixtures and app profile activation require separate scope.

Host OS SID inspection, service virtual-account logon and creation/readback,
DPAPI/certificate/keyfile ACLs, mTLS client rejection, writable PRIMARY, actual
operator/application privileges, normal transport transition, interruption recovery,
transactions and persistence remain NOT_RUN / NOT_VERIFIED. Existing full-root lint
cache failures remain historical; lint configuration is unchanged.

Preserve MongoDB NOT_PROVISIONED; policy PROPOSED / NOT ACTIVE; app startup/shutdown
NOT_VERIFIED; F042/F043 acceptance BLOCKED; F043 MongoDB 15 NOT_RUN; browser 213
NOT_RUN; F044 NOT_STARTED; production NOT_VERIFIED. This is no runtime acceptance.

# Slice B Windows service ACL correction — offline, 2026-10-31

Owner-approved correction at dev/e5fbd8c50e86c179b22fd5549aba0d4d7d3749d0,
limited to Setup-DeepLearnerDev.ps1, DevLocal.Tests.ps1 and these current LOCAL/
ROADMAP sections. No policy activation or runtime execution is authorized.
All historical records below remain byte-for-byte unchanged.

## Default-service permission incompatibility and corrected contract

Windows documents local authenticated-user default SERVICE_USER_DEFINED_CONTROL
(0x100) service access. The prior installer registered the service, then rejected
that default while attempting to add owner rights, before writing its registration
receipt. This was reproduced in memory during readiness review; no actual service
installation failed or ran. The earlier 29/22 offline results are historical
evidence and do not establish Windows install/readback qualification.

The installer now supplies SecurityDescriptorSddl to New-Service with ErrorAction
Stop, so the supported creation command receives the explicit protected DACL:

`D:P(A;;0xF01FF;;;SY)(A;;0xF01FF;;;BA)(A;;0x1200B5;;;<original-owner-SID>)`

SYSTEM and Builtin Administrators retain full control over only this service.
The original Windows owner gets only the previously reviewed query/start/stop/
interrogate/synchronize/read-control mask. No broad authenticated-user/Everyone
grant, owner ChangeConfig/WriteDac/WriteOwner/delete grant, global Administrator
permission or machine-wide policy is introduced. The descriptor does not force
service-object ownership to change; its actual owner must be original owner,
SYSTEM or Builtin Administrators.

After creation, the existing bounded exact-service native reader obtains OWNER+
DACL. Validation requires a protected non-null DACL and exactly the three approved
allow trustees/masks, with no callback, deny, inherited or extra ACEs. Equivalent
canonical ACE order is accepted. Numeric service masks avoid generic-right mapping
ambiguity. Missing readback, unknown owner, absent owner rights, broadened rights
or descriptor mismatch refuses. Reuse of a registered service applies this same
exact allowlist as well as existing identity/configuration/receipt checks.

The registration receipt is created only after successful readback validation.
Creation/descriptor-application/readback/receipt interruptions preserve partial
state for owner review; the installer does not start, stop, delete, adopt, repair
or retry an existing service. The old post-creation ACL-append/write path is removed.
The returned creation controller is disposed on success or failure. Any existing
unknown service or protected-target mutation refuses before creation.

## Offline evidence and remaining prerequisites

Final focused offline evidence:

| Check                                    | Result                                                                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PowerShell parse/inert suite             | 33/33 PASS: 29 retained checks and 4 new grouped descriptor/install/guard regressions                                                                                                                       |
| Startup/bootstrap TypeScript regressions | 22/22 PASS: unchanged 13 bootstrap and 9 startup/private-validation tests                                                                                                                                   |
| Descriptor regression coverage           | Documented default conflict; literal three-trustee/mask fixture; canonical readback; missing/mismatched/unexpected permissions; unknown service; creation/readback/receipt interruptions; protected targets |
| Scope/privacy/integrity                  | Exact four paths; empty index; no conflicts; no detected secrets; 12 ignored Stitch hashes and unchanged bootstrap/startup/dependency contracts                                                             |
| Formatting/encoding/whitespace           | Two new Markdown sections Prettier PASS; four paths UTF-8/no BOM/LF/final newline; added-source whitespace and git diff --check PASS                                                                        |
| Independent security review              | Critical 0 / High 0 / Medium 0 / Low 0 unresolved; source, persisted fixtures and in-memory/mocked installation paths reviewed                                                                              |
| Runtime service permissions              | NOT_RUN / NOT_VERIFIED; no real service/ACL or provisioning operation performed                                                                                                                             |

Secondary tooling status: **READY_FOR_OFFLINE_CHECKPOINT** for a separate owner
review decision. This is not activation, execution, feature acceptance or Git
permission. Existing full-root lint cache failures and all previous verification
limitations remain historical evidence; no lint configuration is changed.

The descriptor defines explicit DACL grants; the existing Windows owner and
SYSTEM/Administrator trust boundary remains unchanged.
Regression fixtures represent the documented Windows default and actual installer
control flow, but all service creation/readback/file writes are mocked and all
descriptors are in memory. No SCM query, Windows permission change, credential or
certificate generation, database operation or application startup occurs in them.
Mocks are local to individual checks; real inactive refusals are rechecked afterward.

Real New-Service descriptor application and canonical readback, virtual-account
logon, normal-user query/start/stop/process-path visibility, private DPAPI/TLS/ACL
behavior, MongoDB PRIMARY/authentication, controlled transport transition and
persistence remain NOT_RUN / NOT_VERIFIED. Source activation needs a separately
approved exact diff covering both existing guards and safe active-policy tests,
then explicit policy and particular provisioning execution approvals. No guard
was enabled by this correction. Index/schema, product accounts/fixtures and
application profile activation remain separately scoped future work.

Preserve MongoDB **NOT_PROVISIONED**; DEV-PERSISTENT-27019 **PROPOSED / NOT ACTIVE**;
application startup/shutdown **NOT_VERIFIED**; F042/F043 acceptance **BLOCKED**;
F043 MongoDB **15 NOT_RUN**; browser **213 NOT_RUN**; F044 **NOT_STARTED**; production
**NOT_VERIFIED**. No Git staging/commit/push or provisioning permission is implied.

References: [Windows service permissions](https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights),
[New-Service descriptor parameter](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/new-service).

---

# First-user bootstrap — offline implementation, 2026-10-31

This current record supersedes the earlier statement that authenticated bootstrap
is unimplemented. It describes prepared source only; all earlier evidence below
is retained byte-for-byte. DEV-PERSISTENT-27019 remains **PROPOSED / NOT ACTIVE**.

## Commands and isolation

`npm run dev:setup` remains PLAN_ONLY, including bootstrap/normal config templates.
The reserved `BootstrapFirstUser` setup action now has a complete guarded candidate
workflow. All effectful actions refuse with DEV_PERSISTENT_POLICY_NOT_ACTIVE before
port/service probes, crypto, private reads/writes or MongoDB connections. Neither
flags, profiles nor receipts activate execution. The unchanged Node guard is also
unconditional; future activation must separately review both guard sources.

The only instance is DeepLearnerDevMongo27019, virtual account
NT SERVICE\DeepLearnerDevMongo27019, pinned 8.2.7 binary, 127.0.0.1:27019,
deeplearner-dev-rs, member 0 localhost:27019 and database deeplearner-dev. Protect
existing 27017 and 27018 services/data/credentials. No service is installed, adopted
or changed by this task; all prior host qualification remains snapshot evidence.

Bootstrap config keeps authorization enabled and keyfile membership authentication,
requires TLS and a private client certificate, and permits MongoDB's documented
localhost exception only inside that protected channel. CA/hostname/expiry/key/EKU/
fingerprint checks fail closed. A no-certificate probe must give an explicit TLS
certificate rejection, not just fail to connect. Windows Schannel/Node interoperability
and the exact rejection codes are real-environment prerequisites, NOT_VERIFIED.

## Workflow and interruption handling

The coordinator checks exact SCM/image/storage/config/artifact/listener ownership,
then: init once -> writable PRIMARY -> first operator -> protected unauthenticated
find must return Mongo code13 -> operator authentication/config/roles -> restricted
app role/user -> app authentication/effective privileges -> owned service stop ->
atomic known normal config -> restart/fresh authentication -> completion record.
Public hello/ping are not used as proof that data access requires authentication.

Per-action create-new intent records precede uncertain writes. Unknown init or no
PRIMARY stops for owner reconciliation without reinitialization. Lost first-user,
role or app-user ACK selects authenticated inspection with the original stored
credentials; it never resets passwords, expands roles or retries creation blindly.
Missing operator credentials or failed inspection stops. Records are bound to the
owner, target and private manifest; they are not live ownership/authentication proof.

Only mongo-control/mongod.cfg may undergo the explicit stopped-service atomic
transition via a create-new mongod.next.cfg. Unknown/partial temp state refuses.
Normal bytes retain auth/keyfile and disable localhost bypass; they preserve the
existing LOCAL/SCRAM app transport. An interrupted normal configuration is inspected
in normal mode without TLS fallback or restoration of the bootstrap exception.
A completion receipt alone cannot authorize normal startup: prepared/config/SCM/
listener checks and fresh authenticated verification remain mandatory.

Ordinary StartService/BootstrapFirstUser re-entry after completion only verifies
normal state; no initialization or user/role creation is repeated. npm run dev
and npm run dev:local remain application-only and never bootstrap or manage MongoDB.
Schema/index, genuine Student/Admin accounts, fixture and profile/signing-secret
activation are separate work; these MongoDB principals are not product accounts.

## Private material and exact runtime inventory — not created

Private root stays C:\Users\Shreeji\AppData\Local\DeepLearner\dev. Existing
mongodb/mongo-logs/mongo-control paths remain separated. Plan revision2 adds:

- mongo-control/bootstrap: private directory.
- ca.crt and server.pem there: service-readable CA/server certificate+leaf key.
- ca-key.dpapi, client.pem, operator-password.dpapi: owner-only signing key, client
  certificate+leaf key and operator password. No certificate store/trust changes.
- bootstrap-plan.json: owner-only target/helper-hash/certificate fingerprint manifest.
- initialize-intent.json, replica.json, administrator-intent.json, administrator.json,
  application-role-intent.json, application-role.json, application-user-intent.json,
  application.json, complete.json: fixed owner-only intent/result records there.
- mongo-control/mongod.next.cfg: creation-only transition candidate.
- mongodb-uri.dpapi beside the future application profile: owner-only app URI in the
  unchanged launcher DPAPI format. Profile/schema/signing-secret remain unactivated.

Passwords are independent 32-byte random values, DPAPI-protected under the original
Windows owner before any createUser. Leaf PEM keys are plaintext only inside the
explicit private ACLs required by MongoDB/client; CA signing key is DPAPI protected.
Owner/SYSTEM/Administrators remain trusted; hostile code under the owner identity
is outside this isolation boundary. DPAPI/profile loss needs explicit recovery,
never automatic auth disabling, data resets or credential regeneration.

Service rights grant only query/start/stop/interrogate/synchronize/read-control for
this service; no owner ChangeConfig/WriteDac/delete grant is added. The service
object owner and live DACL must exclude unrelated controlling grants, including
generic execute/write/all; a bounded exact-service native reader checks OWNER+DACL
and closes its handles. Installation
requires separate elevation under the original owner context, without changing
service/storage ACLs globally. Virtual-account logon and live ACL behavior remain
unqualified. The contained Node helper receives only private stdin; stdout is a
fixed public status, stderr NUL, no driver command monitoring or raw error logs.

## Privilege and scope contract

Operator: admin/deeplearner-local-operator, userAdminAnyDatabase+clusterMonitor.
App: deeplearner-dev/deeplearner-local-app with exact custom runtime role; see
DATABASE_DESIGN.md and the source manifest. Effective stored/inherited grants must
match exactly; unknown actions, resources or inherited roles refuse. No createIndex,
dropIndex/dropCollection, user administration or replica administration is granted
to the app. MongoDB insert inherently permits creation of its named collection,
so this is namespace/action restriction rather than database-enforced existing-only
insertion. autoCreate/autoIndex=false and schema readiness remain unchanged.
Slice C needs a separately reviewed provisioner and exact index inventory.

Exact source scope: AGENTS.md, scripts/Setup-DeepLearnerDev.ps1,
scripts/tests/DevLocal.Tests.ps1, apps/api/scripts/dev-mongo-bootstrap.ts,
apps/api/tests/dev-mongo-bootstrap.test.ts and current LOCAL/DATABASE/ARCHITECTURE/
ROADMAP sections. No dependency, lockfile, app API/auth logic, .env, launcher or
lint configuration changes. Source activation/review remains separate from runtime.

## Offline evidence and remaining gates

Final offline completion results:

| Check                              | Result                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PowerShell syntax and inert checks | 29/29 PASS: retained startup/setup checks plus transport, guarded crypto/DPAPI, recovery, all-mocked orchestration and service-owner/DACL cases            |
| Focused TypeScript tests           | 22/22 PASS: 13 bootstrap tests plus 9 retained startup/private-validation tests                                                                            |
| API TypeScript                     | PASS via workspace typecheck; imported helper is included through its focused tests                                                                        |
| Source ESLint                      | PASS: 0 errors/warnings with command-only cache exclusion; final two-file rerun PASS                                                                       |
| Full-root ESLint                   | FAIL: 563 errors, 0 warnings across 24 files, all under .cache; no lint configuration change                                                               |
| Formatting                         | Prettier PASS for the two TypeScript files and five newly amended Markdown sections; historical Markdown retained byte-for-byte                            |
| Encoding/whitespace/scope          | All nine paths UTF-8/no BOM/LF/final newline; exact nine-path inventory, empty index, no conflicts, added-source whitespace and git diff --check PASS      |
| Privacy/integrity                  | No detected literal secrets; two URI scan hits are runtime construction/validation expressions; 12 ignored original Stitch hashes and .gitignore unchanged |
| Independent source/security review | Critical 0 / High 0 / Medium 0 / Low 0 unresolved; service-DACL validation and wording findings resolved and re-reviewed                                   |
| Real environment                   | NOT_RUN / NOT_VERIFIED: no MongoDB/TLS connection, real certificate/credential generation, service/ACL operation, application startup or policy activation |

The driver-option test constructs an unconnected client solely to verify the
installed driver's TLS option parsing retains the strict server pin; it never calls
connect(). Certificate tests use synthetic public facts/fingerprint input, with no
new host keys or certificates. Native helper tests compile wrappers and inspect
in-memory descriptors only. The retained synthetic cleanup-refusal test deliberately
prints cleanup NOT_VERIFIED; it is not real MongoDB/application shutdown evidence.

**READY_FOR_OFFLINE_CHECKPOINT** for a separate owner checkpoint decision. This
secondary tooling label establishes no feature acceptance, operational readiness,
Git permission, provisioning authority or policy activation. Mocked protocol/inert tests never prove
real certificate rejection, MongoDB authentication, PRIMARY election, transactions,
SCM permissions, Ctrl+C/shutdown or persistence. Existing full-root lint cache
pollution remains a separate recorded limitation; no exclusion config is changed.

Preserve MongoDB **NOT_PROVISIONED**, policy **PROPOSED / NOT ACTIVE**, app startup/
shutdown **NOT_VERIFIED**, F042/F043 acceptance **BLOCKED**, F043 MongoDB **15 NOT_RUN**,
browser **213 NOT_RUN**, F044 **NOT_STARTED**, production **NOT_VERIFIED**. No Git
staging/commit/push or production permission is implied by implementation approval.

References: [MongoDB localhost exception](https://www.mongodb.com/docs/manual/core/localhost-exception/),
[TLS configuration](https://www.mongodb.com/docs/v8.0/tutorial/configure-ssl/),
[create/insert privilege nuance](https://www.mongodb.com/docs/manual/reference/command/create/).

---

# Slice B — persistent MongoDB tooling preparation, 2026-10-31

## Authority and commands

Owner-approved preparation at `dev` / `23636ad13209d11b84da49484eddf60788a30fd6`.
This section supersedes earlier statements that root dev:setup does not exist;
all historical Slice A/design evidence below remains unchanged.

```powershell
npm run dev:setup
```

The new command invokes `scripts/Setup-DeepLearnerDev.ps1` and defaults to **Plan**.
It returns a non-secret target/configuration/replica plan without filesystem
changes, service operations, port probes, credential generation or database operations. Existing npm run dev/dev:local
and the Slice A profile schema/launcher are unchanged.

Separate named operations are PrepareStorage, InstallService, StartService,
StopService and InitializeReplica. **All effectful entry points and filesystem
primitives currently refuse with DEV_PERSISTENT_POLICY_NOT_ACTIVE.** There is no
activation CLI switch, approval boolean or profile/receipt-based activation.
The PowerShell and Node guards require a separately approved source amendment,
policy activation and particular execution authorization before any effect.
Do not run effectful commands as an installation procedure from this record.

## Exact target, paths and qualified evidence

- Binding/application URI host: 127.0.0.1; port 27019.
- Replica set: deeplearner-dev-rs; application database: deeplearner-dev.
- Owner-approved advertised member: **localhost:27019**. This does not change the
  literal network binding or client URI; no IP-validation bypass is added.
- Binary: C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe, file version 8.2.7,
  SHA-256 89C1F5664DA621A6AD8A0B26DF880BAC8265BFA921F430520A1DB158CAF2F8FE.
- Private root: C:\Users\Shreeji\AppData\Local\DeepLearner\dev.
- Data: private root/mongodb. Control/config/key/receipts: private root/mongo-control.
  Logs: private root/mongo-logs. Lifecycle lock: mongo-control/lifecycle.lock.
- Proposed unique service: DeepLearnerDevMongo27019; manual startup; virtual account
  NT SERVICE\DeepLearnerDevMongo27019. Its name-derived SID is recorded in the plan;
  a read-only sc.exe showsid check returned it without installing a service.

The preceding separately approved normal/non-administrator Windows qualification
observed 27019 FREE, absent private root/data directory, current-user ownership of
the nearest existing parent and no reparse ancestors. This was a snapshot, not a
port reservation, storage claim or current service ownership proof. Future prepare/
install/start rechecks the TCP table; failures or ambiguous output refuse. Any
target TCP binding is conservatively occupied, including IPv6 or non-listening
states; unrecognized target states are UNKNOWN, never FREE.

Protect existing 27017/C:\Program Files\MongoDB\Server\8.2\data and legacy
27018/C:\Users\Shreeji\AppData\Local\DeepLearner\local-dev\mongodb. No target,
configuration or helper is retargeted to either. No new private directory/file,
service registration, replica set, database, account or application profile was
created or activated by this task. These paths remain outside the repository;
the pending narrow Stitch-source ignore entry needs no additional expansion.

## Guarded filesystem and service preparation

PrepareStorage is creation-only. It rejects an existing root, unknown services,
binary changes, links, target changes and an owner-matching parent with unrelated
write/delete-child/change-permissions authority, including generic write/all ACEs.
Native exclusive directory creation applies its security descriptor atomically and
fails if another creator wins; no existing directory is silently adopted. Private
files use CreateNew with security at creation. On partial failure retain state for
explicit reconciliation; no delete, reset, repair, rollback or blanket retry.

ACL descriptors give the current owner, SYSTEM and Administrators control. Only
the service-specific virtual identity gets data/log Modify, control-directory
traverse/read and configuration/key-file Read. Parent/root service access does not
inherit onto API profile or DPAPI files. Config/key material is outside service-
writable data. Future generation writes a strong random internal key only to the
private key file, not argv, Git or logs. No key generation/ACL application ran here.

InstallService is a distinct future administrator operation; it neither requests
elevation nor starts the service. Existing service names/configurations are not
reconfigured. A registration receipt is created only after new registration; a
partial registration/receipt failure requires review rather than adoption. Reuse/
stop requires exact current SCM image/account/manual-start settings, protected
receipts/config/key/ACLs, binary hash and literal loopback listener PID/executable
identity. A receipt or SCM Running alone is insufficient. Lifecycle operations
retain an exclusive owner-only lock. No kill-by-name/PID or external-service stop.
Live SCM permissions, account logon rights, ACL behavior, startup/listener timing,
shutdown and persistence remain NOT_VERIFIED; offline descriptors do not prove them.

## Initialization and credentials remain separate prerequisites

The exact single-member replica configuration is implemented as a public plan in
PowerShell and the existing import-safe Node helper (`mongo-plan`). Actual replica
initialization is **not implemented as a usable actuator**: after policy refusal,
the reserved operation also requires an authenticated, connection-bound bootstrap
contract. StartService has the same independent prerequisite guard, so activating
the general policy alone cannot expose an unqualified first-user bootstrap window.
There is no unauthenticated MongoDB connection/initialization shortcut or driver
import in the helper. Unknown write outcomes must be reconciled, never replayed.

This is a deliberate unresolved dependency for future approval, not a passing
initialization implementation. Approve endpoint identity/authenticated bootstrap
and its exact source/test inventory before enabling start or replica initialization.
Service startup and replica initialization must remain separate authorized actions.
Replica PRIMARY/session/transaction behavior requires its own real qualification.

Future credentials: separate operator/bootstrap and application principals; the
application principal is limited to approved deeplearner-dev operations without
cluster/service administration or unapproved DDL. Freeze exact privileges in the
later provisioning contract. No users/roles/passwords are created here. Application
credentials/signing material retain Slice A current-user DPAPI/private stdin and
process-local API-only delivery, with the existing JWT issuer/audience, LOCAL CORS
and refresh-cookie behavior. Do not write .env or mark APP prerequisites ready.
Schema/index reconciliation, accounts and content are later C-E scopes.

## Preparation evidence and readiness

Source scope: new scripts/Setup-DeepLearnerDev.ps1; modified package.json,
apps/api/scripts/dev-local.ts, scripts/tests/DevLocal.Tests.ps1 and the approved
LOCAL_DEVELOPMENT.md, DATABASE_DESIGN.md, DEVELOPMENT_ROADMAP.md sections. The
pre-existing .gitignore change is preserved. No SYSTEM_ARCHITECTURE, application,
auth, dependency, lockfile, lint configuration or private profile changes.

Offline tests cover Plan-only output, protected-target rejection, inactive-policy
refusal before effects, secret-free configuration, in-memory ACL descriptors and
shared-parent rejection, native-wrapper compilation without native creation, TCP
parser ambiguity and the separately guarded replica helper. Existing Slice A
startup/private-validation tests remain applicable. The final offline completion pass
on 2026-10-31 reran all **22 PowerShell inert/unit checks** and **9 API startup/
private-validation tests**, all passing. The default `npm run dev:setup` completed
as PLAN_ONLY without port, service, database or configuration operations. The
listener identity check considers only LISTENING rows: established connections and
TIME_WAIT rows do not invalidate an otherwise exact owned listener; missing,
foreign, wildcard and duplicate listeners refuse. Port availability remains
conservative across all target TCP bindings.

Final completion evidence:

| Check                                               | Result                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PowerShell parse/inert checks                       | 22/22 PASS; includes 13 retained Slice A checks and 9 Slice B checks                                                                                   |
| API startup/private-validation tests                | 9/9 PASS                                                                                                                                               |
| API TypeScript                                      | PASS via workspace typecheck                                                                                                                           |
| Source lint with command-only `.cache/**` exclusion | PASS: 0 errors, 0 warnings; lint configuration unchanged                                                                                               |
| Prettier                                            | PASS for root package/TypeScript and the three Slice B Markdown sections                                                                               |
| Encoding and whitespace                             | Eight paths UTF-8 without BOM, LF/final newline; added-source whitespace and `git diff --check` PASS                                                   |
| Integrity and sensitive-data review                 | Exact eight-path scope; empty index; 12 ignored original Stitch hashes match; preserved ignore bytes and historical documentation; no detected secrets |
| Independent source/security/scope review            | Critical 0 / High 0 / Medium 0 / Low 0 unresolved findings                                                                                             |
| MongoDB/service/ACL/application runtime             | NOT_RUN / NOT_VERIFIED; no operational qualification                                                                                                   |

Fresh full-root ESLint remains **FAIL: 563 errors, 0 warnings across 24 files,
all under `.cache`**. This generated-cache limitation is separate from the passing
source lint. No lint exclusion or configuration change is included. A small
future separately approved global `.cache/**` exclusion remains the recommendation.
The synthetic cleanup-refusal test prints a deliberate cleanup NOT_VERIFIED message;
that passing negative check is not real application/MongoDB shutdown evidence.

Preparation is **READY_FOR_OFFLINE_CHECKPOINT** for separate owner checkpoint
review only. This secondary evidence label changes no feature acceptance or runtime
gate. Persistent MongoDB remains **NOT_PROVISIONED**; startup/shutdown and
production readiness remain **NOT_VERIFIED**. No policy activation, provisioning,
application startup, Git staging/commit/push or production permission is implied.

**Not ready for blanket provisioning execution.** The preparation is reviewable;
policy/source/execution approval, private ACL/service-install inventory and the
authenticated bootstrap contract remain prerequisites. Service is not installed
by this task, replica is not initialized, development database is not created,
application accounts/fixtures are not provisioned, and app startup is NOT_VERIFIED.
F042/F043 remain IN_PROGRESS with acceptance BLOCKED; F043 MongoDB 15 NOT_RUN,
browser 213 NOT_RUN, production NOT_VERIFIED, F044 NOT_STARTED.

Design references: [MongoDB Windows services](https://www.mongodb.com/docs/manual/administration/run-mongodb-windows/),
[MongoDB hostname validation](https://www.mongodb.com/docs/manual/reference/parameters/),
[Windows service accounts](https://learn.microsoft.com/windows/security/identity-protection/access-control/service-accounts).

---

# Earlier Slice A checkpoint — retained

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

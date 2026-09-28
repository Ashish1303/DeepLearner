# F005 — MongoDB Connection Foundation

## Status

APPROVED_COMPLETE. Owner approved local verification and closure on 2026-09-28. Atlas connectivity/TLS is DEFERRED — NOT_VERIFIED to a future deployment-readiness task. External OS signal delivery remains unverified.

## Goal

Establish one managed MongoDB connection per API process, with validated configuration, safe startup/failure/shutdown behavior, and a clear foundation for F006 models.

## Design References

- [PRD](../PRD.md): MongoDB Atlas, Mongoose, modular monolith, and secret isolation.
- [System architecture](../SYSTEM_ARCHITECTURE.md): repositories own persistence; environment separation and controlled dependency failures.
- [Database design](../DATABASE_DESIGN.md): TLS, separate environment databases, intentional index creation, and no raw credentials in stored data/logs.
- [API design](../API_DESIGN.md): standard responses and DEPENDENCY_UNAVAILABLE convention.
- [Roadmap](../DEVELOPMENT_ROADMAP.md): F004 precedes F005; models, registration, and login follow separately.
- [F004](F004-backend-common-foundation.md): existing env validation, Pino logging, error helpers, health, and Node tests.
- [Mongoose connections](https://mongoosejs.com/docs/connections.html): connection events, buffering, pool options, and initial failure versus reconnection behavior.
- [Atlas network access](https://www.mongodb.com/docs/atlas/security/ip-access-list/): restricted network access prerequisites.

## Scope

- Add Mongoose to the API workspace only.
- Introduce an API-local connection module and testable startup/shutdown orchestration.
- Require validated database configuration at API runtime.
- Connect before opening the HTTP listener; clean up on startup failure.
- Handle connection state events and graceful shutdown without logging connection secrets.
- Disable implicit Mongoose buffering, automatic collection creation, and automatic index builds.
- Preserve existing health and error contracts.
- Add deterministic lifecycle tests and a separately invoked, non-writing real-database connection smoke test.

## Out of Scope

Schemas, models, repositories for domain data, collection/index creation, migrations, seeds, accounts, registration, verification emails, password hashing, JWTs, sessions, cookies, authorization, frontend integration, extra HTTP routes, Redis, queues, and deployment provisioning.

## Architecture at Planning

F004 is APPROVED_COMPLETE. The backend uses Express 5, Zod environment/request validation, Pino, Helmet, controlled CORS, and shared response contracts. server.ts immediately opens HTTP and drains HTTP on shutdown with a ten-second deadline. There is no MongoDB/Mongoose connection or model. MONGODB_URI is only an inactive example placeholder. app.ts exports an Express app without opening sockets; preserve that useful testing boundary.

The owner reconfirmed the existing sequence: F005 connection foundation, F006 database models, F007 registration/email verification, F008 login/token management. Argon2id, email-only login, 15-minute access JWT, refresh cookie, MongoDB sessions, and provisioning through F007 remain unchanged. Existing roadmap titles and historical feature records will not be renamed.

## Architecture Decisions

### Connection ownership

Use one API-owned Mongoose instance/default connection per process. Future model modules must use that same configured instance. No per-request connection and no connection initiated merely by importing app.ts or a model. Reuse an in-flight connection promise for repeated concurrent initialization; closing is idempotent. Attach lifecycle listeners once and avoid reconnect/shutdown listener leaks.

config/database.ts owns Mongoose configuration, connection state, connect/disconnect, and sanitized connection events. bootstrap.ts coordinates database and HTTP lifecycles through a small typed dependency boundary so tests can simulate failures without a live database. server.ts remains the executable entry point and signal owner. This is a local lifecycle seam, not a general dependency-injection framework.

### MongoDB configuration

| Setting                   | Proposal                                          | Reason                                                                                               |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| MONGODB_URI               | Required nonblank secret                          | Atlas connection/authentication information; no embedded real value or fallback                      |
| MONGODB_DB_NAME           | Required explicit database name                   | Avoid accidental use of the driver's default database; authoritative over any URI database component |
| TLS                       | Verified TLS by default; approved local exception | Preserve database security baseline                                                                  |
| serverSelectionTimeoutMS  | 30000                                             | Retain normal failover tolerance for Atlas replica sets                                              |
| connectTimeoutMS          | 10000                                             | Bound an individual connection attempt                                                               |
| waitQueueTimeoutMS        | 10000                                             | Bound waiting for a pooled connection                                                                |
| maxPoolSize / minPoolSize | 10 / 0                                            | Modest initial per-server application pool, without prewarming unused connections                    |
| bufferCommands            | false                                             | Avoid hidden queued model operations when unavailable                                                |
| autoCreate / autoIndex    | false / false                                     | No implicit schema/index work; F006 must plan these explicitly                                       |

Pool and timeout defaults stay centralized in connection code for this phase; do not introduce a large tuning-variable surface. Driver monitoring connections are additional to the configured application pool. Server-selection timeout is not a promise that DNS resolution or the entire startup always finishes within exactly 30 seconds. Retain normal driver reconnect behavior; do not add a custom retry loop or reconnect timer.

### Environment validation

Extend apps/api/src/config/env.ts; do not use shared validation packages. Validate the MongoDB URI scheme (mongodb:// or mongodb+srv://), reject blanks/placeholders, and reject certificate/hostname bypass options and TLS disabling outside the explicit local exception. Let the driver validate the full MongoDB grammar; do not invent a full URI parser. Catch and sanitize parse/connection errors. Validate MONGODB_DB_NAME as a bounded simple identifier (letters, digits, hyphen, underscore; maximum 63 ASCII characters), rejecting admin, local, and config. Never print rejected values.

MONGODB_DB_NAME is the sole authoritative application database setting. The examples explain this explicitly, including when a URI also contains a database name. LOCAL may use the installed loopback MongoDB instance under the approved TLS exception or a dedicated non-production Atlas database; DEVELOPMENT and PRODUCTION use separate database credentials and databases. Follow the existing deeplearner-dev/deeplearner-prod naming guidance, with deeplearner-local recommended for local isolation. Actual isolation must also be enforced through credentials, not inferred from a name alone.

Promote MONGODB_URI out of the inactive future-integration block in .env.example and add MONGODB_DB_NAME. Keep URI examples blank or unmistakably non-secret placeholders. Real values belong in the ignored API .env or hosted secret configuration. Do not read, print, create, or change real credentials as part of planning. All authentication/provider variables remain inactive.

### Startup and failure

Validate environment, initialize connection settings/listeners, await successful connection, and only then call HTTP listen. Initial connection failure produces a fixed safe fatal event, closes partial resources, and exits nonzero without an HTTP listener. Do not launch in a silent database-disabled mode. HTTP bind failure also closes the database and exits nonzero.

Install shutdown handling before awaiting startup. A termination signal during connection must prevent a late HTTP listener from opening; any late connection completion must be cleaned up. Repeated signals share the same shutdown work. Preserve the existing ten-second shutdown deadline as the final process-exit bound, including when a connection attempt cannot be immediately cancelled.

### Runtime and shutdown

After initial success, disconnected/error/reconnected events update safe internal state and emit bounded operational logs. Let the driver reconnect; do not repeatedly call connect on every event. Do not terminate merely because of a transient runtime disconnect. Avoid repeated identical error logs while the state is unchanged, and do not log raw errors.

On SIGINT/SIGTERM, prevent new startup work, stop accepting HTTP, allow in-flight requests to drain, disconnect MongoDB, and exit cleanly. Cleanup must run even if HTTP close fails. If the overall ten-second deadline expires, log a fixed failure and force nonzero exit; document that this is a last resort rather than a successful graceful shutdown.

## API Conventions

GET /api/v1/health remains the exact F004 liveness response and does not execute a database ping. Initial database failure means the process never opens HTTP. A later disconnect does not change health into readiness; it may still return 200 while the process is alive. No readiness endpoint, global database gate, or new shared response fields are introduced.

Connection startup failures are process failures, not fabricated HTTP responses. Future database-backed routes will use F004's safe AppError/envelope and the existing 503 DEPENDENCY_UNAVAILABLE convention where appropriate. Do not add speculative database-error mapping or catch-all 503 behavior to unrelated routes in F005.

## Logging / Security Considerations

- Use existing Pino with fixed event/message names, module=database, and safe state/failure codes. Process-level events have no invented HTTP request ID.
- Never log the URI, credentials, database server addresses, raw driver errors, causes/stacks, connection-option objects, environment values, or query content. Keep Mongoose debug logging off.
- Extend existing logger redaction for MONGODB_URI/mongodbUri/connectionString as defense in depth; explicit field selection remains mandatory.
- Require verified TLS except the approved explicit LOCAL/single-127.0.0.1 plaintext mode. Never bypass certificate/hostname checks for TLS connections.
- Use a dedicated Atlas database user limited to the intended database, with only required privileges. No cluster-admin credentials and no broad 0.0.0.0/0 access recommendation.
- The owner supplies existing non-production Atlas credentials/network access securely before real connection smoke testing. Do not provision Atlas resources or change network rules automatically.
- No collections or indexes are created, and no documents are read/written during the connection-only smoke test.

## Files Changed

Created files:

- apps/api/src/config/database.ts
- apps/api/src/bootstrap.ts
- apps/api/tests/database.test.ts
- apps/api/tests/bootstrap.test.ts
- apps/api/tests/database.integration.ts
- docs/features/F005-mongodb-connection-foundation.md

Modified files:

- apps/api/src/server.ts: connect-before-listen and coordinated shutdown.
- apps/api/src/config/env.ts: required URI/database configuration and safe validation.
- apps/api/src/common/logging/logger.ts: connection-string redaction.
- apps/api/.env.example: active safe MongoDB configuration examples.
- apps/api/package.json: Mongoose dependency and separate test:db command.
- package-lock.json: npm-generated dependency resolution.
- apps/api/tests/env.test.ts: required variables, invalid/sensitive URI cases, and environment separation checks.
- apps/api/tests/foundation.test.ts: harmless isolated database configuration fixtures only; no network connection.
- apps/api/tests/logging.test.ts: harmless child-process configuration and connection-string exclusion checks.
- docs/DEVELOPMENT_ROADMAP.md: approved scope, IN_PROGRESS then READY_FOR_REVIEW after verification.

Leave web/admin, shared packages, app.ts, health handlers/contracts, F004 error middleware, existing feature histories, and source architecture documents untouched. Existing API TypeScript/test discovery already covers the proposed .ts files; no new test framework/configuration is needed.

## Dependencies

Installed mongoose 9.10.2 (requires Node >=20.19.0; repository runtime is Node 24.15.0). npm added 17 packages and audited 483, reporting zero vulnerabilities. No unrelated package versions changed. It is the approved ODM and supplies connection lifecycle/pooling through its MongoDB driver dependency. Existing libraries provide no MongoDB connection capability. No separate mongodb dependency or @types/mongoose package; Mongoose includes TypeScript types. No password, JWT, session, or database-emulator packages.

Mongoose and its transitive MongoDB driver were approved as part of this plan. Installation used --ignore-scripts; no extra direct dependency or framework was added.

## Acceptance Criteria

- [x] F005 scope only, with F004 completed and F006 still unstarted.
- [x] URI and explicit database name are required, validated, and never disclosed in errors/logs.
- [x] TLS verification, finite connection/selection/pool-wait settings, and bounded pool configured centrally.
- [x] One connection per process; concurrent initialization and repeated shutdown are safe.
- [x] HTTP opens only after successful initial database connection.
- [x] Connection/bind failures clean up resources and exit nonzero without leaking internals.
- [x] Runtime disconnect/reconnect events are handled without custom retry loops or event-listener duplication.
- [x] SIGINT/SIGTERM drain HTTP then close MongoDB; signals during startup cannot open a late listener.
- [x] Buffering, autoCreate, autoIndex, and debug logging disabled; no models/collections/indexes created.
- [x] F004 health, CORS, errors, request IDs, and logging regressions pass unchanged.
- [x] Unit/lifecycle tests pass without a real database or credentials.
- [x] Local non-writing connection and full server smoke passed; owner explicitly deferred Atlas connectivity/TLS (DEFERRED — NOT_VERIFIED).
- [x] Build, lint, typecheck, formatting, and final scope/diff review pass.
- [x] Approved P2 follow-up checks passed; READY_FOR_REVIEW as directed, with the live verification gap retained above.

## Historical Verification — 2026-09-27

2026-09-27:

| Check                                        | Result                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| API tests                                    | PASS: 25/25, including F004 health/404, headers/CORS, request IDs/errors and log redaction                                                           |
| Lifecycle coverage                           | Success/failure ordering, shared initialization/shutdown, pending connection shutdown, deadline, HTTP drain/bind failure and sanitized driver errors |
| npm run lint                                 | PASS                                                                                                                                                 |
| npm run typecheck                            | PASS, all workspaces                                                                                                                                 |
| npm run format:check                         | PASS                                                                                                                                                 |
| npm run build                                | PASS, all workspaces; network-enabled retry for existing Google Fonts imports                                                                        |
| Compiled API smoke                           | PASS: missing/invalid URI exits 1 without listener/secret disclosure; isolated compiled app health 200 and standard 404                              |
| Scope/secrets review                         | PASS: only approved files; no actual credentials, models, data operations, auth, new endpoints or frontend changes                                   |
| npm run test:db --workspace=@deeplearner/api | BLOCKED: no API .env or valid non-production database configuration; command fails safely with exit 1                                                |
| Live Atlas + full server smoke               | NOT VERIFIED: requires the private non-production target                                                                                             |

The restricted Windows sandbox prevented tsx from reading OS user information; API tests passed when rerun outside that restriction. The first build could not fetch existing Google Fonts; retried with network access. No configuration was changed to bypass either restriction.

Default tests use dummy configuration and typed connection/listener fakes; no real secrets or database are loaded. A real Mongoose malformed-URI test confirms sanitized rejection without opening a socket. The separate test:db command loads ignored API .env only when explicitly invoked, refuses APP_ENV=PRODUCTION, connects, pings, and disconnects with no models or data operations. Its 45-second safety deadline prevents a stalled smoke run. Connectivity/ping does not prove future write privileges.

## Dependencies for F006

F006 starts only after F005 owner approval. It receives the configured Mongoose instance, connection lifecycle, buffering/index policy, validated environment, and test conventions. It must separately approve schemas, field alignment between API/database documents, indexes/TTL and their explicit creation, and model/repository boundaries. No account is seeded here; F007 registration provisions initial accounts. F008 retains approved Argon2id/email/session/token decisions, and frontend integration remains separately scoped.

## Known Limitations / Decisions for Review

- Starting the API will require valid database configuration and an available database; importing the Express app for isolated HTTP tests will not connect.
- Health remains liveness, not readiness. A dedicated readiness contract would require a later approved change.
- Driver reconnection and a connection-state flag do not replace future per-operation error handling.
- Pool/timeouts are conservative starting values, not a load-tested capacity claim.
- Atlas provisioning, real secrets, and network rules are external prerequisites, not changes this plan authorizes.
- MONGODB_URI and MONGODB_DB_NAME are required. MONGODB_TLS defaults to true; false requires the approved local-only policy.

## Implementation History

Owner approved implementation on 2026-09-27; status was set to IN_PROGRESS before code changes. Connection lifecycle, validated configuration, redaction, tests and the separate smoke command are implemented. No models, data operations, auth, endpoints, shared-package or frontend changes. The owner subsequently directed READY_FOR_REVIEW after successful P2 follow-up verification while retaining the live Atlas gap. F006 remains NOT_STARTED. Initial foundation and P2 fix committed and pushed as 37f7066; local TLS follow-up is included in the closure commit.

## Approved P2 TLS Follow-up

Review found that the driver rejects tlsInsecure=false alongside explicit certificate/hostname verification options. The approved fix removes only that redundant safe URI option before connecting; true, invalid and contradictory tlsInsecure values fail safely. Strict TLS options remain unchanged.

Changed: apps/api/src/config/database.ts, apps/api/tests/database.test.ts, apps/api/tests/env.test.ts, this record and the roadmap. No new dependencies, endpoints or architecture changes.

The first regression run exposed incorrect test expectations for retained input option names. Work stopped; the owner approved correcting assertions to the driver's effective settings: tls=true, rejectUnauthorized=true and default hostname verification. All 28 API tests, full build, lint, typecheck, formatting and scope/secrets review now pass. Parser tests open no database connection and cover secure combinations; environment tests reject weakened combinations in LOCAL and PRODUCTION. Live Atlas verification remains unperformed.

## Local Verification — 2026-09-28

Owner authorized existing Windows MongoDB for development verification. PASS: Community Server 8.2 installed, service running, loopback port 27017 reachable. Read-only runtime configuration inspection succeeded without credentials; authorization and TLS are not configured. Diagnostic client closed. Created apps/api/.env from the template only after confirming Git ignores it; LOCAL and deeplearner-local selected, with no credentials. No service settings, users, models, collections or indexes changed.

FAIL: approved test:db command exited 1 after connection selection timed out; application-enforced TLS is incompatible with the local non-TLS service. Cleanup emitted disconnected and the process exited. NOT_VERIFIED: successful application connect/ping/disconnect, database-connected API startup/health and graceful shutdown. PASS: 28/28 API regression tests, including F004 behavior. Atlas verification remains separately pending. A narrowly scoped local TLS policy change or system TLS setup requires explicit approval before further work. F005 remains READY_FOR_REVIEW, not approved complete.

## Approved Local TLS Exception — 2026-09-28

Owner explicitly approved MONGODB_TLS=false only with APP_ENV=LOCAL and a single literal 127.0.0.1 host in a mongodb:// URI. Strict verified TLS remains mandatory by default and for Atlas, hosted environments and other hosts. Configuration validation and connection setup share the same policy. Plaintext forces directConnection=true to prevent replica-set discovery; aliases, alternate IP forms, SRV, mixed hosts, proxy settings and contradictory options are rejected. Certificate/hostname bypass options remain prohibited everywhere.

Changed: apps/api/src/config/database.ts, apps/api/src/config/env.ts, apps/api/.env.example, apps/api/tests/database.test.ts, apps/api/tests/env.test.ts, this document; ignored apps/api/.env opts into the local exception. No dependencies, F004 contracts, models, collections, indexes, database users or service settings changed.

| Check                                              | Result                                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Approved non-writing local connect/ping/disconnect | PASS, exit 0                                                                                                                |
| Database connection precedes HTTP startup          | PASS, live event ordering                                                                                                   |
| Existing health 200 and unknown-route 404          | PASS, live API with local MongoDB                                                                                           |
| Graceful/repeated shutdown                         | PASS, repeated installed SIGINT/SIGTERM handler dispatch caused one shutdown; database state 0, exit 0 and closed HTTP port |
| Security/API regression tests                      | PASS, 31/31                                                                                                                 |
| Build, lint, typecheck, formatting                 | PASS                                                                                                                        |
| Scope/secrets review                               | PASS; .env remains ignored, no actual credentials in changed files                                                          |
| Atlas TLS/connectivity/networking                  | NOT_VERIFIED                                                                                                                |

Windows live shutdown verification dispatched the installed signal handlers in-process through a temporary harness; external OS signal delivery was not tested. No persistent harness or implementation changes outside scope. Owner subsequently approved these local results and explicitly deferred Atlas connectivity/TLS to deployment readiness. F005 is APPROVED_COMPLETE; F006 remains NOT_STARTED and requires separate approval.

## Closure — 2026-09-28

Owner-approved evidence: 31/31 tests; successful build, lint, typecheck, formatting, non-writing local connect/ping/disconnect, connect-before-HTTP startup, health/404 contracts and graceful/repeated shutdown-handler checks. Windows handlers were dispatched in-process; external OS signal delivery is NOT_VERIFIED. Atlas connectivity, TLS and networking: DEFERRED — NOT_VERIFIED, to a future deployment-readiness task; never recorded as PASS.

Preserve explicit LOCAL/single-127.0.0.1 TLS opt-out, direct mode and strict verified TLS elsewhere. No models, collections, indexes, authentication or F006 work. Closure commit on dev includes approved local policy code/tests and documentation. Local .env is ignored and excluded; push awaits separate owner approval.

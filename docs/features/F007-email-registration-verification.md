# F007 — Email Registration + Verification

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion within the agreed backend-only scope on 2026-09-29 after reviewing implementation, test evidence and the dedicated code review. Depends on approved [F005](F005-mongodb-connection-foundation.md) and [F006](F006-user-session-models.md). Follow [API contracts](../API_DESIGN.md), [database design](../DATABASE_DESIGN.md), [architecture](../SYSTEM_ARCHITECTURE.md) and [roadmap](../DEVELOPMENT_ROADMAP.md).

## Scope / Approved Decisions

- POST `/api/v1/auth/register`, `/verify-email`, `/resend-verification`; F004 validation, response envelopes, request IDs and safe errors.
- Strict names/email/password/optional-profile validation; normalized email; explicit STUDENT/FREE/PENDING_VERIFICATION assignment. Argon2id (64 MiB, three iterations, parallelism one); no login or session creation.
- Random 32-byte base64url verification tokens; only SHA-256 digests stored; expiry 15 minutes. Transactions coordinate registration, verification, resend and required audit records. Conditional user/version writes serialize competing operations; actual concurrency guarantees require database tests.
- Registration returns 201 after commit with `verificationEmailStatus: ACCEPTED | NOT_CONFIRMED`. ACCEPTED means provider acceptance, never guaranteed delivery. Failed/disabled delivery preserves the account for resend recovery.
- Resend returns generic 202/data null: "Request received. If your account needs verification, check your inbox or try again later." Replace older tokens transactionally; do not reveal account/provider state. Replays return generic invalid/expired errors; never activate disabled/suspended users.
- Injectable email interface; native-fetch Resend adapter; disabled delivery only in LOCAL. Fake transports in tests. Escaped HTML/plain-text templates, future `${WEB_ORIGIN}/verify-email#token=...` destination; no frontend route here. Bounded sends with at most one transient retry and stable idempotency key, after commit. No durable delivery queue; crashes may require resend.
- Minimal append-only `auditLogs`: category AUTH, action AUTH_REGISTERED/AUTH_EMAIL_VERIFIED, actorId/resourceId User references, resourceType USER, requestId, strict metadata source EMAIL_PASSWORD, createdAt. Actor identifies the affected account, not an authenticated session. No sensitive payloads. Canonical actor/time and resource/time indexes declared; no automatic provisioning.
- Approve argon2 and express-rate-limit subject to compatibility/security review. Single-process memory limits: register 5/hour/IP, verification 10/15min/IP, resend 3/hour/email+IP; obscure email keys and prevent trivial address/IP variation bypasses. No permissive proxy trust. Limits reset on restart and are not distributed.

## Configuration

API-only validation for EMAIL_PROVIDER, EMAIL_FROM, RESEND_API_KEY, WEB_ORIGIN and AUTH_REGISTER/VERIFY/RESEND_LIMIT/WINDOW_MS. Safe examples only. No actual .env or F005 TLS/DNS changes. Hosted email requires Resend and HTTPS origin.

## Exact Approved Files

Create under `apps/api/src/`: `config/auth.ts`; `modules/auth/{auth.routes,auth.controller,auth.schema,auth-rate-limit,registration.service,registration.repository,password.service,verification-token.service}.ts`; `common/email/{email.service,verification-email}.ts`; `modules/audit/{audit.model,audit.repository}.ts`.

Create under `apps/api/tests/`: `registration.test.ts`, `auth-routes.test.ts`, `auth-rate-limit.test.ts`, `password.test.ts`, `verification-email.test.ts`, `auth-audit.test.ts`, `registration.integration.ts`.

Modify: `apps/api/src/app.ts`, `apps/api/src/config/env.ts`, `apps/api/src/common/logging/logger.ts`, `apps/api/.env.example`, `apps/api/package.json`, `package-lock.json`, `apps/api/tests/env.test.ts`, `apps/api/tests/logging.test.ts`, `docs/DEVELOPMENT_ROADMAP.md`; create/update this document.

Separately approved compatibility correction: `apps/api/src/modules/users/user.model.ts`, `apps/api/tests/user-model.test.ts`, `docs/features/F006-user-session-models.md`; real-hash regression in the listed `password.test.ts`. Accept both `m,t,p` and installed-library `m,p,t` parameter orderings without rewriting hashes or changing security parameters.

## Acceptance / Verification Boundaries

- Validate public contracts, duplicate mapping, privilege rejection, hash/token protection, expiry/replay handling, email failure recovery, rate limits, safe logs and append-only audit interface.
- Offline injected-service/HTTP tests, real Argon2 hashing, all prior regressions, build/lint/typecheck/formatting and scope/security review are authorized.
- Separately invoked integration suite must refuse Atlas/production, require explicit local target and write opt-in, avoid default .env loading and target an isolated disposable replica set. Execution, collection/index creation, synthetic writes and cleanup require separate explicit owner approval.
- Mock tests do NOT establish transaction atomicity, concurrency, unique-index enforcement, query projection or TTL execution. Database evidence is recorded separately below.
- No real email sends or provider smoke without separate approval. No F003/F005 changes, further F006 changes, F008+, actual secrets or permanent DNS changes. Database writes were limited to the explicitly approved disposable integration runs.

## Results / Open Gates

2026-09-29: Backend implementation present. PASS: 70/70 offline API tests (all previous 53, 11 User tests), root build, lint, typecheck and formatting. Includes injected HTTP smoke, real Argon2 hashing/model compatibility, rate limits, fake email transport, audit/schema and F004/F005 regressions. Fixed two test lint errors. Final scope/secrets review found no real credentials; actual .env remains ignored and untouched. Approved dependencies: argon2 0.45.1, express-rate-limit 8.7.0; installation audit reported zero production vulnerabilities.

Isolated database integration PASS, exit code 0, including the owner-approved strengthened rerun on 2026-09-29. Existing MongoDB 8.2 ran as a disposable `f007-test` replica set on 127.0.0.1:27018 with a unique temporary directory and initially empty `deeplearner-f007-test`. Only approved application collections/indexes and synthetic data were created. No Atlas operations or real emails. The 90-second suite and 120-second external deadlines were respected; disconnection, owned-process shutdown, directory removal and free-port confirmation PASS.

Acceptance evidence:

- PASS: registration/verification/resend contracts, privilege rejection, Argon2id/token protection, generic resend, fake-provider failure recovery, rate limits and safe logs (offline/HTTP tests).
- PASS: registration rollback on audit failure, concurrent duplicate-email rejection with unique indexes, verification consumption/replay prevention, replacement-token invalidation and User/token query projections (real local database).
- PASS: expired record present before AND after exact `400 AUTH_VERIFICATION_TOKEN_INVALID_OR_EXPIRED`; account remained pending/unverified with no activation audit.
- PASS: observed verification-first mixed race; verification fulfilled, resend fulfilled with null, active User, consumed token, no outstanding token and exactly one verification audit. Resend-first ordering is supported by assertions but was NOT observed.
- PASS: complete tracked/untracked scope and secrets review, including approved F006 compatibility correction. No unintended changes or real secrets found; nothing staged or committed.

Remaining limitations: actual TTL deletion and real Resend delivery NOT_VERIFIED. Browser signup/verification integration is outside F007; `/verify-email` is a future frontend route. Normal Atlas application startup without temporary overrides remains NOT_VERIFIED under F005. Local results do not verify Atlas application writes. In-memory limits reset on restart and are not distributed; independent HMAC-obscured IP/email budgets and IPv6 grouping prevent pair-key bypasses. Generic replies/response floor do not guarantee constant timing. Production collection/index provisioning requires separate approval. No F008 work started.

## Owner Completion Approval — 2026-09-29

Dedicated read-only code review found no actionable P0, P1, P2 or P3 defects. Owner accepted the implementation and verification evidence with the limitations above preserved. F007 is APPROVED_COMPLETE; F008 remains NOT_STARTED and needs separate authorization.

Non-blocking future coverage opportunities (not completed tests):

- Explicit verification/resend scenarios for disabled and suspended users.
- Failure injection proving verification rollback when audit insertion fails.
- Failure injection proving resend restores the previous token if replacement insertion fails.

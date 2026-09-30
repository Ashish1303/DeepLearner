# F008 — Login + Access/Refresh Tokens

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion within the agreed backend-only scope on 2026-09-30 after reviewing implementation, verification evidence, the P2 correction and final code review. Implementation was authorized on 2026-09-29. Depends on approved F007 and existing F004–F006 foundations. Canonical references: [API](../API_DESIGN.md), [database](../DATABASE_DESIGN.md), [architecture](../SYSTEM_ARCHITECTURE.md), [roadmap](../DEVELOPMENT_ROADMAP.md).

## Scope / Approved Decisions

Backend-only POST `/api/v1/auth/login`, POST `/api/v1/auth/refresh`, and reusable Bearer authentication middleware. Preserve F004 envelopes and F007 endpoints. No UI integration, logout, password reset, Google flow or F009 work.

- Argon2id email/password login; generic invalid credentials including unknown/passwordless accounts. Verify credentials before returning account-state errors.
- HS256 JWTs using jose, independently generated secret of at least 32 bytes, issuer/audience and required claims; fixed 900-second lifetime. Stateless access verification means revocation does not invalidate already issued access JWTs before expiry.
- MongoDB refresh sessions expire 30 days after creation. Only SHA-256 secret digests persist. Rotation never extends expiry; validity checks do not rely on TTL cleanup.
- Strict reuse detection: one concurrent refresh can succeed and the competing old-token request then revoke that session. Commit revocation/audit before returning the reuse error. No replay grace period.
- DISABLED never auto-reactivates. Only SUSPENDED with a valid past/present suspendedUntil, verified email and valid credentials/current unrevoked refresh session can transition conditionally to ACTIVE. Never restore revoked sessions or erase suspension history.
- Secure HttpOnly host-only SameSite=Lax cookies. Insecure `dl_refresh` only with explicit LOCAL configuration, allowlisted loopback Origin, API hostname and socket peer; consistent hostname required. Hosted `__Host-dl_refresh` always Secure. Strict Origin validation and route-scoped credentialed CORS; documented HTTPS sibling domains are same-site. Unrelated deployment domains require separate approval.
- Login limits: five failures/email-IP/15 minutes and twenty attempts/IP/15 minutes; refresh sixty/IP/minute. HMAC-obscured keys, IPv6 grouping, process-local storage. No implicit proxy trust.
- Extend audit actions with login success/failure, refresh success/reuse; fixed metadata only. Unknown failed-login subjects may be null. Success/reuse audit and security changes are transactional. Failed-login audit failure produces a sanitized operational log without changing credential response.

## Exact Files Changed

```text
apps/api/.env.example
apps/api/package.json
apps/api/src/app.ts
apps/api/src/config/auth.ts
apps/api/src/config/env.ts
apps/api/src/middleware/auth-origin.ts
apps/api/src/middleware/authenticate.ts
apps/api/src/modules/audit/audit.model.ts
apps/api/src/modules/audit/audit.repository.ts
apps/api/src/modules/auth/access-token.service.ts
apps/api/src/modules/auth/auth.routes.ts
apps/api/src/modules/auth/login-rate-limit.ts
apps/api/src/modules/auth/login.controller.ts
apps/api/src/modules/auth/login.repository.ts
apps/api/src/modules/auth/login.schema.ts
apps/api/src/modules/auth/login.service.ts
apps/api/src/modules/auth/password.service.ts
apps/api/src/modules/auth/refresh-cookie.ts
apps/api/src/modules/auth/refresh-token.service.ts
apps/api/src/types/express.d.ts
apps/api/tests/access-token.test.ts
apps/api/tests/auth-audit.test.ts
apps/api/tests/auth-routes.test.ts
apps/api/tests/authenticate.test.ts
apps/api/tests/env.test.ts
apps/api/tests/foundation.test.ts
apps/api/tests/logging.test.ts
apps/api/tests/login-rate-limit.test.ts
apps/api/tests/login-routes.test.ts
apps/api/tests/login.integration.ts
apps/api/tests/login.test.ts
apps/api/tests/password.test.ts
apps/api/tests/refresh-cookie.test.ts
docs/DEVELOPMENT_ROADMAP.md
docs/features/F008-login-access-refresh-tokens.md
package-lock.json
```

## Acceptance Criteria

- Canonical login/refresh envelopes, errors and safe user projection; no secret JSON/log output.
- Enforced account eligibility, JWT claims and lifetime, fixed session expiry, rotation and strict reuse revocation.
- Cookie/Origin/CORS/local-exception security and independent rate budgets.
- Transactional audit behavior, safe dependency errors and no automatic collection/index creation.
- Existing regressions, new offline/HTTP tests, build, lint, typecheck and formatting pass.
- Database atomicity, index enforcement and concurrency require separately authorized real integration verification.

## Verification / Unresolved Issues

2026-09-29 offline verification: **83/83 API tests PASS**, including F004/F005/F006/F007 regressions and F008 unit/HTTP checks. Root build, lint, typecheck and formatting PASS; API build/typecheck rerun after final source corrections. HTTP smoke covers login/refresh envelopes, Origin rejection, cookie rotation/clearing, scoped credentialed preflight, unchanged health and 404. At that offline checkpoint, the integration suite was typechecked but not yet executed; the separately approved run is recorded below.

Dependencies: jose 6.2.12 and cookie 2.0.1; Node 24 compatible; install audit reported zero vulnerabilities. Initial npm network and tsx sandbox failures were resolved by authorized external execution; no security settings changed. Actual signing configuration remains an owner-managed runtime prerequisite; actual .env was not read or edited.

Diff/security review: all 36 changed/new files are approved paths; no changes to F005 TLS or F006 models. No actual secrets found; scanner URI matches were pre-existing synthetic env-test fixtures. Actual .env remains ignored. No files staged or committed. Offline checks made no database connections/writes; the later owner-approved isolated run used synthetic local data only. No Atlas operations or real emails.

## Isolated Integration Evidence - 2026-09-30

Owner-approved `tests/login.integration.ts`: **7/7 PASS, exit code 0** (six subtests and parent). Suite duration 8.5 seconds; total setup/run/cleanup 13.1 seconds, within the 90-second suite and 120-second external deadlines.

- PASS: transactional login and audit persistence; multiple independent sessions; fixed 30-day expiry with no extension on rotation.
- PASS: rotation and strict reuse detection. Concurrent refresh produced one successful rotation, one rejected reuse, and a revoked session; the winning replacement could not subsequently refresh.
- PASS: disabled-account protection, conditional expired-suspension handling, preservation of revoked sessions and stale-account rejection.
- PASS: login and refresh transaction rollback on audit failure; sensitive-field query projections; MongoDB-enforced refresh-token hash uniqueness.
- PASS: application-level expiry rejection with the record confirmed present before and after rejection; this does not establish TTL deletion.
- PASS: unused port 27018, verified unique temporary directory, existing MongoDB 8.2 executable, loopback-only f008-test replica set, empty deeplearner-f008-test database and explicit write opt-in. Only users/sessions/auditLogs application collections and declared indexes were created, using synthetic data.
- PASS: owned test collections removed, Mongoose/runner disconnection, owned MongoDB stopped, port released and verified temporary directory removed. Repository hashes/status were unchanged by execution. No persistent settings or installed services changed.

## P2 Resolution / Final Verification - 2026-09-30

The P2 malformed CORS configuration issue is resolved: `URL.canParse()` guards URL construction, preserving the existing sanitized Zod configuration-error path and valid CORS/LOCAL loopback-cookie behavior. The regression checks malformed origins with both cookie-security settings, field identification and absence of sentinel values/raw URL-parser errors. Focused regression PASS; final offline API suite **84/84 PASS**. Root build, lint, typecheck, formatting and security/diff review PASS. The previously authorized isolated MongoDB result remains **7/7 PASS**; no database rerun was needed for this correction.

Final read-only code review found **no actionable P0, P1, P2 or P3 findings**. Malformed URL-parser exceptions/stacks are prevented; Node may still produce standard stack output for the intentionally thrown sanitized configuration Error. This is not a claim that all startup stacks are suppressed.

## Remaining Limitations / Owner Approval

Actual MongoDB TTL deletion remains **NOT_VERIFIED**. Real browser login/refresh-cookie behavior is **NOT_VERIFIED**; frontend integration is outside F008. Normal Atlas startup without temporary overrides remains **NOT_VERIFIED** under F005; local integration does not verify Atlas writes. Rate limiting remains single-process and resets on restart. Existing access JWTs remain usable until expiry after session revocation; strict concurrent refresh can invalidate the replacement returned by the winning request. Actual signing configuration remains owner-managed.

Owner completion approval recorded on 2026-09-30: F008 is APPROVED_COMPLETE within its backend-only scope and the limitations above. F005-F007 remain APPROVED_COMPLETE. F009 remains NOT_STARTED and requires separate approval; no next-feature implementation is authorized.

# F009 — Logout + Session Management

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion within the agreed backend-only scope on 2026-10-01 after reviewing implementation, verification evidence, integration results, documentation and final code review. Depends on F008 and existing F004–F007 foundations. Canonical references: [API](../API_DESIGN.md#177-logout-current-session), [database](../DATABASE_DESIGN.md), [architecture](../SYSTEM_ARCHITECTURE.md), [roadmap](../DEVELOPMENT_ROADMAP.md).

## Scope / Approved Decisions

POST `/api/v1/auth/logout` authenticates the current refresh digest and revokes that session. POST `/api/v1/auth/logout-all` uses the verified access JWT subject and revokes its active sessions. Preserve canonical F004 responses, strict Origin validation and scoped credentialed CORS on both endpoints. Reuse existing cookie helpers, including the restricted LOCAL loopback exception.

- Current logout is idempotent for missing, malformed, unknown, mismatched and already-revoked cookies. No arbitrary-secret revocation or historical digests. Clear cookies only after successful processing; dependency failures retain them and return sanitized errors.
- Revocation and corresponding audit are transactional. Never delete sessions, extend expiry or change refresh digests. Logout-all coordinates with login/refresh through the existing User version only; no account-status/profile changes or reactivation.
- Logout-first prevents later refresh. Refresh-first leaves the newly rotated session intact when logout carries the old cookie; that stale cookie is cleared with generic success. Future clients must serialize operations and discard late refresh responses.
- Logout-all revokes unrevoked sessions with expiry strictly after the operation time. A later valid login may create a new session. Existing access JWTs remain valid until their fixed expiry (up to 15 minutes).
- Audit AUTH_LOGOUT only on an actual revocation, with REFRESH_TOKEN source and session ID. AUTH_LOGOUT_ALL records ACCESS_TOKEN source and actual revoked count, including zero. Non-null matching subject IDs and existing safe metadata constraints apply.
- No new dependencies, environment variables, collections, indexes or logout-specific rate limits. No session listing, arbitrary per-device endpoint, UI integration or F010 work.

## Exact Files Changed

Created:

```text
docs/features/F009-logout-session-management.md
apps/api/src/modules/auth/logout.schema.ts
apps/api/src/modules/auth/logout.controller.ts
apps/api/src/modules/auth/logout.service.ts
apps/api/src/modules/auth/logout.repository.ts
apps/api/tests/logout.test.ts
apps/api/tests/logout-routes.test.ts
apps/api/tests/logout.integration.ts
```

Modified:

```text
docs/DEVELOPMENT_ROADMAP.md
docs/SYSTEM_ARCHITECTURE.md
apps/api/src/app.ts
apps/api/src/modules/auth/auth.routes.ts
apps/api/src/modules/audit/audit.model.ts
apps/api/src/modules/audit/audit.repository.ts
apps/api/tests/auth-audit.test.ts
```

Architecture changes only reconcile the logout-all wording. User coordination explicitly disables automatic timestamps so only the version changes.

## Acceptance Criteria

- Canonical endpoint contracts, authenticated user scoping, idempotency and safe cookie behavior.
- Transactional revocation/audit, approved concurrency outcomes and no revoked-session restoration.
- Preserve status, profile, digest, expiry, JWT behavior, F005 TLS and F004–F008 behavior.
- Offline unit/HTTP tests, full API regressions, build, lint, typecheck, formatting and scope/secrets review pass.
- Database atomicity, rollback and concurrency require separately approved isolated integration execution.

## Verification / Limitations

2026-09-30: implementation and authorized offline checks complete. PASS: **89/89 offline API tests**, including F004–F008 regressions, new logout service/HTTP tests and audit validation. Root build, lint, typecheck, formatting and diff/scope/secrets checks PASS. Initial sandbox test launch failed before execution with `uv_os_get_passwd` ENOMEM; authorized external rerun passed. HTTP checks cover Origin/CORS, JWT subject scoping, malformed/duplicate cookies, cookie clearing, no-store responses, dependency failure without cookie clearing, and unchanged health/404 behavior. No dependencies added, files staged, database operations or emails sent.

2026-10-01 owner-approved isolated MongoDB integration: **8/8 PASS** (seven subtests and parent); child explicitly reported **SUITE_EXIT=0**. Used the existing MongoDB executable, unused port 27018, loopback-only `f009-test` replica set, empty `deeplearner-f009-test`, synthetic data and explicit write opt-in. Only users/sessions/auditLogs and declared indexes were created. Suite duration 12.5 seconds, overall 20.1 seconds; neither the 90-second suite timeout nor 120-second external deadline was reached.

- PASS: current-session revocation/audit persistence, repeated logout idempotency, unknown/mismatched-cookie no-ops, logout-all counts and user/session isolation.
- PASS: audit-failure rollback, sensitive-field projections, disabled/suspended account-state preservation and User coordination changing only `__v`.
- PASS: logout/refresh behavior, including separately tested refresh-first stale-cookie behavior. Concurrent current logout/refresh and logout-all/refresh both observed refresh rejection; logout-all/login observed one existing session revoked with the later login preserved. These observations do not establish every possible concurrent ordering.
- PASS: revoked sessions cannot refresh; original session expiry/digest preserved; Mongoose disconnection, owned disposable MongoDB shutdown, port release and verified temporary-directory removal. Repository files unchanged by execution; no Atlas operations or real emails.

Runner-reporting limitation: the outer PowerShell wrapper returned exit code 1 only because its runner `ExitCode` property was empty. The child reported `SUITE_EXIT=0` and all eight integration tests passed. This is not an application test failure; cleanup was independently confirmed. No automatic rerun or patch occurred.

Final read-only code review found **no actionable P0, P1, P2 or P3 findings** and recommended READY_FOR_REVIEW within the approved scope. Existing build/lint/typecheck/formatting and scope/secrets evidence remains PASS; no additional tests were run for this documentation transition.

Actual TTL deletion, deployed browser cookie flow and normal Atlas startup without temporary overrides remain NOT_VERIFIED. Refresh-first stale-cookie logout intentionally leaves the newly rotated session active. Existing access JWTs remain valid until normal expiry. Existing rate limiting remains single-process. Owner completion approval on 2026-10-01 accepts F009 as APPROVED_COMPLETE within this scope and these limitations. F005–F008 remain APPROVED_COMPLETE; F010 remains NOT_STARTED.

# F012 - `/users/me` + Student Profile

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion within the backend-only scope on 2026-10-06. Backend-only implementation was approved on 2026-10-05. Depends on F008; preserves F006-F011. References: [roadmap](../DEVELOPMENT_ROADMAP.md), [API](../API_DESIGN.md), [F006 reconciliation](F006-user-session-models.md), [F011 transactions](F011-google-authentication-account-linking.md).

## Scope / Approved Decisions

GET/PATCH `/api/v1/users/me` require existing stateless access-JWT authentication and a currently verified ACTIVE user. Identity comes only from JWT sub; no live-session check or automatic reactivation. Both roles may access only themselves. Existing JWTs retain their normal expiry after logout.

PATCH permits firstName/lastName and approved profile leaf fields only. Omission preserves values; supplied arrays replace, including empty arrays. Reject null, unknown/dotted/operator keys, empty request and empty-only profile patch. Names trim to 1-80 characters; existing enums, unique goals, normalized ObjectIds (maximum 50), integer daily goal 5-240. Technology syntax only, no existence query. Optional profile stays absent until provided; no onboarding completion flag.

Explicit safe DTO: id, names, email, emailVerified, role, plan, status, stable PASSWORD/GOOGLE authMethods, profile (null when absent), createdAt. Database projection computes capabilities without returning hashes or provider subjects. No sessions, version or suspension internals. Both routes use no-store and F004 envelopes.

PATCH and USER_PROFILE_UPDATED audit commit atomically through startSession/withTransaction/awaited endSession in finally. Audit category USER_ADMIN, matching actor/resource IDs, requestId and allowlisted changedFields only. Preserve unrelated fields; concurrent disjoint edits merge, same-field edits use last committed value. Strict schemas remain unchanged.

GET retains existing CORS/no-Origin behavior; PATCH uses exact approved Origin and LOCAL safeguards. No cookies or credentialed-CORS expansion. Local injectable limiter defaults: GET 120/user/15min, PATCH 30/user/15min, combined IP 300/15min; HMAC keys and IPv6 grouping. Single-process limitation remains.

## Exact Files

Create:

```text
docs/features/F012-current-user-student-profile.md
apps/api/src/modules/users/user.routes.ts
apps/api/src/modules/users/user.controller.ts
apps/api/src/modules/users/user.service.ts
apps/api/src/modules/users/user.repository.ts
apps/api/src/modules/users/user.schema.ts
apps/api/src/modules/users/user.dto.ts
apps/api/src/modules/users/user-rate-limit.ts
apps/api/tests/user-profile.test.ts
apps/api/tests/user-profile-routes.test.ts
apps/api/tests/user-profile-rate-limit.test.ts
apps/api/tests/user-profile.integration.ts
```

Modify:

```text
apps/api/src/app.ts
apps/api/src/modules/audit/audit.model.ts
apps/api/src/modules/audit/audit.repository.ts
apps/api/tests/auth-audit.test.ts
docs/API_DESIGN.md
docs/DEVELOPMENT_ROADMAP.md
```

## Acceptance Criteria

- Authenticated self-only GET/PATCH, current eligibility, safe projection and F004 contracts.
- Strict validation, leaf merge and unrelated/security field preservation.
- Transactional audit, rollback, concurrency and session cleanup.
- Origin/CORS/no-cookie policy and bounded rate limits.
- Offline regressions, build/lint/typecheck/formatting/security review; separately approved isolated database verification.

## Verification / Limitations

2026-10-05 offline evidence: API suite **116/116 PASS**, including F004-F011 regressions; root build/lint/typecheck/formatting PASS. HTTP tests used injected services. Initial test response typing errors were corrected before successful checks. Scope/secrets review matched the 18 approved paths; no credential-pattern matches or staged files.

2026-10-06 final evidence accepted by owner:

- Isolated MongoDB integration: **5/5 scenarios PASS**; child/wrapper exits **0/0**.
- Safe projections and PASSWORD/GOOGLE authMethods; absent profile; profile creation, leaf merge, array replacement/clearing: PASS.
- Credentials/providers/email/role/plan/status/createdAt preservation, cross-user isolation and ACTIVE/verified account safeguards: PASS.
- Transactional USER_PROFILE_UPDATED audit persistence/rollback, concurrent disjoint/same-field updates and explicit session cleanup: PASS.
- Post-correction API typecheck, focused lint/formatting and diff review: PASS. Existing root build/lint/typecheck/formatting evidence remains PASS.
- Owned MongoDB shutdown, port release and temporary-directory removal: PASS; deadlines respected. Intermediate runner ExitCode property was unavailable; child explicitly reported SUITE_EXIT=0 and the PowerShell wrapper exited 0.
- Final read-only code review: no actionable P0, P1, P2 or P3 findings.

Resolved test issue: the initial integration failure assumed positional audit query ordering, which MongoDB did not guarantee. The test now locates audits by fixed requestId values (`create-profile`, `clear-goals`) and asserts each independently. No production behavior or query semantics changed; the corrected full suite passed 5/5.

Normal Atlas startup and browser/frontend integration remain **NOT_VERIFIED**. Technology-ID existence validation is intentionally deferred. Single-process rate limiting remains. No new dependencies, User/Session model changes, collection/index definitions or env variables; no actual env/DNS/TLS changes, Atlas/provider calls, frontend, set-password, email changes, provider unlinking, admin management or F013+.

## Isolated Integration Scope

Owner-authorized run used only tests/user-profile.integration.ts, child-only LOCAL/F012 write-opt-in variables, existing MongoDB 8.2 in non-admin host PowerShell, unused port 27018, owned TEMP directory, loopback-only f012-test replica set and empty deeplearner-f012-test. Only users/auditLogs and declared indexes; synthetic data, no external calls. Suite/wrapper deadlines: 90/120 seconds. Further database execution requires separate approval.

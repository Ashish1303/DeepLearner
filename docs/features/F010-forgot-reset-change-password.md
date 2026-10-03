# F010 — Forgot / Reset / Change Password

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion on 2026-10-03 within the agreed backend-only scope, following the authorized review transition. Owner approved the finalized backend-only plan on 2026-10-02, including the selective persistence-failure enumeration limitation. Depends on F008 and reuses approved F006–F009 foundations. Sources: [API](../API_DESIGN.md), [database](../DATABASE_DESIGN.md), [architecture](../SYSTEM_ARCHITECTURE.md), [roadmap](../DEVELOPMENT_ROADMAP.md).

## Scope / Approved Decisions

POST `/api/v1/auth/forgot-password`, `/reset-password`, `/change-password` only. No frontend reset page, set-password, Google flow or F011 work.

- Recovery requires verified ACTIVE status and an existing password hash, including linked accounts. Unknown/passwordless/ineligible accounts receive the same generic forgot response and no token/email. Reset cannot create a first password, verify email or reactivate any account.
- Reset tokens: 32 random bytes, SHA-256 digest-only storage, 30-minute expiry, explicit unused/expiry checks independent of TTL. Superseded unused tokens are deleted; successful reset consumes outstanding tokens.
- Common prerequisite checks and transactions precede eligibility branching. Pre-commit persistence failures return sanitized dependency errors. After commit, disabled/failed/unconfirmed delivery preserves the token and generic 202. Selective write failures can differ from ineligible read-only paths; perfect failure-path indistinguishability is not claimed.
- Reset transaction replaces the hash, consumes tokens, revokes all unrevoked sessions and audits. Clear cookie only after successful commit; confirmation email only afterward. Token reset may reuse the old password.
- Change requires verified ACTIVE status, valid JWT/live current session and an existing password. Verify current password, reject identical replacement, recheck credentials/session transactionally, invalidate reset tokens and revoke other sessions. Preserve current expiry; never restore revoked sessions.
- Preserve Argon2id parameters and 10–128-character policy without composition rules. Existing access JWTs retain normal expiry after session revocation.
- Reset/change use strict Origin checks; only reset extends credentialed CORS. LOCAL cookie and F005 TLS exceptions remain unchanged.
- Forgot limits: independent email/IP 3/hour; reset 10/IP/15 minutes; change 5/user/15 minutes plus 20/IP/15 minutes. HMAC-obscured keys, IPv6 grouping and process-local storage. New limiter variables use safe examples only.
- Transactional audits: AUTH_PASSWORD_RESET_REQUESTED (EMAIL_RECOVERY), AUTH_PASSWORD_RESET (RESET_TOKEN/count), AUTH_PASSWORD_CHANGED (ACCESS_TOKEN/session/count). No secret/arbitrary metadata.
- Injectable recovery emails reuse Resend transport safeguards and disabled LOCAL delivery. Fragment reset URL under WEB_ORIGIN; confirmation contains no token. Provider acceptance is not guaranteed delivery. No actual emails authorized.

## Exact Files Changed

Created:

```text
docs/features/F010-forgot-reset-change-password.md
apps/api/src/modules/auth/password-recovery.schema.ts
apps/api/src/modules/auth/password-recovery.controller.ts
apps/api/src/modules/auth/password-recovery.service.ts
apps/api/src/modules/auth/password-recovery.repository.ts
apps/api/src/modules/auth/password-recovery-rate-limit.ts
apps/api/src/modules/auth/password-reset-token.service.ts
apps/api/src/common/email/password-recovery-email.ts
apps/api/tests/password-recovery.test.ts
apps/api/tests/password-recovery-routes.test.ts
apps/api/tests/password-recovery-rate-limit.test.ts
apps/api/tests/password-recovery-email.test.ts
apps/api/tests/password-recovery.integration.ts
```

Modified:

```text
docs/DEVELOPMENT_ROADMAP.md
docs/API_DESIGN.md
apps/api/.env.example
apps/api/src/app.ts
apps/api/src/config/auth.ts
apps/api/src/config/env.ts
apps/api/src/modules/auth/auth.routes.ts
apps/api/src/modules/audit/audit.model.ts
apps/api/src/modules/audit/audit.repository.ts
apps/api/src/common/email/email.service.ts
apps/api/tests/auth-audit.test.ts
apps/api/tests/env.test.ts
apps/api/tests/verification-email.test.ts
```

No new npm dependencies, model/index declarations or actual .env changes. Existing verification-email behavior must remain unchanged.

## Acceptance Criteria

- Final canonical envelopes, eligibility, generic forgot behavior and distinct persistence/delivery failures.
- Secure one-time tokens, transactional password/token/session/audit mutations, validated current-session preservation and approved race behavior.
- No first-password creation, reactivation, secrets exposure, permissive CORS or F005–F009 regressions.
- Offline tests, full regressions, build, lint, typecheck, formatting and security/diff review pass.
- Real atomicity, index and concurrency verification requires separate isolated integration approval.

## Verification / Unresolved Issues

2026-10-02: approved backend implementation complete; **103/103 offline API tests PASS**, including F004–F009 regressions. Root build, lint, typecheck and formatting PASS. Initial root build could not fetch unchanged Next.js Google Fonts in the sandbox; authorized network-enabled rerun passed without configuration changes. New HTTP checks cover canonical responses, dependency failures without cookie clearing, JWT subject/session scoping, strict Origin, credentialed reset-only CORS and absence of set-password. Fake email tests preserve F007 behavior and distinguish acceptance from delivery. No real emails or database operations occurred.

Final diff/security review: exactly 26 approved paths; no new packages, model/index declarations, actual .env edits, persistent DNS/TLS changes or staged files. Secret scan matched only unchanged synthetic URI fixtures in env tests, not new secrets. Application code retains current-session expiry/digest; change-password coordinates through the current Session version as well as the User write to conflict with concurrent revocation.

2026-10-03: owner-authorized host-context integration **13/13 PASS** (12 subtests plus parent), child exit **0**, wrapper exit **0**. Same-password reset, successful reset metadata preservation and successful change-password metadata preservation PASS. Coverage includes eligibility/passwordless safeguards, token replacement/30-minute expiry/replay, expiry rejection while the record exists, password updates, session revocation/current-session preservation, audit-failure rollback, digest uniqueness, sensitive projections and observed concurrent operations. Metadata comparisons preserve role, plan, status, providers, verification state, profile and unrelated fields except intentional hash/update-timestamp/version changes.

Only the disposable loopback `f010-test` replica set and initially empty `deeplearner-f010-test` database were used, with explicit write opt-in, approved collections/indexes, synthetic data and fake email. Execution finished in 17.9 seconds within 90/120-second deadlines. Mongoose disconnection, owned-process shutdown, port release and temporary-directory cleanup PASS; repository unchanged. Earlier integration evidence: 12/12 PASS before the two coverage refinements.

Runtime clarification: the earlier sandbox rerun failed before test execution with `ERR_SYSTEM_ERROR` / `ENOMEM` / `uv_os_get_passwd` (child/wrapper 1). Minimal Node user-info/tsx probes reproduced it inside the sandbox; the same probes passed in ordinary non-administrator host PowerShell. The authorized host rerun then passed 13/13. This is an execution-context limitation, not an established F010 application defect.

Final dedicated read-only review: **no actionable P0, P1, P2 or P3 findings**; security/scope review PASS. No additional tests were run for this documentation transition.

**NOT_VERIFIED:** actual MongoDB TTL deletion, real email delivery, deployed browser password recovery, normal Atlas startup without temporary overrides and unobserved concurrency orderings. Observed host races: reset/refresh and change/other-refresh completed refresh before its resulting session became unusable; reset/login completed login whose session was subsequently revoked; forgot/change left zero outstanding tokens. Timing/failure-path enumeration protection does not claim perfect indistinguishability; rate limiting remains single-process. Reset UI/set-password remain out of scope. Owner completion approval is dated 2026-10-03; F011 remains NOT_STARTED.

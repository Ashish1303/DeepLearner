# F011 — Google Authentication + Account Linking

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion within the backend-only scope on 2026-10-05. Backend-only implementation was approved on 2026-10-03. Depends on F008; preserves F005–F010. Canonical references: [API](../API_DESIGN.md), [architecture](../SYSTEM_ARCHITECTURE.md), [database](../DATABASE_DESIGN.md), [F006 field reconciliation](F006-user-session-models.md), [roadmap](../DEVELOPMENT_ROADMAP.md).

## Scope / Approved Decisions

POST `/api/v1/auth/google` accepts only a Google credential; supported Google library verifies signature, issuer, audience and expiry; require verified email and subject. Resolve subject first, then normalized unique email. Existing-email auto-link requires Gmail or verified email with hosted-domain claim. Reject pending, unverified, non-authoritative or conflicting linking. Never reactivate DISABLED; only F008's exact eligible expired-suspension handling applies. Existing linked subjects remain authoritative if their email changes; never merge accounts.

New users require valid first/last-name claims; create STUDENT/FREE/ACTIVE, verified, passwordless users without inventing names. Preserve existing names, profile, password, role, plan, providers and email except appending an approved provider identity. Only approved login metadata/version/timestamps and eligible suspension activation change.

Use existing 15-minute JWTs, fixed 30-day digest-only refresh sessions and cookie safeguards. Transactionally create/link user, coordinate through User writes, create session and append AUTH_GOOGLE_LOGIN / AUTH_PROVIDER_LINKED audits. Issue cookies only after commit. Provider-linked audit applies to existing-account linking. No raw credentials, subject IDs or secrets in responses/logs/audits. Strict Origin JSON flow; no nonce challenge or claim of single-use Google credentials.

Errors: canonical credential-invalid/unverified-email/account errors; AUTH_GOOGLE_LINKING_NOT_ALLOWED (403), AUTH_GOOGLE_PROFILE_INCOMPLETE (400); sanitized dependency errors (503). Missing GOOGLE_CLIENT_ID disables Google only. No client secret. Google rate limit 10/15 minutes/IP, IPv6 grouping, process-local storage. Approved google-auth-library@11.1.0 installed (Node >=22, compatible with Node 24); npm audit reported zero vulnerabilities. No new models/index declarations, frontend, set-password or F012.

## Exact Files

Create:

```text
docs/features/F011-google-authentication-account-linking.md
apps/api/src/modules/auth/google-identity.service.ts
apps/api/src/modules/auth/google-auth.schema.ts
apps/api/src/modules/auth/google-auth.controller.ts
apps/api/src/modules/auth/google-auth.service.ts
apps/api/src/modules/auth/google-auth.repository.ts
apps/api/src/modules/auth/google-auth-rate-limit.ts
apps/api/tests/google-identity.test.ts
apps/api/tests/google-auth.test.ts
apps/api/tests/google-auth-routes.test.ts
apps/api/tests/google-auth-rate-limit.test.ts
apps/api/tests/google-auth.integration.ts
```

Modify:

```text
apps/api/package.json
package-lock.json
apps/api/.env.example
apps/api/src/app.ts
apps/api/src/config/env.ts
apps/api/src/config/auth.ts
apps/api/src/modules/auth/auth.routes.ts
apps/api/src/modules/audit/audit.model.ts
apps/api/src/modules/audit/audit.repository.ts
apps/api/tests/env.test.ts
apps/api/tests/auth-audit.test.ts
docs/API_DESIGN.md
docs/DEVELOPMENT_ROADMAP.md
```

## Acceptance Criteria

- Verified Google identities, approved linking/status matrix and generic safe errors.
- Account preservation, correct 200/201 envelope, no refresh/provider secrets in JSON.
- Atomic identity/session/audit writes, unique-index prerequisites, bounded duplicate-race resolution and existing session lifecycle compatibility.
- Strict Origin/scoped CORS, secure cookies, bounded provider retrieval and IP rate limiting.
- Local signed fixtures and fake provider tests, full offline regressions, build/lint/typecheck/format and security/diff review.
- Separately approved disposable-replica integration establishes real uniqueness, transactions and concurrency; mocks do not prove these.

## Verification / Limitations

Historical baseline (2026-10-03): 110/110 offline API tests and root build/lint/typecheck/formatting passed. Initial optional-client-ID typing and audit-export assertion issues were corrected within approved files. Dependency review reported zero vulnerabilities; google-auth-library and 20 transitive packages were added without changing existing versions, using --ignore-scripts. The transitive node-domexception deprecation warning remains. Scope/secrets review covered 25 approved paths; an unchanged synthetic URI fixture was the only credential-pattern match.

Final evidence accepted by the owner for completion on 2026-10-05:

- Offline API suite: **110/110 PASS**, including F004-F010 regressions.
- Isolated MongoDB integration: **8/8 scenarios PASS** (parent also passed); child/wrapper exits **0/0**.
- Concurrent new-account creation/existing-account linking, audit rollback and explicit session cleanup on success/failure: **PASS**.
- Account safeguards/preservation, uniqueness, sensitive projections and session lifecycle compatibility: **PASS**.
- Root build, lint, typecheck and formatting: **PASS**. Final code review: **no actionable P0, P1, P2 or P3 findings**.
- Owned MongoDB shutdown, port release and temporary-directory removal: **PASS**; deadlines respected.

Resolved integration defect: concurrent creation/linking initially failed with a sanitized 503. Safe diagnostics confirmed Mongoose StrictModeError on __v, traced to connection.transaction() rollback handling. The owner-approved F011-only correction uses startSession() -> withTransaction() -> awaited endSession() in finally. Strict schemas, __v coordination, writes, audits and bounded duplicate-key re-resolution remained unchanged. The corrected full integration suite passed; temporary diagnostic instrumentation was removed.

Actual TTL deletion, real Google/browser behavior and normal Atlas startup without temporary overrides remain **NOT_VERIFIED**. No real Google calls, emails, Atlas operations or persistent configuration changes occurred. F005 TLS and F006 models remain unchanged. Google credential replay is not prevented by a server nonce; rate limiting remains single-process. Only observed concurrency outcomes are verified; the logout-all race observed the new session being created after logout-all.

## Isolated Integration Evidence

Owner-authorized run used MongoDB 8.2 in non-administrator host PowerShell, unused port 27018, a uniquely owned temporary directory, loopback-only replica set f011-test and empty deeplearner-f011-test. Child-only LOCAL configuration and explicit F011 write opt-in were used. Only users, sessions and auditLogs plus their declared indexes were created, with synthetic identities and a fake Google verifier. The suite retained its 90-second timeout and 120-second external deadline. Cleanup removed only owned resources. No further execution is authorized by this record.

# F006 — User + Session Models

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion, the resolved P2 correction and final verification results on 2026-09-28. Depends on [F005](F005-mongodb-connection-foundation.md), APPROVED_COMPLETE.

## Scope / References

Persistence-only User, Session, EmailVerificationToken and PasswordResetToken models, local TypeScript types, schema/index declarations and offline tests. Follow [database design](../DATABASE_DESIGN.md), [API design](../API_DESIGN.md), [architecture](../SYSTEM_ARCHITECTURE.md) and [roadmap](../DEVELOPMENT_ROADMAP.md), with the owner-approved field alignment below.

No endpoints, services, password hashing, JWTs, OAuth, email delivery, frontend integration, migrations, index synchronization, collection creation or database writes. No new dependencies.

## Approved Decisions

- Users store normalized unique email, firstName/lastName (derive display name), STUDENT/ADMIN role, FREE/PREMIUM plan, and PENDING_VERIFICATION/ACTIVE/DISABLED/SUSPENDED status. Retain verification, suspension, login and creation/update metadata.
- Password capability comes from an optional Argon2id passwordHash. Google identities live in authProviders; password-only, Google-only and linked accounts are supported. Never store Google access/refresh tokens. Reject duplicate provider identities within a user; a partial compound unique index declares cross-user identity uniqueness.
- One optional embedded profile contains onboarding preferences; it remains absent before onboarding. Daily study goal is an integer from 5–240 minutes. Reject duplicate technology IDs and learning goals.
- Sessions support multiple devices, SHA-256 refresh-token digests, bounded device metadata, hashed IP metadata, expiry, revocation and last-used timestamps. Stable session IDs plus replaceable hashes support future rotation/reuse detection; neither behavior is implemented here.
- Separate verification/reset collections store SHA-256 token digests, user references, expiry, creation time and nullable usedAt. No raw tokens. Sensitive hashes and provider identities are excluded from ordinary selection and document serialization.
- Types and nested schemas stay beside owning models. Use F005's Mongoose instance, with buffering, automatic collection creation and automatic indexing disabled. Preserve local-only TLS and strict verified TLS elsewhere.
- Declare unique email/token indexes, user status/plan/role plus creation-time listing indexes, session user/revocation lookup, token user lookup, and expiresAt TTL indexes. TTL cleanup is asynchronous; future services must enforce expiry, consumption and revocation independently.

## Exact Files Changed

- `apps/api/src/modules/users/user.model.ts`
- `apps/api/src/modules/auth/session.model.ts`
- `apps/api/src/modules/auth/email-verification-token.model.ts`
- `apps/api/src/modules/auth/password-reset-token.model.ts`
- `apps/api/tests/user-model.test.ts`
- `apps/api/tests/session-model.test.ts`
- `apps/api/tests/auth-token-models.test.ts`
- This document and `docs/DEVELOPMENT_ROADMAP.md`.

## Acceptance Criteria

- Valid account/provider combinations, normalization, defaults, enum/bound validation and optional profile work offline; malformed fields and duplicate array identities fail.
- Session and one-time token schemas accept lifecycle metadata and reject malformed digests/references; nullable usedAt remains supported.
- Sensitive-field selection declarations and serialization protections are tested, including explicitly loaded secrets.
- Exact unique, partial, compound and TTL index declarations are tested without executing them.
- Models use the existing disconnected instance without opening connections or provisioning database objects.
- Existing F004/F005 regressions, model tests, build, lint, typecheck and formatting pass. Review final diff for scope/secrets.

## Verification / Limitations

Final PASS: User model tests 10/10; `npm.cmd test --workspace=@deeplearner/api` — 53/53 tests (22 model tests and 31 F004/F005 regressions). Includes disconnected model validation, account combinations, profile bounds/duplicates, sensitive selection declarations and serialization, projected credential-change protection, exact index declarations and the resolved P2 regressions. The initial 50-test suite passed after correcting a test to await nested-schema validation; all original tests still pass.

PASS: `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run format:check`, and explicit feature-document formatting check. Tests/build used the existing approved sandbox escalation for Windows tsx and build network access. Scope/secrets review covered all nine changed/new files; no dependencies, configuration, API contracts or F005 code changed. No secrets or local environment files staged; `.env` remains ignored.

Database-enforced uniqueness: NOT_VERIFIED. Actual query projections: NOT_VERIFIED. TTL execution: NOT_VERIFIED. Actual index creation also remains NOT_VERIFIED. No database connection, write or provisioning was performed. Future repositories must deliberately select both authentication capabilities before credential changes and use validated update flows; query updates do not run document hooks. Document transforms do not protect raw/lean/aggregation results, which require explicit public DTOs. No foreign-key or cascade behavior is implied by references. Models validate digest format, not token entropy or hashing correctness; future services own generation/hashing and secure IP digest derivation.

Atlas TLS/connectivity: DEFERRED — NOT_VERIFIED under F005 owner approval. Windows external OS signal delivery also remains unverified; F005 handlers were tested in-process. No F005 policy or deferred criterion is changed. No implementation deviations or blockers.

## Approved P2 Profile-Array Correction

Independent review reproduced acceptance of `[null]` in both profile arrays: element schemas lacked `required`, while array validators checked duplicates/length only. Added `required: true` to each learning-goal String element and technology ObjectId element. Existing enum/cast validation rejects malformed values; defaults, optional profile, empty arrays, uniqueness and bounds remain unchanged.

Changed only `apps/api/src/modules/users/user.model.ts`, `apps/api/tests/user-model.test.ts` and this document. Three regression tests cover null/undefined/malformed elements (including null mixed with valid values), absent profiles, default/explicit empty arrays and valid arrays.

PASS: User model tests 10/10; complete API suite 53/53 (all original 50 still pass); root build, lint, typecheck and formatting. An initial test-only type error was corrected using `Array.from` rather than an untyped Mongoose array method; final checks pass. Explicit document formatting and scope review pass. No dependencies, database operations, session/token changes, F005 changes or roadmap edits in this correction. Owner accepted the P2 resolution and regression results on 2026-09-28.

## Completion — 2026-09-28

Owner approved the four persistence models, schema/index declarations, sensitive-field protection and offline tests, including the resolved profile-array validation issue. F006 is APPROVED_COMPLETE with the verification limitations above preserved. This closure changes documentation/status only. F007 — Email Registration + Verification is the next proposed feature, remains NOT_STARTED and requires separate planning and owner authorization.

## F007 Compatibility Correction — 2026-09-29

Owner authorized the narrow password-hash validator correction: installed `argon2@0.45.1` emits `m,p,t`; the previous validator accepted only `m,t,p`. Both orders now pass without rewriting hashes. Algorithm/version, positive parameter values and nonempty salt/hash representation checks remain unchanged; no other schema fields, indexes or persistence settings changed.

Changed `apps/api/src/modules/users/user.model.ts`, `apps/api/tests/user-model.test.ts`, `apps/api/tests/password.test.ts` and F006/F007 documentation. Regression coverage includes a real generated hash, the previous ordering and malformed/unsupported representations. PASS: 11/11 User tests, 70/70 complete API tests (including all previous 53), root build/lint/typecheck/formatting. Database-dependent verification remains NOT_VERIFIED. F006's existing owner-approved status is unchanged; F007 is now IN_PROGRESS, superseding the historical next-feature note above.

# F014 — Student Onboarding

## Status / Dependencies

APPROVED_COMPLETE. Owner approved completion on 2026-10-08 within the approved frontend-only scope, with the verification limitations below preserved. Depends on completed F012/F013. Sources: [PRD §11](../PRD.md), [API](../API_DESIGN.md), [roadmap](../DEVELOPMENT_ROADMAP.md), [F006 reconciliation](F006-user-session-models.md), [F012](F012-current-user-student-profile.md), [F013](F013-authenticated-student-shell.md). Reuse existing student shell/teal styling; no onboarding-specific Stitch export exists.

## Scope / Approved Decisions

Authenticated verified ACTIVE STUDENT onboarding at `/onboarding`, inside the existing student route group. Completion derives only from authoritative `/users/me` profile: valid experience, 1–5 unique valid learning goals, valid difficulty and integer daily minutes 5–240. No persisted completion flag/timestamp. Incomplete students visiting dashboard go to onboarding; complete students visiting onboarding go to dashboard. Preserve ADMIN access state, account restrictions, stateless JWT semantics and existing login return allowlist.

Four steps: experience, learning goals, study preferences, review/save. Prefill saved values; Back/Next retain the memory-only draft. No skip. Disclose loss of unsaved changes on reload. Technology selection is unavailable pending F015; never fabricate IDs and omit technology IDs from updates. No names, credentials, email, provider, role, plan or status edits.

One final Bearer PATCH `/users/me`, credentials omitted, containing only the four approved profile leaves. Use an authenticated GET before submission with existing bounded refresh behavior. Never automatically replay PATCH. Adopt confirmed safe response only; ambiguous mutation outcomes require read-only reconciliation before explicit retry. PATCH 401 requires session re-verification and explicit resubmission. Preserve drafts for recoverable validation/rate-limit/dependency/network failures. Serialize with auth operations and reject obsolete or changed-account results.

Use existing React, Zod, fetch, CSS Modules and offline test tooling. No new dependencies or production backend/model/index/configuration changes. Live verification used separately approved isolated fixtures only; no external-provider calls. F015+ remains outside scope.

## Exact Files

Create:

```text
docs/features/F014-student-onboarding.md
apps/web/src/app/(student)/onboarding/page.tsx
apps/web/src/components/onboarding/onboarding-wizard.tsx
apps/web/src/components/onboarding/onboarding.module.css
apps/web/src/lib/onboarding/profile.ts
apps/web/tests/onboarding.test.ts
apps/web/tests/onboarding-rendering.test.ts
```

Modify:

```text
docs/DEVELOPMENT_ROADMAP.md
apps/web/src/components/auth/auth-boundary.tsx
apps/web/src/components/student/student-header.tsx
apps/web/src/components/student/student-navigation.tsx
apps/web/src/lib/api/client.ts
apps/web/src/lib/api/contracts.ts
apps/web/src/lib/auth/auth-controller.ts
apps/web/tests/api-client.test.ts
apps/web/tests/auth-controller.test.ts
apps/web/tests/browser-coordination.test.ts
```

The last file is limited to adding the required PATCH method to its existing unexpected-request fixture.

## Acceptance Criteria

- Derived completion, eligible-student route gates and honest technology deferral.
- Accessible four-step form, saved-value prefill, draft retention, reload disclosure, field validation and safe error/retry states.
- Exact four-field payload, safe DTO adoption, no unrelated mutations or automatic PATCH replay.
- Account/generation guards, auth serialization, reconciliation and existing logout behavior preserved.
- Offline validation/routing/rendering/client/controller tests, complete web/API regressions and root build/lint/typecheck/formatting; final scope/secrets review.
- Separately approved browser/database verification before claiming live behavior.

## Verification / Limitations

Offline verification (2026-10-07; rerun 2026-10-08): focused onboarding 7/7 PASS; web 38/38 PASS; API regressions 116/116 PASS; root build, lint, typecheck and formatting PASS. Completion/routing, draft retention, rendering, exact PATCH payload, recoverable errors, read-only reconciliation, duplicate-submission prevention and obsolete/account-change response rejection have offline coverage. Rendering tests do not establish browser focus, layout or full router lifecycle behavior.

Final diff/scope and secrets/token-storage review PASS: exactly the 17 files above; the browser-coordination fixture adds only `patchProfile: unexpected`. No dependencies, backend, environment or persistent settings changed; no token persistence or sensitive logging introduced. No unapproved scope deviations.

Owner-approved isolated live verification: core onboarding routing/prefill/validation/save/reload PASS; exactly one final PATCH and approved four-field payload only PASS; unrelated account/password preservation and profile audit persistence PASS. API/web/MongoDB exits 0/0/0; wrapper exit 0; shutdown, cleanup, port release and temporary-artifact removal PASS. No tracked files changed during live verification. Final read-only code review found no actionable P0, P1, P2 or P3 findings.

Resolved harness issue: `PRESERVATION_CHECK` failed with an ephemeral test-harness `TypeError` because it read `.length` from an absent optional raw-storage array. This was a JavaScript-runtime harness defect, not an application defect. Corrected harness verification passed and confirmed safe DTO empty-array behavior, preservation checks and reliable request-count/cleanup reporting without production changes.

Remaining NOT_VERIFIED: nonempty technology-interest preservation in live DB testing; live PATCH 401 handling; live 429/503/network/timeout handling; live ambiguous-save reconciliation / explicit retry; live logout/account-switch stale-response races; live mobile logout-failure feedback; hosted cookie behavior; normal Atlas startup. Related offline coverage does not establish live verification. Technology selection/existence validation remains deferred; no Technology IDs were fabricated. F015 remains NOT_STARTED.

# F013 — Authenticated Student Shell

## Status / Dependencies

APPROVED_COMPLETE within the approved scope. Owner completion approval: 2026-10-07. Owner approved offline implementation on 2026-10-06. Depends on F008, consuming completed F009/F012 contracts. Sources: [roadmap](../DEVELOPMENT_ROADMAP.md), [API](../API_DESIGN.md), [architecture](../SYSTEM_ARCHITECTURE.md), [F012](F012-current-user-student-profile.md). Design: [dashboard Stitch](../designs/student/dashboard/stitch/code.html) and its screenshot; retain existing teal branding and fonts.

## Scope / Approved Decisions

Backend-only contracts remain unchanged. Connect existing email/password login; add authenticated `/dashboard` under `(student)` with responsive navigation/header and real read-only current-user/profile data. No fabricated activity, progress, XP or learning metrics. Absent profile has an honest empty state; ADMIN receives a student-area access state with logout.

Access tokens remain memory-only. Restore through credentialed `/auth/refresh`; authoritative account state comes from Bearer `/users/me`. Render private content only after current-user success. Preserve stateless JWT behavior; no reactivation or live-session requirement added. Anonymous/invalid sessions redirect to `/login?next=/dashboard`; only `/dashboard` is an accepted return destination.

Serialize login/refresh/logout using same-origin Web Locks. BroadcastChannel carries only fixed invalidation/control messages, never credentials/profile data. Deduplicate refresh, ignore obsolete responses and prevent post-logout restoration. Unsupported coordination shows a compatibility state. Retry an authenticated GET only once after one refresh; never replay mutations or automatically retry ambiguous refresh timeouts. Logout waits for rotation, sends current cookie and clears local identity only after confirmed success; failure never claims server revocation.

Reuse native fetch, React, Zod, CSS Modules and existing Node/tsx offline test tooling. No dependencies, backend changes, actual env/DNS/TLS/deployment edits. Cookie topology remains a verification prerequisite: approved same-site HTTPS hosting or existing explicit LOCAL matching-loopback exception. No signup/Google/recovery integration, profile edits, set-password, email change, provider unlink, onboarding or F014+.

## Exact Files

Create:

```text
docs/features/F013-authenticated-student-shell.md
apps/web/src/app/(student)/layout.tsx
apps/web/src/app/(student)/dashboard/page.tsx
apps/web/src/components/auth/auth-provider.tsx
apps/web/src/components/auth/auth-boundary.tsx
apps/web/src/components/auth/auth-state.module.css
apps/web/src/components/student/student-shell.tsx
apps/web/src/components/student/student-navigation.tsx
apps/web/src/components/student/student-header.tsx
apps/web/src/components/student/dashboard-foundation.tsx
apps/web/src/components/student/student-shell.module.css
apps/web/src/lib/api/client.ts
apps/web/src/lib/api/contracts.ts
apps/web/src/lib/auth/auth-controller.ts
apps/web/src/lib/auth/browser-coordination.ts
apps/web/src/lib/auth/redirect.ts
apps/web/src/hooks/use-auth.ts
apps/web/tests/api-client.test.ts
apps/web/tests/auth-controller.test.ts
apps/web/tests/browser-coordination.test.ts
apps/web/tests/auth-redirect.test.ts
apps/web/tests/student-shell.test.ts
```

Modify:

```text
docs/DEVELOPMENT_ROADMAP.md
apps/web/package.json
apps/web/src/app/layout.tsx
apps/web/src/app/(public)/login/page.tsx
apps/web/src/components/login/login-form.tsx
apps/web/src/components/login/login.module.css
apps/web/src/components/ui/icon.tsx
```

## Acceptance Criteria

- Authenticated shell, authoritative current-user loading, login/restoration/logout and safe redirects follow existing contracts.
- Strict memory-only secrets, cross-tab coordination, bounded retries, stale-response protection and safe failure states.
- Real profile/empty states, responsive shell and accessible keyboard/focus/announcement behavior.
- Offline client tests and API regressions; root build/lint/typecheck/formatting and scope/secrets review.
- Separate owner approval before browser/live session/database verification; do not claim these from mocks.

## Verification / Unresolved Issues

Offline implementation completed on 2026-10-07. Existing work was preserved on resumption. Blocked BroadcastChannel construction now yields the explicit compatibility state; malformed API URLs yield sanitized errors. Both have regression coverage.

- Web offline tests: 21/21 PASS (mocked transport/coordination, redirects, bounded refresh, stale-response protection, logout failure and safe response parsing), including focused mobile rendering tests: 2/2 PASS.
- Existing API regressions: 116/116 PASS. No database integration executed.
- Root build, lint, typecheck and formatting: PASS. Feature-document formatting and final diff/scope review: PASS.
- Secrets/token-storage review: PASS. Exact changed-file scope: the 29 files above; no dependencies or backend/environment changes. Access tokens stay in a controller closure; no token persistence, sensitive logging or token/profile broadcasts found. No files staged or committed.
- Final code review: no actionable P0, P1, P2 or P3 findings.
- Sandbox process startup was unavailable during recovery; authorized checks ran in the host execution context.

Resolved P2: mobile logout-failure feedback now renders inside the active dialog, with retry still available. Controller semantics, retained identity on unconfirmed logout and stale-response protection remain unchanged. Added offline rendering coverage verifies alert placement and absence of empty alerts; it does not establish browser interaction behavior.

Owner approved deferring live browser/session verification on 2026-10-07 because supported browser tooling was unavailable. This is an environment/tooling limitation, not an application defect: no browser scenario failed, and blocked attempts started no MongoDB/API/web processes and changed no repository files.

Deferred, NOT_VERIFIED: live login/logout/session restoration, refresh-cookie behavior, `/users/me` browser integration, cross-tab coordination, stale-response suppression, cookie attributes, desktop/tablet/mobile rendering, keyboard/focus/overflow checks and real access-token expiry in browser. Offline results do not establish these. Normal Atlas startup, hosted cookie behavior and local/hosted topology remain NOT_VERIFIED; rate limiting remains single-process.

The approved isolated local procedure remains the future verification path when browser tooling is available. No live verification has executed. F013 is APPROVED_COMPLETE following owner approval dated 2026-10-07, with the live-verification deferral preserved; F014 remains NOT_STARTED.

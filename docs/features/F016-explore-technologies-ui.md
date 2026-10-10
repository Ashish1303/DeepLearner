# F016 — Explore Technologies UI

## Status / Dependencies

APPROVED_COMPLETE. Owner completion approval dated 2026-10-10, within the approved frontend-only scope. Frontend-only implementation. Dependencies: completed F013/F015. Sources: [roadmap](../DEVELOPMENT_ROADMAP.md), [API F015](../API_DESIGN.md), [F013](F013-authenticated-student-shell.md), [F014](F014-student-onboarding.md), [F015](F015-technology-catalog-backend.md). Reuse student dashboard Stitch hierarchy and existing teal styling; no dedicated Explore export exists.

## Scope / Decisions

Authenticated STUDENT /explore-technologies under the existing student layout. Preserve verified ACTIVE eligibility, ADMIN handling, session restoration, login return allowlist and onboarding gates. Incomplete eligible students may browse without modifying onboarding.

Public GET /technologies?page=N&limit=20 only. Feature-specific client validates DTO/envelope/pagination; no credentials, Bearer, manual Origin, redirects or caching. Bounded timeout, cancellation and generation guards; no automatic retries or auth mutations. Memory-only page state resets to 1 on remount/reload. Account changes remount the catalog and cancel obsolete work.

Informational semantic cards use name, description fallback and a neutral icon. IDs are keys, slugs are validated but not links, iconAssetId is not resolved, order remains server-defined. No fake records, learning actions, selection, sorting, search or progress. Responsive three/two/one-column grid. Existing mobile navigation/logout preserved.

Loading/error/empty/results states; Previous/Next only, disabled while loading. Empty later pages offer explicit page-1 return. Fixed safe 400/403/429/503/network/malformed-response messages; unexpected 401 never refreshes auth. No invented rate-limit countdown. Announce changes and focus results heading after explicit page changes only.

## Files

Create:

- this document
- apps/web/src/app/(student)/explore-technologies/page.tsx
- apps/web/src/components/technologies/technology-catalog.tsx
- apps/web/src/components/technologies/technology-catalog.module.css
- apps/web/src/lib/technologies/contracts.ts
- apps/web/src/lib/technologies/catalog-controller.ts
- apps/web/src/lib/api/technology-client.ts
- apps/web/src/hooks/use-technologies.ts
- apps/web/tests/technology-client.test.ts
- apps/web/tests/technology-catalog.test.ts
- apps/web/tests/technology-catalog-rendering.test.ts
- apps/web/tests/student-navigation.test.ts

Modify:

- docs/DEVELOPMENT_ROADMAP.md
- apps/web/src/components/student/student-navigation.tsx
- apps/web/src/components/student/student-header.tsx
- apps/web/src/components/student/student-shell.module.css

## Acceptance Criteria

Approved route/navigation and preserved auth/onboarding behavior; validated public read-only catalog integration; safe null/future record rendering; deterministic server order and pagination; explicit errors/retries; abort/stale/account-change safeguards; semantic responsive accessible UI. Focused and full web/API offline tests, build/lint/typecheck/formatting and scope/secrets review. Live checks require separate approval.

## Verification / Limitations

Offline: focused F016 tests 15/15 PASS; full web suite after P3 fix 54/54 PASS (previously 53/53); focused rendering 4/4 PASS; API regressions 126/126 PASS. Root build/lint/typecheck/formatting and scope/diff/secrets review PASS. Initial test-fixture import/typing issues were resolved within scope.

Retained live evidence, consolidated 2026-10-10:

- PASS: anonymous/invalid-session routing; complete and incomplete STUDENT Explore access; ADMIN student-area behavior; disabled/suspended/pending/unverified rejection where exercised. F014 onboarding and return gate after browsing remain unchanged.
- PASS: active navigation/header; empty, one-page and multi-page catalogs; server ordering; corrected empty later-page announcement and explicit return-to-page-1; null/blank description, unresolved/null icon and future-technology fallbacks.
- PASS: zero Authorization and Cookie headers on observed catalog requests; catalog failures did not trigger auth refresh/logout; safe 400/403/429/503, network/timeout and malformed-success handling. Auth state remained intact during exercised responses.
- PASS: navigation/unmount cancellation, cancellation/new-result protection and cancellation/new-identity isolation; desktop/tablet/mobile layout without horizontal overflow; exercised keyboard/focus behavior; mobile navigation and logout-failure feedback/retry.

NOT_VERIFIED: delivered-late stale-response race; delivered-old-response after account change; hosted cookie behavior; normal Atlas startup. Cancellation evidence does not prove delivered-late variants. Real JavaScript provisioning remains outside F016 and NOT_VERIFIED.

Final read-only code review: no actionable P0/P1/P2/P3 findings. No dependencies, backend/model/API/auth-controller/environment changes or F017 work.

## Resolved P3 / Verification Cleanup

Empty out-of-range pages previously announced invalid `Page N of M` text. They now announce `The requested page has no results.`. The existing empty message and explicit return-to-page-1 action remain unchanged. Focused rendering coverage was added; the correction and return action passed live.

Owner-approved disposable verification used synthetic fixtures only, existing MongoDB 8.2, loopback replica set f016-test, empty deeplearner-f016-test and declared users/sessions/auditLogs/technologies indexes. API/web configuration was process-only with matching localhost origins. No real Admin account, JavaScript provisioning, external providers or actual .env changes.

An interrupted harness reported 6,438 wall-clock seconds; the discrepancy remains unproven and is not application-failure evidence. Harness-only changes added monotonic timing, an independent watchdog, bounded cleanup and an explicit stop reason. The final run stopped manually after 182.1 seconds (wall and monotonic matched). API/web/MongoDB/wrapper/watchdog exits: 0/0/0/0/0. Disconnect/shutdown/port release/temporary-artifact removal PASS. Repository unchanged by live verification.

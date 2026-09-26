# F002 — Login Page UI

## Status

APPROVED_COMPLETE. The owner approved the login page and navigation follow-up and requested committing and pushing the completed changes.

## Goal

Provide a responsive login UI preview and a discoverable path to it from the public landing page.

## Design References

- [Login Stitch HTML](../designs/public/login/stitch/code.html)
- [Login screenshot](../designs/public/login/stitch/screen.png), the primary visual reference.
- [Landing primary Stitch HTML](../designs/public/landing-page/stitch/primary/code.html), which places Log In before Start Learning Free.
- [Landing design notes](../designs/public/landing-page/DESIGN_NOTES.md)

References are local, Git-ignored files. Exported HTML/CDN scripts were not copied wholesale.

## Scope

- Login page with email/password fields, visibility toggle, local validation, mock notices, and static workspace preview.
- Desktop/tablet/mobile styling and accessibility foundations.
- Follow-up: secondary Log in link in the landing header and equivalent mobile-menu link.
- Feature documentation and roadmap completion records.

## Out of Scope

Authentication API, tokens, cookies, sessions, OAuth, password-reset backend, MongoDB, protected routes, signup implementation, dashboard routing, and real visualization or learning data.

## Implementation Summary

The login page and product preview are server components. The form is a client component using native controls and React state. It validates missing email/password and invalid email syntax, focuses the first invalid field, toggles password visibility, and associates inline errors with inputs.

Valid submission shows “UI preview only. Sign-in is not connected yet.” Google activation shows “Google sign-in is not connected yet.” Neither redirects or transmits credentials. Signup/reset controls were disabled at original delivery. F003 subsequently connects Create an account to `/signup`; password reset remains unavailable.

The approved implementation omits Stitch's state-demo toolbar, remember-device checkbox, and unsupported security/live-session claims. Example progress and learner information are labeled illustrative.

The navigation follow-up adds a plain Next.js Link immediately before the stronger filled Start Learning Free CTA. At widths of 1100px or below, the desktop login link is hidden and Log in appears in the disclosure menu. Selecting it closes the menu and navigates to /login. Existing section links and Escape-to-close behavior remain. Signup CTA behavior is unchanged.

## Routes

- `/login`: login UI preview.
- `/` → `/login`: landing header/mobile navigation.
- `/login` → `/`: brand and Home links.
- No signup, reset-password, or dashboard routes created.

## Components / Files

Original implementation:

- `apps/web/src/app/(public)/login/page.tsx`
- `apps/web/src/components/login/login-form.tsx`
- `apps/web/src/components/login/login-product-preview.tsx`
- `apps/web/src/components/login/login.module.css`

Navigation follow-up:

- `apps/web/src/components/layout/public-header.tsx`
- `apps/web/src/components/layout/mobile-navigation.tsx`
- `apps/web/src/components/layout/public-layout.module.css`

Records:

- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/features/F001-landing-page.md`
- `docs/features/F002-login-page.md`

Existing root fonts/tokens, button base CSS, and matching icons are reused unchanged. Hero/footer CTAs and login form are unchanged by the navigation follow-up.

## Dependencies

No new dependencies. Existing Next.js, React, TypeScript, native form controls, CSS Modules, and inline SVG.

## Acceptance Criteria

- Login fields, visibility, validation, and mock feedback work without authentication.
- Desktop and mobile landing navigation reach /login.
- Log in remains visually secondary; Start Learning Free retains its filled treatment.
- One visible login navigation entry per applicable layout; the mobile entry appears when its menu opens.
- Keyboard focus and menu dismissal work; no header overflow.
- Feature records distinguish original delivery from subsequent changes.
- Build, lint, typecheck, formatting, and navigation smoke checks pass.
- F002 returns to READY_FOR_REVIEW; F003 remains NOT_STARTED.

## Verification

Original login implementation passed build, lint, typecheck, source formatting, and isolated desktop-Chrome interaction checks: validation, first-error focus, show/hide password, mock login/Google notices, skip navigation, no POST/API calls, no app storage/cookies, and no runtime exceptions.

Original route checks covered /login and / (200) and an unknown route (404). Screenshots and overflow checks covered 1440, 1024, 768, 375, and 320 CSS pixels; reduced-motion preference was checked.

Navigation follow-up passed monorepo build, lint, typecheck, and changed-file formatting. Isolated Chrome checks covered 1440, 1101, 1100, 768, 375, and 320 CSS pixels: one visible login entry, no horizontal overflow, unchanged primary CTA fill/unavailable behavior, keyboard menu opening, Escape/focus return, reopening, Enter activation to /login, and Home navigation back to /. The menu was closed on return. HTTP checks confirmed / and /login return 200 and an unknown route returns 404. Desktop and mobile screenshots were reviewed, including the breakpoint boundary. Initial synthetic keyboard failures were resolved by correcting test input; no application fix was needed.

## Known Limitations

- Login remains UI-only. Reaching the page does not enable account access.
- Signup UI is now available through F003; registration and password reset remain unavailable.
- Browser verification uses Chrome emulation, not physical devices or a complete cross-browser/screen-reader audit.
- Existing missing favicon and unrelated AGENTS.md formatting remain outside scope.
- No permanent automated test framework was added; browser checks use temporary tooling.

## Completion Notes

The original login UI reached READY_FOR_REVIEW before this explicitly approved navigation/documentation follow-up. F001's original completion approval is preserved. After verification, the owner approved F002 and requested a commit and push to dev. F003 remains NOT_STARTED; no implementation of the next feature is included.

The preceding completion note describes the F002 delivery point. In the subsequent approved F003 implementation, only the login form's Create an account control changes to a `/signup` link. Login submission and authentication boundaries remain unchanged. Bidirectional signup/login navigation passed Chrome smoke checks; see [F003](F003-signup-email-verification.md) for current verification and file details.

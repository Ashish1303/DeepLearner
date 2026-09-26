# F003 — Signup + Email Verification UI

## Status

APPROVED_COMPLETE. The owner approved F003 completion and requested committing and pushing the changes. F004 is not started.

## Goal

Provide a responsive signup and email-verification preview, reachable from the public landing page and login page.

## Design References

- [Signup Stitch screenshot](../designs/public/signup/stitch/screen.png), the primary visual reference.
- [Signup Stitch HTML](../designs/public/signup/stitch/code.html), for structure and states.
- Existing F001/F002 fonts, teal colors, button styles, and icons.

Design references are local and Git-ignored. The export was rebuilt as components, not copied wholesale.

## Scope

Name, email, and password fields; local validation; password visibility; Google mock notice; same-route verification preview; resend mock notice; back-to-form behavior; static learning preview; responsive and accessible navigation.

## Out of Scope

Registration APIs, authentication, OAuth, tokens, email delivery, cookies, sessions, database access, protected routes, onboarding, real learning data, and a visualization engine. No OTP input or separate token-verification route.

## Implementation Summary

The server-rendered `/signup` page composes a client form and static server-rendered product illustration. CSS Modules adapt the split layout to stacked panels. Names use trimmed lengths of 1–80 characters, email uses native syntax validation, and passwords require 10–128 characters without trimming or composition rules. Fields begin empty.

Invalid submission focuses the first invalid field and associates error text with its input. Valid submission clears the password and displays an explicitly simulated verification screen; it does not claim an account was created or an email sent. The heading receives focus. Resend and Google actions show honest local notices.

Back preserves names/email in component memory, focuses email, and leaves password empty. Refresh resets the form. No details are stored or transmitted. The planned 15-minute verification-link lifetime is explanatory text only.

Landing header, hero, final CTA, and mobile menu now link to signup. Login's Create an account link also reaches signup. Existing login behavior is otherwise preserved. State-demo controls, fabricated security claims, mailbox-launch links, and unavailable legal links were omitted as approved.

## Routes

- `/signup`: signup form and in-memory verification preview.
- `/` → `/signup`: primary account-creation CTAs and mobile navigation.
- `/login` → `/signup`: Create an account.
- `/signup` → `/login` or `/`: login and home links.

## Components / Files

Created:

- `apps/web/src/app/(public)/signup/page.tsx`
- `apps/web/src/components/signup/signup-form.tsx`
- `apps/web/src/components/signup/verification-preview.tsx`
- `apps/web/src/components/signup/signup-product-preview.tsx`
- `apps/web/src/components/signup/signup.module.css`
- `docs/features/F003-signup-email-verification.md`

Modified:

- `apps/web/src/components/layout/public-header.tsx`
- `apps/web/src/components/layout/mobile-navigation.tsx`
- `apps/web/src/components/landing/hero-section.tsx`
- `apps/web/src/components/landing/final-cta-section.tsx`
- `apps/web/src/components/login/login-form.tsx`
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/features/F001-landing-page.md`
- `docs/features/F002-login-page.md`

## Dependencies

None added. Uses existing Next.js, React, TypeScript, CSS Modules, native controls, and inline SVG. Configuration and shared packages are unchanged.

## Acceptance Criteria

- [x] Signup and verification preview follow the approved Stitch structure and existing teal design direction.
- [x] Required fields, length boundaries, email syntax, password visibility, and first-error focus work.
- [x] Submission, Google, and resend remain explicitly UI-only.
- [x] Back and reload behavior preserve the approved password/data boundary.
- [x] Landing/login signup navigation and return links work.
- [x] Desktop, tablet, and mobile layouts avoid horizontal overflow.
- [x] Labels, errors, keyboard activation, focus, landmarks, and reduced-motion preference checked.
- [x] Build, lint, typecheck, changed-file formatting, and browser smoke checks pass.
- [x] No backend, dependency, configuration, or F004 changes.

## Verification

Monorepo build, lint, and typecheck passed. Changed source and feature-document formatting checked. No existing automated test command/framework is configured; temporary Chrome DevTools scripts exercised the production build without adding dependencies.

Chrome checks passed for empty fields, whitespace names, 81-character name rejection, accepted 1/80-character names, invalid email, 9/129-character password rejection, accepted 10/128-character passwords, visibility labeling, verification focus, resend notice, return focus/data retention/password clearing, refresh reset, and Google notice.

Keyboard checks passed for skip-to-main, visible focus, and Enter submission. Inputs have labels; errors use associated text and invalid attributes. Signup and verification have no page-wide overflow at 1440, 1024, 768, 375, and 320 CSS pixels. Desktop/tablet/mobile screenshots were reviewed. Reduced-motion preference was exercised; no new animation was introduced.

Desktop/mobile landing-to-signup, login-to-signup, signup-to-login, and Home navigation passed. `/`, `/login`, and `/signup` returned 200; an unknown route returned 404. Interaction checks observed no POST/API requests, local/session storage, cookies, credential query strings, or JavaScript runtime exceptions. Final source/diff scope reviewed.

## Known Limitations

- No real account, verification email, Google authentication, or legal agreement exists.
- Product content is static and illustrative; link expiration is not implemented.
- Chrome viewport emulation is not a physical-device, cross-browser, or full screen-reader audit.
- Existing favicon absence and unrelated repository formatting are outside this feature.
- Temporary smoke scripts/screenshots are not a committed regression-test suite.

## Completion Notes

F003 moved to IN_PROGRESS before implementation and READY_FOR_REVIEW after verification. F001/F002 completion history is preserved, with their later navigation updates documented separately. No new dependencies or unplanned scope changes. No F004 work was performed. After verification, the owner approved completion and authorized a commit and push to dev.

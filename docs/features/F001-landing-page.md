# F001 — Public Landing Page

## Status

APPROVED_COMPLETE. Owner approval followed the requested teal update. Original implementation: commit `f0dac7b` on `dev`.

## Goal

Introduce DeepLearner's visual learning approach through a responsive public page and static product previews.

## Design References

- [Landing design notes](../designs/public/landing-page/DESIGN_NOTES.md)
- [Primary Stitch export](../designs/public/landing-page/stitch/primary/code.html)
- [Alternate export](../designs/public/landing-page/stitch/alternate/code.html), consulted only as secondary context.

Design references are local, Git-ignored files. No landing screenshot was available during implementation. The approved scope used the core landing sections rather than every section in the export.

## Scope

Header, hero, learning method, visual learning demo, code visualizer preview, technologies, progress/weak-topic preview, interview preview, final CTA, footer, responsive CSS, and reusable UI foundations.

## Out of Scope

Authentication, signup, APIs, persistence, dashboards, live progress, real code execution, visualization engine, AI, pricing, and additional marketing sections.

## Implementation Summary

Next.js server components compose the page; only the mobile navigation disclosure requires client state. CSS Modules and global tokens provide styling. Geist and JetBrains Mono are loaded through next/font. Action and accent tokens use owner-requested `#18abaf`.

Previews are static and labeled illustrative. JavaScript is the first planned technology; other catalog cards are planned. Account-creation CTAs remain disabled. Section anchors provide working exploration paths.

The subsequent F002 navigation follow-up adds a plain header Log in link and mobile-menu equivalent to `/login`. This was not part of the original F001 delivery; see [F002](F002-login-page.md).

## Routes

- `/`: public landing page.
- Section anchors: `#learning-method`, `#visual-learning`, `#code-visualizer`, `#technologies`, `#progress`, `#interview-prep`.
- `/login`: outbound navigation introduced by the F002 follow-up.

## Components / Files

Under `apps/web/src/`:

- `app/(public)/page.tsx`: page composition and metadata.
- `app/layout.tsx`, `app/globals.css`: fonts and global foundations.
- `components/layout/public-shell.tsx`: landing shell option; existing 404 shell preserved.
- `components/layout/public-header.tsx`, `public-footer.tsx`, `mobile-navigation.tsx`, `public-layout.module.css`.
- `components/landing/hero-section.tsx`, `learning-method-section.tsx`, `visual-learning-section.tsx`, `code-visualizer-section.tsx`, `technologies-section.tsx`, `progress-preview-section.tsx`, `interview-preview-section.tsx`, `final-cta-section.tsx`.
- `components/landing/event-loop-preview.tsx`, `landing-content.ts`, `landing.module.css`.
- `components/ui/button-link.tsx`, `icon.tsx`, `ui.module.css`.

Feature status and historical verification are also recorded in [the roadmap](../DEVELOPMENT_ROADMAP.md).

## Dependencies

Existing Next.js, React, and TypeScript. No feature dependencies added; no CSS framework or visualization package.

## Acceptance Criteria

- Approved core Stitch direction and section order.
- Responsive, semantic layout with accessible navigation and static preview labels.
- No backend integration or unnecessary dependencies.
- Build, lint, and typecheck pass.

## Verification

Original delivery passed monorepo build, lint, typecheck, source formatting, HTTP route checks, single-H1 and section-anchor checks, and 404 regression smoke testing.

All desktop sections and an initial 375px mobile view were reviewed. Full original tablet/mobile keyboard review was interrupted by the owner; owner approval subsequently completed F001. Later navigation verification is recorded separately under F002 and does not retroactively change this history.

## Known Limitations

- Account creation and demo controls are unavailable previews.
- Requested teal has insufficient contrast for some normal text on light surfaces and white text on teal; full contrast compliance is not claimed.
- No usable production logo asset or favicon was added.
- Google fonts need build-time access when not cached, then are served locally.
- Design references are not included in Git.

## Completion Notes

F001 was approved and pushed before F002 implementation. The original roadmap sentence that F002 was not started describes that historical delivery point, not its current status. The later login-link adjustment is owned by F002. No signup behavior or hero/footer CTA changed in that follow-up.

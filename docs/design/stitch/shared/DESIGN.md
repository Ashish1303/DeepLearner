# DeepLearner — imported Stitch design system

Design reference and implementation proposal, 2026-10-31. Baseline: `dev` at
`996d643ed4d6403d653b8e8c71c8663de690b052`. This document authorizes no application,
package, route, authentication, API, database or runtime change.

## Source, precedence and import boundary

The owner confirmed the existing extracted folder
`docs/design-imports/stitch_deeplearner_platform_design_system/` as the approved
source in this chat. No ZIP was supplied or extracted by this task. Archive-entry
or original extraction safety cannot be certified retrospectively. The resulting
directory was inspected: exactly six source directories and twelve regular files,
with no symlink/reparse entries, unexpected executable files or secret-pattern
matches. PNG signatures, chunk checksums and compressed image data were checked.

The twelve originals are retained; organized copies preserve their exact bytes.
Existing `docs/designs/` references remain untouched. See
[SCREEN_MAP.md](../SCREEN_MAP.md) for mapping, checksums, implementation inventories
and current feature restrictions. This singular `docs/design/stitch/` import is a
new reference set, not a move or replacement of the plural `docs/designs/` tree.

Screenshots are the visual reference; HTML describes layout and intended states.
The four application exports share a charcoal/lavender/purple/gold system. This
differs from the restrained teal direction in PRD section 107 and from older blue
and green references. Record this as the proposed unified direction for owner
approval with the first visual implementation slice. This import does not amend
the PRD or silently supersede an accepted application design.

## Reference integrity and execution restrictions

The four application `code.html` files contain a Tailwind CDN script, palette
configuration, Google font links and inline demonstration JavaScript. The Admin
overview and Student dashboard also reference remote images. The revision screen
has four inline click handlers; the Student screen has five. Scripts simulate
feedback, review drawers, approval toasts, mode selection and scroll synchronization;
they are not server authorization, publication or learning behavior.

These exact originals are inert reference files only: do not execute them, mount
them as application routes, import them as components, put them in public assets,
iframe them or copy scripts/handlers into either app. No application runtime
dependency was added. Do not interpret that statement as absence of scripts in the
preserved references. Rebuild approved presentation with existing React, CSS and
local icons. Do not fetch remote assets during planning. New font/image acquisition,
licensing and package changes need their own applicable approval.

Both logo `screen.png` files are identical, 400 × 1105, mostly transparent, with
only black visible pixels; the inspected preview does not show the intended logo
variants. Their `code.html` files are base64-encoded SVG strings, not HTML documents.
Read-only decoding showed different 320 × 80 marks: A uses a dark rounded tile,
orbital mark and mixed-case wordmark; B uses a pale tile, hexagonal network and
uppercase wordmark. Neither decoded SVG contains scripts, event handlers or
external references. No decoded asset was created and no logo was selected.
Obtain an owner-selected, visually verified asset before replacing current text
branding. Preserve both imperfect exports as evidence; do not repair their bytes.

## Palette and semantic roles

These values come from the four application exports. Token names below are a
prospective CSS vocabulary, not an existing package or committed runtime stylesheet.

| Proposed semantic token      | Export value | Intended use                                       |
| ---------------------------- | ------------ | -------------------------------------------------- |
| `--studio-canvas`            | `#fdf7ff`    | Pale lavender page canvas                          |
| `--studio-panel`             | `#ffffff`    | Primary reading/review cards                       |
| `--studio-panel-subtle`      | `#f8f2fa`    | Sidebar and quiet sections                         |
| `--studio-panel-muted`       | `#f2ecf4`    | Nested panels and comparison support               |
| `--studio-panel-raised`      | `#ece6ee`    | Grouped controls and code surroundings             |
| `--studio-panel-strong`      | `#e6e0e9`    | Stronger neutral grouping                          |
| `--studio-ink`               | `#1d1b20`    | Headings and primary text                          |
| `--studio-ink-secondary`     | `#494551`    | Body support text and accessible labels            |
| `--studio-chrome`            | `#322f35`    | Dark top bar and code panels                       |
| `--studio-on-chrome`         | `#f5eff7`    | Text on dark chrome                                |
| `--studio-action`            | `#4f378a`    | Primary action and selected comparison header      |
| `--studio-action-hover`      | `#6750a4`    | Hover/selected navigation surface                  |
| `--studio-on-action`         | `#ffffff`    | Primary action label                               |
| `--studio-selection`         | `#e1d4fd`    | Quiet selected backgrounds                         |
| `--studio-on-selection`      | `#645a7d`    | Selection text on that exact surface               |
| `--studio-focus`             | `#6750a4`    | Proposed strong focus ring on light surfaces       |
| `--studio-border-decorative` | `#cbc4d2`    | Nonessential card divider only                     |
| `--studio-border-control`    | `#7a7582`    | Proposed input boundary on white/light panels      |
| `--studio-gold`              | `#c9a74d`    | Decorative emphasis, never white-backed small text |
| `--studio-attention-bg`      | `#ffdf93`    | Review-attention badge/button                      |
| `--studio-attention-ink`     | `#241a00`    | Text on attention background                       |
| `--studio-danger`            | `#ba1a1a`    | Destructive text/action                            |
| `--studio-danger-bg`         | `#ffdad6`    | Error notice surface                               |

Lime `#84cc16` occurs in the overview's progress indicators and decoded brand marks.
It is decorative only on white; use a dark label/icon and explicit state text.
Do not make it a universal success color or infer quality from its presence.
Gold is an accent rather than a second competing primary action.

### Measured contrast and required corrections

Ratios below use the sRGB relative-luminance calculation on opaque color pairs,
rounded to two decimals. They are static design checks, not rendered accessibility
certification. Normal text must reach 4.5:1; large text 3:1; essential boundaries,
icons and focus indicators at least 3:1 against their adjacent colors. Opacity,
hover, disabled, gradients and actual component states need separate measurement.

| Foreground / background | Ratio | Implementation requirement                              |
| ----------------------- | ----- | ------------------------------------------------------- |
| `#1d1b20` / `#fdf7ff`   | 16.20 | Suitable primary text                                   |
| `#494551` / white       | 9.32  | Suitable secondary text                                 |
| white / `#4f378a`       | 9.35  | Suitable primary button text                            |
| `#e0d2ff` / `#6750a4`   | 4.55  | Narrow normal-text margin; no opacity reduction         |
| `#645a7d` / `#e1d4fd`   | 4.56  | Narrow margin; measure actual state                     |
| `#7a7582` / `#fdf7ff`   | 4.24  | Fails normal text: use `#494551` for small labels       |
| `#7a7582` / `#f8f2fa`   | 4.06  | Same correction for sidebar labels                      |
| lime `#84cc16` / white  | 1.98  | Fails text and essential indicators; add dark treatment |
| gold `#c9a74d` / white  | 2.30  | Decorative only; use dark/gold pairing for badges       |
| `#241a00` / `#ffdf93`   | 13.27 | Suitable attention text                                 |
| `#ba1a1a` / `#ffdad6`   | 5.00  | Suitable error text                                     |
| `#cbc4d2` / white       | 1.70  | Not a sole input boundary/focus indicator               |
| `#6750a4` / white       | 6.44  | Suitable proposed light-surface focus color             |

Keep original screenshots unchanged. Apply these corrections only in an approved
implementation; fidelity does not justify copying inaccessible labels or hidden
focus rings. Dark-header controls need a separately checked light focus ring.

## Typography

The application exports request Public Sans, 400/500/600/700, with some heavier
utility weights; Material Symbols provides their icons. Logo SVGs name Plus Jakarta
Sans/Inter and have a different brand treatment. The current Student application
already uses Geist and JetBrains Mono through `next/font/google`; Admin uses
Arial/Helvetica. First implementation should retain those installed font paths and
use size, weight and spacing to approximate the references. Do not add Public Sans,
Material Symbols, a CDN request or another font loader implicitly.

Proposed scale: page title 28–36px with tight 1.15–1.25 line height; section title
20–24px; card title 16–18px; body 16px with 1.5–1.7 line height; secondary body
14px; labels at least 12px with sufficient contrast. The export's frequent 10/11px
text is a density reference, not the target for essential instructions. Use existing
monospace for code, revision identifiers and technical metadata. Keep headings in
sentence case; reserve tracked uppercase for short nonessential category labels.

## Layout, spacing and surfaces

Reference screenshots: overview 972 × 1600; review 1200 × 1600; comparison
1459 × 1600; Student dashboard 910 × 1600. These are export capture sizes, not
proof of those exact responsive viewports or mobile behavior.

HTML defines a 64px fixed charcoal header and 256px fixed Admin sidebar below it;
Admin main content has a sidebar offset, 32px side padding and 48px bottom space.
Student HTML has a centered 1280px maximum canvas, 24px side padding increasing to
48px, and 64px bottom space. The existing Student sidebar/dialog should remain in
the early styling slices; changing to the export's top-only navigation is a separate
navigation/design decision. The existing Admin shell has only a header/main/footer;
do not add an apparently functional seven-item sidebar before its features exist.

Use a 4px base scale: 4/8/12/16/20/24/32/40/48/64px. Cards use 20–32px inner
padding, 16–32px gaps, 8px principal radii and quiet shadows. The export radius
configuration is 2/4/8/12px for default/lg/xl/full; use true circles for avatars and
status dots. Avoid ambient glows, stock imagery and decorative animation in the
first implementation. Prefer a border and low-elevation shadow to nested shadows.

Overview: hero and action area, four summary tiles, full-width current job, then
roughly two-thirds curriculum list and one-third review/evidence rail. Review:
12-column hierarchy with 3/6/3 track/content/evidence columns at wide widths.
Comparison: revision chronology, correction directive and two equal reading panels;
the HTML caps inner scrollers at 720px. Student: welcome, current learning card,
five-mode tiles, then technology/activity areas and interview callout. Adopt only
sections supported by actual approved data; these structures are not API schemas.

## Controls, status and review patterns

Buttons: strong purple primary, quiet neutral secondary, explicit red destructive,
and gold attention only for a deliberate review decision. Use real buttons for
actions and real links for navigation; icons supplement accessible text. Preserve
44px minimum interactive targets, visible hover/focus, busy/disabled labels and
logical reading order. Never copy clickable `div` controls, `href="#"`, removed
outlines or script-only notification icons from the export.

Inputs need persistent labels, high-contrast boundaries, associated instructions,
field errors and an error summary when appropriate. A correction prompt requests AI
revision; it is not a manual content editor. Preserve typed instructions on errors;
do not clear them merely because a request was dispatched. Current Admin password
clearing and controller/session behavior must remain unchanged.

Badges need text plus optional icon, not color alone. Editorial states, job states,
validation results and publishing outcomes are separate concepts. Use actual
revision IDs, evidence dates and actionable blockers. Sample model names, PIDs,
scores such as 98/100, hallucination percentages, streaks, mastery percentages,
certifications and "100% passed" claims are not production requirements or facts.
Budget presentation must use real settled/reserved/uncertain/available amounts from
the shared monthly INR 1,000 policy; inconsistent sample amounts are discarded.

Review controls show the exact revision and source evidence. Approve does not
publish; approval never bypasses independent policy/rubric review. Module publication
is an explicit separately authorized operation with immutable manifests and current
authority checks. Replace the export's combined "Approve & Promote" interaction
with separate review and publishing steps when that feature is approved. Rejection
does not overwrite a published baseline. Comparison uses labelled original/proposed
panes, textual added/removed markers, a keyboard-operable optional sync toggle and
a full-width narrow-screen reading mode. No HTML injection or code execution is
implied by a comparison/preview panel.

## Responsive and accessibility acceptance proposal

Future checks cover 1440/1280 desktop, 1024/768 tablet, 390/320 mobile CSS pixels,
200% zoom and 400% reflow where applicable. These are proposed checks, not executed
results. Below the existing Student 1024px shell breakpoint, retain its native
dialog, close button, focus handling and accessible menu trigger. Admin future
sidebar behavior needs approved mobile navigation; the fixed export sidebar is
not a complete mobile design. Early header-only Admin styling must wrap safely.

Collapse summary tiles 4 → 2 → 1; review panes become hierarchy → content → source
evidence → decision in document order. Comparison becomes sequential original and
proposed sections, retaining both revision identities and all change evidence.
Unpin action bars when they would obscure text, errors or the virtual keyboard;
reserve bottom space if a sticky action area is used. Code can scroll inside a
labelled region, while the page must not acquire horizontal overflow. Long titles,
emails, source URLs and translated-size text must wrap without losing meaning.

Require one main landmark, ordered headings, skip links, labelled navigation,
`aria-current`, announced asynchronous/error states, semantic tabs, logical keyboard
order and focus restoration. Do not hide scrollbars globally. Respect reduced
motion; no endless pulse/spin as decoration. Validate real rendered contrast and
all focus/busy/error states. Design inspection is not a screen-reader or browser
test; real Chrome evidence and approved automated browser acceptance remain gates.

## Component and tooling direction

Keep Admin components close to their feature, using its existing globals plus CSS
modules. Keep Student components in its existing student/concepts/practice/learning
folders, with existing CSS modules and local `Icon`. Reuse AdminShell, StudentShell,
StudentHeader, StudentNavigation, DashboardFoundation and DashboardActivity rather
than duplicating them. Do not create dashboard/learning folders merely to satisfy a
diagram. Only add a component for a repeated or meaningful approved UI concept.

`packages/ui/` does not currently exist. Initially document and duplicate the small
token vocabulary in existing app styles; do not add a shared package, exports,
workspace configuration, build dependency or cross-app renderer extraction in a
visual slice. Reassess sharing only after real repeated usage and separate approval.
No new runtime dependency is proposed for the six styling/planning slices.

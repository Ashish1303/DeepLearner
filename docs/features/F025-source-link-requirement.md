# F025 - Source Link Requirement

**Status:** APPROVED_COMPLETE
**Roadmap dependency:** F021 APPROVED_COMPLETE.
**Reuse:** F022 source validation/footer and the F023/F024 Concept modes.
**Authorization:** Implementation and focused offline verification are owner-approved
within the 11-file boundary, including source-validation hardening and editorial
deferral. Browser and live database execution require separate approval. F001-F024 remain
APPROVED_COMPLETE; F026 is outside this work.

## Sources and scope reconciliation

- [PRD](../PRD.md), sections 37 and 82: sources for published technical Concepts,
  source preference, bottom-of-Concept presentation and Admin approval checks.
- [System Architecture](../SYSTEM_ARCHITECTURE.md): modular API boundaries,
  authoritative backend validation and existing Next.js student architecture.
- [Database Design](../DATABASE_DESIGN.md), Concept and F021 refinements: required
  single embedded source, existing bounds, classification and explicit Boolean.
- [API Design](../API_DESIGN.md), F021-F024 Concept read contracts: source appears
  in detail only; public reads are credential-independent and non-mutating.
- [Development Roadmap](../DEVELOPMENT_ROADMAP.md): F025 Source Link Requirement;
  F047-F051 own subsequent Concept authoring, approval and publishing workflows.
- Approved [F021](F021-concept-read-model-api.md),
  [F022](F022-concept-read-ui.md), [F023](F023-concept-example-mode.md) and
  [F024](F024-concept-revise-mode.md) plans.

Required metadata, DTO projection and the shared Reference footer already exist.
F025 hardens their validation and verifies the source requirement; it does not
rebuild the footer, create a new source subsystem or redesign the student page.
The existing single source satisfies the PRD's minimum of one source. Multiple
sources and new classification enums are not approved.

PRD section 37 requires missing sources to block Admin approval. By explicit owner
decision, integration with actual approval/publishing operations is deferred to
F047-F051. Those workflows must validate sources before approval/publication,
including legacy content and write paths that could bypass model validation.
F025 does not implement or claim full editorial enforcement. Keep the PRD intact
and carry this dependency into future workflow acceptance criteria.

## Source contract and validation

Preserve the required embedded object, without nested IDs or defaults:

| Field | Contract |
| --- | --- |
| source.label | Required string; trim on validated model input; 1-120 characters after trimming |
| source.url | Required nonempty string; maximum 2,048 characters; absolute valid HTTPS URL without embedded credentials |
| source.sourceType | Required literal OFFICIAL_OR_TRUSTED |
| source.isOfficial | Required actual Boolean; both true and false are valid; no inferred/default value |

Use existing JavaScript string-length conventions. Reject missing/null source,
nonobject or array source, missing required fields, blank labels, overlong values,
invalid field types and coercion. Preserve strict embedded model validation for
unknown properties. Keep casting changes local to source; do not change global
Mongoose behavior or unrelated Concept fields. Trimming an actual label string
is approved normalization, not permission to stringify arbitrary values.

Align model and frontend source URL validation with the existing safeHttpsUrl
policy in apps/web/src/lib/concepts/contracts.ts:

- Require an explicit HTTPS scheme (case-insensitive) and successful native URL
  parsing with a hostname. Reject relative/protocol-relative URLs and other schemes.
- Reject nonempty parsed username or password, literal whitespace, backslashes,
  ASCII control characters and DEL, consistent with the current link renderer.
- Do not repair malformed URLs by trimming, guessing a scheme or deleting input.
- Preserve valid mixed-case HTTPS, paths, query strings, fragments, percent-encoded
  characters, internationalized hostnames and valid ports accepted by the current
  approved policy. Do not add a domain allowlist, ASCII-only rule, blanket query
  prohibition or canonical-string-equality requirement.
- Validate without fetching, resolving DNS or probing redirects/reachability.
  Preserve authored valid URL strings in persistence/DTOs; the existing renderer
  may use URL.href normalization solely for the rendered link.

Reuse safeHttpsUrl for frontend policy checks without broadening or tightening
its shared Markdown behavior. Mirror the source policy inside the existing model;
do not create a shared package or dependency. The frontend must reject malformed
required source data through its existing safe response-error handling. Preserve
existing response-envelope and extra-field handling outside this targeted work.

## Backward compatibility and security boundaries

- Existing correctly typed F021-F024 source records remain valid. Keep the source
  required for every validated Concept, including drafts; do not weaken it to a
  PUBLISHED-only requirement or invent an absent-source default.
- Previously castable wrong types and URL spellings that the safe renderer already
  rejects are not approved valid inputs. They must fail new validation. Do not
  infer that all existing storage has been inspected or repaired.
- No migration, backfill, legacy-record rewrite, URL normalization write or new
  database validator is included. Direct database writes can bypass Mongoose;
  model validation is not proof that every historical record is compliant.
- Missing or malformed source DTOs remain errors, not fabricated references.
  Preserve existing backend read/error behavior; do not add a read-time repair,
  source-based visibility filter or new error code. Any discovered need for such
  changes requires owner approval.
- Keep GET /api/v1/concepts/:id and its four source fields unchanged. List DTOs
  continue to omit source. Preserve indexes, schemaVersion, lifecycle, five-level
  publication visibility, parent consistency, pagination and error envelopes.
- isOfficial is authored metadata, not independent verification. An HTTPS URL or
  OFFICIAL_OR_TRUSTED classification does not establish accuracy, availability,
  ownership or editorial trust. No crawler, SSRF-prone server fetch, domain trust
  service or new verified badge is introduced.
- Preserve authentication/onboarding guards, cancellation/account ownership,
  credential-free catalog requests and existing CORS/rate limits. Never log source
  credentials, auth tokens or raw internal errors in rejection handling.

## Existing UI reuse

Reuse the existing Reference footer outside the three tab panels, below the active
Concept content. Keep its authored label escaped as text, Official source versus
Reference source wording, new-tab notice, target=_blank and
rel="noopener noreferrer". Keep the existing safe text fallback and Topic back
link. Do not render labels as Markdown or HTML.

The same source remains available in Read, Example and Revise, including empty
Example/Revise states. Tab changes must not cause additional Concept or source
requests. Preserve one page h1, footer h2, semantic links, visible keyboard focus,
tab order, responsive wrapping and contained code scrolling. No CSS/component
changes are planned. If verification exposes a UI defect requiring them, stop for
scope approval instead of expanding this inventory.

## Exact implementation boundary: 11 files

One new feature document (created during planning), ten existing files within
the owner-approved implementation scope:

| File | Purpose |
| --- | --- |
| docs/features/F025-source-link-requirement.md | Plan, authorized status transitions, evidence and limitations |
| docs/DEVELOPMENT_ROADMAP.md | F025 status/evidence only; preserve prior approvals |
| docs/API_DESIGN.md | Clarify unchanged source DTO, validation/security and editorial deferral |
| docs/DATABASE_DESIGN.md | Document source validation refinements and legacy/write-path limits |
| apps/api/src/modules/concepts/concept.model.ts | Source-local type/coercion and URL-policy hardening |
| apps/api/tests/concept-model.test.ts | Focused source validation and compatibility cases |
| apps/api/tests/concept.integration.ts | Gated persistence/readback and unchanged API checks |
| apps/web/src/lib/concepts/contracts.ts | Align source DTO URL checks with safe-link policy |
| apps/web/tests/concept-client.test.ts | DTO rejection, compatibility and request-safety cases |
| apps/web/tests/concept-rendering.test.ts | Existing footer behavior across modes and escaped labels |
| tests/browser/concept-read.spec.ts | Narrowly selected source acceptance scenarios using existing fixtures |

No other file is authorized by this plan. Reuse the existing root/feature
Playwright configurations unchanged; the canceled catalog consolidation is not
part of F025. Do not add scripts, configuration files, endpoints, dependencies or
testing infrastructure. No mandatory edit should be made solely to reach a count;
report the actual subset changed within this exact approved boundary.

## Verification and acceptance criteria

### Focused offline development checks

Use existing Node/Mongoose, frontend contract and rendering test patterns. No
database connection, browser or application startup is needed for these checks.

1. Model validation: required object/fields; null/array/unknown-field rejection;
   label lengths 0/1/120/121 after trimming; URL boundary 2,048/2,049 using valid
   fixtures; explicit false/true; rejection of string/number Boolean substitutes,
   number/object string substitutes and invalid classification.
2. URL parity: valid compatibility matrix above; unsafe schemes, relative URLs,
   credentials, whitespace, backslashes/control characters and malformed hosts
   rejected by model and DTO checks. Assert no fetch or URL rewriting is used.
3. Client behavior: valid source survives detail parsing; malformed source uses
   existing safe error/Retry behavior; list contracts, request headers and existing
   cancellation/account-isolation behavior are preserved. Reuse passing evidence
   for unchanged areas rather than rerunning unrelated suites routinely.
4. Rendering: source is below each mode, correct true/false wording, label escaping,
   safe href/rel/target/new-tab notice, and existing fallback behavior. Do not treat
   static rendering as proof of mounted keyboard behavior.
5. Run relevant formatting, lint, typecheck and build checks after implementation;
   review dependency/scope/security changes. Do not start development watchers or
   change the private local environment. Record actual results, never planned PASS.

### Separately approved focused Chrome acceptance

Use existing playwright.f022.config.ts and named source scenarios in
tests/browser/concept-read.spec.ts. Confirm the exact selection using --list before
the separately authorized execution; do not run full F022/F023/F024 suites for a
routine source-only change. Use installed Chrome, mocked APIs, isolated contexts,
one worker, zero retries and existing navigation/assertion timeouts.

Cover source presence across Read/Example/Revise, both classification labels,
escaped hostile label text, malformed-source errors/explicit Retry, safe-link
attributes, actual keyboard focus, and 1280/768/390px layouts without page overflow.
Verify no extra Concept fetch on mode switching and no source fetch during render;
retain credential/auth-isolation assertions. Do not navigate to real source sites.
Use existing bounded navigation synchronization where already supported; no fixed
sleeps, timeout increases or configuration maintenance under this feature.

Capture failures, stop without automatic fixes/retries, close only test-owned
Chrome/Next processes and verify port release. Report forced Windows server
termination separately. Mocked browser APIs do not establish real backend
integration, editorial trust, destination availability or production readiness.

### Separately approved isolated MongoDB integration

Extend the existing Concept integration suite/fixtures only. Execution requires
its own owner gate and independently verified disposable instance/storage,
identity, PRIMARY readiness, database emptiness and required indexes. Never use
the persistent demo database, regular MongoDB, Atlas or an environment fallback.
Confirm actual harness parameters before execution rather than inventing a target.

Verify valid legacy-shaped source persistence/readback, true/false metadata,
normalization limited to label trimming, rejected malformed/coercible values,
detail source projection, source-free list DTOs, unchanged hierarchy/index rules
and non-mutating reads. Use existing valid published fixtures; no demo-content or
account changes. Close connections, clean only run-owned disposable resources,
verify process/port release and preserve evidence on failure. Passing this suite
does not establish missing-source rejection in future Admin approval endpoints.

## Deferrals, limitations and approval gates

Source preference remains an editorial policy: official documentation, official
specifications, vendor documentation, then trusted technical sources. F047-F051
must enforce the deferred approval/publishing requirement and determine actual
trust; F025 does not implement those workflows or claim that policy was verified.
Exclude multiple sources, link health checking, broken-link reporting, Admin UI,
AI, source scraping, auto-publication, new endpoints/indexes, migrations and local
demo-content/account changes. Preserve all other deferred Concept functionality.

Retain prior F020-F024 production-release limitations: outstanding F020 browser
coverage, browser-to-live-backend integration, unproven internal generation-check
execution after cancellation, live dependency-failure injection, normal Atlas
startup and graceful Windows Next.js shutdown. Retain local tooling limitations,
including Admin login and full Stop/Start persistence evidence where still
NOT_VERIFIED. Intermittent cold development-route latency remains unresolved;
the canceled Playwright consolidation supplied no new permanent infrastructure.
This plan and subsequent development closure do not authorize deployment.

There are no unresolved contract decisions after the owner's explicit editorial
deferral and validation-hardening approval. If a valid approved URL is rejected,
or additional files/behavior are necessary, stop and report before proceeding.

1. Planning, implementation and focused offline verification are complete.
2. Separately authorized targeted Chrome, isolated MongoDB and full browser
   regression gates passed; retained evidence is recorded below.
3. Final acceptance review passed. The owner-authorized conditional transition
   sets F025 to READY_FOR_REVIEW within the approved 11-file boundary.
4. The owner subsequently approved APPROVED_COMPLETE and the feature-only
   commit/push on 2026-10-14. Production deployment remains unauthorized.

**Planning verification:** Existing contracts and implementation were inspected;
no tests, browser/service/database operations or implementation changes were run.
This describes the planning checkpoint only. Subsequent implementation, browser
and database results are recorded below.

## Implementation and offline evidence - 2026-10-14

Implementation is complete within the eleven listed files. Source fields now
reject Mongoose coercion, invalid containers and unsafe raw URL forms; the DTO
reuses safeHttpsUrl without changing that helper or the Markdown renderer.
Existing source storage/projection, components, CSS, route/service/repository code,
indexes, dependencies and private local tooling are unchanged. No source fetching,
automatic record update or new endpoint was introduced.

| Verification | Result |
| --- | --- |
| Concept API model/service/DTO/routes plus mocked local-tooling regressions | 51/51 PASS |
| Concept client/controller/rendering/Markdown regressions | 36/36 PASS |
| New F025 cases included in those totals | 6/6 PASS (3 model, 2 client, 1 rendering) |
| Root build (packages, student web, admin, API) | PASS |
| Root lint, workspace typecheck, root format:check | PASS |
| Updated browser specification standalone strict TypeScript and lint | PASS |
| Scope/dependency/security review | PASS; only approved files changed |
| Separately authorized targeted F025 Chrome | 3/3 PASS; zero retries |
| Separately authorized isolated MongoDB integration | 4/4 PASS; three scenarios plus parent |
| Full browser regressions: F022 / F023 / F024 / smoke | 27/27 / 16/16 / 19/19 / 1/1 PASS; 63/63 total |

Offline commands used existing infrastructure:

```text
# apps/api
node --import tsx --test tests/concept-model.test.ts tests/concept.test.ts tests/concept-routes.test.ts tests/local-tools.test.ts
# apps/web
node --import tsx --test tests/concept-client.test.ts tests/concept-controller.test.ts tests/concept-rendering.test.ts tests/concept-markdown.test.ts
# repository root
npm run build
npm run lint
npm run typecheck
npm run format:check
node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --esModuleInterop --skipLibCheck tests/browser/concept-read.spec.ts
```

Model tests cover valid legacy source data, trimming, bounds, wrong types,
unknown fields and valid URL variants. Client tests verify unchanged detail
metadata, source-free summaries, safe malformed-response handling and API-only
credential-free requests. Rendering tests cover true/false labels, escaped text,
safe attributes, footer placement and existing fallback across all three modes.
Existing hierarchy/DTO/index/error/cancellation regressions passed. Existing
Mongoose validateSync deprecation warnings are non-failing; no dependency upgrade
or unrelated test rewrite was made.

Three new browser scenarios passed with the prefix F025: two source-footer
cases (official=false/true, each covering all modes and three viewport widths),
and one malformed-source/explicit Retry case. They reuse the existing mock
handler, enforce source/request isolation and use actual keyboard input for focus
checks. Existing browser scenarios/configurations are preserved. The targeted
selection was confirmed by --list and executed under separate owner approval:

```text
npm run test:browser -- --config=playwright.f022.config.ts --grep "F025" --list
npm run test:browser -- --config=playwright.f022.config.ts --grep "F025"
```

The existing MongoDB suite was extended and passed live verification: invalid-source save
rejection, exact boundary persistence, legacy false/official true readback,
unmodified URL spelling, detail-only source and unchanged non-mutating HTTP
checks. This establishes persistence and local database-backed HTTP evidence,
not browser-to-live-backend or future Admin publishing integration.

No unresolved acceptance defect was found. Mounted accessibility, responsive
behavior and isolated persistence passed their separately approved gates. Cold
route latency and Windows forced web-server cleanup remain known limitations.

## Final acceptance review and retained execution evidence - 2026-10-14

**Final review: PASS.** All eleven approved files were reviewed against this plan.
Source-local strict typing, required fields, label/URL bounds, legacy URL
compatibility, detail-only source projection and safe footer reuse are verified.
No application endpoint, dependency, index, authentication, hierarchy, migration
or unrelated feature change was introduced. The existing footer escapes labels,
uses safe external-link attributes and remains keyboard-accessible across Read,
Example and Revise. No source fetching or additional catalog requests occur.

Targeted Chrome: 3/3 PASS, runner exit 0. Full browser regression ran each existing
configuration once, sequentially, with one worker, zero retries, unchanged
assertions/timeouts and --max-failures=0 to collect independent results. Discovery
and execution agreed: F022 27 (24 existing plus three F025), F023 16, F024 19 and
root smoke 1. All 63 passed; zero failed, skipped, flaky or not-run scenarios.
Every runner exited 0. Combined wall time, including startup/cleanup checks, was
507.743 seconds (8m 28s), within the 25-minute budget. No troubleshooting was needed.
Navigation, all three modes, keyboard/focus, responsive overflow, restricted
Markdown, error/Retry, role guards, cancellation and account isolation passed.

MongoDB: 4/4 PASS after a separately authorized corrected procedure. The earlier
preflight failed before fixtures because it listed databases before PRIMARY;
its cleanup bookkeeping failure was recovered by verified graceful shutdown.
The corrected single run verified fresh owned storage, loopback 127.0.0.1:27018,
replica f021-test, confirmed PRIMARY, then empty deeplearner-f021-test before
fixtures. Procedure duration 23.72s; test runner duration 10.607s. Initialization,
test, shutdown, MongoDB and wrapper exits were all 0. Owned collections were
independently confirmed removed, MongoDB exited gracefully, the port was released
and only that run's disposable storage was removed. Persistent demo-storage
metadata and unrelated MongoDB were preserved; previous failure evidence remains.

Browser cleanup and preservation: PASS. Chrome exited gracefully with code 0;
Playwright's Windows Next.js process-tree teardown was forced, not proof of
graceful web shutdown. Recorded owned processes exited; ports 3000/4000/5173/27018
were free. All 356 checkpoint file hashes matched before documentation updates.
Only this feature document and the roadmap changed during the final review gate.

Retained ignored evidence:

- .cache/playwright/results/f025-source-2026-10-14T05-39-08Z/: targeted runner logs/exits.
- .cache/f025-integration-2026-10-14T05-50-25-586Z/: failed preflight and recovered cleanup.
- .cache/f025-integration-2026-10-14T05-59-26-851Z/: successful preflight, tests, shutdown and result.json.
- .cache/playwright/results/f025-full-2026-10-14T06-05-45-142Z/: four discovery listings, JSON reports, runner logs/exits, execution timing and cleanup-preservation.json.

The offline 51/51 API/tooling, 36/36 web and passing build/lint/typecheck/format
evidence was reused without reruns. Mocked browser APIs do not establish live
browser/backend integration, canceled responses do not prove internal generation
checks, and metadata validation does not verify source trust or reachability.
Admin approval/publishing enforcement remains explicitly deferred to F047-F051.
All prior production/tooling limitations above remain; no production release is
authorized. F001-F024 remain APPROVED_COMPLETE; F026 remains NOT_STARTED.
F025 is APPROVED_COMPLETE following explicit owner approval on 2026-10-14.
The approved delivery scope contains only these eleven feature files; all
verification evidence and release limitations remain retained.

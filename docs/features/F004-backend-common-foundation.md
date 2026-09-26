# F004 — Backend Common Foundation

## Status

APPROVED_COMPLETE. The owner explicitly approved completion on 2026-09-26 after verification, including the separately approved environment-validation fix. F005 remains NOT_STARTED.

## Goal

Establish the common HTTP foundation for future modules while preserving the Express modular monolith.

## Scope

Standard response helpers, safe application errors, centralized error handling, route-not-found responses, request IDs, structured logging, redaction, CORS, security headers, bounded JSON parsing, typed Zod request validation, and focused tests. Preserve GET /api/v1/health as process liveness only.

## Out of Scope

Databases, models, authentication, tokens, sessions, cookies, OAuth, email delivery, S3, AI, future feature routes, frontend integration, and F005.

## Architecture Decisions

- Preserve existing app/server separation and middleware structure.
- Follow API_DESIGN.md's envelope with success and meta.requestId; its detailed contract takes precedence over the older architecture example for this feature, as approved.
- Change unknown-route code from NOT_FOUND to ROUTE_NOT_FOUND, as approved.
- Disable credentialed CORS until a future authentication feature requires it, as approved.
- Retain Helmet defaults, exact environment-driven origins, the 256 KB JSON limit, existing request-ID validation, and application-specific environment validation.
- Use Express 5 native promise rejection handling; no async-handler package.
- Pass typed Zod output directly to a route handler rather than mutating Express query getters.
- Log developer-defined route labels and selected metadata, never raw URLs, request payloads, or exception messages.
- Reuse shared contracts unchanged. Middleware, errors, logging, and validation infrastructure stay API-local.
- Add Node built-in tests using existing tsx and a separate test typecheck configuration; no new dependencies.
- Approved follow-up: guard URL parsing in the existing environment validator. Tests discovered malformed CORS origins could throw before sanitized validation and print rejected input. The owner approved this narrow env.ts fix before implementation; no variables or configuration semantics are added.

## Files Changed

Created:

- apps/api/src/middleware/validate.ts
- apps/api/tests/foundation.test.ts
- apps/api/tests/logging.test.ts
- apps/api/tests/env.test.ts
- apps/api/tsconfig.test.json
- docs/features/F004-backend-common-foundation.md

Modified:

- apps/api/src/app.ts
- apps/api/src/config/env.ts (separately approved URL-parsing guard)
- apps/api/src/common/errors/app-error.ts
- apps/api/src/common/http/response.ts
- apps/api/src/common/logging/logger.ts
- apps/api/src/middleware/error-handler.ts
- apps/api/src/middleware/not-found.ts
- apps/api/src/middleware/request-logger.ts
- apps/api/src/modules/health/health.routes.ts
- apps/api/src/types/express.d.ts
- apps/api/package.json
- docs/DEVELOPMENT_ROADMAP.md

## Dependencies

None added. Existing Express, Helmet, CORS, Pino, Zod, tsx, and TypeScript are sufficient. Tests use node:test, node:assert, and native HTTP facilities.

## API Conventions

Success: success=true, data, nullable message, meta.requestId. Error: success=false, error.code/message, optional safe field/message details, meta.requestId. X-Request-Id matches the envelope. Schema/malformed JSON failures use 400 VALIDATION_ERROR; oversized JSON uses 413 PAYLOAD_TOO_LARGE; unsupported parser encoding uses 415 UNSUPPORTED_MEDIA_TYPE; CORS rejection uses 403 ORIGIN_NOT_ALLOWED; unknown routes use 404 ROUTE_NOT_FOUND; unexpected failures use 500 INTERNAL_ERROR.

Future routes can compose `routeLabel('/api/v1/resource/:id')` and `validateRequest(schema, handler)`. The schema describes body, params, and query; the handler receives `(req, res, input)` with inferred parsed output. Await service calls so Express 5 receives promise failures. Strict object schemas reject unknown fields where appropriate. Do not use raw request data after validation or assign to req.query. Health requires no artificial input schema.

Application errors must use developer-authored safe messages/details. Validation details are capped at 20 issues and five path segments; only schema-declared object keys and bounded array indices are exposed. Unknown/dynamic keys and opaque schema wrappers fall back to the last known parent. Custom Zod messages are replaced with controlled public messages.

## Security Considerations

No bodies, headers, cookies, raw URLs, query/parameter values, secrets, raw errors, or stacks in operational logs. Redaction is defense in depth, not a substitute for safe field selection. Public validation details use bounded safe field paths and controlled messages. Client request IDs are correlation labels only. CORS is not authorization; no-Origin clients remain supported. Existing future-secret placeholders remain inactive.

## Acceptance Criteria

- [x] Standard success/error envelopes and safe details.
- [x] Sanitized sync/async failures and parser errors.
- [x] Standard 404 and consistent request IDs.
- [x] Safe structured request logs and sensitive-value exclusion.
- [x] Exact CORS, credentials disabled, Helmet defaults, bounded JSON.
- [x] Typed body/params/query validation without request mutation.
- [x] Health remains database-independent; no extra production routes.
- [x] Build, lint, typecheck, tests, formatting, smoke checks, and diff review pass.
- [x] No unapproved scope or dependency changes; F005 untouched.

## Verification

Verified on 2026-09-26:

- PASS: `npm.cmd run build` for all workspaces.
- PASS: `npm.cmd run lint` with zero warnings.
- PASS: `npm.cmd run typecheck`, including API tests through tsconfig.test.json.
- PASS: `npm.cmd run test --workspace=@deeplearner/api`: 15 tests passed, zero failures/skips.
- PASS: Prettier checks for API source, tests, API package/test configuration, and this feature document.
- PASS: built-JavaScript app smoke on an ephemeral loopback port: health 200, matching envelope/header request ID, unknown route 404 ROUTE_NOT_FOUND, rejected origin 403, malformed JSON 400, allowed-origin headers, credentials absent, and Helmet headers. Server closed after verification.
- PASS: source/diff scope and whitespace review (preserving existing Markdown hard-break spaces).

Regression tests cover body/params/query transforms and defaults, strict unknown-field rejection, safe bounded details, dynamic-key/custom-message secrecy, async refinements, known errors, unexpected synchronous/asynchronous/thrown-object failures, generated/supplied/duplicate request IDs, CORS allowlist and preflight, no-Origin requests, security headers, 256 KB parsing boundary, malformed JSON, unsupported charset/encoding, captured Pino fields/redaction, and valid/invalid local/hosted environment configuration. Test-only failure/validation routes are not imported into the production app.

Initial sandbox runs encountered tsx's Windows OS-user-information restriction and a blocked Google Fonts download from the unchanged web app. Tests and build passed when rerun with the necessary execution/network permissions. The environment test exposed the pre-existing URL parsing bug; implementation paused, the owner approved the narrow guard, and its regression test now passes. No dependency installation or frontend workaround was used.

## Known Limitations

- No authentication, persistence, distributed logging, or rate limiter is introduced by F004.
- Redaction covers listed root/one-level fields and request/response containers, not arbitrary-depth objects or secrets embedded in free text. Future callers must keep using explicitly selected safe fields and fixed log messages.
- Request completion logs use the response finish event; disconnected requests before completion are not recorded as completed responses.
- Safe validation paths intentionally become less specific behind dynamic records/opaque wrappers. Backend validation remains authoritative.
- CORS credentials are intentionally disabled; future cookie authentication must explicitly enable its approved policy.
- Transport errors rejected before Express and responses already sent cannot receive a new JSON envelope. Existing headers-sent delegation is retained.
- Verification is local; deployment/proxy, load, and complete security testing remain future work. The existing web font build requires network access when fonts are not cached.

## Completion Notes

Approved plan recorded and F004 set to IN_PROGRESS before implementation. Reused the existing scaffold and shared contracts; no dependencies, backend integrations, or future routes added. The sole plan adjustment was the explicitly approved URL-parsing guard in env.ts. Verification completed and F004 moved to READY_FOR_REVIEW, then APPROVED_COMPLETE following explicit owner approval on 2026-09-26. No F005 work performed. After approval, the owner requested committing and pushing F004 to dev. Commit reference: `feat(api): complete F004 backend common foundation` on `dev`.

# DeepLearner

DeepLearner is a visual-first technical learning platform. This repository currently contains its approved foundation: a Next.js public/student shell, a separate React/Vite Admin shell, and an Express modular monolith with a health endpoint.

## Prerequisites and setup

- Node.js 24.x and npm 11.x (baseline: Node 24.15.0, npm 11.12.1).
- Run installation and root commands from the repository root.
- On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`. No policy change is needed.

```sh
npm ci
npm run dev
```

The scaffold runs without environment files or external credentials. For local overrides, copy the relevant example to the destination below. Never commit actual environment files.

| Application | Example                   | Local destination       |
| ----------- | ------------------------- | ----------------------- |
| Web         | `apps/web/.env.example`   | `apps/web/.env.local`   |
| Admin       | `apps/admin/.env.example` | `apps/admin/.env.local` |
| API         | `apps/api/.env.example`   | `apps/api/.env`         |

Next.js and Vite load their app-local environment files. The API uses Node's `--env-file-if-exists=.env` in its workspace scripts. Hosted process variables take precedence over the API file. There is no root runtime environment file.

## Commands

| Command                | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`          | Build shared packages once, then watch both packages and run all three apps  |
| `npm run dev:web`      | Shared package build/watch and Next.js development server                    |
| `npm run dev:admin`    | Shared package build/watch and Vite development server                       |
| `npm run dev:api`      | Shared package build/watch and API development server                        |
| `npm run build`        | Build shared packages first, then Web, Admin, and API                        |
| `npm run lint`         | ESLint for all scaffold source/configuration; warnings fail                  |
| `npm run typecheck`    | Build package declarations, generate Next route types, check every workspace |
| `npm run format`       | Format scaffold source/configuration and this README                         |
| `npm run format:check` | Check formatting without modifying files                                     |

Run one combined development command at a time to avoid duplicate watchers or port conflicts. `concurrently` stops sibling processes if a process exits. Ctrl+C stops the development session.

| App        | Local URL                             |
| ---------- | ------------------------------------- |
| Web        | <http://localhost:3000>               |
| Admin      | <http://localhost:5173>               |
| API        | <http://localhost:4000>               |
| API health | <http://localhost:4000/api/v1/health> |

After building, start Web with `npm run start --workspace=@deeplearner/web` and API with `npm run start --workspace=@deeplearner/api`. Preview Admin with `npm run preview --workspace=@deeplearner/admin`; deployment serves `apps/admin/dist` through a static host, not Vite's preview server. Each app remains independently deployable.

## Repository and boundaries

```text
apps/
  web/                 Next.js App Router public/student application
  admin/               React + Vite administration application
  api/                 Express modular monolith, REST /api/v1
packages/
  shared-types/        Shared transport contracts only
  validation/          Reserved for future shared API/domain schemas
docs/                  Product and architecture sources of truth
```

The root is a private npm workspace with one lockfile. Dependencies are declared by their consumer; internal packages use matching local versions. Shared packages compile to ESM and declarations in `dist/`. Root scripts explicitly build dependencies before applications; development watchers keep package output current. Use package exports, not another workspace's source paths. No additional monorepo task framework is used.

`shared-types` contains response envelopes, response/pagination metadata, and process-health contracts. It contains no database models or persistence types. `validation` has only its package entry point for now: add Zod and real shared schemas when a domain first needs them. It does not contain environment validation.

Application-specific environment validation lives in:

- `apps/web/src/lib/env.ts`
- `apps/admin/src/lib/env.ts`
- `apps/api/src/config/env.ts`

The API separates app construction from process lifecycle. Request IDs are initialized before handlers and typed through `src/types/express.d.ts`. Expected HTTP failures use `common/errors/app-error.ts`; unknown failures return a sanitized response. Logs contain selected operational fields, not request bodies, headers, query strings, or raw errors.

Future API modules follow route/controller → service → repository/model. Middleware runs before controllers. Modules own their persistence and expose services for cross-domain operations. The only initial module is `health`; no empty future module directories are created.

Web routes start in `src/app/(public)`. Future `(auth)`, `(onboarding)`, and `(student)` groups will own their layouts while feature code lives under `src/features`. Route groups do not add URL segments; routes must remain unique. Future Admin routing/providers belong in `src/app`, feature screens in `src/features`, and reusable layout/UI in `src/components`. Neither shell implements authentication or an access-control boundary.

## API foundation

`GET /api/v1/health` returns HTTP 200:

```json
{
  "success": true,
  "data": { "status": "ok", "service": "deeplearner-api" },
  "message": null,
  "meta": { "requestId": "..." }
}
```

This checks process liveness only. It does not report database or external-provider readiness. Unknown routes return HTTP 404 with `success: false`, error code `NOT_FOUND`, and `meta.requestId`. Both responses include `X-Request-Id`. Safe client correlation IDs are accepted; absent/invalid IDs are replaced with a server-generated UUID.

The API uses Helmet, a 256 KB JSON limit, an exact CORS origin allowlist, structured logs, and central errors. Requests without an Origin header can reach health (e.g. probes); disallowed browser origins receive 403. CORS is not authentication. No auth/cookie endpoints exist yet.

## Environments and secrets

`APP_ENV` distinguishes `LOCAL`, `DEVELOPMENT`, and `PRODUCTION` on the API. It is separate from framework `NODE_ENV`: a hosted development environment can run a production build. Hosted CORS origins must use HTTPS. Set the exact frontend origins explicitly for hosted deployments.

Public Web/Admin API URL values are build-time configuration. Set the appropriate values when building for each environment. All frontend-prefixed values must be safe for public disclosure.

Future MongoDB, token signing, Google, AWS, and AI variables are blank, documented placeholders in the API example. They are not loaded or required by this scaffold. Keep development and production resources/credentials separate. Use hosting secret management for hosted secrets. Google ID-token verification alone does not need a client secret. The approved future refresh-token design uses opaque random secrets, not a refresh JWT signing key.

## Architecture documents and deferred work

- [Product requirements](docs/PRD.md)
- [System architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [API design](docs/API_DESIGN.md)

The documents were moved from `Doc/` to `docs/` without content changes. The scaffold follows the API document's detailed success/error envelopes. Shared configuration remains in root files rather than a third package. App-specific environment validation is intentional.

The approved boundary excludes authentication, database connections/models, dashboards, content hierarchy features, practice, S3, AI, visualizations, and code execution. Their dependencies are not installed. The broader documents describe future work, not permission to implement it during scaffolding.

Before relevant feature work, reconcile the documents' user naming/profile fields and statuses against the API contract; resolve short public lesson URLs versus topic-scoped slug uniqueness, and unscored practice attempts versus required scores. Do not silently rewrite these source documents.

## Git and checks

Use `main` and short-lived `feature/*` branches with pull requests. No permanent `develop` branch is needed. Commit source, safe `.env.example` files, and the root lockfile. Ignore actual environment files, credentials, dependencies, generated declarations/build outputs, coverage, logs, and temporary files.

Before merging, run build, lint, typecheck, and format checks, then smoke-test both shells and the API health/404 responses. Prettier excludes the source architecture documents to preserve their original contents. CI/deployment configuration is deferred.

Git attributes keep scaffold text files on LF across platforms and preserve the original document bytes. ESLint 9 is retained for compatibility with Next.js's React/accessibility lint plugins; npm currently marks ESLint 9 unsupported. Upgrade the lint stack together when those plugins support ESLint 10. Do not force incompatible peer dependencies.

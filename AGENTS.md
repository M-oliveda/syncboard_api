# SyncBoard API — Coding Style & Best Practices

This repo is **SyncBoard API**: an Express.js + TypeScript REST API and Socket.io
real-time layer, backed by MongoDB Atlas (Mongoose) and Redis Cloud (Socket.io Pub/Sub
adapter only), containerized and deployed to Google Cloud Run. Product/API details live
in [`README.md`](./README.md); full architectural rationale lives in
[`MASTERPLAN.md`](./MASTERPLAN.md). This file is the single instructions file for anyone
(human or agent) working in this repo — coding style, stack-specific conventions, and
project/workflow rules — and is what `CLAUDE.md` (a symlink to this file) resolves to.
It intentionally covers only the stack this project actually uses; instructions here
override default agent behavior and must be followed exactly.

## Project Snapshot

Phases 0–6 are built: project scaffolding, the full REST API (routes/services/models for
auth, workspaces, boards, lists, cards), `passport-jwt` auth hardening, CI/CD
(`ci.yml`/`deploy-dev.yml`/`deploy-staging.yml`/`deploy-prod.yml`), the Socket.io
real-time layer (`src/sockets/`) with the `@socket.io/redis-adapter`, transactional
email via Resend + React Email (`src/emails/`, `src/services/email.service.ts`) wired
into registration (welcome email) and password reset — `email.service.ts` throws on a
Resend API error payload, but `auth.service.ts` catches and logs that failure rather
than letting it fail registration or password reset — and observability/docs polish:
structured HTTP access logging with request-correlation IDs
(`src/middleware/httpLogger.ts`, threading `req.id` through Winston's `logger.http`), a
completed `src/docs/v1/openapi.yaml` served via Swagger UI at `/api/v1/docs`, and RFC
7807 error handling centralized in `src/utils/errors.ts`
(`toProblemPayload`/`InternalServerError`), reused by both
`src/middleware/errorHandler.ts` and `src/sockets/socketError.ts`. Refresh-token
handling is implemented as a real HttpOnly cookie (`cookie-parser`,
`src/utils/authCookie.ts`, CORS `credentials: true`) — not aspirational — and
`Workspace.members.userId` is populated with the member's email on read paths
(`workspace.service.ts`) so `syncboard_web`'s Members panel has something to render; the
same field stays an unpopulated `ObjectId` on paths used for authorization
(`assertWorkspaceAccess`/`authz.ts`), which still needs raw `.toString()` comparisons.
`GET /cards/:cardId/activity` is documented but **not implemented** — no `Activity`
model/service/route exists. See `MASTERPLAN.md` §12 for the authoritative, up-to-date
phase checklist rather than relying on this paragraph, which will drift as phases
complete. Treat `README.md`/`MASTERPLAN.md` as the target contract for anything not yet
built; check what actually exists in the repo before assuming a file or script is there.

## Mandatory: Generate a Coding Plan First

**Before implementing any new feature, fix, or change of medium or higher complexity,
generate a coding plan and get it in front of the user before writing code.** Use plan
mode (`EnterPlanMode`/`ExitPlanMode`) for this — don't just describe the plan in prose
and start editing.

A change counts as medium-or-higher complexity if it does **any** of the following:

- Adds, removes, or changes a REST endpoint or Socket.io event
- Touches more than one architectural layer (e.g. route + service + model)
- Changes a Mongoose schema, index, or the reorder/fractional-ordering logic
- Touches auth, authorization, password/token handling, or CORS/rate-limit config
- Changes CI/CD, Docker, or deployment configuration
- Is a bug fix that isn't a one-line/obvious change

Skip planning only for genuinely trivial edits: fixing a typo, a doc-only change, a
one-line config tweak, or a routine dependency bump. If it's ambiguous whether a task is
trivial, plan it.

## Commands

Per `README.md#development`, matching the scripts actually defined in `package.json`:

```bash
npm run dev                # Start with hot reload
npm run seed                # Populate local MongoDB with dev seed data (refuses on production)
npm run build               # Compile TypeScript
npm run start                 # Run compiled build

npm run test                  # All tests
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests only (Supertest)
npm run test:watch            # Watch mode for TDD
npm run test:coverage         # Coverage report — CI fails below 100%

npm run lint                   # ESLint
npm run lint:fix                # Fix linting issues
npm run format                   # Prettier — write
npm run format:check            # Prettier check
npm run type-check              # tsc --noEmit
```

## Explicit Non-Goals

Per `MASTERPLAN.md` §2.4 — do not introduce these without an explicit user request:

- File/attachment storage (no S3/GCS)
- Offline-first sync or CRDTs (last-write-wins is intentional)
- Multi-region active-active deployment
- GraphQL (REST + WebSockets only)

---

## JavaScript/TypeScript Language & Style

- Use `const` for values that never change and `let` for those that do; never use `var`
- Prefer arrow functions for callbacks and short functions; use named functions when
  they improve readability or stack-trace debugging
- Use template literals instead of string concatenation
- Destructure objects and arrays for clarity and immutability; never mutate function
  parameters
- Use spread/rest instead of `Object.assign()` or manual copying
- Favor optional chaining (`?.`) and nullish coalescing (`??`) for safe access/defaults
- Always return early to reduce nesting
- Use ES Modules (`import`/`export`); prefer named exports over default exports
- Use `Array.prototype.map`/`filter`/`reduce` for data transformation; avoid deeply
  nested `.then()` chains — use `async/await`
- Use `Promise.all`/`Promise.allSettled` for independent parallel work
- Never extend native prototypes; avoid global/mutable shared state; don't rely on side
  effects to control function output

### Formatting (enforced by Prettier — see `.prettierrc.json`)

- 4-space indentation, double quotes, semicolons, trailing commas, 88-char print width
- Don't hand-format — run `npm run format` / rely on the pre-commit hook
- `camelCase` for variables, functions, and object properties

### TypeScript

- `strict: true` in `tsconfig.json`; never use `any` — prefer `unknown` with narrowing
- Prefer `interface` for object shapes, `type` for unions/intersections/mapped types
- Use built-in utility types (`Partial`, `Pick`, `Omit`, `Record`, etc.) over
  hand-rolled equivalents
- Use discriminated unions and type guards for runtime type narrowing
- Use explicit return types on all exported functions/methods
- Group imports: external → internal (`@/...` alias) → relative
- Split a file into smaller modules once it exceeds ~500 lines
- Business logic lives in `services/` (see Express section) — controllers/routes stay
  thin and never talk to Mongoose models directly

### Error Handling

- Always handle rejections in `async`/`await` and Promise chains; never leave an empty
  `catch` block
- Use `try/catch` where failure is expected, not as control flow
- Create custom, domain-specific error classes (e.g. `NotFoundError`, `ValidationError`)
  and `throw` them from services — never format an error response inline in a route
  handler; the centralized `errorHandler` middleware is the only place that converts
  errors to the RFC 7807 response shape (see Express section)

### Naming

- Descriptive names over abbreviations (except `id`, `URL`, `API`)
- Verbs for functions (`fetchBoard`, `computeOrderBetween`)
- `is`/`has`/`can` prefixes for booleans
- Plural names for arrays/collections (`cards`, `members`)
- `UPPER_SNAKE_CASE` for exported/shared constants

### Testing & Logging

- Jest + Supertest for all tests; write both happy-path and error-path cases
- Never use `console.log` in application code — use the Winston logger (see Express
  section)
- Never commit secrets, and never log tokens, password hashes, or full JWTs

### Security

- Validate and sanitize all external input at the boundary (Zod — see below); never
  trust a client-supplied `workspaceId`/`userId` for authorization decisions
- Never use `eval()`, `Function()`, or dynamic `import()` with user-controlled input
- Never hardcode secrets — all secrets come from environment variables (`.env` locally,
  Secret Manager in deployed environments)

---

## Express.js Conventions

### Project Structure

Organize by feature/layer under `src/`, matching the layout documented in
[`README.md`](./README.md#project-structure):

```text
src/
├── index.ts        # Server entrypoint (listen) — separate from app construction
├── app.ts          # Express app construction/middleware wiring — no listen() here
├── config/         # Env, DB, Redis, Socket.io, Passport setup
├── middleware/      # auth, validate, rateLimit, httpLogger, errorHandler
├── routes/v1/       # express.Router() per resource, mounted under /api/v1
├── services/        # Business logic + the only layer that imports Mongoose models
├── models/          # Mongoose schemas
├── sockets/         # Socket.io server, Redis adapter wiring, event handlers
├── emails/          # React Email templates
├── utils/           # Pure helpers (reorder.ts, logger.ts)
└── docs/v<n>/        # OpenAPI 3.0 spec per API version

scripts/             # Standalone dev-only scripts run via tsx (e.g. seed.ts)
```

- Keep `src/index.ts` limited to bootstrapping (connect DB/Redis, then `listen`);
  `src/app.ts` only constructs and configures the Express app so it can be imported
  standalone by Supertest in integration tests
- Never put business logic inside a route handler — delegate to `services/`
- Never mount application-level middleware inside a route file

### Middleware Pipeline

Middleware must run in this exact order (see `MASTERPLAN.md` §6.4):

```text
requestId → morgan(logger) → helmet → cors → rateLimit
          → express.json() → route → passport.authenticate("jwt", { session: false })
          → zodValidate(schema) → controller → service → errorHandler
```

`errorHandler` is the single centralized error-handling middleware
(`(err, req, res, next)` signature) and the only place that formats an RFC 7807
(`application/problem+json`) error response. No route handler formats errors directly.

### API Design

- Every route lives under `/api/v<n>`; breaking changes ship as a new version prefix,
  never as a mutation of an existing one. Each version gets its own Swagger UI
  (`/api/v<n>/docs`) generated from its own `src/docs/v<n>/openapi.yaml`
- Resource-oriented, nested-by-ownership routes (`/workspaces/:id/boards`,
  `/boards/:id/lists`, `/lists/:id/cards`) — never verb-suffixed action routes
  (`/reorder`, `/move`). Reordering/moving is just a `PATCH` of `order`/`listId`
- `POST` creates, `GET` reads, `PATCH` partially updates, `DELETE` removes — no `PUT`
- Every `GET` collection endpoint supports `?page=`, `?limit=`, `?sort=`
- Success responses use the standard envelope (`{ success, data, message? }` or
  `{ success, data, pagination }` for collections); errors always use RFC 7807

### Database Integration (MongoDB Atlas + Mongoose — not SQL/Prisma)

- Only `services/*.service.ts` files import and query Mongoose models for business logic
  — routes and controllers never touch a model directly (keeps DB access
  swappable/testable). The exceptions are identity-verification code
  (`config/passport.ts`'s strategy callback, `sockets/index.ts`'s handshake middleware —
  both do a direct `UserModel.findById` to resolve `req.user`/`socket.data.user`, not a
  business-logic query) and `scripts/seed.ts` (a local dev-only script, see "One-off
  Scripts" below)
- Collection/model names are `PascalCase` singular (`User`, `Workspace`, `Board`); field
  names are `camelCase` (`workspaceId`, `createdAt`), matching the schemas in
  `MASTERPLAN.md` §5.2
- Define explicit, strict Mongoose schemas — no implicit/dynamic fields
- Add indexes exactly where `MASTERPLAN.md` §5.4 specifies (`Board.workspaceId`,
  `List.{boardId, order}`, `Card.{listId, order}`, `Activity.{cardId, timestamp}`)
- **Reorder strategy:** `order` is a fractional/LexoRank-style number. Moving an item
  only writes that item's document — never bulk re-index sibling documents. See
  `MASTERPLAN.md` §5.3 for the rebalancing follow-up note
- Use Mongoose middleware hooks (`pre`/`post`) only for side effects (e.g. writing an
  `Activity` entry), never to hide core business logic that belongs in a service
- Avoid `.lean()` unless a specific read path is measurably performance-critical

### One-off Scripts (`scripts/`)

- `scripts/` holds standalone, dev-only scripts run directly with `tsx` (e.g.
  `npm run seed` → `scripts/seed.ts`) — they are not part of the deployed app, so
  (unlike `src/`) they may import Mongoose models directly instead of going through
  `services/*.service.ts`
- Reuse existing config/util modules (`config/db.ts`'s `connectDb`/`disconnectDb`,
  `config/env.ts`'s `env`, `utils/logger.ts`, `utils/reorder.ts`) rather than
  reimplementing connection, env-validation, or ordering logic
- Any script that mutates data must guard with an `env.NODE_ENV === "production"` check
  and `process.exit(1)` before connecting, the way `scripts/seed.ts` does — these
  scripts are for local/dev use only and must refuse to run against production
- A destructive/reseeding script should be idempotent (clear its own previously-seeded
  data by a stable identifier before recreating it) rather than appending duplicates on
  every run

### Authentication & Authorization (Passport.js)

- Auth is a `passport-jwt` strategy (`src/config/passport.ts`), not a hand-rolled bearer
  check. Protected routes use `passport.authenticate("jwt", { session: false })`
- `src/sockets/index.ts`'s handshake middleware is a deliberate, documented exception to
  the passport-jwt rule: `passport-jwt`'s `JwtStrategy` is built around Express's
  req/res cycle and has no clean way to run against a bare handshake token, so it
  verifies the JWT directly via `jsonwebtoken` instead — don't try to force
  `passport-jwt` in here without solving that mismatch first
- Access tokens are short-lived (`15m`); refresh tokens are longer-lived (`7d`) and
  signed with a **separate** secret (`JWT_SECRET` vs `JWT_REFRESH_SECRET`)
- Passwords are hashed with `bcryptjs` — never logged, never returned in a response
- Password reset uses a single-use, time-limited token sent by email — never the
  password itself
- Every board/list/card mutation re-derives the owning `workspaceId` from the resource
  hierarchy server-side and checks the caller's membership/role — the client-supplied
  `workspaceId` is never trusted for access control

### Real-Time (Socket.io)

- All broadcasts (`io.to(room).emit(...)`) must go through `@socket.io/redis-adapter` —
  never assume a single Cloud Run instance holds every connected client
- Clients join a board-scoped room (`board:<boardId>`) via `board:join`; presence and
  card updates broadcast only to that room
- The Cloud Run service must run with **Session Affinity** enabled so a socket's
  handshake stays pinned to one instance — the Redis adapter still handles fan-out
  across instances; affinity only protects the handshake

### Express.js Conventions: Security

- `helmet` for secure headers, `cors` locked to `CORS_ORIGIN`, `express-rate-limit`
  applied more aggressively on auth routes than general API routes
- Every mutation body is validated with a Zod schema before it reaches the service layer
  (see Zod section below)

### Logging

- Winston for structured JSON application logs, Morgan for HTTP request logs
  (`src/middleware/httpLogger.ts` — a custom Morgan format function that logs structured
  fields via `logger.http()` instead of a preformatted string, so Winston's own dev/prod
  format renders every log line consistently)
- Include a request-correlation ID (`requestId`) on every log line
- Never log secrets, tokens, or password hashes

### Email (Resend + React Email)

- Templates are React components in `src/emails/` using `@react-email/components`
- `email.service.ts` is the only module that renders a template and calls the `resend`
  SDK — no other service sends email directly
- The Resend client is initialized once at module load, not per request
- Only `auth.service.ts` calls into `email.service.ts` — no other service sends email
  directly, keeping delivery logic and provider config in one place. `register()` calls
  `sendWelcomeEmail` and `forgotPassword()` calls `sendPasswordResetEmail`
- `email.service.ts` throws when the Resend SDK resolves with an `error` payload (it
  doesn't reject on API errors) — treat that shape as a failure, not a success
- `auth.service.ts` wraps both calls in `try/catch` and only logs via `logger.error` on
  failure — a broken email provider must never block registration or password reset from
  completing

### API Documentation

- Every endpoint is documented in the version's OpenAPI 3.0 spec
  (`src/docs/v<n>/openapi.yaml`) and served via `swagger-ui-express` at `/api/v<n>/docs`
  — this is the canonical, browsable API reference

### Testing

- Jest + Supertest; `src/app.ts` is imported directly by integration tests so no real
  server needs to bind a port
- Mock the Redis adapter in Socket.io handler tests
- CI enforces a **100% coverage gate** (`npm run test:coverage`) across
  statements/branches/functions/lines — do not merge code that drops coverage
- Test layout mirrors `src/`: `tests/unit/{services,middleware,sockets}`,
  `tests/integration/*.test.ts` (see `README.md#test-structure`)
- Integration tests never share the local `syncboard` dev database: `tests/setupEnv.ts`
  rewrites `MONGO_URI`'s database segment to `syncboard-test` before any test file
  loads, `tests/setup.ts` wipes every collection in `afterEach`, and
  `jest.integration.config.js` sets `maxWorkers: 1` since all integration files share
  that one database/connection and would race each other's wipe otherwise

### Deployment

- Single multi-stage `Dockerfile` builds the production image; `docker-compose.yml` runs
  the local API + MongoDB + Redis stack for offline development only — it is not used to
  run the app itself in CI/CD
- Images are pushed to the public Docker Hub repository
  (`docker.io/moliveda/syncboard-api`), **not** Google Artifact Registry — don't
  reintroduce Artifact Registry push/pull steps — and deployed to Google Cloud Run with
  **Session Affinity enabled**
- Each of development/staging/production has its own dedicated GCP project, service
  account, and GitHub Environment — never assume a deploy workflow shares
  infrastructure, secrets, or a GitHub Environment with another environment
- `deploy-dev.yml`/`deploy-staging.yml` are `workflow_call`-only reusable workflows
  chained from `ci.yml` after its `test` job passes — never give them a `push` or
  `pull_request` trigger of their own. `deploy-prod.yml` is the sole `workflow_dispatch`
  entry point and always reruns `ci.yml`'s `test` job (via `workflow_call`) before
  deploying, since manual dispatch bypasses `ci.yml`'s own triggers
- GitHub Actions deploys via Workload Identity Federation (OIDC) — no long-lived GCP
  service-account keys in CI
- Secrets are scoped per GitHub Environment (`development`, `staging`, `production`);
  never commit `.env` or hardcode a secret

---

## Zod Validation

- Define request schemas alongside the router that uses them (e.g.
  `src/routes/v1/card.routes.ts` + a colocated `card.schema.ts`), and export the
  inferred TypeScript type with `z.infer<typeof Schema>`
- Apply schemas through the shared `validate` middleware (`src/middleware/validate.ts`)
  — routes never call `.parse()`/`.safeParse()` inline
- Use `.safeParse()` inside the `validate` middleware so validation failures flow
  through `errorHandler` as a `400 VALIDATION_ERROR`, never a thrown `ZodError` that
  reaches an unhandled-rejection handler
- Use `.refine()`/`.transform()` for cross-field or business-rule validation (e.g.
  rejecting a workspace-role value outside `Admin`/`Member`)
- Build request schemas by extending small base schemas (e.g. a `CreateCardSchema` and
  `UpdateCardSchema` both derived from a shared `BaseCardSchema`) instead of duplicating
  field definitions
- Validate required environment variables on startup with a Zod schema in `src/config/`
  — fail fast if `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, etc. are missing

---

## Git Workflow & Commit Conventions

### Gitmoji Commit Format

- Format: `:<emoji_code>: <Message>` — enforced by the Husky `commit-msg` hook
  (`.husky/commit-msg`)
- The message after the emoji **must start with an uppercase letter and be 50 characters
  or fewer** — the hook rejects anything longer or lowercase-led
- Use imperative mood ("Add feature", not "Added feature")
- Common Gitmoji patterns for this project:
  - `:sparkles:` — new feature (new endpoint, service, socket event)
  - `:bug:` — bug fix
  - `:fire:` — remove code or files
  - `:memo:` — documentation
  - `:recycle:` — refactor
  - `:zap:` — performance
  - `:lock:` — security fix
  - `:white_check_mark:` — tests
  - `:construction:` — work in progress
  - `:wrench:` — configuration
  - `:package:` — dependencies
  - `:rocket:` — deployment

```bash
# Good
:sparkles: Add card reorder endpoint
:bug: Fix token refresh race condition
:white_check_mark: Add reorder util edge case tests

# Bad — rejected by the commit-msg hook
:sparkles: updates
:bug: fix bug in the login flow because it was broken for some
```

### GitFlow Branching

- `main` — production-ready, deploys manually to production
- `develop` — integration branch, auto-deploys to Development
- `feature/*`, `bugfix/*` — branch off `develop`
- `release/*` — auto-deploys to Staging
- `hotfix/*` — urgent fixes off `main`
- Pull requests target `develop` (or `main` for hotfixes) and must pass CI (lint, format
  check, type-check, build, `test:coverage`) before merge

### Husky Hooks (what actually runs — see `.husky/`)

- **`pre-commit`**: `npm run lint`, `npm run format:check`, `npm run type-check`, then
  `npm run test` — all four must pass locally before a commit is created
- **`commit-msg`**: validates the Gitmoji format described above
- Never bypass hooks with `--no-verify` unless the user explicitly asks for it; fix the
  underlying lint/format/type-check/test failure instead

### General

- Commit frequently, in small focused/atomic changes
- Never commit `.env` files, secrets, or credentials
- Pull latest `develop` before starting new work; resolve conflicts carefully, don't
  discard changes to make a conflict "go away"

---

## Docker

- One multi-stage `Dockerfile` at the repo root builds the production image used for
  every deployed environment (Preview/Development/Staging/Production) — don't fork it
  per environment. A `dev` stage in that same file is the Compose `api` service target.
- `docker-compose.yml` is for **local development only**: it runs the API, MongoDB, and
  Redis. Compose overrides `MONGO_URI` / `REDIS_URL` to Docker DNS names inside the
  `api` container.
- Common commands:

  ```bash
  docker compose up --build    # start api + mongo + redis
  docker compose down          # stop and remove them
  ```

- Never bake secrets into the image; Cloud Run environment variables/Secret Manager
  supply them at deploy time (see `README.md#environment-variables`)

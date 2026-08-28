# CLAUDE.md

Instructions for Claude Code when working in this repository. These override default
behavior and must be followed exactly.

## Project Snapshot

**SyncBoard API** — the Express.js + TypeScript backend for SyncBoard, a real-time
collaborative Kanban board. It exposes a versioned REST API (auth, workspaces, boards,
lists, cards) plus a Socket.io layer fanned out across Cloud Run instances via a Redis
Pub/Sub adapter. Persistence is MongoDB Atlas via Mongoose; Redis is used purely as the
Socket.io adapter, not for data storage.

- Product surface, endpoints, and setup: [`README.md`](./README.md)
- Full architecture, schemas, and rationale: [`MASTERPLAN.md`](./MASTERPLAN.md)
- Coding style and stack-specific conventions: [`AGENTS.md`](./AGENTS.md)

Phases 0–5 are built: project scaffolding, the full REST API (routes/services/models for
auth, workspaces, boards, lists, cards), `passport-jwt` auth hardening, CI/CD
(`ci.yml`/`deploy-dev.yml`/`deploy-staging.yml`/`deploy-prod.yml`), the Socket.io
real-time layer (`src/sockets/`) with the `@socket.io/redis-adapter`, and transactional
email via Resend + React Email (`src/emails/`, `src/services/email.service.ts`) wired
into registration (welcome email) and password reset. Phase 6 (structured logging
polish, OpenAPI/Swagger completion) is not built yet — see `MASTERPLAN.md` §12 for the
authoritative, up-to-date phase checklist rather than relying on this paragraph, which
will drift as phases complete. Treat `README.md`/`MASTERPLAN.md` as the target contract
for anything not yet built; check what actually exists in the repo before assuming a
file or script is there.

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

## Coding Conventions

All stack-specific style, layering, and workflow rules — Express/routing, Mongoose, Zod,
Socket.io, auth, testing, git/commit format, Docker — live in
[`AGENTS.md`](./AGENTS.md). Treat every rule there as a binding constraint for this
repo, equivalent to the rest of this file, not just descriptive style guidance. Read it
before making any change; do not restate its rules here.

The items below are constraints `AGENTS.md` doesn't cover, or exceptions to its rules
that are easy to miss:

- Only `services/*.service.ts` files import Mongoose models directly for business logic.
  The exceptions are identity-verification code (`config/passport.ts`'s strategy
  callback, `sockets/index.ts`'s handshake middleware — both do a direct
  `UserModel.findById` to resolve `req.user`/`socket.data.user`, not a business-logic
  query) and `scripts/seed.ts` (a local dev-only script, see `AGENTS.md`'s "One-off
  Scripts" section)
- `src/sockets/index.ts`'s handshake middleware is a deliberate, documented exception to
  the passport-jwt rule: `passport-jwt`'s `JwtStrategy` is built around Express's
  req/res cycle and has no clean way to run against a bare handshake token, so it
  verifies the JWT directly via `jsonwebtoken` instead — don't try to force
  `passport-jwt` in here without solving that mismatch first
- Each of development/staging/production has its own dedicated GCP project, service
  account, and GitHub Environment — never assume a deploy workflow shares
  infrastructure, secrets, or a GitHub Environment with another environment
- `deploy-dev.yml`/`deploy-staging.yml` are `workflow_call`-only reusable workflows
  chained from `ci.yml` after its `test` job passes — never give them a `push` or
  `pull_request` trigger of their own. `deploy-prod.yml` is the sole `workflow_dispatch`
  entry point and always reruns `ci.yml`'s `test` job (via `workflow_call`) before
  deploying, since manual dispatch bypasses `ci.yml`'s own triggers
- Container images are pushed to the public Docker Hub repository
  `docker.io/moliveda/syncboard-api`, not Google Artifact Registry — don't reintroduce
  Artifact Registry push/pull steps

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

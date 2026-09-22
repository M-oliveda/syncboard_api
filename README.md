# 🗂️ SyncBoard API — Real-Time Kanban Backend

> **REST API and Socket.io real-time layer for SyncBoard, built with Node.js, Express,
> TypeScript, MongoDB, and Redis. Containerized and deployed on Google Cloud Run.**

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema-mongodb)
- [API Endpoints](#api-endpoints)
- [API Versioning & Documentation](#api-versioning--documentation)
- [WebSocket Events](#websocket-events)
- [Frontend Integration](#frontend-integration)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Overview

**SyncBoard API** is the backend service for the SyncBoard ecosystem. It exposes a
versioned REST API for authentication and board/list/card CRUD, and a Socket.io layer
that broadcasts real-time changes to every client viewing a board — regardless of which
Cloud Run instance handles their connection.

### This Repository Contains

- 🔐 **JWT Authentication via Passport.js** — register, login, password reset, using a
  `passport-jwt` strategy for stateless request auth
- 📋 **Board/List/Card CRUD** — REST endpoints backing the Kanban board
- ⚡ **Real-Time Sync** — Socket.io rooms scoped per board, fanned out across instances
  via a Redis Pub/Sub adapter
- 🧮 **Order-Preserving Reorder Logic** — fractional/LexoRank-style ordering so a card
  move never requires re-indexing siblings
- 📧 **Transactional Email** — Resend + React Email power password-reset and account
  emails
- 📖 **OpenAPI 3.0 Docs** — interactive Swagger UI mounted per API version
  (`/api/v1/docs`)
- 🪵 **Structured Logging** — Winston + Morgan, JSON output ready for Cloud Logging

### Related Repository

This API is one half of the SyncBoard product — the UI that consumes it lives in a
separate repository:

- **Frontend Repository:**
  [`m-oliveda/syncboard_web`](https://github.com/m-oliveda/syncboard_web) (see its
  [README](https://github.com/m-oliveda/syncboard_web/blob/main/README.md) for the
  product pitch, UI structure, and frontend architecture)

---

## Architecture

Cloud Run can spin up multiple backend instances to handle traffic, so User A might be
connected to Instance 1 while User B is connected to Instance 2. Without a shared
synchronization layer, User A would never see User B's changes. Redis closes that gap by
acting as the message bus between instances.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              SYNCBOARD WEB                              │
│      React 19 (Vite) + TanStack Router/Query + Tailwind CSS + dnd-kit   │
│                  (separate repo — see Related Repository)               │
└─────────────────────────────────────────────────────────────────────────┘
              │                                              ▲
              │ REST API (Axios)                             │ WebSockets
              ▼                                               │ (Socket.io)
┌─────────────────────────────────────────────────────────────────────────┐
│                          SYNCBOARD API (this repo)                      │
│      Express.js + Socket.io — Containerized on Google Cloud Run         │
│      (Instance 1)         (Instance 2)         (Instance N)             │
└─────────────────────────────────────────────────────────────────────────┘
         │                        │                        │
         │ MongoDB Driver         │ Redis Adapter (ioredis) │
         ▼                        ▼                        ▼
┌───────────────────┐   ┌──────────────────────────────────────┐
│   MongoDB Atlas    │   │              Redis Cloud             │
│ (Document Store,   │   │  (Socket.io Pub/Sub Adapter — keeps  │
│  external to GCP)  │   │   every Cloud Run instance in sync,  │
│                     │   │   external to GCP)                   │
└───────────────────┘   └──────────────────────────────────────┘
```

**Data flow for a card move:**

1. Client drags a card → optimistic UI update → emits `card:moved` over the socket.
2. The API instance handling that socket persists the change to MongoDB.
3. The API publishes the event to Redis; every Cloud Run instance subscribed to that
   board's channel receives it via the `@socket.io/redis-adapter`.
4. Each instance broadcasts `card:updated` to its own connected clients in that board's
   Socket.io room — including clients on a different instance entirely.

Full architectural rationale: [`MASTERPLAN.md`](./MASTERPLAN.md#3-architecture).

---

## Key Features

### 1. Authentication

Powered by [Passport.js](https://www.passportjs.org/), using a `passport-jwt` strategy
so protected routes are guarded by `passport.authenticate("jwt", { session: false })`
instead of a hand-rolled JWT-verification middleware.

| Endpoint                            | Description                               |
| ----------------------------------- | ----------------------------------------- |
| `POST /api/v1/auth/register`        | Create a user account                     |
| `POST /api/v1/auth/login`           | Authenticate, issue access + refresh JWT  |
| `POST /api/v1/auth/forgot-password` | Trigger password-reset email (via Resend) |
| `POST /api/v1/auth/reset-password`  | Complete password reset with token        |

### 2. Workspaces, Boards, Lists & Cards

- **Workspaces** — group boards, manage member roles (Admin / Member)
- **Boards** — belong to a workspace
- **Lists** — ordered columns within a board
- **Cards** — draggable items with title, description, assignees, labels, checklists
- **Activity Log** — append-only history per card (`"Mauricio moved this card to Done"`)

### 3. Real-Time Layer

- Socket.io server with `@socket.io/redis-adapter` for horizontal scale-out
- Board-scoped Rooms — clients `board:join` to receive only relevant updates
- Presence tracking — who's currently viewing a board

### 4. Security & Validation

- **Helmet** — secure HTTP headers
- **CORS** — restricted to the configured frontend origin
- **Rate Limiting** — per-IP request throttling
- **bcryptjs** — password hashing
- **Zod** — request schema validation middleware
- **RFC 7807** — standardized `application/problem+json` error responses

### 5. Transactional Email

- **Resend** — delivery provider for all outbound email (password reset, account
  notifications)
- **React Email** — email templates written as React components (`src/emails/`),
  rendered to HTML before being handed to Resend

---

## Technology Stack

### Core Technologies

| Category      | Technology                     | Purpose               |
| :------------ | :----------------------------- | :-------------------- |
| **Runtime**   | Node.js (LTS)                  | JavaScript runtime    |
| **Framework** | Express.js                     | HTTP server & routing |
| **Language**  | TypeScript                     | Type safety           |
| **Database**  | MongoDB Atlas via Mongoose ODM | Document persistence  |

### Real-Time & Sync

| Category      | Technology                             | Purpose                              |
| :------------ | :------------------------------------- | :----------------------------------- |
| **Real-Time** | Socket.io                              | WebSocket server                     |
| **Scale-Out** | `@socket.io/redis-adapter` + `ioredis` | Cross-instance Pub/Sub for Socket.io |

### Backend Libraries

| Category       | Technology                                             | Purpose                                                      |
| :------------- | :----------------------------------------------------- | :----------------------------------------------------------- |
| **Validation** | Zod                                                    | Request/response schema validation                           |
| **Auth**       | `passport`, `passport-jwt`, `jsonwebtoken`, `bcryptjs` | Passport-based JWT strategy, token signing, password hashing |
| **Email**      | `resend`, `@react-email/components`                    | Transactional email delivery + React-based email templates   |
| **Security**   | Helmet, `cors`, `express-rate-limit`                   | HTTP hardening, CORS, throttling                             |
| **Logging**    | Winston + Morgan                                       | Structured JSON logs + HTTP request logs                     |
| **API Docs**   | `swagger-ui-express` + OpenAPI 3.0                     | Interactive API documentation                                |

### Development Tools

| Category       | Technology       | Purpose                                              |
| :------------- | :--------------- | :--------------------------------------------------- |
| **Testing**    | Jest + Supertest | Unit and integration testing (100% testing coverage) |
| **Linting**    | ESLint           | Code quality                                         |
| **Formatting** | Prettier         | Code formatting                                      |
| **Container**  | Docker           | Local dev parity + deployment                        |
| **Git Hooks**  | Husky            | Enforce lint/format/type-check/commit-msg on commit  |

---

## Database Schema (MongoDB)

A relational structure embedded within MongoDB's document model:

| Collection    | Key Fields                                                                                |
| ------------- | ----------------------------------------------------------------------------------------- |
| **User**      | `_id`, `email`, `passwordHash`                                                            |
| **Workspace** | `_id`, `name`, `members` (array of `{ userId, role: Admin \| Member }`)                   |
| **Board**     | `_id`, `workspaceId`, `title`                                                             |
| **List**      | `_id`, `boardId`, `title`, `order` (Number — critical for sorting)                        |
| **Card**      | `_id`, `listId`, `title`, `description`, `order`, `assignees`, `labels`                   |
| **Activity**  | `_id`, `cardId`, `userId`, `action` (e.g. `"moved card from To Do to Done"`), `timestamp` |

**Reorder strategy:** moving a card should never require re-indexing every sibling card.
`order` uses fractional/LexoRank-style values so a single card's position can be updated
in isolation. Full Mongoose schema definitions, indexing strategy, and rebalancing
notes: [`MASTERPLAN.md`](./MASTERPLAN.md#5-database-schema--data-models).

> The frontend's optimistic drag-and-drop logic computes new `order` values using this
> same scheme — see
> [`web/MASTERPLAN.md`](https://github.com/m-oliveda/syncboard_web/blob/main/MASTERPLAN.md#82-drag-and-drop-with-dnd-kit).

---

## API Endpoints

> **Canonical reference:** interactive Swagger UI served at `/api/v1/docs` once the
> server is running. Full request/response contracts also live in
> [`MASTERPLAN.md`](./MASTERPLAN.md#6-api-design).

All routes are versioned under `/api/v1`. Endpoints are resource-oriented and follow
standard REST semantics: `POST` to create, `GET` to read, `PATCH` for partial updates,
`DELETE` to remove. There are no verb-in-the-URL "action" endpoints (e.g. `/reorder`,
`/move`) — reordering a list and moving a card are just partial updates (`PATCH`) of the
`order`/`listId` fields on the resource, so a single mental model (CRUD + PATCH) covers
the whole API.

### Authentication

```text
POST /api/v1/auth/register         # Create account
POST /api/v1/auth/login            # Issue an access token; sets the refresh token as an HttpOnly cookie
POST /api/v1/auth/refresh          # Rotate the refresh token cookie for a new access token (no body)
POST /api/v1/auth/logout           # Revoke the current refresh token and clear its cookie
POST /api/v1/auth/forgot-password  # Trigger reset email
POST /api/v1/auth/reset-password   # Complete reset with token
```

Authenticated routes require a bearer token:

```text
Authorization: Bearer <access_token>
```

### Response Format

```typescript
// Success (single resource)
{
  "success": true,
  "data": { /* ... */ },
  "message"?: string
}

// Success (collection)
{
  "success": true,
  "data": [ /* ... */ ],
  "pagination": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 }
}

// Error (RFC 7807 problem+json)
{
  "type": "https://syncboard.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "title is required",
  "instance": "/api/v1/cards/c1"
}
```

### Collection Query Parameters

Every `GET` collection endpoint (`/workspaces`, `/boards`, `/lists`, `/cards`,
`/activity`) supports the same query conventions:

| Param   | Example            | Description                                         |
| :------ | :----------------- | :-------------------------------------------------- |
| `page`  | `?page=2`          | 1-indexed page number (default `1`)                 |
| `limit` | `?limit=20`        | Items per page (default `20`, max `100`)            |
| `sort`  | `?sort=-createdAt` | Field to sort by; prefix `-` for descending         |
| `title` | `?title=review`    | Case-insensitive filter on `title` where applicable |

### Workspaces

| Method   | Path                                              | Description                        |
| :------- | :------------------------------------------------ | :--------------------------------- |
| `POST`   | `/api/v1/workspaces`                              | Create a workspace                 |
| `GET`    | `/api/v1/workspaces`                              | List the current user's workspaces |
| `GET`    | `/api/v1/workspaces/:workspaceId`                 | Get a single workspace             |
| `PATCH`  | `/api/v1/workspaces/:workspaceId`                 | Update workspace name              |
| `DELETE` | `/api/v1/workspaces/:workspaceId`                 | Delete a workspace                 |
| `POST`   | `/api/v1/workspaces/:workspaceId/members`         | Add a member                       |
| `PATCH`  | `/api/v1/workspaces/:workspaceId/members/:userId` | Update a member's role             |
| `DELETE` | `/api/v1/workspaces/:workspaceId/members/:userId` | Remove a member                    |

### Boards

| Method   | Path                                     | Description                              |
| :------- | :--------------------------------------- | :--------------------------------------- |
| `POST`   | `/api/v1/workspaces/:workspaceId/boards` | Create a board in a workspace            |
| `GET`    | `/api/v1/workspaces/:workspaceId/boards` | List boards in a workspace               |
| `GET`    | `/api/v1/boards/:boardId`                | Full board state (board + lists + cards) |
| `PATCH`  | `/api/v1/boards/:boardId`                | Update board title                       |
| `DELETE` | `/api/v1/boards/:boardId`                | Delete a board                           |

**`GET /api/v1/boards/:boardId` response:**

```json
{
  "success": true,
  "data": {
    "board": { "_id": "b1", "title": "Marketing Q1", "workspaceId": "w1" },
    "lists": [
      { "_id": "l1", "title": "To Do", "order": 1 },
      { "_id": "l2", "title": "In Progress", "order": 2 }
    ],
    "cards": [
      {
        "_id": "c1",
        "listId": "l1",
        "title": "Design landing page",
        "order": 1
      }
    ]
  }
}
```

### Lists

| Method   | Path                            | Description                                                        |
| :------- | :------------------------------ | :----------------------------------------------------------------- |
| `POST`   | `/api/v1/boards/:boardId/lists` | Create a list on a board                                           |
| `GET`    | `/api/v1/boards/:boardId/lists` | List lists on a board                                              |
| `GET`    | `/api/v1/lists/:listId`         | Get a single list                                                  |
| `PATCH`  | `/api/v1/lists/:listId`         | Update title and/or `order` (fractional — avoids bulk re-indexing) |
| `DELETE` | `/api/v1/lists/:listId`         | Delete a list                                                      |

```json
// PATCH /api/v1/lists/l1 — reposition a list between two siblings
{ "order": 1.5 }
```

### Cards

| Method   | Path                          | Description                                                            |
| :------- | :---------------------------- | :--------------------------------------------------------------------- |
| `POST`   | `/api/v1/lists/:listId/cards` | Create a card in a list                                                |
| `GET`    | `/api/v1/lists/:listId/cards` | List cards in a list                                                   |
| `GET`    | `/api/v1/cards/:cardId`       | Get a single card                                                      |
| `PATCH`  | `/api/v1/cards/:cardId`       | Update content and/or move (`listId` + `order`) within or across lists |
| `DELETE` | `/api/v1/cards/:cardId`       | Delete a card                                                          |

```json
// PATCH /api/v1/cards/c1 — update content
{ "title": "Draft press release", "description": "..." }

// PATCH /api/v1/cards/c1 — move to another list/position
{ "listId": "l2", "order": 2.5 }
```

### Activity

**Not yet implemented** — no `Activity` model, service, or route exists yet, unlike
every other resource in this section. The endpoint below documents the target contract,
not something you can call today.

| Method | Path                             | Description                       |
| :----- | :------------------------------- | :-------------------------------- |
| `GET`  | `/api/v1/cards/:cardId/activity` | Paginated activity log for a card |

### Error Codes

| Code                  | HTTP Status | Description                                   |
| :-------------------- | :---------- | :-------------------------------------------- |
| `UNAUTHENTICATED`     | 401         | Missing/invalid JWT                           |
| `UNAUTHORIZED`        | 403         | Insufficient workspace role                   |
| `NOT_FOUND`           | 404         | Resource not found                            |
| `VALIDATION_ERROR`    | 400         | Zod schema validation failed                  |
| `CONFLICT`            | 409         | Resource state conflict (e.g. duplicate name) |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests                             |
| `INTERNAL_ERROR`      | 500         | Unhandled server error                        |

---

## API Versioning & Documentation

The API is versioned via the URL path (`/api/v1`, `/api/v2`, ...) rather than headers or
query params — the version is visible at a glance in logs, Swagger UI, and client code.
Breaking changes ship as a new version prefix; existing versions keep working unchanged
for clients that haven't migrated yet.

**Each API version serves its own interactive Swagger UI**, generated from its own
OpenAPI spec, so `v1` and `v2` docs never bleed into each other:

| Version | Docs Route     | OpenAPI Spec               |
| :------ | :------------- | :------------------------- |
| `v1`    | `/api/v1/docs` | `src/docs/v1/openapi.yaml` |
| `v2`\*  | `/api/v2/docs` | `src/docs/v2/openapi.yaml` |

_`v2` does not exist yet — the row above documents the convention future versions
follow, not a shipped API._

Route wiring keeps each version additive, so shipping a new one never touches the
previous version's router or spec:

```typescript
// src/app.ts
import v1Router from "./routes/v1";
import v1Spec from "./docs/v1/openapi.yaml";

app.use("/api/v1", v1Router);
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(v1Spec));

// When v2 ships:
// app.use("/api/v2", v2Router);
// app.use("/api/v2/docs", swaggerUi.serve, swaggerUi.setup(v2Spec));
```

---

## WebSocket Events

| Event                 | Direction       | Payload                                              |
| --------------------- | --------------- | ---------------------------------------------------- |
| `board:join`          | Client → Server | `{ boardId }`                                        |
| `board:user-presence` | Server → Client | `{ boardId, activeUsers: [{ userId, email }] }`      |
| `card:moved`          | Client → Server | `{ cardId, sourceListId, targetListId, newOrder }`   |
| `card:updated`        | Server → Client | Updated card document, broadcast to the board's Room |

`board:join`'s `boardId` is the only trusted input — identity comes from the JWT
presented at the socket handshake, never from the payload. `activeUsers` currently
exposes `email` only; `name`/`avatarUrl` will be added once a user-profile field exists.
`list:reordered` is not yet implemented (no dedicated REST reorder endpoint exists to
mirror — see [`MASTERPLAN.md` §7.3](./MASTERPLAN.md#73-event-contract)).

Connection flow, room strategy, and the Redis adapter setup are documented in
[`MASTERPLAN.md`](./MASTERPLAN.md#7-real-time-layer).

---

## Frontend Integration

[`syncboard_web`](https://github.com/m-oliveda/syncboard_web) is the only intended
consumer of this API. This is how the two repos are wired together:

### REST

- The frontend targets this service's base URL via `VITE_API_BASE_URL` (e.g.
  `http://localhost:4000/api/v1` in development). All requests go through a single Axios
  instance so token attachment and refresh are handled in one place.
- On `login`/`register`, the access token is kept in memory (not `localStorage`, to
  limit XSS blast radius) and attached as `Authorization: Bearer <access_token>` by an
  Axios request interceptor. The refresh token is returned in an `HttpOnly` cookie.
- A response interceptor catches `401` responses, calls `POST /api/v1/auth/refresh`
  once, retries the original request with the new access token, and only redirects to
  `/login` if the refresh itself fails.
- CORS is locked down via `CORS_ORIGIN` (see
  [Environment Variables](#environment-variables)) — set it to the exact frontend origin
  (`http://localhost:5173` in dev; the deployed Cloud Run URL in staging/prod).

### Real-Time

- After REST login, the frontend opens a Socket.io connection passing the same access
  token in the handshake `auth` payload; the server verifies it before accepting the
  connection (see [WebSocket Events](#websocket-events)).
- The client emits `board:join` for the board currently being viewed and listens for
  `card:updated` / `board:user-presence` to keep the TanStack Query cache and presence
  UI in sync without polling.
- Frontend-side drag-and-drop reorder math must produce the same fractional `order`
  values this API expects — see
  [`web/MASTERPLAN.md`](https://github.com/m-oliveda/syncboard_web/blob/main/MASTERPLAN.md#82-drag-and-drop-with-dnd-kit).

### Environments

| Frontend Env | Talks To (`VITE_API_BASE_URL`)            |
| ------------ | ----------------------------------------- |
| Local dev    | `http://localhost:4000/api/v1`            |
| Development  | Development `syncboard-api` Cloud Run URL |
| Staging      | Staging `syncboard-api` Cloud Run URL     |
| Production   | Production `syncboard-api` Cloud Run URL  |

---

## Getting Started

### Prerequisites

- **Docker Desktop** & **Docker Compose** — required to run the local stack
- **Node.js LTS** & **npm** — [Download](https://nodejs.org/) — required for lint,
  tests, and Husky git hooks
- **MongoDB Atlas account** (free M0 tier) — deployed environments only
- **Redis Cloud account** (free tier) — deployed environments only
- **Git**

### Quick Start

**1. Clone the repository:**

```bash
git clone https://github.com/m-oliveda/syncboard_api.git
cd syncboard_api
```

**2. Configure environment:**

```bash
cp .env.example .env
```

Fill in local secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, etc.). Compose overrides
`MONGO_URI` and `REDIS_URL` to the `mongo` / `redis` services, so Atlas and Redis Cloud
URLs are not required to boot locally (see
[Environment Variables](#environment-variables)).

**3. Start the local stack** (API + MongoDB + Redis):

```bash
docker compose up --build
```

**4. Explore the API:**

- **Base URL:** `http://localhost:4000/api/v1`
- **Swagger UI:** `http://localhost:4000/api/v1/docs`

### Local seed data

For convenience while developing locally you can populate a small dataset (three users,
workspaces, boards, lists and cards) with:

```bash
npm run seed
# Or when running inside the Compose `api` container:
docker compose exec api npm run seed
```

Seeded accounts (email / password):

- `ada.admin@syncboard.dev` / `SeedAda1!`
- `sam.member@syncboard.dev` / `SeedSam2!`
- `riley.solo@syncboard.dev` / `SeedRiley3!`

The seeder is idempotent and will only replace the known seed users/workspaces on
re-run; it refuses to run when `NODE_ENV=production`.

### Test the API

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@syncboard.dev","password":"Demo1234!"}'
```

---

## Development

### Available Scripts

```bash
# Development
npm run dev              # Hot reload (used by the Compose `api` service; optional on the host)
npm run build             # Compile TypeScript to JavaScript
npm run start              # Run compiled build

# Testing
npm run test               # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only (Supertest)
npm run test:watch         # Watch mode for TDD
npm run test:coverage      # Coverage report

# Code Quality
npm run lint                # ESLint
npm run lint:fix            # Fix linting issues
npm run format               # Prettier
npm run format:check         # Check formatting
npm run type-check           # TypeScript type checking
```

### Git Hooks (Husky)

This project uses Husky to enforce quality standards automatically, so CI failures for
lint/format/type-check/commit-message issues never happen — they're caught before the
commit exists:

- **Pre-commit:** runs `lint`, `format:check`, `type-check`, and `test`
- **Commit message:** validated against Gitmoji format (e.g.
  `:sparkles: Add card reorder endpoint`), matching the convention used in
  [`syncboard_web`](https://github.com/m-oliveda/syncboard_web)

### Docker Compose (Local Stack)

`docker-compose.yml` is the local development stack: the API (`tsx watch`), MongoDB, and
Redis. It is not used in CI/CD or to run Cloud Run.

```bash
docker compose up --build    # api + mongo + redis
docker compose down
```

Inside the `api` container, Compose overrides `MONGO_URI` and `REDIS_URL` to Docker DNS
names (`mongodb://mongo:27017/syncboard`, `redis://redis:6379`) so they do not use
`.env`'s `localhost` values. Host-side `npm run dev` can still point at the published
ports (`localhost:27017` / `localhost:6379`).

`npm install` on the host is only needed for lint, tests, and Husky — not to run the
stack.

> Switch `MONGO_URI` and `REDIS_URL` to the Atlas / Redis Cloud URLs before deploying.

---

## Testing

### Test Strategy

Critical business logic is covered by unit and integration tests:

- Auth service (registration, login, token issuance/refresh)
- Reorder logic (fractional ordering edge cases)
- Board/list/card services
- Socket.io event handlers (via a mocked Redis adapter)
- Middleware (auth, validation, rate limiting)

### Running Tests

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:coverage
```

### Test Structure

```text
tests/
├── unit/
│   ├── services/
│   │   ├── auth.service.test.ts
│   │   ├── board.service.test.ts
│   │   ├── card.service.test.ts
│   │   └── reorder.util.test.ts
│   ├── middleware/
│   │   ├── auth.test.ts
│   │   ├── validate.test.ts
│   │   └── rateLimit.test.ts
│   └── sockets/
│       └── cardHandlers.test.ts
│
├── integration/
│   ├── auth.test.ts
│   ├── boards.test.ts
│   ├── lists.test.ts
│   └── cards.test.ts
│
└── setup.ts
```

---

## Deployment

### Google Cloud Run

The API is containerized with Docker and deployed to **Google Cloud Run** as its own
service, independent from the frontend's Cloud Run service.

### GCP Infrastructure

Each environment has a dedicated GCP project with its own service account, mirroring the
setup used by [`syncboard_web`](https://github.com/m-oliveda/syncboard_web). Container
images are not hosted on GCP at all — they're pushed to the public Docker Hub repository
`docker.io/moliveda/syncboard-api`, which every environment's Cloud Run service pulls
from directly:

| Environment     | GCP Project ID                 | Service Account          |
| --------------- | ------------------------------ | ------------------------ |
| **Development** | `moliveda-gcloudprojects-dev`  | `cicd-deployer-dev@...`  |
| **Staging**     | `moliveda-gcloudprojects-stg`  | `cicd-deployer-stg@...`  |
| **Production**  | `moliveda-gcloudprojects-prod` | `cicd-deployer-prod@...` |

### Deployment Strategy

| Environment     | Branch      | Notes                     |
| --------------- | ----------- | ------------------------- |
| **Development** | `develop`   | Auto-deploy on push       |
| **Staging**     | `release/*` | Pre-production validation |
| **Production**  | `main`      | Manual dispatch           |

**Crucial Cloud Run setting:** enable **Session Affinity** on the API service so a
WebSocket's initial HTTP handshake is pinned to a single instance for the life of the
connection. The Redis adapter still handles broadcasting events _across_ instances —
affinity only protects the handshake, not the message fan-out.

### CI/CD Pipeline

Deployments run through GitHub Actions using **Workload Identity Federation (OIDC)** —
no long-lived GCP service account keys are stored in CI:

- **CI (every pull request** to `develop`, `release/**`, or `main`**):** install, lint,
  format check, type-check, build, then run the full test suite with coverage
  (`npm run test:coverage`) — the job fails if coverage is below 100%.
- **Deploy Development (on push to `develop`, after CI passes):** builds the Docker
  image, pushes it to the public Docker Hub repository, and deploys to the
  `syncboard-api` Cloud Run service in the dev project with session affinity enabled.
  Chained from `ci.yml` as a reusable workflow (`deploy-dev.yml`) — it has no trigger of
  its own.
- **Deploy Staging (on push to `release/**`, after CI passes):** same pipeline,
  targeting the staging Cloud Run project. Chained from `ci.yml` as a reusable workflow
  (`deploy-staging.yml`).
- **Deploy Production (manual dispatch only):** `deploy-prod.yml` reruns the full CI
  test job on the dispatched ref (since manual dispatch bypasses `ci.yml`'s own
  triggers), then deploys to the production Cloud Run project.

Secrets are organized using **GitHub Environments** (`development`, `staging`,
`production`), each scoped to its own `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, and
`JWT_REFRESH_SECRET`, plus the shared `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` used to
push the image to Docker Hub.

### Manual Deployment

```bash
npm run build

docker build -t docker.io/moliveda/syncboard-api .
docker push docker.io/moliveda/syncboard-api

gcloud run deploy syncboard-api \
  --image docker.io/moliveda/syncboard-api \
  --session-affinity \
  --set-env-vars MONGO_URI=...,REDIS_URL=...,JWT_SECRET=...
```

### External Managed Services

MongoDB and Redis are **not** hosted on Google Cloud — they run as external managed
services and are reached over their connection URIs:

- **MongoDB Atlas** (Free M0 / Shared Tier)
- **Redis Cloud** (Free Tier) — used purely as the Socket.io Pub/Sub adapter, not for
  data persistence

---

## Project Structure

```text
syncboard_api/
├── src/
│   ├── index.ts                    # Server entrypoint
│   ├── app.ts                      # Express app configuration
│   ├── config/                     # Env, DB, Redis, Socket.io, Passport setup
│   │   └── passport.ts              # passport-jwt strategy registration
│   ├── middleware/
│   │   ├── auth.ts                  # passport.authenticate("jwt", { session: false })
│   │   ├── validate.ts
│   │   ├── rateLimit.ts
│   │   └── errorHandler.ts         # Centralized RFC 7807 error handling
│   ├── routes/
│   │   └── v1/
│   │       ├── index.ts             # Mounts all v1 sub-routers under /api/v1
│   │       ├── auth.routes.ts
│   │       ├── workspace.routes.ts
│   │       ├── board.routes.ts
│   │       ├── list.routes.ts
│   │       └── card.routes.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── email.service.ts         # Resend client + template rendering
│   │   ├── workspace.service.ts
│   │   ├── board.service.ts
│   │   ├── list.service.ts
│   │   └── card.service.ts
│   ├── models/                     # Mongoose schemas
│   │   ├── user.model.ts
│   │   ├── workspace.model.ts
│   │   ├── board.model.ts
│   │   ├── list.model.ts
│   │   ├── card.model.ts
│   │   └── activity.model.ts
│   ├── sockets/
│   │   ├── index.ts                 # Socket.io server + Redis adapter wiring
│   │   └── handlers/
│   │       ├── board.handler.ts     # board:join, board:user-presence
│   │       └── card.handler.ts      # card:moved -> card:updated
│   ├── emails/                      # React Email templates (rendered by email.service.ts)
│   │   ├── PasswordResetEmail.tsx
│   │   └── WelcomeEmail.tsx
│   ├── utils/
│   │   ├── reorder.ts               # Fractional/LexoRank ordering helpers
│   │   └── logger.ts                # Winston config
│   └── docs/
│       └── v1/
│           └── openapi.yaml         # OpenAPI 3.0 spec served at /api/v1/docs
│
├── tests/
├── .husky/                          # Pre-commit lint/format/type-check/test + commit-msg hooks
├── .github/
│   └── workflows/                   # CI + per-environment deploy pipelines
├── .env.example
├── .env
├── Dockerfile
├── docker-compose.yml
├── tsconfig.json
├── package.json
├── README.md                        # This file
├── MASTERPLAN.md                    # Detailed backend architecture
└── LICENSE
```

---

## Environment Variables

Copy the template and fill in real values:

```bash
cp .env.example .env
```

```bash
# Server
NODE_ENV=development
PORT=4000

# Database (MongoDB Atlas — external, outside GCP)
# Local Compose overrides this to mongodb://mongo:27017/syncboard inside the
# `api` container. localhost is for an optional host-side `npm run dev`.
# Swap for the Atlas connection string before deploying.
MONGO_URI=mongodb://localhost:27017/syncboard

# Redis (Redis Cloud — external, outside GCP; Socket.io Pub/Sub adapter only)
# Local Compose overrides this to redis://redis:6379 inside the `api` container.
# Swap for the Redis Cloud URL before deploying.
REDIS_URL=redis://localhost:6379

# Auth (JWTs signed here, verified by the passport-jwt strategy in src/config/passport.ts)
JWT_SECRET=replace-with-a-strong-random-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace-with-a-different-strong-random-secret
JWT_REFRESH_EXPIRES_IN=7d

# Email (Resend)
RESEND_API_KEY=replace-with-your-resend-api-key
EMAIL_FROM=SyncBoard <no-reply@syncboard.dev>

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

⚠️ **Security:** Never commit `.env` files or secrets to Git. In deployed environments,
set these as Cloud Run environment variables / secrets (Secret Manager recommended for
`JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGO_URI`, `REDIS_URL`).

---

## License

SyncBoard API is licensed under the **GPL v2 License**. See [LICENSE](./LICENSE) for
details.

## Additional Resources

- **Detailed Architecture:** [MASTERPLAN.md](./MASTERPLAN.md)
- **Frontend Repository:**
  [`m-oliveda/syncboard_web`](https://github.com/m-oliveda/syncboard_web)

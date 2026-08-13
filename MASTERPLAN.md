# 🗂️ SyncBoard API — MASTERPLAN

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Architecture](#3-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Database Schema & Data Models](#5-database-schema--data-models)
6. [API Design](#6-api-design)
7. [Real-Time Layer](#7-real-time-layer)
8. [Security & Authentication](#8-security--authentication)
9. [Development Environment](#9-development-environment)
10. [Testing Strategy](#10-testing-strategy)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Development Phases](#12-development-phases)

---

## 1. Executive Summary

**SyncBoard API** is the backend service powering a real-time collaborative Kanban
board. It provides a versioned REST API for data persistence and a Socket.io layer that
keeps every connected client in sync the instant a card moves, a list reorders, or a
teammate joins a board.

### Key Features

- **Stateless, horizontally-scalable Express API** on Google Cloud Run
- **Order-preserving reorder logic** — no bulk re-indexing on card/list moves
- **Cross-instance real-time sync** via Socket.io + Redis Pub/Sub adapter
- **JWT authentication via Passport.js** (`passport-jwt` strategy) with access + refresh
  token rotation
- **Transactional email** via Resend + React Email (password reset, account emails)
- **OpenAPI 3.0 documentation** served interactively via Swagger UI
- **RFC 7807-compliant error responses** for predictable client-side error handling

### Repository Information

```text
m-oliveda/syncboard_api
├── Node.js + Express + TypeScript
├── MongoDB Atlas (Mongoose ODM)
├── Redis Cloud (Socket.io Pub/Sub adapter)
└── Socket.io + @socket.io/redis-adapter
```

### Business Value

- **For Users:** changes made by teammates appear instantly — no refresh, no stale board
  state, no lost work from conflicting edits.
- **For Developers:** demonstrates production-grade patterns for scaling stateful
  real-time features on stateless serverless compute.
- **For Portfolio:** showcases REST API design, WebSocket architecture, and
  distributed-systems reasoning (the Cloud Run multi-instance problem) in one project.

---

## 2. Project Overview

### 2.1 Vision

Provide a backend that makes multi-user board collaboration feel instantaneous and
reliable, while remaining cheap to run and easy to reason about — no dedicated stateful
servers, just stateless containers plus a thin synchronization layer.

### 2.2 Target Users

- **Distributed teams** coordinating work visually (the actual end users of the
  SyncBoard web app, served indirectly through the API)
- **Frontend engineers** (via `syncboard_web`) consuming the REST + Socket.io contract
- **Prospective employers/reviewers** evaluating this as a portfolio piece

### 2.3 Core Responsibilities

1. **Identity** — registration, login, password reset, JWT issuance/refresh
2. **Persistence** — Workspaces, Boards, Lists, Cards, Activity log in MongoDB
3. **Ordering** — fractional/LexoRank-style `order` values so reordering a card or list
   never requires touching sibling documents
4. **Real-time fan-out** — broadcasting `card:updated`/presence events to every client
   viewing a board, regardless of which Cloud Run instance they're connected to
5. **API documentation** — a living OpenAPI spec consumable by the frontend team (or
   Postman/Swagger UI) without reading source code

### 2.4 Non-Goals (Out of Scope)

- ❌ File/attachment storage (no S3/GCS integration in v1)
- ❌ Offline-first / conflict-free replicated data types (CRDTs) — last-write-wins is
  acceptable for this project's scope
- ❌ Multi-region active-active deployment
- ❌ GraphQL — REST + WebSockets only

---

## 3. Architecture

### 3.1 High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER DEVICES                               │
│                         (Browsers via syncboard_web)                    │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ HTTPS (REST) + WSS (Socket.io)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          GOOGLE CLOUD RUN                                │
│                   syncboard-api service (session affinity ON)            │
│                                                                            │
│   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐          │
│   │ Instance 1    │     │ Instance 2    │     │ Instance N    │          │
│   │ Express +     │     │ Express +     │     │ Express +     │          │
│   │ Socket.io     │     │ Socket.io     │     │ Socket.io     │          │
│   └───────┬───────┘     └───────┬───────┘     └───────┬───────┘          │
└───────────┼─────────────────────┼─────────────────────┼──────────────────┘
            │                     │                     │
            │ Mongoose            │ Redis Pub/Sub       │ Mongoose
            ▼                     ▼                     ▼
┌───────────────────────┐   ┌───────────────────────────────┐
│    MongoDB Atlas       │   │          Redis Cloud          │
│  (external, outside    │   │   (external, outside GCP —    │
│   GCP — persistence)    │   │   Socket.io adapter only)     │
└───────────────────────┘   └───────────────────────────────┘
```

### 3.2 The Multi-Instance Problem

Cloud Run scales the API horizontally by spinning up additional container instances
under load. A plain Socket.io server keeps its Room membership **in process memory** —
so if User A is on Instance 1 and User B is on Instance 2, a broadcast from Instance 1
never reaches User B's socket, because Instance 2 doesn't know that room even had an
update.

`@socket.io/redis-adapter` solves this by publishing every broadcast to a Redis channel;
every instance subscribes to that channel and re-emits the event to its own
locally-connected sockets. The result: broadcasting behaves as if there were one server,
regardless of how many instances Cloud Run is currently running.

### 3.3 Request Flow — REST

```text
Client → HTTPS → Express Router → Middleware (auth, validate, rate limit)
       → Service layer → Mongoose model → MongoDB Atlas
       ← JSON response ←
```

### 3.4 Request Flow — Real-Time Card Move

```text
1. Client emits card:moved { cardId, sourceListId, targetListId, newOrder }
2. Server (Instance X) validates payload, persists to MongoDB
3. Server publishes card:updated to Redis channel "board:<boardId>"
4. Every instance subscribed to that channel (via redis-adapter) receives the event
5. Each instance re-emits card:updated to its own sockets in Room "board:<boardId>"
6. All clients viewing that board — on any instance — update their local state
```

---

## 4. Technology Stack

### 4.1 Core

| Category      | Technology               | Purpose                                |
| :------------ | :----------------------- | :------------------------------------- |
| **Runtime**   | Node.js (LTS)            | JavaScript runtime                     |
| **Framework** | Express.js               | HTTP server & routing                  |
| **Language**  | TypeScript               | Static typing across the codebase      |
| **Database**  | MongoDB Atlas + Mongoose | Document persistence + schema modeling |

### 4.2 Real-Time

| Category      | Technology                            | Purpose                           |
| :------------ | :------------------------------------ | :-------------------------------- |
| **WS Server** | Socket.io                             | Bidirectional real-time transport |
| **Scale-out** | `@socket.io/redis-adapter`, `ioredis` | Cross-instance Pub/Sub            |

### 4.3 Security & Validation

| Category          | Technology                 | Purpose                                               |
| :---------------- | :------------------------- | :---------------------------------------------------- |
| **Auth**          | `passport`, `passport-jwt` | Stateless JWT strategy guarding protected routes      |
| **Token signing** | `jsonwebtoken`             | Issues access/refresh JWTs (verified by passport-jwt) |
| **Hashing**       | `bcryptjs`                 | Password hashing                                      |
| **Headers**       | `helmet`                   | Secure HTTP headers                                   |
| **CORS**          | `cors`                     | Origin restriction                                    |
| **Rate limiting** | `express-rate-limit`       | Abuse/DoS mitigation                                  |
| **Validation**    | `zod`                      | Schema validation middleware                          |

### 4.4 Email

| Category      | Technology                | Purpose                                             |
| :------------ | :------------------------ | :-------------------------------------------------- |
| **Delivery**  | `resend`                  | Transactional email provider (password reset, etc.) |
| **Templates** | `@react-email/components` | Email markup authored as React components           |

### 4.5 Observability & Docs

| Category     | Technology                        | Purpose                              |
| :----------- | :-------------------------------- | :----------------------------------- |
| **Logging**  | Winston + Morgan                  | Structured JSON logs, HTTP logs      |
| **API Docs** | `swagger-ui-express`, OpenAPI 3.0 | Interactive, versioned API reference |

### 4.6 Development Tools

| Category       | Technology       | Purpose                    |
| :------------- | :--------------- | :------------------------- |
| **Testing**    | Jest + Supertest | Unit + integration testing |
| **Linting**    | ESLint           | Code quality               |
| **Formatting** | Prettier         | Consistent formatting      |
| **Container**  | Docker           | Local parity + deployment  |

---

## 5. Database Schema & Data Models

### 5.1 Collections Overview

```text
User ──< Workspace.members >── Workspace ──< Board ──< List ──< Card
                                                                  └──< Activity
```

### 5.2 Mongoose Schemas

```typescript
// User
{
  _id: ObjectId,
  email: { type: String, unique: true, required: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdAt: Date,
  updatedAt: Date,
}

// Workspace
{
  _id: ObjectId,
  name: { type: String, required: true },
  members: [{
    userId: { type: ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["Admin", "Member"], default: "Member" },
  }],
  createdAt: Date,
}

// Board
{
  _id: ObjectId,
  workspaceId: { type: ObjectId, ref: "Workspace", required: true, index: true },
  title: { type: String, required: true },
  createdAt: Date,
}

// List
{
  _id: ObjectId,
  boardId: { type: ObjectId, ref: "Board", required: true, index: true },
  title: { type: String, required: true },
  order: { type: Number, required: true }, // fractional — see 5.3
}

// Card
{
  _id: ObjectId,
  listId: { type: ObjectId, ref: "List", required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  order: { type: Number, required: true }, // fractional — see 5.3
  assignees: [{ type: ObjectId, ref: "User" }],
  labels: [{ type: String }],
  checklist: [{ text: String, done: { type: Boolean, default: false } }],
  createdAt: Date,
  updatedAt: Date,
}

// Activity
{
  _id: ObjectId,
  cardId: { type: ObjectId, ref: "Card", required: true, index: true },
  userId: { type: ObjectId, ref: "User", required: true },
  action: { type: String, required: true }, // e.g. "moved card from To Do to Done"
  timestamp: { type: Date, default: Date.now },
}
```

### 5.3 Reorder Strategy (Fractional Ordering)

Naively re-indexing every card's `order` field on every move (`0, 1, 2, 3...`) means a
single drag-and-drop can trigger N writes. Instead, `order` is a floating-point number:

- Moving a card between position `1` and `2` sets its `order` to `1.5`.
- Moving a card to the top sets `order` to `existingMin - 1`.
- Only the **moved document** is written — siblings are untouched.

**Rebalancing:** if repeated inserts between the same two cards cause floating-point
precision to degrade, a background job (or a lazy check on write) renumbers the affected
list's cards to evenly-spaced integers. This is documented as a known follow-up rather
than implemented in v1, since it only matters at high edit volume.

### 5.4 Indexes

| Collection | Index                          | Reason                                     |
| ---------- | ------------------------------ | ------------------------------------------ |
| `Board`    | `{ workspaceId: 1 }`           | Fast "boards in this workspace" queries    |
| `List`     | `{ boardId: 1, order: 1 }`     | Fetch lists for a board, pre-sorted        |
| `Card`     | `{ listId: 1, order: 1 }`      | Fetch cards for a list, pre-sorted         |
| `Activity` | `{ cardId: 1, timestamp: -1 }` | Fetch a card's activity feed, newest first |

---

## 6. API Design

### 6.1 Versioning & Conventions

- All routes are prefixed `/api/v1` — breaking changes ship under a new version prefix
  rather than mutating existing contracts. Each version mounts its own Swagger UI at
  `/api/v<n>/docs`, generated from its own `src/docs/v<n>/openapi.yaml` — versions never
  share a spec or a docs route.
- REST resource naming is plural and nested by ownership (`/workspaces/:id/boards`,
  `/boards/:id/lists`, `/lists/:id/cards`), not by verb-in-the-URL actions.
- `POST` creates, `GET` reads, `PATCH` performs a partial update (including
  reorder/move, which are just updates to `order`/`listId`), `DELETE` removes. There is
  no dedicated `PUT` or action-suffixed route (no `/reorder`, no `/move`).
- Mutations (`POST`/`PATCH`) validate the request body with a Zod schema before hitting
  the service layer.

### 6.2 Standard Response Envelope

```typescript
// Success
interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

// Error — RFC 7807 (application/problem+json)
interface ApiError {
  type: string; // URI identifying the error category
  title: string; // Short, human-readable summary
  status: number; // HTTP status code
  detail: string; // Specific explanation
  instance: string; // The request path that triggered it
}
```

### 6.3 Endpoint Summary

| Method | Path                                              | Auth | Description                                      |
| :----- | :------------------------------------------------ | :--- | :----------------------------------------------- |
| POST   | `/api/v1/auth/register`                           | No   | Create account                                   |
| POST   | `/api/v1/auth/login`                              | No   | Issue access + refresh JWT                       |
| POST   | `/api/v1/auth/refresh`                            | No   | Exchange refresh token for a new access token    |
| POST   | `/api/v1/auth/logout`                             | Yes  | Revoke the current refresh token                 |
| POST   | `/api/v1/auth/forgot-password`                    | No   | Trigger reset email                              |
| POST   | `/api/v1/auth/reset-password`                     | No   | Complete reset                                   |
| POST   | `/api/v1/workspaces`                              | Yes  | Create workspace                                 |
| GET    | `/api/v1/workspaces`                              | Yes  | List user's workspaces                           |
| GET    | `/api/v1/workspaces/:workspaceId`                 | Yes  | Get a single workspace                           |
| PATCH  | `/api/v1/workspaces/:workspaceId`                 | Yes  | Update workspace name                            |
| DELETE | `/api/v1/workspaces/:workspaceId`                 | Yes  | Delete workspace                                 |
| POST   | `/api/v1/workspaces/:workspaceId/members`         | Yes  | Add a member                                     |
| PATCH  | `/api/v1/workspaces/:workspaceId/members/:userId` | Yes  | Update a member's role                           |
| DELETE | `/api/v1/workspaces/:workspaceId/members/:userId` | Yes  | Remove a member                                  |
| POST   | `/api/v1/workspaces/:workspaceId/boards`          | Yes  | Create board in a workspace                      |
| GET    | `/api/v1/workspaces/:workspaceId/boards`          | Yes  | List boards in a workspace                       |
| GET    | `/api/v1/boards/:boardId`                         | Yes  | Full board state (board + lists + cards)         |
| PATCH  | `/api/v1/boards/:boardId`                         | Yes  | Update board title                               |
| DELETE | `/api/v1/boards/:boardId`                         | Yes  | Delete board                                     |
| POST   | `/api/v1/boards/:boardId/lists`                   | Yes  | Create list                                      |
| GET    | `/api/v1/boards/:boardId/lists`                   | Yes  | List lists on a board                            |
| GET    | `/api/v1/lists/:listId`                           | Yes  | Get a single list                                |
| PATCH  | `/api/v1/lists/:listId`                           | Yes  | Update title and/or fractional `order` (reorder) |
| DELETE | `/api/v1/lists/:listId`                           | Yes  | Delete list                                      |
| POST   | `/api/v1/lists/:listId/cards`                     | Yes  | Create card                                      |
| GET    | `/api/v1/lists/:listId/cards`                     | Yes  | List cards in a list                             |
| GET    | `/api/v1/cards/:cardId`                           | Yes  | Get a single card                                |
| PATCH  | `/api/v1/cards/:cardId`                           | Yes  | Update content and/or move (`listId` + `order`)  |
| DELETE | `/api/v1/cards/:cardId`                           | Yes  | Delete card                                      |
| GET    | `/api/v1/cards/:cardId/activity`                  | Yes  | Paginated activity log for a card                |

All `GET` collection endpoints accept `?page=`, `?limit=`, `?sort=` query params (see
[README §Collection Query Parameters](./README.md#collection-query-parameters)).

### 6.4 Middleware Pipeline

```text
requestId → morgan(logger) → helmet → cors → rateLimit
          → express.json() → route → passport.authenticate("jwt", { session: false })
          → zodValidate(schema) → controller → service → errorHandler
```

`errorHandler` is the single centralized point that converts thrown errors (validation,
auth, not-found, unexpected) into RFC 7807 responses — no route handler formats errors
directly.

---

## 7. Real-Time Layer

### 7.1 Connection Lifecycle

```text
1. Client connects with the JWT access token (auth handshake)
2. Server verifies the token; rejects the connection if invalid/expired
3. Client emits board:join { boardId }
4. Server adds the socket to Room `board:<boardId>`
5. Server broadcasts board:user-presence to the Room with the updated active-user list
6. On disconnect, server removes the socket and re-broadcasts presence
```

### 7.2 Redis Adapter Wiring

```typescript
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

Once wired, `io.to(room).emit(...)` transparently fans out across every Cloud Run
instance — no application code needs to know how many instances exist.

### 7.3 Event Contract

| Event                 | Direction       | Payload                                                   | Notes                                           |
| --------------------- | --------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `board:join`          | Client → Server | `{ boardId, userId, userMeta }`                           | Joins the board Room                            |
| `board:user-presence` | Server → Client | `{ boardId, activeUsers: [{ userId, name, avatarUrl }] }` | Broadcast on join/leave                         |
| `card:moved`          | Client → Server | `{ cardId, sourceListId, targetListId, newOrder }`        | Server persists before broadcasting             |
| `card:updated`        | Server → Client | Full updated card document                                | Broadcast to the board's Room, including sender |
| `list:reordered`      | Server → Client | `{ listId, newOrder }`                                    | Mirrors the REST reorder endpoint               |

### 7.4 Session Affinity (Cloud Run)

The WebSocket handshake is a long-lived HTTP connection. Cloud Run must route all frames
of that connection to the **same instance** for the socket to function — otherwise the
initial `Upgrade` request and subsequent frames could land on different instances. This
is configured via Cloud Run's **Session Affinity** setting (`--session-affinity` on
`gcloud run deploy`), which is orthogonal to the Redis adapter: affinity keeps one
client's connection stable; Redis is what lets that stable connection still receive
events triggered by clients connected elsewhere.

---

## 8. Security & Authentication

### 8.1 JWT Strategy (Passport.js)

Authentication is implemented with [Passport.js](https://www.passportjs.org/) rather
than a hand-rolled bearer-token check, so verification logic lives in one declarative
strategy instead of custom middleware:

```typescript
// src/config/passport.ts
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import passport from "passport";

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      const user = await UserModel.findById(payload.sub);
      return user ? done(null, user) : done(null, false);
    },
  ),
);
```

Protected routes call `passport.authenticate("jwt", { session: false })` —
`session: false` keeps the API stateless, consistent with running behind Cloud Run's
horizontally-scaled, session-affinity-only instances (no server-side session store).

- **Access token:** short-lived (`15m`), sent as a bearer token on every REST request
  and during the Socket.io handshake. Signed with `jsonwebtoken`; verified by the
  `passport-jwt` strategy above.
- **Refresh token:** longer-lived (`7d`), used only to mint a new access token via a
  dedicated refresh endpoint; stored client-side in an httpOnly cookie or secure storage
  (frontend's responsibility, documented in `web/MASTERPLAN.md`).
- Tokens are signed with distinct secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`) so a
  leaked access-token secret cannot be used to forge refresh tokens.

### 8.2 Password Handling

- Hashed with `bcryptjs` (cost factor 12) before storage — plaintext passwords are never
  persisted or logged.
- Password reset uses a single-use, time-limited token, not the password itself. The
  reset link is delivered by the email service (§8.5) — never returned in the API
  response.

### 8.3 Authorization

- Workspace membership + role (`Admin` / `Member`) gates write operations on boards
  within that workspace.
- Every board/list/card mutation route re-derives the workspace from the resource
  hierarchy and checks membership — the client-supplied `workspaceId` is never trusted
  for access control.

### 8.4 Transport & Headers

- `helmet` sets secure defaults (`X-Content-Type-Options`, `Strict-Transport-Security`,
  etc.).
- `cors` restricts allowed origins to `CORS_ORIGIN` (the deployed frontend's URL).
- `express-rate-limit` throttles auth endpoints more aggressively than general API
  routes to blunt credential-stuffing attempts.

### 8.5 Email Delivery (Resend + React Email)

- `src/emails/` holds transactional templates authored as React components (e.g.
  `PasswordResetEmail.tsx`, `WelcomeEmail.tsx`) using `@react-email/components`.
- `email.service.ts` renders a template to HTML (`@react-email/render`) and hands it to
  the `resend` SDK, initialized once with `RESEND_API_KEY`:

```typescript
// src/services/email.service.ts
import { Resend } from "resend";
import { render } from "@react-email/render";
import { PasswordResetEmail } from "@/emails/PasswordResetEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = await render(PasswordResetEmail({ resetUrl }));
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Reset your SyncBoard password",
    html,
  });
}
```

- Only `auth.service.ts` calls into `email.service.ts` — no other service sends email
  directly, keeping delivery logic and provider config in one place.

---

## 9. Development Environment

### 9.1 Prerequisites

- Docker Desktop + Docker Compose — required to run the local stack (API + MongoDB +
  Redis)
- Node.js LTS, npm — required for lint, tests, and Husky git hooks
- MongoDB Atlas free-tier cluster — deployed environments only
- Redis Cloud free-tier instance — deployed environments only

### 9.1.1 Git Hooks (Husky)

Husky enforces quality gates locally, before code ever reaches CI:

- **Pre-commit:** `lint` + `format:check` + `type-check` + `test`
- **Commit message:** validated against Gitmoji format (e.g.
  `:sparkles: Add card reorder endpoint`), matching the convention used in
  `syncboard_web`

### 9.2 Local Setup

```bash
git clone https://github.com/m-oliveda/syncboard_api.git
cd syncboard_api
cp .env.example .env
docker compose up --build
```

`npm install` on the host is only needed for lint, tests, and Husky — not to run the
stack.

### 9.3 Docker Compose (Local Stack)

`docker-compose.yml` runs the API, MongoDB, and Redis together. It is local development
only — not used in CI/CD.

```yaml
name: syncboard-api_local

services:
  mongo:
    image: mongo:7
    container_name: syncboard-api-mongo
    restart: unless-stopped
    ports: ["27017:27017"]
    environment:
      - MONGO_INITDB_DATABASE=syncboard
    volumes:
      - mongo-data:/data/db
    networks:
      - syncboard-local
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7
    container_name: syncboard-api-redis
    restart: unless-stopped
    ports: ["6379:6379"]
    networks:
      - syncboard-local
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: dev
    container_name: syncboard-api
    ports: ["4000:4000"]
    env_file: .env
    environment:
      NODE_ENV: development
      PORT: 4000
      MONGO_URI: mongodb://mongo:27017/syncboard
      REDIS_URL: redis://redis:6379
    volumes:
      - .:/app
      - api-node-modules:/app/node_modules
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - syncboard-local

networks:
  syncboard-local:
    driver: bridge

volumes:
  mongo-data:
  api-node-modules:
```

No persistent volume for Redis — it's the Socket.io Pub/Sub adapter only, never used for
data storage, so nothing there needs to survive a restart (see §4.2).

Compose overrides `MONGO_URI` and `REDIS_URL` inside the `api` container to Docker DNS
names (`mongodb://mongo:27017/syncboard`, `redis://redis:6379`). Host-side `.env` may
keep `localhost` for an optional `npm run dev` on the machine. Switch to Atlas / Redis
Cloud URLs before deploying.

---

## 10. Testing Strategy

### 10.1 Coverage Priorities

| Area               | Test Type               | Why                                                      |
| ------------------ | ----------------------- | -------------------------------------------------------- |
| Reorder logic      | Unit                    | Fractional-order edge cases are easy to get subtly wrong |
| Auth service       | Unit + Integration      | Security-critical                                        |
| REST endpoints     | Integration (Supertest) | Verify full middleware pipeline + response shape         |
| Socket.io handlers | Unit (mocked adapter)   | Event contracts must stay stable for the frontend        |

### 10.2 Example Test

```typescript
// tests/unit/services/reorder.util.test.ts
import { describe, test, expect } from "@jest/globals";
import { computeOrderBetween } from "@/utils/reorder";

describe("computeOrderBetween", () => {
  test("returns the midpoint between two orders", () => {
    expect(computeOrderBetween(1, 2)).toBe(1.5);
  });

  test("returns a value below the first card when moved to the top", () => {
    expect(computeOrderBetween(null, 1)).toBeLessThan(1);
  });
});
```

---

## 11. CI/CD Pipeline

### 11.0 GCP Infrastructure

Each environment has a dedicated GCP project and service account, matching the pattern
used by `syncboard_web`. Preview deploys uses the preview project since they are
ephemeral, per-PR Cloud Run services rather than a standing environment:

| Environment     | GCP Project ID                 | Service Account          |
| --------------- | ------------------------------ | ------------------------ |
| **Preview**     | `moliveda-gcloudprojects-prev` | `cicd-deployer-prev@...` |
| **Development** | `moliveda-gcloudprojects-dev`  | `cicd-deployer-dev@...`  |
| **Staging**     | `moliveda-gcloudprojects-stg`  | `cicd-deployer-stg@...`  |
| **Production**  | `moliveda-gcloudprojects-prod` | `cicd-deployer-prod@...` |

### 11.1 GitFlow Branch → Environment Mapping

| Branch/Event | Environment | Trigger                                  |
| ------------ | ----------- | ---------------------------------------- |
| Pull request | Preview     | Deploy on PR open/sync; cleanup on close |
| `feature/*`  | Local only  | Manual                                   |
| `develop`    | Development | Auto-deploy on push                      |
| `release/*`  | Staging     | Auto-deploy on push                      |
| `main`       | Production  | Manual dispatch                          |

### 11.2 Pipeline Stages

1. **CI (`ci.yml`, every pull request** to `develop`, `release/**`, `main`**):** install
   deps → lint → format check → type-check → build → `test:coverage`. The job fails the
   check if the Jest coverage summary is below 100% across
   statements/branches/functions/ lines — this is the enforcement mechanism behind the
   "100% testing coverage" goal in [Testing Strategy](#10-testing-strategy).
2. **Deploy Preview (`deploy-preview.yml`, on PR open/sync):** build the Docker image,
   push to Artifact Registry, deploy an ephemeral Cloud Run service named
   `syncboard-api-pr-<PR#>` in the preview project, comment the preview URL on the PR.
3. **Cleanup Preview (`cleanup-preview.yml`, on PR close):** delete the
   `syncboard-api-pr-<PR#>` Cloud Run service so ephemeral environments don't
   accumulate.
4. **Deploy Development:** build Docker image, push to Artifact Registry, deploy to the
   `syncboard-api` Cloud Run service (dev project) with session affinity enabled
5. **Deploy Staging:** same, targeting the staging Cloud Run project
6. **Deploy Production:** manual approval gate, then deploy to the production Cloud Run
   project

### 11.3 Required Secrets (per environment)

```text
GCP_PROJECT_ID
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_SERVICE_ACCOUNT
MONGO_URI
REDIS_URL
JWT_SECRET
JWT_REFRESH_SECRET
RESEND_API_KEY
```

Authentication to GCP uses Workload Identity Federation — no long-lived service account
keys stored in CI. Preview deploys use their own `GCP_PROJECT_ID`/service-account
secrets, scoped to the dedicated preview GCP project from §11.0 — not shared with
Development.

---

## 12. Development Phases

### Phase 0 — Project Scaffolding & Testing Infra

- [x] Initialize the TypeScript project (`tsconfig.json`, ESLint, Prettier, Husky hooks)
- [x] Wire up Jest + Supertest with a coverage threshold of 100%
- [x] Add `docker-compose.yml` for the local stack (API + MongoDB + Redis)

### Phase 1 — Stateless REST API

- [ ] Build CRUD for Workspaces, Boards, Lists, Cards over MongoDB
- [ ] Implement fractional/LexoRank reorder logic (`utils/reorder.ts`)
- [ ] Exercise every endpoint via Swagger UI/Postman before any UI exists

### Phase 2 — Auth Hardening (Passport.js)

- [ ] Register the `passport-jwt` strategy (`src/config/passport.ts`)
- [ ] Implement JWT access/refresh issuance and rotation
- [ ] Implement password reset (token issuance + consumption)
- [ ] Add rate limiting on auth routes
- [ ] Add RBAC checks on workspace-scoped mutations

### Phase 3 — Real-Time Layer

- [ ] Add Socket.io and implement `board:join` + presence tracking
- [ ] Implement `card:moved` → persist → `card:updated` broadcast cycle within a single
      instance first (no Redis yet) to validate the event contract
- [ ] Add the `@socket.io/redis-adapter` for cross-instance fan-out

### Phase 4 — Transactional Email (Resend + React Email)

- [ ] Build React Email templates in `src/emails/` (password reset, welcome)
- [ ] Implement `email.service.ts` (Resend client + template rendering)
- [ ] Wire `auth.service.ts` to send the password-reset email on request

### Phase 5 — Observability & Docs

- [ ] Structured logging (Winston + Morgan) with request correlation IDs
- [ ] Complete the OpenAPI spec and mount Swagger UI at `/api/v1/docs`
- [ ] Centralize RFC 7807 error handling across all routes

### Phase 6 — CI/CD & Deployment Environments

- [ ] Add `ci.yml` (lint, format check, type-check, build, coverage gate)
- [ ] Add `deploy-preview.yml` + `cleanup-preview.yml` for per-PR Cloud Run previews
- [ ] Add `deploy-dev.yml`, `deploy-staging.yml`, `deploy-prod.yml`
- [ ] Configure Session Affinity on the Cloud Run service

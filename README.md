# Seat Booker — Workshop Registration Service

A registration system for a community training centre with 3 locations and ~15 non-technical
staff. It replaces a shared spreadsheet that allowed workshops to be overbooked and left
cancellations untracked.

**The core guarantee:** a workshop can never hold more active registrations than its capacity —
even when several staff register for the last seat at the same instant.

## Status

Feature-complete and running end to end: auth, users, workshops, registrations and the full
frontend work for all three roles. The capacity rule is implemented and has been verified
against the running API (see Tests). The bonus audit-trail and waitlist features are the
remaining outstanding items. See the phase table below.

The whole stack runs from one command — see Quick start.

## Stack

| Layer         | Choice                    | Why                                                                                                                           |
| ------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Backend       | NestJS + TypeScript       | Guards and decorators make deny-by-default role control declarative                                                           |
| Database      | PostgreSQL 16             | Real transactions, row locks, CHECK constraints, partial unique indexes                                                       |
| ORM           | Drizzle ORM               | Type-safe column-to-column comparison for the atomic seat claim; CHECK constraints and partial indexes declared in the schema |
| Auth          | JWT access token + bcrypt | Stateless and sufficient for this scope                                                                                       |
| Frontend      | React + Vite + TypeScript | Fast, no SSR needed                                                                                                           |
| Data fetching | TanStack Query            | Caching, invalidation after mutations, real error states                                                                      |
| UI            | Tailwind CSS              | Clean, legible UI for non-technical users                                                                                     |
| Monorepo      | pnpm workspaces           | One install, shared types between API and web                                                                                 |

## Repository layout

```
seat-booker/
├── apps/
│   ├── api/                 NestJS backend (clean architecture per feature)
│   └── web/                 React + Vite frontend
├── packages/
│   ├── contracts/           Shared types and error codes — one source of truth
│   └── tsconfig/            Shared TypeScript base configs
├── docker-compose.yml       Full local stack: PostgreSQL 16 + API + web
├── seatbooker / .ps1        One-command stack control (sh and PowerShell)
└── .env.example             Every variable the stack needs
```

Each backend feature module is layered, with dependencies pointing inward only:

```
modules/<feature>/
├── domain/            Entities, value objects, domain errors, repository interfaces (pure TS)
├── application/       Use-cases, depending only on domain interfaces
├── infrastructure/    Drizzle repository implementations — the only place SQL lives
└── api/               Controllers, DTOs, mappers
```

## Prerequisites

- **Docker Desktop**, running. This is the only hard requirement for the quick start.
- **Node.js 20.11+** (developed on 24.x) — needed only for local development, not for the
  Docker quick start.
- **pnpm 9+** (`npm install -g pnpm`) — same: local development only.

This repo is pnpm-only. `npm install` and `yarn` are not supported.

Ports **3000**, **5173** and **5433** must be free. Postgres is published on 5433 rather than
5432 because a natively installed Postgres service commonly already owns 5432, and the native
one silently wins host connections.

## Quick start — from clone to running app

**Docker Desktop is the only thing you need installed.** No Node, no pnpm, no `.env` file to
write, no migration to run, no seed command to remember. Three steps:

### Step 1 — clone the repository

```bash
git clone <repository-url>
cd seat-booker
```

### Step 2 — start everything

```bash
docker compose up -d --build
```

The first run takes a few minutes: it downloads the base images, installs dependencies and
builds both apps. Later runs reuse the cache and take seconds.

There is **nothing to configure between cloning and this command.** The compose file carries
all of its own settings.

### Step 3 — wait for it, then open the app

Watch the API until it says it is listening:

```bash
docker compose logs -f api
```

Wait for these two lines, then press `Ctrl+C` to stop following:

```
[entrypoint] Starting API ...
[Bootstrap] API listening on http://localhost:3000/api
```

Now open **http://localhost:5173** and sign in:

| Email              | Password      | Role    |
| ------------------ | ------------- | ------- |
| admin@centre.dev   | `Admin123!`   | ADMIN   |
| manager@centre.dev | `Manager123!` | MANAGER |
| staff@centre.dev   | `Staff123!`   | STAFF   |

Sign in as **manager@centre.dev** to see workshops and registrations — ADMIN deliberately has
no access to those (see the note under Seeded logins).

That is the whole setup.

### Do I need to create the schema or seed the database?

**No.** Both happen automatically. Before the API starts listening, its container:

1. waits for PostgreSQL to accept connections,
2. applies all Drizzle migrations — creating the tables, CHECK constraints and indexes,
3. runs the seed, creating the three users above plus eight demo workshops.

So a fresh clone arrives with a populated, ready-to-use database. The seed is **idempotent**
(every row is upserted on a natural key), so it also runs safely on every later restart without
duplicating anything. Set `SEED_ON_BOOT=false` in `docker-compose.yml` to skip it.

### Where things are running

| Service  | Address                                                  |
| -------- | -------------------------------------------------------- |
| Frontend | http://localhost:5173                                    |
| API      | http://localhost:3000/api                                |
| Postgres | `localhost:5433` — user / password / db all `seatbooker` |

### Shortcut wrappers

These do the same as `docker compose up -d --build`, but also wait for the API and print the
URLs and logins when it is ready — so you can skip step 3:

```bash
pnpm app:up          # any shell with pnpm available
./seatbooker up      # macOS / Linux / Git Bash
.\seatbooker.ps1 up  # Windows PowerShell
```

### Everyday commands

```bash
pnpm app:logs        # follow all three services
pnpm app:status      # what is running
pnpm app:down        # stop (database volume kept, data survives)
pnpm app:reset       # stop, DELETE the database, rebuild and start fresh
pnpm app:rebuild     # force a no-cache image rebuild
```

Without pnpm, use `docker compose logs -f`, `docker compose ps` and `docker compose down`.

### If something goes wrong

| Symptom                             | Cause and fix                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ports are not available: ... 3000` | Something already owns the port — often a local `pnpm dev`. Stop it, or find it with `netstat -ano \| findstr :3000` (Windows) / `lsof -i :3000` (macOS, Linux). |
| `api` keeps restarting              | Read `docker compose logs api`. Usually PostgreSQL was not reachable; the entrypoint retries 20 times before giving up.                                          |
| App loads but every request fails   | The API is not up yet, or not on port 3000. Check `docker compose ps`.                                                                                           |
| Want a completely clean slate       | `pnpm app:reset` — deletes the database volume, then re-migrates and re-seeds.                                                                                   |

The compose file hardcodes its configuration (database credentials, a dev JWT secret, CORS
origin, timezone) so a reviewer can clone and run with no setup step. Every value is a local
development credential — none is a real secret, and none is used outside a local container.

### Notes on the containers

- **The seed runs on every API start.** It is idempotent — every row is upserted on a natural
  key — so restarting never duplicates data. Set `SEED_ON_BOOT=false` to skip it.
- **The frontend's API URL is baked in at build time.** Vite inlines `import.meta.env`, so
  `VITE_API_BASE_URL` is a Docker _build arg_, not a runtime variable. It is set to
  `http://localhost:3000/api` — the URL the **browser** calls, which is why it is the published
  host port and not `http://api:3000`. Changing it requires a rebuild.
- **The web container serves a production build** through nginx, with an SPA fallback so deep
  links like `/workshops/<id>` are routed client-side. There is no hot reload — use the local
  development setup below for that.
- **The API image keeps its devDependencies** (~800MB). The migrate and seed scripts are
  TypeScript run through `tsx` and are never compiled into `dist/`, so pruning them would break
  first boot. Compiling those scripts is the first thing to change if this were ever deployed.

## Local development (hot reload)

For working on the code. Runs the apps on the host, with only Postgres in Docker.

```bash
# 1. Start PostgreSQL only
pnpm db:up

# 2. Install all workspace dependencies
pnpm install

# 3. Configure environment
cp .env.example apps/api/.env
cp .env.example apps/web/.env
# then trim each file to its own section

# 4. Create the schema and seed demo data
pnpm db:migrate
pnpm seed

# 5. Run both apps with hot reload
pnpm dev
```

API on http://localhost:3000/api · frontend on http://localhost:5173

> This and the Docker stack **cannot run at the same time** — both bind ports 3000 and 5173.
> Run `pnpm app:down` first. `pnpm db:up` starts only the database container, so it is safe to
> leave Postgres running for either workflow.

## Seeded logins (development only)

| Email              | Password      | Role    | Can do                                      |
| ------------------ | ------------- | ------- | ------------------------------------------- |
| admin@centre.dev   | `Admin123!`   | ADMIN   | Manage user accounts and roles              |
| manager@centre.dev | `Manager123!` | MANAGER | Create and edit workshops, register, cancel |
| staff@centre.dev   | `Staff123!`   | STAFF   | Register and cancel attendees, view history |

Note: per the brief's permission matrix, ADMIN deliberately has **no** access to workshops or
registrations. This is a literal reading of the spec, recorded in DESIGN.md.

Seeded workshops include one with a single seat left (to demonstrate the race), one already full,
and DRAFT / CANCELLED / past COMPLETED examples.

## Tests

Jest, supertest and `@nestjs/testing` are installed and the scripts are wired:

```bash
pnpm test              # unit tests
pnpm test:e2e          # API integration tests
pnpm test:concurrency  # the capacity proof
```

**The capacity rule has been verified manually** against the running API: a workshop of capacity 3
and 30 simultaneous registration requests produced exactly 3 × `201` and 27 × `409 WORKSHOP_FULL`,
with `active_count = 3` matching exactly 3 active rows in the database — no overbooking, no
counter drift. The method and output are in DESIGN.md section 3.

The automated form of that proof creates a workshop with capacity 5, fires 50 parallel
registrations with distinct emails, and asserts exactly 5 succeed, exactly 45 fail with
`409 WORKSHOP_FULL`, and the database holds 5 active registrations with `active_count = 5`.

## How over-registration is prevented

Three independent layers:

1. **Atomic conditional UPDATE.** A seat is claimed by a single statement that re-checks capacity
   in its `WHERE` clause. Postgres row-locks the workshop, so concurrent requests queue and each
   re-evaluates against the committed count. At most `capacity` can ever succeed.
2. **Database CHECK constraint.** `CHECK (active_count <= capacity)` refuses overbooking even if
   application code has a bug.
3. **Partial unique index.** One active registration per email per workshop.

The claim and the registration insert are in one transaction, so a rejected insert rolls the seat
claim back. A naive `SELECT count(*)` followed by a conditional insert is exactly the bug this
replaces, and is not used anywhere.

Full reasoning and trade-offs are in DESIGN.md.

## Build phases

| #   | Phase                                             | State                                        |
| --- | ------------------------------------------------- | -------------------------------------------- |
| 0   | Scaffolding, workspace, git                       | done                                         |
| 1   | Drizzle schema, constraints migration, seed       | done — constraints verified in the DB        |
| 2   | Auth, roles guard, error filter, shared contracts | done — 401/403/400 envelopes verified        |
| 3   | Users API                                         | done                                         |
| 4   | Workshops CRUD and filters                        | done                                         |
| 5   | Register / cancel transactions                    | done — capacity rule verified manually       |
| 6   | Frontend                                          | done — all three roles, incl. history view   |
| 7   | Documentation                                     | done — README + DESIGN.md                    |
| 8   | Dockerised one-command stack                      | all 3 services verified running              |

Phase 7a was verified on the running stack: all three containers up, migrations and seed
applied automatically, login returning a token, `GET /api/workshops` without a token returning
`401`, the frontend served with its SPA deep-link fallback working, and
`active_count <= capacity` holding with all four CHECK constraints present.

## A note on DESIGN.md

`DESIGN.md` is a required deliverable but is intentionally excluded from version control in this
repo, along with the other internal working documents. It is supplied alongside the repository.

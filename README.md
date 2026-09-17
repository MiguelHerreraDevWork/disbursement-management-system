# IAS Software — Disbursement Requests

A small full-stack app for registering, listing, and deciding (approving/rejecting) supplier
disbursement requests. Built for the IAS Software Full Stack technical assessment
(Node.js + React 18+).

- **Source of truth (immutable):** [`docs/IAS_TECHNICAL_TEST.md`](docs/IAS_TECHNICAL_TEST.md)
- **Technical design, architecture, and every traceable decision:** [`docs/TDD.md`](docs/TDD.md)
- **AI usage log (per-phase, honest — including corrections and rejections):** [`docs/AI_USAGE_LOG.md`](docs/AI_USAGE_LOG.md)

This README is the practical "how do I run this" entry point. For *why* something was built
a certain way (idempotency design, concurrency strategy, auth model, etc.), see `docs/TDD.md` —
it is the living decisions record this assessment's delivery rules ask for.

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose v2 (`docker compose version`)
- For local (non-Docker) development: Node.js 20+ and npm

No local PostgreSQL install is required — it always runs via the official `postgres:16-alpine`
image, either through Docker Compose or (implicitly) Kubernetes.

## Quick start (Docker Compose)

```bash
cp .env.example .env
docker compose up -d --build
```

This starts three containers: `db` (Postgres 16), `api` (Express, port `3000`), and `web`
(the React app built and served by nginx, port `5173`). The `api` container automatically
applies pending Drizzle migrations and runs the idempotent seed script (demo users + suppliers)
before starting the server — no manual steps.

- App: <http://localhost:5173>
- API directly: <http://localhost:3000>
- Health: <http://localhost:3000/healthz> (liveness) and `/readyz` (readiness, checks DB)
- Metrics: <http://localhost:3000/metrics> (Prometheus text format)

Demo credentials (local/demo only — see [Demo credentials](#demo-credentials) below).

To stop: `docker compose down` (add `-v` only if you also want to delete the Postgres volume).

## Environment variables

All variables are documented with safe placeholder values in [`.env.example`](.env.example) —
copy it to `.env` and adjust if needed. Never commit real secrets.

| Variable | Used by | Notes |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `db` (docker-compose) | Initializes the Postgres container |
| `DATABASE_URL` | `apps/api` (local `npm run dev`) | Host-oriented (`localhost`); the containerized `api` service builds its own `db`-hostname connection string in `docker-compose.yml` instead of reusing this one — see `docs/TDD.md` §16 |
| `TEST_DATABASE_URL` | `apps/api` tests only | A second, isolated database (`ias_disbursements_test`) so `npm test` never writes into the dev/demo dataset. Created automatically by `docker/postgres-init/01-create-test-db.sh` on a **fresh** `docker compose up`; see [Running tests](#running-tests) if you already had a volume before this existed |
| `JWT_SECRET` | `apps/api` | Signs/verifies login JWTs. Demo value only |
| `JWT_EXPIRES_IN` | `apps/api` | Defaults to `8h` if unset |
| `PORT` | `apps/api` | Defaults to `3000` |
| `NODE_ENV` | `apps/api` | `development` for `npm run dev`; hardcoded to `production` for the containerized `api` service in `docker-compose.yml` |
| `LOG_LEVEL` | `apps/api` | `pino` log level |
| `VITE_API_URL` | `apps/web` (optional) | Leave unset for both local `vite dev` and Docker/Kubernetes — both proxy `/api/*` same-origin (Vite's dev proxy, nginx's `proxy_pass`), so no CORS and no absolute API URL are needed. Only set this if serving the frontend build with no such proxy in front of it |

## Local development (without Docker)

Requires a running Postgres — either `docker compose up -d db` (recommended, reuses the same
`docker-compose.yml`) or your own local instance matching `DATABASE_URL`.

```bash
cp .env.example .env

cd apps/api
npm install
npm run db:migrate
npm run db:seed
npm run dev        # http://localhost:3000

# in a second terminal
cd apps/web
npm install
npm run dev         # http://localhost:5173, proxies /api/* to :3000 via vite.config.ts
```

## Running tests

Both apps' tests are real integration tests where it matters (backend hits a real, isolated
Postgres database — nothing is mocked at the DB layer) and MSW-mocked at the network boundary
for the frontend.

```bash
# Backend — requires TEST_DATABASE_URL's database to exist, migrated and seeded once:
cd apps/api
npm run db:test:migrate   # first time only (or after a schema change)
npm run db:test:seed      # first time only
npm test                  # 58 tests

# Frontend
cd apps/web
npm test                  # 29 tests
```

`npm run db:test:migrate`/`db:test:seed` are only needed once (or after schema changes) — the
test database is a fixture, not recreated per run. If you started `docker compose up` after the
`docker/postgres-init/` script existed, the test database and its schema/seed already exist
automatically; the commands above are idempotent either way.

Type-checking (`npm run typecheck` in either app) also checks test files, not just `src/`.

## Main routes

### Backend API (`apps/api`, all under `/api` except health/metrics)

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/auth/login` | — | Returns a JWT + role |
| `GET` | `/api/suppliers` | any authenticated user | Populates the supplier picker |
| `POST` | `/api/disbursement-requests` | `ANALYST` | Idempotent on `(supplierId, externalReference)` — a retried call returns the same resource, not a duplicate |
| `GET` | `/api/disbursement-requests` | any authenticated user | `?status=&search=&page=&pageSize=` |
| `GET` | `/api/disbursement-requests/:id` | any authenticated user | Includes the decision, if any |
| `POST` | `/api/disbursement-requests/:id/approve` | `SUPERVISOR` | Conditional on the request still being `PENDING`; `409` otherwise |
| `POST` | `/api/disbursement-requests/:id/reject` | `SUPERVISOR` | Requires a non-empty `reason`; same `409` semantics |
| `GET` | `/healthz` | — | Liveness — process up, never checks the DB |
| `GET` | `/readyz` | — | Readiness — `200`/`503` based on whether Postgres is reachable |
| `GET` | `/metrics` | — | Prometheus text format |

### Frontend routes (`apps/web`)

| Route | Access | Notes |
|---|---|---|
| `/login` | public | Redirects to `/requests` if already authenticated |
| `/requests` | any authenticated user | Status filter + search + pagination, all reflected in the URL; polls every 5s |
| `/requests/new` | `ANALYST` only | Non-`ANALYST` users are redirected back to `/requests` (UX only — the server independently enforces this) |
| `/requests/:id` | any authenticated user | Approve/reject controls shown only to `SUPERVISOR` on a `PENDING` request; polls every 5s |

## Demo credentials

Seeded by `npm run db:seed` / the `api` container's startup — **local/demo only, not real
credentials**:

| Username | Password | Role |
|---|---|---|
| `analyst.demo` | `Demo-Pass-1234!` | `ANALYST` — can create requests |
| `supervisor.demo` | `Demo-Pass-1234!` | `SUPERVISOR` — can approve/reject requests |

## Kubernetes

Minimal manifests are in [`k8s/`](k8s/) — Deployments/Services for `api`, `web`, and `postgres`,
a `ConfigMap` for non-secret config, and `secret.example.yaml` documenting the required secret
keys (copy it to `k8s/secret.yaml`, which is git-ignored, and fill in real values — never commit
that file). A real cluster deployment is **not** required by this assessment; these manifests
were validated for correctness with [`kubeconform -strict`](https://github.com/yannh/kubeconform)
against real Kubernetes OpenAPI schemas (this environment had no reachable cluster to run
`kubectl apply --dry-run=client` against — see `docs/TDD.md` §2/§20 for the full explanation).
If you have a cluster available:

```bash
kubectl apply --dry-run=client -f k8s/
```

(This environment had no reachable cluster, so that exact command couldn't be run here — even
`--dry-run=client` needs live API-server discovery in recent `kubectl` versions. `kubeconform`
was used instead as a genuinely offline substitute; see above.)

## Architecture & key decisions (summary)

Full detail, including the open question this assessment deliberately leaves ambiguous (what
identifies a "duplicate" request) and the assumption adopted for it, lives in `docs/TDD.md`.
Highlights:

- **Idempotent create (RF5):** `(supplierId, externalReference)` is treated as the operation's
  identity, enforced with a DB `UNIQUE` constraint + `INSERT ... ON CONFLICT DO NOTHING` — no
  check-then-insert race window. See `docs/TDD.md` §7 for the assumption and its named risk.
- **Concurrent decisions (RF6):** a single transaction per decide call with a conditional
  `UPDATE ... WHERE status = 'PENDING'` — the row lock *is* the check. See `docs/TDD.md` §8.
- **Auth:** JWT (HS256), role read exclusively from the verified token server-side, never from
  anything client-supplied. See `docs/TDD.md` §10.
- **Cross-session sync (RF7):** TanStack Query polling (`refetchInterval: 5000`) plus
  `refetchOnWindowFocus`, chosen over SSE/WebSockets as deliberately simpler for this scope. See
  `docs/TDD.md` §14 for the alternatives comparison.
- **Untrusted input (`concept`/`reason`):** stored as opaque text, rendered via plain JSX text
  interpolation only (no `dangerouslySetInnerHTML` anywhere) — verified with an explicit
  stored-XSS regression test.

## What's not implemented / known gaps

This assessment's scope (RF1–RF8, security, observability, Docker, Kubernetes, tests) is fully
implemented and verified — see `docs/TDD.md` §20/§21 for the phase-by-phase and
requirement-by-requirement traceability. Explicitly out of scope, with reasoning, per
`docs/TDD.md` §22: real financial-system integration, supplier CRUD, password
reset/refresh-token rotation, `pg_trgm` full-text search, Helm/Ingress/autoscaling, and a few
other production-hardening items that aren't required or graded at this scope.

**One real, non-deliberate gap at delivery time:** this repository's commit history does not yet
reflect the phase-by-phase work described in `docs/TDD.md` and `docs/AI_USAGE_LOG.md`. Per this
engagement's explicit instruction, commits were left entirely under the developer's manual
control throughout implementation, so most of the work above still sits as uncommitted changes
in the working tree as of this README being written. **Before delivery, this needs to be
committed** (ideally as a series of commits mirroring the 13 implementation phases, matching the
narrative in `docs/TDD.md` §20 and `docs/AI_USAGE_LOG.md`), and the exact delivery branch/commit
identified here or in the submission itself, per IAS §13's delivery rules.

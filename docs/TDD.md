# TDD — Solicitudes de Desembolso a Proveedores

Technical Design Document and living implementation guide for the IAS Software Full Stack technical assessment (Node.js + React 18+).

Source of truth: [`docs/IAS_TECHNICAL_TEST.md`](./IAS_TECHNICAL_TEST.md) (immutable, Spanish original). This document is written in English for the design/interview narrative but every requirement reference (RF1–RF8, §5–§14) maps back to that file section by section.

## Document Status

- **Current phase:** Phase 13 complete — **all 13 implementation phases done.** This assessment's implementation is feature-complete and verified; see the one explicitly-flagged exception below.
- **Last updated:** 2026-09-16
- **Implementation status:** All 13 phases complete and verified (see §20 — every row now `DONE`). Phases 1–5: backend foundation, auth, domain endpoints, decide/concurrency, and their tests. Phases 6–9: full frontend. Phase 10: `/metrics`. Phase 11: Dockerfiles + compose, verified end-to-end. Phase 12: Kubernetes manifests, validated with `kubeconform -strict` (no cluster was reachable in this environment) — see earlier entries in this section's history / the AI usage log for full detail on all of these. Phase 13: wrote `README.md` (prerequisites, env vars, quick start, local dev, test commands, main routes, demo credentials, architecture summary, known gaps) and verified every command in it by actually re-running it against the live repo state — `docker compose up -d --build` (all 3 services healthy, login/health/metrics/deep-link all confirmed working), backend tests (58/58), frontend tests (29/29) — rather than writing it from memory. Did a full §21 Definition-of-Done walkthrough: re-read §7/§9/§14 (the design sections behind §5/§6's traceability rows) against the actual implementation and found one real documentation drift — §9's error-format example hadn't been updated for the optional `details` field added in Phase 4 — corrected on the spot. `docs/AI_USAGE_LOG.md` now has one honest entry per phase (13 total). Every §2 traceability row and every §21 checkbox is now `DONE`, with exactly **one** explicitly-flagged, non-deliberate exception: **commit history**. Per this engagement's standing instruction, the assistant never ran `git commit` — only one commit exists (the developer's own Phase 1 commit), and all Phase 2–13 work remains uncommitted in the working tree as of this update. This is called out explicitly in both this document (§21) and `README.md`, not hidden, and is the one remaining action that requires the developer.
- **Known blockers:** None from the assistant's side. The developer needs to commit the Phase 2–13 work (ideally mirroring the phase structure) and identify the exact delivery branch/commit per IAS §13 before this is ready to submit.

This document must be updated whenever: an architectural decision changes, an assumption changes, implementation diverges from this design, a requirement is verified complete, or a new trade-off is introduced. A requirement is marked `DONE` in the traceability table only after it has been verified (automated test, successful build, manual API check, UI check, Docker run, or config inspection) — never merely because code was written.

---

## 1. Overview

### Problem

An internal tool for a company that pays suppliers for services already rendered. An **analyst** registers a disbursement request against a **supplier**. A **supervisor** later **approves** or **rejects** it before it is sent downstream to the financial system. Two operational failure modes have been observed in production and must be prevented by design, not by convention:

1. **Duplicate requests** — the client retries the same "create" call after a timeout/network error and ends up creating two equivalent disbursements.
2. **Concurrent decisions** — two supervisors decide the same request at nearly the same instant, risking an inconsistent or non-auditable final state.

The tool must also let other sessions see status changes quickly (≤ ~10s, no full page reload) and must not slow down normal operation while fixing these issues.

### Actors

| Actor | Capabilities |
|---|---|
| **ANALYST** | Authenticate, list/search/filter/view requests, **create** requests. Cannot decide. |
| **SUPERVISOR** | Authenticate, list/search/filter/view requests, **approve/reject** pending requests. Cannot create (out of scope of RF; not prohibited by IAS but not required — see §10 assumption). |
| **System (financial downstream)** | Out of scope. The assessment stops at persisting an auditable decision; forwarding to the financial system is not implemented (explicitly not required by IAS §1–§4). |

### Main workflow

1. Analyst logs in → creates a disbursement request for a supplier (external reference, amount, currency, concept) → request persists as `PENDING`.
2. Supervisor logs in → sees the pending request in the list (their own session or a session where the analyst just created it) → opens detail → approves or rejects (reason mandatory on reject).
3. The decision is persisted atomically and is immutable afterward.
4. Any other open session (analyst or supervisor) sees the updated status within ~10 seconds without reloading.

### Major technical risks

| Risk | Why it matters | Mitigation strategy (see relevant section) |
|---|---|---|
| Ambiguous "duplicate" definition | IAS deliberately leaves this open (§5); wrong assumption breaks idempotency | Explicit documented assumption + DB-enforced uniqueness (§7) |
| Race condition on decisions | Two supervisors deciding simultaneously could corrupt state or silently double-decide | Transactional conditional `UPDATE ... WHERE status='PENDING'` (§8) |
| Floating-point money errors | `amount` must never lose precision | `NUMERIC` column, string-based transport, no float arithmetic (§5 domain model) |
| Frontend trusting client-declared role | Security requirement explicitly forbids this | Server-verified JWT role claim, authorization middleware (§10) |
| Untrusted `concept`/`reason` content | Stored XSS / persistence-layer injection | React's default escaping + parameterized queries via Drizzle + strict Zod validation (§11) |
| Scope creep beyond 2–3h budget | Assessment explicitly penalizes over-engineering | Deliberately minimal stack, no queues/microservices/CQRS, polling instead of SSE/WS (§14, §22) |

### Scope boundaries (explicitly out of scope)

- No real financial-system integration (only status persistence).
- No supplier CRUD UI (suppliers are seeded; see assumption in §5 Domain Model).
- No password reset, refresh tokens, or user self-registration.
- No horizontal scale testing, load testing, or real Kubernetes cluster deployment (manifests only, per IAS §9).
- No i18n; UI text in Spanish or English is a cosmetic choice, not graded.

---

## 2. Requirements Mapping

Traceability table. This table **is** the implementation checklist — status transitions to `DONE` only after verification (see Document Status rules above).

| Requirement | Technical solution | Verification | Status |
|---|---|---|---|
| RF1 — Registrar solicitud (supplier, externalReference, amount, currency, concept) | `POST /api/disbursement-requests`, Zod schema, Drizzle insert with unique constraint | Backend: `test/disbursementRequests.create.test.ts` (8 cases) + manual curl. Frontend: `NewRequestPage` (Phase 7) with client-side Zod validation, wired to the real endpoint, browser-verified end to end | DONE |
| RF2 — Listar con filtro por estado y búsqueda por proveedor/referencia, sin cargar todo el histórico | `GET /api/disbursement-requests?status=&search=&page=&pageSize=`, offset pagination, indexed columns | Backend: `test/disbursementRequests.list.test.ts` + manual curl. Frontend: `RequestsListPage` (Phase 7) — status filter, search, pagination, all URL-driven; browser-verified | DONE |
| RF3 — Consultar detalle | `GET /api/disbursement-requests/:id` | Backend: `test/disbursementRequests.detail.test.ts` + manual curl. Frontend: `RequestDetailPage` (Phase 7), browser-verified | DONE |
| RF4 — Aprobar/rechazar solicitud pendiente; inmutable tras decisión; razón obligatoria al rechazar | `POST /:id/approve`, `POST /:id/reject` with conditional `UPDATE ... WHERE status='PENDING'` inside a transaction; Zod requires `reason` on reject | Backend: `test/disbursementRequests.decide.test.ts` + manual curl. Frontend: `RequestDetailPage`'s `SUPERVISOR`-only approve/reject controls (Phase 7), browser-verified — decide twice was already covered by the backend's own 409 test/curl | DONE |
| RF5 — Reintentos de creación no deben duplicar | Unique DB constraint `(supplier_id, external_reference)` + idempotent `INSERT ... ON CONFLICT DO NOTHING` + re-fetch | Backend integration test: POST same payload twice → same `id`, `idempotentReplay:true` on the retry, direct `testDb` row-count query confirms exactly one row; manual curl walkthrough reproduces the same result against the dev DB | DONE |
| RF6 — Decisiones concurrentes consistentes y auditables | Transactional conditional `UPDATE` (row lock) + `decisions` table with `UNIQUE(request_id)` | `test/disbursementRequests.decide.test.ts` "Concurrent decisions": `Promise.all([approve, reject])` on the same request → exactly one `200` and one `409`, direct `testDb` query confirms exactly one row in `decisions` matching the actual winner, and a follow-up `GET` detail confirms the final persisted status matches | DONE |
| RF7 — Cambios de otra sesión visibles en ≤10s sin recarga completa | TanStack Query `refetchInterval: 5000` on list/detail queries | `test/polling.test.tsx` confirms `refetchInterval: 5000` is actually wired into the live query cache for both hooks. Real two-independent-browser-session test: session A approves a request; session B (already viewing it, never reloaded) picks up the change via polling alone in ~4.3s (detail) / ~4.75s (list) — both well under 10s, zero console errors | DONE |
| RF8 — Rutas explícitas listado/detalle; sincronización tras crear/decidir | React Router routes `/requests`, `/requests/:id`, `/requests/new`; `invalidateQueries` on mutation success | Routes + auth/role guards (Phase 6). Same-session sync via `invalidateQueries` on every mutation (Phase 7), browser-verified: create → appears in list, decide → detail and list both reflect the new status without a manual reload. Cross-*session* sync within ~10s (RF7 polling) is Phase 8 | DONE |
| §5 — Duplicate definition ambiguity documented | This TDD §7 (Open question / Assumption / Risk / Follow-up) | Re-read at delivery time (Phase 13) and cross-checked against the actual implementation (`disbursement-requests.routes.ts`'s `(supplierId, externalReference)` uniqueness) — accurate, no drift | DONE |
| §6 — Communication contract for main ops + RF7, justified vs. alternative | REST/JSON contract (§9) + polling justification vs SSE/WS (§14) | Re-read at delivery time (Phase 13): §14 matched the actual `queries.ts` implementation exactly (query keys, `refetchInterval: 5000`); §9's error-format example was found stale — didn't mention the optional `details` field added in Phase 4 — and was corrected on the spot | DONE |
| §7-SEC — Verifiable identity, ≥2 access capabilities, server-side authorization | JWT login (`POST /api/auth/login`), `requireAuth` + `requireRole` middleware, roles `ANALYST`/`SUPERVISOR` | `requireAuth`/`requireRole` unit-tested in `test/middleware.auth.test.ts`; login integration-tested end-to-end and via curl; `POST /api/disbursement-requests` (`ANALYST`-only) integration-tested and curl-verified: `SUPERVISOR` → real `403 FORBIDDEN`, unauthenticated → `401`. The `SUPERVISOR`-only decide endpoints (approve/reject) land in Phase 4 | DONE |
| §7-SEC — No frontend-only identity/permission trust | Role read exclusively from verified JWT claim server-side | Code review: `grep` for `req.body.role` / `req.headers['x-role']` / `req.query.role` in `apps/api/src` → no matches; `req.user` is populated only inside `requireAuth` from the verified JWT payload | DONE |
| §7-SEC — No secrets in code/logs/git history | `.env` + `.env.example`, `.gitignore`, secret pulled from env only | `git log -p \| grep -i "password\|secret"` → only placeholder/demo values, field/variable names, and doc prose; no real secret values or a committed `.env`; `.env.example` manually inspected — placeholders only | DONE |
| §7-SEC — Untrusted `concept`/`reason` cannot execute / alter UI | React text rendering (no `dangerouslySetInnerHTML`), Zod length/charset validation | `test/RequestDetailPage.test.tsx` renders a `<script>` tag stored in `concept` and asserts it appears as literal text with no injected `<script>` element and no code execution; code review confirms `dangerouslySetInnerHTML` is not used anywhere in `apps/web/src` | DONE |
| §7-SEC — Filters/search cannot alter persistence semantics | Drizzle parameterized queries only; no string-concatenated SQL | Code review (`disbursement-requests.routes.ts` uses `ilike`/`eq`/`and`/`or` from `drizzle-orm` exclusively, no raw `sql` string interpolation of user input) + automated test with `' OR 1=1 --` as the `search` param → `200` with a literal (empty) substring match, no syntax/server error | DONE |
| §7-SEC — Error responses don't leak stack traces/internals | Central error handler mapping to safe `{code,message,correlationId}`; full error logged server-side only | Automated tests (`test/errorHandler.test.ts`) + manual curl forcing a 500 (thrown error) and a 400 (malformed JSON body) → response bodies contain no stack trace/file paths; full error incl. stack logged server-side only | DONE |
| §8 — Structured logs (correlation id, op, result, status, duration), no auth material logged | `pino` + request-id middleware | Manual run (`npm run dev` + curls) and test-suite output inspected for log line shape (`reqId, method, path, userId, role, operation, result, statusCode, durationMs`); `grep -iE "password\|bearer\|authorization"` over captured log output → no matches | DONE |
| §8 — Health check distinguishing process-up vs. can-serve-traffic | `GET /healthz` (liveness) vs `GET /readyz` (readiness, checks DB) | `curl` both endpoints (200/200); `docker compose stop db` → `/readyz` returns 503 `{"status":"unavailable","db":"unreachable"}` while `/healthz` still returns 200; `docker compose start db` → `/readyz` returns 200 again once healthy | DONE |
| §8 — Additional signal beyond logs (metric/trace) | `GET /metrics` (Prometheus format via `prom-client`): request count, error count, duration histogram | `test/metrics.test.ts` (correct HELP/TYPE lines; hitting an endpoint 5× increments its counter by exactly 5; two different ids on the same route collapse to one `:id`-pattern label, confirming bounded cardinality) + manual curl: hit `/healthz` 5×, `curl /metrics` shows the counter incremented accordingly, histogram buckets populated | DONE |
| §8 — Probes wired to health checks, documented | k8s `livenessProbe`→`/healthz`, `readinessProbe`→`/readyz` | Manifest inspection (§17): `k8s/api-deployment.yaml` wires both exactly as designed, `kubeconform -strict` confirms structural validity (Phase 12) | DONE |
| §9 — Dockerfiles + simple local start incl. DB | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml` | `docker compose up -d --build` → all three services report healthy/running (db, api both have healthchecks; api's startup log shows migrate → idempotent seed → server start). Backend/frontend test suites (58 + 29) re-confirmed unaffected | DONE |
| §9 — K8s manifests: app, Service, config, secret ref, probes, resources | `k8s/*.yaml` (§17) | This environment has no reachable Kubernetes cluster, and `kubectl apply --dry-run=client` unexpectedly still requires live API-server discovery in the installed `kubectl` (v1.36.1) — confirmed by testing, not assumed. Validated instead with `kubeconform -strict` (offline, against real current K8s OpenAPI schemas, downloaded for this purpose): all 8 resources across all 8 files valid. Manually cross-checked selector/label, `configMapRef`/`secretRef` name, and port consistency across every file pair | DONE |
| §10 — Backend critical-behavior test (duplicate or concurrency) | Vitest + Supertest integration tests against the isolated `ias_disbursements_test` DB | `npm test` passes in `apps/api` (55/55) — both critical behaviors covered: RF5 idempotent create and RF6 concurrent decide | DONE |
| §10 — Frontend test (data fetching/mutation/authorization) | Vitest + React Testing Library + MSW | `npm test` passes in `apps/web` (29/29 across 9 files) — data fetching (loading/error/empty states), mutation (create/approve/reject success+failure), and authorization (role-gated routes and controls) all covered; both §18 Priority-1 and stretch-goal frontend tests present, incl. an explicit assertion that approving invalidates the requests-list cache | DONE |
| §11 — AI usage log | `docs/AI_USAGE_LOG.md` maintained during implementation (§19) | File exists and is populated at delivery time — 13 entries, one per phase | DONE |
| §13 — Delivery rules (README, env example, decisions record, no hidden failures) | README.md, `.env.example`, this TDD as decisions record | Manual checklist review (§21): all items done except commit history, which is explicitly flagged (not hidden) as the developer's own remaining action | DONE (with one flagged exception) |

---

## 3. Architecture

Minimal layered architecture — a single-page React app talking to a single Express REST API backed by one PostgreSQL database. No message broker, no cache layer, no service mesh: at this scale and time budget they would add operational surface without solving a real requirement.

```mermaid
flowchart TD
    Browser["React 18 SPA (Vite)"]
    API["Node.js / Express REST API"]
    ORM["Drizzle ORM"]
    DB[("PostgreSQL")]

    Browser -- "HTTPS/JSON, Bearer JWT" --> API
    API -- "SQL (parameterized)" --> ORM
    ORM --> DB

    subgraph "Trust boundary: Internet / Client"
      Browser
    end
    subgraph "Trust boundary: Backend (verifies identity + input)"
      API
      ORM
    end
    subgraph "Trust boundary: Data"
      DB
    end
```

### Component responsibilities

| Component | Responsibility | Does **not** do |
|---|---|---|
| **React SPA** | Routing, data fetching/caching (TanStack Query), forms + client-side validation (Zod, UX only), role-aware rendering | Never the source of truth for authorization; never trusted by the backend |
| **Express API** | Authentication (issues/verifies JWT), authorization (role checks), input validation (Zod, authoritative), business invariants (state machine, idempotency, concurrency control), logging, health/metrics | No business logic in the DB beyond constraints/indexes; no server-rendered HTML |
| **Drizzle ORM** | Type-safe, parameterized query building; migrations | No raw string-concatenated SQL anywhere in the codebase |
| **PostgreSQL** | Durable storage, uniqueness/foreign-key/check constraints as the last line of defense for invariants | No stored procedures/triggers in the assessment scope (deferred, §22) |

### Trust boundaries

- **Client → API**: the client is untrusted. Every identity claim (role) and every business-meaningful input (`amount`, `status` transitions, `decision`, `reason`, filters) is re-validated and re-authorized server-side, regardless of what the UI already checked.
- **API → DB**: the API is trusted to talk to the DB, but all values are still parameterized (never string-built SQL), and DB-level constraints (`UNIQUE`, `CHECK`, `FOREIGN KEY`) exist as defense-in-depth against a bug in the API layer.

---

## 4. Project Structure

```
apps/
  api/
    src/
      db/            # drizzle schema, migrations, seed
      modules/
        auth/
        suppliers/
        disbursement-requests/
      middleware/     # auth, error handler, request-id/logging
      lib/            # logger, metrics, env config
      app.ts
      server.ts
    test/
    Dockerfile
    drizzle.config.ts
  web/
    src/
      routes/          # /requests, /requests/new, /requests/:id, /login
      api/             # typed fetch client + TanStack Query hooks
      components/
      auth/            # auth context, role-aware guards
    test/
    Dockerfile
    vite.config.ts

docs/
  IAS_TECHNICAL_TEST.md   # immutable source of truth
  TDD.md                  # this document
  AI_USAGE_LOG.md          # created empty at start of implementation, filled as work proceeds
  DECISIONS.md             # optional ADR log if decisions outgrow this TDD (may stay merged into TDD)

k8s/
  api-deployment.yaml
  api-service.yaml
  web-deployment.yaml
  web-service.yaml
  postgres-deployment.yaml
  postgres-service.yaml
  configmap.yaml
  secret.example.yaml

docker-compose.yml
.env.example
README.md
```

No shared `packages/` workspace is introduced. `apps/api` and `apps/web` do not share runtime code (only, optionally, a hand-copied TypeScript type for the request shape — duplicated rather than abstracted, since a shared-package build pipeline is not worth the setup time for two small apps in a 2–3h assessment).

---

## 5. Domain Model

### Money representation

`amount` is stored as PostgreSQL `NUMERIC(14,2)` (fixed-point decimal), never `FLOAT`/`DOUBLE`. Drizzle maps `numeric` to a **string** in JS by default — this is intentional and preserved end-to-end (API request/response use strings, e.g. `"1234.50"`), so no IEEE-754 rounding error can ever enter the pipeline. The frontend only formats the string for display; it never performs arithmetic on it (no aggregation/summation is required by any RF). `currency` is a 3-character ISO 4217 code stored as `CHAR(3)`; no cross-currency math is required or implemented.

### Entities

#### Supplier (`suppliers`)

| Field | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `tax_id` | `varchar(32)` | `NOT NULL`, `UNIQUE` |
| `name` | `varchar(200)` | `NOT NULL` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` |

**Assumption:** suppliers are seeded via a migration/seed script (2–3 sample suppliers), not managed through a UI/CRUD endpoint. IAS's minimal model requires the entity to exist and be identifiable by `taxId`, but no functional requirement (RF1–RF8) asks for supplier creation. Building supplier CRUD would consume time budget without covering a graded requirement. `GET /api/suppliers` (simple list, no pagination needed at seed scale) is provided so the "new request" form can populate a supplier picker.

#### Disbursement Request (`disbursement_requests`)

| Field | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `external_reference` | `varchar(100)` | `NOT NULL` |
| `supplier_id` | `uuid` | `NOT NULL`, FK → `suppliers.id` |
| `amount` | `numeric(14,2)` | `NOT NULL`, `CHECK (amount > 0)` |
| `currency` | `char(3)` | `NOT NULL` |
| `concept` | `text` | `NOT NULL`, length-capped at app layer (e.g. 2000 chars) |
| `status` | `text` (enum-like, `CHECK` constrained) | `NOT NULL DEFAULT 'PENDING'`, one of `PENDING`, `APPROVED`, `REJECTED` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()`, bumped on decision |

Constraints/indexes:
- `UNIQUE (supplier_id, external_reference)` — the idempotency key (see §7).
- Index on `status` (list filter).
- Index on `supplier_id` (FK + filter/search).
- Index on `external_reference` (equality/prefix lookups; the idempotency `UNIQUE` constraint doubles as this index — see §12 for why a B-tree index here does not accelerate arbitrary `%term%` substring search).
- `CHECK (status IN ('PENDING','APPROVED','REJECTED'))`.
- `CHECK (amount > 0)`.

#### Decision (`decisions`)

| Field | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `request_id` | `uuid` | `NOT NULL`, `UNIQUE`, FK → `disbursement_requests.id` |
| `decision` | `text` | `NOT NULL`, `CHECK IN ('APPROVED','REJECTED')` |
| `reason` | `text` | nullable; `CHECK (decision <> 'REJECTED' OR (reason IS NOT NULL AND length(trim(reason)) > 0))` |
| `decided_by` | `uuid` | `NOT NULL`, FK → `users.id` |
| `decided_at` | `timestamptz` | `NOT NULL DEFAULT now()` |

`UNIQUE(request_id)` makes a request have **at most one** decision ever — a second decision attempt fails at the DB layer even if application logic had a bug, which is defense-in-depth for RF4/RF6 alongside the conditional `UPDATE` described in §8.

#### User / Identity (`users`)

| Field | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `username` | `varchar(50)` | `NOT NULL`, `UNIQUE` |
| `password_hash` | `varchar(100)` | `NOT NULL` (bcrypt hash) |
| `role` | `text` | `NOT NULL`, `CHECK IN ('ANALYST','SUPERVISOR')` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` |

Seeded via migration/seed script with at least one `ANALYST` and one `SUPERVISOR` account (documented in README, credentials not real secrets — local/demo only).

### Relationships

```mermaid
erDiagram
    SUPPLIERS ||--o{ DISBURSEMENT_REQUESTS : "has"
    DISBURSEMENT_REQUESTS ||--o| DECISIONS : "has at most one"
    USERS ||--o{ DECISIONS : "decides"

    SUPPLIERS {
      uuid id PK
      varchar tax_id UK
      varchar name
    }
    DISBURSEMENT_REQUESTS {
      uuid id PK
      varchar external_reference
      uuid supplier_id FK
      numeric amount
      char currency
      text concept
      text status
    }
    DECISIONS {
      uuid id PK
      uuid request_id FK "UK"
      text decision
      text reason
      uuid decided_by FK
    }
    USERS {
      uuid id PK
      varchar username UK
      text role
    }
```

### Business invariants (summary)

1. `amount > 0` (DB `CHECK`).
2. `status ∈ {PENDING, APPROVED, REJECTED}` (DB `CHECK`).
3. A request transitions `PENDING → APPROVED` or `PENDING → REJECTED` exactly once; never any other transition (enforced at API via conditional `UPDATE`, reinforced at DB via `decisions.request_id` uniqueness).
4. `reason` is mandatory when `decision = REJECTED` (DB `CHECK` + Zod).
5. `(supplier_id, external_reference)` is unique — the idempotency key for "same operation" (DB `UNIQUE`, see §7).

---

## 6. Disbursement State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: create (RF1)
    PENDING --> APPROVED: approve (RF4)
    PENDING --> REJECTED: reject (RF4, reason required)
    APPROVED --> [*]
    REJECTED --> [*]
```

**Allowed transitions:**
- `PENDING → APPROVED`
- `PENDING → REJECTED`

**Forbidden transitions (must be rejected by the API with `409 Conflict`):**
- `APPROVED → APPROVED` / `APPROVED → REJECTED` / `APPROVED → PENDING`
- `REJECTED → REJECTED` / `REJECTED → APPROVED` / `REJECTED → PENDING`

**Where enforced:**
- **Primary enforcement (API + DB, atomic):** the decide endpoints issue `UPDATE disbursement_requests SET status = $1, updated_at = now() WHERE id = $2 AND status = 'PENDING' RETURNING *` inside a transaction. If zero rows are returned, the request was not `PENDING` (already decided) and the API returns `409` — no other code path can move `status`.
- **Defense-in-depth (DB):** `decisions.request_id UNIQUE` — even a hypothetical bug that let two `UPDATE`s slip through cannot insert two decision rows for the same request.
- **UI (non-authoritative):** the frontend hides Approve/Reject controls once a request's `status !== 'PENDING'`, purely for UX; this has no bearing on correctness since the server is authoritative.

---

## 7. Duplicate / Idempotency Strategy

### Open business question

IAS §5 explicitly states that business has **not** formally defined which field combination identifies "the same operation." This is intentionally left open and must not be silently resolved by invented business rules.

### Assumption for this assessment

**Assumption:** the pair **`(supplierId, externalReference)`** identifies a unique business operation. `externalReference` is presumed to be a value the *upstream client system* generates once per real-world operation and resends unchanged on retry (a typical idempotency-key pattern); scoping it by `supplierId` avoids collisions if two different suppliers' systems happen to reuse the same reference string.

This is the smallest reasonable assumption that satisfies RF5 without inventing extra fields (`amount`/`currency`/`concept` are deliberately **not** part of the identity key — see Risk below).

### Enforcement

Database-enforced uniqueness, not check-then-insert:

```sql
ALTER TABLE disbursement_requests
  ADD CONSTRAINT uq_supplier_external_reference UNIQUE (supplier_id, external_reference);
```

API behavior on `POST /api/disbursement-requests`:

```sql
INSERT INTO disbursement_requests (...)
VALUES (...)
ON CONFLICT (supplier_id, external_reference) DO NOTHING
RETURNING *;
```

- If a row is returned → new request created → respond `201 Created`.
- If no row is returned → the row already existed → `SELECT` it by `(supplier_id, external_reference)` and respond `200 OK` with the **existing** resource (idempotent replay, not an error). The response body may include a flag such as `"idempotentReplay": true` so the client/UI can distinguish it if useful, without this being a hard IAS requirement.

### Retry behavior

If the client resends the identical create call after a timeout, the second call hits the same `ON CONFLICT` path: no new row is written, and the caller receives the same logical resource it originally intended to create. From the caller's perspective the operation is safe to retry any number of times.

### Race condition

Two concurrent `POST` requests carrying the same `(supplierId, externalReference)` are both handled by `INSERT ... ON CONFLICT DO NOTHING`. PostgreSQL evaluates the unique constraint at the index level atomically per statement: exactly one of the two concurrent inserts wins and physically writes the row; the other observes the conflict and performs no write. There is no window between a "check" and an "insert" because there is no separate check — the insert attempt **is** the check, enforced by the unique index itself. Both requests then converge on the same persisted row via the re-fetch.

### Risk

- If two genuinely different real-world operations happen to reuse the same `externalReference` for the same supplier (e.g., a careless upstream integration), the second one would be **silently treated as a duplicate and dropped**, which could hide a legitimate disbursement request. This is the main risk of the assumption.
- Conversely, if the same real operation is resent with a *different* `externalReference` (e.g., the upstream client generates a new reference per retry instead of reusing one), this design would **not** catch it as a duplicate, and two equivalent disbursements could be created.
- `amount`/`currency`/`concept` are not part of the identity key; a retry that also changes one of those fields (e.g., a corrected amount) would still be treated as the same operation and rejected as a duplicate under this assumption.

### Production follow-up

Before shipping to production, confirm with business/upstream integration owners: (1) whether `externalReference` is guaranteed to be stable and unique per real operation on the client side, (2) whether it should be a client-supplied idempotency key with an explicit TTL/expiry policy, and (3) whether amount/currency mismatches on a "duplicate" reference should be treated as an error instead of silently accepted as idempotent replay.

---

## 8. Concurrent Decision Strategy

This is the other critical invariant (RF6). Design goals: only one decision wins, the final status is consistent, the decision is auditable, the losing request gets a meaningful response, and there is no check-then-update race window.

### Mechanism

A single DB transaction per decide request:

```sql
BEGIN;

UPDATE disbursement_requests
SET status = $newStatus, updated_at = now()
WHERE id = $requestId AND status = 'PENDING'
RETURNING id, status;

-- if 0 rows returned: ROLLBACK, respond 409 with the request's current (already-decided) status

INSERT INTO decisions (request_id, decision, reason, decided_by, decided_at)
VALUES ($requestId, $newStatus, $reason, $decidedBy, now());

COMMIT;
```

### Why this is race-free

PostgreSQL's `UPDATE` takes a row-level lock on the target row as part of evaluating the `WHERE` clause. If two transactions attempt to `UPDATE` the same row concurrently:

1. The first transaction to reach the `UPDATE` acquires the row lock, finds `status = 'PENDING'` true, updates it, and (assuming it commits) releases the lock at `COMMIT`.
2. The second transaction's `UPDATE` blocks on the same row lock until the first transaction finishes. Once unblocked, PostgreSQL **re-evaluates the `WHERE` clause against the now-committed row** (standard read-committed behavior for `UPDATE`) — it sees `status` is no longer `'PENDING'` and therefore **matches zero rows**.

There is no separate "read status, then decide, then write" sequence in application code (which would be a classic check-then-act race); the conditional `WHERE status = 'PENDING'` **is** the check, and it is evaluated atomically by the database as part of the same statement that performs the write.

### Expected behavior for both competing requests

| Outcome | Response | Auditability |
|---|---|---|
| **Winner** (first to commit) | `200 OK` with the new status and the persisted decision | `decisions` row written with `decided_by`/`decided_at` |
| **Loser** (second to attempt) | `409 Conflict` with the request's current (already-decided) status and existing decision info (who decided it, when) — a meaningful, actionable response, not a generic error | No `decisions` row written for the loser; nothing silently lost — the loser can see who won and why |

### Transaction boundaries

The `UPDATE` + `INSERT INTO decisions` happen in **one** transaction so the request's status and its decision record are always consistent — it is never possible to observe a request as `APPROVED` with no corresponding `decisions` row, or vice versa. `decisions.request_id UNIQUE` additionally guarantees that even a future code change that mistakenly allowed a second `UPDATE` to slip through would still fail to insert a second decision (constraint violation → transaction rolled back), keeping the audit trail single-valued per request. The frontend never determines "who won" — it only reflects whatever the server returns.

---

## 9. API Contract

REST/JSON over HTTPS. All endpoints under `/api`. Auth via `Authorization: Bearer <JWT>` header (except `/api/auth/login` and health/metrics endpoints).

### Consistent error format

```json
{
  "error": {
    "code": "REQUEST_ALREADY_DECIDED",
    "message": "This request has already been decided.",
    "correlationId": "a1b2c3d4-...",
    "details": {
      "status": "APPROVED",
      "decision": { "id": "...", "decision": "APPROVED", "reason": null, "decidedBy": "...", "decidedAt": "..." }
    }
  }
}
```

No stack traces, SQL text, or internal file paths are ever included. `correlationId` matches the request-id used in server logs, so an operator can correlate a client-visible error with the full internal log entry without exposing internals to the client. `details` is an **optional** field, present only where §8's concurrent-decision design calls for it: the losing side of a concurrent decide call gets back who won and when, not just a generic conflict message (implemented in Phase 4 — see the `AppError`/`ConflictError` hierarchy in `apps/api/src/lib/errors.ts`). Every other error response omits `details` entirely.

### Endpoints

#### `POST /api/auth/login`
- **Authorization:** none (public)
- **Request:** `{ "username": string, "password": string }`
- **Response `200`:** `{ "token": string, "role": "ANALYST" | "SUPERVISOR", "username": string }`
- **Errors:** `401 INVALID_CREDENTIALS`

#### `GET /api/suppliers`
- **Authorization:** any authenticated user
- **Response `200`:** `[{ "id": uuid, "taxId": string, "name": string }, ...]`

#### `POST /api/disbursement-requests`
- **Authorization:** `ANALYST` only
- **Request:** `{ "supplierId": uuid, "externalReference": string, "amount": string, "currency": string, "concept": string }`
- **Response `201`** (new) or **`200`** (idempotent replay): the created/existing request resource
- **Errors:** `400 VALIDATION_ERROR`, `401`, `403`, `404 SUPPLIER_NOT_FOUND`

#### `GET /api/disbursement-requests`
- **Authorization:** any authenticated user
- **Query params:** `status?`, `search?` (matches `externalReference` or supplier `name`), `page?` (default 1), `pageSize?` (default 20, max 100)
- **Response `200`:** `{ "items": [...], "page": number, "pageSize": number, "total": number, "totalPages": number }`
- **Errors:** `400 VALIDATION_ERROR` (bad pagination params), `401`

#### `GET /api/disbursement-requests/:id`
- **Authorization:** any authenticated user
- **Response `200`:** request detail including decision (if any)
- **Errors:** `401`, `404 REQUEST_NOT_FOUND`

#### `POST /api/disbursement-requests/:id/approve`
- **Authorization:** `SUPERVISOR` only
- **Request:** `{}` (no body required)
- **Response `200`:** updated request + decision
- **Errors:** `401`, `403`, `404 REQUEST_NOT_FOUND`, `409 REQUEST_ALREADY_DECIDED`

#### `POST /api/disbursement-requests/:id/reject`
- **Authorization:** `SUPERVISOR` only
- **Request:** `{ "reason": string }` (required, non-empty)
- **Response `200`:** updated request + decision
- **Errors:** `400 VALIDATION_ERROR` (missing reason), `401`, `403`, `404 REQUEST_NOT_FOUND`, `409 REQUEST_ALREADY_DECIDED`

#### `GET /healthz`
- **Authorization:** none
- **Response `200`:** `{ "status": "ok" }` — process is up and responsive

#### `GET /readyz`
- **Authorization:** none
- **Response `200`/`503`:** `{ "status": "ok" | "unavailable", "db": "ok" | "unreachable" }`

#### `GET /metrics`
- **Authorization:** none (assumed network-restricted in production; acceptable open in this assessment — see §22)
- **Response `200`:** Prometheus text-format metrics

### Why REST/JSON (§6 communication requirement)

REST over HTTP/JSON is chosen as the contract for all principal operations (create/list/detail/decide) because the interactions are simple, synchronous request/response CRUD-shaped operations with no need for bidirectional streaming — a REST resource model (`/disbursement-requests`, `/disbursement-requests/:id`) maps directly onto the domain and is the fastest to implement, test, and explain within the time budget. The **one** operation that is not naturally request/response — propagating status changes to *other* sessions (RF7) — is deliberately handled by a different, simpler mechanism (client-side polling, not a second real-time channel) rather than adopting GraphQL subscriptions, gRPC streaming, or WebSockets for the whole API; see §14 for the explicit alternative comparison and justification.

---

## 10. Authentication and Authorization

### Mechanism

Username/password login (`POST /api/auth/login`) against the seeded `users` table (bcrypt-hashed passwords) issues a **JWT** (HS256, signed with a server-only secret from `JWT_SECRET` env var) containing `{ sub: userId, username, role, iat, exp }`. The frontend stores the token (memory + `sessionStorage` for reload survival) and sends it as `Authorization: Bearer <token>` on every subsequent request. This is the simplest mechanism that is genuinely *server-verifiable* (the signature proves the token, and therefore the role inside it, was issued by the backend) without depending on any external identity provider — satisfying "if your approach depends on an external service, you may substitute a local/controlled alternative" from IAS §7.

### Capabilities

| Role | Read (list/detail) | Create | Approve/Reject |
|---|---|---|---|
| `ANALYST` | ✅ | ✅ | ❌ |
| `SUPERVISOR` | ✅ | ❌ | ✅ |

This satisfies IAS §7's requirement to differentiate "consulta/registro" from "decisión de aprobación o rechazo" as at least two distinct access capabilities.

**Assumption:** `SUPERVISOR` cannot create requests and `ANALYST` cannot decide them — a strict segregation of duties. IAS's text only requires the two capabilities to be *distinguishable*, not necessarily mutually exclusive per role; strict segregation is the smallest, most defensible interpretation and mirrors the real-world control described in §2 (an analyst registers, a *different* role decides).

### How identity is established

1. Client sends credentials once, over HTTPS, to `/api/auth/login`.
2. Server verifies the bcrypt hash, issues a signed JWT with a short expiry (e.g. 8h, configurable via env).
3. Every protected request carries that JWT. `requireAuth` middleware verifies the signature and expiry using `JWT_SECRET` (never accepts an unsigned or client-asserted role) and attaches `{ userId, role }` to `req.user`.
4. `requireRole('SUPERVISOR')` (etc.) middleware checks `req.user.role` — sourced **only** from the verified token, never from the request body, query string, or any client-supplied header.

### Where roles come from

Exclusively from the `role` column in the `users` table, embedded into the JWT at login time by the server, and read back out of the verified JWT on every request. The role is never re-derived from anything the client sends per-request.

### Why the client cannot grant itself SUPERVISOR

The JWT is signed with `JWT_SECRET`, which never leaves the server (env var, not committed, not sent to the client). A client can freely *read* its own decoded token (JWTs are not encrypted) but cannot *forge* a token with a different `role` claim, because it cannot produce a valid signature without the secret — `requireAuth` rejects any token whose signature does not verify. There is no code path anywhere in the API that trusts a role value the client asserts outside the verified token.

### Authorization flow

```
Request → requireAuth (verify JWT signature/expiry, attach req.user)
        → requireRole([...]) (check req.user.role against allowed roles for this route)
        → Zod input validation
        → handler (business logic)
```

### 401 vs 403

- **`401 Unauthorized`** — missing, malformed, expired, or invalid-signature token (identity could not be established at all).
- **`403 Forbidden`** — identity established (valid token) but the role does not permit this operation (e.g., `ANALYST` calling `/approve`).

### Limitations of the assessment implementation

- No refresh-token rotation, logout/blacklist, or password reset flow.
- JWT secret is a single static env var (no rotation/KMS).
- Seeded users only; no self-service registration or admin UI.
- Token stored in `sessionStorage`, which is acceptable for a local assessment but not XSS-hardened the way an httpOnly cookie would be (see production note).

### What would change in production

Use httpOnly, `SameSite=strict` cookies (or a proper OAuth2/OIDC provider) instead of `sessionStorage`-held JWTs to reduce XSS exposure; add refresh tokens with rotation and revocation; source users/roles from a real identity provider or admin-managed user store; add rate limiting on `/auth/login`; rotate signing secrets via a secrets manager.

---

## 11. Input Validation and Security

All request bodies/query params are validated server-side with **Zod** schemas — this is the authoritative validation layer; any client-side Zod validation in the React app is UX-only and never trusted.

| Field | Validation |
|---|---|
| `externalReference` | required, string, 1–100 chars, trimmed |
| `supplierId` | required, valid UUID, must reference an existing supplier (404 if not) |
| `amount` | required, string matching a decimal pattern (`^\d{1,12}(\.\d{1,2})?$`), parsed server-side, must be `> 0` |
| `currency` | required, exactly 3 uppercase letters (`^[A-Z]{3}$`) |
| `concept` | required, string, 1–2000 chars; treated as opaque text, never interpreted/executed |
| `decision` (implicit via route) | fixed by endpoint (`approve`/`reject`), not client-supplied as free text |
| `reason` | required **only** on reject, 1–1000 chars when present |
| `page` | optional int, ≥ 1, default 1 |
| `pageSize` | optional int, 1–100, default 20 |
| `status` filter | optional, one of `PENDING`/`APPROVED`/`REJECTED` |
| `search` | optional string, 1–200 chars, used only as a parameterized `ILIKE` pattern operand, never concatenated into SQL |

### Untrusted `concept`/`reason` (stored XSS)

React escapes all text content by default when rendered via JSX expressions (`{value}`); the codebase does not use `dangerouslySetInnerHTML` anywhere, so even if `concept`/`reason` contain `<script>` or HTML markup, it renders as inert literal text in the browser, never as executable markup. No server-side HTML sanitization library is needed because the content is never rendered as HTML on the server or the client — this keeps the solution minimal per the "avoid unnecessary security infrastructure" guidance while still fully addressing the requirement.

### SQL injection / ORM parameterization

All queries go through Drizzle's query builder, which parameterizes every value (including `search`/filter inputs) — there is no string concatenation of user input into SQL anywhere in the codebase. This is verified by code review (no raw `sql` template literals with interpolated user input) and by a manual test sending SQL-meta-characters (`' OR 1=1 --`) in the `search` param and confirming it is treated as a literal substring to match, not as SQL syntax.

### Malformed input

Any Zod validation failure short-circuits the handler and returns `400 VALIDATION_ERROR` with a field-level message list — never reaches the DB layer.

### Error sanitization

A single Express error-handling middleware catches all thrown/rejected errors. Known domain errors (validation, not-found, conflict, auth) map to their specific HTTP status and a safe `{code, message}`. Any unexpected error is logged in full (stack trace, correlation id) server-side via `pino`, and the client only ever receives a generic `500 INTERNAL_ERROR` with the correlation id — never the stack trace or DB error text.

### Secrets

`JWT_SECRET`, `DATABASE_URL` (with credentials), and any other secret live only in environment variables, sourced from a git-ignored `.env` locally and from Kubernetes `Secret`/Docker Compose env in deployment. `.env.example` documents the required variable names with placeholder (non-real) values. `.gitignore` excludes `.env`. No secret is ever logged.

### Logs

Request logs include correlation id, method, path, status, duration, and `userId`/`role` when authenticated — never the `Authorization` header value, password, or token contents (explicitly redacted in the logger's serializer config).

---

## 12. List, Search and Pagination

- **Pagination strategy:** offset/limit (`page`, `pageSize` query params) via Drizzle's `.limit()`/`.offset()`. Chosen over cursor-based pagination because the assessment's data volume is small and offset pagination is simpler to implement and explain within the time budget; cursor pagination is noted as a production follow-up if the historical dataset grows large enough that `OFFSET` scan cost becomes material (§22).
- **Default page size:** 20.
- **Maximum page size:** 100 (server clamps/rejects anything above this — prevents a client from requesting the "whole history" in one call, directly addressing RF2's "sin cargar innecesariamente todo el histórico").
- **Status filter:** exact match on the indexed `status` column.
- **Supplier/reference search:** case-insensitive `ILIKE '%term%'` against `external_reference` and a join to `suppliers.name`. A standard B-tree index (including the unique index backing the idempotency constraint) accelerates equality lookups and prefix matches (`ILIKE 'term%'`) efficiently, but it does **not** meaningfully accelerate an arbitrary-substring pattern like `%term%` — that pattern still requires scanning the candidate rows regardless of the B-tree. This is an explicit, accepted trade-off: at the assessment's expected data volume (a handful to a few hundred seeded/demo rows) an unindexed scan for `ILIKE '%term%'` is fast enough that no specialized indexing is required. For a production dataset large enough that this scan becomes a bottleneck, `pg_trgm` with a `GIN` (or `GiST`) trigram index on `external_reference`/`concept` would be the appropriate optimization — this is **not implemented** in the assessment, deliberately, to avoid unnecessary infrastructure at this scale (§22).
- **Indexes supporting these queries:** `status` (equality filter), `supplier_id` (join + equality filter), `external_reference` (equality lookups and the idempotency `UNIQUE` constraint — a B-tree, useful for exact/prefix matching, not a substring-search accelerator), `suppliers.name` searched via join (no extra index needed at seed scale). None of these indexes is presented as optimizing the arbitrary `%term%` `ILIKE` pattern used by the search feature; that pattern is knowingly accepted as an unindexed scan at this scale.
- **Total count:** a second `COUNT(*)` query with the same filters (simpler than a window-function combined query; acceptable cost at this scale) to populate `total`/`totalPages`.

---

## 13. Frontend Architecture

### Routes

| Route | Responsibility |
|---|---|
| `/login` | Credential form → calls `/api/auth/login`, stores token + role |
| `/requests` | List view: status filter, search box, pagination controls; "New request" button visible only for `ANALYST` |
| `/requests/new` | Create form (`ANALYST` only; route-guarded, also enforced server-side) |
| `/requests/:id` | Detail view: full request data, decision info if present, Approve/Reject actions visible only for `SUPERVISOR` on `PENDING` requests |

### Data fetching

TanStack Query hooks wrap a small typed `fetch` client (`Authorization` header injected centrally, 401 triggers redirect to `/login`):

- `useRequestsQuery({ status, search, page, pageSize })` → `GET /api/disbursement-requests`, `refetchInterval: 5000` (RF7), keyed by all filter params so each filter combination caches independently.
- `useRequestQuery(id)` → `GET /api/disbursement-requests/:id`, `refetchInterval: 5000`.
- `useSuppliersQuery()` → `GET /api/suppliers`, static-ish data, long `staleTime`.

### Mutations

- `useCreateRequestMutation()` → `POST /api/disbursement-requests`; on success, `invalidateQueries(['requests'])` and navigate to `/requests/:id`.
- `useApproveMutation(id)` / `useRejectMutation(id)` → on success, `invalidateQueries(['requests'])` **and** `invalidateQueries(['requests', id])` so both the list and the currently-open detail reflect the decision immediately, without waiting for the next poll tick.

### Loading / error / empty states

- **Loading:** skeleton/spinner while `isLoading`.
- **Error:** inline error panel showing the server's safe `error.message` (never a raw exception) with a retry action.
- **Empty:** explicit "no requests match these filters" message on `/requests` when `items.length === 0`.

### Authorization-aware UI

The "New request" button, `/requests/new` route, and Approve/Reject controls are conditionally rendered based on the role decoded from the current JWT (or held in an auth context populated at login). This is **UX only** — every one of these actions is independently re-authorized server-side (§10), so a manipulated client cannot actually perform an action its role disallows even if the UI were bypassed.

---

## 14. Cross-session Synchronization

RF7 requires: changes from another session visible within ~10s, without a full page reload.

| Approach | Pros | Cons |
|---|---|---|
| **Polling** (TanStack Query `refetchInterval`) | Trivial to implement and explain; works through any proxy/load balancer with zero extra infra; stateless (no server-side connection tracking); naturally resilient to reconnects | Slight latency (bounded by interval), some redundant requests at low data-change rates |
| **Server-Sent Events (SSE)** | Push-based, lower latency, simple one-way protocol over plain HTTP | Requires the server to hold open connections per client (needs to be considered under multi-pod k8s scaling / load balancer idle-timeout tuning); more moving parts to build and explain in the time budget |
| **WebSockets** | Full duplex, lowest latency | Most infrastructure/complexity for a requirement that only needs one-way, ~10-second-granularity updates; connection/session affinity concerns under k8s horizontal scaling; clear over-engineering for this scope |

**Selected: polling**, via TanStack Query's `refetchInterval: 5000` (5 seconds) on the list and detail queries, plus `refetchOnWindowFocus: true`.

### Why it satisfies RF7

A 5-second interval guarantees any change is observed within, at most, one interval (~5s, comfortably under the ~10s requirement) plus network latency — well within IAS's "approximately 10 seconds" tolerance.

### Cache synchronization

The list query (`['requests', filters]`) and the detail query (`['requests', id]`) are independent cache entries; both poll independently, and mutations additionally call `invalidateQueries` on both keys immediately on success so the *acting* session updates instantly (not waiting for its own next poll tick) while *other* sessions catch up on their next poll.

### Trade-offs accepted

A modest number of redundant `GET` requests when nothing has changed — acceptable at this scale and explicitly preferred over the added infrastructure of SSE/WebSockets, per the assessment's "avoid overengineering" guidance.

### Production follow-up

At larger scale/user counts, SSE would be the natural next step (one-way push fits this use case exactly — the client never needs to send anything over the channel), backed by a lightweight pub/sub (e.g., Postgres `LISTEN/NOTIFY` for a single-instance deployment, or a message broker only if the deployment becomes genuinely multi-instance with fan-out needs) — but this is explicitly deferred as it is not required to satisfy RF7 within the stated ~10s tolerance.

---

## 15. Observability

### Structured logging

`pino` (fast, JSON-structured, low overhead). A request-id middleware generates a UUID per incoming request (or reuses an inbound `X-Request-Id` if present), attaches it to `req`, and echoes it in the response header and in every log line for that request. Log fields per request:

```json
{
  "reqId": "uuid",
  "method": "POST",
  "path": "/api/disbursement-requests/:id/approve",
  "userId": "uuid | null",
  "role": "SUPERVISOR | null",
  "operation": "approveDisbursementRequest",
  "result": "success | conflict | error",
  "statusCode": 200,
  "durationMs": 12
}
```

Never logged: `Authorization` header value, passwords, JWT contents, raw request bodies containing `concept`/`reason` in full (logged truncated/omitted if deemed unnecessary detail — only IDs and outcome are needed to diagnose an operation, per IAS §8's "sin registrar ... datos sensibles innecesarios").

### Liveness (`/healthz`)

Proves: the Node.js process is up and its event loop is responsive enough to answer an HTTP request. Does **not** check the database. A hung/deadlocked process fails this, causing Kubernetes to restart the pod.

### Readiness (`/readyz`)

Proves: the process is not only alive but currently able to serve real traffic — specifically, it can reach PostgreSQL (`SELECT 1`). If the DB is unreachable, this returns `503`, and Kubernetes removes the pod from the Service's load-balanced endpoints until it recovers, without restarting the pod (since the process itself is fine — only its dependency is down).

### Additional signal

A `/metrics` endpoint via `prom-client`, exposing:

- `http_requests_total{method, route, status}` (Counter) — request volume and error rate (`status >= 500`) can be derived.
- `http_request_duration_seconds{method, route}` (Histogram) — latency distribution, useful to detect slow endpoints.

Chosen over distributed tracing because a single-process, single-database backend has no cross-service span to trace — a metrics endpoint is the simplest signal that is genuinely explainable and testable ("hit the endpoint 5 times, curl `/metrics`, see the counter at 5") within the time budget, directly satisfying IAS §8's "puede ser simple, pero debe poder explicarse y probarse."

### Probe mapping (documented, wired in §17)

| K8s probe | Endpoint | Failure meaning | K8s action |
|---|---|---|---|
| `livenessProbe` | `GET /healthz` | Process hung/unresponsive | Restart the pod |
| `readinessProbe` | `GET /readyz` | DB unreachable (dependency down, process otherwise fine) | Remove pod from Service endpoints (no restart) until it passes again |

---

## 16. Docker

### Backend Dockerfile (`apps/api/Dockerfile`)

Multi-stage: `builder` stage (`node:20-alpine`) installs all deps and runs `tsc`; `runtime` stage (`node:20-alpine`) copies only `dist/` + production `node_modules` (or uses `npm ci --omit=dev`), runs as a non-root user, `CMD` runs a startup script that applies pending Drizzle migrations then starts the server (`node dist/server.js`).

### Frontend Dockerfile (`apps/web/Dockerfile`)

Multi-stage: `builder` stage runs `vite build`; `runtime` stage is a minimal `nginx:alpine` serving the static `dist/` output, with an `nginx.conf` that proxies `/api/*` to the `api` service (avoids CORS entirely in both Compose and k8s, and matches the deployed topology in both environments).

### PostgreSQL

Official `postgres:16-alpine` image, a named volume for data persistence, `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` from Compose env, a `pg_isready`-based healthcheck.

### `docker-compose.yml` (services)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD]
    volumes: [db-data:/var/lib/postgresql/data]
    healthcheck: pg_isready
  api:
    build: ./apps/api
    environment: [DATABASE_URL, JWT_SECRET, PORT, NODE_ENV, LOG_LEVEL]
    depends_on: { db: { condition: service_healthy } }
    ports: ["3000:3000"]
  web:
    build: ./apps/web
    depends_on: [api]
    ports: ["5173:80"]
```

### Migrations/startup strategy

The `api` container's entrypoint runs `drizzle-kit migrate` (or an equivalent programmatic migration runner) against `DATABASE_URL` **before** starting the HTTP server, so a fresh `docker compose up` always ends with an up-to-date schema with zero manual steps. The seed script (users + sample suppliers) runs as part of the same startup step in this assessment context (idempotent — safe to run on every start, e.g. `INSERT ... ON CONFLICT DO NOTHING`).

### Environment variables

Documented in `.env.example`: `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, frontend `VITE_API_URL` (only if not using the nginx same-origin proxy).

### Health checks

`api` service has a Compose `healthcheck` hitting `/readyz`, so `web`'s effective availability can be reasoned about (though `web` itself has no backend dependency at container-start time beyond the nginx proxy target being reachable at request time).

### Evaluator experience

`cp .env.example .env && docker compose up --build` → three healthy containers, app reachable at `http://localhost:5173`, API at `http://localhost:3000` — documented verbatim in README.

---

## 17. Kubernetes

Minimum artifacts per IAS §9 ("la aplicación, Service, configuración externa, referencia segura a secretos, probes y recursos de ejecución razonables"). No Helm, no operators, no autoscaling — plain manifests only.

| File | Contents |
|---|---|
| `k8s/configmap.yaml` | Non-secret env: `NODE_ENV`, `PORT`, `LOG_LEVEL` |
| `k8s/secret.example.yaml` | Placeholder `Secret` manifest (fake values) documenting the required keys: `DATABASE_URL`, `JWT_SECRET`, `POSTGRES_PASSWORD` — real values never committed |
| `k8s/postgres-deployment.yaml` + `k8s/postgres-service.yaml` | Single-replica Postgres for demo/coherence (not required to be production-grade; IAS explicitly does not require a real cluster deployment) |
| `k8s/api-deployment.yaml` | `Deployment` for the API: image, `envFrom` (ConfigMap + Secret), `livenessProbe` → `GET /healthz`, `readinessProbe` → `GET /readyz`, resource `requests`/`limits` (e.g. `requests: 100m/256Mi`, `limits: 250m/512Mi`) |
| `k8s/api-service.yaml` | `ClusterIP` `Service` exposing the API Deployment on port 3000 |
| `k8s/web-deployment.yaml` | `Deployment` for the nginx-served frontend; resource requests/limits |
| `k8s/web-service.yaml` | `Service` exposing the frontend |

### Secret reference (example shape, no real values)

```yaml
apiVersion: v1
kind: Secret
metadata: { name: ias-api-secrets }
type: Opaque
stringData:
  DATABASE_URL: "postgres://USER:PASSWORD@postgres:5432/DBNAME"
  JWT_SECRET: "replace-with-a-real-secret"
```

Consumed via `envFrom.secretRef` in `api-deployment.yaml` — never inlined as plain `env` values in the Deployment spec.

### Probe → health endpoint mapping (restated for this section)

- `livenessProbe.httpGet.path: /healthz` — restarts the pod if the process itself is stuck.
- `readinessProbe.httpGet.path: /readyz` — pulls the pod out of Service rotation if the DB dependency is unavailable, without killing the process.

### Scope explicitly excluded

No Helm charts, no Ingress/TLS termination, no HorizontalPodAutoscaler, no NetworkPolicy — none are required by IAS §9, and adding them would be scope creep against the "avoid overengineering" guidance. `kubectl apply --dry-run=client -f k8s/` is the verification bar (manifest correctness), not an actual cluster deployment.

---

## 18. Testing Strategy

Risk-based, not coverage-quantity-based, per IAS §10 ("no se exige un porcentaje fijo de cobertura"). Priority order follows the assessment's own emphasis on duplicate/idempotency and concurrency as the two named critical backend behaviors.

### Backend (Vitest + Supertest, against a real Postgres test database — a second database/schema in the same `db` container, migrated before the test run, so that `UNIQUE`/`CHECK` constraints and the conditional `UPDATE` locking behavior are exercised for real, not mocked)

**Priority 1 — Duplicate/idempotent creation:**
`POST /api/disbursement-requests` twice with an identical `(supplierId, externalReference)` payload → assert both responses return the same `id`, and a direct DB count confirms exactly one row exists.

**Priority 2 — Concurrent decisions:**
Create one `PENDING` request, then fire two decide calls concurrently (`Promise.all([approveCall, rejectCall])` or two `approve` calls) → assert exactly one response is `200` and the other is `409`, the request's final `status` matches the winner, and exactly one row exists in `decisions`.

**If time permits (stretch):** a test for the reject-without-reason validation error (`400`), and a test for `403` when `ANALYST` calls `/approve`.

### Frontend (Vitest + React Testing Library + MSW for API mocking)

**Priority 1 — Data fetching / loading / error states:**
Render `/requests` with MSW returning a delayed/successful response → assert loading state renders, then the list renders; with MSW returning a `500` → assert the error state renders (not a crash).

**If time permits (stretch) — Authorization-aware UI:**
Render `/requests/:id` for a `PENDING` request as `ANALYST` → assert Approve/Reject buttons are **not** present; render the same as `SUPERVISOR` → assert they **are** present and clicking Approve triggers the mutation call and subsequent list invalidation (mocked).

### Explicitly not pursued

End-to-end browser tests (Playwright/Cypress) — valuable in production but not worth the setup time against the 2–3h budget when the two named critical behaviors are already covered by fast, real-DB integration tests at the API layer.

---

## 19. AI Usage Documentation

`docs/AI_USAGE_LOG.md` is created as an **empty template** at the start of implementation and appended to as work proceeds — **no entries are fabricated now**; this section only defines the structure/process to follow.

### Required structure per entry

```markdown
### <date> — <short title>

- **Tool:** e.g. Claude Code / GitHub Copilot / ChatGPT
- **Objective:** what the AI was asked to help with
- **Accepted output:** example of a suggestion accepted as-is, and why
- **Corrected output:** example of a suggestion that required a fix, what was wrong, and what was changed
- **Rejected output (if applicable):** example of a suggestion discarded, and why
- **Verification performed:** how correctness/security was checked (test run, manual review, etc.)
- **Sensitive-information safeguard:** confirmation that no real secrets/credentials/production data were shared with the tool during the interaction
```

### Process during implementation

Each implementation phase (§20) that involved AI assistance gets at least one log entry before moving to the next phase, so the log reflects real, traceable decisions rather than a single end-of-project summary. If a phase used no AI assistance, that is optionally noted with a one-line justification, per IAS §11 ("si decides no usar IA en alguna parte, puedes justificarlo").

---

## 20. Implementation Phases

Ordered for critical-path speed: the two invariant-bearing mechanisms (idempotency, concurrency) are built and tested first, ahead of the mandatory-but-non-critical-path items (the `/metrics` signal required by IAS §8, Kubernetes manifests) and ahead of genuinely optional polish (the frontend stretch test, documentation consolidation). Each phase lists a concrete verification step so "done" is never just "code was written."

| # | Phase | Files/components | Requirements covered | Verification | Status |
|---|---|---|---|---|---|
| 1 | Scaffold + Docker Compose skeleton | `apps/api`, `apps/web` skeletons, `docker-compose.yml`, Drizzle schema + migration, seed script (users, suppliers) | Foundation for all | `docker compose up` → `db` healthy, schema applied | DONE |
| 2 | Backend core: auth, error handling, logging, health | `middleware/auth.ts`, `middleware/errorHandler.ts`, `lib/logger.ts`, `/healthz`, `/readyz` | §7-SEC (auth), §8 (logs, health) | `curl /healthz`, `curl /readyz`, login via curl returns JWT | DONE |
| 3 | Backend domain: create (idempotent), list/filter/search/pagination, detail | `modules/disbursement-requests/*`, `modules/suppliers/*` | RF1, RF2, RF3, RF5, §11, §12 | Manual curl walkthrough; duplicate-create returns same id | DONE |
| 4 | Backend domain: approve/reject with conditional update | `modules/disbursement-requests/decide.ts` | RF4, RF6, §5/§7 (state machine) | Manual curl: decide twice → second is 409 | DONE |
| 5 | Backend tests: duplicate + concurrency | `apps/api/test/*.test.ts` | §10 (backend critical test) | `npm test` green | DONE (built alongside Phases 3–4 rather than as a separate pass — Priority 1/2 and both §18 stretch tests confirmed present; re-verified fresh: `npm test` 55/55 green, concurrency test re-run 5× in isolation with zero flakiness, dev DB confirmed untouched) |
| 6 | Frontend scaffold: routing, API client, auth context | `routes/*`, `api/client.ts`, `auth/*` | RF8, §7-SEC (client-side role gating, UX only) | Manual login → redirected to `/requests` | DONE — verified in a real headless-browser session against the live backend (login, logout, ANALYST-only route redirect), not just unit tests |
| 7 | Frontend: list/detail/new pages with TanStack Query | `routes/requests/*` | RF1–RF4, RF8, §13 | Manual UI walkthrough: create → appears in list → decide → detail updates | DONE — 26 RTL/MSW tests + a real headless-browser session running this exact walkthrough against the live backend, zero console errors |
| 8 | Frontend: polling sync + cache invalidation | query config (`refetchInterval`), mutation `onSuccess` handlers | RF7 | Two-tab manual test: decide in tab A, tab B updates within ~10s | DONE — real two-browser-session test, ~4.3–4.75s update time, no reload |
| 9 | Frontend test | `apps/web/test/*.test.tsx` | §10 (frontend test) | `npm test` green | DONE — largely already satisfied by Phases 6–8; one targeted gap closed (list-cache invalidation on approve) |
| 10 | Observability: metrics endpoint (mandatory — IAS §8 requires at least one additional signal beyond logs) | `lib/metrics.ts`, `/metrics` | §8 (additional signal) | `curl /metrics` shows counters after a few requests | DONE |
| 11 | Dockerfiles (api, web) finalized + compose verified end-to-end | `apps/api/Dockerfile`, `apps/web/Dockerfile` | §9 | `docker compose up --build` → full app reachable | DONE — real headless-browser session against the dockerized stack (nginx-served build + proxied api + Postgres), zero console errors |
| 12 | Kubernetes manifests | `k8s/*.yaml` | §9, §8 (probe wiring) | `kubectl apply --dry-run=client -f k8s/` succeeds | DONE — validated with `kubeconform -strict` instead (see §2 row above for why); all 8 resources valid |
| 13 | README, `.env.example`, decisions consolidation, AI log finalize, DoD pass | `README.md`, `.env.example`, `docs/AI_USAGE_LOG.md`, this TDD's §21 | §13 (delivery rules) | Manual checklist walkthrough (§21) | DONE — full §21 walkthrough complete; one flagged exception (commit history, see §21) |

**No fixed per-phase or total time estimate is stated here.** Implementation is prioritized around the assessment's intended 2–3 hour scope: phases 1–8 (scaffold, schema, auth, idempotent create, concurrency-safe decide, backend critical tests, core frontend flow, polling sync) cover every functional requirement and both named critical invariants (duplicate protection, concurrent-decision consistency), and are implemented first and verified before anything else. Phases 9–13 cover the remaining mandatory items that are not on that critical path — the frontend test (§10), the `/metrics` signal (§8, mandatory per IAS's "at least one additional signal"), Docker/Kubernetes finalization (§9), and delivery documentation (§13) — plus genuinely optional polish (the frontend stretch test beyond the one required test, extra Kubernetes manifest fidelity, a separate ADR file). All of phases 9–13 are performed only once the mandatory baseline from phases 1–8 is complete and independently verified (build passes, tests pass, manual checks succeed) — never in parallel with it and never at the cost of rushing or skipping a mandatory item. This ordering intentionally avoids overengineering: nothing here is scope creep, and nothing mandatory is treated as optional.

### If time is short, cut in this order (never cut RF1–RF8, the two critical invariant tests, or `/metrics` — IAS §8 explicitly requires at least one additional observability signal beyond logs, so `/metrics` is mandatory, not optional polish)

1. Frontend stretch test (keep only the Priority 1 data-fetching test).
2. Postgres Kubernetes manifest fidelity (a minimal single-replica version is enough; do not spend extra time hardening it).
3. Separate `docs/DECISIONS.md` — merge decision records into this TDD instead of a separate ADR file.

---

## 21. Definition of Done

Derived directly from IAS_TECHNICAL_TEST.md §1–§14.

**Functional (RF1–RF8)**
- [x] Create disbursement request (supplier, externalReference, amount, currency, concept) — full stack, browser-verified
- [x] List requests with status filter — full stack, browser-verified
- [x] Search by supplier or reference — full stack, browser-verified
- [x] Pagination (no full-history load) — full stack, browser-verified
- [x] View request detail — full stack, browser-verified
- [x] Approve a pending request — full stack, browser-verified
- [x] Reject a pending request with mandatory reason — full stack, browser-verified
- [x] Already-decided request cannot be re-decided (409)
- [x] Duplicate create (same supplierId+externalReference) does not create a second row
- [x] Concurrent decide calls resolve to exactly one winner, consistently and auditably
- [x] Status changes from another session appear within ~10s without full reload — real two-session browser test, ~4.3–4.75s, no reload
- [x] Explicit frontend routes for list/detail/new; UI stays in sync with backend after create/decide — same-session sync via `invalidateQueries` (Phase 7) and cross-session sync via 5s polling (Phase 8), both browser-verified

**Security (§7)**
- [x] Verifiable server-issued identity (JWT), not client-asserted
- [x] At least two distinct access capabilities enforced server-side (ANALYST vs SUPERVISOR) — `POST /api/disbursement-requests` is `ANALYST`-only (`requireRole`); a `SUPERVISOR` calling it gets a real, tested `403 FORBIDDEN`
- [x] No secrets/credentials in code, logs, or git history
- [x] `concept`/`reason` cannot execute or alter UI behavior (no stored XSS) — backend stores it as opaque text (tested); frontend renders it via plain JSX text interpolation only, tested with a literal `<script>` tag, `dangerouslySetInnerHTML` confirmed absent from `apps/web/src`
- [x] Filters/search cannot alter persistence-layer semantics (no injection)
- [x] Error responses never leak stack traces/internal details

**Observability (§8)**
- [x] Structured logs with correlation id, operation, result, status, duration
- [x] No auth material/sensitive data in logs
- [x] Liveness endpoint (`/healthz`)
- [x] Readiness endpoint (`/readyz`, checks DB)
- [x] At least one additional signal beyond logs (`/metrics`)
- [x] Health checks wired to Kubernetes probes, documented — `k8s/api-deployment.yaml`: `livenessProbe`→`/healthz`, `readinessProbe`→`/readyz`

**Docker & Kubernetes (§9)**
- [x] Dockerfile(s) for backend and frontend
- [x] `docker-compose.yml` starting app + DB reproducibly — verified with `docker compose up -d --build`; commands not yet written up in the README (Phase 13)
- [x] Kubernetes manifests: Deployment(s), Service(s), ConfigMap, Secret reference/example, probes, resource requests/limits

**Testing (§10)**
- [x] Backend test covering a critical behavior (duplicate/idempotency **and** concurrency, both prioritized here)
- [x] Frontend test covering data fetching/mutation/authorization behavior — 29/29 across 9 files (Phases 6–9): auth/role guards, login, list data-fetching states, create/approve/reject mutations, stored-XSS regression, polling config, and an explicit list-cache-invalidation-on-approve assertion (§18's stretch goal, verbatim)

**AI usage (§11)**
- [x] `docs/AI_USAGE_LOG.md` maintained with real entries by delivery time — one entry per implementation phase (13 total), each with genuine accepted/corrected/rejected examples, not fabricated

**Delivery rules (§13)**
- [ ] Git repository with comprehensible commit history; branch and exact delivery commit identified — **not done**; see the explicit note below and in `README.md`
- [x] README: prerequisites, env vars, run steps, test steps, main routes — written and every command in it re-run against the actual repo state to confirm accuracy (not written from memory)
- [x] Source code for backend + frontend, migrations/schema, Docker config, Kubernetes artifacts — all present in the working tree
- [x] `.env.example` with no real secrets
- [x] Technical decisions record (this TDD) and AI usage log present
- [x] Any unimplemented item explicitly identified with a proposed approach — no hidden gaps — see §22 (deliberate scope exclusions) and the note below (the one non-deliberate gap: commit history)

> **Known gap at delivery time — commit history.** Per this engagement's explicit instruction, commits were left entirely under the developer's manual control throughout implementation (the assistant never ran `git commit`). As of Phase 13, exactly one commit exists (the developer's own Phase 1 commit); all Phase 2–13 work sits as uncommitted changes in the working tree. **This must be committed before delivery** — ideally as a series of commits mirroring the 13 phases in §20 and `docs/AI_USAGE_LOG.md`, so the history stays comprehensible — and the exact delivery branch/commit identified per IAS §13. This is the one item in this checklist that could not be verified/completed by re-running a command; it requires the developer's own action.

**Traceable decisions (§12)** — all satisfied by this TDD's §5–§14 as written; re-checked at delivery time (Phase 13) — one real divergence found and fixed (§9's error-format example was missing the `details` field added in Phase 4; see the §2 traceability table).

---

## 22. Known Trade-offs / Deferred Work

No mandatory IAS requirement (RF1–RF8, §5–§10, §13) is deferred. Everything below is either an explicit assumption already justified in its own section, or genuine out-of-scope/production-hardening work that IAS does not require.

### Assessment-scope simplifications (documented assumptions, not gaps)

- Supplier creation is not exposed via API/UI — suppliers are seeded (§5 assumption).
- `SUPERVISOR` cannot create, `ANALYST` cannot decide — strict segregation assumption (§10).
- `(supplierId, externalReference)` is the idempotency key — explicit documented assumption with named risk (§7).
- Search uses `ILIKE` rather than full-text/trigram indexing — sufficient at assessment data volume.
- Pagination is offset-based, not cursor-based — simpler, sufficient at this scale.
- `/metrics` is unauthenticated — acceptable for a local assessment; would sit behind network policy/auth in production.

### Deferred to production (explicitly not implemented here, with reasoning)

| Item | Why deferred |
|---|---|
| SSE/WebSocket push instead of polling | Polling already satisfies RF7's ~10s tolerance with far less infrastructure (§14) |
| Refresh tokens, token revocation, password reset | Not required to demonstrate the two access capabilities; adds auth-flow complexity disproportionate to the time budget |
| `pg_trgm`/full-text search indexing | Not needed at the assessment's data volume; an unindexed `ILIKE '%term%'` scan is sufficient (the existing B-tree/unique indexes support equality/prefix access, not arbitrary substring search — see §12) |
| DB trigger enforcing the state machine as a second layer beyond the conditional `UPDATE` | The conditional `UPDATE` + `decisions.request_id UNIQUE` already provide atomic correctness and defense-in-depth; a trigger would be redundant belt-and-suspenders for this scope |
| Rate limiting / WAF | Not requested by IAS; would be a reasonable production addition but is not a graded requirement |
| Helm charts, Ingress/TLS, HorizontalPodAutoscaler, NetworkPolicy | IAS explicitly does not require a real cluster deployment or advanced K8s tooling; would be scope creep against "avoid overengineering" |
| Cursor-based pagination | Only justified at a scale this assessment does not simulate |
| End-to-end browser tests (Playwright/Cypress) | The two named critical behaviors are already covered by faster, more targeted integration tests; E2E adds setup time without covering a requirement E2E specifically demands |
| httpOnly-cookie-based token storage | `sessionStorage` is adequate for a local/demo assessment; noted as the concrete production upgrade in §10 |

---

## Final validation checklist (self-check performed while authoring this TDD)

1. Re-read `docs/IAS_TECHNICAL_TEST.md` in full immediately before writing §2–§21 above.
2. Every numbered IAS section (§1–§14) has at least one corresponding TDD section and at least one row in the §2 traceability table where it names a concrete, checkable requirement.
3. No mandatory requirement is marked as deferred; §22 contains only assumptions (already justified in-place) and genuinely optional production hardening.
4. Assumptions are visually distinguished from IAS requirements throughout (labeled **"Assumption:"** inline, plus the dedicated §7 open-question treatment IAS explicitly demands).
5. No microservices, queues, CQRS, event sourcing, Redis, Kafka, or cloud-managed services were introduced anywhere in this design.
6. §20 prioritizes the mandatory baseline (phases 1–8, covering every RF plus both critical invariants) within the assessment's 2–3h target, treats phases 9–13 as polish performed only after that baseline is verified, and gives an explicit, priority-ordered cut line that never touches a mandatory requirement — including `/metrics`, which IAS §8 makes mandatory as the required additional observability signal.

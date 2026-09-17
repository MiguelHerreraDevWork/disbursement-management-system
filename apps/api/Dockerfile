# syntax=docker/dockerfile:1

# ---- builder: install all deps (incl. dev) and compile TypeScript ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


# ---- runtime: only production deps + compiled output ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=app:app /app/dist ./dist
# Migrations are plain .sql files (+ drizzle-kit's JSON snapshots) that tsc
# never touches — copied separately, at the same relative path the
# programmatic migrator (src/db/migrate.ts) already expects locally.
COPY --chown=app:app src/db/migrations ./src/db/migrations
COPY --chown=app:app docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER app

EXPOSE 3000

# Applies pending migrations, then runs the idempotent seed, then starts the
# server — so a fresh `docker compose up` always ends with an up-to-date,
# seeded schema with zero manual steps (TDD §16).
ENTRYPOINT ["./docker-entrypoint.sh"]

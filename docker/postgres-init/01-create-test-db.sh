#!/bin/bash
# Runs automatically on a FRESH postgres:16-alpine data volume (the official
# image only executes docker-entrypoint-initdb.d/ scripts on first init).
# Creates a second, isolated database for integration tests so `npm test`
# never writes into the dev/demo dataset (see apps/api/src/db/client.ts).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE ${POSTGRES_DB}_test'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}_test')\gexec
EOSQL

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

// Vitest sets NODE_ENV=test automatically, so the app (and any test that
// imports this client) transparently talks to the isolated test database
// instead of the dev/demo one, whenever one is configured.
const connectionString =
  env.NODE_ENV === "test" && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL;

export const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

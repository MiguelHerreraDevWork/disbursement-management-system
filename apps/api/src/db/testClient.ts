import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

// Used only by the standalone provisioning scripts (migrate-test-db.ts,
// seed-test-db.ts), which must always target the test database regardless
// of NODE_ENV — unlike db/client.ts, which switches based on it.
if (!env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required to provision the test database");
}

export const testQueryClient = postgres(env.TEST_DATABASE_URL);
export const testDb = drizzle(testQueryClient, { schema });

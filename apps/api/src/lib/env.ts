import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Local dev/tooling runs from apps/api, but the single .env lives at the
// repo root (shared with docker-compose) — resolve it explicitly.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(currentDir, "../../../../.env"), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Separate database for integration tests (Vitest sets NODE_ENV=test),
  // so `npm test` never writes into the dev/demo dataset. See db/client.ts.
  TEST_DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("8h"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

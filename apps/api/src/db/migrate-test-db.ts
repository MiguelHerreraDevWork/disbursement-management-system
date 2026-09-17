import { migrate } from "drizzle-orm/postgres-js/migrator";
import { testDb, testQueryClient } from "./testClient.js";

async function main() {
  console.log("Applying pending migrations to the TEST database...");
  await migrate(testDb, { migrationsFolder: "./src/db/migrations" });
  console.log("Test database migrations applied successfully.");
  await testQueryClient.end();
}

main().catch((error) => {
  console.error("Test database migration failed:", error);
  process.exit(1);
});

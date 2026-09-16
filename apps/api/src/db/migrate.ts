import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, queryClient } from "./client.js";

async function main() {
  console.log("Applying pending migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations applied successfully.");
  await queryClient.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

import { db, queryClient } from "./client.js";
import { DEMO_PASSWORD, seedDemoData } from "./seedData.js";

async function main() {
  console.log("Seeding demo users and suppliers...");
  await seedDemoData(db);

  console.log("Seed complete.");
  console.log(`Demo login credentials (local/demo only, password shared by both users): password="${DEMO_PASSWORD}"`);
  console.log("  - analyst.demo (role: ANALYST)");
  console.log("  - supervisor.demo (role: SUPERVISOR)");

  await queryClient.end();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});

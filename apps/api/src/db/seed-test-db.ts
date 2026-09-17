import { testDb, testQueryClient } from "./testClient.js";
import { seedDemoData } from "./seedData.js";

async function main() {
  console.log("Seeding demo users and suppliers into the TEST database...");
  await seedDemoData(testDb);
  console.log("Test database seed complete.");
  await testQueryClient.end();
}

main().catch((error) => {
  console.error("Test database seed failed:", error);
  process.exit(1);
});

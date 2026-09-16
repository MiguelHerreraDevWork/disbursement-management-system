import bcrypt from "bcryptjs";
import { db, queryClient } from "./client.js";
import { suppliers, users } from "./schema.js";

const DEMO_PASSWORD = "Demo-Pass-1234!";
const BCRYPT_ROUNDS = 10;

async function main() {
  console.log("Seeding demo users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  await db
    .insert(users)
    .values([
      { username: "analyst.demo", passwordHash, role: "ANALYST" },
      { username: "supervisor.demo", passwordHash, role: "SUPERVISOR" },
    ])
    .onConflictDoNothing({ target: users.username });

  console.log("Seeding demo suppliers...");
  await db
    .insert(suppliers)
    .values([
      { taxId: "TAX-0001", name: "Acme Logistics SA" },
      { taxId: "TAX-0002", name: "Northwind Materials Ltd" },
      { taxId: "TAX-0003", name: "Delta Industrial Services" },
    ])
    .onConflictDoNothing({ target: suppliers.taxId });

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

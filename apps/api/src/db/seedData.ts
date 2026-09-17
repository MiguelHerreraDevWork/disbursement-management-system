import bcrypt from "bcryptjs";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { suppliers, users } from "./schema.js";
import type * as schema from "./schema.js";

export const DEMO_PASSWORD = "Demo-Pass-1234!";
const BCRYPT_ROUNDS = 10;

export async function seedDemoData(db: PostgresJsDatabase<typeof schema>) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  await db
    .insert(users)
    .values([
      { username: "analyst.demo", passwordHash, role: "ANALYST" },
      { username: "supervisor.demo", passwordHash, role: "SUPERVISOR" },
    ])
    .onConflictDoNothing({ target: users.username });

  await db
    .insert(suppliers)
    .values([
      { taxId: "TAX-0001", name: "Acme Logistics SA" },
      { taxId: "TAX-0002", name: "Northwind Materials Ltd" },
      { taxId: "TAX-0003", name: "Delta Industrial Services" },
    ])
    .onConflictDoNothing({ target: suppliers.taxId });
}

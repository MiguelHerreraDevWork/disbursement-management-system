import type { Express } from "express";
import request from "supertest";

export async function loginAs(app: Express, username: string, password: string): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({ username, password });

  if (response.status !== 200) {
    throw new Error(`Failed to log in as ${username}: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return response.body.token as string;
}

export async function getSupplierIdByTaxId(app: Express, token: string, taxId: string): Promise<string> {
  const response = await request(app).get("/api/suppliers").set("Authorization", `Bearer ${token}`);

  const supplier = (response.body as Array<{ id: string; taxId: string }>).find((s) => s.taxId === taxId);

  if (!supplier) {
    throw new Error(`Supplier with taxId ${taxId} not found in seeded test data`);
  }

  return supplier.id;
}

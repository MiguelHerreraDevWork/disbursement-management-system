import { describe, expect, it } from "vitest";
import { apiFetch } from "../src/api/client";

describe("apiFetch", () => {
  it("resolves JSON from a mocked API response", async () => {
    const result = await apiFetch<{ status: string }>("/ping");

    expect(result).toEqual({ status: "ok" });
  });
});

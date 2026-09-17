import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// @testing-library/react's automatic afterEach cleanup only self-registers
// when it detects vitest's `globals` config — this project runs with
// globals: false (explicit imports everywhere else), so it must be wired
// up explicitly or every render() this session leaks into the next test's
// DOM instead of unmounting.
afterEach(() => {
  cleanup();
});

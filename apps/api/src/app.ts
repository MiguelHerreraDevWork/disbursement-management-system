import express from "express";

export function createApp() {
  const app = express();

  app.use(express.json());

  // Scaffold-only marker route. Health (/healthz, /readyz), auth, and the
  // disbursement-requests API are implemented in later phases per docs/TDD.md.
  app.get("/", (_req, res) => {
    res.status(200).json({ name: "@ias/api", status: "ok" });
  });

  return app;
}

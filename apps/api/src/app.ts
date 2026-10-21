import express from "express";

export function createApp(checkDatabase: () => Promise<void>) {
  const app = express();

  app.disable("x-powered-by");

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/ready", async (_request, response) => {
    response.set("Cache-Control", "no-store");

    try {
      await checkDatabase();
      response.json({ status: "ready" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });

  return app;
}

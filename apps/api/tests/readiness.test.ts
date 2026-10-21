import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createApp } from "../src/app.js";

test("readiness succeeds when the database responds", async (context) => {
  const app = createApp(async () => {});
  const server = app.listen(0, "127.0.0.1");
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/ready`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ready" });
});

test("database failure returns 503 while liveness remains available", async (context) => {
  const app = createApp(async () => {
    throw new Error("Database connection failed");
  });
  const server = app.listen(0, "127.0.0.1");
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const readiness = await fetch(`${baseUrl}/ready`);
  const health = await fetch(`${baseUrl}/health`);

  assert.equal(readiness.status, 503);
  assert.deepEqual(await readiness.json(), { status: "unavailable" });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
});

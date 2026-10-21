import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Router } from "express";
import { createApp } from "../src/app.js";
import { listen, recordingLogger } from "./support/http.js";

async function startApp(
  context: TestContext,
  checkDatabase: () => Promise<void>,
) {
  const { logger, entries } = recordingLogger();
  const app = createApp({ checkDatabase, logger, studentRouter: Router() });

  return { baseUrl: await listen(context, app), entries };
}

test("readiness succeeds when the database responds", async (context) => {
  const { baseUrl } = await startApp(context, async () => {});

  const response = await fetch(`${baseUrl}/ready`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ready" });
});

test("database failure returns 503 while liveness remains available", async (context) => {
  const { baseUrl, entries } = await startApp(context, async () => {
    throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=secret");
  });

  const readiness = await fetch(`${baseUrl}/ready`);
  const health = await fetch(`${baseUrl}/health`);

  assert.equal(readiness.status, 503);
  assert.deepEqual(await readiness.json(), { status: "unavailable" });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });

  assert.deepEqual(entries, [{
    level: "error",
    event: "readiness.check_failed",
    fields: {
      requestId: readiness.headers.get("x-request-id"),
      errorName: "Error",
      errorCode: undefined,
      adapterKind: undefined,
      sqlState: undefined,
    },
  }]);
});

test("keeps an upstream request ID and replaces anything else", async (context) => {
  const { baseUrl } = await startApp(context, async () => {});
  const upstream = "0d7c1b9e-4f7a-4c1e-9a55-2b8f6f3e8c11";

  const kept = await fetch(`${baseUrl}/health`, {
    headers: { "X-Request-Id": upstream },
  });
  const replaced = await fetch(`${baseUrl}/health`, {
    headers: { "X-Request-Id": "forged-id" },
  });

  assert.equal(kept.headers.get("x-request-id"), upstream);

  const generated = replaced.headers.get("x-request-id");
  assert.ok(generated);
  assert.notEqual(generated, "forged-id");
  assert.notEqual(generated, upstream);
});

test("unknown routes return JSON 404", async (context) => {
  const { baseUrl } = await startApp(context, async () => {});

  const response = await fetch(`${baseUrl}/missing`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found" });
});

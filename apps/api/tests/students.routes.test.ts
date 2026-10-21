import assert from "node:assert/strict";
import { once } from "node:events";
import { test, type TestContext } from "node:test";
import express from "express";
import { createStudentRouter } from "../src/features/students/student.routes.js";
import {
  encodeStudentCursor,
} from "../src/features/students/student.pagination.js";

const organisationId = "11111111-1111-4111-8111-111111111111";

type StudentQuery = Parameters<typeof createStudentRouter>[1];

async function startServer(context: TestContext, query: StudentQuery) {
  const app = express();
  app.use("/students", createStudentRouter(organisationId, query));

  const server = app.listen(0, "127.0.0.1");

  context.after(
    () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
  );

  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");

  return `http://127.0.0.1:${address.port}/students`;
}

test("uses default pagination and configured organisation", async (context) => {
  let calls = 0;
  const result = { items: [], nextCursor: null, limit: 25 };

  const url = await startServer(context, async (options) => {
    calls++;
    assert.deepEqual(options, { organisationId, limit: 25 });
    return result;
  });

  const response = await fetch(url);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), result);
  assert.equal(calls, 1);
});

test("passes a validated cursor to the query", async (context) => {
  const cursor = {
    version: 1 as const,
    organisationId,
    surname: "Reed",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };

  let calls = 0;

  const url = await startServer(context, async (options) => {
    calls++;
    assert.deepEqual(options, { organisationId, limit: 10, cursor });
    return { items: [], nextCursor: null, limit: 10 };
  });

  const response = await fetch(
    `${url}?limit=10&cursor=${encodeStudentCursor(cursor)}`,
  );

  assert.equal(response.status, 200);
  assert.equal(calls, 1);
});

test("rejects invalid parameters without querying", async (context) => {
  let calls = 0;

  const url = await startServer(context, async () => {
    calls++;
    return { items: [], nextCursor: null, limit: 25 };
  });

  const foreignCursor = encodeStudentCursor({
    version: 1,
    organisationId: "22222222-2222-4222-8222-222222222222",
    surname: "Reed",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });

  const invalidQueries = [
    "limit=0",
    "limit=101",
    "limit=1.5",
    "limit=abc",
    "limit=",
    "limit=1&limit=2",
    "offset=0",
    "organisationId=anything",
    "cursor=",
    "cursor=invalid",
    "cursor=e30",
    `cursor=${"a".repeat(8193)}`,
    `cursor=${foreignCursor}`,
  ];

  for (const query of invalidQueries) {
    const response = await fetch(`${url}?${query}`);

    assert.equal(response.status, 400, query);
    assert.deepEqual(await response.json(), {
      error: "Invalid pagination",
    });
  }

  assert.equal(calls, 0);
});

test("returns 503 without exposing database errors", async (context) => {
  const url = await startServer(context, async () => {
    throw new Error("Private database failure details");
  });

  const response = await fetch(url);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Student directory unavailable",
  });
});

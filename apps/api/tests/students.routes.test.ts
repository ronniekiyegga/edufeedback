import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test, type TestContext } from "node:test";
import express from "express";
import {
  createStudentCursorCodec,
  MAX_CURSOR_LENGTH,
} from "../src/features/students/student.cursor.js";
import { createStudentRouter } from "../src/features/students/student.routes.js";
import { listen, recordingLogger } from "./support/http.js";

const organisationId = "11111111-1111-4111-8111-111111111111";
const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const cursorCodec = createStudentCursorCodec(randomBytes(32));

type StudentQuery = Parameters<typeof createStudentRouter>[0]["queryStudents"];

async function startServer(context: TestContext, queryStudents: StudentQuery) {
  const { logger, entries } = recordingLogger();
  const app = express();

  // The router reads the request ID set by the app-level middleware.
  app.use((_request, response, next) => {
    response.locals.requestId = "test-request-id";
    next();
  });
  app.use(
    "/students",
    createStudentRouter({ organisationId, queryStudents, cursorCodec, logger }),
  );

  return { url: `${await listen(context, app)}/students`, entries };
}

test("uses default pagination and configured organisation", async (context) => {
  let calls = 0;

  const { url } = await startServer(context, async (options) => {
    calls++;
    assert.deepEqual(options, { organisationId, limit: 25, after: undefined });
    return { items: [], next: null };
  });

  const response = await fetch(url);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    items: [],
    nextCursor: null,
    limit: 25,
  });
  assert.equal(calls, 1);
});

test("round-trips an encrypted cursor through the query", async (context) => {
  const item = {
    id: studentId,
    institutionStudentRef: "REF-1",
    firstName: null,
    surname: "Dunmerrow",
  };

  const afterKeys: unknown[] = [];

  const { url } = await startServer(context, async ({ after, limit }) => {
    afterKeys.push(after);
    assert.equal(limit, 1);
    return { items: [item], next: { surname: item.surname, id: item.id } };
  });

  const first = await (await fetch(`${url}?limit=1`)).json();

  assert.equal(typeof first.nextCursor, "string");
  assert.ok(!first.nextCursor.includes("Dunmerrow"));
  assert.deepEqual(cursorCodec.decode(first.nextCursor), {
    organisationId,
    surname: "Dunmerrow",
    id: studentId,
  });

  const second = await fetch(`${url}?limit=1&cursor=${first.nextCursor}`);

  assert.equal(second.status, 200);
  assert.deepEqual(afterKeys, [
    undefined,
    { surname: "Dunmerrow", id: studentId },
  ]);
});

test("rejects invalid parameters without querying", async (context) => {
  let calls = 0;

  const { url } = await startServer(context, async () => {
    calls++;
    return { items: [], next: null };
  });

  const validToken = cursorCodec.encode({
    organisationId,
    surname: "Dunmerrow",
    id: studentId,
  });
  const tamperedBytes = Buffer.from(validToken, "base64url");
  tamperedBytes[tamperedBytes.length - 1] ^= 0x01;
  const tamperedToken = tamperedBytes.toString("base64url");
  const otherKeyToken = createStudentCursorCodec(randomBytes(32)).encode({
    organisationId,
    surname: "Dunmerrow",
    id: studentId,
  });
  const foreignOrganisationToken = cursorCodec.encode({
    organisationId: "22222222-2222-4222-8222-222222222222",
    surname: "Dunmerrow",
    id: studentId,
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
    `cursor=${"a".repeat(MAX_CURSOR_LENGTH + 1)}`,
    `cursor=${validToken}&cursor=${validToken}`,
    `cursor=${tamperedToken}`,
    `cursor=${otherKeyToken}`,
    `cursor=${foreignOrganisationToken}`,
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

test("returns 503 and logs only safe failure details", async (context) => {
  const { url, entries } = await startServer(context, async () => {
    throw Object.assign(new Error("Private database failure for Dunmerrow"), {
      name: "PrismaClientKnownRequestError",
      code: "P1001",
      meta: {
        driverAdapterError: {
          cause: { kind: "DatabaseNotReachable", host: "10.0.0.5" },
        },
      },
    });
  });

  const response = await fetch(`${url}?limit=5`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Student directory unavailable",
  });

  assert.deepEqual(entries, [{
    level: "error",
    event: "students.list_failed",
    fields: {
      requestId: "test-request-id",
      errorName: "PrismaClientKnownRequestError",
      errorCode: "P1001",
      adapterKind: "DatabaseNotReachable",
      sqlState: undefined,
    },
  }]);
});

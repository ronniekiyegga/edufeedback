import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test, type TestContext } from "node:test";
import express from "express";
import {
  createStudentCursorCodec,
  MAX_CURSOR_LENGTH,
  type StudentCursor,
} from "../src/features/students/student.cursor.js";
import { createStudentRouter } from "../src/features/students/student.routes.js";
import { listen, recordingLogger } from "./support/http.js";

const organisationId = "11111111-1111-4111-8111-111111111111";
const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const academicYearStart = 2026;

const cursorCodec = createStudentCursorCodec(randomBytes(32));

type RouterDependencies = Parameters<typeof createStudentRouter>[0];
type StudentQuery = RouterDependencies["queryStudents"];
type AcademicYearQuery = RouterDependencies["queryAcademicYearStarts"];

const student = {
  id: studentId,
  institutionStudentRef: "SYNTHETIC-001",
  firstName: null,
  surname: "Dunmerrow",
  yearGroup: 9,
  classGroup: null,
};

async function startServer(
  context: TestContext,
  queryStudents: StudentQuery,
  queryAcademicYearStarts: AcademicYearQuery = async () => [academicYearStart],
) {
  const { logger, entries } = recordingLogger();
  const app = express();

  app.use((_request, response, next) => {
    response.locals.requestId = "test-request-id";
    next();
  });
  app.use(
    "/students",
    createStudentRouter({
      organisationId,
      queryStudents,
      queryAcademicYearStarts,
      cursorCodec,
      logger,
    }),
  );

  return { url: `${await listen(context, app)}/students`, entries };
}

function directoryQuery(parameters: Record<string, string> = {}) {
  return new URLSearchParams({
    academicYearStart: String(academicYearStart),
    ...parameters,
  });
}

function cursorFor(overrides: Partial<StudentCursor> = {}) {
  return cursorCodec.encode({
    organisationId,
    academicYearStart,
    surname: "Dunmerrow",
    id: studentId,
    ...overrides,
  });
}

test("uses default pagination, configured organisation and selected year", async (context) => {
  let calls = 0;

  const { url } = await startServer(context, async (options) => {
    calls++;
    assert.deepEqual(options, {
      organisationId,
      academicYearStart,
      limit: 25,
      after: undefined,
    });
    return { items: [], next: null };
  });

  const response = await fetch(`${url}?${directoryQuery()}`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    items: [],
    nextCursor: null,
    limit: 25,
  });
  assert.equal(calls, 1);
});

test("returns placement fields with each student", async (context) => {
  const { url } = await startServer(context, async () => ({
    items: [student],
    next: null,
  }));

  const response = await fetch(`${url}?${directoryQuery()}`);

  assert.deepEqual((await response.json()).items, [student]);
});

test("lists the organisation's academic years", async (context) => {
  const organisations: string[] = [];

  const { url } = await startServer(
    context,
    async () => ({ items: [], next: null }),
    async (requestedOrganisationId) => {
      organisations.push(requestedOrganisationId);
      return [2026, 2025];
    },
  );

  const response = await fetch(`${url}/academic-years`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { academicYearStarts: [2026, 2025] });
  assert.deepEqual(organisations, [organisationId]);

  const withParameter = await fetch(`${url}/academic-years?organisationId=x`);
  assert.equal(withParameter.status, 400);
  assert.deepEqual(organisations, [organisationId]);
});

test("round-trips an encrypted cursor through the query", async (context) => {
  const afterKeys: unknown[] = [];

  const { url } = await startServer(context, async ({ after, limit }) => {
    afterKeys.push(after);
    assert.equal(limit, 1);
    return { items: [student], next: { surname: student.surname, id: student.id } };
  });

  const first = await (await fetch(`${url}?${directoryQuery({ limit: "1" })}`)).json();

  assert.equal(typeof first.nextCursor, "string");
  assert.ok(!first.nextCursor.includes("Dunmerrow"));
  assert.deepEqual(cursorCodec.decode(first.nextCursor), {
    organisationId,
    academicYearStart,
    surname: "Dunmerrow",
    id: studentId,
  });

  const second = await fetch(
    `${url}?${directoryQuery({ limit: "1", cursor: first.nextCursor })}`,
  );

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

  const validToken = cursorFor();
  const tamperedBytes = Buffer.from(validToken, "base64url");
  tamperedBytes[tamperedBytes.length - 1] ^= 0x01;
  const tamperedToken = tamperedBytes.toString("base64url");
  const otherKeyToken = createStudentCursorCodec(randomBytes(32)).encode({
    organisationId,
    academicYearStart,
    surname: "Dunmerrow",
    id: studentId,
  });
  const foreignOrganisationToken = cursorFor({
    organisationId: "22222222-2222-4222-8222-222222222222",
  });
  const year = `academicYearStart=${academicYearStart}`;

  const invalidQueries = [
    "",
    "limit=25",
    "academicYearStart=",
    "academicYearStart=abc",
    "academicYearStart=2026.5",
    "academicYearStart=2026.0",
    "academicYearStart=1e3",
    "academicYearStart=0x7E8",
    "academicYearStart=%2B2026",
    "academicYearStart=%202026",
    "academicYearStart=0",
    "academicYearStart=9999",
    "academicYearStart=2026&academicYearStart=2025",
    `${year}&limit=0`,
    `${year}&limit=101`,
    `${year}&limit=1.5`,
    `${year}&limit=abc`,
    `${year}&limit=`,
    `${year}&limit=1&limit=2`,
    `${year}&offset=0`,
    `${year}&organisationId=anything`,
    `${year}&cursor=`,
    `${year}&cursor=invalid`,
    `${year}&cursor=${"a".repeat(MAX_CURSOR_LENGTH + 1)}`,
    `${year}&cursor=${validToken}&cursor=${validToken}`,
    `${year}&cursor=${tamperedToken}`,
    `${year}&cursor=${otherKeyToken}`,
    `${year}&cursor=${foreignOrganisationToken}`,
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
  const failure = () => {
    throw Object.assign(new Error("Private database failure for Dunmerrow"), {
      name: "PrismaClientKnownRequestError",
      code: "P1001",
      meta: {
        driverAdapterError: {
          cause: { kind: "DatabaseNotReachable", host: "10.0.0.5" },
        },
      },
    });
  };

  const { url, entries } = await startServer(
    context,
    async () => failure(),
    async () => failure(),
  );

  const fields = {
    requestId: "test-request-id",
    errorName: "PrismaClientKnownRequestError",
    errorCode: "P1001",
    adapterKind: "DatabaseNotReachable",
    sqlState: undefined,
  };

  for (const path of [`?${directoryQuery({ limit: "5" })}`, "/academic-years"]) {
    const response = await fetch(`${url}${path}`);

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "Student directory unavailable",
    });
  }

  assert.deepEqual(entries, [
    { level: "error", event: "students.list_failed", fields },
    { level: "error", event: "students.academic_years_failed", fields },
  ]);
});

test("passes trimmed search to the organisation-scoped query", async (context) => {
  let calls = 0;

  const { url } = await startServer(context, async (options) => {
    calls++;
    assert.deepEqual(options, {
      organisationId,
      academicYearStart,
      limit: 25,
      after: undefined,
      search: "Dunmerrow",
    });
    return { items: [], next: null };
  });

  const response = await fetch(`${url}?${directoryQuery({ q: "  Dunmerrow  " })}`);

  assert.equal(response.status, 200);
  assert.equal(calls, 1);
});

test("treats a blank search as no search", async (context) => {
  const { url } = await startServer(context, async (options) => {
    assert.deepEqual(options, {
      organisationId,
      academicYearStart,
      limit: 25,
      after: undefined,
    });
    return { items: [], next: null };
  });

  assert.equal((await fetch(`${url}?${directoryQuery({ q: "  " })}`)).status, 200);
});

test("binds continuation cursors to their search and academic year", async (context) => {
  const requests: { search?: string; academicYearStart: number }[] = [];

  const { url } = await startServer(context, async ({ search, academicYearStart }) => {
    requests.push({ search, academicYearStart });
    return { items: [student], next: { surname: "Dunmerrow", id: studentId } };
  });

  const firstResponse = await fetch(
    `${url}?${directoryQuery({ q: "Dunmerrow", limit: "1" })}`,
  );
  assert.equal(firstResponse.status, 200);

  const { nextCursor } = await firstResponse.json();
  assert.equal(typeof nextCursor, "string");

  const matching = directoryQuery({ q: "Dunmerrow", limit: "1", cursor: nextCursor });
  assert.equal((await fetch(`${url}?${matching}`)).status, 200);

  const mismatched = [
    directoryQuery({ q: "Another", cursor: nextCursor }),
    directoryQuery({ cursor: nextCursor }),
    directoryQuery({ q: "Dunmerrow", cursor: nextCursor, academicYearStart: "2025" }),
    directoryQuery({ q: "Dunmerrow", cursor: cursorFor() }),
    directoryQuery({ cursor: cursorFor({ academicYearStart: 2025 }) }),
  ];

  for (const query of mismatched) {
    assert.equal((await fetch(`${url}?${query}`)).status, 400, query.toString());
  }

  assert.deepEqual(requests, [
    { search: "Dunmerrow", academicYearStart },
    { search: "Dunmerrow", academicYearStart },
  ]);
});

test("rejects invalid search parameters before querying", async (context) => {
  let calls = 0;

  const { url } = await startServer(context, async () => {
    calls++;
    return { items: [], next: null };
  });

  const invalidQueries = [
    `${directoryQuery()}&q=one&q=two`,
    directoryQuery({ q: "x".repeat(101) }).toString(),
  ];

  for (const query of invalidQueries) {
    const response = await fetch(`${url}?${query}`);
    assert.equal(response.status, 400, query);
  }

  assert.equal(calls, 0);
});

import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, test, type TestContext } from "node:test";
import express from "express";
import { createStudentCursorCodec } from "../src/features/students/student.cursor.js";
import {
  MAX_SEARCH_LENGTH,
  MAX_SURNAME_LENGTH,
} from "../src/features/students/student.limits.js";
import { createStudentRouter } from "../src/features/students/student.routes.js";
import { studentPageSchema } from "../../web/src/features/students/student-page.schema.js";
import { MAX_SEARCH_LENGTH as WEB_MAX_SEARCH_LENGTH } from "../../web/src/features/students/student-search.schema.js";
import { listen, recordingLogger } from "./support/http.js";
import { requireLocalTestDatabase } from "./support/test-database.js";

requireLocalTestDatabase();

const { database } = await import("../src/database.js");
const { listStudents } = await import(
  "../src/features/students/student.repository.js"
);

after(() => database.$disconnect());

async function removeOrganisations(organisationIds: string[]) {
  await database.student.deleteMany({
    where: { organisationId: { in: organisationIds } },
  });
  await database.organisation.deleteMany({
    where: { id: { in: organisationIds } },
  });
}

async function startRouter(context: TestContext, organisationId: string) {
  const app = express();
  app.use(
    "/students",
    createStudentRouter({
      organisationId,
      queryStudents: listStudents,
      cursorCodec: createStudentCursorCodec(randomBytes(32)),
      logger: recordingLogger().logger,
    }),
  );

  return `${await listen(context, app)}/students`;
}

test("keyset pagination survives inserts and cursor deletion", async (context) => {
  const organisationA = randomUUID();
  const organisationB = randomUUID();
  const organisationIds = [organisationA, organisationB];
  const alphaId = randomUUID();
  const dunmerrowIds = [randomUUID(), randomUUID()].sort();
  const foreignId = randomUUID();

  const cursorCodec = createStudentCursorCodec(randomBytes(32));
  const { logger, entries } = recordingLogger();
  const app = express();
  app.use(
    "/students",
    createStudentRouter({
      organisationId: organisationA,
      queryStudents: listStudents,
      cursorCodec,
      logger,
    }),
  );
  const url = `${await listen(context, app)}/students`;

  async function getPage(cursor?: string) {
    const query = new URLSearchParams({ limit: "1" });
    if (cursor) query.set("cursor", cursor);

    const response = await fetch(`${url}?${query}`);
    assert.equal(response.status, 200);

    return studentPageSchema.parse(await response.json());
  }

  try {
    await database.organisation.createMany({
      data: [
        { id: organisationA, name: "Synthetic Test A" },
        { id: organisationB, name: "Synthetic Test B" },
      ],
    });

    await database.student.createMany({
      data: [
        {
          id: alphaId,
          organisationId: organisationA,
          institutionStudentRef: "TEST-001",
          surname: "Alpha",
        },
        ...dunmerrowIds.map((id, index) => ({
          id,
          organisationId: organisationA,
          institutionStudentRef: `TEST-DUNMERROW-${index}`,
          surname: "Dunmerrow",
        })),
        {
          id: foreignId,
          organisationId: organisationB,
          institutionStudentRef: "TEST-001",
          surname: "Aardvark",
        },
      ],
    });

    const firstPage = await getPage();

    assert.deepEqual(firstPage.items, [{
      id: alphaId,
      institutionStudentRef: "TEST-001",
      firstName: null,
      surname: "Alpha",
    }]);
    assert.ok(firstPage.nextCursor);

    await database.student.create({
      data: {
        organisationId: organisationA,
        institutionStudentRef: "TEST-INSERTED",
        surname: "Aardvark",
      },
    });

    const afterInsert = await getPage(firstPage.nextCursor);

    assert.deepEqual(afterInsert.items.map((student) => student.id), [
      dunmerrowIds[0],
    ]);

    await database.student.delete({ where: { id: alphaId } });

    const afterDelete = await getPage(firstPage.nextCursor);

    assert.deepEqual(afterDelete.items, afterInsert.items);
    assert.ok(afterInsert.nextCursor);

    const lastPage = await getPage(afterInsert.nextCursor);

    assert.deepEqual(lastPage.items.map((student) => student.id), [
      dunmerrowIds[1],
    ]);
    assert.equal(lastPage.nextCursor, null);

    const seenIds = [firstPage, afterInsert, lastPage]
      .flatMap((page) => page.items.map((student) => student.id));
    assert.ok(!seenIds.includes(foreignId));
    assert.deepEqual(entries, []);
  } finally {
    await removeOrganisations(organisationIds);
  }
});

test("a surname at the length limit still yields a usable cursor", async (context) => {
  const organisationId = randomUUID();
  const url = await startRouter(context, organisationId);

  try {
    await database.organisation.create({
      data: { id: organisationId, name: "Synthetic Test Boundary" },
    });

    const longestSurname = "\u0001".repeat(MAX_SURNAME_LENGTH);

    await database.student.createMany({
      data: [longestSurname, "Zedwick"].map(
        (surname, index) => ({
          organisationId,
          institutionStudentRef: `TEST-BOUNDARY-${index}`,
          surname,
        }),
      ),
    });

    const first = studentPageSchema.parse(
      await (await fetch(`${url}?limit=1`)).json(),
    );
    assert.equal(first.items[0]?.surname, longestSurname);
    assert.ok(first.nextCursor);

    const second = await fetch(`${url}?limit=1&cursor=${first.nextCursor}`);
    assert.equal(second.status, 200);

    const page = studentPageSchema.parse(await second.json());
    assert.deepEqual(page.items.map((student) => student.surname), ["Zedwick"]);
  } finally {
    await removeOrganisations([organisationId]);
  }
});

test("searches literal text within one organisation and paginates matches", async (context) => {
  const organisationId = randomUUID();
  const otherOrganisationId = randomUUID();
  const organisationIds = [organisationId, otherOrganisationId];

  try {
    await database.organisation.createMany({
      data: [
        { id: organisationId, name: "Synthetic Search Academy" },
        { id: otherOrganisationId, name: "Synthetic Search College" },
      ],
    });

    await database.student.createMany({
      data: [
        {
          organisationId,
          institutionStudentRef: "SEARCH-001",
          firstName: "Velmira",
          surname: "Amberfen",
        },
        {
          organisationId,
          institutionStudentRef: "SEARCH-002",
          firstName: null,
          surname: "Velmira",
        },
        {
          organisationId,
          institutionStudentRef: "DEMO_%\\-003",
          firstName: null,
          surname: "Zorrenvale",
        },
        {
          organisationId: otherOrganisationId,
          institutionStudentRef: "SEARCH-FOREIGN",
          firstName: "Velmira",
          surname: "Aardwick",
        },
      ],
    });

    const url = await startRouter(context, organisationId);

    async function getSearchPage(search: string, cursor?: string) {
      const query = new URLSearchParams({ q: search, limit: "1" });
      if (cursor) query.set("cursor", cursor);

      const response = await fetch(`${url}?${query}`);
      assert.equal(response.status, 200);

      return studentPageSchema.parse(await response.json());
    }

    const first = await getSearchPage("vELmIRA");

    assert.deepEqual(
      first.items.map((student) => student.institutionStudentRef),
      ["SEARCH-001"],
    );
    assert.ok(first.nextCursor);

    const second = await getSearchPage("vELmIRA", first.nextCursor);

    assert.deepEqual(
      second.items.map((student) => student.institutionStudentRef),
      ["SEARCH-002"],
    );
    assert.equal(second.nextCursor, null);

    for (const literal of ["%", "_", "\\", "DEMO_%\\-003"]) {
      const page = await getSearchPage(literal);

      assert.deepEqual(
        page.items.map((student) => student.institutionStudentRef),
        ["DEMO_%\\-003"],
        literal,
      );
      assert.equal(page.nextCursor, null);
    }

    const noMatches = await getSearchPage("AbsentSyntheticValue");
    assert.deepEqual(noMatches.items, []);
    assert.equal(noMatches.nextCursor, null);
  } finally {
    await removeOrganisations(organisationIds);
  }
});

test("accepts the longest search the web form can submit", async (context) => {
  assert.equal(WEB_MAX_SEARCH_LENGTH, MAX_SEARCH_LENGTH);

  const organisationId = randomUUID();

  try {
    await database.organisation.create({
      data: { id: organisationId, name: "Synthetic Search Limit Academy" },
    });

    const url = await startRouter(context, organisationId);
    const longest = new URLSearchParams({ q: "x".repeat(WEB_MAX_SEARCH_LENGTH) });
    const response = await fetch(`${url}?${longest}`);

    assert.equal(response.status, 200);
    assert.deepEqual(studentPageSchema.parse(await response.json()).items, []);
  } finally {
    await removeOrganisations([organisationId]);
  }
});

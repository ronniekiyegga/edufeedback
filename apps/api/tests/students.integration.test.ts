import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, test, type TestContext } from "node:test";
import express from "express";
import { createStudentCursorCodec } from "../src/features/students/student.cursor.js";
import {
  MAX_ACADEMIC_YEAR_START,
  MAX_SEARCH_LENGTH,
  MAX_SURNAME_LENGTH,
  MIN_ACADEMIC_YEAR_START,
} from "../src/features/students/student.limits.js";
import { createStudentRouter } from "../src/features/students/student.routes.js";
import {
  academicYearsSchema,
  studentPageSchema,
} from "../../web/src/features/students/student-page.schema.js";
import { MAX_SEARCH_LENGTH as WEB_MAX_SEARCH_LENGTH } from "../../web/src/features/students/student-search.schema.js";
import {
  MAX_ACADEMIC_YEAR_START as WEB_MAX_ACADEMIC_YEAR_START,
  MIN_ACADEMIC_YEAR_START as WEB_MIN_ACADEMIC_YEAR_START,
} from "../../web/src/features/students/academic-year.js";
import { listen, recordingLogger } from "./support/http.js";
import { requireLocalTestDatabase } from "./support/test-database.js";

requireLocalTestDatabase();

const { database } = await import("../src/database.js");
const { listAcademicYearStarts, listStudents } = await import(
  "../src/features/students/student.repository.js"
);

const academicYearStart = 2026;

type FixtureStudent = {
  id?: string;
  organisationId: string;
  institutionStudentRef: string;
  firstName?: string | null;
  surname: string;
};

type FixturePlacement = {
  academicYearStart?: number;
  yearGroup?: number;
  classGroup?: string | null;
};

async function createEnrolledStudents(
  students: FixtureStudent[],
  placement: FixturePlacement = {},
) {
  const created = await database.student.createManyAndReturn({
    data: students,
    select: { id: true, organisationId: true },
  });

  await enrol(created, placement);

  return created.map((student) => student.id);
}

async function enrol(
  students: { id: string; organisationId: string }[],
  {
    academicYearStart: year = academicYearStart,
    yearGroup = 7,
    classGroup = "7A",
  }: FixturePlacement = {},
) {
  await database.studentEnrolment.createMany({
    data: students.map((student) => ({
      organisationId: student.organisationId,
      studentId: student.id,
      academicYearStart: year,
      yearGroup,
      classGroup,
    })),
  });
}

function directoryQuery(parameters: Record<string, string> = {}) {
  return new URLSearchParams({
    academicYearStart: String(academicYearStart),
    ...parameters,
  });
}

after(() => database.$disconnect());

async function removeOrganisations(organisationIds: string[]) {
  await database.studentEnrolment.deleteMany({
    where: { organisationId: { in: organisationIds } },
  });
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
      queryAcademicYearStarts: listAcademicYearStarts,
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
      queryAcademicYearStarts: listAcademicYearStarts,
      cursorCodec,
      logger,
    }),
  );
  const url = `${await listen(context, app)}/students`;

  async function getPage(cursor?: string) {
    const query = directoryQuery({ limit: "1" });
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

    await createEnrolledStudents([
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
    ]);

    const firstPage = await getPage();

    assert.deepEqual(firstPage.items, [{
      id: alphaId,
      institutionStudentRef: "TEST-001",
      firstName: null,
      surname: "Alpha",
      yearGroup: 7,
      classGroup: "7A",
    }]);
    assert.ok(firstPage.nextCursor);

    await createEnrolledStudents([{
      organisationId: organisationA,
      institutionStudentRef: "TEST-INSERTED",
      surname: "Aardvark",
    }]);

    const afterInsert = await getPage(firstPage.nextCursor);

    assert.deepEqual(afterInsert.items.map((student) => student.id), [
      dunmerrowIds[0],
    ]);

    await database.studentEnrolment.deleteMany({ where: { studentId: alphaId } });
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

    await createEnrolledStudents([longestSurname, "Zedwick"].map(
      (surname, index) => ({
        organisationId,
        institutionStudentRef: `TEST-BOUNDARY-${index}`,
        surname,
      }),
    ));

    const first = studentPageSchema.parse(
      await (await fetch(`${url}?${directoryQuery({ limit: "1" })}`)).json(),
    );
    assert.equal(first.items[0]?.surname, longestSurname);
    assert.ok(first.nextCursor);

    const second = await fetch(
      `${url}?${directoryQuery({ limit: "1", cursor: first.nextCursor })}`,
    );
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

    await createEnrolledStudents([
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
    ]);

    const url = await startRouter(context, organisationId);

    async function getSearchPage(search: string, cursor?: string) {
      const query = directoryQuery({ q: search, limit: "1" });
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
    const longest = directoryQuery({ q: "x".repeat(WEB_MAX_SEARCH_LENGTH) });
    const response = await fetch(`${url}?${longest}`);

    assert.equal(response.status, 200);
    assert.deepEqual(studentPageSchema.parse(await response.json()).items, []);
  } finally {
    await removeOrganisations([organisationId]);
  }
});

test("the web app accepts the same academic year range as the API", () => {
  assert.equal(WEB_MIN_ACADEMIC_YEAR_START, MIN_ACADEMIC_YEAR_START);
  assert.equal(WEB_MAX_ACADEMIC_YEAR_START, MAX_ACADEMIC_YEAR_START);
});

test("lists one organisation's academic years, newest first", async (context) => {
  const organisationId = randomUUID();
  const otherOrganisationId = randomUUID();
  const emptyOrganisationId = randomUUID();
  const organisationIds = [organisationId, otherOrganisationId, emptyOrganisationId];

  try {
    await database.organisation.createMany({
      data: [
        { id: organisationId, name: "Synthetic Year Academy" },
        { id: otherOrganisationId, name: "Synthetic Year College" },
        { id: emptyOrganisationId, name: "Synthetic Empty School" },
      ],
    });

    const [first, second] = await database.student.createManyAndReturn({
      data: [
        { organisationId, institutionStudentRef: "YEAR-001", surname: "Brackwell" },
        { organisationId, institutionStudentRef: "YEAR-002", surname: "Corrander" },
      ],
      select: { id: true, organisationId: true },
    });

    await enrol([first, second], { academicYearStart: 2024 });
    await enrol([first], { academicYearStart: 2026 });
    await enrol([second], { academicYearStart: 2025 });
    await createEnrolledStudents(
      [{ organisationId: otherOrganisationId, institutionStudentRef: "YEAR-003", surname: "Dellow" }],
      { academicYearStart: 2030 },
    );

    for (const [id, expected] of [
      [organisationId, [2026, 2025, 2024]],
      [emptyOrganisationId, []],
    ] as const) {
      const url = await startRouter(context, id);
      const response = await fetch(`${url}/academic-years`);

      assert.equal(response.status, 200);
      assert.deepEqual(
        academicYearsSchema.parse(await response.json()).academicYearStarts,
        expected,
      );
    }
  } finally {
    await removeOrganisations(organisationIds);
  }
});

test("lists only the selected year's students with that year's placement", async (context) => {
  const organisationId = randomUUID();
  const otherOrganisationId = randomUUID();
  const organisationIds = [organisationId, otherOrganisationId];

  try {
    await database.organisation.createMany({
      data: [
        { id: organisationId, name: "Synthetic Placement Academy" },
        { id: otherOrganisationId, name: "Synthetic Placement College" },
      ],
    });

    const [continuing, leaver, joiner] = await database.student.createManyAndReturn({
      data: [
        { organisationId, institutionStudentRef: "PLACE-001", firstName: "Orla", surname: "Ashby" },
        { organisationId, institutionStudentRef: "PLACE-002", surname: "Brimley" },
        { organisationId, institutionStudentRef: "PLACE-003", firstName: "Tamsin", surname: "Caldew" },
      ],
      select: { id: true, organisationId: true },
    });

    await enrol([continuing], { academicYearStart: 2025, yearGroup: 8, classGroup: "8A" });
    await enrol([leaver], { academicYearStart: 2025, yearGroup: 11, classGroup: "11C" });
    await enrol([continuing], { academicYearStart: 2026, yearGroup: 9, classGroup: null });
    await enrol([joiner], { academicYearStart: 2026, yearGroup: 9, classGroup: "9B" });
    await createEnrolledStudents(
      [{ organisationId: otherOrganisationId, institutionStudentRef: "PLACE-001", surname: "Aardley" }],
      { academicYearStart: 2026 },
    );

    const url = await startRouter(context, organisationId);

    async function placements(year: number) {
      const query = directoryQuery({ academicYearStart: String(year) });
      const response = await fetch(`${url}?${query}`);
      assert.equal(response.status, 200);

      return studentPageSchema.parse(await response.json()).items.map(
        ({ institutionStudentRef, yearGroup, classGroup }) =>
          ({ institutionStudentRef, yearGroup, classGroup }),
      );
    }

    assert.deepEqual(await placements(2026), [
      { institutionStudentRef: "PLACE-001", yearGroup: 9, classGroup: null },
      { institutionStudentRef: "PLACE-003", yearGroup: 9, classGroup: "9B" },
    ]);
    assert.deepEqual(await placements(2025), [
      { institutionStudentRef: "PLACE-001", yearGroup: 8, classGroup: "8A" },
      { institutionStudentRef: "PLACE-002", yearGroup: 11, classGroup: "11C" },
    ]);
    assert.deepEqual(await placements(2024), []);
  } finally {
    await removeOrganisations(organisationIds);
  }
});

test("search and pagination stay within the selected year", async (context) => {
  const organisationId = randomUUID();

  try {
    await database.organisation.create({
      data: { id: organisationId, name: "Synthetic Year Search Academy" },
    });

    const students = await database.student.createManyAndReturn({
      data: [
        { organisationId, institutionStudentRef: "YS-001", firstName: "Velmira", surname: "Ashcombe" },
        { organisationId, institutionStudentRef: "YS-002", firstName: "Velmira", surname: "Bexley" },
        { organisationId, institutionStudentRef: "YS-003", firstName: "Velmira", surname: "Abberton" },
        { organisationId, institutionStudentRef: "YS-004", firstName: "Corin", surname: "Velmore" },
      ],
      select: { id: true, organisationId: true },
    });

    await enrol(students.slice(0, 2), { academicYearStart: 2026 });
    await enrol(students.slice(2), { academicYearStart: 2025 });

    const url = await startRouter(context, organisationId);

    async function getPage(parameters: Record<string, string>) {
      const response = await fetch(`${url}?${directoryQuery({ limit: "1", ...parameters })}`);
      assert.equal(response.status, 200);
      return studentPageSchema.parse(await response.json());
    }

    const first = await getPage({ q: "velm" });
    assert.deepEqual(first.items.map((student) => student.institutionStudentRef), ["YS-001"]);
    assert.ok(first.nextCursor);

    const second = await getPage({ q: "velm", cursor: first.nextCursor });
    assert.deepEqual(second.items.map((student) => student.institutionStudentRef), ["YS-002"]);
    assert.equal(second.nextCursor, null);

    const otherYear = directoryQuery({
      academicYearStart: "2025",
      q: "velm",
      cursor: first.nextCursor,
    });
    assert.equal((await fetch(`${url}?${otherYear}`)).status, 400);

    const previousYear = await getPage({ academicYearStart: "2025", q: "velm", limit: "10" });
    assert.deepEqual(
      previousYear.items.map((student) => student.institutionStudentRef),
      ["YS-003", "YS-004"],
    );
  } finally {
    await removeOrganisations([organisationId]);
  }
});

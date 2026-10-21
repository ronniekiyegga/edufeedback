import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  studentPaginationSchema,
} from "../src/features/students/student.pagination.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for integration tests");
}

const target = new URL(connectionString);

if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.pathname !== "/attainline_test"
) {
  throw new Error("Integration tests require local attainline_test");
}

const { database } = await import("../src/database.js");
const { listStudents } = await import(
  "../src/features/students/student.repository.js"
);

test("keyset pagination survives inserts and cursor deletion", async () => {
  const organisationA = randomUUID();
  const organisationB = randomUUID();
  const organisationIds = [organisationA, organisationB];
  const alphaId = randomUUID();
  const reedIds = [randomUUID(), randomUUID()].sort();

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
        ...reedIds.map((id, index) => ({
          id,
          organisationId: organisationA,
          institutionStudentRef: `TEST-REED-${index}`,
          surname: "Reed",
        })),
        {
          organisationId: organisationB,
          institutionStudentRef: "TEST-001",
          surname: "Aardvark",
        },
      ],
    });

    const firstPage = await listStudents({
      organisationId: organisationA,
      limit: 1,
    });

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

    const afterInsert = await listStudents({
      organisationId: organisationA,
      ...studentPaginationSchema.parse({
        limit: "1",
        cursor: firstPage.nextCursor,
      }),
    });

    assert.deepEqual(afterInsert.items.map((student) => student.id), [
      reedIds[0],
    ]);

    await database.student.delete({ where: { id: alphaId } });

    const afterDelete = await listStudents({
      organisationId: organisationA,
      ...studentPaginationSchema.parse({
        limit: "1",
        cursor: firstPage.nextCursor,
      }),
    });

    assert.deepEqual(afterDelete, afterInsert);
    assert.ok(afterInsert.nextCursor);

    const lastPage = await listStudents({
      organisationId: organisationA,
      ...studentPaginationSchema.parse({
        limit: "1",
        cursor: afterInsert.nextCursor,
      }),
    });

    assert.deepEqual(lastPage.items.map((student) => student.id), [
      reedIds[1],
    ]);
    assert.equal(lastPage.nextCursor, null);
  } finally {
    try {
      await database.student.deleteMany({
        where: { organisationId: { in: organisationIds } },
      });
      await database.organisation.deleteMany({
        where: { id: { in: organisationIds } },
      });
    } finally {
      await database.$disconnect();
    }
  }
});

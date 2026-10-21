import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { describeDatabaseError } from "../src/database-errors.js";
import { MAX_SURNAME_LENGTH } from "../src/features/students/student.limits.js";
import { requireLocalTestDatabase } from "./support/test-database.js";

requireLocalTestDatabase();

const { database } = await import("../src/database.js");

// Fixtures are created here, not taken from demo seed data, so these
// checks run against any migrated attainline_test database.
const organisationA = randomUUID();
const organisationB = randomUUID();
const studentA = randomUUID();

async function databaseFailure(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error) {
    return describeDatabaseError(error);
  }

  assert.fail("expected the database to reject the write");
}

before(async () => {
  await database.organisation.createMany({
    data: [
      { id: organisationA, name: "Constraint Test A" },
      { id: organisationB, name: "Constraint Test B" },
    ],
  });
  await database.student.create({
    data: {
      id: studentA,
      organisationId: organisationA,
      institutionStudentRef: "TEST-CONSTRAINT-1",
      surname: "Ellerby",
    },
  });
  await database.studentEnrolment.create({
    data: {
      organisationId: organisationA,
      studentId: studentA,
      academicYearStart: 2026,
      yearGroup: 9,
    },
  });
});

after(async () => {
  try {
    await database.studentEnrolment.deleteMany({
      where: { organisationId: { in: [organisationA, organisationB] } },
    });
    await database.student.deleteMany({
      where: { organisationId: { in: [organisationA, organisationB] } },
    });
    await database.organisation.deleteMany({
      where: { id: { in: [organisationA, organisationB] } },
    });
  } finally {
    await database.$disconnect();
  }
});

test("rejects an enrolment that crosses organisations", async () => {
  const failure = await databaseFailure(database.studentEnrolment.create({
    data: {
      organisationId: organisationB,
      studentId: studentA,
      academicYearStart: 2027,
      yearGroup: 10,
    },
  }));

  assert.equal(failure.errorCode, "P2003");
  assert.equal(failure.adapterKind, "ForeignKeyConstraintViolation");
});

test("rejects a duplicate student reference within an organisation", async () => {
  const failure = await databaseFailure(database.student.create({
    data: {
      organisationId: organisationA,
      institutionStudentRef: "TEST-CONSTRAINT-1",
      surname: "Duplicate",
    },
  }));

  assert.equal(failure.errorCode, "P2002");
  assert.equal(failure.adapterKind, "UniqueConstraintViolation");
});

test("rejects a non-positive year group", async () => {
  const failure = await databaseFailure(database.studentEnrolment.updateMany({
    where: { studentId: studentA },
    data: { yearGroup: 0 },
  }));

  assert.equal(failure.sqlState, "23514");
});

test("restricts deleting an organisation that has students", async () => {
  const failure = await databaseFailure(database.organisation.delete({
    where: { id: organisationA },
  }));

  assert.equal(failure.sqlState, "23001");
});

test("accepts surnames up to the length limit and rejects longer ones", async () => {
  const longest = await database.student.create({
    data: {
      organisationId: organisationB,
      institutionStudentRef: "TEST-CONSTRAINT-LONGEST",
      surname: "\u{1F600}".repeat(MAX_SURNAME_LENGTH),
    },
  });

  assert.equal([...longest.surname].length, MAX_SURNAME_LENGTH);

  const failure = await databaseFailure(database.student.create({
    data: {
      organisationId: organisationB,
      institutionStudentRef: "TEST-CONSTRAINT-TOO-LONG",
      surname: "a".repeat(MAX_SURNAME_LENGTH + 1),
    },
  }));

  assert.equal(failure.errorCode, "P2000");
  assert.equal(failure.adapterKind, "LengthMismatch");
});

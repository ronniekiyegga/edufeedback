// Adds invented demo records to the local development database. Every name
// and reference here was made up for this script; none is derived from
// real or legacy student data. Existing rows are never updated or deleted,
// so running it again only fills in anything missing.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const TARGET_HOSTS = ["localhost", "127.0.0.1"];
const TARGET_DATABASE = "attainline";
const ACADEMIC_YEAR_START = 2026;

const demoOrganisations = [
  // Matches DEMO_ORGANISATION_ID in apps/api/.env.example.
  { id: "11111111-1111-4111-8111-111111111111", name: "Fictional Demo Academy", students: 60 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Fictional Demo College", students: 5 },
];

const firstNames = [
  "Avery", "Bodhi", "Calla", "Dashiell", "Elowen", "Fenwick",
  "Greer", "Halden", "Isolde", "Jory", "Kestrel", "Linnea",
];

// Ten surnames across 60 students gives repeated surnames, which exercises
// the ID tie-break in keyset pagination.
const surnames = [
  "Ashgrove", "Brackenridge", "Cindermoor", "Dunmerrow", "Ellwood",
  "Foxwhistle", "Glenhallow", "Hollowmere", "Inkersall", "Juniperlea",
];

function targetUrl(): string {
  const value = process.env.SEED_DATABASE_URL;

  if (!value || !URL.canParse(value)) {
    throw new Error("Set SEED_DATABASE_URL to the local development database");
  }

  const url = new URL(value);

  if (!TARGET_HOSTS.includes(url.hostname) || url.pathname !== `/${TARGET_DATABASE}`) {
    throw new Error(
      `The demo seed only targets the local "${TARGET_DATABASE}" database`,
    );
  }

  return value;
}

function demoStudents(organisationId: string, count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    organisationId,
    institutionStudentRef: `DEMO-${prefix}-${String(index + 1).padStart(3, "0")}`,
    // Every eleventh student has no recorded first name.
    firstName: index % 11 === 10 ? null : firstNames[index % firstNames.length],
    surname: surnames[(index * 7) % surnames.length],
  }));
}

const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString: targetUrl() }),
});

try {
  for (const [position, organisation] of demoOrganisations.entries()) {
    const addedOrganisation = await database.organisation.createMany({
      data: [{ id: organisation.id, name: organisation.name }],
      skipDuplicates: true,
    });

    const prefix = String.fromCharCode(65 + position);
    const students = demoStudents(organisation.id, organisation.students, prefix);

    const added = await database.student.createMany({
      data: students,
      skipDuplicates: true,
    });

    const stored = await database.student.findMany({
      where: {
        organisationId: organisation.id,
        institutionStudentRef: {
          in: students.map((student) => student.institutionStudentRef),
        },
      },
      select: { id: true },
      orderBy: { institutionStudentRef: "asc" },
    });

    await database.studentEnrolment.createMany({
      data: stored.map((student, index) => ({
        organisationId: organisation.id,
        studentId: student.id,
        academicYearStart: ACADEMIC_YEAR_START,
        yearGroup: 7 + (index % 5),
        classGroup: `${7 + (index % 5)}${"ABC"[index % 3]}`,
      })),
      skipDuplicates: true,
    });

    const organisationNote = addedOrganisation.count === 1
      ? `added "${organisation.name}"`
      : "kept the existing organisation row";

    console.info(
      `${organisation.id}: ${organisationNote}; added ${added.count} of ${students.length} demo students`,
    );
  }
} finally {
  await database.$disconnect();
}

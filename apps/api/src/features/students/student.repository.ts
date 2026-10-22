import { database } from "../../database.js";
import type { Prisma } from "../../generated/prisma/client.js";

type StudentKey = {
  surname: string;
  id: string;
};

type ListStudentsOptions = {
  organisationId: string;
  academicYearStart: number;
  limit: number;
  after?: StudentKey;
  search?: string;
};

function escapeLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function matchesSearch(search: string): Prisma.StudentWhereInput {
  const contains = {
    contains: escapeLikePattern(search),
    mode: "insensitive",
  } as const;

  return {
    OR: [
      { firstName: contains },
      { surname: contains },
      { institutionStudentRef: contains },
    ],
  };
}

function isAfter({ surname, id }: StudentKey): Prisma.StudentWhereInput {
  return {
    OR: [
      { surname: { gt: surname } },
      { surname, id: { gt: id } },
    ],
  };
}

export async function listAcademicYearStarts(
  organisationId: string,
): Promise<number[]> {
  const years = await database.studentEnrolment.groupBy({
    by: ["academicYearStart"],
    where: { organisationId },
    orderBy: { academicYearStart: "desc" },
  });

  return years.map((year) => year.academicYearStart);
}

export async function listStudents({
  organisationId,
  academicYearStart,
  limit,
  after,
  search,
}: ListStudentsOptions) {
  const conditions: Prisma.StudentWhereInput[] = [
    { enrolments: { some: { academicYearStart } } },
  ];

  if (search) {
    conditions.push(matchesSearch(search));
  }

  if (after) {
    conditions.push(isAfter(after));
  }

  const students = await database.$transaction(
    (transaction) => transaction.student.findMany({
      where: { organisationId, AND: conditions },
      select: {
        id: true,
        institutionStudentRef: true,
        firstName: true,
        surname: true,
        enrolments: {
          where: { academicYearStart },
          select: { yearGroup: true, classGroup: true },
          take: 1,
        },
      },
      orderBy: [{ surname: "asc" }, { id: "asc" }],
      take: limit + 1,
    }),
    { isolationLevel: "RepeatableRead" },
  );

  const page = students.slice(0, limit);
  const items = page.map(({ enrolments: [placement], ...student }) => {
    if (!placement) {
      throw new Error("Listed student has no placement for the requested year");
    }

    return { ...student, ...placement };
  });
  const lastStudent = page.at(-1);

  const next: StudentKey | null = students.length > limit && lastStudent
    ? { surname: lastStudent.surname, id: lastStudent.id }
    : null;

  return { items, next };
}

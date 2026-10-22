import { database } from "../../database.js";
import type { Prisma } from "../../generated/prisma/client.js";

type StudentKey = {
  surname: string;
  id: string;
};

type ListStudentsOptions = {
  organisationId: string;
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

export async function listStudents({
  organisationId,
  limit,
  after,
  search,
}: ListStudentsOptions) {
  const conditions: Prisma.StudentWhereInput[] = [];

  if (search) {
    conditions.push(matchesSearch(search));
  }

  if (after) {
    conditions.push(isAfter(after));
  }

  const students = await database.student.findMany({
    where: { organisationId, AND: conditions },
    select: {
      id: true,
      institutionStudentRef: true,
      firstName: true,
      surname: true,
    },
    orderBy: [{ surname: "asc" }, { id: "asc" }],
    take: limit + 1,
  });

  const items = students.slice(0, limit);
  const lastStudent = items.at(-1);

  const next: StudentKey | null = students.length > limit && lastStudent
    ? { surname: lastStudent.surname, id: lastStudent.id }
    : null;

  return { items, next };
}

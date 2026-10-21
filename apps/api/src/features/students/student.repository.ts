import { database } from "../../database.js";

type StudentKey = {
  surname: string;
  id: string;
};

type ListStudentsOptions = {
  organisationId: string;
  limit: number;
  after?: StudentKey;
};

export async function listStudents({
  organisationId,
  limit,
  after,
}: ListStudentsOptions) {
  const students = await database.student.findMany({
    where: {
      organisationId,
      ...(after && {
        OR: [
          { surname: { gt: after.surname } },
          {
            surname: after.surname,
            id: { gt: after.id },
          },
        ],
      }),
    },
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

import { database } from "../../database.js";
import {
  encodeStudentCursor,
  type StudentCursor,
} from "./student.pagination.js";

type ListStudentsOptions = {
  organisationId: string;
  limit: number;
  cursor?: StudentCursor;
};

export async function listStudents({
  organisationId,
  limit,
  cursor,
}: ListStudentsOptions) {
  const students = await database.student.findMany({
    where: {
      organisationId,
      ...(cursor && {
        OR: [
          { surname: { gt: cursor.surname } },
          {
            surname: cursor.surname,
            id: { gt: cursor.id },
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
  const hasMore = students.length > limit;
  const lastStudent = items.at(-1);

  const nextCursor = hasMore && lastStudent
    ? encodeStudentCursor({
        version: 1,
        organisationId,
        surname: lastStudent.surname,
        id: lastStudent.id,
      })
    : null;

  return { items, nextCursor, limit };
}

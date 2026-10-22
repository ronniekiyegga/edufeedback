import { Router, type Response } from "express";
import { describeDatabaseError } from "../../database-errors.js";
import type { Logger } from "../../logger.js";
import { searchHash, type StudentCursorCodec } from "./student.cursor.js";
import { createStudentPaginationSchema } from "./student.pagination.js";
import type { listStudents } from "./student.repository.js";

type StudentRouterDependencies = {
  organisationId: string;
  queryStudents: typeof listStudents;
  cursorCodec: StudentCursorCodec;
  logger: Logger;
};

function rejectPagination(response: Response) {
  response.status(400).json({ error: "Invalid pagination" });
}

export function createStudentRouter({
  organisationId,
  queryStudents,
  cursorCodec,
  logger,
}: StudentRouterDependencies) {
  const router = Router();
  const paginationSchema = createStudentPaginationSchema(cursorCodec);

  router.get("/", async (request, response) => {
    response.set("Cache-Control", "no-store");

    const pagination = paginationSchema.safeParse(request.query);

    if (!pagination.success) {
      rejectPagination(response);
      return;
    }

    const { limit, cursor, q } = pagination.data;
    const search = q || undefined;
    const expectedSearchHash = searchHash(search);

    if (
      cursor &&
      (cursor.organisationId !== organisationId ||
        cursor.searchHash !== expectedSearchHash)
    ) {
      rejectPagination(response);
      return;
    }

    try {
      const page = await queryStudents({
        organisationId,
        limit,
        after: cursor && { surname: cursor.surname, id: cursor.id },
        ...(search && { search }),
      });

      const nextCursor = page.next
        ? cursorCodec.encode({
            organisationId,
            ...page.next,
            ...(expectedSearchHash && { searchHash: expectedSearchHash }),
          })
        : null;

      response.json({ items: page.items, nextCursor, limit });
    } catch (error) {
      logger.error("students.list_failed", {
        requestId: response.locals.requestId,
        ...describeDatabaseError(error),
      });
      response.status(503).json({
        error: "Student directory unavailable",
      });
    }
  });

  return router;
}

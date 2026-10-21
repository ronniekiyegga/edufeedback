import { Router, type Response } from "express";
import { describeDatabaseError } from "../../database-errors.js";
import type { Logger } from "../../logger.js";
import type { StudentCursorCodec } from "./student.cursor.js";
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

    const { limit, cursor } = pagination.data;

    // A valid token from another organisation is still rejected: the query
    // below is always scoped to the server's organisation, never the cursor's.
    if (cursor && cursor.organisationId !== organisationId) {
      rejectPagination(response);
      return;
    }

    try {
      const page = await queryStudents({
        organisationId,
        limit,
        after: cursor && { surname: cursor.surname, id: cursor.id },
      });

      response.json({
        items: page.items,
        nextCursor: page.next && cursorCodec.encode({ organisationId, ...page.next }),
        limit,
      });
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

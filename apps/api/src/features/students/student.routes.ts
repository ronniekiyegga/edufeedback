import { Router } from "express";
import { studentPaginationSchema } from "./student.pagination.js";
import type { listStudents } from "./student.repository.js";

export function createStudentRouter(
  organisationId: string,
  queryStudents: typeof listStudents,
) {
  const router = Router();

  router.get("/", async (request, response) => {
    response.set("Cache-Control", "no-store");

    const pagination = studentPaginationSchema.safeParse(request.query);

    if (
      !pagination.success ||
      (
        pagination.data.cursor &&
        pagination.data.cursor.organisationId !== organisationId
      )
    ) {
      response.status(400).json({ error: "Invalid pagination" });
      return;
    }

    try {
      const result = await queryStudents({
        ...pagination.data,
        organisationId,
      });

      response.json(result);
    } catch (error) {
      console.error("Student directory query failed", error);
      response.status(503).json({
        error: "Student directory unavailable",
      });
    }
  });

  return router;
}

import { z } from "zod";
import { createApp } from "./app.js";
import { describeDatabaseError } from "./database-errors.js";
import { checkDatabase, database } from "./database.js";
import {
  createStudentCursorCodec,
  parseStudentCursorKey,
} from "./features/students/student.cursor.js";
import {
  listAcademicYearStarts,
  listStudents,
} from "./features/students/student.repository.js";
import { createStudentRouter } from "./features/students/student.routes.js";
import { logger } from "./logger.js";

const organisationId = z.uuid().parse(process.env.DEMO_ORGANISATION_ID);

const cursorCodec = createStudentCursorCodec(
  parseStudentCursorKey(process.env.STUDENT_CURSOR_KEY),
);

const port = z.coerce.number().int().min(1).max(65535)
  .parse(process.env.PORT ?? "4100");

const app = createApp({
  checkDatabase,
  logger,
  studentRouter: createStudentRouter({
    organisationId,
    queryStudents: listStudents,
    queryAcademicYearStarts: listAcademicYearStarts,
    cursorCodec,
    logger,
  }),
});

const server = app.listen(port, () => {
  logger.info("server.listening", { port });
});

function shutdown() {
  server.close(() => {
    database.$disconnect().catch((error: unknown) => {
      logger.error("server.shutdown_failed", describeDatabaseError(error));
      process.exitCode = 1;
    });
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

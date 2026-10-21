import { z } from "zod";
import { createApp } from "./app.js";
import { checkDatabase, database } from "./database.js";
import { listStudents } from "./features/students/student.repository.js";
import { createStudentRouter } from "./features/students/student.routes.js";

const app = createApp(checkDatabase);

const demoOrganisationId = z.uuid().parse(process.env.DEMO_ORGANISATION_ID);

app.use("/students", createStudentRouter(demoOrganisationId, listStudents));

const port = z.coerce.number().int().min(1).max(65535)
  .parse(process.env.PORT ?? "4100");

const server = app.listen(port, () => {
  console.info(`Attainline API listening on port ${port}`);
});

function shutdown() {
  server.close(() => {
    database.$disconnect().catch((error) => {
      console.error("Database shutdown failed", error);
      process.exitCode = 1;
    });
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

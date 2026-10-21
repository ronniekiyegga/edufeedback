import { createApp } from "./app.js";
import { checkDatabase, database } from "./database.js";

const app = createApp(checkDatabase);

const server = app.listen(4100, () => {
  console.info("Attainline API listening on http://localhost:4100");
});

function shutdown() {
  server.close(() => {
    database.$disconnect().catch(() => {
      console.error("Database shutdown failed");
      process.exitCode = 1;
    });
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

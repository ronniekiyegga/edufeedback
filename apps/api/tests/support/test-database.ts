import "dotenv/config";

// Integration tests create and delete rows, so they refuse to run against
// anything except a local database named attainline_test.
export function requireLocalTestDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for integration tests");
  }

  const target = new URL(connectionString);

  if (
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/attainline_test"
  ) {
    throw new Error("Integration tests require local attainline_test");
  }
}

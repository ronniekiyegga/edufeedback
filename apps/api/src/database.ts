import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 5_000,
});

export const database = new PrismaClient({ adapter });

export async function checkDatabase(): Promise<void> {
  await database.$queryRaw`SELECT 1`;
}

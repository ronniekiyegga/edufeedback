import "server-only";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { z } from "zod";
import { studentPageSchema, type StudentPage } from "./student-page.schema";

const PAGE_SIZE = "25";

// The API allows up to 15s to acquire a database connection and 5s per
// statement. Waiting longer than either lets the API usually answer with its
// own 503 first. The limits are separate, so neither adds up to a guaranteed
// bound on API latency.
const REQUEST_TIMEOUT_MS = 25_000;

type StudentPageResult =
  | { status: "success"; data: StudentPage }
  | { status: "invalid-cursor" }
  | { status: "unavailable" };

const unavailable: StudentPageResult = { status: "unavailable" };

type FailureReason =
  | "not-configured"
  | "timeout"
  | "network"
  | "http-status"
  | "invalid-response";

const fetchErrorSchema = z.object({
  name: z.string(),
  cause: z.object({ code: z.string() }).optional(),
});

// Logs classification only: never the URL, cursor or response body.
function logFailure(fields: {
  requestId: string;
  reason: FailureReason;
  status?: number;
  errorCode?: string;
}) {
  console.error(JSON.stringify({
    level: "error",
    event: "student_api.request_failed",
    ...fields,
  }));
}

function describeFetchError(error: unknown) {
  const parsed = fetchErrorSchema.safeParse(error);

  return {
    reason: parsed.data?.name === "TimeoutError" ? "timeout" : "network",
    errorCode: parsed.data?.cause?.code,
  } as const;
}

export async function getStudents(
  cursor?: string,
): Promise<StudentPageResult> {
  // Directory data is per request and never prerendered.
  await connection();

  const apiUrl = process.env.ATTAINLINE_API_URL;
  const requestId = randomUUID();

  if (!apiUrl || !URL.canParse(apiUrl)) {
    logFailure({ requestId, reason: "not-configured" });
    return unavailable;
  }

  const url = new URL("/students", apiUrl);
  url.searchParams.set("limit", PAGE_SIZE);

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { "X-Request-Id": requestId },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    logFailure({ requestId, ...describeFetchError(error) });
    return unavailable;
  }

  // Only the cursor varies between requests, so a 400 means it was rejected.
  if (response.status === 400) {
    return { status: "invalid-cursor" };
  }

  if (!response.ok) {
    logFailure({ requestId, reason: "http-status", status: response.status });
    return unavailable;
  }

  const page = studentPageSchema.safeParse(
    await response.json().catch(() => undefined),
  );

  if (!page.success) {
    logFailure({ requestId, reason: "invalid-response" });
    return unavailable;
  }

  return { status: "success", data: page.data };
}

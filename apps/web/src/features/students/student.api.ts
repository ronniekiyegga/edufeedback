import "server-only";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { z } from "zod";
import {
  academicYearsSchema,
  studentPageSchema,
  type StudentPage,
} from "./student-page.schema";

const PAGE_SIZE = "25";

const REQUEST_TIMEOUT_MS = 25_000;

type ApiResult<T> =
  | { status: "success"; data: T }
  | { status: "rejected" }
  | { status: "unavailable" };

export type AcademicYearsResult =
  | { status: "success"; data: number[] }
  | { status: "unavailable" };

export type StudentPageResult =
  | { status: "success"; data: StudentPage }
  | { status: "invalid-cursor" }
  | { status: "unavailable" };

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

async function requestStudentApi<T>(
  path: string,
  parameters: Record<string, string | undefined>,
  schema: z.ZodType<T>,
  { expectRejection }: { expectRejection: boolean },
): Promise<ApiResult<T>> {
  await connection();

  const apiUrl = process.env.ATTAINLINE_API_URL;
  const requestId = randomUUID();

  if (!apiUrl || !URL.canParse(apiUrl)) {
    logFailure({ requestId, reason: "not-configured" });
    return { status: "unavailable" };
  }

  const baseUrl = new URL(apiUrl);

  if (!baseUrl.pathname.endsWith("/")) {
    baseUrl.pathname += "/";
  }

  baseUrl.search = "";
  baseUrl.hash = "";

  const url = new URL(path, baseUrl);

  for (const [name, value] of Object.entries(parameters)) {
    if (value) {
      url.searchParams.set(name, value);
    }
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
    return { status: "unavailable" };
  }

  if (response.status === 400 && expectRejection) {
    return { status: "rejected" };
  }

  if (!response.ok) {
    logFailure({ requestId, reason: "http-status", status: response.status });
    return { status: "unavailable" };
  }

  const body = schema.safeParse(await response.json().catch(() => undefined));

  if (!body.success) {
    logFailure({ requestId, reason: "invalid-response" });
    return { status: "unavailable" };
  }

  return { status: "success", data: body.data };
}

export async function getAcademicYears(): Promise<AcademicYearsResult> {
  const result = await requestStudentApi(
    "students/academic-years",
    {},
    academicYearsSchema,
    { expectRejection: false },
  );

  return result.status === "success"
    ? { status: "success", data: result.data.academicYearStarts }
    : { status: "unavailable" };
}

type StudentPageQuery = {
  academicYearStart: number;
  cursor?: string;
  search?: string;
};

export async function getStudents({
  academicYearStart,
  cursor,
  search,
}: StudentPageQuery): Promise<StudentPageResult> {
  const result = await requestStudentApi(
    "students",
    {
      academicYearStart: String(academicYearStart),
      limit: PAGE_SIZE,
      q: search,
      cursor,
    },
    studentPageSchema,
    { expectRejection: Boolean(cursor) },
  );

  return result.status === "rejected" ? { status: "invalid-cursor" } : result;
}

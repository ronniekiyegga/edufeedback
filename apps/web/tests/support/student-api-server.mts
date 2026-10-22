// Stand-in for the Attainline API during browser tests. Next fetches the
// directory on the server, so browser-level interception cannot reach that
// request; this real HTTP server can. Tests switch scenarios through
// PUT /__scenario/<name> and inspect received requests via GET /__requests.
import { createServer, type ServerResponse } from "node:http";

const port = Number(process.env.STUDENT_API_PORT);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("STUDENT_API_PORT is required");
}

const scenarios = ["populated", "empty", "no-enrolments", "unavailable"] as const;
type Scenario = (typeof scenarios)[number];

let scenario: Scenario = "populated";
let received: {
  path: string;
  academicYearStart: string | null;
  limit: string | null;
  q: string | null;
  cursor: string | null;
  requestId: string | null;
}[] = [];

const academicYearStarts = [2026, 2025];

const students = [
  { id: "0a3f5c1e-1111-4111-8111-000000000001", institutionStudentRef: "DEMO-SYN-001", firstName: "Avery", surname: "Ashgrove", yearGroup: 7, classGroup: "7A" },
  { id: "0a3f5c1e-1111-4111-8111-000000000002", institutionStudentRef: "DEMO-SYN-002", firstName: null, surname: "Brackenridge", yearGroup: 7, classGroup: null },
  { id: "0a3f5c1e-1111-4111-8111-000000000003", institutionStudentRef: "DEMO-SYN-003", firstName: "Calla", surname: "Cindermoor", yearGroup: 8, classGroup: "8B" },
  { id: "0a3f5c1e-1111-4111-8111-000000000004", institutionStudentRef: "DEMO-SYN-004", firstName: "Dorian", surname: "Elmscott", yearGroup: 6, classGroup: "6C" },
];

type Page = { items: typeof students; nextCursor: string | null };

const pagesByYear: Record<string, Record<string, Page>> = {
  "2026": {
    first: { items: students.slice(0, 2), nextCursor: "page-2" },
    "page-2": { items: students.slice(2, 3), nextCursor: null },
  },
  "2025": {
    first: { items: students.slice(3), nextCursor: null },
  },
};

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function isScenario(value: string): value is Scenario {
  return (scenarios as readonly string[]).includes(value);
}

function academicYearsResponse(response: ServerResponse) {
  if (scenario === "unavailable") {
    sendJson(response, 503, { error: "Student directory unavailable" });
    return;
  }

  sendJson(response, 200, {
    academicYearStarts: scenario === "no-enrolments" ? [] : academicYearStarts,
  });
}

function studentsResponse(response: ServerResponse, url: URL) {
  if (scenario === "unavailable") {
    sendJson(response, 503, { error: "Student directory unavailable" });
    return;
  }

  const year = url.searchParams.get("academicYearStart") ?? "";
  const cursor = url.searchParams.get("cursor");
  const pages = pagesByYear[year];

  if (scenario === "empty" && pages) {
    sendJson(response, 200, { items: [], nextCursor: null, limit: 25 });
    return;
  }

  const page = pages?.[cursor ?? "first"];

  if (!page) {
    sendJson(response, 400, { error: "Invalid pagination" });
    return;
  }

  sendJson(response, 200, { ...page, limit: 25 });
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const [, first, second] = url.pathname.split("/");

  if (request.method === "GET" && first === "__health") {
    sendJson(response, 200, { status: "ok" });
  } else if (request.method === "PUT" && first === "__scenario" && isScenario(second)) {
    scenario = second;
    received = [];
    response.writeHead(204).end();
  } else if (request.method === "GET" && first === "__requests") {
    sendJson(response, 200, received);
  } else if (request.method === "GET" && first === "students") {
    received.push({
      path: url.pathname,
      academicYearStart: url.searchParams.get("academicYearStart"),
      limit: url.searchParams.get("limit"),
      q: url.searchParams.get("q"),
      cursor: url.searchParams.get("cursor"),
      requestId: request.headers["x-request-id"]?.toString() ?? null,
    });
    if (second === "academic-years") {
      academicYearsResponse(response);
    } else {
      studentsResponse(response, url);
    }
  } else {
    sendJson(response, 404, { error: "Not found" });
  }
}).listen(port, "127.0.0.1");

// Stand-in for the Attainline API during browser tests. Next fetches the
// directory on the server, so browser-level interception cannot reach that
// request; this real HTTP server can. Tests switch scenarios through
// PUT /__scenario/<name> and inspect received requests via GET /__requests.
import { createServer, type ServerResponse } from "node:http";

const port = Number(process.env.STUDENT_API_PORT);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("STUDENT_API_PORT is required");
}

const scenarios = ["populated", "empty", "unavailable"] as const;
type Scenario = (typeof scenarios)[number];

let scenario: Scenario = "populated";
let received: {
  limit: string | null;
  q: string | null;
  cursor: string | null;
  requestId: string | null;
}[] = [];

const students = [
  { id: "0a3f5c1e-1111-4111-8111-000000000001", institutionStudentRef: "DEMO-SYN-001", firstName: "Avery", surname: "Ashgrove" },
  { id: "0a3f5c1e-1111-4111-8111-000000000002", institutionStudentRef: "DEMO-SYN-002", firstName: null, surname: "Brackenridge" },
  { id: "0a3f5c1e-1111-4111-8111-000000000003", institutionStudentRef: "DEMO-SYN-003", firstName: "Calla", surname: "Cindermoor" },
];

const pages: Record<string, { items: typeof students; nextCursor: string | null }> = {
  first: { items: students.slice(0, 2), nextCursor: "page-2" },
  "page-2": { items: students.slice(2), nextCursor: null },
};

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function isScenario(value: string): value is Scenario {
  return (scenarios as readonly string[]).includes(value);
}

function studentsResponse(response: ServerResponse, cursor: string | null) {
  if (scenario === "unavailable") {
    sendJson(response, 503, { error: "Student directory unavailable" });
    return;
  }

  if (scenario === "empty") {
    sendJson(response, 200, { items: [], nextCursor: null, limit: 25 });
    return;
  }

  const page = pages[cursor ?? "first"];

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
      limit: url.searchParams.get("limit"),
      q: url.searchParams.get("q"),
      cursor: url.searchParams.get("cursor"),
      requestId: request.headers["x-request-id"]?.toString() ?? null,
    });
    studentsResponse(response, url.searchParams.get("cursor"));
  } else {
    sendJson(response, 404, { error: "Not found" });
  }
}).listen(port, "127.0.0.1");

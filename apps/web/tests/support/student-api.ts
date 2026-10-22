import { expect, type APIRequestContext } from "@playwright/test";

export const studentApiPort = 4199;
export const studentApiUrl = `http://127.0.0.1:${studentApiPort}`;

type Scenario = "populated" | "empty" | "no-enrolments" | "unavailable";

type ReceivedRequest = {
  path: string;
  academicYearStart: string | null;
  limit: string | null;
  q: string | null;
  cursor: string | null;
  requestId: string | null;
};

export async function useScenario(
  request: APIRequestContext,
  scenario: Scenario,
) {
  const response = await request.put(`${studentApiUrl}/__scenario/${scenario}`);
  expect(response.status()).toBe(204);
}

export async function receivedRequests(
  request: APIRequestContext,
): Promise<ReceivedRequest[]> {
  const response = await request.get(`${studentApiUrl}/__requests`);
  return response.json();
}

export async function studentListRequests(
  request: APIRequestContext,
): Promise<ReceivedRequest[]> {
  return (await receivedRequests(request))
    .filter((received) => received.path === "/students");
}

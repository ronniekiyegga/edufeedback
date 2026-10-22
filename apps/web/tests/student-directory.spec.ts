import { expect, test, type Page } from "@playwright/test";
import { z } from "zod";
import { receivedRequests, useScenario } from "./support/student-api";

function directoryRows(page: Page) {
  return page.getByRole("table").getByRole("rowheader");
}

test.describe("student directory", () => {
  test("lists the first page and sends a correlated request", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/");

    await expect(page.getByText("Showing 2 students")).toBeVisible();
    await expect(directoryRows(page)).toHaveText(["Avery Ashgrove", "Brackenridge"]);
    await expect(page.getByRole("link", { name: "First page" })).toHaveCount(0);

    const [apiRequest] = await receivedRequests(request);
    expect(apiRequest.limit).toBe("25");
    expect(apiRequest.cursor).toBeNull();
    expect(z.uuid().safeParse(apiRequest.requestId).success).toBe(true);
  });

  test("pages forward client-side, survives refresh and returns to the start", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/");

    const trigger = page
      .locator("header")
      .getByRole("button", { name: "Toggle Sidebar" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("link", { name: "Next page" }).click();

    await expect(page).toHaveURL("/?cursor=page-2");
    await expect(directoryRows(page)).toHaveText(["Calla Cindermoor"]);
    await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.reload();

    await expect(directoryRows(page)).toHaveText(["Calla Cindermoor"]);

    await page.getByRole("link", { name: "First page" }).click();

    await expect(page).toHaveURL("/");
    await expect(directoryRows(page)).toHaveText(["Avery Ashgrove", "Brackenridge"]);
  });

  test("distinguishes an empty directory from an empty later page", async ({
    page,
    request,
  }) => {
    await useScenario(request, "empty");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "No students yet" }))
      .toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);

    await page.goto("/?cursor=page-2");
    await expect(
      page.getByRole("heading", { name: "No students on this page" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "First page" })).toBeVisible();
  });

  test("explains a rejected cursor and links back to the first page", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");

    await page.goto("/?cursor=tampered");

    await expect(
      page.getByRole("heading", { name: "This page link is invalid" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Back to first page" }).click();

    await expect(page).toHaveURL("/");
    await expect(directoryRows(page)).toHaveText(["Avery Ashgrove", "Brackenridge"]);
  });

  test("rejects a repeated cursor parameter without calling the API", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");

    await page.goto("/?cursor=page-2&cursor=page-2");

    await expect(
      page.getByRole("heading", { name: "This page link is invalid" }),
    ).toBeVisible();
    expect(await receivedRequests(request)).toEqual([]);
  });

  test("shows the unavailable state and recovers on retry", async ({
    page,
    request,
  }) => {
    await useScenario(request, "unavailable");
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "We couldn’t load the directory" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "No students yet" }))
      .toHaveCount(0);

    await useScenario(request, "populated");
    await page.getByRole("link", { name: "Try again" }).click();

    await expect(directoryRows(page)).toHaveText(["Avery Ashgrove", "Brackenridge"]);
  });

  test("submitting a search discards the previous cursor", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/?cursor=page-2");

    const search = page.getByRole("search", { name: "Student directory" });

    await search.getByRole("searchbox").fill("Velmira");
    await search.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page).toHaveURL("/?q=Velmira");
    await expect(search.getByRole("searchbox")).toHaveValue("Velmira");
    await expect(page.getByRole("link", { name: "First page" })).toHaveCount(0);

    const requests = await receivedRequests(request);
    expect(requests.at(-1)).toMatchObject({ q: "Velmira", cursor: null });
  });

  test("pagination preserves the search and clearing it resets the directory", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/?q=Velmira");

    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL("/?q=Velmira&cursor=page-2");
    await expect(directoryRows(page)).toHaveText(["Calla Cindermoor"]);

    const requests = await receivedRequests(request);
    expect(requests.at(-1)).toMatchObject({ q: "Velmira", cursor: "page-2" });

    await page.getByRole("link", { name: "First page", exact: true }).click();
    await expect(page).toHaveURL("/?q=Velmira");

    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("searchbox")).toHaveValue("");
  });

  test("distinguishes an empty search from an empty directory", async ({
    page,
    request,
  }) => {
    await useScenario(request, "empty");
    await page.goto("/?q=AbsentSyntheticValue");

    await expect(
      page.getByRole("heading", { name: "No matching students" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "No students yet" }))
      .toHaveCount(0);

    await page.getByRole("link", { name: "Clear search" }).click();

    await expect(page.getByRole("heading", { name: "No students yet" }))
      .toBeVisible();
  });

  test("rejects repeated search parameters without calling the API", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/?q=one&q=two");

    await expect(
      page.getByRole("heading", { name: "This search link is invalid" }),
    ).toBeVisible();
    expect(await receivedRequests(request)).toEqual([]);
  });

  test("retry preserves the submitted search", async ({ page, request }) => {
    await useScenario(request, "unavailable");
    await page.goto("/?q=Velmira");

    await expect(
      page.getByRole("heading", { name: "We couldn’t load the directory" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" }))
      .toHaveAttribute("href", "/?q=Velmira");

    await useScenario(request, "populated");
    await page.getByRole("link", { name: "Try again" }).click();

    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveValue("Velmira");
  });
});

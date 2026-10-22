import { expect, test, type Page } from "@playwright/test";
import { z } from "zod";
import {
  receivedRequests,
  studentListRequests,
  useScenario,
} from "./support/student-api";

function directoryRows(page: Page) {
  return page.getByRole("table").getByRole("rowheader");
}

function yearTab(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Academic year" })
    .getByRole("link", { name });
}

function searchForm(page: Page) {
  return page.getByRole("search", { name: "Student directory" });
}

test.describe("student directory", () => {
  test("lists the latest year's placements and sends correlated requests", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/");

    await expect(yearTab(page, "2026/27")).toHaveAttribute("aria-current", "page");
    await expect(yearTab(page, "2025/26")).not.toHaveAttribute("aria-current");
    await expect(page.getByText("Showing 2 students · 2026/27")).toBeVisible();
    await expect(directoryRows(page)).toHaveText(["Avery Ashgrove", "Brackenridge"]);
    await expect(page.getByRole("columnheader")).toHaveText([
      "Student",
      "Student reference",
      "Year group",
      "Class",
    ]);
    await expect(
      page.getByRole("row", { name: /Avery Ashgrove/ }).getByRole("cell"),
    ).toHaveText(["DEMO-SYN-001", "Year 7", "7A"]);
    await expect(
      page.getByRole("row", { name: /Brackenridge/ }).getByRole("cell"),
    ).toHaveText(["DEMO-SYN-002", "Year 7", "Not recorded"]);
    await expect(page.getByRole("link", { name: "First page" })).toHaveCount(0);

    const requests = await receivedRequests(request);
    expect(requests.map((received) => received.path)).toEqual([
      "/students/academic-years",
      "/students",
    ]);

    const [listRequest] = await studentListRequests(request);
    expect(listRequest).toMatchObject({
      academicYearStart: "2026",
      limit: "25",
      q: null,
      cursor: null,
    });
    for (const received of requests) {
      expect(z.uuid().safeParse(received.requestId).success).toBe(true);
    }
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

    await expect(page).toHaveURL("/?year=2026&cursor=page-2");
    await expect(directoryRows(page)).toHaveText(["Calla Cindermoor"]);
    await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.reload();

    await expect(directoryRows(page)).toHaveText(["Calla Cindermoor"]);

    await page.getByRole("link", { name: "First page", exact: true }).click();

    await expect(page).toHaveURL("/?year=2026");
    await expect(directoryRows(page)).toHaveText(["Avery Ashgrove", "Brackenridge"]);
  });

  test("changing year resets pagination and keeps the search", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/?year=2026&q=e&cursor=page-2");

    await yearTab(page, "2025/26").click();

    await expect(page).toHaveURL("/?year=2025&q=e");
    await expect(yearTab(page, "2025/26")).toHaveAttribute("aria-current", "page");
    await expect(directoryRows(page)).toHaveText(["Dorian Elmscott"]);
    await expect(searchForm(page).getByRole("searchbox")).toHaveValue("e");
    await expect(page.getByRole("link", { name: "First page" })).toHaveCount(0);

    const requests = await studentListRequests(request);
    expect(requests.at(-1)).toMatchObject({
      academicYearStart: "2025",
      q: "e",
      cursor: null,
    });
  });

  test("submitting a search keeps the year and discards the cursor", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/?year=2026&cursor=page-2");

    const search = searchForm(page);

    await search.getByRole("searchbox").fill("Velmira");
    await search.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page).toHaveURL("/?year=2026&q=Velmira");
    await expect(search.getByRole("searchbox")).toHaveValue("Velmira");
    await expect(page.getByRole("link", { name: "First page" })).toHaveCount(0);

    const requests = await studentListRequests(request);
    expect(requests.at(-1)).toMatchObject({
      academicYearStart: "2026",
      q: "Velmira",
      cursor: null,
    });
  });

  test("pagination preserves both filters and clearing search keeps the year", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.goto("/?year=2026&q=Velmira");

    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL("/?year=2026&q=Velmira&cursor=page-2");
    await expect(directoryRows(page)).toHaveText(["Calla Cindermoor"]);

    const requests = await studentListRequests(request);
    expect(requests.at(-1)).toMatchObject({
      academicYearStart: "2026",
      q: "Velmira",
      cursor: "page-2",
    });

    await page.reload();
    await expect(directoryRows(page)).toHaveText(["Calla Cindermoor"]);

    await page.getByRole("link", { name: "First page", exact: true }).click();
    await expect(page).toHaveURL("/?year=2026&q=Velmira");

    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(page).toHaveURL("/?year=2026");
    await expect(page.getByRole("searchbox")).toHaveValue("");
  });

  test("distinguishes an empty search, an empty year and an empty later page", async ({
    page,
    request,
  }) => {
    await useScenario(request, "empty");

    await page.goto("/?q=AbsentSyntheticValue");
    await expect(
      page.getByRole("cell", { name: "No students in 2026/27 match this search." }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(
      page.getByRole("cell", { name: "No students are enrolled in 2026/27." }),
    ).toBeVisible();

    await page.goto("/?year=2026&cursor=page-2");
    await expect(
      page.getByRole("cell", { name: /No students on this page/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "First page", exact: true }))
      .toBeVisible();
  });

  test("explains an organisation without enrolments", async ({ page, request }) => {
    await useScenario(request, "no-enrolments");
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "No enrolments yet" }))
      .toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(await studentListRequests(request)).toEqual([]);
  });

  test("rejects a year without enrolments and links back to the latest year", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");

    await page.goto("/?year=1999&q=Velmira");
    await expect(
      page.getByRole("heading", { name: "This academic year isn’t available" }),
    ).toBeVisible();
    expect(await studentListRequests(request)).toEqual([]);

    await page.getByRole("link", { name: "Back to latest year" }).click();
    await expect(page).toHaveURL("/?q=Velmira");
    await expect(yearTab(page, "2026/27")).toHaveAttribute("aria-current", "page");
  });

  for (const link of ["/?year=abc", "/?year=2026&year=2025"]) {
    test(`rejects ${link} without calling the API`, async ({ page, request }) => {
      await useScenario(request, "populated");
      await page.goto(link);

      await expect(
        page.getByRole("heading", { name: "This academic year isn’t available" }),
      ).toBeVisible();
      expect(await receivedRequests(request)).toEqual([]);
    });
  }

  test("explains a rejected cursor and keeps the year on the way back", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");

    await page.goto("/?year=2025&cursor=tampered");

    await expect(
      page.getByRole("heading", { name: "This page link is invalid" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Back to first page" }).click();

    await expect(page).toHaveURL("/?year=2025");
    await expect(directoryRows(page)).toHaveText(["Dorian Elmscott"]);
  });

  for (const [link, heading] of [
    ["/?cursor=page-2&cursor=page-2", "This page link is invalid"],
    ["/?q=one&q=two", "This search link is invalid"],
  ]) {
    test(`rejects ${link} without calling the API`, async ({ page, request }) => {
      await useScenario(request, "populated");
      await page.goto(link);

      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      expect(await receivedRequests(request)).toEqual([]);
    });
  }

  test("retry after a failure keeps the year and search", async ({
    page,
    request,
  }) => {
    await useScenario(request, "unavailable");
    await page.goto("/?year=2025&q=Velmira");

    await expect(
      page.getByRole("heading", { name: "We couldn’t load the directory" }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Try again" }))
      .toHaveAttribute("href", "/?year=2025&q=Velmira");

    await useScenario(request, "populated");
    await page.getByRole("link", { name: "Try again" }).click();

    await expect(directoryRows(page)).toHaveText(["Dorian Elmscott"]);
    await expect(page.getByRole("searchbox")).toHaveValue("Velmira");
    await expect(yearTab(page, "2025/26")).toHaveAttribute("aria-current", "page");
  });

  test("works by keyboard at phone width without page overflow", async ({
    page,
    request,
  }) => {
    await useScenario(request, "populated");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(directoryRows(page)).toHaveText(["Avery Ashgrove", "Brackenridge"]);

    const pageOverflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(pageOverflows).toBe(false);

    await yearTab(page, "2026/27").focus();
    await page.keyboard.press("Tab");
    await expect(yearTab(page, "2025/26")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/?year=2025");
    await expect(directoryRows(page)).toHaveText(["Dorian Elmscott"]);

    await yearTab(page, "2025/26").focus();
    await page.keyboard.press("Tab");
    const searchbox = searchForm(page).getByRole("searchbox");
    await expect(searchbox).toBeFocused();
    await page.keyboard.type("Elm");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/?year=2025&q=Elm");
    await expect(searchbox).toHaveValue("Elm");
  });
});

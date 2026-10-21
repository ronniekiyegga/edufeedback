import { expect, test, type Page } from "@playwright/test";

const desktop = { width: 1280, height: 800 };
const mobile = { width: 390, height: 844 };

function sidebarTrigger(page: Page) {
  return page
    .locator("header")
    .getByRole("button", { name: "Toggle Sidebar", includeHidden: true });
}

function desktopSidebar(page: Page) {
  return page.locator('[data-sidebar="sidebar"]:not([data-mobile])');
}

async function sidebarWidth(page: Page) {
  return (await desktopSidebar(page).locator("..").boundingBox())?.width;
}

test.describe("desktop sidebar", () => {
  test.use({ viewport: desktop });

  test("starts collapsed and toggles from the header trigger", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = sidebarTrigger(page);

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => sidebarWidth(page)).toBe(48);

    await trigger.click();

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => sidebarWidth(page)).toBe(256);
    await expect(page.getByText("Active school")).toBeVisible();
    await expect(page.getByText("Demo teacher")).toBeVisible();
  });

  test("toggles with Enter, Space and the keyboard shortcut", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = sidebarTrigger(page);

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toBeFocused();

    await page.keyboard.press("Space");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("ControlOrMeta+b");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  test("names collapsed items with a tooltip on keyboard focus", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Students" });

    await expect(link).toHaveAttribute("aria-current", "page");

    await link.focus();
    await expect(
      page.getByRole("tooltip", { name: "Students" }),
    ).toBeAttached();
    await expect(
      page.getByRole("tooltip", { name: "Students" }),
    ).toHaveCSS("color", "rgb(96, 11, 234)");

    await sidebarTrigger(page).click();
    await link.focus();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("shows the current page in the breadcrumb", async ({ page }) => {
    await page.goto("/");

    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .getByText("Students"),
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("mobile navigation", () => {
  test.use({ viewport: mobile });

  test("opens as a dialog, moves focus inside and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = sidebarTrigger(page);

    await expect(desktopSidebar(page)).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Navigation" });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      dialog.getByRole("button", { name: "Close navigation" }),
    ).toBeFocused();
    await expect(dialog.getByText("Demo teacher")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("shows the focused close control and traps Tab inside the dialog", async ({
    page,
  }) => {
    await page.goto("/");
    await sidebarTrigger(page).focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Navigation" });
    const close = dialog.getByRole("button", { name: "Close navigation" });
    const link = dialog.getByRole("link", { name: "Students" });

    await expect(close).toBeFocused();
    await expect
      .poll(async () => (await close.boundingBox())?.width)
      .toBeGreaterThan(1);

    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(sidebarTrigger(page)).toBeFocused();
  });

  test("closes after choosing a navigation link", async ({ page }) => {
    await page.goto("/");
    await sidebarTrigger(page).click();

    const dialog = page.getByRole("dialog", { name: "Navigation" });
    await dialog.getByRole("link", { name: "Students" }).click();

    await expect(dialog).toBeHidden();
  });

  test("does not reopen after resizing through the desktop layout", async ({
    page,
  }) => {
    await page.goto("/");
    await sidebarTrigger(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.setViewportSize(desktop);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => sidebarWidth(page)).toBe(48);

    await page.setViewportSize(mobile);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(sidebarTrigger(page)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

import { expect, test } from "@playwright/test";

test.describe("Desktop nav (Spec 13, AC-1, AC-2, AC-7)", () => {
  test("shows working links to Home, Models, Configurator, About, and marks the active route (AC-1, AC-7)", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });

    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Models" })).toHaveAttribute("href", "/models");
    await expect(nav.getByRole("link", { name: "Configurator" })).toHaveAttribute("href", "/configure/apex-gt");
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");

    await nav.getByRole("link", { name: "Models" }).click();
    await expect(page).toHaveURL(/\/models$/);
    await expect(nav.getByRole("link", { name: "Models" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  test("Compare shows as visibly disabled with a Coming Soon affordance, not a broken link (AC-2)", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });

    const compare = nav.locator('[role="link"][aria-disabled="true"]');
    await expect(compare).toBeVisible();
    await expect(compare).toHaveAttribute("title", "Coming soon");
    await expect(compare).not.toHaveAttribute("href");
  });
});

test.describe("Mobile nav (Spec 13, AC-3, AC-5)", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("keyboard pass: hamburger opens the menu, items are focusable in order, Escape returns focus to the toggle", async ({
    page,
  }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.focus();
    await expect(toggle).toBeFocused();

    await page.keyboard.press("Enter");
    const menu = page.getByRole("dialog", { name: "Site menu" });
    await expect(menu).toBeVisible();

    // Focus moves into the menu on open, landing on its first item.
    await expect(menu.getByRole("link", { name: "Home" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(menu.getByRole("link", { name: "Models" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  });
});

test("the skip link still lands on #main-content with Nav present (AC-6, regression against Spec 12)", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

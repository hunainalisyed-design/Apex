import { expect, test } from "@playwright/test";

test("first visit shows the hero headline promptly and Configure Your Car reaches the showroom (AC-2, AC-6)", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "BUILD YOUR VISION." })).toBeVisible({
    timeout: 5000,
  });

  // The showcase below the hero (Spec 13) also renders its own "Configure Your Car" CTA
  // (in its static fallback unconditionally, or its live scene's summary beat once
  // scrolled to) — .first() targets specifically the hero's own, matching this test's
  // documented intent ("the hero headline promptly").
  const configureLink = page.getByRole("link", { name: "Configure Your Car" }).first();
  await expect(configureLink).toBeVisible();
  await configureLink.click();

  await expect(page).toHaveURL(/\/configure\/apex-gt$/);
  expect(consoleErrors).toEqual([]);
});

test("dragging the hero vehicle responds without navigating or crashing (AC-7)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "BUILD YOUR VISION." })).toBeVisible();

  // Scoped to <main> — Nav (Spec 13) also has its own legitimate aria-hidden elements
  // (the disabled Compare item's "Soon" badge), which now precede Hero's in DOM order.
  const heroArea = page.locator("main [aria-hidden='true']").first();
  const box = await heroArea.boundingBox();
  expect(box).not.toBeNull();

  if (box) {
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY, { steps: 10 });
    await page.mouse.up();
  }

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "BUILD YOUR VISION." })).toBeVisible();
});

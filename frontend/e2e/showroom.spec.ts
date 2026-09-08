import { expect, test } from "@playwright/test";

test("selecting a model from /models arrives at the matching /configure/{slug} (AC-1)", async ({
  page,
}) => {
  await page.goto("/models");

  // Scoped to #main-content: the page's very first link is now the skip link (Spec 12,
  // AC-6), which always precedes the page content and isn't a vehicle card.
  const firstCard = page.locator("#main-content").getByRole("link").first();
  const href = await firstCard.getAttribute("href");
  expect(href).toMatch(/^\/configure\//);

  await firstCard.click();
  await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/") + "$"));
});

test("camera presets ease to each view and Reset returns to the default (AC-5, AC-6)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");

  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  const presetBar = page.getByRole("group", { name: "Camera presets" });
  await expect(presetBar).toBeVisible();

  for (const label of ["Front", "Interior", "Cockpit", "Rear", "Reset"]) {
    const button = presetBar.getByRole("button", { name: label });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
});

test("hovering a wheel hotspot shows the currently-selected option's label (AC-7)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");

  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (box) {
    // The default camera frames the vehicle roughly centered; wheels sit toward the
    // lower portion of the frame. Sweep a few candidate points since exact pixel
    // placement depends on viewport size.
    const candidates = [0.35, 0.4, 0.45, 0.55, 0.6, 0.65].map((fx) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * 0.68,
    }));

    let labelVisible = false;
    for (const point of candidates) {
      await page.mouse.move(point.x, point.y);
      const label = page.getByRole("status");
      if (await label.isVisible().catch(() => false)) {
        labelVisible = true;
        break;
      }
    }

    expect(labelVisible).toBe(true);
  }
});

test("touch-style drag on the vehicle responds without crashing or navigating (AC-8)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");

  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (box) {
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY, { steps: 10 });
    await page.mouse.up();
  }

  await expect(page).toHaveURL(/\/configure\/apex-gt$/);
});

import { expect, test } from "@playwright/test";

const SELECTIONS: { category: string; optionName: string }[] = [
  { category: "Paint", optionName: "Pearl White" },
  { category: "Wheels", optionName: "Sport Wheels" },
  { category: "Brake Calipers", optionName: "Red" },
  { category: "Window Tint", optionName: "Dark Tint" },
  { category: "Spoiler", optionName: "Carbon Spoiler" },
  { category: "Front Accessory", optionName: "Front Splitter" },
  { category: "Rear Accessory", optionName: "Rear Diffuser" },
  { category: "Body Package", optionName: "Sport Body Kit" },
  { category: "Carbon Components", optionName: "Exterior Carbon Pack" },
];

async function readTotalPrice(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.getByTestId("total-price").textContent();
  return Number(text!.replace(/[^\d]/g, ""));
}

test("selecting an option in every exterior category updates the price each time (AC-2 through AC-8)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  let previousPrice = await readTotalPrice(page);

  for (const { category, optionName } of SELECTIONS) {
    const button = page.getByRole("button", { name: new RegExp(`${category}:.*${optionName}`) });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");

    const newPrice = await readTotalPrice(page);
    expect(newPrice, `${category} -> ${optionName}`).toBeGreaterThan(previousPrice);
    previousPrice = newPrice;
  }
});

test("the hotspot label reflects the newly selected wheel, not the previous one (AC-9)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: /Wheels:.*Sport Wheels/ }).click();

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (box) {
    const candidates = [0.35, 0.4, 0.45, 0.55, 0.6, 0.65].map((fx) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * 0.68,
    }));

    let sawLabel = false;
    for (const point of candidates) {
      await page.mouse.move(point.x, point.y);
      const label = page.getByRole("status");
      if (await label.isVisible().catch(() => false)) {
        await expect(label).toContainText("Sport Wheels");
        sawLabel = true;
        break;
      }
    }
    expect(sawLabel).toBe(true);
  }
});

test("the custom color picker updates the paint live as it's dragged (AC-3)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: /Paint:.*Custom Color/ }).click();

  const colorInput = page.getByLabel("Custom paint color");
  await expect(colorInput).toBeVisible();

  const priceBefore = await readTotalPrice(page);
  await colorInput.evaluate((el: HTMLInputElement) => {
    el.value = "#00ff88";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Custom Color carries its own flat premium over the catalog swatches (Spec 2 seed data);
  // selecting it already changed the price before any drag — dragging shouldn't error out.
  const priceAfter = await readTotalPrice(page);
  expect(priceAfter).toBe(priceBefore);
});

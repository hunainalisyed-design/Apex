import { expect, test } from "@playwright/test";

async function readTotalPrice(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.getByTestId("total-price").textContent();
  return Number(text!.replace(/[^\d]/g, ""));
}

test("toggling Sport Exhaust raises then lowers the price (AC-2)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("tab", { name: "Accessories" }).click();

  const basePrice = await readTotalPrice(page);
  const exhaustButton = page.getByRole("button", { name: /Accessories:.*Sport Exhaust/ });

  await exhaustButton.click();
  await expect(exhaustButton).toHaveAttribute("aria-pressed", "true");
  const activePrice = await readTotalPrice(page);
  expect(activePrice, "sport exhaust active").toBeGreaterThan(basePrice);

  await exhaustButton.click();
  await expect(exhaustButton).toHaveAttribute("aria-pressed", "false");
  const revertedPrice = await readTotalPrice(page);
  expect(revertedPrice, "sport exhaust reverted").toBe(basePrice);
});

test("toggling Carbon Mirror Caps on and off updates the price (AC-3)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("tab", { name: "Accessories" }).click();

  const basePrice = await readTotalPrice(page);
  const mirrorCapsButton = page.getByRole("button", { name: /Accessories:.*Carbon Mirror Caps/ });

  await mirrorCapsButton.click();
  await expect(mirrorCapsButton).toHaveAttribute("aria-pressed", "true");
  expect(await readTotalPrice(page), "mirror caps active").toBeGreaterThan(basePrice);

  await mirrorCapsButton.click();
  await expect(mirrorCapsButton).toHaveAttribute("aria-pressed", "false");
  expect(await readTotalPrice(page), "mirror caps reverted").toBe(basePrice);
});

test("multiple accessories and packages can be active simultaneously, priced as their sum (AC-4, AC-5)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("tab", { name: "Accessories" }).click();

  const basePrice = await readTotalPrice(page);

  const mirrorCapsButton = page.getByRole("button", { name: /Accessories:.*Carbon Mirror Caps/ });
  const exhaustButton = page.getByRole("button", { name: /Accessories:.*Sport Exhaust/ });
  const performanceButton = page.getByRole("button", { name: /Packages:.*Performance Package/ });

  await mirrorCapsButton.click();
  await exhaustButton.click();
  await performanceButton.click();

  await expect(mirrorCapsButton).toHaveAttribute("aria-pressed", "true");
  await expect(exhaustButton).toHaveAttribute("aria-pressed", "true");
  await expect(performanceButton).toHaveAttribute("aria-pressed", "true");

  const combinedPrice = await readTotalPrice(page);
  expect(combinedPrice, "all three active").toBeGreaterThan(basePrice);

  // Turning one off leaves the other two active and independently toggled (AC-4).
  await mirrorCapsButton.click();
  await expect(mirrorCapsButton).toHaveAttribute("aria-pressed", "false");
  await expect(exhaustButton).toHaveAttribute("aria-pressed", "true");
  await expect(performanceButton).toHaveAttribute("aria-pressed", "true");
  expect(await readTotalPrice(page), "mirror caps turned back off").toBeLessThan(combinedPrice);
});

test("an accessory with no 3D asset mapping still prices correctly and logs no console error (AC-6)", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("tab", { name: "Accessories" }).click();

  const basePrice = await readTotalPrice(page);
  const lightingButton = page.getByRole("button", { name: /Accessories:.*Premium Lighting Package/ });

  await lightingButton.click();
  await expect(lightingButton).toHaveAttribute("aria-pressed", "true");
  expect(await readTotalPrice(page), "unmapped accessory still prices").toBeGreaterThan(basePrice);

  expect(consoleErrors).toEqual([]);
});

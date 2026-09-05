import { expect, test } from "@playwright/test";

async function readTotalPrice(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.getByTestId("total-price").textContent();
  return Number(text!.replace(/[^\d]/g, ""));
}

test("opening the Interior tab auto-transitions the camera to Interior (AC-5)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  const interiorPresetButton = page
    .getByRole("group", { name: "Camera presets" })
    .getByRole("button", { name: "Interior" });
  await expect(interiorPresetButton).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("tab", { name: "Interior" }).click();

  await expect(interiorPresetButton).toHaveAttribute("aria-pressed", "true");
});

test("overall finish, a single surface, and lighting each update the price (AC-2, AC-3, AC-4, AC-7)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("tab", { name: "Interior" }).click();

  let previousPrice = await readTotalPrice(page);

  const finishButton = page.getByRole("button", { name: /Overall Finish:.*Premium Leather/ });
  await finishButton.click();
  await expect(finishButton).toHaveAttribute("aria-pressed", "true");
  let newPrice = await readTotalPrice(page);
  expect(newPrice, "overall finish").toBeGreaterThan(previousPrice);
  previousPrice = newPrice;

  const seatsButton = page.getByRole("button", { name: /Seats:.*Burgundy/ });
  await seatsButton.click();
  await expect(seatsButton).toHaveAttribute("aria-pressed", "true");
  newPrice = await readTotalPrice(page);
  expect(newPrice, "seats").toBeGreaterThan(previousPrice);
  previousPrice = newPrice;

  // Recoloring the seats must not touch the dashboard's own selection.
  await expect(page.getByRole("button", { name: /Dashboard:.*Black/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const lightingButton = page.getByRole("button", { name: /Interior Lighting:.*Blue/ });
  await lightingButton.click();
  await expect(lightingButton).toHaveAttribute("aria-pressed", "true");
  newPrice = await readTotalPrice(page);
  expect(newPrice, "lighting").toBeGreaterThan(previousPrice);
});

test("selections persist across a camera/tab switch (AC-6)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("tab", { name: "Interior" }).click();

  await page.getByRole("button", { name: /Overall Finish:.*Alcantara/ }).click();
  await page.getByRole("button", { name: /Steering Wheel:.*Alcantara Sport/ }).click();

  // Switch to an exterior preset, then to the Exterior tab, then back to Interior.
  await page.getByRole("group", { name: "Camera presets" }).getByRole("button", { name: "Front" }).click();
  await page.getByRole("tab", { name: "Exterior" }).click();
  await page.getByRole("tab", { name: "Interior" }).click();

  await expect(page.getByRole("button", { name: /Overall Finish:.*Alcantara/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: /Steering Wheel:.*Alcantara Sport/ }),
  ).toHaveAttribute("aria-pressed", "true");
});

import { expect, test } from "@playwright/test";

async function readSummaryTotal(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.getByTestId("build-summary-total").textContent();
  return Number(text!.replace(/[^\d]/g, ""));
}

test("the build summary shows the three always-shown lines and explicit 'None' accessories/packages at defaults (AC-1, AC-4)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  const summary = page.getByLabel("Your build summary");
  await expect(summary.getByText("Paint: Obsidian Black")).toBeVisible();
  await expect(summary.getByText("Wheels: Standard Wheels")).toBeVisible();
  await expect(summary.getByText("Overall Finish: Standard Cloth")).toBeVisible();
  await expect(summary.getByText("Accessories: None")).toBeVisible();
  await expect(summary.getByText("Packages: None")).toBeVisible();
});

test("changing options across categories updates the summary's visible lines and total at each step (AC-2, AC-3, AC-5, AC-6)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  const summary = page.getByLabel("Your build summary");
  const baseTotal = await readSummaryTotal(page);

  // A non-default, priced category appears as its own line (AC-3).
  await page.getByRole("button", { name: /Brake Calipers:.*Red/ }).click();
  await expect(summary.getByText("Brake Calipers: Red")).toBeVisible();
  const afterCaliper = await readSummaryTotal(page);
  expect(afterCaliper, "brake caliper delta reflected").toBe(baseTotal + 450);

  // Custom Color shows its own label, not the catalog's generic option name (AC-2).
  await page.getByRole("button", { name: /Paint:.*Custom Color/ }).click();
  await expect(summary.getByText(/Paint: Custom Color/)).toBeVisible();
  const afterCustomColor = await readSummaryTotal(page);
  expect(afterCustomColor).toBe(afterCaliper + 2500);

  // An active accessory and package each replace their "None" line (AC-5).
  await page.getByRole("tab", { name: "Accessories" }).click();
  await page.getByRole("button", { name: /Accessories:.*Carbon Mirror Caps/ }).click();
  await page.getByRole("button", { name: /Packages:.*Performance Package/ }).click();
  await expect(summary.getByText("Accessories: None")).not.toBeVisible();
  await expect(summary.getByText("Packages: None")).not.toBeVisible();
  await expect(summary.getByText("Accessories: Carbon Mirror Caps")).toBeVisible();
  await expect(summary.getByText("Packages: Performance Package")).toBeVisible();
  const afterAccessoryAndPackage = await readSummaryTotal(page);
  expect(afterAccessoryAndPackage).toBe(afterCustomColor + 600 + 8000);

  // Reverting a non-default caliper back to its default removes the line entirely, not
  // just zeroes it out.
  await page.getByRole("tab", { name: "Exterior" }).click();
  await page.getByRole("button", { name: /Brake Calipers:.*Black/ }).click();
  await expect(summary.getByText(/Brake Calipers/)).not.toBeVisible();

  const finalTotal = await readSummaryTotal(page);
  expect(finalTotal).toBe(afterAccessoryAndPackage - 450);
});

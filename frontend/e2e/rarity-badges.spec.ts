import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const BACKEND_DIR = path.resolve(__dirname, "../../backend");

interface RarityFixture {
  rarePublicId: string;
  rarePaintName: string;
  rareWheelsName: string;
  defaultWheelsName: string;
}

/** Enough apex-gt builds for badges to apply (the save endpoint's rate limit rules out doing
 * this through the UI), then one aggregation run — see backend/tests/fixtures/seedRarityE2E.ts. */
function seedRarityData(): RarityFixture {
  const out = execFileSync("npx", ["tsx", "tests/fixtures/seedRarityE2E.ts"], {
    cwd: BACKEND_DIR,
    encoding: "utf8",
    shell: true,
  });
  return JSON.parse(out.trim().split("\n").pop()!) as RarityFixture;
}

test("a saved build with a rare paint + wheels pair shows its real rarity and first-of-kind badges (Spec 32)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const fixture = seedRarityData();

  await page.goto(`/configure/apex-gt?build=${fixture.rarePublicId}`);
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 60000 });
  const summary = page.getByLabel("Your build summary");

  // AC-2 / AC-4: a real percentage from the aggregation, never zero.
  const rare = summary.getByTestId("rarity-badge");
  await expect(rare).toHaveText(/^◆Only (\d+\.\d)% of Apex GT builds choose this paint and wheel combination$/);
  const percent = Number((await rare.textContent())!.match(/Only ([\d.]+)%/)![1]);
  expect(percent).toBeGreaterThan(0);
  expect(percent).toBeLessThanOrEqual(5);

  // AC-5: this build is the earliest with its pair.
  await expect(summary.getByTestId("first-of-kind-badge")).toHaveText(/First build ever with this paint and wheel combination/);

  // Switching wheels makes it a different, unsaved build: both badges go.
  await page.getByRole("button", { name: new RegExp(`Wheels:.*${fixture.defaultWheelsName}`) }).click({ timeout: 60000 });
  await expect(summary.getByTestId("rarity-badge")).toHaveCount(0);
  await expect(summary.getByTestId("first-of-kind-badge")).toHaveCount(0);

  // Back to the rare wheels: the selections match the saved build again, so both badges return.
  await page.getByRole("button", { name: new RegExp(`Wheels:.*${fixture.rareWheelsName}`) }).click({ timeout: 60000 });
  await expect(summary.getByTestId("rarity-badge")).toBeVisible();
  await expect(summary.getByTestId("first-of-kind-badge")).toBeVisible();
});

test("a common build shows no badge at all (AC-3)", async ({ page }) => {
  // Defaults are by far the most common pair in any data set. Wait for the rarity data to land.
  const rarityLoaded = page.waitForResponse((res) => res.url().includes("/combo-rarity"), { timeout: 60000 });
  await page.goto("/configure/apex-gt");
  await rarityLoaded;
  await expect(page.getByLabel("Your build summary").getByTestId("rarity-badge")).toHaveCount(0);
});

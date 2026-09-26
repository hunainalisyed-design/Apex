import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Spec 28 — dynamic environments. The Porsche is a real-model vehicle; the Apex GT uses the
// placeholder rig, so between them both rigs' floor levels are exercised.
const ENVIRONMENTS = ["Studio", "Night City", "Coastal Road", "Track"];

async function openShowroom(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main[data-scene-ready='true']")).toBeVisible({ timeout: 60000 });
}

async function chooseEnvironment(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  // The crossfade overlay is removed once the new HDRI is ready (or after its safety timeout).
  await expect(page.getByTestId("environment-crossfade")).toHaveCount(0, { timeout: 60000 });
}

/** A hash of the rendered frame, read straight from the WebGL canvas (the renderer keeps its
 * drawing buffer for Spec 11 capture) and downsampled to 64×36 — far cheaper than a Playwright
 * element screenshot, which waits for a constantly-animating canvas to settle and can time out
 * under software rendering. The pixels still come from the real render. */
async function canvasFingerprint(page: Page): Promise<string> {
  await page.waitForTimeout(1500); // let a few frames render with the new environment
  const pixels = await page.evaluate(() => {
    const source = document.querySelector("canvas")!;
    const small = document.createElement("canvas");
    small.width = 64;
    small.height = 36;
    const context = small.getContext("2d")!;
    context.drawImage(source, 0, 0, 64, 36);
    return Array.from(context.getImageData(0, 0, 64, 36).data);
  });
  return createHash("sha256").update(Uint8Array.from(pixels)).digest("hex");
}

test.describe("Dynamic environments (Spec 28)", () => {
  test.setTimeout(240000);

  test("offers all four environments, Studio selected by default (AC-1)", async ({ page }) => {
    await openShowroom(page, "/configure/porsche-992-gt3-r");
    const group = page.getByRole("group", { name: "Environment" });
    for (const name of ENVIRONMENTS) await expect(group.getByRole("button", { name, exact: true })).toBeVisible();
    await expect(group.getByRole("button", { name: "Studio", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("each environment visibly changes the rendered scene (AC-2)", async ({ page }) => {
    await openShowroom(page, "/configure/porsche-992-gt3-r");
    const fingerprints = new Set<string>();
    for (const name of ENVIRONMENTS) {
      await chooseEnvironment(page, name);
      fingerprints.add(await canvasFingerprint(page));
    }
    expect(fingerprints.size).toBe(ENVIRONMENTS.length);
  });

  test("a saved build restores its environment when loaded from the share link (AC-4)", async ({ page, browser }) => {
    await openShowroom(page, "/configure/apex-gt");
    await chooseEnvironment(page, "Night City");

    await page.getByRole("button", { name: "Save" }).click();
    const publicIdLocator = page.getByTestId("saved-public-id");
    await expect(publicIdLocator).toBeVisible({ timeout: 15000 });
    const publicId = (await publicIdLocator.textContent())!.trim();

    const freshPage = await browser.newPage();
    await openShowroom(freshPage, `/configure/apex-gt?build=${publicId}`);
    await expect(freshPage.getByRole("button", { name: "Night City", exact: true })).toHaveAttribute("aria-pressed", "true");
    await freshPage.close();
  });
});

import { expect, test, type Page } from "@playwright/test";

// Spec 27, AC-1: the "View in Your Driveway" button is progressive enhancement — shown only
// where a native AR viewer exists, absent (not disabled) everywhere else. Real devices can't
// run in CI, so each case sets the user agent and, for iOS, stubs Safari's `<a rel="ar">`
// support before any app script runs — the exact signals capability.ts reads.

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const PIXEL_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const AR_BUTTON = { name: "View in Your Driveway" };

async function stubQuickLookSupport(page: Page) {
  await page.addInitScript(() => {
    const original = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (token: string) {
      return token === "ar" ? true : original.call(this, token);
    };
  });
}

/** Waits until the configurator has hydrated, so "button absent" isn't just "not yet rendered". */
async function openConfigurator(page: Page, slug: string) {
  await page.goto(`/configure/${slug}`);
  await expect(page.getByTestId("total-price")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("tab", { name: /exterior/i })).toBeVisible();
}

test.describe("AR button visibility (Spec 27, AC-1)", () => {
  test.describe("iPhone with AR Quick Look", () => {
    test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 } });

    test("shows the button for a real-model vehicle", async ({ page }) => {
      await stubQuickLookSupport(page);
      await openConfigurator(page, "porsche-992-gt3-r");
      await expect(page.getByRole("button", AR_BUTTON)).toBeVisible();
    });

    test("hides it for a placeholder-rig vehicle", async ({ page }) => {
      await stubQuickLookSupport(page);
      await openConfigurator(page, "apex-gt");
      await expect(page.getByRole("button", AR_BUTTON)).toHaveCount(0);
    });
  });

  test.describe("Android Chrome", () => {
    test.use({ userAgent: PIXEL_UA, viewport: { width: 412, height: 915 } });

    test("shows the button for a real-model vehicle", async ({ page }) => {
      await openConfigurator(page, "lamborghini-revuelto");
      await expect(page.getByRole("button", AR_BUTTON)).toBeVisible();
    });
  });

  test.describe("desktop", () => {
    test.use({ userAgent: DESKTOP_UA });

    test("never shows the button — not even disabled", async ({ page }) => {
      await openConfigurator(page, "porsche-992-gt3-r");
      await expect(page.getByRole("button", AR_BUTTON)).toHaveCount(0);
    });
  });
});

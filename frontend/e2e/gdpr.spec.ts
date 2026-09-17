import { expect, test } from "@playwright/test";

/** Matches my-garage.spec.ts's own real-backend convention — a unique email per run avoids
 * collisions with any prior run's leftover rows. */
function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: import("@playwright/test").Page, email: string, name: string, password: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("cookie consent banner (Spec 24, AC-1/AC-2)", () => {
  test("rejecting consent dismisses the banner and the choice persists across a reload", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Cookie consent" });
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: "Reject" }).click();
    await expect(banner).not.toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Cookie consent" })).not.toBeVisible();
  });

  test("accepting consent dismisses the banner and the choice persists across a reload", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Cookie consent" });
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: "Accept" }).click();
    await expect(banner).not.toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Cookie consent" })).not.toBeVisible();
  });

  test("the privacy policy page is reachable from the banner's link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("region", { name: "Cookie consent" }).getByRole("link", { name: "See details" }).click();
    await expect(page).toHaveURL("/privacy-policy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });
});

test.describe("account data export and deletion (Spec 24, AC-5/AC-6)", () => {
  test("downloading data produces a real file, and deleting the account signs the user out for good", async ({
    page,
  }) => {
    const email = uniqueEmail("e2e-gdpr");
    const password = "gdprpass1";
    await signUp(page, email, "GDPR Tester", password);

    await page.goto("/garage");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download My Data" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^apex-my-data-.*\.json$/);

    await page.getByRole("button", { name: "Delete My Account" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account?" });
    await expect(dialog).toBeVisible();

    const confirmButton = dialog.getByRole("button", { name: "Delete Account" });
    await expect(confirmButton).toBeDisabled();

    await dialog.getByLabel("Type your account email to confirm").fill("wrong@example.com");
    await expect(confirmButton).toBeDisabled();

    await dialog.getByLabel("Type your account email to confirm").fill(email);
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(page).toHaveURL("/");

    // The session is gone for good — visiting garage again bounces to login, and the old
    // credentials no longer work (AC-6: the User row is actually deleted, not just logged out).
    await page.goto("/garage");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.getByText(/incorrect|invalid/i)).toBeVisible();
  });
});

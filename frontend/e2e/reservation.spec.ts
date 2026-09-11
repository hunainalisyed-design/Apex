import { expect, test } from "@playwright/test";

test("clicking Reserve with Deposit shows the test-mode disclosure before anything else happens (AC-1)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: "Reserve with Deposit" }).click();

  await expect(page.getByRole("heading", { name: "Reserve with Deposit" })).toBeVisible();
  await expect(page.getByText("Test Mode — No Real Payment")).toBeVisible();
  await expect(page.getByText(/no real payment will be processed/i)).toBeVisible();

  // Nothing has happened yet — still on the configurator, no request sent.
  await expect(page).toHaveURL(/\/configure\/apex-gt/);
});

test("Cancel closes the disclosure without doing anything", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: "Reserve with Deposit" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("confirming saves-if-dirty, calls the backend, and redirects to the returned checkout URL (AC-2 wiring)", async ({
  page,
}) => {
  // The real backend has no Stripe test key configured (by design, matching every other
  // external-service spec in this project) — mocked here at the network boundary so this
  // test proves the disclosure→save→API→redirect chain without depending on Stripe's real
  // network. The mocked checkoutUrl points at a LOCAL app path (not a real stripe.com URL,
  // which would hang/fail navigating in a sandboxed runner) so the real navigation can be
  // observed for real.
  await page.route("**/api/reservations/checkout-session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { checkoutUrl: "/reservations/e2e-fake-id/confirmation" } }),
    }),
  );

  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: "Reserve with Deposit" }).click();
  await page.getByRole("button", { name: "Continue to Stripe Checkout (Test Mode)" }).click();

  await page.waitForURL(/\/reservations\/e2e-fake-id\/confirmation/);
});

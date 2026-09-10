import { expect, test } from "@playwright/test";

/** fullyParallel workers share one real backend/DB — a unique email per test run avoids
 * collisions with any prior run's leftover rows (see save-share.spec.ts's own real-backend
 * convention; nothing here is mocked). */
function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

test("sign-up auto-logs in, nav reflects it, logout signs out, and login signs back in (AC-1, AC-9, AC-10)", async ({
  page,
}) => {
  const email = uniqueEmail("e2e-auth");
  const password = "e2epassword1";
  const name = "E2E Tester";

  const nav = page.getByRole("navigation", { name: "Primary" });

  await page.goto("/signup");
  await expect(nav.getByRole("link", { name: "Log In" })).toBeVisible();

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign Up" }).click();

  // Signed in — authLayout's redirect guard sends us home, and the nav now shows the
  // signed-in account area instead of Log In / Sign Up (AC-10).
  await expect(page).toHaveURL("/");
  await expect(nav.getByRole("link", { name })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Log In" })).not.toBeVisible();

  await nav.getByRole("button", { name: "Log Out" }).click();
  await expect(nav.getByRole("link", { name: "Log In" })).toBeVisible();
  await expect(nav.getByRole("link", { name })).not.toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL("/");
  await expect(nav.getByRole("link", { name })).toBeVisible();
});

test("forgot-password shows the identical generic confirmation for a real vs. a made-up email, with no email click-through (AC-6)", async ({
  page,
}) => {
  const email = uniqueEmail("e2e-forgot");

  // Register the account this test will request a reset for.
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Forgot Flow");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("originalpass1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Log Out" }).click();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  const registeredMessage = await page.getByText(/we've sent a link to reset your password/).textContent();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(uniqueEmail("e2e-never-registered"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  const unregisteredMessage = await page.getByText(/we've sent a link to reset your password/).textContent();

  // Byte-identical confirmation regardless of whether the account exists (AC-6) — this
  // spec's own allowance is that verifying the email is actually *delivered* is a
  // manual/staging concern, not an automated-test one, so there's no click-through here.
  expect(unregisteredMessage).toBe(registeredMessage);
});

test("a signed-in user visiting /login is redirected away (§5 already-signed-in guard)", async ({ page }) => {
  const email = uniqueEmail("e2e-guard");

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Guard Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("guardpass1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/login");
  await expect(page).toHaveURL("/");
});

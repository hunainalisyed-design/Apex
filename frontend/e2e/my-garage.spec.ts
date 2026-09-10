import { expect, test } from "@playwright/test";

/** fullyParallel workers share one real backend/DB — a unique email per test run avoids
 * collisions with any prior run's leftover rows (see authentication.spec.ts's own
 * real-backend convention; nothing here is mocked). */
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

async function logOut(page: import("@playwright/test").Page) {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Log Out" }).click();
}

test("save while signed in, appears in My Garage, Load->edit->Save creates a new entry leaving the original untouched, delete, then claim a guest build (AC-2 through AC-7)", async ({
  page,
}) => {
  const email = uniqueEmail("e2e-garage");
  const password = "garagepass1";
  await signUp(page, email, "Garage Owner", password);

  // Save an owned build while signed in (AC-6) — default selections, no modification yet.
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("button", { name: "Save" }).click();
  const originalPublicId = (await page.getByTestId("saved-public-id").textContent())!.trim();

  await page.goto("/garage");
  const originalCard = page.locator(".glass-panel", { has: page.locator(`a[href*="${originalPublicId}"]`) });
  await expect(originalCard).toBeVisible();
  await expect(originalCard.getByText("Apex GT")).toBeVisible();

  // Load it, modify it, and Save again (AC-3, AC-4) — this must create a NEW entry, never
  // mutate the original in place.
  await originalCard.getByRole("link", { name: "Load" }).click();
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("button", { name: /Wheels:.*Sport Wheels/ }).click();
  await page.getByRole("button", { name: "Save" }).click();
  const modifiedPublicId = (await page.getByTestId("saved-public-id").textContent())!.trim();
  expect(modifiedPublicId).not.toBe(originalPublicId);

  await page.goto("/garage");
  const stillOriginalCard = page.locator(".glass-panel", { has: page.locator(`a[href*="${originalPublicId}"]`) });
  const modifiedCard = page.locator(".glass-panel", { has: page.locator(`a[href*="${modifiedPublicId}"]`) });
  await expect(stillOriginalCard).toBeVisible();
  await expect(modifiedCard).toBeVisible();

  // The original, loaded fresh by its own publicId, never picked up the Wheels change —
  // proof it was never mutated in place (AC-4).
  await page.goto(`/configure/apex-gt?build=${originalPublicId}`);
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /Wheels:.*Sport Wheels/ })).toHaveAttribute("aria-pressed", "false");

  // Delete the second (modified) entry (AC-5).
  await page.goto("/garage");
  const toDelete = page.locator(".glass-panel", { has: page.locator(`a[href*="${modifiedPublicId}"]`) });
  await toDelete.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(`a[href*="${modifiedPublicId}"]`)).not.toBeVisible();
  await expect(page.locator(`a[href*="${originalPublicId}"]`)).toBeVisible();

  // Save a build as a GUEST (signed out), then claim it after logging back in (AC-7).
  await logOut(page);
  await page.goto("/configure/apex-rs");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("button", { name: "Save" }).click();
  const guestPublicId = (await page.getByTestId("saved-public-id").textContent())!.trim();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL("/");

  await page.goto(`/configure/apex-rs?build=${guestPublicId}`);
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await page.getByRole("button", { name: "Save to My Garage" }).click();
  await expect(page.getByText("Saved to My Garage")).toBeVisible();

  await page.goto("/garage");
  const claimedCard = page.locator(".glass-panel", { has: page.locator(`a[href*="${guestPublicId}"]`) });
  await expect(claimedCard).toBeVisible();
  await expect(claimedCard.getByText("Apex RS")).toBeVisible();
});

test("an unauthenticated visit to /garage redirects to login with a return-to, and signing in lands back on /garage (AC-1)", async ({
  page,
}) => {
  const email = uniqueEmail("e2e-garage-guard");
  const password = "guardpass1";
  await signUp(page, email, "Garage Guard", password);
  await logOut(page);

  await page.goto("/garage");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fgarage|\/login\?returnTo=\/garage/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/garage$/);
});

test("the profile forms are fully keyboard-reachable in order (AC-12)", async ({ page }) => {
  const email = uniqueEmail("e2e-garage-kbd");
  await signUp(page, email, "Keyboard User", "keyboardpass1");

  await page.goto("/garage");
  await page.getByLabel("Name").focus();
  await expect(page.getByLabel("Name")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save Name" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Current Password")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("New Password", { exact: true })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Confirm New Password")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Change Password" })).toBeFocused();
});

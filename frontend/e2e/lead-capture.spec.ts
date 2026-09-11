import { expect, test } from "@playwright/test";

test("requesting a quote on a fresh, unsaved build saves it first and shows a confirmation (AC-1, AC-2)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: "Request Quote" }).click();
  await expect(page.getByRole("heading", { name: "Request a Quote" })).toBeVisible();

  await page.getByRole("textbox", { name: "Name" }).fill("Jamie Requester");
  await page.getByRole("textbox", { name: "Email" }).fill("jamie@example.com");
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByText("We'll be in touch.")).toBeVisible({ timeout: 10000 });
});

test("booking a test drive works the same way, as a distinct request type (AC-1)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: "Book a Test Drive" }).click();
  await expect(page.getByRole("heading", { name: "Book a Test Drive" })).toBeVisible();

  await page.getByRole("textbox", { name: "Name" }).fill("Jamie Test Driver");
  await page.getByRole("textbox", { name: "Email" }).fill("jamie.driver@example.com");
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByText("We'll be in touch.")).toBeVisible({ timeout: 10000 });
});

test("shows inline validation errors for a missing name and a malformed email, submitting nothing (AC-5)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: "Request Quote" }).click();
  await page.getByRole("textbox", { name: "Email" }).fill("not-an-email");
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByText("Name is required.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Request a Quote" })).toBeVisible();
});

test("keyboard pass: the dialog's fields and actions are all reachable and operable (AC-6)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: "Request Quote" }).click();

  const nameField = page.getByRole("textbox", { name: "Name" });
  await nameField.focus();
  await expect(nameField).toBeFocused();
  await page.keyboard.type("Keyboard Jamie");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "Email" })).toBeFocused();
  await page.keyboard.type("keyboard@example.com");

  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("We'll be in touch.")).toBeVisible({ timeout: 10000 });
});

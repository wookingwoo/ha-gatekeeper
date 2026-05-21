import { expect, test } from "@playwright/test";

const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "change-this-password";

test("admin console loads and primary navigation responds", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page).toHaveTitle(/ha-gatekeeper admin/i);
  await expect(page.getByRole("heading", { name: "ha-gatekeeper" })).toBeVisible();

  const passwordInput = page.getByLabel("Admin password");
  if (await passwordInput.isVisible()) {
    await passwordInput.fill(adminPassword);
    await page.getByRole("button", { name: "Log in" }).click();
  }

  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create scoped access" })).toBeVisible();

  await page.getByRole("button", { name: "Tokens" }).click();
  await expect(page.getByRole("heading", { name: "Tokens" })).toBeVisible();

  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();

  await page.getByRole("button", { name: /Dark mode|Light mode/ }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  expect(browserErrors).toEqual([]);
});

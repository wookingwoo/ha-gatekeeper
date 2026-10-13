import { expect, type Page, test } from "@playwright/test";

async function mockConsole(page: Page) {
  await page.route("**/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data: Record<string, unknown> = {
      "/admin/me": { authenticated: true },
      "/admin/ha/entities": {
        entities: [
          {
            entityId: "light.living_room",
            domain: "light",
            name: "Living Room",
          },
        ],
      },
      "/admin/ha/services": {
        services: [{ domain: "light", services: ["turn_on", "turn_off"] }],
      },
      "/admin/clients": {
        clients: [
          {
            id: "one",
            name: "Living Room Agent",
            status: "active",
            apiKeyPrefix: "hgk_1234",
            createdAt: "2026-10-12T12:00:00Z",
            permissions: [],
          },
          {
            id: "two",
            name: "Kitchen Assistant",
            status: "disabled",
            apiKeyPrefix: "hgk_5678",
            createdAt: "2026-10-11T12:00:00Z",
            permissions: [],
          },
        ],
      },
      "/admin/audit-logs": {
        logs: [
          {
            id: "allowed",
            timestamp: "2026-10-12T12:00:00Z",
            clientName: "Living Room Agent",
            actionIdRaw: "light.turn_on",
            success: true,
          },
          {
            id: "blocked",
            timestamp: "2026-10-12T12:01:00Z",
            clientName: "Kitchen Assistant",
            actionIdRaw: "switch.turn_off",
            success: false,
            error: "permission_denied",
          },
        ],
      },
      "/admin/quick-setup": {
        apiKey: "hgk_test_token",
        client: { name: "Living Room Agent", permissions: [] },
      },
    };
    await route.fulfill({ json: { ok: true, ...(data[path] as object) } });
  });
}

test.beforeEach(async ({ page }) => {
  await mockConsole(page);
});

test("finds tokens by name and status and recovers from an empty search", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tokens", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search tokens" }).fill("kitchen");
  await expect(
    page.getByText("Kitchen Assistant", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Living Room Agent", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(page.getByText("No matching tokens")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByText("Living Room Agent", { exact: true }),
  ).toBeVisible();
});

test("filters activity by result and action", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await page.getByRole("button", { name: "Blocked", exact: true }).click();
  await expect(
    page.getByText("switch.turn_off", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("light.turn_on", { exact: true })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search activity" }).fill("light");
  await expect(page.getByText("No matching activity")).toBeVisible();
});

test("surfaces a failed token request without losing the selected permissions", async ({
  page,
}) => {
  await page.route("**/admin/quick-setup", (route) =>
    route.fulfill({ status: 500, json: { error: "server_error" } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Select entities" }).click();
  await page.getByRole("button", { name: /Living Room/ }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Token name").fill("Living Room Agent");
  await page
    .getByRole("button", { name: "Review access", exact: true })
    .click();
  await page.getByRole("button", { name: "Issue token", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not issue token");
  await expect(
    page.getByRole("button", { name: "Issue token", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Edit access", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Living Room", exact: true }),
  ).toBeVisible();
});

test("makes token selection and navigation usable on narrow screens", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Quick Start", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Select entities" }).click();
  await expect(
    page.getByRole("textbox", { name: "Search by name or entity ID" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Select entities" }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("create token starts a new setup after issuing a previous token", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Select entities" }).click();
  await page.getByRole("button", { name: /Living Room/ }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Token name").fill("Living Room Agent");
  await page
    .getByRole("button", { name: "Review access", exact: true })
    .click();
  await page.getByRole("button", { name: "Issue token", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Token issued", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tokens", exact: true }).click();
  await page.getByRole("button", { name: "Create token", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Create scoped access", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("hgk_test_token", { exact: true })).toHaveCount(
    0,
  );
});

test("shows the latest token operation error and retains a failed permissions draft", async ({
  page,
}) => {
  await page.route("**/admin/clients/one/rotate-key", (route) =>
    route.fulfill({ status: 500, json: { error: "server_error" } }),
  );
  await page.route("**/admin/clients/one/permissions", (route) =>
    route.fulfill({ status: 500, json: { error: "server_error" } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Tokens", exact: true }).click();
  const token = page
    .locator("article")
    .filter({ hasText: "Living Room Agent" });
  page.once("dialog", (dialog) => dialog.accept());
  await token.getByRole("button", { name: "Rotate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not rotate token");
  await token.getByRole("button", { name: "Edit", exact: true }).click();
  await token.getByRole("button", { name: "Select entities" }).click();
  await page
    .getByRole("button", { name: /Living Room light.living_room/ })
    .click();
  await page.keyboard.press("Escape");
  await token.getByRole("button", { name: "Save permissions" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save permissions",
  );
  await expect(
    token.getByRole("button", { name: "Living Room", exact: true }),
  ).toBeVisible();
  await expect(
    token.getByRole("button", { name: "Save permissions" }),
  ).toBeEnabled();
});

test("a newly rotated token does not inherit the previous token's copied state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => {} },
    });
  });
  let rotation = 0;
  await page.route("**/admin/clients/one/rotate-key", (route) =>
    route.fulfill({ json: { ok: true, apiKey: `hgk_rotated_${++rotation}` } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Tokens", exact: true }).click();
  const token = page
    .locator("article")
    .filter({ hasText: "Living Room Agent" });
  page.once("dialog", (dialog) => dialog.accept());
  await token.getByRole("button", { name: "Rotate", exact: true }).click();
  await page.getByRole("button", { name: "Copy token", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied!", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await token.getByRole("button", { name: "Rotate", exact: true }).click();
  await expect(page.getByText("hgk_rotated_2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy token", exact: true }),
  ).toBeVisible({ timeout: 1000 });
});

test("clipboard failure provides a manual copy fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Clipboard unavailable");
        },
      },
    });
  });
  await page.route("**/admin/clients/one/rotate-key", (route) =>
    route.fulfill({ json: { ok: true, apiKey: "hgk_rotated_test" } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Tokens", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator("article")
    .filter({ hasText: "Living Room Agent" })
    .getByRole("button", { name: "Rotate", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy token", exact: true }).click();
  await expect(
    page.getByText("Copy unavailable. Select and copy the text above."),
  ).toBeVisible();
  await expect(
    page.getByText("hgk_rotated_test", { exact: true }),
  ).toBeVisible();
});

test("a delayed clipboard result cannot mark a newer token as copied", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () =>
          new Promise<void>((resolve) => {
            (window as unknown as { finishCopy: () => void }).finishCopy =
              resolve;
          }),
      },
    });
  });
  let rotation = 0;
  await page.route("**/admin/clients/one/rotate-key", (route) =>
    route.fulfill({ json: { ok: true, apiKey: `hgk_rotated_${++rotation}` } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Tokens", exact: true }).click();
  const token = page
    .locator("article")
    .filter({ hasText: "Living Room Agent" });
  page.once("dialog", (dialog) => dialog.accept());
  await token.getByRole("button", { name: "Rotate", exact: true }).click();
  await page.getByRole("button", { name: "Copy token", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await token.getByRole("button", { name: "Rotate", exact: true }).click();
  await expect(page.getByText("hgk_rotated_2", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { finishCopy: () => void }).finishCopy(),
  );
  await expect(
    page.getByRole("button", { name: "Copy token", exact: true }),
  ).toBeVisible({ timeout: 1000 });
});

test("reviews exact access before issuing and preserves selections when editing", async ({
  page,
}) => {
  let issuedPayload: unknown = null;
  await page.route("**/admin/quick-setup", async (route) => {
    issuedPayload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        ok: true,
        apiKey: "hgk_test_token",
        client: { name: "Evening lights", permissions: [] },
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Issue token", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review access", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Token name").fill("Evening lights");
  await page.getByRole("button", { name: "Select entities" }).click();
  await page
    .getByRole("button", { name: /Living Room light.living_room/ })
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Review access", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your access", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText("light.living_room", { exact: true }),
  ).toBeVisible();
  expect(issuedPayload).toBeNull();
  await page.getByRole("button", { name: "Edit access", exact: true }).click();
  await expect(page.getByLabel("Token name")).toHaveValue("Evening lights");
  await expect(
    page.getByRole("button", { name: "Living Room", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review access", exact: true })
    .click();
  await page.getByRole("button", { name: "Issue token", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Token issued", exact: true }),
  ).toBeVisible();
  expect(issuedPayload).toEqual({
    name: "Evening lights",
    permissions: [
      {
        kind: "service",
        domain: "light",
        services: ["turn_on", "turn_off"],
        entityIds: ["light.living_room"],
        allowNoEntity: false,
      },
    ],
  });
});

test("initial mobile setup fits a short page and keeps advanced access opt-in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Review access", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThan(1100);
  await expect(
    page.getByLabel("Allow service calls without an entity target"),
  ).not.toBeVisible();
  await page.getByText("Advanced options", { exact: true }).click();
  await expect(
    page.getByLabel("Allow service calls without an entity target"),
  ).not.toBeChecked();
});

test("lets the user choose the domain to add instead of picking the first domain", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add domain", exact: true }).click();
  await page.getByLabel("Domain to add").selectOption("switch");
  await page
    .getByRole("button", { name: "Add permission group", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "switch", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /switch/, pressed: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /switch/, pressed: true }),
  ).toBeFocused({ timeout: 1000 });
});

test("mobile activity exposes request details without a wide table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/");
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  const request = page
    .locator("article")
    .filter({ hasText: "switch.turn_off" });
  await expect(request).toBeVisible({ timeout: 1000 });
  await request.getByText("Request details", { exact: true }).click();
  await expect(
    request.getByText("permission_denied", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "switch.turn_off" }),
  ).toBeVisible();
});

test("connection help closes with Escape and restores keyboard focus", async ({
  page,
}) => {
  await page.route("**/admin/ha/entities", (route) =>
    route.fulfill({ status: 502, json: { error: "ha_entities_failed" } }),
  );
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Open token guide",
    exact: true,
  });
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "Connect Home Assistant" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Connect Home Assistant" }),
  ).toHaveCount(0, { timeout: 1000 });
  await expect(trigger).toBeFocused();
});

test("review preserves explicit entity-less access and generates a matching request", async ({
  page,
}) => {
  let payload: unknown;
  await page.route("**/admin/quick-setup", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        ok: true,
        apiKey: "hgk_test_token",
        client: {
          name: "Service agent",
          permissions: (payload as { permissions: unknown }).permissions,
        },
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Token name").fill("Service agent");
  await page.getByText("Advanced options", { exact: true }).click();
  await page.getByLabel("Allow service calls without an entity target").check();
  await page
    .getByRole("button", { name: "Review access", exact: true })
    .click();
  await expect(
    page.getByText(
      "Calls without an entity target are allowed for these services.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Issue token", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Token issued", exact: true }),
  ).toBeVisible();
  expect(payload).toEqual({
    name: "Service agent",
    permissions: [
      {
        kind: "service",
        domain: "light",
        services: ["turn_on", "turn_off"],
        entityIds: [],
        allowNoEntity: true,
      },
    ],
  });
  await page.getByText("Example request", { exact: true }).click();
  await expect(page.locator("pre")).toContainText("-d '{}' ".trim());
  await expect(page.locator("pre")).not.toContainText("light.living_room");
});

test("narrow activity wraps long token names and IPv6 addresses", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const name = "A".repeat(80);
  await page.route("**/admin/audit-logs", (route) =>
    route.fulfill({
      json: {
        ok: true,
        logs: [
          {
            id: "long",
            timestamp: "2026-10-13T00:00:00Z",
            actionIdRaw: "light.turn_on",
            clientName: name,
            success: false,
            error: "permission_denied",
            ip: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByText("Request details", { exact: true }).click();
  await expect(
    page.getByText("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

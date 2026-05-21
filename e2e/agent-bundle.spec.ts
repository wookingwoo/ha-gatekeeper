import { expect, type Page, test } from "@playwright/test";

const client = {
  id: "client_1",
  name: "Living Room Agent",
  status: "active" as const,
  apiKeyPrefix: "hgk_1234",
  createdAt: "2026-05-22T00:00:00.000Z",
  permissions: [
    {
      kind: "service" as const,
      domain: "light",
      services: ["turn_on", "turn_off"],
      entityIds: ["light.living_room"],
      allowNoEntity: false
    },
    {
      kind: "state" as const,
      entityIds: ["sensor.living_room_temperature"]
    }
  ]
};

async function mockAdminApi(page: Page): Promise<void> {
  await page.route("**/admin/me", async (route) => {
    await route.fulfill({ json: { ok: true, authenticated: true } });
  });
  await page.route("**/admin/clients", async (route) => {
    await route.fulfill({ json: { ok: true, clients: [client] } });
  });
  await page.route("**/admin/audit-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/admin/ha/services", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        services: [{ domain: "light", services: ["turn_on", "turn_off", "toggle"] }]
      }
    });
  });
  await page.route("**/admin/ha/entities", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        entities: [
          { entityId: "light.living_room", domain: "light", name: "Living Room" },
          {
            entityId: "sensor.living_room_temperature",
            domain: "sensor",
            name: "Living Room Temperature"
          }
        ]
      }
    });
  });
  await page.route("**/admin/quick-setup", async (route) => {
    await route.fulfill({ json: { ok: true, client, apiKey: "hgk_live_secret" } });
  });
}

test("issued token can download an agent setup bundle and opt into live-token warning", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create scoped access", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Select entities" }).click();
  await page.getByRole("button", { name: /Living Room/ }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Issue token" }).click();
  await expect(page.getByRole("heading", { name: "Token issued", exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download agent setup bundle" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ha-gatekeeper-agent-bundle-living-room-agent.zip");

  await page.getByLabel("Include bearer token in bundle").check();
  await expect(page.getByText("This bundle contains a live bearer token")).toBeVisible();
});

test("tokens list downloads placeholder-only agent bundle", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Tokens" }).click();
  await expect(page.getByRole("heading", { name: "Tokens", exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download bundle for Living Room Agent" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ha-gatekeeper-agent-bundle-living-room-agent.zip");
});

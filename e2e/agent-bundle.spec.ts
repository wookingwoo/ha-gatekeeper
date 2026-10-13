import { expect, type Page, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

async function mockAdminApi(page: Page, publicApiBaseUrl: string | null = null): Promise<void> {
  await page.route("**/admin/me", async (route) => {
    await route.fulfill({ json: { ok: true, authenticated: true, publicApiBaseUrl } });
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

test("configured tunnel URL flows from admin metadata into both bundle downloads", async ({ page }) => {
  const publicUrl = "https://gatekeeper.example.com";
  await mockAdminApi(page, publicUrl);
  await page.goto("/");
  await page.getByRole("button", { name: "Select entities" }).click();
  await page.getByRole("button", { name: /Living Room/ }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Issue token" }).click();
  await expect(page.getByLabel("Gatekeeper API base URL")).toHaveValue(publicUrl);
  await expect(page.locator("pre")).toContainText(`${publicUrl}/api/services/light/turn_on`);
  let downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download agent setup bundle" }).click();
  let download = await downloadPromise;
  expect(await readFile((await download.path())!, "utf8")).toContain(publicUrl);
  await page.getByRole("button", { name: "Tokens" }).click();
  await expect(page.getByLabel("Gatekeeper API base URL")).toHaveValue(publicUrl);
  await page.getByLabel("Gatekeeper API base URL").fill("https://custom.example.com");
  downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download bundle for Living Room Agent" }).click();
  download = await downloadPromise;
  const archive = await readFile((await download.path())!, "utf8");
  expect(archive).toContain("https://custom.example.com");
  expect(archive).not.toContain("hgk_live_secret");
});

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

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "../prisma/schema.prisma");

export type TestDatabase = {
  databaseUrl: string;
  cleanup: () => void;
};

// Creates a disposable, schema-only SQLite file for tests that need a real Prisma client.
// `db push` (not `migrate deploy`) is correct here: this is a throwaway fixture with no
// migration history to preserve, unlike a real deployment's database.
export function createTestDatabase(): TestDatabase {
  const dir = mkdtempSync(path.join(tmpdir(), "hgk-test-"));
  const databaseUrl = `file:${path.join(dir, "test.db")}`;

  // execSync always runs through a shell, which sidesteps Windows failing to exec the
  // `npx.cmd` shim directly (EINVAL) without needing execFileSync's shell:true + args-array
  // combination (which Node warns is unescaped). schemaPath is derived from __dirname, not
  // untrusted input, so a quoted string here is safe.
  execSync(`npx prisma db push --skip-generate --schema "${schemaPath}"`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit"
  });

  return {
    databaseUrl,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ensureAddonSecrets, shellExports } from "./addonSecrets.js";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "addon-secrets-"));

  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function deterministicSecrets(...secrets: string[]): () => string {
  let index = 0;

  return () => {
    const secret = secrets[index];
    index += 1;

    if (!secret) {
      throw new Error("unexpected secret generation");
    }

    return secret;
  };
}

test("generates and persists secrets when none exist", async () => {
  await withTempDir(async (rootDir) => {
    const dataDir = join(rootDir, "data");

    const secrets = await ensureAddonSecrets(dataDir, {
      randomSecret: deterministicSecrets("session-secret", "api-key-hash-secret")
    });

    assert.deepEqual(secrets, {
      ADMIN_SESSION_SECRET: "session-secret",
      API_KEY_HASH_SECRET: "api-key-hash-secret"
    });

    const secretsPath = join(dataDir, "secrets.json");
    assert.equal(
      await readFile(secretsPath, "utf8"),
      JSON.stringify(secrets, null, 2) + "\n"
    );

    const fileMode = (await stat(secretsPath)).mode & 0o777;
    assert.equal(fileMode, 0o600);
  });
});

test("reuses existing valid secrets without generating new values", async () => {
  await withTempDir(async (dataDir) => {
    const secrets = {
      ADMIN_SESSION_SECRET: "existing-session",
      API_KEY_HASH_SECRET: "existing-api-key-hash"
    };

    await writeFile(join(dataDir, "secrets.json"), JSON.stringify(secrets), "utf8");

    assert.deepEqual(
      await ensureAddonSecrets(dataDir, {
        randomSecret: () => {
          throw new Error("should not generate");
        }
      }),
      secrets
    );
  });
});

test("normalizes permissions when reusing existing valid secrets", async () => {
  await withTempDir(async (dataDir) => {
    const secrets = {
      ADMIN_SESSION_SECRET: "existing-session",
      API_KEY_HASH_SECRET: "existing-api-key-hash"
    };
    const secretsPath = join(dataDir, "secrets.json");

    await writeFile(secretsPath, JSON.stringify(secrets), "utf8");
    await chmod(secretsPath, 0o644);

    assert.deepEqual(
      await ensureAddonSecrets(dataDir, {
        randomSecret: () => {
          throw new Error("should not generate");
        }
      }),
      secrets
    );

    const fileMode = (await stat(secretsPath)).mode & 0o777;
    assert.equal(fileMode, 0o600);
  });
});

test("regenerates and overwrites invalid existing secrets", async () => {
  await withTempDir(async (dataDir) => {
    await writeFile(
      join(dataDir, "secrets.json"),
      JSON.stringify({
        ADMIN_SESSION_SECRET: "short",
        API_KEY_HASH_SECRET: "also-short"
      }),
      "utf8"
    );

    const secrets = await ensureAddonSecrets(dataDir, {
      randomSecret: deterministicSecrets("regenerated-session", "regenerated-api-key-hash")
    });

    assert.deepEqual(secrets, {
      ADMIN_SESSION_SECRET: "regenerated-session",
      API_KEY_HASH_SECRET: "regenerated-api-key-hash"
    });

    assert.equal(
      await readFile(join(dataDir, "secrets.json"), "utf8"),
      JSON.stringify(secrets, null, 2) + "\n"
    );
  });
});

test("propagates non-ENOENT read errors", async () => {
  await withTempDir(async (dataDir) => {
    await mkdir(join(dataDir, "secrets.json"));

    await assert.rejects(
      () =>
        ensureAddonSecrets(dataDir, {
          randomSecret: () => {
            throw new Error("should not generate");
          }
        }),
      (error) => {
        assert.equal((error as NodeJS.ErrnoException).code, "EISDIR");
        return true;
      }
    );
  });
});

test("shellExports returns safely quoted POSIX shell export lines", () => {
  assert.equal(
    shellExports({
      ADMIN_SESSION_SECRET: "session'secret",
      API_KEY_HASH_SECRET: "api'hash"
    }),
    "export ADMIN_SESSION_SECRET='session'\\''secret'\nexport API_KEY_HASH_SECRET='api'\\''hash'"
  );
});

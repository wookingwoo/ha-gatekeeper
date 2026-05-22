import crypto from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type AddonSecrets = {
  ADMIN_SESSION_SECRET: string;
  API_KEY_HASH_SECRET: string;
};

const SECRET_FILE = "secrets.json";

export async function ensureAddonSecrets(
  dataDir: string,
  options: { randomSecret?: () => string } = {}
): Promise<AddonSecrets> {
  const secretsPath = join(dataDir, SECRET_FILE);
  const randomSecret = options.randomSecret ?? defaultRandomSecret;

  try {
    const existing = JSON.parse(await readFile(secretsPath, "utf8")) as unknown;

    if (isValidAddonSecrets(existing)) {
      await chmod(secretsPath, 0o600);
      return existing;
    }
  } catch (error) {
    if (!isMissingFileError(error) && !isJsonParseError(error)) {
      throw error;
    }
  }

  const secrets = {
    ADMIN_SESSION_SECRET: randomSecret(),
    API_KEY_HASH_SECRET: randomSecret()
  };

  await mkdir(dataDir, { recursive: true });
  await writeFile(secretsPath, JSON.stringify(secrets, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600
  });
  await chmod(secretsPath, 0o600);

  return secrets;
}

export function shellExports(secrets: AddonSecrets): string {
  return [
    `export ADMIN_SESSION_SECRET=${quoteForSh(secrets.ADMIN_SESSION_SECRET)}`,
    `export API_KEY_HASH_SECRET=${quoteForSh(secrets.API_KEY_HASH_SECRET)}`
  ].join("\n");
}

function defaultRandomSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function isValidAddonSecrets(value: unknown): value is AddonSecrets {
  if (!value || typeof value !== "object") {
    return false;
  }

  const secrets = value as Record<string, unknown>;

  return (
    typeof secrets.ADMIN_SESSION_SECRET === "string" &&
    secrets.ADMIN_SESSION_SECRET.length >= 8 &&
    typeof secrets.API_KEY_HASH_SECRET === "string" &&
    secrets.API_KEY_HASH_SECRET.length >= 16
  );
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

function quoteForSh(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

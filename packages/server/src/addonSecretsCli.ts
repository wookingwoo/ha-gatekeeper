import { ensureAddonSecrets, shellExports } from "./addonSecrets.js";

const dataDir = process.argv[2] ?? "/data";

try {
  const secrets = await ensureAddonSecrets(dataDir);
  process.stdout.write(shellExports(secrets) + "\n");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to ensure add-on secrets: ${message}\n`);
  process.exit(1);
}

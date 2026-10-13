import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

type TunnelLogger = { info(message: string): void; error(message: string): void };
type TunnelOptions = { command?: string; restartDelayMs?: number; shutdownTimeoutMs?: number };
export type CloudflareTunnel = { stop(): Promise<void> };

export async function startCloudflareTunnel(
  token: string,
  logger: TunnelLogger,
  options: TunnelOptions = {}
): Promise<CloudflareTunnel> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hgk-cloudflared-"));
  const tokenFile = path.join(dir, "token");
  try {
    await writeFile(tokenFile, token, { mode: 0o600 });
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }

  // Keep OS, certificate and proxy settings without giving the connector the
  // Home Assistant token, admin credentials, database URL or application secrets.
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|HOME|TMPDIR|TEMP|TMP|TZ|LANG|LC_.*|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|http_proxy|https_proxy|all_proxy|no_proxy|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS)$/.test(key)
  ));
  const initialDelay = options.restartDelayMs ?? 1000;
  let retryDelay = initialDelay;
  let child: ChildProcess | undefined;
  let childClosed: Promise<void> = Promise.resolve();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let stopping = false;
  let stopPromise: Promise<void> | undefined;

  function scheduleRestart() {
    if (stopping) return;
    retryTimer = setTimeout(launch, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  }

  function launch() {
    if (stopping) return;
    const startedAt = Date.now();
    let current: ChildProcess;
    try {
      current = spawn(options.command ?? "cloudflared", [
        "tunnel", "--no-autoupdate", "run", "--token-file", tokenFile
      ], { env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      logger.error("cloudflare_tunnel_spawn_failed");
      scheduleRestart();
      return;
    }
    child = current;
    for (const stream of [current.stdout, current.stderr]) {
      if (stream) {
        // readline joins split stream chunks before redaction.
        createInterface({ input: stream }).on("line", (line) => {
          logger.info(`cloudflared: ${line.replaceAll(token, "[REDACTED]")}`);
        });
      }
    }
    current.once("spawn", () => logger.info("cloudflare_tunnel_process_started"));
    childClosed = new Promise<void>((resolve) => {
      current.once("error", (error: NodeJS.ErrnoException) => {
        logger.error(`cloudflare_tunnel_spawn_failed: ${error.code ?? "unknown"}`);
      });
      current.once("close", (code, signal) => {
        if (child === current) child = undefined;
        resolve();
        if (stopping) return;
        logger.error(`cloudflare_tunnel_exited: ${code ?? signal ?? "unknown"}`);
        if (Date.now() - startedAt >= 60_000) retryDelay = initialDelay;
        scheduleRestart();
      });
    });
  }

  launch();
  return {
    stop() {
      stopPromise ??= (async () => {
        stopping = true;
        clearTimeout(retryTimer);
        const current = child;
        if (current) {
          current.kill("SIGTERM");
          const killTimer = setTimeout(() => current.kill("SIGKILL"), options.shutdownTimeoutMs ?? 5000);
          killTimer.unref();
          await childClosed;
          clearTimeout(killTimer);
        }
        await rm(dir, { recursive: true, force: true });
      })();
      return stopPromise;
    }
  };
}

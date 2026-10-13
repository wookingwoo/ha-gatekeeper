#!/usr/bin/env sh
set -eu
umask 077

OPTIONS_FILE="/data/options.json"

read_option() {
  key="$1"
  fallback="$2"

  node - "$OPTIONS_FILE" "$key" "$fallback" <<'NODE'
const fs = require("node:fs");

const [file, key, fallback] = process.argv.slice(2);

let options = {};
try {
  options = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  options = {};
}

const value = options[key];
if (value === undefined || value === null || value === "") {
  console.log(fallback);
} else if (typeof value === "boolean") {
  console.log(value ? "true" : "false");
} else {
  console.log(String(value));
}
NODE
}

# Only expected private data is adjusted. Reject links and special files before
# reading options or changing ownership; never recursively chown /data.
node <<'NODE'
const fs = require('node:fs');
const data = '/data';
if (!fs.existsSync(data)) fs.mkdirSync(data, {mode: 0o700});
if (!fs.lstatSync(data).isDirectory() || fs.lstatSync(data).isSymbolicLink()) throw Error('Unsafe /data directory');
// Temporarily own the directory while preparing it: no DAC_OVERRIDE needed
// when restarting with a previously UID-1000-owned, mode-0700 directory.
fs.chownSync(data, 0, 0);
fs.chmodSync(data, 0o700);
const files = ['options.json', 'secrets.json', 'ha-gatekeeper.db', 'ha-gatekeeper.db-journal', 'ha-gatekeeper.db-wal', 'ha-gatekeeper.db-shm'];
for (const name of files) {
  const path = `${data}/${name}`;
  let st; try { st = fs.lstatSync(path); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
  if (!st.isFile() || st.nlink !== 1) throw Error(`Unsafe persistent file: ${name}`);
}
for (const name of files) {
  const path = `${data}/${name}`;
  if (!fs.existsSync(path)) continue;
  fs.chmodSync(path, 0o600);
  fs.chownSync(path, name === 'options.json' ? 0 : 1000, name === 'options.json' ? 0 : 1000);
}
NODE

expose_api="$(read_option expose_api false)"
log_level="$(read_option log_level info)"


export HA_GATEKEEPER_ADDON=true
export ADDON_EXPOSE_API="$expose_api"
export LOG_LEVEL="$log_level"
export PORT=8080
export DATABASE_URL=file:/data/ha-gatekeeper.db
export CORS_ORIGIN=http://localhost:8080
export CLOUDFLARE_TUNNEL_ENABLED="$(read_option cloudflare_tunnel_enabled false)"
export CLOUDFLARE_TUNNEL_TOKEN="$(read_option cloudflare_tunnel_token '')"
export CLOUDFLARE_PUBLIC_URL="$(read_option cloudflare_public_url '')"

public_api_ip_rate_limit="$(read_option public_api_ip_rate_limit 300)"
ha_request_timeout_seconds="$(read_option ha_request_timeout_seconds 30)"
# Validate before shell arithmetic or runtime launch (including direct options edits).
ha_request_timeout_ms="$(node - "$public_api_ip_rate_limit" "$ha_request_timeout_seconds" <<'NODE'
const [rate, seconds] = process.argv.slice(2);
for (const [name, value, max] of [['public_api_ip_rate_limit', rate, 2147483647], ['ha_request_timeout_seconds', seconds, 600]]) {
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) throw Error(`Invalid ${name}: integer 1..${max} required`);
}
console.log(Number(seconds) * 1000);
NODE
)"
export PUBLIC_API_IP_RATE_LIMIT="$public_api_ip_rate_limit"
export HA_REQUEST_TIMEOUT_MS="$ha_request_timeout_ms"
# mkdtemp creates a private runtime directory; avoids trusting existing temp links.
TMPDIR="$(node -e 'const fs=require("fs"); const p=fs.mkdtempSync("/tmp/ha-gatekeeper-"); fs.chmodSync(p,0o700); fs.chownSync(p,1000,1000); console.log(p)')"
export TMPDIR
export npm_config_cache="$TMPDIR/npm-cache"
# Options have been read and validated while root owns the private directory.
# Hand over only now: root has no DAC_OVERRIDE/DAC_READ_SEARCH capability.
node -e 'require("fs").chownSync("/data",1000,1000)'
exec /usr/bin/setpriv --reuid=1000 --regid=1000 --clear-groups \
  --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs /run-user.sh

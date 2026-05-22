#!/usr/bin/env sh
set -eu

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

mkdir -p /data

expose_api="$(read_option expose_api false)"
api_port="$(read_option api_port 8080)"
log_level="$(read_option log_level info)"

case "$api_port" in
  "" | *[!0-9]*)
    echo "Invalid api_port option: $api_port" >&2
    exit 1
    ;;
esac

secrets_exports="$(node /app/packages/server/dist/addonSecretsCli.js /data)"
eval "$secrets_exports"

export HA_GATEKEEPER_ADDON=true
export ADDON_EXPOSE_API="$expose_api"
export LOG_LEVEL="$log_level"
export PORT=8080
export DATABASE_URL=file:/data/ha-gatekeeper.db
export CORS_ORIGIN=http://localhost:8080

cd /app/packages/server

npx prisma db push --skip-generate
exec node dist/index.js

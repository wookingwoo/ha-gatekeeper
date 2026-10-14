#!/usr/bin/env bash
# Repeatable local Docker behavior check. No live Cloudflare tunnel is started.
set -euo pipefail
image=${1:-ha-gatekeeper:hardening-test}
legacy_image=${LEGACY_IMAGE:-ha-gatekeeper:cloudflare-test}
bootstrap_caps=(--cap-drop ALL --cap-add CHOWN --cap-add FOWNER --cap-add SETUID --cap-add SETGID --cap-add SETPCAP)
work=$(mktemp -d /tmp/hgk-smoke.XXXXXX)
name=hgk-security-smoke-$$
docker_local() { timeout 90 env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
cleanup() {
  docker_local rm -f "$name" >/dev/null 2>&1 || true
  # Rejected unsafe paths can deliberately leave root-owned mode-0700 fixtures.
  # Remove only this generated test tree; Node rm never follows file symlinks.
  docker_local run --rm -v "$work:/smoke" --entrypoint node "$image" -e 'const fs=require("fs");for(const name of fs.readdirSync("/smoke"))fs.rmSync("/smoke/"+name,{recursive:true,force:true})' >/dev/null
  rmdir "$work"
}
trap cleanup EXIT
chmod 755 "$work"
cat > "$work/cloudflared" <<'SH'
#!/bin/sh
exec node /smoke/connector.cjs "$@"
SH
cat > "$work/connector.cjs" <<'JS'
const fs = require('fs');
const token = process.argv[process.argv.indexOf('--token-file') + 1];
if ((fs.statSync(token).mode & 0o777) !== 0o600) throw Error('token mode');
if (process.getuid() === 0) throw Error('root connector');
setInterval(() => {}, 1000);
JS
chmod 755 "$work/cloudflared"
cat > "$work/settings-check.sh" <<'SH'
#!/bin/sh
printf '%s %s %s\n' "$PUBLIC_API_IP_RATE_LIMIT" "$HA_REQUEST_TIMEOUT_MS" "$CLOUDFLARE_TUNNEL_ENABLED"
SH
chmod 755 "$work/settings-check.sh"
for mode in fresh legacy defaults; do
  mkdir "$work/$mode" "$work/tmp-$mode"
  chmod 1777 "$work/tmp-$mode"
  printf '%s\n' '{"cloudflare_tunnel_enabled":true,"cloudflare_tunnel_token":"smoke-token","cloudflare_public_url":"https://smoke.example.com","public_api_ip_rate_limit":17,"ha_request_timeout_seconds":2}' > "$work/$mode/options.json"
  if [ "$mode" = defaults ]; then printf '{}\n' > "$work/$mode/options.json"; fi
  if [ "$mode" = legacy ]; then
    docker_local run --rm -v "$work/$mode:/data" -e DATABASE_URL=file:/data/ha-gatekeeper.db --entrypoint sh "$legacy_image" -c 'node dist/addonSecretsCli.js /data >/dev/null; npx prisma db push >/dev/null; node --input-type=module -e '\''import {PrismaClient} from "@prisma/client"; const p=new PrismaClient(); await p.client.create({data:{id:"saved-client",name:"Legacy data",apiKeyHash:"stable-token-hash",apiKeyPrefix:"hgk_saved"}}); await p.$disconnect();'\''; chmod 600 /data/*'
    before=$(docker_local run --rm -v "$work/$mode:/data:ro" --entrypoint node "$image" -e 'console.log(require("crypto").createHash("sha256").update(require("fs").readFileSync("/data/secrets.json")).digest("hex"))')
  fi
  settings=$(docker_local run --rm "${bootstrap_caps[@]}" -v "$work/$mode:/data" -v "$work/settings-check.sh:/run-user.sh:ro" "$image")
  echo "$mode translated settings: $settings"
  if [ "$mode" = defaults ]; then test "$settings" = '300 30000 false'; else test "$settings" = '17 2000 true'; fi
  docker_local run "${bootstrap_caps[@]}" -d --name "$name" -v "$work/$mode:/data" -v "$work/tmp-$mode:/tmp" -v "$work:/smoke:ro" -v "$work/cloudflared:/usr/local/bin/cloudflared:ro" -e SUPERVISOR_TOKEN=smoke-supervisor "$image" >/dev/null
  ready=false
  for ((i=0; i<60; i++)); do
    if docker_local exec "$name" node -e 'fetch("http://127.0.0.1:8080/healthz",{signal:AbortSignal.timeout(2000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then ready=true; break; fi
    if [ "$(docker_local inspect -f '{{.State.Running}}' "$name")" != true ]; then break; fi
    sleep 1
  done
  if [ "$ready" != true ]; then docker_local logs "$name"; exit 1; fi
  # Inspect actual running processes rather than docker exec's default identity.
  docker_local exec --user 1000:1000 -i "$name" node - "$mode" "${before:-}" <<'JS'
const fs=require('fs'), assert=require('assert/strict'), crypto=require('crypto');
const pids=fs.readdirSync('/proc').filter(p=>/^\d+$/.test(p));
for (const marker of (process.argv[2]==='defaults' ? ['dist/index.js'] : ['dist/index.js','/smoke/connector.cjs'])) {
 const pid=pids.find(p=>{try{return fs.readFileSync(`/proc/${p}/cmdline`,'utf8').includes(marker)}catch{return false}});
 assert.ok(pid, marker);
 const status=fs.readFileSync(`/proc/${pid}/status`,'utf8');
 assert.match(status,/Uid:\s+1000\s+1000\s+1000\s+1000/);
 assert.match(status,/Gid:\s+1000\s+1000\s+1000\s+1000/);
 for(const cap of ['CapInh','CapPrm','CapEff','CapBnd','CapAmb']) assert.match(status,new RegExp(`${cap}:\\s+0+\\n`));
 assert.match(status,/NoNewPrivs:\s+1/);
 console.log(marker+': UID/GID1000, all capabilities zero, NoNewPrivs1');
}
for(const file of ['/data/secrets.json','/data/ha-gatekeeper.db']) { const s=fs.statSync(file); assert.equal(s.uid,1000); assert.equal(s.mode&0o777,0o600); }
const opts=fs.statSync('/data/options.json'); assert.equal(opts.uid,0); assert.equal(opts.mode&0o777,0o600);
assert.equal(fs.statSync('/app/packages/server/dist/index.js').uid,0);
if(process.argv[2]==='legacy') assert.equal(crypto.createHash('sha256').update(fs.readFileSync('/data/secrets.json')).digest('hex'),process.argv[3]);
JS
  docker_local exec --user 1000:1000 "$name" node -e 'const fs=require("fs"); for(const p of ["/app/packages/server/dist/index.js","/usr/local/bin/node","/data/options.json"]){try{fs.accessSync(p,p.endsWith("options.json")?fs.constants.R_OK:fs.constants.W_OK);throw Error("unexpected access: "+p)}catch(e){if(e.code!=="EACCES")throw e}}'
  if [ "$mode" = legacy ]; then
    docker_local exec --user 1000:1000 -e DATABASE_URL=file:/data/ha-gatekeeper.db "$name" node --input-type=module -e 'import assert from "node:assert/strict";import {PrismaClient} from "@prisma/client";const p=new PrismaClient();const c=await p.client.findUnique({where:{id:"saved-client"}});assert.equal(c.apiKeyHash,"stable-token-hash");assert.equal(c.name,"Legacy data");await p.$disconnect();'
  fi
  docker_local stop -t 10 "$name" >/dev/null
  test "$(docker_local inspect -f '{{.State.ExitCode}}' "$name")" = 0
  test -z "$(find "$work/tmp-$mode" -name 'hgk-cloudflared-*' -print)"
  docker_local rm "$name" >/dev/null
  echo "$mode: health, permissions, data and shutdown passed"
done
# Decimal conversion handles manually edited numeric strings without shell octal parsing.
for value in 08 030 600; do
  mkdir "$work/decimal-$value"
  printf '{"ha_request_timeout_seconds":"%s"}\n' "$value" > "$work/decimal-$value/options.json"
  settings=$(docker_local run --rm "${bootstrap_caps[@]}" -v "$work/decimal-$value:/data" -v "$work/settings-check.sh:/run-user.sh:ro" "$image")
  case "$value" in 08) expected='300 8000 false';; 030) expected='300 30000 false';; 600) expected='300 600000 false';; esac
  test "$settings" = "$expected"
  echo "decimal $value: settings translation passed"
done
# Invalid settings and hostile persistent-file types must fail before server startup.
for scenario in rate-zero rate-overflow timeout-overflow options-link secret-link db-link hardlink fifo; do
  mkdir "$work/$scenario"
  docker_local run --rm -v "$work/$scenario:/data" --entrypoint sh "$image" -c '
    case "$1" in
      rate-zero) echo "{\"public_api_ip_rate_limit\":0}" > /data/options.json;;
      rate-overflow) echo "{\"public_api_ip_rate_limit\":2147483648}" > /data/options.json;;
      timeout-overflow) echo "{\"ha_request_timeout_seconds\":601}" > /data/options.json;;
      options-link) ln -s /etc/passwd /data/options.json;;
      secret-link) ln -s /etc/passwd /data/secrets.json;;
      db-link) ln -s /etc/passwd /data/ha-gatekeeper.db;;
      hardlink) echo preserved > /data/sentinel; ln /data/sentinel /data/secrets.json;;
      fifo) mkfifo /data/secrets.json;;
    esac' sh "$scenario"
  if docker_local run --rm "${bootstrap_caps[@]}" -v "$work/$scenario:/data" -e SUPERVISOR_TOKEN=smoke-supervisor "$image" > "$work/failure.log" 2>&1; then echo "unsafe startup accepted: $scenario"; exit 1; fi
  case "$scenario" in rate-*|timeout-*) grep -q 'Invalid .*integer' "$work/failure.log";; *) grep -q 'Unsafe persistent file' "$work/failure.log";; esac
  echo "$scenario: rejected"
done
docker_local run --rm --user 1000:1000 --entrypoint /usr/local/libexec/cloudflared "$image" --version
# Real connector exercises its token-file startup path without any network.
printf '%s' 'definitely-invalid' > "$work/offline-token"
chmod 600 "$work/offline-token"
if docker_local run --rm --network none --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges -v "$work/offline-token:/tmp/offline-token:ro" --entrypoint /usr/local/libexec/cloudflared "$image" tunnel --no-autoupdate run --token-file /tmp/offline-token > "$work/offline.log" 2>&1; then echo 'invalid connector token accepted'; exit 1; fi
grep -qi 'token.*not valid\|token.*invalid' "$work/offline.log"
echo 'real cloudflared: non-root offline token-file parsing passed'

# The launcher must not silently run without the enforcing installed HA profile.
if docker_local run --rm --network none --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges --entrypoint /usr/local/bin/cloudflared "$image" --version > "$work/launcher.log" 2>&1; then echo 'unconfined launcher accepted'; exit 1; fi
grep -q 'enforcing HA Gatekeeper AppArmor stack required' "$work/launcher.log"
echo 'launcher: refuses absent enforcing HA profile'

# Check ownership on the image filesystem without test bind mounts or a running app.
docker_local run --rm --network none --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges --entrypoint node "$image" -e '
const fs=require("fs"), assert=require("node:assert/strict");
for(const path of ["/usr/local/bin/cloudflared","/usr/local/libexec/cloudflared","/run.sh","/run-user.sh"]) {
  const stat=fs.statSync(path);
  assert.equal(stat.uid,0,`${path} must be root-owned`);
  assert.equal(stat.mode&0o022,0,`${path} must not be group/world-writable`);
  assert.throws(()=>fs.accessSync(path,fs.constants.W_OK),{code:"EACCES"},`${path} must not be writable by UID 1000`);
  console.log(`${path}: root-owned, not group/world-writable, UID 1000 cannot write`);
}'

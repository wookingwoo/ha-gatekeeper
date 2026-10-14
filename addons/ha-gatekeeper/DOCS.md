# HA Gatekeeper Add-on Documentation

## Installation

1. In Home Assistant, open **Settings > Add-ons > Add-on Store**.
1. Open the add-on store menu and add this repository URL:

   ```text
   https://github.com/wookingwoo/ha-gatekeeper
   ```

1. Install **HA Gatekeeper**.
1. Start the add-on.
1. Open the web UI from the add-on page.

The configured add-on version requires a matching GHCR image to be published by the release workflow on `main`. A feature branch alone does not publish a new image. To test a feature branch before release, build `addons/ha-gatekeeper/Dockerfile` locally; existing installed images do not include unreleased features.

## Home Assistant Authentication

In add-on mode, HA Gatekeeper uses the Home Assistant Supervisor API proxy and the add-on-provided `SUPERVISOR_TOKEN`. You do not need to create or paste a Home Assistant long-lived access token.

HA Gatekeeper stores its own generated secrets and SQLite database under `/data`. Home Assistant includes add-on `/data` storage in add-on backups.

## Admin UI

The admin UI runs through Home Assistant Ingress. Open it from the HA Gatekeeper add-on page in Home Assistant.

Use the admin UI to:

- Create Gatekeeper bearer tokens.
- Limit each token to selected service calls and state reads.
- Rotate, disable, or delete tokens.
- Review the audit log.
- Download an agent setup bundle for a token.

The agent setup bundle contains endpoint details, allowed capabilities, example requests, and optional token material depending on the bundle settings. Share it only with the agent or operator that should receive that token.

## Public Gatekeeper API

Direct LAN API access and the Cloudflare Tunnel connector are disabled by default. With the default settings, the admin UI remains available through Ingress, but direct LAN calls to `/api/*` are rejected.

To enable direct access for external LAN agents:

1. In the add-on configuration, set `expose_api` to `true`.
1. In the add-on **Network** section, map container port `8080/tcp` to a host port (defaults to `4283`).
1. Restart the add-on.
1. Create or select a Gatekeeper token in the admin UI.
1. When downloading an agent setup bundle through Ingress, set **Gatekeeper API base URL** to the mapped LAN API URL, such as `http://homeassistant.local:4283`.
1. Configure the agent to use the add-on host and mapped port with the generated Gatekeeper bearer token.

Supported public API endpoints:

- `GET /api/capabilities`
- `POST /api/services/:domain/:service`
- `GET /api/states/:entityId`

Every public API request still requires `Authorization: Bearer <GATEKEEPER_TOKEN>`. HA Gatekeeper checks the token status and matching permission before forwarding service calls or state reads to Home Assistant.

Interactive Swagger/OpenAPI docs for these endpoints are served at `/api/documentation` on the same mapped LAN port (e.g. `http://homeassistant.local:4283/api/documentation`), whenever the API itself is reachable. The docs need no separate login -- the route shapes are already public in this open-source repo -- but every request the UI sends still needs a valid bearer token via its **Authorize** button.

## Cloudflare Tunnel

Use the built-in connector to share the scoped API over HTTPS while retaining the admin UI in Home Assistant Ingress. Callers receive only a URL and their Gatekeeper token; they do not need a VPN or a Cloudflare account. The operator needs a domain configured in Cloudflare and a named, remotely managed tunnel.

### One-time Cloudflare setup

1. In Cloudflare's dashboard, create a Cloudflare Tunnel and copy its connector token (the token from the `cloudflared ... --token ...` installation command).
2. Add a published application/public hostname, for example `gatekeeper.example.com`.
3. Select service type **HTTP** and service URL **`http://127.0.0.1:8081`**. `127.0.0.1` refers to this add-on's container. Port **8081** serves only the Gatekeeper API. Port **8080** serves Ingress administration and must not be used as the public origin.
4. Enable the connector in the Gatekeeper add-on options:

   ```yaml
   expose_api: false
   cloudflare_tunnel_enabled: true
   cloudflare_tunnel_token: "<YOUR_TUNNEL_CONNECTOR_TOKEN>"
   cloudflare_public_url: "https://gatekeeper.example.com"
   ```

5. Restart the add-on. Its bundled `cloudflared` establishes outbound connections; neither router forwarding nor an add-on host port mapping is needed. The network must permit cloudflared's outbound connections (normally port 7844 TCP/UDP).
6. Open the admin UI through Ingress and issue a scoped bearer token. Both setup-bundle flows default to the public URL; the URL remains editable.

`cloudflare_public_url` is an HTTPS origin, without a path, credentials, query string or fragment. The URL must match the hostname configured in Cloudflare; entering it in Gatekeeper does not create DNS or configure the tunnel. A tunnel token is not a Cloudflare API key or a Gatekeeper bearer token. It is stored in the add-on's private configuration, so treat Home Assistant backups as sensitive too.

### API boundary and verification

The loopback tunnel listener permits only:

- `GET /api/capabilities`
- `POST /api/services/:domain/:service`
- `GET /api/states/:entityId`

Other paths and methods, including `/`, `/admin/*`, `/healthz` and `/api/documentation`, return 404. Every permitted endpoint requires an active Gatekeeper token and enforces its existing permissions. The tunnel does not enable the optional LAN API.

From outside your home network, verify that:

```sh
curl -i https://gatekeeper.example.com/api/capabilities
# Expect 401 without a bearer token.

curl https://gatekeeper.example.com/api/capabilities \
  -H "Authorization: Bearer <GATEKEEPER_TOKEN>"
# Expect only the capabilities assigned to that token.

curl -i https://gatekeeper.example.com/admin/me
# Expect 404.
```

The connector keeps its token in a temporary 0600 file, passes only that file's path in process arguments, redacts the token from connector log lines, and removes the file on normal shutdown. It reconnects through cloudflared and restarts exited connector processes with a bounded backoff. Shutdown waits for resource creation, stops the connector before draining HTTP, and closes HTTP connections remaining after five seconds. Startup logs indicate a process was started, not that the Cloudflare route is connected. A connector failure leaves Ingress administration available so configuration can be corrected.

### Troubleshooting and authentication

- `cloudflare_tunnel_spawn_failed`: confirm the add-on image contains the bundled cloudflared binary.
- Repeated connector exits/authentication failures: check or rotate the tunnel connector token and restart the add-on.
- Cloudflare 502 with a healthy connector: verify the Cloudflare service URL is **HTTP `127.0.0.1:8081`**, not HTTPS or port 8080.
- 404 at `/` or `/admin/me` on the public hostname is expected; use Home Assistant Ingress for administration.
- A browser login screen instead of API JSON generally means Cloudflare Access requires interactive authentication. For the URL-plus-Gatekeeper-token workflow, do not put a browser-login policy in front of these routes. If adding Access service-token protection, the caller must also support its authentication headers; the current MCP adapter does not add those headers.
- A disconnected tunnel, home network outage, or stopped add-on makes the public API unavailable. Cloudflare Tunnel is a transport path, not a replacement server for Home Assistant.

Use a named tunnel with a stable hostname. Quick Tunnels provide temporary URLs and do not support SSE. For local stdio MCP, set `GATEKEEPER_BASE_URL` to the public HTTPS URL and `GATEKEEPER_TOKEN` to a scoped token. Cloud-hosted clients that require an HTTP MCP URL need an additional HTTP MCP server; this release exposes the REST API only.

References: [Cloudflare setup](https://developers.cloudflare.com/tunnel/get-started/), [connector tokens](https://developers.cloudflare.com/tunnel/reference/tunnel-tokens/), [network requirements](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/).

## Security Notes

- Keep the public API port disabled unless a trusted LAN agent needs it.
- Share only Gatekeeper-issued bearer tokens with agents, never Home Assistant credentials.
- Give each token the smallest service and entity permissions it needs.
- Rotate or delete tokens when an agent is retired, compromised, or no longer needs access.
- Treat downloaded agent setup bundles as sensitive if they include a live token.

## Runtime protection and limits

`public_api_ip_rate_limit` defaults to **300 requests per IP per minute** (integer 1..2147483647). It bounds public API traffic before authentication, including failed token attempts; the existing token budget also applies after authentication. LAN callers are identified by the socket address. Only the dedicated tunnel loopback listener trusts a valid `CF-Connecting-IP`; ordinary forwarded headers never override a LAN caller's identity. Keep the connector's service URL at `http://127.0.0.1:8081` and do not expose that listener through another local proxy.

`ha_request_timeout_seconds` defaults to **30 seconds** (integer 1..600). It bounds waiting for Home Assistant response headers and bodies, and shutdown cancels pending upstream requests. A timed-out or canceled service call may already have executed in Home Assistant; check state before retrying. Standalone deployments use `HA_REQUEST_TIMEOUT_MS` (1..2147483647) and `PUBLIC_API_IP_RATE_LIMIT`.

Startup briefly uses root to prepare only known `/data` files, then migrations, the server and connector run as UID/GID 1000 with all Linux capabilities removed and no-new-privs enabled. Existing valid root-owned secrets and SQLite files are reassigned without changing their contents, preserving issued tokens. The data directory is private (0700), secrets and database files are 0600, and Supervisor options remain root-owned 0600. Unexpected links, hard links or special files at known data paths stop startup for operator repair; restore valid files from a backup rather than relaxing permissions. Back up `/data` before upgrading. Application code and binaries remain root-owned.

The bundled enforce-mode AppArmor profile narrows file access. A root-owned native launcher reads the installed enforcing profile name and asks the kernel to stack its connector child before executing cloudflared, without `/data`, application code, shell execution or parent process environment/memory access. AppArmor does **not** filter destination IPs or provide complete isolation of all processes sharing a UID. External VLAN/firewall rules are still required to contain LAN access from this add-on. Keep Home Assistant's protection mode enabled; no extra host mounts or privileged capabilities are required.

Before production, verify that the actual Home Assistant host advertises AppArmor `domain/stack` and `domain/post_nnp_subset` support under `/sys/kernel/security/apparmor/features/`. Inspect the server and connector's `/proc/<pid>/attr/apparmor/current` from the host (the server should show the Supervisor-installed profile in `enforce`, and cloudflared both that parent profile and its `//cloudflared` subprofile, joined by `//&` in the label). The launcher preserves no-new-privs and refuses to launch without the enforcing HA Gatekeeper profile or if stacking its child fails. AppArmor enforcement on Home Assistant is therefore required for the tunnel; there is no parent-only or unconfined fallback. Treat an absent child label as failed verification and keep tunnel access disabled until repaired. Check Supervisor/host logs for AppArmor denials while exercising Ingress, fresh and upgrade migrations, public API, connector startup and shutdown. Confirm connector reads of `/data/secrets.json` and parent `/proc/<server-pid>/environ`, and execution of a shell or the launcher, are denied. Verify Go SIGURG preemption and normal TERM shutdown without denials. The server label must remain the parent only. The development Docker kernel lacks AppArmor support, so offline parser validation alone does not establish kernel enforcement or runtime compatibility. Do not switch to complain mode to pass verification.

For local packaging verification, build the image with the add-on Dockerfile and run `addons/ha-gatekeeper/scripts/security-smoke.sh <image>`. The script uses the explicit local Docker socket and a temporary fake connector, checks fresh/default/legacy startup with only CHOWN/FOWNER/SETUID/SETGID/SETPCAP bootstrap capabilities, and runs the real connector ELF directly only for version and offline invalid-token checks. It also verifies that the launcher refuses an absent enforcing HA profile. Set `LEGACY_IMAGE` to the previous root-based image for the upgrade fixture. The checks have per-command deadlines and clean up their own containers and temporary files. They do not exercise AppArmor enforcement or provision a live Cloudflare route.

Run `python3 addons/ha-gatekeeper/scripts/launcher-test.py` for native launcher boundary checks and `python3 addons/ha-gatekeeper/scripts/apparmor-regression.py` for offline parser and pinned Supervisor/OS Agent loader checks (requires the local `ha-gatekeeper:apparmor-parser` image with AppArmor 3.0.8). The latter substitutes the supported AppArmor 3.0 kernel feature ABI for the development host’s absent kernel interface, without overriding the policy ABI. It verifies both original and renamed compiled profile names and rejects named exec transition tables; stacking uses the kernel process-attribute protocol instead. These checks do not replace enforcing-host validation.

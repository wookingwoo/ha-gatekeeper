# HA Gatekeeper

HA Gatekeeper issues scoped, audited bearer tokens for Home Assistant service calls and state reads. Each Gatekeeper token can be limited to specific services, entities, and state-read permissions, so agents and automations do not need broad Home Assistant access.

In Home Assistant add-on mode, HA Gatekeeper talks to Home Assistant through the Supervisor API proxy with the add-on-provided `SUPERVISOR_TOKEN`. No Home Assistant long-lived access token is required.

The add-on provides:

- An Ingress admin console inside Home Assistant.
- Per-token permissions for Home Assistant service calls and state reads.
- Token rotation and deletion from the admin UI.
- An audit log for accepted and rejected Gatekeeper API requests.
- Optional LAN API exposure on container port `8080/tcp` for trusted agents.

The public Gatekeeper API is disabled by default. Enable it only when a trusted LAN agent needs to call HA Gatekeeper directly, and always use a generated Gatekeeper bearer token with the matching permissions.

## Runtime protection and limits

`public_api_ip_rate_limit` defaults to **300 requests per IP per minute** (integer 1..2147483647). It bounds public API traffic before authentication, including failed token attempts; the existing token budget also applies after authentication. LAN callers are identified by the socket address. Only the dedicated tunnel loopback listener trusts a valid `CF-Connecting-IP`; ordinary forwarded headers never override a LAN caller's identity. Keep the connector's service URL at `http://127.0.0.1:8081` and do not expose that listener through another local proxy.

`ha_request_timeout_seconds` defaults to **30 seconds** (integer 1..600). It bounds waiting for Home Assistant response headers and bodies, and shutdown cancels pending upstream requests. A timed-out or canceled service call may already have executed in Home Assistant; check state before retrying. Standalone deployments use `HA_REQUEST_TIMEOUT_MS` (1..2147483647) and `PUBLIC_API_IP_RATE_LIMIT`.

Startup briefly uses root to prepare only known `/data` files, then migrations, the server and connector run as UID/GID 1000 with all Linux capabilities removed and no-new-privs enabled. Existing valid root-owned secrets and SQLite files are reassigned without changing their contents, preserving issued tokens. The data directory is private (0700), secrets and database files are 0600, and Supervisor options remain root-owned 0600. Unexpected links, hard links or special files at known data paths stop startup for operator repair; restore valid files from a backup rather than relaxing permissions. Back up `/data` before upgrading. Application code and binaries remain root-owned.

The bundled enforce-mode AppArmor profile narrows file access. A root-owned native launcher reads the installed enforcing profile name and asks the kernel to stack its connector child before executing cloudflared, without `/data`, application code, shell execution or parent process environment/memory access. AppArmor does **not** filter destination IPs or provide complete isolation of all processes sharing a UID. External VLAN/firewall rules are still required to contain LAN access from this add-on. Keep Home Assistant's protection mode enabled; no extra host mounts or privileged capabilities are required.

Before production, verify that the actual Home Assistant host advertises AppArmor `domain/stack` and `domain/post_nnp_subset` support under `/sys/kernel/security/apparmor/features/`. Inspect the server and connector's `/proc/<pid>/attr/apparmor/current` from the host (the server should show the Supervisor-installed profile in `enforce`, and cloudflared both that parent profile and its `//cloudflared` subprofile, joined by `//&` in the label). The launcher preserves no-new-privs and refuses to launch without the enforcing HA Gatekeeper profile or if stacking its child fails. AppArmor enforcement on Home Assistant is therefore required for the tunnel; there is no parent-only or unconfined fallback. Treat an absent child label as failed verification and keep tunnel access disabled until repaired. Check Supervisor/host logs for AppArmor denials while exercising Ingress, fresh and upgrade migrations, public API, connector startup and shutdown. Confirm connector reads of `/data/secrets.json` and parent `/proc/<server-pid>/environ`, and execution of a shell or the launcher, are denied. Verify Go SIGURG preemption and normal TERM shutdown without denials. The server label must remain the parent only. The development Docker kernel lacks AppArmor support, so offline parser validation alone does not establish kernel enforcement or runtime compatibility. Do not switch to complain mode to pass verification.

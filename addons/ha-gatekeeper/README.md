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

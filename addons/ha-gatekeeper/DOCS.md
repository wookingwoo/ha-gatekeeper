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

The first install requires the GHCR image for add-on version `0.1.0` to be published by the release workflow after this add-on packaging is merged to `main`. A branch containing the add-on files is not enough by itself if the matching `ghcr.io/wookingwoo/ha-gatekeeper:0.1.0` image has not been published yet.

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

The public Gatekeeper API is disabled by default in add-on mode. With the default settings, the admin UI remains available through Ingress, but direct LAN calls to `/api/*` are rejected.

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

## Security Notes

- Keep the public API port disabled unless a trusted LAN agent needs it.
- Share only Gatekeeper-issued bearer tokens with agents, never Home Assistant credentials.
- Give each token the smallest service and entity permissions it needs.
- Rotate or delete tokens when an agent is retired, compromised, or no longer needs access.
- Treat downloaded agent setup bundles as sensitive if they include a live token.

# Changelog

## 0.3.0

- Added public per-IP request and Home Assistant timeout settings, trusted tunnel IP handling, and canceled upstream requests.
- Run migrations, server and connector without root or capabilities, preserving legacy private data on upgrade.
- Added an enforce-mode AppArmor profile with a separate connector subprofile, a fail-closed native stacking launcher, and minimal-capability Docker security smoke checks; tunnel startup requires verified enforcement on Home Assistant.

- Added an optional bundled Cloudflare Tunnel connector for public HTTPS API access without router port forwarding or a separate tunnel add-on.
- Added an API-only loopback listener on port 8081 that keeps admin, static and documentation routes out of the tunnel and retains scoped token enforcement.
- Added connector token-file authentication, log redaction, process restart and shutdown cleanup.
- Added a configured public URL to issued-token examples and both agent setup bundle downloads, with English and Korean add-on option descriptions.
- Kept direct LAN API exposure independently configurable and disabled by default.

## 0.2.0

- Fixed a duplicated `/api` path segment when calling the Home Assistant Core API through the
  Supervisor proxy in add-on mode, which caused entities and services to fail to load.
- Defaulted the optional LAN agent API host port to `4283` instead of leaving it unmapped, and
  fixed the dashboard's agent bundle download to suggest that port instead of the old `8080`.
- Added interactive Swagger/OpenAPI docs for the public Gatekeeper API at `/api/documentation`,
  reachable under the same conditions as the API itself.
- Marked the add-on as stable so it's visible in the add-on store without Advanced Mode.

## 0.1.0

- Initial custom Home Assistant add-on packaging.
- Added Home Assistant Ingress UI support.
- Added Supervisor API mode using the add-on `SUPERVISOR_TOKEN`.
- Persisted generated secrets and SQLite data under `/data`.
- Added optional public Gatekeeper API exposure for trusted LAN agents.
- Added GHCR image publishing workflow for add-on releases.

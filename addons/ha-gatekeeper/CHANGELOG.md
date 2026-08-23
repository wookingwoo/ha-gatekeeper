# Changelog

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

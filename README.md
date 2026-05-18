# ha-gatekeeper

A single-container API gateway for Home Assistant service calls that allows limited, audited access without exposing a long-lived access token.

## Key Features

- Home Assistant compatible service API shape
- Bearer token based public service calls
- Role-based access control (RBAC)
- Audit log storage and query
- Admin dashboard with session login
- Single-container deployment

## Screenshots

![Admin Dashboard (placeholder)](docs/assets/screenshot-admin-dashboard.png)

Placeholder image. Replace this file with a real screenshot when ready.

## Local Development

1. Install dependencies.

```bash
npm install
```

1. Configure environment variables for the server in `packages/server/.env`.

```bash
PORT=8080
DATABASE_URL="file:./prisma/dev.db"
HA_BASE_URL="http://homeassistant.local:8123"
HA_TOKEN="YOUR_HA_LONG_LIVED_TOKEN"
ADMIN_PASSWORD="change-this-password"
ADMIN_SESSION_SECRET="base64-32bytes-minimum"
API_KEY_HASH_SECRET="change-this-secret"
CORS_ORIGIN="http://localhost:5173"
```

1. Initialize the database.

```bash
npm run prisma:generate
npm run prisma:migrate
```

1. Start the dev servers.

```bash
npm run dev
```

Admin UI: http://localhost:5173
API: http://localhost:8080

### Environment Notes

- `ADMIN_SESSION_SECRET` must be a base64 string of at least 32 bytes. Example: `openssl rand -base64 32`.
- `API_KEY_HASH_SECRET` should be a strong, random secret.
- `HA_TOKEN` is a Home Assistant long-lived access token. Keep it private.

## Docker

```bash
docker build -t ha-gatekeeper .
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e DATABASE_URL="file:/data/dev.db" \
  -e HA_BASE_URL="http://homeassistant.local:8123" \
  -e HA_TOKEN="YOUR_HA_LONG_LIVED_TOKEN" \
  -e ADMIN_PASSWORD="change-this-password" \
  -e ADMIN_SESSION_SECRET="base64-32bytes-minimum" \
  -e API_KEY_HASH_SECRET="change-this-secret" \
  -v $(pwd)/data:/data \
  ha-gatekeeper
```

## Public API

`POST /api/services/:domain/:service`

- Header: `Authorization: Bearer <GATEKEEPER_CLIENT_KEY>`
- Body: Home Assistant service data, including `entity_id` or `target.entity_id`
- Response: Home Assistant response status and body are passed through

Example:

```bash
curl -X POST http://localhost:8080/api/services/light/turn_on \
  -H "Authorization: Bearer <GATEKEEPER_CLIENT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"entity_id":"light.living_room"}'
```

Gatekeeper only exposes service calls that match an active service policy for the client role. Requests using unsupported targets such as `area_id` or `device_id`, missing entity IDs, or entities outside the policy allowlist are rejected before reaching Home Assistant. Entity-less services must be explicitly enabled in the policy.

## Admin API

- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin/roles`
- `POST /admin/roles`
- `GET /admin/actions` (service policies)
- `POST /admin/actions` (service policies)
- `GET /admin/clients`
- `POST /admin/clients`
- `POST /admin/clients/:id/rotate-key`
- `GET /admin/audit-logs`

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and PR guidelines. By participating, you agree to the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

Licensed under the MIT License. See [LICENSE](LICENSE).

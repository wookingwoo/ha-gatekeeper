# ha-gatekeeper

Home Assistant Long-Lived Access Token을 외부에 노출하지 않고, 제한된 Action만 실행하는 단일 서버형 API Gateway.

## 핵심 기능

- API Key 기반 Public Action 호출
- Role 기반 권한 제어
- Audit Log 저장/조회
- Admin Dashboard (세션 로그인)
- 단일 컨테이너 배포

## 로컬 개발

```bash
npm install
```

### 환경 변수

`packages/server/.env`에 아래 값을 설정하세요.

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

### DB 초기화

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 개발 서버

```bash
npm run dev
```

- Admin UI: http://localhost:5173
- API: http://localhost:8080

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

`POST /v1/actions/:actionId`

- Header: `X-API-Key`
- 응답: 실행 요약만 반환 (HA 내부 구조 노출 없음)

## Admin API

- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin/roles`
- `POST /admin/roles`
- `GET /admin/actions`
- `POST /admin/actions`
- `GET /admin/clients`
- `POST /admin/clients`
- `POST /admin/clients/:id/rotate-key`
- `GET /admin/audit-logs`

FROM node:24-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/package.json
COPY packages/web/package.json ./packages/web/package.json
COPY packages/mcp/package.json ./packages/mcp/package.json

RUN npm ci

COPY packages ./packages

RUN npm run prisma:generate -w packages/server
RUN npm run build

FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

RUN useradd --system --uid 1001 gatekeeper \
  && mkdir -p /data \
  && chown -R gatekeeper:gatekeeper /app /data

WORKDIR /app/packages/server
EXPOSE 8080
USER gatekeeper

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["sh", "-c", "if ! npx prisma migrate deploy; then npx prisma migrate resolve --applied 20260208081112_init && npx prisma migrate resolve --applied 20260519131500_token_permissions && npx prisma migrate deploy; fi && node dist/index.js"]

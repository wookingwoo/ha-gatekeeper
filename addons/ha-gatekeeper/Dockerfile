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

FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ARG BUILD_VERSION=0.1.0

LABEL \
  io.hass.version="${BUILD_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="aarch64|amd64"

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app /app
COPY addons/ha-gatekeeper/run.sh /run.sh

RUN sed -i 's/\r$//' /run.sh && chmod 755 /run.sh

WORKDIR /app/packages/server

EXPOSE 8080

CMD ["/run.sh"]

FROM cloudflare/cloudflared:2026.10.0 AS cloudflared

FROM node:24-bookworm-slim AS launcher
RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc libc6-dev \
  && rm -rf /var/lib/apt/lists/*
COPY addons/ha-gatekeeper/cloudflared-launcher.c /src/cloudflared-launcher.c
RUN cc -O2 -Wall -Wextra -Werror -D_FORTIFY_SOURCE=2 -fstack-protector-strong \
  -Wl,-z,relro,-z,now -o /cloudflared /src/cloudflared-launcher.c

FROM node:24-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/package.json
COPY packages/web/package.json ./packages/web/package.json
COPY packages/mcp/package.json ./packages/mcp/package.json

RUN --mount=type=secret,id=proxy_ca \
  if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
  npm ci

COPY packages ./packages

RUN --mount=type=secret,id=proxy_ca \
  if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
  npm run prisma:generate -w packages/server
RUN npm run build

FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ARG BUILD_VERSION=0.3.0

LABEL \
  io.hass.version="${BUILD_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="aarch64|amd64"

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app /app
COPY --from=cloudflared --chown=0:0 /usr/local/bin/cloudflared /usr/local/libexec/cloudflared
COPY --from=launcher /cloudflared /usr/local/bin/cloudflared
COPY addons/ha-gatekeeper/run.sh /run.sh
COPY addons/ha-gatekeeper/run-user.sh /run-user.sh

# Normalize source directory modes copied from the build context for UID 1000.
RUN chmod -R a+rX,go-w /app \
  && sed -i 's/\r$//' /run.sh /run-user.sh && chmod 755 /run.sh /run-user.sh

WORKDIR /app/packages/server

EXPOSE 8080

CMD ["/run.sh"]

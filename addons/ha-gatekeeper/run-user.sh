#!/usr/bin/env sh
set -eu
umask 077
secrets_exports="$(node /app/packages/server/dist/addonSecretsCli.js /data)"
eval "$secrets_exports"
cd /app/packages/server
prisma_cli="$(node -p 'require.resolve("prisma/build/index.js")')"

# Existing installs were provisioned with `prisma db push`, which never wrote Prisma's
# migration-history table. A bare `migrate deploy` against such a database fails (P3005,
# "database schema is not empty"). Baseline it once, then retry; fresh installs take the
# fast path on the first attempt every time.
if ! node "$prisma_cli" migrate deploy; then
  node "$prisma_cli" migrate resolve --applied 20260208081112_init
  node "$prisma_cli" migrate resolve --applied 20260519131500_token_permissions
  node "$prisma_cli" migrate deploy
fi

exec node dist/index.js

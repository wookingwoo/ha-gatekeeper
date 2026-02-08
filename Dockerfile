FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json ./
COPY packages/server/package.json ./packages/server/package.json
COPY packages/web/package.json ./packages/web/package.json

RUN npm install

COPY packages ./packages

RUN npm run prisma:generate -w packages/server
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

WORKDIR /app/packages/server
EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]

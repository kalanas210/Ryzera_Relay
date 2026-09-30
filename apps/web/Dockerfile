# syntax=docker/dockerfile:1.7
# Relay web: the React PWA, built with pnpm and served by Caddy, which also proxies /api to the API.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY e2e/package.json e2e/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @relay/web
COPY apps/web apps/web
RUN pnpm --filter @relay/web build

FROM caddy:2-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 80 443

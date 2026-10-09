# Build context is the REPO ROOT — the web app depends on the
# @seat-booker/contracts workspace package. See docker-compose.yml.

# ---- Stage 1: build -----------------------------------------------------------
FROM node:24-bookworm-slim AS build

RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/tsconfig/package.json ./packages/tsconfig/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/web ./apps/web

# Vite inlines import.meta.env at BUILD time, so the API URL cannot be supplied
# as a runtime container env var — it has to be a build arg. The value is the URL
# the BROWSER will use (the published host port), not an in-network service name:
# the request is made by the user's browser, which has no access to Docker DNS.
ARG VITE_API_BASE_URL="http://localhost:3000/api"
ARG VITE_CENTRE_TIMEZONE="Asia/Colombo"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CENTRE_TIMEZONE=$VITE_CENTRE_TIMEZONE

RUN pnpm --filter @seat-booker/contracts build \
 && pnpm --filter @seat-booker/web build

# ---- Stage 2: serve -----------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

# 5173 rather than 80, to match the port the README and CORS config already use.
EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]

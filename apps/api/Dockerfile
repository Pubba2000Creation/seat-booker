# Build context is the REPO ROOT, not apps/api — the API depends on the
# @seat-booker/contracts workspace package, which must be built from the same
# pnpm workspace. See docker-compose.yml (`context: .`).

# ---- Stage 1: dependencies ----------------------------------------------------
# Debian-based rather than Alpine: bcrypt ships prebuilt binaries for glibc, and
# on musl it falls back to compiling from source, which needs a full toolchain.
FROM node:24-bookworm-slim AS deps

RUN corepack enable

WORKDIR /repo

# Only the manifests first, so this layer caches and `pnpm install` re-runs just
# when a dependency actually changes rather than on every source edit.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/tsconfig/package.json ./packages/tsconfig/

RUN pnpm install --frozen-lockfile

# ---- Stage 2: build -----------------------------------------------------------
FROM deps AS build

WORKDIR /repo

COPY packages ./packages
COPY apps/api ./apps/api

# contracts before api: the API imports its built output, not its source.
RUN pnpm --filter @seat-booker/contracts build \
 && pnpm --filter @seat-booker/api build


# ---- Stage 3: runtime ---------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

RUN corepack enable

ENV NODE_ENV=production

WORKDIR /repo

# The whole workspace tree: the API's node_modules contains pnpm symlinks into
# the store and into packages/contracts, so the layout has to be preserved.
COPY --from=build /repo ./

WORKDIR /repo/apps/api

COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# Runs migrations and the seed, then execs the server. Idempotent, so a container
# restart does not duplicate data.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]

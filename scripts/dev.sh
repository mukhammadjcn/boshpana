#!/usr/bin/env bash
# Local dev orchestrator. One command boots the infra Docker needs, syncs the
# Prisma schema against the dev DB, and starts API + Web in watch mode.
#
# Usage:
#   yarn dev          # everything (postgres, redis, schema sync, api, web)
#   yarn dev:api      # only the API watcher (assumes infra is already up)
#   yarn dev:web      # only the Next dev server
#   yarn db:push      # re-apply schema.prisma to the dev DB without restarting
#
# Prod is untouched: docker-compose.prod.yml + apps/api start script run their
# own `prisma db push` on container boot.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Override DATABASE_URL for local CLI access — the root .env points at the
# Docker service hostname (`postgres`) which only resolves inside the network.
# Host port is 5433 by default to avoid clashing with a local brew postgres
# bound to 5432. Override with POSTGRES_HOST_PORT=… when needed.
LOCAL_DB_URL="postgresql://bunker:bunker@localhost:${POSTGRES_HOST_PORT:-5433}/bunker?schema=public"
LOCAL_REDIS_URL="redis://localhost:6379"

step() { printf "\n\033[1;36m→ %s\033[0m\n" "$1"; }

step "Booting postgres + redis (idempotent)..."
docker compose up -d postgres redis >/dev/null

step "Waiting for postgres to accept connections..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U bunker -d bunker >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

step "Syncing prisma schema (db push)..."
(
  cd apps/api
  DATABASE_URL="$LOCAL_DB_URL" \
    env XDG_CACHE_HOME=../../.cache \
    npx prisma db push --skip-generate
)

step "Starting api + web (watch mode). Ctrl+C to stop."
# `kill 0` on Ctrl+C tears down the whole process group cleanly. We use plain
# `wait` (no -n) so this also runs on macOS's default bash 3.2 — if one child
# crashes you'll see it in the merged stdout, Ctrl+C still cleans both up.
trap 'kill 0' EXIT INT TERM

(
  cd apps/api
  # ENABLE_DEV_AUTH=1 surfaces the /api/auth/dev-login shortcut so you don't
  # need a real Telegram bot token in local dev. The Docker compose stack
  # sets the same default; the prod compose leaves it unset.
  DATABASE_URL="$LOCAL_DB_URL" \
    REDIS_URL="$LOCAL_REDIS_URL" \
    ENABLE_DEV_AUTH="${ENABLE_DEV_AUTH:-1}" \
    yarn dev
) &
API_PID=$!

(
  cd apps/web
  # Mirrors the API flag — the login page only renders the dev-login button
  # when this is set at build / dev time.
  NEXT_PUBLIC_ENABLE_DEV_AUTH="${NEXT_PUBLIC_ENABLE_DEV_AUTH:-1}" \
    yarn dev
) &
WEB_PID=$!

wait "$API_PID" "$WEB_PID"

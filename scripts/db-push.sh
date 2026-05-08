#!/usr/bin/env bash
# Re-apply schema.prisma to the local dev DB without restarting the API
# watcher. Use when you change schema.prisma mid-session.
#
# Usage:
#   yarn db:push
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"

DATABASE_URL="postgresql://bunker:bunker@localhost:${POSTGRES_HOST_PORT:-5433}/bunker?schema=public" \
  env XDG_CACHE_HOME=../../.cache \
  npx prisma db push

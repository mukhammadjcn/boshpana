#!/usr/bin/env bash
# Production deploy script.
# Run on the server: bash /opt/bunker/scripts/update.sh
#
# What it does:
#   1. git pull origin/main (latest code)
#   2. docker compose build (rebuild front + backend images)
#   3. docker compose up -d (restart with new images, DB volume preserved)
#   4. Prune dangling images, health check
#
# Run scripts/server-setup.sh once before using this for the first time.
set -euo pipefail

PROJECT_DIR="/opt/bunker"
COMPOSE_FILE="docker-compose.prod.yml"
MANUAL_MIGRATIONS_DIR="apps/api/prisma/manual-migrations"

cd "$PROJECT_DIR"

# ─── Sanity checks ────────────────────────────────────────────
if [ ! -d ".git" ]; then
  echo "✗ $PROJECT_DIR is not a git clone. Run scripts/server-setup.sh first."
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "✗ Missing $PROJECT_DIR/.env (with secrets). Aborting."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "✗ Missing $COMPOSE_FILE in repo. Make sure you've pushed it."
  exit 1
fi

START_TS=$(date +%s)
PREV_REV=$(git rev-parse --short HEAD)

echo "→ [$(date '+%H:%M:%S')] Pulling latest from origin/main..."
git fetch --quiet origin main
git reset --hard origin/main

NEW_REV=$(git rev-parse --short HEAD)

if [ "$PREV_REV" = "$NEW_REV" ]; then
  echo "  (no new commits — rebuilding anyway in case env changed)"
else
  echo "  $PREV_REV → $NEW_REV"
  git log --oneline "$PREV_REV..$NEW_REV" | head -10 | sed 's/^/    • /'
fi

echo "→ Building images..."
docker compose -f "$COMPOSE_FILE" build

echo "→ Restarting containers (DB volume preserved)..."
docker compose -f "$COMPOSE_FILE" up -d
# NOTE: seed endi avtomatik ishlamaydi — faqat birinchi deploy'dan keyin
# yoki yangi base kontent qo'shganda qo'lda ishlatish:
#   docker exec bunker-api yarn prisma:seed

echo "→ Applying one-time manual SQL migrations (if any)..."
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc '
set -eu
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'"'"'SQL'"'"'
CREATE TABLE IF NOT EXISTS manual_schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
'

if [ -d "$MANUAL_MIGRATIONS_DIR" ]; then
  shopt -s nullglob
  migration_files=("$MANUAL_MIGRATIONS_DIR"/*.sql)
  shopt -u nullglob

  if [ ${#migration_files[@]} -eq 0 ]; then
    echo "  (no manual SQL migrations found)"
  else
    for file in "${migration_files[@]}"; do
      filename=$(basename "$file")
      already_applied=$(
        docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
          'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA' <<SQL
SELECT 1 FROM manual_schema_migrations
WHERE filename = '$filename'
LIMIT 1;
SQL
      )

      if [ "$already_applied" = "1" ]; then
        echo "  ↷ skipping $filename (already applied)"
        continue
      fi

      echo "  → applying $filename"
      docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
        'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
        < "$file"
      docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
        'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<SQL
INSERT INTO manual_schema_migrations (filename)
VALUES ('$filename');
SQL
      echo "    ✓ applied $filename"
    done
  fi
else
  echo "  (manual migrations directory not found)"
fi

echo "→ Pruning dangling images..."
docker image prune -f >/dev/null

# ─── Health check ─────────────────────────────────────────────
echo "→ Health check..."
sleep 6
api_ok=0
web_ok=0
for i in 1 2 3 4 5; do
  if curl -sf http://127.0.0.1:8091/health >/dev/null 2>&1; then api_ok=1; break; fi
  sleep 2
done
for i in 1 2 3 4 5; do
  if curl -sfI http://127.0.0.1:8090/ >/dev/null 2>&1; then web_ok=1; break; fi
  sleep 2
done

DURATION=$(( $(date +%s) - START_TS ))

if [ "$api_ok" -ne 1 ]; then
  echo "  ✗ API failed health check"
  echo "    docker logs bunker-api --tail 50"
  exit 1
fi
if [ "$web_ok" -ne 1 ]; then
  echo "  ✗ Web failed health check"
  echo "    docker logs bunker-web --tail 50"
  exit 1
fi

echo "  ✓ API healthy"
echo "  ✓ Web responding"
echo "✅ Deploy complete in ${DURATION}s — https://jamoaviy.uz"

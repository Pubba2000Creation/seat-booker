#!/bin/sh
# Prepares the database, then hands off to the server process.
#
# Compose already gates this container on the DB healthcheck, but a healthy
# container is not the same as an accepting connection during the first boot of a
# fresh volume, so migrate is retried rather than assumed to succeed first try.
set -e

ATTEMPTS=20
DELAY=2

echo "[entrypoint] Applying migrations ..."
i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  if pnpm db:migrate; then
    break
  fi
  if [ "$i" -eq "$ATTEMPTS" ]; then
    echo "[entrypoint] Database unreachable after $ATTEMPTS attempts. Giving up." >&2
    exit 1
  fi
  echo "[entrypoint] Database not ready (attempt $i/$ATTEMPTS); retrying in ${DELAY}s ..."
  i=$((i + 1))
  sleep "$DELAY"
done

# The seed is idempotent (every row is upserted on a natural key), so running it
# on every start is safe and keeps a restarted stack demo-ready.
if [ "${SEED_ON_BOOT:-true}" = "true" ]; then
  echo "[entrypoint] Seeding demo data ..."
  pnpm seed
else
  echo "[entrypoint] SEED_ON_BOOT is not 'true'; skipping seed."
fi

echo "[entrypoint] Starting API ..."
exec "$@"

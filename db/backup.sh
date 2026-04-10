#!/bin/sh
# PostgreSQL backup — runs inside the poc-backup container
# Dumps the database every 6 hours and retains the last 7 days of backups.
set -e

BACKUP_DIR="/backups"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-21600}"  # 6 hours default

mkdir -p "$BACKUP_DIR"

echo "[backup] Service started. Interval=${INTERVAL}s RetainDays=${RETAIN_DAYS}"

# Run immediately on startup, then on schedule
while true; do
  FILENAME="$BACKUP_DIR/poc_$(date +%Y%m%d_%H%M%S).sql.gz"

  echo "[backup] Starting dump → $FILENAME"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h postgres \
    -U "$POSTGRES_USER" \
    "$POSTGRES_DB" | gzip > "$FILENAME"

  SIZE=$(du -sh "$FILENAME" | cut -f1)
  echo "[backup] Done — $FILENAME ($SIZE)"

  # Remove backups older than RETAIN_DAYS
  find "$BACKUP_DIR" -name "poc_*.sql.gz" -mtime +"$RETAIN_DAYS" -delete
  echo "[backup] Pruned backups older than ${RETAIN_DAYS} days"

  sleep "$INTERVAL"
done

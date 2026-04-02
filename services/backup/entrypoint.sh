#!/bin/bash
set -e

DB_BACKUP_ENABLED=${DB_BACKUP_ENABLED:-false}
DB_BACKUP_SCHEDULE=${DB_BACKUP_SCHEDULE:-"0 2 * * *"}

if [ "$DB_BACKUP_ENABLED" != "true" ]; then
    echo "[backup] DB_BACKUP_ENABLED is not true — container idle. Set DB_BACKUP_ENABLED=true to enable."
    exec sleep infinity
fi

# Configure MinIO client alias
mc alias set pantrypal \
    "http://${MINIO_ENDPOINT:-minio:9000}" \
    "${MINIO_ACCESS_KEY}" \
    "${MINIO_SECRET_KEY}" \
    --api S3v4 > /dev/null

echo "[backup] MinIO client configured."
echo "[backup] Schedule: ${DB_BACKUP_SCHEDULE}"
echo "[backup] Retention: ${DB_BACKUP_RETENTION_DAYS:-7} days"

# Register cron job
echo "${DB_BACKUP_SCHEDULE} /backup.sh >> /var/log/backup.log 2>&1" | crontab -

# Optionally run a backup immediately on container start
if [ "${BACKUP_ON_START:-false}" = "true" ]; then
    echo "[backup] Running initial backup on startup..."
    /backup.sh || echo "[backup] Initial backup failed, cron will retry on schedule."
fi

echo "[backup] Starting cron daemon..."
exec crond -f -l 6

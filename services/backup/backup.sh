#!/bin/bash
set -e

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DATE=$(date +%Y-%m-%d)
BACKUP_PATH=${BACKUP_PATH:-/backups}
RETENTION_DAYS=${DB_BACKUP_RETENTION_DAYS:-7}
LOCAL_STORAGE_PATH=${LOCAL_STORAGE_PATH:-/app/data/storage}

echo "[backup] ===== Starting backup: $TIMESTAMP ====="

# ============================================================
# 1. PostgreSQL
# ============================================================
PG_DIR="$BACKUP_PATH/postgres"
mkdir -p "$PG_DIR"

echo "[backup] Dumping PostgreSQL..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-pantrypal}" \
    "${POSTGRES_DB:-pantrypal}" \
    | gzip > "$PG_DIR/pantrypal_${TIMESTAMP}.sql.gz"

echo "[backup] PostgreSQL done: pantrypal_${TIMESTAMP}.sql.gz"

STORAGE_DIR="$BACKUP_PATH/storage/$DATE"
mkdir -p "$STORAGE_DIR"

if [ -d "$LOCAL_STORAGE_PATH" ]; then
    echo "[backup] Copying local storage files..."
    cp -a "$LOCAL_STORAGE_PATH/." "$STORAGE_DIR/"
else
    echo "[backup] Local storage path does not exist yet; skipping files."
fi

echo "[backup] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_PATH/postgres" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_PATH/storage" -maxdepth 1 -mindepth 1 -type d -mtime +"$RETENTION_DAYS" \
    -exec rm -rf {} + 2>/dev/null || true

echo "[backup] ===== Backup complete: $(date +%Y-%m-%d_%H%M%S) ====="

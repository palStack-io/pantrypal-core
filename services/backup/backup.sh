#!/bin/bash
set -e

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DATE=$(date +%Y-%m-%d)
BACKUP_PATH=${BACKUP_PATH:-/backups}
RETENTION_DAYS=${DB_BACKUP_RETENTION_DAYS:-7}

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

# ============================================================
# 2. SQLite databases
# ============================================================
SQLITE_DIR="$BACKUP_PATH/sqlite/$DATE"
mkdir -p "$SQLITE_DIR"

for DB_PATH in /data/users.db /data/api_keys.db /data/inventory/inventory.db; do
    if [ -f "$DB_PATH" ]; then
        DB_NAME=$(basename "$DB_PATH")
        echo "[backup] Backing up SQLite: $DB_NAME"
        sqlite3 "$DB_PATH" ".backup $SQLITE_DIR/$DB_NAME"
    else
        echo "[backup] Skipping $DB_PATH (not found)"
    fi
done

echo "[backup] SQLite done."

# ============================================================
# 3. MinIO buckets
# ============================================================
MINIO_DIR="$BACKUP_PATH/minio/$DATE"
mkdir -p "$MINIO_DIR"

echo "[backup] Mirroring MinIO buckets..."
for BUCKET in pantrypal-products pantrypal-users pantrypal-receipts pantrypal-recipes; do
    echo "[backup] Mirroring: $BUCKET"
    mc mirror --overwrite "pantrypal/$BUCKET" "$MINIO_DIR/$BUCKET" \
        && echo "[backup] $BUCKET done." \
        || echo "[backup] WARNING: $BUCKET mirror failed, continuing..."
done

echo "[backup] MinIO done."

# ============================================================
# 4. Retention cleanup
# ============================================================
echo "[backup] Cleaning up backups older than $RETENTION_DAYS days..."

find "$BACKUP_PATH/postgres" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_PATH/sqlite" -maxdepth 1 -mindepth 1 -type d -mtime +"$RETENTION_DAYS" \
    -exec rm -rf {} + 2>/dev/null || true
find "$BACKUP_PATH/minio" -maxdepth 1 -mindepth 1 -type d -mtime +"$RETENTION_DAYS" \
    -exec rm -rf {} + 2>/dev/null || true

echo "[backup] ===== Backup complete: $(date +%Y-%m-%d_%H%M%S) ====="

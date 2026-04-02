# PantryPal — Backup & Restore Guide

## Overview

PantryPal runs a dedicated `backup` service that automatically backs up all persistent data on a configurable cron schedule. Three categories of data are covered:

| Category | Tool | What's included |
|---|---|---|
| PostgreSQL | `pg_dump` + gzip | Users, sessions, recipes, OIDC, API keys, password reset tokens |
| SQLite | `sqlite3 .backup` | `users.db`, `api_keys.db`, `inventory.db` |
| MinIO | `mc mirror` | All 4 buckets: products, users, receipts, recipes |

> **Not backed up:** `lookup_cache.db` — this is a 30-day TTL barcode cache that repopulates automatically from Open Food Facts. There is no value in restoring it.

---

## Backup Storage Layout

### docker-compose / docker-compose.prod (bind mounts)

Backups land in the `./backups/` directory on the host:

```
./backups/
├── postgres/
│   └── pantrypal_2026-04-02_020000.sql.gz
├── sqlite/
│   └── 2026-04-02/
│       ├── users.db
│       ├── api_keys.db
│       └── inventory.db
├── minio/
│   └── 2026-04-02/
│       ├── pantrypal-products/
│       ├── pantrypal-users/
│       ├── pantrypal-receipts/
│       └── pantrypal-recipes/
└── csv/
    └── pantrypal_backup_2026-04-02_020000.csv   ← inventory CSV (legacy)
```

### Portainer (named volumes)

Backups are stored in the `backup_data` Docker volume, with the same internal directory structure as above.

To access files from a named volume, run a temporary container:

```bash
docker run --rm \
  -v pantrypal_backup_data:/backups \
  -v $(pwd):/host \
  alpine \
  cp -r /backups /host/pantrypal-backups-export
```

---

## Enabling Backups

Backups are **disabled by default**. To enable:

### docker-compose / docker-compose.prod

In your `.env` file:

```env
DB_BACKUP_ENABLED=true
DB_BACKUP_SCHEDULE=0 2 * * *       # daily at 2 AM (cron format)
DB_BACKUP_RETENTION_DAYS=7         # auto-delete backups older than 7 days
BACKUP_ON_START=false              # set true to run a backup immediately on deploy
```

Then restart the backup service:

```bash
docker compose restart backup
```

### Portainer

In the stack editor, find the `backup` service and change:

```yaml
DB_BACKUP_ENABLED: "true"
```

Update the stack to apply.

---

## Running a Manual Backup

At any time you can trigger an immediate backup without waiting for the schedule:

```bash
docker exec pantrypal-backup /backup.sh
```

---

## Checking Backup Logs

```bash
# Live logs from the backup container
docker logs pantrypal-backup

# Cron job output (inside the container)
docker exec pantrypal-backup cat /var/log/backup.log
```

---

## Restore Procedures

> **Before restoring:** always stop the affected service(s) first to prevent data corruption from in-flight writes.

---

### Restore PostgreSQL

```bash
# 1. Stop the api-gateway (the only service writing to postgres)
docker compose stop api-gateway

# 2. Drop and recreate the database
docker exec pantrypal-postgres psql -U pantrypal -c "DROP DATABASE pantrypal;"
docker exec pantrypal-postgres psql -U pantrypal -c "CREATE DATABASE pantrypal;"

# 3. Restore from the chosen backup file
gunzip -c ./backups/postgres/pantrypal_2026-04-02_020000.sql.gz \
  | docker exec -i pantrypal-postgres psql -U pantrypal -d pantrypal

# 4. Restart the api-gateway
docker compose start api-gateway
```

---

### Restore SQLite Databases

Each SQLite file is independent. Replace only the one(s) you need.

```bash
# 1. Stop the service that owns the database
docker compose stop api-gateway          # for users.db / api_keys.db
docker compose stop inventory-service    # for inventory.db

# 2. Copy the backup file over the live file
#    (adjust the date folder to your chosen backup)

# users.db
cp ./backups/sqlite/2026-04-02/users.db ./data/users.db

# api_keys.db
cp ./backups/sqlite/2026-04-02/api_keys.db ./data/api_keys.db

# inventory.db
cp ./backups/sqlite/2026-04-02/inventory.db ./data/inventory/inventory.db

# 3. Restart the service(s)
docker compose start api-gateway inventory-service
```

#### Portainer (named volumes)

Use a temporary container to copy files into the volume:

```bash
# Example: restore users.db into the gateway_data volume
docker run --rm \
  -v $(pwd)/backups/sqlite/2026-04-02:/backup \
  -v pantrypal_gateway_data:/data \
  alpine \
  cp /backup/users.db /data/users.db
```

---

### Restore MinIO

```bash
# 1. Stop the api-gateway (prevents new uploads during restore)
docker compose stop api-gateway

# 2. Configure mc to point at your running MinIO instance
#    (skip if mc is already configured)
docker exec pantrypal-backup mc alias set pantrypal \
  http://minio:9000 \
  YOUR_MINIO_USER \
  YOUR_MINIO_PASSWORD

# 3. Mirror the backup back into MinIO for each bucket
#    (adjust the date folder to your chosen backup)
docker exec pantrypal-backup mc mirror --overwrite \
  /backups/minio/2026-04-02/pantrypal-users \
  pantrypal/pantrypal-users

docker exec pantrypal-backup mc mirror --overwrite \
  /backups/minio/2026-04-02/pantrypal-receipts \
  pantrypal/pantrypal-receipts

docker exec pantrypal-backup mc mirror --overwrite \
  /backups/minio/2026-04-02/pantrypal-products \
  pantrypal/pantrypal-products

docker exec pantrypal-backup mc mirror --overwrite \
  /backups/minio/2026-04-02/pantrypal-recipes \
  pantrypal/pantrypal-recipes

# 4. Restart the api-gateway
docker compose start api-gateway
```

---

### Full System Restore (disaster recovery)

Use this when restoring to a fresh host or after complete data loss.

```bash
# 1. Bring up just the infrastructure (postgres + minio) — not the app
docker compose up -d postgres minio

# 2. Wait for both to be healthy
docker compose ps

# 3. Restore PostgreSQL
gunzip -c ./backups/postgres/pantrypal_YYYY-MM-DD_HHMMSS.sql.gz \
  | docker exec -i pantrypal-postgres psql -U pantrypal -d pantrypal

# 4. Restore SQLite files
cp ./backups/sqlite/YYYY-MM-DD/users.db      ./data/users.db
cp ./backups/sqlite/YYYY-MM-DD/api_keys.db   ./data/api_keys.db
cp ./backups/sqlite/YYYY-MM-DD/inventory.db  ./data/inventory/inventory.db

# 5. Restore MinIO buckets (start the backup container temporarily)
docker compose up -d backup
docker exec pantrypal-backup mc mirror --overwrite /backups/minio/YYYY-MM-DD/pantrypal-users     pantrypal/pantrypal-users
docker exec pantrypal-backup mc mirror --overwrite /backups/minio/YYYY-MM-DD/pantrypal-receipts  pantrypal/pantrypal-receipts
docker exec pantrypal-backup mc mirror --overwrite /backups/minio/YYYY-MM-DD/pantrypal-products  pantrypal/pantrypal-products
docker exec pantrypal-backup mc mirror --overwrite /backups/minio/YYYY-MM-DD/pantrypal-recipes   pantrypal/pantrypal-recipes

# 6. Bring up the rest of the stack
docker compose up -d
```

---

## Backup Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `DB_BACKUP_ENABLED` | `false` | Set to `true` to activate the backup cron |
| `DB_BACKUP_SCHEDULE` | `0 2 * * *` | Cron expression for when backups run |
| `DB_BACKUP_RETENTION_DAYS` | `7` | Backups older than this are auto-deleted |
| `BACKUP_ON_START` | `false` | Run a backup immediately when the container starts |

### Cron schedule examples

```
0 2 * * *       daily at 2 AM          (default)
0 */6 * * *     every 6 hours
0 2 * * 0       weekly on Sunday at 2 AM
0 2 * * 1-5     weekdays at 2 AM
```

---

## Inventory CSV Export (legacy)

The inventory-service also has a built-in CSV export that is independent of the backup service:

- **Manual export:** `GET /export/csv` (available via the UI)
- **Automated:** set `BACKUP_ENABLED=true` on the `inventory-service` — writes to `./backups/csv/`
- **Content:** inventory items only (Name, Barcode, Quantity, Location, Category, Expiry Date, Added Date, Notes)

This is a lightweight option for exporting pantry data but does **not** replace the full database backup.

# PantryPal — Backup & Restore Guide

## Overview

PantryPal runs a dedicated `backup` service that automatically backs up all persistent data on a configurable cron schedule. Two categories of data are covered:

| Category | Tool | What's included |
|---|---|---|
| PostgreSQL | `pg_dump` + gzip | Everything in the database — users, sessions, API keys, OIDC links, inventory, shopping lists, recipes, and the barcode cache |
| Local storage | `cp -a` | Recipe, product, and user images under `LOCAL_STORAGE_PATH` |

> **Also keep a copy of your `.env`.** The backups don't include it, and a restored database is useless without the same `DB_PASSWORD`, `SECRET_KEY` and `ENCRYPTION_SALT` — saved Mealie/Tandoor credentials can only be decrypted with the original `SECRET_KEY` + `ENCRYPTION_SALT`.

---

## Backup Storage Layout

### docker-compose (bind mounts)

Backups land in the `./backups/` directory on the host:

```
./backups/
├── postgres/
│   └── pantrypal_2026-04-02_020000.sql.gz
├── storage/
│   └── 2026-04-02/
│       ├── products/
│       ├── users/
│       └── recipes/
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

### docker-compose

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
# 1. Stop every service that connects to postgres (DROP DATABASE fails while
#    any connection is open)
docker compose stop api-gateway inventory-service lookup-service backup

# 2. Drop and recreate the database
docker exec pantrypal-postgres psql -U pantrypal -c "DROP DATABASE pantrypal;"
docker exec pantrypal-postgres psql -U pantrypal -c "CREATE DATABASE pantrypal;"

# 3. Restore from the chosen backup file
gunzip -c ./backups/postgres/pantrypal_2026-04-02_020000.sql.gz \
  | docker exec -i pantrypal-postgres psql -U pantrypal -d pantrypal

# 4. Restart the services
docker compose start api-gateway inventory-service lookup-service backup
```

---

### Restore Local Storage Files

```bash
# 1. Stop the api-gateway (prevents new uploads during restore)
docker compose stop api-gateway

# 2. Copy the backup files back into the live storage path
#    (adjust the date folder to your chosen backup)
cp -a ./backups/storage/2026-04-02/. ./data/storage/

# 3. Restart the api-gateway
docker compose start api-gateway
```

---

### Full System Restore (disaster recovery)

Use this when restoring to a fresh host or after complete data loss.

```bash
# 0. Put your original .env (same DB_PASSWORD, SECRET_KEY, ENCRYPTION_SALT,
#    INTERNAL_SERVICE_TOKEN) next to docker-compose.yml

# 1. Bring up just the infrastructure (postgres) — not the app
docker compose up -d postgres

# 2. Wait for it to be healthy
docker compose ps

# 3. Restore PostgreSQL
gunzip -c ./backups/postgres/pantrypal_YYYY-MM-DD_HHMMSS.sql.gz \
  | docker exec -i pantrypal-postgres psql -U pantrypal -d pantrypal

# 4. Restore local storage files
cp -a ./backups/storage/YYYY-MM-DD/. ./data/storage/

# 5. Bring up the rest of the stack
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

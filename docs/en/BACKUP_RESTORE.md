# Backup and Restore

## Scope

This document covers local MySQL 5.7 backup and restore for the `educard_secure` database.

No script stores a password in the repository. Passwords are requested locally through PowerShell secure input when needed.

## Backup

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup_database.ps1
```

Behavior:

- Uses `mysqldump.exe`.
- Dumps only `educard_secure`.
- Uses `--single-transaction`.
- Uses `--no-tablespaces` so the dedicated application account does not need the global `PROCESS` privilege.
- Writes to `backups\educard_secure_yyyyMMdd_HHmmss.sql`.
- Refuses to overwrite an existing file unless confirmed.
- Calculates a SHA-256 sidecar file `<backup>.sha256`.

Non-interactive local test mode reads the ignored `.env` file:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup_database.ps1 -UseEnvFile
```

## Restore

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore_database.ps1 -BackupFile .\backups\educard_secure_YYYYMMDD_HHMMSS.sql
```

Behavior:

- Requires explicit `RESTORE-EDUCARD` confirmation.
- Verifies `<backup>.sha256` first when present.
- Restores into `educard_secure`.
- Does not drop any database by itself.
- Must be reviewed before use because restore may overwrite data inside the target schema.

## Non goals

- No automated restore during phase 2.
- No deletion of backups.
- No modification of MySQL global settings.
- No use of a real secret in Git.

## Verification

Backup can be tested only after the database exists and credentials are configured locally.
Restore must not be tested without explicit authorization.

## Listing and verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\list_backups.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_backup.ps1 -BackupFile .\backups\educard_secure_YYYYMMDD_HHMMSS.sql
```

## What Is Not Modified

- MySQL service configuration.
- MySQL port.
- Global MySQL variables.
- Existing unrelated databases.

## Legal And Operational Validation

Production backup retention, encryption, access control, offsite storage and
restore drills require institutional approval and legal validation.
# Application backup logging

Configure `BACKUP_SERVICE_TOKEN` locally in `.env`, then restart the backend.
The `backup_database.ps1`, `verify_backup.ps1` and `restore_database.ps1`
scripts publish their results to the internal `POST /api/v1/backups/log`
endpoint.

The route is omitted from Swagger and never receives the complete backup file
path, only an opaque reference. API unavailability does not invalidate an
already successful backup; the script prints an explicit warning instead.

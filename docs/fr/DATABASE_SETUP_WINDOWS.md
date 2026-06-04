# Database Setup on Windows

## Prerequisites

- MySQL Server 5.7 already installed locally.
- Python available.
- Local `.env` created from `.env.example`.
- No real secret committed to Git.

Recommended local Python environment:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
```

## Check tools

```powershell
python --version
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check_mysql57.ps1
git status
```

## Create local .env

```powershell
Copy-Item .env.example .env
```

Edit `.env` locally and set:

```text
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=educard_secure
DATABASE_USER=educard_app
DATABASE_PASSWORD=<local secret only>
DATABASE_URL=
SECRET_KEY=<local secret only>
FIELD_ENCRYPTION_KEY=<local secret only>
QR_SIGNING_PRIVATE_KEY_PATH=<local path outside Git or ignored path>
QR_SIGNING_PUBLIC_KEY_PATH=<local path outside Git or ignored path>
```

Do not commit `.env`.

## Create database

Review scripts first:

```powershell
Get-Content .\database\01_create_database.sql
Get-Content .\database\02_create_app_user_template.sql
Get-Content .\database\03_grant_app_privileges_template.sql
```

The database can be initialized only after explicit authorization:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\init_database.ps1
```

The user and grant template files contain placeholders. Replace placeholders only in local copies or execute equivalent commands manually without committing secrets.
The grant template does not grant `DROP` by default.

## Run migrations

After `.env` and the database are configured:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_migrations.ps1
```

After migrations, remove temporary migration privileges from `educard_app` if they were granted.

## Seed initial data

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\seed_initial_data.ps1
```

## Seed synthetic demo data

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\seed_demo_data.ps1
```

## Purge synthetic demo data

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\purge_demo_data.ps1
```

This preserves roles, permissions and required settings.

## Backup

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup_database.ps1
```

## Restore

Restore requires explicit confirmation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore_database.ps1 -BackupFile .\backups\educard_secure_YYYYMMDD_HHMMSS.sql
```

## Important restrictions

- Do not use `root` as the application account.
- Do not reinstall MySQL.
- Do not change the MySQL Windows service.
- Do not change the MySQL port.
- Do not drop any existing database.
- Do not run `Set-ExecutionPolicy`; use `.cmd` variants for Node.js tooling.

# Local Windows Deployment

## Python Environment

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## Configuration

```powershell
Copy-Item .env.example .env
```

Edit `.env` locally. Do not commit secrets.

## Database

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check_mysql57.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_migrations.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\seed_initial_data.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\seed_demo_data.ps1
```

## Backend

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Health check:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health
```

## Frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open:

```powershell
http://127.0.0.1:5173
```

## Build

```powershell
cd frontend
npm.cmd run build
```

## Tests

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_all_tests.ps1
```

## Backup

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup_database.ps1 -UseEnvFile
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\list_backups.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_backup.ps1 -BackupFile .\backups\educard_secure_YYYYMMDD_HHMMSS.sql
```

## Demo Purge

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\purge_demo_data.ps1
```

This deletes only demo-tagged data. Use only when intended.

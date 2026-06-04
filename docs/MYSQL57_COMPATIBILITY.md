# MySQL 5.7 Compatibility

## Scope

EduCard Secure targets MySQL Server 5.7 for the local prototype database.

Verified locally during phase 2:

- MySQL client: `C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe`
- mysqldump client: `C:\Program Files\MySQL\MySQL Server 5.7\bin\mysqldump.exe`
- Version: MySQL 5.7.44 client.
- Initial schema migration executed successfully against MySQL 5.7.
- Runtime grants verified for `educard_app`: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `educard_secure`.

## Required database options

```sql
CREATE DATABASE IF NOT EXISTS `educard_secure`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

The application tables use:

- InnoDB.
- `utf8mb4`.
- `utf8mb4_unicode_ci`.
- Foreign keys.
- Explicit indexes.

## Features intentionally avoided

- No required CTE.
- No required window function.
- No dependency on enforced CHECK constraints.
- No required JSON column behavior.
- No MySQL 8-only syntax.

## Application-enforced rules

MySQL 5.7 does not reliably enforce all constraints expected by modern SQL designs. The following rules are enforced in application services and tests:

- Only one active card per student.
- Coherent user scope pointing to one region, department or school.
- Valid status transitions.
- QR payload validity period and signature checks.
- Export authorization and retention validation.
- Demo purge limited to rows marked as synthetic.

## Account separation

The application must not use `root` at runtime.

Recommended accounts:

- Setup or migration account: used temporarily to create schema objects.
- Application account: `educard_app`, limited to normal CRUD privileges after migrations.

Temporary migration privileges can be revoked after Alembic migration execution.
`DROP` is not granted by default and is reserved for explicitly authorized downgrade or table removal procedures.

## PowerShell checks

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check_mysql57.ps1
```

Do not change the MySQL Windows service, port or global settings without explicit authorization.

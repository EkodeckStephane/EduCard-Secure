# Migration to MySQL 8.4 LTS

## Purpose

This note prepares a future migration from MySQL 5.7 to MySQL 8.4 LTS. It is not an instruction to upgrade during phase 2.

## Current constraints

The phase 2 schema avoids MySQL 8-only features:

- No CTE dependency.
- No window function dependency.
- No mandatory JSON behavior.
- No reliance on CHECK constraints.

## Future opportunities

After migration to MySQL 8.4 LTS, the project may evaluate:

- Real CHECK constraints for status enumerations.
- Generated columns for selected search or reporting optimizations.
- Improved functional indexes where useful.
- Better default authentication and TLS posture.
- More advanced query plans for dashboards.

## Migration strategy

1. Freeze application writes.
2. Backup MySQL 5.7 database with `mysqldump`.
3. Restore into a staging MySQL 8.4 instance.
4. Run Alembic migrations in staging.
5. Run integrity and security tests.
6. Verify RBAC, audit chain and QR verification flows.
7. Rehearse rollback from backup.
8. Promote only after validation.

## Risks

- Authentication plugin differences.
- Collation behavior changes.
- Query plan changes.
- Stricter SQL modes exposing legacy assumptions.
- Backup and restore duration on large datasets.

## Not authorized in phase 2

- Installing MySQL 8.4.
- Modifying the existing MySQL service.
- Changing global MySQL settings.
- Migrating real data.

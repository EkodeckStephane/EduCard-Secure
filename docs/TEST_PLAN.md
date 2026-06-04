# Test Plan

## Scope

This plan covers the local demonstrable EduCard Secure prototype with synthetic
data only.

## Automated Checks

- Alembic current revision.
- MySQL inventory query.
- Backend pytest suite.
- Frontend lint.
- Frontend Vitest suite.
- Frontend production build.
- Secret scan over tracked source areas.
- Git sensitive-file check.
- Git status.
- Backup creation and SHA-256 verification.

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_all_tests.ps1
```

## Scenario Coverage

Scenario A, immatriculation: covered by phase 4 backend tests for student
creation, internal student number generation, duplicate candidates, enrollment
and history.

Scenario B, card: covered by phase 4 and phase 5 backend tests for card request,
activation, QR generation, verification, suspension, rejection and reactivation.

Scenario C, attendance: covered by phase 5 backend tests for entry, duplicate
check-in, correction and approval. Late/absence statistics are documented and
partially covered by dashboard aggregate tests.

Scenario D, service: covered by phase 5 backend tests for entitlement,
verification, denial and audit.

Scenario E, mock payment: covered by phase 5 and phase 6 tests for simulated
transaction, idempotence, duplicate handling, reconciliation and statistics.

Scenario F, security: covered by phase 3 and phase 7 tests for failed login,
lockout, forbidden access, RBAC, scopes, audit chain and tamper detection.

Scenario G, data protection: covered by phase 6 and phase 7 tests for controlled
exports, privacy request records, retention rules and audit logging.

## Manual Checks

- Browser walkthrough of all screens.
- Accessibility review beyond build/lint.
- Legal validation of privacy, retention and incident workflows.
- Real restore drill, only with explicit authorization.

## Last Phase 8 Results

- Alembic current: `0002_user_preferred_language (head)`.
- Backend tests: 19 passed.
- Frontend tests: 1 passed.
- Frontend lint: passed.
- Frontend build: passed.
- MySQL version: `5.7.44-log`.
- Tables: 50.
- Index/statistics entries: 192.
- Foreign-key references: 76.
- Backup hash verification: passed.

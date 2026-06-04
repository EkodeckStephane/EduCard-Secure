# Final Validation Report

## Summary

EduCard Secure is a local demonstrable prototype for a digital school card
system. It uses FastAPI, SQLAlchemy, Alembic, MySQL 5.7, React, TypeScript and
Vite. All demo data is synthetic.

## Verified

- Repository structure and tracked files.
- MySQL migration state at `0002_user_preferred_language`.
- MySQL Server version: `5.7.44-log`.
- MySQL inventory: 50 tables, 192 index/statistics entries, 76 foreign-key
  references, 1 Alembic version row.
- OpenAPI generation: 80 routes, title `EduCard Secure API`, version `0.7.0`.
- Backend tests: 19 passed.
- Frontend tests: 1 passed.
- Frontend lint: passed.
- Frontend build: passed.
- `npm.cmd install`: passed with 0 vulnerabilities reported by npm.
- Initial seed: passed.
- Demo seed: idempotent, synthetic data already loaded.
- Secret scan: only placeholder lines detected.
- Sensitive Git tracking check: no tracked private keys, backups, exports or
  logs.
- Backup creation and SHA-256 verification: passed in phase 8.

## Corrections Applied During Phase 8

- README status was updated from phase 0 to phase 8.
- Audit hash chaining now uses the latest audit event order rather than the
  latest hash row id, removing instability on reused local databases.
- The final test runner avoids self-matching its own secret-scan pattern.

## Partially Verified

- Frontend screen walkthrough: build and tests pass, but no browser automation
  walkthrough was executed in this final pass.
- Documentation language split: `docs/fr` and `docs/en` exist. The French corpus
  was normalized during final cleanup; institutional publication still requires
  subject-matter and legal review.
- MySQL purge demo: documented and scripted; not executed in final pass to avoid
  deleting local demo data during final audit.

## Non Verified

- Real backup restoration.
- Production deployment.
- External integrations.
- Legal compliance.
- Institutional approval.
- Browser automation walkthrough.

## Residual Risks

- MySQL 5.7 is legacy and lacks modern platform features.
- Audit append-only behavior is application-level, not WORM storage.
- Development keys are local files, not HSM-managed.
- Documentation still requires institutional subject-matter and legal review.

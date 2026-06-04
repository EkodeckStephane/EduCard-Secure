# Security Test Report

## Verified

- Password authentication success and failure.
- Progressive lockout.
- MFA requirement and controlled disablement.
- Session refresh, logout and expiration.
- CSRF rejection for protected mutating routes.
- RBAC vertical denial.
- Scope-based horizontal denial.
- QR valid and invalid signature handling.
- Revoked/suspended card verification behavior.
- Mock payment idempotence and duplicate handling.
- Controlled exports and download logging.
- Audit hash chain verification.
- Simulated audit alteration detection.
- Security headers in API responses.
- Secret scan with only documented placeholders detected.
- No tracked private keys, backups, exports or logs.
- Audit append ordering corrected to match verification ordering.

## Partially Verified

- XSS protection: React escaping and CSP header are present; no dedicated browser
  fuzz suite was executed.
- SQL injection: parameterized ORM usage and injection-like filter test were
  executed; no external DAST scanner was run.
- Backup security: backup creation and SHA-256 verification were tested; restore
  was not executed.
- Frontend security UI masking: build and role-based visibility exist; no
  browser automation walkthrough was executed in phase 8.

## Not Verified

- HSM or external key custody.
- WORM audit storage.
- SIEM integration.
- External notification channels.
- Production legal breach notification workflow.

## Human Validation Required

- Legal basis and retention periods.
- Incident notification thresholds.
- Data-sharing agreements.
- Production hosting and backup policy.

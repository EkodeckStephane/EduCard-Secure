# Security

## Phase 3 controls

- Argon2id password hashing.
- Secure session token hashing.
- HttpOnly session cookie.
- CSRF token for mutating requests.
- RBAC enforced in FastAPI dependencies.
- Scope checks for school, department, region and national access.
- MFA TOTP for privileged roles.
- Login attempt tracking.
- Security event logging.
- Session revocation and rotation.

## Backend-only authorization

Every protected API path uses backend dependencies. Hiding frontend menus is not treated as authorization.

## Secrets

Secrets are stored only in local `.env`, ignored by Git.
No secret is committed in source code, documentation or frontend assets.

## MySQL

Phase 3 does not modify MySQL service configuration, port or global settings.

## Phase 5 controls

- QR payloads are signed with Ed25519.
- QR payloads exclude direct personal data.
- QR private keys are stored locally under ignored paths.
- Key versions and revocation are checked during verification.
- Attendance, service and payment operations are scope-checked server-side.
- Mock payment providers do not call external networks.
- Idempotency keys prevent duplicate simulated payments.
- Biometrics remain disabled through a placeholder `BiometricProvider`.

## Phase 7 controls

- Security response headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`.
- Chained audit log using SHA-256 over canonical audit material and previous hash.
- Audit integrity endpoint detects simulated tampering.
- Alerts are derived from high and critical `security_events`.
- Incidents have creation, update, history and audit events.
- Privacy requests, processing register entries and retention rules are permission-gated and marked for legal validation where applicable.
- Backup scripts calculate SHA-256 sidecar files and restore verifies the sidecar before asking for confirmation.

## Controls documented but not production-complete

- Full immutable WORM storage for audit logs.
- HSM-backed key custody.
- Formal legal retention schedule.
- Real incident evidence attachment scanning.
- Production rate limiter backed by shared storage.

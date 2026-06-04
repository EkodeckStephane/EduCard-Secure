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


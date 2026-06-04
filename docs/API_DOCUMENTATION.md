# API Documentation

Base path: `/api/v1`

## Auth

- `POST /auth/login`: username/password login, optional MFA code.
- `POST /auth/logout`: revoke current session, CSRF required.
- `POST /auth/refresh`: rotate session, CSRF required.
- `GET /auth/me`: current user, roles, permissions and scopes.
- `POST /auth/change-password`: change password, CSRF required.
- `POST /auth/mfa/setup`: start TOTP setup, CSRF required.
- `POST /auth/mfa/confirm`: confirm TOTP setup, CSRF required.
- `POST /auth/mfa/verify`: verify current TOTP code.
- `POST /auth/mfa/disable`: controlled disable, CSRF required.

## Users and RBAC

- `GET /users`: requires `user:update`.
- `POST /users`: requires `user:create`, CSRF required.
- `PATCH /users/{id}`: requires `user:update`, CSRF required.
- `GET /roles`: authenticated.
- `GET /permissions`: authenticated.
- `POST /users/{id}/roles`: requires `role:assign`, CSRF required.
- `POST /users/{id}/scopes`: requires `user:update`, CSRF required.

OpenAPI is available at `/docs` when the FastAPI app is running.

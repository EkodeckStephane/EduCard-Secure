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

## Students

- `GET /students`: requires `student:read`; supports `q`, `status`, `school_id`, `page`, `page_size`, `sort`, `direction`.
- `POST /students`: requires `student:create`, scope on target school and CSRF.
- `GET /students/{id}`: requires `student:read` and resource scope.
- `PATCH /students/{id}`: requires `student:update`, resource scope, CSRF and matching `record_version`.
- `POST /students/{id}/archive`: requires `student:archive`, resource scope and CSRF.
- `GET /students/{id}/history`: requires `student:read` and resource scope.
- `GET /students/{id}/duplicate-candidates`: requires `student:read` and resource scope.
- `GET /students/{id}/export`: requires `student:export`; returns a demo-only individual payload.

## Enrollments and Transfers

- `POST /enrollments`: requires `student:update`, student scope, target school scope and CSRF.
- `POST /transfers`: requires `student:update`, student scope, target school scope and CSRF.

## Cards

- `GET /cards`: requires `card:verify`; filters results by backend scope.
- `POST /cards`: requires `card:issue`, student scope and CSRF.
- `GET /cards/{id}`: requires `card:verify` and card scope.
- `POST /cards/{id}/activate`: requires `card:issue`, card scope and CSRF.
- `POST /cards/{id}/suspend`: requires `card:suspend`, card scope and CSRF.
- `POST /cards/{id}/reactivate`: requires `card:suspend`, card scope and CSRF.
- `POST /cards/{id}/revoke`: requires `card:revoke`, card scope and CSRF.
- `POST /cards/{id}/replace`: requires `card:issue`, card scope and CSRF.
- `GET /cards/{id}/history`: requires `card:verify` and card scope.

OpenAPI is available at `/docs` when the FastAPI app is running.

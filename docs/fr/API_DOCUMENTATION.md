# API Documentation

Base path: `/api/v1`

## Auth

- `POST /auth/login`: username/password login, optional MFA code.
- `POST /auth/logout`: revoke current session, CSRF required.
- `POST /auth/refresh`: rotate session, CSRF required.
- `GET /auth/me`: current user, roles, permissions and scopes.
- `POST /auth/change-password`: change password, CSRF required.
- `POST /auth/language`: update the current user's `fr` or `en` language preference, CSRF required.
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

## QR Verification

- `POST /cards/{id}/qr/generate`: requires `card:issue`, card scope and CSRF. Returns an Ed25519-signed payload without personal data.
- `POST /cards/verify`: requires `card:verify`. Verifies structure, signature, key status, expiry and card status.

## Attendance

- `GET /attendance`: requires `attendance:read`; supports `school_id` and `event_type`.
- `POST /attendance/check-in`: requires `attendance:create`, school/card scope and CSRF.
- `POST /attendance/check-out`: requires `attendance:create`, school/card scope and CSRF.
- `POST /attendance/{id}/correct`: requires `attendance:create`, scope and CSRF.
- `POST /attendance/{id}/approve-correction`: requires `attendance:create`, scope and CSRF.

## Services

- `GET /services`: requires `service:verify`.
- `POST /services/entitlements`: requires `service:manage`, student scope and CSRF.
- `POST /services/verify`: requires `service:verify`, student/card scope.

## Mock Payments

- `GET /payments`: requires `payment:read`; results are scope-filtered.
- `POST /payments/mock`: requires `payment:create`, school/student scope and CSRF. Uses mock providers only.
- `POST /payments/{id}/reconcile`: requires `payment:reconcile`, payment scope and CSRF.
- `GET /payments/reconciliations`: requires `payment:read`.

## Dashboards

- `GET /dashboard/summary`: requires `dashboard:read`; supports scope filters.
- `GET /dashboard/cards`: requires `dashboard:read`.
- `GET /dashboard/attendance`: requires `dashboard:read`.
- `GET /dashboard/payments`: requires `dashboard:read`.
- `GET /dashboard/security`: requires `dashboard:read`.
- `GET /dashboard/services`: requires `dashboard:read`.

Small counts are masked as `MASKED`.

## Controlled Exports

- `POST /exports`: requires `export:create` and CSRF; reason is mandatory.
- `GET /exports`: requires `export:download`; returns exports requested by the current user.
- `GET /exports/{id}`: requires `export:download`; returns metadata for the current user's export.
- `POST /exports/{id}/download`: requires `export:download` and CSRF; logs the download.

`INDIVIDUAL_STUDENT` exports additionally require `student:export`.

## Security Operations

- `POST /audit/events`: requires `audit:read`, CSRF; appends a chained audit event.
- `GET /audit/events`: requires `audit:read`; supports simple filters.
- `GET /audit/integrity`: requires `audit:read`; verifies hash chain integrity.
- `GET /alerts`: requires `security:read`; lists high and critical security events as alerts.
- `POST /alerts/{id}/ack`: requires `security:read`, CSRF; acknowledges an alert.
- `GET /incidents`: requires `incident:update`.
- `POST /incidents`: requires `incident:create`, CSRF.
- `PATCH /incidents/{id}`: requires `incident:update`, CSRF.
- `GET /privacy/requests`: requires `privacy:read`.
- `POST /privacy/requests`: requires `privacy:update`, CSRF.
- `GET /privacy/register`: requires `privacy:read`.
- `POST /privacy/register`: requires `privacy:update`, CSRF.
- `GET /privacy/retention`: requires `privacy:read`.
- `POST /privacy/retention`: requires `privacy:update`, CSRF.
- `GET /backups`: requires `backup:read`.

OpenAPI is available at `/docs` when the FastAPI app is running.

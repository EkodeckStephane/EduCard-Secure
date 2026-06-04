# Session Security

## Chosen model

Sessions use opaque random tokens stored in HttpOnly cookies. Only token hashes are stored in MySQL.

Cookies:

- `educard_session`: HttpOnly, SameSite Strict.
- `educard_csrf`: readable by frontend and sent as `X-CSRF-Token` for mutating requests.

`Secure` is disabled for local HTTP development and must be enabled when HTTPS is configured.

## Rotation and expiration

- Sessions expire after a limited duration.
- `POST /api/v1/auth/refresh` revokes the current session and issues a new one.
- Logout revokes the current session.
- Password change revokes all active sessions for the user.

## CSRF

Mutating authenticated endpoints require the CSRF cookie value to match the `X-CSRF-Token` header.

## Limits

The prototype stores sessions in MySQL. Production deployment should review rate limiting, TLS, secure cookie defaults and reverse proxy headers.


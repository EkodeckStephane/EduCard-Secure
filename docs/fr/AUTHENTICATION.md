# Authentication

## Strategy

EduCard Secure uses username and password authentication with Argon2id hashing. Plaintext passwords are never stored.

Implemented endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/auth/me`

## Password policy

Passwords must include:

- At least 12 characters.
- One uppercase letter.
- One lowercase letter.
- One digit.
- One symbol.

## Lockout and attempts

Failed login attempts are recorded in `login_attempts`. Repeated failures within the configured window lock the account by setting user status to `LOCKED`.

No password value is logged.

## Change password

Changing a password:

- Verifies the current password.
- Stores the previous password hash in `password_history`.
- Replaces the password hash.
- Revokes active sessions for that user.
- Records a security event.


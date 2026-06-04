# MFA TOTP

## Scope

Phase 3 implements TOTP MFA for privileged accounts and optional MFA for other users.

Implemented endpoints:

- `POST /api/v1/auth/mfa/setup`
- `POST /api/v1/auth/mfa/confirm`
- `POST /api/v1/auth/mfa/verify`
- `POST /api/v1/auth/mfa/disable`

## Secret storage

TOTP secrets are encrypted before storage in `mfa_methods.secret_encrypted`.
Secrets are not logged and are only returned during setup.

## Privileged roles

The following roles require MFA:

- `SUPER_ADMIN_TECHNIQUE`
- `ADMINISTRATION_CENTRALE`
- `AUDITEUR_SECURITE`

## Disable flow

Self-service disable requires a valid TOTP code. Administrative disable should be handled through a controlled support flow in a later phase.


# Key Management

## Local Development Keys

Development QR keys are generated locally and stored under `private/`, which is ignored by Git.

```powershell
.\scripts\generate_dev_qr_keys.ps1
```

Generated files:

- `private/dev_qr_ed25519_private.pem`
- `private/dev_qr_ed25519_public.pem`

The private key must never be committed, copied to the frontend or logged.

## Key Versions

The backend stores public metadata in `signing_key_versions`:

- `key_version`;
- public key fingerprint;
- status;
- validity dates.

The key version is embedded in QR payloads. Verification rejects unknown or revoked keys.

## Rotation

Rotation procedure for this prototype:

1. Generate a new local key pair.
2. Configure `QR_SIGNING_PRIVATE_KEY_PATH` and `QR_SIGNING_PUBLIC_KEY_PATH` in local `.env`.
3. Generate a QR payload once so the backend records the new public fingerprint.
4. Mark the old key row as `REVOKED` only after operational validation.

No key escrow, HSM or institutional PKI is implemented in phase 5.

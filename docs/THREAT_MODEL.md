# Threat Model

Method: STRIDE plus asset-based review for the phase 5 surface.

| Threat | Scenario | Asset | Preventive control | Detective control | Corrective control | Test | Residual risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QR tampering | Attacker changes card id in payload | Card validity | Ed25519 signature | `QR_VERIFIED` event | Reject payload | signature invalid test | Private key compromise remains critical |
| QR replay | Old QR reused | Card access | Short validity timestamp | Verification log | Rotate key or revoke card | expiry path covered in service logic | Offline replay until expiry |
| Revoked key use | QR signed by revoked key | Trust chain | Key status check | Key anomaly log | Reissue with active key | revoked key test | Admin error in key status |
| Suspended card use | Suspended card presented | School access | Card status check | QR and security logs | Reactivate or investigate | suspended card test | Status freshness depends on DB availability |
| Horizontal access | User verifies out-of-scope resource | Student/card data | Backend scope checks | Security events | Adjust scopes | scope denial test | Misconfigured scopes |
| Payment duplicate | Same simulated payment replayed | Payment ledger | Idempotency key unique constraint | replay event | Return existing tx | idempotence test | Poor client idempotency keys |
| Mock provider confusion | User believes mock is official | Trust | Generic mock labels, no logos | Documentation review | UI copy changes | documentation | Human misunderstanding |
| Attendance abuse | Repeated check-in | Attendance records | Duplicate window | duplicate event log | Correction workflow | double pointage test | Legitimate rapid corrections need review |
| Service overgrant | Entitlement used outside validity | Service access | Validity checks | verification events | Disable entitlement | service denied test | Bad configured entitlement |
| Secret leak | Private key committed | Signing key | `.gitignore private/` | secret scan and git status | Rotate key | git verification | Local filesystem exposure |

## Out of Scope

- Real payment networks.
- Official institutional identity systems.
- Biometrics.
- HSM-backed production key custody.
- Legal interpretation of personal data obligations.

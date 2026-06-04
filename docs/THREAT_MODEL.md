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

## STRIDE Completion Phase 7

| Threat | STRIDE | Boundary | Control | Test |
| --- | --- | --- | --- | --- |
| SQL injection | Tampering | API to DB | SQLAlchemy parameter binding, Pydantic validation | injection-like audit filter test |
| XSS | Tampering/Disclosure | Browser | React escaping, no HTML injection, CSP header | frontend build/lint, manual review required |
| CSRF | Spoofing | Browser to API | CSRF token on mutating routes | no-CSRF incident test |
| Session theft | Spoofing | Browser cookie | HttpOnly session cookie, expiry, rotation | phase 3 session tests |
| Brute force | DoS/Elevation | Auth endpoint | lockout and login attempts | phase 3 lockout test |
| Horizontal access | Elevation | API resources | scope checks | phase 3-6 scope tests |
| Vertical access | Elevation | API permissions | RBAC dependencies | phase 3/7 permission tests |
| Export leakage | Disclosure | API/filesystem | opaque filename, reason, RBAC, logging, expiry | phase 6 export tests |
| Backup leakage | Disclosure | filesystem | ignored backups, hash verification, local credentials | phase 7 script verification |
| Secret committed | Disclosure | Git | `.gitignore`, secret scan | phase 5-7 scans |
| QR forgery/replay | Tampering/Spoofing | verifier | Ed25519, TTL, status check | phase 5 QR tests |
| Audit alteration | Repudiation/Tampering | DB | hash chain and integrity endpoint | phase 7 tamper test |
| Key loss | DoS | local key path | documented rotation and backup requirement | documentation only |
| Excess privilege | Elevation | RBAC | role matrix and privileged MFA | phase 3 MFA/RBAC tests |
| Human error | Tampering/DoS | admin operations | confirmation for restore, docs | restore not executed |
| MySQL 5.7 dependency | DoS/Tampering | DB platform | avoid MySQL 8 syntax, compatibility docs | migrations/tests |

## Assets

- student and card records;
- session tokens and CSRF tokens;
- password hashes and MFA secrets;
- QR signing keys;
- audit and security logs;
- export files;
- backup files;
- RBAC roles, permissions and scopes;
- privacy request and retention records.

## Actors

- authenticated administrative users;
- privileged technical administrators;
- auditors;
- support users;
- unauthenticated attackers;
- users with excessive or misconfigured privileges;
- operators handling backups.

## Trust Boundaries

- browser to FastAPI API;
- FastAPI application to MySQL;
- application to local filesystem for exports, keys and backups;
- scripts to `mysql.exe` and `mysqldump.exe`;
- Git repository to ignored local secret directories.

## Abuse Cases

- direct API call to bypass a hidden frontend menu;
- out-of-scope student/card lookup;
- injection string in filters;
- forged QR payload;
- replay of an old QR payload;
- export without reason;
- backup copied outside controlled storage;
- direct database edit of an audit row;
- privileged role granted without justification.

## Residual Risks

- MySQL 5.7 does not provide modern platform protections available in newer
  versions.
- The prototype does not use WORM audit storage.
- Key custody is local-file based for development.
- Legal retention and notification rules are placeholders.
- Production monitoring and SIEM integration are not implemented.

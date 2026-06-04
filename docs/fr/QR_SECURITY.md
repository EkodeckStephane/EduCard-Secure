# QR Security

Phase 5 implements local signed QR payloads for the prototype.

## Payload Content

The payload contains only:

- format version;
- opaque identifier;
- internal card id;
- validity timestamp;
- nonce;
- signing key version;
- Ed25519 signature.

The payload does not contain names, birth dates, phone numbers, photos, detailed school data, classroom data or financial data.

## Signature

The backend signs a canonical JSON body with Ed25519. Verification checks:

- payload structure;
- key version existence;
- key status;
- public key fingerprint;
- signature;
- timestamp validity;
- card status;
- backend scope.

## Results

Verification can return:

- `valide`;
- `carte suspendue`;
- `carte revoquee`;
- `carte inconnue`;
- `signature invalide`;
- `cle inconnue`;
- `cle revoquee`;
- `identifiant expire`;
- `payload mal forme`;
- `anomalie`.

Every verification writes `qr_verification_events` and a minimized `security_events` entry.

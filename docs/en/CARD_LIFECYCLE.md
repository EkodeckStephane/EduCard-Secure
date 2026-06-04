# Card Lifecycle

Phase 4 implements the administrative lifecycle of school cards. Full signed QR generation is intentionally deferred to phase 5.

## Supported Operations

- Request a card.
- Activate a card.
- Suspend a card.
- Reactivate a card.
- Revoke a card.
- Replace a card.
- Simulate reprint/loss/damage through issuance events and minimized reasons.
- View card history.

## Statuses

Initial cards are created with `REQUESTED`. Administrative actions move cards through `ACTIVE`, `SUSPENDED`, `REVOKED` or `REPLACED`.

Replacement marks the original card as `REPLACED` and creates a new `REQUESTED` card with an incremented version.

## Security Controls

- `card:issue` is required for request, activation and replacement.
- `card:suspend` is required for suspension and reactivation.
- `card:revoke` is required for revocation.
- `card:verify` is required for listing, detail and history.
- All operations check the student's school scope through backend dependencies.
- Sensitive reads and changes are logged in `security_events`.

## Phase 5 Placeholder

Tables already contain fields for signing key metadata. Phase 4 does not create real signed QR payloads, private keys or external verifiers.

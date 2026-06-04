# Mock Payments

Phase 5 implements simulated payments only.

## Providers

The `PaymentProvider` interface has these local adapters:

- `MockMomoProvider`;
- `MockOrangeMoneyProvider`;
- `MockBankProvider`;
- `MockCashDeskProvider`.

They do not call external APIs and do not store PINs, real tokens, API keys or bank data.

## Idempotence

`payment_transactions` uses provider plus idempotency key to prevent duplicates. Replaying the same request returns the existing transaction.

## Reconciliation

Reconciliation creates a `payment_reconciliations` row and changes the transaction status to `RECONCILED`. Reconciliation is idempotent for an already reconciled transaction.

## Exports

Phase 5 documents controlled exports but does not add a bulk payment export endpoint. Future exports must use opaque references and minimized fields.

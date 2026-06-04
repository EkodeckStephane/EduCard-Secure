# Services

Phase 5 adds a generic service eligibility engine.

## Objects

- `service_types`: configurable service category.
- `service_providers`: fictitious providers only.
- `service_entitlements`: student entitlement for a period.
- `service_verification_events`: verification history.

## Verification

The backend grants access only when an entitlement is:

- attached to the student;
- attached to the requested service type;
- `ACTIVE`;
- within its validity period.

No institutional rule is hard-coded. All examples are fictitious.

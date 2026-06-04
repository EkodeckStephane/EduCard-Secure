# Audit Log

Phase 7 implements a chained append-only-style audit log for sensitive actions.

## Purpose

The audit log supports traceability for authentication, RBAC changes, scopes,
student/card operations, QR verification, exports, privacy requests, incidents,
backup events and administrative security settings.

## Event Fields

Each audit event should include:

- opaque event id;
- UTC timestamp;
- user id when authenticated;
- role summary;
- scope summary;
- action;
- resource type;
- opaque resource id;
- result;
- IP address or network context when available;
- user-agent when relevant;
- correlation id;
- justification when required;
- severity;
- hash status.

Sensitive values must not be written into the audit message. Use opaque ids and
minimal context.

## Hash Chain

`audit_event_hashes` stores:

- `previous_hash`;
- `event_hash`;
- `hash_algorithm`.

The hash is SHA-256 over canonical event material and the previous hash. The
integrity endpoint recomputes the chain in insertion order and returns `OK` or
`BROKEN` with failure details.

## API

- `POST /api/v1/audit/events`: append a controlled audit event.
- `GET /api/v1/audit/events`: filtered consultation.
- `GET /api/v1/audit/integrity`: chain verification.

All routes require backend permission checks. Mutating routes require CSRF.

## Retention

Retention is configurable through `retention_rules`. Values in this prototype
are draft records and require legal validation before production use.

## Limits

The database does not physically prevent privileged direct SQL updates.
Production use would require immutable storage, WORM export, database-level
separation of duties, or an external audit sink.

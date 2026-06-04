# Retention Policy

This is a technical draft, not a legal retention schedule.

## Prototype Rule States

- `DRAFT_LEGAL_REVIEW`: default for new retention rules.
- `ACTIVE`: only after legal and business approval.
- `RETIRED`: no longer applied.

## Technical Controls

Retention rules are stored with resource type, period, action and status. No automatic deletion is implemented in phase 7 because deletion requires explicit legal and user authorization.

## Draft Categories

- audit events;
- security events;
- export files;
- incident records;
- student administrative records;
- card lifecycle records;
- backup files;
- privacy requests.

## Legal Validation Required

- whether a record may be deleted, archived or retained;
- retention duration;
- litigation hold or investigation hold procedure;
- who can approve purge;
- evidence preservation rules after an incident.

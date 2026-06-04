# Incident Response

This document is an operational template, not a legal opinion.

## Workflow

1. Create an incident from a security event or manual report.
2. Classify category, severity and priority.
3. Assign an owner.
4. Record minimized comments and evidence references.
5. Investigate with audit, security, export and backup logs.
6. Contain the issue.
7. Resolve or close.
8. Export controlled evidence only when authorized and justified.

## Implemented Prototype Controls

- `incidents` stores status, priority, severity, assignment and resolution
  metadata.
- `incident_events` stores lifecycle changes.
- Incident creation and update are RBAC protected.
- Incident actions create audit and security events.
- Frontend screens expose incident list, creation and update for authorized
  users.

## Categories To Validate

- data leak;
- account compromise;
- privilege abuse;
- QR/card misuse;
- payment simulation inconsistency;
- backup exposure;
- operational outage;
- audit integrity failure.

## Legal And Institutional Validation Required

- notification thresholds;
- notification deadlines;
- authority or guardian communication rules;
- evidence retention period;
- roles allowed to close an incident;
- criteria for personal data breach classification.

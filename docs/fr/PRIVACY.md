# Privacy By Design

This document is not a legal opinion. It separates technical assumptions from
decisions that require human legal validation.

## Hypotheses

- The prototype uses synthetic data only.
- Production use would involve minors and therefore requires heightened
  protection.
- QR payloads must not contain direct personal data.
- Statistical views must avoid disclosure of small groups.

## Technical Controls

- Data minimization in QR payloads and dashboards.
- Small-count masking in statistics.
- Controlled exports with reason, logging and expiry.
- Synthetic demo data only.
- RBAC and scopes enforced server-side.
- Privacy requests recorded in `data_access_requests`.
- Processing register entries recorded in `data_processing_register`.
- Retention rules recorded in `retention_rules`.
- Backup files stay outside public web paths and are ignored by Git.

## Individual Requests

The prototype supports local records for access, rectification, export,
archival and deletion requests. Deletion remains controlled because production
law may require retention of some administrative records.

## Data Classification

- Critical: secrets, signing keys, session tokens, password hashes.
- Sensitive personal: student identity, attendance, card lifecycle, incidents.
- Operational: school, class, service and payment simulation metadata.
- Aggregate: dashboards and masked statistics.

## Legal Validation Required

- Lawful basis for each processing purpose.
- Retention periods.
- Individual rights workflow.
- Conditions for deletion or archival.
- Any future biometric feature.
- Incident notification obligations.
- Production data sharing and processor agreements.
- Cross-border processing, hosting and subcontractor terms.

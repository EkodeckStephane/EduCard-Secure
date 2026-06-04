# Data Processing Register

Prototype register entries are stored in `data_processing_register`.

## Minimum Fields

- purpose;
- data category;
- legal basis placeholder;
- retention reference;
- enabled flag;
- creation and update timestamps.

| Processing | Purpose | Data | Control | Legal status |
| --- | --- | --- | --- | --- |
| Student administration | Manage synthetic student lifecycle | Student identifiers, status, school references | RBAC, scopes, audit | Validate before real data |
| Card lifecycle | Manage card status and QR verification | Card identifiers, status, opaque QR ids | Signed QR, audit | Validate before real data |
| Attendance | Demonstrate school presence events | Student/card references, event type | Scope checks, correction workflow | Validate before real data |
| Services | Demonstrate configurable entitlements | Student reference, service type | Eligibility checks | Validate before real data |
| Mock payments | Demonstrate simulated reconciliation | Opaque payment refs, amount, category | Mock providers, idempotence | Validate before real data |

## Required Legal Validation

For each processing purpose, a competent human reviewer must validate lawful
basis, minimization, retention, access roles, recipient categories, individual
rights workflow and processor or subcontractor terms.

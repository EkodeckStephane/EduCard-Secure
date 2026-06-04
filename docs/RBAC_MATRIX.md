# RBAC Matrix

Permissions are enforced by backend dependencies and services. Frontend visibility is only a usability layer.

| Role | Permissions |
| --- | --- |
| SUPER_ADMIN_TECHNIQUE | user:create, user:update, role:assign, settings:update, audit:read, audit:export, student:read, card:verify |
| ADMINISTRATION_CENTRALE | student:create, student:read, student:update, student:export, card:issue, card:suspend, card:revoke, card:verify, attendance:read, payment:read, payment:reconcile, incident:create, incident:update, audit:read |
| DELEGATION_REGIONALE | student:read, student:update, card:verify, attendance:read, incident:create |
| DELEGATION_DEPARTEMENTALE | student:read, student:update, card:verify, attendance:read, incident:create |
| RESPONSABLE_ETABLISSEMENT | student:create, student:read, student:update, card:verify, attendance:read, incident:create |
| AGENT_IMMATRICULATION | student:create, student:read, student:update |
| AGENT_CARTE | student:read, card:issue, card:suspend, card:revoke, card:verify |
| AGENT_PRESENCE | student:read, attendance:create, attendance:read |
| AGENT_SERVICE | student:read, card:verify |
| AGENT_FINANCE | payment:read, payment:reconcile |
| AUDITEUR_SECURITE | audit:read, audit:export, incident:update |
| ANALYSTE_STATISTIQUE | student:read, attendance:read, payment:read |
| SUPPORT | student:read, incident:create |

## Scope rules

- `NATIONAL`: access to all configured resources.
- `REGION`: access to schools through subdivisions and departments in that region.
- `DEPARTMENT`: access to schools through subdivisions in that department.
- `SCHOOL`: access only to that school.

Horizontal access is denied when a resource belongs to another school, department or region.
Vertical access is denied when the role does not grant the required permission.


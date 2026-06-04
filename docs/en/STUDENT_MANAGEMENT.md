# Student Management

Phase 4 implements the student administrative module with synthetic data only.

## Scope

- Create a student with a generated internal matricule.
- Read a student under backend RBAC and scope controls.
- Search by name, first name or matricule.
- Filter by status and school.
- Paginate and sort server-side with bounded result windows.
- Update controlled fields with optimistic version checks.
- Archive logically by setting `status=ARCHIVED`.
- View status history.
- Detect potential duplicates without automatic merge.
- Export an individual demo payload only when `student:export` is granted.

## Matricule Rule

The internal matricule is not an official format. It is generated as:

`EDU-` + 14 uppercase hex characters derived from SHA-256 over random UUID bytes.

The value is decoupled from personal data, constrained unique in the database and retried before insertion.

## Duplicate Detection

Potential duplicates are scored with an explainable rule:

- same normalized last name: 40 points;
- same normalized first name: 30 points;
- same birth date: 20 points;
- same school: 10 points.

Candidates scoring at least 60 are returned for human validation. No destructive merge is performed.

## Sensitive Access Logging

Student list, detail, history, duplicate review and export calls write minimized `security_events` entries.

## Limits

Photo storage remains a placeholder for later phases. No biometric data and no real student data are collected.

# Enrollment Workflow

Phase 4 provides the first administrative school path workflows.

## Annual Enrollment

`POST /api/v1/enrollments` creates an annual enrollment for a student, school, classroom and school year. The backend:

- checks `student:update`;
- checks student scope;
- checks target school scope;
- updates the student's current school and classroom;
- increments `record_version`;
- records a minimized security event.

The existing database constraint prevents two enrollments for the same student and school year.

## Transfer

`POST /api/v1/transfers` creates an approved synthetic transfer. The backend:

- checks source student scope;
- checks target school scope;
- records from/to school and classroom;
- updates the student's current school and classroom;
- increments `record_version`;
- logs the operation as a high-sensitivity event.

## Administrative States

Exit and reintegration are represented in phase 4 through controlled student status updates and history entries. More detailed workflow states can be added later without relying on MySQL 8-only features.

## Limits

The module does not contact external school systems. All comments must remain minimized and synthetic in demo mode.

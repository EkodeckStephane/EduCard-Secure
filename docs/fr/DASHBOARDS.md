# Dashboards

Phase 6 adds aggregate dashboards for local synthetic data.

## Views

- General summary.
- Cards.
- Attendance.
- Simulated payments.
- Security.
- Services.

The backend applies RBAC and scope checks before calculating any metric. The frontend only hides unavailable menus for usability.

## Indicators

The summary includes active students, enrollments, schools, card statuses, issuance rate, attendance, late arrivals, absences, service validations, simulated transactions, reconciliation rate, duplicate review events, incidents, failed logins, access denied events, invalid QR events, exports and alerts.

## Privacy

Small non-zero counts below the configured threshold are returned as `MASKED`. Dashboards do not return names, birth dates, student numbers or individual records.

## Filters

Phase 6 supports school, region and department filters in the backend service. The schema also reserves period, school year, classroom, grade, status, service and severity filters for extension.

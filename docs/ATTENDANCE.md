# Attendance

Phase 5 implements a local attendance module.

## Events

Supported event types:

- `ENTRY`;
- `EXIT`;
- `LATE`;
- `ABSENCE`.

Attendance can be recorded manually with a student id or through an active card id or serial number. The backend checks school scope and card/student scope.

## Duplicate Handling

Repeated identical events for the same student, school and event type within a short window return the existing event and log `ATTENDANCE_DUPLICATE_REJECTED`.

## Corrections

Corrections are created in `attendance_corrections`, then approved through a separate endpoint. Approval updates the event value and records a high-sensitivity security event.

## Biometrics

`BiometricProvider` exists only as a disabled interface. Any activation would require impact assessment, legal validation and additional security controls.

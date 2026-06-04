# Alerting

Alerts in phase 7 are derived from `security_events` with `HIGH` or `CRITICAL`
severity.

## Covered Signals

- repeated failed authentication;
- forbidden access patterns;
- privilege escalation attempts;
- privileged role assignment;
- scope change;
- MFA disablement;
- invalid QR;
- revoked card use;
- unusual export or mass extraction signal;
- critical setting change;
- retention rule change;
- audit chain break;
- backup restore event;
- duplicate simulated payment;
- reconciliation inconsistency;
- unusual attendance behavior.

## Workflow

1. Security event is created.
2. Alert list exposes high and critical events.
3. Authorized user acknowledges the alert.
4. A notification event and a security event are written.
5. If needed, an incident is opened and linked manually through comments or
   opaque ids.

## API

- `GET /api/v1/alerts`
- `POST /api/v1/alerts/{security_event_id}/ack`

## Future Production Requirements

- assignment owner;
- SLA timers;
- escalation matrix;
- out-of-band notification;
- evidence preservation;
- institutional incident classification.

These requirements need operational and legal validation.

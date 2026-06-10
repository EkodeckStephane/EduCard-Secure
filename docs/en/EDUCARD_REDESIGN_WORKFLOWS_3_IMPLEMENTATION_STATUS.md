# Volume 3 redesign implementation status

This document tracks `docs/fr/EDUCARD_REDESIGN_WORKFLOWS_3.md`.

## Status

Workflows 15, 16 and 17 are implemented and locally verified.

## Student record

- dedicated `/scolarite/eleves/:id` page with URL-persisted active tab;
- lightweight preview retained in the student list;
- eight tabs: Summary, Identity, Enrollment, Card, Services, History, Duplicates and Audit;
- HTTP 409 optimistic-lock response with the current record;
- withdrawal, reenrollment and structured-reason archiving;
- coordinated closure or suspension of active enrollments, cards and entitlements;
- human duplicate decisions without automatic destructive merging.

## Specialized dashboards

- five pages for cards, attendance, mock payments, security and services;
- KPI blocks, charts, aggregate tables, pagination, sorting, per-column filtering and scoped drill-down;
- URL-persisted filters propagated from the central dashboard;
- backend filtering by scope, region, department and school for school-bound data;
- twenty specialized endpoints, including the additional payment KPI endpoint.

## Backups

- read-only page with four summary indicators, pagination, sorting, per-column filters, badges and a detail panel;
- `checksum_present`, `file_size_bytes` and `operator` metadata;
- internal `POST /api/v1/backups/log` endpoint excluded from OpenAPI and protected by a service token;
- backup, verification and restore scripts connected to the application event log;
- no restoration was executed.

## Verification

- MySQL 5.7 migration: `0006_redesign_workflows_volume3 (head)`;
- backend: `27 passed`;
- frontend: `7 passed`;
- Playwright: `4 passed`;
- frontend build and lint: passed;
- local backup created, SHA-256 checksum verified and two events logged;
- `.env`, `backups/` and `private/` are ignored by Git.

## Limitations

- legacy security events do not always contain a school reference, limiting territorial filtering;
- the legacy main bundle remains above 500 KB after minification;
- `datetime.utcnow()` deprecation warnings remain.

# EduCard redesign implementation status

This document tracks `docs/fr/EDUCARD_REDESIGN_WORKFLOWS.md`.

## Status

All Volume 1 functional requirements are implemented.

## Implemented

- searchable selectors without raw technical ID entry;
- detail panels, enrollment wizard, photo handling, duplicate review and history;
- chained student, enrollment and card-request creation;
- complete card lifecycle with reasons, confirmations and timeline;
- camera QR scanner with manual fallback, including attendance;
- attendance corrections and permission-separated approval;
- dashboard filters persisted in the URL;
- real period comparisons, trends and role-specific widgets;
- user creation, hierarchical scopes and TOTP MFA;
- server-generated CR80 PDF with photo and short-lived print QR;
- detailed alert and incident workflows;
- mandatory reasons for sensitive exports;
- URL routing, global loading, toasts and centralized API error handling;
- bilingual coverage for redesigned workflows;
- backend RBAC and scope enforcement;
- authenticated browser-driven E2E coverage.

## Executed checks

- backend: `24 passed`;
- frontend unit tests: `7 passed`;
- authenticated Playwright E2E: `1 passed`;
- frontend lint and build: passed;
- Python compilation: passed;
- active migration: `0005_complete_redesign_workflows (head)`;
- synthetic login, URL navigation and logout: verified.

## Limitations

- the main legacy bundle remains larger than 500 KB after minification despite
  dynamic workflow splitting;
- tests report `datetime.utcnow` deprecation warnings without functional failures.

## Out of scope

No Volume 1 functional requirement remains deferred.

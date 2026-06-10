# Volume 2 redesign implementation status

This document tracks `docs/fr/EDUCARD_REDESIGN_WORKFLOWS_2.md`.

## Status

All Volume 2 requirements are implemented except the explicitly out-of-scope
items listed below.

## Implemented

- filtered, paginated and verifiable audit log;
- global and per-entry audit-chain integrity checks;
- alert and incident workflows with comments, assignment, timeline and transitions;
- active-session listing and revocation;
- per-user theme and language preferences;
- configurable services, mock providers, entitlements and eligibility;
- simulated payments, configurable failures, idempotency and batch reconciliation;
- controlled exports with reasons, filters, checksums and download tracking;
- final data-request transitions;
- Ed25519-signed personal JSON portability export;
- processing register and retention rules;
- hierarchical validation for regions, departments, subdivisions, schools and classes;
- controlled academic-level activation;
- server-side CR80 PDF with photo and dedicated short-lived print QR;
- URL routing and dashboard-filter persistence;
- dynamic splitting of Volume 2 screens;
- centralized bilingual coverage for Volume 2 labels;
- authenticated browser coverage for navigation, sessions, services and logout.

## Executed checks

- complete backend suite: `24 passed`;
- frontend unit tests: `7 passed`;
- Playwright E2E: `1 passed`;
- frontend lint and build: passed;
- MySQL migration: `0005_complete_redesign_workflows (head)`;
- PDF, print QR, signed portability and multi-reference validation: covered by tests.

## Out of scope

- real SMS operator integration;
- automatic backup restoration.

SMS remains a local simulation. Restoration remains a manual operation requiring
explicit confirmation under the project's security rules.

## Limitations

- no real restoration was executed;
- the legacy main bundle remains large despite dynamic splitting;
- legal decisions for portability and retention require human validation.

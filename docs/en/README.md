# EduCard Secure Documentation

This directory contains English documentation.

## Maintenance Rule

All new documentation must be maintained in two languages:

- French version in `docs/fr`;
- English version in `docs/en`.

Historical files directly under `docs` are kept for compatibility with already
completed phase references.

## Application Language

The application exposes a per-user `preferred_language` setting with `fr` and
`en` values. The frontend uses this setting to display primary labels in the
user's language.

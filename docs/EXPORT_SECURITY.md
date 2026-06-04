# Export Security

Phase 6 implements controlled CSV exports.

## Controls

- `export:create` is required to create an export.
- `export:download` is required to download an export.
- `student:export` is additionally required for individual student exports.
- Mutating export endpoints require CSRF.
- A reason is mandatory.
- File names are opaque: `export_<uuid>.csv`.
- Files are stored under `exports/`, which is outside public frontend assets and ignored by Git.
- Exports expire after 24 hours in the prototype.
- Creation and download are logged in `security_events` and `export_events`.

## Data Minimization

Dashboard exports contain aggregate metrics only. Individual exports are explicitly separated and permission-gated.

## Integrity

The backend stores a SHA-256 digest in the `ExportEvent.event_type` string for the prototype. A production design should add dedicated hash columns and immutable storage.

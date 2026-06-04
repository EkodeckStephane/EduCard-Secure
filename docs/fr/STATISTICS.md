# Statistics

## Query Strategy

Statistics use SQLAlchemy aggregate queries compatible with MySQL 5.7:

- `COUNT`;
- `GROUP BY`;
- ordinary joins;
- bounded lists.

The implementation avoids CTEs, window functions, JSON operators and MySQL 8-only syntax.

## Outputs

The API returns:

- aggregate metrics;
- distributions for bar charts;
- table-ready rows;
- rates calculated in application code.

Time-series and heatmap placeholders are represented by the response shape and can be expanded without changing the API family.

## Performance

Existing indexes used by phase 6 include:

- `students.current_school_id`;
- `cards.student_id/status`;
- `attendance_events.school_id/event_time`;
- `payment_transactions.school_id/school_year_id/status`;
- `security_events.event_type/created_at`;
- `exports.requested_by` through direct filtering.

Local response targets are sub-second for demo-sized datasets. Larger datasets should add materialized aggregate tables or scheduled snapshots.

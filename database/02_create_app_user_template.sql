-- EduCard Secure - create dedicated application user template.
-- Replace the placeholder locally before execution.
-- Do not commit a real password.

CREATE USER IF NOT EXISTS 'educard_app'@'localhost'
  IDENTIFIED BY '<REPLACE_WITH_LOCAL_STRONG_PASSWORD>';

CREATE USER IF NOT EXISTS 'educard_app'@'127.0.0.1'
  IDENTIFIED BY '<REPLACE_WITH_LOCAL_STRONG_PASSWORD>';

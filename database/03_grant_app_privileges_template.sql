-- EduCard Secure - least privilege grants for educard_app.
-- No global privilege is granted.

-- Normal runtime privileges after migrations:
GRANT SELECT, INSERT, UPDATE, DELETE
ON `educard_secure`.*
TO 'educard_app'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE
ON `educard_secure`.*
TO 'educard_app'@'127.0.0.1';

-- Temporary migration privileges.
-- Grant only while running Alembic migrations, then revoke if the same account is used.
GRANT CREATE, ALTER, INDEX, REFERENCES
ON `educard_secure`.*
TO 'educard_app'@'localhost';

GRANT CREATE, ALTER, INDEX, REFERENCES
ON `educard_secure`.*
TO 'educard_app'@'127.0.0.1';

-- After migrations, remove temporary privileges with:
-- REVOKE CREATE, ALTER, INDEX, REFERENCES ON `educard_secure`.* FROM 'educard_app'@'localhost';
-- REVOKE CREATE, ALTER, INDEX, REFERENCES ON `educard_secure`.* FROM 'educard_app'@'127.0.0.1';

-- DROP is intentionally not granted by default.
-- Grant DROP only for an explicitly authorized downgrade or table removal procedure.

FLUSH PRIVILEGES;

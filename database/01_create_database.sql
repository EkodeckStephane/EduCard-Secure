-- EduCard Secure - create application database only.
-- Compatible with MySQL Server 5.7.
-- Non destructive: does not drop or alter existing databases.

CREATE DATABASE IF NOT EXISTS `educard_secure`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

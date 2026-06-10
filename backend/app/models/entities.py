from datetime import datetime

from sqlalchemy import (
    DECIMAL,
    BigInteger,
    Boolean,
    CHAR,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.mysql import BIGINT as MySQLBigInteger

from app.models.base import Base


MYSQL_TABLE = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
ID_TYPE = BigInteger().with_variant(MySQLBigInteger(unsigned=True), "mysql")


def utcnow() -> datetime:
    return datetime.utcnow()


class IdMixin:
    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class CreatedByMixin:
    created_by: Mapped[int | None] = mapped_column(ID_TYPE, nullable=True)


class PublicIdMixin:
    public_id: Mapped[str] = mapped_column(CHAR(36), unique=True, nullable=False, index=True)


class User(Base, IdMixin, PublicIdMixin, TimestampMixin):
    """Application user account."""

    __tablename__ = "users"
    __table_args__ = (Index("ix_users_status", "status"), MYSQL_TABLE)

    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email_masked: Mapped[str | None] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ACTIVE")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)
    mfa_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    preferred_language: Mapped[str] = mapped_column(String(5), default="fr", nullable=False)
    preferred_theme: Mapped[str] = mapped_column(String(10), default="system", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Role(Base, IdMixin):
    """RBAC role."""

    __tablename__ = "roles"
    __table_args__ = MYSQL_TABLE

    code: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_privileged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Permission(Base, IdMixin):
    """Atomic permission used by backend authorization."""

    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("resource", "action", name="uq_permissions_resource_action"), MYSQL_TABLE)

    code: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    resource: Mapped[str] = mapped_column(String(80), nullable=False)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class UserRole(Base):
    """User-role assignment."""

    __tablename__ = "user_roles"
    __table_args__ = MYSQL_TABLE

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class RolePermission(Base):
    """Role-permission assignment."""

    __tablename__ = "role_permissions"
    __table_args__ = MYSQL_TABLE

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.id"), primary_key=True)


class Region(Base, IdMixin, TimestampMixin):
    """Administrative region, synthetic in demo mode."""

    __tablename__ = "regions"
    __table_args__ = MYSQL_TABLE

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    capital: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Department(Base, IdMixin, TimestampMixin):
    """Administrative department."""

    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("region_id", "code", name="uq_departments_region_code"), MYSQL_TABLE)

    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    capital: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Subdivision(Base, IdMixin, TimestampMixin):
    """Administrative subdivision."""

    __tablename__ = "subdivisions"
    __table_args__ = (UniqueConstraint("department_id", "code", name="uq_subdivisions_department_code"), MYSQL_TABLE)

    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    capital: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class School(Base, IdMixin, PublicIdMixin, TimestampMixin):
    """School entity; demo rows must be fictitious."""

    __tablename__ = "schools"
    __table_args__ = (UniqueConstraint("subdivision_id", "code", name="uq_schools_subdivision_code"), MYSQL_TABLE)

    subdivision_id: Mapped[int] = mapped_column(ForeignKey("subdivisions.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    school_type: Mapped[str] = mapped_column(String(80), nullable=False)
    education_subsystem: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class SchoolYear(Base, IdMixin):
    """School year reference."""

    __tablename__ = "school_years"
    __table_args__ = MYSQL_TABLE

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    starts_on: Mapped[datetime] = mapped_column(Date, nullable=False)
    ends_on: Mapped[datetime] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)


class GradeLevel(Base, IdMixin):
    """Grade level reference."""

    __tablename__ = "grade_levels"
    __table_args__ = MYSQL_TABLE

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    education_subsystem: Mapped[str] = mapped_column(String(80), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    cycle: Mapped[str | None] = mapped_column(String(80))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Classroom(Base, IdMixin, TimestampMixin):
    """Classroom attached to a school and year."""

    __tablename__ = "classrooms"
    __table_args__ = (UniqueConstraint("school_id", "school_year_id", "code", name="uq_classrooms_school_year_code"), MYSQL_TABLE)

    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"), nullable=False, index=True)
    school_year_id: Mapped[int] = mapped_column(ForeignKey("school_years.id"), nullable=False, index=True)
    grade_level_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(60), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class UserScope(Base, IdMixin, TimestampMixin):
    """Geographic or school scope restricting a user."""

    __tablename__ = "user_scopes"
    __table_args__ = (Index("ix_user_scopes_user_scope", "user_id", "scope_type"), MYSQL_TABLE)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    scope_type: Mapped[str] = mapped_column(String(40), nullable=False)
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"))
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id"))
    valid_from: Mapped[datetime | None] = mapped_column(DateTime)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime)


class Session(Base, IdMixin):
    """Server-side session with opaque token hashes."""

    __tablename__ = "sessions"
    __table_args__ = (Index("ix_sessions_user_expires", "user_id", "expires_at"), MYSQL_TABLE)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    session_token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    csrf_token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_context: Mapped[str | None] = mapped_column(String(80))
    user_agent_hash: Mapped[str | None] = mapped_column(String(255))
    user_agent_summary: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_active_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)


class MfaMethod(Base, IdMixin):
    """MFA method metadata; secrets are encrypted outside Git."""

    __tablename__ = "mfa_methods"
    __table_args__ = MYSQL_TABLE

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    method_type: Mapped[str] = mapped_column(String(40), nullable=False)
    secret_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime)
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime)


class PasswordHistory(Base, IdMixin):
    """Limited password hash history."""

    __tablename__ = "password_history"
    __table_args__ = MYSQL_TABLE

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class LoginAttempt(Base, IdMixin):
    """Authentication attempt log."""

    __tablename__ = "login_attempts"
    __table_args__ = (Index("ix_login_attempts_username_time", "username", "attempted_at"), MYSQL_TABLE)

    username: Mapped[str] = mapped_column(String(80), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    result: Mapped[str] = mapped_column(String(40), nullable=False)
    ip_context: Mapped[str | None] = mapped_column(String(80))
    attempted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class SecurityEvent(Base, IdMixin):
    """Security event for alerts and investigations."""

    __tablename__ = "security_events"
    __table_args__ = (Index("ix_security_events_type_time", "event_type", "created_at"), MYSQL_TABLE)

    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    severity: Mapped[str] = mapped_column(String(40), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resource_type: Mapped[str | None] = mapped_column(String(80))
    resource_public_id: Mapped[str | None] = mapped_column(String(80))
    details_minimized: Mapped[str | None] = mapped_column(Text)
    alert_status: Mapped[str] = mapped_column(String(40), default="OPEN", nullable=False)
    acknowledged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime)
    acknowledgement_comment: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    resolution_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class AuditEvent(Base, IdMixin):
    """Append-only audit event."""

    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_resource", "resource_type", "resource_public_id"), Index("ix_audit_events_time", "occurred_at"), MYSQL_TABLE)

    event_public_id: Mapped[str] = mapped_column(CHAR(36), unique=True, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    actor_role_code: Mapped[str | None] = mapped_column(String(80))
    scope_summary: Mapped[str | None] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(80), nullable=False)
    resource_public_id: Mapped[str | None] = mapped_column(String(80))
    result: Mapped[str] = mapped_column(String(40), nullable=False)
    correlation_id: Mapped[str | None] = mapped_column(String(80))
    justification: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(40), default="INFO", nullable=False)


class AuditEventHash(Base, IdMixin):
    """Hash chain material for audit integrity."""

    __tablename__ = "audit_event_hashes"
    __table_args__ = MYSQL_TABLE

    audit_event_id: Mapped[int] = mapped_column(ForeignKey("audit_events.id"), unique=True, nullable=False)
    previous_hash: Mapped[str | None] = mapped_column(String(128))
    event_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    hash_algorithm: Mapped[str] = mapped_column(String(40), default="SHA-256", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Student(Base, IdMixin, PublicIdMixin, TimestampMixin, CreatedByMixin):
    """Synthetic student record."""

    __tablename__ = "students"
    __table_args__ = (Index("ix_students_name", "last_name", "first_name"), MYSQL_TABLE)

    student_number: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    birth_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    gender: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE", nullable=False)
    current_school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id"))
    current_classroom_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id"))
    record_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class StudentGuardian(Base, IdMixin, TimestampMixin):
    """Optional synthetic guardian contact."""

    __tablename__ = "student_guardians"
    __table_args__ = MYSQL_TABLE

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    relationship: Mapped[str] = mapped_column(String(60), nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    contact_masked: Mapped[str | None] = mapped_column(String(120))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Enrollment(Base, IdMixin, TimestampMixin):
    """Annual school enrollment."""

    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("student_id", "school_year_id", name="uq_enrollments_student_year"), MYSQL_TABLE)

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"), nullable=False, index=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id"), nullable=False, index=True)
    school_year_id: Mapped[int] = mapped_column(ForeignKey("school_years.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    validated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Transfer(Base, IdMixin, TimestampMixin):
    """Student transfer workflow."""

    __tablename__ = "transfers"
    __table_args__ = MYSQL_TABLE

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    from_school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"), nullable=False)
    to_school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"), nullable=False)
    from_classroom_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id"))
    to_classroom_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id"))
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class StudentStatusHistory(Base, IdMixin):
    """Student status history."""

    __tablename__ = "student_status_history"
    __table_args__ = MYSQL_TABLE

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    previous_status: Mapped[str | None] = mapped_column(String(40))
    new_status: Mapped[str] = mapped_column(String(40), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255))
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class SigningKeyVersion(Base, IdMixin):
    """Public metadata for QR signing keys."""

    __tablename__ = "signing_key_versions"
    __table_args__ = MYSQL_TABLE

    key_version: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    public_key_fingerprint: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Card(Base, IdMixin, PublicIdMixin, TimestampMixin):
    """Digital school card."""

    __tablename__ = "cards"
    __table_args__ = (Index("ix_cards_student_status", "student_id", "status"), MYSQL_TABLE)

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    card_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    signing_key_version_id: Mapped[int | None] = mapped_column(ForeignKey("signing_key_versions.id"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CardStatusHistory(Base, IdMixin):
    """Card status history."""

    __tablename__ = "card_status_history"
    __table_args__ = MYSQL_TABLE

    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id"), nullable=False, index=True)
    previous_status: Mapped[str | None] = mapped_column(String(40))
    new_status: Mapped[str] = mapped_column(String(40), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255))
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class CardIssuanceEvent(Base, IdMixin):
    """Card issuance, print and replacement events."""

    __tablename__ = "card_issuance_events"
    __table_args__ = MYSQL_TABLE

    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    processed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    details_minimized: Mapped[str | None] = mapped_column(Text)


class QrVerificationEvent(Base, IdMixin):
    """QR verification log."""

    __tablename__ = "qr_verification_events"
    __table_args__ = (Index("ix_qr_verification_events_time", "verified_at"), MYSQL_TABLE)

    card_id: Mapped[int | None] = mapped_column(ForeignKey("cards.id"))
    opaque_identifier: Mapped[str] = mapped_column(String(120), nullable=False)
    verification_result: Mapped[str] = mapped_column(String(60), nullable=False)
    reason_code: Mapped[str | None] = mapped_column(String(80))
    verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    correlation_id: Mapped[str | None] = mapped_column(String(80))


class AttendanceEvent(Base, IdMixin):
    """Attendance event."""

    __tablename__ = "attendance_events"
    __table_args__ = (Index("ix_attendance_events_school_time", "school_id", "event_time"), MYSQL_TABLE)

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    card_id: Mapped[int | None] = mapped_column(ForeignKey("cards.id"))
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"), nullable=False, index=True)
    classroom_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id"))
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    event_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AttendanceCorrection(Base, IdMixin):
    """Validated attendance correction."""

    __tablename__ = "attendance_corrections"
    __table_args__ = MYSQL_TABLE

    attendance_event_id: Mapped[int] = mapped_column(ForeignKey("attendance_events.id"), nullable=False, index=True)
    previous_value: Mapped[str] = mapped_column(Text, nullable=False)
    new_value: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)


class ServiceType(Base, IdMixin):
    """Configurable service type."""

    __tablename__ = "service_types"
    __table_args__ = MYSQL_TABLE

    code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(80))
    icon: Mapped[str | None] = mapped_column(String(80))
    eligibility_rules: Mapped[str | None] = mapped_column(Text)
    calendar_rules: Mapped[str | None] = mapped_column(Text)
    consumption_limits: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ServiceProvider(Base, IdMixin, PublicIdMixin):
    """Fictitious or mock service provider."""

    __tablename__ = "service_providers"
    __table_args__ = MYSQL_TABLE

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(80), nullable=False)
    code: Mapped[str | None] = mapped_column(String(60), unique=True)
    contact_name: Mapped[str | None] = mapped_column(String(160))
    phone_masked: Mapped[str | None] = mapped_column(String(80))
    school_ids: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ServiceEntitlement(Base, IdMixin, TimestampMixin):
    """Student entitlement to a configurable service."""

    __tablename__ = "service_entitlements"
    __table_args__ = (Index("ix_service_entitlements_student_status", "student_id", "status"), MYSQL_TABLE)

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    service_type_id: Mapped[int] = mapped_column(ForeignKey("service_types.id"), nullable=False)
    service_provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id"), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    notes_minimized: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ServiceVerificationEvent(Base, IdMixin):
    """Service eligibility verification."""

    __tablename__ = "service_verification_events"
    __table_args__ = MYSQL_TABLE

    service_entitlement_id: Mapped[int | None] = mapped_column(ForeignKey("service_entitlements.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    card_id: Mapped[int | None] = mapped_column(ForeignKey("cards.id"))
    result: Mapped[str] = mapped_column(String(60), nullable=False)
    verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class PaymentProvider(Base, IdMixin):
    """Mock payment provider."""

    __tablename__ = "payment_providers"
    __table_args__ = MYSQL_TABLE

    code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(80), nullable=False)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)


class PaymentTransaction(Base, IdMixin, PublicIdMixin):
    """Synthetic payment transaction."""

    __tablename__ = "payment_transactions"
    __table_args__ = (
        UniqueConstraint("payment_provider_id", "opaque_reference", name="uq_payment_provider_reference"),
        UniqueConstraint("payment_provider_id", "idempotency_key", name="uq_payment_provider_idempotency"),
        Index("ix_payment_transactions_school_year_status", "school_id", "school_year_id", "status"),
        MYSQL_TABLE,
    )

    payment_provider_id: Mapped[int] = mapped_column(ForeignKey("payment_providers.id"), nullable=False)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"))
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"), nullable=False)
    school_year_id: Mapped[int] = mapped_column(ForeignKey("school_years.id"), nullable=False)
    opaque_reference: Mapped[str] = mapped_column(String(120), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[float] = mapped_column(DECIMAL(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="XAF", nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    external_reference: Mapped[str | None] = mapped_column(String(120))
    error_code: Mapped[str | None] = mapped_column(String(80))
    notes_minimized: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PaymentReconciliation(Base, IdMixin):
    """Payment reconciliation record."""

    __tablename__ = "payment_reconciliations"
    __table_args__ = MYSQL_TABLE

    payment_transaction_id: Mapped[int] = mapped_column(ForeignKey("payment_transactions.id"), nullable=False, index=True)
    reconciliation_status: Mapped[str] = mapped_column(String(60), nullable=False)
    matched_at: Mapped[datetime | None] = mapped_column(DateTime)
    matched_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    notes_minimized: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Incident(Base, IdMixin, PublicIdMixin, TimestampMixin):
    """Incident or anomaly register."""

    __tablename__ = "incidents"
    __table_args__ = (Index("ix_incidents_status_severity", "status", "severity"), MYSQL_TABLE)

    category: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str | None] = mapped_column(String(120))
    description_minimized: Mapped[str | None] = mapped_column(Text)
    resource_type: Mapped[str | None] = mapped_column(String(80))
    resource_public_id: Mapped[str | None] = mapped_column(String(80))
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime)
    priority: Mapped[str] = mapped_column(String(40), nullable=False)
    severity: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class IncidentEvent(Base, IdMixin):
    """Incident event history."""

    __tablename__ = "incident_events"
    __table_args__ = MYSQL_TABLE

    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    comment_minimized: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class DataAccessRequest(Base, IdMixin, PublicIdMixin, TimestampMixin):
    """Privacy request concerning a data subject."""

    __tablename__ = "data_access_requests"
    __table_args__ = MYSQL_TABLE

    request_type: Mapped[str] = mapped_column(String(80), nullable=False)
    subject_type: Mapped[str] = mapped_column(String(80), nullable=False)
    subject_last_name: Mapped[str | None] = mapped_column(String(120))
    subject_first_name: Mapped[str | None] = mapped_column(String(120))
    subject_contact_masked: Mapped[str | None] = mapped_column(String(160))
    request_object: Mapped[str | None] = mapped_column(Text)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"))
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)


class RetentionRule(Base, IdMixin, TimestampMixin):
    """Retention rule requiring legal validation."""

    __tablename__ = "retention_rules"
    __table_args__ = MYSQL_TABLE

    resource_type: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(160))
    trigger_type: Mapped[str | None] = mapped_column(String(80))
    duration_unit: Mapped[str | None] = mapped_column(String(20))
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime)
    retention_period_days: Mapped[int | None] = mapped_column(Integer)
    action_on_expiry: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)


class DataProcessingRegister(Base, IdMixin, TimestampMixin):
    """Data processing register entry."""

    __tablename__ = "data_processing_register"
    __table_args__ = MYSQL_TABLE

    processing_name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    data_categories: Mapped[str] = mapped_column(Text, nullable=False)
    legal_basis_note: Mapped[str | None] = mapped_column(Text)
    data_subjects: Mapped[str | None] = mapped_column(Text)
    controller_name: Mapped[str | None] = mapped_column(String(255))
    processors_note: Mapped[str | None] = mapped_column(Text)
    security_measures: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE", nullable=False)
    retention_note: Mapped[str | None] = mapped_column(Text)
    requires_legal_validation: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Export(Base, IdMixin, PublicIdMixin):
    """Controlled export metadata."""

    __tablename__ = "exports"
    __table_args__ = MYSQL_TABLE

    export_type: Mapped[str] = mapped_column(String(80), nullable=False)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    format: Mapped[str] = mapped_column(String(20), default="CSV", nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    filters_json: Mapped[str | None] = mapped_column(Text)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64))
    downloaded_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ExportEvent(Base, IdMixin):
    """Export lifecycle event."""

    __tablename__ = "export_events"
    __table_args__ = MYSQL_TABLE

    export_id: Mapped[int] = mapped_column(ForeignKey("exports.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class ConfigurationSetting(Base, IdMixin):
    """Application setting; sensitive values must be encrypted."""

    __tablename__ = "configuration_settings"
    __table_args__ = MYSQL_TABLE

    setting_key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    setting_value_encrypted: Mapped[str | None] = mapped_column(Text)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class NotificationEvent(Base, IdMixin):
    """Local or simulated notification event."""

    __tablename__ = "notification_events"
    __table_args__ = MYSQL_TABLE

    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    recipient_scope: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class AdministrativeValidation(Base, IdMixin, TimestampMixin):
    """Hierarchical validation request for administrative reference data."""

    __tablename__ = "administrative_validations"
    __table_args__ = (Index("ix_admin_validation_status_type", "status", "entity_type"), MYSQL_TABLE)

    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[int] = mapped_column(ID_TYPE, nullable=False)
    entity_label: Mapped[str] = mapped_column(String(180), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="PENDING_VALIDATION", nullable=False)
    justification: Mapped[str | None] = mapped_column(Text)
    proposed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    review_comment: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)


class BackupEvent(Base, IdMixin):
    """Backup or restore event."""

    __tablename__ = "backup_events"
    __table_args__ = MYSQL_TABLE

    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    file_reference: Mapped[str | None] = mapped_column(String(255))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    checksum_present: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    operator: Mapped[str | None] = mapped_column(String(120))

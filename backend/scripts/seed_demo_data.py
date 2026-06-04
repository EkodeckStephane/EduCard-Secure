from datetime import UTC, date, datetime
from pathlib import Path
import sys
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.entities import (
    Card,
    Classroom,
    Department,
    Enrollment,
    Incident,
    PaymentProvider,
    PaymentTransaction,
    Region,
    Role,
    School,
    SchoolYear,
    Student,
    Subdivision,
    User,
    UserRole,
    UserScope,
)
from app.security.passwords import hash_password


def ensure_demo_user(session, username: str, display_name: str, password: str, role_code: str, scope_type: str, region_id: int | None = None, school_id: int | None = None) -> None:
    user = session.execute(select(User).filter_by(username=username)).scalar_one_or_none()
    if not user:
        user = User(
            public_id=str(uuid4()),
            username=username,
            display_name=display_name,
            password_hash=hash_password(password),
            status="ACTIVE",
            preferred_language="fr",
            mfa_required=False,
            is_demo=True,
        )
        session.add(user)
        session.flush()
    role = session.execute(select(Role).filter_by(code=role_code)).scalar_one()
    if not session.execute(select(UserRole).filter_by(user_id=user.id, role_id=role.id)).scalar_one_or_none():
        session.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=user.id))
    if not session.execute(select(UserScope).filter_by(user_id=user.id, scope_type=scope_type, region_id=region_id, school_id=school_id)).scalar_one_or_none():
        session.add(UserScope(user_id=user.id, scope_type=scope_type, region_id=region_id, school_id=school_id))


def main() -> None:
    with SessionLocal() as session:
        region = session.execute(select(Region).filter_by(code="DEMO-CENTRAL")).scalar_one()
        ensure_demo_user(session, "demo.central", "Demo Administration Centrale", "DemoCentral!12345", "ADMINISTRATION_CENTRALE", "NATIONAL")
        ensure_demo_user(session, "demo.regional", "Demo Delegation Regionale", "DemoRegional!12345", "DELEGATION_REGIONALE", "REGION", region_id=region.id)
        existing_school = session.execute(select(School).filter_by(code="DEMO-SCH-001")).scalar_one_or_none()
        if existing_school:
            ensure_demo_user(session, "demo.school", "Demo Responsable Etablissement", "DemoSchool!12345", "RESPONSABLE_ETABLISSEMENT", "SCHOOL", school_id=existing_school.id)
            session.commit()
            print("Synthetic demo data already loaded.")
            return
        department = Department(region_id=region.id, code="DEMO-DPT-01", name="Departement Demo 01", is_demo=True)
        session.add(department)
        session.flush()
        subdivision = Subdivision(department_id=department.id, code="DEMO-ARR-01", name="Arrondissement Demo 01", is_demo=True)
        session.add(subdivision)
        session.flush()
        school = School(
            public_id=str(uuid4()),
            subdivision_id=subdivision.id,
            code="DEMO-SCH-001",
            name="College Demo Horizon",
            school_type="GENERAL",
            education_subsystem="DEMO",
            status="ACTIVE",
            is_demo=True,
        )
        session.add(school)
        session.flush()
        ensure_demo_user(session, "demo.school", "Demo Responsable Etablissement", "DemoSchool!12345", "RESPONSABLE_ETABLISSEMENT", "SCHOOL", school_id=school.id)
        year = session.execute(select(SchoolYear).filter_by(code="2026-2027")).scalar_one()
        classroom = Classroom(school_id=school.id, school_year_id=year.id, grade_level_id=1, code="6E-A", label="6e Demo A", is_demo=True)
        session.add(classroom)
        session.flush()

        for idx in range(1, 26):
            student = Student(
                public_id=str(uuid4()),
                student_number=f"DEMO-STU-2026-{idx:04d}",
                last_name=f"NomDemo{idx:04d}",
                first_name=f"PrenomDemo{idx:04d}",
                birth_date=date(2012, (idx % 12) + 1, (idx % 27) + 1),
                gender="DEMO",
                status="ACTIVE",
                current_school_id=school.id,
                current_classroom_id=classroom.id,
                is_demo=True,
            )
            session.add(student)
            session.flush()
            session.add(Enrollment(student_id=student.id, school_id=school.id, classroom_id=classroom.id, school_year_id=year.id, status="ACTIVE", is_demo=True))
            now = datetime.now(UTC).replace(tzinfo=None)
            card = Card(public_id=str(uuid4()), student_id=student.id, serial_number=f"DEMO-CARD-{idx:05d}", status="ACTIVE", issued_at=now, activated_at=now, is_demo=True)
            session.add(card)

        provider = session.execute(select(PaymentProvider).filter_by(code="MOCK_MOMO")).scalar_one()
        session.add(PaymentTransaction(public_id=str(uuid4()), payment_provider_id=provider.id, school_id=school.id, school_year_id=year.id, opaque_reference="DEMO-PAY-0001", idempotency_key="DEMO-IDEMP-0001", amount=1000, category="DEMO_FEES", status="SUCCESS", is_demo=True))
        session.add(Incident(public_id=str(uuid4()), category="DEMO_ANOMALY", priority="LOW", severity="LOW", status="OPEN", is_demo=True))
        session.commit()
        print("Synthetic demo data loaded.")


if __name__ == "__main__":
    main()

from datetime import UTC, date, datetime, timedelta
from pathlib import Path
import sys
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.models.entities import (
    AttendanceEvent,
    Card,
    Classroom,
    Department,
    Enrollment,
    GradeLevel,
    Incident,
    PaymentProvider,
    PaymentReconciliation,
    PaymentTransaction,
    Region,
    Role,
    School,
    SchoolYear,
    ServiceEntitlement,
    ServiceProvider,
    ServiceType,
    Student,
    StudentGuardian,
    Subdivision,
    User,
    UserRole,
    UserScope,
)
from app.security.passwords import hash_password
from scripts.seed_cameroon_administrative_data import main as seed_cameroon_administrative_data


DEMO_SCHOOLS = [
    {
        "legacy_code": "DEMO-SCH-001",
        "code": "FIC-LYC-NKAK-001",
        "name": "Lycee fictif de Nlongkak",
        "subdivision_code": "YAOUNDE-1ER",
        "type": "LYCEE_GENERAL",
        "subsystem": "GENERAL_FR",
    },
    {
        "legacy_code": "DEMO-SCH-002",
        "code": "FIC-CES-MEND-001",
        "name": "CES fictif de Mendong",
        "subdivision_code": "YAOUNDE-6E",
        "type": "CES",
        "subsystem": "GENERAL_FR",
    },
    {
        "legacy_code": "DEMO-SCH-003",
        "code": "FIC-LYC-BONA-001",
        "name": "Lycee fictif de Bonaberi",
        "subdivision_code": "DOUALA-4E",
        "type": "LYCEE_GENERAL",
        "subsystem": "GENERAL_FR",
    },
    {
        "legacy_code": "DEMO-SCH-004",
        "code": "FIC-CETIC-BAF-001",
        "name": "CETIC fictif de Bafoussam",
        "subdivision_code": "BAFOUSSAM-1ER",
        "type": "CETIC",
        "subsystem": "TECHNIQUE_FR",
    },
    {
        "legacy_code": "DEMO-SCH-005",
        "code": "FIC-COLL-GAR-001",
        "name": "College fictif de Garoua",
        "subdivision_code": "GAROUA-1ER",
        "type": "COLLEGE",
        "subsystem": "GENERAL_FR",
    },
]

SYNTHETIC_FAMILIES = [
    "Essono-Echantillon",
    "Ngono-Fictif",
    "Talla-Test",
    "Mballa-Simule",
    "Kamga-Echantillon",
    "Njoya-Fictif",
    "Belinga-Test",
    "Moukoko-Simule",
    "Abena-Echantillon",
    "Fotso-Fictif",
]

SYNTHETIC_GIVEN_NAMES = [
    "Amina-Test",
    "Brice-Fictif",
    "Claire-Simulee",
    "Daniel-Echantillon",
    "Estelle-Test",
    "Fabrice-Fictif",
    "Grace-Simulee",
    "Herve-Echantillon",
    "Ines-Test",
    "Joel-Fictif",
]


def first_or_none(session, statement):
    return session.execute(statement).scalars().first()


def get_subdivision(session, code: str) -> Subdivision:
    subdivision = first_or_none(session, select(Subdivision).filter_by(code=code))
    if not subdivision:
        raise RuntimeError(f"Subdivision reference missing: {code}. Run Cameroon administrative seed first.")
    return subdivision


def get_or_create_user(session, username: str, display_name: str, password: str) -> User:
    user = first_or_none(session, select(User).filter_by(username=username))
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
    else:
        user.display_name = display_name
        user.preferred_language = "fr"
        user.mfa_required = False
        user.is_demo = True
    return user


def ensure_demo_user(
    session,
    username: str,
    display_name: str,
    password: str,
    role_code: str,
    scope_type: str,
    region_id: int | None = None,
    department_id: int | None = None,
    school_id: int | None = None,
) -> None:
    user = get_or_create_user(session, username, display_name, password)
    role = session.execute(select(Role).filter_by(code=role_code)).scalar_one()
    session.execute(delete(UserRole).where(UserRole.user_id == user.id))
    session.execute(delete(UserScope).where(UserScope.user_id == user.id))
    if not first_or_none(session, select(UserRole).filter_by(user_id=user.id, role_id=role.id)):
        session.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=user.id))
    if not first_or_none(
        session,
        select(UserScope).filter_by(
            user_id=user.id,
            scope_type=scope_type,
            region_id=region_id,
            department_id=department_id,
            school_id=school_id,
        ),
    ):
        session.add(UserScope(user_id=user.id, scope_type=scope_type, region_id=region_id, department_id=department_id, school_id=school_id))


def ensure_school(session, school_data: dict[str, str]) -> School:
    subdivision = get_subdivision(session, school_data["subdivision_code"])
    school = first_or_none(session, select(School).where(School.code.in_([school_data["code"], school_data["legacy_code"]])))
    if not school:
        school = School(public_id=str(uuid4()), subdivision_id=subdivision.id, code=school_data["code"], name=school_data["name"], school_type=school_data["type"], education_subsystem=school_data["subsystem"], status="ACTIVE", is_demo=True)
        session.add(school)
        session.flush()
    else:
        conflict = first_or_none(session, select(School).where(School.code == school_data["code"], School.id != school.id))
        if not conflict:
            school.code = school_data["code"]
        school.subdivision_id = subdivision.id
        school.name = school_data["name"]
        school.school_type = school_data["type"]
        school.education_subsystem = school_data["subsystem"]
        school.status = "ACTIVE"
        school.is_demo = True
    return school


def ensure_classroom(session, school: School, year: SchoolYear, grade_code: str, code: str, label: str, capacity: int) -> Classroom:
    grade = first_or_none(session, select(GradeLevel).filter_by(code=grade_code))
    if not grade:
        grade = GradeLevel(code=grade_code, label=label.split(" - ")[0], education_subsystem=school.education_subsystem, sort_order=99)
        session.add(grade)
        session.flush()
    classroom = first_or_none(session, select(Classroom).filter_by(school_id=school.id, school_year_id=year.id, code=code))
    if not classroom:
        classroom = Classroom(school_id=school.id, school_year_id=year.id, grade_level_id=grade.id, code=code, label=label, capacity=capacity, is_demo=True)
        session.add(classroom)
        session.flush()
    else:
        classroom.grade_level_id = grade.id
        classroom.label = label
        classroom.capacity = capacity
        classroom.is_demo = True
    return classroom


def ensure_student(session, idx: int, school: School, classroom: Classroom, year: SchoolYear) -> Student:
    student_number = f"EDU-CMR-2026-{idx:04d}"
    legacy_number = f"DEMO-STU-2026-{idx:04d}"
    student = first_or_none(session, select(Student).where(Student.student_number.in_([student_number, legacy_number])))
    if not student:
        student = Student(public_id=str(uuid4()), student_number=student_number, last_name="", first_name="", birth_date=date(2012, 1, 1), status="ACTIVE", is_demo=True)
        session.add(student)
        session.flush()
    else:
        conflict = first_or_none(session, select(Student).where(Student.student_number == student_number, Student.id != student.id))
        if not conflict:
            student.student_number = student_number
    student.last_name = SYNTHETIC_FAMILIES[(idx - 1) % len(SYNTHETIC_FAMILIES)]
    student.first_name = SYNTHETIC_GIVEN_NAMES[(idx - 1) % len(SYNTHETIC_GIVEN_NAMES)]
    student.birth_date = date(2010 + (idx % 5), (idx % 12) + 1, (idx % 27) + 1)
    student.gender = "F" if idx % 2 else "M"
    student.status = "ACTIVE"
    student.current_school_id = school.id
    student.current_classroom_id = classroom.id
    student.is_demo = True

    enrollment = first_or_none(session, select(Enrollment).filter_by(student_id=student.id, school_year_id=year.id))
    if not enrollment:
        session.add(Enrollment(student_id=student.id, school_id=school.id, classroom_id=classroom.id, school_year_id=year.id, status="ACTIVE", is_demo=True))
    else:
        enrollment.school_id = school.id
        enrollment.classroom_id = classroom.id
        enrollment.status = "ACTIVE"
        enrollment.is_demo = True

    guardian = first_or_none(session, select(StudentGuardian).filter_by(student_id=student.id, is_primary=True))
    if not guardian:
        session.add(StudentGuardian(student_id=student.id, relationship="REPRESENTANT_LEGAL_FICTIF", display_name=f"Parent fictif {idx:04d}", contact_masked="+237 *** *** ***", is_primary=True, is_demo=True))
    else:
        guardian.relationship = "REPRESENTANT_LEGAL_FICTIF"
        guardian.display_name = f"Parent fictif {idx:04d}"
        guardian.contact_masked = "+237 *** *** ***"
        guardian.is_demo = True
    return student


def ensure_card(session, idx: int, student: Student) -> Card:
    serial_number = f"CMR-CARD-2026-{idx:05d}"
    legacy_serial = f"DEMO-CARD-{idx:05d}"
    card = first_or_none(session, select(Card).where(Card.serial_number.in_([serial_number, legacy_serial])))
    now = datetime.now(UTC).replace(tzinfo=None)
    if not card:
        card = Card(public_id=str(uuid4()), student_id=student.id, serial_number=serial_number, status="ACTIVE", issued_at=now, activated_at=now, is_demo=True)
        session.add(card)
        session.flush()
    else:
        conflict = first_or_none(session, select(Card).where(Card.serial_number == serial_number, Card.id != card.id))
        if not conflict:
            card.serial_number = serial_number
        card.student_id = student.id
        card.status = "SUSPENDED" if idx in {7, 18} else "ACTIVE"
        card.issued_at = card.issued_at or now
        card.activated_at = card.activated_at or now
        card.is_demo = True
    return card


def ensure_payment(session, provider: PaymentProvider, school: School, year: SchoolYear, student: Student, idx: int) -> PaymentTransaction:
    reference = f"CMR-FEES-2026-{idx:04d}"
    legacy_reference = "DEMO-PAY-0001" if idx == 1 else f"DEMO-PAY-{idx:04d}"
    payment = first_or_none(session, select(PaymentTransaction).where(PaymentTransaction.payment_provider_id == provider.id, PaymentTransaction.opaque_reference.in_([reference, legacy_reference])))
    if not payment:
        payment = PaymentTransaction(public_id=str(uuid4()), payment_provider_id=provider.id, school_id=school.id, school_year_id=year.id, opaque_reference=reference, idempotency_key=f"CMR-IDEMP-2026-{idx:04d}", amount=15000 + (idx % 4) * 2500, category="CONTRIBUTION_SCOLAIRE_SIMULEE", status="SUCCESS", is_demo=True)
        session.add(payment)
        session.flush()
    else:
        payment.opaque_reference = reference
        payment.idempotency_key = f"CMR-IDEMP-2026-{idx:04d}"
        payment.amount = 15000 + (idx % 4) * 2500
        payment.category = "CONTRIBUTION_SCOLAIRE_SIMULEE"
        payment.status = "SUCCESS"
        payment.is_demo = True
    payment.school_id = school.id
    payment.school_year_id = year.id
    payment.student_id = student.id
    reconciliation = first_or_none(session, select(PaymentReconciliation).filter_by(payment_transaction_id=payment.id))
    if not reconciliation:
        session.add(PaymentReconciliation(payment_transaction_id=payment.id, reconciliation_status="MATCHED", matched_at=datetime.now(UTC).replace(tzinfo=None), notes_minimized="Rapprochement fictif de contribution scolaire", is_demo=True))
    return payment


def main() -> None:
    seed_cameroon_administrative_data()
    with SessionLocal() as session:
        centre = session.execute(select(Region).filter_by(code="CENTRE")).scalar_one()
        mfoundi = first_or_none(session, select(Department).filter_by(code="MFOUNDI", region_id=centre.id))
        schools = [ensure_school(session, school_data) for school_data in DEMO_SCHOOLS]
        session.flush()

        ensure_demo_user(session, "demo.central", "Administration centrale fictive", "DemoCentral!12345", "ADMINISTRATION_CENTRALE", "NATIONAL")
        ensure_demo_user(session, "demo.regional", "Delegation regionale fictive du Centre", "DemoRegional!12345", "DELEGATION_REGIONALE", "REGION", region_id=centre.id)
        if mfoundi:
            ensure_demo_user(session, "demo.departmental", "Delegation departementale fictive du Mfoundi", "DemoDepartment!12345", "DELEGATION_DEPARTEMENTALE", "DEPARTMENT", department_id=mfoundi.id)
        ensure_demo_user(session, "demo.school", "Responsable fictif du Lycee de Nlongkak", "DemoSchool!12345", "RESPONSABLE_ETABLISSEMENT", "SCHOOL", school_id=schools[0].id)

        year = session.execute(select(SchoolYear).filter_by(code="2026-2027")).scalar_one()
        classroom_specs = [
            ("6E", "6e - Section A", 48),
            ("5E", "5e - Section A", 46),
            ("4E", "4e - Section A", 44),
            ("3E", "3e - Section A", 42),
            ("2NDE", "2nde - Section A", 40),
        ]
        classrooms: list[Classroom] = []
        for school in schools:
            for grade_code, label, capacity in classroom_specs:
                classrooms.append(ensure_classroom(session, school, year, grade_code, grade_code, label, capacity))

        students: list[Student] = []
        for idx in range(1, 61):
            school_index = (idx - 1) % len(schools)
            class_index = school_index * len(classroom_specs) + ((idx - 1) // len(schools)) % len(classroom_specs)
            student = ensure_student(session, idx, schools[school_index], classrooms[class_index], year)
            students.append(student)
            card = ensure_card(session, idx, student)
            if idx <= 20:
                event_type = "CHECK_IN" if idx % 6 else "LATE"
                attendance = first_or_none(session, select(AttendanceEvent).filter_by(student_id=student.id, event_type=event_type, source="MANUAL_DEMO"))
                if not attendance:
                    session.add(AttendanceEvent(student_id=student.id, card_id=card.id, school_id=student.current_school_id, classroom_id=student.current_classroom_id, event_type=event_type, event_time=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=idx % 10), source="MANUAL_DEMO", is_demo=True))
                else:
                    attendance.card_id = card.id
                    attendance.school_id = student.current_school_id
                    attendance.classroom_id = student.current_classroom_id
                    attendance.is_demo = True

        provider = session.execute(select(PaymentProvider).filter_by(code="MOCK_MOMO")).scalar_one()
        for idx, student in enumerate(students[:12], start=1):
            ensure_payment(session, provider, schools[(idx - 1) % len(schools)], year, student, idx)

        canteen = session.execute(select(ServiceType).filter_by(code="CANTEEN")).scalar_one()
        sport = session.execute(select(ServiceType).filter_by(code="SPORT")).scalar_one()
        service_provider = first_or_none(session, select(ServiceProvider).where(ServiceProvider.name == "Prestataire fictif interscolaire"))
        if not service_provider:
            service_provider = ServiceProvider(public_id=str(uuid4()), name="Prestataire fictif interscolaire", provider_type="LOCAL_SIMULATION", is_mock=True)
            session.add(service_provider)
            session.flush()
        for idx, student in enumerate(students[:16], start=1):
            service_type = canteen if idx % 2 else sport
            entitlement = first_or_none(session, select(ServiceEntitlement).filter_by(student_id=student.id, service_type_id=service_type.id, service_provider_id=service_provider.id))
            if not entitlement:
                session.add(ServiceEntitlement(student_id=student.id, service_type_id=service_type.id, service_provider_id=service_provider.id, valid_from=datetime(2026, 9, 1), valid_until=datetime(2027, 7, 31), status="ACTIVE", is_demo=True))
            else:
                entitlement.valid_from = datetime(2026, 9, 1)
                entitlement.valid_until = datetime(2027, 7, 31)
                entitlement.status = "ACTIVE"
                entitlement.is_demo = True

        incident = first_or_none(session, select(Incident).filter_by(category="CARTE_PERDUE_SIMULEE", is_demo=True))
        if not incident:
            session.add(Incident(public_id=str(uuid4()), category="CARTE_PERDUE_SIMULEE", priority="LOW", severity="LOW", status="OPEN", is_demo=True))
        else:
            incident.priority = "LOW"
            incident.severity = "LOW"
            incident.status = "OPEN"

        session.commit()
        print("Synthetic Cameroon demo data loaded.")


if __name__ == "__main__":
    main()

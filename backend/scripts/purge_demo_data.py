from pathlib import Path
import sys

from sqlalchemy import delete, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal
from app.models.entities import (
    AttendanceCorrection,
    AttendanceEvent,
    Card,
    CardIssuanceEvent,
    CardStatusHistory,
    Classroom,
    DataAccessRequest,
    Department,
    Enrollment,
    Export,
    ExportEvent,
    Incident,
    IncidentEvent,
    PaymentReconciliation,
    PaymentTransaction,
    QrVerificationEvent,
    Region,
    School,
    ServiceEntitlement,
    ServiceProvider,
    ServiceVerificationEvent,
    Student,
    StudentGuardian,
    StudentStatusHistory,
    Subdivision,
    Transfer,
    UserScope,
)


def main() -> None:
    with SessionLocal() as session:
        demo_students = select(Student.id).where(Student.is_demo == True)  # noqa: E712
        demo_cards = select(Card.id).where(Card.is_demo == True)  # noqa: E712
        demo_attendance = select(AttendanceEvent.id).where(AttendanceEvent.is_demo == True)  # noqa: E712
        demo_attendance_by_card = select(AttendanceEvent.id).where(AttendanceEvent.card_id.in_(demo_cards))
        demo_payments = select(PaymentTransaction.id).where(PaymentTransaction.is_demo == True)  # noqa: E712
        demo_incidents = select(Incident.id).where(Incident.is_demo == True)  # noqa: E712
        demo_exports = select(Export.id).where(Export.is_demo == True)  # noqa: E712
        demo_schools = select(School.id).where(School.is_demo == True)  # noqa: E712
        demo_classrooms = select(Classroom.id).where(Classroom.is_demo == True)  # noqa: E712
        demo_subdivisions = select(Subdivision.id).where(Subdivision.is_demo == True)  # noqa: E712
        demo_departments = select(Department.id).where(Department.is_demo == True)  # noqa: E712
        demo_regions = select(Region.id).where(Region.is_demo == True)  # noqa: E712
        demo_entitlements = select(ServiceEntitlement.id).where(ServiceEntitlement.is_demo == True)  # noqa: E712

        session.execute(delete(AttendanceCorrection).where(AttendanceCorrection.attendance_event_id.in_(demo_attendance)))
        session.execute(delete(AttendanceCorrection).where(AttendanceCorrection.attendance_event_id.in_(demo_attendance_by_card)))
        session.execute(delete(AttendanceEvent).where(AttendanceEvent.card_id.in_(demo_cards)))
        session.execute(delete(AttendanceEvent).where(AttendanceEvent.is_demo == True))  # noqa: E712
        session.execute(delete(ServiceVerificationEvent).where(ServiceVerificationEvent.service_entitlement_id.in_(demo_entitlements)))
        session.execute(delete(ServiceVerificationEvent).where(ServiceVerificationEvent.student_id.in_(demo_students)))
        session.execute(delete(ServiceEntitlement).where(ServiceEntitlement.is_demo == True))  # noqa: E712
        session.execute(delete(ServiceProvider).where(ServiceProvider.is_mock == True, ServiceProvider.name.like("%fictif%")))  # noqa: E712

        session.execute(delete(PaymentReconciliation).where(PaymentReconciliation.payment_transaction_id.in_(demo_payments)))
        session.execute(delete(PaymentTransaction).where(PaymentTransaction.is_demo == True))  # noqa: E712

        session.execute(delete(QrVerificationEvent).where(QrVerificationEvent.card_id.in_(demo_cards)))
        session.execute(delete(CardIssuanceEvent).where(CardIssuanceEvent.card_id.in_(demo_cards)))
        session.execute(delete(CardStatusHistory).where(CardStatusHistory.card_id.in_(demo_cards)))
        session.execute(delete(Card).where(Card.is_demo == True))  # noqa: E712

        session.execute(delete(StudentStatusHistory).where(StudentStatusHistory.student_id.in_(demo_students)))
        session.execute(delete(Transfer).where(Transfer.student_id.in_(demo_students)))
        session.execute(delete(Transfer).where(Transfer.from_school_id.in_(demo_schools)))
        session.execute(delete(Transfer).where(Transfer.to_school_id.in_(demo_schools)))
        session.execute(delete(Enrollment).where(Enrollment.student_id.in_(demo_students)))
        session.execute(delete(StudentGuardian).where(StudentGuardian.student_id.in_(demo_students)))
        session.execute(delete(DataAccessRequest).where(DataAccessRequest.student_id.in_(demo_students)))
        session.execute(delete(Student).where(Student.is_demo == True))  # noqa: E712

        session.execute(delete(IncidentEvent).where(IncidentEvent.incident_id.in_(demo_incidents)))
        session.execute(delete(Incident).where(Incident.is_demo == True))  # noqa: E712
        session.execute(delete(ExportEvent).where(ExportEvent.export_id.in_(demo_exports)))
        session.execute(delete(Export).where(Export.is_demo == True))  # noqa: E712

        session.execute(delete(Classroom).where(Classroom.is_demo == True))  # noqa: E712
        session.execute(delete(UserScope).where(UserScope.region_id.in_(demo_regions)))
        session.execute(delete(UserScope).where(UserScope.school_id.in_(demo_schools)))
        session.execute(delete(UserScope).where(UserScope.department_id.in_(demo_departments)))
        session.execute(delete(School).where(School.is_demo == True))  # noqa: E712
        session.execute(delete(Subdivision).where(Subdivision.is_demo == True))  # noqa: E712
        session.execute(delete(Department).where(Department.is_demo == True))  # noqa: E712
        session.execute(delete(Region).where(Region.is_demo == True))  # noqa: E712
        session.commit()
        print("Synthetic demo data purged. Core roles, permissions, settings and Cameroon administrative reference data were preserved.")


if __name__ == "__main__":
    main()

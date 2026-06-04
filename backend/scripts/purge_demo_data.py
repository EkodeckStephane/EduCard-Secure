from sqlalchemy import delete

from app.core.database import SessionLocal
from app.models.entities import (
    Card,
    Classroom,
    Department,
    Enrollment,
    Incident,
    PaymentReconciliation,
    PaymentTransaction,
    School,
    Student,
    StudentGuardian,
    Subdivision,
)


DEMO_MODELS = [
    PaymentReconciliation,
    PaymentTransaction,
    Incident,
    Card,
    Enrollment,
    StudentGuardian,
    Student,
    Classroom,
    School,
    Subdivision,
    Department,
]


def main() -> None:
    with SessionLocal() as session:
        for model in DEMO_MODELS:
            session.execute(delete(model).where(model.is_demo == True))  # noqa: E712
        session.commit()
        print("Synthetic demo data purged. Core roles, permissions and settings were preserved.")


if __name__ == "__main__":
    main()

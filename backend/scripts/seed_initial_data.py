from datetime import date

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.entities import (
    ConfigurationSetting,
    GradeLevel,
    PaymentProvider,
    Permission,
    Region,
    Role,
    RolePermission,
    SchoolYear,
    ServiceType,
)


ROLES = [
    ("SUPER_ADMIN_TECHNIQUE", "Super admin technique", True),
    ("ADMINISTRATION_CENTRALE", "Administration centrale", True),
    ("DELEGATION_REGIONALE", "Delegation regionale", False),
    ("DELEGATION_DEPARTEMENTALE", "Delegation departementale", False),
    ("RESPONSABLE_ETABLISSEMENT", "Responsable etablissement", False),
    ("AGENT_IMMATRICULATION", "Agent immatriculation", False),
    ("AGENT_CARTE", "Agent carte", False),
    ("AGENT_PRESENCE", "Agent presence", False),
    ("AGENT_SERVICE", "Agent service", False),
    ("AGENT_FINANCE", "Agent finance", False),
    ("AUDITEUR_SECURITE", "Auditeur securite", True),
    ("ANALYSTE_STATISTIQUE", "Analyste statistique", False),
    ("SUPPORT", "Support", False),
]

PERMISSIONS = [
    ("student:create", "student", "create"),
    ("student:read", "student", "read"),
    ("student:update", "student", "update"),
    ("student:archive", "student", "archive"),
    ("student:export", "student", "export"),
    ("card:issue", "card", "issue"),
    ("card:suspend", "card", "suspend"),
    ("card:revoke", "card", "revoke"),
    ("card:verify", "card", "verify"),
    ("attendance:create", "attendance", "create"),
    ("attendance:read", "attendance", "read"),
    ("service:manage", "service", "manage"),
    ("service:verify", "service", "verify"),
    ("payment:create", "payment", "create"),
    ("payment:read", "payment", "read"),
    ("payment:reconcile", "payment", "reconcile"),
    ("incident:create", "incident", "create"),
    ("incident:update", "incident", "update"),
    ("audit:read", "audit", "read"),
    ("audit:export", "audit", "export"),
    ("user:create", "user", "create"),
    ("user:update", "user", "update"),
    ("role:assign", "role", "assign"),
    ("settings:update", "settings", "update"),
    ("dashboard:read", "dashboard", "read"),
    ("export:create", "export", "create"),
    ("export:download", "export", "download"),
]


def get_or_create(session, model, defaults=None, **criteria):
    row = session.execute(select(model).filter_by(**criteria)).scalar_one_or_none()
    if row:
        return row
    row = model(**criteria, **(defaults or {}))
    session.add(row)
    session.flush()
    return row


def main() -> None:
    with SessionLocal() as session:
        roles = {
            code: get_or_create(session, Role, code=code, defaults={"label": label, "is_privileged": privileged})
            for code, label, privileged in ROLES
        }
        permissions = {
            code: get_or_create(
                session,
                Permission,
                code=code,
                defaults={"resource": resource, "action": action, "description": f"Allow {action} on {resource}"},
            )
            for code, resource, action in PERMISSIONS
        }
        admin_role = roles["SUPER_ADMIN_TECHNIQUE"]
        for permission in permissions.values():
            get_or_create(session, RolePermission, role_id=admin_role.id, permission_id=permission.id)

        for code, label in [
            ("SPORT", "Activite sportive"),
            ("CANTEEN", "Restauration"),
            ("INSURANCE", "Assurance scolaire"),
            ("SOCIAL", "Prestation sociale"),
        ]:
            get_or_create(session, ServiceType, code=code, defaults={"label": label})

        for code, label, provider_type in [
            ("MOCK_MOMO", "Mock Mobile Money", "MOBILE_MONEY"),
            ("MOCK_ORANGE", "Mock Orange Money", "MOBILE_MONEY"),
            ("MOCK_BANK", "Mock Bank", "BANK"),
            ("MOCK_CASH", "Mock Cash Desk", "CASH"),
        ]:
            get_or_create(session, PaymentProvider, code=code, defaults={"label": label, "provider_type": provider_type, "status": "ACTIVE"})

        get_or_create(session, SchoolYear, code="2026-2027", defaults={"starts_on": date(2026, 9, 1), "ends_on": date(2027, 7, 31), "status": "PLANNED"})
        for idx, label in enumerate(["6e", "5e", "4e", "3e", "2nde", "1ere", "Terminale"], start=1):
            get_or_create(session, GradeLevel, code=label.upper(), defaults={"label": label, "education_subsystem": "DEMO", "sort_order": idx})
        get_or_create(session, Region, code="DEMO-CENTRAL", defaults={"name": "Region Demo Centrale", "is_demo": True})
        get_or_create(session, ConfigurationSetting, setting_key="demo_data_enabled", defaults={"setting_value_encrypted": "true", "is_sensitive": False})

        session.commit()
        print("Initial reference data loaded.")


if __name__ == "__main__":
    main()

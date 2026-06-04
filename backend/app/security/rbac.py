ROLE_PERMISSIONS: dict[str, set[str]] = {
    "SUPER_ADMIN_TECHNIQUE": {
        "user:create", "user:update", "role:assign", "settings:update", "audit:read", "audit:export",
        "student:read", "card:verify", "dashboard:read", "export:create", "export:download",
        "incident:create", "incident:update", "privacy:read", "privacy:update", "backup:read", "security:read",
    },
    "ADMINISTRATION_CENTRALE": {
        "student:create", "student:read", "student:update", "student:archive", "student:export", "card:issue", "card:suspend",
        "card:revoke", "card:verify", "attendance:create", "attendance:read", "service:manage", "service:verify", "payment:create", "payment:read", "payment:reconcile",
        "incident:create", "incident:update", "audit:read", "audit:export", "dashboard:read", "export:create", "export:download",
        "privacy:read", "privacy:update", "backup:read", "security:read", "settings:update",
    },
    "DELEGATION_REGIONALE": {"student:read", "student:update", "student:archive", "card:verify", "attendance:read", "service:verify", "payment:read", "incident:create", "dashboard:read", "export:create", "export:download", "security:read", "settings:update"},
    "DELEGATION_DEPARTEMENTALE": {"student:read", "student:update", "student:archive", "card:verify", "attendance:read", "service:verify", "payment:read", "incident:create", "dashboard:read", "export:create", "export:download", "security:read", "settings:update"},
    "RESPONSABLE_ETABLISSEMENT": {"student:create", "student:read", "student:update", "student:archive", "card:verify", "attendance:create", "attendance:read", "service:manage", "service:verify", "payment:create", "payment:read", "incident:create", "incident:update", "dashboard:read", "export:create", "export:download", "security:read"},
    "AGENT_IMMATRICULATION": {"student:create", "student:read", "student:update"},
    "AGENT_CARTE": {"student:read", "card:issue", "card:suspend", "card:revoke", "card:verify"},
    "AGENT_PRESENCE": {"student:read", "attendance:create", "attendance:read"},
    "AGENT_SERVICE": {"student:read", "card:verify", "service:verify"},
    "AGENT_FINANCE": {"student:read", "payment:create", "payment:read", "payment:reconcile"},
    "AUDITEUR_SECURITE": {"audit:read", "audit:export", "incident:create", "incident:update", "dashboard:read", "export:create", "export:download", "privacy:read", "privacy:update", "backup:read", "security:read"},
    "ANALYSTE_STATISTIQUE": {"student:read", "attendance:read", "payment:read", "dashboard:read", "export:create", "export:download"},
    "SUPPORT": {"student:read", "incident:create"},
}

PRIVILEGED_ROLES = {"SUPER_ADMIN_TECHNIQUE", "ADMINISTRATION_CENTRALE", "AUDITEUR_SECURITE"}


def permissions_for_roles(role_codes: set[str]) -> set[str]:
    permissions: set[str] = set()
    for role_code in role_codes:
        permissions.update(ROLE_PERMISSIONS.get(role_code, set()))
    return permissions


def is_privileged(role_codes: set[str]) -> bool:
    return bool(PRIVILEGED_ROLES.intersection(role_codes))

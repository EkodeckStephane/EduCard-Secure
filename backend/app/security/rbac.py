ROLE_PERMISSIONS: dict[str, set[str]] = {
    "SUPER_ADMIN_TECHNIQUE": {
        "user:create", "user:update", "role:assign", "settings:update", "audit:read", "audit:export",
        "student:read", "card:verify",
    },
    "ADMINISTRATION_CENTRALE": {
        "student:create", "student:read", "student:update", "student:export", "card:issue", "card:suspend",
        "card:revoke", "card:verify", "attendance:read", "payment:read", "payment:reconcile",
        "incident:create", "incident:update", "audit:read",
    },
    "DELEGATION_REGIONALE": {"student:read", "student:update", "card:verify", "attendance:read", "incident:create"},
    "DELEGATION_DEPARTEMENTALE": {"student:read", "student:update", "card:verify", "attendance:read", "incident:create"},
    "RESPONSABLE_ETABLISSEMENT": {"student:create", "student:read", "student:update", "card:verify", "attendance:read", "incident:create"},
    "AGENT_IMMATRICULATION": {"student:create", "student:read", "student:update"},
    "AGENT_CARTE": {"student:read", "card:issue", "card:suspend", "card:revoke", "card:verify"},
    "AGENT_PRESENCE": {"student:read", "attendance:create", "attendance:read"},
    "AGENT_SERVICE": {"student:read", "card:verify"},
    "AGENT_FINANCE": {"payment:read", "payment:reconcile"},
    "AUDITEUR_SECURITE": {"audit:read", "audit:export", "incident:update"},
    "ANALYSTE_STATISTIQUE": {"student:read", "attendance:read", "payment:read"},
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

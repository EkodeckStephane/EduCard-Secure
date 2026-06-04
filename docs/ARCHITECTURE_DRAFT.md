# Architecture Draft

## Objectif

EduCard Secure est un prototype local, independant et non officiel de gestion du cycle de vie d'une carte scolaire digitale unique. L'objectif est de demontrer les processus metier, la securite, la tracabilite et les tableaux de bord avec des donnees exclusivement synthetiques.

## Architecture cible

```text
Navigateur
  |
  | HTTP local
  v
Frontend React + TypeScript + Vite
  |
  | API REST /api/v1
  v
Backend FastAPI
  |
  | SQLAlchemy + transactions
  v
MySQL Server 5.7 local
```

## Couches backend

- `api` : routes REST versionnees sous `/api/v1`.
- `schemas` : schemas Pydantic d'entree et de sortie.
- `services` : logique metier et orchestration transactionnelle.
- `repositories` : acces aux donnees via SQLAlchemy.
- `models` : modeles relationnels.
- `security` : authentification, autorisation, sessions, audit, protection CSRF.
- `core` : configuration, erreurs, journalisation.

## Modules fonctionnels cibles

- Referentiels administratifs.
- Gestion des eleves.
- Parcours scolaire.
- Cycle de vie des cartes.
- Verification QR simulee.
- Presence.
- Services associes.
- Paiements simules.
- Incidents, anomalies et support.
- Utilisateurs, roles, permissions et scopes.
- Audit, alertes, exports et rapports.
- Registre des traitements et demandes liees aux donnees personnelles.

## Base de donnees

Cible : MySQL Server 5.7, moteur InnoDB, encodage `utf8mb4`.

Contraintes de compatibilite :

- Pas de CTE obligatoire.
- Pas de fonctions analytiques obligatoires.
- Pas de dependance aux `CHECK constraints`.
- Pas de fonctionnalite JSON indispensable.
- Contraintes applicatives lorsque MySQL 5.7 ne les garantit pas correctement.

## Securite

- Refus par defaut.
- RBAC applique cote backend sur chaque route.
- Scopes geographiques ou organisationnels.
- Sessions par cookies HttpOnly.
- Protection CSRF.
- Hachage Argon2id pour les mots de passe.
- MFA TOTP pour comptes privilegies.
- Audit append-only avec empreinte.
- QR code ne contenant aucune donnee personnelle directe.
- Integrations externes uniquement via adaptateurs mock.

## Arborescence complete proposee

```text
EduCard-Secure/
  README.md
  MASTER_SPEC.md
  MASTER_SPEC_STATUS.md
  .gitignore
  .env.example
  backend/
    app/
      api/
        v1/
      core/
      db/
      models/
      repositories/
      schemas/
      security/
      services/
      integrations/
        payments/
        biometrics/
      tests/
    alembic/
      versions/
    requirements.txt
    pyproject.toml
  frontend/
    index.html
    package.json
    tsconfig.json
    vite.config.ts
    src/
      app/
      components/
      features/
      pages/
      routes/
      services/
      styles/
      tests/
  database/
    schema/
    seeds/
      synthetic/
    backups/
    restore/
  docs/
    ARCHITECTURE_DRAFT.md
    IMPLEMENTATION_ROADMAP.md
    SECURITY.md
    THREAT_MODEL.md
    PRIVACY.md
    RBAC_MATRIX.md
    DATA_DICTIONARY.md
    MYSQL57_COMPATIBILITY.md
    MIGRATION_TO_MYSQL84.md
    API_DOCUMENTATION.md
    TEST_PLAN.md
    SECURITY_TEST_REPORT.md
    BACKUP_RESTORE.md
    INCIDENT_RESPONSE.md
  scripts/
    powershell/
      run_tests.ps1
      backup_mysql.ps1
      restore_mysql.ps1
      purge_demo_data.ps1
  tests/
    integration/
    security/
  uploads/
  exports/
  backups/
  logs/
```

## Hypotheses

- Le prototype reste local et autonome.
- Les donnees geographiques et scolaires de demonstration seront fictives ou explicitement marquees comme exemples.
- Les integrations de paiement seront des mocks sans appel reseau externe.
- La biometrie restera desactivee et limitee a une interface technique optionnelle.
- La phase 1 precisera le schema, les flux et les decisions sensibles avant creation de code applicatif.


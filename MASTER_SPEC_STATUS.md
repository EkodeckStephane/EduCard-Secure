# MASTER_SPEC Status

## Lecture

`MASTER_SPEC.md` a ete lu integralement avant creation des fichiers de phase 0.

Observation technique : l'affichage PowerShell du fichier presente des caracteres accentues mal decodes, mais le contenu fonctionnel reste lisible. Les fichiers de cadrage sont donc rediges en ASCII pour eviter d'introduire une ambiguite d'encodage.

## Contraintes retenues

- Prototype independant, non officiel.
- Donnees de demonstration synthetiques uniquement.
- Aucune API externe reelle.
- Aucune cle, aucun jeton, aucun secret dans Git.
- MySQL Server 5.7 local.
- Pas de fonctionnalite SQL incompatible MySQL 5.7.
- Architecture web locale : React + TypeScript + Vite, FastAPI + SQLAlchemy + Alembic.
- RBAC robuste avec restriction de perimetre organisationnel ou geographique.
- Journalisation d'audit sans fuite de donnees sensibles.
- Protection des donnees personnelles, notamment des mineurs.
- Documentation juridique prudente : aucune interpretation definitive sans texte officiel cite.
- Travail par phases verifiables.

## Phase 0

Statut : realisee, sans installation et sans creation de base.

Fichiers demandes en phase 0 :

- `README.md` : cree.
- `MASTER_SPEC_STATUS.md` : cree.
- `.gitignore` : cree.
- `.env.example` : cree.
- `docs/ARCHITECTURE_DRAFT.md` : cree.
- `docs/IMPLEMENTATION_ROADMAP.md` : cree.

## Verification Node.js et npm sous PowerShell

Sous Windows PowerShell, ne pas lancer `npm` directement.
La politique d'execution PowerShell bloque `npm.ps1`.

Utiliser systematiquement :

- `node --version`
- `npm.cmd --version`
- `npm.cmd install`
- `npm.cmd run dev`
- `npm.cmd run build`
- `npm.cmd run test`

Pour les autres outils Node.js, privilegier egalement leur variante `.cmd` lorsqu'elle existe, par exemple :

- `npx.cmd`
- `vite.cmd`
- `eslint.cmd`

Ne pas modifier la politique d'execution PowerShell.
Ne pas lancer `Set-ExecutionPolicy`.

## Points verifies

- Connexion MySQL locale testee avec succes sur `127.0.0.1:3306`.
- Version serveur MySQL verifiee : `5.7.44-log`.
- Port MySQL verifie : `3306`.

## Points non verifies

- Compatibilite reelle des dependances futures avec Python 3.13 et Node.js 25 : a valider avant installation.

## Blocages actifs

Aucun blocage bloquant pour terminer la phase 0 documentaire.

## Decisions a prendre en phase 1

- Strategie exacte d'authentification locale et de sessions.
- Format des UUID et identifiants opaques.
- Strategie de signature QR mockee ou locale.
- Niveau de granularite initial du RBAC.
- Choix des bibliotheques frontend de graphiques et formulaires.
- Version cible des dependances compatibles Windows et MySQL 5.7.

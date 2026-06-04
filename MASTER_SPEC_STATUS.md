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

## Phase 1

Statut : realisee pour les livrables demandes par l'utilisateur.

Fichiers produits :

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL_DRAFT.md`
- `docs/ER_DIAGRAM.md`

Contenu couvert :

- Architecture applicative cible.
- Separation frontend, backend, base de donnees et scripts.
- Contraintes MySQL 5.7.
- Principes de securite, RBAC, sessions, audit et QR.
- Modele relationnel logique.
- Diagramme Mermaid ER.

Non realise volontairement :

- Pas de creation de base.
- Pas de migration Alembic.
- Pas de SQL executable.
- Pas d'installation de dependances.

## Phase 2

Statut : executee avec autorisation utilisateur.

Fichiers produits ou completes :

- Configuration `.env.example`.
- Configuration backend SQLAlchemy.
- Modeles SQLAlchemy initiaux.
- Alembic initialise avec migration `0001_initial_schema`.
- Scripts SQL d'initialisation non destructifs.
- Scripts de seed initial, seed demo et purge demo.
- Scripts PowerShell MySQL, migration, seed, purge, backup et restore.
- Documentation MySQL 5.7, dictionnaire de donnees, setup Windows, backup/restore et migration MySQL 8.4.

Realise :

- Environnement virtuel local `.venv` cree.
- Dependances backend installees localement.
- Fichier `.env` local genere avec secrets aleatoires et ignore par Git.
- Base `educard_secure` creee sur MySQL 5.7.
- Compte dedie `educard_app` cree.
- Privileges temporaires de migration accordes puis retires apres migration.
- Migration Alembic `0001_initial_schema` executee.
- Donnees initiales chargees.
- Donnees fictives de demonstration chargees.
- Lecture des tables et compteurs verifiee.
- Transaction avec rollback testee.
- Index verifies via `information_schema`.
- Backup teste avec `mysqldump --no-tablespaces`.

Non realise volontairement :

- Pas de restauration de sauvegarde.
- Pas de modification du service Windows MySQL.
- Pas de modification du port MySQL.
- Pas de suppression de base existante.

## Phase 3

Statut : backend et frontend de phase 3 implementes et valides.

Fichiers produits ou completes :

- API FastAPI `auth` et `users`.
- Services Argon2id, sessions, CSRF, MFA TOTP, RBAC et scopes.
- Tests backend de securite.
- Frontend React/Vite pour les ecrans de securite.
- Documentation RBAC, authentification, sessions, MFA, securite et API.

Verifie :

- Tests backend : 10 passes.
- Import FastAPI : 21 routes, dont les routes auth phase 3.
- Alembic `upgrade head` idempotent.
- Scan de secrets : aucun secret reel detecte, seulement placeholders documentes.

Verifie ensuite :

- Installation frontend : `npm.cmd install --no-audit --no-fund --loglevel=warn` reussie apres autorisation reseau/cache.
- Build frontend : reussi.
- Test frontend : 1 passe.
- Lint frontend : reussi.

## Phase 4

Statut : backend et frontend de phase 4 implementes et valides.

Fichiers produits ou completes :

- API FastAPI `students` et `cards`.
- Services applicatifs pour matricule interne, doublons, inscriptions, transferts et cycle administratif des cartes.
- Tests backend de scenario metier phase 4.
- Frontend React/Vite pour eleves, inscriptions, transferts et cartes.
- Documentation gestion eleves, inscriptions et cycle de vie carte.

Contraintes respectees :

- Donnees fictives uniquement.
- Aucun QR signe complet.
- Aucune integration externe.
- Controle RBAC et perimetres cote backend.
- Consultation sensible journalisee via `security_events`.

Verifie :

- Alembic `upgrade head` idempotent.
- Tests backend : 12 passes.
- Tests frontend : 1 passe.
- Build frontend : reussi.
- Lint frontend : reussi.
- Scan de secrets : aucun secret reel detecte, seulement placeholders documentaires.

## Phase 5

Statut : backend et frontend de phase 5 implementes et valides.

Fichiers produits ou completes :

- QR Ed25519 local, generation, verification, versions de cles et revocation.
- Presence avec pointage, doublon, correction et validation.
- Moteur de services configurables avec droits et verification.
- Paiements simules avec adaptateurs mock, idempotence et rapprochement.
- Ecrans frontend QR, presence, services, paiements et anomalies.
- Documentation QR, cles, presence, services, paiements mock et menaces.

Contraintes respectees :

- Aucune API externe reelle.
- Aucun QR contenant directement des donnees personnelles sensibles.
- Cles locales dans `private/`, ignore par Git.
- Aucun secret cote frontend.
- Verification et operations sensibles journalisees.

Verifie :

- Alembic `upgrade head` idempotent.
- Generation locale de cles QR de developpement dans `private/`.
- Tests backend : 14 passes.
- Tests frontend : 1 passe.
- Build frontend : reussi.
- Lint frontend : reussi.
- Scan de secrets : aucun secret reel detecte, seulement placeholders documentaires.
- `git ls-files private secrets *.pem *.key` : aucune cle privee suivie par Git.

## Phase 6

Statut : backend et frontend de phase 6 implementes et valides.

Fichiers produits ou completes :

- API dashboards et exports controles.
- Services statistiques avec scopes backend et masquage des petits effectifs.
- Exports CSV agreges avec nom opaque, expiration et journalisation.
- Frontend tableaux de bord, graphiques simples et exports.
- Documentation dashboards, statistiques et securite des exports.

Contraintes respectees :

- Donnees fictives uniquement.
- Pas de donnees individuelles dans les vues statistiques.
- Requetes compatibles MySQL 5.7.
- Exports journalises dans `security_events` et `export_events`.

Verifie :

- Alembic `upgrade head` idempotent.
- `seed_demo_data.py` relancable et idempotent.
- Tests backend : 16 passes.
- Tests frontend : 1 passe.
- Build frontend : reussi.
- Lint frontend : reussi.
- Scenario de filtrage, scope, export, telechargement et logs couvert par tests phase 6.

## Phase 7

Statut : backend, frontend, scripts et documentation de phase 7 implementes et valides.

Fichiers produits ou completes :

- Audit chaine SHA-256, verification d'integrite et detection de rupture.
- Alertes derivees des evenements de securite.
- Incidents avec historique.
- Demandes privacy, registre des traitements et regles de retention.
- Scripts sauvegarde/restauration renforces avec empreinte SHA-256.
- Documentation security, privacy, menaces, audit, alerting, incidents, sauvegardes et validations legales.

Contraintes respectees :

- Aucune restauration executee.
- Aucune suppression de donnees.
- Aucune modification de l'installation MySQL.
- Donnees fictives uniquement.
- Aucune validation juridique definitive.

Verifie :

- Alembic `upgrade head` idempotent.
- Tests backend : 19 passes.
- Tests frontend : 1 passe.
- Lint frontend : reussi.
- Build frontend : reussi.
- Creation d'une sauvegarde locale et verification de son empreinte SHA-256.
- Test de chaine d'audit et d'alteration simulee couvert par tests phase 7.
- Scan simple du depot pour secrets : seulement placeholders documentaires.
- `git ls-files backups private exports logs secrets *.pem *.key` : aucun fichier sensible suivi par Git.

Non realise volontairement :

- Aucune restauration de sauvegarde.
- Aucune suppression de donnees.
- Aucune validation juridique definitive.

## Internationalisation

Statut : preference utilisateur `fr`/`en` ajoutee au backend et au frontend.

Realise :

- Champ `users.preferred_language`.
- Endpoint `POST /api/v1/auth/language`.
- `GET /api/v1/auth/me` expose `preferred_language`.
- Selecteur de langue dans le frontend.
- Repertoires documentaires `docs/fr` et `docs/en`.

Limite :

- Les anciens fichiers documentaires ont ete recopies dans les deux repertoires
  pour etablir la structure bilingue. Une revue/traduction humaine complete
  reste necessaire pour obtenir deux corpus strictement homogenes.

# Implementation Roadmap

## Phase 0 - Verification de l'environnement

Objectif : cadrer le depot sans installation, sans base de donnees et sans secret.

Realise :

- Inspection du repertoire courant.
- Lecture de `MASTER_SPEC.md`.
- Verification de Python, Node.js, npm, Git et MySQL.
- Detection du service local `MySQL57`.
- Verification de la connexion MySQL locale sur `127.0.0.1:3306`.
- Creation des fichiers de cadrage demandes.

Non realise volontairement :

- Pas de creation de base.
- Pas d'installation de dependances.
- Pas de modification systeme.

Commandes PowerShell retenues :

```powershell
python --version
node --version
npm.cmd --version
git --version
mysql --version
```

Note locale : `mysql --version` necessite que `mysql.exe` soit dans le `PATH`. Dans l'environnement courant, le client MySQL fonctionne par chemin complet.

Commandes frontend futures :

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
npm.cmd run build
npx.cmd vite --version
npx.cmd eslint .
```

## Phase 1 - Architecture

Actions proposees :

1. Finaliser l'arborescence du depot. Statut : documente dans `docs/ARCHITECTURE.md`.
2. Produire `docs/ARCHITECTURE.md`. Statut : realise.
3. Produire un premier schema relationnel logique. Statut : realise dans `docs/DATA_MODEL_DRAFT.md`.
4. Produire le diagramme entite-association Mermaid. Statut : realise dans `docs/ER_DIAGRAM.md`.
5. Produire la matrice initiale roles-permissions.
6. Definir les decisions sensibles : sessions, CSRF, Argon2id, MFA, audit, QR, mocks.
7. Documenter les hypotheses metier et juridiques.

Livrables attendus :

- `docs/ARCHITECTURE.md`
- `docs/RBAC_MATRIX.md`
- `docs/DATA_MODEL_DRAFT.md`
- `docs/SECURITY_DECISIONS.md`

Livrables ajoutes pendant cette phase :

- `docs/ER_DIAGRAM.md`

## Phase 2 - Base de donnees

Actions proposees :

1. Creer la structure backend minimale. Statut : realise.
2. Configurer SQLAlchemy et Alembic. Statut : realise.
3. Produire les modeles principaux. Statut : realise.
4. Produire les migrations compatibles MySQL 5.7. Statut : prepare, non execute.
5. Ajouter scripts SQL d'initialisation. Statut : realise.
6. Ajouter generation de donnees synthetiques. Statut : realise.
7. Preparer sauvegarde, restauration et purge demo. Statut : realise.

Condition prealable : instruction explicite pour creer ou utiliser une base MySQL locale.

Execution differee :

- Creation de la base.
- Execution Alembic.
- Chargement des donnees initiales.
- Chargement des donnees demo.
- Backup.
- Restore.

## Phase 3 - Backend

Actions proposees :

1. Implementer FastAPI sous `/api/v1`.
2. Implementer authentification, sessions et RBAC.
3. Implementer services metier prioritaires.
4. Ajouter audit append-only.
5. Ajouter providers mock de paiement.
6. Ajouter verification QR simulee.
7. Ajouter tests pytest critiques.

## Phase 4 - Frontend

Actions proposees :

1. Creer React + TypeScript + Vite.
2. Construire le shell applicatif.
3. Ajouter navigation conditionnee par permissions.
4. Ajouter ecrans prioritaires : connexion, tableau de bord, eleves, cartes, QR, audit.
5. Ajouter validations client.
6. Ajouter graphiques et tableaux.

## Phase 5 - Securite

Actions proposees :

1. Produire `docs/THREAT_MODEL.md`.
2. Ajouter tests acces horizontal et vertical.
3. Ajouter tests injection SQL, XSS, CSRF, brute force.
4. Verifier absence de secrets.
5. Verifier absence de donnees sensibles dans les logs.
6. Produire `docs/SECURITY_TEST_REPORT.md`.

## Phase 6 - Validation

Actions proposees :

1. Lancer les tests disponibles.
2. Executer les scenarios A a G du spec.
3. Corriger les erreurs.
4. Produire un rapport de validation.
5. Documenter les limites.

## Phase 7 - Documentation finale

Actions proposees :

1. Finaliser `README.md`.
2. Documenter installation Windows.
3. Documenter MySQL 5.7 et migration MySQL 8.4 LTS.
4. Documenter sauvegarde, restauration, purge.
5. Documenter risques residuels et validations juridiques requises.

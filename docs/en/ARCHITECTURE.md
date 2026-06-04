# Architecture

## Portee

EduCard Secure est un prototype local, academique et technique. Il demontre la gestion d'une carte scolaire digitale unique avec donnees synthetiques, sans API externe reelle et sans statut officiel.

Cette architecture couvre la cible applicative avant implementation. Elle ne cree pas encore la base MySQL et n'installe aucune dependance.

## Objectifs d'architecture

- Application web locale accessible depuis un navigateur.
- Separation stricte frontend, backend, base de donnees et scripts d'exploitation.
- API REST versionnee sous `/api/v1`.
- Controle d'acces cote serveur sur chaque route.
- Journalisation d'audit sans fuite de donnees sensibles.
- Compatibilite MySQL Server 5.7.
- Integrations externes remplacees par des providers mock.
- Donnees de demonstration exclusivement synthetiques.

## Vue logique

```text
User Browser
  |
  | HTTP local
  v
React + TypeScript + Vite
  |
  | REST JSON /api/v1
  v
FastAPI Backend
  |
  | SQLAlchemy ORM + transactions
  v
MySQL Server 5.7
```

## Frontend

Technologies ciblees :

- React.
- TypeScript.
- Vite.
- Composants accessibles.
- Navigation conditionnee par permissions.
- Formulaires avec validation cote client.
- Graphiques et tableaux pagines.

Responsabilites :

- Afficher les vues autorisees pour le role courant.
- Valider les formats simples avant appel API.
- Afficher les erreurs metier sans details techniques.
- Ne jamais stocker de secret.
- Ne jamais embarquer de cle privee ou jeton d'integration.

Commandes PowerShell futures :

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run test
```

Pour les commandes ponctuelles :

```powershell
npx.cmd vite --version
npx.cmd eslint .
```

## Backend

Technologies ciblees :

- Python.
- FastAPI.
- SQLAlchemy.
- Alembic.
- Pydantic.
- pytest.

Structure cible :

```text
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
  alembic/
    versions/
  tests/
```

Responsabilites par couche :

- `api` : routes HTTP, dependances d'authentification, serialisation.
- `schemas` : contrats Pydantic et validation des entrees.
- `services` : regles metier, transactions et orchestration.
- `repositories` : acces SQLAlchemy aux tables.
- `models` : mapping relationnel.
- `security` : authentification, sessions, RBAC, scopes, CSRF, audit.
- `integrations` : interfaces abstraites et adaptateurs mock.
- `core` : configuration, erreurs, journalisation technique.

## API

Convention cible :

- Prefixe : `/api/v1`.
- Format : JSON.
- Pagination standard : `page`, `page_size`.
- Tri standard : `sort`.
- Filtres explicites par ressource.
- Erreurs utilisateur normalisees.
- Correlation ID pour audit et diagnostic.

Familles de routes ciblees :

- `/auth`
- `/users`
- `/roles`
- `/permissions`
- `/scopes`
- `/administrative-units`
- `/schools`
- `/students`
- `/enrollments`
- `/cards`
- `/qr-verifications`
- `/attendance`
- `/services`
- `/payments`
- `/incidents`
- `/audit-events`
- `/reports`
- `/privacy`
- `/configuration`

## Base de donnees

Cible :

- MySQL Server 5.7.
- InnoDB.
- `utf8mb4`.
- Cles etrangeres.
- Index explicites.
- Transactions explicites.

Contraintes MySQL 5.7 :

- Ne pas dependre des `CHECK constraints`.
- Ne pas rendre obligatoire l'usage de JSON.
- Ne pas utiliser de CTE obligatoire.
- Ne pas utiliser de fonctions de fenetrage.
- Implementer certaines contraintes en service applicatif et tests.

## Securite

Decisions ciblees :

- Hachage de mot de passe avec Argon2id.
- Sessions cote serveur ou jetons de session opaques.
- Cookies `HttpOnly`, `SameSite`, `Secure` quand HTTPS est active.
- Protection CSRF pour les operations mutantes.
- MFA TOTP pour comptes privilegies.
- Verrouillage progressif apres echecs de connexion.
- RBAC plus scopes organisationnels.
- Refus par defaut.
- Audit append-only pour operations sensibles.

Donnees sensibles :

- Minimisation des champs.
- Masquage selon role.
- Aucune donnee personnelle complete dans les QR codes.
- Pas de secret en frontend.
- Pas de secret dans Git.

## QR code

Le QR code cible contient uniquement :

- Version de format.
- Identifiant opaque.
- Identifiant de carte.
- Periode de validite limitee.
- Nonce.
- Signature.
- Version de cle publique.

Il ne contient jamais :

- Nom complet.
- Date de naissance.
- Telephone.
- Adresse.
- Photographie.
- Donnees financieres.
- Detail scolaire nominatif.

La signature sera geree par un service local, avec separation entre cle privee de signature, cle publique de verification et version de cle. Les cles reelles ne seront jamais commitees.

## Integrations mock

Interfaces ciblees :

- `PaymentProvider`
- `MockMomoProvider`
- `MockOrangeMoneyProvider`
- `MockBankProvider`
- `MockCashDeskProvider`
- `BiometricProvider` desactive par defaut

Les providers mock ne font aucun appel reseau externe.

## Audit et observabilite

Les evenements sensibles seront journalises avec :

- Horodatage UTC.
- Utilisateur.
- Role actif.
- Perimetre.
- Action.
- Ressource.
- Identifiant opaque.
- Resultat.
- Correlation ID.
- Justification si requise.
- Criticite.
- Empreinte cryptographique.

Les logs applicatifs ne doivent pas contenir de secrets, de jetons, ni de donnees personnelles inutiles.

## Hypotheses

- L'application est executee localement en environnement de demonstration.
- La phase 2 creera les migrations Alembic et le SQL compatible MySQL 5.7.
- La connexion MySQL locale est disponible sur `127.0.0.1:3306`.
- Le compte applicatif MySQL dedie sera cree plus tard avec privileges minimaux.
- Le compte `root` ne sera pas utilise par l'application au quotidien.

## Hors perimetre actuel

- Creation de la base.
- Installation des dependances.
- Implementation backend ou frontend.
- Interpretation juridique definitive.
- Integration a un prestataire de paiement reel.
- Biometrie activee.


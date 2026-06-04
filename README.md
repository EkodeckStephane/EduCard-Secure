# EduCard Secure

Prototype local de gestion d'une carte scolaire digitale unique.

## Statut

Ce depot est en phase 0 : cadrage initial, verification de l'environnement et documentation de demarrage.

EduCard Secure est un prototype academique et technique independant. Il ne doit jamais etre presente comme une plateforme officielle du MINESEC, de MTN Cameroon, de MTN Mobile Money Corporation ou d'une autre institution.

## Principes non negociables

- Donnees de demonstration exclusivement synthetiques.
- Aucune donnee reelle d'eleve, de parent, d'etablissement ou d'agent.
- Aucune API externe reelle.
- Aucun logo, marque graphique institutionnelle ou ressource privee.
- Aucun secret dans le depot Git.
- MySQL Server 5.7 local comme cible de base de donnees.
- Commandes compatibles Windows PowerShell.
- Developpement par phases verifiables.

## Pile technique cible

- Frontend : React, TypeScript, Vite.
- Backend : Python, FastAPI, SQLAlchemy, Alembic, Pydantic.
- Base de donnees : MySQL Server 5.7, InnoDB, utf8mb4.
- Tests : pytest pour le backend, tests frontend ou end-to-end pour les scenarios critiques.

## Etat de l'environnement verifie

- Python : 3.13.5.
- Node.js : v25.2.1.
- npm : 11.6.2 via `npm.cmd`.
- Git : 2.51.2.windows.1.
- MySQL Server : 5.7.44 installe localement.
- Service MySQL : `MySQL57` detecte en cours d'execution.
- Connexion MySQL locale testee sur `127.0.0.1:3306`.

Notes :

- Sous Windows PowerShell, ne pas lancer `npm` directement. La politique d'execution PowerShell bloque `npm.ps1`.
- Utiliser systematiquement `npm.cmd` pour npm : `npm.cmd --version`, `npm.cmd install`, `npm.cmd run dev`, `npm.cmd run build`, `npm.cmd run test`.
- Pour les autres outils Node.js, privilegier aussi leur variante `.cmd` lorsqu'elle existe, par exemple `npx.cmd`, `vite.cmd`, `eslint.cmd`.
- Ne pas modifier la politique d'execution PowerShell et ne pas lancer `Set-ExecutionPolicy`.
- `mysql.exe` n'est pas dans le `PATH`; utiliser le chemin complet `C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe`.

Commandes PowerShell de verification :

```powershell
python --version
node --version
npm.cmd --version
git --version
mysql --version
```

Dans cet environnement, `mysql --version` echoue car `mysql.exe` n'est pas dans le `PATH`. La verification equivalente par chemin complet fonctionne :

```powershell
& 'C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe' --version
```

Commandes frontend a utiliser plus tard :

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
npm.cmd run build
npx.cmd vite --version
npx.cmd eslint .
```

## Phase courante

La phase 0 ne cree pas la base de donnees, n'installe aucune dependance et ne modifie aucune installation systeme.

La phase 1 devra produire l'architecture detaillee, le schema cible, le diagramme Mermaid et les decisions sensibles avant toute implementation lourde.

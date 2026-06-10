# EduCard Secure - Logique d'utilisation de l'application de A à Z
## 1. Objet du document

Ce document décrit le fonctionnement fonctionnel et opérationnel d'EduCard
Secure, depuis la préparation de l'environnement jusqu'à la déconnexion.

Il est conçu comme une base de travail modifiable. Il permet notamment de :

- comprendre l'ordre logique d'utilisation des modules ;
- identifier les responsabilités des différents profils ;
- vérifier les dépendances entre les opérations ;
- distinguer les fonctions disponibles dans l'interface de celles disponibles
  uniquement dans l'API ;
- relever les choix fonctionnels qui doivent encore être arbitrés ;
- préparer une future documentation utilisateur institutionnelle.

EduCard Secure est actuellement un prototype local utilisant exclusivement des
données fictives. Il ne constitue pas une plateforme officielle.

## 2. Légende de maturité fonctionnelle

Les mentions suivantes sont utilisées dans le document :

- **Implémenté dans l'interface** : l'action peut être réalisée depuis le
  frontend.
- **Implémenté dans l'API** : la fonction existe côté backend, mais son écran
  peut être absent ou incomplet.
- **Partiellement implémenté** : une partie du workflow est disponible, mais
  certaines validations, sélections ou étapes restent simplifiées.
- **Documenté seulement** : le principe est décrit, mais aucune fonction
  complète n'est actuellement disponible.
- **À arbitrer** : une décision fonctionnelle, institutionnelle ou juridique
  est nécessaire.

## 3. Vue générale du parcours

L'ordre recommandé d'utilisation est le suivant :

1. démarrer MySQL, le backend et le frontend ;
2. se connecter avec un compte autorisé ;
3. vérifier son rôle, sa langue et son périmètre ;
4. préparer la carte scolaire administrative ;
5. préparer les établissements, années scolaires, niveaux et classes ;
6. créer ou rattacher les comptes utilisateurs ;
7. créer les élèves fictifs ;
8. inscrire les élèves dans une classe et une année scolaire ;
9. gérer les transferts et le parcours scolaire ;
10. demander et administrer les cartes ;
11. générer et vérifier les QR signés ;
12. enregistrer les présences ;
13. attribuer et vérifier les services ;
14. créer et rapprocher les paiements simulés ;
15. consulter les tableaux de bord ;
16. produire les exports contrôlés ;
17. consulter l'audit, les alertes et les incidents ;
18. administrer la protection des données et la rétention ;
19. contrôler les sauvegardes ;
20. se déconnecter.

Les étapes ne doivent pas être exécutées dans un ordre arbitraire. Par exemple,
une classe dépend d'un établissement, d'une année scolaire et d'un niveau. Une
inscription dépend ensuite d'un élève et de cette classe.

## 4. Architecture fonctionnelle

L'application comporte trois couches :

- **Frontend React** : interface utilisée dans le navigateur.
- **Backend FastAPI** : authentification, autorisations, règles métier,
  journalisation et API.
- **MySQL 5.7** : stockage des référentiels, utilisateurs, élèves, cartes,
  opérations et journaux.

Adresses locales habituelles :

- application : `http://127.0.0.1:5173`
- API : `http://127.0.0.1:8000`
- Swagger : `http://127.0.0.1:8000/docs`
- ReDoc : `http://127.0.0.1:8000/redoc`
- état du backend : `http://127.0.0.1:8000/health`

## 5. Démarrage de l'application

### 5.1 Prérequis

- MySQL Server 5.7 doit être démarré.
- Le fichier local `.env` doit contenir la configuration de la base.
- Les migrations Alembic doivent avoir été exécutées.
- Les données initiales doivent être chargées.
- Les données de démonstration peuvent être chargées pour les essais.

### 5.2 Lancer le backend

Depuis la racine du projet :

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Le terminal doit rester ouvert.

### 5.3 Lancer le frontend

Dans un second terminal PowerShell :

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Le terminal doit également rester ouvert.

### 5.4 Vérifier le démarrage

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173
```

Le backend et le frontend doivent retourner un code HTTP `200`.

## 6. Comptes fictifs de démonstration

Les comptes suivants sont créés par le script de données de démonstration :

| Compte | Mot de passe fictif | Niveau | Périmètre |
|---|---|---|---|
| `demo.central` | `DemoCentral!12345` | Administration centrale | National |
| `demo.regional` | `DemoRegional!12345` | Délégation régionale | Région du Centre |
| `demo.departmental` | `DemoDepartment!12345` | Délégation départementale | Mfoundi |
| `demo.school` | `DemoSchool!12345` | Responsable d'établissement | Lycée fictif de Nlongkak |

Le compte central possède un rôle privilégié. La politique de sécurité impose
le MFA aux comptes privilégiés. Pour un test fonctionnel sans préparation TOTP,
utiliser en priorité un compte régional, départemental ou établissement.

**À arbitrer :** définir la procédure institutionnelle de remise des
identifiants, d'activation du MFA et de récupération d'un compte.

## 7. Connexion

### 7.1 Procédure

1. ouvrir `http://127.0.0.1:5173` ;
2. choisir la langue française ou anglaise ;
3. saisir le nom d'utilisateur ;
4. saisir le mot de passe ;
5. saisir le code MFA si le compte le demande ;
6. cliquer sur **Connexion**.

### 7.2 Contrôles effectués

Le backend vérifie :

- l'existence du compte ;
- son statut actif ;
- le mot de passe Argon2id ;
- les tentatives échouées ;
- le verrouillage progressif ;
- le MFA lorsque requis ;
- les rôles et permissions ;
- les périmètres d'accès.

Après connexion, le navigateur reçoit :

- un cookie de session `HttpOnly` ;
- un cookie CSRF ;
- une durée de session limitée.

### 7.3 Échec de connexion

Un message générique est affiché afin de ne pas révéler si le compte existe.
Les échecs sont enregistrés dans les journaux de sécurité.

Après plusieurs tentatives invalides, le compte peut être verrouillé.

**À arbitrer :** définir la durée et la procédure réelle de déverrouillage.

## 8. Structure de l'interface

### 8.1 Menu latéral

Les fonctions sont regroupées par thèmes :

- **Compte**
- **Administration**
- **Scolarité**
- **Opérations**
- **Tableaux de bord**
- **Sécurité**
- **Gouvernance**

Tous les groupes sont fermés par défaut. L'ouverture d'un groupe ferme le
groupe précédemment ouvert.

Les menus visibles dépendent des permissions de l'utilisateur. Cette
dissimulation améliore l'ergonomie, mais la sécurité réelle est appliquée par
le backend.

### 8.2 Barre supérieure

Elle permet :

- de réduire ou développer le menu ;
- de voir la page courante ;
- de choisir `FR` ou `EN` ;
- de passer du thème clair au thème sombre ;
- d'actualiser le profil courant ;
- de voir le nom et les rôles du compte.

### 8.3 Tableaux

Chaque tableau générique permet :

- le tri croissant ou décroissant par colonne ;
- le filtrage par colonne ;
- la pagination ;
- le choix du nombre de lignes ;
- la sélection d'une ligne lorsque le module utilise cette sélection.

Le tri et le filtre de certains tableaux sont locaux à la page déjà chargée.
Pour les élèves, une pagination et une recherche sont également effectuées
côté backend.

## 9. Langue et thème

### 9.1 Langue

La langue choisie est enregistrée dans le profil utilisateur.

Le système traduit :

- les menus ;
- les titres et boutons ;
- les formulaires ;
- les colonnes génériques ;
- les principaux rôles, statuts et indicateurs techniques.

Les noms propres, codes, références et contenus saisis ne sont pas traduits.

### 9.2 Thème

Le thème clair ou sombre est enregistré localement dans le navigateur.
Il n'est pas actuellement rattaché au profil en base de données.

**À arbitrer :** décider si le thème doit suivre l'utilisateur sur tous ses
postes.

## 10. Profil et sécurité personnelle

### 10.1 Profil

Le menu **Compte > Profil** affiche :

- le nom d'affichage ;
- le nom d'utilisateur ;
- les rôles ;
- la langue ;
- les périmètres attribués.

Les types de périmètre sont :

- `NATIONAL`
- `REGION`
- `DEPARTMENT`
- `SCHOOL`

### 10.2 Changement de mot de passe

1. ouvrir **Compte > Mot de passe** ;
2. saisir le mot de passe actuel ;
3. saisir le nouveau mot de passe ;
4. cliquer sur **Changer**.

Après modification, toutes les sessions actives de l'utilisateur sont
révoquées. Il doit se reconnecter.

### 10.3 MFA TOTP

1. ouvrir **Compte > MFA** ;
2. cliquer sur **Démarrer MFA** ;
3. enregistrer le secret affiché dans une application TOTP de test ;
4. saisir le code généré ;
5. cliquer sur **Confirmer**.

Pour désactiver le MFA, un code TOTP valide est requis.

**Limite actuelle :** l'interface affiche un secret textuel, mais ne génère pas
encore un QR de provisioning convivial.

### 10.4 Sessions

Le menu **Sessions** rappelle les protections de la session courante.

**Implémenté dans l'API et le modèle, interface incomplète :**

- session serveur ;
- expiration ;
- rotation ;
- révocation ;
- invalidation après changement de mot de passe.

**À développer dans l'interface :**

- liste des appareils et sessions ;
- date de dernière activité ;
- révocation d'une session précise ;
- bouton « déconnecter tous les autres appareils ».

## 11. Rôles et périmètres

### 11.1 Rôles disponibles

- `SUPER_ADMIN_TECHNIQUE`
- `ADMINISTRATION_CENTRALE`
- `DELEGATION_REGIONALE`
- `DELEGATION_DEPARTEMENTALE`
- `RESPONSABLE_ETABLISSEMENT`
- `AGENT_IMMATRICULATION`
- `AGENT_CARTE`
- `AGENT_PRESENCE`
- `AGENT_SERVICE`
- `AGENT_FINANCE`
- `AUDITEUR_SECURITE`
- `ANALYSTE_STATISTIQUE`
- `SUPPORT`

### 11.2 Principe de cumul

Un utilisateur peut recevoir plusieurs rôles. Ses permissions correspondent à
l'union des permissions de ces rôles.

Le rôle ne suffit pas : le périmètre limite les données territoriales
accessibles.

### 11.3 Hiérarchie des périmètres

- un compte national voit tous les niveaux ;
- un compte régional voit la région, ses départements, arrondissements et
  établissements ;
- un compte départemental voit le département, ses arrondissements et
  établissements ;
- un compte établissement voit uniquement son établissement et ses données.

Un utilisateur ne doit pas pouvoir contourner cette limite en appelant
directement une URL ou l'API.

### 11.4 Administration des utilisateurs

Le menu **Administration > Utilisateurs** affiche actuellement la liste des
utilisateurs autorisés.

**API disponible, interface incomplète :**

- création d'utilisateur ;
- modification d'utilisateur ;
- attribution de rôles ;
- attribution de périmètres.

Le menu **Périmètres** permet actuellement d'affecter un périmètre
`SCHOOL` à partir d'un ID utilisateur et d'un ID établissement.

**À développer :**

- formulaire complet de création de compte ;
- sélection du rôle dans une liste ;
- affectation `NATIONAL`, `REGION`, `DEPARTMENT` ou `SCHOOL` ;
- recherche de l'entité par nom au lieu d'un ID ;
- contrôle de séparation des fonctions ;
- historique lisible des attributions ;
- désactivation et réactivation des comptes.

## 12. Administration de la carte scolaire

Le menu **Administration > Carte scolaire** constitue le point de départ des
référentiels territoriaux et scolaires.

### 12.1 Ordre de création

L'ordre obligatoire est :

1. région ;
2. département rattaché à une région ;
3. arrondissement ou district rattaché à un département ;
4. établissement rattaché à un arrondissement ;
5. année scolaire ;
6. niveau scolaire ;
7. classe rattachée à un établissement, une année et un niveau.

Les niveaux scolaires minimaux sont chargés par les données initiales. Leur
création n'est pas actuellement proposée dans l'interface.

### 12.2 Consultation du périmètre

La page affiche :

- le périmètre actif du compte ;
- les établissements accessibles ;
- les classes accessibles ;
- le graphe hiérarchique.

### 12.3 Graphe hiérarchique

Le graphe présente :

- les régions ;
- les départements ;
- les arrondissements ou districts ;
- les établissements.

Le cadre peut être affiché ou masqué. Un clic sur un nœud rond ouvre les
informations du nœud.

Chaque utilisateur ne voit que les nœuds inclus dans son périmètre.

### 12.4 Création d'une région

Renseigner :

- code ;
- nom ;
- chef-lieu.

### 12.5 Création d'un département

Renseigner :

- région parente ;
- code ;
- nom ;
- chef-lieu.

### 12.6 Création d'un arrondissement

Renseigner :

- département parent ;
- code ;
- nom ;
- chef-lieu.

### 12.7 Création d'un établissement

Renseigner :

- arrondissement parent ;
- code unique ;
- nom ;
- type ;
- sous-système éducatif ;
- statut.

### 12.8 Création d'une année scolaire

Renseigner :

- code, par exemple `2026-2027` ;
- date de début ;
- date de fin ;
- statut.

### 12.9 Création d'une classe

Renseigner :

- établissement ;
- année scolaire ;
- niveau ;
- code ;
- libellé ;
- capacité.

### 12.10 Règles d'accès

La création des référentiels est actuellement liée à la permission
`settings:update`.

Un utilisateur en consultation voit les référentiels, mais pas les formulaires
de création.

**À arbitrer :**

- quelles entités peuvent être créées par chaque niveau hiérarchique ;
- quelles créations nécessitent une validation supérieure ;
- si un établissement peut proposer une nouvelle classe sans la créer
  directement ;
- le workflow de demande, validation, rejet et commentaire.

## 13. Gestion des élèves

### 13.1 Création

Ouvrir **Scolarité > Nouvel élève**.

Renseigner :

- nom fictif ;
- prénom fictif ;
- date de naissance fictive ;
- ID établissement ;
- ID classe facultatif.

Le backend génère un matricule interne unique, non dérivé directement des
données personnelles.

### 13.2 Recherche et consultation

Ouvrir **Scolarité > Élèves**.

La page permet :

- une recherche textuelle ;
- une pagination ;
- le tri et le filtre des résultats chargés ;
- la sélection d'un élève ;
- l'affichage de son historique ;
- l'affichage des doublons potentiels.

### 13.3 Modification

Après sélection d'un élève, la fiche permet de modifier :

- nom ;
- prénom ;
- statut.

La mise à jour utilise une version optimiste. Une modification concurrente
peut donc être refusée pour éviter l'écrasement silencieux.

### 13.4 Archivage

L'archivage est logique. Il ne supprime pas physiquement le dossier.

Une confirmation est demandée avant l'opération.

### 13.5 Détection des doublons

Le système compare notamment :

- nom normalisé ;
- prénom normalisé ;
- date de naissance ;
- établissement.

Il produit des candidats et un score explicable. Il ne fusionne jamais
automatiquement deux dossiers.

**À développer :**

- écran de validation humaine ;
- décision « doublon confirmé » ou « dossiers distincts » ;
- justification ;
- workflow de fusion non destructive si juridiquement validé.

## 14. Inscriptions et parcours scolaire

### 14.1 Inscription annuelle

Ouvrir **Scolarité > Inscriptions**.

Renseigner :

- ID élève ;
- ID établissement ;
- ID classe ;
- ID année scolaire.

L'inscription est créée avec un statut actif.

### 14.2 Transfert

Renseigner :

- ID élève ;
- nouvel établissement ;
- nouvelle classe, si connue.

Une confirmation est demandée. Le transfert met à jour le rattachement courant
de l'élève et conserve un historique.

### 14.3 Parcours attendu

Le parcours scolaire doit couvrir :

- inscription ;
- changement de classe ;
- transfert ;
- sortie ;
- réintégration ;
- historique des statuts.

**Partiellement implémenté dans l'interface :** inscription et transfert.

**À développer :**

- changement de classe explicite ;
- sortie avec motif ;
- réintégration ;
- validation hiérarchique ;
- commentaires administratifs structurés ;
- consultation chronologique complète du parcours.

## 15. Cycle de vie des cartes

### 15.1 Dépendances

Avant de demander une carte :

- l'élève doit exister ;
- il doit être rattaché à un établissement accessible ;
- l'utilisateur doit posséder la permission appropriée.

### 15.2 Demande

Ouvrir **Opérations > Cartes**.

1. saisir l'ID de l'élève ;
2. cliquer sur **Demander** ;
3. actualiser ou sélectionner la carte créée.

### 15.3 Consultation

La liste présente notamment :

- ID ;
- numéro de série ;
- élève ;
- statut ;
- version.

Un clic sur une carte affiche :

- sa fiche technique ;
- son historique ;
- les actions permises.

### 15.4 Transitions disponibles

- activation ;
- suspension ;
- réactivation ;
- révocation ;
- remplacement.

Chaque transition demande une confirmation et crée une trace.

### 15.5 Règles fonctionnelles

- une carte révoquée ne doit plus être utilisable ;
- une carte suspendue doit être rejetée temporairement ;
- un remplacement doit préserver l'historique de l'ancienne carte ;
- une seule carte active par élève devrait être autorisée.

**À arbitrer :**

- distinction exacte entre demande, émission, impression et remise ;
- acteurs responsables de chaque étape ;
- motif obligatoire selon la transition ;
- règles de perte, dommage et réimpression ;
- validation locale ou centrale ;
- délais réglementaires.

## 16. QR signé

### 16.1 Génération

Ouvrir **Opérations > QR**.

1. saisir l'ID d'une carte active ;
2. cliquer sur **Générer** ;
3. récupérer le payload signé.

Le QR contient uniquement des identifiants opaques et des données techniques :

- version ;
- identifiant opaque ;
- identifiant de carte ;
- période de validité ;
- nonce ;
- version de clé ;
- signature.

Il ne contient pas directement le nom, la date de naissance, la photo ou les
données financières de l'élève.

### 16.2 Vérification

1. coller ou conserver le payload ;
2. cliquer sur **Vérifier** ;
3. lire le résultat.

Les résultats possibles incluent :

- valide ;
- carte suspendue ;
- carte révoquée ;
- carte inconnue ;
- signature invalide ;
- clé inconnue ou révoquée ;
- payload expiré ;
- payload mal formé.

Toute vérification est journalisée.

## 17. Présence

### 17.1 Consultation

Ouvrir **Opérations > Présence**.

Saisir éventuellement l'ID établissement puis actualiser la liste.

### 17.2 Entrée

Renseigner :

- ID établissement ;
- ID carte.

Cliquer sur **Entrée**.

### 17.3 Sortie

Avec les mêmes identifiants, cliquer sur **Sortie**.

### 17.4 Correction

1. sélectionner une ligne de présence ;
2. vérifier l'ID de présence ;
3. cliquer sur **Corriger et valider**.

Dans l'interface actuelle, cette action applique une correction fictive vers le
statut `LATE`, puis l'approuve immédiatement.

**À développer :**

- choix de la nouvelle valeur ;
- motif saisi par l'agent ;
- séparation entre correcteur et validateur ;
- justification d'absence ;
- gestion détaillée des retards ;
- statistiques par classe et période.

Aucune biométrie active n'est implémentée.

## 18. Services configurables

### 18.1 Exemples de services

- restauration ;
- sport ;
- assurance scolaire ;
- prestation sociale ;
- événement scolaire.

Les règles sont fictives et configurables. Aucune règle institutionnelle
officielle n'est supposée.

### 18.2 Attribution d'un droit

Ouvrir **Opérations > Services**.

1. sélectionner ou saisir l'ID du service ;
2. saisir l'ID élève ;
3. saisir l'ID d'un fournisseur fictif ;
4. cliquer sur **Attribuer**.

L'interface actuelle crée un droit actif sur une période courte calculée
automatiquement.

### 18.3 Vérification

1. saisir l'ID élève ;
2. saisir l'ID service ;
3. cliquer sur **Vérifier**.

Le backend vérifie l'existence, le statut et la période de validité du droit,
puis journalise l'opération.

**À développer :**

- formulaires de création des types de services ;
- gestion des fournisseurs ;
- calendrier de validité ;
- limites de consommation ;
- historique lisible des utilisations ;
- règles d'éligibilité configurables.

## 19. Paiements entièrement simulés

### 19.1 Principe

Le module ne se connecte à aucun opérateur réel.

Les fournisseurs simulés prévus sont :

- `MockMomoProvider`
- `MockOrangeMoneyProvider`
- `MockBankProvider`
- `MockCashDeskProvider`

### 19.2 Création d'une transaction

Ouvrir **Opérations > Paiements**.

Renseigner :

- ID établissement ;
- ID année scolaire ;
- ID élève facultatif.

Cliquer sur **Créer paiement simulé**.

L'interface utilise actuellement :

- fournisseur `MOCK_MOMO` ;
- montant fictif de `1500` ;
- catégorie fictive ;
- clé d'idempotence générée côté interface.

### 19.3 Rapprochement

1. sélectionner une transaction ;
2. vérifier son ID ;
3. cliquer sur **Rapprocher** ;
4. confirmer.

### 19.4 Idempotence

Une même clé d'idempotence ne doit pas créer plusieurs transactions. Les
doublons sont rejetés ou retournent le résultat existant selon la règle
backend.

**À développer :**

- formulaire de choix du fournisseur mock ;
- montant et catégorie configurables ;
- simulation volontaire d'erreurs ;
- écran séparé des rapprochements ;
- exports financiers simulés ;
- motifs et commentaires de rapprochement.

## 20. Tableau de bord

### 20.1 Tableau de bord central

Le tableau de bord présente des blocs par catégorie :

- scolarité ;
- cartes scolaires ;
- présences ;
- services ;
- paiements simulés ;
- alertes et sécurité.

Il affiche des indicateurs et des graphiques de distribution.

### 20.2 Filtre

Le tableau de bord central accepte actuellement un filtre par ID
établissement.

Le backend applique en plus le périmètre du compte.

### 20.3 Tableaux de bord spécialisés

- statistiques cartes ;
- statistiques présence ;
- statistiques paiements ;
- statistiques sécurité ;
- statistiques services.

### 20.4 Confidentialité

Les statistiques doivent rester agrégées. Les petits effectifs peuvent être
masqués selon un seuil configurable.

**À développer dans l'interface :**

- sélection par région, département et établissement ;
- période ;
- année scolaire ;
- niveau et classe ;
- service ;
- criticité ;
- graphiques temporels ;
- comparaison de périodes.

## 21. Exports contrôlés

### 21.1 Demande d'export

Ouvrir **Tableaux de bord > Exports**.

1. renseigner éventuellement l'ID établissement ;
2. cliquer sur **Demander export CSV** ;
3. attendre la création de l'export ;
4. sélectionner l'export ;
5. cliquer sur **Télécharger**.

### 21.2 Contrôles

Un export doit enregistrer :

- utilisateur ;
- rôle ;
- périmètre ;
- filtres ;
- motif ;
- date ;
- statut ;
- empreinte ;
- identifiant opaque.

Les fichiers doivent rester hors du répertoire public.

**Limite actuelle :** le motif est fixé par l'interface et n'est pas saisi par
l'utilisateur.

## 22. Audit, alertes et incidents

### 22.1 Journal d'audit

Le menu **Sécurité > Audit** affiche les événements autorisés.

Le journal est conçu comme append-only et contient une chaîne d'empreintes.

### 22.2 Intégrité

Le menu **Intégrité** vérifie :

- l'empreinte de chaque événement ;
- l'empreinte précédente ;
- la continuité de la chaîne ;
- les ruptures détectées.

### 22.3 Alertes

Le menu **Alertes** affiche les événements de sécurité.

Dans l'interface actuelle, cliquer sur une ligne déclenche directement son
accusé de réception.

**À corriger :** ouvrir d'abord une fiche d'alerte et demander une confirmation
avant l'accusé de réception.

### 22.4 Incidents

Le menu **Incidents** permet :

- de consulter les incidents ;
- de créer un incident fictif prédéfini ;
- de sélectionner un incident ;
- de le résoudre.

**À développer :**

- catégorie ;
- priorité ;
- criticité ;
- affectation ;
- commentaires ;
- preuves ;
- chronologie ;
- résolution ;
- clôture distincte ;
- délais de traitement.

### 22.5 Anomalies

Le menu **Anomalies** rappelle les événements journalisés :

- QR invalide ;
- carte suspendue ou révoquée utilisée ;
- double pointage ;
- paiement dupliqué ;
- accès hors périmètre.

**Limite actuelle :** ce menu est informatif et ne fournit pas encore une liste
d'anomalies consolidée.

## 23. Protection des données

### 23.1 Demandes

Le menu **Gouvernance > Données** affiche :

- les demandes relatives aux données ;
- le registre des traitements.

L'interface peut créer une demande fictive d'accès pour un élève.

### 23.2 Registre des traitements

Un traitement fictif peut être ajouté avec :

- nom ;
- finalité ;
- catégories de données.

### 23.3 Rétention

Le menu **Rétention** affiche les règles et permet d'ajouter une règle fictive
de 30 jours.

### 23.4 Cadre juridique

Les fonctions techniques ne constituent pas un avis juridique.

Doivent être validés humainement :

- base légale de chaque traitement ;
- finalités ;
- catégories de données ;
- durées de conservation ;
- droit d'accès et de rectification ;
- conditions d'archivage ou de suppression ;
- règles applicables aux mineurs ;
- transferts de données ;
- gestion des violations ;
- analyse d'impact.

## 24. Sauvegardes

Le menu **Sauvegardes** affiche les événements de sauvegarde accessibles.

Les opérations réelles sont effectuées par les scripts PowerShell :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup_database.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\list_backups.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_backup.ps1
```

Une restauration exige une confirmation explicite :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore_database.ps1
```

La restauration ne doit jamais être lancée automatiquement depuis l'interface.

## 25. Paramètres de sécurité

Le menu **Paramètres sécurité** affiche actuellement un état informatif :

- CSRF actif ;
- cookies `HttpOnly` actifs ;
- en-têtes de sécurité actifs ;
- biométrie désactivée.

**Limite actuelle :** il ne s'agit pas encore d'un véritable écran
d'administration des paramètres.

**À arbitrer :** identifier les paramètres modifiables sans compromettre la
sécurité ou nécessiter une modification globale de l'infrastructure.

## 26. Déconnexion

### 26.1 Procédure

1. cliquer sur **Déconnexion** en bas du menu ;
2. le frontend transmet le jeton CSRF ;
3. le backend révoque la session ;
4. les cookies de session et CSRF sont supprimés ;
5. l'utilisateur est renvoyé à la page de connexion.

### 26.2 Résultat attendu

Après déconnexion :

- l'application métier n'est plus visible ;
- un retour arrière ou un rechargement ne restaure pas la session ;
- `/api/v1/auth/me` retourne `401` ;
- une nouvelle authentification est nécessaire.

Si la déconnexion backend échoue, l'interface doit afficher une erreur et ne
pas prétendre que la session a été fermée.

## 27. Parcours complet recommandé pour une démonstration

### Étape A - Connexion

Se connecter avec `demo.school` pour observer une administration locale ou avec
`demo.regional` pour observer un périmètre régional.

### Étape B - Vérification du profil

Contrôler :

- rôle ;
- langue ;
- périmètre ;
- établissements visibles.

### Étape C - Carte scolaire

1. ouvrir la carte scolaire ;
2. afficher le graphe ;
3. sélectionner une région ;
4. sélectionner un département ;
5. sélectionner un arrondissement ;
6. sélectionner un établissement ;
7. consulter ses informations et ses classes.

### Étape D - Élève

1. créer un élève fictif ;
2. rechercher l'élève ;
3. ouvrir sa fiche ;
4. consulter l'historique ;
5. contrôler les doublons potentiels.

### Étape E - Inscription

1. récupérer les IDs nécessaires ;
2. inscrire l'élève ;
3. vérifier son rattachement ;
4. simuler éventuellement un transfert.

### Étape F - Carte

1. demander une carte ;
2. sélectionner la carte ;
3. l'activer ;
4. consulter son historique.

### Étape G - QR

1. générer un payload ;
2. vérifier le payload valide ;
3. suspendre la carte ;
4. vérifier que le payload est rejeté ;
5. réactiver la carte ;
6. vérifier le succès.

### Étape H - Présence

1. pointer une entrée ;
2. pointer une sortie ;
3. consulter la liste ;
4. sélectionner une ligne ;
5. simuler une correction.

### Étape I - Service

1. sélectionner un service ;
2. attribuer un droit fictif ;
3. vérifier l'éligibilité ;
4. tester un service non autorisé.

### Étape J - Paiement

1. créer une transaction simulée ;
2. sélectionner la transaction ;
3. effectuer le rapprochement ;
4. observer les statistiques.

### Étape K - Contrôle

1. consulter le tableau de bord ;
2. demander un export ;
3. consulter l'audit ;
4. vérifier l'intégrité ;
5. consulter les alertes et incidents.

### Étape L - Déconnexion

Cliquer sur **Déconnexion**, puis vérifier qu'un rechargement ne rouvre pas
l'application.

## 28. Règles de cohérence métier

Les règles suivantes doivent rester vraies :

1. un département appartient à une seule région ;
2. un arrondissement appartient à un seul département ;
3. un établissement appartient à un seul arrondissement ;
4. une classe appartient à un établissement et une année scolaire ;
5. un utilisateur n'accède qu'à son périmètre et à ses descendants ;
6. un élève est consultable uniquement dans un périmètre autorisé ;
7. le matricule est unique ;
8. aucune fusion de doublons n'est automatique ;
9. une carte appartient à un seul élève ;
10. une carte révoquée ne redevient pas active ;
11. une carte suspendue ne peut pas valider un service ou un QR ;
12. une correction de présence laisse une trace ;
13. une transaction simulée est idempotente ;
14. un export sensible exige une autorisation et une justification ;
15. chaque opération sensible est journalisée ;
16. la suppression physique n'est jamais utilisée sans règle explicite ;
17. aucune donnée réelle ou aucun secret ne doit être ajouté au prototype.

## 29. Écarts actuels entre la logique cible et l'interface

Les points suivants méritent une évolution prioritaire :

1. création et modification des utilisateurs dans l'interface ;
2. attribution complète des rôles et de tous les types de périmètres ;
3. gestion détaillée des sessions actives ;
4. remplacement des saisies d'ID par des sélecteurs recherchables ;
5. workflow hiérarchique de demande et validation d'une classe ;
6. gestion complète du parcours scolaire ;
7. séparation demande, émission, impression et remise d'une carte ;
8. formulaire complet des corrections de présence ;
9. administration des services et fournisseurs ;
10. paramétrage des paiements simulés ;
11. filtres avancés des tableaux de bord ;
12. justification saisie pour les exports ;
13. fiche détaillée et confirmation des alertes ;
14. gestion complète des incidents ;
15. écran réel des paramètres de sécurité ;
16. workflow complet des demandes relatives aux données.

## 30. Questions de fond à modifier ou valider

Cette section peut être utilisée comme liste d'arbitrage.

### Gouvernance

- Qui crée une région, un département, un arrondissement ou un établissement ?
- Qui valide chaque création ?
- Une entité locale peut-elle créer ou seulement proposer ?
- Quel est le chemin d'escalade et de retour d'un dossier ?

### Utilisateurs

- Qui crée les comptes ?
- Qui attribue les rôles privilégiés ?
- Un responsable d'établissement peut-il créer ses agents ?
- Quelle séparation des fonctions est obligatoire ?

### Élèves

- Quelles données sont strictement nécessaires ?
- Qui peut corriger l'identité d'un élève ?
- Qui valide un doublon ou une fusion ?
- Quelles pièces justificatives sont permises ?

### Cartes

- Qui demande, valide, émet, imprime et remet une carte ?
- Quel est le statut exact à chaque étape ?
- Quelle est la durée de validité ?
- Quelles règles s'appliquent à la perte ou au remplacement ?

### Présence et services

- Quels événements de présence sont officiels ?
- Qui peut corriger et qui doit valider ?
- Quelles règles d'éligibilité s'appliquent aux services ?
- Quels usages de la carte sont juridiquement permis ?

### Paiements

- Quelles catégories sont autorisées ?
- Quelle est la source de vérité du rapprochement ?
- Quels acteurs peuvent voir les montants ?
- Quelles intégrations réelles seraient autorisées ultérieurement ?

### Protection des données

- Quelle base légale s'applique ?
- Quelles durées de conservation sont validées ?
- Quels seuils de statistiques doivent être masqués ?
- Quelle procédure s'applique aux demandes d'accès ou de rectification ?

## 31. Structure proposée pour une future documentation utilisateur

Après validation du fond, ce document peut être séparé en plusieurs guides :

- guide administrateur central ;
- guide délégation régionale ;
- guide délégation départementale ;
- guide responsable d'établissement ;
- guide agent d'immatriculation ;
- guide agent carte ;
- guide agent présence ;
- guide agent service ;
- guide agent finance ;
- guide auditeur sécurité ;
- guide d'installation locale ;
- manuel de procédures ;
- référentiel des statuts et workflows ;
- foire aux questions.

## 32. Journal des modifications du présent guide

| Date | Auteur | Modification | Statut |
|---|---|---|---|
| 2026-06-09 | Équipe projet | Première version complète fondée sur l'application actuelle | À relire |

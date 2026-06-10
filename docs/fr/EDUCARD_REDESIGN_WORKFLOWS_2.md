# EduCard Secure — Spécification de refonte UX/UI et workflows — Volume 2
*Complément au Volume 1 (`EDUCARD_REDESIGN_WORKFLOWS.md`) — Version 1.0 — 2026-06-09*

---

## Objet du document

Ce volume couvre les axes non traités dans le Volume 1. Il suit la même structure : pour chaque module, l'état actuel est décrit, la cible fonctionnelle est définie, et chaque nœud est implémenté précisément (composant React, appel API, validations, états d'interface).

Les deux volumes sont conçus pour être exécutés séquentiellement. Ce volume suppose que les composants transversaux du Volume 1 (SearchSelect, SlideOverPanel, ToastNotification, FilterBar) sont déjà disponibles.

---

## Table des matières

1. [Workflow 8 — Sécurité : audit, alertes et incidents](#1-workflow-8--sécurité--audit-alertes-et-incidents)
2. [Workflow 9 — Services configurables](#2-workflow-9--services-configurables)
3. [Workflow 10 — Paiements simulés](#3-workflow-10--paiements-simulés)
4. [Workflow 11 — Exports contrôlés](#4-workflow-11--exports-contrôlés)
5. [Workflow 12 — Gouvernance et protection des données](#5-workflow-12--gouvernance-et-protection-des-données)
6. [Workflow 13 — Référentiels administratifs (carte scolaire)](#6-workflow-13--référentiels-administratifs-carte-scolaire)
7. [Workflow 14 — Connexion, sessions et sécurité personnelle](#7-workflow-14--connexion-sessions-et-sécurité-personnelle)
8. [Architecture frontend — navigation, routing et états globaux](#8-architecture-frontend--navigation-routing-et-états-globaux)
9. [Routes backend manquantes — spécifications](#9-routes-backend-manquantes--spécifications)
10. [Accessibilité, internationalisation et support mobile](#10-accessibilité-internationalisation-et-support-mobile)
11. [Priorisation — Sprint 6 à 9](#11-priorisation--sprint-6-à-9)
12. [Journal des modifications](#12-journal-des-modifications)

---

## 1. Workflow 8 — Sécurité : audit, alertes et incidents

### 1.1 État actuel et problèmes

**Journal d'audit (`Sécurité > Audit`) :** la liste des événements est affichée mais le filtre n'existe pas dans l'interface — seul le périmètre backend filtre implicitement. Il n'y a pas de pagination côté serveur visible, ce qui peut rendre la page inutilisable sur un volume réel de journaux.

**Alertes (`Sécurité > Alertes`) :** un clic sur une ligne déclenche immédiatement l'accusé de réception sans afficher de détail ni demander de confirmation. C'est un comportement incorrect : un agent peut accuser réception d'une alerte sans l'avoir lue.

**Incidents (`Sécurité > Incidents`) :** création limitée à un incident fictif prédéfini. Pas de catégorie, priorité, affectation, chronologie des actions, ni clôture distincte de la résolution.

**Anomalies (`Sécurité > Anomalies`) :** page informative sans liste consolidée ni action possible.

**Intégrité (`Sécurité > Intégrité`) :** fonctionnelle côté API, mais le résultat de vérification est affiché sans contextualisation des ruptures détectées.

### 1.2 Journal d'audit — refonte

**Page :** `Sécurité > Audit`

**Composant maître :** `AuditLogPage.jsx`

**Barre de filtres (FilterBar, composant Volume 1) :**

| Filtre | Type | Options |
|---|---|---|
| Type d'événement | multi-select | AUTH, STUDENT, CARD, ATTENDANCE, PAYMENT, EXPORT, ADMIN, SECURITY |
| Acteur | SearchSelect | Recherche par nom d'utilisateur |
| Périmètre | cascade | Région → Département → Établissement |
| Période | date range | Date début / date fin, presets : Aujourd'hui, 7 jours, 30 jours, Personnalisé |
| Criticité | select | Toutes / Info / Avertissement / Critique |

Les filtres génèrent des paramètres de query string transmis directement à l'API :

```
GET /api/v1/audit?event_type=CARD,STUDENT&actor=demo.school&from=2026-06-01&to=2026-06-09&severity=WARNING&page=1&per_page=50
```

**Tableau de résultats :**

Colonnes : Horodatage (locale + UTC au survol), Type d'événement (badge coloré), Acteur, Objet concerné (élève / carte / utilisateur — avec lien cliquable vers la fiche), Résumé de l'action, Criticité.

Chaque ligne est cliquable → ouverture d'un `SlideOverPanel` avec le détail complet de l'événement :
- Tous les champs de l'enregistrement audit.
- Hash de l'événement et hash précédent (pour vérification manuelle de la chaîne).
- Bouton `"Copier le hash"`.
- Lien `"Vérifier l'intégrité de cette entrée"` → appelle `GET /api/v1/audit/{id}/verify`.

**Pagination :** côté serveur, `per_page` configurable (25 / 50 / 100). Indicateur de total (`"3 847 événements — page 1 sur 77"`). Navigation par numéro de page et boutons précédent/suivant.

**Export du journal :**

Bouton `"Exporter la sélection"` visible uniquement pour `AUDITEUR_SECURITE` et `ADMINISTRATION_CENTRALE`. Déclenche le workflow d'export contrôlé (voir Workflow 11) avec les filtres actuels pré-remplis.

### 1.3 Intégrité de la chaîne — refonte

**Page :** `Sécurité > Intégrité`

**Composant :** `IntegrityCheckPage.jsx`

**Deux modes :**

**Vérification automatique (défaut) :** au chargement de la page, déclencher automatiquement `GET /api/v1/audit/integrity` et afficher le résultat. Ne pas demander à l'utilisateur de cliquer "Lancer la vérification" — c'est une page de statut, elle doit afficher le statut immédiatement.

**Résultat sans rupture :**
```
┌─────────────────────────────────────────────┐
│  ✅  Chaîne intègre                          │
│  3 847 événements vérifiés                  │
│  Dernier événement : 09/06/2026 14h32        │
│  Durée de vérification : 1,2 s              │
└─────────────────────────────────────────────┘
```

**Résultat avec ruptures :**
```
┌─────────────────────────────────────────────┐
│  🚨  2 ruptures détectées                   │
│                                             │
│  Entrée #1842 — 03/06/2026 09h14            │
│  Hash attendu : a3f9...  Hash trouvé : 00d2...
│  [Voir l'entrée dans le journal]            │
│                                             │
│  Entrée #2103 — 05/06/2026 16h47            │
│  Hash attendu : 7c1a...  Hash trouvé : b8e0...
│  [Voir l'entrée dans le journal]            │
│                                             │
│  ⚠ Ces ruptures doivent être signalées      │
│  immédiatement à l'équipe de sécurité.      │
│  [Créer un incident de sécurité]            │
└─────────────────────────────────────────────┘
```

Le bouton `"Créer un incident de sécurité"` pré-remplit le formulaire d'incident avec catégorie `INTEGRITY_BREACH`, priorité `CRITICAL`, et le détail des ruptures dans la description.

**Vérification manuelle d'une entrée spécifique :** champ de saisie de l'ID ou du hash d'une entrée, bouton `"Vérifier cette entrée"`, appel `GET /api/v1/audit/{id}/verify`.

### 1.4 Alertes — refonte complète

**Page :** `Sécurité > Alertes`

**Composant maître :** `AlertsPage.jsx`

**Liste des alertes :**

Colonnes : Date, Type d'alerte, Criticité (badge), Objet concerné, Statut (`OUVERTE` / `ACQUITTÉE` / `RÉSOLUE`).

**Filtre rapide par statut :** `Toutes | Ouvertes | Acquittées | Résolues`

**Clic sur une ligne :** ouvre le `SlideOverPanel` avec la fiche détaillée de l'alerte. **Le clic sur une ligne n'acquitte plus l'alerte** — c'est le bug actuel identifié.

**Fiche d'alerte (SlideOverPanel) :**

```
[Badge criticité]  Type : QR_INVALID_SIGNATURE
Objet             : Carte #SC-2026-00142 — MBARGA Jean-Pierre
Établissement     : Lycée de Nlongkak
Date              : 09/06/2026 à 14h32:07
Statut            : OUVERTE

Description :
  Tentative de vérification d'un QR avec signature invalide.
  IP source : 192.168.1.45 — Agent : demo.school
  Payload : { ... }

Actions liées :
  - [Voir dans le journal d'audit]
  - [Voir la fiche de la carte concernée]
  - [Créer un incident à partir de cette alerte]

─────────────────────────────────────────────
Traitement :

Commentaire (obligatoire pour acquitter) :
  [ Champ texte libre, min 10 caractères ]

[Annuler]    [Acquitter cette alerte]
```

**Accusé de réception :** appel `POST /api/v1/alerts/{id}/acknowledge` — corps : `{ comment }`. Après accusé de réception, la fiche reste ouverte avec le statut mis à jour et le commentaire visible.

**Résolution :** une alerte acquittée peut être résolue avec `POST /api/v1/alerts/{id}/resolve` — corps : `{ resolution_note }`. La résolution est distincte de l'acquittement : acquitter signifie "j'ai vu", résoudre signifie "le problème est traité".

**Alertes critiques — comportement prioritaire :**

Si des alertes de criticité `CRITICAL` sont ouvertes, afficher un bandeau rouge persistant en haut de toutes les pages (pas seulement la page Alertes) :

```
🚨  3 alertes critiques ouvertes non acquittées → [Voir les alertes]
```

Ce bandeau disparaît quand toutes les alertes critiques sont acquittées. Il est affiché pour les rôles `AUDITEUR_SECURITE`, `ADMINISTRATION_CENTRALE`, `DELEGATION_REGIONALE`.

### 1.5 Incidents — formulaire complet

**Page :** `Sécurité > Incidents`

**Composant liste :** `IncidentsListPage.jsx`
**Composant formulaire :** `IncidentFormModal.jsx`
**Composant fiche :** `IncidentDetailPanel.jsx`

#### Formulaire de création d'incident

```
Titre *                 : [input texte, max 120 caractères]

Catégorie *             : [select]
  - Violation de données personnelles
  - Tentative de fraude sur carte
  - Accès non autorisé
  - Rupture d'intégrité du journal
  - Dysfonctionnement technique
  - Incident de présence
  - Autre

Priorité *              : [select]  Faible | Normale | Haute | Critique

Objet concerné          : [SearchSelect — élève, carte ou utilisateur]

Description *           : [textarea, min 30 caractères]

Preuves (optionnel)     : [multi-file uploader — PDF, image, max 10 Mo par fichier]

Affectation             : [SearchSelect — utilisateur avec rôle AUDITEUR_SECURITE ou SUPPORT]

Date de l'incident *    : [input datetime-local, défaut : maintenant]
```

**Appel API :** `POST /api/v1/incidents` — corps multipart si pièces jointes.

#### Fiche d'incident (SlideOverPanel)

La fiche affiche l'état courant de l'incident et sa chronologie complète :

**En-tête :** titre, catégorie, priorité (badge), statut courant, affecté à, date d'ouverture.

**Statuts possibles et transitions :**

```
OUVERT  →  EN_COURS  →  RÉSOLU  →  CLÔTURÉ
               ↓
          ESCALADÉ  →  EN_COURS
```

Chaque transition demande un commentaire obligatoire. La clôture est distincte de la résolution : un incident résolu peut être rouvert si le problème réapparaît ; un incident clôturé est définitif.

**Chronologie (append-only, ordre antichronologique) :**

```
09/06/2026 15h12  demo.school  →  Statut : EN_COURS
                               "Enquête en cours, contact avec l'élève concerné."

09/06/2026 14h45  demo.school  →  Incident créé
                               "QR invalide détecté à l'entrée. Carte #142."
```

**Formulaire d'ajout de commentaire :**

```
Ajouter une note :
[ Textarea ]

Nouvelle pièce jointe : [file upload optionnel]

[Changer le statut ▾]    [Ajouter la note]
```

**Appels API :**
```
GET  /api/v1/incidents/{id}
POST /api/v1/incidents/{id}/comments        body: { text, file? }
POST /api/v1/incidents/{id}/transition      body: { new_status, comment }
GET  /api/v1/incidents/{id}/attachments
GET  /api/v1/incidents/{id}/attachments/{file_id}   (téléchargement sécurisé)
```

#### Liste des incidents

Colonnes : ID, Titre, Catégorie (badge), Priorité (badge coloré), Statut, Affecté à, Date ouverture, Âge (durée depuis ouverture, en rouge si > seuil configuré).

**Filtres :** statut, catégorie, priorité, affecté à, période.

**Indicateur de délai de traitement :** les incidents `OUVERT` ou `EN_COURS` depuis plus de 72 heures affichent leur âge en rouge. Ce seuil est configurable dans les paramètres de sécurité.

### 1.6 Anomalies — liste consolidée

**Page :** `Sécurité > Anomalies`

**Composant :** `AnomaliesPage.jsx`

L'objectif est de transformer la page actuellement informative en une liste opérationnelle agrégée depuis le journal d'audit.

**Appel API :** `GET /api/v1/audit?event_type=QR_INVALID,CARD_SUSPENDED_USE,CARD_REVOKED_USE,DUPLICATE_ATTENDANCE,DUPLICATE_PAYMENT,SCOPE_VIOLATION&severity=WARNING,CRITICAL&status=unresolved`

**Vue :** identique à la page Audit mais pré-filtrée sur les types d'anomalie. La colonne "Statut" distingue les anomalies auxquelles un incident a déjà été associé (`"Incident #47 ouvert"`) de celles non traitées (`"Non traité"`).

**Action rapide sur chaque ligne :** bouton `"Créer un incident"` qui pré-remplit le formulaire d'incident avec les données de l'anomalie.

---

## 2. Workflow 9 — Services configurables

### 2.1 État actuel et problèmes

L'attribution d'un service à un élève nécessite de saisir l'ID du service, l'ID de l'élève et l'ID d'un fournisseur fictif. Aucune interface n'existe pour créer ou configurer des types de services ni des fournisseurs. Les règles d'éligibilité sont hardcodées ou fictives. Il n'y a pas d'historique lisible des utilisations.

### 2.2 Architecture du module Services

Le module est restructuré en trois sous-sections :

```
Opérations > Services
  ├── Attribution et droits       (usage quotidien — tous rôles autorisés)
  ├── Types de services           (administration — RESPONSABLE_ETABLISSEMENT+)
  └── Fournisseurs                (administration — ADMINISTRATION_CENTRALE+)
```

### 2.3 Gestion des types de services

**Page :** `Opérations > Services > Types de services`

**Composant :** `ServiceTypeAdminPage.jsx`

**Formulaire de création / édition d'un type de service :**

```
Nom *                  : [input texte, ex. "Restauration scolaire"]
Code interne *         : [input texte, ex. "RESTO", majuscules, sans espace]
Catégorie *            : [select]
    - Restauration
    - Sport et activités
    - Assurance scolaire
    - Prestation sociale
    - Événement scolaire
    - Autre

Description            : [textarea]

Icône                  : [select d'icônes prédéfinies — liste de 20 icônes]

Actif                  : [toggle]

Règles d'éligibilité   :
  Niveaux autorisés    : [multi-select des niveaux scolaires]
  Statut élève requis  : [multi-select] Actif / Inscrit / ...
  Établissements       : [radio] Tous les établissements / Sélection manuelle
                         → si sélection manuelle : [multi-SearchSelect établissements]

Calendrier de validité :
  Début par défaut     : [date, ex. premier jour de l'année scolaire]
  Fin par défaut       : [date, ex. dernier jour de l'année scolaire]
  Durée en jours       : [integer, optionnel — si renseigné, prime sur la fin]

Limites de consommation :
  Nombre max par jour  : [integer, 0 = illimité]
  Nombre max par mois  : [integer, 0 = illimité]
  Nombre max total     : [integer, 0 = illimité]
```

**Appels API :**
```
GET    /api/v1/service-types
POST   /api/v1/service-types          body: { name, code, category, rules, calendar, limits }
PUT    /api/v1/service-types/{id}
DELETE /api/v1/service-types/{id}     (désactivation logique uniquement)
```

### 2.4 Gestion des fournisseurs

**Page :** `Opérations > Services > Fournisseurs`

**Composant :** `ServiceProviderAdminPage.jsx`

**Formulaire :**

```
Nom *             : [input texte, ex. "Cantine Centrale de Nlongkak"]
Code *            : [input texte, ex. "CANT_NLK"]
Type *            : [select] Restaurant / Salle de sport / Assureur / Organisateur / Autre
Établissement(s)  : [multi-SearchSelect — établissements servis par ce fournisseur]
Contact           : [input texte — nom de contact]
Téléphone         : [input tel]
Actif             : [toggle]
```

**Appels API :**
```
GET    /api/v1/service-providers
POST   /api/v1/service-providers
PUT    /api/v1/service-providers/{id}
```

### 2.5 Attribution de droits — refonte

**Page :** `Opérations > Services > Attribution et droits`

**Composant :** `ServiceEntitlementPage.jsx`

**Formulaire d'attribution (remplace la saisie d'ID actuelle) :**

```
Élève *           : [SearchSelect — nom, matricule, classe]
Service *         : [SearchSelect — nom du service, catégorie]
                   → après sélection : affiche les règles d'éligibilité du service
                   → vérifie automatiquement l'éligibilité de l'élève sélectionné
                   → si inéligible : message d'avertissement orange (non bloquant)

Fournisseur *     : [SearchSelect filtré par service sélectionné]

Période           :
  Début           : [date, pré-rempli depuis le calendrier du service]
  Fin             : [date, pré-rempli depuis le calendrier du service]

Notes             : [textarea optionnel]
```

**Vérification d'éligibilité en temps réel :**

Dès que l'élève et le service sont sélectionnés, appeler :

```
GET /api/v1/service-entitlements/check?student_id={id}&service_type_id={id}
```

Afficher le résultat inline sous les deux sélecteurs :
- ✅ `"MBARGA Jean-Pierre est éligible à ce service."` — vert.
- ⚠️ `"Cet élève n'est pas inscrit dans un niveau autorisé pour ce service."` — orange.
- ❌ `"Cet élève a déjà atteint la limite mensuelle pour ce service."` — rouge.

Les états orange et rouge n'empêchent pas la soumission (décision administrative possible), mais affichent un avertissement.

**Appel API soumission :** `POST /api/v1/service-entitlements`

### 2.6 Historique des utilisations

**Onglet "Utilisations" dans la fiche élève (`Scolarité > Élèves > [Élève] > Services`) :**

```
Service           Date/heure       Fournisseur         Résultat
Restauration      09/06 12h14      Cantine Nlongkak    ✅ Autorisé
Restauration      08/06 12h09      Cantine Nlongkak    ✅ Autorisé
Sport             07/06 14h00      Salle P. Ahidjo     ✅ Autorisé
Restauration      07/06 11h58      Cantine Nlongkak    ❌ Limite atteinte
```

**Appel API :** `GET /api/v1/service-entitlements/{entitlement_id}/usages` ou `GET /api/v1/students/{id}/service-usages`

---

## 3. Workflow 10 — Paiements simulés

### 3.1 État actuel et problèmes

Le formulaire de création d'une transaction utilise des valeurs hardcodées (fournisseur `MOCK_MOMO`, montant `1500`, catégorie générique). Le rapprochement est dans le même écran que la création. Il n'y a pas de simulation d'erreurs ni d'écran dédié aux rapprochements. Les exports financiers ne sont pas disponibles.

### 3.2 Architecture du module Paiements

```
Opérations > Paiements
  ├── Transactions         (liste + création)
  ├── Rapprochements       (écran dédié)
  └── Configuration mock   (paramétrage des fournisseurs simulés — AGENT_FINANCE+)
```

### 3.3 Formulaire de création de transaction — refonte

**Composant :** `PaymentCreateForm.jsx`

```
Établissement *       : [SearchSelect]
Année scolaire *      : [AcademicYearSelect]
Élève (optionnel)     : [SearchSelect — si la transaction concerne un élève précis]

Fournisseur mock *    : [select]
    - MockMomoProvider      (Mobile Money MTN)
    - MockOrangeMoneyProvider (Orange Money)
    - MockBankProvider       (Virement bancaire simulé)
    - MockCashDeskProvider   (Caisse manuelle simulée)

Catégorie *           : [select]
    - Frais de scolarité
    - Frais d'examen
    - Frais de carte scolaire
    - Contribution APE/AME
    - Autre

Montant *             : [input number, min 100, max 9 999 999, pas de décimales]
Devise               : XAF (non modifiable — affiché informatif)

Référence externe     : [input texte optionnel — numéro de transaction opérateur]

Simulation de résultat : [select]
    - Succès (défaut)
    - Échec réseau simulé
    - Timeout simulé
    - Fonds insuffisants simulés
    - Doublon simulé (teste l'idempotence)

Notes                 : [textarea optionnel]
```

**Comportement selon la simulation choisie :**

- `Succès` → appel normal, transaction créée avec statut `PENDING`.
- `Échec réseau / Timeout` → le mock backend retourne une erreur HTTP 503 ou 504. L'interface affiche l'erreur technique et propose de réessayer. Aucune transaction n'est créée.
- `Fonds insuffisants` → transaction créée avec statut `FAILED` et code d'erreur `INSUFFICIENT_FUNDS`.
- `Doublon` → réutilise la même clé d'idempotence que la dernière transaction de cet élève/établissement. L'interface vérifie la réponse : si le backend retourne `200` avec la transaction existante, afficher `"Transaction déjà existante retournée (idempotence correcte)"`. Si le backend crée un doublon, afficher `"Doublon détecté — comportement incorrect du backend"`.

**Clé d'idempotence :** générée automatiquement côté frontend (`crypto.randomUUID()`) et affichée en lecture seule. L'utilisateur peut la modifier pour tester des scénarios spécifiques.

### 3.4 Écran de rapprochement dédié

**Page :** `Opérations > Paiements > Rapprochements`

**Composant :** `ReconciliationPage.jsx`

**Structure :** liste des transactions en statut `PENDING` (non encore rapprochées), avec colonnes : date, établissement, élève (si lié), fournisseur, catégorie, montant, référence externe.

**Filtre :** statut (`PENDING` / `RECONCILED` / `FAILED` / `ALL`), fournisseur, établissement, période.

**Sélection multiple :** les cases à cocher permettent de sélectionner plusieurs transactions et de les rapprocher en lot.

**Panneau de rapprochement (SlideOverPanel) :**

```
Transaction #TXN-2026-00847
Fournisseur   : MockMomoProvider
Montant       : 7 500 XAF
Référence ext.: MTN-2026-847291
Statut        : EN ATTENTE DE RAPPROCHEMENT

Résultat du rapprochement :
  ( ) Succès — transaction confirmée
  ( ) Succès partiel — montant différent (saisir le montant réel : [___])
  ( ) Rejeté — transaction non trouvée chez l'opérateur
  ( ) Doublon — transaction déjà comptabilisée

Motif / commentaire * : [textarea]

[Annuler]    [Valider le rapprochement]
```

**Appel API :** `POST /api/v1/payments/{id}/reconcile` — corps : `{ result, actual_amount?, comment }`

**Rapprochement en lot :** `POST /api/v1/payments/reconcile-batch` — corps : `{ transaction_ids: [...], result, comment }`

### 3.5 Statistiques de paiement

**Widget dans le Dashboard (pour AGENT_FINANCE et niveaux supérieurs) :**

- Volume total rapproché sur la période filtrée (montant + nombre de transactions).
- Répartition par fournisseur (graphe en barres horizontales).
- Répartition par catégorie (graphe donut).
- Taux de succès du rapprochement (`.transactions WHERE status=RECONCILED / total`).
- Transactions en attente depuis plus de 48h (avec lien vers la file de rapprochement).

**Appel API :** `GET /api/v1/dashboard/payments?school_id=&year_id=&from=&to=` (à enrichir côté backend).

---

## 4. Workflow 11 — Exports contrôlés

### 4.1 État actuel et problèmes

Le motif de l'export est fixé par l'interface (`"Demande frontend"`) et n'est pas saisi par l'utilisateur. Le filtre se limite à un ID établissement. Il n'y a pas de sélection de type de données à exporter ni de périmètre configurable. La liste des exports antérieurs ne montre pas les métadonnées complètes (empreinte, statut de téléchargement).

### 4.2 Formulaire de demande d'export — refonte

**Page :** `Tableaux de bord > Exports`

**Composant formulaire :** `ExportRequestForm.jsx`

```
Type de données *     : [select]
    - Élèves et inscriptions
    - Cartes scolaires
    - Présences
    - Services et droits
    - Paiements simulés
    - Journal d'audit (AUDITEUR_SECURITE uniquement)
    - Anomalies de sécurité (AUDITEUR_SECURITE uniquement)

Périmètre             :
    Région            : [select, filtré au périmètre utilisateur]
    Département       : [select, en cascade]
    Établissement     : [SearchSelect, en cascade]
    (Laisser vide = périmètre maximal de l'utilisateur)

Année scolaire        : [AcademicYearSelect]

Période               :
    Du                : [date]
    Au                : [date]

Format *              : [radio]  CSV  |  XLSX  |  JSON

Motif * (obligatoire) : [textarea, min 20 caractères]
    Exemples : "Rapport mensuel pour la délégation régionale",
               "Vérification comptable troisième trimestre",
               "Audit externe MINESEC juin 2026"

Confidentialité des données :
  [ ] Je confirme que cet export sera utilisé uniquement dans le cadre
      de mes fonctions et ne sera pas partagé sans autorisation.
      (checkbox obligatoire)
```

**Comportement à la soumission :**

1. Appel `POST /api/v1/exports/request` — corps : `{ data_type, filters, format, reason }`.
2. L'export est créé avec statut `PENDING`. La génération est asynchrone côté backend.
3. Toast : `"Export demandé. Vous serez notifié quand il sera prêt."` (polling toutes les 10 secondes sur `GET /api/v1/exports/{id}/status`).
4. Quand `status = READY`, toast : `"Votre export est prêt. [Télécharger]"`.
5. Le téléchargement appelle `GET /api/v1/exports/{id}/download` — le backend sert le fichier depuis un répertoire sécurisé hors public, en ajoutant l'empreinte SHA-256 dans un header `X-Export-Checksum`.
6. Après téléchargement, le statut passe à `DOWNLOADED` et la date de téléchargement est enregistrée.

### 4.3 Historique des exports

**Section inférieure de la page Exports :**

Tableau avec colonnes : Date de demande, Type, Périmètre, Format, Motif (tronqué + tooltip), Statut, Empreinte SHA-256 (tronquée + copier), Téléchargé le, Actions.

**Colonne Actions :**
- Si `READY` → bouton `"Télécharger"`.
- Si `DOWNLOADED` → bouton `"Retélécharger"` (re-téléchargement journalisé séparément) et bouton `"Voir les métadonnées"`.
- Si `EXPIRED` (délai de rétention dépassé) → texte grisé `"Expiré"`.
- Si `FAILED` → bouton `"Réessayer"`.

**Appels API :**
```
GET  /api/v1/exports                           (liste paginée)
GET  /api/v1/exports/{id}                      (détail + métadonnées complètes)
GET  /api/v1/exports/{id}/download             (fichier sécurisé)
POST /api/v1/exports/{id}/redownload           (journalise un re-téléchargement)
```

---

## 5. Workflow 12 — Gouvernance et protection des données

### 5.1 État actuel et problèmes

Le module `Gouvernance > Données` permet de créer une demande fictive d'accès et d'ajouter un traitement fictif, mais sans workflow complet. La rétention affiche les règles et permet d'en ajouter une de 30 jours fixe. Il n'y a pas de suivi d'état des demandes, pas de notifications, pas de gestion complète du registre des traitements.

### 5.2 Workflow des demandes relatives aux données (RGPD-like)

**Page :** `Gouvernance > Données > Demandes`

**Composant :** `DataRequestWorkflowPage.jsx`

#### Formulaire de création d'une demande

```
Type de demande *  : [select]
    - Accès (droit d'accès de la personne concernée)
    - Rectification
    - Effacement ("droit à l'oubli")
    - Limitation du traitement
    - Portabilité
    - Opposition

Personne concernée :
    Nom *           : [input texte]
    Prénom *        : [input texte]
    Qualité         : [select] Élève / Parent ou tuteur / Autre
    Contact         : [input — email ou téléphone]

Objet de la demande * : [textarea — décrire les données concernées]

Pièce d'identité  : [file upload optionnel — PDF ou image]

Date de réception * : [datetime-local — peut être antérieure à la création]
```

**Appel API :** `POST /api/v1/data-requests`

#### Workflow de traitement d'une demande

Les demandes suivent le cycle d'états suivant, avec délai légal indicatif affiché :

```
REÇUE  →  EN_COURS  →  COMPLÉTÉE  →  CLÔTURÉE
   ↓
REJETÉE (avec motif)
```

Sur la fiche de chaque demande (SlideOverPanel) :

- Chronomètre depuis la réception, avec alerte si > 30 jours (délai indicatif configurable).
- Historique des actions avec horodatage et agent.
- Bouton de transition avec commentaire obligatoire.
- Pour les demandes `EFFACEMENT` : lien vers l'outil de vérification des données de l'élève avant exécution.
- Pour les demandes `PORTABILITÉ` : déclenchement d'un export des données de la personne concernée (appel `POST /api/v1/exports/portability` avec l'ID élève concerné).

**Appels API :**
```
GET  /api/v1/data-requests
GET  /api/v1/data-requests/{id}
POST /api/v1/data-requests/{id}/transition   body: { new_status, comment }
POST /api/v1/exports/portability             body: { student_id }
```

### 5.3 Registre des traitements — formulaire complet

**Page :** `Gouvernance > Données > Registre`

**Composant :** `ProcessingRegistryPage.jsx`

**Formulaire de création/édition d'un traitement :**

```
Nom du traitement *       : [input texte]
Finalité *                : [textarea]
Base légale *             : [select]
    - Obligation légale (enseignement obligatoire)
    - Mission de service public
    - Intérêt légitime
    - Consentement
    - Contrat
    - Intérêt vital

Catégories de données *   : [multi-select avec tags]
    ☑ Données d'identité (nom, prénom, date naissance)
    ☐ Données biométriques
    ☑ Données de scolarité (inscriptions, notes, classe)
    ☑ Photos
    ☑ Données de paiement
    ☑ Données de présence
    ☑ Données de géolocalisation implicite (établissement fréquenté)
    ☐ Données de santé
    ☐ Données sensibles (art. 9 RGPD ou équivalent local)

Personnes concernées *    : [multi-select]
    ☑ Élèves mineurs
    ☑ Élèves majeurs
    ☑ Personnel éducatif
    ☐ Tiers

Responsable de traitement : [input texte — nom institutionnel]
Sous-traitants éventuels  : [textarea — ex. "MTN Mobile Money Corporation"]

Durée de conservation *   : [input nombre] [select : jours / mois / années]
Conservation après        : [select]
    - Fin de scolarité de l'élève
    - Fin de l'année scolaire
    - Date fixe

Transferts hors périmètre : [toggle + textarea si activé]
Mesures de sécurité       : [textarea]
Analyse d'impact requise  : [toggle]

Statut                    : [select] Actif / Suspendu / Archivé
```

**Appels API :**
```
GET    /api/v1/processing-registry
POST   /api/v1/processing-registry
PUT    /api/v1/processing-registry/{id}
```

### 5.4 Règles de rétention — administration complète

**Page :** `Gouvernance > Données > Rétention`

**Composant :** `RetentionRulesPage.jsx`

**Formulaire de création d'une règle :**

```
Nom *                   : [input texte, ex. "Journaux d'audit standard"]
Type de données *       : [select — même liste que le registre]
Durée *                 : [integer] [select : jours / mois / années]
Déclencheur *           : [select]
    - Fin de l'année scolaire de l'enregistrement
    - Fin de scolarité de l'élève concerné
    - Date de création de l'enregistrement
    - Date d'archivage

Action après expiration  : [select]
    - Anonymisation (remplace les données personnelles par des tokens)
    - Suppression logique (soft delete)
    - Archivage froid (déplacé hors de la base active)
    - Notification pour décision manuelle

Active                  : [toggle]
```

**Tableau des règles existantes :**

Colonnes : Nom, Type de données, Durée, Déclencheur, Action, Dernière exécution, Prochaine exécution prévue, Statut.

**Note :** les règles ne s'exécutent pas automatiquement depuis l'interface. L'interface configure les règles ; un job planifié backend (cron FastAPI ou script externe) les applique. L'interface affiche le résultat des dernières exécutions.

---

## 6. Workflow 13 — Référentiels administratifs (carte scolaire)

### 6.1 État actuel et problèmes

La création des référentiels (régions, départements, arrondissements, établissements, années scolaires, classes) est disponible mais sans workflow de validation hiérarchique. N'importe quel utilisateur avec `settings:update` peut créer n'importe quelle entité directement, sans approbation. Le graphe hiérarchique existe mais est statique. La gestion des niveaux scolaires n'est pas accessible dans l'interface.

### 6.2 Workflow de création hiérarchique avec validation

**Principe :** la création d'une entité géographique ou scolaire dépend du niveau de l'utilisateur :

| Entité | Peut créer directement | Doit proposer (soumis à validation) |
|---|---|---|
| Région | ADMINISTRATION_CENTRALE | — |
| Département | ADMINISTRATION_CENTRALE | DELEGATION_REGIONALE |
| Arrondissement | ADMINISTRATION_CENTRALE, DELEGATION_REGIONALE | DELEGATION_DEPARTEMENTALE |
| Établissement | ADMINISTRATION_CENTRALE, DELEGATION_REGIONALE | DELEGATION_DEPARTEMENTALE, RESPONSABLE_ETABLISSEMENT |
| Année scolaire | ADMINISTRATION_CENTRALE | — |
| Classe | ADMINISTRATION_CENTRALE, DELEGATION_REGIONALE, DELEGATION_DEPARTEMENTALE | RESPONSABLE_ETABLISSEMENT |

**"Proposer"** signifie créer l'entité avec statut `PENDING_VALIDATION`. Elle n'est pas utilisable tant qu'un niveau supérieur ne l'a pas approuvée.

**Formulaire de création d'une classe (depuis un établissement) :**

```
[Les champs standards du Volume 1, section 12.9, plus :]

Mode de soumission :
  ( ) Créer directement [disponible selon le rôle]
  (•) Proposer pour validation [toujours disponible]

Justification (si proposition) : [textarea — ex. "Ouverture d'une nouvelle filière sciences"]
```

**File de validation (`Administration > Carte scolaire > Propositions en attente`) :**

Liste des entités en statut `PENDING_VALIDATION` dans le périmètre du validateur.

Chaque ligne : type d'entité, nom, proposé par, établissement/région concerné, date, justification.

Actions : `[Approuver]` avec commentaire optionnel / `[Rejeter]` avec motif obligatoire.

**Appels API :**
```
POST /api/v1/classes                     body: { ..., submit_for_validation: true, justification }
GET  /api/v1/admin/pending-validations   (toutes entités en attente dans le périmètre)
POST /api/v1/admin/validations/{id}/approve   body: { comment? }
POST /api/v1/admin/validations/{id}/reject    body: { reason }
```

### 6.3 Graphe hiérarchique — interactions enrichies

**Composant :** `TerritorialGraphEnhanced.jsx` (extension du graphe actuel)

**Améliorations :**

- Double-clic sur un nœud → ouvre la fiche de l'entité dans un SlideOverPanel (informations complètes + liste des entités enfants + actions disponibles).
- Clic droit sur un nœud → menu contextuel : `"Ajouter un enfant"`, `"Modifier"`, `"Voir les classes"`, `"Voir les élèves"`.
- Indicateurs visuels sur chaque nœud :
  - Badge rouge = entités en attente de validation dans ce nœud.
  - Badge orange = établissement avec des alertes ouvertes.
  - Badge vert = tous les indicateurs nominaux.
- Bouton `"Développer tout"` / `"Réduire tout"`.
- Barre de recherche qui surligne le nœud correspondant dans le graphe.

### 6.4 Gestion des niveaux scolaires

**Page :** `Administration > Carte scolaire > Niveaux scolaires`

**Composant :** `AcademicLevelAdminPage.jsx`

Les niveaux sont actuellement chargés depuis des données initiales et non modifiables dans l'interface. Cette page permet de les consulter et, pour les niveaux non utilisés, de les désactiver.

**Tableau :**

Colonnes : Code, Libellé, Ordre (pour le tri dans les sélecteurs), Sous-système (`Francophone / Anglophone`), Cycle (`Primaire / Secondaire premier cycle / Secondaire second cycle`), Actif.

**Actions :** activer / désactiver (uniquement si le niveau n'est référencé dans aucune classe active).

**Appels API :**
```
GET  /api/v1/academic-levels
PATCH /api/v1/academic-levels/{id}   body: { active: false }
```

---

## 7. Workflow 14 — Connexion, sessions et sécurité personnelle

### 7.1 Page de connexion — refonte

**Composant :** `LoginPage.jsx`

**Améliorations :**

**Feedback progressif sur la force du mot de passe** (uniquement sur la page de changement de mot de passe, pas sur le formulaire de connexion — pour ne pas donner d'informations à un attaquant) :

Barre de force : Très faible / Faible / Moyenne / Forte / Très forte — calculée en frontend avec `zxcvbn` ou règles simples (longueur, présence de majuscule, chiffre, symbole).

**Indicateur de tentatives échouées :**

Si le backend retourne un header `X-Remaining-Attempts: 2` (à ajouter côté backend sur les réponses 401), afficher sous le formulaire : `"Attention : encore 2 tentatives avant le verrouillage du compte."` en orange.

**Page de compte verrouillé :**

Si le backend retourne `423 Locked`, ne pas afficher un message générique mais afficher une page dédiée :

```
Compte temporairement verrouillé

Votre compte a été verrouillé après plusieurs tentatives invalides.

Il sera automatiquement déverrouillé dans : [countdown HH:MM:SS]
                                          ou
Contactez votre administrateur pour un déverrouillage immédiat.

[← Retour à la connexion]
```

Le countdown est calculé depuis le header `X-Unlock-At: {timestamp}` retourné par le backend (à ajouter).

**Gestion du MFA — amélioration du flux :**

Actuellement, le champ MFA est toujours visible sur le formulaire de connexion. Problème : l'utilisateur sans MFA est confus par ce champ.

Refonte en deux étapes :

```
Étape 1 : nom d'utilisateur + mot de passe → [Connexion]
   ↓ si les credentials sont valides ET que le compte a MFA activé
Étape 2 : champ code TOTP → [Vérifier]
```

Si le compte n'a pas de MFA, l'étape 2 est sautée et la session est ouverte directement. L'étape 2 s'affiche uniquement quand nécessaire.

**Appels API :**
```
POST /api/v1/auth/login        → 200 (session) | 202 (MFA requis) | 401 | 423
POST /api/v1/auth/mfa/verify   → 200 (session) | 401
```

Le code `202` signifie "credentials valides, MFA requis". Le frontend affiche l'étape 2 à la réception d'un `202`.

### 7.2 Gestion des sessions actives

**Page :** `Compte > Sessions`

**Composant :** `SessionsManagementPage.jsx`

**État actuel :** la page affiche des informations générales sur les protections de session. Elle n'affiche pas les sessions actives de l'utilisateur.

**Refonte :**

```
Sessions actives (3)

[Session courante]
  Navigateur  : Chrome 124 — Windows 11
  IP          : 192.168.1.12
  Ouverture   : 09/06/2026 09h14
  Dernière activité : il y a 2 minutes
                                         [C'est cette session]

Chrome 122 — Windows 11
  IP          : 192.168.1.12
  Ouverture   : 08/06/2026 16h32
  Dernière activité : hier à 17h45
                                         [Révoquer cette session]

Safari — iPhone iOS 17
  IP          : 41.202.X.X
  Ouverture   : 07/06/2026 11h00
  Dernière activité : il y a 2 jours
                                         [Révoquer cette session]

[Révoquer toutes les autres sessions]
```

**Appels API :**
```
GET    /api/v1/auth/sessions              (liste des sessions de l'utilisateur courant)
DELETE /api/v1/auth/sessions/{session_id} (révocation d'une session)
DELETE /api/v1/auth/sessions/others       (révoque tout sauf la session courante)
```

La session courante est identifiée depuis le cookie de session transmis avec la requête — le backend peut retourner un champ `is_current: true` dans la réponse.

**Informations de session :** User-Agent (navigateur + OS), IP, date d'ouverture, date de dernière activité. Le backend enregistre ces informations à chaque requête authentifiée. Ne jamais afficher un token ou un cookie — uniquement des métadonnées.

---

## 8. Architecture frontend — navigation, routing et états globaux

### 8.1 Restructuration du menu latéral

**Problème actuel :** tous les groupes sont fermés par défaut. L'utilisateur doit explorer pour trouver la section qu'il cherche. Le groupe courant n'est pas automatiquement ouvert au chargement de la page.

**Règles :**

- Au chargement d'une page, le groupe contenant la page courante est automatiquement ouvert.
- Le groupe ouvert est mémorisé dans `localStorage` entre les navigations.
- Sur mobile (< 768px) : le menu est un drawer plein écran avec overlay sombre, fermé par défaut, ouvert via le bouton hamburger.
- Sur desktop : le menu peut être réduit à des icônes uniquement (état `collapsed`), avec tooltips au survol.

**Restructuration des groupes recommandée :**

```
● [Avatar + Nom]       (Compte : profil, MFA, sessions, mot de passe)
─
▸ Tableau de bord      (accueil contextuel rôle-adaptatif)
─
▸ Scolarité
    Élèves
    Inscriptions
    Transferts
    Doublons
─
▸ Opérations
    Cartes
    Présence
    QR — Vérification
    Services
    Paiements
─
▸ Administration
    Carte scolaire
    Utilisateurs
    Périmètres
─
▸ Sécurité
    Alertes             [badge rouge si alertes critiques ouvertes]
    Incidents           [badge si incidents ouverts]
    Audit
    Anomalies
    Intégrité
─
▸ Gouvernance
    Exports
    Protection des données
    Registre des traitements
    Rétention
    Sauvegardes
─
  Déconnexion
```

Les entrées de menu que l'utilisateur n'a pas la permission de voir sont simplement absentes (pas grisées). Le backend reste la source de vérité.

### 8.2 Routing React — structure recommandée

```
/                          → redirige vers /dashboard
/login                     → LoginPage
/dashboard                 → DashboardPage (rôle-adaptatif)

/scolarite/eleves          → StudentsListPage
/scolarite/eleves/nouveau  → StudentCreationStepper (Workflow 1)
/scolarite/eleves/:id      → StudentDetailPage (avec onglets : Informations, Inscription, Carte, Services, Parcours)
/scolarite/inscriptions    → EnrollmentsPage
/scolarite/transferts      → TransfersPage
/scolarite/doublons        → DuplicatesPage

/operations/cartes         → CardsPage (liste + SlideOverPanel)
/operations/presence       → AttendancePage
/operations/qr             → QRVerificationPage
/operations/services       → ServicesPage (avec sous-onglets)
/operations/paiements      → PaymentsPage (avec sous-onglets)

/administration/carte-scolaire  → TerritorialAdminPage
/administration/utilisateurs    → UsersAdminPage
/administration/perimetres      → ScopesAdminPage

/securite/alertes          → AlertsPage
/securite/incidents        → IncidentsPage
/securite/audit            → AuditLogPage
/securite/anomalies        → AnomaliesPage
/securite/integrite        → IntegrityCheckPage

/gouvernance/exports       → ExportsPage
/gouvernance/donnees       → DataRequestsPage
/gouvernance/registre      → ProcessingRegistryPage
/gouvernance/retention     → RetentionRulesPage
/gouvernance/sauvegardes   → BackupsPage

/compte/profil             → ProfilePage
/compte/mot-de-passe       → PasswordChangePage
/compte/mfa                → MFASetupPage
/compte/sessions           → SessionsManagementPage

/403                       → ForbiddenPage
/404                       → NotFoundPage
/500                       → ServerErrorPage
```

### 8.3 Pages d'erreur

**Composant `ForbiddenPage` (403) :**

```
Accès refusé

Vous n'avez pas les permissions nécessaires pour accéder à cette page.

Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur
en indiquant : [URL de la page] et votre rôle actuel : [rôle].

[← Retour au tableau de bord]
```

**Comportement global :** tout appel API retournant `403` redirige vers `/403`. Tout appel retournant `401` redirige vers `/login?redirect={current_path}` pour reprendre après reconnexion.

**Composant `ServerErrorPage` (500) :**

```
Erreur serveur

Une erreur inattendue s'est produite. Notre équipe technique a été informée.

Référence : [request_id extrait du header X-Request-ID si disponible]

[Réessayer]    [← Retour au tableau de bord]
```

**Gestionnaire d'erreur global (React ErrorBoundary) :** encapsuler chaque page dans un `ErrorBoundary` qui capture les erreurs JavaScript non gérées et affiche `ServerErrorPage` avec le message d'erreur (en développement) ou un message générique (en production).

### 8.4 Breadcrumbs

**Composant :** `Breadcrumbs.jsx` — affiché dans la barre supérieure, sous le titre de page.

```
Tableau de bord  >  Scolarité  >  Élèves  >  MBARGA Jean-Pierre
```

Chaque segment est cliquable (lien). Le dernier segment n'est pas cliquable (page courante).

Règle : les breadcrumbs sont générés automatiquement depuis la structure de routing définie en 8.2. Les noms d'entités dynamiques (nom de l'élève, titre de l'incident) sont chargés depuis le contexte ou un appel API.

### 8.5 Persistance du contexte de navigation

**Problème courant :** l'utilisateur filtre une liste d'élèves, ouvre une fiche, revient en arrière — les filtres sont perdus.

**Solution :** stocker les filtres de chaque liste dans l'URL (query string). Le bouton "Retour" du navigateur restaure exactement l'état de la liste précédente. Aucune gestion de state complexe nécessaire — l'URL est la source de vérité.

---

## 9. Routes backend manquantes — spécifications

Le Volume 1 identifiait 4 routes à créer. Ce volume en ajoute plusieurs. Voici la spécification complète de toutes les routes manquantes.

### 9.1 `GET /api/v1/dashboard/kpi`

**Paramètres query :** `school_id` (optionnel), `year_id` (optionnel), `period` (optionnel : `today`, `7d`, `30d`).

**Réponse :**

```json
{
  "active_students": { "value": 1247, "delta_pct": 3.2, "delta_direction": "up" },
  "card_coverage": { "value": 84.3, "delta_pct": -1.1, "delta_direction": "down", "unit": "%" },
  "attendance_today": { "value": 1103, "delta_pct": null, "delta_direction": null },
  "open_alerts": { "value": 3, "critical_count": 1 }
}
```

Le `delta_pct` compare avec la même période sur l'année précédente (ou la période précédente équivalente).

### 9.2 `GET /api/v1/dashboard/pending-actions`

**Paramètres query :** `scope` (périmètre de l'utilisateur courant, appliqué automatiquement depuis le token).

**Réponse :**

```json
{
  "attendance_corrections_pending": 3,
  "duplicates_unresolved": 2,
  "incidents_open": 1,
  "exports_ready": 1,
  "validations_pending": 0,
  "data_requests_overdue": 0
}
```

### 9.3 `GET /api/v1/cards/{card_id}/pdf`

Génère un PDF au format CR80 (85.6 × 54 mm) contenant le rendu de la carte.

**Implémentation backend recommandée :** utiliser `WeasyPrint` ou `reportlab`. Le PDF contient les données de la carte (récupérées en base), la photo (récupérée depuis le stockage sécurisé), et le QR code (généré à la volée depuis un payload frais avec courte durée de validité dédiée à l'impression).

**Réponse :** `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="carte-{matricule}.pdf"`.

**Permission requise :** `cards:read` + périmètre de l'élève.

**Journalisation :** chaque génération de PDF est enregistrée dans le journal d'audit (type `CARD_PDF_GENERATED`).

### 9.4 `POST /api/v1/notifications/sms`

**Corps :**

```json
{
  "recipient_phone": "+237612345678",
  "message": "La carte scolaire de Jean-Pierre MBARGA est prête. Matricule : SC-2026-00142.",
  "student_id": "...",
  "card_id": "..."
}
```

**Comportement (prototype) :** le message est journalisé mais non envoyé réellement. La réponse simule un succès. En production, brancher sur un provider SMS réel (MTN SMS API, Orange SMS API).

**Réponse :** `{ "status": "simulated", "message_id": "SMS-MOCK-2026-..." }`

### 9.5 `GET /api/v1/dashboard/payments`

**Paramètres query :** `school_id`, `year_id`, `from`, `to`.

**Réponse :**

```json
{
  "total_reconciled_amount": 1250000,
  "total_reconciled_count": 167,
  "success_rate_pct": 94.6,
  "by_provider": [
    { "provider": "MockMomoProvider", "amount": 875000, "count": 112 },
    { "provider": "MockOrangeMoneyProvider", "amount": 375000, "count": 55 }
  ],
  "by_category": [
    { "category": "Frais de scolarité", "amount": 950000, "count": 120 },
    { "category": "Frais d'examen", "amount": 300000, "count": 47 }
  ],
  "pending_over_48h": 4
}
```

### 9.6 `GET /api/v1/auth/sessions`

Retourne la liste des sessions actives de l'utilisateur courant (identifié depuis le cookie de session).

**Réponse :**

```json
[
  {
    "session_id": "sess_abc123",
    "user_agent": "Mozilla/5.0 (Windows NT 11.0) Chrome/124",
    "ip_address": "192.168.1.12",
    "created_at": "2026-06-09T09:14:00Z",
    "last_active_at": "2026-06-09T14:30:00Z",
    "is_current": true
  }
]
```

### 9.7 `DELETE /api/v1/auth/sessions/{session_id}` et `DELETE /api/v1/auth/sessions/others`

Révoquent une session spécifique ou toutes les sessions autres que la courante. Ces appels invalident les cookies de session correspondants côté backend.

### 9.8 `GET /api/v1/users/check-username`

**Paramètre query :** `q` (nom d'utilisateur à vérifier).

**Réponse :** `{ "available": true }` ou `{ "available": false }`.

**Rate limiting :** limiter à 10 appels/minute par IP pour éviter l'énumération.

### 9.9 `POST /api/v1/payments/reconcile-batch`

**Corps :**

```json
{
  "transaction_ids": ["txn_1", "txn_2", "txn_3"],
  "result": "SUCCESS",
  "comment": "Rapprochement lot juin 2026 — lot 3"
}
```

**Comportement :** traitement transactionnel — si un rapprochement échoue dans le lot, les autres ne sont pas annulés mais l'erreur est signalée dans la réponse par ID.

### 9.10 `POST /api/v1/exports/portability`

**Corps :** `{ "student_id": "..." }`

Génère un export de toutes les données personnelles d'un élève (identité, inscriptions, présences, cartes, services, paiements liés) dans un fichier JSON structuré, signé avec l'empreinte SHA-256.

**Permission requise :** `data:export_personal` (rôle dédié à la gouvernance des données).

---

## 10. Accessibilité, internationalisation et support mobile

### 10.1 Thème utilisateur persisté en base

**Problème actuel :** le thème clair/sombre est stocké dans `localStorage` du navigateur. Si l'utilisateur change de poste, il retrouve le thème par défaut.

**Solution :** ajouter un champ `preferred_theme` (`light` / `dark` / `system`) dans le profil utilisateur en base de données.

**Appel API :** `PATCH /api/v1/auth/me` — corps : `{ "preferred_theme": "dark" }`.

Au chargement de l'application, après authentification, lire `preferred_theme` depuis la réponse de `GET /api/v1/auth/me` et l'appliquer avant le premier rendu (pour éviter le flash de thème incorrect).

### 10.2 Traductions manquantes

Les éléments suivants ne sont actuellement pas traduits et doivent l'être :

**Statuts de carte :**
- `REQUESTED` → `Demandée` / `Requested`
- `ISSUED` → `Émise` / `Issued`
- `ACTIVE` → `Active` / `Active`
- `SUSPENDED` → `Suspendue` / `Suspended`
- `REVOKED` → `Révoquée` / `Revoked`

**Codes de résultat QR :**
- `CARD_SUSPENDED` → `Carte suspendue` / `Card suspended`
- `INVALID_SIGNATURE` → `Signature invalide` / `Invalid signature`
- `PAYLOAD_EXPIRED` → `Code expiré` / `Expired code`

**Niveaux scolaires :** les libellés des niveaux (6ème, 5ème... Form 1, Form 2...) doivent être localisés selon le sous-système (francophone/anglophone). Cette localisation est liée au niveau lui-même, pas à la langue de l'interface — un utilisateur francophone voit `"3ème"` pour les classes francophones et `"Form 4"` pour les classes anglophones.

**Messages d'erreur API :** tous les messages d'erreur retournés par le backend (`detail` dans les réponses 4xx) doivent exister en français et en anglais. Le backend retourne la clé d'erreur (`error_code`), le frontend affiche le message traduit.

### 10.3 Support mobile — points critiques

L'application est conçue pour desktop mais plusieurs rôles opérationnels (AGENT_PRESENCE, AGENT_CARTE) travaillent principalement sur smartphone ou tablette.

**Points à adapter pour les rôles terrain :**

**Taille des zones cliquables :** toutes les actions fréquentes (pointer entrée/sortie, acquitter une alerte, valider un scan QR) doivent avoir des boutons d'au moins 44 × 44 px (recommandation Apple HIG / Google Material).

**Page de pointage de présence sur mobile :**

Sur mobile, la page de présence doit s'afficher en mode "une seule action" :

```
[Grande zone de scan QR — plein écran]
                 ou
[Nom de l'élève — grand texte — + Entrée / Sortie]
```

Pas de tableaux, pas de menus. La navigation vers les listes détaillées se fait depuis un bouton secondaire en bas de page.

**Page de vérification QR sur mobile :** identique — grand viewfinder, résultat plein écran (vert/rouge/orange) lisible à 2 mètres.

**Formulaires sur mobile :** les sélecteurs `SearchSelect` doivent s'ouvrir en bottom sheet (panneau qui monte depuis le bas) sur mobile, et non en dropdown, pour éviter les problèmes de clavier virtuel qui masque le champ.

**Orientation paysage :** la carte numérique (`DigitalCardView`) doit détecter l'orientation paysage et adapter son ratio d'affichage pour profiter de la largeur de l'écran.

### 10.4 Accessibilité de base (WCAG 2.1 AA)

**Labels et aria :** tous les champs de formulaire doivent avoir un `<label htmlFor>` explicite. Les icônes décoratives ont `aria-hidden="true"`. Les boutons icônes seuls ont `aria-label`.

**Contraste :** les badges de statut doivent respecter un ratio de contraste ≥ 4.5:1 entre le texte et le fond. Vérifier particulièrement les badges sur fond coloré clair (statut "Active" vert sur fond blanc).

**Navigation clavier :** tous les éléments interactifs (boutons, liens, champs, sélecteurs, lignes de tableau cliquables) sont accessibles au clavier. L'ordre de tabulation est logique (haut → bas, gauche → droite). Les modales piègent le focus à l'intérieur (`focus trap`) et le restituent à l'élément déclencheur à la fermeture.

**Messages d'état :** les toasts et messages de confirmation utilisent `role="status"` ou `role="alert"` pour être annoncés par les lecteurs d'écran. Les messages d'erreur de formulaire sont liés au champ concerné via `aria-describedby`.

---

## 11. Priorisation — Sprint 6 à 9

### Sprint 6 — Sécurité opérationnelle (2 semaines)

*Prérequis : Sprint 1 du Volume 1 (SlideOverPanel, FilterBar).*

- [ ] Journal d'audit avec filtres et pagination côté serveur (1.2)
- [ ] Fiche d'alerte avec confirmation avant accusé de réception (1.4)
- [ ] Bandeau d'alertes critiques global (1.4)
- [ ] Formulaire d'incident complet avec chronologie (1.5)
- [ ] Page d'anomalies consolidée avec action rapide (1.6)
- [ ] Page d'intégrité avec affichage des ruptures et lien vers la création d'incident (1.3)

### Sprint 7 — Services, paiements et exports (3 semaines)

- [ ] Formulaire de type de service avec règles d'éligibilité (2.3)
- [ ] Formulaire fournisseur (2.4)
- [ ] Attribution de services sans saisie d'ID + vérification éligibilité en temps réel (2.5)
- [ ] Historique d'utilisation des services dans la fiche élève (2.6)
- [ ] Formulaire de paiement avec choix de fournisseur, catégorie, montant, simulation d'erreur (3.3)
- [ ] Écran de rapprochement dédié avec sélection multiple (3.4)
- [ ] Formulaire d'export avec motif obligatoire et filtres complets (4.2)
- [ ] Historique des exports avec empreinte et statut de téléchargement (4.3)
- [ ] Routes backend : `/dashboard/payments`, `/payments/reconcile-batch` (9.5, 9.9)

### Sprint 8 — Gouvernance, référentiels et connexion (2 semaines)

- [ ] Workflow complet des demandes RGPD avec états et chronomètre (5.2)
- [ ] Formulaire complet du registre des traitements (5.3)
- [ ] Administration des règles de rétention (5.4)
- [ ] Workflow de validation hiérarchique des référentiels (6.2)
- [ ] Graphe territorial enrichi avec menu contextuel (6.3)
- [ ] Gestion des niveaux scolaires dans l'interface (6.4)
- [ ] Connexion en deux étapes avec MFA conditionnel (7.1)
- [ ] Page de compte verrouillé avec countdown (7.1)
- [ ] Gestion des sessions actives avec révocation (7.2)
- [ ] Routes backend : `/auth/sessions`, `/users/check-username` (9.6, 9.7, 9.8)

### Sprint 9 — Architecture, polish et accessibilité (2 semaines)

- [ ] Restructuration complète du menu latéral (8.1)
- [ ] Routing complet selon la structure définie (8.2)
- [ ] Pages d'erreur 403, 404, 500 et ErrorBoundary global (8.3)
- [ ] Breadcrumbs automatiques (8.4)
- [ ] Persistance des filtres dans l'URL sur toutes les listes (8.5)
- [ ] Thème utilisateur persisté en base + lecture au démarrage (10.1)
- [ ] Traductions manquantes (statuts carte, codes QR, niveaux scolaires bilingues) (10.2)
- [ ] Adaptation mobile pour les rôles terrain (présence, vérification QR) (10.3)
- [ ] Audit d'accessibilité de base : labels, contraste, navigation clavier, aria (10.4)
- [ ] Route backend `/cards/{id}/pdf` (9.3)
- [ ] Route backend `/notifications/sms` (9.4)

---

## 12. Journal des modifications

| Date | Auteur | Modification |
|---|---|---|
| 2026-06-09 | Analyse EduCard | Première version — complément du Volume 1 |

---

*Ce document est le Volume 2 de la spécification de refonte EduCard Secure. Il doit être exécuté après le Volume 1 (`EDUCARD_REDESIGN_WORKFLOWS.md`). Les composants transversaux (SearchSelect, SlideOverPanel, ToastNotification, FilterBar) définis dans le Volume 1 sont réutilisés ici sans être re-spécifiés.*

*Les décisions d'arbitrage institutionnel listées en section 30 du `GUIDE_UTILISATION_APPLICATION_A_Z.md` restent un prérequis non technique à la mise en production de certaines fonctionnalités (en particulier : le workflow de validation hiérarchique des référentiels, les règles d'éligibilité des services, la base légale des traitements de données personnelles, et les acteurs responsables de chaque étape du cycle de vie de la carte).*

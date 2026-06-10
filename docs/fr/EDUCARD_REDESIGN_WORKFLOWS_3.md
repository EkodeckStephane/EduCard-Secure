# EduCard Secure — Spécification de refonte UX/UI et workflows — Volume 3
*Corrections ciblées sur interfaces existantes — Version 1.0 — 2026-06-09*

---

## Objet du document

Ce volume complète les Volumes 1 et 2 sur trois interfaces existantes dont
l'état réel a été audité dans `EDUCARD_EXISTING_INTERFACES_AUDIT.md` :

1. **Fiche élève** — transformer le panneau empilé en fiche à onglets.
2. **Tableaux de bord spécialisés** — spécialiser les cinq pages, y ajouter
   les filtres, les KPI domaine et la navigation contextuelle.
3. **Module Sauvegardes** — enrichir la lecture sans jamais déclencher
   d'opération sensible depuis le frontend.

Les composants transversaux des Volumes 1 et 2 (SearchSelect, SlideOverPanel,
FilterBar, ToastNotification, KPICardGrid) sont réutilisés sans être
re-spécifiés. La bibliothèque graphique conservée est Chart.js / react-chartjs-2
déjà en place — aucune migration vers Recharts n'est imposée.

---

## Table des matières

1. [Workflow 15 — Fiche élève à onglets](#1-workflow-15--fiche-élève-à-onglets)
2. [Workflow 16 — Tableaux de bord spécialisés](#2-workflow-16--tableaux-de-bord-spécialisés)
3. [Workflow 17 — Module Sauvegardes en lecture enrichie](#3-workflow-17--module-sauvegardes-en-lecture-enrichie)
4. [Priorisation — Sprint 10 et 11](#4-priorisation--sprint-10-et-11)
5. [Journal des modifications](#5-journal-des-modifications)

---

## 1. Workflow 15 — Fiche élève à onglets

### 1.1 Diagnostic précis

L'état actuel est un panneau latéral avec cinq blocs empilés dans cet ordre :
formulaire de modification, bouton "Demander une carte", bouton "Archiver",
section "Historique", section "Doublons potentiels". Il n'existe pas d'onglets.
Le composant `DetailTabs` (qui expose `Détails`, `Historique`, `Services liés`)
est utilisé pour la fiche carte — pas pour l'élève.

Problèmes structurels résultants :
- Tout est chargé d'un coup à la sélection, y compris les données lourdes
  (historique, doublons).
- Les sections Carte, Services, Inscriptions et Parcours sont absentes.
- Le statut est une saisie libre (pas un `select`).
- Le conflit HTTP 409 est absorbé dans un message générique.
- L'archivage utilise `window.prompt` et le motif n'est pas transmis à l'API.
- La version optimiste (`record_version`) n'est pas transmise à l'archivage.

### 1.2 Stratégie de migration

La fiche élève passe d'un panneau latéral (`SlideOverPanel`) à une **page
dédiée** accessible via `/scolarite/eleves/:id`. La liste des élèves reste dans
`/scolarite/eleves`. Le clic sur une ligne de la liste navigue vers la page
dédiée.

> **Pourquoi une page dédiée plutôt qu'un panneau ?**
> Un panneau latéral de la largeur requise pour afficher 8 onglets, une photo,
> une carte numérique et un parcours scolaire chronologique occuperait 70 % de
> l'écran — autant utiliser une page. La liste reste accessible via le bouton
> "Retour" du navigateur, qui restaure les filtres grâce à la persistance dans
> l'URL (spécifiée au Volume 2, section 8.5).

La route `/scolarite/eleves` conserve un `SlideOverPanel` léger de **prévisualisation** : il contient uniquement l'onglet Synthèse et les deux
boutons d'action principale (Ouvrir la fiche complète, Demander une carte).
Cela évite un rechargement de page pour les actions rapides.

### 1.3 Structure de la fiche élève — page dédiée

**Composant maître :** `StudentDetailPage.jsx`

**En-tête (toujours visible, hors onglets) :**

```
[Photo 80×106]   MBARGA Jean-Pierre          [Badge statut : ACTIF]
                 Matricule : SC-2026-00142
                 Lycée de Nlongkak — 3ème C — 2026-2027

                 [Demander une carte]  [Archiver]  [⋯ Plus]
```

Le bouton `[⋯ Plus]` ouvre un menu déroulant avec les actions secondaires :
modifier le statut, lancer un transfert, exporter la fiche. Ces actions sont
filtrées par RBAC — seules les actions autorisées apparaissent.

**Onglets :**

```
[Synthèse]  [Identité]  [Parcours]  [Carte]  [Services]  [Historique]  [Doublons]  [Audit*]
```

`[Audit*]` est visible uniquement pour les rôles `AUDITEUR_SECURITE` et
`ADMINISTRATION_CENTRALE`.

Chaque onglet est chargé **à la demande** (lazy loading) — seul l'onglet actif
déclenche un appel API. Les données déjà chargées sont mises en cache dans
l'état local de la page jusqu'au rechargement ou à une mutation.

La route encode l'onglet actif dans l'URL :
`/scolarite/eleves/:id?tab=parcours`. Le rechargement de la page restaure le
bon onglet.

---

### 1.4 Onglet Synthèse

**Composant :** `StudentSummaryTab.jsx`

**Données affichées (lecture seule, toujours à jour) :**

| Section | Contenu |
|---|---|
| Identité | Nom complet, matricule, date de naissance, sexe |
| Scolarité courante | Établissement, classe, niveau, année scolaire, statut d'inscription |
| Carte | Statut de la carte active (badge) avec lien vers l'onglet Carte |
| Services | Nombre de droits actifs avec lien vers l'onglet Services |
| Dernière activité | Dernier événement enregistré (présence, modification, scan QR) |

**Appel API :** `GET /api/v1/students/{id}` — le backend retourne un objet
enrichi avec les champs de synthèse (`current_enrollment`, `active_card_status`,
`active_services_count`, `last_activity`). Si ces champs ne sont pas encore
dans la réponse existante, les ajouter au schéma de réponse de cette route.

---

### 1.5 Onglet Identité

**Composant :** `StudentIdentityTab.jsx`

**Corrections par rapport au formulaire actuel :**

**Champs affichés :**

| Champ | Type | Correction apportée |
|---|---|---|
| Photo | Zone d'upload avec preview | Absent actuellement — à ajouter (voir Vol. 1 §2.3) |
| Nom | `input[text]` | Ajouter `<label htmlFor>` visible |
| Prénom(s) | `input[text]` | Ajouter `<label htmlFor>` visible |
| Date de naissance | `input[date]` | Absent actuellement — à ajouter (lecture seule si non modifiable) |
| Sexe | `input[text]` lecture seule | Non modifiable après création |
| Statut | `select` | Remplace la saisie libre actuelle |
| Représentant légal | `input[text]` + `input[tel]` | Absent actuellement |

**Valeurs autorisées pour le statut :**

```
ACTIVE    → Actif(ve)
INACTIVE  → Inactif(ve)
SUSPENDED → Suspendu(e)
GRADUATED → Diplômé(e) / Sorti(e) avec succès
WITHDRAWN → Sorti(e) sans diplôme
ARCHIVED  → Archivé(e)
```

L'option `ARCHIVED` n'est pas sélectionnable directement depuis ce champ —
l'archivage passe par le bouton dédié avec son workflow (voir §1.8). Elle
est affichée en lecture seule si l'élève est déjà archivé.

**Transmission de `record_version` :**

À chaque chargement de l'onglet, la valeur `record_version` est stockée dans
l'état local du composant. À la soumission du formulaire, elle est incluse dans
le corps de la requête :

```json
PATCH /api/v1/students/{id}
{
  "last_name": "MBARGA",
  "first_name": "Jean-Pierre",
  "status": "ACTIVE",
  "record_version": 4
}
```

**Traitement du conflit HTTP 409 :**

Actuellement, le 409 affiche le message générique `"Modification élève
refusée"`. La nouvelle gestion :

```
┌──────────────────────────────────────────────────────────┐
│  ⚠️  Conflit de modification                             │
│                                                          │
│  Ce dossier a été modifié par un autre utilisateur       │
│  pendant que vous travailliez dessus.                    │
│                                                          │
│  Vos modifications :    Valeurs actuelles en base :      │
│  Nom : MBARGA           Nom : Mbarga (corrigé)           │
│  Statut : ACTIVE        Statut : SUSPENDED               │
│                                                          │
│  [Annuler mes modifications]   [Recharger et reprendre]  │
└──────────────────────────────────────────────────────────┘
```

Le tableau de comparaison est généré en différençant l'objet local (valeurs
saisies par l'utilisateur) et la réponse 409 (qui doit retourner l'objet
courant dans le corps — si le backend ne le fait pas encore, ajouter le champ
`current_record` dans la réponse 409).

**`[Annuler mes modifications]`** : recharge les données du backend et réinitialise le formulaire. Les modifications de l'utilisateur sont perdues.

**`[Recharger et reprendre]`** : recharge les données du backend, mais conserve
les valeurs saisies par l'utilisateur **dans les champs qu'il a modifiés**.
L'utilisateur peut alors comparer, choisir et soumettre à nouveau.

**Appel API :** `PATCH /api/v1/students/{id}` — corps avec `record_version`.

---

### 1.6 Onglet Parcours scolaire

**Composant :** `StudentEnrollmentTab.jsx`

Cet onglet regroupe tout ce qui était absent de la fiche actuelle : inscriptions,
changements de classe, transferts, sorties, réintégrations.

**Structure :**

**Section haute — inscription courante :**

```
Année scolaire 2026-2027
Établissement  : Lycée de Nlongkak
Classe         : 3ème C
Statut         : ACTIVE
Depuis le      : 01/09/2026

[Changer de classe]   [Initier un transfert]   [Enregistrer une sortie]
```

Les boutons sont filtrés par RBAC. `[Changer de classe]` ouvre une modale avec
un `SearchSelect` de classes (dans le même établissement et la même année
scolaire). `[Initier un transfert]` navigue vers `Scolarité > Transferts`
avec l'ID élève pré-rempli. `[Enregistrer une sortie]` ouvre la modale de
sortie (voir §1.6.1).

**Section basse — timeline du parcours :**

Timeline `StudentTimelineTab` (définie au Volume 2, §9.7), intégrée ici
directement plutôt que dans un onglet séparé.

**Appel API :** `GET /api/v1/students/{id}/enrollments` + `GET /api/v1/students/{id}/history`

#### 1.6.1 Modale de sortie

```
Enregistrer une sortie

Élève     : MBARGA Jean-Pierre — 3ème C — Lycée de Nlongkak

Type de sortie * :
  ( ) Diplômé(e) / Fin de cycle avec succès
  ( ) Sorti(e) sans diplôme
  ( ) Transfert vers l'enseignement supérieur
  ( ) Décès (traitement confidentiel)
  ( ) Autre

Date de sortie * : [date]

Motif détaillé * : [textarea, min 10 caractères]

⚠ Cette opération met fin à l'inscription courante.
  L'historique est conservé. L'action est réversible
  via une réintégration.

[Annuler]           [Confirmer la sortie]
```

**Appel API :** `POST /api/v1/enrollments/{id}/withdraw` — corps :
`{ exit_type, exit_date, reason }`. La route met à jour le statut de
l'inscription et du profil élève, et crée une entrée dans l'historique.

#### 1.6.2 Réintégration

Si l'élève a le statut `WITHDRAWN` ou `GRADUATED`, le bouton
`[Réintégrer l'élève]` remplace les actions de l'inscription courante.

```
Réintégrer l'élève

Élève    : MBARGA Jean-Pierre
Sortie   : 12/01/2026 — Sorti(e) sans diplôme

Établissement *   : [SearchSelect]
Classe *          : [SearchSelect]
Année scolaire *  : [AcademicYearSelect]
Date d'entrée *   : [date]
Motif *           : [textarea]
```

**Appel API :** `POST /api/v1/students/{id}/reenroll` — corps :
`{ school_id, class_id, academic_year_id, entry_date, reason }`.

---

### 1.7 Onglet Carte

**Composant :** `StudentCardTab.jsx`

Affiche directement le composant `DigitalCardView` (défini au Volume 1,
§4.2) pour la carte active ou la dernière carte connue de l'élève.

Si aucune carte n'existe :

```
Aucune carte scolaire pour cet élève.

[Demander une carte]
```

Si une carte existe, affiche :
- Le rendu visuel recto/verso.
- La frise `CardLifecycleTimeline` (Volume 1, §3.3).
- Les actions disponibles selon le statut (Volume 1, §3.4).
- Un lien `"Voir dans le module Cartes"` → `/operations/cartes?student={id}`.

**Appel API :** `GET /api/v1/students/{id}/cards` — retourne la liste des cartes
de l'élève. La carte active (status=ACTIVE) est affichée en premier. Les cartes
révoquées sont accessibles via un accordéon `"Cartes précédentes (2)"`.

---

### 1.8 Onglet Services

**Composant :** `StudentServicesTab.jsx`

Affiche la liste des droits actifs et l'historique des utilisations (Volume 2,
§2.6). Contient le bouton `[Attribuer un service]` (filtre RBAC) qui ouvre la
modale d'attribution sans navigation.

---

### 1.9 Onglet Historique

**Composant :** `StudentHistoryTab.jsx`

Timeline consolidée de tous les événements administratifs : créations,
modifications de statut, inscriptions, transferts, archivages, demandes de
carte. Chaque événement affiche : date, type, acteur, détail.

Cet onglet **remplace et enrichit** la section "Historique" actuellement
empilée dans le panneau. Il est chargé à la demande.

**Appel API :** `GET /api/v1/students/{id}/history`

---

### 1.10 Onglet Doublons

**Composant :** `StudentDuplicatesTab.jsx`

Cet onglet **remplace et enrichit** la section "Doublons potentiels"
actuellement empilée dans le panneau.

**État actuel à corriger :** les doublons sont affichés dans un tableau
générique sans action de décision possible sur chaque candidat depuis la fiche.

**Nouvelle implémentation :**

Pour chaque doublon potentiel, une carte de comparaison côte à côte :

```
┌──────────────────────────┬──────────────────────────┐
│  Dossier courant         │  Doublon potentiel        │
│  MBARGA Jean-Pierre      │  MBARGA Jean-Pierre       │
│  Né le 14/03/2009        │  Né le 14/03/2009         │
│  Lycée Nlongkak — 3ème C │  Lycée de Bafoussam (inactif)
│  Statut : ACTIF          │  Statut : ARCHIVÉ         │
│                          │  Score : 94 %             │
├──────────────────────────┴──────────────────────────┤
│  [C'est le même élève — fusionner*]  [Dossiers distincts] │
└──────────────────────────────────────────────────────┘
* La fusion reste non destructive et soumise à arbitrage institutionnel.
```

**Action `[Dossiers distincts]` :**

Modale de confirmation avec saisie de motif obligatoire, puis appel :
`POST /api/v1/students/duplicates/{candidate_id}/reject`
corps : `{ reference_student_id, reason }`.

**Action `[C'est le même élève]` :**

La fusion automatique est hors périmètre tant qu'elle n'est pas validée
institutionnellement (signalé dans le guide section 30). Cette action
déclenche une **proposition de fusion** soumise à validation :

```
POST /api/v1/students/duplicates/{candidate_id}/flag-for-merge
corps : { reference_student_id, reason }
```

Cela crée un enregistrement en statut `PENDING_MERGE_REVIEW`, visible dans
la file `Scolarité > Doublons` pour les rôles autorisés.

**Badge sur l'onglet :** si des doublons non traités existent, un badge rouge
avec le nombre apparaît sur le libellé de l'onglet :
`Doublons [2]`.

**Appel API :** `GET /api/v1/students/{id}/duplicates`

---

### 1.11 Onglet Audit

**Composant :** `StudentAuditTab.jsx`

Visible uniquement pour `AUDITEUR_SECURITE` et `ADMINISTRATION_CENTRALE`.

Affiche les entrées du journal d'audit concernant cet élève spécifiquement,
avec les mêmes colonnes que la page `Sécurité > Audit` (Volume 2, §1.2),
mais pré-filtrées sur `object_id = student.id`.

**Appel API :** `GET /api/v1/audit?object_id={student_id}&object_type=STUDENT`

---

### 1.12 Workflow d'archivage — refonte complète

**Problèmes actuels identifiés :**
1. `window.prompt` — à remplacer par une modale structurée.
2. Le motif saisi n'est pas transmis à l'API.
3. La route d'archivage n'accepte pas `record_version` — faille concurrence.
4. Le motif n'est pas journalisé dans le journal de sécurité.

**Corrections backend requises :**

La route `POST /api/v1/students/{id}/archive` doit être modifiée pour accepter :

```json
{
  "reason_code": "ADMINISTRATIVE_DECISION",
  "reason_text": "Élève n'ayant pas repris les cours depuis 3 trimestres.",
  "record_version": 4
}
```

Et retourner `409` si `record_version` ne correspond pas à la version courante
(cohérence avec la protection optimiste de `PATCH /students/{id}`).

Les codes de motif autorisés :

```
ADMINISTRATIVE_DECISION  → Décision administrative
PROLONGED_ABSENCE        → Absence prolongée non justifiée
DUPLICATE_RESOLVED       → Dossier doublon résolu
GRADUATION               → Fin de parcours — utiliser plutôt la sortie dédiée
OTHER                    → Autre (oblige à saisir reason_text)
```

**Modale d'archivage :**

```
Archiver le dossier de MBARGA Jean-Pierre

Cette opération est réversible via une réintégration,
mais elle met fin à toutes les opérations actives :
  • L'inscription courante sera clôturée.
  • La carte active sera suspendue automatiquement.
  • Les droits de service seront désactivés.

Motif * :
  ( ) Décision administrative
  ( ) Absence prolongée non justifiée
  ( ) Dossier doublon résolu
  ( ) Autre : [champ texte, obligatoire si sélectionné, min 10 caractères]

Justification complémentaire : [textarea optionnel]

[ ] Je confirme avoir vérifié l'identité du dossier à archiver.
    (checkbox obligatoire)

[Annuler]                         [Archiver ce dossier]
```

**Séquence d'appels :**

```
1. PATCH /api/v1/students/{id}/archive
   body: { reason_code, reason_text?, record_version }
   → 200 : succès, recharger la fiche
   → 409 : conflit de version → afficher la modale de conflit (§1.5)
   → 422 : données invalides → afficher les erreurs inline
```

**Après archivage :** recharger la fiche complète, afficher un toast
`"Dossier archivé. La carte associée a été suspendue automatiquement."`,
mettre à jour le badge de statut dans l'en-tête sans rechargement de page.

---

## 2. Workflow 16 — Tableaux de bord spécialisés

### 2.1 Diagnostic précis

Les cinq pages partagent le même composant `DistributionPanel` : un graphique
`Bar` (Chart.js, série unique `Total`, sans légende) et un tableau générique.
Aucune page n'a de filtre, de KPI propre, ni de lien retour vers le dashboard
central conservant le contexte. Les filtres du dashboard central ne se propagent
pas.

**Stratégie :** remplacer `DistributionPanel` par un composant spécialisé par
domaine, tout en conservant Chart.js. Ajouter les KPI, les filtres et la
navigation contextuelle communs à tous les cinq, puis les éléments propres
à chaque domaine.

### 2.2 Structure commune à tous les tableaux de bord spécialisés

**Composant partagé :** `SpecializedDashboardLayout.jsx`

Ce composant enveloppe chaque page spécialisée et fournit :

**En-tête commun :**

```
← Tableau de bord central        Statistiques Cartes

[Région ▾]  [Département ▾]  [Établissement ▾]  [Année scolaire ▾]  [Période ▾]
```

Le lien `← Tableau de bord central` navigue vers `/dashboard` en conservant les
filtres dans l'URL :
`/dashboard?region=CE&school=42&year=2026-2027&period=30d`.

Les filtres communs sont transmis à tous les appels API de la page via un
`FilterContext` React. Quand l'utilisateur arrive depuis le dashboard central
(clic sur un KPI ou sur `"Voir plus"`), les filtres actifs sont transmis via
les query params de l'URL et pré-remplissent automatiquement les sélecteurs.

**Persistance dans l'URL :** `/dashboard/cartes?region=CE&school=42&year=2026-2027&period=30d&status=ACTIVE`

**Zone KPI (4 cards) :** spécifique à chaque domaine — définie ci-dessous par
page.

**Zone graphiques :** 1 à 3 visualisations selon le domaine — types Chart.js
disponibles : `Bar`, `Doughnut`, `Line`.

**Zone tableau agrégé :** tableau avec filtres propres au domaine et pagination
côté serveur si le volume dépasse 50 lignes.

**Drill-down :** chaque ligne du tableau est un lien vers le module métier
correspondant, avec les mêmes filtres propagés dans l'URL. Les liens sont
conditionnés au RBAC — un utilisateur sans permission `students:read` ne voit
pas de lien vers la fiche élève.

---

### 2.3 Dashboard Cartes — `/dashboard/cartes`

**Composant :** `CardsDashboardPage.jsx`

#### KPI cards

| KPI | Calcul | Delta |
|---|---|---|
| Cartes actives | `COUNT(cards WHERE status=ACTIVE)` dans le périmètre | vs mois précédent |
| Taux de couverture | `actives / élèves inscrits × 100` | vs mois précédent |
| En attente d'émission | `COUNT(cards WHERE status=REQUESTED OR ISSUED)` | — |
| Délai moyen d'émission | `AVG(issued_at - requested_at)` en jours | vs mois précédent |

**Appel API :** `GET /api/v1/dashboard/cards/kpi?school_id=&year_id=&period=`

#### Graphiques

**Graphique 1 — Répartition par statut (Doughnut) :**

Segments : REQUESTED / ISSUED / ACTIVE / SUSPENDED / REVOKED.
Couleurs fixes par statut (cohérentes avec les badges de l'interface).
Légende visible à droite.

**Graphique 2 — Évolution mensuelle (Line) :**

Deux séries sur 12 mois : cartes demandées (ligne pointillée) / cartes
activées (ligne pleine). Axe X : mois. Axe Y : nombre.

**Appels API :**
```
GET /api/v1/dashboard/cards/distribution?...   → données Doughnut
GET /api/v1/dashboard/cards/trend?...          → données Line (à créer)
```

#### Filtres spécialisés (en plus des filtres communs)

```
[Statut ▾]   [Type d'événement ▾]   [Délai d'émission ▾ : < 7j / 7-30j / > 30j]
```

#### Tableau agrégé

Colonnes : Établissement, Élèves inscrits, Cartes actives, Taux de couverture
(%), En attente, Suspendues, Révoquées.

Tri par défaut : taux de couverture croissant (met en évidence les
établissements les moins couverts).

Drill-down : clic sur un établissement → `/operations/cartes?school_id={id}&year_id={id}`.

**Appel API :** `GET /api/v1/dashboard/cards/by-school?school_id=&year_id=&period=&status=`

---

### 2.4 Dashboard Présence — `/dashboard/presence`

**Composant :** `AttendanceDashboardPage.jsx`

#### KPI cards

| KPI | Calcul | Delta |
|---|---|---|
| Taux de présence du jour | `entrées / élèves inscrits × 100` (aujourd'hui) | vs J-1 |
| Absences non justifiées | `COUNT(ABSENT_UNJUSTIFIED)` aujourd'hui | vs moyenne 30j |
| Retards du jour | `COUNT(LATE)` aujourd'hui | vs moyenne 30j |
| Sorties anticipées | `COUNT(EARLY_DEPARTURE)` aujourd'hui | vs moyenne 30j |

**Appel API :** `GET /api/v1/dashboard/attendance/kpi?school_id=&year_id=&date=today`

#### Graphiques

**Graphique 1 — Répartition par type d'événement (Bar horizontal) :**

Barres : PRESENT / ABSENT_JUSTIFIED / ABSENT_UNJUSTIFIED / LATE / EARLY_DEPARTURE.
Conserve le type `Bar` existant, mais avec `indexAxis: 'y'` pour une lecture
plus claire avec 5 catégories.

**Graphique 2 — Tendance hebdomadaire du taux de présence (Line) :**

Série unique sur 5 jours (semaine courante). Axe X : jours de la semaine.
Axe Y : taux de présence en %. Afficher une ligne horizontale de référence
à la moyenne des 4 semaines précédentes.

**Appels API :**
```
GET /api/v1/dashboard/attendance/distribution?school_id=&year_id=&date=
GET /api/v1/dashboard/attendance/weekly-trend?school_id=&year_id=&week=current
```

#### Filtres spécialisés

```
[Classe ▾]   [Type d'événement ▾]   [Plage horaire ▾ : Matin / Après-midi / Journée]
```

#### Tableau agrégé

Colonnes : Classe, Effectif, Présents, Absents justifiés, Absents non
justifiés, Retards, Taux de présence (%).

Tri par défaut : taux de présence croissant.

Drill-down : clic sur une classe → `/operations/presence?class_id={id}&date={date}`.

**Appel API :** `GET /api/v1/dashboard/attendance/by-class?school_id=&year_id=&date=&event_type=`

---

### 2.5 Dashboard Paiements — `/dashboard/paiements`

**Composant :** `PaymentsDashboardPage.jsx`

#### KPI cards

| KPI | Calcul | Delta |
|---|---|---|
| Volume rapproché | `SUM(amount WHERE status=RECONCILED)` en XAF | vs mois précédent |
| Nombre de transactions | `COUNT(transactions)` dans la période | vs mois précédent |
| Taux de succès | `COUNT(RECONCILED) / COUNT(total) × 100` | vs mois précédent |
| En attente > 48h | `COUNT(PENDING WHERE age > 48h)` | — alerte si > 0 |

Le KPI "En attente > 48h" s'affiche avec un fond orange si la valeur est > 0,
et le clic navigue vers `/operations/paiements/rapprochements?overdue=true`.

**Appel API :** `GET /api/v1/dashboard/payments/kpi?...` (Volume 2, §9.5)

#### Graphiques

**Graphique 1 — Répartition par fournisseur (Bar) :**

Conserve le graphique Bar existant. Ajouter une deuxième série `Montant total`
(axe droit, type `Line` en overlay) en plus de la série `Nombre`. Chart.js
supporte cela nativement avec `type: 'bar'` sur les datasets nombre et
`type: 'line'` sur le dataset montant (mixed chart).

**Graphique 2 — Répartition par catégorie (Doughnut) :**

Segments : Frais de scolarité / Frais d'examen / Frais de carte / Contribution
APE / Autre.

**Appels API :**
```
GET /api/v1/dashboard/payments/by-provider?...
GET /api/v1/dashboard/payments/by-category?...
```

(Ces endpoints correspondent aux champs `by_provider` et `by_category` définis
dans la route `GET /api/v1/dashboard/payments` au Volume 2 §9.5. Les séparer
permet de les charger indépendamment si l'un est lent.)

#### Filtres spécialisés

```
[Fournisseur ▾]   [Catégorie ▾]   [Statut ▾ : Tous / Rapproché / En attente / Échoué]
```

#### Tableau agrégé

Colonnes : Établissement, Transactions, Montant total, Rapprochés, En attente,
Échoués, Taux de succès (%).

Drill-down : clic sur un établissement → `/operations/paiements?school_id={id}&period={period}`.

**Appel API :** `GET /api/v1/dashboard/payments/by-school?...`

---

### 2.6 Dashboard Sécurité — `/dashboard/securite`

**Composant :** `SecurityDashboardPage.jsx`

#### KPI cards

| KPI | Calcul | Delta |
|---|---|---|
| Alertes critiques ouvertes | `COUNT(alerts WHERE criticality=CRITICAL AND status=OPEN)` | — |
| Incidents ouverts | `COUNT(incidents WHERE status IN (OPEN, IN_PROGRESS))` | vs mois précédent |
| QR invalides (7j) | `COUNT(audit WHERE event_type=QR_INVALID_SIGNATURE AND date > -7j)` | vs 7j précédents |
| Accès hors périmètre (7j) | `COUNT(audit WHERE event_type=SCOPE_VIOLATION AND date > -7j)` | vs 7j précédents |

Les KPI "Alertes critiques" et "Incidents ouverts" ont un fond rouge si > 0.

**Appel API :** `GET /api/v1/dashboard/security/kpi?...` (route à créer)

#### Graphiques

**Graphique 1 — Événements par criticité (Bar) :**

Conserve le graphique Bar existant. Couleurs fixes : INFO=bleu, WARNING=orange,
CRITICAL=rouge. Légende visible.

**Graphique 2 — Tendance des événements critiques (Line, 30 jours) :**

Une seule série : nombre d'événements de criticité CRITICAL par jour sur 30
jours. Permet de voir si la tendance monte ou descend.

**Appels API :**
```
GET /api/v1/dashboard/security/distribution?...
GET /api/v1/dashboard/security/critical-trend?period=30d&...   (à créer)
```

#### Filtres spécialisés

```
[Criticité ▾]   [Type d'événement ▾]   [Statut alerte ▾ : Ouverte / Acquittée / Résolue]
```

#### Tableau agrégé

Colonnes : Type d'événement, Nombre (période), Dont critiques, Dernière
occurrence, Tendance (↑↓ vs période précédente).

Drill-down : clic sur un type d'événement → `/securite/audit?event_type={type}&period={period}`.

**Appel API :** `GET /api/v1/dashboard/security/by-event-type?...`

---

### 2.7 Dashboard Services — `/dashboard/services`

**Composant :** `ServicesDashboardPage.jsx`

#### KPI cards

| KPI | Calcul | Delta |
|---|---|---|
| Droits actifs | `COUNT(entitlements WHERE status=ACTIVE)` | vs mois précédent |
| Vérifications aujourd'hui | `COUNT(service_usages WHERE date=today)` | vs J-1 |
| Taux d'accès accordé | `COUNT(result=GRANTED) / COUNT(total) × 100` | vs mois précédent |
| Limites atteintes (7j) | `COUNT(result=LIMIT_REACHED WHERE date > -7j)` | vs 7j précédents |

**Appel API :** `GET /api/v1/dashboard/services/kpi?...` (à créer)

#### Graphiques

**Graphique 1 — Répartition par résultat de vérification (Bar) :**

Conserve le graphique Bar existant. Barres : GRANTED / DENIED_INELIGIBLE /
DENIED_SUSPENDED / LIMIT_REACHED / ERROR.

**Graphique 2 — Répartition par type de service (Doughnut) :**

Segments dynamiques selon les types de services configurés.

**Appels API :**
```
GET /api/v1/dashboard/services/distribution?...
GET /api/v1/dashboard/services/by-type?...   (à créer)
```

#### Filtres spécialisés

```
[Type de service ▾]   [Fournisseur ▾]   [Résultat ▾ : Accordé / Refusé / Limite]
```

#### Tableau agrégé

Colonnes : Type de service, Fournisseur, Droits actifs, Vérifications (période),
Accordés, Refusés, Taux d'accès (%).

Drill-down : clic sur un type de service → `/operations/services?type={code}&period={period}`.

**Appel API :** `GET /api/v1/dashboard/services/by-type-provider?...`

---

### 2.8 Routes backend à créer pour les dashboards spécialisés

Les routes suivantes n'existent pas encore ou sont à enrichir :

| Route | Paramètres communs | Paramètres spécialisés |
|---|---|---|
| `GET /api/v1/dashboard/cards/kpi` | `school_id, year_id, period` | — |
| `GET /api/v1/dashboard/cards/distribution` | idem | `status` |
| `GET /api/v1/dashboard/cards/trend` | idem | `months=12` |
| `GET /api/v1/dashboard/cards/by-school` | idem | `status` |
| `GET /api/v1/dashboard/attendance/kpi` | `school_id, year_id` | `date` |
| `GET /api/v1/dashboard/attendance/distribution` | idem | `date, event_type` |
| `GET /api/v1/dashboard/attendance/weekly-trend` | idem | `week` |
| `GET /api/v1/dashboard/attendance/by-class` | idem | `date, event_type` |
| `GET /api/v1/dashboard/payments/by-provider` | `school_id, year_id, period` | `status` |
| `GET /api/v1/dashboard/payments/by-category` | idem | `status` |
| `GET /api/v1/dashboard/payments/by-school` | idem | `status` |
| `GET /api/v1/dashboard/security/kpi` | `school_id, period` | — |
| `GET /api/v1/dashboard/security/distribution` | idem | `severity, event_type` |
| `GET /api/v1/dashboard/security/critical-trend` | idem | `days=30` |
| `GET /api/v1/dashboard/security/by-event-type` | idem | `severity, alert_status` |
| `GET /api/v1/dashboard/services/kpi` | `school_id, year_id, period` | — |
| `GET /api/v1/dashboard/services/distribution` | idem | `result` |
| `GET /api/v1/dashboard/services/by-type` | idem | `result` |
| `GET /api/v1/dashboard/services/by-type-provider` | idem | `service_type, result` |

**Paramètres communs — valeurs acceptées :**

- `school_id` : UUID ou absent (périmètre complet de l'utilisateur).
- `year_id` : UUID de l'année scolaire.
- `period` : `today`, `7d`, `30d`, `90d`, `custom` (avec `from` et `to`).
- `date` : ISO 8601, défaut `today`.

Toutes ces routes filtrent automatiquement au périmètre de l'utilisateur
authentifié, indépendamment des paramètres transmis.

---

## 3. Workflow 17 — Module Sauvegardes en lecture enrichie

### 3.1 Diagnostic précis

La page affiche un tableau générique d'événements de sauvegarde. Problèmes :

- Les scripts PowerShell ne créent pas d'enregistrements dans `backup_events`.
  La page peut donc être vide ou ne montrer que des données de démo.
- L'API retourne `created_by` dans le modèle mais ne l'expose pas dans
  la réponse `GET /api/v1/backups`.
- Les informations du système de fichiers (nom de fichier, taille, présence
  du `.sha256`) ne sont pas exposées par l'API.
- Il n'y a aucune carte de synthèse — l'état courant des sauvegardes n'est
  pas lisible en un coup d'œil.
- Les types d'événement et statuts ont des badges techniques illisibles.

**Contrainte à respecter absolument :** aucun bouton d'action sensible
(restaurer, créer, supprimer, vérifier depuis le frontend). La restauration
reste dans les scripts PowerShell.

### 3.2 Résoudre le problème de synchronisation scripts ↔ API

**Deux approches possibles — choisir l'une :**

**Option A — Script complémentaire `log_backup_event.ps1` (recommandée) :**

Chaque script de sauvegarde, vérification et restauration appelle en fin
d'exécution `log_backup_event.ps1` qui insère une ligne dans `backup_events`
via un appel `POST /api/v1/backups/log` avec un token de service dédié
(jamais un compte utilisateur).

La route `POST /api/v1/backups/log` est une route interne protégée par
un token fixe dans le `.env` (jamais dans le frontend). Elle accepte :

```json
{
  "event_type": "BACKUP_CREATED",
  "status": "SUCCESS",
  "file_reference": "backup_20260609_142301",
  "checksum_present": true,
  "file_size_bytes": 4823041,
  "started_at": "2026-06-09T14:23:01Z",
  "finished_at": "2026-06-09T14:23:08Z",
  "operator": "SCRIPT_AUTOMATED"
}
```

Le `file_reference` est une référence opaque — pas le chemin absolu du
fichier. Le frontend n'a jamais accès au chemin réel.

**Option B — Manifeste JSON produit par les scripts :**

Chaque script ajoute une entrée dans un fichier local `backups/manifest.json`
signé (empreinte SHA-256 du contenu). Le backend expose ce manifeste via
`GET /api/v1/backups/manifest` (lecture seule, route protégée, scrute le
fichier à chaque appel). La signature du manifeste est vérifiée avant
l'exposition.

L'Option A est recommandée car elle est cohérente avec le reste du système
(journalisation centralisée, périmètre, RBAC) et n'expose pas le système de
fichiers. L'Option B est acceptable si l'équipe ne souhaite pas modifier les
scripts pour effectuer des appels HTTP.

### 3.3 Structure de la page Sauvegardes — refonte

**Page :** `Gouvernance > Sauvegardes`

**Composant maître :** `BackupsPage.jsx`

#### Zone de synthèse (4 cartes — toujours visibles)

```
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│ Dernière sauveg.  │  │ Dernière vérif.   │  │ Dernier échec     │  │ Ancienneté        │
│ RÉUSSIE           │  │ EMPREINTE VÉRIF.  │  │ Il y a 12 jours  │  │ Il y a 6 heures  │
│ 09/06 14h23       │  │ 08/06 22h00       │  │ 28/05 02h00       │  │ Normal            │
└───────────────────┘  └───────────────────┘  └───────────────────┘  └───────────────────┘
```

**Logique de la carte "Ancienneté" :**

- < 24 heures → fond vert, texte `"Normal"`.
- Entre 24 et 48 heures → fond orange, texte `"Attention"`.
- > 48 heures → fond rouge, texte `"Sauvegarde manquante"`.

Cette carte alerte visuellement sur un oubli de sauvegarde sans que l'utilisateur
ait à lire le tableau.

**Appel API :** `GET /api/v1/backups/summary` (à créer — retourne les 4
indicateurs en un seul appel).

Réponse attendue :
```json
{
  "last_success": { "event_type": "BACKUP_CREATED", "finished_at": "...", "status": "SUCCESS" },
  "last_verification": { "event_type": "BACKUP_VERIFIED", "finished_at": "...", "status": "CHECKSUM_OK" },
  "last_failure": { "event_type": "BACKUP_CREATED", "finished_at": "...", "status": "FAILED" },
  "age_hours": 6
}
```

#### Bandeau d'information (toujours visible)

```
ℹ Les opérations de sauvegarde, vérification et restauration s'effectuent
  exclusivement via les scripts PowerShell administratifs.
  Cette page affiche uniquement l'historique journalisé par ces scripts.
```

Ce bandeau est non fermable. Il rappelle à tout moment que cette page est en
lecture seule, évitant toute confusion si un utilisateur cherche un bouton.

#### Filtres

```
[Type ▾ : Tous / Sauvegarde / Vérification / Restauration]
[Statut ▾ : Tous / Réussie / Échouée / Vérification OK / Vérification échouée]
[Période ▾]
```

#### Tableau enrichi

**Colonnes :**

| Colonne | Source | Affichage |
|---|---|---|
| Date/Heure | `finished_at` | Format local + UTC au survol |
| Type | `event_type` | Badge lisible (voir §3.4) |
| Statut | `status` | Badge coloré (voir §3.4) |
| Durée | `finished_at - started_at` | Ex. `7 secondes`, `2 min 14 s` |
| Référence | `file_reference` | Tronquée à 20 chars, copier au clic |
| Empreinte | `checksum_present` | `✓ Présente` ou `✗ Absente` |
| Opérateur | `created_by` | Nom d'utilisateur si disponible, sinon `Script` |

La colonne `Opérateur` utilise `created_by` qui est dans le modèle mais absent
de la réponse API actuelle — ajouter ce champ à `GET /api/v1/backups`.

**Clic sur une ligne :** ouvre un panneau de détail (SlideOverPanel) avec
tous les champs de l'événement, incluant `started_at`, `finished_at`, durée,
type, statut, référence, taille du fichier (si disponible via Option A), et
l'opérateur.

### 3.4 Badges lisibles pour les types et statuts

**Types d'événement — traductions :**

| Valeur technique | Badge affiché |
|---|---|
| `BACKUP_CREATED` | 💾 Sauvegarde |
| `BACKUP_VERIFIED` | 🔍 Vérification |
| `BACKUP_RESTORED` | 🔄 Restauration |
| `BACKUP_FAILED` | ⚠ Opération échouée |

**Statuts — couleurs et libellés :**

| Valeur technique | Badge | Couleur |
|---|---|---|
| `SUCCESS` | ✓ Réussie | Vert |
| `FAILED` | ✗ Échouée | Rouge |
| `CHECKSUM_OK` | ✓ Empreinte vérifiée | Vert |
| `CHECKSUM_FAILED` | ✗ Empreinte invalide | Rouge |
| `CHECKSUM_ABSENT` | ○ Empreinte absente | Orange |
| `RESTORE_COMPLETED` | ✓ Restauration journalisée | Bleu |
| `IN_PROGRESS` | ⟳ En cours | Gris animé |

### 3.5 Corrections backend à apporter

**1. Exposer `created_by` dans `GET /api/v1/backups` :**

Le modèle `backup_events` possède ce champ mais la route ne le retourne pas.
L'ajouter à la réponse avec le nom d'affichage résolu depuis `users`.

**2. Créer `GET /api/v1/backups/summary` :**

Retourne les 4 indicateurs de la zone de synthèse (dernier succès, dernière
vérification, dernier échec, ancienneté en heures).

**3. Créer `POST /api/v1/backups/log` (Option A uniquement) :**

Route interne protégée par token de service (header `X-Service-Token`). Jamais
exposée dans Swagger si possible (utiliser `include_in_schema=False` dans
FastAPI). Insère un événement dans `backup_events`.

**4. Étendre le modèle `backup_events` (Option A) :**

Ajouter les champs `checksum_present` (boolean), `file_size_bytes` (integer
nullable), `operator` (string nullable, `"SCRIPT_AUTOMATED"` ou nom
d'utilisateur).

---

## 4. Priorisation — Sprint 10 et 11

### Sprint 10 — Fiche élève et sauvegardes (2 semaines)

*Prérequis : Sprint 1 (Volume 1) pour SlideOverPanel, Sprint 3 (Volume 1) pour
DigitalCardView.*

**Fiche élève :**
- [ ] Création de la page dédiée `StudentDetailPage` avec routing `/scolarite/eleves/:id` (§1.2)
- [ ] En-tête persistant : photo, matricule, statut, boutons d'action filtrés RBAC (§1.3)
- [ ] Onglet Synthèse : données consolidées en lecture seule (§1.4)
- [ ] Onglet Identité : `select` de statut, labels visibles, transmission de `record_version` (§1.5)
- [ ] Traitement explicite du conflit HTTP 409 avec comparaison côte à côte (§1.5)
- [ ] Onglet Parcours : inscription courante, modale de sortie, réintégration, timeline (§1.6)
- [ ] Onglet Carte : intégration `DigitalCardView` + `CardLifecycleTimeline` (§1.7)
- [ ] Onglet Services : intégration de `StudentServicesTab` (§1.8)
- [ ] Onglet Historique : chargement à la demande (§1.9)
- [ ] Onglet Doublons : cards comparatives côte à côte avec décision humaine (§1.10)
- [ ] Onglet Audit (rôles restreints) (§1.11)
- [ ] Modale d'archivage avec motif structuré, `record_version`, transmission API (§1.12)
- [ ] Correction backend : route `PATCH /students/{id}/archive` accepte `reason_code`, `reason_text`, `record_version` (§1.12)
- [ ] Correction backend : réponse 409 inclut `current_record` pour la comparaison (§1.5)
- [ ] `SlideOverPanel` léger de prévisualisation sur la liste des élèves (§1.2)

**Sauvegardes :**
- [ ] Zone de synthèse 4 cards avec logique d'ancienneté et couleurs (§3.3)
- [ ] Bandeau informatif non fermable (§3.3)
- [ ] Filtres type / statut / période (§3.3)
- [ ] Tableau enrichi avec durée calculée, référence opaque, badge empreinte (§3.3)
- [ ] Badges lisibles pour types et statuts (§3.4)
- [ ] Panneau de détail sur clic de ligne (§3.3)
- [ ] Correction backend : exposer `created_by` dans `GET /api/v1/backups` (§3.5)
- [ ] Création de `GET /api/v1/backups/summary` (§3.5)
- [ ] Choisir Option A ou B pour la synchronisation scripts ↔ API et l'implémenter (§3.2)

### Sprint 11 — Tableaux de bord spécialisés (3 semaines)

*Prérequis : Sprint 4 (Volume 1) pour le dashboard central et les composants KPI.*

- [ ] Composant `SpecializedDashboardLayout` avec filtres communs, persistance URL, lien retour contextuel (§2.2)
- [ ] Dashboard Cartes : KPI, Doughnut statuts, Line trend 12 mois, tableau by-school (§2.3)
- [ ] Dashboard Présence : KPI, Bar horizontal, Line tendance hebdo avec référence, tableau by-class (§2.4)
- [ ] Dashboard Paiements : KPI, Bar + Line overlay, Doughnut catégories, tableau by-school (§2.5)
- [ ] Dashboard Sécurité : KPI, Bar criticité, Line critique 30j, tableau by-event-type (§2.6)
- [ ] Dashboard Services : KPI, Bar résultats, Doughnut by-type, tableau by-type-provider (§2.7)
- [ ] Propagation des filtres depuis le dashboard central vers les dashboards spécialisés via URL (§2.2)
- [ ] Drill-down filtré par RBAC sur tous les tableaux (§2.2)
- [ ] 19 routes backend dashboard listées en §2.8 (à prioriser selon la page la plus utile)

---

## 5. Journal des modifications

| Date | Auteur | Modification |
|---|---|---|
| 2026-06-09 | Analyse EduCard | Première version — corrections ciblées sur interfaces existantes |

---

*Ce document est le Volume 3 de la spécification de refonte EduCard Secure. Il
doit être exécuté après les Volumes 1 et 2. Il suppose que les scripts
PowerShell de sauvegarde sont accessibles et modifiables pour implémenter
l'option de journalisation choisie en §3.2.*

*Les décisions d'arbitrage institutionnel restantes (fusion de doublons,
validation hiérarchique des référentiels, base légale des traitements) sont
signalées en `À arbitrer` dans le guide source et restent des prérequis non
techniques à la mise en production des fonctionnalités concernées.*

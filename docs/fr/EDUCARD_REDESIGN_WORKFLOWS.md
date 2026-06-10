# EduCard Secure — Spécification de refonte UX/UI et workflows
*Document de travail technique — Version 1.0 — 2026-06-09*

---

## Objet du document

Ce document spécifie les améliorations à apporter à l'application EduCard Secure sur la base de l'analyse de l'état actuel (voir `GUIDE_UTILISATION_APPLICATION_A_Z.md`). Il détaille pour chaque workflow les problèmes identifiés, la cible fonctionnelle, et l'implémentation précise de chaque nœud : composants frontend, appels API, validations, états d'interface et transitions.

Il est conçu pour être utilisé directement par les développeurs frontend (React) et backend (FastAPI). Toutes les routes API citées sont celles déjà documentées dans Swagger/ReDoc. Là où une route API manque, cela est signalé explicitement.

---

## Table des matières

1. [Principes directeurs de la refonte](#1-principes-directeurs)
2. [Workflow 1 — Inscription élève guidée](#2-workflow-1--inscription-élève-guidée)
3. [Workflow 2 — Cycle de vie de la carte](#3-workflow-2--cycle-de-vie-de-la-carte)
4. [Workflow 3 — Carte numérique visible](#4-workflow-3--carte-numérique-visible)
5. [Workflow 4 — Vérification QR en temps réel](#5-workflow-4--vérification-qr-en-temps-réel)
6. [Workflow 5 — Pointage de présence assisté](#6-workflow-5--pointage-de-présence-assisté)
7. [Workflow 6 — Dashboard rôle-adaptatif](#7-workflow-6--dashboard-rôle-adaptatif)
8. [Workflow 7 — Gestion des utilisateurs et rôles](#8-workflow-7--gestion-des-utilisateurs-et-rôles)
9. [Corrections UX transversales](#9-corrections-ux-transversales)
10. [Priorisation et plan d'implémentation](#10-priorisation-et-plan-dimplémentation)
11. [Journal des modifications](#11-journal-des-modifications)

---

## 1. Principes directeurs

### 1.1 Problèmes structurels identifiés

L'interface actuelle souffre de quatre défauts systémiques :

**A. L'API est exposée telle quelle.** Les formulaires demandent des identifiants techniques (`ID élève`, `ID établissement`, `ID classe`) que l'utilisateur ne connaît pas et ne devrait jamais avoir à saisir. Cela indique que l'interface a été construite pour tester l'API, pas pour un usage opérationnel.

**B. Les objets métier ne sont jamais rendus visuellement.** Une carte scolaire numérique est un objet physique connu des utilisateurs (proviseurs, agents, élèves). Ne jamais en afficher le rendu visuel crée une déconnexion totale entre l'outil et la réalité. Il en va de même pour le parcours scolaire, qui n'existe qu'en tableau brut.

**C. Les workflows sont fragmentés entre modules.** Pour créer un élève et lui attribuer une carte, l'utilisateur doit naviguer entre quatre sections différentes sans fil conducteur. Il n'y a pas de notion de "tâche en cours".

**D. Les tableaux de bord affichent des données, pas des informations.** Présenter des chiffres bruts sans contexte, sans comparaison et sans lien vers l'action correspondante ne constitue pas un tableau de bord : c'est un rapport non formaté.

### 1.2 Règles de conception à respecter

- **Aucune saisie d'ID technique** dans les formulaires destinés aux utilisateurs métier. Tout identifiant technique est résolu par un sélecteur recherchable ou un contexte automatique.
- **Toute action irréversible** (révocation de carte, archivage élève, suppression d'inscription) exige une modale de confirmation avec saisie de motif et affichage de la conséquence précise.
- **Toute transition d'état** (carte demandée → émise, élève actif → archivé) crée une entrée dans le journal d'audit et affiche un retour visuel immédiat (toast de confirmation, mise à jour de la fiche sans rechargement de page).
- **Les données sensibles** (photo, matricule complet, données de paiement) ne sont chargées que si l'utilisateur en a la permission côté backend. L'interface ne masque pas des données non autorisées avec du CSS — elle ne les demande pas.
- **Le périmètre** de l'utilisateur filtre automatiquement toutes les listes. Un responsable d'établissement ne voit jamais une liste déroulante contenant des établissements hors de son périmètre.

---

## 2. Workflow 1 — Inscription élève guidée

### 2.1 État actuel et problèmes

**Formulaire actuel (`Scolarité > Nouvel élève`) :**
- Champs : nom, prénom, date de naissance, ID établissement (saisie libre), ID classe (optionnel, saisie libre).
- Pas de champ photo.
- Pas de vérification en temps réel des doublons avant soumission.
- L'inscription (rattachement à une classe et une année) est dans un formulaire séparé (`Scolarité > Inscriptions`) avec saisie de 4 identifiants techniques.
- La demande de carte est dans un troisième formulaire (`Opérations > Cartes`).

**Conséquences opérationnelles :** créer un élève et lui délivrer une carte nécessite 3 navigations séparées, la consultation du matricule généré après création, et la saisie de ce matricule dans deux autres formulaires. Le risque d'erreur est élevé.

### 2.2 Cible fonctionnelle

Un stepper en 4 étapes dans une seule page, avec progression persistante. À la fin du stepper, l'élève est créé, inscrit, et la demande de carte est émise en une opération cohérente.

```
[Étape 1 : Identité]  →  [Étape 2 : Rattachement]  →  [Étape 3 : Vérification]  →  [Étape 4 : Confirmation]
```

L'utilisateur peut revenir en arrière à n'importe quelle étape sans perdre ses données. Les données saisies sont conservées dans l'état local du composant (ou `sessionStorage` en cas de rechargement accidentel).

### 2.3 Implémentation détaillée — Étape 1 : Identité

**Composant React :** `StudentCreationStep1.jsx`

**Champs obligatoires :**

| Champ | Type HTML | Validation frontend | Validation backend |
|---|---|---|---|
| Nom de famille | `input[type=text]` | Non vide, 2–80 caractères, pas de chiffres | Normalisé (accents, casse) |
| Prénom(s) | `input[type=text]` | Non vide, 2–80 caractères | Normalisé |
| Date de naissance | `input[type=date]` | Date valide, entre aujourd'hui -5 ans et aujourd'hui -25 ans | Cohérence avec niveau scolaire |
| Sexe | `select` | Obligatoire, valeurs : `M` / `F` | Requis |
| Photo | `input[type=file]` | JPEG/PNG, max 5 Mo, ratio ~3:4 | Stockage sécurisé hors public |

**Implémentation du champ photo :**

Le champ photo n'est pas un simple `<input type="file">`. Il doit intégrer un flux de recadrage :

1. L'utilisateur clique sur la zone de dépôt (drag-and-drop ou clic).
2. Une prévisualisation s'ouvre avec une grille de recadrage libre ratio 3:4 (composant `react-image-crop` ou équivalent léger).
3. L'utilisateur valide le recadrage. L'image recadrée est convertie en `Blob` en mémoire.
4. Une vignette 80×106 px s'affiche dans le formulaire à côté du bouton "Modifier".
5. L'image n'est pas uploadée immédiatement — elle est transmise avec le reste du formulaire à l'étape 4 (soumission finale), dans un `FormData` multipart.

**Comportement en cas de photo absente :** le formulaire ne bloque pas l'avancement à l'étape 2. Un bandeau d'avertissement orange (`"La photo est fortement recommandée. La carte ne pourra pas être émise sans elle."`) s'affiche. La photo peut être ajoutée ultérieurement depuis la fiche élève.

**Déclenchement de la vérification doublons :**

Dès que nom + prénom + date de naissance sont tous les trois renseignés, déclencher un appel API en arrière-plan (debounce 800 ms) :

```
GET /api/v1/students/duplicates?last_name=...&first_name=...&birth_date=...
```

Si l'API retourne des candidats, afficher un bandeau discret sous les champs : `"2 élèves similaires détectés — vous les examinerez à l'étape 3."` Ne pas bloquer l'avancement.

### 2.4 Implémentation détaillée — Étape 2 : Rattachement

**Composant React :** `StudentCreationStep2.jsx`

**Principe :** tous les champs utilisent des sélecteurs recherchables en cascade. Aucun identifiant technique n'est visible de l'utilisateur.

**Sélecteur établissement :**

Composant `SchoolSearchSelect`. Au focus ou à la frappe :
- Appel : `GET /api/v1/schools?search={query}&scope={user_scope}` (le backend filtre automatiquement au périmètre).
- Affichage des résultats : nom de l'établissement, arrondissement, type (lycée/collège/CETIC), statut (actif/fermé).
- L'ID technique est stocké dans l'état local uniquement, jamais affiché.
- Si l'utilisateur a un périmètre `SCHOOL`, le sélecteur est pré-rempli et verrouillé.

**Sélecteur année scolaire :**

Appel : `GET /api/v1/academic-years?status=active` — Liste uniquement les années actives ou futures. Affichage : `2026-2027 (en cours)`. Pré-sélection automatique de l'année active si une seule existe.

**Sélecteur classe :**

Dépend du sélecteur établissement et du sélecteur année. Appel déclenché uniquement quand les deux sont renseignés :

```
GET /api/v1/classes?school_id={id}&academic_year_id={id}&with_capacity=true
```

Affichage : libellé de classe, niveau, capacité restante (`3ème A — 12 places disponibles`). Les classes pleines (`capacité = 0`) apparaissent grisées avec mention `"Complète"` mais restent sélectionnables (décision administrative possible).

**Champ niveau scolaire :** Pré-rempli automatiquement depuis la classe sélectionnée. Non modifiable directement (source : la classe).

### 2.5 Implémentation détaillée — Étape 3 : Vérification doublons

**Composant React :** `StudentCreationStep3.jsx`

**Affichage :** Si l'appel de détection (étape 1) n'a retourné aucun candidat, cette étape est affichée en mode "aucun doublon détecté" avec un résumé des données et un bouton "Confirmer". Le flux avance automatiquement après 2 secondes ou sur clic.

**Si des candidats existent :**

Chaque candidat est affiché dans une carte avec :
- Photo (vignette) si disponible.
- Nom, prénom, date de naissance.
- Établissement actuel, classe, statut.
- Score de similarité (ex. : `Similarité : 94 %`).
- Deux boutons : `"C'est le même élève"` et `"Dossiers distincts"`.

**Comportement sur `"C'est le même élève"` :**
- La création est annulée.
- L'utilisateur est redirigé vers la fiche du doublon confirmé.
- Le système enregistre la décision (appel : `POST /api/v1/students/duplicates/{id}/confirm`).

**Comportement sur `"Dossiers distincts"` :**
- Pour chaque candidat, l'agent doit cliquer sur ce bouton.
- Quand tous les candidats sont traités, le bouton "Continuer la création" se déverrouille.
- Le système enregistre les décisions de rejet de doublon (appel : `POST /api/v1/students/duplicates/{id}/reject` avec motif optionnel).

**Note :** si plusieurs candidats existent, l'agent doit traiter chacun d'eux. Il ne peut pas ignorer cette étape.

### 2.6 Implémentation détaillée — Étape 4 : Confirmation et soumission

**Composant React :** `StudentCreationStep4.jsx`

**Contenu :** récapitulatif en lecture seule de toutes les données saisies (photo, identité, rattachement). Bouton de retour à chaque étape. Checkbox obligatoire : `"Je confirme que les informations saisies sont exactes."`.

**Option "Créer et demander la carte immédiatement" :** checkbox optionnelle, cochée par défaut si l'utilisateur a la permission `cards:request`. Si cochée, la soumission exécutera les deux appels en séquence.

**Séquence d'appels API à la soumission :**

```
1. POST /api/v1/students              → { student_id }
2. POST /api/v1/students/{id}/photo   → (FormData avec le Blob photo)
3. POST /api/v1/enrollments           → { student_id, class_id, academic_year_id, school_id }
4. POST /api/v1/cards/request         → { student_id }   [uniquement si option cochée]
```

En cas d'échec à l'étape 2 (photo) : ne pas bloquer. Afficher un avertissement `"Inscription créée. La photo n'a pas pu être enregistrée. Vous pouvez l'ajouter depuis la fiche élève."` et continuer.

En cas d'échec à l'étape 3 ou 4 : afficher l'erreur, ne pas répéter les appels précédents (l'élève et l'inscription existent déjà). Proposer un lien direct vers la fiche élève ou la page des cartes.

**Page de résultat :** affiche le matricule généré, un bouton `"Voir la fiche élève"`, un bouton `"Inscrire un autre élève"`, et si la carte a été demandée, un lien vers `"Suivre la carte"`.

---

## 3. Workflow 2 — Cycle de vie de la carte

### 3.1 État actuel et problèmes

La page `Opérations > Cartes` liste les cartes avec leurs colonnes techniques. Les transitions d'état (activer, suspendre, etc.) sont disponibles, mais :
- Aucune confirmation avec motif obligatoire pour les transitions irréversibles.
- Pas de visualisation de la carte (voir Workflow 3).
- Pas de frise temporelle des transitions.
- La demande de carte nécessite de saisir un ID élève manuellement.

### 3.2 Architecture de la page Cartes

La page est restructurée en deux zones :

**Zone gauche (liste, 40 % de la largeur) :**
- Barre de recherche par nom d'élève, matricule ou numéro de série.
- Filtre rapide par statut : `Tous | Demandée | Émise | Active | Suspendue | Révoquée`.
- Chaque ligne : vignette photo élève, nom, numéro de série tronqué, badge de statut coloré, établissement.
- Clic sur une ligne → chargement du panneau droit sans rechargement de page.

**Zone droite (détail, 60 % de la largeur) :**
- Rendu de la carte numérique (voir Workflow 3).
- Frise d'état avec horodatage.
- Actions disponibles selon l'état courant.
- Onglets : Détails techniques / Historique / Services liés.

### 3.3 Implémentation de la frise d'état

**Composant React :** `CardLifecycleTimeline.jsx`

La frise affiche chronologiquement tous les événements de la carte, du plus récent au plus ancien :

```
[ACTIVE]        2026-06-09 14:32   Activée par demo.school
[ÉMISE]         2026-06-09 14:15   Émise par demo.school
[DEMANDÉE]      2026-06-09 09:04   Demandée par demo.school
```

Chaque événement affiche : icône de statut, libellé de transition, date et heure, nom de l'agent, motif saisi (si renseigné).

**Appel API :** `GET /api/v1/cards/{card_id}/history`

### 3.4 Implémentation des transitions d'état

Chaque transition disponible depuis l'état courant est affichée comme un bouton dans le panneau d'action. Les boutons indisponibles (ex. : "Activer" quand la carte est déjà active) ne sont pas affichés du tout.

**Matrice des transitions et comportements :**

| État actuel | Transition | Motif obligatoire | Confirmation | Irréversible |
|---|---|---|---|---|
| DEMANDÉE | → ÉMISE | Non | Oui | Non |
| ÉMISE | → ACTIVE | Non | Oui | Non |
| ACTIVE | → SUSPENDUE | Oui (liste + texte libre) | Oui | Non |
| SUSPENDUE | → ACTIVE | Oui (texte libre) | Oui | Non |
| ACTIVE | → RÉVOQUÉE | Oui (liste + texte libre) | Double confirmation | **Oui** |
| SUSPENDUE | → RÉVOQUÉE | Oui (liste + texte libre) | Double confirmation | **Oui** |
| RÉVOQUÉE | → REMPLACEMENT | Oui | Oui | Non (crée une nouvelle carte) |

**Implémentation de la modale de transition :**

Composant `CardTransitionModal.jsx`. Structure :

```
Titre : "Suspendre la carte de [Nom Élève]"
Sous-titre : "La carte sera immédiatement invalidée. Les services liés seront bloqués."

Motif (obligatoire) :
  [ ] Contrôle administratif
  [ ] Suspicion de fraude
  [ ] Demande du responsable légal
  [ ] Autre : [champ texte libre]

[Annuler]                    [Confirmer la suspension]
```

Pour les révocations (irréversibles), une double confirmation est requise : après la modale standard, une seconde modale demande à l'agent de saisir manuellement le numéro de série de la carte pour confirmer.

**Appels API pour les transitions :**

```
POST /api/v1/cards/{card_id}/activate
POST /api/v1/cards/{card_id}/suspend     body: { reason_code, reason_text }
POST /api/v1/cards/{card_id}/reactivate  body: { reason_text }
POST /api/v1/cards/{card_id}/revoke      body: { reason_code, reason_text }
POST /api/v1/cards/{card_id}/replace     body: { reason_code, reason_text }
```

### 3.5 Demande de carte depuis la liste élèves

Sur la fiche élève (`Scolarité > Élèves > [Élève]`), ajouter un bouton `"Demander une carte"` dans le panneau d'action, visible uniquement si :
- L'élève est actif et inscrit.
- L'élève n'a pas déjà une carte active ou demandée.
- L'utilisateur a la permission `cards:request`.

Ce bouton ouvre une modale de confirmation simple, puis appelle `POST /api/v1/cards/request` avec le `student_id` résolu depuis la fiche. L'utilisateur n'a jamais à copier-coller un identifiant.

---

## 4. Workflow 3 — Carte numérique visible

### 4.1 Problème central

La carte scolaire est l'objet principal du système. Elle n'est jamais affichée visuellement. Les agents voient des lignes de tableau avec un numéro de série et un statut, mais ils ne peuvent pas vérifier si la carte contient les bonnes informations avant de l'émettre.

### 4.2 Composant de rendu — `DigitalCardView.jsx`

Ce composant est réutilisable. Il est appelé depuis :
- La page Cartes (panneau droit).
- La fiche élève (onglet "Carte").
- La page de confirmation de création (fin du stepper).
- Le module de présence (après scan QR réussi).

**Dimensions de rendu :** ratio CR80 (85.6 × 54 mm), affichée en 342 × 216 px (×4 pour les écrans haute densité). Possibilité d'affichage agrandi en modal plein écran.

**Contenu de la carte (face recto) :**

```
┌─────────────────────────────────────────────────────────┐
│  [Logo MINESEC]          [Drapeau Cameroun]             │
│                                                         │
│  CARTE SCOLAIRE NUMÉRIQUE                               │
│  Année 2026-2027                                        │
│                                                         │
│  [Photo 3×4]   Nom : MBARGA Jean-Pierre                │
│                Matricule : SC-2026-00142                │
│                Né le : 14/03/2009                       │
│                                                         │
│  Établissement : Lycée de Nlongkak                      │
│  Classe : 3ème C — Sous-système francophone             │
│                                                         │
│  [QR Code signé]    [Badge statut : ACTIVE]             │
└─────────────────────────────────────────────────────────┘
```

**Appel API :** `GET /api/v1/cards/{card_id}` (retourne les données de la carte) + `GET /api/v1/students/{student_id}/photo` (retourne l'image avec header `Content-Type: image/jpeg`).

**Gestion de l'absence de photo :** afficher un avatar générique avec les initiales de l'élève. Pas d'espace vide, pas de texte "photo manquante" visible sur la carte rendue.

**Affichage du badge de statut :**

| Statut | Couleur badge | Texte |
|---|---|---|
| ACTIVE | Vert | ✓ ACTIVE |
| SUSPENDUE | Orange | ⚠ SUSPENDUE |
| RÉVOQUÉE | Rouge | ✗ RÉVOQUÉE |
| ÉMISE | Bleu | ◎ EN COURS D'ACTIVATION |
| DEMANDÉE | Gris | ○ EN ATTENTE |

### 4.3 Actions depuis la vue carte

**Bouton "Télécharger PDF" :**

Générer un PDF au format CR80 (85.6 × 54 mm) côté frontend via `jsPDF` ou en demandant au backend un endpoint dédié. Le PDF contient le recto de la carte avec tous les éléments, y compris le QR code encodé en haute résolution.

Route backend à créer : `GET /api/v1/cards/{card_id}/pdf`

**Bouton "Imprimer" :**

Déclenche `window.print()` avec une feuille de style d'impression (`@media print`) qui isole uniquement le composant carte et le dimensionne au format CR80 avec les marges d'impression correctes.

**Bouton "Envoyer par SMS" :**

Ouvre une modale avec le numéro de téléphone du tuteur (si renseigné dans la fiche élève), un message pré-rempli (`"La carte scolaire de [Prénom] est prête. Numéro : [Matricule]"`), et un bouton d'envoi. Appel : `POST /api/v1/notifications/sms` (route à créer).

**Bouton "Tester le QR" :**

Génère un payload QR pour cette carte (appel : `POST /api/v1/qr/generate`) et lance immédiatement sa vérification (appel : `POST /api/v1/qr/verify`). Le résultat s'affiche inline dans le panneau sans naviguer vers le module QR.

### 4.4 Vue face verso (optionnelle)

La face verso de la carte affiche :
- Les conditions d'utilisation en texte court.
- La liste des services activés avec icônes (restauration, sport, assurance...).
- Les coordonnées de l'établissement.
- Un numéro d'assistance pour perte ou vol.

Un bouton `"Retourner la carte"` avec animation CSS flip (transform rotateY 180deg, 300ms) permet de basculer entre recto et verso.

---

## 5. Workflow 4 — Vérification QR en temps réel

### 5.1 État actuel et problèmes

La page `Opérations > QR` est un formulaire texte : on colle un payload, on clique "Vérifier", on lit un résultat. Il n'y a pas de scanner de QR code visuel. Sur mobile, l'agent doit copier-coller le contenu du QR depuis une autre application, ce qui est inutilisable en conditions réelles.

### 5.2 Interface de vérification QR redessinée

**Page :** `Opérations > Vérification QR`

**Deux modes disponibles (onglets) :**

**Mode Scan (défaut sur mobile) :** utilise l'API `navigator.mediaDevices.getUserMedia` pour accéder à la caméra. La bibliothèque `zxing-js/browser` décode les QR codes dans le flux vidéo en continu sans clic manuel. Dès qu'un QR est détecté, la vérification est déclenchée automatiquement.

**Mode Saisie manuelle (défaut sur desktop) :** champ texte pour coller un payload, bouton "Vérifier".

### 5.3 Implémentation du mode scan

**Composant React :** `QRScannerModule.jsx`

```jsx
// Flux complet du composant
1. Demande de permission caméra au montage (si refusée → basculer sur mode saisie manuelle + message d'explication)
2. Afficher le flux vidéo dans une zone 100% largeur, hauteur 240px
3. Overlay SVG avec un carré de visée centré (64×64 px, coins animés)
4. À chaque frame (requestAnimationFrame) : analyser avec ZXing
5. À la première détection d'un QR valide (format EduCard) :
   a. Geler l'image (mettre pause sur la vidéo)
   b. Déclencher POST /api/v1/qr/verify avec le payload
   c. Afficher le résultat pendant 3 secondes
   d. Reprendre le scan automatiquement
```

### 5.4 Affichage du résultat de vérification

Le résultat s'affiche en plein écran sur mobile (ou dans un panneau sur desktop) avec un visuel fort et immédiat :

**Résultat VALIDE :**
```
┌──────────────────────────────────────┐
│  ✅  CARTE VALIDE                    │
│                                      │
│  [Photo]  MBARGA Jean-Pierre         │
│           Lycée de Nlongkak — 3ème C │
│           Carte active               │
│                                      │
│  Vérifié le 09/06/2026 à 14h32       │
└──────────────────────────────────────┘
```

**Résultat SUSPENDUE :**
```
┌──────────────────────────────────────┐
│  ⚠️  CARTE SUSPENDUE                 │
│                                      │
│  Cette carte n'est pas valide.       │
│  Contacter l'administration.         │
│                                      │
│  [Signaler un incident]              │
└──────────────────────────────────────┘
```

**Résultat RÉVOQUÉE / INCONNUE / SIGNATURE INVALIDE :**
```
┌──────────────────────────────────────┐
│  🚫  CARTE INVALIDE                  │
│                                      │
│  Motif : [code retour lisible]       │
│                                      │
│  [Signaler un incident]              │
└──────────────────────────────────────┘
```

Le bouton `"Signaler un incident"` ouvre le formulaire de création d'incident pré-rempli avec le payload QR, le résultat, la date et l'agent.

**Appel API :** `POST /api/v1/qr/verify` — corps : `{ payload: "..." }`

---

## 6. Workflow 5 — Pointage de présence assisté

### 6.1 État actuel et problèmes

La page `Opérations > Présence` demande la saisie manuelle de l'ID établissement et de l'ID carte pour pointer une entrée ou une sortie. En situation réelle, un agent de présence pointe des dizaines voire centaines d'élèves en quelques minutes. La saisie manuelle d'ID est opérationnellement impossible.

Par ailleurs, la correction de présence est un bouton qui applique directement un statut `LATE` fictif sans permettre de choisir la correction à apporter.

### 6.2 Interface de pointage redessinée

**Page :** `Opérations > Présence`

**Structure :**

**Bandeau de contexte (persistant en haut) :**
- Établissement actuel (auto-rempli depuis le périmètre, ou sélecteur si l'agent couvre plusieurs établissements).
- Date du jour et créneau horaire actif (calculé depuis la configuration de l'établissement).
- Compteur en temps réel : `127 entrées pointées | 12 absences non justifiées`.

**Mode scan QR (identique au workflow 4, section "présence") :**
- Le scan identifie automatiquement l'élève depuis le QR de sa carte.
- Si l'entrée est déjà pointée pour ce créneau → propose "Pointer la sortie" ou "Annuler".
- Si la carte est suspendue ou révoquée → affiche une alerte rouge et ne pointe pas.
- Chaque pointage valide déclenche un son court (succès ou échec) configurable.

**Mode liste (complémentaire) :**
- Liste des élèves de la classe sélectionnée avec leur statut de présence du jour.
- Clic sur un élève → pointer entrée / sortie / absence.
- Filtre par classe (sélecteur).

### 6.3 Implémentation du formulaire de correction

**Composant React :** `AttendanceCorrectionModal.jsx`

La correction n'est accessible qu'à un utilisateur avec la permission `attendance:correct`. Elle est distincte de la validation (permission `attendance:validate`) pour respecter la séparation des fonctions.

**Formulaire :**

```
Correction de présence

Élève     : MBARGA Jean-Pierre — 3ème C
Événement : Entrée — 09/06/2026 07h58

Nouveau statut :
  ( ) Présent(e)
  ( ) Absent(e) justifié(e)
  ( ) Absent(e) non justifié(e)
  ( ) En retard
  ( ) Sorti(e) de façon anticipée

Motif (obligatoire) :
  [ Champ texte libre, min 10 caractères ]

Pièce justificative : [Uploader un fichier optionnel]

⚠ Cette correction sera soumise à validation par un superviseur.
Elle restera visible dans le journal d'audit avec votre identifiant.

[Annuler]        [Soumettre la correction]
```

**Appel API :** `POST /api/v1/attendance/{attendance_id}/correction` — corps : `{ new_status, reason, justification_file? }`

La correction crée un enregistrement en statut `PENDING_VALIDATION`. L'agent de validation reçoit une notification (ou voit la correction dans la file d'attente) et l'approuve ou la rejette avec commentaire.

---

## 7. Workflow 6 — Dashboard rôle-adaptatif

### 7.1 État actuel et problèmes

Le tableau de bord central affiche des blocs statiques par catégorie (scolarité, cartes, présences, services, paiements, alertes), avec un filtre par ID établissement. Tous les rôles voient la même structure.

Problèmes :
- Filtre par ID technique (voir problème systémique A).
- Données non contextualisées (un chiffre sans comparaison ne signifie rien).
- Aucun lien direct depuis un indicateur vers l'action corrective.
- Même affichage pour un responsable d'établissement et un administrateur national.

### 7.2 Architecture du dashboard redessiné

**Composant maître :** `DashboardPage.jsx`

Le composant charge le rôle et le périmètre depuis le contexte d'authentification, puis sélectionne et compose les widgets pertinents.

**Filtres en haut de page (non plus par ID mais par sélecteurs) :**

```
[Région ▾]  [Département ▾]  [Établissement ▾]  [Année scolaire ▾]  [Période ▾]
```

Les sélecteurs sont en cascade et filtrés au périmètre. Un clic sur "Réinitialiser" revient au périmètre maximal de l'utilisateur. Les filtres sont persistés dans l'URL (`?region=CE&school=42&year=2026-2027`) pour permettre le partage et le retour arrière.

### 7.3 KPI cards — Premier niveau (toujours visible)

**Composant :** `KPICardGrid.jsx` — Grille de 4 cartes responsives.

Chaque carte affiche : valeur principale (grand chiffre), libellé, variation vs période précédente (flèche verte/rouge + pourcentage), et un lien cliquable vers le module correspondant.

| Carte | Calcul | Lien |
|---|---|---|
| Élèves actifs | `COUNT(enrollments WHERE status=ACTIVE)` dans le périmètre filtré | → Scolarité > Élèves |
| Taux de couverture carte | `COUNT(cards WHERE status=ACTIVE) / COUNT(enrollments WHERE status=ACTIVE) * 100` | → Opérations > Cartes |
| Présences du jour | `COUNT(attendance WHERE date=today AND type=ENTRY)` | → Opérations > Présence |
| Alertes ouvertes | `COUNT(alerts WHERE status=OPEN)` | → Sécurité > Alertes |

**Appel API :** `GET /api/v1/dashboard/kpi?school_id=&year_id=&period=` (route à enrichir côté backend pour retourner les 4 indicateurs + les deltas en un seul appel).

### 7.4 Widgets spécialisés par rôle

**Pour `RESPONSABLE_ETABLISSEMENT` :**

- Widget `ClassAttendanceSummary` : tableau des classes avec taux de présence du jour. Clic sur une classe → vue présence de cette classe.
- Widget `CardStatusBreakdown` : diagramme en anneau (donut) montrant la répartition demandée / émise / active / suspendue pour son établissement.
- Widget `RecentActivity` : 10 derniers événements de l'établissement (nouvelles inscriptions, cartes émises, corrections de présence).

**Pour `DELEGATION_REGIONALE` et `DELEGATION_DEPARTEMENTALE` :**

- Widget `SchoolComparisonTable` : tableau comparatif des établissements du périmètre sur les KPI clés.
- Widget `TrendChart` : graphe linéaire du nombre d'élèves actifs et du taux de couverture carte sur 30 jours.
- Widget `PendingActions` : liste des actions en attente de validation (corrections de présence, demandes de classe, incidents ouverts).

**Pour `ADMINISTRATION_CENTRALE` :**

- Tous les widgets ci-dessus à l'échelle nationale.
- Widget `SecurityOverview` : nombre de tentatives de connexion échouées, alertes de sécurité par criticité, dernières vérifications d'intégrité.
- Widget `PaymentStats` : statistiques des paiements simulés par catégorie et par fournisseur.

### 7.5 Widget PendingActions — détail d'implémentation

**Composant :** `PendingActionsWidget.jsx`

Ce widget est le plus important pour l'efficacité opérationnelle. Il agrège les tâches en attente depuis plusieurs modules :

```
Actions en attente (7)

► 3 corrections de présence à valider           → Présence > Corrections
► 2 doublons détectés à traiter                 → Scolarité > Doublons
► 1 incident ouvert depuis 48h                  → Sécurité > Incidents
► 1 export demandé en attente de téléchargement → Exports
```

Chaque ligne est cliquable et navigue directement vers la file d'attente correspondante filtrée. Le badge de nombre se met à jour toutes les 60 secondes (polling) ou à l'ouverture de page.

**Appel API :** `GET /api/v1/dashboard/pending-actions` (route à créer — agrège les counts depuis plusieurs tables).

---

## 8. Workflow 7 — Gestion des utilisateurs et rôles

### 8.1 État actuel et problèmes

La création et modification d'utilisateurs n'est disponible que via l'API (Swagger). L'interface affiche la liste mais ne propose pas de formulaire de création. L'attribution de périmètre est limitée au type `SCHOOL` via un formulaire rudimentaire (ID utilisateur + ID établissement).

### 8.2 Formulaire de création d'utilisateur

**Page :** `Administration > Utilisateurs > Nouvel utilisateur`

**Champs :**

| Champ | Type | Validation |
|---|---|---|
| Nom d'affichage | `input[text]` | 2–80 caractères |
| Nom d'utilisateur | `input[text]` | 4–40 caractères, regex `[a-z0-9._]`, unicité vérifiée en live (`GET /api/v1/users/check-username?q=`) |
| Mot de passe temporaire | `input[password]` | Min 12 caractères, majuscule, chiffre, caractère spécial. Bouton "Générer" |
| Confirmer le mot de passe | `input[password]` | Identique |
| Rôle(s) | `multi-select` | Liste des rôles disponibles selon le rôle du créateur (un régional ne peut pas créer un admin central) |
| Langue | `select` | FR / EN |
| Actif dès la création | `checkbox` | Par défaut : oui |

**Appel API :** `POST /api/v1/users`

### 8.3 Attribution de périmètre

Après création (ou depuis la fiche d'un utilisateur existant), onglet "Périmètre" :

```
Type de périmètre :
  ( ) National
  ( ) Région        → [Sélecteur région]
  ( ) Département   → [Sélecteur département]
  ( ) Établissement → [Sélecteur établissement]

[Ajouter ce périmètre]

Périmètres attribués :
  Région du Centre  [Supprimer]
  Lycée de Nlongkak [Supprimer]
```

Un utilisateur peut avoir plusieurs périmètres. Le backend applique l'union de ces périmètres à ses requêtes.

**Appels API :** `POST /api/v1/users/{id}/scopes` et `DELETE /api/v1/users/{id}/scopes/{scope_id}`

### 8.4 Setup MFA assisté

**Page :** `Compte > MFA`

**Problème actuel :** l'interface affiche un secret textuel TOTP. L'utilisateur doit copier ce secret dans une application d'authentification, ce qui est source d'erreurs et peu convivial.

**Refonte :**

```
Configuration de l'authentification à deux facteurs

1. Installez une application d'authentification (Google Authenticator, Aegis, etc.)

2. Scannez ce code QR avec l'application :
   [QR code généré depuis le secret TOTP]

   (Secret textuel : [xxxx xxxx xxxx xxxx] — affiché uniquement si l'utilisateur clique sur "Afficher le secret")

3. Saisissez le code à 6 chiffres affiché par l'application :
   [_ _ _  _ _ _]

[Confirmer la configuration]
```

**Implémentation frontend :** utiliser `qrcode.react` ou générer l'image QR côté serveur depuis l'URI `otpauth://totp/EduCard:username?secret=...&issuer=EduCard`. Le secret textuel est masqué par défaut (clic nécessaire pour l'afficher) pour réduire le risque de capture d'écran.

**Appel API :** `GET /api/v1/auth/mfa/setup` (retourne le secret et l'URI OTP) — déjà disponible. Ajouter la génération de l'URI OTP complète côté backend si ce n'est pas encore le cas.

---

## 9. Corrections UX transversales

### 9.1 Remplacement de toutes les saisies d'ID

**Règle :** aucun champ de formulaire visible par un utilisateur métier ne doit contenir ou demander un identifiant technique (UUID, entier auto-incrémenté).

**Recensement des champs à remplacer :**

| Module | Champ actuel | Remplacement |
|---|---|---|
| Scolarité > Élèves | ID établissement | `SchoolSearchSelect` (nom + arrondissement) |
| Scolarité > Inscriptions | ID élève | Résolu depuis la fiche élève courante |
| Scolarité > Inscriptions | ID classe | `ClassSearchSelect` (libellé + niveau + capacité) |
| Scolarité > Inscriptions | ID année scolaire | `AcademicYearSelect` (code + statut) |
| Scolarité > Transferts | ID élève | Résolu depuis la fiche élève courante |
| Opérations > Cartes | ID élève | Résolu depuis la fiche élève courante |
| Opérations > Présence | ID établissement | Auto-résolu depuis le périmètre |
| Opérations > Présence | ID carte | Scan QR ou recherche par nom |
| Opérations > Services | ID service | `ServiceSelect` (nom + catégorie) |
| Opérations > Services | ID élève | Résolu depuis la fiche élève courante |
| Opérations > Services | ID fournisseur | `ProviderSelect` (nom + type) |
| Opérations > Paiements | ID établissement | `SchoolSearchSelect` |
| Opérations > Paiements | ID année scolaire | `AcademicYearSelect` |

### 9.2 Composant `SearchSelect` générique

**Composant :** `SearchSelect.jsx` — réutilisable pour toutes les listes ci-dessus.

**Comportement :**
- Champ texte avec icône de loupe.
- Dès 2 caractères saisis : appel API avec debounce 400 ms.
- Résultats dans un dropdown de max 8 éléments.
- Chaque ligne peut afficher jusqu'à 3 informations (titre principal, sous-titre, badge).
- Sélection via clic ou navigation clavier (flèches + Entrée).
- Valeur sélectionnée affichée sous forme de chip avec bouton de suppression.
- En cas d'erreur API : message "Impossible de charger les résultats. Réessayer." avec bouton.
- Si aucun résultat : "Aucun résultat pour [query]." sans message d'erreur.

### 9.3 Panneau latéral (slide-over panel)

**Composant :** `SlideOverPanel.jsx`

Pour tous les tableaux principaux (élèves, cartes, présences, utilisateurs), remplacer la navigation vers une nouvelle page par un panneau latéral qui s'ouvre sur la droite, animé en 200 ms (`transform: translateX`).

Le tableau reste visible à gauche (réduit sur mobile, présent sur desktop). L'utilisateur peut fermer le panneau ou cliquer sur une autre ligne sans perdre le contexte de liste.

**Ne pas utiliser `position: fixed`** — utiliser une mise en page flex avec le panneau en flow normal, évitant les problèmes d'iframe et de scroll imbriqué.

### 9.4 Filtres avancés avec chips

**Composant :** `FilterBar.jsx`

Tous les tableaux lourds (élèves, cartes, présences, audit) doivent afficher les filtres actifs sous forme de chips visibles et supprimables :

```
Filtres actifs : [Statut : Active ×] [Établissement : Lycée Nlongkak ×] [Période : Juin 2026 ×]   Tout effacer
```

Les filtres sont persistés dans l'URL. Le bouton "Tout effacer" réinitialise l'URL et le state simultanément.

### 9.5 Toasts de confirmation et erreurs

**Composant :** `ToastNotification.jsx` — intégrer une bibliothèque légère (`react-hot-toast` ou équivalent) avec les types suivants :

| Type | Couleur | Durée | Contenu |
|---|---|---|---|
| Succès | Vert | 3 secondes | `"Élève créé. Matricule : SC-2026-00142"` avec lien |
| Avertissement | Orange | 5 secondes | `"Photo non enregistrée. Ajoutez-la depuis la fiche."` |
| Erreur | Rouge | Persistant jusqu'à fermeture | `"Erreur serveur (500). Réessayer ou contacter le support."` |
| Information | Bleu | 4 secondes | `"Session expirée dans 5 minutes."` |

### 9.6 États de chargement

Toute opération asynchrone (appel API) doit afficher un état de chargement. Règles :

- **Boutons :** pendant l'appel, remplacer le texte du bouton par un spinner inline et désactiver le clic. Ex. : `[⟳ Enregistrement...]` puis revenir à l'état normal.
- **Tableaux :** skeleton screens (rectangles gris animés) pour les premières charges. Spinner discret pour les rechargements.
- **Sélecteurs :** spinner à droite du champ pendant la recherche.
- **Jamais bloquer l'UI entière** avec un overlay de chargement global sauf pour les opérations de soumission de formulaire complet.

### 9.7 Timeline du parcours scolaire

**Composant :** `StudentTimelineTab.jsx` — onglet "Parcours" dans la fiche élève.

Affiche chronologiquement tous les événements du parcours de l'élève :

```
2026-09   ── Inscrit en 3ème C — Lycée de Nlongkak (2026-2027)
2025-09   ── Promu en 2nde C depuis 3ème B
2025-09   ── Transfert reçu depuis Lycée de Bafoussam
2024-09   ── Inscrit en 3ème B — Lycée de Bafoussam (2024-2025)
2023-09   ── Inscrit en 4ème A — Lycée de Bafoussam (2023-2024)
```

Chaque événement est cliquable et affiche le détail dans un panneau latéral (agent responsable, motif si disponible, pièces jointes).

**Appel API :** `GET /api/v1/students/{id}/history` — déjà disponible dans la fiche.

---

## 10. Priorisation et plan d'implémentation

### Sprint 1 — Fondations UX (2 semaines)

Objectif : éliminer les saisies d'ID et rendre les formulaires utilisables.

- [ ] Composant `SearchSelect` générique (9.2)
- [ ] Remplacement de tous les champs ID dans les formulaires existants (9.1)
- [ ] Composant `SlideOverPanel` pour Élèves et Cartes (9.3)
- [ ] Toasts de confirmation sur toutes les actions (9.5)
- [ ] États de chargement sur tous les boutons d'action (9.6)

### Sprint 2 — Workflows inscription et carte (3 semaines)

Objectif : rendre les deux opérations centrales fluides de bout en bout.

- [ ] Stepper `StudentCreationStep1` à `Step4` (Workflow 1, sections 2.3 à 2.6)
- [ ] Upload et recadrage de photo élève (2.3)
- [ ] Composant `DigitalCardView` avec recto/verso (Workflow 3, section 4.2)
- [ ] Modale de transition de carte avec motif et double confirmation (3.4)
- [ ] Frise d'état `CardLifecycleTimeline` (3.3)
- [ ] Bouton "Demander une carte" depuis la fiche élève (3.5)

### Sprint 3 — Présence et QR (2 semaines)

Objectif : rendre les opérations de terrain réalisables sans saisie d'ID.

- [ ] Scanner QR `QRScannerModule` avec ZXing (Workflow 4, section 5.3)
- [ ] Affichage résultat de vérification (5.4)
- [ ] Interface de pointage de présence avec scan QR (Workflow 5, section 6.2)
- [ ] Formulaire de correction de présence avec validation séparée (6.3)

### Sprint 4 — Dashboards et utilisateurs (2 semaines)

Objectif : rendre les tableaux de bord actionnables et compléter la gestion des comptes.

- [ ] `KPICardGrid` avec deltas (7.3)
- [ ] Filtres en cascade persistés dans l'URL (7.2)
- [ ] Widget `PendingActionsWidget` (7.5)
- [ ] Formulaire création utilisateur + attribution périmètre (Workflow 7, sections 8.2 et 8.3)
- [ ] Setup MFA avec QR TOTP (8.4)
- [ ] `FilterBar` avec chips sur tous les tableaux (9.4)
- [ ] `StudentTimelineTab` (9.7)

### Sprint 5 — Finitions et fonctions manquantes (2 semaines)

- [ ] Génération PDF de la carte (`GET /api/v1/cards/{id}/pdf` côté backend)
- [ ] Widget `TrendChart` avec comparaison de périodes
- [ ] Formulaire de détail des alertes avec confirmation avant accusé de réception
- [ ] Formulaire d'incident complet (catégorie, priorité, affectation, chronologie)
- [ ] Saisie de motif obligatoire pour les exports
- [ ] Widgets spécialisés par rôle (7.4)

---

## 11. Journal des modifications

| Date | Auteur | Modification |
|---|---|---|
| 2026-06-09 | Analyse EduCard | Première version complète de la spécification de refonte |

---

*Ce document est un complément au `GUIDE_UTILISATION_APPLICATION_A_Z.md`. Il ne remplace pas les décisions d'arbitrage listées en section 30 de ce guide, qui restent à valider institutionnellement avant implémentation (gouvernance des créations, acteurs du cycle carte, règles d'éligibilité aux services, base légale des traitements de données).*

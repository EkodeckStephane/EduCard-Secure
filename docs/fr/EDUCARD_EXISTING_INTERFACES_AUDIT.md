# Audit ciblé des interfaces existantes

## Objet

Ce document décrit l'état réel des trois interfaces insuffisamment détaillées
dans les volumes 1 et 2 :

1. fiche élève ;
2. tableaux de bord spécialisés ;
3. module Sauvegardes.

Il s'agit d'un relevé du code existant, destiné à préparer des consignes de
refonte précises. Ce document ne décrit pas encore une nouvelle implémentation.

## 1. Fiche élève existante

### 1.1 Structure actuelle

La fiche n'est pas une page autonome et ne possède pas encore de véritables
onglets.

Le parcours actuel est le suivant :

1. l'utilisateur ouvre `Scolarité > Élèves` ;
2. la page affiche la recherche, une liste paginée et le nombre de résultats ;
3. un clic sur une ligne ouvre un panneau latéral ;
4. le contenu du panneau est empilé verticalement.

Le panneau latéral contient actuellement, dans cet ordre :

- le formulaire **Fiche élève** ;
- l'action **Demander une carte**, si elle est autorisée ;
- l'action **Archiver**, si elle est autorisée ;
- la section **Historique** ;
- la section **Doublons potentiels**.

Il n'existe donc pas d'onglets élève nommés `Identité`, `Scolarité`, `Carte`,
`Services`, `Historique` ou `Doublons`. Le composant générique `DetailTabs`
existe, avec les onglets `Détails`, `Historique` et `Services liés`, mais il est
utilisé pour la fiche carte et non pour la fiche élève.

### 1.2 Données modifiables

Le formulaire actuel permet de modifier :

- le nom ;
- le prénom ;
- le statut.

Le backend accepte également `classroom_id`, mais ce champ n'est pas présenté
dans le formulaire actuel.

Les champs sont des entrées textuelles simples :

- aucun libellé visible n'est associé au nom et au prénom ;
- le statut est une saisie libre et non une liste de valeurs autorisées ;
- l'établissement, la classe, l'année scolaire et le représentant légal ne
  sont pas affichés dans ce formulaire ;
- les données de carte, services, inscriptions et transferts ne sont pas
  regroupées dans la fiche.

### 1.3 Concurrence et version optimiste

La protection de concurrence existe côté backend :

- chaque élève possède `record_version` ;
- la modification transmet la version chargée ;
- le backend compare cette version avec celle stockée ;
- une différence produit une réponse HTTP `409 Record version conflict` ;
- chaque modification réussie incrémente la version.

L'interface ne traite toutefois pas le conflit de manière spécifique. Toute
erreur est ramenée au message générique `Modification élève refusée`.

Il manque donc :

- un message expliquant que la fiche a été modifiée par un autre utilisateur ;
- une action **Recharger la dernière version** ;
- une comparaison éventuelle entre les valeurs locales et les valeurs
  actualisées ;
- la conservation contrôlée du brouillon de l'utilisateur.

### 1.4 Archivage

L'interface demande actuellement un motif avec `window.prompt`.

Le motif doit contenir au moins cinq caractères pour que l'interface appelle
l'API. Cependant :

- le motif n'est pas transmis à l'API ;
- la route d'archivage n'accepte aucun corps de requête ;
- l'historique enregistre toujours le motif technique fixe `ARCHIVED` ;
- le journal de sécurité enregistre l'opération, mais pas la justification
  saisie par l'utilisateur ;
- il n'existe pas de dialogue structuré ni de récapitulatif des conséquences.

L'archivage incrémente correctement `record_version`, mais la route ne demande
pas la version courante. Un archivage concurrent peut donc contourner la
protection optimiste appliquée à la modification.

### 1.5 Historique et doublons

`Historique` et `Doublons potentiels` sont deux sections distinctes, mais pas
deux onglets :

- l'historique est une timeline de changements de statut ;
- les doublons sont affichés dans un tableau générique ;
- les deux sections sont chargées dès la sélection de l'élève ;
- aucune fusion automatique n'est proposée.

La décision humaine sur les doublons existe surtout dans l'assistant de création
d'élève. La fiche existante ne fournit pas encore un workflow complet de revue,
acceptation ou rejet de chaque candidat.

### 1.6 Cible à préciser dans un troisième volume

Le troisième document devrait imposer une fiche élève avec les onglets suivants :

- **Synthèse** : identité, matricule, statut, établissement et classe actuels ;
- **Identité** : données modifiables et photo ;
- **Parcours scolaire** : inscriptions, changements de classe et transferts ;
- **Carte** : carte actuelle, statut, actions et historique ;
- **Services** : droits, validité et consommations ;
- **Historique** : événements administratifs consolidés ;
- **Doublons** : candidats, score, comparaison et décision humaine ;
- **Audit** : uniquement pour les rôles autorisés.

Les consignes devraient également exiger :

- des statuts sélectionnables et validés, jamais saisis librement ;
- un dialogue d'archivage avec motif structuré et confirmation ;
- la transmission du motif et de `record_version` au backend ;
- un traitement explicite du conflit HTTP 409 ;
- le rechargement des données liées après chaque mutation ;
- la conservation des contrôles RBAC et de périmètre côté backend.

## 2. Tableaux de bord spécialisés existants

### 2.1 Organisation actuelle

Les cinq tableaux de bord sont cinq routes distinctes :

- `/dashboard/cartes` ;
- `/dashboard/presence` ;
- `/dashboard/paiements` ;
- `/dashboard/securite` ;
- `/dashboard/services`.

Ils ne sont pas des sections d'une page unique. Ils sont accessibles depuis le
groupe déroulant `Tableaux de bord`.

Le dashboard central est une sixième page, à l'adresse `/dashboard`.

### 2.2 Composant partagé

Les cinq pages spécialisées utilisent toutes le même composant
`DistributionPanel`.

Chaque page affiche seulement :

- un titre ;
- un graphique en barres ;
- le même jeu de données sous forme de tableau.

Il n'existe actuellement ni KPI spécialisé, ni comparaison de période, ni
plusieurs vues graphiques, ni panneau de détail propre à chaque domaine.

### 2.3 Bibliothèque graphique

La bibliothèque utilisée est :

- `chart.js` ;
- adaptateur React `react-chartjs-2`.

Le seul type de graphique utilisé dans les dashboards spécialisés est `Bar`.
Recharts n'est pas utilisé.

Le graphique actuel :

- utilise une série unique nommée `Total` ;
- prend `label` pour l'axe horizontal ;
- prend `value` pour la valeur ;
- masque la légende ;
- commence l'axe vertical à zéro ;
- est responsive.

### 2.4 Données affichées

Les distributions actuelles sont :

- **Cartes** : nombre par statut de carte ;
- **Présence** : nombre par type d'événement de présence ;
- **Paiements** : nombre par fournisseur simulé dans la réponse dédiée ;
- **Sécurité** : nombre d'événements par criticité ;
- **Services** : nombre de vérifications par résultat.

Le masquage des petits effectifs est appliqué par le backend.

### 2.5 Filtres actuels

Les pages spécialisées ne possèdent aucun contrôle de filtre dans leur
interface.

Le composant appelle son endpoint sans paramètre.

Le backend accepte actuellement :

- `school_id` pour cartes et présence ;
- `school_id` et `school_year_id` pour paiements ;
- aucun filtre exposé par les routes sécurité et services.

Les filtres du dashboard central ne sont pas transmis aux pages spécialisées
lorsque l'utilisateur clique sur un KPI ou utilise le menu. Les pages ne
reprennent donc ni la région, ni le département, ni l'établissement, ni l'année
scolaire sélectionnés sur le dashboard central.

### 2.6 Tableau associé

Le tableau générique fournit déjà :

- tri ascendant ou descendant pour chaque colonne ;
- filtre textuel pour chaque colonne ;
- pagination locale ;
- choix de 5, 10, 20 ou 50 lignes.

Ces fonctions portent uniquement sur la distribution déjà chargée, qui contient
peu de lignes. Il ne s'agit pas d'une pagination ou d'un filtrage statistique
côté serveur.

### 2.7 Relation avec le dashboard central

Le dashboard central affiche :

- des KPI adaptés au rôle ;
- des deltas par rapport à la période précédente ;
- des actions en attente ;
- des blocs catégorisés ;
- une tendance de présence ;
- les cinq distributions spécialisées.

Les KPI sont cliquables et ouvrent principalement les modules métier
correspondants, pas nécessairement le dashboard spécialisé.

Il manque un contrat explicite de navigation :

- conservation des filtres dans l'URL ;
- ouverture du dashboard spécialisé approprié ;
- conservation de la période ;
- retour au dashboard central sans perte de contexte ;
- possibilité de passer d'un agrégat à une liste autorisée et filtrée.

### 2.8 Cible à préciser dans un troisième volume

Chaque dashboard spécialisé devrait posséder :

- un en-tête et des KPI propres au domaine ;
- les filtres période, région, département, établissement et année scolaire
  applicables ;
- des filtres complémentaires propres au domaine ;
- une URL contenant les filtres actifs ;
- plusieurs visualisations pertinentes, sans données personnelles inutiles ;
- un tableau agrégé paginé côté serveur lorsque le volume l'exige ;
- un lien retour vers le dashboard central conservant le contexte ;
- des liens de drill-down soumis au RBAC et au périmètre.

Filtres spécialisés recommandés :

- **Cartes** : statut, type d'événement, délai d'émission ;
- **Présence** : classe, type d'événement, plage horaire ;
- **Paiements** : fournisseur mock, catégorie, statut de rapprochement ;
- **Sécurité** : criticité, type d'événement, statut d'alerte ;
- **Services** : type de service, fournisseur fictif, résultat d'éligibilité.

Le troisième volume devra préciser les KPI, graphiques, tableaux, endpoints et
règles de navigation de chacun des cinq écrans.

## 3. Module Sauvegardes existant

### 3.1 Interface actuelle

La page `Gouvernance > Sauvegardes` est strictement en lecture seule.

Elle affiche :

- le titre `Sauvegardes` ;
- un tableau générique contenant les événements renvoyés par l'API.

Il n'existe aucun bouton :

- de création de sauvegarde ;
- de vérification ;
- de téléchargement ;
- de restauration ;
- de suppression.

### 3.2 Données disponibles

L'API `GET /api/v1/backups` exige la permission `backup:read` et retourne au
maximum les 100 événements les plus récents avec :

- `id` ;
- `event_type` ;
- `status` ;
- `file_reference` ;
- `started_at` ;
- `finished_at`.

Le modèle `backup_events` possède également `created_by`, mais cette information
n'est pas retournée par l'API.

Le tableau générique fournit automatiquement tri, filtres par colonne et
pagination locale.

### 3.3 Limite fonctionnelle importante

Les scripts PowerShell de sauvegarde, vérification et restauration ne créent pas
actuellement d'enregistrement dans `backup_events`.

La page peut donc rester vide ou présenter des événements créés par des données
de démonstration, sans refléter automatiquement les fichiers réellement
présents dans le répertoire local `backups`.

Le script `list_backups.ps1` sait afficher :

- le nom du fichier ;
- sa taille ;
- sa date de modification ;
- la présence du fichier `.sha256`.

Ces informations ne sont pas exposées par l'API actuelle.

### 3.4 Sécurité des opérations

Les opérations réelles restent volontairement séparées de l'interface :

- `backup_database.ps1` crée un dump et son empreinte SHA-256 ;
- `verify_backup.ps1` compare l'empreinte attendue et l'empreinte calculée ;
- `restore_database.ps1` vérifie l'empreinte lorsque disponible et exige la
  saisie exacte de `RESTORE-EDUCARD` ;
- aucun mot de passe n'est stocké dans les scripts ;
- la restauration n'est jamais déclenchée par le frontend.

Cette séparation doit être conservée. La restauration automatique reste hors
périmètre.

### 3.5 Cible à préciser dans un troisième volume

L'interface peut être améliorée sans devenir un outil d'exécution :

- cartes de synthèse : dernière sauvegarde réussie, dernier contrôle
  d'intégrité, dernier échec et ancienneté ;
- badges explicites : `RÉUSSIE`, `ÉCHOUÉE`, `EMPREINTE VÉRIFIÉE`,
  `EMPREINTE ABSENTE`, `RESTAURATION JOURNALISÉE` ;
- durée calculée entre début et fin ;
- nom de fichier masqué ou référence opaque ;
- affichage de l'opérateur lorsque la permission le permet ;
- panneau de détail d'un événement ;
- filtres par type, statut et période ;
- message indiquant que les opérations se font exclusivement avec les scripts
  PowerShell administratifs ;
- affichage en lecture seule de l'état des fichiers locaux via une commande ou
  un manifeste produit par les scripts, sans exposer de secret.

L'interface ne doit pas fournir :

- de bouton **Restaurer** ;
- de champ de mot de passe MySQL ;
- d'accès direct au contenu des dumps ;
- de suppression de sauvegarde ;
- de lancement automatique d'une opération sensible.

Pour rendre l'historique fiable, les scripts devraient journaliser leur résultat
dans un mécanisme local contrôlé. L'option la plus prudente est un script
complémentaire ou un manifeste signé/importable, plutôt qu'un appel HTTP
authentifié contenant des secrets.

## 4. Réponses directes aux questions

### Fiche élève

- Les onglets actuels n'ont pas de noms, car il n'existe pas encore d'onglets.
- `Historique` et `Doublons potentiels` sont deux sections distinctes empilées
  dans le même panneau latéral.
- `Carte`, `Services` et `Parcours scolaire` ne sont pas intégrés à cette fiche.

### Tableaux de bord spécialisés

- Ils sont dans cinq pages séparées.
- Chaque page possède le même graphique et le même tableau génériques.
- Ils utilisent Chart.js via `react-chartjs-2`.
- Ils ne possèdent pas actuellement leurs propres filtres.

### Module Sauvegardes

- Il affiche uniquement une liste d'événements.
- Il ne contient aucun bouton d'action.
- Les opérations restent dans les scripts PowerShell.
- Les scripts et l'historique affiché par l'API ne sont pas encore
  automatiquement synchronisés.

## 5. Conclusion

Un troisième volume peut être rédigé sans reconstruction complète. Il devra
porter sur trois corrections ciblées :

1. transformer le panneau élève empilé en fiche à onglets cohérente ;
2. spécialiser les cinq dashboards et conserver le contexte du dashboard
   central ;
3. enrichir la lecture des sauvegardes tout en maintenant l'interdiction de
   déclencher une restauration depuis l'application.

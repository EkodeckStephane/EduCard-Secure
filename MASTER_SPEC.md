Tu es un architecte logiciel senior, développeur full-stack, expert MySQL, ingénieur DevSecOps, spécialiste de la cybersécurité applicative et analyste des systèmes d’information publics.

Ta mission est de concevoir, générer, exécuter, tester et documenter une application GUI complète appelée provisoirement :

    EduCard Secure — Prototype local de gestion d’une carte scolaire digitale unique

IMPORTANT :
- Il s’agit d’un prototype académique et technique indépendant.
- Ne jamais affirmer qu’il s’agit de la plateforme officielle du MINESEC, de MTN Cameroon ou de MTN Mobile Money Corporation.
- Ne jamais utiliser de logo, marque graphique, jeton d’API, URL privée ou donnée réelle appartenant à une institution.
- Toutes les données de démonstration doivent être entièrement synthétiques.
- Aucun appel réel vers MTN Mobile Money, Orange Money, Campost, Express Union ou un autre prestataire ne doit être effectué.
- Les intégrations externes doivent être simulées par des interfaces abstraites et des adaptateurs mock.
- Ne jamais inventer une règle métier ou une exigence juridique : distinguer clairement les éléments issus du brief, les hypothèses raisonnables et les options configurables.
- Lorsque plusieurs solutions sont possibles, choisir l’option la plus sûre, la plus maintenable et la plus simple à exécuter localement, puis documenter ce choix.

======================================================================
1. OBJECTIF GÉNÉRAL
======================================================================

Créer une application métier locale, sécurisée et extensible permettant de démontrer la gestion du cycle de vie d’une carte scolaire digitale unique accompagnant un élève pendant son parcours dans l’enseignement secondaire.

L’application doit couvrir :
1. les processus fonctionnels ;
2. l’administration des données ;
3. les tableaux de bord statistiques ;
4. la sécurité applicative et opérationnelle ;
5. la traçabilité complète des opérations ;
6. la protection des données personnelles ;
7. l’analyse des risques ;
8. la documentation d’installation et d’exploitation ;
9. les tests automatisés ;
10. la préparation d’une future industrialisation.

Le prototype doit être exploitable sur une machine Windows où MySQL Server 5.7 est déjà installé.

======================================================================
2. ARCHITECTURE TECHNIQUE IMPOSÉE
======================================================================

Construire une application web locale avec une interface GUI moderne accessible depuis un navigateur.

Utiliser une architecture en couches :

- Frontend :
  - React ;
  - TypeScript ;
  - Vite ;
  - composants accessibles ;
  - interface responsive ;
  - graphiques interactifs ;
  - formulaires avec validation côté client ;
  - navigation conditionnée par les permissions.

- Backend :
  - Python ;
  - FastAPI ;
  - SQLAlchemy ;
  - Alembic pour les migrations ;
  - Pydantic pour la validation ;
  - API REST versionnée sous /api/v1 ;
  - documentation OpenAPI générée automatiquement ;
  - séparation claire entre routes, services, modèles, dépôts, schémas, sécurité et configuration.

- Base de données :
  - MySQL Server 5.7 installé localement ;
  - moteur InnoDB ;
  - encodage utf8mb4 ;
  - clés étrangères ;
  - index utiles ;
  - transactions explicites ;
  - contraintes applicatives lorsque MySQL 5.7 ne garantit pas correctement certaines contraintes ;
  - scripts SQL d’initialisation ;
  - migrations Alembic rejouables ;
  - script de sauvegarde et script de restauration ;
  - documentation d’une migration future vers MySQL 8.4 LTS.

- Exécution locale :
  - fournir des commandes compatibles PowerShell ;
  - ne pas imposer Docker ;
  - Docker Compose peut être fourni comme option complémentaire uniquement ;
  - prévoir un fichier .env.example ;
  - ne jamais inclure de secret réel dans le dépôt.

- Tests :
  - pytest pour le backend ;
  - tests de composants ou tests end-to-end pour les scénarios critiques ;
  - tests de sécurité ciblés ;
  - script unique permettant d’exécuter l’ensemble des tests.

Éviter toute fonctionnalité SQL propre à MySQL 8 qui empêcherait l’exécution sur MySQL 5.7 :
- pas de CTE obligatoire ;
- pas de fenêtre analytique obligatoire ;
- pas de dépendance à des CHECK constraints supposées fiables ;
- pas de fonctionnalité JSON indispensable ;
- pas de syntaxe incompatible avec MySQL 5.7.

======================================================================
3. RÈGLES DE CONCEPTION
======================================================================

Appliquer les principes suivants :
- modularité ;
- faible couplage ;
- séparation des responsabilités ;
- minimisation des données ;
- moindre privilège ;
- défense en profondeur ;
- sécurité par défaut ;
- privacy by design ;
- privacy by default ;
- journalisation utile sans fuite de données ;
- contrôles côté serveur systématiques ;
- gestion rigoureuse des erreurs ;
- messages d’erreur adaptés aux utilisateurs sans divulgation technique ;
- code lisible et maintenable ;
- commentaires uniquement lorsqu’ils apportent une valeur réelle.

Ne jamais stocker :
- un mot de passe en clair ;
- une clé cryptographique dans le code source ;
- un jeton d’accès dans les journaux ;
- une donnée sensible complète dans un QR code ;
- un secret dans le frontend ;
- un fichier confidentiel directement dans un dépôt Git.

======================================================================
4. PROFILS UTILISATEURS ET CONTRÔLE D’ACCÈS
======================================================================

Implémenter un RBAC robuste, complété par une restriction de périmètre géographique ou organisationnel.

Prévoir au minimum les rôles suivants :

1. SUPER_ADMIN_TECHNIQUE
   - configuration générale ;
   - gestion des comptes privilégiés ;
   - supervision technique ;
   - aucun accès automatique aux données personnelles détaillées sans justification.

2. ADMINISTRATION_CENTRALE
   - vue nationale ;
   - statistiques consolidées ;
   - configuration des référentiels ;
   - validation de certaines opérations sensibles.

3. DELEGATION_REGIONALE
   - accès limité à une région.

4. DELEGATION_DEPARTEMENTALE
   - accès limité à un département.

5. RESPONSABLE_ETABLISSEMENT
   - gestion d’un établissement précis.

6. AGENT_IMMATRICULATION
   - enregistrement et correction contrôlée des informations d’élèves.

7. AGENT_CARTE
   - génération, activation, suspension, renouvellement et révocation des cartes.

8. AGENT_PRESENCE
   - enregistrement des présences et consultation limitée.

9. AGENT_SERVICE
   - vérification d’un droit d’accès à un service configuré : sport, restauration, assurance ou autre prestation.

10. AGENT_FINANCE
    - consultation des paiements simulés et rapprochements ;
    - accès limité aux informations strictement nécessaires.

11. AUDITEUR_SECURITE
    - lecture des journaux, alertes et rapports ;
    - pas de modification des données métier.

12. ANALYSTE_STATISTIQUE
    - accès aux agrégats anonymisés ou pseudonymisés ;
    - aucune consultation libre des fiches individuelles.

13. SUPPORT
    - accès contrôlé ;
    - visibilité réduite ;
    - opérations de support journalisées.

Pour chaque rôle :
- définir précisément les permissions ;
- documenter les opérations autorisées ;
- appliquer les contrôles côté backend ;
- masquer les menus non autorisés côté frontend ;
- interdire tout contournement par appel direct à l’API ;
- prévoir une matrice rôles-permissions dans la documentation.

======================================================================
5. MODULES FONCTIONNELS
======================================================================

Créer les modules suivants.

----------------------------------------------------------------------
5.1 Référentiels administratifs
----------------------------------------------------------------------

Gérer :
- régions ;
- départements ;
- arrondissements ;
- établissements ;
- types d’établissements ;
- sous-systèmes éducatifs ;
- niveaux ;
- classes ;
- années scolaires ;
- statuts ;
- types de services ;
- motifs de suspension ;
- motifs de révocation ;
- catégories d’incidents.

Prévoir :
- recherche ;
- filtres ;
- pagination ;
- export CSV contrôlé ;
- historique des modifications ;
- validation des doublons.

----------------------------------------------------------------------
5.2 Gestion des élèves
----------------------------------------------------------------------

Permettre :
- création d’un élève fictif ;
- génération d’un matricule unique interne ;
- recherche multicritère ;
- fiche synthétique ;
- historique des inscriptions ;
- transfert entre établissements ;
- changement de classe ;
- archivage contrôlé ;
- rectification ;
- détection de doublons potentiels ;
- export individuel encadré ;
- journalisation des consultations sensibles.

Données minimales recommandées pour le prototype :
- identifiant interne UUID ;
- matricule unique ;
- nom fictif ;
- prénom fictif ;
- date de naissance fictive ;
- sexe ou genre uniquement si un besoin métier explicite est documenté ;
- établissement actuel ;
- classe ;
- année scolaire ;
- statut ;
- contact du représentant légal fictif, optionnel ;
- photographie synthétique, optionnelle ;
- métadonnées de création et de modification ;
- version de la fiche.

Ne collecter aucune donnée non nécessaire.

----------------------------------------------------------------------
5.3 Parcours scolaire
----------------------------------------------------------------------

Gérer :
- inscription annuelle ;
- transfert ;
- sortie ;
- réintégration ;
- changement d’établissement ;
- changement de niveau ;
- historique complet ;
- pièces justificatives simulées ;
- workflow de validation ;
- commentaires administratifs contrôlés ;
- versionnage des décisions.

----------------------------------------------------------------------
5.4 Cycle de vie de la carte scolaire digitale
----------------------------------------------------------------------

Gérer :
- demande de carte ;
- émission ;
- activation ;
- impression simulée ;
- réimpression ;
- suspension ;
- réactivation ;
- expiration administrative configurable ;
- révocation ;
- remplacement ;
- perte déclarée ;
- carte endommagée ;
- historique complet ;
- statut visible ;
- numéro de série unique ;
- version de carte ;
- journal des opérations.

Prévoir un QR code sécurisé facultatif pour le prototype.

Le QR code ne doit jamais contenir directement :
- nom complet ;
- date de naissance ;
- téléphone ;
- adresse ;
- photographie ;
- données financières ;
- données scolaires détaillées.

Le QR code doit contenir uniquement :
- une version de format ;
- un identifiant opaque ;
- un identifiant de carte ;
- une date ou période de validité limitée ;
- un nonce ;
- une signature numérique ;
- un identifiant de version de clé publique.

Utiliser une signature numérique moderne, avec séparation stricte entre :
- clé privée de signature ;
- clé publique de vérification ;
- version de clé ;
- rotation de clé ;
- révocation de clé ;
- historique des émissions.

Créer un écran de vérification simulée du QR code :
- statut valide ;
- carte suspendue ;
- carte révoquée ;
- signature invalide ;
- carte inconnue ;
- identifiant expiré ;
- anomalie ;
- événement journalisé.

----------------------------------------------------------------------
5.5 Présence et contrôle d’accès
----------------------------------------------------------------------

Créer un module configurable permettant de démontrer :
- contrôle d’entrée dans un établissement ;
- pointage manuel ;
- pointage par identifiant de carte ;
- vérification de présence ;
- historique ;
- justification d’absence ;
- retard ;
- sortie ;
- correction validée ;
- statistiques quotidiennes ;
- alertes d’anomalies.

Ne pas implémenter de biométrie par défaut.

Créer uniquement une interface optionnelle désactivée appelée
    BiometricProvider
afin de montrer où une étude d’impact, une autorisation appropriée et des exigences supplémentaires seraient nécessaires avant toute activation.

----------------------------------------------------------------------
5.6 Services associés
----------------------------------------------------------------------

Créer un moteur générique de services configurables.

Exemples de services démontrés avec des données fictives :
- accès à une activité sportive ;
- restauration ;
- assurance scolaire ;
- prestation sociale ;
- contrôle d’éligibilité ;
- événement scolaire.

Pour chaque service :
- type ;
- fournisseur fictif ;
- période de validité ;
- critères d’éligibilité ;
- historique des validations ;
- statut ;
- vérification ;
- preuve minimale ;
- audit ;
- statistiques.

Ne jamais coder une règle institutionnelle réelle non fournie.

----------------------------------------------------------------------
5.7 Paiements simulés
----------------------------------------------------------------------

Créer un module de paiement et de rapprochement entièrement simulé.

Architecture attendue :
- interface PaymentProvider ;
- MockMomoProvider ;
- MockOrangeMoneyProvider ;
- MockBankProvider ;
- MockCashDeskProvider ;
- statut d’une transaction ;
- référence opaque ;
- montant ;
- catégorie ;
- date ;
- établissement ;
- élève ;
- année scolaire ;
- motif ;
- journal de rapprochement ;
- gestion des erreurs ;
- idempotence ;
- prévention des doublons ;
- export contrôlé ;
- statistiques.

Ne jamais :
- appeler une API réelle ;
- stocker un code PIN ;
- simuler une interface trompeuse reprenant exactement celle d’un opérateur ;
- afficher un secret ;
- mettre une clé privée dans le frontend.

----------------------------------------------------------------------
5.8 Incidents, anomalies et support
----------------------------------------------------------------------

Créer :
- registre des incidents ;
- catégories ;
- priorité ;
- criticité ;
- statut ;
- affectation ;
- historique ;
- commentaires ;
- pièces jointes fictives ;
- résolution ;
- rapport d’incident ;
- indicateurs ;
- journal de preuve ;
- délai de traitement ;
- alertes.

Cas d’usage :
- tentative répétée de connexion ;
- consultation inhabituelle ;
- modification sensible ;
- export volumineux ;
- carte révoquée utilisée ;
- signature QR invalide ;
- doublon potentiel ;
- paiement dupliqué ;
- incohérence de rapprochement ;
- anomalie de présence ;
- privilège excessif ;
- tentative d’accès hors périmètre.

======================================================================
6. BASE DE DONNÉES
======================================================================

Concevoir un modèle relationnel cohérent et normalisé.

Inclure au minimum les tables ou équivalents suivants :

- users
- roles
- permissions
- user_roles
- role_permissions
- user_scopes
- sessions
- refresh_tokens ou session_tokens
- mfa_methods
- password_history
- login_attempts
- security_events
- audit_events
- audit_event_hashes
- regions
- departments
- subdivisions
- schools
- school_years
- grade_levels
- classrooms
- students
- student_guardians
- enrollments
- transfers
- student_status_history
- cards
- card_status_history
- card_issuance_events
- signing_key_versions
- qr_verification_events
- attendance_events
- attendance_corrections
- service_types
- service_providers
- service_entitlements
- service_verification_events
- payment_providers
- payment_transactions
- payment_reconciliations
- incidents
- incident_events
- data_access_requests
- retention_rules
- data_processing_register
- exports
- export_events
- configuration_settings
- notification_events
- backup_events

Pour chaque table :
- définir la clé primaire ;
- utiliser UUID ou identifiant opaque lorsque pertinent ;
- définir les clés étrangères ;
- ajouter les index nécessaires ;
- utiliser created_at, updated_at et created_by lorsque pertinent ;
- prévoir le versionnage optimiste lorsque nécessaire ;
- documenter la finalité ;
- éviter la redondance ;
- limiter les données sensibles ;
- prévoir la suppression logique uniquement lorsqu’elle est justifiée ;
- documenter la politique de purge.

Produire :
1. un diagramme entité-association en Mermaid ;
2. le schéma SQL compatible MySQL 5.7 ;
3. les migrations Alembic ;
4. un dictionnaire de données ;
5. un script de données synthétiques ;
6. des scripts de sauvegarde et de restauration ;
7. une note de migration MySQL 5.7 vers MySQL 8.4 LTS.

======================================================================
7. TABLEAUX DE BORD ET STATISTIQUES
======================================================================

Créer une interface GUI riche, lisible et exploitable.

Prévoir un tableau de bord général avec :
- nombre d’élèves actifs ;
- nombre de cartes émises ;
- cartes actives ;
- cartes suspendues ;
- cartes révoquées ;
- cartes remplacées ;
- taux d’émission ;
- délai moyen d’émission ;
- nombre d’établissements ;
- inscriptions par année scolaire ;
- transferts ;
- présences ;
- retards ;
- absences ;
- transactions simulées ;
- taux de rapprochement ;
- anomalies ;
- incidents ouverts ;
- incidents résolus ;
- tentatives de connexion échouées ;
- exports ;
- consultations sensibles ;
- cartes invalides détectées ;
- signatures QR invalides ;
- alertes de sécurité.

Permettre les filtres :
- période ;
- région ;
- département ;
- établissement ;
- année scolaire ;
- classe ;
- statut ;
- service ;
- niveau ;
- criticité.

Créer des graphiques adaptés :
- séries temporelles ;
- barres ;
- camemberts uniquement lorsqu’ils sont réellement pertinents ;
- histogrammes ;
- tableaux paginés ;
- cartes thermiques simples ;
- indicateurs synthétiques ;
- exports CSV ;
- rapport PDF optionnel.

Appliquer :
- anonymisation ou agrégation pour les vues statistiques ;
- suppression des petits effectifs lorsque leur affichage pourrait faciliter une ré-identification ;
- limitation des exports ;
- journalisation des exports ;
- filigrane ou mention de traçabilité dans les rapports sensibles ;
- contrôle d’accès aux rapports.

======================================================================
8. SÉCURITÉ APPLICATIVE
======================================================================

Effectuer une conception de sécurité rigoureuse.

Aligner le prototype sur les exigences pertinentes de :
- OWASP ASVS 5.0 ou version stable plus récente disponible ;
- OWASP Top 10 ;
- bonnes pratiques de sécurité des applications web ;
- principe de moindre privilège ;
- journalisation sécurisée ;
- gestion de secrets ;
- sécurité des sessions ;
- défense contre les attaques courantes.

Implémenter au minimum :

----------------------------------------------------------------------
8.1 Authentification
----------------------------------------------------------------------

- mot de passe haché avec Argon2id ;
- politique de mot de passe raisonnable ;
- verrouillage progressif ;
- limitation de débit ;
- MFA TOTP pour les comptes privilégiés ;
- récupération de compte simulée et sécurisée ;
- historique limité des mots de passe ;
- révocation de sessions ;
- expiration ;
- déconnexion ;
- invalidation après changement de mot de passe ;
- interdiction des comptes partagés ;
- journalisation des connexions.

----------------------------------------------------------------------
8.2 Sessions et jetons
----------------------------------------------------------------------

Privilégier des cookies :
- HttpOnly ;
- Secure lorsque HTTPS est activé ;
- SameSite approprié ;
- durée limitée ;
- rotation ;
- révocation ;
- protection CSRF ;
- aucune donnée sensible dans le navigateur.

Documenter la stratégie retenue.

----------------------------------------------------------------------
8.3 Autorisation
----------------------------------------------------------------------

- contrôle côté serveur sur chaque route ;
- vérification des scopes ;
- restrictions géographiques ;
- restrictions par établissement ;
- refus par défaut ;
- séparation des fonctions ;
- double validation pour certaines actions critiques ;
- journalisation des décisions sensibles ;
- tests empêchant les accès horizontaux et verticaux non autorisés.

----------------------------------------------------------------------
8.4 Protection des entrées et sorties
----------------------------------------------------------------------

- validation stricte Pydantic ;
- ORM ou requêtes paramétrées ;
- protection contre injection SQL ;
- protection XSS ;
- protection CSRF ;
- contrôle des fichiers téléversés ;
- taille maximale ;
- types autorisés ;
- nom de fichier opaque ;
- stockage hors répertoire public ;
- analyse simulée des pièces jointes ;
- encodage correct ;
- messages d’erreur non verbeux.

----------------------------------------------------------------------
8.5 Données sensibles
----------------------------------------------------------------------

- minimisation ;
- pseudonymisation ;
- chiffrement applicatif pour les champs identifiés comme sensibles ;
- AES-GCM ou solution éprouvée équivalente ;
- gestion centralisée des clés ;
- clés absentes du dépôt Git ;
- rotation ;
- séparation des environnements ;
- sauvegardes chiffrées ;
- tests de restauration ;
- absence de données personnelles sensibles dans les logs ;
- masquage à l’écran selon le rôle.

----------------------------------------------------------------------
8.6 Journal d’audit
----------------------------------------------------------------------

Créer un journal d’audit append-only.

Chaque événement sensible doit comporter :
- identifiant ;
- horodatage UTC ;
- utilisateur ;
- rôle ;
- périmètre ;
- action ;
- ressource ;
- identifiant opaque de ressource ;
- résultat ;
- adresse IP locale ou contexte réseau lorsque disponible ;
- user-agent lorsque pertinent ;
- corrélation ;
- justification ;
- niveau de criticité ;
- empreinte cryptographique ;
- chaînage optionnel des empreintes pour détecter les altérations.

Prévoir :
- consultation filtrée ;
- export contrôlé ;
- détection de rupture de chaîne ;
- archivage ;
- rétention ;
- tests ;
- rapport d’intégrité.

----------------------------------------------------------------------
8.7 Alertes
----------------------------------------------------------------------

Détecter au minimum :
- échecs répétés de connexion ;
- tentative d’accès interdit ;
- extraction massive ;
- navigation inhabituelle ;
- usage anormal d’une carte ;
- QR invalide ;
- carte suspendue utilisée ;
- altération d’un journal ;
- création d’un compte privilégié ;
- changement de rôle ;
- désactivation MFA ;
- modification d’une règle de rétention ;
- restauration d’une sauvegarde ;
- modification d’un paramètre critique.

======================================================================
9. PROTECTION DES DONNÉES PERSONNELLES
======================================================================

Traiter explicitement le fait que les données concernent potentiellement des mineurs.

Prendre en compte la loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel.

IMPORTANT :
- Ne pas produire une interprétation juridique définitive.
- Lire le texte officiel avant d’associer une exigence à un article.
- Citer l’article exact lorsqu’une obligation est mentionnée.
- Identifier les points qui nécessitent une validation par un juriste ou un délégué à la protection des données.
- Distinguer exigences légales, recommandations de sécurité et choix de conception.

Créer :
1. un registre des traitements ;
2. un inventaire des données ;
3. une classification des données ;
4. une matrice finalité-donnée-base juridique-rétention-accès ;
5. une politique de minimisation ;
6. des règles de conservation ;
7. des mécanismes de rectification ;
8. des mécanismes d’accès ;
9. une procédure d’export individuel ;
10. une procédure de suppression ou d’archivage lorsqu’elle est juridiquement applicable ;
11. un registre des violations de données ;
12. un modèle d’analyse d’impact ;
13. une liste des sous-traitants fictifs ;
14. une documentation sur les transferts de données ;
15. une politique de sauvegarde ;
16. une politique de purge ;
17. une procédure de réponse aux demandes des personnes concernées.

Ne pas traiter la biométrie comme un module standard.

======================================================================
10. MODÉLISATION DES MENACES
======================================================================

Créer un document THREAT_MODEL.md.

Utiliser STRIDE et une analyse par actifs.

Identifier :
- actifs ;
- acteurs ;
- surfaces d’attaque ;
- frontières de confiance ;
- flux ;
- hypothèses ;
- abus possibles ;
- impact ;
- probabilité ;
- mesures ;
- risque résiduel ;
- éléments hors périmètre.

Inclure au minimum :
- vol d’identifiants ;
- abus de privilèges ;
- accès horizontal ;
- accès vertical ;
- injection SQL ;
- XSS ;
- CSRF ;
- manipulation d’identifiants ;
- fuite par export ;
- fuite par sauvegarde ;
- falsification de QR code ;
- réutilisation de QR code ;
- altération du statut d’une carte ;
- répudiation ;
- altération de journaux ;
- fraude au paiement simulé ;
- usurpation d’un opérateur ;
- accès non autorisé à une fiche d’élève ;
- mauvaise configuration ;
- secret commité dans Git ;
- attaque par force brute ;
- indisponibilité ;
- erreur humaine ;
- restauration incorrecte ;
- perte de clé ;
- risque lié à MySQL 5.7 ancien.

Créer une matrice :
- menace ;
- scénario ;
- actif ;
- contrôle préventif ;
- contrôle détectif ;
- contrôle correctif ;
- test associé ;
- risque résiduel.

======================================================================
11. INTERFACE GUI
======================================================================

Créer une interface claire, professionnelle et fonctionnelle.

Écrans attendus :
1. connexion ;
2. MFA ;
3. tableau de bord ;
4. établissements ;
5. élèves ;
6. fiche élève ;
7. parcours scolaire ;
8. cartes ;
9. émission d’une carte ;
10. vérification QR ;
11. présence ;
12. services ;
13. paiements simulés ;
14. rapprochements ;
15. incidents ;
16. alertes ;
17. utilisateurs ;
18. rôles ;
19. permissions ;
20. périmètres ;
21. journaux d’audit ;
22. rapports ;
23. exports ;
24. demandes liées aux données personnelles ;
25. registre des traitements ;
26. règles de conservation ;
27. sauvegardes ;
28. paramètres ;
29. page d’aide ;
30. page « À propos » précisant clairement qu’il s’agit d’un prototype indépendant.

Ajouter :
- recherche ;
- filtres ;
- pagination ;
- tri ;
- validations ;
- messages clairs ;
- confirmation des opérations critiques ;
- protection contre les doubles clics ;
- états de chargement ;
- gestion des erreurs ;
- visibilité adaptée aux rôles ;
- accessibilité ;
- navigation cohérente.

======================================================================
12. DONNÉES DE DÉMONSTRATION
======================================================================

Créer un script seed_demo_data.py générant uniquement des données fictives.

Prévoir :
- 10 régions ;
- plusieurs départements fictifs ou explicitement marqués comme données de démonstration ;
- 30 établissements fictifs ;
- 1 000 élèves fictifs ;
- parcours scolaires fictifs ;
- cartes actives, suspendues et révoquées ;
- transactions simulées ;
- rapprochements ;
- présences ;
- anomalies ;
- incidents ;
- journaux ;
- utilisateurs de démonstration ;
- rôles ;
- statistiques suffisamment variées.

Ne jamais utiliser :
- identité réelle ;
- téléphone réel ;
- email réel ;
- adresse réelle ;
- photographie réelle ;
- matricule réel ;
- donnée récupérée sur Internet.

Créer une commande distincte permettant de supprimer entièrement les données de démonstration.

======================================================================
13. TESTS
======================================================================

Créer des tests automatisés pour :

- authentification ;
- MFA ;
- autorisation ;
- restriction par périmètre ;
- moindre privilège ;
- séparation des rôles ;
- création d’élève ;
- détection de doublon ;
- inscription ;
- transfert ;
- émission de carte ;
- suspension ;
- révocation ;
- validation QR ;
- rejet QR invalide ;
- paiement simulé ;
- idempotence ;
- rapprochement ;
- présence ;
- export ;
- journalisation ;
- intégrité du journal ;
- restauration ;
- validation des entrées ;
- injection SQL ;
- XSS ;
- CSRF ;
- brute force ;
- accès horizontal ;
- accès vertical ;
- fuite de secret ;
- absence de données sensibles dans les logs.

Créer :
- un rapport de couverture ;
- une liste des tests ;
- un script PowerShell run_tests.ps1 ;
- des résultats lisibles ;
- un fichier SECURITY_TEST_REPORT.md.

======================================================================
14. LIVRABLES
======================================================================

Générer un dépôt complet contenant au minimum :

- README.md
- ARCHITECTURE.md
- THREAT_MODEL.md
- SECURITY.md
- PRIVACY.md
- MYSQL57_COMPATIBILITY.md
- MIGRATION_TO_MYSQL84.md
- DATA_DICTIONARY.md
- RBAC_MATRIX.md
- API_DOCUMENTATION.md
- TEST_PLAN.md
- SECURITY_TEST_REPORT.md
- BACKUP_RESTORE.md
- INCIDENT_RESPONSE.md
- CHANGELOG.md
- .env.example
- .gitignore
- requirements.txt ou pyproject.toml
- package.json
- scripts PowerShell
- migrations Alembic
- scripts SQL
- script seed_demo_data.py
- script de purge
- script de sauvegarde
- script de restauration
- diagramme Mermaid
- frontend complet
- backend complet
- tests complets.

Créer une arborescence propre, par exemple :

educard-secure/
  backend/
  frontend/
  database/
  migrations/
  scripts/
  tests/
  docs/
  backups/
  exports/
  uploads/
  logs/
  .env.example
  README.md

======================================================================
15. INSTALLATION WINDOWS ET MYSQL 5.7
======================================================================

Documenter pas à pas :

1. prérequis ;
2. création de l’environnement virtuel Python ;
3. installation des dépendances ;
4. installation des dépendances frontend ;
5. création d’une base MySQL 5.7 dédiée ;
6. création d’un utilisateur MySQL dédié avec privilèges minimaux ;
7. configuration du fichier .env ;
8. exécution des migrations ;
9. chargement des données synthétiques ;
10. lancement du backend ;
11. lancement du frontend ;
12. accès à l’interface ;
13. exécution des tests ;
14. création d’une sauvegarde ;
15. restauration ;
16. purge des données de démonstration ;
17. diagnostic des erreurs fréquentes.

Ne jamais recommander l’utilisation quotidienne du compte MySQL root par l’application.

Prévoir des commandes PowerShell copiables directement.

======================================================================
16. MÉTHODE DE TRAVAIL ATTENDUE
======================================================================

Procéder par phases.

PHASE 0 — Vérification de l’environnement
- inspecter le répertoire courant ;
- vérifier les outils disponibles ;
- vérifier Python, Node.js, npm et MySQL ;
- ne pas modifier une installation système sans autorisation ;
- identifier le port MySQL ;
- vérifier la connexion avec un compte fourni par l’utilisateur ou avec une configuration .env ;
- afficher clairement les prérequis manquants.

PHASE 1 — Architecture
- proposer l’arborescence ;
- produire le schéma ;
- produire le diagramme Mermaid ;
- documenter les hypothèses ;
- identifier les décisions sensibles.

PHASE 2 — Base de données
- créer les modèles ;
- créer les migrations ;
- vérifier la compatibilité MySQL 5.7 ;
- exécuter les migrations ;
- produire les données synthétiques.

PHASE 3 — Backend
- créer les modules ;
- implémenter les contrôles ;
- produire l’API ;
- documenter OpenAPI.

PHASE 4 — Frontend
- créer les écrans ;
- brancher les API ;
- vérifier le RBAC ;
- afficher les graphiques ;
- gérer les erreurs.

PHASE 5 — Sécurité
- appliquer les contrôles ;
- produire la modélisation des menaces ;
- écrire les tests ;
- analyser les logs ;
- vérifier l’absence de secrets.

PHASE 6 — Validation
- lancer les tests ;
- corriger les erreurs ;
- exécuter un scénario métier complet ;
- produire un rapport final ;
- indiquer les limites.

PHASE 7 — Documentation
- finaliser le README ;
- finaliser l’installation Windows ;
- documenter MySQL 5.7 ;
- documenter la migration ;
- documenter la sauvegarde ;
- documenter les risques résiduels.

======================================================================
17. SCÉNARIOS DE DÉMONSTRATION
======================================================================

Implémenter et documenter les scénarios suivants :

SCÉNARIO A — Immatriculation
- créer un élève fictif ;
- l’inscrire ;
- générer son matricule ;
- vérifier l’absence de doublon ;
- afficher son historique.

SCÉNARIO B — Carte
- demander une carte ;
- l’émettre ;
- générer le QR sécurisé ;
- vérifier le QR ;
- suspendre la carte ;
- montrer que le QR est refusé ;
- réactiver la carte ;
- vérifier à nouveau.

SCÉNARIO C — Présence
- enregistrer une entrée ;
- enregistrer un retard ;
- afficher les statistiques ;
- corriger une erreur avec validation.

SCÉNARIO D — Service
- attribuer un droit fictif de restauration ;
- vérifier l’éligibilité ;
- journaliser l’accès ;
- refuser un service non autorisé.

SCÉNARIO E — Paiement simulé
- créer une transaction simulée ;
- rapprocher la transaction ;
- détecter un doublon ;
- afficher les indicateurs.

SCÉNARIO F — Sécurité
- tenter une connexion invalide répétée ;
- déclencher une alerte ;
- tenter un accès hors périmètre ;
- vérifier le refus ;
- exporter un rapport ;
- vérifier le journal d’audit ;
- vérifier l’intégrité de la chaîne d’empreintes.

SCÉNARIO G — Protection des données
- créer une demande d’accès ;
- produire un export encadré ;
- journaliser l’action ;
- appliquer une règle de rétention ;
- afficher les éléments nécessitant validation juridique.

======================================================================
18. CRITÈRES D’ACCEPTATION
======================================================================

Le projet est acceptable uniquement si :

- l’application démarre réellement ;
- la GUI fonctionne ;
- MySQL 5.7 est utilisé avec succès ;
- les migrations s’exécutent ;
- les données synthétiques sont chargées ;
- les rôles sont appliqués côté backend ;
- les tableaux de bord affichent des données ;
- les scénarios de démonstration fonctionnent ;
- les tests critiques passent ;
- aucune donnée réelle n’est incluse ;
- aucun secret n’est commité ;
- les journaux ne contiennent pas de donnée sensible inutile ;
- la documentation Windows est exploitable ;
- les limites sont clairement écrites ;
- la dette liée à MySQL 5.7 est explicitement documentée ;
- une migration vers MySQL 8.4 LTS est préparée ;
- le prototype n’est jamais présenté comme une solution officielle.

======================================================================
19. FORMAT DE TA RÉPONSE ET DE TES ACTIONS
======================================================================

Ne te limite pas à proposer du pseudocode.

Tu dois :
1. créer les fichiers ;
2. écrire le code complet ;
3. écrire les migrations ;
4. exécuter les tests disponibles ;
5. corriger les erreurs observées ;
6. afficher les commandes utilisées ;
7. fournir les résultats ;
8. produire les rapports ;
9. indiquer honnêtement les éléments non vérifiés ;
10. signaler les points nécessitant une validation juridique, institutionnelle ou métier.

À chaque phase :
- résumer ce qui a été créé ;
- lister les fichiers concernés ;
- indiquer les tests effectués ;
- signaler les limitations ;
- poursuivre jusqu’à obtenir une version fonctionnelle minimale complète.

Lorsque la machine ne permet pas une opération :
- ne pas inventer un résultat ;
- expliquer précisément le blocage ;
- produire les fichiers nécessaires ;
- fournir la commande exacte à exécuter localement ;
- continuer les autres tâches réalisables.

Commence par analyser l’environnement local, proposer l’arborescence, créer le fichier README.md initial, produire le schéma de base de données et générer le squelette fonctionnel de l’application.
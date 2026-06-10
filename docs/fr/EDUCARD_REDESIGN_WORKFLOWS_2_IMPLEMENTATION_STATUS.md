# État d'implémentation du redesign Volume 2

Ce document suit l'application de `EDUCARD_REDESIGN_WORKFLOWS_2.md`.

## Statut

Toutes les exigences du volume 2 sont implémentées, sauf les éléments
explicitement hors périmètre ci-dessous.

## Implémenté

- journal d'audit filtré, paginé, détaillé et vérifiable ;
- contrôle global et unitaire de la chaîne d'empreintes ;
- alertes et incidents avec commentaires, affectation, chronologie et transitions ;
- sessions actives, révocation unitaire et révocation des autres sessions ;
- préférences de thème et de langue persistées par utilisateur ;
- services configurables, fournisseurs fictifs, droits et éligibilité ;
- paiements simulés, erreurs configurables, idempotence et rapprochement en lot ;
- exports contrôlés avec motif, filtres, empreinte et suivi du téléchargement ;
- demandes de données avec transitions finales ;
- export de portabilité personnel JSON signé Ed25519 ;
- registre des traitements et règles de rétention ;
- validations hiérarchiques appliquées aux régions, départements, arrondissements,
  établissements et classes ;
- activation contrôlée des niveaux scolaires ;
- PDF CR80 serveur avec photo et QR temporaire dédié à l'impression ;
- routage par URL et persistance des filtres du tableau de bord ;
- découpage dynamique des écrans Volume 2 ;
- couverture bilingue centralisée des libellés Volume 2 ;
- test navigateur authentifié couvrant navigation, sessions, services et déconnexion.

## Vérifications exécutées

- tests backend complets : `24 passed` ;
- tests frontend : `7 passed` ;
- E2E Playwright : `1 passed` ;
- lint et build frontend : réussis ;
- migration MySQL : `0005_complete_redesign_workflows (head)` ;
- PDF, QR temporaire, portabilité signée et validation multi-référentiels :
  couverts par tests automatisés.

## Hors périmètre

- intégration SMS réelle avec un opérateur externe ;
- restauration automatique d'une sauvegarde.

La notification SMS reste une simulation locale. La restauration demeure une
opération manuelle exigeant confirmation explicite, conformément aux règles de
sécurité du projet.

## Limitations

- aucune restauration réelle n'a été exécutée ;
- le bundle historique principal reste volumineux malgré le découpage dynamique ;
- les décisions juridiques liées à la portabilité et à la rétention nécessitent
  une validation humaine.

# État d'implémentation du redesign Volume 3

Ce document suit l'application de `EDUCARD_REDESIGN_WORKFLOWS_3.md`.

## Statut

Les workflows 15, 16 et 17 sont implémentés et vérifiés localement.

## Fiche élève

- page dédiée `/scolarite/eleves/:id` avec onglet actif dans l'URL ;
- prévisualisation légère conservée dans la liste ;
- huit onglets : Synthèse, Identité, Parcours, Carte, Services, Historique, Doublons et Audit ;
- conflit optimiste HTTP 409 avec version courante ;
- sortie, réintégration et archivage à motif structuré ;
- archivage coordonné des inscriptions, cartes et droits actifs ;
- décisions humaines sur les doublons, sans fusion automatique.

## Tableaux de bord spécialisés

- cinq pages : cartes, présence, paiements simulés, sécurité et services ;
- KPI, graphiques, tableaux agrégés, pagination, tri, filtre par colonne et drill-down ;
- filtres persistés dans l'URL et transmis depuis le dashboard central ;
- filtrage backend par périmètre, région, département et établissement pour les données scolaires ;
- vingt routes spécialisées, dont le KPI paiements complémentaire.

## Sauvegardes

- page en lecture seule avec quatre indicateurs, pagination, tri, filtres par colonne, badges et panneau de détail ;
- métadonnées `checksum_present`, `file_size_bytes` et `operator` ;
- endpoint interne `POST /api/v1/backups/log`, exclu d'OpenAPI et protégé par jeton de service ;
- scripts de sauvegarde, vérification et restauration reliés au journal applicatif ;
- aucune restauration exécutée.

## Vérifications

- migration MySQL 5.7 : `0006_redesign_workflows_volume3 (head)` ;
- backend : `27 passed` ;
- frontend : `7 passed` ;
- Playwright : `4 passed` ;
- build et lint frontend : réussis ;
- sauvegarde locale créée, empreinte SHA-256 vérifiée et deux événements journalisés ;
- `.env`, `backups/` et `private/` ignorés par Git.

## Limites

- les événements de sécurité historiques ne portent pas tous une référence d'établissement ; leur filtrage territorial reste limité ;
- le bundle principal historique dépasse encore 500 Ko après minification ;
- les avertissements de dépréciation `datetime.utcnow()` restent à traiter.

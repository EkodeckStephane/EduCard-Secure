# État d'implémentation de la refonte EduCard

Ce document suit l'application de `EDUCARD_REDESIGN_WORKFLOWS.md`.

## Statut

Les exigences fonctionnelles du volume 1 sont implémentées.

## Implémenté

- sélecteurs recherchables sans saisie d'identifiants techniques ;
- panneaux de détail, assistant d'immatriculation, photo, doublons et historique ;
- création enchaînée élève, inscription et demande de carte ;
- cycle complet des cartes avec motifs, confirmations et timeline ;
- scanner QR par caméra et repli manuel, y compris dans le pointage ;
- présence, corrections et validations séparées par permission ;
- tableau de bord filtrable avec filtres persistés dans l'URL ;
- comparaisons réelles de périodes, tendances et widgets adaptés aux rôles ;
- création d'utilisateur, périmètres hiérarchiques et MFA TOTP ;
- PDF CR80 généré côté serveur avec photo et QR d'impression temporaire ;
- alertes et incidents avec détail, historique et transitions ;
- motif obligatoire sur les exports sensibles ;
- routage par URL, chargement global, toasts et gestion centralisée des erreurs ;
- dictionnaire bilingue étendu aux workflows refondus ;
- contrôle RBAC et périmètres côté backend ;
- test E2E authentifié pilotant un navigateur réel.

## Vérifications exécutées

- backend : `24 passed` ;
- tests frontend : `7 passed` ;
- E2E Playwright authentifié : `1 passed` ;
- lint frontend : réussi ;
- build frontend : réussi ;
- compilation Python : réussie ;
- migration active : `0005_complete_redesign_workflows (head)` ;
- connexion fictive, navigation par URL et déconnexion : vérifiées.

## Limitations

- le bundle principal reste supérieur à 500 Ko après minification malgré le
  découpage dynamique des workflows. Une extraction progressive de l'ancien
  fichier `main.tsx` améliorerait le temps de chargement initial ;
- les tests signalent des avertissements de dépréciation liés à
  `datetime.utcnow`, sans échec fonctionnel.

## Hors périmètre

Aucun élément fonctionnel du volume 1 n'est reporté.

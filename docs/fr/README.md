# Documentation EduCard Secure

Ce repertoire contient la documentation en francais.

## Regle de maintenance

Toute nouvelle documentation doit etre maintenue en deux langues :

- version francaise dans `docs/fr`;
- version anglaise dans `docs/en`.

Les fichiers historiques situes directement dans `docs` sont conserves pour
compatibilite avec les phases deja executees.

## Langue de l'application

L'application expose une preference utilisateur `preferred_language` avec les
valeurs `fr` et `en`. Le frontend utilise cette preference pour afficher les
libelles principaux dans la langue de l'utilisateur.

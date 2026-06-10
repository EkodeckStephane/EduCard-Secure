# Sauvegarde et restauration

Les sauvegardes utilisent `mysqldump.exe`, creent un fichier horodate dans `backups/` et calculent une empreinte SHA-256. La restauration exige une confirmation explicite et n'est pas executee sans autorisation.

## Statut

Document francais normalise pour la livraison locale. Les elements techniques conservent leurs identifiants originaux afin de rester verifiables dans le code et les tests.
# Journalisation applicative des sauvegardes

Configurer localement `BACKUP_SERVICE_TOKEN` dans `.env`, puis redémarrer le
backend. Les scripts `backup_database.ps1`, `verify_backup.ps1` et
`restore_database.ps1` publient alors leurs résultats vers la route interne
`POST /api/v1/backups/log`.

Cette route n'est pas publiée dans Swagger et ne reçoit jamais le chemin
complet du fichier, uniquement une référence opaque. Une indisponibilité de
l'API n'annule pas une sauvegarde déjà réussie : le script affiche un
avertissement explicite.

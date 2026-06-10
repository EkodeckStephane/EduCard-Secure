# Documentation API

L'API est exposee sous `/api/v1`. Elle couvre authentification, utilisateurs, RBAC, eleves, inscriptions, cartes, QR, presence, services, paiements simules, tableaux de bord, exports, audit, alertes, incidents, privacy, retention et sauvegardes. Les routes mutantes exigent CSRF lorsque prevu par le backend.

## Statut

Document francais normalise pour la livraison locale. Les elements techniques conservent leurs identifiants originaux afin de rester verifiables dans le code et les tests.
# Interface OpenAPI interactive

- Swagger UI : `/docs`
- ReDoc : `/redoc`
- Schema OpenAPI JSON : `/openapi.json`

Pour tester une route protegee :

1. Executer `POST /api/v1/auth/login`.
2. Le navigateur conserve le cookie de session pour l'API locale.
3. Copier le champ `csrf_token` retourne.
4. Pour les operations protegees en ecriture, renseigner cette valeur dans le
   parametre `X-CSRF-Token` affiche par Swagger.

## Complément Volume 3

La fiche élève consolidée expose `/students/{id}/summary`, `/enrollments`,
`/cards`, `/services` et `/duplicates`. L'archivage structuré utilise
`PATCH /students/{id}/archive`.

Les dashboards spécialisés sont regroupés sous `/dashboard/cards/*`,
`/dashboard/attendance/*`, `/dashboard/payments/*`, `/dashboard/security/*`
et `/dashboard/services/*`.

`GET /backups/summary` alimente la synthèse en lecture seule.
`POST /backups/log` est interne, protégé par `X-Service-Token` et absent du
schéma OpenAPI public.
5. Les controles RBAC et de perimetre restent appliques par le backend.

## Routes ajoutées par le redesign

- `GET /api/v1/dashboard/kpi?period=today|7d|30d` : KPI adaptés au rôle,
  comparaison avec la période précédente et série de tendance.
- `GET /api/v1/cards/{id}/pdf` : carte CR80 PDF avec photo disponible et QR
  d'impression signé à durée de validité courte.
- `POST /api/v1/exports/portability` : export JSON personnel signé Ed25519.
  Le corps contient `student_id` et un `reason` d'au moins 20 caractères.

Ces routes appliquent le RBAC, les périmètres, CSRF pour les écritures et la
journalisation d'audit.
## Format d'erreur commun

Les erreurs HTTP applicatives utilisent la structure suivante :

```json
{
  "detail": "Description lisible ou objet de contexte",
  "code": "CODE_STABLE"
}
```

Codes courants : `AUTHENTICATION_REQUIRED`, `ACCESS_DENIED`, `NOT_FOUND`,
`CONFLICT`, `RECORD_VERSION_CONFLICT`, `VALIDATION_ERROR` et `RATE_LIMITED`.
Le champ `detail` reste compatible avec les clients existants.

Lors d'un transfert, `expected_from_school_id` peut être fourni. La requête est
rejetée avec `409 CONFLICT` si l'élève a changé d'établissement entre
l'affichage du formulaire et sa validation.

# Data Model Draft

## Portee

Ce document decrit le modele relationnel logique cible. Il ne constitue pas encore le schema SQL final ni une migration Alembic. La phase 2 produira le SQL compatible MySQL 5.7.

## Conventions

- Cles primaires techniques : `BIGINT UNSIGNED AUTO_INCREMENT` pour les tables internes sauf decision contraire en phase 2.
- Identifiants publics : `public_id CHAR(36)` UUID ou identifiant opaque.
- Horodatages : `created_at`, `updated_at` en UTC.
- Trace utilisateur : `created_by`, `updated_by` lorsque pertinent.
- Suppression logique : uniquement pour ressources ou l'historique doit etre conserve.
- Encodage cible : `utf8mb4`.
- Moteur cible : InnoDB.
- Contraintes non garanties par MySQL 5.7 : appliquees par services et tests.

## Domaines

### Identite, acces et securite

#### users

Compte applicatif.

Champs principaux :

- `id`
- `public_id`
- `username`
- `display_name`
- `email_masked`
- `password_hash`
- `status`
- `last_login_at`
- `mfa_required`
- `created_at`
- `updated_at`

Contraintes :

- `username` unique.
- Mot de passe jamais stocke en clair.
- Email facultatif et synthetique en demo.

#### roles

Role RBAC.

Champs principaux :

- `id`
- `code`
- `label`
- `description`
- `is_privileged`

Contraintes :

- `code` unique.

Roles initiaux :

- `SUPER_ADMIN_TECHNIQUE`
- `ADMINISTRATION_CENTRALE`
- `DELEGATION_REGIONALE`
- `DELEGATION_DEPARTEMENTALE`
- `RESPONSABLE_ETABLISSEMENT`
- `AGENT_IMMATRICULATION`
- `AGENT_CARTE`
- `AGENT_PRESENCE`
- `AGENT_SERVICE`
- `AGENT_FINANCE`
- `AUDITEUR_SECURITE`
- `ANALYSTE_STATISTIQUE`
- `SUPPORT`

#### permissions

Permission atomique.

Champs principaux :

- `id`
- `code`
- `resource`
- `action`
- `description`

Contraintes :

- `code` unique.

#### user_roles

Association utilisateurs-roles.

Champs principaux :

- `user_id`
- `role_id`
- `assigned_at`
- `assigned_by`

Contrainte :

- Unique `user_id`, `role_id`.

#### role_permissions

Association roles-permissions.

Champs principaux :

- `role_id`
- `permission_id`

Contrainte :

- Unique `role_id`, `permission_id`.

#### user_scopes

Perimetre geographique ou organisationnel d'un utilisateur.

Champs principaux :

- `id`
- `user_id`
- `scope_type`
- `region_id`
- `department_id`
- `school_id`
- `valid_from`
- `valid_until`

Regle applicative :

- Un scope doit pointer vers un seul niveau principal coherent.

#### sessions

Sessions applicatives.

Champs principaux :

- `id`
- `user_id`
- `session_token_hash`
- `csrf_token_hash`
- `ip_context`
- `user_agent_hash`
- `created_at`
- `expires_at`
- `revoked_at`

#### session_tokens

Rotation ou jetons secondaires de session si retenus.

Champs principaux :

- `id`
- `session_id`
- `token_hash`
- `issued_at`
- `expires_at`
- `revoked_at`

#### mfa_methods

Methodes MFA.

Champs principaux :

- `id`
- `user_id`
- `method_type`
- `secret_encrypted`
- `enabled_at`
- `disabled_at`

#### password_history

Historique limite des empreintes de mots de passe.

Champs principaux :

- `id`
- `user_id`
- `password_hash`
- `created_at`

#### login_attempts

Tentatives de connexion.

Champs principaux :

- `id`
- `username`
- `user_id`
- `result`
- `ip_context`
- `attempted_at`

#### security_events

Evenements de securite.

Champs principaux :

- `id`
- `event_type`
- `severity`
- `user_id`
- `resource_type`
- `resource_public_id`
- `details_minimized`
- `created_at`

#### audit_events

Journal d'audit append-only.

Champs principaux :

- `id`
- `event_public_id`
- `occurred_at`
- `actor_user_id`
- `actor_role_code`
- `scope_summary`
- `action`
- `resource_type`
- `resource_public_id`
- `result`
- `correlation_id`
- `justification`
- `severity`

#### audit_event_hashes

Empreintes d'integrite du journal d'audit.

Champs principaux :

- `id`
- `audit_event_id`
- `previous_hash`
- `event_hash`
- `hash_algorithm`
- `created_at`

### Referentiels administratifs

#### regions

Region administrative de demonstration.

Champs principaux :

- `id`
- `code`
- `name`
- `is_demo`

#### departments

Departement rattache a une region.

Champs principaux :

- `id`
- `region_id`
- `code`
- `name`
- `is_demo`

#### subdivisions

Arrondissement rattache a un departement.

Champs principaux :

- `id`
- `department_id`
- `code`
- `name`
- `is_demo`

#### schools

Etablissement scolaire fictif ou de demonstration.

Champs principaux :

- `id`
- `public_id`
- `subdivision_id`
- `code`
- `name`
- `school_type`
- `education_subsystem`
- `status`

#### school_years

Annee scolaire.

Champs principaux :

- `id`
- `code`
- `starts_on`
- `ends_on`
- `status`

#### grade_levels

Niveaux.

Champs principaux :

- `id`
- `code`
- `label`
- `education_subsystem`
- `sort_order`

#### classrooms

Classe dans un etablissement.

Champs principaux :

- `id`
- `school_id`
- `school_year_id`
- `grade_level_id`
- `code`
- `label`
- `capacity`

### Eleves et parcours

#### students

Fiche eleve fictive.

Champs principaux :

- `id`
- `public_id`
- `student_number`
- `last_name`
- `first_name`
- `birth_date`
- `gender`
- `status`
- `current_school_id`
- `current_classroom_id`
- `record_version`
- `created_at`
- `updated_at`

Contraintes :

- `student_number` unique.
- Donnees minimales.
- Photographie optionnelle stockee par reference opaque si activee.

#### student_guardians

Representant legal fictif et optionnel.

Champs principaux :

- `id`
- `student_id`
- `relationship`
- `display_name`
- `contact_masked`
- `is_primary`

#### enrollments

Inscription annuelle.

Champs principaux :

- `id`
- `student_id`
- `school_id`
- `classroom_id`
- `school_year_id`
- `status`
- `enrolled_at`
- `validated_by`

#### transfers

Transfert entre etablissements.

Champs principaux :

- `id`
- `student_id`
- `from_school_id`
- `to_school_id`
- `from_classroom_id`
- `to_classroom_id`
- `requested_at`
- `approved_at`
- `status`

#### student_status_history

Historique des statuts eleve.

Champs principaux :

- `id`
- `student_id`
- `previous_status`
- `new_status`
- `reason`
- `changed_at`
- `changed_by`

### Cartes et QR

#### cards

Carte scolaire digitale.

Champs principaux :

- `id`
- `public_id`
- `student_id`
- `serial_number`
- `card_version`
- `status`
- `issued_at`
- `activated_at`
- `expires_at`
- `revoked_at`
- `signing_key_version_id`

Contraintes :

- `serial_number` unique.
- Une seule carte active par eleve a la fois, appliquee par service.

#### card_status_history

Historique des statuts de carte.

Champs principaux :

- `id`
- `card_id`
- `previous_status`
- `new_status`
- `reason`
- `changed_at`
- `changed_by`

#### card_issuance_events

Evenements d'emission et de reimpression.

Champs principaux :

- `id`
- `card_id`
- `event_type`
- `requested_by`
- `processed_by`
- `created_at`
- `details_minimized`

#### signing_key_versions

Versions de cles de signature.

Champs principaux :

- `id`
- `key_version`
- `public_key_fingerprint`
- `status`
- `valid_from`
- `valid_until`
- `created_at`

Note :

- Les cles privees ne sont jamais stockees dans le depot Git.

#### qr_verification_events

Verification simulee de QR code.

Champs principaux :

- `id`
- `card_id`
- `opaque_identifier`
- `verification_result`
- `reason_code`
- `verified_by`
- `verified_at`
- `correlation_id`

### Presence

#### attendance_events

Pointage.

Champs principaux :

- `id`
- `student_id`
- `card_id`
- `school_id`
- `classroom_id`
- `event_type`
- `event_time`
- `source`
- `recorded_by`

#### attendance_corrections

Correction validee.

Champs principaux :

- `id`
- `attendance_event_id`
- `previous_value`
- `new_value`
- `reason`
- `requested_by`
- `approved_by`
- `approved_at`

### Services

#### service_types

Type de service configurable.

Champs principaux :

- `id`
- `code`
- `label`
- `description`

#### service_providers

Fournisseur fictif.

Champs principaux :

- `id`
- `public_id`
- `name`
- `provider_type`
- `is_mock`

#### service_entitlements

Droit attribue a un eleve.

Champs principaux :

- `id`
- `student_id`
- `service_type_id`
- `service_provider_id`
- `valid_from`
- `valid_until`
- `status`

#### service_verification_events

Verification d'un droit.

Champs principaux :

- `id`
- `service_entitlement_id`
- `student_id`
- `card_id`
- `result`
- `verified_by`
- `verified_at`

### Paiements simules

#### payment_providers

Provider de paiement mock.

Champs principaux :

- `id`
- `code`
- `label`
- `provider_type`
- `is_mock`
- `status`

#### payment_transactions

Transaction simulee.

Champs principaux :

- `id`
- `public_id`
- `payment_provider_id`
- `student_id`
- `school_id`
- `school_year_id`
- `opaque_reference`
- `idempotency_key`
- `amount`
- `currency`
- `category`
- `status`
- `created_at`

Contraintes :

- `opaque_reference` unique par provider.
- `idempotency_key` unique par provider.

#### payment_reconciliations

Rapprochement.

Champs principaux :

- `id`
- `payment_transaction_id`
- `reconciliation_status`
- `matched_at`
- `matched_by`
- `notes_minimized`

### Incidents, privacy et exploitation

#### incidents

Incident ou anomalie.

Champs principaux :

- `id`
- `public_id`
- `category`
- `priority`
- `severity`
- `status`
- `assigned_to`
- `created_at`
- `resolved_at`

#### incident_events

Historique d'un incident.

Champs principaux :

- `id`
- `incident_id`
- `event_type`
- `comment_minimized`
- `created_by`
- `created_at`

#### data_access_requests

Demandes liees aux donnees personnelles.

Champs principaux :

- `id`
- `public_id`
- `request_type`
- `subject_type`
- `student_id`
- `status`
- `received_at`
- `closed_at`

#### retention_rules

Regles de conservation.

Champs principaux :

- `id`
- `resource_type`
- `retention_period_days`
- `action_on_expiry`
- `status`

#### data_processing_register

Registre des traitements.

Champs principaux :

- `id`
- `processing_name`
- `purpose`
- `data_categories`
- `legal_basis_note`
- `retention_note`
- `requires_legal_validation`

#### exports

Export controle.

Champs principaux :

- `id`
- `public_id`
- `export_type`
- `requested_by`
- `status`
- `created_at`
- `expires_at`

#### export_events

Historique des exports.

Champs principaux :

- `id`
- `export_id`
- `event_type`
- `created_by`
- `created_at`

#### configuration_settings

Parametres applicatifs.

Champs principaux :

- `id`
- `setting_key`
- `setting_value_encrypted`
- `is_sensitive`
- `updated_by`
- `updated_at`

#### notification_events

Notifications locales ou simulees.

Champs principaux :

- `id`
- `event_type`
- `recipient_scope`
- `status`
- `created_at`

#### backup_events

Evenements de sauvegarde et restauration.

Champs principaux :

- `id`
- `event_type`
- `status`
- `file_reference`
- `started_at`
- `finished_at`
- `created_by`

## Index cibles

- Index uniques sur codes de referentiels.
- Index sur toutes les cles etrangeres.
- Index sur `public_id`.
- Index sur `student_number`.
- Index sur `serial_number`.
- Index sur `occurred_at`, `created_at`, `event_time`.
- Index composites pour filtres frequents : region, departement, school, school_year, status.

## Politiques de donnees

- Les donnees demo doivent etre marquees ou generables de facon reproductible.
- Les donnees sensibles doivent etre minimales et masquees.
- Les exports doivent etre temporaires et journalises.
- Les suppressions physiques seront limitees aux donnees de demonstration ou cas explicitement autorises.
- La retention juridique doit etre validee par un juriste avant toute affirmation normative.

## Points a trancher en phase 2

- Type exact des UUID : `CHAR(36)` lisible ou `BINARY(16)` plus compact.
- Granularite finale des tables de referentiels.
- Strategie de chiffrement applicatif des champs sensibles.
- Gestion exacte des sessions : table unique ou rotation separee.
- Regle technique d'unicite d'une carte active par eleve sous MySQL 5.7.


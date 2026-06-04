# Known Limitations

- Prototype only; not an official institutional system.
- Synthetic data only.
- No real MTN MoMo, Orange Money, bank or operator integration.
- No biometric processing.
- No production HSM or WORM audit store.
- MySQL 5.7 compatibility is maintained, but MySQL 5.7 is legacy.
- Restore procedure is documented but not executed without explicit approval.
- Documentation is split into `docs/fr` and `docs/en`; final institutional
  publication still requires subject-matter and legal review.
- Frontend i18n covers primary labels; deeper table values and backend messages
  are not fully localized.
- Accessibility was checked only at a basic build/lint level.
- Final audit did not execute a real restore operation.
- Final audit did not purge demo data to avoid deleting local demonstration
  records during delivery preparation.
- Final audit did not execute a browser automation walkthrough of every screen.

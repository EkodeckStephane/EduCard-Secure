import { describe, expect, it } from 'vitest';
import { localizeField, localizeText, localizeValue, t } from './i18n';

describe('bilingual interface', () => {
  it('translates navigation labels in both directions', () => {
    expect(t('fr', 'students')).toBe('Élèves');
    expect(t('en', 'students')).toBe('Students');
    expect(localizeText('en', 'Creer un etablissement')).toBe('Create a school');
    expect(localizeText('fr', 'Create a school')).toBe('Créer un établissement');
  });

  it('translates API field names', () => {
    expect(localizeField('fr', 'student_number')).toBe('Matricule');
    expect(localizeField('en', 'student_number')).toBe('Student number');
    expect(localizeField('fr', 'school_name')).toBe('Établissement');
    expect(localizeField('en', 'school_name')).toBe('School');
  });

  it('translates API display values without changing unknown data', () => {
    expect(localizeValue('fr', 'ACTIVE')).toBe('Actif');
    expect(localizeValue('en', 'ACTIVE')).toBe('Active');
    expect(localizeValue('fr', 'SCHOOL')).toBe('Établissement');
    expect(localizeValue('en', 'SCHOOL')).toBe('School');
    expect(localizeValue('en', 'Lycée fictif de Yaoundé')).toBe('Lycée fictif de Yaoundé');
  });
});

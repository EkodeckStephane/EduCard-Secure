import { Button, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../i18n';
import { SearchSelect, SelectOption, useToast } from './WorkflowComponents';

export function EnrollmentPanel({ onError }: { onError: (value: string) => void }) {
  const language = useLanguage();
  const notify = useToast();
  const [students, setStudents] = useState<SelectOption[]>([]);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [years, setYears] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<SelectOption[]>([]);
  const [student, setStudent] = useState<SelectOption | null>(null);
  const [school, setSchool] = useState<SelectOption | null>(null);
  const [year, setYear] = useState<SelectOption | null>(null);
  const [classroom, setClassroom] = useState<SelectOption | null>(null);

  useEffect(() => {
    Promise.all([api.students('?page=1&page_size=100'), api.schools(), api.schoolYears()]).then(([studentRows, schoolRows, yearRows]) => {
      setStudents(studentRows.items.map((item) => ({ id: item.id, label: `${item.first_name} ${item.last_name}`, subtitle: item.student_number, raw: item as unknown as Record<string, unknown> })));
      setSchools(schoolRows.map((row) => ({ id: Number(row.school_id ?? row.id), label: String(row.school ?? row.name), subtitle: String(row.subdivision ?? ''), raw: row })));
      setYears(yearRows.map((row) => ({ id: Number(row.id), label: String(row.code), subtitle: String(row.status), raw: row })));
    }).catch(() => onError(language === 'fr' ? 'Chargement des inscriptions refusé.' : 'Enrollment loading denied.'));
  }, [language, onError]);

  useEffect(() => {
    if (!school || !year) return setClasses([]);
    api.classrooms(school.id, year.id).then((rows) => setClasses(rows.map((row) => ({
      id: Number(row.id),
      label: String(row.label),
      subtitle: `${String(row.grade_level ?? '')} · ${row.remaining_capacity ?? '—'} ${language === 'fr' ? 'places' : 'places'}`,
      raw: row,
    })))).catch(() => onError(language === 'fr' ? 'Chargement des classes refusé.' : 'Classroom loading denied.'));
  }, [language, school, year, onError]);

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: 'flex-start' }}>
      <Paper component="form" variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5, width: '100%' }} onSubmit={async (event) => {
        event.preventDefault();
        try {
          if (!student || !school || !classroom || !year) return;
          await api.enroll({ student_id: student.id, school_id: school.id, classroom_id: classroom.id, school_year_id: year.id, status: 'ACTIVE' });
          notify(language === 'fr' ? 'Inscription enregistrée.' : 'Enrollment recorded.', 'success');
        } catch {
          onError(language === 'fr' ? 'Inscription refusée.' : 'Enrollment denied.');
        }
      }}>
        <Typography variant="h6">{language === 'fr' ? 'Inscription' : 'Enrollment'}</Typography>
        <SearchSelect label={language === 'fr' ? 'Élève' : 'Student'} options={students} value={student} onChange={setStudent} />
        <SearchSelect label={language === 'fr' ? 'Établissement' : 'School'} options={schools} value={school} onChange={(value) => { setSchool(value); setClassroom(null); }} />
        <SearchSelect label={language === 'fr' ? 'Année scolaire' : 'School year'} options={years} value={year} onChange={(value) => { setYear(value); setClassroom(null); }} />
        <SearchSelect label={language === 'fr' ? 'Classe' : 'Classroom'} options={classes} value={classroom} onChange={setClassroom} disabled={!school || !year} />
        <Button type="submit" variant="contained" disabled={!student || !school || !year || !classroom}>{language === 'fr' ? 'Valider' : 'Confirm'}</Button>
      </Paper>
      <Paper component="form" variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5, width: '100%' }} onSubmit={async (event) => {
        event.preventDefault();
        if (!window.confirm(language === 'fr' ? 'Confirmer le transfert ?' : 'Confirm transfer?')) return;
        try {
          if (!student || !school) return;
          await api.transfer({
            student_id: student.id,
            expected_from_school_id: Number(student.raw?.current_school_id) || undefined,
            to_school_id: school.id,
            to_classroom_id: classroom?.id,
            comment: 'Transfert administratif fictif',
          });
          notify(language === 'fr' ? 'Transfert enregistré.' : 'Transfer recorded.', 'success');
        } catch {
          onError(language === 'fr' ? 'Transfert refusé.' : 'Transfer denied.');
        }
      }}>
        <Typography variant="h6">{language === 'fr' ? 'Transfert' : 'Transfer'}</Typography>
        <Typography color="text.secondary">{language === 'fr' ? "Utilise l'élève, l'établissement et la classe sélectionnés dans le formulaire d'inscription." : 'Uses the student, school and classroom selected in the enrollment form.'}</Typography>
        <Button type="submit" variant="outlined" disabled={!student || !school}>{language === 'fr' ? `Transférer vers ${school?.label ?? 'un établissement'}` : `Transfer to ${school?.label ?? 'a school'}`}</Button>
      </Paper>
    </Stack>
  );
}

import { PersonOff, Refresh } from '@mui/icons-material';
import { Box, Button, LinearProgress, Paper, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { api, Student } from '../api';
import { useLanguage } from '../i18n';
import { studentDetailPath } from '../routes';
import { DataTable } from './DataTable';
import { EmptyState } from './WorkflowComponents';

export function StudentsPanel({
  can,
  onNavigate,
  onError,
}: {
  can: (permission: string) => boolean;
  onNavigate: (path: string) => void;
  onError: (value: string) => void;
}) {
  const language = useLanguage();
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [query, setQuery] = useState(initial.get('q') ?? '');
  const [page, setPage] = useState(Number(initial.get('page') ?? 1));
  const [data, setData] = useState<{ items: Student[]; total: number; page: number; page_size: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    try {
      setData(await api.students(`?q=${encodeURIComponent(query)}&page=${nextPage}&page_size=10`));
      setPage(nextPage);
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('page', String(nextPage));
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    } catch {
      onError(language === 'fr' ? 'Recherche des élèves refusée.' : 'Student search denied.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(page); }, []);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 2, alignItems: 'start' }}>
      <Stack sx={{ gap: 1.5 }}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void load(1); }}
            placeholder={language === 'fr' ? 'Recherche' : 'Search'}
          />
          <Button variant="contained" disabled={loading} startIcon={<Refresh />} onClick={() => void load(1)}>{language === 'fr' ? 'Rechercher' : 'Search'}</Button>
          <Button variant="outlined" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>{language === 'fr' ? 'Précédent' : 'Previous'}</Button>
          <Button variant="outlined" disabled={loading || Boolean(data && page * data.page_size >= data.total)} onClick={() => void load(page + 1)}>{language === 'fr' ? 'Suivant' : 'Next'}</Button>
        </Stack>
        {loading && <LinearProgress />}
        <Paper variant="outlined" sx={{ p: 2 }}>
          {data && data.items.length === 0 ? (
            <EmptyState
              icon={<PersonOff />}
              title={query ? (language === 'fr' ? 'Aucun élève correspondant' : 'No matching student') : (language === 'fr' ? 'Aucun élève enregistré' : 'No registered student')}
              description={query ? (language === 'fr' ? `Aucun résultat pour "${query}".` : `No results for "${query}".`) : (language === 'fr' ? "Créer le premier élève via le formulaire d'inscription." : 'Create the first student using the enrollment form.')}
              action={can('student:create') && !query ? <Button variant="contained" onClick={() => onNavigate('/students/new')}>{language === 'fr' ? 'Créer un élève' : 'Create student'}</Button> : undefined}
            />
          ) : (
            <DataTable rows={(data?.items ?? []).map((student) => ({
              id: student.id,
              matricule: student.student_number,
              nom: student.last_name,
              prenom: student.first_name,
              statut: student.status,
              ecole: student.current_school_id,
            }))} onRow={(row) => {
              const student = data?.items.find((item) => item.id === row.id);
              if (student) onNavigate(studentDetailPath(student.id));
            }} />
          )}
          <p>{data?.total ?? 0} {language === 'fr' ? 'résultat(s)' : 'result(s)'}</p>
        </Paper>
      </Stack>
    </Box>
  );
}

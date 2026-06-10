import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../i18n';
import { SlideOverPanel } from './WorkflowComponents';

type Props = { onError: (message: string) => void };

export function BackupsPage({ onError }: Props) {
  const language = useLanguage();
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [filters, setFilters] = useState({ event_type: '', status: '', period: '30d' });
  async function load() {
    const query = new URLSearchParams();
    if (filters.event_type) query.set('event_type', filters.event_type);
    if (filters.status) query.set('status', filters.status);
    const days = Number(filters.period.replace('d', '')) || 30;
    query.set('from', new Date(Date.now() - days * 86400000).toISOString());
    try {
      const [summaryRow, eventRows] = await Promise.all([api.backupSummary(), api.backups(`?${query}`)]);
      setSummary(summaryRow); setRows(eventRows);
    } catch { onError(language === 'fr' ? 'Lecture des sauvegardes refusée.' : 'Backup history access denied.'); }
  }
  useEffect(() => { void load(); }, [filters.event_type, filters.status, filters.period]);
  const age = summary.age_hours === null || summary.age_hours === undefined ? null : Number(summary.age_hours);
  const ageState = age === null ? 'missing' : age < 24 ? 'normal' : age <= 48 ? 'warning' : 'danger';
  const cards = [
    { label: language === 'fr' ? 'Dernière sauvegarde réussie' : 'Last successful backup', value: eventValue(summary.last_success), tone: 'normal' },
    { label: language === 'fr' ? 'Dernière vérification' : 'Last verification', value: eventValue(summary.last_verification), tone: 'normal' },
    { label: language === 'fr' ? 'Dernier échec' : 'Last failure', value: eventValue(summary.last_failure), tone: summary.last_failure ? 'danger' : 'normal' },
    { label: language === 'fr' ? 'Ancienneté' : 'Age', value: age === null ? '—' : `${age} h · ${ageState === 'normal' ? 'Normal' : ageState === 'warning' ? 'Attention' : 'Sauvegarde manquante'}`, tone: ageState },
  ];
  return <Stack spacing={2}>
    <div className="backupSummaryGrid">{cards.map((card) => <Paper key={card.label} className={`backupSummaryCard ${card.tone}`} variant="outlined"><Typography color="text.secondary">{card.label}</Typography><Typography variant="h6">{card.value}</Typography></Paper>)}</div>
    <Alert severity="info">Les opérations de sauvegarde, vérification et restauration s'effectuent exclusivement via les scripts PowerShell administratifs. Cette page est en lecture seule.</Alert>
    <Paper className="panel" variant="outlined">
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField select size="small" label={language === 'fr' ? 'Type' : 'Type'} value={filters.event_type} onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}><MenuItem value="">Tous</MenuItem>{['BACKUP_CREATED', 'BACKUP_VERIFIED', 'BACKUP_RESTORED', 'BACKUP_FAILED'].map((value) => <MenuItem key={value} value={value}>{backupType(value, language)}</MenuItem>)}</TextField>
        <TextField select size="small" label={language === 'fr' ? 'Statut' : 'Status'} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><MenuItem value="">Tous</MenuItem>{['SUCCESS', 'FAILED', 'CHECKSUM_OK', 'CHECKSUM_FAILED', 'CHECKSUM_ABSENT', 'RESTORE_COMPLETED', 'IN_PROGRESS'].map((value) => <MenuItem key={value} value={value}>{backupStatus(value, language)}</MenuItem>)}</TextField>
        <TextField select size="small" label={language === 'fr' ? 'Période' : 'Period'} value={filters.period} onChange={(e) => setFilters({ ...filters, period: e.target.value })}>{['7d', '30d', '90d'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      </Stack>
      <BackupTable rows={rows} onRow={setSelected} />
    </Paper>
    <SlideOverPanel open={Boolean(selected)} title={language === 'fr' ? 'Détail de l’événement' : 'Event detail'} onClose={() => setSelected(null)}>
      {selected && <Stack spacing={1}>{Object.entries(selected).map(([key, value]) => <Box key={key}><Typography variant="caption" color="text.secondary">{key}</Typography><Typography>{String(value ?? '—')}</Typography></Box>)}</Stack>}
    </SlideOverPanel>
  </Stack>;
}

function eventValue(value: unknown) {
  if (!value || typeof value !== 'object') return '—';
  const row = value as Record<string, unknown>;
  return `${String(row.status ?? '')} · ${new Date(String(row.finished_at ?? row.started_at)).toLocaleString()}`;
}

function backupType(value: string, language: 'fr' | 'en') {
  const labels: Record<string, [string, string]> = { BACKUP_CREATED: ['Sauvegarde', 'Backup'], BACKUP_VERIFIED: ['Vérification', 'Verification'], BACKUP_RESTORED: ['Restauration', 'Restoration'], BACKUP_FAILED: ['Opération échouée', 'Failed operation'] };
  return labels[value]?.[language === 'fr' ? 0 : 1] ?? value;
}

function backupStatus(value: string, language: 'fr' | 'en') {
  const labels: Record<string, [string, string]> = { SUCCESS: ['Réussie', 'Successful'], FAILED: ['Échouée', 'Failed'], CHECKSUM_OK: ['Empreinte vérifiée', 'Checksum verified'], CHECKSUM_FAILED: ['Empreinte invalide', 'Invalid checksum'], CHECKSUM_ABSENT: ['Empreinte absente', 'Missing checksum'], RESTORE_COMPLETED: ['Restauration journalisée', 'Restoration logged'], IN_PROGRESS: ['En cours', 'In progress'] };
  return labels[value]?.[language === 'fr' ? 0 : 1] ?? value;
}

function duration(row: Record<string, unknown>) {
  if (!row.started_at || !row.finished_at) return '—';
  const seconds = Math.max(0, Math.round((new Date(String(row.finished_at)).getTime() - new Date(String(row.started_at)).getTime()) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function BackupTable({ rows, onRow }: { rows: Array<Record<string, unknown>>; onRow: (row: Record<string, unknown>) => void }) {
  const language = useLanguage();
  const [sort, setSort] = useState('display_date');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const mapped = useMemo<Array<Record<string, unknown>>>(() => rows.map((row) => ({
    ...row,
    display_date: new Date(String(row.finished_at ?? row.started_at)).toLocaleString(),
    duration: duration(row),
  }) as Record<string, unknown>), [rows]);
  const columns = [
    ['display_date', 'Date/Heure'], ['event_type', 'Type'], ['status', 'Statut'],
    ['duration', 'Durée'], ['file_reference', 'Référence'],
    ['checksum_present', 'Empreinte'], ['operator', 'Opérateur'],
  ] as const;
  const filtered = mapped.filter((row) => columns.every(([key]) => {
    const filter = (filters[key] ?? '').trim().toLocaleLowerCase();
    return !filter || String(row[key] ?? '').toLocaleLowerCase().includes(filter);
  }));
  const sorted = [...filtered].sort((a, b) => {
    const comparison = String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), undefined, { numeric: true });
    return direction === 'asc' ? comparison : -comparison;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  if (!rows.length) return <Typography color="text.secondary">Aucun événement journalisé.</Typography>;
  return <Stack spacing={1}>
    <div className="tableScroller"><table><thead>
      <tr>{columns.map(([key, label]) => <th key={key}><button className="sortButton" onClick={() => { if (sort === key) setDirection(direction === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDirection('asc'); } }}>{label} {sort === key ? direction : ''}</button></th>)}</tr>
      <tr>{columns.map(([key]) => <th key={key}><input className="columnFilter" aria-label={`Filtrer ${key}`} value={filters[key] ?? ''} onChange={(event) => { setFilters({ ...filters, [key]: event.target.value }); setPage(1); }} /></th>)}</tr>
    </thead><tbody>{visibleRows.map((row) => <tr key={String(row.id)} onClick={() => onRow(row)}><td title={new Date(String(row.finished_at ?? row.started_at)).toISOString()}>{String(row.display_date)}</td><td><Chip size="small" label={backupType(String(row.event_type), language)} /></td><td><Chip size="small" color={String(row.status).includes('FAIL') ? 'error' : String(row.status).includes('ABSENT') ? 'warning' : 'success'} label={backupStatus(String(row.status), language)} /></td><td>{String(row.duration)}</td><td title={String(row.file_reference ?? '')}>{String(row.file_reference ?? '—').slice(0, 20)}</td><td>{row.checksum_present ? 'Présente' : 'Absente'}</td><td>{String(row.operator ?? row.created_by ?? 'Script')}</td></tr>)}</tbody></table></div>
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
      <Button size="small" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
      <Typography variant="caption">{currentPage} / {pages} · {sorted.length}</Typography>
      <Button size="small" disabled={currentPage >= pages} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
    </Stack>
  </Stack>;
}

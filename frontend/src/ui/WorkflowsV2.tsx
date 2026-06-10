import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { ContentCopy, Refresh, Security, Warning } from '@mui/icons-material';
import { Component, ReactNode, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { localizeField, localizeValue, useLanguage } from '../i18n';
import { EmptyState, SearchSelect, SelectOption, SlideOverPanel, useToast } from './WorkflowComponents';

function SimpleTable({ rows, onSelect, selectable, selectedIds = [], onToggle }: {
  rows: Array<Record<string, unknown>>;
  onSelect?: (row: Record<string, unknown>) => void;
  selectable?: boolean;
  selectedIds?: number[];
  onToggle?: (id: number) => void;
}) {
  const language = useLanguage();
  const keys = useMemo(() => Array.from(new Set(rows.flatMap(Object.keys))).filter((key) => !['description', 'timeline', 'details'].includes(key)).slice(0, 8), [rows]);
  if (!rows.length) return (
    <EmptyState
      title={language === 'fr' ? 'Aucun résultat' : 'No results'}
      description={language === 'fr' ? 'Modifiez les filtres ou créez un premier enregistrement.' : 'Adjust the filters or create the first record.'}
    />
  );
  return (
    <div className="tableScroller">
      <table role={onSelect ? 'grid' : 'table'}>
        <thead><tr>{selectable && <th aria-label="Sélection" />}{keys.map((key) => <th key={key}>{localizeField(language, key)}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => (
          <tr
            key={String(row.id ?? index)}
            role="row"
            aria-selected={selectable ? selectedIds.includes(Number(row.id)) : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={() => onSelect?.(row)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect?.(row); }}
          >
            {selectable && <td><Checkbox checked={selectedIds.includes(Number(row.id))} onClick={(event) => event.stopPropagation()} onChange={() => onToggle?.(Number(row.id))} /></td>}
            {keys.map((key) => <td key={key}>{localizeValue(language, row[key])}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function AuditLogPage({ onError }: { onError: (message: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [filters, setFilters] = useState({ eventType: '', actor: '', severity: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [verification, setVerification] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  async function load(nextPage = page) {
    setLoading(true);
    const query = new URLSearchParams({ page: String(nextPage), per_page: '50' });
    if (filters.eventType) query.set('event_type', filters.eventType);
    if (filters.actor) query.set('actor', filters.actor);
    if (filters.severity) query.set('severity', filters.severity);
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', `${filters.to}T23:59:59`);
    try {
      const response = await api.auditEvents(`?${query}`);
      if (Array.isArray(response)) {
        setRows(response); setTotal(response.length); setPages(1);
      } else {
        setRows(response.items); setTotal(response.total); setPages(response.pages);
      }
      setPage(nextPage);
    } catch { onError("Lecture du journal d'audit refusée."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(1); }, []);
  return (
    <Stack sx={{ gap: 2 }}>
      <Paper className="filterGrid" variant="outlined">
        <TextField label="Type d'événement" value={filters.eventType} onChange={(e) => setFilters({ ...filters, eventType: e.target.value })} placeholder="CARD, STUDENT, AUTH…" />
        <TextField label="Acteur" value={filters.actor} onChange={(e) => setFilters({ ...filters, actor: e.target.value })} />
        <TextField select label="Criticité" value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}><MenuItem value="">Toutes</MenuItem><MenuItem value="INFO">Info</MenuItem><MenuItem value="WARNING">Avertissement</MenuItem><MenuItem value="CRITICAL">Critique</MenuItem></TextField>
        <TextField type="date" label="Du" slotProps={{ inputLabel: { shrink: true } }} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <TextField type="date" label="Au" slotProps={{ inputLabel: { shrink: true } }} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <Button variant="contained" startIcon={<Refresh />} onClick={() => void load(1)}>Appliquer</Button>
      </Paper>
      <Paper className="panel" variant="outlined">
        <Typography variant="h6">{total.toLocaleString()} événements, page {page} sur {pages}</Typography>
        {loading && <LinearProgress />}
        <SimpleTable rows={rows} onSelect={(row) => { setSelected(row); setVerification(null); }} />
        <Stack direction="row" sx={{ gap: 1, mt: 2 }}>
          <Button disabled={loading || page <= 1} onClick={() => void load(page - 1)}>Précédent</Button>
          <Button disabled={loading || page >= pages} onClick={() => void load(page + 1)}>Suivant</Button>
        </Stack>
      </Paper>
      <SlideOverPanel open={Boolean(selected)} title="Détail de l'événement" onClose={() => setSelected(null)}>
        {selected && <Stack sx={{ gap: 2 }}>
          <SimpleTable rows={[selected]} />
          <Button startIcon={<ContentCopy />} onClick={() => navigator.clipboard.writeText(String(selected.event_hash ?? ''))}>Copier le hash</Button>
          <Button variant="contained" onClick={() => api.verifyAuditEvent(Number(selected.id)).then(setVerification).catch(() => onError("Vérification impossible."))}>Vérifier l'intégrité de cette entrée</Button>
          {verification && <Alert severity={verification.status === 'OK' ? 'success' : 'error'}>{String(verification.status)}</Alert>}
        </Stack>}
      </SlideOverPanel>
    </Stack>
  );
}

export function IntegrityCheckPage({ onNavigateIncident, onError }: { onNavigateIncident: () => void; onError: (message: string) => void }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [id, setId] = useState('');
  const [entry, setEntry] = useState<Record<string, unknown> | null>(null);
  const load = () => api.auditIntegrity().then(setResult).catch(() => onError("Vérification d'intégrité refusée."));
  useEffect(() => { void load(); }, []);
  const broken = result?.status === 'BROKEN';
  return (
    <Stack sx={{ gap: 2 }}>
      <Alert severity={broken ? 'error' : result ? 'success' : 'info'} icon={broken ? <Warning /> : <Security />}>
        <Typography variant="h6">{broken ? `${(result?.failures as unknown[] ?? []).length} rupture(s) détectée(s)` : result ? 'Chaîne intègre' : 'Vérification en cours…'}</Typography>
        {result && <Typography>{String(result.checked ?? 0)} événements vérifiés.</Typography>}
      </Alert>
      {broken && <Paper className="panel"><SimpleTable rows={(result?.failures ?? []) as Array<Record<string, unknown>>} /><Button color="error" variant="contained" onClick={onNavigateIncident}>Créer un incident de sécurité</Button></Paper>}
      <Paper className="panel formGrid">
        <TextField label="ID de l'entrée" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} />
        <Button disabled={!id} onClick={() => api.verifyAuditEvent(Number(id)).then(setEntry).catch(() => onError('Entrée introuvable.'))}>Vérifier cette entrée</Button>
        {entry && <Alert severity={entry.status === 'OK' ? 'success' : 'error'}>{String(entry.status)}</Alert>}
      </Paper>
    </Stack>
  );
}

export function AlertsPage({ onCreateIncident, onError }: { onCreateIncident: (alert: Record<string, unknown>) => void; onError: (message: string) => void }) {
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');
  async function load() { try { setRows(await api.alerts()); } catch { onError('Lecture des alertes refusée.'); } }
  useEffect(() => { void load(); }, []);
  const filtered = rows.filter((row) => !status || row.status === status);
  async function acknowledge() {
    if (!selected || comment.trim().length < 10) return;
    await api.acknowledgeAlert(Number(selected.id), comment);
    notify('Alerte acquittée.', 'success'); setComment(''); await load();
    setSelected((await api.alerts()).find((row) => row.id === selected.id) ?? null);
  }
  async function resolve() {
    if (!selected || comment.trim().length < 10) return;
    await api.resolveAlert(Number(selected.id), comment);
    notify('Alerte résolue.', 'success'); setComment(''); setSelected(null); await load();
  }
  return (
    <Stack sx={{ gap: 2 }}>
      <div className="statusFilters">{[['', 'Toutes'], ['OPEN', 'Ouvertes'], ['ACKNOWLEDGED', 'Acquittées'], ['RESOLVED', 'Résolues']].map(([value, label]) => <button className={status === value ? 'active' : ''} key={value} onClick={() => setStatus(value)}>{label}</button>)}</div>
      <Paper className="panel"><SimpleTable rows={filtered} onSelect={setSelected} /></Paper>
      <SlideOverPanel open={Boolean(selected)} title="Fiche d'alerte" onClose={() => setSelected(null)}>
        {selected && <Stack sx={{ gap: 2 }}>
          <Chip color={selected.severity === 'CRITICAL' ? 'error' : 'warning'} label={String(selected.severity)} />
          <SimpleTable rows={[selected]} />
          <Button onClick={() => onCreateIncident(selected)}>Créer un incident à partir de cette alerte</Button>
          {selected.status !== 'RESOLVED' && <TextField multiline minRows={4} label={selected.status === 'OPEN' ? "Commentaire d'acquittement" : 'Note de résolution'} value={comment} onChange={(e) => setComment(e.target.value)} helperText="10 caractères minimum" />}
          {selected.status === 'OPEN' && <Button variant="contained" disabled={comment.trim().length < 10} onClick={() => void acknowledge()}>Acquitter cette alerte</Button>}
          {selected.status === 'ACKNOWLEDGED' && <Button color="success" variant="contained" disabled={comment.trim().length < 10} onClick={() => void resolve()}>Résoudre l'alerte</Button>}
        </Stack>}
      </SlideOverPanel>
    </Stack>
  );
}

export function IncidentsPage({ canCreate, initialAlert, onError }: { canCreate: boolean; initialAlert?: Record<string, unknown> | null; onError: (message: string) => void }) {
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(Boolean(initialAlert));
  const [form, setForm] = useState({ title: '', category: 'UNAUTHORIZED_ACCESS', priority: 'MEDIUM', severity: 'MEDIUM', description: '', occurred_at: new Date().toISOString().slice(0, 16) });
  const [transition, setTransition] = useState('IN_PROGRESS');
  const [comment, setComment] = useState('');
  useEffect(() => {
    if (initialAlert) setForm({ title: `Alerte ${String(initialAlert.rule)}`, category: 'TECHNICAL_INCIDENT', priority: initialAlert.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH', severity: String(initialAlert.severity ?? 'HIGH'), description: String(initialAlert.description ?? initialAlert.rule ?? ''), occurred_at: new Date().toISOString().slice(0, 16) });
  }, [initialAlert]);
  async function load() { try { setRows(await api.incidents()); } catch { onError('Lecture des incidents refusée.'); } }
  useEffect(() => { void load(); }, []);
  async function select(row: Record<string, unknown>) { setSelected(row); setDetail(await api.incident(Number(row.id))); }
  async function create() {
    if (form.title.trim().length < 3 || form.description.trim().length < 30) return;
    await api.createIncident(form); notify('Incident créé.', 'success'); setOpen(false); await load();
  }
  async function applyTransition() {
    if (!detail || comment.trim().length < 5) return;
    await api.transitionIncident(Number(detail.id), transition, comment); notify('Statut mis à jour.', 'success'); setComment('');
    setDetail(await api.incident(Number(detail.id))); await load();
  }
  return (
    <Stack sx={{ gap: 2 }}>
      {canCreate && <Button variant="contained" onClick={() => setOpen(true)}>Créer un incident</Button>}
      <Paper className="panel"><SimpleTable rows={rows.map((row) => ({ ...row, age_hours: Math.round((Date.now() - new Date(String(row.created_at)).getTime()) / 3600000) }))} onSelect={(row) => void select(row)} /></Paper>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Nouvel incident</DialogTitle>
        <DialogContent><Stack sx={{ gap: 2, mt: 1 }}>
          <TextField required label="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField select label="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['DATA_BREACH', 'CARD_FRAUD', 'UNAUTHORIZED_ACCESS', 'INTEGRITY_BREACH', 'TECHNICAL_INCIDENT', 'ATTENDANCE_INCIDENT', 'OTHER'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
          <Stack direction="row" sx={{ gap: 2 }}><TextField fullWidth select label="Priorité" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField fullWidth type="datetime-local" label="Date" slotProps={{ inputLabel: { shrink: true } }} value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} /></Stack>
          <TextField required multiline minRows={5} label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} helperText="30 caractères minimum" />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Annuler</Button><Button variant="contained" disabled={form.description.trim().length < 30} onClick={() => void create()}>Créer</Button></DialogActions>
      </Dialog>
      <SlideOverPanel open={Boolean(selected)} title={String(detail?.title ?? 'Incident')} onClose={() => { setSelected(null); setDetail(null); }}>
        {detail && <Stack sx={{ gap: 2 }}>
          <SimpleTable rows={[{ catégorie: detail.category, priorité: detail.priority, statut: detail.status, affecté_à: detail.assigned_to, ouvert_le: detail.created_at }]} />
          <Typography>{String(detail.description ?? '')}</Typography>
          <div className="timeline">{((detail.timeline ?? []) as Array<Record<string, unknown>>).map((event) => <article key={String(event.id)}><span /><div><strong>{String(event.event_type)}</strong><small>{new Date(String(event.created_at)).toLocaleString()}</small><p>{String(event.comment ?? '')} · {String(event.actor ?? '')}</p></div></article>)}</div>
          {detail.status !== 'CLOSED' && <><TextField select label="Nouveau statut" value={transition} onChange={(e) => setTransition(e.target.value)}>{['IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField multiline minRows={3} label="Commentaire obligatoire" value={comment} onChange={(e) => setComment(e.target.value)} /><Button variant="contained" disabled={comment.trim().length < 5} onClick={() => void applyTransition()}>Changer le statut</Button></>}
        </Stack>}
      </SlideOverPanel>
    </Stack>
  );
}

export function SessionsManagementPage({ onError }: { onError: (message: string) => void }) {
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() { try { setRows(await api.sessions()); } catch { onError('Lecture des sessions refusée.'); } }
  useEffect(() => { void load(); }, []);
  return <Stack sx={{ gap: 2 }}><Paper className="panel"><Typography variant="h6">Sessions actives ({rows.length})</Typography><div className="sessionList">{rows.map((row) => <article key={String(row.session_id)}><div><strong>{String(row.user_agent)}</strong><p>IP : {String(row.ip_address ?? 'Non disponible')}</p><small>Ouverture : {new Date(String(row.created_at)).toLocaleString()} · Dernière activité : {new Date(String(row.last_active_at)).toLocaleString()}</small></div>{row.is_current ? <Chip label="Session courante" color="success" /> : <Button color="error" onClick={() => api.revokeSession(String(row.session_id)).then(() => { notify('Session révoquée.', 'success'); return load(); })}>Révoquer</Button>}</article>)}</div></Paper><Button color="error" disabled={rows.length < 2} onClick={() => api.revokeOtherSessions().then(() => { notify('Autres sessions révoquées.', 'success'); return load(); })}>Révoquer toutes les autres sessions</Button></Stack>;
}

export function ServiceManagementPage({ canManage, onError }: { canManage: boolean; onError: (message: string) => void }) {
  const notify = useToast();
  const [tab, setTab] = useState(0);
  const [services, setServices] = useState<Array<Record<string, unknown>>>([]);
  const [providers, setProviders] = useState<Array<Record<string, unknown>>>([]);
  const [students, setStudents] = useState<SelectOption[]>([]);
  const [student, setStudent] = useState<SelectOption | null>(null);
  const [service, setService] = useState<SelectOption | null>(null);
  const [provider, setProvider] = useState<SelectOption | null>(null);
  const [eligibility, setEligibility] = useState<Record<string, unknown> | null>(null);
  const [serviceForm, setServiceForm] = useState({ name: '', code: '', category: 'CATERING', description: '', icon: 'restaurant', active: true });
  const [providerForm, setProviderForm] = useState({ name: '', code: '', provider_type: 'RESTAURANT', contact: '', phone: '', active: true, school_ids: [] as number[] });
  async function load() {
    try {
      const [serviceRows, providerRows, studentRows] = await Promise.all([api.serviceTypes(), api.serviceProviders(), api.students('?page=1&page_size=100')]);
      setServices(serviceRows); setProviders(providerRows);
      setStudents(studentRows.items.map((row) => ({ id: row.id, label: `${row.first_name} ${row.last_name}`, subtitle: row.student_number, raw: row as unknown as Record<string, unknown> })));
    } catch { onError('Chargement des services refusé.'); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (student && service) api.checkEntitlement(student.id, service.id).then(setEligibility).catch(() => setEligibility(null)); }, [student, service]);
  const serviceOptions = services.map((row) => ({ id: Number(row.id), label: String(row.label), subtitle: String(row.category ?? row.code), raw: row }));
  const providerOptions = providers.map((row) => ({ id: Number(row.id), label: String(row.name), subtitle: String(row.provider_type), raw: row }));
  return <Stack sx={{ gap: 2 }}><Tabs value={tab} onChange={(_, value) => setTab(value)}><Tab label="Attribution et droits" /><Tab label="Types de services" /><Tab label="Fournisseurs" /></Tabs>
    {tab === 0 && <Paper className="panel formGrid"><SearchSelect label="Élève" options={students} value={student} onChange={setStudent} /><SearchSelect label="Service" options={serviceOptions} value={service} onChange={setService} /><SearchSelect label="Fournisseur" options={providerOptions} value={provider} onChange={setProvider} />{eligibility && <Alert severity={eligibility.eligible ? 'success' : 'warning'}>{eligibility.eligible ? 'Élève éligible à ce service.' : `Avertissement : ${String(eligibility.reason ?? 'inéligible')}`}</Alert>}<Button variant="contained" disabled={!student || !service || !provider || !canManage} onClick={() => api.createEntitlement({ student_id: student?.id, service_type_id: service?.id, service_provider_id: provider?.id, valid_from: new Date().toISOString(), status: 'ACTIVE', notes: 'Attribution administrative' }).then(() => notify('Droit attribué.', 'success')).catch(() => onError('Attribution refusée.'))}>Attribuer le droit</Button></Paper>}
    {tab === 1 && <Stack sx={{ gap: 2 }}><Paper className="panel"><SimpleTable rows={services} /></Paper>{canManage && <Paper className="panel formGrid"><TextField label="Nom" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} /><TextField label="Code" value={serviceForm.code} onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value.toUpperCase().replace(/\s/g, '_') })} /><TextField select label="Catégorie" value={serviceForm.category} onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}>{['CATERING', 'SPORT', 'INSURANCE', 'SOCIAL', 'EVENT', 'OTHER'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField><TextField multiline label="Description" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} /><Button variant="contained" onClick={() => api.createServiceType({ ...serviceForm, rules: {}, calendar: {}, limits: {} }).then(() => { notify('Type de service créé.', 'success'); return load(); })}>Créer</Button></Paper>}</Stack>}
    {tab === 2 && <Stack sx={{ gap: 2 }}><Paper className="panel"><SimpleTable rows={providers} /></Paper>{canManage && <Paper className="panel formGrid"><TextField label="Nom" value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} /><TextField label="Code" value={providerForm.code} onChange={(e) => setProviderForm({ ...providerForm, code: e.target.value.toUpperCase().replace(/\s/g, '_') })} /><TextField label="Type" value={providerForm.provider_type} onChange={(e) => setProviderForm({ ...providerForm, provider_type: e.target.value })} /><TextField label="Contact" value={providerForm.contact} onChange={(e) => setProviderForm({ ...providerForm, contact: e.target.value })} /><TextField label="Téléphone fictif" value={providerForm.phone} onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value })} /><Button variant="contained" onClick={() => api.createServiceProvider(providerForm).then(() => { notify('Fournisseur créé.', 'success'); return load(); })}>Créer</Button></Paper>}</Stack>}
  </Stack>;
}

export function PaymentsManagementPage({ canCreate, canReconcile, onError }: { canCreate: boolean; canReconcile: boolean; onError: (message: string) => void }) {
  const notify = useToast();
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [years, setYears] = useState<SelectOption[]>([]);
  const [students, setStudents] = useState<SelectOption[]>([]);
  const [school, setSchool] = useState<SelectOption | null>(null);
  const [year, setYear] = useState<SelectOption | null>(null);
  const [student, setStudent] = useState<SelectOption | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState<{ provider_code: string; category: string; amount: string; simulation_result: string; external_reference: string; notes: string; idempotency_key: string }>({
    provider_code: 'MOCK_MOMO',
    category: 'TUITION',
    amount: '7500',
    simulation_result: 'SUCCESS',
    external_reference: '',
    notes: '',
    idempotency_key: crypto.randomUUID(),
  });
  const [comment, setComment] = useState('');
  async function load() { try { setRows(await api.payments()); } catch { onError('Lecture des paiements refusée.'); } }
  useEffect(() => { Promise.all([api.schools(), api.schoolYears(), api.students('?page=1&page_size=100')]).then(([s, y, st]) => { setSchools(s.map((r) => ({ id: Number(r.school_id ?? r.id), label: String(r.school ?? r.name), raw: r }))); setYears(y.map((r) => ({ id: Number(r.id), label: String(r.code), raw: r }))); setStudents(st.items.map((r) => ({ id: r.id, label: `${r.first_name} ${r.last_name}`, subtitle: r.student_number, raw: r as unknown as Record<string, unknown> }))); }); void load(); }, []);
  async function create() {
    if (!school || !year) return;
    await api.mockPayment({ ...form, amount: Number(form.amount), school_id: school.id, school_year_id: year.id, student_id: student?.id, reason: form.notes || 'Simulation de paiement locale' });
    notify('Transaction simulée créée.', 'success'); setForm({ ...form, idempotency_key: crypto.randomUUID() }); await load();
  }
  return <Stack sx={{ gap: 2 }}><Tabs value={tab} onChange={(_, value) => setTab(value)}><Tab label="Transactions" /><Tab label="Rapprochements" /></Tabs>
    {tab === 0 && <><Paper className="panel"><SimpleTable rows={rows} /></Paper>{canCreate && <Paper className="panel formGrid"><SearchSelect label="Établissement" options={schools} value={school} onChange={setSchool} /><SearchSelect label="Année scolaire" options={years} value={year} onChange={setYear} /><SearchSelect label="Élève (facultatif)" options={students} value={student} onChange={setStudent} /><TextField select label="Fournisseur mock" value={form.provider_code} onChange={(e) => setForm({ ...form, provider_code: e.target.value })}>{['MOCK_MOMO', 'MOCK_ORANGE', 'MOCK_BANK', 'MOCK_CASH'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField><TextField label="Montant XAF" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><TextField select label="Simulation" value={form.simulation_result} onChange={(e) => setForm({ ...form, simulation_result: e.target.value })}>{['SUCCESS', 'NETWORK_ERROR', 'TIMEOUT', 'INSUFFICIENT_FUNDS', 'DUPLICATE'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField><TextField label="Clé d'idempotence" value={form.idempotency_key} onChange={(e) => setForm({ ...form, idempotency_key: e.target.value })} /><TextField multiline label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><Button variant="contained" disabled={!school || !year || Number(form.amount) < 100} onClick={() => void create()}>Créer la transaction</Button></Paper>}</>}
    {tab === 1 && <Paper className="panel"><SimpleTable rows={rows.filter((row) => row.status === 'PENDING')} selectable selectedIds={selectedIds} onToggle={(id) => setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id])} /><TextField fullWidth sx={{ mt: 2 }} multiline label="Commentaire de rapprochement" value={comment} onChange={(e) => setComment(e.target.value)} /><Button sx={{ mt: 1 }} variant="contained" disabled={!canReconcile || !selectedIds.length || comment.trim().length < 3} onClick={() => api.reconcilePaymentsBatch(selectedIds, 'SUCCESS', comment).then(() => { notify('Rapprochement en lot terminé.', 'success'); setSelectedIds([]); setComment(''); return load(); })}>Rapprocher la sélection</Button></Paper>}
  </Stack>;
}

export function ControlledExportsPage({ canCreate, canDownload, onError }: { canCreate: boolean; canDownload: boolean; onError: (message: string) => void }) {
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [school, setSchool] = useState<SelectOption | null>(null);
  const [form, setForm] = useState({ export_type: 'STUDENTS', format: 'CSV', reason: '', confirmed: false, from: '', to: '' });
  async function load() { try { setRows(await api.exports()); } catch { onError('Lecture des exports refusée.'); } }
  useEffect(() => { api.schools().then((items) => setSchools(items.map((r) => ({ id: Number(r.school_id ?? r.id), label: String(r.school ?? r.name), raw: r })))); void load(); }, []);
  async function create() {
    await api.createExport({ export_type: form.export_type, format: form.format, reason: form.reason, filters: { school_id: school?.id, start_date: form.from || undefined, end_date: form.to || undefined } });
    notify('Export généré et placé dans le stockage sécurisé.', 'success'); await load();
  }
  return <Stack sx={{ gap: 2 }}>{canCreate && <Paper className="panel formGrid"><TextField select label="Type de données" value={form.export_type} onChange={(e) => setForm({ ...form, export_type: e.target.value })}>{['STUDENTS', 'CARDS', 'ATTENDANCE', 'SERVICES', 'PAYMENTS', 'AUDIT', 'ANOMALIES'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField><SearchSelect label="Établissement (facultatif)" options={schools} value={school} onChange={setSchool} /><TextField select label="Format" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>{['CSV', 'JSON', 'XLSX'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField><TextField type="date" label="Du" slotProps={{ inputLabel: { shrink: true } }} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /><TextField type="date" label="Au" slotProps={{ inputLabel: { shrink: true } }} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /><TextField multiline minRows={3} label="Motif obligatoire" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} helperText="20 caractères minimum" /><FormControlLabel control={<Checkbox checked={form.confirmed} onChange={(e) => setForm({ ...form, confirmed: e.target.checked })} />} label="Je confirme l'usage professionnel et contrôlé de cet export." /><Button variant="contained" disabled={!form.confirmed || form.reason.trim().length < 20} onClick={() => void create()}>Demander l'export</Button></Paper>}<Paper className="panel"><SimpleTable rows={rows} onSelect={(row) => { if (canDownload && ['READY', 'DOWNLOADED'].includes(String(row.status))) window.location.href = `/api/v1/exports/${row.id}/download`; }} /><Typography variant="caption">Sélectionnez un export prêt pour le télécharger.</Typography></Paper></Stack>;
}

export function AdministrativeValidationsPage({ onError }: { onError: (message: string) => void }) {
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [comment, setComment] = useState('');
  async function load() {
    try { setRows(await api.pendingValidations()); }
    catch { onError('Lecture des validations administratives refusee.'); }
  }
  useEffect(() => { void load(); }, []);
  async function decide(decision: 'approve' | 'reject') {
    if (!selected || comment.trim().length < 5) return;
    if (decision === 'approve') await api.approveValidation(Number(selected.id), comment);
    else await api.rejectValidation(Number(selected.id), comment);
    notify(decision === 'approve' ? 'Validation approuvee.' : 'Validation rejetee.', 'success');
    setSelected(null);
    setComment('');
    await load();
  }
  return (
    <Stack sx={{ gap: 2 }}>
      <Alert severity="info">
        Les demandes sont traitees par le niveau hierarchique parent. Chaque decision est journalisee.
      </Alert>
      <Paper className="panel" variant="outlined">
        <SimpleTable rows={rows} onSelect={setSelected} />
      </Paper>
      <SlideOverPanel open={Boolean(selected)} title="Validation administrative" onClose={() => setSelected(null)}>
        {selected && (
          <Stack sx={{ gap: 2 }}>
            <SimpleTable rows={[selected]} />
            <TextField
              multiline
              minRows={4}
              label="Commentaire ou motif"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              helperText="5 caracteres minimum"
            />
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button variant="contained" color="success" disabled={comment.trim().length < 5} onClick={() => void decide('approve')}>Approuver</Button>
              <Button variant="contained" color="error" disabled={comment.trim().length < 5} onClick={() => void decide('reject')}>Rejeter</Button>
            </Stack>
          </Stack>
        )}
      </SlideOverPanel>
    </Stack>
  );
}

export function AcademicLevelsPage({ canManage, onError }: { canManage: boolean; onError: (message: string) => void }) {
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    try { setRows(await api.gradeLevels()); }
    catch { onError('Lecture des niveaux scolaires refusee.'); }
  }
  useEffect(() => { void load(); }, []);
  async function toggle(row: Record<string, unknown>) {
    try {
      await api.updateGradeLevel(Number(row.id), !row.active);
      notify('Niveau scolaire mis a jour.', 'success');
      await load();
    } catch {
      onError('Ce niveau est utilise par une classe active ou la modification est interdite.');
    }
  }
  return (
    <Paper className="panel" variant="outlined">
      <Typography variant="h6" sx={{ mb: 2 }}>Niveaux scolaires</Typography>
      <SimpleTable rows={rows} onSelect={canManage ? (row) => void toggle(row) : undefined} />
      {canManage && <Typography variant="caption">Selectionnez une ligne pour activer ou desactiver un niveau non utilise.</Typography>}
    </Paper>
  );
}

export function PrivacyGovernancePage({ canManage, onError }: { canManage: boolean; onError: (message: string) => void }) {
  const notify = useToast();
  const [tab, setTab] = useState(0);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [register, setRegister] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [comment, setComment] = useState('');
  const [transitionStatus, setTransitionStatus] = useState('IN_PROGRESS');
  const [students, setStudents] = useState<SelectOption[]>([]);
  const [portabilityStudent, setPortabilityStudent] = useState<SelectOption | null>(null);
  const [portabilityReason, setPortabilityReason] = useState('');
  const [form, setForm] = useState({ request_type: 'ACCESS', subject_type: 'STUDENT', subject_last_name: '', subject_first_name: '', request_object: '' });
  async function load() {
    try {
      const [requestRows, registerRows, studentRows] = await Promise.all([api.privacyRequests(), api.processingRegister(), api.students('?page=1&page_size=100')]);
      setRequests(requestRows);
      setRegister(registerRows);
      setStudents(studentRows.items.map((student) => ({ id: student.id, label: `${student.first_name} ${student.last_name}`, subtitle: student.student_number, raw: student as unknown as Record<string, unknown> })));
    } catch { onError('Lecture des donnees de gouvernance refusee.'); }
  }
  useEffect(() => { void load(); }, []);
  return (
    <Stack sx={{ gap: 2 }}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label="Demandes de donnees" />
        <Tab label="Registre des traitements" />
      </Tabs>
      {tab === 0 && (
        <Stack sx={{ gap: 2 }}>
          {canManage && (
            <Paper className="panel formGrid">
              <TextField select label="Type de demande" value={form.request_type} onChange={(event) => setForm({ ...form, request_type: event.target.value })}>
                {['ACCESS', 'RECTIFICATION', 'RESTRICTION', 'DELETION', 'PORTABILITY'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
              </TextField>
              <TextField label="Nom fictif" value={form.subject_last_name} onChange={(event) => setForm({ ...form, subject_last_name: event.target.value })} />
              <TextField label="Prenom fictif" value={form.subject_first_name} onChange={(event) => setForm({ ...form, subject_first_name: event.target.value })} />
              <TextField multiline minRows={3} label="Objet de la demande" value={form.request_object} onChange={(event) => setForm({ ...form, request_object: event.target.value })} />
              <Button variant="contained" disabled={form.request_object.trim().length < 5} onClick={() => api.createPrivacyRequest(form).then(() => { notify('Demande enregistree.', 'success'); return load(); })}>Enregistrer</Button>
            </Paper>
          )}
          {canManage && (
            <Paper className="panel formGrid">
              <Typography variant="h6">Export de portabilite signe</Typography>
              <SearchSelect label="Eleve" options={students} value={portabilityStudent} onChange={setPortabilityStudent} />
              <TextField multiline minRows={3} label="Motif obligatoire" value={portabilityReason} onChange={(event) => setPortabilityReason(event.target.value)} />
              <Button
                variant="contained"
                disabled={!portabilityStudent || portabilityReason.trim().length < 20}
                onClick={() => api.portabilityExport(portabilityStudent!.id, portabilityReason).then(({ blob, filename }) => {
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = filename;
                  anchor.click();
                  URL.revokeObjectURL(url);
                  notify('Export de portabilite genere et signe.', 'success');
                }).catch(() => onError("Generation de l'export de portabilite refusee."))}
              >
                Generer l'export signe
              </Button>
            </Paper>
          )}
          <Paper className="panel"><SimpleTable rows={requests} onSelect={setSelected} /></Paper>
          <SlideOverPanel open={Boolean(selected)} title="Traitement de la demande" onClose={() => setSelected(null)}>
            {selected && <Stack sx={{ gap: 2 }}><SimpleTable rows={[selected]} /><TextField select label="Nouveau statut" value={transitionStatus} onChange={(event) => setTransitionStatus(event.target.value)}>{['IN_PROGRESS', 'COMPLETED', 'CLOSED', 'REJECTED'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField multiline label="Commentaire" value={comment} onChange={(event) => setComment(event.target.value)} /><Button disabled={!canManage || comment.trim().length < 5} onClick={() => api.transitionPrivacyRequest(Number(selected.id), transitionStatus, comment).then(() => { notify('Demande mise a jour.', 'success'); setSelected(null); setComment(''); return load(); })}>Appliquer la transition</Button></Stack>}
          </SlideOverPanel>
        </Stack>
      )}
      {tab === 1 && <Paper className="panel"><SimpleTable rows={register} /></Paper>}
    </Stack>
  );
}

export function RetentionRulesPage({ canManage, onError }: { canManage: boolean; onError: (message: string) => void }) {
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({ name: '', resource_type: '', trigger_type: 'CREATED_AT', retention_period_days: '365', duration_unit: 'DAYS' });
  async function load() {
    try { setRows(await api.retentionRules()); }
    catch { onError('Lecture des regles de retention refusee.'); }
  }
  useEffect(() => { void load(); }, []);
  return (
    <Stack sx={{ gap: 2 }}>
      {canManage && (
        <Paper className="panel formGrid">
          <TextField label="Nom de la regle" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextField label="Ressource" value={form.resource_type} onChange={(event) => setForm({ ...form, resource_type: event.target.value })} />
          <TextField select label="Declencheur" value={form.trigger_type} onChange={(event) => setForm({ ...form, trigger_type: event.target.value })}>
            {['CREATED_AT', 'ARCHIVED_AT', 'CLOSED_AT'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField type="number" label="Duree en jours" value={form.retention_period_days} onChange={(event) => setForm({ ...form, retention_period_days: event.target.value })} />
          <Button variant="contained" disabled={!form.name || !form.resource_type || Number(form.retention_period_days) < 1} onClick={() => api.createRetentionRule({ ...form, retention_period_days: Number(form.retention_period_days) }).then(() => { notify('Regle de retention creee.', 'success'); return load(); })}>Creer la regle</Button>
        </Paper>
      )}
      <Paper className="panel"><SimpleTable rows={rows} /></Paper>
    </Stack>
  );
}

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <ErrorPage code={500} detail={this.state.error.message} onBack={() => { this.setState({ error: null }); window.location.href = '/dashboard'; }} />;
    return this.props.children;
  }
}

export function ErrorPage({ code, detail, onBack }: { code: 403 | 404 | 500; detail?: string; onBack: () => void }) {
  const titles = { 403: 'Accès refusé', 404: 'Page introuvable', 500: 'Erreur serveur' };
  return <main className="errorPage"><Paper className="panel"><Typography variant="h3">{titles[code]}</Typography><Typography>{detail ?? (code === 403 ? "Vous n'avez pas les permissions nécessaires pour accéder à cette page." : code === 404 ? "La page demandée n'existe pas." : "Une erreur inattendue s'est produite.")}</Typography><Button variant="contained" onClick={onBack}>Retour au tableau de bord</Button></Paper></main>;
}

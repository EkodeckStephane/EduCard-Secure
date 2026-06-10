import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowLeft, Archive, CreditCard, MoreVertical, Upload } from 'lucide-react';
import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { api, ApiError, Student } from '../api';
import { useLanguage } from '../i18n';
import { CardLifecycleTimeline, DigitalCardView, SearchSelect, SelectOption, useToast } from './WorkflowComponents';

type Props = {
  studentId: number;
  permissions: string[];
  roles: string[];
  onBack: () => void;
  onNavigate: (path: string) => void;
  onError: (message: string) => void;
};

type TabKey = 'summary' | 'identity' | 'enrollment' | 'card' | 'services' | 'history' | 'duplicates' | 'audit';

const studentStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'WITHDRAWN'] as const;

export function StudentDetailPage({ studentId, permissions, roles, onBack, onNavigate, onError }: Props) {
  const language = useLanguage();
  const notify = useToast();
  const can = (permission: string) => permissions.includes(permission);
  const auditVisible = roles.some((role) => ['SUPER_ADMIN_TECHNIQUE', 'AUDITEUR_SECURITE', 'ADMINISTRATION_CENTRALE'].includes(role));
  const initialTab = (new URLSearchParams(window.location.search).get('tab') ?? 'summary') as TabKey;
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [student, setStudent] = useState<Student | null>(null);
  const [cache, setCache] = useState<Record<string, unknown>>({});
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  async function loadStudent() {
    try {
      const row = await api.student(studentId);
      setStudent(row);
      setCache((current) => ({ ...current, summary: row }));
    } catch {
      onError(language === 'fr' ? 'Lecture de la fiche élève refusée.' : 'Student record access denied.');
    }
  }

  useEffect(() => { void loadStudent(); }, [studentId]);
  useEffect(() => {
    api.studentDuplicates(studentId).then((rows) => setDuplicatesCount(rows.length)).catch(() => setDuplicatesCount(0));
  }, [studentId]);

  function selectTab(next: TabKey) {
    setTab(next);
    const query = new URLSearchParams(window.location.search);
    query.set('tab', next);
    window.history.replaceState({}, '', `${window.location.pathname}?${query}`);
  }

  async function loadCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    if (cache[key] !== undefined) return cache[key] as T;
    const value = await loader();
    setCache((current) => ({ ...current, [key]: value }));
    return value;
  }

  function invalidate(...keys: string[]) {
    setCache((current) => {
      const next = { ...current };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  }

  if (!student) return <Paper className="panel"><Typography>{language === 'fr' ? 'Chargement de la fiche…' : 'Loading record…'}</Typography></Paper>;
  const enrollment = student.current_enrollment ?? {};

  const tabs: Array<{ key: TabKey; label: string; visible: boolean }> = [
    { key: 'summary', label: language === 'fr' ? 'Synthèse' : 'Summary', visible: true },
    { key: 'identity', label: language === 'fr' ? 'Identité' : 'Identity', visible: can('student:update') },
    { key: 'enrollment', label: language === 'fr' ? 'Parcours' : 'Enrollment', visible: true },
    { key: 'card', label: language === 'fr' ? 'Carte' : 'Card', visible: can('card:verify') || can('card:issue') },
    { key: 'services', label: language === 'fr' ? 'Services' : 'Services', visible: can('service:verify') },
    { key: 'history', label: language === 'fr' ? 'Historique' : 'History', visible: true },
    { key: 'duplicates', label: language === 'fr' ? 'Doublons' : 'Duplicates', visible: true },
    { key: 'audit', label: 'Audit', visible: auditVisible && can('audit:read') },
  ];

  return (
    <Stack spacing={2}>
      <Paper className="panel studentDetailHeader" variant="outlined">
        <Button startIcon={<ArrowLeft size={18} />} onClick={onBack}>{language === 'fr' ? 'Retour aux élèves' : 'Back to students'}</Button>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <Box className="studentDetailPhoto">
            <img src={`/api/v1/students/${student.id}/photo`} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
            <span>{student.first_name[0]}{student.last_name[0]}</span>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h5">{student.last_name} {student.first_name}</Typography>
              <Chip size="small" color={student.status === 'ACTIVE' ? 'success' : student.status === 'ARCHIVED' ? 'default' : 'warning'} label={student.status} />
            </Stack>
            <Typography color="text.secondary">{language === 'fr' ? 'Matricule' : 'Student number'} : {student.student_number}</Typography>
            <Typography>{String(enrollment.school_name ?? '—')} · {String(enrollment.classroom_label ?? '—')} · {String(enrollment.school_year ?? '—')}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {can('card:issue') && student.status === 'ACTIVE' && (
              <Button startIcon={<CreditCard size={17} />} variant="contained" onClick={() => api.requestCard(student.id).then(() => {
                notify(language === 'fr' ? 'Demande de carte créée.' : 'Card request created.', 'success');
                invalidate('cards', 'summary');
              }).catch(() => onError(language === 'fr' ? 'Demande de carte refusée.' : 'Card request denied.'))}>
                {language === 'fr' ? 'Demander une carte' : 'Request card'}
              </Button>
            )}
            {can('student:archive') && student.status !== 'ARCHIVED' && (
              <Button color="warning" startIcon={<Archive size={17} />} onClick={() => setArchiveOpen(true)}>
                {language === 'fr' ? 'Archiver' : 'Archive'}
              </Button>
            )}
            <Button aria-label={language === 'fr' ? 'Plus d’actions' : 'More actions'} onClick={(event) => setMenuAnchor(event.currentTarget)}><MoreVertical size={20} /></Button>
          </Stack>
        </Stack>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          {can('student:update') && <MenuItem onClick={() => { selectTab('identity'); setMenuAnchor(null); }}>{language === 'fr' ? 'Modifier le statut' : 'Change status'}</MenuItem>}
          {can('student:update') && <MenuItem onClick={() => onNavigate(`/scolarite/inscriptions?student_id=${student.id}&mode=transfer`)}>{language === 'fr' ? 'Lancer un transfert' : 'Start transfer'}</MenuItem>}
          {can('student:export') && <MenuItem onClick={() => window.open(`/api/v1/students/${student.id}/export`, '_blank')}>{language === 'fr' ? 'Exporter la fiche' : 'Export record'}</MenuItem>}
        </Menu>
      </Paper>

      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, value) => selectTab(value)} variant="scrollable" scrollButtons="auto">
          {tabs.filter((item) => item.visible).map((item) => (
            <Tab key={item.key} value={item.key} label={item.key === 'duplicates' ? <Badge color="error" badgeContent={duplicatesCount}>{item.label}</Badge> : item.label} />
          ))}
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === 'summary' && <StudentSummary student={student} onTab={selectTab} />}
          {tab === 'identity' && <StudentIdentity student={student} onSaved={(next) => { setStudent(next); invalidate('summary'); }} onError={onError} />}
          {tab === 'enrollment' && <StudentEnrollment student={student} loadCached={loadCached} invalidate={invalidate} onReload={loadStudent} onNavigate={onNavigate} onError={onError} />}
          {tab === 'card' && <StudentCards student={student} canIssue={can('card:issue')} loadCached={loadCached} invalidate={invalidate} onError={onError} />}
          {tab === 'services' && <StudentServices student={student} canManage={can('service:manage')} loadCached={loadCached} onError={onError} />}
          {tab === 'history' && <StudentHistory student={student} loadCached={loadCached} />}
          {tab === 'duplicates' && <StudentDuplicates student={student} loadCached={loadCached} invalidate={invalidate} onCount={setDuplicatesCount} onError={onError} />}
          {tab === 'audit' && auditVisible && <StudentAudit student={student} loadCached={loadCached} />}
        </Box>
      </Paper>
      <ArchiveDialog
        student={student}
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onArchived={(next) => {
          setStudent(next);
          invalidate('summary', 'enrollments', 'cards', 'services', 'history');
          notify(language === 'fr' ? 'Dossier archivé. Les opérations actives ont été suspendues.' : 'Record archived. Active operations were suspended.', 'success');
        }}
      />
    </Stack>
  );
}

function StudentSummary({ student, onTab }: { student: Student; onTab: (tab: TabKey) => void }) {
  const language = useLanguage();
  const enrollment = student.current_enrollment ?? {};
  const guardian = student.guardian ?? {};
  return (
    <div className="studentSummaryGrid">
      <SummaryBlock title={language === 'fr' ? 'Identité' : 'Identity'}>
        <p>{student.first_name} {student.last_name}</p><p>{student.birth_date}</p><p>{student.gender ?? '—'}</p>
        <p>{String(guardian.display_name ?? '—')} · {String(guardian.contact_masked ?? '—')}</p>
      </SummaryBlock>
      <SummaryBlock title={language === 'fr' ? 'Scolarité courante' : 'Current enrollment'}>
        <p>{String(enrollment.school_name ?? '—')}</p><p>{String(enrollment.classroom_label ?? '—')}</p><p>{String(enrollment.school_year ?? '—')} · {String(enrollment.status ?? '—')}</p>
      </SummaryBlock>
      <SummaryBlock title={language === 'fr' ? 'Carte' : 'Card'}>
        <Chip size="small" label={student.active_card_status ?? (language === 'fr' ? 'Aucune' : 'None')} />
        <Button size="small" onClick={() => onTab('card')}>{language === 'fr' ? 'Voir la carte' : 'View card'}</Button>
      </SummaryBlock>
      <SummaryBlock title="Services">
        <Typography variant="h4">{student.active_services_count ?? 0}</Typography>
        <Button size="small" onClick={() => onTab('services')}>{language === 'fr' ? 'Voir les droits' : 'View entitlements'}</Button>
      </SummaryBlock>
      <SummaryBlock title={language === 'fr' ? 'Dernière activité' : 'Last activity'}>
        <p>{String(student.last_activity?.type ?? '—')}</p><p>{String(student.last_activity?.detail ?? '')}</p><small>{String(student.last_activity?.date ?? '')}</small>
      </SummaryBlock>
    </div>
  );
}

function SummaryBlock({ title, children }: { title: string; children: ReactNode }) {
  return <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6">{title}</Typography>{children}</Paper>;
}

function StudentIdentity({ student, onSaved, onError }: { student: Student; onSaved: (student: Student) => void; onError: (message: string) => void }) {
  const language = useLanguage();
  const notify = useToast();
  const [form, setForm] = useState({ last_name: student.last_name, first_name: student.first_name, status: student.status });
  const [conflict, setConflict] = useState<Record<string, unknown> | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  async function submit() {
    try {
      const next = await api.updateStudent(student.id, { ...form, record_version: student.record_version });
      if (photo) await api.uploadStudentPhoto(student.id, photo);
      onSaved(next);
      setConflict(null);
      notify(language === 'fr' ? 'Identité mise à jour.' : 'Identity updated.', 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && typeof error.detail === 'object' && error.detail) {
        setConflict((error.detail as { current_record?: Record<string, unknown> }).current_record ?? null);
      } else onError(language === 'fr' ? 'Modification élève refusée.' : 'Student update denied.');
    }
  }

  function resetFromCurrent(keepChanges: boolean) {
    if (!conflict) return;
    const current = conflict as unknown as Student;
    if (!keepChanges) setForm({ last_name: current.last_name, first_name: current.first_name, status: current.status });
    onSaved(current);
    setConflict(null);
  }

  return (
    <Stack spacing={2}>
      <Paper className="formGrid" variant="outlined" sx={{ p: 2 }}>
        <label className="fieldLabel">{language === 'fr' ? 'Photo' : 'Photo'}<input accept="image/jpeg,image/png" type="file" onChange={(event: ChangeEvent<HTMLInputElement>) => setPhoto(event.target.files?.[0] ?? null)} /></label>
        <TextField label={language === 'fr' ? 'Nom' : 'Last name'} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
        <TextField label={language === 'fr' ? 'Prénom(s)' : 'First name(s)'} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
        <TextField label={language === 'fr' ? 'Date de naissance' : 'Birth date'} value={student.birth_date} disabled />
        <TextField label={language === 'fr' ? 'Sexe' : 'Gender'} value={student.gender ?? ''} disabled />
        <TextField select label={language === 'fr' ? 'Statut' : 'Status'} value={form.status} disabled={student.status === 'ARCHIVED'} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          {studentStatuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
          {student.status === 'ARCHIVED' && <MenuItem value="ARCHIVED">ARCHIVED</MenuItem>}
        </TextField>
        <TextField label={language === 'fr' ? 'Représentant légal' : 'Guardian'} value={String(student.guardian?.display_name ?? '')} disabled />
        <TextField label={language === 'fr' ? 'Contact masqué' : 'Masked contact'} value={String(student.guardian?.contact_masked ?? '')} disabled />
        <Button variant="contained" startIcon={<Upload size={17} />} onClick={() => void submit()}>{language === 'fr' ? 'Enregistrer' : 'Save'}</Button>
      </Paper>
      <Dialog open={Boolean(conflict)} maxWidth="md" fullWidth>
        <DialogTitle>{language === 'fr' ? 'Conflit de modification' : 'Update conflict'}</DialogTitle>
        <DialogContent>
          <Alert severity="warning">{language === 'fr' ? 'Ce dossier a été modifié par un autre utilisateur.' : 'This record was updated by another user.'}</Alert>
          <div className="conflictGrid">
            <SummaryBlock title={language === 'fr' ? 'Vos modifications' : 'Your changes'}><p>{form.last_name}</p><p>{form.first_name}</p><p>{form.status}</p></SummaryBlock>
            <SummaryBlock title={language === 'fr' ? 'Valeurs actuelles' : 'Current values'}><p>{String(conflict?.last_name)}</p><p>{String(conflict?.first_name)}</p><p>{String(conflict?.status)}</p></SummaryBlock>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => resetFromCurrent(false)}>{language === 'fr' ? 'Annuler mes modifications' : 'Discard my changes'}</Button>
          <Button variant="contained" onClick={() => resetFromCurrent(true)}>{language === 'fr' ? 'Recharger et reprendre' : 'Reload and continue'}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function StudentEnrollment({ student, loadCached, invalidate, onReload, onNavigate, onError }: {
  student: Student; loadCached: <T>(key: string, loader: () => Promise<T>) => Promise<T>; invalidate: (...keys: string[]) => void;
  onReload: () => Promise<void>; onNavigate: (path: string) => void; onError: (message: string) => void;
}) {
  const language = useLanguage();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reenrollOpen, setReenrollOpen] = useState(false);
  useEffect(() => { loadCached('enrollments', () => api.studentEnrollments(student.id)).then(setRows).catch(() => onError('Lecture du parcours refusée.')); }, [student.id]);
  const current = rows[0];
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">{language === 'fr' ? 'Inscription courante' : 'Current enrollment'}</Typography>
        {current ? <><p>{String(current.school_year)} · {String(current.school_name)} · {String(current.classroom_label)}</p><Chip label={String(current.status)} /></> : <p>—</p>}
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
          {['WITHDRAWN', 'GRADUATED', 'ARCHIVED'].includes(student.status)
            ? <Button variant="contained" onClick={() => setReenrollOpen(true)}>{language === 'fr' ? 'Réintégrer l’élève' : 'Re-enroll student'}</Button>
            : <>
              <Button onClick={() => onNavigate(`/scolarite/inscriptions?student_id=${student.id}&mode=class-change`)}>{language === 'fr' ? 'Changer de classe' : 'Change class'}</Button>
              <Button onClick={() => onNavigate(`/scolarite/inscriptions?student_id=${student.id}&mode=transfer`)}>{language === 'fr' ? 'Initier un transfert' : 'Start transfer'}</Button>
              {current && <Button color="warning" onClick={() => setWithdrawOpen(true)}>{language === 'fr' ? 'Enregistrer une sortie' : 'Record withdrawal'}</Button>}
            </>}
        </Stack>
      </Paper>
      <div className="timeline">{rows.map((row) => <article key={String(row.id)}><span /><div><strong>{String(row.school_year)} · {String(row.status)}</strong><small>{String(row.enrolled_at)}</small><p>{String(row.school_name)} · {String(row.classroom_label)}</p></div></article>)}</div>
      {current && <WithdrawalDialog enrollmentId={Number(current.id)} open={withdrawOpen} onClose={() => setWithdrawOpen(false)} onDone={async () => { invalidate('enrollments', 'history', 'summary'); await onReload(); setRows(await api.studentEnrollments(student.id)); }} />}
      <ReenrollDialog student={student} open={reenrollOpen} onClose={() => setReenrollOpen(false)} onDone={async () => { invalidate('enrollments', 'history', 'summary'); await onReload(); setRows(await api.studentEnrollments(student.id)); }} />
    </Stack>
  );
}

function WithdrawalDialog({ enrollmentId, open, onClose, onDone }: { enrollmentId: number; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState({ exit_type: 'WITHDRAWN', exit_date: new Date().toISOString().slice(0, 10), reason: '' });
  return <Dialog open={open} onClose={onClose} fullWidth><DialogTitle>Enregistrer une sortie</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField select label="Type de sortie" value={form.exit_type} onChange={(e) => setForm({ ...form, exit_type: e.target.value })}>{['GRADUATED', 'WITHDRAWN', 'HIGHER_EDUCATION', 'DECEASED', 'OTHER'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField type="date" label="Date de sortie" slotProps={{ inputLabel: { shrink: true } }} value={form.exit_date} onChange={(e) => setForm({ ...form, exit_date: e.target.value })} /><TextField multiline minRows={3} label="Motif détaillé" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /><Alert severity="warning">L'inscription courante sera clôturée. L'historique est conservé.</Alert></Stack></DialogContent><DialogActions><Button onClick={onClose}>Annuler</Button><Button variant="contained" disabled={form.reason.trim().length < 10} onClick={() => api.withdrawEnrollment(enrollmentId, form).then(onDone).then(onClose)}>Confirmer la sortie</Button></DialogActions></Dialog>;
}

function ReenrollDialog({ student, open, onClose, onDone }: { student: Student; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [years, setYears] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<SelectOption[]>([]);
  const [school, setSchool] = useState<SelectOption | null>(null);
  const [year, setYear] = useState<SelectOption | null>(null);
  const [classroom, setClassroom] = useState<SelectOption | null>(null);
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) Promise.all([api.schools(), api.schoolYears()]).then(([s, y]) => { setSchools(s.map((row) => ({ id: Number(row.school_id ?? row.id), label: String(row.school ?? row.name), raw: row }))); setYears(y.map((row) => ({ id: Number(row.id), label: String(row.code), raw: row }))); }); }, [open]);
  useEffect(() => { if (school && year) api.classrooms(school.id, year.id).then((rows) => setClasses(rows.map((row) => ({ id: Number(row.id), label: String(row.label), raw: row })))); }, [school, year]);
  return <Dialog open={open} onClose={onClose} fullWidth><DialogTitle>Réintégrer {student.first_name} {student.last_name}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><SearchSelect label="Établissement" options={schools} value={school} onChange={setSchool} /><SearchSelect label="Année scolaire" options={years} value={year} onChange={setYear} /><SearchSelect label="Classe" options={classes} value={classroom} onChange={setClassroom} /><TextField multiline minRows={3} label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Annuler</Button><Button variant="contained" disabled={!school || !year || !classroom || reason.trim().length < 10} onClick={() => api.reenrollStudent(student.id, { school_id: school?.id, class_id: classroom?.id, academic_year_id: year?.id, entry_date: new Date().toISOString().slice(0, 10), reason }).then(onDone).then(onClose)}>Réintégrer</Button></DialogActions></Dialog>;
}

function StudentCards({ student, canIssue, loadCached, invalidate, onError }: { student: Student; canIssue: boolean; loadCached: <T>(key: string, loader: () => Promise<T>) => Promise<T>; invalidate: (...keys: string[]) => void; onError: (message: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [display, setDisplay] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Record<string, Array<Record<string, unknown>>> | null>(null);
  useEffect(() => { loadCached('cards', () => api.studentCards(student.id)).then(async (cards) => { setRows(cards); if (cards[0]) { setDisplay(await api.cardDisplay(Number(cards[0].id))); setHistory(await api.cardHistory(Number(cards[0].id))); } }).catch(() => onError('Lecture des cartes refusée.')); }, [student.id]);
  if (!rows.length) return <Stack spacing={2}><Alert severity="info">Aucune carte scolaire pour cet élève.</Alert>{canIssue && <Button variant="contained" onClick={() => api.requestCard(student.id).then(() => { invalidate('cards'); return api.studentCards(student.id); }).then(setRows)}>Demander une carte</Button>}</Stack>;
  return <Stack spacing={2}>{display && <DigitalCardView data={display} />}{history && <CardLifecycleTimeline history={history} />}<Button href={`/operations/cartes?student=${student.id}`}>Voir dans le module Cartes</Button>{rows.length > 1 && <Paper variant="outlined" sx={{ p: 2 }}><Typography>Cartes précédentes ({rows.length - 1})</Typography>{rows.slice(1).map((row) => <Chip key={String(row.id)} label={`${String(row.serial_number)} · ${String(row.status)}`} sx={{ m: .5 }} />)}</Paper>}</Stack>;
}

function StudentServices({ student, canManage, loadCached, onError }: { student: Student; canManage: boolean; loadCached: <T>(key: string, loader: () => Promise<T>) => Promise<T>; onError: (message: string) => void }) {
  const [data, setData] = useState<Record<string, Array<Record<string, unknown>>>>({ entitlements: [], usages: [] });
  useEffect(() => { loadCached('services', () => api.studentServices(student.id)).then(setData).catch(() => onError('Lecture des services refusée.')); }, [student.id]);
  return <Stack spacing={2}>{canManage && <Button variant="contained" href={`/operations/services?student=${student.id}`}>Attribuer un service</Button>}<Typography variant="h6">Droits actifs</Typography><SimpleRows rows={data.entitlements ?? []} /><Typography variant="h6">Historique des utilisations</Typography><SimpleRows rows={data.usages ?? []} /></Stack>;
}

function StudentHistory({ student, loadCached }: { student: Student; loadCached: <T>(key: string, loader: () => Promise<T>) => Promise<T> }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { loadCached('history', () => api.studentHistory(student.id)).then(setRows); }, [student.id]);
  return <div className="timeline">{rows.map((row, index) => <article key={index}><span /><div><strong>{String(row.new_status ?? row.event_type ?? 'Événement')}</strong><small>{String(row.changed_at ?? row.created_at ?? '')}</small><p>{String(row.reason ?? row.detail ?? '')}</p></div></article>)}</div>;
}

function StudentDuplicates({ student, loadCached, invalidate, onCount, onError }: { student: Student; loadCached: <T>(key: string, loader: () => Promise<T>) => Promise<T>; invalidate: (...keys: string[]) => void; onCount: (count: number) => void; onError: (message: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [decision, setDecision] = useState<{ row: Record<string, unknown>; action: 'reject' | 'merge' } | null>(null);
  const [reason, setReason] = useState('');
  useEffect(() => { loadCached('duplicates', () => api.studentDuplicates(student.id)).then((items) => { setRows(items); onCount(items.length); }); }, [student.id]);
  async function submit() {
    if (!decision) return;
    try {
      if (decision.action === 'reject') await api.rejectDuplicate(Number(decision.row.student_id), student.id, reason);
      else await api.flagDuplicateForMerge(Number(decision.row.student_id), student.id, reason);
      const next = rows.filter((row) => row.student_id !== decision.row.student_id);
      setRows(next); onCount(next.length); invalidate('duplicates'); setDecision(null); setReason('');
    } catch { onError('Décision sur le doublon refusée.'); }
  }
  return <Stack spacing={2}>{!rows.length && <Alert severity="success">Aucun doublon potentiel non traité.</Alert>}{rows.map((row) => <Paper variant="outlined" sx={{ p: 2 }} key={String(row.student_id)}><div className="duplicateCompare"><SummaryBlock title="Dossier courant"><p>{student.last_name} {student.first_name}</p><p>{student.birth_date}</p><p>{student.status}</p></SummaryBlock><SummaryBlock title="Doublon potentiel"><p>{String(row.full_name)}</p><p>{String(row.birth_date)}</p><p>{String(row.status)}</p><strong>Score : {String(row.score)} %</strong></SummaryBlock></div><Stack direction="row" spacing={1} sx={{ mt: 2 }}><Button color="warning" onClick={() => setDecision({ row, action: 'merge' })}>C'est le même élève · proposer une fusion</Button><Button onClick={() => setDecision({ row, action: 'reject' })}>Dossiers distincts</Button></Stack></Paper>)}<Dialog open={Boolean(decision)} onClose={() => setDecision(null)} fullWidth><DialogTitle>{decision?.action === 'merge' ? 'Proposer une fusion non destructive' : 'Confirmer des dossiers distincts'}</DialogTitle><DialogContent><TextField fullWidth multiline minRows={3} sx={{ mt: 1 }} label="Motif obligatoire" value={reason} onChange={(e) => setReason(e.target.value)} /></DialogContent><DialogActions><Button onClick={() => setDecision(null)}>Annuler</Button><Button variant="contained" disabled={reason.trim().length < 10} onClick={() => void submit()}>Confirmer</Button></DialogActions></Dialog></Stack>;
}

function StudentAudit({ student, loadCached }: { student: Student; loadCached: <T>(key: string, loader: () => Promise<T>) => Promise<T> }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { loadCached('audit', async () => { const result = await api.auditEvents(`?resource_type=STUDENT&resource_public_id=${encodeURIComponent(student.public_id)}&page=1&per_page=50`); return Array.isArray(result) ? result : result.items; }).then(setRows); }, [student.id]);
  return <SimpleRows rows={rows} />;
}

function ArchiveDialog({ student, open, onClose, onArchived }: { student: Student; open: boolean; onClose: () => void; onArchived: (student: Student) => void }) {
  const [reasonCode, setReasonCode] = useState('ADMINISTRATIVE_DECISION');
  const [reasonText, setReasonText] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [conflict, setConflict] = useState<Record<string, unknown> | null>(null);
  async function submit() {
    try {
      onArchived(await api.archiveStudent(student.id, { reason_code: reasonCode, reason_text: reasonText, record_version: student.record_version }));
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && typeof error.detail === 'object' && error.detail) setConflict((error.detail as { current_record?: Record<string, unknown> }).current_record ?? null);
    }
  }
  const valid = confirmed && (reasonCode !== 'OTHER' || reasonText.trim().length >= 10);
  return <Dialog open={open} onClose={onClose} fullWidth><DialogTitle>Archiver le dossier de {student.first_name} {student.last_name}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Alert severity="warning">L'inscription sera clôturée, la carte et les droits actifs seront suspendus.</Alert><TextField select label="Motif" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>{['ADMINISTRATIVE_DECISION', 'PROLONGED_ABSENCE', 'DUPLICATE_RESOLVED', 'GRADUATION', 'OTHER'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField multiline minRows={3} label="Justification complémentaire" value={reasonText} onChange={(e) => setReasonText(e.target.value)} /><label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Je confirme avoir vérifié l'identité du dossier.</label>{conflict && <Alert severity="error">Conflit de version : version actuelle {String(conflict.record_version)}. Rechargez la fiche avant de recommencer.</Alert>}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Annuler</Button><Button color="warning" variant="contained" disabled={!valid} onClick={() => void submit()}>Archiver ce dossier</Button></DialogActions></Dialog>;
}

function SimpleRows({ rows }: { rows: Array<Record<string, unknown>> }) {
  const keys = useMemo(() => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 7), [rows]);
  if (!rows.length) return <Typography color="text.secondary">Aucune donnée.</Typography>;
  return <div className="tableScroller"><table><thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{keys.map((key) => <td key={key}>{String(row[key] ?? '')}</td>)}</tr>)}</tbody></table></div>;
}

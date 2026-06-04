import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CreditCard, FileClock, KeyRound, LogOut, RefreshCw, School, ShieldCheck, UserCog, UsersRound } from 'lucide-react';
import { api, Card, Me, setCsrf, Student } from './api';
import { Language, normalizeLanguage, t } from './i18n';
import './styles.css';

type Tab = 'profile' | 'password' | 'mfa' | 'users' | 'roles' | 'permissions' | 'scopes' | 'sessions' | 'dashboard' | 'dashCards' | 'dashAttendance' | 'dashPayments' | 'dashSecurity' | 'dashServices' | 'exports' | 'audit' | 'integrity' | 'alerts' | 'incidents' | 'privacy' | 'retention' | 'backups' | 'securitySettings' | 'students' | 'studentForm' | 'enrollments' | 'cards' | 'qr' | 'attendance' | 'services' | 'payments' | 'anomalies';

function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [error, setError] = useState('');

  async function loadMe() {
    try {
      setMe(await api.me());
      setError('');
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    void loadMe();
  }, []);

  const language = normalizeLanguage(me?.preferred_language);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  if (!me) {
    return <Login onLogin={loadMe} />;
  }

  const label = (key: string) => t(language, key);
  const can = (permission: string) => me.permissions.includes(permission);
  const tabs: Array<[Tab, string, boolean]> = [
    ['profile', label('profile'), true],
    ['password', label('password'), true],
    ['mfa', label('mfa'), true],
    ['users', label('users'), can('user:create') || can('user:update')],
    ['roles', label('roles'), can('role:assign')],
    ['permissions', label('permissions'), can('role:assign')],
    ['scopes', label('scopes'), can('role:assign')],
    ['sessions', label('sessions'), true],
    ['dashboard', label('dashboard'), can('dashboard:read')],
    ['dashCards', label('dashCards'), can('dashboard:read')],
    ['dashAttendance', label('dashAttendance'), can('dashboard:read')],
    ['dashPayments', label('dashPayments'), can('dashboard:read')],
    ['dashSecurity', label('dashSecurity'), can('dashboard:read')],
    ['dashServices', label('dashServices'), can('dashboard:read')],
    ['exports', label('exports'), can('export:create') || can('export:download')],
    ['audit', label('audit'), can('audit:read')],
    ['integrity', label('integrity'), can('audit:read')],
    ['alerts', label('alerts'), can('security:read')],
    ['incidents', label('incidents'), can('incident:update') || can('incident:create')],
    ['privacy', label('privacy'), can('privacy:read') || can('privacy:update')],
    ['retention', label('retention'), can('privacy:read') || can('privacy:update')],
    ['backups', label('backups'), can('backup:read')],
    ['securitySettings', label('securitySettings'), can('security:read')],
    ['students', label('students'), can('student:read')],
    ['studentForm', label('studentForm'), can('student:create')],
    ['enrollments', label('enrollments'), can('student:update')],
    ['cards', label('cards'), can('card:verify') || can('card:issue')],
    ['qr', label('qr'), can('card:verify') || can('card:issue')],
    ['attendance', label('attendance'), can('attendance:read') || can('attendance:create')],
    ['services', label('services'), can('service:verify') || can('service:manage')],
    ['payments', label('payments'), can('payment:read') || can('payment:create')],
    ['anomalies', label('anomalies'), can('audit:read') || can('card:verify')],
  ];

  async function logout() {
    await api.logout();
    setMe(null);
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={28} />
          <span>EduCard Secure</span>
        </div>
        <nav>
          {tabs.filter(([, , visible]) => visible).map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="iconText" onClick={logout}>
          <LogOut size={18} /> {label('logout')}
        </button>
      </aside>
      <section className="workspace">
        <header>
          <div>
            <h1>{me.display_name}</h1>
            <p>{me.roles.join(', ')}</p>
          </div>
          <div className="toolbar">
            <label>
              {label('language')}
              <select value={language} onChange={(event) => {
                const next = event.target.value as Language;
                api.setLanguage(next).then(loadMe).catch(() => setError(label('languageDenied')));
              }}>
                <option value="fr">{label('french')}</option>
                <option value="en">{label('english')}</option>
              </select>
            </label>
            <button className="iconButton" onClick={() => void loadMe()} title={label('refresh')}>
              <RefreshCw size={20} />
            </button>
          </div>
        </header>
        {error && <div className="alert">{error}</div>}
        {tab === 'profile' && <Profile me={me} />}
        {tab === 'password' && <PasswordPanel onError={setError} onDone={() => setMe(null)} />}
        {tab === 'mfa' && <MfaPanel onError={setError} />}
        {tab === 'users' && <UsersPanel onError={setError} />}
        {tab === 'roles' && <TablePanel loader={api.roles} title="Roles" />}
        {tab === 'permissions' && <TablePanel loader={api.permissions} title="Permissions" />}
        {tab === 'scopes' && <ScopesPanel onError={setError} />}
        {tab === 'sessions' && <SessionPanel />}
        {tab === 'dashboard' && <DashboardPanel onError={setError} />}
        {tab === 'dashCards' && <DistributionPanel title="Cartes" loader={api.dashboardCards} onError={setError} />}
        {tab === 'dashAttendance' && <DistributionPanel title="Presence" loader={api.dashboardAttendance} onError={setError} />}
        {tab === 'dashPayments' && <DistributionPanel title="Paiements simules" loader={api.dashboardPayments} onError={setError} />}
        {tab === 'dashSecurity' && <DistributionPanel title="Securite" loader={api.dashboardSecurity} onError={setError} />}
        {tab === 'dashServices' && <DistributionPanel title="Services" loader={api.dashboardServices} onError={setError} />}
        {tab === 'exports' && <ExportsPanel can={can} onError={setError} />}
        {tab === 'audit' && <AuditPanel onError={setError} />}
        {tab === 'integrity' && <IntegrityPanel onError={setError} />}
        {tab === 'alerts' && <AlertsPanel onError={setError} />}
        {tab === 'incidents' && <IncidentsPanel can={can} onError={setError} />}
        {tab === 'privacy' && <PrivacyPanel can={can} onError={setError} />}
        {tab === 'retention' && <RetentionPanel can={can} onError={setError} />}
        {tab === 'backups' && <BackupsPanel onError={setError} />}
        {tab === 'securitySettings' && <SecuritySettingsPanel />}
        {tab === 'students' && <StudentsPanel can={can} onError={setError} />}
        {tab === 'studentForm' && <StudentForm onError={setError} />}
        {tab === 'enrollments' && <EnrollmentPanel onError={setError} />}
        {tab === 'cards' && <CardsPanel can={can} onError={setError} />}
        {tab === 'qr' && <QrPanel can={can} onError={setError} />}
        {tab === 'attendance' && <AttendancePanel can={can} onError={setError} />}
        {tab === 'services' && <ServicesPanel can={can} onError={setError} />}
        {tab === 'payments' && <PaymentsPanel can={can} onError={setError} />}
        {tab === 'anomalies' && <AnomaliesPanel />}
      </section>
    </main>
  );
}

function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [language, setLanguage] = useState<Language>(normalizeLanguage(navigator.language?.slice(0, 2)));
  const label = (key: string) => t(language, key);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfa, setMfa] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const response = await api.login(username, password, needsMfa ? mfa : undefined);
      if (response.mfa_required) {
        setNeedsMfa(true);
        return;
      }
      if (response.csrf_token) setCsrf(response.csrf_token);
      await onLogin();
    } catch {
      setError(label('authenticationDenied'));
    }
  }

  return (
    <main className="loginScreen">
      <form className="loginPanel" onSubmit={submit}>
        <ShieldCheck size={36} />
        <h1>EduCard Secure</h1>
        <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={label('language')}>
          <option value="fr">{label('french')}</option>
          <option value="en">{label('english')}</option>
        </select>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={label('username')} />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder={label('password')} type="password" />
        {needsMfa && <input value={mfa} onChange={(event) => setMfa(event.target.value)} placeholder="Code MFA" />}
        {error && <div className="alert">{error}</div>}
        <button className="primary" type="submit">
          <KeyRound size={18} /> {label('login')}
        </button>
      </form>
    </main>
  );
}

function Profile({ me }: { me: Me }) {
  return <pre className="panel">{JSON.stringify(me, null, 2)}</pre>;
}

function PasswordPanel({ onError, onDone }: { onError: (value: string) => void; onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  return (
    <form className="panel formGrid" onSubmit={async (event) => {
      event.preventDefault();
      try {
        await api.changePassword(currentPassword, newPassword);
        onDone();
      } catch {
        onError('Changement refuse');
      }
    }}>
      <input type="password" placeholder="Mot de passe actuel" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      <input type="password" placeholder="Nouveau mot de passe" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      <button className="primary"><KeyRound size={18} /> Changer</button>
    </form>
  );
}

function MfaPanel({ onError }: { onError: (value: string) => void }) {
  const [setup, setSetup] = useState('');
  const [code, setCode] = useState('');
  return (
    <section className="panel formGrid">
      <button onClick={async () => {
        try {
          const response = await api.mfaSetup();
          setSetup(response.secret_preview);
        } catch {
          onError('Activation MFA refusee');
        }
      }}><ShieldCheck size={18} /> Demarrer MFA</button>
      {setup && <code>{setup}</code>}
      <input placeholder="Code TOTP" value={code} onChange={(event) => setCode(event.target.value)} />
      <button onClick={() => api.mfaConfirm(code).catch(() => onError('Code MFA invalide'))}>Confirmer</button>
      <button onClick={() => api.mfaDisable(code).catch(() => onError('Desactivation refusee'))}>Desactiver</button>
    </section>
  );
}

function UsersPanel({ onError }: { onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { api.users().then(setRows).catch(() => onError('Acces utilisateurs refuse')); }, [onError]);
  return <DataTable rows={rows} />;
}

function TablePanel({ loader, title }: { loader: () => Promise<Array<Record<string, unknown>>>; title: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { void loader().then(setRows); }, [loader]);
  return <section className="panel"><h2>{title}</h2><DataTable rows={rows} /></section>;
}

function ScopesPanel({ onError }: { onError: (value: string) => void }) {
  const [userId, setUserId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  return (
    <form className="panel formGrid" onSubmit={async (event) => {
      event.preventDefault();
      try {
        await api.assignScope(Number(userId), { scope_type: 'SCHOOL', school_id: Number(schoolId) });
      } catch {
        onError('Affectation de perimetre refusee');
      }
    }}>
      <input placeholder="ID utilisateur" value={userId} onChange={(event) => setUserId(event.target.value)} />
      <input placeholder="ID etablissement" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
      <button><UserCog size={18} /> Affecter</button>
    </form>
  );
}

function SessionPanel() {
  return <section className="panel"><UsersRound size={24} /><p>{t(normalizeLanguage(document.documentElement.lang), 'currentSessionSecurity')}</p></section>;
}

function DashboardPanel({ onError }: { onError: (value: string) => void }) {
  const [schoolId, setSchoolId] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  async function load() {
    try {
      setData(await api.dashboardSummary(schoolId ? `?school_id=${schoolId}` : ''));
    } catch {
      onError('Dashboard refuse');
    }
  }
  useEffect(() => { void load(); }, []);
  const metrics = (data?.metrics ?? {}) as Record<string, unknown>;
  return (
    <section className="stack">
      <div className="toolbar">
        <input placeholder="ID etablissement" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
        <button onClick={() => void load()}><RefreshCw size={18} /> Filtrer</button>
      </div>
      <section className="metricGrid">
        {Object.entries(metrics).map(([key, value]) => <div className="metric" key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}
      </section>
    </section>
  );
}

function DistributionPanel({ title, loader, onError }: { title: string; loader: () => Promise<Record<string, unknown>>; onError: (value: string) => void }) {
  const [data, setData] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    loader().then((response) => setData((response.distribution ?? []) as Array<Record<string, unknown>>)).catch(() => onError('Statistiques refusees'));
  }, [loader, onError]);
  return (
    <section className="panel">
      <h2>{title}</h2>
      <BarChart rows={data} />
      <DataTable rows={data} />
    </section>
  );
}

function BarChart({ rows }: { rows: Array<Record<string, unknown>> }) {
  const numeric = rows.map((row) => typeof row.value === 'number' ? row.value : 0);
  const max = Math.max(1, ...numeric);
  return (
    <div className="barChart">
      {rows.map((row) => {
        const value = typeof row.value === 'number' ? row.value : 0;
        return <div className="barRow" key={String(row.label)}><span>{String(row.label)}</span><div><i style={{ width: `${(value / max) * 100}%` }} /></div><strong>{String(row.value)}</strong></div>;
      })}
    </div>
  );
}

function ExportsPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [schoolId, setSchoolId] = useState('');
  const [selected, setSelected] = useState('');
  const [download, setDownload] = useState('');
  async function load() {
    try {
      setRows(await api.exports());
    } catch {
      onError('Lecture exports refusee');
    }
  }
  useEffect(() => { void load(); }, []);
  return (
    <section className="stack">
      {can('export:create') && (
        <form className="toolbar" onSubmit={(event) => {
          event.preventDefault();
          api.createExport({ export_type: 'DASHBOARD_SUMMARY', format: 'CSV', reason: 'Export statistiques agregees', filters: { school_id: schoolId ? Number(schoolId) : undefined } }).then(load).catch(() => onError('Creation export refusee'));
        }}>
          <input placeholder="ID etablissement" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
          <button className="primary">Demander export CSV</button>
        </form>
      )}
      <div className="panel"><DataTable rows={rows} onRow={(row) => setSelected(String(row.id ?? ''))} /></div>
      {can('export:download') && (
        <section className="panel formGrid">
          <input placeholder="ID export" value={selected} onChange={(event) => setSelected(event.target.value)} />
          <button onClick={() => api.downloadExport(Number(selected)).then(setDownload).catch(() => onError('Telechargement refuse'))}>Telecharger</button>
          <pre>{download}</pre>
        </section>
      )}
    </section>
  );
}

function AuditPanel({ onError }: { onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { api.auditEvents().then(setRows).catch(() => onError('Lecture audit refusee')); }, [onError]);
  return <section className="panel"><h2>Audit</h2><DataTable rows={rows} /></section>;
}

function IntegrityPanel({ onError }: { onError: (value: string) => void }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { api.auditIntegrity().then(setResult).catch(() => onError('Verification integrite refusee')); }, [onError]);
  return <section className="panel"><h2>Integrite audit</h2><pre>{JSON.stringify(result, null, 2)}</pre></section>;
}

function AlertsPanel({ onError }: { onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    try { setRows(await api.alerts()); } catch { onError('Lecture alertes refusee'); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="panel"><h2>Alertes</h2><DataTable rows={rows} onRow={(row) => api.acknowledgeAlert(Number(row.id)).then(load).catch(() => onError('Accuse refuse'))} /></section>;
}

function IncidentsPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState('');
  async function load() {
    try { setRows(await api.incidents()); } catch { onError('Lecture incidents refusee'); }
  }
  useEffect(() => { void load(); }, []);
  return (
    <section className="stack">
      {can('incident:create') && <button className="primary" onClick={() => api.createIncident({ category: 'DEMO_SECURITY', priority: 'MEDIUM', severity: 'MEDIUM', comment: 'Incident fictif' }).then(load).catch(() => onError('Creation incident refusee'))}>Creer incident</button>}
      <div className="panel"><DataTable rows={rows} onRow={(row) => setSelected(String(row.id ?? ''))} /></div>
      {can('incident:update') && <div className="toolbar"><input placeholder="ID incident" value={selected} onChange={(event) => setSelected(event.target.value)} /><button onClick={() => api.updateIncident(Number(selected), { status: 'RESOLVED', comment: 'Resolution fictive' }).then(load).catch(() => onError('Resolution refusee'))}>Resoudre</button></div>}
    </section>
  );
}

function PrivacyPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [register, setRegister] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    try {
      setRequests(await api.privacyRequests());
      setRegister(await api.processingRegister());
    } catch {
      onError('Lecture donnees privacy refusee');
    }
  }
  useEffect(() => { void load(); }, []);
  return (
    <section className="grid2">
      <section className="panel"><h2>Demandes</h2>{can('privacy:update') && <button onClick={() => api.createPrivacyRequest({ request_type: 'ACCESS', subject_type: 'STUDENT' }).then(load).catch(() => onError('Creation demande refusee'))}>Nouvelle demande</button>}<DataTable rows={requests} /></section>
      <section className="panel"><h2>Registre</h2>{can('privacy:update') && <button onClick={() => api.createProcessingRegister({ processing_name: `Traitement demo ${Date.now()}`, purpose: 'Demo', data_categories: 'Donnees synthetiques' }).then(load).catch(() => onError('Creation registre refusee'))}>Ajouter traitement</button>}<DataTable rows={register} /></section>
    </section>
  );
}

function RetentionPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    try { setRows(await api.retentionRules()); } catch { onError('Lecture retention refusee'); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="panel"><h2>Retention</h2>{can('privacy:update') && <button onClick={() => api.createRetentionRule({ resource_type: `demo-${Date.now()}`, retention_period_days: 30 }).then(load).catch(() => onError('Creation regle refusee'))}>Ajouter regle</button>}<DataTable rows={rows} /></section>;
}

function BackupsPanel({ onError }: { onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { api.backups().then(setRows).catch(() => onError('Lecture sauvegardes refusee')); }, [onError]);
  return <section className="panel"><h2>Sauvegardes</h2><DataTable rows={rows} /></section>;
}

function SecuritySettingsPanel() {
  return <section className="panel"><h2>Parametres securite</h2><DataTable rows={[{ controle: 'CSRF', statut: 'actif' }, { controle: 'Cookies HttpOnly', statut: 'actif' }, { controle: 'Headers securite', statut: 'actif' }, { controle: 'Biometrie', statut: 'desactivee' }]} /></section>;
}

function StudentsPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Student[]; total: number; page: number; page_size: number } | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [duplicates, setDuplicates] = useState<Array<Record<string, unknown>>>([]);

  async function load(nextPage = page) {
    try {
      setData(await api.students(`?q=${encodeURIComponent(query)}&page=${nextPage}&page_size=10`));
      setPage(nextPage);
    } catch {
      onError('Recherche eleves refusee');
    }
  }

  useEffect(() => { void load(1); }, []);

  async function selectStudent(student: Student) {
    setSelected(student);
    setHistory(await api.studentHistory(student.id));
    setDuplicates(await api.duplicateCandidates(student.id));
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Recherche" />
        <button onClick={() => void load(1)}><RefreshCw size={18} /> Rechercher</button>
        <button disabled={page <= 1} onClick={() => void load(page - 1)}>Precedent</button>
        <button onClick={() => void load(page + 1)}>Suivant</button>
      </div>
      <div className="panel">
        <DataTable rows={(data?.items ?? []).map((student) => ({ id: student.id, matricule: student.student_number, nom: student.last_name, prenom: student.first_name, statut: student.status, ecole: student.current_school_id }))} onRow={(row) => {
          const student = data?.items.find((item) => item.id === row.id);
          if (student) void selectStudent(student);
        }} />
        <p>{data?.total ?? 0} resultat(s)</p>
      </div>
      {selected && (
        <section className="grid2">
          <StudentEdit student={selected} canArchive={can('student:archive')} onError={onError} onSaved={setSelected} />
          <section className="panel">
            <h2><FileClock size={18} /> Historique</h2>
            <DataTable rows={history} />
            <h2>Doublons potentiels</h2>
            <DataTable rows={duplicates} />
          </section>
        </section>
      )}
    </section>
  );
}

function StudentEdit({ student, canArchive, onError, onSaved }: { student: Student; canArchive: boolean; onError: (value: string) => void; onSaved: (student: Student) => void }) {
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [statusValue, setStatusValue] = useState(student.status);
  return (
    <form className="panel formGrid" onSubmit={async (event) => {
      event.preventDefault();
      try {
        onSaved(await api.updateStudent(student.id, { first_name: firstName, last_name: lastName, status: statusValue, record_version: student.record_version }));
      } catch {
        onError('Modification eleve refusee');
      }
    }}>
      <h2><School size={18} /> Fiche eleve</h2>
      <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
      <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
      <input value={statusValue} onChange={(event) => setStatusValue(event.target.value)} />
      <button className="primary">Enregistrer</button>
      {canArchive && <button type="button" onClick={async () => {
        if (!window.confirm('Confirmer archivage logique ?')) return;
        try {
          onSaved(await api.archiveStudent(student.id));
        } catch {
          onError('Archivage refuse');
        }
      }}>Archiver</button>}
    </form>
  );
}

function StudentForm({ onError }: { onError: (value: string) => void }) {
  const [payload, setPayload] = useState({ last_name: '', first_name: '', birth_date: '', school_id: '', classroom_id: '' });
  const set = (key: keyof typeof payload, value: string) => setPayload({ ...payload, [key]: value });
  return (
    <form className="panel formGrid" onSubmit={async (event) => {
      event.preventDefault();
      try {
        await api.createStudent({
          last_name: payload.last_name,
          first_name: payload.first_name,
          birth_date: payload.birth_date,
          school_id: Number(payload.school_id),
          classroom_id: payload.classroom_id ? Number(payload.classroom_id) : undefined,
        });
        setPayload({ last_name: '', first_name: '', birth_date: '', school_id: '', classroom_id: '' });
      } catch {
        onError('Creation eleve refusee');
      }
    }}>
      <h2>Nouvel eleve</h2>
      <input required placeholder="Nom fictif" value={payload.last_name} onChange={(event) => set('last_name', event.target.value)} />
      <input required placeholder="Prenom fictif" value={payload.first_name} onChange={(event) => set('first_name', event.target.value)} />
      <input required type="date" value={payload.birth_date} onChange={(event) => set('birth_date', event.target.value)} />
      <input required placeholder="ID etablissement" value={payload.school_id} onChange={(event) => set('school_id', event.target.value)} />
      <input placeholder="ID classe" value={payload.classroom_id} onChange={(event) => set('classroom_id', event.target.value)} />
      <button className="primary"><School size={18} /> Creer</button>
    </form>
  );
}

function EnrollmentPanel({ onError }: { onError: (value: string) => void }) {
  const [studentId, setStudentId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [toSchoolId, setToSchoolId] = useState('');
  const [toClassroomId, setToClassroomId] = useState('');
  return (
    <section className="grid2">
      <form className="panel formGrid" onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api.enroll({ student_id: Number(studentId), school_id: Number(schoolId), classroom_id: Number(classroomId), school_year_id: Number(schoolYearId), status: 'ACTIVE' });
        } catch {
          onError('Inscription refusee');
        }
      }}>
        <h2>Inscription</h2>
        <input placeholder="ID eleve" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
        <input placeholder="ID etablissement" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
        <input placeholder="ID classe" value={classroomId} onChange={(event) => setClassroomId(event.target.value)} />
        <input placeholder="ID annee scolaire" value={schoolYearId} onChange={(event) => setSchoolYearId(event.target.value)} />
        <button className="primary">Valider</button>
      </form>
      <form className="panel formGrid" onSubmit={async (event) => {
        event.preventDefault();
        if (!window.confirm('Confirmer transfert ?')) return;
        try {
          await api.transfer({ student_id: Number(studentId), to_school_id: Number(toSchoolId), to_classroom_id: toClassroomId ? Number(toClassroomId) : undefined, comment: 'Transfert administratif fictif' });
        } catch {
          onError('Transfert refuse');
        }
      }}>
        <h2>Transfert</h2>
        <input placeholder="ID eleve" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
        <input placeholder="Nouvel etablissement" value={toSchoolId} onChange={(event) => setToSchoolId(event.target.value)} />
        <input placeholder="Nouvelle classe" value={toClassroomId} onChange={(event) => setToClassroomId(event.target.value)} />
        <button>Transferer</button>
      </form>
    </section>
  );
}

function CardsPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [studentId, setStudentId] = useState('');
  const [selected, setSelected] = useState<Card | null>(null);
  const [history, setHistory] = useState<Record<string, Array<Record<string, unknown>>> | null>(null);

  async function load() {
    try {
      setCards(await api.cards());
    } catch {
      onError('Acces cartes refuse');
    }
  }
  useEffect(() => { void load(); }, []);

  async function selectCard(card: Card) {
    setSelected(card);
    setHistory(await api.cardHistory(card.id));
  }

  async function action(actionName: string) {
    if (!selected) return;
    if (!window.confirm('Confirmer operation carte ?')) return;
    try {
      const card = await api.cardAction(selected.id, actionName, `${actionName} administratif fictif`);
      setSelected(card);
      await load();
    } catch {
      onError('Operation carte refusee');
    }
  }

  return (
    <section className="stack">
      {can('card:issue') && (
        <form className="toolbar" onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api.createCard({ student_id: Number(studentId), reason: 'Demande administrative fictive' });
            await load();
          } catch {
            onError('Emission carte refusee');
          }
        }}>
          <input placeholder="ID eleve" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
          <button className="primary"><CreditCard size={18} /> Demander</button>
        </form>
      )}
      <div className="panel">
        <DataTable rows={cards.map((card) => ({ id: card.id, serie: card.serial_number, eleve: card.student_id, statut: card.status, version: card.card_version }))} onRow={(row) => {
          const card = cards.find((item) => item.id === row.id);
          if (card) void selectCard(card);
        }} />
      </div>
      {selected && (
        <section className="grid2">
          <div className="panel">
            <h2>Fiche carte</h2>
            <pre>{JSON.stringify(selected, null, 2)}</pre>
            <div className="toolbar">
              {can('card:issue') && <button onClick={() => void action('activate')}>Activer</button>}
              {can('card:suspend') && <button onClick={() => void action('suspend')}>Suspendre</button>}
              {can('card:suspend') && <button onClick={() => void action('reactivate')}>Reactiver</button>}
              {can('card:revoke') && <button onClick={() => void action('revoke')}>Revoquer</button>}
              {can('card:issue') && <button onClick={() => void action('replace')}>Remplacer</button>}
            </div>
          </div>
          <div className="panel">
            <h2>Historique carte</h2>
            <DataTable rows={[...(history?.status_history ?? []), ...(history?.issuance_events ?? [])]} />
          </div>
        </section>
      )}
    </section>
  );
}

function QrPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [cardId, setCardId] = useState('');
  const [payload, setPayload] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  return (
    <section className="grid2">
      <form className="panel formGrid" onSubmit={async (event) => {
        event.preventDefault();
        try {
          const response = await api.generateQr(Number(cardId), 60);
          setPayload(String(response.payload ?? ''));
          setResult(response);
        } catch {
          onError('Generation QR refusee');
        }
      }}>
        <h2>Generation QR</h2>
        <input placeholder="ID carte active" value={cardId} onChange={(event) => setCardId(event.target.value)} />
        {can('card:issue') && <button className="primary"><CreditCard size={18} /> Generer</button>}
        <textarea value={payload} onChange={(event) => setPayload(event.target.value)} placeholder="Payload QR signe" />
      </form>
      <section className="panel formGrid">
        <h2>Verification QR</h2>
        <textarea value={payload} onChange={(event) => setPayload(event.target.value)} placeholder="Payload a verifier" />
        <button onClick={async () => {
          try {
            setResult(await api.verifyQr(payload));
          } catch {
            onError('Verification QR refusee');
          }
        }}>Verifier</button>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </section>
    </section>
  );
}

function AttendancePanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [schoolId, setSchoolId] = useState('');
  const [cardId, setCardId] = useState('');
  const [attendanceId, setAttendanceId] = useState('');
  async function load() {
    try {
      setRows(await api.attendance(schoolId ? `?school_id=${schoolId}` : ''));
    } catch {
      onError('Lecture presence refusee');
    }
  }
  useEffect(() => { void load(); }, []);
  return (
    <section className="stack">
      <div className="toolbar">
        <input placeholder="ID etablissement" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
        <input placeholder="ID carte" value={cardId} onChange={(event) => setCardId(event.target.value)} />
        {can('attendance:create') && <button onClick={() => api.checkIn({ card_id: Number(cardId), school_id: Number(schoolId), event_type: 'ENTRY', source: 'CARD' }).then(load).catch(() => onError('Pointage refuse'))}>Entree</button>}
        {can('attendance:create') && <button onClick={() => api.checkOut({ card_id: Number(cardId), school_id: Number(schoolId), event_type: 'EXIT', source: 'CARD' }).then(load).catch(() => onError('Sortie refusee'))}>Sortie</button>}
        <button onClick={() => void load()}><RefreshCw size={18} /> Actualiser</button>
      </div>
      <div className="panel"><DataTable rows={rows} onRow={(row) => setAttendanceId(String(row.id ?? ''))} /></div>
      {can('attendance:create') && (
        <form className="panel formGrid" onSubmit={(event) => {
          event.preventDefault();
          api.correctAttendance(Number(attendanceId), { new_value: 'LATE', reason: 'Correction fictive' }).then(() => api.approveAttendance(Number(attendanceId))).then(load).catch(() => onError('Correction refusee'));
        }}>
          <h2>Correction</h2>
          <input placeholder="ID presence" value={attendanceId} onChange={(event) => setAttendanceId(event.target.value)} />
          <button>Corriger et valider</button>
        </form>
      )}
    </section>
  );
}

function ServicesPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [services, setServices] = useState<Array<Record<string, unknown>>>([]);
  const [studentId, setStudentId] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { api.services().then(setServices).catch(() => onError('Lecture services refusee')); }, [onError]);
  return (
    <section className="grid2">
      <section className="panel">
        <h2>Services</h2>
        <DataTable rows={services} onRow={(row) => setServiceTypeId(String(row.id ?? ''))} />
      </section>
      <form className="panel formGrid" onSubmit={async (event) => {
        event.preventDefault();
        try {
          setResult(await api.verifyService({ student_id: Number(studentId), service_type_id: Number(serviceTypeId) }));
        } catch {
          onError('Verification service refusee');
        }
      }}>
        <h2>Droits et eligibilite</h2>
        <input placeholder="ID eleve" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
        <input placeholder="ID service" value={serviceTypeId} onChange={(event) => setServiceTypeId(event.target.value)} />
        {can('service:manage') && <input placeholder="ID fournisseur fictif" value={providerId} onChange={(event) => setProviderId(event.target.value)} />}
        {can('service:manage') && <button type="button" onClick={() => api.createEntitlement({
          student_id: Number(studentId),
          service_type_id: Number(serviceTypeId),
          service_provider_id: Number(providerId),
          valid_from: new Date(Date.now() - 3600000).toISOString(),
          valid_until: new Date(Date.now() + 86400000).toISOString(),
          status: 'ACTIVE',
        }).catch(() => onError('Attribution droit refusee'))}>Attribuer</button>}
        <button className="primary">Verifier</button>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </form>
    </section>
  );
}

function PaymentsPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [schoolId, setSchoolId] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  async function load() {
    try {
      setRows(await api.payments());
    } catch {
      onError('Lecture paiements refusee');
    }
  }
  useEffect(() => { void load(); }, []);
  return (
    <section className="stack">
      {can('payment:create') && (
        <form className="toolbar" onSubmit={(event) => {
          event.preventDefault();
          api.mockPayment({
            provider_code: 'MOCK_MOMO',
            idempotency_key: `ui-${Date.now()}`,
            amount: 1500,
            category: 'DEMO_FEES',
            school_id: Number(schoolId),
            school_year_id: Number(schoolYearId),
            student_id: studentId ? Number(studentId) : undefined,
            reason: 'Paiement simule UI',
          }).then(load).catch(() => onError('Paiement simule refuse'));
        }}>
          <input placeholder="ID etablissement" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
          <input placeholder="ID annee" value={schoolYearId} onChange={(event) => setSchoolYearId(event.target.value)} />
          <input placeholder="ID eleve" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
          <button className="primary">Creer paiement mock</button>
        </form>
      )}
      <div className="panel"><DataTable rows={rows} onRow={(row) => setPaymentId(String(row.id ?? ''))} /></div>
      {can('payment:reconcile') && (
        <div className="toolbar">
          <input placeholder="ID paiement" value={paymentId} onChange={(event) => setPaymentId(event.target.value)} />
          <button onClick={() => {
            if (!window.confirm('Confirmer rapprochement ?')) return;
            api.reconcilePayment(Number(paymentId)).then(load).catch(() => onError('Rapprochement refuse'));
          }}>Rapprocher</button>
        </div>
      )}
    </section>
  );
}

function AnomaliesPanel() {
  return (
    <section className="panel">
      <h2>Anomalies</h2>
      <p>Les anomalies phase 5 sont journalisees cote backend : QR invalide, carte suspendue ou revoquee, double pointage, paiement duplique et acces hors perimetre.</p>
    </section>
  );
}

function DataTable({ rows, onRow }: { rows: Array<Record<string, unknown>>; onRow?: (row: Record<string, unknown>) => void }) {
  const keys = useMemo(() => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8), [rows]);
  if (!rows.length) return <p>Aucune donnee</p>;
  return (
    <table>
      <thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index} onClick={() => onRow?.(row)}>{keys.map((key) => <td key={key}>{String(row[key] ?? '')}</td>)}</tr>)}</tbody>
    </table>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

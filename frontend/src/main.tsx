import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, CreditCard, FileClock, KeyRound, LogOut, Moon, RefreshCw, School, ShieldCheck, Sun, UserCog, UsersRound } from 'lucide-react';
import { api, Card, Me, setCsrf, Student } from './api';
import { Language, normalizeLanguage, t } from './i18n';
import './styles.css';

type Tab = 'profile' | 'password' | 'mfa' | 'users' | 'roles' | 'permissions' | 'scopes' | 'sessions' | 'schoolMap' | 'dashboard' | 'dashCards' | 'dashAttendance' | 'dashPayments' | 'dashSecurity' | 'dashServices' | 'exports' | 'audit' | 'integrity' | 'alerts' | 'incidents' | 'privacy' | 'retention' | 'backups' | 'securitySettings' | 'students' | 'studentForm' | 'enrollments' | 'cards' | 'qr' | 'attendance' | 'services' | 'payments' | 'anomalies';
type NavItem = [Tab, string, boolean];
type NavGroup = { key: string; label: string; items: NavItem[] };
type Theme = 'light' | 'dark';

function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('educard-theme') === 'dark' ? 'dark' : 'light'));
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('educard-theme', theme);
  }, [theme]);

  if (!me) {
    return <Login onLogin={loadMe} />;
  }

  const label = (key: string) => t(language, key);
  const can = (permission: string) => me.permissions.includes(permission);
  const navGroups: NavGroup[] = [
    {
      key: 'account',
      label: label('groupAccount'),
      items: [
        ['profile', label('profile'), true],
        ['password', label('password'), true],
        ['mfa', label('mfa'), true],
        ['sessions', label('sessions'), true],
      ],
    },
    {
      key: 'admin',
      label: label('groupAdministration'),
      items: [
        ['schoolMap', label('schoolMap'), can('student:read')],
        ['users', label('users'), can('user:create') || can('user:update')],
        ['roles', label('roles'), can('role:assign')],
        ['permissions', label('permissions'), can('role:assign')],
        ['scopes', label('scopes'), can('role:assign')],
      ],
    },
    {
      key: 'schooling',
      label: label('groupSchooling'),
      items: [
        ['students', label('students'), can('student:read')],
        ['studentForm', label('studentForm'), can('student:create')],
        ['enrollments', label('enrollments'), can('student:update')],
      ],
    },
    {
      key: 'operations',
      label: label('groupOperations'),
      items: [
        ['cards', label('cards'), can('card:verify') || can('card:issue')],
        ['qr', label('qr'), can('card:verify') || can('card:issue')],
        ['attendance', label('attendance'), can('attendance:read') || can('attendance:create')],
        ['services', label('services'), can('service:verify') || can('service:manage')],
        ['payments', label('payments'), can('payment:read') || can('payment:create')],
      ],
    },
    {
      key: 'dashboards',
      label: label('groupDashboards'),
      items: [
        ['dashboard', label('dashboard'), can('dashboard:read')],
        ['dashCards', label('dashCards'), can('dashboard:read')],
        ['dashAttendance', label('dashAttendance'), can('dashboard:read')],
        ['dashPayments', label('dashPayments'), can('dashboard:read')],
        ['dashSecurity', label('dashSecurity'), can('dashboard:read')],
        ['dashServices', label('dashServices'), can('dashboard:read')],
        ['exports', label('exports'), can('export:create') || can('export:download')],
      ],
    },
    {
      key: 'security',
      label: label('groupSecurity'),
      items: [
        ['audit', label('audit'), can('audit:read')],
        ['integrity', label('integrity'), can('audit:read')],
        ['alerts', label('alerts'), can('security:read')],
        ['incidents', label('incidents'), can('incident:update') || can('incident:create')],
        ['anomalies', label('anomalies'), can('audit:read') || can('card:verify')],
        ['securitySettings', label('securitySettings'), can('security:read')],
      ],
    },
    {
      key: 'governance',
      label: label('groupGovernance'),
      items: [
        ['privacy', label('privacy'), can('privacy:read') || can('privacy:update')],
        ['retention', label('retention'), can('privacy:read') || can('privacy:update')],
        ['backups', label('backups'), can('backup:read')],
      ],
    },
  ];
  const visibleTabs = navGroups.flatMap((group) => group.items).filter(([, , visible]) => visible).map(([key]) => key);
  const currentTab = visibleTabs.includes(tab) ? tab : visibleTabs[0] ?? 'profile';

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
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(([, , visible]) => visible);
            if (!visibleItems.length) return null;
            return (
              <section className={`navGroup ${openGroup === group.key ? 'open' : ''}`} key={group.key}>
                <button className="navGroupTitle" onClick={() => setOpenGroup(openGroup === group.key ? null : group.key)}>
                  {group.label}
                </button>
                {openGroup === group.key && <div className="navItems">
                  {visibleItems.map(([key, itemLabel]) => (
                    <button key={key} className={currentTab === key ? 'active' : ''} onClick={() => setTab(key)}>
                      {itemLabel}
                    </button>
                  ))}
                </div>}
              </section>
            );
          })}
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
            <button className="iconText secondaryAction" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              {theme === 'light' ? label('darkMode') : label('lightMode')}
            </button>
            <button className="iconButton" onClick={() => void loadMe()} title={label('refresh')}>
              <RefreshCw size={20} />
            </button>
          </div>
        </header>
        {error && <div className="alert">{error}</div>}
        {currentTab === 'profile' && <Profile me={me} />}
        {currentTab === 'password' && <PasswordPanel onError={setError} onDone={() => setMe(null)} />}
        {currentTab === 'mfa' && <MfaPanel onError={setError} />}
        {currentTab === 'schoolMap' && <SchoolMapPanel can={can} onError={setError} />}
        {currentTab === 'users' && <UsersPanel onError={setError} />}
        {currentTab === 'roles' && <TablePanel loader={api.roles} title="Roles" />}
        {currentTab === 'permissions' && <TablePanel loader={api.permissions} title="Permissions" />}
        {currentTab === 'scopes' && <ScopesPanel onError={setError} />}
        {currentTab === 'sessions' && <SessionPanel />}
        {currentTab === 'dashboard' && <DashboardPanel onError={setError} />}
        {currentTab === 'dashCards' && <DistributionPanel title="Cartes" loader={api.dashboardCards} onError={setError} />}
        {currentTab === 'dashAttendance' && <DistributionPanel title="Presence" loader={api.dashboardAttendance} onError={setError} />}
        {currentTab === 'dashPayments' && <DistributionPanel title="Paiements simules" loader={api.dashboardPayments} onError={setError} />}
        {currentTab === 'dashSecurity' && <DistributionPanel title="Securite" loader={api.dashboardSecurity} onError={setError} />}
        {currentTab === 'dashServices' && <DistributionPanel title="Services" loader={api.dashboardServices} onError={setError} />}
        {currentTab === 'exports' && <ExportsPanel can={can} onError={setError} />}
        {currentTab === 'audit' && <AuditPanel onError={setError} />}
        {currentTab === 'integrity' && <IntegrityPanel onError={setError} />}
        {currentTab === 'alerts' && <AlertsPanel onError={setError} />}
        {currentTab === 'incidents' && <IncidentsPanel can={can} onError={setError} />}
        {currentTab === 'privacy' && <PrivacyPanel can={can} onError={setError} />}
        {currentTab === 'retention' && <RetentionPanel can={can} onError={setError} />}
        {currentTab === 'backups' && <BackupsPanel onError={setError} />}
        {currentTab === 'securitySettings' && <SecuritySettingsPanel />}
        {currentTab === 'students' && <StudentsPanel can={can} onError={setError} />}
        {currentTab === 'studentForm' && <StudentForm onError={setError} />}
        {currentTab === 'enrollments' && <EnrollmentPanel onError={setError} />}
        {currentTab === 'cards' && <CardsPanel can={can} onError={setError} />}
        {currentTab === 'qr' && <QrPanel can={can} onError={setError} />}
        {currentTab === 'attendance' && <AttendancePanel can={can} onError={setError} />}
        {currentTab === 'services' && <ServicesPanel can={can} onError={setError} />}
        {currentTab === 'payments' && <PaymentsPanel can={can} onError={setError} />}
        {currentTab === 'anomalies' && <AnomaliesPanel />}
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
  return (
    <section className="panel stack">
      <div>
        <h2>Profil utilisateur</h2>
        <p>{me.display_name} - {me.username}</p>
      </div>
      <section className="grid2">
        <div className="metric"><span>Roles</span><strong>{me.roles.join(', ')}</strong></div>
        <div className="metric"><span>Langue</span><strong>{me.preferred_language}</strong></div>
      </section>
      <div>
        <h2>Perimetres rattaches</h2>
        <DataTable rows={me.scopes} />
      </div>
      <p className="hint">Un perimetre NATIONAL donne acces a la vue centrale. Un perimetre REGION, DEPARTMENT ou SCHOOL limite les donnees et les operations aux entites rattachees.</p>
    </section>
  );
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

function SchoolMapPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const [hierarchy, setHierarchy] = useState<{ scopes: Array<Record<string, unknown>>; schools: Array<Record<string, unknown>> }>({ scopes: [], schools: [] });
  const [regions, setRegions] = useState<Array<Record<string, unknown>>>([]);
  const [departments, setDepartments] = useState<Array<Record<string, unknown>>>([]);
  const [subdivisions, setSubdivisions] = useState<Array<Record<string, unknown>>>([]);
  const [classrooms, setClassrooms] = useState<Array<Record<string, unknown>>>([]);
  const [schoolYears, setSchoolYears] = useState<Array<Record<string, unknown>>>([]);
  const [gradeLevels, setGradeLevels] = useState<Array<Record<string, unknown>>>([]);
  const [regionForm, setRegionForm] = useState({ code: '', name: '', capital: '' });
  const [departmentForm, setDepartmentForm] = useState({ region_id: '', code: '', name: '', capital: '' });
  const [subdivisionForm, setSubdivisionForm] = useState({ department_id: '', code: '', name: '', capital: '' });
  const [schoolForm, setSchoolForm] = useState({ subdivision_id: '', code: '', name: '', school_type: 'GENERAL', education_subsystem: 'DEMO', status: 'ACTIVE' });
  const [yearForm, setYearForm] = useState({ code: '', starts_on: '', ends_on: '', status: 'PLANNED' });
  const [classroomForm, setClassroomForm] = useState({ school_id: '', school_year_id: '', grade_level_id: '', code: '', label: '', capacity: '' });
  const canManage = can('settings:update');

  async function load() {
    try {
      const [nextHierarchy, nextRegions, nextDepartments, nextSubdivisions, nextClassrooms, nextYears, nextGrades] = await Promise.all([
        api.schoolHierarchy(),
        api.regions(),
        api.departments(),
        api.subdivisions(),
        api.classrooms(),
        api.schoolYears(),
        api.gradeLevels(),
      ]);
      setHierarchy(nextHierarchy);
      setRegions(nextRegions);
      setDepartments(nextDepartments);
      setSubdivisions(nextSubdivisions);
      setClassrooms(nextClassrooms);
      setSchoolYears(nextYears);
      setGradeLevels(nextGrades);
    } catch {
      onError('Lecture de la carte scolaire refusee');
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: React.FormEvent, action: () => Promise<Record<string, unknown>>, reset: () => void) {
    event.preventDefault();
    try {
      await action();
      reset();
      await load();
    } catch {
      onError('Operation carte scolaire refusee');
    }
  }

  return (
    <section className="stack">
      <section className="dashboardTopbar">
        <div>
          <h2><School size={20} /> Administration de la carte scolaire</h2>
          <p>Chaine hierarchique : Administration centrale, delegation regionale, delegation departementale, arrondissement/district, etablissement.</p>
        </div>
        <button onClick={() => void load()}><RefreshCw size={18} /> Actualiser</button>
      </section>
      <section className="panel stack">
        <h2>Votre perimetre actif</h2>
        <DataTable rows={hierarchy.scopes} />
      </section>
      <section className="panel stack">
        <h2>Etablissements accessibles</h2>
        <DataTable rows={hierarchy.schools} />
      </section>
      <section className="panel stack">
        <h2>Graphe hierarchique visible</h2>
        <SchoolHierarchyGraph rows={hierarchy.schools} />
      </section>
      <section className="panel stack">
        <h2>Classes accessibles</h2>
        <DataTable rows={classrooms} />
      </section>
      {canManage && (
        <section className="grid2">
          <form className="panel formGrid" onSubmit={(event) => submit(event, () => api.createRegion(regionForm), () => setRegionForm({ code: '', name: '', capital: '' }))}>
            <h2>Creer une region</h2>
            <input placeholder="Code region" value={regionForm.code} onChange={(event) => setRegionForm({ ...regionForm, code: event.target.value })} />
            <input placeholder="Nom region" value={regionForm.name} onChange={(event) => setRegionForm({ ...regionForm, name: event.target.value })} />
            <input placeholder="Chef-lieu" value={regionForm.capital} onChange={(event) => setRegionForm({ ...regionForm, capital: event.target.value })} />
            <button className="primary">Creer region</button>
          </form>
          <form className="panel formGrid" onSubmit={(event) => submit(event, () => api.createDepartment({ ...departmentForm, region_id: Number(departmentForm.region_id) }), () => setDepartmentForm({ region_id: '', code: '', name: '', capital: '' }))}>
            <h2>Creer un departement</h2>
            <select value={departmentForm.region_id} onChange={(event) => setDepartmentForm({ ...departmentForm, region_id: event.target.value })}>
              <option value="">Region</option>
              {regions.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.name)} ({String(row.id)})</option>)}
            </select>
            <input placeholder="Code departement" value={departmentForm.code} onChange={(event) => setDepartmentForm({ ...departmentForm, code: event.target.value })} />
            <input placeholder="Nom departement" value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} />
            <input placeholder="Chef-lieu" value={departmentForm.capital} onChange={(event) => setDepartmentForm({ ...departmentForm, capital: event.target.value })} />
            <button className="primary">Creer departement</button>
          </form>
          <form className="panel formGrid" onSubmit={(event) => submit(event, () => api.createSubdivision({ ...subdivisionForm, department_id: Number(subdivisionForm.department_id) }), () => setSubdivisionForm({ department_id: '', code: '', name: '', capital: '' }))}>
            <h2>Creer arrondissement / district</h2>
            <select value={subdivisionForm.department_id} onChange={(event) => setSubdivisionForm({ ...subdivisionForm, department_id: event.target.value })}>
              <option value="">Departement</option>
              {departments.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.name)} ({String(row.id)})</option>)}
            </select>
            <input placeholder="Code arrondissement" value={subdivisionForm.code} onChange={(event) => setSubdivisionForm({ ...subdivisionForm, code: event.target.value })} />
            <input placeholder="Nom arrondissement" value={subdivisionForm.name} onChange={(event) => setSubdivisionForm({ ...subdivisionForm, name: event.target.value })} />
            <input placeholder="Chef-lieu" value={subdivisionForm.capital} onChange={(event) => setSubdivisionForm({ ...subdivisionForm, capital: event.target.value })} />
            <button className="primary">Creer arrondissement</button>
          </form>
          <form className="panel formGrid" onSubmit={(event) => submit(event, () => api.createSchool({ ...schoolForm, subdivision_id: Number(schoolForm.subdivision_id) }), () => setSchoolForm({ subdivision_id: '', code: '', name: '', school_type: 'GENERAL', education_subsystem: 'DEMO', status: 'ACTIVE' }))}>
            <h2>Creer un etablissement</h2>
            <select value={schoolForm.subdivision_id} onChange={(event) => setSchoolForm({ ...schoolForm, subdivision_id: event.target.value })}>
              <option value="">Arrondissement / district</option>
              {subdivisions.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.name)} ({String(row.id)})</option>)}
            </select>
            <input placeholder="Code etablissement" value={schoolForm.code} onChange={(event) => setSchoolForm({ ...schoolForm, code: event.target.value })} />
            <input placeholder="Nom etablissement fictif" value={schoolForm.name} onChange={(event) => setSchoolForm({ ...schoolForm, name: event.target.value })} />
            <input placeholder="Type" value={schoolForm.school_type} onChange={(event) => setSchoolForm({ ...schoolForm, school_type: event.target.value })} />
            <button className="primary">Creer etablissement</button>
          </form>
          <form className="panel formGrid" onSubmit={(event) => submit(event, () => api.createSchoolYear(yearForm), () => setYearForm({ code: '', starts_on: '', ends_on: '', status: 'PLANNED' }))}>
            <h2>Creer annee scolaire</h2>
            <input placeholder="Code, ex. 2027-2028" value={yearForm.code} onChange={(event) => setYearForm({ ...yearForm, code: event.target.value })} />
            <input type="date" value={yearForm.starts_on} onChange={(event) => setYearForm({ ...yearForm, starts_on: event.target.value })} />
            <input type="date" value={yearForm.ends_on} onChange={(event) => setYearForm({ ...yearForm, ends_on: event.target.value })} />
            <button className="primary">Creer annee</button>
          </form>
          <form className="panel formGrid" onSubmit={(event) => submit(event, () => api.createClassroom({ ...classroomForm, school_id: Number(classroomForm.school_id), school_year_id: Number(classroomForm.school_year_id), grade_level_id: Number(classroomForm.grade_level_id), capacity: classroomForm.capacity ? Number(classroomForm.capacity) : undefined }), () => setClassroomForm({ school_id: '', school_year_id: '', grade_level_id: '', code: '', label: '', capacity: '' }))}>
            <h2>Creer une classe</h2>
            <select value={classroomForm.school_id} onChange={(event) => setClassroomForm({ ...classroomForm, school_id: event.target.value })}>
              <option value="">Etablissement</option>
              {hierarchy.schools.map((row) => <option value={String(row.school_id)} key={String(row.school_id)}>{String(row.school)} ({String(row.school_id)})</option>)}
            </select>
            <select value={classroomForm.school_year_id} onChange={(event) => setClassroomForm({ ...classroomForm, school_year_id: event.target.value })}>
              <option value="">Annee scolaire</option>
              {schoolYears.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.code)} ({String(row.id)})</option>)}
            </select>
            <select value={classroomForm.grade_level_id} onChange={(event) => setClassroomForm({ ...classroomForm, grade_level_id: event.target.value })}>
              <option value="">Niveau</option>
              {gradeLevels.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.label)} ({String(row.id)})</option>)}
            </select>
            <input placeholder="Code classe" value={classroomForm.code} onChange={(event) => setClassroomForm({ ...classroomForm, code: event.target.value })} />
            <input placeholder="Libelle" value={classroomForm.label} onChange={(event) => setClassroomForm({ ...classroomForm, label: event.target.value })} />
            <input placeholder="Capacite" value={classroomForm.capacity} onChange={(event) => setClassroomForm({ ...classroomForm, capacity: event.target.value })} />
            <button className="primary">Creer classe</button>
          </form>
        </section>
      )}
      {!canManage && <section className="panel"><p>Votre role permet la consultation du perimetre, pas la creation des referentiels.</p></section>}
    </section>
  );
}

function SchoolHierarchyGraph({ rows }: { rows: Array<Record<string, unknown>> }) {
  const [visible, setVisible] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const regions = useMemo(() => {
    const regionMap = new Map<string, { id: string; label: string; details: Record<string, unknown>; departments: Map<string, { id: string; label: string; details: Record<string, unknown>; subdivisions: Map<string, { id: string; label: string; details: Record<string, unknown>; schools: Array<{ id: string; label: string; code: string; status: string; details: Record<string, unknown> }> }> }> }>();
    rows.forEach((row) => {
      const regionId = String(row.region_id ?? 'region-unknown');
      const departmentId = String(row.department_id ?? 'department-unknown');
      const subdivisionId = String(row.subdivision_id ?? 'subdivision-unknown');
      if (!regionMap.has(regionId)) {
        regionMap.set(regionId, { id: regionId, label: String(row.region ?? 'Region non renseignee'), details: { type: 'Region', id: regionId, nom: row.region, chef_lieu: row.region_capital }, departments: new Map() });
      }
      const region = regionMap.get(regionId)!;
      if (!region.departments.has(departmentId)) {
        region.departments.set(departmentId, { id: departmentId, label: String(row.department ?? 'Departement non renseigne'), details: { type: 'Departement', id: departmentId, nom: row.department, chef_lieu: row.department_capital, region: row.region }, subdivisions: new Map() });
      }
      const department = region.departments.get(departmentId)!;
      if (!department.subdivisions.has(subdivisionId)) {
        department.subdivisions.set(subdivisionId, { id: subdivisionId, label: String(row.subdivision ?? 'Arrondissement non renseigne'), details: { type: 'Arrondissement / district', id: subdivisionId, nom: row.subdivision, chef_lieu: row.subdivision_capital, departement: row.department, region: row.region }, schools: [] });
      }
      department.subdivisions.get(subdivisionId)!.schools.push({
        id: String(row.school_id ?? 'school-unknown'),
        label: String(row.school ?? 'Etablissement non renseigne'),
        code: String(row.school_code ?? ''),
        status: String(row.status ?? ''),
        details: {
          type: 'Etablissement',
          id: row.school_id,
          code: row.school_code,
          nom: row.school,
          statut: row.status,
          type_etablissement: row.school_type,
          sous_systeme: row.education_subsystem,
          arrondissement: row.subdivision,
          departement: row.department,
          region: row.region,
        },
      });
    });
    return Array.from(regionMap.values()).map((region) => ({
      ...region,
      departments: Array.from(region.departments.values()).map((department) => ({
        ...department,
        subdivisions: Array.from(department.subdivisions.values()),
      })),
    }));
  }, [rows]);

  if (!regions.length) return <p>Aucun noeud visible pour ce perimetre.</p>;
  return (
    <div className="graphFrame">
      <div className="graphFrameHeader">
        <div>
          <h3>Graphe des noeuds administratifs</h3>
          <p>Clique sur un noeud rond pour afficher ses informations.</p>
        </div>
        <button onClick={() => setVisible(!visible)}>{visible ? 'Masquer le graphe' : 'Afficher le graphe'}</button>
      </div>
      {visible && (
        <div className="graphFrameBody">
          <div className="hierarchyGraph">
            {regions.map((region) => (
              <section className="graphLevel" key={region.id}>
                <GraphNode label={region.label} type="Region" count={`${region.departments.length} dep.`} level="region" onClick={() => setSelectedNode(region.details)} />
                <div className="graphChildren">
                  {region.departments.map((department) => (
                    <section className="graphLevel" key={department.id}>
                      <GraphNode label={department.label} type="Departement" count={`${department.subdivisions.length} arr.`} level="department" onClick={() => setSelectedNode(department.details)} />
                      <div className="graphChildren">
                        {department.subdivisions.map((subdivision) => (
                          <section className="graphLevel" key={subdivision.id}>
                            <GraphNode label={subdivision.label} type="Arrondissement" count={`${subdivision.schools.length} etab.`} level="subdivision" onClick={() => setSelectedNode(subdivision.details)} />
                            <div className="graphChildren schoolLeaves">
                              {subdivision.schools.map((school) => (
                                <GraphNode key={school.id} label={school.label} type="Etablissement" count={school.code} level="school" onClick={() => setSelectedNode(school.details)} />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <aside className="nodeDetails">
            <h3>Informations du noeud</h3>
            {selectedNode ? <DataTable rows={[selectedNode]} /> : <p>Aucun noeud selectionne.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}

function GraphNode({ label, type, count, level, onClick }: { label: string; type: string; count: string; level: string; onClick: () => void }) {
  return (
    <button className={`graphNode ${level}`} onClick={onClick} title={`${type}: ${label}`}>
      <span>{type}</span>
      <strong>{label}</strong>
      <small>{count}</small>
    </button>
  );
}

function SessionPanel() {
  return <section className="panel"><UsersRound size={24} /><p>{t(normalizeLanguage(document.documentElement.lang), 'currentSessionSecurity')}</p></section>;
}

function DashboardPanel({ onError }: { onError: (value: string) => void }) {
  const [schoolId, setSchoolId] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [charts, setCharts] = useState<Array<{ title: string; rows: Array<Record<string, unknown>> }>>([]);
  async function load() {
    try {
      const params = schoolId ? `?school_id=${schoolId}` : '';
      const [summary, cards, attendance, payments, security, services] = await Promise.all([
        api.dashboardSummary(params),
        api.dashboardCards(),
        api.dashboardAttendance(),
        api.dashboardPayments(),
        api.dashboardSecurity(),
        api.dashboardServices(),
      ]);
      setData(summary);
      setCharts([
        { title: 'Cartes', rows: (cards.distribution ?? []) as Array<Record<string, unknown>> },
        { title: 'Presence', rows: (attendance.distribution ?? []) as Array<Record<string, unknown>> },
        { title: 'Paiements simules', rows: (payments.distribution ?? []) as Array<Record<string, unknown>> },
        { title: 'Securite', rows: (security.distribution ?? []) as Array<Record<string, unknown>> },
        { title: 'Services', rows: (services.distribution ?? []) as Array<Record<string, unknown>> },
      ]);
    } catch {
      onError('Dashboard refuse');
    }
  }
  useEffect(() => { void load(); }, []);
  const metrics = (data?.metrics ?? {}) as Record<string, unknown>;
  const categories = [
    {
      key: 'school',
      title: 'Scolarite',
      description: 'Effectifs, inscriptions et couverture des etablissements.',
      metrics: ['active_students', 'enrollments', 'schools', 'duplicates_detected'],
    },
    {
      key: 'cards',
      title: 'Cartes scolaires',
      description: 'Cycle de vie administratif des cartes.',
      metrics: ['cards_requested', 'cards_issued', 'cards_active', 'cards_suspended', 'cards_revoked', 'cards_replaced', 'issuance_rate', 'average_issuance_delay_hours'],
    },
    {
      key: 'attendance',
      title: 'Presences',
      description: 'Pointages, retards et absences.',
      metrics: ['attendance', 'late', 'absences'],
    },
    {
      key: 'services',
      title: 'Services',
      description: 'Consommations et validations de droits fictifs.',
      metrics: ['services_consumed'],
    },
    {
      key: 'payments',
      title: 'Paiements simules',
      description: 'Transactions fictives et rapprochements.',
      metrics: ['mock_transactions', 'reconciliation_rate'],
    },
    {
      key: 'security',
      title: 'Alertes et securite',
      description: 'Incidents, refus, QR invalides, exports et alertes.',
      metrics: ['incidents_open', 'incidents_resolved', 'failed_logins', 'access_denied', 'qr_invalid', 'exports', 'alerts'],
    },
  ].map((category) => ({
    ...category,
    entries: category.metrics.filter((metric) => Object.prototype.hasOwnProperty.call(metrics, metric)).map((metric) => [metric, metrics[metric]] as [string, unknown]),
  })).filter((category) => category.entries.length);
  return (
    <section className="dashboardPage">
      <div className="dashboardTopbar">
        <div>
          <h2><BarChart3 size={20} /> Tableau de bord central</h2>
          <p>Vue synthetique des cartes, presences, services, paiements simules et alertes.</p>
        </div>
        <div className="toolbar">
          <input placeholder="ID etablissement" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
          <button onClick={() => void load()}><RefreshCw size={18} /> Filtrer</button>
        </div>
      </div>
      {categories.length ? categories.map((category) => (
        <section className="dashboardCategory" key={category.key}>
          <div className="categoryHeader">
            <h3>{category.title}</h3>
            <p>{category.description}</p>
          </div>
          <div className="kpiGrid">
            {category.entries.map(([key, value]) => <KpiCard key={key} label={key} value={value} />)}
          </div>
        </section>
      )) : <p>Aucun indicateur charge</p>}
      <section className="chartGrid">
        {charts.map((chart) => (
          <section className="panel" key={chart.title}>
            <h2>{chart.title}</h2>
            <BarChart rows={chart.rows} />
          </section>
        ))}
      </section>
    </section>
  );
}

function KpiCard({ label, value }: { label: string; value: unknown }) {
  return (
    <article className="kpiCard">
      <span>{formatMetricLabel(label)}</span>
      <strong>{String(value)}</strong>
    </article>
  );
}

function formatMetricLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  if (!rows.length) return <p>Aucune donnee graphique</p>;
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
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const keys = useMemo(() => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8), [rows]);

  useEffect(() => {
    setPage(1);
  }, [rows, filters, sortKey, sortDirection, pageSize]);

  const filteredRows = useMemo(() => rows.filter((row) => keys.every((key) => {
    const filterValue = (filters[key] ?? '').trim().toLowerCase();
    if (!filterValue) return true;
    return String(row[key] ?? '').toLowerCase().includes(filterValue);
  })), [filters, keys, rows]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const leftNumber = typeof left === 'number' ? left : Number(String(left ?? '').replace(',', '.'));
      const rightNumber = typeof right === 'number' ? right : Number(String(right ?? '').replace(',', '.'));
      const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
      const comparison = bothNumeric
        ? leftNumber - rightNumber
        : String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  if (!rows.length) return <p>Aucune donnee</p>;
  return (
    <div className="dataTable">
      <div className="tableScroller">
        <table>
          <thead>
            <tr>
              {keys.map((key) => (
                <th key={key}>
                  <button className="sortButton" onClick={() => toggleSort(key)}>
                    <span>{key}</span>
                    <span>{sortKey === key ? (sortDirection === 'asc' ? 'ASC' : 'DESC') : 'TRI'}</span>
                  </button>
                  <input
                    className="columnFilter"
                    value={filters[key] ?? ''}
                    onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}
                    placeholder={`Filtrer ${key}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={`${currentPage}-${index}`} onClick={() => onRow?.(row)}>
                {keys.map((key) => <td key={key}>{String(row[key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visibleRows.length && <p>Aucun resultat pour les filtres actifs.</p>}
      <div className="paginationBar">
        <span>{sortedRows.length} resultat(s) - page {currentPage} / {totalPages}</span>
        <label>
          Lignes
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="paginationButtons">
          <button onClick={() => setPage(1)} disabled={currentPage === 1}>Premiere</button>
          <button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Precedente</button>
          <button onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Suivante</button>
          <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>Derniere</button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

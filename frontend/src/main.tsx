import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Box, Button, CssBaseline, Paper, Stack, ThemeProvider, Typography } from '@mui/material';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { BarChart3, KeyRound, RefreshCw, School, ShieldCheck, UserCog } from 'lucide-react';
import { api, setCsrf } from './api';
import { AuthProvider, useAuth } from './auth';
import { Language, LanguageProvider, localizeField, localizeValue, normalizeLanguage, t, useLanguage } from './i18n';
import { AppShell } from './ui/AppShell';
import { LocalizationBridge } from './ui/LocalizationBridge';
import { MetricCard } from './ui/MetricCard';
import { QRCodeSVG } from 'qrcode.react';
import {
  SearchSelect,
  SelectOption,
  SlideOverPanel,
  ToastProvider,
  useToast,
} from './ui/WorkflowComponents';
import { createAppTheme, AppThemeMode } from './ui/theme';
import { GlobalErrorBoundary } from './ui/GlobalErrorBoundary';
import { PageSkeleton } from './ui/PageSkeleton';
import { DataTable } from './ui/DataTable';
import { PageTransition } from './ui/PageTransition';
import { AppTab, pathForTab, studentIdFromPath, tabFromPath } from './routes';
import './styles.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const loadWorkflow = () => import('./ui/WorkflowsV2');
const AlertsPage = lazy(() => loadWorkflow().then((module) => ({ default: module.AlertsPage })));
const AcademicLevelsPage = lazy(() => loadWorkflow().then((module) => ({ default: module.AcademicLevelsPage })));
const AdministrativeValidationsPage = lazy(() => loadWorkflow().then((module) => ({ default: module.AdministrativeValidationsPage })));
const AuditLogPage = lazy(() => loadWorkflow().then((module) => ({ default: module.AuditLogPage })));
const ControlledExportsPage = lazy(() => loadWorkflow().then((module) => ({ default: module.ControlledExportsPage })));
const IncidentsPage = lazy(() => loadWorkflow().then((module) => ({ default: module.IncidentsPage })));
const IntegrityCheckPage = lazy(() => loadWorkflow().then((module) => ({ default: module.IntegrityCheckPage })));
const PrivacyGovernancePage = lazy(() => loadWorkflow().then((module) => ({ default: module.PrivacyGovernancePage })));
const RetentionRulesPage = lazy(() => loadWorkflow().then((module) => ({ default: module.RetentionRulesPage })));
const SessionsManagementPage = lazy(() => loadWorkflow().then((module) => ({ default: module.SessionsManagementPage })));
const StudentDetailPage = lazy(() => import('./ui/StudentDetailPage').then((module) => ({ default: module.StudentDetailPage })));
const SpecializedDashboardPage = lazy(() => import('./ui/SpecializedDashboardPage').then((module) => ({ default: module.SpecializedDashboardPage })));
const BackupsPage = lazy(() => import('./ui/BackupsPage').then((module) => ({ default: module.BackupsPage })));
const LazyCardsPanel = lazy(() => import('./ui/CardsPanel').then((module) => ({ default: module.CardsPanel })));
const LazyQrPanel = lazy(() => import('./ui/QrPanel').then((module) => ({ default: module.QrPanel })));
const LazyAttendancePanel = lazy(() => import('./ui/AttendancePanel').then((module) => ({ default: module.AttendancePanel })));
const LazyServicesPanel = lazy(() => import('./ui/ServicesPanel').then((module) => ({ default: module.ServicesPanel })));
const LazyPaymentsPanel = lazy(() => import('./ui/PaymentsPanel').then((module) => ({ default: module.PaymentsPanel })));
const LazyAnomaliesPanel = lazy(() => import('./ui/AnomaliesPanel').then((module) => ({ default: module.AnomaliesPanel })));
const LazyStudentsPanel = lazy(() => import('./ui/StudentsPanel').then((module) => ({ default: module.StudentsPanel })));
const LazyEnrollmentPanel = lazy(() => import('./ui/EnrollmentPanel').then((module) => ({ default: module.EnrollmentPanel })));
const LazyStudentCreationWizard = lazy(() => import('./ui/StudentCreationWizard').then((module) => ({ default: module.StudentCreationWizard })));

type Tab = AppTab;
type NavItem = [Tab, string, boolean];
type NavGroup = { key: string; label: string; items: NavItem[] };
function App() {
  const { me, language, can, loadMe, logout: authLogout, clearAuth } = useAuth();
  const [tab, setTab] = useState<Tab>(() => tabFromPath(window.location.pathname));
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<AppThemeMode>(() => (localStorage.getItem('educard-theme') === 'dark' ? 'dark' : 'light'));
  const [openGroup, setOpenGroup] = useState<string | null>(() => localStorage.getItem('educard-open-group'));
  const [criticalAlerts, setCriticalAlerts] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [incidentAlert, setIncidentAlert] = useState<Record<string, unknown> | null>(null);
  const materialTheme = useMemo(() => createAppTheme(theme), [theme]);

  useEffect(() => {
    void loadMe().then(() => setError(''));
  }, []);

  useEffect(() => {
    const onPending = (event: Event) => setPendingRequests(Number((event as CustomEvent<number>).detail ?? 0));
    const onApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: number; requestId?: string | null }>).detail;
      if (detail?.status === 401) {
        clearAuth();
        return;
      }
      if (detail?.status === 403) {
        setError(normalizeLanguage(me?.preferred_language) === 'fr'
          ? 'Accès refusé. Vous ne disposez pas des droits nécessaires.'
          : 'Access denied. You do not have the required permissions.');
        return;
      }
      if (detail?.status === 404) {
        setError(normalizeLanguage(me?.preferred_language) === 'fr' ? 'Ressource introuvable.' : 'Resource not found.');
        return;
      }
      if (detail?.status === 409) {
        return;
      }
    };
    window.addEventListener('educard-api-pending', onPending);
    window.addEventListener('educard-api-error', onApiError);
    return () => {
      window.removeEventListener('educard-api-pending', onPending);
      window.removeEventListener('educard-api-error', onApiError);
    };
  }, [clearAuth, language]);

  useEffect(() => {
    const onPopState = () => setTab(tabFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTab = useCallback((next: Tab) => {
    const path = pathForTab(next);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setTab(next);
  }, []);
  const navigatePath = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setTab(tabFromPath(new URL(path, window.location.origin).pathname));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('educard-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!me) return;
    if (me.preferred_theme === 'light' || me.preferred_theme === 'dark') {
      setTheme(me.preferred_theme);
    }
    api.alerts()
      .then((items) => setCriticalAlerts(items.filter((item) => item.severity === 'CRITICAL' && item.status !== 'RESOLVED').length))
      .catch(() => setCriticalAlerts(0));
  }, [me?.public_id, me?.preferred_theme]);

  if (!me) {
    return (
      <ThemeProvider theme={materialTheme}>
        <CssBaseline />
        <Login onLogin={loadMe} />
      </ThemeProvider>
    );
  }

  const label = (key: string) => t(language, key);
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
        ['validations', label('validations'), can('settings:update')],
        ['academicLevels', label('academicLevels'), can('student:read')],
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
  const currentTab = tab === 'studentDetail' && can('student:read') ? tab : visibleTabs.includes(tab) ? tab : visibleTabs[0] ?? 'profile';
  const currentPageLabel = navGroups.flatMap((group) => group.items).find(([key]) => key === currentTab)?.[1] ?? 'EduCard Secure';
  document.title = `${currentPageLabel} · EduCard Secure`;

  async function logout() {
    try {
      await authLogout();
      setError('');
      setTab('dashboard');
    } catch {
      setError(label('logoutDenied'));
    }
  }

  return (
    <ThemeProvider theme={materialTheme}>
      <CssBaseline />
      <LanguageProvider language={language}>
        <ToastProvider>
          <LocalizationBridge language={language}>
          <AppShell
        currentTab={currentTab}
        displayName={me.display_name}
        error={error}
        criticalAlerts={criticalAlerts}
        language={language}
        loading={pendingRequests > 0}
        navGroups={navGroups}
        openGroup={openGroup}
        roles={me.roles}
        themeMode={theme}
        onChangeLanguage={(next) => api.setLanguage(next).then(loadMe).catch(() => setError(label('languageDenied')))}
        onChangeTab={navigateTab}
        onLogout={() => void logout()}
        onRefresh={() => void loadMe()}
        onToggleGroup={(key) => {
          const next = openGroup === key ? null : key;
          setOpenGroup(next);
          if (next) localStorage.setItem('educard-open-group', next);
          else localStorage.removeItem('educard-open-group');
        }}
        onToggleTheme={() => {
          const next = theme === 'light' ? 'dark' : 'light';
          setTheme(next);
          void api.setTheme(next).catch(() => setError(label('languageDenied')));
        }}
        onOpenCriticalAlerts={() => navigateTab('alerts')}
          >
        <PageTransition tabKey={currentTab}>
        <Suspense fallback={<PageSkeleton />}>
        {currentTab === 'profile' && <Profile />}
        {currentTab === 'password' && <PasswordPanel onError={setError} onDone={clearAuth} />}
        {currentTab === 'mfa' && <MfaPanel onError={setError} />}
        {currentTab === 'schoolMap' && <SchoolMapPanel can={can} onError={setError} />}
        {currentTab === 'validations' && <AdministrativeValidationsPage onError={setError} />}
        {currentTab === 'academicLevels' && <AcademicLevelsPage canManage={can('settings:update')} onError={setError} />}
        {currentTab === 'users' && <UsersPanel onError={setError} />}
        {currentTab === 'roles' && <TablePanel loader={api.roles} title="Roles" />}
        {currentTab === 'permissions' && <TablePanel loader={api.permissions} title="Permissions" />}
        {currentTab === 'scopes' && <ScopesPanel onError={setError} />}
        {currentTab === 'sessions' && <SessionPanel onError={setError} />}
        {currentTab === 'dashboard' && <DashboardPanel roles={me.roles} onNavigate={(next) => navigatePath(`${pathForTab(next)}${next.startsWith('dash') ? window.location.search : ''}`)} onError={setError} />}
        {currentTab === 'dashCards' && <SpecializedDashboardPage domain="cards" onBack={(query) => navigatePath(`/dashboard${query}`)} onDrillDown={navigatePath} onError={setError} />}
        {currentTab === 'dashAttendance' && <SpecializedDashboardPage domain="attendance" onBack={(query) => navigatePath(`/dashboard${query}`)} onDrillDown={navigatePath} onError={setError} />}
        {currentTab === 'dashPayments' && <SpecializedDashboardPage domain="payments" onBack={(query) => navigatePath(`/dashboard${query}`)} onDrillDown={navigatePath} onError={setError} />}
        {currentTab === 'dashSecurity' && <SpecializedDashboardPage domain="security" onBack={(query) => navigatePath(`/dashboard${query}`)} onDrillDown={navigatePath} onError={setError} />}
        {currentTab === 'dashServices' && <SpecializedDashboardPage domain="services" onBack={(query) => navigatePath(`/dashboard${query}`)} onDrillDown={navigatePath} onError={setError} />}
        {currentTab === 'exports' && <ExportsPanel can={can} onError={setError} />}
        {currentTab === 'audit' && <AuditPanel onError={setError} />}
        {currentTab === 'integrity' && <IntegrityPanel onError={setError} onNavigateIncident={() => navigateTab('incidents')} />}
        {currentTab === 'alerts' && <AlertsPanel onError={setError} onCreateIncident={(alert) => { setIncidentAlert(alert); navigateTab('incidents'); }} />}
        {currentTab === 'incidents' && <IncidentsPanel can={can} initialAlert={incidentAlert} onError={setError} />}
        {currentTab === 'privacy' && <PrivacyPanel can={can} onError={setError} />}
        {currentTab === 'retention' && <RetentionPanel can={can} onError={setError} />}
        {currentTab === 'backups' && <BackupsPage onError={setError} />}
        {currentTab === 'securitySettings' && <SecuritySettingsPanel />}
        {currentTab === 'students' && <LazyStudentsPanel can={can} onNavigate={navigatePath} onError={setError} />}
        {currentTab === 'studentDetail' && studentIdFromPath(window.location.pathname) && <StudentDetailPage studentId={studentIdFromPath(window.location.pathname)!} permissions={me.permissions} roles={me.roles} onBack={() => window.history.back()} onNavigate={navigatePath} onError={setError} />}
        {currentTab === 'studentForm' && <LazyStudentCreationWizard canRequestCard={can('cards:request') || can('card:issue')} onCompleted={() => navigateTab('students')} />}
        {currentTab === 'enrollments' && <LazyEnrollmentPanel onError={setError} />}
        {currentTab === 'cards' && <LazyCardsPanel can={can} onError={setError} />}
        {currentTab === 'qr' && <LazyQrPanel can={can} onError={setError} />}
        {currentTab === 'attendance' && <LazyAttendancePanel can={can} onError={setError} />}
        {currentTab === 'services' && <LazyServicesPanel can={can} onError={setError} />}
        {currentTab === 'payments' && <LazyPaymentsPanel can={can} onError={setError} />}
        {currentTab === 'anomalies' && <LazyAnomaliesPanel />}
        </Suspense>
        </PageTransition>
          </AppShell>
          </LocalizationBridge>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
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

function Profile() {
  const { me } = useAuth();
  if (!me) return null;
  const language = useLanguage();
  return (
    <section className="panel stack">
      <div>
        <h2>Profil utilisateur</h2>
        <p>{me.display_name} - {me.username}</p>
      </div>
      <section className="grid2">
        <div className="metric"><span>Roles</span><strong>{me.roles.map((role) => localizeValue(language, role)).join(', ')}</strong></div>
        <div className="metric"><span>Langue</span><strong>{t(language, me.preferred_language === 'en' ? 'english' : 'french')}</strong></div>
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
  const passwordScore = [
    newPassword.length >= 12,
    /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword),
    /\d/.test(newPassword),
    /[^A-Za-z0-9]/.test(newPassword),
    newPassword.length >= 16,
  ].filter(Boolean).length;
  const strengthLabels = ['Tres faible', 'Faible', 'Moyenne', 'Forte', 'Tres forte'];
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
      <div aria-live="polite">
        <progress max={5} value={passwordScore} style={{ width: '100%' }} />
        <small>Force : {strengthLabels[Math.max(0, passwordScore - 1)]}</small>
      </div>
      <button className="primary"><KeyRound size={18} /> Changer</button>
    </form>
  );
}

function MfaPanel({ onError }: { onError: (value: string) => void }) {
  const notify = useToast();
  const [setup, setSetup] = useState<{ provisioning_uri: string; secret_preview: string } | null>(null);
  const [code, setCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  return (
    <section className="panel mfaSetup">
      <div>
        <h2>Configuration de l'authentification à deux facteurs</h2>
        <p className="hint">Scannez le QR avec une application TOTP, puis confirmez avec un code à 6 chiffres.</p>
      </div>
      <button onClick={async () => {
        try {
          const response = await api.mfaSetup();
          setSetup(response);
        } catch {
          onError('Activation MFA refusee');
        }
      }}><ShieldCheck size={18} /> Demarrer MFA</button>
      {setup && (
        <div className="mfaQr">
          <QRCodeSVG value={setup.provisioning_uri} size={220} level="M" />
          <button onClick={() => setShowSecret(!showSecret)}>{showSecret ? 'Masquer le secret' : 'Afficher le secret'}</button>
          {showSecret && <code>{setup.secret_preview}</code>}
        </div>
      )}
      <input inputMode="numeric" maxLength={6} placeholder="Code TOTP à 6 chiffres" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
      <div className="toolbar">
        <button disabled={code.length !== 6} onClick={() => api.mfaConfirm(code).then(() => notify('MFA activé.', 'success')).catch(() => onError('Code MFA invalide'))}>Confirmer la configuration</button>
        <button disabled={code.length !== 6} onClick={() => api.mfaDisable(code).then(() => notify('MFA désactivé.', 'warning')).catch(() => onError('Desactivation refusee'))}>Désactiver</button>
      </div>
    </section>
  );
}

function UsersPanel({ onError }: { onError: (value: string) => void }) {
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ display_name: '', username: '', password: '', confirmation: '', preferred_language: 'fr', role_codes: [] as string[] });
  const [available, setAvailable] = useState<boolean | null>(null);
  async function load() {
    try {
      const [users, roleRows] = await Promise.all([api.users(), api.roles()]);
      setRows(users);
      setRoles(roleRows);
    } catch {
      onError('Acces utilisateurs refuse');
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!/^[a-z0-9._]{4,40}$/.test(form.username)) {
      setAvailable(null);
      return;
    }
    const timer = window.setTimeout(() => api.checkUsername(form.username).then((result) => setAvailable(result.available)), 400);
    return () => window.clearTimeout(timer);
  }, [form.username]);
  function generatePassword() {
    setForm({ ...form, password: `Edu!${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}9A`, confirmation: '' });
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!available || form.password !== form.confirmation || form.role_codes.length === 0) return;
    try {
      await api.createUser(form);
      notify('Utilisateur créé.', 'success');
      setForm({ display_name: '', username: '', password: '', confirmation: '', preferred_language: 'fr', role_codes: [] });
      await load();
    } catch {
      onError("Creation de l'utilisateur refusee");
    }
  }
  return (
    <section className="masterDetail">
      <div className="stack masterList">
        <form className="panel userCreationForm" onSubmit={(event) => void create(event)}>
          <h2>Nouvel utilisateur</h2>
          <div className="grid2">
            <input placeholder="Nom d'affichage" value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
            <div><input placeholder="nom.utilisateur" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })} /><small className={available === false ? 'fieldError' : 'hint'}>{available === true ? 'Nom disponible' : available === false ? 'Nom déjà utilisé' : '4 à 40 caractères : a-z, 0-9, point ou tiret bas'}</small></div>
            <div><input type="password" placeholder="Mot de passe temporaire" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" onClick={generatePassword}>Générer</button></div>
            <input type="password" placeholder="Confirmer le mot de passe" value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })} />
            <select multiple value={form.role_codes} onChange={(event) => setForm({ ...form, role_codes: Array.from(event.target.selectedOptions).map((option) => option.value) })}>
              {roles.map((role) => <option key={String(role.code)} value={String(role.code)}>{String(role.label ?? role.code)}</option>)}
            </select>
            <select value={form.preferred_language} onChange={(event) => setForm({ ...form, preferred_language: event.target.value })}><option value="fr">Français</option><option value="en">English</option></select>
          </div>
          <button className="primary" disabled={!available || form.password.length < 12 || form.password !== form.confirmation || !form.role_codes.length}>Créer l'utilisateur</button>
        </form>
        <div className="panel"><DataTable rows={rows} onRow={setSelected} /></div>
      </div>
      <SlideOverPanel open={Boolean(selected)} title={String(selected?.display_name ?? 'Utilisateur')} onClose={() => setSelected(null)}>
        {selected && <DataTable rows={[selected]} />}
      </SlideOverPanel>
    </section>
  );
}

function TablePanel({ loader, title }: { loader: () => Promise<Array<Record<string, unknown>>>; title: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { void loader().then(setRows); }, [loader]);
  return <section className="panel"><h2>{title}</h2><DataTable rows={rows} /></section>;
}

function ScopesPanel({ onError }: { onError: (value: string) => void }) {
  const notify = useToast();
  const [users, setUsers] = useState<SelectOption[]>([]);
  const [regions, setRegions] = useState<SelectOption[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [user, setUser] = useState<SelectOption | null>(null);
  const [scopeType, setScopeType] = useState('SCHOOL');
  const [target, setTarget] = useState<SelectOption | null>(null);
  useEffect(() => {
    Promise.all([api.users(), api.regions(), api.departments(), api.schools()]).then(([userRows, regionRows, departmentRows, schoolRows]) => {
      setUsers(userRows.map((row) => ({ id: Number(row.id), label: String(row.display_name), subtitle: String(row.username), raw: row })));
      setRegions(regionRows.map((row) => ({ id: Number(row.id), label: String(row.name), subtitle: String(row.capital ?? ''), raw: row })));
      setDepartments(departmentRows.map((row) => ({ id: Number(row.id), label: String(row.name), subtitle: String(row.capital ?? ''), raw: row })));
      setSchools(schoolRows.map((row) => ({ id: Number(row.school_id ?? row.id), label: String(row.school ?? row.name), subtitle: String(row.subdivision ?? ''), raw: row })));
    }).catch(() => onError('Chargement des perimetres refuse'));
  }, [onError]);
  const options = scopeType === 'REGION' ? regions : scopeType === 'DEPARTMENT' ? departments : schools;
  return (
    <form className="panel formGrid" onSubmit={async (event) => {
      event.preventDefault();
      try {
        if (!user) return;
        const payload: Record<string, unknown> = { scope_type: scopeType };
        if (scopeType === 'REGION') payload.region_id = target?.id;
        if (scopeType === 'DEPARTMENT') payload.department_id = target?.id;
        if (scopeType === 'SCHOOL') payload.school_id = target?.id;
        await api.assignScope(user.id, payload);
        notify('Périmètre attribué.', 'success');
      } catch {
        onError('Affectation de perimetre refusee');
      }
    }}>
      <h2>Attribuer un périmètre</h2>
      <SearchSelect label="Utilisateur" options={users} value={user} onChange={setUser} />
      <select value={scopeType} onChange={(event) => { setScopeType(event.target.value); setTarget(null); }}>
        <option value="NATIONAL">National</option><option value="REGION">Région</option><option value="DEPARTMENT">Département</option><option value="SCHOOL">Établissement</option>
      </select>
      {scopeType !== 'NATIONAL' && <SearchSelect label={scopeType === 'REGION' ? 'Région' : scopeType === 'DEPARTMENT' ? 'Département' : 'Établissement'} options={options} value={target} onChange={setTarget} />}
      <button><UserCog size={18} /> Affecter</button>
      {Array.isArray(user?.raw?.scopes) && <DataTable rows={user.raw.scopes as Array<Record<string, unknown>>} />}
    </form>
  );
}

function SchoolMapPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const language = useLanguage();
  const notify = useToast();
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
  const [schoolForm, setSchoolForm] = useState({ subdivision_id: '', code: '', name: '', school_type: 'GENERAL', education_subsystem: 'GENERAL_FR', status: 'ACTIVE' });
  const [yearForm, setYearForm] = useState({ code: '', starts_on: '', ends_on: '', status: 'PLANNED' });
  const [classroomForm, setClassroomForm] = useState({ school_id: '', school_year_id: '', grade_level_id: '', code: '', label: '', capacity: '' });
  const [submitting, setSubmitting] = useState(false);
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
    setSubmitting(true);
    try {
      await action();
      reset();
      await load();
      notify(
        language === 'fr' ? 'Référentiel créé et liste actualisée.' : 'Reference data created and list refreshed.',
        'success',
      );
    } catch {
      onError(language === 'fr' ? 'Opération de carte scolaire refusée.' : 'School map operation denied.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <section className="dashboardTopbar">
        <div>
          <h2><School size={20} /> Administration de la carte scolaire</h2>
          <p>Chaine hierarchique : Administration centrale, delegation regionale, delegation departementale, arrondissement/district, etablissement.</p>
        </div>
        <Button variant="outlined" disabled={submitting} onClick={() => void load()}><RefreshCw size={18} /> Actualiser</Button>
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
            <Button variant="contained" type="submit" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer région'}</Button>
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
            <Button variant="contained" type="submit" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer département'}</Button>
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
            <Button variant="contained" type="submit" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer arrondissement'}</Button>
          </form>
          <form className="panel formGrid" onSubmit={(event) => submit(event, () => api.createSchool({ ...schoolForm, subdivision_id: Number(schoolForm.subdivision_id) }), () => setSchoolForm({ subdivision_id: '', code: '', name: '', school_type: 'GENERAL', education_subsystem: 'GENERAL_FR', status: 'ACTIVE' }))}>
            <h2>Creer un etablissement</h2>
            <select value={schoolForm.subdivision_id} onChange={(event) => setSchoolForm({ ...schoolForm, subdivision_id: event.target.value })}>
              <option value="">Arrondissement / district</option>
              {subdivisions.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.name)} ({String(row.id)})</option>)}
            </select>
            <input placeholder="Code etablissement" value={schoolForm.code} onChange={(event) => setSchoolForm({ ...schoolForm, code: event.target.value })} />
            <input placeholder="Nom d'etablissement fictif" value={schoolForm.name} onChange={(event) => setSchoolForm({ ...schoolForm, name: event.target.value })} />
            <input placeholder="Type" value={schoolForm.school_type} onChange={(event) => setSchoolForm({ ...schoolForm, school_type: event.target.value })} />
            <Button variant="contained" type="submit" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer établissement'}</Button>
          </form>
          <form className="panel formGrid" onSubmit={(event) => submit(event, () => api.createSchoolYear(yearForm), () => setYearForm({ code: '', starts_on: '', ends_on: '', status: 'PLANNED' }))}>
            <h2>Creer annee scolaire</h2>
            <input placeholder="Code, ex. 2027-2028" value={yearForm.code} onChange={(event) => setYearForm({ ...yearForm, code: event.target.value })} />
            <input type="date" value={yearForm.starts_on} onChange={(event) => setYearForm({ ...yearForm, starts_on: event.target.value })} />
            <input type="date" value={yearForm.ends_on} onChange={(event) => setYearForm({ ...yearForm, ends_on: event.target.value })} />
            <Button variant="contained" type="submit" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer année'}</Button>
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
            <Button variant="contained" type="submit" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer classe'}</Button>
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

  if (!regions.length) return (
    <div className="graphEmptyState">
      <p>Aucun nœud visible pour ce périmètre. Vérifiez que des établissements sont rattachés à votre périmètre.</p>
    </div>
  );
  return (
    <div className="graphFrame">
      <div className="graphFrameHeader">
        <div>
          <h3>Graphe des nœuds administratifs</h3>
          <p>Cliquez sur un nœud pour afficher ses informations détaillées.</p>
        </div>
        <button onClick={() => setVisible(!visible)}>{visible ? 'Masquer le graphe' : 'Afficher le graphe'}</button>
      </div>
      {visible && (
        <div className="graphFrameBody">
          <div className="hierarchyGraph">
            {regions.map((region) => (
              <section className="graphLevel" key={region.id}>
                <GraphNode label={region.label} type="Région" count={`${region.departments.length} dép.`} level="region" selected={selectedNode === region.details} onClick={() => setSelectedNode(region.details)} />
                <div className="graphChildren">
                  {region.departments.map((department) => (
                    <section className="graphLevel" key={department.id}>
                      <GraphNode label={department.label} type="Département" count={`${department.subdivisions.length} arr.`} level="department" selected={selectedNode === department.details} onClick={() => setSelectedNode(department.details)} />
                      <div className="graphChildren">
                        {department.subdivisions.map((subdivision) => (
                          <section className="graphLevel" key={subdivision.id}>
                            <GraphNode label={subdivision.label} type="Arrondissement" count={`${subdivision.schools.length} étab.`} level="subdivision" selected={selectedNode === subdivision.details} onClick={() => setSelectedNode(subdivision.details)} />
                            <div className="graphChildren schoolLeaves">
                              {subdivision.schools.map((school) => (
                                <GraphNode key={school.id} label={school.label} type="Établissement" count={school.code} level="school" selected={selectedNode === school.details} onClick={() => setSelectedNode(school.details)} />
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
            {selectedNode ? (
              <>
                <div className="nodeDetailsHeader">
                  <span className={`nodeTypeBadge nodeType-${String((selectedNode as Record<string,unknown>).type ?? '').toLowerCase().replace(/[^a-z]/g, '')}`}>
                    {String((selectedNode as Record<string,unknown>).type ?? '')}
                  </span>
                  <button className="nodeDetailsClose" aria-label="Désélectionner" onClick={() => setSelectedNode(null)}>✕</button>
                </div>
                <dl className="nodeDetailsList">
                  {Object.entries(selectedNode as Record<string, unknown>)
                    .filter(([k]) => k !== 'type')
                    .map(([key, value]) => (
                      <div key={key} className="nodeDetailsRow">
                        <dt>{key.replace(/_/g, ' ')}</dt>
                        <dd>{value == null || value === '' ? <span className="nodeDetailsEmpty">—</span> : String(value)}</dd>
                      </div>
                    ))}
                </dl>
              </>
            ) : (
              <div className="nodeDetailsPlaceholder">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="3" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="21" />
                  <line x1="3" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="21" y2="12" />
                </svg>
                <p>Cliquez sur un nœud du graphe pour afficher ses détails ici.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function GraphNode({ label, type, count, level, selected, onClick }: { label: string; type: string; count: string; level: string; selected?: boolean; onClick: () => void }) {
  return (
    <button
      className={`graphNode ${level}${selected ? ' active' : ''}`}
      onClick={onClick}
      title={`${type} : ${label}`}
      aria-pressed={selected}
    >
      <span>{type}</span>
      <strong>{label}</strong>
      <small>{count}</small>
    </button>
  );
}

function SessionPanel({ onError }: { onError: (value: string) => void }) {
  return <SessionsManagementPage onError={onError} />;
}

function DashboardPanel({ roles, onNavigate, onError }: { roles: string[]; onNavigate: (tab: Tab) => void; onError: (value: string) => void }) {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const firstLoad = useRef(true);
  const [regions, setRegions] = useState<SelectOption[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [years, setYears] = useState<SelectOption[]>([]);
  const [region, setRegion] = useState<SelectOption | null>(null);
  const [department, setDepartment] = useState<SelectOption | null>(null);
  const [school, setSchool] = useState<SelectOption | null>(null);
  const [year, setYear] = useState<SelectOption | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [kpis, setKpis] = useState<Array<Record<string, unknown>>>([]);
  const [pending, setPending] = useState<{ total: number; items: Array<Record<string, unknown>> }>({ total: 0, items: [] });
  const [charts, setCharts] = useState<Array<{ title: string; rows: Array<Record<string, unknown>> }>>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    try {
      const query = new URLSearchParams();
      if (region) query.set('region_id', String(region.id));
      else if (firstLoad.current && initialParams.get('region_id')) query.set('region_id', initialParams.get('region_id')!);
      if (department) query.set('department_id', String(department.id));
      else if (firstLoad.current && initialParams.get('department_id')) query.set('department_id', initialParams.get('department_id')!);
      if (school) query.set('school_id', String(school.id));
      else if (firstLoad.current && initialParams.get('school_id')) query.set('school_id', initialParams.get('school_id')!);
      if (year) query.set('year_id', String(year.id));
      else if (firstLoad.current && initialParams.get('year_id')) query.set('year_id', initialParams.get('year_id')!);
      firstLoad.current = false;
      const params = query.size ? `?${query}` : '';
      const [summary, cards, attendance, payments, security, services, kpiResponse, pendingResponse] = await Promise.all([
        api.dashboardSummary(params),
        api.dashboardCards(params),
        api.dashboardAttendance(params),
        api.dashboardPayments(params),
        api.dashboardSecurity(),
        api.dashboardServices(),
        api.dashboardKpi(params),
        api.pendingActions(),
      ]);
      setData(summary);
      setKpis((kpiResponse.items ?? []) as Array<Record<string, unknown>>);
      setPending(pendingResponse as { total: number; items: Array<Record<string, unknown>> });
      setCharts([
        { title: 'Tendance de présence', rows: (kpiResponse.trend ?? []) as Array<Record<string, unknown>> },
        { title: 'Cartes', rows: (cards.distribution ?? []) as Array<Record<string, unknown>> },
        { title: 'Presence', rows: (attendance.distribution ?? []) as Array<Record<string, unknown>> },
        { title: 'Paiements simules', rows: (payments.distribution ?? []) as Array<Record<string, unknown>> },
        { title: 'Securite', rows: (security.distribution ?? []) as Array<Record<string, unknown>> },
        { title: 'Services', rows: (services.distribution ?? []) as Array<Record<string, unknown>> },
      ]);
    } catch {
      onError('Dashboard refuse');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    Promise.all([api.regions(), api.departments(), api.schools(), api.schoolYears()]).then(([regionRows, departmentRows, schoolRows, yearRows]) => {
      const regionOptions = regionRows.map((row) => ({ id: Number(row.id), label: String(row.name), raw: row }));
      const departmentOptions = departmentRows.map((row) => ({ id: Number(row.id), label: String(row.name), raw: row }));
      const schoolOptions = schoolRows.map((row) => ({ id: Number(row.school_id ?? row.id), label: String(row.school ?? row.name), subtitle: String(row.subdivision ?? ''), raw: row }));
      const yearOptions = yearRows.map((row) => ({ id: Number(row.id), label: String(row.code), subtitle: String(row.status), raw: row }));
      setRegions(regionOptions);
      setDepartments(departmentOptions);
      setSchools(schoolOptions);
      setYears(yearOptions);
      setRegion(regionOptions.find((item) => item.id === Number(initialParams.get('region_id'))) ?? null);
      setDepartment(departmentOptions.find((item) => item.id === Number(initialParams.get('department_id'))) ?? null);
      setSchool(schoolOptions.find((item) => item.id === Number(initialParams.get('school_id'))) ?? null);
      setYear(yearOptions.find((item) => item.id === Number(initialParams.get('year_id'))) ?? null);
    }).catch(() => onError('Chargement filtres refuse'));
    void load();
  }, []);
  function persistFilters() {
    const query = new URLSearchParams();
    if (region) query.set('region_id', String(region.id));
    if (department) query.set('department_id', String(department.id));
    if (school) query.set('school_id', String(school.id));
    if (year) query.set('year_id', String(year.id));
    window.history.replaceState({}, '', `${window.location.pathname}${query.size ? `?${query}` : ''}`);
  }
  const metrics = (data?.metrics ?? {}) as Record<string, unknown>;
  const categories = [
    {
      key: 'school',
      title: 'Scolarite',
      description: 'Effectifs, inscriptions et couverture des etablissements.',
      metrics: ['active_students', 'enrollments', 'schools', 'duplicates_detected'],
      target: 'students' as Tab,
    },
    {
      key: 'cards',
      title: 'Cartes scolaires',
      description: 'Cycle de vie administratif des cartes.',
      metrics: ['cards_requested', 'cards_issued', 'cards_active', 'cards_suspended', 'cards_revoked', 'cards_replaced', 'issuance_rate', 'average_issuance_delay_hours'],
      target: 'dashCards' as Tab,
    },
    {
      key: 'attendance',
      title: 'Presences',
      description: 'Pointages, retards et absences.',
      metrics: ['attendance', 'late', 'absences'],
      target: 'dashAttendance' as Tab,
    },
    {
      key: 'services',
      title: 'Services',
      description: 'Consommations et validations de droits fictifs.',
      metrics: ['services_consumed'],
      target: 'dashServices' as Tab,
    },
    {
      key: 'payments',
      title: 'Paiements simules',
      description: 'Transactions fictives et rapprochements.',
      metrics: ['mock_transactions', 'reconciliation_rate'],
      target: 'dashPayments' as Tab,
    },
    {
      key: 'security',
      title: 'Alertes et securite',
      description: 'Incidents, refus, QR invalides, exports et alertes.',
      metrics: ['incidents_open', 'incidents_resolved', 'failed_logins', 'access_denied', 'qr_invalid', 'exports', 'alerts'],
      target: 'dashSecurity' as Tab,
    },
  ].map((category) => ({
    ...category,
    entries: category.metrics.filter((metric) => Object.prototype.hasOwnProperty.call(metrics, metric)).map((metric) => [metric, metrics[metric]] as [string, unknown]),
  })).filter((category) => category.entries.length);
  if (loading) return <PageSkeleton />;
  return (
    <Stack sx={{ gap: 2 }}>
      <div className="dashboardTopbar">
        <div>
          <Typography variant="h6" sx={{ fontWeight: 700 }}><BarChart3 size={20} /> Tableau de bord central</Typography>
          <p>Vue adaptée au rôle : {roles.join(', ')}</p>
        </div>
      </div>
      <Paper className="dashboardFilters" variant="outlined" sx={{ p: 2 }}>
          <SearchSelect label="Région" options={regions} value={region} onChange={(value) => { setRegion(value); setDepartment(null); setSchool(null); }} />
          <SearchSelect label="Département" options={departments.filter((item) => !region || Number(item.raw?.region_id) === region.id)} value={department} onChange={(value) => { setDepartment(value); setSchool(null); }} />
          <SearchSelect label="Établissement" options={schools.filter((item) => !department || Number(item.raw?.department_id) === department.id)} value={school} onChange={setSchool} />
          <SearchSelect label="Année scolaire" options={years} value={year} onChange={setYear} />
          <Button variant="contained" onClick={() => { persistFilters(); void load(); }}><RefreshCw size={18} /> Filtrer</Button>
          <Button variant="outlined" onClick={() => { setRegion(null); setDepartment(null); setSchool(null); setYear(null); window.history.replaceState({}, '', window.location.pathname); }}>Réinitialiser</Button>
      </Paper>
      <Box className="roleKpis" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1.5 }}>
        {kpis.map((item) => <button className="actionKpi" key={String(item.key)} onClick={() => onNavigate(String(item.target) as Tab)}><strong>{String(item.value)}{String(item.suffix ?? '')}</strong><span>{localizeField('fr', String(item.key))}</span><small>{Number(item.delta) >= 0 ? '↑' : '↓'} {Math.abs(Number(item.delta))}% vs période précédente</small></button>)}
      </Box>
      <Paper className="pendingActions" variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Actions en attente ({pending.total})</Typography>
        {pending.items.map((item) => <button key={String(item.key)} onClick={() => onNavigate(String(item.target) as Tab)}><span>{localizeField('fr', String(item.key))}</span><strong>{String(item.count)}</strong></button>)}
      </Paper>
      {categories.length ? categories.map((category) => (
        <section className="dashboardCategory" key={category.key}>
          <div className="categoryHeader">
            <div><Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{category.title}</Typography><p>{category.description}</p></div>
            <Button variant="outlined" onClick={() => onNavigate(category.target)}>Voir le détail</Button>
          </div>
          <div className="kpiGrid">
            {category.entries.map(([key, value]) => <KpiCard key={key} label={key} value={value} />)}
          </div>
        </section>
      )) : <p>Aucun indicateur charge</p>}
      <section className="chartGrid">
        {charts.map((chart) => (
          <section className="panel" key={chart.title}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{chart.title}</Typography>
            <BarChart rows={chart.rows} />
          </section>
        ))}
      </section>
    </Stack>
  );
}

function KpiCard({ label, value }: { label: string; value: unknown }) {
  const language = useLanguage();
  return <MetricCard label={localizeField(language, label)} value={value} />;
}

function BarChart({ rows }: { rows: Array<Record<string, unknown>> }) {
  const language = useLanguage();
  if (!rows.length) return <p>Aucune donnee graphique</p>;
  return (
    <div className="materialChart">
      <Bar
        data={{
          labels: rows.map((row) => localizeValue(language, row.label)),
          datasets: [{
            label: 'Total',
            data: rows.map((row) => typeof row.value === 'number' ? row.value : Number(row.value ?? 0)),
            backgroundColor: '#1a73e8',
            borderRadius: 5,
            maxBarThickness: 38,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#7b809a' },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(123,128,154,.16)' },
              ticks: { color: '#7b809a', precision: 0 },
            },
          },
        }}
      />
    </div>
  );
}

function ExportsPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  return <ControlledExportsPage canCreate={can('export:create')} canDownload={can('export:download')} onError={onError} />;
  /*
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
  );*/
}

function AuditPanel({ onError }: { onError: (value: string) => void }) {
  return <AuditLogPage onError={onError} />;
  /*
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    api.auditEvents()
      .then((response) => setRows(Array.isArray(response) ? response : response.items))
      .catch(() => onError('Lecture audit refusee'));
  }, [onError]);
  return <section className="panel"><h2>Audit</h2><DataTable rows={rows} /></section>;*/
}

function IntegrityPanel({ onError, onNavigateIncident }: { onError: (value: string) => void; onNavigateIncident: () => void }) {
  return <IntegrityCheckPage onNavigateIncident={onNavigateIncident} onError={onError} />;
  /*
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { api.auditIntegrity().then(setResult).catch(() => onError('Verification integrite refusee')); }, [onError]);
  return <section className="panel"><h2>Integrite audit</h2><pre>{JSON.stringify(result, null, 2)}</pre></section>;*/
}

function AlertsPanel({ onError, onCreateIncident }: { onError: (value: string) => void; onCreateIncident: (alert: Record<string, unknown>) => void }) {
  return <AlertsPage onCreateIncident={onCreateIncident} onError={onError} />;
  /*
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    try { setRows(await api.alerts()); } catch { onError('Lecture alertes refusee'); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="panel"><h2>Alertes</h2><DataTable rows={rows} onRow={(row) => api.acknowledgeAlert(Number(row.id)).then(load).catch(() => onError('Accuse refuse'))} /></section>;*/
}

function IncidentsPanel({ can, initialAlert, onError }: { can: (permission: string) => boolean; initialAlert: Record<string, unknown> | null; onError: (value: string) => void }) {
  return <IncidentsPage canCreate={can('incident:create')} initialAlert={initialAlert} onError={onError} />;
  /*
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState('');
  async function load() {
    try { setRows(await api.incidents()); } catch { onError('Lecture incidents refusee'); }
  }
  useEffect(() => { void load(); }, []);
  return (
    <section className="stack">
      {can('incident:create') && <button className="primary" onClick={() => api.createIncident({ category: 'ACCES_HORS_PERIMETRE_SIMULE', priority: 'MEDIUM', severity: 'MEDIUM', comment: 'Incident fictif de securite' }).then(load).catch(() => onError('Creation incident refusee'))}>Creer incident</button>}
      <div className="panel"><DataTable rows={rows} onRow={(row) => setSelected(String(row.id ?? ''))} /></div>
      {can('incident:update') && <div className="toolbar"><input placeholder="ID incident" value={selected} onChange={(event) => setSelected(event.target.value)} /><button onClick={() => api.updateIncident(Number(selected), { status: 'RESOLVED', comment: 'Resolution fictive' }).then(load).catch(() => onError('Resolution refusee'))}>Resoudre</button></div>}
    </section>
  );*/
}

function PrivacyPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  return <PrivacyGovernancePage canManage={can('privacy:update')} onError={onError} />;
  /*
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
      <section className="panel"><h2>Registre</h2>{can('privacy:update') && <button onClick={() => api.createProcessingRegister({ processing_name: `Traitement fictif ${Date.now()}`, purpose: 'Demonstration locale avec donnees synthetiques', data_categories: 'Donnees synthetiques' }).then(load).catch(() => onError('Creation registre refusee'))}>Ajouter traitement</button>}<DataTable rows={register} /></section>
    </section>
  );*/
}

function RetentionPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  return <RetentionRulesPage canManage={can('privacy:update')} onError={onError} />;
  /*
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    try { setRows(await api.retentionRules()); } catch { onError('Lecture retention refusee'); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="panel"><h2>Retention</h2>{can('privacy:update') && <button onClick={() => api.createRetentionRule({ resource_type: `demo-${Date.now()}`, retention_period_days: 30 }).then(load).catch(() => onError('Creation regle refusee'))}>Ajouter regle</button>}<DataTable rows={rows} /></section>;*/
}

function SecuritySettingsPanel() {
  return (
    <Stack sx={{ gap: 2 }}>
      <Alert severity="info" variant="outlined">
        Ces paramètres reflètent la configuration statique du prototype. Dans une version de production, ils seraient issus d'un endpoint de diagnostic système.
      </Alert>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <DataTable rows={[
          { contrôle: 'CSRF', statut: 'actif' },
          { contrôle: 'Cookies HttpOnly', statut: 'actif' },
          { contrôle: 'En-têtes de sécurité', statut: 'actif' },
          { contrôle: 'Biométrie', statut: 'désactivée (prototype)' },
        ]} />
      </Paper>
    </Stack>
  );
}

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </GlobalErrorBoundary>,
);

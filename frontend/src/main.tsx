import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KeyRound, LogOut, RefreshCw, ShieldCheck, UserCog, UsersRound } from 'lucide-react';
import { api, Me, setCsrf } from './api';
import './styles.css';

type Tab = 'profile' | 'password' | 'mfa' | 'users' | 'roles' | 'permissions' | 'scopes' | 'sessions';

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

  if (!me) {
    return <Login onLogin={loadMe} />;
  }

  const tabs: Array<[Tab, string]> = [
    ['profile', 'Profil'],
    ['password', 'Mot de passe'],
    ['mfa', 'MFA'],
    ['users', 'Utilisateurs'],
    ['roles', 'Roles'],
    ['permissions', 'Permissions'],
    ['scopes', 'Perimetres'],
    ['sessions', 'Sessions'],
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
          {tabs.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="iconText" onClick={logout}>
          <LogOut size={18} /> Deconnexion
        </button>
      </aside>
      <section className="workspace">
        <header>
          <div>
            <h1>{me.display_name}</h1>
            <p>{me.roles.join(', ')}</p>
          </div>
          <button className="iconButton" onClick={() => void loadMe()} title="Actualiser">
            <RefreshCw size={20} />
          </button>
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
      </section>
    </main>
  );
}

function Login({ onLogin }: { onLogin: () => Promise<void> }) {
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
      setError('Authentification refusee');
    }
  }

  return (
    <main className="loginScreen">
      <form className="loginPanel" onSubmit={submit}>
        <ShieldCheck size={36} />
        <h1>EduCard Secure</h1>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Utilisateur" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mot de passe" type="password" />
        {needsMfa && <input value={mfa} onChange={(event) => setMfa(event.target.value)} placeholder="Code MFA" />}
        {error && <div className="alert">{error}</div>}
        <button className="primary" type="submit">
          <KeyRound size={18} /> Connexion
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
  return <section className="panel"><UsersRound size={24} /><p>Session courante protegee par cookie HttpOnly et jeton CSRF.</p></section>;
}

function DataTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const keys = useMemo(() => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8), [rows]);
  return (
    <table>
      <thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{keys.map((key) => <td key={key}>{String(row[key] ?? '')}</td>)}</tr>)}</tbody>
    </table>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

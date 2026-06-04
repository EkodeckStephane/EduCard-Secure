import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CreditCard, FileClock, KeyRound, LogOut, RefreshCw, School, ShieldCheck, UserCog, UsersRound } from 'lucide-react';
import { api, Card, Me, setCsrf, Student } from './api';
import './styles.css';

type Tab = 'profile' | 'password' | 'mfa' | 'users' | 'roles' | 'permissions' | 'scopes' | 'sessions' | 'students' | 'studentForm' | 'enrollments' | 'cards' | 'qr' | 'attendance' | 'services' | 'payments' | 'anomalies';

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

  const can = (permission: string) => me.permissions.includes(permission);
  const tabs: Array<[Tab, string, boolean]> = [
    ['profile', 'Profil', true],
    ['password', 'Mot de passe', true],
    ['mfa', 'MFA', true],
    ['users', 'Utilisateurs', can('user:create') || can('user:update')],
    ['roles', 'Roles', can('role:assign')],
    ['permissions', 'Permissions', can('role:assign')],
    ['scopes', 'Perimetres', can('role:assign')],
    ['sessions', 'Sessions', true],
    ['students', 'Eleves', can('student:read')],
    ['studentForm', 'Nouvel eleve', can('student:create')],
    ['enrollments', 'Inscriptions', can('student:update')],
    ['cards', 'Cartes', can('card:verify') || can('card:issue')],
    ['qr', 'QR', can('card:verify') || can('card:issue')],
    ['attendance', 'Presence', can('attendance:read') || can('attendance:create')],
    ['services', 'Services', can('service:verify') || can('service:manage')],
    ['payments', 'Paiements', can('payment:read') || can('payment:create')],
    ['anomalies', 'Anomalies', can('audit:read') || can('card:verify')],
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

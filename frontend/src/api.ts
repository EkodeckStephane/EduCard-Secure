export type Me = {
  public_id: string;
  username: string;
  display_name: string;
  preferred_language: 'fr' | 'en';
  roles: string[];
  permissions: string[];
  scopes: Array<Record<string, unknown>>;
};

export type Student = {
  id: number;
  public_id: string;
  student_number: string;
  last_name: string;
  first_name: string;
  birth_date: string;
  status: string;
  current_school_id: number | null;
  current_classroom_id: number | null;
  record_version: number;
};

export type StudentList = {
  items: Student[];
  total: number;
  page: number;
  page_size: number;
};

export type Card = {
  id: number;
  public_id: string;
  student_id: number;
  serial_number: string;
  card_version: number;
  status: string;
  issued_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

let csrfToken = '';

export function setCsrf(token: string) {
  csrfToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

async function requestText(path: string, options: RequestInit = {}): Promise<string> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.text();
}

export const api = {
  login: (username: string, password: string, mfaCode?: string) =>
    request<{ mfa_required: boolean; csrf_token?: string; user_id?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, mfa_code: mfaCode || undefined }),
    }),
  logout: () => request<{ status: string }>('/api/v1/auth/logout', { method: 'POST' }),
  me: () => request<Me>('/api/v1/auth/me'),
  setLanguage: (preferred_language: 'fr' | 'en') =>
    request<{ status: string; preferred_language: 'fr' | 'en' }>('/api/v1/auth/language', {
      method: 'POST',
      body: JSON.stringify({ preferred_language }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ status: string }>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  mfaSetup: () => request<{ provisioning_uri: string; secret_preview: string }>('/api/v1/auth/mfa/setup', { method: 'POST' }),
  mfaConfirm: (code: string) => request<{ status: string }>('/api/v1/auth/mfa/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  mfaDisable: (code: string) => request<{ status: string }>('/api/v1/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
  users: () => request<Array<Record<string, unknown>>>('/api/v1/users'),
  roles: () => request<Array<Record<string, unknown>>>('/api/v1/roles'),
  permissions: () => request<Array<Record<string, unknown>>>('/api/v1/permissions'),
  createUser: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/users', { method: 'POST', body: JSON.stringify(payload) }),
  assignScope: (id: number, payload: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/v1/users/${id}/scopes`, { method: 'POST', body: JSON.stringify(payload) }),
  students: (params = '') => request<StudentList>(`/api/v1/students${params}`),
  student: (id: number) => request<Student>(`/api/v1/students/${id}`),
  createStudent: (payload: Record<string, unknown>) => request<Student>('/api/v1/students', { method: 'POST', body: JSON.stringify(payload) }),
  updateStudent: (id: number, payload: Record<string, unknown>) => request<Student>(`/api/v1/students/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveStudent: (id: number) => request<Student>(`/api/v1/students/${id}/archive`, { method: 'POST' }),
  studentHistory: (id: number) => request<Array<Record<string, unknown>>>(`/api/v1/students/${id}/history`),
  duplicateCandidates: (id: number) => request<Array<Record<string, unknown>>>(`/api/v1/students/${id}/duplicate-candidates`),
  enroll: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/enrollments', { method: 'POST', body: JSON.stringify(payload) }),
  transfer: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/transfers', { method: 'POST', body: JSON.stringify(payload) }),
  cards: () => request<Card[]>('/api/v1/cards'),
  card: (id: number) => request<Card>(`/api/v1/cards/${id}`),
  createCard: (payload: Record<string, unknown>) => request<Card>('/api/v1/cards', { method: 'POST', body: JSON.stringify(payload) }),
  cardAction: (id: number, action: string, reason: string) => request<Card>(`/api/v1/cards/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason }) }),
  cardHistory: (id: number) => request<Record<string, Array<Record<string, unknown>>>>(`/api/v1/cards/${id}/history`),
  generateQr: (id: number, ttl_minutes = 60) => request<Record<string, unknown>>(`/api/v1/cards/${id}/qr/generate`, { method: 'POST', body: JSON.stringify({ ttl_minutes }) }),
  verifyQr: (payload: string) => request<Record<string, unknown>>('/api/v1/cards/verify', { method: 'POST', body: JSON.stringify({ payload }) }),
  attendance: (params = '') => request<Array<Record<string, unknown>>>(`/api/v1/attendance${params}`),
  checkIn: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/attendance/check-in', { method: 'POST', body: JSON.stringify(payload) }),
  checkOut: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/attendance/check-out', { method: 'POST', body: JSON.stringify(payload) }),
  correctAttendance: (id: number, payload: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/attendance/${id}/correct`, { method: 'POST', body: JSON.stringify(payload) }),
  approveAttendance: (id: number) => request<Record<string, unknown>>(`/api/v1/attendance/${id}/approve-correction`, { method: 'POST' }),
  services: () => request<Array<Record<string, unknown>>>('/api/v1/services'),
  createEntitlement: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/services/entitlements', { method: 'POST', body: JSON.stringify(payload) }),
  verifyService: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/services/verify', { method: 'POST', body: JSON.stringify(payload) }),
  payments: () => request<Array<Record<string, unknown>>>('/api/v1/payments'),
  mockPayment: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/payments/mock', { method: 'POST', body: JSON.stringify(payload) }),
  reconcilePayment: (id: number, notes = 'Rapprochement fictif') => request<Record<string, unknown>>(`/api/v1/payments/${id}/reconcile`, { method: 'POST', body: JSON.stringify({ notes }) }),
  reconciliations: () => request<Array<Record<string, unknown>>>('/api/v1/payments/reconciliations'),
  dashboardSummary: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/summary${params}`),
  dashboardCards: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/cards${params}`),
  dashboardAttendance: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/attendance${params}`),
  dashboardPayments: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/payments${params}`),
  dashboardSecurity: () => request<Record<string, unknown>>('/api/v1/dashboard/security'),
  dashboardServices: () => request<Record<string, unknown>>('/api/v1/dashboard/services'),
  createExport: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/exports', { method: 'POST', body: JSON.stringify(payload) }),
  exports: () => request<Array<Record<string, unknown>>>('/api/v1/exports'),
  exportDetail: (id: number) => request<Record<string, unknown>>(`/api/v1/exports/${id}`),
  downloadExport: (id: number) => requestText(`/api/v1/exports/${id}/download`, { method: 'POST' }),
  auditEvents: () => request<Array<Record<string, unknown>>>('/api/v1/audit/events'),
  auditIntegrity: () => request<Record<string, unknown>>('/api/v1/audit/integrity'),
  alerts: () => request<Array<Record<string, unknown>>>('/api/v1/alerts'),
  acknowledgeAlert: (id: number) => request<Record<string, unknown>>(`/api/v1/alerts/${id}/ack`, { method: 'POST' }),
  incidents: () => request<Array<Record<string, unknown>>>('/api/v1/incidents'),
  createIncident: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  updateIncident: (id: number, payload: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  privacyRequests: () => request<Array<Record<string, unknown>>>('/api/v1/privacy/requests'),
  createPrivacyRequest: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/privacy/requests', { method: 'POST', body: JSON.stringify(payload) }),
  processingRegister: () => request<Array<Record<string, unknown>>>('/api/v1/privacy/register'),
  createProcessingRegister: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/privacy/register', { method: 'POST', body: JSON.stringify(payload) }),
  retentionRules: () => request<Array<Record<string, unknown>>>('/api/v1/privacy/retention'),
  createRetentionRule: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/privacy/retention', { method: 'POST', body: JSON.stringify(payload) }),
  backups: () => request<Array<Record<string, unknown>>>('/api/v1/backups'),
};

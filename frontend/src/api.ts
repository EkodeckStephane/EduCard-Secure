export type Me = {
  public_id: string;
  username: string;
  display_name: string;
  preferred_language: 'fr' | 'en';
  preferred_theme: 'light' | 'dark' | 'system';
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
  gender?: string | null;
  photo_url?: string | null;
  current_enrollment?: Record<string, unknown> | null;
  active_card_status?: string | null;
  active_services_count?: number;
  last_activity?: Record<string, unknown> | null;
  guardian?: Record<string, unknown> | null;
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

export type SchoolHierarchy = {
  scopes: Array<Record<string, unknown>>;
  schools: Array<Record<string, unknown>>;
};

let csrfToken = '';
let pendingRequests = 0;

function updatePendingRequests(delta: number) {
  pendingRequests = Math.max(0, pendingRequests + delta);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('educard-api-pending', { detail: pendingRequests }));
  }
}

async function trackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  updatePendingRequests(1);
  try {
    return await fetch(input, init);
  } finally {
    updatePendingRequests(-1);
  }
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  code: string | null;

  constructor(status: number, body: string) {
    let detail: unknown = body;
    let code: string | null = null;
    try {
      const parsed = JSON.parse(body) as { detail?: unknown; code?: string };
      detail = parsed.detail ?? parsed;
      code = parsed.code ?? null;
    } catch {
      // Keep the plain response body.
    }
    super(typeof detail === 'string' ? detail : `API request failed with status ${status}`);
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

export function setCsrf(token: string) {
  csrfToken = token;
}

function cookieValue(name: string): string {
  if (typeof document === 'undefined') return '';
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

function currentCsrfToken(): string {
  return csrfToken || cookieValue('educard_csrf');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const effectiveCsrfToken = currentCsrfToken();
  const response = await trackedFetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(effectiveCsrfToken ? { 'X-CSRF-Token': effectiveCsrfToken } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    window.dispatchEvent(new CustomEvent('educard-api-error', { detail: { status: response.status, path, body, requestId: response.headers.get('X-Request-ID') } }));
    throw new ApiError(response.status, body);
  }
  return response.json() as Promise<T>;
}

async function requestText(path: string, options: RequestInit = {}): Promise<string> {
  const effectiveCsrfToken = currentCsrfToken();
  const response = await trackedFetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(effectiveCsrfToken ? { 'X-CSRF-Token': effectiveCsrfToken } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    window.dispatchEvent(new CustomEvent('educard-api-error', { detail: { status: response.status, path, body, requestId: response.headers.get('X-Request-ID') } }));
    throw new ApiError(response.status, body);
  }
  return response.text();
}

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const effectiveCsrfToken = currentCsrfToken();
  const response = await trackedFetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: effectiveCsrfToken ? { 'X-CSRF-Token': effectiveCsrfToken } : {},
    body,
  });
  if (!response.ok) {
    const body = await response.text();
    window.dispatchEvent(new CustomEvent('educard-api-error', { detail: { status: response.status, path, body, requestId: response.headers.get('X-Request-ID') } }));
    throw new ApiError(response.status, body);
  }
  return response.json() as Promise<T>;
}

async function requestDownload(path: string, options: RequestInit = {}): Promise<{ blob: Blob; filename: string }> {
  const response = await trackedFetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(currentCsrfToken() ? { 'X-CSRF-Token': currentCsrfToken() } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    window.dispatchEvent(new CustomEvent('educard-api-error', { detail: { status: response.status, path, body, requestId: response.headers.get('X-Request-ID') } }));
    throw new ApiError(response.status, body);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'educard-export.json';
  return { blob: await response.blob(), filename };
}

export const api = {
  login: (username: string, password: string, mfaCode?: string) =>
    request<{ mfa_required: boolean; csrf_token?: string; user_id?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, mfa_code: mfaCode || undefined }),
    }),
  logout: async () => {
    const result = await request<{ status: string }>('/api/v1/auth/logout', { method: 'POST' });
    setCsrf('');
    return result;
  },
  me: () => request<Me>('/api/v1/auth/me'),
  setLanguage: (preferred_language: 'fr' | 'en') =>
    request<{ status: string; preferred_language: 'fr' | 'en' }>('/api/v1/auth/language', {
      method: 'POST',
      body: JSON.stringify({ preferred_language }),
    }),
  setTheme: (preferred_theme: 'light' | 'dark' | 'system') =>
    request<{ status: string; preferred_theme: 'light' | 'dark' | 'system' }>('/api/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ preferred_theme }),
    }),
  sessions: () => request<Array<Record<string, unknown>>>('/api/v1/auth/sessions'),
  revokeSession: (sessionId: string) => request<Record<string, unknown>>(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  revokeOtherSessions: () => request<Record<string, unknown>>('/api/v1/auth/sessions/others', { method: 'DELETE' }),
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
  checkUsername: (username: string) => request<{ username: string; available: boolean }>(`/api/v1/users/check-username?q=${encodeURIComponent(username)}`),
  assignRoles: (id: number, role_codes: string[]) => request<Record<string, unknown>>(`/api/v1/users/${id}/roles`, { method: 'POST', body: JSON.stringify({ role_codes }) }),
  assignScope: (id: number, payload: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/v1/users/${id}/scopes`, { method: 'POST', body: JSON.stringify(payload) }),
  removeScope: (userId: number, scopeId: number) => request<Record<string, unknown>>(`/api/v1/users/${userId}/scopes/${scopeId}`, { method: 'DELETE' }),
  schoolHierarchy: () => request<SchoolHierarchy>('/api/v1/school-map/hierarchy'),
  regions: () => request<Array<Record<string, unknown>>>('/api/v1/school-map/regions'),
  departments: () => request<Array<Record<string, unknown>>>('/api/v1/school-map/departments'),
  subdivisions: () => request<Array<Record<string, unknown>>>('/api/v1/school-map/subdivisions'),
  schools: (search = '') => request<Array<Record<string, unknown>>>(`/api/v1/schools${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  classrooms: (schoolId?: number, yearId?: number) => {
    const params = new URLSearchParams();
    if (schoolId) params.set('school_id', String(schoolId));
    if (yearId) params.set('academic_year_id', String(yearId));
    params.set('with_capacity', 'true');
    return request<Array<Record<string, unknown>>>(`/api/v1/classes?${params}`);
  },
  schoolYears: () => request<Array<Record<string, unknown>>>('/api/v1/school-map/school-years'),
  gradeLevels: () => request<Array<Record<string, unknown>>>('/api/v1/school-map/grade-levels'),
  updateGradeLevel: (id: number, active: boolean) => request<Record<string, unknown>>(`/api/v1/academic-levels/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  pendingValidations: () => request<Array<Record<string, unknown>>>('/api/v1/admin/pending-validations'),
  approveValidation: (id: number, comment = '') => request<Record<string, unknown>>(`/api/v1/admin/validations/${id}/approve`, { method: 'POST', body: JSON.stringify({ comment }) }),
  rejectValidation: (id: number, reason: string) => request<Record<string, unknown>>(`/api/v1/admin/validations/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  createRegion: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/school-map/regions', { method: 'POST', body: JSON.stringify(payload) }),
  createDepartment: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/school-map/departments', { method: 'POST', body: JSON.stringify(payload) }),
  createSubdivision: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/school-map/subdivisions', { method: 'POST', body: JSON.stringify(payload) }),
  createSchool: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/school-map/schools', { method: 'POST', body: JSON.stringify(payload) }),
  createClassroom: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/school-map/classrooms', { method: 'POST', body: JSON.stringify(payload) }),
  createSchoolYear: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/school-map/school-years', { method: 'POST', body: JSON.stringify(payload) }),
  students: (params = '') => request<StudentList>(`/api/v1/students${params}`),
  student: (id: number) => request<Student>(`/api/v1/students/${id}`),
  studentSummary: (id: number) => request<Student>(`/api/v1/students/${id}/summary`),
  createStudent: (payload: Record<string, unknown>) => request<Student>('/api/v1/students', { method: 'POST', body: JSON.stringify(payload) }),
  updateStudent: (id: number, payload: Record<string, unknown>) => request<Student>(`/api/v1/students/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveStudent: (id: number, payload: Record<string, unknown>) => request<Student>(`/api/v1/students/${id}/archive`, { method: 'PATCH', body: JSON.stringify(payload) }),
  studentHistory: (id: number) => request<Array<Record<string, unknown>>>(`/api/v1/students/${id}/history`),
  studentEnrollments: (id: number) => request<Array<Record<string, unknown>>>(`/api/v1/students/${id}/enrollments`),
  studentCards: (id: number) => request<Array<Record<string, unknown>>>(`/api/v1/students/${id}/cards`),
  studentServices: (id: number) => request<Record<string, Array<Record<string, unknown>>>>(`/api/v1/students/${id}/services`),
  studentDuplicates: (id: number) => request<Array<Record<string, unknown>>>(`/api/v1/students/${id}/duplicates`),
  duplicateCandidates: (id: number) => request<Array<Record<string, unknown>>>(`/api/v1/students/${id}/duplicate-candidates`),
  findDuplicates: (lastName: string, firstName: string, birthDate: string, schoolId?: number) => {
    const params = new URLSearchParams({ last_name: lastName, first_name: firstName, birth_date: birthDate });
    if (schoolId) params.set('school_id', String(schoolId));
    return request<Array<Record<string, unknown>>>(`/api/v1/students/duplicates?${params}`);
  },
  confirmDuplicate: (id: number) => request<Record<string, unknown>>(`/api/v1/students/duplicates/${id}/confirm`, { method: 'POST' }),
  rejectDuplicate: (id: number, referenceStudentId: number, reason: string) => request<Record<string, unknown>>(`/api/v1/students/duplicates/${id}/reject`, { method: 'POST', body: JSON.stringify({ reference_student_id: referenceStudentId, reason }) }),
  flagDuplicateForMerge: (id: number, referenceStudentId: number, reason: string) => request<Record<string, unknown>>(`/api/v1/students/duplicates/${id}/flag-for-merge`, { method: 'POST', body: JSON.stringify({ reference_student_id: referenceStudentId, reason }) }),
  uploadStudentPhoto: (id: number, photo: Blob) => {
    const body = new FormData();
    body.append('photo', photo, 'student-photo.jpg');
    return requestForm<Record<string, unknown>>(`/api/v1/students/${id}/photo`, body);
  },
  enroll: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/enrollments', { method: 'POST', body: JSON.stringify(payload) }),
  withdrawEnrollment: (id: number, payload: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/enrollments/${id}/withdraw`, { method: 'POST', body: JSON.stringify(payload) }),
  reenrollStudent: (id: number, payload: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/students/${id}/reenroll`, { method: 'POST', body: JSON.stringify(payload) }),
  transfer: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/transfers', { method: 'POST', body: JSON.stringify(payload) }),
  cards: () => request<Card[]>('/api/v1/cards'),
  card: (id: number) => request<Card>(`/api/v1/cards/${id}`),
  createCard: (payload: Record<string, unknown>) => request<Card>('/api/v1/cards', { method: 'POST', body: JSON.stringify(payload) }),
  requestCard: (studentId: number, reason = 'Demande administrative') => request<Card>('/api/v1/cards/request', { method: 'POST', body: JSON.stringify({ student_id: studentId, reason }) }),
  cardAction: (id: number, action: string, reason: string, reasonCode?: string) => request<Card>(`/api/v1/cards/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason_text: reason, reason_code: reasonCode }) }),
  cardDisplay: (id: number) => request<Record<string, unknown>>(`/api/v1/cards/${id}/display`),
  cardPdfUrl: (id: number) => `/api/v1/cards/${id}/pdf`,
  cardHistory: (id: number) => request<Record<string, Array<Record<string, unknown>>>>(`/api/v1/cards/${id}/history`),
  generateQr: (id: number, ttl_minutes = 60) => request<Record<string, unknown>>(`/api/v1/cards/${id}/qr/generate`, { method: 'POST', body: JSON.stringify({ ttl_minutes }) }),
  verifyQr: (payload: string) => request<Record<string, unknown>>('/api/v1/cards/verify', { method: 'POST', body: JSON.stringify({ payload }) }),
  attendance: (params = '') => request<Array<Record<string, unknown>>>(`/api/v1/attendance${params}`),
  checkIn: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/attendance/check-in', { method: 'POST', body: JSON.stringify(payload) }),
  checkOut: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/attendance/check-out', { method: 'POST', body: JSON.stringify(payload) }),
  correctAttendance: (id: number, payload: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/attendance/${id}/correct`, { method: 'POST', body: JSON.stringify(payload) }),
  approveAttendance: (id: number) => request<Record<string, unknown>>(`/api/v1/attendance/${id}/approve-correction`, { method: 'POST' }),
  services: () => request<Array<Record<string, unknown>>>('/api/v1/services'),
  serviceTypes: () => request<Array<Record<string, unknown>>>('/api/v1/service-types'),
  createServiceType: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/service-types', { method: 'POST', body: JSON.stringify(payload) }),
  updateServiceType: (id: number, payload: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/service-types/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  disableServiceType: (id: number) => request<Record<string, unknown>>(`/api/v1/service-types/${id}`, { method: 'DELETE' }),
  serviceProviders: () => request<Array<Record<string, unknown>>>('/api/v1/services/providers'),
  createServiceProvider: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/service-providers', { method: 'POST', body: JSON.stringify(payload) }),
  updateServiceProvider: (id: number, payload: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/service-providers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  checkEntitlement: (studentId: number, serviceTypeId: number) => request<Record<string, unknown>>(`/api/v1/service-entitlements/check?student_id=${studentId}&service_type_id=${serviceTypeId}`),
  studentServiceUsages: (studentId: number) => request<Array<Record<string, unknown>>>(`/api/v1/students/${studentId}/service-usages`),
  createEntitlement: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/services/entitlements', { method: 'POST', body: JSON.stringify(payload) }),
  verifyService: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/services/verify', { method: 'POST', body: JSON.stringify(payload) }),
  payments: () => request<Array<Record<string, unknown>>>('/api/v1/payments'),
  mockPayment: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/payments/mock', { method: 'POST', body: JSON.stringify(payload) }),
  reconcilePayment: (id: number, notes = 'Rapprochement fictif') => request<Record<string, unknown>>(`/api/v1/payments/${id}/reconcile`, { method: 'POST', body: JSON.stringify({ notes }) }),
  reconcilePaymentsBatch: (transaction_ids: number[], result: string, comment: string) => request<Record<string, unknown>>('/api/v1/payments/reconcile-batch', { method: 'POST', body: JSON.stringify({ transaction_ids, result, comment }) }),
  reconciliations: () => request<Array<Record<string, unknown>>>('/api/v1/payments/reconciliations'),
  dashboardSummary: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/summary${params}`),
  dashboardKpi: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/kpi${params}`),
  pendingActions: () => request<Record<string, unknown>>('/api/v1/dashboard/pending-actions'),
  dashboardCards: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/cards${params}`),
  dashboardAttendance: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/attendance${params}`),
  dashboardPayments: (params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/payments${params}`),
  dashboardSecurity: () => request<Record<string, unknown>>('/api/v1/dashboard/security'),
  dashboardServices: () => request<Record<string, unknown>>('/api/v1/dashboard/services'),
  specializedDashboard: (domain: string, section: string, params = '') => request<Record<string, unknown>>(`/api/v1/dashboard/${domain}/${section}${params}`),
  createExport: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/exports', { method: 'POST', body: JSON.stringify(payload) }),
  exports: () => request<Array<Record<string, unknown>>>('/api/v1/exports'),
  exportDetail: (id: number) => request<Record<string, unknown>>(`/api/v1/exports/${id}`),
  downloadExport: (id: number) => requestText(`/api/v1/exports/${id}/download`, { method: 'POST' }),
  auditEvents: (params = '') => request<Array<Record<string, unknown>> | { items: Array<Record<string, unknown>>; total: number; page: number; pages: number; per_page: number }>(`/api/v1/audit${params}`),
  verifyAuditEvent: (id: number) => request<Record<string, unknown>>(`/api/v1/audit/${id}/verify`),
  auditIntegrity: () => request<Record<string, unknown>>('/api/v1/audit/integrity'),
  alerts: () => request<Array<Record<string, unknown>>>('/api/v1/alerts'),
  acknowledgeAlert: (id: number, comment = 'Accusé de réception après analyse') => request<Record<string, unknown>>(`/api/v1/alerts/${id}/acknowledge`, { method: 'POST', body: JSON.stringify({ comment }) }),
  resolveAlert: (id: number, resolution_note: string) => request<Record<string, unknown>>(`/api/v1/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution_note }) }),
  incidents: () => request<Array<Record<string, unknown>>>('/api/v1/incidents'),
  createIncident: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  updateIncident: (id: number, payload: Record<string, unknown>) => request<Record<string, unknown>>(`/api/v1/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  incident: (id: number) => request<Record<string, unknown>>(`/api/v1/incidents/${id}`),
  commentIncident: (id: number, text: string) => request<Record<string, unknown>>(`/api/v1/incidents/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  transitionIncident: (id: number, new_status: string, comment: string) => request<Record<string, unknown>>(`/api/v1/incidents/${id}/transition`, { method: 'POST', body: JSON.stringify({ new_status, comment }) }),
  privacyRequests: () => request<Array<Record<string, unknown>>>('/api/v1/privacy/requests'),
  createPrivacyRequest: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/privacy/requests', { method: 'POST', body: JSON.stringify(payload) }),
  transitionPrivacyRequest: (id: number, new_status: string, comment: string) => request<Record<string, unknown>>(`/api/v1/privacy/requests/${id}/transition`, { method: 'POST', body: JSON.stringify({ new_status, comment }) }),
  portabilityExport: (student_id: number, reason: string) => requestDownload('/api/v1/exports/portability', { method: 'POST', body: JSON.stringify({ student_id, reason }) }),
  processingRegister: () => request<Array<Record<string, unknown>>>('/api/v1/privacy/register'),
  createProcessingRegister: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/privacy/register', { method: 'POST', body: JSON.stringify(payload) }),
  retentionRules: () => request<Array<Record<string, unknown>>>('/api/v1/privacy/retention'),
  createRetentionRule: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/privacy/retention', { method: 'POST', body: JSON.stringify(payload) }),
  backups: (params = '') => request<Array<Record<string, unknown>>>(`/api/v1/backups${params}`),
  backupSummary: () => request<Record<string, unknown>>('/api/v1/backups/summary'),
  attendanceCorrections: () => request<Array<Record<string, unknown>>>('/api/v1/attendance/corrections'),
  simulateSms: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/api/v1/notifications/sms', { method: 'POST', body: JSON.stringify(payload) }),
};

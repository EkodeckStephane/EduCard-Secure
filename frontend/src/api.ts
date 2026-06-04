export type Me = {
  public_id: string;
  username: string;
  display_name: string;
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

export const api = {
  login: (username: string, password: string, mfaCode?: string) =>
    request<{ mfa_required: boolean; csrf_token?: string; user_id?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, mfa_code: mfaCode || undefined }),
    }),
  logout: () => request<{ status: string }>('/api/v1/auth/logout', { method: 'POST' }),
  me: () => request<Me>('/api/v1/auth/me'),
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
};

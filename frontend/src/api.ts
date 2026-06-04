export type Me = {
  public_id: string;
  username: string;
  display_name: string;
  roles: string[];
  permissions: string[];
  scopes: Array<Record<string, unknown>>;
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
};

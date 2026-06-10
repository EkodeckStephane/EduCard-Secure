import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setCsrf } from './api';

describe('authentication API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setCsrf('');
    document.cookie = 'educard_csrf=; Max-Age=0; path=/';
  });

  it('uses the CSRF cookie for logout after a page reload', async () => {
    document.cookie = 'educard_csrf=cookie-token; path=/';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'logged_out' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await api.logout();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/logout');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'cookie-token' }),
    });
  });
});

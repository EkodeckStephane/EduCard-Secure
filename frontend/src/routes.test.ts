import { describe, expect, it } from 'vitest';
import { isKnownPath, pathForTab, tabFromPath } from './routes';

describe('application routes', () => {
  it('maps tabs to stable browser paths', () => {
    expect(pathForTab('sessions')).toBe('/compte/sessions');
    expect(tabFromPath('/operations/services')).toBe('services');
    expect(tabFromPath('/dashboard/')).toBe('dashboard');
  });

  it('distinguishes unknown paths', () => {
    expect(isKnownPath('/administration/utilisateurs')).toBe(true);
    expect(isKnownPath('/chemin-inconnu')).toBe(false);
  });
});

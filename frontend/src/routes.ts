export const tabPaths = {
  dashboard: '/dashboard',
  profile: '/compte/profil',
  password: '/compte/mot-de-passe',
  mfa: '/compte/mfa',
  sessions: '/compte/sessions',
  students: '/scolarite/eleves',
  studentForm: '/scolarite/eleves/nouveau',
  studentDetail: '/scolarite/eleves/:id',
  enrollments: '/scolarite/inscriptions',
  cards: '/operations/cartes',
  attendance: '/operations/presence',
  qr: '/operations/qr',
  services: '/operations/services',
  payments: '/operations/paiements',
  schoolMap: '/administration/carte-scolaire',
  validations: '/administration/validations',
  academicLevels: '/administration/niveaux',
  users: '/administration/utilisateurs',
  roles: '/administration/roles',
  permissions: '/administration/permissions',
  scopes: '/administration/perimetres',
  alerts: '/securite/alertes',
  incidents: '/securite/incidents',
  audit: '/securite/audit',
  anomalies: '/securite/anomalies',
  integrity: '/securite/integrite',
  securitySettings: '/securite/parametres',
  exports: '/gouvernance/exports',
  privacy: '/gouvernance/donnees',
  retention: '/gouvernance/retention',
  backups: '/gouvernance/sauvegardes',
  dashCards: '/dashboard/cartes',
  dashAttendance: '/dashboard/presence',
  dashPayments: '/dashboard/paiements',
  dashSecurity: '/dashboard/securite',
  dashServices: '/dashboard/services',
} as const;

export type AppTab = keyof typeof tabPaths;

const pathTabs = new Map<string, AppTab>(Object.entries(tabPaths).map(([tab, path]) => [path, tab as AppTab]));

export function isKnownPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/' || pathTabs.has(normalized) || /^\/scolarite\/eleves\/\d+$/.test(normalized);
}

export function tabFromPath(pathname: string): AppTab {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (/^\/scolarite\/eleves\/\d+$/.test(normalized)) return 'studentDetail';
  return normalized === '/' ? 'dashboard' : pathTabs.get(normalized) ?? 'dashboard';
}

export function pathForTab(tab: AppTab): string {
  return tabPaths[tab];
}

export function studentDetailPath(studentId: number, tab = 'summary'): string {
  return `/scolarite/eleves/${studentId}?tab=${encodeURIComponent(tab)}`;
}

export function studentIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/scolarite\/eleves\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

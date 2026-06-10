# Prompt d'amélioration UI/UX — EduCard Secure

**Version** : 1.0
**Date** : 2026-06-10
**Portée** : `frontend/src/` exclusivement
**Prérequis** : build propre (`npm.cmd run build` sans erreur), serveur backend actif sur `127.0.0.1:8000`

---

## Instructions générales pour l'agent d'exécution

Tu es un ingénieur frontend senior avec 20 ans d'expérience. Tu vas exécuter les phases de ce document **dans l'ordre strict**, en respectant ces règles :

1. **Ne modifier que ce qui est demandé.** Zéro refactoring opportuniste hors scope.
2. **Vérifier le build** (`npm.cmd run build`) à la fin de chaque phase avant de rédiger le compte rendu.
3. **Chaque phase se termine par un compte rendu** au format défini en fin de document.
4. **Aucune phase ne commence** avant que la précédente soit validée par le build.
5. **Conserver tous les comportements fonctionnels existants.** Ces phases n'ajoutent ni ne retirent de fonctionnalité métier — elles améliorent la forme.
6. Les fichiers cibles sont listés pour chaque action. Ne pas toucher aux autres fichiers.
7. Lorsqu'une chaîne de caractères existante est déplacée dans `i18n.ts`, la clé doit déjà exister ou être ajoutée dans les deux langues (`fr` et `en`).

---

## Phase 1 — Quick wins perçus immédiatement (estimé : 2-3 h)

> **Objectif** : corriger les 6 problèmes les plus visibles à l'œil nu sans toucher à l'architecture.

### 1.1 — `document.title` dynamique à chaque navigation

**Fichier** : `frontend/src/main.tsx`
**Localisation** : fonction `navigateTab` (ligne ~105) et fonction `navigatePath` (ligne ~110).

**Action** :
Dans `navigateTab`, après `setTab(next)`, ajouter :
```ts
const pageLabel = navGroups.flatMap(g => g.items).find(([k]) => k === next)?.[1] ?? 'EduCard Secure';
document.title = `${pageLabel} · EduCard Secure`;
```
Même ajout dans `navigatePath`, en déduisant le label depuis `tabFromPath(...)`.

Ajouter également dans le `useEffect` initial (ligne ~75, après `loadMe`) :
```ts
const initialLabel = navGroups.flatMap(g => g.items).find(([k]) => k === tab)?.[1] ?? 'EduCard Secure';
document.title = `${initialLabel} · EduCard Secure`;
```

---

### 1.2 — Skeleton loader dans le `<Suspense>` fallback

**Fichier** : `frontend/src/main.tsx` (ligne ~274) et nouveau fichier `frontend/src/ui/PageSkeleton.tsx`.

**Étape A** — Créer `frontend/src/ui/PageSkeleton.tsx` :
```tsx
import { Box, Skeleton, Stack } from '@mui/material';

export function PageSkeleton() {
  return (
    <Stack gap={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton variant="rectangular" width={220} height={32} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
      </Box>
      <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
      <Stack gap={1}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 1 }} />
        ))}
      </Stack>
    </Stack>
  );
}
```

**Étape B** — Dans `main.tsx` ligne ~274, remplacer :
```tsx
<Suspense fallback={<section className="panel">Chargement...</section>}>
```
par :
```tsx
<Suspense fallback={<PageSkeleton />}>
```
Ajouter l'import : `import { PageSkeleton } from './ui/PageSkeleton';`

---

### 1.3 — `LoadingButton` : internationaliser le texte figé

**Fichier** : `frontend/src/ui/WorkflowComponents.tsx` (ligne ~111).

**Action** : Remplacer le composant `LoadingButton` par une version qui accepte un prop `loadingLabel` optionnel :
```tsx
export function LoadingButton({
  loading,
  loadingLabel,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { loading?: boolean; loadingLabel?: string }) {
  return (
    <Button
      {...props}
      disabled={loading || props.disabled}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : props.startIcon}
    >
      {loading ? (loadingLabel ?? children) : children}
    </Button>
  );
}
```
Passer `loadingLabel` uniquement là où c'est utile — tous les appels existants sans ce prop continuent d'afficher le texte du bouton lui-même pendant le chargement.

---

### 1.4 — `FilterBar` : internationaliser les strings en dur

**Fichier** : `frontend/src/ui/WorkflowComponents.tsx` (ligne ~116-124).

**Action** : Ajouter les deux props `activeFiltersLabel` et `clearLabel` avec valeurs par défaut :
```tsx
export function FilterBar({
  filters,
  onRemove,
  onClear,
  activeFiltersLabel = 'Filtres actifs :',
  clearLabel = 'Tout effacer',
}: {
  filters: Array<{ key: string; label: string }>;
  onRemove: (key: string) => void;
  onClear: () => void;
  activeFiltersLabel?: string;
  clearLabel?: string;
}) {
  if (!filters.length) return null;
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="caption" color="text.secondary">{activeFiltersLabel}</Typography>
      {filters.map((f) => <Chip key={f.key} label={f.label} onDelete={() => onRemove(f.key)} />)}
      <Button size="small" onClick={onClear}>{clearLabel}</Button>
    </Stack>
  );
}
```

---

### 1.5 — `DetailTabs` : internationaliser les labels d'onglets

**Fichier** : `frontend/src/ui/WorkflowComponents.tsx` (ligne ~254-266).

**Action** : Ajouter des props `detailsLabel`, `historyLabel`, `servicesLabel` avec valeurs par défaut françaises :
```tsx
export function DetailTabs({
  technical,
  history,
  services,
  detailsLabel = 'Détails',
  historyLabel = 'Historique',
  servicesLabel = 'Services liés',
}: {
  technical: ReactNode;
  history: ReactNode;
  services?: ReactNode;
  detailsLabel?: string;
  historyLabel?: string;
  servicesLabel?: string;
}) {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label={detailsLabel} />
        <Tab label={historyLabel} />
        <Tab label={servicesLabel} />
      </Tabs>
      <Box sx={{ pt: 2 }}>
        {tab === 0 ? technical : tab === 1 ? history : services ?? (
          <Typography color="text.secondary">Aucun service lié.</Typography>
        )}
      </Box>
    </Box>
  );
}
```

---

### 1.6 — `DigitalCardView` : internationaliser les textes du verso et des boutons

**Fichier** : `frontend/src/ui/WorkflowComponents.tsx` (lignes ~127-168).

**Action** : Ajouter les props suivants à `DigitalCardView` avec des valeurs par défaut françaises :
```tsx
flipLabel?: string;        // défaut : 'Retourner'
printLabel?: string;       // défaut : 'Imprimer'
backTitle?: string;        // défaut : 'Conditions d'utilisation'
backText1?: string;        // défaut : 'Carte personnelle. Toute anomalie...'
backText2?: string;        // défaut : 'Services activés : restauration...'
```
Remplacer les strings hardcodées par ces props dans le JSX.

---

### 1.7 — `CardTransitionDialog` : remplacer le `<select>` natif par MUI `TextField select`

**Fichier** : `frontend/src/ui/WorkflowComponents.tsx` (lignes ~209-219).

**Action** : Remplacer :
```tsx
<label className="fieldLabel">
  Motif
  <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
    <option value="" />
    <option value="ADMIN_CONTROL">Contrôle administratif</option>
    <option value="FRAUD_SUSPECTED">Suspicion de fraude</option>
    <option value="GUARDIAN_REQUEST">Demande du responsable légal</option>
    <option value="OTHER">Autre</option>
  </select>
</label>
```
par :
```tsx
<TextField
  select
  label="Motif"
  value={reasonCode}
  onChange={(event) => setReasonCode(event.target.value)}
  fullWidth
>
  <MenuItem value="">— Sélectionner —</MenuItem>
  <MenuItem value="ADMIN_CONTROL">Contrôle administratif</MenuItem>
  <MenuItem value="FRAUD_SUSPECTED">Suspicion de fraude</MenuItem>
  <MenuItem value="GUARDIAN_REQUEST">Demande du responsable légal</MenuItem>
  <MenuItem value="OTHER">Autre</MenuItem>
</TextField>
```
Ajouter `MenuItem` aux imports MUI déjà présents dans ce fichier.

---

### 1.8 — `StudentsPanel` : touche Entrée déclenche la recherche

**Fichier** : `frontend/src/main.tsx` (ligne ~1205).

**Action** : Ajouter `onKeyDown` sur l'input de recherche :
```tsx
<input
  value={query}
  onChange={(event) => setQuery(event.target.value)}
  onKeyDown={(event) => { if (event.key === 'Enter') void load(1); }}
  placeholder="Recherche"
/>
```

---

### Vérification Phase 1
```powershell
cd frontend && npm.cmd run build
```
Zéro erreur TypeScript. Bundle principal toujours ~789 KB (le découpage vient en Phase 4).

---

## Phase 2 — Ergonomie des workflows (estimé : 3-4 h)

> **Objectif** : rendre chaque action utilisateur claire, confirmée, et non bloquante.

### 2.1 — `StudentsPanel` : clic sur une ligne ouvre la fiche directement

**Fichier** : `frontend/src/main.tsx` (lignes ~1210-1214).

**Contexte** : Aujourd'hui `onRow` ouvre un `SlideOverPanel`. Le comportement cible : clic simple = navigation directe vers `StudentDetailPage`. Le slide-over devient une preview au survol (hover).

**Action** : Modifier le `onRow` du `DataTable` dans `StudentsPanel` :
```tsx
onRow={(row) => {
  const student = data?.items.find((item) => item.id === row.id);
  if (student) onNavigate(studentDetailPath(student.id));
}}
```
Retirer le `SlideOverPanel` et le state `selected` de `StudentsPanel` — ils ne servent plus. Le bouton "Ouvrir la fiche complète" à l'intérieur du slide-over n'a plus de raison d'être.

---

### 2.2 — `StudentsPanel` : désactiver pagination pendant le chargement

**Fichier** : `frontend/src/main.tsx` (lignes ~1186-1208).

**Action** : Ajouter un état `loading` :
```tsx
const [loading, setLoading] = useState(false);

async function load(nextPage = page) {
  setLoading(true);
  try {
    setData(await api.students(`?q=${encodeURIComponent(query)}&page=${nextPage}&page_size=10`));
    setPage(nextPage);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('page', String(nextPage));
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  } catch {
    onError('Recherche élèves refusée');
  } finally {
    setLoading(false);
  }
}
```
Dans le JSX, ajouter `disabled={loading}` sur les boutons Rechercher, Précédent, Suivant. Ajouter `{loading && <LinearProgress />}` au-dessus du `DataTable`. Importer `LinearProgress` depuis `@mui/material`.

---

### 2.3 — `SchoolMapPanel` : feedback post-création amélioré

**Fichier** : `frontend/src/main.tsx` (fonction `submit` ligne ~613-626).

**Contexte** : Le toast et le `load()` sont déjà là. Le problème est que les formulaires ne donnent pas de retour visuel pendant la soumission.

**Action** : Ajouter un état `submitting` dans `SchoolMapPanel` :
```tsx
const [submitting, setSubmitting] = useState(false);

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
```
Sur chaque bouton de soumission de formulaire dans `SchoolMapPanel`, ajouter `disabled={submitting}` et remplacer le texte par `{submitting ? 'Enregistrement...' : 'Créer'}`.

---

### 2.4 — `DashboardPanel` : afficher un skeleton pendant le premier chargement

**Fichier** : `frontend/src/main.tsx` (fonction `DashboardPanel` ligne ~838).

**Action** : Ajouter un état `loading` initialisé à `true` :
```tsx
const [loading, setLoading] = useState(true);

async function load() {
  try {
    // ... code existant inchangé ...
  } catch {
    onError('Dashboard refusé');
  } finally {
    setLoading(false);
  }
}
```
Dans le JSX de `DashboardPanel`, envelopper le contenu principal :
```tsx
if (loading) return <PageSkeleton />;
```
Placer ce guard après le bloc de state, avant le `return` principal. Importer `PageSkeleton` depuis `'./ui/PageSkeleton'`.

---

### 2.5 — `AuditLogPage` : désactiver les boutons de pagination pendant le chargement

**Fichier** : `frontend/src/ui/WorkflowsV2.tsx` (fonction `AuditLogPage`).

**Action** : Localiser les boutons "Précédent" / "Suivant" dans la pagination de `AuditLogPage`. Ajouter un état `loading` dans ce composant et `disabled={loading}` sur les boutons de pagination. Afficher `<LinearProgress />` pendant le chargement, exactement comme en 2.2.

---

### 2.6 — Erreurs API : passer d'un message générique à un message structuré

**Fichier** : `frontend/src/main.tsx` (lignes ~81-96, handler `onApiError`).

**Contexte** : Aujourd'hui `403` affiche "Accès refusé." de manière générique dans la bannière globale. Les autres erreurs sont silencieuses ou affichées via `onError` avec des strings hardcodées dans chaque panel.

**Action** : Dans le handler `onApiError`, enrichir le cas `403` et ajouter le cas `404` :
```tsx
if (detail?.status === 403) {
  setError(language === 'fr' ? 'Accès refusé. Vous ne disposez pas des droits nécessaires.' : 'Access denied. You do not have the required permissions.');
  return;
}
if (detail?.status === 404) {
  setError(language === 'fr' ? 'Ressource introuvable.' : 'Resource not found.');
  return;
}
if (detail?.status === 409) {
  // conflit de version — géré localement dans les composants, ne pas écraser
  return;
}
```

---

### 2.7 — `QrPanel` : textarea payload non éditable directement

**Fichier** : `frontend/src/main.tsx` (ligne ~1434).

**Contexte** : Le textarea "Payload QR signé" est modifiable par l'utilisateur. Un payload modifié manuellement produira une erreur de vérification cryptographique. C'est trompeur.

**Action** : Passer l'attribut `readOnly` sur ce textarea et ajouter un texte d'aide :
```tsx
<textarea
  value={payload}
  readOnly
  placeholder="Le payload sera généré ici"
  style={{ cursor: 'default', opacity: payload ? 1 : 0.5 }}
/>
{payload && (
  <Typography variant="caption" color="text.secondary">
    Payload en lecture seule — copier pour vérification manuelle.
  </Typography>
)}
```

---

### Vérification Phase 2
```powershell
cd frontend && npm.cmd run build
```

---

## Phase 3 — Cohérence visuelle et dark mode (estimé : 4-5 h)

> **Objectif** : éliminer les incohérences entre CSS custom vars et MUI theme. Fixer le dark mode. Ajouter le breakpoint tablet.

### 3.1 — Supprimer les classes CSS utilitaires redondantes, remplacer par MUI

**Fichier** : `frontend/src/styles.css` et tous les composants qui utilisent `className="panel"`, `className="stack"`, `className="grid2"`, `className="formGrid"`, `className="toolbar"`.

**Règle** : Ne pas supprimer les classes `.panel`, `.stack`, etc. du CSS dans un premier temps — on les remplace progressivement dans les composants ciblés ci-dessous. La suppression des classes CSS intervient en Phase 5.

**Action A** — Dans `SchoolMapPanel` (main.tsx ~629), remplacer :
```tsx
<section className="stack">
```
par :
```tsx
<Stack gap={2}>
```
et fermer avec `</Stack>`. Remplacer toutes les `<section className="panel stack">` par `<Paper variant="outlined" sx={{ p: 2.5, display: 'grid', gap: 2 }}>`. Importer `Paper` depuis `@mui/material`.

**Action B** — Dans `StudentsPanel` (main.tsx ~1201), remplacer :
```tsx
<section className="masterDetail">
  <div className="stack masterList">
  <div className="toolbar">
```
par :
```tsx
<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 2, alignItems: 'start' }}>
  <Stack gap={1.5}>
  <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
```

**Action C** — Dans `DashboardPanel`, remplacer `<section className="dashboardPage">` par `<Stack gap={2}>`, et `<div className="kpiGrid">` par :
```tsx
<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1.5 }}>
```

---

### 3.2 — Fixer le dark mode : aligner CSS vars et MUI theme

**Fichier** : `frontend/src/styles.css` et `frontend/src/ui/theme.ts` (si existant) ou la fonction `createAppTheme` dans `main.tsx`.

**Contexte** : Les deux systèmes (`:root[data-theme="dark"]` et `createAppTheme(theme)`) définissent des couleurs en parallèle. Le composant `AppShell` utilise `themeMode === 'dark'` pour ajuster le gradient du sidebar — ce qui est correct. Mais les composants non-MUI héritent des CSS vars tandis que les composants MUI héritent du palette. Résultat : surfaces hétérogènes.

**Action** : Dans `frontend/src/styles.css`, ajouter dans `:root[data-theme="dark"]` les variables manquantes qui correspondent aux couleurs MUI en dark mode :
```css
:root[data-theme="dark"] {
  /* ... variables existantes ... */
  --surface: #1e293b;
  --surface-muted: #172033;
  --bg: #0f172a;
  --text: #e2e8f0;
  --text-strong: #f8fafc;
  --border: #334155;
  --input-border: #475569;
  --muted: #94a3b8;
}
```

Dans `createAppTheme` (fichier `frontend/src/ui/theme.ts` ou dans `main.tsx`), synchroniser les valeurs palette avec ces CSS vars :
```ts
palette: {
  mode,
  background: {
    default: mode === 'dark' ? '#0f172a' : '#eef2f5',
    paper:   mode === 'dark' ? '#1e293b' : '#ffffff',
  },
  text: {
    primary:   mode === 'dark' ? '#e2e8f0' : '#18212f',
    secondary: mode === 'dark' ? '#94a3b8' : '#64748b',
  },
  divider: mode === 'dark' ? '#334155' : '#d8e0e7',
}
```

---

### 3.3 — Breakpoint tablet (1024 px) dans le CSS

**Fichier** : `frontend/src/styles.css`.

**Action** : Ajouter après le breakpoint `820px` existant :
```css
@media (max-width: 1080px) {
  .grid2 {
    grid-template-columns: 1fr;
  }
  .graphFrameBody {
    grid-template-columns: 1fr;
  }
  .masterDetail {
    grid-template-columns: 1fr;
  }
}
```
Dans `AppShell.tsx`, le Drawer passe en mode mini automatiquement sur tablet. Ajouter dans `AppShell` :
```tsx
const tablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
useEffect(() => {
  if (tablet) setMini(true);
}, [tablet]);
```

---

### 3.4 — Cohérence visuelle : remplacer les `<h2>` nus par `<Typography variant="h6">`

**Fichier** : `frontend/src/main.tsx` — tous les `<h2>` à l'intérieur des panels (SchoolMapPanel, CardsPanel, QrPanel, AttendancePanel, ServicesPanel, PaymentsPanel, DashboardPanel).

**Action** : Rechercher toutes les occurrences de `<h2>` dans `main.tsx` et les remplacer par `<Typography variant="h6" fontWeight={700}>`. Importer `Typography` depuis `@mui/material` si pas encore présent dans les imports.

Remplacer `<h3>` par `<Typography variant="subtitle1" fontWeight={600}>`.

**Raison** : Les balises `<h2>` et `<h3>` nues héritent des styles du navigateur et ignorent le theme MUI. En dark mode, leur couleur peut différer du reste du texte.

---

### 3.5 — Boutons natifs → `<Button>` MUI dans les panels opérationnels

**Fichier** : `frontend/src/main.tsx`.

**Cibles** : Tous les `<button className="primary">` et `<button>` dans `CardsPanel`, `QrPanel`, `AttendancePanel`, `ServicesPanel`, `PaymentsPanel`, `SchoolMapPanel`, `StudentsPanel`.

**Action** : Remplacer `<button className="primary">` par `<Button variant="contained">` et `<button>` par `<Button variant="outlined">`. Ajouter `Button` aux imports MUI dans `main.tsx`. Supprimer `className="primary"` des balises converties.

---

### 3.6 — `SecuritySettingsPanel` : ajouter un avertissement prototype

**Fichier** : `frontend/src/main.tsx` (ligne ~1174-1176).

**Contexte** : Ce panel affiche 4 lignes statiques hardcodées qui semblent être des vraies données système. C'est trompeur.

**Action** : Ajouter un `Alert` au-dessus du `DataTable` :
```tsx
function SecuritySettingsPanel() {
  return (
    <Stack gap={2}>
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
```
Importer `Alert` depuis `@mui/material`.

---

### Vérification Phase 3
```powershell
cd frontend && npm.cmd run build
```

---

## Phase 4 — Découpage de `main.tsx` (estimé : 1 journée)

> **Objectif** : passer le bundle principal de ~789 KB à moins de 250 KB en extrayant chaque panel dans son propre fichier lazy-chargé.

**Règle d'or** : Extraire un panel à la fois, vérifier le build après chaque extraction.

### Ordre d'extraction (du moins au plus couplé)

| Priorité | Panel | Fichier cible |
|----------|-------|---------------|
| 1 | `CardsPanel` | `frontend/src/ui/CardsPanel.tsx` |
| 2 | `QrPanel` | `frontend/src/ui/QrPanel.tsx` |
| 3 | `AttendancePanel` | `frontend/src/ui/AttendancePanel.tsx` |
| 4 | `ServicesPanel` | `frontend/src/ui/ServicesPanel.tsx` |
| 5 | `PaymentsPanel` | `frontend/src/ui/PaymentsPanel.tsx` |
| 6 | `SchoolMapPanel` | `frontend/src/ui/SchoolMapPanel.tsx` |
| 7 | `DashboardPanel` | `frontend/src/ui/DashboardPanel.tsx` |
| 8 | `StudentsPanel` | `frontend/src/ui/StudentsPanel.tsx` |
| 9 | `EnrollmentPanel` | `frontend/src/ui/EnrollmentPanel.tsx` |
| 10 | `AnomaliesPanel` | `frontend/src/ui/AnomaliesPanel.tsx` |
| 11 | Panels account : `Profile`, `PasswordPanel`, `MfaPanel`, `UsersPanel` | `frontend/src/ui/AccountPanels.tsx` |

### Protocole d'extraction (appliquer à chaque panel)

Pour chaque panel listé ci-dessus :

**Étape 1** — Copier la fonction dans le nouveau fichier. Inclure **tous** les imports nécessaires (MUI, api, i18n, WorkflowComponents, etc.). Exporter avec `export function`.

**Étape 2** — Dans `main.tsx`, ajouter le lazy import en haut du fichier (groupe des lazy imports existants) :
```tsx
const CardsPanel = lazy(() => import('./ui/CardsPanel').then(m => ({ default: m.CardsPanel })));
```

**Étape 3** — Supprimer la définition de la fonction de `main.tsx`.

**Étape 4** — `npm.cmd run build` — vérifier zéro erreur avant de passer au panel suivant.

### Imports communs à inclure dans chaque panel extrait

Chaque fichier extrait aura besoin d'une sélection parmi :
```tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Button, Paper, Stack, Typography, LinearProgress, MenuItem } from '@mui/material';
import { api } from '../api';
import { useLanguage } from '../i18n';
import { useToast, SearchSelect, SlideOverPanel, ... } from './WorkflowComponents';
import { PageSkeleton } from './PageSkeleton';
```

### Nettoyage du code mort

Après extraction de tous les panels, supprimer de `main.tsx` les blocs de code commentés restants (lignes ~1056-1089 `ExportsPanel` ancienne version, `AuditPanel` ancienne version, etc.).

**Règle** : Ne supprimer un commentaire que si la fonction active au-dessus de lui est bien en place dans un fichier séparé et que le build passe.

### Résultat attendu après Phase 4

```
dist/assets/index-xxx.js            < 250 KB   (était 789 KB)
dist/assets/CardsPanel-xxx.js       ~  15 KB
dist/assets/QrPanel-xxx.js          ~   8 KB
dist/assets/AttendancePanel-xxx.js  ~  12 KB
dist/assets/ServicesPanel-xxx.js    ~  10 KB
dist/assets/PaymentsPanel-xxx.js    ~  10 KB
dist/assets/SchoolMapPanel-xxx.js   ~  25 KB
dist/assets/DashboardPanel-xxx.js   ~  20 KB
dist/assets/StudentsPanel-xxx.js    ~  12 KB
```

---

### Vérification Phase 4
```powershell
cd frontend && npm.cmd run build
```
Vérifier que les tailles de chunks sont cohérentes avec les objectifs ci-dessus.

---

## Phase 5 — Empty states et feedback de complétion (estimé : 2-3 h)

> **Objectif** : aucune liste vide, aucune action réussie, ne doit rester silencieuse.

### 5.1 — Composant `EmptyState` réutilisable

**Fichier** : `frontend/src/ui/WorkflowComponents.tsx`.

**Action** : Ajouter à la fin du fichier :
```tsx
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      gap={1.5}
      sx={{ minHeight: 240, color: 'text.secondary', textAlign: 'center', p: 4 }}
    >
      {icon && <Box sx={{ fontSize: 56, lineHeight: 1, opacity: 0.4 }}>{icon}</Box>}
      <Typography variant="h6" color="text.secondary">{title}</Typography>
      {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
      {action}
    </Stack>
  );
}
```

### 5.2 — Remplacer `SimpleTable` vide par `EmptyState`

**Fichier** : `frontend/src/ui/WorkflowsV2.tsx` (ligne ~34).

**Action** : Remplacer :
```tsx
if (!rows.length) return <Typography color="text.secondary">Aucun résultat.</Typography>;
```
par :
```tsx
if (!rows.length) return (
  <EmptyState
    title="Aucun résultat"
    description="Modifier les filtres ou créer un premier enregistrement."
  />
);
```
Importer `EmptyState` depuis `'./WorkflowComponents'`.

### 5.3 — `StudentsPanel` : empty state avec action

**Fichier** : `frontend/src/ui/StudentsPanel.tsx` (après extraction Phase 4).

**Action** : Dans le JSX, après le `DataTable`, ajouter :
```tsx
{data && data.items.length === 0 && (
  <EmptyState
    icon={<PersonOff />}
    title={query ? 'Aucun élève correspondant' : 'Aucun élève enregistré'}
    description={query ? `Aucun résultat pour "${query}".` : 'Créer le premier élève via le formulaire d\'inscription.'}
    action={can('student:create') && !query ? (
      <Button variant="contained" onClick={() => onNavigate('/students/new')}>
        Créer un élève
      </Button>
    ) : undefined}
  />
)}
```
Importer `PersonOff` depuis `@mui/icons-material`.

### 5.4 — `CardsPanel` : empty state avec icône

**Fichier** : `frontend/src/ui/CardsPanel.tsx` (après extraction Phase 4).

**Action** : Quand `cards.length === 0` après chargement, afficher :
```tsx
<EmptyState
  icon={<CreditCardOff />}
  title="Aucune carte dans le périmètre"
  description="Les cartes apparaissent ici après leur demande d'émission."
/>
```
Importer `CreditCardOff` depuis `@mui/icons-material`.

### 5.5 — Toast sur toutes les actions d'écriture dans `CardsPanel`

**Fichier** : `frontend/src/ui/CardsPanel.tsx`.

**Contexte** : Les transitions de carte (suspension, révocation, réactivation) appellent `api.transitionCard()` mais ne notifient pas l'utilisateur en cas de succès.

**Action** : Dans la callback `onConfirm` du `CardTransitionDialog`, après l'appel API réussi, ajouter :
```tsx
notify(`Carte ${transition === 'revoke' ? 'révoquée' : transition === 'suspend' ? 'suspendue' : 'mise à jour'}.`, 'success');
await load();
```

### 5.6 — Toast sur `AttendancePanel` pointage

**Fichier** : `frontend/src/ui/AttendancePanel.tsx`.

**Contexte** : Les toasts "Entrée enregistrée." et "Sortie enregistrée." existent déjà (ligne ~1478). Vérifier qu'ils sont conservés après extraction.

---

### Vérification Phase 5
```powershell
cd frontend && npm.cmd run build
```

---

## Phase 6 — Animations et transitions (estimé : 2 h)

> **Objectif** : transitions fluides entre les changements de panel. Zéro installation de nouvelle dépendance lourde — utiliser MUI `Fade` et `Grow` natifs.

### 6.1 — Installer Framer Motion

```powershell
cd frontend && npm.cmd install framer-motion
```
Vérifier l'ajout dans `package.json`.

### 6.2 — Composant `PageTransition`

**Fichier** : `frontend/src/ui/PageTransition.tsx` (nouveau fichier).

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

export function PageTransition({ children, tabKey }: { children: ReactNode; tabKey: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### 6.3 — Envelopper le contenu principal dans `PageTransition`

**Fichier** : `frontend/src/main.tsx` (lignes ~274-311).

**Action** : Envelopper le bloc `<Suspense>` avec `<PageTransition tabKey={currentTab}>` :
```tsx
<PageTransition tabKey={currentTab}>
  <Suspense fallback={<PageSkeleton />}>
    {currentTab === 'profile' && <Profile me={me} />}
    {/* ... tous les panels ... */}
  </Suspense>
</PageTransition>
```
Importer `PageTransition` depuis `'./ui/PageTransition'`.

### 6.4 — Animation d'ouverture du `SlideOverPanel`

**Fichier** : `frontend/src/styles.css` — vérifier que l'animation du slide-over est bien définie.

**Contexte** : La classe `.slideOver` avec `.open` contrôle la visibilité. Vérifier qu'une transition CSS est définie :
```css
.slideOver {
  /* ... styles existants ... */
  transform: translateX(100%);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.slideOver.open {
  transform: translateX(0);
}
```
Si ces transitions ne sont pas présentes, les ajouter.

### 6.5 — Animation du skeleton loader

**Fichier** : `frontend/src/ui/PageSkeleton.tsx`.

**Action** : Envelopper le return dans une motion.div :
```tsx
import { motion } from 'framer-motion';

export function PageSkeleton() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <Stack gap={2}>
        {/* ... skeletons ... */}
      </Stack>
    </motion.div>
  );
}
```

---

### Vérification Phase 6
```powershell
cd frontend && npm.cmd run build
```

---

## Phase 7 — Contexte d'authentification et nettoyage état (estimé : 3-4 h)

> **Objectif** : extraire `me`, `can()`, `language` du composant racine dans un Context dédié pour éliminer le prop drilling.

### 7.1 — Créer `AuthContext`

**Fichier** : `frontend/src/auth.tsx` (nouveau fichier).

```tsx
import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { api, Me } from './api';
import { Language, normalizeLanguage } from './i18n';

type AuthContextValue = {
  me: Me | null;
  language: Language;
  can: (permission: string) => boolean;
  loadMe: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, onLoggedOut }: { children: ReactNode; onLoggedOut: () => void }) {
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch {
      setMe(null);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setMe(null);
    onLoggedOut();
  }, [onLoggedOut]);

  const can = useCallback(
    (permission: string) => me?.permissions.includes(permission) ?? false,
    [me],
  );

  const language = normalizeLanguage(me?.preferred_language);

  return (
    <AuthContext.Provider value={{ me, language, can, loadMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

### 7.2 — Migrer `App()` pour utiliser `AuthProvider`

**Fichier** : `frontend/src/main.tsx`.

**Action** : Déplacer `me`, `loadMe`, et `can` hors du state local de `App()`. Envelopper le retour de `App()` dans `<AuthProvider>`. Les composants panels utilisent `useAuth()` directement — supprimer les props `can` et `me` passées en cascade.

**Note** : Cette migration est progressive. Phase 7 migre le conteneur `App()` et les 3 panels les plus simples (`Profile`, `PasswordPanel`, `MfaPanel`). Les panels plus complexes sont migrés après leur extraction en Phase 4.

### 7.3 — Supprimer le prop drilling `can` de `AppShell`

**Fichier** : `frontend/src/ui/AppShell.tsx`.

**Contexte** : `AppShell` ne reçoit pas `can` directement — c'est `App()` qui calcule la visibilité des items de navigation avec `can()` avant de passer les `navGroups` filtrés. Ce mécanisme est correct. Vérifier que `AppShell` ne reçoit pas directement `me` — si c'est le cas, l'enlever et utiliser `useAuth()`.

---

### Vérification Phase 7
```powershell
cd frontend && npm.cmd run build
```

---

## Phase 8 — Internationalisation complète (estimé : 3 h)

> **Objectif** : zéro string française ou anglaise hardcodée dans un composant rendu.

### 8.1 — Audit exhaustif des strings hardcodées

Lancer une recherche dans `frontend/src/` :
```powershell
Select-String -Path "frontend\src\**\*.tsx" -Pattern "Chargement|Enregistrement|Actualiser|Précédent|Suivant|Recherche|résultat|Aucun|refusé|refusée|refusee" -Recurse
```
Lister tous les fichiers et lignes correspondants.

### 8.2 — Enrichir `i18n.ts` avec les clés manquantes

**Fichier** : `frontend/src/i18n.ts`.

**Action** : Ajouter dans les deux dictionnaires (`fr` et `en`) les clés suivantes manquantes (liste non exhaustive — compléter selon l'audit 8.1) :

```ts
// À ajouter dans le dictionnaire FR :
loading: 'Chargement…',
saving: 'Enregistrement…',
refresh: 'Actualiser',
previous: 'Précédent',
next: 'Suivant',
search: 'Rechercher',
searchPlaceholder: 'Recherche',
results: 'résultat(s)',
noResults: 'Aucun résultat',
denied: 'Opération refusée',
create: 'Créer',
cancel: 'Annuler',
confirm: 'Confirmer',
close: 'Fermer',
back: 'Retour',
activeFilters: 'Filtres actifs :',
clearFilters: 'Tout effacer',
details: 'Détails',
history: 'Historique',
relatedServices: 'Services liés',
flip: 'Retourner',
print: 'Imprimer',

// À ajouter dans le dictionnaire EN :
loading: 'Loading…',
saving: 'Saving…',
refresh: 'Refresh',
previous: 'Previous',
next: 'Next',
search: 'Search',
searchPlaceholder: 'Search',
results: 'result(s)',
noResults: 'No results',
denied: 'Operation denied',
create: 'Create',
cancel: 'Cancel',
confirm: 'Confirm',
close: 'Close',
back: 'Back',
activeFilters: 'Active filters:',
clearFilters: 'Clear all',
details: 'Details',
history: 'History',
relatedServices: 'Related services',
flip: 'Flip',
print: 'Print',
```

### 8.3 — Appliquer les clés dans `WorkflowComponents`

**Fichier** : `frontend/src/ui/WorkflowComponents.tsx`.

**Action** : Chaque composant qui reçoit des props de label (`activeFiltersLabel`, `clearLabel`, etc.) peut désormais récupérer ces valeurs depuis `useLanguage()` + `t()` si les props ne sont pas fournies. Modifier les composants `FilterBar`, `DetailTabs`, `DigitalCardView`, `LoadingButton` pour utiliser `useLanguage()` quand les props optionnelles sont absentes.

### 8.4 — `StudentsPanel` et `CardsPanel` : remplacer les strings

**Fichier** : Chaque panel extrait.

**Action** : Remplacer toutes les occurrences de strings hardcodées (ex: `'Recherche élèves refusée'`, `'Demande de carte créée.'`, `'Acces cartes refuse'`, etc.) par des appels `label('denied')`, `label('search')`, etc. via `const label = (key: string) => t(language, key);` en tête de chaque composant.

---

### Vérification Phase 8
```powershell
cd frontend && npm.cmd run build
```

---

## Phase 9 — Finitions responsive et accessibilité (estimé : 2 h)

> **Objectif** : application utilisable sur mobile sans dégradation, et accessible au clavier.

### 9.1 — `AppShell` : fermer le drawer mobile avec Escape

**Fichier** : `frontend/src/ui/AppShell.tsx`.

**Action** : Ajouter un `useEffect` qui écoute `keydown` :
```tsx
useEffect(() => {
  const handler = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && mobileOpen) setMobileOpen(false);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [mobileOpen]);
```

### 9.2 — Navigation clavier dans les tables

**Fichier** : `frontend/src/ui/WorkflowsV2.tsx` (composant `SimpleTable`).

**Contexte** : Les lignes ont `tabIndex={onSelect ? 0 : undefined}` et `onKeyDown` pour Enter. Vérifier que `role="row"` et `aria-selected` sont correctement positionnés. Ajouter `role="grid"` sur le `<table>` si `onSelect` est défini :
```tsx
<table role={onSelect ? 'grid' : 'table'}>
```

### 9.3 — `SlideOverPanel` : aria-label sur le bouton de fermeture

**Fichier** : `frontend/src/ui/WorkflowComponents.tsx` (ligne ~82).

**Contexte** : `aria-label="Fermer"` est déjà présent. Vérifier que le panel reçoit `role="dialog"` et `aria-modal="true"` :
```tsx
<aside
  className={`slideOver ${open ? 'open' : ''}`}
  aria-hidden={!open}
  role="dialog"
  aria-modal="true"
  aria-label={title}
>
```

### 9.4 — `DashboardPanel` : ajuster les hauteurs de chart sur mobile

**Fichier** : `frontend/src/styles.css`.

**Action** : Modifier :
```css
.materialChart {
  height: 270px;
}

@media (max-width: 480px) {
  .materialChart {
    height: 200px;
  }
}
```

### 9.5 — `QrPanel` : layout 1 colonne sur mobile

**Fichier** : `frontend/src/ui/QrPanel.tsx` (après extraction Phase 4).

**Action** : Remplacer `<section className="grid2">` par :
```tsx
<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
```

---

### Vérification Phase 9
```powershell
cd frontend && npm.cmd run build
```

---

## Modèle de compte rendu de phase

À la fin de chaque phase, produire le compte rendu suivant :

```
## Compte rendu — Phase X

**Statut** : ✅ Complète / ⚠️ Partielle / ❌ Bloquée

**Build** : ✅ Propre (0 erreur TypeScript, 0 warning critique) / ❌ Erreurs

**Taille bundle principal** : XXX KB (référence Phase 0 : 789 KB)

**Fichiers modifiés** :
- `frontend/src/xxx.tsx` — [description en 1 ligne]
- `frontend/src/ui/xxx.tsx` — [description en 1 ligne]

**Fichiers créés** :
- `frontend/src/ui/PageSkeleton.tsx` — [description]

**Comportements vérifiés** :
- [ ] Connexion / déconnexion fonctionnelle
- [ ] Navigation entre panels sans crash
- [ ] Dark mode cohérent
- [ ] Affichage mobile (< 480px) sans overflow horizontal

**Déviations par rapport au prompt** :
- [Lister toute divergence avec justification, ou "Aucune"]

**Prochaine phase** : Phase X+1 — [titre]
```

---

## Récapitulatif des phases

| Phase | Titre | Durée estimée | Complexité |
|-------|-------|---------------|------------|
| 1 | Quick wins perçus immédiatement | 2-3 h | Faible |
| 2 | Ergonomie des workflows | 3-4 h | Faible |
| 3 | Cohérence visuelle et dark mode | 4-5 h | Moyenne |
| 4 | Découpage de `main.tsx` | 1 journée | Élevée |
| 5 | Empty states et feedback de complétion | 2-3 h | Faible |
| 6 | Animations et transitions | 2 h | Faible |
| 7 | Contexte d'authentification | 3-4 h | Élevée |
| 8 | Internationalisation complète | 3 h | Moyenne |
| 9 | Responsive et accessibilité | 2 h | Faible |

**Total estimé** : 22-31 heures de développement
**Résultat attendu** : bundle principal < 250 KB, zéro string hardcodée, dark mode cohérent, workflows confirmés par toast, navigation fluide avec transitions.

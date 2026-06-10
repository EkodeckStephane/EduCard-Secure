import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Close, CreditCard, Flip, Print } from '@mui/icons-material';
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { t, useLanguage } from '../i18n';

export type SelectOption = {
  id: number;
  label: string;
  subtitle?: string;
  badge?: string;
  disabled?: boolean;
  raw?: Record<string, unknown>;
};

export function SearchSelect({
  label,
  options,
  value,
  onChange,
  loading = false,
  disabled = false,
}: {
  label: string;
  options: SelectOption[];
  value: SelectOption | null;
  onChange: (value: SelectOption | null) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Autocomplete
      options={options}
      value={value}
      loading={loading}
      disabled={disabled}
      getOptionDisabled={(option) => Boolean(option.disabled)}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      onChange={(_, next) => onChange(next)}
      filterOptions={(items, state) => {
        const query = state.inputValue.toLocaleLowerCase();
        return items.filter((item) => `${item.label} ${item.subtitle ?? ''}`.toLocaleLowerCase().includes(query)).slice(0, 8);
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{option.label}</Typography>
            {option.subtitle && <Typography variant="caption" color="text.secondary">{option.subtitle}</Typography>}
          </Stack>
          {option.badge && <Chip size="small" label={option.badge} sx={{ ml: 'auto' }} />}
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

export function SlideOverPanel({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const language = useLanguage();
  return (
    <aside
      className={`slideOver ${open ? 'open' : ''}`}
      aria-hidden={!open}
      aria-label={title}
      aria-modal="true"
      role="dialog"
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">{title}</Typography>
        <IconButton onClick={onClose} aria-label={t(language, 'close')}><Close /></IconButton>
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      {children}
    </aside>
  );
}

type Toast = { message: string; severity: 'success' | 'warning' | 'error' | 'info' } | null;
const ToastContext = createContext<(message: string, severity?: NonNullable<Toast>['severity']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  const notify = useCallback((message: string, severity: NonNullable<Toast>['severity'] = 'success') => setToast({ message, severity }), []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <Snackbar open={Boolean(toast)} autoHideDuration={toast?.severity === 'error' ? null : toast?.severity === 'warning' ? 5000 : 3000} onClose={() => setToast(null)}>
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">{toast.message}</Alert> : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function LoadingButton({
  loading,
  loadingLabel,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { loading?: boolean; loadingLabel?: string }) {
  const language = useLanguage();
  return (
    <Button {...props} disabled={loading || props.disabled} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : props.startIcon}>
      {loading ? (loadingLabel ?? t(language, 'saving')) : children}
    </Button>
  );
}

export function FilterBar({
  filters,
  onRemove,
  onClear,
  activeFiltersLabel,
  clearLabel,
}: {
  filters: Array<{ key: string; label: string }>;
  onRemove: (key: string) => void;
  onClear: () => void;
  activeFiltersLabel?: string;
  clearLabel?: string;
}) {
  const language = useLanguage();
  if (!filters.length) return null;
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="caption" color="text.secondary">{activeFiltersLabel ?? t(language, 'activeFilters')}</Typography>
      {filters.map((filter) => <Chip key={filter.key} label={filter.label} onDelete={() => onRemove(filter.key)} />)}
      <Button size="small" onClick={onClear}>{clearLabel ?? t(language, 'clearFilters')}</Button>
    </Stack>
  );
}

export function DigitalCardView({
  data,
  flipLabel,
  printLabel,
  backTitle,
  backText1,
  backText2,
}: {
  data: Record<string, unknown>;
  flipLabel?: string;
  printLabel?: string;
  backTitle?: string;
  backText1?: string;
  backText2?: string;
}) {
  const language = useLanguage();
  const [flipped, setFlipped] = useState(false);
  const student = (data.student ?? {}) as Record<string, unknown>;
  const school = (data.school ?? {}) as Record<string, unknown>;
  const classroom = (data.classroom ?? {}) as Record<string, unknown>;
  const initials = `${String(student.first_name ?? '?')[0]}${String(student.last_name ?? '?')[0]}`.toUpperCase();
  return (
    <Stack sx={{ gap: 1.5, alignItems: 'center' }}>
      <div className={`digitalCard ${flipped ? 'flipped' : ''}`}>
        <div className="digitalCardInner">
          <section className="digitalCardFace front">
            <header><strong>EDUCARD SECURE</strong><span>Carte scolaire numérique</span></header>
            <div className="digitalCardBody">
              <div className="studentPhoto">
                <img src={String(student.photo_url ?? '')} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                <span>{initials}</span>
              </div>
              <div>
                <h3>{String(student.last_name ?? '')} {String(student.first_name ?? '')}</h3>
                <p>Matricule : {String(student.student_number ?? '')}</p>
                <p>Né(e) le : {String(student.birth_date ?? '')}</p>
                <p>{String(school.name ?? '')}</p>
                <p>{String(classroom.label ?? '')} · {String(data.school_year ?? '')}</p>
              </div>
            </div>
            <footer><span className={`cardStatus ${String(data.status ?? '').toLowerCase()}`}>{String(data.status ?? '')}</span><span>{String(data.serial_number ?? '')}</span></footer>
          </section>
          <section className="digitalCardFace back">
            <h3>{backTitle ?? (language === 'fr' ? "Conditions d'utilisation" : 'Terms of use')}</h3>
            <p>{backText1 ?? (language === 'fr' ? "Carte personnelle. Toute anomalie doit être signalée à l'établissement." : 'Personal card. Report any anomaly to the school.')}</p>
            <p>{backText2 ?? (language === 'fr' ? 'Services activés : restauration, sport et prestations configurées.' : 'Enabled services: catering, sports and configured benefits.')}</p>
            <strong>{String(school.name ?? 'EduCard Secure')}</strong>
          </section>
        </div>
      </div>
      <Stack direction="row" sx={{ gap: 1 }}>
        <Button size="small" startIcon={<Flip />} onClick={() => setFlipped(!flipped)}>{flipLabel ?? t(language, 'flip')}</Button>
        <Button size="small" startIcon={<Print />} onClick={() => window.print()}>{printLabel ?? t(language, 'print')}</Button>
      </Stack>
    </Stack>
  );
}

export function CardTransitionDialog({
  card,
  action,
  open,
  onClose,
  onConfirm,
}: {
  card: { serial_number: string; status: string } | null;
  action: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, reason: string) => Promise<void>;
}) {
  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [serial, setSerial] = useState('');
  const [loading, setLoading] = useState(false);
  const destructive = action === 'revoke';
  const needsReason = ['suspend', 'reactivate', 'revoke', 'replace'].includes(action);
  const valid = (!needsReason || (reasonCode && reason.trim().length >= 5)) && (!destructive || serial === card?.serial_number);
  async function submit() {
    setLoading(true);
    try {
      await onConfirm(reasonCode, reason);
      setReason('');
      setReasonCode('');
      setSerial('');
      onClose();
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{action === 'revoke' ? 'Révoquer définitivement la carte' : `${action[0]?.toUpperCase()}${action.slice(1)} la carte`}</DialogTitle>
      <DialogContent>
        <Alert severity={destructive ? 'error' : 'warning'} sx={{ mb: 2 }}>
          {destructive ? 'Cette opération est irréversible. La carte sera immédiatement invalide.' : 'Cette transition sera enregistrée dans le journal d’audit.'}
        </Alert>
        {needsReason && (
          <Stack sx={{ gap: 2 }}>
            <TextField select label="Motif" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} fullWidth>
              <MenuItem value="">— Sélectionner —</MenuItem>
              <MenuItem value="ADMIN_CONTROL">Contrôle administratif</MenuItem>
              <MenuItem value="FRAUD_SUSPECTED">Suspicion de fraude</MenuItem>
              <MenuItem value="GUARDIAN_REQUEST">Demande du responsable légal</MenuItem>
              <MenuItem value="OTHER">Autre</MenuItem>
            </TextField>
            <TextField label="Précisions" multiline minRows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Stack>
        )}
        {destructive && <TextField fullWidth sx={{ mt: 2 }} label={`Saisir le numéro ${card?.serial_number}`} value={serial} onChange={(event) => setSerial(event.target.value)} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <LoadingButton loading={loading} color={destructive ? 'error' : 'primary'} variant="contained" disabled={!valid} onClick={() => void submit()}>
          Confirmer
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

export function CardLifecycleTimeline({ history }: { history: Record<string, Array<Record<string, unknown>>> | null }) {
  const language = useLanguage();
  const events = useMemo<Array<Record<string, unknown>>>(() => [
    ...(history?.status_history ?? []).map((item) => ({ ...item, date: item.changed_at, label: item.new_status })),
    ...(history?.issuance_events ?? []).map((item) => ({ ...item, date: item.created_at, label: item.event_type })),
  ].sort((left, right) => String(right.date).localeCompare(String(left.date))), [history]);
  return (
    <div className="timeline">
      {events.map((event, index) => (
        <article key={`${event.label}-${event.date}-${index}`}>
          <span />
          <div><strong>{String(event.label ?? '')}</strong><small>{new Date(String(event.date)).toLocaleString()}</small><p>{String(event.reason ?? event.details_minimized ?? '')}</p></div>
        </article>
      ))}
      {!events.length && <Typography color="text.secondary">{t(language, 'noRecordedEvent')}</Typography>}
    </div>
  );
}

export function DetailTabs({
  technical,
  history,
  services,
  detailsLabel,
  historyLabel,
  servicesLabel,
}: {
  technical: ReactNode;
  history: ReactNode;
  services?: ReactNode;
  detailsLabel?: string;
  historyLabel?: string;
  servicesLabel?: string;
}) {
  const language = useLanguage();
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label={detailsLabel ?? t(language, 'details')} />
        <Tab label={historyLabel ?? t(language, 'history')} />
        <Tab label={servicesLabel ?? t(language, 'relatedServices')} />
      </Tabs>
      <Box sx={{ pt: 2 }}>{tab === 0 ? technical : tab === 1 ? history : services ?? <Typography color="text.secondary">{t(language, 'noRelatedService')}</Typography>}</Box>
    </Box>
  );
}

export function EmptySelection({ label }: { label: string }) {
  return <Stack sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 260, color: 'text.secondary' }}><CreditCard sx={{ fontSize: 48, mb: 1 }} /><Typography>{label}</Typography></Stack>;
}

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
    <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 1.5, minHeight: 240, color: 'text.secondary', textAlign: 'center', p: 4 }}>
      {icon && <Box sx={{ fontSize: 56, lineHeight: 1, opacity: 0.4 }}>{icon}</Box>}
      <Typography variant="h6" color="text.secondary">{title}</Typography>
      {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
      {action}
    </Stack>
  );
}

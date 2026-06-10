import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { ArrowLeft, Filter, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { localizeField, localizeValue, useLanguage } from '../i18n';
import { MetricCard } from './MetricCard';
import { SearchSelect, SelectOption } from './WorkflowComponents';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

type Domain = 'cards' | 'attendance' | 'payments' | 'security' | 'services';
type Props = { domain: Domain; onBack: (query: string) => void; onDrillDown: (path: string) => void; onError: (message: string) => void };

const titles: Record<Domain, { fr: string; en: string }> = {
  cards: { fr: 'Statistiques Cartes', en: 'Card statistics' },
  attendance: { fr: 'Statistiques Présence', en: 'Attendance statistics' },
  payments: { fr: 'Statistiques Paiements simulés', en: 'Mock payment statistics' },
  security: { fr: 'Statistiques Sécurité', en: 'Security statistics' },
  services: { fr: 'Statistiques Services', en: 'Service statistics' },
};

export function SpecializedDashboardPage({ domain, onBack, onDrillDown, onError }: Props) {
  const language = useLanguage();
  const initial = useMemo(() => new URLSearchParams(window.location.search), [domain]);
  const [regions, setRegions] = useState<SelectOption[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [years, setYears] = useState<SelectOption[]>([]);
  const [region, setRegion] = useState<SelectOption | null>(null);
  const [department, setDepartment] = useState<SelectOption | null>(null);
  const [school, setSchool] = useState<SelectOption | null>(null);
  const [year, setYear] = useState<SelectOption | null>(null);
  const [period, setPeriod] = useState(initial.get('period') ?? '30d');
  const [special, setSpecial] = useState({ primary: initial.get('filter') ?? '', secondary: initial.get('secondary') ?? '' });
  const [kpis, setKpis] = useState<Array<Record<string, unknown>>>([]);
  const [distribution, setDistribution] = useState<Array<Record<string, unknown>>>([]);
  const [trend, setTrend] = useState<Array<Record<string, unknown>>>([]);
  const [secondaryDistribution, setSecondaryDistribution] = useState<Array<Record<string, unknown>>>([]);
  const [tableRows, setTableRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    Promise.all([api.regions(), api.departments(), api.schools(), api.schoolYears()]).then(([r, d, s, y]) => {
      const regionOptions = r.map((row) => ({ id: Number(row.id), label: String(row.name), raw: row }));
      const departmentOptions = d.map((row) => ({ id: Number(row.id), label: String(row.name), raw: row }));
      const schoolOptions = s.map((row) => ({ id: Number(row.school_id ?? row.id), label: String(row.school ?? row.name), raw: row }));
      const yearOptions = y.map((row) => ({ id: Number(row.id), label: String(row.code), raw: row }));
      setRegions(regionOptions); setDepartments(departmentOptions); setSchools(schoolOptions); setYears(yearOptions);
      setRegion(regionOptions.find((item) => item.id === Number(initial.get('region_id'))) ?? null);
      setDepartment(departmentOptions.find((item) => item.id === Number(initial.get('department_id'))) ?? null);
      setSchool(schoolOptions.find((item) => item.id === Number(initial.get('school_id'))) ?? null);
      setYear(yearOptions.find((item) => item.id === Number(initial.get('year_id'))) ?? null);
    }).catch(() => onError(language === 'fr' ? 'Chargement des filtres refusé.' : 'Filter loading denied.'));
  }, [domain]);

  function queryString() {
    const query = new URLSearchParams();
    if (region) query.set('region_id', String(region.id));
    if (department) query.set('department_id', String(department.id));
    if (school) query.set('school_id', String(school.id));
    if (year) query.set('year_id', String(year.id));
    query.set('period', period);
    if (special.primary) query.set(domain === 'cards' ? 'status' : domain === 'attendance' ? 'event_type' : domain === 'security' ? 'severity' : domain === 'services' ? 'result' : 'status', special.primary);
    return `?${query}`;
  }

  async function load() {
    const query = queryString();
    window.history.replaceState({}, '', `${window.location.pathname}${query}`);
    try {
      if (domain === 'cards') {
        const [k, d, t, table] = await Promise.all([
          api.specializedDashboard(domain, 'kpi', query),
          api.specializedDashboard(domain, 'distribution', query),
          api.specializedDashboard(domain, 'trend', query),
          api.specializedDashboard(domain, 'by-school', query),
        ]);
        setKpis((k.items ?? []) as Array<Record<string, unknown>>); setDistribution((d.distribution ?? []) as Array<Record<string, unknown>>);
        setTrend((t.series ?? []) as Array<Record<string, unknown>>); setTableRows((table.items ?? []) as Array<Record<string, unknown>>); setSecondaryDistribution([]);
      } else if (domain === 'attendance') {
        const [k, d, t, table] = await Promise.all([
          api.specializedDashboard(domain, 'kpi', query),
          api.specializedDashboard(domain, 'distribution', query),
          api.specializedDashboard(domain, 'weekly-trend', query),
          api.specializedDashboard(domain, 'by-class', query),
        ]);
        setKpis((k.items ?? []) as Array<Record<string, unknown>>); setDistribution((d.distribution ?? []) as Array<Record<string, unknown>>);
        setTrend((t.series ?? []) as Array<Record<string, unknown>>); setTableRows((table.items ?? []) as Array<Record<string, unknown>>); setSecondaryDistribution([]);
      } else if (domain === 'payments') {
        const [k, providers, categories, table] = await Promise.all([
          api.specializedDashboard(domain, 'kpi', query),
          api.specializedDashboard(domain, 'by-provider', query),
          api.specializedDashboard(domain, 'by-category', query),
          api.specializedDashboard(domain, 'by-school', query),
        ]);
        setKpis((k.items ?? []) as Array<Record<string, unknown>>); setDistribution((providers.items ?? []) as Array<Record<string, unknown>>);
        setSecondaryDistribution((categories.distribution ?? []) as Array<Record<string, unknown>>); setTableRows((table.items ?? []) as Array<Record<string, unknown>>); setTrend([]);
      } else if (domain === 'security') {
        const [k, d, t, table] = await Promise.all([
          api.specializedDashboard(domain, 'kpi', query),
          api.specializedDashboard(domain, 'distribution', query),
          api.specializedDashboard(domain, 'critical-trend', query),
          api.specializedDashboard(domain, 'by-event-type', query),
        ]);
        setKpis((k.items ?? []) as Array<Record<string, unknown>>); setDistribution((d.distribution ?? []) as Array<Record<string, unknown>>);
        setTrend((t.series ?? []) as Array<Record<string, unknown>>); setTableRows((table.items ?? []) as Array<Record<string, unknown>>); setSecondaryDistribution([]);
      } else {
        const [k, d, types, table] = await Promise.all([
          api.specializedDashboard(domain, 'kpi', query),
          api.specializedDashboard(domain, 'distribution', query),
          api.specializedDashboard(domain, 'by-type', query),
          api.specializedDashboard(domain, 'by-type-provider', query),
        ]);
        setKpis((k.items ?? []) as Array<Record<string, unknown>>); setDistribution((d.distribution ?? []) as Array<Record<string, unknown>>);
        setSecondaryDistribution((types.distribution ?? []) as Array<Record<string, unknown>>); setTableRows((table.items ?? []) as Array<Record<string, unknown>>); setTrend([]);
      }
    } catch {
      onError(language === 'fr' ? 'Chargement du tableau de bord refusé.' : 'Dashboard loading denied.');
    }
  }

  useEffect(() => { if (schools.length || regions.length) void load(); }, [schools.length, domain]);

  const labels = specializedFilters(domain, language);
  const backQuery = queryString();
  return (
    <Stack spacing={2}>
      <Paper className="panel" variant="outlined">
        <Button startIcon={<ArrowLeft size={18} />} onClick={() => onBack(backQuery)}>{language === 'fr' ? 'Tableau de bord central' : 'Central dashboard'}</Button>
        <Typography variant="h5" sx={{ mt: 1 }}>{titles[domain][language]}</Typography>
        <div className="dashboardFilters">
          <SearchSelect label={language === 'fr' ? 'Région' : 'Region'} options={regions} value={region} onChange={(value) => { setRegion(value); setDepartment(null); setSchool(null); }} />
          <SearchSelect label={language === 'fr' ? 'Département' : 'Department'} options={departments.filter((item) => !region || Number(item.raw?.region_id) === region.id)} value={department} onChange={(value) => { setDepartment(value); setSchool(null); }} />
          <SearchSelect label={language === 'fr' ? 'Établissement' : 'School'} options={schools.filter((item) => !department || Number(item.raw?.department_id) === department.id)} value={school} onChange={setSchool} />
          <SearchSelect label={language === 'fr' ? 'Année scolaire' : 'School year'} options={years} value={year} onChange={setYear} />
          <TextField select size="small" label={language === 'fr' ? 'Période' : 'Period'} value={period} onChange={(event) => setPeriod(event.target.value)}>
            {['today', '7d', '30d', '90d'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={labels.label} value={special.primary} onChange={(event) => setSpecial({ ...special, primary: event.target.value })}>
            <MenuItem value="">{language === 'fr' ? 'Tous' : 'All'}</MenuItem>
            {labels.options.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <Button variant="contained" startIcon={<Filter size={17} />} onClick={() => void load()}>{language === 'fr' ? 'Filtrer' : 'Filter'}</Button>
          <Button startIcon={<RotateCcw size={17} />} onClick={() => { setRegion(null); setDepartment(null); setSchool(null); setYear(null); setPeriod('30d'); setSpecial({ primary: '', secondary: '' }); }}>{language === 'fr' ? 'Réinitialiser' : 'Reset'}</Button>
        </div>
      </Paper>
      <div className="kpiGrid">{kpis.map((item) => <MetricCard key={String(item.key)} label={localizeField(language, String(item.key))} value={`${String(item.value ?? 0)}${String(item.suffix ?? '')}`} />)}</div>
      {!kpis.length && <Alert severity="info">{language === 'fr' ? 'Aucun indicateur disponible pour ce périmètre.' : 'No metric available for this scope.'}</Alert>}
      <div className="specializedCharts">
        <Paper className="panel" variant="outlined">
          <Typography variant="h6">{language === 'fr' ? 'Répartition' : 'Distribution'}</Typography>
          {domain === 'cards' || domain === 'payments' && secondaryDistribution.length ? <DoughnutChart rows={domain === 'cards' ? distribution : secondaryDistribution} /> : <BarDomainChart rows={distribution} horizontal={domain === 'attendance'} mixed={domain === 'payments'} />}
        </Paper>
        <Paper className="panel" variant="outlined">
          <Typography variant="h6">{domain === 'payments' || domain === 'services' ? (language === 'fr' ? 'Répartition complémentaire' : 'Additional distribution') : (language === 'fr' ? 'Tendance' : 'Trend')}</Typography>
          {trend.length ? <LineDomainChart rows={trend} domain={domain} /> : <DoughnutChart rows={secondaryDistribution} />}
        </Paper>
      </div>
      <Paper className="panel" variant="outlined">
        <Typography variant="h6">{language === 'fr' ? 'Vue agrégée' : 'Aggregated view'}</Typography>
        <AggregatedTable rows={tableRows} onRow={(row) => {
          if (domain === 'cards') onDrillDown(`/operations/cartes?school_id=${row.school_id}&year_id=${year?.id ?? ''}`);
          if (domain === 'attendance') onDrillDown(`/operations/presence?class_id=${row.class_id}&period=${period}`);
          if (domain === 'payments') onDrillDown(`/operations/paiements?school_id=${row.school_id}&period=${period}`);
          if (domain === 'security') onDrillDown(`/securite/audit?event_type=${encodeURIComponent(String(row.event_type))}&period=${period}`);
          if (domain === 'services') onDrillDown(`/operations/services?type=${row.service_type_id}&period=${period}`);
        }} />
      </Paper>
    </Stack>
  );
}

function specializedFilters(domain: Domain, language: 'fr' | 'en') {
  const values: Record<Domain, { label: [string, string]; options: string[] }> = {
    cards: { label: ['Statut', 'Status'], options: ['REQUESTED', 'ISSUED', 'ACTIVE', 'SUSPENDED', 'REVOKED'] },
    attendance: { label: ["Type d'événement", 'Event type'], options: ['PRESENT', 'ABSENT_JUSTIFIED', 'ABSENT_UNJUSTIFIED', 'LATE', 'EARLY_DEPARTURE'] },
    payments: { label: ['Statut', 'Status'], options: ['RECONCILED', 'PENDING', 'FAILED'] },
    security: { label: ['Criticité', 'Severity'], options: ['INFO', 'WARNING', 'HIGH', 'CRITICAL'] },
    services: { label: ['Résultat', 'Result'], options: ['GRANTED', 'ALLOWED', 'DENIED_INELIGIBLE', 'DENIED_SUSPENDED', 'LIMIT_REACHED', 'ERROR'] },
  };
  return { label: values[domain].label[language === 'fr' ? 0 : 1], options: values[domain].options };
}

function DoughnutChart({ rows }: { rows: Array<Record<string, unknown>> }) {
  const language = useLanguage();
  if (!rows.length) return <Typography color="text.secondary">Aucune donnée.</Typography>;
  return <Box sx={{ height: 310, p: 2 }}><Doughnut data={{ labels: rows.map((row) => localizeValue(language, row.label)), datasets: [{ data: rows.map((row) => Number(row.value ?? 0)), backgroundColor: ['#1a73e8', '#2e7d32', '#ed6c02', '#d32f2f', '#7b809a', '#8e24aa'] }] }} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} /></Box>;
}

function BarDomainChart({ rows, horizontal, mixed }: { rows: Array<Record<string, unknown>>; horizontal?: boolean; mixed?: boolean }) {
  const language = useLanguage();
  if (!rows.length) return <Typography color="text.secondary">Aucune donnée.</Typography>;
  const datasets = [
    { label: 'Total', data: rows.map((row) => Number(row.value ?? row.count ?? 0)), backgroundColor: '#1a73e8', yAxisID: 'y' },
    ...(mixed ? [{ label: 'Montant', data: rows.map((row) => Number(row.amount ?? 0)), backgroundColor: '#ed6c02', yAxisID: 'y1' }] : []),
  ];
  return <Box sx={{ height: 310, p: 2 }}><Bar data={{ labels: rows.map((row) => localizeValue(language, row.label)), datasets }} options={{ maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: Boolean(mixed) } }, scales: mixed ? { y: { beginAtZero: true }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } } } : { y: { beginAtZero: true } } }} /></Box>;
}

function LineDomainChart({ rows, domain }: { rows: Array<Record<string, unknown>>; domain: Domain }) {
  const multi = domain === 'cards';
  return <Box sx={{ height: 310, p: 2 }}><Line data={{ labels: rows.map((row) => String(row.label)), datasets: multi ? [{ label: 'Demandées', data: rows.map((row) => Number(row.requested ?? 0)), borderColor: '#7b809a', borderDash: [6, 4] }, { label: 'Activées', data: rows.map((row) => Number(row.activated ?? 0)), borderColor: '#2e7d32' }] : [{ label: 'Total', data: rows.map((row) => Number(row.value ?? 0)), borderColor: '#1a73e8' }, ...(domain === 'attendance' ? [{ label: 'Référence', data: rows.map((row) => Number(row.reference ?? 0)), borderColor: '#ed6c02', borderDash: [6, 4] }] : [])] }} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} /></Box>;
}

function AggregatedTable({ rows, onRow }: { rows: Array<Record<string, unknown>>; onRow: (row: Record<string, unknown>) => void }) {
  const [sort, setSort] = useState('');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const keys = useMemo(() => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 9), [rows]);
  const filtered = useMemo(() => rows.filter((row) => keys.every((key) => {
    const filter = (filters[key] ?? '').trim().toLocaleLowerCase();
    return !filter || String(row[key] ?? '').toLocaleLowerCase().includes(filter);
  })), [rows, keys, filters]);
  const sorted = useMemo(() => !sort ? filtered : [...filtered].sort((a, b) => {
    const comparison = String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), undefined, { numeric: true });
    return direction === 'asc' ? comparison : -comparison;
  }), [filtered, sort, direction]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  if (!rows.length) return <Typography color="text.secondary">Aucune donnée agrégée.</Typography>;
  return <Stack spacing={1}>
    <div className="tableScroller"><table><thead>
      <tr>{keys.map((key) => <th key={key}><button className="sortButton" onClick={() => { if (sort === key) setDirection(direction === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDirection('asc'); } }}>{key} {sort === key ? direction : ''}</button></th>)}</tr>
      <tr>{keys.map((key) => <th key={key}><input className="columnFilter" aria-label={`Filtrer ${key}`} value={filters[key] ?? ''} onChange={(event) => { setFilters({ ...filters, [key]: event.target.value }); setPage(1); }} /></th>)}</tr>
    </thead><tbody>{visibleRows.map((row, index) => <tr key={`${currentPage}-${index}`} onClick={() => onRow(row)}>{keys.map((key) => <td key={key}>{String(row[key] ?? '')}</td>)}</tr>)}</tbody></table></div>
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
      <Button size="small" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
      <Typography variant="caption">{currentPage} / {pages} · {sorted.length}</Typography>
      <Button size="small" disabled={currentPage >= pages} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
    </Stack>
  </Stack>;
}

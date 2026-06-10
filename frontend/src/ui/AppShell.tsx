import {
  AccountCircle,
  AdminPanelSettings,
  Assessment,
  ChevronLeft,
  ChevronRight,
  Dashboard,
  DarkMode,
  ExpandLess,
  ExpandMore,
  Gavel,
  Language,
  LightMode,
  Logout,
  Menu as MenuIcon,
  Refresh,
  School,
  Security,
} from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Language as AppLanguage, localizeValue, t } from '../i18n';
import { AppThemeMode } from './theme';

const drawerWidth = 278;

export type ShellNavItem<T extends string> = [T, string, boolean];
export type ShellNavGroup<T extends string> = {
  key: string;
  label: string;
  items: ShellNavItem<T>[];
};

type Props<T extends string> = {
  children: ReactNode;
  currentTab: T;
  criticalAlerts?: number;
  displayName: string;
  error?: string;
  language: AppLanguage;
  loading?: boolean;
  navGroups: ShellNavGroup<T>[];
  openGroup: string | null;
  roles: string[];
  themeMode: AppThemeMode;
  onChangeLanguage: (language: AppLanguage) => void;
  onChangeTab: (tab: T) => void;
  onLogout: () => void;
  onRefresh: () => void;
  onToggleGroup: (key: string) => void;
  onToggleTheme: () => void;
  onOpenCriticalAlerts: () => void;
};

const groupIcons: Record<string, ReactNode> = {
  account: <AccountCircle />,
  admin: <AdminPanelSettings />,
  schooling: <School />,
  operations: <Dashboard />,
  dashboards: <Assessment />,
  security: <Security />,
  governance: <Gavel />,
};

export function AppShell<T extends string>({
  children,
  criticalAlerts = 0,
  currentTab,
  displayName,
  error,
  language,
  loading = false,
  navGroups,
  openGroup,
  roles,
  themeMode,
  onChangeLanguage,
  onChangeTab,
  onLogout,
  onRefresh,
  onToggleGroup,
  onToggleTheme,
  onOpenCriticalAlerts,
}: Props<T>) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const tablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mini, setMini] = useState(() => localStorage.getItem('educard-menu-mini') === 'true');
  const initialGroupResolved = useRef(false);
  const currentLabel = navGroups.flatMap((group) => group.items).find(([key]) => key === currentTab)?.[1] ?? 'EduCard Secure';
  const label = (key: string) => t(language, key);

  useEffect(() => {
    if (desktop) setMobileOpen(false);
  }, [desktop]);

  useEffect(() => {
    if (tablet) setMini(true);
  }, [tablet]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileOpen) setMobileOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  useEffect(() => {
    localStorage.setItem('educard-menu-mini', String(mini));
  }, [mini]);

  useEffect(() => {
    if (initialGroupResolved.current) return;
    initialGroupResolved.current = true;
    if (openGroup) return;
    const currentGroup = navGroups.find((group) =>
      group.items.some(([key, , visible]) => visible && key === currentTab),
    );
    if (currentGroup) onToggleGroup(currentGroup.key);
  }, [currentTab, navGroups, onToggleGroup, openGroup]);

  const drawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
        background: themeMode === 'dark'
          ? 'linear-gradient(195deg, #1f2937, #111827)'
          : 'linear-gradient(195deg, #42424a, #191919)',
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ px: mini ? 1.25 : 2.25, py: 2.25, minHeight: 74, alignItems: 'center' }}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main' }}>
          <Security fontSize="small" />
        </Avatar>
        {!mini && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>EduCard Secure</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.62)' }} noWrap>
              {language === 'fr' ? 'Administration scolaire' : 'School administration'}
            </Typography>
          </Box>
        )}
      </Stack>
      <Divider sx={{ borderColor: 'rgba(255,255,255,.12)' }} />
      <List sx={{ px: 1.25, py: 1.25, overflowY: 'auto', flex: 1 }}>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(([, , visible]) => visible);
          if (!visibleItems.length) return null;
          const selected = visibleItems.some(([key]) => key === currentTab);
          return (
            <Box key={group.key} sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => onToggleGroup(group.key)}
                selected={selected}
                sx={{
                  minHeight: 44,
                  borderRadius: 1.5,
                  px: mini ? 1.25 : 1.5,
                  color: '#fff',
                  '&.Mui-selected': { bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } },
                  '&:hover': { bgcolor: 'rgba(255,255,255,.08)' },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: mini ? 0 : 38 }}>
                  {groupIcons[group.key] ?? <Dashboard />}
                </ListItemIcon>
                {!mini && <ListItemText primary={<Typography sx={{ fontSize: 14, fontWeight: 600 }}>{group.label}</Typography>} />}
                {!mini && (openGroup === group.key ? <ExpandLess /> : <ExpandMore />)}
              </ListItemButton>
              {!mini && (
                <Collapse in={openGroup === group.key} timeout="auto" unmountOnExit>
                  <List disablePadding sx={{ py: 0.5 }}>
                    {visibleItems.map(([key, label]) => (
                      <ListItemButton
                        key={key}
                        selected={currentTab === key}
                        onClick={() => {
                          onChangeTab(key);
                          if (!desktop) setMobileOpen(false);
                        }}
                        sx={{
                          minHeight: 38,
                          ml: 1.5,
                          pl: 4.25,
                          borderRadius: 1.5,
                          color: 'rgba(255,255,255,.78)',
                          '&::before': {
                            content: '""',
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            bgcolor: currentTab === key ? '#fff' : 'rgba(255,255,255,.42)',
                            position: 'absolute',
                            left: 18,
                          },
                          '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(255,255,255,.12)' },
                          '&:hover': { bgcolor: 'rgba(255,255,255,.08)' },
                        }}
                      >
                        <ListItemText primary={<Typography sx={{ fontSize: 13 }}>{label}</Typography>} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          );
        })}
      </List>
      <Box sx={{ p: 1.5 }}>
        <Button
          fullWidth
          color="inherit"
          startIcon={<Logout />}
          onClick={onLogout}
          sx={{ color: '#fff', justifyContent: mini ? 'center' : 'flex-start', bgcolor: 'rgba(255,255,255,.06)' }}
        >
          {!mini && label('logout')}
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: desktop ? (mini ? 82 : drawerWidth) : '100vw',
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: desktop ? (mini ? 82 : drawerWidth) : '100vw',
            m: desktop ? 2 : 0,
            height: desktop ? 'calc(100vh - 32px)' : '100%',
            border: 0,
            borderRadius: desktop ? 2.5 : 0,
            overflow: 'hidden',
            transition: theme.transitions.create('width'),
          },
        }}
      >
        {drawer}
      </Drawer>

      <Box sx={{ ml: desktop ? `${mini ? 114 : drawerWidth + 32}px` : 0, minWidth: 0, transition: theme.transitions.create('margin-left') }}>
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{ px: { xs: 1.5, md: 3 }, pt: 2, backdropFilter: 'blur(10px)' }}
        >
          <Toolbar
            sx={{
              minHeight: 68,
              borderRadius: 2,
              bgcolor: themeMode === 'dark' ? 'rgba(31,41,55,.88)' : 'rgba(255,255,255,.88)',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 2px 12px rgba(52,71,103,.08)',
              gap: 1,
            }}
          >
            <Tooltip title={desktop
              ? (mini ? (language === 'fr' ? 'Déployer le menu' : 'Expand menu') : (language === 'fr' ? 'Réduire le menu' : 'Collapse menu'))
              : (language === 'fr' ? 'Ouvrir le menu' : 'Open menu')}
            >
              <IconButton onClick={() => desktop ? setMini(!mini) : setMobileOpen(true)}>
                {desktop ? (mini ? <ChevronRight /> : <ChevronLeft />) : <MenuIcon />}
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">EduCard Secure / {currentLabel}</Typography>
              <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>{currentLabel}</Typography>
            </Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 76 }}>
                <Select
                  value={language}
                  onChange={(event) => onChangeLanguage(event.target.value as AppLanguage)}
                  startAdornment={<Language sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} />}
                  inputProps={{ 'aria-label': label('language') }}
                >
                  <MenuItem value="fr">FR</MenuItem>
                  <MenuItem value="en">EN</MenuItem>
                </Select>
              </FormControl>
              <Tooltip title={themeMode === 'light' ? label('darkMode') : label('lightMode')}>
                <IconButton onClick={onToggleTheme}>{themeMode === 'light' ? <DarkMode /> : <LightMode />}</IconButton>
              </Tooltip>
              <Tooltip title={label('refresh')}>
                <IconButton onClick={onRefresh}><Refresh /></IconButton>
              </Tooltip>
              <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right', ml: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{displayName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {roles.map((role) => localizeValue(language, role)).join(', ')}
                </Typography>
              </Box>
              <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', fontSize: 14 }}>
                {displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
              </Avatar>
            </Stack>
          </Toolbar>
          {loading && <LinearProgress aria-label={label('loading')} />}
        </AppBar>

        <Box component="main" sx={{ p: { xs: 1.5, md: 3 }, pt: { xs: 2, md: 2.5 } }}>
          {criticalAlerts > 0 && (
            <Box
              role="alert"
              sx={{
                mb: 2,
                px: 2,
                py: 1.25,
                borderRadius: 1,
                bgcolor: 'error.main',
                color: 'error.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Typography sx={{ fontWeight: 700 }}>
                {criticalAlerts} {language === 'fr' ? 'alerte(s) critique(s) ouverte(s)' : 'open critical alert(s)'}
              </Typography>
              <Button color="inherit" variant="outlined" onClick={onOpenCriticalAlerts}>
                {language === 'fr' ? 'Consulter' : 'Review'}
              </Button>
            </Box>
          )}
          {error && (
            <Box className="alert" role="alert">
              {error}
            </Box>
          )}
          {children}
        </Box>
      </Box>
    </Box>
  );
}

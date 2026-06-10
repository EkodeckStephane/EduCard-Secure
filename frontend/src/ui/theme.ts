import { createTheme } from '@mui/material/styles';

export type AppThemeMode = 'light' | 'dark';

export function createAppTheme(mode: AppThemeMode) {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1a73e8',
        dark: '#1557b0',
      },
      secondary: {
        main: '#344767',
      },
      success: {
        main: '#2e7d32',
      },
      warning: {
        main: '#ed6c02',
      },
      error: {
        main: '#d32f2f',
      },
      background: {
        default: dark ? '#0f172a' : '#eef2f5',
        paper: dark ? '#1e293b' : '#ffffff',
      },
      text: {
        primary: dark ? '#e2e8f0' : '#18212f',
        secondary: dark ? '#94a3b8' : '#64748b',
      },
      divider: dark ? '#334155' : '#d8e0e7',
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: '"Roboto", "Segoe UI", Arial, sans-serif',
      h1: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: 0 },
      h2: { fontSize: '1.1rem', fontWeight: 700, letterSpacing: 0 },
      h3: { fontSize: '1rem', fontWeight: 700, letterSpacing: 0 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            minWidth: 320,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 7,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(52,71,103,0.08)'}`,
            boxShadow: dark
              ? '0 2px 12px rgba(0,0,0,0.24)'
              : '0 2px 12px rgba(52,71,103,0.10)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });
}

 'use client'
import { createContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

export const ColorModeContext = createContext({ mode: 'light', toggleColorMode: () => {} });

const getDesignTokens = (mode) => ({
  palette: {
    mode,
    primary: {
      main: '#2359FF',
    },
    background: {
      default: mode === 'dark' ? '#0b0f17' : '#F5F5F5',
      paper: mode === 'dark' ? '#0f172a' : '#FFFFFF',
    },
    text: {
      primary: mode === 'dark' ? '#e5e7eb' : '#333333',
      secondary: mode === 'dark' ? '#9ca3af' : '#666666',
    },
    divider: mode === 'dark' ? '#1f2937' : '#e5e7eb',
  },
  typography: {
    fontFamily: ['Inter', 'sans-serif'].join(','),
    allVariants: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500, fontSize: '0.9375rem' },
    subtitle2: { fontWeight: 500, fontSize: '0.875rem' },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.875rem' },
  },
  components: {
    MuiTypography: {
      defaultProps: {
        variantMapping: { subtitle1: 'p', subtitle2: 'p' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          boxShadow: 'none',
          fontFamily: ['Inter', 'sans-serif'].join(','),
          '&:hover': { boxShadow: 'none' },
        },
      },
      defaultProps: { disableRipple: true },
    },
    MuiTextField: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
          backgroundImage: 'none',
        },
      },
    },
  },
});

export function Providers({ children }) {
  const [mode, setMode] = useState('dark');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('themeMode') : null;
    if (stored === 'light' || stored === 'dark') setMode(stored);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('themeMode', mode);
  }, [mode]);

  const colorMode = useMemo(() => ({
    mode,
    toggleColorMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
  }), [mode]);

  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

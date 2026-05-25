import { createTheme } from '@mui/material/styles';

export const PALETTE = {
  black: '#000501',
  sage: '#73ab84',
  lightGreen: '#99d19c',
  teal: '#79c7c5',
  lightTeal: '#ade1e5',
} as const;

export const theme = createTheme({
  palette: {
    primary: {
      main: PALETTE.teal,
      dark: '#4fa8a6',
      contrastText: '#fff',
    },
    secondary: {
      main: PALETTE.sage,
      dark: '#52865f',
      contrastText: '#fff',
    },
    success: {
      main: '#3d7d57',
      contrastText: '#fff',
    },
    background: {
      default: '#edf8f9',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body': { overscrollBehavior: 'none' },
      },
    },
  },
});

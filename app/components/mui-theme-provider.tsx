"use client";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const pantryTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#305746", contrastText: "#f7f7ef" },
    secondary: { main: "#e67b4c", contrastText: "#ffffff" },
    background: { default: "#f5f4ef", paper: "#fffefa" },
    text: { primary: "#1e2926", secondary: "#75807a" },
    divider: "#e2e3dc",
  },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    h1: { fontWeight: 700, letterSpacing: "-0.065em" },
    h2: { fontWeight: 700, letterSpacing: "-0.04em" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiCard: { styleOverrides: { root: { borderRadius: 20 } } },
  },
});

export function MuiThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={pantryTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export const colors = {
  brand: {
    50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
    400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
    800: '#9a3412', 900: '#7c2d12',
  },
  ink: { 900: '#0c0a09', 700: '#292524', 500: '#57534e', 300: '#a8a29e', 100: '#e7e5e4' },
  bg: '#fafaf9',
  card: '#ffffff',
  border: '#e7e5e4',
  good: '#10b981',
  warn: '#f59e0b',
  bad:  '#ef4444',
};

export const radii = { sm: 6, md: 10, lg: 16, xl: 22, pill: 999 };

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  glow: {
    shadowColor: '#f97316',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

export const type = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1:      { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2:      { fontSize: 20, fontWeight: '700' as const },
  body:    { fontSize: 15, fontWeight: '500' as const },
  small:   { fontSize: 12, fontWeight: '500' as const },
  caps:    { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
};

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
          400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
          800: '#9a3412', 900: '#7c2d12',
        },
        ink: { 900: '#0c0a09', 700: '#292524', 500: '#57534e', 300: '#a8a29e' },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 6px 24px -8px rgba(15, 23, 42, 0.08)',
        glow: '0 20px 60px -15px rgba(249, 115, 22, 0.35)',
        card: '0 1px 3px rgba(0,0,0,0.04), 0 8px 28px -16px rgba(15,23,42,0.18)',
      },
      backgroundImage: {
        'hero-fade': 'linear-gradient(180deg, rgba(12,10,9,0) 0%, rgba(12,10,9,0.55) 65%, rgba(12,10,9,0.85) 100%)',
        'brand-gradient': 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 12s ease infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

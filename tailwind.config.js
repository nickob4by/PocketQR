/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fintech: {
          dark: '#0a0f1d',
          card: '#111827',
          surface: '#1e293b',
          border: 'rgba(255, 255, 255, 0.1)',
        },
        brand: {
          gcash: {
            DEFAULT: '#005CE6',
            dark: '#003B99',
            light: '#2A7FFF',
          },
          maya: {
            DEFAULT: '#00D66F',
            dark: '#064E3B',
            bg: '#052E16',
          },
          rcbc: {
            DEFAULT: '#0A3180',
            dark: '#00205B',
            accent: '#F59E0B',
          },
          bpi: {
            DEFAULT: '#8B0000',
            dark: '#5C0000',
            accent: '#D97706',
          },
          unionbank: {
            DEFAULT: '#EA580C',
            dark: '#9A3412',
            accent: '#FDBA74',
          },
          bdo: {
            DEFAULT: '#003366',
            dark: '#001F3F',
            accent: '#EAB308',
          },
          gotyme: {
            DEFAULT: '#0D9488',
            dark: '#115E59',
            accent: '#5EEAD4',
          },
          seabank: {
            DEFAULT: '#FF5722',
            dark: '#E64A19',
            accent: '#FFCCBC',
          },
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'wallet': '0 20px 35px -10px rgba(0, 0, 0, 0.5), 0 1px 3px 0 rgba(0, 0, 0, 0.3)',
        'glow-gcash': '0 0 30px -5px rgba(0, 92, 230, 0.35)',
        'glow-maya': '0 0 30px -5px rgba(0, 214, 111, 0.35)',
        'glow-rcbc': '0 0 30px -5px rgba(10, 49, 128, 0.4)',
        'pure-white': '0 0 40px rgba(255, 255, 255, 0.25)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}

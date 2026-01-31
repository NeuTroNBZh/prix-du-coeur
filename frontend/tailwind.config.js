/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Force Tailwind to generate these classes even if not detected in source
  safelist: [
    'bg-pdc-cyan-500',
    'bg-pdc-cyan-600',
    'hover:bg-pdc-cyan-600',
    'hover:bg-pdc-cyan-700',
    'ring-pdc-cyan-400',
    'focus:ring-pdc-cyan-400',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Prix du Coeur Brand Colors (extracted from logo)
        pdc: {
          // Primary dark background (from logo circle)
          dark: {
            DEFAULT: '#303643',
            50: '#f5f6f7',
            100: '#e8eaed',
            200: '#c9cdd4',
            300: '#a0a7b4',
            400: '#6f7a8c',
            500: '#515c6e',
            600: '#434c5c',
            700: '#303643',
            800: '#252a35',
            900: '#1a1e26',
            950: '#12151a',
          },
          // Green mint (from logo heart right side + leaf)
          mint: {
            DEFAULT: '#a0e8af',
            50: '#f0fdf3',
            100: '#dcfce5',
            200: '#bbf7cc',
            300: '#a0e8af',
            400: '#5fd47a',
            500: '#38ba55',
            600: '#299a43',
            700: '#247938',
            800: '#216030',
            900: '#1d4f2a',
            950: '#0a2c14',
          },
          // Coral/peach (from logo horizontal lines)
          coral: {
            DEFAULT: '#eaa895',
            50: '#fdf5f3',
            100: '#fce9e4',
            200: '#fad6cd',
            300: '#eaa895',
            400: '#e38d73',
            500: '#d7684a',
            600: '#c4503a',
            700: '#a4402f',
            800: '#87382b',
            900: '#703329',
            950: '#3c1811',
          },
          // Blue cyan (from logo heart left side)
          cyan: {
            DEFAULT: '#4d97d3',
            50: '#f1f8fe',
            100: '#e2f0fc',
            200: '#bee0f9',
            300: '#84c7f4',
            400: '#4d97d3',
            500: '#2e82c4',
            600: '#1f66a6',
            700: '#1c5287',
            800: '#1b4670',
            900: '#1c3c5e',
            950: '#13273e',
          },
          // Light cyan (accent)
          sky: {
            DEFAULT: '#64c5db',
            50: '#f0fafb',
            100: '#d9f2f6',
            200: '#b8e6ed',
            300: '#64c5db',
            400: '#45b4cc',
            500: '#2a99b3',
            600: '#267b97',
            700: '#25647b',
            800: '#265366',
            900: '#244656',
            950: '#132d3a',
          },
          // Dark teal (from logo)
          teal: {
            DEFAULT: '#36554c',
            50: '#f3f8f6',
            100: '#e0ece8',
            200: '#c2d9d2',
            300: '#96bdb2',
            400: '#6a9c8f',
            500: '#4f8175',
            600: '#3d685e',
            700: '#36554c',
            800: '#2d4640',
            900: '#283b37',
            950: '#14211e',
          },
        },
      },
      backgroundImage: {
        'pdc-gradient': 'linear-gradient(135deg, #4d97d3 0%, #64c5db 50%, #a0e8af 100%)',
        'pdc-gradient-dark': 'linear-gradient(135deg, #303643 0%, #36554c 100%)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neon: {
          pink: '#ff00ff',
          blue: '#00ffff',
          purple: '#bf00ff',
        },
        dark: {
          bg: '#0a0a0f',
          card: '#12121a',
          border: '#1f1f2e',
        },
      },
      boxShadow: {
        neon: '0 0 20px rgba(255, 0, 255, 0.5)',
        'neon-blue': '0 0 20px rgba(0, 255, 255, 0.5)',
      },
    },
  },
  plugins: [],
}

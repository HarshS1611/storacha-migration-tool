/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'storacha': {
          DEFAULT: 'rgb(233, 19, 21)',
          50: 'rgb(255, 232, 232)',
          100: 'rgb(255, 207, 207)',
          200: 'rgb(255, 173, 173)',
          300: 'rgb(252, 138, 139)',
          400: 'rgb(249, 95, 97)',
          500: 'rgb(233, 19, 21)',
          600: 'rgb(192, 16, 17)',
          700: 'rgb(153, 12, 14)',
          800: 'rgb(114, 9, 10)',
          900: 'rgb(75, 6, 7)',
        },
        'filecoin': '#0090ff',
        'filecoin-dark': '#0073cc',
        'success': '#10b981',
        'warning': '#f59e0b',
        'error': '#ef4444',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}; 
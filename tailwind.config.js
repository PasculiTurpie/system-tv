/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f97316',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

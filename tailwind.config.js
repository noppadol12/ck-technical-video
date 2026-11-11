/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.html'],
  theme: {
    extend: {
      fontFamily: { sans: ['Prompt', 'sans-serif'] },
      colors: {
        brand: { 50: '#f0f5ff', 100: '#e5edff', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 900: '#1e3a8a' },
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        float: '0 10px 30px -5px rgba(37, 99, 235, 0.15)',
        glass: '0 4px 30px rgba(0, 0, 0, 0.05)',
      },
    },
  },
};

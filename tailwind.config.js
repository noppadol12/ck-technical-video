/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.html'],
  theme: {
    extend: {
      fontFamily: { sans: ['Anuphan', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#EEF3FD', 100: '#E8EEFB', 400: '#5B8BEA', 500: '#2F6BE0', 600: '#1F5BD8', 700: '#1749B0', 900: '#0F2E73' },
        ink: '#0F172A', muted: '#5B6474', line: '#E4E8EF', canvas: '#F6F8FB', pdf: { bg: '#FFF4E8', fg: '#9A4A07', line: '#F3D9BE' },
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        float: '0 10px 30px -5px rgba(37, 99, 235, 0.15)',
        glass: '0 4px 30px rgba(0, 0, 0, 0.05)',
      },
    },
  },
};

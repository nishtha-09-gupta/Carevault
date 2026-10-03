/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17243a',
        teal: '#087f70',
        mint: '#e6f5f1',
        lilac: '#f0efff',
        canvas: '#f8f8fc',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(24, 38, 61, .06)',
      },
    },
  },
  plugins: [],
}

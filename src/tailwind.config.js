/ @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    ".//*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366F1', // Indigo 500
        secondary: '#8B5CF6', // Purple 500
        accent: '#EC4899', // Pink 500
        background: '#F9FAFB', // Gray 50
        card: '#FFFFFF', // White
        textPrimary: '#1F2937', // Gray 900
        textSecondary: '#6B7280', // Gray 500
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
      boxShadow: {
        'custom-light': '0 4px 15px rgba(0, 0, 0, 0.05)',
        'custom-medium': '0 8px 30px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
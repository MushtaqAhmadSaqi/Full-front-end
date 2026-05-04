module.exports = {
  darkMode: 'class',
  content: [
    './*.html',
    './auth.html',
    './ComsatsGPA/**/*.html',
    './ComsatsGPA/**/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      },
      colors: {
        primary: '#0ea5e9',
        'primary-hover': '#0284c7',
        'primary-light': '#e0f2fe',
        dark: '#1a1a2e',
        accent: '#38bdf8',
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7'
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
  ]
};


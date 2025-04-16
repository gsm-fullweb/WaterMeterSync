/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#4299e1',
        secondary: '#48bb78',
        danger: '#f56565',
        warning: '#ed8936',
        dark: {
          bg: '#1a202c',
          surface: '#2d3748',
          text: '#f7fafc'
        }
      },
    },
  },
  plugins: [],
}
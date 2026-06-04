/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        jts: {
          red:    '#C62828',
          crimson:'#B71C1C',
          navy:   '#1A237E',
          gold:   '#F9A825',
          amber:  '#F57F17',
          cream:  '#FFF8F0',
          lcream: '#FFFDF9',
        },
      },
      fontFamily: {
        sans:   ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        title:  ['Oswald', 'Impact', 'sans-serif'],
        script: ['"Dancing Script"', 'cursive'],
      },
    },
  },
  plugins: [],
};

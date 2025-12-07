/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs", 
    "./public/**/*.js",
    "./*.html"  // Include root HTML files for testing
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark"],
    logs: false,
  },
};


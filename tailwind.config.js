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
    themes: [
      {
        light: {
          ...require("daisyui/theme/object")["light"],
          "primary": "#3b82f6", // Blue-500
          "primary-content": "#ffffff",
          "error": "#ef4444",   // Red-500
          "error-content": "#ffffff",
        },
      },
      "dark",
    ],
    logs: false,
  },
};


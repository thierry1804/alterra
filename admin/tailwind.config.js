/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#e4e4e7",
        background: "#ffffff",
        foreground: "#18181b",
      },
    },
  },
  plugins: [],
};

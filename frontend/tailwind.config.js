/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  // "class" strategy: dark mode is toggled by adding/removing the
  // "dark" class on <html>. We control this in App.jsx via useState.
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Syne", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "0% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "fade-in": {
          "0%":   { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer:  "shimmer 4s linear infinite",
        "fade-in": "fade-in 0.4s ease-out forwards",
      },
      colors: {
        // Semantic surface tokens used across all components
        surface: {
          dark:  "#0A0A0F",
          light: "#F5F4F0",
        },
      },
    },
  },
  plugins: [],
};

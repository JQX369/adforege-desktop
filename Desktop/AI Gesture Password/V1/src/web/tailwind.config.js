/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          start: "#0F172A", // Slate 900
          end: "#1E1B4B",   // Indigo 950
        },
        glass: {
          surface: "rgba(30, 41, 59, 0.7)", // Slate 800 with opacity
          border: "rgba(255, 255, 255, 0.1)",
          highlight: "rgba(255, 255, 255, 0.05)",
        },
        neon: {
          blue: "#38BDF8", // Sky 400
          purple: "#818CF8", // Indigo 400
          pink: "#F472B6", // Pink 400
          green: "#4ADE80", // Green 400
        },
        text: {
          main: "#F8FAFC", // Slate 50
          dim: "#94A3B8",  // Slate 400
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}

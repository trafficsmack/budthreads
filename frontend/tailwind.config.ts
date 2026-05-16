import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1B2B5B",
          light: "#2A3F80",
        },
        red: {
          DEFAULT: "#C8102E",
          light: "#E31837",
        },
        gold: {
          DEFAULT: "#F5A623",
          light: "#FFB84D",
        },
        cream: {
          DEFAULT: "#F4F1EA",
          dark: "#E8E3D5",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "stars-pattern":
          "radial-gradient(circle, rgba(245,166,35,0.15) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;

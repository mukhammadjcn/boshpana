import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#111827",
        panel: "#18212f",
        accent: "#f97316",
        soft: "#94a3b8",
        success: "#22c55e",
        danger: "#ef4444"
      },
      boxShadow: {
        glow: "0 20px 60px rgba(249, 115, 22, 0.18)"
      },
      borderRadius: {
        "4xl": "2rem"
      }
    }
  },
  plugins: []
};

export default config;

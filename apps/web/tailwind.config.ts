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
        bg: {
          base: "#0b0d12",
          surface: "#13161d",
          elevated: "#1c2029",
          overlay: "rgba(11, 13, 18, 0.92)"
        },
        line: {
          subtle: "#262a33",
          strong: "#3a3f4b"
        },
        ink: {
          primary: "#f5f5f7",
          secondary: "#c8ccd4",
          muted: "#8a909c",
          dim: "#5e6470"
        },
        brand: {
          DEFAULT: "#f4a83a",
          hover: "#ffb84d",
          soft: "rgba(244, 168, 58, 0.12)",
          ring: "rgba(244, 168, 58, 0.4)"
        },
        ok: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444"
      },
      fontFamily: {
        sans: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      borderRadius: {
        xl2: "1.25rem",
        "4xl": "2rem"
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)",
        pop: "0 24px 60px rgba(0,0,0,0.55)"
      }
    }
  },
  plugins: []
};

export default config;

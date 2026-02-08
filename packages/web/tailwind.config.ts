import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui"],
        body: ["IBM Plex Sans", "ui-sans-serif", "system-ui"]
      },
      colors: {
        ink: "#0f172a",
        haze: "#e2e8f0",
        ember: "#ff6b35",
        moss: "#2f6f62",
        ocean: "#0f4c5c"
      },
      boxShadow: {
        glow: "0 12px 30px rgba(15, 23, 42, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;

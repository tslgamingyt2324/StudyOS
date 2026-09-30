import type { Config } from "tailwindcss";

// Colour tokens are stored as RGB channels in globals.css so that Tailwind's
// opacity modifiers (bg-surface-sunken/60, text-accent/80, …) work in both themes.
const channel = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: channel("surface"),
          raised: channel("surface-raised"),
          sunken: channel("surface-sunken"),
        },
        ink: {
          DEFAULT: channel("ink"),
          muted: channel("ink-muted"),
          faint: channel("ink-faint"),
        },
        accent: {
          DEFAULT: channel("accent"),
          soft: "var(--accent-soft)",
        },
        border: "var(--border)",
        good: channel("good"),
        warn: channel("warn"),
        bad: channel("bad"),
      },
      borderRadius: { xl2: "1.25rem", xl3: "1.75rem" },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.18)",
        pop: "0 12px 40px -8px rgba(0,0,0,0.35)",
      },
      screens: { xs: "400px" },
    },
  },
  plugins: [],
};
export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--color-border)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        surface: "var(--color-surface)",
        muted: "var(--color-muted)",
        brand: {
          DEFAULT: "var(--color-brand)",
          hover: "var(--color-brand-hover)",
          vivid: "var(--color-brand-vivid)",
          tint: "var(--color-brand-tint)",
          ring: "var(--color-brand-ring)",
        },
        earth: "var(--color-earth)",
        people: {
          bg: "var(--color-people-bg)",
          fg: "var(--color-people-fg)",
        },
      },
      fontFamily: {
        mono: "var(--font-mono)",
      },
      minHeight: {
        touch: "var(--touch-target-min)",
      },
    },
  },
  plugins: [],
};

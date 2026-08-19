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
        "surface-muted": "var(--color-surface-muted)",
        muted: "var(--color-muted)",
        subtle: "var(--color-subtle)",
        // Marque ALTERRA (dérivée du logo)
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
        // Sémantiques (texte + fond)
        success: {
          DEFAULT: "var(--color-success)",
          bg: "var(--color-success-bg)",
        },
        danger: {
          DEFAULT: "var(--color-error)",
          bg: "var(--color-error-bg)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          bg: "var(--color-warning-bg)",
        },
      },
      fontFamily: {
        mono: "var(--font-mono)",
      },
      minHeight: {
        touch: "var(--touch-target-min)",
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem",
      },
      boxShadow: {
        // Ombres sobres, registre institutionnel — pas d'ombres marketing.
        xs: "0 1px 2px 0 rgb(24 24 27 / 0.04)",
        sm: "0 1px 2px 0 rgb(24 24 27 / 0.05), 0 1px 3px 0 rgb(24 24 27 / 0.05)",
        md: "0 2px 4px -1px rgb(24 24 27 / 0.06), 0 4px 12px -2px rgb(24 24 27 / 0.08)",
        overlay: "0 10px 24px -6px rgb(24 24 27 / 0.18), 0 4px 8px -4px rgb(24 24 27 / 0.12)",
        "focus-brand": "0 0 0 2px var(--color-background), 0 0 0 4px var(--color-brand-ring)",
      },
      zIndex: {
        dropdown: "1000",
        sticky: "1020",
        "modal-backdrop": "1040",
        modal: "1050",
        toast: "1060",
        tooltip: "1070",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "content-in": {
          from: { opacity: "0", transform: "translate(-50%, -48%) scale(0.98)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "drawer-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "overlay-in": "overlay-in 150ms ease-out",
        "content-in": "content-in 180ms cubic-bezier(0.22, 1, 0.36, 1)",
        "drawer-in": "drawer-in 200ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

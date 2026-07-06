/** Tailwind config — ASTRO/Space brand mapped onto the existing CSS-variable
 *  tokens, so light/dark (data-theme) keep working. One consistent type scale. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        card: "var(--card)",
        line: "var(--line)",
        field: "var(--field)",
        txt: "var(--txt)",
        "txt-strong": "var(--txt-strong)",
        "txt-dim": "var(--txt-dim)",
        "txt-faint": "var(--txt-faint)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        ok: "var(--ok)",
        danger: "var(--danger)",
        warn: "var(--warn)",
        "warn-bg": "var(--warn-bg)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"Noto Sans Thai"', "system-ui", "sans-serif"],
      },
      // The single source of truth for text sizes (no more ad-hoc px).
      fontSize: {
        "2xs": ["11px", "16px"],
        xs: ["12px", "18px"],
        sm: ["13px", "20px"],
        base: ["14px", "22px"],
        lg: ["16px", "24px"],
        xl: ["20px", "28px"],
        "2xl": ["24px", "32px"],
      },
      borderRadius: {
        card: "16px",
        panel: "20px",
        btn: "10px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.06)",
      },
    },
  },
  plugins: [],
};

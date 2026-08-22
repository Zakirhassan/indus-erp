/**
 * Tailwind theme mapped 1:1 from the "Pro-Ledger ERP" Stitch design system
 * (see docs comment in src/styles/tokens.css for the source designMd).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0f172a", // Deep Slate — nav, headers, primary text
          hover: "#1e293b",
        },
        action: {
          DEFAULT: "#10b981", // Emerald — primary buttons, success/Active status
          hover: "#0ea371",
          container: "#6cf8bb",
          "on-container": "#00714d",
        },
        warning: {
          DEFAULT: "#f59e0b", // Gold — outstanding balances, financing attention
          container: "#ffddb8",
          "on-container": "#653e00",
        },
        danger: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
          "on-container": "#93000a",
        },
        surface: {
          DEFAULT: "#f8f9ff",
          lowest: "#ffffff",
          low: "#eff4ff",
          container: "#e5eeff",
          high: "#dce9ff",
          highest: "#d3e4fe",
        },
        "table-header": "#f1f5f9",
        "row-hover": "#f8fafc",
        border: {
          DEFAULT: "#e2e8f0",
          outline: "#76777d",
          variant: "#c6c6cd",
        },
        ink: {
          DEFAULT: "#0b1c30", // on-surface
          variant: "#45464d", // on-surface-variant
        },
        // Glassmorphism accent tokens — used on non-data surfaces only
        // (login, sidebar/header, modals, summary cards). Never used on
        // DataTable/forms, where translucency would hurt readability.
        glass: {
          DEFAULT: "rgba(255,255,255,0.62)",
          strong: "rgba(255,255,255,0.8)",
          border: "rgba(255,255,255,0.45)",
          dark: "rgba(15,23,42,0.55)",
          "dark-strong": "rgba(15,23,42,0.7)",
          "dark-border": "rgba(255,255,255,0.14)",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["30px", { lineHeight: "38px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.01em" }],
        "title-sm": ["18px", { lineHeight: "28px", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "label-bold": ["12px", { lineHeight: "16px", fontWeight: "600", letterSpacing: "0.05em" }],
        "table-data": ["13px", { lineHeight: "16px", fontWeight: "450" }],
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      spacing: {
        gutter: "16px",
        "container-p": "24px",
        "row-standard": "52px",
        "row-dense": "40px",
        sidebar: "240px",
      },
      boxShadow: {
        modal: "0px 20px 25px -5px rgba(0,0,0,0.1)",
        glass: "0 8px 32px 0 rgba(15,23,42,0.16)",
      },
      backgroundImage: {
        "glass-login": "radial-gradient(circle at 15% 15%, #1e293b 0%, #0f172a 45%, #10b981 130%)",
        "glass-sidebar": "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
      },
    },
  },
  plugins: [],
};

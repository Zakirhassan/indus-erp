/** Color/type tokens ported 1:1 from apps/admin-web/tailwind.config.js so the vendor app reads as the same product. */
export const colors = {
  primary: "#0f172a",
  primaryHover: "#1e293b",
  action: "#10b981",
  actionHover: "#0ea371",
  actionContainer: "#6cf8bb",
  actionOnContainer: "#00714d",
  warning: "#f59e0b",
  warningContainer: "#ffddb8",
  warningOnContainer: "#653e00",
  danger: "#ba1a1a",
  dangerContainer: "#ffdad6",
  dangerOnContainer: "#93000a",
  surface: "#f8f9ff",
  surfaceLowest: "#ffffff",
  surfaceLow: "#eff4ff",
  surfaceContainer: "#e5eeff",
  tableHeader: "#f1f5f9",
  border: "#e2e8f0",
  ink: "#0b1c30",
  inkVariant: "#45464d",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
};

export const type = {
  displayLg: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.3 },
  headlineMd: { fontSize: 20, fontWeight: "600" as const },
  titleSm: { fontSize: 16, fontWeight: "600" as const },
  bodyMd: { fontSize: 14, fontWeight: "400" as const },
  bodySm: { fontSize: 13, fontWeight: "400" as const },
  labelBold: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.5 },
};

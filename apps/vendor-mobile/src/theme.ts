import { Easing } from "react-native";

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
  glass: "rgba(255,255,255,0.14)",
  glassBorder: "rgba(255,255,255,0.22)",
};

/** Gradient pairs for hero surfaces, primary CTAs, and status accents — same brand hues as `colors`, just lit. */
export const gradients = {
  hero: ["#0f172a", "#1e3a5f"] as const,
  action: ["#10b981", "#0b8c5c"] as const,
  warm: ["#f59e0b", "#dc7f0e"] as const,
  danger: ["#e0433f", "#ba1a1a"] as const,
  slate: ["#f8f9ff", "#e5eeff"] as const,
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
  xxl: 24,
};

export const type = {
  displayLg: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.3 },
  headlineMd: { fontSize: 20, fontWeight: "600" as const },
  titleSm: { fontSize: 16, fontWeight: "600" as const },
  bodyMd: { fontSize: 14, fontWeight: "400" as const },
  bodySm: { fontSize: 13, fontWeight: "400" as const },
  labelBold: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.5 },
};

/** Real elevation instead of a 1px border everywhere — cross-platform (iOS shadow* + Android elevation). */
export const shadow = {
  sm: { shadowColor: "#0b1c30", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: "#0b1c30", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  lg: { shadowColor: "#0b1c30", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
};

/** Shared motion rhythm so every screen's entrance/press animation feels like the same app. */
export const motion = {
  duration: { fast: 150, base: 250, slow: 400 },
  easing: {
    standard: Easing.bezier(0.2, 0, 0, 1),
    decelerate: Easing.out(Easing.cubic),
  },
  stagger: 40,
};

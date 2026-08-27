import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export type IconName = keyof typeof Ionicons.glyphMap;

/** Thin wrapper so every icon in the app shares defaults — no more emoji standing in for iconography. */
export function Icon({ name, size = 20, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, type as typeTokens } from "../theme";

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "dark" | "secondary" | "danger";
}) {
  const background =
    variant === "dark" ? colors.primary : variant === "danger" ? colors.danger : variant === "secondary" ? colors.surfaceLowest : colors.action;
  const textColor = variant === "secondary" ? colors.ink : "#ffffff";
  const borderColor = variant === "secondary" ? colors.border : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.text, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { ...typeTokens.titleSm },
});

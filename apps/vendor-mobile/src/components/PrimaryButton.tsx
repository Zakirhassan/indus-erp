import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AnimatedPressable } from "./AnimatedPressable";
import { Icon, type IconName } from "./Icon";
import { colors, gradients, radius, shadow, spacing, type as typeTokens } from "../theme";

const GRADIENT_BY_VARIANT = {
  primary: gradients.action,
  dark: [colors.primary, colors.primaryHover] as const,
  danger: gradients.danger,
} as const;

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "dark" | "secondary" | "danger";
  icon?: IconName;
}) {
  const isSecondary = variant === "secondary";
  const textColor = isSecondary ? colors.ink : "#ffffff";
  const isDisabled = disabled || loading;

  const inner = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <>
      {icon ? <Icon name={icon} size={18} color={textColor} /> : null}
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </>
  );

  if (isSecondary) {
    return (
      <AnimatedPressable onPress={onPress} disabled={isDisabled} style={[styles.button, styles.secondary, { opacity: isDisabled ? 0.5 : 1 }]}>
        {inner}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable onPress={onPress} disabled={isDisabled} style={{ opacity: isDisabled ? 0.5 : 1 }}>
      <LinearGradient
        colors={GRADIENT_BY_VARIANT[variant as "primary" | "dark" | "danger"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, shadow.sm]}
      >
        {inner}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  secondary: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  text: { ...typeTokens.titleSm },
});

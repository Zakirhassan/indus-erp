import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, spacing, type as typeTokens } from "../theme";

export function LabeledInput({ label, ...props }: { label?: string } & TextInputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <TextInput style={styles.input} placeholderTextColor={colors.inkVariant} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typeTokens.labelBold, color: colors.inkVariant },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceLowest,
    color: colors.ink,
    ...typeTokens.bodyMd,
  },
});

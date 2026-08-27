import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, spacing, type as typeTokens } from "../theme";

export function LabeledInput({ label, onFocus, onBlur, ...props }: { label?: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        placeholderTextColor={colors.inkVariant}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typeTokens.labelBold, color: colors.inkVariant },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceLowest,
    color: colors.ink,
    ...typeTokens.bodyMd,
  },
  inputFocused: { borderColor: colors.action },
});

import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type as typeTokens } from "../theme";

export function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "default" | "action" | "warning";
}) {
  const background = tone === "action" ? colors.actionContainer : tone === "warning" ? colors.surfaceLowest : colors.surfaceLowest;
  const valueColor = tone === "action" ? colors.actionOnContainer : colors.ink;
  return (
    <View style={[styles.card, { backgroundColor: background }]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...typeTokens.labelBold, color: colors.inkVariant, marginBottom: spacing.xs },
  value: { ...typeTokens.displayLg },
  sublabel: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: spacing.xs },
});

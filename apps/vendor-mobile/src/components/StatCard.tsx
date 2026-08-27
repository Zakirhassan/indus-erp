import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, type IconName } from "./Icon";
import { colors, gradients, radius, shadow, spacing, type as typeTokens } from "../theme";

export function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "default" | "action" | "warning";
  icon?: IconName;
}) {
  const isAccent = tone === "action";
  const valueColor = isAccent ? "#ffffff" : colors.ink;
  const labelColor = isAccent ? "rgba(255,255,255,0.78)" : colors.inkVariant;
  const sublabelColor = isAccent ? "rgba(255,255,255,0.7)" : colors.inkVariant;

  const content = (
    <>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: labelColor }]}>{label.toUpperCase()}</Text>
        {icon ? (
          <View style={[styles.iconBadge, { backgroundColor: isAccent ? "rgba(255,255,255,0.2)" : colors.surfaceContainer }]}>
            <Icon name={icon} size={14} color={isAccent ? "#ffffff" : colors.primary} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {sublabel ? <Text style={[styles.sublabel, { color: sublabelColor }]}>{sublabel}</Text> : null}
    </>
  );

  if (isAccent) {
    return (
      <LinearGradient colors={gradients.action} style={[styles.card, shadow.md]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {content}
      </LinearGradient>
    );
  }

  return <View style={[styles.card, shadow.sm, { backgroundColor: colors.surfaceLowest }]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xxl,
    padding: spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBadge: { width: 22, height: 22, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  label: { ...typeTokens.labelBold },
  value: { ...typeTokens.displayLg, marginTop: spacing.xs },
  sublabel: { ...typeTokens.bodySm, marginTop: spacing.xs },
});

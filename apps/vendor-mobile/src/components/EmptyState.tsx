import { StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { colors, radius, spacing, type as typeTokens } from "../theme";

/** Icon + title + subtitle — replaces bare gray "No X yet." text across empty lists. */
export function EmptyState({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={26} color={colors.inkVariant} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.sm },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.xxl,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: { ...typeTokens.titleSm, color: colors.ink, textAlign: "center" },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant, textAlign: "center" },
});

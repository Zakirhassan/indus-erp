import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type as typeTokens } from "../theme";

const TONE_BY_STATUS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: colors.warningContainer, fg: colors.warningOnContainer },
  VERIFIED: { bg: colors.surfaceContainer, fg: colors.ink },
  APPROVED: { bg: colors.actionContainer, fg: colors.actionOnContainer },
  REJECTED: { bg: colors.dangerContainer, fg: colors.dangerOnContainer },
  ACTIVE: { bg: colors.actionContainer, fg: colors.actionOnContainer },
  INACTIVE: { bg: colors.surfaceContainer, fg: colors.inkVariant },
  overdue: { bg: colors.dangerContainer, fg: colors.dangerOnContainer },
  "due-today": { bg: colors.warningContainer, fg: colors.warningOnContainer },
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE_BY_STATUS[status] ?? { bg: colors.surfaceContainer, fg: colors.ink };
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{status === "due-today" ? "Due Today" : status === "overdue" ? "Overdue" : status.charAt(0) + status.slice(1).toLowerCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  text: { ...typeTokens.labelBold },
});

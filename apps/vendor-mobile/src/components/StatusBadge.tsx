import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type as typeTokens } from "../theme";

const TONE_BY_STATUS: Record<string, { bg: string; fg: string; dot: string }> = {
  DRAFT: { bg: colors.surfaceContainer, fg: colors.inkVariant, dot: colors.inkVariant },
  PENDING: { bg: colors.warningContainer, fg: colors.warningOnContainer, dot: colors.warning },
  VERIFIED: { bg: colors.surfaceContainer, fg: colors.ink, dot: colors.primary },
  APPROVED: { bg: colors.actionContainer, fg: colors.actionOnContainer, dot: colors.action },
  REJECTED: { bg: colors.dangerContainer, fg: colors.dangerOnContainer, dot: colors.danger },
  ACTIVE: { bg: colors.actionContainer, fg: colors.actionOnContainer, dot: colors.action },
  INACTIVE: { bg: colors.surfaceContainer, fg: colors.inkVariant, dot: colors.inkVariant },
  overdue: { bg: colors.dangerContainer, fg: colors.dangerOnContainer, dot: colors.danger },
  "due-today": { bg: colors.warningContainer, fg: colors.warningOnContainer, dot: colors.warning },
};

const LABEL_OVERRIDE: Record<string, string> = {
  "due-today": "Due Today",
  overdue: "Overdue",
};

// INACTIVE covers two different real situations (see packages/db/src/queries/customers.ts):
// balance naturally reached zero (approveCustomerSale/saveCollectionBatch auto-inactivate), or
// an admin manually "Mark Inactive"'d the customer for an unrelated reason (relocated,
// unreachable, written off) while a balance is still outstanding. A blanket "Paid Off" label
// would be wrong for the second case, so callers that know the balance pass an explicit
// `label` override; this component never guesses from status alone.
export function StatusBadge({ status, label: labelProp }: { status: string; label?: string }) {
  const tone = TONE_BY_STATUS[status] ?? { bg: colors.surfaceContainer, fg: colors.ink, dot: colors.ink };
  const label = labelProp ?? LABEL_OVERRIDE[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...typeTokens.labelBold },
});

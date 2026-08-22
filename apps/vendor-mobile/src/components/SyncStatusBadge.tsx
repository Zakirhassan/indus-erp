import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type as typeTokens } from "../theme";
import { useOfflineQueue } from "../offline/OfflineQueueContext";

/** Unmistakable pending-sync indicator — shown whenever collections are queued offline or an unstable connection is retrying. */
export function SyncStatusBadge() {
  const { pendingCount, isOnline, syncing } = useOfflineQueue();
  if (pendingCount === 0 && isOnline) return null;

  const label = !isOnline
    ? pendingCount > 0
      ? `Offline — ${pendingCount} pending`
      : "Offline"
    : syncing
      ? `Syncing ${pendingCount}…`
      : `${pendingCount} pending`;

  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: isOnline ? colors.warning : colors.danger }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...typeTokens.labelBold, color: "#fff" },
});

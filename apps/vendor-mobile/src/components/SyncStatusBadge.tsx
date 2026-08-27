import { StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
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
      <Icon name={isOnline ? "sync" : "cloud-offline"} size={12} color={isOnline ? colors.warning : "#ffdad6"} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  text: { ...typeTokens.labelBold, color: "#fff" },
});

import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { useField } from "../context/FieldContext";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeInUp } from "../components/FadeInUp";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
import { colors, gradients, radius, shadow, spacing, type as typeTokens } from "../theme";

export function ProfileScreen() {
  const { session, logout } = useAuth();
  const { myFields } = useField();

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(session?.name ?? "?").slice(0, 2).toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.name}>{session?.name ?? "Collector"}</Text>
        <View style={styles.rolePill}>
          <Icon name={session?.role === "ADMIN" ? "shield-checkmark" : "briefcase"} size={13} color="#fff" />
          <Text style={styles.role}>{session?.role === "ADMIN" ? "Administrator" : "Collector"}</Text>
        </View>
        <View style={styles.syncRow}>
          <SyncStatusBadge />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.statsRow}>
          <View style={[styles.statChip, shadow.sm]}>
            <Text style={styles.statValue}>{myFields.length}</Text>
            <Text style={styles.statLabel}>Assigned Fields</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Assigned Fields</Text>
        <View style={[styles.card, shadow.sm]}>
          {myFields.length === 0 ? (
            <EmptyState icon="map-outline" title="No fields assigned yet" />
          ) : (
            myFields.map((f, i) => (
              <FadeInUp key={f.id} delay={i * 40}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldIcon}>
                    <Icon name="location" size={14} color={colors.primary} />
                  </View>
                  <Text style={styles.fieldCode}>{f.code}</Text>
                  <Text style={styles.fieldDescription} numberOfLines={1}>
                    {f.description}
                  </Text>
                </View>
              </FadeInUp>
            ))
          )}
        </View>

        <AnimatedPressable style={styles.signOut} onPress={logout}>
          <Icon name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingTop: 56,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typeTokens.headlineMd, color: "#fff" },
  name: { ...typeTokens.headlineMd, color: "#fff" },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  role: { ...typeTokens.bodySm, color: "#fff" },
  syncRow: { marginTop: spacing.sm },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: -spacing.xxl },
  statChip: {
    flex: 1,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xxl,
    padding: spacing.md,
    alignItems: "center",
  },
  statValue: { ...typeTokens.displayLg, color: colors.ink },
  statLabel: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: 2 },
  sectionTitle: { ...typeTokens.labelBold, color: colors.inkVariant },
  card: {
    borderRadius: radius.xxl,
    backgroundColor: colors.surfaceLowest,
    padding: spacing.sm,
  },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  fieldIcon: { width: 28, height: 28, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  fieldCode: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
  fieldDescription: { ...typeTokens.bodySm, color: colors.inkVariant, flex: 1 },
  signOut: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.dangerContainer,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceLowest,
  },
  signOutText: { ...typeTokens.bodyMd, color: colors.danger, fontWeight: "700" },
});

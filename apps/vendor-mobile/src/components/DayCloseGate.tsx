import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatINR } from "@indus/shared-types";
import { getPendingDayClose, submitPastDrafts } from "../api/collections";
import { FadeInUp } from "./FadeInUp";
import { Icon } from "./Icon";
import { PrimaryButton } from "./PrimaryButton";
import { colors, gradients, radius, shadow, spacing, type as typeTokens } from "../theme";

/**
 * Blocks the whole app behind a "close out yesterday" screen whenever the collector has
 * DRAFT collection batches from before today that they recorded but never submitted.
 * Submission here just means promoted to PENDING for admin review — not approved — but
 * the next day's collection/sales work shouldn't start until that backlog is cleared.
 */
export function DayCloseGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pending-day-close"],
    queryFn: getPendingDayClose,
    refetchOnWindowFocus: true,
  });

  const outstanding = useMemo(() => data ?? [], [data]);
  const totalPaise = outstanding.reduce((s, b) => s + b.totalAmountPaise, 0);

  const submitAll = useMutation({
    mutationFn: submitPastDrafts,
    onSuccess: (batches) => {
      queryClient.setQueryData(["pending-day-close"], batches);
      queryClient.invalidateQueries({ queryKey: ["my-batches-today"] });
      queryClient.invalidateQueries({ queryKey: ["my-batch"] });
    },
  });

  // Loading is only ever the first fetch (the query stays hot afterwards) — avoid flashing
  // the blocking screen while we don't yet know whether there's anything to block on.
  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  if (outstanding.length === 0) {
    return <>{children}</>;
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.warm} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.heroIcon}>
          <Icon name="time" size={28} color="#ffffff" />
        </View>
        <Text style={styles.heroTitle}>Yesterday isn't closed out</Text>
        <Text style={styles.heroSubtitle}>
          Submit these routes before starting today's collection or sales — they don't need admin approval yet, just submission.
        </Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
        <Text style={styles.sectionLabel}>Outstanding · {formatINR(totalPaise)}</Text>
        {outstanding.map((batch, i) => (
          <FadeInUp key={batch.id} delay={i * 40}>
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.cardIcon}>
                  <Icon name="document-text" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.cardField}>{batch.fieldCode}</Text>
                  <Text style={styles.cardDate}>
                    {new Date(batch.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardAmount}>{formatINR(batch.totalAmountPaise)}</Text>
            </View>
          </FadeInUp>
        ))}

        {submitAll.isError ? <Text style={styles.error}>Couldn't submit — check your connection and try again.</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={submitAll.isPending ? "Submitting…" : "Submit All & Continue"}
          onPress={() => submitAll.mutate()}
          loading={submitAll.isPending}
          icon="checkmark-done"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  hero: { paddingTop: 64, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xs },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  heroTitle: { ...typeTokens.headlineMd, color: "#ffffff" },
  heroSubtitle: { ...typeTokens.bodyMd, color: "rgba(255,255,255,0.88)" },
  body: { flex: 1, padding: spacing.lg },
  sectionLabel: { ...typeTokens.labelBold, color: colors.inkVariant, marginBottom: spacing.xs },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xxl,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardIcon: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: colors.warningContainer, alignItems: "center", justifyContent: "center" },
  cardField: { ...typeTokens.titleSm, color: colors.ink },
  cardDate: { ...typeTokens.bodySm, color: colors.inkVariant },
  cardAmount: { ...typeTokens.titleSm, color: colors.ink, fontWeight: "700" },
  error: {
    ...typeTokens.bodySm,
    color: colors.dangerOnContainer,
    backgroundColor: colors.dangerContainer,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, backgroundColor: colors.surfaceLowest },
});

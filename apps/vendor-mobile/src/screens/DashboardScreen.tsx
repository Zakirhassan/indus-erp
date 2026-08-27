import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CollectionBatchStatus, formatINR } from "@indus/shared-types";
import { StatCard } from "../components/StatCard";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { PrimaryButton } from "../components/PrimaryButton";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeInUp } from "../components/FadeInUp";
import { Icon } from "../components/Icon";
import { ProgressBar } from "../components/ProgressBar";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/Skeleton";
import { OccurrenceFilter, type OccurrenceFilterValue } from "../components/OccurrenceFilter";
import { useAuth } from "../context/AuthContext";
import { useField } from "../context/FieldContext";
import { getCollectDueReport, type CollectDueRow } from "../api/reports";
import { myBatchesToday, submitDayBatches } from "../api/collections";
import { colors, gradients, radius, shadow, spacing, type as typeTokens } from "../theme";
import type { DashboardStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<DashboardStackParamList, "DashboardHome">;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Last-5-periods payment history strip — green if a collection landed in that period, red if not. */
function CollectionDots({ periods }: { periods: boolean[] }) {
  return (
    <View style={styles.dotsRow}>
      {periods.map((collected, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: collected ? colors.action : colors.danger }]} />
      ))}
    </View>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const { session, logout } = useAuth();
  const { myFields } = useField();
  const today = todayIso();
  const queryClient = useQueryClient();
  const [occurrenceFilter, setOccurrenceFilter] = useState<OccurrenceFilterValue>("ALL");

  // "Whom to collect today" spans every field this collector is assigned to, not just one —
  // there's no single active field anymore now that Collection has its own per-field cards.
  const dueQueries = useQueries({
    queries: myFields.map((f) => ({
      queryKey: ["collect-due", f.id],
      queryFn: () => getCollectDueReport(f.id),
    })),
  });
  const isLoading = dueQueries.some((q) => q.isLoading);

  const { data: todaysBatches } = useQuery({
    queryKey: ["my-batches-today", today],
    queryFn: () => myBatchesToday(today),
  });

  const submitDay = useMutation({
    mutationFn: () => submitDayBatches(today),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-batches-today", today] });
      queryClient.invalidateQueries({ queryKey: ["my-batch"] });
    },
  });

  const allTasks: CollectDueRow[] = useMemo(
    () => dueQueries.flatMap((q) => [...(q.data?.overdue ?? []), ...(q.data?.dueToday ?? [])]),
    [dueQueries],
  );
  const tasks = useMemo(
    () => (occurrenceFilter === "ALL" ? allTasks : allTasks.filter((t) => t.occurrence === occurrenceFilter)),
    [allTasks, occurrenceFilter],
  );
  const totalToCollectPaise = allTasks.reduce((s, t) => s + t.amountDuePaise, 0);
  const batchesTouchedToday = todaysBatches?.filter((b) => b.entries.length > 0) ?? [];
  const draftBatches = batchesTouchedToday.filter((b) => b.status === CollectionBatchStatus.Draft);
  const collectedTodayPaise = batchesTouchedToday.reduce((s, b) => s + b.totalAmountPaise, 0);
  const customersVisited = batchesTouchedToday.reduce((s, b) => s + b.entries.length, 0);
  const dayProgress = totalToCollectPaise + collectedTodayPaise > 0 ? collectedTodayPaise / (totalToCollectPaise + collectedTodayPaise) : 0;

  function openDraft(fieldId: string) {
    // Cross-tab navigation: the draft lives in the Collection tab's own stack, not this one.
    // getParent() returns the tab navigator's untyped prop, so the nested screen+params shape isn't checked here.
    (navigation.getParent() as { navigate: (tab: string, opts: { screen: string; params: unknown }) => void } | undefined)?.navigate(
      "CollectionTab",
      { screen: "AddCollection", params: { fieldId } },
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hello, {session?.name ?? "Collector"}!</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </Text>
          </View>
          <AnimatedPressable onPress={logout} style={styles.logoutButton}>
            <Icon name="log-out-outline" size={18} color="#fff" />
          </AnimatedPressable>
        </View>
        <View style={styles.syncRow}>
          <SyncStatusBadge />
        </View>
        <View style={styles.progressWrap}>
          <ProgressBar progress={dayProgress} />
          <Text style={styles.progressLabel}>{Math.round(dayProgress * 100)}% of today's due collected</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.statsRow}>
          <StatCard label="Total to Collect" value={formatINR(totalToCollectPaise)} sublabel={`${tasks.length} Customers Remaining`} icon="wallet-outline" />
          <StatCard
            label="Collected Today"
            value={formatINR(collectedTodayPaise)}
            sublabel={`${customersVisited} Customers Visited`}
            tone="action"
            icon="trending-up"
          />
        </View>

        {draftBatches.length > 0 ? (
          <FadeInUp>
            <View style={styles.draftBanner}>
              <View style={styles.draftHeader}>
                <Icon name="document-text-outline" size={16} color={colors.ink} />
                <Text style={styles.draftTitle}>Today's Draft Collections</Text>
              </View>
              {draftBatches.map((b) => (
                <AnimatedPressable key={b.id} style={styles.draftRow} onPress={() => openDraft(b.fieldId)}>
                  <Text style={styles.draftFieldLabel}>{b.fieldCode}</Text>
                  <View style={styles.draftRowRight}>
                    <Text style={styles.draftFieldAmount}>{formatINR(b.totalAmountPaise)}</Text>
                    <Icon name="chevron-forward" size={14} color={colors.action} />
                  </View>
                </AnimatedPressable>
              ))}
              <PrimaryButton
                title={submitDay.isPending ? "Submitting…" : "Submit All for Approval"}
                onPress={() => submitDay.mutate()}
                loading={submitDay.isPending}
                variant="dark"
                icon="checkmark-done"
              />
              {submitDay.isError ? <Text style={styles.draftError}>Failed to submit. Try again.</Text> : null}
            </View>
          </FadeInUp>
        ) : null}

        <View style={styles.tasksHeader}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          <OccurrenceFilter value={occurrenceFilter} onChange={setOccurrenceFilter} />
        </View>

        {isLoading && tasks.length === 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SkeletonCard height={68} />
            <SkeletonCard height={68} />
            <SkeletonCard height={68} />
          </View>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.customerId}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.sm }}
            refreshing={isLoading}
            renderItem={({ item, index }) => (
              <FadeInUp delay={Math.min(index, 8) * 40}>
                <AnimatedPressable
                  style={styles.taskRow}
                  onPress={() => navigation.navigate("CustomerDetail", { customerId: item.customerId })}
                >
                  <View style={styles.taskLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.fieldCode}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskName} numberOfLines={1}>
                        {item.fieldCode}-{item.serialNo} {item.name}
                      </Text>
                      <Text style={styles.taskAddress} numberOfLines={1}>
                        {item.address}
                      </Text>
                      <View style={styles.collectionHistoryRow}>
                        <Text style={styles.lastCollected}>
                          {item.lastCollectionDate ? `Last collected ${item.lastCollectionDate}` : "No collections yet"}
                        </Text>
                        <CollectionDots periods={item.recentPeriods} />
                      </View>
                    </View>
                  </View>
                  <View style={styles.taskRight}>
                    <Text style={styles.taskAmount}>{formatINR(item.amountDuePaise)}</Text>
                    <Icon name="chevron-forward" size={16} color={colors.inkVariant} />
                  </View>
                </AnimatedPressable>
              </FadeInUp>
            )}
            ListEmptyComponent={!isLoading ? <EmptyState icon="checkmark-circle-outline" title="Nothing due today" subtitle="You're all caught up on collections." /> : null}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingTop: 56,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { ...typeTokens.headlineMd, color: "#fff" },
  date: { ...typeTokens.bodySm, color: "#cbd5e1", marginTop: 2 },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  syncRow: {},
  progressWrap: { gap: spacing.xs, marginTop: spacing.xs },
  progressLabel: { ...typeTokens.bodySm, color: "rgba(255,255,255,0.8)" },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.md },
  draftBanner: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  draftHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  draftTitle: { ...typeTokens.labelBold, color: colors.ink },
  draftRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  draftRowRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  draftFieldLabel: { ...typeTokens.bodySm, color: colors.inkVariant },
  draftFieldAmount: { ...typeTokens.bodySm, color: colors.ink, fontWeight: "600" },
  draftError: { ...typeTokens.bodySm, color: colors.dangerOnContainer },
  tasksHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  sectionTitle: { ...typeTokens.titleSm, color: colors.ink },
  list: { flex: 1 },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xxl,
    ...shadow.sm,
  },
  taskLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.actionContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typeTokens.labelBold, color: colors.actionOnContainer },
  taskName: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  taskAddress: { ...typeTokens.bodySm, color: colors.inkVariant },
  collectionHistoryRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 },
  lastCollected: { ...typeTokens.bodySm, color: colors.inkVariant },
  dotsRow: { flexDirection: "row", gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  taskRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  taskAmount: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
});

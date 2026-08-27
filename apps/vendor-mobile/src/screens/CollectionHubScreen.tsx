import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatINR, type CollectionBatch, type FieldRoute } from "@indus/shared-types";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeInUp } from "../components/FadeInUp";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/Skeleton";
import { useField } from "../context/FieldContext";
import { myBatchesToday, recentBatches } from "../api/collections";
import { colors, radius, shadow, spacing, type as typeTokens } from "../theme";
import type { CollectionStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<CollectionStackParamList, "CollectionHub">;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateHeader(dateIso: string): string {
  const today = todayIso();
  if (dateIso === today) return "Today";
  const d = new Date(`${dateIso}T00:00:00Z`);
  const t = new Date(`${today}T00:00:00Z`);
  const diffDays = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const ACCENT_BY_STATUS: Record<string, string> = {
  DRAFT: colors.inkVariant,
  PENDING: colors.warning,
  VERIFIED: colors.primary,
  APPROVED: colors.action,
  REJECTED: colors.danger,
};

export function CollectionHubScreen({ navigation }: Props) {
  const { myFields, setActiveFieldId } = useField();
  const today = todayIso();

  const { data: todaysBatches, isLoading } = useQuery({
    queryKey: ["my-batches-today", today],
    queryFn: () => myBatchesToday(today),
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-batches"],
    queryFn: () => recentBatches(10),
  });

  const batchByField = new Map<string, CollectionBatch>((todaysBatches ?? []).map((b) => [b.fieldId, b]));

  function openField(field: FieldRoute) {
    setActiveFieldId(field.id);
    navigation.navigate("AddCollection", { fieldId: field.id });
  }

  function openHistoryBatch(b: CollectionBatch) {
    navigation.navigate("AddCollection", { fieldId: b.fieldId, batchId: b.id });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Collection</Text>
        <Text style={styles.subtitle}>Pick a field to record today's collections</Text>
      </View>

      {isLoading && myFields.length === 0 ? (
        <View style={styles.grid}>
          <View style={styles.column}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        </View>
      ) : (
        <FlatList
          data={myFields}
          keyExtractor={(f) => f.id}
          numColumns={2}
          refreshing={isLoading}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.column}
          renderItem={({ item: field, index }) => {
            const batch = batchByField.get(field.id);
            const hasActivity = !!batch && batch.entries.length > 0;
            const accent = hasActivity ? (ACCENT_BY_STATUS[batch.status] ?? colors.action) : colors.border;
            return (
              <FadeInUp delay={index * 50} style={{ flex: 1 }}>
                <AnimatedPressable style={[styles.card, shadow.md]} onPress={() => openField(field)}>
                  <View style={[styles.cardAccent, { backgroundColor: accent }]} />
                  <View style={styles.cardTop}>
                    <Text style={styles.cardCode}>{field.code}</Text>
                    <View style={styles.cardIcon}>
                      <Icon name="location-outline" size={14} color={colors.primary} />
                    </View>
                  </View>
                  <Text style={styles.cardDescription} numberOfLines={1}>
                    {field.description}
                  </Text>
                  <Text style={styles.cardAmount}>{formatINR(batch?.totalAmountPaise ?? 0)}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardLabel}>Collected Today</Text>
                    {hasActivity ? <StatusBadge status={batch!.status} /> : null}
                  </View>
                </AnimatedPressable>
              </FadeInUp>
            );
          }}
          ListEmptyComponent={
            !isLoading ? <EmptyState icon="map-outline" title="No fields assigned yet" subtitle="Ask an admin to assign you a collection route." /> : null
          }
          ListFooterComponent={
            recent && recent.length > 0 ? (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recent Collections</Text>
                {recent.map((b, i) => {
                  const isNewDate = i === 0 || recent[i - 1]!.date !== b.date;
                  return (
                    <View key={b.id}>
                      {isNewDate ? (
                        <View style={[styles.dateHeaderRow, i > 0 && { marginTop: spacing.sm }]}>
                          <Text style={styles.dateHeaderText}>{formatDateHeader(b.date)}</Text>
                          <View style={styles.dateHeaderLine} />
                        </View>
                      ) : null}
                      <AnimatedPressable style={styles.recentRow} onPress={() => openHistoryBatch(b)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recentField}>{b.fieldCode}</Text>
                          {b.reopenedAt ? <Text style={styles.recentReopened}>Reopened for edit</Text> : null}
                        </View>
                        <Text style={styles.recentAmount}>{formatINR(b.totalAmountPaise)}</Text>
                        <StatusBadge status={b.status} />
                      </AnimatedPressable>
                    </View>
                  );
                })}
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  column: { gap: spacing.md },
  card: {
    flex: 1,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: 2,
    backgroundColor: colors.surfaceLowest,
    minHeight: 130,
    overflow: "hidden",
  },
  cardAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: spacing.xs },
  cardCode: { ...typeTokens.titleSm, color: colors.ink, fontWeight: "700" },
  cardIcon: { width: 26, height: 26, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  cardDescription: { ...typeTokens.bodySm, color: colors.inkVariant, marginBottom: spacing.xs },
  cardAmount: { ...typeTokens.headlineMd, color: colors.ink },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  cardLabel: { ...typeTokens.bodySm, color: colors.inkVariant },
  recentSection: { marginTop: spacing.lg, gap: spacing.sm },
  recentTitle: { ...typeTokens.titleSm, color: colors.ink, fontWeight: "700" },
  dateHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
  dateHeaderText: { ...typeTokens.labelBold, color: colors.inkVariant },
  dateHeaderLine: { flex: 1, height: 1, backgroundColor: colors.border },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  recentField: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  recentReopened: { ...typeTokens.bodySm, color: colors.warning, marginTop: 2 },
  recentAmount: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
});

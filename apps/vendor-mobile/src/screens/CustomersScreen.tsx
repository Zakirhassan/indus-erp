import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomerStatus, formatINR } from "@indus/shared-types";
import { LabeledInput } from "../components/LabeledInput";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeInUp } from "../components/FadeInUp";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/Skeleton";
import { OccurrenceFilter, type OccurrenceFilterValue } from "../components/OccurrenceFilter";
import { useField } from "../context/FieldContext";
import { listCustomers, type CustomerListRow } from "../api/customers";
import { colors, radius, shadow, spacing, type as typeTokens } from "../theme";
import type { CustomersStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<CustomersStackParamList, "CustomersHome">;

const ALL_FIELDS = "ALL";

const STALENESS_OPTIONS = [
  { label: "Any time", days: 0 },
  { label: "7+ days", days: 7 },
  { label: "15+ days", days: 15 },
  { label: "30+ days", days: 30 },
  { label: "60+ days", days: 60 },
  { label: "6+ months", days: 182 },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateIso: string): number {
  const from = new Date(`${dateIso}T00:00:00Z`).getTime();
  const to = new Date(`${todayIso()}T00:00:00Z`).getTime();
  return Math.floor((to - from) / 86_400_000);
}

export function CustomersScreen({ navigation }: Props) {
  const { myFields } = useField();
  const [selectedFieldId, setSelectedFieldId] = useState<string>(ALL_FIELDS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [occurrenceFilter, setOccurrenceFilter] = useState<OccurrenceFilterValue>("ALL");
  const [staleDays, setStaleDays] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // "All" spans every field this collector is assigned to — not a fieldId-less API call, which
  // would return every OTHER collector's customers too. One query per assigned field, merged.
  const fieldsToQuery = selectedFieldId === ALL_FIELDS ? myFields : myFields.filter((f) => f.id === selectedFieldId);
  const results = useQueries({
    queries: fieldsToQuery.map((f) => ({
      queryKey: ["field-customers-browse", f.id, search],
      queryFn: () => listCustomers({ fieldId: f.id, search: search || undefined, pageSize: 200 }),
    })),
  });
  const isLoading = results.some((r) => r.isLoading);
  const customers = results
    .flatMap((r) => r.data?.items ?? [])
    .filter((c) => occurrenceFilter === "ALL" || c.occurrence === occurrenceFilter)
    .filter((c) => staleDays === 0 || c.lastCollectionDate === null || daysSince(c.lastCollectionDate) >= staleDays);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>My Customers</Text>
        <Text style={styles.subtitle}>Everyone assigned to your routes</Text>
      </View>

      {myFields.length > 1 ? (
        <View style={styles.fieldChips}>
          <AnimatedPressable
            style={[styles.fieldChip, selectedFieldId === ALL_FIELDS && styles.fieldChipActive]}
            onPress={() => setSelectedFieldId(ALL_FIELDS)}
          >
            <Text style={[styles.fieldChipText, selectedFieldId === ALL_FIELDS && styles.fieldChipTextActive]}>All</Text>
          </AnimatedPressable>
          {myFields.map((f) => {
            const active = f.id === selectedFieldId;
            return (
              <AnimatedPressable key={f.id} style={[styles.fieldChip, active && styles.fieldChipActive]} onPress={() => setSelectedFieldId(f.id)}>
                <Text style={[styles.fieldChipText, active && styles.fieldChipTextActive]}>{f.code}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <LabeledInput placeholder="Search name or serial…" value={searchInput} onChangeText={setSearchInput} />
      </View>

      <View style={styles.filterWrap}>
        <OccurrenceFilter value={occurrenceFilter} onChange={setOccurrenceFilter} />
      </View>

      <View style={styles.staleFilterWrap}>
        <Text style={styles.staleFilterLabel}>Not collected in</Text>
        <View style={styles.staleChips}>
          {STALENESS_OPTIONS.map((opt) => {
            const active = opt.days === staleDays;
            return (
              <AnimatedPressable
                key={opt.days}
                style={[styles.staleChip, active && styles.staleChipActive]}
                onPress={() => setStaleDays(opt.days)}
              >
                <Text style={[styles.staleChipText, active && styles.staleChipTextActive]}>{opt.label}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {isLoading && customers.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          refreshing={isLoading}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm }}
          renderItem={({ item, index }) => (
            <FadeInUp delay={Math.min(index, 8) * 30}>
              <CustomerRow item={item} onPress={() => navigation.navigate("CustomerDetail", { customerId: item.id })} />
            </FadeInUp>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                icon="people-outline"
                title={search ? "No matches" : "No customers yet"}
                subtitle={search ? "Try a different name or serial number." : "This field has no customers assigned yet."}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

function CustomerRow({ item, onPress }: { item: CustomerListRow; onPress: () => void }) {
  return (
    <AnimatedPressable style={[styles.row, shadow.sm]} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.fieldCode}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          #{item.serialNo} {item.name}
        </Text>
        <Text style={styles.meta}>
          {formatINR(item.financeAmountPaise)} / {item.occurrence.charAt(0) + item.occurrence.slice(1).toLowerCase()}
        </Text>
        <StatusBadge
          status={item.status}
          label={item.status === CustomerStatus.Inactive ? (item.balancePaise === 0 ? "Paid Off" : "Inactive") : undefined}
        />
      </View>
      <Text style={styles.amount}>{formatINR(item.balancePaise)}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  fieldChips: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  fieldChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.xl, backgroundColor: colors.surfaceContainer },
  fieldChipActive: { backgroundColor: colors.primary },
  fieldChipText: { ...typeTokens.labelBold, color: colors.inkVariant },
  fieldChipTextActive: { color: "#fff" },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  filterWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  staleFilterWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  staleFilterLabel: { ...typeTokens.labelBold, color: colors.inkVariant },
  staleChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  staleChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.surfaceContainer },
  staleChipActive: { backgroundColor: colors.primary },
  staleChipText: { ...typeTokens.bodySm, color: colors.inkVariant },
  staleChipTextActive: { color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xxl,
    padding: spacing.md,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typeTokens.labelBold, color: colors.primary },
  name: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  meta: { ...typeTokens.bodySm, color: colors.inkVariant, marginBottom: 2 },
  amount: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
});

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeInUp } from "../components/FadeInUp";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/Skeleton";
import { listMySubmittedCustomers, type CustomerListRow } from "../api/customers";
import { getTodaysAddOnSales, type TodaysAddOnSaleRow } from "../api/reports";
import { colors, gradients, radius, shadow, spacing, type as typeTokens } from "../theme";
import type { SalesStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<SalesStackParamList, "SalesHome">;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Unified transaction row so a new customer sale and an add-on product both render the same way. */
interface TodaysTransaction {
  id: string;
  name: string;
  fieldCode: string;
  serialNo: number;
  approvalStatus: CustomerListRow["approvalStatus"];
  amountPaise: number;
}

export function SalesHomeScreen({ navigation }: Props) {
  const today = todayIso();

  // No fieldId filter — a sale can be for any of the collector's assigned fields, and this view
  // is meant to show everything they sold today regardless of which route it belongs to.
  const { data, isLoading } = useQuery({
    queryKey: ["my-submitted-customers"],
    queryFn: () => listMySubmittedCustomers({}),
  });
  // Add-on products added to an existing (older) customer's sale today — these don't move the
  // customer's original purchaseDate, so they'd otherwise be invisible here (see
  // CustomerDetailScreen's "Add Product" and queries/reports.ts#getTodaysAddOnSales).
  const { data: addOnSales, isLoading: addOnLoading } = useQuery({
    queryKey: ["today-add-on-sales", today],
    queryFn: () => getTodaysAddOnSales(today),
  });

  const newSalesToday: TodaysTransaction[] = useMemo(
    () =>
      (data?.items ?? [])
        .filter((c) => c.purchaseDate === today)
        .map((c) => ({
          id: c.id,
          name: c.name,
          fieldCode: c.fieldCode,
          serialNo: c.serialNo,
          approvalStatus: c.approvalStatus,
          amountPaise: c.finalAmountPaise,
        })),
    [data, today],
  );
  const addOnsToday: TodaysTransaction[] = useMemo(
    () =>
      (addOnSales ?? []).map((r: TodaysAddOnSaleRow) => ({
        id: `${r.customerId}-addon`,
        name: r.name,
        fieldCode: r.fieldCode,
        serialNo: r.serialNo,
        approvalStatus: r.approvalStatus,
        amountPaise: r.amountPaise,
      })),
    [addOnSales],
  );
  const todaysSales: TodaysTransaction[] = useMemo(
    () => [...newSalesToday, ...addOnsToday],
    [newSalesToday, addOnsToday],
  );
  const totalSalesPaise = todaysSales.reduce((s, c) => s + c.amountPaise, 0);
  const isLoadingAny = isLoading || addOnLoading;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales</Text>
        <Text style={styles.subtitle}>Today's sales, across every field</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Total Sales" value={formatINR(totalSalesPaise)} icon="cash-outline" />
        <StatCard label="New Customers" value={String(newSalesToday.length)} tone="action" icon="people-outline" />
      </View>

      <Text style={styles.sectionTitle}>Transactions</Text>
      {isLoadingAny && todaysSales.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
        </View>
      ) : (
        <FlatList
          data={todaysSales}
          keyExtractor={(item) => item.id}
          refreshing={isLoadingAny}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm }}
          renderItem={({ item, index }) => (
            <FadeInUp delay={Math.min(index, 8) * 40}>
              <View style={[styles.row, shadow.sm]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta}>
                    {item.fieldCode}-{item.serialNo}
                  </Text>
                  <StatusBadge status={item.approvalStatus} />
                </View>
                <Text style={styles.amount}>{formatINR(item.amountPaise)}</Text>
              </View>
            </FadeInUp>
          )}
          ListEmptyComponent={
            !isLoadingAny ? <EmptyState icon="receipt-outline" title="No sales recorded today" subtitle="Tap the + button to add a new customer sale." /> : null
          }
        />
      )}

      <AnimatedPressable style={styles.fabWrap} onPress={() => navigation.navigate("NewSale")}>
        <LinearGradient colors={gradients.action} style={[styles.fab, shadow.lg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Icon name="add" size={28} color="#fff" />
        </LinearGradient>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  statsRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { ...typeTokens.labelBold, color: colors.inkVariant, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
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
  meta: { ...typeTokens.bodySm, color: colors.inkVariant },
  amount: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
  fabWrap: { position: "absolute", right: spacing.lg, bottom: spacing.xl },
  fab: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
});

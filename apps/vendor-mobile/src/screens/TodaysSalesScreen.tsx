import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { useField } from "../context/FieldContext";
import { listMySubmittedCustomers, type CustomerListRow } from "../api/customers";
import { colors, radius, spacing, type as typeTokens } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "TodaysSales">;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TodaysSalesScreen({ navigation }: Props) {
  const { activeField } = useField();
  const today = todayIso();

  const { data, isLoading } = useQuery({
    queryKey: ["my-submitted-customers", activeField?.id],
    queryFn: () => listMySubmittedCustomers({ fieldId: activeField?.id }),
    enabled: !!activeField,
  });

  const todaysSales: CustomerListRow[] = useMemo(
    () => (data?.items ?? []).filter((c) => c.purchaseDate === today),
    [data, today],
  );
  const totalSalesPaise = todaysSales.reduce((s, c) => s + c.finalAmountPaise, 0);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          ← Back
        </Text>
        <Text style={styles.title}>Today's Sales</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Total Sales" value={formatINR(totalSalesPaise)} />
        <StatCard label="New Customers" value={String(todaysSales.length)} tone="action" />
      </View>

      <Text style={styles.sectionTitle}>Transactions</Text>
      <FlatList
        data={todaysSales}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.fieldCode}-{item.serialNo}
              </Text>
              <StatusBadge status={item.approvalStatus} />
            </View>
            <Text style={styles.amount}>{formatINR(item.finalAmountPaise)}</Text>
          </View>
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No sales recorded today.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  back: { ...typeTokens.bodyMd, color: colors.action, fontWeight: "600" },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  statsRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { ...typeTokens.labelBold, color: colors.inkVariant, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avatar: { width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typeTokens.labelBold, color: colors.primary },
  name: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  meta: { ...typeTokens.bodySm, color: colors.inkVariant },
  amount: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
  empty: { ...typeTokens.bodyMd, color: colors.inkVariant, textAlign: "center", padding: spacing.xl },
});

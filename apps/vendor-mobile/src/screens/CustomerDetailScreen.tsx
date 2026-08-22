import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatINR, LedgerEntryType, type LedgerEntry } from "@indus/shared-types";
import { StatusBadge } from "../components/StatusBadge";
import { getCustomer, getLedger } from "../api/customers";
import { colors, radius, spacing, type as typeTokens } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "CustomerDetail">;

const LEDGER_LABEL: Record<string, string> = {
  [LedgerEntryType.Sale]: "Sale",
  [LedgerEntryType.Collection]: "Collection",
  [LedgerEntryType.Return]: "Return",
};

export function CustomerDetailScreen({ route, navigation }: Props) {
  const { customerId } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => getCustomer(customerId),
  });
  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["customer-ledger", customerId],
    queryFn: () => getLedger(customerId),
  });

  if (isLoading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { customer, sale } = data;
  const plan = sale.financePlan;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          ← Back
        </Text>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              #{customer.serialNo} {customer.name}
            </Text>
            <Text style={styles.subtitle}>
              {customer.relation} {customer.relationName}
            </Text>
          </View>
          <StatusBadge status={customer.status} />
        </View>
      </View>

      <FlatList
        data={ledger ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Outstanding Balance</Text>
              <Text style={styles.balanceValue}>{formatINR(sale.balancePaise)}</Text>
              <View style={styles.planRow}>
                <PlanStat label="Installment" value={formatINR(plan.regularInstallmentPaise)} />
                <PlanStat label="Occurrence" value={plan.occurrence.charAt(0) + plan.occurrence.slice(1).toLowerCase()} />
                <PlanStat label="Final Amount" value={formatINR(sale.finalAmountPaise)} />
              </View>
            </View>

            <View style={styles.infoCard}>
              <InfoRow label="Address" value={customer.address} />
              <InfoRow label="Phone" value={customer.phone} />
              <InfoRow label="Purchase Date" value={new Date(sale.saleDate).toLocaleDateString()} />
            </View>

            <Text style={styles.sectionTitle}>Ledger History</Text>
            {ledgerLoading ? <ActivityIndicator style={{ marginBottom: spacing.md }} color={colors.primary} /> : null}
          </>
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm }}
        renderItem={({ item }) => <LedgerRow entry={item} />}
        ListEmptyComponent={!ledgerLoading ? <Text style={styles.empty}>No ledger entries yet.</Text> : null}
      />
    </View>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={styles.planValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.creditPaise > 0;
  return (
    <View style={styles.ledgerRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.ledgerType}>{LEDGER_LABEL[entry.type] ?? entry.type}</Text>
        <Text style={styles.ledgerMeta}>
          {new Date(entry.date).toLocaleDateString()}
          {entry.collectedBy ? ` • ${entry.collectedBy}` : ""}
          {entry.note ? ` • ${entry.note}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.ledgerAmount, { color: isCredit ? colors.actionOnContainer : colors.ink }]}>
          {isCredit ? "+" : "-"}
          {formatINR(isCredit ? entry.creditPaise : entry.debitPaise)}
        </Text>
        <Text style={styles.ledgerBalance}>Bal {formatINR(entry.balanceAfterPaise)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  back: { ...typeTokens.bodyMd, color: colors.action, fontWeight: "600" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  balanceLabel: { ...typeTokens.bodySm, color: "#cbd5e1" },
  balanceValue: { ...typeTokens.displayLg, color: "#fff", marginTop: 2, marginBottom: spacing.md },
  planRow: { flexDirection: "row" },
  planLabel: { ...typeTokens.labelBold, color: "#94a3b8" },
  planValue: { ...typeTokens.bodyMd, color: "#fff", fontWeight: "600", marginTop: 2 },
  infoCard: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoRow: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { ...typeTokens.bodySm, color: colors.inkVariant },
  infoValue: { ...typeTokens.bodySm, color: colors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  sectionTitle: { ...typeTokens.labelBold, color: colors.inkVariant, marginBottom: spacing.sm },
  ledgerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  ledgerType: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  ledgerMeta: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: 2 },
  ledgerAmount: { ...typeTokens.bodyMd, fontWeight: "700" },
  ledgerBalance: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: 2 },
  empty: { ...typeTokens.bodyMd, color: colors.inkVariant, textAlign: "center", padding: spacing.xl },
});

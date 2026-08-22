import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatINR } from "@indus/shared-types";
import { LabeledInput } from "../components/LabeledInput";
import { StatusBadge } from "../components/StatusBadge";
import { useField } from "../context/FieldContext";
import { listCustomers, type CustomerListRow } from "../api/customers";
import { colors, radius, spacing, type as typeTokens } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Customers">;

export function CustomersScreen({ navigation }: Props) {
  const { activeField } = useField();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["field-customers-browse", activeField?.id, search],
    queryFn: () => listCustomers({ fieldId: activeField!.id, search: search || undefined, pageSize: 200 }),
    enabled: !!activeField,
  });
  const customers = data?.items ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          ← Back
        </Text>
        <Text style={styles.title}>My Customers</Text>
        <Text style={styles.subtitle}>Route {activeField?.code ?? "—"}</Text>
      </View>

      <View style={styles.searchWrap}>
        <LabeledInput placeholder="Search name or serial…" value={searchInput} onChangeText={setSearchInput} />
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm }}
        renderItem={({ item }) => <CustomerRow item={item} onPress={() => navigation.navigate("CustomerDetail", { customerId: item.id })} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>{search ? "No customers match your search." : "No customers in this field yet."}</Text>
          ) : null
        }
      />
    </View>
  );
}

function CustomerRow({ item, onPress }: { item: CustomerListRow; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          #{item.serialNo} {item.name}
        </Text>
        <Text style={styles.meta}>
          {formatINR(item.financeAmountPaise)} / {item.occurrence.charAt(0) + item.occurrence.slice(1).toLowerCase()}
        </Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.amount}>{formatINR(item.balancePaise)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  back: { ...typeTokens.bodyMd, color: colors.action, fontWeight: "600" },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
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
  meta: { ...typeTokens.bodySm, color: colors.inkVariant, marginBottom: 2 },
  amount: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
  empty: { ...typeTokens.bodyMd, color: colors.inkVariant, textAlign: "center", padding: spacing.xl },
});

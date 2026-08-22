import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { SelectField } from "../components/SelectField";
import { useAuth } from "../context/AuthContext";
import { useField } from "../context/FieldContext";
import { getCollectDueReport, type CollectDueRow } from "../api/reports";
import { myBatch } from "../api/collections";
import { colors, radius, spacing, type as typeTokens } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardScreen({ navigation }: Props) {
  const { session, logout } = useAuth();
  const { myFields, activeField, setActiveFieldId } = useField();
  const [menuOpen, setMenuOpen] = useState(false);
  const today = todayIso();

  const { data: dueReport, isLoading } = useQuery({
    queryKey: ["collect-due", activeField?.id],
    queryFn: () => getCollectDueReport(activeField!.id),
    enabled: !!activeField,
  });

  const { data: todaysBatch } = useQuery({
    queryKey: ["my-batch", activeField?.id, today],
    queryFn: () => myBatch(today, activeField!.id),
    enabled: !!activeField,
  });

  const tasks: CollectDueRow[] = useMemo(
    () => [...(dueReport?.overdue ?? []), ...(dueReport?.dueToday ?? [])],
    [dueReport],
  );
  const totalToCollectPaise = tasks.reduce((s, t) => s + t.amountDuePaise, 0);
  const collectedTodayPaise = todaysBatch?.totalAmountPaise ?? 0;
  const customersVisited = todaysBatch?.entries.length ?? 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {session?.name ?? "Collector"}!</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </Text>
          <View style={styles.syncRow}>
            <SyncStatusBadge />
          </View>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.logout}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <SelectField
          label="Active Field"
          placeholder="Select field"
          value={activeField?.id ?? ""}
          onChange={setActiveFieldId}
          options={myFields.map((f) => ({ value: f.id, label: `${f.code} — ${f.description}` }))}
        />

        <View style={styles.statsRow}>
          <StatCard
            label="Total to Collect"
            value={formatINR(totalToCollectPaise)}
            sublabel={`${tasks.length} Customers Remaining`}
          />
          <StatCard
            label="Collected Today"
            value={formatINR(collectedTodayPaise)}
            sublabel={`${customersVisited} Customers Visited`}
            tone="action"
          />
        </View>

        <View style={styles.tasksHeader}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          <View style={styles.headerLinks}>
            <Pressable onPress={() => navigation.navigate("Customers")}>
              <Text style={styles.link}>My Customers</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("TodaysSales")}>
              <Text style={styles.link}>Today's Sales</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={tasks}
          keyExtractor={(item) => item.customerId}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.taskRow}
              onPress={() => navigation.navigate("CustomerDetail", { customerId: item.customerId })}
            >
              <View style={styles.taskLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.taskName}>
                    #{item.serialNo} {item.name}
                  </Text>
                  <Text style={styles.taskAddress}>{item.address}</Text>
                  {item.status === "overdue" ? <StatusBadge status="overdue" /> : null}
                </View>
              </View>
              <Text style={styles.taskAmount}>{formatINR(item.amountDuePaise)}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !isLoading ? <Text style={styles.empty}>Nothing due for this field today.</Text> : null
          }
        />
      </View>

      <Pressable style={styles.fab} onPress={() => setMenuOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("AddCollection");
              }}
            >
              <Text style={styles.menuItemText}>Record Collection</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("NewSale");
              }}
            >
              <Text style={styles.menuItemText}>New Sale</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 56,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: { ...typeTokens.headlineMd, color: "#fff" },
  date: { ...typeTokens.bodySm, color: "#cbd5e1", marginTop: 2 },
  syncRow: { marginTop: spacing.sm },
  logout: { ...typeTokens.bodySm, color: "#cbd5e1", textDecorationLine: "underline" },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.md },
  tasksHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  headerLinks: { flexDirection: "row", gap: spacing.md },
  sectionTitle: { ...typeTokens.titleSm, color: colors.ink },
  link: { ...typeTokens.bodySm, color: colors.action, fontWeight: "600" },
  list: { flex: 1 },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  taskLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typeTokens.labelBold, color: colors.primary },
  taskName: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  taskAddress: { ...typeTokens.bodySm, color: colors.inkVariant },
  taskAmount: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
  empty: { ...typeTokens.bodyMd, color: colors.inkVariant, textAlign: "center", padding: spacing.xl },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.action,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  menu: { backgroundColor: colors.surfaceLowest, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  menuItem: { paddingVertical: spacing.md },
  menuItemText: { ...typeTokens.titleSm, color: colors.ink },
});

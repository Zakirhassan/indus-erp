import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatINR, paiseToRupees, rupeesToPaise } from "@indus/shared-types";
import { SelectField } from "../components/SelectField";
import { LabeledInput } from "../components/LabeledInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { useField } from "../context/FieldContext";
import { useOfflineQueue } from "../offline/OfflineQueueContext";
import { listCustomers, type CustomerListRow } from "../api/customers";
import { myBatch } from "../api/collections";
import { colors, radius, spacing, type as typeTokens } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AddCollection">;

const DEFAULT_ROW_COUNT = 10;

interface Row {
  key: string;
  customerId: string;
  serialNo: number | null;
  amountRupees: string;
}

function emptyRow(): Row {
  return { key: Math.random().toString(36).slice(2), customerId: "", serialNo: null, amountRupees: "" };
}

function emptyRows(count: number): Row[] {
  return Array.from({ length: count }, emptyRow);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddCollectionScreen({ navigation }: Props) {
  const { activeField } = useField();
  const { submitOrQueue } = useOfflineQueue();
  const [rows, setRows] = useState<Row[]>(() => emptyRows(DEFAULT_ROW_COUNT));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"submitted" | "queued" | null>(null);
  const hydratedBatchId = useRef<string | null>(null);

  const { data: customersPage } = useQuery({
    queryKey: ["field-customers", activeField?.id],
    queryFn: () => listCustomers({ fieldId: activeField!.id, pageSize: 1000 }),
    enabled: !!activeField,
  });
  const customers = customersPage?.items ?? [];

  const { data: existingBatch } = useQuery({
    queryKey: ["my-batch", activeField?.id],
    queryFn: () => myBatch(todayIso(), activeField!.id),
    enabled: !!activeField,
  });

  // Resume an in-progress batch instead of always starting blank — a collector who reopens the
  // app mid-route (or after backgrounding it) should see what they already entered today.
  useEffect(() => {
    if (!existingBatch || hydratedBatchId.current === existingBatch.id) return;
    hydratedBatchId.current = existingBatch.id;
    const filledRows: Row[] = existingBatch.entries.map((e) => ({
      key: e.id,
      customerId: e.customerId,
      serialNo: e.serialNo,
      amountRupees: String(paiseToRupees(e.amountPaise)),
    }));
    const padding = Math.max(0, DEFAULT_ROW_COUNT - filledRows.length);
    setRows([...filledRows, ...emptyRows(padding)]);
  }, [existingBatch]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const sessionTotalPaise = useMemo(
    () => rows.reduce((s, r) => s + (r.customerId && r.amountRupees ? rupeesToPaise(Number(r.amountRupees) || 0) : 0), 0),
    [rows],
  );
  const entryCount = rows.filter((r) => r.customerId && Number(r.amountRupees) > 0).length;

  async function onSubmit() {
    if (!activeField) return;
    setError(null);
    const entries = rows
      .filter((r) => r.customerId && Number(r.amountRupees) > 0)
      .map((r) => ({ serialNo: r.serialNo!, amountPaise: rupeesToPaise(Number(r.amountRupees)) }));
    if (entries.length === 0) {
      setError("Add at least one collection amount");
      return;
    }
    setSubmitting(true);
    try {
      const outcome = await submitOrQueue({
        date: new Date().toISOString().slice(0, 10),
        fieldId: activeField.id,
        entries,
      });
      setResult(outcome.queued ? "queued" : "submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <View style={styles.center}>
        <Text style={styles.confirmTitle}>
          {result === "queued" ? "Saved — Will Sync Automatically" : "Submitted for Approval"}
        </Text>
        <Text style={styles.confirmBody}>
          {result === "queued"
            ? "No connection right now, so these entries are saved on this device. They'll be sent and submitted for admin approval as soon as you're back online — no need to re-enter them."
            : "Your collection entries have been sent to the admin for review. They won't post to the ledger until approved."}
        </Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => navigation.navigate("Dashboard")} variant="dark" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Collection</Text>
        <Text style={styles.subtitle}>Route {activeField?.code ?? "—"}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView style={styles.rows} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
        {rows.map((row, index) => {
          const customer = customers.find((c) => c.id === row.customerId);
          return (
            <View key={row.key} style={styles.row}>
              <Text style={styles.rowNumber}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 2 }}>
                <SelectField
                  placeholder="Search name…"
                  value={row.customerId}
                  searchable
                  onChange={(customerId) => {
                    const c = customers.find((x) => x.id === customerId);
                    updateRow(row.key, { customerId, serialNo: c?.serialNo ?? null });
                  }}
                  options={customers.map((c) => ({
                    value: c.id,
                    label: c.name,
                    subtitle: `${c.fieldCode}-${c.serialNo} • Balance ${formatINR(c.balancePaise)}`,
                  }))}
                />
                {customer ? <Text style={styles.customerHint}>{customer.fieldCode}-{customer.serialNo}</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={row.amountRupees}
                  onChangeText={(v) => updateRow(row.key, { amountRupees: v })}
                />
              </View>
            </View>
          );
        })}
        <Text style={styles.addRow} onPress={() => setRows((prev) => [...prev, emptyRow()])}>
          + Add Row
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.sessionLabel}>Session Total</Text>
            <Text style={styles.sessionEntries}>{entryCount} entries</Text>
          </View>
          <Text style={styles.sessionTotal}>{formatINR(sessionTotalPaise)}</Text>
        </View>
        <PrimaryButton title={submitting ? "Submitting…" : "Submit for Approval"} onPress={onSubmit} loading={submitting} variant="dark" />
        <PrimaryButton title="Cancel Entry" onPress={() => navigation.goBack()} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  rows: { flex: 1, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  rowNumber: { ...typeTokens.bodySm, color: colors.inkVariant, width: 20, paddingTop: spacing.sm },
  customerHint: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: 2 },
  addRow: { ...typeTokens.bodyMd, color: colors.action, fontWeight: "600", paddingVertical: spacing.sm },
  error: {
    ...typeTokens.bodySm,
    color: colors.dangerOnContainer,
    backgroundColor: colors.dangerContainer,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surfaceLowest,
  },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sessionLabel: { ...typeTokens.bodySm, color: colors.inkVariant },
  sessionEntries: { ...typeTokens.bodySm, color: colors.inkVariant },
  sessionTotal: { ...typeTokens.headlineMd, color: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface },
  confirmTitle: { ...typeTokens.headlineMd, color: colors.ink },
  confirmBody: { ...typeTokens.bodyMd, color: colors.inkVariant, textAlign: "center" },
});

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CollectionBatchStatus, formatINR, paiseToRupees, rupeesToPaise } from "@indus/shared-types";
import { SelectField } from "../components/SelectField";
import { LabeledInput } from "../components/LabeledInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeInUp } from "../components/FadeInUp";
import { Icon } from "../components/Icon";
import { useField } from "../context/FieldContext";
import { useOfflineQueue } from "../offline/OfflineQueueContext";
import { listCustomers, type CustomerListRow } from "../api/customers";
import { getBatch, myBatch, submitFieldBatch } from "../api/collections";
import { colors, radius, shadow, spacing, type as typeTokens } from "../theme";
import type { CollectionStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<CollectionStackParamList, "AddCollection">;

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

export function AddCollectionScreen({ navigation, route }: Props) {
  const { fieldId, batchId } = route.params;
  const { myFields } = useField();
  const field = myFields.find((f) => f.id === fieldId);
  const { saveOrQueue } = useOfflineQueue();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => emptyRows(DEFAULT_ROW_COUNT));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"saved" | "queued" | "submitted" | null>(null);
  const hydratedBatchId = useRef<string | null>(null);
  const today = todayIso();
  const isHistory = !!batchId;

  const { data: customersPage } = useQuery({
    queryKey: ["field-customers", fieldId],
    queryFn: () => listCustomers({ fieldId, pageSize: 1000 }),
  });
  const customers = customersPage?.items ?? [];

  const { data: myBatchData } = useQuery({
    queryKey: ["my-batch", fieldId],
    queryFn: () => myBatch(today, fieldId),
    enabled: !isHistory,
  });
  // Recent Collections history opens a specific batch by id (any date, any status) rather than
  // "today's in-progress batch for this field" — this is also how a reopened-for-correction
  // batch gets edited: its status is DRAFT again, so it renders the same editable form below,
  // just keyed off the batch's own date instead of today.
  const { data: historyBatch, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => getBatch(batchId!),
    enabled: isHistory,
  });
  const existingBatch = isHistory ? historyBatch : myBatchData;
  const isLocked = !!existingBatch && existingBatch.status !== CollectionBatchStatus.Draft;
  // The date this screen actually saves/submits against — the batch's own date when correcting
  // history, otherwise today. Getting this wrong would silently create a brand-new today batch
  // instead of updating the reopened one.
  const effectiveDate = existingBatch?.date ?? today;

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

  const todaysTotalPaise = useMemo(
    () => rows.reduce((s, r) => s + (r.customerId && r.amountRupees ? rupeesToPaise(Number(r.amountRupees) || 0) : 0), 0),
    [rows],
  );
  const entryCount = rows.filter((r) => r.customerId && Number(r.amountRupees) > 0).length;

  function invalidateBatchQueries() {
    queryClient.invalidateQueries({ queryKey: ["my-batch", fieldId] });
    queryClient.invalidateQueries({ queryKey: ["my-batches-today"] });
    queryClient.invalidateQueries({ queryKey: ["recent-batches"] });
    if (batchId) queryClient.invalidateQueries({ queryKey: ["batch", batchId] });
  }

  async function onSave() {
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
      const outcome = await saveOrQueue({ date: effectiveDate, fieldId, entries });
      invalidateBatchQueries();
      setResult(outcome.queued ? "queued" : "saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const submitForToday = useMutation({
    mutationFn: () => submitFieldBatch(effectiveDate, fieldId),
    onSuccess: () => {
      invalidateBatchQueries();
      setResult("submitted");
    },
  });

  if (result) {
    const copy: Record<NonNullable<typeof result>, { title: string; body: string; icon: "cloud-offline-outline" | "checkmark-circle" | "shield-checkmark" }> = {
      queued: {
        title: "Saved — Will Sync Automatically",
        body: "No connection right now, so these entries are saved on this device. They'll sync as soon as you're back online — no need to re-enter them.",
        icon: "cloud-offline-outline",
      },
      saved: {
        title: "Entries Saved",
        body: "Saved as a draft. Keep entering for this field, or submit it for approval once you're done with this route.",
        icon: "checkmark-circle",
      },
      submitted: {
        title: "Submitted for Approval",
        body:
          isHistory && effectiveDate !== today
            ? `The corrected entries for Route ${field?.code ?? ""} on ${effectiveDate} are resubmitted. It won't repost to the ledger until an admin approves it.`
            : `Route ${field?.code ?? ""} is submitted and locked for today. It won't post to the ledger until an admin approves it.`,
        icon: "shield-checkmark",
      },
    };
    const c = copy[result];
    return (
      <View style={styles.center}>
        <View style={styles.confirmIcon}>
          <Icon name={c.icon} size={32} color={colors.action} />
        </View>
        <Text style={styles.confirmTitle}>{c.title}</Text>
        <Text style={styles.confirmBody}>{c.body}</Text>
        {result !== "submitted" ? <PrimaryButton title="Keep Entering" onPress={() => setResult(null)} variant="dark" /> : null}
        <PrimaryButton title="Back to Collection" onPress={() => navigation.navigate("CollectionHub")} variant="secondary" />
      </View>
    );
  }

  if (isHistory && isHistoryLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.confirmBody}>Loading…</Text>
      </View>
    );
  }

  if (isLocked && existingBatch) {
    const lockedNotice = isHistory
      ? existingBatch.reopenedAt
        ? `This batch was reopened by ${existingBatch.reopenedByName ?? "an admin"} for correction and has since been resubmitted.`
        : "Submitted and locked — view only."
      : "This route was already submitted for approval today and is locked. Any new entries go into tomorrow's batch.";
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Collection</Text>
          <Text style={styles.subtitle}>Route {field?.code ?? "—"}{isHistory ? ` · ${existingBatch.date}` : ""}</Text>
          <StatusBadge status={existingBatch.status} />
        </View>
        <ScrollView style={styles.rows} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
          <View style={styles.lockedNoticeCard}>
            <Icon name="lock-closed" size={16} color={colors.warningOnContainer} />
            <Text style={styles.lockedNotice}>{lockedNotice}</Text>
          </View>
          {existingBatch.entries.map((e) => {
            const customer = customers.find((c) => c.id === e.customerId);
            return (
              <View key={e.id} style={styles.lockedRow}>
                <Text style={styles.lockedRowName}>
                  {field?.code}-{e.serialNo} {customer?.name ?? ""}
                </Text>
                <Text style={styles.lockedRowAmount}>{formatINR(e.amountPaise)}</Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.sessionLabel}>{isHistory ? "Total" : "Total Submitted Today"}</Text>
            <Text style={styles.sessionTotal}>{formatINR(existingBatch.totalAmountPaise)}</Text>
          </View>
          <PrimaryButton title="Back to Collection" onPress={() => navigation.navigate("CollectionHub")} variant="secondary" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Collection</Text>
        <Text style={styles.subtitle}>Route {field?.code ?? "—"}{isHistory ? ` · ${effectiveDate}` : ""}</Text>
      </View>

      {isHistory ? (
        <View style={styles.lockedNoticeCard}>
          <Icon name="build" size={16} color={colors.warningOnContainer} />
          <Text style={styles.lockedNotice}>
            Reopened by {existingBatch?.reopenedByName ?? "an admin"} for correction. Fix the amount below, then resubmit.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={16} color={colors.dangerOnContainer} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.rows} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
        {rows.map((row, index) => {
          const customer = customers.find((c) => c.id === row.customerId);
          const filled = !!row.customerId && Number(row.amountRupees) > 0;
          return (
            <FadeInUp key={row.key} delay={Math.min(index, 6) * 30}>
              <View style={[styles.rowCard, filled && styles.rowCardFilled]}>
                <View style={styles.rowNumberBadge}>
                  <Text style={styles.rowNumber}>{String(index + 1).padStart(2, "0")}</Text>
                </View>
                <View style={styles.rowFields}>
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
                        keywords: `${c.phone} ${c.fieldCode}-${c.serialNo} ${c.serialNo}`,
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
              </View>
            </FadeInUp>
          );
        })}
        <AnimatedPressable style={styles.addRowButton} onPress={() => setRows((prev) => [...prev, emptyRow()])}>
          <Icon name="add-circle-outline" size={18} color={colors.action} />
          <Text style={styles.addRow}>Add Row</Text>
        </AnimatedPressable>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.sessionLabel}>{isHistory ? "Corrected Total" : "Today's Total"}</Text>
            <Text style={styles.sessionEntries}>{entryCount} entries</Text>
          </View>
          <Text style={styles.sessionTotal}>{formatINR(todaysTotalPaise)}</Text>
        </View>
        <PrimaryButton title={submitting ? "Saving…" : "Save Entries"} onPress={onSave} loading={submitting} variant="secondary" icon="save-outline" />
        <PrimaryButton
          title={submitForToday.isPending ? "Submitting…" : isHistory ? "Resubmit" : "Submit for Today"}
          onPress={() => submitForToday.mutate()}
          loading={submitForToday.isPending}
          variant="dark"
          icon="checkmark-done"
        />
        {submitForToday.isError ? <Text style={styles.error}>Failed to submit. Try again.</Text> : null}
        <PrimaryButton title="Cancel" onPress={() => navigation.goBack()} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  rows: { flex: 1, paddingHorizontal: spacing.lg },
  rowCard: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xl,
    padding: spacing.sm,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...shadow.sm,
  },
  rowCardFilled: { borderColor: colors.actionContainer },
  rowNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  rowFields: { flex: 1, flexDirection: "row", gap: spacing.sm },
  rowNumber: { ...typeTokens.bodySm, color: colors.inkVariant, fontWeight: "700" },
  customerHint: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: 2 },
  addRowButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  addRow: { ...typeTokens.bodyMd, color: colors.action, fontWeight: "600" },
  lockedNoticeCard: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.warningContainer,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  lockedNotice: { ...typeTokens.bodySm, color: colors.warningOnContainer, flex: 1 },
  lockedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lockedRowName: { ...typeTokens.bodyMd, color: colors.ink },
  lockedRowAmount: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.dangerContainer,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  error: {
    ...typeTokens.bodySm,
    color: colors.dangerOnContainer,
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
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.xxl,
    backgroundColor: colors.actionContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  confirmTitle: { ...typeTokens.headlineMd, color: colors.ink },
  confirmBody: { ...typeTokens.bodyMd, color: colors.inkVariant, textAlign: "center" },
});

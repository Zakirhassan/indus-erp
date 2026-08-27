import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  CustomerApprovalStatus,
  CustomerStatus,
  formatINR,
  LedgerEntryType,
  paiseToRupees,
  rupeesToPaise,
  type LedgerEntry,
} from "@indus/shared-types";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeInUp } from "../components/FadeInUp";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
import { LabeledInput } from "../components/LabeledInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { SelectField } from "../components/SelectField";
import { addSaleItem, getCustomer, getLedger } from "../api/customers";
import { listProducts } from "../api/products";
import { useOfflineQueue } from "../offline/OfflineQueueContext";
import { colors, gradients, radius, shadow, spacing, type as typeTokens } from "../theme";
import type { DashboardStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<DashboardStackParamList, "CustomerDetail">;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const LEDGER_LABEL: Record<string, string> = {
  [LedgerEntryType.Sale]: "Sale",
  [LedgerEntryType.Collection]: "Collection",
  [LedgerEntryType.Return]: "Return",
};

const LEDGER_ICON: Record<string, "cart-outline" | "cash-outline" | "return-up-back-outline"> = {
  [LedgerEntryType.Sale]: "cart-outline",
  [LedgerEntryType.Collection]: "cash-outline",
  [LedgerEntryType.Return]: "return-up-back-outline",
};

export function CustomerDetailScreen({ route, navigation }: Props) {
  const { customerId } = route.params;
  const { saveOrQueue } = useOfflineQueue();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => getCustomer(customerId),
  });
  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["customer-ledger", customerId],
    queryFn: () => getLedger(customerId),
  });
  const { data: productsPage } = useQuery({ queryKey: ["products-all"], queryFn: () => listProducts({ pageSize: 1000 }) });
  const products = productsPage?.items ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [amountRupees, setAmountRupees] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedOutcome, setSavedOutcome] = useState<{ queued: boolean } | null>(null);

  function closeDialog() {
    setDialogOpen(false);
    setAmountRupees("");
    setDialogError(null);
    setSavedOutcome(null);
  }

  async function onRecordCollection() {
    const amount = Number(amountRupees);
    if (!amount || amount <= 0) {
      setDialogError("Enter an amount");
      return;
    }
    if (!data) return;
    setDialogError(null);
    setSubmitting(true);
    try {
      const outcome = await saveOrQueue({
        date: todayIso(),
        fieldId: data.customer.fieldId,
        entries: [{ serialNo: data.customer.serialNo, amountPaise: rupeesToPaise(amount) }],
      });
      queryClient.invalidateQueries({ queryKey: ["my-batch", data.customer.fieldId] });
      queryClient.invalidateQueries({ queryKey: ["my-batches-today"] });
      queryClient.invalidateQueries({ queryKey: ["recent-batches"] });
      setSavedOutcome(outcome);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  const [productPriceRupees, setProductPriceRupees] = useState("");
  const [productError, setProductError] = useState<string | null>(null);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productSaved, setProductSaved] = useState(false);
  const selectedProduct = products.find((p) => p.id === productId);

  function closeProductDialog() {
    setProductDialogOpen(false);
    setProductId("");
    setProductQuantity("1");
    setProductPriceRupees("");
    setProductError(null);
    setProductSaved(false);
  }

  async function onAddProduct() {
    if (!productId) {
      setProductError("Choose a product");
      return;
    }
    const quantity = Math.max(1, Number(productQuantity) || 1);
    const adjustedPricePaise = productPriceRupees ? rupeesToPaise(Number(productPriceRupees)) : (selectedProduct?.pricePaise ?? 0);
    if (adjustedPricePaise <= 0) {
      setProductError("Enter a price");
      return;
    }
    setProductError(null);
    setProductSubmitting(true);
    try {
      await addSaleItem(customerId, { productId, adjustedPricePaise, quantity });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customer-ledger", customerId] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["today-add-on-sales"] });
      setProductSaved(true);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Failed to add product");
    } finally {
      setProductSubmitting(false);
    }
  }

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
        <AnimatedPressable style={styles.backRow} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={16} color={colors.action} />
          <Text style={styles.back}>Back</Text>
        </AnimatedPressable>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {customer.fieldCode}-{customer.serialNo} {customer.name}
            </Text>
            <Text style={styles.subtitle}>
              {customer.relation} {customer.relationName}
            </Text>
          </View>
          <StatusBadge
            status={customer.status}
            label={customer.status === CustomerStatus.Inactive ? (sale.balancePaise === 0 ? "Paid Off" : "Inactive") : undefined}
          />
        </View>
      </View>

      <FlatList
        data={ledger ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <LinearGradient colors={gradients.hero} style={[styles.balanceCard, shadow.md]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.balanceLabel}>Outstanding Balance</Text>
              <Text style={styles.balanceValue}>{formatINR(sale.balancePaise)}</Text>
              <View style={styles.planRow}>
                <PlanStat label="Installment" value={formatINR(plan.regularInstallmentPaise)} />
                <PlanStat label="Occurrence" value={plan.occurrence.charAt(0) + plan.occurrence.slice(1).toLowerCase()} />
                <PlanStat label="Final Amount" value={formatINR(sale.finalAmountPaise)} />
              </View>
            </LinearGradient>

            {customer.status === CustomerStatus.Active ? (
              <PrimaryButton
                title="Record Collection"
                onPress={() => setDialogOpen(true)}
                variant="primary"
                icon="cash-outline"
              />
            ) : null}

            <View style={[styles.infoCard, shadow.sm, { marginTop: spacing.lg }]}>
              <InfoRow icon="location-outline" label="Address" value={customer.address} />
              <InfoRow icon="call-outline" label="Phone" value={customer.phone} />
              <InfoRow icon="calendar-outline" label="Purchase Date" value={new Date(sale.saleDate).toLocaleDateString()} />
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Products Purchased</Text>
              {customer.approvalStatus === CustomerApprovalStatus.Approved ? (
                <AnimatedPressable style={styles.addProductLink} onPress={() => setProductDialogOpen(true)}>
                  <Icon name="add-circle-outline" size={16} color={colors.action} />
                  <Text style={styles.addProductLinkText}>Add Product</Text>
                </AnimatedPressable>
              ) : null}
            </View>
            <View style={[styles.infoCard, shadow.sm, { marginBottom: spacing.lg }]}>
              {sale.items.map((item, i) => (
                <View key={`${item.productId}-${i}`} style={styles.productRow}>
                  <View style={styles.productIcon}>
                    <Icon name="cube-outline" size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <Text style={styles.productMeta}>
                      {item.quantity} × {formatINR(item.adjustedPricePaise)}
                    </Text>
                  </View>
                  <Text style={styles.productSubtotal}>{formatINR(item.subtotalPaise)}</Text>
                </View>
              ))}
              <View style={styles.productTotalRow}>
                <Text style={styles.productTotalLabel}>Total</Text>
                <View style={styles.productTotalValues}>
                  {sale.discountPaise > 0 ? <Text style={styles.productTotalStrike}>{formatINR(sale.totalPaise)}</Text> : null}
                  <Text style={styles.productTotalValue}>{formatINR(sale.finalAmountPaise)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Ledger History</Text>
            {ledgerLoading ? <ActivityIndicator style={{ marginBottom: spacing.md }} color={colors.primary} /> : null}
          </>
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm }}
        renderItem={({ item, index }) => (
          <FadeInUp delay={Math.min(index, 8) * 30}>
            <LedgerRow entry={item} />
          </FadeInUp>
        )}
        ListEmptyComponent={!ledgerLoading ? <EmptyState icon="list-outline" title="No ledger entries yet" /> : null}
      />

      <Modal visible={dialogOpen} animationType="slide" transparent onRequestClose={closeDialog}>
        <Pressable style={styles.backdrop} onPress={closeDialog}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            {savedOutcome ? (
              <View style={styles.sheetContent}>
                <View style={styles.confirmIconSm}>
                  <Icon name={savedOutcome.queued ? "cloud-offline-outline" : "checkmark-circle"} size={26} color={colors.action} />
                </View>
                <Text style={styles.sheetTitle}>{savedOutcome.queued ? "Saved — Will Sync Automatically" : "Collection Saved"}</Text>
                <Text style={styles.sheetBody}>
                  Added to today's draft for Route {customer.fieldCode}. Submit it from the Collection tab once the route is done.
                </Text>
                <PrimaryButton title="Done" onPress={closeDialog} variant="dark" />
              </View>
            ) : (
              <View style={styles.sheetContent}>
                <Text style={styles.sheetTitle}>Record Collection</Text>
                <Text style={styles.sheetBody}>
                  {customer.fieldCode}-{customer.serialNo} {customer.name} · Balance {formatINR(sale.balancePaise)}
                </Text>
                {dialogError ? (
                  <View style={styles.errorBox}>
                    <Icon name="alert-circle" size={16} color={colors.dangerOnContainer} />
                    <Text style={styles.errorText}>{dialogError}</Text>
                  </View>
                ) : null}
                <LabeledInput
                  label="Amount"
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amountRupees}
                  onChangeText={setAmountRupees}
                  autoFocus
                />
                <PrimaryButton
                  title={submitting ? "Saving…" : "Save"}
                  onPress={onRecordCollection}
                  loading={submitting}
                  variant="dark"
                  icon="cash-outline"
                />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={productDialogOpen} animationType="slide" transparent onRequestClose={closeProductDialog}>
        <Pressable style={styles.backdrop} onPress={closeProductDialog}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            {productSaved ? (
              <View style={styles.sheetContent}>
                <View style={styles.confirmIconSm}>
                  <Icon name="checkmark-circle" size={26} color={colors.action} />
                </View>
                <Text style={styles.sheetTitle}>Product Added</Text>
                <Text style={styles.sheetBody}>
                  Added to {customer.fieldCode}-{customer.serialNo}'s sale — balance and installment plan are updated.
                </Text>
                <PrimaryButton title="Done" onPress={closeProductDialog} variant="dark" />
              </View>
            ) : (
              <View style={styles.sheetContent}>
                <Text style={styles.sheetTitle}>Add Product</Text>
                <Text style={styles.sheetBody}>
                  Adds to {customer.fieldCode}-{customer.serialNo}'s existing sale and grows the outstanding balance.
                </Text>
                {productError ? (
                  <View style={styles.errorBox}>
                    <Icon name="alert-circle" size={16} color={colors.dangerOnContainer} />
                    <Text style={styles.errorText}>{productError}</Text>
                  </View>
                ) : null}
                <SelectField
                  label="Product"
                  placeholder="Search product…"
                  searchable
                  value={productId}
                  onChange={(id) => {
                    const p = products.find((x) => x.id === id);
                    setProductId(id);
                    setProductPriceRupees(p ? String(paiseToRupees(p.pricePaise)) : "");
                  }}
                  options={products.map((p) => ({
                    value: p.id,
                    label: p.name,
                    subtitle: `${formatINR(p.pricePaise)} · ${p.quantity} in stock`,
                  }))}
                />
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <LabeledInput
                      label="Quantity"
                      placeholder="1"
                      keyboardType="number-pad"
                      value={productQuantity}
                      onChangeText={setProductQuantity}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabeledInput
                      label="Price (each)"
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={productPriceRupees}
                      onChangeText={setProductPriceRupees}
                    />
                  </View>
                </View>
                <PrimaryButton
                  title={productSubmitting ? "Saving…" : "Add Product"}
                  onPress={onAddProduct}
                  loading={productSubmitting}
                  variant="dark"
                  icon="add-circle-outline"
                />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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

function InfoRow({ icon, label, value }: { icon: "location-outline" | "call-outline" | "calendar-outline"; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Icon name={icon} size={15} color={colors.inkVariant} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.creditPaise > 0;
  return (
    <View style={[styles.ledgerRow, shadow.sm]}>
      <View style={styles.ledgerIcon}>
        <Icon name={LEDGER_ICON[entry.type] ?? "list-outline"} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ledgerType}>{LEDGER_LABEL[entry.type] ?? entry.type}</Text>
        <Text style={styles.ledgerMeta} numberOfLines={1}>
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
  backRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  back: { ...typeTokens.bodyMd, color: colors.action, fontWeight: "600" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  balanceCard: {
    borderRadius: radius.xxl,
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
    borderRadius: radius.xxl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  infoLabel: { ...typeTokens.bodySm, color: colors.inkVariant },
  infoValue: { ...typeTokens.bodySm, color: colors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productIcon: { width: 30, height: 30, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  productName: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  productMeta: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: 1 },
  productSubtotal: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
  productTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.sm },
  productTotalLabel: { ...typeTokens.bodyMd, color: colors.inkVariant, fontWeight: "600" },
  productTotalValues: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs },
  productTotalStrike: { ...typeTokens.bodySm, color: colors.inkVariant, textDecorationLine: "line-through" },
  productTotalValue: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "700" },
  sectionTitle: { ...typeTokens.labelBold, color: colors.inkVariant, marginBottom: spacing.sm },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addProductLink: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
  addProductLinkText: { ...typeTokens.bodySm, color: colors.action, fontWeight: "600" },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xxl,
    padding: spacing.md,
  },
  ledgerIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  ledgerType: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  ledgerMeta: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: 2 },
  ledgerAmount: { ...typeTokens.bodyMd, fontWeight: "700" },
  ledgerBalance: { ...typeTokens.bodySm, color: colors.inkVariant, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceLowest,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm },
  sheetContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  sheetTitle: { ...typeTokens.headlineMd, color: colors.ink },
  sheetBody: { ...typeTokens.bodyMd, color: colors.inkVariant },
  confirmIconSm: {
    width: 52,
    height: 52,
    borderRadius: radius.xxl,
    backgroundColor: colors.actionContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.dangerContainer,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errorText: { ...typeTokens.bodySm, color: colors.dangerOnContainer },
});

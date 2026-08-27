import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Occurrence, Relation, formatINR, planFromInstallmentAmount, rupeesToPaise } from "@indus/shared-types";
import { LabeledInput } from "../components/LabeledInput";
import { SelectField } from "../components/SelectField";
import { PrimaryButton } from "../components/PrimaryButton";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Icon } from "../components/Icon";
import { useField } from "../context/FieldContext";
import { listProducts } from "../api/products";
import { createCustomer } from "../api/customers";
import { colors, radius, shadow, spacing, type as typeTokens } from "../theme";
import type { SalesStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<SalesStackParamList, "NewSale">;

const RELATION_OPTIONS = [Relation.SonOf, Relation.DaughterOf, Relation.WifeOf, Relation.FatherOf, Relation.HusbandOf, Relation.CareOf];
const OCCURRENCE_OPTIONS = [Occurrence.Daily, Occurrence.Weekly, Occurrence.Monthly];

interface LineItem {
  key: string;
  productId: string;
  adjustedPriceRupees: string;
  quantity: string;
}

function emptyLine(): LineItem {
  return { key: Math.random().toString(36).slice(2), productId: "", adjustedPriceRupees: "", quantity: "1" };
}

export function NewSaleScreen({ navigation }: Props) {
  const { myFields, activeField, setActiveFieldId } = useField();
  const { data: productsPage } = useQuery({ queryKey: ["products-all"], queryFn: () => listProducts({ pageSize: 1000 }) });
  const products = productsPage?.items ?? [];

  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation>(Relation.SonOf);
  const [relationName, setRelationName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [discountRupees, setDiscountRupees] = useState("0");
  const [advanceRupees, setAdvanceRupees] = useState("0");
  const [occurrence, setOccurrence] = useState<Occurrence>(Occurrence.Weekly);
  const [financeAmountRupees, setFinanceAmountRupees] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const computed = useMemo(() => {
    const items = lines
      .filter((l) => l.productId)
      .map((l) => {
        const product = products.find((p) => p.id === l.productId);
        const adjustedPricePaise = l.adjustedPriceRupees ? rupeesToPaise(Number(l.adjustedPriceRupees)) : (product?.pricePaise ?? 0);
        const quantity = Math.max(1, Number(l.quantity) || 1);
        return { product, adjustedPricePaise, quantity, subtotalPaise: adjustedPricePaise * quantity };
      });
    const totalPaise = items.reduce((s, i) => s + i.subtotalPaise, 0);
    const discountPaise = rupeesToPaise(Number(discountRupees) || 0);
    const finalAmountPaise = Math.max(0, totalPaise - discountPaise);
    const advancePaise = Math.min(rupeesToPaise(Number(advanceRupees) || 0), finalAmountPaise);
    const balancePaise = finalAmountPaise - advancePaise;
    const financeAmountPaise = rupeesToPaise(Number(financeAmountRupees) || 0);
    const plan =
      balancePaise > 0 && financeAmountPaise > 0
        ? planFromInstallmentAmount(balancePaise, financeAmountPaise)
        : { durationCount: 0, regularInstallmentPaise: 0, finalInstallmentPaise: 0 };
    return { items, totalPaise, discountPaise, finalAmountPaise, advancePaise, balancePaise, financeAmountPaise, plan };
  }, [lines, products, discountRupees, advanceRupees, financeAmountRupees]);

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function onSubmit() {
    setError(null);
    if (!activeField) return setError("No active field selected");
    if (!name.trim()) return setError("Customer name is required");
    if (computed.items.length === 0) return setError("Add at least one product");
    if (computed.financeAmountPaise <= 0 && computed.balancePaise > 0) return setError("Enter an installment amount");

    setSubmitting(true);
    try {
      await createCustomer({
        fieldId: activeField.id,
        purchaseDate: new Date().toISOString().slice(0, 10),
        name: name.trim(),
        relation,
        relationName: relationName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        items: computed.items.map((i) => ({ productId: i.product!.id, adjustedPricePaise: i.adjustedPricePaise, quantity: i.quantity })),
        discountPaise: computed.discountPaise,
        advancePaise: computed.advancePaise,
        occurrence,
        financeAmountPaise: computed.financeAmountPaise,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit sale");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.center}>
        <View style={styles.confirmIcon}>
          <Icon name="checkmark-circle" size={32} color={colors.action} />
        </View>
        <Text style={styles.confirmTitle}>Submitted for Approval</Text>
        <Text style={styles.confirmBody}>
          This sale won't appear on the customer ledger or affect inventory until an admin approves it.
        </Text>
        <PrimaryButton title="Back to Sales" onPress={() => navigation.navigate("SalesHome")} variant="dark" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New Sale</Text>
      <Text style={styles.subtitle}>Which field is this customer in?</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={16} color={colors.dangerOnContainer} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <SelectField
        label="Field"
        placeholder="Select field"
        value={activeField?.id ?? ""}
        onChange={setActiveFieldId}
        options={myFields.map((f) => ({ value: f.id, label: `${f.code} — ${f.description}` }))}
      />

      <View style={styles.sectionHeader}>
        <Icon name="person-outline" size={16} color={colors.ink} />
        <Text style={styles.sectionTitle}>Customer Details</Text>
      </View>
      <LabeledInput label="Customer Name" placeholder="e.g. Jane Doe" value={name} onChangeText={setName} />
      <View style={styles.rowGap}>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Relationship"
            value={relation}
            onChange={(v) => setRelation(v as Relation)}
            options={RELATION_OPTIONS.map((r) => ({ value: r, label: r }))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <LabeledInput label="Relation Name" placeholder="Enter name" value={relationName} onChangeText={setRelationName} />
        </View>
      </View>
      <LabeledInput label="Phone Number" placeholder="+91 00000 00000" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <LabeledInput label="Delivery Address" placeholder="House, street, area" value={address} onChangeText={setAddress} />

      <View style={styles.sectionHeader}>
        <Icon name="cube-outline" size={16} color={colors.ink} />
        <Text style={styles.sectionTitle}>Product Details</Text>
      </View>
      {lines.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const adjustedPricePaise = line.adjustedPriceRupees ? rupeesToPaise(Number(line.adjustedPriceRupees)) : (product?.pricePaise ?? 0);
        const subtotal = adjustedPricePaise * Math.max(1, Number(line.quantity) || 1);
        return (
          <View key={line.key} style={[styles.productCard, shadow.sm]}>
            <SelectField
              placeholder="Select inventory item…"
              searchable
              value={line.productId}
              onChange={(productId) => updateLine(line.key, { productId, adjustedPriceRupees: "" })}
              options={products.map((p) => ({ value: p.id, label: p.name, subtitle: `${formatINR(p.pricePaise)} • ${p.quantity} in stock` }))}
            />
            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  label="Price (₹)"
                  keyboardType="decimal-pad"
                  placeholder={product ? String(product.pricePaise / 100) : "0.00"}
                  value={line.adjustedPriceRupees}
                  onChangeText={(v) => updateLine(line.key, { adjustedPriceRupees: v })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  label="Quantity"
                  keyboardType="number-pad"
                  value={line.quantity}
                  onChangeText={(v) => updateLine(line.key, { quantity: v })}
                />
              </View>
            </View>
            <View style={styles.productFooter}>
              <Text style={styles.subtotal}>Subtotal: {formatINR(subtotal)}</Text>
              {lines.length > 1 ? (
                <AnimatedPressable onPress={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}>
                  <Text style={styles.remove}>Remove</Text>
                </AnimatedPressable>
              ) : null}
            </View>
          </View>
        );
      })}
      <AnimatedPressable style={styles.addRowButton} onPress={() => setLines((prev) => [...prev, emptyLine()])}>
        <Icon name="add-circle-outline" size={18} color={colors.action} />
        <Text style={styles.addRow}>Add Another Item</Text>
      </AnimatedPressable>

      <View style={styles.sectionHeader}>
        <Icon name="calculator-outline" size={16} color={colors.ink} />
        <Text style={styles.sectionTitle}>Finance Details</Text>
      </View>
      <View style={[styles.summaryCard, shadow.sm]}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{formatINR(computed.totalPaise)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Final Amount</Text>
          <Text style={styles.summaryValue}>{formatINR(computed.finalAmountPaise)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text style={[styles.summaryValue, { color: colors.warningOnContainer }]}>{formatINR(computed.balancePaise)}</Text>
        </View>
      </View>
      <View style={styles.rowGap}>
        <View style={{ flex: 1 }}>
          <LabeledInput label="Discount (₹)" keyboardType="decimal-pad" value={discountRupees} onChangeText={setDiscountRupees} />
        </View>
        <View style={{ flex: 1 }}>
          <LabeledInput label="Advance Payment (₹)" keyboardType="decimal-pad" value={advanceRupees} onChangeText={setAdvanceRupees} />
        </View>
      </View>
      <View style={styles.rowGap}>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Terms"
            value={occurrence}
            onChange={(v) => setOccurrence(v as Occurrence)}
            options={OCCURRENCE_OPTIONS.map((o) => ({ value: o, label: o.charAt(0) + o.slice(1).toLowerCase() }))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <LabeledInput
            label="Installment (₹)"
            keyboardType="decimal-pad"
            value={financeAmountRupees}
            onChangeText={setFinanceAmountRupees}
          />
        </View>
      </View>
      <Text style={styles.subtotal}>
        {computed.plan.durationCount > 0
          ? `${computed.plan.durationCount} installments, last one ${formatINR(computed.plan.finalInstallmentPaise)}`
          : "Fully paid — no finance plan needed"}
      </Text>

      <PrimaryButton
        title={submitting ? "Submitting…" : "Create Sale & Add Customer"}
        onPress={onSubmit}
        loading={submitting}
        icon="checkmark-done"
      />
      <PrimaryButton title="Cancel" onPress={() => navigation.goBack()} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingTop: 56, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  sectionTitle: { ...typeTokens.titleSm, color: colors.ink },
  rowGap: { flexDirection: "row", gap: spacing.sm },
  productCard: { borderRadius: radius.xxl, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceLowest },
  productFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subtotal: { ...typeTokens.bodySm, color: colors.inkVariant },
  remove: { ...typeTokens.bodySm, color: colors.danger, fontWeight: "600" },
  addRowButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  addRow: { ...typeTokens.bodyMd, color: colors.action, fontWeight: "600" },
  summaryCard: { borderRadius: radius.xxl, padding: spacing.md, backgroundColor: colors.surfaceLowest, gap: spacing.xs },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { ...typeTokens.bodySm, color: colors.inkVariant },
  summaryValue: { ...typeTokens.bodyMd, color: colors.ink, fontWeight: "600" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.dangerContainer, borderRadius: radius.md, padding: spacing.sm },
  error: { ...typeTokens.bodySm, color: colors.dangerOnContainer },
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

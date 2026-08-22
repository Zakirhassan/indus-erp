import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Occurrence, Relation, formatINR, planFromInstallmentAmount, rupeesToPaise } from "@indus/shared-types";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Field, inputClass } from "../../components/form/Field";
import { createCustomer } from "../../api/customers";
import { listFields } from "../../api/fields";
import { listProducts } from "../../api/products";

interface LineItem {
  key: string;
  productId: string;
  adjustedPriceRupees: string;
  quantity: string;
}

const RELATION_OPTIONS: Relation[] = [Relation.SonOf, Relation.DaughterOf, Relation.WifeOf, Relation.FatherOf, Relation.HusbandOf, Relation.CareOf];
const OCCURRENCE_OPTIONS: Occurrence[] = [Occurrence.Daily, Occurrence.Weekly, Occurrence.Monthly];

function emptyLine(): LineItem {
  return { key: crypto.randomUUID(), productId: "", adjustedPriceRupees: "", quantity: "1" };
}

export function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: listFields, enabled: open });
  const { data: productsPage } = useQuery({
    queryKey: ["products", "all"],
    queryFn: () => listProducts({ pageSize: 1000 }),
    enabled: open,
  });
  const products = productsPage?.items ?? [];

  const [fieldId, setFieldId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation>(Relation.SonOf);
  const [relationName, setRelationName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [discountRupees, setDiscountRupees] = useState("0");
  const [advanceRupees, setAdvanceRupees] = useState("0");
  const [occurrence, setOccurrence] = useState<Occurrence>(Occurrence.Weekly);
  const [financeAmountRupees, setFinanceAmountRupees] = useState("100");
  const [error, setError] = useState<string | null>(null);

  const computed = useMemo(() => {
    const items = lines
      .filter((l) => l.productId)
      .map((l) => {
        const product = products.find((p) => p.id === l.productId);
        const adjustedPricePaise = l.adjustedPriceRupees
          ? rupeesToPaise(Number(l.adjustedPriceRupees))
          : (product?.pricePaise ?? 0);
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

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      resetAndClose();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Failed to save customer"),
  });

  function resetAndClose() {
    setFieldId("");
    setName("");
    setRelationName("");
    setAddress("");
    setPhone("");
    setAadhaarLast4("");
    setNotes("");
    setLines([emptyLine()]);
    setDiscountRupees("0");
    setAdvanceRupees("0");
    setFinanceAmountRupees("100");
    setError(null);
    onClose();
  }

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onSave() {
    setError(null);
    if (!fieldId) return setError("Select a field");
    if (!name.trim()) return setError("Customer name is required");
    if (computed.items.length === 0) return setError("Add at least one product");
    if (computed.financeAmountPaise <= 0 && computed.balancePaise > 0) return setError("Enter a finance amount");

    mutation.mutate({
      fieldId,
      purchaseDate,
      name: name.trim(),
      relation,
      relationName: relationName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      aadhaarLast4: aadhaarLast4.trim() || undefined,
      notes: notes.trim() || undefined,
      items: computed.items.map((i) => ({
        productId: i.product!.id,
        adjustedPricePaise: i.adjustedPricePaise,
        quantity: i.quantity,
      })),
      discountPaise: computed.discountPaise,
      advancePaise: computed.advancePaise,
      occurrence,
      financeAmountPaise: computed.financeAmountPaise,
    });
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Add Customer"
      width="xl"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {error && <div className="mb-4 rounded border border-danger bg-danger-container px-3 py-2 text-body-sm text-danger-on-container">{error}</div>}

      <section className="mb-6">
        <h3 className="mb-3 text-title-sm text-ink">Customer Information</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Field" required>
            <select className={inputClass} value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
              <option value="">Select field</option>
              {fields?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Purchase Date" required>
            <input type="date" className={inputClass} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Customer Name" required>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Relation">
            <select className={inputClass} value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
              {RELATION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Relation Name">
            <input className={inputClass} value={relationName} onChange={(e) => setRelationName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Aadhaar (last 4 digits)">
            <input className={inputClass} maxLength={4} value={aadhaarLast4} onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Additional Info">
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-title-sm text-ink">Products</h3>
        <div className="overflow-x-auto rounded border border-border bg-surface-lowest">
          <table className="w-full text-body-sm">
            <thead className="bg-table-header text-label-bold uppercase text-ink-variant">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Adjust Price</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const product = products.find((p) => p.id === line.productId);
                const adjustedPricePaise = line.adjustedPriceRupees
                  ? rupeesToPaise(Number(line.adjustedPriceRupees))
                  : (product?.pricePaise ?? 0);
                const subtotal = adjustedPricePaise * Math.max(1, Number(line.quantity) || 1);
                return (
                  <tr key={line.key} className="border-t border-border">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <select
                        className={inputClass}
                        value={line.productId}
                        onChange={(e) => updateLine(line.key, { productId: e.target.value, adjustedPriceRupees: "" })}
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.quantity} in stock)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{product ? formatINR(product.pricePaise) : "—"}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className={`${inputClass} text-right`}
                        placeholder={product ? (product.pricePaise / 100).toString() : "0"}
                        value={line.adjustedPriceRupees}
                        onChange={(e) => updateLine(line.key, { adjustedPriceRupees: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        className={`${inputClass} text-right`}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatINR(subtotal)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="mt-2 text-body-sm text-primary hover:underline"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          + Add product
        </button>
      </section>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h3 className="mb-3 text-title-sm text-ink">Financial Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Total">
              <div className={`${inputClass} flex items-center bg-surface-low`}>{formatINR(computed.totalPaise)}</div>
            </Field>
            <Field label="Discount (₹)">
              <input type="number" className={inputClass} value={discountRupees} onChange={(e) => setDiscountRupees(e.target.value)} />
            </Field>
            <Field label="Final Amount">
              <div className={`${inputClass} flex items-center bg-surface-low font-semibold`}>{formatINR(computed.finalAmountPaise)}</div>
            </Field>
            <Field label="Advance (₹)">
              <input type="number" className={inputClass} value={advanceRupees} onChange={(e) => setAdvanceRupees(e.target.value)} />
            </Field>
            <Field label="Balance">
              <div className={`${inputClass} flex items-center bg-surface-low font-semibold text-warning`}>{formatINR(computed.balancePaise)}</div>
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-title-sm text-ink">Finance Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Occurrence">
              <select className={inputClass} value={occurrence} onChange={(e) => setOccurrence(e.target.value as Occurrence)}>
                {OCCURRENCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.charAt(0) + o.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Finance Amount (₹ per occurrence)">
              <input type="number" className={inputClass} value={financeAmountRupees} onChange={(e) => setFinanceAmountRupees(e.target.value)} />
            </Field>
            <Field label="Duration (auto-calculated)">
              <div className={`${inputClass} flex items-center bg-surface-low`}>
                {computed.plan.durationCount > 0 ? `${computed.plan.durationCount} installments` : "—"}
              </div>
            </Field>
            <Field label="Final Installment">
              <div className={`${inputClass} flex items-center bg-surface-low`}>
                {computed.plan.durationCount > 0 ? formatINR(computed.plan.finalInstallmentPaise) : "—"}
              </div>
            </Field>
          </div>
        </section>
      </div>
    </Modal>
  );
}

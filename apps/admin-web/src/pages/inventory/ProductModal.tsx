import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rupeesToPaise, type Product } from "@indus/shared-types";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Field, inputClass } from "../../components/form/Field";
import { createProduct, updateProduct } from "../../api/products";

const PRODUCT_TYPES = ["Bed", "Almirah", "Table", "Sofa", "Household Item"];

export function ProductModal({ open, onClose, product }: { open: boolean; onClose: () => void; product?: Product | null }) {
  const queryClient = useQueryClient();
  const isEdit = !!product;
  const [name, setName] = useState("");
  const [type, setType] = useState(PRODUCT_TYPES[0]!);
  const [priceRupees, setPriceRupees] = useState("");
  const [costPriceRupees, setCostPriceRupees] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setType(product?.type ?? PRODUCT_TYPES[0]!);
      setPriceRupees(product ? String(product.pricePaise / 100) : "");
      setCostPriceRupees(product?.costPricePaise != null ? String(product.costPricePaise / 100) : "");
      setQuantity(product ? String(product.quantity) : "0");
      setError(null);
    }
  }, [open, product]);

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Failed to save"),
  });
  const updateMutation = useMutation({
    mutationFn: (patch: { name: string; type: string; pricePaise: number; costPricePaise?: number | null }) => updateProduct(product!.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Failed to save"),
  });

  function onSave() {
    setError(null);
    if (!name.trim()) return setError("Product name is required");
    const pricePaise = rupeesToPaise(Number(priceRupees) || 0);
    if (pricePaise <= 0) return setError("Enter a valid price");
    const costPricePaise = costPriceRupees.trim() ? rupeesToPaise(Number(costPriceRupees)) : null;
    if (isEdit) {
      updateMutation.mutate({ name: name.trim(), type, pricePaise, costPricePaise });
    } else {
      createMutation.mutate({
        name: name.trim(),
        type,
        pricePaise,
        costPricePaise: costPricePaise ?? undefined,
        quantity: Math.max(0, Number(quantity) || 0),
      });
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Product" : "Add Product"}
      width="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {error && <div className="mb-4 rounded border border-danger bg-danger-container px-3 py-2 text-body-sm text-danger-on-container">{error}</div>}
      <div className="flex flex-col gap-4">
        <Field label="Product Name" required>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type" required>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price (₹)" required>
          <input type="number" className={inputClass} value={priceRupees} onChange={(e) => setPriceRupees(e.target.value)} />
        </Field>
        <Field label="Cost Price (₹)" hint="What the shop pays to stock it — used for profit reports. Leave blank if unknown.">
          <input type="number" className={inputClass} value={costPriceRupees} onChange={(e) => setCostPriceRupees(e.target.value)} />
        </Field>
        {!isEdit && (
          <Field label="Opening Quantity">
            <input type="number" className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

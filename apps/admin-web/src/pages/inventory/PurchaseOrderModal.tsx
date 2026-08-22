import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@indus/shared-types";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Field, inputClass } from "../../components/form/Field";
import { purchaseIn } from "../../api/products";

export function PurchaseOrderModal({ open, onClose, product }: { open: boolean; onClose: () => void; product: Product | null }) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => purchaseIn(product!.id, Math.max(1, Number(quantity) || 0), note.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryTxns"] });
      setQuantity("1");
      setNote("");
      onClose();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Failed to record purchase"),
  });

  return (
    <Modal
      open={open && !!product}
      onClose={onClose}
      title={`Purchase Order — ${product?.name ?? ""}`}
      width="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Add Stock"}
          </Button>
        </>
      }
    >
      {error && <div className="mb-4 rounded border border-danger bg-danger-container px-3 py-2 text-body-sm text-danger-on-container">{error}</div>}
      <div className="flex flex-col gap-4">
        <div className="text-body-sm text-ink-variant">Current stock: {product?.quantity} units</div>
        <Field label="Quantity Received" required>
          <input type="number" min={1} className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Note">
          <input className={inputClass} placeholder="Supplier / invoice ref (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { formatINR } from "@indus/shared-types";
import { getProduct, listInventoryTxns } from "../api/products";

const TYPE_LABEL: Record<string, string> = {
  PURCHASE_IN: "Purchase (Stock In)",
  SALE_OUT: "Sale (Stock Out)",
  RETURN_IN: "Return (Stock In)",
  ADJUSTMENT: "Adjustment",
};

export function ProductHistoryPage() {
  const { productId } = useParams<{ productId: string }>();
  const { data: product } = useQuery({ queryKey: ["product", productId], queryFn: () => getProduct(productId!), enabled: !!productId });
  const { data: txns, isLoading } = useQuery({
    queryKey: ["inventoryTxns", productId],
    queryFn: () => listInventoryTxns(productId!),
    enabled: !!productId,
  });

  return (
    <div className="flex flex-col gap-4">
      <Link to="/inventory" className="text-body-sm text-primary hover:underline">
        ← Back to Inventory
      </Link>
      {product && (
        <div className="rounded-lg border border-border bg-surface-lowest p-container-p">
          <div className="text-title-sm text-ink">{product.name}</div>
          <div className="text-body-sm text-ink-variant">
            {product.type} · {formatINR(product.pricePaise)} · {product.quantity} in stock
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface-lowest">
        <table className="w-full text-table-data">
          <thead className="bg-table-header text-label-bold uppercase text-ink-variant">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Qty Change</th>
              <th className="px-4 py-3 text-right">Balance After</th>
              <th className="px-4 py-3 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-variant">
                  Loading…
                </td>
              </tr>
            ) : (
              txns?.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3">{t.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3">{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${t.quantityDelta >= 0 ? "text-action" : "text-danger"}`}>
                    {t.quantityDelta >= 0 ? "+" : ""}
                    {t.quantityDelta}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{t.balanceAfter}</td>
                  <td className="px-4 py-3 text-ink-variant">{t.note ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

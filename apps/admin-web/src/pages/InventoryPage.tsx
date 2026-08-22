import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatINR, type Product } from "@indus/shared-types";
import { DataTable, type Column } from "../components/DataTable";
import { Button } from "../components/Button";
import { inputClass } from "../components/form/Field";
import { listProducts } from "../api/products";
import { ProductModal } from "./inventory/ProductModal";
import { PurchaseOrderModal } from "./inventory/PurchaseOrderModal";

export function InventoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [productModal, setProductModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [purchaseModal, setPurchaseModal] = useState<Product | null>(null);

  const params = { search, page, pageSize };
  const { data, isLoading } = useQuery({ queryKey: ["products", params], queryFn: () => listProducts(params) });

  const columns: Column<Product>[] = [
    { key: "name", header: "Product Name", render: (p) => p.name },
    { key: "type", header: "Type", render: (p) => p.type },
    { key: "price", header: "Price", align: "right", render: (p) => formatINR(p.pricePaise) },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      render: (p) => <span className={p.quantity <= 3 ? "font-semibold text-danger" : ""}>{p.quantity}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-3 text-body-sm">
          <button className="text-primary hover:underline" onClick={() => navigate(`/inventory/${p.id}/history`)}>
            History
          </button>
          <button className="text-primary hover:underline" onClick={() => setProductModal({ open: true, product: p })}>
            Edit
          </button>
          <button className="text-action hover:underline" onClick={() => setPurchaseModal(p)}>
            Purchase Order
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <input
          className={`${inputClass} w-64`}
          placeholder="Search products…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Button onClick={() => setProductModal({ open: true, product: null })}>Add Product</Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(p) => p.id}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />

      <ProductModal open={productModal.open} product={productModal.product} onClose={() => setProductModal({ open: false, product: null })} />
      <PurchaseOrderModal open={!!purchaseModal} product={purchaseModal} onClose={() => setPurchaseModal(null)} />
    </div>
  );
}

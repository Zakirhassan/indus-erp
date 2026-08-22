import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR, type CollectionBatch } from "@indus/shared-types";
import { DataTable, type Column } from "../components/DataTable";
import { Button } from "../components/Button";
import { inputClass } from "../components/form/Field";
import { deleteCollectionBatch, listCollectionBatches } from "../api/collections";
import { listFields } from "../api/fields";
import { downloadCsv } from "../lib/csv";
import { AddCollectionModal } from "./collections/AddCollectionModal";
import { ViewBatchModal } from "./collections/ViewBatchModal";

function monthToDateRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

export function CollectionsPage() {
  const queryClient = useQueryClient();
  const mtd = monthToDateRange();
  const [fieldId, setFieldId] = useState("");
  const [dateFrom, setDateFrom] = useState(mtd.from);
  const [dateTo, setDateTo] = useState(mtd.to);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [viewBatchId, setViewBatchId] = useState<string | null>(null);
  const pageSize = 15;

  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: listFields });
  const params = { fieldId: fieldId || undefined, dateFrom, dateTo, page, pageSize };
  const { data, isLoading } = useQuery({ queryKey: ["collectionBatches", params], queryFn: () => listCollectionBatches(params) });

  const deleteMutation = useMutation({
    mutationFn: deleteCollectionBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collectionBatches"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  async function onExport() {
    const all = await listCollectionBatches({ ...params, page: 1, pageSize: 10000 });
    downloadCsv(
      "collections.csv",
      all.items.map((b) => ({
        Date: b.date,
        Field: b.fieldCode,
        "Total Amount": (b.totalAmountPaise / 100).toFixed(2),
        Entries: b.entries.length,
        "Collected By": b.collectorName ?? "Shop",
      })),
    );
  }

  const columns: Column<CollectionBatch>[] = [
    { key: "date", header: "Date", render: (b) => b.date },
    { key: "field", header: "Field", render: (b) => b.fieldCode },
    { key: "entries", header: "Entries", align: "right", render: (b) => b.entries.length },
    { key: "collector", header: "Collected By", render: (b) => b.collectorName ?? "Shop" },
    { key: "total", header: "Total Amount", align: "right", render: (b) => formatINR(b.totalAmountPaise) },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (b) => (
        <div className="flex justify-end gap-3 text-body-sm">
          <button className="text-primary hover:underline" onClick={() => setViewBatchId(b.id)}>
            View Collection
          </button>
          <button
            className="text-danger hover:underline"
            onClick={() => {
              if (confirm(`Delete this collection batch (${formatINR(b.totalAmountPaise)})? This reverses the ledger entries.`)) {
                deleteMutation.mutate(b.id);
              }
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <select
            className={`${inputClass} w-48`}
            value={fieldId}
            onChange={(e) => {
              setFieldId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Fields</option>
            {fields?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code}
              </option>
            ))}
          </select>
          <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-ink-variant">to</span>
          <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onExport}>
            Export
          </Button>
          <Button onClick={() => setAddOpen(true)}>Add Collection</Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(b) => b.id}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />

      <AddCollectionModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ViewBatchModal batchId={viewBatchId} onClose={() => setViewBatchId(null)} />
    </div>
  );
}

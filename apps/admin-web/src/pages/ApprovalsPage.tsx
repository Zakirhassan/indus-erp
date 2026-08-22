import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR, type CollectionBatch } from "@indus/shared-types";
import { StatCard } from "../components/StatCard";
import { DataTable, type Column } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { approveBatch, listCollectionBatches, listPendingBatches, rejectBatch, verifyBatch } from "../api/collections";
import {
  approveCustomerSale,
  listPendingCustomers,
  rejectCustomerSale,
  type CustomerWithSale,
} from "../api/customers";
import { ViewBatchModal } from "./collections/ViewBatchModal";

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [viewBatchId, setViewBatchId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const { data: pending, isLoading } = useQuery({ queryKey: ["pendingBatches"], queryFn: listPendingBatches });
  const { data: approvedToday } = useQuery({
    queryKey: ["collectionBatches", "approvedToday"],
    queryFn: () => listCollectionBatches({ dateFrom: today, dateTo: today, pageSize: 1000 }),
  });

  const { data: pendingSales, isLoading: isLoadingSales } = useQuery({
    queryKey: ["pendingCustomerSales"],
    queryFn: listPendingCustomers,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["pendingBatches"] });
    queryClient.invalidateQueries({ queryKey: ["collectionBatches"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  }

  function invalidateSales() {
    queryClient.invalidateQueries({ queryKey: ["pendingCustomerSales"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  const verifyMutation = useMutation({ mutationFn: verifyBatch, onSuccess: invalidate });
  const rejectMutation = useMutation({ mutationFn: rejectBatch, onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: approveBatch, onSuccess: invalidate });

  const approveSaleMutation = useMutation({ mutationFn: approveCustomerSale, onSuccess: invalidateSales });
  const rejectSaleMutation = useMutation({ mutationFn: rejectCustomerSale, onSuccess: invalidateSales });

  const totalPendingPaise = (pending ?? []).reduce((s, b) => s + b.totalAmountPaise, 0);

  const columns: Column<CollectionBatch>[] = [
    { key: "date", header: "Date", render: (b) => b.date },
    { key: "field", header: "Field", render: (b) => b.fieldCode },
    { key: "collector", header: "Collector Name", render: (b) => b.collectorName ?? "—" },
    { key: "entries", header: "Entries", align: "right", render: (b) => b.entries.length },
    { key: "total", header: "Total Amount", align: "right", render: (b) => formatINR(b.totalAmountPaise) },
    { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (b) => (
        <div className="flex justify-end gap-3 text-body-sm">
          <button className="text-primary hover:underline" onClick={() => setViewBatchId(b.id)}>
            View
          </button>
          {b.status === "PENDING" && (
            <button className="text-ink-variant hover:underline" onClick={() => verifyMutation.mutate(b.id)}>
              Verify
            </button>
          )}
          <button className="text-danger hover:underline" onClick={() => rejectMutation.mutate(b.id)}>
            Reject
          </button>
          <button className="text-action hover:underline" onClick={() => approveMutation.mutate(b.id)}>
            Approve
          </button>
        </div>
      ),
    },
  ];

  const saleColumns: Column<CustomerWithSale>[] = [
    { key: "field", header: "Field", render: (r) => r.customer.fieldCode },
    { key: "customer", header: "Customer", render: (r) => r.customer.name },
    { key: "submittedBy", header: "Submitted By", render: (r) => r.customer.submittedByName ?? "—" },
    { key: "items", header: "Items", align: "right", render: (r) => r.sale.items.length },
    { key: "total", header: "Final Amount", align: "right", render: (r) => formatINR(r.sale.finalAmountPaise) },
    { key: "advance", header: "Advance", align: "right", render: (r) => formatINR(r.sale.advancePaise) },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-3 text-body-sm">
          <button className="text-danger hover:underline" onClick={() => rejectSaleMutation.mutate(r.customer.id)}>
            Reject
          </button>
          <button className="text-action hover:underline" onClick={() => approveSaleMutation.mutate(r.customer.id)}>
            Approve
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Reports Awaiting Review" value={String(pending?.length ?? 0)} tone="warning" />
        <StatCard label="Total Pending Amount" value={formatINR(totalPendingPaise)} tone="warning" />
        <StatCard label="Approved Today" value={String(approvedToday?.total ?? 0)} tone="action" />
      </div>

      <DataTable
        columns={columns}
        rows={pending ?? []}
        rowKey={(b) => b.id}
        loading={isLoading}
        page={1}
        pageSize={1000}
        total={pending?.length ?? 0}
        onPageChange={() => {}}
        emptyMessage="No pending collection reports — everything is reviewed."
      />

      <h3 className="text-title-sm text-ink">New Customer Sales Awaiting Approval</h3>
      <DataTable
        columns={saleColumns}
        rows={pendingSales ?? []}
        rowKey={(r) => r.customer.id}
        loading={isLoadingSales}
        page={1}
        pageSize={1000}
        total={pendingSales?.length ?? 0}
        onPageChange={() => {}}
        emptyMessage="No pending sales — everything is reviewed."
      />

      <ViewBatchModal batchId={viewBatchId} onClose={() => setViewBatchId(null)} />
    </div>
  );
}

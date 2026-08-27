import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, RotateCcw, ShieldCheck, X } from "lucide-react";
import { formatINR, type CollectionBatch } from "@indus/shared-types";
import { StatCard } from "../components/StatCard";
import { DataTable, type Column } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { inputClass } from "../components/form/Field";
import { approveBatch, listCollectionBatches, listPendingBatches, rejectBatch, reopenBatch, verifyBatch } from "../api/collections";
import { listFields } from "../api/fields";
import {
  approveCustomerSale,
  listPendingCustomers,
  rejectCustomerSale,
  type CustomerWithSale,
} from "../api/customers";
import { ViewBatchModal } from "./collections/ViewBatchModal";

function monthToDateRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [viewBatchId, setViewBatchId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const mtd = monthToDateRange();
  const [approvedFieldId, setApprovedFieldId] = useState("");
  const [approvedDateFrom, setApprovedDateFrom] = useState(mtd.from);
  const [approvedDateTo, setApprovedDateTo] = useState(mtd.to);
  const [approvedPage, setApprovedPage] = useState(1);
  const approvedPageSize = 10;

  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: listFields });

  const { data: pending, isLoading } = useQuery({ queryKey: ["pendingBatches"], queryFn: listPendingBatches });
  const { data: approvedToday } = useQuery({
    queryKey: ["collectionBatches", "approvedToday"],
    queryFn: () => listCollectionBatches({ dateFrom: today, dateTo: today, pageSize: 1000 }),
  });

  const approvedParams = {
    fieldId: approvedFieldId || undefined,
    dateFrom: approvedDateFrom,
    dateTo: approvedDateTo,
    page: approvedPage,
    pageSize: approvedPageSize,
  };
  const { data: approvedBatches, isLoading: isLoadingApproved } = useQuery({
    queryKey: ["collectionBatches", "approved", approvedParams],
    queryFn: () => listCollectionBatches(approvedParams),
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
  const reopenMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => reopenBatch(id, reason),
    onSuccess: invalidate,
  });

  const approveSaleMutation = useMutation({ mutationFn: approveCustomerSale, onSuccess: invalidateSales });
  const rejectSaleMutation = useMutation({ mutationFn: rejectCustomerSale, onSuccess: invalidateSales });

  function onReopen(b: CollectionBatch) {
    if (!confirm(`Reopen batch ${b.fieldCode} · ${b.date} for edit? This unlocks it for the collector to correct an entry.`)) return;
    const reason = prompt("Reason for reopening (optional) — e.g. Amount entered incorrectly:") ?? undefined;
    reopenMutation.mutate({ id: b.id, reason: reason?.trim() || undefined });
  }

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
          <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => setViewBatchId(b.id)}>
            <Eye size={14} /> View
          </button>
          {b.status === "PENDING" && (
            <button className="inline-flex items-center gap-1 text-ink-variant hover:underline" onClick={() => verifyMutation.mutate(b.id)}>
              <ShieldCheck size={14} /> Verify
            </button>
          )}
          <button className="inline-flex items-center gap-1 text-danger hover:underline" onClick={() => rejectMutation.mutate(b.id)}>
            <X size={14} /> Reject
          </button>
          <button className="inline-flex items-center gap-1 text-action hover:underline" onClick={() => approveMutation.mutate(b.id)}>
            <Check size={14} /> Approve
          </button>
          <button className="inline-flex items-center gap-1 text-ink-variant hover:underline" onClick={() => onReopen(b)}>
            <RotateCcw size={14} /> Reopen for Edit
          </button>
        </div>
      ),
    },
  ];

  const approvedColumns: Column<CollectionBatch>[] = [
    { key: "date", header: "Date", render: (b) => b.date },
    { key: "field", header: "Field", render: (b) => b.fieldCode },
    { key: "collector", header: "Collector Name", render: (b) => b.collectorName ?? "—" },
    { key: "entries", header: "Entries", align: "right", render: (b) => b.entries.length },
    { key: "total", header: "Total Amount", align: "right", render: (b) => formatINR(b.totalAmountPaise) },
    {
      key: "reopened",
      header: "Reopened",
      render: (b) => (b.reopenedAt ? <span className="text-body-sm text-warning">by {b.reopenedByName ?? "—"}</span> : "—"),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (b) => (
        <div className="flex justify-end gap-3 text-body-sm">
          <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => setViewBatchId(b.id)}>
            <Eye size={14} /> View
          </button>
          <button className="inline-flex items-center gap-1 text-ink-variant hover:underline" onClick={() => onReopen(b)}>
            <RotateCcw size={14} /> Reopen for Edit
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
          <button className="inline-flex items-center gap-1 text-danger hover:underline" onClick={() => rejectSaleMutation.mutate(r.customer.id)}>
            <X size={14} /> Reject
          </button>
          <button className="inline-flex items-center gap-1 text-action hover:underline" onClick={() => approveSaleMutation.mutate(r.customer.id)}>
            <Check size={14} /> Approve
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

      <h3 className="text-title-sm text-ink">Approved Collections</h3>
      <p className="-mt-2 text-body-sm text-ink-variant">
        Already posted to the ledger. Reopen for Edit reverses the posting and unlocks the batch so the collector can
        correct an entry — only an admin can do this.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <select
          className={`${inputClass} w-48`}
          value={approvedFieldId}
          onChange={(e) => {
            setApprovedFieldId(e.target.value);
            setApprovedPage(1);
          }}
        >
          <option value="">All Fields</option>
          {fields?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code}
            </option>
          ))}
        </select>
        <input
          type="date"
          className={inputClass}
          value={approvedDateFrom}
          onChange={(e) => {
            setApprovedDateFrom(e.target.value);
            setApprovedPage(1);
          }}
        />
        <span className="text-ink-variant">to</span>
        <input
          type="date"
          className={inputClass}
          value={approvedDateTo}
          onChange={(e) => {
            setApprovedDateTo(e.target.value);
            setApprovedPage(1);
          }}
        />
      </div>
      <DataTable
        columns={approvedColumns}
        rows={approvedBatches?.items ?? []}
        rowKey={(b) => b.id}
        loading={isLoadingApproved}
        page={approvedPage}
        pageSize={approvedPageSize}
        total={approvedBatches?.total ?? 0}
        onPageChange={setApprovedPage}
        emptyMessage="No approved collections in this range."
      />

      <ViewBatchModal batchId={viewBatchId} onClose={() => setViewBatchId(null)} />
    </div>
  );
}

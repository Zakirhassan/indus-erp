import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { DataTable, type Column } from "../components/DataTable";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { inputClass } from "../components/form/Field";
import { listCustomers, markCustomerInactive, markCustomerReturn, type CustomerListRow, type ListCustomersParams } from "../api/customers";
import { listFields } from "../api/fields";
import { downloadCsv } from "../lib/csv";
import { AddCustomerModal } from "./customers/AddCustomerModal";
import { ViewLedgerModal } from "./customers/ViewLedgerModal";

function monthToDateRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const mtd = monthToDateRange();
  const [search, setSearch] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [dateFrom, setDateFrom] = useState(mtd.from);
  const [dateTo, setDateTo] = useState(mtd.to);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string | null>(null);
  const pageSize = 15;

  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: listFields });

  const params: ListCustomersParams = { search, fieldId: fieldId || undefined, dateFrom, dateTo, page, pageSize };
  const { data, isLoading } = useQuery({ queryKey: ["customers", params], queryFn: () => listCustomers(params) });

  const inactivateMutation = useMutation({
    mutationFn: markCustomerInactive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
  const returnMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => markCustomerReturn(id, undefined, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  async function onExport() {
    const all = await listCustomers({ ...params, page: 1, pageSize: 10000 });
    downloadCsv(
      "customers.csv",
      all.items.map((c) => ({
        Field: c.fieldCode,
        Sno: c.serialNo,
        Name: c.name,
        Relation: `${c.relation} ${c.relationName}`,
        Address: c.address,
        Phone: c.phone,
        Status: c.status,
      })),
    );
  }

  const columns: Column<CustomerListRow>[] = [
    { key: "field", header: "Field", render: (c) => c.fieldCode },
    { key: "sno", header: "Sno", render: (c) => c.serialNo },
    { key: "date", header: "Purchase Date", render: (c) => c.purchaseDate },
    {
      key: "amountOccurrence",
      header: "Amount / Occurrence",
      align: "right",
      render: (c) => `${formatINR(c.financeAmountPaise)} / ${c.occurrence.toLowerCase()}`,
    },
    { key: "name", header: "Customer Name", render: (c) => c.name },
    { key: "relation", header: "Relation", render: (c) => c.relation },
    { key: "relationName", header: "Relation Name", render: (c) => c.relationName },
    { key: "address", header: "Address", render: (c) => <span className="line-clamp-1 max-w-[180px]">{c.address}</span> },
    { key: "products", header: "Products", render: (c) => <span className="line-clamp-1 max-w-[200px]">{c.productsSummary}</span> },
    { key: "finalAmount", header: "Final Amount", align: "right", render: (c) => formatINR(c.finalAmountPaise) },
    { key: "advance", header: "Advance", align: "right", render: (c) => formatINR(c.advancePaise) },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (c) => <span className={c.balancePaise > 0 ? "text-warning font-semibold" : ""}>{formatINR(c.balancePaise)}</span>,
    },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (c) => (
        <div className="flex justify-end gap-3 text-body-sm">
          <button className="text-primary hover:underline" onClick={() => setLedgerCustomerId(c.id)}>
            View Collection
          </button>
          {c.status === "ACTIVE" && (
            <>
              <button
                className="text-ink-variant hover:underline"
                onClick={() => {
                  if (confirm(`Mark ${c.name} inactive?`)) inactivateMutation.mutate(c.id);
                }}
              >
                Mark Inactive
              </button>
              <button
                className="text-danger hover:underline"
                onClick={() => {
                  if (!confirm(`Process a return for ${c.name}? This restores inventory and refunds the advance.`)) return;
                  const reason = prompt("Reason for return (optional) — e.g. Product Defect, Customer Relocated, Dissatisfied:") ?? undefined;
                  returnMutation.mutate({ id: c.id, reason: reason?.trim() || undefined });
                }}
              >
                Mark Return
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <input
            className={`${inputClass} w-64`}
            placeholder="Search name, serial, phone, relation…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
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
          <Button onClick={() => setAddOpen(true)}>Add Customer</Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(c) => c.id}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ViewLedgerModal customerId={ledgerCustomerId} onClose={() => setLedgerCustomerId(null)} />
    </div>
  );
}

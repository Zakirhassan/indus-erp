import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../../components/StatCard";
import { DataTable, type Column } from "../../components/DataTable";
import { inputClass } from "../../components/form/Field";
import {
  getCollectDueReport,
  getCollectionsReport,
  getOutstandingReport,
  listReportCollectors,
  type CollectDueRow
} from "../../api/reports";
import { downloadCsv } from "../../lib/csv";
import { BarList, FilterBar, SectionCard, type ReportFilters } from "./shared";

export function CollectionsTab({
  filters,
  onFiltersChange,
  fields,
  highlightDue
}: {
  filters: ReportFilters;
  onFiltersChange: (f: ReportFilters) => void;
  fields: { id: string; code: string }[];
  highlightDue?: boolean;
}) {
  const [collectorId, setCollectorId] = useState("");
  const { data: collectors } = useQuery({
    queryKey: ["reports", "collectors"],
    queryFn: listReportCollectors
  });
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "collections", filters, collectorId],
    queryFn: () =>
      getCollectionsReport({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        fieldId: filters.fieldId || undefined,
        collectorId: collectorId || undefined
      })
  });
  const { data: outstanding } = useQuery({
    queryKey: ["reports", "outstanding", filters.fieldId],
    queryFn: () => getOutstandingReport({ fieldId: filters.fieldId || undefined })
  });
  const { data: due, isLoading: dueLoading } = useQuery({
    queryKey: ["reports", "collect-due", filters.fieldId],
    queryFn: () => getCollectDueReport({ fieldId: filters.fieldId || undefined })
  });

  function onExport() {
    if (!outstanding) return;
    downloadCsv(
      "outstanding-customers.csv",
      outstanding.customers.map((c) => ({
        Field: c.fieldCode,
        Sno: c.serialNo,
        Name: c.name,
        Phone: c.phone,
        Balance: (c.balancePaise / 100).toFixed(2),
        "Days Overdue": c.daysOverdue,
        Bucket: c.bucket
      }))
    );
  }

  const dueColumns: Column<CollectDueRow>[] = [
    { key: "field", header: "Field", render: (c) => `${c.fieldCode}-${c.serialNo}` },
    { key: "name", header: "Name", render: (c) => c.name },
    { key: "phone", header: "Phone", render: (c) => c.phone },
    {
      key: "address",
      header: "Address",
      render: (c) => <span className="line-clamp-1 max-w-[220px]">{c.address}</span>
    },
    {
      key: "amount",
      header: "Amount Due",
      align: "right",
      render: (c) => formatINR(c.amountDuePaise)
    },
    {
      key: "status",
      header: "Status",
      render: (c) =>
        c.status === "overdue" ? (
          <span className="text-danger">{c.daysOverdue}d overdue</span>
        ) : (
          <span className="text-warning">Due today</span>
        )
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <FilterBar filters={filters} onChange={onFiltersChange} fields={fields} onExport={onExport} />

      <div className="flex flex-col gap-1">
        <label className="text-label-bold uppercase text-ink-variant">Collector</label>
        <select
          className={`${inputClass} w-56`}
          value={collectorId}
          onChange={(e) => setCollectorId(e.target.value)}
        >
          <option value="">All Collectors</option>
          {collectors?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <div className="text-body-sm text-ink-variant">Loading collections report…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Collected" value={formatINR(data.totals.collectedPaise)} tone="action" />
          <StatCard label="Customers Collected From" value={String(data.totals.customerCount)} />
          <StatCard label="Avg per Customer" value={formatINR(data.totals.avgPerCustomerPaise)} />
          <StatCard label="Batches" value={String(data.totals.batchCount)} />
          <StatCard
            label="Missed Collections"
            value={String(data.totals.missedCount)}
            tone="danger"
          />
          <StatCard
            label="Partial Collections"
            value={String(data.totals.partialCount)}
            tone="warning"
          />
          <StatCard
            label="Total Outstanding"
            value={formatINR(outstanding?.totals.totalOutstandingPaise ?? 0)}
            tone="warning"
          />
          <StatCard
            label="Overdue Accounts"
            value={String(due?.overdue.length ?? 0)}
            tone="danger"
          />
        </div>
      )}

      {outstanding && (
        <SectionCard title="Outstanding Aging">
          <div className="grid grid-cols-5 gap-3">
            {outstanding.aging.map((b) => (
              <div key={b.bucket} className="rounded border border-border p-3 text-center">
                <div className="text-label-bold uppercase text-ink-variant">{b.bucket}</div>
                <div className="mt-1 text-title-sm tabular-nums text-ink">
                  {formatINR(b.amountPaise)}
                </div>
                <div className="text-body-sm text-ink-variant">{b.count} accounts</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Collections by Field">
            <BarList
              rows={data.byField.map((f) => ({ label: f.fieldCode, value: f.collectedPaise }))}
            />
          </SectionCard>
          <SectionCard title="Collections by Collector">
            <BarList
              rows={data.byCollector.map((c) => ({
                label: c.collectorName,
                value: c.collectedPaise
              }))}
            />
          </SectionCard>
        </div>
      )}

      <SectionCard
        title="Who To Collect Today"
        action={
          highlightDue ? (
            <span className="text-body-sm text-action">Quick action applied</span>
          ) : undefined
        }
      >
        {dueLoading || !due ? (
          <div className="text-body-sm text-ink-variant">Loading…</div>
        ) : (
          <DataTable
            columns={dueColumns}
            rows={[...due.overdue, ...due.dueToday]}
            rowKey={(c) => c.customerId}
            page={1}
            pageSize={Math.max(1, due.overdue.length + due.dueToday.length)}
            total={due.overdue.length + due.dueToday.length}
            onPageChange={() => {}}
            emptyMessage="Nobody is due or overdue today."
            maxHeightClassName="max-h-[420px]"
          />
        )}
      </SectionCard>
    </div>
  );
}

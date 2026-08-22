import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../../components/StatCard";
import { DataTable, type Column } from "../../components/DataTable";
import { getCustomersReport, type AttentionCustomer } from "../../api/reports";
import { downloadCsv } from "../../lib/csv";
import { BarList, FilterBar, SectionCard, type ReportFilters } from "./shared";

function attentionColumns(kind: "overdue" | "quiet"): Column<AttentionCustomer>[] {
  return [
    { key: "field", header: "Customer", render: (c) => `${c.fieldCode}-${c.serialNo} · ${c.name}` },
    { key: "phone", header: "Phone", render: (c) => c.phone },
    { key: "balance", header: "Balance", align: "right", render: (c) => formatINR(c.balancePaise) },
    kind === "overdue"
      ? {
          key: "overdue",
          header: "Days Overdue",
          align: "right",
          render: (c) => <span className="text-danger">{c.daysOverdue}d</span>
        }
      : {
          key: "quiet",
          header: "Since Last Payment",
          align: "right",
          render: (c) => <span className="text-warning">{c.daysSinceLastCollection ?? "—"}d</span>
        }
  ];
}

export function CustomersTab({
  filters,
  onFiltersChange,
  fields
}: {
  filters: ReportFilters;
  onFiltersChange: (f: ReportFilters) => void;
  fields: { id: string; code: string }[];
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "customers", filters],
    queryFn: () =>
      getCustomersReport({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        fieldId: filters.fieldId || undefined
      })
  });

  function onExport() {
    if (!data) return;
    downloadCsv(
      "customers-needing-attention.csv",
      data.attentionList.map((c) => ({
        Field: c.fieldCode,
        Sno: c.serialNo,
        Name: c.name,
        Phone: c.phone,
        Balance: (c.balancePaise / 100).toFixed(2),
        "Days Overdue": c.daysOverdue
      }))
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar filters={filters} onChange={onFiltersChange} fields={fields} onExport={onExport} />

      {isLoading || !data ? (
        <div className="text-body-sm text-ink-variant">Loading customers report…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            <StatCard label="Total" value={String(data.counts.total)} />
            <StatCard label="Active" value={String(data.counts.active)} tone="action" />
            <StatCard label="Completed" value={String(data.counts.completed)} />
            <StatCard label="Returned" value={String(data.counts.returned)} tone="danger" />
            <StatCard label="New (range)" value={String(data.counts.newInRange)} />
            <StatCard
              label="Needs Attention"
              value={String(data.attentionList.length)}
              tone="warning"
            />
          </div>

          <SectionCard title="Customer Acquisition — Last 6 Months">
            <BarList
              rows={data.acquisitionTrend.map((m) => ({ label: m.month, value: m.count }))}
              valueFormat={(v) => `${v} new`}
            />
          </SectionCard>

          <SectionCard title="Customers Needing Attention — currently overdue, sorted by days overdue">
            <DataTable
              columns={attentionColumns("overdue")}
              rows={data.attentionList}
              rowKey={(c) => c.customerId}
              page={1}
              pageSize={Math.max(1, data.attentionList.length)}
              total={data.attentionList.length}
              onPageChange={() => {}}
              emptyMessage="No overdue accounts — everyone is current."
              maxHeightClassName="max-h-[360px]"
            />
          </SectionCard>

          <SectionCard title="Non-Performing Customers — no collection in 60+ days, still active">
            <DataTable
              columns={attentionColumns("quiet")}
              rows={data.nonPerformingList}
              rowKey={(c) => c.customerId}
              page={1}
              pageSize={Math.max(1, data.nonPerformingList.length)}
              total={data.nonPerformingList.length}
              onPageChange={() => {}}
              emptyMessage="Nobody has gone quiet for 60+ days."
              maxHeightClassName="max-h-[360px]"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

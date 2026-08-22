import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { DataTable, type Column } from "../../components/DataTable";
import {
  getOutstandingReport,
  getStatementsReport,
  type StatementsReport
} from "../../api/reports";
import { downloadCsv } from "../../lib/csv";
import { FilterBar, SectionCard, type ReportFilters } from "./shared";

type FieldRow = StatementsReport["byField"][number] & { overdueCount: number };

export function FieldPerformanceTab({
  filters,
  onFiltersChange
}: {
  filters: ReportFilters;
  onFiltersChange: (f: ReportFilters) => void;
  fields: { id: string; code: string }[];
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "statements-by-field", filters.dateFrom, filters.dateTo],
    queryFn: () => getStatementsReport({ dateFrom: filters.dateFrom, dateTo: filters.dateTo })
  });
  const { data: outstanding } = useQuery({
    queryKey: ["reports", "outstanding-all"],
    queryFn: () => getOutstandingReport({})
  });

  const rows: FieldRow[] =
    data?.byField.map((f) => ({
      ...f,
      overdueCount: outstanding?.byField.find((o) => o.fieldCode === f.fieldCode)?.overdueCount ?? 0
    })) ?? [];

  function onExport() {
    downloadCsv(
      "field-performance.csv",
      rows.map((f) => ({
        Field: f.fieldCode,
        "Revenue (₹)": (f.revenuePaise / 100).toFixed(2),
        "Collected (₹)": (f.collectionsPaise / 100).toFixed(2),
        "Outstanding (₹)": (f.outstandingPaise / 100).toFixed(2),
        "Profit (₹)": f.profitPaise === null ? "" : (f.profitPaise / 100).toFixed(2),
        "Overdue Accounts": f.overdueCount
      }))
    );
  }

  const columns: Column<FieldRow>[] = [
    { key: "field", header: "Field", render: (f) => f.fieldCode },
    { key: "revenue", header: "Revenue", align: "right", render: (f) => formatINR(f.revenuePaise) },
    {
      key: "collected",
      header: "Collected (range)",
      align: "right",
      render: (f) => formatINR(f.collectionsPaise)
    },
    {
      key: "outstanding",
      header: "Outstanding (all-time)",
      align: "right",
      render: (f) => <span className="text-warning">{formatINR(f.outstandingPaise)}</span>
    },
    {
      key: "overdue",
      header: "Overdue Accounts",
      align: "right",
      render: (f) =>
        f.overdueCount > 0 ? <span className="text-danger">{f.overdueCount}</span> : "0"
    },
    {
      key: "profit",
      header: "Gross Profit",
      align: "right",
      render: (f) => (f.profitPaise === null ? "—" : formatINR(f.profitPaise))
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        filters={{ ...filters, fieldId: "" }}
        onChange={(f) => onFiltersChange({ ...f, fieldId: filters.fieldId })}
        onExport={onExport}
      />

      <SectionCard title="Balance Sheet per Field">
        {isLoading || !data ? (
          <div className="text-body-sm text-ink-variant">Loading field performance…</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(f) => f.fieldCode}
            page={1}
            pageSize={Math.max(1, rows.length)}
            total={rows.length}
            onPageChange={() => {}}
            maxHeightClassName="max-h-[500px]"
          />
        )}
      </SectionCard>

      {data && <div className="text-body-sm text-ink-variant">{data.costTrackingNote}</div>}

      <div className="text-body-sm text-ink-variant">
        Field dropdown is hidden here — this view always compares every field side by side. Use the
        Field filter on other tabs to drill into one.
      </div>
    </div>
  );
}

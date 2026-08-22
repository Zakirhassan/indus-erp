import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../../components/StatCard";
import { getReturnsReport } from "../../api/reports";
import { downloadCsv } from "../../lib/csv";
import { BarList, FilterBar, SectionCard, type ReportFilters } from "./shared";

export function ReturnsTab({
  filters,
  onFiltersChange,
  fields
}: {
  filters: ReportFilters;
  onFiltersChange: (f: ReportFilters) => void;
  fields: { id: string; code: string }[];
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "returns", filters],
    queryFn: () =>
      getReturnsReport({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        fieldId: filters.fieldId || undefined
      })
  });

  function onExport() {
    if (!data) return;
    downloadCsv(
      "returns-report.csv",
      data.byReason.map((r) => ({ Reason: r.reason, Count: r.count }))
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar filters={filters} onChange={onFiltersChange} fields={fields} onExport={onExport} />

      {isLoading || !data ? (
        <div className="text-body-sm text-ink-variant">Loading returns report…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Returns (range)"
              value={String(data.totals.count)}
              tone={data.totals.count > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Advance Refunded"
              value={formatINR(data.totals.advanceRefundedPaise)}
              tone="warning"
            />
            <StatCard label="Return Rate" value={`${data.totals.returnRatePct}%`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Returns by Field">
              <BarList
                rows={data.byField.map((f) => ({ label: f.fieldCode, value: f.count }))}
                valueFormat={(v) => `${v}`}
              />
            </SectionCard>
            <SectionCard title="Returns by Reason">
              <BarList
                rows={data.byReason.map((r) => ({ label: r.reason, value: r.count }))}
                valueFormat={(v) => `${v}`}
              />
            </SectionCard>
          </div>

          <SectionCard title="Returned Products">
            <div className="flex flex-col gap-1 text-body-sm">
              {data.byProduct.map((p) => (
                <div
                  key={p.productId}
                  className="flex justify-between border-b border-border py-1.5 last:border-0"
                >
                  <span>{p.name}</span>
                  <span className="tabular-nums text-ink-variant">{p.count} returned</span>
                </div>
              ))}
              {data.byProduct.length === 0 && (
                <span className="text-ink-variant">No product returns in this range.</span>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Returns by Day">
            <BarList
              rows={data.byDay.map((d) => ({ label: d.date, value: d.count }))}
              valueFormat={(v) => `${v}`}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../../components/StatCard";
import { getStatementsReport } from "../../api/reports";
import { downloadCsv } from "../../lib/csv";
import { FilterBar, SectionCard, formatPct, growthClass, type ReportFilters } from "./shared";

export function StatementsTab({
  filters,
  onFiltersChange,
  fields,
  compare,
  onCompareChange
}: {
  filters: ReportFilters;
  onFiltersChange: (f: ReportFilters) => void;
  fields: { id: string; code: string }[];
  compare: boolean;
  onCompareChange: (v: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "statements", filters, compare],
    queryFn: () =>
      getStatementsReport({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        fieldId: filters.fieldId || undefined,
        compare
      })
  });

  function onExport() {
    if (!data) return;
    downloadCsv(
      "profit-and-loss.csv",
      data.byField.map((f) => ({
        Field: f.fieldCode,
        "Revenue (₹)": (f.revenuePaise / 100).toFixed(2),
        "Collections (₹)": (f.collectionsPaise / 100).toFixed(2),
        "Outstanding (₹)": (f.outstandingPaise / 100).toFixed(2),
        "Profit (₹)": f.profitPaise === null ? "" : (f.profitPaise / 100).toFixed(2)
      }))
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        fields={fields}
        compare={compare}
        onCompareChange={onCompareChange}
        onExport={onExport}
      />

      {isLoading || !data ? (
        <div className="text-body-sm text-ink-variant">Loading statement…</div>
      ) : (
        <>
          <SectionCard title={`Profit & Loss — ${data.range.from} to ${data.range.to}`}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <StatCard label="Revenue" value={formatINR(data.totals.revenuePaise)} />
              <StatCard
                label="Cost of Goods Sold"
                value={
                  data.totals.cogsPaise === null ? "No cost data" : formatINR(data.totals.cogsPaise)
                }
              />
              <StatCard
                label="Gross Profit"
                value={
                  data.totals.grossProfitPaise === null
                    ? "—"
                    : formatINR(data.totals.grossProfitPaise)
                }
                tone={
                  data.totals.grossProfitPaise !== null && data.totals.grossProfitPaise < 0
                    ? "danger"
                    : "action"
                }
              />
              <StatCard
                label="Discounts Given"
                value={formatINR(data.totals.discountsPaise)}
                tone="warning"
              />
              <StatCard
                label="Collections (range)"
                value={formatINR(data.totals.collectionsPaise)}
              />
              <StatCard
                label="Outstanding (as of today)"
                value={formatINR(data.totals.outstandingEndPaise)}
                tone="warning"
              />
            </div>
            <div className="mt-4 text-body-sm text-ink-variant">{data.costTrackingNote}</div>
          </SectionCard>

          {data.previous && (
            <SectionCard
              title={`Compare vs Previous Period (${data.previous.range.from} → ${data.previous.range.to})`}
            >
              <div className="flex items-center gap-6 text-body-md">
                <span>
                  Previous Revenue:{" "}
                  <span className="font-semibold">
                    {formatINR(data.previous.totals.revenuePaise)}
                  </span>
                </span>
                <span>
                  Current Revenue:{" "}
                  <span className="font-semibold">{formatINR(data.totals.revenuePaise)}</span>
                </span>
                <span className={`font-semibold ${growthClass(data.previous.growthPct)}`}>
                  {formatPct(data.previous.growthPct)}
                </span>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Balance Sheet per Field">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-5 gap-2 border-b border-border pb-2 text-label-bold uppercase text-ink-variant">
                <span>Field</span>
                <span className="text-right">Revenue</span>
                <span className="text-right">Collected</span>
                <span className="text-right">Outstanding</span>
                <span className="text-right">Profit</span>
              </div>
              {data.byField.map((f) => (
                <div
                  key={f.fieldCode}
                  className="grid grid-cols-5 items-center gap-2 border-b border-border py-2 text-body-sm last:border-0"
                >
                  <span className="font-semibold">{f.fieldCode}</span>
                  <span className="text-right tabular-nums">{formatINR(f.revenuePaise)}</span>
                  <span className="text-right tabular-nums text-action">
                    {formatINR(f.collectionsPaise)}
                  </span>
                  <span className="text-right tabular-nums text-warning">
                    {formatINR(f.outstandingPaise)}
                  </span>
                  <span className="text-right tabular-nums">
                    {f.profitPaise === null ? "—" : formatINR(f.profitPaise)}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

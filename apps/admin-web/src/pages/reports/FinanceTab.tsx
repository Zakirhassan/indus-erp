import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../../components/StatCard";
import { getFinanceReport } from "../../api/reports";
import { FilterBar, SectionCard, type ReportFilters } from "./shared";

export function FinanceTab({
  filters,
  onFiltersChange,
  fields
}: {
  filters: ReportFilters;
  onFiltersChange: (f: ReportFilters) => void;
  fields: { id: string; code: string }[];
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "finance", filters],
    queryFn: () =>
      getFinanceReport({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        fieldId: filters.fieldId || undefined
      })
  });

  return (
    <div className="flex flex-col gap-6">
      <FilterBar filters={filters} onChange={onFiltersChange} fields={fields} />

      {isLoading || !data ? (
        <div className="text-body-sm text-ink-variant">Loading finance report…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Financed (range)" value={formatINR(data.totals.totalFinancedPaise)} />
            <StatCard
              label="Advance Collected (range)"
              value={formatINR(data.totals.totalAdvancePaise)}
            />
            <StatCard
              label="Active Finance Accounts"
              value={String(data.totals.activeFinanceCount)}
              tone="action"
            />
            <StatCard
              label="Completed Finance Accounts"
              value={String(data.totals.completedFinanceCount)}
            />
            <StatCard
              label="Total Outstanding"
              value={formatINR(data.totals.totalOutstandingPaise)}
              tone="warning"
            />
            <StatCard
              label="Recovery Rate (range)"
              value={`${data.totals.recoveryRatePct}%`}
              tone={
                data.totals.recoveryRatePct >= 90
                  ? "action"
                  : data.totals.recoveryRatePct >= 70
                    ? "warning"
                    : "danger"
              }
            />
          </div>

          <SectionCard title="Installment Pipeline">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded border border-border p-4 text-center">
                <div className="text-label-bold uppercase text-ink-variant">Due Today</div>
                <div className="mt-1 text-title-sm tabular-nums text-warning">
                  {formatINR(data.installments.dueTodayPaise)}
                </div>
                <div className="text-body-sm text-ink-variant">
                  {data.installments.dueTodayCount} accounts
                </div>
              </div>
              <div className="rounded border border-border p-4 text-center">
                <div className="text-label-bold uppercase text-ink-variant">Overdue</div>
                <div className="mt-1 text-title-sm tabular-nums text-danger">
                  {formatINR(data.installments.overduePaise)}
                </div>
                <div className="text-body-sm text-ink-variant">
                  {data.installments.overdueCount} accounts
                </div>
              </div>
              <div className="rounded border border-border p-4 text-center">
                <div className="text-label-bold uppercase text-ink-variant">Upcoming (7 days)</div>
                <div className="mt-1 text-title-sm tabular-nums text-ink">
                  {formatINR(data.installments.upcoming7dPaise)}
                </div>
                <div className="text-body-sm text-ink-variant">
                  {data.installments.upcoming7dCount} accounts
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

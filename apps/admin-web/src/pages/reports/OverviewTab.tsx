import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../../components/StatCard";
import { getReportsOverview } from "../../api/reports";
import { BarList, SectionCard } from "./shared";

export function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "overview"],
    queryFn: () => getReportsOverview()
  });

  if (isLoading || !data)
    return <div className="text-body-sm text-ink-variant">Loading overview…</div>;
  const { totals } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Sales (MTD)" value={formatINR(totals.totalSalesMtdPaise)} />
        <StatCard
          label="Collections (MTD)"
          value={formatINR(totals.totalCollectionsMtdPaise)}
          tone="action"
        />
        <StatCard
          label="Total Outstanding"
          value={formatINR(totals.totalOutstandingPaise)}
          tone="warning"
        />
        <StatCard
          label="Business Health"
          value={`${data.businessHealthScore} / 100`}
          tone={
            data.businessHealthScore >= 70
              ? "action"
              : data.businessHealthScore >= 40
                ? "warning"
                : "danger"
          }
        />
        <StatCard label="Active Customers" value={String(totals.activeCustomers)} />
        <StatCard label="New Customers (MTD)" value={String(totals.newCustomersMtd)} />
        <StatCard label="Inventory Value" value={formatINR(totals.totalInventoryValuePaise)} />
        <StatCard
          label="Gross Profit (MTD)"
          value={
            totals.grossProfitMtdPaise === null
              ? "No cost data"
              : formatINR(totals.grossProfitMtdPaise)
          }
          tone={
            totals.grossProfitMtdPaise === null
              ? "default"
              : totals.grossProfitMtdPaise >= 0
                ? "action"
                : "danger"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Sales Trend — Last 6 Months">
          <BarList rows={data.salesTrend.map((m) => ({ label: m.month, value: m.salesPaise }))} />
        </SectionCard>
        <SectionCard title="Collection Trend — Last 6 Months">
          <BarList
            rows={data.collectionTrend.map((m) => ({ label: m.month, value: m.collectedPaise }))}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Top Performing Fields">
          <BarList
            rows={data.topFields.map((f) => ({ label: f.fieldCode, value: f.collectionRatePct }))}
            valueFormat={(v) => `${v}%`}
          />
        </SectionCard>
        <SectionCard title="Weakest Performing Fields">
          <BarList
            rows={data.weakestFields.map((f) => ({
              label: f.fieldCode,
              value: f.collectionRatePct
            }))}
            valueFormat={(v) => `${v}%`}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Top Selling Products (90d)">
          <BarList
            rows={data.topProducts.slice(0, 8).map((p) => ({ label: p.name, value: p.qtySold90d }))}
            valueFormat={(v) => `${v} sold`}
          />
        </SectionCard>
        <SectionCard title="Slow Moving Products (90d)">
          <BarList
            rows={data.slowProducts
              .slice(0, 8)
              .map((p) => ({ label: p.name, value: p.qtySold90d }))}
            valueFormat={(v) => `${v} sold`}
          />
        </SectionCard>
      </div>

      <SectionCard title="Highest Outstanding Customers">
        <div className="flex flex-col gap-2">
          {data.highestOutstandingCustomers.map((c) => (
            <div
              key={c.customerId}
              className="flex items-center justify-between border-b border-border py-2 text-body-sm last:border-0"
            >
              <span>
                {c.fieldCode}-{c.serialNo} · {c.name}
              </span>
              <span className="flex items-center gap-4">
                {c.daysOverdue > 0 && <span className="text-danger">{c.daysOverdue}d overdue</span>}
                <span className="font-semibold tabular-nums text-warning">
                  {formatINR(c.balancePaise)}
                </span>
              </span>
            </div>
          ))}
          {data.highestOutstandingCustomers.length === 0 && (
            <div className="text-body-sm text-ink-variant">No outstanding balances.</div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

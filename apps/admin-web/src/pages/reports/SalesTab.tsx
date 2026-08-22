import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../../components/StatCard";
import { DataTable, type Column } from "../../components/DataTable";
import { getSalesReport, type SalesReport } from "../../api/reports";
import { downloadCsv } from "../../lib/csv";
import {
  BarList,
  FilterBar,
  SectionCard,
  formatPct,
  growthClass,
  type ReportFilters
} from "./shared";

export function SalesTab({
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
    queryKey: ["reports", "sales", filters, compare],
    queryFn: () =>
      getSalesReport({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        fieldId: filters.fieldId || undefined,
        compare
      })
  });

  function onExport() {
    if (!data) return;
    downloadCsv(
      "sales-report.csv",
      data.byProduct.map((p) => ({
        Product: p.name,
        Category: p.type,
        "Qty Sold": p.qty,
        "Revenue (₹)": (p.revenuePaise / 100).toFixed(2)
      }))
    );
  }

  const productColumns: Column<SalesReport["byProduct"][number]>[] = [
    { key: "name", header: "Product", render: (p) => p.name },
    { key: "type", header: "Category", render: (p) => p.type },
    { key: "qty", header: "Qty Sold", align: "right", render: (p) => p.qty },
    { key: "revenue", header: "Revenue", align: "right", render: (p) => formatINR(p.revenuePaise) }
  ];

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
        <div className="text-body-sm text-ink-variant">Loading sales report…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Net Sales" value={formatINR(data.totals.netPaise)} tone="action" />
            <StatCard label="Gross Sales" value={formatINR(data.totals.grossPaise)} />
            <StatCard
              label="Discounts Given"
              value={formatINR(data.totals.discountPaise)}
              tone="warning"
            />
            <StatCard label="Sale Count" value={String(data.totals.saleCount)} />
            <StatCard label="Cash Sales" value={formatINR(data.totals.cashPaise)} />
            <StatCard label="Finance Sales" value={formatINR(data.totals.financePaise)} />
            <StatCard label="Advance Collected" value={formatINR(data.totals.advancePaise)} />
            <StatCard label="Avg Sale Value" value={formatINR(data.totals.avgSaleValuePaise)} />
          </div>

          {data.previous && (
            <SectionCard
              title={`Compare vs Previous Period (${data.previous.range.from} → ${data.previous.range.to})`}
            >
              <div className="flex items-center gap-6 text-body-md">
                <span>
                  Previous:{" "}
                  <span className="font-semibold">{formatINR(data.previous.totals.netPaise)}</span>
                </span>
                <span>
                  Current: <span className="font-semibold">{formatINR(data.totals.netPaise)}</span>
                </span>
                <span className={`font-semibold ${growthClass(data.previous.growthPct)}`}>
                  {formatPct(data.previous.growthPct)}
                </span>
              </div>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Sales by Field">
              <BarList
                rows={data.byField.map((f) => ({ label: f.fieldCode, value: f.netPaise }))}
              />
            </SectionCard>
            <SectionCard title="Sales by Category">
              <BarList
                rows={data.byCategory.map((c) => ({ label: c.type, value: c.revenuePaise }))}
              />
            </SectionCard>
          </div>

          <SectionCard title="Product Sales — Highest Selling First">
            <DataTable
              columns={productColumns}
              rows={data.byProduct}
              rowKey={(p) => p.productId}
              page={1}
              pageSize={data.byProduct.length || 1}
              total={data.byProduct.length}
              onPageChange={() => {}}
              maxHeightClassName="max-h-[400px]"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

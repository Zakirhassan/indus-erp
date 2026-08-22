import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { StatCard } from "../../components/StatCard";
import { inputClass } from "../../components/form/Field";
import { getInventoryReport, listReportProductTypes } from "../../api/reports";
import { downloadCsv } from "../../lib/csv";
import { BarList, SectionCard } from "./shared";

export function InventoryTab() {
  const [type, setType] = useState("");
  const { data: types } = useQuery({
    queryKey: ["reports", "product-types"],
    queryFn: listReportProductTypes
  });
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "inventory", type],
    queryFn: () => getInventoryReport({ type: type || undefined })
  });

  function onExport() {
    if (!data) return;
    downloadCsv(
      "inventory-report.csv",
      data.byCategory.map((c) => ({
        Category: c.type,
        Units: c.units,
        "Valuation (₹)": (c.valuationPaise / 100).toFixed(2)
      }))
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-label-bold uppercase text-ink-variant">Category</label>
          <select
            className={`${inputClass} w-48`}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All Categories</option>
            {types?.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button className="text-body-sm text-primary hover:underline" onClick={onExport}>
          Export CSV
        </button>
      </div>

      {isLoading || !data ? (
        <div className="text-body-sm text-ink-variant">Loading inventory report…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Stock on Hand (units)" value={String(data.totals.totalStockUnits)} />
            <StatCard label="Stock Valuation" value={formatINR(data.totals.totalValuationPaise)} />
            <StatCard
              label="Cost Valuation"
              value={
                data.totals.totalCostValuationPaise === null
                  ? "No cost data"
                  : formatINR(data.totals.totalCostValuationPaise)
              }
            />
            <StatCard
              label="Out of Stock"
              value={String(data.outOfStock.length)}
              tone={data.outOfStock.length > 0 ? "danger" : "default"}
            />
          </div>

          <SectionCard title="Stock Valuation by Category">
            <BarList
              rows={data.byCategory.map((c) => ({ label: c.type, value: c.valuationPaise }))}
            />
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Fast Moving (90d)">
              <BarList
                rows={data.fastMoving.map((p) => ({ label: p.name, value: p.qtySold90d }))}
                valueFormat={(v) => `${v} sold`}
              />
            </SectionCard>
            <SectionCard title="Slow Moving (90d)">
              <BarList
                rows={data.slowMoving.map((p) => ({ label: p.name, value: p.qtySold90d }))}
                valueFormat={(v) => `${v} sold`}
              />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title={`Low Stock (< 5 units) — ${data.lowStock.length}`}>
              <div className="flex flex-col gap-1 text-body-sm">
                {data.lowStock.map((p) => (
                  <div
                    key={p.productId}
                    className="flex justify-between border-b border-border py-1.5 last:border-0"
                  >
                    <span>{p.name}</span>
                    <span className="text-warning">{p.quantity} left</span>
                  </div>
                ))}
                {data.lowStock.length === 0 && (
                  <span className="text-ink-variant">Nothing running low.</span>
                )}
              </div>
            </SectionCard>
            <SectionCard title={`Dead Stock (no sale in 180d) — ${data.deadStock.length}`}>
              <div className="flex flex-col gap-1 text-body-sm">
                {data.deadStock.map((p) => (
                  <div
                    key={p.productId}
                    className="flex justify-between border-b border-border py-1.5 last:border-0"
                  >
                    <span>{p.name}</span>
                    <span className="text-danger">
                      {p.quantity} units
                      {p.daysSinceLastSale !== null
                        ? ` · ${p.daysSinceLastSale}d idle`
                        : " · never sold"}
                    </span>
                  </div>
                ))}
                {data.deadStock.length === 0 && (
                  <span className="text-ink-variant">No dead stock.</span>
                )}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

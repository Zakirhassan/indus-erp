import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listFields } from "../api/fields";
import { OverviewTab } from "./reports/OverviewTab";
import { SalesTab } from "./reports/SalesTab";
import { CollectionsTab } from "./reports/CollectionsTab";
import { CustomersTab } from "./reports/CustomersTab";
import { FieldPerformanceTab } from "./reports/FieldPerformanceTab";
import { FinanceTab } from "./reports/FinanceTab";
import { InventoryTab } from "./reports/InventoryTab";
import { ReturnsTab } from "./reports/ReturnsTab";
import { StatementsTab } from "./reports/StatementsTab";
import {
  defaultFilters,
  monthStartIso,
  todayIso,
  yearStartIso,
  type ReportFilters
} from "./reports/shared";

type TabKey =
  | "overview"
  | "sales"
  | "collections"
  | "customers"
  | "fields"
  | "finance"
  | "inventory"
  | "returns"
  | "statements";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "collections", label: "Collections & Recovery" },
  { key: "customers", label: "Customers" },
  { key: "fields", label: "Field Performance" },
  { key: "finance", label: "Finance & Installments" },
  { key: "inventory", label: "Inventory & Products" },
  { key: "returns", label: "Returns" },
  { key: "statements", label: "Statements" }
];

interface QuickAction {
  label: string;
  apply: () => void;
}

export function ReportsPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters());
  const [salesCompare, setSalesCompare] = useState(false);
  const [statementsCompare, setStatementsCompare] = useState(false);

  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: listFields });
  const fieldOptions = (fields ?? []).map((f) => ({ id: f.id, code: f.code }));

  function goToMonth(nextTab: TabKey, compareOn = false) {
    setFilters({ dateFrom: monthStartIso(), dateTo: todayIso(), fieldId: "" });
    setTab(nextTab);
    if (nextTab === "sales") setSalesCompare(compareOn);
    if (nextTab === "statements") setStatementsCompare(compareOn);
  }

  const quickActions: QuickAction[] = [
    { label: "Sales This Month", apply: () => goToMonth("sales") },
    {
      label: "Sales YTD",
      apply: () => {
        setFilters({ dateFrom: yearStartIso(), dateTo: todayIso(), fieldId: "" });
        setTab("sales");
        setSalesCompare(false);
      }
    },
    { label: "Month-to-Month Compare", apply: () => goToMonth("sales", true) },
    { label: "Highest Selling Item", apply: () => setTab("overview") },
    {
      label: "Who To Collect Today",
      apply: () => {
        setTab("collections");
      }
    },
    { label: "Customers Needing Attention", apply: () => goToMonth("customers") },
    { label: "Non-Performing Customers", apply: () => goToMonth("customers") },
    { label: "Balance Sheet per Field", apply: () => goToMonth("fields") },
    { label: "Profit & Loss Statement", apply: () => goToMonth("statements") },
    { label: "Return Statements", apply: () => goToMonth("returns") }
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="glass-panel rounded-lg p-container-p">
        <div className="mb-2 text-label-bold uppercase text-ink-variant">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={qa.apply}
              className="rounded-full border border-border-outline px-3 py-1.5 text-body-sm text-primary transition-colors hover:bg-row-hover"
            >
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t px-4 py-2.5 text-body-md transition-colors ${
              tab === t.key
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-ink-variant hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "sales" && (
        <SalesTab
          filters={filters}
          onFiltersChange={setFilters}
          fields={fieldOptions}
          compare={salesCompare}
          onCompareChange={setSalesCompare}
        />
      )}
      {tab === "collections" && (
        <CollectionsTab filters={filters} onFiltersChange={setFilters} fields={fieldOptions} />
      )}
      {tab === "customers" && (
        <CustomersTab filters={filters} onFiltersChange={setFilters} fields={fieldOptions} />
      )}
      {tab === "fields" && (
        <FieldPerformanceTab filters={filters} onFiltersChange={setFilters} fields={fieldOptions} />
      )}
      {tab === "finance" && (
        <FinanceTab filters={filters} onFiltersChange={setFilters} fields={fieldOptions} />
      )}
      {tab === "inventory" && <InventoryTab />}
      {tab === "returns" && (
        <ReturnsTab filters={filters} onFiltersChange={setFilters} fields={fieldOptions} />
      )}
      {tab === "statements" && (
        <StatementsTab
          filters={filters}
          onFiltersChange={setFilters}
          fields={fieldOptions}
          compare={statementsCompare}
          onCompareChange={setStatementsCompare}
        />
      )}
    </div>
  );
}

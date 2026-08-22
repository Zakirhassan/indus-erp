import type { ReactNode } from "react";
import { formatINR } from "@indus/shared-types";
import { inputClass } from "../../components/form/Field";

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  fieldId: string; // "" = all fields
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
export function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
export function yearStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}
export function lastMonthRange(): { from: string; to: string } {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const to = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function defaultFilters(): ReportFilters {
  return { dateFrom: monthStartIso(), dateTo: todayIso(), fieldId: "" };
}

export function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v > 0 ? "+" : ""}${v}%`;
}

/** Returns a complete literal Tailwind class (never interpolate tone into a template — the JIT scanner needs static tokens). */
export function growthClass(v: number | null | undefined): string {
  if (v === null || v === undefined) return "text-ink-variant";
  if (v > 0) return "text-action";
  if (v < 0) return "text-danger";
  return "text-ink-variant";
}

/** Tiny dependency-free bar chart — a horizontal list of labeled bars, width scaled to the max value. */
export function BarList({
  rows,
  valueFormat = formatINR
}: {
  rows: { label: string; value: number }[];
  valueFormat?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-24 flex-shrink-0 truncate text-body-sm text-ink-variant">
            {r.label}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded bg-surface-container">
            <div
              className="h-full rounded bg-action"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-28 flex-shrink-0 text-right text-body-sm tabular-nums text-ink">
            {valueFormat(r.value)}
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="text-body-sm text-ink-variant">No data in this range.</div>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="glass-panel rounded-lg p-container-p">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-title-sm text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function FilterBar({
  filters,
  onChange,
  fields,
  compare,
  onCompareChange,
  onExport
}: {
  filters: ReportFilters;
  onChange: (f: ReportFilters) => void;
  fields?: { id: string; code: string }[];
  compare?: boolean;
  onCompareChange?: (v: boolean) => void;
  onExport?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-label-bold uppercase text-ink-variant">From</label>
          <input
            type="date"
            className={inputClass}
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-label-bold uppercase text-ink-variant">To</label>
          <input
            type="date"
            className={inputClass}
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          />
        </div>
        {fields && (
          <div className="flex flex-col gap-1">
            <label className="text-label-bold uppercase text-ink-variant">Field</label>
            <select
              className={`${inputClass} w-40`}
              value={filters.fieldId}
              onChange={(e) => onChange({ ...filters, fieldId: e.target.value })}
            >
              <option value="">All Fields</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2 pb-0.5">
          <button
            className="text-body-sm text-primary hover:underline"
            onClick={() => onChange({ ...filters, dateFrom: monthStartIso(), dateTo: todayIso() })}
          >
            This Month
          </button>
          <button
            className="text-body-sm text-primary hover:underline"
            onClick={() => onChange({ ...filters, dateFrom: yearStartIso(), dateTo: todayIso() })}
          >
            YTD
          </button>
          <button
            className="text-body-sm text-primary hover:underline"
            onClick={() => {
              const r = lastMonthRange();
              onChange({ ...filters, dateFrom: r.from, dateTo: r.to });
            }}
          >
            Last Month
          </button>
        </div>
        {onCompareChange && (
          <label className="flex items-center gap-2 pb-0.5 text-body-sm text-ink-variant">
            <input
              type="checkbox"
              checked={!!compare}
              onChange={(e) => onCompareChange(e.target.checked)}
            />
            Compare to previous period
          </label>
        )}
      </div>
      {onExport && (
        <button className="text-body-sm text-primary hover:underline" onClick={onExport}>
          Export CSV
        </button>
      )}
    </div>
  );
}

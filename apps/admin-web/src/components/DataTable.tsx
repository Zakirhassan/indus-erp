import type { ReactNode } from "react";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  footer?: ReactNode;
  widthClassName?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  showFooter?: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  maxHeightClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyMessage = "No records found.",
  showFooter,
  page,
  pageSize,
  total,
  onPageChange,
  maxHeightClassName = "max-h-[60vh]",
}: Props<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface-lowest">
      <div className={`overflow-auto ${maxHeightClassName}`}>
        <table className="w-full border-collapse text-table-data">
          <thead className="sticky top-0 z-10 bg-table-header">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`border-b border-border px-4 py-3 text-left text-label-bold uppercase text-ink-variant ${
                    col.align === "right" ? "text-right" : ""
                  } ${col.widthClassName ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-body-sm text-ink-variant">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-body-sm text-ink-variant">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-border last:border-b-0 hover:bg-row-hover">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 tabular-nums text-ink ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {showFooter && rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-table-header font-semibold">
              <tr>
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 tabular-nums ${col.align === "right" ? "text-right" : ""}`}>
                    {col.footer}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-body-sm text-ink-variant">
        <span>
          {total === 0 ? "0 results" : `${start}–${end} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

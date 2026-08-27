import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileJson } from "lucide-react";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { inputClass } from "../components/form/Field";
import { listAuditLogs, type AuditLogEntry } from "../api/auditLogs";

function monthToDateRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

function prettyJson(raw: string | null): string {
  if (!raw) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

const METHOD_COLOR: Record<string, string> = {
  POST: "text-action",
  PATCH: "text-warning",
  DELETE: "text-danger",
  PUT: "text-warning",
};

export function AuditLogPage() {
  const mtd = monthToDateRange();
  const [dateFrom, setDateFrom] = useState(mtd.from);
  const [dateTo, setDateTo] = useState(mtd.to);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);
  const pageSize = 25;

  const params = { dateFrom, dateTo, page, pageSize };
  const { data, isLoading } = useQuery({ queryKey: ["auditLogs", params], queryFn: () => listAuditLogs(params) });

  const columns: Column<AuditLogEntry>[] = [
    { key: "when", header: "When", render: (e) => new Date(e.createdAt).toLocaleString() },
    { key: "actor", header: "Actor", render: (e) => e.actorName ?? "—" },
    { key: "role", header: "Role", render: (e) => e.actorRole ?? "—" },
    {
      key: "action",
      header: "Action",
      render: (e) => (
        <span>
          <span className={`font-semibold ${METHOD_COLOR[e.method] ?? "text-ink-variant"}`}>{e.method}</span>{" "}
          <span className="text-ink-variant">{e.path}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", align: "right", render: (e) => e.statusCode },
    {
      key: "detail",
      header: "Detail",
      align: "right",
      render: (e) => (
        <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => setDetail(e)}>
          <FileJson size={14} /> View
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-ink-variant">to</span>
        <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(e) => e.id}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No recorded actions in this range."
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Action Detail" width="lg">
        {detail && (
          <div className="flex flex-col gap-4 text-body-sm">
            <div>
              <span className="font-semibold">{detail.method}</span> {detail.path} — {detail.statusCode}
            </div>
            <div>
              <div className="mb-1 font-semibold text-ink-variant">Request</div>
              <pre className="overflow-auto rounded bg-surface-container p-3 text-body-sm">{prettyJson(detail.requestBody)}</pre>
            </div>
            <div>
              <div className="mb-1 font-semibold text-ink-variant">Response</div>
              <pre className="overflow-auto rounded bg-surface-container p-3 text-body-sm">{prettyJson(detail.responseBody)}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

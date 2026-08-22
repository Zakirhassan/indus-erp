const styles: Record<string, string> = {
  ACTIVE: "bg-action-container text-action-on-container",
  INACTIVE: "bg-slate-200 text-slate-600",
  PENDING: "bg-warning-container text-warning-on-container",
  VERIFIED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-action-container text-action-on-container",
  REJECTED: "bg-danger-container text-danger-on-container",
  OUTSTANDING: "bg-danger-container text-danger-on-container",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = styles[status] ?? "bg-slate-200 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label-bold uppercase tracking-wide ${cls}`}>
      {label ?? status}
    </span>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "action" | "danger";
}) {
  const toneClass =
    tone === "warning" ? "text-warning" : tone === "action" ? "text-action" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="glass-panel rounded-lg p-container-p">
      <div className="text-label-bold uppercase text-ink-variant">{label}</div>
      <div className={`mt-2 text-display-lg tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

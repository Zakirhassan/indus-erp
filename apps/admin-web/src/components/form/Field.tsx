import type { ReactNode } from "react";

export const inputClass =
  "h-10 w-full rounded border border-border bg-surface-lowest px-3 text-body-md text-ink placeholder:text-ink-variant focus:border-primary focus:outline-none";

export const inputErrorClass = "border-danger focus:border-danger";

export function Field({
  label,
  htmlFor,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-label-bold uppercase text-ink-variant">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && !error && <span className="text-body-sm text-ink-variant">{hint}</span>}
      {error && <span className="text-body-sm text-danger">{error}</span>}
    </div>
  );
}

import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg" | "xl";
}

const widths = { md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" };

export function Modal({ open, onClose, title, children, footer, width = "lg" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`glass-panel flex max-h-[90vh] w-full ${widths[width]} flex-col rounded-xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-border px-container-p py-4">
          <h2 className="text-title-sm text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-ink-variant hover:bg-row-hover"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-container-p py-4">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-border px-container-p py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

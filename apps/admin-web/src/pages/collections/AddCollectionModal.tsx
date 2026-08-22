import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomerStatus, formatINR, paiseToRupees, rupeesToPaise } from "@indus/shared-types";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Field, inputClass, inputErrorClass } from "../../components/form/Field";
import { findBatchForDateField, saveCollectionBatch, validateBatchEntries } from "../../api/collections";
import { listFields } from "../../api/fields";
import { listCustomers, type CustomerListRow } from "../../api/customers";

interface Row {
  key: string;
  serialNo: string;
  displayText: string;
  amountRupees: string;
  balancePaise: number | null;
}

function blankRows(n: number): Row[] {
  return Array.from({ length: n }, () => ({ key: crypto.randomUUID(), serialNo: "", displayText: "", amountRupees: "", balancePaise: null }));
}

/** Serial-number cell: type a serial or a customer name to search within the selected field. */
function SerialNumberCell({
  fieldId,
  value,
  disabled,
  hasError,
  onSelect,
  onRawChange,
}: {
  fieldId: string;
  value: string;
  disabled: boolean;
  hasError: boolean;
  onSelect: (customer: CustomerListRow) => void;
  onRawChange: (text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerListRow[]>([]);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    if (!open || !fieldId || !query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      listCustomers({ fieldId, search: query.trim(), pageSize: 20 }).then((page) => {
        if (cancelled) return;
        setResults(page.items.filter((c) => c.status === CustomerStatus.Active).slice(0, 8));
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, fieldId, query]);

  useEffect(() => {
    if (!open) return;
    function updateRect() {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open]);

  return (
    <div>
      <input
        ref={inputRef}
        className={`${inputClass} ${hasError ? inputErrorClass : ""}`}
        value={query}
        disabled={disabled}
        placeholder={disabled ? "Select a field first" : "Serial no. or name"}
        onChange={(e) => {
          setQuery(e.target.value);
          onRawChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open &&
        rect &&
        results.length > 0 &&
        createPortal(
          <ul
            className="fixed z-50 max-h-56 overflow-y-auto rounded border border-border bg-surface-lowest shadow-lg"
            style={{ top: rect.top, left: rect.left, width: Math.max(rect.width, 240) }}
          >
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-body-sm hover:bg-row-hover"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(c);
                    setQuery(`${c.serialNo} — ${c.name}`);
                    setOpen(false);
                  }}
                >
                  <span className="font-semibold text-ink">
                    {c.serialNo} — {c.name}
                  </span>
                  <span className="text-body-sm text-ink-variant">Balance {formatINR(c.balancePaise)}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}

export function AddCollectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: listFields, enabled: open });
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fieldId, setFieldId] = useState("");
  const [rows, setRows] = useState<Row[]>(blankRows(15));
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [existingNote, setExistingNote] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Duplicate-batch guard: loading an existing (date, field) batch shows its entries instead of starting fresh.
  useEffect(() => {
    if (!open || !date || !fieldId) return;
    let cancelled = false;
    findBatchForDateField(date, fieldId).then((batch) => {
      if (cancelled) return;
      if (batch && batch.entries.length > 0) {
        setRows([
          ...batch.entries.map((e) => ({
            key: crypto.randomUUID(),
            serialNo: String(e.serialNo),
            displayText: String(e.serialNo),
            amountRupees: String(e.amountPaise / 100),
            balancePaise: null,
          })),
          ...blankRows(Math.max(3, 15 - batch.entries.length)),
        ]);
        setExistingNote(`A batch already exists for this date and field — ${batch.entries.length} entries loaded. New rows will be added to it.`);
      } else {
        setExistingNote(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, date, fieldId]);

  // Live inline validation.
  useEffect(() => {
    if (!fieldId) return;
    const entries = rows
      .filter((r) => r.serialNo && r.amountRupees)
      .map((r) => ({ serialNo: Number(r.serialNo), amountPaise: rupeesToPaise(Number(r.amountRupees) || 0) }));
    if (entries.length === 0) {
      setRowErrors({});
      return;
    }
    let cancelled = false;
    validateBatchEntries(fieldId, entries).then((results) => {
      if (cancelled) return;
      const errs: Record<string, string> = {};
      rows.forEach((r) => {
        if (!r.serialNo || !r.amountRupees) return;
        const match = results.find((res) => res.serialNo === Number(r.serialNo));
        if (match?.error) errs[r.key] = match.error;
      });
      setRowErrors(errs);
    });
    return () => {
      cancelled = true;
    };
  }, [rows, fieldId]);

  // A serial number can only be collected once per batch — flag every row after the first that reuses one.
  const duplicateErrors = useMemo(() => {
    const seen = new Set<string>();
    const errs: Record<string, string> = {};
    for (const r of rows) {
      if (!r.serialNo) continue;
      if (seen.has(r.serialNo)) errs[r.key] = "Already added above — a serial can only be collected once per batch";
      else seen.add(r.serialNo);
    }
    return errs;
  }, [rows]);

  const combinedErrors = useMemo(() => ({ ...rowErrors, ...duplicateErrors }), [rowErrors, duplicateErrors]);

  const totalPaise = useMemo(
    () =>
      rows.reduce((sum, r) => {
        if (!r.serialNo || !r.amountRupees || combinedErrors[r.key]) return sum;
        return sum + rupeesToPaise(Number(r.amountRupees) || 0);
      }, 0),
    [rows, combinedErrors],
  );

  const mutation = useMutation({
    mutationFn: saveCollectionBatch,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["collectionBatches"] });
      if (result.rejectedEntries.length > 0) {
        setResultBanner({
          tone: "warning",
          text: `Saved. ${result.rejectedEntries.length} row(s) were skipped: ${result.rejectedEntries
            .map((e) => `Sno ${e.serialNo} (${e.error})`)
            .join("; ")}`,
        });
      } else {
        resetAndClose();
      }
    },
    onError: (err: unknown) => setSaveError(err instanceof Error ? err.message : "Failed to save collection batch"),
  });

  function resetAndClose() {
    setDate(new Date().toISOString().slice(0, 10));
    setFieldId("");
    setRows(blankRows(15));
    setRowErrors({});
    setExistingNote(null);
    setResultBanner(null);
    setSaveError(null);
    onClose();
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onSave() {
    setSaveError(null);
    setResultBanner(null);
    if (!fieldId) return setSaveError("Select a field");
    const entries = rows
      .filter((r) => r.serialNo && r.amountRupees && !duplicateErrors[r.key])
      .map((r) => ({ serialNo: Number(r.serialNo), amountPaise: rupeesToPaise(Number(r.amountRupees) || 0) }));
    if (entries.length === 0) return setSaveError("Enter at least one collection entry");
    mutation.mutate({ date, fieldId, entries });
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Add Daily Collection"
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {saveError && <div className="mb-4 rounded border border-danger bg-danger-container px-3 py-2 text-body-sm text-danger-on-container">{saveError}</div>}
      {resultBanner && (
        <div
          className={`mb-4 rounded border px-3 py-2 text-body-sm ${
            resultBanner.tone === "success" ? "border-action bg-action-container text-action-on-container" : "border-warning bg-warning-container text-warning-on-container"
          }`}
        >
          {resultBanner.text}
        </div>
      )}
      {existingNote && <div className="mb-4 rounded border border-border bg-surface-low px-3 py-2 text-body-sm text-ink-variant">{existingNote}</div>}

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Field label="Date" required>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Field" required>
          <select
            className={inputClass}
            value={fieldId}
            onChange={(e) => {
              setFieldId(e.target.value);
              setRows(blankRows(15));
            }}
          >
            <option value="">Select field</option>
            {fields?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} — {f.description}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-body-sm">
          <thead className="bg-table-header text-label-bold uppercase text-ink-variant">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Serial Number</th>
              <th className="px-3 py-2 text-right">Amount (₹)</th>
              <th className="px-3 py-2 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.key} className="border-t border-border">
                <td className="px-3 py-2 text-ink-variant">{idx + 1}</td>
                <td className="px-3 py-2">
                  <SerialNumberCell
                    fieldId={fieldId}
                    value={row.displayText}
                    disabled={!fieldId}
                    hasError={!!combinedErrors[row.key]}
                    onRawChange={(text) => {
                      const isNumeric = /^\d*$/.test(text);
                      updateRow(row.key, { displayText: text, serialNo: isNumeric ? text : "", balancePaise: null });
                    }}
                    onSelect={(c) => {
                      const suggestedPaise = Math.max(0, Math.min(c.financeAmountPaise, c.balancePaise));
                      updateRow(row.key, {
                        serialNo: String(c.serialNo),
                        displayText: `${c.serialNo} — ${c.name}`,
                        amountRupees: suggestedPaise > 0 ? String(paiseToRupees(suggestedPaise)) : row.amountRupees,
                        balancePaise: c.balancePaise,
                      });
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className={`${inputClass} text-right ${combinedErrors[row.key] ? inputErrorClass : ""}`}
                    value={row.amountRupees}
                    onChange={(e) => updateRow(row.key, { amountRupees: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 text-body-sm">
                  {combinedErrors[row.key] ? (
                    <span className="text-danger">{combinedErrors[row.key]}</span>
                  ) : row.balancePaise != null ? (
                    <span className="text-ink-variant">Bal {formatINR(row.balancePaise)}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-table-header font-semibold">
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatINR(totalPaise)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button type="button" className="mt-2 text-body-sm text-primary hover:underline" onClick={() => setRows((prev) => [...prev, ...blankRows(1)])}>
        + Add row
      </button>
    </Modal>
  );
}

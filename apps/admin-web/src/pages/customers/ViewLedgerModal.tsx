import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { Modal } from "../../components/Modal";
import { StatusBadge } from "../../components/StatusBadge";
import { getCustomer, getCustomerLedger } from "../../api/customers";

export function ViewLedgerModal({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => getCustomer(customerId!),
    enabled: !!customerId,
  });
  const { data: ledger } = useQuery({
    queryKey: ["ledger", customerId],
    queryFn: () => getCustomerLedger(customerId!),
    enabled: !!customerId,
  });

  const customer = data?.customer;
  const sale = data?.sale;

  return (
    <Modal open={!!customerId} onClose={onClose} title="Customer Ledger" width="lg">
      {customer && sale && (
        <>
          <div className="glass-panel mb-4 grid grid-cols-3 gap-4 rounded-lg p-4 text-body-sm">
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Field / Sno</div>
              <div className="text-body-md font-semibold">{customer.fieldCode}-{customer.serialNo}</div>
            </div>
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Customer</div>
              <div className="text-body-md font-semibold">{customer.name}</div>
              <div>{customer.relation} {customer.relationName}</div>
            </div>
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Status</div>
              <StatusBadge status={customer.status} />
            </div>
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Address / Phone</div>
              <div>{customer.address}</div>
              <div>{customer.phone}</div>
            </div>
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Finance Amount / Occurrence</div>
              <div className="font-semibold">
                {formatINR(sale.financePlan.financeAmountPaise)} / {sale.financePlan.occurrence.toLowerCase()}
              </div>
            </div>
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Current Balance</div>
              <div className={`font-semibold ${sale.balancePaise > 0 ? "text-warning" : "text-action"}`}>
                {formatINR(sale.balancePaise)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-border bg-surface-lowest">
            <table className="w-full text-table-data">
              <thead className="bg-table-header text-label-bold uppercase text-ink-variant">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-left">Collected By</th>
                  <th className="px-3 py-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {ledger?.map((entry) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="px-3 py-2">{entry.date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.debitPaise > 0 ? formatINR(entry.debitPaise) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.creditPaise > 0 ? formatINR(entry.creditPaise) : "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatINR(entry.balanceAfterPaise)}</td>
                    <td className="px-3 py-2">{entry.collectedBy ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-variant">{entry.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sale.balancePaise <= 0 && (
            <p className="mt-3 text-body-sm text-ink-variant">
              Balance reached zero — this customer was automatically marked Inactive.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

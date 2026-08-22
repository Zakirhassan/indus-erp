import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@indus/shared-types";
import { Modal } from "../../components/Modal";
import { getBatch } from "../../api/collections";

export function ViewBatchModal({ batchId, onClose }: { batchId: string | null; onClose: () => void }) {
  const { data: batch } = useQuery({ queryKey: ["batch", batchId], queryFn: () => getBatch(batchId!), enabled: !!batchId });

  return (
    <Modal open={!!batchId} onClose={onClose} title="Collection Batch Entries" width="md">
      {batch && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4 text-body-sm">
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Date</div>
              <div className="font-semibold">{batch.date}</div>
            </div>
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Field</div>
              <div className="font-semibold">{batch.fieldCode}</div>
            </div>
            <div>
              <div className="text-label-bold uppercase text-ink-variant">Total</div>
              <div className="font-semibold">{formatINR(batch.totalAmountPaise)}</div>
            </div>
          </div>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-body-sm">
              <thead className="bg-table-header text-label-bold uppercase text-ink-variant">
                <tr>
                  <th className="px-3 py-2 text-left">Serial</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {batch.entries.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      {batch.fieldCode}-{e.serialNo}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatINR(e.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

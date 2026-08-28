/**
 * TransactionsPage — Full Inventory Transaction Management
 * Left: KPI strip + recent feed. Center: Log table. FAB: New transaction.
 */

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { TransactionLogTable } from "./TransactionLogTable";
import { TransactionKPIStrip } from "./TransactionKPIStrip";
import { NewTransactionModal } from "./NewTransactionModal";
import { useTransactionStore } from "@/lib/transaction-store";
import { useInvBinStore } from "@/lib/inventory-bin-store";

export function TransactionsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName);
  const pendingCount = useTransactionStore((s) =>
    s.transactions.filter((t) =>
      (t.status === "PENDING" || t.status === "IN_PROGRESS") &&
      (t.sourceWarehouse === activeWarehouseName || t.destWarehouse === activeWarehouseName)
    ).length
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: KPIs + feed */}
      <aside className="w-[280px] shrink-0 border-r border-border/50 overflow-y-auto bg-sidebar/30">
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-sidebar">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <div>
            <div className="text-xs font-bold">Transaction Engine</div>
            <div className="text-[9px] text-muted-foreground font-mono">
              {activeWarehouseName ?? "No warehouse"}
              {pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[8px] font-bold">
                  {pendingCount} pending
                </span>
              )}
            </div>
          </div>
        </div>
        <TransactionKPIStrip />
      </aside>

      {/* Main: transaction log */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Table — "New Transaction" now lives inline in its toolbar instead of a
            floating bottom-right FAB, which could sit under/overlap other fixed
            corner UI (e.g. the editor's own overlay banner). */}
        <TransactionLogTable onNewTransaction={() => setModalOpen(true)} />
      </main>

      {/* Modal */}
      <NewTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

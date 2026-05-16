/**
 * TransactionLogTable — Enterprise inventory transaction log
 * Real-time updates, animated rows, filterable, exportable.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, Filter, X, ArrowUpDown, Download, RefreshCw,
  ChevronRight, Clock, Package, CheckCircle2, AlertCircle,
  XCircle, Pause, ArrowRight,
} from "lucide-react";
import {
  useTransactionStore,
  TXN_TYPE_META,
  TXN_STATUS_META,
  type TransactionType,
  type TransactionStatus,
  type InventoryTransaction,
} from "@/lib/transaction-store";
import { useInvBinStore } from "@/lib/inventory-bin-store";

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: TransactionStatus }) {
  const map = {
    PENDING:     <Clock className="h-3.5 w-3.5" />,
    IN_PROGRESS: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
    COMPLETED:   <CheckCircle2 className="h-3.5 w-3.5" />,
    FAILED:      <AlertCircle className="h-3.5 w-3.5" />,
    CANCELLED:   <XCircle className="h-3.5 w-3.5" />,
  };
  return map[status] ?? <Pause className="h-3.5 w-3.5" />;
}

// ─── Row component ────────────────────────────────────────────────────────────

function TransactionRow({
  txn,
  isNew,
  isSelected,
  onClick,
}: {
  txn: InventoryTransaction;
  isNew: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const type = TXN_TYPE_META[txn.type];
  const status = TXN_STATUS_META[txn.status];
  const [flash, setFlash] = useState(isNew);
  const ref = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (isNew) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  const ts = new Date(txn.timestamp);
  const timeStr = ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateStr = ts.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <tr
      ref={ref}
      onClick={onClick}
      className={`
        group relative cursor-pointer border-b border-border/20 transition-all duration-200
        hover:bg-sidebar/60
        ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}
        ${flash ? "animate-pulse bg-primary/10" : ""}
      `}
      style={flash ? { animation: "txn-flash 2s ease-out forwards" } : {}}
    >
      {/* Animated left border for new rows */}
      {flash && (
        <td className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
      )}

      {/* TXN ID */}
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className="text-[10px] font-mono text-muted-foreground">{txn.id}</span>
      </td>

      {/* Type */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${type.color} ${type.bg} ${type.border}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${type.dot}`} />
          {type.label}
        </span>
      </td>

      {/* SKU */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Package className="h-3 w-3 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-mono font-medium truncate max-w-[100px]">{txn.skuCode}</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{txn.skuName}</div>
          </div>
        </div>
      </td>

      {/* Quantity */}
      <td className="px-3 py-2.5 whitespace-nowrap text-right">
        <span className="text-xs font-bold font-mono tabular-nums">{txn.quantity.toLocaleString()}</span>
        <span className="text-[10px] text-muted-foreground ml-1">{txn.uom}</span>
      </td>

      {/* Movement path */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="font-mono text-muted-foreground">{txn.sourceBinCode ?? "—"}</span>
          {txn.destBinCode && (
            <>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
              <span className="font-mono text-muted-foreground">{txn.destBinCode}</span>
            </>
          )}
        </div>
        {txn.sourceZone && (
          <div className="text-[9px] text-muted-foreground/60 mt-0.5 truncate max-w-[140px]">
            {txn.sourceZone}
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${status.color} ${status.bg}`}>
          <StatusIcon status={txn.status} />
          {status.label}
        </span>
      </td>

      {/* User */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-[10px] text-muted-foreground">{txn.userName}</span>
      </td>

      {/* Timestamp */}
      <td className="px-3 py-2.5 whitespace-nowrap text-right">
        <div className="text-[10px] font-mono text-muted-foreground">{timeStr}</div>
        <div className="text-[9px] text-muted-foreground/60">{dateStr}</div>
      </td>

      {/* Expand arrow */}
      <td className="px-2 py-2.5">
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
      </td>
    </tr>
  );
}

// ─── Detail expand row ────────────────────────────────────────────────────────

function TransactionDetailRow({ txn }: { txn: InventoryTransaction }) {
  const type = TXN_TYPE_META[txn.type];

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Transaction ID", value: <span className="font-mono text-xs">{txn.id}</span> },
    { label: "Source Warehouse", value: txn.sourceWarehouse },
    { label: "Source Bin", value: txn.sourceBinCode ?? "—" },
    { label: "Source Zone", value: txn.sourceZone ?? "—" },
    { label: "Dest Warehouse", value: txn.destWarehouse ?? "—" },
    { label: "Dest Bin", value: txn.destBinCode ?? "—" },
    { label: "Batch Number", value: txn.batchNumber ?? "—" },
    { label: "Reference Doc", value: txn.referenceDoc ?? "—" },
    ...(txn.notes ? [{ label: "Notes", value: txn.notes }] : []),
    ...(txn.prevQuantitySource !== null ? [
      { label: "Qty Δ (Source)", value: `${txn.prevQuantitySource} → ${txn.newQuantitySource ?? "—"}` },
    ] : []),
    ...(txn.prevQuantityDest !== null ? [
      { label: "Qty Δ (Dest)", value: `${txn.prevQuantityDest} → ${txn.newQuantityDest ?? "—"}` },
    ] : []),
    { label: "Completed At", value: txn.completedAt ? new Date(txn.completedAt).toLocaleString() : "—" },
  ];

  return (
    <tr className="border-b border-border/20">
      <td colSpan={9} className={`px-4 py-3 ${type.bg}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">{label}</div>
              <div className="text-[10px] font-medium text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

// ─── Export helper ────────────────────────────────────────────────────────────

function exportCSV(txns: InventoryTransaction[]) {
  const headers = ["ID", "Type", "Status", "SKU", "Qty", "UOM", "Source Bin", "Dest Bin", "User", "Timestamp", "Ref Doc"];
  const rows = txns.map((t) => [
    t.id, t.type, t.status, t.skuCode, t.quantity, t.uom,
    t.sourceBinCode ?? "", t.destBinCode ?? "", t.userName,
    t.timestamp, t.referenceDoc ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TransactionLogTable() {
  const filteredTransactions = useTransactionStore((s) => s.filteredTransactions);
  const filters = useTransactionStore((s) => s.filters);
  const setFilters = useTransactionStore((s) => s.setFilters);
  const resetFilters = useTransactionStore((s) => s.resetFilters);
  const lastAnimatedTxnId = useTransactionStore((s) => s.lastAnimatedTxnId);
  const clearLastAnimated = useTransactionStore((s) => s.clearLastAnimated);
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  // Sync warehouse filter
  useEffect(() => {
    if (activeWarehouseName) {
      setFilters({ warehouseName: activeWarehouseName });
    }
  }, [activeWarehouseName, setFilters]);

  // Clear animation marker after render
  useEffect(() => {
    if (lastAnimatedTxnId) {
      const t = setTimeout(clearLastAnimated, 3000);
      return () => clearTimeout(t);
    }
  }, [lastAnimatedTxnId, clearLastAnimated]);

  const txns = useMemo(() => {
    const f = filteredTransactions();
    return sortDir === "asc" ? [...f].reverse() : f;
  }, [filteredTransactions, filters, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = filters.search || filters.type || filters.status || filters.skuCode || filters.dateFrom || filters.dateTo;

  const typeOptions: TransactionType[] = ["RECEIVED", "MOVED", "RACK_TRANSFER", "WH_TRANSFER", "ADJUSTMENT", "BLOCKED", "DAMAGED", "RETURNED"];
  const statusOptions: TransactionStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-sidebar/50 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search ID, SKU, bin, user…"
            className="w-full bg-secondary border border-border/50 rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            showFilters || hasFilters
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter className="h-3 w-3" />
          Filters
          {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </button>

        {/* Sort */}
        <button
          onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          title={sortDir === "desc" ? "Newest first" : "Oldest first"}
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortDir === "desc" ? "Newest" : "Oldest"}
        </button>

        {/* Export */}
        <button
          onClick={() => exportCSV(txns)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3 w-3" />
          Export
        </button>

        <div className="ml-auto text-[10px] text-muted-foreground font-mono">
          {txns.length.toLocaleString()} records
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border/30 bg-sidebar/30">
          {/* Type filter */}
          <div className="relative">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ type: e.target.value as TransactionType | "" })}
              className="appearance-none bg-secondary border border-border/50 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 pr-6"
            >
              <option value="">All Types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{TXN_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value as TransactionStatus | "" })}
              className="appearance-none bg-secondary border border-border/50 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 pr-6"
            >
              <option value="">All Statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{TXN_STATUS_META[s].label}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ dateFrom: e.target.value })}
            className="bg-secondary border border-border/50 rounded-lg px-2.5 py-1.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
          />
          <span className="text-[10px] text-muted-foreground">to</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ dateTo: e.target.value })}
            className="bg-secondary border border-border/50 rounded-lg px-2.5 py-1.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
          />

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <style>{`
          @keyframes txn-flash {
            0%   { background-color: rgba(var(--color-primary-rgb, 234 88 12) / 0.15); }
            100% { background-color: transparent; }
          }
        `}</style>
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-sidebar border-b border-border/50">
              {["TXN ID", "Type", "SKU", "Qty", "Movement", "Status", "User", "Time", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap first:px-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txns.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-xs text-muted-foreground">
                  No transactions match the current filters.
                </td>
              </tr>
            ) : (
              txns.map((txn) => (
                <>
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    isNew={txn.id === lastAnimatedTxnId}
                    isSelected={selectedId === txn.id}
                    onClick={() => setSelectedId((id) => id === txn.id ? null : txn.id)}
                  />
                  {selectedId === txn.id && (
                    <TransactionDetailRow key={`${txn.id}-detail`} txn={txn} />
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * TriloWMS — Inventory Transaction Store (Sprint 1C)
 * Enterprise-grade transaction engine for all stock movements.
 * Mirrors SAP EWM transaction patterns.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BinStatus } from "./wms-data";
import { useAuthStore } from "@/lib/auth-store";
import { useEditorStore } from "@/lib/wms-editor-store";

// ─── Transaction Types ────────────────────────────────────────────────────────

export type TransactionType =
  | "RECEIVED"      // Inbound: new inventory received into a bin
  | "MOVED"         // Internal: bin-to-bin movement within same zone/aisle
  | "RACK_TRANSFER" // Internal: rack-to-rack transfer (different rack, same warehouse)
  | "WH_TRANSFER"   // Cross-warehouse transfer
  | "ADJUSTMENT"    // Stock count correction (positive or negative)
  | "BLOCKED"       // Bin or stock flagged as blocked
  | "DAMAGED"       // Stock marked as damaged
  | "RETURNED";     // Return processing back into stock

export type TransactionStatus =
  | "PENDING"     // Created, awaiting execution
  | "IN_PROGRESS" // Being physically executed
  | "COMPLETED"   // Successfully done
  | "FAILED"      // Error during execution
  | "CANCELLED";  // Cancelled before execution

export interface InventoryTransaction {
  id: string;             // TXN-YYYYMMDD-NNNNNN
  type: TransactionType;
  status: TransactionStatus;

  // Stock info
  skuCode: string;
  skuName: string;
  quantity: number;
  uom: string;            // Unit of measure: EA, KG, PLT, etc.

  // Location
  sourceWarehouse: string;
  sourceBinId: string | null;
  sourceBinCode: string | null;
  sourceZone: string | null;

  destWarehouse: string | null;
  destBinId: string | null;
  destBinCode: string | null;
  destZone: string | null;

  // Meta
  userId: string;
  userName: string;
  timestamp: string;       // ISO datetime of creation
  completedAt: string | null;

  // Optional reference
  referenceDoc: string | null;  // PO, WO, wave, etc.
  batchNumber: string | null;
  lotNumber: string | null;
  notes: string | null;

  // Snapshot deltas (for audit)
  prevQuantitySource: number | null;
  newQuantitySource: number | null;
  prevQuantityDest: number | null;
  newQuantityDest: number | null;
  prevStatusSource: BinStatus | null;
  newStatusSource: BinStatus | null;
}

// ─── Transaction Filters ──────────────────────────────────────────────────────

export interface TransactionFilters {
  search: string;
  type: TransactionType | "";
  status: TransactionStatus | "";
  skuCode: string;
  dateFrom: string;
  dateTo: string;
  warehouseName: string;
}

const DEFAULT_FILTERS: TransactionFilters = {
  search: "",
  type: "",
  status: "",
  skuCode: "",
  dateFrom: "",
  dateTo: "",
  warehouseName: "",
};

// ─── ID generator ─────────────────────────────────────────────────────────────

function generateTxnId(): string {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  return `TXN-${dateStr}-${rand}`;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface TransactionState {
  // Per-warehouse transaction log
  transactions: InventoryTransaction[];

  // UI state
  filters: TransactionFilters;
  selectedTxnId: string | null;
  isCreating: boolean;
  lastAnimatedTxnId: string | null; // for flash animation

  // Actions
  createTransaction: (
    params: Omit<InventoryTransaction, "id" | "timestamp" | "completedAt" | "status"> & { status?: TransactionStatus }
  ) => InventoryTransaction;
  // Convenience wrapper for other modules (Putaway, Picking, Returns, cycle counts) —
  // fills in warehouse/user context automatically so a real stock movement always
  // lands a completed transaction record without every caller re-deriving it.
  logMovement: (input: {
    type: TransactionType;
    skuCode: string;
    skuName: string;
    quantity: number;
    uom?: string;
    sourceBinCode?: string | null;
    destBinCode?: string | null;
    sourceZone?: string | null;
    destZone?: string | null;
    referenceDoc?: string | null;
    batchNumber?: string | null;
    lotNumber?: string | null;
    notes?: string | null;
  }) => InventoryTransaction;
  updateTransactionStatus: (id: string, status: TransactionStatus, completedAt?: string) => void;
  selectTransaction: (id: string | null) => void;
  setFilters: (f: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  setIsCreating: (v: boolean) => void;
  clearLastAnimated: () => void;

  // Derived
  filteredTransactions: () => InventoryTransaction[];
  transactionsByWarehouse: (wh: string) => InventoryTransaction[];
  recentTransactions: (limit?: number) => InventoryTransaction[];
  kpis: (warehouseName?: string) => {
    total: number;
    today: number;
    pending: number;
    completed: number;
    failed: number;
    byType: Record<TransactionType, number>;
    throughput24h: number;
  };
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_SKUS = [
  { code: "SKU-10000", name: "Aluminum Extrusion Bracket 40x40" },
  { code: "SKU-10001", name: "Steel Coil 2.5mm Hot-Rolled" },
  { code: "SKU-10002", name: "Hydraulic Pump Assembly 12V" },
  { code: "SKU-10003", name: "Carbon Fiber Filter Element" },
  { code: "SKU-10004", name: "Insulated Wire 14AWG THHN" },
  { code: "SKU-10005", name: "PCB Controller Module Rev3" },
];

const SEED_USERS = [
  { id: "u1", name: "Alex Rodriguez" },
  { id: "u4", name: "Priya Nair" },
  { id: "u7", name: "Marcus Johnson" },
  { id: "u8", name: "Tommy Wu" },
];

const SEED_TYPES: TransactionType[] = [
  "RECEIVED", "MOVED", "RACK_TRANSFER", "ADJUSTMENT", "BLOCKED", "DAMAGED", "RETURNED",
];
const SEED_STATUSES: TransactionStatus[] = ["COMPLETED", "COMPLETED", "COMPLETED", "PENDING", "FAILED"];
const SEED_BINS = ["A-01-01-01", "A-01-01-02", "B-02-01-01", "C-03-02-01", "D-04-01-03"];
const SEED_ZONES = ["Zone A — Raw Material", "Zone B — Finished Goods", "Zone C — Fast Moving", "Zone D — QC Hold"];

function buildSeedTransactions(warehouse: string): InventoryTransaction[] {
  const txns: InventoryTransaction[] = [];
  const now = new Date();

  for (let i = 0; i < 40; i++) {
    const hoursAgo = i * 0.6 + Math.random() * 0.5;
    const ts = new Date(now.getTime() - hoursAgo * 3600000);
    const sku = SEED_SKUS[i % SEED_SKUS.length];
    const type = SEED_TYPES[i % SEED_TYPES.length];
    const status = SEED_STATUSES[i % SEED_STATUSES.length];
    const user = SEED_USERS[i % SEED_USERS.length];
    const srcBin = SEED_BINS[i % SEED_BINS.length];
    const dstBin = SEED_BINS[(i + 2) % SEED_BINS.length];
    const qty = Math.floor(10 + (i * 13 % 90));

    txns.push({
      id: `TXN-${ts.toISOString().slice(0, 10).replace(/-/g, "")}-${String(100000 + i).slice(1)}`,
      type,
      status,
      skuCode: sku.code,
      skuName: sku.name,
      quantity: qty,
      uom: i % 3 === 0 ? "PLT" : i % 2 === 0 ? "KG" : "EA",
      sourceWarehouse: warehouse,
      sourceBinId: `bin-seed-${i}`,
      sourceBinCode: srcBin,
      sourceZone: SEED_ZONES[i % SEED_ZONES.length],
      destWarehouse: type === "WH_TRANSFER" ? "TRILO-DC-02" : warehouse,
      destBinId: ["RECEIVED", "ADJUSTMENT", "BLOCKED", "DAMAGED"].includes(type) ? null : `bin-seed-${i + 2}`,
      destBinCode: ["RECEIVED", "ADJUSTMENT", "BLOCKED", "DAMAGED"].includes(type) ? null : dstBin,
      destZone: ["RECEIVED", "ADJUSTMENT", "BLOCKED", "DAMAGED"].includes(type) ? null : SEED_ZONES[(i + 1) % SEED_ZONES.length],
      userId: user.id,
      userName: user.name,
      timestamp: ts.toISOString(),
      completedAt: status === "COMPLETED" ? new Date(ts.getTime() + 300000).toISOString() : null,
      referenceDoc: i % 3 === 0 ? `PO-${2024000 + i}` : i % 4 === 0 ? `WAVE-${300 + i}` : null,
      batchNumber: `BATCH-${2025}${String((i % 12) + 1).padStart(2, "0")}-${String(1001 + i * 7).slice(-4)}`,
      lotNumber: i % 5 === 0 ? `LOT-${10000 + i}` : null,
      notes: type === "DAMAGED" ? "Forklift impact damage detected during QC scan" :
             type === "BLOCKED" ? "Quarantined pending supplier verification" :
             type === "ADJUSTMENT" ? "Cycle count variance corrected" : null,
      prevQuantitySource: qty + Math.floor(Math.random() * 20),
      newQuantitySource: type === "MOVED" || type === "RACK_TRANSFER" ? 0 : qty,
      prevQuantityDest: type === "MOVED" || type === "RACK_TRANSFER" ? Math.floor(Math.random() * 30) : null,
      newQuantityDest: type === "MOVED" || type === "RACK_TRANSFER" ? qty + Math.floor(Math.random() * 30) : null,
      prevStatusSource: "Partial",
      newStatusSource: type === "BLOCKED" ? "Blocked" : type === "DAMAGED" ? "Damaged" : "Partial",
    });
  }

  return txns.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      filters: DEFAULT_FILTERS,
      selectedTxnId: null,
      isCreating: false,
      lastAnimatedTxnId: null,

      createTransaction: (params) => {
        const txn: InventoryTransaction = {
          ...params,
          id: generateTxnId(),
          timestamp: new Date().toISOString(),
          completedAt: params.status === "COMPLETED" ? new Date().toISOString() : null,
          status: params.status ?? "PENDING",
        };
        set((s) => ({
          transactions: [txn, ...s.transactions],
          lastAnimatedTxnId: txn.id,
        }));
        return txn;
      },

      logMovement: (input) => {
        const wh = useEditorStore.getState().warehouse?.name ?? "TRILO-DC-01";
        const user = useAuthStore.getState().session?.user;
        return get().createTransaction({
          type: input.type,
          skuCode: input.skuCode,
          skuName: input.skuName,
          quantity: input.quantity,
          uom: input.uom ?? "EA",
          sourceWarehouse: wh,
          sourceBinId: null,
          sourceBinCode: input.sourceBinCode ?? null,
          sourceZone: input.sourceZone ?? null,
          destWarehouse: wh,
          destBinId: null,
          destBinCode: input.destBinCode ?? null,
          destZone: input.destZone ?? null,
          userId: user?.id ?? "system",
          userName: user?.name ?? "System",
          referenceDoc: input.referenceDoc ?? null,
          batchNumber: input.batchNumber ?? null,
          lotNumber: input.lotNumber ?? null,
          notes: input.notes ?? null,
          prevQuantitySource: null,
          newQuantitySource: null,
          prevQuantityDest: null,
          newQuantityDest: null,
          prevStatusSource: null,
          newStatusSource: null,
          status: "COMPLETED",
        });
      },

      updateTransactionStatus: (id, status, completedAt) => {
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status,
                  completedAt: completedAt ?? (status === "COMPLETED" ? new Date().toISOString() : t.completedAt),
                }
              : t
          ),
        }));
      },

      selectTransaction: (id) => set({ selectedTxnId: id }),

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setIsCreating: (v) => set({ isCreating: v }),
      clearLastAnimated: () => set({ lastAnimatedTxnId: null }),

      filteredTransactions: () => {
        const { transactions, filters } = get();
        return transactions.filter((t) => {
          if (filters.type && t.type !== filters.type) return false;
          if (filters.status && t.status !== filters.status) return false;
          if (filters.skuCode && !t.skuCode.toLowerCase().includes(filters.skuCode.toLowerCase())) return false;
          if (filters.warehouseName && t.sourceWarehouse !== filters.warehouseName) return false;
          if (filters.dateFrom && t.timestamp < filters.dateFrom) return false;
          if (filters.dateTo && t.timestamp > filters.dateTo + "T23:59:59") return false;
          if (filters.search) {
            const q = filters.search.toLowerCase();
            const match =
              t.id.toLowerCase().includes(q) ||
              t.skuCode.toLowerCase().includes(q) ||
              t.skuName.toLowerCase().includes(q) ||
              t.userName.toLowerCase().includes(q) ||
              (t.sourceBinCode ?? "").toLowerCase().includes(q) ||
              (t.destBinCode ?? "").toLowerCase().includes(q) ||
              (t.referenceDoc ?? "").toLowerCase().includes(q);
            if (!match) return false;
          }
          return true;
        });
      },

      transactionsByWarehouse: (wh) => {
        return get().transactions.filter((t) => t.sourceWarehouse === wh || t.destWarehouse === wh);
      },

      recentTransactions: (limit = 10) => {
        return get().transactions.slice(0, limit);
      },

      kpis: (warehouseName) => {
        const txns = warehouseName
          ? get().transactions.filter((t) => t.sourceWarehouse === warehouseName || t.destWarehouse === warehouseName)
          : get().transactions;

        const today = new Date().toISOString().slice(0, 10);
        const h24ago = new Date(Date.now() - 86400000).toISOString();

        const byType = {} as Record<TransactionType, number>;
        const allTypes: TransactionType[] = ["RECEIVED", "MOVED", "RACK_TRANSFER", "WH_TRANSFER", "ADJUSTMENT", "BLOCKED", "DAMAGED", "RETURNED"];
        for (const t of allTypes) byType[t] = 0;

        let todayCount = 0;
        let pending = 0;
        let completed = 0;
        let failed = 0;
        let throughput24h = 0;

        for (const t of txns) {
          byType[t.type] = (byType[t.type] ?? 0) + 1;
          if (t.timestamp.startsWith(today)) todayCount++;
          if (t.timestamp >= h24ago) throughput24h++;
          if (t.status === "PENDING" || t.status === "IN_PROGRESS") pending++;
          if (t.status === "COMPLETED") completed++;
          if (t.status === "FAILED") failed++;
        }

        return { total: txns.length, today: todayCount, pending, completed, failed, byType, throughput24h };
      },
    }),
    {
      name: "trilowms-transactions-v2",
      partialize: (s) => ({ transactions: s.transactions }),
      onRehydrateStorage: () => () => {
        // demo seeding disabled — start clean
      },
    }
  )
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const TXN_TYPE_META: Record<TransactionType, { label: string; color: string; bg: string; border: string; dot: string }> = {
  RECEIVED:      { label: "Received",       color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  MOVED:         { label: "Moved",          color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/30",     dot: "bg-sky-400"     },
  RACK_TRANSFER: { label: "Rack Transfer",  color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30",  dot: "bg-violet-400"  },
  WH_TRANSFER:   { label: "WH Transfer",    color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30",  dot: "bg-indigo-400"  },
  ADJUSTMENT:    { label: "Adjustment",     color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   dot: "bg-amber-400"   },
  BLOCKED:       { label: "Blocked",        color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  dot: "bg-orange-400"  },
  DAMAGED:       { label: "Damaged",        color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",     dot: "bg-red-400"     },
  RETURNED:      { label: "Returned",       color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/30",    dot: "bg-teal-400"    },
};

export const TXN_STATUS_META: Record<TransactionStatus, { label: string; color: string; bg: string }> = {
  PENDING:     { label: "Pending",     color: "text-amber-400",   bg: "bg-amber-500/15"   },
  IN_PROGRESS: { label: "In Progress", color: "text-sky-400",     bg: "bg-sky-500/15"     },
  COMPLETED:   { label: "Completed",   color: "text-emerald-400", bg: "bg-emerald-500/15" },
  FAILED:      { label: "Failed",      color: "text-red-400",     bg: "bg-red-500/15"     },
  CANCELLED:   { label: "Cancelled",   color: "text-slate-400",   bg: "bg-slate-500/15"   },
};

export function ensureSeeded(_warehouseName: string) {
  // demo seeding disabled — start clean
}

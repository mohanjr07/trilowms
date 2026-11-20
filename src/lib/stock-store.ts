/**
 * TriloWMS — Stock Ledger
 * Single source of truth for on-hand inventory by SKU (and bin).
 * Putaway completion deposits stock here; Orders allocation reserves/consumes it.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cloudJSONStorage } from "@/lib/cloud-storage";
import { useTransactionStore } from "@/lib/transaction-store";

export interface StockRecord {
  skuCode: string;
  skuName: string;
  onHand: number;
  reserved: number;
  bins: Record<string, number>;   // binCode -> qty
  /** binCode -> ISO time the bin first received its current stock (drives FIFO). */
  binSince?: Record<string, string>;
  updatedAt: string;
}

/** Bin codes holding stock, oldest first (FIFO). Bins without a date count as oldest. */
export function fifoBins(rec: StockRecord | undefined, exclude: string[] = []): string[] {
  if (!rec) return [];
  return Object.entries(rec.bins)
    .filter(([c, q]) => q > 0 && c !== "RETURNS-RESTOCK" && !exclude.includes(c))
    .sort((a, b) => {
      const ta = rec.binSince?.[a[0]] ?? "";
      const tb = rec.binSince?.[b[0]] ?? "";
      return ta === tb ? b[1] - a[1] : ta.localeCompare(tb);
    })
    .map(([c]) => c);
}

export interface AdjustmentRecord {
  id: string;
  skuCode: string;
  skuName: string;
  previousQty: number;
  newQty: number;
  variance: number;
  reason: string;
  binCode: string | null;
  by: string;
  ts: string;
}

interface StockState {
  stock: Record<string, StockRecord>;
  adjustments: AdjustmentRecord[];

  addStock: (skuCode: string, skuName: string, qty: number, binCode?: string | null) => void;
  available: (skuCode: string) => number;
  reserve: (skuCode: string, qty: number) => number;   // returns qty actually reserved
  release: (skuCode: string, qty: number) => void;
  consume: (skuCode: string, qty: number, binCode?: string | null) => void;       // ship/pick: remove from onHand + reserved
  applyCount: (skuCode: string, countedQty: number, reason: string, binCode?: string | null, by?: string) => void;

  list: () => StockRecord[];
  kpis: () => { skus: number; totalOnHand: number; totalReserved: number; totalAvailable: number };
}

export const useStockStore = create<StockState>()(
  persist(
    (set, get) => ({
      stock: {},
      adjustments: [],

      addStock: (skuCode, skuName, qty, binCode) => {
        if (qty <= 0) return;
        set((s) => {
          const prev = s.stock[skuCode] ?? { skuCode, skuName, onHand: 0, reserved: 0, bins: {}, updatedAt: "" };
          const bins = { ...prev.bins };
          const binSince = { ...(prev.binSince ?? {}) };
          const nowIso = new Date().toISOString();
          if (binCode) {
            if (!(bins[binCode] > 0)) binSince[binCode] = nowIso;
            bins[binCode] = (bins[binCode] ?? 0) + qty;
          }
          return {
            stock: {
              ...s.stock,
              [skuCode]: { ...prev, skuName: skuName || prev.skuName, onHand: prev.onHand + qty, bins, binSince, updatedAt: nowIso },
            },
          };
        });
      },

      available: (skuCode) => {
        const r = get().stock[skuCode];
        return r ? Math.max(0, r.onHand - r.reserved) : 0;
      },

      reserve: (skuCode, qty) => {
        const r = get().stock[skuCode];
        if (!r || qty <= 0) return 0;
        const canReserve = Math.min(qty, Math.max(0, r.onHand - r.reserved));
        if (canReserve <= 0) return 0;
        set((s) => ({ stock: { ...s.stock, [skuCode]: { ...r, reserved: r.reserved + canReserve, updatedAt: new Date().toISOString() } } }));
        return canReserve;
      },

      release: (skuCode, qty) => {
        const r = get().stock[skuCode];
        if (!r || qty <= 0) return;
        set((s) => ({ stock: { ...s.stock, [skuCode]: { ...r, reserved: Math.max(0, r.reserved - qty), updatedAt: new Date().toISOString() } } }));
      },

      consume: (skuCode, qty, binCode) => {
        const r = get().stock[skuCode];
        if (!r || qty <= 0) return;
        const bins = { ...r.bins };
        const binSince = { ...(r.binSince ?? {}) };
        // Take from the named bin first, then spill to the next-oldest bins (FIFO),
        // so bin quantities always add up to on-hand when a pick spans pallets.
        let left = qty;
        const order = [...(binCode && bins[binCode] !== undefined ? [binCode] : []), ...fifoBins(r, binCode ? [binCode] : [])];
        for (const c of order) {
          if (left <= 0) break;
          const take = Math.min(bins[c] ?? 0, left);
          bins[c] = (bins[c] ?? 0) - take;
          left -= take;
          if (bins[c] <= 0) delete binSince[c];
        }
        set((s) => ({ stock: { ...s.stock, [skuCode]: { ...r, bins, binSince, onHand: Math.max(0, r.onHand - qty), reserved: Math.max(0, r.reserved - qty), updatedAt: new Date().toISOString() } } }));
      },

      applyCount: (skuCode, countedQty, reason, binCode, by = "Current User") => {
        const prev = get().stock[skuCode];
        const previousQty = prev?.onHand ?? 0;
        const newQty = Math.max(0, countedQty);
        const variance = newQty - previousQty;
        const now = new Date().toISOString();
        const record: AdjustmentRecord = {
          id: `adj-${Date.now()}`, skuCode, skuName: prev?.skuName ?? skuCode,
          previousQty, newQty, variance, reason, binCode: binCode ?? null, by, ts: now,
        };
        set((s) => {
          const base = prev ?? { skuCode, skuName: skuCode, onHand: 0, reserved: 0, bins: {}, updatedAt: now };
          const bins = { ...base.bins };
          if (binCode) bins[binCode] = newQty;
          return {
            stock: { ...s.stock, [skuCode]: { ...base, onHand: newQty, reserved: Math.min(base.reserved, newQty), bins, updatedAt: now } },
            adjustments: [record, ...s.adjustments],
          };
        });
        if (variance !== 0) {
          useTransactionStore.getState().logMovement({
            type: "ADJUSTMENT",
            skuCode,
            skuName: prev?.skuName ?? skuCode,
            quantity: Math.abs(variance),
            sourceBinCode: binCode ?? null,
            destBinCode: binCode ?? null,
            notes: `Cycle count: ${previousQty} → ${newQty} (${variance > 0 ? "+" : ""}${variance}). ${reason}`,
          });
        }
      },

      list: () => Object.values(get().stock).sort((a, b) => a.skuCode.localeCompare(b.skuCode)),

      kpis: () => {
        const recs = Object.values(get().stock);
        return {
          skus: recs.length,
          totalOnHand: recs.reduce((s, r) => s + r.onHand, 0),
          totalReserved: recs.reduce((s, r) => s + r.reserved, 0),
          totalAvailable: recs.reduce((s, r) => s + Math.max(0, r.onHand - r.reserved), 0),
        };
      },
    }),
    { name: "trilowms-stock-v1",
      storage: cloudJSONStorage,
      // Move any units parked in the virtual RETURNS-RESTOCK bin into the SKU's biggest real bin.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StockState>;
        const stock = { ...(p.stock ?? current.stock) };
        for (const [sku, rec] of Object.entries(stock)) {
          const parked = rec.bins?.["RETURNS-RESTOCK"];
          if (!parked) continue;
          const real = Object.entries(rec.bins).filter(([c]) => c !== "RETURNS-RESTOCK").sort((a, b) => b[1] - a[1])[0];
          if (!real) continue;
          const bins = { ...rec.bins };
          delete bins["RETURNS-RESTOCK"];
          bins[real[0]] = real[1] + parked;
          stock[sku] = { ...rec, bins };
        }
        return { ...current, ...p, stock };
      } },
  ),
);

/**
 * TriloWMS — Stock Ledger
 * Single source of truth for on-hand inventory by SKU (and bin).
 * Putaway completion deposits stock here; Orders allocation reserves/consumes it.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useTransactionStore } from "@/lib/transaction-store";

export interface StockRecord {
  skuCode: string;
  skuName: string;
  onHand: number;
  reserved: number;
  bins: Record<string, number>;   // binCode -> qty
  updatedAt: string;
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
  consume: (skuCode: string, qty: number) => void;       // ship/pick: remove from onHand + reserved
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
          if (binCode) bins[binCode] = (bins[binCode] ?? 0) + qty;
          return {
            stock: {
              ...s.stock,
              [skuCode]: { ...prev, skuName: skuName || prev.skuName, onHand: prev.onHand + qty, bins, updatedAt: new Date().toISOString() },
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

      consume: (skuCode, qty) => {
        const r = get().stock[skuCode];
        if (!r || qty <= 0) return;
        set((s) => ({ stock: { ...s.stock, [skuCode]: { ...r, onHand: Math.max(0, r.onHand - qty), reserved: Math.max(0, r.reserved - qty), updatedAt: new Date().toISOString() } } }));
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
    { name: "trilowms-stock-v1" },
  ),
);

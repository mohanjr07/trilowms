/**
 * TriloWMS — Stock Ledger
 * Single source of truth for on-hand inventory by SKU (and bin).
 * Putaway completion deposits stock here; Orders allocation reserves/consumes it.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StockRecord {
  skuCode: string;
  skuName: string;
  onHand: number;
  reserved: number;
  bins: Record<string, number>;   // binCode -> qty
  updatedAt: string;
}

interface StockState {
  stock: Record<string, StockRecord>;

  addStock: (skuCode: string, skuName: string, qty: number, binCode?: string | null) => void;
  available: (skuCode: string) => number;
  reserve: (skuCode: string, qty: number) => number;   // returns qty actually reserved
  release: (skuCode: string, qty: number) => void;
  consume: (skuCode: string, qty: number) => void;       // ship/pick: remove from onHand + reserved

  list: () => StockRecord[];
  kpis: () => { skus: number; totalOnHand: number; totalReserved: number; totalAvailable: number };
}

export const useStockStore = create<StockState>()(
  persist(
    (set, get) => ({
      stock: {},

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

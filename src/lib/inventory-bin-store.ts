/**
 * TriloWMS — Inventory Bin Mapping Store
 * Bins are stored per-warehouse keyed by warehouse name.
 * Switching warehouses loads that warehouse's own bins.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BinStatus } from "./wms-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BinInventory {
  binId: string;
  binCode: string;
  zoneId: string;
  zoneName: string;
  zoneColor: string;
  aisleId: string;
  rackId: string;
  rackCode: string;

  // Inventory data
  skuCode: string | null;
  skuName: string | null;
  quantity: number;
  capacity: number;
  occupancyPct: number; // 0–100
  palletCount: number;
  batchNumber: string | null;
  expiryDate: string | null; // ISO date
  status: BinStatus;
  reservedFor: string | null; // order/wave reference
  lastMovement: string | null; // ISO datetime
  weight: number; // kg
}

export interface BinSearchResult {
  binInventory: BinInventory;
  path: string; // "Zone > Aisle > Rack > Bin"
}

export interface WarehouseOccupancyKPIs {
  totalBins: number;
  occupiedBins: number;
  emptyBins: number;
  reservedBins: number;
  blockedBins: number;
  damagedBins: number;
  avgOccupancyPct: number;
  totalPallets: number;
  totalWeight: number;
  expiringWithin30Days: number;
  criticalBins: number; // ≥90% full
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const SKU_NAMES: Record<string, string> = {
  "SKU-10000": "Aluminum Extrusion Bracket 40x40",
  "SKU-10001": "Steel Coil 2.5mm Hot-Rolled",
  "SKU-10002": "Hydraulic Pump Assembly 12V",
  "SKU-10003": "Carbon Fiber Filter Element",
  "SKU-10004": "Insulated Wire 14AWG THHN",
  "SKU-10005": "PCB Controller Module Rev3",
  "SKU-10006": "Deep Groove Ball Bearing 6204-2RS",
  "SKU-10007": "Lithium Ion Cell 18650 2600mAh",
  "SKU-10008": "Stainless Steel Hex Bolt M8x40",
  "SKU-10009": "Industrial HDPE Drum 220L",
};

function randomSku(seed: number): string {
  return `SKU-${10000 + (seed % 48)}`;
}

function randomBatch(seed: number): string {
  const year = 2024 + (seed % 2);
  const month = String((seed % 12) + 1).padStart(2, "0");
  return `BATCH-${year}${month}-${String(seed * 7 + 1001).slice(-4)}`;
}

function randomExpiry(seed: number): string | null {
  if (seed % 4 !== 0) return null;
  const now = new Date();
  const daysOffset = (seed % 5 === 0) ? 15 : (seed % 3 === 0) ? 25 : 60 + (seed * 11 % 300);
  now.setDate(now.getDate() + daysOffset);
  return now.toISOString().slice(0, 10);
}

function randomLastMovement(seed: number): string {
  const now = new Date();
  now.setHours(now.getHours() - (seed % 72));
  return now.toISOString();
}

export function buildInitialBinInventory(warehouse: import("./wms-data").Warehouse): BinInventory[] {
  const records: BinInventory[] = [];
  let idx = 0;

  for (const zone of warehouse.zones) {
    for (const aisle of zone.aisles) {
      for (const rack of aisle.racks) {
        for (const bin of rack.bins) {
          const hasInventory = bin.status !== "Empty";
          const capacity = 100;
          const quantity = hasInventory
            ? bin.status === "Full" ? capacity
            : bin.status === "Partial" ? Math.floor(capacity * 0.3 + (idx % 5) * 10)
            : bin.status === "Reserved" ? Math.floor(capacity * 0.6)
            : 0
            : 0;
          const skuCode = bin.sku ?? (hasInventory ? randomSku(idx) : null);
          const skuName = skuCode ? (SKU_NAMES[skuCode] ?? `Item ${skuCode}`) : null;

          records.push({
            binId: bin.id,
            binCode: bin.code,
            zoneId: zone.id,
            zoneName: zone.name,
            zoneColor: zone.color,
            aisleId: aisle.id,
            rackId: rack.id,
            rackCode: rack.code,
            skuCode,
            skuName,
            quantity,
            capacity,
            occupancyPct: Math.round((quantity / capacity) * 100),
            palletCount: bin.pallets,
            batchNumber: hasInventory ? randomBatch(idx) : null,
            expiryDate: hasInventory ? randomExpiry(idx) : null,
            status: bin.status,
            reservedFor: bin.status === "Reserved" ? `WAVE-${200 + (idx % 20)}` : null,
            lastMovement: hasInventory ? randomLastMovement(idx) : null,
            weight: Math.round(quantity * (2 + (idx % 8)) * 10) / 10,
          });
          idx++;
        }
      }
    }
  }

  return records;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface BinInventoryFilters {
  skuSearch: string;
  binSearch: string;
  zoneId: string;
  status: BinStatus | "";
  expiringOnly: boolean;
  criticalOnly: boolean;
}

const DEFAULT_FILTERS: BinInventoryFilters = {
  skuSearch: "",
  binSearch: "",
  zoneId: "",
  status: "",
  expiringOnly: false,
  criticalOnly: false,
};

interface InvBinState {
  // Per-warehouse bin data: warehouseName → BinInventory[]
  warehouseBins: Record<string, BinInventory[]>;
  // Name of the currently active warehouse
  activeWarehouseName: string | null;

  selectedBinId: string | null;
  filters: BinInventoryFilters;
  viewMode: "heatmap" | "list" | "rack";

  // Actions
  init: (warehouse: import("./wms-data").Warehouse) => void;
  selectBin: (id: string | null) => void;
  assignSkuToBin: (binId: string, skuCode: string, skuName: string, quantity: number, batchNumber?: string, expiryDate?: string) => void;
  updateBinQuantity: (binId: string, quantity: number) => void;
  updateBinStatus: (binId: string, status: BinStatus) => void;
  clearBin: (binId: string) => void;
  // Additive movement hooks — called by Putaway (deposit) and Picking (withdraw) so the
  // bin map / heatmap reflects real goods movement instead of only its own seed data.
  depositToBin: (binCode: string, skuCode: string, skuName: string, qty: number) => void;
  withdrawFromBin: (binCode: string, qty: number) => void;
  setFilters: (f: Partial<BinInventoryFilters>) => void;
  resetFilters: () => void;
  setViewMode: (m: InvBinState["viewMode"]) => void;

  // Derived — operate on the active warehouse's bins only
  filteredBins: () => BinInventory[];
  getBinById: (id: string) => BinInventory | undefined;
  getBinByCode: (code: string) => BinInventory | undefined;
  searchSkuLocations: (skuCode: string) => BinSearchResult[];
  kpis: () => WarehouseOccupancyKPIs;
  zoneOccupancy: () => { zoneId: string; zoneName: string; color: string; occupancyPct: number; binCount: number; occupiedCount: number }[];
  rackUtilization: (rackId: string) => number;
  heatmapData: () => { binId: string; occupancyPct: number; status: BinStatus; zoneId: string }[];
}

export const useInvBinStore = create<InvBinState>()(
  persist(
    (set, get) => ({
      warehouseBins: {},
      activeWarehouseName: null,
      selectedBinId: null,
      filters: DEFAULT_FILTERS,
      viewMode: "heatmap",

      init: (warehouse) => {
        const { warehouseBins } = get();
        const alreadySeeded = !!warehouseBins[warehouse.name];
        // Always update the active warehouse name
        // Only seed bins if this warehouse hasn't been seeded yet
        if (alreadySeeded) {
          set({ activeWarehouseName: warehouse.name, selectedBinId: null });
          return;
        }
        const bins = buildInitialBinInventory(warehouse);
        set({
          activeWarehouseName: warehouse.name,
          selectedBinId: null,
          warehouseBins: { ...warehouseBins, [warehouse.name]: bins },
        });
      },

      selectBin: (id) => set({ selectedBinId: id }),

      assignSkuToBin: (binId, skuCode, skuName, quantity, batchNumber, expiryDate) => {
        const { activeWarehouseName, warehouseBins } = get();
        if (!activeWarehouseName) return;
        set({
          warehouseBins: {
            ...warehouseBins,
            [activeWarehouseName]: (warehouseBins[activeWarehouseName] ?? []).map((b) => {
              if (b.binId !== binId) return b;
              const occupancyPct = Math.min(100, Math.round((quantity / b.capacity) * 100));
              const status: BinStatus = quantity === 0 ? "Empty" : occupancyPct >= 100 ? "Full" : "Partial";
              return {
                ...b, skuCode, skuName, quantity, occupancyPct, status,
                batchNumber: batchNumber ?? b.batchNumber,
                expiryDate: expiryDate ?? b.expiryDate,
                lastMovement: new Date().toISOString(),
                palletCount: Math.ceil(quantity / 50),
              };
            }),
          },
        });
      },

      updateBinQuantity: (binId, quantity) => {
        const { activeWarehouseName, warehouseBins } = get();
        if (!activeWarehouseName) return;
        set({
          warehouseBins: {
            ...warehouseBins,
            [activeWarehouseName]: (warehouseBins[activeWarehouseName] ?? []).map((b) => {
              if (b.binId !== binId) return b;
              const occupancyPct = Math.min(100, Math.round((quantity / b.capacity) * 100));
              const status: BinStatus = quantity === 0 ? "Empty" : occupancyPct >= 100 ? "Full" : "Partial";
              return {
                ...b, quantity, occupancyPct, status,
                lastMovement: new Date().toISOString(),
                palletCount: Math.ceil(quantity / 50),
                weight: Math.round(quantity * 2.5 * 10) / 10,
              };
            }),
          },
        });
      },

      updateBinStatus: (binId, status) => {
        const { activeWarehouseName, warehouseBins } = get();
        if (!activeWarehouseName) return;
        set({
          warehouseBins: {
            ...warehouseBins,
            [activeWarehouseName]: (warehouseBins[activeWarehouseName] ?? []).map((b) =>
              b.binId === binId ? { ...b, status, lastMovement: new Date().toISOString() } : b
            ),
          },
        });
      },

      clearBin: (binId) => {
        const { activeWarehouseName, warehouseBins } = get();
        if (!activeWarehouseName) return;
        set({
          warehouseBins: {
            ...warehouseBins,
            [activeWarehouseName]: (warehouseBins[activeWarehouseName] ?? []).map((b) =>
              b.binId === binId
                ? {
                    ...b, skuCode: null, skuName: null, quantity: 0,
                    occupancyPct: 0, palletCount: 0, status: "Empty",
                    batchNumber: null, expiryDate: null, reservedFor: null,
                    lastMovement: new Date().toISOString(), weight: 0,
                  }
                : b
            ),
          },
        });
      },

      depositToBin: (binCode, skuCode, skuName, qty) => {
        if (qty <= 0) return;
        const { activeWarehouseName, warehouseBins } = get();
        if (!activeWarehouseName) return;
        set({
          warehouseBins: {
            ...warehouseBins,
            [activeWarehouseName]: (warehouseBins[activeWarehouseName] ?? []).map((b) => {
              if (b.binCode !== binCode) return b;
              const newQty = b.quantity + qty;
              const occupancyPct = Math.min(100, Math.round((newQty / b.capacity) * 100));
              const status: BinStatus = occupancyPct >= 100 ? "Full" : "Partial";
              return {
                ...b,
                skuCode: b.skuCode ?? skuCode,
                skuName: b.skuName ?? skuName,
                quantity: newQty,
                occupancyPct,
                status,
                palletCount: Math.ceil(newQty / 50),
                weight: Math.round(newQty * 2.5 * 10) / 10,
                lastMovement: new Date().toISOString(),
              };
            }),
          },
        });
      },

      withdrawFromBin: (binCode, qty) => {
        if (qty <= 0) return;
        const { activeWarehouseName, warehouseBins } = get();
        if (!activeWarehouseName) return;
        set({
          warehouseBins: {
            ...warehouseBins,
            [activeWarehouseName]: (warehouseBins[activeWarehouseName] ?? []).map((b) => {
              if (b.binCode !== binCode) return b;
              const newQty = Math.max(0, b.quantity - qty);
              const occupancyPct = Math.min(100, Math.round((newQty / b.capacity) * 100));
              const status: BinStatus = newQty === 0 ? "Empty" : occupancyPct >= 100 ? "Full" : "Partial";
              return {
                ...b,
                quantity: newQty,
                occupancyPct,
                status,
                skuCode: newQty === 0 ? null : b.skuCode,
                skuName: newQty === 0 ? null : b.skuName,
                batchNumber: newQty === 0 ? null : b.batchNumber,
                expiryDate: newQty === 0 ? null : b.expiryDate,
                palletCount: Math.ceil(newQty / 50),
                weight: Math.round(newQty * 2.5 * 10) / 10,
                lastMovement: new Date().toISOString(),
              };
            }),
          },
        });
      },

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setViewMode: (m) => set({ viewMode: m }),

      filteredBins: () => {
        const { warehouseBins, activeWarehouseName, filters } = get();
        const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
        const today = new Date();
        const in30 = new Date(); in30.setDate(today.getDate() + 30);

        return bins.filter((b) => {
          if (filters.skuSearch) {
            const q = filters.skuSearch.toLowerCase();
            if (!(b.skuCode?.toLowerCase().includes(q) || b.skuName?.toLowerCase().includes(q))) return false;
          }
          if (filters.binSearch) {
            const q = filters.binSearch.toLowerCase();
            if (!b.binCode.toLowerCase().includes(q)) return false;
          }
          if (filters.zoneId && b.zoneId !== filters.zoneId) return false;
          if (filters.status && b.status !== filters.status) return false;
          if (filters.expiringOnly) {
            if (!b.expiryDate) return false;
            if (new Date(b.expiryDate) > in30) return false;
          }
          if (filters.criticalOnly && b.occupancyPct < 90) return false;
          return true;
        });
      },

      getBinById: (id) => {
        const { warehouseBins, activeWarehouseName } = get();
        const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
        return bins.find((b) => b.binId === id);
      },

      getBinByCode: (code) => {
        const { warehouseBins, activeWarehouseName } = get();
        const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
        return bins.find((b) => b.binCode === code);
      },

      searchSkuLocations: (skuCode) => {
        const { warehouseBins, activeWarehouseName } = get();
        const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
        return bins
          .filter((b) => b.skuCode === skuCode)
          .map((b) => ({
            binInventory: b,
            path: `${b.zoneName} › Aisle › ${b.rackCode} › ${b.binCode}`,
          }));
      },

      kpis: () => {
        const { warehouseBins, activeWarehouseName } = get();
        const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
        if (bins.length === 0) return {
          totalBins: 0, occupiedBins: 0, emptyBins: 0, reservedBins: 0,
          blockedBins: 0, damagedBins: 0, avgOccupancyPct: 0,
          totalPallets: 0, totalWeight: 0, expiringWithin30Days: 0, criticalBins: 0,
        };
        const today = new Date();
        const in30 = new Date(); in30.setDate(today.getDate() + 30);
        return {
          totalBins: bins.length,
          occupiedBins: bins.filter((b) => b.status !== "Empty").length,
          emptyBins: bins.filter((b) => b.status === "Empty").length,
          reservedBins: bins.filter((b) => b.status === "Reserved").length,
          blockedBins: bins.filter((b) => b.status === "Blocked").length,
          damagedBins: bins.filter((b) => b.status === "Damaged").length,
          avgOccupancyPct: Math.round(bins.reduce((s, b) => s + b.occupancyPct, 0) / bins.length),
          totalPallets: bins.reduce((s, b) => s + b.palletCount, 0),
          totalWeight: Math.round(bins.reduce((s, b) => s + b.weight, 0)),
          expiringWithin30Days: bins.filter((b) => b.expiryDate && new Date(b.expiryDate) <= in30).length,
          criticalBins: bins.filter((b) => b.occupancyPct >= 90).length,
        };
      },

      zoneOccupancy: () => {
        const { warehouseBins, activeWarehouseName } = get();
        const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
        const map = new Map<string, { zoneName: string; color: string; total: number; occupied: number; totalPct: number }>();
        for (const b of bins) {
          const existing = map.get(b.zoneId) ?? { zoneName: b.zoneName, color: b.zoneColor, total: 0, occupied: 0, totalPct: 0 };
          map.set(b.zoneId, {
            ...existing,
            total: existing.total + 1,
            occupied: existing.occupied + (b.status !== "Empty" ? 1 : 0),
            totalPct: existing.totalPct + b.occupancyPct,
          });
        }
        return Array.from(map.entries()).map(([zoneId, v]) => ({
          zoneId,
          zoneName: v.zoneName,
          color: v.color,
          occupancyPct: Math.round(v.totalPct / v.total),
          binCount: v.total,
          occupiedCount: v.occupied,
        }));
      },

      rackUtilization: (rackId) => {
        const { warehouseBins, activeWarehouseName } = get();
        const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
        const rackBins = bins.filter((b) => b.rackId === rackId);
        if (rackBins.length === 0) return 0;
        return Math.round(rackBins.reduce((s, b) => s + b.occupancyPct, 0) / rackBins.length);
      },

      heatmapData: () => {
        const { warehouseBins, activeWarehouseName } = get();
        const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
        return bins.map((b) => ({
          binId: b.binId,
          occupancyPct: b.occupancyPct,
          status: b.status,
          zoneId: b.zoneId,
        }));
      },
    }),
    {
      name: "trilowms-inv-bin-map-v2",
      partialize: (s) => ({
        warehouseBins: s.warehouseBins,
        // Do NOT persist activeWarehouseName — it is always set by init() on mount
        // from the editor store's active warehouse, preventing stale data mismatches
      }),
    }
  )
);

/**
 * TriloWMS — Packing Module Store
 * Consumes orders that Consolidation has moved to packing (MOVED_TO_PACKING
 * lanes). No fabricated/random data — every order, line, and quantity here
 * traces back to a real Consolidation lane, which itself traces back to a
 * real Picking wave.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useConsolidationStore } from "@/lib/consolidation-store";

export type PackStationStatus = "IDLE" | "ACTIVE" | "PAUSED" | "MAINTENANCE";
export type PackOrderStatus = "QUEUED" | "ASSIGNED" | "PACKING" | "PACKED" | "LABELLED" | "MANIFESTED" | "DISPATCHED" | "EXCEPTION";
export type CartonStatus = "OPEN" | "CLOSED" | "LABELLED" | "SCANNED" | "EXCEPTION";
export type PackPriority = "STANDARD" | "RUSH" | "SAME_DAY" | "OVERNIGHT";

export interface PackStation {
  id: string;
  code: string;
  operatorId: string | null;
  operatorName: string | null;
  status: PackStationStatus;
  currentOrderId: string | null;
  packedToday: number;
  avgPackTime: number; // minutes, 0 until real pack times accumulate
  lastActivity: string | null;
  equipment: string[];
}

export interface PackItem {
  lineId: string;
  skuCode: string;
  skuName: string;
  uom: string;
  qtyRequired: number;
  qtyPacked: number;
  weight: number; // kg, captured during weigh step — 0 until then
}

export interface Carton {
  id: string;
  orderId: string;
  stationId: string | null;
  cartonCode: string;
  items: PackItem[];
  length: number;
  width: number;
  height: number;
  grossWeight: number;
  netWeight: number;
  shippingLabel: string | null;
  trackingNumber: string | null;
  status: CartonStatus;
  packedAt: string | null;
  packedBy: string | null;
  reworkRequired: boolean;
  reworkReason: string | null;
}

export interface PackOrder {
  id: string;
  orderNumber: string;
  sourceLaneId: string;     // the Consolidation lane this order was synced from (dedupe key)
  stationId: string | null;
  stationCode: string | null;
  status: PackOrderStatus;
  priority: PackPriority;
  carrier: string;
  serviceLevel: string;
  lines: PackItem[];        // master pack list synced from Consolidation
  totalLines: number;
  totalUnits: number;
  packedUnits: number;
  cartons: Carton[];
  totalWeight: number;
  shippingAddress: string;
  customer: string;
  waveId: string | null;
  packingSlip: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueBy: string;
  notes: string | null;
}

// ─── Fixed station config (physical infrastructure, not sample data) ────────
// Real deployments would manage this list from Admin → Device Setup.

const PACK_STATIONS: PackStation[] = Array.from({ length: 6 }, (_, i) => ({
  id: `ps-${i + 1}`,
  code: `PS-${String(i + 1).padStart(2, "0")}`,
  operatorId: null,
  operatorName: null,
  status: "IDLE" as PackStationStatus,
  currentOrderId: null,
  packedToday: 0,
  avgPackTime: 0,
  lastActivity: null,
  equipment: ["Label Printer", "Scale", "Scanner"],
}));

const SERVICE_LEVEL_BY_PRIORITY: Record<PackPriority, string> = {
  STANDARD: "Ground",
  RUSH: "Express",
  SAME_DAY: "Same Day",
  OVERNIGHT: "Overnight",
};

let _cartonSeq = 1;
const nextCartonCode = () => `CTN-${String(_cartonSeq++).padStart(5, "0")}`;
let _packingSlipSeq = 1;
const nextPackingSlip = () => `PS-${String(_packingSlipSeq++).padStart(5, "0")}`;

// ─── Store ────────────────────────────────────────────────────────────────────

export interface PackFilters {
  search: string;
  status: PackOrderStatus | "";
  priority: string;
  carrier: string;
  stationId: string;
}

const DEFAULT_FILTERS: PackFilters = { search: "", status: "", priority: "", carrier: "", stationId: "" };

interface PackingState {
  stations: PackStation[];
  orders: PackOrder[];
  filters: PackFilters;
  page: number;
  pageSize: number;
  lastSyncAt: string | null;

  syncFromConsolidation: () => number;
  assignOrder: (orderId: string, stationId: string) => void;
  startPacking: (orderId: string) => void;
  createCarton: (orderId: string) => void;
  scanCartonItem: (orderId: string, cartonId: string, lineId: string) => void;
  closeCarton: (orderId: string, cartonId: string, weightKg: number, dims?: { length: number; width: number; height: number }) => void;
  completeOrder: (orderId: string) => void;
  labelCarton: (orderId: string, cartonId: string, trackingNumber: string) => void;
  manifestOrder: (orderId: string) => void;
  dispatchOrder: (orderId: string) => void;
  flagException: (orderId: string, reason: string) => void;
  setFilters: (f: Partial<PackFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;

  filteredOrders: () => PackOrder[];
  pagedOrders: () => PackOrder[];
  totalPages: () => number;
  kpis: () => { activeStations: number; cartonsPacked: number; avgPackTime: string; rework: number; pendingLabel: number; dispatched: number };
  carrierList: () => string[];
  carrierMix: () => { carrier: string; count: number }[];
  statusFunnel: () => { status: PackOrderStatus; count: number }[];
  allCartons: () => (Carton & { orderNumber: string; carrier: string; customer: string })[];
}

export const usePackingStore = create<PackingState>()(
  persist(
    (set, get) => ({
      stations: PACK_STATIONS,
      orders: [],
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 15,
      lastSyncAt: null,

      // Pull every MOVED_TO_PACKING lane from Consolidation that hasn't been
      // synced into a pack order yet. Real lines, real wave, real carrier.
      syncFromConsolidation: () => {
        const { lanes } = useConsolidationStore.getState();
        const { orders } = get();
        const existingLaneIds = new Set(orders.map((o) => o.sourceLaneId));
        const eligible = lanes.filter((l) => l.status === "MOVED_TO_PACKING" && !existingLaneIds.has(l.id));
        if (eligible.length === 0) return 0;

        const now = new Date().toISOString();
        const newOrders: PackOrder[] = eligible.map((lane) => {
          const lines: PackItem[] = lane.lines
            .filter((l) => l.status === "ARRIVED" || l.status === "SHORT")
            .map((l) => ({
              lineId: l.id,
              skuCode: l.skuCode,
              skuName: l.skuName,
              uom: l.uom,
              qtyRequired: l.qtyArrived,
              qtyPacked: 0,
              weight: 0,
            }));
          const totalUnits = lines.reduce((s, l) => s + l.qtyRequired, 0);

          return {
            id: `PACK-${lane.orderId}`,
            orderNumber: lane.orderId,
            sourceLaneId: lane.id,
            stationId: null,
            stationCode: null,
            status: "QUEUED" as PackOrderStatus,
            priority: "STANDARD" as PackPriority,
            carrier: "—",
            serviceLevel: SERVICE_LEVEL_BY_PRIORITY.STANDARD,
            lines,
            totalLines: lines.length,
            totalUnits,
            packedUnits: 0,
            cartons: [],
            totalWeight: 0,
            shippingAddress: "Awaiting shipping details",
            customer: lane.orderId,
            waveId: lane.waveId,
            packingSlip: null,
            createdAt: now,
            startedAt: null,
            completedAt: null,
            dueBy: lane.movedAt ?? now,
            notes: lane.hasShortage ? "Consolidated with shortage — verify before pack" : null,
          };
        });

        set((s) => ({ orders: [...newOrders, ...s.orders], lastSyncAt: now }));
        return newOrders.length;
      },

      assignOrder: (orderId, stationId) => {
        const station = get().stations.find((s) => s.id === stationId);
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, stationId, stationCode: station?.code ?? null, status: "ASSIGNED" as PackOrderStatus } : o
          ),
          stations: s.stations.map((st) => st.id === stationId ? { ...st, currentOrderId: orderId, status: "ACTIVE" as PackStationStatus } : st),
        }));
      },

      startPacking: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, status: "PACKING" as PackOrderStatus, startedAt: o.startedAt ?? new Date().toISOString() } : o
          ),
        }));
      },

      // Opens one carton containing every line item not yet fully packed.
      createCarton: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const remaining = o.lines.filter((l) => l.qtyPacked < l.qtyRequired);
            if (remaining.length === 0) return o;
            const carton: Carton = {
              id: `CTN-${orderId}-${o.cartons.length + 1}`,
              orderId,
              stationId: o.stationId,
              cartonCode: nextCartonCode(),
              items: remaining.map((l) => ({ ...l, qtyPacked: 0 })),
              length: 0,
              width: 0,
              height: 0,
              grossWeight: 0,
              netWeight: 0,
              shippingLabel: null,
              trackingNumber: null,
              status: "OPEN",
              packedAt: null,
              packedBy: null,
              reworkRequired: false,
              reworkReason: null,
            };
            return { ...o, cartons: [...o.cartons, carton], status: o.status === "QUEUED" || o.status === "ASSIGNED" ? "PACKING" as PackOrderStatus : o.status };
          }),
        }));
      },

      // Scan one unit of a line item into an open carton.
      scanCartonItem: (orderId, cartonId, lineId) => {
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            let packedDelta = 0;
            const cartons = o.cartons.map((c) => {
              if (c.id !== cartonId || c.status !== "OPEN") return c;
              const items = c.items.map((it) => {
                if (it.lineId !== lineId || it.qtyPacked >= it.qtyRequired) return it;
                packedDelta = 1;
                return { ...it, qtyPacked: it.qtyPacked + 1 };
              });
              return { ...c, items };
            });
            const lines = o.lines.map((l) => (l.lineId === lineId ? { ...l, qtyPacked: Math.min(l.qtyRequired, l.qtyPacked + packedDelta) } : l));
            return { ...o, cartons, lines, packedUnits: o.packedUnits + packedDelta };
          }),
        }));
      },

      // Closes a carton once weighed — captures real weight/dims, no estimate.
      closeCarton: (orderId, cartonId, weightKg, dims) => {
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const cartons = o.cartons.map((c) =>
              c.id === cartonId
                ? {
                    ...c,
                    status: "CLOSED" as CartonStatus,
                    grossWeight: weightKg,
                    netWeight: weightKg,
                    length: dims?.length ?? c.length,
                    width: dims?.width ?? c.width,
                    height: dims?.height ?? c.height,
                    packedAt: new Date().toISOString(),
                  }
                : c
            );
            const totalWeight = parseFloat(cartons.reduce((s2, c) => s2 + c.grossWeight, 0).toFixed(2));
            const allLinesPacked = o.lines.every((l) => l.qtyPacked >= l.qtyRequired);
            const allCartonsClosed = cartons.every((c) => c.status !== "OPEN");
            const status: PackOrderStatus = allLinesPacked && allCartonsClosed ? "PACKED" : o.status;
            return {
              ...o,
              cartons,
              totalWeight,
              status,
              packingSlip: status === "PACKED" && !o.packingSlip ? nextPackingSlip() : o.packingSlip,
              completedAt: status === "PACKED" ? new Date().toISOString() : o.completedAt,
            };
          }),
        }));
      },

      completeOrder: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: "PACKED" as PackOrderStatus, packingSlip: o.packingSlip ?? nextPackingSlip(), completedAt: new Date().toISOString() }
              : o
          ),
        }));
      },

      labelCarton: (orderId, cartonId, trackingNumber) => {
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const cartons = o.cartons.map((c) => (c.id === cartonId ? { ...c, trackingNumber, status: "LABELLED" as CartonStatus } : c));
            const allLabelled = cartons.length > 0 && cartons.every((c) => c.status === "LABELLED");
            return { ...o, cartons, status: allLabelled ? ("LABELLED" as PackOrderStatus) : o.status };
          }),
        }));
      },

      manifestOrder: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: "MANIFESTED" as PackOrderStatus,
                  cartons: o.cartons.map((c) => (c.status === "LABELLED" ? { ...c, status: "SCANNED" as CartonStatus } : c)),
                }
              : o
          ),
        }));
      },

      dispatchOrder: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: "DISPATCHED" as PackOrderStatus, completedAt: o.completedAt ?? new Date().toISOString() }
              : o
          ),
        }));
      },

      flagException: (orderId, reason) => {
        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: "EXCEPTION" as PackOrderStatus, notes: reason } : o)),
        }));
      },

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 1 }),
      setPage: (p) => set({ page: p }),

      filteredOrders: () => {
        const { orders, filters } = get();
        return orders.filter((o) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!o.orderNumber.toLowerCase().includes(q) && !o.customer.toLowerCase().includes(q)) return false;
          }
          if (filters.status && o.status !== filters.status) return false;
          if (filters.priority && o.priority !== filters.priority) return false;
          if (filters.carrier && o.carrier !== filters.carrier) return false;
          if (filters.stationId && o.stationId !== filters.stationId) return false;
          return true;
        });
      },

      pagedOrders: () => {
        const { page, pageSize } = get();
        const all = get().filteredOrders();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => Math.max(1, Math.ceil(get().filteredOrders().length / get().pageSize)),

      kpis: () => {
        const { stations, orders } = get();
        const today = new Date().toISOString().slice(0, 10);
        const stationsWithTime = stations.filter((s) => s.avgPackTime > 0);
        return {
          activeStations: stations.filter((s) => s.status === "ACTIVE").length,
          cartonsPacked: orders.reduce((s, o) => s + o.cartons.filter((c) => c.status !== "OPEN").length, 0),
          avgPackTime: stationsWithTime.length > 0 ? `${(stationsWithTime.reduce((s, st) => s + st.avgPackTime, 0) / stationsWithTime.length).toFixed(1)}m` : "—",
          rework: orders.reduce((s, o) => s + o.cartons.filter((c) => c.reworkRequired).length, 0),
          pendingLabel: orders.filter((o) => o.status === "PACKED").length,
          dispatched: orders.filter((o) => o.status === "DISPATCHED" && o.completedAt?.startsWith(today)).length,
        };
      },

      carrierList: () => Array.from(new Set(get().orders.map((o) => o.carrier))).filter((c) => c !== "—").sort(),

      carrierMix: () => {
        const map = new Map<string, number>();
        for (const o of get().orders) map.set(o.carrier, (map.get(o.carrier) ?? 0) + 1);
        return Array.from(map.entries()).map(([carrier, count]) => ({ carrier, count })).sort((a, b) => b.count - a.count);
      },

      statusFunnel: () => {
        const order: PackOrderStatus[] = ["QUEUED", "ASSIGNED", "PACKING", "PACKED", "LABELLED", "MANIFESTED", "DISPATCHED", "EXCEPTION"];
        const map = new Map<PackOrderStatus, number>();
        for (const o of get().orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
        return order.map((status) => ({ status, count: map.get(status) ?? 0 }));
      },

      allCartons: () =>
        get().orders.flatMap((o) => o.cartons.map((c) => ({ ...c, orderNumber: o.orderNumber, carrier: o.carrier, customer: o.customer }))),
    }),
    {
      name: "trilowms-packing-v3",
      partialize: (s) => ({ stations: s.stations, orders: s.orders, lastSyncAt: s.lastSyncAt }),
    }
  )
);

export const PACK_STATUS_META: Record<PackOrderStatus, { label: string; color: string; bg: string; border: string }> = {
  QUEUED:     { label: "Queued",     color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  ASSIGNED:   { label: "Assigned",   color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  PACKING:    { label: "Packing",    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  PACKED:     { label: "Packed",     color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  LABELLED:   { label: "Labelled",   color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30"  },
  MANIFESTED: { label: "Manifested", color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30"  },
  DISPATCHED: { label: "Dispatched", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  EXCEPTION:  { label: "Exception",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
};

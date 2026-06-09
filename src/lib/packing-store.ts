/**
 * TriloWMS — Packing Module Store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PackStationStatus = "IDLE" | "ACTIVE" | "PAUSED" | "MAINTENANCE";
export type PackOrderStatus = "QUEUED" | "ASSIGNED" | "PACKING" | "PACKED" | "LABELLED" | "MANIFESTED" | "DISPATCHED" | "EXCEPTION";
export type CartonStatus = "OPEN" | "CLOSED" | "LABELLED" | "SCANNED" | "EXCEPTION";

export interface PackStation {
  id: string;
  code: string;
  operatorId: string | null;
  operatorName: string | null;
  status: PackStationStatus;
  currentOrderId: string | null;
  packedToday: number;
  avgPackTime: number;    // minutes
  lastActivity: string | null;
  equipment: string[];    // printer, scale, scanner
}

export interface PackItem {
  lineId: string;
  skuCode: string;
  skuName: string;
  uom: string;
  qtyRequired: number;
  qtyPacked: number;
  weight: number;
}

export interface Carton {
  id: string;
  orderId: string;
  stationId: string;
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
  stationId: string | null;
  stationCode: string | null;
  status: PackOrderStatus;
  priority: "STANDARD" | "RUSH" | "SAME_DAY";
  carrier: string;
  serviceLevel: string;
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

// ─── Seed ────────────────────────────────────────────────────────────────────

const OPERATORS = ["Carlos Mendez", "Sarah Kim", "Tommy Wu", "Aisha Patel", "Marcus Johnson"];
const CARRIERS_SVC = [
  { carrier: "UPS", svc: "Ground" },
  { carrier: "FedEx", svc: "2Day" },
  { carrier: "DHL", svc: "Express" },
  { carrier: "USPS", svc: "Priority" },
];
const CUSTOMERS = ["TechHub Inc.", "MegaStore Corp.", "RetailPlus", "BuildWorld", "AutoParts Direct", "HomeGoods Plus"];

const PACK_STATIONS: PackStation[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ps-${i + 1}`,
  code: `PS-${String(i + 1).padStart(2, "0")}`,
  operatorId: i < 8 ? `op${i + 1}` : null,
  operatorName: i < 8 ? OPERATORS[i % OPERATORS.length] : null,
  status: i < 8 ? (i === 3 ? "PAUSED" : "ACTIVE") : i === 8 ? "MAINTENANCE" : "IDLE",
  currentOrderId: i < 6 ? `ORD-${30000 + i}` : null,
  packedToday: Math.floor(100 + i * 47 % 300),
  avgPackTime: parseFloat((1.2 + i * 0.3 % 2).toFixed(1)),
  lastActivity: i < 8 ? new Date(Date.now() - i * 120000).toISOString() : null,
  equipment: ["Label Printer", "Scale", "Scanner", i % 2 === 0 ? "Tape Dispenser" : "Bubble Wrap Dispenser"],
}));

function buildCarton(orderId: string, stationId: string, idx: number): Carton {
  const skus = [
    { code: "SKU-10000", name: "Aluminum Bracket", weight: 0.8 },
    { code: "SKU-10002", name: "Hydraulic Pump", weight: 3.2 },
    { code: "SKU-10005", name: "PCB Controller", weight: 0.3 },
  ];
  const itemCount = 1 + (idx % 4);
  const items: PackItem[] = Array.from({ length: itemCount }, (_, j) => {
    const sku = skus[(idx + j) % skus.length];
    const qty = 1 + (j % 5);
    return { lineId: `line-${idx}-${j}`, skuCode: sku.code, skuName: sku.name, uom: "EA", qtyRequired: qty, qtyPacked: qty, weight: sku.weight };
  });
  const grossWeight = parseFloat(items.reduce((s, item) => s + item.weight * item.qtyPacked, 0).toFixed(2));
  const statuses: CartonStatus[] = ["LABELLED", "CLOSED", "OPEN", "SCANNED"];
  return {
    id: `CTN-${30000 + idx}`,
    orderId,
    stationId,
    cartonCode: `CTN-${30000 + idx}`,
    items,
    length: 30 + idx * 5 % 40,
    width: 20 + idx * 3 % 30,
    height: 15 + idx * 2 % 25,
    grossWeight,
    netWeight: parseFloat((grossWeight - 0.2).toFixed(2)),
    shippingLabel: idx % 3 !== 0 ? `LBL-${idx * 7 + 10000}` : null,
    trackingNumber: idx % 3 !== 0 ? `1Z${String(999 + idx * 13).slice(-9)}` : null,
    status: statuses[idx % statuses.length],
    packedAt: new Date(Date.now() - idx * 1800000).toISOString(),
    packedBy: OPERATORS[idx % OPERATORS.length],
    reworkRequired: idx % 9 === 0,
    reworkReason: idx % 9 === 0 ? "Weight discrepancy detected" : null,
  };
}

function buildSeedOrders(): PackOrder[] {
  const statuses: PackOrderStatus[] = ["QUEUED", "ASSIGNED", "PACKING", "PACKED", "LABELLED", "MANIFESTED", "DISPATCHED", "EXCEPTION"];
  const now = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const status = statuses[i % statuses.length];
    const station = PACK_STATIONS[i % PACK_STATIONS.length];
    const cs = CARRIERS_SVC[i % CARRIERS_SVC.length];
    const lines = 2 + (i % 6);
    const units = lines * (2 + i % 5);
    const cartonCount = 1 + Math.floor(lines / 3);
    const cartons = Array.from({ length: cartonCount }, (_, j) => buildCarton(`ORD-${30000 + i}`, station.id, i * cartonCount + j));
    const packed = ["PACKED","LABELLED","MANIFESTED","DISPATCHED"].includes(status) ? units : Math.floor(units * 0.6);
    const dueBy = new Date(now.getTime() + (i - 8) * 3600000 * 3);
    return {
      id: `ORD-${30000 + i}`,
      orderNumber: `ORD-${30000 + i}`,
      stationId: station.id,
      stationCode: station.code,
      status,
      priority: i % 7 === 0 ? "SAME_DAY" : i % 4 === 0 ? "RUSH" : "STANDARD",
      carrier: cs.carrier,
      serviceLevel: cs.svc,
      totalLines: lines,
      totalUnits: units,
      packedUnits: packed,
      cartons,
      totalWeight: parseFloat((packed * 0.8 + 0.2 * cartonCount).toFixed(2)),
      shippingAddress: `${100 + i} Main St, City ${i % 5 + 1}, ST ${10000 + i}`,
      customer: CUSTOMERS[i % CUSTOMERS.length],
      waveId: `WAVE-${300 + (i % 8)}`,
      packingSlip: `PS-${70000 + i}`,
      createdAt: new Date(now.getTime() - (i + 1) * 3600000 * 2).toISOString(),
      startedAt: status !== "QUEUED" ? new Date(now.getTime() - i * 3600000).toISOString() : null,
      completedAt: ["PACKED","LABELLED","MANIFESTED","DISPATCHED"].includes(status) ? new Date(now.getTime() - i * 1800000).toISOString() : null,
      dueBy: dueBy.toISOString(),
      notes: i % 10 === 0 ? "Fragile — handle with care" : null,
    };
  });
}

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

  assignOrder: (orderId: string, stationId: string) => void;
  startPacking: (orderId: string) => void;
  completeOrder: (orderId: string) => void;
  addCarton: (orderId: string, carton: Carton) => void;
  labelCarton: (orderId: string, cartonId: string, trackingNumber: string) => void;
  flagException: (orderId: string, reason: string) => void;
  setFilters: (f: Partial<PackFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;

  filteredOrders: () => PackOrder[];
  pagedOrders: () => PackOrder[];
  totalPages: () => number;
  kpis: () => { activeStations: number; cartonsPacked: number; avgPackTime: string; rework: number; pendingLabel: number; dispatched: number };
}

export const usePackingStore = create<PackingState>()(
  persist(
    (set, get) => ({
      stations: PACK_STATIONS,
      orders: buildSeedOrders(),
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 15,

      assignOrder: (orderId, stationId) => {
        const station = get().stations.find((s) => s.id === stationId);
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, stationId, stationCode: station?.code ?? null, status: "ASSIGNED" as PackOrderStatus } : o
          ),
        }));
      },

      startPacking: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, status: "PACKING" as PackOrderStatus, startedAt: new Date().toISOString() } : o
          ),
        }));
      },

      completeOrder: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, status: "PACKED" as PackOrderStatus, packedUnits: o.totalUnits, completedAt: new Date().toISOString() } : o
          ),
        }));
      },

      addCarton: (orderId, carton) => {
        set((s) => ({
          orders: s.orders.map((o) => o.id === orderId ? { ...o, cartons: [...o.cartons, carton] } : o),
        }));
      },

      labelCarton: (orderId, cartonId, trackingNumber) => {
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            return { ...o, cartons: o.cartons.map((c) => c.id === cartonId ? { ...c, trackingNumber, status: "LABELLED" as CartonStatus } : c) };
          }),
        }));
      },

      flagException: (orderId, reason) => {
        set((s) => ({
          orders: s.orders.map((o) => o.id === orderId ? { ...o, status: "EXCEPTION" as PackOrderStatus, notes: reason } : o),
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
        return {
          activeStations: stations.filter((s) => s.status === "ACTIVE").length,
          cartonsPacked: orders.reduce((s, o) => s + o.cartons.filter((c) => c.status !== "OPEN").length, 0),
          avgPackTime: `${(stations.filter((s) => s.avgPackTime > 0).reduce((s, st) => s + st.avgPackTime, 0) / Math.max(1, stations.filter((st) => st.avgPackTime > 0).length)).toFixed(1)}m`,
          rework: orders.reduce((s, o) => s + o.cartons.filter((c) => c.reworkRequired).length, 0),
          pendingLabel: orders.filter((o) => o.status === "PACKED").length,
          dispatched: orders.filter((o) => o.status === "DISPATCHED" && o.completedAt?.startsWith(today)).length,
        };
      },
    }),
    {
      name: "trilowms-packing-v1",
      partialize: (s) => ({ stations: s.stations, orders: s.orders }),
    }
  )
);

export const PACK_STATUS_META: Record<PackOrderStatus, { label: string; color: string; bg: string }> = {
  QUEUED:     { label: "Queued",     color: "text-slate-400",   bg: "bg-slate-500/10"   },
  ASSIGNED:   { label: "Assigned",   color: "text-blue-400",    bg: "bg-blue-500/10"    },
  PACKING:    { label: "Packing",    color: "text-amber-400",   bg: "bg-amber-500/10"   },
  PACKED:     { label: "Packed",     color: "text-cyan-400",    bg: "bg-cyan-500/10"    },
  LABELLED:   { label: "Labelled",   color: "text-indigo-400",  bg: "bg-indigo-500/10"  },
  MANIFESTED: { label: "Manifested", color: "text-violet-400",  bg: "bg-violet-500/10"  },
  DISPATCHED: { label: "Dispatched", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  EXCEPTION:  { label: "Exception",  color: "text-red-400",     bg: "bg-red-500/10"     },
};

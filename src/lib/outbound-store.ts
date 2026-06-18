/**
 * TriloWMS — Outbound Module Store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ShipmentStatus = "PLANNED" | "STAGED" | "LOADING" | "LOADED" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED" | "EXCEPTION" | "RETURNED";

export interface ShipmentOrder {
  id: string;
  orderId: string;
  cartons: number;
  pallets: number;
  weight: number;
  customer: string;
  address: string;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  carrier: string;
  serviceLevel: string;
  truckId: string | null;
  truckPlate: string | null;
  driverId: string | null;
  driverName: string | null;
  dockId: string | null;
  dockCode: string | null;
  orders: ShipmentOrder[];
  totalOrders: number;
  totalCartons: number;
  totalPallets: number;
  totalWeight: number;
  routeCode: string | null;
  stopCount: number;
  masterBOL: string | null;
  proNumber: string | null;
  sealNumber: string | null;
  scheduledDispatch: string;
  actualDispatch: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  priority: "NORMAL" | "HIGH" | "URGENT";
  slaAt: string;
  slaMet: boolean | null;
  exceptions: { code: string; description: string; ts: string }[];
  createdAt: string;
}

const CARRIERS = [
  { name: "UPS", svc: "Ground" },
  { name: "FedEx", svc: "2Day" },
  { name: "DHL", svc: "Express" },
  { name: "USPS", svc: "Priority" },
  { name: "DB Schenker", svc: "LTL" },
  { name: "XPO Logistics", svc: "TL" },
];

const CUSTOMERS = ["TechHub Inc.", "MegaStore Corp.", "RetailPlus", "BuildWorld", "AutoParts Direct"];

const DOCK_CODES = ["OUT-01","OUT-02","OUT-03","OUT-04","OUT-05"];

function buildSeedShipments(): Shipment[] {
  const statuses: ShipmentStatus[] = ["PLANNED","STAGED","LOADING","LOADED","DISPATCHED","DISPATCHED","DISPATCHED","IN_TRANSIT","DELIVERED","EXCEPTION"];
  const now = new Date();
  return Array.from({ length: 25 }, (_, i) => {
    const cs = CARRIERS[i % CARRIERS.length];
    const status = statuses[i % statuses.length];
    const orderCount = 2 + (i % 6);
    const orders: ShipmentOrder[] = Array.from({ length: orderCount }, (_, j) => ({
      id: `SO-${i * 10 + j}`,
      orderId: `ORD-${30000 + i * orderCount + j}`,
      cartons: 2 + j % 5,
      pallets: 1 + j % 3,
      weight: Math.round((50 + j * 20 + i * 5) * 10) / 10,
      customer: CUSTOMERS[(i + j) % CUSTOMERS.length],
      address: `${100 + j} Commerce Dr, City ${j + 1}, ST ${10000 + j}`,
    }));
    const totalCartons = orders.reduce((s, o) => s + o.cartons, 0);
    const totalPallets = orders.reduce((s, o) => s + o.pallets, 0);
    const totalWeight = orders.reduce((s, o) => s + o.weight, 0);
    const scheduledDispatch = new Date(now.getTime() + (i - 8) * 3600000 * 3);
    const slaAt = new Date(scheduledDispatch.getTime() + 3600000 * (4 + i % 8));
    return {
      id: `SHIP-${2000 + i}`,
      shipmentNumber: `SHIP-${2000 + i}`,
      status,
      carrier: cs.name,
      serviceLevel: cs.svc,
      truckId: ["LOADING","LOADED","DISPATCHED","IN_TRANSIT","DELIVERED"].includes(status) ? `TRK-${2000 + i}` : null,
      truckPlate: ["LOADING","LOADED","DISPATCHED","IN_TRANSIT","DELIVERED"].includes(status) ? `MH${10 + i}AB${1000 + i}` : null,
      driverId: ["LOADING","LOADED","DISPATCHED"].includes(status) ? `DRV-${i + 1}` : null,
      driverName: ["LOADING","LOADED","DISPATCHED"].includes(status) ? ["John Smith","Maria Garcia","David Lee","Anna Kim"][i % 4] : null,
      dockId: ["STAGED","LOADING","LOADED"].includes(status) ? `dock-out-${(i % 5) + 1}` : null,
      dockCode: ["STAGED","LOADING","LOADED"].includes(status) ? DOCK_CODES[i % 5] : null,
      orders,
      totalOrders: orderCount,
      totalCartons,
      totalPallets,
      totalWeight: Math.round(totalWeight * 10) / 10,
      routeCode: `RTE-${100 + i % 20}`,
      stopCount: orderCount,
      masterBOL: status !== "PLANNED" ? `BOL-${80000 + i}` : null,
      proNumber: ["DISPATCHED","IN_TRANSIT","DELIVERED"].includes(status) ? `PRO-${90000 + i}` : null,
      sealNumber: ["LOADED","DISPATCHED","IN_TRANSIT","DELIVERED"].includes(status) ? `SEAL-${1000 + i}` : null,
      scheduledDispatch: scheduledDispatch.toISOString(),
      actualDispatch: ["DISPATCHED","IN_TRANSIT","DELIVERED"].includes(status) ? new Date(scheduledDispatch.getTime() + (i % 3) * 600000).toISOString() : null,
      estimatedDelivery: new Date(scheduledDispatch.getTime() + 24 * 3600000 * (1 + i % 3)).toISOString(),
      actualDelivery: status === "DELIVERED" ? new Date(scheduledDispatch.getTime() + 24 * 3600000 * (1 + i % 3) + 3600000).toISOString() : null,
      priority: i % 8 === 0 ? "URGENT" : i % 4 === 0 ? "HIGH" : "NORMAL",
      slaAt: slaAt.toISOString(),
      slaMet: status === "DELIVERED" ? Math.random() > 0.1 : null,
      exceptions: status === "EXCEPTION" ? [{ code: "ADDR_ERR", description: "Delivery address unrecognised by carrier", ts: new Date().toISOString() }] : [],
      createdAt: new Date(scheduledDispatch.getTime() - 48 * 3600000).toISOString(),
    };
  });
}

export interface OutboundFilters {
  search: string;
  status: ShipmentStatus | "";
  carrier: string;
  priority: string;
}
const DEFAULT_FILTERS: OutboundFilters = { search: "", status: "", carrier: "", priority: "" };

interface OutboundState {
  shipments: Shipment[];
  filters: OutboundFilters;
  page: number;
  pageSize: number;

  updateStatus: (id: string, status: ShipmentStatus, extra?: Partial<Shipment>) => void;
  setFilters: (f: Partial<OutboundFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;
  filteredShipments: () => Shipment[];
  pagedShipments: () => Shipment[];
  totalPages: () => number;
  kpis: () => { dispatched: number; staged: number; loading: number; delayed: number; slaCompliance: string; trucksLoading: number; exceptionsOpen: number };
  carrierList: () => string[];
  carrierMix: () => { carrier: string; count: number }[];
  statusFunnel: () => { status: ShipmentStatus; count: number }[];
  carrierPerformance: () => { carrier: string; shipments: number; weight: number; delivered: number; slaPct: number }[];
  dispatchSchedule: () => Shipment[];
}

export const useOutboundStore = create<OutboundState>()(
  persist(
    (set, get) => ({
      shipments: buildSeedShipments(),
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 15,

      updateStatus: (id, status, extra = {}) => {
        set((s) => ({
          shipments: s.shipments.map((sh) =>
            sh.id === id ? { ...sh, ...extra, status, actualDispatch: status === "DISPATCHED" ? new Date().toISOString() : sh.actualDispatch } : sh
          ),
        }));
      },

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setPage: (p) => set({ page: p }),

      filteredShipments: () => {
        const { shipments, filters } = get();
        return shipments.filter((s) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!s.shipmentNumber.toLowerCase().includes(q) && !s.carrier.toLowerCase().includes(q) && !(s.truckId?.toLowerCase().includes(q))) return false;
          }
          if (filters.status && s.status !== filters.status) return false;
          if (filters.carrier && s.carrier !== filters.carrier) return false;
          if (filters.priority && s.priority !== filters.priority) return false;
          return true;
        });
      },

      pagedShipments: () => {
        const { page, pageSize } = get();
        const all = get().filteredShipments();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => Math.max(1, Math.ceil(get().filteredShipments().length / get().pageSize)),

      kpis: () => {
        const { shipments } = get();
        const today = new Date().toISOString().slice(0, 10);
        const delivered = shipments.filter((s) => s.status === "DELIVERED");
        const slaMet = delivered.filter((s) => s.slaMet === true).length;
        const now = new Date();
        return {
          dispatched: shipments.filter((s) => s.actualDispatch?.startsWith(today)).length,
          staged: shipments.filter((s) => s.status === "STAGED").length,
          loading: shipments.filter((s) => s.status === "LOADING").length,
          delayed: shipments.filter((s) => !["DELIVERED","EXCEPTION","RETURNED"].includes(s.status) && new Date(s.scheduledDispatch) < now).length,
          slaCompliance: delivered.length > 0 ? `${Math.round((slaMet / delivered.length) * 100)}%` : "—",
          trucksLoading: shipments.filter((s) => s.status === "LOADING").length,
          exceptionsOpen: shipments.reduce((s, sh) => s + sh.exceptions.length, 0),
        };
      },

      carrierList: () => Array.from(new Set(get().shipments.map((s) => s.carrier))).sort(),

      carrierMix: () => {
        const map = new Map<string, number>();
        for (const s of get().shipments) map.set(s.carrier, (map.get(s.carrier) ?? 0) + 1);
        return Array.from(map.entries()).map(([carrier, count]) => ({ carrier, count })).sort((a, b) => b.count - a.count);
      },

      statusFunnel: () => {
        const order: ShipmentStatus[] = ["PLANNED", "STAGED", "LOADING", "LOADED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "EXCEPTION", "RETURNED"];
        const map = new Map<ShipmentStatus, number>();
        for (const s of get().shipments) map.set(s.status, (map.get(s.status) ?? 0) + 1);
        return order.map((status) => ({ status, count: map.get(status) ?? 0 })).filter((x) => x.count > 0);
      },

      carrierPerformance: () => {
        const map = new Map<string, { carrier: string; shipments: number; weight: number; delivered: number; slaMet: number }>();
        for (const s of get().shipments) {
          const e = map.get(s.carrier) ?? { carrier: s.carrier, shipments: 0, weight: 0, delivered: 0, slaMet: 0 };
          e.shipments++;
          e.weight += s.totalWeight;
          if (s.status === "DELIVERED") { e.delivered++; if (s.slaMet) e.slaMet++; }
          map.set(s.carrier, e);
        }
        return Array.from(map.values())
          .map((v) => ({ carrier: v.carrier, shipments: v.shipments, weight: Math.round(v.weight), delivered: v.delivered, slaPct: v.delivered ? Math.round((v.slaMet / v.delivered) * 100) : 100 }))
          .sort((a, b) => b.shipments - a.shipments);
      },

      dispatchSchedule: () =>
        get()
          .shipments.filter((s) => ["PLANNED", "STAGED", "LOADING", "LOADED"].includes(s.status))
          .sort((a, b) => a.scheduledDispatch.localeCompare(b.scheduledDispatch)),
    }),
    {
      name: "trilowms-outbound-v1",
      partialize: (s) => ({ shipments: s.shipments }),
    }
  )
);

export const SHIPMENT_STATUS_META: Record<ShipmentStatus, { label: string; color: string; bg: string; border: string }> = {
  PLANNED:    { label: "Planned",    color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  STAGED:     { label: "Staged",     color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  LOADING:    { label: "Loading",    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  LOADED:     { label: "Loaded",     color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  DISPATCHED: { label: "Dispatched", color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30"  },
  IN_TRANSIT: { label: "In Transit", color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30"  },
  DELIVERED:  { label: "Delivered",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  EXCEPTION:  { label: "Exception",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  RETURNED:   { label: "Returned",   color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30"  },
};

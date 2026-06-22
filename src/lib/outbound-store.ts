/**
 * TriloWMS — Outbound Module Store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { usePackingStore } from "@/lib/packing-store";
import { useOrdersStore } from "@/lib/orders-store";

export type ShipmentStatus = "PLANNED" | "STAGED" | "LOADING" | "LOADED" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED" | "EXCEPTION" | "RETURNED";

export interface ShipmentOrder {
  id: string;
  orderId: string;
  sourceOrderId: string;
  realSourceOrderId: string; // the true orders-store order id (sourceOrderId here is the pack order's id)
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
  loadedCartons: number;
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
  syncFromPacking: () => number;
  recordCartonLoad: (id: string, count?: number) => void;
  sealAndConfirmDispatch: (id: string, sealNumber: string, override?: boolean) => boolean;
  flagException: (id: string, code: string, description: string) => void;
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
      shipments: [],
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 15,

      updateStatus: (id, status, extra = {}) => {
        const sh = get().shipments.find((s) => s.id === id);
        set((s) => ({
          shipments: s.shipments.map((sh) =>
            sh.id === id ? { ...sh, ...extra, status, actualDispatch: status === "DISPATCHED" ? new Date().toISOString() : sh.actualDispatch } : sh
          ),
        }));
        if (sh && (status === "DISPATCHED" || status === "DELIVERED") && sh.status !== status) {
          try {
            const ord = useOrdersStore.getState();
            sh.orders.forEach((o) => ord.syncStatusFromFulfillment(o.realSourceOrderId, status === "DISPATCHED" ? "SHIPPED" : "DELIVERED"));
          } catch { /* orders handoff best-effort */ }
        }
      },

      syncFromPacking: () => {
        const { orders } = usePackingStore.getState();
        const existing = new Set(get().shipments.flatMap((s) => s.orders.map((o) => o.sourceOrderId)));
        const ready = orders.filter((o) => (o.status === "MANIFESTED" || o.status === "DISPATCHED") && !existing.has(o.id));
        if (ready.length === 0) return 0;
        let n = get().shipments.length;
        const now = Date.now();
        const created: Shipment[] = ready.map((o, i) => {
          const cartons = o.cartons.length || 1;
          const pallets = Math.max(1, Math.ceil(cartons / 6));
          const seq = (++n).toString().padStart(4, "0");
          const dueMs = o.dueBy ? new Date(o.dueBy).getTime() : now + 6 * 3600000;
          return {
            id: `shp-${now}-${i}`,
            shipmentNumber: `SHP-${seq}`,
            status: "PLANNED",
            carrier: o.carrier || "Unassigned",
            serviceLevel: o.serviceLevel || "Ground",
            truckId: null, truckPlate: null, driverId: null, driverName: null,
            dockId: null, dockCode: null,
            priority: o.priority === "OVERNIGHT" || o.priority === "SAME_DAY" ? "URGENT" : o.priority === "RUSH" ? "HIGH" : "NORMAL",
            orders: [{
              id: `so-${now}-${i}`,
              orderId: o.orderNumber,
              sourceOrderId: o.id,
              realSourceOrderId: o.sourceOrderId,
              cartons,
              pallets,
              weight: Math.round(o.totalWeight),
              customer: o.customer,
              address: o.shippingAddress,
            }],
            totalOrders: 1,
            totalCartons: cartons,
            loadedCartons: 0,
            totalPallets: pallets,
            totalWeight: Math.round(o.totalWeight),
            routeCode: null,
            stopCount: 1,
            masterBOL: null, proNumber: null, sealNumber: null,
            scheduledDispatch: new Date(dueMs).toISOString(),
            actualDispatch: null,
            estimatedDelivery: null,
            actualDelivery: null,
            slaAt: new Date(dueMs).toISOString(),
            slaMet: null,
            exceptions: [],
            createdAt: new Date().toISOString(),
          } as Shipment;
        });
        set((s) => ({ shipments: [...created, ...s.shipments] }));
        return created.length;
      },

      recordCartonLoad: (id, count = 1) => {
        set((s) => ({
          shipments: s.shipments.map((sh) => {
            if (sh.id !== id) return sh;
            const loaded = Math.min(sh.totalCartons, sh.loadedCartons + count);
            const status: ShipmentStatus = sh.status === "PLANNED" || sh.status === "STAGED" ? "LOADING" : loaded >= sh.totalCartons ? "LOADED" : sh.status;
            return { ...sh, loadedCartons: loaded, status };
          }),
        }));
      },

      sealAndConfirmDispatch: (id, sealNumber, override = false) => {
        const sh = get().shipments.find((x) => x.id === id);
        if (!sh) return false;
        if (sh.loadedCartons < sh.totalCartons && !override) return false;
        const now = new Date().toISOString();
        set((s) => ({
          shipments: s.shipments.map((x) =>
            x.id === id ? { ...x, status: "DISPATCHED", sealNumber, actualDispatch: now,
              masterBOL: x.masterBOL ?? `BOL-${x.shipmentNumber.replace("SHP-", "")}`,
              proNumber: x.proNumber ?? `PRO${Math.floor(100000000 + Math.random() * 899999999)}` } : x
          ),
        }));
        // close the loop: mark the source packing order dispatched
        try {
          const pk = usePackingStore.getState() as unknown as { dispatchOrder?: (oid: string) => void };
          sh.orders.forEach((o) => pk.dispatchOrder?.(o.sourceOrderId));
        } catch { /* packing handoff best-effort */ }
        // close the loop all the way: the real sales order is now actually shipped —
        // this is the final link that was missing between Orders and dispatch.
        try {
          const ord = useOrdersStore.getState();
          sh.orders.forEach((o) => ord.syncStatusFromFulfillment(o.realSourceOrderId, "SHIPPED"));
        } catch { /* orders handoff best-effort */ }
        return true;
      },

      flagException: (id, code, description) => {
        set((s) => ({
          shipments: s.shipments.map((sh) =>
            sh.id === id ? { ...sh, status: "EXCEPTION", exceptions: [...sh.exceptions, { code, description, ts: new Date().toISOString() }] } : sh
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
      name: "trilowms-outbound-v2",
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

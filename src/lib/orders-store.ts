/**
 * TriloWMS — Orders Store
 * Outward operations begin here: order intake (manual + import), stock
 * allocation/reservation, and lifecycle tracking through fulfillment.
 * Allocation is the hook the Picking module consumes downstream.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useStockStore } from "@/lib/stock-store";

export type OrderStatus =
  | "NEW" | "ALLOCATED" | "PICKING" | "PACKED" | "SHIPPED" | "DELIVERED" | "EXCEPTION" | "CANCELLED";
export type AllocStatus = "UNALLOCATED" | "PARTIAL" | "ALLOCATED";
export type OrderPriority = "RUSH" | "NORMAL";

export interface OrderLine {
  id: string;
  lineNo: number;
  skuCode: string;
  skuName: string;
  uom: string;
  requestedQty: number;
  availableQty: number;   // notional on-hand used for allocation
  allocatedQty: number;
  binCode: string | null;
  allocStatus: AllocStatus;
}

export interface OrderStage {
  status: OrderStatus;
  ts: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  customerCode: string;
  channel: string;           // Web / EDI / Phone / Marketplace
  shippingMethod: string;
  carrier: string | null;
  priority: OrderPriority;
  status: OrderStatus;
  lines: OrderLine[];
  totalLines: number;
  totalUnits: number;
  allocatedUnits: number;
  shipToAddress: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  dueBy: string;
  slaHours: number;
  stages: OrderStage[];
  pickWaveNumber: string | null;
}

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; border: string }> = {
  NEW:       { label: "New",       color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  ALLOCATED: { label: "Allocated", color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  PICKING:   { label: "Picking",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  PACKED:    { label: "Packed",    color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  SHIPPED:   { label: "Shipped",   color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30"  },
  DELIVERED: { label: "Delivered", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  EXCEPTION: { label: "Exception", color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  CANCELLED: { label: "Cancelled", color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};

export interface OrderLineInput { skuCode: string; skuName: string; uom: string; requestedQty: number; availableQty?: number; }
export interface CreateOrderInput {
  customer: string; channel: string; shippingMethod: string; carrier?: string | null;
  priority: OrderPriority; shipToAddress: string; notes?: string | null; slaHours?: number;
  lines: OrderLineInput[];
}

export interface OrderFilters { search: string; status: OrderStatus | ""; customer: string; priority: OrderPriority | ""; }
const DEFAULT_FILTERS: OrderFilters = { search: "", status: "", customer: "", priority: "" };

let _seq = 1000;
const nextOrderNo = () => `ORD-${(++_seq).toString().padStart(5, "0")}`;

interface OrdersState {
  orders: Order[];
  filters: OrderFilters;
  page: number;
  pageSize: number;
  selectedOrderId: string | null;

  createOrder: (data: CreateOrderInput) => Order;
  importOrders: (rows: { customer: string; skuCode: string; skuName: string; qty: number }[]) => number;
  autoAllocate: (orderId: string) => { fully: boolean; shortLines: number };
  setLineAllocation: (orderId: string, lineId: string, allocatedQty: number, binCode?: string) => void;
  bulkAllocate: (ids: string[]) => void;
  updateStatus: (orderId: string, status: OrderStatus) => void;
  linkPickWave: (orderId: string, waveNumber: string) => void;
  cancelOrder: (orderId: string) => void;
  selectOrder: (id: string | null) => void;
  setFilters: (f: Partial<OrderFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;

  filteredOrders: () => Order[];
  kpis: () => { newOrders: number; allocated: number; inFulfillment: number; shipped: number; exceptions: number; fulfillmentRate: string; avgCycleHrs: string; backordered: number };
  statusFunnel: () => { status: OrderStatus; count: number }[];
  customerList: () => string[];
  allocatableOrders: () => Order[];
}

function recalc(o: Order): Order {
  const totalUnits = o.lines.reduce((s, l) => s + l.requestedQty, 0);
  const allocatedUnits = o.lines.reduce((s, l) => s + l.allocatedQty, 0);
  return { ...o, totalLines: o.lines.length, totalUnits, allocatedUnits };
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 14,
      selectedOrderId: null,

      createOrder: (data) => {
        const now = new Date().toISOString();
        const lines: OrderLine[] = data.lines.map((l, i) => ({
          id: `ol-${Date.now()}-${i}`,
          lineNo: i + 1,
          skuCode: l.skuCode,
          skuName: l.skuName,
          uom: l.uom || "EA",
          requestedQty: l.requestedQty,
          availableQty: l.availableQty ?? useStockStore.getState().available(l.skuCode),
          allocatedQty: 0,
          binCode: null,
          allocStatus: "UNALLOCATED",
        }));
        const slaHours = data.slaHours ?? (data.priority === "RUSH" ? 4 : 24);
        const order: Order = recalc({
          id: `ord-${Date.now()}`,
          orderNumber: nextOrderNo(),
          customer: data.customer,
          customerCode: data.customer.slice(0, 3).toUpperCase() + "-" + Math.floor(100 + Math.random() * 899),
          channel: data.channel,
          shippingMethod: data.shippingMethod,
          carrier: data.carrier ?? null,
          priority: data.priority,
          status: "NEW",
          lines,
          totalLines: lines.length,
          totalUnits: 0,
          allocatedUnits: 0,
          shipToAddress: data.shipToAddress,
          notes: data.notes ?? null,
          createdBy: "Current User",
          createdAt: now,
          dueBy: new Date(Date.now() + slaHours * 3600000).toISOString(),
          slaHours,
          stages: [{ status: "NEW", ts: now }],
          pickWaveNumber: null,
        });
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },

      importOrders: (rows) => {
        // group rows by customer into one order each
        const byCustomer = new Map<string, { skuCode: string; skuName: string; qty: number }[]>();
        for (const r of rows) byCustomer.set(r.customer, [...(byCustomer.get(r.customer) ?? []), r]);
        let count = 0;
        for (const [customer, items] of byCustomer) {
          get().createOrder({
            customer, channel: "EDI", shippingMethod: "Standard Ground", priority: "NORMAL",
            shipToAddress: "Imported — address pending", notes: "Imported via CSV",
            lines: items.map((it) => ({ skuCode: it.skuCode, skuName: it.skuName || it.skuCode, uom: "EA", requestedQty: it.qty })),
          });
          count++;
        }
        return count;
      },

      autoAllocate: (orderId) => {
        let shortLines = 0;
        const stock = useStockStore.getState();
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const lines = o.lines.map((l) => {
              const already = l.allocatedQty;
              const need = l.requestedQty - already;
              const reserved = need > 0 ? stock.reserve(l.skuCode, need) : 0;
              const alloc = already + reserved;
              const avail = stock.available(l.skuCode) + alloc; // on-hand snapshot for display
              if (alloc < l.requestedQty) shortLines++;
              const allocStatus: AllocStatus = alloc === 0 ? "UNALLOCATED" : alloc < l.requestedQty ? "PARTIAL" : "ALLOCATED";
              const binCode = l.binCode ?? (stock.stock[l.skuCode] ? Object.keys(stock.stock[l.skuCode].bins)[0] ?? "PICK-FACE" : "PICK-FACE");
              return { ...l, allocatedQty: alloc, availableQty: avail, allocStatus, binCode };
            });
            const allDone = lines.every((l) => l.allocStatus === "ALLOCATED");
            const anyDone = lines.some((l) => l.allocatedQty > 0);
            const now = new Date().toISOString();
            const status: OrderStatus = allDone ? "ALLOCATED" : anyDone ? "EXCEPTION" : "NEW";
            const stages = status !== o.status ? [...o.stages, { status, ts: now }] : o.stages;
            return recalc({ ...o, lines, status, stages });
          }),
        }));
        return { fully: shortLines === 0, shortLines };
      },

      setLineAllocation: (orderId, lineId, allocatedQty, binCode) => {
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const lines = o.lines.map((l) => {
              if (l.id !== lineId) return l;
              const a = Math.max(0, Math.min(allocatedQty, l.requestedQty));
              const allocStatus: AllocStatus = a === 0 ? "UNALLOCATED" : a < l.requestedQty ? "PARTIAL" : "ALLOCATED";
              return { ...l, allocatedQty: a, allocStatus, binCode: binCode ?? l.binCode };
            });
            return recalc({ ...o, lines });
          }),
        }));
      },

      bulkAllocate: (ids) => { ids.forEach((id) => get().autoAllocate(id)); },

      updateStatus: (orderId, status) => set((s) => ({
        orders: s.orders.map((o) => {
          if (o.id !== orderId) return o;
          const now = new Date().toISOString();
          return { ...o, status, stages: [...o.stages, { status, ts: now }] };
        }),
      })),

      linkPickWave: (orderId, waveNumber) => set((s) => ({
        orders: s.orders.map((o) => {
          if (o.id !== orderId) return o;
          const now = new Date().toISOString();
          return { ...o, status: "PICKING" as OrderStatus, pickWaveNumber: waveNumber, stages: [...o.stages, { status: "PICKING" as OrderStatus, ts: now }] };
        }),
      })),

      cancelOrder: (orderId) => {
        const o = get().orders.find((x) => x.id === orderId);
        if (o && !["SHIPPED", "DELIVERED"].includes(o.status)) {
          const stock = useStockStore.getState();
          o.lines.forEach((l) => l.allocatedQty > 0 && stock.release(l.skuCode, l.allocatedQty));
        }
        get().updateStatus(orderId, "CANCELLED");
      },
      selectOrder: (id) => set({ selectedOrderId: id }),
      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 1 }),
      setPage: (p) => set({ page: p }),

      filteredOrders: () => {
        const { orders, filters } = get();
        const q = filters.search.toLowerCase();
        return orders.filter((o) => {
          if (filters.status && o.status !== filters.status) return false;
          if (filters.customer && o.customer !== filters.customer) return false;
          if (filters.priority && o.priority !== filters.priority) return false;
          if (q && !(o.orderNumber.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q))) return false;
          return true;
        });
      },

      kpis: () => {
        const o = get().orders;
        const today = new Date().toISOString().slice(0, 10);
        const shippedToday = o.filter((x) => x.status === "SHIPPED" && x.stages.some((s) => s.status === "SHIPPED" && s.ts.startsWith(today)));
        const completed = o.filter((x) => ["SHIPPED", "DELIVERED"].includes(x.status));
        const clean = completed.filter((x) => x.status !== "EXCEPTION");
        const cycles = completed.map((x) => {
          const start = new Date(x.createdAt).getTime();
          const end = new Date(x.stages.find((s) => s.status === "SHIPPED")?.ts ?? x.createdAt).getTime();
          return (end - start) / 3600000;
        });
        const avg = cycles.length ? (cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;
        const backordered = o.filter((x) => x.lines.some((l) => l.allocStatus === "PARTIAL")).length;
        return {
          newOrders: o.filter((x) => x.status === "NEW").length,
          allocated: o.filter((x) => x.status === "ALLOCATED").length,
          inFulfillment: o.filter((x) => ["PICKING", "PACKED"].includes(x.status)).length,
          shipped: shippedToday.length,
          exceptions: o.filter((x) => x.status === "EXCEPTION").length,
          fulfillmentRate: completed.length ? `${Math.round((clean.length / completed.length) * 100)}%` : "—",
          avgCycleHrs: completed.length ? `${avg.toFixed(1)}h` : "—",
          backordered,
        };
      },

      statusFunnel: () => {
        const order: OrderStatus[] = ["NEW","ALLOCATED","PICKING","PACKED","SHIPPED","DELIVERED","EXCEPTION"];
        const map = new Map<OrderStatus, number>();
        for (const o of get().orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
        return order.map((status) => ({ status, count: map.get(status) ?? 0 })).filter((x) => x.count > 0);
      },

      customerList: () => Array.from(new Set(get().orders.map((o) => o.customer))).sort(),
      allocatableOrders: () => get().orders.filter((o) => o.status === "NEW"),
    }),
    { name: "trilowms-orders-v2" },
  ),
);
